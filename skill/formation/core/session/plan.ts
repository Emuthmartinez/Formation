#!/usr/bin/env node
import path from "node:path";

import { isMainModule, parseArgs } from "../lib/cli.js";
import { buildDispatchBatches } from "../engine/dispatch.js";
import { compilePlan, type CompiledPlan, type CompiledRunNode, type RunNodeId } from "../engine/compile.js";
import { composeNodeBrief, renderNodeBrief, type NodeBrief } from "../engine/node-brief.js";
import { computeFrontier } from "../engine/frontier.js";
import { loadRunState, reconcileEnvironmentalArtifacts, reopenRecurringNodes, seedRunState } from "../engine/runstate.js";
import { createAutonomyEvaluator, type AutonomyDecisionDetail, type AutonomyEvaluatorV2 } from "../autonomy/evaluator.js";
import { createCompositeVerifier } from "../autonomy/prerequisites.js";
import { createDopplerAuthVerifier } from "../autonomy/probes/doppler.js";
import { createBudgetFundedVerifier } from "../autonomy/probes/budget.js";
import type { BusinessStateV2, ControlFile, RunStateDocument } from "../schema/types.js";
import { loadBusinessStateFile, loadCatalogFile, loadControlFile, loadLedgerFile, resolveWorkspacePaths } from "./run.js";

/**
 * The frontier, for a session that is a conversation rather than a headless run.
 *
 * core/session/run.ts computes what is ready and then dispatches it to executors. That is the
 * right shape for a scheduled run and the wrong shape for an interactive one, where the agent in
 * the conversation *is* the executor — invoking the runner from inside it would spawn sessions
 * from within a session. So before this file the interactive path had no way to reach the engine
 * at all, and SKILL.md's only instruction for it was "load the next needed reference yourself".
 * A launch on 2026-08-05 did exactly that: it walked lanes in the order the documentation happened
 * to be written in, never learning that other work was ready in parallel or parked on a decision
 * nobody had been asked for.
 *
 * This answers the same question with the same code and stops before the dispatch: compile the
 * catalog, evaluate it against the founder's real grants, waivers, and budget, and report. It is
 * the runner's first half with the second half removed.
 *
 * **It never writes.** Not run state, not control, not the ledger, not the audit log. That is the
 * property that makes it safe to run at the top of any session and again after every change, and
 * it is load-bearing: computeFrontier mutates the run-state nodes it examines, so this works on a
 * structuredClone and drops it. Never add a writeRunState here — the reducer is the only writer
 * (KTD7), and a planner that quietly advanced run state would be a second one.
 *
 * Not to be confused with verification/rehearsal/shadow-frontier.ts, which computes a frontier with
 * allowAllAutonomyEvaluator on purpose: it asks "what would this plan look like if everything were
 * permitted", to sanity-check a migrated live business. This asks the operational question instead
 * — what may actually run, given what this founder has granted — so the two are kept separate and
 * that file's recorded rehearsal output stays reproducible.
 *
 * CLI: tsx core/session/plan.ts --workspace <dir> [--catalog <path>] [--max-concurrency <n>] [--json]
 *
 * Exit codes: 0 = reported (including "nothing is ready", which is a finding, not a failure),
 * 1 = could not report, because the workspace has no business state to plan against.
 */

/** Why a node is not ready. Ordered by what the founder or agent can do about it, most actionable first. */
export type HeldReason = "founder_approval" | "autonomy" | "blocked" | "upstream";

export interface HeldNode {
  readonly nodeId: RunNodeId;
  readonly title: string;
  readonly domainId: string;
  readonly reason: HeldReason;
  /** The evaluator's own sentence where there is one, so this never invents a second explanation. */
  readonly detail: string;
  readonly reasonCode?: string;
}

export interface PlanReport {
  readonly planId: string;
  readonly catalogVersion: string;
  readonly totalNodes: number;
  readonly done: number;
  /** Ready work, already grouped so that everything inside one group can run at the same time. */
  readonly batches: readonly (readonly HeldNode[])[];
  /**
   * One worker brief per ready node (same order as the flattened batches): the authored contract
   * — instructions, files to open, knowledge to load, outputs, verification — so an interactive
   * session executes the node from its brief instead of re-deriving what to load from prose
   * routing tables.
   */
  readonly readyBriefs: readonly NodeBrief[];
  readonly held: readonly HeldNode[];
  /** True when this workspace has no control file yet, so no domain has been granted anything. */
  readonly autonomyUnset: boolean;
}

