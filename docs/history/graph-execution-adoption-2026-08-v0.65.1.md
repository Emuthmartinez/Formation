> Historical record: this proposal described the v0.65.1 graph execution gap in August 2026. The graph-native catalog cutover, executable runtime plan, and cleanup described here shipped in v0.66.0; this document is no longer current policy.

# Adopting the graph as the execution model

Status: proposal, not policy. The measurements in "What is in the tree" describe v0.65.1.
Everything after that section is a target architecture and migration plan.

## Executive decision

Adopt the graph fully at the orchestration boundary, but do not implement it as a single
artifact-path DAG.

The clean target is a **compiled, layered execution graph**:

```text
skill definition graph
        ↓ compile for one launch
business instance graph
        ↓ expand for one run
durable run graph
        ↓ execute and record
trace + evidence graph
```

The definition graph says what work can exist. The instance graph selects what this launch
needs. The run graph owns readiness, dispatch, retries, joins, approvals, resource locks, and
verification. The trace graph records what actually happened and what evidence proves it.

The orchestrator should execute that graph. It should not hand-build a task list from prose,
invent dependencies turn by turn, or maintain a second file-collision map beside the graph.

One boundary remains correct: the graph owns **work, state transitions, and proof**, not the
knowledge inside a node. `playbook/` stays prose. A workflow node loads bounded knowledge,
performs one contracted job, and returns typed output. Turning every reference or paragraph into
a node would confuse content with control flow.

This is full adoption without graph theater:

- every dispatched unit has a stable graph identity and a run identity
- every prerequisite has typed semantics
- every mutable shared resource is declared before dispatch
- every run transition is durable and resumable
- every output is versioned and tied to evidence
- every runtime executes the same runtime-neutral plan
- the old hand-authored dispatch maps are deleted after parity

Full adoption does **not** mean every task uses multiple agents. A small or genuinely sequential
node can run inline. The graph still decides that it is ready, records its attempt, and verifies
its result.

## What the current proposal got right

The proposal identified the central problem correctly: the typed graph is a strong catalogue,
but it does not yet drive execution.

It also correctly identified several concrete defects:

- all 57 workflow bodies inherit generic `action`, `proof`, `memory`, and
  `stoppingCondition` text from one helper
- the validator grades text that the same helper generated to satisfy it
- workflow dependencies are declared rather than mechanically tested
- context packs are domain-wide instead of node-bounded
- no code computes a ready frontier from `state/PROJECT_STATE.yaml`
- the existing gates are the anchors that can keep an agent graph grounded
- fresh-context verification is required for judgment work
- the skill should emit plans for runtimes rather than grow a long-running service
- graph cost and parallelism need explicit caps

Keep those findings. They are the reason to proceed.

## What is in the tree (measured at v0.65.1)

The typed definition graph shipped in v0.65.0 and it is real: 6 areas, 15 domains, 20 phases,
22 lanes, 110 references, 15 context packs, **57 workflows**, 88 artifacts, 78 gates, 11
operators, and 21 providers. `check:skill-graph` rejects duplicate and unknown IDs, lane and
workflow cycles, unrouted references, unregistered gates, operator-prompt drift, and stale
projections.

It is a catalogue, not an execution model. Four measurements show the gap.

### 1. Every node body comes from one template

All 57 workflows are built by `graph/workflows/helpers.ts`, and none overrides `action`, `proof`,
`memory`, or `stoppingCondition`. Each action is the same three sentences with its title
substituted. Proof is `<gate> exits 0`. The stopping condition is generated from the same gate
strings.

`validate.ts` therefore checks text written by the helper to pass the check. The proof, memory,
and stopping-condition validations can be green without 57 independently designed node
contracts.

### 2. Workflow edges are declared, not explained

`upstreamWorkflowIds` is hand-written: 19 roots, 10 nodes with more than one upstream, and a
longest declared chain nine edges deep. The type has outputs through `artifactPaths`, but no
input contract. The graph cannot determine whether a declared data dependency carries anything.

### 3. Context is domain-granular

`buildContextPacks` creates one pack per domain, and `composeSkillGraph` gives a workflow the entry
references from that domain pack. A run node cannot yet declare the exact references, state
slice, artifact versions, trust boundary, or tool permissions it needs in a fresh context.

