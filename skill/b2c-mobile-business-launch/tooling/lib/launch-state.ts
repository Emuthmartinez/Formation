import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import {
  PHASE_ORIENT_LAST_INDEX as graphOrientLastIndex,
  laneDependencies as graphLaneDependencies,
  phaseOrder as graphPhaseOrder,
  requiredLanes as graphRequiredLanes,
} from "../../catalog/lane-graph.js";

export type Severity = "error" | "warning";

export interface Issue {
  severity: Severity;
  code: string;
  message: string;
  file?: string;
}

export interface CliArgs {
  root: string;
  statePath: string;
  outputPath?: string;
}

export const statusValues = new Set(["done", "partial", "blocked", "not_needed", "deferred", "not_started"]);

/**
 * Phase ordering used for phase-gated coverage checks.
 * A project is "past orient" once it claims a phase at or beyond phase_1.
 * During phase_0, phase_0a, phase_0b, and phase_0c, lanes may be not_started
 * because scaffolding is still happening.  From phase_1 onward every required
 * lane must show at least some intentional state.
 *
 * The ordering mirrors launch-phases.md.  Phases not listed here fall into the
 * "orient" bucket (i.e. no coverage enforcement yet).
 */
export const phaseOrder: string[] = [...graphPhaseOrder];

/** Index in phaseOrder at which the orient/scaffold window ends. */
export const PHASE_ORIENT_LAST_INDEX = graphOrientLastIndex;

/**
 * Returns true when the project is past the orient/scaffold phase window and
 * coverage enforcement for not_started lanes should be active.
 */
export function isPastOrientPhase(phase: string): boolean {
  const idx = phaseOrder.indexOf(phase.toLowerCase().trim());
  // Unknown phase strings are treated conservatively as "past orient" so they
  // do not silently exempt a project from coverage checks.
  if (idx === -1) {
    return true;
  }
  return idx > PHASE_ORIENT_LAST_INDEX;
}

export const autonomyModes = new Set(["scout", "draft", "prepare", "apply", "mutate", "ship"]);

/**
 * Launch tiers scope the artifact burden to the product (launch-phases.md
 * "Launch Tiers"). "full" runs every lane; "lite" defers the named optional
 * lanes with dated reasons through the normal deferral mechanics — the tier
 * never silently disables a validator.
 */
export const launchTiers = new Set(["full", "lite"]);

/**
 * Launch scope, the founder-facing name for the same idea. "Tier" collided with the
 * founder's own app pricing tiers, which is a completely different decision that happened
 * to share a word.
 *
 * Both keys and both value sets stay valid on read. A business repo launched before this
 * rename still has `project.launch_tier: lite` on disk, and silently failing its state
 * file to gain a nicer word would be a bad trade. New state files use
 * `project.launch_scope` with "full" or "essentials"; readers go through
 * resolveLaunchScope.
 */
export const launchScopes = new Set(["full", "essentials"]);

/** Legacy value → current value, so "lite" keeps working wherever it is already written. */
export const launchScopeAliases: Record<string, string> = { lite: "essentials" };

/** Every accepted spelling, for validation messages and error text. */
export const acceptedLaunchScopeValues = [...launchScopes, ...Object.keys(launchScopeAliases)];

/**
 * Reads the launch scope from either key and normalizes legacy values. Returns undefined
 * when neither key is present, which is a valid state (the scope is confirmed at orient).
 */
export function resolveLaunchScope(scopeValue: string | undefined, tierValue: string | undefined): { raw: string; normalized: string } | undefined {
  const raw = scopeValue ?? tierValue;
  if (raw === undefined) return undefined;
  return { raw, normalized: launchScopeAliases[raw] ?? raw };
}

export const requiredLanes: string[] = [...graphRequiredLanes];

/**
 * Lane dependency edges — the machine-readable form of "Lock phase outputs
 * before depending on them" (SKILL.md, Operating Posture) and the Flow Gates in
 * knowledge/process/flow-traceability.md.
 *
 * Each entry lists a lane's DIRECT upstream lanes only; transitive edges are
 * implied (design -> product -> experience -> research, so design does not
 * relist research). Every edge here already existed as prose in a reference or
 * a lane row — this map mechanizes them, it does not invent new sequencing.
 *
 * This map ships with the skill rather than living in state/PROJECT_STATE.yaml on
 * purpose: an edge set a launch run can edit is an edge set a launch run can
 * delete. The auditable escape hatch is the per-lane `dependency_override`
 * dated reason, not silent removal.
 *
 * Edges are enforced only against a lane claiming `done` (see
 * check-lane-coverage.ts). Working a lane ahead of its upstream is fine and
 * common; declaring it finished on an unlocked upstream is the drift bug.
 */
