import { existsSync } from "node:fs";
import path from "node:path";

/**
 * One shared `resolveTsxBin`, previously duplicated verbatim across 11 files spanning core/,
 * verification/, validation/, and tooling/ (each closing over its own locally computed
 * `skillRoot`). Every copy resolved the same two candidates in the same order before falling
 * back to the bare "tsx" on PATH: `<skillRoot>/node_modules/.bin/tsx`, then the repo root's
 * `node_modules/.bin/tsx` two levels above skillRoot (this skill package is nested two
 * directories under the monorepo root, so that is the workspace-hoisted install location).
 *
 * Takes `skillRoot` as a parameter — matching script-paths.ts's `resolveScriptPath` — rather than
 * closing over a module-level constant, so one implementation serves every caller regardless of
 * how that caller computes its own skillRoot (a const derived from `import.meta.url`, or a
 * function like core/session/reducer-cli.ts's `skillRoot()`).
 */
export function resolveTsxBin(skillRoot: string): string {
  const candidates = [path.join(skillRoot, "node_modules/.bin/tsx"), path.resolve(skillRoot, "../..", "node_modules/.bin/tsx")];
  return candidates.find((candidate) => existsSync(candidate)) ?? "tsx";
}
