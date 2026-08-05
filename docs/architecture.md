# Architecture

This document describes the architecture that exists today. `AGENTS.md` explains how maintainers work inside it; `SKILL.md` is the runtime entrypoint; the typed catalog (`catalog/`) is the orchestration source of truth, and `core/` is the runtime-neutral engine that actually executes against it — a scheduled session or the current conversation, not prose telling an agent to imagine compiling a graph.

## Design principles

1. **Audience at the top level.** `knowledge/` is agent knowledge, `workspace/business/` is the launch-repository artifact contract, `validation/business/` grades a launch, and `validation/repository/` maintains the skill itself.
2. **Domain-organized knowledge, catalog-derived routing.** Load conditions are authored once as catalog data (`catalog/domains.ts`, `catalog/references.ts`) and generated into `catalog/generated/routing.md`; no hand-authored per-domain `README.md` index competes with it. Stage order lives in `catalog/generated/spine.md`; execution order lives in `core/engine`.
3. **Stable identity over filesystem location.** Catalog IDs identify workflows, artifacts, operators, providers, gates, phases, lanes, domains, and areas. Paths are mutable bindings.
4. **One execution model.** Catalog definitions compile into a runtime-neutral durable run (`core/engine`: compile -> frontier -> dispatch), executed by `core/session/run.ts` and reduced through `core/reducer`. No compatibility scheduler, prose task list, or manual collision map competes with it.
5. **Durable truth.** `state/PROJECT_STATE.yaml`, the control file's grants and waivers, accepted artifact versions, run attempts, approvals, evidence, and fingerprints survive sessions. Chat history does not.
6. **Fail closed.** Missing nodes, missing outputs, partial fan-in, stale inputs, unverified claims, lapsed grants, and resource conflicts cannot silently become success.

## Repository layout

```text
skill/b2c-mobile-business-launch/
  SKILL.md                 runtime entrypoint and always-on contracts
  core/                     runtime-neutral engine
    schema/                 durable-file contracts and one status vocabulary
    engine/                 engine v2: compile -> frontier -> dispatch
    reducer/                single writer: patches, hash-chained audit log, lock
    autonomy/               grants/waivers/budget evaluator, kill switch, prerequisite probes
    adapters/                entrypoint/hook-free install adapters
    session/                run.ts (session runner), onboard.ts, approve.ts, brief/digest/executor
  catalog/                  typed catalog: domains, workflows, phases, lanes, gates, references
    workflows/              native workflow contracts by business area
    generated/               deterministic projections (routing.md, spine.md, catalog.json) + SKILL.md splice
  content/                  onboarding conversation scripts (content/onboarding/)
  knowledge/                domain knowledge, indexed by the generated routing table (no per-domain README)
  workspace/business/       launch-repository artifact contract (current template)
  workspace-template/       versioned v2 workspace/entrypoint templates for generated app repos
  starters/                 runnable archetype scaffolds
  studio/                   maintainer Design Room / Business Control Plane renderer and generated design tokens
  validation/business/      deterministic business validators by domain
  validation/repository/    versioning, fixtures, evals, parity, source freshness
  verification/             v2 fixture/boundary/parity suites, audit runner, rehearsal checklist
  tooling/                  renderers, probes, and shared libraries
  agents/                   runtime manifests
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

`state/PROJECT_STATE.yaml` is canonical mutable business state. Parallel workers never edit it directly. They return immutable outputs, evidence references, and proposed state patches. A single orchestrator-owned reducer validates and applies patches transactionally, renders the cockpit, and coordinates shared provider or git mutations.

Shared resources are explicit claims, including canonical state, integration branches, devices, provider accounts, publishing surfaces, and paths. Two nodes that write the same resource are serialized even when their data dependencies are otherwise independent.

## Context and verification

Execution order does not grant context automatically. Each node declares references, state selectors, accepted artifacts, trust classification, permissions, and budget. Independent verifiers run with fresh context and inspect the candidate output plus source evidence, never the producer conversation.

Deterministic anchors take priority over model judgment: tests that ran, files that exist, provider observations, accepted founder decisions, and measured business outcomes.

## Generated documentation

Generated files under `catalog/generated/` and the spliced Lane Routing block in `SKILL.md` come from catalog definitions and `catalog/render-routing.ts`. Edit the catalog, then run:

```bash
npm run catalog:render-routing
npm run catalog:render-routing -- --check
npm run check:catalog
```

## Change rules

- New orchestration behavior belongs in catalog definitions, `core/engine` compiler logic, run-state transitions, autonomy/scheduler policy, verifier policy, resource claims, or `core/adapters` runtime adapters.
- New knowledge belongs in the relevant playbook domain (`catalog/references.ts`'s `loadWhen` data), not a hand-authored per-domain index.
- New readiness claims require a gate and fixtures.
- New recurring failures require a validator or LaunchBench scenario.
- Generated output is never edited by hand.
- Completed proposals move to `docs/history/` with a dated banner.

## Public artifact contract

The shape of `business/` is the root layout produced in a launch repository. Moving those paths is a versioned product migration, not cosmetic cleanup. The root `state/PROJECT_STATE.yaml`, business-relative evidence paths, state directory, promoted design tokens (`business/design/system/`), and provider packets are public contracts consumed by gates and existing launches.

## Business artifact information architecture

The reusable `business/` workspace is a capability-owned projection of one launch instance. Its top-level directories are `state`, `strategy`, `product`, `design`, `engineering`, `analytics`, `growth`, `revenue`, `store`, `trust`, and `operations`. Directory placement expresses artifact ownership only; execution order remains graph-derived.

Every moved or added artifact requires synchronized graph bindings, validator paths, fixtures, renderers, and documentation. Stable graph IDs do not change when paths move.
