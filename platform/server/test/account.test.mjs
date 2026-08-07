import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFormationServer } from "../app.mjs";
import { describeDevice } from "../auth.mjs";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";

const PASSWORD = "a-long-enough-password";

async function startTestServer() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-account-"));
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

function call(baseUrl, pathname, { cookie, method = "GET", body, userAgent } = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(userAgent ? { "user-agent": userAgent } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function signIn(baseUrl, { email = "sam@example.com", password = PASSWORD, userAgent } = {}) {
  const response = await call(baseUrl, "/api/auth/login", { method: "POST", body: { email, password }, userAgent });
  assert.equal(response.status, 200, `sign in failed: ${await response.text()}`);
  return response.headers.get("set-cookie").split(";")[0];
}

async function register(baseUrl, { email = "sam@example.com", userAgent } = {}) {
  const response = await call(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { name: "Sam Rivera", email, password: PASSWORD },
    userAgent,
  });
  assert.equal(response.status, 201);
  return response.headers.get("set-cookie").split(";")[0];
}

test("signing in on another device does not sign you out of this one", async (t) => {
  const app = await startTestServer();
  t.after(app.close);

  const laptop = await register(app.baseUrl, { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36" });
  assert.equal((await call(app.baseUrl, "/api/session", { cookie: laptop })).status, 200);

  const phone = await signIn(app.baseUrl, { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17.0 Mobile/15E148 Safari/604.1" });
  assert.equal((await call(app.baseUrl, "/api/session", { cookie: phone })).status, 200);
  assert.equal(
    (await call(app.baseUrl, "/api/session", { cookie: laptop })).status,
    200,
    "the laptop was signed out by a sign-in on the phone",
  );

  const { sessions } = await (await call(app.baseUrl, "/api/account/sessions", { cookie: laptop })).json();
  assert.equal(sessions.length, 2);
  // Each device is recognisable, and the one asking knows which it is.
  assert.deepEqual(sessions.map((entry) => entry.device).sort(), ["Chrome on macOS", "Safari on iPhone"]);
  assert.equal(sessions.filter((entry) => entry.current).length, 1);
  assert.equal(sessions.find((entry) => entry.current).device, "Chrome on macOS");
});

test("a device label describes the device and nothing more", () => {
  const cases = [
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36", "Chrome on macOS"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36 Edg/120", "Edge on Windows"],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0", "Firefox on Linux"],
    ["Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605 Version/17.0 Safari/604.1", "Safari on iPad"],
    ["Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36", "Chrome on Android"],
    ["curl/8.4.0", "An unrecognised device"],
    ["", "An unrecognised device"],
  ];
  for (const [userAgent, expected] of cases) {
    assert.equal(describeDevice({ headers: { "user-agent": userAgent } }), expected, userAgent);
  }
  assert.equal(describeDevice(undefined), "An unrecognised device");

  // The raw string is a fingerprint; only the label is kept.
  const label = describeDevice({ headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.6099.234 Safari/537.36" } });
  assert.ok(!label.includes("120.0.6099.234"));
  assert.ok(!label.includes("AppleWebKit"));
});

test("a device can be signed out from another device, and signing out here ends the session cleanly", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const laptop = await register(app.baseUrl, { userAgent: "Chrome/120 (Macintosh; Intel Mac OS X)" });
  const phone = await signIn(app.baseUrl, { userAgent: "Mozilla/5.0 (iPhone) Safari/604.1" });

  const { sessions } = await (await call(app.baseUrl, "/api/account/sessions", { cookie: laptop })).json();
  const phoneSession = sessions.find((entry) => !entry.current);

  const revoked = await call(app.baseUrl, `/api/account/sessions/${phoneSession.id}`, { cookie: laptop, method: "DELETE" });
  assert.equal(revoked.status, 200);
  assert.deepEqual(await revoked.json(), { revoked: 1, endedCurrentSession: false });
  assert.equal((await call(app.baseUrl, "/api/session", { cookie: phone })).status, 401, "the phone stayed signed in");
  assert.equal((await call(app.baseUrl, "/api/session", { cookie: laptop })).status, 200);

  // Signing out the device you are holding is allowed, and the cookie goes with it.
  const own = await (await call(app.baseUrl, "/api/account/sessions", { cookie: laptop })).json();
  const here = own.sessions.find((entry) => entry.current);
  const endedHere = await call(app.baseUrl, `/api/account/sessions/${here.id}`, { cookie: laptop, method: "DELETE" });
  assert.equal(endedHere.status, 200);
  assert.equal((await endedHere.json()).endedCurrentSession, true);
  assert.match(endedHere.headers.get("set-cookie") ?? "", /formation_session=;/);
  assert.equal((await call(app.baseUrl, "/api/session", { cookie: laptop })).status, 401);
});

test("sign out everywhere else leaves exactly the device you are on", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const laptop = await register(app.baseUrl, { userAgent: "Chrome/120 (Macintosh)" });
  const phone = await signIn(app.baseUrl, { userAgent: "Mozilla/5.0 (iPhone) Safari/604.1" });
  const tablet = await signIn(app.baseUrl, { userAgent: "Mozilla/5.0 (iPad) Safari/604.1" });

  const result = await call(app.baseUrl, "/api/account/sessions", { cookie: phone, method: "DELETE" });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { revoked: 2 });

  assert.equal((await call(app.baseUrl, "/api/session", { cookie: phone })).status, 200);
  assert.equal((await call(app.baseUrl, "/api/session", { cookie: laptop })).status, 401);
  assert.equal((await call(app.baseUrl, "/api/session", { cookie: tablet })).status, 401);
});

test("one account never sees or ends another account's devices", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const sam = await register(app.baseUrl, { email: "sam@example.com", userAgent: "Chrome/120 (Macintosh)" });
  const dana = await register(app.baseUrl, { email: "dana@example.com", userAgent: "Firefox/121 (X11; Linux)" });

  const samSessions = await (await call(app.baseUrl, "/api/account/sessions", { cookie: sam })).json();
  const danaSessions = await (await call(app.baseUrl, "/api/account/sessions", { cookie: dana })).json();
  assert.equal(samSessions.sessions.length, 1);
  assert.equal(danaSessions.sessions.length, 1);

  // Someone else's session id is not found, not forbidden — the same answer as one that never was.
  const stolen = await call(app.baseUrl, `/api/account/sessions/${danaSessions.sessions[0].id}`, { cookie: sam, method: "DELETE" });
  assert.equal(stolen.status, 404);
  assert.equal((await call(app.baseUrl, "/api/session", { cookie: dana })).status, 200);

  // And signing out everywhere else is scoped to the account that asked.
  await call(app.baseUrl, "/api/account/sessions", { cookie: sam, method: "DELETE" });
  assert.equal((await call(app.baseUrl, "/api/session", { cookie: dana })).status, 200);
});

test("changing a password proves the old one, keeps you here, and signs out everywhere else", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const laptop = await register(app.baseUrl, { userAgent: "Chrome/120 (Macintosh)" });
  const phone = await signIn(app.baseUrl, { userAgent: "Mozilla/5.0 (iPhone) Safari/604.1" });

  // A session someone walked up to is not enough to take the account.
  const wrong = await call(app.baseUrl, "/api/account/password", {
    cookie: laptop, method: "POST", body: { currentPassword: "not-the-password", newPassword: "a-brand-new-password" },
  });
  assert.equal(wrong.status, 403);
  assert.match((await wrong.json()).error, /current password is not correct/);

  for (const body of [
    { currentPassword: PASSWORD, newPassword: "short" },
    { currentPassword: PASSWORD, newPassword: PASSWORD },
    { currentPassword: PASSWORD, newPassword: "a-brand-new-password", extra: 1 },
  ]) {
    const refused = await call(app.baseUrl, "/api/account/password", { cookie: laptop, method: "POST", body });
    assert.equal(refused.status, 400, JSON.stringify(body));
  }

  const changed = await call(app.baseUrl, "/api/account/password", {
    cookie: laptop, method: "POST", body: { currentPassword: PASSWORD, newPassword: "a-brand-new-password" },
  });
  assert.equal(changed.status, 200);
  assert.deepEqual(await changed.json(), { changed: true, signedOutElsewhere: 1 });

  // The device that made the change stays signed in; every other one does not.
  assert.equal((await call(app.baseUrl, "/api/session", { cookie: laptop })).status, 200);
  assert.equal((await call(app.baseUrl, "/api/session", { cookie: phone })).status, 401);

  // The old password is gone and the new one works.
  assert.equal((await call(app.baseUrl, "/api/auth/login", { method: "POST", body: { email: "sam@example.com", password: PASSWORD } })).status, 401);
  assert.equal((await call(app.baseUrl, "/api/auth/login", { method: "POST", body: { email: "sam@example.com", password: "a-brand-new-password" } })).status, 200);
});

test("guessing the current password from a signed-in session is limited like any other guessing", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const cookie = await register(app.baseUrl, { userAgent: "Chrome/120 (Macintosh)" });

  let sawLimit = false;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await call(app.baseUrl, "/api/account/password", {
      cookie, method: "POST", body: { currentPassword: `guess-${attempt}`, newPassword: "a-brand-new-password" },
    });
    if (response.status === 429) {
      sawLimit = true;
      assert.ok(response.headers.get("retry-after"));
      break;
    }
    assert.equal(response.status, 403);
  }
  assert.ok(sawLimit, "unlimited password guesses were allowed from a signed-in session");

  // The password itself never changed.
  assert.equal((await call(app.baseUrl, "/api/auth/login", { method: "POST", body: { email: "sam@example.com", password: PASSWORD } })).status, 200);
});

test("an account cannot accumulate sessions without limit", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const first = await register(app.baseUrl, { userAgent: "Chrome/120 (Macintosh)" });

  for (let attempt = 0; attempt < 12; attempt += 1) {
    await signIn(app.baseUrl, { userAgent: `Chrome/120 (Windows NT 10.0) build-${attempt}` });
  }
  const latest = await signIn(app.baseUrl, { userAgent: "Firefox/121 (X11; Linux)" });
  const { sessions } = await (await call(app.baseUrl, "/api/account/sessions", { cookie: latest })).json();
  assert.ok(sessions.length <= 10, `${sessions.length} sessions survived the bound`);
  // The device that has gone longest unused is the one that went.
  assert.equal((await call(app.baseUrl, "/api/session", { cookie: first })).status, 401);
});