export const laneDependencies: Record<string, string[]> = Object.fromEntries(
  Object.entries(graphLaneDependencies).map(([lane, dependencies]) => [lane, [...dependencies]]),
);

/**
 * Upstream statuses that satisfy a dependency. `not_needed` and `deferred` are
 * legitimate resolved scope decisions (see launch tiers), so they unblock a
 * downstream lane; `not_started`, `partial`, and `blocked` do not.
 */
export const satisfiedDependencyStatuses = new Set(["done", "not_needed", "deferred"]);

/**
 * Authoring-integrity check for the shipped edge map itself: unknown lane ids,
 * self-edges, and cycles are maintainer bugs, not project state problems. A
 * cycle would make every lane in it permanently undeclarable, so it is worth
 * catching mechanically rather than by review.
 */
export function validateLaneDependencyGraph(issues: Issue[]): void {
  const known = new Set(requiredLanes);

  for (const [lane, deps] of Object.entries(laneDependencies)) {
    if (!known.has(lane)) {
      issues.push(
        issue(
          "error",
          `lane_dependencies.${lane}.unknown_lane`,
          `laneDependencies declares edges for "${lane}", which is not in requiredLanes.`,
          "tooling/lib/launch-state.ts",
        ),
      );
    }
    for (const dep of deps) {
      if (dep === lane) {
        issues.push(issue("error", `lane_dependencies.${lane}.self_edge`, `laneDependencies["${lane}"] depends on itself.`, "tooling/lib/launch-state.ts"));
      } else if (!known.has(dep)) {
        issues.push(
          issue(
            "error",
            `lane_dependencies.${lane}.unknown_dependency`,
            `laneDependencies["${lane}"] names "${dep}", which is not a required lane.`,
            "tooling/lib/launch-state.ts",
          ),
        );
      }
    }
  }

  // DFS with a colour map: unvisited / grey (on the current path) / black (settled).
  // The graph is ~22 nodes, so recursion depth is a non-issue.
  const colours = new Map<string, "grey" | "black">();
  const activePath: string[] = [];

  const walk = (lane: string): void => {
    colours.set(lane, "grey");
    activePath.push(lane);
    for (const dep of laneDependencies[lane] ?? []) {
      const colour = colours.get(dep);
      if (colour === "grey") {
        const from = activePath.indexOf(dep);
        const cycle = [...activePath.slice(from < 0 ? 0 : from), dep].join(" -> ");
        issues.push(
          issue(
            "error",
            "lane_dependencies.cycle",
            `laneDependencies contains a cycle: ${cycle}. A cycle makes every lane in it permanently undeclarable.`,
            "tooling/lib/launch-state.ts",
          ),
        );
        continue;
      }
      if (colour === undefined) walk(dep);
    }
    activePath.pop();
    colours.set(lane, "black");
  };

  for (const lane of Object.keys(laneDependencies)) {
    if (!colours.has(lane)) walk(lane);
  }
}

const ignoredDirs = new Set([".git", "node_modules", ".next", "dist", "build", "DerivedData", ".expo", ".turbo", "coverage"]);

export function parseCliArgs(argv: string[]): CliArgs {
  // The durable engine's runDeterministicGates() (core/session/run.ts) invokes every gate via
  // `npm run --prefix <skillRoot> <gate>`, which npm executes with the skill package as the
  // process's cwd regardless of the caller's actual working directory -- so process.cwd() alone
  // can never resolve to the business workspace under engine execution. The engine sets
  // BUSINESS_ROOT precisely so a gate can recover the real target; honor it here, before an
  // explicit --root flag (checked below) can still override it for direct CLI invocations.
  let root = process.env.BUSINESS_ROOT ? path.resolve(process.env.BUSINESS_ROOT) : process.cwd();
  let statePath = "state/PROJECT_STATE.yaml";
  let outputPath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (token === "--root" && value) {
      root = path.resolve(value);
      index += 1;
    } else if (token === "--state" && value) {
      statePath = value;
      index += 1;
    } else if ((token === "--out" || token === "--output") && value) {
      outputPath = value;
      index += 1;
    }
  }

  return {
    root,
    statePath: path.isAbsolute(statePath) ? statePath : path.join(root, statePath),
    outputPath: outputPath ? (path.isAbsolute(outputPath) ? outputPath : path.join(root, outputPath)) : undefined,
  };
}

