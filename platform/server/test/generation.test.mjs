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
