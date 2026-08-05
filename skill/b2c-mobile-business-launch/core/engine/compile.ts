import { createHash } from "node:crypto";
import type { ActionClass, ArtifactBindingV2, GrantableDomainId, LaneKey, ProtectedCategory } from "../schema/types.js";

/**
 * Ported from runtime/graph/execution.ts (KTD6), rewritten against v2 types. RunNodeId stays a
 * branded string so engine code reads clearly; it widens to plain `string` wherever it crosses
 * into a core/schema type (RunStateDocument keys, ArtifactBindingV2.artifactId, ...).
 */
export type RunNodeId = `run.${string}`;
export type CatalogWorkflowId = `workflow.${string}`;
export type CatalogArtifactId = `artifact.${string}`;

export type ResourceMode = "shared" | "exclusive";

export interface ResourceClaim {
  id: string;
  mode: ResourceMode;
}

export interface StatePredicate {
  path: string;
  operator: "exists" | "equals" | "in" | "not_in";
  value?: unknown;
}

export interface ApprovalRequirement {
  id: string;
  description: string;
}

export type VerificationKind = "deterministic" | "fresh_context" | "human" | "none";

export interface VerificationPolicy {
  kind: VerificationKind;
  gateIds: string[];
  freshContext: boolean;
  failClosed: boolean;
}

export interface CatalogArtifact {
  id: CatalogArtifactId;
  path: string;
}

/**
 * Minimal catalog contract U2 compiles against (U8 delivers the real graph-derived catalog).
 * Deliberately small: readiness, conflict, and staleness logic must be provable against a
 * fixture catalog before the real 57-workflow catalog exists.
 */
export interface CostEstimate {
  amount: number;
  currency: string;
}

export interface CatalogWorkflowNode {
  id: CatalogWorkflowId;
  title: string;
  domainId: GrantableDomainId;
  actionClass: ActionClass;
  protectedCategory?: ProtectedCategory;
  dependencies: CatalogWorkflowId[];
  outputPaths: string[];
  providerIds: string[];
  laneIds: LaneKey[];
  founderOnlyActions: string[];
  gateCommands: string[];
  idempotent: boolean;
  maxAttempts?: number;
  ttlSeconds?: number;
  tokenBudget?: number;
  /** Declared cost estimate (R10, KTD5): the autonomy engine (U4) requires this on any actionClass "spend" node before it will dispatch — absent here, it parks fail-closed rather than compiling it away. */
  costEstimate?: CostEstimate;
}

export interface CatalogInput {
  version: string;
  artifacts: CatalogArtifact[];
  workflows: CatalogWorkflowNode[];
}

export interface CompiledRunNode {
  id: RunNodeId;
  workflowId: CatalogWorkflowId;
  title: string;
  domainId: GrantableDomainId;
  actionClass: ActionClass;
  protectedCategory?: ProtectedCategory;
  inputs: CatalogArtifactId[];
  outputs: CatalogArtifactId[];
  dependencies: RunNodeId[];
  statePredicates: StatePredicate[];
  laneIds: LaneKey[];
  approvals: ApprovalRequirement[];
  resources: ResourceClaim[];
  verification: VerificationPolicy;
  idempotent: boolean;
  maxAttempts: number;
  ttlSeconds: number;
  tokenBudget: number;
  costEstimate?: CostEstimate;
}

