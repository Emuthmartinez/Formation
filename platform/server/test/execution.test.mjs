import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { EngineBridge, ExecutionWorker, computeContextFingerprint, founderRunView } from "../execution.mjs";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";
import { bootstrapEngineWorkspace, login, request, skillDir, startTestServer, tsxBin, waitForExecution } from "./_engine.mjs";

// ---------------------------------------------------------------------------
// Context fingerprinting.
// ---------------------------------------------------------------------------

test("context fingerprint is stable, scoped, and sensitive to company changes", () => {
  const workspace = createSeedDatabase().workspaces[0];
  const first = computeContextFingerprint(workspace);
  const second = computeContextFingerprint(structuredClone(workspace));
  assert.equal(first, second);

  const cosmetic = structuredClone(workspace);
  cosmetic.updatedAt = "2030-01-01T00:00:00.000Z";
  cosmetic.workstreams[0].summary = "changed summary";
  assert.equal(computeContextFingerprint(cosmetic), first);

  const changed = structuredClone(workspace);
  changed.company.pricing = "$99 per year";
  assert.notEqual(computeContextFingerprint(changed), first);

  const stageChanged = structuredClone(workspace);
  stageChanged.stage = "build";
  assert.notEqual(computeContextFingerprint(stageChanged), first);
});

test("founder run view keeps counts honest and speaks in business vocabulary", () => {
  const view = founderRunView({
    schemaVersion: "1.0.0",
    generatedAt: "2026-08-05T00:00:00.000Z",
    workspaceReady: true,
    hasDurableRun: true,
    autonomyUnset: false,
    workflows: [
      { workflowId: "workflow.a", title: "Step A", status: "finished" },
      { workflowId: "workflow.b", title: "Step B", status: "ready" },
      { workflowId: "workflow.c", title: "Step C", status: "needs-founder", founderReason: "This needs your yes before I go ahead." },
      { workflowId: "workflow.d", title: "Step D", status: "upcoming" },
      { workflowId: "workflow.e", title: "Step E", status: "failed", founderReason: "The last attempt at this step didn't go through." },
    ],
  });
  assert.equal(view.counts.total, 5);
  assert.equal(view.counts.finished, 1);
  assert.equal(view.counts.ready, 1);
  assert.equal(view.counts.waitingOnFounder, 1);
  assert.equal(view.counts.failed, 1);
  assert.equal(view.counts.upcoming, 1);
  assert.ok(view.headline.includes("1 of 5 steps finished"));
  assert.ok(view.headline.includes("waiting on you"));
  assert.equal(view.steps.length, 5);
  assert.equal(view.steps[2].reason, "This needs your yes before I go ahead.");
});

// ---------------------------------------------------------------------------
// Honest failure surfaces: not connected, engine missing.
// ---------------------------------------------------------------------------

test("submitting for a company with no engine binding is refused, not queued", async (t) => {
  const app = await startTestServer({ resolveEngineWorkspace: () => null });
  t.after(app.close);
  const cookie = await login(app.baseUrl);

  const response = await request(app.baseUrl, "/api/workspaces/wrk_storywell/executions", { cookie, method: "POST", body: {} });
  assert.equal(response.status, 409);
  const payload = await response.json();
  assert.ok(payload.error.includes("not connected"));

  const list = await request(app.baseUrl, "/api/workspaces/wrk_storywell/executions", { cookie });
  const listPayload = await list.json();
  assert.deepEqual(listPayload.executions, []);
  // The capability rides the page's actual read path: a founder learns the engine cannot yet do
  // hands-on steps itself BEFORE asking for work, with a plain-language reason.
  assert.equal(listPayload.selfServeExecution.available, false);
  assert.ok(listPayload.selfServeExecution.reason.length > 0);
});