function describe(node: CompiledRunNode, reason: HeldReason, detail: string, reasonCode?: string): HeldNode {
  return { nodeId: node.id, title: node.title, domainId: node.domainId, reason, detail, reasonCode };
}

/**
 * Categorizes every node the frontier pass just settled. The status values are read back off the
 * run copy rather than re-derived, because computeFrontier is what decided them — recomputing the
 * same conclusions here is how a planner starts disagreeing with the runner it is meant to preview.
 */
export function buildPlanReport(
  plan: CompiledPlan,
  run: RunStateDocument,
  ready: readonly RunNodeId[],
  parked: ReadonlyMap<RunNodeId, string>,
  decisions: ReadonlyMap<string, AutonomyDecisionDetail>,
  maxConcurrency: number,
  autonomyUnset: boolean,
): PlanReport {
  const byId = new Map(plan.nodes.map((node) => [node.id, node]));
  const readySet = new Set(ready);

  const held: HeldNode[] = [];
  let done = 0;

  for (const node of plan.nodes) {
    if (readySet.has(node.id)) continue;
    const state = run.nodes[node.id];
    const status = state?.status;
    if (status === "succeeded") {
      done += 1;
      continue;
    }
    const decision = decisions.get(node.id);
    const parkReason = parked.get(node.id);

    if (status === "waiting_founder") {
      const approval = node.approvals.map((item) => item.description).join("; ");
      held.push(describe(node, "founder_approval", approval || state?.blocker || "Waiting on a founder decision."));
    } else if (parkReason !== undefined) {
      held.push(describe(node, "autonomy", parkReason, decision?.reasonCode));
    } else if (status === "blocked") {
      held.push(describe(node, "blocked", state?.blocker ?? "Blocked.", decision?.reasonCode));
    } else {
      const pending = node.dependencies.filter((dependency) => run.nodes[dependency]?.status !== "succeeded");
      held.push(describe(node, "upstream", pending.length > 0 ? `Waits on ${pending.length} earlier step(s).` : "Inputs not produced yet."));
    }
  }

  const batches = buildDispatchBatches(plan, ready, maxConcurrency).map((batch) =>
    batch.nodeIds.map((nodeId) => {
      const node = byId.get(nodeId)!;
      return describe(node, "upstream", "");
    }),
  );
  const readyBriefs = batches.flat().map((entry) => composeNodeBrief(byId.get(entry.nodeId)!, plan));

  return { planId: plan.planId, catalogVersion: plan.catalogVersion, totalNodes: plan.nodes.length, done, batches, readyBriefs, held, autonomyUnset };
}

const HELD_HEADING: Record<HeldReason, string> = {
  founder_approval: "Parked on a founder decision",
  autonomy: "Parked because autonomy does not cover it",
  blocked: "Blocked",
  upstream: "Waiting on earlier work",
};

const HELD_ORDER: readonly HeldReason[] = ["founder_approval", "autonomy", "blocked", "upstream"];

/**
 * Agent-facing, like the session run log and unlike the founder digest — node ids and domain ids
 * are the point here. What the founder sees is the cockpit and the digest, which have their own
 * plain-language contract.
 */
