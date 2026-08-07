import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { GenerationWorker } from "../generation.mjs";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";

test("a company's hourly draft spend is bounded, per company, and recovers as the window moves", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-generation-limit-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();
  const worker = new GenerationWorker(store);

  const priorJob = (workspaceId, minutesAgo, index) => ({
    id: `job_prior_${workspaceId}_${index}`,
    workspaceId,
    workstreamId: "market",
    artifactType: null,
    instruction: "",
    requestedBy: "Maya Chen",
    status: "completed",
    createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    completedAt: null,
    artifactId: null,
    error: null,
  });

  // A second company, so the bound can be shown to be per company rather than global.
  await store.transaction((database) => {
    const clone = structuredClone(database.workspaces[0]);
    clone.id = "wrk_second";
    clone.slug = "second";
    database.workspaces.push(clone);
    for (let index = 0; index < 30; index += 1) database.jobs.push(priorJob("wrk_storywell", 10, index));
  });

  const request = { workspaceId: "wrk_storywell", workstreamId: "market", artifactType: null, instruction: "", requestedBy: "Maya Chen" };
  await assert.rejects(worker.enqueue(request), (error) => {
    assert.equal(error.status, 429);
    assert.match(error.message, /30 drafts in the past hour/);
    return true;
  });

  // The bound is the company's own, not the product's.
  const other = await worker.enqueue({ ...request, workspaceId: "wrk_second" });
  assert.equal(other.status, "queued");

  // Spend that has aged out of the window no longer counts against the company. The bound counts
  // requests, not outcomes, so completed drafts still occupy the window until it moves past them.
  await store.transaction((database) => {
    for (const job of database.jobs) {
      if (job.id.startsWith("job_prior_wrk_storywell")) job.createdAt = new Date(Date.now() - 61 * 60_000).toISOString();
    }
  });
  const afterWindow = await worker.enqueue(request);
  assert.equal(afterWindow.status, "queued");
});

test("generation worker recovers an interrupted durable job", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-generation-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();
  const now = new Date().toISOString();
  await store.transaction((database) => {
    database.jobs.push({
      id: "job_interrupted",
      workspaceId: "wrk_storywell",
      workstreamId: "market",
      artifactType: "market-brief",
      instruction: "Recover this interrupted job.",
      requestedBy: "Maya Chen",
      status: "processing",
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      artifactId: null,
      error: null,
    });
  });

  const worker = new GenerationWorker(store);
  worker.start();
  t.after(() => worker.stop());

  let completed;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const database = await store.read();
    completed = database.jobs.find((job) => job.id === "job_interrupted");
    if (completed?.status === "completed") break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  assert.equal(completed?.status, "completed");
  assert.ok(completed?.artifactId);
  const database = await store.read();
  assert.ok(database.artifacts.some((artifact) => artifact.id === completed.artifactId));
  assert.ok(database.artifactVersions.some((version) => version.artifactId === completed.artifactId));
});

/**
 * What a founder is left with when the drafting service cannot answer.
 *
 * The rule the two cases below hold: an outage never produces a document. Handing back the
 * built-in deterministic draft would look exactly like the one that was asked for and would not be
 * it, and half-writing one would be worse still.
 */
async function workerWith(provider) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-generation-outage-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();
  return { store, worker: new GenerationWorker(store, { provider }) };
}

const usableAnswer = JSON.stringify({ title: "Positioning brief", summary: "A summary.", confidence: 72, sections: [{ title: "Promise", body: "The promise." }] });

function fixedTime() {
  let current = 0;
  return { clock: () => current, sleep: async (ms) => { current += ms; } };
}

/**
 * Waits for the durable queue to settle this job. `enqueue` already kicks the worker on a
 * microtask, so calling `kick()` again returns immediately against the running drain — reading the
 * store at that moment catches the job mid-flight rather than finished.
 */
async function settle(store, jobId) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const database = await store.read();
    const job = database.jobs.find((entry) => entry.id === jobId);
    if (job && ["completed", "failed"].includes(job.status)) return database;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return store.read();
}

test("a drafting service that cannot be reached fails the request and writes nothing", async (t) => {
  process.env.FORMATION_AI_ENDPOINT = "https://provider.test/draft";
  t.after(() => delete process.env.FORMATION_AI_ENDPOINT);

  const { store, worker } = await workerWith({
    fetchImpl: async () => { throw new Error("getaddrinfo ENOTFOUND provider.test"); },
    budget: { attempts: 2, attemptTimeoutMs: 1_000, totalMs: 5_000, firstBackoffMs: 10, backoffFactor: 2, maxBackoffMs: 20, responseLimitBytes: 1_000_000 },
    ...fixedTime(),
  });

  const before = await store.read();
  const job = await worker.enqueue({ workspaceId: "wrk_storywell", workstreamId: "market", artifactType: null, instruction: "", requestedBy: "Maya Chen" });
  const after = await settle(store, job.id);
  const settled = after.jobs.find((entry) => entry.id === job.id);
  assert.equal(settled.status, "failed");
  assert.equal(settled.outcome, "unreachable");
  assert.match(settled.error, /could not reach the drafting service/);
  assert.match(settled.error, /Nothing was written/);
  assert.ok(!/\b5\d\d\b|ENOTFOUND/.test(settled.error), "a founder must not be shown a status code or a system error");
  assert.equal(after.artifacts.length, before.artifacts.length, "an outage must not create a deliverable");
  assert.equal(after.artifactVersions.length, before.artifactVersions.length);
  assert.ok(settled.diagnostics.attempts >= 1);
});

test("a drafting service that answers is written once, with what the answer cost recorded", async (t) => {
  process.env.FORMATION_AI_ENDPOINT = "https://provider.test/draft";
  t.after(() => delete process.env.FORMATION_AI_ENDPOINT);

  let calls = 0;
  const { store, worker } = await workerWith({
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return { ok: false, status: 503, headers: { get: () => null }, text: async () => "" };
      return { ok: true, status: 200, headers: { get: () => null }, text: async () => usableAnswer };
    },
    budget: { attempts: 3, attemptTimeoutMs: 1_000, totalMs: 5_000, firstBackoffMs: 10, backoffFactor: 2, maxBackoffMs: 20, responseLimitBytes: 1_000_000 },
    ...fixedTime(),
  });

  const job = await worker.enqueue({ workspaceId: "wrk_storywell", workstreamId: "market", artifactType: null, instruction: "", requestedBy: "Maya Chen" });
  const after = await settle(store, job.id);
  const settled = after.jobs.find((entry) => entry.id === job.id);
  assert.equal(settled.status, "completed", settled.error ?? "");
  const artifact = after.artifacts.find((entry) => entry.id === settled.artifactId);
  assert.equal(artifact.title, "Positioning brief");
  assert.equal(artifact.generation.attempts, 2, "the retry that produced the draft is recorded");
  assert.ok(Number.isFinite(artifact.generation.elapsedMs));
  assert.ok(artifact.generation.instructionsVersion, "a draft records which instructions produced it");
  assert.equal(after.artifacts.filter((entry) => entry.title === "Positioning brief").length, 1, "a retried request must not write two deliverables");
});