test("an unreachable engine is reported as unreachable, never as no work ready", async (t) => {
  const missingEngine = new EngineBridge({ skillDir: path.join(os.tmpdir(), "formation-no-engine-here") });
  const app = await startTestServer({
    engine: missingEngine,
    resolveEngineWorkspace: () => path.join(os.tmpdir(), "formation-any-workspace"),
  });
  t.after(app.close);
  const cookie = await login(app.baseUrl);

  const response = await request(app.baseUrl, "/api/workspaces/wrk_storywell/executions", { cookie, method: "POST", body: {} });
  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.ok(payload.error.includes("Nothing was started"));
  assert.ok(payload.error.includes("not installed"));
  assert.ok(!payload.error.toLowerCase().includes("ready"));

  const database = await app.store.read();
  assert.equal(database.executions.length, 0);
});

test("worker inspect distinguishes unreachable from unready", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-inspect-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();

  const disconnected = new ExecutionWorker(store, { resolveEngineWorkspace: () => null });
  const disconnectedView = await disconnected.inspect({ id: "wrk_storywell", slug: "storywell" });
  assert.equal(disconnectedView.connected, false);
  assert.equal(disconnectedView.reachable, false);

  const unreachable = new ExecutionWorker(store, {
    engine: new EngineBridge({ skillDir: path.join(os.tmpdir(), "formation-no-engine-here") }),
    resolveEngineWorkspace: () => directory,
  });
  const unreachableView = await unreachable.inspect({ id: "wrk_storywell", slug: "storywell" });
  assert.equal(unreachableView.connected, true);
  assert.equal(unreachableView.reachable, false);
  assert.ok(unreachableView.reason.length > 0);

  // A real engine pointed at an empty directory answers "not set up" — reachable, not ready.
  const unready = new ExecutionWorker(store, {
    engine: new EngineBridge({ skillDir }),
    resolveEngineWorkspace: () => directory,
  });
  const unreadyView = await unready.inspect({ id: "wrk_storywell", slug: "storywell" });
  assert.equal(unreadyView.reachable, true);
  assert.equal(unreadyView.ready, false);
  assert.ok(unreadyView.reason.length > 0);

  // Every connected view says up front whether the engine can do hands-on steps itself. In
  // production it cannot (no real executor is wired yet); only tests injecting the fixture
  // executor report otherwise. The founder learns this before asking for work, not after.
  assert.equal(unreachableView.selfServeExecution.available, false);
  assert.ok(unreachableView.selfServeExecution.reason.length > 0);
  assert.equal(unreadyView.selfServeExecution.available, false);
  const fixtureBacked = new ExecutionWorker(store, {
    engine: new EngineBridge({ skillDir }),
    resolveEngineWorkspace: () => directory,
    executor: "fixture",
  });
  assert.equal(fixtureBacked.selfServeExecution().available, true);
});

test("launch matrix is returned only from a ready 1.1 engine", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-matrix-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();
  const workspace = { id: "wrk_storywell", slug: "storywell" };
  const older = new ExecutionWorker(store, {
    engine: { describe: async () => ({ reachable: true, report: { schemaVersion: "1.0.0", workspaceReady: true } }) },
    resolveEngineWorkspace: () => directory,
  });
  const unavailable = await older.launchMatrix(workspace);
  assert.equal(unavailable.available, false);
  assert.ok(unavailable.reason.includes("does not support"));

  const groups = [{ id: "market-product", title: "Market and product", order: 1 }];
  const workflows = [{ workflowId: "workflow.research.fixture", groupId: "market-product", title: "Research", status: "ready" }];
  const current = new ExecutionWorker(store, {
    engine: { describe: async () => ({ reachable: true, report: { schemaVersion: "1.1.0", workspaceReady: true, generatedAt: "2026-08-17T00:00:00.000Z", launchMatrix: { groups, workflows, systemSummary: { total: 1, counts: { ready: 1 } } } } }) },
    resolveEngineWorkspace: () => directory,
  });
  const available = await current.launchMatrix(workspace);
  assert.equal(available.available, true);
  assert.deepEqual(available.groups, groups);
  assert.deepEqual(available.workflows, workflows);
});

