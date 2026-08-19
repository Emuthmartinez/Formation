# U10 Rehearsal Evidence — 2026-08-05

Fixture business: template `PROJECT_STATE.yaml` migrated via `core/schema/migrate-v1.ts` (7 founder gates demoted to re-present), adopted into the reducer manifest via the `adopt` bootstrap, onboarded via `core/session/onboard.ts` with conservative defaults (12 domain grants; Revenue/Store/Trust at review-first; no waivers).

| # | Drill | Outcome |
|---|---|---|
| 1 | Session 1 (inline, fixture executor) | Digest written; 3 founder-gated parks, 12 grant-level parks (Trust/Revenue correctly refused at review-first), migrated gates re-presented in founder language; push skipped (no key) recorded honestly |
| 2 | Founder approvals (`approve.ts`, added this unit) | Two approvals granted; affected node reset to schedulable; unrelated waiting nodes untouched; decision attested in hash-chained audit log |
| 3 | Session 2 (real headless Claude agent, keychain auth) | A separate `claude -p` process executed the session runner against the shared workspace; digest written; state consistent — cross-runtime execution proven |
| 4 | Wall-clock regression (found here) | Resumed runs timed out instantly (deadline measured from run creation); fixed to per-session measurement; regression fixture added (engine suite) |
| 5 | Node execution + gate acceptance (added this unit) | Approved node executed via fixture executor; its real validator gate correctly REFUSED synthetic output — fail-closed acceptance proven (false accepts impossible; real acceptance requires real artifacts) |
| 6 | Kill-switch drill | Engaged via reducer patch → session parked with "Autonomous work is paused" digest; disengaged → sessions resume |
| 7 | Lock-contention drill | Held lock → scheduled session exited "did not run" with "stepped back rather than collide" digest; lock released cleanly |
| 8 | Shadow of live business (Shade Diary, read-only) | Real `PROJECT_STATE.yaml` migrated (phase-label normalization gap found and fixed), validated, compiled; seeded frontier: 6 ready / 9 founder-gated / 28 downstream — sensible for that business; no writes to the live repo |

Runtime probe results (from U6, re-confirmed): claude 2.1.220 available + headless smoke OK (keychain); codex 0.135.0 installed, auth_failed (named); cursor-agent 2026.01.28 installed, auth_failed (named — `CURSOR_API_KEY` unset). Cross-runtime rehearsal therefore ran on claude + inline; codex/cursor legs run the same session CLI once their keys are provisioned — the named-degrade path is the designed behavior, not a gap.

Integration gaps found by rehearsal, all fixed and committed with tests: reducer `adopt` bootstrap for migrated documents; founder `approve` CLI (waiting_founder was a dead end); per-session wall clock; in-session deterministic gate acceptance; migrator phase-label normalization.

Real Resend send: deliberately not exercised unattended (safety); transport implemented and fixture-tested; first live send happens in the supervised live-business session.
