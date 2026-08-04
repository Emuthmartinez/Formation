#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { buildDispatchBatches, compileExecutionPlan, initializeRun, type RuntimeCapabilities } from "../runtime/graph/execution.js";
import { composeSkillGraph } from "../runtime/graph/graph.js";

interface Options {
  skillRoot: string;
  projectRoot: string;
  statePath: string;
  out: string;
  runtime: "inline" | "codex" | "claude";
  check: boolean;
}

const options = parseOptions(process.argv.slice(2));
const graph = composeSkillGraph(options.skillRoot);
const stateFile = path.resolve(options.projectRoot, options.statePath);
const projectState = parse(readFileSync(stateFile, "utf8")) as unknown;
const plan = compileExecutionPlan(graph);
const run = initializeRun(plan);
const capabilities = runtimeCapabilities(options.runtime);
const batches = buildDispatchBatches(plan, run, capabilities, projectState);
const rendered = `${JSON.stringify({ plan, run, batches, runtime: options.runtime, capabilities }, null, 2)}\n`;
const target = path.resolve(options.out);

if (options.check) {
  const actual = readFileSync(target, "utf8");
  if (actual !== rendered) {
    console.error(`Execution plan projection is stale: ${target}`);
    process.exitCode = 1;
  } else {
    console.log(`Execution plan projection is current: ${target}`);
  }
} else {
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, rendered);
  console.log(`Wrote runtime-neutral execution plan: ${target}`);
  console.log(`${plan.nodes.length} node(s), ${batches.length} initial batch(es), compatibility edges ${plan.catalog.dependencyEdges}.`);
}

function runtimeCapabilities(runtime: Options["runtime"]): RuntimeCapabilities {
  if (runtime === "claude") return { dynamicWorkflows: true, subagents: true, worktrees: true, maxConcurrency: 16 };
  if (runtime === "codex") return { dynamicWorkflows: false, subagents: true, worktrees: true, maxConcurrency: 8 };
  return { dynamicWorkflows: false, subagents: false, worktrees: false, maxConcurrency: 1 };
}

function parseOptions(argv: string[]): Options {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const defaults: Options = {
    skillRoot: path.resolve(scriptDir, ".."),
    projectRoot: process.cwd(),
    statePath: "state/PROJECT_STATE.yaml",
    out: "graph-run/execution-plan.json",
    runtime: "inline",
    check: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (token === "--skill-root" && value) {
      defaults.skillRoot = path.resolve(value);
      index += 1;
    } else if (token === "--root" && value) {
      defaults.projectRoot = path.resolve(value);
      index += 1;
    } else if (token === "--state" && value) {
      defaults.statePath = value;
      index += 1;
    } else if (token === "--out" && value) {
      defaults.out = value;
      index += 1;
    } else if (token === "--runtime" && (value === "inline" || value === "codex" || value === "claude")) {
      defaults.runtime = value;
      index += 1;
    } else if (token === "--check") {
      defaults.check = true;
    }
  }
  return defaults;
}
