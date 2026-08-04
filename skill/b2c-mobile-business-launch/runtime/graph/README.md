# Typed Definition and Execution Graph

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

npx tsx tooling/render-execution-plan.ts   --root /path/to/app   --state state/PROJECT_STATE.yaml   --runtime codex   --out /path/to/app/graph-run/execution-plan.json
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

Generated files under `runtime/graph/generated/` and generated blocks in `SKILL.md` and `spine.md` are renderer output. Never edit them directly.
