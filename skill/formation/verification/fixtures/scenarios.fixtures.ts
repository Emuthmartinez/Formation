import type { Harness } from "./_harness.js";
import { register as registerContinuity } from "../scenarios/continuity-from-durable-state.js";
import { register as registerEntrypoints } from "../scenarios/entrypoint-installation-proof.js";
import { register as registerSecretRouting } from "../scenarios/secret-routing.js";
import { register as registerParallelOverlap } from "../scenarios/parallel-overlap.js";

/**
 * The registration point for verification/scenarios/ (U9's LaunchBench port). Named
 * scenarios.fixtures.ts and living here — not under verification/scenarios/ itself — so
 * verification/fixtures/run.ts's filename-convention auto-discovery (`*.fixtures.ts`) picks it up
 * for free; the ported scenario content stays organized under verification/scenarios/, one file
 * per LaunchBench scenario id, each already exporting its own register(harness).
 *
 * Scope and disposition (recorded per the plan's "your judgment" instruction, not exhaustive over
 * all ~116 evals/launchbench/*.yaml scenarios — that full triage is out of this unit's bounded
 * scope):
 *   - continuity-drift-between-sessions -> verification/scenarios/continuity-from-durable-state.ts
 *   - business-agent-entrypoints-missing -> verification/scenarios/entrypoint-installation-proof.ts
 *   - secret-routing-missing -> verification/scenarios/secret-routing.ts
 *   - parallel-file-overlap-unsafe -> verification/scenarios/parallel-overlap.ts
 *   - business-repo-hooks-not-installed: NOT ported. Its entire subject (the v1 PostToolUse hook
 *     mechanism) is deleted outright at cutover (KTD8/R19; port ledger's #3 top-drop). Stays
 *     untouched in evals/launchbench/ for U11 to delete alongside the mechanism itself.
 * The other ~111 scenarios were not individually triaged by this unit; U11's cutover pass (which
 * already owns "no reference to a deleted path anywhere," per the plan's Verification Contract)
 * is the natural point to complete that accounting against the full corpus.
 */
export function register(harness: Harness): void {
  registerContinuity(harness);
  registerEntrypoints(harness);
  registerSecretRouting(harness);
  registerParallelOverlap(harness);
}
