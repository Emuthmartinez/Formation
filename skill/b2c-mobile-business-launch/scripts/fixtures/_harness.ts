import { cpSync, existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export interface FixtureResult {
  label: string;
  ok: boolean;
  expectedCode: number;
  actualCode: number | null;
  expectedText?: string;
  output: string;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const skillRoot = path.resolve(scriptDir, "../..");

function resolveTsxBin(): string {
  const candidates = [path.join(skillRoot, "node_modules/.bin/tsx"), path.resolve(skillRoot, "../..", "node_modules/.bin/tsx")];
  return candidates.find((candidate) => existsSync(candidate)) ?? "tsx";
}

export function writeBusinessEntrypoints(root: string): void {
  cpSync(path.join(skillRoot, "templates", "repo-agent-entrypoints", "AGENTS.md"), path.join(root, "AGENTS.md"));
  cpSync(path.join(skillRoot, "templates", "repo-agent-entrypoints", "CLAUDE.md"), path.join(root, "CLAUDE.md"));
  cpSync(path.join(skillRoot, "templates", "app-agent-roster", "APP_AGENTS.md"), path.join(root, "APP_AGENTS.md"));
  cpSync(path.join(skillRoot, "templates", "app-agent-roster", "agents"), path.join(root, "agents"), { recursive: true });
  cpSync(path.join(skillRoot, "templates", "ORCHESTRATION.md"), path.join(root, "ORCHESTRATION.md"));
  cpSync(path.join(skillRoot, "templates", "orchestration.html"), path.join(root, "orchestration.html"));
  writeFileSync(path.join(root, "launch-cockpit.html"), "<!doctype html><html><body>Launch cockpit fixture</body></html>", "utf8");
}

export interface Harness {
  readonly tempRoot: string;
  readonly results: FixtureResult[];
  makeFixture: (name: string) => string;
  makeEmptyFixture: (name: string) => string;
  runFixture: (
    label: string,
    root: string,
    script: string,
    expectedCode: number,
    expectedText?: string,
    extraArgs?: string[],
    env?: Record<string, string>,
    forbiddenText?: string,
  ) => void;
  runScriptArgs: (label: string, script: string, args: string[], expectedCode: number, expectedText?: string, env?: Record<string, string>) => void;
  cleanupFixtures: () => void;
  cleanup: () => void;
}

export function createHarness(): Harness {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "b2c-validator-fixtures-"));
  const results: FixtureResult[] = [];
  const tsxBin = resolveTsxBin();

  const makeFixture = (name: string): string => {
    const fixtureRoot = path.join(tempRoot, name);
    cpSync(path.join(skillRoot, "templates"), fixtureRoot, { recursive: true });
    cpSync(path.join(skillRoot, "templates", "secrets", "SECRETS.md"), path.join(fixtureRoot, "SECRETS.md"));
    return fixtureRoot;
  };

  const makeEmptyFixture = (name: string): string => {
    const fixtureRoot = path.join(tempRoot, name);
    mkdirSync(fixtureRoot, { recursive: true });
    return fixtureRoot;
  };

  const runScript = (
    label: string,
    scriptArgs: string[],
    expectedCode: number,
    expectedText?: string,
    env?: Record<string, string>,
    forbiddenText?: string,
  ): void => {
    const result = spawnSync(tsxBin, scriptArgs, {
      cwd: skillRoot,
      encoding: "utf8",
      env: env ? { ...process.env, ...env } : undefined,
    });
    const output = `${result.stdout}\n${result.stderr}`;
    results.push({
      label,
      ok: result.status === expectedCode && (!expectedText || output.includes(expectedText)) && (!forbiddenText || !output.includes(forbiddenText)),
      expectedCode,
      actualCode: result.status,
      expectedText,
      output,
    });
  };

  const runFixture = (
    label: string,
    root: string,
    script: string,
    expectedCode: number,
    expectedText?: string,
    extraArgs: string[] = [],
    env?: Record<string, string>,
    forbiddenText?: string,
  ): void => {
    runScript(label, [path.join("scripts", script), "--root", root, ...extraArgs], expectedCode, expectedText, env, forbiddenText);
  };

  const runScriptArgs = (label: string, script: string, args: string[], expectedCode: number, expectedText?: string, env?: Record<string, string>): void => {
    runScript(label, [path.join("scripts", script), ...args], expectedCode, expectedText, env);
  };

  const cleanup = (): void => {
    rmSync(tempRoot, { recursive: true, force: true });
  };

  const cleanupFixtures = (): void => {
    for (const entry of readdirSync(tempRoot)) {
      rmSync(path.join(tempRoot, entry), { recursive: true, force: true });
    }
  };

  return { tempRoot, results, makeFixture, makeEmptyFixture, runFixture, runScriptArgs, cleanupFixtures, cleanup };
}

export function reportResults(results: FixtureResult[]): number {
  const failed = results.filter((result) => !result.ok);
  console.log("Validator fixture tests");
  console.log(`${failed.length} failure(s), ${results.length - failed.length} passed`);
  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"} ${result.label}`);
    if (!result.ok) {
      console.log(`  expected exit ${result.expectedCode}, got ${result.actualCode}`);
      if (result.expectedText) {
        console.log(`  expected text: ${result.expectedText}`);
      }
      console.log(result.output.trim());
    }
  }
  return failed.length;
}

export * from "./_state.js";
export * from "./_builders-store.js";
export * from "./_builders-ops.js";
