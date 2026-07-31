#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flagString, issue, isRecord, parseFlags, reportAndExit, type Issue } from "../scripts/lib/launch-state.js";

interface VersionManifest {
  skill: string;
  version: string;
  updatedAt?: string;
  sourcePath?: string;
  releaseNotes?: string[];
}

interface VersionArgs {
  source: string;
  installed: string;
  remoteUrl?: string;
  sourceExplicit: boolean;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDir, "..");
const args = parseArgs(process.argv.slice(2));
const issues: Issue[] = [];

const installed = loadManifest(args.installed, "installed");
const latest = args.remoteUrl ? loadRemoteManifest(args.remoteUrl) : loadManifest(args.source, "latest");
issues.push(...installed.issues, ...latest.issues);

if (!args.remoteUrl && samePath(args.source, args.installed) && !args.sourceExplicit) {
  issues.push(
    issue(
      "warning",
      "skill_version.source_unresolved",
      [
        "No explicit --source or --remote-url was provided, and the latest source resolved to the installed runtime itself.",
        "This only proves the runtime can read its own manifest; pass --source /path/to/source/skill or --remote-url before substantial launch/design/store/revenue/build work.",
      ].join(" "),
      path.relative(process.cwd(), path.join(args.installed, "skill-version.json")),
    ),
  );
}

if (installed.manifest && latest.manifest) {
  if (installed.manifest.skill !== latest.manifest.skill) {
    issues.push(
      issue(
        "error",
        "skill_version.skill_mismatch",
        `Installed skill ${installed.manifest.skill} does not match latest skill ${latest.manifest.skill}.`,
        "skill-version.json",
      ),
    );
  } else {
    const comparison = compareSemver(installed.manifest.version, latest.manifest.version);
    if (comparison === undefined) {
      issues.push(
        issue(
          "error",
          "skill_version.invalid_semver",
          `Version strings must be semver-like. Installed: ${installed.manifest.version}; latest: ${latest.manifest.version}.`,
          "skill-version.json",
        ),
      );
    } else if (comparison < 0) {
      issues.push(
        issue(
          "error",
          "skill_version.stale",
          [
            `Installed b2c-mobile-business-launch skill is ${installed.manifest.version}; latest available source is ${latest.manifest.version}.`,
            "Before continuing the original request, use AskUserQuestion when available to ask whether to update the local skill runtime now or continue with the installed version.",
            "If the founder approves, sync the source skill into ~/.codex/skills/b2c-mobile-business-launch, run npm install, run npm run audit, and verify Claude/Agents symlinks.",
          ].join(" "),
          path.relative(process.cwd(), path.join(args.installed, "skill-version.json")),
        ),
      );
    } else if (comparison > 0) {
      issues.push(
        issue(
          "warning",
          "skill_version.installed_newer_than_source",
          `Installed version ${installed.manifest.version} is newer than source version ${latest.manifest.version}. Confirm the source path before syncing over it.`,
          path.relative(process.cwd(), path.join(args.installed, "skill-version.json")),
        ),
      );
    }
  }
}

reportAndExit("Skill version freshness check", issues);

function parseArgs(argv: string[]): VersionArgs {
  const flags = parseFlags(argv, [
    { flags: ["--source", "--latest"], key: "source" },
    { flags: ["--installed", "--runtime"], key: "installed" },
    { flags: ["--remote-url", "--remote"], key: "remoteUrl", kind: "string" },
    { flags: ["--root"], key: "rootFallback" },
  ]);

  const explicitSource = flagString(flags, "source");
  const source = explicitSource ?? (process.env.B2C_SKILL_SOURCE ? path.resolve(process.env.B2C_SKILL_SOURCE) : findDefaultSource());
  let installed = flagString(flags, "installed") ?? (process.env.B2C_SKILL_INSTALLED ? path.resolve(process.env.B2C_SKILL_INSTALLED) : skillRoot);

  // --root only acts as an installed-path fallback when neither --installed
  // nor --runtime appears anywhere on the command line.
  const rootFallback = flagString(flags, "rootFallback");
  if (rootFallback !== undefined && !argv.includes("--installed") && !argv.includes("--runtime")) {
    installed = rootFallback;
  }

  return {
    source,
    installed,
    remoteUrl: flagString(flags, "remoteUrl"),
    sourceExplicit: Boolean(process.env.B2C_SKILL_SOURCE) || explicitSource !== undefined,
  };
}

function findDefaultSource(): string {
  const candidates = [process.env.B2C_SKILL_SOURCE, skillRoot].filter((candidate): candidate is string => Boolean(candidate));
  return candidates.find((candidate) => existsSync(path.join(candidate, "skill-version.json"))) ?? skillRoot;
}

