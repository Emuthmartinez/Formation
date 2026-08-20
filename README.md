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

Requirements: Node.js 22 or later and at least one agent CLI you already pay for (`claude`, `codex`, or `cursor-agent`) — the engine orchestrates YOUR agents, on your subscriptions.

```bash
git clone https://github.com/Emuthmartinez/Formation.git
cd Formation
npm ci
npm run setup
```

`npm run setup` installs the engine package, creates `~/.formation` with an empty workspace registry, runs the same health report as `formation doctor`, and prints your next steps — including the exact MCP registration lines for Claude Code, Cursor, and the Codex CLI, with this checkout's real paths filled in. From there the whole journey is five commands:

```bash
formation new my-app --dir ~/biz/my-app          # a fresh business's birthplace
formation bootstrap --workspace ~/biz/my-app --apply --answers answers.json
formation workspaces register my-app ~/biz/my-app # the machine's registry = the MCP allowlist
formation run --workspace ~/biz/my-app --brief brief.json --session s-001
formation schedule --workspace ~/biz/my-app --runtime claude --schedule "0 9 * * *" --apply
```

(`formation` is global after `npm link --prefix skill/formation`; without linking, use `node skill/formation/bin/formation.mjs`.) `plan` shows the frontier read-only, `approve` and `verify` are the founder and verification edges, `list` shows every registered business with live status, and `update` moves the engine — never a running business, which re-pins only through its own explicit `bootstrap --apply`. The full journey is documented in [`skill/formation/README.md`](skill/formation/README.md) ("The consumer journey").

### Handing it to an agent

The setup is agent-runnable end to end — if someone shared this repository with you, paste this to the agent of your choice:

> Clone https://github.com/Emuthmartinez/Formation.git, run `npm ci` and `npm run setup` in it, follow the printed steps to register the `formation` MCP server with yourself, then create my first business with `formation new`, walk me through the bootstrap answers it needs, register the workspace, and show me the plan.

Everything the agent needs beyond that is discoverable: `formation --help` lists every command, each command prints its own usage, `formation doctor` names anything missing on the machine, and `skill/formation/SKILL.md` is the skill entrypoint for runtimes that route skills. `npm pack` of `skill/formation/` is a standalone artifact, smoke-tested by `check:package-parity` on every audit; distribution is git-tag pinning (`v0.151.1` onward).

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

docs/                                  architecture, validators, plans, and history
```

Consumers never read engine files directly. The founder web application lives in its own private repository — [Emuthmartinez/Formation-Platform](https://github.com/Emuthmartinez/Formation-Platform) (extracted from this monorepo on 2026-08-19, history preserved) — and integrates through two read-only CLIs it spawns from a pinned engine checkout: `skill/formation/core/adapters/platform-execution.ts` for durable-run status and approvals, and `skill/formation/core/adapters/platform-import.ts` for reading an existing launch repository as drafts and questions. Both emit schema-checked boundary reports carrying a `contractVersion`; the consumer refuses an incompatible major rather than interpreting it, and replays this repository's golden contract samples in its own CI. The standing rule from the layering plan: **L4 never lives in this repository.**

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — system architecture and the consumer integration contract
- [`docs/engine-backlog.md`](docs/engine-backlog.md) — what remains, ranked by how much it changes autonomous operation
- [`docs/validators.md`](docs/validators.md) — every validator and gate, what it checks, how to run it
- [`skill/formation/README.md`](skill/formation/README.md) — the engine's source map
- [`skill/formation/catalog/generated/spine.md`](skill/formation/catalog/generated/spine.md) — the phase-by-phase walk, generated from the catalog

The root manifest is `formation`. Its version moves in lockstep with `skill/formation/skill-version.json` under one release discipline. Releases are tagged (`v0.151.1` onward); consumers pin the engine by tag.
