import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveTsxBin } from "../../tooling/lib/tsx-bin.js";

/** Repo root, resolved two levels above core/session — shared by every core/session CLI. */
export function skillRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
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
  const result = spawnSync(resolveTsxBin(skillRoot()), [cliPath, ...args], { cwd: skillRoot(), encoding: "utf8", input });
  return { code: result.status ?? -1, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}
