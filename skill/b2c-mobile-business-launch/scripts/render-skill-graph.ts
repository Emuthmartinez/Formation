#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { composeSkillGraph } from "../graph/graph.js";
import { renderDomainRouting, renderGeneratedFiles, renderPhaseSpine, replaceGeneratedBlock } from "../graph/render.js";
import { validateSkillGraph } from "../graph/validate.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "..");
const args = parseArgs(process.argv.slice(2));
const graph = composeSkillGraph(args.skillRoot);
const issues = validateSkillGraph(graph, args.skillRoot);
const errors = issues.filter((issue) => issue.severity === "error");
for (const issue of issues) console.error(`${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`);
if (errors.length > 0) process.exit(1);

const files = renderGeneratedFiles(graph);
const skillPath = path.join(args.skillRoot, "SKILL.md");
const spinePath = path.join(args.skillRoot, "spine.md");
files["SKILL.md"] = replaceGeneratedBlock(readFileSync(skillPath, "utf8"), "domain-routing", renderDomainRouting(graph.domains));
files["spine.md"] = replaceGeneratedBlock(readFileSync(spinePath, "utf8"), "phase-spine", renderPhaseSpine(graph.phases));

let drift = false;
for (const [relative, content] of Object.entries(files)) {
  const target = path.join(args.skillRoot, relative);
  if (args.check) {
    if (!existsSync(target)) {
      console.error(`ERROR skill_graph.generated_missing: ${relative}`);
      drift = true;
    } else if (readFileSync(target, "utf8") !== content) {
      console.error(`ERROR skill_graph.generated_drift: ${relative}`);
      drift = true;
    }
  } else {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content, "utf8");
    console.log(`Wrote ${relative}`);
  }
}
if (drift) process.exitCode = 1;
else console.log(`Typed skill graph render: ${Object.keys(files).length} projection(s) ${args.check ? "current" : "written"}.`);

function parseArgs(argv: string[]): { skillRoot: string; check: boolean } {
  let skillRoot = defaultSkillRoot;
  let check = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--skill-root" && argv[index + 1]) {
      skillRoot = path.resolve(argv[index + 1]!);
      index += 1;
    } else if (argv[index] === "--check") check = true;
  }
  return { skillRoot, check };
}
