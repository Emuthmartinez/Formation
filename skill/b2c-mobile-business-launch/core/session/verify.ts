#!/usr/bin/env node
/**
 * Fresh-context verification CLI: the sanctioned non-producer acceptance path for a node whose
 * outputs landed blocked pending verification (judgment domains, and — since the 2026-08
 * verification flip — any gateless node with outputs; auto-accept on delivery no longer exists).
 *
 * Deterministic nodes are refused here on purpose: their gates ARE the verification, run by the
 * session itself. This CLI covers the other kind, where a person or a fresh-context reviewer
 * session judges the work. Producer≠verifier is enforced mechanically: the accepting --session
 * must differ from the session that produced the blocked attempt. The write goes through the
 * engine's atomic writer and the acceptance is attested in the reducer's hash-chained audit log,
 * mirroring core/session/approve.ts (the founder edge; this is the verifier edge).
 *
 * Usage:
 *   tsx core/session/verify.ts --workspace <dir> --list
 *   tsx core/session/verify.ts --workspace <dir> --node <workflow-or-run-node-id> \
 *     --session <id> --evidence <text>
 *
 * Exit codes: 0 = accepted (or list printed); 1 = unknown node/invalid input/refused.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { isMainModule, parseArgs } from "../lib/cli.js";
import { appendAuditEntry } from "../reducer/audit.js";
import { compilePlan, type CatalogInput, type CompiledPlan, type RunNodeId } from "../engine/compile.js";
import { acceptVerification, loadRunState, writeRunState } from "../engine/runstate.js";
import type { RunStateDocument } from "../schema/types.js";

function pendingVerification(run: RunStateDocument, plan: CompiledPlan): RunNodeId[] {
  const byId = new Map(plan.nodes.map((node) => [node.id as string, node]));
  return Object.values(run.nodes)
    .filter((node) => {
      const planned = byId.get(node.nodeId);
      return planned && node.status === "blocked" && node.blocker === "Verification required" && planned.verification.kind === "fresh_context";
    })
    .map((node) => node.nodeId as RunNodeId);
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  if (!args.workspace) {
    console.error("Usage: tsx core/session/verify.ts --workspace <dir> [--list] --node <id> --session <id> --evidence <text>");
    return 1;
  }
  const workspace = path.resolve(args.workspace);
  const runStatePath = path.join(workspace, "run", "run-state.json");
  let run: RunStateDocument;
  try {
    run = loadRunState(runStatePath);
  } catch (error) {
    console.error(
      `ISSUE verify.no_run_state: ${runStatePath} does not exist or is not a valid run state — run a session first (${error instanceof Error ? error.message : String(error)})`,
    );
    return 1;
  }
  const catalog = JSON.parse(readFileSync(path.join(workspace, "catalog.json"), "utf8")) as CatalogInput;
  const plan = compilePlan(catalog);

  if (args.list === "true") {
    const pending = pendingVerification(run, plan);
    if (pending.length === 0) console.log("No nodes waiting on verification.");
    for (const nodeId of pending) console.log(`PENDING ${nodeId}`);
    return 0;
  }

  const sessionId = args.session;
  const evidence = args.evidence?.trim();
  const rawNodeId = args.node;
  if (!rawNodeId || !sessionId) {
    console.error("ISSUE verify.invalid_input: --node and --session are required");
    return 1;
  }
  if (!evidence) {
    console.error("ISSUE verify.evidence_required: --evidence must state what was checked and why it holds; empty acceptance is the auto-accept hole again");
    return 1;
  }
  const nodeId = (rawNodeId.startsWith("workflow.") ? `run.${rawNodeId.slice("workflow.".length)}` : rawNodeId) as RunNodeId;
  const planned = plan.nodes.find((node) => node.id === nodeId);
  const state = run.nodes[nodeId];
  if (!planned || !state) {
    console.error(`ISSUE verify.unknown_node: "${rawNodeId}" is not a node on this run`);
    return 1;
  }
  if (planned.verification.kind !== "fresh_context") {
    console.error(`ISSUE verify.wrong_kind: ${nodeId} verifies as ${planned.verification.kind} — its gates are the acceptance path, not this CLI`);
    return 1;
  }
  if (state.status !== "blocked" || state.blocker !== "Verification required") {
    console.error(`ISSUE verify.not_pending: ${nodeId} is ${state.status}${state.blocker ? ` (${state.blocker})` : ""}, not blocked pending verification`);
    return 1;
  }
  const producingAttempt = [...state.attempts].reverse().find((attempt) => attempt.status === "blocked");
  if (producingAttempt && producingAttempt.ownerSessionId === sessionId) {
    console.error(
      `ISSUE verify.producer_cannot_verify: ${producingAttempt.ownerSessionId} produced this attempt — a different session must judge it (producer never verifies its own work)`,
    );
    return 1;
  }

  const now = new Date().toISOString();
  acceptVerification(plan, run, nodeId, [evidence], now);
  writeRunState(runStatePath, run);
  appendAuditEntry(path.join(workspace, "control", "audit.jsonl"), {
    sessionId,
    targetDoc: "run-state",
    patchId: `verify:${sessionId}:${nodeId}`,
    action: "verification_accepted",
    summary: `${nodeId}: ${evidence}`,
    stateHash: "",
    issueCodes: [],
  });
  console.log(`VERIFIED ${nodeId}`);
  return 0;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = main();
}
