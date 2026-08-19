#!/usr/bin/env node
/**
 * formation-mcp — thin launcher for the engine's MCP server (core/mcp/server.ts). Same contract
 * as the formation bin: an address, never a second implementation. The server itself documents
 * the tool surface and the unchanged trust boundary.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const local = path.join(skillRoot, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
const result = spawnSync(existsSync(local) ? local : "tsx", [path.join(skillRoot, "core/mcp/server.ts")], { stdio: "inherit", cwd: skillRoot });
process.exit(result.status ?? 1);
