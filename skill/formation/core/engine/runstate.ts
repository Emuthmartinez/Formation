import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, writeSync } from "node:fs";
import path, { dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { validateCheckpoint, validateRunState } from "../schema/index.js";
import type { ArtifactBindingV2, AttemptRecordV2, BusinessStateV2, CheckpointDocument, RunNodeStateV2, RunStateDocument, Status } from "../schema/types.js";
import { sha256, type CompiledPlan, type RunNodeId } from "./compile.js";

/** A lane in one of these states means the workflows that own it are already done. */
const DONE_LANE_STATUSES: readonly Status[] = ["succeeded", "not_needed", "skipped"];

/** Statuses the frontier would re-examine — the ones an unanswered scope question must not reach dispatch from. */
const READY_ELIGIBLE_APPLICABILITY: readonly Status[] = ["pending", "ready", "stale"];

export interface SeedRunStateOptions {
  ownerSessionId: string;
  ttlSeconds: number;
  wallClockCapSeconds: number;
  now?: string;
  runId?: string;
}

/**
 * Load/seed from business state v2 (R1: any session reconstructs truth from durable state, never
 * chat memory). A node whose every lane is already done is seeded succeeded, with its declared
 * outputs pre-accepted — a mid-launch business must not re-offer day-one work on its frontier.
 */
export function seedRunState(plan: CompiledPlan, businessState: BusinessStateV2, options: SeedRunStateOptions): RunStateDocument {
  const now = options.now ?? new Date().toISOString();
  const nodes: Record<string, RunNodeStateV2> = {};

  for (const node of plan.nodes) {
    const alreadyDone = node.laneIds.length > 0 && node.laneIds.every((laneKey) => DONE_LANE_STATUSES.includes(businessState.lanes[laneKey]?.status as Status));
    nodes[node.id] = alreadyDone
      ? { nodeId: node.id, status: "succeeded", attempts: [], acceptedOutputFingerprint: sha256(`seed:${node.id}`) }
      : { nodeId: node.id, status: "pending", attempts: [] };
  }

  const artifactBindings: ArtifactBindingV2[] = plan.artifactBindings.map((binding) => {
    const producer = plan.nodes.find((node) => node.outputs.some((output) => output === binding.artifactId));
    const accepted = producer ? nodes[producer.id]?.status === "succeeded" : false;
    return accepted ? { ...binding, accepted: true, fingerprint: sha256(`seed:${binding.artifactId}`) } : { ...binding, accepted: false };
  });

  const approvals = Object.fromEntries(plan.nodes.flatMap((node) => node.approvals.map((approval) => [approval.id, "pending" as const])));

  const run: RunStateDocument = {
    schemaVersion: "1.0.0",
    runId: options.runId ?? `run.${plan.planId.slice("plan.".length)}.${randomUUID().slice(0, 8)}`,
    planId: plan.planId,
    planRevision: plan.planRevision,
    createdAt: now,
    updatedAt: now,
    ownerSessionId: options.ownerSessionId,
    heartbeatAt: now,
    ttlSeconds: options.ttlSeconds,
    wallClockCapSeconds: options.wallClockCapSeconds,
    approvals,
    approvalProvenance: {},
    artifactBindings,
    nodes,
  };
  reconcileWorkflowApplicability(plan, run, businessState, now);
  return run;
}

/**
 * Apply durable scope verdicts AND the business's launch profile before frontier selection. A
 * verdict or profile transition invalidates old proof. Precedence per node: a recorded founder
 * verdict wins; then the profile (a node whose every lane the profile defers parks not_needed);
 * then the node's own applicability mode. Profiles arrive as compiled fact
 * (CompiledRunNode.deferredByProfiles), so a catalog pinned before profiles existed defers
 * nothing — per-business re-pin semantics, same as every other catalog change (R4/R7).
 */
export function reconcileWorkflowApplicability(plan: CompiledPlan, run: RunStateDocument, businessState: BusinessStateV2, now: string): void {
  // Optional-chained on purpose: minimal fixture states omit project entirely, and a missing
  // scope must mean "no profile parking", never a crash before the frontier.
  const profileId = businessState.project?.launchScope ?? "";
  for (const node of plan.nodes) {
    const profileDeferred = node.deferredByProfiles.includes(profileId);
    // Fast exit for the overwhelmingly common case: an unconditional node no profile touches,
    // with no prior applicability history to unwind. Zero behavior change from before profiles.
    if (node.applicability.mode === "always" && !profileDeferred) {
      const priorState = run.nodes[node.id];
      if (!priorState || priorState.applicabilityFingerprint === undefined) continue;
    }
    const state = run.nodes[node.id];
    if (!state) continue;
    const record = businessState.workflowApplicability?.[node.workflowId];
    // Reason, evidence, and timestamp edits explain the verdict but do not change scope. Only a
    // verdict or profile transition can retire or reopen work and invalidate its accepted output.
    const fingerprint = sha256(`${record?.verdict ?? "unknown"}|${profileDeferred ? profileId : "none"}`);
    if (state.applicabilityFingerprint === fingerprint) {
      // The unchanged-fingerprint fast path must still re-park an UNANSWERED question: staleness
      // invalidation resets a node to a ready-eligible status without touching the applicability
      // fingerprint, and before this guard a scope-gated node could ride that reset straight into
      // dispatch with its founder question still open (caught by check:engine-e2e, 2026-08-19 —
      // both conditional-safety nodes ran with no workflowApplicability record on file).
      if (!record && node.applicability.mode === "conditional" && READY_ELIGIBLE_APPLICABILITY.includes(state.status)) {
        state.status = "waiting_founder";
        state.blocker = `Scope answer needed: ${node.applicability.question}`;
        run.updatedAt = now;
      }
      // The same reset hazard applies to a profile-parked node: re-park it after staleness resets.
      if (!record && profileDeferred && node.applicability.mode === "always" && READY_ELIGIBLE_APPLICABILITY.includes(state.status)) {
        state.status = "not_needed";
        state.blocker = `Deferred by the ${profileId} profile; widen scope or record a required verdict to include it.`;
        run.updatedAt = now;
      }
      continue;
    }

    for (const binding of run.artifactBindings.filter((item) => node.outputs.some((artifactId) => artifactId === item.artifactId))) {
      binding.accepted = false;
      binding.fingerprint = undefined;
      binding.producedBy = undefined;
      binding.attemptId = undefined;
    }
    state.acceptedOutputFingerprint = undefined;
    state.verifiedBySessionId = undefined;
    state.applicabilityFingerprint = fingerprint;
    if (record) {
      // The founder's recorded verdict outranks the profile in both directions.
      if (record.verdict === "not-needed") {
        state.status = "not_needed";
        state.blocker = `Not needed: ${record.reason}`;
      } else {
        state.status = "pending";
        state.blocker = undefined;
      }
    } else if (profileDeferred) {
      state.status = "not_needed";
      state.blocker = `Deferred by the ${profileId} profile; widen scope or record a required verdict to include it.`;
    } else if (node.applicability.mode === "conditional") {
      state.status = "waiting_founder";
      state.blocker = `Scope answer needed: ${node.applicability.question}`;
    } else {
      state.status = "pending";
      state.blocker = undefined;
    }
    run.updatedAt = now;
  }
}

/** Begins a new attempt with owner session id, heartbeat, and TTL (R12). */
export function beginAttempt(plan: CompiledPlan, run: RunStateDocument, nodeId: RunNodeId, ownerSessionId: string, now: string): AttemptRecordV2 {
  const node = plan.nodes.find((candidate) => candidate.id === nodeId);
  const state = run.nodes[nodeId];
  if (!node || !state) throw new Error(`Unknown run node ${nodeId}`);
  if (state.attempts.length >= node.maxAttempts) throw new Error(`${nodeId} exhausted ${node.maxAttempts} attempts`);

  const attempt: AttemptRecordV2 = {
    id: `${nodeId}.attempt.${state.attempts.length + 1}`,
    nodeId,
    number: state.attempts.length + 1,
    status: "running",
    ownerSessionId,
    heartbeatAt: now,
    ttlSeconds: node.ttlSeconds,
    inputFingerprint: fingerprintInputs(node.inputs, run.artifactBindings),
    startedAt: now,
    evidence: [],
    readbackRequired: false,
  };
  state.attempts.push(attempt);
  state.status = "running";
  run.updatedAt = now;
  return attempt;
}

function fingerprintInputs(inputs: readonly string[], bindings: readonly ArtifactBindingV2[]): string {
  return sha256(
    inputs.map((artifactId) => `${artifactId}:${bindings.find((binding) => binding.artifactId === artifactId)?.fingerprint ?? "missing"}`).join("|"),
  );
}

/** Refreshes the running attempt's heartbeat and the run-level owner heartbeat together. */
export function refreshHeartbeat(run: RunStateDocument, nodeId: RunNodeId, now: string): AttemptRecordV2 {
  const state = run.nodes[nodeId];
  const attempt = state?.attempts.at(-1);
  if (!state || !attempt || attempt.status !== "running") throw new Error(`${nodeId} has no running attempt to refresh`);
  attempt.heartbeatAt = now;
  run.heartbeatAt = now;
  run.updatedAt = now;
  return attempt;
}

export interface OrphanEvent {
  nodeId: RunNodeId;
  attemptId: string;
  resolution: "ready" | "needs_readback";
}

/**
 * A running attempt whose heartbeat has exceeded its TTL is orphaned (R12). Idempotent nodes
 * resolve straight to ready — the *next* dispatch cycle re-attempts them, this function never
 * dispatches anything itself. Non-idempotent nodes resolve to needs_readback and stay there: a
 * provider read-back must establish ground truth before anything retries. Neither path is an
 * auto-retry.
 */
export function detectOrphans(plan: CompiledPlan, run: RunStateDocument, now: string): OrphanEvent[] {
  const events: OrphanEvent[] = [];
  const nowMs = Date.parse(now);

  for (const node of plan.nodes) {
    const state = run.nodes[node.id];
    if (!state || state.status !== "running") continue;
    const attempt = state.attempts.at(-1);
    if (!attempt || attempt.status !== "running") continue;

    const heartbeat = attempt.heartbeatAt || attempt.startedAt || run.createdAt;
    const elapsedSeconds = (nowMs - Date.parse(heartbeat)) / 1000;
    if (elapsedSeconds < attempt.ttlSeconds) continue;

    attempt.status = "orphaned";
    attempt.finishedAt = now;
    if (node.idempotent) {
      state.status = "ready";
      state.blocker = undefined;
      events.push({ nodeId: node.id, attemptId: attempt.id, resolution: "ready" });
    } else {
      state.status = "needs_readback";
      attempt.readbackRequired = true;
      state.blocker = "Non-idempotent attempt orphaned; provider read-back required before retry.";
      events.push({ nodeId: node.id, attemptId: attempt.id, resolution: "needs_readback" });
    }
  }

  if (events.length > 0) run.updatedAt = now;
  return events;
}

export interface RunStatePatchOutput {
  artifactId: string;
  path: string;
  fingerprint: string;
  evidence: string[];
}

export interface RunStatePatch {
  nodeId: RunNodeId;
  attemptId: string;
  outputs: RunStatePatchOutput[];
}

/**
 * Fail-closed join (ported reconcilePatch): a patch omitting a declared output is a silent node
 * failure, rejected rather than partially applied. kind:"none" verification reaches succeeded
 * directly; anything else lands blocked pending acceptVerification.
 *
 * Staleness trigger: when a re-produced output replaces a fingerprint that downstream work was
 * *accepted against*, the accepted input context of every descendant just changed — the old
 * artifact no longer stands, whether or not the replacement is verified yet. That is exactly
 * invalidateDescendants' contract, so it runs here, at the single site where an accepted
 * fingerprint can be overwritten. A re-produced output with an identical fingerprint changes
 * nothing downstream and must not invalidate anything (staleness stays honest in both directions).
 */
export function reconcilePatch(plan: CompiledPlan, run: RunStateDocument, patch: RunStatePatch, now: string): void {
  const node = plan.nodes.find((candidate) => candidate.id === patch.nodeId);
  const state = run.nodes[patch.nodeId];
  const attempt = state?.attempts.find((candidate) => candidate.id === patch.attemptId);
  if (!node || !state || !attempt) throw new Error("Patch does not match an active run attempt");
  if (attempt.status !== "running") throw new Error(`Attempt ${attempt.id} is not running`);

  const expected = new Set<string>(node.outputs);
  const actual = new Set(patch.outputs.map((output) => output.artifactId));
  const missing = [...expected].filter((artifactId) => !actual.has(artifactId));
  if (missing.length > 0) throw new Error(`Silent node failure: ${patch.nodeId} omitted declared output(s) ${missing.join(", ")}`);

  const changedAcceptedInputs: string[] = [];
  for (const output of patch.outputs) {
    if (!expected.has(output.artifactId)) throw new Error(`${patch.nodeId} returned undeclared output ${output.artifactId}`);
    const binding = run.artifactBindings.find((candidate) => candidate.artifactId === output.artifactId);
    if (!binding) throw new Error(`Missing artifact binding ${output.artifactId}`);
    if (
      (binding.accepted && binding.fingerprint !== output.fingerprint) ||
      (binding.refreshBaselineFingerprint !== undefined && binding.refreshBaselineFingerprint !== output.fingerprint)
    )
      changedAcceptedInputs.push(output.artifactId);
    binding.path = output.path;
    binding.fingerprint = output.fingerprint;
    binding.accepted = node.verification.kind === "none";
    binding.producedBy = node.id;
    binding.attemptId = attempt.id;
    binding.refreshBaselineFingerprint = undefined;
    attempt.evidence.push(...output.evidence);
  }

  attempt.finishedAt = now;
  attempt.status = node.verification.kind === "none" ? "succeeded" : "blocked";
  state.status = node.verification.kind === "none" ? "succeeded" : "blocked";
  state.blocker = node.verification.kind === "none" ? undefined : "Verification required";
  state.refreshInstructions = undefined;
  run.updatedAt = now;

  if (changedAcceptedInputs.length > 0) invalidateDescendants(plan, run, changedAcceptedInputs, now);
}

/** Producer never verifies its own work (R15): a separate acceptance step promotes a reconciled-but-blocked node to succeeded. */
export function acceptVerification(
  plan: CompiledPlan,
  run: RunStateDocument,
  nodeId: RunNodeId,
  evidence: string[],
  now: string,
  verifiedBySessionId?: string,
): void {
  const node = plan.nodes.find((candidate) => candidate.id === nodeId);
  const state = run.nodes[nodeId];
  const attempt = state?.attempts.at(-1);
  if (!node || !state || !attempt) throw new Error(`No attempt to verify for ${nodeId}`);
  // evidence:[""] (or all-whitespace entries) must count as no evidence at all — a bare
  // `.length === 0` check lets an empty string slip through as if something had been verified.
  const hasRealEvidence = evidence.some((entry) => entry.trim().length > 0);
  if (node.verification.kind !== "none" && !hasRealEvidence && node.verification.failClosed) {
    throw new Error(`Verification for ${nodeId} requires evidence`);
  }
  for (const artifactId of node.outputs) {
    const binding = run.artifactBindings.find((candidate) => candidate.artifactId === artifactId && candidate.attemptId === attempt.id);
    if (binding) binding.accepted = true;
  }
  attempt.evidence.push(...evidence);
  attempt.status = "succeeded";
  attempt.finishedAt = now;
  state.status = "succeeded";
  state.acceptedOutputFingerprint = sha256(
    node.outputs.map((id) => run.artifactBindings.find((binding) => binding.artifactId === id)?.fingerprint ?? "").join("|"),
  );
  state.blocker = undefined;
  if (verifiedBySessionId) state.verifiedBySessionId = verifiedBySessionId;
  run.updatedAt = now;
}

/** Content fingerprint for an environmental artifact: file bytes, or a sorted walk for a directory. */
function fingerprintWorkspacePath(target: string): string {
  const hash = createHash("sha256");
  const visit = (current: string, relative: string): void => {
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) return;
    hash.update(`${relative}\0${stat.size}\0`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(current).sort()) visit(path.join(current, name), path.posix.join(relative, name));
    } else if (stat.isFile()) hash.update(readFileSync(current));
  };
  visit(target, ".");
  return hash.digest("hex");
}

