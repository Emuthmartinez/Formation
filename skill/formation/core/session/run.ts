#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

import { isMainModule, parseArgs, resolveCallerPath } from "../lib/cli.js";
import { buildAuditPlan } from "../../tooling/lib/audit-plan.js";
import { runReducer, skillRoot, type ReducerResult } from "./reducer-cli.js";
import { acquireLock, heartbeat, releaseLock, type AcquireResult } from "../reducer/lock.js";
import type { PatchOp, PatchPath, StatePatch } from "../reducer/patch.js";
import { validateBudgetLedger, validateBusinessState, validateControl } from "../schema/index.js";
import { grantableDomainIds, type BudgetLedgerDocument, type BusinessStateV2, type ControlFile, type RunStateDocument } from "../schema/types.js";
import { compilePlan, type CatalogInput, type CompiledPlan, type CompiledRunNode, type RunNodeId } from "../engine/compile.js";
import { computeFrontier } from "../engine/frontier.js";
import { observeAppSourceFingerprint } from "../engine/source-fingerprint.js";
import { buildDispatchBatches, checkBatchBoundary, type BatchHaltReason, type DispatchHooks } from "../engine/dispatch.js";
import {
  acceptVerification,
  abandonDependencyRefreshesForConsumer,
  beginAttempt,
  detectOrphans,
  isWallClockExceeded,
  loadRunState,
  reconcileEnvironmentalArtifacts,
  reconcilePatch,
  reconcileWorkflowApplicability,
  refreshHeartbeat,
  reopenRecurringNodes,
  refreshDependenciesBeforeFrontier,
  deferDependencyRefreshAfterFailure,
  seedRunState,
  writeRunState,
  buildCheckpoint,
  writeCheckpoint,
  type OrphanEvent,
} from "../engine/runstate.js";
import { createAutonomyEvaluator, type AutonomyDecisionDetail, type AutonomyEvaluatorV2 } from "../autonomy/evaluator.js";
import { createDispatchHooks } from "../autonomy/killswitch.js";
import { domainBusinessUnit } from "../autonomy/budget.js";
import { createCompositeVerifier } from "../autonomy/prerequisites.js";
import { createDopplerAuthVerifier } from "../autonomy/probes/doppler.js";
import { createBudgetFundedVerifier } from "../autonomy/probes/budget.js";
import { verifyControlBoundary, type ControlBoundaryVerdict } from "../adapters/install-control-permissions.js";
import { applyStandingApprovals } from "../autonomy/standing-approvals.js";

import { listPendingFreshContext, refuseFreshContextAcceptance, VERIFICATION_REJECTED_BLOCKER } from "../engine/verification.js";
import { appendAuditEntry } from "../reducer/audit.js";
import { BriefInvalid, loadBrief, nodeInScope, type SessionBrief } from "./brief.js";
import {
  createCliExecutor,
  createCliVerifier,
  createFixtureExecutor,
  createFixtureVerifier,
  createSlowSilentExecutor,
  noOpExecutor,
  type NodeExecutor,
  type NodeVerifier,
  type WorkerRuntime,
} from "./executor.js";
import type { VerifierOutputRef } from "./worker-prompt.js";
import {
  formatAge,
  pushDigest,
  renderDigest,
  translateHaltReason,
  translateParkReason,
  writeDigestFile,
  type DigestAdvancedItem,
  type DigestAnomaly,
  type DigestInput,
  type DigestOutcome,
  type DigestParkedItem,
  type DigestSpendLine,
} from "./digest.js";

/**
 * The scheduled-session runner (R1, R2, R16; the KTD1 headless CLI shape). Bounded, single-run,
 * exits every time: acquire the workspace-wide advisory lock, preflight for out-of-band tamper,
 * honor the kill switch, seed/resume run state, dispatch within grants+budget, and — on every
 * exit path, success or failure — write a founder-plain digest before releasing the lock. Sessions
 * never reach around the reducer: any state this runner changes on the five reducer-owned
 * documents (business-state/control/grants/waivers/budget-ledger) goes through core/reducer/cli.ts
 * as a subprocess, never a direct write.
 *
 * Exit codes mirror the reducer's own convention for consistency across the two CLIs a scheduler
 * invokes: 0 = ran (whatever the outcome — the digest tells the real story), 1 = the workspace
 * isn't usable (missing/invalid required documents, or an unexpected internal error), 2 = did not
 * run (lock contention — "back off and report" per R13), 3 = preflight/tamper failure (R14).
 */

export interface WorkspacePaths {
  readonly root: string;
  readonly state: string;
  readonly control: string;
  readonly ledger: string;
  readonly manifest: string;
  readonly audit: string;
  readonly sessionLock: string;
  readonly catalog: string;
  readonly runState: string;
  readonly checkpoint: string;
  readonly agentOperations: string;
}

export function resolveWorkspacePaths(root: string, catalogOverride?: string): WorkspacePaths {
  return {
    root,
    state: path.join(root, "state", "business-state.json"),
    control: path.join(root, "control", "control.json"),
    ledger: path.join(root, "control", "budget-ledger.json"),
    manifest: path.join(root, "control", "manifest.json"),
    audit: path.join(root, "control", "audit.jsonl"),
    sessionLock: path.join(root, "control", "session.lock"),
    catalog: catalogOverride ?? path.join(root, "catalog.json"),
    runState: path.join(root, "run", "run-state.json"),
    checkpoint: path.join(root, "run", "checkpoint.json"),
    agentOperations: path.join(root, "operations", "agent-operations.json"),
  };
}

let patchSequence = 0;
function nextPatchId(sessionId: string): string {
  patchSequence += 1;
  return `patch.${sessionId}.${patchSequence}`;
}

/**
 * The session's tamper backstop (R14): the reducer's manifest preflight confirms none of the five
 * reducer-owned documents changed outside the reducer since the last commit, and verify-audit
 * confirms the hash-chained audit log's chain is intact. Run at session start AND at every batch
 * boundary so a same-session out-of-band edit is caught before the next batch, not next session.
 * Note: this DETECTS out-of-band mutation; it does not by itself PREVENT a Bash-capable session
 * from invoking the reducer — see the reducer's founder-authority gate and the OS-permission
 * requirement in the workspace AGENTS.md for the prevention layers.
 */
function tamperCheckPasses(paths: WorkspacePaths): boolean {
  if (runReducer(["preflight", "--manifest", paths.manifest]).code !== 0) return false;
  if (existsSync(paths.audit) && runReducer(["verify-audit", "--audit", paths.audit]).code !== 0) return false;
  return true;
}

interface GateOutcome {
  readonly allPassed: boolean;
  readonly evidence: string[];
}

/**
 * Run a node's deterministic gates (npm `check:*`/`validate:*` scripts from the skill package)
 * against the business workspace. A gate that exits non-zero — or cannot run at all — counts as
 * not-passed, never as accepted.
 *
 * Argument shapes come from the audit plan, the one place that already knows how every gate's
 * CLI is invoked (--root/--state/--skill-root and friends), with the business root swapped for
 * this workspace as absolute paths. A bare BUSINESS_ROOT env var is still set, but it is no
 * longer the only signal: gates like check:design-room take --root argv only, and before this
 * they either failed against the wrong directory or silently validated the skill's own
 * reference workspace instead of the business under test (caught by check:engine-e2e,
 * 2026-08-19). A gate the audit plan does not know keeps the env-only behavior.
 */
