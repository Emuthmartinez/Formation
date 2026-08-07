import assert from "node:assert/strict";
import test from "node:test";
import { createGeneratedArtifact } from "../domain/artifacts.mjs";
import { normalizeArtifactPatch } from "../validation.mjs";
import { createSeedDatabase } from "../seed.mjs";

/**
 * Regression fixtures for every deliverable type Formation can produce without a provider
 * (docs/platform/remaining-gaps.md, "Production AI evaluation and safety").
 *
 * The built-in deterministic draft is what an instance with no drafting service configured
 * produces, and it is the first document many founders will ever read here. It is assembled by
 * interpolating company and workstream fields into prose, which makes it quietly fragile in a
 * specific way: a field that is empty does not fail, it produces a sentence with a hole in it, or
 * a section with nothing in it at all.
 *
 * Every type is therefore built three ways — from a complete company, from one where every
 * optional field is empty, and from a workstream with no facts, assumptions, or questions — and
 * held to the same bar each time:
 *
 * - no section is empty, because an empty section renders as a blank block a founder cannot act on;
 * - no sentence has a hole in it (a doubled full stop, a dangling "is .", a stray "undefined");
 * - the result would survive the platform's own deliverable validation, since a document Formation
 *   creates but would refuse to accept as an edit is a document it should not have created.
 */

const TYPES = ["business-model", "go-to-market-brief", "launch-plan", "customer-brief", "market-brief"];

const seedWorkspace = () => createSeedDatabase().workspaces[0];

/** Every optional company field blanked. A founder may clear any of these through the API. */
function emptiedCompany(workspace) {
  const next = structuredClone(workspace);
  for (const field of Object.keys(next.company)) {
    next.company[field] = Array.isArray(next.company[field]) ? [] : "";
  }
  return next;
}

/** A workstream that has recorded nothing yet — the state every new company starts in. */
function emptiedWorkstream(workstream) {
  return { ...structuredClone(workstream), facts: [], assumptions: [], questions: [] };
}

function build(workspace, workstream, type, instruction = "") {
  return createGeneratedArtifact({ workspace, workstream, artifactType: type, instruction });
}

/**
 * Sentences with a hole where a value should have been.
 *
 * The "is ." rule requires whitespace *between* the verb and the stop, which is what a dropped
 * interpolation leaves behind. Ordinary prose — "distribution cannot be chosen before it is." —
 * has no space there, and flagging it would push the fix toward worse English rather than toward
 * a filled-in value.
 */
const HOLE_PATTERNS = [
  { pattern: /undefined|\[object Object\]|NaN/, label: "a value that was never resolved" },
  { pattern: /(^|\s)\.\s/, label: "a sentence beginning with a full stop" },
  { pattern: /\s\.(\s|$)/, label: "a dangling full stop" },
  { pattern: /:\s*$/, label: "a sentence that stops at a colon" },
  { pattern: /\b(?:is|was)\s+\./, label: "a sentence whose subject was empty" },
];

test("the hole detector catches the shapes an empty interpolation actually leaves", () => {
  const broken = [
    ". The current working price is .",
    "The model is . Nothing else.",
    "Positioning: undefined",
    "The customer segment is:",
  ];
  for (const text of broken) {
    assert.ok(HOLE_PATTERNS.some(({ pattern }) => pattern.test(text)), `the detector missed: ${text}`);
  }
  const fine = [
    "Distribution cannot be chosen before it is.",
    "Families play weekly. That is what the research says.",
    "Name the channel, message, conversion event, owner, and weekly evidence review.",
  ];
  for (const text of fine) {
    assert.ok(!HOLE_PATTERNS.some(({ pattern }) => pattern.test(text)), `the detector flagged ordinary prose: ${text}`);
  }
});

