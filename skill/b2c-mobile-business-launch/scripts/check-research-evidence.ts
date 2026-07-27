#!/usr/bin/env node
/**
 * check-research-evidence.ts — content floor for the research lane.
 *
 * RESEARCH.md is the evidence root every downstream lane traces back to, yet
 * the lane previously had no dedicated validator: only the generic
 * lane-coverage status floor saw it. Structure follows the RESEARCH.md
 * contract in references/artifact-contracts.md.
 *
 * npm script: check:research
 * Usage: tsx scripts/check-research-evidence.ts --root <app-repo-root>
 */
import { asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit } from "./lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;

const laneStatus = state ? asString(getPath(state, "lanes.research.status"))?.toLowerCase() : undefined;
const skip = laneStatus === "not_needed" || laneStatus === "deferred";
const done = laneStatus === "done";
const text = readText(args.root, "RESEARCH.md");

if (!skip && !text) {
  issues.push(
    issue(
      "error",
      "research.markdown_missing",
      "RESEARCH.md is required: it is the evidence root that SPEC.md, brand, ASO, pricing, and funnel decisions trace back to. Seed it from templates/RESEARCH.md.",
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
    // ── Pre-build Go/Pivot/Kill gate ────────────────────────────────────────
    // Research that never converts evidence into a build-or-not decision is
    // the expensive miss the 2026-07-26 audit named: the launch machinery will
    // polish and ship any input idea, so the one evidence-gated exit ramp is
    // here, before Phase 2 spends design/build/store effort. The agent
    // assembles the evidence; the verdict is the founder's call — and a Kill
    // or Pivot at this checkpoint is the process working, not failing.
    const PLACEHOLDER_TEXT = /\b(unverified|tbd|todo|to be filled|pending|placeholder)\b/i;

    const revenueSection = markdownSection(text, "Category Revenue Reality");
    if (revenueSection) {
      const revenueRows = tableDataRows(revenueSection).filter((row) => !/_example/i.test(row.join(" ")));
      if (!revenueRows.some((row) => row.some((cell) => /\$\s*[\d,.]+/.test(cell)))) {
        issues.push(
          issue(
            "error",
            "research.category_revenue_row_missing",
            "Done research needs at least one real competitor revenue row in Category Revenue Reality (a dollar estimate with its source). " +
              "Collecting AppKittie data is not the gate — the judged number is: a category whose top apps gross too little cannot " +
              "become a real business no matter how well the launch executes.",
            "RESEARCH.md",
          ),
        );
      }
      if (!/pass or fail[^:\n]*:\s*(pass|fail)/i.test(revenueSection)) {
        issues.push(
          issue(
            "error",
            "research.category_revenue_bar_unjudged",
            "Category Revenue Reality states no pass/fail judgment against the recorded bar. The table without the verdict line is " +
              "data collection wearing a gate's clothes — write the bar and judge the category against it.",
            "RESEARCH.md",
          ),
        );
      }
    }

    const verdictSection = markdownSection(text, "Go, Pivot, Or Kill");
    if (verdictSection) {
      const verdictColumn = tableColumnIndex(verdictSection, /verdict/i);
      const verdictRows = tableDataRows(verdictSection)
        .map((cells) => ({
          cells,
          date: /^\d{4}-\d{2}-\d{2}$/.test(cells[1]?.trim() ?? "") ? (cells[1]?.trim() ?? "") : undefined,
          verdict:
            verdictColumn === -1
              ? undefined
              : (cells[verdictColumn] ?? "")
                  .trim()
                  .match(/^(go|pivot|kill)\b/i)?.[1]
                  ?.toLowerCase(),
        }))
        .filter((row) => row.date && row.verdict);
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
        const latest = verdictRows.reduce((a, b) => ((a.date ?? "") >= (b.date ?? "") ? a : b));
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
        } else if (decision !== latest.verdict) {
          issues.push(
            issue(
              "error",
              "research.go_pivot_kill_state_mismatch",
              `lanes.research.go_pivot_kill_decision ("${decision}") disagrees with the latest verdict row in RESEARCH.md ("${latest.verdict}"). ` +
                `Update the mirror when the verdict changes — a build proceeding on a stale state verdict is the exact miss this gate exists to stop.`,
              "PROJECT_STATE.yaml",
            ),
          );
        }
      }
    }

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

/** Index of the header column matching `pattern` in the section's first table header row, or -1. */
function tableColumnIndex(section: string, pattern: RegExp): number {
  const header = section.split(/\r?\n/).find((line) => line.trim().startsWith("|") && pattern.test(line));
  if (!header) return -1;
  return header.split("|").findIndex((cell) => pattern.test(cell));
}