### 4. Nothing computes a durable frontier

Lane dependencies prevent a lane from being marked done over an open upstream lane, with a dated
override. That edge has real enforcement and should remain.

No code answers: given this definition version, launch state, scope, decisions, artifact
versions, and active attempts, which nodes are runnable now? `continuity.next_action` is still
hand-authored, and the parallel-orchestration preflight builds candidate units and collisions by
hand.

One execution surface is already parallel: `run-audit.ts` places independent checks in a
concurrency pool behind a typecheck barrier and serializes LaunchBench. A graph will add more
failure isolation and semantics than raw speed there.

## What must change before implementation

The original proposal is incomplete in seven important ways.

### 1. Artifact paths cannot be graph identities

The repo's own architecture says paths are attributes and stable graph IDs are identities.
`consumes: string[]` would reverse that rule and make a file move look like a new dependency.

The current artifact catalogue also derives many artifact IDs from their paths. That is useful
for discovery, but it is not a stable identity contract. Before artifacts become executable
edges, each executable artifact needs an authored stable `ArtifactId`, with one or more current
path bindings.

Replace path-shaped workflow contracts:

```ts
consumes: string[];
artifactPaths: string[];
```

with identity-shaped contracts:

```ts
inputs: ArtifactRead[];
outputs: ArtifactWrite[];
```

Paths remain on `ArtifactDefinition`. A compiler binds an `ArtifactId` to the current launch
path. Renaming `strategy/RESEARCH.md` must not silently change the identity of the research evidence.

### 2. Data flow is only one edge kind

The fake-edge test is valuable for data edges. It is not a universal definition of an edge.

A workflow can be blocked because:

- it needs a verified artifact
- a state predicate is false
- a founder decision is pending
- another workflow must finish for a non-artifact invariant
- a provider, account, device, git tree, or file prefix is exclusively in use
- a verifier or reducer has not accepted an output
- a conditional branch did not select it

Only the first is an artifact intersection. Forcing every relationship through a file would
create fake artifacts merely to preserve sequencing.

Use typed edge semantics. Every data edge must carry an artifact version. Every non-data
prerequisite must carry a machine-checkable predicate or decision identity. A shared resource is
not a permanent causal edge at all; it is a scheduling constraint that may impose temporary
ordering for one run.

### 3. The 57 workflows are capabilities, not necessarily atomic run nodes

Several current workflows produce multiple artifacts, span multiple phases, or describe an
entire producer-review-render cycle. They are useful stable capabilities, but some are too broad
to dispatch as one indivisible attempt.

Keep them as task nodes when they are truly bounded. Otherwise make them subgraph definitions
that expand into run nodes such as:

```text
plan → fan out → reduce → verify → reconcile state
```

The definition graph can stay readable while the compiler creates the smaller units needed for
retries, isolation, and partial recovery.

### 4. Artifact existence is not readiness

A file can exist and still be stale, unverified, generated from older inputs, or left over from a
failed attempt. "Every consumed file exists" is not a sufficient frontier rule.

A ready node needs input bindings to accepted artifact versions. Each binding should carry at
least:

- artifact identity
- content or semantic fingerprint
- producing run node and attempt
- verification status
- freshness policy
- evidence references

When an upstream fingerprint changes, downstream results that depended on the old version become
`stale`. The existing change-cascade behavior should feed this invalidation model rather than
remain a separate warning system.

### 5. Shared state will erase the proposed parallelism unless it gets one owner

The generic workflow action currently tells every node to update `state/PROJECT_STATE.yaml`. That makes
all 57 workflows writers to the same mutable resource. A scheduler that models this honestly
would serialize almost everything.

Workers should return immutable results, evidence, and a proposed state patch. A dedicated
state-reconcile reducer, owned by the orchestrator, applies accepted patches transactionally.
The same single-owner rule applies to:

- `state/PROJECT_STATE.yaml`
- `state/launch-cockpit.html`
- git staging, integration, commits, merges, and releases
- provider and account mutations
- shared simulator or device sessions

This preserves the manager pattern already documented in the repo and creates real parallel
read-only or isolated work.

