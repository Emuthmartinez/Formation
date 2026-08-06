import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFormationServer } from "../app.mjs";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";

async function startTestServer({ distDir } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-api-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();
  const { server } = createFormationServer({ store, allowDemoAuth: true, distDir });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    store,
    baseUrl,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function login(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "founder@formation.local" }),
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

function request(baseUrl, pathname, { cookie, method = "GET", body } = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test("API requires a session and returns a coherent workspace snapshot", async (t) => {
  const app = await startTestServer();
  t.after(app.close);

  assert.equal((await request(app.baseUrl, "/api/workspaces/wrk_storywell")).status, 401);
  const cookie = await login(app.baseUrl);
  const response = await request(app.baseUrl, "/api/workspaces/wrk_storywell", { cookie });
  assert.equal(response.status, 200);
  const snapshot = await response.json();
  assert.equal(snapshot.workspace.name, "Storywell");
  assert.equal(snapshot.workspace.workstreams.length, 8);
  assert.equal(snapshot.contradictions[0].key, "pricing.model");
  assert.ok(snapshot.readiness.score >= 0 && snapshot.readiness.score <= 100);
});

test("workspace updates persist company context and editable deliverable versions", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const cookie = await login(app.baseUrl);

  const workspaceResponse = await request(app.baseUrl, "/api/workspaces/wrk_storywell", {
    cookie,
    method: "PATCH",
    body: {
      name: "Storywell Studio",
      stage: "validation",
      launchTarget: "2026-11-15",
      founder: { name: "Maya Chen", role: "Founder & CEO", weeklyHours: 28 },
    },
  });
  assert.equal(workspaceResponse.status, 200);

  const companyResponse = await request(app.baseUrl, "/api/workspaces/wrk_storywell/company", {
    cookie,
    method: "PATCH",
    body: { positioning: "The private family story archive people actually finish." },
  });
  assert.equal(companyResponse.status, 200);

  const artifactResponse = await request(app.baseUrl, "/api/workspaces/wrk_storywell/artifacts/art_customer_brief", {
    cookie,
    method: "PATCH",
    body: {
      status: "reviewed",
      confidence: 72,
      sourceClaimIds: ["clm_01", "clm_04"],
      linkedDecisionIds: ["dec_01"],
      sections: [{ id: "sec_customer", title: "Primary customer", body: "Adult children acting after a family milestone." }],
    },
  });
  assert.equal(artifactResponse.status, 200);
  const artifact = await artifactResponse.json();
  assert.equal(artifact.version, 3);
  assert.equal(artifact.status, "reviewed");
  assert.equal(artifact.confidence, 72);
  assert.deepEqual(artifact.sourceClaimIds, ["clm_01", "clm_04"]);
  assert.deepEqual(artifact.linkedDecisionIds, ["dec_01"]);

  const snapshot = await (await request(app.baseUrl, "/api/workspaces/wrk_storywell", { cookie })).json();
  assert.equal(snapshot.workspace.name, "Storywell Studio");
  assert.equal(snapshot.workspace.stage, "validation");
  assert.equal(snapshot.workspace.launchTarget, "2026-11-15");
  assert.equal(snapshot.workspace.founder.weeklyHours, 28);
  assert.match(snapshot.workspace.company.positioning, /private family story archive/);
  assert.equal(snapshot.artifacts.find((entry) => entry.id === "art_customer_brief").version, 3);
  const versions = snapshot.artifactVersions.filter((entry) => entry.artifactId === "art_customer_brief");
  assert.equal(versions.length, 2);
  assert.deepEqual(versions.map((entry) => entry.version), [3, 2]);
  assert.equal(versions[0].createdBy, "Maya Chen");
  assert.notEqual(versions[0].sections[0].body, versions[1].sections[0].body);
});

