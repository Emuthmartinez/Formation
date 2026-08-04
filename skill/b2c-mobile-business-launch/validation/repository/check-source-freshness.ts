#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { collectAllFiles, flagBoolean, flagNumber, flagString, isRecord, issue, parseFlags, reportAndExit } from "../../tooling/lib/launch-state.js";

type MutableRecord = Record<string, unknown>;

interface Args {
  root: string;
  registryPath: string;
  sinceDays: number;
  writeDiscovered: boolean;
}

interface DiscoveredUrl {
  url: string;
  locations: Set<string>;
  addedRecently: boolean;
}

const textExtensions = new Set([".md", ".markdown", ".yaml", ".yml", ".json", ".ts", ".tsx", ".js", ".mjs", ".html", ".txt"]);
const ignoredPathParts = new Set(["node_modules", ".git", "package-lock.json"]);
const ignoredHosts = new Set(["example.com", "localhost", "127.0.0.1"]);

function parseArgs(argv: string[]): Args {
  const flags = parseFlags(argv, [
    { flags: ["--root"], key: "root" },
    { flags: ["--registry"], key: "registry", kind: "string" },
    { flags: ["--since-days"], key: "sinceDays", kind: "number" },
    { flags: ["--write-discovered"], key: "writeDiscovered", kind: "boolean" },
  ]);
  const root = flagString(flags, "root") ?? process.cwd();
  const registryPath = flagString(flags, "registry") ?? "validation/repository/source-registry.yaml";
  const sinceDays = flagNumber(flags, "sinceDays") ?? 8;

  return {
    root,
    registryPath: path.isAbsolute(registryPath) ? registryPath : path.resolve(root, registryPath),
    sinceDays: Number.isFinite(sinceDays) && sinceDays > 0 ? sinceDays : 8,
    writeDiscovered: flagBoolean(flags, "writeDiscovered"),
  };
}

