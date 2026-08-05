import type { ActionClass, BudgetLedgerDocument, GrantLevel, GrantsMap, ProtectedCategory, Waiver } from "../schema/types.js";
import type { AutonomyDecision, AutonomyEvaluator } from "../engine/frontier.js";
import type { CompiledRunNode, RunNodeId } from "../engine/compile.js";
import { evaluateGrantCeiling } from "./grants.js";
import { SessionPrerequisiteCache, evaluatePrerequisites, type PrerequisiteVerifier } from "./prerequisites.js";
import { evaluateProtectedAction } from "./waivers.js";

export type { DispatchHooksDeps } from "./killswitch.js";
export { createDispatchHooks } from "./killswitch.js";

/**
 * Structured decision (KTD5, U4 -> U5 handoff): the session runner (U5) turns this into
 * ledger/audit patches — this module only ever produces decisions and evidence payloads, never
 * writes. `allowed`/`parkReason` satisfy engine/frontier.ts's AutonomyDecision contract;
 * everything else is additive detail for the caller that holds the AutonomyEvaluatorV2 type
 * directly (frontier.ts itself only ever sees the narrower AutonomyDecision shape).
 */
export interface AutonomyDecisionDetail extends AutonomyDecision {
  readonly nodeId: RunNodeId;
  readonly domainId: string;
  readonly actionClass: ActionClass;
  readonly protectedCategory?: ProtectedCategory;
  readonly reasonCode: string;
  readonly grantLevel?: GrantLevel;
  readonly waiverId?: string;
  readonly budgetUnit?: string;
  readonly budgetPeriod?: string;
  readonly estimateAmount?: number;
  readonly estimateCurrency?: string;
  readonly remainingBudget?: number;
  /** Envelope evidence refs for an executed protected action (R8) — opaque identifiers, not the evidence payloads themselves. */
  readonly evidenceRefs: readonly string[];
}

export interface AutonomyEvaluatorV2 extends AutonomyEvaluator {
  evaluate(node: CompiledRunNode): AutonomyDecisionDetail;
}

export interface AutonomyDeps {
  readonly grants: GrantsMap;
  readonly waivers: readonly Waiver[];
  readonly ledger: BudgetLedgerDocument;
  readonly prerequisiteVerifier: PrerequisiteVerifier;
  /** Needed only for waivers whose budgetPeriod is "per_run". */
  readonly runId?: string;
  readonly now?: () => string;
}

/**
 * The autonomy engine's single entry point (KTD5, R5-R11): implements the Autonomy decision
 * flowchart's grant -> prerequisite -> protected/waiver sequence (kill switch is a separate,
 * dispatch-batch-boundary concern — see killswitch.ts's DispatchHooks factory, re-exported
 * above). One SessionPrerequisiteCache is shared across every `evaluate()` call from this
 * factory's returned evaluator, which is what makes a mid-session prerequisite lapse park every
 * node depending on that grant, not just the node that happened to trigger the probe (R7).
 */
export function createAutonomyEvaluator(deps: AutonomyDeps): AutonomyEvaluatorV2 {
  const now = deps.now ?? (() => new Date().toISOString());
  const prerequisiteCache = new SessionPrerequisiteCache(deps.prerequisiteVerifier, now);

  return {
    evaluate(node: CompiledRunNode): AutonomyDecisionDetail {
      const base = { nodeId: node.id, domainId: node.domainId, actionClass: node.actionClass, protectedCategory: node.protectedCategory, evidenceRefs: [] as readonly string[] };

      const ceiling = evaluateGrantCeiling(deps.grants, node.domainId, node.actionClass);
      if (!ceiling.ok) {
        return { ...base, allowed: false, parkReason: ceiling.reason, reasonCode: ceiling.reasonCode, grantLevel: ceiling.grant?.level };
      }
      const grant = ceiling.grant!;

      const prerequisites = evaluatePrerequisites(prerequisiteCache, grant);
      if (!prerequisites.ok) {
        return { ...base, allowed: false, parkReason: prerequisites.reason, reasonCode: prerequisites.reasonCode, grantLevel: grant.level };
      }

      const nowIso = now();
      const waiverResult = evaluateProtectedAction(node, deps.waivers, deps.ledger, nowIso, deps.runId);
      if (!waiverResult.ok) {
        return { ...base, allowed: false, parkReason: waiverResult.reason, reasonCode: waiverResult.reasonCode, grantLevel: grant.level, waiverId: waiverResult.waiver?.id };
      }

      const evidenceRefs = waiverResult.waiver ? [`waiver:${waiverResult.waiver.id}`, `node:${node.id}`, `at:${nowIso}`] : [];
      return {
        ...base,
        allowed: true,
        reasonCode: waiverResult.reasonCode,
        grantLevel: grant.level,
        waiverId: waiverResult.waiver?.id,
        budgetUnit: waiverResult.budget?.unit,
        budgetPeriod: waiverResult.budget?.period,
        estimateAmount: waiverResult.budget?.estimateAmount,
        estimateCurrency: waiverResult.budget?.currency,
        remainingBudget: waiverResult.budget?.remaining,
        evidenceRefs,
      };
    },
  };
}
