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
    dependencies: ["workflow.orchestration.orient-scaffold-and-state-cockpit-upkeep"],
    outputPaths: ["operations/FAILURE_CARDS.md", "LAUNCHBENCH.md"],
    gates: ["launchbench", "check:lane-coverage"],
    actionClass: "observe",
    idempotent: true,
  }),
] as const;
