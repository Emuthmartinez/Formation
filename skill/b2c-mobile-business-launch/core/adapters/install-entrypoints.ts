#!/usr/bin/env node
/**
 * install-entrypoints.ts — writes the v2 entrypoint set (AGENTS.md canonical, CLAUDE.md thin
 * pointer, `.cursor/rules/agents.mdc` addendum) into a target business repo, and removes any v1
 * `_managed` PostToolUse hook entries from that repo's `.claude/settings.json` (KTD8: enforcement
 * moved to the reducer and validators, which run identically everywhere — replacing the
 * Claude-only PostToolUse hook mechanism). Founder-owned settings.json entries, and every other
 * settings.json key, are preserved untouched — this mirrors tooling/install-hooks.ts's own
 * non-destructive merge philosophy, just inverted (removal instead of installation).
 *
 * Reuses tooling/lib/hook-contract.ts's `isManagedEntry` marker/signature convention rather than
 * reimplementing it — the marker is the one thing an install and an uninstall (this script) must
 * never disagree about.
 *
 * DEFAULT IS --dry-run (prints the plan, touches nothing); --apply is required to write. Fixtures
 * use temp target repos and pass --apply against them directly (this script never touches a real
 * system service the way install-schedule.ts does, so exercising --apply in a fixture is safe).
 *
 * Usage:
 *   tsx core/adapters/install-entrypoints.ts --target /path/to/business-repo \
 *       [--skill-root /path/to/skill] [--apply] [--var APP_NAME=Ocho --var BUSINESS_NAME="Ocho Inc"]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expandHome, flagBoolean, flagString, parseFlags } from "../../tooling/lib/launch-state.js";
import { isManagedEntry, type HookEntry, type HookSettings } from "../../tooling/lib/hook-contract.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "..", "..");

export const ENTRYPOINT_TEMPLATE_RELATIVE = path.join("workspace-template", "repo-agent-entrypoints");

export interface EntrypointFile {
  /** Path relative to the template root and, unchanged, relative to the target repo root. */
  readonly relativePath: string;
}

export const ENTRYPOINT_FILES: readonly EntrypointFile[] = [{ relativePath: "AGENTS.md" }, { relativePath: "CLAUDE.md" }, { relativePath: path.join(".cursor", "rules", "agents.mdc") }];

/** `{{KEY}}` -> value. A placeholder with no supplied value is left intact, never silently blanked — matches the v1 template convention (check-agent-entrypoints.ts asserts the shipped template keeps its own {{...}} tokens). */
export function applyTemplateVars(content: string, vars: Readonly<Record<string, string>>): string {
  return content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key: string) => (Object.prototype.hasOwnProperty.call(vars, key) ? vars[key]! : match));
}

export function readEntrypointTemplates(skillRoot: string): Map<string, string> {
  const templateRoot = path.join(skillRoot, ENTRYPOINT_TEMPLATE_RELATIVE);
  const files = new Map<string, string>();
  for (const file of ENTRYPOINT_FILES) {
    const source = path.join(templateRoot, file.relativePath);
    if (!existsSync(source)) throw new Error(`entrypoint template is missing at ${source}.`);
    files.set(file.relativePath, readFileSync(source, "utf8"));
  }
  return files;
}

export interface HookStripResult {
  readonly settings: HookSettings;
  readonly removedCount: number;
  readonly preservedForeignCount: number;
  readonly changed: boolean;
}

/** Pure: removes only `_managed`-marked PostToolUse entries (or their legacy command-text equivalent — see hook-contract.ts), preserving every foreign entry and every other settings.json key untouched. */
export function stripManagedHookEntries(settings: HookSettings): HookStripResult {
  const existing = settings.hooks?.PostToolUse;
  if (!Array.isArray(existing) || existing.length === 0) {
    return { settings, removedCount: 0, preservedForeignCount: 0, changed: false };
  }
  const foreign = existing.filter((entry: HookEntry) => !isManagedEntry(entry));
  const removedCount = existing.length - foreign.length;
  if (removedCount === 0) return { settings, removedCount: 0, preservedForeignCount: foreign.length, changed: false };

  const nextHooks = { ...settings.hooks };
  if (foreign.length > 0) nextHooks.PostToolUse = foreign;
  else delete nextHooks.PostToolUse;
  const nextSettings: HookSettings = { ...settings, hooks: nextHooks };
  return { settings: nextSettings, removedCount, preservedForeignCount: foreign.length, changed: true };
}

