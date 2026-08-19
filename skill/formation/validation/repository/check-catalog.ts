#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { composeCatalog } from "../../catalog/index.js";
import { operators } from "../../catalog/operators.js";
import { validateCatalog } from "../../catalog/validate.js";
import { loadKnowledgePackages } from "../../catalog/knowledge-packages.js";
import { validateKnowledgePackages } from "../../catalog/knowledge-validation.js";
import { domains } from "../../catalog/domains.js";
import { workflows } from "../../catalog/workflows/index.js";
import { contextPacks } from "../../catalog/context-packs.js";

/**
 * Wired entry point for the `check:catalog` npm script. `catalog/validate.ts` carries the
 * real logic (and its own `tsx catalog/validate.ts` CLI, for direct maintainer use) — this
 * file exists only so the wired, LaunchBench-tracked command resolves under
 * `validation/repository/`, matching the three-root split in tooling/lib/script-paths.ts
 * (docs/architecture.md: validation/business/ proves a business launch, validation/repository/
 * proves the skill itself, tooling/ holds renderers/runners/probes/shared lib). catalog/ is the
 * v2 definition-graph-as-data tree (R20) and intentionally sits outside that split as authored
 * data plus its own directly-runnable validator/renderer, so this wrapper is the seam between
 * the two conventions rather than a reason to fold all of catalog/ into SCRIPT_ROOTS.
 */
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "../..");
const skillRoot = parseSkillRoot(process.argv.slice(2));
const catalog = composeCatalog(skillRoot);
const issues = [
  ...validateCatalog(catalog, skillRoot),
  ...validateKnowledgePackages(loadKnowledgePackages(skillRoot), skillRoot, domains, workflows, contextPacks, [...catalog.roles, ...operators]).map((item) => ({
    severity: "error" as const,
    code: item.code,
    message: item.message,
    path: undefined,
  })),
];

const errors = issues.filter((issue) => issue.severity === "error");
const warnings = issues.filter((issue) => issue.severity === "warning");
console.log("Catalog graph integrity check");
for (const issue of issues) console.log(`${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}${issue.path ? ` (${issue.path})` : ""}`);
console.log(
  `${errors.length} error(s), ${warnings.length} warning(s), ${catalog.domains.length} domain(s), ${catalog.workflows.length} workflow(s), ${catalog.references.length} reference(s), ${catalog.gates.length} gate(s).`,
);
if (errors.length > 0) process.exitCode = 1;

function parseSkillRoot(argv: string[]): string {
  for (let index = 0; index < argv.length; index += 1) {
    if ((argv[index] === "--skill-root" || argv[index] === "--root") && argv[index + 1]) return path.resolve(argv[index + 1]!);
  }
  return defaultSkillRoot;
}
