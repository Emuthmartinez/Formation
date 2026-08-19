#!/usr/bin/env node
/**
 * check-adapter-contract — contract A's gate (layering plan, requirement R1).
 *
 * Three rules, each of which has already been watched failing:
 *   1. Every positive golden sample under fixtures/adapter-contract/ validates against its
 *      schema (boundary-report.* -> boundary-report.schema.json, import-report.* -> the import
 *      schema). The rich boundary golden is a trimmed REAL emission — regenerate it from a
 *      bootstrapped workspace when the contract legitimately changes, never by hand-editing.
 *   2. Every negative.* golden FAILS validation — the detector proving it detects. A schema
 *      loosened far enough to accept a report with no contractVersion fails here, not in a
 *      consumer three repos away.
 *   3. The goldens' contractVersion equals ADAPTER_CONTRACT_VERSION — bumping the code version
 *      without regenerating the goldens (or vice versa) is the drift this catches, which makes
 *      the bump discipline in core/adapters/contract.ts mechanical rather than remembered.
 *
 * Run: npm run check:adapter-contract
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADAPTER_CONTRACT_VERSION } from "../../core/adapters/contract.js";
import { validateBoundaryReport, validateImportBoundaryReport } from "../../core/schema/index.js";

const goldensDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "adapter-contract");
const failures: string[] = [];

function fail(message: string): void {
  failures.push(message);
  console.error(`- ERROR adapter_contract: ${message}`);
}

const files = readdirSync(goldensDir)
  .filter((name) => name.endsWith(".json"))
  .sort();
if (files.length === 0) fail(`no golden samples found in ${goldensDir} — the gate would pass vacuously`);

let positives = 0;
let negatives = 0;
for (const name of files) {
  const document: unknown = JSON.parse(readFileSync(path.join(goldensDir, name), "utf8"));
  const validate = name.startsWith("import-report") ? validateImportBoundaryReport : validateBoundaryReport;
  const result = validate(document);
  if (name.startsWith("negative.")) {
    negatives += 1;
    if (result.valid) fail(`${name} validated but is a negative control — the schema no longer catches what it exists to catch`);
    continue;
  }
  positives += 1;
  if (!result.valid) {
    for (const issue of result.issues.slice(0, 5)) fail(`${name}: ${issue.message} (${issue.path})`);
    continue;
  }
  const version = (document as { contractVersion?: string }).contractVersion;
  if (version !== ADAPTER_CONTRACT_VERSION) {
    fail(
      `${name} carries contractVersion ${version ?? "(absent)"} but the code declares ${ADAPTER_CONTRACT_VERSION} — regenerate the goldens with the version bump, in the same commit`,
    );
  }
}
if (positives === 0) fail("no positive golden samples — the gate would pass vacuously");
if (negatives === 0) fail("no negative controls — nothing proves the schemas still refuse bad documents");

if (failures.length > 0) {
  console.error(`Adapter contract check\n${failures.length} error(s)`);
  process.exitCode = 1;
} else {
  console.log(
    `Adapter contract check\n0 error(s): ${positives} golden(s) valid at contract ${ADAPTER_CONTRACT_VERSION}, ${negatives} negative control(s) correctly refused`,
  );
}
