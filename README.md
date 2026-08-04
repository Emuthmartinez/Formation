# B2C Mobile Business Launch Skill

An agent skill that takes a consumer mobile app from idea, transcript, specification, or half-built repository to a launched and operated business. It combines a graph-native orchestration model with durable business state, bounded specialist agents, founder approval interrupts, deterministic validators, and evidence-backed readiness claims.

[![audit:ci](https://img.shields.io/github/actions/workflow/status/Emuthmartinez/b2c-mobile-business-launch-skill/source-freshness.yml?branch=main&label=audit%3Aci)](https://github.com/Emuthmartinez/b2c-mobile-business-launch-skill/actions/workflows/source-freshness.yml)
[![skill version](https://img.shields.io/github/package-json/v/Emuthmartinez/b2c-mobile-business-launch-skill?label=skill)](skill/b2c-mobile-business-launch/skill-version.json)
[![node 22](https://img.shields.io/badge/node-22-informational)](CONTRIBUTING.md)
[![license MIT](https://img.shields.io/github/license/Emuthmartinez/b2c-mobile-business-launch-skill)](LICENSE)

There is no application server to start. Install the skill into Claude Code, Codex, or another compatible agent runtime, open the app repository you want to launch, and ask for the outcome you want.

## What it does

The skill can:

- recover a launch from an existing repository and durable state
- research the category, buyers, competitors, pricing, and market language
- define the product, experience, design system, copy, analytics, revenue, privacy, security, and store plan
- coordinate implementation through bounded task and subgraph nodes
- run independent verification in fresh contexts
- pause only for protected founder decisions such as credentials, spend, pricing, legal approval, public actions, destructive actions, and release
- leave behind machine-readable state, evidence, run history, and founder-readable status

Typical requests:

> “Turn this transcript into a business I can launch.”

> “Take this half-built consumer app to TestFlight and App Store submission.”

> “Resume this launch, determine what is stale or blocked, and keep going.”

## The execution model

The typed graph under [`skill/b2c-mobile-business-launch/graph/`](skill/b2c-mobile-business-launch/graph/) is the only normal dispatch source. It is executable architecture, not a diagram layered beside a separate workflow.

It is layered:

1. **Definition graph**: stable skill-owned identities and contracts for business areas, domains, workflows, context packs, phases, lanes, artifacts, gates, operators, and providers.
2. **Business instance graph**: the launch-specific subset selected from scope, archetype, state, approvals, and available providers.
3. **Durable run graph**: runnable nodes, attempts, dependencies, resource claims, retries, joins, approval interrupts, verification, and stale propagation.
4. **Trace and evidence graph**: accepted artifact versions, producing attempts, proof, and lineage.

The orchestrator compiles and executes this model. Agents perform judgment inside bounded nodes. Runtime adapters may serialize work when necessary, but they may not change prerequisites, proof requirements, founder gates, or completion semantics.

`state/PROJECT_STATE.yaml` remains the canonical mutable state for one business. Parallel workers do not edit it directly. They return outputs, evidence, and proposed state changes to an orchestrator-owned reducer, which is the single writer to canonical state, the launch cockpit, shared provider mutations, and integration state.

## Quickstart

```bash
git clone https://github.com/Emuthmartinez/b2c-mobile-business-launch-skill
cd b2c-mobile-business-launch-skill

mkdir -p ~/.codex/skills
rsync -a --delete --exclude node_modules \
  skill/b2c-mobile-business-launch/ \
  ~/.codex/skills/b2c-mobile-business-launch/

npm install --prefix ~/.codex/skills/b2c-mobile-business-launch
```

Then open your app repository and ask naturally:

```text
Read notes/idea.md, inspect this repo, and take the business to launch readiness.
```

For multiple runtimes, install one canonical copy and symlink the others to it:

```bash
ln -sfn ~/.codex/skills/b2c-mobile-business-launch ~/.claude/skills/b2c-mobile-business-launch
ln -sfn ~/.codex/skills/b2c-mobile-business-launch ~/.agents/skills/b2c-mobile-business-launch
```

## Business capability tree

The copied `business/` workspace is organized by capability rather than a flat artifact list. See [`business/README.md`](skill/b2c-mobile-business-launch/business/README.md) for ownership and paths. Each capability directory owns its authored artifacts and points downward to narrower contracts instead of duplicating cross-repository guidance.

## What lands in the app repository

| Area | Durable output |
| --- | --- |
| State and status | `state/PROJECT_STATE.yaml`, run state, evidence, and `state/launch-cockpit.html` |
| Founder operations | `operations/BUSINESS_ACCESS.md`, structured approvals, access proof, and one action at a time |
| Research and positioning | market evidence, competitor and review mining, research verdicts, and `state/LAUNCH_TRACE.md` |
| Product and experience | `product/SPEC.md`, `engineering/TECH_SPEC.md`, acceptance criteria, experience contracts, and scope locks |
| Design | `design/DESIGN.md`, state-driven Design Room versions, tokens, baselines, and rendered proof |
| Engineering | implementation plans, task ownership, device proof, backend contracts, and production readiness |
| Revenue and growth | pricing, RevenueCat and Stripe contracts, paid acquisition, viral loops, lifecycle email, and funnel assets |
| Store operations | signing, screenshots, metadata, privacy answers, submission packets, and rejection handling |
| Trust | threat model, security proof, privacy, terms, deletion, monitoring, and accepted risk |
| Analytics and copy | event catalog, attribution, experiments, dashboards, and validated user-facing copy |

## Documentation map

- [`skill/b2c-mobile-business-launch/SKILL.md`](skill/b2c-mobile-business-launch/SKILL.md): runtime entrypoint and always-on contracts
- [`skill/b2c-mobile-business-launch/spine.md`](skill/b2c-mobile-business-launch/spine.md): phase-oriented launch walk
- [`skill/b2c-mobile-business-launch/graph/README.md`](skill/b2c-mobile-business-launch/graph/README.md): graph semantics, compiler, scheduler, and run-state contract
- [`docs/architecture.md`](docs/architecture.md): current repository and execution architecture
- [`docs/implementation/graph-execution-v2.md`](docs/implementation/graph-execution-v2.md): implementation details and extension rules
- [`docs/validators.md`](docs/validators.md): validator and audit reference
- [`CONTRIBUTING.md`](CONTRIBUTING.md): development, release, and review workflow
- [`AGENTS.md`](AGENTS.md): maintainer rules and repository map

Every domain under [`playbook/`](skill/b2c-mobile-business-launch/playbook/) has its own `README.md` index with load conditions and bounded references. Those indexes describe knowledge routing. They do not define execution order. Execution order comes from the compiled graph and durable run state.

## Validation

```bash
npm install
npm run audit
npm run audit:ci
npm run audit -- --list
npm run check:skill-graph
npm run render:skill-graph -- --check
npm run launchbench
npm pack --dry-run --json
```

The audit starts with TypeScript and formatting, validates the graph and generated projections, runs deterministic business gates, executes 700+ validator fixtures through LaunchBench, and checks package and version discipline.

The house rule is simple: when a failure can recur, strengthen the graph contract, validator, fixture, or LaunchBench scenario instead of adding another paragraph that nobody can reliably execute.

## Scope

The skill is opinionated for subscription and freemium consumer mobile apps. One-time purchase and advertising-led businesses are not yet first-class paths. Provider integrations are optional until their lane is in scope, but the skill never silently replaces a required capability with a weaker fallback.

## Security and license

Report vulnerabilities through [`.github/trust/SECURITY.md`](.github/trust/SECURITY.md). Participation is governed by [`.github/CODE_OF_CONDUCT.md`](.github/CODE_OF_CONDUCT.md). Licensed under [MIT](LICENSE).
