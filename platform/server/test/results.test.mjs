import assert from "node:assert/strict";
import test from "node:test";
import { buildResultTotals, recordResultActivity, syncEngineResults } from "../domain/results.mjs";
import { createSeedDatabase } from "../seed.mjs";

/**
 * Domain tests for the verified-result import (execution adapter slice 3). These feed the sync
 * exactly what the engine boundary CLI emits — a typed ready report — so every mapping rule is
 * provable without spawning an engine: the engine's own fixture suite proves what enters
 * `results[]` (verified work only), and this suite proves what Formation does with it.
 */

const NOW = "2026-08-06T09:00:00.000Z";
const LATER = "2026-08-06T10:00:00.000Z";

function makeDatabase() {
  const database = createSeedDatabase();
  const workspace = database.workspaces.find((entry) => entry.id === "wrk_storywell");
  assert.ok(workspace, "the seed workspace must exist");
  return { database, workspace };
}

function readyReport(overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    generatedAt: NOW,
    workspaceReady: true,
    planId: "plan.test",
    catalogVersion: "catalog.test.v1",
    runId: "run.test.1",
    hasDurableRun: true,
    autonomyUnset: false,
    workflows: [],
    approvals: [],
    results: [],
    artifacts: [],
    ...overrides,
  };
}

function verifiedResult(overrides = {}) {
  return {
    workflowId: "workflow.eng-change",
    workflowTitle: "Update the onboarding copy",
    attemptId: "run.eng-change.attempt.1",
    attemptNumber: 1,
    finishedAt: NOW,
    verification: "deterministic",
    evidence: ["gate:check:copy=passed", "session log reference 41"],
    artifacts: [{ artifactId: "artifact.eng-change", fingerprint: "fp-v1" }],
    declaredTokenBudget: 8_000,
    declaredCostEstimate: { amount: 25, currency: "USD" },
    ...overrides,
  };
}

function engineClaims(database, workspaceId) {
  return database.claims.filter((entry) => entry.workspaceId === workspaceId && entry.source?.kind === "engine-result");
}

function engineArtifacts(database, workspaceId) {
  return database.artifacts.filter((entry) => entry.workspaceId === workspaceId && entry.source?.kind === "engine-artifact");
}

function blockerTasks(database, workspaceId) {
  return database.tasks.filter((entry) => entry.workspaceId === workspaceId && entry.source?.kind === "engine-blocker");
}

test("results import refuses an unready report instead of importing from silence", () => {
  const { database, workspace } = makeDatabase();
  assert.throws(() => syncEngineResults(database, workspace, { workspaceReady: false, reason: "not set up" }, NOW), /ready engine report/);
  assert.throws(() => syncEngineResults(database, workspace, undefined, NOW), /ready engine report/);
  assert.equal(engineClaims(database, workspace.id).length, 0);
});

test("a ready report with no verified results imports nothing — unverified work contributes nothing, not provisionally", () => {
  const { database, workspace } = makeDatabase();
  const report = readyReport({
    // A step that finished but is still being verified, and one still running: the engine
    // exports no result for either, and its unaccepted binding must not become a deliverable.
    workflows: [
      { workflowId: "workflow.research-scan", title: "Research what people need", status: "held", founderReason: "This is being double-checked before it's called done." },
      { workflowId: "workflow.eng-change", title: "Update the onboarding copy", status: "in-progress" },
    ],
    artifacts: [{ artifactId: "artifact.research-scan", workflowId: "workflow.research-scan", accepted: false, fingerprint: "fp-unverified" }],
  });
  const changes = syncEngineResults(database, workspace, report, NOW);
  assert.equal(changes.claimsCreated.length, 0);
  assert.equal(changes.artifactsCreated.length, 0);
  assert.equal(changes.tasksOpened.length, 0);
  assert.equal(engineClaims(database, workspace.id).length, 0);
  assert.equal(engineArtifacts(database, workspace.id).length, 0);
});

