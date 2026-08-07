import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFormationServer } from "../app.mjs";
import { MAX_PENDING_INVITATIONS } from "../domain/members.mjs";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";

async function startTestServer({ allowRegistration = true } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-members-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();
  const { server } = createFormationServer({ store, allowDemoAuth: true, allowRegistration });
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

async function signIn(baseUrl, email) {
  const response = await call(baseUrl, "/api/auth/demo", { method: "POST", body: { email } });
  assert.equal(response.status, 200, `sign in failed for ${email}`);
  return response.headers.get("set-cookie").split(";")[0];
}

async function register(baseUrl, { name, email, password = "a-long-enough-password", invitationToken }) {
  const response = await call(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name, email, password, ...(invitationToken ? { invitationToken } : {}) },
  });
  return { response, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? null };
}

/** Owner invites, someone registers with the link, and they land in the company at the invited role. */
test("an invitation carries one person into a company at the role they were offered", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");

  const invited = await call(app.baseUrl, "/api/workspaces/wrk_storywell/invitations", {
    cookie: owner,
    method: "POST",
    body: { email: "Sam@Example.com ", role: "editor" },
  });
  assert.equal(invited.status, 201);
  const payload = await invited.json();
  assert.equal(payload.invitation.email, "sam@example.com", "the address is normalized before it is stored");
  assert.equal(payload.invitation.role, "editor");
  assert.match(payload.acceptPath, /^\/join\/[A-Za-z0-9_-]{20,}$/);
  // The founder is told plainly that they carry the link themselves.
  assert.match(payload.delivery, /cannot send email yet/i);
  const token = payload.acceptPath.split("/").pop();

  const { response: registered, cookie: sam } = await register(app.baseUrl, { name: "Sam Rivera", email: "sam@example.com" });
  assert.equal(registered.status, 201);

  const preview = await call(app.baseUrl, "/api/invitations/preview", { cookie: sam, method: "POST", body: { token } });
  assert.equal(preview.status, 200);
  const previewed = await preview.json();
  assert.equal(previewed.company, "Storywell");
  assert.equal(previewed.role, "editor");
  assert.equal(previewed.matchesYou, true);

  const accepted = await call(app.baseUrl, "/api/invitations/accept", { cookie: sam, method: "POST", body: { token } });
  assert.equal(accepted.status, 201);
  assert.equal((await accepted.json()).role, "editor");

  // They are in, at the invited role, and the server enforces it.
  const snapshot = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell", { cookie: sam })).json();
  assert.equal(snapshot.membership.role, "editor");
  assert.ok(snapshot.capabilities.includes("work-write"));
  assert.ok(!snapshot.capabilities.includes("company-write"));
  assert.equal(
    (await call(app.baseUrl, "/api/workspaces/wrk_storywell/company", { cookie: sam, method: "PATCH", body: { pricing: "x" } })).status,
    403,
  );

  // The company's history records the access change rather than hiding it in a separate log.
  assert.ok(snapshot.activity.some((entry) => entry.type === "member-invited"));
  assert.ok(snapshot.activity.some((entry) => entry.type === "member-joined"));
});

test("an invitation is single use, and using it again changes nothing", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");
  const created = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell/invitations", {
    cookie: owner,
    method: "POST",
    body: { email: "sam@example.com", role: "viewer" },
  })).json();
  const token = created.acceptPath.split("/").pop();

  const { cookie: sam } = await register(app.baseUrl, { name: "Sam Rivera", email: "sam@example.com" });
  assert.equal((await call(app.baseUrl, "/api/invitations/accept", { cookie: sam, method: "POST", body: { token } })).status, 201);

  const again = await call(app.baseUrl, "/api/invitations/accept", { cookie: sam, method: "POST", body: { token } });
  assert.equal(again.status, 404, "a spent invitation is not a live one");

  // Promote them, then replay the old viewer invitation: an expired offer must not be able to
  // reach back in and take away what they were given since.
  const members = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell/members", { cookie: owner })).json();
  const sams = members.members.find((entry) => entry.email === "sam@example.com");
  assert.equal(
    (await call(app.baseUrl, `/api/workspaces/wrk_storywell/members/${sams.id}`, { cookie: owner, method: "PATCH", body: { role: "editor" } })).status,
    200,
  );
  await call(app.baseUrl, "/api/invitations/accept", { cookie: sam, method: "POST", body: { token } });
  const after = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell", { cookie: sam })).json();
  assert.equal(after.membership.role, "editor");
});

test("an invitation belongs to one email address, not to whoever holds the link", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");
  const created = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell/invitations", {
    cookie: owner,
    method: "POST",
    body: { email: "sam@example.com", role: "owner" },
  })).json();
  const token = created.acceptPath.split("/").pop();

  const { cookie: stranger } = await register(app.baseUrl, { name: "Someone Else", email: "forwarded@example.com" });
  const stolen = await call(app.baseUrl, "/api/invitations/accept", { cookie: stranger, method: "POST", body: { token } });
  assert.equal(stolen.status, 403);
  assert.match((await stolen.json()).error, /sam@example\.com/);
  assert.equal((await call(app.baseUrl, "/api/workspaces/wrk_storywell", { cookie: stranger })).status, 404);

  // A preview tells the holder which address it is for, but never claims it is theirs.
  const previewed = await (await call(app.baseUrl, "/api/invitations/preview", { cookie: stranger, method: "POST", body: { token } })).json();
  assert.equal(previewed.matchesYou, false);
});