function runDeterministicGates(gateIds: readonly string[], workspaceDir: string): GateOutcome {
  // The audit's own renderer steps redirect output to /tmp scratch (--out) and skip the full
  // build (--static-only) because the audit only proves the render works. As a NODE's gate the
  // render IS the node's output, so those audit-only redirections are stripped and the gate
  // writes into the workspace exactly as it did before this reuse.
  const stripAuditOnlyFlags = (args: readonly string[]): string[] => {
    const kept: string[] = [];
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index]!;
      if (arg === "--out") {
        index += 1;
        continue;
      }
      if (arg === "--static-only") continue;
      kept.push(arg);
    }
    return kept;
  };
  const planArgs = new Map(
    buildAuditPlan("repo", { businessRoot: path.resolve(workspaceDir), skillRoot: skillRoot() }).map((step) => [step.id, stripAuditOnlyFlags(step.args ?? [])]),
  );
  const evidence: string[] = [];
  for (const gate of gateIds) {
    const gateArgs = planArgs.get(gate);
    const result = spawnSync("npm", ["run", "--prefix", skillRoot(), gate, ...(gateArgs && gateArgs.length > 0 ? ["--", ...gateArgs] : [])], {
      cwd: workspaceDir,
      encoding: "utf8",
      env: { ...process.env, BUSINESS_ROOT: workspaceDir },
      timeout: 120_000,
    });
    const passed = result.status === 0;
    evidence.push(`gate:${gate}=${passed ? "passed" : `exit ${result.status ?? "spawn-error"}`}`);
    if (!passed) return { allPassed: false, evidence };
  }
  return { allPassed: true, evidence };
}

function commitPatch(targetFile: string, paths: WorkspacePaths, sessionId: string, patch: StatePatch): ReducerResult {
  return runReducer(["commit", "--file", targetFile, "--manifest", paths.manifest, "--audit", paths.audit, "--session", sessionId], JSON.stringify(patch));
}

function tryLoadJson(filePath: string): unknown | undefined {
  if (!existsSync(filePath)) return undefined;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return undefined;
  }
}

/**
 * The four workspace loaders below are exported so core/session/plan.ts reads a workspace exactly
 * the way a real session does. A second, private copy in the read-only planner is the one thing
 * that would make its report diverge from what an actual run would then do — and a planner that
 * disagrees with the runner is worse than no planner.
 */
export function loadControlFile(controlPath: string): ControlFile | undefined {
  const raw = tryLoadJson(controlPath);
  if (raw === undefined) return undefined;
  const result = validateControl(raw);
  return result.valid ? result.value : undefined;
}

export function loadBusinessStateFile(statePath: string): BusinessStateV2 | undefined {
  const raw = tryLoadJson(statePath);
  if (raw === undefined) return undefined;
  const result = validateBusinessState(raw);
  return result.valid ? result.value : undefined;
}

function emptyLedger(now: string): BudgetLedgerDocument {
  return { schemaVersion: "1.0.0", updatedAt: now, balances: [], entries: [] };
}

/** A business that hasn't set up a budget yet is a legitimate state, not an error — spend nodes simply park (autonomy.budget_unfunded). */
export function loadLedgerFile(ledgerPath: string, now: string): BudgetLedgerDocument {
  const raw = tryLoadJson(ledgerPath);
  if (raw === undefined) return emptyLedger(now);
  const result = validateBudgetLedger(raw);
  return result.valid ? result.value! : emptyLedger(now);
}

export function loadCatalogFile(catalogPath: string): CatalogInput {
  const raw = tryLoadJson(catalogPath) as CatalogInput | undefined;
  return raw ?? { version: "catalog.empty", artifacts: [], workflows: [] };
}

/** Hook used by installed briefs/CI to reject a stale or substituted executable catalog. */
export function assertCatalogCompatibility(catalog: CatalogInput, expectedVersion?: string): void {
  if (!catalog.version || catalog.version === "catalog.empty") throw new Error("catalog.version_missing: executable catalog is missing or invalid");
  if (expectedVersion && catalog.version !== expectedVersion) throw new Error(`catalog.version_stale: expected ${expectedVersion}, found ${catalog.version}`);
}

/** Load the installer-owned catalog version automatically; a present but incomplete binding fails closed. */
export function runtimeCatalogVersion(workspace: string): string | undefined {
  const manifestPath = path.join(workspace, ".b2c-launch", "runtime.json");
  if (!existsSync(manifestPath)) return undefined;
  const manifest = tryLoadJson(manifestPath);
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("catalog.runtime_binding_invalid: runtime.json is not an object");
  const version = (manifest as Record<string, unknown>).catalogVersion;
  if (typeof version !== "string" || !version.trim()) {
    throw new Error("catalog.runtime_binding_stale: runtime.json has no catalogVersion; refresh the installed entrypoints");
  }
  return version;
}

/** Records evaluator.evaluate()'s full decision detail per node id as frontier examines it, so the digest can translate the *precise* reasonCode rather than a generic fallback. */
function withCapture(inner: AutonomyEvaluatorV2, sink: Map<string, AutonomyDecisionDetail>): AutonomyEvaluatorV2 {
  return {
    evaluate(node: CompiledRunNode): AutonomyDecisionDetail {
      const detail = inner.evaluate(node);
      sink.set(node.id, detail);
      return detail;
    },
  };
}

/**
 * The reducer's fail-closed join rejects a patch whose declared output didn't actually change
 * (patch.declared_output_missing) — and committed/spent can trade places while remaining stays
 * numerically invariant (e.g. committed 25→0, spent 0→25, remaining 975→975). This only ever
 * declares (and only ever sets) a balance field that is genuinely different, so the always-touched
 * `updatedAt` timestamp is the one guaranteed change per commit.
 */
function pushIfChanged(ops: PatchOp[], declaredOutputs: PatchPath[], path: PatchPath, before: number, after: number): void {
  if (before === after) return;
  ops.push({ op: "set", path, value: after });
  declaredOutputs.push(path);
}

