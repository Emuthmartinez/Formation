#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { flagString, isRecord, parseFlags } from "../../scripts/lib/launch-state.js";

type Issue = {
  code: string;
  message: string;
};

type Args = {
  mode: "skill" | "business";
  skillRoot: string;
  businessRoot?: string;
};

type ContractPaths = {
  agents: string;
  claude: string;
  appAgents: string;
  specialistPrompts: Array<{ label: string; filePath: string }>;
  orchestrator: string;
  orchestration: string;
  projectState: string;
};

function parseArgs(argv: string[]): Args {
  const flags = parseFlags(argv, [
    { flags: ["--skill-root"], key: "skillRoot", strict: true },
    { flags: ["--root"], key: "businessRoot", strict: true },
  ]);
  const skillRoot = flagString(flags, "skillRoot") ?? process.cwd();
  const businessRoot = flagString(flags, "businessRoot");

  // Mode follows the last mode flag seen, mirroring the original scan: each
  // flag consumes its value token, so a value is never itself read as a flag.
  let mode: "skill" | "business" = "skill";
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--skill-root" || token === "--root") {
      mode = token === "--root" ? "business" : "skill";
      index += 1;
    }
  }

  if (mode === "business" && businessRoot) {
    return { mode: "business", skillRoot, businessRoot };
  }

  return { mode: "skill", skillRoot };
}

function contractPaths(args: Args): ContractPaths {
  if (args.mode === "skill") {
    return {
      agents: path.join(args.skillRoot, "business/repo-agent-entrypoints/AGENTS.md"),
      claude: path.join(args.skillRoot, "business/repo-agent-entrypoints/CLAUDE.md"),
      appAgents: path.join(args.skillRoot, "business/app-agent-roster/APP_AGENTS.md"),
      specialistPrompts: specialistPromptNames().map((fileName) => ({
        label: fileName,
        filePath: path.join(args.skillRoot, "business/app-agent-roster/agents", fileName),
      })),
      orchestrator: path.join(args.skillRoot, "business/app-agent-roster/agents/orchestrator.md"),
      orchestration: path.join(args.skillRoot, "business/ORCHESTRATION.md"),
      projectState: path.join(args.skillRoot, "business/PROJECT_STATE.yaml"),
    };
  }

  const root = args.businessRoot ?? process.cwd();
  return {
    agents: path.join(root, "AGENTS.md"),
    claude: path.join(root, "CLAUDE.md"),
    appAgents: path.join(root, "APP_AGENTS.md"),
    specialistPrompts: specialistPromptNames().map((fileName) => ({
      label: fileName,
      filePath: path.join(root, "agents", fileName),
    })),
    orchestrator: path.join(root, "agents/orchestrator.md"),
    orchestration: path.join(root, "ORCHESTRATION.md"),
    projectState: path.join(root, "PROJECT_STATE.yaml"),
  };
}

function specialistPromptNames(): string[] {
  return ["customer-success.md", "design-guru.md", "engineering-leader.md", "marketing-guru.md", "product-leader.md", "security-architect.md"];
}

function readRequired(filePath: string, label: string, issues: Issue[]): string | undefined {
  if (!existsSync(filePath)) {
    issues.push({
      code: "continuity.file_missing",
      message: `${label} is missing at ${filePath}`,
    });
    return undefined;
  }
  return readFileSync(filePath, "utf8");
}

function requireTerms(label: string, text: string | undefined, terms: string[], issues: Issue[]): void {
  if (text === undefined) {
    return;
  }

  for (const term of terms) {
    if (!text.includes(term)) {
      issues.push({
        code: "continuity.term_missing",
        message: `${label} must mention "${term}"`,
      });
    }
  }
}

/**
 * Deliberately not launch-state's asString, and deliberately not named like it. This one
 * rejects whitespace-only values, which is the whole point here: a continuity field set to
 * " " is an unreviewed field, not a reviewed one. It carried the shared name until v0.63.0,
 * so a reader who knew asString elsewhere would have assumed " " passed.
 */
