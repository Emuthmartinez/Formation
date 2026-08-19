#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { isMainModule, parseArgs } from "../lib/cli.js";
import { compilePlan, type CompiledPlan, type CompiledRunNode, type CostEstimate, type VerificationKind } from "../engine/compile.js";
import { composeNodeBrief, type NodeBrief } from "../engine/node-brief.js";
import { computeFrontier } from "../engine/frontier.js";
import { loadRunState, seedRunState } from "../engine/runstate.js";
import { createAutonomyEvaluator, type AutonomyDecisionDetail, type AutonomyEvaluatorV2 } from "../autonomy/evaluator.js";
import { createCompositeVerifier } from "../autonomy/prerequisites.js";
import { createDopplerAuthVerifier } from "../autonomy/probes/doppler.js";
import { createBudgetFundedVerifier } from "../autonomy/probes/budget.js";
import { effectiveProtectedCategory } from "../autonomy/waivers.js";
import type { BusinessStateV2, ControlFile, ProtectedCategory, RunStateDocument } from "../schema/types.js";
import { loadBusinessStateFile, loadCatalogFile, loadControlFile, loadLedgerFile, resolveWorkspacePaths } from "../session/run.js";
import { buildPlanReport, type HeldNode, type PlanReport } from "../session/plan.js";
import { translateParkReason } from "../session/digest.js";
import { PROVISIONING_MANIFEST } from "../provisioning/requirements.js";
import { ADAPTER_CONTRACT_VERSION } from "./contract.js";
import { validateBoundaryReport } from "../schema/index.js";

/**
 * The engine half of the platform-to-engine execution boundary (docs/architecture.md,
 * "Integration contract"): one read-only CLI the Formation server can spawn to learn, in a typed
 * shape, what this workspace's durable run looks like right now. It is core/session/plan.ts with
 * the agent-facing report swapped for a boundary document: per-workflow status keyed by *stable
 * catalog workflow id* (the id the platform is allowed to hold onto), founder-plain reasons from
 * the digest's own translation table (never the evaluator's internal sentences), an explicit
 * answer to "does a durable run exist yet", the durable run's founder approvals, and — the import
 * half of the boundary — its verified results and per-artifact acceptance state, so the platform
 * can import settled work and mirror the engine's own staleness conclusions without re-deriving
 * either.
 *
 * **It never writes** — same clone-and-drop discipline as the planner, and for the same reason:
 * computeFrontier mutates the run state it examines, and the reducer plus the session runner are
 * the only writers on their respective documents. Submission is not this file's job; the platform
 * creates or resumes a run by invoking core/session/run.ts, the sanctioned runner.
 *
 * Honesty contract: exit 0 means "the engine answered", including the answer "this workspace is
 * not set up" (`workspaceReady: false` with a reason). A non-zero exit means the engine could not
 * answer at all — the caller must report that as unreachable, never as "no work ready".
 *
 * CLI: tsx core/adapters/platform-execution.ts --workspace <dir> [--catalog <path>] [--now <iso>]
 */

export type ExecutionWorkflowStatus = "finished" | "ready" | "in-progress" | "needs-founder" | "held" | "failed" | "upcoming";

export interface ExecutionWorkflowState {
  readonly workflowId: string;
  readonly title: string;
  readonly status: ExecutionWorkflowStatus;
  /** Founder-plain sentence for anything not simply upcoming/finished. Sourced from the digest translation layer, never from evaluator internals. */
  readonly founderReason?: string;
  /**
   * The authored worker contract for READY steps only (composeNodeBrief): what doing this step
   * involves — instructions, files to open, knowledge to load, outputs, verification. Ready-only
   * because that is the decision surface; finished or parked steps would bloat the boundary
   * payload with contracts nobody can act on.
   */
  readonly brief?: NodeBrief;
}

