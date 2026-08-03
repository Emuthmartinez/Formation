import { businessAreas } from "./business-areas.js";
import { discoverArtifacts, discoverGates, discoverProviders, discoverReferences, readSkillVersion } from "./catalog.js";
import { buildContextPacks } from "./context-packs.js";
import { domains } from "./domains.js";
import { graphId } from "./ids.js";
import { lanes } from "./lanes.js";
import { operators } from "./operators.js";
import { phases } from "./phases.js";
import type { ArtifactDefinition, SkillGraph } from "./types.js";
import { workflows as workflowDefinitions } from "./workflows/index.js";

export function composeSkillGraph(skillRoot: string): SkillGraph {
  const referenceDefinitions = discoverReferences(skillRoot, domains);
  const contextPacks = buildContextPacks(domains, referenceDefinitions);
  const contextById = new Map(contextPacks.map((pack) => [pack.id, pack]));
  const normalizedWorkflows = workflowDefinitions.map((workflow) => {
    const referenceIds = workflow.contextPackIds.flatMap((contextId) => contextById.get(contextId)?.entryReferenceIds ?? []);
    return { ...workflow, referenceIds: [...new Set(referenceIds)] };
  });

  const discoveredArtifacts = discoverArtifacts(skillRoot, lanes, domains);
  const artifactsByPath = new Map(discoveredArtifacts.map((artifact) => [artifact.path, artifact]));
  for (const workflow of normalizedWorkflows) {
    for (const artifactPath of workflow.artifactPaths) {
      if (artifactsByPath.has(artifactPath)) continue;
      artifactsByPath.set(artifactPath, {
        id: graphId("artifact", artifactPath),
        path: artifactPath,
        ownerDomainId: workflow.domainId,
        laneIds: workflow.laneIds,
        generated: artifactPath.endsWith(".html") || artifactPath.includes("generated"),
      } satisfies ArtifactDefinition);
    }
  }

  return {
    schemaVersion: "1.0.0",
    skillVersion: readSkillVersion(skillRoot),
    areas: [...businessAreas],
    domains: [...domains].sort((a, b) => a.order - b.order),
    phases: [...phases].sort((a, b) => a.order - b.order),
    lanes: [...lanes],
    references: referenceDefinitions,
    contextPacks,
    workflows: normalizedWorkflows,
    artifacts: [...artifactsByPath.values()].sort((a, b) => a.path.localeCompare(b.path)),
    gates: discoverGates(skillRoot, domains),
    operators: [...operators],
    providers: discoverProviders(skillRoot, domains),
  };
}
