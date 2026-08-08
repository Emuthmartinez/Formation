#!/usr/bin/env node
/**
 * Deterministic contract gate for the generalized onboarding system graph.
 *
 * This validator does not grade conversion taste. It proves that the canonical artifact carries the graph, evidence joins, first-value and activation distinctions,
 * screen and control contracts, provider and policy research, typed analytics, compliant review timing, visual design requirements, and replacement-mode deletion plan.
 */
import { asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit, type Issue } from "../../../tooling/lib/launch-state.js";

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
const skip = laneStatus === "not_needed" || laneStatus === "deferred";

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

if (artifact) {
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

  if (laneStatus === "done") {
    const liveText = stripFencedBlocks(text);
    const placeholders = [/\bnot_started\b/i, /\bTODO\b/i, /\bTBD\b/i, /\bplaceholder\b/i, /\bRecord\b/i];
    if (placeholders.some((pattern) => pattern.test(liveText))) {
      issues.push(
        issue(
          "error",
          "onboarding_graph.placeholder_complete",
          `${relativePath} cannot support lanes.onboarding.status=done while template placeholders or not_started graph nodes remain.`,
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
  }
}

reportAndExit("Onboarding system graph check", issues);

function hasHeading(text: string, heading: string): boolean {
  return text.split(/\r?\n/).some((line) => line.trim() === `## ${heading}`);
}

function graphRunNodeDone(text: string, node: string): boolean {
  return text.split(/\r?\n/).some((line) => {
    const cells = line.split("|").map((cell) => cell.trim());
    return cells.includes(`\`${node}\``) && cells.includes("done");
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