export function renderReport(report: PlanReport): string {
  const lines: string[] = [];
  lines.push(`Plan ${report.planId} (catalog ${report.catalogVersion}): ${report.totalNodes} steps, ${report.done} done.`);

  if (report.autonomyUnset) {
    lines.push("");
    lines.push("This business has no control/control.json, so nothing is granted and every step below is parked.");
    lines.push("Run the onboarding conversation in content/onboarding/autonomy-onboarding.md, then apply it with `npm run onboard:run`.");
  }

  const readyCount = report.batches.reduce((total, batch) => total + batch.length, 0);
  lines.push("");
  if (readyCount === 0) {
    lines.push("Ready now: nothing.");
  } else {
    const groups = report.batches.length === 1 ? "1 group" : `${report.batches.length} groups`;
    lines.push(`Ready now: ${readyCount} step(s), in ${groups}. Everything inside a group can run at the same time.`);
    report.batches.forEach((batch, index) => {
      lines.push(`  Group ${index + 1}:`);
      for (const node of batch) lines.push(`    - ${node.title}  [${node.nodeId}]`);
    });
    // The briefs are the point of the report: an interactive session works each ready node from
    // its brief (do/open/load/produce/verify) instead of re-deriving what to load from prose.
    lines.push("");
    lines.push("Briefs for ready work:");
    for (const brief of report.readyBriefs) {
      lines.push("");
      lines.push(renderNodeBrief(brief));
    }
  }

  for (const reason of HELD_ORDER) {
    const group = report.held.filter((node) => node.reason === reason);
    if (group.length === 0) continue;
    lines.push("");
    lines.push(`${HELD_HEADING[reason]} (${group.length}):`);
    // "Waiting on earlier work" is the uninteresting bulk of any young plan: it is a count, not a
    // list, or the genuinely actionable groups above scroll off the top of the report.
    if (reason === "upstream") continue;
    for (const node of group) {
      const code = node.reasonCode ? ` (${node.reasonCode})` : "";
      lines.push(`  - ${node.title}${code}`);
      lines.push(`    ${node.detail}`);
    }
  }

  return lines.join("\n");
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  if (!args.workspace) {
    console.error("plan.missing_argument: --workspace is required");
    return 1;
  }

  const workspace = path.resolve(args.workspace);
  const paths = resolveWorkspacePaths(workspace, args.catalog);
  const now = args.now ?? new Date().toISOString();
  const maxConcurrency = Number(args["max-concurrency"] ?? 4);

  const businessState: BusinessStateV2 | undefined = loadBusinessStateFile(paths.state);
  if (!businessState) {
    console.error(`plan.workspace_not_ready: no readable business state at ${paths.state}`);
    return 1;
  }

  // A missing control file is a real, expected cold-start state rather than an error: it means
  // onboarding has not happened, which is precisely what the report should say out loud. Empty
  // grants then park every node through the ordinary evaluator path, so the reason each step is
  // held is the true one and not a special case invented here.
  const control: ControlFile | undefined = loadControlFile(paths.control);
  const ledger = loadLedgerFile(paths.ledger, now);
  const plan = compilePlan(loadCatalogFile(paths.catalog), now);

  const run = (() => {
    try {
      const existing = loadRunState(paths.runState);
      if (existing.planId === plan.planId) return existing;
    } catch {
      /* fall through to a fresh seed */
    }
    return seedRunState(plan, businessState, { ownerSessionId: "planner", ttlSeconds: 300, wallClockCapSeconds: 0, now });
  })();
  // Same environmental-artifact acceptance and calendar reopening a real session applies (in
  // memory only — the planner never writes run state). Skipping either would make this report
  // disagree with what a session run moments later would actually do.
  reconcileEnvironmentalArtifacts(plan, run, workspace, now);
  reopenRecurringNodes(plan, run, now);

  const prerequisiteVerifier = createCompositeVerifier({
    doppler_auth: createDopplerAuthVerifier({
      project: args["doppler-project"] ?? control?.businessSlug ?? "",
      config: args["doppler-config"] ?? "production",
      secretsMdPath: args["secrets-md"] ?? path.join(workspace, "SECRETS.md"),
    }),
    budget_funded: createBudgetFundedVerifier(ledger),
  });

  const decisions = new Map<string, AutonomyDecisionDetail>();
  const inner = createAutonomyEvaluator({
    grants: control?.grants ?? {},
    waivers: control?.waivers ?? [],
    ledger,
    prerequisiteVerifier,
    runId: run.runId,
  });
  const evaluator: AutonomyEvaluatorV2 = {
    evaluate(node: CompiledRunNode): AutonomyDecisionDetail {
      const detail = inner.evaluate(node);
      decisions.set(node.id, detail);
      return detail;
    },
  };

  // The clone is the no-write guarantee: computeFrontier promotes and demotes node statuses in
  // place, and the copy it edits is thrown away when this process exits.
  const scratch: RunStateDocument = structuredClone(run);
  const frontier = computeFrontier(plan, scratch, businessState, evaluator);
  const parked = new Map(frontier.parked.map((entry) => [entry.nodeId, entry.reason]));

  const report = buildPlanReport(plan, scratch, frontier.ready, parked, decisions, maxConcurrency, control === undefined);
  console.log(args.json === "true" ? JSON.stringify(report, null, 2) : renderReport(report));
  return 0;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = main();
}
