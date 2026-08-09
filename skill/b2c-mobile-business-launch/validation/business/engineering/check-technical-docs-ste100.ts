#!/usr/bin/env node
/**
 * check-technical-docs-ste100.ts — the mechanically checkable subset of ASD-STE100.
 *
 * knowledge/engineering/technical-documentation-ste100.md names two rules a machine can
 * verify without judgment: sentence length and present-perfect tense. Everything else in
 * its §3 (one word per meaning, active voice, noun-cluster length) stays judgment-only, the
 * same limit tooling/lib/no-slop-rules.ts documents for the sibling standard — a regex would
 * punish good writing as often as it catches bad writing.
 *
 * Two severity tiers, mirroring check-no-slop.ts's own front-door split: error tier applies
 * only to files this reference can currently guarantee compliant (today, just the reference
 * itself); warning tier applies to the rest of the governed surface — docs/architecture.md,
 * docs/validators.md, and every knowledge/**\/*.md file outside knowledge/words/ (which keeps
 * no-slop-writing.md's voice-preserving register instead). This gives real, repo-wide signal
 * on every edit without failing the build over prose written before this standard existed.
 * Promoting a file to error tier means auditing it against the reference's §3/§4 first, then
 * adding its skill-root-relative path to ERROR_TIER_SKILL_RELATIVE below.
 *
 * npm script: check:documentation-ste100
 * Usage: tsx validation/business/engineering/check-technical-docs-ste100.ts [--repo-root /path] [--skill-root /path]
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles, flagString, issue, parseFlags, reportAndExit, type Issue, type Severity } from "../../../tooling/lib/launch-state.js";
import { findGitRoot } from "../../../tooling/lib/git-root.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "../../..");

const flags = parseFlags(process.argv.slice(2), [
  { flags: ["--repo-root"], key: "repoRoot" },
  { flags: ["--skill-root"], key: "skillRoot" },
]);
const skillRoot = path.resolve(flagString(flags, "skillRoot") ?? defaultSkillRoot);
const repoRoot = path.resolve(flagString(flags, "repoRoot") ?? findGitRoot(skillRoot) ?? path.resolve(skillRoot, "../.."));

const issues: Issue[] = [];

const MAX_SENTENCE_WORDS = 20;

/** Common regular (-ed) and irregular past-participle shapes, for the present-perfect heuristic below. */
const PAST_PARTICIPLE =
  "(?:\\w+ed|been|done|gone|known|shown|written|given|taken|made|found|become|begun|chosen|come|drawn|driven|fallen|felt|gotten|got|grown|held|kept|left|lost|met|paid|run|said|seen|sent|set|spoken|spent|stood|taught|thought|told|understood|won|worked|read|meant|built|bought|caught|brought|fought|sought)";
const presentPerfectPattern = new RegExp(`\\b(?:has|have|had)\\s+(?:not\\s+|never\\s+|already\\s+|just\\s+|recently\\s+)?${PAST_PARTICIPLE}\\b`, "i");

/**
 * skill-root-relative paths this reference can currently guarantee compliant. This is the
 * one file so far: the reference itself, hand-written to its own rules.
 */
const ERROR_TIER_SKILL_RELATIVE = new Set<string>(["knowledge/engineering/technical-documentation-ste100.md"]);

/** Excluded from every governed directory below: evals/fixtures are test data, not documentation. */
const EXCLUDED_ANY_SEGMENT = new Set(["evals", "fixtures"]);
/** Excluded from knowledge/ specifically: words/ keeps no-slop-writing.md's voice-preserving register instead. */
const EXCLUDED_KNOWLEDGE_TOP_SEGMENTS = new Set(["words"]);

/**
 * Maintainer runbook and reference directories outside docs/ and knowledge/ that this
 * reference's own scope names ("a runbook", "validator/gate references") but that live
 * elsewhere in the repo layout — e.g. validation/repository/source-freshness-maintenance.md.
 * Scanned recursively for .md files, skill-root-relative. Add a directory here — not a new
 * bespoke discovery block — when a future runbook lands somewhere not yet covered.
 */
const ADDITIONAL_GOVERNED_DIRECTORIES = ["validation/repository", "tooling"];

interface GovernedFile {
  /** Path shown in issue output, relative to repoRoot. */
  displayPath: string;
  absolute: string;
  tier: Severity;
}

const governed: GovernedFile[] = [];

// docs/ stays an explicit list rather than a scanned directory like ADDITIONAL_GOVERNED_
// DIRECTORIES below: docs/platform/ also holds exploratory and point-in-time content (a
// historical repo audit, a founder-journey narrative, an open backlog) this repo's own
// conventions already keep outside every gate, so a blanket scan would govern files that
// were never meant to be governed. Add a new architecture doc, ADR, or validator reference
// here by name once it exists.
for (const relative of [
  "docs/architecture.md",
  "docs/validators.md",
  "docs/platform/technical-architecture.md",
  "docs/platform/product-architecture.md",
  "docs/platform/decisions-and-tradeoffs.md",
]) {
  const absolute = path.join(repoRoot, relative);
  if (!existsSync(absolute)) continue;
  governed.push({ displayPath: relative, absolute, tier: "warning" });
}

// The trigger line in knowledge/engineering/technical-documentation-ste100.md names this
// skill's own README.md and SKILL.md as governed — include them explicitly, since neither
// lives under knowledge/ where the walk below would otherwise find them.
for (const relative of ["README.md", "SKILL.md"]) {
  const absolute = path.join(skillRoot, relative);
  if (!existsSync(absolute)) continue;
  const displayPath = path.relative(repoRoot, absolute).split(path.sep).join("/");
  governed.push({ displayPath, absolute, tier: "warning" });
}

