import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assert, assertSchemaValid, type Harness } from "./_harness.js";
import { laneKeys, type BusinessStateV2, type LaneKey, type RunStateDocument, type Status } from "../../core/schema/types.js";
import {
  compilePlan,
  type CatalogArtifact,
  type CatalogInput,
  type CatalogWorkflowNode,
  type CompiledPlan,
  type RunNodeId,
} from "../../core/engine/compile.js";
import { allowAllAutonomyEvaluator, computeFrontier, type AutonomyEvaluator } from "../../core/engine/frontier.js";
import { buildDispatchBatches, checkBatchBoundary, neverHaltDispatchHooks } from "../../core/engine/dispatch.js";
import { composeNodeBrief, renderNodeBrief } from "../../core/engine/node-brief.js";
import { buildBoundaryResults, buildLaunchMatrix } from "../../core/adapters/platform-execution.js";
import { buildWorkerCommand, receiptFileDigest } from "../../core/session/executor.js";
import { buildWorkerPrompt, validateKnowledgeReceipt } from "../../core/session/worker-prompt.js";
import {
  APP_SOURCE_FINGERPRINT_PATH,
  fingerprintAppSource,
  ingestSourceFingerprint,
  observeAppSourceFingerprint,
} from "../../core/engine/source-fingerprint.js";
import { runtimeCatalogVersion } from "../../core/session/run.js";
import { createAutonomyEvaluator } from "../../core/autonomy/evaluator.js";
import { applyStandingApprovals } from "../../core/autonomy/standing-approvals.js";
import {
  acceptVerification,
  abandonDependencyRefreshesForConsumer,
  beginAttempt,
  buildCheckpoint,
  detectOrphans,
  invalidateDescendants,
  isWallClockExceeded,
  loadCheckpoint,
  loadRunState,
  reconcilePatch,
  refreshHeartbeat,
  reconcileWorkflowApplicability,
  refreshDependenciesBeforeFrontier,
  deferDependencyRefreshAfterFailure,
  seedRunState,
  wallClockDeadline,
  writeCheckpoint,
  writeRunState,
} from "../../core/engine/runstate.js";

const RUN_STATE_SCHEMA = "urn:formation:core:run-state-schema";
const CHECKPOINT_SCHEMA = "urn:formation:core:checkpoint-schema";

const now = "2026-08-05T09:00:00.000Z";

function plusSeconds(iso: string, seconds: number): string {
  return new Date(Date.parse(iso) + seconds * 1000).toISOString();
}

// --- Small test catalog (U8 delivers the real graph-derived catalog later). ---
// Chain: research-scan -> product-spec -> {engineering-build, engineering-build-sub} -> revenue-report
// Independent root: growth-post. engineering-build/engineering-build-sub deliberately claim
// resource.path.foo and resource.path.foo.bar (prefix-overlapping) per the plan's literal
// dispatch test scenario, and both depend on product-spec so they land in the same frontier pass.
function testArtifacts(): CatalogArtifact[] {
  return [
    { id: "artifact.research-brief", path: "research/brief.md" },
    { id: "artifact.product-spec", path: "product/spec.md" },
    { id: "artifact.engineering-build", path: "foo" },
    { id: "artifact.engineering-build-sub", path: "foo/bar" },
    { id: "artifact.revenue-report", path: "revenue/report.md" },
    { id: "artifact.growth-post", path: "growth/post.md" },
  ];
}

function testWorkflows(): CatalogWorkflowNode[] {
  return [
    {
      id: "workflow.research-scan",
      title: "Research scan",
      domainId: "domain.research",
      actionClass: "observe",
      // The one fixture node carrying the full authored contract (2026-08), so composeNodeBrief
      // has a real shape to compose; the others stay contract-less on purpose to pin the
      // explicit "(not authored)" degradation path.
      trigger: "fixture trigger",
      instructions: "Scan the category and write the brief.",
      reads: ["state/PROJECT_STATE.yaml"],
      references: [{ id: "reference.research.fixture", path: "knowledge/research/fixture.md", title: "Fixture Research", loadWhen: "fixture moment" }],
      role: {
        id: "role.product-leader",
        name: "Product leader",
        promptPath: "agents/product-leader.md",
        parentPromptPaths: ["AGENTS.md", "APP_AGENTS.md"],
        contextPacks: [
          {
            id: "context.research",
            title: "Research",
            references: [
              { id: "reference.research.role", path: "knowledge/research/role.md", title: "Role Research", loadWhen: "competitor evidence is needed" },
            ],
          },
        ],
        skillRoutes: [{ id: "fixture-product-skill", when: "fixture" }],
        toolRoutes: [{ id: "fixture-product-tool", when: "fixture" }],
      },
      dependencies: [],
      outputPaths: ["research/brief.md"],
      providerIds: [],
      laneIds: ["research"],
      founderOnlyActions: [],
      gateCommands: [],
      idempotent: true,
    },
    {
      id: "workflow.product-spec",
      title: "Product spec",
      domainId: "domain.product",
      actionClass: "draft",
      dependencies: ["workflow.research-scan"],
      outputPaths: ["product/spec.md"],
      providerIds: [],
      laneIds: ["product"],
      founderOnlyActions: [],
      gateCommands: ["check:research"],
      idempotent: true,
    },
    {
      id: "workflow.engineering-build",
      title: "Engineering build",
      domainId: "domain.engineering",
      actionClass: "mutate",
      dependencies: ["workflow.product-spec"],
      outputPaths: ["foo"],
      providerIds: [],
      laneIds: ["engineering"],
      founderOnlyActions: [],
      gateCommands: [],
      idempotent: true,
    },
    {
      id: "workflow.engineering-build-sub",
      title: "Engineering build (sub)",
      domainId: "domain.engineering",
      actionClass: "mutate",
      dependencies: ["workflow.product-spec"],
      outputPaths: ["foo/bar"],
      providerIds: [],
      laneIds: ["engineering"],
      founderOnlyActions: [],
      gateCommands: [],
      idempotent: true,
    },
    {
      id: "workflow.revenue-report",
      title: "Revenue report",
      domainId: "domain.money",
      actionClass: "spend",
      protectedCategory: "spend",
      dependencies: ["workflow.engineering-build"],
      outputPaths: ["revenue/report.md"],
      providerIds: ["provider.stripe"],
      laneIds: ["revenue"],
      founderOnlyActions: ["Approve spend for paid acquisition test"],
      gateCommands: [],
      idempotent: false,
      costEstimate: { amount: 25, currency: "USD" },
    },
    {
      id: "workflow.growth-post",
      title: "Growth post",
      domainId: "domain.growth",
      actionClass: "publish",
      protectedCategory: "public_actions",
      dependencies: [],
      outputPaths: ["growth/post.md"],
      providerIds: ["provider.resend"],
      laneIds: ["growth"],
      founderOnlyActions: [],
      gateCommands: [],
      idempotent: false,
    },
  ];
}

function testCatalog(): CatalogInput {
  return { version: "catalog.test.1", artifacts: testArtifacts(), workflows: testWorkflows() };
}

function baseBusinessState(overrides: Partial<Record<LaneKey, Status>> = {}): BusinessStateV2 {
  const lanes = {} as BusinessStateV2["lanes"];
  for (const key of laneKeys) lanes[key] = { status: overrides[key] ?? "pending", evidence: [], blockers: [] };
  return {
    schemaVersion: "2.0.0",
    updatedAt: now,
    narrative: { sinceLastTime: "", rightNow: "", yourCall: "", lastCelebratedPhase: "" },
    project: {
      name: "Engine Fixture App",
      slug: "engine-fixture-app",
      owner: "Founder",
      phase: "phase_0_orient",
      launchScope: "essentials",
      kickoffDate: "",
      platforms: ["ios"],
      bundleIds: { ios: "com.example.app", android: "" },
      publicUrls: { landing: "", privacy: "", terms: "" },
    },
    lanes,
    founderGates: { pending: [] },
  };
}

const nodeId = (workflowSlug: string): RunNodeId => `run.${workflowSlug}` as RunNodeId;

/**
 * Routes a status reset through a Status-typed parameter so TS doesn't over-narrow the property
 * to the assigned literal across the computeFrontier() call that follows — TS's control-flow
 * analysis is intra-procedural and doesn't know that call mutates run.nodes[id].status.
 */
function setStatus(run: RunStateDocument, id: RunNodeId, status: Status): void {
  run.nodes[id]!.status = status;
}

/** Same rationale as setStatus: reads through a call so an equality check here doesn't narrow a stable `const` key across an intervening mutating call. */
function getStatus(run: RunStateDocument, id: RunNodeId): Status {
  return run.nodes[id]!.status;
}

function getApprovalStatus(run: RunStateDocument, id: string): "pending" | "approved" | "rejected" | undefined {
  return run.approvals[id];
}

