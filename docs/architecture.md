# Repository architecture

This repository is a backend: a typed workflow-graph engine that takes a consumer mobile-app
business from idea to shipped, then into ongoing autonomous operation. Agents drive it — through
the packaged `formation` CLI and the `formation-mcp` Model Context Protocol server. The engine lives in `skill/formation/`. `platform/`, the
Formation founder web application, is one consumer of the engine, not the product this repository
exists to build.

The project's history runs the other direction. It began as an agent skill, then grew a founder
web product on top of it, and for a while that product was described as the point and the skill
as its internal automation. The 2026-08-19 audit reversed that: the engine was real, tested code
with **zero real callers** — nothing wired bootstrap to a session, verification acceptance was
unreachable from `run.ts`, and a fresh business's plan had no root nodes at all. The work since
then (v0.142.0–v0.146.0) closed that gap end to end and is what this document describes.

## Architectural principles

1. **The engine is graph-native, not prompt-native.** A business's launch and operation compile
   into a typed dependency graph — nodes, predicates, approvals, resource claims, retries,
   verification policy — and a session dispatches only the current ready frontier.
2. **Durable truth is reducer-owned.** Five documents — business state, control, grants, waivers,
   and the budget ledger — have exactly one writer. Every other component reads them or proposes
   patches; none writes them directly.
3. **Producer never verifies its own work.** Deterministic gates run inside the session that
   produced the work. Judgment work needs a second, independently-invoked session; the acceptance
   is refused mechanically if the accepting session id matches the producing one.
4. **Boundaries fail closed.** A missing document, a tampered file, an unreachable verifier, or a
   stale fingerprint blocks progress; none of them are silently treated as success.
5. **Autonomy is granted, not assumed.** A workflow runs unattended only inside a founder-set
   grant, waiver, or budget. Everything else parks for a decision.
6. **Standing operation is a calendar, not a one-time finish line.** Recurring nodes reopen on
   their own cadence — a session that runs on schedule finds the week's work waiting for it.
7. **Consumers integrate through typed adapters, never shared state.** A consumer such as the
   platform reads a read-only boundary report and submits typed execution requests; it holds no
   handle onto engine files.

## North star (target state)

The committed target this repository converges on — the layering plan at
`docs/plans/2026-08-19-001-engine-contract-and-consumer-extraction.md` is the path; items below
are TARGET, not description, until that plan's phases land.

| Layer | What | Lives |
| --- | --- | --- |
| L0 content | `catalog/` + `knowledge/` | this repo |
| L1 kernel | `core/` — compiler, frontier, reducer, sessions, autonomy, verification | this repo |
| L2 gates | `validation/`, `verification/`, the audit, `check:engine-e2e` | this repo |
| L3 addresses | SKILL.md routing, the `formation` CLI, `formation-mcp`, consumer front doors | this repo, same version |
| L4 consumers | platform UI, every future UI, third-party agent stacks | separate repos, contract-bound |

Four published contracts bind L4 to the engine: the adapter (boundary report + execution
request, schema-checked with a `contractVersion`), the MCP tool surface, the CLI, and the
workspace on-disk layout. The catalog is managed like source, consumed as a compiled artifact,
and varied by composition — scope verdicts, named profiles, additive packs — never by mutation.
Updates are explicit and per-business: a newer engine never silently changes a running operator.
The standing rule: **L4 never lives in this repository.**

## System context

```text
Agent (the formation CLI or the formation-mcp server) or a scheduled OS trigger
  -> formation bin / adapter CLI
  -> core/session/run.ts (one bounded session)
  -> core/reducer (the only writer of durable truth)
  -> catalog-compiled dependency graph, dispatched within grants/waivers/budgets
  -> deterministic gates + fresh-context verification
  -> hash-chained audit log + founder-plain digest

Consumers read the engine through typed adapters:
  platform/  -> core/adapters/platform-execution.ts (read) + platform-import.ts (existing-repo read)
             -> founder-facing execution requests, verified results, launch-matrix projection
```

## The execution loop

The loop below is the engine's real, audit-proven behavior. Every stage names the file that
implements it.

### 1. Bootstrap (`core/session/bootstrap.ts`)

