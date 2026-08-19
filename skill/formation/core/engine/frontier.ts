import type { BusinessStateV2, RunStateDocument, Status } from "../schema/types.js";
import type { CompiledPlan, CompiledRunNode, RunNodeId, StatePredicate } from "./compile.js";
import { reconcileWorkflowApplicability } from "./runstate.js";

export interface AutonomyDecision {
  allowed: boolean;
  parkReason?: string;
}

/**
 * Frontier's autonomy gate (KTD5, R7). U2 defines and stubs this; U4 implements grant, waiver,
 * prerequisite-TTL, and budget evaluation behind it. Synchronous by design: sessions here are
 * short-lived headless CLI runs (KTD1), and this repo's own CLI tooling is synchronous throughout
 * (spawnSync, readFileSync) — U4's real evaluator can use blocking I/O without an async surface.
 */
export interface AutonomyEvaluator {
  evaluate(node: CompiledRunNode): AutonomyDecision;
}

export const allowAllAutonomyEvaluator: AutonomyEvaluator = { evaluate: () => ({ allowed: true }) };

export interface ParkedNode {
  nodeId: RunNodeId;
  reason: string;
}

export interface FrontierResult {
  ready: RunNodeId[];
  parked: ParkedNode[];
}

/**
 * Only pending/ready/stale nodes are re-examined each pass (ported from v1 computeFrontier).
 * A node demoted to blocked/waiting_founder stays put until something explicit (a reducer
 * applying a founder decision or a grant change) resets it to pending — frontier does not
 * silently re-poll a settled gate every cycle.
 */
const READY_ELIGIBLE_STATUSES: readonly Status[] = ["pending", "ready", "stale"];

/**
 * Readiness = deps succeeded + inputs accepted + state predicates pass + autonomy evaluator
 * allows + (if approvals are required) they're all approved. Order matches the run-node
 * lifecycle diagram: ready gates on grants before the approval check can demote it further to
 * waiting_founder.
 */
export function computeFrontier(plan: CompiledPlan, run: RunStateDocument, businessState: BusinessStateV2, evaluator: AutonomyEvaluator): FrontierResult {
  reconcileWorkflowApplicability(plan, run, businessState, new Date().toISOString());
  const accepted = new Set(run.artifactBindings.filter((binding) => binding.accepted).map((binding) => binding.artifactId));
  const ready: RunNodeId[] = [];
  const parked: ParkedNode[] = [];

  for (const node of plan.nodes) {
    const state = run.nodes[node.id];
    if (!state || !READY_ELIGIBLE_STATUSES.includes(state.status)) continue;
    if (node.dependencies.some((dependency) => run.nodes[dependency]?.status !== "succeeded")) continue;
    if (node.inputs.some((artifactId) => !accepted.has(artifactId))) continue;

    const failedPredicate = node.statePredicates.find((predicate) => !evaluatePredicate(businessState, predicate));
    if (failedPredicate) {
      state.status = "blocked";
      state.blocker = `State predicate failed: ${failedPredicate.path} ${failedPredicate.operator}`;
      continue;
    }

    const decision = evaluateAutonomy(evaluator, node);
    if (!decision.allowed) {
      const reason = decision.parkReason ?? "Autonomy evaluator rejected this node.";
      state.status = "blocked";
      state.blocker = reason;
      parked.push({ nodeId: node.id, reason });
      continue;
    }

    const approvalStatuses = node.approvals.map((approval) => run.approvals[approval.id]);
    if (approvalStatuses.some((status) => status === "rejected")) {
      state.status = "blocked";
      state.blocker = "A required founder approval was rejected.";
      continue;
    }
    if (approvalStatuses.some((status) => status !== "approved")) {
      state.status = "waiting_founder";
      state.blocker = "Founder approval required";
      continue;
    }

    state.status = "ready";
    state.blocker = undefined;
    ready.push(node.id);
  }

  return { ready, parked };
}

/** Fail closed: an evaluator that throws is treated exactly like an explicit rejection. */
function evaluateAutonomy(evaluator: AutonomyEvaluator, node: CompiledRunNode): AutonomyDecision {
  try {
    return evaluator.evaluate(node);
  } catch (error) {
    return { allowed: false, parkReason: `Autonomy evaluator error, failing closed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function evaluatePredicate(state: BusinessStateV2, predicate: StatePredicate): boolean {
  const value = getPath(state, predicate.path);
  if (predicate.operator === "exists") return value !== undefined;
  if (predicate.operator === "equals") return Object.is(value, predicate.value);
  const values = Array.isArray(predicate.value) ? predicate.value : [];
  if (predicate.operator === "in") return values.includes(value);
  return !values.includes(value);
}

function getPath(value: unknown, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((current, key) => {
    if (typeof current !== "object" || current === null || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}
