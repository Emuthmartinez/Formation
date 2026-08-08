#!/usr/bin/env node
/**
 * check-onboarding-graph.ts
 *
 * Deterministic contract gate for the generalized onboarding system graph.
 *
 * This validator does not grade taste or conversion claims. It proves that the
 * canonical artifact carries the graph, evidence joins, first-value and
 * activation distinctions, screen/control contracts, provider and policy
 * research, typed analytics, compliant review timing, visual proof, and
 * replacement-mode deletion plan that agents must complete before claiming the
 * onboarding lane done.
 */

import {
  asString,
  getPath,
  issue,
  loadProjectState,
  parseCliArgs,
  readText,
  reportAndExit,
  type Issue,
} from "../../../tooling/lib/launch-state.js";

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
      "product/ONBOARDING.md is required as the canonical onboarding graph, evidence, journey, screen/control, analytics, and cutover contract.",
      "product/ONBOARDING.md",
    ),
  );
}

if (artifact) {
  const text = artifact.text ?? "";
  const path = artifact.relativePath;

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
        issue(
          "error",
          `onboarding_graph.section_${codeFor(section)}_missing`,
          `${path} must include a "## ${section}" section.`,
          path,
        ),
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
          `${path} must include graph node ${node}; the nested onboarding DAG runs ONB-00 through ONB-22.`,
          path,
        ),
      );
    }
  }

  requirePhrases(
    issues,
    path,
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
    "The evidence contract must cover authorized Onbo Hub research, review controls, 60fps MCP, provider capabilities, policy distinctions, and the seven-principle activation audit.",
  );

  requirePhrases(
    issues,
    path,
    text,
    "onboarding_graph.activation_contract",
    [
      "First value rendered",
      "First value engaged",
      "Activation",
      "Effort-Before-Value",
      "personalization proof",
      "populated normal product",
    ],
    "The artifact must distinguish first value, engagement, activation, effort, visible personalization proof, and entry into a populated product experience.",
  );

  requirePhrases(
    issues,
    path,
    text,
    "onboarding_graph.design_contract",
    [
      "ONB-SCR-001",
      "ONB-CTL-001",
      "Every screen has one dominant",
      "Actual high-fidelity",
      "interactive",
      "reduced motion",
    ],
    "The artifact must carry stable screen/control IDs, one dominant action, actual visual and interactive proof, and reduced-motion behavior.",
  );

  requirePhrases(
    issues,
    path,
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
    path,
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
    "Review eligibility may be earned early, but the request must be native, outside first-run onboarding, ungated by sentiment, measurable only through observable events, and remotely suppressible.",
  );

  for (const forbiddenEvent of ["review_prompt_shown", "review_submitted", "review_rating_value"]) {
    if (new RegExp(`\\b${escapeRegex(forbiddenEvent)}\\b`).test(text)) {
      issues.push(
        issue(
          "error",
          "onboarding_graph.review_unobservable_event",
          `${path} names ${forbiddenEvent}, which claims a platform outcome the app cannot reliably observe. Record eligibility, suppression, API attempt, and API return only.`,
          path,
        ),
      );
    }
  }

  if (/native (?:app )?review (?:prompt|request).{0,80}immediately after first value/i.test(text) || /immediately after first value.{0,80}(?:review|rating)/i.test(text)) {
    issues.push(
      issue(
        "error",
        "onboarding_graph.review_inside_first_run",
        `${path} still directs a review request immediately after first value. Earn eligibility there if appropriate, finish first-run onboarding, and request at a later natural success in normal product use.`,
        path,
      ),
    );
  }

  requirePhrases(
    issues,
    path,
    text,
    "onboarding_graph.replacement_contract",
    [
      "hard cutover",
      "durable user value",
      "one-time",
      "Deletion Manifest",
      "minimum supported client",
      "Do not keep the old runtime",
      "zero-legacy",
    ],
    "Replacement mode must preserve durable user value through an isolated one-time transformation while hard-cutting to one runtime and deleting all legacy architecture.",
  );

  requirePhrases(
    issues,
    path,
    text,
    "onboarding_graph.reliability_contract",
    [
      "Purchase pending",
      "Restore",
      "deep link",
      "identity",
      "Analytics failure does not block first value",
      "unsupported client",
      "observability",
    ],
    "The artifact must cover purchase, restore, handoff, identity, nonblocking analytics, unsupported-client, and observability behavior.",
  );

  if (laneStatus === "done") {
    const live = stripFencedBlocks(text);
    const placeholders = [
      /\bnot_started\b/i,
      /\bTODO\b/i,
      /\bTBD\b/i,
      /\bplaceholder\b/i,
      /\bRecord (?:the|exact|current|source|decision|path|stable|products?|requirements?|behavior|date|owner|authority|state|screen|event|proof|risk|method|count|result|values?|copy|input|recovery|route|implementation|provider|platform|context|configuration|sequence|condition|requirement|access|artifact|reason|metric|test|IDs?|target|sample|flow|app|storefront|journey|transition|properties|process|exclusions|class|work|tasks?|data|fields?|economics|disposition|confidence|impact|use|change|mapping|status|timing|values?)\b/i,
    ];
    const hit = placeholders.find((pattern) => pattern.test(live));
    if (hit) {
      issues.push(
        issue(
          "error",
          "onboarding_graph.placeholder_complete",
          `${path} cannot support lanes.onboarding.status=done while template placeholders or not_started graph nodes remain.`,
          path,
        ),
      );
    }

    for (let index = 0; index <= 22; index += 1) {
      const node = `ONB-${String(index).padStart(2, "0")}`;
      const row = new RegExp(`\\|\\s*\`${escapeRegex(node)}\`\\s*\\|\\s*done\\s*\\|`, "i");
      if (!row.test(text)) {
        issues.push(
          issue(
            "error",
            "onboarding_graph.node_not_done",
            `${path} claims the onboarding lane is done but graph node ${node} is not recorded as done in the Graph Run table.`,
            path,
          ),
        );
      }
    }
  }
}

reportAndExit("Onboarding system graph check", issues);

function hasHeading(text: string, heading: string): boolean {
  return new RegExp(`^##\\s+${escapeRegex(heading)}\\s*$`, "mi").test(text);
}

function requirePhrases(
  target: Issue[],
  relativePath: string,
  text: string,
  code: string,
  phrases: string[],
  message: string,
): void {
  const missing = phrases.filter((phrase) => !text.toLowerCase().includes(phrase.toLowerCase()));
  if (missing.length === 0) return;
  target.push(
    issue(
      "error",
      code,
      `${message} Missing: ${missing.join(", ")}.`,
      relativePath,
    ),
  );
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