### 6. Runtime features are adapters, not architecture

Claude Dynamic Workflows, Codex subagents, inline execution, worktrees, and any future runtime
have different limits and APIs. None should define the canonical graph.

The graph compiler must emit a runtime-neutral plan. Adapters translate that plan into:

- inline execution for small or tightly coupled work
- serial or parallel subagents
- isolated worktrees
- a Claude workflow script when available and worthwhile

An adapter may reduce parallelism when capabilities are missing. It may not reinterpret
dependencies, skip proof, weaken a human gate, or invent a different completion state.

### 7. The audit pipeline should be the first execution customer, not the last

`run-audit.ts` already has a typecheck barrier, a concurrency pool, serial steps, deterministic
output order, and explicit failure reporting. It offers less speedup than launch work, but it is
the best conformance fixture because its nodes and anchors are deterministic.

Move the audit plan onto the same compiler and scheduler before dispatching open-ended launch
work. If the graph cannot faithfully reproduce the audit barrier, concurrency, serial
LaunchBench step, failure propagation, and ordered reporting, it is not ready to run a business
launch.

## August 2026 engineering synthesis

Current agent-orchestration practice converges on a hybrid rather than an all-agent or all-DAG
design:

- explicit workflows own process rules, durable state, routing, and human interrupts
- agents operate inside bounded nodes where judgment or exploration is useful
- one manager owns the user thread, integration, guardrails, and final answer
- execution state must be checkpointed so a run can resume after process or model failure
- side effects must be isolated and idempotent because retries and resumes can replay work
- parallel execution needs explicit resource ownership, not only data-dependency analysis
- the execution graph and the context/message graph are related but separate concerns
- simple work should use the smallest execution mode that fits
- deterministic tests and real external outcomes are stronger anchors than model consensus

The useful ideas in the Graph Engineering article fit this model: remove fake data edges, fan out
independent work, reduce before synthesis, use fresh verifiers, layer fan-in, count expected
results, isolate writers, and keep hard anchors. The article becomes unsafe only when those
heuristics are treated as the complete execution semantics.

## Target layered model

### Layer 1: definition graph

Owned by the skill and versioned under `graph/`.

It defines:

- stable capability and subgraph identities
- stable artifact, decision, resource, gate, operator, and provider identities
- typed inputs and outputs
- explicit non-data prerequisites
- context contracts
- execution and retry policies
- verification policy
- optionality and selection rules
- default budgets and risk class

It does not contain business-instance status or run attempts.

### Layer 2: business instance graph

Compiled for one launch from:

- the definition graph version
- `state/PROJECT_STATE.yaml`
- launch scope
- app archetype
- selected platforms
- selected providers
- founder decisions
- explicit deferrals and overrides

This layer selects the workflows that apply, binds stable artifacts to launch paths, resolves
conditions, and records why optional nodes were included or omitted. It is a frozen plan revision,
not a live transcript.

A change to scope, platform, provider, or a material upstream artifact produces a new plan
revision. It does not mutate history.

### Layer 3: durable run graph

Expanded from one instance-plan revision.

It contains the actual executable units:

- task nodes
- subgraph expansions
- fan-out shards
- reduce and integration nodes
- verifier nodes
- state-reconcile nodes
- founder approval interrupts
- conditional branches
- bounded loops
- joins

Each run node has durable status:

```text
pending
ready
running
waiting_human
blocked
succeeded
failed
skipped
cancelled
stale
```

Each attempt records its owner or lease, start and finish state, input fingerprint, output
references, evidence, error, retry decision, and resource claims.

### Layer 4: trace and evidence graph

Append-only proof of what happened.

It links:

```text
plan revision
  → run node
    → attempt
      → exact input versions
      → output versions
      → gate results
      → verifier verdicts
      → state patch
      → integration result
```

This layer makes silent failure and self-grading visible. It also supports cost, latency, retry,
and reliability analysis without treating generated reports as truth.

### Orthogonal layer: context and permissions

Execution topology does not automatically define what an agent sees.

Every task contract must separately declare:

- exact reference IDs
- exact state selectors
- exact artifact versions
- trust class of each input
- tool and provider permissions
- read-only or write scope
- maximum context or token budget
- whether context must be fresh
- whether untrusted content must be quarantined

