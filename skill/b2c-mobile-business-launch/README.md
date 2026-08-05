# Skill Source Map

| Directory | Responsibility |
| --- | --- |
| `core/` | Typed schemas, the execution engine (compile/frontier/dispatch/run state), the single-writer reducer, the autonomy evaluator, the scheduled-session runner, and runtime adapters |
| `catalog/` | The definition graph as data — domains, lanes, workflows, gates, references — and the routing renderer |
| `knowledge/` | Bounded domain knowledge loaded by catalog context contracts |
| `content/` | Founder-facing conversation content (onboarding) rendered by the session |
| `workspace/`, `workspace-template/` | Reusable business artifacts copied into app repositories, and the v2 workspace/entrypoint templates |
| `validation/` | Business gates, repository checks, fixtures, and LaunchBench |
| `verification/` | The core's own proof — fixtures, the capability-boundary suite, parity, scenarios, and the audit runner |
| `tooling/` | Renderers, probes, migrations, and command-line utilities |
| `studio/` | Skill-owned visual studio source, seed state, and generated output |
| `starters/` | Runnable product-archetype foundations |

`SKILL.md` is the runtime entrypoint. `spine.md` is the phase-oriented narrative. Stable catalog IDs are identities; filesystem paths are bindings.
