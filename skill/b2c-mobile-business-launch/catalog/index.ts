import { readFileSync } from "node:fs";
import path from "node:path";
import { areas } from "./areas.js";
import { buildArtifacts } from "./artifacts.js";
import { domains } from "./domains.js";
import { discoverGates } from "./gates.js";
import { lanes } from "./lanes.js";
import { phases } from "./phases.js";
import { references } from "./references.js";
import type { Catalog } from "./types.js";
import { workflows } from "./workflows/index.js";

export function readSkillVersion(skillRoot: string): string {
  const parsed = JSON.parse(readFileSync(path.join(skillRoot, "skill-version.json"), "utf8")) as { version?: string };
  return parsed.version ?? "0.0.0";
}

/**
 * Composes the v2 catalog: static ported data (areas/domains/phases/lanes/references/
 * workflows) plus dynamically discovered gates (npm scripts) and derived artifacts
 * (workflow outputs). Analogous to runtime/graph/graph.ts's composeSkillGraph(), but
 * everything except gates is authored TypeScript data rather than filesystem discovery —
 * the R20 inversion this unit exists to ship.
 */
export function composeCatalog(skillRoot: string): Catalog {
  return {
    schemaVersion: "2.0.0",
    skillVersion: readSkillVersion(skillRoot),
    areas: [...areas],
    domains: [...domains].sort((a, b) => a.order - b.order),
    phases: [...phases].sort((a, b) => a.order - b.order),
    lanes: [...lanes],
    references: [...references],
    workflows: [...workflows],
    artifacts: buildArtifacts(workflows),
    gates: discoverGates(skillRoot, domains),
  };
}
