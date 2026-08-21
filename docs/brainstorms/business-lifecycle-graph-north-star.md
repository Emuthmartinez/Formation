# Business Lifecycle Graph North Star

Created: 2026-08-21.
Status: exploratory design, not current policy.
Scope: a reusable business operating graph, with consumer app businesses as the first curated
business type.

This document extends the [current architecture](../architecture.md). It also extends the shipped
[graph execution design](../history/graph-execution-adoption-2026-08-v0.65.1.md) beyond launch work.

## Executive Decision

Formation must model how an organization operates, not only how one product launches.

The current engine compiles workflow definitions into a durable run plan. That foundation is
correct. The next architecture must add the business facts, events, signals, and outcomes that
cause work to exist.

Formation is an organizational process compiler. It combines reusable operating knowledge with
business-specific rules and current facts. It then produces the right bounded workflow for a goal,
problem, or event.

The north star is a typed business twin with a layered definition model. Five connected graph
planes support this model:

```text
definition graph
      ↓ compiles rules and capabilities
business twin graph ← event and evidence graph
      ↓ evaluates triggers and policies
execution graph
      ↓ selects bounded context
context projection graph
```

Lineage connects every plane. A result must trace back to its inputs. An action must trace forward
to its observed outcome.

This model changes the durable unit of work. A workflow is a reusable template. A work order is
one occurrence of that workflow for one entity, objective, time window, or business event.

Examples include one release, one campaign, one experiment, one incident, or one support theme.
Formation must preserve each occurrence. It must not reopen one timeless workflow record forever.

## Product Thesis

Formation is a curated process playbook that can execute. It must answer two related questions:

1. How should this kind of business operate across its full lifecycle?
2. What is the right workflow for this business problem now?

The answer must combine reusable organizational capabilities with the correct business context.
Formation must not maintain a separate copy of every common workflow for every business type.
It must also not force a generic workflow to ignore material domain differences.

Consumer app businesses are the first complete business type. They are the proving ground for
the kernel, the reusable capabilities, and the composition contract. They are not a permanent
limit on the model.

A consumer app business is a set of connected control loops.

```text
sense → interpret → decide → act → verify → measure → learn → sense
```

Launch is one state transition inside those loops. It is not the terminal state.

The graph must run these loops across seven operating systems:

1. Market and customer sensing.
2. Product learning and prioritization.
3. Product delivery and release.
4. Distribution and acquisition.
5. Activation and revenue.
6. Retention, support, and reliability.
7. Trust, compliance, and finance.

Each system produces observations. The observations update claims and metrics. Policies evaluate
the changes. The policies create work orders. Verified outcomes become new observations.

The phase spine remains useful as a founder projection. It must not be the only execution shape.
Several releases, campaigns, experiments, and support issues can exist at the same time.

## Formation Abstraction Stack

Reuse and specialization are separate concerns. Formation needs five definition layers.

```text
Formation kernel
  + capability modules
    + business model and industry packs
      + operating overlays
        + business instance facts
          = pinned business blueprint
```

The first four layers are authored and versioned. Business instance facts are reducer-owned. The
compiler combines them into a pinned blueprint for one business. Runtime work orders bind to a
blueprint revision and a business graph revision.

### Layer 1: Formation kernel

The kernel defines the domain-neutral execution and graph rules. It owns:

- stable identity and typed relations
- events, evidence, lineage, confidence, and time
- workflows, work orders, attempts, joins, approvals, and verification
- objectives, metrics, constraints, resources, risks, and outcomes
- composition, compilation, replay, migration, and compatibility

The kernel must not contain app-store rules, food-product rules, or one company's facts.

### Universal organizational grammar

The kernel needs a small set of stable business concepts. It should start with:

- organization, product, customer segment, job, problem, and offer
- objective, metric, claim, assumption, decision, constraint, and risk
- capability, workflow, work order, resource, artifact, evidence, and outcome
- channel, provider, obligation, event, and observation

The common process verbs are:

```text
sense → decide → create → validate → distribute → transact
      → deliver → support → measure → improve → govern
```

The common relations include:

- `serves`, `solves`, and `depends_on`
- `requires`, `produces`, and `measured_by`
- `constrained_by`, `distributed_via`, and `fulfilled_by`
- `governed_by` and `triggers`

