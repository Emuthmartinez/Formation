import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { assert, assertSchemaValid, type Harness } from "./_harness.js";
import { laneKeys, type BusinessStateV2, type LaneKey, type RunStateDocument, type Status } from "../../core/schema/types.js";
import { compilePlan, type CatalogArtifact, type CatalogInput, type CatalogWorkflowNode, type CompiledPlan, type RunNodeId } from "../../core/engine/compile.js";
import { allowAllAutonomyEvaluator, computeFrontier, type AutonomyEvaluator } from "../../core/engine/frontier.js";
import { buildDispatchBatches, checkBatchBoundary, neverHaltDispatchHooks } from "../../core/engine/dispatch.js";
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
      gateCommands: ["check:product-spec"],
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

    assert(events.some((event) => event.nodeId === idempotentId && event.resolution === "ready"), "idempotent node should resolve to ready");
    assert(events.some((event) => event.nodeId === nonIdempotentId && event.resolution === "needs_readback"), "non-idempotent node should resolve to needs_readback");
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

  harness.check("runstate: reconcilePatch with every declared output and kind:none verification succeeds directly", () => {
    const plan = compilePlan(testCatalog(), now);
    const { run } = seedFor(["research", "product"], plan);
    const attempt = beginAttempt(plan, run, nodeId("engineering-build"), "session-x", now);
    reconcilePatch(plan, run, { nodeId: nodeId("engineering-build"), attemptId: attempt.id, outputs: [{ artifactId: "artifact.engineering-build", path: "foo", fingerprint: "abc123", evidence: ["log line"] }] }, now);
    assert(run.nodes[nodeId("engineering-build")]!.status === "succeeded", "kind:none verification should reach succeeded directly from reconcile");
    const binding = run.artifactBindings.find((b) => b.artifactId === "artifact.engineering-build")!;
    assert(binding.accepted === true, "the output binding should be accepted");
    assertSchemaValid(harness.checkSchema(RUN_STATE_SCHEMA, run), "run state after a kind:none reconcile");
  });

  harness.check("runstate: reconcilePatch requiring verification lands blocked, acceptVerification promotes to succeeded", () => {
    const plan = compilePlan(testCatalog(), now);
    const { run } = seedFor([], plan);
    const attempt = beginAttempt(plan, run, nodeId("research-scan"), "session-x", now);
    reconcilePatch(plan, run, { nodeId: nodeId("research-scan"), attemptId: attempt.id, outputs: [{ artifactId: "artifact.research-brief", path: "research/brief.md", fingerprint: "abc", evidence: [] }] }, now);
    assert(run.nodes[nodeId("research-scan")]!.status === "blocked", "fresh-context verification should land blocked pending acceptance");
    acceptVerification(plan, run, nodeId("research-scan"), ["fresh-context reviewer signed off"], now);
    assert(run.nodes[nodeId("research-scan")]!.status === "succeeded", "acceptVerification should promote the node to succeeded");
    assert(Boolean(run.nodes[nodeId("research-scan")]!.acceptedOutputFingerprint), "succeeded node should carry an accepted output fingerprint");
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
