import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { syncEngineApprovals } from "../domain/approvals.mjs";
import { ExecutionWorker } from "../execution.mjs";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";
import {
  bootstrapEngineWorkspace,
  currentBudgetPeriod,
  engineGrant,
  engineWaiver,
  login,
  request,
  startTestServer,
  tsxBin,
  waitForExecution,
} from "./_engine.mjs";

// ---------------------------------------------------------------------------
// The engine catalog for these suites: two independent spend steps, each parked
// behind an explicit founder approval even though autonomy (grant + waiver +
// budget) is fully satisfied — protected actions always need the founder's yes.
// ---------------------------------------------------------------------------

function approvalGatedCatalog() {
  const spendStep = (id, title, artifact, amount, ask) => ({
    id,
    title,
    domainId: "domain.money",
    actionClass: "spend",
    protectedCategory: "spend",
    costEstimate: { amount, currency: "USD" },
    dependencies: [],
    outputPaths: [artifact],
    providerIds: [],
    laneIds: [],
    founderOnlyActions: [ask],
    gateCommands: [],
    idempotent: false,
  });
  return {
    version: "catalog.approvals-test.v1",
    artifacts: [
      { id: "artifact.money-report", path: "money/report.md" },
      { id: "artifact.money-renewal", path: "money/renewal.md" },
    ],
    workflows: [
      spendStep("workflow.money-report", "Pull this week's revenue report", "money/report.md", 25, "Approve pulling this week's revenue report"),
      spendStep("workflow.money-renewal", "Renew the analytics subscription", "money/renewal.md", 40, "Approve renewing the analytics subscription"),
    ],
  };
}

function moneyEngineOptions() {
  return {
    catalog: approvalGatedCatalog(),
    grants: { "domain.money": engineGrant("domain.money", "full") },
    waivers: [engineWaiver("waiver.money.1", "domain.money", "spend", "spend")],
    balances: [{ unit: "Revenue", period: currentBudgetPeriod(), currency: "USD", allocated: 1000, committed: 0, spent: 0, remaining: 1000, updatedAt: "2026-08-01T00:00:00.000Z" }],
  };
}

function pendingReport({ runId = "run_test_1", statuses = {} } = {}) {
  const approval = (approvalId, workflowId, workflowTitle, description) => ({
    approvalId,
    workflowId,
    workflowTitle,
    description,
    status: statuses[approvalId] ?? "pending",
    protectedCategory: "spend",
  });
  return {
    schemaVersion: "1.0.0",
    generatedAt: "2026-08-05T00:00:00.000Z",
    workspaceReady: true,
    planId: "plan_test_1",
    catalogVersion: "catalog.approvals-test.v1",
    runId,
    hasDurableRun: true,
    autonomyUnset: false,
    workflows: [],
    approvals: [
      approval("workflow.money-report.approval.1", "workflow.money-report", "Pull this week's revenue report", "Approve pulling this week's revenue report"),
      approval("workflow.money-renewal.approval.1", "workflow.money-renewal", "Renew the analytics subscription", "Approve renewing the analytics subscription"),
    ],
  };
}

// ---------------------------------------------------------------------------
// Domain: mirroring engine approvals into the decision system.
// ---------------------------------------------------------------------------

test("syncEngineApprovals mirrors pending approvals as open decisions, idempotently", () => {
  const database = createSeedDatabase();
  const workspace = database.workspaces[0];
  const before = database.decisions.length;

  const first = syncEngineApprovals(database, workspace, pendingReport(), "2026-08-05T01:00:00.000Z");
  assert.equal(first.created.length, 2);
  assert.equal(database.decisions.length, before + 2);

  const mirror = database.decisions.find((entry) => entry.source?.approvalId === "workflow.money-report.approval.1");
  assert.equal(mirror.status, "open");
  assert.equal(mirror.workstreamId, "launch");
  // The mirror surfaces board-ready copy; the engine's own wording stays in `source` for
  // technical disclosure. An unknown workflow keeps its (scrubbed) title in the ask's context.
  assert.equal(mirror.title, "Your go-ahead: Pull this week's revenue report");
  assert.equal(mirror.decision, "Give your go-ahead on a step that spends money.");
  assert.equal(mirror.source.description, "Approve pulling this week's revenue report");
  assert.ok(mirror.rationale.includes("It spends money"), mirror.rationale);
  assert.equal(mirror.owner, workspace.founder.name);
  assert.equal(mirror.source.kind, "engine-approval");
  assert.equal(mirror.source.runId, "run_test_1");
  assert.equal(mirror.answer, null);

  // A second sync of the same report changes nothing: the gate stays one open decision.
  const second = syncEngineApprovals(database, workspace, pendingReport(), "2026-08-05T02:00:00.000Z");
  assert.equal(second.created.length, 0);
  assert.equal(second.answeredWithEngine.length, 0);
  assert.equal(second.superseded.length, 0);
  assert.equal(database.decisions.length, before + 2);
});

