import type { CompiledPlan, RunNodeId } from "./compile.js";
import type { RunStateDocument } from "../schema/types.js";

/**
 * Fresh-context acceptance rules, shared by the two verifier edges: the operator CLI
 * (core/session/verify.ts) and the scheduled session's own verifier pass (core/session/run.ts).
 * One rule set, two callers — a second hand-rolled copy of the producer≠verifier refusal is
 * exactly how the two edges would drift apart.
 */

export const VERIFICATION_REQUIRED_BLOCKER = "Verification required";
/**
 * Set when an independent verifier judged the produced work and did not accept it. Deliberately
 * NOT part of the pending pool: a rejection is a durable judgment for a person (or a fresh
 * producer attempt) to act on, not something the next session's sweep should silently re-litigate.
 * An unavailable verifier, by contrast, leaves the pending blocker untouched — silence judged
 * nothing, so the work stays in the pool for the next sweep.
 */
export const VERIFICATION_REJECTED_BLOCKER = "Verification rejected.";

/** Nodes whose produced work is parked waiting on a fresh-context judgment. */
export function listPendingFreshContext(plan: CompiledPlan, run: RunStateDocument): RunNodeId[] {
  const byId = new Map(plan.nodes.map((node) => [node.id as string, node]));
  return Object.values(run.nodes)
    .filter((node) => {
      const planned = byId.get(node.nodeId);
      return planned && node.status === "blocked" && node.blocker === VERIFICATION_REQUIRED_BLOCKER && planned.verification.kind === "fresh_context";
    })
    .map((node) => node.nodeId as RunNodeId);
}

export interface FreshContextRefusal {
  readonly code: "unknown_node" | "wrong_kind" | "not_pending" | "producer_cannot_verify";
  readonly message: string;
}

/**
 * Producer≠verifier, mechanically (R15): the accepting session must not own ANY attempt on the
 * node — not just the latest — and only a node genuinely parked pending verification may be
 * promoted. Returns the refusal, or undefined when acceptance may proceed. This binds to
 * run-state provenance, not to the label alone; the residual (a local caller minting a fresh id)
 * is caught where it matters: the execution boundary refuses to export a fresh-context result
 * whose recorded verifier equals the producing attempt's owner, and every acceptance is attested
 * in the hash-chained audit log either way.
 */
export function refuseFreshContextAcceptance(
  plan: CompiledPlan,
  run: RunStateDocument,
  nodeId: RunNodeId,
  verifierSessionId: string,
): FreshContextRefusal | undefined {
  const planned = plan.nodes.find((node) => node.id === nodeId);
  const state = run.nodes[nodeId];
  if (!planned || !state) return { code: "unknown_node", message: `"${nodeId}" is not a node on this run` };
  if (planned.verification.kind !== "fresh_context") {
    return { code: "wrong_kind", message: `${nodeId} verifies as ${planned.verification.kind} — its gates are the acceptance path, not a fresh-context verifier` };
  }
  if (state.status !== "blocked" || state.blocker !== VERIFICATION_REQUIRED_BLOCKER) {
    return { code: "not_pending", message: `${nodeId} is ${state.status}${state.blocker ? ` (${state.blocker})` : ""}, not blocked pending verification` };
  }
  const priorOwner = state.attempts.find((attempt) => attempt.ownerSessionId === verifierSessionId);
  if (priorOwner) {
    return {
      code: "producer_cannot_verify",
      message: `${verifierSessionId} owns attempt ${priorOwner.id} on this node — a different session must judge it (producer never verifies its own work)`,
    };
  }
  return undefined;
}