/**
 * Pre-existing material acceptance. Compile.ts turns declared reads into readiness inputs (the
 * 2026-08 reads-gate-readiness flip), and acceptance previously came only from a producing
 * attempt inside THIS run (reconcilePatch) or from lane-done seeding. That conflated two
 * different questions — "was this produced and verified during this run" and "does usable input
 * material exist" — and the conflation made a fresh business unstartable: the graph's base is an
 * artifact-level knot (orient-scaffold produces state/PROJECT_STATE.yaml but reads files whose
 * producers read state/PROJECT_STATE.yaml), so the compiled plan for the reference business had
 * ZERO ready nodes out of 82 on a clean bootstrap (found empirically 2026-08-19; the zero-callers
 * gap had hidden it — no session had ever run against a real business).
 *
 * The rule: a binding with NO producing attempt recorded in this run (`producedBy` unset), whose
 * bound file actually exists in the workspace, is pre-existing material — accepted, with a
 * content fingerprint, exactly as if the launch flow that authored it were an upstream run.
 * Invariants preserved, in the same spirit as reconcilePatch:
 * - acceptance is grounded in the file existing, never in anyone's prose claim about it;
 * - absent material stays unaccepted, and the reading node waits honestly;
 * - the moment a producer re-produces the artifact IN this run, reconcilePatch retakes the
 *   binding (producedBy set, acceptance false pending that node's own verification) — in-run
 *   production never rides in on this rule;
 * - pre-existing material that changed between sessions invalidates descendants transitively,
 *   the same staleness event as a re-produced output;
 * - a binding path that escapes the workspace is never accepted.
 *
 * Idempotent per session start; run.ts calls it after seeding or resuming, and the read-only
 * planner applies the same reconciliation in memory so its report matches what a session would do.
 */
