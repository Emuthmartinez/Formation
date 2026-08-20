#!/usr/bin/env node
/**
 * formation setup — the one-time machine preparation, idempotent.
 *
 * Creates the formation home and an empty workspace registry when absent, runs the same health
 * checks as `formation doctor`, and prints the next steps with real, copy-pasteable commands —
 * including the MCP registration line with this install's absolute server path. It never touches
 * a workspace and never installs anything: worker CLIs are the machine owner's own tools
 * (doctor's R12 rule), so setup names what is missing rather than fetching it.
 *
 * Exit codes: 0 = machine ready (warnings allowed); 1 = the install itself is broken.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formationHome, registryPath } from "../adapters/registry.js";
import { printFindings, runDoctor } from "./doctor.js";
import { isMainModule } from "../lib/cli.js";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function main(): number {
  const home = formationHome();
  if (!existsSync(home)) {
    mkdirSync(home, { recursive: true });
    console.log(`CREATED ${home}`);
  }
  const registry = registryPath();
  if (!existsSync(registry)) {
    writeFileSync(registry, `${JSON.stringify({ schemaVersion: "1.0.0", workspaces: [] }, null, 2)}\n`, "utf8");
    console.log(`CREATED ${registry} (empty registry)`);
  }

  const code = printFindings(runDoctor());

  const mcpServer = path.join(skillRoot, "bin", "formation-mcp.mjs");
  const cli = path.join(skillRoot, "bin", "formation.mjs");
  console.log(
    [
      "",
      "Next steps:",
      `  1. Create a business:            formation new <slug> --dir <where>`,
      `  2. Make it runnable:             formation bootstrap --workspace <where> --apply --answers <answers.json>`,
      `  3. Let this machine address it:  formation workspaces register <slug> <where>`,
      `  4. See every business:           formation list`,
      "",
      `Global \`formation\` command (optional): npm link --prefix ${skillRoot}`,
      `Without linking, the command is: node ${cli}`,
      "",
      "Register the MCP server with the agent runtime(s) on this machine — same server, three configs:",
      "",
      `  Claude Code:  claude mcp add --scope user formation -- node ${mcpServer}`,
      "",
      "  Cursor — merge into ~/.cursor/mcp.json under \"mcpServers\":",
      `    "formation": { "command": "node", "args": ["${mcpServer}"] }`,
      "",
      "  Codex CLI (ChatGPT) — append to ~/.codex/config.toml:",
      "    [mcp_servers.formation]",
      '    command = "node"',
      `    args = ["${mcpServer}"]`,
      "",
      "The server only addresses workspaces registered in step 3; approval decisions and schedule",
      "installs additionally require an explicit asFounder assertion. FORMATION_MCP_READONLY=1",
      "narrows the surface to formation_plan and formation_status.",
    ].join("\n"),
  );
  return code;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = main();
}
