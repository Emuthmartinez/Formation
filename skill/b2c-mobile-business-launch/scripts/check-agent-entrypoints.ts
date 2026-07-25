#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flagString, type Issue, issue, parseFlags, reportAndExit } from "./lib/launch-state.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "..");

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

function readIfExists(filePath: string): string | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }
  return readFileSync(filePath, "utf8");
}

function requireFile(filePath: string, label: string, issues: Issue[]): string | undefined {
  const text = readIfExists(filePath);
  if (text === undefined) {
    issues.push(issue("error", `agent_entrypoints.${label}.missing`, `${label} is missing.`, filePath));
  }
  return text;
}

function requireTerms(text: string, terms: string[], label: string, filePath: string, issues: Issue[]): void {
  for (const term of terms) {
    if (!text.includes(term)) {
      issues.push(issue("error", `agent_entrypoints.${label}.term_missing`, `${label} should include: ${term}`, filePath));
    }
  }
}

function rejectTerms(text: string, terms: string[], label: string, filePath: string, issues: Issue[]): void {
  for (const term of terms) {
    if (text.includes(term)) {
      issues.push(issue("error", `agent_entrypoints.${label}.maintainer_leak`, `${label} should not include skill-maintainer-only text: ${term}`, filePath));
    }
  }
}

const { skillRoot, repoRoot } = parseArgs(process.argv.slice(2));
const issues: Issue[] = [];

const templateRoot = path.join(skillRoot, "templates", "repo-agent-entrypoints");
const templateAgentsPath = path.join(templateRoot, "AGENTS.md");
const templateClaudePath = path.join(templateRoot, "CLAUDE.md");
const templateAgents = requireFile(templateAgentsPath, "template_agents", issues);
const templateClaude = requireFile(templateClaudePath, "template_claude", issues);
const appAgentsPath = path.join(skillRoot, "templates", "app-agent-roster", "APP_AGENTS.md");
const designGuruPath = path.join(skillRoot, "templates", "app-agent-roster", "agents", "design-guru.md");
const productLeaderPath = path.join(skillRoot, "templates", "app-agent-roster", "agents", "product-leader.md");
const marketingGuruPath = path.join(skillRoot, "templates", "app-agent-roster", "agents", "marketing-guru.md");
const customerSuccessPath = path.join(skillRoot, "templates", "app-agent-roster", "agents", "customer-success.md");
const engineeringLeaderPath = path.join(skillRoot, "templates", "app-agent-roster", "agents", "engineering-leader.md");
const securityArchitectPath = path.join(skillRoot, "templates", "app-agent-roster", "agents", "security-architect.md");
const appAgents = requireFile(appAgentsPath, "app_agents", issues);
const designGuru = requireFile(designGuruPath, "design_guru", issues);
const productLeader = requireFile(productLeaderPath, "product_leader", issues);
const marketingGuru = requireFile(marketingGuruPath, "marketing_guru", issues);
const customerSuccess = requireFile(customerSuccessPath, "customer_success", issues);
const engineeringLeader = requireFile(engineeringLeaderPath, "engineering_leader", issues);
const securityArchitect = requireFile(securityArchitectPath, "security_architect", issues);

if (templateAgents) {
  requireTerms(
    templateAgents,
    [
      "{{APP_NAME}}",
      "{{BUSINESS_NAME}}",
      "{{PRODUCT_BRIEF}}",
      "{{STACK_SUMMARY}}",
      "b2c-mobile-business-launch",
      "do not ask the founder to re-invoke it",
      "PROJECT_STATE.yaml",
      "launch-cockpit.html",
      "BUSINESS_ACCESS.md",
      "operations/business-access.json",
      "AGENT_OPERATIONS.md",
      "operations/agent-operations.json",
      "APP_AGENTS.md",
      "ORCHESTRATION.md",
      "PRODUCTION_READINESS.md",
      "FAILURE_CARDS.md",
      "Session Continuity",
      "Do not rely on chat memory",
      "git status --short",
      "role prompts",
      "SECRETS.md",
      "SECURITY.md",
      "LaunchBench",
      "founder-only",
      "Doppler",
      "Compound Engineering",
      "MobAI",
      // The zero-setup route is the one a later edit is likeliest to drop, so
      // hold it in the generated entrypoint the same way MobAI is held.
      "in-app iOS Simulator",
      "RevenueCat",
      "PostHog",
      "EMOTIONAL_DESIGN.md",
      "EMOTIONAL_AUDIT.md",
      "check:emotional-design",
      "BRAND.md",
      "DEMO_VIDEO.md",
      "app-store-connect-cli.md",
      "ASC CLI/skill routes can cover app creation",
      "ParthJadhav/app-store-screenshots",
      "frontier-agent-operations.md",
      "founder-zero-operator.md",
      "Assume the founder is new to business operations",
      "check:founder-operator",
    ],
    "template_agents",
    templateAgentsPath,
    issues,
  );
  rejectTerms(
    templateAgents,
    ["This repo maintains the `b2c-mobile-business-launch` skill", "runtime sync", "npm pack --dry-run"],
    "template_agents",
    templateAgentsPath,
    issues,
  );
}

