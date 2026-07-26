#!/usr/bin/env node
import { existsSync } from "node:fs";
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

const status = state ? asString(getPath(state, "lanes.paid_user_acquisition.status"))?.toLowerCase() : undefined;
const skip = status === "not_needed" || status === "deferred";
const markdown = firstExistingText(["PAID_UA.md", "growth/PAID_UA.md"]);
const reportPath = existsAny(["growth/paid-ua-report.csv", "growth/paid-ua-report.md", "PAID_UA_REPORT.md"]);

if (!skip && !markdown) {
  issues.push(issue("error", "paid_ua.markdown_missing", "PAID_UA.md is required when the paid user acquisition lane is active.", "PAID_UA.md"));
}

if (markdown) {
  const requiredPhrases = [
    "Fit Gate",
    "Channel Choice",
    "Creative Production",
    "Tracking Baseline",
    "Blended Report",
    "Weekly Schedule",
    "Stop And Scale Rules",
    "Founder-Only Gates",
    "Traceability",
    // The four numbers stop/scale evaluates against — without them the rules
    // are vibes, and a weekly report cannot be judged mechanically.
    "Decision Thresholds",
    "Attribution tolerance",
    "Payback window",
    "Creative signal floor",
    "Scale trigger",
  ];
  for (const phrase of requiredPhrases) {
    if (!includes(markdown.text, phrase)) {
      issues.push(issue("error", `paid_ua.${codeFor(phrase)}.missing`, `PAID_UA.md should include ${phrase}.`, markdown.relativePath));
    }
  }

  const requiredRefs = ["ANALYTICS.md", "REVENUE_OPS.md", "CONTENT_ASSETS.md", "APP_STORE_LISTING.md", "LAUNCH_TRACE.md", "11_STAR_EXPERIENCE.md"];
  for (const ref of requiredRefs) {
    if (!markdown.text.includes(ref)) {
      issues.push(issue("error", `paid_ua.ref_${codeFor(ref)}.missing`, `PAID_UA.md should reference ${ref}.`, markdown.relativePath));
    }
  }

  if (!mentionsAny(markdown.text, ["one-channel", "one channel", "single channel", "selected channel"])) {
    issues.push(
      issue(
        "error",
        "paid_ua.one_channel_rule.missing",
        "Paid UA should require a one-channel starting strategy or a documented exception.",
        markdown.relativePath,
      ),
    );
  }

  if (!mentionsAny(markdown.text, ["Meta", "TikTok", "Google", "Apple Ads", "Apple Search Ads"])) {
    issues.push(
      issue("error", "paid_ua.channel_options.missing", "Paid UA should consider Meta, TikTok, Google, or Apple Ads channel fit.", markdown.relativePath),
    );
  }

  if (!mentionsAny(markdown.text, ["RevenueCat", "LTV", "cohort", "trial start", "entitlement"])) {
    issues.push(
      issue(
        "error",
        "paid_ua.revenuecat_ltv.missing",
        "Paid UA should connect CPA decisions to RevenueCat LTV, cohorts, trials, purchases, or entitlements.",
        markdown.relativePath,
      ),
    );
  }

  if (!mentionsAny(markdown.text, ["App Store Connect", "Google Play", "PostHog", "self-reported attribution", "ad-network SDK", "MMP"])) {
    issues.push(
      issue(
        "error",
        "paid_ua.tracking_layers.missing",
        "Paid UA should define the store, analytics, ad-network, MMP, or self-reported attribution layers.",
        markdown.relativePath,
      ),
    );
  }

  if (!mentionsAny(markdown.text, ["baseline", "uplift", "blended report", "paid-ua-report"])) {
    issues.push(
      issue("error", "paid_ua.baseline_report.missing", "Paid UA should define baseline/uplift measurement and a blended report.", markdown.relativePath),
    );
  }

  if (!mentionsAny(markdown.text, ["3-5", "creative", "asset", "angle"])) {
    issues.push(
      issue("error", "paid_ua.creative_cadence.missing", "Paid UA should define creative cadence, asset volume, or angle testing.", markdown.relativePath),
    );
  }

  if (!mentionsAny(markdown.text, ["Monday", "Tuesday", "Wednesday", "Friday", "twice-weekly", "weekly"])) {
    issues.push(
      issue("error", "paid_ua.schedule.missing", "Paid UA should define a weekly operating cadence instead of reactive daily changes.", markdown.relativePath),
    );
  }

  if (!mentionsAny(markdown.text, ["founder approval", "founder-only", "budget", "spend"])) {
    issues.push(
      issue(
        "error",
        "paid_ua.spend_gate.missing",
        "Paid UA should keep ad spend, budget changes, and account connections as founder-only gates.",
        markdown.relativePath,
      ),
    );
  }

  if (!mentionsAny(markdown.text, ["Virality Predictor", "brain_activity", "virality score", "virality_score", "virality scoring not applicable"])) {
    issues.push(
      issue(
        "error",
        "paid_ua.virality_gate.missing",
        'Paid UA should score video creatives with the Virality Predictor (brain_activity) before paid distribution, or record an explicit "virality scoring not applicable" exception with a reason.',
        markdown.relativePath,
      ),
    );
  }

  if (status === "done" && /\b(TODO|TBD|unknown|placeholder|pending)\b/i.test(markdown.text)) {
    issues.push(
      issue(
        "error",
        "paid_ua.placeholder_complete",
        "Paid UA cannot be done while TODO/TBD/unknown/placeholder/pending language remains.",
        markdown.relativePath,
      ),
    );
  }

  // A done lane needs threshold VALUES, not labels: the template ships the
  // defaults inside HTML comments, so label presence alone proves nothing.
  // Comments are stripped first, then each threshold must carry a number on
  // its line — ±20%, 90 days, 2x, 14 days all satisfy a bare digit check.
  if (status === "done") {
    const withoutComments = markdown.text.replace(/<!--[\s\S]*?-->/g, " ");
    for (const label of ["Attribution tolerance", "Payback window", "Creative signal floor", "Scale trigger"]) {
      if (new RegExp(`${label}[^\\n]*\\d`, "i").test(withoutComments)) continue;
      issues.push(
        issue(
          "error",
          `paid_ua.${codeFor(label)}.value_missing`,
          `${label} has no recorded value. A done paid-UA lane needs the actual number (defaults live in paid-user-acquisition.md, Stop And Scale Rules) — a label with the value still in a template comment is not a threshold.`,
          markdown.relativePath,
        ),
      );
    }
  }
}

