#!/usr/bin/env node
/**
 * Workspace registry CLI (`formation workspaces ...`): the machine's list of its businesses.
 * Addresses only — see core/adapters/registry.ts for why the registry never carries business
 * truth. This CLI is also how a workspace earns MCP access: the server refuses anything the
 * registry does not name.
 *
 * Usage:
 *   tsx core/session/workspaces.ts list
 *   tsx core/session/workspaces.ts register <id> <path>
 *   tsx core/session/workspaces.ts remove <id>
 *
 * Exit codes: 0 = done; 1 = invalid input or unknown id.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isMainModule } from "../lib/cli.js";
import { loadRegistry, registerWorkspace, removeWorkspace, registryPath } from "../adapters/registry.js";

/** One line of business status from the workspace's own durable run state; never a second store. */
function workspaceStatus(workspacePath: string): string {
  if (!existsSync(workspacePath)) return "MISSING — path no longer exists";
  const runStatePath = path.join(workspacePath, "run", "run-state.json");
  if (!existsSync(runStatePath)) return existsSync(path.join(workspacePath, "catalog.json")) ? "bootstrapped, no session yet" : "not bootstrapped";
  try {
    const run = JSON.parse(readFileSync(runStatePath, "utf8")) as { nodes?: Record<string, { status?: string }> };
    const counts = new Map<string, number>();
    for (const node of Object.values(run.nodes ?? {})) counts.set(node.status ?? "unknown", (counts.get(node.status ?? "unknown") ?? 0) + 1);
    return (
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([status, count]) => `${count} ${status}`)
        .join(", ") || "run state empty"
    );
  } catch {
    return "run state unreadable";
  }
}

function list(): number {
  const registry = loadRegistry();
  if (registry.workspaces.length === 0) {
    console.log(`No workspaces registered yet (${registryPath()}). Register one: formation workspaces register <id> <path>`);
    return 0;
  }
  for (const entry of registry.workspaces) {
    console.log(`${entry.id}\t${entry.path}\t${workspaceStatus(entry.path)}\t(registered ${entry.registeredAt.slice(0, 10)})`);
  }
  return 0;
}

function main(): number {
  const [command, ...rest] = process.argv.slice(2);
  try {
    if (command === "list" || command === undefined) return list();
    if (command === "register") {
      const [id, workspacePath] = rest;
      if (!id || !workspacePath) {
        console.error("Usage: formation workspaces register <id> <path>");
        return 1;
      }
      // The bin spawns this CLI with cwd at the package root, so a relative path from the
      // caller's shell must resolve against THEIR directory, not ours.
      const resolved = path.resolve(process.env.FORMATION_CALLER_CWD?.trim() || process.cwd(), workspacePath);
      registerWorkspace(id, resolved);
      console.log(`REGISTERED ${id} -> ${resolved}`);
      return 0;
    }
    if (command === "remove") {
      const [id] = rest;
      if (!id) {
        console.error("Usage: formation workspaces remove <id>");
        return 1;
      }
      removeWorkspace(id);
      console.log(`REMOVED ${id}`);
      return 0;
    }
    console.error(`workspaces: unknown command "${command}" (expected list, register, remove)`);
    return 1;
  } catch (error) {
    console.error(`ISSUE ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (isMainModule(import.meta.url)) {
  process.exitCode = main();
}