test("a cancelled or expired invitation is as dead as one that never existed", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");

  const cancelled = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell/invitations", {
    cookie: owner, method: "POST", body: { email: "cancelled@example.com", role: "viewer" },
  })).json();
  const expired = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell/invitations", {
    cookie: owner, method: "POST", body: { email: "expired@example.com", role: "viewer" },
  })).json();

  assert.equal(
    (await call(app.baseUrl, `/api/workspaces/wrk_storywell/invitations/${cancelled.invitation.id}`, { cookie: owner, method: "DELETE" })).status,
    200,
  );
  await app.store.transaction((database) => {
    database.invitations.find((entry) => entry.id === expired.invitation.id).expiresAt = "2020-01-01T00:00:00.000Z";
  });

  for (const [label, created] of [["cancelled", cancelled], ["expired", expired]]) {
    const email = `${label}@example.com`;
    const { cookie } = await register(app.baseUrl, { name: `Test ${label}`, email });
    const token = created.acceptPath.split("/").pop();
    assert.equal((await call(app.baseUrl, "/api/invitations/accept", { cookie, method: "POST", body: { token } })).status, 404, label);
    assert.equal((await call(app.baseUrl, "/api/invitations/preview", { cookie, method: "POST", body: { token } })).status, 404, label);
  }

  // Cancelling something already closed is refused rather than silently repeated.
  assert.equal(
    (await call(app.baseUrl, `/api/workspaces/wrk_storywell/invitations/${cancelled.invitation.id}`, { cookie: owner, method: "DELETE" })).status,
    409,
  );
});

test("a company always keeps an owner", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");
  const members = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell/members", { cookie: owner })).json();
  const only = members.members[0];
  assert.equal(only.role, "owner");
  assert.equal(members.canManage, true);

  const demoted = await call(app.baseUrl, `/api/workspaces/wrk_storywell/members/${only.id}`, { cookie: owner, method: "PATCH", body: { role: "editor" } });
  assert.equal(demoted.status, 409);
  assert.match((await demoted.json()).error, /only owner/i);
  assert.equal(
    (await call(app.baseUrl, `/api/workspaces/wrk_storywell/members/${only.id}`, { cookie: owner, method: "DELETE" })).status,
    409,
  );

  // Ownership transfers by promoting first, then stepping down — never by leaving a gap.
  const created = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell/invitations", {
    cookie: owner, method: "POST", body: { email: "sam@example.com", role: "owner" },
  })).json();
  const { cookie: sam } = await register(app.baseUrl, { name: "Sam Rivera", email: "sam@example.com" });
  await call(app.baseUrl, "/api/invitations/accept", { cookie: sam, method: "POST", body: { token: created.acceptPath.split("/").pop() } });

  const stepDown = await call(app.baseUrl, `/api/workspaces/wrk_storywell/members/${only.id}`, { cookie: owner, method: "PATCH", body: { role: "editor" } });
  assert.equal(stepDown.status, 200);
  assert.equal((await stepDown.json()).role, "editor");

  // And the former owner is now held to what an editor may do.
  assert.equal(
    (await call(app.baseUrl, "/api/workspaces/wrk_storywell/company", { cookie: owner, method: "PATCH", body: { pricing: "x" } })).status,
    403,
  );
  assert.equal(
    (await call(app.baseUrl, "/api/workspaces/wrk_storywell/invitations", { cookie: owner, method: "POST", body: { email: "another@example.com", role: "viewer" } })).status,
    403,
  );
});

test("only an owner changes who has access, but anyone may show themselves out", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");
  const created = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell/invitations", {
    cookie: owner, method: "POST", body: { email: "sam@example.com", role: "editor" },
  })).json();
  const { cookie: sam } = await register(app.baseUrl, { name: "Sam Rivera", email: "sam@example.com" });
  await call(app.baseUrl, "/api/invitations/accept", { cookie: sam, method: "POST", body: { token: created.acceptPath.split("/").pop() } });

  const asSam = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell/members", { cookie: sam })).json();
  assert.equal(asSam.members.length, 2, "everyone in a company can see who else is in it");
  assert.equal(asSam.canManage, false);
  assert.deepEqual(asSam.invitations, [], "an open invitation names someone who is not in the company yet");

  const ownerMembership = asSam.members.find((entry) => entry.role === "owner");
  const samMembership = asSam.members.find((entry) => entry.email === "sam@example.com");

  // An editor cannot promote themselves, demote the owner, or remove anyone else.
  for (const [target, body, method] of [
    [samMembership.id, { role: "owner" }, "PATCH"],
    [ownerMembership.id, { role: "viewer" }, "PATCH"],
    [ownerMembership.id, undefined, "DELETE"],
  ]) {
    const response = await call(app.baseUrl, `/api/workspaces/wrk_storywell/members/${target}`, { cookie: sam, method, body });
    assert.equal(response.status, 403, `${method} ${JSON.stringify(body)} should be refused`);
  }

  // Leaving is theirs to do.
  const left = await call(app.baseUrl, `/api/workspaces/wrk_storywell/members/${samMembership.id}`, { cookie: sam, method: "DELETE" });
  assert.equal(left.status, 200);
  assert.equal((await left.json()).leaving, true);
  assert.equal((await call(app.baseUrl, "/api/workspaces/wrk_storywell", { cookie: sam })).status, 404);
  const history = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell", { cookie: owner })).json();
  assert.ok(history.activity.some((entry) => entry.type === "member-left"));
});

