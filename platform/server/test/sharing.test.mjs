import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFormationServer } from "../app.mjs";
import { MAX_ACTIVE_SHARES } from "../domain/sharing.mjs";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";

async function startTestServer() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-sharing-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();
  const { server } = createFormationServer({ store, allowDemoAuth: true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    store,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function call(baseUrl, pathname, { cookie, method = "GET", body } = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function signIn(baseUrl, email = "founder@formation.local") {
  const response = await call(baseUrl, "/api/auth/demo", { method: "POST", body: { email } });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

async function share(baseUrl, cookie, body) {
  const response = await call(baseUrl, "/api/workspaces/wrk_storywell/shares", { cookie, method: "POST", body });
  const raw = await response.text();
  assert.equal(response.status, 201, `share failed: ${raw}`);
  const payload = JSON.parse(raw);
  return { payload, token: payload.viewPath.split("/").pop() };
}

test("a link shows one deliverable to someone with no account at all", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl);
  const { payload, token } = await share(app.baseUrl, owner, { scope: "deliverable", artifactId: "art_customer_brief" });

  assert.match(payload.viewPath, /^\/shared\/[A-Za-z0-9_-]{20,}$/);
  assert.match(payload.delivery, /no account, no sign-in/);
  assert.equal(payload.share.label, "Primary customer brief");
  assert.equal(payload.share.viewCount, 0);

  // No cookie at all — the person reading this has never signed in.
  const read = await call(app.baseUrl, `/api/shared/${token}`);
  assert.equal(read.status, 200);
  assert.equal(read.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.equal(read.headers.get("cache-control"), "no-store");

  const view = await read.json();
  assert.equal(view.scope, "deliverable");
  assert.equal(view.company.name, "Storywell");
  assert.equal(view.deliverable.title, "Primary customer brief");
  assert.ok(view.deliverable.sections.length > 0);
  assert.ok(view.deliverable.sections.every((section) => section.title && typeof section.body === "string"));

  // The founder can see it was read.
  const shares = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell/shares", { cookie: owner })).json();
  assert.equal(shares.shares[0].viewCount, 1);
  assert.ok(shares.shares[0].lastViewedAt);
});

test("a link carries what was shared and nothing else", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl);

  // Put something private in every place a leak could come from.
  await call(app.baseUrl, "/api/workspaces/wrk_storywell/invitations", {
    cookie: owner, method: "POST", body: { email: "acquirer@example.com", role: "owner" },
  });
  await call(app.baseUrl, "/api/workspaces/wrk_storywell/tasks", {
    cookie: owner, method: "POST", body: { workstreamId: "strategy", title: "Call the acquirer back" },
  });
  await call(app.baseUrl, "/api/workspaces/wrk_storywell/decisions", {
    cookie: owner,
    method: "POST",
    body: { workstreamId: "strategy", title: "Runway", decision: "Nine months of runway left.", rationale: "Bank balance." },
  });

  for (const scope of ["deliverable", "company"]) {
    const { token } = await share(app.baseUrl, owner, scope === "company" ? { scope } : { scope, artifactId: "art_customer_brief" });
    const body = await (await call(app.baseUrl, `/api/shared/${token}`)).text();

    for (const secret of [
      "acquirer@example.com",
      "founder@formation.local",
      "Call the acquirer back",
      "Nine months of runway left",
      "usr_demo_founder",
      "mem_storywell_owner",
      "tokenHash",
      "passwordHash",
    ]) {
      assert.ok(!body.includes(secret), `${scope} link leaked ${secret}`);
    }

    const view = JSON.parse(body);
    // Whole collections that must never travel with a link, whatever they contain.
    for (const forbidden of ["members", "invitations", "activity", "tasks", "jobs", "executions", "decisions", "claims", "artifacts", "shares", "membership", "readiness", "contradictions"]) {
      assert.ok(!(forbidden in view), `${scope} link exposed ${forbidden}`);
    }
  }
});

test("a deliverable link carries only the evidence attached to that deliverable", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl);

  const attached = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell/claims", {
    cookie: owner,
    method: "POST",
    body: { workstreamId: "customer", kind: "fact", statement: "Seven interviews are complete and attached." },
  })).json();
  await call(app.baseUrl, "/api/workspaces/wrk_storywell/claims", {
    cookie: owner,
    method: "POST",
    body: { workstreamId: "customer", kind: "assumption", statement: "This unattached assumption must not travel." },
  });
  await call(app.baseUrl, "/api/workspaces/wrk_storywell/artifacts/art_customer_brief", {
    cookie: owner, method: "PATCH", body: { sourceClaimIds: [attached.id] },
  });

  const { token } = await share(app.baseUrl, owner, { scope: "deliverable", artifactId: "art_customer_brief" });
  const view = await (await call(app.baseUrl, `/api/shared/${token}`)).json();

  assert.deepEqual(view.deliverable.evidence, [{ kind: "fact", statement: "Seven interviews are complete and attached." }]);
  // Evidence travels as words, not as a record: no ids, confidence, status, or provenance.
  assert.deepEqual(Object.keys(view.deliverable.evidence[0]).sort(), ["kind", "statement"]);
});

