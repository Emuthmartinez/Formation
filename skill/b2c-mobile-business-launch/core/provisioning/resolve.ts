import { existsSync, readFileSync } from "node:fs";
import { spawnSync as nodeSpawnSync } from "node:child_process";
import { classifySpawnResult, type SpawnResult } from "../adapters/profile.js";
import { PROVISIONING_MANIFEST, type ProvisioningProvider, type ProvisioningRequirement, type RequirementKind } from "./requirements.js";

/**
 * Resolution: manifest requirement -> present/absent, from real sources, honestly. Two hard
 * rules this file exists to hold the line on (repo lesson: never source a whole .env, never
 * print/log/return a raw credential value):
 *
 *   1. Doppler and .env resolution is PRESENCE ONLY. Every function here returns names (strings
 *      that are themselves not secret) or booleans — never a value read from either source.
 *   2. `external` requirements are never satisfied by a key/config value being present. They
 *      resolve to "unverifiable" unless a live probe (not built here — see tooling/probe-
 *      posthog.ts, tooling/probe-revenuecat.ts for the two that exist) or a recorded founder
 *      confirmation says otherwise.
 */

export type ResolutionStatus = "satisfied" | "missing" | "unverifiable";
export type ResolutionSource = "doppler" | "env-file" | "workspace-config" | "founder-confirmed";

export interface RequirementResolution {
  readonly providerId: string;
  readonly kind: RequirementKind;
  readonly name: string;
  readonly status: ResolutionStatus;
  readonly reason: string;
  readonly source?: ResolutionSource;
}

export interface ProviderResolution {
  readonly providerId: string;
  readonly capability: string;
  readonly requirements: readonly RequirementResolution[];
}

// --- Doppler presence lookup (names only, never values) -----------------------------------------

export type ScopedSpawnFn = (command: string, args: readonly string[], options: { readonly cwd: string }) => SpawnResult;

/** Real spawn, scoped to a cwd (Doppler's own directory-scoped config, e.g. a `doppler setup` binding, lives in the cwd it's invoked from — this is how the "directory-scoped token" resolution path works without this file knowing any token value). */
export const defaultScopedSpawn: ScopedSpawnFn = (command, args, options) => {
  const result = nodeSpawnSync(command, [...args], { cwd: options.cwd, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error };
};

export interface DopplerLookupOptions {
  /** cwd the doppler CLI runs from — a directory-scoped `doppler setup` binding is picked up automatically this way, with no token ever passed through this code. */
  readonly workspaceDir: string;
  /** Explicit override; when omitted, Doppler resolves project/config from its own directory-scoped binding. */
  readonly project?: string;
  readonly config?: string;
  /** Injectable for fixtures; defaults to a real spawnSync. Fixtures must always inject a fake — never invoke a real `doppler` binary from a test. */
  readonly spawn?: ScopedSpawnFn;
}

export interface DopplerLookupResult {
  readonly reachable: boolean;
  /** Secret NAMES only, never values. */
  readonly names: ReadonlySet<string>;
  readonly detail: string;
}

/** `doppler secrets --only-names --json`, scoped by cwd and optional explicit --project/--config. Reads names only — this function has no code path that can return a secret value. */
export function lookupDopplerSecretNames(options: DopplerLookupOptions): DopplerLookupResult {
  const spawn = options.spawn ?? defaultScopedSpawn;
  const args = ["secrets", "--only-names", "--json"];
  if (options.project) args.push("--project", options.project);
  if (options.config) args.push("--config", options.config);

  const result = spawn("doppler", args, { cwd: options.workspaceDir });
  const classified = classifySpawnResult("doppler secrets", result, "ok");
  if (classified.status !== "ok") {
    return { reachable: false, names: new Set(), detail: classified.detail };
  }
  const names = parseDopplerNames(result.stdout);
  return { reachable: true, names, detail: `${names.size} secret name(s) visible` };
}

/** `--only-names --json` is documented as a bare JSON array of name strings; tolerate an object-of-names shape and a plain newline list as defensive fallbacks, but never surface raw stdout beyond the parsed names. */
function parseDopplerNames(stdout: string): ReadonlySet<string> {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) return new Set();
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
    if (parsed && typeof parsed === "object") return new Set(Object.keys(parsed as Record<string, unknown>));
  } catch {
    // fall through to newline parsing below
  }
  return new Set(
    trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
  );
}

