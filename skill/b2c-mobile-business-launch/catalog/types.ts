import type { ActionClass, GrantableDomainId, LaneKey, ProtectedCategory } from "../core/schema/types.js";

/**
 * The v2 definition-graph-as-data types (U8; KTD6, R20). Ported and restructured from
 * runtime/graph/types.js: domains/lanes/phases/areas keep their v1 shape (stable data,
 * no reason to change it); workflows gain the action-class/protected-category/idempotency
 * fields the v1 graph never needed because it had no execution half; references drop the
 * scraped-from-README loadWhen and carry it as authored data instead (the R20 inversion).
 */

export type AreaId = `area.${string}`;
/** Broader than core/schema's GrantableDomainId: also covers domain.process, domain.orchestration, domain.machine (KTD3 system domains). */
export type CatalogDomainId = `domain.${string}`;
export type PhaseId = `phase.${string}`;
export type LaneId = `lane.${string}`;
export type ReferenceId = `reference.${string}`;
export type WorkflowId = `workflow.${string}`;
export type ArtifactId = `artifact.${string}`;
export type GateId = `gate.${string}`;

export interface CatalogArea {
  id: AreaId;
  name: string;
  description: string;
  domainIds: CatalogDomainId[];
}

export interface CatalogDomain {
  id: CatalogDomainId;
  slug: string;
  name: string;
  areaIds: AreaId[];
  /** Path to the domain's content index (v1: knowledge/<slug>/README.md; ports unchanged as a path — the file's ROLE as a routing table is what R20 retires). */
  indexPath?: string;
  routeLabel: string;
  routeWhen: string;
  order: number;
}

export interface CatalogPhase {
  id: PhaseId;
  key: string;
  label: string;
  focus: string;
  primaryOutput: string;
  order: number;
  orientWindow?: boolean;
}

export interface CatalogLane {
  id: LaneId;
  key: LaneKey;
  label: string;
  ownerDomainId: CatalogDomainId;
  dependencyIds: LaneId[];
}

/**
 * A content reference with its load-when condition authored as catalog DATA (R20).
 * v1's runtime/graph/catalog.ts scraped this text out of a hand-authored README table;
 * here it is the source of truth, and catalog/render-routing.ts projects it back into
 * a generated table instead of the other way around.
 */
export interface CatalogReference {
  id: ReferenceId;
  path: string;
  domainId: CatalogDomainId;
  title: string;
  loadWhen: string;
  /** True for a domain hub/index file that itself routes to satellite references (e.g. experience-cards.md, tool-recipes.md). */
  hub?: boolean;
}

/**
 * Source-level workflow definition (pre-bridge). Carries every v1 WorkflowDefinition field
 * except the always-empty `negativeTriggers` (dead since v1 shipped — never read anywhere),
 * plus the v2 dispatch fields compile.ts's CatalogWorkflowNode requires.
 */
export interface CatalogWorkflowDef {
  id: WorkflowId;
  title: string;
  domainId: CatalogDomainId;
  areaIds: AreaId[];
  trigger: string;
  laneIds: LaneKey[];
  phaseIds: PhaseId[];
  dependencies: WorkflowId[];
  outputPaths: string[];
  gateCommands: string[];
  providerIds: string[];
  founderOnlyActions: string[];
  /** v2: dispatch/autonomy fields the v1 graph had no execution half to need (KTD6). */
  actionClass: ActionClass;
  protectedCategory?: ProtectedCategory;
  idempotent: boolean;
  maxAttempts?: number;
  ttlSeconds?: number;
  tokenBudget?: number;
}

export interface CatalogGate {
  id: GateId;
  command: string;
  scriptPath?: string;
  ownerDomainId: CatalogDomainId;
  audit: "required" | "excluded" | "manual";
}

export interface CatalogArtifact {
  id: ArtifactId;
  path: string;
  ownerDomainId: CatalogDomainId;
  laneIds: LaneKey[];
  generated: boolean;
}

export interface Catalog {
  schemaVersion: "2.0.0";
  skillVersion: string;
  areas: CatalogArea[];
  domains: CatalogDomain[];
  phases: CatalogPhase[];
  lanes: CatalogLane[];
  references: CatalogReference[];
  workflows: CatalogWorkflowDef[];
  artifacts: CatalogArtifact[];
  gates: CatalogGate[];
}

export interface CatalogIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  path?: string;
}

/** domainId values that are runtime machinery, never founder-grantable (KTD3). Kept local so catalog/ has no runtime coupling; core/schema/types.ts's grantableDomainIds is the cross-check in validate.ts. */
export const systemCatalogDomainIds: readonly CatalogDomainId[] = ["domain.process", "domain.orchestration"];
export const machineCatalogDomainId: CatalogDomainId = "domain.machine";

export function isGrantableDomainId(value: CatalogDomainId, grantable: readonly GrantableDomainId[]): value is GrantableDomainId {
  return (grantable as readonly string[]).includes(value);
}
