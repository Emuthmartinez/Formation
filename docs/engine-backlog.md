# Engine backlog

What remains between the engine as it runs today and the engine as the direction demands: any agent operating consumer-app businesses end to end, without drifting, on infrastructure someone else can trust. Ranked by how much each item changes that. The retired SaaS-product backlog this replaces is preserved at [`docs/history/platform-remaining-gaps-2026-08-v0.147.0.md`](history/platform-remaining-gaps-2026-08-v0.147.0.md); the platform items that survive here do so as consumer-of-the-engine concerns, not as the product thesis.

Reproduce the ground truth before acting on any item: `npm run audit` (72 steps, including `check:engine-e2e`), `npm run plan:frontier -- --workspace <dir>` against a bootstrapped workspace, and the per-item commands below.

## P0: The layering plan (contracts, front doors, extraction)

The committed path is `docs/plans/2026-08-19-001-engine-contract-and-consumer-extraction.md` — twelve requirements, six phases. The near-term engine work it adds to this backlog:

- **A1 (v0.149.0) — SHIPPED:** the slug-divergence fix plus the adapter contract: generated schemas, `contractVersion`, fail-closed self-validation, `check:adapter-contract` golden samples.
- **A2 (v0.150.0) — SHIPPED:** MCP hardening on the workspace registry (`~/.formation/workspaces.json`): allowlist resolution, `asFounder` assertion, read-only mode, `formation_status`.
- **B (v0.151.0/.1) — SHIPPED:** `npm pack` standalone (smoke-tested) and the consumer front doors — `formation setup`, `doctor`, `new`, `update`, `list` — plus the mid-journey catalog re-pin proven in `check:engine-e2e`. Tagged `v0.151.1`; consumers pin by tag.
- **C — SHIPPED (2026-08-19):** the founder web product extracted to the private Formation-Platform repository (history preserved) with an engine pin, contract-golden replay in its CI, and the hosted instance cut over before `platform/` was deleted here.
- **D — SHIPPED (v0.153.0):** engine-only CONTRIBUTING with the adapter-contract bump rules; the architecture layer table is description, not target.
- **E — SHIPPED (v0.155.0 + v0.156.0):** the `catalog:add-workflow` scaffolder; the packs design (`docs/plans/2026-08-20-001-packs-composition.md`, implementation deliberately deferred until a real second pack exists); and named profiles — `project.launchScope` is now compiled fact (`deferredByProfiles` on every node, enforced by reconcileWorkflowApplicability, overridable per workflow via `formation scope`), where before it had no engine-side consumer at all. The layering plan is COMPLETE.

Reproduce what remains: `ls skill/formation/tooling | grep -i add-workflow` (no scaffolder yet), `grep -rn "launch_scope" skill/formation/catalog/*.yaml | head` (scope verdicts exist; named profiles do not).

## P0: A real business through the real executor

`check:engine-e2e` proves the loop with the fixture executor. The loop with the **real** worker CLIs (claude/codex/cursor-agent) has run only in development sessions, never as a standing proof against a live business. The next launch is the forcing test: bootstrap it, schedule it, and let the operating loop run for two weeks with real workers and real founder approvals. What breaks becomes fixture cases; what holds becomes the reference for the exposure story.

- Reproduce: `formation bootstrap --workspace <live-business> --apply`, then `formation run` with the default executor.

## P0: Worker-receipt enforcement on the interactive path

The sha256 fail-closed knowledge receipt lives in the headless executor (`core/session/executor.ts`). The interactive Task-subagent path still relies on the orchestrating session honoring `app-agent-roster.md` by hand. Mechanical enforcement means the reducer refusing a dispatched worker's patch without a receipt matching the brief — the same trust-boundary review class as the executor arc was.

## P1: Spend truth on the ledger

`buildActualPatch` records actuals equal to estimates (a deliberate, named placeholder) because fixture executors report no cost. The real executor can report usage; wire actual token/wall-clock cost into the ledger entry so budget balances reflect reality, not plans. The `authorizationDigest` receipt field is also still echo-able by the worker (`core/session/worker-prompt.ts`) — replace it with something the worker cannot see verbatim, or drop it.

## P1: MCP surface hardening — SHIPPED (v0.150.0)

The `formation-mcp` server now resolves workspaces only through the registry allowlist, requires an explicit `asFounder` assertion on `formation_approvals` and `formation_schedule`, and narrows to `formation_plan` + `formation_status` under `FORMATION_MCP_READONLY=1`. What remains before REMOTE exposure (it is still a local stdio surface): transport auth and an audit trail of tool calls per caller identity.

## P1: Verification rejection recovery

A fresh-context rejection parks a node under `Verification rejected.` durably — correct — but nothing routes a producer back to it. Define the retry edge: a rejection should surface as founder-visible work with the verifier's evidence attached, and a new producing attempt should clear the parked state through the ordinary attempt machinery.

## P2: Platform-as-consumer follow-ons

The founder web product consumes the engine from its own repository ([Emuthmartinez/Formation-Platform](https://github.com/Emuthmartinez/Formation-Platform)). Its engine-relevant residue from the retired backlog: result-to-knowledge traceability once real attempts report what they consulted (`ExecutionVerifiedResult.knowledge`), and a service-account auth lane if its HTTP API is ever offered to non-browser callers. Product-side items live in that repository's scope entirely.

## P2: Portfolio operation

`check:portfolio-registry` and `strategy/PORTFOLIO_REGISTRY.md` exist for the founder-workspace cross-business rollup, by design outside any single business's graph. Once more than one business runs through the engine concurrently, decide the operating surface: a founder-workspace session type with its own small catalog, or a projection assembled from each business's boundary report. Do not build it before a second live business exists.
