# Onboarding System Graph

Use this reference for consumer onboarding, first-value, activation, paywall, trial, review timing, cross-surface continuity, or replacement work. Onboarding is one system:

`acquisition -> first open -> minimum useful input -> first value -> engagement -> activation -> monetization -> identity -> normal product use -> retention -> reactivation`

Do not optimize for a small diff. Optimize for early real value, low cognitive load, progressive profiling, visible personalization, trustworthy monetization, one state and analytics model, remote experimentability, accessibility, privacy, recovery, and deletion of obsolete architecture.

## Execution modes

| Mode | Use when | Legacy rule |
| --- | --- | --- |
| `greenfield` | No production onboarding exists | Build only the target system |
| `replacement` | Existing onboarding is rebuilt from first principles | Hard cutover; no permanent coexistence |
| `audit_only` | Findings are requested without implementation | Produce evidence, target graph, and plan |
| `incremental` | The founder explicitly limits scope | Preserve only the named boundary |

Rebuild, replace, standardize, and rethink requests default to `replacement`. Preserve durable user value through an isolated, rehearsed, one-time transformation, then delete the transformation and every obsolete route, state, event, provider object, test, and document.

## Ownership and dispatch

`workflow.experience.onboarding-conversion` owns the nested graph. The orchestrator is the single writer for `product/ONBOARDING.md`, `product/onboarding.html`, state, canonical IDs, pricing, provider mutations, cutover, and final readiness.

Specialists may parallelize read-only research or disjoint implementation packets. Evidence branches may fan out. State, IDs, provider mutations, migrations, release actions, and final decisions serialize through the orchestrator.

Every node returns status, inputs and freshness, evidence or implementation checks, decisions and rejected alternatives, artifact paths, blockers, and newly eligible nodes. A prose artifact is not completion; the node exit gate must pass.

## Canonical graph

```text
ONB-00 -> ONB-01 -> ONB-02
ONB-02 -> [ONB-03, ONB-04, ONB-05, ONB-06, ONB-07, ONB-08]
[ONB-03..08] -> ONB-09
ONB-09 -> [ONB-10, ONB-11, ONB-12, ONB-13, ONB-14]
[ONB-10..14] -> ONB-15 -> ONB-16
ONB-16 -> [ONB-17, ONB-18, ONB-19]
[ONB-17..19] -> ONB-20 -> ONB-21 -> ONB-22
```

| Node | Contract |
| --- | --- |
| `ONB-00` | Resume state, classify mode, identify surfaces and founder-only actions |
| `ONB-01` | Trace real code, documents, providers, state, routes, events, tests, failures, and legacy items |
| `ONB-02` | Set source hierarchy, sampling, access limits, and freshness cutoff |
| `ONB-03` | Research current platform guidance, evidence, benchmarks, and practitioner heuristics |
| `ONB-04` | Mine negative competitor reviews plus a positive-review control and code root causes |
| `ONB-05` | Build an authorized Onbo Hub flow atlas without scraping or inferring locked screens |
| `ONB-06` | Audit applicable Formation and internal B2C guidance; resolve outdated rules |
| `ONB-07` | Refresh provider, RevenueCat, billing, identity, analytics, policy, and regional capability facts |
| `ONB-08` | Research interaction and motion using 60fps references and target-framework translation |
| `ONB-09` | Join evidence into adopted, test, rejected, and investigate decisions |
| `ONB-10` | Define first value rendered, first value engaged, activation, habit, and retention hypotheses |
| `ONB-11` | Audit effort, questions, permissions, interruption budget, and personalization proof |
| `ONB-12` | Define canonical identity, journey, profile, activation, entitlement, experiment, review, permission, and lifecycle state |
| `ONB-13` | Define typed analytics, authoritative emitters, stitching, deduplication, exposure, and expected sequences |
| `ONB-14` | Define review timing, permissions, lifecycle, privacy, security, and policy behavior |
| `ONB-15` | Compare native-first, funnel-first, hybrid, web-first, and evidence-backed alternatives; choose one |
| `ONB-16` | Produce acquisition-specific journeys that converge on one semantic model |
| `ONB-17` | Specify every screen, copy key, control, action, paywall state, error, and recovery path |
| `ONB-18` | Produce actual high-fidelity design, motion, interactive prototype, and design QA |
| `ONB-19` | Define implementation, reliability, accessibility, localization, privacy, performance, and cutover units |
| `ONB-20` | Run adversarial review, synthetic one-star pre-mortem, policy review, and instrumentation QA |
| `ONB-21` | Run Compound Engineering planning when available, preserving graph IDs and deletion work |
| `ONB-22` | Implement, review, test, cut over, delete legacy, and verify the target is the only runtime |

## Evidence contract

Use current official policy and provider documentation first, followed by implementation truth, reliable product data, direct research, current first-party reviews, disclosed-method quantitative work, direct flow observation, original practitioner sources, and secondary commentary.

Classify each recommendation as platform requirement, evidence-backed guidance, benchmark, direct user finding, competitor pattern, practitioner heuristic, product hypothesis, or experiment question. Record source, date, market, version, method, confidence, and implication.