export function reconcileEnvironmentalArtifacts(plan: CompiledPlan, run: RunStateDocument, workspaceRoot: string, now: string): RunNodeId[] {
  const resolvedRoot = path.resolve(workspaceRoot);
  const changed: string[] = [];
  let touched = false;
  for (const binding of run.artifactBindings) {
    if (binding.producedBy !== undefined) continue;
    const absolute = path.resolve(resolvedRoot, binding.path);
    if (absolute !== resolvedRoot && !absolute.startsWith(`${resolvedRoot}${path.sep}`)) continue;
    if (!existsSync(absolute)) continue;
    const fingerprint = fingerprintWorkspacePath(absolute);
    if (binding.accepted && binding.fingerprint === fingerprint) continue;
    if (binding.accepted && binding.fingerprint !== undefined && binding.fingerprint !== fingerprint) changed.push(binding.artifactId);
    binding.accepted = true;
    binding.fingerprint = fingerprint;
    touched = true;
  }
  if (touched) run.updatedAt = now;
  return changed.length > 0 ? invalidateDescendants(plan, run, changed, now) : [];
}

/**
 * Calendar-based reopening: the operating loop's missing half. The frontier deliberately treats
 * `succeeded` as terminal — correct for launch work, but the post-launch operating nodes carry a
 * standing cadence (weekly ops review, weekly growth iteration) that the knowledge docs demand
 * and check:post-launch enforces on wall-clock time, while the engine had no mechanism to
 * re-offer the work (2026-08-19 audit: the one legitimate way for the rhythm to stop is a
 * recorded Kill verdict, yet a succeeded node could never run again without a founder manually
 * poking it).
 *
 * A node with `recurrenceDays` whose last completed attempt finished more than that many days
 * before `now` reopens to `stale`. Its accepted output bindings are deliberately NOT touched:
 * reopening the weekly review must not invalidate everything downstream of last week's review —
 * if the re-run produces different content, reconcilePatch's ordinary staleness cascade handles
 * exactly that, and if it produces identical content nothing downstream moves. A node seeded
 * succeeded with no attempts (lane-done seeding on an imported mid-launch business) uses the
 * run's own creation time as its "last done", so the cadence starts counting from adoption
 * rather than never.
 */