export interface ExecutionBoundaryReport {
  readonly schemaVersion: "1.1.0";
  /** Adapter contract A version (core/adapters/contract.ts) — consumers accept on major match. */
  readonly contractVersion: string;
  readonly generatedAt: string;
  readonly workspaceReady: boolean;
  /** Present when workspaceReady is false: why the engine cannot plan against this workspace. */
  readonly reason?: string;
  readonly planId?: string;
  readonly catalogVersion?: string;
  /** The durable run's id when run state exists for the current plan; null when the next session would seed a fresh run. */
  readonly runId?: string | null;
  readonly hasDurableRun?: boolean;
  /** True when the workspace has no control file yet — nothing is granted, so every step parks. */
  readonly autonomyUnset?: boolean;
  readonly workflows?: readonly ExecutionWorkflowState[];
  /**
   * The durable run's founder approvals, in catalog order — empty until a durable run exists.
   * Only the durable run is consulted: core/session/approve.ts records decisions onto
   * run/run-state.json, so an approval that exists only on a throwaway seeded run has nothing an
   * answer could be recorded against, and advertising it would invite the platform to collect an
   * answer the engine can never accept.
   */
  readonly approvals?: readonly ExecutionApprovalState[];
  /**
   * The durable run's verified results, in catalog order — empty until a durable run exists.
   * "Verified" is the engine's settled acceptance state (acceptVerification or a kind:"none"
   * policy that requires nothing), never merely "the node finished": a node reconciled but still
   * blocked pending verification contributes nothing here, and neither does a node whose lanes
   * were seeded done without an attempt (there is no attempt, no evidence, and no real output
   * behind a seed fingerprint for a platform to import).
   */
  readonly results?: readonly ExecutionVerifiedResult[];
  /**
   * The durable run's current per-artifact acceptance state — the engine's own staleness
   * conclusions (invalidateDescendants flips `accepted` off on every affected descendant), in a
   * shape the platform can mirror without re-deriving the graph walk itself.
   */
  readonly artifacts?: readonly ExecutionArtifactState[];
  readonly launchMatrix?: LaunchMatrixProjection;
}

export interface LaunchMatrixWorkflow {
  readonly workflowId: string;
  readonly groupId: string;
  readonly title: string;
  readonly summary: string;
  readonly status: string;
  readonly founderReason?: string;
  readonly applicability: "required" | "not-needed" | "unknown";
  readonly phaseIds: string[];
  readonly dependencyWorkflowIds: string[];
  readonly dependentWorkflowIds: string[];
  readonly role?: { id: string; name: string };
  readonly knowledge: LaunchMatrixKnowledge[];
  /**
   * Role-attached conditional knowledge (context packs), deduplicated against the mandatory
   * `knowledge` list the same way composeNodeBrief splits load/route. Dispatched workers receive
   * both; a matrix that showed only the mandatory list under-reported the knowledge surface.
   */
  readonly conditionalKnowledge: Array<LaunchMatrixKnowledge & { packId: string; packTitle: string }>;
  readonly services: Array<{ id: string; name: string; purpose: string; state: string; checkedAt?: string }>;
  readonly agentTools: Array<{ id: string; when: string }>;
  readonly outputs: Array<{ artifactId: string; title: string; state: string }>;
  readonly verification: { kind: string; state: string; evidenceCount: number };
}

export interface LaunchMatrixKnowledge {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly loadWhen: string;
  readonly freshness: string;
  /** Read-time verdict on source review cadence: sources overdue, current, or none declared. */
  readonly reviewStatus: "review-due" | "current" | "internal";
}

/**
 * One cross-cutting integrity workflow (domain.process / domain.orchestration) with its live
 * status and verification state. These never join a founder presentation group — they are not
 * founder-grantable work — but their outcomes (provider proof, coverage audits, change cascades)
 * are launch-readiness evidence a founder may see, so they cross the boundary as their own list
 * instead of dissolving into an unlabeled count.
 */
export interface LaunchMatrixIntegrityStep {
  readonly workflowId: string;
  readonly title: string;
  readonly status: string;
  readonly verification: { kind: string; state: string };
}

export interface LaunchMatrixProjection {
  readonly groups: Array<{ id: string; title: string; order: number }>;
  readonly workflows: LaunchMatrixWorkflow[];
  readonly launchIntegrity: LaunchMatrixIntegrityStep[];
  readonly systemSummary: { total: number; counts: Record<string, number> };
}

/** One artifact an accepted attempt produced: a candidate for the platform to import, by reference. */
export interface ExecutionResultArtifact {
  readonly artifactId: string;
  readonly fingerprint: string;
}

/**
 * One verified node result. Trace and cost fields carry ids, names, and declared totals only —
 * never environment values, tokens, or credential contents; the boundary's filtered-environment
 * rule applies to what this document says just as much as to what the spawned process sees.
 */
