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
  assert.equal(persisted.schemaVersion, 4);
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

  assert.equal(migrated.schemaVersion, 4);
  assert.equal(migrated.artifactVersions.length, migrated.artifacts.length);
  assert.ok(migrated.artifactVersions.every((version) => version.createdBy === "Formation migration"));
  assert.deepEqual(migrated.executions, []);
  assert.deepEqual(migrated.invitations, []);
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

  assert.equal(migrated.schemaVersion, 4);
  assert.deepEqual(migrated.executions, []);
});

test("JSON store migrates a schema 3 file by adding invitations and retiring roles it no longer knows", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-store-migration-v3-"));
  const filePath = path.join(directory, "formation.json");
  const previous = createSeedDatabase();
  previous.schemaVersion = 3;
  delete previous.invitations;
  previous.memberships.push(
    { id: "mem_advisor", userId: "usr_advisor", workspaceId: "wrk_storywell", role: "advisor", createdAt: "2026-08-05T00:00:00.000Z" },
    { id: "mem_editor", userId: "usr_editor", workspaceId: "wrk_storywell", role: "editor", createdAt: "2026-08-05T00:00:00.000Z" },
  );
  await writeFile(filePath, `${JSON.stringify(previous, null, 2)}
`, { mode: 0o600 });

  const store = new JsonStore({ filePath, seedFactory: createSeedDatabase });
  await store.initialize();
  const migrated = await store.read();

  assert.equal(migrated.schemaVersion, 4);
  assert.deepEqual(migrated.invitations, []);
  // A role the ladder never had held nothing at runtime; the file now says so too.
  assert.equal(migrated.memberships.find((entry) => entry.id === "mem_advisor").role, "viewer");
  // Roles the ladder does know are left exactly as they were.
  assert.equal(migrated.memberships.find((entry) => entry.id === "mem_editor").role, "editor");
  assert.equal(migrated.memberships.find((entry) => entry.id === "mem_storywell_owner").role, "owner");
});

test("retiring a role never leaves a company with nobody who can run it", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-store-migration-lonely-"));
  const filePath = path.join(directory, "formation.json");
  const previous = createSeedDatabase();
  previous.schemaVersion = 3;
  delete previous.invitations;
  // A company whose only membership carries a role the ladder never had.
  previous.workspaces.push({ ...structuredClone(previous.workspaces[0]), id: "wrk_lonely", slug: "lonely" });
  previous.memberships.push({ id: "mem_lonely", userId: "usr_demo_founder", workspaceId: "wrk_lonely", role: "founder", createdAt: "2026-08-05T00:00:00.000Z" });
  await writeFile(filePath, `${JSON.stringify(previous, null, 2)}
`, { mode: 0o600 });

  const store = new JsonStore({ filePath, seedFactory: createSeedDatabase });
  await store.initialize();
  const migrated = await store.read();

  // Least privilege gives way to leaving someone able to administer the company: a workspace
  // nobody can run is worse than a role that already held nothing at runtime.
  assert.equal(migrated.memberships.find((entry) => entry.id === "mem_lonely").role, "owner");
  for (const workspace of migrated.workspaces) {
    const owners = migrated.memberships.filter((entry) => entry.workspaceId === workspace.id && entry.role === "owner");
    assert.ok(owners.length >= 1, `${workspace.id} came out of the migration with no owner`);
  }
});
