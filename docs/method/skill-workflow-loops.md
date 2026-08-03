# Workflow Modeling Method

The live workflow inventory is generated from the typed definition graph:

- source definitions: `skill/b2c-mobile-business-launch/graph/workflows/`
- generated inventory: `skill/b2c-mobile-business-launch/graph/generated/skill-graph.md`
- machine-readable graph: `skill/b2c-mobile-business-launch/graph/generated/skill-graph.json`
- context budget: `skill/b2c-mobile-business-launch/graph/generated/context-report.json`

Every workflow keeps the five-part contract established by the original audit:

1. trigger
2. action
3. proof
4. durable memory
5. observable stopping condition

The point of the typed graph is not to erase this method. It makes the method executable and prevents the inventory, lane topology, context routing, gates, and Control Plane from maintaining separate versions of the same relationships.

The full v0.64.0 inventory and its stopping-condition audit remain as a dated record in [`../history/skill-workflow-loops-2026-08-v0.64.0.md`](../history/skill-workflow-loops-2026-08-v0.64.0.md). It is evidence for why the graph definitions exist, not current policy.

## Maintenance loop

When a workflow changes:

1. edit the relevant `graph/workflows/*.ts` definition
2. update domains, contexts, lanes, artifacts, gates, operators, or providers only when their real relationship changed
3. run `npm run render:skill-graph`
4. run `npm run check:skill-graph`
5. run the full audit and LaunchBench

Do not edit generated graph files or generated blocks in `SKILL.md` and `spine.md` directly.
