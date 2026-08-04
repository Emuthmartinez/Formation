/**
 * Executes the shipped Claude Code hooks from
 * business/engineering/repo-agent-entrypoints/settings.json with sample tool payloads.
 * These hooks are the enforcement layer copied into generated business repos;
 * before this module nothing tested them, and their documented failure modes
 * (missing jq, missing SKILL_ROOT) used to be silent. Asserts:
 *   - the blocking final-PNG gates fire (exit 1) with and without SKILL_ROOT
 *   - benign payloads pass through (exit 0)
 *   - missing SKILL_ROOT and missing jq warn loudly instead of no-opping
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { skillRoot, type Harness } from "./_harness.js";
import { readHookTemplate } from "../../../tooling/lib/hook-contract.js";

interface HookSettings {
  hooks: { PostToolUse: Array<{ matcher: string; hooks: Array<{ command: string }> }> };
}

function loadHookCommands(): { writeEditDepth: string; bashHook: string; finalPng: string } {
  const settingsPath = path.join(skillRoot, "workspace", "business", "engineering/repo-agent-entrypoints", "settings.json");
  const parsed = JSON.parse(readFileSync(settingsPath, "utf8")) as HookSettings;
  const postToolUse = parsed.hooks.PostToolUse;
  const command = (index: number): string => {
    const entry = postToolUse[index]?.hooks[0]?.command;
    if (!entry) {
      throw new Error(`settings.json PostToolUse[${index}] hook command is missing.`);
    }
    return entry;
  };
  return { writeEditDepth: command(0), bashHook: command(1), finalPng: command(2) };
}

function runHook(
  harness: Harness,
  label: string,
  command: string,
  toolInput: Record<string, unknown>,
  expectedCode: number,
  expectedText: string | undefined,
  cwd: string,
  env: Record<string, string | undefined>,
): void {
  const result = spawnSync("/bin/bash", ["-c", command], {
    cwd,
    encoding: "utf8",
    env: { ...env, CLAUDE_TOOL_INPUT: JSON.stringify(toolInput) } as NodeJS.ProcessEnv,
  });
  const output = `${result.stdout}\n${result.stderr}`;
  harness.results.push({
    label,
    ok: result.status === expectedCode && (!expectedText || output.includes(expectedText)),
    expectedCode,
    actualCode: result.status,
    expectedText,
    output,
  });
}

export function register(harness: Harness): void {
  const commands = loadHookCommands();
  // A cwd without tooling/run-audit.ts, so the SKILL_ROOT local-dev sentinel does not apply.
  const businessRepo = harness.makeEmptyFixture("hooks-business-repo");
  const baseEnv: Record<string, string | undefined> = { ...process.env, SKILL_ROOT: undefined };

  runHook(
    harness,
    "hook final-PNG Write blocks with grading-pass instructions",
    commands.finalPng,
    { file_path: "screenshots/final/hero.png" },
    1,
    "SEPARATE GRADING PASS",
    businessRepo,
    baseEnv,
  );

  runHook(harness, "hook final-PNG Write ignores benign file paths", commands.finalPng, { file_path: "src/App.tsx" }, 0, undefined, businessRepo, baseEnv);

  runHook(
    harness,
    "hook Bash cp into screenshots/final blocks without SKILL_ROOT",
    commands.bashHook,
    { command: "cp /tmp/raw.png screenshots/final/hero.png" },
    1,
    "SEPARATE GRADING PASS",
    businessRepo,
    baseEnv,
  );

  runHook(
    harness,
    "hook depth-check warns loudly when SKILL_ROOT is unset",
    commands.writeEditDepth,
    { file_path: "docs/analytics/ANALYTICS.md" },
    0,
    "SKILL_ROOT is not set",
    businessRepo,
    baseEnv,
  );

  runHook(
    harness,
    "hook Bash benign command warns loudly when SKILL_ROOT is unset",
    commands.bashHook,
    { command: "ls -la" },
    0,
    "SKILL_ROOT is not set",
    businessRepo,
    baseEnv,
  );

  // PATH without jq: the guard must warn and exit 0 instead of silently no-opping.
  runHook(
    harness,
    "hook depth-check warns loudly when jq is missing",
    commands.writeEditDepth,
    { file_path: "docs/analytics/ANALYTICS.md" },
    0,
    "jq is not on PATH",
    businessRepo,
    { ...baseEnv, PATH: "/nonexistent-bin" },
  );

  registerInstallation(harness);
}

/**
 * Installation round-trip for check-hooks-installed.
 *
 * The hooks above are proven to behave correctly; these prove they are
 * actually delivered. Before install-hooks.ts existed, the only instruction
 * was a prose line inside the template's JSON comment, so a business repo
 * could pass every gate with no enforcement running at all.
 *
 * The reinstall cases matter most: a merge that duplicated our entries or
 * dropped the founder's own hooks would be a silent, repo-corrupting bug that
 * no other gate would catch.
 */
