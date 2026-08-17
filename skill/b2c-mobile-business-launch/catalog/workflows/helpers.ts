import type { LaneKey } from "../../core/schema/types.js";
import type { AreaId, CatalogDomainId, CatalogWorkflowDef, PhaseId, ReferenceId, RoleId, WorkflowId } from "../types.js";

export interface WorkflowSeed {
  id: WorkflowId;
  title: string;
  domainId: CatalogDomainId;
  areaIds: AreaId[];
  trigger: string;
  /** Required node contract (see CatalogWorkflowDef): what to do, what to open, which knowledge to load, who owns it. */
  instructions: string;
  reads?: string[];
  consults?: string[];
  referenceIds?: ReferenceId[];
  roleId: RoleId;
  laneIds?: LaneKey[];
  phaseIds?: PhaseId[];
  dependencies?: WorkflowId[];
  outputPaths?: string[];
  gates?: string[];
  providers?: string[];
  founderOnlyActions?: string[];
  actionClass: CatalogWorkflowDef["actionClass"];
  protectedCategory?: CatalogWorkflowDef["protectedCategory"];
  idempotent: boolean;
  maxAttempts?: number;
  ttlSeconds?: number;
  tokenBudget?: number;
  costEstimate?: CatalogWorkflowDef["costEstimate"];
}

const READINESS_WORKFLOW: WorkflowId = "workflow.operations.agent-operations-ledger";
const READINESS_BOOTSTRAP_WORKFLOWS = new Set<WorkflowId>([
  "workflow.operations.paid-tool-routing-and-fallback",
  "workflow.operations.secrets-baseline-and-routing",
  "workflow.operations.founder-zero-operator-bootstrap",
  READINESS_WORKFLOW,
]);

function dependenciesFor(seed: WorkflowSeed): WorkflowId[] {
  const dependencies = [...(seed.dependencies ?? [])];
  const businessProviderWork = seed.providers?.length && !seed.domainId.startsWith("domain.process") && !seed.domainId.startsWith("domain.orchestration");
  if (businessProviderWork && !READINESS_BOOTSTRAP_WORKFLOWS.has(seed.id) && !dependencies.includes(READINESS_WORKFLOW)) dependencies.push(READINESS_WORKFLOW);
  return dependencies;
}

/**
 * Ported from runtime/graph/workflows/helpers.ts, restructured for the v2 shape. Two
 * differences from v1: `negativeTriggers` is dropped (grep-confirmed dead — every v1
 * workflow set it to `[]` and nothing ever read it); `actionClass`/`idempotent` are
 * required, not optional, because compile.ts's CatalogWorkflowNode needs both to build a
 * dispatchable plan (KTD6).
 */
export function workflow(seed: WorkflowSeed): CatalogWorkflowDef {
  return {
    id: seed.id,
    title: seed.title,
    domainId: seed.domainId,
    areaIds: seed.areaIds,
    trigger: seed.trigger,
    instructions: seed.instructions,
    reads: seed.reads ?? [],
    consults: seed.consults ?? [],
    referenceIds: seed.referenceIds ?? [],
    roleId: seed.roleId,
    laneIds: seed.laneIds ?? [],
    phaseIds: seed.phaseIds ?? [],
    dependencies: dependenciesFor(seed),
    outputPaths: seed.outputPaths ?? [],
    gateCommands: seed.gates ?? [],
    providerIds: seed.providers ?? [],
    founderOnlyActions: seed.founderOnlyActions ?? [],
    actionClass: seed.actionClass,
    protectedCategory: seed.protectedCategory,
    idempotent: seed.idempotent,
    maxAttempts: seed.maxAttempts,
    ttlSeconds: seed.ttlSeconds,
    tokenBudget: seed.tokenBudget,
    costEstimate: seed.costEstimate,
  };
}
