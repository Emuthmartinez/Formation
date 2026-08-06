import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createFormationServer } from "../app.mjs";
import { EngineBridge, ExecutionWorker, computeContextFingerprint, founderRunView } from "../execution.mjs";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, "../../..");
const skillDir = path.join(repoRoot, "skill/b2c-mobile-business-launch");
const tsxBin = [path.join(skillDir, "node_modules/.bin/tsx"), path.join(repoRoot, "node_modules/.bin/tsx")].find((candidate) => existsSync(candidate));

// ---------------------------------------------------------------------------
// Engine workspace bootstrap. Tests build a real engine workspace the same way
// the engine's own fixture suite does: every reducer-owned document is created
// through the reducer CLI with founder authority, never written directly.
// ---------------------------------------------------------------------------

const LANE_KEYS = [
  "paid_tool_routing",
  "secrets",
  "security",
  "research",
  "traceability",
  "experience",
  "product",
  "design",
  "emotional_design",
  "content_assets",
  "analytics_attribution",
  "paid_user_acquisition",
  "onboarding",
  "revenue",
  "store_console",
  "apple_signing",
  "privacy_legal",
  "email",
  "orchestration",
  "engineering",
  "growth",
  "post_launch_ops",
];

let patchCounter = 0;

function runReducer(args) {
  const result = spawnSync(tsxBin, [path.join(skillDir, "core/reducer/cli.ts"), ...args], { cwd: skillDir, encoding: "utf8" });
  return { code: result.status ?? -1, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function commit(workspaceDir, targetFile, targetDoc, ops, declaredOutputs) {
  patchCounter += 1;
  const patch = {
    schemaVersion: "1.0.0",
    patchId: `execution-test-patch-${patchCounter}`,
    targetDoc,
    reason: "execution adapter test setup",
    authoredBy: "execution-test-setup",
    authoredAt: "2026-08-05T00:00:00.000Z",
    preconditions: [],
    ops,
    declaredOutputs,
  };
  const patchPath = path.join(workspaceDir, `${patch.patchId}.json`);
  writeJson(patchPath, patch);
  const result = runReducer([
    "commit",
    "--patch",
    patchPath,
    "--file",
    targetFile,
    "--manifest",
    path.join(workspaceDir, "control", "manifest.json"),
    "--audit",
    path.join(workspaceDir, "control", "audit.jsonl"),
    "--session",
    "execution-test-setup",
    "--founder-authority",
    "true",
  ]);
  assert.equal(result.code, 0, `engine workspace bootstrap commit failed: ${result.output}`);
}

function testCatalog() {
  return {
    version: "catalog.execution-test.v1",
    artifacts: [
      { id: "artifact.eng-change", path: "engineering/change.log" },
      { id: "artifact.eng-followup", path: "engineering/followup.log" },
    ],
    workflows: [
      {
        id: "workflow.eng-change",
        title: "Update the onboarding copy",
        domainId: "domain.engineering",
        actionClass: "mutate",
        dependencies: [],
        outputPaths: ["engineering/change.log"],
        providerIds: [],
        laneIds: [],
        founderOnlyActions: [],
        gateCommands: [],
        idempotent: true,
      },
      {
        id: "workflow.eng-followup",
        title: "Tidy the follow-up checklist",
        domainId: "domain.engineering",
        actionClass: "mutate",
        dependencies: ["workflow.eng-change"],
        outputPaths: ["engineering/followup.log"],
        providerIds: [],
        laneIds: [],
        founderOnlyActions: [],
        gateCommands: [],
        idempotent: true,
      },
    ],
  };
}

function bootstrapEngineWorkspace(engineRoot, slug) {
  const workspaceDir = path.join(engineRoot, slug);
  mkdirSync(workspaceDir, { recursive: true });
  const lanes = {};
  for (const key of LANE_KEYS) lanes[key] = { status: "pending", evidence: [], blockers: [] };

  commit(
    workspaceDir,
    path.join(workspaceDir, "state", "business-state.json"),
    "business-state",
    [
      { op: "set", path: ["narrative"], value: { sinceLastTime: "", rightNow: "", yourCall: "", lastCelebratedPhase: "" } },
      {
        op: "set",
        path: ["project"],
        value: {
          name: "Execution Test App",
          slug,
          owner: "Founder",
          phase: "phase_0_orient",
          launchScope: "essentials",
          kickoffDate: "",
          platforms: ["ios"],
          bundleIds: { ios: "com.example.app", android: "" },
          publicUrls: { landing: "", privacy: "", terms: "" },
        },
      },
      { op: "set", path: ["lanes"], value: lanes },
      { op: "set", path: ["founderGates"], value: { pending: [] } },
    ],
    [["narrative"], ["project"], ["lanes"], ["founderGates"]],
  );

  commit(
    workspaceDir,
    path.join(workspaceDir, "control", "control.json"),
    "control",
    [
      { op: "set", path: ["businessSlug"], value: slug },
      { op: "set", path: ["killSwitch"], value: { engaged: false, engagedAt: "", engagedBy: "", reason: "" } },
      {
        op: "set",
        path: ["grants"],
        value: {
          "domain.engineering": {
            domainId: "domain.engineering",
            level: "run-with-guardrails",
            prerequisites: [],
            grantedAt: "2026-08-01T00:00:00.000Z",
            grantedBy: "founder",
            updatedAt: "2026-08-01T00:00:00.000Z",
          },
        },
      },
      { op: "set", path: ["waivers"], value: [] },
    ],
    [["businessSlug"], ["killSwitch"], ["grants"], ["waivers"]],
  );

  commit(
    workspaceDir,
    path.join(workspaceDir, "control", "budget-ledger.json"),
    "budget-ledger",
    [
      { op: "set", path: ["balances"], value: [] },
      { op: "set", path: ["entries"], value: [] },
    ],
    [["balances"], ["entries"]],
  );

  writeJson(path.join(workspaceDir, "catalog.json"), testCatalog());
  return workspaceDir;
}

// ---------------------------------------------------------------------------
// Platform server harness.
// ---------------------------------------------------------------------------

async function startTestServer(execution) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-execution-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();
  const { server, executionWorker } = createFormationServer({ store, allowDemoAuth: true, execution });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    store,
    executionWorker,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function login(baseUrl, email = "founder@formation.local") {
  const response = await fetch(`${baseUrl}/api/auth/demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

function request(baseUrl, pathname, { cookie, method = "GET", body } = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function waitForExecution(store, executionId, predicate, attempts = 400) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const database = await store.read();
    const execution = database.executions.find((entry) => entry.id === executionId);
    if (execution && predicate(execution)) return execution;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const database = await store.read();
  return database.executions.find((entry) => entry.id === executionId);
}

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
  assert.deepEqual(await list.json(), []);
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

  // The list route reports both executions, newest first, in founder shape.
  const list = await request(app.baseUrl, "/api/workspaces/wrk_storywell/executions", { cookie });
  const listPayload = await list.json();
  assert.equal(listPayload.length, 2);
  assert.equal(listPayload[0].id, followup.id);
  assert.ok(listPayload.every((entry) => entry.title && entry.status && entry.contextFingerprint));
});
