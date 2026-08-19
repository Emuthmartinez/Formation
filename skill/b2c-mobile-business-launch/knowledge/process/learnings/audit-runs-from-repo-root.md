# Run The Maintainer Audit From The Repository Root

## Learning

Run `npm run audit` from the repository root, never from inside `skill/b2c-mobile-business-launch/`. The skill-layout audit silently drops every repo-only step, so a green result from inside the skill directory proves less than it appears to. Before claiming a merge-ready audit, confirm the run came from the root layout. Never pipe the audit through `tail` or another filter — the pipe reports the filter's exit code, not the audit's.

## Evidence

| Claim | Citation |
| --- | --- |
| Audit steps can be marked repo-only | `tooling/lib/audit-plan.ts:29` |
| The skill layout filters repo-only steps out | `tooling/lib/audit-plan.ts:165` |
| check:package-parity only runs in the repo layout | `tooling/lib/audit-plan.ts:88` |
| check:validator-docs only runs in the repo layout | `tooling/lib/audit-plan.ts:99` |

## Captured

Captured: 2026-08-18 — recurring maintainer failure recorded during the compound-engineering study; the skill-layout gap and the pipe-masked exit code each produced a false green audit in earlier sessions.

## Refresh

Last reviewed: 2026-08-18. Verdict: kept.
