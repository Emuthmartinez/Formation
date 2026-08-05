import type { CompiledRunNode } from "../engine/compile.js";

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
  /**
   * Refreshes this attempt's own heartbeat (and the session lock's) mid-execution. The fixture/
   * no-op executors resolve instantly and never need it, but a real executor (U6) awaiting a
   * long-running runtime CLI subprocess should call this periodically — otherwise a slow-but-alive
   * attempt's heartbeatAt goes stale under R12's TTL and a *later* session's detectOrphans wrongly
   * treats still-in-progress work as a dead attempt.
   */
  readonly heartbeat: () => void;
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
 * The safe default (KTD1: real execution "arrives in U6"). A no-op executor never claims false
 * success — every attempt fails cleanly with a named reason, so a session run against a real
 * business without a real executor wired makes zero progress rather than fabricating outputs.
 */
export const noOpExecutor: NodeExecutor = {
  async execute(node): Promise<NodeExecutionResult> {
    return { status: "failed", outputs: [], evidence: [], error: `no-op executor: real execution for "${node.id}" is not wired yet (arrives in U6)` };
  },
};
