# Repository Agent Guide

This repository maintains the `b2c-mobile-business-launch` skill. These instructions govern the skill source repository, not app repositories created by the skill. Generated businesses receive their own app-specific entrypoints from `business/engineering/repo-agent-entrypoints/`.

## Read order

1. `README.md` for product scope
2. `docs/architecture.md` for system boundaries
3. `skill/b2c-mobile-business-launch/SKILL.md` for runtime contracts
4. the owning layer README and directly relevant files

## Layer ownership

| Layer | Owns | May depend on | Must not own |
| --- | --- | --- | --- |
| `graph/` | stable identities, contracts, dependencies, resources, gates, context packs, and compilation semantics | typed definitions | mutable business state or policy prose |
| `playbook/` | bounded business and implementation knowledge | official sources and graph IDs | scheduling or generated business artifacts |
| `business/` | reusable business-instance artifacts copied into app repositories | graph-bound paths and templates | skill policy or execution topology |
| `gates/` | deterministic business-artifact acceptance | business contracts and shared libraries | orchestration policy |
| `machine/` | skill integrity, package parity, source freshness, version discipline, and context budgets | repository source | business-instance decisions |
| `scripts/` | renderers, runners, probes, migrations, and shared executable utilities | graph, gates, machine, and source artifacts | durable policy that cannot be tested |
| `state/` and `render/` | skill-owned Design Room seed state and rendering implementation | design contracts | launch-instance canonical state |
| `starters/` | product-archetype overlays and runnable scaffolds | stable graph and business contracts | alternate orchestration systems |
| `docs/` | current architecture, implementation, validation, contribution, and dated history | source truth above | competing contracts |

Dependencies point downward from runtime orchestration into bounded knowledge and artifacts, then into deterministic proof. Filesystem proximity never creates an execution edge.

## Business workspace

`skill/b2c-mobile-business-launch/business/` is organized by capability: `state`, `strategy`, `product`, `design`, `engineering`, `analytics`, `growth`, `revenue`, `store`, `trust`, and `operations`. Add artifacts to the capability that owns the business decision and evidence. Update graph bindings, validators, fixtures, renderers, and documentation in the same change.

`business/state/PROJECT_STATE.yaml` is mutable business-instance state. It does not duplicate the definition graph. Parallel workers never write it directly; they return proposed patches to the orchestrator-owned reducer.

## Authored and generated boundaries

- Edit graph definitions, not `graph/generated/`.
- Edit source Markdown or JSON, not rendered HTML, unless the HTML is explicitly authored.
- Every generated file must declare or have an obvious owning renderer and a freshness check.
- Stable graph IDs survive path moves. Paths are bindings, not identity.

## Change contract

A structural or behavioral change is incomplete until it updates all affected layers: source definition, business artifact, validator, fixture or LaunchBench scenario, generated projection, version manifest, and current documentation. Archive completed plans under `docs/history/`; do not leave shipped work in `docs/brainstorms/`.

When a failure can recur, strengthen a type, validator, fixture, or eval instead of adding another reminder.

## Commands

From repository root:

```bash
npm install
npm run audit
npm run audit:ci
npm run launchbench
npm run check:skill-graph
npm run render:skill-graph -- --check
npm run check:version-discipline -- --repo-root . --skill-root skill/b2c-mobile-business-launch
npm pack --dry-run --json
```

Use `npm run audit -- --list` and `docs/validators.md` for the full gate inventory.

## Runtime sync

Edit repository source first. On the maintainer machine only, `npm run sync:runtime` mirrors the source skill into `~/.codex/skills/b2c-mobile-business-launch`, audits it, verifies parity, and checks Claude, Agents, and Cursor symlinks. In CI, cloud sessions, or clones without that installed runtime, skip sync and use `npm run audit:ci`.

## Safety and authority

Subagents may inspect and mutate bounded disjoint scopes. The orchestrator owns integration, git, canonical state, shared provider changes, public actions, spend, destructive actions, and release. Never commit secrets or credentials. Refresh official documentation or local CLI help before changing fast-moving provider commands.

## Maintainer compatibility contract

This file is for maintaining this skill repo itself. Do not copy these instructions into a launched business or generated app repo. Keep it a concise map; mechanical behavior belongs in a validator/eval.

## Runtime Sync

Use the runtime-sync process described above only on the maintainer machine.

## Source Freshness

Track and verify fast-moving external sources before changing provider guidance.
