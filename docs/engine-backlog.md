# Engine backlog

What remains between the engine as it runs today and the engine as the direction demands: any agent operating consumer-app businesses end to end, without drifting, on infrastructure someone else can trust. Ranked by how much each item changes that. The retired SaaS-product backlog this replaces is preserved at [`docs/history/platform-remaining-gaps-2026-08-v0.147.0.md`](history/platform-remaining-gaps-2026-08-v0.147.0.md); the platform items that survive here do so as consumer-of-the-engine concerns, not as the product thesis.

Reproduce the ground truth before acting on any item: `npm run audit` (72 steps, including `check:engine-e2e`), `npm run plan:frontier -- --workspace <dir>` against a bootstrapped workspace, and the per-item commands below.

## P0: A real business through the real executor

`check:engine-e2e` proves the loop with the fixture executor. The loop with the **real** worker CLIs (claude/codex/cursor-agent) has run only in development sessions, never as a standing proof against a live business. The next launch is the forcing test: bootstrap it, schedule it, and let the operating loop run for two weeks with real workers and real founder approvals. What breaks becomes fixture cases; what holds becomes the reference for the exposure story.

- Reproduce: `formation bootstrap --workspace <live-business> --apply`, then `formation run` with the default executor.

## P0: Worker-receipt enforcement on the interactive path

The sha256 fail-closed knowledge receipt lives in the headless executor (`core/session/executor.ts`). The interactive Task-subagent path still relies on the orchestrating session honoring `app-agent-roster.md` by hand. Mechanical enforcement means the reducer refusing a dispatched worker's patch without a receipt matching the brief — the same trust-boundary review class as the executor arc was.

## P1: Spend truth on the ledger

`buildActualPatch` records actuals equal to estimates (a deliberate, named placeholder) because fixture executors report no cost. The real executor can report usage; wire actual token/wall-clock cost into the ledger entry so budget balances reflect reality, not plans. The `authorizationDigest` receipt field is also still echo-able by the worker (`core/session/worker-prompt.ts`) — replace it with something the worker cannot see verbatim, or drop it.

## P1: MCP surface hardening

The `formation-mcp` server is a local stdio surface with filesystem-level trust. Before any remote exposure: workspace-path allowlisting (a caller should name registered workspaces, not arbitrary paths — the same traversal-by-construction rule the platform importer follows), founder-authority separation for `formation_approvals` and `formation_schedule` (today the caller asserts authority by calling), and a read-only mode. None of this blocks local use; all of it blocks giving the address to anything untrusted.

## P1: Verification rejection recovery

A fresh-context rejection parks a node under `Verification rejected.` durably — correct — but nothing routes a producer back to it. Define the retry edge: a rejection should surface as founder-visible work with the verifier's evidence attached, and a new producing attempt should clear the parked state through the ordinary attempt machinery.

## P2: Platform-as-consumer follow-ons

The platform remains a working founder product consuming the engine. Its engine-relevant residue from the retired backlog: result-to-knowledge traceability once real attempts report what they consulted (`ExecutionVerifiedResult.knowledge`), and a service-account auth lane if its HTTP API is ever offered to non-browser callers. Its product-side items (mail transport, exports, evidence library, observability) stay in the platform's own scope and move only when the founder product needs them.

## P2: Portfolio operation

`check:portfolio-registry` and `strategy/PORTFOLIO_REGISTRY.md` exist for the founder-workspace cross-business rollup, by design outside any single business's graph. Once more than one business runs through the engine concurrently, decide the operating surface: a founder-workspace session type with its own small catalog, or a projection assembled from each business's boundary report. Do not build it before a second live business exists.
