import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createId } from "./domain.mjs";
import { listEngineApprovals, recordApprovalActivity, syncEngineApprovals } from "./domain/approvals.mjs";

/**
 * The platform half of the platform-to-engine execution adapter (docs/platform/remaining-gaps.md,
 * "Platform-to-engine execution adapter" — slice 1). It receives an authorized Formation
 * execution request, selects or accepts a stable catalog workflow, fingerprints the scoped
 * company context, creates or resumes a durable engine run, and exposes founder-readable run
 * state. Result import, approval mapping, staleness, and trace/cost metadata are later slices.
 *
 * Boundary rules this file enforces:
 * - The platform never reads or writes engine workspace files. Every engine interaction is a
 *   spawned engine CLI: core/adapters/platform-execution.ts to ask, core/session/run.ts to run.
 *   The engine's reducer and session runner stay the only writers of engine-owned state.
 * - Secrets never cross: the spawned engine inherits a filtered environment with secret-shaped
 *   variables removed. Names and references only, never values.
 * - Honest state: "the engine could not be reached" is always reported as exactly that —
 *   never as "no work ready" and never as an empty run (the verifyControlBoundary /
 *   source_unresolved house pattern applied to this boundary).
 */

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/** Engine package location inside this repository. Overridable for deployments that relocate it. */
export const defaultSkillDir = path.resolve(moduleDir, "../../skill/b2c-mobile-business-launch");

/**
 * Environment variables whose names look secret-bearing never cross the boundary. The engine
 * obtains its own credentials through its own channels (Doppler); the platform's provider keys
 * are the platform's alone.
 */
const SECRET_ENV_PATTERN = /(KEY|TOKEN|SECRET|PASSWORD|PASSPHRASE|CREDENTIAL)S?$/i;

function boundaryEnvironment() {
  const environment = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (SECRET_ENV_PATTERN.test(name)) continue;
    environment[name] = value;
  }
  return environment;
}

/**
 * Mirrors the engine's tooling/lib/tsx-bin.ts resolution order. That helper cannot be imported
 * here — it is TypeScript and resolving tsx is the precondition for running any engine
 * TypeScript at all — so this is the one place the lookup exists on the platform side. Returns
 * null instead of falling back to a PATH lookup: an honest "engine runtime is not installed"
 * beats spawning whatever tsx happens to be globally installed.
 */