if (status === "done" && !reportPath) {
  issues.push(
    issue(
      "error",
      "paid_ua.report_missing_done",
      "A done paid UA lane should include growth/paid-ua-report.csv, growth/paid-ua-report.md, or PAID_UA_REPORT.md.",
      "growth/paid-ua-report.csv",
    ),
  );
}

// Existence alone is not proof: a one-line stub at the report path used to
// satisfy the done gate. The blended report must at least carry a spend column
// and a downstream economics column, plus one row of data.
if (status === "done" && reportPath) {
  const reportText = readText(args.root, reportPath) ?? "";
  const reportLines = reportText.split("\n").filter((line) => line.trim().length > 0);
  const mentionsSpend = /\bspend\b/i.test(reportText);
  const mentionsEconomics = /\b(cpa|ltv|revenue|roas|payback)\b/i.test(reportText);
  if (reportLines.length < 2 || !mentionsSpend || !mentionsEconomics) {
    issues.push(
      issue(
        "error",
        "paid_ua.report_content_thin",
        `${reportPath} exists but does not look like a blended report: it needs a header naming spend plus downstream economics (CPA/LTV/revenue/ROAS/payback) and at least one data row. A stub file cannot mark the paid UA lane done.`,
        reportPath,
      ),
    );
  }
}

reportAndExit("Paid user acquisition check", issues);
