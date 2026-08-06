#!/usr/bin/env node
import path from "node:path";

import { isMainModule, parseArgs } from "../lib/cli.js";
import { compilePlan, type CompiledPlan, type CompiledRunNode } from "../engine/compile.js";
import { computeFrontier } from "../engine/frontier.js";
import { loadRunState, seedRunState } from "../engine/runstate.js";
import { createAutonomyEvaluator, type AutonomyDecisionDetail, type AutonomyEvaluatorV2 } from "../autonomy/evaluator.js";
import { createCompositeVerifier } from "../autonomy/prerequisites.js";
import { createDopplerAuthVerifier } from "../autonomy/probes/doppler.js";
import { createBudgetFundedVerifier } from "../autonomy/probes/budget.js";
import type { BusinessStateV2, ControlFile, RunStateDocument } from "../schema/types.js";
import { loadBusinessStateFile, loadCatalogFile, loadControlFile, loadLedgerFile, resolveWorkspacePaths } from "../session/run.js";
import { buildPlanReport, type HeldNode, type PlanReport } from "../session/plan.js";
import { translateParkReason } from "../session/digest.js";

/**
 * The engine half of the platform-to-engine execution boundary (docs/architecture.md,
 * "Integration contract"): one read-only CLI the Formation server can spawn to learn, in a typed
 * shape, what this workspace's durable run looks like right now. It is core/session/plan.ts with
 * the agent-facing report swapped for a boundary document: per-workflow status keyed by *stable
 * catalog workflow id* (the id the platform is allowed to hold onto), founder-plain reasons from
 * the digest's own translation table (never the evaluator's internal sentences), and an explicit
 * answer to "does a durable run exist yet".
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
}

export interface ExecutionBoundaryReport {
  readonly schemaVersion: "1.0.0";
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
      states.set(node.workflowId, { workflowId: node.workflowId, title: node.title, status: "ready" });
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
  return { schemaVersion: "1.0.0", generatedAt: now, workspaceReady: false, reason };
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

  return {
    schemaVersion: "1.0.0",
    generatedAt: now,
    workspaceReady: true,
    planId: plan.planId,
    catalogVersion: plan.catalogVersion,
    runId: durable ? durable.runId : null,
    hasDurableRun: durable !== undefined,
    autonomyUnset: report.autonomyUnset,
    workflows: buildBoundaryWorkflows(plan, report, nodeStatuses),
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
