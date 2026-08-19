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
 * The trust boundary is unchanged by this surface: state moves only through the reducer, founder
 * approvals only through approve.ts, verification only through verify.ts's producer≠verifier
 * rules, and a caller without filesystem access to the workspace cannot fabricate any of it.
 * The server itself holds no state and grants no authority — it is a calling convention.
 *
 * Run: formation-mcp (stdio transport; register it as an MCP server pointing at this bin).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

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

function runCli(script: string, args: string[]): { content: Array<{ type: "text"; text: string }>; isError?: boolean } {
  const result = spawnSync(resolveTsx(), [path.join(skillRoot, script), ...args], {
    cwd: skillRoot,
    encoding: "utf8",
    timeout: 3_600_000,
  });
  const text = `${result.stdout ?? ""}${result.stderr ? `\n${result.stderr}` : ""}`.trim() || `(exit ${String(result.status)})`;
  return { content: [{ type: "text", text }], ...(result.status === 0 ? {} : { isError: true }) };
}

const flag = (name: string, value: string | boolean | number | undefined): string[] =>
  value === undefined || value === false ? [] : value === true ? [`--${name}`] : [`--${name}`, String(value)];

const server = new McpServer({ name: "formation", version: skillVersion() });

server.registerTool(
  "formation_bootstrap",
  {
    description:
      "Make a launch workspace runnable by the engine: install the executable catalog, migrate v1 state, record the reducer baseline, and apply onboarding answers. Dry-run by default; pass apply: true to write. Idempotent — re-running a bootstrapped workspace is a no-op report.",
    inputSchema: {
      workspace: z.string().describe("Absolute path to the business workspace"),
      apply: z.boolean().optional().describe("Perform the steps (default: dry-run report only)"),
      answers: z.string().optional().describe("Path to an onboarding answers JSON (grants/waivers/budgets)"),
    },
  },
  async ({ workspace, apply, answers }) =>
    runCli("core/session/bootstrap.ts", ["--workspace", workspace, ...flag("apply", apply), ...flag("answers", answers)]),
);

server.registerTool(
  "formation_plan",
  {
    description:
      "Read-only frontier report for a workspace: what would run next, what is parked, and why — the same computation a real session performs, with no writes.",
    inputSchema: { workspace: z.string().describe("Absolute path to the business workspace") },
  },
  async ({ workspace }) => runCli("core/session/plan.ts", ["--workspace", workspace]),
);

server.registerTool(
  "formation_run",
  {
    description:
      "Run one bounded headless session: resume durable state, dispatch ready work within the founder's autonomy grants, verify, and write a founder-plain digest. Exits when done; never runs indefinitely.",
    inputSchema: {
      workspace: z.string().describe("Absolute path to the business workspace"),
      brief: z.string().describe("Path to the session brief JSON (businessSlug, founderContact)"),
      session: z.string().describe("Unique session id for this run"),
      executor: z.enum(["auto", "fixture", "noop"]).optional().describe("Worker executor (default auto: real worker CLIs)"),
      verifier: z.enum(["cli", "fixture", "off"]).optional().describe("Fresh-context verifier (default follows executor)"),
      wallClockSeconds: z.number().optional().describe("Session wall-clock cap (default 1800)"),
    },
  },
  async ({ workspace, brief, session, executor, verifier, wallClockSeconds }) =>
    runCli("core/session/run.ts", [
      "--workspace",
      workspace,
      "--brief",
      brief,
      "--session",
      session,
      ...flag("executor", executor),
      ...flag("verifier", verifier),
      ...flag("wall-clock-seconds", wallClockSeconds),
    ]),
);

server.registerTool(
  "formation_approvals",
  {
    description: "List pending founder approvals on the durable run, or record a decision. The founder edge: approving is the caller asserting founder authority.",
    inputSchema: {
      workspace: z.string().describe("Absolute path to the business workspace"),
      approval: z.string().optional().describe("Approval id to decide (omit to list pending)"),
      decision: z.enum(["approved", "rejected"]).optional().describe("Required with approval"),
      session: z.string().optional().describe("Deciding session id (required with approval)"),
      reason: z.string().optional().describe("Founder-stated reason (recorded on rejection)"),
    },
  },
  async ({ workspace, approval, decision, session, reason }) =>
    approval
      ? runCli("core/session/approve.ts", [
          "--workspace",
          workspace,
          "--approval",
          approval,
          ...flag("decision", decision),
          ...flag("session", session),
          ...flag("reason", reason),
        ])
      : runCli("core/session/approve.ts", ["--workspace", workspace, "--list"]),
);

server.registerTool(
  "formation_verify",
  {
    description:
      "List work parked pending fresh-context verification, or accept one node with evidence. Producer never verifies its own work — a session that produced the attempt is refused.",
    inputSchema: {
      workspace: z.string().describe("Absolute path to the business workspace"),
      node: z.string().optional().describe("Workflow or run-node id to accept (omit to list pending)"),
      session: z.string().optional().describe("Verifying session id (must not have produced the work)"),
      evidence: z.string().optional().describe("What was checked and why it holds (required to accept)"),
    },
  },
  async ({ workspace, node, session, evidence }) =>
    node
      ? runCli("core/session/verify.ts", ["--workspace", workspace, "--node", node, ...flag("session", session), ...flag("evidence", evidence)])
      : runCli("core/session/verify.ts", ["--workspace", workspace, "--list"]),
);

server.registerTool(
  "formation_schedule",
  {
    description:
      "Install or remove the OS-level trigger (crontab/launchd) that starts recurring headless sessions. Dry-run by default; installing a standing schedule is a founder-authority action — pass apply: true only with that authority.",
    inputSchema: {
      workspace: z.string().describe("Absolute path to the business workspace"),
      runtime: z.enum(["claude", "codex", "cursor"]).describe("Worker CLI the scheduled session uses"),
      schedule: z.string().describe('5-field cron expression, e.g. "0 9 * * 1"'),
      brief: z.string().optional().describe("Path to the session brief JSON (default <workspace>/brief.json)"),
      apply: z.boolean().optional().describe("Touch the real crontab/launchd (default: dry-run)"),
      uninstall: z.boolean().optional().describe("Remove this workspace+runtime's schedule instead"),
    },
  },
  async ({ workspace, runtime, schedule, brief, apply, uninstall }) =>
    runCli("core/adapters/install-schedule.ts", [
      "--workspace",
      workspace,
      "--runtime",
      runtime,
      "--schedule",
      schedule,
      ...flag("brief", brief),
      ...flag("apply", apply),
      ...flag("uninstall", uninstall),
    ]),
);

await server.connect(new StdioServerTransport());