function resolveTsxBin(skillDir) {
  const candidates = [path.join(skillDir, "node_modules/.bin/tsx"), path.resolve(skillDir, "../..", "node_modules/.bin/tsx")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

/**
 * The scoped company context that travels with an execution request, canonicalized so the same
 * facts always produce the same fingerprint. Field selection is deliberate: the company source
 * of truth, stage, launch target, and founder capacity are what the engine plans against;
 * cosmetic workspace state (activity, timestamps, membership) is not context.
 */
export function computeContextFingerprint(workspace) {
  const scoped = {
    name: workspace.name,
    stage: workspace.stage,
    launchTarget: workspace.launchTarget ?? null,
    founder: {
      name: workspace.founder?.name ?? "",
      role: workspace.founder?.role ?? "",
      weeklyHours: workspace.founder?.weeklyHours ?? null,
    },
    company: workspace.company ?? {},
  };
  return createHash("sha256").update(canonicalJson(scoped)).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export class ExecutionError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ExecutionError";
    this.status = status;
  }
}

const OUTPUT_LIMIT_BYTES = 1_000_000;

/**
 * Spawns engine CLIs and returns their answers. All engine access funnels through this class so
 * the boundary rules (filtered environment, bounded output, honest failure classification) hold
 * everywhere by construction.
 */
export class EngineBridge {
  #skillDir;
  #tsxBin;
  #describeTimeoutMs;

  constructor({ skillDir = defaultSkillDir, describeTimeoutMs = 60_000 } = {}) {
    this.#skillDir = skillDir;
    this.#tsxBin = existsSync(skillDir) ? resolveTsxBin(skillDir) : null;
    this.#describeTimeoutMs = describeTimeoutMs;
  }

  #unavailableReason() {
    if (!existsSync(this.#skillDir)) return "The launch engine is not installed on this server.";
    if (!this.#tsxBin) return "The launch engine's runtime is not installed on this server.";
    return null;
  }

  async #spawnEngine(scriptRelativePath, args, timeoutMs) {
    const unavailable = this.#unavailableReason();
    if (unavailable) return { started: false, reason: unavailable };

    return new Promise((resolve) => {
      const child = spawn(this.#tsxBin, [path.join(this.#skillDir, scriptRelativePath), ...args], {
        cwd: this.#skillDir,
        env: boundaryEnvironment(),
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          child.kill("SIGKILL");
          resolve({ started: false, reason: "The launch engine did not answer in time." });
        }
      }, timeoutMs);
      timer.unref?.();
      child.stdout.on("data", (data) => {
        if (stdout.length < OUTPUT_LIMIT_BYTES) stdout += data.toString("utf8");
      });
      child.stderr.on("data", (data) => {
        if (stderr.length < OUTPUT_LIMIT_BYTES) stderr += data.toString("utf8");
      });
      child.on("error", (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          // The raw error can carry filesystem paths; those stay in the server log, never in
          // founder-facing text (platform/AGENTS.md vocabulary rules).
          console.error(`Formation execution adapter: engine spawn failed: ${error.message}`);
          resolve({ started: false, reason: "The launch engine could not be started on this server." });
        }
      });
      child.on("close", (code) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ started: true, code, stdout, stderr });
        }
      });
    });
  }

  /**
   * Read-only: what does the engine's durable run for this workspace look like right now?
   * Returns { reachable: true, report } only when the engine answered with a parseable boundary
   * report; every other outcome is { reachable: false, reason } — the caller must surface that,
   * not swallow it.
   */
  async describe(engineWorkspaceDir) {
    const result = await this.#spawnEngine("core/adapters/platform-execution.ts", ["--workspace", engineWorkspaceDir], this.#describeTimeoutMs);
    if (!result.started) return { reachable: false, reason: result.reason };
    if (result.code !== 0) {
      console.error(`Formation execution adapter: engine describe exited ${result.code}: ${result.stderr.slice(0, 2_000)}`);
      return { reachable: false, reason: "The launch engine could not answer for this company." };
    }
    try {
      return { reachable: true, report: JSON.parse(result.stdout) };
    } catch {
      console.error(`Formation execution adapter: engine describe returned unparseable output: ${result.stdout.slice(0, 2_000)}`);
      return { reachable: false, reason: "The launch engine returned an answer that could not be read." };
    }
  }

  /**
   * Creates or resumes the durable engine run by invoking the engine's own session runner — the
   * sanctioned entry point that seeds or resumes run state, honors grants and the kill switch,
   * and writes a digest on every exit path. The runner's default executor never fabricates
   * progress; `executor` exists so tests can opt into the engine's fixture executor.
   */
  async runSession({ engineWorkspaceDir, briefPath, sessionId, wallClockSeconds, executor }) {
    const args = ["--workspace", engineWorkspaceDir, "--brief", briefPath, "--session", sessionId, "--wall-clock-seconds", String(wallClockSeconds)];
    if (executor) args.push("--executor", executor);
    const result = await this.#spawnEngine("core/session/run.ts", args, (wallClockSeconds + 120) * 1_000);
    if (!result.started) return { ran: false, reason: result.reason };
    if (result.code !== 0) {
      console.error(`Formation execution adapter: engine session ${sessionId} exited ${result.code}: ${result.stderr.slice(0, 2_000)}`);
    }
    return { ran: true, code: result.code };
  }

  /**
   * Records a founder's answer to a parked approval through the engine's one sanctioned path,
   * core/session/approve.ts — the reducer and that CLI stay the only writers of engine-owned
   * state; the platform never touches run state, control, grants, or waivers itself.
   */
  async approve({ engineWorkspaceDir, approvalId, decision, sessionId, reason }) {
    const args = ["--workspace", engineWorkspaceDir, "--approval", approvalId, "--decision", decision, "--session", sessionId];
    if (reason) args.push("--reason", reason);
    const result = await this.#spawnEngine("core/session/approve.ts", args, this.#describeTimeoutMs);
    if (!result.started) return { recorded: false, kind: "unreachable", reason: result.reason };
    if (result.code === 0 && result.stdout.includes(`RECORDED ${approvalId} ${decision}`)) return { recorded: true };
    console.error(`Formation execution adapter: engine approve ${approvalId} exited ${result.code}: ${result.stderr.slice(0, 2_000)}`);
    if (result.stderr.includes("approve.unknown_approval")) return { recorded: false, kind: "unknown_approval" };
    if (result.stderr.includes("approve.no_run_state")) return { recorded: false, kind: "no_run" };
    return { recorded: false, kind: "error" };
  }
}