Competitor review analysis separates onboarding, expectation, monetization, identity, lifecycle, core product, support, platform limitation, and insufficient evidence. Never present sample frequency as population prevalence. Never onboarding-wash a product defect.

Onbo Hub is authorized access only. Revenue estimates remain estimates. Record screens reviewed, effort, first-value class, account, permissions, paywall, trial, restore, close, accessibility, trust, and related positive and negative review evidence.

For subscription products, refresh the full relevant RevenueCat surface: SDK, products, packages, offerings, placements, entitlements, identity, paywalls, targeting, experiments, Funnels, Web, Purchases.js, purchase links and buttons, Billing, Stripe, Paddle, Redemption Links, Customer Center, webhooks, analytics, lifecycle, refunds, grace, pending purchases, restore, and newer official capabilities. Separate technically possible, policy permitted, and recommended by platform and region.

Use the 60fps MCP with `search_shots`, `get_shot`, `get_motion_breakdown`, and `get_related_shots`; use motion code only when useful. Translate interaction principles, never another product's brand, assets, copy, exact layout, or implementation.

Audit the seven-principle heuristic: define activation, show value before disproportionate effort, ask only useful questions, keep one dominant action, use purposeful motion, show visible personalization, and finish with meaningful value in a populated normal product state. Record pass, partial, or fail with evidence, not a fake score.

## Product and architecture contract

First value rendered, first value engaged, activation, retention, monetization, review eligibility, and onboarding completion are distinct. A render is not activation. First value must be real, understandable, actionable, persistent, recoverable, and connected to the acquisition promise.

Every required question identifies the behavior it changes and the screen where the user sees personalization proof. Every required effort has an explicit value exchange. A name inserted into generic copy is not personalization.

Separate identity, journey, profile completeness, activation, entitlement, experiment assignment and exposure, review eligibility, permission and consent, and lifecycle state. Define authoritative owner, persistence, transition trigger, event, idempotency, retry, failure, compensation, and consumers. Support anonymous-to-authenticated linking, purchase before account, web-to-app redemption, reinstall, cross-device, restore, entitlement delay, interrupted journeys, churn, win-back, and identity collision without repeating successful work.

Analytics uses one machine-readable schema and typed clients. Distinguish client interaction, backend-confirmed product outcome, provider-confirmed monetization, and derived metrics. One business outcome has one authoritative emitter. Define event IDs, identity stitching, offline queueing, ordering, deduplication, replay, webhook idempotency, experiment exposure, privacy, and expected event-sequence tests. Analytics failure never blocks first value.

Earn review eligibility after real value and engagement. Request through native platform APIs outside first-run onboarding at a later natural success. No custom star screen, sentiment gate, incentive, or happy-user routing. Record only observable eligibility, suppression, request attempt, and API return facts.

Request protected permissions only after a user action with visible benefit. Define denial, limited access, retry, settings, privacy, and fallback. One lifecycle strategy owns onboarding recovery, progressive profiling, trial, post-purchase activation, habit, billing recovery, dormancy, churn, and win-back suppression.

Compare architecture models using conversion, retention, first-value fidelity, file or image needs, resume, identity, experimentation, analytics, policy, economics, accessibility, localization, latency, offline behavior, operations, and lock-in. Different acquisition surfaces may render differently but converge on one semantic state graph.

## Design and delivery contract

Every screen and control has a stable semantic ID. Specify exact copy keys, hierarchy, states, local and canonical mutations, API or provider action, idempotency, analytics, navigation, repeated taps, errors, retries, offline and interruption behavior, accessibility, localization, haptics, motion, and reduced-motion behavior.

Produce actual high-fidelity design and an interactive prototype. Contract HTML is not visual design. Cover trial eligibility, packages, restore, existing subscriber, unavailable product, offline, pending, canceled, failed, success, delayed entitlement, web handoff, and regional variants. Motion clarifies state and never disguises latency.

Define behavior and observability for termination, network loss, slow or malformed generation, upload failure, analytics or config outage, provider outage, pending purchase, delayed webhook, restore or redemption failure, deep-link failure, identity collision, unsupported client, and review API unavailability.

The implementation plan maps every screen, control, state, event, provider configuration, test, and legacy item to exact repository paths, dependencies, acceptance criteria, deletion, roll-forward behavior, parallel safety, and owner.

Replacement mode uses hard cutover: freeze legacy changes, build and verify the target, rehearse the one-time transformation, enforce a minimum client when required, cut traffic, verify production, delete every old runtime and configuration surface, delete transformation tooling, run a repository-wide zero-legacy search, and roll forward on defects. Do not keep the old runtime as a standing fallback.

## Completion

The lane cannot be done until `ONB-00` through `ONB-22` are done, `product/ONBOARDING.md` carries the joined decisions and implementation checks, actual design and prototype artifacts exist, analytics and provider contracts reconcile, review behavior is policy safe, and replacement mode leaves zero legacy runtime or transformation tooling.

Run `validation/business/experience/check-onboarding-graph.ts` before any readiness claim.
