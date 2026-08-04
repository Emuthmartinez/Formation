#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getToken, loadDesignState, parseDesignCliArgs, rel } from "../../../tooling/lib/design-state.js";
import { collectAllFiles, issue, reportAndExit, type Issue } from "../../../tooling/lib/launch-state.js";

const args = parseDesignCliArgs(process.argv.slice(2));
const issues: Issue[] = [];
const designArtifacts = collectDesignArtifacts(args.root);
const hasDesignState = existsSync(args.statePath) && existsSync(args.tokensPath);

if (designArtifacts.length > 0 && !hasDesignState) {
  issues.push(
    issue(
      "error",
      "design_room.state_missing_for_artifacts",
      `Design artifacts exist without studio/seed/business.json and studio/seed/theme.tokens.json: ${designArtifacts.slice(0, 6).join(", ")}`,
      args.root,
    ),
  );
}

if (hasDesignState) {
  const loaded = loadDesignState(args);
  issues.push(...loaded.issues);

  if (loaded.tokens) {
    // WCAG AA contrast check on the tokenized palette, mirroring the ui-ux-pro-max
    // pre-delivery checklist (body text >= 4.5:1, large/UI accent >= 3:1). Warning only:
    // the lowest-cost place to catch a contrast regression is here, before Xcode/Flutter.
    const background = String(getToken(loaded.tokens, "color.background") ?? "");
    const text = String(getToken(loaded.tokens, "color.text") ?? "");
    const primary = String(getToken(loaded.tokens, "color.primary") ?? "");
    const textRatio = contrastRatio(text, background);
    if (textRatio !== undefined && textRatio < 4.5) {
      issues.push(
        issue(
          "warning",
          "design_room.contrast_text",
          `color.text on color.background is ${textRatio.toFixed(2)}:1 (WCAG AA body text needs >= 4.5:1).`,
          "studio/seed/theme.tokens.json",
        ),
      );
    }
    const primaryRatio = contrastRatio(primary, background);
    if (primaryRatio !== undefined && primaryRatio < 3) {
      issues.push(
        issue(
          "warning",
          "design_room.contrast_primary",
          `color.primary on color.background is ${primaryRatio.toFixed(2)}:1 (large text / UI accents need >= 3:1).`,
          "studio/seed/theme.tokens.json",
        ),
      );
    }
  }

  if (loaded.state && loaded.stateHash) {
    const renderPath = path.join(args.root, "design/design-room.html");
    if (!existsSync(renderPath)) {
      issues.push(
        issue(
          "error",
          "design_room.render_missing",
          "design/design-room.html must be rendered from state before design is claimed ready.",
          rel(args.root, renderPath),
        ),
      );
    } else {
      const html = readFileSync(renderPath, "utf8");
      const match = html.match(/<meta name="design-state-hash" content="([^"]+)"/);
      if (!match) {
        issues.push(
          issue("error", "design_room.render_hash_missing", "design/design-room.html must include the design-state-hash meta tag.", rel(args.root, renderPath)),
        );
      } else if (match[1] !== loaded.stateHash) {
        issues.push(
          issue(
            "error",
            "design_room.render_stale",
            `design/design-room.html hash ${match[1]} does not match current state hash ${loaded.stateHash}. Re-run render-design-room.ts.`,
            rel(args.root, renderPath),
          ),
        );
      }
    }
  }
}

for (const artifact of designArtifacts) {
  if (/design[-_ ]?(proposal|concept)|visual[-_ ]?proof|mood[-_ ]?board|design-v\d+/i.test(path.basename(artifact))) {
    issues.push(
      issue(
        "error",
        "design_room.freeform_design_artifact",
        "Design proposal artifacts must be represented as state mutations and rendered through Design Room, not one-off proposal files.",
        artifact,
      ),
    );
  }
}

reportAndExit("Design Room contract validation", issues);

function collectDesignArtifacts(root: string): string[] {
  const ignoredSegments = new Set(["node_modules", ".git", "dist", "state", "render"]);
  return collectAllFiles(root)
    .map((filePath) => path.relative(root, filePath))
    .filter((relativePath) => !relativePath.split(path.sep).some((segment) => ignoredSegments.has(segment)))
    .filter((relativePath) => {
      const normalized = relativePath.replaceAll(path.sep, "/");
      return [
        /(^|\/)DESIGN\.md$/i,
        /(^|\/)design\.md$/i,
        /(^|\/)design\.html$/i,
        /(^|\/)UX_PATTERNS\.md$/i,
        /(^|\/)ux-patterns\.html$/i,
        /(^|\/)design[-_ ]?(proposal|concept|v\d+).*\.(md|html)$/i,
        /(^|\/)visual[-_ ]?proof.*\.(md|html)$/i,
        /(^|\/)mood[-_ ]?board.*\.(md|html)$/i,
      ].some((pattern) => pattern.test(normalized));
    });
}

function parseHex(value: string): [number, number, number] | undefined {
  const captured = value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (!captured) {
    return undefined;
  }
  const hex =
    captured.length === 3
      ? captured
          .split("")
          .map((char) => char + char)
          .join("")
      : captured;
  return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number): number => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(foreground: string, background: string): number | undefined {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (!fg || !bg) {
    return undefined;
  }
  const lighter = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const darker = Math.min(relativeLuminance(fg), relativeLuminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}