// ---------------------------------------------------------------------------
// The full boundary: authorized request -> stable workflow -> fingerprint ->
// durable engine run -> founder-readable state, idempotent across retries.
// ---------------------------------------------------------------------------

test("execution adapter creates and resumes one durable engine run per request and context", { timeout: 300_000 }, async (t) => {
  assert.ok(tsxBin, "the engine's tsx runtime must be installed for this suite");
  const engineRoot = await mkdtemp(path.join(os.tmpdir(), "formation-engine-root-"));
  bootstrapEngineWorkspace(engineRoot, "storywell");

  const app = await startTestServer({
    resolveEngineWorkspace: (workspace) => path.join(engineRoot, workspace.slug),
    wallClockSeconds: 120,
    executor: "fixture",
  });
  t.after(app.close);
  const cookie = await login(app.baseUrl);

  // Unauthenticated and unauthorized requests never reach the engine.
  assert.equal((await request(app.baseUrl, "/api/workspaces/wrk_storywell/executions")).status, 401);
  const registered = await request(app.baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name: "Outsider", email: "outsider@example.com", password: "a-long-enough-password" },
  });
  assert.equal(registered.status, 201);
  const outsiderCookie = registered.headers.get("set-cookie").split(";")[0];
  assert.equal((await request(app.baseUrl, "/api/workspaces/wrk_storywell/executions", { cookie: outsiderCookie })).status, 404);

  // An unknown workflow id is rejected against the live catalog.
  const unknown = await request(app.baseUrl, "/api/workspaces/wrk_storywell/executions", {
    cookie,
    method: "POST",
    body: { workflowId: "workflow.does-not-exist" },
  });
  assert.equal(unknown.status, 400);

  // Submit with no workflow: the adapter selects the first ready catalog workflow.
  const submitted = await request(app.baseUrl, "/api/workspaces/wrk_storywell/executions", { cookie, method: "POST", body: {} });
  assert.equal(submitted.status, 201);
  const created = await submitted.json();
  assert.equal(created.workflowId, "workflow.eng-change");
  assert.equal(created.resumed, false);
  assert.ok(created.contextFingerprint.length === 64);

  // A retry of the same request against the same context resumes the same record.
  const retried = await request(app.baseUrl, "/api/workspaces/wrk_storywell/executions", {
    cookie,
    method: "POST",
    body: { workflowId: "workflow.eng-change" },
  });
  assert.equal(retried.status, 200);
  const resumed = await retried.json();
  assert.equal(resumed.id, created.id);
  assert.equal(resumed.resumed, true);

  // The worker drives a real engine session; the run becomes durable engine-side.
  const completed = await waitForExecution(app.store, created.id, (entry) => entry.status === "completed" || entry.status === "failed");
  assert.equal(completed.status, "completed", `execution did not complete: ${JSON.stringify(completed, null, 2)}`);
  assert.ok(completed.engine.runId, "the durable engine run id must be recorded");
  assert.equal(completed.sessions.length, 1);

  const runStatePath = path.join(engineRoot, "storywell", "run", "run-state.json");
  assert.ok(existsSync(runStatePath), "the engine must own a durable run state file");
  const runState = JSON.parse(readFileSync(runStatePath, "utf8"));
  assert.equal(runState.runId, completed.engine.runId);

  // Founder-readable state: detail route reports live engine state in business vocabulary.
  const detail = await request(app.baseUrl, `/api/workspaces/wrk_storywell/executions/${created.id}`, { cookie });
  assert.equal(detail.status, 200);
  const detailPayload = await detail.json();
  assert.equal(detailPayload.engineState.reachable, true);
  assert.equal(detailPayload.engineState.ready, true);
  assert.equal(detailPayload.engineState.run.runStarted, true);
  const firstStep = detailPayload.engineState.run.steps.find((step) => step.workflowId === "workflow.eng-change");
  assert.equal(firstStep.status, "finished");
  assert.ok(detailPayload.engineState.run.headline.includes("finished"));

  // The session's verified result was imported: a recommendation claim (never a fact) with the
  // attempt's evidence, a draft deliverable with an immutable version, and declared trace totals
  // on the execution record.
  assert.deepEqual(detailPayload.importedResults, { verifiedResults: 1, declaredTokenBudget: 8_000, declaredCostEstimates: [] });
  const afterFirstImport = await app.store.read();
  const importedClaims = afterFirstImport.claims.filter((entry) => entry.workspaceId === "wrk_storywell" && entry.source?.kind === "engine-result");
  assert.equal(importedClaims.length, 1);
  assert.equal(importedClaims[0].kind, "recommendation");
  assert.equal(importedClaims[0].source.workflowId, "workflow.eng-change");
  assert.equal(importedClaims[0].source.runId, completed.engine.runId);
  assert.ok(importedClaims[0].evidence.length > 0, "the attempt's evidence must travel with the claim");
  const importedArtifacts = afterFirstImport.artifacts.filter((entry) => entry.workspaceId === "wrk_storywell" && entry.source?.kind === "engine-artifact");
  assert.equal(importedArtifacts.length, 1);
  assert.equal(importedArtifacts[0].status, "draft");
  assert.equal(importedArtifacts[0].stale, false);
  assert.equal(afterFirstImport.artifactVersions.filter((entry) => entry.artifactId === importedArtifacts[0].id).length, 1);

  // Resubmitting the finished request resumes the completed record without a second run.
  const afterCompletion = await request(app.baseUrl, "/api/workspaces/wrk_storywell/executions", {
    cookie,
    method: "POST",
    body: { workflowId: "workflow.eng-change" },
  });
  assert.equal(afterCompletion.status, 200);
  const afterCompletionPayload = await afterCompletion.json();
  assert.equal(afterCompletionPayload.id, created.id);
  assert.equal(afterCompletionPayload.resumed, true);
  const unchangedRunState = JSON.parse(readFileSync(runStatePath, "utf8"));
  assert.equal(unchangedRunState.runId, completed.engine.runId, "resuming must never start a second engine run");

  // Changed company context changes the fingerprint: a new execution against the same durable run.
  const patched = await request(app.baseUrl, "/api/workspaces/wrk_storywell/company", {
    cookie,
    method: "PATCH",
    body: { pricing: "$99 per year after a 14-day trial" },
  });
  assert.equal(patched.status, 200);
  const changedContext = await request(app.baseUrl, "/api/workspaces/wrk_storywell/executions", {
    cookie,
    method: "POST",
    body: { workflowId: "workflow.eng-followup" },
  });
  assert.equal(changedContext.status, 201);
  const followup = await changedContext.json();
  assert.notEqual(followup.id, created.id);
  assert.notEqual(followup.contextFingerprint, created.contextFingerprint);

  const followupDone = await waitForExecution(app.store, followup.id, (entry) => entry.status === "completed" || entry.status === "failed");
  assert.equal(followupDone.status, "completed", `follow-up execution did not complete: ${JSON.stringify(followupDone, null, 2)}`);
  assert.equal(followupDone.engine.runId, completed.engine.runId, "the same durable engine run must be resumed, never replaced");

  // Both verified results are imported now, and re-syncing (the approvals view runs the same
  // import) stays idempotent — no duplicate claims, deliverables, or versions.
  assert.equal(followupDone.importedResults.verifiedResults, 2);
  assert.equal((await request(app.baseUrl, "/api/workspaces/wrk_storywell/approvals", { cookie })).status, 200);
  const afterAllImports = await app.store.read();
  const allClaims = afterAllImports.claims.filter((entry) => entry.workspaceId === "wrk_storywell" && entry.source?.kind === "engine-result");
  assert.deepEqual(allClaims.map((entry) => entry.source.workflowId).sort(), ["workflow.eng-change", "workflow.eng-followup"]);
  const allArtifacts = afterAllImports.artifacts.filter((entry) => entry.workspaceId === "wrk_storywell" && entry.source?.kind === "engine-artifact");
  assert.equal(allArtifacts.length, 2);
  assert.ok(allArtifacts.every((entry) => entry.status === "draft" && entry.stale === false));
  assert.equal(afterAllImports.artifactVersions.filter((entry) => entry.createdBy === "Launch engine").length, 2);

  // The list route reports both executions, newest first, in founder shape — alongside the
  // self-serve capability the page reads before requesting work.
  const list = await request(app.baseUrl, "/api/workspaces/wrk_storywell/executions", { cookie });
  const listPayload = await list.json();
  assert.equal(listPayload.executions.length, 2);
  assert.equal(listPayload.executions[0].id, followup.id);
  assert.ok(listPayload.executions.every((entry) => entry.title && entry.status && entry.contextFingerprint));
  assert.equal(typeof listPayload.selfServeExecution.available, "boolean");
});

