import assert from "node:assert/strict";
import test from "node:test";
import { pairSections, summariseVersionChange, summariseVersionHistory } from "../domain/versions.mjs";

/**
 * Change summaries between deliverable versions.
 *
 * The summary is computed from the immutable versions rather than written when one is saved, so
 * the property worth holding is that it always agrees with them: no case here asserts a stored
 * note, and every case builds two real versions and asks what changed.
 *
 * The section pairing is where this is easy to get quietly wrong. An edited section must read as
 * edited, not as one section removed and another added, or every save of a long document produces
 * a summary that says everything changed.
 */

function version(number, overrides = {}) {
  return {
    version: number,
    title: "Positioning brief",
    status: "draft",
    confidence: 60,
    summary: "A summary.",
    sections: [
      { id: "sec_a", title: "Promise", body: "Families keep the stories they would otherwise lose." },
      { id: "sec_b", title: "Proof", body: "Twelve of fourteen interviews described the same regret." },
    ],
    sourceClaimIds: ["clm_1"],
    linkedDecisionIds: [],
    createdAt: "2026-08-07T00:00:00.000Z",
    createdBy: "Maya Chen",
    ...overrides,
  };
}

const detailFor = (summary, kind) => summary.changes.filter((entry) => entry.kind === kind).map((entry) => entry.detail);

test("the first version is described rather than compared", () => {
  const summary = summariseVersionChange(null, version(1));
  assert.equal(summary.previousVersion, null);
  assert.match(summary.headline, /Created with 2 sections/);
  assert.deepEqual(summary.changes, []);
});

test("the earliest version still retained does not claim to be the first one written", () => {
  // A store that has aged out early snapshots hands back version 4 with nothing before it. Calling
  // that "created" would say the three versions before it never happened.
  const summary = summariseVersionChange(null, version(4));
  assert.match(summary.headline, /earliest version still kept/);
  assert.ok(!/Created/.test(summary.headline));
});

test("an edited section reads as edited, not as one removed and another added", () => {
  const before = version(1);
  const after = version(2, {
    sections: [
      { id: "sec_a", title: "Promise", body: "Families keep the stories they would otherwise lose, in their own voices." },
      before.sections[1],
    ],
  });
  const summary = summariseVersionChange(before, after);
  assert.deepEqual(detailFor(summary, "section-added"), []);
  assert.deepEqual(detailFor(summary, "section-removed"), []);
  assert.equal(summary.changes.filter((entry) => entry.kind === "section-revised").length, 1);
  assert.match(summary.headline, /1 section revised/);
});

test("a replaced passage reads as a rewrite, and the word count says which way it went", () => {
  const before = version(1);
  const after = version(2, {
    sections: [{ id: "sec_a", title: "Promise", body: "A completely different argument about pricing." }, before.sections[1]],
  });
  const summary = summariseVersionChange(before, after);
  const rewritten = summary.changes.find((entry) => entry.kind === "section-rewritten");
  assert.ok(rewritten, `expected a rewrite, got ${JSON.stringify(summary.changes)}`);
  assert.match(rewritten.detail, /-\d+ words/, "a shorter replacement must say so");
  assert.match(summary.headline, /1 section rewritten/);
});

test("sections added and removed are both named", () => {
  const before = version(1);
  const after = version(2, {
    sections: [before.sections[0], { id: "sec_c", title: "Risks", body: "Consent from the person being recorded." }],
  });
  const summary = summariseVersionChange(before, after);
  assert.deepEqual(detailFor(summary, "section-added"), ["Risks"]);
  assert.deepEqual(detailFor(summary, "section-removed"), ["Proof"]);
  assert.match(summary.headline, /1 added, 1 removed/);
});

test("a retitled section keeps its identity", () => {
  const before = version(1);
  const after = version(2, {
    sections: [{ id: "sec_a", title: "The promise", body: before.sections[0].body }, before.sections[1]],
  });
  const summary = summariseVersionChange(before, after);
  assert.deepEqual(detailFor(summary, "section-added"), [], "a rename is not an addition");
  assert.deepEqual(detailFor(summary, "section-removed"), [], "a rename is not a removal");
  assert.equal(detailFor(summary, "section-retitled").length, 1);
});

test("sections with no ids fall back to title, then position", () => {
  const before = [
    { title: "Promise", body: "One." },
    { title: "Proof", body: "Two." },
  ];
  const byTitle = pairSections(before, [
    { title: "Proof", body: "Two, revised." },
    { title: "Promise", body: "One." },
  ]);
  assert.equal(byTitle.length, 2, "reordering two sections is two pairs, not four");
  assert.ok(byTitle.every((pair) => pair.before && pair.after && pair.before.title === pair.after.title), "titles must pair across a reorder");

  const byPosition = pairSections(before, [
    { title: "Opening", body: "One, lightly edited." },
    { title: "Evidence", body: "Two." },
  ]);
  assert.equal(byPosition.length, 2, "with no ids and no matching titles, position is the last resort");
  assert.equal(byPosition[0].before.title, "Promise");
});

test("status, confidence, evidence, and links are each reported", () => {
  const summary = summariseVersionChange(
    version(1),
    version(2, { status: "approved", confidence: 82, sourceClaimIds: ["clm_1", "clm_2"], linkedDecisionIds: ["dec_1"] }),
  );
  assert.deepEqual(detailFor(summary, "status"), ["draft → approved"]);
  assert.match(detailFor(summary, "confidence")[0], /rose from 60% to 82%/);
  assert.deepEqual(detailFor(summary, "evidence"), ["1 added"]);
  assert.deepEqual(detailFor(summary, "decisions"), ["1 added"]);
});

test("a version that changed only its status says so rather than counting", () => {
  const summary = summariseVersionChange(version(1), version(2, { status: "reviewed" }));
  assert.equal(summary.headline, "Status draft → reviewed.");
});

test("a version identical to the one before it says nothing changed", () => {
  const summary = summariseVersionChange(version(1), version(2));
  assert.deepEqual(summary.changes, []);
  assert.match(summary.headline, /no change to the document/);
});

test("a history is ordered by version number, newest first, whatever order it arrives in", () => {
  const history = summariseVersionHistory([
    version(3, { status: "reviewed", confidence: 70 }),
    version(1),
    version(2, { status: "reviewed" }),
  ]);
  assert.deepEqual(history.map((entry) => entry.version), [3, 2, 1]);
  assert.equal(history[2].previousVersion, null, "the oldest version has nothing before it");
  assert.equal(history[1].previousVersion, 1);
  assert.match(history[0].headline, /Confidence rose/);
});

test("two versions saved in the same second are still ordered correctly", () => {
  const stamp = "2026-08-07T09:00:00.000Z";
  const history = summariseVersionHistory([
    version(2, { createdAt: stamp, status: "reviewed" }),
    version(1, { createdAt: stamp }),
  ]);
  assert.deepEqual(history.map((entry) => entry.version), [2, 1], "the version number is the only ordering that can be trusted");
});

test("an empty or single-version history does not throw", () => {
  assert.deepEqual(summariseVersionHistory([]), []);
  assert.deepEqual(summariseVersionHistory(undefined), []);
  assert.equal(summariseVersionHistory([version(1)]).length, 1);
  assert.equal(summariseVersionChange(version(1), null), null);
});
