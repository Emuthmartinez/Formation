import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { CompiledRunNode } from "../engine/compile.js";
import { composeNodeBrief } from "../engine/node-brief.js";
import { buildWorkerPrompt, validateKnowledgeReceipt } from "./worker-prompt.js";

/**
 * The seam real runtime execution (U6) plugs into. A session (U5) never knows HOW a node's work
 * gets done — it only knows the shape of the answer: which declared outputs landed where, with
 * what fingerprint, and what evidence backs the claim. Async by design: a real executor invokes
 * a runtime CLI (Claude Code / Codex / Cursor) as a subprocess and must be able to await it,
 * unlike the rest of this repo's synchronous CLI tooling (see autonomy/evaluator.ts's comment on
 * why *that* surface stays sync — execution is the one place this run genuinely waits on I/O).
 */
export interface NodeExecutionOutput {
  readonly artifactId: string;
  readonly path: string;
  readonly fingerprint: string;
  readonly evidence: readonly string[];
}

export type NodeExecutionStatus = "succeeded" | "failed";

export interface NodeExecutionResult {
  readonly status: NodeExecutionStatus;
  readonly outputs: readonly NodeExecutionOutput[];
  readonly evidence: readonly string[];
  readonly error?: string;
}

export interface NodeExecutionContext {
  readonly runId: string;
  readonly attemptId: string;
  readonly workspaceDir: string;
  readonly now: string;
  readonly skillRootDir: string;
  readonly artifactPaths: Readonly<Record<string, string>>;
  /**
   * Refreshes this attempt's own heartbeat (and the session lock's) mid-execution. The fixture/
   * no-op executors resolve instantly and never need it, but a real executor (U6) awaiting a
   * long-running runtime CLI subprocess should call this periodically — otherwise a slow-but-alive
   * attempt's heartbeatAt goes stale under R12's TTL and a *later* session's detectOrphans wrongly
   * treats still-in-progress work as a dead attempt.
   */
  readonly heartbeat: () => void;
}

export type WorkerRuntime = "auto" | "claude" | "codex" | "cursor";

export interface WorkerCommand {
  readonly runtime: Exclude<WorkerRuntime, "auto">;
  readonly command: string;
  readonly args: readonly string[];
  readonly prompt: string;
}

const runtimeCommands: Record<Exclude<WorkerRuntime, "auto">, string> = { claude: "claude", codex: "codex", cursor: "cursor-agent" };

function available(command: string): boolean {
  const result = spawnSync(command, ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

export function resolveWorkerRuntime(requested: WorkerRuntime): Exclude<WorkerRuntime, "auto"> | undefined {
  if (requested !== "auto") return available(runtimeCommands[requested]) ? requested : undefined;
  return (["codex", "claude", "cursor"] as const).find((runtime) => available(runtimeCommands[runtime]));
}

function workerRuntimeCandidates(requested: WorkerRuntime): Array<Exclude<WorkerRuntime, "auto">> {
  if (requested !== "auto") return available(runtimeCommands[requested]) ? [requested] : [];
  return (["codex", "claude", "cursor"] as const).filter((runtime) => available(runtimeCommands[runtime]));
}

export function buildWorkerCommand(runtime: Exclude<WorkerRuntime, "auto">, prompt: string): WorkerCommand {
  if (runtime === "codex") return { runtime, command: "codex", args: ["exec", "--sandbox", "workspace-write", "--json", prompt], prompt };
  if (runtime === "claude") return { runtime, command: "claude", args: ["-p", "--bare", "--output-format", "json", "--max-turns", "30", prompt], prompt };
  return { runtime, command: "cursor-agent", args: ["agent", "-p", prompt, "--sandbox", "enabled"], prompt };
}

function fingerprintPath(target: string): string {
  const hash = createHash("sha256");
  const visit = (current: string, relative: string): void => {
    const stat = lstatSync(current);
    hash.update(`${relative}\0${stat.mode}\0${stat.size}\0`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(current).sort()) visit(path.join(current, name), path.posix.join(relative, name));
    } else if (stat.isFile()) {
      hash.update(readFileSync(current));
    }
  };
  visit(target, ".");
  return hash.digest("hex");
}

async function runWorker(
  command: WorkerCommand,
  cwd: string,
  timeoutMs: number,
): Promise<{ status: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return await new Promise((resolve) => {
    const child = spawn(command.command, [...command.args], { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const cap = (value: string, chunk: Buffer): string => `${value}${chunk.toString("utf8")}`.slice(-2_000_000);
    child.stdout.on("data", (chunk: Buffer) => (stdout = cap(stdout, chunk)));
    child.stderr.on("data", (chunk: Buffer) => (stderr = cap(stderr, chunk)));
    let timedOut = false;
    const timer = setTimeout(
      () => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
      },
      Math.max(1_000, timeoutMs),
    );
    timer.unref();
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ status: null, stdout, stderr: `${stderr}\n${error.message}`, timedOut });
    });
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr, timedOut });
    });
  });
}

