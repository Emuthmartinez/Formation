#!/usr/bin/env node
/**
 * formation-mcp — the engine as a Model Context Protocol server (stdio).
 *
 * Every tool execs the exact same CLI the packaged `formation` bin dispatches to and the audit
 * proves (core/session/*.ts, core/adapters/install-schedule.ts): this server adds a typed,
 * discoverable address for MCP-speaking agents, never a second implementation. Exit codes map to
 * isError; stdout/stderr come back verbatim as the tool result, because those CLIs already speak
 * in complete, founder-plain sentences.
 *
 * Hardening (layering plan A2):
 * - Workspace references resolve ONLY through the registry (core/adapters/registry.ts): a tool
 *   call names a registered id or the exact registered path; anything else is refused with the
 *   registration command in the message. Traversal is impossible by construction — resolution
 *   never returns a path the registry does not already contain.
 * - Founder-authority actions (deciding an approval, touching the OS schedule) require an
 *   explicit `asFounder: true`: the caller asserts founder authority in the call itself, and the
 *   honest limit stays documented — real enforcement is control-directory ownership at the OS
 *   level, exactly as it is for a human at the same keyboard.
 * - FORMATION_MCP_READONLY=1 registers only the read tools (plan, status) — the mode a
 *   monitoring surface or untrusted context gets.
 *
 * The trust boundary is otherwise unchanged: state moves only through the reducer, approvals
 * only through approve.ts, verification only under producer-never-verifies rules. The server
 * holds no state and grants no authority — it is a calling convention.
 *
 * Run: formation-mcp (stdio transport; register it as an MCP server pointing at this bin).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolveRegisteredWorkspace } from "../adapters/registry.js";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function skillVersion(): string {
  try {
    return (JSON.parse(readFileSync(path.join(skillRoot, "skill-version.json"), "utf8")) as { version?: string }).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function resolveTsx(): string {
  const local = path.join(skillRoot, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  return existsSync(local) ? local : "tsx";
}

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

function refusal(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function runCli(script: string, args: string[]): ToolResult {
  const result = spawnSync(resolveTsx(), [path.join(skillRoot, script), ...args], {
    cwd: skillRoot,
    encoding: "utf8",
    timeout: 3_600_000,
  });
  const text = `${result.stdout ?? ""}${result.stderr ? `\n${result.stderr}` : ""}`.trim() || `(exit ${String(result.status)})`;
  return { content: [{ type: "text", text }], ...(result.status === 0 ? {} : { isError: true }) };
}

/** Registry-only resolution: the allowlist rule every tool shares. */
function workspaceOr(reference: string): { ok: true; path: string } | { ok: false; result: ToolResult } {
  const resolved = resolveRegisteredWorkspace(reference);
  if ("refused" in resolved) return { ok: false, result: refusal(resolved.message) };
  return { ok: true, path: resolved.path };
}

const flag = (name: string, value: string | boolean | number | undefined): string[] =>
  value === undefined || value === false ? [] : value === true ? [`--${name}`] : [`--${name}`, String(value)];

const WORKSPACE_ARG = z.string().describe("A REGISTERED workspace id (or its exact registered path). Register with: formation workspaces register <id> <path>");

const readOnly = process.env.FORMATION_MCP_READONLY === "1";
const server = new McpServer({ name: "formation", version: skillVersion() });

server.registerTool(
  "formation_plan",
  {
    description: "Read-only frontier report for a registered workspace: what would run next, what is parked, and why — the same computation a real session performs, with no writes.",
    inputSchema: { workspace: WORKSPACE_ARG },
  },
  async ({ workspace }) => {
    const resolved = workspaceOr(workspace);
    if (!resolved.ok) return resolved.result;
    return runCli("core/session/plan.ts", ["--workspace", resolved.path]);
  },
);

