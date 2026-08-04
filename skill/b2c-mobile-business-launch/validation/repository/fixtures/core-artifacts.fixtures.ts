import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Harness, expectRecord, getLane, readState, writeState } from "./_harness.js";

/**
 * Fixtures for the four lane content validators added after the deep audit
 * found that product, privacy_legal, traceability, and research had no
 * dedicated validator — only the generic lane-coverage status floor.
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
    design["evidence"] = ["design/DESIGN.md"];
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

  // ── check-product-spec ────────────────────────────────────────────────────

  const specBaseline = makeFixture("product-spec-baseline");
  runFixture("shipped product spec template passes before the lane is claimed", specBaseline, "check-product-spec.ts", 0);

  const specDonePlaceholders = makeFixture("product-spec-done-placeholders");
  setLaneDone(specDonePlaceholders, "product", ["product/SPEC.md"]);
  runFixture("done product lane with template placeholders fails", specDonePlaceholders, "check-product-spec.ts", 1, "product_spec.placeholder_complete");

  const specMissing = makeFixture("product-spec-missing");
  rmSync(path.join(specMissing, "product/SPEC.md"), { force: true });
  runFixture("active product lane without product/SPEC.md fails", specMissing, "check-product-spec.ts", 1, "product_spec.markdown_missing");

  // Differentiation substance: the wedge lives in the spec, held to
  // product-moat.md's tests — not in a positioning chat.
  const specSections = (moat: { row: string | null; moatClass: string; copyTest: string }): string =>
    [
      "# Product Spec",
      "## Promise",
      "One tap turns a missed habit into a repair plan.",
      "## 11-Star Experience",
      "Ladder and magical moment per 11_STAR_EXPERIENCE.md and 11-star-experience.html.",
      "## Category And Competitors",
      "Health & Fitness storefront per strategy/RESEARCH.md category evidence; threat model below.",
      "## Differentiation And Moat",
      "| Incumbent (top by revenue) | What it does well | The beat moment (where we win) | What stops a week-one copy |",
      "| --- | --- | --- | --- |",
      ...(moat.row ? [moat.row] : []),
      `- Moat class (data / workflow / community / taste / model / distribution) and build plan: ${moat.moatClass}`,
      `- One-week-copy test answer: ${moat.copyTest}`,
      "## Core Product Loop",
      "Check in, see drift, repair the week.",
      "## V1 Scalable Slice",
      "Three habits, one weekly ritual; V2 holds social features; bans fake streaks.",
      "## Monetization Posture",
      "Hard paywall after first value; pricing reconciled with revenue/REVENUE_OPS.md.",
      "## Metrics",
      "Activation and D7 defined in analytics/ANALYTICS.md.",
      "## Acceptance Contract",
      "| Flow | User value | Data needed | Edge states | Proof |",
      "| --- | --- | --- | --- | --- |",
      "| First value | repair plan | onboarding answers | loading, retry, empty | product/ONBOARDING.md |",
      "## Risks And Open Questions",
      "Evidence appendix: strategy/RESEARCH.md, state/LAUNCH_TRACE.md.",
    ].join("\n");
  const realIncumbentRow =
    "| HabitKit | fast logging, wide templates | streak-insurance at the miss moment | miss-history data accrues day one; repair pricing their mix cannot follow |";
  const secondIncumbentRow =
    "| Streaks | polished native logging, wide device sync | our repair flow at the broken-streak moment | miss-history depth their local-only storage cannot mirror |";
  const twoIncumbentRows = `${realIncumbentRow}\n${secondIncumbentRow}`;
  // Writes the spec AND grounds its incumbent names in strategy/RESEARCH.md — the
  // validator now cross-checks names against research competitor evidence.
  const groundIncumbents = (root: string, row: string | null): void => {
    const names = (row ?? "")
      .split("\n")
      .map((line) => (line.replace(/^\|/, "").split(/(?<!\\)\|/)[0] ?? "").trim())
      .filter(Boolean);
    if (names.length === 0) return;
    const researchPath = path.join(root, "strategy/RESEARCH.md");
    const existing = readFileSync(researchPath, "utf8");
    writeFileSync(researchPath, `${existing}\nCompetitor evidence: ${names.join(", ")} lead the category by revenue.\n`, "utf8");
  };
  const writeMoatSpec = (root: string, moat: { row: string | null; moatClass: string; copyTest: string }): void => {
    writeFileSync(path.join(root, "product/SPEC.md"), specSections(moat), "utf8");
    groundIncumbents(root, moat.row);
  };

  const specDoneReal = makeFixture("product-spec-done-real");
  setLaneDone(specDoneReal, "product", ["product/SPEC.md"]);
  writeMoatSpec(specDoneReal, {
    row: twoIncumbentRows,
    moatClass: "data — per-user miss history compounds weekly",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("done product spec with a real incumbent row and moat class passes", specDoneReal, "check-product-spec.ts", 0);

  const specNoIncumbent = makeFixture("product-spec-done-no-incumbent-row");
  setLaneDone(specNoIncumbent, "product", ["product/SPEC.md"]);
  writeFileSync(
    path.join(specNoIncumbent, "product/SPEC.md"),
    specSections({ row: null, moatClass: "data — per-user miss history", copyTest: "history the copy lacks" }),
    "utf8",
  );
  runFixture("done product spec without a real incumbent row fails", specNoIncumbent, "check-product-spec.ts", 1, "product_spec.incumbent_row_missing");

  const specNoMoatClass = makeFixture("product-spec-done-no-moat-class");
  setLaneDone(specNoMoatClass, "product", ["product/SPEC.md"]);
  writeFileSync(
    path.join(specNoMoatClass, "product/SPEC.md"),
    specSections({ row: realIncumbentRow, moatClass: "we will out-execute them", copyTest: "history the copy lacks" }),
    "utf8",
  );
  runFixture("done product spec without a named moat class fails", specNoMoatClass, "check-product-spec.ts", 1, "product_spec.moat_class_missing");

  // A prose mention satisfies the section-name scan but carries no section —
  // the substance checks run against nothing and fail.
  const specMoatProseMention = makeFixture("product-spec-moat-prose-mention");
  setLaneDone(specMoatProseMention, "product", ["product/SPEC.md"]);
  writeFileSync(
    path.join(specMoatProseMention, "product/SPEC.md"),
    specSections({
      row: realIncumbentRow,
      moatClass: "data — per-user miss history compounds weekly",
      copyTest: "the repair model needs miss-history no fresh install has",
    }).replace("## Differentiation And Moat", "Differentiation And Moat: covered in the strategy docs."),
    "utf8",
  );
  runFixture(
    "a prose mention of the moat section without the section fails",
    specMoatProseMention,
    "check-product-spec.ts",
    1,
    "product_spec.incumbent_row_missing",
  );

  // "pending" is not a copy-test answer.
  const specCopyTestPending = makeFixture("product-spec-copy-test-pending");
  setLaneDone(specCopyTestPending, "product", ["product/SPEC.md"]);
  writeFileSync(
    path.join(specCopyTestPending, "product/SPEC.md"),
    specSections({ row: realIncumbentRow, moatClass: "data — per-user miss history compounds weekly", copyTest: "pending" }),
    "utf8",
  );
  runFixture("a placeholder one-week-copy answer fails", specCopyTestPending, "check-product-spec.ts", 1, "product_spec.copy_test_missing");

  // An answer that concedes the copy test is a failed test.
  const specCopyTestConceded = makeFixture("product-spec-copy-test-conceded");
  setLaneDone(specCopyTestConceded, "product", ["product/SPEC.md"]);
  writeMoatSpec(specCopyTestConceded, {
    row: realIncumbentRow,
    moatClass: "data — per-user miss history compounds weekly",
    copyTest: "Nothing stops them; this is copied in a sprint.",
  });
  runFixture("a conceding one-week-copy answer fails", specCopyTestConceded, "check-product-spec.ts", 1, "product_spec.copy_test_missing");

  // Disclaiming every class while naming them all is not a moat class.
  const specMoatClassNone = makeFixture("product-spec-moat-class-none");
  setLaneDone(specMoatClassNone, "product", ["product/SPEC.md"]);
  writeMoatSpec(specMoatClassNone, {
    row: realIncumbentRow,
    moatClass: "none — there is no data, workflow, community, taste, model, or distribution moat",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("a negated moat-class declaration fails", specMoatClassNone, "check-product-spec.ts", 1, "product_spec.moat_class_missing");

  // The doctrine's V1 exception: no moat yet, racing to build a named, dated class.
  const specMoatV1Exception = makeFixture("product-spec-moat-v1-exception");
  setLaneDone(specMoatV1Exception, "product", ["product/SPEC.md"]);
  writeMoatSpec(specMoatV1Exception, {
    row: twoIncumbentRows,
    moatClass: "no moat yet, racing to build data — miss-history compounding by 2026-08-25, revisited at the day-30 retro",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("the named-and-dated V1 no-moat exception passes", specMoatV1Exception, "check-product-spec.ts", 0);

  // N/A cells name no incumbent.
  const specIncumbentNaCells = makeFixture("product-spec-incumbent-na-cells");
  setLaneDone(specIncumbentNaCells, "product", ["product/SPEC.md"]);
  writeMoatSpec(specIncumbentNaCells, {
    row: "| N/A | none | unknown | N/A |",
    moatClass: "data — per-user miss history compounds weekly",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("an incumbent row of N/A cells fails", specIncumbentNaCells, "check-product-spec.ts", 1, "product_spec.incumbent_row_missing");

  // The filled shipped template must pass: its guidance prose contains "moat
  // class" and a colon, and must never shadow the labeled answer line.
  const specTemplateFilled = makeFixture("product-spec-template-filled");
  setLaneDone(specTemplateFilled, "product", ["product/SPEC.md"]);
  {
    const templateSpec = readFileSync(path.join(specTemplateFilled, "product/SPEC.md"), "utf8")
      .replace(/^\| _example:.*$/m, twoIncumbentRows)
      .replace(
        "- Moat class (data / workflow / community / taste / model / distribution) and build plan:",
        "- Moat class (data / workflow / community / taste / model / distribution) and build plan: data — per-user miss history compounds weekly.",
      )
      .replace("- One-week-copy test answer:", "- One-week-copy test answer: the repair model needs miss-history no fresh install has.")
      .replace(/<!--[^>]*replace with[^>]*-->/gi, "");
    writeFileSync(path.join(specTemplateFilled, "product/SPEC.md"), templateSpec.replace(/\breplace with\b|\b(TODO|TBD)\b/gi, "filled"), "utf8");
  }
  groundIncumbents(specTemplateFilled, twoIncumbentRows);
  runFixture("the filled shipped template passes the moat gate", specTemplateFilled, "check-product-spec.ts", 0);

  // The doctrine's named nonanswers are copied in a sprint.
  const specCopyBetterDesigned = makeFixture("product-spec-copy-better-designed");
  setLaneDone(specCopyBetterDesigned, "product", ["product/SPEC.md"]);
  writeMoatSpec(specCopyBetterDesigned, {
    row: realIncumbentRow,
    moatClass: "data — per-user miss history compounds weekly",
    copyTest: "Ours is better designed for this audience.",
  });
  runFixture("the better-designed nonanswer fails", specCopyBetterDesigned, "check-product-spec.ts", 1, "product_spec.copy_test_missing");

  const specCopyNotThought = makeFixture("product-spec-copy-not-thought");
  setLaneDone(specCopyNotThought, "product", ["product/SPEC.md"]);
  writeMoatSpec(specCopyNotThought, {
    row: realIncumbentRow,
    moatClass: "data — per-user miss history compounds weekly",
    copyTest: "They have not thought of it yet.",
  });
  runFixture("the not-thought-of-it nonanswer fails", specCopyNotThought, "check-product-spec.ts", 1, "product_spec.copy_test_missing");

  // A negated structural answer is the direct, legitimate answer.
  const specCopyNegatedStructural = makeFixture("product-spec-copy-negated-structural");
  setLaneDone(specCopyNegatedStructural, "product", ["product/SPEC.md"]);
  writeMoatSpec(specCopyNegatedStructural, {
    row: twoIncumbentRows,
    moatClass: "data — per-user miss history compounds weekly",
    copyTest: "The accumulated user history cannot be copied in a week.",
  });
  runFixture("a negated structural copy answer passes", specCopyNegatedStructural, "check-product-spec.ts", 0);

  // The V1 exception needs its day-30 revisit, not just a name and a date.
  const specMoatV1NoRetro = makeFixture("product-spec-moat-v1-no-retro");
  setLaneDone(specMoatV1NoRetro, "product", ["product/SPEC.md"]);
  writeMoatSpec(specMoatV1NoRetro, {
    row: realIncumbentRow,
    moatClass: "no moat yet, racing to build data by 2026-08-25",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("a V1 exception without the day-30 revisit fails", specMoatV1NoRetro, "check-product-spec.ts", 1, "product_spec.moat_class_missing");

  // Naming the class before the negation is the same disclaimer.
  const specMoatClassPostNegated = makeFixture("product-spec-moat-post-negated");
  setLaneDone(specMoatClassPostNegated, "product", ["product/SPEC.md"]);
  writeMoatSpec(specMoatClassPostNegated, {
    row: realIncumbentRow,
    moatClass: "data is not a moat",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("a taxonomy word preceding its negation fails", specMoatClassPostNegated, "check-product-spec.ts", 1, "product_spec.moat_class_missing");

  // "Can ship it in a week" concedes the test without the word copy.
  const specCopyCanShip = makeFixture("product-spec-copy-can-ship");
  setLaneDone(specCopyCanShip, "product", ["product/SPEC.md"]);
  writeMoatSpec(specCopyCanShip, {
    row: realIncumbentRow,
    moatClass: "data — per-user miss history compounds weekly",
    copyTest: "The incumbent can ship this feature in a week.",
  });
  runFixture("a can-ship-in-a-week concession fails", specCopyCanShip, "check-product-spec.ts", 1, "product_spec.copy_test_missing");

  // The revisit must be the day-30 one.
  const specMoatV1AnnualRetro = makeFixture("product-spec-moat-v1-annual-retro");
  setLaneDone(specMoatV1AnnualRetro, "product", ["product/SPEC.md"]);
  writeMoatSpec(specMoatV1AnnualRetro, {
    row: realIncumbentRow,
    moatClass: "no moat yet, racing to build data by 2026-08-25; revisit at the annual retro",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("a V1 exception deferring to an annual retro fails", specMoatV1AnnualRetro, "check-product-spec.ts", 1, "product_spec.moat_class_missing");

  // A bare taxonomy word explains nothing about how the advantage accrues.
  const specMoatClassBare = makeFixture("product-spec-moat-class-bare");
  setLaneDone(specMoatClassBare, "product", ["product/SPEC.md"]);
  writeMoatSpec(specMoatClassBare, {
    row: realIncumbentRow,
    moatClass: "data",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("a bare moat class without a build plan fails", specMoatClassBare, "check-product-spec.ts", 1, "product_spec.moat_class_missing");

  // Refusing to build the class is not the exception's commitment.
  const specMoatV1NegatedBuild = makeFixture("product-spec-moat-v1-negated-build");
  setLaneDone(specMoatV1NegatedBuild, "product", ["product/SPEC.md"]);
  writeMoatSpec(specMoatV1NegatedBuild, {
    row: realIncumbentRow,
    moatClass: "no moat yet; we will not build data by 2026-08-25; revisit at the day-30 retro",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("a V1 exception refusing to build its class fails", specMoatV1NegatedBuild, "check-product-spec.ts", 1, "product_spec.moat_class_missing");

  // A plan that refuses the moat it names is not a build plan.
  const specMoatPlanNegated = makeFixture("product-spec-moat-plan-negated");
  setLaneDone(specMoatPlanNegated, "product", ["product/SPEC.md"]);
  writeMoatSpec(specMoatPlanNegated, {
    row: realIncumbentRow,
    moatClass: "data — we will never collect any user history",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("a negated moat build plan fails", specMoatPlanNegated, "check-product-spec.ts", 1, "product_spec.moat_class_missing");

  // Contractions negate the commitment the same as full forms.
  const specMoatV1Contraction = makeFixture("product-spec-moat-v1-contraction");
  setLaneDone(specMoatV1Contraction, "product", ["product/SPEC.md"]);
  writeMoatSpec(specMoatV1Contraction, {
    row: realIncumbentRow,
    moatClass: "no moat yet; we aren't building data by 2026-08-25; revisit at the day-30 retro",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("a contraction-negated V1 build commitment fails", specMoatV1Contraction, "check-product-spec.ts", 1, "product_spec.moat_class_missing");

  // An unrelated negation earlier in the sentence does not erase a live concession.
  const specCopyUnrelatedNegation = makeFixture("product-spec-copy-unrelated-negation");
  setLaneDone(specCopyUnrelatedNegation, "product", ["product/SPEC.md"]);
  writeMoatSpec(specCopyUnrelatedNegation, {
    row: realIncumbentRow,
    moatClass: "data — per-user miss history compounds weekly",
    copyTest: "Our design is not unique and the incumbent can ship this feature in a week.",
  });
  runFixture(
    "an unrelated negation does not erase a shipping concession",
    specCopyUnrelatedNegation,
    "check-product-spec.ts",
    1,
    "product_spec.copy_test_missing",
  );

  // One row benchmarks against a category of one.
  const specSingleIncumbentRow = makeFixture("product-spec-single-incumbent-row");
  setLaneDone(specSingleIncumbentRow, "product", ["product/SPEC.md"]);
  writeMoatSpec(specSingleIncumbentRow, {
    row: realIncumbentRow,
    moatClass: "data — per-user miss history compounds weekly",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("a single incumbent row fails the two-row floor", specSingleIncumbentRow, "check-product-spec.ts", 1, "product_spec.incumbent_row_missing");

  // A taxonomy word inside the plan cannot bless an invalid declared class.
  const specMoatClassExecution = makeFixture("product-spec-moat-class-execution");
  setLaneDone(specMoatClassExecution, "product", ["product/SPEC.md"]);
  writeMoatSpec(specMoatClassExecution, {
    row: twoIncumbentRows,
    moatClass: "execution — we send user data to the same model API",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("an execution class with taxonomy words in the plan fails", specMoatClassExecution, "check-product-spec.ts", 1, "product_spec.moat_class_missing");

  // "No incumbent can reproduce…" is the structural claim, not a concession.
  const specCopyLeadingNo = makeFixture("product-spec-copy-leading-no");
  setLaneDone(specCopyLeadingNo, "product", ["product/SPEC.md"]);
  writeMoatSpec(specCopyLeadingNo, {
    row: twoIncumbentRows,
    moatClass: "data — per-user miss history compounds weekly",
    copyTest: "No incumbent can reproduce our accumulated user history in one week.",
  });
  runFixture("a leading-no structural copy answer passes", specCopyLeadingNo, "check-product-spec.ts", 0);

  // An escaped pipe is content — later columns must not shift over the gap.
  const specEscapedPipe = makeFixture("product-spec-escaped-pipe");
  setLaneDone(specEscapedPipe, "product", ["product/SPEC.md"]);
  writeMoatSpec(specEscapedPipe, {
    row: "| HabitKit | iOS \\| Android logging | repair moment | |\n| Streaks | iOS \\| watchOS habits | repair flow | |",
    moatClass: "data — per-user miss history compounds weekly",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("escaped pipes do not shift empty cells into validity", specEscapedPipe, "check-product-spec.ts", 1, "product_spec.incumbent_row_missing");

  // The same incumbent twice is still a category of one.
  const specDuplicateRows = makeFixture("product-spec-duplicate-rows");
  setLaneDone(specDuplicateRows, "product", ["product/SPEC.md"]);
  writeFileSync(
    path.join(specDuplicateRows, "product/SPEC.md"),
    specSections({
      row: `${realIncumbentRow}\n${realIncumbentRow}`,
      moatClass: "data — per-user miss history compounds weekly",
      copyTest: "the repair model needs miss-history no fresh install has",
    }),
    "utf8",
  );
  runFixture("a duplicated incumbent row fails the two-incumbent floor", specDuplicateRows, "check-product-spec.ts", 1, "product_spec.incumbent_row_missing");

  // "Without requiring setup" is a plan, not a refusal.
  const specPlanFriendlyNegative = makeFixture("product-spec-plan-friendly-negative");
  setLaneDone(specPlanFriendlyNegative, "product", ["product/SPEC.md"]);
  writeMoatSpec(specPlanFriendlyNegative, {
    row: twoIncumbentRows,
    moatClass: "data — automatic history accrues without requiring setup",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("a friendly negative qualifier in the plan passes", specPlanFriendlyNegative, "check-product-spec.ts", 0);

  // Markdown continuation fills the field the normal way.
  const specIndentedAnswer = makeFixture("product-spec-indented-answer");
  setLaneDone(specIndentedAnswer, "product", ["product/SPEC.md"]);
  writeFileSync(
    path.join(specIndentedAnswer, "product/SPEC.md"),
    specSections({
      row: twoIncumbentRows,
      moatClass: "data — per-user miss history compounds weekly",
      copyTest: "",
    }).replace(/^- One-week-copy test answer:.*$/m, "- One-week-copy test answer:\n  the repair model needs miss-history no fresh install has."),
    "utf8",
  );
  groundIncumbents(specIndentedAnswer, twoIncumbentRows);
  runFixture("an indented continuation answer passes", specIndentedAnswer, "check-product-spec.ts", 0);

  // A blocker cell that concedes the week-one copy is not a blocker.
  const specBlockerConceded = makeFixture("product-spec-blocker-conceded");
  setLaneDone(specBlockerConceded, "product", ["product/SPEC.md"]);
  writeMoatSpec(specBlockerConceded, {
    row: "| HabitKit | fast logging | streak-insurance moment | Nothing; they can ship this in a week |\n| Streaks | native polish | repair flow | No blocker; this is copied in days |",
    moatClass: "data — per-user miss history compounds weekly",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("conceding blocker cells fail the incumbent benchmark", specBlockerConceded, "check-product-spec.ts", 1, "product_spec.incumbent_row_missing");

  // The V1 build verb must target the named class, not any taxonomy word.
  const specMoatV1UnboundBuild = makeFixture("product-spec-moat-v1-unbound-build");
  setLaneDone(specMoatV1UnboundBuild, "product", ["product/SPEC.md"]);
  writeMoatSpec(specMoatV1UnboundBuild, {
    row: twoIncumbentRows,
    moatClass: "no moat yet, racing to build better execution; we send requests to the same model API by 2026-08-25; revisit at the day-30 retro",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("a V1 build commitment unbound from its class fails", specMoatV1UnboundBuild, "check-product-spec.ts", 1, "product_spec.moat_class_missing");

  // Guidance prose cannot shadow the labeled copy-test field.
  const specCopyLabelShadow = makeFixture("product-spec-copy-label-shadow");
  setLaneDone(specCopyLabelShadow, "product", ["product/SPEC.md"]);
  writeFileSync(
    path.join(specCopyLabelShadow, "product/SPEC.md"),
    specSections({
      row: twoIncumbentRows,
      moatClass: "data — per-user miss history compounds weekly",
      copyTest: "",
    }).replace("## Differentiation And Moat", "## Differentiation And Moat\n\nThe one-week-copy test answer: should identify accumulated history."),
    "utf8",
  );
  groundIncumbents(specCopyLabelShadow, twoIncumbentRows);
  runFixture(
    "prose mentioning the copy-test label does not shadow the blank field",
    specCopyLabelShadow,
    "check-product-spec.ts",
    1,
    "product_spec.copy_test_missing",
  );

  // Non-Latin incumbent names are distinct incumbents.
  const specUnicodeIncumbents = makeFixture("product-spec-unicode-incumbents");
  setLaneDone(specUnicodeIncumbents, "product", ["product/SPEC.md"]);
  writeMoatSpec(specUnicodeIncumbents, {
    row: "| あすけん | photo food logging at scale | our miss-repair moment | per-user history their fresh install lacks |\n| カロミル | broad nutrient database | our miss-repair moment | per-user history their fresh install lacks |",
    moatClass: "data — per-user miss history compounds weekly",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("non-Latin incumbent names count as distinct rows", specUnicodeIncumbents, "check-product-spec.ts", 0);

  // The moat-class field accepts the same continuation form as the copy test.
  const specMoatClassIndented = makeFixture("product-spec-moat-class-indented");
  setLaneDone(specMoatClassIndented, "product", ["product/SPEC.md"]);
  writeFileSync(
    path.join(specMoatClassIndented, "product/SPEC.md"),
    specSections({
      row: twoIncumbentRows,
      moatClass: "",
      copyTest: "the repair model needs miss-history no fresh install has",
    }).replace(
      /^- Moat class.*$/m,
      "- Moat class (data / workflow / community / taste / model / distribution) and build plan:\n  data — per-user miss history compounds weekly.",
    ),
    "utf8",
  );
  groundIncumbents(specMoatClassIndented, twoIncumbentRows);
  runFixture("an indented moat-class continuation passes", specMoatClassIndented, "check-product-spec.ts", 0);

  // A later table's header is not an incumbent.
  const specSecondTableHeader = makeFixture("product-spec-second-table-header");
  setLaneDone(specSecondTableHeader, "product", ["product/SPEC.md"]);
  writeFileSync(
    path.join(specSecondTableHeader, "product/SPEC.md"),
    specSections({
      row: realIncumbentRow,
      moatClass: "data — per-user miss history compounds weekly",
      copyTest: "the repair model needs miss-history no fresh install has",
    }).replace(
      "- Moat class",
      "\n| Assumption | Evidence | Owner | Status |\n| --- | --- | --- | --- |\n| history matters | interviews | founder | open |\n\n- Moat class",
    ),
    "utf8",
  );
  runFixture("a second table's header does not count as an incumbent", specSecondTableHeader, "check-product-spec.ts", 1, "product_spec.incumbent_row_missing");

  // A pending build plan is a placeholder, not a plan.
  const specPlanPending = makeFixture("product-spec-plan-pending");
  setLaneDone(specPlanPending, "product", ["product/SPEC.md"]);
  writeMoatSpec(specPlanPending, {
    row: twoIncumbentRows,
    moatClass: "data — build details are still pending",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("a pending moat build plan fails", specPlanPending, "check-product-spec.ts", 1, "product_spec.moat_class_missing");

  // Localized specs are complete specs.
  const specJapaneseAnswers = makeFixture("product-spec-japanese-answers");
  setLaneDone(specJapaneseAnswers, "product", ["product/SPEC.md"]);
  writeMoatSpec(specJapaneseAnswers, {
    row: "| あすけん | photo food logging at scale | our miss-repair moment | per-user history their fresh install lacks |\n| カロミル | broad nutrient database | our miss-repair moment | per-user history their fresh install lacks |",
    moatClass: "data — 蓄積された利用履歴が毎週複利で強くなり、新規インストールには再現できない",
    copyTest: "蓄積された利用履歴は競合が一週間では再現できない。",
  });
  runFixture("a localized non-Latin spec passes", specJapaneseAnswers, "check-product-spec.ts", 0);

  // Invented competitors with filled cells benchmark nothing.
  const specInventedIncumbents = makeFixture("product-spec-invented-incumbents");
  setLaneDone(specInventedIncumbents, "product", ["product/SPEC.md"]);
  writeFileSync(
    path.join(specInventedIncumbents, "product/SPEC.md"),
    specSections({
      row: "| FocusFlow | fast logging | our repair moment | history their install lacks |\n| MindBloom | broad templates | our repair moment | history their install lacks |",
      moatClass: "data — per-user miss history compounds weekly",
      copyTest: "the repair model needs miss-history no fresh install has",
    }),
    "utf8",
  );
  runFixture("incumbents absent from research evidence do not count", specInventedIncumbents, "check-product-spec.ts", 1, "product_spec.incumbent_row_missing");

  // Refusing the day-30 revisit voids the exception.
  const specMoatV1NegatedRevisit = makeFixture("product-spec-moat-v1-negated-revisit");
  setLaneDone(specMoatV1NegatedRevisit, "product", ["product/SPEC.md"]);
  writeMoatSpec(specMoatV1NegatedRevisit, {
    row: twoIncumbentRows,
    moatClass: "no moat yet, racing to build data by 2026-08-25; we will not revisit at day 30",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("a negated day-30 revisit voids the V1 exception", specMoatV1NegatedRevisit, "check-product-spec.ts", 1, "product_spec.moat_class_missing");

  // Praise of the class is not a plan.
  const specMoatHeadPraise = makeFixture("product-spec-moat-head-praise");
  setLaneDone(specMoatHeadPraise, "product", ["product/SPEC.md"]);
  writeMoatSpec(specMoatHeadPraise, {
    row: twoIncumbentRows,
    moatClass: "data is unquestionably the primary moat class",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("class praise without a plan fails", specMoatHeadPraise, "check-product-spec.ts", 1, "product_spec.moat_class_missing");

  // Rows without the optional trailing pipe are the same four cells.
  const specNoTrailingPipe = makeFixture("product-spec-no-trailing-pipe");
  setLaneDone(specNoTrailingPipe, "product", ["product/SPEC.md"]);
  writeMoatSpec(specNoTrailingPipe, {
    row: "| HabitKit | fast logging, wide templates | streak-insurance at the miss moment | miss-history data accrues day one\n| Streaks | polished native logging | our repair flow | miss-history depth their storage cannot mirror",
    moatClass: "data — per-user miss history compounds weekly",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("rows without trailing pipes pass", specNoTrailingPipe, "check-product-spec.ts", 0);

  // Natural concrete build descriptions bind within their clause.
  const specMoatV1Natural = makeFixture("product-spec-moat-v1-natural");
  setLaneDone(specMoatV1Natural, "product", ["product/SPEC.md"]);
  writeMoatSpec(specMoatV1Natural, {
    row: twoIncumbentRows,
    moatClass: "no moat yet, racing to build an accumulated per-user data corpus by 2026-08-25; revisit at the day-30 retro",
    copyTest: "the repair model needs miss-history no fresh install has",
  });
  runFixture("a natural long-form V1 build commitment passes", specMoatV1Natural, "check-product-spec.ts", 0);

  // ── check-launch-trace ────────────────────────────────────────────────────

  const traceBaseline = makeFixture("launch-trace-baseline");
  runFixture("shipped launch trace template passes before the lane is claimed", traceBaseline, "check-launch-trace.ts", 0);

  const traceDonePlaceholders = makeFixture("launch-trace-done-placeholders");
  setLaneDone(traceDonePlaceholders, "traceability", ["state/LAUNCH_TRACE.md"]);
  runFixture("done traceability lane with template placeholders fails", traceDonePlaceholders, "check-launch-trace.ts", 1, "launch_trace.placeholder_complete");

  const traceMissing = makeFixture("launch-trace-missing");
  rmSync(path.join(traceMissing, "state/LAUNCH_TRACE.md"), { force: true });
  runFixture("active traceability lane without state/LAUNCH_TRACE.md fails", traceMissing, "check-launch-trace.ts", 1, "launch_trace.markdown_missing");

  // ── check-privacy-terms ───────────────────────────────────────────────────

  const privacyBaseline = makeFixture("privacy-terms-baseline");
  runFixture("shipped privacy and terms templates pass before the lane is claimed", privacyBaseline, "check-privacy-terms.ts", 0);

  const privacyDonePlaceholders = makeFixture("privacy-terms-done-placeholders");
  setLaneDone(privacyDonePlaceholders, "privacy_legal", ["trust/PRIVACY.md", "trust/TERMS.md"]);
  runFixture(
    "done privacy_legal lane with template placeholders fails",
    privacyDonePlaceholders,
    "check-privacy-terms.ts",
    1,
    "privacy_terms.trust_privacy_md.placeholder_complete",
  );

  const termsMissing = makeFixture("privacy-terms-missing-terms");
  rmSync(path.join(termsMissing, "trust/TERMS.md"), { force: true });
  runFixture("active privacy_legal lane without trust/TERMS.md fails", termsMissing, "check-privacy-terms.ts", 1, "privacy_terms.trust_terms_md.missing");
}
