# Claude Repository Guide

This repository is Formation: a typed workflow-graph engine, in `skill/formation/`, that takes a consumer mobile-app business from idea to shipped and into ongoing autonomous operation. Operate through the ownership boundaries in `AGENTS.md`. Every UI is an external consumer in its own repository — the founder web product lives at Emuthmartinez/Formation-Platform, bound by the typed adapter contract, never a co-owner of engine state. The engine also installs as the `formation` agent skill; legacy `b2c-mobile-business-launch` aliases remain as compat symlinks for repos shipped before the rename.

Vocabulary, scoped by audience: in maintainer-facing material (this file, code comments, architecture docs) "the engine" is the correct name for `skill/formation/`. In founder-visible copy — digests, product pages, generated business surfaces — internal vocabulary never appears: no "engine", no lane ids, no phase codes, and exactly one named actor, Formation. `check:founder-copy` enforces the founder-visible half; this sentence is what scopes it.

## Start here

For engine work:

1. Read `skill/formation/README.md`.
2. Read `skill/formation/SKILL.md`.
3. Inspect the relevant catalog node and context contract.
4. Load only the named knowledge references and workspace artifacts.

For founder product (consumer) work: that code lives in Emuthmartinez/Formation-Platform, not here. Work there follows that repository's AGENTS.md; the boundary work here is the adapter contract and its golden samples.

## Founder-facing surfaces built here

- Generated content enters as an editable draft; artifact changes append immutable versions.
- After building or restyling a landing, web marketing, or founder-facing surface, dispatch the `vibecode-auditor` subagent pass (`skill/formation/knowledge/design/vibecoded-tells.md`) before calling it done.

## Skill execution

- Use the compiled catalog for readiness and ordering.
- Parallelize only nodes without data, state, or resource conflicts.
- Give verifiers fresh context.
- Treat skill project state as canonical for skill execution and mutate it only through the reducer.
- Keep stable catalog IDs unchanged when paths move.
- Do not edit generated projections directly.

## Boundary

Consumers (for example the Formation-Platform repository) own users, memberships, companies, claims, decisions, tasks, deliverables, and founder navigation. The skill owns graph execution, attempts, autonomy, evidence, and verification. Exchange typed execution requests and verified results through the versioned adapter contract; never share writable state.

This is maintainer-only guidance. Do not copy it into businesses or generated app repositories.