// ---------------------------------------------------------------------------
// The import half fails closed: a session whose work never verifies imports
// nothing, and its failed steps surface as founder tasks instead.
// ---------------------------------------------------------------------------

test("an unverified session imports nothing — failed steps become founder tasks, never claims or deliverables", { timeout: 300_000 }, async (t) => {
  assert.ok(tsxBin, "the engine's tsx runtime must be installed for this suite");
  const engineRoot = await mkdtemp(path.join(os.tmpdir(), "formation-engine-noop-"));
  bootstrapEngineWorkspace(engineRoot, "storywell");

  // No executor override: the engine's default no-op executor runs, which fails every attempt
  // honestly rather than fabricating progress.
  const app = await startTestServer({
    resolveEngineWorkspace: (workspace) => path.join(engineRoot, workspace.slug),
    wallClockSeconds: 120,
  });
  t.after(app.close);
  const cookie = await login(app.baseUrl);

  const submitted = await request(app.baseUrl, "/api/workspaces/wrk_storywell/executions", { cookie, method: "POST", body: {} });
  assert.equal(submitted.status, 201);
  const created = await submitted.json();
  const done = await waitForExecution(app.store, created.id, (entry) => entry.status === "completed" || entry.status === "failed");
  assert.equal(done.status, "completed", `the session itself ran to completion: ${JSON.stringify(done, null, 2)}`);
  assert.equal(done.importedResults.verifiedResults, 0);

  const database = await app.store.read();
  assert.equal(database.claims.filter((entry) => entry.source?.kind === "engine-result").length, 0, "an unverified node must contribute no claims");
  assert.equal(database.artifacts.filter((entry) => entry.source?.kind === "engine-artifact").length, 0, "an unverified node must contribute no deliverables");

  const blockerTasks = database.tasks.filter((entry) => entry.workspaceId === "wrk_storywell" && entry.source?.kind === "engine-blocker");
  assert.equal(blockerTasks.length, 1);
  assert.equal(blockerTasks[0].status, "next");
  assert.match(blockerTasks[0].title, /Update the onboarding copy/);

  // The completion notice must not read as progress when nothing verified: the founder is told
  // the session checked the plan and the undone work landed in tasks.
  const completedActivity = database.activity.filter((entry) => entry.workspaceId === "wrk_storywell" && entry.type === "execution-completed");
  assert.equal(completedActivity.length, 1);
  assert.match(completedActivity[0].detail, /no step was completed and verified/);

  // The approvals view re-runs the import; the mirror stays exact instead of duplicating.
  assert.equal((await request(app.baseUrl, "/api/workspaces/wrk_storywell/approvals", { cookie })).status, 200);
  const resynced = await app.store.read();
  assert.equal(resynced.tasks.filter((entry) => entry.source?.kind === "engine-blocker").length, 1);
});
