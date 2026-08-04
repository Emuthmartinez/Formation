#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { asString, collectFiles, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit } from "../../scripts/lib/launch-state.js";

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

function existsAny(candidates: string[]): string | undefined {
  return candidates.find((candidate) => existsSync(path.join(args.root, candidate)));
}

function includesPhrase(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

function codeFor(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function hasStarLevel(text: string, star: number): boolean {
  const patterns = [new RegExp(`\\b${star}\\s*[- ]?star\\b`, "i"), new RegExp(`\\bstars?\\s*[:#-]?\\s*${star}\\b`, "i"), new RegExp(`\\|\\s*${star}\\s*\\|`)];
  return patterns.some((pattern) => pattern.test(text));
}

function existingLocalDoc(relativePath: string): string | undefined {
  const fullPath = path.join(args.root, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : undefined;
}

const experienceStatus = state ? asString(getPath(state, "lanes.experience.status")) : undefined;
const skip = experienceStatus === "not_needed" || experienceStatus === "deferred";
const markdown = firstExistingText([
  "11_STAR_EXPERIENCE.md",
  "product/experience/11-star-experience/11_STAR_EXPERIENCE.md",
  "experience/11_STAR_EXPERIENCE.md",
]);
const htmlPath = existsAny([
  "11-star-experience.html",
  "product/experience/11-star-experience/11-star-experience.html",
  "experience/11-star-experience.html",
  "design/design.html",
]);

if (!skip && !markdown) {
  issues.push(
    issue(
      "error",
      "eleven_star.markdown_missing",
      "11_STAR_EXPERIENCE.md is required to define the experience ladder, feasibility line, and V1 scalable slice.",
      "11_STAR_EXPERIENCE.md",
    ),
  );
}

if (markdown) {
  const requiredPhrases = [
    "Experience Thesis",
    "Star Ladder",
    "Line Of Feasibility",
    "V1 Scalable Slice",
    "Surface Matrix",
    "Visual Storyboard",
    "Traceability",
    "Engineering Contract",
  ];
  for (const phrase of requiredPhrases) {
    if (!includesPhrase(markdown.text, phrase)) {
      issues.push(issue("error", `eleven_star.${codeFor(phrase)}.missing`, `11_STAR_EXPERIENCE.md should include ${phrase}.`, markdown.relativePath));
    }
  }

  for (const star of [1, 2, 5, 6, 7, 10, 11]) {
    if (!hasStarLevel(markdown.text, star)) {
      issues.push(issue("error", `eleven_star.level_${star}.missing`, `The 11-star ladder should include a ${star}-star level.`, markdown.relativePath));
    }
  }

  if (!/\b(unscalable|concierge|impossible|absurd|movie[- ]scene)\b/i.test(markdown.text)) {
    issues.push(
      issue(
        "error",
        "eleven_star.extreme_experience.missing",
        "The ladder should include an impossible, concierge, unscalable, absurd, or movie-scene version before backsolving V1.",
        markdown.relativePath,
      ),
    );
  }

  const requiredSurfaces = ["Product", "Onboarding", "Ad", "App Store", "Engineering"];
  for (const surface of requiredSurfaces) {
    if (!includesPhrase(markdown.text, surface)) {
      issues.push(
        issue(
          "error",
          `eleven_star.surface_${codeFor(surface)}.missing`,
          `Surface Matrix should translate the experience for ${surface}.`,
          markdown.relativePath,
        ),
      );
    }
  }

  const requiredRefs = ["product/SPEC.md", "design/DESIGN.md", "product/ONBOARDING.md", "engineering/TECH_SPEC.md", "state/LAUNCH_TRACE.md"];
  for (const ref of requiredRefs) {
    if (!markdown.text.includes(ref)) {
      issues.push(issue("error", `eleven_star.ref_${codeFor(ref)}.missing`, `11_STAR_EXPERIENCE.md should reference ${ref}.`, markdown.relativePath));
    }
  }

  if (!/reduced[- ]motion/i.test(markdown.text)) {
    issues.push(
      issue(
        "warning",
        "eleven_star.reduced_motion.missing",
        "V1 Scalable Slice should specify motion and reduced-motion behavior. Motion is a primary web-surface delight lever (landing, funnel, paywall, onboarding) via tokenized framer-motion/motion; the shipped mobile binary uses native animation from the same DesignTokens.Motion scale.",
        markdown.relativePath,
      ),
    );
  }

  if (experienceStatus === "done" && /\b(TODO|TBD|unknown|placeholder|pending)\b/i.test(markdown.text)) {
    issues.push(
      issue(
        "error",
        "eleven_star.placeholder_complete",
        "11-star experience cannot be done while TODO/TBD/unknown/placeholder/pending language remains.",
        markdown.relativePath,
      ),
    );
  }
}

if (!skip && !htmlPath) {
  issues.push(
    issue(
      "error",
      "eleven_star.html_missing",
      "11-star-experience.html or design/design.html should render the visual ladder and line of feasibility.",
      "11-star-experience.html",
    ),
  );
}

if (htmlPath) {
  const htmlText = readFileSync(path.join(args.root, htmlPath), "utf8");
  /**
   * The founder reads this page; the agent reads 11_STAR_EXPERIENCE.md. So the
   * two are held to different vocabularies on purpose.
   *
   * This list used to require the internal terms verbatim ("11-Star", "Line Of
   * Feasibility", "V1 Scalable Slice") — which meant the gate was mandating
   * exactly the jargon SKILL.md's Always-On Contracts forbid speaking to a
   * founder. The doc keeps the precise vocabulary; the page has to carry the
   * same four ideas in words a founder recognizes on sight.
   */
  for (const phrase of ["Standout Moment", "What We Can Actually Build", "Smallest First Version", "Every Screen"]) {
    if (!includesPhrase(htmlText, phrase)) {
      issues.push(issue("warning", `eleven_star.html_${codeFor(phrase)}.missing`, `The HTML proof should render ${phrase}.`, htmlPath));
    }
  }
}

if (experienceStatus === "done") {
  const sourceDocs = ["product/SPEC.md", "design/DESIGN.md", "product/ONBOARDING.md", "engineering/TECH_SPEC.md", "state/LAUNCH_TRACE.md"];
  for (const doc of sourceDocs) {
    const text = existingLocalDoc(doc);
    if (text && !/\b(11_STAR_EXPERIENCE\.md|11-star|11 star|EXP-\d+)/i.test(text)) {
      issues.push(
        issue("error", `eleven_star.${codeFor(doc)}.unlinked`, `${doc} exists but does not reference the 11-star experience contract or trace IDs.`, doc),
      );
    }
  }

  const implementationMentions = collectFiles(args.root, new Set([".md", ".html", ".ts", ".tsx", ".js", ".jsx", ".swift", ".kt", ".dart"]), 5000)
    .map((file) => readFileSync(file, "utf8"))
    .some((text) => /\b(V1 Scalable Slice|magical moment|11_STAR_EXPERIENCE\.md|EXP-\d+)\b/i.test(text));
  if (!implementationMentions) {
    issues.push(
      issue(
        "error",
        "eleven_star.no_downstream_mentions",
        "A done 11-star lane should be referenced by downstream product, design, engineering, or proof artifacts.",
        markdown?.relativePath ?? "11_STAR_EXPERIENCE.md",
      ),
    );
  }
}

reportAndExit("11-star experience check", issues);