function registerInstallation(harness: Harness): void {
  const installer = "install-hooks.ts";
  const validator = "check-hooks-installed.ts";
  const repo = harness.makeEmptyFixture("hooks-install-roundtrip");
  const settingsPath = path.join(repo, ".claude", "settings.json");

  harness.runScriptArgs(
    "check:hooks-installed fails on a repo with no .claude/settings.json",
    validator,
    ["--skill-root", skillRoot, "--root", repo],
    1,
    "settings_missing",
  );

  // A hook the founder wrote themselves, plus unrelated settings: both must
  // survive every reinstall.
  mkdirSync(path.dirname(settingsPath), { recursive: true });
  writeFileSync(
    settingsPath,
    JSON.stringify(
      {
        permissions: { allow: ["Bash(npm run test)"] },
        hooks: { PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "echo founder-owned-hook" }] }] },
      },
      null,
      2,
    ),
  );

  harness.runScriptArgs(
    "install:hooks installs into a repo with pre-existing settings",
    installer,
    ["--skill-root", skillRoot, "--target", repo],
    0,
    "managed hook entries installed",
  );
  harness.runScriptArgs("check:hooks-installed passes after install", validator, ["--skill-root", skillRoot, "--root", repo], 0);

  // Idempotency: a second install must replace, not append.
  harness.runScriptArgs("install:hooks is idempotent", installer, ["--skill-root", skillRoot, "--target", repo], 0, "managed hook entries installed");

  const afterReinstall = JSON.parse(readFileSync(settingsPath, "utf8")) as {
    permissions?: unknown;
    hooks: { PostToolUse: Array<{ hooks?: Array<{ command?: string }> }> };
  };
  // Derived from the template, not hardcoded: adding a fourth shipped hook
  // should not silently invalidate this assertion.
  const shippedCount = readHookTemplate(skillRoot).entries.length;
  const foreignSurvived = afterReinstall.hooks.PostToolUse.some((entry) => entry.hooks?.[0]?.command === "echo founder-owned-hook");
  harness.results.push({
    label: "install:hooks replaces its own entries and preserves foreign ones",
    ok: afterReinstall.hooks.PostToolUse.length === shippedCount + 1 && foreignSurvived && afterReinstall.permissions !== undefined,
    expectedCode: 0,
    actualCode: 0,
    expectedText: `${shippedCount + 1} entries, founder hook and permissions intact`,
    output: `entries=${afterReinstall.hooks.PostToolUse.length} foreignSurvived=${foreignSurvived} permissions=${JSON.stringify(afterReinstall.permissions)}`,
  });

  // Drift: an installed command that no longer matches the shipped one must
  // fail, because a stale hook can call a validator that no longer exists.
  const drifted = JSON.parse(readFileSync(settingsPath, "utf8")) as { hooks: { PostToolUse: Array<{ hooks?: Array<{ command?: string }> }> } };
  const managedIndex = drifted.hooks.PostToolUse.findIndex((entry) => entry.hooks?.[0]?.command?.includes("b2c-mobile-business-launch"));
  if (managedIndex >= 0 && drifted.hooks.PostToolUse[managedIndex]?.hooks?.[0]) {
    drifted.hooks.PostToolUse[managedIndex].hooks[0].command = "echo b2c-mobile-business-launch stale-command";
    writeFileSync(settingsPath, JSON.stringify(drifted, null, 2));
  }
  // Asserting the issue code, not just exit 1: a crashing validator also exits
  // 1, so a bare exit-code assertion here would pass for the wrong reason.
  harness.runScriptArgs("check:hooks-installed fails on a drifted hook command", validator, ["--skill-root", skillRoot, "--root", repo], 1, "command_drift");
  harness.runScriptArgs("install:hooks refreshes a drifted hook", installer, ["--skill-root", skillRoot, "--target", repo], 0);
  harness.runScriptArgs("check:hooks-installed passes after refresh", validator, ["--skill-root", skillRoot, "--root", repo], 0);

  // The audit runs this gate against business/, which is not a business
  // repo. It must say so rather than assert installation vacuously.
  harness.runScriptArgs(
    "check:hooks-installed skips installation checks against the skill template tree",
    validator,
    ["--skill-root", skillRoot, "--root", path.join(skillRoot, "workspace", "business")],
    0,
    "not a business repo",
  );
}
