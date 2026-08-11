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

/** A knowledge reference resolved at the bridge, so briefs compose without the catalog module. */
export interface NodeReference {
  id: string;
  path: string;
  title: string;
  loadWhen: string;
}

/** The specialist role that owns a node's work; promptPath is workspace-relative (the roster ships with the business). */
export interface NodeRole {
  id: string;
  name: string;
  promptPath: string;
}

export interface CatalogWorkflowNode {
  id: CatalogWorkflowId;
  title: string;
  domainId: GrantableDomainId;
  actionClass: ActionClass;
  protectedCategory?: ProtectedCategory;
  /**
   * The authored node contract (2026-08): what to do (instructions + trigger), what to open
   * (reads), which knowledge to load (references), who owns it (role). Optional at THIS boundary
   * only so the pre-contract fixture catalogs stay valid — the real bridge (catalog/bridge.ts)
   * always supplies them, and catalog/validate.ts rejects a real catalog that omits any.
   * composeNodeBrief() marks absent fields explicitly rather than papering over them.
   */
  trigger?: string;
  instructions?: string;
  reads?: string[];
  consults?: string[];
  references?: NodeReference[];
  role?: NodeRole;
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
  /** The authored contract, carried verbatim from CatalogWorkflowNode (see that type's doc comment for why these are optional at the type level). */
  trigger?: string;
  instructions?: string;
  reads?: string[];
  consults?: string[];
  references?: NodeReference[];
  role?: NodeRole;
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

    const outputs = outputsByWorkflow.get(workflow.id) ?? [];
    // Inputs are the union of dependency outputs (edge topology) and authored reads that name
    // another workflow's artifact (Codex round 3: a declared read is a readiness requirement —
    // the frontier must not offer a node whose read target is still unproduced placeholder
    // content). A read of the node's OWN output is the read-modify-write pattern and gates
    // nothing; reads of durable state files map to no artifact and gate nothing; `consults`
    // never gates by definition.
    const ownOutputs = new Set(outputs);
    const readArtifacts = (workflow.reads ?? [])
      .map((readPath) => artifactsByPath.get(readPath))
      .filter((artifactId): artifactId is CatalogArtifactId => Boolean(artifactId) && !ownOutputs.has(artifactId!));
    const inputs = unique([...workflow.dependencies.flatMap((upstreamId) => outputsByWorkflow.get(upstreamId) ?? []), ...readArtifacts]);
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
      trigger: workflow.trigger,
      instructions: workflow.instructions,
      reads: workflow.reads,
      consults: workflow.consults,
      references: workflow.references,
      role: workflow.role,
      inputs,
      outputs,
      dependencies: workflow.dependencies.map((id) => runIdByWorkflow.get(id)!),
      statePredicates: workflow.laneIds.map((laneKey) => ({ path: `lanes.${laneKey}.status`, operator: "not_in" as const, value: ["blocked"] })),
      laneIds: workflow.laneIds,
      approvals: workflow.founderOnlyActions.map((description, index) => ({ id: `${workflow.id}.approval.${index + 1}`, description })),
      resources: dedupeClaims(resources),
      // A node that declares outputs but no gate used to compile to kind "none", which
      // runstate.ts auto-accepted the moment any executor reported bytes — the 2026-08 audit
      // found 9 grantable nodes (2 of them release-class) shipping through that hole. Gateless
      // outputs now verify as fresh_context/fail-closed: the producing attempt lands blocked
      // pending acceptVerification with evidence from a verifier that is not the producer.
      // "none" survives only for nodes with no outputs at all (gate-only contracts).
      verification: {
        kind: gateIds.length > 0 ? "deterministic" : judgment || outputs.length > 0 ? "fresh_context" : "none",
        gateIds,
        freshContext: judgment || (gateIds.length === 0 && outputs.length > 0),
        failClosed: gateIds.length > 0 || judgment || outputs.length > 0,
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