test("syncEngineApprovals closes a mirror the engine already answered and supersedes mirrors from a replaced run", () => {
  const database = createSeedDatabase();
  const workspace = database.workspaces[0];
  syncEngineApprovals(database, workspace, pendingReport(), "2026-08-05T01:00:00.000Z");

  // Answered directly with the engine's own CLI: the mirror closes, honestly attributed.
  const answered = syncEngineApprovals(
    database,
    workspace,
    pendingReport({ statuses: { "workflow.money-report.approval.1": "approved" } }),
    "2026-08-05T02:00:00.000Z",
  );
  assert.equal(answered.answeredWithEngine.length, 1);
  const closed = database.decisions.find((entry) => entry.source?.approvalId === "workflow.money-report.approval.1");
  assert.equal(closed.status, "decided");
  assert.equal(closed.answer.recordedVia, "engine");
  assert.ok(closed.decision.startsWith("Approved:"));

  // The engine re-seeded its run: the remaining open mirror is retired without being answered,
  // and the re-asked question gets a fresh open record.
  const reseeded = syncEngineApprovals(database, workspace, pendingReport({ runId: "run_test_2" }), "2026-08-05T03:00:00.000Z");
  assert.equal(reseeded.superseded.length, 1);
  assert.equal(reseeded.created.length, 2);
  const retired = database.decisions.find((entry) => entry.source?.approvalId === "workflow.money-renewal.approval.1" && entry.source.runId === "run_test_1");
  assert.equal(retired.status, "superseded");
  assert.equal(retired.answer, null, "superseding must never fabricate an answer");
  const reasked = database.decisions.filter((entry) => entry.source?.runId === "run_test_2" && entry.status === "open");
  assert.equal(reasked.length, 2);
});

test("syncEngineApprovals refuses to run from an unready report", () => {
  const database = createSeedDatabase();
  assert.throws(() => syncEngineApprovals(database, database.workspaces[0], { workspaceReady: false }, "2026-08-05T01:00:00.000Z"));
});

// ---------------------------------------------------------------------------
// Worker honesty: an unreachable engine never mutates records or drops an answer.
// ---------------------------------------------------------------------------

async function storeWithMirroredApproval() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-approvals-domain-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();
  const decisionId = await store.transaction((database) => {
    const changes = syncEngineApprovals(database, database.workspaces[0], pendingReport(), "2026-08-05T01:00:00.000Z");
    return changes.created[0].id;
  });
  return { store, decisionId };
}

test("an unreachable engine leaves mirrored approvals untouched and is reported as unreachable", async () => {
  const { store, decisionId } = await storeWithMirroredApproval();
  const worker = new ExecutionWorker(store, {
    engine: { describe: async () => ({ reachable: false, reason: "The launch engine is not installed on this server." }) },
    resolveEngineWorkspace: () => "/nonexistent/engine/workspace",
  });

  const view = await worker.syncApprovals((await store.read()).workspaces[0], "usr_demo_founder");
  assert.equal(view.connected, true);
  assert.equal(view.reachable, false);
  assert.ok(view.reason.includes("not installed"));
  assert.equal(view.operatingMode, "review-first");
  // The last known records still surface — but nothing was created, closed, or superseded.
  assert.equal(view.approvals.length, 2);
  const database = await store.read();
  const mirror = database.decisions.find((entry) => entry.id === decisionId);
  assert.equal(mirror.status, "open");
});

test("an approval answer that cannot reach the engine records nothing and stays open", async () => {
  const { store, decisionId } = await storeWithMirroredApproval();
  const user = { id: "usr_demo_founder", name: "Maya Chen", email: "founder@formation.local" };
  const worker = new ExecutionWorker(store, {
    engine: {
      describe: async () => ({ reachable: true, report: pendingReport() }),
      approve: async () => ({ recorded: false, kind: "unreachable", reason: "The launch engine could not be started on this server." }),
    },
    resolveEngineWorkspace: () => "/nonexistent/engine/workspace",
  });

  await assert.rejects(
    worker.answerApproval({ workspaceId: "wrk_storywell", user, decisionId, answer: "approve" }),
    (error) => error.status === 502 && error.message.includes("Nothing was recorded"),
  );
  const database = await store.read();
  assert.equal(database.decisions.find((entry) => entry.id === decisionId).status, "open");
});

