#!/usr/bin/env node
/**
 * check-founder-copy.ts — no raw machine value reaches a founder.
 *
 * This gate exists because the founder-facing dashboard used to print
 * PROJECT_STATE.yaml keys straight into HTML, so a founder read rows like
 * "paid_tool_routing | not_started" on their own business dashboard. The fix was a
 * translation layer (scripts/lib/founder-copy.ts). This gate is what stops the fix from
 * rotting the next time someone adds a lane, a status, a phase, or a provider route.
 *
 * Three rules:
 *
 * 1. COVERAGE. Every lane, status, phase, and autonomy mode in lib/launch-state.ts has
 *    founder copy in lib/founder-copy.ts. A new lane cannot ship unlabeled.
 * 2. NO RAW IDENTIFIERS. No snake_case token, SCREAMING_SNAKE token, or pipe-delimited
 *    multi-segment value appears in founder-visible text. Text inside a clearly marked
 *    technical-details disclosure is exempt, because that block is explicitly for
 *    whoever picks the repo up next rather than for the founder.
 * 3. NO INTERNAL VOCABULARY. The words in bannedFounderVocabulary do not appear in
 *    founder-visible prose. Each one has a plain-language replacement recorded next to
 *    it, so a failure tells the author what to say instead.
 *
 * Scanning is deliberately text-only: HTML attributes (where `class="status
 * not_started"` legitimately carries the enum), <style> and <script> bodies, markdown
 * code fences, and inline code spans are stripped before the scan. Identifiers belong in
 * those places; they do not belong in a sentence a founder reads.
 *
 * npm script: check:founder-copy
 * Usage: tsx scripts/check-founder-copy.ts --root /path/to/templates [--skill-root /path/to/skill]
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { asString, flagString, getPath, isPastOrientPhase, issue, parseFlags, reportAndExit, type Issue } from "./lib/launch-state.js";
import { bannedFounderVocabulary, coverageGaps, milestones } from "./lib/founder-copy.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "..");

const flags = parseFlags(process.argv.slice(2), [
  { flags: ["--root"], key: "root" },
  { flags: ["--skill-root"], key: "skillRoot" },
]);
const root = path.resolve(flagString(flags, "root") ?? path.join(defaultSkillRoot, "templates"));
const skillRoot = path.resolve(flagString(flags, "skillRoot") ?? defaultSkillRoot);
const issues: Issue[] = [];

/**
 * Founder-visible surfaces. These are the files a founder actually opens, so they carry
 * the strictest copy rules in the repo.
 */
const founderSurfaces: { relative: string; kind: "html" | "markdown" }[] = [
  { relative: "launch-cockpit.html", kind: "html" },
  { relative: "BUSINESS_ACCESS.md", kind: "markdown" },
  { relative: "design-room.html", kind: "html" },
  { relative: "onboarding.html", kind: "html" },
  { relative: "analytics-plan.html", kind: "html" },
  { relative: "security-review.html", kind: "html" },
  { relative: "store-console.html", kind: "html" },
];

/**
 * Tokens that legitimately appear in founder-visible prose despite matching an
 * identifier shape. Every entry needs a reason, in keeping with house culture.
 */
const allowedTokens = new Map<string, string>([
  ["robots.txt", "a real filename a founder will see referenced in SEO work"],
  ["llms.txt", "a real filename a founder will see referenced in AI-crawler work"],
  ["sitemap.xml", "a real filename a founder will see referenced in SEO work"],
  ["security.txt", "a published file at a public URL"],
  ["app-ads.txt", "a published file at a public URL"],
  ["BUSINESS_ACCESS.md", "the founder's own access document, named in its own heading"],
  ["PROJECT_STATE.yaml", "named in continuity prose that a founder may hand to another agent"],
  ["package.json", "a real filename in setup instructions"],
  ["Info.plist", "a real Apple filename in submission instructions"],
  ["2FA", "a term founders already know"],
]);

