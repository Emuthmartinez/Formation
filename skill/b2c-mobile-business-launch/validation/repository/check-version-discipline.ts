#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { flagString, issue, isRecord, parseFlags, reportAndExit, type Issue } from "../../tooling/lib/launch-state.js";

interface Args {
  repoRoot: string;
  skillRoot: string;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "../..");
const args = parseArgs(process.argv.slice(2));
const issues: Issue[] = [];
const manifestPath = path.join(args.skillRoot, "skill-version.json");

const manifest = loadManifest(manifestPath);
if (manifest) {
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.version)) {
    issues.push(issue("error", "version_discipline.semver_invalid", "skill-version.json version must be semver-like.", manifestPath));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.updatedAt)) {
    issues.push(issue("error", "version_discipline.updated_at_invalid", "skill-version.json updatedAt must be YYYY-MM-DD.", manifestPath));
  }
  if (
    !Array.isArray(manifest.releaseNotes) ||
    manifest.releaseNotes.length < 2 ||
    manifest.releaseNotes.some((note) => typeof note !== "string" || note.trim().length < 12)
  ) {
    issues.push(
      issue(
        "error",
        "version_discipline.release_notes_thin",
        "skill-version.json needs at least two concrete release notes for this skill version.",
        manifestPath,
      ),
    );
  }
}

const gitRoot = findGitRoot(args.repoRoot);
if (gitRoot) {
  const relativeSkillRoot = path.relative(gitRoot, args.skillRoot);
  const relativeManifest = path.relative(gitRoot, manifestPath);
  const changed = new Set(
    [
      ...git(["diff", "--name-only", "--", relativeSkillRoot], gitRoot).stdout.trim().split(/\r?\n/),
      ...git(["diff", "--cached", "--name-only", "--", relativeSkillRoot], gitRoot).stdout.trim().split(/\r?\n/),
    ].filter(Boolean),
  );
  const pendingManifestChanged = changed.has(relativeManifest);
  const latestSkillCommit = git(["log", "-1", "--format=%H", "--", relativeSkillRoot], gitRoot).stdout.trim();
  const latestManifestCommit = git(["log", "-1", "--format=%H", "--", relativeManifest], gitRoot).stdout.trim();

  if (latestSkillCommit && latestManifestCommit && latestSkillCommit !== latestManifestCommit && !pendingManifestChanged) {
    issues.push(
      issue(
        "error",
        "version_discipline.manifest_not_latest",
        "The latest commit touching the skill did not also touch skill-version.json. Bump the version/release notes in the same commit as skill behavior changes.",
        relativeManifest,
      ),
    );
  }

  const meaningfulChanges = Array.from(changed).filter((file) => !file.endsWith("skill-version.json") && !file.includes("/node_modules/"));
  if (meaningfulChanges.length > 0 && !changed.has(relativeManifest)) {
    issues.push(
      issue(
        "error",
        "version_discipline.pending_manifest_update_missing",
        `Pending skill changes require a matching skill-version.json update. Changed examples: ${meaningfulChanges.slice(0, 5).join(", ")}`,
        relativeManifest,
      ),
    );
  }
}

reportAndExit("Skill version discipline check", issues);

function parseArgs(argv: string[]): Args {
  const flags = parseFlags(argv, [
    { flags: ["--repo-root"], key: "repoRoot" },
    { flags: ["--skill-root"], key: "skillRoot" },
  ]);

  return {
    repoRoot: flagString(flags, "repoRoot") ?? process.cwd(),
    skillRoot: flagString(flags, "skillRoot") ?? defaultSkillRoot,
  };
}

function loadManifest(filePath: string): { version: string; updatedAt: string; releaseNotes: unknown } | undefined {
  if (!existsSync(filePath)) {
    issues.push(issue("error", "version_discipline.manifest_missing", "skill-version.json is required.", filePath));
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    if (!isRecord(parsed)) {
      issues.push(issue("error", "version_discipline.manifest_invalid", "skill-version.json must be an object.", filePath));
      return undefined;
    }
    const version = typeof parsed.version === "string" ? parsed.version : "";
    const updatedAt = typeof parsed.updatedAt === "string" ? parsed.updatedAt : "";
    return { version, updatedAt, releaseNotes: parsed.releaseNotes };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push(issue("error", "version_discipline.manifest_parse_error", `skill-version.json is invalid JSON: ${message}`, filePath));
    return undefined;
  }
}

function findGitRoot(start: string): string | undefined {
  const result = git(["rev-parse", "--show-toplevel"], start);
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function git(argv: string[], cwd: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("git", argv, { cwd, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}
