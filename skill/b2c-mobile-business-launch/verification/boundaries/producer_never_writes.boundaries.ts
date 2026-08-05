import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assert, skillRoot, type Harness } from "../fixtures/_harness.js";

/**
 * Structural proof of the task's "your module READS control/grants/waivers/ledger docs, never
 * writes them" boundary (KTD7: mutation is reachable only through the reducer CLI's typed-patch
 * interface). This is not a behavioral test of any one function — it is a source-level guarantee
 * that core/autonomy/*.ts never even imports a disk-mutating primitive, so no future change to
 * any function in this unit can silently start writing without also failing this check.
 */
const WRITE_PRIMITIVES = ["writeFileSync", "appendFileSync", "renameSync", "unlinkSync", "mkdirSync", "writeSync", "fsyncSync", "rmSync", "rmdirSync", "copyFileSync", "truncateSync"];

const boundariesDir = path.dirname(fileURLToPath(import.meta.url));
const autonomyDir = path.resolve(boundariesDir, "../..", "core/autonomy");

export function register(harness: Harness): void {
  const files = readdirSync(autonomyDir).filter((name) => name.endsWith(".ts"));

  harness.check("producer boundary: core/autonomy contains the five expected modules plus the evaluator assembly", () => {
    for (const expected of ["grants.ts", "prerequisites.ts", "waivers.ts", "budget.ts", "killswitch.ts", "evaluator.ts"]) {
      assert(files.includes(expected), `expected ${expected} to exist in ${path.relative(skillRoot, autonomyDir)}`);
    }
  });

  for (const file of files) {
    harness.check(`producer boundary: ${file} never imports or calls a disk-write primitive`, () => {
      const source = readFileSync(path.join(autonomyDir, file), "utf8");
      const hits = WRITE_PRIMITIVES.filter((name) => new RegExp(`\\b${name}\\b`).test(source));
      assert(hits.length === 0, `${file} references write primitive(s) [${hits.join(", ")}] — the autonomy engine must only read control/grants/waivers/ledger docs, never write them`);
    });
  }
}
