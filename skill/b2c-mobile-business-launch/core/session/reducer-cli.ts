import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Repo root, resolved two levels above core/session — shared by every core/session CLI. */
export function skillRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function resolveTsxBin(): string {
  const candidates = [path.join(skillRoot(), "node_modules/.bin/tsx"), path.resolve(skillRoot(), "../..", "node_modules/.bin/tsx")];
  return candidates.find((candidate) => existsSync(candidate)) ?? "tsx";
}

export interface ReducerResult {
  readonly code: number;
  readonly output: string;
}

/**
 * Sessions never reach around the reducer (KTD7): every write to a reducer-owned document
 * (business-state/control/grants/waivers/budget-ledger) goes through core/reducer/cli.ts as a
 * subprocess, never a direct write. Shared by core/session/run.ts and core/session/onboard.ts.
 */
export function runReducer(args: string[], input?: string): ReducerResult {
  const cliPath = path.join(skillRoot(), "core/reducer/cli.ts");
  const result = spawnSync(resolveTsxBin(), [cliPath, ...args], { cwd: skillRoot(), encoding: "utf8", input });
  return { code: result.status ?? -1, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}
