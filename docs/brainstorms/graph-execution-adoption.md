# Adopting the graph as the execution model

Status: proposal, not policy. Nothing here describes what the repo does today except the
measurements in "What is in the tree", which were taken against v0.65.1.

## Verdict

Go all the way, with one boundary.

The graph should own **dispatch** — which unit of work is runnable, what it reads, what it
writes, who may run it, and what proves it. It should not own **knowledge** — the 1.7MB of
`playbook/` prose stays prose, because a node's inside is not a graph. That line is the whole
design. Turning 110 references into nodes is the version of "full adoption" that costs the most
and buys the least.

"The orchestrator layer executes graphs" is the right target. Today it cannot, and the reasons
are structural rather than unfinished.

## What is in the tree (measured at v0.65.1)

The typed definition graph shipped in v0.65.0 and it is real: 6 areas, 15 domains, 20 phases,
22 lanes, 110 references, 15 context packs, **57 workflows**, 88 artifacts, 78 gates, 11
operators, 21 providers. `check:skill-graph` rejects duplicate and unknown IDs, lane and
workflow cycles, unrouted references, unregistered gates, operator-prompt drift, and stale
projections. That is more than most repos ever build.

It is a catalogue, not an execution model. Four measurements:

**1. Every node's body comes from one template.** All 57 workflows are built by
`graph/workflows/helpers.ts`, and not one overrides `action`, `proof`, `memory`, or
`stoppingCondition`. Each node's action is the same three sentences with its own title
substituted. Each node's proof is `<gate> exits 0`. Each stopping condition is that proof
string-joined.

The consequence is worth stating plainly: `validate.ts`'s checks for missing proof, missing
memory, and an unobservable stopping condition **cannot fail**.
`skill_graph.workflow.stop_unobservable` runs its regex against a string the generator wrote to
match it. Every one of the 57 has a gate, so every one takes the generated branch. Those checks
are green because they are circular, not because 57 workflows were designed.

**2. The edges are declared, never derived.** `upstreamWorkflowIds` is hand-written per
workflow: 19 roots, 10 nodes with more than one upstream, longest declared chain 9 deep.
Nothing tests whether an edge carries data. `WorkflowDefinition` has `artifactPaths` — what a
node writes — and no field at all for what a node reads. The fake-edge test cannot be run
mechanically against the current type, and never has been run by hand.

**3. Context is domain-granular, so nodes do not reduce context.** `buildContextPacks` makes
exactly one pack per domain, and `composeSkillGraph` sets every workflow's `referenceIds` to its
domain pack's entry set. All 13 workflows in `build-release.ts` resolve to the same entry
references. Across all 57 nodes, `contextPackIds.length > 1` is zero. The per-node context
contract — the thing that makes a node dispatchable to a fresh window — does not exist yet.

**4. Nothing computes a frontier.** `laneDependencies` is enforced negatively: `check:lane-coverage`
refuses to let a lane reach `done` over an open upstream, with a dated `dependency_override`
escape. That is the one edge in the tree with teeth, and it is worth keeping. But no code
answers "given this `PROJECT_STATE.yaml`, which workflows are runnable now, and which of those
are independent of each other?" The cockpit's `next_action` is a hand-typed string. The launch
is dispatched by an agent reading a routing table and using judgment — a line, drawn one turn at
a time.

One thing that already is parallel and should be left alone: `run-audit.ts` runs the ~65-step
audit through a concurrency pool behind a single typecheck barrier, with `serial: true` for
launchbench. The easy fan-out there is already claimed. A real DAG would buy failure isolation
and ordering, not speed. Rank it last.

## What to build

Three layers, and the discipline is not to collapse them.

- **Plan — the skill's job.** The graph computes a run plan from `PROJECT_STATE.yaml`, launch
  scope, and archetype: ready frontier, independent batches, critical path, and the founder
  gates that will block it.
- **Execution — the runtime's job.** Claude Code runs the plan as a Dynamic Workflow. Codex runs
  the same plan as serial or parallel subagents. This preserves the recommend-don't-gate runtime
  policy exactly as written. The skill ships no daemon and must not grow one; it is loaded into
  someone else's agent.
- **Anchors — the gates already here.** 78 gates, 71 in the audit plan, 73 with a LaunchBench
  validator. This is the repo's real asset and the reason a graph here can stay honest instead of
  becoming an expensive toy. Most systems adopting this pattern have no anchors at all.

### The one change that does the most work: derive edges from data

Add one field to `WorkflowDefinition`:

```ts
consumes: string[];      // artifact paths this workflow reads
// artifactPaths already exists: what it writes
```

Then make `upstreamWorkflowIds` **generated**: B is downstream of A when
`B.consumes ∩ A.artifactPaths ≠ ∅`. Keep the hand-written list for one release as
`declaredUpstreamWorkflowIds`, and have `check:skill-graph` fail on any declared edge whose
intersection is empty.

That single change:

- runs the fake-edge test mechanically across all 57 nodes, once and then forever
- makes the frontier computable — a node is ready when every artifact it consumes exists and its
  lane's upstream lanes are satisfied
- gives artifacts a second job: they stop being an evidence list and become the edges
- surfaces the shared-write hazard that is already in the data and currently unexamined: **10
  artifacts are written by more than one workflow.** Those are hidden edges, exactly the false
  independence that breaks fan-out, and they are one query away from being visible.

Expect it to cut edges. The store chain — `aso-and-store-ops` → `listing-prep-packet` →
`apple-signing` → `store-console` → `asc-cli` — is a straight five-node line today in a domain
whose real precondition is "the name is locked and the design is rendered."

