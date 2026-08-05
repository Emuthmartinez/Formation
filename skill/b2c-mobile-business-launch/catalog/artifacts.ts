import { catalogId } from "./ids.js";
import type { CatalogArtifact, CatalogWorkflowDef } from "./types.js";

/**
 * Artifacts are derived from workflow outputPaths, not hand-authored — one entry per
 * distinct output path across the catalog. Ported in spirit from
 * runtime/graph/graph.ts's artifact-merging loop, but simpler: v1 also discovered
 * artifacts from `workspace/business/state/PROJECT_STATE.yaml` lane evidence (a second,
 * looser source of artifact identity that tolerated the same path being claimed by more
 * than one workflow — see catalog/workflows/*.ts headers for the collisions that produced
 * in this rebuild). v2 has a single source: each output path has exactly one producing
 * workflow (compile.ts enforces this at compile time; the workflow files were fixed to
 * satisfy it), so deriving artifacts straight from workflows is sufficient and can't drift.
 */
export function buildArtifacts(workflows: readonly CatalogWorkflowDef[]): CatalogArtifact[] {
  const artifacts: CatalogArtifact[] = [];
  for (const wf of workflows) {
    for (const outputPath of wf.outputPaths) {
      artifacts.push({
        id: catalogId("artifact", outputPath),
        path: outputPath,
        ownerDomainId: wf.domainId,
        laneIds: wf.laneIds,
        generated: outputPath.endsWith(".html") || outputPath.includes("generated"),
      });
    }
  }
  return artifacts.sort((a, b) => a.path.localeCompare(b.path));
}
