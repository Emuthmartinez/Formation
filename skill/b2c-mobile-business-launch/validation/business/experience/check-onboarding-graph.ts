#!/usr/bin/env node
/**
 * Deterministic contract gate for the generalized onboarding system graph.
 *
 * This validator does not grade conversion taste. It proves that the canonical artifact carries the graph, evidence joins, first-value and activation distinctions,
 * screen and control contracts, provider and policy research, typed analytics, compliant review timing, visual design requirements, and replacement-mode deletion plan.
 */
import { asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit, type Issue } from "../../../tooling/lib/launch-state.js";

const TEMPLATE_DIRECTIVE_VERBS = new Set([
  "add",
  "added",
  "capture",
  "captured",
  "choose",
  "chosen",
  "complete",
  "completed",
  "define",
  "defined",
  "describe",
  "described",
  "document",
  "documented",
  "enter",
  "entered",
  "fill",
  "filled",
  "finish",
  "finished",
  "include",
  "included",
  "insert",
  "inserted",
  "mark",
  "marked",
  "note",
  "noted",
  "provide",
  "provided",
  "record",
  "replace",
  "replaced",
  "select",
  "selected",
  "specify",
  "specified",
  "update",
  "updated",
  "write",
  "written",
]);

// Not a shared parseCliArgs flag: this is the one caller-specific switch that turns the
// lane-state-derived strict check into an unconditional one, used only by ONB-22's own gate
// invocation (check:onboarding-graph-complete) -- see the requireDone block below.
const requireDone = process.argv.includes("--require-done");
const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues: Issue[] = [...loaded.issues];
const state = loaded.state;

const candidates = ["product/ONBOARDING.md", "business/product/ONBOARDING.md"];
const artifact = candidates
  .map((relativePath) => ({ relativePath, text: readText(args.root, relativePath) }))
  .find((candidate) => candidate.text !== undefined);

const laneStatus = state ? asString(getPath(state, "lanes.onboarding.status")) : undefined;
const laneAbsent = state ? getPath(state, "lanes.onboarding") === undefined : true;
// The not_needed/deferred exemption belongs to the general (lenient) invocation only. Under
// --require-done -- ONB-22's own gate -- a deferred or not_needed lane must still fail: skipping
// it here would let the engine accept the final execute/cutover/verify node on a workspace that
// never finished onboarding at all.
const skip = (laneStatus === "not_needed" || laneStatus === "deferred") && !requireDone;

if (!skip && laneAbsent) {
  issues.push(
    issue(
      "error",
      "onboarding_graph.lane_missing",
      "state/PROJECT_STATE.yaml must include lanes.onboarding unless the lane is explicitly not_needed or deferred with a founder-approved reason.",
      "state/PROJECT_STATE.yaml",
    ),
  );
}

if (!skip && !artifact) {
  issues.push(
    issue(
      "error",
      "onboarding_graph.artifact_missing",
      "product/ONBOARDING.md is required as the canonical onboarding graph, evidence, journey, screen, control, analytics, and cutover contract.",
      "product/ONBOARDING.md",
    ),
  );
}

