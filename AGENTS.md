# Repository Agent Guide

This repository maintains the `b2c-mobile-business-launch` skill. These instructions govern the skill source repository, not app repositories created by the skill.

## Read order

1. `README.md` for product scope
2. `skill/b2c-mobile-business-launch/README.md` for the source map
3. `docs/architecture.md` for system boundaries
4. `skill/b2c-mobile-business-launch/SKILL.md` for runtime contracts
5. the owning directory README and directly relevant files

## Source layers

| Layer | Owns | Must not own |
| --- | --- | --- |
| `runtime/` | graph identities, contracts, compilation, scheduling, run state, adapters | business policy prose or mutable launch state |
| `knowledge/` | bounded reasoning guidance and official-source-backed doctrine | scheduling or generated business artifacts |
| `workspace/` | reusable launch artifacts copied into app repositories | skill execution topology |
| `validation/` | launch gates, repository checks, fixtures, and LaunchBench | orchestration policy |
| `tooling/` | renderers, probes, hooks, migrations, and runners | untestable durable policy |
| `studio/` | maintainer visual app, seed state, and generated visual outputs | launch-instance canonical state |
| `starters/` | runnable product-archetype foundations | alternate orchestration systems |

Dependencies point from runtime orchestration into bounded knowledge and workspace artifacts, then into deterministic validation. Filesystem proximity never creates an execution edge.

## Authored and generated boundaries

- Edit runtime graph definitions, not `runtime/graph/generated/`.
- Edit authored Markdown, JSON, or source components, not generated HTML.
- Every generated file needs an owning renderer and a freshness check.
- Stable graph IDs survive path moves. Paths are bindings, not identity.
- App state belongs in `workspace/business/state/`; studio seed state belongs in `studio/seed/`.

## Change contract

Structural or behavioral changes must update definitions, workspace artifacts, validators, fixtures or LaunchBench scenarios, generated projections, version metadata, and current documentation together. Archive completed plans under `docs/history/`.

## Commands

```bash
npm install
npm run audit
npm run audit:ci
npm run launchbench
npm run check:skill-graph
npm run render:skill-graph -- --check
npm pack --dry-run --json
```

Subagents may mutate bounded disjoint scopes. The orchestrator owns integration, git, canonical state, shared provider changes, public actions, spend, destructive actions, and release. Never commit secrets.


## Maintainer compatibility contract

This file is for maintaining this skill repo itself. Do not copy these instructions into a launched business or generated app repo. Generated businesses receive their own entrypoints from `workspace/business/engineering/repo-agent-entrypoints/`. Keep this file a concise map; mechanical behavior belongs in a validator/eval.

## Runtime Sync

Use runtime sync only on the maintainer machine after repository validation.

## Source Freshness

Verify fast-moving provider sources before changing commands or external guidance.
