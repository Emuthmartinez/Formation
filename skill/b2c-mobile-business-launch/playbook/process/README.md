# Running The Launch

How a launch is sequenced, proved, and audited for completeness.

Driving the work — durable state, how much the agent decides alone, subagents, workflows, and engineering routing — is a separate domain: [`../orchestration/README.md`](../orchestration/README.md).

Load the row whose trigger matches the work in front of you. Do not preload the set — each file is a full lane reference.

| Load when | Reference | Produces / gate |
| --- | --- | --- |
| writing docs, handoff bundles, or acceptance criteria | [`artifact-contracts.md`](artifact-contracts.md) | `check:artifact-templates` |
| working on cascade edges | [`cascade-edges.yaml`](cascade-edges.yaml) | — |
| after **any** change to a launched or near-launch app's features, copy, brand vocabulary, pricing, products, design, or data behavior | [`change-cascade.md`](change-cascade.md) | in-app, listing/keywords/screenshots/App Preview/IAP/localizations, RevenueCat, landing + meta/JSON-LD, SEO/GEO, email, analytics, legal all propagated, recorded in `PROJECT_STATE.yaml` `change_cascade` · `check:change-cascade` |
| extending the Design Room, or planning future analytics, monetization, store-ops, or growth panels over the same state store and theme tokens | [`control-plane.md`](control-plane.md) | `check:control-plane`, `check:business-control-plane-workspace` |
| before readiness claims; after a repeated agent miss; when adding a validator or scenario | [`failure-cards.md`](failure-cards.md) | `npm run launchbench` (definition lint + deterministic fixtures) and `npm run evals:behavioral` (opt-in flagship subset against a live agent) are different gates — never claim one as the other |
| crossing a phase boundary; deciding whether `TECH_SPEC.md` is needed; auditing whether research reached experience, design, and specs | [`flow-traceability.md`](flow-traceability.md) | `LAUNCH_TRACE.md`, `TECH_SPEC.md` · `check:launch-trace`, `check:research`, `check:product-spec` |
| "what else is missing", "launch readiness"; moving from planning to build or submission | [`launch-coverage.md`](launch-coverage.md) | lane statuses reconciled · `check:lane-coverage` |
| any multi-phase launch or continuation; deciding where work starts | [`launch-phases.md`](launch-phases.md) | launch scope and `kickoff_date` in `PROJECT_STATE.yaml` |
| working on provider proof | [`provider-proof.md`](provider-proof.md) | — |
| running research, setting up the funnel, configuring domain/email routing, checking analytics, choosing stack, or verifying deployment | [`tool-recipes.md`](tool-recipes.md) | any fast-moving CLI path records its current documentation basis instead of relying on stored examples |