function collectGovernedMarkdown(baseRelative: string, excludedTopSegments: Set<string>): void {
  const baseDir = path.join(skillRoot, baseRelative);
  if (!existsSync(baseDir) || !statSync(baseDir).isDirectory()) return;
  for (const absolute of collectFiles(baseDir, new Set([".md"]))) {
    const relativeToBase = path.relative(baseDir, absolute).split(path.sep).join("/");
    const segments = relativeToBase.split("/");
    if (excludedTopSegments.has(segments[0] ?? "")) continue;
    if (segments.some((segment) => EXCLUDED_ANY_SEGMENT.has(segment))) continue;
    const skillRelative = `${baseRelative}/${relativeToBase}`;
    const displayPath = path.relative(repoRoot, absolute).split(path.sep).join("/");
    governed.push({ displayPath, absolute, tier: ERROR_TIER_SKILL_RELATIVE.has(skillRelative) ? "error" : "warning" });
  }
}

collectGovernedMarkdown("knowledge", EXCLUDED_KNOWLEDGE_TOP_SEGMENTS);
for (const directory of ADDITIONAL_GOVERNED_DIRECTORIES) {
  collectGovernedMarkdown(directory, new Set());
}

for (const file of governed) {
  const source = readFileSync(file.absolute, "utf8");
  for (const sentence of sentencesOf(source)) {
    const wordCount = sentence.split(/\s+/).filter(Boolean).length;
    if (wordCount > MAX_SENTENCE_WORDS) {
      issues.push(
        issue(
          file.tier,
          "ste100.sentence_too_long",
          `Sentence runs ${wordCount} words, over ASD-STE100's ${MAX_SENTENCE_WORDS}-word ceiling (technical-documentation-ste100.md §3): "${truncate(sentence)}"`,
          file.displayPath,
        ),
      );
    }
    if (presentPerfectPattern.test(sentence)) {
      issues.push(
        issue(
          file.tier,
          "ste100.present_perfect",
          `Sentence uses present-perfect tense, not the simple tense ASD-STE100 §3 requires: "${truncate(sentence)}"`,
          file.displayPath,
        ),
      );
    }
  }
}

reportAndExit("Technical docs: ASD-STE100 mechanical subset", issues);

function truncate(text: string): string {
  return text.length > 100 ? `${text.slice(0, 100)}…` : text;
}

/**
 * Prose a reader actually reads: drops fenced/inline code, HTML comments, and link targets
 * (mirroring check-no-slop.ts's proseText). Double-quoted spans stay in general — a quoted
 * UI label or error message inside a real sentence is still the author's own prose and must
 * still be graded. The one exemption is narrower and lives in the table-row branch below: a
 * table cell that is nothing BUT a single quoted string (this file's own §3 table quotes both
 * "Do" and intentionally bad "Don't" examples this way) is a cited illustration, not an
 * assertion, so only that whole-cell case is dropped.
 */
function sentencesOf(source: string): string[] {
  const stripped = source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\]\([^)]*\)/g, "] ")
    .replace(/`[^`\n]*`/g, " ");

  const filteredLines = stripped.split("\n").filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("#")) return false;
    if (/^\|[\s:|-]+\|?$/.test(trimmed)) return false; // table separator row, e.g. |---|---|
    if (/^[-*_]{3,}$/.test(trimmed)) return false;
    return true;
  });

  const isListItemLine = (value: string): boolean => /^(?:[-*]|\d+[.)])\s/.test(value);
  const isTableRowLine = (value: string): boolean => value.startsWith("|") && value.endsWith("|");

  const lines = filteredLines.map((line, index) => {
    const trimmed = line.trim();
    // A table row's cells are discrete units, same reasoning as a list item — force a
    // boundary at each cell so a long or present-perfect cell can't hide by merging with its
    // neighbors, and the row can't merge into surrounding prose either. A cell that is nothing
    // but a single quoted string (a cited Do/Don't example, not the author's own assertion) is
    // dropped; a cell with only a partial or embedded quote stays and is graded in full.
    if (isTableRowLine(trimmed)) {
      return trimmed
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
        .filter((cell) => !/^"[^"]*"\.?$/.test(cell))
        .map((cell) => (/[.!?]$/.test(cell) ? cell : `${cell}.`))
        .join(" ");
    }
    // A list item is a discrete unit by definition — force a boundary at its end so it never
    // merges with the next bullet into one oversized chunk, even when the item itself is a
    // short phrase with no terminal punctuation.
    if (isListItemLine(trimmed)) {
      return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
    }
    // A colon does NOT end a sentence in general — "Follow this procedure: open the file,
    // read line one, ..." is one long instruction a colon must not let escape the word-count
    // rule by splitting it into two short-looking halves. The one structural exception: a
    // line that ends with ':' specifically to introduce the list that follows it. There, the
    // colon is punctuation between two document *structures* (an intro and a list), not
    // punctuation inside one grammatical sentence, so converting it to a real boundary is
    // safe and keeps that intro from merging into the first bullet's own chunk.
    const nextTrimmed = filteredLines[index + 1]?.trim();
    if (nextTrimmed !== undefined && isListItemLine(nextTrimmed) && /:$/.test(trimmed)) {
      return trimmed.replace(/:$/, ".");
    }
    return trimmed;
  });

  const joined = lines.join(" ");
  // A trailing prose chunk with no terminal punctuation would otherwise fall off the end of
  // the match below unseen — force a boundary so the final segment always gets checked too.
  const closed = /[.!?]\s*$/.test(joined) ? joined : `${joined}.`;
  const rawSentences = closed.match(/[^.!?]+[.!?]+/g) ?? [];
  return rawSentences.map((entry) => entry.trim()).filter(Boolean);
}
