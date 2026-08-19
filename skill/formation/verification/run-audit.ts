#!/usr/bin/env node
/**
 * verification/run-audit.ts — U9's discoverable v2 audit entry point.
 *
 * This is a thin wrapper around tooling/run-audit.ts's main(), not a reimplementation. Same
 * single-source-of-truth rationale as verification/audit-plan.ts (see that file's doc comment):
 * `npm run audit` at both the repo root and the installed skill runtime already invokes
 * `tsx tooling/run-audit.ts`, and that script builds its step list from
 * tooling/lib/audit-plan.ts — the exact plan verification/audit-plan.ts re-exports. Duplicating
 * the orchestration loop (concurrency pool, serial-step handling, --ci skip logic, output
 * buffering) here instead of importing it would be a second copy of behavior that check-
 * package-parity.ts cannot see and that would drift the moment either copy was edited alone.
 *
 * Usage is identical to `tsx tooling/run-audit.ts` (all flags — --ci, --serial, --concurrency,
 * --only, --list, --package-root — pass through unchanged, since this simply invokes the same
 * main() with the same process.argv).
 */
import { pathToFileURL } from "node:url";
import { main } from "../tooling/run-audit.js";

function isMainModule(): boolean {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  await main();
}
