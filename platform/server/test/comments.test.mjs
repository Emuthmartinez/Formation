import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFormationServer } from "../app.mjs";
import { resolveMentions } from "../domain/comments.mjs";
import { buildProviderRequest } from "../domain/prompts.mjs";
import { buildWorkspaceSnapshot } from "../domain/readiness.mjs";
import { sharedView } from "../domain/sharing.mjs";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";

/**
 * Conversation about the record.
 *
 * The property that matters most is the one that is easiest to lose later: a comment is never a
 * source of truth. The suites at the bottom of this file assert that comments do not reach a
 * provider request and do not reach a shared link — not because either currently reads them, but
 * because both are built by naming fields, and the day somebody adds a convenient spread is the day
 * a private argument between cofounders ends up in an investor's browser or in a model's context.
 */

const WORKSPACE = "wrk_storywell";

async function startServer() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-comments-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();
  await store.transaction((database) => {
    for (const role of ["reviewer", "viewer"]) {
      database.users.push({ id: `usr_${role}`, email: `${role}@formation.local`, name: `Test ${role}`, createdAt: new Date().toISOString() });
      database.memberships.push({ id: `mem_${role}`, userId: `usr_${role}`, workspaceId: WORKSPACE, role, createdAt: new Date().toISOString() });
    }
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
  const response = await fetch(`${baseUrl}/api/auth/demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
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

async function snapshotOf(baseUrl, cookie) {
  const response = await call(baseUrl, `/api/workspaces/${WORKSPACE}`, { cookie });
  assert.equal(response.status, 200);
  return response.json();
}

// ---------------------------------------------------------------------------
// Threads.
// ---------------------------------------------------------------------------

test("a conversation can be started, replied to, and settled — and stays readable after", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");
  const reviewer = await signIn(app.baseUrl, "reviewer@formation.local");

  const started = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments`, {
    cookie: reviewer,
    method: "POST",
    body: { target: { kind: "workstream", id: "strategy" }, body: "Is the wedge still adult children, or has it moved?" },
  });
  assert.equal(started.status, 201);
  const opener = await started.json();

  const replied = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments`, {
    cookie: owner,
    method: "POST",
    body: { target: { kind: "workstream", id: "strategy" }, parentId: opener.id, body: "Still adult children. The interviews are unambiguous." },
  });
  assert.equal(replied.status, 201);

  let snapshot = await snapshotOf(app.baseUrl, owner);
  assert.equal(snapshot.comments.length, 1, "a reply joins its conversation rather than starting one");
  assert.equal(snapshot.comments[0].comments.length, 2);
  assert.equal(snapshot.comments[0].resolvedAt, null);

  const resolved = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments/${opener.id}`, { cookie: owner, method: "PATCH", body: { resolved: true } });
  assert.equal(resolved.status, 200);

  snapshot = await snapshotOf(app.baseUrl, owner);
  const thread = snapshot.comments[0];
  assert.ok(thread.resolvedAt, "a settled conversation records when it settled");
  assert.equal(thread.resolvedBy, "Maya Chen");
  assert.equal(thread.comments.length, 2, "resolving is not deleting — the argument stays readable");
});

