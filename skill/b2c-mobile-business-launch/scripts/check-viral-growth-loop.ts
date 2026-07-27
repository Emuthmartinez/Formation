#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit } from "./lib/launch-state.js";

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

const growthStatus = state ? asString(getPath(state, "lanes.growth.status"))?.toLowerCase() : undefined;
const skip = growthStatus === "not_needed" || growthStatus === "deferred";
const markdown = firstExistingText(["VIRAL_GROWTH.md", "growth/VIRAL_GROWTH.md"]);
const formatLabPath = existsAny(["growth/format-lab.csv", "ugc/script-bank.md", "FASTLANE_OPS.md"]);

if (!skip && !markdown) {
  issues.push(
    issue(
      "error",
      "viral_growth.markdown_missing",
      "VIRAL_GROWTH.md is required when the growth lane depends on referral, share, social, creator, or viral product loops.",
      "VIRAL_GROWTH.md",
    ),
  );
}

if (markdown) {
  const requiredPhrases = [
    "Fit Gate",
    "Growth Thesis",
    "Product Loop",
    "Referral Or Share Mechanic",
    "Content Loop",
    "Format Lab",
    "Monetization Timing",
    "Measurement Plan",
    "Loop Economics",
    "Stop And Scale Rules",
    "Founder-Only Gates",
    "Traceability",
  ];
  for (const phrase of requiredPhrases) {
    if (!includes(markdown.text, phrase)) {
      issues.push(issue("error", `viral_growth.${codeFor(phrase)}.missing`, `VIRAL_GROWTH.md should include ${phrase}.`, markdown.relativePath));
    }
  }

  const requiredRefs = ["ANALYTICS.md", "ONBOARDING.md", "REVENUE_OPS.md", "UGC_PLAYBOOK.md", "LAUNCH_TRACE.md", "11_STAR_EXPERIENCE.md"];
  for (const ref of requiredRefs) {
    if (!markdown.text.includes(ref)) {
      issues.push(issue("error", `viral_growth.ref_${codeFor(ref)}.missing`, `VIRAL_GROWTH.md should reference ${ref}.`, markdown.relativePath));
    }
  }

  if (!mentionsAny(markdown.text, ["referral", "share", "invite", "creator_code"])) {
    issues.push(
      issue(
        "error",
        "viral_growth.loop_mechanic.missing",
        "The growth contract should name the referral, share, invite, or creator-code loop it will test or explicitly reject.",
        markdown.relativePath,
      ),
    );
  }

  if (!mentionsAny(markdown.text, ["abuse", "fraud", "duplicate", "self-referral", "rate limit"])) {
    issues.push(
      issue(
        "error",
        "viral_growth.abuse_controls.missing",
        "Referral/share loops should include abuse, fraud, duplicate, self-referral, or rate-limit controls.",
        markdown.relativePath,
      ),
    );
  }

  if (!mentionsAny(markdown.text, ["paywall", "purchase", "revenue", "RevenueCat", "Stripe"])) {
    issues.push(
      issue(
        "error",
        "viral_growth.monetization_link.missing",
        "Viral growth should link attention to paywall, purchase, revenue, RevenueCat, or Stripe behavior.",
        markdown.relativePath,
      ),
    );
  }

  if (!mentionsAny(markdown.text, ["PostHog", "event", "dashboard", "analytics-plan.html"])) {
    issues.push(
      issue("error", "viral_growth.analytics_link.missing", "Viral growth should define event/dashboard proof, not only content ideas.", markdown.relativePath),
    );
  }

  if (growthStatus === "done" && /\b(TODO|TBD|unknown|placeholder|pending)\b/i.test(markdown.text)) {
    issues.push(
      issue(
        "error",
        "viral_growth.placeholder_complete",
        "Viral growth cannot be done while TODO/TBD/unknown/placeholder/pending language remains.",
        markdown.relativePath,
      ),
    );
  }
}