export function reopenRecurringNodes(plan: CompiledPlan, run: RunStateDocument, now: string): RunNodeId[] {
  const reopened: RunNodeId[] = [];
  const nowMs = Date.parse(now);
  for (const node of plan.nodes) {
    if (!node.recurrenceDays || node.recurrenceDays <= 0) continue;
    const state = run.nodes[node.id];
    if (!state || state.status !== "succeeded") continue;
    const lastAttempt = state.attempts.at(-1);
    const lastDone = lastAttempt?.finishedAt ?? lastAttempt?.startedAt ?? run.createdAt;
    const elapsedDays = (nowMs - Date.parse(lastDone)) / 86_400_000;
    if (elapsedDays < node.recurrenceDays) continue;
    state.status = "stale";
    state.blocker = undefined;
    // acceptedOutputFingerprint and the output bindings stay: last cycle's accepted work remains
    // real (the execution boundary keeps exporting it) until the re-run's own acceptance
    // replaces it. Only the status reopens.
    reopened.push(node.id);
  }
  if (reopened.length > 0) run.updatedAt = now;
  return reopened;
}

/** Reopen dependencies that a downstream node requires fresh for each of its attempt cycles. */
export function refreshDependenciesBeforeFrontier(
  plan: CompiledPlan,
  run: RunStateDocument,
  now: string,
  allowedConsumerIds?: ReadonlySet<RunNodeId>,
): RunNodeId[] {
  const reopened: RunNodeId[] = [];
  const eligible = new Set<Status>(["pending", "ready", "stale"]);
  const accepted = new Set(run.artifactBindings.filter((binding) => binding.accepted).map((binding) => binding.artifactId));
  const lockedDependencies = new Set<RunNodeId>();
  for (const node of plan.nodes) {
    if (allowedConsumerIds && !allowedConsumerIds.has(node.id)) continue;
    const consumer = run.nodes[node.id];
    if (!consumer || !eligible.has(consumer.status)) continue;
    const cycles = new Set(consumer.dependencyRefreshCycles ?? []);
    for (const refresh of node.refreshDependencies) {
      if (cycles.has(`${refresh.nodeId}@${consumer.attempts.length}`)) lockedDependencies.add(refresh.nodeId);
    }
  }
  for (const node of plan.nodes) {
    if (allowedConsumerIds && !allowedConsumerIds.has(node.id)) continue;
    if (node.refreshDependencies.length === 0) continue;
    const consumer = run.nodes[node.id];
    if (!consumer || !eligible.has(consumer.status)) continue;
    const refreshIds = new Set(node.refreshDependencies.map((entry) => entry.nodeId));
    if (node.dependencies.some((dependencyId) => !refreshIds.has(dependencyId) && run.nodes[dependencyId]?.status !== "succeeded")) continue;
    const refreshOutputs = new Set(plan.nodes.filter((candidate) => refreshIds.has(candidate.id)).flatMap((candidate) => candidate.outputs));
    if (node.inputs.some((artifactId) => !refreshOutputs.has(artifactId) && !accepted.has(artifactId))) continue;
    const cycles = new Set(consumer.dependencyRefreshCycles ?? []);
    for (const refresh of node.refreshDependencies) {
      const dependencyId = refresh.nodeId;
      const token = `${dependencyId}@${consumer.attempts.length}`;
      if (cycles.has(token)) continue;
      if (lockedDependencies.has(dependencyId)) continue;
      const dependency = run.nodes[dependencyId];
      if (!dependency || dependency.status !== "succeeded") continue;
      const dependencyNode = plan.nodes.find((candidate) => candidate.id === dependencyId);
      if (!dependencyNode || dependency.attempts.length >= dependencyNode.maxAttempts) {
        consumer.status = "blocked";
        consumer.blocker = `Required refresh unavailable: "${dependencyNode?.title ?? dependencyId}" has no refresh attempts remaining.`;
        continue;
      }
      cycles.add(token);
      lockedDependencies.add(dependencyId);
      dependency.status = "stale";
      dependency.blocker = undefined;
      dependency.verifiedBySessionId = undefined;
      dependency.refreshInstructions = [refresh.instructions];
      for (const binding of run.artifactBindings) {
        if (!dependencyNode?.outputs.some((artifactId) => artifactId === binding.artifactId)) continue;
        if (binding.accepted && binding.fingerprint) binding.refreshBaselineFingerprint = binding.fingerprint;
        binding.accepted = false;
      }
      reopened.push(dependencyId);
    }
    consumer.dependencyRefreshCycles = [...cycles];
  }
  if (reopened.length > 0) run.updatedAt = now;
  return reopened;
}

