# Formation

[![audit:ci](https://img.shields.io/github/actions/workflow/status/Emuthmartinez/Formation/source-freshness.yml?branch=main&label=audit%3Aci)](https://github.com/Emuthmartinez/Formation/actions/workflows/source-freshness.yml) [![release](https://img.shields.io/github/package-json/v/Emuthmartinez/Formation?label=release)](https://github.com/Emuthmartinez/Formation) ![node](https://img.shields.io/badge/node-22-informational) [![license](https://img.shields.io/github/license/Emuthmartinez/Formation)](LICENSE)

Formation is a typed workflow-graph engine. It takes a consumer mobile-app business from idea to a shipped app, then keeps running it — support, retention, finance — as a standing autonomous operator. The engine lives in `skill/formation/`. It is the center of this repository.

## What this is

The engine is not prompts and a checklist. It is a compiled graph:

- **Catalog** (`skill/formation/catalog/`) defines 97 workflows across 15 domains as typed data — dependencies, gates, verification policy, provider bindings, knowledge bindings.
- **Compiler** (`skill/formation/core/engine/compile.ts`) turns the catalog plus one business's scope, archetype, and decisions into an executable dependency graph with resource claims, retries, timeouts, and recurrence.
- **Frontier** (`skill/formation/core/engine/frontier.ts`) computes what is ready to run right now, respecting dependencies, founder autonomy grants, and open approvals.
- **Reducer** (`skill/formation/core/reducer/`) is the single writer for durable run state. Every state change is one entry in a hash-chained audit log (`skill/formation/core/reducer/audit.ts`) — a broken link in the chain fails the check, not just a missing entry.
- **Sessions** (`skill/formation/core/session/`) are bounded units of work: resume state, dispatch ready nodes, run verification, digest what happened, stop. A session can be this conversation or a scheduled headless process.

Agents drive it. A founder, a scheduled cron job, or a chat session are all just callers that dispatch a session and read back verified results.

## The journey it runs

The catalog's phase spine (`skill/formation/catalog/generated/spine.md`) walks a business from a founder's first answers through shipped app and into ongoing operation:

1. **Founder-zero orient.** Access, autonomy grants, spend authority, durable state — before any lane work starts.
2. **Research, spec, experience, brand, design.** Evidence-backed product decisions, not taste.
3. **Build.** Engineering orchestration, device proof, security hardening.
4. **Launch.** Store listing, signing, revenue setup, pre-launch funnel, agent handoff.
5. **Operate.** Post-launch is not an afterthought — it is separately gated catalog work. Support, retention, and finance run as their own operating lanes, each with its own readiness gate (`check:post-launch`, `check:revenue`, and the support-queue evidence contract in `operations/SUPPORT_OPS.md`).

Operating work does not stop after phase 6. Catalog nodes carry `recurrenceDays` (`skill/formation/core/engine/runstate.ts`): a node whose last completed attempt is older than its recurrence window reopens automatically, so weekly operating work — the support sweep, the ops review — comes back onto the frontier without a human re-triggering it. The scheduled-autonomy node (`skill/formation/core/adapters/install-schedule.ts`) installs the OS-level trigger — crontab or launchd — that wakes a headless session to pick that work up.

## Quickstart

Requirements: Node.js 22 or later, dependencies installed from the root lockfile.

```bash
git clone https://github.com/Emuthmartinez/Formation.git
cd Formation
npm ci
```

Bootstrap a workspace once — this installs the executable catalog, migrates state to v2, seeds the reducer, and records onboarding answers. Dry run by default:

```bash
npm run session:bootstrap -- --workspace <dir>
npm run session:bootstrap -- --workspace <dir> --apply
```

See what is ready to run and what is parked on a founder decision:

```bash
npm run plan:frontier -- --workspace <dir>
```

Run one bounded headless session against the ready frontier:

```bash
tsx skill/formation/core/session/run.ts --workspace <dir> --brief <brief.json> --session <id>
```

Grant or reject a pending founder approval, and accept verified work with fresh-context evidence:

```bash
tsx skill/formation/core/session/approve.ts --workspace <dir> --approval <id> --decision approved --session <id>
tsx skill/formation/core/session/verify.ts --workspace <dir> --node <id> --session <id> --evidence <text>
```

Install a recurring trigger so operating work runs on its own:

```bash
tsx skill/formation/core/adapters/install-schedule.ts --workspace <dir> --runtime <cli> --schedule "<cron>" --apply
```

All seven of these are also reachable through the packaged `formation` bin (`skill/formation/bin/formation.mjs`) — `formation bootstrap`, `plan`, `run`, `approve`, `verify`, `onboard`, `schedule` — one installable dispatcher over the same session CLIs, not a second implementation.

## How trust works

Nothing in the graph is self-certifying:

- **The reducer is the only writer.** Attempts, approvals, accepted evidence, and run state change through one code path, and every change is a hash-chained audit entry.
- **Producer never verifies its own work.** `skill/formation/core/session/verify.ts` enforces that the session accepting evidence for a node is not the session that produced it.
- **`check:engine-e2e`** (`skill/formation/validation/repository/check-engine-e2e.ts`) is an audit gate that drives this repository's own reference business through the whole loop on every run: bootstrap, a headless session dispatching real frontier work, fresh-context verification, and a resumed second session picking the run back up cleanly. It also proves its own detector — a control session with verification deliberately off must leave work parked, and the check fails if that stops happening.
- **`npm run audit`** runs the full validator pipeline — typecheck, then every gate, through `skill/formation/tooling/run-audit.ts`. `npm run audit:ci` runs the CI subset. The full reference is [`docs/validators.md`](docs/validators.md).

## Repository map

```text
skill/formation/                       the engine
  core/                                 compiler, frontier, reducer, autonomy, sessions, adapters
    engine/                             compile, frontier, run-state, verification policy
    reducer/                            single writer, hash-chained audit
    autonomy/                           grants, waivers, budgets, prerequisite probes
    session/                            bootstrap, plan, run, approve, verify, onboard CLIs
    adapters/                           runtime installers and the platform boundary CLIs
  catalog/                              97 workflows, 15 domains, typed as data
    generated/                          rendered routing, contracts, and phase spine
  knowledge/                            bounded domain guidance loaded by catalog contracts
  validation/                           business gates, repository checks, fixtures, LaunchBench
  verification/                         the engine's own proof: fixtures, boundaries, parity, audit runner
  workspace/, workspace-template/       business artifact contracts and repo templates
  bin/                                  the packaged `formation` command

platform/                              a founder-facing web product, one consumer of the engine
  web/                                  application shell and product pages
  server/                               API, auth, persistence, domain logic

docs/                                  architecture, validators, and platform-specific docs
```

`platform/` never reads engine files directly. It calls two read-only CLIs — `skill/formation/core/adapters/platform-execution.ts` for durable-run status and approvals, `skill/formation/core/adapters/platform-import.ts` for reading an existing launch repository as drafts and questions — and writes nothing back into the engine's workspace. The platform and the engine keep separate writable state on purpose; see "Integration contract" in [`docs/architecture.md`](docs/architecture.md).

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — combined system architecture and the platform/engine integration contract
- [`docs/engine-backlog.md`](docs/engine-backlog.md) — what remains, ranked by how much it changes autonomous operation
- [`docs/validators.md`](docs/validators.md) — every validator and gate, what it checks, how to run it
- [`skill/formation/README.md`](skill/formation/README.md) — the engine's source map
- [`skill/formation/catalog/generated/spine.md`](skill/formation/catalog/generated/spine.md) — the phase-by-phase walk, generated from the catalog

The root manifest is `formation`. Its version moves in lockstep with `skill/formation/skill-version.json` under one release discipline; the platform's private manifest is `platform/package.json`, using the root lockfile.