A pack should add a new entity type only when identity, lifecycle, authority, or proof changes. It
should use a typed facet or relation when the difference is descriptive. This rule prevents a
large ontology from becoming the product.

### Layer 2: Capability modules

A capability module is reusable organizational knowledge with an executable contract. Examples
include customer research, positioning, brand systems, web presence, analytics, content,
acquisition, support, finance, and incident response.

A module defines the stable process skeleton:

- the problem it can solve
- required inputs and business entities
- decisions and workflow templates
- outputs, evidence, and verification
- context selectors and known extension points

A module is reusable only when these meanings stay stable across business types. Shared names are
not enough. Two businesses can both need a website while they require different claims, proof,
content, transactions, and gates.

### Layer 3: Business packs

A business pack is a curated composition for a class of businesses. It can include a business
model, an industry, or both. The first complete pack is `business.consumer-app`.

A pack:

- selects capability modules
- adds domain entities and relations
- adds domain workflows, triggers, gates, and validators
- binds shared capability extension points to domain context
- declares required outputs, evidence, and provider roles
- declares compatibility with other packs and overlays

A pack supplies definitions. It does not contain live business facts. It is additive and uses the
same catalog validators as the base catalog. It cannot remove, replace, or edit an imported
definition.

Business packs can compose on more than one axis. Useful axes include:

- business model, such as direct-to-consumer, subscription, marketplace, or service
- industry or product type, such as consumer app or packaged food
- channel, such as an app store, direct web sales, retail, or wholesale
- lifecycle and operating maturity

These axes must not become one large inheritance tree. The compiler resolves an explicit set of
compatible packs into one blueprint.

### Layer 4: Operating overlays

An overlay binds a business to a context that can change required work without changing the
business type. Examples include jurisdiction, launch market, sales channel, provider stack, risk
class, and accessibility target.

An overlay may add constraints, obligations, provider bindings, and verification requirements.
It must not weaken imported proof, authority, privacy, or safety rules. A conflict must fail
composition unless one declared reducer owns the merge.

Profiles remain breadth selectors. They choose from the definitions that composition supplies.
They do not mutate definitions and they are not substitutes for business packs.

### Layer 5: Business instance

The business instance contains current facts about one organization. It includes products,
audiences, offers, objectives, metrics, decisions, providers, campaigns, releases, obligations,
and outcomes.

Only the reducer can accept changes to these facts. A pack can declare that an entity must exist,
but it cannot invent the entity for a running business.

### The compiled business blueprint

The compiled blueprint is the durable operating model for one business revision. It contains:

- the exact pack and module versions
- the full definition and dependency closure
- domain entity and relation types
- available workflow templates and triggers
- context, artifact, provider, and validator bindings
- profile selections and overlay constraints
- provenance that explains why each definition exists
- one fingerprint for the complete composition

A pack update creates a new blueprint revision. It does not silently change a running business.

## Reuse Rule

Formation must abstract a process when its input, decision, output, and proof meanings remain the
same. It must specialize the process when a domain changes one of those meanings.

The preferred design is a shared skeleton with explicit bindings. It is not a copied workflow and
it is not a long list of conditional branches.

Use these tests:

1. Can both business types use the same stable capability ID?
2. Do both types agree on the capability's purpose and lifecycle?
3. Can typed bindings express the differences in entities, outputs, context, and proof?
4. Can each type add its rules without weakening the shared contract?
5. Can a change to the shared skeleton reach both types through a new blueprint revision?

If all tests pass, keep one capability. If they do not pass, create separate domain capabilities
that can still use smaller shared primitives.

## Worked Composition: Web Presence

A consumer app and a consumer food product both need a strong web presence. The shared capability
can own research, information architecture, brand application, content production, performance,
accessibility, analytics, launch, and improvement loops.

The app binding can add:

- store listing and download destinations
- app screenshots and product demonstrations
- device and platform compatibility
- deep-link and acquisition attribution
- app privacy, support, and release context

The food-product binding can add:

- product, variant, and package information
- ingredient, allergen, nutrition, and usage context
- inventory, shipping, reorder, and retail-location context
- direct-sale, retail, or wholesale channel bindings
- supplier, fulfillment, and product-quality evidence

The shared website workflow must not own either list. Each business pack binds its domain entities,
required sections, evidence, and gates to the shared extension points.

