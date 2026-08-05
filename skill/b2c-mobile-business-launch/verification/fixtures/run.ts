#!/usr/bin/env node
/**
 * Suite runner for the greenfield core fixture suites (verification/fixtures/*.fixtures.ts).
 *
 * Usage:
 *   tsx verification/fixtures/run.ts            run every registered suite
 *   tsx verification/fixtures/run.ts schema      run only the named suite
 */
import path from "node:path";
import { createHarness, reportResults, skillRoot, type Harness } from "./_harness.js";
import { register as registerSchema } from "./schema.fixtures.js";

const suites: Record<string, (harness: Harness) => void> = {
  schema: registerSchema,
};

const requested = process.argv[2];
if (requested && !suites[requested]) {
  console.error(`Unknown fixture suite "${requested}". Known suites: ${Object.keys(suites).join(", ")}`);
  process.exit(1);
}

const schemaDir = path.join(skillRoot, "core/schema");
const harness = createHarness(schemaDir);

try {
  for (const [name, register] of Object.entries(suites)) {
    if (requested && requested !== name) continue;
    register(harness);
  }
} finally {
  harness.cleanup();
}

const failed = reportResults(harness.results);
if (failed > 0) process.exitCode = 1;
