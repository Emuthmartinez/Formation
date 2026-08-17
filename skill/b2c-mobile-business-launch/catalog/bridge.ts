import type { CatalogArtifact as CompileArtifact, CatalogInput, CatalogWorkflowId, CatalogWorkflowNode } from "../core/engine/compile.js";
import { grantableDomainIds, type DomainId, type GrantableDomainId } from "../core/schema/types.js";
import { isGrantableDomainId, systemCatalogDomainIds, type Catalog, type CatalogDomainId, type CatalogWorkflowDef } from "./types.js";

function isGrantable(domainId: CatalogDomainId): domainId is GrantableDomainId {
  return isGrantableDomainId(domainId, grantableDomainIds);
}

function isBusinessRuntimeDomain(domainId: CatalogDomainId): domainId is DomainId {
  return isGrantable(domainId) || systemCatalogDomainIds.includes(domainId);
}

/**
 * The v2 catalog -> core/engine/compile.ts CatalogInput bridge (U8; U2 built compile.ts
 * against a small fixture catalog and left this real bridge for U8 to deliver).
 *
 * Process and orchestration workflows are runtime-owned and never founder-grantable, but they
 * remain executable prerequisites. The autonomy evaluator admits only their internal work and
 * fails closed if a system node declares protected, costed, or external mutation authority.
 * Machine-domain workflows remain maintainer-only and are the sole workflows filtered here.
 */
export function toCatalogInput(catalog: Catalog): CatalogInput {
  const runtimeWorkflows = catalog.workflows.filter((wf): wf is CatalogWorkflowDef & { domainId: DomainId } => isBusinessRuntimeDomain(wf.domainId));
  const runtimeIds = new Set<CatalogWorkflowId>(runtimeWorkflows.map((wf) => wf.id as CatalogWorkflowId));
  const runtimeOutputPaths = new Set<string>(runtimeWorkflows.flatMap((wf) => wf.outputPaths));
  const referencesById = new Map(catalog.references.map((reference) => [reference.id, reference]));
  const rolesById = new Map(catalog.roles.map((role) => [role.id, role]));
  const contextPacksById = new Map(catalog.contextPacks.map((pack) => [pack.id, pack]));

  // Reuse catalog.artifacts (built once, by catalog/artifacts.ts's buildArtifacts(), from every
  // workflow's outputPaths) rather than recomputing artifact ids independently here — two
  // derivations of the same id from the same input have already diverged once in this repo's
  // history (see catalog/artifacts.ts's own header on why there is now a single source).
  const artifacts: CompileArtifact[] = catalog.artifacts
    .filter((artifact) => runtimeOutputPaths.has(artifact.path))
    .map((artifact) => ({ id: artifact.id as CompileArtifact["id"], path: artifact.path }));

  const workflows: CatalogWorkflowNode[] = runtimeWorkflows.map((wf) => ({
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
      return {
        id: role.id,
        name: role.name,
        promptPath: role.promptPath,
        parentPromptPaths: role.parentPromptPaths,
        contextPacks: role.contextPackIds.map((packId) => {
          const pack = contextPacksById.get(packId);
          if (!pack) throw new Error(`${role.id} names unknown context pack ${packId}`);
          return {
            id: pack.id,
            title: pack.title,
            references: pack.referenceIds.map((referenceId) => {
              const reference = referencesById.get(referenceId);
              if (!reference) throw new Error(`${pack.id} binds unknown reference ${referenceId}`);
              return { id: reference.id, path: reference.path, title: reference.title, loadWhen: reference.loadWhen };
            }),
          };
        }),
        skillRoutes: role.skillRoutes,
        toolRoutes: role.toolRoutes,
      };
    })(),
    dependencies: wf.dependencies.filter((dependencyId): dependencyId is CatalogWorkflowId => runtimeIds.has(dependencyId as CatalogWorkflowId)),
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
  return catalog.workflows.filter((wf) => !isBusinessRuntimeDomain(wf.domainId)).map((wf) => wf.id);
}