function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function validateProjectState(text: string | undefined, issues: Issue[]): Record<string, unknown> | undefined {
  if (text === undefined) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch (error) {
    issues.push({
      code: "continuity.project_state_yaml",
      message: `PROJECT_STATE.yaml could not be parsed: ${(error as Error).message}`,
    });
    return undefined;
  }

  if (!isRecord(parsed)) {
    issues.push({
      code: "continuity.project_state_shape",
      message: "PROJECT_STATE.yaml must be a YAML mapping",
    });
    return undefined;
  }

  const continuity = parsed.continuity;
  if (!isRecord(continuity)) {
    issues.push({
      code: "continuity.project_state_missing",
      message: "PROJECT_STATE.yaml must include a top-level continuity block",
    });
    return undefined;
  }

  if (!asNonEmptyString(continuity.last_state_review)) {
    issues.push({
      code: "continuity.project_state_review_missing",
      message: "continuity.last_state_review must be present",
    });
  }

  if (!asNonEmptyString(continuity.next_action)) {
    issues.push({
      code: "continuity.project_state_next_action_missing",
      message: "continuity.next_action must be present",
    });
  }

  if (!Array.isArray(continuity.drift_risks)) {
    issues.push({
      code: "continuity.project_state_drift_risks_missing",
      message: "continuity.drift_risks must be an array",
    });
  }

  if (typeof continuity.git_status_reviewed !== "boolean") {
    issues.push({
      code: "continuity.project_state_git_status_missing",
      message: "continuity.git_status_reviewed must be true or false",
    });
  }

  if (asNonEmptyString(continuity.last_state_review) && continuity.last_state_review !== "not_reviewed" && continuity.git_status_reviewed !== true) {
    issues.push({
      code: "continuity.project_state_git_status_unreviewed",
      message: "continuity.git_status_reviewed must be true after a recorded state review",
    });
  }

  const sourceFiles = continuity.source_files;
  if (!Array.isArray(sourceFiles)) {
    issues.push({
      code: "continuity.project_state_sources_missing",
      message: "continuity.source_files must list the session source-of-truth files",
    });
    return continuity;
  }

  const sourceFileSet = new Set(sourceFiles.filter((value): value is string => typeof value === "string"));
  for (const required of [
    "AGENTS.md",
    "PROJECT_STATE.yaml",
    "launch-cockpit.html",
    "BUSINESS_ACCESS.md",
    "operations/business-access.json",
    "AGENT_OPERATIONS.md",
    "operations/agent-operations.json",
    "ORCHESTRATION.md",
    "PRODUCTION_READINESS.md",
    "FAILURE_CARDS.md",
  ]) {
    if (!sourceFileSet.has(required)) {
      issues.push({
        code: "continuity.project_state_source_missing",
        message: `continuity.source_files must include ${required}`,
      });
    }
  }

  return continuity;
}

function validateBusinessRoot(root: string | undefined, continuity: Record<string, unknown> | undefined, issues: Issue[]): void {
  if (!root || !continuity) {
    return;
  }

  const sourceFiles = continuity.source_files;
  const required = Array.isArray(sourceFiles)
    ? sourceFiles.filter((value): value is string => typeof value === "string")
    : [
        "AGENTS.md",
        "PROJECT_STATE.yaml",
        "launch-cockpit.html",
        "AGENT_OPERATIONS.md",
        "operations/agent-operations.json",
        "ORCHESTRATION.md",
        "PRODUCTION_READINESS.md",
        "FAILURE_CARDS.md",
      ];

  for (const relativePath of required) {
    const absolutePath = path.join(root, relativePath);
    if (!existsSync(absolutePath)) {
      issues.push({
        code: "continuity.source_file_missing",
        message: `Continuity source file is missing: ${relativePath}`,
      });
    }
  }
}

