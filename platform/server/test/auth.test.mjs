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

test("credential login adds a session, keeps the others, and returns generic failures", async (t) => {
  const app = await startTestServer();
  t.after(app.close);

  const registration = await post(app.baseUrl, "/api/auth/register", {
    name: "Avery Founder",
    email: "avery@example.com",
    password: "correct horse battery staple",
  });
  assert.equal(registration.status, 201);
  const firstDevice = registration.headers.get("set-cookie").split(";")[0];

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

  // Signing in somewhere new adds a session rather than replacing the ones that exist: the device
  // that registered the account is still signed in.
  const database = await app.store.read();
  const user = database.users.find((entry) => entry.email === "avery@example.com");
  assert.equal(database.sessions.filter((entry) => entry.userId === user.id).length, 2);
  const stillHere = await fetch(`${app.baseUrl}/api/session`, { headers: { cookie: firstDevice } });
  assert.equal(stillHere.status, 200);

  // A failed sign-in creates nothing.
  await post(app.baseUrl, "/api/auth/login", { email: "avery@example.com", password: "still wrong" });
  const after = await app.store.read();
  assert.equal(after.sessions.filter((entry) => entry.userId === user.id).length, 2);
});

test("an attempt is spent when it is made, not after it turns out to be wrong", () => {
  const key = "client:founder@example.com";
  const limiter = new AuthRateLimiter({ windowMs: 60_000, maximumFailures: 2 });

  // Claiming counts immediately, so callers that check first and count later — the shape that let
  // a whole concurrent wave through — cannot exist: there is nothing to count later.
  limiter.claim(key);
  limiter.claim(key);
  assert.throws(
    () => limiter.claim(key),
    (error) => error.status === 429 && error.metadata.retryAfterSeconds > 0,
  );

  // A caller that turned out to be legitimate gives its attempt back.
  limiter.release(key);
  assert.doesNotThrow(() => limiter.claim(key));
  assert.throws(() => limiter.claim(key), (error) => error.status === 429);

  // Releasing never goes below zero, and never resurrects a bucket that was cleared.
  for (let index = 0; index < 10; index += 1) limiter.release(key);
  limiter.claim(key);
  limiter.claim(key);
  assert.throws(() => limiter.claim(key), (error) => error.status === 429);

  limiter.clear(key);
  assert.doesNotThrow(() => limiter.claim(key));
});

test("a wave of concurrent guesses cannot outrun the bucket", async () => {
  const limiter = new AuthRateLimiter({ windowMs: 60_000, maximumFailures: 7 });
  const key = "client:victim@example.com";

  // Each guess claims, then does slow work, then fails — exactly the shape of a password check.
  const attempt = async () => {
    try {
      limiter.claim(key);
    } catch {
      return "refused";
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
    return "checked";
  };

  const wave = await Promise.all(Array.from({ length: 40 }, attempt));
  assert.equal(wave.filter((entry) => entry === "checked").length, 7);
  assert.equal(wave.filter((entry) => entry === "refused").length, 33);
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
