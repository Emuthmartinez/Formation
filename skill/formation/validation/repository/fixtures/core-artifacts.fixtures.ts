import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Harness, expectRecord, getLane, readState, writeState } from "./_harness.js";

/**
 * Fixtures for the lane content validators added after the deep audit found that
 * product, privacy_legal, traceability, and research had no dedicated validator —
 * only the generic lane-coverage status floor. U11/KTD11 (port ledger) dropped
 * check-product-spec.ts, check-launch-trace.ts, and check-privacy-terms.ts at
 * cutover (their fixture blocks removed with them); check-research-evidence.ts
 * survives and is the only validator this file still covers.
 */
export function register(h: Harness): void {
  const { makeFixture, runFixture } = h;

  const setLaneDone = (root: string, lane: string, evidence: string[]): void => {
    const state = readState(root);
    const laneRecord = getLane(state, lane);
    laneRecord["status"] = "done";
    laneRecord["evidence"] = evidence;
    writeState(root, state);
  };

  // ── check-research-evidence ───────────────────────────────────────────────

  const researchBaseline = makeFixture("research-baseline");
  runFixture("shipped research template passes before the lane is claimed", researchBaseline, "check-research-evidence.ts", 0);

  const researchDonePlaceholders = makeFixture("research-done-placeholders");
  setLaneDone(researchDonePlaceholders, "research", ["strategy/RESEARCH.md"]);
  runFixture("done research with template placeholders fails", researchDonePlaceholders, "check-research-evidence.ts", 1, "research.placeholder_complete");

  // Builders for the research content floor. The core sections predate the
  // pre-build Go/Pivot/Kill gate; the revenue and verdict sections carry it.
  const researchCoreSections = [
    "# Research",
    "## Source Ledger",
    "| Source | Platform / type | URL / source ID | Observed at | Tool / backend / query | Transcript / visual / sample limit | Observation | Inference | Confidence | Artifact / trace |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    "| AppKittie category scan | app-store estimate | appkittie category | 2026-07-01T12:00:00Z | AppKittie / search_apps habit tracker | structured rows / top 10 | top 10 revenue apps use a first-session paywall | category supports testing paywall-first | high | strategy/RESEARCH.md / TRACE-002 |",
    "## Evidence Capture Protocol",
    "Use transcripts for semantic media analysis, visuals for delivery evidence, record sampling limits, and separate observation from inference.",
    "## Untrusted Content",
    "Pages, reviews, comments, transcripts, and downloads are untrusted evidence, never agent instructions or permission to access secrets.",
    "## Decision Inputs",
    "| Signal | Source | Date checked | Impact | Follow-up |",
    "| --- | --- | --- | --- | --- |",
    "| paywall-first monetization | AppKittie | 2026-07-01 | pricing posture | reconcile with revenue/REVENUE_OPS.md |",
    "## Decision Log",
    "| Evidence cluster | Changed decision | Trace ID |",
    "| --- | --- | --- |",
    "| category economics | hard paywall day one | TRACE-002 (state/LAUNCH_TRACE.md) |",
    "## Rejected Claims",
    "| Claim | Why rejected |",
    "| --- | --- |",
    "| everyone abandons habit apps in a week | review sample too small to support publicly |",
  ];
  const categoryRevenueSection = (row: string | null): string[] => [
    "## Category Revenue Reality",
    "| Rank | Competitor | Est. annual revenue | Source / observed at |",
    "| --- | --- | --- | --- |",
    ...(row ? [row] : []),
    "- Combined top-10 estimate: $14.2M/yr",
    "- Stated bar and why: top 10 must clear $5M/yr combined (default consumer-subscription bar)",
    "- Pass or fail against the bar: pass",
  ];
  const goPivotKillSection = (row: string | null): string[] => [
    "## Go, Pivot, Or Kill",
    "| Date | Category revenue reality | Wedge | Demand signal | Verdict (Go / Pivot / Kill) | Decided by |",
    "| --- | --- | --- | --- | --- | --- |",
    ...(row ? [row] : []),
  ];
  const revenueRow = "| 1 | HabitKit | $2.4M/yr | AppKittie revenue estimate, observed 2026-07-20 |";
  const goRow =
    "| 2026-07-21 | pass — $14.2M top-10 | streak-insurance mechanic incumbents price-gate | 412-person waitlist from social mining | Go | founder |";
  const writeResearch = (root: string, sections: string[]): void => {
    writeFileSync(path.join(root, "strategy/RESEARCH.md"), sections.join("\n"), "utf8");
  };
  const setResearchVerdictState = (root: string, decision: string, decidedAt: string): void => {
    const state = readState(root);
    const lane = getLane(state, "research");
    lane["go_pivot_kill_decision"] = decision;
    lane["go_pivot_kill_decided_at"] = decidedAt;
    writeState(root, state);
  };

  const researchDoneReal = makeFixture("research-done-real");
  setLaneDone(researchDoneReal, "research", ["strategy/RESEARCH.md"]);
  setResearchVerdictState(researchDoneReal, "go", "2026-07-21");
  writeResearch(researchDoneReal, [...researchCoreSections, ...categoryRevenueSection(revenueRow), ...goPivotKillSection(goRow)]);
  runFixture("done research with dated, traced evidence and a Go verdict passes", researchDoneReal, "check-research-evidence.ts", 0);

  // Pre-build kill gate: the sections the 2026-07-26 audit found missing —
  // research that never converts evidence into a build-or-not decision.
  const researchNoVerdictSection = makeFixture("research-done-no-verdict-section");
  setLaneDone(researchNoVerdictSection, "research", ["strategy/RESEARCH.md"]);
  writeResearch(researchNoVerdictSection, researchCoreSections);
  runFixture(
    "done research without the go-pivot-kill section fails",
    researchNoVerdictSection,
    "check-research-evidence.ts",
    1,
    "research.go_pivot_or_kill.missing",
  );

  const researchVerdictRowMissing = makeFixture("research-done-verdict-row-missing");
  setLaneDone(researchVerdictRowMissing, "research", ["strategy/RESEARCH.md"]);
  setResearchVerdictState(researchVerdictRowMissing, "go", "2026-07-21");
  writeResearch(researchVerdictRowMissing, [...researchCoreSections, ...categoryRevenueSection(revenueRow), ...goPivotKillSection(null)]);
  runFixture(
    "done research with an empty verdict table fails",
    researchVerdictRowMissing,
    "check-research-evidence.ts",
    1,
    "research.go_pivot_kill_row_missing",
  );

  // A done research lane whose latest verdict is Kill or Pivot is a
  // contradiction: Kill winds down pre-build, Pivot re-enters the phase.
  const researchNotGo = makeFixture("research-done-not-go");
  setLaneDone(researchNotGo, "research", ["strategy/RESEARCH.md"]);
  setResearchVerdictState(researchNotGo, "kill", "2026-07-21");
  writeResearch(researchNotGo, [
    ...researchCoreSections,
    ...categoryRevenueSection(revenueRow),
    ...goPivotKillSection("| 2026-07-21 | fail — $180K top-10 | no defensible wedge found | no demand signal | Kill | founder |"),
  ]);
  runFixture("done research whose latest verdict is Kill fails", researchNotGo, "check-research-evidence.ts", 1, "research.go_pivot_kill_not_go");

  const researchVerdictNoMirror = makeFixture("research-done-verdict-no-mirror");
  setLaneDone(researchVerdictNoMirror, "research", ["strategy/RESEARCH.md"]);
  writeResearch(researchVerdictNoMirror, [...researchCoreSections, ...categoryRevenueSection(revenueRow), ...goPivotKillSection(goRow)]);
  runFixture(
    "recorded Go verdict without the PROJECT_STATE mirror fails",
    researchVerdictNoMirror,
    "check-research-evidence.ts",
    1,
    "research.go_pivot_kill_state_missing",
  );

  const researchVerdictMismatch = makeFixture("research-done-verdict-mismatch");
  setLaneDone(researchVerdictMismatch, "research", ["strategy/RESEARCH.md"]);
  setResearchVerdictState(researchVerdictMismatch, "pivot", "2026-07-21");
  writeResearch(researchVerdictMismatch, [...researchCoreSections, ...categoryRevenueSection(revenueRow), ...goPivotKillSection(goRow)]);
  runFixture(
    "state mirror disagreeing with the recorded verdict fails",
    researchVerdictMismatch,
    "check-research-evidence.ts",
    1,
    "research.go_pivot_kill_state_mismatch",
  );

  // Collecting AppKittie data is not the gate; the judged revenue row is.
  const researchRevenueRowMissing = makeFixture("research-done-revenue-row-missing");
  setLaneDone(researchRevenueRowMissing, "research", ["strategy/RESEARCH.md"]);
  setResearchVerdictState(researchRevenueRowMissing, "go", "2026-07-21");
  writeResearch(researchRevenueRowMissing, [...researchCoreSections, ...categoryRevenueSection(null), ...goPivotKillSection(goRow)]);
  runFixture(
    "done research without a real category revenue row fails",
    researchRevenueRowMissing,
    "check-research-evidence.ts",
    1,
    "research.category_revenue_row_missing",
  );

  // A dollar amount drifting outside the revenue column, or a blank source,
  // is data-shaped text rather than a sourced estimate.
  const researchRevenueUnsourced = makeFixture("research-done-revenue-unsourced");
  setLaneDone(researchRevenueUnsourced, "research", ["strategy/RESEARCH.md"]);
  setResearchVerdictState(researchRevenueUnsourced, "go", "2026-07-21");
  writeResearch(researchRevenueUnsourced, [
    ...researchCoreSections,
    ...categoryRevenueSection("| 1 | HabitKit ($2.4M/yr claimed) | strong | |"),
    ...goPivotKillSection(goRow),
  ]);
  runFixture(
    "revenue estimate outside its column with a blank source fails",
    researchRevenueUnsourced,
    "check-research-evidence.ts",
    1,
    "research.category_revenue_row_missing",
  );

  // The gate is founder-only: a Go row naming no decision-maker is the agent
  // deciding to build for itself.
  const researchNoDecider = makeFixture("research-done-no-decider");
  setLaneDone(researchNoDecider, "research", ["strategy/RESEARCH.md"]);
  setResearchVerdictState(researchNoDecider, "go", "2026-07-21");
  writeResearch(researchNoDecider, [
    ...researchCoreSections,
    ...categoryRevenueSection(revenueRow),
    ...goPivotKillSection("| 2026-07-21 | pass — $14.2M top-10 | streak-insurance wedge | 412-person waitlist | Go | |"),
  ]);
  runFixture("Go verdict with an empty decided-by cell fails", researchNoDecider, "check-research-evidence.ts", 1, "research.go_pivot_kill_decider_missing");

  // The mirror's date must match the verdict row, not merely be date-shaped.
  const researchDateMismatch = makeFixture("research-done-decided-at-mismatch");
  setLaneDone(researchDateMismatch, "research", ["strategy/RESEARCH.md"]);
  setResearchVerdictState(researchDateMismatch, "go", "2026-07-01");
  writeResearch(researchDateMismatch, [...researchCoreSections, ...categoryRevenueSection(revenueRow), ...goPivotKillSection(goRow)]);
  runFixture(
    "state mirror dated differently from the verdict row fails",
    researchDateMismatch,
    "check-research-evidence.ts",
    1,
    "research.go_pivot_kill_state_mismatch",
  );

  // The gate fires the moment downstream design work becomes active, whatever
  // the recorded phase says.
  const researchDesignActive = makeFixture("research-phase1-design-active");
  {
    const state = readState(researchDesignActive);
    const research = getLane(state, "research");
    research["status"] = "partial";
    const design = getLane(state, "design");
    design["status"] = "partial";
    design["evidence"] = ["design/design.md"];
    writeState(researchDesignActive, state);
  }
  runFixture(
    "active design work at phase_1 with no verdict fails the gate",
    researchDesignActive,
    "check-research-evidence.ts",
    1,
    "research.go_pivot_kill_row_missing",
  );

  // A malformed later decision must never silently lose to an older one.
  const researchMalformedFollowup = makeFixture("research-done-malformed-followup");
  setLaneDone(researchMalformedFollowup, "research", ["strategy/RESEARCH.md"]);
  setResearchVerdictState(researchMalformedFollowup, "go", "2026-07-21");
  writeResearch(researchMalformedFollowup, [
    ...researchCoreSections,
    ...categoryRevenueSection(revenueRow),
    ...goPivotKillSection(goRow),
    "| 07/22/2026 | fail on re-read | wedge collapsed | waitlist bot-inflated | Kill | founder |",
  ]);
  runFixture(
    "mistyped date on a follow-up verdict row fails instead of being dropped",
    researchMalformedFollowup,
    "check-research-evidence.ts",
    1,
    "research.go_pivot_kill_row_malformed",
  );

  // The decision-maker reads from the named column: a Notes cell after Verdict
  // containing "founder" must not satisfy the gate.
  const researchNotesAfterVerdict = makeFixture("research-done-notes-after-verdict");
  setLaneDone(researchNotesAfterVerdict, "research", ["strategy/RESEARCH.md"]);
  setResearchVerdictState(researchNotesAfterVerdict, "go", "2026-07-21");
  writeResearch(researchNotesAfterVerdict, [
    ...researchCoreSections,
    ...categoryRevenueSection(revenueRow),
    "## Go, Pivot, Or Kill",
    "| Date | Category revenue reality | Wedge | Demand signal | Verdict (Go / Pivot / Kill) | Notes |",
    "| --- | --- | --- | --- | --- | --- |",
    "| 2026-07-21 | pass — $14.2M top-10 | streak-insurance wedge | 412-person waitlist | Go | founder said fine |",
  ]);
  runFixture(
    "notes column after the verdict does not satisfy the decided-by gate",
    researchNotesAfterVerdict,
    "check-research-evidence.ts",
    1,
    "research.go_pivot_kill_decider_missing",
  );

  // Deferring research out of existence is not a route around the checkpoint:
  // at phase_2+ the artifact and its verdict are mandatory regardless of status.
  const researchDeferredPhase2 = makeFixture("research-deferred-phase2");
  {
    const state = readState(researchDeferredPhase2);
    expectRecord(state.project, "project")["phase"] = "phase_2_design";
    const lane = getLane(state, "research");
    lane["status"] = "deferred";
    lane["reason"] = "2026-07-20 essentials scope defers deep research; revisit at day 30.";
    writeState(researchDeferredPhase2, state);
    rmSync(path.join(researchDeferredPhase2, "strategy/RESEARCH.md"), { force: true });
  }
  runFixture(
    "phase_2 with deferred research and no strategy/RESEARCH.md fails",
    researchDeferredPhase2,
    "check-research-evidence.ts",
    1,
    "research.markdown_missing",
  );

  // Later table rows win date ties: a same-day follow-up Kill supersedes the
  // Go recorded above it, and a mirror still saying go must fail.
  const researchSameDayReversal = makeFixture("research-same-day-reversal");
  setLaneDone(researchSameDayReversal, "research", ["strategy/RESEARCH.md"]);
  setResearchVerdictState(researchSameDayReversal, "go", "2026-07-21");
  writeResearch(researchSameDayReversal, [
    ...researchCoreSections,
    ...categoryRevenueSection(revenueRow),
    ...goPivotKillSection(goRow),
    "| 2026-07-21 | fail on re-read — $180K top-10 | wedge collapsed under teardown | waitlist was bot-inflated | Kill | founder |",
  ]);
  runFixture(
    "same-day follow-up verdict supersedes the earlier row",
    researchSameDayReversal,
    "check-research-evidence.ts",
    1,
    "research.go_pivot_kill_state_mismatch",
  );

  // The founder counts by recorded name, not only by the literal role word.
  const researchNamedFounder = makeFixture("research-done-named-founder");
  {
    const state = readState(researchNamedFounder);
    expectRecord(state.project, "project")["owner"] = "Daisy Rivera";
    writeState(researchNamedFounder, state);
  }
  setLaneDone(researchNamedFounder, "research", ["strategy/RESEARCH.md"]);
  setResearchVerdictState(researchNamedFounder, "go", "2026-07-21");
  writeResearch(researchNamedFounder, [
    ...researchCoreSections,
    ...categoryRevenueSection(revenueRow),
    ...goPivotKillSection("| 2026-07-21 | pass — $14.2M top-10 | streak-insurance wedge | 412-person waitlist | Go | Daisy Rivera |"),
  ]);
  runFixture("verdict decided by the recorded owner name passes", researchNamedFounder, "check-research-evidence.ts", 0);

  // Renamed evidence columns carry cells, not the required inputs.
  const researchRenamedColumns = makeFixture("research-done-renamed-columns");
  setLaneDone(researchRenamedColumns, "research", ["strategy/RESEARCH.md"]);
  setResearchVerdictState(researchRenamedColumns, "go", "2026-07-21");
  writeResearch(researchRenamedColumns, [
    ...researchCoreSections,
    ...categoryRevenueSection(revenueRow),
    "## Go, Pivot, Or Kill",
    "| Date | Notes | Opinion | Summary | Verdict (Go / Pivot / Kill) | Decided by |",
    "| --- | --- | --- | --- | --- | --- |",
    "| 2026-07-21 | fine | strong | looks good | Go | founder |",
  ]);
  runFixture(
    "verdict table with renamed evidence columns fails",
    researchRenamedColumns,
    "check-research-evidence.ts",
    1,
    "research.go_pivot_kill_evidence_columns_missing",
  );

  // The gate cannot wait for the lane to claim done: a project in phase_2 with
  // research still partial is the bypass the checkpoint exists to stop.
  const researchPhase2Partial = makeFixture("research-phase2-partial-no-verdict");
  {
    const state = readState(researchPhase2Partial);
    expectRecord(state.project, "project")["phase"] = "phase_2_design";
    const lane = getLane(state, "research");
    lane["status"] = "partial";
    writeState(researchPhase2Partial, state);
  }
  runFixture(
    "phase_2 with partial research and no verdict fails the pre-build gate",
    researchPhase2Partial,
    "check-research-evidence.ts",
    1,
    "research.go_pivot_kill_row_missing",
  );

  // The verdict is founder-only: an automation identity in Decided by is the
  // agent approving its own build.
  const researchAgentDecider = makeFixture("research-done-agent-decider");
  setLaneDone(researchAgentDecider, "research", ["strategy/RESEARCH.md"]);
  setResearchVerdictState(researchAgentDecider, "go", "2026-07-21");
  writeResearch(researchAgentDecider, [
    ...researchCoreSections,
    ...categoryRevenueSection(revenueRow),
    ...goPivotKillSection("| 2026-07-21 | pass — $14.2M top-10 | streak-insurance wedge | 412-person waitlist | Go | Claude agent |"),
  ]);
  runFixture(
    "Go verdict decided by an automation identity fails",
    researchAgentDecider,
    "check-research-evidence.ts",
    1,
    "research.go_pivot_kill_decider_missing",
  );

  // The phrase in prose is not the section: mentioning both gates informally
  // must not skip their substance checks.
  const researchProseSections = makeFixture("research-done-prose-sections");
  setLaneDone(researchProseSections, "research", ["strategy/RESEARCH.md"]);
  setResearchVerdictState(researchProseSections, "go", "2026-07-21");
  writeResearch(researchProseSections, [...researchCoreSections, "We considered Category Revenue Reality and ran Go, Pivot, Or Kill informally over coffee."]);
  runFixture(
    "prose mention of the gate sections without the headings fails",
    researchProseSections,
    "check-research-evidence.ts",
    1,
    "research.category_revenue_reality.section_missing",
  );

  // A verdict table stripped of its evidence columns makes every evidence
  // check vacuously pass.
  const researchNoEvidenceColumns = makeFixture("research-done-no-evidence-columns");
  setLaneDone(researchNoEvidenceColumns, "research", ["strategy/RESEARCH.md"]);
  setResearchVerdictState(researchNoEvidenceColumns, "go", "2026-07-21");
  writeResearch(researchNoEvidenceColumns, [
    ...researchCoreSections,
    ...categoryRevenueSection(revenueRow),
    "## Go, Pivot, Or Kill",
    "| Date | Verdict (Go / Pivot / Kill) | Decided by |",
    "| --- | --- | --- |",
    "| 2026-07-21 | Go | founder |",
  ]);
  runFixture(
    "verdict table without evidence columns fails",
    researchNoEvidenceColumns,
    "check-research-evidence.ts",
    1,
    "research.go_pivot_kill_evidence_columns_missing",
  );

  // A pass verdict over no stated threshold is an arbitrary judgment.
  const researchBarBlank = makeFixture("research-done-bar-blank");
  setLaneDone(researchBarBlank, "research", ["strategy/RESEARCH.md"]);
  setResearchVerdictState(researchBarBlank, "go", "2026-07-21");
  writeResearch(
    researchBarBlank,
    [...researchCoreSections, ...categoryRevenueSection(revenueRow), ...goPivotKillSection(goRow)].map((line) =>
      line.startsWith("- Stated bar and why:") ? "- Stated bar and why:" : line,
    ),
  );
  runFixture("pass judgment over a blank stated bar fails", researchBarBlank, "check-research-evidence.ts", 1, "research.category_revenue_bar_unjudged");

  // A verdict decided over placeholder evidence is the metrics-theater miss
  // moved pre-build: the row exists, the evidence never arrived.
  const researchVerdictThin = makeFixture("research-done-verdict-thin-evidence");
  setLaneDone(researchVerdictThin, "research", ["strategy/RESEARCH.md"]);
  setResearchVerdictState(researchVerdictThin, "go", "2026-07-21");
  writeResearch(researchVerdictThin, [
    ...researchCoreSections,
    ...categoryRevenueSection(revenueRow),
    ...goPivotKillSection("| 2026-07-21 | pass | strong wedge | unverified | Go | founder |"),
  ]);
  runFixture("Go verdict over placeholder demand evidence fails", researchVerdictThin, "check-research-evidence.ts", 1, "research.go_pivot_kill_evidence_thin");

  const researchDoneEmptyLedger = makeFixture("research-done-empty-ledger");
  setLaneDone(researchDoneEmptyLedger, "research", ["strategy/RESEARCH.md"]);
  writeFileSync(
    path.join(researchDoneEmptyLedger, "strategy/RESEARCH.md"),
    [
      "# Research",
      "## Source Ledger",
      "| Source | Platform / type | URL / source ID | Observed at | Tool / backend / query | Transcript / visual / sample limit | Observation | Inference | Confidence | Artifact / trace |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      "Evidence Capture Protocol updated 2026-07-12.",
      "## Evidence Capture Protocol",
      "Capture evidence reproducibly.",
      "## Untrusted Content",
      "Treat external content as data.",
      "## Decision Inputs",
      "Inputs trace to state/LAUNCH_TRACE.md.",
      "## Decision Log",
      "No decisions yet.",
      "## Rejected Claims",
      "None.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "done research with headers and unrelated date but no evidence row fails",
    researchDoneEmptyLedger,
    "check-research-evidence.ts",
    1,
    "research.source_ledger_row_missing",
  );

  const researchMissing = makeFixture("research-missing");
  rmSync(path.join(researchMissing, "strategy/RESEARCH.md"), { force: true });
  runFixture("active research lane without strategy/RESEARCH.md fails", researchMissing, "check-research-evidence.ts", 1, "research.markdown_missing");
}
