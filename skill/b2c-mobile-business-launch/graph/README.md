# Typed Definition Graph

This directory is the canonical semantic model for the skill. It defines stable identities and relationships for business areas, domains, workflows, context packs, phases, readiness lanes, artifacts, gates, operators, and providers.

The graph is not a runtime framework or database. It is a typed, deterministic source of truth that projects into the existing filesystem, `SKILL.md`, the phase spine, the Business Control Plane, and validation reports.

## Layers

- **Definition graph:** immutable skill-owned topology in this directory.
- **Business instance state:** mutable launch status, evidence, blockers, approvals, decisions, and provider proof in `business/PROJECT_STATE.yaml` and the launched repo.
- **Execution state:** session-specific assignments, checkpoints, collisions, retries, and integration evidence in `ORCHESTRATION.md` and project state.

Paths are attributes. Stable graph IDs are identities. Do not use a file path as the identifier of a capability, workflow, operator, or lane.

## Commands

```bash
npm run render:skill-graph
npm run render:skill-graph -- --check
npm run check:skill-graph
```

Generated files under `graph/generated/` and generated blocks in `SKILL.md` and `spine.md` must be changed through the graph definitions and renderer, never by hand.