test("resolving a contradictory claim clears the contradiction from the command center", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const cookie = await login(app.baseUrl);

  const before = await (await request(app.baseUrl, "/api/workspaces/wrk_storywell", { cookie })).json();
  assert.equal(before.contradictions.length, 1);

  const response = await request(app.baseUrl, "/api/workspaces/wrk_storywell/claims/clm_03", {
    cookie,
    method: "PATCH",
    body: { status: "rejected", evidence: ["Founder rejected lifetime pricing after customer interviews."] },
  });
  assert.equal(response.status, 200);

  const after = await (await request(app.baseUrl, "/api/workspaces/wrk_storywell", { cookie })).json();
  assert.equal(after.contradictions.length, 0);
});

test("onboarding creates a new authorized workspace with seeded next actions", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const cookie = await login(app.baseUrl);

  const response = await request(app.baseUrl, "/api/workspaces", {
    cookie,
    method: "POST",
    body: {
      name: "Relay",
      founderName: "Maya",
      oneLiner: "Relay helps neighborhood organizations coordinate volunteers.",
      targetCustomer: "Volunteer coordinators at local nonprofits",
      problem: "Volunteer scheduling fragments across texts and spreadsheets.",
      solution: "A shared coordination workspace with role-aware reminders.",
      currentGoal: "Validate weekly use with six organizations.",
    },
  });
  assert.equal(response.status, 201);
  const workspace = await response.json();

  const snapshotResponse = await request(app.baseUrl, `/api/workspaces/${workspace.id}`, { cookie });
  assert.equal(snapshotResponse.status, 200);
  const snapshot = await snapshotResponse.json();
  assert.equal(snapshot.artifacts[0].type, "business-snapshot");
  assert.equal(snapshot.tasks[0].priority, "critical");
});

test("generation jobs become structured editable artifacts linked to the workstream", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const cookie = await login(app.baseUrl);

  const enqueue = await request(app.baseUrl, "/api/workspaces/wrk_storywell/generate", {
    cookie,
    method: "POST",
    body: {
      workstreamId: "business-model",
      artifactType: "business-model",
      instruction: "Frame annual and lifetime offers as testable hypotheses.",
    },
  });
  assert.equal(enqueue.status, 202);
  const job = await enqueue.json();

  let completed;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await request(app.baseUrl, `/api/workspaces/wrk_storywell/jobs/${job.id}`, { cookie });
    const current = await response.json();
    if (current.status === "completed") {
      completed = current;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.ok(completed, "generation job should complete");

  const snapshot = await (await request(app.baseUrl, "/api/workspaces/wrk_storywell", { cookie })).json();
  const artifact = snapshot.artifacts.find((entry) => entry.id === completed.artifactId);
  assert.ok(artifact);
  assert.equal(artifact.type, "business-model");
  assert.ok(artifact.sections.length >= 3);
  assert.ok(artifact.sourceClaimIds.length > 0);
  assert.ok(artifact.linkedDecisionIds.length > 0);
  const generatedVersions = snapshot.artifactVersions.filter((entry) => entry.artifactId === artifact.id);
  assert.equal(generatedVersions.length, 1);
  assert.deepEqual(generatedVersions[0].sourceClaimIds, artifact.sourceClaimIds);
  assert.ok(snapshot.workspace.workstreams.find((entry) => entry.id === "business-model").deliverableIds.includes(artifact.id));
  assert.equal(snapshot.claims.find((entry) => entry.evidence?.includes(artifact.id))?.key, null);
});

test("workspace authorization fails closed when membership is absent", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const cookie = await login(app.baseUrl);
  await app.store.transaction((database) => {
    database.memberships = [];
  });

  const response = await request(app.baseUrl, "/api/workspaces/wrk_storywell", { cookie });
  assert.equal(response.status, 404);
});