export interface ExecutionVerifiedResult {
  readonly workflowId: string;
  readonly workflowTitle: string;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly finishedAt?: string;
  readonly verification: VerificationKind;
  readonly evidence: readonly string[];
  readonly artifacts: readonly ExecutionResultArtifact[];
  /** The node's declared token budget (CompiledRunNode.tokenBudget) — a declared ceiling, not a measured actual. */
  readonly declaredTokenBudget: number;
  /** The node's declared cost estimate, when the catalog declares one — an estimate, not a measured actual. */
  readonly declaredCostEstimate?: CostEstimate;
  /** The session that owned the producing attempt — provenance the importer can display and reconcile. */
  readonly producedBySessionId: string;
  /** The session that accepted verification (gate-runner or fresh-context reviewer). Present on every exported fresh-context result — see buildBoundaryResults. */
  readonly verifiedBySessionId?: string;
}

/** Current acceptance state of one durable-run artifact binding, keyed by stable catalog ids. */
export interface ExecutionArtifactState {
  readonly artifactId: string;
  /** The stable workflow id of the artifact's producer in the compiled plan. */
  readonly workflowId?: string;
  readonly accepted: boolean;
  readonly fingerprint?: string;
}

export interface ExecutionApprovalState {
  /** The stable approval id core/session/approve.ts accepts (`<workflowId>.approval.<n>`). */
  readonly approvalId: string;
  readonly workflowId: string;
  readonly workflowTitle: string;
  /** The catalog's founder-only action description — already founder-facing wording. */
  readonly description: string;
  readonly status: "pending" | "approved" | "rejected";
  /** The node's effective protected category, when it has one. Engine vocabulary; the platform translates before showing a founder. */
  readonly protectedCategory?: ProtectedCategory;
}

/**
 * Joins the compiled plan's approval requirements with the durable run's decision record. The
 * durable-run lookup upstream enforces planId equality, so the plan's approval ids and the run's
 * approval map are guaranteed to describe the same plan; an id missing from the run map would
 * mean that invariant broke, and the entry is skipped rather than invented as "pending".
 */
export function buildBoundaryApprovals(plan: CompiledPlan, run: RunStateDocument): ExecutionApprovalState[] {
  const approvals: ExecutionApprovalState[] = [];
  for (const node of plan.nodes) {
    for (const approval of node.approvals) {
      const status = run.approvals[approval.id];
      if (status === undefined) continue;
      const protectedCategory = effectiveProtectedCategory(node);
      approvals.push({
        approvalId: approval.id,
        workflowId: node.workflowId,
        workflowTitle: node.title,
        description: approval.description,
        status,
        ...(protectedCategory ? { protectedCategory } : {}),
      });
    }
  }
  return approvals;
}

const EVIDENCE_ENTRY_LIMIT = 20;
const EVIDENCE_ENTRY_LENGTH = 2_000;

function boundEvidence(evidence: readonly string[]): string[] {
  return evidence
    .filter((entry) => entry.trim().length > 0)
    .slice(0, EVIDENCE_ENTRY_LIMIT)
    .map((entry) => (entry.length > EVIDENCE_ENTRY_LENGTH ? `${entry.slice(0, EVIDENCE_ENTRY_LENGTH - 1)}…` : entry));
}

/**
 * The durable run's verified results. A node qualifies only when its state is settled succeeded
 * through a real attempt AND every declared output's binding is accepted from that same attempt —
 * a partially-accepted node contributes nothing, not "contributes provisionally". Seeded-succeeded
 * nodes (lanes already done before this run) have no attempts and are excluded by construction.
 */
