# Architecture

This document describes the architecture that exists today. `AGENTS.md` explains how maintainers work inside it; `SKILL.md` is the runtime entrypoint; the typed graph is the orchestration source of truth.

## Design principles

1. **Audience at the top level.** `playbook/` is agent knowledge, `business/` is the launch-repository artifact contract, `gates/` grades a launch, and `machine/` maintains the skill itself.
2. **Domain-organized knowledge.** Each playbook domain owns a `README.md` index with load conditions. Stage order lives in `spine.md`; execution order lives in the graph.
3. **Stable identity over filesystem location.** Graph IDs identify workflows, artifacts, operators, providers, gates, phases, lanes, domains, and areas. Paths are mutable bindings.
4. **One execution model.** Workflow definitions compile into a runtime-neutral run graph. No compatibility scheduler, prose task list, or manual collision map competes with it.
5. **Durable truth.** `PROJECT_STATE.yaml`, accepted artifact versions, run attempts, approvals, evidence, and fingerprints survive sessions. Chat history does not.
6. **Fail closed.** Missing nodes, missing outputs, partial fan-in, stale inputs, unverified claims, and resource conflicts cannot silently become success.

## Repository layout

```text
skill/b2c-mobile-business-launch/
  SKILL.md                 runtime entrypoint and always-on contracts
  spine.md                 phase-oriented launch walk
  graph/                   typed definitions, compiler, scheduler, run state
    workflows/             native workflow contracts
    generated/             deterministic graph projections
  playbook/                domain knowledge and README routing indexes
  business/                launch-repository artifact contract
  starters/                runnable archetype scaffolds
  gates/                   deterministic business validators by domain
  machine/                 versioning, fixtures, evals, parity, source freshness
  scripts/                 renderers, audit runner, and shared libraries
  state/                   Design Room state and schemas
  design-system/           promoted design tokens
  render/                  Design Room renderer
  agents/                  runtime manifests
docs/
  architecture.md
  implementation/
  validators.md
  method/
  prototypes/
  brainstorms/
  history/
```

## Layered graph model

### Definition graph
Immutable, skill-owned topology for business areas, domains, context packs, workflows, phases, lanes, artifacts, gates, operators, and providers.

### Business instance graph
The subset applicable to one launch after scope, archetype, current state, founder decisions, and provider availability are resolved.

### Durable run graph
Executable nodes with typed dependencies, accepted inputs, outputs, state predicates, approvals, resource claims, retries, timeouts, context contracts, and verification policy. Readiness is computed. Runtime adapters may serialize work but cannot weaken semantics.

### Trace and evidence graph
Every accepted artifact records the producing node and attempt, input fingerprint, evidence, and verification result. When an accepted input changes, downstream outputs become stale until recomputed and reverified.

## State and mutation

`PROJECT_STATE.yaml` is canonical mutable business state. Parallel workers never edit it directly. They return immutable outputs, evidence references, and proposed state patches. A single orchestrator-owned reducer validates and applies patches transactionally, renders the cockpit, and coordinates shared provider or git mutations.

Shared resources are explicit claims, including canonical state, integration branches, devices, provider accounts, publishing surfaces, and paths. Two nodes that write the same resource are serialized even when their data dependencies are otherwise independent.

## Context and verification

Execution order does not grant context automatically. Each node declares references, state selectors, accepted artifacts, trust classification, permissions, and budget. Independent verifiers run with fresh context and inspect the candidate output plus source evidence, never the producer conversation.

Deterministic anchors take priority over model judgment: tests that ran, files that exist, provider observations, accepted founder decisions, and measured business outcomes.

## Generated documentation

Generated files under `graph/generated/` and generated blocks in `SKILL.md` and `spine.md` come from graph definitions and renderers. Edit definitions, then run:

```bash
npm run render:skill-graph
npm run render:skill-graph -- --check
npm run check:skill-graph
```

## Change rules

- New orchestration behavior belongs in graph definitions, compiler logic, run-state transitions, scheduler policy, verifier policy, resource claims, or runtime adapters.
- New knowledge belongs in the relevant playbook domain and its README index.
- New readiness claims require a gate and fixtures.
- New recurring failures require a validator or LaunchBench scenario.
- Generated output is never edited by hand.
- Completed proposals move to `docs/history/` with a dated banner.

## Public artifact contract

The shape of `business/` is the root layout produced in a launch repository. Moving those paths is a versioned product migration, not cosmetic cleanup. The root `PROJECT_STATE.yaml`, business-relative evidence paths, state directory, design-system payload, and provider packets are public contracts consumed by gates and existing launches.