export function issue(severity: Severity, code: string, message: string, file?: string): Issue {
  return { severity, code, message, file };
}

/** Expands a leading `~`/`~/` to $HOME, mirroring shell behavior for CLI path flags. */
export function expandHome(value: string): string {
  if (value === "~") {
    return process.env.HOME ?? value;
  }
  if (value.startsWith("~/")) {
    return path.join(process.env.HOME ?? "", value.slice(2));
  }
  return value;
}

export type FlagValue = string | number | boolean;

export interface FlagSpec {
  /** Flag aliases that set this key, e.g. ["--skill-root", "--root"]. */
  flags: string[];
  /** Key in the returned record. */
  key: string;
  /**
   * - "path" (default): consumes a value, expands `~`, resolves to an absolute path.
   * - "string": consumes a raw value.
   * - "number": consumes a value via Number().
   * - "boolean": consumes no value; presence sets true.
   */
  kind?: "path" | "string" | "number" | "boolean";
  /** When true, a matched flag without a value throws instead of being skipped. */
  strict?: boolean;
}

/**
 * Shared token/value CLI flag parser used by the validator scripts.
 * Last occurrence wins; unknown tokens are ignored (callers pass positional
 * arguments through their own handling when needed).
 */
export function parseFlags(argv: string[], specs: FlagSpec[]): Partial<Record<string, FlagValue>> {
  const byFlag = new Map<string, FlagSpec>();
  for (const spec of specs) {
    for (const flag of spec.flags) {
      byFlag.set(flag, spec);
    }
  }

  const out: Partial<Record<string, FlagValue>> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      continue;
    }
    const spec = byFlag.get(token);
    if (!spec) {
      continue;
    }
    if (spec.kind === "boolean") {
      out[spec.key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value === "") {
      if (spec.strict) {
        throw new Error(`${token} requires a value`);
      }
      continue;
    }
    index += 1;
    if (spec.kind === "number") {
      out[spec.key] = Number(value);
    } else if (spec.kind === "string") {
      out[spec.key] = value;
    } else {
      out[spec.key] = path.resolve(expandHome(value));
    }
  }
  return out;
}

export function flagString(flags: Partial<Record<string, FlagValue>>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

export function flagNumber(flags: Partial<Record<string, FlagValue>>, key: string): number | undefined {
  const value = flags[key];
  return typeof value === "number" ? value : undefined;
}

export function flagBoolean(flags: Partial<Record<string, FlagValue>>, key: string): boolean {
  return flags[key] === true;
}

/** Case-insensitive substring check shared by phrase-gated validators. */
export function normalizedIncludes(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/** Stable issue-code suffix for a missing phrase, shared by phrase-gated validators. */
export function missingPhraseCode(prefix: string, phrase: string): string {
  return `${prefix}.${phrase
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}.missing`;
}

/** Trimmed non-empty strings from an unknown array value. */
export function normalizedStringArray(value: unknown): string[] {
  return asArray(value)
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item?.trim()))
    .map((item) => item.trim());
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function getPath(value: unknown, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((current, segment) => {
    if (!isRecord(current)) {
      return undefined;
    }
    return current[segment];
  }, value);
}

export function readText(root: string, relativePath: string): string | undefined {
  const filePath = path.join(root, relativePath);
  if (!existsSync(filePath)) {
    return undefined;
  }
  return readFileSync(filePath, "utf8");
}

export function loadProjectState(args: CliArgs): { state?: unknown; raw?: string; issues: Issue[] } {
  if (!existsSync(args.statePath)) {
    return {
      issues: [
        issue(
          "error",
          "project_state.missing",
          "state/PROJECT_STATE.yaml is missing. Copy workspace/business/state/PROJECT_STATE.yaml and update it before claiming launch readiness.",
          path.relative(args.root, args.statePath),
        ),
      ],
    };
  }

  const raw = readFileSync(args.statePath, "utf8");
  try {
    return { state: parseYaml(raw), raw, issues: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      raw,
      issues: [
        issue("error", "project_state.invalid_yaml", `state/PROJECT_STATE.yaml is not valid YAML: ${message}`, path.relative(args.root, args.statePath)),
      ],
    };
  }
}

/**
 * v1 lane status vocabulary (state/PROJECT_STATE.yaml), mirrored by hand from core/schema/
 * types.ts's V1LaneStatus/v1LaneStatusToStatus -- validation/business/* stays on the v1-only side
 * of the v1/v2 migration and does not import from core/, so this is a standalone copy, not a
 * shared import. core/schema/migrate-v1.ts's migrateLaneStatus() guarantees a v2 lane's status is
 * always exactly one of this map's six keys, so the inverse here is total for this one field.
 */
const v1LaneStatusFromCanonicalStatus: Readonly<Record<string, string>> = {
  pending: "not_started",
  running: "partial",
  blocked: "blocked",
  not_needed: "not_needed",
  deferred: "deferred",
  succeeded: "done",
};

/**
 * A durable-engine-managed workspace's canonical state lives at state/business-state.json (v2) --
 * core/session/run.ts's resolveWorkspacePaths() treats it as canonical, and a v2 workspace may
 * have no state/PROJECT_STATE.yaml at all, so loadProjectState() alone would report the lane
 * permanently missing under real engine execution. This bridges exactly one lane's status/
 * blockers/reason, not the whole v1 document: v2's other sections (project, narrative, autonomy,
 * continuity, control-plane) live across multiple v2 files with no verified 1:1 v1 shape, and a
 * wrong silent mapping there would be worse than the current clear "state is missing" error, so
 * this stays scoped to the one field a lane-status gate actually needs. Returns undefined if
 * state/business-state.json is absent, unreadable, or has no status recorded for this lane.
 */
export function loadLaneFromBusinessStateV2(root: string, lane: string): { status: string; blockers: string[]; reason?: string } | undefined {
  const v2Path = path.join(root, "state", "business-state.json");
  if (!existsSync(v2Path)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(v2Path, "utf8"));
  } catch {
    return undefined;
  }
  const laneState = getPath(parsed, `lanes.${lane}`);
  const canonicalStatus = asString(getPath(laneState, "status"));
  if (!canonicalStatus) return undefined;
  return {
    status: v1LaneStatusFromCanonicalStatus[canonicalStatus] ?? canonicalStatus,
    blockers: asArray(getPath(laneState, "blockers")).filter((entry): entry is string => typeof entry === "string"),
    reason: asString(getPath(laneState, "reason")),
  };
}

