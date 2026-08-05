import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Harness, type MutableRecord, expectRecord, getLane, readState, skillRoot, writeCompleteCompoundEngineering, writeState } from "./_harness.js";

/**
 * Lifecycle fixtures: post-launch operations, Google Play readiness, the
 * backend data contract, the CE-unavailable Standalone Engineering Loop, and
 * the launch-tier state field.
 */
export function register(h: Harness): void {
  const { makeFixture, makeEmptyFixture, runFixture } = h;

  // ── Post-launch operations ────────────────────────────────────────────────

  // The numbers-loop gates are anchored on lanes.post_launch_ops.live_since and
  // compare against the real current date, so fixtures compute their dates
  // relative to now — a fixed date would silently change meaning as time passes.
  const isoDaysAgo = (days: number): string => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
  };

  const setPostLaunchLive = (root: string, daysLive: number): void => {
    const state = readState(root);
    getLane(state, "post_launch_ops")["live_since"] = isoDaysAgo(daysLive);
    writeState(root, state);
  };

  const appendWeeklyLogRow = (root: string, options: { daysAgo: number; crashFree?: string; d7?: string; notes?: string }): void => {
    const runbookPath = path.join(root, "operations/POST_LAUNCH_OPS.md");
    const header = "| Date | Crash-free % | New reviews (avg rating) | D7 retention | Decision shipped | Notes |\n| --- | --- | --- | --- | --- | --- |";
    const row = `| ${isoDaysAgo(options.daysAgo)} | ${options.crashFree ?? "99.7%"} | 4.8 (3 new) | ${options.d7 ?? "31%"} | shipped paywall copy fix | ${options.notes ?? "MRR $412 (+3%)"} |`;
    writeFileSync(path.join(runbookPath), readFileSync(runbookPath, "utf8").replace(header, `${header}\n${row}`), "utf8");
  };

  const completeCheckpoint = (
    root: string,
    checkpoint: "Day 30" | "Day 90",
    options: { daysAgo: number; verdict: string; evidence?: [string, string, string, string] },
  ): void => {
    const retroPath = path.join(root, "operations/LAUNCH_RETRO.md");
    const ev = options.evidence ?? ["$412 MRR, flat 4 wks", "D7 31% → 29% → 31%", "n/a — organic only", "6"];
    const retro = readFileSync(retroPath, "utf8")
      .replace(`| ${checkpoint} | | |`, `| ${checkpoint} | ${isoDaysAgo(options.daysAgo)} | founder |`)
      .replace(`| ${checkpoint} | | | | | | |`, `| ${checkpoint} | ${ev[0]} | ${ev[1]} | ${ev[2]} | ${ev[3]} | ${options.verdict} | |`);
    writeFileSync(retroPath, retro, "utf8");
  };

  const postLaunchComplete = makeFixture("post-launch-complete");
  {
    const state = readState(postLaunchComplete);
    expectRecord(state.project, "project")["phase"] = "phase_6b";
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    writeState(postLaunchComplete, state);
    setPostLaunchLive(postLaunchComplete, 10);
  }
  runFixture("post-launch lane done with complete runbook passes", postLaunchComplete, "check-post-launch-ops.ts", 0);

  // The live date is the anchor for every due-date and freshness gate; a live
  // app with no recorded live_since has no clock, so nothing can ever be overdue.
  const postLaunchNoLiveDate = makeFixture("post-launch-live-date-missing");
  {
    const state = readState(postLaunchNoLiveDate);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    writeState(postLaunchNoLiveDate, state);
  }
  runFixture("post-launch done without a live_since date fails", postLaunchNoLiveDate, "check-post-launch-ops.ts", 1, "post_launch_ops.live_since_missing");

  // A typo'd calendar value (2026-99-99) must not silently disarm the clock:
  // Invalid Date math would turn every overdue comparison into NaN === false.
  const postLaunchBadLiveDate = makeFixture("post-launch-live-date-invalid");
  {
    const state = readState(postLaunchBadLiveDate);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    lane["live_since"] = "2026-99-99";
    writeState(postLaunchBadLiveDate, state);
  }
  runFixture("post-launch done with an invalid live_since fails", postLaunchBadLiveDate, "check-post-launch-ops.ts", 1, "post_launch_ops.live_since_missing");

  // A forward-dated launch (negative days live) would suppress every gate too.
  const postLaunchFutureLiveDate = makeFixture("post-launch-live-date-future");
  {
    const state = readState(postLaunchFutureLiveDate);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    lane["live_since"] = isoDaysAgo(-30);
    writeState(postLaunchFutureLiveDate, state);
  }
  runFixture("post-launch done with a future live_since fails", postLaunchFutureLiveDate, "check-post-launch-ops.ts", 1, "post_launch_ops.live_since_missing");

  // A phase_6 project cannot dodge the numbers by leaving the lane partial:
  // the launch-and-vanish repos observed in the wild never marked the lane done.
  const postLaunchPhaseVanish = makeFixture("post-launch-phase-vanish");
  {
    const state = readState(postLaunchPhaseVanish);
    expectRecord(state.project, "project")["phase"] = "phase_6";
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "partial";
    writeState(postLaunchPhaseVanish, state);
    setPostLaunchLive(postLaunchPhaseVanish, 20);
  }
  runFixture(
    "post-launch phase with a partial lane and an empty weekly log fails",
    postLaunchPhaseVanish,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.weekly_log_missing",
  );

  const postLaunchNoRunbook = makeFixture("post-launch-no-runbook");
  {
    const state = readState(postLaunchNoRunbook);
    expectRecord(state.project, "project")["phase"] = "phase_6";
    writeState(postLaunchNoRunbook, state);
    rmSync(path.join(postLaunchNoRunbook, "operations/POST_LAUNCH_OPS.md"));
  }
  runFixture("post-launch phase without runbook fails", postLaunchNoRunbook, "check-post-launch-ops.ts", 1, "post_launch_ops.runbook_missing");

  const postLaunchNoRetro = makeFixture("post-launch-no-retro");
  {
    const state = readState(postLaunchNoRetro);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md"];
    writeState(postLaunchNoRetro, state);
    setPostLaunchLive(postLaunchNoRetro, 10);
    rmSync(path.join(postLaunchNoRetro, "operations/LAUNCH_RETRO.md"));
  }
  runFixture("post-launch done without launch retro fails", postLaunchNoRetro, "check-post-launch-ops.ts", 1, "post_launch_ops.launch_retro_missing");

  // A retro with no whole-app verdict surface is the zombie-app setup: the
  // weekly rhythm runs forever and no checkpoint ever asks kill, hold, or scale.
  const postLaunchNoVerdict = makeFixture("post-launch-retro-no-verdict");
  {
    const state = readState(postLaunchNoVerdict);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    writeState(postLaunchNoVerdict, state);
    setPostLaunchLive(postLaunchNoVerdict, 10);
    writeFileSync(
      path.join(postLaunchNoVerdict, "operations/LAUNCH_RETRO.md"),
      ["# Launch Retro", "", "## Lane Usage", "", "## Stalls And Blockers", "", "## Surprises", "", "## Failure Card Candidates"].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "post-launch done with a retro missing the kill-or-scale verdict fails",
    postLaunchNoVerdict,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.kill_or_scale_missing",
  );

  // Mentioning the phrase in prose is not the section: only the real heading
  // (and its table) counts as the verdict surface.
  const postLaunchProsePhrase = makeFixture("post-launch-retro-prose-phrase-only");
  {
    const state = readState(postLaunchProsePhrase);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    writeState(postLaunchProsePhrase, state);
    setPostLaunchLive(postLaunchProsePhrase, 10);
    writeFileSync(
      path.join(postLaunchProsePhrase, "operations/LAUNCH_RETRO.md"),
      ["# Launch Retro", "", "## Surprises", "", "We should think about kill, hold, or scale at some point.", "", "## Failure Card Candidates"].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "retro mentioning the verdict phrase in prose without the section fails",
    postLaunchProsePhrase,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.kill_or_scale_missing",
  );

  // The heading alone is words-not-work: once the Retro Window records a
  // completed Day 30/Day 90 pass, the checkpoint's verdict row and the state
  // mirror must both carry the decision.
  const postLaunchVerdictEmpty = makeFixture("post-launch-checkpoint-verdict-empty");
  {
    const state = readState(postLaunchVerdictEmpty);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    writeState(postLaunchVerdictEmpty, state);
    setPostLaunchLive(postLaunchVerdictEmpty, 40);
    appendWeeklyLogRow(postLaunchVerdictEmpty, { daysAgo: 3 });
    completeCheckpoint(postLaunchVerdictEmpty, "Day 30", { daysAgo: 8, verdict: "" });
  }
  runFixture(
    "completed day-30 checkpoint with an empty verdict row fails",
    postLaunchVerdictEmpty,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.kill_or_scale_verdict_unfilled",
  );

  const postLaunchVerdictNoState = makeFixture("post-launch-verdict-without-state-mirror");
  {
    const state = readState(postLaunchVerdictNoState);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    writeState(postLaunchVerdictNoState, state);
    setPostLaunchLive(postLaunchVerdictNoState, 40);
    appendWeeklyLogRow(postLaunchVerdictNoState, { daysAgo: 3 });
    completeCheckpoint(postLaunchVerdictNoState, "Day 30", { daysAgo: 8, verdict: "Hold" });
  }
  runFixture(
    "recorded verdict without the PROJECT_STATE mirror fails",
    postLaunchVerdictNoState,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.kill_or_scale_state_missing",
  );

  const postLaunchVerdictComplete = makeFixture("post-launch-verdict-complete");
  {
    const state = readState(postLaunchVerdictComplete);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    lane["kill_or_scale_decision"] = "hold";
    lane["kill_or_scale_decided_at"] = isoDaysAgo(8);
    writeState(postLaunchVerdictComplete, state);
    setPostLaunchLive(postLaunchVerdictComplete, 40);
    appendWeeklyLogRow(postLaunchVerdictComplete, { daysAgo: 3 });
    completeCheckpoint(postLaunchVerdictComplete, "Day 30", {
      daysAgo: 8,
      verdict: "Hold — flat but positive, low founder cost",
      evidence: ["$412 MRR, flat 4 wks", "D7 31% → 29% → 31%", "n/a — organic only", "6"],
    });
  }
  runFixture("completed checkpoint with verdict and state mirror passes", postLaunchVerdictComplete, "check-post-launch-ops.ts", 0);

  // A verdict without its evidence pack is a mood, not a decision.
  const postLaunchVerdictNoEvidence = makeFixture("post-launch-verdict-without-evidence");
  {
    const state = readState(postLaunchVerdictNoEvidence);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    lane["kill_or_scale_decision"] = "hold";
    lane["kill_or_scale_decided_at"] = isoDaysAgo(8);
    writeState(postLaunchVerdictNoEvidence, state);
    setPostLaunchLive(postLaunchVerdictNoEvidence, 40);
    appendWeeklyLogRow(postLaunchVerdictNoEvidence, { daysAgo: 3 });
    const retro = readFileSync(path.join(postLaunchVerdictNoEvidence, "operations/LAUNCH_RETRO.md"), "utf8")
      .replace("| Day 30 | | |", `| Day 30 | ${isoDaysAgo(8)} | founder |`)
      .replace("| Day 30 | | | | | | |", "| Day 30 | | | | | Hold | |");
    writeFileSync(path.join(postLaunchVerdictNoEvidence, "operations/LAUNCH_RETRO.md"), retro, "utf8");
  }
  runFixture(
    "verdict recorded without the evidence pack fails",
    postLaunchVerdictNoEvidence,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.kill_or_scale_evidence_unfilled",
  );

  // The clueless-clothing miss: every evidence cell filled with "unverified —
  // confirm in RevenueCat". Non-empty placeholder text is still not a number.
  const postLaunchEvidencePlaceholder = makeFixture("post-launch-evidence-placeholder");
  {
    const state = readState(postLaunchEvidencePlaceholder);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    lane["kill_or_scale_decision"] = "hold";
    lane["kill_or_scale_decided_at"] = isoDaysAgo(8);
    writeState(postLaunchEvidencePlaceholder, state);
    setPostLaunchLive(postLaunchEvidencePlaceholder, 40);
    appendWeeklyLogRow(postLaunchEvidencePlaceholder, { daysAgo: 3 });
    completeCheckpoint(postLaunchEvidencePlaceholder, "Day 30", {
      daysAgo: 8,
      verdict: "Hold",
      evidence: ["unverified — confirm in RevenueCat", "unverified — confirm in PostHog", "n/a", "8"],
    });
  }
  runFixture(
    "evidence cells filled with unverified placeholders fail",
    postLaunchEvidencePlaceholder,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.kill_or_scale_evidence_placeholder",
  );

  // The state mirror must agree with the latest completed checkpoint's verdict.
  const postLaunchVerdictMismatch = makeFixture("post-launch-verdict-state-mismatch");
  {
    const state = readState(postLaunchVerdictMismatch);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    lane["kill_or_scale_decision"] = "scale";
    lane["kill_or_scale_decided_at"] = isoDaysAgo(8);
    writeState(postLaunchVerdictMismatch, state);
    setPostLaunchLive(postLaunchVerdictMismatch, 40);
    appendWeeklyLogRow(postLaunchVerdictMismatch, { daysAgo: 3 });
    completeCheckpoint(postLaunchVerdictMismatch, "Day 30", { daysAgo: 8, verdict: "Hold" });
  }
  runFixture(
    "state mirror disagreeing with the retro verdict fails",
    postLaunchVerdictMismatch,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.kill_or_scale_state_mismatch",
  );

  // The zombie dodge the day-30 gate cannot see: never complete the checkpoint
  // at all. Once the app has been live past the due date plus grace, an
  // untouched Retro Window row is itself the failure.
  const postLaunchDay30Overdue = makeFixture("post-launch-day30-overdue");
  {
    const state = readState(postLaunchDay30Overdue);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    writeState(postLaunchDay30Overdue, state);
    setPostLaunchLive(postLaunchDay30Overdue, 45);
    appendWeeklyLogRow(postLaunchDay30Overdue, { daysAgo: 3 });
  }
  runFixture(
    "day-30 checkpoint never completed past its due date fails",
    postLaunchDay30Overdue,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.checkpoint_overdue.day_30",
  );

  // Launch-and-vanish in its purest form: live past two weeks, weekly log empty.
  const postLaunchWeeklyMissing = makeFixture("post-launch-weekly-log-missing");
  {
    const state = readState(postLaunchWeeklyMissing);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    writeState(postLaunchWeeklyMissing, state);
    setPostLaunchLive(postLaunchWeeklyMissing, 20);
  }
  runFixture(
    "live past two weeks with an empty weekly log fails",
    postLaunchWeeklyMissing,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.weekly_log_missing",
  );

  const postLaunchWeeklyStale = makeFixture("post-launch-weekly-log-stale");
  {
    const state = readState(postLaunchWeeklyStale);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    lane["kill_or_scale_decision"] = "hold";
    lane["kill_or_scale_decided_at"] = isoDaysAgo(10);
    writeState(postLaunchWeeklyStale, state);
    setPostLaunchLive(postLaunchWeeklyStale, 45);
    appendWeeklyLogRow(postLaunchWeeklyStale, { daysAgo: 20 });
    completeCheckpoint(postLaunchWeeklyStale, "Day 30", {
      daysAgo: 10,
      verdict: "Hold",
      evidence: ["$210 MRR, flat", "D7 24% stable", "n/a — organic only", "5"],
    });
  }
  runFixture("latest weekly log row older than two weeks fails", postLaunchWeeklyStale, "check-post-launch-ops.ts", 1, "post_launch_ops.weekly_log_stale");

  // A fresh row whose metric cells hold adjectives or "unverified" instead of
  // numbers is the metrics-theater variant of the same miss.
  const postLaunchWeeklyPlaceholder = makeFixture("post-launch-weekly-numbers-placeholder");
  {
    const state = readState(postLaunchWeeklyPlaceholder);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    writeState(postLaunchWeeklyPlaceholder, state);
    setPostLaunchLive(postLaunchWeeklyPlaceholder, 20);
    appendWeeklyLogRow(postLaunchWeeklyPlaceholder, { daysAgo: 2, crashFree: "unverified", d7: "looks fine" });
  }
  runFixture("weekly log row without real numbers fails", postLaunchWeeklyPlaceholder, "check-post-launch-ops.ts", 1, "post_launch_ops.weekly_numbers_missing");

  // A recycled pre-launch date in the Retro Window is not a completion: the
  // window is anchored to live_since, so a date before launch suppresses nothing.
  const postLaunchPrelaunchDate = makeFixture("post-launch-checkpoint-prelaunch-date");
  {
    const state = readState(postLaunchPrelaunchDate);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    writeState(postLaunchPrelaunchDate, state);
    setPostLaunchLive(postLaunchPrelaunchDate, 45);
    appendWeeklyLogRow(postLaunchPrelaunchDate, { daysAgo: 3 });
    const retroPath = path.join(postLaunchPrelaunchDate, "operations/LAUNCH_RETRO.md");
    writeFileSync(retroPath, readFileSync(retroPath, "utf8").replace("| Day 30 | | |", `| Day 30 | ${isoDaysAgo(60)} | founder |`), "utf8");
  }
  runFixture(
    "checkpoint dated before the launch does not suppress the overdue error",
    postLaunchPrelaunchDate,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.checkpoint_overdue.day_30",
  );

  // Every evidence column is typed: founder hours must be a number, not prose.
  const postLaunchKillHoursAdjective = makeFixture("post-launch-kill-hours-adjective");
  {
    const state = readState(postLaunchKillHoursAdjective);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    lane["kill_or_scale_decision"] = "kill";
    lane["kill_or_scale_decided_at"] = isoDaysAgo(25);
    writeState(postLaunchKillHoursAdjective, state);
    setPostLaunchLive(postLaunchKillHoursAdjective, 120);
    completeCheckpoint(postLaunchKillHoursAdjective, "Day 30", { daysAgo: 88, verdict: "Fix" });
    completeCheckpoint(postLaunchKillHoursAdjective, "Day 90", {
      daysAgo: 25,
      verdict: "Kill",
      evidence: ["$60 MRR declining 4 wks", "D30 4% two cohorts", "n/a — organic only", "looks healthy"],
    });
  }
  runFixture(
    "kill verdict with prose in the founder-hours cell neither exempts nor passes",
    postLaunchKillHoursAdjective,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.kill_or_scale_evidence_unmeasured",
  );

  // A blocker with an impossible embedded date is a placeholder in disguise.
  const postLaunchBogusBlocker = makeFixture("post-launch-weekly-bogus-blocker");
  {
    const state = readState(postLaunchBogusBlocker);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    writeState(postLaunchBogusBlocker, state);
    setPostLaunchLive(postLaunchBogusBlocker, 20);
    appendWeeklyLogRow(postLaunchBogusBlocker, { daysAgo: 2, crashFree: "blocked: Sentry auth 2026-99-99" });
  }
  runFixture(
    "weekly blocker with an impossible date fails the measured-value bar",
    postLaunchBogusBlocker,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.weekly_numbers_missing",
  );

  // Adjectives in the verdict evidence pack are not measurements: a Kill row
  // reading "declining / bad" must neither earn the wind-down exemption nor
  // pass the substance bar.
  const postLaunchKillAdjectives = makeFixture("post-launch-kill-adjective-evidence");
  {
    const state = readState(postLaunchKillAdjectives);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    lane["kill_or_scale_decision"] = "kill";
    lane["kill_or_scale_decided_at"] = isoDaysAgo(25);
    writeState(postLaunchKillAdjectives, state);
    setPostLaunchLive(postLaunchKillAdjectives, 120);
    completeCheckpoint(postLaunchKillAdjectives, "Day 30", { daysAgo: 88, verdict: "Fix" });
    completeCheckpoint(postLaunchKillAdjectives, "Day 90", {
      daysAgo: 25,
      verdict: "Kill",
      evidence: ["declining", "bad", "n/a", "8"],
    });
  }
  runFixture(
    "kill verdict over adjective evidence neither exempts nor passes substance",
    postLaunchKillAdjectives,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.kill_or_scale_evidence_unmeasured",
  );

  // A dollar amount that is not MRR does not satisfy the revenue contract.
  const postLaunchWrongMoney = makeFixture("post-launch-weekly-wrong-money");
  {
    const state = readState(postLaunchWrongMoney);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    writeState(postLaunchWrongMoney, state);
    setPostLaunchLive(postLaunchWrongMoney, 20);
    appendWeeklyLogRow(postLaunchWrongMoney, { daysAgo: 2, notes: "ad spend $500 this week" });
  }
  runFixture("weekly Notes with a non-MRR dollar amount fails", postLaunchWrongMoney, "check-post-launch-ops.ts", 1, "post_launch_ops.weekly_revenue_missing");

  // The wind-down exemption must be earned: a one-string state edit
  // (kill_or_scale_decision: kill) with no dated mirror and no Kill verdict in
  // the retro must not skip the weekly and checkpoint gates.
  const postLaunchKillStringOnly = makeFixture("post-launch-kill-string-only");
  {
    const state = readState(postLaunchKillStringOnly);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    lane["kill_or_scale_decision"] = "kill";
    writeState(postLaunchKillStringOnly, state);
    setPostLaunchLive(postLaunchKillStringOnly, 20);
  }
  runFixture(
    "kill decision without a dated mirror and retro verdict does not exempt the gates",
    postLaunchKillStringOnly,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.weekly_log_missing",
  );

  // A Kill verdict typed into the verdict table without the Retro Window ever
  // recording a completed checkpoint is still a dodge: the exemption requires
  // the checkpoint to have actually happened.
  const postLaunchKillNoCheckpoint = makeFixture("post-launch-kill-uncompleted-checkpoint");
  {
    const state = readState(postLaunchKillNoCheckpoint);
    expectRecord(state.project, "project")["phase"] = "phase_6";
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "partial";
    lane["kill_or_scale_decision"] = "kill";
    lane["kill_or_scale_decided_at"] = isoDaysAgo(10);
    writeState(postLaunchKillNoCheckpoint, state);
    setPostLaunchLive(postLaunchKillNoCheckpoint, 120);
    const retroPath = path.join(postLaunchKillNoCheckpoint, "operations/LAUNCH_RETRO.md");
    const retro = readFileSync(retroPath, "utf8").replace(
      "| Day 90 | | | | | | |",
      "| Day 90 | $60 MRR declining | D30 under 5% | n/a — organic only | 8 | Kill | |",
    );
    writeFileSync(retroPath, retro, "utf8");
  }
  runFixture(
    "kill verdict without a completed retro checkpoint does not exempt the gates",
    postLaunchKillNoCheckpoint,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.checkpoint_overdue.day_30",
  );

  // "TBD" or an impossible value in the Date cell is not a completed checkpoint.
  const postLaunchCheckpointTbd = makeFixture("post-launch-checkpoint-tbd-date");
  {
    const state = readState(postLaunchCheckpointTbd);
    expectRecord(state.project, "project")["phase"] = "phase_6";
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "partial";
    writeState(postLaunchCheckpointTbd, state);
    setPostLaunchLive(postLaunchCheckpointTbd, 45);
    appendWeeklyLogRow(postLaunchCheckpointTbd, { daysAgo: 3 });
    const retroPath = path.join(postLaunchCheckpointTbd, "operations/LAUNCH_RETRO.md");
    writeFileSync(retroPath, readFileSync(retroPath, "utf8").replace("| Day 30 | | |", "| Day 30 | TBD | founder |"), "utf8");
  }
  runFixture(
    "TBD in the checkpoint date cell does not suppress the overdue error",
    postLaunchCheckpointTbd,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.checkpoint_overdue.day_30",
  );

  // A future-dated weekly row must not anchor the freshness math.
  const postLaunchWeeklyFutureRow = makeFixture("post-launch-weekly-future-row");
  {
    const state = readState(postLaunchWeeklyFutureRow);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    lane["kill_or_scale_decision"] = "hold";
    lane["kill_or_scale_decided_at"] = isoDaysAgo(8);
    writeState(postLaunchWeeklyFutureRow, state);
    setPostLaunchLive(postLaunchWeeklyFutureRow, 45);
    appendWeeklyLogRow(postLaunchWeeklyFutureRow, { daysAgo: -5 });
    completeCheckpoint(postLaunchWeeklyFutureRow, "Day 30", {
      daysAgo: 8,
      verdict: "Hold",
      evidence: ["$310 MRR, flat", "D7 27% stable", "n/a — organic only", "5"],
    });
  }
  runFixture(
    "a future-dated weekly row does not satisfy the freshness gate",
    postLaunchWeeklyFutureRow,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.weekly_log_missing",
  );

  // The substance bar travels with the phase: a live app whose lane is still
  // partial cannot record a checkpoint date over an empty verdict row.
  const postLaunchPhaseEmptyVerdict = makeFixture("post-launch-phase-checkpoint-empty-verdict");
  {
    const state = readState(postLaunchPhaseEmptyVerdict);
    expectRecord(state.project, "project")["phase"] = "phase_6";
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "partial";
    writeState(postLaunchPhaseEmptyVerdict, state);
    setPostLaunchLive(postLaunchPhaseEmptyVerdict, 45);
    appendWeeklyLogRow(postLaunchPhaseEmptyVerdict, { daysAgo: 3 });
    const retroPath = path.join(postLaunchPhaseEmptyVerdict, "operations/LAUNCH_RETRO.md");
    writeFileSync(retroPath, readFileSync(retroPath, "utf8").replace("| Day 30 | | |", `| Day 30 | ${isoDaysAgo(10)} | founder |`), "utf8");
  }
  runFixture(
    "live phase with a completed checkpoint over an empty verdict row fails",
    postLaunchPhaseEmptyVerdict,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.kill_or_scale_verdict_unfilled",
  );

  // Rates without dollars are not a metrics review: the Notes cell carries MRR.
  const postLaunchWeeklyNoRevenue = makeFixture("post-launch-weekly-no-revenue");
  {
    const state = readState(postLaunchWeeklyNoRevenue);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    writeState(postLaunchWeeklyNoRevenue, state);
    setPostLaunchLive(postLaunchWeeklyNoRevenue, 20);
    appendWeeklyLogRow(postLaunchWeeklyNoRevenue, { daysAgo: 2, notes: "quiet week" });
  }
  runFixture(
    "weekly row without an MRR figure in Notes fails",
    postLaunchWeeklyNoRevenue,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.weekly_revenue_missing",
  );

  // Incidental digits inside adjectives are not measured values.
  const postLaunchWeeklyAdjective = makeFixture("post-launch-weekly-adjective-numbers");
  {
    const state = readState(postLaunchWeeklyAdjective);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    writeState(postLaunchWeeklyAdjective, state);
    setPostLaunchLive(postLaunchWeeklyAdjective, 20);
    appendWeeklyLogRow(postLaunchWeeklyAdjective, { daysAgo: 2, crashFree: "iOS 17 looks fine", d7: "D7 looks fine 4 sure" });
  }
  runFixture(
    "adjectives with incidental digits fail the measured-value bar",
    postLaunchWeeklyAdjective,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.weekly_numbers_missing",
  );

  // A recorded Kill verdict is the one legitimate way for the rhythm to stop:
  // wind-down quiet must not read as launch-and-vanish.
  const postLaunchKilledQuiet = makeFixture("post-launch-killed-app-quiet");
  {
    const state = readState(postLaunchKilledQuiet);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    lane["kill_or_scale_decision"] = "kill";
    lane["kill_or_scale_decided_at"] = isoDaysAgo(25);
    writeState(postLaunchKilledQuiet, state);
    setPostLaunchLive(postLaunchKilledQuiet, 120);
    completeCheckpoint(postLaunchKilledQuiet, "Day 30", {
      daysAgo: 88,
      verdict: "Fix",
      evidence: ["$95 MRR declining", "D7 18% → 14%", "n/a — organic only", "9"],
    });
    completeCheckpoint(postLaunchKilledQuiet, "Day 90", {
      daysAgo: 25,
      verdict: "Kill",
      evidence: ["$60 MRR declining 4 wks", "D30 under 5% two cohorts", "n/a — organic only", "8"],
    });
  }
  runFixture("killed app in wind-down with a quiet weekly log passes", postLaunchKilledQuiet, "check-post-launch-ops.ts", 0);

  // ── Portfolio registry ────────────────────────────────────────────────────

  // Optional surface: single-business founders have no registry and stay clean.
  const portfolioAbsent = makeEmptyFixture("portfolio-registry-absent");
  runFixture("missing portfolio registry is a clean no-op", portfolioAbsent, "check-portfolio-registry.ts", 0);

  // Once the registry exists it must carry the whole board, not just app rows.
  const portfolioThin = makeEmptyFixture("portfolio-registry-thin");
  writeFileSync(
    path.join(portfolioThin, "strategy/PORTFOLIO_REGISTRY.md"),
    ["# Portfolio Registry", "", "## Businesses", "", "| Business | Repo | Stage |", "| --- | --- | --- |", "| Ocho | ~/code/rork-ocho | live |"].join("\n"),
    "utf8",
  );
  runFixture(
    "portfolio registry without allocation, learnings, and pipeline fails",
    portfolioThin,
    "check-portfolio-registry.ts",
    1,
    "portfolio_registry.section_missing.allocation",
  );

  // A board with every heading and zero real business rows is a blank board
  // claiming to exist — token presence is not substance. The shipped template
  // stays inert through its _example:_ row, exercised by the audit-plan step.
  const portfolioBlank = makeEmptyFixture("portfolio-registry-blank-board");
  writeFileSync(
    path.join(portfolioBlank, "strategy/PORTFOLIO_REGISTRY.md"),
    [
      "# Portfolio Registry",
      "",
      "## Businesses",
      "",
      "| Business | Repo | Stage | MRR (trend) | Last verdict (date) |",
      "| --- | --- | --- | --- | --- |",
      "",
      "## Allocation",
      "",
      "Hours go where the verdicts point.",
      "",
      "## Cross-App Learnings",
      "",
      "| Learning | Source app | Date | Applied where next |",
      "| --- | --- | --- | --- |",
      "",
      "## Next Launch Pipeline",
      "",
      "| Idea | Evidence so far | Starts when |",
      "| --- | --- | --- |",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "portfolio registry with headings but no business rows fails",
    portfolioBlank,
    "check-portfolio-registry.ts",
    1,
    "portfolio_registry.businesses_empty",
  );

  const portfolioFilled = makeEmptyFixture("portfolio-registry-filled");
  const shippedPortfolio = readFileSync(path.join(skillRoot, "workspace", "business", "strategy/PORTFOLIO_REGISTRY.md"), "utf8");
  writeFileSync(
    path.join(portfolioFilled, "strategy/PORTFOLIO_REGISTRY.md"),
    shippedPortfolio.replace(
      /\| _example: Ocho_[^\n]*\n/,
      "| Ocho | ~/code/rork-ocho | 2026-05-29 | live | $180 flat | hold (2026-06-28) | 8 | day-90 retro |\n",
    ),
    "utf8",
  );
  runFixture("portfolio registry with a real business row passes", portfolioFilled, "check-portfolio-registry.ts", 0);

  const postLaunchThin = makeFixture("post-launch-thin-runbook");
  {
    const state = readState(postLaunchThin);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["operations/POST_LAUNCH_OPS.md", "operations/LAUNCH_RETRO.md"];
    writeState(postLaunchThin, state);
    setPostLaunchLive(postLaunchThin, 10);
    writeFileSync(
      path.join(postLaunchThin, "operations/POST_LAUNCH_OPS.md"),
      ["# Post-Launch Operations", "We will check Sentry sometimes and reply to reviews when there is time."].join("\n"),
      "utf8",
    );
  }
  runFixture("post-launch done with thin runbook fails", postLaunchThin, "check-post-launch-ops.ts", 1, "post_launch_ops.section_missing");

  // ── Backend data contract ─────────────────────────────────────────────────

  function setEngineeringDone(root: string): void {
    const state = readState(root);
    const lane = getLane(state, "engineering");
    lane["status"] = "done";
    lane["evidence"] = ["engineering/TECH_SPEC.md", "engineering/ENGINEERING_PLAN.md", "engineering/PRODUCTION_READINESS.md"];
    writeState(root, state);
  }

  const backendComplete = makeFixture("backend-contract-complete");
  setEngineeringDone(backendComplete);
  runFixture("engineering done with template data contract passes", backendComplete, "check-backend-data-contract.ts", 0);

  const backendNoSection = makeFixture("backend-contract-no-section");
  setEngineeringDone(backendNoSection);
  writeFileSync(
    path.join(backendNoSection, "engineering/TECH_SPEC.md"),
    ["# Tech Spec", "Implementation contracts are traced from state/LAUNCH_TRACE.md; schema lives wherever the builder put it."].join("\n"),
    "utf8",
  );
  runFixture("engineering done without data contract section fails", backendNoSection, "check-backend-data-contract.ts", 1, "backend_contract.section_missing");

  const backendNoSpec = makeFixture("backend-contract-no-spec");
  setEngineeringDone(backendNoSpec);
  rmSync(path.join(backendNoSpec, "engineering/TECH_SPEC.md"));
  runFixture("engineering done without tech spec fails", backendNoSpec, "check-backend-data-contract.ts", 1, "backend_contract.tech_spec_missing");

  // Words-vs-work grounding: naming RLS in prose is not tested authorization.
  const backendUntestedAuth = makeFixture("backend-contract-untested-auth");
  setEngineeringDone(backendUntestedAuth);
  writeFileSync(
    path.join(backendUntestedAuth, "engineering/TECH_SPEC.md"),
    [
      "# Tech Spec",
      "## Data Contract",
      "### Backend Selection",
      "supabase — chosen for the archetype starter default.",
      "### Data Model",
      "profiles and entities per the starter schema.",
      "### Authorization Model",
      "Enforcement: Postgres RLS policies. Deny-by-default.",
      "### Migrations And Environments",
      "Migrations run through the supabase CLI; dev/staging/prod separated.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "engineering done with untested prose-only RLS claim fails",
    backendUntestedAuth,
    "check-backend-data-contract.ts",
    1,
    "backend_contract.authorization_untested",
  );

  const backendUngroundedAuth = makeFixture("backend-contract-ungrounded-auth");
  setEngineeringDone(backendUngroundedAuth);
  writeFileSync(
    path.join(backendUngroundedAuth, "engineering/TECH_SPEC.md"),
    [
      "# Tech Spec",
      "## Data Contract",
      "### Backend Selection",
      "supabase — chosen for the archetype starter default.",
      "### Data Model",
      "profiles and entities per the starter schema.",
      "### Authorization Model",
      "Enforcement: Postgres RLS policies. Deny-by-default. Rules are tested via supabase/tests/rls.test.sql (owner, anonymous, cross-user).",
      "### Migrations And Environments",
      "Migrations run through the supabase CLI; dev/staging/prod separated.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "engineering done with tested-authz claim but no artifact on disk fails",
    backendUngroundedAuth,
    "check-backend-data-contract.ts",
    1,
    "backend_contract.authorization_proof_missing",
  );

  // Regression (verification pass): numbered headings must not defeat the
  // Authorization Model section extraction and silently widen the scan.
  const backendNumberedHeading = makeFixture("backend-contract-numbered-heading");
  setEngineeringDone(backendNumberedHeading);
  writeFileSync(
    path.join(backendNumberedHeading, "engineering/TECH_SPEC.md"),
    [
      "# Tech Spec",
      "## Data Contract",
      "### 1. Backend Selection",
      "supabase — chosen for the archetype starter default.",
      "### 2. Data Model",
      "profiles and entities per the starter schema. Integration tested elsewhere.",
      "### 3. Authorization Model",
      "Enforcement: Postgres RLS policies. Deny-by-default.",
      "### 4. Migrations And Environments",
      "Migrations run through the supabase CLI; dev/staging/prod separated.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "numbered authorization heading still gates untested prose-only RLS",
    backendNumberedHeading,
    "check-backend-data-contract.ts",
    1,
    "backend_contract.authorization_untested",
  );

  // ── Standalone Engineering Loop (CE unavailable) ──────────────────────────

  function setCeUnavailable(root: string): void {
    const state = readState(root);
    const compound = expectRecord(state.compound_engineering, "compound_engineering") as MutableRecord;
    compound["availability"] = "unavailable";
    compound["route"] = "ce_fallback";
    compound["fallback_reason"] =
      "2026-06-10: Compound Engineering plugin is not installed in this cloud runtime; standalone loop carries the same evidence bar.";
    expectRecord(compound["latest_check"], "latest_check")["status"] = "unavailable_with_reason";
    writeState(root, state);
  }

  const ceFallbackNoLoop = makeFixture("ce-fallback-no-loop");
  writeCompleteCompoundEngineering(ceFallbackNoLoop);
  setCeUnavailable(ceFallbackNoLoop);
  runFixture(
    "ce unavailable without standalone loop in plan fails",
    ceFallbackNoLoop,
    "check-compound-engineering-routing.ts",
    1,
    "compound_engineering.standalone_loop_missing",
  );

  const ceFallbackWithLoop = makeFixture("ce-fallback-with-loop");
  writeCompleteCompoundEngineering(ceFallbackWithLoop);
  setCeUnavailable(ceFallbackWithLoop);
  writeFileSync(
    path.join(ceFallbackWithLoop, "engineering/ENGINEERING_PLAN.md"),
    [
      "# Engineering Plan",
      "Compound Engineering: unavailable in this runtime; ce-plan and ce-work are replaced by the Standalone Engineering Loop with the same evidence bar.",
      "Standalone Engineering Loop: plan, bounded slices, adversarial review, test, and proof per engineering-orchestration.md section 1b.",
      "Brainstorm: product direction already decisive; brainstorm skipped with rationale recorded.",
    ].join("\n"),
    "utf8",
  );
  runFixture("ce unavailable with standalone loop in plan passes", ceFallbackWithLoop, "check-compound-engineering-routing.ts", 0);

  // ── Email lane deepening (DNS reference, unsubscribe, brand tokens) ──────

  function setEmailDone(root: string): void {
    const state = readState(root);
    const lane = getLane(state, "email");
    lane["status"] = "done";
    lane["evidence"] = ["growth/EMAIL_OPS.md"];
    writeState(root, state);
    mkdirSync(path.join(root, "proof"), { recursive: true });
    for (const proof of ["email-domain-verified.txt", "email-spf-dkim-pass.txt", "email-test-send-log.txt"]) {
      writeFileSync(path.join(root, "proof", proof), "captured 2026-06-10\n", "utf8");
    }
    appendFileSync(
      path.join(root, "SECRETS.md"),
      "\n| `RESEND_API_KEY` | Resend | server_secret | local/staging/prod | backend | server-only | Doppler project/config | founder | quarterly | routed |\n",
      "utf8",
    );
    // Populate the sender map / domain rows the template ships as placeholders.
    const emailOpsPath = path.join(root, "growth/EMAIL_OPS.md");
    const emailOps = readFileSync(emailOpsPath, "utf8")
      .replaceAll("<!-- e.g. hello@mail.example.com -->", "hello@mail.example.com")
      .replaceAll("<!-- e.g. support@example.com -->", "support@example.com")
      .replaceAll("<!-- e.g. mail.example.com -->", "mail.example.com");
    writeFileSync(emailOpsPath, emailOps, "utf8");
  }

  const emailDoneComplete = makeFixture("email-done-complete");
  setEmailDone(emailDoneComplete);
  runFixture("email lane done with dns/unsubscribe/brand contract passes", emailDoneComplete, "check-email.ts", 0);

  const emailDoneUnbranded = makeFixture("email-done-unbranded");
  setEmailDone(emailDoneUnbranded);
  {
    const emailOpsPath = path.join(emailDoneUnbranded, "growth/EMAIL_OPS.md");
    writeFileSync(emailOpsPath, readFileSync(emailOpsPath, "utf8").replaceAll("design/DESIGN.md", "the design doc"), "utf8");
  }
  runFixture("email lane done without design/DESIGN.md brand tokens fails", emailDoneUnbranded, "check-email.ts", 1, "email.brand_tokens_missing");

  const emailDoneNoDns = makeFixture("email-done-no-dns");
  setEmailDone(emailDoneNoDns);
  writeFileSync(
    path.join(emailDoneNoDns, "growth/EMAIL_OPS.md"),
    [
      "# Email Ops",
      "Sender map:",
      "| Email | From address | Template | Unsubscribe required |",
      "| --- | --- | --- | --- |",
      "| welcome | hello@mail.example.com | resend/email-templates.ts `welcomeEmail` | no (transactional) |",
      "Brand tokens pulled from design/DESIGN.md per email-templates.ts.",
    ].join("\n"),
    "utf8",
  );
  runFixture("email lane done without SPF/DKIM reference fails", emailDoneNoDns, "check-email.ts", 1, "email.dns_proof_reference_missing");

  // ── Analytics event-catalog completeness ─────────────────────────────────

  function setAnalyticsDone(root: string): void {
    const state = readState(root);
    const lane = getLane(state, "analytics_attribution");
    lane["status"] = "done";
    writeState(root, state);
  }

  const catalogReconciled = makeFixture("analytics-catalog-reconciled");
  setAnalyticsDone(catalogReconciled);
  runFixture("analytics done with reconciled event catalog passes", catalogReconciled, "check-analytics-catalog.ts", 0);

  const catalogDrift = makeFixture("analytics-catalog-drift");
  setAnalyticsDone(catalogDrift);
  appendFileSync(path.join(catalogDrift, "growth", "VIRAL_GROWTH.md"), "\n- `invented_share_event`\n", "utf8");
  runFixture(
    "analytics done with an uncataloged doc event fails",
    catalogDrift,
    "check-analytics-catalog.ts",
    1,
    "analytics_catalog.invented_share_event.uncataloged",
  );

  // revenue/REVENUE_OPS.md is a surface doc too: a billing/cancellation event named
  // there without a catalog row is the same invented-inline miss.
  const catalogRevenueDrift = makeFixture("analytics-catalog-revenue-drift");
  setAnalyticsDone(catalogRevenueDrift);
  appendFileSync(path.join(catalogRevenueDrift, "revenue/REVENUE_OPS.md"), "\n- `invented_billing_event`\n", "utf8");
  runFixture(
    "analytics done with an uncataloged revenue-doc event fails",
    catalogRevenueDrift,
    "check-analytics-catalog.ts",
    1,
    "analytics_catalog.invented_billing_event.uncataloged",
  );

  // A done REVENUE lane makes revenue-doc drift an error even while the
  // analytics lane is still partial — the revenue claim is what makes the
  // event name load-bearing.
  const catalogRevenueDoneDrift = makeFixture("analytics-catalog-revenue-done-drift");
  {
    const state = readState(catalogRevenueDoneDrift);
    getLane(state, "revenue")["status"] = "done";
    writeState(catalogRevenueDoneDrift, state);
  }
  appendFileSync(path.join(catalogRevenueDoneDrift, "revenue/REVENUE_OPS.md"), "\n- `invented_billing_event`\n", "utf8");
  runFixture(
    "done revenue lane with an uncataloged revenue-doc event fails even while analytics is partial",
    catalogRevenueDoneDrift,
    "check-analytics-catalog.ts",
    1,
    "analytics_catalog.invented_billing_event.uncataloged",
  );

  // ── Launch scope state field ──────────────────────────────────────────────
  // Renamed from launch_tier because "tier" collided with the founder's own app pricing
  // tiers. Three cases matter: an invalid current value fails, an invalid LEGACY value
  // still fails (a pre-rename business repo is not silently exempted), and the legacy
  // "lite" value still resolves to a valid scope so those repos keep validating.

  const invalidScope = makeFixture("launch-scope-invalid");
  {
    const state = readState(invalidScope);
    expectRecord(state.project, "project")["launch_scope"] = "minimal";
    writeState(invalidScope, state);
  }
  runFixture("invalid launch scope fails", invalidScope, "validate-project-state.ts", 1, "project.launch_scope.invalid");

  const invalidLegacyTier = makeFixture("launch-tier-legacy-invalid");
  {
    const state = readState(invalidLegacyTier);
    const project = expectRecord(state.project, "project");
    delete project["launch_scope"];
    project["launch_tier"] = "minimal";
    writeState(invalidLegacyTier, state);
  }
  runFixture("invalid legacy launch tier still fails", invalidLegacyTier, "validate-project-state.ts", 1, "project.launch_scope.invalid");

  const legacyLiteTier = makeFixture("launch-tier-legacy-lite");
  {
    const state = readState(legacyLiteTier);
    const project = expectRecord(state.project, "project");
    delete project["launch_scope"];
    project["launch_tier"] = "lite";
    writeState(legacyLiteTier, state);
  }
  runFixture("legacy lite launch tier still validates", legacyLiteTier, "validate-project-state.ts", 0);

  // ── The pre-build clock ───────────────────────────────────────────────────
  // kickoff_date starts the pre-build clock at orient; a launch still in
  // phases 0-2 past 45 days is surfaced as a stall, because most dead launches
  // die in planning with nobody ever deciding to stop.
  const clockIsoDaysAgo = (days: number): string => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
  };

  const kickoffStalled = makeFixture("kickoff-pre-build-stall");
  {
    const state = readState(kickoffStalled);
    const project = expectRecord(state.project, "project");
    project["kickoff_date"] = clockIsoDaysAgo(60);
    writeState(kickoffStalled, state);
  }
  runFixture("launch still pre-build 60 days after kickoff surfaces the stall", kickoffStalled, "validate-project-state.ts", 0, "project.pre_build_stall");

  const kickoffFresh = makeFixture("kickoff-fresh");
  {
    const state = readState(kickoffFresh);
    const project = expectRecord(state.project, "project");
    project["kickoff_date"] = clockIsoDaysAgo(10);
    writeState(kickoffFresh, state);
  }
  runFixture("fresh kickoff in pre-build passes without stall findings", kickoffFresh, "validate-project-state.ts", 0);

  // The blank seed is legitimate only during orientation: past orient, a
  // missing kickoff date is a clock that can never fire.
  const kickoffMissingPastOrient = makeFixture("kickoff-missing-past-orient");
  {
    const state = readState(kickoffMissingPastOrient);
    expectRecord(state.project, "project")["phase"] = "phase_1_research";
    writeState(kickoffMissingPastOrient, state);
  }
  runFixture("blank kickoff date past orientation fails", kickoffMissingPastOrient, "validate-project-state.ts", 1, "project.kickoff_date.missing");

  const kickoffInvalid = makeFixture("kickoff-invalid-date");
  {
    const state = readState(kickoffInvalid);
    const project = expectRecord(state.project, "project");
    project["kickoff_date"] = "2026-99-99";
    writeState(kickoffInvalid, state);
  }
  runFixture("invalid kickoff date fails", kickoffInvalid, "validate-project-state.ts", 1, "project.kickoff_date.invalid");

  // ── Scope-skip exit regression ────────────────────────────────────────────
  // The skip paths used process.exit(0), which discarded the
  // project_state.missing error reportAndExit had already emitted (exit 0 with
  // "1 error(s)" printed). The skip path must still fail on a missing state.

  const postLaunchNoState = makeEmptyFixture("post-launch-missing-state");
  runFixture("post-launch ops fails loudly when project state is missing", postLaunchNoState, "check-post-launch-ops.ts", 1, "project_state.missing");
}