/** Real bounded worker executor used by scheduled sessions. */
export function createCliExecutor(requestedRuntime: WorkerRuntime = "auto"): NodeExecutor {
  return {
    async execute(node, context): Promise<NodeExecutionResult> {
      const runtimes = workerRuntimeCandidates(requestedRuntime);
      if (runtimes.length === 0)
        return { status: "failed", outputs: [], evidence: [], error: `no worker CLI is installed for requested runtime ${requestedRuntime}` };
      const artifactBindings = Object.entries(context.artifactPaths).map(([artifactId, artifactPath]) => ({ artifactId, path: artifactPath, accepted: false }));
      const brief = composeNodeBrief(node, {
        planId: context.runId,
        planRevision: 0,
        catalogVersion: "runtime",
        compiledAt: context.now,
        nodes: [node],
        artifactBindings,
      });
      for (const contractPath of brief.contractFiles) {
        if (!existsSync(path.join(context.workspaceDir, contractPath)))
          return { status: "failed", outputs: [], evidence: [], error: `worker contract file is missing: ${contractPath}` };
      }
      for (const reference of brief.load) {
        if (!existsSync(path.join(context.skillRootDir, reference.path)))
          return { status: "failed", outputs: [], evidence: [], error: `mandatory worker knowledge is missing: ${reference.path}` };
      }
      const prompt = buildWorkerPrompt(brief, context.workspaceDir, context.skillRootDir);
      let runtime = runtimes[0]!;
      let result: Awaited<ReturnType<typeof runWorker>> | undefined;
      const authFailures: string[] = [];
      for (const candidate of runtimes) {
        runtime = candidate;
        result = await runWorker(buildWorkerCommand(candidate, prompt), context.workspaceDir, node.ttlSeconds * 1000);
        const failureText = `${result.stdout}\n${result.stderr}`;
        if (result.status === 0 || requestedRuntime !== "auto" || !/(auth|log[ -]?in|api[_ -]?key|unauthori[sz]ed|credential)/i.test(failureText)) break;
        authFailures.push(`${candidate}: authentication unavailable`);
      }
      if (!result) return { status: "failed", outputs: [], evidence: [], error: "worker runtime selection produced no invocation" };
      if (result.timedOut) return { status: "failed", outputs: [], evidence: [], error: `${runtime} worker exceeded ${node.ttlSeconds}s TTL` };
      if (result.status !== 0) {
        const tried = authFailures.length > 0 ? `; fallbacks tried: ${authFailures.join(", ")}` : "";
        return {
          status: "failed",
          outputs: [],
          evidence: [],
          error: `${runtime} worker exited ${String(result.status)}: ${result.stderr.trim().slice(-800)}${tried}`,
        };
      }
      const receiptIssues = validateKnowledgeReceipt(`${result.stdout}\n${result.stderr}`, brief);
      if (receiptIssues.length > 0)
        return { status: "failed", outputs: [], evidence: [], error: `worker knowledge receipt rejected: ${receiptIssues.join("; ")}` };
      const outputs: NodeExecutionOutput[] = [];
      for (const artifactId of node.outputs) {
        const relativePath = context.artifactPaths[artifactId];
        if (!relativePath) return { status: "failed", outputs: [], evidence: [], error: `no path binding for declared output ${artifactId}` };
        const absolutePath = path.join(context.workspaceDir, relativePath);
        if (!existsSync(absolutePath))
          return { status: "failed", outputs: [], evidence: [], error: `worker exited successfully but declared output is missing: ${relativePath}` };
        outputs.push({
          artifactId,
          path: relativePath,
          fingerprint: fingerprintPath(absolutePath),
          evidence: [`${runtime} worker produced ${relativePath}`, `knowledge receipt accepted for ${node.workflowId}`],
        });
      }
      return { status: "succeeded", outputs, evidence: [`${runtime} worker completed ${node.workflowId}`, `knowledge receipt accepted`] };
    },
  };
}

