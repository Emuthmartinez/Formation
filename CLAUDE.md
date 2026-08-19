# Claude Repository Guide

This repository is Formation. Operate through the ownership boundaries in `AGENTS.md`. Formation, in `platform/`, is the founder product; the Formation skill, in `skill/formation/`, is its graph-native launch automation and an independently maintained compatibility surface. The skill installs as `formation`; legacy `b2c-mobile-business-launch` aliases remain as compat symlinks for repos shipped before the rename. Vocabulary: say "the Formation platform" and "the Formation skill" (or "the platform" / "the skill" after first mention) — the skill is never called an engine, and founder-visible copy names exactly one actor, Formation.

## Start here

For founder product work:

1. Read `README.md` and `docs/architecture.md`.
2. Read `platform/AGENTS.md`.
3. Inspect the relevant API, domain service, page, and test together.

For skill work:

1. Read `skill/formation/README.md`.
2. Read `skill/formation/SKILL.md`.
3. Inspect the relevant catalog node and context contract.
4. Load only the named knowledge references and workspace artifacts.

## Product execution

- Keep workspace authorization server-side.
- Treat facts, assumptions, recommendations, questions, and decisions as distinct records.
- Generated content enters as an editable draft.
- Artifact changes append immutable versions.
- Do not make product pages depend on repository paths or generated HTML.
- Add API and domain tests with every new mutation or readiness rule.
- After building or restyling a landing, web marketing, or founder-facing surface, dispatch the `vibecode-auditor` subagent pass (`skill/formation/knowledge/design/vibecoded-tells.md`) before calling it done.

## Skill execution

- Use the compiled catalog for readiness and ordering.
- Parallelize only nodes without data, state, or resource conflicts.
- Give verifiers fresh context.
- Treat skill project state as canonical for skill execution and mutate it only through the reducer.
- Keep stable catalog IDs unchanged when paths move.
- Do not edit generated projections directly.

## Boundary

The platform owns users, memberships, companies, claims, decisions, tasks, deliverables, and founder navigation. The skill owns graph execution, attempts, autonomy, evidence, and verification. Exchange typed execution requests and verified results through an adapter; never share writable state.

This is maintainer-only guidance. Do not copy it into businesses or generated app repositories.