function markdownSection(text: string | undefined, heading: string): string | undefined {
  if (!text) return undefined;
  const match = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*$`, "im").exec(text);
  if (!match || match.index === undefined) return undefined;
  const rest = text.slice(match.index + match[0].length);
  const next = /^##\s+/m.exec(rest);
  return next?.index === undefined ? rest : rest.slice(0, next.index);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const paths = contractPaths(args);
  const issues: Issue[] = [];

  const agents = readRequired(paths.agents, "AGENTS.md", issues);
  const claude = readRequired(paths.claude, "CLAUDE.md", issues);
  const appAgents = readRequired(paths.appAgents, "APP_AGENTS.md", issues);
  const orchestrator = readRequired(paths.orchestrator, "orchestrator role prompt", issues);
  const specialistPrompts = paths.specialistPrompts.map(({ label, filePath }) => ({
    label,
    text: readRequired(filePath, label, issues),
  }));
  const orchestration = readRequired(paths.orchestration, "ORCHESTRATION.md", issues);
  const projectState = readRequired(paths.projectState, "PROJECT_STATE.yaml", issues);

  requireTerms(
    "AGENTS.md",
    agents,
    [
      "Session Continuity",
      "Do not rely on chat memory",
      "AGENTS.md",
      "PROJECT_STATE.yaml",
      "launch-cockpit.html",
      "BUSINESS_ACCESS.md",
      "operations/business-access.json",
      "AGENT_OPERATIONS.md",
      "operations/agent-operations.json",
      "ORCHESTRATION.md",
      "PRODUCTION_READINESS.md",
      "FAILURE_CARDS.md",
      "git status --short",
      "APP_AGENTS.md",
      "role prompts",
    ],
    issues,
  );

  requireTerms(
    "AGENTS.md Session Continuity section",
    markdownSection(agents, "Session Continuity"),
    ["BUSINESS_ACCESS.md", "operations/business-access.json", "AGENT_OPERATIONS.md", "operations/agent-operations.json"],
    issues,
  );

  requireTerms(
    "CLAUDE.md",
    claude,
    [
      "Session Continuity",
      "Do not rely on prior chat context",
      "PROJECT_STATE.yaml",
      "launch-cockpit.html",
      "BUSINESS_ACCESS.md",
      "operations/business-access.json",
      "AGENT_OPERATIONS.md",
      "operations/agent-operations.json",
      "ORCHESTRATION.md",
    ],
    issues,
  );

  requireTerms(
    "APP_AGENTS.md",
    appAgents,
    [
      "Session Continuity",
      "Do not rely on chat memory",
      "role prompts",
      "PROJECT_STATE.yaml",
      "BUSINESS_ACCESS.md",
      "operations/business-access.json",
      "AGENT_OPERATIONS.md",
      "operations/agent-operations.json",
      "ORCHESTRATION.md",
    ],
    issues,
  );

  requireTerms(
    "orchestrator role prompt",
    orchestrator,
    [
      "Session Continuity",
      "git status --short",
      "Do not rely on chat memory",
      "state updates",
      "BUSINESS_ACCESS.md",
      "operations/business-access.json",
      "AGENT_OPERATIONS.md",
      "operations/agent-operations.json",
    ],
    issues,
  );

  for (const specialist of specialistPrompts) {
    requireTerms(specialist.label, specialist.text, ["Session Continuity", "Do not rely on chat memory", "drift risks", "failure cards"], issues);
  }

  requireTerms(
    "ORCHESTRATION.md",
    orchestration,
    [
      "## Session Continuity",
      "Last state review",
      "Continuity source set",
      "BUSINESS_ACCESS.md",
      "operations/business-access.json",
      "Memory policy",
      "Do not rely on chat memory",
      "Git status reviewed",
      "Next action",
    ],
    issues,
  );

  const continuity = validateProjectState(projectState, issues);
  if (args.mode === "business") {
    validateBusinessRoot(args.businessRoot, continuity, issues);
  }

  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`[${issue.code}] ${issue.message}`);
    }
    process.exit(1);
  }

  console.log(`Continuity contract passed for ${args.mode === "skill" ? args.skillRoot : args.businessRoot}`);
}

main();
