import { workflow } from "./helpers.js";

/**
 * Ported from runtime/graph/workflows/operating-system.ts. All seven are domain.process /
 * domain.orchestration — system-domain, never founder-grantable (KTD3) — so
 * catalog/bridge.ts's toCatalogInput() excludes them from the dispatchable CatalogInput:
 * they represent session-level machinery (continuity, provider-proof verification, change
 * cascade, control-plane extension, LaunchBench audit) that runs as part of the runtime's
 * own operation, not autonomy-gated business work competing for dispatch. They still carry
 * actionClass/idempotent here so the full catalog (all 57 workflows) stays structurally
 * uniform for validate.ts and render-routing.ts.
 *
 * Four single-writer fixes versus v1 (same "Ambiguous shared write(s)" rule compile.ts
 * enforces that build-release.ts's header explains at length): v1 let
 * session-continuity-resume, orient-scaffold-and-state-cockpit-upkeep, and change-cascade
 * all declare state/PROJECT_STATE.yaml as an output, and the first two also both declared
 * state/launch-cockpit.html. orient-scaffold-and-state-cockpit-upkeep is the actual
 * scaffolding/creation workflow (phase.0-orient) and keeps both. session-continuity-resume
 * is actionClass "observe" — an observe-class node declaring mutating outputs was already
 * an internal inconsistency in v1's model, not just a compile.ts collision — so it declares
 * no outputs at all. change-cascade propagates an existing change_cascade record rather
 * than authoring PROJECT_STATE.yaml or LAUNCH_TRACE.md fresh, so it declares no outputs
 * either (it still runs, still gates, still records evidence — it just isn't the artifact's
 * producer of record).
 */
