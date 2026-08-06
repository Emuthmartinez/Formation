import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { GenerationWorker } from "../generation.mjs";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";

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
