#!/usr/bin/env node
/**
 * check-research-evidence.ts — content floor for the research lane.
 *
 * RESEARCH.md is the evidence root every downstream lane traces back to, yet
 * the lane previously had no dedicated validator: only the generic
 * lane-coverage status floor saw it. Structure follows the RESEARCH.md
 * contract in playbook/process/artifact-contracts.md.
 *
 * npm script: check:research
 * Usage: tsx gates/research/check-research-evidence.ts --root <app-repo-root>
 */
import { asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit } from "../../scripts/lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;

const laneStatus = state ? asString(getPath(state, "lanes.research.status"))?.toLowerCase() : undefined;
const skip = laneStatus === "not_needed" || laneStatus === "deferred";
const done = laneStatus === "done";
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
const verdictRequired = done || buildPhase || downstreamActive;
const text = readText(args.root, "RESEARCH.md");

// A deferred/not_needed research lane suppresses the missing-file error only
// before the build phases: from phase_2 onward the verdict is mandatory, so
// the artifact that carries it is too — deferring research out of existence
// is not a route around the pre-build checkpoint.
if ((!skip || buildPhase || downstreamActive) && !text) {
  issues.push(
    issue(
      "error",
      "research.markdown_missing",
      "RESEARCH.md is required: it is the evidence root that SPEC.md, brand, ASO, pricing, and funnel decisions trace back to" +
        (buildPhase && skip ? ", and from phase_2 onward the Go/Pivot/Kill verdict it carries is mandatory even for a deferred research lane" : "") +
        ". Seed it from business/RESEARCH.md.",
      "RESEARCH.md",
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
    "Go, Pivot, Or Kill",
  ]) {
    if (!text.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push(
        issue(
          done ? "error" : "warning",
          `research.${phrase.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.missing`,
          `RESEARCH.md should include a ${phrase} section (see the RESEARCH.md contract in artifact-contracts.md).`,
          "RESEARCH.md",
        ),
      );
    }
  }

  if (!text.includes("LAUNCH_TRACE")) {
    issues.push(
      issue(
        done ? "error" : "warning",
        "research.trace_pointer.missing",
        "RESEARCH.md should give major decisions trace IDs or LAUNCH_TRACE.md pointers so evidence stays connected to build decisions.",
        "RESEARCH.md",
      ),
    );
  }

  if (done) {
    for (const column of ["URL / source ID", "Observed at", "Tool / backend / query", "Transcript / visual", "Observation", "Inference", "Artifact / trace"]) {
      if (!text.toLowerCase().includes(column.toLowerCase())) {
        issues.push(
          issue(
            "error",
            `research.source_ledger_${column.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.missing`,
            `Done research needs the ${column} provenance column so browser/social/video evidence is reproducible.`,
            "RESEARCH.md",
          ),
        );
      }
    }
    if (/\bYYYY-MM-DD\b|\breplace with\b|\b(TODO|TBD|placeholder)\b/i.test(text)) {
      issues.push(
        issue(
          "error",
          "research.placeholder_complete",
          "Research cannot be done while template placeholders (YYYY-MM-DD, 'replace with', TODO/TBD) remain in RESEARCH.md.",
          "RESEARCH.md",
        ),
      );
    }
    if (!/\b20\d{2}-\d{2}-\d{2}\b/.test(text)) {
      issues.push(
        issue(
          "error",
          "research.no_dated_evidence",
          "A done research lane needs at least one dated evidence row (a real YYYY-MM-DD date) so freshness is checkable.",
          "RESEARCH.md",
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

    const revenueSection = markdownSection(text, "Category Revenue Reality");
    if (!revenueSection) {
      // The phrase in prose is not the section: a done lane needs the parsed
      // heading, or every substance check below silently skips.
      issues.push(
        issue(
          "error",
          "research.category_revenue_reality.section_missing",
          'RESEARCH.md mentions Category Revenue Reality but has no "## Category Revenue Reality" section. The gate reads the section, not the phrase.',
          "RESEARCH.md",
        ),
      );
    } else {
      // The revenue estimate and its source are parsed from their intended
      // columns: a dollar amount drifting in an unrelated cell, or a blank
      // source, is data-shaped text rather than a sourced estimate.
      const revenueColumn = tableColumnIndex(revenueSection, /revenue/i);
      const sourceColumn = tableColumnIndex(revenueSection, /source/i);
      const revenueRows = tableDataRows(revenueSection).filter((row) => !/_example/i.test(row.join(" ")));
      const sourcedRow = (row: string[]): boolean => {
        const revenueCell = revenueColumn > 0 ? (row[revenueColumn] ?? "") : "";
        const sourceCell = sourceColumn > 0 ? (row[sourceColumn] ?? "") : "";
        return (
          /\$\s*\d[\d,]*(?:\.\d+)?/.test(revenueCell) &&
          sourceCell.trim().length > 0 &&
          !PLACEHOLDER_TEXT.test(sourceCell) &&
          /\d{4}-\d{2}-\d{2}/.test(sourceCell)
        );
      };
      if (revenueColumn <= 0 || sourceColumn <= 0 || !revenueRows.some(sourcedRow)) {
        issues.push(
          issue(
            "error",
            "research.category_revenue_row_missing",
            "Done research needs at least one real competitor revenue row in Category Revenue Reality: a dollar estimate in the revenue " +
              "column AND a dated, non-placeholder source in the source column. Collecting AppKittie data is not the gate — the judged, " +
              "sourced number is: a category whose top apps gross too little cannot become a real business however well the launch executes.",
            "RESEARCH.md",
          ),
        );
      }
      const barLine = revenueSection.split(/\r?\n/).find((line) => /stated bar/i.test(line) && line.includes(":"));
      const barValue = barLine ? (barLine.split(/:(.*)/s)[1] ?? "").trim() : "";
      const barStated = barValue.length > 0 && /\d/.test(barValue) && !PLACEHOLDER_TEXT.test(barValue);
      if (!barStated || !/pass or fail[^:\n]*:\s*(pass|fail)/i.test(revenueSection)) {
        issues.push(
          issue(
            "error",
            "research.category_revenue_bar_unjudged",
            "Category Revenue Reality needs a substantive stated bar (a number, not a blank or placeholder) AND an explicit pass/fail judgment " +
              "against it. A pass verdict over no stated threshold, or a table without the judgment line, is data collection wearing a gate's clothes.",
            "RESEARCH.md",
          ),
        );
      }
    }

    const verdictSection = markdownSection(text, "Go, Pivot, Or Kill");
    if (!verdictSection) {
      issues.push(
        issue(
          "error",
          "research.go_pivot_or_kill.section_missing",
          'RESEARCH.md mentions Go, Pivot, Or Kill but has no "## Go, Pivot, Or Kill" section. The gate reads the section, not the phrase.',
          "RESEARCH.md",
        ),
      );
    } else {
      const verdictColumn = tableColumnIndex(verdictSection, /verdict/i);
      // The three named evidence columns must exist between Date and Verdict:
      // a table renamed to Notes | Opinion | Summary carries cells, not the
      // required inputs, and a stripped table carries nothing at all.
      const evidenceColumnPatterns: RegExp[] = [/category revenue|revenue reality/i, /wedge/i, /demand/i];
      const evidenceColumnsPresent = evidenceColumnPatterns.every((pattern) => {
        const index = tableColumnIndex(verdictSection, pattern);
        return index > 1 && (verdictColumn === -1 || index < verdictColumn);
      });
      if (verdictColumn !== -1 && !evidenceColumnsPresent) {
        issues.push(
          issue(
            "error",
            "research.go_pivot_kill_evidence_columns_missing",
            "The Go, Pivot, Or Kill table is missing its named evidence columns. Category revenue reality, wedge, and demand signal must " +
              "each have a column between Date and Verdict — a verdict table with the reasons renamed or removed is a decision without its inputs.",
            "RESEARCH.md",
          ),
        );
      }
      const parsedRows = tableDataRows(verdictSection).map((cells) => ({
        cells,
        date: /^\d{4}-\d{2}-\d{2}$/.test(cells[1]?.trim() ?? "") ? (cells[1]?.trim() ?? "") : undefined,
        verdict:
          verdictColumn === -1
            ? undefined
            : (cells[verdictColumn] ?? "")
                .trim()
                .match(/^(go|pivot|kill)\b/i)?.[1]
                ?.toLowerCase(),
      }));
      const verdictRows = parsedRows.filter((row) => row.date && row.verdict);
      // A malformed decision row (mistyped date, missing verdict keyword) is
      // reported, never silently dropped — dropping it would fall back to an
      // older verdict the founder already superseded.
      const malformedRows = parsedRows.filter((row) => !(row.date && row.verdict) && row.cells.some((cell) => cell.trim().length > 0));
      if (malformedRows.length > 0) {
        issues.push(
          issue(
            "error",
            "research.go_pivot_kill_row_malformed",
            `The Go, Pivot, Or Kill table has ${malformedRows.length} row(s) with a mistyped date (ISO YYYY-MM-DD required) or verdict ` +
              `(Go/Pivot/Kill required). Fix the row — a malformed later decision must never silently lose to an older one.`,
            "RESEARCH.md",
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
            "RESEARCH.md",
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
        const decidedColumn = tableColumnIndex(verdictSection, /decided by/i);
        const decidedByCell = decidedColumn === -1 ? "" : (latest.cells[decidedColumn] ?? "").trim();
        const AUTOMATION_IDENTITY = /\b(agent|codex|claude|gpt|assistant|bot|automation|autopilot|ai)\b/i;
        // The founder counts by role or by their recorded name (project.owner).
        const ownerName = (asString(getPath(state, "project.owner")) ?? "").trim();
        const namedFounder =
          /\b(founder|owner)\b/i.test(decidedByCell) || (ownerName.length > 2 && decidedByCell.toLowerCase().includes(ownerName.toLowerCase()));
        if (decidedByCell.length === 0 || PLACEHOLDER_TEXT.test(decidedByCell) || AUTOMATION_IDENTITY.test(decidedByCell) || !namedFounder) {
          issues.push(
            issue(
              "error",
              "research.go_pivot_kill_decider_missing",
              'The latest Go, Pivot, Or Kill row does not name the founder in "Decided by" (empty, placeholder, or an automation identity). ' +
                "The verdict is founder-only, never automatic — record the founder by name or role. An agent recording Go for itself is the exact bypass this gate exists to stop.",
              "RESEARCH.md",
            ),
          );
        }
        const evidenceCells = verdictColumn > 2 ? latest.cells.slice(2, verdictColumn) : [];
        if (evidenceCells.some((cell) => cell.trim().length === 0 || PLACEHOLDER_TEXT.test(cell))) {
          issues.push(
            issue(
              "error",
              "research.go_pivot_kill_evidence_thin",
              "The latest Go, Pivot, Or Kill row carries empty or placeholder evidence cells. A verdict decided over " +
                '"unverified" is a mood, not a decision — fill category revenue, wedge, and demand from the ledger above before recording it.',
              "RESEARCH.md",
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
              "RESEARCH.md",
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
              "RESEARCH.md records a Go, Pivot, Or Kill verdict but lanes.research.go_pivot_kill_decision/go_pivot_kill_decided_at " +
                "do not hold a valid verdict (go|pivot|kill) with an ISO date. The state mirror is what downstream lanes and the portfolio pipeline read.",
              "PROJECT_STATE.yaml",
            ),
          );
        } else if (decision !== latest.verdict || decidedAt !== latest.date) {
          issues.push(
            issue(
              "error",
              "research.go_pivot_kill_state_mismatch",
              `lanes.research.go_pivot_kill_decision/decided_at ("${decision}" on ${decidedAt}) disagree with the latest verdict row in RESEARCH.md ` +
                `("${latest.verdict}" on ${latest.date}). Both the verdict and its date must match — a stale or forward-dated mirror is what downstream ` +
                `lanes and the portfolio pipeline would act on.`,
              "PROJECT_STATE.yaml",
            ),
          );
        }
      }
    }
  }

  if (done) {
    const rows = sourceLedgerRows(text);
    const completeRows = rows.filter((row) => {
      if (row.length < 10) return false;
      const [source, , identity, observedAt, backendQuery, transcriptVisual, observation, inference, confidence, artifactTrace] = row;
      return Boolean(
        source?.trim() &&
        identity?.trim() &&
        isDateTime(observedAt) &&
        backendQuery?.trim() &&
        transcriptVisual?.trim() &&
        observation?.trim() &&
        inference?.trim() &&
        /^(low|medium|high)$/i.test(confidence?.trim() ?? "") &&
        artifactTrace?.trim() &&
        !/\b(pending|todo|tbd|n\/a without reason)\b/i.test(row.join(" ")),
      );
    });
    if (completeRows.length === 0) {
      issues.push(
        issue(
          "error",
          "research.source_ledger_row_missing",
          "Done research needs at least one complete Source Ledger evidence row; headers and an unrelated date are not proof.",
          "RESEARCH.md",
        ),
      );
    }
  }
}

reportAndExit("Research evidence check", issues);

function sourceLedgerRows(value: string): string[][] {
  const lines = value.split(/\r?\n/);
  const header = lines.findIndex((line) => line.includes("URL / source ID") && line.includes("Artifact / trace"));
  if (header < 0) return [];
  const rows: string[][] = [];
  for (const line of lines.slice(header + 1)) {
    if (!line.trim().startsWith("|")) break;
    if (/^\|\s*:?-+/.test(line)) continue;
    rows.push(
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
  }
  return rows;
}

function isDateTime(value: string | undefined): boolean {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(new Date(value).getTime()));
}

/** The block from a `## <heading>` line to the next `## ` heading (or EOF). */
function markdownSection(markdown: string, heading: string): string {
  const lines = markdown.split(/\r?\n/);
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingPattern = new RegExp(`^##\\s*${escaped}`, "i");
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

/** Data rows of the section's first table: header and separator rows skipped, cells split raw (index 1 is the first real cell). */
function tableDataRows(section: string): string[][] {
  const rows: string[][] = [];
  let headerSeen = false;
  for (const line of section.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    if (/^\|\s*:?-+/.test(trimmed)) continue;
    if (!headerSeen) {
      headerSeen = true;
      continue;
    }
    rows.push(trimmed.split("|").map((cell) => cell.trim()));
  }
  return rows;
}

/** Index of the column matching `pattern` in the section's first table HEADER
 * row only — data cells that happen to contain a header keyword must never
 * satisfy a column requirement. */
function tableColumnIndex(section: string, pattern: RegExp): number {
  const header = section.split(/\r?\n/).find((line) => line.trim().startsWith("|"));
  if (!header || !pattern.test(header)) return -1;
  return header.split("|").findIndex((cell) => pattern.test(cell));
}
