import { cpSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { assert, skillRoot, type Harness } from "./_harness.js";

/**
 * The packaged `formation` bin (bin/formation.mjs): the engine's one installable command-line
 * address. These cases prove the dispatcher itself — help, unknown-command refusal, and that a
 * subcommand execs the REAL underlying CLI with exit codes passed through untouched (the bin adds
 * an address, never a second implementation). The underlying CLIs' own behavior is proven by
 * their own suites and check:engine-e2e; nothing here re-tests them.
 */

const binPath = path.join(skillRoot, "bin", "formation.mjs");

function runBin(args: string[], cwd = skillRoot): { code: number; output: string } {
  const result = spawnSync(process.execPath, [binPath, ...args], { cwd, encoding: "utf8" });
  return { code: result.status ?? -1, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

export function register(harness: Harness): void {
  harness.check("cli: the bin exists where the package.json bin field points", () => {
    assert(existsSync(binPath), `bin/formation.mjs is missing at ${binPath}`);
    const manifest = JSON.parse(readFileSync(path.join(skillRoot, "package.json"), "utf8")) as { bin?: Record<string, string> };
    assert(manifest.bin?.formation === "bin/formation.mjs", "package.json bin.formation must point at bin/formation.mjs");
  });

  harness.check("cli: --help lists every command and exits 0; no arguments exits 1", () => {
    const help = runBin(["--help"]);
    assert(help.code === 0, `--help must exit 0, got ${help.code}`);
    for (const command of ["bootstrap", "plan", "run", "approve", "verify", "onboard", "schedule"]) {
      assert(help.output.includes(command), `--help must list "${command}"`);
    }
    const bare = runBin([]);
    assert(bare.code === 1, `no arguments must exit 1, got ${bare.code}`);
  });

  harness.check("cli: an unknown command is refused with usage, never silently swallowed", () => {
    const result = runBin(["deploy-to-prod"]);
    assert(result.code === 1, `unknown command must exit 1, got ${result.code}`);
    assert(result.output.includes('unknown command "deploy-to-prod"'), "refusal must name the command");
  });

  harness.check("cli: a subcommand execs the real underlying CLI and passes its exit code through", () => {
    // bootstrap dry-run against a throwaway copy of the reference business: exit 0 with the
    // dry-run plan — proof the dispatcher reaches core/session/bootstrap.ts for real.
    const workspace = path.join(harness.makeTempDir("cli-bootstrap"), "business");
    cpSync(path.join(skillRoot, "workspace", "business"), workspace, { recursive: true });
    const dryRun = runBin(["bootstrap", "--workspace", workspace]);
    assert(dryRun.code === 0, `bootstrap dry-run must exit 0, got ${dryRun.code}: ${dryRun.output.slice(-300)}`);
    assert(dryRun.output.includes("Dry run only"), "bootstrap dry-run output must come from the real CLI");
    // And the failure path: run.ts without required arguments exits 1, passed through untouched.
    const failing = runBin(["run"]);
    assert(failing.code === 1, `run without arguments must pass through exit 1, got ${failing.code}`);
    assert(failing.output.includes("session.missing_argument"), "the underlying CLI's own error must reach the caller");
  });
}