export interface CompiledPlan {
  planId: string;
  planRevision: number;
  catalogVersion: string;
  compiledAt: string;
  nodes: CompiledRunNode[];
  artifactBindings: ArtifactBindingV2[];
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TTL_SECONDS = 300;
const DEFAULT_TOKEN_BUDGET = 8_000;
const JUDGMENT_TOKEN_BUDGET = 20_000;
/** domain.research/words/design require fresh-context judgment verification (ported from v1's `judgment` rule). */
const JUDGMENT_DOMAINS: readonly GrantableDomainId[] = ["domain.research", "domain.words", "domain.design"];

/**
 * Definition catalog -> compiled plan. Fails closed on two catalog-authoring defects the target
 * architecture (docs/history/graph-execution-adoption-2026-08-v0.65.1.md, "Compiler" steps 1 and
 * 9) calls out explicitly: a dependency on an unknown workflow, and two workflows both declaring
 * the same output artifact (an ambiguous shared write with no reducer-owned merge semantics here).
 */
export function compilePlan(catalog: CatalogInput, now = "1970-01-01T00:00:00.000Z"): CompiledPlan {
  const artifactsByPath = new Map(catalog.artifacts.map((artifact) => [artifact.path, artifact.id]));
  const knownWorkflowIds = new Set(catalog.workflows.map((workflow) => workflow.id));

  const outputsByWorkflow = new Map<CatalogWorkflowId, CatalogArtifactId[]>();
  for (const workflow of catalog.workflows) {
    const outputs = workflow.outputPaths.map((outputPath) => artifactsByPath.get(outputPath)).filter((id): id is CatalogArtifactId => Boolean(id));
    outputsByWorkflow.set(workflow.id, outputs);
  }

  const writerCounts = new Map<CatalogArtifactId, number>();
  for (const outputs of outputsByWorkflow.values()) for (const artifactId of outputs) writerCounts.set(artifactId, (writerCounts.get(artifactId) ?? 0) + 1);
  const ambiguous = [...writerCounts.entries()].filter(([, count]) => count > 1).map(([artifactId]) => artifactId);
  if (ambiguous.length > 0) throw new Error(`Ambiguous shared write(s): ${ambiguous.join(", ")} each declared as output by more than one workflow`);

  const runIdByWorkflow = new Map<CatalogWorkflowId, RunNodeId>(catalog.workflows.map((workflow) => [workflow.id, toRunNodeId(workflow.id)]));

  const nodes: CompiledRunNode[] = catalog.workflows.map((workflow): CompiledRunNode => {
    const unknownDependency = workflow.dependencies.find((dependency) => !knownWorkflowIds.has(dependency));
    if (unknownDependency) throw new Error(`${workflow.id} depends on unknown workflow ${unknownDependency}`);

    const inputs = unique(workflow.dependencies.flatMap((upstreamId) => outputsByWorkflow.get(upstreamId) ?? []));
    const outputs = outputsByWorkflow.get(workflow.id) ?? [];
    const judgment = JUDGMENT_DOMAINS.includes(workflow.domainId);
    const gateIds = workflow.gateCommands;

    const resources: ResourceClaim[] = [
      ...workflow.outputPaths.map((outputPath) => ({ id: `resource.path.${normalizeResource(outputPath)}`, mode: "exclusive" as const })),
      ...workflow.providerIds.map((providerId) => ({ id: `resource.${providerId}`, mode: "exclusive" as const })),
    ];
    if (workflow.founderOnlyActions.length > 0) resources.push({ id: "resource.founder.attention", mode: "exclusive" });

    return {
      id: runIdByWorkflow.get(workflow.id)!,
      workflowId: workflow.id,
      title: workflow.title,
      domainId: workflow.domainId,
      actionClass: workflow.actionClass,
      protectedCategory: workflow.protectedCategory,
      inputs,
      outputs,
      dependencies: workflow.dependencies.map((id) => runIdByWorkflow.get(id)!),
      statePredicates: workflow.laneIds.map((laneKey) => ({ path: `lanes.${laneKey}.status`, operator: "not_in" as const, value: ["blocked"] })),
      laneIds: workflow.laneIds,
      approvals: workflow.founderOnlyActions.map((description, index) => ({ id: `${workflow.id}.approval.${index + 1}`, description })),
      resources: dedupeClaims(resources),
      verification: {
        kind: gateIds.length > 0 ? "deterministic" : judgment ? "fresh_context" : "none",
        gateIds,
        freshContext: judgment,
        failClosed: gateIds.length > 0 || judgment,
      },
      idempotent: workflow.idempotent,
      maxAttempts: workflow.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      ttlSeconds: workflow.ttlSeconds ?? DEFAULT_TTL_SECONDS,
      tokenBudget: workflow.tokenBudget ?? (judgment ? JUDGMENT_TOKEN_BUDGET : DEFAULT_TOKEN_BUDGET),
      costEstimate: workflow.costEstimate,
    };
  });

  const artifactBindings: ArtifactBindingV2[] = catalog.artifacts.map((artifact) => ({ artifactId: artifact.id, path: artifact.path, accepted: false }));
  const planBody = JSON.stringify({ catalogVersion: catalog.version, nodes, artifactBindings });

  return {
    planId: `plan.${sha256(planBody).slice(0, 16)}`,
    planRevision: 1,
    catalogVersion: catalog.version,
    compiledAt: now,
    nodes,
    artifactBindings,
  };
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function toRunNodeId(workflowId: CatalogWorkflowId): RunNodeId {
  return `run.${workflowId.slice("workflow.".length)}`;
}

function normalizeResource(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "")
    .toLowerCase();
}

function dedupeClaims(claims: ResourceClaim[]): ResourceClaim[] {
  const byId = new Map<string, ResourceClaim>();
  for (const claim of claims) {
    const previous = byId.get(claim.id);
    byId.set(claim.id, { id: claim.id, mode: previous?.mode === "exclusive" || claim.mode === "exclusive" ? "exclusive" : "shared" });
  }
  return [...byId.values()];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
