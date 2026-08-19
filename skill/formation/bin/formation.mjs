#!/usr/bin/env node
/**
 * formation — the engine's packaged command-line face.
 *
 * One installable dispatcher over the session CLIs that already do the work, in the order a
 * business actually meets them:
 *
 *   formation bootstrap --workspace <dir> [--apply] [--answers <file>]   one-time workspace setup
 *   formation plan      --workspace <dir>                                read-only frontier report
 *   formation run       --workspace <dir> --brief <file> --session <id>  one bounded headless session
 *   formation approve   --workspace <dir> [--list] ...                   the founder decision edge
 *   formation verify    --workspace <dir> [--list] ...                   the operator verification edge
 *   formation onboard   --workspace <dir> --answers <file>               grants/waivers/budgets
 *   formation schedule  --workspace <dir> --runtime <cli> --schedule "<cron>" [--apply]
 *
 * Every subcommand execs the exact same TypeScript CLI the audit and fixtures prove
 * (core/session/*.ts, core/adapters/install-schedule.ts) — this file adds an address, never a
 * second implementation. Exit codes pass through untouched. Before this bin existed, an external
 * agent had to know the repository's internal tsx paths to invoke anything (2026-08-19 audit:
 * "no installable CLI — every entrypoint is `tsx <path>` from inside a checkout").
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const COMMANDS = new Map([
  ["bootstrap", { script: "core/session/bootstrap.ts", summary: "compose entrypoints, state migration, reducer baseline, and onboarding into a runnable workspace (dry-run by default)" }],
  ["plan", { script: "core/session/plan.ts", summary: "read-only frontier report: what would run, what is parked, and why" }],
  ["run", { script: "core/session/run.ts", summary: "one bounded headless session: resume durable state, dispatch, verify, digest" }],
  ["approve", { script: "core/session/approve.ts", summary: "grant or reject a pending founder approval on the durable run" }],
  ["verify", { script: "core/session/verify.ts", summary: "fresh-context acceptance for produced work (producer never verifies its own)" }],
  ["onboard", { script: "core/session/onboard.ts", summary: "apply founder grants, waivers, and budgets through the reducer" }],
  ["schedule", { script: "core/adapters/install-schedule.ts", summary: "install or remove the OS-level trigger for recurring sessions (dry-run by default)" }],
  ["workspaces", { script: "core/session/workspaces.ts", summary: "the machine's registry of its businesses: list, register, remove (the MCP allowlist)" }],
]);

function usage(code) {
  const lines = ["Usage: formation <command> [options]", "", "Commands:"];
  for (const [name, meta] of COMMANDS) lines.push(`  ${name.padEnd(10)} ${meta.summary}`);
  lines.push("", "Every command prints its own usage when run without required options.");
  console[code === 0 ? "log" : "error"](lines.join("\n"));
  return code;
}

function resolveTsx() {
  const local = path.join(skillRoot, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  return existsSync(local) ? local : "tsx";
}

const [command, ...rest] = process.argv.slice(2);
if (!command || command === "--help" || command === "-h" || command === "help") {
  process.exit(usage(command ? 0 : 1));
}
const target = COMMANDS.get(command);
if (!target) {
  console.error(`formation: unknown command "${command}"\n`);
  process.exit(usage(1));
}
const result = spawnSync(resolveTsx(), [path.join(skillRoot, target.script), ...rest], { stdio: "inherit", cwd: skillRoot });
process.exit(result.status ?? 1);