function normalizeUrl(raw: string): string | undefined {
  const trimmed = raw
    .trim()
    .replace(/[`'")\],.}>;:]+$/g, "")
    .replace(/^[`'"(<{[]+/g, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    return undefined;
  }
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    if (ignoredHosts.has(parsed.hostname.toLowerCase()) || parsed.hostname.toLowerCase().endsWith(".test")) {
      return undefined;
    }
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.replace(/\/+$/g, "");
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function extractUrls(text: string): string[] {
  const urls = new Set<string>();
  for (const match of text.matchAll(/https?:\/\/[^\s<>"')\]}]+/gi)) {
    const normalized = normalizeUrl(match[0]);
    if (normalized) {
      urls.add(normalized);
    }
  }
  return Array.from(urls).sort();
}

function shouldScan(filePath: string, root: string, registryPath: string): boolean {
  const relative = path.relative(root, filePath);
  if (path.resolve(filePath) === path.resolve(registryPath)) {
    return false;
  }
  if (relative.startsWith("docs/source-freshness/source-snapshots")) {
    return false;
  }
  if (relative.startsWith("docs/source-freshness/SOURCE_REFRESH_REPORT")) {
    return false;
  }
  // Generated build artifact, same as the two above. Its HTML-escaped URLs
  // (&amp;) re-enter the scan as "new" unregistered sources otherwise — the
  // exact loop that kept the weekly refresh job red for seven straight runs.
  if (relative.startsWith("docs/source-freshness/source-refresh.html")) {
    return false;
  }
  const segments = relative.split(path.sep);
  // Machine-local agent worktrees are concurrent checkouts of other branches,
  // not this checkout's content. A sibling agent's in-progress copy carrying a
  // not-yet-registered URL would turn the local audit red while CI (clean
  // checkout, no nested worktrees) stays green; that branch's own audit is
  // where the URL gets registered. Same class of exclusion as the npm-pack
  // .claude rule and the generated report above. Compared as path segments so
  // the exclusion holds on Windows separators too.
  if (segments[0] === ".claude" && segments[1] === "worktrees") {
    return false;
  }
  if (segments.some((part) => ignoredPathParts.has(part))) {
    return false;
  }
  return textExtensions.has(path.extname(filePath));
}

function loadRegistry(registryPath: string): MutableRecord {
  if (!existsSync(registryPath)) {
    return { schema_version: 1, sources: [] };
  }
  const parsed = parseYaml(readFileSync(registryPath, "utf8"));
  if (!isRecord(parsed)) {
    return { schema_version: 1, sources: [] };
  }
  if (!Array.isArray(parsed.sources)) {
    parsed.sources = [];
  }
  return parsed;
}

function sourceRecords(registry: MutableRecord): MutableRecord[] {
  return Array.isArray(registry.sources) ? registry.sources.filter(isRecord) : [];
}

function discoverCurrentUrls(args: Args): Map<string, DiscoveredUrl> {
  const discovered = new Map<string, DiscoveredUrl>();
  for (const file of collectAllFiles(args.root, 20000)) {
    if (!shouldScan(file, args.root, args.registryPath)) {
      continue;
    }
    const relative = path.relative(args.root, file);
    const text = readFileSync(file, "utf8");
    for (const url of extractUrls(text)) {
      const entry = discovered.get(url) ?? { url, locations: new Set<string>(), addedRecently: false };
      entry.locations.add(relative);
      discovered.set(url, entry);
    }
  }
  return discovered;
}

function recentAddedUrls(args: Args): Set<string> {
  const urls = new Set<string>();
  const log = spawnSync("git", ["log", `--since=${args.sinceDays}.days`, "--format=%H", "--", "."], {
    cwd: args.root,
    encoding: "utf8",
  });
  if (log.status !== 0) {
    return urls;
  }
  for (const commit of log.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)) {
    const show = spawnSync("git", ["show", "--format=", "--unified=0", "--no-ext-diff", commit, "--", "."], {
      cwd: args.root,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
    if (show.status !== 0) {
      continue;
    }
    for (const line of show.stdout.split(/\r?\n/)) {
      if (!line.startsWith("+") || line.startsWith("+++")) {
        continue;
      }
      for (const url of extractUrls(line.slice(1))) {
        urls.add(url);
      }
    }
  }

  const diff = spawnSync("git", ["diff", "--unified=0", "--no-ext-diff", "HEAD", "--", "."], {
    cwd: args.root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (diff.status === 0) {
    for (const line of diff.stdout.split(/\r?\n/)) {
      if (!line.startsWith("+") || line.startsWith("+++")) {
        continue;
      }
      for (const url of extractUrls(line.slice(1))) {
        urls.add(url);
      }
    }
  }

  return urls;
}

function classifySource(url: string): string {
  const parsed = new URL(url);
  if (parsed.hostname === "github.com") {
    return "github";
  }
  if (parsed.hostname.includes("developer.apple.com") || parsed.hostname.includes("developer.android.com")) {
    return "official_docs";
  }
  if (parsed.hostname.includes("docs.") || parsed.pathname.includes("/docs")) {
    return "docs";
  }
  if (parsed.hostname.includes("support.google.com")) {
    return "support_docs";
  }
  return "website";
}

function sourceIdFor(url: string, usedIds: Set<string>): string {
  const parsed = new URL(url);
  const base =
    `${parsed.hostname}${parsed.pathname}`
      .replace(/^www\./, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 80) || "source";
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function appendDiscoveredSources(registry: MutableRecord, missing: DiscoveredUrl[]): void {
  const sources = Array.isArray(registry.sources) ? registry.sources : [];
  registry.sources = sources;
  const usedIds = new Set(
    sourceRecords(registry)
      .map((source) => String(source.id ?? ""))
      .filter(Boolean),
  );
  for (const item of missing.sort((a, b) => a.url.localeCompare(b.url))) {
    sources.push({
      id: sourceIdFor(item.url, usedIds),
      name: new URL(item.url).hostname,
      source_type: classifySource(item.url),
      url: item.url,
      refresh_cadence_days: 7,
      owner: "source-freshness",
      locations: Array.from(item.locations).sort(),
      notes: item.addedRecently ? "Auto-discovered from recently added repository content." : "Auto-discovered from repository content.",
    });
  }
  sources.sort((a, b) => String((a as MutableRecord).id ?? "").localeCompare(String((b as MutableRecord).id ?? "")));
}

const args = parseArgs(process.argv.slice(2));
const issues = [];
const registry = loadRegistry(args.registryPath);
const discovered = discoverCurrentUrls(args);
const recentlyAdded = recentAddedUrls(args);

for (const url of recentlyAdded) {
  const entry = discovered.get(url);
  if (entry) {
    entry.addedRecently = true;
  }
}

const registeredUrls = new Set(
  sourceRecords(registry)
    .map((source) => normalizeUrl(String(source.url ?? "")))
    .filter((url): url is string => Boolean(url)),
);

const missing = Array.from(discovered.values()).filter((entry) => !registeredUrls.has(entry.url));

if (missing.length > 0 && args.writeDiscovered) {
  appendDiscoveredSources(registry, missing);
  writeFileSync(args.registryPath, stringifyYaml(registry, { lineWidth: 120 }), "utf8");
} else {
  for (const entry of missing) {
    issues.push(
      issue(
        "error",
        entry.addedRecently ? "source_freshness.new_recent_url_unregistered" : "source_freshness.url_unregistered",
        `External source is referenced but missing from source-registry.yaml: ${entry.url}`,
        Array.from(entry.locations).sort()[0],
      ),
    );
  }
}

for (const [index, source] of sourceRecords(registry).entries()) {
  const prefix = `sources.${index}`;
  for (const field of ["id", "name", "source_type", "url", "owner"]) {
    if (typeof source[field] !== "string" || !String(source[field]).trim()) {
      issues.push(
        issue(
          "error",
          `source_freshness.${prefix}.${field}.missing`,
          `${prefix}.${field} must be a non-empty string.`,
          path.relative(args.root, args.registryPath),
        ),
      );
    }
  }
  if (!normalizeUrl(String(source.url ?? ""))) {
    issues.push(
      issue(
        "error",
        `source_freshness.${prefix}.url.invalid`,
        `${prefix}.url must be a valid external http(s) URL.`,
        path.relative(args.root, args.registryPath),
      ),
    );
  }
  if (typeof source.refresh_cadence_days !== "number" || source.refresh_cadence_days < 1) {
    issues.push(
      issue(
        "error",
        `source_freshness.${prefix}.refresh_cadence_days.invalid`,
        `${prefix}.refresh_cadence_days must be a positive number.`,
        path.relative(args.root, args.registryPath),
      ),
    );
  }
}

reportAndExit("Source freshness registry check", issues);
