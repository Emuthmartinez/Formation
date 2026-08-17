import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
import { buildBoundaryResults } from "../../core/adapters/platform-execution.js";
import { buildWorkerCommand } from "../../core/session/executor.js";
import { buildWorkerPrompt, validateKnowledgeReceipt } from "../../core/session/worker-prompt.js";
import { applyStandingApprovals } from "../../core/autonomy/standing-approvals.js";
import {
  acceptVerification,
  beginAttempt,
  buildCheckpoint,
  detectOrphans,
  invalidateDescendants,
  isWallClockExceeded,
  loadCheckpoint,
  loadRunState,
  reconcilePatch,
  refreshHeartbeat,
  seedRunState,
  wallClockDeadline,
  writeCheckpoint,
  writeRunState,
} from "../../core/engine/runstate.js";

const RUN_STATE_SCHEMA = "urn:b2c-mobile-business-launch:core:run-state-schema";
const CHECKPOINT_SCHEMA = "urn:b2c-mobile-business-launch:core:checkpoint-schema";

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
    const prompt = buildWorkerPrompt(brief, "/tmp/business", "/tmp/skill");
    assert(prompt.includes("AGENTS.md") && prompt.includes("agents/product-leader.md"), "worker prompt must carry parent and specialist contracts");
    assert(
      prompt.includes("knowledge/research/fixture.md") && prompt.includes("knowledge/research/role.md"),
      "worker prompt must carry mandatory and conditional knowledge",
    );
    assert(
      prompt.includes("fixture-product-skill") && prompt.includes("fixture-product-tool"),
      "worker prompt must carry nested skill and tool discovery routes",
    );
    const command = buildWorkerCommand("codex", prompt);
    assert(command.args.includes(prompt), "the runtime command must receive the composed worker prompt, not a title-only surrogate");
    assert(validateKnowledgeReceipt("finished", brief).length > 0, "a conclusion without a knowledge receipt must fail");
    const receipt = [
      "CONTRACT_FILES_LOADED:",
      ...brief.contractFiles.map((entry) => `- ${entry}`),
      "KNOWLEDGE_LOADED:",
      ...brief.load.map((entry) => `- ${entry.path}`),
      "ROLE_KNOWLEDGE_USED:\n- none — condition did not match",
      "SKILLS_USED:\n- fixture-product-skill",
      "TOOLS_USED:\n- fixture-product-tool",
    ].join("\n");
    assert(validateKnowledgeReceipt(receipt, brief).length === 0, "an exact parent + mandatory-knowledge receipt must pass");
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