test("a verified result maps to a recommendation claim, a draft deliverable with an immutable version, and declared totals", () => {
  const { database, workspace } = makeDatabase();
  const versionsBefore = database.artifactVersions.length;
  const report = readyReport({ results: [verifiedResult()], artifacts: [{ artifactId: "artifact.eng-change", workflowId: "workflow.eng-change", accepted: true, fingerprint: "fp-v1" }] });
  const changes = syncEngineResults(database, workspace, report, NOW);
  recordResultActivity(database, workspace.id, changes, NOW);

  const claims = engineClaims(database, workspace.id);
  assert.equal(claims.length, 1);
  const claim = claims[0];
  assert.equal(claim.kind, "recommendation", "an engine result must never land as an accepted fact");
  assert.equal(claim.status, "active");
  assert.equal(claim.confidence, 85);
  assert.deepEqual(claim.evidence, ["gate:check:copy=passed", "session log reference 41"]);
  assert.equal(claim.workstreamId, "launch");
  assert.match(claim.statement, /Review the result before treating it as fact/);
  assert.deepEqual(claim.source, {
    kind: "engine-result",
    workflowId: "workflow.eng-change",
    workflowTitle: "Update the onboarding copy",
    attemptId: "run.eng-change.attempt.1",
    runId: "run.test.1",
    planId: "plan.test",
    verification: "deterministic",
    declaredTokenBudget: 8_000,
    declaredCostEstimate: { amount: 25, currency: "USD" },
  });

  const artifacts = engineArtifacts(database, workspace.id);
  assert.equal(artifacts.length, 1);
  const artifact = artifacts[0];
  assert.equal(artifact.status, "draft", "imported deliverables enter as editable drafts");
  assert.equal(artifact.version, 1);
  assert.equal(artifact.stale, false);
  assert.equal(artifact.title, "Update the onboarding copy");
  assert.deepEqual(artifact.sourceClaimIds, [claim.id]);
  assert.equal(artifact.source.engineArtifactId, "artifact.eng-change");
  assert.equal(artifact.source.fingerprint, "fp-v1");

  const versions = database.artifactVersions.slice(versionsBefore);
  assert.equal(versions.length, 1);
  assert.equal(versions[0].artifactId, artifact.id);
  assert.equal(versions[0].version, 1);
  assert.equal(versions[0].createdBy, "Launch engine");

  assert.deepEqual(changes.totals, { verifiedResults: 1, declaredTokenBudget: 8_000, declaredCostEstimates: [{ currency: "USD", amount: 25 }] });
  assert.ok(database.activity.some((entry) => entry.type === "result-imported" && entry.workspaceId === workspace.id));
  assert.ok(database.activity.some((entry) => entry.type === "deliverable-imported" && entry.workspaceId === workspace.id));
});

test("re-importing the same verified result is idempotent — no duplicate claims, deliverables, or versions", () => {
  const { database, workspace } = makeDatabase();
  const report = readyReport({ results: [verifiedResult()], artifacts: [{ artifactId: "artifact.eng-change", workflowId: "workflow.eng-change", accepted: true, fingerprint: "fp-v1" }] });
  syncEngineResults(database, workspace, report, NOW);
  const claimCount = database.claims.length;
  const artifactCount = database.artifacts.length;
  const versionCount = database.artifactVersions.length;

  const again = syncEngineResults(database, workspace, structuredClone(report), LATER);
  assert.equal(again.claimsCreated.length, 0);
  assert.equal(again.artifactsCreated.length, 0);
  assert.equal(again.artifactsUpdated.length, 0);
  assert.equal(database.claims.length, claimCount);
  assert.equal(database.artifacts.length, artifactCount);
  assert.equal(database.artifactVersions.length, versionCount);
});

