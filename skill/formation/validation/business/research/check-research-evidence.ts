#!/usr/bin/env node
/**
 * check-research-evidence.ts — content floor for the research lane.
 *
 * strategy/RESEARCH.md is the evidence root every downstream lane traces back to, yet
 * the lane previously had no dedicated validator: only the generic
 * lane-coverage status floor saw it. Structure follows the strategy/RESEARCH.md
 * contract in knowledge/process/artifact-contracts.md.
 *
 * npm script: check:research
 * Usage: tsx validation/business/research/check-research-evidence.ts --root <app-repo-root>
 */
import { asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit } from "../../../tooling/lib/launch-state.js";
import { parseRenderedTopLevelStatus, parseRequiredTableSection, type RequiredTableSection } from "../process/required-table-section.js";
import { parseOfferMeasurement, validateSignalSupersessionGraph, type SignalLifecycle, type SignalSupersessionRecord } from "./research-evidence-helpers.js";

const args = parseCliArgs(process.argv.slice(2));
const requireWorkflowOutputs = process.argv.includes("--require-workflow-outputs");
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;
const projectOwner = state ? (asString(getPath(state, "project.owner")) ?? "").trim() : "";
const AUTOMATION_IDENTITY = /\b(agent|codex|claude|gpt|assistant|bot|automation|autopilot|ai)\b/i;
const OFFER_TEST_HEADERS = {
  contract: ["Field", "Value"],
  decision: ["Status", "Date", "Evidence", "Decision", "Decided by"],
  exposure: ["Date", "Channel", "Evidence source", "Exposure type", "Exposure", "CTA conversions", "Conversion rate", "Cost", "Result"],
  waiver: ["Date", "Founder", "Reason", "Residual risk accepted"],
} as const;
const SIGNAL_CORPUS_HEADERS = {
  inputs: [
    ["Input ID"],
    ["Source type"],
    ["Owner or creator", "Owner", "Creator"],
    ["Scope"],
    ["Date range"],
    ["Collection route"],
    ["Permission or public basis", "Permission", "Public basis"],
    ["Limits", "Limit"],
  ],
  records: [
    ["Signal ID"],
    ["Type"],
    ["Claim or phrase", "Claim", "Phrase"],
    ["Source IDs", "Source ID"],
    ["Observed at"],
    ["Applies to"],
    ["Confidence"],
    ["Status"],
    ["Supersedes"],
    ["Artifact or trace", "Artifact", "Trace"],
  ],
  conflicts: [["Earlier signal"], ["Later signal"], ["Conflict"], ["Current position"], ["Reason"]],
  derived: [["Signal IDs", "Signal ID"], ["Output"], ["Decision changed"], ["Trace ID"]],
} as const;
const DISTRIBUTION_PROOF_HEADERS = [
  ["Audience segment"],
  ["Exact discovery location"],
  ["Native format"],
  ["Owned relationship"],
  ["Measured signal"],
  ["Evidence IDs", "Evidence ID"],
] as const;
const SOURCE_LEDGER_HEADERS = {
  source: ["Source"],
  platform: ["Platform / type"],
  identity: ["URL / source ID"],
  observedAt: ["Observed at"],
  backendQuery: ["Tool / backend / query"],
  transcriptVisual: ["Transcript / visual / sample limit", "Transcript / visual"],
  observation: ["Observation"],
  inference: ["Inference"],
  confidence: ["Confidence"],
  artifactTrace: ["Artifact / trace"],
} as const;
const CATEGORY_REVENUE_HEADERS = {
  revenue: ["Est. annual revenue", "Estimated annual revenue", "Annual revenue", "Revenue"],
  source: ["Source / observed at", "Source"],
} as const;
const VERDICT_HEADERS = {
  date: ["Date"],
  categoryRevenue: ["Category revenue reality", "Category revenue", "Revenue reality"],
  wedge: ["Wedge"],
  demand: ["Demand signal", "Demand"],
  distribution: ["Distribution proof", "Distribution"],
  offerTest: ["Offer test"],
  verdict: ["Verdict (Go / Pivot / Kill)", "Verdict"],
  decidedBy: ["Decided by"],
} as const;

const laneStatus = state ? asString(getPath(state, "lanes.research.status"))?.toLowerCase() : undefined;
const skip = laneStatus === "not_needed" || laneStatus === "deferred";
const done = laneStatus === "done";
const strictResearch = done || requireWorkflowOutputs;
// The pre-build gate cannot wait for the lane to claim done: a project that
// advances to design/build phases with research still partial is exactly the
// bypass the checkpoint exists to stop, so the verdict is enforced from
// phase_2 onward regardless of lane status.
const projectPhase = state ? (asString(getPath(state, "project.phase")) ?? "").toLowerCase() : "";
const buildPhase = /^phase_[2-6]/.test(projectPhase);
// The gate also fires the moment downstream product/design/build work becomes
// active, whatever the recorded phase says: design effort spent before the
// founder's Go is the exact cost the checkpoint exists to prevent.
const DOWNSTREAM_OF_VERDICT = ["experience", "product", "design", "content_assets", "engineering"];
const downstreamActive = DOWNSTREAM_OF_VERDICT.some((lane) => {
  const status = state ? asString(getPath(state, `lanes.${lane}.status`))?.toLowerCase() : undefined;
  return status === "partial" || status === "done";
});
const verdictRequired = strictResearch || buildPhase || downstreamActive;
const text = readText(args.root, "strategy/RESEARCH.md");
const signalText = readText(args.root, "strategy/SIGNAL_CORPUS.md");
const offerText = readText(args.root, "strategy/OFFER_TEST.md");
const sourceLedgerResult = text ? parseRequiredTableSection(text, "Source Ledger") : undefined;
const sourceLedgerSection = sourceLedgerResult?.ok ? sourceLedgerResult.section : undefined;
const sourceLedgerEvidence = buildSourceLedgerEvidence(sourceLedgerSection);
const signalEvidence = verdictRequired ? validateSignalCorpus(signalText, issues, strictResearch) : emptySignalCorpusIndex();

// A deferred/not_needed research lane suppresses the missing-file error only
// before the build phases: from phase_2 onward the verdict is mandatory, so
// the artifact that carries it is too — deferring research out of existence
// is not a route around the pre-build checkpoint.
if ((!skip || verdictRequired) && !text) {
  issues.push(
    issue(
      "error",
      "research.markdown_missing",
      "strategy/RESEARCH.md is required: it is the evidence root that product/SPEC.md, brand, ASO, pricing, and funnel decisions trace back to" +
        (buildPhase && skip ? ", and from phase_2 onward the Go/Pivot/Kill verdict it carries is mandatory even for a deferred research lane" : "") +
        ". Seed it from business/strategy/RESEARCH.md.",
      "strategy/RESEARCH.md",
    ),
  );
}

