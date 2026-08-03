export type GraphNodeKind = "area" | "domain" | "phase" | "lane" | "reference" | "context" | "workflow" | "artifact" | "gate" | "operator" | "provider";

export type GraphId = `${GraphNodeKind}.${string}`;
export type AreaId = `area.${string}`;
export type DomainId = `domain.${string}`;
export type PhaseId = `phase.${string}`;
export type LaneId = `lane.${string}`;
export type ReferenceId = `reference.${string}`;
export type ContextPackId = `context.${string}`;
export type WorkflowId = `workflow.${string}`;
export type ArtifactId = `artifact.${string}`;
export type GateId = `gate.${string}`;
export type OperatorId = `operator.${string}`;
export type ProviderId = `provider.${string}`;

export interface BusinessAreaDefinition {
  id: AreaId;
  name: string;
  description: string;
  domainIds: DomainId[];
}

export interface DomainDefinition {
  id: DomainId;
  slug: string;
  name: string;
  areaIds: AreaId[];
  indexPath?: string;
  routeWhen: string;
  routeLabel: string;
  order: number;
}

export interface PhaseDefinition {
  id: PhaseId;
  key: string;
  label: string;
  focus: string;
  primaryOutput: string;
  order: number;
  orientWindow?: boolean;
}

export interface LaneDefinition {
  id: LaneId;
  key: string;
  label: string;
  ownerDomainId: DomainId;
  dependencyIds: LaneId[];
}

export interface ReferenceDefinition {
  id: ReferenceId;
  path: string;
  domainId: DomainId;
  title: string;
  loadWhen: string;
  bytes: number;
  index?: boolean;
}

export type ContextLoadStrategy = "load-all" | "select-one" | "progressive";

export interface ContextPackDefinition {
  id: ContextPackId;
  name: string;
  domainId: DomainId;
  strategy: ContextLoadStrategy;
  indexReferenceId?: ReferenceId;
  entryReferenceIds: ReferenceId[];
  referenceIds: ReferenceId[];
  selectionRule: string;
}

export interface WorkflowDefinition {
  id: WorkflowId;
  legacyId?: `L${string}`;
  title: string;
  domainId: DomainId;
  areaIds: AreaId[];
  trigger: string;
  negativeTriggers: string[];
  action: string[];
  proof: string[];
  memory: string[];
  stoppingCondition: string;
  contextPackIds: ContextPackId[];
  referenceIds: ReferenceId[];
  phaseIds: PhaseId[];
  laneIds: LaneId[];
  upstreamWorkflowIds: WorkflowId[];
  artifactPaths: string[];
  gateCommands: string[];
  providerIds: ProviderId[];
  operatorIds: OperatorId[];
  founderOnlyActions: string[];
  sourcePath: string;
}

export interface ArtifactDefinition {
  id: ArtifactId;
  path: string;
  ownerDomainId: DomainId;
  laneIds: LaneId[];
  generated: boolean;
}

export interface GateDefinition {
  id: GateId;
  command: string;
  scriptPath?: string;
  ownerDomainId: DomainId;
  audit: "required" | "excluded" | "manual";
  launchbenchValidator?: string;
}

export interface OperatorDefinition {
  id: OperatorId;
  name: string;
  kind: "human" | "agent" | "system";
  goal: string;
  domainIds: DomainId[];
  contextPackIds: ContextPackId[];
  allowedActions: string[];
  founderGatedActions: string[];
  forbiddenActions: string[];
  artifactPaths: string[];
  promptPath?: string;
}

export interface ProviderDefinition {
  id: ProviderId;
  key: string;
  name: string;
  ownerDomainId: DomainId;
  route: string;
  requiredSecrets: string[];
  preflight: string;
  validation: string;
  fallback: string;
}

export interface SkillGraph {
  schemaVersion: "1.0.0";
  skillVersion: string;
  areas: BusinessAreaDefinition[];
  domains: DomainDefinition[];
  phases: PhaseDefinition[];
  lanes: LaneDefinition[];
  references: ReferenceDefinition[];
  contextPacks: ContextPackDefinition[];
  workflows: WorkflowDefinition[];
  artifacts: ArtifactDefinition[];
  gates: GateDefinition[];
  operators: OperatorDefinition[];
  providers: ProviderDefinition[];
}

export interface GraphIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  path?: string;
}