test("a newer verified attempt supersedes the old claim and appends a version without touching founder-authored content", () => {
  const { database, workspace } = makeDatabase();
  syncEngineResults(database, workspace, readyReport({ results: [verifiedResult()], artifacts: [{ artifactId: "artifact.eng-change", workflowId: "workflow.eng-change", accepted: true, fingerprint: "fp-v1" }] }), NOW);

  // The founder makes the draft their own before the engine re-runs the step.
  const artifact = engineArtifacts(database, workspace.id)[0];
  artifact.title = "Onboarding copy (founder edit)";
  artifact.sections = [{ id: "sec_founder", title: "My notes", body: "Rewrote the second screen myself." }];
  artifact.status = "reviewed";

  const secondAttempt = readyReport({
    results: [verifiedResult({ attemptId: "run.eng-change.attempt.2", attemptNumber: 2, artifacts: [{ artifactId: "artifact.eng-change", fingerprint: "fp-v2" }] })],
    artifacts: [{ artifactId: "artifact.eng-change", workflowId: "workflow.eng-change", accepted: true, fingerprint: "fp-v2" }],
  });
  const changes = syncEngineResults(database, workspace, secondAttempt, LATER);

  assert.equal(changes.claimsCreated.length, 1);
  assert.equal(changes.claimsSuperseded.length, 1);
  const claims = engineClaims(database, workspace.id);
  assert.equal(claims.filter((entry) => entry.status === "active").length, 1);
  assert.equal(claims.find((entry) => entry.status === "active").source.attemptId, "run.eng-change.attempt.2");
  assert.equal(claims.find((entry) => entry.status === "superseded").source.attemptId, "run.eng-change.attempt.1");

  assert.equal(changes.artifactsUpdated.length, 1);
  const updated = engineArtifacts(database, workspace.id)[0];
  assert.equal(updated.version, 2, "an engine refresh appends a new immutable version");
  assert.equal(updated.source.fingerprint, "fp-v2");
  assert.equal(updated.title, "Onboarding copy (founder edit)", "founder-authored content must never be overwritten");
  assert.equal(updated.status, "reviewed", "the founder's review status must survive an engine refresh");
  assert.deepEqual(updated.sections, [{ id: "sec_founder", title: "My notes", body: "Rewrote the second screen myself." }]);
  const versions = database.artifactVersions.filter((entry) => entry.artifactId === updated.id);
  assert.deepEqual(versions.map((entry) => entry.version), [1, 2]);
});

test("staleness mirrors the engine's conclusions exactly — the identified deliverable and nothing else, in both directions", () => {
  const { database, workspace } = makeDatabase();
  const firstImport = readyReport({
    results: [
      verifiedResult(),
      verifiedResult({ workflowId: "workflow.eng-followup", workflowTitle: "Tidy the follow-up checklist", attemptId: "run.eng-followup.attempt.1", artifacts: [{ artifactId: "artifact.eng-followup", fingerprint: "fp-follow-v1" }], declaredCostEstimate: undefined }),
    ],
    artifacts: [
      { artifactId: "artifact.eng-change", workflowId: "workflow.eng-change", accepted: true, fingerprint: "fp-v1" },
      { artifactId: "artifact.eng-followup", workflowId: "workflow.eng-followup", accepted: true, fingerprint: "fp-follow-v1" },
    ],
  });
  syncEngineResults(database, workspace, firstImport, NOW);
  assert.equal(engineArtifacts(database, workspace.id).length, 2);

  // The engine invalidated the follow-up's inputs: its binding is no longer accepted. A third
  // binding Formation never imported also reports unaccepted — it must not invent a record.
  const invalidated = readyReport({
    artifacts: [
      { artifactId: "artifact.eng-change", workflowId: "workflow.eng-change", accepted: true, fingerprint: "fp-v1" },
      { artifactId: "artifact.eng-followup", workflowId: "workflow.eng-followup", accepted: false, fingerprint: "fp-follow-v1" },
      { artifactId: "artifact.never-imported", accepted: false },
    ],
  });
  const staleChanges = syncEngineResults(database, workspace, invalidated, LATER);
  assert.equal(staleChanges.markedStale.length, 1);
  const followup = engineArtifacts(database, workspace.id).find((entry) => entry.source.engineArtifactId === "artifact.eng-followup");
  const unchanged = engineArtifacts(database, workspace.id).find((entry) => entry.source.engineArtifactId === "artifact.eng-change");
  assert.equal(followup.stale, true);
  assert.ok(followup.staleReason.length > 0);
  assert.equal(unchanged.stale, false, "a deliverable the engine did not identify must never be marked stale");
  assert.equal(engineArtifacts(database, workspace.id).length, 2, "an unimported binding must not become a record");

  // Re-reporting the same conclusions changes nothing further.
  const repeat = syncEngineResults(database, workspace, structuredClone(invalidated), LATER);
  assert.equal(repeat.markedStale.length, 0);

  // Acceptance returns for the very fingerprint Formation imported: the mark clears.
  const restored = readyReport({
    artifacts: [
      { artifactId: "artifact.eng-change", workflowId: "workflow.eng-change", accepted: true, fingerprint: "fp-v1" },
      { artifactId: "artifact.eng-followup", workflowId: "workflow.eng-followup", accepted: true, fingerprint: "fp-follow-v1" },
    ],
  });
  const freshChanges = syncEngineResults(database, workspace, restored, LATER);
  assert.equal(freshChanges.markedFresh.length, 1);
  assert.equal(engineArtifacts(database, workspace.id).find((entry) => entry.source.engineArtifactId === "artifact.eng-followup").stale, false);
});

