#!/usr/bin/env node
/**
 * check-product-spec.ts — content floor for the product lane.
 *
 * SPEC.md is where research becomes a product decision; the lane previously
 * had no dedicated validator. Structure follows the SPEC.md contract in
 * playbook/process/artifact-contracts.md: the spec must explain why the app can
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
      // Only the FIRST contiguous table is the incumbent table — a later
      // table's header must not count as an incumbent row.
      const moatTableLines = ((): string[] => {
        const lines = moatSection.split(/\r?\n/).map((line) => line.trim());
        const start = lines.findIndex((line) => line.startsWith("|"));
        if (start === -1) return [];
        const block: string[] = [];
        for (let i = start; i < lines.length && (lines[i] ?? "").startsWith("|"); i += 1) {
          const line = lines[i] ?? "";
          if (!/^\|\s*:?-+/.test(line)) block.push(line);
        }
        return block;
      })();
      // Escaped pipes are content, not column breaks — "iOS \\| Android"
      // must stay one cell so later columns do not shift.
      // Boundary pipes are table syntax, not cells — a row without the
      // optional trailing pipe has the same four logical cells.
      const splitCells = (line: string): string[] =>
        line
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split(/(?<!\\)\|/)
          .map((cell) => cell.replace(/\\\|/g, "|").trim());
      const incumbentRows = moatTableLines
        .slice(1)
        .filter((line) => !/_example/i.test(line))
        .map((line) => splitCells(line));
      // "N/A" and "none" are empty cells wearing characters.
      const MOAT_NEGATIVE_CELL = /^(unknown|n\/?a|none|nil|null|not applicable|not yet|no result|[-—–]+)$/i;
      // Concession machinery, shared by the blocker column and the copy-test
      // answer: negation-phrased concessions on the raw text, affirmative
      // concessions checked against an immediately preceding negation.
      const CONCESSION_RAW =
        /^\s*(nothing|none)\b|^\s*no\b(?!\s+\w+\s+(can|could)\b)|\b(nothing|nobody|no one) (stops|prevents|blocks)|\bno (real |structural )?(moat|barrier|blocker)|\b(has|have) not thought of (it|this)\b/i;
      const CONCESSION_AFFIRMATIVE =
        /\bcop(?:y|ied|yable)\b[^.\n]{0,30}\b(week|sprint|days?)\b|\banyone (can|could) (copy|build|ship)\b|\b(can|could|will|would) (ship|build|clone|replicate|match)\b[^.\n]{0,40}\b(week|sprint|days?)\b|\b(better|nicer|cleaner) design(ed)?\b|\bbetter (ux|ui|execution)\b|\bfirst[- ]mover\b/i;
      const concedesTest = (value: string): boolean => {
        if (CONCESSION_RAW.test(value)) return true;
        const pattern = new RegExp(CONCESSION_AFFIRMATIVE.source, "gi");
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(value)) !== null) {
          const prefix = value.slice(Math.max(0, match.index - 18), match.index);
          if (!/(\b(cannot|can not|can'?t|won'?t|will not|not|never|no|unable to)\s*(be\s+)?|\b(no|not|never)\s+\w+\s*)$/i.test(prefix)) return true;
        }
        return false;
      };
      // Distinct incumbents only: the same row twice is still a category of
      // one.
      // The incumbents are grounded in research: an invented competitor with
      // filled cells benchmarks nothing. When RESEARCH.md is readable, each
      // counted name must appear in it.
      const researchText = readText(args.root, "RESEARCH.md") ?? readText(args.root, "research/RESEARCH.md");
      const normalizeName = (value: string): string => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
      const normalizedResearch = researchText ? normalizeName(researchText) : undefined;
      const realRowCount = new Set(
        incumbentRows
          .filter(
            (cells) =>
              cells.length >= 4 &&
              cells.slice(0, 4).every((cell) => cell.length > 0 && !MOAT_PLACEHOLDER.test(cell) && !MOAT_NEGATIVE_CELL.test(cell)) &&
              // A blocker cell that concedes the week-one copy is not a
              // blocker.
              !concedesTest(cells[3] ?? "") &&
              (!normalizedResearch || normalizedResearch.includes(normalizeName(cells[0] ?? ""))),
          )
          .map((cells) => normalizeName(cells[0] ?? "")),
      ).size;
      // §3 benchmarks the top 2–3 incumbents — one row compares against a
      // category of one.
      if (realRowCount < 2) {
        issues.push(
          issue(
            "error",
            "product_spec.incumbent_row_missing",
            "Differentiation And Moat has fewer than two real incumbent rows (top 2-3 competitors by revenue, what each does well, the beat moment, what stops " +
              "a week-one copy — every cell filled, each incumbent named in RESEARCH.md). Benchmarking against nobody is how a commodity idea ships with excellent process compliance.",
            "SPEC.md",
          ),
        );
      }
      // The labeled field only: the section's guidance prose also contains
      // "moat class" and a colon, and must never shadow the answer line.
      const moatClassValue = ((): string => {
        const lines = moatSection.split(/\r?\n/);
        const labelIndex = lines.findIndex((line) => /^\s*[-*]?\s*moat class\b/i.test(line) && line.includes(":"));
        if (labelIndex === -1) return "";
        const sameLine = ((lines[labelIndex] ?? "").split(/:(.*)/s)[1] ?? "").trim();
        if (sameLine) return sameLine;
        // Markdown continuation fills the field the normal way.
        const nextLine = lines[labelIndex + 1] ?? "";
        return /^\s+\S/.test(nextLine) && !/^\s*[-|#]/.test(nextLine) ? nextLine.trim() : "";
      })();
      // The class must be affirmed, not disclaimed: "none — there is no data,
      // workflow, … moat" names every taxonomy word while conceding all of
      // them. The doctrine's V1 exception ("no moat yet, racing to build X")
      // is honored only when X is a named class with a real date.
      // The exception commits, in one clause, to building the named class —
      // no character ceiling, no riding on taxonomy words elsewhere, no
      // negated commitments or negated revisits.
      const v1Applies = /no moat yet/i.test(moatClassValue);
      const v1BuildClause = moatClassValue
        .split(/[.;,()|]/)
        .find(
          (clause) =>
            /\b(build\w*|racing|accru\w*|grow\w*)\b/i.test(clause) &&
            /\b(data|workflow|community|taste|model|distribution)\b/i.test(clause) &&
            !/\b(not|never|won'?t|will not|cannot|can'?t|aren'?t|isn'?t|don'?t|doesn'?t|no plans? to)\b/i.test(clause),
        );
      const v1DateMatch = moatClassValue.match(/(\d{4}-\d{2}-\d{2})/);
      const v1ExceptionDate = v1DateMatch?.[1] ?? "";
      const v1ExceptionParsed = new Date(`${v1ExceptionDate}T00:00:00Z`);
      const v1RevisitOk =
        /\b(day[- ]?30|30[- ]day|d-?30)\b[^\n]{0,30}\b(retro|revisit)|\b(retro|revisit)\w*\b[^\n]{0,30}\b(day[- ]?30|30[- ]day|d-?30)\b/i.test(
          moatClassValue,
        ) && !/\b(not|never|won'?t|will not|aren'?t|don'?t)\b[^.;\n]{0,15}\b(revisit|retro)/i.test(moatClassValue);
      const v1ExceptionValid = Boolean(
        v1Applies &&
        v1BuildClause &&
        v1DateMatch &&
        !Number.isNaN(v1ExceptionParsed.getTime()) &&
        v1ExceptionParsed.toISOString().slice(0, 10) === v1ExceptionDate &&
        v1RevisitOk,
      );
      // Clause-level polarity: the taxonomy word must sit in a clause with no
      // negation at all — "data is not a moat" names the class while
      // disclaiming it, in either order.
      // The declared class is the head clause — a taxonomy word later in the
      // plan ("…the same model API") must not bless an invalid declared
      // class like "execution".
      const declaredClass = (moatClassValue.split(/[.;,—–:()|]|\s--\s|\s-\s/)[0] ?? "").trim();
      const moatClassAffirmed =
        !/^(none|no\b|n\/?a)/i.test(moatClassValue) &&
        /\b(data|workflow|community|taste|model|distribution)\b/i.test(declaredClass) &&
        !/\b(no|not|none|never|without|isn'?t|aren'?t|cannot|can'?t|won'?t)\b/i.test(declaredClass);
      // The field is class AND build plan: a bare taxonomy word explains
      // nothing, and a negated plan ("we will never collect any user
      // history") refuses the moat it names — the plan must have at least
      // one negation-free clause of real text.
      // Negation invalidates a refused build commitment, not a friendly
      // qualifier — "accrues without requiring setup" is a plan; "never
      // collect user history" is a refusal.
      const REFUSED_BUILD =
        /\b(no|not|none|never|without|isn'?t|aren'?t|don'?t|doesn'?t|cannot|can'?t|won'?t)\b\s+(?:\w+\s+){0,2}?(build\w*|collect\w*|accru\w*|grow\w*|gather\w*|store|stor\w*|creat\w*|invest\w*|ship\w*)\b/i;
      // The head clause is the declared class — praise of the class is not a
      // plan, so substance is measured on the remaining clauses only.
      const moatPlanSubstantive = moatClassValue
        .split(/[.;,—–:()|]/)
        .slice(1)
        .some(
          (clause) =>
            !REFUSED_BUILD.test(clause) &&
            !MOAT_PLACEHOLDER.test(clause) &&
            clause.replace(/\b(data|workflow|community|taste|model|distribution)\b/gi, " ").replace(/[^\p{L}\p{N}]/gu, "").length >= 15,
        );
      if (!v1ExceptionValid && !(moatClassAffirmed && moatPlanSubstantive)) {
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
      // Markdown continuation is a normal way to fill the field: when the
      // label line carries no answer, the indented next line is the answer.
      const copyTestAnswer = ((): string => {
        const lines = moatSection.split(/\r?\n/);
        const labelIndex = lines.findIndex((line) => /^\s*[-*]\s*one-week-copy test answer:/i.test(line));
        if (labelIndex === -1) return "";
        const sameLine = (lines[labelIndex] ?? "").replace(/^.*one-week-copy test answer:/i, "").trim();
        if (sameLine) return sameLine;
        const nextLine = lines[labelIndex + 1] ?? "";
        return /^\s+\S/.test(nextLine) && !/^\s*[-|#]/.test(nextLine) ? nextLine.trim() : "";
      })();
      const copyTestSubstantive =
        copyTestAnswer.replace(/[^\p{L}\p{N}]/gu, "").length >= 12 && !MOAT_PLACEHOLDER.test(copyTestAnswer) && !concedesTest(copyTestAnswer);
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
