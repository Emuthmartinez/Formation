#!/usr/bin/env node
/**
 * install-hooks.ts — install this skill's PostToolUse hooks into a business repo.
 *
 * The hooks in business/repo-agent-entrypoints/settings.json are the skill's
 * only automatic enforcement layer: they fire depth-check validators after the
 * agent writes an artifact, and they block the screenshot grading pass when a
 * final PNG lands. scripts/fixtures/hooks.fixtures.ts already proves those
 * commands behave correctly — what was never enforced is that a generated
 * business repo actually *has* them. Until this script existed, installation
 * was one prose line ("Copy this file to .claude/settings.json") inside a JSON
 * comment, which is the honor system, not a contract.
 *
 * Merge semantics: entries this skill owns carry `_managed` and are replaced
 * wholesale on every run, so re-running after a skill upgrade refreshes stale
 * commands. Everything else in the target settings.json — the founder's own
 * hooks, permissions, env — is preserved untouched.
 *
 * The template's top-level `_comment_setup` block is deliberately NOT copied:
 * it is install instructions for a human doing this by hand, and this script
 * is what replaces them.
 *
 * npm script: install:hooks
 * Usage: tsx scripts/install-hooks.ts --target /path/to/business-repo [--skill-root /path/to/skill]
 *                                     [--dry-run] [--write-skill-root]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expandHome, flagBoolean, flagString, parseFlags } from "./lib/launch-state.js";
import { isManagedEntry, readHookTemplate, type HookEntry, type HookSettings } from "./lib/hook-contract.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "..");

interface Args {
  target?: string;
  skillRoot: string;
  dryRun: boolean;
  writeSkillRoot: boolean;
}

function parseArgs(argv: string[]): Args {
  const flags = parseFlags(argv, [
    { flags: ["--target", "--root"], key: "target" },
    { flags: ["--skill-root"], key: "skillRoot" },
    { flags: ["--dry-run"], key: "dryRun", kind: "boolean" },
    { flags: ["--write-skill-root"], key: "writeSkillRoot", kind: "boolean" },
  ]);
  const target = flagString(flags, "target");
  return {
    target: target ? path.resolve(expandHome(target)) : undefined,
    skillRoot: path.resolve(expandHome(flagString(flags, "skillRoot") ?? defaultSkillRoot)),
    dryRun: flagBoolean(flags, "dryRun"),
    writeSkillRoot: flagBoolean(flags, "writeSkillRoot"),
  };
}

function fail(message: string): never {
  console.error(`install-hooks: ${message}`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));

if (!args.target) {
  fail("--target <business-repo> is required. Point it at the repo that should receive the hooks.");
}
if (!existsSync(args.target)) {
  fail(`--target ${args.target} does not exist.`);
}

const template = readHookTemplate(args.skillRoot);
if (template.error) {
  fail(template.error);
}
const managedEntries = template.entries;

const settingsDir = path.join(args.target, ".claude");
const settingsPath = path.join(settingsDir, "settings.json");

let settings: HookSettings = {};
if (existsSync(settingsPath)) {
  try {
    const parsed: unknown = JSON.parse(readFileSync(settingsPath, "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      fail(`${settingsPath} is not a JSON object. Fix or move it before installing hooks.`);
    }
    settings = parsed as HookSettings;
  } catch (error) {
    fail(`${settingsPath} is not valid JSON (${(error as Error).message}). Fix or move it before installing hooks.`);
  }
}

const hooks = (settings.hooks ??= {});
const existing = Array.isArray(hooks.PostToolUse) ? hooks.PostToolUse : [];
// Foreign entries keep their relative order; ours are appended fresh so an
// upgraded skill always ships the current command text.
const foreign = existing.filter((entry: HookEntry) => !isManagedEntry(entry));
const replaced = existing.length - foreign.length;
hooks.PostToolUse = [...foreign, ...managedEntries];

if (args.writeSkillRoot) {
  const env = (settings.env ??= {});
  env.SKILL_ROOT = args.skillRoot;
}

const serialized = `${JSON.stringify(settings, null, 2)}\n`;

if (args.dryRun) {
  console.log(`install-hooks: DRY RUN — would write ${settingsPath}`);
  console.log(`  ${managedEntries.length} managed hook entries (${replaced} existing replaced, ${foreign.length} foreign preserved)`);
  console.log(serialized);
} else {
  mkdirSync(settingsDir, { recursive: true });
  writeFileSync(settingsPath, serialized);
  console.log(`install-hooks: wrote ${settingsPath}`);
  console.log(`  ${managedEntries.length} managed hook entries installed (${replaced} replaced, ${foreign.length} foreign preserved)`);
}

// The two documented ways these hooks silently no-op. Surfacing them here is
// the point: a hook that exits 0 because jq is missing looks identical to a
// hook that passed.
const jqPresent = spawnSync("sh", ["-c", "command -v jq"], { encoding: "utf8" }).status === 0;
if (!jqPresent) {
  console.warn("install-hooks: WARNING — jq is not on PATH. Every hook will warn and exit 0 (inactive) until you install it: brew install jq");
}
if (!args.writeSkillRoot && !process.env.SKILL_ROOT) {
  console.warn(
    `install-hooks: WARNING — SKILL_ROOT is not set. Validator hooks cannot resolve the installed skill and will be inactive.\n` +
      `  Either export it:            export SKILL_ROOT=${args.skillRoot}\n` +
      `  or re-run with:              --write-skill-root  (records it in ${path.join(".claude", "settings.json")})`,
  );
}

console.log(`install-hooks: verify with  npm run --prefix ${args.skillRoot} check:hooks-installed -- --root ${args.target} --skill-root ${args.skillRoot}`);
