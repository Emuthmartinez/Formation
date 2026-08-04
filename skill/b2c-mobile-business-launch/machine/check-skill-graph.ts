#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateExecutionArchitecture } from "../graph/execution.js";
import { composeSkillGraph } from "../graph/graph.js";
import { renderDomainRouting, renderGeneratedFiles, renderPhaseSpine, replaceGeneratedBlock } from "../graph/render.js";
import { validateSkillGraph } from "../graph/validate.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "..");
const skillRoot = parseSkillRoot(process.argv.slice(2));
const graph = composeSkillGraph(skillRoot);
const issues = validateSkillGraph(graph, skillRoot);
for (const message of validateExecutionArchitecture(graph)) {
  issues.push({ severity: "error", code: "skill_graph.execution.invalid", message });
}
const expected = renderGeneratedFiles(graph);

const skillPath = path.join(skillRoot, "SKILL.md");
const spinePath = path.join(skillRoot, "spine.md");
try {
  expected["SKILL.md"] = replaceGeneratedBlock(readFileSync(skillPath, "utf8"), "domain-routing", renderDomainRouting(graph.domains));
  expected["spine.md"] = replaceGeneratedBlock(readFileSync(spinePath, "utf8"), "phase-spine", renderPhaseSpine(graph.phases));
} catch (error) {
  issues.push({ severity: "error", code: "skill_graph.generated_markers_missing", message: error instanceof Error ? error.message : String(error) });
}

for (const [relative, content] of Object.entries(expected)) {
  const target = path.join(skillRoot, relative);
  if (!existsSync(target)) {
    issues.push({ severity: "error", code: "skill_graph.generated_missing", message: `Generated projection is missing: ${relative}`, path: relative });
  } else if (readFileSync(target, "utf8") !== content) {
    issues.push({ severity: "error", code: "skill_graph.generated_drift", message: `Generated projection is stale: ${relative}`, path: relative });
  }
}

const errors = issues.filter((issue) => issue.severity === "error");
const warnings = issues.filter((issue) => issue.severity === "warning");
console.log("Typed skill graph integrity and execution check");
for (const issue of issues) console.log(`${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}${issue.path ? ` (${issue.path})` : ""}`);
console.log(`${errors.length} error(s), ${warnings.length} warning(s), ${graph.workflows.length} workflow(s), ${graph.references.length} reference(s).`);
if (errors.length > 0) process.exitCode = 1;

function parseSkillRoot(argv: string[]): string {
  for (let index = 0; index < argv.length; index += 1) {
    if ((argv[index] === "--skill-root" || argv[index] === "--root") && argv[index + 1]) return path.resolve(argv[index + 1]!);
  }
  return defaultSkillRoot;
}
