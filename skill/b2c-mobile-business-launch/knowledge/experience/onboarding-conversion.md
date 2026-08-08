# Onboarding System Graph

Use this reference whenever a consumer product needs new onboarding, an onboarding audit, a conversion redesign, a first-value change, a paywall or trial change, review-request timing, web-to-app continuity, or a full replacement of an existing onboarding system.

This is a graph execution contract, not a list of fashionable screens. The graph begins with evidence, joins product and architecture decisions before design, and ends only after implementation proof and legacy removal. Load the routed references for analytics, 11-star experience, emotional design, design room, copy, engineering orchestration, revenue, privacy, security, store policy, and lifecycle before their nodes run.

## 1. Default mandate

Treat onboarding as one product and conversion system spanning:

`acquisition promise -> first open -> minimum useful input -> first meaningful value -> value engagement -> activation -> monetization -> identity continuity -> normal product use -> retention -> reactivation`

Optimize for:

- the shortest credible path to meaningful value
- low cognitive load and progressive commitment
- questions that materially change the experience
- visible proof that personalization mattered
- trustworthy monetization and trial disclosure
- one canonical state, identity, entitlement, analytics, and experiment model
- cross-surface continuity
- remotely configurable content and offers where appropriate
- accessibility, localization, privacy, security, and recovery
- deletion of obsolete architecture rather than permanent compatibility

Do not optimize for a small diff.

## 2. Execution modes

The orchestrator classifies the run before dispatch.

| Mode | Use when | Legacy rule |
| --- | --- | --- |
| `greenfield` | No production onboarding exists | Build only the target system |
| `replacement` | An existing product is being rebuilt from first principles | Hard cutover; no permanent old/new coexistence |
| `audit_only` | The user asked for findings without implementation | Produce evidence, target graph, and implementation plan; do not mutate product code |
| `incremental` | The founder explicitly limits scope to a bounded change | Preserve only the named boundary; never infer this mode from effort |

A request to rebuild, standardize, replace, or rethink onboarding defaults to `replacement`, not `incremental`.

In replacement mode, do not keep adapters, shims, v1 routes, dual reads, dual writes, old event aliases, old paywalls, old state models, or stale documents. A one-time transformation may preserve durable user value such as paid entitlements, accounts, user-created content, consent records, and legally required transaction history. That transformation is isolated, rehearsed, audited, and deleted after cutover.

## 3. Graph semantics

The onboarding formation is a nested DAG owned by `workflow.experience.onboarding-conversion`.

The orchestrator is the single writer for:

- `product/ONBOARDING.md`
- `product/onboarding.html`
- `state/PROJECT_STATE.yaml`
- `operations/ORCHESTRATION.md`
- final cross-domain decisions

Specialists may run in parallel only when they are producing read-only evidence packets or mutating disjoint artifacts. Research, review mining, provider scans, visual-reference research, and policy research can fan out. State models, analytics names, screen IDs, pricing, provider configuration, migrations, and final readiness serialize through the orchestrator.

Every node returns:

- node ID and status
- inputs and freshness dates
- evidence or implementation proof
- decisions and rejected alternatives
- artifact paths or read-only packet
- blockers
- next eligible nodes

A node is not complete because prose exists. Its exit gate must pass.

## 4. Canonical graph

```text
ONB-00 -> ONB-01 -> ONB-02
ONB-02 -> [ONB-03, ONB-04, ONB-05, ONB-06, ONB-07, ONB-08]
[ONB-03..08] -> ONB-09
ONB-09 -> [ONB-10, ONB-11, ONB-12, ONB-13, ONB-14]
[ONB-10..14] -> ONB-15 -> ONB-16
ONB-16 -> [ONB-17, ONB-18, ONB-19]
[ONB-17..19] -> ONB-20 -> ONB-21 -> ONB-22
```