A verifier receives the finding and its source evidence, never the producer transcript. A
privileged actor receives a validated structured result, never raw untrusted content unless its
job requires it.

## Canonical contract

A v2 workflow contract should look conceptually like this:

```ts
interface WorkflowDefinitionV2 {
  id: WorkflowId;
  kind: "task" | "subgraph";
  title: string;
  domainId: DomainId;
  areaIds: AreaId[];

  triggers: TriggerDefinition[];
  inputs: ArtifactRead[];
  outputs: ArtifactWrite[];
  prerequisites: Prerequisite[];
  resources: ResourceClaim[];

  context: ContextContract;
  execution: ExecutionPolicy;
  verification: VerificationPolicy;

  laneIds: LaneId[];
  phaseIds: PhaseId[];
  providerIds: ProviderId[];
  operatorIds: OperatorId[];
  founderOnlyActionIds: DecisionId[];
}
```

The supporting contracts need explicit semantics:

```ts
interface ArtifactRead {
  artifactId: ArtifactId;
  requirement: "required" | "optional";
  accepts: "latest_verified" | "latest_succeeded" | "specific";
  freshness?: FreshnessPolicyId;
}

interface ArtifactWrite {
  artifactId: ArtifactId;
  mode: "create" | "replace" | "patch" | "append";
  ownership: "exclusive" | "reducer_owned";
}

type Prerequisite =
  | { kind: "state"; predicateId: StatePredicateId }
  | { kind: "workflow"; workflowId: WorkflowId; requires: "succeeded" | "verified"; reason: string }
  | { kind: "approval"; decisionId: DecisionId }
  | { kind: "condition"; conditionId: ConditionId };

interface ResourceClaim {
  resourceId: ResourceId;
  mode: "shared" | "exclusive";
}

interface ExecutionPolicy {
  preferredMode: "inline" | "subagent" | "worktree" | "workflow";
  join: "all" | "any" | "quorum";
  maxAttempts: number;
  timeoutSeconds?: number;
  idempotency: "pure" | "keyed" | "manual_recovery";
  budgetId: BudgetId;
}

type VerificationPolicy =
  | { kind: "deterministic"; gateIds: GateId[] }
  | { kind: "adversarial"; lensIds: VerificationLensId[]; freshContext: true }
  | { kind: "quorum"; lensIds: VerificationLensId[]; threshold: number; freshContext: true }
  | { kind: "human"; decisionId: DecisionId };
```

Names can change during implementation. The semantics cannot.

Two migration rules are non-negotiable:

1. `ArtifactDefinition.id` must be authored and stable before executable edges depend on it.
2. A free-text `reason` is explanatory only. Readiness must evaluate a typed predicate, decision,
   gate, or accepted artifact version.

## Edge semantics

| Relationship | How it is represented | Readiness rule |
| --- | --- | --- |
| Data dependency | Derived from an output `ArtifactId` to an input `ArtifactId` | Required accepted version exists |
| State dependency | Explicit state predicate | Predicate evaluates true against the plan's state revision |
| Workflow invariant | Explicit workflow prerequisite with reason | Required upstream state is succeeded or verified |
| Founder approval | Decision node / interrupt | Recorded approval matches the pending decision and plan revision |
| Conditional route | Typed condition and selected branch | Branch is selected; non-selected nodes become skipped |
| Verification | Compiler-inserted verifier or deterministic gate node | Policy threshold passes against the exact output version |
| Resource collision | Shared/exclusive resource claims | Scheduler can acquire every claim for the attempt |

A shared writer is not automatically an upstream workflow. It is either:

- an invalid collision
- an explicitly reducer-owned output
- a versioned append
- a patch that a single integration node applies

The compiler must reject ambiguous shared writes rather than invent an ordering.

## Resource model

File equality is too weak for safety. These all conflict even when their strings differ:

- a file and its parent directory
- two paths under the same generated bundle
- two migrations against one database
- two agents using one provider account
- two App Store Connect mutations
- two sessions controlling one simulator
- any worker and the orchestrator both mutating git state
- any worker and the state reducer both writing `state/PROJECT_STATE.yaml`

