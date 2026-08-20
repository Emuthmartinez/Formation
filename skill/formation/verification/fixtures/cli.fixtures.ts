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

function runBin(args: string[], opts: { env?: Record<string, string>; cwd?: string } = {}): { code: number; output: string } {
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd: opts.cwd ?? skillRoot,
    encoding: "utf8",
    env: { ...process.env, ...(opts.env ?? {}) },
  });
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
    for (const command of ["setup", "doctor", "new", "bootstrap", "plan", "run", "approve", "verify", "scope", "onboard", "schedule", "workspaces", "list", "update"]) {
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

  harness.check("cli: the workspace registry round-trips register, list, and remove under FORMATION_HOME", () => {
    // The registry is the MCP server's entire allowlist (A2), so the full lifecycle is pinned
    // here: register -> visible in list -> remove -> gone, all inside a throwaway home so the
    // fixture never touches the maintainer's real ~/.formation.
    const temp = harness.makeTempDir("cli-workspaces");
    const env = { FORMATION_HOME: path.join(temp, "formation-home") };
    const workspace = path.join(temp, "business");
    cpSync(path.join(skillRoot, "workspace", "business"), workspace, { recursive: true });

    const registered = runBin(["workspaces", "register", "fixture-business", workspace], { env });
    assert(registered.code === 0, `register must exit 0, got ${registered.code}: ${registered.output.slice(-300)}`);
    const badId = runBin(["workspaces", "register", "Not_A_Slug", workspace], { env });
    assert(badId.code === 1, `a non-slug id must be refused, got exit ${badId.code}`);
    const listed = runBin(["workspaces", "list"], { env });
    assert(listed.code === 0 && listed.output.includes("fixture-business"), `list must show the registered id: ${listed.output.slice(-300)}`);
    const removed = runBin(["workspaces", "remove", "fixture-business"], { env });
    assert(removed.code === 0, `remove must exit 0, got ${removed.code}`);
    const emptied = runBin(["workspaces", "list"], { env });
    assert(emptied.code === 0 && !emptied.output.includes("fixture-business"), "a removed workspace must leave the list");
  });

  harness.check("cli: doctor reports health read-only and exits 0 with warnings allowed", () => {
    // A hermetic home: doctor must be runnable on a machine that has never run setup. Worker-CLI
    // absence is a WARNING by design (R12: sessions dispatch the owner's own agent CLIs), so the
    // exit code stays 0 wherever this fixture runs — including CI, which has no worker CLIs.
    const env = { FORMATION_HOME: path.join(harness.makeTempDir("cli-doctor"), "formation-home") };
    const doctor = runBin(["doctor"], { env });
    assert(doctor.code === 0, `doctor must exit 0 on a healthy install, got ${doctor.code}: ${doctor.output.slice(-400)}`);
    for (const code of ["doctor.node", "doctor.tsx", "doctor.catalog", "doctor.registry"]) {
      assert(doctor.output.includes(code), `doctor must report ${code}: ${doctor.output.slice(-400)}`);
    }
    assert(!doctor.output.includes("ERROR"), `a healthy repo checkout must produce no doctor errors: ${doctor.output.slice(-400)}`);
  });

  harness.check("cli: setup creates the formation home and registry, idempotently", () => {
    const home = path.join(harness.makeTempDir("cli-setup"), "formation-home");
    const env = { FORMATION_HOME: home };
    const first = runBin(["setup"], { env });
    assert(first.code === 0, `setup must exit 0, got ${first.code}: ${first.output.slice(-400)}`);
    assert(existsSync(path.join(home, "workspaces.json")), "setup must create the empty registry");
    assert(first.output.includes("Next steps:"), "setup must print the consumer's next steps");
    assert(first.output.includes("formation-mcp.mjs"), "setup must print the MCP registration command with the real server path");
    // The three agent runtimes the engine dispatches are the three the machine owner will want
    // the MCP server registered with — setup prints each runtime's own config shape.
    for (const runtime of ["claude mcp add", "~/.cursor/mcp.json", "~/.codex/config.toml"]) {
      assert(first.output.includes(runtime), `setup must print the ${runtime} registration`);
    }
    const second = runBin(["setup"], { env });
    assert(second.code === 0 && !second.output.includes("CREATED"), "a second setup run must change nothing");
  });

  harness.check("cli: new scaffolds a fresh business where the CALLER stands, and update dry-runs", () => {
    const temp = harness.makeTempDir("cli-new");
    // Relative --dir must resolve against the invoking shell's directory (FORMATION_CALLER_CWD),
    // not the package root — the exact bug a consumer would hit typing `formation new` at home.
    const born = runBin(["new", "corner-bakery", "--dir", "corner-bakery"], { cwd: temp });
    assert(born.code === 0, `new must exit 0, got ${born.code}: ${born.output.slice(-400)}`);
    assert(existsSync(path.join(temp, "corner-bakery", "state", "PROJECT_STATE.yaml")), "new must scaffold where the caller stands, not inside the package");
    const state = readFileSync(path.join(temp, "corner-bakery", "state", "PROJECT_STATE.yaml"), "utf8");
    assert(state.includes('slug: "corner-bakery"') && state.includes('name: "Corner Bakery"'), "new must stamp the slug and title-cased name");
    const badSlug = runBin(["new", "Corner_Bakery"], { cwd: temp });
    assert(badSlug.code === 1, `a non-slug name must be refused, got exit ${badSlug.code}`);

    // `update` is honest about where it runs: a git checkout dry-runs; an installed runtime
    // (the synced ~/.agents copy has no .git anywhere above it) refuses by name. Both are the
    // command working — the fixture asserts whichever contract applies to THIS install.
    const update = runBin(["update"]);
    if (gitCheckoutAbove(skillRoot)) {
      assert(update.code === 0, `update dry-run must exit 0 in a checkout, got ${update.code}: ${update.output.slice(-300)}`);
      assert(update.output.includes("Engine version:") && update.output.includes("Dry run only"), "update dry-run must report the version and stop");
    } else {
      assert(update.code === 1, `update outside a checkout must exit 1, got ${update.code}: ${update.output.slice(-300)}`);
      assert(update.output.includes("update.not_a_checkout"), "an installed runtime must refuse self-update by name with the tag-pinning guidance");
    }
  });
}

/** Mirrors update.ts's own detection: any .git (dir or worktree file) on the path above. */
function gitCheckoutAbove(start: string): boolean {
  let current = start;
  for (;;) {
    if (existsSync(path.join(current, ".git"))) return true;
    const parent = path.dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}
