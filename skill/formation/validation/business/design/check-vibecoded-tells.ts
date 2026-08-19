#!/usr/bin/env node
/**
 * check-vibecoded-tells.ts — the mechanically checkable subset of the vibecoded-tells list.
 *
 * knowledge/design/vibecoded-tells.md names the surface smells that make a page read as
 * unedited AI output. Most rows need judgment (the audit pass owns those); this gate catches
 * the greppable subset over landing/web-surface source, mirroring how no-slop-rules.ts
 * enforces the mechanical subset of the writing standard.
 *
 * Two severity tiers, from the reference's own scoring rule. Errors are the never-earned or
 * trust-tier hits: a default icon pack import, and a site-shaped landing with no terms or
 * privacy link. Warnings are Tier 2 default tells — each one is a demand for a derivation
 * row in design/design.md, not an automatic removal order, so a warning must stay visible
 * without blocking the build. Each code is reported once per file to keep output bounded.
 *
 * The shipped section library (workspace/business/growth/landing/) is deliberately clean of
 * every pattern here: it is aesthetic-neutral and token-driven, so a hit in a generated
 * business repo always traces to a per-launch choice, never to the template.
 *
 * npm script: check:vibecoded-tells
 * Usage: tsx validation/business/design/check-vibecoded-tells.ts --root /path/to/business
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { collectFiles, flagString, issue, parseFlags, reportAndExit, type Issue, type Severity } from "../../../tooling/lib/launch-state.js";

const flags = parseFlags(process.argv.slice(2), [{ flags: ["--root"], key: "root" }]);
const root = path.resolve(flagString(flags, "root") ?? ".");

const issues: Issue[] = [];

/** Web-surface directories the reference governs, relative to the business root. */
const SCAN_ROOTS = ["growth/landing", "growth/funnel", "web"];

const MARKUP_EXTENSIONS = new Set([".tsx", ".jsx", ".html"]);
const CODE_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".mts", ".js", ".mjs"]);
const STYLE_EXTENSIONS = new Set([".css", ".tsx", ".jsx", ".ts", ".js", ".html"]);
const ALL_EXTENSIONS = new Set([...MARKUP_EXTENSIONS, ...CODE_EXTENSIONS, ...STYLE_EXTENSIONS]);

interface Tell {
  code: string;
  severity: Severity;
  /** Extensions this tell scans; a file outside the set never fires it. */
  extensions: Set<string>;
  detect: (source: string) => boolean;
  message: string;
}

/**
 * Emoji-in-markup deliberately excludes ✓/✔ (the checkmark-wall rule owns those, and a
 * single checkmark is not a wall), ✨ (the sparkle rule owns it), and the ©/®/™ legal
 * marks Unicode also classifies as pictographic.
 */
const EMOJI_IN_MARKUP = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2764}\u{2B50}\u{2757}\u{2753}]/u;

