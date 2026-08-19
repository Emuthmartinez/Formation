import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Harness } from "./_harness.js";

/**
 * Fixtures for tooling/runtime-sync.ts — the ownership-tracked installed-runtime
 * sync. Each ownership rule the tool exists to enforce gets a live proof here:
 * conflicts block, bootstrap requires --adopt, unowned files survive, owned
 * orphans are deleted, and a clean tree reports no drift. The old rsync
 * procedure failed every one of these silently.
 */

function git(cwd: string, args: string[]): void {
  const result = spawnSync("git", ["-c", "user.email=fixture@test", "-c", "user.name=fixture", ...args], { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${result.stderr}`);
}

/** A git-tracked source tree (git ls-files is the tool's source manifest). */
function writeSourceTree(root: string): string {
  const source = path.join(root, "source");
  mkdirSync(path.join(source, "sub"), { recursive: true });
  writeFileSync(path.join(source, "a.txt"), "alpha v1\n");
  writeFileSync(path.join(source, "sub", "b.txt"), "beta v1\n");
  writeFileSync(path.join(source, "skill-version.json"), JSON.stringify({ version: "0.0.1-fixture" }));
  git(source, ["init", "-q"]);
  git(source, ["add", "-A"]);
  git(source, ["commit", "-qm", "fixture"]);
  return source;
}

export function register(harness: Harness): void {
  const tool = "runtime-sync.ts";
  const run = (label: string, args: string[], expectedCode: number, expectedText?: string): void => {
    harness.runScriptArgs(label, tool, args, expectedCode, expectedText);
  };
  const syncArgs = (source: string, runtime: string, ...extra: string[]): string[] => [
    "sync",
    "--source",
    source,
    "--installed",
    runtime,
    "--no-verify",
    ...extra,
  ];

  {
    const root = harness.makeEmptyFixture("runtime-sync-flow");
    const source = writeSourceTree(root);
    const runtime = path.join(root, "runtime");
    mkdirSync(runtime, { recursive: true });
    writeFileSync(path.join(runtime, "custom.txt"), "user-owned\n");

    run("runtime-sync check reports drift with exit 1", ["check", "--source", source, "--installed", runtime], 1, "Drift detected");

    // Bootstrap with a differing runtime file: ownership unprovable, must refuse without --adopt.
    writeFileSync(path.join(runtime, "a.txt"), "runtime edit\n");
    run("runtime-sync refuses bootstrap conflicts without --adopt", syncArgs(source, runtime), 1, "Bootstrap conflicts");
    if (existsSync(path.join(runtime, ".runtime-sync-manifest.json"))) {
      throw new Error("runtime-sync wrote a manifest despite refusing the bootstrap");
    }

    run("runtime-sync bootstraps with --adopt", syncArgs(source, runtime, "--adopt"), 0, "0.0.1-fixture");
    run("runtime-sync clean check after sync", ["check", "--source", source, "--installed", runtime], 0, "Runtime matches source");
    if (!existsSync(path.join(runtime, "custom.txt"))) {
      throw new Error("runtime-sync deleted an unowned file");
    }

    // Post-sync runtime edit: the drift-ahead failure. Sync must stop, not clobber.
    writeFileSync(path.join(runtime, "a.txt"), "edited after sync\n");
    run("runtime-sync blocks on a runtime edited since the last sync", syncArgs(source, runtime), 1, "edited since the last sync");
    run("runtime-sync --force overwrites a conflicting edit deliberately", syncArgs(source, runtime, "--force"), 0, "Copied");

    // Orphan-edit conflict under --force: the file was edited in the runtime AND
    // dropped from source. Force means "adopt the source's state", and the
    // source's state for a dropped path is absence — the file must be deleted,
    // not silently kept and dropped from the manifest.
    writeFileSync(path.join(runtime, "a.txt"), "edited orphan\n");
    git(source, ["rm", "-q", "a.txt"]);
    git(source, ["commit", "-qm", "drop a.txt"]);
    run("runtime-sync refuses an orphan-edit conflict without --force", syncArgs(source, runtime), 1, "edited since the last sync");
    if (!existsSync(path.join(runtime, "a.txt"))) {
      throw new Error("runtime-sync deleted an orphan-edit conflict without --force");
    }
    run("runtime-sync --force deletes an orphan-edit conflict", syncArgs(source, runtime, "--force"), 0, "deleted 1");
    if (existsSync(path.join(runtime, "a.txt"))) {
      throw new Error("runtime-sync failed to delete a forced orphan-edit conflict");
    }
    if (!existsSync(path.join(runtime, "custom.txt"))) {
      throw new Error("runtime-sync deleted an unowned file during orphan cleanup");
    }
  }

  {
    // Symlinked runtime directory: source paths under it must hard-block the
    // sync (no force override), and the external tree must stay untouched.
    const root = harness.makeEmptyFixture("runtime-sync-symlink");
    const source = writeSourceTree(root);
    const runtime = path.join(root, "runtime");
    const outside = path.join(root, "outside");
    mkdirSync(runtime, { recursive: true });
    mkdirSync(outside, { recursive: true });
    writeFileSync(path.join(outside, "b.txt"), "external content\n");
    symlinkSync(outside, path.join(runtime, "sub"));

    run("runtime-sync blocks source paths under a runtime symlink", syncArgs(source, runtime, "--adopt", "--force"), 1, "BLOCKED");
    const external = readFileSync(path.join(outside, "b.txt"), "utf8");
    if (external !== "external content\n") {
      throw new Error("runtime-sync wrote through a symlinked runtime directory");
    }
    if (existsSync(path.join(runtime, ".runtime-sync-manifest.json"))) {
      throw new Error("runtime-sync wrote a manifest despite a symlink block");
    }
  }
}
