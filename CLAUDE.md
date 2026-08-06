# Claude Repository Guide

This repository is Formation. Operate through the ownership boundaries in `AGENTS.md`. Formation, in `platform/`, is the founder product; the graph-native engine in `skill/b2c-mobile-business-launch/` is its internal launch engine and an independently maintained compatibility surface. The engine keeps its skill name and installed-runtime contract even though the repository is no longer a skill repo.

## Start here

For founder product work:

1. Read `README.md` and `docs/architecture.md`.
2. Read `platform/AGENTS.md`.
3. Inspect the relevant API, domain service, page, and test together.

For engine work:

1. Read `skill/b2c-mobile-business-launch/README.md`.
2. Read `skill/b2c-mobile-business-launch/SKILL.md`.
3. Inspect the relevant catalog node and context contract.
4. Load only the named knowledge references and workspace artifacts.

## Product execution

- Keep workspace authorization server-side.
- Treat facts, assumptions, recommendations, questions, and decisions as distinct records.
- Generated content enters as an editable draft.
- Artifact changes append immutable versions.
- Do not make product pages depend on repository paths or generated HTML.
- Add API and domain tests with every new mutation or readiness rule.

## Engine execution

- Use the compiled catalog for readiness and ordering.
- Parallelize only nodes without data, state, or resource conflicts.
- Give verifiers fresh context.
- Treat engine project state as canonical for engine execution and mutate it only through the reducer.
- Keep stable catalog IDs unchanged when paths move.
- Do not edit generated projections directly.

## Boundary

The platform owns users, memberships, companies, claims, decisions, tasks, deliverables, and founder navigation. The engine owns graph execution, attempts, autonomy, evidence, and verification. Exchange typed execution requests and verified results through an adapter; never share writable state.

This is maintainer-only guidance. Do not copy it into businesses or generated app repositories.
