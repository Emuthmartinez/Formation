# Graph Execution v2

> Current implementation guide for the graph-native catalog and durable execution runtime. Compatibility-era workflow fields and the second scheduler have been removed.

Graph Execution v2 makes the typed graph executable without tying the skill to one agent runtime.

## Shipped architecture

- `graph/execution.ts` compiles the skill graph into a deterministic runtime-neutral plan.
- Every workflow becomes a run node with a stable run identity, artifact identities, prerequisites, approvals, resources, verification policy, context contract, retry policy, and allowed execution modes.
- `initializeRun` creates durable node, attempt, approval, and artifact-binding state.
- `computeFrontier` admits work only when dependencies, accepted inputs, state predicates, and founder approvals are satisfied.
- `buildDispatchBatches` groups only resource-compatible ready nodes and selects the strongest supported runtime mode without changing graph semantics.
- `beginAttempt`, `reconcilePatch`, and `acceptVerification` separate production from acceptance and reject missing or undeclared outputs.
- `invalidateDescendants` marks downstream work stale when accepted inputs change.
- `scripts/render-execution-plan.ts` emits the same plan and initial dispatch batches for inline, Codex, or Claude runtimes.
- `check:skill-graph` validates compiler determinism, runnable roots, resource naming, retries, dependency integrity, and fresh-context isolation.

## Native catalog boundary

The workflow catalog now declares native `dependencies` and `outputPaths`. The compiler consumes those contracts directly, binds registered outputs to stable `ArtifactId` values, and derives explicit run-node inputs from dependency outputs. Runtime code does not execute prose task lists, infer legacy workflow IDs, or build a separate collision map.

Path bindings remain catalog metadata rather than execution identity. The runtime plan uses stable workflow and artifact identities, while current repository paths stay attached to their artifact definitions for reading, writing, and validation.

## Single-writer rule

Parallel workers return immutable outputs, evidence, and a proposed state patch. The orchestrator-owned reducer applies accepted changes. Workers do not directly write `state/PROJECT_STATE.yaml`, render the cockpit, integrate git, or mutate shared provider accounts.

## Runtime adapters

The canonical plan is vendor-neutral. Capability negotiation may choose:

- inline
- serial subagent
- parallel subagent
- worktree
- dynamic workflow

An adapter may serialize work when a feature is unavailable. It may not weaken prerequisites, skip proof, bypass approval, or redefine success.

## Safety properties

- no file-existence-only readiness
- no silent partial fan-in
- no undeclared output acceptance
- no retry without an attempt record
- no judgment verification in the producer context
- no parallel batch with an exclusive resource collision
- no downstream reuse after input invalidation
- no provider or founder-gated action assumed idempotent

## Next contract enrichment

1. Replace inferred artifact reads with authored stable input identities where a workflow needs stronger data-flow semantics.
2. Add richer typed state predicates, decision prerequisites, and resource claims where dependency completion alone is insufficient.
3. Compare authored contracts with compiler-derived behavior in `check:skill-graph` and resolve every mismatch explicitly.
4. Generate orchestration preflight and founder-safe next actions entirely from durable run state.
5. Keep path bindings on artifact definitions so repository moves do not change execution identity.
