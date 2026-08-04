# Graph Execution v2

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

## Current compatibility boundary

The current 57 workflow contracts still declare `upstreamWorkflowIds` and path-shaped outputs. The compiler is the only compatibility reader: it binds paths to registered `ArtifactId` values and turns upstream outputs into explicit run-node inputs. Runtime code does not execute the prose task list or build a separate collision map.

The remaining catalogue migration is mechanical rather than architectural: author explicit input identities and richer edge predicates on each workflow, compare them against compatibility inference, then delete the legacy fields after parity. The execution engine already uses the target semantics.

## Single-writer rule

Parallel workers return immutable outputs, evidence, and a proposed state patch. The orchestrator-owned reducer applies accepted changes. Workers do not directly write `PROJECT_STATE.yaml`, render the cockpit, integrate git, or mutate shared provider accounts.

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

## Next catalogue migration

1. Add authored `inputs`, typed predicates, and resource claims to workflow seeds.
2. Compare authored contracts with compatibility inference in `check:skill-graph`.
3. Resolve every mismatch explicitly.
4. Remove `upstreamWorkflowIds` and workflow `artifactPaths` as execution inputs.
5. Generate the orchestration preflight and founder-safe next action entirely from run state.