if (growthStatus === "done" && markdown) {
  // Heading-only loop economics preserves the exact regression this contract
  // prevents: shares counted without computing whether the loop compounds. At
  // done, the Loop Economics region needs a measured k, a dated measured row,
  // or a dated first-measurement commitment — guidance prose with incidental
  // digits satisfies nothing.
  // Anchor to the real section start — a table-of-contents mention must not
  // open the region early and orphan the measured section below it.
  const loopHeading = /^#{1,3}\s*loop economics|^loop economics\s*:/im.exec(markdown.text);
  const loopIndex = loopHeading ? loopHeading.index : markdown.text.toLowerCase().indexOf("loop economics");
  // The region ends at the next section boundary — a dated numeric row in a
  // later section (Traceability) must not read as a loop measurement.
  const loopRegion = ((): string => {
    if (loopIndex === -1) return "";
    const lower = markdown.text.toLowerCase();
    const boundaries = [markdown.text.indexOf("\n## ", loopIndex + 1), lower.indexOf("stop and scale rules", loopIndex + 14)].filter((index) => index !== -1);
    const end = boundaries.length > 0 ? Math.min(...boundaries) : markdown.text.length;
    return markdown.text.slice(loopIndex, end);
  })();
  const validCalendarDate = (raw: string, allowFuture: boolean): boolean => {
    const date = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return false;
    if (allowFuture) return date.getTime() <= Date.now() + 60 * 86_400_000; // a due date defers at most 60 days
    return date.getTime() <= Date.now();
  };
  const loopLines = loopRegion.split(/\r?\n/);
  // A target is not a measurement: k-value lines carrying aspiration language
  // do not count.
  const measuredKLine = loopLines.some((line) => /\bk\s*(=|at|:)\s*\d/i.test(line) && !/\b(target|goal|aim|aspir\w*|hope|planned? for)\b/i.test(line));
  const commitmentMatch = loopRegion.match(/first (?:weekly )?k (?:computation|measurement)[^\n]*?(\d{4}-\d{2}-\d{2})/i);
  const commitmentValid = Boolean(commitmentMatch && validCalendarDate(commitmentMatch[1] ?? "", true));
  const measuredRowMatch = loopRegion.match(/\|\s*(\d{4}-\d{2}-\d{2})\s*\|[^\n]*\d/);
  const measuredRowValid = Boolean(measuredRowMatch && validCalendarDate(measuredRowMatch[1] ?? "", false));
  const loopMeasured = measuredKLine || commitmentValid || measuredRowValid;
  if (loopIndex !== -1 && !loopMeasured) {
    issues.push(
      issue(
        "error",
        "viral_growth.loop_economics_unmeasured",
        "The Loop Economics section carries no measured k, dated measured row, or dated first-measurement commitment. " +
          "The heading without the number is counting shares with extra steps — record k = <value>, a dated weekly row, or " +
          "'first weekly k computation due YYYY-MM-DD'.",
        markdown.relativePath,
      ),
    );
  }

  // Post-breakout scale contract: a UGC playbook that stops at the Day-0
  // roster is the known miss. When the playbook exists, it must carry the
  // scale-band model with founder-gated budget steps.
  const ugcPlaybook = firstExistingText(["UGC_PLAYBOOK.md", "ugc/UGC_PLAYBOOK.md"]);
  const ugcNotApplicable = /creator (content|loop)[^\n]*\b(not in scope|not applicable|rejected)\b/i.test(markdown.text);
  if (!ugcPlaybook && !ugcNotApplicable) {
    issues.push(
      issue(
        "error",
        "viral_growth.ugc_playbook_missing",
        "The growth lane is done but UGC_PLAYBOOK.md is absent. Create it (with its Post-Breakout Scale Model), or record creator " +
          "content as not in scope in VIRAL_GROWTH.md — a missing playbook is the Day-0 ceiling with the evidence deleted.",
        "UGC_PLAYBOOK.md",
      ),
    );
  }
  const ugcScaleSubstantive = ((): boolean => {
    if (!ugcPlaybook) return true;
    const scaleIndex = ugcPlaybook.text.toLowerCase().search(/post-breakout|scale model/);
    if (scaleIndex === -1) return false;
    const region = ugcPlaybook.text.slice(scaleIndex, scaleIndex + 1500);
    // A band counts only with a roster/volume number beside it — labels
    // without numbers define nothing, and bare "founder" is not a budget gate.
    const numberedBands = ["discovery", "proven", "scale", "volume"].filter((band) =>
      new RegExp(`(\\d[^\\n]{0,20}\\b${band}\\b|\\b${band}\\b[^\\n]{0,20}\\d)`, "i").test(region),
    ).length;
    return numberedBands >= 3 && /founder[- ]?gated|budget/i.test(region) && /install[- ]per[- ]video|fatigue/i.test(region);
  })();
  if (ugcPlaybook && !ugcScaleSubstantive) {
    issues.push(
      issue(
        "error",
        "viral_growth.ugc_scale_model_missing",
        `${ugcPlaybook.relativePath} has no Post-Breakout Scale Model (roster bands with founder-gated budget steps and fatigue measurement, ` +
          `per ugc-creator-engine.md). A playbook that stops at the 3-5 creator discovery roster leaves the scaled state undefined — ` +
          `the exact Day-0 ceiling the audit found.`,
        ugcPlaybook.relativePath,
      ),
    );
  }
}

if (growthStatus === "done" && !formatLabPath) {
  issues.push(
    issue(
      "error",
      "viral_growth.format_lab_missing_done",
      "A done growth lane should include growth/format-lab.csv, ugc/script-bank.md, or FASTLANE_OPS.md as repeatable format evidence.",
      "growth/format-lab.csv",
    ),
  );
}

reportAndExit("Viral growth loop check", issues);