if (text) {
  for (const phrase of [
    "Source Ledger",
    "Evidence Capture Protocol",
    "Untrusted Content",
    "Decision Inputs",
    "Decision Log",
    "Rejected Claims",
    "Category Revenue Reality",
    "Distribution Proof",
    "Go, Pivot, Or Kill",
  ]) {
    if (!text.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push(
        issue(
          strictResearch ? "error" : "warning",
          `research.${phrase.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.missing`,
          `strategy/RESEARCH.md should include a ${phrase} section (see the strategy/RESEARCH.md contract in artifact-contracts.md).`,
          "strategy/RESEARCH.md",
        ),
      );
    }
  }

  if (!text.includes("LAUNCH_TRACE")) {
    issues.push(
      issue(
        strictResearch ? "error" : "warning",
        "research.trace_pointer.missing",
        "strategy/RESEARCH.md should give major decisions trace IDs or state/LAUNCH_TRACE.md pointers so evidence stays connected to build decisions.",
        "strategy/RESEARCH.md",
      ),
    );
  }

  if (strictResearch) {
    const strictProvenanceColumns = [
      ["URL / source ID", sourceLedgerEvidence.columns.identity],
      ["Observed at", sourceLedgerEvidence.columns.observedAt],
      ["Tool / backend / query", sourceLedgerEvidence.columns.backendQuery],
      ["Transcript / visual", sourceLedgerEvidence.columns.transcriptVisual],
      ["Observation", sourceLedgerEvidence.columns.observation],
      ["Inference", sourceLedgerEvidence.columns.inference],
      ["Artifact / trace", sourceLedgerEvidence.columns.artifactTrace],
    ] as const;
    for (const [column, index] of strictProvenanceColumns) {
      if (index < 0) {
        issues.push(
          issue(
            "error",
            `research.source_ledger_${column.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.missing`,
            `Done research needs the ${column} provenance column so browser/social/video evidence is reproducible.`,
            "strategy/RESEARCH.md",
          ),
        );
      }
    }
    if (/\bYYYY-MM-DD\b|\breplace with\b|\b(TODO|TBD|placeholder)\b/i.test(text)) {
      issues.push(
        issue(
          "error",
          "research.placeholder_complete",
          "Research cannot be done while template placeholders (YYYY-MM-DD, 'replace with', TODO/TBD) remain in strategy/RESEARCH.md.",
          "strategy/RESEARCH.md",
        ),
      );
    }
    if (!sourceLedgerEvidence.hasDatedEvidence) {
      issues.push(
        issue(
          "error",
          "research.no_dated_evidence",
          "A done research lane needs at least one evidence row with a valid, non-future Observed at timestamp so freshness is checkable.",
          "strategy/RESEARCH.md",
        ),
      );
    }
  }

  // ── Pre-build Go/Pivot/Kill gate ──────────────────────────────────────────
  if (verdictRequired) {
    // Research that never converts evidence into a build-or-not decision is
    // the expensive miss the 2026-07-26 audit named: the launch machinery will
    // polish and ship any input idea, so the one evidence-gated exit ramp is
    // here, before Phase 2 spends design/build/store effort. The agent
    // assembles the evidence; the verdict is the founder's call — and a Kill
    // or Pivot at this checkpoint is the process working, not failing.
    const PLACEHOLDER_TEXT = /\b(unverified|tbd|todo|to be filled|pending|placeholder)\b/i;

    const revenueResult = parseRequiredTableSection(text, "Category Revenue Reality");
    if (!revenueResult.ok) {
      // The phrase in prose is not the section: a done lane needs the parsed
      // heading, or every substance check below silently skips.
      issues.push(
        issue(
          "error",
          "research.category_revenue_reality.section_missing",
          'strategy/RESEARCH.md mentions Category Revenue Reality but has no "## Category Revenue Reality" section. The gate reads the section, not the phrase.',
          "strategy/RESEARCH.md",
        ),
      );
    } else {
      const revenueSection = revenueResult.section;
      // The revenue estimate and its source are parsed from their intended
      // columns: a dollar amount drifting in an unrelated cell, or a blank
      // source, is data-shaped text rather than a sourced estimate.
      const revenueColumn = tableColumnAny(revenueSection, CATEGORY_REVENUE_HEADERS.revenue);
      const sourceColumn = tableColumnAny(revenueSection, CATEGORY_REVENUE_HEADERS.source);
      const revenueRows = revenueSection.rows.filter((row) => !/_example/i.test(row.cells.join(" ")));
      const sourcedRow = (row: (typeof revenueRows)[number]): boolean => {
        const revenueCell = revenueColumn >= 0 ? (row.cells[revenueColumn] ?? "") : "";
        const sourceCell = sourceColumn >= 0 ? (row.cells[sourceColumn] ?? "") : "";
        return (
          /\$\s*\d[\d,]*(?:\.\d+)?/.test(revenueCell) &&
          sourceCell.trim().length > 0 &&
          !PLACEHOLDER_TEXT.test(sourceCell) &&
          /\d{4}-\d{2}-\d{2}/.test(sourceCell)
        );
      };
      if (revenueColumn < 0 || sourceColumn < 0 || !rowsMatchTableWidth(revenueSection) || !revenueRows.some(sourcedRow)) {
        issues.push(
          issue(
            "error",
            "research.category_revenue_row_missing",
            "Done research needs at least one real competitor revenue row in Category Revenue Reality: a dollar estimate in the revenue " +
              "column AND a dated, non-placeholder source in the source column. Collecting AppKittie data is not the gate — the judged, " +
              "sourced number is: a category whose top apps gross too little cannot become a real business however well the launch executes.",
            "strategy/RESEARCH.md",
          ),
        );
      }
      const barLine = revenueSection.renderedBody.split(/\r?\n/).find((line) => /stated bar/i.test(line) && line.includes(":"));
      const barValue = barLine ? (barLine.split(/:(.*)/s)[1] ?? "").trim() : "";
      const barStated = barValue.length > 0 && /\d/.test(barValue) && !PLACEHOLDER_TEXT.test(barValue);
      if (!barStated || !/pass or fail[^:\n]*:\s*(pass|fail)/i.test(revenueSection.renderedBody)) {
        issues.push(
          issue(
            "error",
            "research.category_revenue_bar_unjudged",
            "Category Revenue Reality needs a substantive stated bar (a number, not a blank or placeholder) AND an explicit pass/fail judgment " +
              "against it. A pass verdict over no stated threshold, or a table without the judgment line, is data collection wearing a gate's clothes.",
            "strategy/RESEARCH.md",
          ),
        );
      }
    }

    const distributionResult = parseRequiredTableSection(text, "Distribution Proof");
    const distributionSection = distributionResult.ok ? distributionResult.section : undefined;
    const distributionColumnIndexes = distributionSection ? DISTRIBUTION_PROOF_HEADERS.map((headers) => tableColumnAny(distributionSection, headers)) : [];
    if (!distributionSection || distributionColumnIndexes.some((column) => column < 0)) {
      issues.push(
        issue(
          "error",
          "research.distribution_proof_columns_missing",
          "Distribution Proof needs audience, exact discovery location, native format, owned relationship, measured signal, and evidence ID columns.",
          "strategy/RESEARCH.md",
        ),
      );
    } else {
      const rows = distributionSection.rows;
      const sourceLedgerIds = sourceLedgerEvidence.eligibleIds;
      const genericLocation = /^(social media|online|internet|web|app store|community|creator audience)$/i;
      const rowsValid =
        rows.length > 0 &&
        rowsMatchTableWidth(distributionSection) &&
        rows.every((row) => {
          const cells = distributionColumnIndexes.map((column) => (row.cells[column] ?? "").trim());
          const audience = cells[0] ?? "";
          const location = cells[1] ?? "";
          const format = cells[2] ?? "";
          const ownedRoute = cells[3] ?? "";
          const measuredSignal = cells[4] ?? "";
          const evidenceIds = cells[5] ?? "";
          const parsedEvidenceIds = parseStableIdList(evidenceIds);
          const evidenceResolved =
            parsedEvidenceIds.validSyntax &&
            parsedEvidenceIds.ids.length > 0 &&
            parsedEvidenceIds.ids.every((evidenceId) => sourceLedgerIds.has(evidenceId) || signalEvidence.eligibleSignalIds.has(evidenceId));
          return (
            [audience, location, format, ownedRoute, measuredSignal, evidenceIds].every(
              (cell) => cell.length > 0 && !PLACEHOLDER_TEXT.test(cell) && !/\breplace with\b/i.test(cell),
            ) &&
            !isAbsentOwnedRelationship(ownedRoute) &&
            !genericLocation.test(location) &&
            /\d/.test(measuredSignal) &&
            evidenceResolved
          );
        });
      if (!rowsValid) {
        issues.push(
          issue(
            "error",
            "research.distribution_proof_row_invalid",
            "Every Distribution Proof row needs a specific audience, discovery location, native format, owned route, and numeric measured signal. " +
              "Each Evidence ID must resolve through a complete Source Ledger row's URL/source-ID or Artifact/trace cell, or through a current/dated Signal Record.",
            "strategy/RESEARCH.md",
          ),
        );
      }
    }

    const verdictResult = parseRequiredTableSection(text, "Go, Pivot, Or Kill");
    if (!verdictResult.ok) {
      issues.push(
        issue(
          "error",
          "research.go_pivot_or_kill.section_missing",
          'strategy/RESEARCH.md mentions Go, Pivot, Or Kill but has no "## Go, Pivot, Or Kill" section. The gate reads the section, not the phrase.',
          "strategy/RESEARCH.md",
        ),
      );
    } else {
      const verdictSection = verdictResult.section;
      const dateColumn = tableColumnAny(verdictSection, VERDICT_HEADERS.date);
      const verdictColumn = tableColumnAny(verdictSection, VERDICT_HEADERS.verdict);
      const decidedColumn = tableColumnAny(verdictSection, VERDICT_HEADERS.decidedBy);
      const evidenceColumns = [
        tableColumnAny(verdictSection, VERDICT_HEADERS.categoryRevenue),
        tableColumnAny(verdictSection, VERDICT_HEADERS.wedge),
        tableColumnAny(verdictSection, VERDICT_HEADERS.demand),
        tableColumnAny(verdictSection, VERDICT_HEADERS.distribution),
        tableColumnAny(verdictSection, VERDICT_HEADERS.offerTest),
      ];
      const evidenceColumnsPresent = evidenceColumns.every((column) => column >= 0);
      if (!evidenceColumnsPresent) {
        issues.push(
          issue(
            "error",
            "research.go_pivot_kill_evidence_columns_missing",
            "The Go, Pivot, Or Kill table is missing its named evidence columns. Category revenue, wedge, demand, distribution, and offer test must " +
              "each have a named column — a verdict table with the reasons renamed or removed is a decision without its inputs.",
            "strategy/RESEARCH.md",
          ),
        );
      }
      const parsedRows = verdictSection.rows.map((row) => ({
        cells: row.cells,
        widthValid: row.rawCellCount === verdictSection.width,
        date: dateColumn >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.cells[dateColumn]?.trim() ?? "") ? (row.cells[dateColumn]?.trim() ?? "") : undefined,
        verdict:
          verdictColumn < 0
            ? undefined
            : (row.cells[verdictColumn] ?? "")
                .trim()
                .match(/^(go|pivot|kill)\b/i)?.[1]
                ?.toLowerCase(),
      }));
      const verdictRows = parsedRows.filter((row) => row.widthValid && row.date && row.verdict);
      // A malformed decision row (mistyped date, missing verdict keyword) is
      // reported, never silently dropped — dropping it would fall back to an
      // older verdict the founder already superseded.
      const malformedRows = parsedRows.filter((row) => !(row.widthValid && row.date && row.verdict) && row.cells.some((cell) => cell.trim().length > 0));
      if (malformedRows.length > 0) {
        issues.push(
          issue(
            "error",
            "research.go_pivot_kill_row_malformed",
            `The Go, Pivot, Or Kill table has ${malformedRows.length} row(s) with a mistyped date (ISO YYYY-MM-DD required) or verdict ` +
              `(Go/Pivot/Kill required). Fix the row — a malformed later decision must never silently lose to an older one.`,
            "strategy/RESEARCH.md",
          ),
        );
      }
      if (verdictRows.length === 0) {
        issues.push(
          issue(
            "error",
            "research.go_pivot_kill_row_missing",
            "Done research needs a completed Go, Pivot, Or Kill row: an ISO date, the evidence cells, and the founder's verdict. " +
              "The heading without a decided row is the pre-build kill gate left unwired.",
            "strategy/RESEARCH.md",
          ),
        );
      } else {
        // Later table rows win date ties: a same-day follow-up verdict
        // supersedes the row above it.
        const latest = verdictRows.reduce((a, b) => ((b.date ?? "") >= (a.date ?? "") ? b : a));
        // The gate is founder-only: a verdict row that names no decision-maker
        // is an agent deciding to build and moving on.
        // The decision-maker is read from the named "Decided by" column, never
        // positionally — an unrelated Notes column sitting after Verdict must
        // not be able to satisfy the founder-only gate.
        const decidedByCell = decidedColumn < 0 ? "" : (latest.cells[decidedColumn] ?? "").trim();
        if (decidedByCell.length === 0 || PLACEHOLDER_TEXT.test(decidedByCell) || !isFounderDecider(decidedByCell)) {
          issues.push(
            issue(
              "error",
              "research.go_pivot_kill_decider_missing",
              'The latest Go, Pivot, Or Kill row does not name the founder in "Decided by" (empty, placeholder, or an automation identity). ' +
                "The verdict is founder-only, never automatic — record the founder by name or role. An agent recording Go for itself is the exact bypass this gate exists to stop.",
              "strategy/RESEARCH.md",
            ),
          );
        }
        const evidenceCells = evidenceColumnsPresent ? evidenceColumns.map((column) => latest.cells[column] ?? "") : [];
        if (evidenceColumnsPresent && evidenceCells.some((cell) => cell.trim().length === 0 || PLACEHOLDER_TEXT.test(cell))) {
          issues.push(
            issue(
              "error",
              "research.go_pivot_kill_evidence_thin",
              "The latest Go, Pivot, Or Kill row carries empty or placeholder evidence cells. A verdict decided over " +
                '"unverified" is a mood, not a decision — fill category revenue, wedge, demand, distribution, and offer evidence before recording it.',
              "strategy/RESEARCH.md",
            ),
          );
        }
        if (latest.verdict !== "go") {
          issues.push(
            issue(
              "error",
              "research.go_pivot_kill_not_go",
              `The latest Go, Pivot, Or Kill verdict is "${latest.verdict}", but the research lane is marked done. ` +
                `A Kill winds the idea down pre-build; a Pivot re-enters Phase 1 with the wedge changed. Either way the lane is not done — ` +
                `record the follow-up verdict once the founder decides to build.`,
              "strategy/RESEARCH.md",
            ),
          );
        }
        const decision = (asString(getPath(state, "lanes.research.go_pivot_kill_decision")) ?? "").trim().toLowerCase();
        const decidedAt = (asString(getPath(state, "lanes.research.go_pivot_kill_decided_at")) ?? "").trim();
        if (!/^(go|pivot|kill)$/.test(decision) || !/^\d{4}-\d{2}-\d{2}$/.test(decidedAt)) {
          issues.push(
            issue(
              "error",
              "research.go_pivot_kill_state_missing",
              "strategy/RESEARCH.md records a Go, Pivot, Or Kill verdict but lanes.research.go_pivot_kill_decision/go_pivot_kill_decided_at " +
                "do not hold a valid verdict (go|pivot|kill) with an ISO date. The state mirror is what downstream lanes and the portfolio pipeline read.",
              "state/PROJECT_STATE.yaml",
            ),
          );
        } else if (decision !== latest.verdict || decidedAt !== latest.date) {
          issues.push(
            issue(
              "error",
              "research.go_pivot_kill_state_mismatch",
              `lanes.research.go_pivot_kill_decision/decided_at ("${decision}" on ${decidedAt}) disagree with the latest verdict row in strategy/RESEARCH.md ` +
                `("${latest.verdict}" on ${latest.date}). Both the verdict and its date must match — a stale or forward-dated mirror is what downstream ` +
                `lanes and the portfolio pipeline would act on.`,
              "state/PROJECT_STATE.yaml",
            ),
          );
        }
      }
    }
  }

  if (strictResearch) {
    if (sourceLedgerEvidence.completeRowCount === 0) {
      issues.push(
        issue(
          "error",
          "research.source_ledger_row_missing",
          "Done research needs at least one complete Source Ledger evidence row with a valid, non-future Observed at timestamp; headers and an unrelated date are not proof.",
          "strategy/RESEARCH.md",
        ),
      );
    }
  }
}

