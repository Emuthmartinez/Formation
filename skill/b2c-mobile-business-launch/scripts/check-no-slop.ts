#!/usr/bin/env node
/**
 * check-no-slop.ts — the writing-quality gate for founder copy and generated marketing copy.
 *
 * Rules adapted from petergyang/no-ai-slop (MIT) — https://github.com/petergyang/no-ai-slop
 * The rule lists live in references/no-slop-writing.md and are parsed from there, so the
 * doc an agent reads and the gate that fails the build cannot drift apart.
 *
 * Two scopes, deliberately different in strictness:
 *
 * 1. SHIPPED SURFACES (error). The skill's own founder-facing copy and the copy templates
 *    it hands to a launched business. This repo authored them, so it holds them to the
 *    standard it is about to impose on every business it launches. Failing to do that
 *    would be the same trap the founder-surface audit found: doctrine the skill preaches
 *    and does not practice.
 * 2. GUIDANCE PROSE (warn). references/ and the maintainer docs. These are read by agents,
 *    not customers, and precision there sometimes needs a word the marketing rules ban.
 *
 * What this gate deliberately does NOT enforce: the judgment-dependent rules. "Cut the
 * adverb when it adds nothing, keep it when it carries the writer's rhythm" is not a
 * regex, and turning it into one would flatten brand voice — the exact failure the source
 * skill warns against. Those rules stay advisory in the reference, and the agent checks
 * itself against them. This gate catches the mechanical patterns only.
 *
 * npm script: check:no-slop
 * Usage: tsx scripts/check-no-slop.ts --skill-root /path/to/skill [--root /path/to/templates]
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flagString, issue, parseFlags, reportAndExit, type Issue } from "./lib/launch-state.js";
import { emDashProblem, loadNoSlopRules, matchesTerm, slopPatterns } from "./lib/no-slop-rules.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "..");

const flags = parseFlags(process.argv.slice(2), [
  { flags: ["--skill-root"], key: "skillRoot" },
  { flags: ["--root"], key: "root" },
]);
const skillRoot = path.resolve(flagString(flags, "skillRoot") ?? defaultSkillRoot);
const templatesRoot = path.resolve(flagString(flags, "root") ?? path.join(skillRoot, "templates"));
const issues: Issue[] = [];

const referenceRelative = "references/no-slop-writing.md";
const referencePath = path.join(skillRoot, referenceRelative);

if (!existsSync(referencePath)) {
  issues.push(
    issue(
      "error",
      "no_slop.reference_missing",
      `${referenceRelative} is required. It is the source of truth for the banned-word lists this gate reads.`,
      referenceRelative,
    ),
  );
  reportAndExit("No-slop writing", issues);
}

const rules = loadNoSlopRules(referencePath);

/**
 * Copy a founder or a customer reads. Short-copy surfaces get the stricter em-dash rule
 * because a store subtitle or an ad headline has no room for one.
 */
const shippedSurfaces: { relative: string; shortCopy: boolean }[] = [
  { relative: "launch-cockpit.html", shortCopy: true },
  { relative: "BUSINESS_ACCESS.md", shortCopy: false },
  { relative: "onboarding.html", shortCopy: true },
  { relative: "design-room.html", shortCopy: true },
  { relative: "BRAND.md", shortCopy: false },
  { relative: "DESIGN.md", shortCopy: false },
  { relative: "ONBOARDING.md", shortCopy: false },
  { relative: "REVENUE_OPS.md", shortCopy: false },
  { relative: "EMAIL_OPS.md", shortCopy: false },
  { relative: "growth/LAUNCH_NARRATIVE.md", shortCopy: false },
  { relative: "growth/VIRAL_GROWTH.md", shortCopy: false },
  { relative: "growth/PAID_UA.md", shortCopy: false },
  { relative: "UGC_PLAYBOOK.md", shortCopy: false },
  { relative: "app-store-listing/APP_STORE_LISTING.md", shortCopy: true },
  { relative: "11-star-experience/11_STAR_EXPERIENCE.md", shortCopy: false },
  { relative: "emotional-design/EMOTIONAL_DESIGN.md", shortCopy: false },
];

for (const surface of shippedSurfaces) {
  const absolute = path.join(templatesRoot, surface.relative);
  if (!existsSync(absolute)) continue;
  scan(readFileSync(absolute, "utf8"), surface.relative, "error", surface.shortCopy);
}

// Guidance prose: same rules, reported as warnings so precision is never blocked.
for (const relative of listReferences()) {
  // The rules file quotes every banned word and pattern as its own examples.
  if (relative === referenceRelative) continue;
  scan(readFileSync(path.join(skillRoot, relative), "utf8"), relative, "warning", false);
}

reportAndExit("No-slop writing", issues);

/**
 * Scans one file. Code fences, inline code, link targets, and YAML frontmatter are
 * stripped first: an identifier or a command is not prose and must not be judged as prose.
 */
function scan(source: string, relative: string, severity: "error" | "warning", shortCopy: boolean): void {
  const prose = proseOnly(source);

  for (const word of rules.bannedWords) {
    if (!matchesTerm(prose, word)) continue;
    issues.push(
      issue(severity, "no_slop.banned_word", `"${word}" is banned in ${referenceRelative}. Replace it with the plain word you actually mean.`, relative),
    );
  }

  for (const pattern of slopPatterns) {
    const match = prose.match(pattern.pattern);
    if (!match) continue;
    issues.push(
      issue(
        severity === "error" ? pattern.severity : "warning",
        `no_slop.${pattern.id}`,
        `${pattern.problem} ${pattern.fix} Found: "${collapse(match[0])}"`,
        relative,
      ),
    );
  }

  const dashProblem = emDashProblem(prose, shortCopy);
  if (dashProblem) {
    // Em dashes are a style call rather than a defect, so they warn even on shipped copy.
    issues.push(issue("warning", "no_slop.em_dash", dashProblem, relative));
  }

  // Empty phrases are advisory everywhere: the reference says keep them when they carry
  // the writer's voice, and a gate cannot tell the difference.
  for (const phrase of rules.emptyPhrases) {
    if (!matchesTerm(prose, phrase)) continue;
    issues.push(issue("warning", "no_slop.empty_phrase", `"${phrase}" usually delays the point. Cut it unless it is carrying real voice.`, relative));
  }
}

/** Prose with code, commands, link targets, frontmatter, and HTML tags removed. */
function proseOnly(source: string): string {
  return source
    .replace(/^---\n[\s\S]*?\n---\n/, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\]\([^)]*\)/g, "] ")
    .replace(/https?:\/\/\S+/g, " ");
}

function collapse(value: string): string {
  const single = value.replace(/\s+/g, " ").trim();
  return single.length > 90 ? `${single.slice(0, 87)}...` : single;
}

function listReferences(): string[] {
  const referencesRoot = path.join(skillRoot, "references");
  if (!existsSync(referencesRoot)) return [];
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const absolute = path.join(dir, entry);
      if (statSync(absolute).isDirectory()) {
        walk(absolute);
        continue;
      }
      if (entry.endsWith(".md")) found.push(path.relative(skillRoot, absolute));
    }
  };
  walk(referencesRoot);
  return found.sort();
}
