#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flagString, type Issue, issue, parseFlags, reportAndExit } from "../../scripts/lib/launch-state.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "../..");

function parseArgs(argv: string[]): { skillRoot: string; repoRoot?: string } {
  const flags = parseFlags(argv, [
    { flags: ["--skill-root", "--root"], key: "skillRoot" },
    { flags: ["--repo-root"], key: "repoRoot" },
  ]);
  return {
    skillRoot: flagString(flags, "skillRoot") ?? defaultSkillRoot,
    repoRoot: flagString(flags, "repoRoot"),
  };
}

function readRequired(filePath: string, label: string, issues: Issue[]): string {
  if (!existsSync(filePath)) {
    issues.push(issue("error", `workflow.${label}.missing`, `${label} is missing.`, filePath));
    return "";
  }
  return readFileSync(filePath, "utf8");
}

function requireTerms(text: string, terms: string[], label: string, filePath: string, issues: Issue[]): void {
  for (const term of terms) {
    if (!text.includes(term)) {
      issues.push(issue("error", `workflow.${label}.term_missing`, `${label} should include: ${term}`, filePath));
    }
  }
}

function warnIfTooLong(text: string, maxLines: number, label: string, filePath: string, issues: Issue[]): void {
  const lineCount = text.trimEnd().split("\n").length;
  if (lineCount > maxLines) {
    issues.push(issue("warning", `workflow.${label}.too_long`, `${label} is ${lineCount} lines; keep AGENTS-style files concise and map-like.`, filePath));
  }
}

const { skillRoot, repoRoot } = parseArgs(process.argv.slice(2));
const issues: Issue[] = [];

const parallelPath = path.join(skillRoot, "playbook", "process", "parallel-agent-orchestration.md");
const engineeringPath = path.join(skillRoot, "playbook", "engineering", "engineering-orchestration.md");
// The CE routing contract lives in the engineering lane of the split
// tool-recipes surface; the index only routes to it.
const toolRecipesPath = path.join(skillRoot, "playbook", "process", "tool-recipes", "engineering-and-agent-orchestration.md");
const compoundEngineeringPath = path.join(skillRoot, "playbook", "process", "compound-engineering-routing.md");
const templateAgentsPath = path.join(skillRoot, "business", "repo-agent-entrypoints", "AGENTS.md");
const templateClaudePath = path.join(skillRoot, "business", "repo-agent-entrypoints", "CLAUDE.md");
const orchestrationTemplatePath = path.join(skillRoot, "business", "ORCHESTRATION.md");
const projectStateTemplatePath = path.join(skillRoot, "business", "PROJECT_STATE.yaml");
const launchbenchDir = path.join(skillRoot, "evals", "launchbench");

const parallel = readRequired(parallelPath, "parallel_agent_reference", issues);
const engineering = readRequired(engineeringPath, "engineering_orchestration_reference", issues);
const toolRecipes = readRequired(toolRecipesPath, "tool_recipes_reference", issues);
const compoundEngineering = readRequired(compoundEngineeringPath, "compound_engineering_reference", issues);
const templateAgents = readRequired(templateAgentsPath, "business_agents_template", issues);
const templateClaude = readRequired(templateClaudePath, "business_claude_template", issues);
const orchestrationTemplate = readRequired(orchestrationTemplatePath, "orchestration_template", issues);
const projectStateTemplate = readRequired(projectStateTemplatePath, "project_state_template", issues);

requireTerms(
  parallel,
  [
    "OpenAI harness engineering",
    "subagents_unavailable",
    "Default for broad B2C launch work is `hybrid`",
    "Do not silently run broad multi-lane work fully inline",
    "mechanical checks or LaunchBench scenarios",
  ],
  "parallel_agent_reference",
  parallelPath,
  issues,
);

requireTerms(
  engineering,
  [
    "Load `compound-engineering-routing.md` first",
    "If Compound Engineering skills are unavailable",
    "do not silently skip them",
    "ce-brainstorm",
    "ce-plan",
    "ce-work",
    "ce-worktree",
    "dispatch read-only or isolated specialist audits",
  ],
  "engineering_orchestration_reference",
  engineeringPath,
  issues,
);

requireTerms(
  compoundEngineering,
  [
    "Required Loop",
    "ce-update",
    "ce-plan",
    "ce-work",
    "ce-code-review",
    "ce-proof",
    "https://github.com/EveryInc/compound-engineering-plugin/releases",
    "compound_engineering:",
  ],
  "compound_engineering_reference",
  compoundEngineeringPath,
  issues,
);

