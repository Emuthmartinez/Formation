from pathlib import Path
import json

root = Path('skill/b2c-mobile-business-launch')

skill = root / 'SKILL.md'
text = skill.read_text()
old = "When this skill activates for broad launch/business work, keep running the launch workflow without asking the user to re-invoke this skill. Load the next needed reference yourself, update `PROJECT_STATE.yaml`, render `launch-cockpit.html`, and run the relevant validators before readiness claims. Do not stop with instructions. When the cockpit changes or the session ends, say the narrative in your reply — what happened, what is next, what needs the founder; a rendered file nobody opens is not a status update."
new = "When this skill activates for broad launch or business work, compile the applicable definition graph into the launch-specific run graph and keep executing the computed readiness frontier without asking the user to re-invoke the skill. The compiled graph, durable run state, and accepted artifact versions are the dispatch source. Do not invent a second checklist or manually reorder work around the scheduler. Workers return outputs, evidence, and proposed state patches; the orchestrator-owned reducer is the only writer to `PROJECT_STATE.yaml`, `launch-cockpit.html`, shared provider state, and integration state. Run the relevant validators before readiness claims. When the cockpit changes or the session ends, narrate what happened, what is next, and what needs the founder; a rendered file nobody opens is not a status update."
if old not in text:
    raise SystemExit('SKILL autopilot paragraph not found')
text = text.replace(old, new)
marker = '### Runtime Routing And Dynamic Workflows\n'
insert = "### Graph Dispatch Contract\n\nThe graph is the only normal orchestration authority. Read `graph/README.md` and `docs/implementation/graph-execution-v2.md` when changing orchestration behavior. Stable IDs are identities; paths are bindings. A node is ready only when dependencies, state predicates, approvals, accepted inputs, resource claims, and retry policy allow it. Parallelism is computed from readiness and resource compatibility, not from prompt order. Verifiers receive fresh context and source evidence rather than the producer conversation. Missing outputs, partial fan-in, stale inputs, or undeclared writes fail closed.\n\n"
if insert not in text:
    text = text.replace(marker, insert + marker)
skill.write_text(text)

Path('docs/architecture.md').write_text('''# Architecture

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
''')

(root / 'graph/README.md').write_text('''# Typed Definition and Execution Graph

This directory is the canonical semantic and execution model for the skill. It defines stable identities and relationships, compiles the launch-specific plan, computes readiness, records durable attempts and evidence, and produces runtime-neutral dispatch batches.

## Authority

The graph is the only normal dispatch source. `SKILL.md` routes into it; playbooks provide knowledge to nodes; validators determine acceptance; runtime adapters execute the compiled plan. A runtime may reduce concurrency, but it may not reorder real dependencies, bypass founder approvals, weaken verification, or redefine completion.

## Layers

1. **Definition graph**: immutable skill topology.
2. **Business instance graph**: scope-selected topology for one launch.
3. **Durable run graph**: nodes, attempts, inputs, outputs, retries, joins, approvals, resources, and stale propagation.
4. **Trace and evidence graph**: accepted versions, producers, evidence, verification, and lineage.

## Native contracts

Workflow definitions use stable workflow IDs, native dependencies, output contracts, context packs, gates, operators, providers, and founder-only actions. Paths remain bindings to registered artifact identities.

A compiled node includes accepted inputs, declared outputs, dependencies, state predicates, approvals, resource claims, eligible operators, provider capabilities, execution limits, context, and verification policy.

## Scheduling

A node enters the readiness frontier only when every dependency, predicate, approval, input, retry, and resource condition passes. Dispatch batches are computed from that frontier plus resource compatibility. Prompt order is not an edge. Shared workspace, path, device, account, provider, and canonical-state conflicts are edges even when prompts look independent.

Fan-out must have a declared join. The join checks expected input cardinality and fails closed on missing workers. Large fan-in is layered through reducers instead of pouring unbounded raw output into one context.

## State and evidence

Workers return outputs, evidence, and proposed patches. The orchestrator-owned reducer is the single writer to canonical business state, cockpit output, git integration, and shared provider mutations.

Accepted artifacts carry fingerprints and producing attempt IDs. A changed accepted input invalidates downstream outputs. A stale output cannot satisfy readiness until recomputed and accepted again.

## Schema versions

- skill graph projections: generated graph `schemaVersion`
- execution plan: `GraphExecutionPlan.schemaVersion`
- durable run state: `GraphRunState.schemaVersion`
- skill release: `skill-version.json`

Bump the relevant schema whenever a consumer-visible shape changes.

## Commands

```bash
npm run render:skill-graph
npm run render:skill-graph -- --check
npm run check:skill-graph

npx tsx scripts/render-execution-plan.ts \
  --root /path/to/app \
  --state PROJECT_STATE.yaml \
  --runtime codex \
  --out /path/to/app/graph-run/execution-plan.json
```

## Extension checklist

1. preserve or add a stable native workflow ID
2. declare real dependencies only
3. register outputs and authored inputs
4. add state predicates and founder approvals
5. declare shared and exclusive resources
6. choose verification and fresh-context policy
7. add fixtures for missing nodes, cycles, stale inputs, partial joins, and undeclared outputs
8. regenerate projections
9. run the full audit and package dry run

Generated files under `graph/generated/` and generated blocks in `SKILL.md` and `spine.md` are renderer output. Never edit them directly.
''')

