#!/usr/bin/env node
/**
 * install-entrypoints.ts — writes the v2 entrypoint set (AGENTS.md canonical, CLAUDE.md thin
 * pointer, Cursor addendum, APP_AGENTS.md, and the role roster) into a target business repo, and removes any v1
 * `_managed` PostToolUse hook entries from that repo's `.claude/settings.json` (KTD8: enforcement
 * moved to the reducer and validators, which run identically everywhere — replacing the
 * Claude-only PostToolUse hook mechanism). Founder-owned settings.json entries, and every other
 * settings.json key, are preserved untouched — this mirrors tooling/install-hooks.ts's own
 * non-destructive merge philosophy, just inverted (removal instead of installation).
 *
 * Carries the v1 `isManagedEntry` marker/signature convention forward (ported from the deleted
 * tooling/lib/hook-contract.ts at cutover, U11 — KTD8/R19 delete the Claude-only PostToolUse hook
 * enforcement mechanism itself, but the marker check this file needs to recognize and strip a
 * v1-installed entry survives here, its only remaining consumer) — the marker is the one thing an
 * install and an uninstall (this script) must never disagree about.
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
import { fileURLToPath } from "node:url";
import { toCatalogInput } from "../../catalog/bridge.js";
import { composeCatalog } from "../../catalog/index.js";
import { expandHome, flagBoolean, flagString, parseFlags } from "../../tooling/lib/launch-state.js";
import { isMainModule } from "../lib/cli.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "..", "..");

/** Marked a v1 PostToolUse entry as owned by this skill (tooling/lib/hook-contract.ts, deleted at cutover). */
const MANAGED_MARKER = "b2c-mobile-business-launch";
const RUNTIME_DIR = ".b2c-launch";
const BUSINESS_CONTEXT_PATH = path.join(RUNTIME_DIR, "BUSINESS_CONTEXT.md");
const RUNTIME_MANIFEST_PATH = path.join(RUNTIME_DIR, "runtime.json");
const RUNTIME_CATALOG_PATH = "catalog.json";

export interface HookCommand {
  type?: string;
  command?: string;
  timeout?: number;
  statusMessage?: string;
}

export interface HookEntry {
  _managed?: string;
  _comment?: string;
  matcher?: string;
  hooks?: HookCommand[];
}