if (templateClaude) {
  requireTerms(
    templateClaude,
    [
      "{{APP_NAME}}",
      "Read `AGENTS.md` first",
      "b2c-mobile-business-launch",
      'Do not ask the founder to say "use the skill" again',
      "Session Continuity",
      "Do not rely on prior chat context",
      "APP_AGENTS.md",
      "ORCHESTRATION.md",
      "BUSINESS_ACCESS.md",
      "operations/business-access.json",
      "ASC CLI/skills",
      "AGENT_OPERATIONS.md",
      "frontier-agent-operations.md",
      "beginner founder knowledge",
    ],
    "template_claude",
    templateClaudePath,
    issues,
  );
  rejectTerms(
    templateClaude,
    ["This repo maintains the `b2c-mobile-business-launch` skill", "runtime sync", "npm pack --dry-run"],
    "template_claude",
    templateClaudePath,
    issues,
  );
}

if (appAgents) {
  requireTerms(
    appAgents,
    [
      "Session Continuity",
      "Do not rely on chat memory",
      "role prompts",
      "EMOTIONAL_DESIGN.md",
      "EMOTIONAL_AUDIT.md",
      "Experience Cards",
      "check:emotional-design",
      "BRAND.md",
      "DEMO_VIDEO.md",
      "BUSINESS_ACCESS.md",
      "operations/business-access.json",
      "check:founder-operator",
    ],
    "app_agents",
    appAgentsPath,
    issues,
  );
}

if (designGuru) {
  requireTerms(
    designGuru,
    [
      "Session Continuity",
      "Do not rely on chat memory",
      "EMOTIONAL_DESIGN.md",
      "EMOTIONAL_AUDIT.md",
      "Experience Card",
      "check:emotional-design",
      "BRAND.md",
      "DEMO_VIDEO.md",
    ],
    "design_guru",
    designGuruPath,
    issues,
  );
}

if (productLeader) {
  requireTerms(
    productLeader,
    ["Session Continuity", "Do not rely on chat memory", "EMOTIONAL_DESIGN.md", "EMOTIONAL_AUDIT.md", "Experience Card", "dark-pattern"],
    "product_leader",
    productLeaderPath,
    issues,
  );
}

if (marketingGuru) {
  requireTerms(
    marketingGuru,
    [
      "Session Continuity",
      "Do not rely on chat memory",
      "EMOTIONAL_DESIGN.md",
      "Experience Cards",
      "BRAND.md",
      "DEMO_VIDEO.md",
      "BUSINESS_ACCESS.md",
      "operations/business-access.json",
      "AGENT_OPERATIONS.md",
      "approval envelope",
      "revocation path",
    ],
    "marketing_guru",
    marketingGuruPath,
    issues,
  );
}

if (customerSuccess) {
  requireTerms(
    customerSuccess,
    [
      "Session Continuity",
      "Do not rely on chat memory",
      "BUSINESS_ACCESS.md",
      "operations/business-access.json",
      "AGENT_OPERATIONS.md",
      "approval envelope",
      "revocation path",
    ],
    "customer_success",
    customerSuccessPath,
    issues,
  );
}

if (engineeringLeader) {
  requireTerms(engineeringLeader, ["Session Continuity", "Do not rely on chat memory"], "engineering_leader", engineeringLeaderPath, issues);
}

if (securityArchitect) {
  requireTerms(securityArchitect, ["Session Continuity", "Do not rely on chat memory"], "security_architect", securityArchitectPath, issues);
}

if (repoRoot) {
  const repoAgentsPath = path.join(repoRoot, "AGENTS.md");
  const repoClaudePath = path.join(repoRoot, "CLAUDE.md");
  const repoAgents = requireFile(repoAgentsPath, "repo_agents", issues);
  const repoClaude = requireFile(repoClaudePath, "repo_claude", issues);

  if (repoAgents) {
    requireTerms(
      repoAgents,
      [
        "This file is for maintaining this skill repo itself",
        "Do not copy these instructions into a launched business or generated app repo",
        "templates/repo-agent-entrypoints",
        "Runtime Sync",
        "Source Freshness",
      ],
      "repo_agents",
      repoAgentsPath,
      issues,
    );
  }

  if (repoClaude) {
    requireTerms(
      repoClaude,
      ["maintainer-only", "Do not copy it into businesses created by the skill", "templates/repo-agent-entrypoints/CLAUDE.md"],
      "repo_claude",
      repoClaudePath,
      issues,
    );
  }
}

reportAndExit("Agent entrypoint template check", issues);