if (verdictRequired) {
  validateOfferTest(offerText, issues);
}

reportAndExit("Research evidence check", issues);

interface SignalCorpusIndex {
  signalLifecycles: Map<string, SignalLifecycle>;
  eligibleSignalIds: Set<string>;
}

function emptySignalCorpusIndex(): SignalCorpusIndex {
  return { signalLifecycles: new Map(), eligibleSignalIds: new Set() };
}

function validateSignalCorpus(value: string | undefined, target: ReturnType<typeof issue>[], strict: boolean): SignalCorpusIndex {
  const index = emptySignalCorpusIndex();
  if (!value) {
    target.push(
      issue(
        "error",
        "research.signal_corpus_missing",
        "strategy/SIGNAL_CORPUS.md is required before the Go, Pivot, or Kill decision.",
        "strategy/SIGNAL_CORPUS.md",
      ),
    );
    return index;
  }

  const sections = {
    inputs: parseRequiredTableSection(value, "Corpus Inputs"),
    records: parseRequiredTableSection(value, "Signal Records"),
    conflicts: parseRequiredTableSection(value, "Conflicts And Supersession"),
    derived: parseRequiredTableSection(value, "Derived Outputs"),
  };
  const sectionEntries = [
    ["Corpus Inputs", sections.inputs],
    ["Signal Records", sections.records],
    ["Conflicts And Supersession", sections.conflicts],
    ["Derived Outputs", sections.derived],
  ] as const;

  const renderedStatus = parseRenderedTopLevelStatus(value);
  const notApplicable = renderedStatus.ok ? renderedStatus.status.value.match(/^not applicable\b(.*)$/i) : null;
  if (notApplicable) {
    const reason = (notApplicable[1] ?? "").replace(/^[\s:—-]+/, "").trim();
    if (
      reason.length === 0 ||
      isEmptySignalNotApplicableReason(reason) ||
      /\b(todo|tbd|placeholder|replace with|unverified|pending|authored reason)\b/i.test(reason) ||
      /<[^>]+>/.test(reason)
    ) {
      target.push(
        issue(
          "error",
          "research.signal_corpus_not_applicable_reason_missing",
          "A not-applicable signal corpus needs an authored reason. Do not fabricate signal rows when no reusable source material exists.",
          "strategy/SIGNAL_CORPUS.md",
        ),
      );
    }
    const retainedOrAmbiguousSections = sectionEntries.filter(([, result]) =>
      result.ok ? result.section.rows.length > 0 : result.errors.some((error) => error.kind !== "section-missing"),
    );
    if (retainedOrAmbiguousSections.length > 0) {
      target.push(
        issue(
          "error",
          "research.signal_corpus_not_applicable_rows_present",
          "A not-applicable signal corpus cannot retain starter or evidence rows. Remove the corpus rows instead of relabeling fabricated data as not applicable.",
          "strategy/SIGNAL_CORPUS.md",
        ),
      );
    }
    return index;
  }

  for (const [heading, result] of sectionEntries) {
    if (!result.ok) {
      target.push(
        issue(
          strict ? "error" : "warning",
          `research.signal_corpus_${heading.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_missing`,
          `strategy/SIGNAL_CORPUS.md needs a ${heading} section.`,
          "strategy/SIGNAL_CORPUS.md",
        ),
      );
    }
  }

  const placeholder = /\b(todo|tbd|placeholder|replace with|pending|unverified|authored reason|yyyy-mm-dd)\b|<[^>]+>/i;
  const inputs = sections.inputs.ok ? sections.inputs.section : undefined;
  const inputColumnIndexes = inputs ? SIGNAL_CORPUS_HEADERS.inputs.map((headers) => tableColumnAny(inputs, headers)) : [];
  const declaredInputIds = new Set<string>();
  if (!inputs || inputColumnIndexes.some((column) => column < 0)) {
    target.push(
      issue(
        "error",
        "research.signal_corpus_input_columns_missing",
        "The Corpus Inputs table needs input ID, source type, owner or creator, scope, date range, collection route, permission or public basis, and limits columns.",
        "strategy/SIGNAL_CORPUS.md",
      ),
    );
  } else {
    const inputRows = inputs.rows;
    let inputRowsValid = inputRows.length > 0 && rowsMatchTableWidth(inputs);
    for (const row of inputRows) {
      const cells = inputColumnIndexes.map((column) => (row.cells[column] ?? "").trim());
      const inputId = (cells[0] ?? "").toUpperCase();
      const complete =
        /^INPUT-[A-Z0-9][A-Z0-9-]*$/.test(inputId) &&
        cells.slice(1).every((cell) => cell.length > 0 && !placeholder.test(cell)) &&
        isValidPastIsoDateRange(cells[4] ?? "") &&
        !declaredInputIds.has(inputId);
      if (!complete) {
        inputRowsValid = false;
        continue;
      }
      declaredInputIds.add(inputId);
    }
    if (!inputRowsValid) {
      target.push(
        issue(
          "error",
          "research.signal_corpus_input_row_invalid",
          "Every Corpus Inputs row needs a unique stable INPUT ID and an ISO-dated range. " +
            "It also needs real source, ownership, collection route, permission or public basis, and limits values.",
          "strategy/SIGNAL_CORPUS.md",
        ),
      );
    }
  }

  const records = sections.records.ok ? sections.records.section : undefined;
  const recordColumns = records ? SIGNAL_CORPUS_HEADERS.records.map((headers) => tableColumnAny(records, headers)) : [];
  if (!records || recordColumns.some((column) => column < 0)) {
    target.push(
      issue(
        "error",
        "research.signal_corpus_columns_missing",
        "The Signal Records table needs identity, provenance, date, applicability, confidence, lifecycle, supersession, and trace columns.",
        "strategy/SIGNAL_CORPUS.md",
      ),
    );
  } else {
    const signalRows = records.rows;
    const supersessionRecords = signalRows.flatMap((row): SignalSupersessionRecord[] => {
      const id = (row.cells[recordColumns[0]!] ?? "").trim().toUpperCase();
      const lifecycle = (row.cells[recordColumns[7]!] ?? "").trim().toLowerCase();
      if (!/^SIG-[A-Z0-9][A-Z0-9-]*$/.test(id) || !/^(current|dated|superseded|rejected|unverified)$/.test(lifecycle)) return [];
      return [{ id, lifecycle: lifecycle as SignalLifecycle, replacementId: (row.cells[recordColumns[8]!] ?? "").trim().toUpperCase() }];
    });
    const invalidSupersessionIds = new Set(validateSignalSupersessionGraph(supersessionRecords).invalidSignalIds);
    const seenSignalIds = new Set<string>();
    let rowsComplete = signalRows.length > 0 && rowsMatchTableWidth(records);
    let unresolvedSource = false;
    for (const row of signalRows) {
      const cells = recordColumns.map((column) => (row.cells[column] ?? "").trim());
      const id = (cells[0] ?? "").toUpperCase();
      const type = cells[1] ?? "";
      const claim = cells[2] ?? "";
      const sources = cells[3] ?? "";
      const observedAt = cells[4] ?? "";
      const appliesTo = cells[5] ?? "";
      const confidence = cells[6] ?? "";
      const lifecycle = (cells[7] ?? "").toLowerCase() as SignalLifecycle;
      const trace = cells[9] ?? "";
      const sourceIds = parsePrefixedIdList(sources, "INPUT");
      const sourcesResolve = sourceIds.validSyntax && sourceIds.ids.length > 0 && sourceIds.ids.every((sourceId) => declaredInputIds.has(sourceId));
      const supersessionValid = lifecycle !== "superseded" || !invalidSupersessionIds.has(id);
      const rowComplete =
        /^SIG-[A-Z0-9][A-Z0-9-]*$/.test(id) &&
        [type, claim, appliesTo, trace].every((cell) => cell.length > 0 && !placeholder.test(cell)) &&
        isValidPastIsoDate(observedAt) &&
        /^(low|medium|high)$/i.test(confidence) &&
        /^(current|dated|superseded|rejected|unverified)$/.test(lifecycle) &&
        supersessionValid &&
        !seenSignalIds.has(id);
      if (!sourcesResolve) unresolvedSource = true;
      if (!rowComplete || !sourcesResolve) {
        rowsComplete = false;
        continue;
      }
      seenSignalIds.add(id);
      index.signalLifecycles.set(id, lifecycle);
      if (lifecycle === "current" || lifecycle === "dated") index.eligibleSignalIds.add(id);
    }
    if (!rowsComplete) {
      target.push(
        issue(
          "error",
          "research.signal_corpus_row_missing",
          "Every declared Signal Records row needs a unique stable ID, dated provenance, applicability, confidence, a documented lifecycle, valid supersession data, and a trace pointer. " +
            "A supersession chain must be acyclic and end at a current or dated replacement.",
          "strategy/SIGNAL_CORPUS.md",
        ),
      );
    }
    if (unresolvedSource) {
      target.push(
        issue(
          "error",
          "research.signal_corpus_source_unresolved",
          "Every Source ID in Signal Records must resolve to a complete row in Corpus Inputs. Use comma-separated INPUT IDs only.",
          "strategy/SIGNAL_CORPUS.md",
        ),
      );
    }
  }

  const conflicts = sections.conflicts.ok ? sections.conflicts.section : undefined;
  const conflictColumnIndexes = conflicts ? SIGNAL_CORPUS_HEADERS.conflicts.map((headers) => tableColumnAny(conflicts, headers)) : [];
  if (conflicts && conflictColumnIndexes.some((column) => column < 0)) {
    target.push(
      issue(
        "error",
        "research.signal_corpus_conflicts_and_supersession_missing",
        "The Conflicts And Supersession table needs Earlier signal, Later signal, Conflict, Current position, and Reason columns.",
        "strategy/SIGNAL_CORPUS.md",
      ),
    );
  } else if (conflicts) {
    const conflictRows = conflicts.rows.map((row) => {
      const cells = conflictColumnIndexes.map((column) => (row.cells[column] ?? "").trim());
      const [earlier, later, conflict] = cells;
      return {
        cells,
        noConflict: /^none$/i.test(earlier ?? "") && /^none$/i.test(later ?? "") && /^no(?: material)? conflict\b/i.test(conflict ?? ""),
      };
    });
    const invalidConflictRow =
      conflictRows.length === 0 ||
      !rowsMatchTableWidth(conflicts) ||
      conflictRows.some(({ cells, noConflict }) => {
        const [earlier, later] = cells;
        const complete = cells.every((cell) => cell.length > 0 && !placeholder.test(cell));
        if (!complete) return true;
        if (noConflict) return false;
        const earlierId = (earlier ?? "").toUpperCase();
        const laterId = (later ?? "").toUpperCase();
        return !(
          /^SIG-[A-Z0-9][A-Z0-9-]*$/.test(earlierId) &&
          /^SIG-[A-Z0-9][A-Z0-9-]*$/.test(laterId) &&
          earlierId !== laterId &&
          index.signalLifecycles.has(earlierId) &&
          index.signalLifecycles.has(laterId)
        );
      }) ||
      (conflictRows.some((row) => row.noConflict) && (conflictRows.length !== 1 || !conflictRows[0]?.noConflict));
    if (invalidConflictRow) {
      target.push(
        issue(
          "error",
          "research.signal_corpus_conflict_row_invalid",
          "Every authored Conflicts And Supersession row must be width-complete and substantive. Signal IDs must resolve to distinct declared records; use a complete none/none no-conflict row only when no material conflict exists.",
          "strategy/SIGNAL_CORPUS.md",
        ),
      );
    }
  }

  const derived = sections.derived.ok ? sections.derived.section : undefined;
  const derivedColumnIndexes = derived ? SIGNAL_CORPUS_HEADERS.derived.map((headers) => tableColumnAny(derived, headers)) : [];
  if (!derived || derivedColumnIndexes.some((column) => column < 0)) {
    target.push(
      issue(
        "error",
        "research.signal_corpus_derived_columns_missing",
        "The Derived Outputs table needs Signal IDs, Output, Decision changed, and Trace ID columns.",
        "strategy/SIGNAL_CORPUS.md",
      ),
    );
  } else {
    const invalidDerivedRow =
      !rowsMatchTableWidth(derived) ||
      derived.rows.some((row) => {
        const cells = derivedColumnIndexes.map((column) => (row.cells[column] ?? "").trim());
        const signalIds = parsePrefixedIdList(cells[0] ?? "", "SIG");
        return !(
          signalIds.validSyntax &&
          signalIds.ids.length > 0 &&
          signalIds.ids.every((signalId) => index.eligibleSignalIds.has(signalId)) &&
          [cells[1] ?? "", cells[2] ?? ""].every((cell) => cell.length > 0 && !placeholder.test(cell)) &&
          /\bTRACE-[A-Z0-9][A-Z0-9-]*\b/i.test(cells[3] ?? "") &&
          !placeholder.test(cells[3] ?? "")
        );
      });
    if (invalidDerivedRow) {
      target.push(
        issue(
          "error",
          "research.signal_corpus_derived_output_invalid",
          "Every Derived Outputs row must cite only current or dated Signal IDs. It must also name a real output, changed decision, and TRACE ID. " +
            "Keep unverified, rejected, and superseded signals in the corpus, but do not use them to support an output.",
          "strategy/SIGNAL_CORPUS.md",
        ),
      );
    }
  }

  return index;
}

function normalizedTableLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function tableColumn(section: RequiredTableSection, header: string): number {
  return section.headerIndexes.get(normalizedTableLabel(header)) ?? -1;
}

function tableColumnAny(section: RequiredTableSection, headers: readonly string[]): number {
  for (const header of headers) {
    const column = tableColumn(section, header);
    if (column >= 0) return column;
  }
  return -1;
}

function rowsMatchTableWidth(section: RequiredTableSection): boolean {
  return section.rows.every((row) => row.rawCellCount === section.width);
}

function validateOfferTest(value: string | undefined, target: ReturnType<typeof issue>[]): void {
  if (!value) {
    target.push(
      issue("error", "research.offer_test_missing", "strategy/OFFER_TEST.md is required before the Go, Pivot, or Kill decision.", "strategy/OFFER_TEST.md"),
    );
    return;
  }

  const contractResult = parseRequiredTableSection(value, "Test Contract", OFFER_TEST_HEADERS.contract);
  const exposureResult = parseRequiredTableSection(value, "Exposure And Conversion", OFFER_TEST_HEADERS.exposure);
  const decisionResult = parseRequiredTableSection(value, "Decision", OFFER_TEST_HEADERS.decision);
  for (const [heading, result] of [
    ["Test Contract", contractResult],
    ["Exposure And Conversion", exposureResult],
    ["Decision", decisionResult],
  ] as const) {
    if (!result.ok) {
      target.push(
        issue(
          "error",
          `research.offer_test_${heading.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_missing`,
          `strategy/OFFER_TEST.md needs a ${heading} section.`,
          "strategy/OFFER_TEST.md",
        ),
      );
    }
  }

  const contractFields = new Map<string, string>();
  let contractStructureValid = contractResult.ok && rowsMatchTableWidth(contractResult.section);
  if (contractResult.ok) {
    const fieldColumn = tableColumn(contractResult.section, "Field");
    const valueColumn = tableColumn(contractResult.section, "Value");
    for (const row of contractResult.section.rows) {
      const field = normalizedTableLabel(row.cells[fieldColumn] ?? "");
      const fieldValue = (row.cells[valueColumn] ?? "").trim();
      if (field.length === 0 || contractFields.has(field)) contractStructureValid = false;
      contractFields.set(field, fieldValue);
    }
  }
  const requiredContractFields = ["audience", "exact discovery location", "native format", "offer", "owned relationship", "primary response", "stop rule"];
  const contractIncomplete =
    !contractStructureValid ||
    requiredContractFields.some((field) => {
      const value = contractFields.get(field) ?? "";
      if (value.length === 0 || /\b(todo|tbd|placeholder|replace with|pending|unverified|required)\b|<[^>]+>/i.test(value)) return true;
      if (field === "owned relationship" && isAbsentOwnedRelationship(value)) return true;
      if (isGenericOfferOptionMenu(field, value)) return true;
      if (field === "exact discovery location" && /^(social media|online|internet|web|app store|community|creator audience)$/i.test(value)) return true;
      if (field === "stop rule" && !/\d/.test(value)) return true;
      return false;
    });
  if (contractIncomplete) {
    target.push(
      issue(
        "error",
        "research.offer_test_contract_incomplete",
        "The offer Test Contract needs an exact audience, discovery location, native format, offer, owned route, primary response, and measurable stop rule.",
        "strategy/OFFER_TEST.md",
      ),
    );
  }

  const placeholder = /\b(todo|tbd|placeholder|replace with|pending|unverified)\b/i;
  let status: "run" | "waived" | undefined;
  let finalDecision: { date: string; decider: string } | undefined;
  if (decisionResult.ok) {
    const statusColumn = tableColumn(decisionResult.section, "Status");
    const dateColumn = tableColumn(decisionResult.section, "Date");
    const evidenceColumn = tableColumn(decisionResult.section, "Evidence");
    const decisionColumn = tableColumn(decisionResult.section, "Decision");
    const deciderColumn = tableColumn(decisionResult.section, "Decided by");
    const decisionRows = decisionResult.section.rows;
    if (decisionRows.length === 0 || !rowsMatchTableWidth(decisionResult.section)) {
      target.push(
        issue(
          "error",
          "research.offer_test_decision_missing",
          "The offer test needs a run or waived decision row with date, evidence, decision, and founder identity.",
          "strategy/OFFER_TEST.md",
        ),
      );
    } else {
      const decisionComplete = decisionRows.every((row) => {
        const rowStatus = (row.cells[statusColumn] ?? "").trim().toLowerCase();
        const decider = (row.cells[deciderColumn] ?? "").trim();
        return (
          /^(run|waived)$/.test(rowStatus) &&
          isValidPastIsoDate((row.cells[dateColumn] ?? "").trim()) &&
          [row.cells[evidenceColumn] ?? "", row.cells[decisionColumn] ?? "", decider].every((cell) => cell.trim().length > 0 && !placeholder.test(cell)) &&
          isFounderDecider(decider)
        );
      });
      if (!decisionComplete) {
        target.push(
          issue(
            "error",
            "research.offer_test_decision_incomplete",
            "The offer-test decision needs an ISO date, real evidence, a decision, and the founder or owner as decider.",
            "strategy/OFFER_TEST.md",
          ),
        );
      } else {
        const finalDecisionRow = decisionRows.at(-1)!;
        status = (finalDecisionRow.cells[statusColumn] ?? "").trim().toLowerCase() as "run" | "waived";
        finalDecision = {
          date: (finalDecisionRow.cells[dateColumn] ?? "").trim(),
          decider: (finalDecisionRow.cells[deciderColumn] ?? "").trim(),
        };
      }
    }
  }

  if (exposureResult.ok) {
    const dateColumn = tableColumn(exposureResult.section, "Date");
    const exposureColumn = tableColumn(exposureResult.section, "Exposure");
    const conversionsColumn = tableColumn(exposureResult.section, "CTA conversions");
    const sourceColumn = tableColumn(exposureResult.section, "Evidence source");
    const rowsValid =
      rowsMatchTableWidth(exposureResult.section) &&
      exposureResult.section.rows.every((row) => {
        const source = (row.cells[sourceColumn] ?? "").trim();
        return (
          isValidPastIsoDate((row.cells[dateColumn] ?? "").trim()) &&
          parseOfferMeasurement((row.cells[exposureColumn] ?? "").trim(), (row.cells[conversionsColumn] ?? "").trim()) !== undefined &&
          source.length > 0 &&
          !placeholder.test(source)
        );
      });
    if (!rowsValid || (status === "run" && exposureResult.section.rows.length === 0)) {
      target.push(
        issue(
          "error",
          "research.offer_test_measurement_missing",
          "Every offer measurement row needs a real non-future ISO date and evidence source, positive whole-number exposure, and a whole-number CTA conversion count no larger than exposure.",
          "strategy/OFFER_TEST.md",
        ),
      );
    }
  } else if (status === "run") {
    target.push(
      issue(
        "error",
        "research.offer_test_measurement_missing",
        "Every offer measurement row needs a real non-future ISO date and evidence source, positive whole-number exposure, and a whole-number CTA conversion count no larger than exposure.",
        "strategy/OFFER_TEST.md",
      ),
    );
  }

  if (status === "waived") {
    const waiverResult = parseRequiredTableSection(value, "Founder Waiver", OFFER_TEST_HEADERS.waiver);
    let validWaiver = false;
    if (waiverResult.ok) {
      const waiverDateColumn = tableColumn(waiverResult.section, "Date");
      const founderColumn = tableColumn(waiverResult.section, "Founder");
      const reasonColumn = tableColumn(waiverResult.section, "Reason");
      const riskColumn = tableColumn(waiverResult.section, "Residual risk accepted");
      const rowsValid =
        rowsMatchTableWidth(waiverResult.section) &&
        waiverResult.section.rows.length > 0 &&
        waiverResult.section.rows.every((row) => {
          const founder = row.cells[founderColumn] ?? "";
          return (
            isValidPastIsoDate((row.cells[waiverDateColumn] ?? "").trim()) &&
            isFounderDecider(founder) &&
            [row.cells[reasonColumn] ?? "", row.cells[riskColumn] ?? ""].every((cell) => cell.trim().length > 0 && !placeholder.test(cell))
          );
        });
      const matchesFinalDecision =
        finalDecision !== undefined &&
        waiverResult.section.rows.some(
          (row) =>
            (row.cells[waiverDateColumn] ?? "").trim() === finalDecision.date &&
            normalizeActorIdentity(row.cells[founderColumn] ?? "") === normalizeActorIdentity(finalDecision.decider),
        );
      validWaiver = rowsValid && matchesFinalDecision;
    }
    if (!validWaiver) {
      target.push(
        issue(
          "error",
          "research.offer_test_waiver_missing",
          "A waived offer test needs complete founder, reason, and residual-risk records, including one whose date and actor match the final Decision row's Date and Decided by fields.",
          "strategy/OFFER_TEST.md",
        ),
      );
    }
  }
}