export interface HookSettings {
  env?: Record<string, string>;
  hooks?: { PostToolUse?: HookEntry[]; [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * An entry belongs to this skill when it carries the marker, or — for repos installed before the
 * marker existed — when its command text names the skill. The legacy path matters: without it, a
 * v1-installed repo's hook entries would silently survive the v2 entrypoint install instead of
 * being stripped.
 */
function isManagedEntry(entry: HookEntry): boolean {
  if (entry?._managed === MANAGED_MARKER) {
    return true;
  }
  return (entry?.hooks ?? []).some((hook) => typeof hook?.command === "string" && hook.command.includes(MANAGED_MARKER));
}

export const ENTRYPOINT_TEMPLATE_RELATIVE = path.join("workspace-template", "repo-agent-entrypoints");

export interface EntrypointFile {
  /** Destination path relative to the target repo root. */
  readonly relativePath: string;
  /** Authored source path relative to the skill root. */
  readonly sourceRelativePath: string;
}

const entrypointTemplate = (relativePath: string): EntrypointFile => ({
  relativePath,
  sourceRelativePath: path.join(ENTRYPOINT_TEMPLATE_RELATIVE, relativePath),
});

const rosterTemplate = (relativePath: string): EntrypointFile => ({
  relativePath,
  sourceRelativePath: path.join("workspace", "business", "engineering", "app-agent-roster", relativePath),
});

const ROSTER_PROMPTS = [
  "accessibility-device-qa.md",
  "backend-infrastructure-engineer.md",
  "copy-specialist.md",
  "customer-success.md",
  "design-guru.md",
  "engineering-leader.md",
  "launch-surface-producer.md",
  "marketing-guru.md",
  "mobile-engineer.md",
  "operator-readiness.md",
  "orchestrator.md",
  "product-leader.md",
  "research-strategist.md",
  "security-architect.md",
] as const;

export const ENTRYPOINT_FILES: readonly EntrypointFile[] = [
  entrypointTemplate("AGENTS.md"),
  entrypointTemplate("CLAUDE.md"),
  entrypointTemplate(path.join(".cursor", "rules", "agents.mdc")),
  rosterTemplate("APP_AGENTS.md"),
  ...ROSTER_PROMPTS.map((name) => rosterTemplate(path.join("agents", name))),
];

/** `{{KEY}}` -> value. A placeholder with no supplied value is left intact, never silently blanked — matches the v1 template convention (check-agent-entrypoints.ts asserts the shipped template keeps its own {{...}} tokens). */
export function applyTemplateVars(content: string, vars: Readonly<Record<string, string>>): string {
  return content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key: string) => (Object.prototype.hasOwnProperty.call(vars, key) ? vars[key]! : match));
}

export function readEntrypointTemplates(skillRoot: string): Map<string, string> {
  const files = new Map<string, string>();
  for (const file of ENTRYPOINT_FILES) {
    const source = path.join(skillRoot, file.sourceRelativePath);
    if (!existsSync(source)) throw new Error(`entrypoint template is missing at ${source}.`);
    files.set(file.relativePath, readFileSync(source, "utf8"));
  }
  return files;
}

export interface InstalledRuntimeManifest {
  schemaVersion: "1.0.0";
  skill: "b2c-mobile-business-launch";
  skillVersion: string;
  skillRoot: string;
  skillRootEnv: "B2C_LAUNCH_SKILL_ROOT";
  installedSkillName: "b2c-mobile-business-launch";
  catalogVersion: string;
  catalogPath: string;
  knowledgeRoot: string;
}

/** Durable binding from a generated business repo to the exact skill knowledge and catalog used. */
export function buildInstalledRuntimeManifest(skillRoot: string): InstalledRuntimeManifest {
  const catalog = composeCatalog(skillRoot);
  return {
    schemaVersion: "1.0.0",
    skill: MANAGED_MARKER,
    skillVersion: catalog.skillVersion,
    skillRoot: path.resolve(skillRoot),
    skillRootEnv: "B2C_LAUNCH_SKILL_ROOT",
    installedSkillName: MANAGED_MARKER,
    catalogVersion: toCatalogInput(catalog).version,
    catalogPath: RUNTIME_CATALOG_PATH,
    knowledgeRoot: path.join(path.resolve(skillRoot), "knowledge"),
  };
}

function preserveBeforeManagedRewrite(target: string, relativePath: string, nextContent: string): string | undefined {
  const destination = path.join(target, relativePath);
  if (!existsSync(destination)) return undefined;
  const current = readFileSync(destination, "utf8");
  if (current === nextContent) return undefined;
  const preservedPath = path.join(target, RUNTIME_DIR, "preserved-entrypoints", relativePath);
  mkdirSync(path.dirname(preservedPath), { recursive: true });
  writeFileSync(preservedPath, current);
  return path.relative(target, preservedPath).split(path.sep).join("/");
}

function ensureBusinessContext(target: string, vars: Readonly<Record<string, string>>): void {
  const destination = path.join(target, BUSINESS_CONTEXT_PATH);
  if (existsSync(destination)) return;
  mkdirSync(path.dirname(destination), { recursive: true });
  const appName = vars.APP_NAME ?? "this app";
  writeFileSync(
    destination,
    `# ${appName} Business Context\n\nThis founder-owned file survives entrypoint refreshes. Record business-specific stack, providers, locales, approved pricing, deploy targets, store teams, voice constraints, and role-specific exceptions here. Do not put secrets in this file.\n`,
  );
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
    console.log(
      `install-entrypoints: DRY RUN — would write ${templates.size} managed entrypoint file(s), a versioned catalog, and a runtime binding under ${target}:`,
    );
    for (const relativePath of templates.keys()) console.log(`  ${path.join(target, relativePath)}`);
    console.log(
      stripped.changed
        ? `  would remove ${stripped.removedCount} managed hook entr${stripped.removedCount === 1 ? "y" : "ies"} from ${settingsPath} (${stripped.preservedForeignCount} foreign entr${stripped.preservedForeignCount === 1 ? "y" : "ies"} preserved)`
        : `  ${settingsPath}: no managed hook entries to remove (${stripped.preservedForeignCount} foreign entr${stripped.preservedForeignCount === 1 ? "y" : "ies"} untouched)`,
    );
    return;
  }

  const preserved: string[] = [];
  for (const [relativePath, content] of templates) {
    const destination = path.join(target, relativePath);
    const rendered = applyTemplateVars(content, vars);
    const preservedPath = preserveBeforeManagedRewrite(target, relativePath, rendered);
    if (preservedPath) preserved.push(preservedPath);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, rendered);
  }
  ensureBusinessContext(target, vars);
  const catalog = composeCatalog(skillRoot);
  const manifest = buildInstalledRuntimeManifest(skillRoot);
  mkdirSync(path.join(target, RUNTIME_DIR), { recursive: true });
  writeFileSync(path.join(target, RUNTIME_CATALOG_PATH), `${JSON.stringify(toCatalogInput(catalog), null, 2)}\n`);
  writeFileSync(path.join(target, RUNTIME_MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`);
  if (stripped.changed) {
    writeFileSync(settingsPath, `${JSON.stringify(stripped.settings, null, 2)}\n`);
  }
  console.log(`install-entrypoints: wrote ${templates.size} entrypoint file(s) under ${target}.`);
  console.log(`install-entrypoints: bound skill ${manifest.skillVersion} at ${manifest.skillRoot} and wrote ${RUNTIME_CATALOG_PATH}.`);
  if (preserved.length > 0) console.log(`install-entrypoints: preserved ${preserved.length} replaced file(s) under ${RUNTIME_DIR}/preserved-entrypoints/.`);
  console.log(
    stripped.changed
      ? `install-entrypoints: removed ${stripped.removedCount} managed hook entr${stripped.removedCount === 1 ? "y" : "ies"} from ${settingsPath} (${stripped.preservedForeignCount} foreign entr${stripped.preservedForeignCount === 1 ? "y" : "ies"} preserved).`
      : `install-entrypoints: ${settingsPath} had no managed hook entries to remove.`,
  );
}

if (isMainModule(import.meta.url)) {
  runMain();
}