function defaultResolveEngineWorkspace(workspace) {
  const root = process.env.FORMATION_ENGINE_ROOT?.trim();
  if (!root) return null;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(workspace.slug ?? "")) return null;
  return path.join(path.resolve(root), workspace.slug);
}

const SESSION_HISTORY_LIMIT = 20;

export class ExecutionWorker {
  #store;
  #engine;
  #resolveEngineWorkspace;
  #wallClockSeconds;
  #executor;
  #running = false;
  #timer;

  constructor(store, { engine, resolveEngineWorkspace, wallClockSeconds = 600, executor } = {}) {
    this.#store = store;
    this.#engine = engine ?? new EngineBridge();
    this.#resolveEngineWorkspace = resolveEngineWorkspace ?? defaultResolveEngineWorkspace;
    this.#wallClockSeconds = wallClockSeconds;
    // Test-only: "fixture" opts into the engine's synthetic-completion executor. Never accepted
    // from a request — the engine's default (no real execution, no fabricated progress) is the
    // production behavior until real executors ship.
    this.#executor = executor;
  }

  start() {
    if (this.#timer) return;
    this.#timer = setInterval(() => void this.kick(), 2_000);
    this.#timer.unref?.();
    void this.#recoverInterruptedExecutions().then(() => this.kick());
  }

  stop() {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
  }

  async #recoverInterruptedExecutions() {
    await this.#store.transaction((database) => {
      const now = new Date().toISOString();
      for (const execution of database.executions) {
        if (execution.status !== "running") continue;
        // Requeueing is safe: the engine run is durable and the runner resumes it; a session the
        // dead process left behind is protected by the engine's own workspace lock.
        execution.status = "queued";
        execution.notes.push("Recovered after an interrupted execution worker.");
        execution.updatedAt = now;
      }
    });
  }

  /** Live engine view for one workspace, for the read routes. Never throws for engine trouble — it reports it. */
  async inspect(workspace) {
    const engineWorkspaceDir = this.#resolveEngineWorkspace(workspace);
    if (!engineWorkspaceDir) {
      return { connected: false, reachable: false, reason: "This company is not connected to its launch engine yet." };
    }
    const checkedAt = new Date().toISOString();
    const view = await this.#engine.describe(engineWorkspaceDir);
    if (!view.reachable) return { connected: true, reachable: false, checkedAt, reason: view.reason };
    if (!view.report.workspaceReady) return { connected: true, reachable: true, checkedAt, ready: false, reason: view.report.reason };
    return { connected: true, reachable: true, checkedAt, ready: true, run: founderRunView(view.report) };
  }

  /**
   * The founder approvals view for one workspace: asks the engine what it is asking, mirrors
   * that into the decision system, and returns the mirrored records. Only a reachable, ready
   * engine answer may create, close, or supersede a record — an unreachable engine is reported
   * as unreachable alongside the last known records, never as "no approvals waiting".
   *
   * `workspace.founder.operatingMode` shares the engine's grant-level vocabulary and is returned
   * for display, but it never influences this boundary: the engine's own grants and waivers
   * decide what runs without an approval, and no mode answers an approval on the founder's
   * behalf.
   */
  async syncApprovals(workspace) {
    const engineWorkspaceDir = this.#resolveEngineWorkspace(workspace);
    const operatingMode = workspace.founder?.operatingMode ?? null;
    if (!engineWorkspaceDir) {
      const database = await this.#store.read();
      return { connected: false, reachable: false, operatingMode, reason: "This company is not connected to its launch engine yet.", approvals: listEngineApprovals(database, workspace.id) };
    }
    const checkedAt = new Date().toISOString();
    const view = await this.#engine.describe(engineWorkspaceDir);
    if (!view.reachable) {
      const database = await this.#store.read();
      return { connected: true, reachable: false, checkedAt, operatingMode, reason: view.reason, approvals: listEngineApprovals(database, workspace.id) };
    }
    if (!view.report.workspaceReady) {
      const database = await this.#store.read();
      return { connected: true, reachable: true, ready: false, checkedAt, operatingMode, reason: view.report.reason, approvals: listEngineApprovals(database, workspace.id) };
    }
    const approvals = await this.#store.transaction((database) => {
      const liveWorkspace = database.workspaces.find((entry) => entry.id === workspace.id);
      if (!liveWorkspace) return [];
      const now = new Date().toISOString();
      const changes = syncEngineApprovals(database, liveWorkspace, view.report, now);
      recordApprovalActivity(database, liveWorkspace.id, changes, now);
      return listEngineApprovals(database, liveWorkspace.id);
    });
    return { connected: true, reachable: true, ready: true, checkedAt, operatingMode, approvals };
  }

  /**
   * Records a founder's answer to a mirrored approval. The answer travels through
   * core/session/approve.ts — the engine's only sanctioned path out of a founder gate — and the
   * decision record closes only after the engine confirmed it recorded the answer. Any failure
   * to reach the engine leaves the record open and says so: an unanswered approval stays
   * unanswered, and nothing here times out into an answer.
   */
  async answerApproval({ workspaceId, user, decisionId, answer, reason }) {
    const database = await this.#store.read();
    const { workspace, membership } = requireMembership(database, workspaceId, user.id);
    // Membership lets you see the company; answering for it is the owner's call alone.
    if (membership.role !== "owner") throw new ExecutionError(403, "Only this company's owner can answer a launch approval.");

    const decision = database.decisions.find((entry) => entry.id === decisionId && entry.workspaceId === workspaceId && entry.source?.kind === "engine-approval");
    if (!decision) throw new ExecutionError(404, "Approval not found.");
    if (decision.status !== "open") {
      throw new ExecutionError(
        409,
        decision.status === "superseded"
          ? "The launch plan moved on before this was answered, so the engine is no longer asking it."
          : "This approval was already answered.",
      );
    }

    const engineWorkspaceDir = this.#resolveEngineWorkspace(workspace);
    if (!engineWorkspaceDir) throw new ExecutionError(409, "This company is not connected to its launch engine yet.");

    // Confirm the engine still asks this exact question before recording anything: the mirror
    // could be stale (plan moved on, or answered directly with the engine's own CLI).
    const view = await this.#engine.describe(engineWorkspaceDir);
    if (!view.reachable) throw new ExecutionError(502, `Nothing was recorded: ${view.reason}`);
    if (!view.report.workspaceReady) {
      throw new ExecutionError(409, `Nothing was recorded: ${view.report.reason ?? "the launch engine has no workspace for this company yet."}`);
    }
    const live = (view.report.approvals ?? []).find((entry) => entry.approvalId === decision.source.approvalId);
    if ((view.report.runId ?? null) !== decision.source.runId || !live || live.status !== "pending") {
      await this.#store.transaction((liveDatabase) => {
        const liveWorkspace = liveDatabase.workspaces.find((entry) => entry.id === workspaceId);
        if (!liveWorkspace) return;
        const now = new Date().toISOString();
        recordApprovalActivity(liveDatabase, liveWorkspace.id, syncEngineApprovals(liveDatabase, liveWorkspace, view.report, now), now);
      });
      throw new ExecutionError(409, "The launch engine is no longer asking this question. Refresh the approvals list for the current ones.");
    }

    const result = await this.#engine.approve({
      engineWorkspaceDir,
      approvalId: decision.source.approvalId,
      decision: answer === "approve" ? "approved" : "rejected",
      sessionId: `formation.approval.${decision.id}`,
      reason,
    });
    if (!result.recorded) {
      if (result.kind === "unreachable") throw new ExecutionError(502, `Nothing was recorded: ${result.reason}`);
      if (result.kind === "unknown_approval" || result.kind === "no_run") {
        throw new ExecutionError(409, "The launch engine is no longer asking this question. Refresh the approvals list for the current ones.");
      }
      throw new ExecutionError(502, "The launch engine could not record this answer, so nothing changed.");
    }

    const approved = answer === "approve";
    return this.#store.transaction((liveDatabase) => {
      const target = liveDatabase.decisions.find((entry) => entry.id === decisionId && entry.workspaceId === workspaceId);
      const now = new Date().toISOString();
      if (target) {
        target.status = "decided";
        target.decidedAt = now.slice(0, 10);
        target.decision = `${approved ? "Approved" : "Declined"}: ${target.source.description}${reason ? ` — ${reason}` : ""}`;
        target.answer = { value: approved ? "approved" : "declined", answeredBy: user.name, answeredAt: now, reason: reason ?? null, recordedVia: "formation" };
        target.updatedAt = now;
      }
      liveDatabase.activity.push({
        id: createId("act"),
        workspaceId,
        type: "approval-answered",
        title: `${approved ? "Approval granted" : "Approval declined"}: ${decision.source.workflowTitle}`,
        detail: `${decision.source.description}${reason ? ` — ${reason}` : ""}`,
        actor: user.name,
        createdAt: now,
      });
      return target ?? decision;
    });
  }

  /**
   * The authorized execution request intake. Validates membership inside the store transaction,
   * selects or accepts a stable catalog workflow against the engine's live answer, fingerprints
   * the scoped company context, and creates — or, for a retry of the same request against the
   * same context, resumes — the execution record that owns the durable engine run.
   */
  async submit({ workspaceId, user, workflowId }) {
    const database = await this.#store.read();
    const workspace = requireMemberWorkspace(database, workspaceId, user.id);

    const engineWorkspaceDir = this.#resolveEngineWorkspace(workspace);
    if (!engineWorkspaceDir) throw new ExecutionError(409, "This company is not connected to its launch engine yet.");

    const view = await this.#engine.describe(engineWorkspaceDir);
    if (!view.reachable) {
      throw new ExecutionError(502, `Nothing was started: ${view.reason}`);
    }
    if (!view.report.workspaceReady) {
      throw new ExecutionError(409, `Nothing was started: ${view.report.reason ?? "the launch engine has no workspace for this company yet."}`);
    }

    const workflows = view.report.workflows ?? [];
    let selected;
    if (workflowId !== undefined) {
      selected = workflows.find((entry) => entry.workflowId === workflowId);
      if (!selected) throw new ExecutionError(400, "That step is not part of this company's launch plan.");
    } else {
      selected = workflows.find((entry) => entry.status === "ready");
      if (!selected) {
        const waiting = workflows.filter((entry) => entry.status === "needs-founder").length;
        const upcoming = workflows.filter((entry) => entry.status === "upcoming").length;
        throw new ExecutionError(
          409,
          `Nothing is ready for the launch engine to work on right now — ${waiting} step(s) are waiting on you and ${upcoming} are waiting on earlier work.`,
        );
      }
    }

    const chosenWorkflowId = selected.workflowId;
    const chosenTitle = selected.title;
    const engineRef = { runId: view.report.runId ?? null, planId: view.report.planId, catalogVersion: view.report.catalogVersion };

    const outcome = await this.#store.transaction((liveDatabase) => {
      const liveWorkspace = requireMemberWorkspace(liveDatabase, workspaceId, user.id);
      const contextFingerprint = computeContextFingerprint(liveWorkspace);
      const now = new Date().toISOString();

      const existing = liveDatabase.executions.find(
        (entry) => entry.workspaceId === workspaceId && entry.workflowId === chosenWorkflowId && entry.contextFingerprint === contextFingerprint,
      );
      if (existing) {
        if (existing.status === "failed") {
          existing.status = "queued";
          existing.error = null;
          existing.failureKind = null;
          existing.notes.push("Asked again after an earlier attempt did not finish.");
          existing.updatedAt = now;
          liveDatabase.activity.push({
            id: createId("act"),
            workspaceId,
            type: "execution-requeued",
            title: `Launch engine asked again: ${existing.workflowTitle}`,
            detail: "The earlier attempt did not finish, so the same request was queued again.",
            actor: user.name,
            createdAt: now,
          });
        }
        return { execution: existing, resumed: true };
      }

      const execution = {
        id: createId("exec"),
        workspaceId,
        workflowId: chosenWorkflowId,
        workflowTitle: chosenTitle,
        contextFingerprint,
        status: "queued",
        failureKind: null,
        requestedBy: user.name,
        requestedByEmail: user.email,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        engine: engineRef,
        sessions: [],
        notes: [],
        report: null,
        error: null,
      };
      liveDatabase.executions.push(execution);
      liveDatabase.activity.push({
        id: createId("act"),
        workspaceId,
        type: "execution-queued",
        title: `Launch engine asked to work on ${chosenTitle}`,
        detail: "Formation sent this step to the launch engine with the company's current context.",
        actor: user.name,
        createdAt: now,
      });
      return { execution, resumed: false };
    });

    queueMicrotask(() => void this.kick());
    return outcome;
  }

  async kick() {
    if (this.#running) return;
    this.#running = true;
    try {
      while (await this.#processNext()) {
        // Drain the durable queue in order; one session at a time keeps the engine's own
        // workspace lock uncontended from this process.
      }
    } catch (error) {
      console.error("Formation execution worker stopped before draining the queue:", error instanceof Error ? error.message : String(error));
    } finally {
      this.#running = false;
    }
  }

  async #processNext() {
    const claimed = await this.#store.transaction((database) => {
      const execution = database.executions.find((entry) => entry.status === "queued");
      if (!execution) return null;
      execution.status = "running";
      execution.updatedAt = new Date().toISOString();
      return execution;
    });
    if (!claimed) return false;

    let briefPath;
    try {
      const database = await this.#store.read();
      const workspace = database.workspaces.find((entry) => entry.id === claimed.workspaceId);
      if (!workspace) throw new Error("The company workspace no longer exists.");
      const engineWorkspaceDir = this.#resolveEngineWorkspace(workspace);
      if (!engineWorkspaceDir) throw new Error("This company is not connected to its launch engine.");

      const sessionNumber = claimed.sessions.length + 1;
      const sessionId = `formation.${claimed.id}.${sessionNumber}`;
      const startedAt = new Date().toISOString();
      briefPath = path.join(os.tmpdir(), `formation-brief-${claimed.id}-${sessionNumber}.json`);
      await writeFile(
        briefPath,
        JSON.stringify(
          {
            schemaVersion: "1.0.0",
            businessSlug: workspace.slug,
            founderContact: { email: claimed.requestedByEmail },
            scopeHints: [claimed.workflowId],
            notes: `Formation execution ${claimed.id} (context ${claimed.contextFingerprint.slice(0, 12)})`,
          },
          null,
          2,
        ),
        { encoding: "utf8", mode: 0o600 },
      );

      const session = await this.#engine.runSession({
        engineWorkspaceDir,
        briefPath,
        sessionId,
        wallClockSeconds: this.#wallClockSeconds,
        executor: this.#executor,
      });
      const finishedAt = new Date().toISOString();
      const after = session.ran && session.code === 0 ? await this.#engine.describe(engineWorkspaceDir) : null;

      await this.#store.transaction((nextDatabase) => {
        const live = nextDatabase.executions.find((entry) => entry.id === claimed.id);
        if (!live) return;
        live.sessions.push({ sessionId, startedAt, finishedAt, exitCode: session.ran ? session.code : null });
        if (live.sessions.length > SESSION_HISTORY_LIMIT) live.sessions.splice(0, live.sessions.length - SESSION_HISTORY_LIMIT);
        live.updatedAt = finishedAt;

        if (!session.ran) {
          live.status = "failed";
          live.failureKind = "engine_unreachable";
          live.error = `The launch engine could not be started for this work. ${session.reason}`;
        } else if (session.code === 0) {
          live.status = "completed";
          live.completedAt = finishedAt;
          if (after?.reachable && after.report.workspaceReady) {
            const runId = after.report.runId ?? null;
            if (live.engine?.runId && runId && live.engine.runId !== runId) {
              live.notes.push("The launch engine started a fresh run because its plan changed since this was requested.");
            }
            live.engine = { runId, planId: after.report.planId, catalogVersion: after.report.catalogVersion };
            live.report = founderRunView(after.report);
            // A session that parked work on a founder decision must surface that decision now,
            // not on the next page view.
            const liveWorkspace = nextDatabase.workspaces.find((entry) => entry.id === claimed.workspaceId);
            if (liveWorkspace) {
              recordApprovalActivity(nextDatabase, liveWorkspace.id, syncEngineApprovals(nextDatabase, liveWorkspace, after.report, finishedAt), finishedAt);
            }
          } else {
            // The session itself finished; saying so is honest. Pretending we also know the
            // resulting state would not be — the read routes will say "could not be reached".
            live.notes.push("The work session finished, but the engine's latest state could not be read afterwards.");
          }
        } else if (session.code === 2) {
          live.status = "failed";
          live.failureKind = "engine_busy";
          live.error = "The launch engine was already busy with another session for this company. Nothing was lost — ask again in a minute.";
        } else if (session.code === 3) {
          live.status = "failed";
          live.failureKind = "engine_integrity";
          live.error = "The launch engine stopped because this company's saved files changed outside its normal process. It needs a careful look before more work runs.";
        } else {
          live.status = "failed";
          live.failureKind = "session_error";
          live.error = "The launch engine session did not complete. The engine kept its own record of what happened.";
        }

        nextDatabase.activity.push({
          id: createId("act"),
          workspaceId: claimed.workspaceId,
          type: live.status === "completed" ? "execution-completed" : "execution-failed",
          title: live.status === "completed" ? `Launch engine worked on ${live.workflowTitle}` : `Launch engine could not finish ${live.workflowTitle}`,
          detail: live.status === "completed" ? "The engine session finished and the run state was refreshed." : (live.error ?? "The engine session did not complete."),
          actor: "Formation",
          createdAt: finishedAt,
        });
      });
    } catch (error) {
      console.error(`Formation execution adapter: execution ${claimed.id} failed:`, error instanceof Error ? (error.stack ?? error.message) : String(error));
      await this.#store.transaction((database) => {
        const live = database.executions.find((entry) => entry.id === claimed.id);
        if (!live) return;
        live.status = "failed";
        live.failureKind = "engine_unreachable";
        live.error = "The launch engine could not be reached for this work, so it did not run.";
        live.updatedAt = new Date().toISOString();
      });
    } finally {
      // Best effort: the brief carries the requester's email address and has no value once the
      // session has exited.
      if (briefPath) await unlink(briefPath).catch(() => undefined);
    }
    return true;
  }
}