```text
capability.web-presence
  + model.direct-to-consumer
  + business.consumer-app
  + channel.app-store
  + one business instance

capability.web-presence
  + model.direct-to-consumer
  + business.consumer-food-product
  + channel.direct-web-sales
  + one business instance
```

Both blueprints use one capability definition. They compile different valid work graphs.

## Problem-to-Workflow Resolution

Formation must also find the right workflow when a founder presents a problem instead of a phase.
It should convert the request or observed signal into a typed problem frame:

- subject business entities
- objective or desired outcome
- symptom, event, or current state
- constraints, authority, and time window
- available evidence and missing prerequisites

The resolver then queries the definition graph for capabilities whose declared contracts match the
frame. Typed eligibility is a gate. A relevance score can rank eligible candidates, but it cannot
make an incompatible workflow valid.

The result is one of four explicit outcomes:

1. One workflow template with its reason and required context.
2. A composed subgraph of compatible capabilities.
3. A workflow that is blocked by named missing prerequisites.
4. A visible catalog coverage gap.

Formation must not convert an improvised agent answer into catalog truth. A new workflow becomes
reusable only after evidence, review, stable identity, validators, and fixtures make it a curated
definition.

## Research Basis

This design extracts mechanisms from six public repositories. The source commits below fix the
research baseline.