export function buildBoundaryResults(plan: CompiledPlan, run: RunStateDocument): ExecutionVerifiedResult[] {
  const results: ExecutionVerifiedResult[] = [];
  for (const node of plan.nodes) {
    const state = run.nodes[node.id];
    if (!state || state.status !== "succeeded") continue;
    const attempt = state.attempts.at(-1);
    if (!attempt || attempt.status !== "succeeded") continue;

    const bindings = node.outputs.map((artifactId) =>
      run.artifactBindings.find((candidate) => candidate.artifactId === artifactId && candidate.attemptId === attempt.id && candidate.accepted === true),
    );
    if (bindings.some((binding) => binding === undefined || !binding.fingerprint)) continue;

    // Fresh-context verification is only independent when the recorded verifier is a DIFFERENT
    // session from the producing attempt's owner. A result with no recorded verifier, or one
    // whose verifier is its own producer, does not cross the boundary as verified work — the
    // caller-supplied labels in core/session/verify.ts are a first gate; this is the one that
    // holds (Codex round 2).
    if (node.verification.kind === "fresh_context" && (!state.verifiedBySessionId || state.verifiedBySessionId === attempt.ownerSessionId)) continue;

    results.push({
      workflowId: node.workflowId,
      workflowTitle: node.title,
      attemptId: attempt.id,
      attemptNumber: attempt.number,
      ...(attempt.finishedAt ? { finishedAt: attempt.finishedAt } : {}),
      verification: node.verification.kind,
      evidence: boundEvidence(attempt.evidence),
      artifacts: bindings.map((binding) => ({ artifactId: binding!.artifactId, fingerprint: binding!.fingerprint! })),
      declaredTokenBudget: node.tokenBudget,
      ...(node.costEstimate ? { declaredCostEstimate: { amount: node.costEstimate.amount, currency: node.costEstimate.currency } } : {}),
      producedBySessionId: attempt.ownerSessionId,
      ...(state.verifiedBySessionId ? { verifiedBySessionId: state.verifiedBySessionId } : {}),
    });
  }
  return results;
}

/** Every durable-run binding's current acceptance state, producer resolved to its stable workflow id. */
export function buildBoundaryArtifacts(plan: CompiledPlan, run: RunStateDocument): ExecutionArtifactState[] {
  const workflowByNodeId = new Map(plan.nodes.map((node) => [node.id as string, node.workflowId as string]));
  return run.artifactBindings.map((binding) => {
    const workflowId = binding.producedBy ? workflowByNodeId.get(binding.producedBy) : undefined;
    return {
      artifactId: binding.artifactId,
      ...(workflowId ? { workflowId } : {}),
      accepted: binding.accepted,
      ...(binding.fingerprint ? { fingerprint: binding.fingerprint } : {}),
    };
  });
}

function founderReasonFor(node: HeldNode): string | undefined {
  switch (node.reason) {
    case "founder_approval":
      return node.detail || translateParkReason({});
    case "autonomy":
      return translateParkReason({ reasonCode: node.reasonCode });
    case "blocked":
      return translateParkReason({ blocker: node.detail });
    default:
      return undefined;
  }
}

/**
 * Raw run-state statuses the planner's report files under "waiting on earlier work" because they
 * are neither ready, done, parked, blocked, nor waiting on a founder (see buildPlanReport's else
 * branch — the same gap run.ts papers over with digest anomalies for failed nodes). The boundary
 * reports them for what they are instead of inheriting that blind spot: a platform that shows a
 * failed step as "upcoming" is lying to the founder.
 */
const STATUS_OVERRIDES: Record<string, { status: ExecutionWorkflowStatus; founderReason?: string }> = {
  failed: { status: "failed", founderReason: "The last attempt at this step didn't go through." },
  running: { status: "in-progress" },
  orphaned: { status: "held", founderReason: "This didn't finish cleanly last time, so it needs a careful look before it's tried again." },
  needs_readback: { status: "held", founderReason: "This is being double-checked before it's called done." },
  skipped: { status: "finished", founderReason: "This turned out not to be needed." },
  not_needed: { status: "finished", founderReason: "This turned out not to be needed." },
  // Reachable since reconcilePatch started invalidating descendants of a changed accepted input:
  // a stale node re-runs once its inputs settle, so it is upcoming work, never "finished".
  stale: { status: "upcoming", founderReason: "Earlier work it was built on changed, so this will be redone." },
};

/**
 * Maps the planner's own classification onto the boundary vocabulary. Statuses are read off the
 * plan report rather than re-derived from run state — buildPlanReport is what the runner's
 * preview says, and a boundary that recomputes those conclusions is how the platform starts
 * disagreeing with the engine it fronts. The one addition is STATUS_OVERRIDES above, for the raw
 * statuses the report deliberately leaves unclassified.
 */