One idempotent command that takes a workspace from "the engine cannot see this business" to
"`run.ts` runs against it." It composes four steps, each skipping cleanly if its outcome already
exists:

1. **install-entrypoints** (`core/adapters/install-entrypoints.ts`) — writes the executable
   `catalog.json` and the `.b2c-launch/runtime.json` runtime binding into the workspace.
2. **migrate-v1** (`core/schema/migrate-v1.ts`) — converts `state/PROJECT_STATE.yaml` (v1) into
   `state/business-state.json` (v2), plus a control-file scaffold when none exists.
3. **reducer adopt** — records both documents as the reducer's disclosed baseline in
   `control/manifest.json` and the hash-chained audit log, so the first session's tamper preflight
   has a truthful "before" to compare against.
4. **onboard.ts** (optional, `--answers`) — commits the founder's grants, waivers, and budgets
   through the reducer, the same path every other control write uses.

Default is dry-run; `--apply` is required to write. Re-running against a bootstrapped workspace
prints a no-op report rather than a second baseline.

### 2. Session (`core/session/run.ts`)

One bounded, single-run session. In order:

- **Advisory lock** — a workspace-wide lock so two sessions never dispatch against the same
  workspace at once.
- **Tamper preflight** — the reducer's manifest preflight confirms none of the five reducer-owned
  documents changed outside the reducer, and audit-chain verification confirms the hash chain is
  intact. This re-runs at every batch boundary, not just session start, so a same-session
  out-of-band edit is caught before the next batch.
- **Seed or resume run-state** — a fresh workspace seeds run state from the compiled plan; an
  existing one resumes exactly where the last session left it.
- **Pre-existing-material acceptance** — a binding with no in-run producer accepts from the file
  already on disk, fingerprinted at acceptance time. Changed material invalidates its
  descendants, so a business that already has real files does not have to re-produce them to make
  the graph proceed.
- **Calendar reopening** — a node with `recurrenceDays` whose last succeeded attempt is older than
  that cadence reopens before the frontier is computed, so a scheduled session finds standing
  operating work on its own calendar instead of the founder re-asking for it.
- **Frontier dispatch** — `computeFrontier` returns the current ready set; each dispatch runs
  within the founder's autonomy grants, waivers, and budgets, and the kill switch and cooperative
  yield are re-read fresh at every batch boundary.
- **Deterministic gates** — a node's `check:*`/`validate:*` gates run with the exact arguments the
  audit plan already knows for that gate, against this workspace. A gate that exits non-zero, or
  cannot run, counts as not-passed — never as accepted.
- **Fresh-context verification sweep** — run at every empty-frontier point inside the dispatch
  loop. A separate, independently-invoked verifier session judges produced work under the same
  producer≠verifier rule `core/session/verify.ts` enforces; the acceptance is attested in the
  hash-chained audit log. An acceptance re-opens the frontier, so downstream work dispatches in
  the same session instead of parking until the next one.
- **Founder-plain digest** — written on every exit path, success or failure, before the lock
  releases. Exit codes mirror the reducer's own convention: `0` ran (the digest tells the real
  story), `1` the workspace isn't usable, `2` did not run (lock contention), `3` preflight/tamper
  failure.

### 3. Founder edges

Three CLIs are the sanctioned paths from an engine-internal wait state back to schedulable work,
each writing through the engine's atomic writer and attesting the decision in the audit log:

- **`core/session/approve.ts`** — the founder edge: grant or reject a pending approval.
- **`core/session/verify.ts`** — the operator edge: fresh-context acceptance for produced work,
  mechanically refused if the accepting session matches the producing one.
- **The kill switch** — `control/control.json`'s `killSwitch.engaged` flag, re-read fresh on every
  dispatch-batch boundary, stops scheduled sessions cold even while the OS trigger keeps firing.

### 4. Standing operation

`workflow.operations.scheduled-autonomy-installation` installs the OS-level trigger
(`core/adapters/install-schedule.ts` — crontab or launchd, dry-run by default, `--apply` required
to touch the real system) that keeps the operating loop alive without anyone starting sessions by
hand. Once installed, the recurring nodes are self-ordering: support-queue operations, retention
intervention, and financial health review are each separately gated, seven-day-recurrence
workflows that write their own dated artifacts, and the weekly Post-launch Operations review reads
all three (plus its own) as inputs. Because recurrence reopens all four nodes each cycle and the
three lane nodes have no ordering dependency on the review beyond "run first," the lane artifacts
are current by the time the review reads them within the same session — no hand-authored ordering
required, just the reads-gate-readiness contract the calendar reopening enforces.

