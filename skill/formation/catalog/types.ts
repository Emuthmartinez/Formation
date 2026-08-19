import type { ActionClass, GrantableDomainId, LaneKey, ProtectedCategory } from "../core/schema/types.js";

/**
 * The v2 definition-graph-as-data types (U8; KTD6, R20). Ported and restructured from
 * runtime/graph/types.js: domains/lanes/phases/areas keep their v1 shape (stable data,
 * no reason to change it); workflows gain the action-class/protected-category/idempotency
 * fields the v1 graph never needed because it had no execution half; references drop the
 * scraped-from-README loadWhen and carry it as authored data instead (the R20 inversion).
 */

export type AreaId = `area.${string}`;
export type RoleId = `role.${string}`;
export type ContextPackId = `context.${string}`;
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
  /**
   * True for a backlink-enforced hub: a routing file whose spokes each open with a "Part of the
   * [Hub](...)" backlink. check:hub-spoke enforces the flag in both directions (a flagged hub
   * must have real spokes; a file with spokes must be flagged), so this is data code checks —
   * not a rhetorical label.
   */
  hub?: boolean;
  /**
   * True for always-on/orientation references a SESSION loads (Start Here, Always-On Contracts,
   * autonomy, writing bar) rather than any one workflow node. Every reference must either be
   * bound by at least one workflow's referenceIds or carry this flag — an unbound, unflagged
   * reference is knowledge nothing routes to, and validate.ts rejects it
   * (catalog_graph.reference.unbound).
   */
  sessionScoped?: boolean;
  lifecycle: "draft" | "active" | "deprecated";
  applicabilityNotes: string;
  sourceExemption?: string;
  sources: CatalogKnowledgeSource[];
  replacementIds: ReferenceId[];
}

export interface CatalogKnowledgeSource {
  id: string;
  name: string;
  sourceType: string;
  url: string;
  reviewCadenceDays: number;
  claimScope: string;
  lastReviewDate: string;
  reviewer: string;
}

export interface CatalogKnowledgePackage extends CatalogReference {
  workflowIds: WorkflowId[];
  contextPackIds: ContextPackId[];
  manifestPath: string;
  /**
   * True for a terminal deprecation: the package is deprecated with no
   * successor (a retired learning, a withdrawn contract). Exempts the package
   * from knowledge.deprecated.replacement_missing — pointing a reader at an
   * unrelated "replacement" would mislead more than pointing nowhere.
   */
  retired?: boolean;
}

/**
 * A specialist role a workflow node routes to (the app-agent roster promoted to catalog data —
 * see catalog/roles.ts). `promptPath` is workspace-relative: the roster ships inside each
 * provisioned business, so the catalog validates the id, not the file.
 */
export interface CatalogRole {
  id: RoleId;
  name: string;
  promptPath: string;
  scope: string;
  /** Parent repo contracts a fresh worker must read before the specialist prompt. */
  parentPromptPaths: string[];
  /** Role-level knowledge routes. Their references remain conditional; workflow references are mandatory. */
  contextPackIds: ContextPackId[];
  /** Installed skills to invoke when the assignment matches `when`; unavailable optional skills never block work. */
  skillRoutes: CatalogCapabilityRoute[];
  /** Runtime capabilities to discover before work that needs them; schemas/current --help outrank stored examples. */
  toolRoutes: CatalogCapabilityRoute[];
  /** Provider/capability ids this role can actually exercise. Workflow providerIds must be a subset. */
  capabilityIds: string[];
  /** Workspace-relative output prefixes this role is allowed to produce. Empty means review-only. */
  outputPathPrefixes: string[];
}

export interface CatalogCapabilityRoute {
  id: string;
  when: string;
}

export interface CatalogContextPack {
  id: ContextPackId;
  title: string;
  referenceIds: ReferenceId[];
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
  /**
   * The node's working instructions: what a worker with fresh context should actually DO and how
   * it knows it is done. Required (catalog_graph.workflow.instructions_missing) — a node whose
   * only content is its title dispatches a worker with nothing to work from, which is the exact
   * failure the 2026-08 contract audit found. Instructions stay compact; the depth lives in the
   * bound references below.
   */
  instructions: string;
  /**
   * Authored input contract: the workspace paths this node actually consumes (upstream artifacts
   * and durable state files). `reads` is BLOCKING: compile.ts maps each entry that names another
   * workflow's artifact into the node's inputs, so the frontier holds the node until that
   * artifact is produced AND accepted (a read of the node's own output is the read-modify-write
   * pattern and is excluded; durable state files gate nothing). A file this node merely
   * cross-checks when it exists belongs in `consults`, not here. Each entry must resolve to a
   * declared artifact path or a workspace-template file (catalog_graph.workflow.read_unresolvable).
   */
  reads: string[];
  /**
   * Open-if-present references: files the worker should consult WHEN they exist, without holding
   * readiness on their producers (e.g. a phase-1 node that cross-checks a phase-3 artifact on its
   * later firings). Same resolvability rule as reads (catalog_graph.workflow.consult_unresolvable);
   * a path may not appear in both lists.
   */
  consults: string[];
  /**
   * Knowledge bound to this node (R20 completed: loadWhen text routed humans; this routes the
   * engine). Every id must resolve from a knowledge manifest, and every non-sessionScoped reference
   * must be bound by at least one workflow — both directions validate.
   */
  referenceIds: ReferenceId[];
  /** The specialist role that owns this node's work (catalog/roles.ts; the app-agent roster promoted to a routing key). */
  roleId: RoleId;
  laneIds: LaneKey[];
  phaseIds: PhaseId[];
  dependencies: WorkflowId[];
  outputPaths: string[];
  gateCommands: string[];
  /**
   * Provider ids this node exercises. Every id must have a PROVISIONING_MANIFEST entry or sit
   * in DELIBERATELY_UNDECLARED_PROVIDER_IDS (core/provisioning/requirements.ts) —
   * catalog_graph.workflow.provider_unknown / catalog_graph.provider.exception_stale — and be a
   * subset of the owning role's capabilityIds (catalog_graph.workflow.role_capability_missing).
   */
  providerIds: string[];
  founderOnlyActions: string[];
  /** v2: dispatch/autonomy fields the v1 graph had no execution half to need (KTD6). */
  actionClass: ActionClass;
  protectedCategory?: ProtectedCategory;
  idempotent: boolean;
  maxAttempts?: number;
  ttlSeconds?: number;
  tokenBudget?: number;
  /** Declared cost for actionClass "spend" nodes (required there — catalog_graph.workflow.cost_estimate_missing); the autonomy engine parks spend nodes without one. */
  costEstimate?: { amount: number; currency: string };
  applicability: { mode: "always" } | { mode: "conditional"; question: string };
}

export type LaunchMatrixGroupId = "market-product" | "experience-brand" | "build-measurement" | "revenue-growth" | "release-trust" | "operate-improve";

export interface LaunchMatrixGroup {
  id: LaunchMatrixGroupId;
  title: string;
  description: string;
  order: number;
  domainIds: CatalogDomainId[];
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
  roles: CatalogRole[];
  contextPacks: CatalogContextPack[];
  references: CatalogReference[];
  workflows: CatalogWorkflowDef[];
  artifacts: CatalogArtifact[];
  gates: CatalogGate[];
  presentationGroups: LaunchMatrixGroup[];
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
