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
 *   4. The numbers loop: lanes.post_launch_ops.live_since anchors the clock;
 *      day-30/day-90 retro checkpoints cannot sit uncompleted past their due
 *      date, evidence cells cannot hold placeholder text ("unverified — confirm
 *      in RevenueCat"), and the weekly log must carry dated rows with real
 *      numbers once the app has been live past two weeks. A recorded Kill
 *      verdict is the one legitimate way for the rhythm to go quiet.
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

// ── Check 2: the numbers loop ───────────────────────────────────────────────
// A live app is measured in dollars and users, not deploy logs. Everything
// below hangs off lanes.post_launch_ops.live_since: checkpoint due dates and
// weekly-log freshness compare against the current date. Severity is error
// whenever the app is actually live (done lane OR post-launch phase) — a
// phase_6 project cannot dodge the numbers by leaving the lane partial — and
// warning only for a lane claimed early, before the project reaches launch.

const numbersSeverity = laneDone || postLaunchPhase ? "error" : "warning";
const MS_PER_DAY = 86_400_000;
const CHECKPOINT_GRACE_DAYS = 7;
const WEEKLY_STALE_DAYS = 14;
// The lazy fills observed on real launches: text that occupies the cell so the
// row looks done while the number never arrived.
const PLACEHOLDER_TEXT = /\b(unverified|tbd|todo|to be filled|pending|confirm in|placeholder)\b/i;

/** Strict calendar date: shape, round-trip, and not in the future. A typo'd
 * month (2026-99-99) or a forward-dated launch would otherwise turn every
 * comparison into silent NaN/negative math and disarm the clock entirely. */
function parseLiveDate(raw: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return undefined;
  if (date.getTime() > Date.now()) return undefined;
  return date;
}

const liveSinceRaw = state ? (asString(getPath(state, "lanes.post_launch_ops.live_since")) ?? "").trim() : "";
const liveSince = parseLiveDate(liveSinceRaw);
const daysLive = liveSince ? Math.floor((Date.now() - liveSince.getTime()) / MS_PER_DAY) : 0;

if (!liveSince) {
  issues.push(
    issue(
      numbersSeverity,
      "post_launch_ops.live_since_missing",
      "lanes.post_launch_ops.live_since does not record a valid past ISO date for when the app went live " +
        (liveSinceRaw ? `(current value: "${liveSinceRaw}"). ` : ". ") +
        "Without a real calendar date nothing can ever be overdue — no retro checkpoint has a due date and the weekly log has no " +
        "freshness bar. Record the first approved-for-sale date once; it never changes.",
      "PROJECT_STATE.yaml",
    ),
  );
}

const retroFile = ["LAUNCH_RETRO.md", "post-launch/LAUNCH_RETRO.md"].find((candidate) => existsSync(path.join(args.root, candidate)));
const retroText = retroFile ? (readText(args.root, retroFile) ?? "") : "";

// The wind-down exemption must be earned, not typed: a one-string state edit
// (kill_or_scale_decision: kill) with no retro behind it would otherwise skip
// every checkpoint and weekly-log gate. Kill counts only when the state mirror
// is complete AND some retro checkpoint was actually completed (a valid past
// date in the Retro Window) AND that same checkpoint carries a Kill verdict
// over a filled, non-placeholder evidence pack.
const killDecided = ((): boolean => {
  if (!state) return false;
  const decision = (asString(getPath(state, "lanes.post_launch_ops.kill_or_scale_decision")) ?? "").trim();
  const decidedAt = (asString(getPath(state, "lanes.post_launch_ops.kill_or_scale_decided_at")) ?? "").trim();
  if (!/^kill$/i.test(decision) || !parseLiveDate(decidedAt)) return false;
  const verdictSection = markdownSection(retroText, "Kill, Hold, Or Scale");
  const windowSection = markdownSection(retroText, "Retro Window");
  if (!verdictSection || !windowSection) return false;
  const verdictColumn = tableColumnIndex(verdictSection, /verdict/i);
  if (verdictColumn === -1) return false;
  return ["Day 30", "Day 90"].some((checkpoint) => {
    if (!parseLiveDate((tableRowCells(windowSection, checkpoint)[2] ?? "").trim())) return false;
    const cells = tableRowCells(verdictSection, checkpoint);
    if (!/^kill\b/i.test((cells[verdictColumn] ?? "").trim())) return false;
    const evidenceCells = verdictColumn > 2 ? cells.slice(2, verdictColumn) : [];
    return evidenceCells.length > 0 && evidenceCells.every((cell) => cell.trim().length > 0 && !PLACEHOLDER_TEXT.test(cell));
  });
})();

if (liveSince && !killDecided) {
  // Checkpoints that were never completed are the dodge the verdict gates
  // cannot see: every existing check fires only after a completion date is
  // recorded. Past due-plus-grace, the untouched row is itself the miss.
  const retroWindow = markdownSection(retroText, "Retro Window");
  const checkpoints: Array<{ label: string; dueDays: number; code: string; severity: "error" | "warning" }> = [
    { label: "Launch \\+7 days", dueDays: 7, code: "launch_7", severity: "warning" },
    { label: "Day 30", dueDays: 30, code: "day_30", severity: numbersSeverity },
    { label: "Day 90", dueDays: 90, code: "day_90", severity: numbersSeverity },
  ];
  for (const checkpoint of checkpoints) {
    // Completion requires a valid, non-future calendar date — "TBD" or an
    // impossible date in the Date cell is not a completed checkpoint and must
    // not suppress the overdue error.
    const completed = Boolean(parseLiveDate((tableRowCells(retroWindow, checkpoint.label)[2] ?? "").trim()));
    if (!completed && daysLive > checkpoint.dueDays + CHECKPOINT_GRACE_DAYS) {
      issues.push(
        issue(
          checkpoint.severity,
          `post_launch_ops.checkpoint_overdue.${checkpoint.code}`,
          `The app has been live ${daysLive} days and the ${checkpoint.label.replaceAll("\\", "")} retro checkpoint in ${retroFile ?? "LAUNCH_RETRO.md"} ` +
            `is still not completed (due at day ${checkpoint.dueDays}, grace ${CHECKPOINT_GRACE_DAYS} days). An uncompleted checkpoint is how the ` +
            `kill-or-scale question gets dodged indefinitely — run the checkpoint now and record its date in the Retro Window.`,
          retroFile ?? "LAUNCH_RETRO.md",
        ),
      );
    }
  }

  // The weekly log is where the Weekly Ops Review proves it read reality.
  // Once the app has been live past two weeks, the log needs dated rows, the
  // latest row must be recent, and its metric cells must hold numbers — not
  // adjectives, not "unverified".
  if (daysLive >= WEEKLY_STALE_DAYS) {
    const runbookLines = runbook.split(/\r?\n/);
    const headerIndex = runbookLines.findIndex(
      (line) => line.trim().startsWith("|") && /date/i.test(line) && /crash-free/i.test(line) && /retention|d7/i.test(line),
    );
    if (headerIndex === -1) {
      issues.push(
        issue(
          numbersSeverity,
          "post_launch_ops.weekly_log_missing",
          `${runbookPath} no longer carries the weekly log table (Date | Crash-free % | … | D7 retention). The log is the proof the ` +
            `Weekly Ops Review reads real numbers each week — keep the table and add one dated row per session.`,
          runbookPath,
        ),
      );
    } else {
      const headerCells = runbookLines[headerIndex]!.split("|");
      const crashColumn = headerCells.findIndex((cell) => /crash-free/i.test(cell));
      const retentionColumn = headerCells.findIndex((cell) => /d7|retention/i.test(cell));
      const dateRows: Array<{ date: Date; cells: string[] }> = [];
      for (let i = headerIndex + 1; i < runbookLines.length; i += 1) {
        const line = runbookLines[i]?.trim() ?? "";
        if (!line.startsWith("|")) break;
        const match = line.match(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|/);
        // Same strict past-date validation as live_since: a future-dated or
        // impossible row must not anchor the freshness math.
        const rowDate = match ? parseLiveDate(match[1] ?? "") : undefined;
        if (rowDate) dateRows.push({ date: rowDate, cells: line.split("|").map((cell) => cell.trim()) });
      }
      if (dateRows.length === 0) {
        issues.push(
          issue(
            numbersSeverity,
            "post_launch_ops.weekly_log_missing",
            `The app has been live ${daysLive} days and the weekly log in ${runbookPath} has no dated rows. A live business with an empty ` +
              `weekly log is launch-and-vanish in progress — run the Weekly Ops Review and record the numbers (or record the Kill verdict if the app is wound down).`,
            runbookPath,
          ),
        );
      } else {
        const latest = dateRows.reduce((a, b) => (a.date.getTime() >= b.date.getTime() ? a : b));
        const rowAgeDays = Math.floor((Date.now() - latest.date.getTime()) / MS_PER_DAY);
        if (rowAgeDays > WEEKLY_STALE_DAYS) {
          issues.push(
            issue(
              numbersSeverity,
              "post_launch_ops.weekly_log_stale",
              `The latest weekly log row in ${runbookPath} is ${rowAgeDays} days old. The Weekly Ops Review runs even in a quiet week — ` +
                `a stale log means the rhythm stopped and nobody recorded why. Run the session, or record the Kill verdict if the app is wound down.`,
              runbookPath,
            ),
          );
        }
        // A measured value is a percentage (crash-free and D7 are both rates),
        // or the documented dated-blocker form. An incidental digit inside an
        // adjective sentence ("iOS 17 looks fine") is not a metric.
        const MEASURED_VALUE = /\d+(?:\.\d+)?\s*%/;
        const DATED_BLOCKER = /blocked\b[^|]*\d{4}-\d{2}-\d{2}/i;
        const metricCells = [crashColumn, retentionColumn].filter((index) => index > 0).map((index) => latest.cells[index] ?? "");
        if (metricCells.some((cell) => !(MEASURED_VALUE.test(cell) || DATED_BLOCKER.test(cell)) || PLACEHOLDER_TEXT.test(cell))) {
          issues.push(
            issue(
              numbersSeverity,
              "post_launch_ops.weekly_numbers_missing",
              `The latest weekly log row in ${runbookPath} holds no measured values in its crash-free/retention cells. A metric is a ` +
                `percentage ("99.6%", "31%") or a dated blocker ("blocked: PostHog auth 2026-07-20") — adjectives with incidental digits are ` +
                `not a metrics review. Pull the values from Sentry, PostHog, and RevenueCat.`,
              runbookPath,
            ),
          );
        }
        // The runbook contract puts MRR and its delta in Notes each week — the
        // dollar figure is the whole point of the numbers loop, so rate columns
        // alone cannot satisfy it.
        const MEASURED_MONEY = /\$\s*[\d,.]+/;
        const notesColumn = headerCells.findIndex((cell) => /notes/i.test(cell));
        const notesCell = notesColumn > 0 ? (latest.cells[notesColumn] ?? "") : "";
        if (notesColumn === -1 || !(MEASURED_MONEY.test(notesCell) || DATED_BLOCKER.test(notesCell)) || PLACEHOLDER_TEXT.test(notesCell)) {
          issues.push(
            issue(
              numbersSeverity,
              "post_launch_ops.weekly_revenue_missing",
              `The latest weekly log row in ${runbookPath} records no revenue figure. The Notes column carries MRR and its delta as a dollar ` +
                `amount ("MRR $412 (+3%)"; "MRR $0" is a legitimate value) or a dated blocker — a metrics review that never touches money is ` +
                `metrics theater with extra steps. Pull it from RevenueCat.`,
              runbookPath,
            ),
          );
        }
      }
    }
  }
}

// ── Check 3: done-status proof floor ────────────────────────────────────────

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
}