if (!skip && artifact) {
  const text = artifact.text ?? "";
  const relativePath = artifact.relativePath;
  const requiredSections = [
    "Execution Mode",
    "Graph Run",
    "Source Map And Current-State Trace",
    "Evidence Ledger",
    "Competitor Review Matrix",
    "Onbo Hub Pattern Atlas",
    "Internal Guidance Audit",
    "Seven-Principle Activation Audit",
    "Provider Capability Matrix",
    "Platform Policy Matrix",
    "60fps Motion Register",
    "Evidence Decision And Complaint Traceability",
    "First Value And Activation",
    "Effort-Before-Value Ledger",
    "Question Usefulness Matrix",
    "Canonical State Model",
    "Architecture Decision",
    "Journey Graph",
    "Screen Inventory",
    "Control And Action Contract",
    "Paywall Contract",
    "Review Request Contract",
    "Analytics Contract",
    "Experimentation",
    "Permissions And Lifecycle",
    "Failure And Recovery",
    "Accessibility And Localization",
    "Privacy And Security",
    "Performance And Observability",
    "Prototype And Design Proof",
    "Synthetic One-Star Pre-Mortem",
    "Compound Engineering Implementation Plan",
    "Zero-Legacy Cutover",
    "Verification",
  ];

  for (const section of requiredSections) {
    if (!hasHeading(text, section)) {
      issues.push(
        issue("error", `onboarding_graph.section_${codeFor(section)}_missing`, `${relativePath} must include a "## ${section}" section.`, relativePath),
      );
    }
  }

  for (let index = 0; index <= 22; index += 1) {
    const node = `ONB-${String(index).padStart(2, "0")}`;
    if (!text.includes(node)) {
      issues.push(
        issue(
          "error",
          "onboarding_graph.node_missing",
          `${relativePath} must include graph node ${node}; the nested onboarding graph runs ONB-00 through ONB-22.`,
          relativePath,
        ),
      );
    }
  }

  requirePhrases(
    issues,
    relativePath,
    text,
    "onboarding_graph.evidence_contract",
    [
      "authorized Onbo Hub",
      "Do not scrape",
      "positive",
      "root-cause",
      "60fps MCP",
      "search_shots",
      "get_motion_breakdown",
      "RevenueCat",
      "technically possible",
      "policy permitted",
      "seven-principle",
    ],
    "The evidence contract must cover authorized Onbo Hub research, review controls, 60fps MCP, provider capabilities, policy distinctions, and the seven-principle audit.",
  );

  requirePhrases(
    issues,
    relativePath,
    text,
    "onboarding_graph.activation_contract",
    ["First value rendered", "First value engaged", "Activation", "Effort-Before-Value", "personalization proof", "populated normal product"],
    "The artifact must distinguish first value, engagement, activation, effort, visible personalization proof, and entry into a populated product experience.",
  );

  requirePhrases(
    issues,
    relativePath,
    text,
    "onboarding_graph.design_contract",
    ["ONB-SCR-001", "ONB-CTL-001", "Every screen has one dominant", "Actual high-fidelity", "interactive", "reduced motion"],
    "The artifact must carry stable screen and control IDs, one dominant action, actual visual and interactive design requirements, and reduced-motion behavior.",
  );

  requirePhrases(
    issues,
    relativePath,
    text,
    "onboarding_graph.analytics_contract",
    [
      "machine-readable schema",
      "typed clients",
      "event_id",
      "Authoritative emitter",
      "identity stitching",
      "Deduplication",
      "Experiment",
      "Expected Event Sequences",
      "provider-confirmed",
    ],
    "Analytics must be a typed cross-surface contract with authoritative emitters, identity stitching, deduplication, exposure semantics, expected sequences, and provider-confirmed revenue.",
  );

  requirePhrases(
    issues,
    relativePath,
    text,
    "onboarding_graph.review_contract",
    [
      "outside first-run onboarding",
      "Native platform API only",
      "Sentiment gate",
      "Custom rating UI",
      "review_eligibility_earned",
      "review_request_attempted",
      "remote kill switch",
    ],
    "Review eligibility may be earned early, but the request must be native, outside first-run onboarding, ungated by sentiment, observable, and remotely suppressible.",
  );

  for (const forbiddenEvent of ["review_prompt_shown", "review_submitted", "review_rating_value"]) {
    if (text.includes(forbiddenEvent)) {
      issues.push(
        issue(
          "error",
          "onboarding_graph.review_unobservable_event",
          `${relativePath} names ${forbiddenEvent}, which claims a platform outcome the app cannot reliably observe. Record eligibility, suppression, API attempt, and API return only.`,
          relativePath,
        ),
      );
    }
  }

  const reviewInsideFirstRun =
    /native (?:app )?review (?:prompt|request) immediately after first value inside first-run onboarding/i.test(text) ||
    /immediately after first value inside first-run onboarding.{0,80}(?:review|rating)/i.test(text);
  if (reviewInsideFirstRun) {
    issues.push(
      issue(
        "error",
        "onboarding_graph.review_inside_first_run",
        `${relativePath} directs a review request immediately after first value inside onboarding. Earn eligibility there if appropriate, finish onboarding, and request at a later natural success.`,
        relativePath,
      ),
    );
  }

  requirePhrases(
    issues,
    relativePath,
    text,
    "onboarding_graph.replacement_contract",
    ["hard cutover", "durable user value", "one-time", "Deletion Manifest", "minimum supported client", "Do not keep the old runtime", "zero-legacy"],
    "Replacement mode must preserve durable user value through an isolated one-time transformation while hard-cutting to one runtime and deleting legacy architecture.",
  );

  requirePhrases(
    issues,
    relativePath,
    text,
    "onboarding_graph.reliability_contract",
    ["Purchase pending", "Restore", "deep link", "identity", "Analytics failure does not block first value", "unsupported client", "observability"],
    "The artifact must cover purchase, restore, handoff, identity, nonblocking analytics, unsupported-client, and observability behavior.",
  );

  // requireDone forces the strict block below to run even while lanes.onboarding.status is
  // still not_started -- otherwise ONB-22's gate (whose only check this is) can pass on the
  // unfilled shipped template, since nothing else forces the lane to actually be marked done
  // before the engine accepts the final "execute, cut over, verify" node as complete.
  if (requireDone && laneStatus !== "done") {
    issues.push(
      issue(
        "error",
        "onboarding_graph.not_marked_done",
        `${relativePath}'s owning workflow gate requires lanes.onboarding.status=done before it can be accepted, but state/PROJECT_STATE.yaml has lanes.onboarding.status=${laneStatus ?? "(unset)"}.`,
        "state/PROJECT_STATE.yaml",
      ),
    );
  }

  if (laneStatus === "done" || requireDone) {
    const liveText = stripFencedBlocks(text);
    const genericPlaceholders = [/\bnot_started\b/i, /\bTODO\b/i, /\bTBD\b/i];
    const placeholderCells = tablePlaceholderCells(liveText);
    const placeholderProseLines = proseDirectiveLines(liveText);

    if (genericPlaceholders.some((pattern) => pattern.test(liveText)) || placeholderCells.length > 0 || placeholderProseLines.length > 0) {
      issues.push(
        issue(
          "error",
          "onboarding_graph.placeholder_complete",
          `${relativePath} cannot support lanes.onboarding.status=done while template directives, generic completion labels, or not_started graph nodes remain.`,
          relativePath,
        ),
      );
    }

    const headerStatus = artifactStatus(liveText);
    if (headerStatus !== "done") {
      issues.push(
        issue(
          "error",
          "onboarding_graph.artifact_status_not_done",
          `${relativePath} claims the onboarding lane is done but its own "Status: \`${headerStatus ?? "(missing)"}\`" header does not say done.`,
          relativePath,
        ),
      );
    }

    for (let index = 0; index <= 22; index += 1) {
      const node = `ONB-${String(index).padStart(2, "0")}`;
      if (!graphRunNodeDone(text, node)) {
        issues.push(
          issue(
            "error",
            "onboarding_graph.node_not_done",
            `${relativePath} claims the onboarding lane is done but graph node ${node} is not recorded as done in the Graph Run table.`,
            relativePath,
          ),
        );
      }
    }

    const uncheckedVerificationItems = countUncheckedItems(sectionBody(liveText, "Verification"));
    if (uncheckedVerificationItems > 0) {
      issues.push(
        issue(
          "error",
          "onboarding_graph.verification_incomplete",
          `${relativePath} claims the onboarding lane is done but its Verification section still has ${uncheckedVerificationItems} unchecked item(s).`,
          relativePath,
        ),
      );
    }
  }
}

