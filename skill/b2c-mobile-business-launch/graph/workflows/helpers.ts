import type { AreaId, DomainId, LaneId, OperatorId, PhaseId, ProviderId, WorkflowDefinition, WorkflowId } from "../types.js";

export interface WorkflowSeed {
  legacyId: `L${string}`;
  id: WorkflowId;
  title: string;
  domainId: DomainId;
  areaIds: AreaId[];
  trigger: string;
  laneIds?: LaneId[];
  phaseIds?: PhaseId[];
  upstreamWorkflowIds?: WorkflowId[];
  artifacts?: string[];
  gates?: string[];
  providers?: ProviderId[];
  operators?: OperatorId[];
  founderOnlyActions?: string[];
}

export function workflow(seed: WorkflowSeed): WorkflowDefinition {
  const gateProof = (seed.gates ?? []).map((gate) => `${gate} exits 0`);
  const artifacts = seed.artifacts ?? [];
  const laneMemory = (seed.laneIds ?? []).map((lane) => `PROJECT_STATE.yaml ${lane}`);
  return {
    id: seed.id,
    legacyId: seed.legacyId,
    title: seed.title,
    domainId: seed.domainId,
    areaIds: seed.areaIds,
    trigger: seed.trigger,
    negativeTriggers: [],
    action: [
      `Load context.${seed.domainId.slice("domain.".length)} and recover current source truth before changing ${seed.title.toLowerCase()}.`,
      `Execute the bounded ${seed.title.toLowerCase()} procedure, update its canonical artifacts, and reconcile PROJECT_STATE.yaml.`,
      "Run every deterministic gate named by this workflow and record proof or a concrete blocker.",
    ],
    proof: gateProof.length > 0 ? gateProof : artifacts.map((artifact) => `${artifact} contains the required checkable state`),
    memory: [...laneMemory, ...artifacts],
    stoppingCondition:
      gateProof.length > 0
        ? `${gateProof.join(" and ")}, or PROJECT_STATE.yaml records a dated founder-only gate or concrete blocker.`
        : `${artifacts.join(", ") || "the canonical artifact"} records an observable completion state or a dated blocker.`,
    contextPackIds: [`context.${seed.domainId.slice("domain.".length)}`],
    referenceIds: [],
    phaseIds: seed.phaseIds ?? [],
    laneIds: seed.laneIds ?? [],
    upstreamWorkflowIds: seed.upstreamWorkflowIds ?? [],
    artifactPaths: artifacts,
    gateCommands: seed.gates ?? [],
    providerIds: seed.providers ?? [],
    operatorIds: seed.operators ?? ["operator.orchestrator"],
    founderOnlyActions: seed.founderOnlyActions ?? [],
    sourcePath: "docs/history/skill-workflow-loops-2026-08-v0.64.0.md",
  };
}
