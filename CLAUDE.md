# Claude Runtime Guide

Operate this repository through the typed catalog and core runtime, and the ownership boundaries in `AGENTS.md`. Load only the context required by the active catalog node.

## Start here

1. Read `skill/b2c-mobile-business-launch/README.md`.
2. Read `skill/b2c-mobile-business-launch/SKILL.md`.
3. Inspect the relevant catalog node (`catalog/`) and its context contract.
4. Load the named knowledge references and workspace artifacts only.

## Execution

- Use the compiled catalog for readiness and ordering.
- Parallelize only nodes without data, state, or resource conflicts.
- Give verifiers fresh context.
- Treat `workspace/business/state/PROJECT_STATE.yaml` as canonical business state and mutate it only through the orchestrator-owned reducer.
- Keep stable catalog IDs unchanged when paths move.
- Do not edit generated projections directly.

## Repository responsibilities

`core` executes, `catalog` defines the graph as data, `knowledge` explains, `workspace` persists the business, `validation` and `verification` prove, `tooling` performs mechanics, `studio` renders maintainer visuals, and `starters` bootstrap apps.


This is a maintainer-only Claude-specific pointer. Do not copy it into businesses created by the skill. Generated app guidance comes from `workspace/business/engineering/repo-agent-entrypoints/CLAUDE.md`. Repository correctness is enforced through validators, and LaunchBench.