requireTerms(
  toolRecipes,
  [
    "Load `compound-engineering-routing.md` before core engineering",
    "CE availability, latest-version check, skills considered",
    "If Compound Engineering is unavailable",
    "do not let agents skip directly from docs to readiness",
    "active plans, validators, and failure cards",
  ],
  "tool_recipes_reference",
  toolRecipesPath,
  issues,
);

requireTerms(
  templateAgents,
  [
    "This file is a map, not a product spec",
    "mechanical enforcement",
    "validators, LaunchBench, and failure cards",
    "record why subagents are unavailable or unsafe",
    "record the fallback reason in `ORCHESTRATION.md`",
    "PROJECT_STATE.yaml` `compound_engineering`",
    "Session Continuity",
    "AGENTS.md",
    "Do not rely on chat memory",
    "git status --short",
  ],
  "business_agents_template",
  templateAgentsPath,
  issues,
);

requireTerms(
  templateClaude,
  [
    "For broad work, use subagents or record why they are unavailable or unsafe.",
    "Use Compound Engineering skills when available",
    "record unavailable routes rather than skipping them silently",
    "Session Continuity",
    "Do not rely on prior chat context",
  ],
  "business_claude_template",
  templateClaudePath,
  issues,
);

requireTerms(
  orchestrationTemplate,
  [
    "Subagent availability",
    "Session Continuity",
    "Continuity source set",
    "Memory policy",
    "Git status reviewed",
    "Strategy: `not_evaluated`",
    "Compound Engineering Routing",
    "CE freshness check",
    "ce-code-review",
    "ce-proof",
    "Fallback reason if unavailable",
  ],
  "orchestration_template",
  orchestrationTemplatePath,
  issues,
);

requireTerms(
  projectStateTemplate,
  [
    "continuity:",
    "last_state_review:",
    "source_files:",
    '- "AGENTS.md"',
    "git_status_reviewed:",
    "next_action:",
    "drift_risks:",
    'strategy: "not_evaluated"',
    "No orchestration preflight has been evaluated yet.",
    "compound_engineering:",
    "availability:",
    "latest_check:",
    "skills_considered:",
    "test_status:",
    "fallback_reason:",
  ],
  "project_state_template",
  projectStateTemplatePath,
  issues,
);

for (const scenario of [
  "compound-routing-skipped.yaml",
  "compound-freshness-not-checked.yaml",
  "subagent-dispatch-skipped.yaml",
  "continuity-drift-between-sessions.yaml",
]) {
  const scenarioPath = path.join(launchbenchDir, scenario);
  if (!existsSync(scenarioPath)) {
    issues.push(issue("error", `workflow.launchbench.${scenario}.missing`, `${scenario} is required to cover workflow-adherence regressions.`, scenarioPath));
  } else {
    const scenarioText = readFileSync(scenarioPath, "utf8");
    const requiredTerms = ["check-workflow-adherence", "must_catch", "should_say"];
    if (scenario === "continuity-drift-between-sessions.yaml") {
      requiredTerms.push(
        "check-continuity-contract",
        "PROJECT_STATE.yaml",
        "launch-cockpit.html",
        "ORCHESTRATION.md",
        "PRODUCTION_READINESS.md",
        "FAILURE_CARDS.md",
        "git status",
        "APP_AGENTS.md",
      );
    }
    requireTerms(scenarioText, requiredTerms, `launchbench_${scenario}`, scenarioPath, issues);
  }
}

warnIfTooLong(templateAgents, 140, "business_agents_template", templateAgentsPath, issues);
warnIfTooLong(templateClaude, 40, "business_claude_template", templateClaudePath, issues);

if (repoRoot) {
  const repoAgentsPath = path.join(repoRoot, "AGENTS.md");
  const repoClaudePath = path.join(repoRoot, "CLAUDE.md");
  const repoAgents = readRequired(repoAgentsPath, "repo_agents", issues);
  const repoClaude = readRequired(repoClaudePath, "repo_claude", issues);
  requireTerms(repoAgents, ["concise map", "validator/eval", "business/"], "repo_agents", repoAgentsPath, issues);
  requireTerms(repoClaude, ["Claude-specific pointer", "validators, and LaunchBench"], "repo_claude", repoClaudePath, issues);
  warnIfTooLong(repoAgents, 140, "repo_agents", repoAgentsPath, issues);
  warnIfTooLong(repoClaude, 40, "repo_claude", repoClaudePath, issues);
}

reportAndExit("Workflow adherence check", issues);