function requireMembership(database, workspaceId, userId) {
  const membership = database.memberships.find((entry) => entry.workspaceId === workspaceId && entry.userId === userId);
  const workspace = database.workspaces.find((entry) => entry.id === workspaceId);
  if (!membership || !workspace) throw new ExecutionError(404, "Workspace not found.");
  return { workspace, membership };
}

function requireMemberWorkspace(database, workspaceId, userId) {
  return requireMembership(database, workspaceId, userId).workspace;
}

/**
 * The founder-readable projection of an engine boundary report. Counts and prose only — node
 * ids, domain ids, and evaluator vocabulary stay on the engine side of the boundary.
 */
export function founderRunView(report) {
  const workflows = report.workflows ?? [];
  const counts = {
    total: workflows.length,
    finished: 0,
    ready: 0,
    inProgress: 0,
    waitingOnFounder: 0,
    held: 0,
    failed: 0,
    upcoming: 0,
  };
  for (const workflow of workflows) {
    if (workflow.status === "finished") counts.finished += 1;
    else if (workflow.status === "ready") counts.ready += 1;
    else if (workflow.status === "in-progress") counts.inProgress += 1;
    else if (workflow.status === "needs-founder") counts.waitingOnFounder += 1;
    else if (workflow.status === "held") counts.held += 1;
    else if (workflow.status === "failed") counts.failed += 1;
    else counts.upcoming += 1;
  }

  const parts = [`${counts.finished} of ${counts.total} steps finished`];
  if (counts.inProgress > 0) parts.push(`${counts.inProgress} in progress`);
  if (counts.ready > 0) parts.push(`${counts.ready} ready to run`);
  if (counts.waitingOnFounder > 0) parts.push(`${counts.waitingOnFounder} waiting on you`);
  if (counts.held > 0) parts.push(`${counts.held} waiting for a go-ahead the engine does not have`);
  if (counts.failed > 0) parts.push(`${counts.failed} did not go through on the last try`);
  if (counts.upcoming > 0) parts.push(`${counts.upcoming} queued behind earlier steps`);

  return {
    generatedAt: report.generatedAt,
    runStarted: report.hasDurableRun === true,
    autonomyUnset: report.autonomyUnset === true,
    headline: `${parts.join("; ")}.`,
    counts,
    steps: workflows.map((workflow) => ({
      workflowId: workflow.workflowId,
      title: workflow.title,
      status: workflow.status,
      ...(workflow.founderReason ? { reason: workflow.founderReason } : {}),
    })),
  };
}

/** The API projection of one execution record. */
export function toFounderExecution(execution) {
  return {
    id: execution.id,
    workflowId: execution.workflowId,
    title: execution.workflowTitle,
    status: execution.status,
    failureKind: execution.failureKind ?? null,
    error: execution.error ?? null,
    notes: execution.notes ?? [],
    requestedBy: execution.requestedBy,
    contextFingerprint: execution.contextFingerprint,
    createdAt: execution.createdAt,
    updatedAt: execution.updatedAt,
    completedAt: execution.completedAt,
    engine: execution.engine,
    sessionCount: execution.sessions.length,
    lastSessionAt: execution.sessions.length > 0 ? execution.sessions[execution.sessions.length - 1].finishedAt : null,
    report: execution.report,
  };
}