test("failed steps mirror as founder tasks that close when the engine recovers, and never duplicate", () => {
  const { database, workspace } = makeDatabase();
  const failing = readyReport({
    workflows: [{ workflowId: "workflow.eng-change", title: "Update the onboarding copy", status: "failed", founderReason: "The last attempt at this step didn't go through." }],
  });
  const changes = syncEngineResults(database, workspace, failing, NOW);
  assert.equal(changes.tasksOpened.length, 1);
  const tasks = blockerTasks(database, workspace.id);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].status, "next");
  assert.equal(tasks[0].priority, "high");
  assert.match(tasks[0].title, /Update the onboarding copy/);
  assert.equal(tasks[0].source.reason, "The last attempt at this step didn't go through.");

  const again = syncEngineResults(database, workspace, structuredClone(failing), LATER);
  assert.equal(again.tasksOpened.length, 0, "re-reporting the same failure must not duplicate the task");
  assert.equal(blockerTasks(database, workspace.id).length, 1);

  const recovered = readyReport({ workflows: [{ workflowId: "workflow.eng-change", title: "Update the onboarding copy", status: "ready" }] });
  const closing = syncEngineResults(database, workspace, recovered, LATER);
  assert.equal(closing.tasksClosed.length, 1);
  assert.equal(blockerTasks(database, workspace.id)[0].status, "done");

  // A later regression opens a fresh task rather than resurrecting the closed one.
  const failsAgain = syncEngineResults(database, workspace, structuredClone(failing), LATER);
  assert.equal(failsAgain.tasksOpened.length, 1);
  assert.equal(blockerTasks(database, workspace.id).length, 2);
});

test("imported trace and cost metadata carries ids and totals only — undeclared report fields never reach the store", () => {
  const { database, workspace } = makeDatabase();
  const sneaky = readyReport({
    results: [
      {
        ...verifiedResult(),
        // Fields outside the boundary contract, carrying secret-shaped values. A correct import
        // copies fields by name and drops all of these on the floor.
        env: { RESEND_API_KEY: "sk-live-canary-a" },
        credentials: "token canary-b",
        declaredCostEstimate: { amount: 25, currency: "USD", apiToken: "canary-c" },
      },
    ],
    artifacts: [{ artifactId: "artifact.eng-change", workflowId: "workflow.eng-change", accepted: true, fingerprint: "fp-v1", secretPath: "/Users/nobody/.secrets" }],
    dopplerServiceToken: "dp.st.canary-d",
  });
  const changes = syncEngineResults(database, workspace, sneaky, NOW);
  recordResultActivity(database, workspace.id, changes, NOW);

  const stored = JSON.stringify(database);
  for (const canary of ["canary-a", "canary-b", "canary-c", "canary-d", "RESEND_API_KEY", "dp.st.", "/Users/nobody"]) {
    assert.ok(!stored.includes(canary), `secret-shaped value leaked into the store: ${canary}`);
  }
  assert.deepEqual(changes.totals, { verifiedResults: 1, declaredTokenBudget: 8_000, declaredCostEstimates: [{ currency: "USD", amount: 25 }] });
});

test("result totals summarize declared budgets by currency without inventing actuals", () => {
  const totals = buildResultTotals(
    readyReport({
      results: [
        verifiedResult(),
        verifiedResult({ workflowId: "workflow.b", attemptId: "run.b.attempt.1", declaredTokenBudget: 20_000, declaredCostEstimate: { amount: 10, currency: "EUR" } }),
        verifiedResult({ workflowId: "workflow.c", attemptId: "run.c.attempt.1", declaredTokenBudget: 8_000, declaredCostEstimate: { amount: 5, currency: "USD" } }),
      ],
    }),
  );
  assert.deepEqual(totals, {
    verifiedResults: 3,
    declaredTokenBudget: 36_000,
    declaredCostEstimates: [
      { currency: "EUR", amount: 10 },
      { currency: "USD", amount: 30 },
    ],
  });
});
