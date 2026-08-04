#!/usr/bin/env node
import { asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit } from "../../../tooling/lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;

function firstExistingText(candidates: string[]): { relativePath: string; text: string } | undefined {
  for (const candidate of candidates) {
    const text = readText(args.root, candidate);
    if (text) {
      return { relativePath: candidate, text };
    }
  }
  return undefined;
}

function includes(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

function codeFor(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function mentionsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => includes(text, term));
}

function fencedBlocks(text: string): string[] {
  const blocks: string[] = [];
  const pattern = /```[^\n]*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    blocks.push(match[1] ?? "");
  }
  return blocks;
}

const growthStatus = state ? asString(getPath(state, "lanes.growth.status"))?.toLowerCase() : undefined;
const skip = growthStatus === "not_needed" || growthStatus === "deferred";
const markdown = firstExistingText(["LAUNCH_NARRATIVE.md", "growth/LAUNCH_NARRATIVE.md"]);

if (!skip && !markdown) {
  issues.push(
    issue(
      "error",
      "launch_narrative.markdown_missing",
      "LAUNCH_NARRATIVE.md is required when the growth lane treats the launch as an event: a tentpole announcement plus a weekly feature-launch cadence.",
      "growth/LAUNCH_NARRATIVE.md",
    ),
  );
}

if (markdown) {
  const requiredPhrases = [
    "Fit Gate",
    "Launch Thesis",
    "Feeling-First",
    "Emotional Angle",
    "Bold Claim",
    "Outcome Over Feature",
    "Tentpole Launch",
    "Feature Launch Cadence",
    "Algorithm Compounding",
    "standing audience",
    "Marketing At The Table",
    "Outlier Research",
    "Amplification Roster",
    "Launch Day Run-of-Show",
    "Launch-Day Timing Engine",
    "Announcement Post",
    "Copy Guardrails",
    "Follow-Up Window",
    "Sourcing And Ranking",
    "Measurement Plan",
    "Stop And Scale Rules",
    "Founder-Only Gates",
    "Traceability",
  ];
  for (const phrase of requiredPhrases) {
    if (!includes(markdown.text, phrase)) {
      issues.push(issue("error", `launch_narrative.${codeFor(phrase)}.missing`, `LAUNCH_NARRATIVE.md should include ${phrase}.`, markdown.relativePath));
    }
  }

  const requiredRefs = [
    "CONTENT_ASSETS.md",
    "analytics/ANALYTICS.md",
    "APP_STORE_LISTING.md",
    "VIRAL_GROWTH.md",
    "state/LAUNCH_TRACE.md",
    "11_STAR_EXPERIENCE.md",
    "EMOTIONAL_DESIGN.md",
  ];
  for (const ref of requiredRefs) {
    if (!markdown.text.includes(ref)) {
      issues.push(issue("error", `launch_narrative.ref_${codeFor(ref)}.missing`, `LAUNCH_NARRATIVE.md should reference ${ref}.`, markdown.relativePath));
    }
  }

  // The launch has to be shaped around a feeling first, the feature second.
  if (!mentionsAny(markdown.text, ["hope", "broken", "reframe"])) {
    issues.push(
      issue(
        "error",
        "launch_narrative.emotional_angle.missing",
        "Name the dominant emotional angle (a glimmer of hope, pointing at something broken you fix, or a category reframe) so the launch makes people feel something, not just informs them.",
        markdown.relativePath,
      ),
    );
  }

  // Deterministic 2026 copy guardrails. Treat fenced code blocks as the actual post copy:
  // no hashtags, no emoji, and no link in the main announcement post (the link belongs in a reply).
  const blocks = fencedBlocks(markdown.text);
  if (blocks.length === 0) {
    issues.push(
      issue(
        "error",
        "launch_narrative.post_copy.missing",
        "Include the actual announcement and feature-launch post copy in fenced code blocks so the deterministic copy guardrails can check it.",
        markdown.relativePath,
      ),
    );
  }
  const hashtagPattern = /(^|\s)#[A-Za-z][\w-]*/m;
  const emojiPattern = /\p{Extended_Pictographic}/u;
  const linkPattern = /https?:\/\/|\bwww\.[^\s]+/i;
  for (const block of blocks) {
    if (hashtagPattern.test(block)) {
      issues.push(
        issue(
          "error",
          "launch_narrative.copy_hashtag",
          "Launch post copy must not use hashtags — they read as marketing and depress reach in 2026.",
          markdown.relativePath,
        ),
      );
    }
    if (emojiPattern.test(block)) {
      issues.push(
        issue(
          "error",
          "launch_narrative.copy_emoji",
          "Launch post copy must not lean on emojis; let the hook and the video carry the feeling.",
          markdown.relativePath,
        ),
      );
    }
    if (linkPattern.test(block)) {
      issues.push(
        issue(
          "error",
          "launch_narrative.copy_link_in_post",
          "Do not put the link in the main announcement post; place it in a reply so the post is not deprioritized.",
          markdown.relativePath,
        ),
      );
    }
  }

  if (growthStatus === "done" && /\b(TODO|TBD|unknown|placeholder|pending)\b/i.test(markdown.text)) {
    issues.push(
      issue(
        "error",
        "launch_narrative.placeholder_complete",
        "Launch narrative cannot be done while TODO/TBD/unknown/placeholder/pending language remains.",
        markdown.relativePath,
      ),
    );
  }
}

reportAndExit("Launch narrative and cadence check", issues);