server.registerTool(
  "formation_status",
  {
    description: "Read-only status of a registered workspace: the durable run's node-status counts and the latest founder digest. Reads files; runs nothing.",
    inputSchema: { workspace: WORKSPACE_ARG },
  },
  async ({ workspace }) => {
    const resolved = workspaceOr(workspace);
    if (!resolved.ok) return resolved.result;
    const lines: string[] = [];
    const runStatePath = path.join(resolved.path, "run", "run-state.json");
    if (existsSync(runStatePath)) {
      const run = JSON.parse(readFileSync(runStatePath, "utf8")) as { runId?: string; updatedAt?: string; nodes?: Record<string, { status?: string }> };
      const counts = new Map<string, number>();
      for (const node of Object.values(run.nodes ?? {})) counts.set(node.status ?? "unknown", (counts.get(node.status ?? "unknown") ?? 0) + 1);
      lines.push(`Run ${run.runId ?? "(unknown)"} — updated ${run.updatedAt ?? "(unknown)"}`);
      lines.push([...counts.entries()].sort((a, b) => b[1] - a[1]).map(([status, count]) => `${status}: ${count}`).join(", "));
    } else {
      lines.push("No durable run yet — bootstrap the workspace and run a session first.");
    }
    const digestsDir = path.join(resolved.path, "digests");
    if (existsSync(digestsDir)) {
      const latest = readdirSync(digestsDir).filter((name) => name.endsWith(".md")).sort().at(-1);
      if (latest) {
        lines.push("", `Latest digest (${latest}):`, readFileSync(path.join(digestsDir, latest), "utf8").trim());
      }
    }
    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

if (!readOnly) {
  server.registerTool(
    "formation_bootstrap",
    {
      description:
        "Make a registered workspace runnable by the engine: install the executable catalog, migrate v1 state, record the reducer baseline, and apply onboarding answers. Dry-run by default; pass apply: true to write. Idempotent.",
      inputSchema: {
        workspace: WORKSPACE_ARG,
        apply: z.boolean().optional().describe("Perform the steps (default: dry-run report only)"),
        answers: z.string().optional().describe("Path to an onboarding answers JSON (grants/waivers/budgets)"),
      },
    },
    async ({ workspace, apply, answers }) => {
      const resolved = workspaceOr(workspace);
      if (!resolved.ok) return resolved.result;
      return runCli("core/session/bootstrap.ts", ["--workspace", resolved.path, ...flag("apply", apply), ...flag("answers", answers)]);
    },
  );

  server.registerTool(
    "formation_run",
    {
      description:
        "Run one bounded headless session against a registered workspace: resume durable state, dispatch ready work within the founder's autonomy grants, verify, and write a founder-plain digest. Exits when done; never runs indefinitely.",
      inputSchema: {
        workspace: WORKSPACE_ARG,
        brief: z.string().describe("Path to the session brief JSON (businessSlug, founderContact)"),
        session: z.string().describe("Unique session id for this run"),
        executor: z.enum(["auto", "fixture", "noop"]).optional().describe("Worker executor (default auto: real worker CLIs)"),
        verifier: z.enum(["cli", "fixture", "off"]).optional().describe("Fresh-context verifier (default follows executor)"),
        wallClockSeconds: z.number().optional().describe("Session wall-clock cap (default 1800)"),
      },
    },
    async ({ workspace, brief, session, executor, verifier, wallClockSeconds }) => {
      const resolved = workspaceOr(workspace);
      if (!resolved.ok) return resolved.result;
      return runCli("core/session/run.ts", [
        "--workspace",
        resolved.path,
        "--brief",
        brief,
        "--session",
        session,
        ...flag("executor", executor),
        ...flag("verifier", verifier),
        ...flag("wall-clock-seconds", wallClockSeconds),
      ]);
    },
  );

  server.registerTool(
    "formation_approvals",
    {
      description:
        "List pending founder approvals on a registered workspace's durable run, or record a decision. Deciding requires asFounder: true — the caller asserts founder authority in the call; the engine records the decision in the hash-chained audit log either way.",
      inputSchema: {
        workspace: WORKSPACE_ARG,
        approval: z.string().optional().describe("Approval id to decide (omit to list pending)"),
        decision: z.enum(["approved", "rejected"]).optional().describe("Required with approval"),
        session: z.string().optional().describe("Deciding session id (required with approval)"),
        reason: z.string().optional().describe("Founder-stated reason (recorded on rejection)"),
        asFounder: z.boolean().optional().describe("REQUIRED true to decide: the caller asserts founder authority"),
      },
    },
    async ({ workspace, approval, decision, session, reason, asFounder }) => {
      const resolved = workspaceOr(workspace);
      if (!resolved.ok) return resolved.result;
      if (!approval) return runCli("core/session/approve.ts", ["--workspace", resolved.path, "--list"]);
      if (asFounder !== true) {
        return refusal(
          "Deciding an approval is a founder-authority action. Pass asFounder: true only when the founder (or their standing authorization) is behind this call — the decision is attested in the audit log under the session id you supply.",
        );
      }
      return runCli("core/session/approve.ts", [
        "--workspace",
        resolved.path,
        "--approval",
        approval,
        ...flag("decision", decision),
        ...flag("session", session),
        ...flag("reason", reason),
      ]);
    },
  );

  server.registerTool(
    "formation_verify",
    {
      description:
        "List work parked pending fresh-context verification on a registered workspace, or accept one node with evidence. Producer never verifies its own work — a session that produced the attempt is refused mechanically.",
      inputSchema: {
        workspace: WORKSPACE_ARG,
        node: z.string().optional().describe("Workflow or run-node id to accept (omit to list pending)"),
        session: z.string().optional().describe("Verifying session id (must not have produced the work)"),
        evidence: z.string().optional().describe("What was checked and why it holds (required to accept)"),
      },
    },
    async ({ workspace, node, session, evidence }) => {
      const resolved = workspaceOr(workspace);
      if (!resolved.ok) return resolved.result;
      return node
        ? runCli("core/session/verify.ts", ["--workspace", resolved.path, "--node", node, ...flag("session", session), ...flag("evidence", evidence)])
        : runCli("core/session/verify.ts", ["--workspace", resolved.path, "--list"]);
    },
  );

  server.registerTool(
    "formation_schedule",
    {
      description:
        "Install or remove the OS-level trigger (crontab/launchd) that starts recurring headless sessions for a registered workspace. Dry-run needs no authority; applying or uninstalling is a standing change to this machine and requires asFounder: true.",
      inputSchema: {
        workspace: WORKSPACE_ARG,
        runtime: z.enum(["claude", "codex", "cursor"]).describe("Worker CLI the scheduled session uses"),
        schedule: z.string().describe('5-field cron expression, e.g. "0 9 * * 1"'),
        brief: z.string().optional().describe("Path to the session brief JSON (default <workspace>/brief.json)"),
        apply: z.boolean().optional().describe("Touch the real crontab/launchd (default: dry-run)"),
        uninstall: z.boolean().optional().describe("Remove this workspace+runtime's schedule instead"),
        asFounder: z.boolean().optional().describe("REQUIRED true with apply or uninstall: a standing schedule on this machine is the founder's call"),
      },
    },
    async ({ workspace, runtime, schedule, brief, apply, uninstall, asFounder }) => {
      const resolved = workspaceOr(workspace);
      if (!resolved.ok) return resolved.result;
      if ((apply === true || uninstall === true) && asFounder !== true) {
        return refusal(
          "Installing, changing, or removing the recurring schedule is a standing change to this machine — a founder-authority action. Run the dry-run freely; pass asFounder: true with apply/uninstall only when the founder is behind this call.",
        );
      }
      return runCli("core/adapters/install-schedule.ts", [
        "--workspace",
        resolved.path,
        "--runtime",
        runtime,
        "--schedule",
        schedule,
        ...flag("brief", brief),
        ...flag("apply", apply),
        ...flag("uninstall", uninstall),
      ]);
    },
  );
}

await server.connect(new StdioServerTransport());