test("invitations refuse the duplicates and the volume that would make them noise", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");

  const first = await call(app.baseUrl, "/api/workspaces/wrk_storywell/invitations", { cookie: owner, method: "POST", body: { email: "sam@example.com", role: "viewer" } });
  assert.equal(first.status, 201);
  const duplicate = await call(app.baseUrl, "/api/workspaces/wrk_storywell/invitations", { cookie: owner, method: "POST", body: { email: "sam@example.com", role: "editor" } });
  assert.equal(duplicate.status, 409);

  // Inviting someone already in the company is refused before a link is ever minted.
  const existing = await call(app.baseUrl, "/api/workspaces/wrk_storywell/invitations", { cookie: owner, method: "POST", body: { email: "founder@formation.local", role: "viewer" } });
  assert.equal(existing.status, 409);
  assert.match((await existing.json()).error, /already part of this company/);

  for (let index = 1; index < MAX_PENDING_INVITATIONS; index += 1) {
    const response = await call(app.baseUrl, "/api/workspaces/wrk_storywell/invitations", { cookie: owner, method: "POST", body: { email: `person${index}@example.com`, role: "viewer" } });
    assert.equal(response.status, 201, `invitation ${index} should have been accepted`);
  }
  const overflow = await call(app.baseUrl, "/api/workspaces/wrk_storywell/invitations", { cookie: owner, method: "POST", body: { email: "one-too-many@example.com", role: "viewer" } });
  assert.equal(overflow.status, 409);
  assert.match((await overflow.json()).error, new RegExp(`${MAX_PENDING_INVITATIONS} invitations waiting`));

  // Bad input never reaches the store.
  for (const body of [{ email: "not-an-email", role: "viewer" }, { email: "ok@example.com", role: "superuser" }, { email: "ok@example.com", role: "viewer", extra: 1 }]) {
    assert.equal((await call(app.baseUrl, "/api/workspaces/wrk_storywell/invitations", { cookie: owner, method: "POST", body })).status, 400, JSON.stringify(body));
  }
});

test("a closed instance still lets in the people it invited, and nobody else", async (t) => {
  const app = await startTestServer({ allowRegistration: false });
  t.after(app.close);
  const owner = await signIn(app.baseUrl, "founder@formation.local");
  const created = await (await call(app.baseUrl, "/api/workspaces/wrk_storywell/invitations", {
    cookie: owner, method: "POST", body: { email: "sam@example.com", role: "reviewer" },
  })).json();
  const token = created.acceptPath.split("/").pop();

  // No invitation, no account.
  assert.equal((await register(app.baseUrl, { name: "Uninvited", email: "nobody@example.com" })).response.status, 404);
  // A real token, but for someone else's address.
  assert.equal((await register(app.baseUrl, { name: "Wrong Person", email: "other@example.com", invitationToken: token })).response.status, 404);
  // A made-up token.
  assert.equal((await register(app.baseUrl, { name: "Sam Rivera", email: "sam@example.com", invitationToken: "not-a-real-token" })).response.status, 404);

  const { response, cookie } = await register(app.baseUrl, { name: "Sam Rivera", email: "sam@example.com", invitationToken: token });
  assert.equal(response.status, 201);
  const joined = await call(app.baseUrl, "/api/invitations/accept", { cookie, method: "POST", body: { token } });
  assert.equal(joined.status, 201);
  assert.equal((await joined.json()).role, "reviewer");
});

test("a stranger cannot read, invite into, or discover a company they were not invited to", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const { cookie: stranger } = await register(app.baseUrl, { name: "Stranger", email: "stranger@example.com" });

  for (const [method, pathname, body] of [
    ["GET", "/api/workspaces/wrk_storywell/members", undefined],
    ["POST", "/api/workspaces/wrk_storywell/invitations", { email: "x@example.com", role: "owner" }],
    ["DELETE", "/api/workspaces/wrk_storywell/invitations/inv_anything", undefined],
    ["PATCH", "/api/workspaces/wrk_storywell/members/mem_storywell_owner", { role: "viewer" }],
    ["DELETE", "/api/workspaces/wrk_storywell/members/mem_storywell_owner", undefined],
  ]) {
    const response = await call(app.baseUrl, pathname, { cookie: stranger, method, body });
    assert.equal(response.status, 404, `${method} ${pathname} leaked the company's existence`);
  }

  const database = await app.store.read();
  assert.equal(database.memberships.filter((entry) => entry.workspaceId === "wrk_storywell").length, 1);
});