The prize is bounded and worth naming honestly. 57 nodes at declared depth 9 means the launch is
already at most ten layers deep, not 57 steps long — the sequencing win is mostly already
implied by the data, it is just never computed. What derivation adds is that the layers become
*true* instead of asserted.

### Make the node contract real

`helpers.ts` stays — a default is right across 57 nodes — but it must stop satisfying the
validator on a node's behalf.

- `consumes` is required and hand-authored. No default.
- `stoppingCondition` keeps its generated form only when the node's gate is `audit: required`
  **and** carries a `launchbenchValidator`. Otherwise the node authors its own, so the
  observability check is testing something the generator did not write.
- `proof` needs a second kind. A gate proves the artifact is well-formed; it does not prove the
  node did its job when the job is judgment — research claims, copy, design direction, pricing.
  Those nodes get `verification: { lens, freshContext: true }` and a separate verifier. Right
  now producer and verifier are the same agent on every judgment node in the tree.
- `contextPackIds` allows per-workflow packs, not only `context.<domain>`. The pack is the node's
  IN; `artifactPaths` is its OUT. That is the node contract, and it is what lets a node be
  handed to a fresh window without handing over a transcript.

### The run plan is generated, never authored

`render:run-plan` emits `graph/generated/run-plan.json` for the template state, and the same
computation against a real launch repo's `PROJECT_STATE.yaml`. It carries the frontier, the
independent batches, the critical path, the founder-gated set, and per node: operator, context
pack, consumes, produces, gate, verifier lens, token budget.

Two constraints from rules this repo already holds:

- **`SKILL.md` does not grow.** `ENTRYPOINT_BUDGET_BYTES` is a ratchet, not a target. The run
  plan earns at most a generated block that replaces existing text, and more likely nothing in
  the entrypoint at all — an agent asks for the plan when it needs one.
- **None of this vocabulary reaches a founder.** Frontier, batch, node, run plan, DAG are
  internal. `check:founder-copy` fails the build when one leaks, and any new status or mode needs
  its `founder-copy.ts` label in the same commit.

### Emit the workflow script; do not become a workflow runtime

Generate the Dynamic Workflow script from the run plan instead of describing one in prose.
`dynamic-workflows.md` is 20KB that teaches six patterns and a stage → pattern mapping. That
mapping is a field on a node (`executionPattern`) plus a generator, not a table an agent reads
and reproduces by hand each run.

On Codex the same plan is read as batches for subagents. This is the second-largest win:
`parallel-agent-orchestration.md` asks the orchestrator to hand-build a candidate-unit list, a
file-to-unit map, and a serialized set before every dispatch. The graph knows which nodes write
which artifacts, so that whole preflight is derivable — including the 10 shared-write artifacts
that a hand-built map is most likely to miss.

## Sequence

One version per step, each keeping `npm run audit:ci` green and landing as its own PR. This repo
pays 8–18 review rounds per PR, so deciding something twice is the expensive mistake.

| Version | Step | What it proves |
| --- | --- | --- |
| 0.66 | `consumes`, derived edges, fake-edge gate, shared-write report | the DAG is real; publishes which declared edges carried no data |
| 0.67 | node contract: authored stopping conditions, per-node context packs, `verification` | the validator stops grading its own generator |
| 0.68 | `render:run-plan`, frontier computation, `check:run-plan` | a computed frontier matches the hand-written `next_action`, or the gap is explained |
| 0.69 | collision map and batch derivation; the parallel preflight becomes generated | file-overlap checking is mechanical |
| 0.70 | workflow-script generation from the plan; `dynamic-workflows.md` compresses to policy plus generator | the stage → pattern table stops being prose |
| 0.71 | verifier nodes on judgment outputs, fresh context, majority rule, LaunchBench scenario each | producer ≠ verifier, provably |
| later | audit DAG | failure isolation, not speed |

Steps 0.66–0.68 are worth landing even if the work stops there: they make the graph that already
exists honest. 0.69–0.71 are what make the orchestrator execute it.

## What this does not buy

- **Breadth, not judgment.** A launch has genuinely sequential stretches, and the Ground Rule
  that produces them is correct — no design from an unlocked spec, no ASO from an unlocked name.
  The frontier will often be narrow. The gain is that it will be measured narrow instead of
  assumed narrow.
- **Not a cost saving.** Fan-out plus fresh-context verification is the expensive shape. Cap it:
  verifiers only where a gate cannot decide the question, and carry the token budget on the node
  so it is enforced rather than advised.
- **No self-grading.** Anchors stay what they are — a gate that exits 0, a purchase that cleared
  sandbox, a build that uploaded, a founder who signed. Nothing the run plan produces may become
  evidence for itself.

## What not to do

- **Do not turn `playbook/` into nodes.** 110 references, 1.7MB. Prose is a node's payload.
  `docs/architecture.md` already settled that stage is a document and domain is a folder;
  nodes-as-files reopens a closed decision for nothing.
- **Do not build a graph runtime, scheduler, or database.** `graph/README.md` says this in one
  line and it is right. Anything needing a process the skill owns is out of scope.
- **Do not reshape `business/`.** It is a launch repo's root and its layout is the artifact
  contract — attempted and reverted in v0.64.0.
- **Do not let the plan become a gate on the runtime split.** It has to degrade to subagents with
  no loss of shape, or it breaks the policy that the skill recommends and never blocks.

## Two founder calls

1. **Does a computed frontier ever dispatch without asking?** Autonomy modes exist, and a
   frontier makes "run the next three independent nodes" a single move. That is a spend and
   blast-radius decision, not an agent's.
2. **Per-node token budgets.** A verifier on every judgment node is the line item that decides
   whether a launch run costs the same as today or several times more. The number belongs to
   whoever pays it.