/** Estimate ledger entry + balance decrement, committed via the reducer (never a direct write) — R10's "hard-stop before, actuals after" estimate half. */
function buildEstimatePatch(
  ledger: BudgetLedgerDocument,
  node: CompiledRunNode,
  decision: AutonomyDecisionDetail,
  sessionId: string,
  now: string,
): { patch: StatePatch; entryId: string } | undefined {
  if (
    decision.estimateAmount === undefined ||
    decision.budgetUnit === undefined ||
    decision.budgetPeriod === undefined ||
    decision.estimateCurrency === undefined
  )
    return undefined;
  const entryId = `ledger.${sessionId}.${randomUUID().slice(0, 8)}`;
  const entry = {
    id: entryId,
    unit: decision.budgetUnit,
    domainId: node.domainId,
    nodeRef: node.id,
    period: decision.budgetPeriod,
    estimate: { amount: decision.estimateAmount, currency: decision.estimateCurrency, declaredAt: now },
    actual: null,
    status: "estimated",
    ...(decision.waiverId ? { waiverRef: decision.waiverId } : {}),
    auditRef: `audit.${entryId}`,
  };
  const ops: PatchOp[] = [{ op: "append", path: ["entries"], value: entry }];
  const declaredOutputs: PatchPath[] = [["entries"]];
  const balanceIndex = ledger.balances.findIndex((balance) => balance.unit === decision.budgetUnit && balance.period === decision.budgetPeriod);
  if (balanceIndex >= 0) {
    const balance = ledger.balances[balanceIndex]!;
    const committed = balance.committed + decision.estimateAmount;
    const remaining = balance.allocated - committed - balance.spent;
    pushIfChanged(ops, declaredOutputs, ["balances", String(balanceIndex), "committed"], balance.committed, committed);
    pushIfChanged(ops, declaredOutputs, ["balances", String(balanceIndex), "remaining"], balance.remaining, remaining);
    ops.push({ op: "set", path: ["balances", String(balanceIndex), "updatedAt"], value: now });
    declaredOutputs.push(["balances", String(balanceIndex), "updatedAt"]);
  }
  return {
    entryId,
    patch: {
      schemaVersion: "1.0.0",
      patchId: nextPatchId(sessionId),
      targetDoc: "budget-ledger",
      reason: `Recording estimated spend for ${node.title}`,
      authoredBy: sessionId,
      authoredAt: now,
      preconditions: [],
      ops,
      declaredOutputs,
    },
  };
}

/**
 * Actual recording after execution. The fixture/no-op executors carry no cost-reporting field
 * (NodeExecutionResult is {status, outputs, evidence, error?} per the U5 contract), so the actual
 * is recorded equal to the estimate — a deliberate, named placeholder until U6's real executor can
 * report a true actual.
 */
function buildActualPatch(
  ledger: BudgetLedgerDocument,
  entryId: string,
  node: CompiledRunNode,
  decision: AutonomyDecisionDetail,
  sessionId: string,
  now: string,
): StatePatch | undefined {
  if (decision.estimateAmount === undefined || decision.budgetUnit === undefined || decision.estimateCurrency === undefined) return undefined;
  const entryIndex = ledger.entries.findIndex((entry) => entry.id === entryId);
  if (entryIndex < 0) return undefined;
  const amount = decision.estimateAmount;
  const ops: PatchOp[] = [
    { op: "set", path: ["entries", String(entryIndex), "actual"], value: { amount, currency: decision.estimateCurrency, recordedAt: now } },
    { op: "set", path: ["entries", String(entryIndex), "status"], value: "actualized" },
  ];
  const declaredOutputs: PatchPath[] = [
    ["entries", String(entryIndex), "actual"],
    ["entries", String(entryIndex), "status"],
  ];
  const balanceIndex = ledger.balances.findIndex((balance) => balance.unit === decision.budgetUnit && balance.period === decision.budgetPeriod);
  if (balanceIndex >= 0) {
    const balance = ledger.balances[balanceIndex]!;
    const committed = Math.max(0, balance.committed - amount);
    const spent = balance.spent + amount;
    const remaining = balance.allocated - committed - spent;
    pushIfChanged(ops, declaredOutputs, ["balances", String(balanceIndex), "committed"], balance.committed, committed);
    pushIfChanged(ops, declaredOutputs, ["balances", String(balanceIndex), "spent"], balance.spent, spent);
    pushIfChanged(ops, declaredOutputs, ["balances", String(balanceIndex), "remaining"], balance.remaining, remaining);
    ops.push({ op: "set", path: ["balances", String(balanceIndex), "updatedAt"], value: now });
    declaredOutputs.push(["balances", String(balanceIndex), "updatedAt"]);
  }
  return {
    schemaVersion: "1.0.0",
    patchId: nextPatchId(sessionId),
    targetDoc: "budget-ledger",
    reason: `Recording actual spend for ${node.title}`,
    authoredBy: sessionId,
    authoredAt: now,
    preconditions: [],
    ops,
    declaredOutputs,
  };
}

function orphanSentence(event: OrphanEvent, title: string): string {
  return event.resolution === "ready"
    ? `"${title}" didn't finish cleanly last session — I'll try it again this time.`
    : `"${title}" didn't finish cleanly last session, and I can't safely retry it blind — I need to check what actually happened before touching it again.`;
}

/**
 * computeFrontier() only ever returns the current ready frontier, not the full dependency
 * closure, so a scoped session's own entry chain can be permanently stuck: an in-scope node
 * whose only unmet dependency sits in a different, out-of-scope domain never becomes ready at
 * all, and the dispatch loop used to just break with no explanation once scope-filtering emptied
 * readyIds. This walks the dependency chain from every not-yet-succeeded in-scope node (not just
 * the current ready set) to find the titles of out-of-scope nodes actually blocking it, so that
 * case can be reported by name instead of silently doing nothing.
 *
 * This deliberately does NOT flag an out-of-scope node that happens to be ready but isn't a
 * dependency of anything in scope -- that is ordinary parallel work for a different session, not
 * a blocker, and a scoped session correctly leaves it untouched without comment (see
 * "session: scope hints restrict this session..." in verification/fixtures/session.fixtures.ts).
 */
function findOutOfScopeBlockers(plan: CompiledPlan, run: RunStateDocument, scopeHints: readonly string[]): string[] {
  const nodesById = new Map(plan.nodes.map((node) => [node.id, node]));
  const blockingTitles = new Set<string>();
  const visited = new Set<string>();

  const walk = (nodeId: RunNodeId): void => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = nodesById.get(nodeId);
    if (!node) return;
    for (const dependencyId of node.dependencies) {
      if (run.nodes[dependencyId]?.status === "succeeded") continue;
      const dependencyNode = nodesById.get(dependencyId);
      if (!dependencyNode) continue;
      if (nodeInScope(scopeHints, dependencyNode.domainId, dependencyNode.workflowId)) {
        walk(dependencyId);
      } else {
        blockingTitles.add(dependencyNode.title);
      }
    }
  };

  for (const node of plan.nodes) {
    if (run.nodes[node.id]?.status === "succeeded") continue;
    if (!nodeInScope(scopeHints, node.domainId, node.workflowId)) continue;
    walk(node.id);
  }

  return [...blockingTitles];
}

/**
 * Layer 3 disclosure, never a gate (R14/AGENTS.md "Autonomy Trust Boundary"): once any granted
 * business unit sits above the lowest level, the founder is relying on control/'s OS write
 * protection to make that grant a real limit rather than a suggestion. If verifyControlBoundary
 * hasn't proven that boundary is genuinely `enforced`, the founder is told in plain terms — this
 * never blocks dispatch, and stays silent when every grant is at the lowest level (nothing to
 * disclose). Pure and exported so it's testable without spawning a session subprocess; run.ts's
 * own main() is the only caller in production.
 */
