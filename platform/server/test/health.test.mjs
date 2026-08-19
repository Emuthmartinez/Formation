import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFormationServer } from "../app.mjs";
import { HEALTH_STATES, checkHealth, healthStatusCode } from "../domain/health.mjs";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";

/**
 * Whether this instance is actually working.
 *
 * The probe this replaces answered `{ ok: true }` unconditionally — the store could be unreadable
 * and it would still say ok. So the case that matters most here is the one that used to be
 * impossible: **a failing store must produce a failing answer and a 503**, because a probe that
 * cannot report failure tells an operator nothing and keeps a load balancer pointed at an instance
 * that cannot serve a request.
 */

const NOW = "2026-08-07T09:00:00.000Z";

/** Every dependency present and well-configured. */
function healthy(overrides = {}) {
  return {
    readStore: async () => createSeedDatabase(),
    engineAvailability: () => null,
    providerEndpoint: "https://provider.test/draft",
    importRoot: "/somewhere",
    ...overrides,
  };
}

const partNamed = (report, name) => report.parts.find((entry) => entry.name === name);

test("a working instance says so, and every state it can report is one it names", async () => {
  const report = await checkHealth(healthy(), NOW);
  assert.equal(report.status, "ok");
  assert.ok(HEALTH_STATES.includes(report.status));
  assert.equal(healthStatusCode(report.status), 200);
  assert.equal(report.time, NOW);
  assert.ok(report.parts.length >= 4);
});

test("a store that cannot be read makes the instance failing, and the code says so", async () => {
  const thrown = await checkHealth(healthy({ readStore: async () => { throw new Error("EACCES: permission denied, open '/srv/formation/data/formation.json'"); } }), NOW);
  assert.equal(thrown.status, "failing", "this is the case the old probe could not report at all");
  assert.equal(healthStatusCode(thrown.status), 503, "a load balancer must be able to take this instance out");
  assert.equal(partNamed(thrown, "store").state, "failing");

  // A store that answers with something that is not a Formation database is equally unfit.
  const wrongShape = await checkHealth(healthy({ readStore: async () => ({ nothing: true }) }), NOW);
  assert.equal(wrongShape.status, "failing");
});

test("nothing an anonymous caller should not know reaches the answer", async () => {
  const report = await checkHealth(
    healthy({
      readStore: async () => {
        throw new Error("EACCES: permission denied, open '/srv/formation/data/formation.json'");
      },
    }),
    NOW,
  );
  const serialized = JSON.stringify(report);
  for (const leak of ["/srv/formation", "EACCES", "permission denied", "formation.json", "provider.test"]) {
    assert.ok(!serialized.includes(leak), `the health answer carried ${leak}`);
  }
});

test("a capability this deployment does not have is a fact, not a fault", async () => {
  const report = await checkHealth(
    healthy({
      engineAvailability: () => "Formation's launch automation is not installed on this server.",
      providerEndpoint: "",
      importRoot: null,
    }),
    NOW,
  );
  assert.equal(report.status, "ok", "reporting an instance as broken for being configured the way its operator configured it teaches them to ignore the probe");
  assert.equal(healthStatusCode(report.status), 200);
  for (const name of ["launch-engine", "drafting-provider", "import-source"]) {
    assert.equal(partNamed(report, name).state, "not-configured");
    assert.ok(partNamed(report, name).detail.length > 20, `${name} must say what is absent in a sentence`);
  }
});

test("absent and broken are different answers", async () => {
  const absent = await checkHealth(healthy({ providerEndpoint: undefined }), NOW);
  assert.equal(partNamed(absent, "drafting-provider").state, "not-configured");
  assert.equal(absent.status, "ok");

  const broken = await checkHealth(healthy({ providerEndpoint: "not a url at all" }), NOW);
  assert.equal(partNamed(broken, "drafting-provider").state, "misconfigured");
  assert.equal(broken.status, "degraded", "a mistake somebody should fix is not the same as a choice somebody made");
  assert.equal(healthStatusCode(broken.status), 200, "degraded still serves — the store is fine");
});

test("a non-HTTPS drafting endpoint is a mistake in production and a choice in development", async (t) => {
  const original = process.env.NODE_ENV;
  t.after(() => {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  });

  process.env.NODE_ENV = "development";
  assert.equal(partNamed(await checkHealth(healthy({ providerEndpoint: "http://localhost:9000/draft" }), NOW), "drafting-provider").state, "ok");

  process.env.NODE_ENV = "production";
  assert.equal(partNamed(await checkHealth(healthy({ providerEndpoint: "http://provider.test/draft" }), NOW), "drafting-provider").state, "misconfigured");
});

test("the route answers without a session and reports the real instance", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-health-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();
  const { server } = createFormationServer({ store, allowDemoAuth: true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.equal(report.service, "formation");
  assert.ok(HEALTH_STATES.includes(report.status));
  assert.ok(report.parts.some((entry) => entry.name === "store" && entry.state === "ok"));
  assert.ok(!JSON.stringify(report).includes(directory), "the answer must not name where this instance keeps its data");
});
