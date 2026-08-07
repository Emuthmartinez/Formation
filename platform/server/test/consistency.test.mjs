import assert from "node:assert/strict";
import test from "node:test";
import { detectInconsistencies } from "../domain/consistency.mjs";
import { createSeedDatabase } from "../seed.mjs";

/**
 * Structural self-contradiction.
 *
 * Two properties matter more than the individual rules. First, that the seeded demo company — a
 * deliberately well-formed record — produces no *serious* findings, because a check that fires on
 * a correct record is a check people learn to scroll past. Second, that each rule fires on the
 * exact shape it names and not on its near neighbours, which is what the paired cases below hold.
 */

const NOW = "2026-08-07T00:00:00.000Z";

function workspaceOf(database) {
  return database.workspaces[0];
}

/** A minimal, internally consistent record to mutate one field of at a time. */
function baseline() {
  return {
    workspace: { id: "wrk", stage: "validation", launchTarget: "2026-12-01", workstreams: [] },
    claims: [],
    decisions: [],
    tasks: [],
    artifacts: [],
  };
}

const find = (findings, code) => findings.filter((entry) => entry.code === code);

test("the seeded company raises nothing serious about itself", () => {
  const database = createSeedDatabase();
  const workspace = workspaceOf(database);
  const findings = detectInconsistencies(
    {
      workspace,
      claims: database.claims.filter((entry) => entry.workspaceId === workspace.id),
      decisions: database.decisions.filter((entry) => entry.workspaceId === workspace.id),
      tasks: database.tasks.filter((entry) => entry.workspaceId === workspace.id),
      artifacts: database.artifacts.filter((entry) => entry.workspaceId === workspace.id),
    },
    NOW,
  );
  const serious = findings.filter((entry) => entry.severity === "high");
  assert.deepEqual(serious, [], `the demo company should not accuse itself: ${serious.map((entry) => entry.title).join("; ")}`);
});

test("a fact with nothing behind it is not a fact", () => {
  const record = baseline();
  record.claims = [
    { id: "clm_bare", kind: "fact", status: "active", confidence: 90, evidence: [], statement: "Families record weekly.", workstreamId: "customer" },
    { id: "clm_backed", kind: "fact", status: "active", confidence: 90, evidence: ["12 of 14 interviews"], statement: "Families record weekly.", workstreamId: "customer" },
    { id: "clm_assumed", kind: "assumption", status: "active", confidence: 40, evidence: [], statement: "They will pay.", workstreamId: "customer" },
    { id: "clm_retired", kind: "fact", status: "superseded", confidence: 90, evidence: [], statement: "An old fact.", workstreamId: "customer" },
  ];
  const found = find(detectInconsistencies(record, NOW), "fact-without-evidence");
  assert.deepEqual(found.map((entry) => entry.claimIds[0]), ["clm_bare"], "only the unsupported, active fact should be named");
  assert.equal(found[0].severity, "high");
});

test("confidence that high is itself a claim about the evidence", () => {
  const record = baseline();
  record.claims = [
    { id: "clm_sure", kind: "recommendation", status: "active", confidence: 88, evidence: [], statement: "Ship the annual plan first.", workstreamId: "business-model" },
    { id: "clm_modest", kind: "recommendation", status: "active", confidence: 55, evidence: [], statement: "Consider a monthly plan.", workstreamId: "business-model" },
    { id: "clm_question", kind: "question", status: "active", confidence: 95, evidence: [], statement: "Who pays?", workstreamId: "business-model" },
  ];
  const found = find(detectInconsistencies(record, NOW), "confidence-without-evidence");
  assert.deepEqual(found.map((entry) => entry.claimIds[0]), ["clm_sure"], "a modest claim and an open question are not asserting anything");
});

test("a deliverable resting on retired evidence is resting on nothing", () => {
  const record = baseline();
  record.claims = [
    { id: "clm_live", kind: "fact", status: "active", confidence: 80, evidence: ["a source"], statement: "Live.", workstreamId: "market" },
    { id: "clm_dead", kind: "fact", status: "rejected", confidence: 80, evidence: ["a source"], statement: "Rejected.", workstreamId: "market" },
  ];
  record.artifacts = [
    { id: "art_ok", title: "Sound brief", status: "draft", sourceClaimIds: ["clm_live"], workstreamId: "market" },
    { id: "art_bad", title: "Shaky brief", status: "approved", sourceClaimIds: ["clm_live", "clm_dead"], workstreamId: "market" },
  ];
  const found = find(detectInconsistencies(record, NOW), "deliverable-on-retired-evidence");
  assert.equal(found.length, 1);
  assert.equal(found[0].artifactId, "art_bad");
  assert.deepEqual(found[0].claimIds, ["clm_dead"], "the finding must name which evidence went, not all of it");
  assert.equal(found[0].severity, "high", "an approved deliverable on retired evidence is the serious version");
});

