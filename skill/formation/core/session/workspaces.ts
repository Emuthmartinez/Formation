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
import { isMainModule } from "../lib/cli.js";
import { loadRegistry, registerWorkspace, removeWorkspace, registryPath } from "../adapters/registry.js";

function list(): number {
  const registry = loadRegistry();
  if (registry.workspaces.length === 0) {
    console.log(`No workspaces registered yet (${registryPath()}). Register one: formation workspaces register <id> <path>`);
    return 0;
  }
  for (const entry of registry.workspaces) console.log(`${entry.id}\t${entry.path}\t(registered ${entry.registeredAt.slice(0, 10)})`);
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
      registerWorkspace(id, workspacePath);
      console.log(`REGISTERED ${id} -> ${workspacePath}`);
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
