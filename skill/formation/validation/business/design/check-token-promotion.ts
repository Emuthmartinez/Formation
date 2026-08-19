#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getToken, loadDesignState, parseDesignCliArgs } from "../../../tooling/lib/design-state.js";
import { issue, reportAndExit, type Issue } from "../../../tooling/lib/launch-state.js";

const args = parseDesignCliArgs(process.argv.slice(2));
const loaded = loadDesignState(args);
const issues: Issue[] = [...loaded.issues];

if (loaded.tokens) {
  const expectedHash = hashTokens(loaded.tokens);
  const designSystemDir = path.join(args.root, "design/system");
  const tokenJsonPath = path.join(designSystemDir, "tokens.json");
  const cssPath = path.join(designSystemDir, "tokens.css");
  const swiftPath = path.join(designSystemDir, "DesignTokens.swift");

  for (const filePath of [tokenJsonPath, cssPath, swiftPath]) {
    if (!existsSync(filePath)) {
      issues.push(
        issue(
          "error",
          "token_promotion.output_missing",
          `Missing promoted token output: ${path.relative(args.root, filePath)}`,
          path.relative(args.root, filePath),
        ),
      );
    }
  }

  if (existsSync(tokenJsonPath)) {
    try {
      const promoted = JSON.parse(readFileSync(tokenJsonPath, "utf8")) as { tokenHash?: unknown };
      if (promoted.tokenHash !== expectedHash) {
        issues.push(
          issue(
            "error",
            "token_promotion.json_stale",
            "design/system/tokens.json hash does not match studio/seed/theme.tokens.json.",
            "studio/generated/system/tokens.json",
          ),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push(
        issue("error", "token_promotion.json_invalid", `design/system/tokens.json is invalid JSON: ${message}`, "studio/generated/system/tokens.json"),
      );
    }
  }

  if (existsSync(cssPath)) {
    const css = readFileSync(cssPath, "utf8");
    if (!css.includes(`design-token-hash: ${expectedHash}`)) {
      issues.push(
        issue("error", "token_promotion.css_stale", "design/system/tokens.css hash does not match studio/seed/theme.tokens.json.", "design/system/tokens.css"),
      );
    }
    for (const tokenPath of ["color.background", "color.primary", "color.accent", "color.text", "radius.md", "space.md"]) {
      const varName = `--${tokenPath.replace(".", "-").replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
      if (!css.includes(varName) || !css.includes(String(getToken(loaded.tokens, tokenPath) ?? ""))) {
        issues.push(issue("error", "token_promotion.css_var_missing", `tokens.css must include ${varName}.`, "design/system/tokens.css"));
      }
    }
    // The celebrate duration is value-checked, not just name-checked: a
    // pre-v0.43 state file promoted with a lenient renderer would emit
    // "--motion-duration-celebrate: ;" and a zero Swift member, silently
    // disabling celebration motion.
    const celebrateCss = css.match(/--motion-duration-celebrate:\s*([^;]*);/);
    const celebrateCssValue = celebrateCss ? (celebrateCss[1] ?? "").trim() : "";
    if (!/^\d+(?:\.\d+)?ms$/i.test(celebrateCssValue) || Number.parseFloat(celebrateCssValue) <= 0) {
      issues.push(
        issue(
          "error",
          "token_promotion.celebrate_css_invalid",
          `tokens.css must promote --motion-duration-celebrate with a positive millisecond value (found "${celebrateCssValue || "nothing"}").`,
          "design/system/tokens.css",
        ),
      );
    }
    for (const motionVar of [
      "--motion-duration-fast",
      "--motion-duration-base",
      "--motion-duration-celebrate",
      "--motion-easing",
      "--motion-duration-reveal",
      "--motion-duration-cinematic",
      "--motion-easing-emphasis",
      "--motion-easing-spring",
      "--motion-stagger",
    ]) {
      if (!css.includes(motionVar)) {
        issues.push(
          issue(
            "error",
            "token_promotion.css_motion_missing",
            `tokens.css must promote ${motionVar} so web surfaces (framer-motion/motion, landing, funnel) share the tokenized motion scale.`,
            "design/system/tokens.css",
          ),
        );
      }
    }
  }

  if (existsSync(swiftPath)) {
    const swift = readFileSync(swiftPath, "utf8");
    if (!swift.includes(`design-token-hash: ${expectedHash}`)) {
      issues.push(
        issue(
          "error",
          "token_promotion.swift_stale",
          "DesignTokens.swift hash does not match studio/seed/theme.tokens.json.",
          "studio/generated/system/DesignTokens.swift",
        ),
      );
    }
    if (!swift.includes("enum DesignTokens") || !swift.includes(String(getToken(loaded.tokens, "color.primary") ?? ""))) {
      issues.push(
        issue(
          "error",
          "token_promotion.swift_contract_missing",
          "DesignTokens.swift must expose DesignTokens and the current primary color.",
          "studio/generated/system/DesignTokens.swift",
        ),
      );
    }
    const celebrateSwift = swift.match(/static let durationCelebrate: Double = (\d+(?:\.\d+)?)/);
    if (!celebrateSwift || Number(celebrateSwift[1]) <= 0) {
      issues.push(
        issue(
          "error",
          "token_promotion.celebrate_swift_invalid",
          "DesignTokens.swift must expose a positive DesignTokens.Motion.durationCelebrate — a zero value silently disables celebration motion.",
          "studio/generated/system/DesignTokens.swift",
        ),
      );
    }
    if (!swift.includes("enum Motion") || !swift.includes("durationBase")) {
      issues.push(
        issue(
          "error",
          "token_promotion.swift_motion_missing",
          "DesignTokens.swift must expose a Motion enum so the shipped SwiftUI app shares the tokenized motion scale (durations/easing) with web surfaces.",
          "studio/generated/system/DesignTokens.swift",
        ),
      );
    }
  }
}

reportAndExit("Design token promotion check", issues);

function hashTokens(tokens: unknown): string {
  return createHash("sha256").update(JSON.stringify(tokens)).digest("hex").slice(0, 16);
}