function isEmptySignalNotApplicableReason(value: string): boolean {
  const normalized = normalizeSentinelComparison(value);
  return normalized.length === 0 || /^(?:none|n\/a|not applicable|unknown|no reason)$/i.test(normalized);
}

function isAbsentOwnedRelationship(value: string): boolean {
  const normalized = normalizeSentinelComparison(value);
  return normalized.length === 0 || /^(?:none|n\/a|not applicable|unknown|no owned (?:route|relationship))(?:\b|$)/i.test(normalized);
}

function normalizeSentinelComparison(value: string): string {
  const withoutInlineCode = value.replace(/`([^`\r\n]*)`/gu, "$1");
  const withoutBold = withoutInlineCode.replace(/\*\*([^*\r\n]*)\*\*/gu, "$1");
  return withoutBold.trim().replace(/\s+/gu, " ");
}

function isGenericOfferOptionMenu(field: string, value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (/(?:\b(?:choose one|select one|one of|for example)\b|\be\.g\.)/.test(normalized)) return true;

  const starterPhrases: Record<string, RegExp> = {
    audience: /one evidence-backed segment/,
    "exact discovery location": /named community,?\s*query,?\s*creator audience,?\s*placement,?\s*partner,?\s*or outreach list/,
    "native format": /format used at that location/,
    offer: /one truthful outcome and action/,
    "owned relationship": /email,?\s*account,?\s*push permission,?\s*direct community,?\s*or not applicable/,
    "primary response": /sign-?up,?\s*deposit,?\s*purchase,?\s*booked call,?\s*or another named action/,
    "stop rule": /an? exposure,?\s*cost,?\s*or time limit/,
  };
  if (starterPhrases[field]?.test(normalized)) return true;

  const optionTerms: Record<string, RegExp[]> = {
    "exact discovery location": [/\bcommunity\b/, /\bquery\b/, /\bcreator audience\b/, /\bplacement\b/, /\bpartner\b/, /\boutreach list\b/],
    "native format": [/\bpost\b/, /\bvideo\b/, /\bthread\b/, /\bemail\b/, /\bad\b/],
    "owned relationship": [/\bemail\b/, /\baccount\b/, /\bpush permission\b/, /\bdirect community\b/, /\bnot applicable\b/],
    "primary response": [/\bsign-?up\b/, /\bdeposit\b/, /\bpurchase\b/, /\bbooked call\b/, /\bnamed action\b/],
    "stop rule": [/\bexposure\b/, /\bcost\b/, /\btime limit\b/],
  };
  const terms = optionTerms[field] ?? [];
  return terms.filter((pattern) => pattern.test(normalized)).length > 1 && /,|\/|\bor\b/.test(normalized);
}

function isFounderDecider(value: string): boolean {
  const candidate = value.trim();
  if (candidate.length === 0 || AUTOMATION_IDENTITY.test(candidate)) return false;
  return /\b(founder|owner)\b/i.test(candidate) || (projectOwner.length > 2 && candidate.toLowerCase().includes(projectOwner.toLowerCase()));
}

function normalizeActorIdentity(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

interface SourceLedgerColumns {
  source: number;
  platform: number;
  identity: number;
  observedAt: number;
  backendQuery: number;
  transcriptVisual: number;
  observation: number;
  inference: number;
  confidence: number;
  artifactTrace: number;
}

interface SourceLedgerEvidence {
  columns: SourceLedgerColumns;
  completeRowCount: number;
  hasDatedEvidence: boolean;
  eligibleIds: Set<string>;
}

function buildSourceLedgerEvidence(section: RequiredTableSection | undefined): SourceLedgerEvidence {
  const columns: SourceLedgerColumns = {
    source: section ? tableColumnAny(section, SOURCE_LEDGER_HEADERS.source) : -1,
    platform: section ? tableColumnAny(section, SOURCE_LEDGER_HEADERS.platform) : -1,
    identity: section ? tableColumnAny(section, SOURCE_LEDGER_HEADERS.identity) : -1,
    observedAt: section ? tableColumnAny(section, SOURCE_LEDGER_HEADERS.observedAt) : -1,
    backendQuery: section ? tableColumnAny(section, SOURCE_LEDGER_HEADERS.backendQuery) : -1,
    transcriptVisual: section ? tableColumnAny(section, SOURCE_LEDGER_HEADERS.transcriptVisual) : -1,
    observation: section ? tableColumnAny(section, SOURCE_LEDGER_HEADERS.observation) : -1,
    inference: section ? tableColumnAny(section, SOURCE_LEDGER_HEADERS.inference) : -1,
    confidence: section ? tableColumnAny(section, SOURCE_LEDGER_HEADERS.confidence) : -1,
    artifactTrace: section ? tableColumnAny(section, SOURCE_LEDGER_HEADERS.artifactTrace) : -1,
  };
  const eligibleIds = new Set<string>();
  if (!section || Object.values(columns).some((column) => column < 0) || !rowsMatchTableWidth(section)) {
    return { columns, completeRowCount: 0, hasDatedEvidence: false, eligibleIds };
  }

  const hasDatedEvidence = section.rows.some((row) => isValidNonFutureRfc3339Instant(row.cells[columns.observedAt]));
  const completeRows = section.rows.filter((row) => isCompleteSourceLedgerRow(row.cells, columns));
  for (const row of completeRows) {
    for (const sourceId of extractStableIds(row.cells[columns.identity] ?? "")) eligibleIds.add(sourceId);
    for (const traceId of extractStableIds(row.cells[columns.artifactTrace] ?? "")) eligibleIds.add(traceId);
  }
  return { columns, completeRowCount: completeRows.length, hasDatedEvidence, eligibleIds };
}

function isCompleteSourceLedgerRow(cells: readonly string[], columns: SourceLedgerColumns): boolean {
  const source = cells[columns.source];
  const platform = cells[columns.platform];
  const identity = cells[columns.identity];
  const observedAt = cells[columns.observedAt];
  const backendQuery = cells[columns.backendQuery];
  const transcriptVisual = cells[columns.transcriptVisual];
  const observation = cells[columns.observation];
  const inference = cells[columns.inference];
  const confidence = cells[columns.confidence];
  const artifactTrace = cells[columns.artifactTrace];
  const placeholder = /\b(pending|todo|tbd|placeholder|replace with|n\/a without reason)\b|<[^>]+>/i;
  const requiredTextCells = [source, platform, identity, backendQuery, transcriptVisual, observation, inference, artifactTrace];
  return Boolean(
    requiredTextCells.every((cell) => cell?.trim() && !placeholder.test(cell)) &&
    isValidNonFutureRfc3339Instant(observedAt) &&
    /^(low|medium|high)$/i.test(confidence?.trim() ?? "") &&
    !placeholder.test(cells.join(" ")),
  );
}

interface ParsedIdList {
  ids: string[];
  validSyntax: boolean;
}

function parsePrefixedIdList(value: string, prefix: string): ParsedIdList {
  const parsed = parseStableIdList(value);
  return {
    ids: parsed.ids,
    validSyntax: parsed.validSyntax && parsed.ids.every((id) => id.startsWith(`${prefix.toUpperCase()}-`)),
  };
}

function parseStableIdList(value: string): ParsedIdList {
  const ids = extractStableIds(value);
  const remainder = value
    .replace(/\b[A-Z][A-Z0-9_-]*-[A-Z0-9][A-Z0-9_-]*\b/gi, " ")
    .replace(/\b(?:and)\b/gi, " ")
    .replace(/[\s,;+/&()[\]`]+/g, "");
  return { ids: [...new Set(ids)], validSyntax: remainder.length === 0 };
}

function extractStableIds(value: string): string[] {
  return [...value.matchAll(/\b[A-Z][A-Z0-9_-]*-[A-Z0-9][A-Z0-9_-]*\b/gi)].map((match) => (match[0] ?? "").toUpperCase());
}

function isValidNonFutureRfc3339Instant(value: string | undefined): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value ?? "");
  if (!match) return false;

  const [, year, month, day, hour, minute, second, offsetHour, offsetMinute] = match;
  const datePart = `${year}-${month}-${day}`;
  const calendarDate = new Date(`${datePart}T00:00:00Z`);
  if (Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== datePart) return false;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return false;
  if (offsetHour !== undefined && (Number(offsetHour) > 23 || Number(offsetMinute) > 59)) return false;

  const instant = new Date(value ?? "");
  return !Number.isNaN(instant.getTime()) && instant.getTime() <= Date.now();
}

function isValidPastIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getTime() <= Date.now();
}

function isValidPastIsoDateRange(value: string): boolean {
  const dates = value.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  if (dates.length < 1 || dates.length > 2 || !dates.every(isValidPastIsoDate)) return false;
  return dates.length === 1 || dates[0]! <= dates[1]!;
}