test("an answer against a run the engine replaced is refused and the stale mirror is retired", async () => {
  const { store, decisionId } = await storeWithMirroredApproval();
  const user = { id: "usr_demo_founder", name: "Maya Chen", email: "founder@formation.local" };
  const worker = new ExecutionWorker(store, {
    engine: {
      describe: async () => ({ reachable: true, report: pendingReport({ runId: "run_test_2" }) }),
      approve: async () => {
        throw new Error("approve must never be attempted for a question the engine is no longer asking");
      },
    },
    resolveEngineWorkspace: () => "/nonexistent/engine/workspace",
  });

  await assert.rejects(
    worker.answerApproval({ workspaceId: "wrk_storywell", user, decisionId, answer: "approve" }),
    (error) => error.status === 409 && error.message.includes("no longer asking"),
  );
  const database = await store.read();
  assert.equal(database.decisions.find((entry) => entry.id === decisionId).status, "superseded");
});

test("a reviewer can see approvals but never answer them", async () => {
  const { store, decisionId } = await storeWithMirroredApproval();
  await store.transaction((database) => {
    database.users.push({ id: "usr_advisor", email: "advisor@example.com", name: "Avery Advisor", createdAt: "2026-08-05T00:00:00.000Z" });
    database.memberships.push({ id: "mem_advisor", userId: "usr_advisor", workspaceId: "wrk_storywell", role: "reviewer", createdAt: "2026-08-05T00:00:00.000Z" });
  });
  const worker = new ExecutionWorker(store, {
    engine: { describe: async () => ({ reachable: true, report: pendingReport() }) },
    resolveEngineWorkspace: () => "/nonexistent/engine/workspace",
  });

  await assert.rejects(
    worker.answerApproval({ workspaceId: "wrk_storywell", user: { id: "usr_advisor", name: "Avery Advisor" }, decisionId, answer: "approve" }),
    (error) => error.status === 403,
  );
  const database = await store.read();
  assert.equal(database.decisions.find((entry) => entry.id === decisionId).status, "open");
});

// ---------------------------------------------------------------------------
// The full boundary against a real engine: a parked gate surfaces as a decision,
// an approval travels back through core/session/approve.ts, a rejection blocks,
// and silence never becomes consent.
// ---------------------------------------------------------------------------

