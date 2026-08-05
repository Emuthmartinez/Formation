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
| `core/` | the executed runtime — typed schemas, the engine (compile/frontier/dispatch/run state), the single-writer reducer, the autonomy evaluator, the scheduled-session runner, and runtime adapters | business policy prose or mutable launch state |
| `catalog/` | the definition graph as data — domains, lanes, workflows, gates, references with load-when conditions — and the routing renderer | run state or business policy prose |
| `knowledge/` | bounded reasoning guidance and official-source-backed doctrine | scheduling or generated business artifacts |
| `content/` | founder-facing conversation content (onboarding) rendered by the session, in founder vocabulary | execution topology or generated artifacts |
| `workspace/` and `workspace-template/` | reusable launch artifacts copied into app repositories, and the v2 workspace/entrypoint templates | skill execution topology |
| `validation/` | launch gates, repository checks, fixtures, and LaunchBench | orchestration policy |
| `verification/` | the greenfield core's own proof — schema/engine/reducer fixtures, the capability-boundary suite, cross-runtime parity, scenario ports, and the audit runner | business-artifact grading (that is `validation/`'s job) |
| `tooling/` | renderers, probes, migrations, and runners | untestable durable policy |
| `studio/` | maintainer visual app, seed state, and generated visual outputs | launch-instance canonical state |
| `starters/` | runnable product-archetype foundations | alternate orchestration systems |

Dependencies point from the core runtime into the catalog and bounded knowledge/content, then into deterministic validation and verification. Filesystem proximity never creates an execution edge.

## Authored and generated boundaries

- Edit catalog definitions (`catalog/*.ts`), not `catalog/generated/`.
- Edit authored Markdown, JSON, or source components, not generated HTML.
- Every generated file needs an owning renderer and a freshness check.
- Stable catalog IDs survive path moves. Paths are bindings, not identity.
- App state belongs in `workspace/business/state/`; studio seed state belongs in `studio/seed/`.
- Only the reducer CLI (`core/reducer/cli.ts`) writes reducer-owned business documents; the engine owns run-state/checkpoint files. Nothing else writes durable state.

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
