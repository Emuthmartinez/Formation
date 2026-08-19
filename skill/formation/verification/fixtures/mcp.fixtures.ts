import { cpSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { assert, skillRoot, type Harness } from "./_harness.js";
import { resolveTsxBin } from "../../tooling/lib/tsx-bin.js";

/**
 * The engine's MCP surface (core/mcp/server.ts): one real client conversation over stdio —
 * initialize handshake, tools/list, a successful tool call that reaches the real underlying CLI,
 * and a failing one whose exit code comes back as isError. Spawned as a driver script (the shared
 * harness's `check` runs fn() synchronously; an in-harness async conversation would race
 * cleanup()). No network, no worker CLIs: the exercised tools are the dry-run bootstrap and a
 * refusal path.
 */
export function register(harness: Harness): void {
  harness.check("mcp: initialize, tools/list, a real tool call, and exit-code passthrough over stdio", () => {
    const temp = harness.makeTempDir("mcp-conversation");
    const workspace = path.join(temp, "business");
    cpSync(path.join(skillRoot, "workspace", "business"), workspace, { recursive: true });
    // A2: the server resolves workspaces ONLY through the registry. The fixture registers the
    // copy under its own FORMATION_HOME and converses by id; raw paths must be refused.
    const formationHome = path.join(temp, "formation-home");
    const registered = spawnSync(resolveTsxBin(skillRoot), [path.join(skillRoot, "core/session/workspaces.ts"), "register", "fixture-business", workspace], {
      cwd: skillRoot,
      encoding: "utf8",
      env: { ...process.env, FORMATION_HOME: formationHome },
    });
    assert(registered.status === 0, `workspace registration failed: ${registered.stdout}\n${registered.stderr}`);
    const driverPath = path.join(temp, "drive-mcp.mts");
    const driverSource = `
import { spawn } from "node:child_process";
import readline from "node:readline";

const server = spawn(${JSON.stringify(resolveTsxBin(skillRoot))}, [${JSON.stringify(path.join(skillRoot, "core/mcp/server.ts"))}], {
  cwd: ${JSON.stringify(skillRoot)},
  env: { ...process.env, FORMATION_HOME: ${JSON.stringify(formationHome)} },
  stdio: ["pipe", "pipe", "inherit"],
});
const lines = readline.createInterface({ input: server.stdout });
const pending = new Map();
lines.on("line", (line) => {
  try {
    const message = JSON.parse(line);
    if (message.id !== undefined && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  } catch { /* non-JSON noise is not part of the protocol */ }
});
let nextId = 1;
function request(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    setTimeout(() => reject(new Error("timeout waiting for " + method)), 120_000).unref?.();
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\\n");
  });
}
async function main() {
  const init = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "fixture-driver", version: "0.0.0" },
  });
  if (init.result?.serverInfo?.name !== "formation") throw new Error("handshake: wrong server name: " + JSON.stringify(init.result?.serverInfo));
  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\\n");

  const list = await request("tools/list", {});
  const names = (list.result?.tools ?? []).map((tool) => tool.name);
  for (const expected of ["formation_bootstrap", "formation_plan", "formation_run", "formation_approvals", "formation_verify", "formation_schedule", "formation_status"]) {
    if (!names.includes(expected)) throw new Error("tools/list is missing " + expected + "; got " + names.join(", "));
  }

  const unregistered = await request("tools/call", { name: "formation_plan", arguments: { workspace: "/tmp/not-registered-anywhere" } });
  if (!unregistered.result?.isError) throw new Error("an unregistered path must be refused: " + JSON.stringify(unregistered.result).slice(0, 200));
  const refusalText = (unregistered.result?.content ?? []).map((entry) => entry.text).join("");
  if (!refusalText.includes("not a registered workspace")) throw new Error("refusal must explain registration, got: " + refusalText.slice(0, 200));

  const noAuthority = await request("tools/call", { name: "formation_approvals", arguments: { workspace: "fixture-business", approval: "workflow.x.approval.1", decision: "approved", session: "s-x" } });
  if (!noAuthority.result?.isError) throw new Error("deciding without asFounder must be refused");
  const authorityText = (noAuthority.result?.content ?? []).map((entry) => entry.text).join("");
  if (!authorityText.includes("founder-authority")) throw new Error("the asFounder refusal must name the rule, got: " + authorityText.slice(0, 200));

  const dryRun = await request("tools/call", { name: "formation_bootstrap", arguments: { workspace: "fixture-business" } });
  const dryText = (dryRun.result?.content ?? []).map((entry) => entry.text).join("\\n");
  if (dryRun.result?.isError) throw new Error("dry-run bootstrap must not be an error: " + dryText.slice(-300));
  if (!dryText.includes("Dry run only")) throw new Error("dry-run bootstrap must return the real CLI's plan, got: " + dryText.slice(0, 300));

  const refused = await request("tools/call", { name: "formation_approvals", arguments: { workspace: "fixture-business" } });
  if (!refused.result?.isError) throw new Error("a failing CLI must surface as isError: " + JSON.stringify(refused.result).slice(0, 300));
  const refusedText = (refused.result?.content ?? []).map((entry) => entry.text).join("\\n");
  if (!refusedText.includes("approve.no_run_state")) throw new Error("the underlying CLI's own error must reach the caller, got: " + refusedText.slice(0, 300));

  console.log("mcp-driver ok");
  server.kill();
}
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); server.kill(); process.exit(1); });
`;
    writeFileSync(driverPath, driverSource, "utf8");
    const result = spawnSync(resolveTsxBin(skillRoot), [driverPath], { cwd: skillRoot, encoding: "utf8", timeout: 300_000 });
    assert(
      result.status === 0 && (result.stdout ?? "").includes("mcp-driver ok"),
      `mcp driver failed (exit ${result.status}):\n${(result.stdout ?? "").slice(-400)}\n${(result.stderr ?? "").slice(-400)}`,
    );
  });
}