// ── Check 4: retro verdict substance ────────────────────────────────────────
// Runs for done lanes AND live phases: a phase_6 project with the lane still
// partial must not be able to record a checkpoint date over an empty or
// placeholder verdict row — the substance bar travels with the phase, not
// only with the lane status.

if (laneDone || postLaunchPhase) {
  const retroPath = ["LAUNCH_RETRO.md", "post-launch/LAUNCH_RETRO.md"].find((candidate) => existsSync(path.join(args.root, candidate)));
  if (!retroPath) {
    issues.push(
      issue(
        "error",
        "post_launch_ops.launch_retro_missing",
        "LAUNCH_RETRO.md is required once the app is live or post_launch_ops is done. The retro is how this launch's misses become failure cards " +
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
    // Section presence is judged on the actual heading, not a prose mention —
    // "we should think about kill, hold, or scale" in Surprises is not a
    // verdict surface.
    const verdictSection = markdownSection(retroRaw, "Kill, Hold, Or Scale");
    if (!verdictSection) {
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
      const verdictColumn = tableColumnIndex(verdictSection, /verdict/i);
      const completedCheckpoints = ["Day 30", "Day 90"].filter((checkpoint) => Boolean(tableRowCells(windowSection, checkpoint)[2]?.trim()));

      for (const checkpoint of completedCheckpoints) {
        const cells = tableRowCells(verdictSection, checkpoint);
        const verdictCell = verdictColumn === -1 ? "" : (cells[verdictColumn] ?? "");
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
        // The verdict is only as good as its evidence pack: every column
        // between the checkpoint and the verdict (MRR trend, retention trend,
        // unit economics, founder hours) must be filled before the decision
        // counts. Rationale stays the founder's optional words.
        const evidenceCells = verdictColumn > 2 ? cells.slice(2, verdictColumn) : [];
        if (verdictColumn !== -1 && (cells.length === 0 || evidenceCells.some((cell) => cell.trim().length === 0))) {
          issues.push(
            issue(
              "error",
              "post_launch_ops.kill_or_scale_evidence_unfilled",
              `${retroPath}'s ${checkpoint} Kill, Hold, Or Scale row is missing evidence cells (MRR trend, retention trend, unit economics, founder hours). ` +
                `A verdict without the evidence pack is a mood, not a decision — fill every evidence column from RevenueCat, PostHog, and the weekly log.`,
              retroPath,
            ),
          );
        } else if (evidenceCells.some((cell) => PLACEHOLDER_TEXT.test(cell))) {
          // Non-empty is not the bar: "unverified — confirm in RevenueCat" fills
          // the cell while dodging the pull. The number, or the dated blocker
          // that prevents it, is the only content that counts.
          issues.push(
            issue(
              "error",
              "post_launch_ops.kill_or_scale_evidence_placeholder",
              `${retroPath}'s ${checkpoint} Kill, Hold, Or Scale row carries placeholder text ("unverified", "TBD", "confirm in …") in its evidence cells. ` +
                `Pull the actual values from RevenueCat and PostHog before recording the verdict — a decision made over placeholders is the metrics-theater miss.`,
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
        } else {
          // The mirror must agree with the latest completed checkpoint: future
          // sessions and the portfolio registry read the state value, so a
          // retro saying Kill while state says scale drives the wrong
          // allocation and skips the wind-down.
          const latest = completedCheckpoints[completedCheckpoints.length - 1] ?? "";
          const latestVerdict = (verdictColumn === -1 ? "" : (tableRowCells(verdictSection, latest)[verdictColumn] ?? ""))
            .trim()
            .match(/^(scale|hold|fix|kill)\b/i)?.[1]
            ?.toLowerCase();
          if (latestVerdict && latestVerdict !== decision.toLowerCase()) {
            issues.push(
              issue(
                "error",
                "post_launch_ops.kill_or_scale_state_mismatch",
                `lanes.post_launch_ops.kill_or_scale_decision ("${decision}") disagrees with the latest completed checkpoint's verdict in ${retroPath} ("${latestVerdict}"). ` +
                  `Update the state mirror when the verdict changes — it is what future sessions and the portfolio registry act on.`,
                "PROJECT_STATE.yaml",
              ),
            );
          }
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
