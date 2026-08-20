#!/usr/bin/env node
/**
 * The engine's missing front door: one idempotent command that takes a launch workspace from
 * "the graph engine cannot see this business" to "core/session/run.ts runs against it".
 *
 * Composes four pieces that each already existed but that nothing routed together — which is
 * exactly why the engine had zero real callers (2026-08-19 audit): a business could hold months
 * of launch work and still answer run.ts with "couldn't find its control settings".
 *
 *   1. core/adapters/install-entrypoints.ts — executable catalog.json + .b2c-launch/runtime.json
 *      (plus the repo agent entrypoints) into the workspace.
 *   2. core/schema/migrate-v1.ts — state/PROJECT_STATE.yaml (v1) -> state/business-state.json
 *      (v2), plus a control-file scaffold when none exists.
 *   3. `reducer adopt` — records both documents as the reducer's disclosed baseline in
 *      control/manifest.json and the hash-chained audit log, so the very first session's tamper
 *      preflight has a truthful before to compare against.
 *   4. core/session/onboard.ts (optional, --answers) — the founder's grants/waivers/budgets,
 *      committed through the reducer like every other control write.
 *
 * DEFAULT IS DRY-RUN (prints the plan, touches nothing); --apply is required to write, mirroring
 * install-entrypoints.ts. Every step skips cleanly when its outcome already exists, so re-running
 * against a bootstrapped workspace is a no-op report, never a second baseline.
 *
 * Usage:
 *   tsx core/session/bootstrap.ts --workspace <dir> [--apply] [--answers <file>] [--now <iso>]
 *
 * Exit codes: 0 = bootstrapped or nothing to do (dry-run included); 1 = the workspace cannot be
 * bootstrapped (nothing to migrate from, invalid documents) or a composed step failed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parse as parseYaml } from "yaml";

import { isMainModule, parseArgs, resolveCallerPath } from "../lib/cli.js";
import { runReducer, skillRoot } from "./reducer-cli.js";
import { resolveWorkspacePaths, type WorkspacePaths } from "./run.js";
import { migrateProjectStateV1 } from "../schema/migrate-v1.js";
import { validateBusinessState, validateControl } from "../schema/index.js";
import { resolveTsxBin } from "../../tooling/lib/tsx-bin.js";

const BOOTSTRAP_SESSION = "bootstrap-driver";

interface StepReport {
  readonly step: string;
  readonly action: "would" | "did" | "skip" | "fail";
  readonly detail: string;
}

function report(entries: StepReport[], step: string, action: StepReport["action"], detail: string): void {
  entries.push({ step, action, detail });
  const label = action === "would" ? "PLAN" : action === "did" ? "DONE" : action === "skip" ? "SKIP" : "FAIL";
  console.log(`${label} ${step}: ${detail}`);
}

function runSkillCli(relativePath: string, cliArgs: string[]): { code: number; output: string } {
  const result = spawnSync(resolveTsxBin(skillRoot()), [path.join(skillRoot(), relativePath), ...cliArgs], {
    cwd: skillRoot(),
    encoding: "utf8",
  });
  return { code: result.status ?? -1, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

/** The skill version a workspace's runtime binding was installed at; undefined when unreadable. */
function readPinnedSkillVersion(runtimeManifestPath: string): string | undefined {
  if (!existsSync(runtimeManifestPath)) return undefined;
  try {
    const manifest = JSON.parse(readFileSync(runtimeManifestPath, "utf8")) as { skillVersion?: string };
    return typeof manifest.skillVersion === "string" ? manifest.skillVersion : undefined;
  } catch {
    return undefined;
  }
}

function readEngineVersion(): string {
  return (JSON.parse(readFileSync(path.join(skillRoot(), "skill-version.json"), "utf8")) as { version: string }).version;
}

/** control/manifest.json's entries are keyed by resolved file path; a missing manifest tracks nothing. */
function manifestTracks(manifestPath: string, filePath: string): boolean {
  if (!existsSync(manifestPath)) return false;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { entries?: Record<string, unknown> };
    return Boolean(manifest.entries?.[path.resolve(filePath)]);
  } catch {
    return false;
  }
}

function adopt(paths: WorkspacePaths, filePath: string, targetDoc: "business-state" | "control" | "budget-ledger"): { code: number; output: string } {
  return runReducer([
    "adopt",
    "--file",
    filePath,
    "--target-doc",
    targetDoc,
    "--manifest",
    paths.manifest,
    "--audit",
    paths.audit,
    "--session",
    BOOTSTRAP_SESSION,
  ]);
}

export interface BootstrapResult {
  readonly code: number;
  readonly reports: readonly StepReport[];
}

