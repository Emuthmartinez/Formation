#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { asString, isRecord, reportAndExit, type Issue } from "./lib/launch-state.js";
import { getToken, loadDesignState, parseDesignCliArgs, rel } from "./lib/design-state.js";

const args = parseDesignCliArgs(process.argv.slice(2));
const loaded = loadDesignState(args);
const issues: Issue[] = [...loaded.issues];

// motion.durationCelebrate joined the scale in v0.43.0. A pre-v0.43 state file
// would otherwise promote a zero-duration celebrate spring and an empty CSS
// variable silently — require the token before writing anything.
const celebrateRaw = String(getToken(loaded.tokens, "motion.durationCelebrate") ?? "").trim();
if (loaded.tokens && !/^\d+(?:\.\d+)?ms$/i.test(celebrateRaw)) {
  issues.push({
    severity: "error",
    code: "token_promotion.celebrate_token_missing",
    message:
      'studio/seed/theme.tokens.json must define motion.durationCelebrate (e.g. "500ms"; added in v0.43.0) before promotion — a missing value would silently disable celebration motion.',
  });
} else if (loaded.tokens) {
  const outputDir = path.join(args.root, "design/system");
  const tokenHash = hashTokens(loaded.tokens);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    path.join(outputDir, "tokens.json"),
    `${JSON.stringify({ tokenHash, source: "studio/seed/theme.tokens.json", ...asObject(loaded.tokens) }, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(path.join(outputDir, "tokens.css"), renderCss(loaded.tokens, tokenHash), "utf8");
  writeFileSync(path.join(outputDir, "DesignTokens.swift"), renderSwift(loaded.tokens, tokenHash), "utf8");
  console.log(`Promoted design tokens to ${rel(args.root, outputDir)} with hash ${tokenHash}`);
}

reportAndExit("Design token promotion", issues);

function asObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function hashTokens(tokens: unknown): string {
  return createHash("sha256").update(JSON.stringify(tokens)).digest("hex").slice(0, 16);
}

function renderCss(tokens: unknown, tokenHash: string): string {
  const cssVars: Array<readonly [string, string]> = [
    ["color-background", "color.background"],
    ["color-surface", "color.surface"],
    ["color-surface-elevated", "color.surfaceElevated"],
    ["color-primary", "color.primary"],
    ["color-accent", "color.accent"],
    ["color-text", "color.text"],
    ["color-muted", "color.muted"],
    ["color-border", "color.border"],
    ["color-success", "color.success"],
    ["color-warning", "color.warning"],
    ["color-danger", "color.danger"],
    ["font-display", "font.display.family"],
    ["font-body", "font.body.family"],
    ["radius-sm", "radius.sm"],
    ["radius-md", "radius.md"],
    ["radius-lg", "radius.lg"],
    ["space-xs", "space.xs"],
    ["space-sm", "space.sm"],
    ["space-md", "space.md"],
    ["space-lg", "space.lg"],
    ["space-xl", "space.xl"],
    ["motion-duration-fast", "motion.durationFast"],
    ["motion-duration-base", "motion.durationBase"],
    ["motion-duration-slow", "motion.durationSlow"],
    // Celebrate-family spring duration (premium-mobile-craft.md §1): carried by
    // the PremiumMotion.celebrate/.celebrateLanding presets on mobile; promoted
    // to CSS so web celebration moments read the same 500ms spine.
    ["motion-duration-celebrate", "motion.durationCelebrate"],
    ["motion-duration-reduced", "motion.reducedMotionDuration"],
    ["motion-easing", "motion.easing"],
    // Landing/web cinematic lane (knowledge/design/landing-motion-craft.md): hero
    // word reveals, scroll choreography, and stagger share these tokens with
    // the Remotion baked-asset lane so one brand timing system spans both.
    ["motion-duration-reveal", "motion.durationReveal"],
    ["motion-duration-cinematic", "motion.durationCinematic"],
    ["motion-easing-emphasis", "motion.easingEmphasis"],
    ["motion-easing-spring", "motion.easingSpring"],
    ["motion-stagger", "motion.stagger"],
  ];

  return [
    `/* design-token-hash: ${tokenHash} */`,
    ":root {",
    ...cssVars.map(([name, tokenPath]) => `  --${name}: ${String(getToken(tokens, tokenPath) ?? "")};`),
    "}",
    "",
  ].join("\n");
}

function renderSwift(tokens: unknown, tokenHash: string): string {
  const displayFont = stringLiteral(asString(getToken(tokens, "font.display.family")) ?? "");
  const bodyFont = stringLiteral(asString(getToken(tokens, "font.body.family")) ?? "");
  return [
    `// design-token-hash: ${tokenHash}`,
    "import Foundation",
    "",
    "enum DesignTokens {",
    "  enum Color {",
    `    static let background = "${String(getToken(tokens, "color.background") ?? "")}"`,
    `    static let surface = "${String(getToken(tokens, "color.surface") ?? "")}"`,
    `    static let primary = "${String(getToken(tokens, "color.primary") ?? "")}"`,
    `    static let accent = "${String(getToken(tokens, "color.accent") ?? "")}"`,
    `    static let text = "${String(getToken(tokens, "color.text") ?? "")}"`,
    "  }",
    "  enum Font {",
    `    static let displayFamily = ${displayFont}`,
    `    static let bodyFamily = ${bodyFont}`,
    "  }",
    "  enum Radius {",
    `    static let sm = "${String(getToken(tokens, "radius.sm") ?? "")}"`,
    `    static let md = "${String(getToken(tokens, "radius.md") ?? "")}"`,
    `    static let lg = "${String(getToken(tokens, "radius.lg") ?? "")}"`,
    "  }",
    "  // Cross-platform motion contract. Durations are SwiftUI seconds (Double).",
    "  // framer-motion/motion consumes the CSS-variable form; SwiftUI/Flutter consume these.",
    "  enum Motion {",
    `    static let durationFast: Double = ${msToSeconds(getToken(tokens, "motion.durationFast"))}`,
    `    static let durationBase: Double = ${msToSeconds(getToken(tokens, "motion.durationBase"))}`,
    `    static let durationSlow: Double = ${msToSeconds(getToken(tokens, "motion.durationSlow"))}`,
    "    // Celebrate-family spring duration: earned moments only, carried by the",
    "    // PremiumMotion.celebrate / .celebrateLanding presets (PremiumCraft.swift).",
    `    static let durationCelebrate: Double = ${msToSeconds(getToken(tokens, "motion.durationCelebrate"))}`,
    `    static let reducedMotionDuration: Double = ${msToSeconds(getToken(tokens, "motion.reducedMotionDuration"))}`,
    `    static let easing = "${String(getToken(tokens, "motion.easing") ?? "")}"`,
    "    // Landing/web cinematic lane tokens. The mobile binary keeps to the",
    "    // 120-360ms micro-motion band above; these ship so cross-surface tools",
    "    // read one timing contract (see knowledge/design/landing-motion-craft.md).",
    `    static let durationReveal: Double = ${msToSeconds(getToken(tokens, "motion.durationReveal"))}`,
    `    static let durationCinematic: Double = ${msToSeconds(getToken(tokens, "motion.durationCinematic"))}`,
    `    static let stagger: Double = ${msToSeconds(getToken(tokens, "motion.stagger"))}`,
    `    static let easingEmphasis = "${String(getToken(tokens, "motion.easingEmphasis") ?? "")}"`,
    `    static let easingSpring = "${String(getToken(tokens, "motion.easingSpring") ?? "")}"`,
    "  }",
    "}",
    "",
  ].join("\n");
}

function msToSeconds(value: unknown): string {
  const raw = String(value ?? "").trim();
  const milliseconds = Number.parseFloat(raw.replace(/ms$/i, ""));
  if (!Number.isFinite(milliseconds)) {
    return "0";
  }
  const seconds = milliseconds / 1000;
  return Number.isInteger(seconds) ? seconds.toFixed(1) : String(seconds);
}

function stringLiteral(value: string): string {
  return JSON.stringify(value);
}
