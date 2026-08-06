import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";

test("JSON store initializes, serializes concurrent writes, and persists valid data", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-store-"));
  const filePath = path.join(directory, "formation.json");
  const store = new JsonStore({ filePath, seedFactory: createSeedDatabase });
  await store.initialize();

  await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      store.transaction((database) => {
        database.activity.push({ id: `concurrent-${index}`, workspaceId: "wrk_storywell", createdAt: new Date().toISOString() });
      }),
    ),
  );

  const database = await store.read();
  assert.equal(database.activity.filter((entry) => entry.id.startsWith("concurrent-")).length, 12);
  const persisted = JSON.parse(await readFile(filePath, "utf8"));
  assert.equal(persisted.schemaVersion, 3);
  assert.ok(persisted.artifactVersions.length > 0);
  assert.ok(Array.isArray(persisted.executions));
  assert.ok(persisted.updatedAt);
});

test("JSON store returns clones so reads cannot mutate durable state", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-store-clone-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();

  const first = await store.read();
  first.workspaces[0].name = "Mutated outside transaction";
  const second = await store.read();
  assert.equal(second.workspaces[0].name, "Storywell");
});


test("JSON store migrates schema 1 artifacts into immutable version history", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-store-migration-"));
  const filePath = path.join(directory, "formation.json");
  const legacy = createSeedDatabase();
  legacy.schemaVersion = 1;
  delete legacy.artifactVersions;
  delete legacy.executions;
  await writeFile(filePath, `${JSON.stringify(legacy, null, 2)}
`, { mode: 0o600 });

  const store = new JsonStore({ filePath, seedFactory: createSeedDatabase });
  await store.initialize();
  const migrated = await store.read();

  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.artifactVersions.length, migrated.artifacts.length);
  assert.ok(migrated.artifactVersions.every((version) => version.createdBy === "Formation migration"));
  assert.deepEqual(migrated.executions, []);
});

test("JSON store migrates a schema 2 file by adding the executions collection", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-store-migration-v2-"));
  const filePath = path.join(directory, "formation.json");
  const previous = createSeedDatabase();
  previous.schemaVersion = 2;
  delete previous.executions;
  await writeFile(filePath, `${JSON.stringify(previous, null, 2)}
`, { mode: 0o600 });

  const store = new JsonStore({ filePath, seedFactory: createSeedDatabase });
  await store.initialize();
  const migrated = await store.read();

  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.executions, []);
});