/** Roll a failed scoped refresh back to its last accepted proof and reopen its consumers for a later scoped retry. */
export function restoreDependencyRefreshAfterFailure(plan: CompiledPlan, run: RunStateDocument, dependencyId: RunNodeId, now: string): boolean {
  const dependencyNode = plan.nodes.find((node) => node.id === dependencyId);
  const dependency = run.nodes[dependencyId];
  if (!dependencyNode || !dependency?.refreshInstructions?.length) return false;

  dependency.status = "succeeded";
  dependency.blocker = undefined;
  dependency.refreshInstructions = undefined;
  for (const artifactId of dependencyNode.outputs) {
    const binding = run.artifactBindings.find((candidate) => candidate.artifactId === artifactId);
    if (!binding || binding.refreshBaselineFingerprint === undefined) continue;
    binding.fingerprint = binding.refreshBaselineFingerprint;
    binding.accepted = true;
    binding.refreshBaselineFingerprint = undefined;
  }
  for (const consumerNode of plan.nodes) {
    if (!consumerNode.refreshDependencies.some((refresh) => refresh.nodeId === dependencyId)) continue;
    const consumer = run.nodes[consumerNode.id];
    if (!consumer?.dependencyRefreshCycles) continue;
    consumer.dependencyRefreshCycles = consumer.dependencyRefreshCycles.filter((cycle) => !cycle.startsWith(`${dependencyId}@`));
  }
  run.updatedAt = now;
  return true;
}