Define stable resources such as:

```text
resource.state.project
resource.git.integration
resource.path.design-system
resource.provider.app-store-connect
resource.provider.revenuecat
resource.device.ios-simulator
resource.account.social-publishing
```

A resource can have capacity greater than one for safe rate-limited reads. Mutations are exclusive
unless a provider-specific policy proves otherwise.

The generated parallel batch is the set of ready nodes whose resource claims are compatible,
not merely the set with no data edge between them.

## Compiler

The graph compiler is deterministic TypeScript, not an LLM.

For one launch and one plan revision it should:

1. validate stable identities and schemas
2. select applicable workflows by scope, archetype, platform, provider, and state
3. expand subgraphs and bounded fan-out shards
4. bind artifact identities to exact accepted versions and launch paths
5. derive data edges from typed input/output bindings
6. add explicit state, decision, condition, and workflow prerequisites
7. insert reducers, verifiers, and founder interrupts
8. validate join, loop, retry, and idempotency policies
9. validate resource ownership and reject ambiguous writes
10. compute the critical path, ready frontier, compatible batches, and budget envelope
11. emit a runtime-neutral Graph IR plus a human-readable explanation
12. emit a migration report for any legacy declaration that disagrees

The compiler's output is not evidence that the work passed. It is only a plan.

`graph/generated/` remains the projection of the skill-owned definition graph. A real launch's
instance plan, run state, and trace belong in the launch repo, not under the skill definition
directory. The exact launch-repo location should be chosen as a versioned artifact-contract
decision in the durable-state step, not smuggled into an earlier renderer.

## Scheduler and durable execution

The scheduler should be a callable library and CLI used by the orchestrator, not a daemon.

It must support:

- deterministic frontier computation
- atomic status transitions
- leases or attempt ownership
- shared and exclusive resource acquisition
- configurable concurrency and token budgets
- `all`, `any`, and quorum joins
- bounded retry with backoff
- timeout and cancellation
- explicit skip, defer, and override reasons
- founder pause and resume
- checkpoint and resume after process failure
- expected-input counts at every fan-in
- stale propagation when accepted inputs change
- fail-closed handling of missing node results
- a dry-run explanation of why each node is ready or blocked

A node that performs side effects must be pure, keyed-idempotent, or marked for manual recovery.
Retrying an unclassified side effect is a compile error for autonomous modes.

Loops are allowed only with a typed stop predicate and a hard attempt or budget cap. The
definition graph may contain bounded cycles; each materialized run segment must remain
checkpointable and explainable.

## State reduction

The state reducer is the only system component that writes canonical launch state during
parallel execution.

A worker result should resemble:

```ts
interface NodeResult {
  runNodeId: RunNodeId;
  attemptId: AttemptId;
  inputFingerprint: string;
  outputs: ProducedArtifactVersion[];
  evidence: EvidenceRef[];
  proposedStatePatch: JsonPatchOperation[];
  findings: StructuredFinding[];
}
```

The reducer:

1. confirms the attempt still owns its lease
2. confirms inputs have not changed
3. checks deterministic gates and required verification
4. rejects stale or conflicting patches
5. applies accepted state changes
6. triggers deterministic renderers
7. recomputes staleness and the frontier
8. appends trace events

This replaces every worker independently editing canonical state and then hoping merge order
preserves truth.

## Runtime adapters

One plan, several adapters.

### Inline adapter

Use for small, sequential, high-coupling, or exploratory nodes. It still records attempts,
inputs, outputs, evidence, and state patches.

### Codex adapter

Translate compatible batches into bounded subagent or worktree assignments. Preserve the
manager pattern: workers do not stage, commit, mutate providers, control shared devices, or write
canonical state.

### Claude adapter

Translate a compatible batch or subgraph into a Dynamic Workflow when the feature is available
and the expected breadth justifies the cost. Workflow-specific script syntax belongs in the
adapter. It does not belong in `WorkflowDefinition`.

### Capability fallback

Each adapter reports capabilities. The scheduler may serialize work, choose inline execution, or
split a run into smaller segments when a feature is unavailable. Quality gates and human gates
do not degrade.

