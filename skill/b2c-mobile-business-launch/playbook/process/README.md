# Running The Launch

How a launch is sequenced, tracked, proved, and handed to the next session.

Load the row whose trigger matches the work in front of you. Do not preload the set — each file is a full lane reference.

| Load when | Reference | Produces / gate |
| --- | --- | --- |
| writing docs, handoff bundles, or acceptance criteria | [`artifact-contracts.md`](artifact-contracts.md) | `check:artifact-templates` |
| start of multi-lane work; resuming a prior session; before provider/store mutations, handoff, or subagent dispatch; when rendering the cockpit | [`autonomy-modes.md`](autonomy-modes.md) | `PROJECT_STATE.yaml`, `launch-cockpit.html`, `ORCHESTRATION.md` · `check:orchestration` |
| working on cascade edges | [`cascade-edges.yaml`](cascade-edges.yaml) | — |
| after **any** change to a launched or near-launch app's features, copy, brand vocabulary, pricing, products, design, or data behavior | [`change-cascade.md`](change-cascade.md) | in-app, listing/keywords/screenshots/App Preview/IAP/localizations, RevenueCat, landing + meta/JSON-LD, SEO/GEO, email, analytics, legal all propagated, recorded in `PROJECT_STATE.yaml` `change_cascade` · `check:change-cascade` |
| before app implementation, backend/frontend work, generated builder prompts, parallel agents, worktrees, `ENGINEERING_PLAN.md`, `PRODUCTION_READINESS.md`, or production-readiness claims | [`compound-engineering-routing.md`](compound-engineering-routing.md) | Route non-trivial work through CE freshness, `ce-brainstorm` when product shape is unresolved, `ce-plan`, `ce-work`/`ce-worktree`, `ce-code-review`, applicable CE test skills, and CE proof/demo routes. When CE is unavailable, record the fallback in state and run the Standalone Engineering Loop (`engineering-orchestration.md` §1b) at the same evidence bar — engineering stays partial until all five stages have evidence · `check:compound-engineering` |
| extending the Design Room, or planning future analytics, monetization, store-ops, or growth panels over the same state store and theme tokens | [`control-plane.md`](control-plane.md) | `check:control-plane`, `check:business-control-plane-workspace` |
| working on dynamic workflows | [`dynamic-workflows.md`](dynamic-workflows.md) | — |
| before readiness claims; after a repeated agent miss; when adding a validator or scenario | [`failure-cards.md`](failure-cards.md) | `npm run launchbench` (definition lint + deterministic fixtures) and `npm run evals:behavioral` (opt-in flagship subset against a live agent) are different gates — never claim one as the other |
| crossing a phase boundary; deciding whether `TECH_SPEC.md` is needed; auditing whether research reached experience, design, and specs | [`flow-traceability.md`](flow-traceability.md) | `LAUNCH_TRACE.md`, `TECH_SPEC.md` · `check:launch-trace`, `check:research`, `check:product-spec` |
| "what else is missing", "launch readiness"; moving from planning to build or submission | [`launch-coverage.md`](launch-coverage.md) | lane statuses reconciled · `check:lane-coverage` |
| any multi-phase launch or continuation; deciding where work starts | [`launch-phases.md`](launch-phases.md) | launch scope and `kickoff_date` in `PROJECT_STATE.yaml` |
| start of multi-lane work; resuming a prior session; before provider/store mutations, handoff, or subagent dispatch; when rendering the cockpit | [`parallel-agent-orchestration.md`](parallel-agent-orchestration.md) | `PROJECT_STATE.yaml`, `launch-cockpit.html`, `ORCHESTRATION.md` · `check:orchestration` |
| start of multi-lane work; resuming a prior session; before provider/store mutations, handoff, or subagent dispatch; when rendering the cockpit | [`project-state.md`](project-state.md) | `PROJECT_STATE.yaml`, `launch-cockpit.html`, `ORCHESTRATION.md` · `check:orchestration` |
| working on provider proof | [`provider-proof.md`](provider-proof.md) | — |
| running research, setting up the funnel, configuring domain/email routing, checking analytics, choosing stack, or verifying deployment | [`tool-recipes.md`](tool-recipes.md) | any fast-moving CLI path records its current documentation basis instead of relying on stored examples |
