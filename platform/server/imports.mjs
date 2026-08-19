import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { EngineBridge } from "./execution.mjs";
import { applyImportPlan, buildImportPlan, recordImportActivity, toFounderPlan } from "./domain/imports.mjs";

/**
 * The service that brings existing launch work into a Formation company.
 *
 * The security shape is the load-bearing part. An import reads files off the server's own disk, so
 * a request that carried a path would be an authenticated arbitrary-file-read: an owner could name
 * `/etc` or `../../secrets` and have the contents arrive as deliverables in their own workspace.
 *
 * Requests therefore never carry a path. They carry a **source id**, which is one directory name
 * directly inside a configured root (`FORMATION_IMPORT_ROOT`, defaulting to the skill root the
 * execution adapter already uses). The id is matched against the directory names actually found
 * there, so an id that is not a real entry resolves to nothing at all — traversal is impossible by
 * construction rather than by pattern-matching for `..`. With no root configured, importing is
 * off, and says so.
 */

const SOURCE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const SOURCE_LIMIT = 200;

/** A launch repository is recognised by the one file every one of them has. */
const STATE_RELATIVE_PATH = path.join("state", "PROJECT_STATE.yaml");

export class ImportError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ImportError";
    this.status = status;
  }
}

export function defaultImportRoot() {
  const configured = process.env.FORMATION_IMPORT_ROOT?.trim() || process.env.FORMATION_ENGINE_ROOT?.trim();
  return configured ? path.resolve(configured) : null;
}

export class ImportService {
  #store;
  #engine;
  #resolveRoot;

  constructor(store, { engine, resolveRoot } = {}) {
    this.#store = store;
    this.#engine = engine ?? new EngineBridge();
    this.#resolveRoot = resolveRoot ?? defaultImportRoot;
  }

  /**
   * Every launch repository on this server the founder could bring in. Returns `{ configured:
   * false }` rather than an empty list when no root is set: "importing is switched off here" and
   * "there is nothing to import" are different answers, and a founder shown the second when the
   * first is true will go looking for a workspace that was never going to be found.
   */
  listSources() {
    const root = this.#resolveRoot();
    if (!root || !existsSync(root)) return { configured: false, sources: [] };
    let entries;
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      return { configured: false, sources: [] };
    }
    const sources = [];
    for (const entry of entries) {
      if (sources.length >= SOURCE_LIMIT) break;
      if (!entry.isDirectory() || !SOURCE_ID_PATTERN.test(entry.name)) continue;
      const candidate = path.join(root, entry.name, STATE_RELATIVE_PATH);
      if (!existsSync(candidate)) continue;
      let updatedAt = null;
      try {
        updatedAt = statSync(candidate).mtime.toISOString();
      } catch {
        updatedAt = null;
      }
      sources.push({ id: entry.name, updatedAt });
    }
    return { configured: true, sources: sources.sort((a, b) => a.id.localeCompare(b.id)) };
  }

  /**
   * Resolves a source id to a directory, by matching it against what is actually there. A request
   * can only ever name something this method already found.
   */
  #resolveSource(sourceId) {
    const { configured, sources } = this.listSources();
    if (!configured) throw new ImportError(409, "This Formation instance is not set up to bring in existing launch work.");
    if (!sources.some((entry) => entry.id === sourceId)) throw new ImportError(404, "That launch workspace was not found on this server.");
    return path.join(this.#resolveRoot(), sourceId);
  }

  async #read(sourceId) {
    if (typeof sourceId !== "string" || !SOURCE_ID_PATTERN.test(sourceId)) {
      throw new ImportError(400, "Name which launch workspace to bring in.");
    }
    const directory = this.#resolveSource(sourceId);
    const view = await this.#engine.describeLaunchRepository(directory);
    if (!view.reachable) throw new ImportError(503, view.reason);
    if (view.report?.workspaceReady !== true) {
      throw new ImportError(409, view.report?.reason ?? "There is nothing in that launch workspace to bring in yet.");
    }
    return view.report;
  }

  /** What an import would do. Reads the store; writes nothing. */
  async preview({ workspace, sourceId }) {
    const report = await this.#read(sourceId);
    const database = await this.#store.read();
    const plan = buildImportPlan(database, workspace, report, sourceId, new Date().toISOString());
    return toFounderPlan(plan);
  }

  /**
   * Does it. The plan is rebuilt inside the transaction against the state the write will actually
   * see, so a preview the founder read a minute ago cannot be replayed against a store that moved
   * underneath it. The founder-facing answer is the same projection the preview returned, so what
   * they were shown and what happened are described in one vocabulary.
   */
  async apply({ workspace, sourceId, actor }) {
    const report = await this.#read(sourceId);
    return this.#store.transaction((database) => {
      const live = database.workspaces.find((entry) => entry.id === workspace.id);
      if (!live) throw new ImportError(404, "Workspace not found.");
      const now = new Date().toISOString();
      const plan = buildImportPlan(database, live, report, sourceId, now);
      const changes = applyImportPlan(database, live, plan, now);
      recordImportActivity(database, live.id, changes, now, actor);
      return toFounderPlan(plan);
    });
  }
}