Adapter parity tests must prove that the same fixture reaches the same terminal node states and
evidence requirements under inline, Codex-style, and Claude-style execution.

## Verification and anchors

Use the strongest available verifier in this order:

1. deterministic test, schema, query, build, or external receipt
2. independent source check against the exact claim
3. fresh-context adversarial judgment
4. explicit human decision

Do not add three model voters to every node. Majority agreement among agents reading the same
bad source is still one bad source with a committee.

Judgment verification should declare distinct lenses only when they answer different questions,
for example correctness, freshness, and source fidelity. The result is structured, tied to the
output fingerprint, and unable to mutate the producer's work.

High-risk nodes fail closed. Lower-risk nodes may return `needs_review` with a visible blocker.
No verifier report and no synthesized plan may become evidence for itself.

Untrusted public content remains quarantined. Read-only evidence workers can inspect it. Actors
with provider, git, credential, or publication permissions receive only validated structured
outputs.

## When the graph should still run inline

Full graph adoption governs dispatch and state. It does not require fan-out.

Choose inline execution when:

- the task is small
- there is one real critical path
- the next action depends on exploratory feedback
- coordination would cost more than the work
- one shared device, provider, or source of truth forces serialization
- no two ready nodes have compatible resources

Exploratory work can live inside an `agentic` task or subgraph with a bounded budget and output
contract. The graph defines when exploration is allowed, what it may access, what it must return,
and what proves completion. It should not pretend to know the model's internal reasoning steps.

## Migration sequence

Each step lands as its own versioned PR, keeps `npm run audit:ci` green, updates the relevant
architecture and public surfaces, and adds deterministic fixtures before the next step starts.

| Version | Step | Exit proof |
| --- | --- | --- |
| 0.66 | **Graph semantics v2.** Author stable artifact IDs; add typed inputs, outputs, non-data prerequisites, decisions, resources, execution policy, context contract, and verification policy. Keep legacy fields only through an explicit compatibility reader. | Migration report covers all 57 workflows; every legacy edge is classified; ambiguous shared writers fail |
| 0.67 | **Compiler and instance graph.** Select workflows for template launch states, bind artifact IDs, expand subgraphs, derive data edges, and emit runtime-neutral Graph IR in dry-run mode. | Same input state produces byte-stable plan; every inclusion, omission, edge, and block has an explanation |
| 0.68 | **Durable run state.** Add run-node statuses, attempts, checkpoints, input fingerprints, evidence lineage, founder interrupts, stale propagation, and plan revisions. Choose and version the launch-repo run-state location here. | Crash/resume, approval pause/resume, upstream-change invalidation, and missing-result fixtures pass |
| 0.69 | **Dogfood the audit graph.** Express typecheck barrier, parallel checks, serial LaunchBench, failure handling, and ordered reporting through the compiler and scheduler. | Graph-driven audit is behaviorally equivalent to the existing audit on green and failing fixtures |
| 0.70 | **Resource scheduler and state reducer.** Add path-prefix, provider, account, device, git, and canonical-state claims; generate compatible batches and orchestration preflight. | No batch contains an undeclared collision; parallel workers never write canonical state directly |
| 0.71 | **Runtime adapters.** Ship inline, Codex, and Claude adapters with capability negotiation, budgets, and fallback. | Adapter parity fixtures reach identical terminal semantics and evidence requirements |
| 0.72 | **Verifier subgraphs.** Insert deterministic or fresh-context verification by policy, plus quarantine boundaries and risk-based fail behavior. | Producer and verifier contexts are isolated; verdicts bind to exact output fingerprints |
| 0.73 | **Cutover.** Make compiled plans the only dispatch source, update `SKILL.md`, root `README.md`, `graph/README.md`, and `docs/architecture.md`, then delete legacy mirrors and compatibility fields. | A cutover gate fails on any manually maintained dependency, candidate-unit map, or alternate next-action source |

### Why the audit graph moves earlier

The audit migration proves scheduler semantics before the scheduler can mutate a launch. It also
forces the implementation to support barriers, serial resources, deterministic log order,
partial failure, and complete input counts without relying on model judgment.

Its limited speedup is irrelevant. It is a conformance harness.

## Cutover means deletion

The migration is not complete while two sources can disagree.