### 5. Surfaces

- **The packaged `formation` bin** (`skill/formation/bin/formation.mjs`) — an installable
  dispatcher over `bootstrap`, `plan`, `run`, `approve`, `verify`, `onboard`, and `schedule`. It
  execs the same TypeScript CLIs the audit and fixtures prove; it adds an address, not a second
  implementation. Before this existed, driving the engine required knowing the repository's
  internal `tsx` paths from inside a checkout.
- **An MCP server** is planned to expose the same subcommands over MCP, so an agent runtime can
  drive a workspace without shelling out to the CLI. It has not landed in this repository yet.
- **The platform HTTP adapter** (`core/adapters/platform-execution.ts` and
  `platform-import.ts`) — see below.

## Trust boundary

- **Reducer-only writes.** `core/reducer/` is the single writer for the five reducer-owned
  documents (`business-state`, `control`, `grants`, `waivers`, `budget-ledger`). Every write is a
  manifest-preflighted patch: the reducer refuses to write over a document whose on-disk hash does
  not match what the manifest last recorded.
- **Hash-chained audit log.** Every reducer commit, adoption, approval, and verification
  acceptance appends to `control/audit.jsonl`, chained by hash. `verify-audit` confirms the chain
  is intact; a broken chain fails the session's tamper preflight.
- **Producer≠verifier.** Deterministic nodes are verified by their own gates, run by the producing
  session — that is what the gates are for. Judgment nodes require a second, freshly-invoked
  session whose session id differs from the producer's; the engine enforces this mechanically, not
  by convention.
- **Deterministic validators.** `npm run audit` runs a 72-step plan (`tooling/lib/audit-plan.ts`)
  covering catalog integrity, schema validation, business gates, and repository checks.
  `check:engine-e2e` is the engine's own crash test: it bootstraps a throwaway copy of the
  reference business, runs a headless session against real frontier work, confirms fresh-context
  verification is actually reachable, resumes a second session cleanly, and proves its own
  detector by confirming a verifier-off control session leaves work correctly parked.
- **Knowledge receipts.** A dispatched worker's output is checked against a SHA-256 file digest
  recorded in its receipt (`receiptFileDigest` in `core/session/executor.ts`). A receipt that
  fails validation fails the node closed — the worker's claimed output is never trusted without a
  matching digest.

## Definition graph

`catalog/` holds the typed, stable definitions the engine compiles from: business areas, domains,
workflows, phases, lanes, artifacts, gates, operators, providers, roles, and presentation groups.
Each knowledge document has one YAML manifest under `catalog/knowledge/`, owning its stable
reference id, lifecycle, graph bindings, applicability, sources, review data, and replacements.
Provenance and shape-validation follow the same principles as W3C PROV-O and SHACL, implemented in
the existing YAML/TypeScript stack — no RDF infrastructure. `core/engine/compile.ts` turns the
catalog plus a business's accepted state into the durable, executable dependency graph a session
dispatches against. Stable catalog IDs survive path moves; edit catalog definitions, never
`catalog/generated/`.

## The platform: one consumer

`platform/` is a founder-facing web application built on top of the engine, not the engine itself.
It never reads or writes engine workspace files directly — it exchanges typed documents across two
read-only CLIs:

### Execution boundary (`core/adapters/platform-execution.ts`)

A read-only CLI the platform server spawns to learn, in a typed shape (schema `1.1.0`), what a
workspace's durable run looks like right now: per-workflow status keyed by stable catalog id,
founder-plain reasons drawn from the digest's own translation table, whether a durable run exists
yet, its founder approvals, and a compact launch-matrix projection with full node briefs only for
ready work. It never writes — submitting or resuming a run is `core/session/run.ts`'s job, invoked
by the platform through the same adapter contract, not this file. `GET
/api/workspaces/:workspaceId/launch-matrix` on the platform serves this projection after verifying
workspace membership; an older or unavailable engine returns `available: false` with a reason,
never an empty matrix.