impl = Path('docs/implementation/graph-execution-v2.md')
text = impl.read_text()
if text.startswith('# Graph Execution v2\n'):
    text = '# Graph Execution v2\n\n> Current implementation guide for the graph-native catalog and durable execution runtime. Compatibility-era workflow fields and the second scheduler have been removed.\n' + text[len('# Graph Execution v2\n'):]
text = text.replace('Current compatibility boundary', 'Native catalog boundary').replace('compatibility compiler', 'execution compiler')
impl.write_text(text)

validators = Path('docs/validators.md')
text = validators.read_text()
if text.startswith('# Validators\n'):
    text = '# Validators\n\nThe audit validates both launch artifacts and the execution system that produced them. `check:skill-graph` verifies stable IDs, canonical workflow inventory, dependency integrity, cycles, registered outputs and gates, context routing, operator identity, compiler determinism, resource naming, fresh-context verification, generated projection freshness, and runtime-plan invariants.\n' + text[len('# Validators\n'):]
validators.write_text(text)

for path in [Path('CONTRIBUTING.md'), Path('AGENTS.md')]:
    text = path.read_text()
    heading = '## Documentation synchronization\n\n'
    section = heading + 'A behavior or schema change is incomplete until the repository README, `SKILL.md`, graph README, architecture guide, implementation guide, validator reference, affected domain README indexes, generated projections, and `skill-version.json` agree. Review every README even when only canonical surfaces need edits. Generated blocks are changed through definitions and renderers, never by hand.\n'
    if heading not in text:
        text += '\n' + section
    path.write_text(text)

version = '0.66.1'
for path in [Path('package.json'), root / 'package.json']:
    data = json.loads(path.read_text())
    data['version'] = version
    path.write_text(json.dumps(data, indent=2) + '\n')
for path in [Path('package-lock.json'), root / 'package-lock.json']:
    data = json.loads(path.read_text())
    data['version'] = version
    if '' in data.get('packages', {}):
        data['packages']['']['version'] = version
    path.write_text(json.dumps(data, indent=2) + '\n')
manifest = json.loads((root / 'skill-version.json').read_text())
manifest['version'] = version
manifest['updatedAt'] = '2026-08-03'
manifest['releaseNotes'] = [
    'Aligns the repository README, SKILL runtime contract, architecture, graph guide, implementation guide, validator reference, contributor guide, and maintainer guide with the graph-native execution model.',
    'Documents compiled readiness, single-writer state reduction, resource-aware scheduling, fresh-context verification, stale propagation, fail-closed fan-in, schema-version discipline, and the separation between knowledge routing and execution topology.',
    'Reviews every README and Markdown surface for removed compatibility-era guidance and regenerates graph-owned projections.'
]
(root / 'skill-version.json').write_text(json.dumps(manifest, indent=2) + '\n')

banned = ['upstreamWorkflowIds', 'legacyWorkflowEdges', 'inferredArtifactInputs', 'compatibility compiler']
offenders = []
paths = [Path('README.md'), Path('CONTRIBUTING.md'), Path('AGENTS.md'), *Path('docs').rglob('*.md'), *root.rglob('README.md'), root / 'SKILL.md', root / 'spine.md']
for path in paths:
    if 'docs/history/' in path.as_posix():
        continue
    body = path.read_text(errors='ignore')
    for term in banned:
        if term in body:
            offenders.append(f'{path}: {term}')
if offenders:
    raise SystemExit('stale documentation terms:\n' + '\n'.join(offenders))