/** Words allowed despite matching a banned term, because the phrase means something else. */
const vocabularyExemptions = new Map<string, RegExp[]>([
  ["gate", [/\bdelegate/i, /\bgateway/i, /\bmitigate/i, /\baggregate/i, /\bnavigate/i, /\binvestigate/i]],
  ["lane", [/\bplane\b/i, /\bplanet/i, /\bexplanet/i]],
  ["proof", [/\bproofread/i, /\bfoolproof/i, /\bwaterproof/i, /\bbulletproof/i]],
]);

// ---------------------------------------------------------------------------
// Rule 1: coverage
// ---------------------------------------------------------------------------

for (const gap of coverageGaps()) {
  issues.push(
    issue(
      "error",
      `founder_copy.missing_${gap.vocabulary.replace(/\s+/g, "_")}`,
      `scripts/lib/founder-copy.ts has no founder-visible label for these ${gap.vocabulary}: ${gap.missing.join(", ")}. Add a label in the same commit that adds the value.`,
      "scripts/lib/founder-copy.ts",
    ),
  );
}

if (milestones.length < 5 || milestones.length > 12) {
  issues.push(
    issue(
      "error",
      "founder_copy.milestone_count",
      `The founder progress view has ${milestones.length} milestones. Keep it between 5 and 12 — fewer says nothing, more is the 22-row table again under a new name.`,
      "scripts/lib/founder-copy.ts",
    ),
  );
}

for (const beatPhase of ["phase_1", "phase_2", "phase_3b", "phase_6"]) {
  const found = readFileSync(path.join(skillRoot, "scripts/lib/founder-copy.ts"), "utf8").includes(`phase: "${beatPhase}"`);
  if (!found) {
    issues.push(
      issue(
        "error",
        "founder_copy.celebration_beat_missing",
        `No progress beat is recorded for ${beatPhase}. A founder should hear when a real milestone lands, not only when something is required of them.`,
        "scripts/lib/founder-copy.ts",
      ),
    );
  }
}

// The beats must be wired, not just defined: the dictionary carried them for a
// full release cycle while the renderer never imported them, so the founder
// was never actually shown a milestone. Source-level check, same technique as
// the beat-presence check above.
const rendererSource = readFileSync(path.join(skillRoot, "scripts/render-launch-cockpit.ts"), "utf8");
if (!rendererSource.includes("celebrationFor") && !rendererSource.includes("celebrationBeats")) {
  issues.push(
    issue(
      "error",
      "founder_copy.celebration_unwired",
      "render-launch-cockpit.ts never references celebrationFor/celebrationBeats — the progress beats exist in the dictionary but nothing shows them to the founder. Wire the earned-but-unspoken beat into the cockpit.",
      "scripts/render-launch-cockpit.ts",
    ),
  );
}

// Narrative freshness: the PROJECT_STATE.yaml template has promised this
// enforcement in its own comment since v0.25.0 ("check:founder-copy fails on
// empty or placeholder text once the project is past the orient phase") —
// this makes the promise true. The shipped template stays in orient, so it is
// exempt by its own phase.
const statePath = path.join(root, "PROJECT_STATE.yaml");
if (existsSync(statePath)) {
  try {
    const state: unknown = parseYaml(readFileSync(statePath, "utf8"));
    const phase = asString(getPath(state, "project.phase")) ?? "";
    if (isPastOrientPhase(phase)) {
      for (const field of ["since_last_time", "right_now", "your_call"] as const) {
        const value = (asString(getPath(state, `narrative.${field}`)) ?? "").trim();
        if (value.length === 0 || /^(todo|tbd|n\/a|placeholder|\.\.\.)$/i.test(value)) {
          issues.push(
            issue(
              "error",
              `founder_copy.narrative_stale.${field}`,
              `narrative.${field} is empty or placeholder text while the project is past orient (${phase}). ` +
                `The narrated update is the founder's first read on the cockpit — write what actually happened, in plain language.`,
              "PROJECT_STATE.yaml",
            ),
          );
        }
      }
    }
  } catch {
    // Malformed state is validate-project-state's finding, not this gate's.
  }
}

// ---------------------------------------------------------------------------
// Rules 2 and 3: scan founder-visible surfaces
// ---------------------------------------------------------------------------

