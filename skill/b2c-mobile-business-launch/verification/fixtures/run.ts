#!/usr/bin/env node
/**
 * Suite runner for the greenfield core fixture suites (verification/fixtures/*.fixtures.ts).
 *
 * Suites are auto-discovered by filename convention: <name>.fixtures.ts must export
 * `register(harness)`. Adding a suite never requires editing this file.
 *
 * Usage:
 *   tsx verification/fixtures/run.ts            run every discovered suite
 *   tsx verification/fixtures/run.ts schema      run only the named suite
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHarness, reportResults, skillRoot, type Harness } from "./_harness.js";

const fixturesDir = path.dirname(fileURLToPath(import.meta.url));
const suiteFiles = readdirSync(fixturesDir)
  .filter((name) => name.endsWith(".fixtures.ts"))
  .sort();
const suiteNames = suiteFiles.map((name) => name.replace(/\.fixtures\.ts$/, ""));

const requested = process.argv[2];
if (requested && !suiteNames.includes(requested)) {
  console.error(`Unknown fixture suite "${requested}". Known suites: ${suiteNames.join(", ")}`);
  process.exit(1);
}

const schemaDir = path.join(skillRoot, "core/schema");
const harness = createHarness(schemaDir);

try {
  for (const [index, name] of suiteNames.entries()) {
    if (requested && requested !== name) continue;
    const module = (await import(pathToFileURL(path.join(fixturesDir, suiteFiles[index]!)).href)) as {
      register?: (harness: Harness) => void;
    };
    if (typeof module.register !== "function") {
      console.error(`Fixture suite "${name}" does not export register(harness).`);
      process.exit(1);
    }
    module.register(harness);
  }
} finally {
  harness.cleanup();
}

const failed = reportResults(harness.results);
if (failed > 0) process.exitCode = 1;