function samePath(left: string, right: string): boolean {
  return normalizePath(left) === normalizePath(right);
}

function normalizePath(value: string): string {
  try {
    return realpathSync(value);
  } catch {
    return path.resolve(value);
  }
}

function loadManifest(root: string, label: "installed" | "latest"): { manifest?: VersionManifest; issues: Issue[] } {
  const manifestPath = path.join(root, "skill-version.json");
  if (!existsSync(manifestPath)) {
    return {
      issues: [
        issue(
          label === "latest" ? "warning" : "error",
          `skill_version.${label}_manifest_missing`,
          `${label} skill-version.json is missing at ${manifestPath}.`,
          manifestPath,
        ),
      ],
    };
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (!isRecord(parsed)) {
      return { issues: [issue("error", `skill_version.${label}_manifest_invalid`, `${label} manifest must be a JSON object.`, manifestPath)] };
    }

    const skill = parsed.skill;
    const version = parsed.version;
    if (typeof skill !== "string" || !skill.trim()) {
      return { issues: [issue("error", `skill_version.${label}_skill_missing`, `${label} manifest must include skill.`, manifestPath)] };
    }
    if (typeof version !== "string" || !version.trim()) {
      return { issues: [issue("error", `skill_version.${label}_version_missing`, `${label} manifest must include version.`, manifestPath)] };
    }

    return {
      manifest: {
        skill,
        version,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
        sourcePath: typeof parsed.sourcePath === "string" ? parsed.sourcePath : undefined,
        releaseNotes: Array.isArray(parsed.releaseNotes) ? parsed.releaseNotes.filter((item): item is string => typeof item === "string") : undefined,
      },
      issues: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { issues: [issue("error", `skill_version.${label}_manifest_parse_error`, `${label} manifest is not valid JSON: ${message}`, manifestPath)] };
  }
}

function loadRemoteManifest(remoteUrl: string): { manifest?: VersionManifest; issues: Issue[] } {
  const result = spawnSync("node", ["-e", remoteFetchScript(), remoteUrl], { encoding: "utf8" });
  if (result.status !== 0) {
    return {
      issues: [
        issue(
          "warning",
          "skill_version.remote_unavailable",
          `Could not fetch remote skill-version.json from ${remoteUrl}: ${(result.stderr || result.stdout).trim()}`,
          remoteUrl,
        ),
      ],
    };
  }
  try {
    const parsed: unknown = JSON.parse(result.stdout);
    if (!isRecord(parsed)) {
      return { issues: [issue("error", "skill_version.remote_manifest_invalid", "Remote skill-version.json must be an object.", remoteUrl)] };
    }
    const skill = parsed.skill;
    const version = parsed.version;
    if (typeof skill !== "string" || typeof version !== "string") {
      return {
        issues: [issue("error", "skill_version.remote_manifest_missing_fields", "Remote skill-version.json must include skill and version.", remoteUrl)],
      };
    }
    return {
      manifest: {
        skill,
        version,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
        sourcePath: typeof parsed.sourcePath === "string" ? parsed.sourcePath : undefined,
        releaseNotes: Array.isArray(parsed.releaseNotes) ? parsed.releaseNotes.filter((item): item is string => typeof item === "string") : undefined,
      },
      issues: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { issues: [issue("error", "skill_version.remote_manifest_parse_error", `Remote manifest is not valid JSON: ${message}`, remoteUrl)] };
  }
}

function remoteFetchScript(): string {
  return `
const https = require("node:https");
const url = process.argv[1];
https.get(url, { headers: { "user-agent": "b2c-mobile-business-launch-skill" } }, (response) => {
  if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
    https.get(response.headers.location, (redirect) => redirect.pipe(process.stdout)).on("error", (error) => { console.error(error.message); process.exit(1); });
    return;
  }
  if (response.statusCode !== 200) {
    console.error("HTTP " + response.statusCode);
    process.exit(1);
    return;
  }
  response.pipe(process.stdout);
}).on("error", (error) => { console.error(error.message); process.exit(1); });
`;
}

function compareSemver(left: string, right: string): number | undefined {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  if (!leftParts || !rightParts) {
    return undefined;
  }
  for (const [leftValue, rightValue] of [
    [leftParts[0], rightParts[0]],
    [leftParts[1], rightParts[1]],
    [leftParts[2], rightParts[2]],
  ] as const) {
    if (leftValue !== rightValue) {
      return leftValue < rightValue ? -1 : 1;
    }
  }
  return 0;
}

function parseSemver(value: string): [number, number, number] | undefined {
  const match = value.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/);
  if (!match) {
    return undefined;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
