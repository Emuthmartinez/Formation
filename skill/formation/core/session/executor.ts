import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { CompiledRunNode } from "../engine/compile.js";
import { composeNodeBrief } from "../engine/node-brief.js";
import {
  buildVerifierPrompt,
  buildWorkerPrompt,
  parseVerifierVerdict,
  validateKnowledgeReceipt,
  type VerifierOutputRef,
  type WorkerAuthorization,
} from "./worker-prompt.js";

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
  /** Exact dispatch-time authority, hashed into the prompt/receipt so a worker cannot widen it. */
  readonly authorization?: WorkerAuthorization;
  /** Scoped reason supplied by a downstream node that reopened this dependency. */
  readonly refreshInstructions?: readonly string[];
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

/** Every worker runtime the engine can dispatch, with availability probed on THIS machine — doctor's one source of truth for R12. */
export function detectWorkerRuntimes(): Array<{ runtime: Exclude<WorkerRuntime, "auto">; command: string; available: boolean }> {
  return (["codex", "claude", "cursor"] as const).map((runtime) => ({
    runtime,
    command: runtimeCommands[runtime],
    available: available(runtimeCommands[runtime]),
  }));
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

/** Standard SHA-256 of file bytes, reproducible with `sha256sum` or `shasum -a 256`. */
export function receiptFileDigest(target: string): string {
  const stat = lstatSync(target);
  if (!stat.isFile()) throw new Error(`receipt digest target must be a regular file: ${target}`);
  return createHash("sha256").update(readFileSync(target)).digest("hex");
}

/** Internal artifact fingerprint supports directory outputs; it is not a worker receipt digest. */
function outputFingerprintPath(target: string): string {
  const hash = createHash("sha256");
  const visit = (current: string, relative: string): void => {
    const stat = lstatSync(current);
    hash.update(`${relative}\0${stat.mode}\0${stat.size}\0`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(current).sort()) visit(path.join(current, name), path.posix.join(relative, name));
    } else if (stat.isFile()) hash.update(readFileSync(current));
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
    const child = spawn(command.command, [...command.args], { cwd, env: workerEnvironment(command.runtime), stdio: ["ignore", "pipe", "pipe"] });
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

/** Do not leak arbitrary session/provider secrets into a specialist subprocess. */
function workerEnvironment(runtime: Exclude<WorkerRuntime, "auto">): NodeJS.ProcessEnv {
  const allowed = ["PATH", "HOME", "SHELL", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "TERM", "COLORTERM", "CI", "XDG_CONFIG_HOME", "CODEX_HOME"];
  if (runtime === "codex") allowed.push("OPENAI_API_KEY");
  if (runtime === "claude") allowed.push("ANTHROPIC_API_KEY");
  // Doppler is the skill's approved secret-injection boundary. Forward its service token, not
  // arbitrary provider-specific variables; operators may add narrowly reviewed names explicitly.
  allowed.push("DOPPLER_TOKEN");
  for (const key of (process.env.B2C_WORKER_ENV_ALLOWLIST ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean))
    allowed.push(key);
  const env: NodeJS.ProcessEnv = {};
  for (const key of allowed) if (process.env[key] !== undefined) env[key] = process.env[key];
  env.B2C_WORKER_SANDBOX = "workspace-write";
  return env;
}

function resolvedInside(root: string, relativePath: string): string | undefined {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  return resolved === resolvedRoot || resolved.startsWith(`${resolvedRoot}${path.sep}`) ? resolved : undefined;
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
      if (context.refreshInstructions?.length) {
        brief.instructions = `${brief.instructions}\n\nRefresh scope for this dispatch:\n${context.refreshInstructions.map((entry) => `- ${entry}`).join("\n")}`;
      }
      const fileDigests: Record<string, string> = {};
      for (const contractPath of brief.contractFiles) {
        const absolute = resolvedInside(context.workspaceDir, contractPath);
        if (!absolute || !existsSync(absolute))
          return { status: "failed", outputs: [], evidence: [], error: `worker contract file is missing: ${contractPath}` };
        fileDigests[contractPath] = `sha256:${receiptFileDigest(absolute)}`;
      }
      for (const artifactPath of brief.open) {
        const absolute = resolvedInside(context.workspaceDir, artifactPath);
        if (!absolute || !existsSync(absolute))
          return { status: "failed", outputs: [], evidence: [], error: `required worker task artifact is missing: ${artifactPath}` };
        fileDigests[artifactPath] = `sha256:${receiptFileDigest(absolute)}`;
      }
      for (const reference of brief.load) {
        const absolute = resolvedInside(context.skillRootDir, reference.path);
        if (!absolute || !existsSync(absolute))
          return { status: "failed", outputs: [], evidence: [], error: `mandatory worker knowledge is missing: ${reference.path}` };
        fileDigests[reference.path] = `sha256:${receiptFileDigest(absolute)}`;
      }
      for (const reference of brief.route) {
        const absolute = resolvedInside(context.skillRootDir, reference.path);
        if (!absolute || !existsSync(absolute))
          return { status: "failed", outputs: [], evidence: [], error: `conditional worker knowledge route is missing: ${reference.path}` };
        fileDigests[reference.path] = `sha256:${receiptFileDigest(absolute)}`;
      }
      const expectations = { fileDigests, authorization: context.authorization };
      const prompt = buildWorkerPrompt(brief, context.workspaceDir, context.skillRootDir, expectations);
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
      const receiptIssues = validateKnowledgeReceipt(`${result.stdout}\n${result.stderr}`, brief, expectations);
      if (receiptIssues.length > 0)
        return { status: "failed", outputs: [], evidence: [], error: `worker knowledge receipt rejected: ${receiptIssues.join("; ")}` };
      const outputs: NodeExecutionOutput[] = [];
      for (const artifactId of node.outputs) {
        const relativePath = context.artifactPaths[artifactId];
        if (!relativePath) return { status: "failed", outputs: [], evidence: [], error: `no path binding for declared output ${artifactId}` };
        const absolutePath = resolvedInside(context.workspaceDir, relativePath);
        if (!absolutePath || !existsSync(absolutePath))
          return { status: "failed", outputs: [], evidence: [], error: `worker exited successfully but declared output is missing: ${relativePath}` };
        outputs.push({
          artifactId,
          path: relativePath,
          fingerprint: outputFingerprintPath(absolutePath),
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
 * every declared output "succeeds" with a fingerprint derived from the node id and output path —
 * same inputs, same fingerprint, so fixture assertions stay stable across runs. The attempt id is
 * deliberately NOT part of the fingerprint: a real deterministic producer re-emitting unchanged
 * content yields an unchanged content hash, and modeling it otherwise made every fixture re-run
 * of a stale node "change" its outputs, re-invalidating the entire downstream graph each session
 * (found 2026-08-19 by check:engine-e2e — session 2 finished with FEWER succeeded nodes than
 * session 1, and the staleness churn never converged).
 */
export function createFixtureExecutor(): NodeExecutor {
  return {
    async execute(node, context): Promise<NodeExecutionResult> {
      const outputs: NodeExecutionOutput[] = node.outputs.map((artifactId) => ({
        artifactId,
        path: `fixture://${node.id}/${artifactId}`,
        fingerprint: `fixture-fp:${node.id}:${artifactId}`,
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

// --- fresh-context verification seam --------------------------------------------------------------

/**
 * "unavailable" is deliberately distinct from "rejected": a verifier that could not run (no CLI
 * installed, timeout, malformed verdict) has judged nothing, and treating silence as a rejection
 * would be as dishonest as treating it as acceptance. The caller reports it as an unrun check.
 */
export interface VerificationOutcome {
  readonly status: "accepted" | "rejected" | "unavailable";
  readonly evidence: string;
  readonly error?: string;
}

export interface NodeVerificationContext {
  readonly workspaceDir: string;
  readonly skillRootDir: string;
  readonly outputs: readonly VerifierOutputRef[];
  readonly now: string;
}

export interface NodeVerifier {
  verify(node: CompiledRunNode, context: NodeVerificationContext): Promise<VerificationOutcome>;
}

/**
 * Read-only where the runtime can enforce it: the verifier judges, never repairs, and a sandbox
 * that cannot write makes that rule mechanical rather than a prompt request. Claude's CLI has no
 * read-only sandbox flag, so its verifier invocation relies on the prompt contract alone — the
 * same trust position as a human reviewer with a writable checkout.
 */
export function buildVerifierCommand(runtime: Exclude<WorkerRuntime, "auto">, prompt: string): WorkerCommand {
  if (runtime === "codex") return { runtime, command: "codex", args: ["exec", "--sandbox", "read-only", "--json", prompt], prompt };
  if (runtime === "claude") return { runtime, command: "claude", args: ["-p", "--bare", "--output-format", "json", "--max-turns", "15", prompt], prompt };
  return { runtime, command: "cursor-agent", args: ["agent", "-p", prompt, "--sandbox", "enabled"], prompt };
}

/** Real fresh-context verifier: a separate worker-CLI subprocess judges the produced outputs against the same brief the producer worked from. */
export function createCliVerifier(requestedRuntime: WorkerRuntime = "auto"): NodeVerifier {
  return {
    async verify(node, context): Promise<VerificationOutcome> {
      const runtimes = workerRuntimeCandidates(requestedRuntime);
      if (runtimes.length === 0) {
        return { status: "unavailable", evidence: "", error: `no worker CLI is installed for requested runtime ${requestedRuntime}` };
      }
      const brief = composeNodeBrief(node, {
        planId: `verify:${context.now}`,
        planRevision: 0,
        catalogVersion: "runtime",
        compiledAt: context.now,
        nodes: [node],
        artifactBindings: context.outputs.map((output) => ({ artifactId: output.artifactId, path: output.path, accepted: false })),
      });
      const prompt = buildVerifierPrompt(brief, context.workspaceDir, context.skillRootDir, context.outputs);
      let runtime = runtimes[0]!;
      let result: Awaited<ReturnType<typeof runWorker>> | undefined;
      for (const candidate of runtimes) {
        runtime = candidate;
        result = await runWorker(buildVerifierCommand(candidate, prompt), context.workspaceDir, node.ttlSeconds * 1000);
        const failureText = `${result.stdout}\n${result.stderr}`;
        if (result.status === 0 || requestedRuntime !== "auto" || !/(auth|log[ -]?in|api[_ -]?key|unauthori[sz]ed|credential)/i.test(failureText)) break;
      }
      if (!result) return { status: "unavailable", evidence: "", error: "verifier runtime selection produced no invocation" };
      if (result.timedOut) return { status: "unavailable", evidence: "", error: `${runtime} verifier exceeded ${node.ttlSeconds}s TTL` };
      if (result.status !== 0) {
        return { status: "unavailable", evidence: "", error: `${runtime} verifier exited ${String(result.status)}: ${result.stderr.trim().slice(-800)}` };
      }
      const parsed = parseVerifierVerdict(`${result.stdout}\n${result.stderr}`, brief);
      if (!parsed.verdict) {
        // A malformed verdict is not a judgment. Refusing to guess here is what keeps "accepted"
        // meaning a fresh context actually said so.
        return { status: "unavailable", evidence: "", error: `verifier verdict rejected: ${parsed.issues.join("; ")}` };
      }
      return { status: parsed.verdict.verdict, evidence: `${runtime} verifier: ${parsed.verdict.evidence}` };
    },
  };
}

/** Deterministic stand-in for fixtures and the e2e gate — accepts (or rejects) every node with synthetic evidence. */
export function createFixtureVerifier(verdict: "accepted" | "rejected" = "accepted"): NodeVerifier {
  return {
    async verify(node): Promise<VerificationOutcome> {
      return verdict === "accepted"
        ? { status: "accepted", evidence: `fixture verifier: independently reviewed ${node.id} and accepted it (synthetic)` }
        : { status: "rejected", evidence: `fixture verifier: independently reviewed ${node.id} and rejected it (synthetic)` };
    },
  };
}

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