/** Staleness invalidation: a changed accepted input invalidates descendants transitively. */
export function invalidateDescendants(plan: CompiledPlan, run: RunStateDocument, changedArtifactIds: readonly string[], now: string): RunNodeId[] {
  const changed = new Set<string>(changedArtifactIds);
  const invalidated: RunNodeId[] = [];
  let advanced = true;

  while (advanced) {
    advanced = false;
    for (const node of plan.nodes) {
      const state = run.nodes[node.id];
      if (!state || state.status === "stale") continue;
      if (node.inputs.some((artifactId) => changed.has(artifactId))) {
        state.status = "stale";
        // A stale node will be re-examined and re-run; a blocker string from its previous life
        // ("Verification required", a park reason) would otherwise survive into digests and
        // pending-verification listings that key on blocker text.
        state.blocker = undefined;
        state.acceptedOutputFingerprint = undefined;
        // A scoped refresh token is valid only for the dependency result it opened. If that
        // dependency is invalidated and later re-produced generically, every consumer must earn
        // a new scoped cycle before it can enter the frontier.
        for (const consumerNode of plan.nodes) {
          if (!consumerNode.refreshDependencies.some((refresh) => refresh.nodeId === node.id)) continue;
          const consumerState = run.nodes[consumerNode.id];
          if (!consumerState?.dependencyRefreshCycles) continue;
          consumerState.dependencyRefreshCycles = consumerState.dependencyRefreshCycles.filter((cycle) => !cycle.startsWith(`${node.id}@`));
        }
        for (const artifactId of node.outputs) {
          changed.add(artifactId);
          const binding = run.artifactBindings.find((candidate) => candidate.artifactId === artifactId);
          if (binding) binding.accepted = false;
        }
        invalidated.push(node.id);
        advanced = true;
      }
    }
  }

  if (invalidated.length > 0) run.updatedAt = now;
  return invalidated;
}

