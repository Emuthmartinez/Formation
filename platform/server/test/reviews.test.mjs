import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFormationServer } from "../app.mjs";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";

/**
 * Review requests.
 *
 * The property worth the most here is the one that is invisible when it works: **a review is an
 * opinion, not an authority.** If approving a review promoted the thing it was about, a reviewer
 * who cannot edit a deliverable could settle one anyway by approving a review of it — the
 * capability ladder would have a back door that nobody had to walk through deliberately to open.
 * The last suite in this file is the one that catches that.
 */

const WORKSPACE = "wrk_storywell";

async function startServer() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-reviews-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();
  await store.transaction((database) => {
    for (const role of ["reviewer", "editor"]) {
      database.users.push({ id: `usr_${role}`, email: `${role}@formation.local`, name: `Test ${role}`, createdAt: new Date().toISOString() });
      database.memberships.push({ id: `mem_${role}`, userId: `usr_${role}`, workspaceId: WORKSPACE, role, createdAt: new Date().toISOString() });
    }
    database.users.push({ id: "usr_outsider", email: "outsider@formation.local", name: "Outsider", createdAt: new Date().toISOString() });
  });
  const { server } = createFormationServer({ store, allowDemoAuth: true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    store,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function signIn(baseUrl, email) {
  const response = await fetch(`${baseUrl}/api/auth/demo`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
  assert.equal(response.status, 200, `could not sign in as ${email}`);
  return response.headers.get("set-cookie").split(";")[0];
}

function call(baseUrl, pathname, { cookie, method = "GET", body } = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const snapshotOf = async (baseUrl, cookie) => (await call(baseUrl, `/api/workspaces/${WORKSPACE}`, { cookie })).json();
const ask = (baseUrl, cookie, body) => call(baseUrl, `/api/workspaces/${WORKSPACE}/reviews`, { cookie, method: "POST", body });
const strategy = { kind: "workstream", id: "strategy" };

test("a review is asked of one person, answered by them, and both are recorded", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");
  const reviewer = await signIn(app.baseUrl, "reviewer@formation.local");

  const asked = await ask(app.baseUrl, owner, { target: strategy, assigneeId: "usr_reviewer", note: "Does the wedge still hold after the interviews?" });
  assert.equal(asked.status, 201);
  const review = await asked.json();
  assert.equal(review.status, "requested");
  assert.equal(review.assigneeName, "Test reviewer");

  const answered = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/reviews/${review.id}`, {
    cookie: reviewer,
    method: "POST",
    body: { answer: "changes-requested", note: "Not until the pricing question is settled." },
  });
  assert.equal(answered.status, 200);

  const snapshot = await snapshotOf(app.baseUrl, owner);
  const settled = snapshot.reviews.find((entry) => entry.id === review.id);
  assert.equal(settled.status, "changes-requested");
  assert.equal(settled.answerNote, "Not until the pricing question is settled.");
  assert.ok(settled.answeredAt);
  assert.equal(settled.requestedByName, "Maya Chen", "who asked is part of the record");
});

test("only the person asked can answer, whatever anyone else's role is", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");
  const editor = await signIn(app.baseUrl, "editor@formation.local");

  const review = await (await ask(app.baseUrl, owner, { target: strategy, assigneeId: "usr_reviewer" })).json();

  for (const [who, cookie] of [["the owner who asked", owner], ["an unrelated editor", editor]]) {
    const response = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/reviews/${review.id}`, { cookie, method: "POST", body: { answer: "approved" } });
    assert.equal(response.status, 403, `${who} must not be able to answer on the reviewer's behalf`);
  }

  const snapshot = await snapshotOf(app.baseUrl, owner);
  assert.equal(snapshot.reviews[0].status, "requested", "a refused answer must leave the request open");
});

test("only the person who asked can withdraw the ask", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");
  const reviewer = await signIn(app.baseUrl, "reviewer@formation.local");
  const review = await (await ask(app.baseUrl, owner, { target: strategy, assigneeId: "usr_reviewer" })).json();

  const byAssignee = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/reviews/${review.id}`, { cookie: reviewer, method: "POST", body: { withdrawn: true } });
  assert.equal(byAssignee.status, 403, "withdrawing someone else's ask decides for them that it did not need an answer");

  const byRequester = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/reviews/${review.id}`, { cookie: owner, method: "POST", body: { withdrawn: true } });
  assert.equal(byRequester.status, 200);
  assert.equal((await byRequester.json()).status, "withdrawn");
});

