#!/usr/bin/env node
/**
 * Founder-decision CLI: grant or reject a pending approval on the durable run state.
 *
 * This is the only sanctioned path from `waiting_founder` back to schedulable work
 * (the run-node lifecycle's founder edge). Run-state is engine-owned, so the write goes
 * through the engine's atomic writer; the decision itself is attested in the reducer's
 * hash-chained audit log so a granted approval is never invisible to the accountability
 * record. Rejection parks the node as `blocked` with a founder-stated reason.
 *
 * Usage:
 *   tsx core/session/approve.ts --workspace <dir> --approval <id> --decision approved|rejected \
 *     --session <id> [--reason <text>] [--list]
 *
 * Exit codes: 0 = recorded (or list printed); 1 = unknown approval/invalid input.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { isMainModule, parseArgs } from "../lib/cli.js";
import { appendAuditEntry } from "../reducer/audit.js";
import { compilePlan, type CatalogInput, type RunNodeId } from "../engine/compile.js";
import { loadRunState, writeRunState } from "../engine/runstate.js";
import type { RunStateDocument } from "../schema/types.js";

function listPending(run: RunStateDocument): number {
  const pending = Object.entries(run.approvals).filter(([, status]) => status === "pending");
  if (pending.length === 0) {
    console.log("No approvals waiting.");
    return 0;
  }
  for (const [id] of pending) console.log(`PENDING ${id}`);
  return 0;
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  if (!args.workspace) {
    console.error(
      "Usage: tsx core/session/approve.ts --workspace <dir> [--list] --approval <id> --decision approved|rejected --session <id> [--reason <text>]",
    );
    return 1;
  }
  const workspace = path.resolve(args.workspace);
  const runStatePath = path.join(workspace, "run", "run-state.json");
  // loadRunState throws (readFileSync ENOENTs, or schema validation fails) rather than ever
  // returning a falsy value — an `if (!run)` check after a bare call is dead code that can never
  // fire. Catch here instead, so a missing/invalid run state produces the friendly ISSUE message
  // rather than an uncaught exception and a raw stack trace.
  let run: RunStateDocument;
  try {
    run = loadRunState(runStatePath);
  } catch (error) {
    console.error(
      `ISSUE approve.no_run_state: ${runStatePath} does not exist or is not a valid run state — run a session first (${error instanceof Error ? error.message : String(error)})`,
    );
    return 1;
  }
  if (args.list === "true") return listPending(run);

  const approvalId = args.approval;
  const decision = args.decision;
  const sessionId = args.session;
  if (!approvalId || !sessionId || (decision !== "approved" && decision !== "rejected")) {
    console.error("ISSUE approve.invalid_input: --approval, --session, and --decision approved|rejected are required");
    return 1;
  }
  if (run.approvals[approvalId] === undefined) {
    console.error(`ISSUE approve.unknown_approval: "${approvalId}" is not a pending approval on this run`);
    return 1;
  }
  const now = new Date().toISOString();
  run.approvals[approvalId] = decision;
  if (run.approvalProvenance) delete run.approvalProvenance[approvalId];
  const catalogPath = path.join(workspace, "catalog.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as CatalogInput;
  const plan = compilePlan(catalog);
  const affected = new Set<RunNodeId>(plan.nodes.filter((node) => node.approvals.some((approval) => approval.id === approvalId)).map((node) => node.id));
  for (const node of Object.values(run.nodes)) {
    if (!affected.has(node.nodeId as RunNodeId) || node.status !== "waiting_founder") continue;
    if (decision === "approved") {
      node.status = "pending";
      node.blocker = undefined;
    } else {
      node.status = "blocked";
      node.blocker = args.reason ? `Founder declined: ${args.reason}` : "Founder declined this approval.";
    }
  }
  run.updatedAt = now;
  writeRunState(runStatePath, run);
  appendAuditEntry(path.join(workspace, "control", "audit.jsonl"), {
    sessionId,
    targetDoc: "run-state",
    patchId: `approve:${sessionId}:${approvalId}`,
    action: decision === "approved" ? "founder_approval_granted" : "founder_approval_rejected",
    summary: args.reason ? `${approvalId}: ${args.reason}` : approvalId,
    stateHash: "",
    issueCodes: [],
  });
  console.log(`RECORDED ${approvalId} ${decision}`);
  return 0;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = main();
}