test("a settled deliverable whose evidence is all assumption says two different things", () => {
  const record = baseline();
  record.claims = [
    { id: "clm_a", kind: "assumption", status: "active", confidence: 50, evidence: [], statement: "A.", workstreamId: "product" },
    { id: "clm_q", kind: "question", status: "active", confidence: 0, evidence: [], statement: "Q?", workstreamId: "product" },
    { id: "clm_f", kind: "fact", status: "active", confidence: 90, evidence: ["a source"], statement: "F.", workstreamId: "product" },
  ];
  record.artifacts = [
    { id: "art_assumed", title: "Assumed brief", status: "approved", sourceClaimIds: ["clm_a", "clm_q"], workstreamId: "product" },
    { id: "art_grounded", title: "Grounded brief", status: "approved", sourceClaimIds: ["clm_a", "clm_f"], workstreamId: "product" },
    { id: "art_draft", title: "Draft brief", status: "draft", sourceClaimIds: ["clm_a"], workstreamId: "product" },
    { id: "art_unsourced", title: "Unsourced brief", status: "approved", sourceClaimIds: [], workstreamId: "product" },
  ];
  const found = find(detectInconsistencies(record, NOW), "settled-on-assumptions");
  assert.deepEqual(
    found.map((entry) => entry.artifactId),
    ["art_assumed"],
    "a draft may rest on assumptions, a deliverable with one settled source is grounded, and a deliverable with no sources is a different question",
  );
});

test("a decision cannot be reviewed before it was made", () => {
  const record = baseline();
  record.decisions = [
    { id: "dec_backwards", title: "Backwards", status: "decided", decidedAt: "2026-08-01", reviewAt: "2026-07-01", workstreamId: "strategy" },
    { id: "dec_forwards", title: "Forwards", status: "decided", decidedAt: "2026-08-01", reviewAt: "2026-11-01", workstreamId: "strategy" },
    { id: "dec_open", title: "Open", status: "proposed", decidedAt: null, reviewAt: "2026-09-01", workstreamId: "strategy" },
  ];
  const found = find(detectInconsistencies(record, NOW), "reviewed-before-decided");
  assert.deepEqual(found.map((entry) => entry.decisionId), ["dec_backwards"]);
});

test("a decision with no review date is a choice, and is named as the mildest kind of finding", () => {
  const record = baseline();
  record.decisions = [{ id: "dec_final", title: "Final", status: "decided", decidedAt: "2026-08-01", reviewAt: null, workstreamId: "strategy" }];
  const found = find(detectInconsistencies(record, NOW), "decided-without-review");
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, "low", "this is a gap worth naming, not an error worth shouting about");
});

test("work due after the launch it precedes, and a launch date that quietly went by", () => {
  const record = baseline();
  record.tasks = [
    { id: "tsk_late", status: "next", dueAt: "2027-01-15", title: "Late", workstreamId: "launch" },
    { id: "tsk_fine", status: "next", dueAt: "2026-11-01", title: "Fine", workstreamId: "launch" },
    { id: "tsk_done", status: "done", dueAt: "2027-01-15", title: "Done late but done", workstreamId: "launch" },
    { id: "tsk_undated", status: "next", dueAt: null, title: "Undated", workstreamId: "launch" },
  ];
  const late = find(detectInconsistencies(record, NOW), "work-due-after-launch");
  assert.equal(late.length, 1);
  assert.deepEqual(late[0].taskIds, ["tsk_late"], "finished work and undated work are not late");

  const passed = baseline();
  passed.workspace.launchTarget = "2026-01-01";
  assert.equal(find(detectInconsistencies(passed, NOW), "launch-target-passed").length, 1);

  const launched = baseline();
  launched.workspace.launchTarget = "2026-01-01";
  launched.workspace.stage = "growth";
  assert.equal(find(detectInconsistencies(launched, NOW), "launch-target-passed").length, 0, "a company that launched is not late for its own launch");

  const undated = baseline();
  undated.workspace.launchTarget = null;
  assert.equal(detectInconsistencies(undated, NOW).length, 0, "no target means nothing to be late for");
});

test("findings are ordered by how much they matter and bounded in number", () => {
  const record = baseline();
  record.decisions = Array.from({ length: 80 }, (_, index) => ({
    id: `dec_${index}`,
    title: `Decision ${index}`,
    status: "decided",
    decidedAt: "2026-08-01",
    reviewAt: null,
    workstreamId: "strategy",
  }));
  record.claims = [{ id: "clm_bare", kind: "fact", status: "active", confidence: 90, evidence: [], statement: "Bare.", workstreamId: "customer" }];

  const findings = detectInconsistencies(record, NOW);
  assert.ok(findings.length <= 50, `expected the list to be bounded, got ${findings.length}`);
  assert.equal(findings[0].severity, "high", "the serious finding must not be pushed off the end by eighty mild ones");
});

test("nothing here changes a record", () => {
  const record = baseline();
  record.claims = [{ id: "clm_bare", kind: "fact", status: "active", confidence: 90, evidence: [], statement: "Bare.", workstreamId: "customer" }];
  const before = JSON.stringify(record);
  detectInconsistencies(record, NOW);
  assert.equal(JSON.stringify(record), before, "a contradiction is the founder's to resolve, not this module's to repair");
});
