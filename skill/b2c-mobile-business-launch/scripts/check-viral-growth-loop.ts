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
  const loopHeading = /^(#{1,3})\s*loop economics|^loop economics\s*:/im.exec(markdown.text);
  const loopIndex = loopHeading ? loopHeading.index : markdown.text.toLowerCase().indexOf("loop economics");
  // The region ends at the next section boundary — a dated numeric row in a
  // later section (Traceability) must not read as a loop measurement. The
  // boundary honors the opening heading's level: a ### section ends at the
  // next # / ## / ### heading, not only at a level-two one.
  const loopRegion = ((): string => {
    if (loopIndex === -1) return "";
    const lower = markdown.text.toLowerCase();
    const headingLevel = loopHeading?.[1]?.length ?? 0;
    const boundaryPattern = headingLevel > 0 ? new RegExp(`\\n#{1,${headingLevel}}\\s`) : /\n##\s/;
    const boundaryMatch = boundaryPattern.exec(markdown.text.slice(loopIndex + 1));
    const boundaries = [boundaryMatch ? loopIndex + 1 + boundaryMatch.index : -1, lower.indexOf("stop and scale rules", loopIndex + 14)].filter(
      (index) => index !== -1,
    );
    const end = boundaries.length > 0 ? Math.min(...boundaries) : markdown.text.length;
    return markdown.text.slice(loopIndex, end);
  })();
  const validCalendarDate = (raw: string, allowFuture: boolean): boolean => {
    const date = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return false;
    // A due date lives in a current window: at most 60 days out and not
    // already missed — an overdue commitment must not keep the lane green.
    if (allowFuture) return date.getTime() >= Date.now() - 86_400_000 && date.getTime() <= Date.now() + 60 * 86_400_000;
    return date.getTime() <= Date.now();
  };
  const loopLines = loopRegion.split(/\r?\n/);
  // A target is not a measurement: k-value lines carrying aspiration language
  // do not count.
  // A number is a measurement only in a measurement sentence: illustrative
  // and aspirational copy is excluded, and the line must carry a measured/
  // observed qualifier, a date, or a week reference.
  const measuredKLine = loopLines.some(
    (line) =>
      /\bk\s*(=|at|:)\s*\d/i.test(line) &&
      !/\b(target|goal|aim|aspir\w*|hope|planned? for|example|e\.g\.|benchmark|assum\w*|hypothetic\w*|illustrat\w*|self-compound\w*|would)\b/i.test(line) &&
      /\b(measured|observed|computed|actual|current)\b|\d{4}-\d{2}-\d{2}|\bweek\s+(one|two|three|four|\d+)\b/i.test(line),
  );
  // The contract is weekly k, cycle time, and trend — a k number alone is a
  // partial measurement. The dated-commitment alternative stays for a loop
  // not yet measured.
  const cycleTimeMeasured = /cycle[- ]?time[^\n]{0,30}\d|\d[^\n]{0,30}cycle[- ]?time/i.test(loopRegion);
  // An explicit trend/decision value, not the section's own guidance prose:
  // "the rules key on k and its trend" records no trend.
  const trendRecorded =
    /\btrend\b\s*(:|=|is|was)?\s*(flat|rising|falling|improving|declining|holding|hold|compounding|up|down)\b/i.test(loopRegion) ||
    /\bdecision\b\s*(:|=)\s*\S/i.test(loopRegion);
  const commitmentMatch = loopRegion.match(/first (?:weekly )?k (?:computation|measurement)[^\n]*?(\d{4}-\d{2}-\d{2})/i);
  const commitmentValid = Boolean(commitmentMatch && validCalendarDate(commitmentMatch[1] ?? "", true));
  // A dated row is a measurement only when it carries a numeric k — a date
  // beside "no result for week 1" is a no-data row, not economics.
  const measuredRowValid = ((): boolean => {
    const tableLines = loopLines.map((line) => line.trim()).filter((line) => line.startsWith("|") && !line.includes("---"));
    if (tableLines.length < 2) return false;
    const headerCells = (tableLines[0] ?? "").split("|").map((cell) => cell.trim().toLowerCase());
    const kColumn = headerCells.findIndex((cell) => /^k\b/.test(cell));
    const cycleColumn = headerCells.findIndex((cell) => /cycle/.test(cell));
    const trendColumn = headerCells.findIndex((cell) => /trend|decision/.test(cell));
    for (const row of tableLines.slice(1)) {
      const dateMatch = row.match(/(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch || !validCalendarDate(dateMatch[1] ?? "", false)) continue;
      const cells = row.split("|").map((cell) => cell.trim());
      const kCell = kColumn > 0 ? (cells[kColumn] ?? "") : "";
      const kNumeric = kColumn > 0 ? /^\d+(\.\d+)?\b/.test(kCell) : /\bk\s*[=:]?\s*\d+(\.\d+)?/i.test(row);
      // A full measurement row records cycle time and trend/decision too;
      // missing columns fail closed.
      // "not measured in week 1" contains a digit and "no decision yet" has
      // letters — a measurement cell must lead with its number and a trend
      // cell must not be a negative.
      const NEGATIVE_TREND = /^(no decision( yet)?|none|n\/?a|unknown|not (yet|measured|available|decided)|tbd|todo|pending)/i;
      const cycleNumeric = cycleColumn > 0 && /^\d+(\.\d+)?\b/.test(cells[cycleColumn] ?? "");
      const trendCell = (cells[trendColumn] ?? "").trim();
      const trendSubstantive = trendColumn > 0 && trendCell.replace(/[^a-z0-9]/gi, "").length >= 3 && !NEGATIVE_TREND.test(trendCell);
      if (kNumeric && cycleNumeric && trendSubstantive) return true;
    }
    return false;
  })();
  const loopMeasured = (measuredKLine && cycleTimeMeasured && trendRecorded) || commitmentValid || measuredRowValid;
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
    // Structure is not state: the shipped template's band table satisfies the
    // keyword checks with every Budget and Entered/evidence cell empty. An
    // operative record is required — a populated band row when the table
    // shape is used, or a numeric budget plus a dated current-band entry in
    // prose form.
    const CELL_PLACEHOLDER = /\b(unverified|tbd|todo|to be filled|pending|placeholder)\b/i;
    const bandTableRows = region
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("|") && !line.includes("---"));
    const bandHeaderCells = (bandTableRows[0] ?? "").split("|").map((cell) => cell.trim().toLowerCase());
    const bandColumn = bandHeaderCells.findIndex((cell) => /band/.test(cell));
    const budgetColumn = bandHeaderCells.findIndex((cell) => /budget/.test(cell));
    const evidenceColumn = bandHeaderCells.findIndex((cell) => /entered|evidence/.test(cell));
    const bandTablePresent = budgetColumn > 0 && evidenceColumn > 0;
    const populatedBandRow =
      bandTablePresent &&
      bandTableRows.slice(1).some((row) => {
        const cells = row.split("|").map((cell) => cell.trim());
        // Only a modeled band's row is operative evidence — an unrelated
        // "Notes" row with a budget number enters no band.
        const bandCell = bandColumn > 0 ? (cells[bandColumn] ?? "") : "";
        if (!/(discovery|proven|scale|volume)/i.test(bandCell)) return false;
        const budgetCell = cells[budgetColumn] ?? "";
        const evidenceCell = cells[evidenceColumn] ?? "";
        // Punctuation is not evidence: the budget cell needs its number and
        // the evidence cell needs a date or substantive content.
        const NEGATIVE_CELL = /^(unknown|n\/?a|none|nil|null|not yet|not applicable|no result|no evidence|pending)$/i;
        const budgetSubstantive = /\d/.test(budgetCell) && !CELL_PLACEHOLDER.test(budgetCell);
        const evidenceSubstantive =
          (/\d{4}-\d{2}-\d{2}/.test(evidenceCell) || evidenceCell.replace(/[^a-z0-9]/gi, "").length >= 6) &&
          !CELL_PLACEHOLDER.test(evidenceCell) &&
          !NEGATIVE_CELL.test(evidenceCell.trim());
        return budgetSubstantive && evidenceSubstantive;
      });
    const proseBudgetNumbered =
      /budget[^\n]{0,40}\$\s*\d|\$\s*\d[^\n]{0,40}budget/i.test(region) && /(current band|entered)[^\n]{0,60}\d{4}-\d{2}-\d{2}/i.test(region);
    const operativeBand = bandTablePresent ? populatedBandRow : proseBudgetNumbered;
    return numberedBands >= 3 && /founder[- ]?gated|budget/i.test(region) && /install[- ]per[- ]video|fatigue/i.test(region) && operativeBand;
  })();
  if (ugcPlaybook && !ugcNotApplicable && !ugcScaleSubstantive) {
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