test("stopping a link stops it, and so does time", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl);

  const stopped = await share(app.baseUrl, owner, { scope: "company" });
  const expired = await share(app.baseUrl, owner, { scope: "deliverable", artifactId: "art_customer_brief" });
  assert.equal((await call(app.baseUrl, `/api/shared/${stopped.token}`)).status, 200);

  const revoked = await call(app.baseUrl, `/api/workspaces/wrk_storywell/shares/${stopped.payload.share.id}`, { cookie: owner, method: "DELETE" });
  assert.equal(revoked.status, 200);
  await app.store.transaction((database) => {
    database.shares.find((entry) => entry.id === expired.payload.share.id).expiresAt = "2020-01-01T00:00:00.000Z";
  });

  // Stopped, expired, and never-existed are one answer.
  const answers = await Promise.all([
    call(app.baseUrl, `/api/shared/${stopped.token}`),
    call(app.baseUrl, `/api/shared/${expired.token}`),
    call(app.baseUrl, "/api/shared/a-token-that-never-existed"),
  ]);
  const bodies = await Promise.all(answers.map((response) => response.json()));
  assert.deepEqual(answers.map((response) => response.status), [404, 404, 404]);
  assert.equal(new Set(bodies.map((body) => body.error)).size, 1, "the three failures are distinguishable");

  // Neither survivor appears in the founder's live list, and stopping twice is refused.
  const shares = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell/shares", { cookie: owner })).json();
  assert.deepEqual(shares.shares.map((entry) => entry.id), []);
  assert.equal(
    (await call(app.baseUrl, `/api/workspaces/wrk_storywell/shares/${stopped.payload.share.id}`, { cookie: owner, method: "DELETE" })).status,
    409,
  );
});

test("sharing outside the company is the owner's call; seeing what is shared is everyone's", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl);
  await share(app.baseUrl, owner, { scope: "company" });

  await app.store.transaction((database) => {
    database.users.push({ id: "usr_editor", email: "editor@formation.local", name: "Ed Editor", createdAt: new Date().toISOString() });
    database.memberships.push({ id: "mem_editor", userId: "usr_editor", workspaceId: "wrk_storywell", role: "editor", createdAt: new Date().toISOString() });
  });
  const editor = await signIn(app.baseUrl, "editor@formation.local");

  // Knowing the work is circulating is not a privilege; deciding that it should be is.
  const seen = await call(app.baseUrl, "/api/workspaces/wrk_storywell/shares", { cookie: editor });
  assert.equal(seen.status, 200);
  assert.equal((await seen.json()).shares.length, 1);

  assert.equal(
    (await call(app.baseUrl, "/api/workspaces/wrk_storywell/shares", { cookie: editor, method: "POST", body: { scope: "company" } })).status,
    403,
  );
  const shares = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell/shares", { cookie: owner })).json();
  assert.equal(
    (await call(app.baseUrl, `/api/workspaces/wrk_storywell/shares/${shares.shares[0].id}`, { cookie: editor, method: "DELETE" })).status,
    403,
  );
});

test("links refuse the input and the volume that would make them careless", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl);

  for (const body of [
    { scope: "everything" },
    { scope: "deliverable", artifactId: "art_not_here" },
    { scope: "company", artifactId: "art_customer_brief" },
    { scope: "company", extra: 1 },
  ]) {
    const response = await call(app.baseUrl, "/api/workspaces/wrk_storywell/shares", { cookie: owner, method: "POST", body });
    assert.ok([400, 404].includes(response.status), `${JSON.stringify(body)} answered ${response.status}`);
  }

  // A deliverable in another company cannot be shared from this one.
  await app.store.transaction((database) => {
    const other = structuredClone(database.workspaces[0]);
    other.id = "wrk_other";
    other.slug = "other";
    database.workspaces.push(other);
    database.artifacts.push({ ...structuredClone(database.artifacts[0]), id: "art_elsewhere", workspaceId: "wrk_other" });
  });
  assert.equal(
    (await call(app.baseUrl, "/api/workspaces/wrk_storywell/shares", { cookie: owner, method: "POST", body: { scope: "deliverable", artifactId: "art_elsewhere" } })).status,
    404,
  );

  for (let index = 0; index < MAX_ACTIVE_SHARES; index += 1) {
    const response = await call(app.baseUrl, "/api/workspaces/wrk_storywell/shares", { cookie: owner, method: "POST", body: { scope: "company" } });
    assert.equal(response.status, 201, `link ${index} was refused`);
  }
  const overflow = await call(app.baseUrl, "/api/workspaces/wrk_storywell/shares", { cookie: owner, method: "POST", body: { scope: "company" } });
  assert.equal(overflow.status, 409);
  assert.match((await overflow.json()).error, new RegExp(`${MAX_ACTIVE_SHARES} live links`));
});

