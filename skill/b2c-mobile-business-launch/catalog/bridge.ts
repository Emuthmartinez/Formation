import type { CatalogArtifact as CompileArtifact, CatalogInput, CatalogWorkflowId, CatalogWorkflowNode } from "../core/engine/compile.js";
import { grantableDomainIds, type GrantableDomainId } from "../core/schema/types.js";
import { catalogId } from "./ids.js";
import type { Catalog, CatalogWorkflowDef } from "./types.js";

const grantableSet = new Set<string>(grantableDomainIds);

function isGrantable(domainId: string): domainId is GrantableDomainId {
  return grantableSet.has(domainId);
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

  const artifactsByPath = new Map<string, CompileArtifact>();
  for (const wf of grantableWorkflows) {
    for (const outputPath of wf.outputPaths) {
      if (artifactsByPath.has(outputPath)) continue;
      artifactsByPath.set(outputPath, { id: catalogId("artifact", outputPath) as CompileArtifact["id"], path: outputPath });
    }
  }

  const workflows: CatalogWorkflowNode[] = grantableWorkflows.map((wf) => ({
    id: wf.id as CatalogWorkflowId,
    title: wf.title,
    domainId: wf.domainId,
    actionClass: wf.actionClass,
    protectedCategory: wf.protectedCategory,
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
  }));

  return {
    version: `${catalog.schemaVersion}+${catalog.skillVersion}`,
    artifacts: [...artifactsByPath.values()],
    workflows,
  };
}

/** Workflows present in the full catalog but excluded from toCatalogInput() — for reporting/diagnostics, not dispatch. */
export function nonGrantableWorkflowIds(catalog: Catalog): string[] {
  return catalog.workflows.filter((wf) => !isGrantable(wf.domainId)).map((wf) => wf.id);
}