export function buildBoundaryWorkflows(plan: CompiledPlan, report: PlanReport, nodeStatuses: ReadonlyMap<string, string>): ExecutionWorkflowState[] {
  const byNodeId = new Map(plan.nodes.map((node) => [node.id as string, node]));
  const states = new Map<string, ExecutionWorkflowState>();

  for (const batch of report.batches) {
    for (const entry of batch) {
      const node = byNodeId.get(entry.nodeId)!;
      states.set(node.workflowId, { workflowId: node.workflowId, title: node.title, status: "ready", brief: composeNodeBrief(node, plan) });
    }
  }

  for (const held of report.held) {
    const node = byNodeId.get(held.nodeId)!;
    const status: ExecutionWorkflowStatus = held.reason === "founder_approval" ? "needs-founder" : held.reason === "upstream" ? "upcoming" : "held";
    states.set(node.workflowId, { workflowId: node.workflowId, title: node.title, status, founderReason: founderReasonFor(held) });
  }

  for (const node of plan.nodes) {
    if (!states.has(node.workflowId)) {
      states.set(node.workflowId, { workflowId: node.workflowId, title: node.title, status: "finished" });
    }
    const override = STATUS_OVERRIDES[nodeStatuses.get(node.id as string) ?? ""];
    if (override) {
      states.set(node.workflowId, { workflowId: node.workflowId, title: node.title, status: override.status, founderReason: override.founderReason });
    }
  }

  // Report in catalog order so the platform renders steps in the engine's own sequence.
  return plan.nodes.map((node) => states.get(node.workflowId)!);
}

function notReady(reason: string, now: string): ExecutionBoundaryReport {
  return { schemaVersion: "1.1.0", contractVersion: ADAPTER_CONTRACT_VERSION, generatedAt: now, workspaceReady: false, reason };
}

interface SanitizedAgentOperations {
  capabilities?: Array<{ id?: string; provider?: string; status?: string; checkedAt?: string }>;
  actions?: Array<{ provider?: string; occurredAt?: string; redactionAttested?: boolean; result?: { status?: string } }>;
}

function readAgentOperations(filePath: string): SanitizedAgentOperations {
  if (!existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as SanitizedAgentOperations;
    return { capabilities: parsed.capabilities ?? [], actions: parsed.actions ?? [] };
  } catch {
    return {};
  }
}