test("guessing shared links is limited, and a real one is not a guess", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl);
  const { token } = await share(app.baseUrl, owner, { scope: "company" });

  let refused = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await call(app.baseUrl, `/api/shared/guess-${attempt}`);
    if (response.status === 429) {
      refused = true;
      break;
    }
    assert.equal(response.status, 404);
  }
  assert.ok(refused, "unlimited link guessing was allowed");

  // And the person holding a real link is unaffected — even from the same address that has just
  // been shut out for guessing, and even reading it many times over.
  for (let attempt = 0; attempt < 30; attempt += 1) {
    assert.equal((await call(app.baseUrl, `/api/shared/${token}`)).status, 200, `read ${attempt} was refused`);
  }
});

test("a link shows the evidence that was attached when it was made, not what arrives later", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl);

  const reviewed = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell/claims", {
    cookie: owner,
    method: "POST",
    body: { workstreamId: "customer", kind: "fact", statement: "Evidence the founder reviewed before sharing." },
  })).json();
  await call(app.baseUrl, "/api/workspaces/wrk_storywell/artifacts/art_customer_brief", {
    cookie: owner, method: "PATCH", body: { sourceClaimIds: [reviewed.id] },
  });

  const { token } = await share(app.baseUrl, owner, { scope: "deliverable", artifactId: "art_customer_brief" });
  const before = await (await call(app.baseUrl, `/api/shared/${token}`)).json();
  assert.equal(before.deliverable.evidence.length, 1);

  // What a background engine import does: append a claim to the deliverable with no founder action.
  await app.store.transaction((database) => {
    const now = new Date().toISOString();
    database.claims.push({
      id: "clm_imported_later",
      workspaceId: "wrk_storywell",
      workstreamId: "customer",
      kind: "recommendation",
      key: null,
      statement: "Arrived from the skill after the link was already out.",
      value: null,
      confidence: 60,
      status: "active",
      evidence: [],
      createdAt: now,
      updatedAt: now,
    });
    const artifact = database.artifacts.find((entry) => entry.id === "art_customer_brief");
    artifact.sourceClaimIds = [...artifact.sourceClaimIds, "clm_imported_later"];
  });

  const after = await (await call(app.baseUrl, `/api/shared/${token}`)).text();
  assert.ok(
    !after.includes("Arrived from the skill after the link was already out."),
    "an automated import put new words in front of someone who already had the link",
  );
  assert.equal(JSON.parse(after).deliverable.evidence.length, 1);

  // A founder who wants the new evidence shown shares again, deliberately.
  const { token: freshToken } = await share(app.baseUrl, owner, { scope: "deliverable", artifactId: "art_customer_brief" });
  const fresh = await (await call(app.baseUrl, `/api/shared/${freshToken}`)).json();
  assert.equal(fresh.deliverable.evidence.length, 2);
});

test("reading a link many times does not rewrite the store many times", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl);
  const { token } = await share(app.baseUrl, owner, { scope: "company" });

  // A link on a mailing list. Every read must be answered; the writes must stay bounded by time.
  const reads = await Promise.all(Array.from({ length: 50 }, () => call(app.baseUrl, `/api/shared/${token}`)));
  assert.ok(reads.every((response) => response.status === 200), "a read was refused");

  // The first read flushes, the rest accumulate in memory until the window moves.
  const shares = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell/shares", { cookie: owner })).json();
  assert.ok(shares.shares[0].viewCount <= 2, `${shares.shares[0].viewCount} writes for 50 reads`);
  assert.ok(shares.shares[0].viewCount >= 1, "no read was ever recorded");
});

test("a malformed link is answered like any other bad one, not as a server error", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl);
  await share(app.baseUrl, owner, { scope: "company" });

  const answers = await Promise.all(
    ["%", "%zz", "%E0%A4%A", "a-token-that-never-existed"].map((token) => fetch(`${app.baseUrl}/api/shared/${token}`)),
  );
  const bodies = await Promise.all(answers.map((response) => response.json()));
  assert.deepEqual(answers.map((response) => response.status), [404, 404, 404, 404]);
  assert.equal(new Set(bodies.map((body) => body.error)).size, 1, "a malformed token is a distinguishable answer");
});