test("engine founder gates surface in Formation and answers travel back through the engine's sanctioned path", { timeout: 300_000 }, async (t) => {
  assert.ok(tsxBin, "the engine's tsx runtime must be installed for this suite");
  const engineRoot = await mkdtemp(path.join(os.tmpdir(), "formation-approvals-engine-"));
  bootstrapEngineWorkspace(engineRoot, "storywell", moneyEngineOptions());
  const runStatePath = path.join(engineRoot, "storywell", "run", "run-state.json");

  const app = await startTestServer(
    {
      resolveEngineWorkspace: (workspace) => path.join(engineRoot, workspace.slug),
      wallClockSeconds: 120,
      executor: "fixture",
    },
    { storePrefix: "formation-approvals-" },
  );
  t.after(app.close);
  const cookie = await login(app.baseUrl);

  // Before any engine run exists there is nothing answerable: the engine predicts the gates,
  // but no durable run holds them yet, so Formation mirrors nothing.
  const beforeRun = await request(app.baseUrl, "/api/workspaces/wrk_storywell/approvals", { cookie });
  assert.equal(beforeRun.status, 200);
  const beforeRunPayload = await beforeRun.json();
  assert.equal(beforeRunPayload.reachable, true);
  assert.equal(beforeRunPayload.ready, true);
  assert.equal(beforeRunPayload.operatingMode, "review-first");
  assert.deepEqual(beforeRunPayload.approvals, []);

  // A session against the gated step seeds the durable run and parks it waiting on the founder;
  // the worker surfaces the parked gates as decisions without waiting for a page view.
  const submitted = await request(app.baseUrl, "/api/workspaces/wrk_storywell/executions", {
    cookie,
    method: "POST",
    body: { workflowId: "workflow.money-report" },
  });
  assert.equal(submitted.status, 201);
  const execution = await submitted.json();
  const completed = await waitForExecution(app.store, execution.id, (entry) => entry.status === "completed" || entry.status === "failed");
  assert.equal(completed.status, "completed", `execution did not complete: ${JSON.stringify(completed, null, 2)}`);

  let database = await app.store.read();
  let mirrors = database.decisions.filter((entry) => entry.source?.kind === "engine-approval");
  assert.equal(mirrors.length, 2, "both parked gates must surface as decisions after the session");
  assert.ok(mirrors.every((entry) => entry.status === "open"));
  assert.ok(database.activity.some((entry) => entry.type === "approval-requested"));

  const reportDecision = mirrors.find((entry) => entry.source.approvalId === "workflow.money-report.approval.1");
  const renewalDecision = mirrors.find((entry) => entry.source.approvalId === "workflow.money-renewal.approval.1");
  assert.ok(reportDecision && renewalDecision);
  assert.ok(reportDecision.rationale.includes("It spends money"));

  // The approvals view lists them; a repeat view (a retry) changes nothing — an unanswered gate
  // stays exactly one open decision, and no operating mode answers it.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const view = await request(app.baseUrl, "/api/workspaces/wrk_storywell/approvals", { cookie });
    assert.equal(view.status, 200);
    const payload = await view.json();
    assert.equal(payload.approvals.filter((entry) => entry.status === "open").length, 2);
  }

  // A second engine session does not re-ask, auto-answer, or duplicate the parked gates.
  const secondSession = await request(app.baseUrl, "/api/workspaces/wrk_storywell/executions", {
    cookie,
    method: "POST",
    body: { workflowId: "workflow.money-renewal" },
  });
  assert.equal(secondSession.status, 201);
  const secondExecution = await secondSession.json();
  const secondCompleted = await waitForExecution(app.store, secondExecution.id, (entry) => entry.status === "completed" || entry.status === "failed");
  assert.equal(secondCompleted.status, "completed");
  database = await app.store.read();
  mirrors = database.decisions.filter((entry) => entry.source?.kind === "engine-approval");
  assert.equal(mirrors.length, 2, "a retry must not duplicate the parked gates");
  assert.ok(mirrors.every((entry) => entry.status === "open"), "a retry must never answer a gate");
  let runState = JSON.parse(readFileSync(runStatePath, "utf8"));
  assert.equal(runState.approvals["workflow.money-report.approval.1"], "pending");
  assert.equal(runState.approvals["workflow.money-renewal.approval.1"], "pending");

  // Strangers get a 404; a reviewer can look but not answer.
  const registered = await request(app.baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name: "Outsider", email: "outsider@example.com", password: "a-long-enough-password" },
  });
  assert.equal(registered.status, 201);
  const outsiderCookie = registered.headers.get("set-cookie").split(";")[0];
  assert.equal((await request(app.baseUrl, "/api/workspaces/wrk_storywell/approvals", { cookie: outsiderCookie })).status, 404);
  assert.equal(
    (await request(app.baseUrl, `/api/workspaces/wrk_storywell/approvals/${reportDecision.id}`, { cookie: outsiderCookie, method: "POST", body: { answer: "approve" } })).status,
    404,
  );
  const outsiderId = (await app.store.read()).users.find((entry) => entry.email === "outsider@example.com").id;
  await app.store.transaction((liveDatabase) => {
    liveDatabase.memberships.push({ id: "mem_advisor", userId: outsiderId, workspaceId: "wrk_storywell", role: "reviewer", createdAt: new Date().toISOString() });
  });
  assert.equal((await request(app.baseUrl, "/api/workspaces/wrk_storywell/approvals", { cookie: outsiderCookie })).status, 200);
  const advisorAnswer = await request(app.baseUrl, `/api/workspaces/wrk_storywell/approvals/${reportDecision.id}`, {
    cookie: outsiderCookie,
    method: "POST",
    body: { answer: "approve" },
  });
  assert.equal(advisorAnswer.status, 403);

  // The mirrored decision cannot be "decided" by editing it: the engine's gate would stay parked
  // while Formation claimed otherwise.
  const patched = await request(app.baseUrl, `/api/workspaces/wrk_storywell/decisions/${reportDecision.id}`, {
    cookie,
    method: "PATCH",
    body: { status: "decided" },
  });
  assert.equal(patched.status, 409);
  runState = JSON.parse(readFileSync(runStatePath, "utf8"));
  assert.equal(runState.approvals["workflow.money-report.approval.1"], "pending");

  // Invalid answers never reach the engine.
  assert.equal(
    (await request(app.baseUrl, `/api/workspaces/wrk_storywell/approvals/${reportDecision.id}`, { cookie, method: "POST", body: { answer: "maybe" } })).status,
    400,
  );

  // Declining travels through approve.ts: the engine records the rejection and blocks the step.
  const declined = await request(app.baseUrl, `/api/workspaces/wrk_storywell/approvals/${renewalDecision.id}`, {
    cookie,
    method: "POST",
    body: { answer: "decline", reason: "Hold subscriptions until revenue lands." },
  });
  assert.equal(declined.status, 200);
  const declinedPayload = await declined.json();
  assert.equal(declinedPayload.status, "decided");
  assert.equal(declinedPayload.answer.value, "declined");
  assert.equal(declinedPayload.answer.recordedVia, "formation");
  runState = JSON.parse(readFileSync(runStatePath, "utf8"));
  assert.equal(runState.approvals["workflow.money-renewal.approval.1"], "rejected");
  const renewalNode = Object.values(runState.nodes).find((entry) => entry.nodeId.includes("money-renewal"));
  assert.equal(renewalNode.status, "blocked", "a rejection must not free the step");
  assert.ok(renewalNode.blocker.includes("Founder declined"));

  // Approving travels through approve.ts: the recorded answer frees the step from its gate.
  const approvedResponse = await request(app.baseUrl, `/api/workspaces/wrk_storywell/approvals/${reportDecision.id}`, {
    cookie,
    method: "POST",
    body: { answer: "approve" },
  });
  assert.equal(approvedResponse.status, 200);
  const approvedPayload = await approvedResponse.json();
  assert.equal(approvedPayload.status, "decided");
  assert.equal(approvedPayload.answer.value, "approved");
  runState = JSON.parse(readFileSync(runStatePath, "utf8"));
  assert.equal(runState.approvals["workflow.money-report.approval.1"], "approved");
  const reportNode = Object.values(runState.nodes).find((entry) => entry.nodeId.includes("money-report"));
  assert.equal(reportNode.status, "pending", "an approval must return the node from waiting_founder to schedulable work");

  // Answering twice is refused — the first answer stands.
  const again = await request(app.baseUrl, `/api/workspaces/wrk_storywell/approvals/${reportDecision.id}`, {
    cookie,
    method: "POST",
    body: { answer: "decline" },
  });
  assert.equal(again.status, 409);
  runState = JSON.parse(readFileSync(runStatePath, "utf8"));
  assert.equal(runState.approvals["workflow.money-report.approval.1"], "approved");

  // The freed step actually runs on the next session; the declined one stays blocked.
  const patchedCompany = await request(app.baseUrl, "/api/workspaces/wrk_storywell/company", {
    cookie,
    method: "PATCH",
    body: { pricing: "$149 per year after the beta" },
  });
  assert.equal(patchedCompany.status, 200);
  const thirdSession = await request(app.baseUrl, "/api/workspaces/wrk_storywell/executions", {
    cookie,
    method: "POST",
    body: { workflowId: "workflow.money-report" },
  });
  assert.equal(thirdSession.status, 201);
  const thirdExecution = await thirdSession.json();
  const thirdCompleted = await waitForExecution(app.store, thirdExecution.id, (entry) => entry.status === "completed" || entry.status === "failed");
  assert.equal(thirdCompleted.status, "completed", `post-approval execution did not complete: ${JSON.stringify(thirdCompleted, null, 2)}`);
  const finalReportStep = thirdCompleted.report.steps.find((step) => step.workflowId === "workflow.money-report");
  assert.equal(finalReportStep.status, "finished", "the approved step must run once freed");
  runState = JSON.parse(readFileSync(runStatePath, "utf8"));
  assert.equal(Object.values(runState.nodes).find((entry) => entry.nodeId.includes("money-renewal")).status, "blocked");

  // The decision log keeps both answers, attributed and dated.
  database = await app.store.read();
  const closedMirrors = database.decisions.filter((entry) => entry.source?.kind === "engine-approval");
  assert.equal(closedMirrors.length, 2);
  assert.ok(closedMirrors.every((entry) => entry.status === "decided" && entry.decidedAt && entry.answer?.answeredBy === "Maya Chen"));
});
