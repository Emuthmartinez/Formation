import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFormationServer } from "../app.mjs";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";

/**
 * Two people editing one thing.
 *
 * Before this, whoever saved second won and the first person was never told. Their work survived
 * only in a version history they had no reason to open, which is a strange definition of "kept".
 *
 * The contract is opt-in: a request that names the version it was built from is checked, one that
 * names neither version nor timestamp proceeds. A caller who did not read the record first is not
 * claiming to have, and every existing integration keeps working. What must never happen is a
 * caller that *did* name its version being allowed to overwrite a newer one.
 */

const WORKSPACE = "wrk_storywell";

async function startServer() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-concurrency-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();
  await store.transaction((database) => {
    database.users.push({ id: "usr_editor", email: "editor@formation.local", name: "Sam Editor", createdAt: new Date().toISOString() });
    database.memberships.push({ id: "mem_editor", userId: "usr_editor", workspaceId: WORKSPACE, role: "editor", createdAt: new Date().toISOString() });
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

test("a deliverable edit built from a version somebody has already replaced is refused, and says who", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");
  const editor = await signIn(app.baseUrl, "editor@formation.local");

  const artifact = (await snapshotOf(app.baseUrl, owner)).artifacts[0];
  const startedFrom = artifact.version;

  // The editor saves while the owner is still typing.
  const theirs = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/artifacts/${artifact.id}`, {
    cookie: editor,
    method: "PATCH",
    body: { expectedVersion: startedFrom, summary: "Sam's rewrite of the summary." },
  });
  assert.equal(theirs.status, 200);

  const mine = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/artifacts/${artifact.id}`, {
    cookie: owner,
    method: "PATCH",
    body: { expectedVersion: startedFrom, summary: "Maya's rewrite of the summary." },
  });
  assert.equal(mine.status, 409);
  const message = (await mine.json()).error;
  assert.match(message, /Sam Editor/, "a refusal that does not say who moved it is not a sentence anyone can act on");
  assert.match(message, /Nothing was lost/);

  const after = await snapshotOf(app.baseUrl, owner);
  const current = after.artifacts.find((entry) => entry.id === artifact.id);
  assert.equal(current.summary, "Sam's rewrite of the summary.", "the refused edit must not have landed");
  assert.equal(current.version, startedFrom + 1, "and must not have consumed a version");
});

test("naming the current version succeeds, and naming nothing still succeeds", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const cookie = await signIn(app.baseUrl, "founder@formation.local");
  const artifact = (await snapshotOf(app.baseUrl, cookie)).artifacts[0];

  const named = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/artifacts/${artifact.id}`, {
    cookie,
    method: "PATCH",
    body: { expectedVersion: artifact.version, summary: "Named the version I read." },
  });
  assert.equal(named.status, 200);

  // A caller who did not read the record first is not claiming to have.
  const unnamed = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/artifacts/${artifact.id}`, {
    cookie,
    method: "PATCH",
    body: { summary: "Named nothing." },
  });
  assert.equal(unnamed.status, 200, "the guard is opt-in — an existing integration must keep working");
});

test("a version that is not a whole number is a bad request, not a conflict", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const cookie = await signIn(app.baseUrl, "founder@formation.local");
  const artifact = (await snapshotOf(app.baseUrl, cookie)).artifacts[0];

  const response = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/artifacts/${artifact.id}`, {
    cookie,
    method: "PATCH",
    body: { expectedVersion: "3", summary: "Nope." },
  });
  assert.equal(response.status, 400, "a malformed request and a lost race are different answers");
});

test("claims, decisions, and tasks are guarded by the timestamp the caller read", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");
  const editor = await signIn(app.baseUrl, "editor@formation.local");
  const before = await snapshotOf(app.baseUrl, owner);

  const cases = [
    { path: "claims", record: before.claims[0], first: { confidence: 51 }, second: { confidence: 52 } },
    { path: "decisions", record: before.decisions.find((entry) => !entry.source), first: { status: "revisit" }, second: { status: "open" } },
    { path: "tasks", record: before.tasks[0], first: { priority: "high" }, second: { priority: "low" } },
  ];

  for (const { path: collection, record, first, second } of cases) {
    const stamp = record.updatedAt;
    const theirs = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/${collection}/${record.id}`, {
      cookie: editor,
      method: "PATCH",
      body: { ...first, expectedUpdatedAt: stamp },
    });
    assert.equal(theirs.status, 200, `${collection}: the first writer should succeed`);

    const mine = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/${collection}/${record.id}`, {
      cookie: owner,
      method: "PATCH",
      body: { ...second, expectedUpdatedAt: stamp },
    });
    assert.equal(mine.status, 409, `${collection}: the second writer built from a stale read and must be refused`);
    assert.match((await mine.json()).error, /Sam Editor/, `${collection}: the refusal must name who moved it`);
  }

  const after = await snapshotOf(app.baseUrl, owner);
  assert.equal(after.claims.find((entry) => entry.id === before.claims[0].id).confidence, 51, "the refused change must not have landed");
  assert.equal(after.tasks.find((entry) => entry.id === before.tasks[0].id).priority, "high");
});

test("a refused save leaves nothing behind — no version, no activity, no half-write", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");
  const editor = await signIn(app.baseUrl, "editor@formation.local");
  const artifact = (await snapshotOf(app.baseUrl, owner)).artifacts[0];

  await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/artifacts/${artifact.id}`, {
    cookie: editor,
    method: "PATCH",
    body: { expectedVersion: artifact.version, summary: "Theirs." },
  });
  const between = await snapshotOf(app.baseUrl, owner);

  const refused = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/artifacts/${artifact.id}`, {
    cookie: owner,
    method: "PATCH",
    body: { expectedVersion: artifact.version, summary: "Mine.", sections: [{ title: "New", body: "Body." }] },
  });
  assert.equal(refused.status, 409);

  const after = await snapshotOf(app.baseUrl, owner);
  assert.equal(after.artifactVersions.length, between.artifactVersions.length, "a refused save must not append a version");
  assert.equal(after.activity.length, between.activity.length, "nor an activity entry");
  assert.deepEqual(
    after.artifacts.find((entry) => entry.id === artifact.id).sections.map((section) => section.title),
    between.artifacts.find((entry) => entry.id === artifact.id).sections.map((section) => section.title),
    "nor any part of the sections it carried",
  );
});