reportAndExit("Onboarding system graph check", issues);

function hasHeading(text: string, heading: string): boolean {
  return text.split(/\r?\n/).some((line) => line.trim() === `## ${heading}`);
}

/** Returns the line range right after a "## {heading}" line, up to (not including) the next "## " heading or the end of the artifact. */
function sectionBody(text: string, heading: string): string {
  const lines = text.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (startIndex === -1) return "";
  const rest = lines.slice(startIndex + 1);
  const endIndex = rest.findIndex((line) => /^##\s/.test(line.trim()));
  return (endIndex === -1 ? rest : rest.slice(0, endIndex)).join("\n");
}

function isTableSeparatorRow(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(line);
}

// Reads the node's status from the Graph Run table's own Status column (located by the header
// row), not from any cell in the row -- an owner/result cell that happens to mention "done" in
// prose must not be mistaken for the node's actual recorded status.
function graphRunNodeDone(text: string, node: string): boolean {
  const tableLines = sectionBody(text, "Graph Run")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));
  const headerLine = tableLines[0];
  if (!headerLine) return false;
  const header = headerLine.split("|").map((cell) => cell.trim().toLowerCase());
  const nodeIndex = header.indexOf("node");
  const statusIndex = header.indexOf("status");
  if (nodeIndex === -1 || statusIndex === -1) return false;

  return tableLines.slice(1).some((line) => {
    if (isTableSeparatorRow(line)) return false;
    const cells = line.split("|").map((cell) => cell.trim());
    return cells[nodeIndex] === `\`${node}\`` && cells[statusIndex] === "done";
  });
}