export function buildControlBoundaryAnomaly(control: ControlFile, verdict: ControlBoundaryVerdict, command: string): DigestAnomaly | undefined {
  if (verdict.state === "enforced") return undefined;
  const units = new Set<string>();
  for (const domainId of grantableDomainIds) {
    const grant = control.grants[domainId];
    if (!grant || grant.level === "review-first") continue;
    units.add(domainBusinessUnit(domainId));
  }
  if (units.size === 0) return undefined;
  const unitList = [...units].sort().join(", ");
  return {
    message: `I'm set up to act on my own for ${unitList}, but the folder that holds those permissions isn't locked down yet, so those limits are guidance rather than a hard stop. Here's the one command that fixes it: ${command}`,
  };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const missing = ["workspace", "brief", "session"].filter((name) => !args[name]);
  if (missing.length > 0) {
    console.error(`session.missing_argument: --${missing.join(", --")} ${missing.length === 1 ? "is" : "are"} required`);
    return 1;
  }

  const workspace = resolveCallerPath(args.workspace!);
  const paths = resolveWorkspacePaths(workspace, args.catalog ? path.resolve(args.catalog) : undefined);
  // runstate.ts's writeAtomic (unlike the reducer's writer) does not create parent directories.
  mkdirSync(path.dirname(paths.runState), { recursive: true });
  const sessionId = args.session!;
  const startedAt = args.now ?? new Date().toISOString();
  let executor: NodeExecutor = noOpExecutor;
  const maxConcurrency = Number(args["max-concurrency"] ?? 4);

  let lockAcquired = false;
  let brief: SessionBrief | undefined;
  const anomalies: DigestAnomaly[] = [];

  const finish = async (
    outcome: DigestOutcome,
    extra: { advanced?: DigestAdvancedItem[]; parked?: DigestParkedItem[]; spend?: DigestSpendLine[] } = {},
    exitCode = 0,
  ): Promise<number> => {
    const endedAt = new Date().toISOString();
    const businessSlug = brief?.businessSlug ?? path.basename(workspace);
    const input: DigestInput = {
      sessionId,
      businessSlug,
      startedAt,
      endedAt,
      outcome,
      advanced: extra.advanced ?? [],
      parked: extra.parked ?? [],
      spend: extra.spend ?? [],
      anomalies,
    };
    const rendered = renderDigest(input);
    const to = brief?.founderContact.email;
    if (to) {
      const push = await pushDigest(rendered, to);
      if (push.attempted && push.ok === false)
        anomalies.push({
          message: `I tried to email you this update and it didn't go through (${push.error ?? "an unknown error"}). It's still saved in this business's digests folder.`,
        });
      input.push = push;
    } else {
      input.push = { attempted: false, skippedReason: "no founder contact on file" };
    }
    const final = renderDigest(input);
    writeDigestFile(workspace, sessionId, final.markdown);
    if (lockAcquired) {
      try {
        releaseLock(paths.sessionLock, sessionId);
      } catch {
        /* best effort: a digest was written regardless */
      }
    }
    return exitCode;
  };

  try {
    try {
      brief = loadBrief(resolveCallerPath(args.brief!));
    } catch (error) {
      const reason = error instanceof BriefInvalid ? error.issues.join("; ") : error instanceof Error ? error.message : String(error);
      anomalies.push({ message: `I couldn't read the session instructions I was given (${reason}), so I stopped before touching anything.` });
      return await finish("workspace_not_ready", {}, 1);
    }

    const executorMode = args.executor ?? "auto";
    const workerRuntime = (args["worker-runtime"] ?? brief.workerRuntime ?? process.env.B2C_WORKER_RUNTIME ?? "auto") as WorkerRuntime;
    executor =
      executorMode === "fixture"
        ? createFixtureExecutor()
        : executorMode === "slow-silent"
          ? createSlowSilentExecutor(Number(args["slow-delay-ms"] ?? 2000))
          : executorMode === "noop"
            ? noOpExecutor
            : createCliExecutor(workerRuntime);
    // Fresh-context verification is part of a session, not a separate ceremony someone must
    // remember: the sweep below dispatches an independent judge for produced-but-unaccepted work.
    // "off" is an explicit diagnostic override and is reported honestly in the digest — before
    // this seam existed, every fresh-context node was a structural dead end (produced, parked
    // "Verification required" forever) while the digest implied a check was underway.
    // The default FOLLOWS the executor mode: a diagnostic session (fixture/slow-silent/noop
    // executor) must never quietly spawn a real worker CLI to judge synthetic work — on a
    // machine with codex/claude installed that would make fixture runs slow, nondeterministic,
    // and silently expensive. Only a real session defaults to the real verifier.
    const verifierMode = args.verifier ?? (executorMode === "fixture" ? "fixture" : executorMode === "auto" ? "cli" : "off");
    const verifier: NodeVerifier | undefined =
      verifierMode === "off"
        ? undefined
        : verifierMode === "fixture"
          ? createFixtureVerifier()
          : verifierMode === "fixture-reject"
            ? createFixtureVerifier("rejected")
            : createCliVerifier(workerRuntime);

    const lockTtlSeconds = Number(args["lock-ttl-seconds"] ?? 120);
    const acquireResult: AcquireResult = acquireLock(paths.sessionLock, {
      ownerSessionId: sessionId,
      ttlSeconds: lockTtlSeconds,
      retries: Number(args["lock-retries"] ?? 3),
      retryDelayMs: Number(args["lock-retry-delay-ms"] ?? 100),
      breakStale: args["break-stale-verified"] === "true",
    });
    if (!acquireResult.ok) {
      const outcome: DigestOutcome = acquireResult.reason === "held" ? "did_not_run_lock_held" : "did_not_run_lock_stale";
      anomalies.push({
        message: `Another session (or one that may not have shut down cleanly) already had this business locked, so I backed off rather than risk a collision.`,
      });
      return await finish(outcome, {}, 2);
    }
    lockAcquired = true;

    if (!tamperCheckPasses(paths)) {
      anomalies.push({
        message:
          "This business's saved files don't match what I last recorded — something changed them outside of my normal process. I stopped before making anything worse.",
      });
      return await finish("preflight_failed", {}, 3);
    }

    const control = loadControlFile(paths.control);
    if (!control) {
      anomalies.push({ message: "This business isn't set up yet — I couldn't find its control settings." });
      return await finish("workspace_not_ready", {}, 1);
    }

    // Disclosure, not a gate (see buildControlBoundaryAnomaly's doc comment): evaluated every
    // session, before dispatch and before the kill switch even short-circuits, so a standing
    // configuration gap is surfaced regardless of whether work happens this run.
    const boundaryVerdict = verifyControlBoundary(workspace);
    const boundaryCommand = `tsx ${path.join(skillRoot(), "core/adapters/install-control-permissions.ts")} --workspace ${workspace} --apply`;
    const boundaryAnomaly = buildControlBoundaryAnomaly(control, boundaryVerdict, boundaryCommand);
    if (boundaryAnomaly) {
      // Technical detail stays in the run log; the digest only ever gets the founder-plain sentence.
      console.error(
        `session.control_boundary: state=${boundaryVerdict.state} agentUidDiffers=${boundaryVerdict.agentUidDiffers} mode=${boundaryVerdict.controlMode} ownerUid=${boundaryVerdict.ownerUid} processUid=${boundaryVerdict.processUid} reasons=${JSON.stringify(boundaryVerdict.reasons)}`,
      );
      anomalies.push(boundaryAnomaly);
    }

    if (control.killSwitch.engaged) {
      return await finish("parked_kill_switch", {}, 0);
    }

    const businessState = loadBusinessStateFile(paths.state);
    if (!businessState) {
      anomalies.push({ message: "This business isn't set up yet — I couldn't find its saved progress." });
      return await finish("workspace_not_ready", {}, 1);
    }

    const sessionNow = () => new Date().toISOString();
    let ledger = loadLedgerFile(paths.ledger, startedAt);
    const catalog = loadCatalogFile(paths.catalog);
    const explicitCatalogVersion = brief.expectedCatalogVersion ?? process.env.B2C_EXPECTED_CATALOG_VERSION;
    const installedCatalogVersion = runtimeCatalogVersion(workspace);
    if (explicitCatalogVersion && installedCatalogVersion && explicitCatalogVersion !== installedCatalogVersion) {
      throw new Error(`catalog.version_binding_conflict: brief expected ${explicitCatalogVersion}, installed runtime expected ${installedCatalogVersion}`);
    }
    assertCatalogCompatibility(catalog, explicitCatalogVersion ?? installedCatalogVersion);
    const plan = compilePlan(catalog, startedAt);

    // budget_funded closes over this ledger snapshot (captured once, before dispatch starts) —
    // see core/autonomy/probes/budget.ts's doc comment on why a snapshot is the correct semantics
    // for a "verified at most once per session" prerequisite, not a live-reread.
    const prerequisiteVerifier = createCompositeVerifier({
      doppler_auth: createDopplerAuthVerifier({
        project: args["doppler-project"] ?? control.businessSlug,
        config: args["doppler-config"] ?? "production",
        secretsMdPath: args["secrets-md"] ?? path.join(workspace, "SECRETS.md"),
      }),
      budget_funded: createBudgetFundedVerifier(ledger),
    });

    const wallClockCapSeconds = Number(args["wall-clock-seconds"] ?? brief.wallClockSecondsOverride ?? 1800);

    let run = (() => {
      try {
        const existing = loadRunState(paths.runState);
        if (existing.planId !== plan.planId) {
          anomalies.push({ message: "The plan of work changed since last time, so I started a fresh one rather than force the old one to fit." });
          return undefined;
        }
        return existing;
      } catch {
        return undefined;
      }
    })();

    let orphanEvents: OrphanEvent[] = [];
    if (run) {
      run.ownerSessionId = sessionId;
      run.wallClockCapSeconds = wallClockCapSeconds;
      orphanEvents = detectOrphans(plan, run, startedAt);
      for (const event of orphanEvents) {
        const title = plan.nodes.find((node) => node.id === event.nodeId)?.title ?? event.nodeId;
        anomalies.push({ message: orphanSentence(event, title) });
      }
    } else {
      run = seedRunState(plan, businessState, { ownerSessionId: sessionId, ttlSeconds: 300, wallClockCapSeconds, now: startedAt });
    }
    // Producer-less artifacts (the workspace's own files) accept from disk presence — without
    // this, a fresh business's plan has no root nodes at all. Runs on resume too, so a
    // precondition that changed between sessions invalidates its descendants before dispatch.
    reconcileEnvironmentalArtifacts(plan, run, workspace, startedAt);
    // The operating loop: recurring nodes (weekly ops review, growth iteration) whose cadence
    // has elapsed reopen before the frontier is computed, so a scheduled session finds the
    // standing work on its own calendar instead of the founder having to re-ask for it.
    reopenRecurringNodes(plan, run, startedAt);
    observeAppSourceFingerprint(plan, run, workspace, startedAt);
    writeRunState(paths.runState, run);

    const dispatchHooks: DispatchHooks = createDispatchHooks({
      loadControl: () => loadControlFile(paths.control)!,
      lockPath: paths.sessionLock,
      ownerSessionId: sessionId,
    });
    // Pass the ledger as a live accessor, not a snapshot: `ledger` is reassigned after every
    // spend commit below, and the evaluator must see the true remaining balance so independently
    // scoped spend nodes cannot each pass the hard-stop while collectively overrunning the budget (R10).
    const evaluator = createAutonomyEvaluator({
      grants: control.grants,
      waivers: control.waivers,
      ledger: () => ledger,
      prerequisiteVerifier,
      runId: run.runId,
    });
    const decisions = new Map<string, AutonomyDecisionDetail>();
    const captured = withCapture(evaluator, decisions);

    const advanced: DigestAdvancedItem[] = [];
    let haltReason: BatchHaltReason | undefined;
    let timedOut = false;

    /**
     * Fresh-context verification sweep, run at every empty-frontier point inside the dispatch
     * loop: an accepted node re-opens the frontier, so downstream work dispatches in THIS
     * session instead of parking until the next one. The judge is a separate verifier session
     * id that owns no attempts (the same refusal rules core/session/verify.ts enforces, from the
     * shared module), its worker runs in a fresh subprocess context, and every acceptance is
     * attested in the hash-chained audit log exactly like the operator CLI's. Terminates: an
     * accepted node leaves the pending pool; rejected and unavailable nodes don't count as
     * progress, so the caller breaks rather than sweeping again.
     */
    const verifierSessionId = `${sessionId}.verifier`;
    const scopedRefreshDependencyIds = new Set<RunNodeId>();
    const failedScopedRefreshDependencyIds = new Set<RunNodeId>();
    const runVerificationSweep = async (): Promise<number> => {
      if (!verifier) return 0;
      const pending = listPendingFreshContext(plan, run).filter((nodeId) => {
        const node = plan.nodes.find((candidate) => candidate.id === nodeId)!;
        return nodeInScope(brief!.scopeHints, node.domainId, node.workflowId) || scopedRefreshDependencyIds.has(nodeId);
      });
      let accepted = 0;
      for (const nodeId of pending) {
        if (isWallClockExceeded(run, sessionNow(), startedAt)) {
          timedOut = true;
          break;
        }
        let boundary;
        try {
          boundary = checkBatchBoundary(dispatchHooks);
        } catch {
          haltReason = "kill_switch";
          break;
        }
        if (boundary.halt) {
          haltReason = boundary.reason;
          break;
        }
        heartbeat(paths.sessionLock, sessionId);
        const node = plan.nodes.find((candidate) => candidate.id === nodeId)!;
        const state = run.nodes[nodeId]!;
        const attempt = state.attempts.at(-1);
        const refusal = refuseFreshContextAcceptance(plan, run, nodeId, verifierSessionId);
        if (refusal) {
          // The sweep listed this node moments ago, so a refusal here is an internal
          // inconsistency worth an operator's eyes — never silently skipped.
          console.error(`session.verify_refused ${nodeId}: ${refusal.code}: ${refusal.message}`);
          continue;
        }
        const outputs: VerifierOutputRef[] = node.outputs.map((artifactId) => {
          const binding = run.artifactBindings.find((candidate) => candidate.artifactId === artifactId);
          return { artifactId, path: binding?.path ?? "", evidence: attempt?.evidence ?? [] };
        });
        const outcome = await verifier.verify(node, { workspaceDir: workspace, skillRootDir: skillRoot(), outputs, now: sessionNow() });
        const judgedAt = sessionNow();
        if (outcome.status === "accepted") {
          try {
            acceptVerification(plan, run, nodeId, [outcome.evidence], judgedAt, verifierSessionId);
          } catch (error) {
            console.error(`session.verify_accept_failed ${nodeId}: ${error instanceof Error ? error.message : String(error)}`);
            continue;
          }
          appendAuditEntry(paths.audit, {
            sessionId: verifierSessionId,
            targetDoc: "run-state",
            patchId: `verify:${verifierSessionId}:${nodeId}`,
            action: "verification_accepted",
            summary: `${nodeId}: ${outcome.evidence}`,
            stateHash: "",
            issueCodes: [],
          });
          advanced.push({ nodeId, title: node.title, unit: domainBusinessUnit(node.domainId) });
          accepted += 1;
        } else if (outcome.status === "rejected") {
          attempt?.evidence.push(outcome.evidence);
          state.blocker = VERIFICATION_REJECTED_BLOCKER;
          run.updatedAt = judgedAt;
          anomalies.push({
            message: `I had "${node.title}" double-checked and the check didn't agree it's finished, so I'm leaving it parked for another look.`,
          });
        } else {
          // Unavailable judged nothing: the node keeps its "Verification required" blocker so a
          // future session's sweep (or the operator CLI) picks it up, and this session says so.
          console.error(`session.verifier_unavailable ${nodeId}: ${outcome.error ?? "unknown"}`);
          anomalies.push({
            message: `I finished "${node.title}" but couldn't run the independent double-check on it this session, so I'm not calling it done yet.`,
          });
        }
        writeRunState(paths.runState, run);
      }
      return accepted;
    };

    dispatchLoop: while (true) {
      const now = sessionNow();
      if (isWallClockExceeded(run, now, startedAt)) {
        timedOut = true;
        break;
      }

      let boundary;
      try {
        boundary = checkBatchBoundary(dispatchHooks);
      } catch {
        anomalies.push({ message: "I couldn't confirm it was still safe to continue, so I stopped rather than guess." });
        haltReason = "kill_switch";
        break;
      }
      if (boundary.halt) {
        haltReason = boundary.reason;
        break;
      }
      // Re-run the tamper check at every batch boundary, not only at session start: a same-session
      // out-of-band edit to control/state/ledger (e.g. re-disabling a kill switch, self-granting)
      // or a forged audit entry is caught before the next batch dispatches, not next session (R14).
      if (!tamperCheckPasses(paths)) {
        anomalies.push({
          message:
            "Partway through, this business's saved files stopped matching what I recorded — something changed them outside my normal process. I stopped rather than continue on top of it.",
        });
        haltReason = "kill_switch";
        break;
      }
      heartbeat(paths.sessionLock, sessionId);

      observeAppSourceFingerprint(plan, run, workspace, sessionNow());
      // Applicability can change between sessions. Settle it before refresh mutates any accepted
      // dependency proof, so a newly deferred/not-needed consumer cannot spend a refresh attempt.
      reconcileWorkflowApplicability(plan, run, businessState, sessionNow());
      for (const node of plan.nodes) {
        const state = run.nodes[node.id];
        if (state && !["pending", "ready", "stale"].includes(state.status)) {
          abandonDependencyRefreshesForConsumer(plan, run, node.id, sessionNow());
        }
      }
      const activeScopeHints = brief?.scopeHints;
      const scopedRefreshConsumers: Set<RunNodeId> | undefined =
        activeScopeHints && activeScopeHints.length > 0
          ? new Set(plan.nodes.filter((node) => nodeInScope(activeScopeHints, node.domainId, node.workflowId)).map((node) => node.id))
          : failedScopedRefreshDependencyIds.size > 0
            ? new Set(plan.nodes.map((node) => node.id))
            : undefined;
      if (scopedRefreshConsumers && failedScopedRefreshDependencyIds.size > 0) {
        for (const consumerId of [...scopedRefreshConsumers]) {
          const consumerNode = plan.nodes.find((node) => node.id === consumerId);
          if (consumerNode?.refreshDependencies.some((refresh) => failedScopedRefreshDependencyIds.has(refresh.nodeId))) {
            scopedRefreshConsumers.delete(consumerId);
          }
        }
      }
      if (scopedRefreshConsumers) {
        for (const consumerId of scopedRefreshConsumers) {
          const consumerNode = plan.nodes.find((node) => node.id === consumerId);
          const consumerState = run.nodes[consumerId];
          if (!consumerNode || !consumerState || !["pending", "ready", "stale"].includes(consumerState.status)) continue;
          const cycles = new Set(consumerState.dependencyRefreshCycles ?? []);
          for (const refresh of consumerNode.refreshDependencies) {
            const token = `${refresh.nodeId}@${consumerState.attempts.length}`;
            if (cycles.has(token) && run.nodes[refresh.nodeId]?.status !== "succeeded") scopedRefreshDependencyIds.add(refresh.nodeId);
          }
        }
      }
      const reopenedRefreshDependencies = refreshDependenciesBeforeFrontier(plan, run, sessionNow(), scopedRefreshConsumers);
      for (const nodeId of reopenedRefreshDependencies) scopedRefreshDependencyIds.add(nodeId);
      writeRunState(paths.runState, run);
      applyStandingApprovals(plan, run, paths.agentOperations, sessionNow());
      const frontier = computeFrontier(plan, run, businessState, captured);
      let readyIds: RunNodeId[] = frontier.ready.filter((nodeId) => !failedScopedRefreshDependencyIds.has(nodeId));
      if (brief.scopeHints && brief.scopeHints.length > 0) {
        const inScope = readyIds.filter((id) => {
          const node = plan.nodes.find((candidate) => candidate.id === id)!;
          return nodeInScope(brief!.scopeHints, node.domainId, node.workflowId) || scopedRefreshDependencyIds.has(id);
        });
        // A scoped session dispatches nodes matching its scope plus the exact dependencies it
        // reopened for an in-scope consumer's declared refresh cycle. It never silently reaches
        // across that boundary for an ordinary prerequisite the founder did not grant this
        // session. When nothing in scope is currently ready, check
        // whether that's ordinary (an out-of-scope ready node with no bearing on this scope, or
        // the in-scope work is simply done -- both silent by design) or whether an in-scope node
        // is stuck behind an out-of-scope prerequisite that hasn't succeeded yet, in which case
        // the loop used to just break with no explanation. Report the blocker by title, not its
        // raw domainId -- an anomaly message reaches the founder through the same digest as
        // "advanced"/"parked" entries, and domainId values (e.g. "domain.money") are exactly what
        // the founder-copy internal-vocabulary blocklist exists to keep out of that surface.
        if (inScope.length === 0) {
          const blockingTitles = findOutOfScopeBlockers(plan, run, brief.scopeHints);
          if (blockingTitles.length > 0) {
            anomalies.push({
              message: `Nothing in this session's current scope is ready to run yet. Progress is waiting on other work outside this session's scope: ${blockingTitles.join(", ")}. Widen this session's scope, or run a session covering that work first, before retrying.`,
            });
          }
        }
        readyIds = inScope;
      }
      if (readyIds.length === 0) {
        // Nothing dispatchable — but produced work may be parked pending its fresh-context
        // check. Judge it now; an acceptance re-opens the frontier, so loop again. No
        // acceptance (nothing pending, rejected, or verifier unavailable) means the session
        // is genuinely done. A sweep that set a halt/timeout flag falls through to the loop's
        // own top-of-iteration checks via the same break below.
        const acceptedCount = await runVerificationSweep();
        if (acceptedCount > 0 && !timedOut && !haltReason) continue;
        break;
      }

      const batches = buildDispatchBatches(plan, readyIds, maxConcurrency);
      for (const batch of batches) {
        let innerBoundary;
        try {
          innerBoundary = checkBatchBoundary(dispatchHooks);
        } catch {
          anomalies.push({ message: "I couldn't confirm it was still safe to continue, so I stopped rather than guess." });
          haltReason = "kill_switch";
          break dispatchLoop;
        }
        if (innerBoundary.halt) {
          haltReason = innerBoundary.reason;
          break dispatchLoop;
        }
        heartbeat(paths.sessionLock, sessionId);

        for (const nodeId of batch.nodeIds) {
          const node = plan.nodes.find((candidate) => candidate.id === nodeId)!;
          // Standing authority is time- and target-bound. Re-read it at the final dispatch seam,
          // after the batch boundary and immediately before any estimate or worker starts. A
          // revoked/expired envelope or changed planned action resets its sourced approvals to
          // pending, even when an earlier frontier pass had classified this node as ready.
          applyStandingApprovals(plan, run, paths.agentOperations, sessionNow());
          if (node.approvals.some((approval) => run.approvals[approval.id] !== "approved")) {
            const nodeState = run.nodes[nodeId];
            if (nodeState) {
              nodeState.status = "waiting_founder";
              nodeState.blocker = "Founder approval required";
              run.updatedAt = sessionNow();
              writeRunState(paths.runState, run);
            }
            continue;
          }
          // Re-evaluate at the final dispatch seam. Frontier decisions are planning evidence,
          // not authority: grants, prerequisites, waivers, budgets, and time bounds may have
          // changed since that pass, just as standing envelopes may have above.
          const decision = captured.evaluate(node);
          if (!decision.allowed) {
            const nodeState = run.nodes[nodeId];
            if (nodeState) {
              nodeState.status = "blocked";
              nodeState.blocker = decision.parkReason ?? "Dispatch-time authority no longer permits this work.";
              run.updatedAt = sessionNow();
              writeRunState(paths.runState, run);
            }
            continue;
          }

          let estimateEntryId: string | undefined;
          if (decision.allowed && decision.estimateAmount !== undefined) {
            const built = buildEstimatePatch(ledger, node, decision, sessionId, sessionNow());
            if (built) {
              const result = commitPatch(paths.ledger, paths, sessionId, built.patch);
              if (result.code === 0) {
                ledger = loadLedgerFile(paths.ledger, sessionNow());
                estimateEntryId = built.entryId;
              } else {
                anomalies.push({
                  message: `I couldn't record the expected cost for "${node.title}" before starting it, so I left it for you to look at instead of spending blind.`,
                });
                continue;
              }
            }
          }

          const attemptTime = sessionNow();
          let attempt: ReturnType<typeof beginAttempt>;
          try {
            attempt = beginAttempt(plan, run, nodeId, sessionId, attemptTime);
          } catch (error) {
            // beginAttempt throws once a node has exhausted its maxAttempts (or on an internal
            // plan/run mismatch). Left uncaught, this would escape to the outer catch and report
            // the WHOLE session as "crashed" — dropping every already-succeeded node from this
            // run's digest over a single node's retry budget. Park just this node instead (the
            // fixed blocker string below matches digest.ts's BLOCKER_TEXT_EXACT so it renders as
            // a plain sentence, never the raw error) and keep dispatching the rest of the batch.
            console.error(`session.begin_attempt_failed ${nodeId}: ${error instanceof Error ? error.message : String(error)}`);
            const nodeState = run.nodes[nodeId];
            if (nodeState) {
              nodeState.status = "blocked";
              nodeState.blocker = "Ran out of attempts for this session.";
              run.updatedAt = attemptTime;
              writeRunState(paths.runState, run);
            }
            continue;
          }
          writeRunState(paths.runState, run);

          const refreshAttemptHeartbeat = (): void => {
            try {
              refreshHeartbeat(run, nodeId, sessionNow());
              writeRunState(paths.runState, run);
              heartbeat(paths.sessionLock, sessionId);
            } catch {
              /* best effort: a heartbeat refresh is an optimization, never load-bearing for this attempt's own result */
            }
          };
          // R12/R13 liveness must not depend on the executor voluntarily calling back: a
          // slow-but-alive real executor (U6) that never calls `heartbeat` would otherwise let its
          // own attempt/lock heartbeat go stale mid-run and risk a --break-stale-verified acquirer
          // stealing the lock out from under it. This timer refreshes both independently of the
          // executor for as long as execute() is in flight; the executor-supplied callback below is
          // still honored as an extra signal, but neither one is load-bearing on its own now. The
          // interval is a fraction of the tighter of the two TTLs in play so a refresh always lands
          // comfortably inside the window; unref'd (never keeps this short-lived CLI's event loop
          // alive on its own) and always cleared in `finally`, including when execute() throws.
          const heartbeatIntervalMs = Math.max(50, (Math.min(attempt.ttlSeconds, lockTtlSeconds) * 1000) / 3);
          const heartbeatTimer = setInterval(refreshAttemptHeartbeat, heartbeatIntervalMs);
          heartbeatTimer.unref();
          let result: Awaited<ReturnType<typeof executor.execute>>;
          try {
            const authorization = {
              workflowId: node.workflowId,
              runId: run.runId,
              attemptId: attempt.id,
              evaluatedAt: attemptTime,
              actionClass: node.actionClass,
              ...(node.protectedCategory ? { protectedCategory: node.protectedCategory } : {}),
              approvalRequirements: node.approvals.map((approval) => {
                const provenance = run.approvalProvenance?.[approval.id];
                return {
                  id: approval.id,
                  description: approval.description,
                  status: run.approvals[approval.id] ?? "pending",
                  ...(provenance
                    ? {
                        envelopeId: provenance.envelopeId,
                        actionId: provenance.actionId,
                        validatedAt: provenance.validatedAt,
                      }
                    : {}),
                };
              }),
              autonomy: {
                reasonCode: decision.reasonCode,
                ...(decision.grantLevel ? { grantLevel: decision.grantLevel } : {}),
                ...(decision.waiverId ? { waiverId: decision.waiverId } : {}),
                evidenceRefs: [...decision.evidenceRefs],
                ...(decision.estimateAmount !== undefined ? { estimateAmount: decision.estimateAmount } : {}),
                ...(decision.estimateCurrency ? { estimateCurrency: decision.estimateCurrency } : {}),
                ...(decision.remainingBudget !== undefined ? { remainingBudget: decision.remainingBudget } : {}),
              },
            } as const;
            result = await executor.execute(node, {
              runId: run.runId,
              attemptId: attempt.id,
              workspaceDir: workspace,
              skillRootDir: skillRoot(),
              artifactPaths: Object.fromEntries(plan.artifactBindings.map((binding) => [binding.artifactId, binding.path])),
              authorization,
              refreshInstructions: run.nodes[nodeId]?.refreshInstructions,
              now: attemptTime,
              heartbeat: refreshAttemptHeartbeat,
            });
          } finally {
            clearInterval(heartbeatTimer);
          }
          const finishedAt = sessionNow();

          if (result.status === "failed") {
            const failedState = run.nodes[nodeId];
            attempt.status = "failed";
            attempt.finishedAt = finishedAt;
            attempt.error = result.error;
            const deferredRefresh = deferDependencyRefreshAfterFailure(plan, run, nodeId, finishedAt);
            if (deferredRefresh) {
              failedScopedRefreshDependencyIds.add(nodeId);
              scopedRefreshDependencyIds.delete(nodeId);
            }
            if (!deferredRefresh && failedState) {
              failedState.refreshInstructions = undefined;
              failedState.status = "failed";
              failedState.blocker = result.error ?? "The work didn't complete.";
            }
            run.updatedAt = finishedAt;
            // A failed node is neither "advanced" nor "parked" in run-state terms — without this it would
            // vanish from the digest entirely (silence), so a failure is reported as something to watch.
            // The raw executor error is never interpolated here: it's a debug string (may itself carry
            // internal ids), not founder copy — only the node's own human title is safe to name.
            anomalies.push({ message: `I tried "${node.title}" and it didn't go through. I'll leave it for a future session or for you to look at.` });
          } else {
            reconcilePatch(
              plan,
              run,
              {
                nodeId,
                attemptId: attempt.id,
                outputs: result.outputs.map((output) => ({
                  artifactId: output.artifactId,
                  path: output.path,
                  fingerprint: output.fingerprint,
                  evidence: [...output.evidence],
                })),
              },
              finishedAt,
            );
            if (run.nodes[nodeId]!.status === "succeeded") {
              advanced.push({ nodeId, title: node.title, unit: domainBusinessUnit(node.domainId) });
            } else if (node.verification.kind === "deterministic" && node.verification.gateIds.length > 0) {
              // Deterministic acceptance: the node's own gates are the verification (Verification
              // Contract). Run them against the workspace; all pass -> accept, any fail -> the node
              // stays verification-pending and the digest reports it as still being checked.
              // False accepts are impossible here; a gate that cannot run counts as not-passed.
              const gateOutcome = runDeterministicGates(node.verification.gateIds, workspace);
              if (gateOutcome.allPassed) {
                acceptVerification(plan, run, nodeId, gateOutcome.evidence, sessionNow(), sessionId);
                const accepted = run.nodes[nodeId]!.status as string;
                if (accepted === "succeeded") advanced.push({ nodeId, title: node.title, unit: domainBusinessUnit(node.domainId) });
              } else {
                anomalies.push({ message: `I finished "${node.title}" but its checks didn't pass yet, so I'm not calling it done.` });
              }
            }

            if (estimateEntryId) {
              const actualPatch = buildActualPatch(ledger, estimateEntryId, node, decision, sessionId, sessionNow());
              if (actualPatch) {
                const actualResult = commitPatch(paths.ledger, paths, sessionId, actualPatch);
                if (actualResult.code === 0) ledger = loadLedgerFile(paths.ledger, sessionNow());
                else
                  anomalies.push({ message: `I finished "${node.title}" but couldn't record the final cost — the estimate is saved, the actual isn't yet.` });
              }
            }
          }
          writeRunState(paths.runState, run);
        }
      }
    }

    if (!verifier) {
      const unverified = listPendingFreshContext(plan, run).length;
      if (unverified > 0) {
        anomalies.push({
          message:
            unverified === 1
              ? "Independent double-checks were turned off for this session, so one piece of finished work is waiting on a check rather than done."
              : `Independent double-checks were turned off for this session, so ${unverified} pieces of finished work are waiting on a check rather than done.`,
        });
      }
    }

    // One final, side-effect-free frontier pass so run.nodes reflects the latest classification for the digest, regardless of why the loop exited.
    try {
      applyStandingApprovals(plan, run, paths.agentOperations, sessionNow());
      computeFrontier(plan, run, businessState, captured);
    } catch {
      /* best effort snapshot only */
    }

    const parked: DigestParkedItem[] = [];
    for (const node of plan.nodes) {
      const state = run.nodes[node.id];
      if (!state || (state.status !== "blocked" && state.status !== "waiting_founder")) continue;
      const detail = decisions.get(node.id);
      const pendingGate = businessState.founderGates.pending.find((gate) => gate.reason.includes(node.title));
      parked.push({
        nodeId: node.id,
        title: node.title,
        unit: domainBusinessUnit(node.domainId),
        reasonText: translateParkReason({ reasonCode: detail?.allowed === false ? detail.reasonCode : undefined, blocker: state.blocker }),
        ageText: pendingGate ? formatAge(pendingGate.createdAt, sessionNow()) : undefined,
      });
    }
    for (const gate of businessState.founderGates.pending) {
      if (parked.some((item) => gate.reason.includes(item.title))) continue;
      parked.push({
        nodeId: gate.id,
        title: gate.reason,
        unit: "Operations",
        reasonText: "This has been waiting on you.",
        ageText: formatAge(gate.createdAt, sessionNow()),
      });
    }

    if (haltReason) anomalies.push({ message: `I stopped partway through because ${translateHaltReason(haltReason)}.` });
    if (timedOut) anomalies.push({ message: "I hit my time limit for this session and stopped on purpose rather than run indefinitely." });

    const spend: DigestSpendLine[] = ledger.balances.map((balance) => ({
      unit: balance.unit,
      period: balance.period,
      currency: balance.currency,
      allocated: balance.allocated,
      committed: balance.committed,
      spent: balance.spent,
      remaining: balance.remaining,
    }));

    const finalNow = sessionNow();
    run.heartbeatAt = finalNow;
    run.updatedAt = finalNow;
    writeRunState(paths.runState, run);
    const checkpointHash = `checkpoint:${plan.planId}:${run.runId}:${run.updatedAt}`;
    writeCheckpoint(paths.checkpoint, buildCheckpoint(run, sessionId, checkpointHash, finalNow));

    const outcome: DigestOutcome = timedOut
      ? "timed_out"
      : haltReason === "kill_switch"
        ? "halted_kill_switch"
        : haltReason === "cooperative_yield"
          ? "halted_interactive_yield"
          : advanced.length === 0 && parked.length === 0
            ? "nothing_to_do"
            : "completed";

    return await finish(outcome, { advanced, parked, spend }, 0);
  } catch (error) {
    // The raw error text is never handed to the founder — an internal exception (e.g. a catalog
    // authoring defect) can carry engine vocabulary verbatim (workflow/artifact ids). It goes to
    // stderr for whoever operates this session instead.
    console.error(`session.crashed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    anomalies.push({ message: "Something unexpected went wrong on my end and I had to stop." });
    return await finish("crashed", {}, 1);
  }
}

if (isMainModule(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`session.fatal: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
      process.exitCode = 1;
    });
}
