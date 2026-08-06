import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFormationServer } from "../app.mjs";
import { AuthRateLimiter, assertSameOrigin } from "../auth.mjs";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";

async function startTestServer() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-auth-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();
  const { server } = createFormationServer({ store, allowDemoAuth: true, allowRegistration: true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    store,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function post(baseUrl, pathname, body, cookie) {
  return fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

test("credential registration stores a scrypt hash and creates a usable session", async (t) => {
  const app = await startTestServer();
  t.after(app.close);

  const registration = await post(app.baseUrl, "/api/auth/register", {
    name: "Avery Founder",
    email: "avery@example.com",
    password: "correct horse battery staple",
  });
  assert.equal(registration.status, 201);
  const cookie = registration.headers.get("set-cookie").split(";")[0];
  const body = await registration.json();
  assert.equal(body.user.email, "avery@example.com");
  assert.equal("passwordHash" in body.user, false);

  const session = await fetch(`${app.baseUrl}/api/session`, { headers: { cookie } });
  assert.equal(session.status, 200);
  assert.deepEqual((await session.json()).workspaces, []);

  const database = await app.store.read();
  const user = database.users.find((entry) => entry.email === "avery@example.com");
  assert.match(user.passwordHash, /^scrypt\$/);
  assert.equal(user.passwordHash.includes("correct horse battery staple"), false);
});

test("credential login rotates the session and returns generic failures", async (t) => {
  const app = await startTestServer();
  t.after(app.close);

  const registration = await post(app.baseUrl, "/api/auth/register", {
    name: "Avery Founder",
    email: "avery@example.com",
    password: "correct horse battery staple",
  });
  assert.equal(registration.status, 201);

  const wrongPassword = await post(app.baseUrl, "/api/auth/login", {
    email: "avery@example.com",
    password: "a completely wrong password",
  });
  const unknownAccount = await post(app.baseUrl, "/api/auth/login", {
    email: "missing@example.com",
    password: "a completely wrong password",
  });
  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownAccount.status, 401);
  assert.equal((await wrongPassword.json()).error, "Email or password is incorrect.");
  assert.equal((await unknownAccount.json()).error, "Email or password is incorrect.");

  const login = await post(app.baseUrl, "/api/auth/login", {
    email: "avery@example.com",
    password: "correct horse battery staple",
  });
  assert.equal(login.status, 200);
  assert.ok(login.headers.get("set-cookie"));

  const database = await app.store.read();
  const user = database.users.find((entry) => entry.email === "avery@example.com");
  assert.equal(database.sessions.filter((entry) => entry.userId === user.id).length, 1);
});

test("authentication limiter blocks repeated failures and resets after success", () => {
  const limiter = new AuthRateLimiter({ windowMs: 60_000, maximumFailures: 2 });
  limiter.assertAllowed("client:founder@example.com");
  limiter.recordFailure("client:founder@example.com");
  limiter.recordFailure("client:founder@example.com");
  assert.throws(
    () => limiter.assertAllowed("client:founder@example.com"),
    (error) => error.status === 429 && error.metadata.retryAfterSeconds > 0,
  );
  limiter.clear("client:founder@example.com");
  assert.doesNotThrow(() => limiter.assertAllowed("client:founder@example.com"));
});

test("origin validation ignores forged proxy headers unless proxy trust is enabled", () => {
  const previous = process.env.TRUST_PROXY;
  delete process.env.TRUST_PROXY;
  try {
    const request = {
      method: "POST",
      headers: {
        origin: ["https", "://", "attacker.example"].join(""),
        host: "formation.example",
        "x-forwarded-host": "attacker.example",
      },
    };
    assert.throws(
      () => assertSameOrigin(request),
      (error) => error.status === 403 && /Cross-origin/.test(error.message),
    );
  } finally {
    if (previous === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previous;
  }
});