function countUncheckedItems(section: string): number {
  return (section.match(/^-\s*\[\s*\]/gm) ?? []).length;
}

/** The artifact's own "Status: `word`" header, mirrored from tooling/lib/artifact-pages.ts's renderSourceArtifactPage. */
function artifactStatus(text: string): string | undefined {
  return text.match(/^Status:\s*`?([^`\n]+)`?/m)?.[1]?.trim();
}

// tablePlaceholderCells() only ever looked at table rows; the shipped template also opens
// several sections (Execution Mode, Source Map And Current-State Trace, First Value And
// Activation, ...) with an ordinary directive-verb-led paragraph rather than a table, and those
// were never checked -- a "done" artifact could authorize ONB-22's destructive cutover while
// its own execution mode, evidence trace, and activation contract were still literally the
// unfilled instruction text.
function proseDirectiveLines(text: string): string[] {
  return text.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("|") || trimmed.startsWith("#") || trimmed.startsWith("-")) return false;
    const firstWord = trimmed.match(/^[A-Za-z][A-Za-z-]*/)?.[0]?.toLowerCase();
    return !!(firstWord && TEMPLATE_DIRECTIVE_VERBS.has(firstWord));
  });
}

function tablePlaceholderCells(text: string): string[] {
  const cells = text
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|"))
    .flatMap((line) => line.split("|").slice(1, -1))
    .map((cell) => cell.trim().replaceAll("`", ""))
    .filter((cell) => cell.length > 0 && !/^:?-{3,}:?$/.test(cell));

  // Repetition signals still-templated content only when the *whole cell* repeats verbatim
  // (e.g. every row left as "TBD"). Keying on the first word alone false-positives on a
  // legitimately filled table where many distinct rows share a label prefix by convention
  // (e.g. "Evidence-1: ...", "Evidence-2: ..." in a large Evidence Ledger) -- their content
  // differs past the shared prefix, so they are not placeholders.
  const cellTextCounts = new Map<string, number>();
  for (const cell of cells) {
    cellTextCounts.set(cell, (cellTextCounts.get(cell) ?? 0) + 1);
  }
  const repeatedThreshold = Math.max(8, Math.ceil(cells.length * 0.15));

  return cells.filter((cell) => {
    // "Yes"/"No"/"N/A"/"Pass"/"done"/etc. are legitimate prescribed terminal answers in the
    // template's own matrices (Effort-Before-Value, policy, Prototype And Design Proof, Graph
    // Run status) -- rejecting them as generic filler words would make a genuinely completed
    // artifact unable to pass without replacing truthful answers with artificial prose. Only
    // the literal word "placeholder" itself has no legitimate answer use.
    if (/^placeholder$/i.test(cell)) return true;
    const firstWord = cell.match(/^[A-Za-z][A-Za-z-]*/)?.[0]?.toLowerCase();
    if (firstWord && TEMPLATE_DIRECTIVE_VERBS.has(firstWord)) return true;
    return (cellTextCounts.get(cell) ?? 0) >= repeatedThreshold;
  });
}

function requirePhrases(target: Issue[], relativePath: string, text: string, code: string, phrases: string[], message: string): void {
  const missing = phrases.filter((phrase) => !text.toLowerCase().includes(phrase.toLowerCase()));
  if (missing.length === 0) return;
  target.push(issue("error", code, `${message} Missing: ${missing.join(", ")}.`, relativePath));
}

function stripFencedBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, "");
}

function codeFor(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