| Node | Job | Primary owner | Exit gate |
| --- | --- | --- | --- |
| `ONB-00` | Resume state, classify execution mode, identify surfaces and founder-only actions | Orchestrator | Scope, source roots, and mode recorded |
| `ONB-01` | Trace the current implementation, documents, providers, state, routes, events, and failure paths | Engineering + product | Code-backed current-state map exists |
| `ONB-02` | Build the evidence plan, source hierarchy, sampling plan, and freshness cutoff | Research | Evidence questions and access limits recorded |
| `ONB-03` | Research current consumer onboarding, platform guidance, and practitioner heuristics | Research + product | Claims classified by evidence quality |
| `ONB-04` | Mine direct and adjacent competitor reviews, including a positive-review control | Research + customer success | Coded review matrix and root-cause classification exist |
| `ONB-05` | Build an authorized Onbo Hub flow and pattern atlas | Research + design | Screen-level pattern, effort, value, and paywall data recorded |
| `ONB-06` | Audit all applicable Formation or internal B2C guidance | Product | Pass, partial, fail, outdated, and conflict decisions recorded |
| `ONB-07` | Refresh monetization, identity, analytics, policy, and provider capabilities | Money + engineering + trust | Capability matrix and regional policy matrix exist |
| `ONB-08` | Research interaction and motion with 60fps plus current product references | Design | Motion reference register and target-framework translation exist |
| `ONB-09` | Join evidence into a decision ledger and complaint-to-design traceability map | Orchestrator | Every material finding has a disposition |
| `ONB-10` | Define first value, first-value engagement, activation, and habit hypotheses | Product + data | Terms are distinct and measurable |
| `ONB-11` | Audit effort, questions, permissions, and personalization proof | Product + design | Every required effort has a use and value exchange |
| `ONB-12` | Design canonical state, identity, entitlement, continuity, and cross-surface contracts | Engineering + money | Authoritative owners and transitions are explicit |
| `ONB-13` | Design analytics, attribution, experimentation, review eligibility, and lifecycle measurement | Data + product | Typed event contract and expected sequences exist |
| `ONB-14` | Define review, permissions, lifecycle, trust, privacy, security, and policy behavior | Trust + customer success | No policy or trust blocker is hidden |
| `ONB-15` | Compare architecture models and select the target system | Orchestrator | Weighted decision and rejected alternatives recorded |
| `ONB-16` | Produce the canonical journey graph and acquisition-specific branches | Product | Every branch converges on the same semantic model |
| `ONB-17` | Specify every screen, copy state, control, action, paywall, and error path | Product + words + money | Stable screen/control IDs and exact behavior exist |
| `ONB-18` | Create actual visual designs, motion, prototype, and design QA | Design | Inspectable visual proof and prototype exist |
| `ONB-19` | Produce implementation, reliability, accessibility, localization, privacy, and cutover contracts | Engineering + trust | Build units and deletion manifest are executable |
| `ONB-20` | Run adversarial review, synthetic one-star pre-mortem, and instrumentation QA | Cross-functional reviewers | Preventable risks are fixed or accepted |
| `ONB-21` | Route the accepted graph through Compound Engineering planning | Orchestrator + engineering | Implementation-ready plan maps every requirement to work and deletion |
| `ONB-22` | Execute, review, test, cut over, and prove zero legacy | Engineering + orchestrator | New system is the only runtime and all gates pass |

When Compound Engineering is available, use `ce-plan` at `ONB-21`, `ce-work` for implementation, and the available review and test skills at `ONB-22`. If unavailable, use the Formation fallback while preserving the same node outputs and gates.

## 5. ONB-00 and ONB-01: scope and forensic trace

Read current product, design, analytics, revenue, trust, store, engineering, lifecycle, and agent documents. Trace claims into code and provider configuration.

Inventory at minimum:

- first launch and route guards
- every onboarding renderer and branch
- local and remote state
- anonymous and authenticated identity
- profile and product setup
- first-value request, generation, rendering, and persistence
- account creation and linking
- permissions
- paywalls, products, offerings, trials, purchase, restore, and subscription management
- web funnels and web-to-app handoff
- deep links and redemption
- analytics calls and raw event strings
- experiments and remote configuration
- review-request logic
- lifecycle messaging
- errors, retries, offline behavior, and resume behavior
- tests, dashboards, alerts, runbooks, and documentation
- all legacy modules and configuration that replacement mode will delete

Documentation is evidence, not authority. When code and documents disagree, record the drift.

The current-state output must use:

`owner -> source of truth -> persisted state -> API or event contract -> consumers -> failure behavior`


## 6. Routed execution modules

Load only the module needed by the ready graph nodes. The hub owns sequencing; the modules own the exhaustive acceptance details.

| Ready nodes | Load | Purpose |
| --- | --- | --- |
| `ONB-02` through `ONB-09` | [`onboarding-evidence-research.md`](./onboarding-evidence-research.md) | Current guidance, competitor reviews, authorized Onbo Hub, internal guidance, provider and policy research, 60fps references, and evidence joins |
| `ONB-10` through `ONB-14` | [`onboarding-product-contracts.md`](./onboarding-product-contracts.md) | First value, activation, effort, questions, state, identity, analytics, experiments, reviews, permissions, lifecycle, privacy, and trust |
| `ONB-15` through `ONB-22` | [`onboarding-design-delivery.md`](./onboarding-design-delivery.md) | Architecture selection, journey, complete screen/control design, prototype, Compound Engineering implementation, hard cutover, and zero-legacy proof |

Do not preload all three modules. The orchestrator loads a module when its first node reaches the ready frontier and records the loaded basis in `operations/ORCHESTRATION.md`.

## 7. Completion rule

The onboarding lane cannot be `done` until every `ONB-00` through `ONB-22` node is done, the canonical `product/ONBOARDING.md` contains the joined decisions and proof, actual design and prototype evidence exist, the analytics and provider contracts reconcile, policy-safe review behavior is implemented, and replacement mode leaves no legacy runtime or one-time transformation tooling. Run `check-onboarding-graph.ts` before any readiness claim.