// --- .env presence lookup (key names only, file is never sourced) -------------------------------

export interface EnvFileLookupResult {
  readonly found: boolean;
  /** KEY names only; VALUE text is never read into memory beyond the single split needed to discard it. */
  readonly keys: ReadonlySet<string>;
}

const ENV_LINE = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/;

/** Parses KEY=VALUE presence from a plain-text env file without shelling out to source it and without ever returning a value — only the key name survives the parse. */
export function lookupEnvFileKeys(envFilePath: string): EnvFileLookupResult {
  if (!existsSync(envFilePath)) return { found: false, keys: new Set() };
  const raw = readFileSync(envFilePath, "utf8");
  const keys = new Set<string>();
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const match = ENV_LINE.exec(line);
    if (match) keys.add(match[1]!);
  }
  return { found: true, keys };
}

// --- workspace config (non-secret values recorded on the control file) --------------------------

/** Mirrors core/schema/types.ts's ControlFile["provisioning"]; duplicated as a narrow local shape so this module never needs to import the full schema surface for three optional strings. */
export interface ProvisioningConfigLike {
  readonly digestFromAddress?: string;
  readonly dopplerProject?: string;
  readonly dopplerConfig?: string;
}

// --- resolution ------------------------------------------------------------------------------

export interface ResolveSources {
  readonly dopplerNames: ReadonlySet<string>;
  readonly dopplerReachable: boolean;
  readonly dopplerDetail?: string;
  readonly envKeys: ReadonlySet<string>;
  readonly envFileFound: boolean;
  readonly provisioningConfig?: ProvisioningConfigLike;
  /** Sourced from the session brief, if one was supplied to the caller — see provider.resend's "Founder recipient email" requirement, which this repo already wires correctly through brief.founderContact.email rather than through this module. */
  readonly founderContactEmail?: string;
  /** Requirement keys (see requirementKey()) a founder has explicitly confirmed true for an `external` item. Never populated automatically — only a caller that actually recorded a founder's own confirmation should pass entries here. */
  readonly founderConfirmedExternal?: ReadonlySet<string>;
}

/** Stable join key for a single requirement, used by founderConfirmedExternal and the checker registry below. */
export function requirementKey(providerId: string, requirementName: string): string {
  return `${providerId}::${requirementName}`;
}

/** ALL_CAPS_WITH_UNDERSCORE tokens only — deliberately excludes bare acronyms (MX, SPF, DKIM, IARC) and lowercase snake_case (soul_reference_id) so prose config items don't get a false mechanical check. */
const ENV_TOKEN = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;

function extractEnvTokens(name: string): string[] {
  return [...name.matchAll(ENV_TOKEN)].map((match) => match[0]);
}

interface CheckOutcome {
  readonly status: ResolutionStatus;
  readonly reason: string;
  readonly source?: ResolutionSource;
}

type Checker = (sources: ResolveSources) => CheckOutcome;

/** Named checkers for the config items that don't reduce to a plain ALL_CAPS token lookup. Everything else falls through to resolveDefault. */
const CHECKERS: Record<string, Checker> = {
  [requirementKey("provider.doppler", "Doppler project + per-environment config names (local/staging/prod)")]: (sources) =>
    sources.provisioningConfig?.dopplerProject && sources.provisioningConfig?.dopplerConfig
      ? {
          status: "satisfied",
          reason: `workspace config names Doppler project "${sources.provisioningConfig.dopplerProject}" / config "${sources.provisioningConfig.dopplerConfig}"`,
          source: "workspace-config",
        }
      : { status: "missing", reason: "no Doppler project/config binding recorded in this workspace's provisioning config yet" },
  [requirementKey("provider.resend", "Verified sending domain + real from-address per purpose (digest, welcome, support, etc.)")]: (sources) =>
    sources.provisioningConfig?.digestFromAddress
      ? {
          status: "unverifiable",
          reason: `a from-address ("${sources.provisioningConfig.digestFromAddress}") is configured, but whether its domain is actually verified in Resend can't be checked from here — confirm in the Resend dashboard`,
          source: "workspace-config",
        }
      : { status: "missing", reason: "no digest from-address is configured in this workspace's provisioning config yet" },
  [requirementKey("provider.resend", "Founder recipient email for the session digest")]: (sources) =>
    sources.founderContactEmail
      ? { status: "satisfied", reason: "sourced from the session brief's founder contact email", source: "workspace-config" }
      : { status: "unverifiable", reason: "no session brief was supplied to check this against" },
};