test("a reply to a reply joins the same conversation instead of nesting deeper", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const cookie = await signIn(app.baseUrl, "founder@formation.local");

  const opener = await (await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments`, {
    cookie,
    method: "POST",
    body: { target: { kind: "workstream", id: "strategy" }, body: "First." },
  })).json();
  const reply = await (await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments`, {
    cookie,
    method: "POST",
    body: { target: { kind: "workstream", id: "strategy" }, parentId: opener.id, body: "Second." },
  })).json();
  const deep = await (await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments`, {
    cookie,
    method: "POST",
    body: { target: { kind: "workstream", id: "strategy" }, parentId: reply.id, body: "Third." },
  })).json();

  assert.equal(deep.parentId, opener.id, "depth is a structure people have to hold in their heads and buys nothing here");
  const snapshot = await snapshotOf(app.baseUrl, cookie);
  assert.equal(snapshot.comments.length, 1);
  assert.equal(snapshot.comments[0].comments.length, 3);
});

test("a comment must name something that is actually in this company", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const cookie = await signIn(app.baseUrl, "founder@formation.local");

  for (const target of [
    { kind: "workstream", id: "not-a-workstream" },
    { kind: "claim", id: "clm_from_another_company" },
    { kind: "deliverable", id: "art_absent" },
  ]) {
    const response = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments`, { cookie, method: "POST", body: { target, body: "Hello?" } });
    assert.equal(response.status, 404, `expected ${JSON.stringify(target)} to be refused`);
  }

  const snapshot = await snapshotOf(app.baseUrl, cookie);
  const artifact = snapshot.artifacts[0];
  const onMissingSection = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments`, {
    cookie,
    method: "POST",
    body: { target: { kind: "deliverable", id: artifact.id, sectionId: "sec_absent" }, body: "Here?" },
  });
  assert.equal(onMissingSection.status, 404, "a section that is not in the document is not a place to comment");

  const onRealSection = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments`, {
    cookie,
    method: "POST",
    body: { target: { kind: "deliverable", id: artifact.id, sectionId: artifact.sections[0].id }, body: "This paragraph overstates it." },
  });
  assert.equal(onRealSection.status, 201);
  assert.equal((await onRealSection.json()).target.sectionId, artifact.sections[0].id);
});

test("nobody edits or deletes words they did not write, at any role", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");
  const reviewer = await signIn(app.baseUrl, "reviewer@formation.local");

  const theirs = await (await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments`, {
    cookie: reviewer,
    method: "POST",
    body: { target: { kind: "workstream", id: "strategy" }, body: "I do not think the pricing holds." },
  })).json();

  const edited = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments/${theirs.id}`, { cookie: owner, method: "PATCH", body: { body: "I think the pricing holds." } });
  assert.equal(edited.status, 403, "an owner who can rewrite an advisor's words can rewrite the history of a decision");

  const deleted = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments/${theirs.id}`, { cookie: owner, method: "DELETE" });
  assert.equal(deleted.status, 403);

  const own = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments/${theirs.id}`, { cookie: reviewer, method: "PATCH", body: { body: "I do not think the pricing holds, yet." } });
  assert.equal(own.status, 200);
  assert.ok((await own.json()).editedAt, "an edited comment records that it was edited");
});

test("deleting the opening comment of a live conversation withdraws the words and keeps the thread", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const cookie = await signIn(app.baseUrl, "founder@formation.local");

  const opener = await (await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments`, {
    cookie,
    method: "POST",
    body: { target: { kind: "workstream", id: "strategy" }, body: "Something I regret saying." },
  })).json();
  await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments`, {
    cookie,
    method: "POST",
    body: { target: { kind: "workstream", id: "strategy" }, parentId: opener.id, body: "A reply that should survive." },
  });

  const removed = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments/${opener.id}`, { cookie, method: "DELETE" });
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).removed, false, "the words go, the thread stays");

  const snapshot = await snapshotOf(app.baseUrl, cookie);
  assert.equal(snapshot.comments.length, 1);
  assert.equal(snapshot.comments[0].comments[0].body, "");
  assert.ok(snapshot.comments[0].comments[0].withdrawnAt);
  assert.equal(snapshot.comments[0].comments[1].body, "A reply that should survive.");
});

test("open conversations come before settled ones", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const cookie = await signIn(app.baseUrl, "founder@formation.local");

  const first = await (await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments`, { cookie, method: "POST", body: { target: { kind: "workstream", id: "strategy" }, body: "Older, still open." } })).json();
  const second = await (await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments`, { cookie, method: "POST", body: { target: { kind: "workstream", id: "product" }, body: "Newer, will be settled." } })).json();
  await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments/${second.id}`, { cookie, method: "PATCH", body: { resolved: true } });

  const snapshot = await snapshotOf(app.baseUrl, cookie);
  assert.deepEqual(snapshot.comments.map((thread) => thread.id), [first.id, second.id], "history does not belong at the top of a page opened to find what still needs answering");
});

// ---------------------------------------------------------------------------
// Mentions.
// ---------------------------------------------------------------------------

