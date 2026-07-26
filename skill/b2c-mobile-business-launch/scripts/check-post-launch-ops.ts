#!/usr/bin/env node
/**
 * check-post-launch-ops
 *
 * Enforces the Post-Launch Operations contract: a launched app is a live
 * business, and "launched" is not the end state of the launch package. When
 * the post_launch_ops lane is claimed (partial/done) or the project reaches
 * the post-launch phases (phase_6/phase_6b), this validator requires:
 *   1. POST_LAUNCH_OPS.md to exist (the operating runbook).
 *   2. The runbook to carry the operating sections: Weekly Operating Rhythm,
 *      Crash Triage, Review Responses, Release And Hotfix Cadence,
 *      Retention Review, Support Operations, Launch Retro.
 *   3. done additionally requires: a named crash route (Sentry or store crash
 *      reports), a stated review-response SLA, a retention cohort source, and
 *      LAUNCH_RETRO.md on disk so the retro loop feeds failure cards.
 *
 * Launch-and-vanish — shipping the store release with no operating rhythm —
 * is the failure this catches. See references/post-launch-operations.md.
 *
 * Run:
 *   npm run check:post-launch -- --root <app-repo-root>
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit } from "./lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;

function includes(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => includes(text, phrase));
}

// ── Scope guard ─────────────────────────────────────────────────────────────

const laneStatus = state ? asString(getPath(state, "lanes.post_launch_ops.status"))?.toLowerCase() : undefined;
const phase = state ? (asString(getPath(state, "project.phase"))?.toLowerCase() ?? "") : "";
const postLaunchPhase = phase === "phase_6" || phase === "phase_6b";
const laneClaimed = laneStatus === "partial" || laneStatus === "done";
const laneDone = laneStatus === "done";

if (!laneClaimed && !postLaunchPhase) {
  // Pre-launch work: the lane sits not_started/deferred under normal
  // lane-coverage rules until the app is live.
  reportAndExit("Post-launch operations check", issues);
  // No argument: honor the exit code reportAndExit set (errors still fail on the skip path).
  process.exit();
}

// ── Check 0: runbook exists ─────────────────────────────────────────────────

const runbookCandidates = ["POST_LAUNCH_OPS.md", "post-launch/POST_LAUNCH_OPS.md"];
const runbookPath = runbookCandidates.find((candidate) => Boolean(readText(args.root, candidate)));
const runbook = runbookPath ? readText(args.root, runbookPath) : undefined;

if (!runbook || !runbookPath) {
  issues.push(
    issue(
      "error",
      "post_launch_ops.runbook_missing",
      "POST_LAUNCH_OPS.md is required once the project is post-launch (phase_6/phase_6b) or the post_launch_ops lane is claimed. " +
        "A launched app with no operating runbook is the launch-and-vanish anti-pattern. " +
        "See references/post-launch-operations.md.",
      "POST_LAUNCH_OPS.md",
    ),
  );
  reportAndExit("Post-launch operations check", issues);
  process.exit();
}

// ── Check 1: operating sections present ─────────────────────────────────────

const requiredSections = [
  "Weekly Operating Rhythm",
  "Crash Triage",
  "Review Responses",
  "Release And Hotfix Cadence",
  "Retention Review",
  "Support Operations",
  "Launch Retro",
];

for (const section of requiredSections) {
  if (!includes(runbook, section)) {
    issues.push(
      issue(
        laneDone ? "error" : "warning",
        `post_launch_ops.section_missing.${section.toLowerCase().replaceAll(" ", "_")}`,
        `${runbookPath} is missing the "${section}" section. The operating runbook must cover the full weekly rhythm, not a subset.`,
        runbookPath,
      ),
    );
  }
}

// ── Check 2: done-status proof floor ────────────────────────────────────────

if (laneDone) {
  if (!includesAny(runbook, ["sentry", "store crash reports", "crash reports in app store connect", "play console vitals"])) {
    issues.push(
      issue(
        "error",
        "post_launch_ops.crash_route_missing",
        `${runbookPath} names no crash route. Record Sentry (or store crash reports as the fallback) with alert routing before the lane is done.`,
        runbookPath,
      ),
    );
  }
  if (!includes(runbook, "sla")) {
    issues.push(
      issue(
        "error",
        "post_launch_ops.review_sla_missing",
        `${runbookPath} states no review-response SLA. Record how fast reviews get replies so reputation work is a contract, not a mood.`,
        runbookPath,
      ),
    );
  }
  if (!includes(runbook, "cohort")) {
    issues.push(
      issue(
        "error",
        "post_launch_ops.retention_source_missing",
        `${runbookPath} names no retention cohort source. Record the D0/D7/D30 cohort source (PostHog plus RevenueCat renewals) before the lane is done.`,
        runbookPath,
      ),
    );
  }
  const retroPath = ["LAUNCH_RETRO.md", "post-launch/LAUNCH_RETRO.md"].find((candidate) => existsSync(path.join(args.root, candidate)));
  if (!retroPath) {
    issues.push(
      issue(
        "error",
        "post_launch_ops.launch_retro_missing",
        "LAUNCH_RETRO.md is required before post_launch_ops is done. The retro is how this launch's misses become failure cards " +
          "and LaunchBench scenarios instead of oral lore.",
        "LAUNCH_RETRO.md",
      ),
    );
  } else {
    // The retro must carry the whole-app verdict surface. Channel-level
    // stop/scale rules exist elsewhere; this is the only place the question
    // "keep investing in this app or move to the next one" is forced, and a
    // rhythm with no exit question runs zombie apps indefinitely.
    const retroRaw = readText(args.root, retroPath) ?? "";
    if (!retroRaw.toLowerCase().includes("kill, hold, or scale")) {
      issues.push(
        issue(
          "error",
          "post_launch_ops.kill_or_scale_missing",
          `${retroPath} has no "Kill, Hold, Or Scale" section. The day-30/day-90 retro must carry the whole-app verdict ` +
            `(post-launch-operations.md §9) — evidence columns filled by the agent, verdict decided by the founder.`,
          retroPath,
        ),
      );
    } else {
      // The heading alone is not the contract — the verdict is. Once the Retro
      // Window table records a completion date for Day 30 or Day 90, that
      // checkpoint's row in the Kill, Hold, Or Scale table must carry an actual
      // verdict, and the decision must be mirrored into PROJECT_STATE.yaml.
      // Before the first checkpoint completes, the section's presence is enough
      // (done at launch +7 days is legitimate).
      const windowSection = markdownSection(retroRaw, "Retro Window");
      const verdictSection = markdownSection(retroRaw, "Kill, Hold, Or Scale");
      const verdictColumn = tableColumnIndex(verdictSection, /verdict/i);
      const completedCheckpoints = ["Day 30", "Day 90"].filter((checkpoint) => Boolean(tableRowCells(windowSection, checkpoint)[2]?.trim()));

      for (const checkpoint of completedCheckpoints) {
        const verdictCell = verdictColumn === -1 ? "" : (tableRowCells(verdictSection, checkpoint)[verdictColumn] ?? "");
        if (!/^(scale|hold|fix|kill)\b/i.test(verdictCell.trim())) {
          issues.push(
            issue(
              "error",
              "post_launch_ops.kill_or_scale_verdict_unfilled",
              `${retroPath} records the ${checkpoint} checkpoint as completed, but its Kill, Hold, Or Scale row carries no verdict. ` +
                `A completed checkpoint with an empty verdict is the zombie-app miss the section exists to stop — record Scale, Hold, Fix, or Kill.`,
              retroPath,
            ),
          );
        }
      }

      if (completedCheckpoints.length > 0 && state) {
        const decision = (asString(getPath(state, "lanes.post_launch_ops.kill_or_scale_decision")) ?? "").trim();
        const decidedAt = (asString(getPath(state, "lanes.post_launch_ops.kill_or_scale_decided_at")) ?? "").trim();
        if (!/^(scale|hold|fix|kill)$/i.test(decision) || !/^\d{4}-\d{2}-\d{2}$/.test(decidedAt)) {
          issues.push(
            issue(
              "error",
              "post_launch_ops.kill_or_scale_state_missing",
              `A day-30/day-90 retro checkpoint is complete but lanes.post_launch_ops.kill_or_scale_decision/kill_or_scale_decided_at ` +
                `do not record a valid verdict (scale|hold|fix|kill) with an ISO date. The state mirror is what future sessions and the portfolio registry read.`,
              "PROJECT_STATE.yaml",
            ),
          );
        }
      }
    }
  }
}

reportAndExit("Post-launch operations check", issues);

/** The block from a `## <heading>` line to the next `## ` heading (or EOF). */
function markdownSection(markdown: string, heading: string): string {
  const lines = markdown.split(/\r?\n/);
  const headingPattern = new RegExp(`^##\\s*${heading}`, "i");
  const start = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (start === -1) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^## /.test(lines[i] ?? "")) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

/** Cells of the first table row whose first cell is `label` (outer pipes produce empty edge cells; index 1 is the first real cell). */
function tableRowCells(section: string, label: string): string[] {
  const row = section.split(/\r?\n/).find((line) => new RegExp(`^\\|\\s*${label}\\s*\\|`, "i").test(line.trim()));
  return row ? row.split("|").map((cell) => cell.trim()) : [];
}

/** Index of the header column matching `pattern` in the section's first table header row, or -1. */
function tableColumnIndex(section: string, pattern: RegExp): number {
  const header = section.split(/\r?\n/).find((line) => line.trim().startsWith("|") && pattern.test(line));
  if (!header) return -1;
  return header.split("|").findIndex((cell) => pattern.test(cell));
}