function assertReadable(artifact, context) {
  assert.ok(artifact.sections.length > 0, `${context}: a deliverable with no sections is not a deliverable`);
  for (const section of artifact.sections) {
    assert.ok(section.title.trim().length > 0, `${context}: a section with no title`);
    assert.ok(section.body.trim().length > 0, `${context}: section “${section.title}” has an empty body`);
    for (const { pattern, label } of HOLE_PATTERNS) {
      assert.ok(!pattern.test(section.body), `${context}: section “${section.title}” contains ${label}: ${JSON.stringify(section.body.slice(0, 160))}`);
    }
  }
  assert.ok(artifact.title.trim().length > 0, `${context}: a deliverable with no title`);
  assert.ok(artifact.summary.trim().length > 0, `${context}: a deliverable with no summary`);
  assert.ok(artifact.confidence >= 0 && artifact.confidence <= 100, `${context}: confidence out of range`);
}

/** Would Formation accept this document if a founder submitted it as an edit? */
function assertWouldBeAccepted(artifact, context) {
  assert.doesNotThrow(
    () => normalizeArtifactPatch({ title: artifact.title, summary: artifact.summary, sections: artifact.sections.map(({ title, body }) => ({ title, body })) }),
    `${context}: Formation created a deliverable it would refuse as an edit`,
  );
}

for (const type of TYPES) {
  test(`the built-in ${type} draft is readable from a complete company`, () => {
    const workspace = seedWorkspace();
    for (const workstream of workspace.workstreams) {
      const artifact = build(workspace, workstream, type);
      assertReadable(artifact, `${type} / ${workstream.id}`);
      assertWouldBeAccepted(artifact, `${type} / ${workstream.id}`);
    }
  });

  test(`the built-in ${type} draft is readable when every optional company field is empty`, () => {
    const workspace = emptiedCompany(seedWorkspace());
    for (const workstream of workspace.workstreams) {
      const artifact = build(workspace, workstream, type);
      assertReadable(artifact, `${type} / ${workstream.id} / empty company`);
      assertWouldBeAccepted(artifact, `${type} / ${workstream.id} / empty company`);
    }
  });

  test(`the built-in ${type} draft is readable for a workstream that has recorded nothing`, () => {
    const workspace = seedWorkspace();
    for (const workstream of workspace.workstreams) {
      const artifact = build(workspace, emptiedWorkstream(workstream), type);
      assertReadable(artifact, `${type} / ${workstream.id} / empty workstream`);
      assertWouldBeAccepted(artifact, `${type} / ${workstream.id} / empty workstream`);
    }
  });
}

test("a company object missing a field entirely does not crash the drafting worker", () => {
  // Not reachable through the API, which always writes every field — but a store restored from an
  // older shape, or a record a future migration touches, must not take the worker down with it.
  const workspace = seedWorkspace();
  delete workspace.company.northStarMetric;
  delete workspace.company.pricing;
  for (const type of TYPES) {
    assert.doesNotThrow(() => build(workspace, workspace.workstreams[0], type), `${type} threw on a company missing a field`);
  }
});

test("founder direction reaches the draft, and its absence leaves no empty note behind", () => {
  const workspace = seedWorkspace();
  const withDirection = build(workspace, workspace.workstreams[0], "business-model", "Focus on the annual plan.");
  assert.ok(
    withDirection.sections.some((section) => section.body.includes("Focus on the annual plan.")),
    "founder direction must appear in the document it directed",
  );

  const without = build(workspace, workspace.workstreams[0], "business-model", "   ");
  for (const section of without.sections) {
    assert.ok(!/Founder direction:\s*$/.test(section.body), "blank direction must not leave a labelled empty line");
  }
});

test("every deliverable type produces a distinct, titled document rather than a generic one", () => {
  const workspace = seedWorkspace();
  const titles = new Set(TYPES.map((type) => build(workspace, workspace.workstreams[0], type).title));
  assert.ok(titles.size >= 4, `expected the named types to be distinguishable by title, got ${[...titles].join(", ")}`);
  for (const title of titles) assert.ok(!/undefined|null/.test(title), `a type produced a broken title: ${title}`);
});
