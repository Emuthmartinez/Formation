import type { AreaId, DomainId, LaneId, OperatorId, PhaseId, ProviderId, WorkflowDefinition, WorkflowId } from "../types.js";

export interface WorkflowSeed {
  id: WorkflowId;
  title: string;
  domainId: DomainId;
  areaIds: AreaId[];
  trigger: string;
  laneIds?: LaneId[];
  phaseIds?: PhaseId[];
  dependencies?: WorkflowId[];
  outputPaths?: string[];
  gates?: string[];
  providers?: ProviderId[];
  operators?: OperatorId[];
  founderOnlyActions?: string[];
}

export function workflow(seed: WorkflowSeed): WorkflowDefinition {
  return {
    id: seed.id,
    title: seed.title,
    domainId: seed.domainId,
    areaIds: seed.areaIds,
    trigger: seed.trigger,
    negativeTriggers: [],
    contextPackIds: [`context.${seed.domainId.slice("domain.".length)}`],
    referenceIds: [],
    phaseIds: seed.phaseIds ?? [],
    laneIds: seed.laneIds ?? [],
    dependencies: seed.dependencies ?? [],
    outputPaths: seed.outputPaths ?? [],
    gateCommands: seed.gates ?? [],
    providerIds: seed.providers ?? [],
    operatorIds: seed.operators ?? ["operator.orchestrator"],
    founderOnlyActions: seed.founderOnlyActions ?? [],
    sourcePath: "graph/workflows",
  };
}