export function bootstrapWorkspace(workspace: string, options: { apply: boolean; answersPath?: string; now?: string }): BootstrapResult {
  const reports: StepReport[] = [];
  const paths = resolveWorkspacePaths(workspace);
  const v1StatePath = path.join(workspace, "state", "PROJECT_STATE.yaml");
  const runtimeManifestPath = path.join(workspace, ".b2c-launch", "runtime.json");
  const apply = options.apply;

  // --- 1. executable catalog + runtime binding ---------------------------------------------------
  // A workspace pins its own catalog; the engine moving forward never changes it silently. When
  // the pin differs from the engine, the drift is NAMED here (layering plan R4), and --apply is
  // the founder's explicit re-pin — install-entrypoints rewrites the catalog and binding while
  // preserving any locally modified managed entrypoints.
  const pinnedVersion = readPinnedSkillVersion(runtimeManifestPath);
  const currentVersion = readEngineVersion();
  if (existsSync(paths.catalog) && existsSync(runtimeManifestPath) && pinnedVersion === currentVersion) {
    report(reports, "entrypoints", "skip", `catalog.json and .b2c-launch/runtime.json already installed at ${currentVersion}`);
  } else if (existsSync(paths.catalog) && existsSync(runtimeManifestPath) && !apply) {
    report(reports, "entrypoints", "would", `re-pin the workspace catalog from ${pinnedVersion ?? "(unversioned)"} to ${currentVersion} (install-entrypoints --apply)`);
  } else if (existsSync(paths.catalog) && existsSync(runtimeManifestPath)) {
    const result = runSkillCli("core/adapters/install-entrypoints.ts", ["--target", workspace, "--apply"]);
    if (result.code !== 0) {
      report(reports, "entrypoints", "fail", `install-entrypoints exited ${result.code}: ${result.output.trim().slice(-400)}`);
      return { code: 1, reports };
    }
    report(reports, "entrypoints", "did", `re-pinned the workspace catalog from ${pinnedVersion ?? "(unversioned)"} to ${currentVersion}`);
  } else if (!apply) {
    report(reports, "entrypoints", "would", "install catalog.json, .b2c-launch/runtime.json, and repo agent entrypoints (install-entrypoints --apply)");
  } else {
    const result = runSkillCli("core/adapters/install-entrypoints.ts", ["--target", workspace, "--apply"]);
    if (result.code !== 0) {
      report(reports, "entrypoints", "fail", `install-entrypoints exited ${result.code}: ${result.output.trim().slice(-400)}`);
      return { code: 1, reports };
    }
    report(reports, "entrypoints", "did", "installed catalog.json, .b2c-launch/runtime.json, and repo agent entrypoints");
  }

  // --- 2. business state v2 (and a control scaffold when none exists) ----------------------------
  const hadBusinessState = existsSync(paths.state);
  if (hadBusinessState) {
    report(reports, "business-state", "skip", `${path.relative(workspace, paths.state)} already exists`);
  } else if (!existsSync(v1StatePath)) {
    report(
      reports,
      "business-state",
      "fail",
      `nothing to bootstrap from: neither ${path.relative(workspace, paths.state)} nor state/PROJECT_STATE.yaml exists — run the launch onboarding first, or migrate by hand`,
    );
    return { code: 1, reports };
  } else if (!apply) {
    report(reports, "business-state", "would", "migrate state/PROJECT_STATE.yaml (v1) to state/business-state.json (v2)");
  } else {
    const migration = migrateProjectStateV1(parseYaml(readFileSync(v1StatePath, "utf8")), options.now);
    const stateCheck = validateBusinessState(migration.businessState);
    if (!stateCheck.valid) {
      report(reports, "business-state", "fail", `migrated state is invalid: ${stateCheck.issues.map((issue) => issue.message).join("; ")}`);
      return { code: 1, reports };
    }
    mkdirSync(path.dirname(paths.state), { recursive: true });
    writeFileSync(paths.state, `${JSON.stringify(migration.businessState, null, 2)}\n`, "utf8");
    const migratedNote = migration.warnings.length > 0 ? ` (${migration.warnings.length} migration warning(s) printed above)` : "";
    report(reports, "business-state", "did", `migrated v1 state to ${path.relative(workspace, paths.state)}${migratedNote}`);
    if (!existsSync(paths.control)) {
      const controlCheck = validateControl(migration.control);
      if (!controlCheck.valid) {
        report(reports, "control", "fail", `migration control scaffold is invalid: ${controlCheck.issues.map((issue) => issue.message).join("; ")}`);
        return { code: 1, reports };
      }
      mkdirSync(path.dirname(paths.control), { recursive: true });
      writeFileSync(paths.control, `${JSON.stringify(migration.control, null, 2)}\n`, "utf8");
      report(reports, "control", "did", `wrote control scaffold to ${path.relative(workspace, paths.control)} (no grants yet — onboarding answers add them)`);
    }
  }
  if (existsSync(paths.control) && hadBusinessState) {
    report(reports, "control", "skip", `${path.relative(workspace, paths.control)} already exists`);
  } else if (!existsSync(paths.control) && hadBusinessState) {
    // v2 state without control: a control scaffold is derivable from the state's own slug.
    if (!apply) {
      report(reports, "control", "would", `write a control scaffold to ${path.relative(workspace, paths.control)} from the business state's slug`);
    } else {
      const stateRaw = validateBusinessState(JSON.parse(readFileSync(paths.state, "utf8")));
      if (!stateRaw.valid) {
        report(reports, "control", "fail", `existing business state is invalid: ${stateRaw.issues.map((issue) => issue.message).join("; ")}`);
        return { code: 1, reports };
      }
      const scaffold = {
        schemaVersion: "1.0.0",
        updatedAt: options.now ?? new Date().toISOString(),
        businessSlug: stateRaw.value!.project.slug,
        killSwitch: { engaged: false, engagedAt: "", engagedBy: "", reason: "" },
        grants: {},
        waivers: [],
      };
      mkdirSync(path.dirname(paths.control), { recursive: true });
      writeFileSync(paths.control, `${JSON.stringify(scaffold, null, 2)}\n`, "utf8");
      report(reports, "control", "did", `wrote control scaffold to ${path.relative(workspace, paths.control)}`);
    }
  }

  // --- 3. reducer adoption: a truthful baseline for the first session's tamper preflight ----------
  const adoptions: Array<{ file: string; targetDoc: "business-state" | "control" | "budget-ledger"; required: boolean }> = [
    { file: paths.state, targetDoc: "business-state", required: true },
    { file: paths.control, targetDoc: "control", required: true },
    { file: paths.ledger, targetDoc: "budget-ledger", required: false },
  ];
  for (const candidate of adoptions) {
    const name = `adopt:${candidate.targetDoc}`;
    if (!existsSync(candidate.file)) {
      if (candidate.required && apply) {
        report(reports, name, "fail", `${path.relative(workspace, candidate.file)} does not exist after the earlier steps — bootstrap is incomplete`);
        return { code: 1, reports };
      }
      if (!candidate.required) report(reports, name, "skip", `${path.relative(workspace, candidate.file)} does not exist (legitimate first-run state)`);
      else report(reports, name, "would", `adopt ${path.relative(workspace, candidate.file)} once it exists`);
      continue;
    }
    if (manifestTracks(paths.manifest, candidate.file)) {
      report(reports, name, "skip", "already tracked in the reducer manifest");
      continue;
    }
    if (!apply) {
      report(reports, name, "would", `record ${path.relative(workspace, candidate.file)} as the reducer's disclosed baseline`);
      continue;
    }
    const result = adopt(paths, candidate.file, candidate.targetDoc);
    if (result.code !== 0) {
      report(reports, name, "fail", `reducer adopt exited ${result.code}: ${result.output.trim().slice(-400)}`);
      return { code: 1, reports };
    }
    report(reports, name, "did", "recorded as the reducer's disclosed baseline (manifest + audit)");
  }

  // --- 4. founder onboarding answers (optional) ---------------------------------------------------
  if (options.answersPath) {
    if (!apply) {
      report(reports, "onboarding", "would", `apply grants/waivers/budgets from ${options.answersPath} through core/session/onboard.ts`);
    } else {
      const onboardArgs = ["--workspace", workspace, "--answers", options.answersPath];
      if (options.now) onboardArgs.push("--now", options.now);
      const result = runSkillCli("core/session/onboard.ts", onboardArgs);
      if (result.code !== 0) {
        report(reports, "onboarding", "fail", `onboard exited ${result.code}: ${result.output.trim().slice(-400)}`);
        return { code: 1, reports };
      }
      report(reports, "onboarding", "did", `applied onboarding answers from ${options.answersPath}`);
    }
  } else {
    report(reports, "onboarding", "skip", "no --answers file given; grants stay as they are (an ungranted business parks everything for review)");
  }

  return { code: 0, reports };
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  if (!args.workspace) {
    console.error("Usage: tsx core/session/bootstrap.ts --workspace <dir> [--apply] [--answers <file>] [--now <iso>]");
    return 1;
  }
  const workspace = resolveCallerPath(args.workspace);
  if (!existsSync(workspace)) {
    console.error(`ISSUE bootstrap.workspace_missing: ${workspace} does not exist`);
    return 1;
  }
  const apply = args.apply === "true";
  const result = bootstrapWorkspace(workspace, {
    apply,
    answersPath: args.answers ? resolveCallerPath(args.answers) : undefined,
    now: args.now,
  });
  if (result.code === 0) {
    if (!apply) {
      console.log("");
      console.log("Dry run only — nothing was written. Re-run with --apply to perform the steps above.");
    } else {
      console.log("");
      console.log("Workspace is bootstrapped. A session needs a brief file, for example:");
      console.log('  { "schemaVersion": "1.0.0", "businessSlug": "<slug from state/business-state.json>", "founderContact": { "email": "founder@example.com" } }');
      console.log(`Then: formation run --workspace ${workspace} --brief <brief.json> --session <session-id>`);
      console.log(`And to let this machine's MCP server address it: formation workspaces register <slug> ${workspace}`);
    }
  }
  return result.code;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = main();
}