test("API rejects impossible dates, empty artifacts, invalid workstreams, and structured claim values", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const cookie = await login(app.baseUrl);
  const original = await (await request(app.baseUrl, "/api/workspaces/wrk_storywell", { cookie })).json();

  const impossibleDate = await request(app.baseUrl, "/api/workspaces/wrk_storywell", {
    cookie,
    method: "PATCH",
    body: { launchTarget: "2026-02-31" },
  });
  assert.equal(impossibleDate.status, 400);

  const emptyArtifact = await request(app.baseUrl, "/api/workspaces/wrk_storywell/artifacts/art_customer_brief", {
    cookie,
    method: "PATCH",
    body: { sections: [] },
  });
  assert.equal(emptyArtifact.status, 400);

  const invalidWorkstream = await request(app.baseUrl, "/api/workspaces/wrk_storywell/generate", {
    cookie,
    method: "POST",
    body: { workstreamId: "not-a-workstream" },
  });
  assert.equal(invalidWorkstream.status, 400);

  const objectClaim = await request(app.baseUrl, "/api/workspaces/wrk_storywell/claims", {
    cookie,
    method: "POST",
    body: {
      workstreamId: "strategy",
      kind: "assumption",
      statement: "The claim value should stay comparable.",
      value: { nested: true },
    },
  });
  assert.equal(objectClaim.status, 400);

  const snapshot = await (await request(app.baseUrl, "/api/workspaces/wrk_storywell", { cookie })).json();
  assert.equal(snapshot.workspace.launchTarget, original.workspace.launchTarget);
  assert.ok(snapshot.artifacts.find((entry) => entry.id === "art_customer_brief").sections.length > 0);
});


test("API rejects no-op mutations, out-of-range integers, invalid statuses, and cross-workspace lineage", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const cookie = await login(app.baseUrl);

  const noOp = await request(app.baseUrl, "/api/workspaces/wrk_storywell/company", {
    cookie,
    method: "PATCH",
    body: { unexpected: "ignored" },
  });
  assert.equal(noOp.status, 400);

  const invalidHours = await request(app.baseUrl, "/api/workspaces/wrk_storywell", {
    cookie,
    method: "PATCH",
    body: { founder: { weeklyHours: 101 } },
  });
  assert.equal(invalidHours.status, 400);

  const invalidStatus = await request(app.baseUrl, "/api/workspaces/wrk_storywell/decisions", {
    cookie,
    method: "POST",
    body: {
      workstreamId: "strategy",
      title: "Invalid status",
      decision: "This should fail.",
      rationale: "The API should reject unsupported vocabulary.",
      status: "magically-done",
    },
  });
  assert.equal(invalidStatus.status, 400);

  const invalidLineage = await request(app.baseUrl, "/api/workspaces/wrk_storywell/artifacts/art_customer_brief", {
    cookie,
    method: "PATCH",
    body: { sourceClaimIds: ["clm_from_another_workspace"] },
  });
  assert.equal(invalidLineage.status, 400);
});

test("static application routes use strict security headers and missing assets fail closed", async (t) => {
  const distDir = await mkdtemp(path.join(os.tmpdir(), "formation-dist-"));
  await mkdir(path.join(distDir, "assets"), { recursive: true });
  await writeFile(path.join(distDir, "index.html"), "<!doctype html><title>Formation</title><div id=\"root\"></div>");
  await writeFile(path.join(distDir, "assets/app.js"), "console.log('formation');");
  const app = await startTestServer({ distDir });
  t.after(app.close);

  const route = await fetch(`${app.baseUrl}/business`);
  assert.equal(route.status, 200);
  assert.match(await route.text(), /Formation/);
  assert.match(route.headers.get("content-security-policy"), /style-src 'self'/);
  assert.equal(route.headers.get("x-frame-options"), "DENY");
  assert.equal(route.headers.get("cache-control"), "no-cache");

  const asset = await fetch(`${app.baseUrl}/assets/app.js`);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get("cache-control"), /immutable/);

  const missingAsset = await fetch(`${app.baseUrl}/assets/missing.js`);
  assert.equal(missingAsset.status, 404);
});

test("malformed cookies and cross-site browser mutations fail without server errors", async (t) => {
  const app = await startTestServer();
  t.after(app.close);

  const malformed = await fetch(`${app.baseUrl}/api/session`, { headers: { cookie: "formation_session=%E0%A4%A" } });
  assert.equal(malformed.status, 401);

  const crossSite = await fetch(`${app.baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "sec-fetch-site": "cross-site" },
    body: JSON.stringify({ email: "founder@formation.local", password: "incorrect-password" }),
  });
  assert.equal(crossSite.status, 403);
});