for (const surface of founderSurfaces) {
  const absolute = path.join(root, surface.relative);
  if (!existsSync(absolute)) continue;
  const source = readFileSync(absolute, "utf8");
  const scannable = surface.kind === "html" ? founderVisibleHtmlText(source) : founderVisibleMarkdownText(source);

  for (const token of rawIdentifiers(scannable)) {
    issues.push(
      issue(
        "error",
        "founder_copy.raw_identifier",
        `"${token}" is a machine value in text a founder reads. Route it through scripts/lib/founder-copy.ts, or move it inside the technical-details disclosure.`,
        surface.relative,
      ),
    );
  }

  for (const { term, sayInstead } of bannedFounderVocabulary) {
    if (!containsTerm(scannable, term)) continue;
    issues.push(issue("error", "founder_copy.internal_vocabulary", `"${term}" appears in text a founder reads. Say instead: ${sayInstead}.`, surface.relative));
  }
}

reportAndExit("Founder copy", issues);

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

/**
 * Founder-visible text from an HTML surface: drops style/script bodies, drops every tag
 * (so attributes never reach the scan), and drops any <details> block, which is the
 * sanctioned home for technical detail.
 */
function founderVisibleHtmlText(source: string): string {
  return (
    source
      .replace(/<details[\s\S]*?<\/details>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      // <code> marks a value AS an identifier, the same way backticks do in markdown. A
      // secret name a founder must paste into a provider belongs there; the same string
      // dropped into a sentence does not.
      .replace(/<code[\s\S]*?<\/code>/gi, " ")
      // Mustache placeholders are substituted before a founder ever sees the page.
      .replace(/\{\{[^}]*\}\}/g, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replaceAll("&amp;", "&")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", '"')
  );
}

/**
 * Founder-visible text from a markdown surface: drops fenced blocks, inline code spans,
 * link targets, and HTML comments. Identifiers inside backticks are how this repo names
 * real files and commands, so they are legitimate there.
 */
function founderVisibleMarkdownText(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\]\([^)]*\)/g, "] ")
    .replace(/^\s{4,}\S.*$/gm, " ");
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** Machine-shaped tokens found in founder-visible text, deduplicated and allowlisted. */
function rawIdentifiers(text: string): string[] {
  const found = new Set<string>();

  // snake_case and SCREAMING_SNAKE_CASE: two or more segments joined by underscores.
  for (const match of text.matchAll(/\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b/g)) {
    const token = match[0];
    if (isAllowed(token)) continue;
    found.add(token);
  }

  // Pipe-delimited multi-segment values, e.g. "high | founder | open" — a serialized
  // record dropped into a sentence. Markdown table rows are excluded: a table is
  // structure a reader understands, not a value pretending to be prose.
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|")) continue;
    for (const match of trimmed.matchAll(/[^\n|]{2,60}\|[^\n|]{2,60}\|[^\n|]{2,60}/g)) {
      const token = match[0].trim().replace(/\s+/g, " ");
      if (/^[\s|:-]+$/.test(token)) continue;
      found.add(token.length > 80 ? `${token.slice(0, 77)}...` : token);
    }
  }

  return [...found];
}

function isAllowed(token: string): boolean {
  if (allowedTokens.has(token)) return true;
  // Allowlisted filenames are matched without their extension too, because the token
  // regex stops at the dot ("BUSINESS_ACCESS.md" is scanned as "BUSINESS_ACCESS").
  return [...allowedTokens.keys()].some((allowed) => allowed.replace(/\.[A-Za-z0-9]+$/, "") === token);
}

/** Whole-word term match with per-term exemptions for words that merely contain it. */
function containsTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[^A-Za-z0-9-])${escaped}([^A-Za-z0-9-]|$)`, "i");
  if (!pattern.test(text)) return false;
  const exemptions = vocabularyExemptions.get(term.toLowerCase());
  if (!exemptions) return true;
  // Re-test with exempt words removed, so "delegate" does not trip the "gate" rule.
  let stripped = text;
  for (const exemption of exemptions) {
    stripped = stripped.replace(new RegExp(exemption.source, "gi"), " ");
  }
  return pattern.test(stripped);
}