| Source | Mechanism that matters | Formation use |
| --- | --- | --- |
| [TrendingAI](https://github.com/Glitch-Cat-Club/TrendingAI/tree/51233873060a8835f9ac8055a710f65aa21d0b54) | Normalize many sources. Run deterministic transforms around bounded synthesis. Preserve capture time, provenance, replay inputs, stable output, and loud failure. | Ingest store, analytics, support, revenue, campaign, and market signals as typed observations. |
| [graph-memory-starter](https://github.com/Glitch-Cat-Club/graph-memory-starter/tree/3254a8da41699def6abfa399166122fb04e6ddbd) | Use a closed vocabulary, stable identity, typed relations, aliases, provenance, and bounded recursive recall before the model runs. | Build deterministic business recall and impact queries before an agent receives context. |
| [prompt-router-starter](https://github.com/Glitch-Cat-Club/prompt-router-starter/tree/067b089fb36dfd73f22a4179390722cad2231e20) | Route before the model. Give explicit input priority. Score uncertain matches. Persist a contract. Gate completion with allowlisted proof. Test routing against a golden set. | Route founder requests and business events into typed commands, queries, and work-order triggers. |
| [Interpretable Context Methodology](https://github.com/RinDig/Interpretable-Context-Methodology/tree/02ba5d85c7871b75c7c702a2d8da6524723d53d4) | Keep routing separate from content. Load only the required sections. Separate stable factory context from per-run product context. Make outputs inspectable. | Compile small context capsules and human-readable business projections from graph selectors. |
| [icm-architect](https://github.com/RinDig/icm-architect/tree/b20fb45063a564cf607b03526e206f519d174def) | Use typed node cards, generated indexes, cold walk tests, change-impact links, and explicit object and process maps. | Give agents and founders a walkable projection of entities, processes, effects, and sources. |
| [Content Agent Routing Promptbase](https://github.com/RinDig/Content-Agent-Routing-Promptbase/tree/fc41a3d718bcd16a9e0db9e7e6176a8063d7d2c9) | Use one canonical source per fact. Use one-way routing. Route to file sections. Continue distribution and analytics as a loop. | Prevent context drift and connect launch work to active distribution and learning. |

The repositories agree on one principle. Intelligence belongs at modeling and build time. Runtime
work should use small deterministic queries, explicit contracts, and bounded agent judgment.

## Repository Findings

### TrendingAI

The [harvest orchestrator](https://github.com/Glitch-Cat-Club/TrendingAI/blob/51233873060a8835f9ac8055a710f65aa21d0b54/src/harvesters/orchestrator.ts)
normalizes twelve sources into one item shape. It starts independent harvesters in parallel. It
then writes results in a declared source order.

The pipeline separates publish time from capture time. It also separates a paid capability from
spend authorization. Missing sources become structured warnings. A source-death check compares
the current run with the prior non-empty baseline.

The deterministic stages own canonical URLs, stable IDs, deduplication, ranking, and stable JSON.
Model stages receive bounded envelopes. Schema gates and key-coverage gates check their output.
Fixture and replay modes use the same downstream code as live mode.

Formation should transfer the signal envelope, replay modes, staleness gates, and source health
checks. It should not transfer editorial scoring formulas into business truth.

### graph-memory-starter

The [schema](https://github.com/Glitch-Cat-Club/graph-memory-starter/blob/3254a8da41699def6abfa399166122fb04e6ddbd/src/schema.sql)
uses entities, relations, and aliases. The build uses a closed type and predicate vocabulary. It
resolves repeated names to stable IDs.

The [recall query](https://github.com/Glitch-Cat-Club/graph-memory-starter/blob/3254a8da41699def6abfa399166122fb04e6ddbd/src/recall.py)
seeds entities from names and aliases. It then walks both relation directions for three hops. It
returns a fixed number of triples with source documents.

The hook runs recall before the model receives the prompt. A local reproduction built 13 entities
and 13 relations. The three-hop query returned eight facts in 2 ms.

Formation should transfer closed vocabularies, aliases, provenance, bounded traversal, and explicit
no-match output. It needs stronger identity, temporal facts, indexed conditions, and relation
versioning.

### prompt-router-starter

The [rules file](https://github.com/Glitch-Cat-Club/prompt-router-starter/blob/067b089fb36dfd73f22a4179390722cad2231e20/algorithm/rules.json)
contains the routing algorithm. Small signal functions return numeric values. Each response skin
assigns weights to selected signals.

Explicit commands win before scoring. Scores below the threshold fall to a named default. Close
scores preserve the runner-up. The router also persists a numbered requirements ledger.

A stop gate runs only allowlisted proofs. It uses per-proof and total time budgets. A session-start
hook restores the ledger after context loss.

The golden set contains 148 prompts. The reproduced rule report scored 0.9595 top-one accuracy.
The full 507-test suite passed after this machine exposed `python3` as `python` for the tests.

Formation should transfer declarative routing, explicit precedence, uncertainty bands, golden
sets, durable contracts, and proof budgets. Runtime-specific hook envelopes must stay in adapters.

### Interpretable Context Methodology

The [core conventions](https://github.com/RinDig/Interpretable-Context-Methodology/blob/02ba5d85c7871b75c7c702a2d8da6524723d53d4/_core/CONVENTIONS.md)
define five context layers. Entry files route. Stage contracts select exact inputs. References
store stable factory knowledge. Output folders store per-run products.

The method uses one-way references and one canonical source per fact. It routes to named sections,
not only files. A cold walk test checks orientation, action, and status.

Formation should transfer the routing discipline and factory-product split. It must not replace
the engine with folder order. ICM states that complex branching and high concurrency need code.

### icm-architect

The [architect method](https://github.com/RinDig/icm-architect/blob/b20fb45063a564cf607b03526e206f519d174def/SKILL.md)
adds six reusable structural forms. The context-map form models organizations with typed node
cards. The system-map form models objects, processes, and change effects.

The system map requires source citations and verified dates. Each object lists change hits and
explicit non-hits. Generated indexes remain rebuildable. Empty speculative shelves are forbidden.

Formation should transfer cold walk tests, typed cards, generated indexes, and first-order impact
links. The business twin must cite live state instead of copying behavior into card prose.

### Content Agent Routing Promptbase

The [system architecture](https://github.com/RinDig/Content-Agent-Routing-Promptbase/blob/fc41a3d718bcd16a9e0db9e7e6176a8063d7d2c9/SYSTEM-ARCHITECTURE.md)
applies separation of concerns to context. Small routing files select exact sections from larger
content files. Cross-workspace dependencies point one way.

Its lifecycle continues through distribution and analytics. The analytics output feeds the next
content cycle. The repository also shows why precise blueprints reduce model interpretation.

Formation should transfer selective loading, one-way context dependencies, and closed operating
loops. It should compile machine contracts from typed graph data, not maintain blueprint prose as
a second source.

## Extracted Grounding Principles

### 1. Model before recall

The system must normalize facts before it asks a model to reason across them. Write-time modeling
can use a strong model. Read-time traversal must use deterministic code when possible.

This principle reduces repeated search. It also lets smaller agents receive the same relevant
facts as larger agents.

### 2. Keep graphs separate by responsibility

One large graph type creates unclear ownership. Formation must keep these responsibilities
separate:

- The definition graph owns reusable rules and capabilities.
- The business twin owns the current business model.
- The event graph owns immutable observations and domain events.
- The execution graph owns work and attempts.
- The context graph owns projections for one task and one reader.

The planes can share stable identifiers. They must not share source-of-truth ownership.

### 3. Use typed identity, not labels or paths

A display name can change. A file can move. Neither change must create a new business entity.

Formation must assign a stable ID once. It must store names, aliases, provider IDs, URLs, and file
paths as bindings.

Immutable observations and artifact versions can use content hashes. Mutable business entities
must not use the current name as permanent identity.

### 4. Make every relation explainable

Each relation must have a type, source, time, and confidence rule. A free-text sentence can explain
the relation. The sentence cannot create readiness or authority.

Important relations include `supports`, `refutes`, `derived_from`, `depends_on`, `targets`,
`measured_by`, `triggered_by`, `produced`, `affected`, and `supersedes`.

### 5. Separate truth from priority

An engagement score, confidence score, or priority score does not make a claim true.

Formation must store observations first. It can then compute priority from impact, urgency, risk,
confidence, cost, and strategic fit. The computed score must cite its inputs and formula version.

### 6. Route before the model runs

A deterministic router must classify an incoming request or event before an agent sees the task.
The router must use this order:

1. Accept an explicit typed command.
2. Match an exact rule or trigger.
3. Score bounded signals against declared thresholds.
4. Surface a tie or low score as uncertainty.
5. Use a safe default that does not mutate external state.

The model can resolve semantic uncertainty inside a bounded node. It must not silently change the
command class, authority class, or proof requirement.

### 7. Compile context as a projection

An execution edge does not define agent context. A task must declare a separate context selector.

The selector can include:

- exact entity IDs and relation types
- an allowed traversal depth
- an allowed time window
- accepted artifact versions
- evidence and confidence floors
- reference IDs and named sections
- trust and access tiers
- a token or byte budget
- excluded entity types and paths

The compiler must return a context capsule. The capsule must state what it included, what it
excluded, and why.

### 8. Put deterministic code around model synthesis

Code must own normalization, identity, routing, ranking, joins, schema checks, and output ordering.
The model can own bounded interpretation, drafting, and judgment.

The system must validate each model result before it enters the business twin. A partial result
must fail the expected-count gate. A stale result must fail the key-coverage gate.

### 9. Preserve replay

Formation must support three input modes:

- `live`: read current providers and record capture receipts.
- `replay`: use a complete prior input snapshot without external actions.
- `fixture`: use small committed inputs for deterministic tests.

The same deterministic pipeline must process all three modes. A replay must not claim that it made
a current external check.

### 10. Fail loud and remain usable

Missing evidence, missing graph matches, dead sources, stale synthesis, and invalid schemas must be
visible. The engine must not replace these states with guessed success.

A routing or recall helper can fail open to a plain read-only answer. A proof, authority, spend,
release, or publication gate must fail closed.

## The Five Graph Planes

### Plane 1: Definition graph

This plane extends the current catalog. It contains the kernel definitions, capability modules,
business packs, and operating overlays. It remains authored, versioned, and deterministic.

It defines:

- entity and relation type registries
- workflow templates and subgraphs
- trigger and policy definitions
- metric definitions and formulas
- artifact, provider, resource, gate, and role definitions
- context selectors
- verification and confidence policies
- migrations and compatibility rules
- module, pack, overlay, and blueprint manifests
- applicability and capability contracts

This plane contains no business-instance facts. It describes what Formation can model and do. Its
compiler must preserve the provenance of every composed definition.

### Plane 2: Business twin graph

This plane models one running business. It is the current accepted view, not a log. The first full
fixture is a consumer app business.

The first entity model must stay small. The full ontology belongs in a later design pass. The
starter families are:

- identity: organization, business, product, customer segment, channel, provider account
- strategy: audience, job, problem, claim, assumption, decision, objective, constraint, risk
- offer: offer, price, entitlement, transaction surface
- product: product, variant, feature, release, experience surface
- distribution: channel, campaign, content asset, audience cohort
- learning: metric, experiment, feedback theme, support issue
- operation: incident, obligation, policy, financial period
- execution: work order, attempt, artifact version, evidence, approval

The graph must avoid personal user records unless a business requirement needs them. Cohorts and
aggregates are the default. Privacy and retention rules apply to every identity-bearing entity.

### Plane 3: Event and evidence graph

This plane is append-only. It records what happened and what source reported it.

An event or observation must carry:

- a stable event ID
- an event type and schema version
- the subject entity IDs
- `occurredAt`, when the business event happened
- `capturedAt`, when Formation received it
- `recordedAt`, when the reducer accepted it
- the source and source receipt
- the raw payload digest or artifact reference
- the parser or transform version
- trust, sensitivity, and retention classes

These separate times prevent false freshness. A newly captured old event is not a new business
outcome.

The reducer derives the business twin from accepted events. A replay over the same event sequence
must produce the same twin snapshot.

### Plane 4: Execution graph

This plane extends the current compiled plan and run state.

A `WorkflowDefinition` remains a reusable capability. A trigger creates a `WorkOrder` occurrence.
The work order binds the template to:

- one business graph revision
- one or more subject entity IDs
- one objective or policy reason
- exact input versions
- one time window
- one authority envelope
- one context selector revision
- expected outputs and outcomes

The engine expands the work order into task, join, verifier, approval, and reducer nodes. Attempts
remain durable and resumable.

This change supports several simultaneous instances of the same workflow. It also preserves each
operating cycle as business history.

### Plane 5: Context projection graph

This plane is derived and rebuildable. It gives each reader the smallest useful view.

The same source graph can produce:

- a worker context capsule
- a verifier evidence capsule
- a founder status view
- a change-impact view
- a business lifecycle view
- a provider action brief
- a compact prompt-hook recall block

Routing files remain catalogs. They must not absorb business facts or domain guidance. Generated
indexes must come from graph data. A human must not maintain a second dependency map.

## Lineage Contract

Lineage is the connective contract across all five planes.

```text
source receipt
  → observation
    → claim or metric update
      → trigger evaluation
        → work order
          → attempt
            → artifact version
              → verification
                → accepted state change
                  → later outcome observation
```

Formation must answer both directions:

- Why does the system believe this fact?
- What changed because the system acted on this fact?

A missing link does not always mean failure. It must mean `unknown`, `unattributed`, or
`unverified`. The system must not fill the gap with narrative certainty.

## Trigger and Policy Model

`recurrenceDays` is useful but too narrow for active operation. The north star adds six trigger
types:

| Trigger | Example |
| --- | --- |
| calendar | Run a weekly financial review. |
| event | Review a release after App Store approval. |
| threshold | Investigate when crash-free sessions fall below the policy floor. |
| change | Recheck pricing claims when an offer changes. |
| dependency | Start the campaign when the release and store assets pass verification. |
| explicit | Execute a founder command against named entities. |

Each trigger must define a deduplication key. It must also define a cooldown or hysteresis rule
when repeated input can cause task thrashing.

A trigger produces a proposed work order. The authority evaluator then decides whether to run,
park, or request approval.

## Context Recall Model

Formation must spend intelligence when it builds the graph. It must spend fewer tokens when an
agent reads the graph.

The recall pipeline is:

1. Parse the task into typed seed IDs, relation filters, and time bounds.
2. Expand aliases to stable IDs.
3. Walk allowed relations for a bounded number of hops.
4. Rank facts by relevance, recency, evidence quality, and task role.
5. Add exact source references and conflict markers.
6. Stop at the context budget.
7. Return an explicit no-match result when nothing qualifies.

The system must cache the capsule by graph revision and selector revision. A new relevant event
invalidates only the affected capsules.

## Performance Model

The graph must improve latency and quality together.

### Write path

- Normalize external payloads once.
- Resolve identity once.
- Store immutable observations.
- Update only affected indexes and twin projections.
- Evaluate only triggers whose dependencies changed.
- Invalidate only descendant facts, work, and capsules.

### Read path

- Seed from stable IDs and aliases.
- Use indexed bounded traversal.
- Select sections before tokenization.
- Return fixed-size context capsules.
- Keep deterministic ordering for equal inputs.

### Execution path

- Parallelize independent reads and pure transforms.
- Use one reducer for canonical state.
- Serialize external mutations by resource claim.
- Count expected results at every join.
- Preserve partial source failure as structured data.

Formation does not need a hosted graph database for this design. The first implementation can use
typed JSONL events, deterministic snapshots, and a rebuildable SQLite index.

The storage engine is replaceable. The graph contracts are not.

## Quality Model

The system must distinguish five evidence states:

1. `observed`: one source reported the fact.
2. `corroborated`: independent sources agree on the same subject and time window.
3. `derived`: deterministic code computed the fact from accepted inputs.
4. `verified`: a declared gate or independent verifier accepted the fact.
5. `disputed`: accepted evidence conflicts.

Confidence must come from policy. It must consider source independence, freshness, directness, and
parser reliability. A model cannot promote its own output to verified.

Scores must stay below their evidence ceiling. For example, two token-overlap matches cannot earn
high confidence without an entity or citation check.

## Human and Agent Surfaces

The graph stays machine-first. The projections stay human-readable.

A founder view must answer:

- What changed?
- What matters now?
- What can run without me?
- What needs my decision?
- What outcome did the last action produce?
- What evidence supports this answer?

A worker view must answer:

- What is the bounded job?
- Which entities and versions are in scope?
- What context can I read?
- What can I change?
- What proves completion?
- What must I return to the reducer?

A verifier view must exclude the producer transcript. It must include the claimed output, source
evidence, and verification policy.

## North-Star Queries

The design is successful when Formation can answer these queries from typed data:

1. What is the next safe work for this business, and why?
2. Which objective, metric, or risk caused this work order?
3. Which release, campaign, or experiment changed this metric?
4. Which claims depend on a price, policy, provider, or source that changed?
5. Which operating loops are due because of a signal, not only a calendar?
6. Which work orders can run together without a resource collision?
7. Which facts are stale, disputed, or weakly sourced?
8. What exact context must this worker or verifier receive?
9. What did the business learn from the last cycle?
10. Can the engine replay the business state at a prior graph revision?

## What Formation Must Not Copy

The source repositories are useful patterns. They are not direct product specifications.

- Do not use name hashes for mutable business entity identity.
- Do not store queryable conditions only inside descriptions.
- Do not use exact string matching as the only seed strategy.
- Do not treat filesystem order as enough for branching or concurrent execution.
- Do not make Markdown files the sole canonical state for high-concurrency updates.
- Do not tie routing to one runtime hook system.
- Do not let a response style decide authority or workflow semantics.
- Do not use model agreement as source corroboration.
- Do not overwrite old operating-cycle outputs with one `latest` record.
- Do not add a graph service before local measurements require one.

## Relationship to Current Formation

The current architecture already provides strong parts of this north star:

- a typed definition catalog
- deterministic plan compilation
- stable workflow and artifact IDs
- durable run state and attempts
- accepted artifact fingerprints
- descendant staleness
- resource claims
- autonomy and approval gates
- a single reducer
- hash-chained audit entries
- fresh-context verification
- runtime-neutral agent adapters
- replayable fixtures and generated projections

The main gaps are structural:

- `BusinessStateV2` is lane-centered, not entity-centered.
- One compiled run node represents one workflow template.
- Recurrence reopens a node but does not create a first-class operating occurrence.
- The audit log records document patches, not a complete domain-event stream.
- The compiler has workflow dependencies and artifact inputs, but no trigger graph.
- Context binds references to workflows, but it does not compile graph traversals or sections.
- The engine does not model metrics, claims, decisions, experiments, campaigns, releases, or
  outcomes as connected business entities.
- The engine cannot trace an action to a later business outcome through one lineage contract.
- The current pack contract adds catalog content. It does not yet define reusable capability
  modules, domain bindings, or compiled business blueprints.
- Consumer app assumptions are not yet separated into reusable organizational capabilities and
  app-specific definitions.
- The engine cannot explain which module, pack, overlay, or business fact caused a workflow to be
  available.

## Proposed Storage Shape

The first storage design should stay local and rebuildable.

```text
control/
  business-events.jsonl        append-only accepted domain events
  audit.jsonl                  hash-chained reducer audit
state/
  business-twin.json           deterministic current snapshot
  run-state.json               current execution state
  graph-index.sqlite           rebuildable entity and relation index
  projections/                 generated founder and agent views
artifacts/
  observations/                raw or normalized source receipts
  versions/                    immutable artifact versions or manifests
```

The event log and immutable artifacts are sources. The twin, SQLite index, and projections are
derived. The reducer remains the only writer of accepted state.

The final paths require a separate artifact-contract decision. This tree states ownership only.

## Migration Strategy

The migration must grow beside the current engine before it replaces current state.

### Phase 0: Contract and benchmark

- Define the minimum event envelope.
- Define stable entity and relation identity rules.
- Define capability module, business pack, overlay, and blueprint manifests.
- Define additive composition, conflict, compatibility, and provenance rules.
- Add a small known-business fixture.
- Record north-star query answers as golden results.
- Measure current context size, traversal time, and decision quality.

### Phase 1: Event and evidence substrate

- Append normalized business observations through the reducer.
- Separate occurrence, capture, and record times.
- Add live, replay, and fixture modes.
- Build the SQLite index from the event log.
- Prove byte-stable replay.

### Phase 2: Minimal business twin

- Model only business, product, objective, claim, decision, metric, release, campaign, and evidence.
- Derive a current twin snapshot from events.
- Add disputed and superseded fact handling.
- Keep lane status as a projection during migration.

### Phase 3: Context compiler

- Add typed context selectors to workflow definitions.
- Compile bounded capsules from graph revision, entity scope, and reference sections.
- Add no-match, conflict, freshness, and token-budget tests.
- Compare output quality against current workflow reference loading.

### Phase 4: Triggered work orders

- Add typed trigger definitions.
- Create durable work-order occurrences from trigger evaluations.
- Bind each work order to entity scope and graph revision.
- Preserve the current run-node engine inside each occurrence.
- Add deduplication, cooldown, and hysteresis checks.

### Phase 5: Operating loops

- Model release, distribution, revenue, retention, support, trust, and finance loops.
- Connect actions to outcome observations.
- Add signal-based work beside calendar work.
- Prove two complete post-launch cycles with different work-order instances.

### Phase 6: Cutover

- Make the business twin the source for lane and lifecycle projections.
- Delete manual mirrors only after parity.
- Keep adapter contracts stable or bump them by their compatibility rules.
- Update `docs/architecture.md` only after the new path ships.

## Acceptance Criteria

The north star is implemented only when all criteria pass:

1. The same event sequence produces a byte-identical business twin.
2. Every accepted fact has provenance or an explicit unknown source state.
3. One workflow template can create several durable work-order occurrences.
4. Every work order binds to exact entity, graph, context, and authority revisions.
5. Changed evidence invalidates only affected facts, work, and context capsules.
6. A low-confidence or disputed fact cannot silently trigger a high-risk action.
7. The engine preserves occurrence, capture, and record time separately.
8. A replay makes no current-provider claim.
9. A context capsule fits its declared budget and lists exclusions.
10. A verifier receives independent context and exact output fingerprints.
11. Every join reports expected, completed, failed, skipped, and missing results.
12. Source death, stale synthesis, and missing graph matches fail visibly.
13. One business fixture moves from idea through launch and two operating cycles.
14. The fixture includes one release, campaign, experiment, support issue, and metric response.
15. A founder can trace one action from source evidence to measured outcome.
16. One shared capability compiles for a consumer app and a consumer food product without a copy.
17. Each compiled workflow contains only the rules and facts for its business blueprint.
18. An incompatible pack, duplicate stable ID, or ambiguous artifact writer fails composition.
19. Every compiled definition reports the module, pack, overlay, or kernel source that supplied it.
20. A business without a required pack cannot see or dispatch that pack's workflows.
21. A problem query returns an eligible workflow, a composed subgraph, blocked prerequisites, or a
    named coverage gap.
22. A pack update creates a new explicit blueprint revision and does not change an active one.

## Next Design Pass

Do not start with a large ontology or a full second business implementation.

The next pass must prove reuse and execution with two linked slices.

The first slice proves business operation. Use this chain:

```text
objective
  → metric
    → observation
      → trigger
        → work order
          → release or campaign action
            → outcome observation
```

Define the minimum entity, relation, event, and selector contracts for that slice. Then replay one
realistic consumer app lifecycle fixture through it.

The second slice proves composition. Use one `capability.web-presence` definition. Compile it once
for a consumer app fixture and once for a consumer food-product fixture. Keep the shared workflow
ID and process skeleton. Bind different domain entities, required outputs, context sections,
evidence, and gates.

This second fixture is the real second pack that the existing pack design requires before loader
implementation. It should stay narrow. Its purpose is to test the abstraction boundary, not to
claim that Formation can yet operate a complete food-product business.
