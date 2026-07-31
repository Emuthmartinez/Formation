#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit } from "../../scripts/lib/launch-state.js";

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

const designStatus = state ? asString(getPath(state, "lanes.design.status")) : undefined;
const skip = designStatus === "not_needed" || designStatus === "deferred";
const markdown = firstExistingText(["UX_PATTERNS.md", "ux-patterns/UX_PATTERNS.md"]);
const htmlPath = existsAny(["ux-patterns.html", "ux-patterns/ux-patterns.html", "design.html"]);

if (!skip && !markdown) {
  issues.push(
    issue("error", "ux_patterns.markdown_missing", "UX_PATTERNS.md is required to record Refero or approved fallback UX pattern decisions.", "UX_PATTERNS.md"),
  );
}

if (markdown) {
  const requiredPhrases = [
    "Refero Route",
    "Pattern Inventory",
    "Flow Map",
    "State Matrix",
    "Bug Traps",
    "Onboarding Playbook",
    "Do not copy",
    "Motion Consistency",
    "Reduced Motion",
  ];
  for (const phrase of requiredPhrases) {
    if (!markdown.text.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push(
        issue("error", `ux_patterns.${phrase.replaceAll(" ", "_").toLowerCase()}.missing`, `UX_PATTERNS.md should include ${phrase}.`, markdown.relativePath),
      );
    }
  }

  const impliesFallback = /\b(refero unavailable|refero missing|no refero|fallback route|free baseline route|bundled baseline)\b/i.test(markdown.text);
  const hasApproval = /\b(founder approval|founder-approved|approved fallback|fallback approved|blocked waiting for access)\b/i.test(markdown.text);
  if (impliesFallback && !hasApproval) {
    issues.push(
      issue(
        "error",
        "ux_patterns.refero_fallback_unapproved",
        "Refero fallback language is present, but founder approval or blocked-access state is not recorded.",
        markdown.relativePath,
      ),
    );
  }

  if (/\b(TODO|TBD|unknown|placeholder)\b/i.test(markdown.text) && /\b(status:\s*done|launch-ready|complete)\b/i.test(markdown.text)) {
    issues.push(
      issue(
        "error",
        "ux_patterns.placeholder_complete",
        "UX_PATTERNS.md cannot claim done/complete while placeholder language remains.",
        markdown.relativePath,
      ),
    );
  }
}

if (!skip && !htmlPath) {
  issues.push(
    issue(
      "warning",
      "ux_patterns.html_missing",
      "ux-patterns.html or design.html should render the pattern inventory, flow maps, and state matrix.",
      "ux-patterns.html",
    ),
  );
}

reportAndExit("UX pattern packet check", issues);
