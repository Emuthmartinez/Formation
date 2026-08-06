# Launch engine source map

This directory is the graph-native automation and verification engine behind Formation, as well as the compatibility surface for existing agent-skill consumers. The founder-facing product lives in [`../../platform/`](../../platform/). Do not add new founder application pages or mutable platform state here.

| Directory | Responsibility |
| --- | --- |
| `core/` | Typed schemas, the execution engine, the single-writer reducer, autonomy evaluation, scheduled sessions, and runtime adapters |
| `catalog/` | The definition graph as data: domains, lanes, workflows, gates, references, and routing projections |
| `knowledge/` | Bounded domain knowledge loaded by catalog context contracts |
| `content/` | Conversation content rendered by engine sessions |
| `workspace/`, `workspace-template/` | Reusable engine artifacts copied into app repositories and the workspace and entrypoint templates |
| `validation/` | Business gates, repository checks, fixtures, and LaunchBench |
| `verification/` | Core fixtures, capability-boundary tests, parity, scenarios, and the audit runner |
| `tooling/` | Renderers, probes, migrations, and command-line utilities |
| `studio/` | Maintainer visual QA source, seed state, and generated output |
| `starters/` | Runnable product-archetype foundations |

`SKILL.md` is the engine entrypoint. `spine.md` is the phase-oriented narrative. Stable catalog IDs are identities; filesystem paths are bindings.

## Product boundary

- Platform state is authoritative for founder-facing company context, decisions, tasks, and deliverables.
- Engine state is authoritative for execution attempts, verification, evidence, and autonomy controls.
- The platform and engine exchange typed requests and verified results through an adapter.
- Engine renderers remain internal exports and compatibility tools, not Formation navigation.
