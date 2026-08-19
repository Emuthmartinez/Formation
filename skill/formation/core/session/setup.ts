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
  console.log(
    [
      "",
      "Next steps:",
      `  1. Create a business:            formation new <slug> --dir <where>`,
      `  2. Make it runnable:             formation bootstrap --workspace <where> --apply --answers <answers.json>`,
      `  3. Let this machine address it:  formation workspaces register <slug> <where>`,
      `  4. See every business:           formation list`,
      `  5. Register the MCP server:      claude mcp add formation -- node ${mcpServer}`,
      "     (any MCP-capable agent runtime works; the command and args are the same)",
    ].join("\n"),
  );
  return code;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = main();
}
