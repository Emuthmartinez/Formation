import { mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** Mirrors ROLES in domain/capabilities.mjs. Duplicated deliberately: the store must not import
 *  domain logic to validate a file it may be migrating from an older shape. */
const MEMBERSHIP_ROLES = new Set(["viewer", "reviewer", "editor", "owner"]);

export class JsonStore {
  #filePath;
  #seedFactory;
  #writeQueue = Promise.resolve();

  constructor({ filePath, seedFactory }) {
    if (!filePath) throw new Error("JsonStore requires a filePath.");
    if (typeof seedFactory !== "function") throw new Error("JsonStore requires a seedFactory.");
    this.#filePath = path.resolve(filePath);
    this.#seedFactory = seedFactory;
  }

  get filePath() {
    return this.#filePath;
  }

  async initialize() {
    await mkdir(path.dirname(this.#filePath), { recursive: true });
    try {
      await stat(this.#filePath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await this.#writeAtomic(this.#seedFactory());
    }
    await this.#readRaw();
  }

  async read() {
    await this.#writeQueue;
    return structuredClone(await this.#readRaw());
  }

  async transaction(mutator) {
    if (typeof mutator !== "function") throw new Error("JsonStore.transaction requires a mutator.");

    const operation = this.#writeQueue.then(async () => {
      const database = await this.#readRaw();
      const result = await mutator(database);
      database.updatedAt = new Date().toISOString();
      await this.#writeAtomic(database);
      return structuredClone(result);
    });

    this.#writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async reset() {
    return this.transaction((database) => {
      const seed = this.#seedFactory();
      for (const key of Object.keys(database)) delete database[key];
      Object.assign(database, seed);
      return database;
    });
  }

  async #readRaw() {
    let source;
    try {
      source = await readFile(this.#filePath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") {
        const seed = this.#seedFactory();
        await this.#writeAtomic(seed);
        return seed;
      }
      throw error;
    }

    let database;
    try {
      database = JSON.parse(source);
    } catch (error) {
      throw new Error(`Formation data store is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    const migrated = migrateDatabase(database);
    validateDatabase(database);
    if (migrated) await this.#writeAtomic(database);
    return database;
  }

  async #writeAtomic(database) {
    validateDatabase(database);
    const directory = path.dirname(this.#filePath);
    const temporary = path.join(
      directory,
      `.${path.basename(this.#filePath)}.${process.pid}.${Date.now()}.tmp`,
    );
    const payload = `${JSON.stringify(database, null, 2)}\n`;

    await mkdir(directory, { recursive: true });
    await writeFile(temporary, payload, { encoding: "utf8", mode: 0o600 });
    const handle = await open(temporary, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }

    try {
      await rename(temporary, this.#filePath);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }
}

function migrateDatabase(database) {
  if (!database || typeof database !== "object" || Array.isArray(database)) return false;
  let migrated = false;

  if (database.schemaVersion === 1 && Array.isArray(database.artifacts)) {
    database.artifactVersions = database.artifacts.map((artifact) => ({
      id: `ver_migrated_${artifact.id}_${artifact.version ?? 1}`,
      artifactId: artifact.id,
      workspaceId: artifact.workspaceId,
      workstreamId: artifact.workstreamId,
      version: Number.isInteger(artifact.version) ? artifact.version : 1,
      title: artifact.title ?? "Untitled deliverable",
      status: artifact.status ?? "draft",
      confidence: Number.isFinite(artifact.confidence) ? artifact.confidence : 0,
      summary: artifact.summary ?? "",
      sections: Array.isArray(artifact.sections) ? structuredClone(artifact.sections) : [],
      sourceClaimIds: Array.isArray(artifact.sourceClaimIds) ? [...artifact.sourceClaimIds] : [],
      linkedDecisionIds: Array.isArray(artifact.linkedDecisionIds) ? [...artifact.linkedDecisionIds] : [],
      createdAt: artifact.updatedAt ?? artifact.createdAt ?? new Date().toISOString(),
      createdBy: "Formation migration",
    }));
    database.schemaVersion = 2;
    migrated = true;
  }

  if (database.schemaVersion === 2) {
    database.executions = Array.isArray(database.executions) ? database.executions : [];
    database.schemaVersion = 3;
    migrated = true;
  }

  if (database.schemaVersion === 3) {
    database.invitations = Array.isArray(database.invitations) ? database.invitations : [];
    // A membership role the capability ladder does not recognise already holds nothing at runtime.
    // Writing that decision down here means the file says what the server does, so an operator
    // reading the store is not left to infer it — and a stale role cannot become meaningful again
    // if a future release happens to add a role of that name.
    const ownersByWorkspace = new Map();
    for (const membership of database.memberships ?? []) {
      if (membership.role !== "owner") continue;
      ownersByWorkspace.set(membership.workspaceId, (ownersByWorkspace.get(membership.workspaceId) ?? 0) + 1);
    }
    for (const membership of database.memberships ?? []) {
      if (MEMBERSHIP_ROLES.has(membership.role)) continue;
      // Retiring a role must never leave a company with nobody who can run it. A workspace whose
      // only membership carries an unknown role keeps its owner instead — a company nobody can
      // administer is a worse outcome than a role that was already meaningless at runtime.
      const owners = ownersByWorkspace.get(membership.workspaceId) ?? 0;
      if (owners === 0) {
        membership.role = "owner";
        ownersByWorkspace.set(membership.workspaceId, 1);
      } else {
        membership.role = "viewer";
      }
    }
    database.schemaVersion = 4;
    migrated = true;
  }

  if (database.schemaVersion === 4) {
    database.shares = Array.isArray(database.shares) ? database.shares : [];
    database.schemaVersion = 5;
    migrated = true;
  }

  if (database.schemaVersion === 5) {
    database.comments = Array.isArray(database.comments) ? database.comments : [];
    database.schemaVersion = 6;
    migrated = true;
  }

  if (database.schemaVersion === 6) {
    database.reviews = Array.isArray(database.reviews) ? database.reviews : [];
    database.schemaVersion = 7;
    migrated = true;
  }

  return migrated;
}

function validateDatabase(database) {
  if (!database || typeof database !== "object" || Array.isArray(database)) {
    throw new Error("Formation data store must contain one JSON object.");
  }
  if (database.schemaVersion !== 7) {
    throw new Error(`Unsupported Formation schema version: ${String(database.schemaVersion)}`);
  }

  const requiredCollections = [
    "users",
    "sessions",
    "memberships",
    "workspaces",
    "claims",
    "decisions",
    "artifacts",
    "artifactVersions",
    "tasks",
    "jobs",
    "executions",
    "invitations",
    "shares",
    "comments",
    "reviews",
    "activity",
  ];
  for (const name of requiredCollections) {
    if (!Array.isArray(database[name])) {
      throw new Error(`Formation data store collection ${name} must be an array.`);
    }
  }
}