const TELLS: Tell[] = [
  {
    code: "vibecode.default_icon_pack",
    severity: "error",
    extensions: CODE_EXTENSIONS,
    detect: (source) => /(?:from\s+|require\(\s*)["'](?:lucide-react|lucide|@heroicons\/)/.test(source),
    message:
      "Default icon pack import (Lucide/Heroicons) — the never-earned tell in knowledge/design/vibecoded-tells.md §Tier 2. Derive an icon system from the brand's own shapes instead.",
  },
  {
    code: "vibecode.emoji_in_markup",
    severity: "warning",
    extensions: MARKUP_EXTENSIONS,
    detect: (source) => EMOJI_IN_MARKUP.test(source),
    message:
      "Emoji inside web-surface markup. Emoji as icons or heading decoration is a vibecoded tell; only an explicit strategy/BRAND.md voice claim earns emoji, and never as functional icons.",
  },
  {
    code: "vibecode.default_font",
    severity: "warning",
    extensions: STYLE_EXTENSIONS,
    detect: (source) => !source.includes("font-rationale:") && /["'](?:Inter|Geist|Space Grotesk)["']/.test(source),
    message:
      'Inter/Geist/Space Grotesk without a rationale — the corpus default standing in for a typography decision. Add a "font-rationale:" comment pointing at the design/design.md type derivation, or derive a face.',
  },
  {
    code: "vibecode.indigo_purple_gradient",
    severity: "warning",
    extensions: STYLE_EXTENSIONS,
    detect: (source) =>
      /\bfrom-(?:indigo|violet|purple)-\d{2,3}\b[\s\S]{0,120}?\bto-(?:indigo|violet|purple|fuchsia)-\d{2,3}\b/.test(source) ||
      /gradient\([^)]*(?:#6366f1|#4f46e5|#818cf8)[^)]*(?:#7c3aed|#8b5cf6|#a855f7|#c084fc)/i.test(source) ||
      /gradient\([^)]*(?:#7c3aed|#8b5cf6|#a855f7|#c084fc)[^)]*(?:#6366f1|#4f46e5|#818cf8)/i.test(source),
    message:
      "Indigo-to-purple gradient — the documented statistical default of AI-generated pages. Earned only when the palette derivation names the gradient's role and its brand hues.",
  },
  {
    code: "vibecode.glassmorphism",
    severity: "warning",
    extensions: STYLE_EXTENSIONS,
    detect: (source) => /backdrop-blur|backdrop-filter\s*:/.test(source),
    message:
      "Glassmorphism (backdrop blur) — a borrowed costume outside its category. Earned by fintech-dashboard convention with a disciplined accent; record the derivation or remove it.",
  },
  {
    code: "vibecode.decorative_blob",
    severity: "warning",
    extensions: STYLE_EXTENSIONS,
    detect: (source) => /(?:blur-2xl|blur-3xl|filter\s*:\s*blur\()/.test(source) && /(?:rounded-full|radial-gradient)/.test(source),
    message:
      "Blurred radial orb / blob shapes — decorative filler for undecided space. Replace with product truth or nothing (knowledge/design/vibecoded-tells.md §Tier 2).",
  },
  {
    code: "vibecode.sparkle_icon",
    severity: "warning",
    extensions: ALL_EXTENSIONS,
    detect: (source) => /✨/.test(source) || /\bsparkles?[-_]?icon\b/i.test(source) || /name=["']sparkles?["']/i.test(source),
    message: 'Sparkle icon — the generic "AI" costume. Derive the brand system\'s own marker for generated content instead.',
  },
  {
    code: "vibecode.checkmark_wall",
    severity: "warning",
    extensions: MARKUP_EXTENSIONS,
    detect: (source) => (source.match(/[✓✔✅]/g) ?? []).length >= 3,
    message: "Checkmark bullet wall — feature-dump formatting that replaces persuasion. Keep short, verified capability lists; never the page's main argument.",
  },
  {
    code: "vibecode.bouncing_cue",
    severity: "warning",
    extensions: STYLE_EXTENSIONS,
    detect: (source) => /animate-bounce/.test(source) || /@keyframes\s+bounce\b/.test(source),
    message: "Bounce-animated arrow / scroll cue — motion that begs instead of guiding. Route the cue through the landing motion doctrine or remove it.",
  },
];

let scannedAnything = false;

for (const scanRoot of SCAN_ROOTS) {
  const absoluteScanRoot = path.join(root, scanRoot);
  if (!existsSync(absoluteScanRoot)) continue;

  const files = collectFiles(absoluteScanRoot, ALL_EXTENSIONS);
  if (files.length > 0) scannedAnything = true;

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const extension = path.extname(file);
    const relative = path.relative(root, file);
    for (const tell of TELLS) {
      if (!tell.extensions.has(extension)) continue;
      if (!tell.detect(source)) continue;
      issues.push(issue(tell.severity, tell.code, tell.message, relative));
    }
  }

  checkLegalLinks(absoluteScanRoot, scanRoot, files);
}

/**
 * Terms/privacy links are required only once the landing is site-shaped — a deployable page,
 * not the bare section component library. The site-shape signals mirror
 * check-landing-funnel.ts so the two gates agree on when a landing "exists".
 */
function checkLegalLinks(absoluteScanRoot: string, scanRoot: string, files: string[]): void {
  const siteShaped =
    existsSync(path.join(absoluteScanRoot, "index.html")) ||
    existsSync(path.join(absoluteScanRoot, "package.json")) ||
    existsSync(path.join(absoluteScanRoot, "app")) ||
    existsSync(path.join(absoluteScanRoot, "pages"));
  if (!siteShaped) return;

  const markup = files.filter((file) => MARKUP_EXTENSIONS.has(path.extname(file)));
  const combined = markup.map((file) => readFileSync(file, "utf8")).join("\n");
  const hasTerms = /href=["'][^"']*terms/i.test(combined);
  const hasPrivacy = /href=["'][^"']*privacy/i.test(combined);
  for (const [present, name, artifact] of [
    [hasTerms, "terms", "trust/TERMS.md"],
    [hasPrivacy, "privacy", "trust/PRIVACY.md"],
  ] as const) {
    if (present) continue;
    issues.push(
      issue(
        "error",
        "vibecode.legal_links_missing",
        `Site-shaped landing under ${scanRoot}/ links no ${name} page. A missing ${name} link is a Tier 1 trust breaker; publish ${artifact} and link it from the footer.`,
        scanRoot,
      ),
    );
  }
}

const title = scannedAnything ? "Vibecoded tells: mechanical smell scan" : "Vibecoded tells: mechanical smell scan (no web-surface source in scope)";
reportAndExit(title, issues);
