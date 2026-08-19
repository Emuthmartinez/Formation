#!/usr/bin/env node
import { cpSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseDesignCliArgs, skillRoot } from "./lib/design-state.js";
import { resolveScriptPath } from "./lib/script-paths.js";
import { resolveTsxBin } from "./lib/tsx-bin.js";

const args = parseDesignCliArgs(process.argv.slice(2));
const [command, nameOrRef] = args.positionals;

if (!command || !["version", "baseline", "diff", "restore", "wipe"].includes(command)) {
  printUsage();
  process.exitCode = 1;
} else {
  run(command, nameOrRef);
}

function run(commandName: string, value?: string): void {
  if (commandName === "version") {
    const message = args.message ?? "design: update design room state";
    runSkillScript("validate-state.ts", ["--root", args.root]);
    renderAndCheckDesignRoom(true);
    runChecked("git", ["add", "studio/seed/business.json", "studio/seed/theme.tokens.json", "design/design.md", "design/design-room.html"], args.root);
    runChecked("git", ["commit", "-m", message], args.root);
    return;
  }

  if (commandName === "baseline") {
    if (!value) {
      fail("baseline requires a name.");
    }
    runChecked("git", ["tag", `baseline/${value}`], args.root);
    return;
  }

  if (commandName === "diff") {
    if (!value) {
      fail("diff requires a baseline name or git ref.");
    }
    runChecked("git", ["diff", normalizeBaseline(value), "--", "state/"], args.root);
    return;
  }

  if (commandName === "restore") {
    if (!value) {
      fail("restore requires a commit, tag, or baseline name.");
    }
    requireYes("restore");
    runChecked("git", ["checkout", normalizeBaseline(value), "--", "studio/seed/business.json", "studio/seed/theme.tokens.json"], args.root);
    renderAndCheckDesignRoom(false);
    return;
  }

  if (commandName === "wipe") {
    requireYes("wipe");
    if (!existsSync(args.emptyStatePath)) {
      fail(`Missing empty state skeleton: ${args.emptyStatePath}`);
    }
    cpSync(args.emptyStatePath, args.statePath);
    runSkillScript("validate-state.ts", ["--root", args.root]);
    renderAndCheckDesignRoom(false);
    runChecked("git", ["add", "studio/seed/business.json", "studio/seed/theme.tokens.json", "design/design.md", "design/design-room.html"], args.root);
    runChecked("git", ["commit", "-m", args.message ?? "design: wipe slate"], args.root);
  }
}

function renderAndCheckDesignRoom(staticOnly: boolean): void {
  const renderArgs = ["--root", args.root];
  if (staticOnly) {
    renderArgs.push("--static-only");
  }
  runSkillScript("render-design-room.ts", renderArgs);
  runSkillScript("check-design-room-contract.ts", ["--root", args.root]);
}

/**
 * Spawn a sibling script by basename. The directory is resolved rather than
 * assumed: renderers live in tooling/, gates live in validation/business/<domain>/, and
 * `design:version` is not an audit-plan step — so a hardcoded "scripts" here
 * would leave this command broken while the audit still reported green.
 */
function runSkillScript(scriptName: string, scriptArgs: string[]): void {
  runChecked("tsx", [resolveScriptPath(skillRoot, scriptName), ...scriptArgs], skillRoot);
}

function normalizeBaseline(value: string): string {
  return value.startsWith("baseline/") || value.includes("/") || /^[a-f0-9]{7,40}$/i.test(value) ? value : `baseline/${value}`;
}

function runChecked(binary: string, commandArgs: string[], cwd: string): void {
  const resolvedBinary = binary === "tsx" ? resolveTsxBin(cwd) : binary;
  const result = spawnSync(resolvedBinary, commandArgs, { cwd, encoding: "utf8" });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.error) {
    fail(result.error.message);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function requireYes(operation: string): void {
  if (!args.yes) {
    fail(`${operation} modifies state files. Re-run with --yes after confirming this is intended.`);
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function printUsage(): void {
  console.log(`Usage:
  tsx tooling/version.ts version --root <app> --message "design: <change>"
  tsx tooling/version.ts baseline <name> --root <app>
  tsx tooling/version.ts diff <name-or-ref> --root <app>
  tsx tooling/version.ts restore <name-or-ref> --root <app> --yes
  tsx tooling/version.ts wipe --root <app> --yes --message "design: wipe slate"
`);
}