export function requireString(state: unknown, dottedPath: string, issues: Issue[]): void {
  const value = getPath(state, dottedPath);
  if (!asString(value)?.trim()) {
    issues.push(issue("error", `${dottedPath}.missing`, `${dottedPath} must be a non-empty string.`, "state/PROJECT_STATE.yaml"));
  }
}

export function requireStatus(state: unknown, dottedPath: string, issues: Issue[]): void {
  const value = asString(getPath(state, dottedPath));
  if (!value || !statusValues.has(value)) {
    issues.push(
      issue("error", `${dottedPath}.invalid_status`, `${dottedPath} must be one of ${Array.from(statusValues).join(", ")}.`, "state/PROJECT_STATE.yaml"),
    );
  }
}

export function requireBoolean(state: unknown, dottedPath: string, issues: Issue[]): void {
  if (asBoolean(getPath(state, dottedPath)) === undefined) {
    issues.push(issue("error", `${dottedPath}.missing_boolean`, `${dottedPath} must be true or false.`, "state/PROJECT_STATE.yaml"));
  }
}

export function collectFiles(root: string, extensions: Set<string>, maxFiles = 5000): string[] {
  const files: string[] = [];

  function visit(directory: string): void {
    if (files.length >= maxFiles) {
      return;
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (ignoredDirs.has(entry.name)) {
        continue;
      }
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  if (existsSync(root) && statSync(root).isDirectory()) {
    visit(root);
  }

  return files;
}

export function collectAllFiles(root: string, maxFiles = 10000): string[] {
  const files: string[] = [];

  function visit(directory: string): void {
    if (files.length >= maxFiles) {
      return;
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (ignoredDirs.has(entry.name)) {
        continue;
      }
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  if (existsSync(root) && statSync(root).isDirectory()) {
    visit(root);
  }

  return files;
}

export function findText(
  root: string,
  needles: string[],
  extensions = new Set([".md", ".ts", ".tsx", ".js", ".jsx", ".swift", ".kt", ".java", ".dart", ".yaml", ".yml", ".html"]),
): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of collectFiles(root, extensions)) {
    const text = readFileSync(file, "utf8");
    for (const needle of needles) {
      if (text.includes(needle)) {
        const relative = path.relative(root, file);
        const matches = found.get(needle) ?? [];
        matches.push(relative);
        found.set(needle, matches);
      }
    }
  }
  return found;
}

export function reportAndExit(title: string, issues: Issue[]): void {
  const errors = issues.filter((item) => item.severity === "error");
  const warnings = issues.filter((item) => item.severity === "warning");

  console.log(title);
  console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);

  for (const item of issues) {
    const where = item.file ? ` [${item.file}]` : "";
    console.log(`- ${item.severity.toUpperCase()} ${item.code}${where}: ${item.message}`);
  }

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

export function writeText(filePath: string, contents: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents, "utf8");
}

// ---------------------------------------------------------------------------
// Tier-1 anti-gaming helpers
// ---------------------------------------------------------------------------

/**
 * Minimum byte length for a reason/rationale string to be considered non-trivial.
 * A bare one-word reason like "skip" or "later" or "N/A" is insufficient signal.
 */
export const REASON_MIN_LENGTH = 20;

/**
 * Maximum age in days for a stall/skip reason date before it is flagged stale.
 * A reason dated more than STALL_STALE_DAYS before today means the stall has
 * been sitting untouched for at least that long.
 */
export const STALL_STALE_DAYS = 60;

/**
 * Returns the first ISO YYYY-MM-DD date string found inside `text`, or
 * undefined if none is present.
 *
 * Matches the plain date form (2024-01-15) and the datetime prefix form
 * (2024-01-15T...).  Only the YYYY-MM-DD portion is returned.
 */
export function extractIsoDate(text: string): string | undefined {
  const match = /\b(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\b/.exec(text);
  return match?.[1];
}

/**
 * Returns true when `text` contains a parseable ISO date AND the text's length
 * meets the non-trivial threshold.
 *
 * This guards against trivially gaming the date check with an appended "2099-01-01"
 * on a one-word reason.
 */
export function hasIsoDate(text: string): boolean {
  return extractIsoDate(text) !== undefined;
}

/**
 * Returns true when `text` meets the minimum non-trivial length threshold.
 */
export function isReasonSubstantive(text: string): boolean {
  return text.trim().length >= REASON_MIN_LENGTH;
}

/**
 * Returns true if the ISO date found inside `text` is more than STALL_STALE_DAYS
 * before the supplied `asOf` date (defaults to today).
 *
 * Returns false when no date is found (caller decides how to handle that
 * separately via hasIsoDate).
 */
export function isReasonStale(text: string, asOf: Date = new Date()): boolean {
  const dateStr = extractIsoDate(text);
  if (!dateStr) {
    return false;
  }
  const reasonDate = new Date(dateStr + "T00:00:00Z");
  const msPerDay = 1000 * 60 * 60 * 24;
  const ageInDays = (asOf.getTime() - reasonDate.getTime()) / msPerDay;
  return ageInDays > STALL_STALE_DAYS;
}

/**
 * Validate a reason/rationale string and push appropriate issues.
 *
 * - If the string is missing or below the trivial threshold → WARN reason_undated_or_trivial
 * - If the string passes the length check but has no ISO date → WARN reason_undated_or_trivial
 * - If the string has a parseable date that is more than STALL_STALE_DAYS old → WARN stall_reason_stale
 *
 * @param reason   The reason/rationale string to validate (may be undefined).
 * @param lanePath Dotted lane path for issue code prefixes (e.g. "lanes.revenue").
 * @param context  A short phrase for the human-readable message (e.g. "partial stall" or "deferred").
 * @param issues   Mutable array to push warnings into.
 */
export function validateReason(reason: string | undefined, lanePath: string, context: string, issues: Issue[]): void {
  if (!reason || !isReasonSubstantive(reason)) {
    issues.push(
      issue(
        "warning",
        `${lanePath}.reason_undated_or_trivial`,
        `${lanePath} ${context} reason is missing, too short (< ${REASON_MIN_LENGTH} chars), or lacks an ISO date (YYYY-MM-DD). ` +
          `Record a dated rationale so future passes can verify the stall is intentional and not stale.`,
        "state/PROJECT_STATE.yaml",
      ),
    );
    return;
  }
  if (!hasIsoDate(reason)) {
    issues.push(
      issue(
        "warning",
        `${lanePath}.reason_undated_or_trivial`,
        `${lanePath} ${context} reason does not contain an ISO date (YYYY-MM-DD). ` +
          `Add the date the stall/skip was recorded so a future pass can detect if it has gone stale.`,
        "state/PROJECT_STATE.yaml",
      ),
    );
    return;
  }
  if (isReasonStale(reason)) {
    issues.push(
      issue(
        "warning",
        `${lanePath}.stall_reason_stale`,
        `${lanePath} ${context} reason is dated more than ${STALL_STALE_DAYS} days ago. ` + `Revisit and update the rationale or advance the lane status.`,
        "state/PROJECT_STATE.yaml",
      ),
    );
  }
}