function serviceName(providerId: string): string {
  return providerId
    .replace(/^provider\./u, "")
    .split(/[.-]/u)
    .map((part) => (part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

function providerMatches(providerId: string, label = ""): boolean {
  const needle = providerId
    .replace(/^provider\./u, "")
    .replaceAll("-", " ")
    .toLowerCase();
  const candidate = label.trim().toLowerCase();
  return candidate.length > 0 && (candidate.includes(needle) || needle.includes(candidate));
}

export function buildLaunchMatrix(
  plan: CompiledPlan,
  run: RunStateDocument,
  workflowStates: readonly ExecutionWorkflowState[],
  businessState: BusinessStateV2,
  agentOperations: SanitizedAgentOperations,
  now: string,
): LaunchMatrixProjection {
  const stateByWorkflow = new Map(workflowStates.map((item) => [item.workflowId, item]));
  const workflowByNode = new Map(plan.nodes.map((node) => [node.id, node.workflowId]));
  const dependents = new Map<string, string[]>();
  for (const node of plan.nodes) {
    for (const dependency of node.dependencies) dependents.set(dependency, [...(dependents.get(dependency) ?? []), node.workflowId]);
  }
  const today = now.slice(0, 10);
  const presentKnowledge = (reference: NonNullable<CompiledRunNode["references"]>[number]): LaunchMatrixKnowledge => ({
    id: reference.id,
    title: reference.title,
    path: reference.path,
    loadWhen: reference.loadWhen,
    freshness: reference.freshness ?? "unknown",
    reviewStatus: reference.reviewDueBy ? (reference.reviewDueBy < today ? "review-due" : "current") : "internal",
  });
  const groups = plan.presentationGroups ?? [];
  const systemNodes = plan.nodes.filter((node) => node.domainId === "domain.process" || node.domainId === "domain.orchestration");
  const systemCounts: Record<string, number> = {};
  for (const node of systemNodes) {
    const status = stateByWorkflow.get(node.workflowId)?.status ?? "upcoming";
    systemCounts[status] = (systemCounts[status] ?? 0) + 1;
  }
  const launchIntegrity = systemNodes.map((node): LaunchMatrixIntegrityStep => ({
    workflowId: node.workflowId,
    title: node.title,
    status: stateByWorkflow.get(node.workflowId)?.status ?? "upcoming",
    verification: {
      kind: node.verification.kind,
      state: run.nodes[node.id]?.status === "succeeded" ? "verified" : run.nodes[node.id]?.status === "failed" ? "failed" : "pending",
    },
  }));
  const workflows = plan.nodes
    .filter((node) => node.groupId)
    .map((node): LaunchMatrixWorkflow => {
      const state = stateByWorkflow.get(node.workflowId)!;
      const scope = businessState.workflowApplicability?.[node.workflowId];
      const applicability = node.applicability.mode === "always" ? "required" : (scope?.verdict ?? "unknown");
      const latestAttempt = run.nodes[node.id]?.attempts.at(-1);
      const services = node.providerIds.map((providerId) => {
        const declaration = PROVISIONING_MANIFEST.find((item) => item.providerId === providerId);
        const capability = agentOperations.capabilities?.find((item) => providerMatches(providerId, `${item.provider ?? ""} ${item.id ?? ""}`));
        const proof = agentOperations.actions?.find(
          (item) => providerMatches(providerId, item.provider) && item.result?.status === "succeeded" && item.redactionAttested === true,
        );
        const attemptProof =
          latestAttempt?.status === "succeeded" && latestAttempt.evidence.some((entry) => entry.toLowerCase().includes(providerId.toLowerCase()));
        return {
          id: providerId,
          name: serviceName(providerId),
          purpose: declaration?.unlocks ?? `Supports ${node.title}.`,
          state:
            proof || attemptProof
              ? "verified"
              : capability?.status === "available"
                ? "connected"
                : capability?.status === "unavailable" || capability?.status === "blocked"
                  ? capability.status
                  : "planned",
          ...(proof?.occurredAt || (attemptProof ? latestAttempt?.finishedAt : undefined) || capability?.checkedAt
            ? { checkedAt: proof?.occurredAt || (attemptProof ? latestAttempt?.finishedAt : undefined) || capability?.checkedAt }
            : {}),
        };
      });
      return {
        workflowId: node.workflowId,
        groupId: node.groupId!,
        title: node.title,
        summary: node.trigger ?? `Complete ${node.title}.`,
        status: state.status,
        ...(state.founderReason ? { founderReason: state.founderReason } : {}),
        applicability,
        phaseIds: [...node.phaseIds],
        dependencyWorkflowIds: node.dependencies.map((id) => workflowByNode.get(id)!).filter(Boolean),
        dependentWorkflowIds: dependents.get(node.id) ?? [],
        ...(node.role ? { role: { id: node.role.id, name: node.role.name } } : {}),
        knowledge: (node.references ?? []).map(presentKnowledge),
        conditionalKnowledge: (() => {
          // Same load/route split and path-level dedupe as composeNodeBrief: mandatory references
          // win, and a reference shared by two packs appears once, under the first pack.
          const seen = new Set((node.references ?? []).map((reference) => reference.path));
          return (
            node.role?.contextPacks.flatMap((pack) =>
              pack.references.flatMap((reference) => {
                if (seen.has(reference.path)) return [];
                seen.add(reference.path);
                return [{ ...presentKnowledge(reference), packId: pack.id, packTitle: pack.title }];
              }),
            ) ?? []
          );
        })(),
        services,
        agentTools: node.role?.toolRoutes.map((tool) => ({ id: tool.id, when: tool.when })) ?? [],
        outputs: node.outputs.map((artifactId) => {
          const binding = run.artifactBindings.find((item) => item.artifactId === artifactId);
          return { artifactId, title: binding?.path ?? artifactId, state: binding?.accepted ? "accepted" : binding?.fingerprint ? "produced" : "pending" };
        }),
        verification: {
          kind: node.verification.kind,
          state: run.nodes[node.id]?.status === "succeeded" ? "verified" : run.nodes[node.id]?.status === "failed" ? "failed" : "pending",
          evidenceCount: latestAttempt?.evidence.length ?? 0,
        },
      };
    });
  return { groups, workflows, launchIntegrity, systemSummary: { total: systemNodes.length, counts: systemCounts } };
}

export function describeWorkspace(
  workspace: string,
  options: { catalog?: string; now?: string; dopplerProject?: string; dopplerConfig?: string; secretsMd?: string } = {},
): ExecutionBoundaryReport {
  const now = options.now ?? new Date().toISOString();
  const paths = resolveWorkspacePaths(workspace, options.catalog ? path.resolve(options.catalog) : undefined);

  const businessState: BusinessStateV2 | undefined = loadBusinessStateFile(paths.state);
  if (!businessState) {
    return notReady("This company's launch workspace has not been set up yet.", now);
  }

  const control: ControlFile | undefined = loadControlFile(paths.control);
  const ledger = loadLedgerFile(paths.ledger, now);
  const plan = compilePlan(loadCatalogFile(paths.catalog), now);

  const durable = (() => {
    try {
      const existing = loadRunState(paths.runState);
      if (existing.planId === plan.planId) return existing;
    } catch {
      /* fall through to a fresh, throwaway seed */
    }
    return undefined;
  })();
  const run: RunStateDocument =
    durable ?? seedRunState(plan, businessState, { ownerSessionId: "platform-boundary", ttlSeconds: 300, wallClockCapSeconds: 0, now });

  const prerequisiteVerifier = createCompositeVerifier({
    doppler_auth: createDopplerAuthVerifier({
      project: options.dopplerProject ?? control?.businessSlug ?? "",
      config: options.dopplerConfig ?? "production",
      secretsMdPath: options.secretsMd ?? path.join(workspace, "SECRETS.md"),
    }),
    budget_funded: createBudgetFundedVerifier(ledger),
  });

  const decisions = new Map<string, AutonomyDecisionDetail>();
  const inner = createAutonomyEvaluator({ grants: control?.grants ?? {}, waivers: control?.waivers ?? [], ledger, prerequisiteVerifier, runId: run.runId });
  const evaluator: AutonomyEvaluatorV2 = {
    evaluate(node: CompiledRunNode): AutonomyDecisionDetail {
      const detail = inner.evaluate(node);
      decisions.set(node.id, detail);
      return detail;
    },
  };

  // Same no-write guarantee as the planner: the frontier pass edits a clone that is dropped.
  const scratch: RunStateDocument = structuredClone(run);
  const frontier = computeFrontier(plan, scratch, businessState, evaluator);
  const parked = new Map(frontier.parked.map((entry) => [entry.nodeId, entry.reason]));
  const report = buildPlanReport(plan, scratch, frontier.ready, parked, decisions, 4, control === undefined);
  const nodeStatuses = new Map(Object.entries(scratch.nodes).map(([nodeId, state]) => [nodeId, state.status as string]));

  const boundaryWorkflows = buildBoundaryWorkflows(plan, report, nodeStatuses);
  return {
    schemaVersion: "1.1.0",
    contractVersion: ADAPTER_CONTRACT_VERSION,
    generatedAt: now,
    workspaceReady: true,
    planId: plan.planId,
    catalogVersion: plan.catalogVersion,
    runId: durable ? durable.runId : null,
    hasDurableRun: durable !== undefined,
    autonomyUnset: report.autonomyUnset,
    workflows: boundaryWorkflows,
    approvals: durable ? buildBoundaryApprovals(plan, durable) : [],
    results: durable ? buildBoundaryResults(plan, scratch) : [],
    artifacts: durable ? buildBoundaryArtifacts(plan, scratch) : [],
    launchMatrix: buildLaunchMatrix(plan, scratch, boundaryWorkflows, businessState, readAgentOperations(paths.agentOperations), now),
  };
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  if (!args.workspace) {
    console.error("platform-execution.missing_argument: --workspace is required");
    return 1;
  }

  const report = describeWorkspace(path.resolve(args.workspace), {
    catalog: args.catalog,
    now: args.now,
    dopplerProject: args["doppler-project"],
    dopplerConfig: args["doppler-config"],
    secretsMd: args["secrets-md"],
  });
  // Contract A fail-closed at the emitter: an invalid report is never printed. A consumer that
  // receives ANY output can trust it validated against core/schema/boundary-report.schema.json.
  const contractCheck = validateBoundaryReport<ExecutionBoundaryReport>(report);
  if (!contractCheck.valid) {
    for (const issue of contractCheck.issues) console.error(`ISSUE boundary.contract_invalid: ${issue.message} (${issue.path})`);
    return 1;
  }
  console.log(JSON.stringify(report, null, 2));
  return 0;
}

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`platform-execution.crashed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    process.exitCode = 1;
  }
}
