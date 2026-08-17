import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { validateCheckpoint, validateRunState } from "../schema/index.js";
import type { ArtifactBindingV2, AttemptRecordV2, BusinessStateV2, CheckpointDocument, RunNodeStateV2, RunStateDocument, Status } from "../schema/types.js";
import { sha256, type CompiledPlan, type RunNodeId } from "./compile.js";

/** A lane in one of these states means the workflows that own it are already done. */
const DONE_LANE_STATUSES: readonly Status[] = ["succeeded", "not_needed", "skipped"];

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

/** Apply durable scope verdicts before frontier selection. A verdict change invalidates old proof. */
export function reconcileWorkflowApplicability(plan: CompiledPlan, run: RunStateDocument, businessState: BusinessStateV2, now: string): void {
  for (const node of plan.nodes) {
    if (node.applicability.mode === "always") continue;
    const state = run.nodes[node.id];
    if (!state) continue;
    const record = businessState.workflowApplicability?.[node.workflowId];
    const fingerprint = sha256(JSON.stringify(record ?? { verdict: "unknown" }));
    if (state.applicabilityFingerprint === fingerprint) continue;

    for (const binding of run.artifactBindings.filter((item) => node.outputs.some((artifactId) => artifactId === item.artifactId))) {
      binding.accepted = false;
      binding.fingerprint = undefined;
      binding.producedBy = undefined;
      binding.attemptId = undefined;
    }
    state.acceptedOutputFingerprint = undefined;
    state.verifiedBySessionId = undefined;
    state.applicabilityFingerprint = fingerprint;
    if (!record) {
      state.status = "waiting_founder";
      state.blocker = `Scope answer needed: ${node.applicability.question}`;
    } else if (record.verdict === "not-needed") {
      state.status = "not_needed";
      state.blocker = `Not needed: ${record.reason}`;
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
    if (binding.accepted && binding.fingerprint !== output.fingerprint) changedAcceptedInputs.push(output.artifactId);
    binding.path = output.path;
    binding.fingerprint = output.fingerprint;
    binding.accepted = node.verification.kind === "none";
    binding.producedBy = node.id;
    binding.attemptId = attempt.id;
    attempt.evidence.push(...output.evidence);
  }

  attempt.finishedAt = now;
  attempt.status = node.verification.kind === "none" ? "succeeded" : "blocked";
  state.status = node.verification.kind === "none" ? "succeeded" : "blocked";
  state.blocker = node.verification.kind === "none" ? undefined : "Verification required";
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
        state.acceptedOutputFingerprint = undefined;
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