### Existing-repository import (`core/adapters/platform-import.ts`)

A second read-only CLI for a launch workspace that predates the platform. Its report classifies
everything it finds as a candidate, never a fact: company context, proposed claims split into
recommendations and open questions, decisions with recorded verdicts, outstanding work, documents
fingerprinted per section, and named contradictions. It opens no handle for writing — a launch
repository can be imported and still be run by the engine afterward, unchanged.

### Authority rules

- The browser cannot read or write engine files.
- Importing a launch repository never writes to it.
- The engine cannot bypass platform workspace authorization, and the platform cannot bypass the
  engine's autonomy grants.
- Accepted platform context is fingerprinted when sent into an engine run; changed upstream
  context can mark downstream deliverables stale.
- A conditional workflow requires a durable `required` or `not-needed` verdict; a changed
  applicability verdict invalidates prior output proof when scope changes.

## Repository layout

```text
.github/workflows/
  platform-ci.yml              founder platform checks, tests, and build
  source-freshness.yml         engine source-registry and knowledge freshness audit
  behavioral-evals.yml         manual live LaunchBench behavioral eval run

docs/
  architecture.md               this document
  validators.md                 full validator and gate reference
  platform/                     platform-consumer audit, product, technical, migration, design, journey, gaps
  implementation/               engine implementation guidance
  method/                       engine operating methods
  brainstorms/                  exploratory scope documents
  plans/                        dated implementation plans
  prototypes/                   HTML design and engineering prototypes
  history/                      completed historical proposals and audits

platform/                       one consumer of the engine
  web/                           founder application
  server/                        API, auth, domain, persistence, generation, execution/import adapters
  data/                          ignored local data
  run.mjs                        platform command entrypoint
  README.md                      developer guide
  AGENTS.md                      platform contribution contract

skill/formation/                 the engine
  bin/                            the packaged `formation` CLI
  core/                           execution engine, reducer, autonomy, sessions, adapters
  catalog/                        typed definition graph and generated routing
  content/                        skill conversation content
  knowledge/                      domain guidance
  workspace/                      launch artifact and export contracts
  workspace-template/             generated launch repository templates
  starters/                       runnable app archetypes
  studio/                         maintainer Design Room
  validation/                     business and repository validators
  verification/                   engine proof suites
  tooling/                        renderers, probes, migrations, and audit tools
  agents/                         runtime manifests
```

## Source-of-truth ownership

| Concern | Authoritative owner |
| --- | --- |
| workflow definitions | engine catalog |
| executable dependency graph | engine core |
| attempts and checkpoints | engine core |
| autonomy grants and waivers | engine control state |
| verification evidence | engine verification layer |
| durable business state, control, budget ledger | engine reducer (sole writer) |
| user identity and membership | platform |
| company context, claims, decisions, tasks | platform |
| editable deliverables and product versions | platform |
| product navigation and page state | platform |
| static repository artifacts | engine export or compatibility layer |

## Development and verification

Engine:

```bash
npm run session:bootstrap -- --workspace <dir> --apply
npm run check:catalog
npm run test:fixtures
npm run test:boundaries
npm run test:parity
npm run audit
npm run audit:ci
```

`npm run audit` (`tooling/run-audit.ts`) runs the full 72-step plan, including
`check:engine-e2e`, the repo-only crash test. Run it from the repository root — running the
equivalent command from inside `skill/formation/` silently skips `repoOnly` steps.

Platform:

```bash
node platform/run.mjs check
node platform/run.mjs test
node platform/run.mjs build
```

A change that crosses both systems must run both verification paths.

## Evolution rules

- New execution topology belongs in the engine catalog and core.
- New founder behavior belongs in `platform/`, and must integrate through the typed adapter
  contract — never a direct read of engine workspace files.
- Do not add founder pages for individual engine files.
- Do not let product pages read static seed state in production.
- Do not duplicate company context inside prompts or renderer templates.
- New reducer-owned document mutations must go through `core/reducer/`, never a direct write.
- New autonomy-affecting changes require a founder-authority patch, not a bare state edit.
- New automation capabilities require an adapter contract and founder-facing failure language.
- Retire old static renderers only after their named consumers migrate.