export interface NodeExecutor {
  execute(node: CompiledRunNode, context: NodeExecutionContext): Promise<NodeExecutionResult>;
}

/**
 * Deterministic stand-in for fixtures and rehearsal dry-runs (KTD1's `inline` adapter shape):
 * every declared output "succeeds" with a fingerprint derived from the node id, attempt id, and
 * output path — same inputs, same fingerprint, so fixture assertions stay stable across runs.
 */
export function createFixtureExecutor(): NodeExecutor {
  return {
    async execute(node, context): Promise<NodeExecutionResult> {
      const outputs: NodeExecutionOutput[] = node.outputs.map((artifactId) => ({
        artifactId,
        path: `fixture://${node.id}/${artifactId}`,
        fingerprint: `fixture-fp:${node.id}:${context.attemptId}:${artifactId}`,
        evidence: [`fixture executor: synthetic completion of ${node.id} for attempt ${context.attemptId}`],
      }));
      return { status: "succeeded", outputs, evidence: [`fixture executor: ${node.id} completed synthetically`] };
    },
  };
}

/**
 * Explicit diagnostic fallback. Production sessions now default to createCliExecutor("auto"); a
 * no-op executor never claims false
 * success — every attempt fails cleanly with a named reason, so a session run against a real
 * business without a real executor wired makes zero progress rather than fabricating outputs.
 */
export const noOpExecutor: NodeExecutor = {
  async execute(node): Promise<NodeExecutionResult> {
    return { status: "failed", outputs: [], evidence: [], error: `no-op executor: real execution for "${node.id}" is not wired yet (arrives in U6)` };
  },
};

/**
 * Test-only stand-in for a slow-but-alive real executor (U6's shape): waits `delayMs` and never
 * calls `context.heartbeat()`, so a caller can prove that liveness — core/session/run.ts's own
 * lock/attempt heartbeat refresh — no longer depends on the executor voluntarily cooperating.
 * Exists for the run.ts fixture suite; not selected by any founder-facing runtime profile.
 */
export function createSlowSilentExecutor(delayMs: number): NodeExecutor {
  return {
    async execute(node): Promise<NodeExecutionResult> {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      const outputs: NodeExecutionOutput[] = node.outputs.map((artifactId) => ({
        artifactId,
        path: `slow-silent://${node.id}/${artifactId}`,
        fingerprint: `slow-silent-fp:${node.id}:${artifactId}`,
        evidence: [`slow-silent executor: synthetic completion of ${node.id} after ${delayMs}ms without calling heartbeat`],
      }));
      return { status: "succeeded", outputs, evidence: [`slow-silent executor: ${node.id} completed after ${delayMs}ms without calling heartbeat`] };
    },
  };
}