test("a request must name a real person, a real record, and somebody other than yourself", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");

  const stranger = await ask(app.baseUrl, owner, { target: strategy, assigneeId: "usr_outsider" });
  assert.equal(stranger.status, 404, "a review cannot be asked of someone outside the company");

  const nowhere = await ask(app.baseUrl, owner, { target: { kind: "workstream", id: "not-a-workstream" }, assigneeId: "usr_reviewer" });
  assert.equal(nowhere.status, 404);

  const self = await ask(app.baseUrl, owner, { target: strategy, assigneeId: (await snapshotOf(app.baseUrl, owner)).membership.userId });
  assert.equal(self.status, 400, "asking yourself records nothing anyone else can act on");
});

test("the same person is not asked twice about the same thing while the first ask is open", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");
  const reviewer = await signIn(app.baseUrl, "reviewer@formation.local");

  const first = await (await ask(app.baseUrl, owner, { target: strategy, assigneeId: "usr_reviewer" })).json();
  const duplicate = await ask(app.baseUrl, owner, { target: strategy, assigneeId: "usr_reviewer" });
  assert.equal(duplicate.status, 409);

  await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/reviews/${first.id}`, { cookie: reviewer, method: "POST", body: { answer: "approved" } });
  const again = await ask(app.baseUrl, owner, { target: strategy, assigneeId: "usr_reviewer", note: "It changed — take another look." });
  assert.equal(again.status, 201, "once answered, the same person can be asked again about the same thing");
});

test("an answered request cannot be answered again or withdrawn afterwards", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");
  const reviewer = await signIn(app.baseUrl, "reviewer@formation.local");
  const review = await (await ask(app.baseUrl, owner, { target: strategy, assigneeId: "usr_reviewer" })).json();

  assert.equal((await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/reviews/${review.id}`, { cookie: reviewer, method: "POST", body: { answer: "approved" } })).status, 200);
  assert.equal((await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/reviews/${review.id}`, { cookie: reviewer, method: "POST", body: { answer: "changes-requested" } })).status, 409);
  assert.equal((await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/reviews/${review.id}`, { cookie: owner, method: "POST", body: { withdrawn: true } })).status, 409);
});

test("open requests come first, oldest first — the one somebody has waited longest for", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");
  const reviewer = await signIn(app.baseUrl, "reviewer@formation.local");

  const older = await (await ask(app.baseUrl, owner, { target: strategy, assigneeId: "usr_reviewer" })).json();
  const newer = await (await ask(app.baseUrl, owner, { target: { kind: "workstream", id: "product" }, assigneeId: "usr_reviewer" })).json();
  await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/reviews/${older.id}`, { cookie: reviewer, method: "POST", body: { answer: "approved" } });

  const snapshot = await snapshotOf(app.baseUrl, owner);
  assert.equal(snapshot.reviews[0].id, newer.id, "an answered request is history; an open one is work");
});

test("a review is an opinion, not an authority", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");
  const reviewer = await signIn(app.baseUrl, "reviewer@formation.local");

  const before = await snapshotOf(app.baseUrl, owner);
  const artifact = before.artifacts[0];
  const decision = before.decisions.find((entry) => !entry.source);

  for (const target of [{ kind: "deliverable", id: artifact.id }, { kind: "decision", id: decision.id }]) {
    const review = await (await ask(app.baseUrl, owner, { target, assigneeId: "usr_reviewer" })).json();
    const answered = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/reviews/${review.id}`, { cookie: reviewer, method: "POST", body: { answer: "approved" } });
    assert.equal(answered.status, 200);
  }

  const after = await snapshotOf(app.baseUrl, owner);
  assert.equal(after.artifacts.find((entry) => entry.id === artifact.id).status, artifact.status, "an approved review must not promote the deliverable it was about");
  assert.equal(after.artifacts.find((entry) => entry.id === artifact.id).version, artifact.version, "and must not consume a version");
  assert.equal(after.decisions.find((entry) => entry.id === decision.id).status, decision.status, "an approved review must not decide a decision");
  assert.deepEqual(after.readiness, before.readiness, "an opinion is not progress");
  assert.equal(after.claims.length, before.claims.length);
});

test("a reviewer can ask, and everyone in the company can see what was asked", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const reviewer = await signIn(app.baseUrl, "reviewer@formation.local");
  const editor = await signIn(app.baseUrl, "editor@formation.local");

  const asked = await ask(app.baseUrl, reviewer, { target: strategy, assigneeId: "usr_editor", note: "Can you check the numbers?" });
  assert.equal(asked.status, 201, "a reviewer who can question the record can equally ask someone else to");

  const snapshot = await snapshotOf(app.baseUrl, editor);
  assert.equal(snapshot.reviews.length, 1);
  assert.equal(snapshot.reviews[0].assigneeId, "usr_editor");
});