function loadSettings(settingsPath: string): HookSettings {
  if (!existsSync(settingsPath)) return {};
  const parsed: unknown = JSON.parse(readFileSync(settingsPath, "utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${settingsPath} is not a JSON object. Fix or move it before installing v2 entrypoints.`);
  }
  return parsed as HookSettings;
}

// --- CLI ---------------------------------------------------------------------------------------

function isMainModule(): boolean {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
}

function fail(message: string): never {
  console.error(`install-entrypoints: ${message}`);
  process.exit(1);
}

function parseVars(argv: string[]): Record<string, string> {
  const vars: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== "--var") continue;
    const raw = argv[index + 1];
    if (!raw) continue;
    const eq = raw.indexOf("=");
    if (eq <= 0) continue;
    vars[raw.slice(0, eq)] = raw.slice(eq + 1);
  }
  return vars;
}

function runMain(): void {
  const argv = process.argv.slice(2);
  const flags = parseFlags(argv, [
    { flags: ["--target", "--root"], key: "target" },
    { flags: ["--skill-root"], key: "skillRoot" },
    { flags: ["--apply"], key: "apply", kind: "boolean" },
  ]);
  const target = flagString(flags, "target") ? path.resolve(expandHome(flagString(flags, "target")!)) : undefined;
  if (!target) fail("--target <business-repo> is required. Point it at the repo that should receive the v2 entrypoints.");
  if (!existsSync(target)) fail(`--target ${target} does not exist.`);
  const skillRoot = path.resolve(expandHome(flagString(flags, "skillRoot") ?? defaultSkillRoot));
  const apply = flagBoolean(flags, "apply");
  const vars = parseVars(argv);

  let templates: Map<string, string>;
  try {
    templates = readEntrypointTemplates(skillRoot);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  const settingsPath = path.join(target, ".claude", "settings.json");
  let settings: HookSettings;
  try {
    settings = loadSettings(settingsPath);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  const stripped = stripManagedHookEntries(settings);

  if (!apply) {
    console.log(`install-entrypoints: DRY RUN — would write ${templates.size} entrypoint file(s) under ${target}:`);
    for (const relativePath of templates.keys()) console.log(`  ${path.join(target, relativePath)}`);
    console.log(
      stripped.changed
        ? `  would remove ${stripped.removedCount} managed hook entr${stripped.removedCount === 1 ? "y" : "ies"} from ${settingsPath} (${stripped.preservedForeignCount} foreign entr${stripped.preservedForeignCount === 1 ? "y" : "ies"} preserved)`
        : `  ${settingsPath}: no managed hook entries to remove (${stripped.preservedForeignCount} foreign entr${stripped.preservedForeignCount === 1 ? "y" : "ies"} untouched)`,
    );
    return;
  }

  for (const [relativePath, content] of templates) {
    const destination = path.join(target, relativePath);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, applyTemplateVars(content, vars));
  }
  if (stripped.changed) {
    writeFileSync(settingsPath, `${JSON.stringify(stripped.settings, null, 2)}\n`);
  }
  console.log(`install-entrypoints: wrote ${templates.size} entrypoint file(s) under ${target}.`);
  console.log(
    stripped.changed
      ? `install-entrypoints: removed ${stripped.removedCount} managed hook entr${stripped.removedCount === 1 ? "y" : "ies"} from ${settingsPath} (${stripped.preservedForeignCount} foreign entr${stripped.preservedForeignCount === 1 ? "y" : "ies"} preserved).`
      : `install-entrypoints: ${settingsPath} had no managed hook entries to remove.`,
  );
}

if (isMainModule()) {
  runMain();
}
