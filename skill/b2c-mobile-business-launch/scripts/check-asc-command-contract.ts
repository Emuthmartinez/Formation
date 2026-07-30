#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { flagString, issue, parseFlags, reportAndExit, type Issue } from "./lib/launch-state.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "..");
const flags = parseFlags(process.argv.slice(2), [{ flags: ["--skill-root", "--root"], key: "skillRoot" }]);
const skillRoot = flagString(flags, "skillRoot") ?? defaultSkillRoot;
const referencePath = path.join(skillRoot, "playbook", "store", "app-store-connect-cli.md");
const issues: Issue[] = [];

if (!existsSync(referencePath)) {
  issues.push(issue("error", "asc_command_contract.reference_missing", "app-store-connect-cli.md is missing.", referencePath));
} else {
  const text = readFileSync(referencePath, "utf8");
  const forbidden = ["asc apps get", "asc validate app-store-version"];
  for (const guidancePath of collectGuidanceFiles()) {
    const guidance = readFileSync(guidancePath, "utf8");
    for (const command of forbidden) {
      const commandLine = new RegExp(`(?:^|\\n)\\s*(?:[>$]\\s*)?${escapeRegex(command)}(?:\\s|$)`);
      if (commandLine.test(guidance)) {
        issues.push(
          issue(
            "error",
            `asc_command_contract.stale_${code(command)}`,
            `Stored executable guidance contains the known-invalid command: ${command}. Refresh local asc --help before replacing it.`,
            path.relative(skillRoot, guidancePath),
          ),
        );
      }
    }
  }

  for (const command of [
    "asc apps view",
    "asc status --app",
    "asc review status",
    "asc review doctor",
    "asc review submissions-list",
    "asc diff localizations",
    "--version-id <VERSION_ID>",
  ]) {
    if (!text.includes(command)) {
      issues.push(
        issue(
          "error",
          `asc_command_contract.current_${code(command)}_missing`,
          `Stored ASC guidance must include the current command contract: ${command}.`,
          path.relative(skillRoot, referencePath),
        ),
      );
    }
  }
}

const version = spawnSync("asc", ["--version"], { encoding: "utf8" });
if (!version.error && version.status === 0) {
  const installedMajor = parseMajorVersion(`${version.stdout ?? ""}\n${version.stderr ?? ""}`);
  verifyLiveHelp(["validate", "--help"], ["--version", "--version-id"]);
  if (installedMajor !== null && installedMajor < 2) {
    issues.push(
      issue(
        "warning",
        "asc_command_contract.live_cli_stale",
        `Installed asc ${installedMajor}.x predates the stored 2.x contract; update the shadowed CLI before using executable guidance.`,
        "playbook/store/app-store-connect-cli.md",
      ),
    );
    verifyLiveHelp(["review", "--help"], ["submissions-list"]);
  } else {
    verifyLiveHelp(["apps", "--help"], ["view"]);
    verifyLiveHelp(["review", "--help"], ["status", "doctor", "submissions-list"]);
  }
  verifyLiveHelp(["diff", "--help"], ["localizations"]);
}

reportAndExit("ASC command contract check", issues);

function verifyLiveHelp(args: string[], required: string[]): void {
  const result = spawnSync("asc", args, { encoding: "utf8" });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.status !== 0) {
    issues.push(
      issue(
        "error",
        `asc_command_contract.live_help_${code(args.join("_"))}_failed`,
        `Installed asc ${args.join(" ")} failed; refresh the CLI/reference before release.`,
        "playbook/store/app-store-connect-cli.md",
      ),
    );
    return;
  }
  for (const term of required) {
    if (!hasHelpToken(output, term)) {
      issues.push(
        issue(
          "error",
          `asc_command_contract.live_help_${code(term)}_missing`,
          `Installed asc ${args.join(" ")} no longer exposes ${term}; update the stored command contract.`,
          "playbook/store/app-store-connect-cli.md",
        ),
      );
    }
  }
}

function collectGuidanceFiles(): string[] {
  const files: string[] = [];
  for (const base of [path.join(skillRoot, "playbook"), path.join(skillRoot, "templates")]) {
    if (!existsSync(base)) continue;
    const visit = (directory: string): void => {
      for (const name of readdirSync(directory)) {
        const fullPath = path.join(directory, name);
        if (statSync(fullPath).isDirectory()) visit(fullPath);
        else if (/\.(?:md|ya?ml|json)$/i.test(name)) files.push(fullPath);
      }
    };
    visit(base);
  }
  return files;
}

function hasHelpToken(output: string, term: string): boolean {
  if (term.startsWith("--")) {
    return new RegExp(`(?:^|[\\s,])${escapeRegex(term)}(?=[\\s,=<]|$)`, "m").test(output);
  }
  return new RegExp(`^\\s{0,12}${escapeRegex(term)}(?:\\s|$)`, "m").test(output);
}

function parseMajorVersion(output: string): number | null {
  const match = output.match(/(?:^|\s)v?(\d+)\.\d+\.\d+(?:\s|$)/);
  if (!match?.[1]) return null;
  const major = Number.parseInt(match[1], 10);
  return Number.isFinite(major) ? major : null;
}

function code(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