export function register(harness: Harness): void {
  // ---------------------------------------------------------------------
  // compile.ts
  // ---------------------------------------------------------------------

  harness.check("compile: byte-stable planId for the same catalog input", () => {
    const a = compilePlan(testCatalog(), now);
    const b = compilePlan(testCatalog(), now);
    assert(a.planId === b.planId, `expected deterministic planId, got "${a.planId}" and "${b.planId}"`);
  });

  harness.check("compile: unknown dependency reference fails closed", () => {
    const catalog = testCatalog();
    catalog.workflows[1]!.dependencies = ["workflow.does-not-exist"];
    let threw = false;
    try {
      compilePlan(catalog, now);
    } catch (error) {
      threw = true;
      assert(String(error).includes("workflow.does-not-exist"), `expected error to name the unknown dependency, got: ${error}`);
    }
    assert(threw, "expected compilePlan to throw on an unknown dependency");
  });

  harness.check("compile: ambiguous shared write (two workflows, one declared output) fails closed", () => {
    const catalog = testCatalog();
    catalog.workflows[3]!.outputPaths = ["foo"]; // now collides with workflow.engineering-build's "foo"
    let threw = false;
    try {
      compilePlan(catalog, now);
    } catch (error) {
      threw = true;
      assert(String(error).includes("Ambiguous"), `expected an ambiguous-write error, got: ${error}`);
    }
    assert(threw, "expected compilePlan to reject two workflows declaring the same output artifact");
  });

  harness.check("compile: resource claims cover path, provider, and founder-attention", () => {
    const plan = compilePlan(testCatalog(), now);
    const revenue = plan.nodes.find((node) => node.id === nodeId("revenue-report"))!;
    const ids = revenue.resources.map((claim) => claim.id);
    assert(ids.includes("resource.path.revenue.report.md"), `missing path claim, got: ${ids.join(", ")}`);
    assert(ids.includes("resource.provider.stripe"), `missing provider claim, got: ${ids.join(", ")}`);
    assert(ids.includes("resource.founder.attention"), `missing founder-attention claim, got: ${ids.join(", ")}`);
    assert(
      revenue.resources.every((claim) => claim.mode === "exclusive"),
      "expected every claim on a mutating/founder-gated node to be exclusive",
    );
  });

  harness.check("compile: dependency chain and derived inputs are wired correctly", () => {
    const plan = compilePlan(testCatalog(), now);
    const productSpec = plan.nodes.find((node) => node.id === nodeId("product-spec"))!;
    assert(productSpec.dependencies.includes(nodeId("research-scan")), "product-spec should depend on research-scan");
    assert(productSpec.inputs.includes("artifact.research-brief"), "product-spec should consume artifact.research-brief");
  });

  harness.check("runstate: fresh dependency cycles reopen a succeeded dependency exactly once before frontier selection", () => {
    const catalog = testCatalog();
    catalog.workflows[1]!.refreshDependencies = [
      { workflowId: "workflow.research-scan", instructions: "Refresh the research brief for the product-specific evidence scope before drafting." },
    ];
    const plan = compilePlan(catalog, now);
    const { businessState, run } = seedFor(["research"], plan);
    const researchId = nodeId("research-scan");
    const productId = nodeId("product-spec");
    const reopened = refreshDependenciesBeforeFrontier(plan, run, now);
    assert(reopened.includes(researchId), "the succeeded research dependency must reopen before product dispatch");
    assert(run.nodes[researchId]!.status === "stale", "the refreshed dependency must be frontier-eligible as stale");
    assert(!run.artifactBindings.find((binding) => binding.artifactId === "artifact.research-brief")!.accepted, "refresh must invalidate old output proof");
    assert(!computeFrontier(plan, run, businessState, allowAllAutonomyEvaluator).ready.includes(productId), "the consumer must wait for refreshed proof");
    run.nodes[researchId]!.status = "succeeded";
    run.artifactBindings.find((binding) => binding.artifactId === "artifact.research-brief")!.accepted = true;
    assert(refreshDependenciesBeforeFrontier(plan, run, plusSeconds(now, 1)).length === 0, "the same consumer attempt cycle must not reopen twice");
    run.artifactBindings.find((binding) => binding.artifactId === "artifact.research-brief")!.accepted = false;
    const failedRefreshAttempt = beginAttempt(plan, run, researchId, "session-refresh-failure", plusSeconds(now, 2));
    failedRefreshAttempt.status = "failed";
    assert(deferDependencyRefreshAfterFailure(plan, run, researchId, plusSeconds(now, 3)), "a scoped refresh failure must be recognized");
    assert(String(run.nodes[researchId]!.status) === "stale", "a failed scoped refresh must remain retry-eligible");
    assert(
      !run.artifactBindings.find((binding) => binding.artifactId === "artifact.research-brief")!.accepted,
      "a failed scoped refresh must not attest bytes the engine did not restore",
    );
    assert(
      (run.nodes[productId]!.dependencyRefreshCycles?.length ?? 0) === 1,
      "a failed scoped refresh must retain durable authorization for a later-session retry",
    );
    run.nodes[productId]!.status = "not_needed";
    assert(
      abandonDependencyRefreshesForConsumer(plan, run, productId, plusSeconds(now, 4)).includes(researchId),
      "parking a refresh consumer must abandon its durable scope",
    );
    assert((run.nodes[productId]!.dependencyRefreshCycles?.length ?? 0) === 0, "abandonment must clear the parked consumer's refresh token");
    assert(run.nodes[researchId]!.refreshInstructions === undefined, "abandonment must clear obsolete dependency instructions");
    assert(String(run.nodes[researchId]!.status) === "stale", "abandonment must leave unknown dependency bytes eligible for generic repair");

    const { run: verifiedRollbackRun } = seedFor([], plan);
    const acceptedAttempt = beginAttempt(plan, verifiedRollbackRun, researchId, "session-original-producer", plusSeconds(now, 4));
    reconcilePatch(
      plan,
      verifiedRollbackRun,
      {
        nodeId: researchId,
        attemptId: acceptedAttempt.id,
        outputs: [{ artifactId: "artifact.research-brief", path: "research/brief.md", fingerprint: "sha256:accepted", evidence: ["accepted original"] }],
      },
      plusSeconds(now, 5),
    );
    acceptVerification(plan, verifiedRollbackRun, researchId, ["independent review"], plusSeconds(now, 6), "session-original-reviewer");
    assert(
      refreshDependenciesBeforeFrontier(plan, verifiedRollbackRun, plusSeconds(now, 7)).includes(researchId),
      "verified proof must enter a scoped refresh",
    );
    const rejectedRefresh = beginAttempt(plan, verifiedRollbackRun, researchId, "session-refresh-producer", plusSeconds(now, 8));
    rejectedRefresh.status = "failed";
    deferDependencyRefreshAfterFailure(plan, verifiedRollbackRun, researchId, plusSeconds(now, 9));
    assert(
      !buildBoundaryResults(plan, verifiedRollbackRun).some((result) => result.workflowId === "workflow.research-scan"),
      "a failed refresh must suppress boundary export until a later scoped retry accepts the actual bytes",
    );

    const { run: initiallyPending } = seedFor([], plan);
    assert(refreshDependenciesBeforeFrontier(plan, initiallyPending, now).length === 0, "a dependency that has not run yet must not consume the refresh cycle");
    assert(
      (initiallyPending.nodes[productId]!.dependencyRefreshCycles?.length ?? 0) === 0,
      "the pending dependency must leave the consumer refresh token unrecorded",
    );
    initiallyPending.nodes[researchId]!.status = "succeeded";
    initiallyPending.artifactBindings.find((binding) => binding.artifactId === "artifact.research-brief")!.accepted = true;
    assert(
      refreshDependenciesBeforeFrontier(plan, initiallyPending, plusSeconds(now, 1)).includes(researchId),
      "the dependency must reopen after its generic first pass succeeds",
    );
    assert(
      initiallyPending.nodes[researchId]!.refreshInstructions?.some((entry) => entry.includes("product-specific evidence scope")),
      "the reopened dependency must carry the consumer's compiled refresh scope",
    );
    const excludedRun = seedFor(["research"], plan).run;
    assert(
      refreshDependenciesBeforeFrontier(plan, excludedRun, now, new Set<RunNodeId>()).length === 0 && excludedRun.nodes[researchId]!.status === "succeeded",
      "an out-of-scope refresh consumer must not mutate its dependency",
    );

    const sharedCatalog = testCatalog();
    sharedCatalog.workflows[1]!.refreshDependencies = [
      { workflowId: "workflow.research-scan", instructions: "Refresh research for the product-specific evidence scope before drafting." },
    ];
    sharedCatalog.workflows[5]!.dependencies = ["workflow.research-scan"];
    sharedCatalog.workflows[5]!.refreshDependencies = [
      { workflowId: "workflow.research-scan", instructions: "Refresh research for the growth-specific evidence scope before publishing." },
    ];
    const sharedPlan = compilePlan(sharedCatalog, now);
    const { businessState: sharedState, run: sharedRun } = seedFor(["research"], sharedPlan);
    refreshDependenciesBeforeFrontier(sharedPlan, sharedRun, now);
    sharedRun.nodes[researchId]!.status = "succeeded";
    sharedRun.artifactBindings.find((binding) => binding.artifactId === "artifact.research-brief")!.accepted = true;
    const sharedReady = computeFrontier(sharedPlan, sharedRun, sharedState, allowAllAutonomyEvaluator).ready;
    assert(sharedReady.includes(productId), "the consumer owning the current scoped refresh may enter the frontier");
    assert(!sharedReady.includes(nodeId("growth-post")), "a second consumer must wait for its own scoped refresh cycle");
    sharedRun.nodes[productId]!.status = "succeeded";
    sharedRun.artifactBindings.find((binding) => binding.artifactId === "artifact.product-spec")!.accepted = true;
    assert(
      refreshDependenciesBeforeFrontier(sharedPlan, sharedRun, plusSeconds(now, 1)).includes(researchId),
      "the second consumer must receive its own serialized scoped refresh",
    );
    const siblingRefresh = beginAttempt(sharedPlan, sharedRun, researchId, "session-sibling-refresh", plusSeconds(now, 2));
    reconcilePatch(
      sharedPlan,
      sharedRun,
      {
        nodeId: researchId,
        attemptId: siblingRefresh.id,
        outputs: [{ artifactId: "artifact.research-brief", path: "research/brief.md", fingerprint: "sha256:growth-scope", evidence: ["growth scope"] }],
      },
      plusSeconds(now, 3),
    );
    assert(sharedRun.nodes[productId]!.status === "succeeded", "a later sibling refresh must preserve the first scoped consumer's completed result");
    assert(
      sharedRun.artifactBindings.find((binding) => binding.artifactId === "artifact.product-spec")!.accepted,
      "a later sibling refresh must preserve the first scoped consumer's accepted output",
    );

    const staleCatalog = testCatalog();
    staleCatalog.workflows[5]!.dependencies = ["workflow.product-spec"];
    staleCatalog.workflows[5]!.refreshDependencies = [
      { workflowId: "workflow.product-spec", instructions: "Refresh the product spec for the growth-specific evidence scope before publishing." },
    ];
    const stalePlan = compilePlan(staleCatalog, now);
    const { run: staleRun } = seedFor(["research", "product"], stalePlan);
    const growthId = nodeId("growth-post");
    refreshDependenciesBeforeFrontier(stalePlan, staleRun, now);
    assert((staleRun.nodes[growthId]!.dependencyRefreshCycles?.length ?? 0) === 1, "the scoped product refresh must record its consumer token");
    staleRun.nodes[productId]!.status = "succeeded";
    staleRun.artifactBindings.find((binding) => binding.artifactId === "artifact.product-spec")!.accepted = true;
    invalidateDescendants(stalePlan, staleRun, ["artifact.research-brief"], plusSeconds(now, 1));
    assert(
      (staleRun.nodes[growthId]!.dependencyRefreshCycles?.length ?? 0) === 0,
      "invalidating a refreshed dependency must clear every consumer token bound to its obsolete result",
    );
    staleRun.nodes[productId]!.status = "succeeded";
    staleRun.artifactBindings.find((binding) => binding.artifactId === "artifact.product-spec")!.accepted = true;
    assert(
      refreshDependenciesBeforeFrontier(stalePlan, staleRun, plusSeconds(now, 2)).includes(productId),
      "a generic dependency rerun must be followed by a fresh scoped cycle before consumer dispatch",
    );

    const exhaustedCatalog = testCatalog();
    exhaustedCatalog.workflows[1]!.refreshDependencies = [
      { workflowId: "workflow.research-scan", instructions: "Refresh exhausted research before drafting." },
    ];
    const exhaustedPlan = compilePlan(exhaustedCatalog, now);
    const { run: exhaustedRun } = seedFor(["research"], exhaustedPlan);
    const exhaustedDependency = exhaustedRun.nodes[researchId]!;
    const exhaustedNode = exhaustedPlan.nodes.find((node) => node.id === researchId)!;
    for (let index = 0; index < exhaustedNode.maxAttempts; index += 1) {
      const attempt = beginAttempt(exhaustedPlan, exhaustedRun, researchId, `session-exhaust-${index}`, plusSeconds(now, index));
      attempt.status = "succeeded";
      exhaustedDependency.status = "succeeded";
    }
    const exhaustedBinding = exhaustedRun.artifactBindings.find((binding) => binding.artifactId === "artifact.research-brief")!;
    assert(refreshDependenciesBeforeFrontier(exhaustedPlan, exhaustedRun, plusSeconds(now, 4)).length === 0, "an exhausted dependency cannot reopen");
    assert(exhaustedDependency.status === "succeeded" && exhaustedBinding.accepted, "failed refresh admission must preserve accepted dependency state");
    assert(exhaustedRun.nodes[productId]!.status === "blocked", "the consumer must park explicitly when its required refresh cannot run");

    const { run: exhaustedConsumerRun } = seedFor(["research"], exhaustedPlan);
    const exhaustedConsumer = exhaustedConsumerRun.nodes[productId]!;
    const consumerNode = exhaustedPlan.nodes.find((node) => node.id === productId)!;
    for (let index = 0; index < consumerNode.maxAttempts; index += 1) {
      const attempt = beginAttempt(exhaustedPlan, exhaustedConsumerRun, productId, `session-consumer-exhaust-${index}`, plusSeconds(now, index));
      attempt.status = "failed";
      exhaustedConsumer.status = "stale";
    }
    const preservedDependencyBinding = exhaustedConsumerRun.artifactBindings.find((binding) => binding.artifactId === "artifact.research-brief")!;
    assert(
      refreshDependenciesBeforeFrontier(exhaustedPlan, exhaustedConsumerRun, plusSeconds(now, 5)).length === 0,
      "an exhausted consumer cannot reopen a dependency",
    );
    assert(
      exhaustedConsumerRun.nodes[researchId]!.status === "succeeded" && preservedDependencyBinding.accepted,
      "consumer budget exhaustion must preserve the dependency's accepted proof",
    );
    assert(exhaustedConsumer.status === "blocked", "an exhausted refresh consumer must park explicitly");
  });

  harness.check("runstate: refreshed output fingerprints still invalidate already-succeeded descendants when content changes", () => {
    const catalog = testCatalog();
    catalog.workflows[5]!.dependencies = ["workflow.research-scan"];
    catalog.workflows[5]!.refreshDependencies = [
      { workflowId: "workflow.research-scan", instructions: "Refresh research for a growth-specific evidence scope before publishing." },
    ];
    const plan = compilePlan(catalog, now);
    const { run } = seedFor(["research", "product"], plan);
    const researchId = nodeId("research-scan");
    const productId = nodeId("product-spec");
    const binding = run.artifactBindings.find((candidate) => candidate.artifactId === "artifact.research-brief")!;
    const baseline = binding.fingerprint;
    refreshDependenciesBeforeFrontier(plan, run, now);
    assert(binding.refreshBaselineFingerprint === baseline && binding.fingerprint === baseline, "refresh must retain the accepted comparison baseline");
    const attempt = beginAttempt(plan, run, researchId, "session-refresh", plusSeconds(now, 1));
    reconcilePatch(
      plan,
      run,
      {
        nodeId: researchId,
        attemptId: attempt.id,
        outputs: [{ artifactId: "artifact.research-brief", path: "research/brief.md", fingerprint: "sha256:changed", evidence: ["changed refresh"] }],
      },
      plusSeconds(now, 2),
    );
    assert(run.nodes[productId]!.status === "stale", "a changed refreshed artifact must invalidate its succeeded descendant");
    assert(run.nodes[researchId]!.refreshInstructions === undefined, "refresh scope must clear when the scoped attempt finishes");
  });

  harness.check("compile/autonomy: internal system workflows preserve edges and run without founder grants, but external actions fail closed", () => {
    const catalog = testCatalog();
    catalog.workflows.push({
      id: "workflow.system-cascade",
      title: "System cascade",
      domainId: "domain.process",
      actionClass: "mutate",
      dependencies: ["workflow.research-scan"],
      outputPaths: [],
      providerIds: [],
      laneIds: [],
      founderOnlyActions: [],
      gateCommands: [],
      idempotent: true,
    });
    const plan = compilePlan(catalog, now);
    const system = plan.nodes.find((node) => node.workflowId === "workflow.system-cascade")!;
    assert(system.dependencies.includes(nodeId("research-scan")), "system workflow must preserve its authored dependency edge");
    const evaluator = createAutonomyEvaluator({
      grants: {},
      waivers: [],
      ledger: { schemaVersion: "1.0.0", updatedAt: now, balances: [], entries: [] },
      prerequisiteVerifier: () => ({ status: "unverified" as const, detail: "fixture" }),
      now: () => now,
    });
    assert(evaluator.evaluate(system).allowed, "safe internal system work must not require a founder grant");
    assert(
      evaluator.evaluate({ ...system, actionClass: "observe", providerIds: ["provider.test"] }).allowed,
      "read-only provider proof must be allowed as internal observation",
    );
    assert(!evaluator.evaluate({ ...system, actionClass: "publish", providerIds: ["provider.test"] }).allowed, "external system-domain work must fail closed");
    let machineRejected = false;
    try {
      compilePlan({ ...catalog, workflows: [{ ...catalog.workflows[0]!, id: "workflow.machine-maintenance", domainId: "domain.machine" }] }, now);
    } catch (error) {
      machineRejected = String(error).includes("maintainer-only");
    }
    assert(machineRejected, "domain.machine maintenance must stay out of business execution plans");
  });

  // ---------------------------------------------------------------------
  // frontier.ts
  // ---------------------------------------------------------------------

  function seedFor(lanesDone: LaneKey[], plan: CompiledPlan) {
    const overrides = Object.fromEntries(lanesDone.map((key) => [key, "succeeded" as Status])) as Partial<Record<LaneKey, Status>>;
    const businessState = baseBusinessState(overrides);
    const run = seedRunState(plan, businessState, { ownerSessionId: "session-1", ttlSeconds: 600, wallClockCapSeconds: 3600, now });
    return { businessState, run };
  }

  harness.check("frontier: day-one state surfaces only dependency-free roots", () => {
    const plan = compilePlan(testCatalog(), now);
    const { businessState, run } = seedFor([], plan);
    const result = computeFrontier(plan, run, businessState, allowAllAutonomyEvaluator);
    assert(result.ready.includes(nodeId("research-scan")), "research-scan (no deps) should be ready on day one");
    assert(result.ready.includes(nodeId("growth-post")), "growth-post (no deps) should be ready on day one");
    assert(!result.ready.includes(nodeId("product-spec")), "product-spec should not be ready before research-scan succeeds");
    assert(!result.ready.includes(nodeId("engineering-build")), "engineering-build should not be ready before product-spec succeeds");
  });

  harness.check("applicability: unknown, required, and not-needed conditional verdicts are explicit", () => {
    const conditional: CatalogWorkflowNode = {
      ...testWorkflows().find((item) => item.id === "workflow.growth-post")!,
      applicability: { mode: "conditional", question: "Does this app generate content?" },
    };
    const plan = compilePlan(
      { version: "catalog.applicability", artifacts: testArtifacts().filter((item) => item.path === "growth/post.md"), workflows: [conditional] },
      now,
    );
    const unknownState = baseBusinessState();
    const unknownRun = seedRunState(plan, unknownState, { ownerSessionId: "scope", ttlSeconds: 60, wallClockCapSeconds: 60, now });
    assert(getStatus(unknownRun, nodeId("growth-post")) === "waiting_founder", "unknown conditional scope did not wait for founder");
    assert(unknownRun.nodes[nodeId("growth-post")]!.blocker?.includes("Scope answer needed"), "unknown scope did not name the question");

    const requiredState = baseBusinessState();
    requiredState.workflowApplicability = {
      "workflow.growth-post": { verdict: "required", reason: "The accepted spec includes generation.", evidence: ["product/spec.md"], updatedAt: now },
    };
    const requiredRun = seedRunState(plan, requiredState, { ownerSessionId: "scope", ttlSeconds: 60, wallClockCapSeconds: 60, now });
    assert(
      computeFrontier(plan, requiredRun, requiredState, allowAllAutonomyEvaluator).ready.includes(nodeId("growth-post")),
      "required conditional scope did not reach ready",
    );

    const notNeededState = baseBusinessState();
    notNeededState.workflowApplicability = {
      "workflow.growth-post": { verdict: "not-needed", reason: "The accepted spec has no generated content.", evidence: ["product/spec.md"], updatedAt: now },
    };
    const notNeededRun = seedRunState(plan, notNeededState, { ownerSessionId: "scope", ttlSeconds: 60, wallClockCapSeconds: 60, now });
    assert(getStatus(notNeededRun, nodeId("growth-post")) === "not_needed", "not-needed conditional scope did not retire the workflow");
  });

  harness.check(
    "profiles: a business's launch profile parks whole-lane breadth work, the founder verdict overrides, and a profile switch reopens with invalidated proof",
    () => {
      // growth-post carries laneIds ["growth"]; the profile defers that lane. research-scan carries
      // ["research"], untouched. The plan compiles the deferral as fact (deferredByProfiles), so an
      // old catalog pin without profiles keeps behaving exactly as before — that absence is the
      // control at the end.
      const catalogWithProfiles = {
        ...testCatalog(),
        version: "catalog.profiles",
        profiles: [
          { id: "essentials", defersLaneKeys: ["growth" as LaneKey] },
          { id: "full", defersLaneKeys: [] },
        ],
      };
      const plan = compilePlan(catalogWithProfiles, now);
      const growthNode = plan.nodes.find((node) => node.workflowId === "workflow.growth-post")!;
      assert(
        growthNode.deferredByProfiles.includes("essentials") && !growthNode.deferredByProfiles.includes("full"),
        "compile must record which profiles defer the node",
      );

      const essentialsState = baseBusinessState();
      const run = seedRunState(plan, essentialsState, { ownerSessionId: "profile", ttlSeconds: 60, wallClockCapSeconds: 60, now });
      assert(getStatus(run, nodeId("growth-post")) === "not_needed", "an essentials business must park whole-lane breadth work as not needed");
      assert(run.nodes[nodeId("growth-post")]!.blocker?.includes("Deferred by the essentials profile"), "the parking reason must name the profile");
      assert(getStatus(run, nodeId("research-scan")) !== "not_needed", "a lane the profile keeps must not park");

      // The founder's recorded verdict outranks the profile.
      const overriddenState = baseBusinessState();
      overriddenState.workflowApplicability = {
        "workflow.growth-post": { verdict: "required", reason: "This launch bets on the growth loop.", evidence: ["product/spec.md"], updatedAt: now },
      };
      const overriddenRun = seedRunState(plan, overriddenState, { ownerSessionId: "profile", ttlSeconds: 60, wallClockCapSeconds: 60, now });
      assert(getStatus(overriddenRun, nodeId("growth-post")) !== "not_needed", "a recorded required verdict must beat the profile deferral");

      // Widening the profile mid-journey reopens the parked node and invalidates any old proof.
      const binding = run.artifactBindings.find((item) => growthNode.outputs.some((artifactId) => artifactId === item.artifactId))!;
      binding.accepted = true;
      binding.fingerprint = "old-proof";
      essentialsState.project.launchScope = "full";
      reconcileWorkflowApplicability(plan, run, essentialsState, plusSeconds(now, 60));
      assert(getStatus(run, nodeId("growth-post")) === "pending", "switching to the full profile must reopen the deferred node");
      assert(!binding.accepted && binding.fingerprint === undefined, "the profile switch must invalidate the parked node's old proof");

      // A workflow serving any non-deferred lane never parks: multi-lane membership is an AND.
      const partial = compilePlan(
        {
          ...catalogWithProfiles,
          version: "catalog.profiles-partial",
          workflows: testWorkflows().map((item) => (item.id === "workflow.growth-post" ? { ...item, laneIds: ["growth", "revenue"] as LaneKey[] } : item)),
        },
        now,
      );
      assert(
        partial.nodes.find((node) => node.workflowId === "workflow.growth-post")!.deferredByProfiles.length === 0,
        "a node with any kept lane must not be profile-deferred",
      );

      // Control: a catalog pinned before profiles existed defers nothing.
      const legacyPlan = compilePlan(testCatalog(), now);
      const legacyRun = seedRunState(legacyPlan, baseBusinessState(), { ownerSessionId: "profile", ttlSeconds: 60, wallClockCapSeconds: 60, now });
      assert(getStatus(legacyRun, nodeId("growth-post")) !== "not_needed", "a profile-less catalog pin must behave exactly as before profiles existed");
    },
  );

  harness.check("applicability: a changed verdict reopens work and invalidates accepted output", () => {
    const conditional: CatalogWorkflowNode = {
      ...testWorkflows().find((item) => item.id === "workflow.growth-post")!,
      applicability: { mode: "conditional", question: "Is growth publishing needed?" },
    };
    const plan = compilePlan(
      { version: "catalog.applicability-change", artifacts: testArtifacts().filter((item) => item.path === "growth/post.md"), workflows: [conditional] },
      now,
    );
    const state = baseBusinessState();
    state.workflowApplicability = {
      "workflow.growth-post": { verdict: "not-needed", reason: "Initial scope.", evidence: ["product/spec.md"], updatedAt: now },
    };
    const run = seedRunState(plan, state, { ownerSessionId: "scope", ttlSeconds: 60, wallClockCapSeconds: 60, now });
    const binding = run.artifactBindings[0]!;
    binding.accepted = true;
    binding.fingerprint = "old-proof";
    run.nodes[nodeId("growth-post")]!.acceptedOutputFingerprint = "old-proof";
    state.workflowApplicability["workflow.growth-post"] = {
      verdict: "required",
      reason: "The product scope changed.",
      evidence: ["product/spec.md#change"],
      updatedAt: plusSeconds(now, 60),
    };
    reconcileWorkflowApplicability(plan, run, state, plusSeconds(now, 60));
    assert(getStatus(run, nodeId("growth-post")) === "pending", "required verdict did not reopen the workflow");
    assert(!run.artifactBindings[0]!.accepted && run.artifactBindings[0]!.fingerprint === undefined, "changed verdict did not invalidate old output proof");

    run.nodes[nodeId("growth-post")]!.status = "succeeded";
    run.artifactBindings[0]!.accepted = true;
    run.artifactBindings[0]!.fingerprint = "new-proof";
    state.workflowApplicability["workflow.growth-post"] = {
      verdict: "required",
      reason: "The explanation was corrected without changing scope.",
      evidence: ["product/spec.md#corrected"],
      updatedAt: plusSeconds(now, 120),
    };
    reconcileWorkflowApplicability(plan, run, state, plusSeconds(now, 120));
    assert(getStatus(run, nodeId("growth-post")) === "succeeded", "a reason-only edit reopened completed work");
    assert(run.artifactBindings[0]!.accepted, "a reason-only edit invalidated accepted proof");
  });

  harness.check("boundary matrix: non-ready work keeps compact graph metadata and declarations stay planned without proof", () => {
    const researchShape = testWorkflows().find((item) => item.id === "workflow.research-scan")!;
    const matrixWorkflow: CatalogWorkflowNode = {
      ...testWorkflows().find((item) => item.id === "workflow.growth-post")!,
      groupId: "revenue-growth",
      phaseIds: ["phase.4"],
      applicability: { mode: "always" },
      references: [
        // One sourced reference already past its review-due date, one never due (internal).
        {
          id: "reference.growth.sourced",
          path: "knowledge/growth/sourced.md",
          title: "Sourced Growth",
          loadWhen: "before spend",
          freshness: "reviewed 2026-01-01",
          reviewDueBy: "2026-04-01",
        },
        { id: "reference.growth.internal", path: "knowledge/growth/internal.md", title: "Internal Growth", loadWhen: "always", freshness: "internal" },
      ],
      role: {
        ...researchShape.role!,
        contextPacks: [
          {
            id: "context.growth",
            title: "Growth",
            references: [
              // Duplicates a mandatory reference by path — must not appear twice.
              {
                id: "reference.growth.sourced",
                path: "knowledge/growth/sourced.md",
                title: "Sourced Growth",
                loadWhen: "before spend",
                freshness: "reviewed 2026-01-01",
                reviewDueBy: "2026-04-01",
              },
              {
                id: "reference.growth.conditional",
                path: "knowledge/growth/conditional.md",
                title: "Conditional Growth",
                loadWhen: "a creator deal is in play",
                freshness: "internal",
              },
            ],
          },
        ],
      },
    };
    const integrityWorkflow: CatalogWorkflowNode = {
      ...testWorkflows().find((item) => item.id === "workflow.product-spec")!,
      id: "workflow.process.fixture-proof",
      title: "Provider-proof verification (fixture)",
      domainId: "domain.process",
      dependencies: [],
      gateCommands: [],
      outputPaths: ["research/brief.md"],
      laneIds: ["research"],
    };
    const plan = compilePlan(
      {
        version: "catalog.matrix",
        artifacts: testArtifacts().filter((item) => ["growth/post.md", "research/brief.md"].includes(item.path)),
        workflows: [matrixWorkflow, integrityWorkflow],
      },
      now,
    );
    const state = baseBusinessState();
    const run = seedRunState(plan, state, { ownerSessionId: "matrix", ttlSeconds: 60, wallClockCapSeconds: 60, now });
    const projection = buildLaunchMatrix(
      plan,
      run,
      [
        { workflowId: matrixWorkflow.id, title: matrixWorkflow.title, status: "upcoming" },
        { workflowId: integrityWorkflow.id, title: integrityWorkflow.title, status: "ready" },
      ],
      state,
      {},
      now,
    );
    assert(projection.workflows.length === 1, "matrix omitted non-ready work or leaked a system node into the founder rows");
    const item = projection.workflows[0]!;
    assert(item.groupId === "revenue-growth" && item.phaseIds.includes("phase.4"), "matrix lost presentation or phase metadata");
    assert(item.services[0]?.state === "planned", "a catalog provider declaration was overclaimed as connected");
    // The node's role declares exactly one tool route; the matrix carries it and nothing more.
    assert(item.agentTools.length === 1 && item.agentTools[0]!.id === "fixture-product-tool", "matrix dropped or invented role tools");
    assert(!JSON.stringify(item.services).match(/token|secret|password/iu), "service projection leaked credential-shaped fields");
    // Knowledge crosses with its document path and a read-time review verdict, never dates alone.
    const sourced = item.knowledge.find((guide) => guide.id === "reference.growth.sourced");
    assert(sourced?.path === "knowledge/growth/sourced.md", "knowledge lost its document path at the boundary");
    assert(sourced?.reviewStatus === "review-due", "an overdue source review was not reported as review-due");
    assert(
      item.knowledge.find((guide) => guide.id === "reference.growth.internal")?.reviewStatus === "internal",
      "a source-less reference must report internal",
    );
    // Role context packs cross as conditional knowledge, deduplicated against the mandatory list.
    assert(item.conditionalKnowledge.length === 1, "conditional knowledge missed the pack reference or kept a duplicate");
    assert(
      item.conditionalKnowledge[0]!.id === "reference.growth.conditional" && item.conditionalKnowledge[0]!.packId === "context.growth",
      "conditional knowledge lost its pack provenance",
    );
    // System-domain work crosses as named launch-integrity steps, not only a count.
    assert(projection.launchIntegrity.length === 1, "process/orchestration work did not surface as launch integrity");
    assert(
      projection.launchIntegrity[0]!.workflowId === "workflow.process.fixture-proof" && projection.launchIntegrity[0]!.status === "ready",
      "launch integrity lost workflow identity or live status",
    );
    assert(projection.systemSummary.total === 1, "system summary count drifted from the integrity list");
  });

  harness.check("frontier: mid-launch seeding excludes completed work but still surfaces next work", () => {
    const plan = compilePlan(testCatalog(), now);
    const { businessState, run } = seedFor(["research", "product"], plan);
    assert(run.nodes[nodeId("research-scan")]!.status === "succeeded", "research-scan should be pre-seeded succeeded");
    assert(run.nodes[nodeId("product-spec")]!.status === "succeeded", "product-spec should be pre-seeded succeeded");

    const result = computeFrontier(plan, run, businessState, allowAllAutonomyEvaluator);
    assert(!result.ready.includes(nodeId("research-scan")), "already-succeeded research-scan must not re-appear on the frontier");
    assert(!result.ready.includes(nodeId("product-spec")), "already-succeeded product-spec must not re-appear on the frontier");
    assert(result.ready.includes(nodeId("engineering-build")), "engineering-build should now be reachable");
    assert(result.ready.includes(nodeId("engineering-build-sub")), "engineering-build-sub should now be reachable");
  });

  harness.check("frontier: blocked lane predicate parks its workflow with a recorded blocker", () => {
    const plan = compilePlan(testCatalog(), now);
    const { businessState, run } = seedFor(["research", "product"], plan);
    businessState.lanes.engineering!.status = "blocked";
    const result = computeFrontier(plan, run, businessState, allowAllAutonomyEvaluator);
    assert(!result.ready.includes(nodeId("engineering-build")), "engineering-build must not be ready while its lane is blocked");
    assert(run.nodes[nodeId("engineering-build")]!.status === "blocked", "engineering-build should land status blocked");
    assert((run.nodes[nodeId("engineering-build")]!.blocker ?? "").includes("predicate"), "blocker should name the failed predicate");
  });

  harness.check("frontier: approval / evaluator gate sequence on one node", () => {
    const plan = compilePlan(testCatalog(), now);
    const { businessState, run } = seedFor(["research", "product", "engineering"], plan);
    const revenueId = nodeId("revenue-report");
    assert(getStatus(run, revenueId) === "pending", "revenue-report should still be pending after seeding");

    // 1. no autonomy decision needed yet to observe the approval gate; approval defaults to pending.
    let result = computeFrontier(plan, run, businessState, allowAllAutonomyEvaluator);
    assert(!result.ready.includes(revenueId), "revenue-report needs a founder approval before it can be ready");
    assert(getStatus(run, revenueId) === "waiting_founder", `expected waiting_founder, got ${getStatus(run, revenueId)}`);

    // 2. rejected approval -> blocked (a reducer would reset to pending on a new decision; simulate that).
    setStatus(run, revenueId, "pending");
    run.approvals["workflow.revenue-report.approval.1"] = "rejected";
    result = computeFrontier(plan, run, businessState, allowAllAutonomyEvaluator);
    assert(getStatus(run, revenueId) === "blocked", `expected blocked after rejection, got ${getStatus(run, revenueId)}`);
    assert(!result.ready.includes(revenueId), "a rejected approval must never surface on the frontier");

    // 3. approved + evaluator allows -> ready.
    setStatus(run, revenueId, "pending");
    run.approvals["workflow.revenue-report.approval.1"] = "approved";
    result = computeFrontier(plan, run, businessState, allowAllAutonomyEvaluator);
    assert(result.ready.includes(revenueId), "revenue-report should be ready once approved and autonomy allows it");

    // 4. evaluator parks it even though approved (KTD5: grants/waivers/budget gate before approval matters).
    setStatus(run, revenueId, "pending");
    const rejectingEvaluator: AutonomyEvaluator = { evaluate: () => ({ allowed: false, parkReason: "grant level insufficient for domain.money spend" }) };
    result = computeFrontier(plan, run, businessState, rejectingEvaluator);
    assert(!result.ready.includes(revenueId), "evaluator rejection must exclude the node from the frontier");
    assert(getStatus(run, revenueId) === "blocked", "evaluator rejection should land the node blocked");
    assert(
      (run.nodes[revenueId]!.blocker ?? "").includes("grant level insufficient"),
      `blocker should carry the evaluator's parkReason, got: ${run.nodes[revenueId]!.blocker}`,
    );
    assert(
      result.parked.some((entry) => entry.nodeId === revenueId && entry.reason.includes("grant level insufficient")),
      "parked list should record the reason",
    );

    // 5. evaluator throws -> fail closed, never crash the frontier computation.
    setStatus(run, revenueId, "pending");
    const throwingEvaluator: AutonomyEvaluator = {
      evaluate: () => {
        throw new Error("doppler probe failed");
      },
    };
    result = computeFrontier(plan, run, businessState, throwingEvaluator);
    assert(!result.ready.includes(revenueId), "a throwing evaluator must fail closed, not crash open");
    assert(getStatus(run, revenueId) === "blocked", "a throwing evaluator should still land the node blocked");
    assert((run.nodes[revenueId]!.blocker ?? "").includes("doppler probe failed"), "blocker should carry the underlying evaluator error");
  });

  // ---------------------------------------------------------------------
  // dispatch.ts
  // ---------------------------------------------------------------------

  harness.check("dispatch: prefix-overlapping resource claims (resource.path.foo / resource.path.foo.bar) serialize", () => {
    const plan = compilePlan(testCatalog(), now);
    const frontier = [nodeId("engineering-build"), nodeId("engineering-build-sub")];
    const batches = buildDispatchBatches(plan, frontier, 5);
    assert(batches.length === 2, `expected the two conflicting nodes to serialize into 2 batches, got ${batches.length}`);
    assert(batches[0]!.nodeIds.length === 1 && batches[1]!.nodeIds.length === 1, "each batch should contain exactly one of the conflicting nodes");
  });

  harness.check("dispatch: independent nodes batch together up to maxConcurrency", () => {
    const plan = compilePlan(testCatalog(), now);
    const frontier = [nodeId("research-scan"), nodeId("growth-post")];
    const batches = buildDispatchBatches(plan, frontier, 5);
    assert(batches.length === 1, `expected one batch for two non-conflicting nodes, got ${batches.length}`);
    assert(batches[0]!.nodeIds.length === 2, "both independent nodes should share one batch");
  });

  harness.check("dispatch: maxConcurrency bounds batch size even without resource conflicts", () => {
    const plan = compilePlan(testCatalog(), now);
    const frontier = [nodeId("research-scan"), nodeId("growth-post")];
    const batches = buildDispatchBatches(plan, frontier, 1);
    assert(batches.length === 2, `expected concurrency-1 to force 2 batches, got ${batches.length}`);
  });

  harness.check("dispatch: unknown node id in the frontier fails closed", () => {
    const plan = compilePlan(testCatalog(), now);
    let threw = false;
    try {
      buildDispatchBatches(plan, ["run.not-a-real-node" as RunNodeId], 5);
    } catch {
      threw = true;
    }
    assert(threw, "buildDispatchBatches should throw rather than silently drop an unknown frontier entry");
  });

  harness.check("dispatch: batch-boundary hooks halt on kill switch before cooperative yield", () => {
    const killed = checkBatchBoundary({ checkKillSwitch: () => true, checkCooperativeYield: () => true });
    assert(killed.halt && killed.reason === "kill_switch", "kill switch must take priority and halt");

    const yielded = checkBatchBoundary({ checkKillSwitch: () => false, checkCooperativeYield: () => true });
    assert(yielded.halt && yielded.reason === "cooperative_yield", "cooperative yield should halt when the kill switch is clear");

    const clear = checkBatchBoundary(neverHaltDispatchHooks);
    assert(!clear.halt, "no halt when neither hook fires");
  });

  // ---------------------------------------------------------------------
  // runstate.ts: attempts, heartbeats, orphan detection (interrupted-run resume)
  // ---------------------------------------------------------------------

  harness.check("runstate: beginAttempt records owner session, heartbeat, and TTL", () => {
    const plan = compilePlan(testCatalog(), now);
    const { run } = seedFor([], plan);
    const attempt = beginAttempt(plan, run, nodeId("research-scan"), "session-abc", now);
    assert(attempt.ownerSessionId === "session-abc", "attempt should carry the owning session id");
    assert(attempt.heartbeatAt === now, "attempt heartbeat should be set at begin time");
    assert(attempt.ttlSeconds > 0, "attempt should carry a positive heartbeat TTL");
    assert(run.nodes[nodeId("research-scan")]!.status === "running", "node should transition to running");
    assertSchemaValid(harness.checkSchema(RUN_STATE_SCHEMA, run), "run state after beginAttempt");
  });

  harness.check("runstate: beginAttempt refuses to exceed the node's max attempts", () => {
    const plan = compilePlan(testCatalog(), now);
    const { run } = seedFor([], plan);
    const node = plan.nodes.find((candidate) => candidate.id === nodeId("research-scan"))!;
    for (let i = 0; i < node.maxAttempts; i += 1) {
      beginAttempt(plan, run, nodeId("research-scan"), "session-abc", now);
      run.nodes[nodeId("research-scan")]!.attempts.at(-1)!.status = "failed";
      run.nodes[nodeId("research-scan")]!.status = "pending";
    }
    let threw = false;
    try {
      beginAttempt(plan, run, nodeId("research-scan"), "session-abc", now);
    } catch {
      threw = true;
    }
    assert(threw, "beginAttempt should refuse a 4th attempt when maxAttempts is 3");
  });

  harness.check("runstate: refreshHeartbeat updates the running attempt and the run-level heartbeat", () => {
    const plan = compilePlan(testCatalog(), now);
    const { run } = seedFor([], plan);
    beginAttempt(plan, run, nodeId("research-scan"), "session-abc", now);
    const later = plusSeconds(now, 30);
    refreshHeartbeat(run, nodeId("research-scan"), later);
    assert(run.nodes[nodeId("research-scan")]!.attempts.at(-1)!.heartbeatAt === later, "attempt heartbeat should refresh");
    assert(run.heartbeatAt === later, "run-level heartbeat should refresh alongside the attempt");
  });

  harness.check("runstate: interrupted run resumes — idempotent node re-dispatches, non-idempotent lands needs_readback, never auto-retries", () => {
    const plan = compilePlan(testCatalog(), now);
    const { businessState, run } = seedFor(["research", "product", "engineering"], plan);

    // Simulate a crash: both attempts begin, then the session dies before any heartbeat refresh
    // or reconciliation. "Resume" is a fresh detectOrphans pass well past each attempt's TTL.
    const idempotentId = nodeId("engineering-build"); // idempotent: true
    const nonIdempotentId = nodeId("revenue-report"); // idempotent: false
    beginAttempt(plan, run, idempotentId, "session-crashed", now);
    beginAttempt(plan, run, nonIdempotentId, "session-crashed", now);

    const idempotentTtl = plan.nodes.find((n) => n.id === idempotentId)!.ttlSeconds;
    const resumedAt = plusSeconds(now, idempotentTtl + 60);
    const events = detectOrphans(plan, run, resumedAt);

    assert(
      events.some((event) => event.nodeId === idempotentId && event.resolution === "ready"),
      "idempotent node should resolve to ready",
    );
    assert(
      events.some((event) => event.nodeId === nonIdempotentId && event.resolution === "needs_readback"),
      "non-idempotent node should resolve to needs_readback",
    );
    assert(run.nodes[idempotentId]!.status === "ready", "idempotent node status should be ready after orphan resolution");
    assert(run.nodes[nonIdempotentId]!.status === "needs_readback", "non-idempotent node status should be needs_readback");
    assert(run.nodes[nonIdempotentId]!.attempts.at(-1)!.readbackRequired === true, "the orphaned non-idempotent attempt should require readback");

    // needs_readback is never auto-retried: it must not reappear on a subsequent frontier pass.
    const result = computeFrontier(plan, run, businessState, allowAllAutonomyEvaluator);
    assert(!result.ready.includes(nonIdempotentId), "needs_readback must never silently re-enter the frontier");
    assert(!result.parked.some((entry) => entry.nodeId === nonIdempotentId), "needs_readback is not a parked-by-autonomy state either");
  });

  harness.check("runstate: a fresh heartbeat is not orphaned", () => {
    const plan = compilePlan(testCatalog(), now);
    const { run } = seedFor([], plan);
    beginAttempt(plan, run, nodeId("research-scan"), "session-live", now);
    const events = detectOrphans(plan, run, plusSeconds(now, 5));
    assert(events.length === 0, "a heartbeat well inside its TTL must not be treated as orphaned");
    assert(run.nodes[nodeId("research-scan")]!.status === "running", "node should remain running");
  });

  // ---------------------------------------------------------------------
  // runstate.ts: reconcile (fail-closed join) and verification acceptance
  // ---------------------------------------------------------------------

  harness.check("runstate: reconcilePatch omitting a declared output fails the join closed", () => {
    const plan = compilePlan(testCatalog(), now);
    const { run } = seedFor([], plan);
    const attempt = beginAttempt(plan, run, nodeId("research-scan"), "session-x", now);
    let threw = false;
    try {
      reconcilePatch(plan, run, { nodeId: nodeId("research-scan"), attemptId: attempt.id, outputs: [] }, now);
    } catch (error) {
      threw = true;
      assert(String(error).includes("Silent node failure"), `expected a silent-failure join error, got: ${error}`);
    }
    assert(threw, "reconcilePatch must reject a patch that omits a declared output");
  });

  harness.check(
    "compile: verification policy derivation — gates are deterministic, gateless outputs are fail-closed fresh-context, kind none survives only for no-output nodes",
    () => {
      const plan = compilePlan(testCatalog(), now);
      const byId = new Map(plan.nodes.map((node) => [node.id, node]));
      const gated = byId.get(nodeId("product-spec"))!;
      assert(gated.verification.kind === "deterministic", "a node with gateCommands must verify deterministically");
      const gateless = byId.get(nodeId("engineering-build"))!;
      assert(gateless.verification.kind === "fresh_context", "a gateless node WITH outputs must require fresh-context verification, never auto-accept");
      assert(gateless.verification.failClosed === true, "gateless-output verification must fail closed");
      // "none" is reachable only for a NON-JUDGMENT node with neither outputs nor gates — a shape
      // catalog/validate.ts rejects in real catalogs (contract_empty), kept here to pin the enum.
      // (research-scan would not do: domain.research is a judgment domain, fresh_context regardless.)
      const catalog = testCatalog();
      const engineeringBuild = catalog.workflows.find((workflowNode) => workflowNode.id === "workflow.engineering-build")!;
      engineeringBuild.outputPaths = [];
      const bare = compilePlan(catalog, now).nodes.find((node) => node.id === nodeId("engineering-build"))!;
      assert(bare.verification.kind === "none", "a node with no outputs and no gates is the only remaining kind:none shape");
    },
  );

  harness.check(
    "compile+frontier: authored reads gate readiness — read artifacts join inputs (own outputs and consults never do) and the frontier holds until they are accepted (Codex round 3)",
    () => {
      const catalog = testCatalog();
      const engineeringBuild = catalog.workflows.find((workflowNode) => workflowNode.id === "workflow.engineering-build")!;
      engineeringBuild.dependencies = []; // deliberately no edge to the producer — the read alone must hold readiness
      engineeringBuild.reads = ["research/brief.md", "foo"];
      engineeringBuild.consults = ["growth/post.md"];
      const plan = compilePlan(catalog, now);
      const node = plan.nodes.find((candidate) => candidate.id === nodeId("engineering-build"))!;
      assert(node.inputs.includes("artifact.research-brief"), "a read naming another workflow's artifact must join the node's inputs");
      assert(!node.inputs.includes("artifact.engineering-build"), "a node's own output is the read-modify-write pattern, never an input");
      assert(!node.inputs.includes("artifact.growth-post"), "a consult is open-if-present and must never gate");

      const dayOne = seedFor([], plan);
      const early = computeFrontier(plan, dayOne.run, dayOne.businessState, allowAllAutonomyEvaluator);
      assert(
        !early.ready.includes(nodeId("engineering-build")),
        "the node must not be ready while its read artifact is unproduced, even with no dependency edge",
      );
      const afterResearch = seedFor(["research"], plan);
      const later = computeFrontier(plan, afterResearch.run, afterResearch.businessState, allowAllAutonomyEvaluator);
      assert(later.ready.includes(nodeId("engineering-build")), "the node becomes ready once the read artifact is produced and accepted");
    },
  );

  harness.check(
    "node-brief: composeNodeBrief carries the full authored contract, and an unauthored node degrades to an explicit marker — never a silent title-only brief",
    () => {
      const plan = compilePlan(testCatalog(), now);
      const byId = new Map(plan.nodes.map((node) => [node.id, node]));
      const authored = composeNodeBrief(byId.get(nodeId("research-scan"))!, plan);
      assert(authored.instructions === "Scan the category and write the brief.", "instructions must pass through verbatim");
      assert(authored.open.includes("state/PROJECT_STATE.yaml"), "authored reads must surface as files to open");
      assert(
        authored.load.some((entry) => entry.path === "knowledge/research/fixture.md" && entry.loadWhen === "fixture moment"),
        "bound references must surface as knowledge to load with their load conditions",
      );
      assert(authored.role?.id === "role.product-leader", "the owning role must ride the brief");
      assert(
        authored.contractFiles.join(",") === "AGENTS.md,APP_AGENTS.md,agents/product-leader.md",
        "parent and specialist contracts must be ordered in the brief",
      );
      assert(
        authored.route.some((entry) => entry.path === "knowledge/research/role.md"),
        "role context packs must resolve to conditional knowledge routes",
      );
      assert(
        authored.skills.some((entry) => entry.id === "fixture-product-skill"),
        "nested skill routes must ride the brief",
      );
      assert(
        authored.tools.some((entry) => entry.id === "fixture-product-tool"),
        "tool discovery routes must ride the brief",
      );
      assert(authored.produce.includes("research/brief.md"), "declared outputs must resolve to workspace paths");
      assert(authored.verify.kind === "fresh_context" && authored.verify.failClosed === true, "the brief must state the verification contract");
      const unauthored = composeNodeBrief(byId.get(nodeId("engineering-build"))!, plan);
      assert(unauthored.instructions.includes("not authored"), "a node without instructions must say so explicitly in the brief");
      const rendered = renderNodeBrief(authored);
      assert(
        rendered.includes("Do: Scan the category") && rendered.includes("Load: knowledge/research/fixture.md"),
        "the markdown rendering must carry the contract lines",
      );
    },
  );

  harness.check("worker-prompt: a fresh worker receives the complete nesting contract and cannot pass without an exact knowledge receipt", () => {
    const plan = compilePlan(testCatalog(), now);
    const node = plan.nodes.find((entry) => entry.id === nodeId("research-scan"))!;
    const brief = composeNodeBrief(node, plan);
    const fileDigests = Object.fromEntries(
      [...brief.contractFiles, ...brief.open, ...brief.load.map((entry) => entry.path), ...brief.route.map((entry) => entry.path)].map((entry, index) => [
        entry,
        `sha256:${String(index + 1).padStart(64, "a")}`,
      ]),
    );
    const expectations = { fileDigests };
    const prompt = buildWorkerPrompt(brief, "/tmp/business", "/tmp/skill", expectations);
    assert(prompt.includes("standard SHA-256 of the file bytes only"), "the worker must receive the exact reproducible receipt digest algorithm");
    const digestFixture = path.join(harness.makeTempDir("receipt-digest"), "known.txt");
    writeFileSync(digestFixture, "abc", "utf8");
    assert(
      receiptFileDigest(digestFixture) === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      "receipt digest must equal standard SHA-256 file bytes",
    );
    assert(prompt.includes("AGENTS.md") && prompt.includes("agents/product-leader.md"), "worker prompt must carry parent and specialist contracts");
    assert(
      prompt.includes("knowledge/research/fixture.md") && prompt.includes("knowledge/research/role.md"),
      "worker prompt must carry mandatory and conditional knowledge",
    );
    assert(
      prompt.includes("fixture-product-skill") && prompt.includes("fixture-product-tool"),
      "worker prompt must carry nested skill and tool discovery routes",
    );
    assert(
      prompt.includes(`TOKEN BUDGET: ${brief.tokenBudget}`) && prompt.includes("AUTHORIZATION DIGEST: none"),
      "worker prompt must pin budget and authority",
    );
    const command = buildWorkerCommand("codex", prompt);
    assert(command.args.includes(prompt), "the runtime command must receive the composed worker prompt, not a title-only surrogate");
    assert(validateKnowledgeReceipt("finished", brief).length > 0, "a conclusion without a knowledge receipt must fail");
    const receiptBody = {
      schemaVersion: "2.0.0",
      workflowId: brief.workflowId,
      tokenBudget: brief.tokenBudget,
      authorizationDigest: "none",
      contractFiles: brief.contractFiles.map((entry) => ({ path: entry, sha256: fileDigests[entry] })),
      taskArtifacts: brief.open.map((entry) => ({ path: entry, sha256: fileDigests[entry] })),
      mandatoryKnowledge: brief.load.map((entry) => ({ path: entry.path, sha256: fileDigests[entry.path] })),
      conditionalKnowledge: brief.route.map((entry) => ({
        id: `${entry.packId}:${entry.path}`,
        decision: "used",
        reason: "competitor evidence is required",
        sha256: fileDigests[entry.path],
      })),
      skills: brief.skills.map((entry) => ({
        id: entry.id,
        decision: "used",
        reason: "fixture condition matched",
        evidence: "/skills/fixture-product-skill/SKILL.md",
      })),
      tools: brief.tools.map((entry) => ({ id: entry.id, decision: "used", reason: "fixture condition matched", evidence: "fixture-product-tool --help" })),
      outputEvidence: brief.produce.map((entry) => ({
        outputPath: entry,
        knowledgePaths: [brief.load[0]!.path],
        summary: "Research rules shaped the evidence and conclusions.",
      })),
    };
    const receipt = `BEGIN_KNOWLEDGE_RECEIPT\n${JSON.stringify(receiptBody)}\nEND_KNOWLEDGE_RECEIPT`;
    assert(validateKnowledgeReceipt(receipt, brief, expectations).length === 0, "an exact structured knowledge receipt must pass");
    assert(
      validateKnowledgeReceipt(`noise ${brief.contractFiles.join(" ")} ${brief.load.map((entry) => entry.path).join(" ")}`, brief, expectations).length > 0,
      "path echoing outside structured JSON must fail",
    );
    const spoofed = { ...receiptBody, conditionalKnowledge: [] };
    assert(
      validateKnowledgeReceipt(`BEGIN_KNOWLEDGE_RECEIPT\n${JSON.stringify(spoofed)}\nEND_KNOWLEDGE_RECEIPT`, brief, expectations).length > 0,
      "omitting a conditional route decision must fail",
    );
  });

  harness.check("source fingerprint: content changes invalidate graph descendants while identical snapshots do not", () => {
    const dir = harness.makeTempDir("source-fingerprint");
    const sourceDir = path.join(dir, "src");
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(path.join(sourceDir, "app.ts"), "export const version = 1;\n");
    const catalog: CatalogInput = {
      version: "catalog.source.1",
      artifacts: [
        { id: "artifact.source", path: "run/app-source.json" },
        { id: "artifact.surface", path: "growth/landing.md" },
      ],
      workflows: [
        {
          id: "workflow.surface",
          title: "Refresh surface",
          domainId: "domain.growth",
          actionClass: "mutate",
          reads: ["run/app-source.json"],
          dependencies: [],
          outputPaths: ["growth/landing.md"],
          providerIds: [],
          laneIds: ["growth"],
          founderOnlyActions: [],
          gateCommands: [],
          idempotent: true,
        },
      ],
    };
    const plan = compilePlan(catalog, now);
    const run = seedRunState(plan, baseBusinessState(), { ownerSessionId: "session.source", ttlSeconds: 60, wallClockCapSeconds: 60, now });
    const first = fingerprintAppSource(dir, ["src"]);
    assert(ingestSourceFingerprint(plan, run, "artifact.source", first, now) === "baseline", "first source observation must establish a baseline");
    run.nodes[nodeId("surface")]!.status = "succeeded";
    assert(ingestSourceFingerprint(plan, run, "artifact.source", first, plusSeconds(now, 1)) === "unchanged", "same source must be stable");
    writeFileSync(path.join(sourceDir, "app.ts"), "export const version = 2;\n");
    const second = fingerprintAppSource(dir, ["src"]);
    assert(ingestSourceFingerprint(plan, run, "artifact.source", second, plusSeconds(now, 2)) === "changed", "changed source must be ingested");
    assert(getStatus(run, nodeId("surface")) === "stale", "source change must invalidate its surface consumer");
  });

  harness.check("source fingerprint: live observer persists the external input before frontier computation", () => {
    const dir = harness.makeTempDir("source-observer");
    mkdirSync(path.join(dir, "src"), { recursive: true });
    writeFileSync(path.join(dir, "src", "app.ts"), "export const live = true;\n", "utf8");
    const catalog: CatalogInput = {
      version: "catalog.source-observer.1",
      artifacts: [
        { id: "artifact.source-observer", path: APP_SOURCE_FINGERPRINT_PATH },
        { id: "artifact.source-manifest", path: "engineering/SOURCE_CHANGE_MANIFEST.json" },
      ],
      workflows: [
        {
          id: "workflow.source-manifest",
          title: "Source manifest",
          domainId: "domain.engineering",
          actionClass: "draft",
          reads: [APP_SOURCE_FINGERPRINT_PATH],
          dependencies: [],
          outputPaths: ["engineering/SOURCE_CHANGE_MANIFEST.json"],
          providerIds: [],
          laneIds: ["engineering"],
          founderOnlyActions: [],
          gateCommands: [],
          idempotent: true,
        },
      ],
    };
    const plan = compilePlan(catalog, now);
    const run = seedRunState(plan, baseBusinessState(), { ownerSessionId: "session.source-observer", ttlSeconds: 60, wallClockCapSeconds: 60, now });
    assert(observeAppSourceFingerprint(plan, run, dir, now) === "baseline", "live observer must establish the source baseline");
    assert(existsSync(path.join(dir, APP_SOURCE_FINGERPRINT_PATH)), "live observer must write the exact task artifact the manifest worker opens");
    assert(
      computeFrontier(plan, run, baseBusinessState(), allowAllAutonomyEvaluator).ready.includes(nodeId("source-manifest")),
      "accepted external source input must make the source-manifest node ready",
    );
    run.nodes[nodeId("source-manifest")]!.status = "succeeded";
    writeFileSync(path.join(dir, "src", "app.ts"), "export const live = false;\n", "utf8");
    assert(
      observeAppSourceFingerprint(plan, run, dir, plusSeconds(now, 1)) === "changed",
      "later source edits must be observed without waiting for a workflow output",
    );
    assert(getStatus(run, nodeId("source-manifest")) === "stale", "live source change must stale the manifest producer before the next frontier");
    const runSource = readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "../../core/session/run.ts"), "utf8");
    assert(
      runSource.indexOf("observeAppSourceFingerprint") < runSource.indexOf("computeFrontier(plan"),
      "session runner must observe source before computing its first frontier",
    );
  });

  harness.check("runtime binding: installed catalog version is discovered automatically and missing parity data fails closed", () => {
    const workspace = harness.makeTempDir("runtime-catalog-version");
    mkdirSync(path.join(workspace, ".b2c-launch"), { recursive: true });
    writeFileSync(path.join(workspace, ".b2c-launch", "runtime.json"), JSON.stringify({ catalogVersion: "2.0.0+0.128.0" }), "utf8");
    assert(runtimeCatalogVersion(workspace) === "2.0.0+0.128.0", "session must derive expected catalog version from installed runtime.json");
    writeFileSync(path.join(workspace, ".b2c-launch", "runtime.json"), JSON.stringify({ skillVersion: "0.128.0" }), "utf8");
    let failedClosed = false;
    try {
      runtimeCatalogVersion(workspace);
    } catch {
      failedClosed = true;
    }
    assert(failedClosed, "a present stale runtime binding without catalogVersion must fail closed");
  });

  harness.check("standing approvals: exact target, payload, spend, capability, and provenance are revalidated before reuse", () => {
    const plan = compilePlan(testCatalog(), now);
    const { run } = seedFor(["research", "product", "engineering"], plan);
    const ledgerPath = path.join(harness.makeTempDir("standing-approval"), "agent-operations.json");
    const payloadDigest = `sha256:${"a".repeat(64)}`;
    const envelope = {
      id: "APR-revenue-report",
      provider: "Stripe",
      account: "acct_fixture",
      team: "growth",
      project: "fixture-app",
      environment: "production",
      actionClasses: ["spend"],
      operations: ["workflow.revenue-report"],
      resourcePatterns: ["revenue/report.md", "provider.stripe"],
      payloadDigests: [payloadDigest],
      exclusions: [],
      mode: "standing",
      expiresAt: "2027-08-01T00:00:00.000Z",
      status: "active",
      spendCeiling: 50,
      voicePolicy: "",
    };
    const capability = {
      id: "stripe-cli",
      provider: "Stripe",
      status: "available",
      account: "acct_fixture",
      team: "growth",
      project: "fixture-app",
      environment: "production",
      modes: ["spend"],
    };
    const action = {
      id: "ACT-revenue-report",
      class: "spend",
      operation: "workflow.revenue-report",
      resource: "revenue/report.md",
      capabilityId: "stripe-cli",
      provider: "Stripe",
      account: "acct_fixture",
      team: "growth",
      project: "fixture-app",
      environment: "production",
      payloadDigest,
      spendAmount: 25,
      currency: "USD",
      voicePolicy: "",
      authorization: { approvalId: envelope.id },
      preflight: { targetVerified: true },
      result: { status: "planned" },
    };
    const writeLedger = (): void => writeFileSync(ledgerPath, JSON.stringify({ approvalEnvelopes: [envelope], capabilities: [capability], actions: [action] }));
    writeLedger();
    const matches = applyStandingApprovals(plan, run, ledgerPath, now);
    assert(
      matches.some((entry) => entry.workflowId === "workflow.revenue-report" && entry.envelopeId === envelope.id),
      "exact standing envelope must be consumed as current authority",
    );
    assert(run.approvals["workflow.revenue-report.approval.1"] === "approved", "matching envelope must approve the run-state gate");
    assert(
      run.approvalProvenance?.["workflow.revenue-report.approval.1"]?.actionId === action.id,
      "a standing approval must persist its exact envelope/action provenance",
    );

    envelope.status = "revoked";
    writeLedger();
    assert(applyStandingApprovals(plan, run, ledgerPath, now).length === 0, "a revoked envelope must not remain reusable");
    assert(getApprovalStatus(run, "workflow.revenue-report.approval.1") === "pending", "revocation must reset a standing-sourced approval to pending");
    assert(run.approvalProvenance?.["workflow.revenue-report.approval.1"] === undefined, "revocation must remove stale provenance");

    envelope.status = "active";
    action.project = "other-project";
    writeLedger();
    assert(applyStandingApprovals(plan, run, ledgerPath, now).length === 0, "an action for another project must not inherit this envelope");

    action.project = envelope.project;
    envelope.operations = ["workflow.*"];
    writeLedger();
    assert(applyStandingApprovals(plan, run, ledgerPath, now).length === 0, "a broad wildcard operation must not widen authority by analogy");

    envelope.operations = ["workflow.revenue-report"];
    action.spendAmount = 75;
    writeLedger();
    assert(applyStandingApprovals(plan, run, ledgerPath, now).length === 0, "an action above the envelope and catalog estimate must stay gated");

    run.approvals["workflow.revenue-report.approval.1"] = "approved";
    run.approvalProvenance = {};
    envelope.status = "revoked";
    writeLedger();
    applyStandingApprovals(plan, run, ledgerPath, now);
    assert(run.approvals["workflow.revenue-report.approval.1"] === "approved", "a manual founder approval without standing provenance must remain durable");
  });

  harness.check("standing approvals: public work requires the exact approved voice policy", () => {
    const catalog = testCatalog();
    catalog.workflows.find((workflow) => workflow.id === "workflow.growth-post")!.founderOnlyActions = ["Approve this public post"];
    const plan = compilePlan(catalog, now);
    const { run } = seedFor([], plan);
    const ledgerPath = path.join(harness.makeTempDir("standing-publish-voice"), "agent-operations.json");
    const payloadDigest = `sha256:${"b".repeat(64)}`;
    const envelope = {
      id: "APR-growth-post",
      provider: "Resend",
      account: "acct_growth",
      team: "marketing",
      project: "fixture-app",
      environment: "production",
      actionClasses: ["publish"],
      operations: ["workflow.growth-post"],
      resourcePatterns: ["growth/post.md"],
      payloadDigests: [payloadDigest],
      exclusions: [],
      mode: "standing",
      expiresAt: "2027-08-01T00:00:00.000Z",
      status: "active",
      spendCeiling: null,
      voicePolicy: "approved-brand-voice-v1",
    };
    const capability = {
      id: "resend-api",
      provider: "Resend",
      status: "available",
      account: envelope.account,
      team: envelope.team,
      project: envelope.project,
      environment: envelope.environment,
      modes: ["publish"],
    };
    const action = {
      id: "ACT-growth-post",
      class: "publish",
      operation: "workflow.growth-post",
      resource: "growth/post.md",
      capabilityId: capability.id,
      provider: envelope.provider,
      account: envelope.account,
      team: envelope.team,
      project: envelope.project,
      environment: envelope.environment,
      payloadDigest,
      spendAmount: null,
      currency: "",
      voicePolicy: "another-voice",
      authorization: { approvalId: envelope.id },
      preflight: { targetVerified: true },
      result: { status: "planned" },
    };
    const writeLedger = (): void => writeFileSync(ledgerPath, JSON.stringify({ approvalEnvelopes: [envelope], capabilities: [capability], actions: [action] }));
    writeLedger();
    assert(applyStandingApprovals(plan, run, ledgerPath, now).length === 0, "a voice-policy mismatch must keep public work gated");
    action.voicePolicy = envelope.voicePolicy;
    writeLedger();
    assert(applyStandingApprovals(plan, run, ledgerPath, now).length === 1, "the exact approved voice policy should unlock the planned public action");
  });

  harness.check(
    "runstate: a gateless node's outputs no longer auto-accept — reconcile lands blocked and acceptVerification with evidence promotes (the 2026-08 auto-accept hole, closed)",
    () => {
      const plan = compilePlan(testCatalog(), now);
      const { run } = seedFor(["research", "product"], plan);
      const attempt = beginAttempt(plan, run, nodeId("engineering-build"), "session-x", now);
      reconcilePatch(
        plan,
        run,
        {
          nodeId: nodeId("engineering-build"),
          attemptId: attempt.id,
          outputs: [{ artifactId: "artifact.engineering-build", path: "foo", fingerprint: "abc123", evidence: ["log line"] }],
        },
        now,
      );
      assert(
        run.nodes[nodeId("engineering-build")]!.status === "blocked",
        "a gateless node's reconcile must land blocked pending verification, never auto-succeed",
      );
      const binding = run.artifactBindings.find((b) => b.artifactId === "artifact.engineering-build")!;
      assert(binding.accepted === false, "the output binding must stay unaccepted until a verifier accepts with evidence");
      acceptVerification(plan, run, nodeId("engineering-build"), ["non-producer verifier signed off"], now);
      assert(run.nodes[nodeId("engineering-build")]!.status === "succeeded", "acceptVerification with evidence promotes the node");
      assert(
        run.artifactBindings.find((b) => b.artifactId === "artifact.engineering-build")!.accepted === true,
        "acceptance follows verification, not delivery",
      );
      assertSchemaValid(harness.checkSchema(RUN_STATE_SCHEMA, run), "run state after verified acceptance");
    },
  );

  harness.check(
    "boundary: a fresh-context result is exported only when its recorded verifier differs from the producing session — self-verification never crosses (Codex round 2)",
    () => {
      const plan = compilePlan(testCatalog(), now);
      // Self-verified: the recorded verifier IS the producer — the boundary must withhold it.
      {
        const { run } = seedFor([], plan);
        const attempt = beginAttempt(plan, run, nodeId("research-scan"), "session-producer", now);
        reconcilePatch(
          plan,
          run,
          {
            nodeId: nodeId("research-scan"),
            attemptId: attempt.id,
            outputs: [{ artifactId: "artifact.research-brief", path: "research/brief.md", fingerprint: "abc", evidence: [] }],
          },
          now,
        );
        acceptVerification(plan, run, nodeId("research-scan"), ["I checked my own work"], now, "session-producer");
        assert(buildBoundaryResults(plan, run).length === 0, "a result whose verifier equals its producer must not cross the boundary");
      }
      // No recorded verifier at all: equally withheld — absence is not independence.
      {
        const { run } = seedFor([], plan);
        const attempt = beginAttempt(plan, run, nodeId("research-scan"), "session-producer", now);
        reconcilePatch(
          plan,
          run,
          {
            nodeId: nodeId("research-scan"),
            attemptId: attempt.id,
            outputs: [{ artifactId: "artifact.research-brief", path: "research/brief.md", fingerprint: "abc", evidence: [] }],
          },
          now,
        );
        acceptVerification(plan, run, nodeId("research-scan"), ["accepted with no recorded verifier"], now);
        assert(buildBoundaryResults(plan, run).length === 0, "a fresh-context result with no recorded verifier must not cross the boundary");
      }
      // Independent verifier: exported, carrying both provenance fields.
      {
        const { run } = seedFor([], plan);
        const attempt = beginAttempt(plan, run, nodeId("research-scan"), "session-producer", now);
        reconcilePatch(
          plan,
          run,
          {
            nodeId: nodeId("research-scan"),
            attemptId: attempt.id,
            outputs: [{ artifactId: "artifact.research-brief", path: "research/brief.md", fingerprint: "abc", evidence: [] }],
          },
          now,
        );
        acceptVerification(plan, run, nodeId("research-scan"), ["fresh-context reviewer signed off"], now, "session-reviewer");
        const exported = buildBoundaryResults(plan, run);
        assert(exported.length === 1, "an independently verified result must cross the boundary");
        assert(
          exported[0]!.producedBySessionId === "session-producer" && exported[0]!.verifiedBySessionId === "session-reviewer",
          "the result must carry producer and verifier provenance",
        );
      }
    },
  );

  harness.check("runstate: reconcilePatch requiring verification lands blocked, acceptVerification promotes to succeeded", () => {
    const plan = compilePlan(testCatalog(), now);
    const { run } = seedFor([], plan);
    const attempt = beginAttempt(plan, run, nodeId("research-scan"), "session-x", now);
    reconcilePatch(
      plan,
      run,
      {
        nodeId: nodeId("research-scan"),
        attemptId: attempt.id,
        outputs: [{ artifactId: "artifact.research-brief", path: "research/brief.md", fingerprint: "abc", evidence: [] }],
      },
      now,
    );
    assert(run.nodes[nodeId("research-scan")]!.status === "blocked", "fresh-context verification should land blocked pending acceptance");
    acceptVerification(plan, run, nodeId("research-scan"), ["fresh-context reviewer signed off"], now);
    assert(run.nodes[nodeId("research-scan")]!.status === "succeeded", "acceptVerification should promote the node to succeeded");
    assert(Boolean(run.nodes[nodeId("research-scan")]!.acceptedOutputFingerprint), "succeeded node should carry an accepted output fingerprint");
  });

  harness.check("runstate: acceptVerification rejects evidence containing only an empty string (fail closed, not a bare length check)", () => {
    const plan = compilePlan(testCatalog(), now);
    const { run } = seedFor([], plan);
    const attempt = beginAttempt(plan, run, nodeId("research-scan"), "session-x", now);
    reconcilePatch(
      plan,
      run,
      {
        nodeId: nodeId("research-scan"),
        attemptId: attempt.id,
        outputs: [{ artifactId: "artifact.research-brief", path: "research/brief.md", fingerprint: "abc", evidence: [] }],
      },
      now,
    );
    assert(run.nodes[nodeId("research-scan")]!.status === "blocked", "fresh-context verification should land blocked pending acceptance");
    let threw = false;
    try {
      acceptVerification(plan, run, nodeId("research-scan"), [""], now);
    } catch (error) {
      threw = true;
      assert(String(error).includes("requires evidence"), `expected an evidence-required error, got: ${error}`);
    }
    assert(threw, "acceptVerification must reject evidence:[''] rather than accept it as if real evidence were provided");
    assert(run.nodes[nodeId("research-scan")]!.status === "blocked", "the node must remain blocked after a rejected empty-string evidence attempt");
  });

  harness.check("runstate: reconcilePatch rejects an undeclared attempt", () => {
    const plan = compilePlan(testCatalog(), now);
    const { run } = seedFor([], plan);
    let threw = false;
    try {
      reconcilePatch(plan, run, { nodeId: nodeId("research-scan"), attemptId: "not-a-real-attempt", outputs: [] }, now);
    } catch {
      threw = true;
    }
    assert(threw, "reconcilePatch must reject a patch with no matching active attempt");
  });

  // ---------------------------------------------------------------------
  // runstate.ts: staleness propagation
  // ---------------------------------------------------------------------

  harness.check("runstate: staleness invalidates descendants transitively when an accepted input changes", () => {
    const plan = compilePlan(testCatalog(), now);
    const { run } = seedFor(["research", "product", "engineering"], plan);
    assert(run.nodes[nodeId("revenue-report")]!.status === "pending", "revenue-report starts pending (not yet attempted)");

    const invalidated = invalidateDescendants(plan, run, ["artifact.research-brief"], plusSeconds(now, 1));

    assert(invalidated.includes(nodeId("product-spec")), "direct descendant product-spec should go stale");
    assert(invalidated.includes(nodeId("engineering-build")), "transitive descendant engineering-build should go stale");
    assert(invalidated.includes(nodeId("engineering-build-sub")), "transitive descendant engineering-build-sub should go stale");
    assert(run.nodes[nodeId("product-spec")]!.status === "stale", "product-spec node status should be stale");
    assert(!run.artifactBindings.find((b) => b.artifactId === "artifact.product-spec")!.accepted, "product-spec's output binding should be un-accepted");
  });

  harness.check(
    "runstate: reconciling a changed accepted output invalidates descendants automatically — the staleness trigger is wired, not merely available",
    () => {
      const plan = compilePlan(testCatalog(), now);
      const { run } = seedFor([], plan);
      const first = beginAttempt(plan, run, nodeId("research-scan"), "session-x", now);
      reconcilePatch(
        plan,
        run,
        {
          nodeId: nodeId("research-scan"),
          attemptId: first.id,
          outputs: [{ artifactId: "artifact.research-brief", path: "research/brief.md", fingerprint: "brief-v1", evidence: ["scan v1"] }],
        },
        now,
      );
      acceptVerification(plan, run, nodeId("research-scan"), ["fresh-context reviewer signed off"], now);
      const spec = beginAttempt(plan, run, nodeId("product-spec"), "session-x", plusSeconds(now, 1));
      reconcilePatch(
        plan,
        run,
        {
          nodeId: nodeId("product-spec"),
          attemptId: spec.id,
          outputs: [{ artifactId: "artifact.product-spec", path: "product/spec.md", fingerprint: "spec-v1", evidence: [] }],
        },
        plusSeconds(now, 1),
      );
      acceptVerification(plan, run, nodeId("product-spec"), ["gate:check:research=passed"], plusSeconds(now, 1));

      const second = beginAttempt(plan, run, nodeId("research-scan"), "session-y", plusSeconds(now, 2));
      reconcilePatch(
        plan,
        run,
        {
          nodeId: nodeId("research-scan"),
          attemptId: second.id,
          outputs: [{ artifactId: "artifact.research-brief", path: "research/brief.md", fingerprint: "brief-v2", evidence: ["scan v2"] }],
        },
        plusSeconds(now, 2),
      );

      assert(getStatus(run, nodeId("product-spec")) === "stale", "product-spec must go stale when its accepted input's fingerprint changes");
      assert(!run.artifactBindings.find((b) => b.artifactId === "artifact.product-spec")!.accepted, "product-spec's output binding must be un-accepted");
      assert(getStatus(run, nodeId("engineering-build")) === "stale", "transitive descendant engineering-build must go stale too");
      assert(getStatus(run, nodeId("growth-post")) === "pending", "unrelated growth-post must be untouched — invalidation must never over-mark");
      assert(getStatus(run, nodeId("research-scan")) === "blocked", "the producer itself is pending its own re-verification, never stale");
    },
  );

  harness.check("runstate: re-producing an identical output invalidates nothing — staleness stays honest in both directions", () => {
    const plan = compilePlan(testCatalog(), now);
    const { run } = seedFor([], plan);
    const first = beginAttempt(plan, run, nodeId("research-scan"), "session-x", now);
    reconcilePatch(
      plan,
      run,
      {
        nodeId: nodeId("research-scan"),
        attemptId: first.id,
        outputs: [{ artifactId: "artifact.research-brief", path: "research/brief.md", fingerprint: "brief-v1", evidence: [] }],
      },
      now,
    );
    acceptVerification(plan, run, nodeId("research-scan"), ["fresh-context reviewer signed off"], now);
    const spec = beginAttempt(plan, run, nodeId("product-spec"), "session-x", plusSeconds(now, 1));
    reconcilePatch(
      plan,
      run,
      {
        nodeId: nodeId("product-spec"),
        attemptId: spec.id,
        outputs: [{ artifactId: "artifact.product-spec", path: "product/spec.md", fingerprint: "spec-v1", evidence: [] }],
      },
      plusSeconds(now, 1),
    );
    acceptVerification(plan, run, nodeId("product-spec"), ["gate:check:research=passed"], plusSeconds(now, 1));

    const second = beginAttempt(plan, run, nodeId("research-scan"), "session-y", plusSeconds(now, 2));
    reconcilePatch(
      plan,
      run,
      {
        nodeId: nodeId("research-scan"),
        attemptId: second.id,
        outputs: [{ artifactId: "artifact.research-brief", path: "research/brief.md", fingerprint: "brief-v1", evidence: [] }],
      },
      plusSeconds(now, 2),
    );

    assert(getStatus(run, nodeId("product-spec")) === "succeeded", "an identical re-production must not stale downstream work");
    assert(run.artifactBindings.find((b) => b.artifactId === "artifact.product-spec")!.accepted === true, "product-spec's accepted output must stay accepted");
  });

  // ---------------------------------------------------------------------
  // runstate.ts: wall-clock deadline
  // ---------------------------------------------------------------------

  harness.check("runstate: wall-clock deadline is recorded and the exceeded flag flips at the cap", () => {
    const plan = compilePlan(testCatalog(), now);
    const { run } = seedFor([], plan);
    const deadline = wallClockDeadline(run);
    assert(deadline === plusSeconds(run.createdAt, run.wallClockCapSeconds), "deadline should be createdAt + wallClockCapSeconds");
    assert(!isWallClockExceeded(run, plusSeconds(now, run.wallClockCapSeconds - 1)), "one second before the cap must not be exceeded");
    assert(isWallClockExceeded(run, plusSeconds(now, run.wallClockCapSeconds + 1)), "one second past the cap must be exceeded");
  });

  harness.check(
    "runstate: a resumed session measures the wall clock from its own start, never run creation (regression: every resume timed out instantly)",
    () => {
      const plan = compilePlan(testCatalog(), now);
      const { run } = seedFor([], plan);
      const laterSessionStart = plusSeconds(run.createdAt, run.wallClockCapSeconds * 3);
      assert(
        !isWallClockExceeded(run, plusSeconds(laterSessionStart, run.wallClockCapSeconds - 1), laterSessionStart),
        "a resumed session one second inside its own cap must not be exceeded, even long after run creation",
      );
      assert(
        isWallClockExceeded(run, plusSeconds(laterSessionStart, run.wallClockCapSeconds + 1), laterSessionStart),
        "a resumed session one second past its own cap must be exceeded",
      );
    },
  );

  // ---------------------------------------------------------------------
  // runstate.ts: persistence (atomic checkpoint, cross-process reload)
  // ---------------------------------------------------------------------

  harness.check("runstate: checkpoint is written temp-then-rename — no partial write is ever observed", () => {
    const plan = compilePlan(testCatalog(), now);
    const { run } = seedFor([], plan);
    const dir = harness.makeTempDir("engine-checkpoint-atomicity");
    const checkpointPath = path.join(dir, "checkpoint.json");

    const first = buildCheckpoint(run, "session-1", "hash-1", now);
    writeCheckpoint(checkpointPath, first);
    assert(!existsSync(`${checkpointPath}.tmp`), "no .tmp file should remain after a checkpoint write");
    const reloadedFirst = loadCheckpoint(checkpointPath);
    assertSchemaValid(harness.checkSchema(CHECKPOINT_SCHEMA, JSON.parse(readFileSync(checkpointPath, "utf8"))), "checkpoint on disk");
    assert(reloadedFirst.stateHash === "hash-1", "first checkpoint should round-trip its stateHash");

    const second = buildCheckpoint(run, "session-1", "hash-2", plusSeconds(now, 10));
    writeCheckpoint(checkpointPath, second);
    assert(!existsSync(`${checkpointPath}.tmp`), "no .tmp file should remain after the second checkpoint write");
    const reloadedSecond = loadCheckpoint(checkpointPath);
    assert(reloadedSecond.stateHash === "hash-2", "reading after the second write must never observe the first (partial or stale) write");
  });

  harness.check("runstate: run-state file is re-loadable across processes (write, then load fresh)", () => {
    const plan = compilePlan(testCatalog(), now);
    const { run } = seedFor(["research"], plan);
    beginAttempt(plan, run, nodeId("product-spec"), "session-1", now);
    const dir = harness.makeTempDir("engine-runstate-reload");
    const runStatePath = path.join(dir, "run-state.json");
    writeRunState(runStatePath, run);
    const reloaded = loadRunState(runStatePath);
    assert(reloaded.runId === run.runId, "reloaded run state should preserve runId");
    assert(reloaded.nodes[nodeId("product-spec")]!.status === "running", "reloaded run state should preserve in-flight node status");
    assert(reloaded.nodes[nodeId("product-spec")]!.attempts[0]!.ownerSessionId === "session-1", "reloaded attempt should keep its owner session id");
  });
}