test("a mention names a member of this company and nobody else", () => {
  const members = [
    { userId: "usr_maya", name: "Maya Chen", email: "founder@formation.local" },
    { userId: "usr_sam", name: "Sam", email: "sam@formation.local" },
  ];
  assert.deepEqual(resolveMentions("@Maya Chen what do you think?", members), ["usr_maya"]);
  assert.deepEqual(resolveMentions("Asking @sam@formation.local directly.", members), ["usr_sam"]);
  assert.deepEqual(resolveMentions("@Maya Chen and @Sam should both see this.", members).sort(), ["usr_maya", "usr_sam"]);
  assert.deepEqual(resolveMentions("No mention of Maya Chen here.", members), [], "a name is not a mention without the @");
  assert.deepEqual(resolveMentions("@nobody@example.com", members), [], "a mention cannot name someone outside the company");
  assert.deepEqual(resolveMentions("@Samuel is a different person.", members), [], "a mention must not match a longer name by prefix");
});

// ---------------------------------------------------------------------------
// A comment is never a source of truth.
// ---------------------------------------------------------------------------

test("comments reach neither a provider request nor a shared link", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const cookie = await signIn(app.baseUrl, "founder@formation.local");
  const secret = "Privately, I think the cofounder is wrong about pricing.";

  await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments`, {
    cookie,
    method: "POST",
    body: { target: { kind: "workstream", id: "business-model" }, body: secret },
  });
  const share = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/shares`, { cookie, method: "POST", body: { scope: "company" } });
  assert.equal(share.status, 201);
  const { viewPath } = await share.json();

  const database = await app.store.read();
  const workspace = database.workspaces.find((entry) => entry.id === WORKSPACE);

  const { request } = buildProviderRequest({
    workspace,
    workstream: workspace.workstreams[0],
    artifactType: null,
    instruction: "",
    claims: database.claims.filter((entry) => entry.workspaceId === WORKSPACE),
    decisions: database.decisions.filter((entry) => entry.workspaceId === WORKSPACE),
    artifacts: database.artifacts.filter((entry) => entry.workspaceId === WORKSPACE),
  });
  assert.ok(!JSON.stringify(request).includes(secret), "a private argument must never become model context");

  const view = await fetch(`${app.baseUrl}/api${viewPath}`);
  assert.equal(view.status, 200);
  assert.ok(!JSON.stringify(await view.json()).includes(secret), "a private argument must never reach an investor's browser");
  assert.equal(typeof sharedView, "function");
});

test("comments change nothing the product computes", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const cookie = await signIn(app.baseUrl, "founder@formation.local");

  const before = await snapshotOf(app.baseUrl, cookie);
  await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments`, {
    cookie,
    method: "POST",
    body: { target: { kind: "workstream", id: "strategy" }, body: "This changes nothing about readiness, and should not." },
  });
  const after = await snapshotOf(app.baseUrl, cookie);

  assert.deepEqual(after.readiness, before.readiness, "a conversation is not progress");
  assert.deepEqual(after.contradictions, before.contradictions);
  assert.deepEqual(after.inconsistencies, before.inconsistencies);
  assert.deepEqual(after.recommendations, before.recommendations);
  assert.equal(after.claims.length, before.claims.length, "commenting must not quietly create a claim");
});

test("a viewer reads every conversation and adds to none", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");
  const viewer = await signIn(app.baseUrl, "viewer@formation.local");

  await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments`, { cookie: owner, method: "POST", body: { target: { kind: "workstream", id: "strategy" }, body: "Visible to everyone here." } });

  const snapshot = await snapshotOf(app.baseUrl, viewer);
  assert.equal(snapshot.comments.length, 1, "a viewer sees the whole company, conversations included");

  const attempted = await call(app.baseUrl, `/api/workspaces/${WORKSPACE}/comments`, { cookie: viewer, method: "POST", body: { target: { kind: "workstream", id: "strategy" }, body: "Can I?" } });
  assert.equal(attempted.status, 403);
});

test("the snapshot builder is what serves threads, so there is no second definition of one", () => {
  const database = createSeedDatabase();
  const snapshot = buildWorkspaceSnapshot(database, WORKSPACE, database.memberships[0].userId);
  assert.ok(Array.isArray(snapshot.comments), "threads travel with the record they are about");
  assert.deepEqual(snapshot.comments, []);
});