/**
 * Session wall-clock deadline (KTD6), enforced independently of any single attempt's heartbeat
 * TTL. The cap bounds the CURRENT session, so the deadline is measured from the session's own
 * start — a resumed run must not inherit a prior session's elapsed clock (R2's bounded-session
 * contract; measuring from run.createdAt made every resume time out instantly).
 */
export function wallClockDeadline(run: RunStateDocument, sessionStartedAt: string = run.createdAt): string {
  return new Date(Date.parse(sessionStartedAt) + run.wallClockCapSeconds * 1000).toISOString();
}

export function isWallClockExceeded(run: RunStateDocument, now: string, sessionStartedAt: string = run.createdAt): boolean {
  return Date.parse(now) >= Date.parse(wallClockDeadline(run, sessionStartedAt));
}

/** Write to `<path>.tmp`, fsync, then rename — a reader never observes a partial write. */
function writeAtomic(targetPath: string, contents: string): void {
  mkdirSync(dirname(targetPath), { recursive: true });
  const tmpPath = `${targetPath}.tmp`;
  const fd = openSync(tmpPath, "w");
  try {
    writeSync(fd, contents);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmpPath, targetPath);
}

export function writeRunState(runStatePath: string, run: RunStateDocument): void {
  writeAtomic(runStatePath, `${JSON.stringify(run, null, 2)}\n`);
}

/** Re-loadable across processes (R1): reads and schema-validates, never trusts an unvalidated file. */
export function loadRunState(runStatePath: string): RunStateDocument {
  const parsed: unknown = JSON.parse(readFileSync(runStatePath, "utf8"));
  const result = validateRunState(parsed);
  if (!result.valid) throw new Error(`Invalid run state at ${runStatePath}: ${result.issues.map((issue) => issue.message).join("; ")}`);
  return result.value!;
}

export function buildCheckpoint(run: RunStateDocument, writerSessionId: string, stateHash: string, now: string): CheckpointDocument {
  return { schemaVersion: "1.0.0", writtenAt: now, writerSessionId, stateHash, runState: run };
}

export function writeCheckpoint(checkpointPath: string, checkpoint: CheckpointDocument): void {
  writeAtomic(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
}

export function loadCheckpoint(checkpointPath: string): CheckpointDocument {
  const parsed: unknown = JSON.parse(readFileSync(checkpointPath, "utf8"));
  const result = validateCheckpoint(parsed);
  if (!result.valid) throw new Error(`Invalid checkpoint at ${checkpointPath}: ${result.issues.map((issue) => issue.message).join("; ")}`);
  return result.value!;
}
