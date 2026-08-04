# Typed Definition And Execution Graph

This directory is the canonical semantic and execution model for the skill. It defines stable identities and relationships for business areas, domains, workflows, context packs, phases, readiness lanes, artifacts, gates, operators, and providers, then compiles those definitions into a durable run graph.

The graph is not a graph database or long-running service. It is deterministic TypeScript that produces a runtime-neutral plan. Claude workflows, Codex subagents, worktrees, and inline execution are adapters over the same plan and may reduce concurrency without changing prerequisites, proof, founder gates, or completion semantics.

## Layers

1. **Definition graph:** immutable skill-owned topology in this directory.
2. **Business instance graph:** the subset selected for one launch from scope, archetype, state, decisions, and available providers.
3. **Durable run graph:** run nodes, attempts, accepted input versions, retries, joins, approvals, resource claims, verification, and stale propagation.
4. **Trace and evidence graph:** what ran, what produced each accepted artifact, which attempt did it, and which evidence allowed it to pass.

`PROJECT_STATE.yaml` remains business truth. Workers do not mutate it directly during parallel execution. They return outputs, evidence, and proposed state patches; the orchestrator-owned reducer is the single writer to canonical state, the cockpit, git integration, and shared provider mutations.

Paths are attributes. Stable graph IDs are identities. The compatibility compiler can bind current path-shaped workflow outputs while the catalogue migrates, but runtime edges and accepted versions use graph identities.

## Execution contract

`execution.ts` owns the runtime-neutral contract:

- deterministic plan compilation
- durable node and attempt states
- accepted artifact bindings and input fingerprints
- founder approval interrupts
- typed state predicates
- exclusive and shared resource claims
- capability-aware dispatch batches
- fail-closed fan-in and undeclared-output rejection
- deterministic or fresh-context verification
- downstream invalidation when an accepted input changes

A graph controls dispatch even when the chosen execution mode is inline. Multi-agent fan-out is an optimization, not the definition of graph adoption.

## Commands

```bash
npm run render:skill-graph
npm run render:skill-graph -- --check
npm run check:skill-graph

# Runtime-neutral plan for a launch repo
npx tsx scripts/render-execution-plan.ts \
  --root /path/to/app \
  --state PROJECT_STATE.yaml \
  --runtime codex \
  --out /path/to/app/graph-run/execution-plan.json
```

Generated files under `graph/generated/` and generated blocks in `SKILL.md` and `spine.md` must be changed through graph definitions and renderers, never by hand.

## Cutover rule

The graph is the only normal dispatch source. Compatibility fields may be read while the 57 workflow contracts migrate, but they must not create a second scheduler. New orchestration behavior belongs in the compiler, run-state reducer, scheduler, verifier policy, or runtime adapters, not in another hand-authored task list or collision map.

A manual emergency override must record an owner, dated reason, declared resources, proof requirement, and follow-up graph issue. It is an escape hatch, not an alternate workflow system.