export const workflows = [
  workflow({
    id: "workflow.orchestration.session-continuity-resume",
    title: "Session continuity / resume",
    domainId: "domain.orchestration",
    areaIds: ["area.operating-system"],
    trigger: "New session, resume, status check, or handoff on an existing launch",
    instructions:
      "Before doing anything else, reconstruct current state from durable repo artifacts, not from prior chat turns: read `AGENTS.md`, `state/PROJECT_STATE.yaml`, `state/launch-cockpit.html`, `operations/ORCHESTRATION.md`, `engineering/PRODUCTION_READINESS.md`, `operations/FAILURE_CARDS.md`, and `git status --short`. Populate the top-level `continuity` block (source files reviewed, git status reviewed, next action, drift risks) so the next session inherits a concrete next step instead of a vague status summary. `check:continuity-contract` only passes when that reconstruction actually happened against the files on disk, so a plausible-sounding chat-memory answer still fails it.",
    reads: [
      "AGENTS.md",
      "state/PROJECT_STATE.yaml",
      "state/launch-cockpit.html",
      "operations/ORCHESTRATION.md",
      "engineering/PRODUCTION_READINESS.md",
      "operations/FAILURE_CARDS.md",
    ],
    referenceIds: ["reference.orchestration.parallel-agent-orchestration", "reference.orchestration.project-state"],
    roleId: "role.orchestrator",
    laneIds: ["orchestration"],
    // outputPaths intentionally empty: reads and verifies durable state, does not author
    // it (see file header) — consistent with actionClass "observe".
    gates: ["check:continuity-contract"],
    actionClass: "observe",
    idempotent: true,
  }),
  workflow({
    id: "workflow.orchestration.orient-scaffold-and-state-cockpit-upkeep",
    title: "Orient, scaffold & state/cockpit upkeep",
    domainId: "domain.orchestration",
    areaIds: ["area.operating-system"],
    trigger: '"Launch this app" / broad launch request; any lane/provider/proof/blocker status change',
    instructions:
      "On a broad launch request or any lane/provider/proof/blocker status change, create or update `state/PROJECT_STATE.yaml` as the compact source of truth for phase, autonomy mode, lane statuses, provider routes, and active failure cards — a lane is never `done` from prose alone, it needs an evidence path or live proof — then render `state/launch-cockpit.html` so the founder can see it in one file. Record `project.kickoff_date` on first orient and size the work with `project.launch_scope` (essentials by default); `validate:launch-state` enforces the pre-build clock and the lane-dependency edges (a lane can't be `done` while an upstream lane it depends on is still `partial` or `blocked`). Decide the orchestration strategy for the work ahead — inline, serial/parallel subagents, worktrees, hybrid, or a Dynamic Workflow for a long adversarial pre-build stage — and record it rather than defaulting silently to inline. Whenever the cockpit is (re)rendered, say the narrative in the reply itself — what changed, what's happening now, what needs the founder — because nobody may be watching the HTML file.",
    reads: ["state/PROJECT_STATE.yaml", "operations/ORCHESTRATION.md", "operations/FAILURE_CARDS.md", "engineering/PRODUCTION_READINESS.md"],
    referenceIds: [
      "reference.orchestration.project-state",
      "reference.process.launch-phases",
      "reference.process.artifact-contracts",
      "reference.orchestration.dynamic-workflows",
      "reference.process.tool-recipes",
    ],
    roleId: "role.orchestrator",
    laneIds: ["orchestration"],
    phaseIds: ["phase.0-orient"],
    // operations/BUSINESS_ACCESS.md dropped: workflow.operations.founder-zero-operator-bootstrap
    // is its dedicated producer (see file header).
    outputPaths: ["state/PROJECT_STATE.yaml", "state/launch-cockpit.html"],
    gates: ["validate:launch-state", "render:launch-cockpit"],
    actionClass: "mutate",
    idempotent: true,
  }),
  workflow({
    id: "workflow.process.provider-proof-verification",
    title: "Provider-proof verification",
    domainId: "domain.process",
    areaIds: ["area.operating-system"],
    trigger: "Before marking any provider-backed lane (analytics/revenue/email/store/security/eng) done",
    instructions:
      "Before marking any provider-backed lane (analytics/revenue/email/store/security/eng) done, populate or update `operations/PROVIDER_PROOF.md` with one row per provider: name, current status, proof command or inspection route, evidence path, and any founder-only gate. Planned setup and green unit tests are not proof — the row's status must read as captured live evidence, and `check:provider-proof` fails unless at least one file named anywhere in the row actually exists on disk. If access is founder-only, record the gate explicitly and keep the lane `partial` or `blocked` rather than claiming done.",
    reads: ["operations/PROVIDER_PROOF.md", "state/PROJECT_STATE.yaml"],
    referenceIds: ["reference.process.provider-proof", "reference.process.launch-coverage"],
    roleId: "role.orchestrator",
    outputPaths: ["operations/PROVIDER_PROOF.md"],
    gates: ["check:provider-proof"],
    providers: ["provider.posthog", "provider.revenuecat", "provider.resend", "provider.app-store-connect"],
    actionClass: "observe",
    idempotent: true,
  }),
  workflow({
    id: "workflow.process.change-cascade",
    title: "Change cascade",
    domainId: "domain.process",
    areaIds: ["area.operating-system"],
    trigger: "Any change to a launched/near-launch app's feature, copy, brand, pricing, products, or data behavior",
    instructions:
      "Classify the change against the Change Cascade Map (feature, lexicon/brand-vocabulary, onboarding-flow, paywall/pricing, visual/design-token, new IAP, privacy/data, domain/brand, or a design-token/copy/pricing change that invalidates already-generated assets — the last routes through the Generated-Asset Regeneration guardrails), then enumerate every surface that change type touches — in-app, App Store listing/products, RevenueCat/billing, landing/web + JSON-LD, SEO/GEO, lifecycle email, analytics, legal, content/UGC/ads — and update each or record why it's unaffected. Record the result as a `change_cascade` entry in `state/PROJECT_STATE.yaml`, one line per surface (`updated`+evidence, `unaffected`+reason, or `blocked`+blocker); a surface left out by omission fails `check:change-cascade` as `change_cascade.<id>.<surface>.unaccounted`, graded against the machine-readable twin in `cascade-edges.yaml` — edit both files together. Re-render any screenshot, App Preview, or ad creative whose underlying copy/UI changed, and reconcile the locked lexicon in `design/DESIGN.md` across every surface before calling the change done.",
    reads: ["state/PROJECT_STATE.yaml", "state/LAUNCH_TRACE.md", "design/DESIGN.md"],
    referenceIds: ["reference.process.change-cascade", "reference.process.cascade-edges", "reference.process.flow-traceability"],
    roleId: "role.orchestrator",
    // outputPaths intentionally empty: propagates an existing change_cascade record rather
    // than authoring PROJECT_STATE.yaml or LAUNCH_TRACE.md fresh (see file header).
    gates: ["check:change-cascade"],
    actionClass: "mutate",
    idempotent: true,
  }),
  workflow({
    id: "workflow.process.launch-trace-and-build-contracts",
    title: "Launch trace & build contracts",
    domainId: "domain.process",
    areaIds: ["area.operating-system"],
    trigger: "Crossing research → product/design/build; deciding if engineering/TECH_SPEC.md is needed",
    instructions:
      "When work crosses from research into product/design/build, create or update `state/LAUNCH_TRACE.md` as the decision-trace table (evidence ID, source, tool route, research finding, experience/product/brand decision, build contract, analytics/security/revenue/privacy/store impact, verification, status) so every screen, claim, or paywall behavior traces back to the evidence that produced it. Decide whether `engineering/TECH_SPEC.md` is needed — create it when the app has backend APIs, database/storage, auth, subscriptions, email, analytics, AI, push, account deletion, or non-trivial platform behavior, and cover the data model, API/RPC/webhook contracts, state machines, permissions, and integration contracts so a builder never has to invent schema or endpoint behavior. Do not let a claim, screen, onboarding question, or paywall behavior move forward without a trace row or an explicit, documented founder-only decision.",
    reads: ["strategy/RESEARCH.md", "product/experience/11-star-experience/11_STAR_EXPERIENCE.md", "state/PROJECT_STATE.yaml"],
    referenceIds: ["reference.process.flow-traceability", "reference.process.artifact-contracts", "reference.process.launch-coverage"],
    roleId: "role.product-leader",
    laneIds: ["traceability"],
    phaseIds: ["phase.1f"],
    dependencies: ["workflow.research.research-backed-spec", "workflow.experience.11-star-experience"],
    outputPaths: ["state/LAUNCH_TRACE.md", "engineering/TECH_SPEC.md"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.process.business-control-plane-extension",
    title: "Business Control Plane extension",
    domainId: "domain.process",
    areaIds: ["area.operating-system"],
    trigger: "Extending the Design Room into new analytics/monetization/store/growth panels over the same state",
    instructions:
      "When adding a new Business Control Plane panel (Analytics, Monetization, Store Ops, or Growth) over the same state store as the Design Room, model it as a state-backed shell first: add it under `studio/seed/business.json`'s `controlPlane.panels` with `stateRefs` and `renderedArtifacts`, wire it into `design/design-room.html`, and render — never hand-author — the view from `state/PROJECT_STATE.yaml` and `studio/seed/theme.tokens.json`. Add a validator before shipping the panel so the Control Plane doesn't become another long prose checklist, then re-render `state/workspace.generated.json` through the Business Control workspace adapter and run `check:control-plane` plus `check:business-control-plane-workspace` before calling it maintained. Keep stable graph IDs for operators, panels, views, lanes, artifacts, and gates — UI labels are projections that may change without changing identity.",
    reads: ["studio/seed/business.json", "studio/seed/theme.tokens.json", "state/PROJECT_STATE.yaml", "design/design-room.html"],
    referenceIds: ["reference.process.control-plane", "reference.orchestration.project-state"],
    roleId: "role.orchestrator",
    outputPaths: ["state/workspace.generated.json"],
    gates: ["check:control-plane", "check:business-control-plane-workspace"],
    actionClass: "mutate",
    idempotent: true,
  }),
  workflow({
    id: "workflow.process.launchbench-failure-cards-coverage-audit",
    title: "LaunchBench / failure-cards / coverage audit",
    domainId: "domain.process",
    areaIds: ["area.operating-system"],
    trigger: "Before any launch-readiness claim, after a repeated miss, or adding a validator/scenario",
    instructions:
      "Before any launch-readiness claim, after a repeated agent miss, or when adding a validator or scenario, run `npm run launchbench` (the deterministic validator/scenario suite) and turn any known regression into a durable card in `operations/FAILURE_CARDS.md` (card ID, severity, owner, status, detected date, evidence, impact, next action, validator) instead of leaving it as a chat note. Record scenarios run, validators run, expected failures caught, and unexpected misses in `LAUNCHBENCH.md`, and close a card only with evidence or command proof attached — never on 'noted' language alone. `check:lane-coverage` cross-checks open lanes against the Coverage Matrix so a launch-ready claim can't be made while a lane is `done` on top of an upstream lane that is still `partial` or `blocked`.",
    reads: ["operations/FAILURE_CARDS.md", "state/PROJECT_STATE.yaml", "engineering/PRODUCTION_READINESS.md"],
    referenceIds: ["reference.process.failure-cards", "reference.process.launch-coverage", "reference.process.artifact-contracts"],
    roleId: "role.orchestrator",
    dependencies: ["workflow.orchestration.orient-scaffold-and-state-cockpit-upkeep"],
    outputPaths: ["operations/FAILURE_CARDS.md", "LAUNCHBENCH.md"],
    gates: ["launchbench", "check:lane-coverage"],
    actionClass: "observe",
    idempotent: true,
  }),
] as const;
