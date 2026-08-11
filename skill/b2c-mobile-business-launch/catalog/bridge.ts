import type { CatalogArtifact as CompileArtifact, CatalogInput, CatalogWorkflowId, CatalogWorkflowNode } from "../core/engine/compile.js";
import { grantableDomainIds, type GrantableDomainId } from "../core/schema/types.js";
import { isGrantableDomainId, type Catalog, type CatalogDomainId, type CatalogWorkflowDef } from "./types.js";

function isGrantable(domainId: CatalogDomainId): domainId is GrantableDomainId {
  return isGrantableDomainId(domainId, grantableDomainIds);
}

/**
 * The v2 catalog -> core/engine/compile.ts CatalogInput bridge (U8; U2 built compile.ts
 * against a small fixture catalog and left this real bridge for U8 to deliver).
 *
 * compile.ts's CatalogWorkflowNode.domainId is typed strictly as GrantableDomainId —
 * domain.process, domain.orchestration, and domain.machine workflows (KTD3: system
 * domains, never founder-grantable) cannot appear in a CatalogInput at all, by the type
 * system's own construction. Those workflows represent session-level machinery
 * (continuity, provider-proof verification, change cascade, LaunchBench audit, skill
 * maintenance) that runs as part of the runtime's own operation, not autonomy-gated
 * business work competing on the dispatch frontier — see catalog/workflows/operating-
 * system.ts and maintenance.ts's file headers for the full reasoning.
 *
 * Filtering them out leaves a second problem this bridge also resolves: several
 * grantable-domain workflows depend on one of the excluded system-domain workflows (e.g.
 * design-room-state-mutate-version-render depends on launch-trace-and-build-contracts).
 * compile.ts's compilePlan() throws on any dependency that isn't itself a node in the
 * same CatalogInput ("depends on unknown workflow"), so this bridge strips any dependency
 * edge that points outside the filtered, grantable-only workflow set rather than letting
 * compilePlan() discover the dangling edge at compile time. The full 57-workflow catalog
 * (pre-bridge) is what catalog/validate.ts checks for referential integrity — those edges
 * are NOT dangling there, only in the narrower slice this function produces.
 */
export function toCatalogInput(catalog: Catalog): CatalogInput {
  const grantableWorkflows = catalog.workflows.filter((wf): wf is CatalogWorkflowDef & { domainId: GrantableDomainId } => isGrantable(wf.domainId));
  const grantableIds = new Set<CatalogWorkflowId>(grantableWorkflows.map((wf) => wf.id as CatalogWorkflowId));
  const grantableOutputPaths = new Set<string>(grantableWorkflows.flatMap((wf) => wf.outputPaths));
  const referencesById = new Map(catalog.references.map((reference) => [reference.id, reference]));
  const rolesById = new Map(catalog.roles.map((role) => [role.id, role]));

  // Reuse catalog.artifacts (built once, by catalog/artifacts.ts's buildArtifacts(), from every
  // workflow's outputPaths) rather than recomputing artifact ids independently here — two
  // derivations of the same id from the same input have already diverged once in this repo's
  // history (see catalog/artifacts.ts's own header on why there is now a single source).
  const artifacts: CompileArtifact[] = catalog.artifacts
    .filter((artifact) => grantableOutputPaths.has(artifact.path))
    .map((artifact) => ({ id: artifact.id as CompileArtifact["id"], path: artifact.path }));

  const workflows: CatalogWorkflowNode[] = grantableWorkflows.map((wf) => ({
    id: wf.id as CatalogWorkflowId,
    title: wf.title,
    domainId: wf.domainId,
    actionClass: wf.actionClass,
    protectedCategory: wf.protectedCategory,
    // The full authored node contract crosses the bridge (the 2026-08 contract audit found this
    // map dropped trigger and carried no instructions/knowledge at all, leaving a dispatched
    // worker a bare title). References resolve to path+loadWhen here so the engine never needs
    // the catalog module to compose a worker brief.
    trigger: wf.trigger,
    instructions: wf.instructions,
    reads: wf.reads,
    consults: wf.consults,
    references: wf.referenceIds.map((referenceId) => {
      const reference = referencesById.get(referenceId);
      if (!reference) throw new Error(`${wf.id} binds unknown reference ${referenceId}`);
      return { id: reference.id, path: reference.path, title: reference.title, loadWhen: reference.loadWhen };
    }),
    role: (() => {
      const role = rolesById.get(wf.roleId);
      if (!role) throw new Error(`${wf.id} names unknown role ${wf.roleId}`);
      return { id: role.id, name: role.name, promptPath: role.promptPath };
    })(),
    dependencies: wf.dependencies.filter((dependencyId): dependencyId is CatalogWorkflowId => grantableIds.has(dependencyId as CatalogWorkflowId)),
    outputPaths: wf.outputPaths,
    providerIds: wf.providerIds,
    laneIds: wf.laneIds,
    founderOnlyActions: wf.founderOnlyActions,
    gateCommands: wf.gateCommands,
    idempotent: wf.idempotent,
    maxAttempts: wf.maxAttempts,
    ttlSeconds: wf.ttlSeconds,
    tokenBudget: wf.tokenBudget,
    costEstimate: wf.costEstimate,
  }));

  return {
    version: `${catalog.schemaVersion}+${catalog.skillVersion}`,
    artifacts,
    workflows,
  };
}

/** Workflows present in the full catalog but excluded from toCatalogInput() — for reporting/diagnostics, not dispatch. */
export function nonGrantableWorkflowIds(catalog: Catalog): string[] {
  return catalog.workflows.filter((wf) => !isGrantable(wf.domainId)).map((wf) => wf.id);
}
