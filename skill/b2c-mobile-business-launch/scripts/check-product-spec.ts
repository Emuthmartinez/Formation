#!/usr/bin/env node
/**
 * check-product-spec.ts — content floor for the product lane.
 *
 * SPEC.md is where research becomes a product decision; the lane previously
 * had no dedicated validator. Structure follows the SPEC.md contract in
 * references/artifact-contracts.md: the spec must explain why the app can
 * win, name the magical V1 moment, and bound V1 before engineering planning.
 *
 * npm script: check:product-spec
 * Usage: tsx scripts/check-product-spec.ts --root <app-repo-root>
 */
import { asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit } from "./lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;

const laneStatus = state ? asString(getPath(state, "lanes.product.status"))?.toLowerCase() : undefined;
const skip = laneStatus === "not_needed" || laneStatus === "deferred";
const done = laneStatus === "done";
const text = readText(args.root, "SPEC.md");

if (!skip && !text) {
  issues.push(
    issue(
      "error",
      "product_spec.markdown_missing",
      "SPEC.md is required before design, store, or engineering work hardens. Seed it from templates/SPEC.md.",
      "SPEC.md",
    ),
  );
}

if (text) {
  const requiredSections = [
    "Promise",
    "11-Star Experience",
    "Category And Competitors",
    "Differentiation And Moat",
    "Core Product Loop",
    "V1 Scalable Slice",
    "Monetization Posture",
    "Metrics",
    "Acceptance Contract",
    "Risks And Open Questions",
  ];
  for (const phrase of requiredSections) {
    if (!text.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push(
        issue(
          done ? "error" : "warning",
          `product_spec.${phrase.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.missing`,
          `SPEC.md should include a ${phrase} section (see the SPEC.md contract in artifact-contracts.md).`,
          "SPEC.md",
        ),
      );
    }
  }

  for (const ref of ["11_STAR_EXPERIENCE.md", "RESEARCH.md"]) {
    if (!text.includes(ref)) {
      issues.push(
        issue(
          done ? "error" : "warning",
          `product_spec.ref_${ref.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.missing`,
          `SPEC.md should reference ${ref} so the spec stays traced to experience and evidence.`,
          "SPEC.md",
        ),
      );
    }
  }

  if (done && /\breplace with\b|\b(TODO|TBD|placeholder)\b/i.test(text)) {
    issues.push(
      issue(
        "error",
        "product_spec.placeholder_complete",
        "The product lane cannot be done while template placeholders ('replace with', TODO/TBD) remain in SPEC.md.",
        "SPEC.md",
      ),
    );
  }

  // Differentiation substance (product-moat.md §5): the wedge lives in the
  // spec, not in a chat. A done product lane needs a real incumbent row —
  // every cell filled, none placeholder — plus a named moat class and the
  // one-week-copy test answer. Section-header presence alone is the
  // positioning-theater miss the 2026-07-26 audit found on real launches.
  if (done) {
    // An absent or empty section runs the same substance checks against
    // nothing — a prose mention or an off-level heading must not skip the
    // gate the section exists to carry.
    const moatSection = markdownSection(text, "Differentiation And Moat");
    {
      const MOAT_PLACEHOLDER = /\b(unverified|tbd|todo|pending|placeholder)\b/i;
      // Data rows only: the first pipe line is the header and is dropped by
      // position, not by keyword — a real competitor whose row mentions
      // "incumbent" must not be skipped, and a data cell echoing a header
      // keyword must not be promoted.
      const moatTableLines = moatSection
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("|") && !/^\|\s*:?-+/.test(line));
      const incumbentRows = moatTableLines
        .slice(1)
        .filter((line) => !/_example/i.test(line))
        .map((line) => line.split("|").map((cell) => cell.trim()));
      // "N/A" and "none" are empty cells wearing characters.
      const MOAT_NEGATIVE_CELL = /^(unknown|n\/?a|none|nil|null|not applicable|not yet|no result|[-—–]+)$/i;
      const realRow = incumbentRows.some(
        (cells) => cells.length >= 6 && cells.slice(1, 5).every((cell) => cell.length > 0 && !MOAT_PLACEHOLDER.test(cell) && !MOAT_NEGATIVE_CELL.test(cell)),
      );
      if (!realRow) {
        issues.push(
          issue(
            "error",
            "product_spec.incumbent_row_missing",
            "Differentiation And Moat has no real incumbent row (top competitor by revenue, what it does well, the beat moment, what stops " +
              "a week-one copy — every cell filled). Benchmarking against nobody is how a commodity idea ships with excellent process compliance.",
            "SPEC.md",
          ),
        );
      }
      const moatClassLine = moatSection.split(/\r?\n/).find((line) => /moat class/i.test(line) && line.includes(":"));
      const moatClassValue = moatClassLine ? (moatClassLine.split(/:(.*)/s)[1] ?? "").trim() : "";
      // The class must be affirmed, not disclaimed: "none — there is no data,
      // workflow, … moat" names every taxonomy word while conceding all of
      // them. The doctrine's V1 exception ("no moat yet, racing to build X")
      // is honored only when X is a named class with a real date.
      const v1ExceptionMatch = moatClassValue.match(/no moat yet[^\n]*?\b(data|workflow|community|taste|model|distribution)\b[^\n]*?(\d{4}-\d{2}-\d{2})/i);
      const v1ExceptionDate = v1ExceptionMatch?.[2] ?? "";
      const v1ExceptionParsed = new Date(`${v1ExceptionDate}T00:00:00Z`);
      const v1ExceptionValid = Boolean(
        v1ExceptionMatch && !Number.isNaN(v1ExceptionParsed.getTime()) && v1ExceptionParsed.toISOString().slice(0, 10) === v1ExceptionDate,
      );
      const affirmativeMoatValue = moatClassValue.replace(/\b(no|not|none|without|never)\b[^.;,—–:()|]*/gi, "");
      const moatClassAffirmed =
        !/^(none|no\b|n\/?a)/i.test(moatClassValue) && /\b(data|workflow|community|taste|model|distribution)\b/i.test(affirmativeMoatValue);
      if (!v1ExceptionValid && !moatClassAffirmed) {
        issues.push(
          issue(
            "error",
            "product_spec.moat_class_missing",
            "Differentiation And Moat names no moat class. Pick one honestly from product-moat.md §2 (data / workflow / community / taste / " +
              'model / distribution) with its build plan — "our execution will be better" is not a moat class.',
            "SPEC.md",
          ),
        );
      }
      const copyTestAnswer = (moatSection.match(/one-week-copy test answer:\s*(.*)$/im)?.[1] ?? "").trim();
      // An answer that concedes the test is a failed test, not a recorded one.
      const COPY_CONCESSION =
        /^\s*(nothing|none|no)\b|\b(nothing|nobody|no one) (stops|prevents|blocks)|\bcop(?:y|ied|yable)\b[^.\n]{0,30}\b(week|sprint|days?)\b|anyone (can|could) (copy|build|ship)|no (real |structural )?(moat|barrier|blocker)/i;
      const copyTestSubstantive =
        copyTestAnswer.replace(/[^a-z0-9]/gi, "").length >= 12 && !MOAT_PLACEHOLDER.test(copyTestAnswer) && !COPY_CONCESSION.test(copyTestAnswer);
      if (!copyTestSubstantive) {
        issues.push(
          issue(
            "error",
            "product_spec.copy_test_missing",
            "Differentiation And Moat records no one-week-copy test answer. Write down what structurally stops the incumbent from shipping " +
              "this wedge in a sprint (product-moat.md §1) — an unanswered copy test is a wedge on borrowed time.",
            "SPEC.md",
          ),
        );
      }
    }
  }
}

reportAndExit("Product spec check", issues);

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