function resolveExternal(providerId: string, requirement: ProvisioningRequirement, sources: ResolveSources): CheckOutcome {
  if (sources.founderConfirmedExternal?.has(requirementKey(providerId, requirement.name))) {
    return { status: "satisfied", reason: "founder has explicitly confirmed this", source: "founder-confirmed" };
  }
  return {
    status: "unverifiable",
    reason: "this is a fact about the outside world — only a live probe or your own confirmation can establish it, not a key or config value being present",
  };
}

function resolveSecret(requirement: ProvisioningRequirement, sources: ResolveSources): CheckOutcome {
  if (sources.dopplerNames.has(requirement.name)) return { status: "satisfied", reason: "present in Doppler", source: "doppler" };
  if (sources.envKeys.has(requirement.name)) return { status: "satisfied", reason: "present in the .env file", source: "env-file" };
  if (!sources.dopplerReachable && !sources.envFileFound)
    return { status: "missing", reason: "Doppler wasn't reachable and no .env file was checked — set it in one of the two" };
  if (!sources.dopplerReachable)
    return { status: "missing", reason: `Doppler wasn't reachable (${sources.dopplerDetail ?? "no detail"}) and it isn't in the .env file either` };
  return { status: "missing", reason: "not found in Doppler or the .env file" };
}

/** Config items whose name is (or contains) one or more ALL_CAPS_WITH_UNDERSCORE tokens are checked the same way a secret is — presence in Doppler or .env — since this repo stores non-secret config the same two places it stores secrets. Config items with no such token (pure prose) fall back to "unverifiable": there is no mechanical check for them yet. */
function resolveConfig(requirement: ProvisioningRequirement, sources: ResolveSources): CheckOutcome {
  const tokens = extractEnvTokens(requirement.name);
  if (tokens.length === 0)
    return { status: "unverifiable", reason: "no automated check is wired up for this item yet — verify it directly against the checklist" };

  const present = tokens.filter((token) => sources.dopplerNames.has(token) || sources.envKeys.has(token));
  const missing = tokens.filter((token) => !present.includes(token));
  if (missing.length === 0)
    return { status: "satisfied", reason: `${tokens.join(", ")} all present in Doppler/.env`, source: sources.dopplerNames.size > 0 ? "doppler" : "env-file" };
  return { status: "missing", reason: `still missing: ${missing.join(", ")}` };
}

export function resolveRequirement(providerId: string, requirement: ProvisioningRequirement, sources: ResolveSources): RequirementResolution {
  const checker = CHECKERS[requirementKey(providerId, requirement.name)];
  const outcome = checker
    ? checker(sources)
    : requirement.kind === "secret"
      ? resolveSecret(requirement, sources)
      : requirement.kind === "config"
        ? resolveConfig(requirement, sources)
        : resolveExternal(providerId, requirement, sources);
  return { providerId, kind: requirement.kind, name: requirement.name, status: outcome.status, reason: outcome.reason, source: outcome.source };
}

export function resolveProvider(provider: ProvisioningProvider, sources: ResolveSources): ProviderResolution {
  return {
    providerId: provider.providerId,
    capability: provider.capability,
    requirements: provider.requirements.map((requirement) => resolveRequirement(provider.providerId, requirement, sources)),
  };
}

export function resolveManifest(sources: ResolveSources, manifest: readonly ProvisioningProvider[] = PROVISIONING_MANIFEST): readonly ProviderResolution[] {
  return manifest.map((provider) => resolveProvider(provider, sources));
}