After parity, remove or replace:

- hand-authored `upstreamWorkflowIds`
- path-shaped `artifactPaths` as workflow identity bindings
- generic helper text that satisfies proof and stopping-condition validators
- manually assembled `candidate_units`
- manually assembled file-to-unit and serialized-unit maps
- the prose stage-to-runtime-pattern table as an execution source
- hand-typed `continuity.next_action` as source truth
- direct worker writes to `state/PROJECT_STATE.yaml`
- the ordered audit plan as a second scheduler definition
- any runtime-specific script treated as canonical topology

Founder-readable narrative remains authored or rendered through `founder-copy.ts`. A computed
frontier can propose the next safe work; it does not expose graph vocabulary to the founder.

Allow one explicit escape hatch for an unmodeled emergency task:

```text
manual override
  + owner
  + dated reason
  + declared resources
  + proof requirement
  + follow-up graph issue
```

An escape hatch is not a second normal workflow.

## Acceptance criteria for full adoption

The graph is fully adopted only when all of these are true:

1. Every dispatched unit has a stable workflow ID, run-node ID, and attempt ID.
2. Every data edge carries a stable artifact identity and accepted version.
3. Every non-data prerequisite evaluates a typed predicate or decision.
4. Every parallel batch is proven compatible across files, directories, providers, accounts,
   devices, git, and canonical state.
5. Every fan-in reports expected, completed, failed, skipped, and missing inputs.
6. Every side-effecting node declares idempotency or manual recovery.
7. Every founder-only action pauses durably and resumes against the same plan revision.
8. Every accepted output is tied to deterministic proof or an explicit verification policy.
9. Every upstream change invalidates affected downstream results before they can be reused.
10. Every run can resume after interruption without repeating unsafe side effects.
11. Every runtime adapter preserves the same node states, gates, and evidence contract.
12. Every worker context is bounded, permissioned, and independent where verification requires it.
13. The orchestrator is the sole integration and canonical-state owner.
14. `state/PROJECT_STATE.yaml`, the cockpit, the run trace, and the computed frontier reconcile.
15. No hand-authored dependency map or task list competes with the compiled plan.
16. LaunchBench contains fixtures for edges, joins, retries, loops, collisions, interrupts,
    staleness, verifier isolation, adapter parity, and silent node failure.
17. The root README and `SKILL.md` describe the behavior that actually ships, not the target one
    release early.

## What not to do

- Do not turn `playbook/` files into execution nodes.
- Do not use file paths as stable dependency identities.
- Do not model every constraint as an artifact edge.
- Do not convert resource collisions into permanent topology.
- Do not let every worker mutate `state/PROJECT_STATE.yaml`.
- Do not equate file existence with accepted completion.
- Do not make a model-generated plan its own proof.
- Do not hard-code one vendor's workflow API into the definition graph.
- Do not add a graph database or long-running service unless measured scale later proves the
  deterministic TypeScript model insufficient.
- Do not fan out work that is small, coupled, exploratory, or forced through one exclusive
  resource.
- Do not migrate all launch workflows before the scheduler passes the deterministic audit
  conformance suite.
- Do not leave compatibility fields after the cutover gate can replace them.

## Decisions this proposal asks the maintainer to make

1. Approve the layered model: definition, instance, run, and trace, with context and permissions
   modeled separately.
2. Approve stable artifact IDs and typed edge semantics instead of `consumes: string[]`.
3. Approve the audit pipeline as the first graph-execution customer.
4. Approve the single-writer state reducer and manager-owned integration model.
5. Approve runtime-neutral Graph IR with vendor adapters.
6. Approve a real cutover that deletes manual dispatch sources.

Autonomy, concurrency, and token spend should be runtime policy with conservative defaults and
founder-controlled ceilings. They should not be embedded as irreversible topology decisions.

## Final verdict

Proceed, but replace the artifact-only DAG plan with the layered compiler, scheduler, state, and
adapter model above.

The right end state is not "the repo contains a graph." It already does.

The right end state is: **the orchestrator cannot dispatch, resume, verify, or reconcile launch
work except through a typed, durable graph plan, while agents remain free to use judgment inside
the bounded nodes where judgment belongs.**
