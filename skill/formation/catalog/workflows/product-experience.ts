import { workflow } from "./helpers.js";

/**
 * Product and experience workflows.
 *
 * Two single-writer fixes versus v1 (see build-release.ts's header for the full rule):
 * `product/SPEC.md` was declared by both `app-archetype-detection-and-starter` and
 * `research-backed-spec` — an "either path produces the spec" OR-relationship v1's model
 * tolerated but compile.ts's single-writer rule does not. `research-backed-spec` is the
 * general-purpose route and keeps the artifact; `app-archetype-detection-and-starter`'s
 * real distinctive contribution is the matched starter scaffold (`check:archetype-starter`
 * proves that separately, against `starters/`), not a competing SPEC.md, so it declares no
 * output. `product/experience/ux-patterns/UX_PATTERNS.md` was declared by both
 * `ux-patterns-refero` (its dedicated producer, via provider.refero) and
 * `premium-mobile-craft`. The Design Room workflow owns `design/design.md`.
 *
 * The onboarding capability expands into typed ONB-00 through ONB-22 catalog nodes so the
 * durable engine can schedule, checkpoint, retry, resume, and verify the nested graph. Only
 * ONB-22 writes the canonical onboarding artifacts, preserving the catalog's single-writer rule.
 */
const onboardingGraphWorkflows = [
  workflow({
    id: "workflow.experience.onboarding-system.onb-00-resume-scope",
    title: "Onboarding ONB-00: resume and classify scope",
    // Same production-verification rationale as ONB-03 below: with no gate, this entry node
    // compiled to verification "none", so an executor could return the declared scope-packet
    // artifact ID and fingerprint without ever writing a real resume/classify decision -- and
    // ONB-01 would become runnable immediately, with nothing downstream reading ONB-00's own
    // packet, letting the entire graph proceed without its foundational scope classification.
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Consumer onboarding work begins or resumes; classify greenfield, replacement, audit-only, or explicitly bounded incremental mode",
    instructions:
      "Determine whether this onboarding pass is greenfield, replacement, audit-only, or a founder-scoped incremental change, and record the affected product surfaces, freshness date, responsible owner, the durable user value at stake, and whether the mode requires a hard cutover with zero-legacy runtime. Write the decision into product/onboarding/graph/ONB-00-resume-scope.md's Execution Mode fields \u2014 check:onboarding-evidence-onb-00 rejects a stub or templated packet, and every downstream node through ONB-21 blocks on this classification.",
    reads: ["analytics/ANALYTICS.md", "product/experience/11-star-experience/11_STAR_EXPERIENCE.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.1c"],
    dependencies: ["workflow.data.analytics-and-attribution-blueprint", "workflow.experience.11-star-experience"],
    outputPaths: ["product/onboarding/graph/ONB-00-resume-scope.md"],
    gates: ["check:onboarding-evidence-onb-00"],
    actionClass: "observe",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-01-current-state-trace",
    title: "Onboarding ONB-01: current-state trace",
    // Same production-verification rationale as ONB-00 above.
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Trace the actual onboarding implementation, documents, routes, state, providers, events, failures, tests, and legacy surfaces",
    instructions:
      "Trace the onboarding implementation as it exists today, surface by surface: for each route, state slice, provider call, event, permission, paywall, and legacy code path, record owner, source of truth, persisted state, API/event contract, consumers, and failure behavior. Write the trace to product/onboarding/graph/ONB-01-current-state-trace.md \u2014 check:onboarding-evidence-onb-01 rejects a thin or placeholder packet, and ONB-02's evidence plan depends on knowing what actually exists before scoping new evidence collection.",
    reads: ["product/onboarding/graph/ONB-00-resume-scope.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.1c"],
    dependencies: ["workflow.experience.onboarding-system.onb-00-resume-scope"],
    outputPaths: ["product/onboarding/graph/ONB-01-current-state-trace.md"],
    gates: ["check:onboarding-evidence-onb-01"],
    actionClass: "observe",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-02-evidence-plan",
    title: "Onboarding ONB-02: evidence plan",
    // Same production-verification rationale as ONB-00 above.
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Define the onboarding evidence hierarchy, access constraints, sample plan, and freshness cutoff",
    instructions:
      "Define the evidence hierarchy (rule, evidence, benchmark, observation, heuristic, hypothesis, or open question), the access constraints per source (e.g. authorized-only Onbo Hub access, no scraping), a sample plan per evidence node, and a freshness cutoff date beyond which a finding must be re-verified. Write the plan to product/onboarding/graph/ONB-02-evidence-plan.md so ONB-03 through ONB-08 collect against one shared standard instead of six competing ones; check:onboarding-evidence-onb-02 rejects a packet with no real plan.",
    reads: ["product/onboarding/graph/ONB-01-current-state-trace.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.1c"],
    dependencies: ["workflow.experience.onboarding-system.onb-01-current-state-trace"],
    outputPaths: ["product/onboarding/graph/ONB-02-evidence-plan.md"],
    gates: ["check:onboarding-evidence-onb-02"],
    actionClass: "observe",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-03-current-guidance",
    title: "Onboarding ONB-03: current guidance research",
    // domain.experience, not domain.research: core/session/run.ts's production runner only ever
    // calls acceptVerification() from its deterministic-gate branch -- fresh_context (judgment)
    // acceptance has no production caller at all, only test fixtures, so a domain.research
    // reassignment with no gate would leave this node permanently blocked in a real run. A
    // deterministic gate (check:onboarding-evidence-onb-03) is the only path that actually
    // promotes the node to succeeded; it cannot judge truthfulness, only reject an empty,
    // stub-length, or still-templated packet. Keeping domain.experience also keeps this node
    // inside an experience-scoped session brief (scopeHints: ["domain.experience"]).
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Research current consumer onboarding evidence, platform guidance, benchmarks, and practitioner heuristics",
    instructions:
      "Research current consumer-onboarding evidence \u2014 platform guidance, published benchmarks, and practitioner heuristics \u2014 that bears on this product's onboarding decisions, each dated and sourced per ONB-02's evidence hierarchy and freshness cutoff. Write findings as Evidence Ledger rows in product/onboarding/graph/ONB-03-current-guidance.md; check:onboarding-evidence-onb-03 rejects a packet with no prose finding or a templated stub, and ONB-09 joins this evidence into explicit product decisions.",
    reads: ["product/onboarding/graph/ONB-02-evidence-plan.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.1c"],
    dependencies: ["workflow.experience.onboarding-system.onb-02-evidence-plan"],
    outputPaths: ["product/onboarding/graph/ONB-03-current-guidance.md"],
    gates: ["check:onboarding-evidence-onb-03"],
    actionClass: "observe",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-04-competitor-reviews",
    title: "Onboarding ONB-04: competitor review analysis",
    // Same production-verification rationale as ONB-03 above.
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Mine direct and adjacent competitor reviews, including negative themes and a positive-review control",
    instructions:
      "Mine direct and adjacent competitors' reviews for negative onboarding themes, each backed by dates, versions, and sample size, and pair every theme with a positive-review control so the finding isn't cherry-picked. Record each as a Competitor Review Matrix row (root-cause class, disposition, test) in product/onboarding/graph/ONB-04-competitor-reviews.md \u2014 report frequency only within the sample, and do not let an onboarding fix paper over an underlying product defect; check:onboarding-evidence-onb-04 rejects a stub packet.",
    reads: ["product/onboarding/graph/ONB-02-evidence-plan.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.1c"],
    dependencies: ["workflow.experience.onboarding-system.onb-02-evidence-plan"],
    outputPaths: ["product/onboarding/graph/ONB-04-competitor-reviews.md"],
    gates: ["check:onboarding-evidence-onb-04"],
    actionClass: "observe",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-05-onbo-hub-atlas",
    title: "Onboarding ONB-05: authorized flow atlas",
    // Same production-verification rationale as ONB-03 above.
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Build an authorized Onbo Hub flow atlas without scraping, bypassing access controls, or inferring locked screens",
    instructions:
      "Build the authorized Onbo Hub flow atlas using only authorized access \u2014 do not scrape, bypass access controls, reuse credentials, or infer locked screens \u2014 recording screens, effort, first-value class, paywall placement, and review tension per flow, with an adopt/test/reject/investigate decision for each. Write the atlas to product/onboarding/graph/ONB-05-onbo-hub-atlas.md; check:onboarding-evidence-onb-05 rejects a stub or templated packet.",
    reads: ["product/onboarding/graph/ONB-02-evidence-plan.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.1c"],
    dependencies: ["workflow.experience.onboarding-system.onb-02-evidence-plan"],
    outputPaths: ["product/onboarding/graph/ONB-05-onbo-hub-atlas.md"],
    gates: ["check:onboarding-evidence-onb-05"],
    actionClass: "observe",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-06-internal-guidance-audit",
    title: "Onboarding ONB-06: internal guidance audit",
    // Same production-verification rationale as ONB-03 above.
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Audit applicable Formation and internal B2C guidance and resolve conflicts or outdated rules",
    instructions:
      "Audit every applicable Formation and internal B2C guidance source against this product's onboarding decisions, recording each rule, its evidence class, and a pass/partial/fail/outdated/conflict/not-applicable verdict, and resolve any conflict or outdated rule explicitly rather than leaving it ambiguous. Write the audit to product/onboarding/graph/ONB-06-internal-guidance-audit.md; check:onboarding-evidence-onb-06 rejects a packet with no real prose findings.",
    reads: ["product/onboarding/graph/ONB-02-evidence-plan.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.1c"],
    dependencies: ["workflow.experience.onboarding-system.onb-02-evidence-plan"],
    outputPaths: ["product/onboarding/graph/ONB-06-internal-guidance-audit.md"],
    gates: ["check:onboarding-evidence-onb-06"],
    actionClass: "observe",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-07-provider-policy-landscape",
    title: "Onboarding ONB-07: provider and policy landscape",
    // Same production-verification rationale as ONB-03 above.
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Refresh monetization, identity, analytics, RevenueCat, billing, platform-policy, and regional capability facts",
    instructions:
      "Refresh the current RevenueCat/billing surface (SDKs, offerings, entitlements, paywalls, experiments, pending purchases, restore) and PostHog, App Store Connect, and Google Play capability and policy facts by region, recording a technically-possible/policy-permitted distinction, enrollment/disclosure/fee/reporting detail, and a revalidation date for each. Write the findings to product/onboarding/graph/ONB-07-provider-policy-landscape.md; check:onboarding-evidence-onb-07 rejects a stub packet, and stale provider facts here propagate directly into ONB-12's state contract and ONB-17's paywall contract.",
    reads: ["product/onboarding/graph/ONB-02-evidence-plan.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.1c"],
    dependencies: ["workflow.experience.onboarding-system.onb-02-evidence-plan"],
    providers: ["provider.revenuecat", "provider.posthog", "provider.app-store-connect", "provider.google-play"],
    outputPaths: ["product/onboarding/graph/ONB-07-provider-policy-landscape.md"],
    gates: ["check:onboarding-evidence-onb-07"],
    actionClass: "observe",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-08-motion-research",
    title: "Onboarding ONB-08: motion research",
    // Same production-verification rationale as ONB-03 above.
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Research interaction and motion references with 60fps and translate them into the target framework",
    instructions:
      "Research interaction and motion references using the 60fps MCP (search_shots, get_shot, get_motion_breakdown, get_related_shots; motion code only when it clarifies) and translate the adopted principles into this product's own behavior and target framework, not a copy of the reference. Record each as a 60fps Motion Register row (target/problem, reference shot ID, adopted principle, implementation/haptic/interruption behavior, reduced-motion behavior) in product/onboarding/graph/ONB-08-motion-research.md; check:onboarding-evidence-onb-08 rejects a stub packet.",
    reads: ["product/onboarding/graph/ONB-02-evidence-plan.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.1c"],
    dependencies: ["workflow.experience.onboarding-system.onb-02-evidence-plan"],
    outputPaths: ["product/onboarding/graph/ONB-08-motion-research.md"],
    gates: ["check:onboarding-evidence-onb-08"],
    actionClass: "observe",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-09-evidence-join",
    title: "Onboarding ONB-09: evidence join",
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Join guidance, reviews, flow evidence, internal doctrine, provider facts, policy, and motion research into explicit decisions",
    instructions:
      "Join the current guidance, competitor reviews, Onbo Hub atlas, internal guidance audit, provider/policy landscape, and motion research into explicit, evidence-and-complaint-traceable decisions (adopt/adapt/test/reject/investigate), each naming the affected screen, control, architecture, or product work, its analytics implication, its test, and remaining risk; also run the seven-principle activation audit against the joined evidence. Write the join to product/onboarding/graph/ONB-09-evidence-join.md; check:onboarding-evidence-onb-09 rejects a stub packet, and ONB-10 through ONB-14 all branch from this decision set.",
    reads: [
      "product/onboarding/graph/ONB-03-current-guidance.md",
      "product/onboarding/graph/ONB-04-competitor-reviews.md",
      "product/onboarding/graph/ONB-05-onbo-hub-atlas.md",
      "product/onboarding/graph/ONB-06-internal-guidance-audit.md",
      "product/onboarding/graph/ONB-07-provider-policy-landscape.md",
      "product/onboarding/graph/ONB-08-motion-research.md",
    ],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.1c"],
    dependencies: [
      "workflow.experience.onboarding-system.onb-03-current-guidance",
      "workflow.experience.onboarding-system.onb-04-competitor-reviews",
      "workflow.experience.onboarding-system.onb-05-onbo-hub-atlas",
      "workflow.experience.onboarding-system.onb-06-internal-guidance-audit",
      "workflow.experience.onboarding-system.onb-07-provider-policy-landscape",
      "workflow.experience.onboarding-system.onb-08-motion-research",
    ],
    outputPaths: ["product/onboarding/graph/ONB-09-evidence-join.md"],
    // Same production-verification rationale as ONB-03 above: with no gate, this node compiled to
    // verification "none", so an executor could return the declared ONB-09 artifact ID and
    // fingerprint without producing a substantive evidence-to-decision join, and reconcilePatch()
    // would still mark it succeeded immediately -- unblocking ONB-10 through ONB-14 and eventually
    // the destructive ONB-22 cutover even though ONB-22's own gate never inspects
    // ONB-09-evidence-join.md.
    gates: ["check:onboarding-evidence-onb-09"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-10-first-value-activation",
    title: "Onboarding ONB-10: first value and activation",
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Define first value rendered, first value engaged, activation, habit, and retention hypotheses",
    instructions:
      "Separately define first value rendered (the real, personalized result the user sees), first value engaged (the meaningful action they take on it), activation (the retention hypothesis and its derived condition), habit signal, monetization, review eligibility, and onboarding completion \u2014 first value must be real, actionable, persistent, recoverable, and visible inside the populated normal product experience, not a canned demo. Write the milestones to product/onboarding/graph/ONB-10-first-value-activation.md; check:onboarding-evidence-onb-10 rejects a stub packet, and ONB-15's architecture decision depends on these being real, distinct milestones.",
    reads: ["product/onboarding/graph/ONB-09-evidence-join.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.1c"],
    dependencies: ["workflow.experience.onboarding-system.onb-09-evidence-join"],
    outputPaths: ["product/onboarding/graph/ONB-10-first-value-activation.md"],
    // Same production-verification rationale as ONB-03/ONB-09/ONB-17 above: with no gate, this
    // node compiled to verification "none", so an executor could return the declared artifact ID
    // and fingerprint without ever writing substantive first-value, activation, habit, or
    // retention hypotheses -- and neither ONB-15 (architecture decision, which depends on this
    // node) nor the final graph gate ever reads ONB-10-first-value-activation.md, letting the
    // downstream decision chain and the destructive ONB-22 cutover proceed on a node that never
    // actually produced its claimed content.
    gates: ["check:onboarding-evidence-onb-10"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-11-effort-question-audit",
    title: "Onboarding ONB-11: effort and question audit",
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Audit effort before value, question usefulness, permissions, interruption budget, and visible personalization proof",
    instructions:
      "Audit every step for effort placed before value is shown (class each passive/low/moderate/high/sensitive/permission/account/financial, and decide keep/defer/infer/delete) and every question for whether it is required, changes downstream logic, and produces visible personalization proof the user actually sees \u2014 including the total interruption budget across the flow. Write the audit to product/onboarding/graph/ONB-11-effort-question-audit.md; check:onboarding-evidence-onb-11 rejects a stub packet.",
    reads: ["product/onboarding/graph/ONB-09-evidence-join.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.1c"],
    dependencies: ["workflow.experience.onboarding-system.onb-09-evidence-join"],
    outputPaths: ["product/onboarding/graph/ONB-11-effort-question-audit.md"],
    // Same production-verification rationale as ONB-10 above.
    gates: ["check:onboarding-evidence-onb-11"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-12-state-identity-contract",
    title: "Onboarding ONB-12: state and identity contract",
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Define canonical journey, profile, identity, entitlement, continuity, and cross-surface state transitions",
    instructions:
      "Define the canonical state model keeping identity, onboarding journey, profile completeness, activation, entitlement, experiment assignment/exposure, review eligibility, permission/consent, and lifecycle state as distinct machines, each with its authoritative owner, persistence/event contract, and idempotency/retry/recovery behavior \u2014 grounded in the current RevenueCat entitlement and identity model from ONB-07. Write the contract to product/onboarding/graph/ONB-12-state-identity-contract.md; check:onboarding-evidence-onb-12 rejects a stub packet.",
    reads: ["product/onboarding/graph/ONB-09-evidence-join.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.1c"],
    dependencies: ["workflow.experience.onboarding-system.onb-09-evidence-join"],
    providers: ["provider.revenuecat"],
    outputPaths: ["product/onboarding/graph/ONB-12-state-identity-contract.md"],
    // Same production-verification rationale as ONB-10 above.
    gates: ["check:onboarding-evidence-onb-12"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-13-analytics-experiments",
    title: "Onboarding ONB-13: analytics and experiments",
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Define typed analytics, authoritative emitters, identity stitching, deduplication, experiment assignment, exposure, and expected sequences",
    instructions:
      "Define a machine-readable, typed analytics schema \u2014 every event carrying event_id, version, time, source, platform, journey, identity, session, correlation, acquisition, consent, and deduplication semantics \u2014 naming the authoritative emitter (client, backend-confirmed, or provider-confirmed) per event, plus experiment assignment, exposure, and expected event sequences for the happy path and each major failure/edge case. Write the contract to product/onboarding/graph/ONB-13-analytics-experiments.md; check:onboarding-evidence-onb-13 rejects a stub packet, and analytics failure must never block first value.",
    reads: ["product/onboarding/graph/ONB-09-evidence-join.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.1c"],
    dependencies: ["workflow.experience.onboarding-system.onb-09-evidence-join"],
    providers: ["provider.posthog", "provider.revenuecat"],
    outputPaths: ["product/onboarding/graph/ONB-13-analytics-experiments.md"],
    // Same production-verification rationale as ONB-10 above.
    gates: ["check:onboarding-evidence-onb-13"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-14-trust-lifecycle-policy",
    title: "Onboarding ONB-14: trust, lifecycle, and policy",
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Define review timing, permissions, lifecycle, privacy, security, accessibility, and policy behavior",
    instructions:
      "Define native-only review-request timing (eligibility may be earned early, but the request happens outside first-run onboarding, ungated by sentiment, with a remote kill switch), the permission-request and lifecycle orchestration strategy (request only after a user action with visible benefit; one strategy spanning onboarding recovery through win-back), and the privacy/security/accessibility policy behavior this flow must honor. Write the contract to product/onboarding/graph/ONB-14-trust-lifecycle-policy.md; check:onboarding-evidence-onb-14 rejects a stub packet.",
    reads: ["product/onboarding/graph/ONB-09-evidence-join.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.1c"],
    dependencies: ["workflow.experience.onboarding-system.onb-09-evidence-join"],
    outputPaths: ["product/onboarding/graph/ONB-14-trust-lifecycle-policy.md"],
    // Same production-verification rationale as ONB-10 above.
    gates: ["check:onboarding-evidence-onb-14"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-15-architecture-decision",
    title: "Onboarding ONB-15: architecture decision",
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Compare native-first, hosted-funnel-first, hybrid, web-first, and evidence-backed alternatives and select one target architecture",
    instructions:
      "Compare native-first, hosted-funnel-first, hybrid, web-first, and any other evidence-backed architecture against first value, conversion/retention, identity/analytics, policy/economics, and operations, using the first-value, effort, state, analytics, and trust decisions from ONB-10 through ONB-14, then select exactly one target architecture with a stated reason. Write the decision to product/onboarding/graph/ONB-15-architecture-decision.md; check:onboarding-evidence-onb-15 rejects a stub packet, and every node from ONB-16 onward builds on this one selected model.",
    reads: [
      "product/onboarding/graph/ONB-10-first-value-activation.md",
      "product/onboarding/graph/ONB-11-effort-question-audit.md",
      "product/onboarding/graph/ONB-12-state-identity-contract.md",
      "product/onboarding/graph/ONB-13-analytics-experiments.md",
      "product/onboarding/graph/ONB-14-trust-lifecycle-policy.md",
    ],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.1c", "phase.2"],
    dependencies: [
      "workflow.experience.onboarding-system.onb-10-first-value-activation",
      "workflow.experience.onboarding-system.onb-11-effort-question-audit",
      "workflow.experience.onboarding-system.onb-12-state-identity-contract",
      "workflow.experience.onboarding-system.onb-13-analytics-experiments",
      "workflow.experience.onboarding-system.onb-14-trust-lifecycle-policy",
    ],
    outputPaths: ["product/onboarding/graph/ONB-15-architecture-decision.md"],
    // Same production-verification rationale as ONB-10 above -- this node is the fan-in point
    // for ONB-10..14, so an unverified ONB-15 could also mask any of those five having been
    // accepted vacuously (each already has its own gate, but this one did not have its own).
    gates: ["check:onboarding-evidence-onb-15"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-16-journey-graph",
    title: "Onboarding ONB-16: canonical journey graph",
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Define acquisition-specific journeys that converge on one semantic onboarding state graph",
    instructions:
      "Draw the acquisition-specific journeys and converge them into one semantic onboarding state graph, marking each step's entry condition, owner/renderer, input/transition, canonical event, back/skip/close/resume behavior, and failure/next-step path \u2014 and mark where the acquisition promise, first effort, first value, engagement, account creation, paywall, purchase, activation, review eligibility, normal-product entry, and interruption budget each land on the graph. Write the graph to product/onboarding/graph/ONB-16-journey-graph.md; check:onboarding-evidence-onb-16 rejects a stub packet.",
    reads: ["product/onboarding/graph/ONB-15-architecture-decision.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.2"],
    dependencies: ["workflow.experience.onboarding-system.onb-15-architecture-decision"],
    outputPaths: ["product/onboarding/graph/ONB-16-journey-graph.md"],
    // Same production-verification rationale as ONB-10 above -- ONB-17, ONB-18, ONB-19, and
    // ONB-20's own gate all depend on this node without ever reading its file directly.
    gates: ["check:onboarding-evidence-onb-16"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-17-screen-control-paywall-contract",
    title: "Onboarding ONB-17: screen, control, and paywall contract",
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Specify every onboarding screen, copy key, control, action, paywall state, failure, recovery, accessibility, and localization behavior",
    instructions:
      "Specify every onboarding screen with a stable ID and exactly one dominant action, pulling on-screen copy by key from product/copy/COPY_DECK.md rather than inventing strings, and define every control's enable/validation rule, state mutation, and exact idempotent provider action; specify the paywall contract across trial/promo/existing-subscriber/offline/pending/canceled/restore states using live RevenueCat offerings, plus failure/recovery and accessibility/localization behavior per screen. Write the contract to product/onboarding/graph/ONB-17-screen-control-paywall-contract.md; check:onboarding-evidence-onb-17 rejects a stub packet, and ONB-20's adversarial QA runs directly against this contract.",
    reads: ["product/onboarding/graph/ONB-16-journey-graph.md", "product/copy/COPY_DECK.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.2"],
    dependencies: ["workflow.experience.onboarding-system.onb-16-journey-graph"],
    providers: ["provider.revenuecat"],
    outputPaths: ["product/onboarding/graph/ONB-17-screen-control-paywall-contract.md"],
    // Same production-verification rationale as ONB-19/ONB-20/ONB-21 above: with no gate, this
    // node compiled to verification "none", so an executor could return the declared artifact ID
    // and fingerprint without ever writing a substantive screen, control, or paywall contract --
    // and ONB-20's own gate (which inspects only its own packet) and the final graph gate (which
    // never reads ONB-17-screen-control-paywall-contract.md) would both miss it, letting ONB-20's
    // adversarial QA run against a contract that does not actually exist.
    gates: ["check:onboarding-evidence-onb-17"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-18-visual-design-prototype",
    title: "Onboarding ONB-18: visual design and prototype",
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Produce actual high-fidelity onboarding design, motion, an interactive prototype, and design QA",
    instructions:
      "Produce the actual high-fidelity onboarding design and an interactive prototype through the Design Room (state, mutate, contract, version, render \u2014 not a separate proposal or mood board), covering the happy path and critical branches across iOS, Android, small viewports, and large text, honoring reduced motion, and run design QA against it. Record the design proof \u2014 with the inspectable artifact path, not just adjectives \u2014 in product/onboarding/graph/ONB-18-visual-design-prototype.md; check:onboarding-evidence-onb-18 rejects a stub packet, and ONB-20's adversarial QA depends on this prototype actually existing.",
    reads: ["product/onboarding/graph/ONB-16-journey-graph.md", "design/design.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.2"],
    // Depends on (not merely narrates) the workflow that actually produces the rendered
    // design-state artifacts -- without this, the engine could accept ONB-18 and unblock
    // ONB-20 on this node's own Markdown packet alone, with no real high-fidelity design or
    // interactive prototype behind it.
    dependencies: ["workflow.experience.onboarding-system.onb-16-journey-graph", "workflow.design.design-room-state-mutate-version-render"],
    outputPaths: ["product/onboarding/graph/ONB-18-visual-design-prototype.md"],
    // The Design Room dependency above proves the generic design workflow produced rendered
    // artifacts; it does not prove THIS node's own ONB-18-visual-design-prototype.md packet is
    // substantive. Same production-verification rationale as ONB-10 above: with no gate on its
    // own output, an executor could return the declared artifact ID and fingerprint with an
    // empty or stub packet, and neither ONB-20's own gate nor the final graph gate reads this
    // file, letting ONB-20's adversarial QA proceed against a prototype packet that was never
    // actually written.
    gates: ["check:onboarding-evidence-onb-18"],
    actionClass: "mutate",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-19-implementation-cutover-contract",
    title: "Onboarding ONB-19: implementation and cutover contract",
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Define implementation units, reliability, performance, observability, privacy, migration, hard cutover, and deletion work",
    instructions:
      "Define the implementation task list plus reliability behavior (pending purchases, restore, entitlement delay, network, generation, analytics-non-blocking, deep link, identity, unsupported-client), performance/observability budgets (P50/P95 and failure budgets for startup, first value, provider init, paywall, checkout, entitlement, handoff), and the hard-cutover Deletion Manifest for anything the new graph replaces (legacy code, data, config, provider setup, dashboards, tests, docs, secrets, transformation tooling), each with a disposition and a verification method. Write the contract to product/onboarding/graph/ONB-19-implementation-cutover-contract.md; check:onboarding-evidence-onb-19 rejects a stub packet, and this is the plan ONB-22 later executes and the manifest ONB-22's cutover proves against the real repository.",
    reads: ["product/onboarding/graph/ONB-16-journey-graph.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.2", "phase.5b"],
    dependencies: ["workflow.experience.onboarding-system.onb-16-journey-graph"],
    outputPaths: ["product/onboarding/graph/ONB-19-implementation-cutover-contract.md"],
    // Same production-verification rationale as ONB-03/ONB-09/ONB-20/ONB-21 above: with no gate,
    // this node compiled to verification "none", so an executor could return the declared
    // artifact ID and fingerprint without ever writing a substantive implementation, migration,
    // reliability, or deletion plan -- and neither ONB-20's own gate (which inspects only its own
    // packet) nor the final graph gate (which never reads ONB-19-implementation-cutover-contract.md)
    // would catch it, letting the destructive ONB-22 cutover proceed with no real cutover plan.
    gates: ["check:onboarding-evidence-onb-19"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-20-adversarial-qa",
    title: "Onboarding ONB-20: adversarial QA",
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Run the synthetic one-star pre-mortem, policy review, instrumentation QA, accessibility review, and provider-realism review",
    instructions:
      "Run the synthetic one-star pre-mortem (privacy, permission, poor result, slow network, trial, subscriber, restore, web purchase, accessibility, identity, or subscription-aversion scenarios, each with root cause, likelihood/severity, mitigation, test, and remaining risk) plus a policy review, instrumentation QA, accessibility review, and provider-realism review against the actual ONB-17 contract, ONB-18 prototype, and ONB-19 cutover plan \u2014 assume the flow fails before crediting that it works. Write findings to product/onboarding/graph/ONB-20-adversarial-qa.md; check:onboarding-evidence-onb-20 rejects a stub packet, and an unresolved high-severity finding must not be waved through to ONB-21's implementation plan.",
    reads: [
      "product/onboarding/graph/ONB-17-screen-control-paywall-contract.md",
      "product/onboarding/graph/ONB-18-visual-design-prototype.md",
      "product/onboarding/graph/ONB-19-implementation-cutover-contract.md",
    ],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.2", "phase.5b"],
    dependencies: [
      "workflow.experience.onboarding-system.onb-17-screen-control-paywall-contract",
      "workflow.experience.onboarding-system.onb-18-visual-design-prototype",
      "workflow.experience.onboarding-system.onb-19-implementation-cutover-contract",
    ],
    outputPaths: ["product/onboarding/graph/ONB-20-adversarial-qa.md"],
    // Same production-verification rationale as ONB-03 above: with no gate, this node compiled
    // to verification "none", so an empty ONB-20-adversarial-qa.md could unlock ONB-21 and the
    // destructive ONB-22 cutover with no policy, instrumentation, accessibility, or provider QA
    // behind it at all.
    gates: ["check:onboarding-evidence-onb-20"],
    actionClass: "observe",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-system.onb-21-compound-engineering-plan",
    title: "Onboarding ONB-21: Compound Engineering plan",
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Translate the accepted onboarding graph into an implementation-ready Compound Engineering plan, or the Formation-equivalent fallback",
    instructions:
      "Translate the accepted onboarding graph and its adversarial-QA findings into an implementation-ready Compound Engineering plan (ce-plan when available, or this skill's equivalent), breaking work into tasks each with an outcome, exact paths, dependencies/contracts, required analytics/provider work, tests, legacy-deletion work, and acceptance criteria. Write the plan as ONB-TASK rows in product/onboarding/graph/ONB-21-compound-engineering-plan.md; check:onboarding-evidence-onb-21 rejects a stub packet, and ONB-22 executes exactly this task list rather than improvising new scope.",
    reads: ["product/onboarding/graph/ONB-20-adversarial-qa.md"],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.5b"],
    dependencies: ["workflow.experience.onboarding-system.onb-20-adversarial-qa"],
    outputPaths: ["product/onboarding/graph/ONB-21-compound-engineering-plan.md"],
    // Same production-verification rationale as ONB-03 above: with no gate, this node compiled
    // to verification "none", so an executor could return the declared artifact ID and fingerprint
    // without ever writing a substantive implementation plan, and reconcilePatch() would still mark
    // it succeeded immediately -- unblocking ONB-22's destructive cutover even though ONB-22's own
    // gate reads only ONBOARDING.md, never ONB-21-compound-engineering-plan.md.
    gates: ["check:onboarding-evidence-onb-21"],
    actionClass: "draft",
    idempotent: true,
  }),
] as const;

export const workflows = [
  workflow({
    id: "workflow.product.app-archetype-detection-and-starter",
    title: "App-archetype detection & starter",
    domainId: "domain.product",
    areaIds: ["area.product-experience"],
    trigger: "Request matches a known product shape (social / AI-chat / habit / photo-AI)",
    instructions:
      "Confirm the product's shape against the four shipped archetypes (habit-tracker, photo-AI-media, social-network, AI-chat-companion) with the founder via AskUserQuestion, then copy the matched starter scaffold from starters/<archetype>/ into the business repo rather than improvising the same wiring from scratch. Record the confirmed archetype and shape answers (e.g. habit_model, primary_surface) in state/PROJECT_STATE.yaml so later sessions do not re-litigate it. Do not write product/SPEC.md here — that single-writer role belongs to research-backed-spec; this node's proof is the starter scaffold itself, checked by check:archetype-starter alongside check:app-archetype. If the product only contains a feature that resembles one of the four shapes without being its center of gravity, stop and route to the general core-loop-and-v1-scope method instead of forcing a mismatched pack.",
    reads: ["state/PROJECT_STATE.yaml"],
    // The mobile role receives the four archetypes as conditional routes and must load only
    // the founder-confirmed match; they are not four mandatory, mutually contradictory reads.
    roleId: "role.mobile-engineer",
    laneIds: ["product"],
    gates: ["check:app-archetype", "check:archetype-starter"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.research.research-backed-spec",
    title: "Research-backed spec",
    domainId: "domain.research",
    areaIds: ["area.product-experience"],
    trigger: "Need category economics, competitor, review/social-language, keyword, or name-collision evidence",
    instructions:
      "Assemble category-economics, competitor, review/social-language, keyword, and name-collision evidence into strategy/RESEARCH.md's Category Revenue Reality table — a sourced, dated revenue estimate per competitor row judged against a stated bar (default: top-10 category gross ≥$5M/year combined with 2+ apps clearing $1M/year each) — then run the mandatory Go/Pivot/Kill table; check:research fails a pass verdict with no stated threshold or a table with rows but no judgment line. Write strategy/SIGNAL_CORPUS.md from available founder and market material, keeping one claim per row and preserving dates, confidence, conflicts, and supersession; when no reusable source exists, record an explicit not-applicable status with an authored reason instead of fabricating rows. Write strategy/OFFER_TEST.md before the verdict. Measure one exact audience, discovery location, native format, owned-relationship route, exposure value, and CTA response; if the founder declines the test, record a dated founder waiver and the residual risk. Add Distribution proof and Offer test evidence to the Go, Pivot, Or Kill row. Before product/SPEC.md hardens, run the product-moat one-week-copy test naming which moat class the wedge is building toward and the specific beat moment against the top incumbents; a wedge with no surviving beat moment is Go/Pivot/Kill evidence, not a reason to soften the table. For a product that doesn't match one of the four shipped archetypes, use core-loop-and-v1-scope's general method to name the core loop and draw the V1 line instead of improvising. The founder alone decides Go, Pivot, or Kill — present the evidence, do not decide for them. check:research rejects a verdict with missing category, wedge, demand, distribution, offer, provenance, or founder-decision evidence.",
    reads: ["state/PROJECT_STATE.yaml"],
    roleId: "role.research-strategist",
    laneIds: ["research", "product"],
    phaseIds: ["phase.1"],
    outputPaths: ["strategy/RESEARCH.md", "strategy/SIGNAL_CORPUS.md", "strategy/OFFER_TEST.md", "product/SPEC.md"],
    gates: ["check:research"],
    founderOnlyActions: ["decide Go, Pivot, or Kill"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.research.localization-market-research",
    title: "Localization market research",
    domainId: "domain.research",
    areaIds: ["area.product-experience"],
    trigger: "Before localizing any surface or choosing locales",
    instructions:
      "Research search-demand evidence per market (AppKittie keyword popularity/difficulty and download/revenue estimates by country, App Store Connect/Play Console territory data when the app is live, XPOZ in-language social vocabulary) before recommending any locale — localization is a market-selection decision made from evidence, not a translate-everything-to-be-safe pass. Produce strategy/localization-market-research/LOCALIZATION_MARKET_RESEARCH.md (and its .html) with ranked priority tiers per market, naming which tool produced each cell and whether the data is a first-party or estimated basis. A market that does not clear the popularity/competition/opportunity bar gets deferred, not localized on the strength of language alone.",
    reads: ["state/PROJECT_STATE.yaml"],
    roleId: "role.research-strategist",
    laneIds: ["research"],
    phaseIds: ["phase.1"],
    outputPaths: ["strategy/localization-market-research/LOCALIZATION_MARKET_RESEARCH.md"],
    providers: ["provider.aso-skills"],
    actionClass: "observe",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.11-star-experience",
    title: "11-star experience",
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: '"11-star run" / before SPEC, onboarding, ads, store creative, or eng plans harden',
    instructions:
      "Run the 11-Star Run Protocol: for the product's core promise, name what would happen at 1★ (failure), 2★ (friction), 5★ (expected/works-but-forgettable), and the absurd 9-11★ concierge version, then work backward to the feasible 6-7★ slice that still carries the magic and is buildable in V1. Write the ladder into 11_STAR_EXPERIENCE.md and its visual storyboard into 11-star-experience.html, and trace the promise through product/design/engineering/analytics/revenue/store/content in state/LAUNCH_TRACE.md so downstream nodes inherit the same target instead of re-deciding it. The decision that matters most is the V1 cut line — which normal product, design, onboarding, and paywall calls change because of the chosen slice — not the impressive 11★ idea itself, which stays inspiration.",
    reads: ["product/SPEC.md"],
    roleId: "role.product-leader",
    laneIds: ["experience"],
    phaseIds: ["phase.1c"],
    dependencies: ["workflow.research.research-backed-spec"],
    outputPaths: ["product/experience/11-star-experience/11_STAR_EXPERIENCE.md", "product/experience/11-star-experience/11-star-experience.html"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.emotional-experience-design-producer",
    title: "Emotional experience design (producer)",
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: 'Feature whose 11-star target is 6★+ / "charge this with emotion", "build a habit"',
    instructions:
      "Implement all four required Experience Cards (Commitment, Variable Reward, Perceived Effort Delay, Intent Mirroring) per emotional-experience-design.md's producer recipes, each with its deterministic guardrail satisfied (e.g. Variable Reward's result must differ across at least 30% of consecutive completions, Commitment's goal must be user-editable at any time) and evidence recorded in engineering/PRODUCTION_READINESS.md — a card that cannot be verified on a running app does not ship. Route any additional card from the 12-card deck (experience-cards.md's Card Routing table) only when the product moment genuinely fits; give every emotional moment a named PostHog event per emotional-experience-measurement.md before build, not invented ad hoc. Apply the three-question bright-line test from ethics-guardrail.md (goal alignment, truthfulness, informed exit) to each card before it ships — any NO answer means redesign, not a documented exception — and check:emotional-design enforces the resulting attestation fields in EMOTIONAL_DESIGN.md.",
    reads: ["product/experience/11-star-experience/11_STAR_EXPERIENCE.md", "analytics/ANALYTICS.md"],
    roleId: "role.product-leader",
    laneIds: ["emotional_design"],
    phaseIds: ["phase.1c"],
    dependencies: ["workflow.experience.11-star-experience", "workflow.data.analytics-and-attribution-blueprint"],
    outputPaths: ["product/experience/emotional-design/EMOTIONAL_DESIGN.md"],
    gates: ["check:emotional-design"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.emotional-design-audit-auditor",
    title: "Emotional design audit (auditor)",
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: '"Audit this app\'s emotional design" / "emotional UX audit"',
    instructions:
      "Audit EMOTIONAL_DESIGN.md against every card the app actually implements — for each, verify the specific bright-line/dark-line test from that card's own file (experience-cards/<name>-card.md) and consumer-product-design-agency.md's four-required-card checklist actually passes, not just that a card is named. HIGH-risk cards (Variable Reward, Streak & Loss Aversion) get the strictest read: confirm the escape hatch, counter-metric, and non-empty fallback are real, not aspirational language. Write findings as EMOTIONAL_AUDIT.md's Audit Output Contract, and any dark-pattern violation or missing per-card attestation field becomes a failure card per failure-cards.md rather than a note to fix later — check:emotional-design enforces the attestation fields this audit must produce.",
    reads: ["product/experience/emotional-design/EMOTIONAL_DESIGN.md"],
    roleId: "role.security-architect",
    laneIds: ["emotional_design"],
    phaseIds: ["phase.1c"],
    dependencies: ["workflow.experience.emotional-experience-design-producer"],
    outputPaths: ["product/experience/emotional-design/EMOTIONAL_AUDIT.md"],
    gates: ["check:emotional-design"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.design.brand-definition",
    title: "Brand definition",
    domainId: "domain.design",
    areaIds: ["area.product-experience"],
    trigger: "Crossing research into design: before the Design Room locks visual identity, and before any marketing or store copy claims a brand voice",
    instructions:
      "Write `strategy/BRAND.md` as the voice and identity contract every downstream copy and design surface answers to: name, one-line promise, the audience it speaks to (from `strategy/RESEARCH.md`'s evidence, not aspiration), voice register with three do/don't example pairs, vocabulary the brand owns and words it never uses, and the visual-identity intent the Design Room turns into tokens. Derive it from the research and the 11-star experience bar — a brand document that could describe any app in the category is template residue, not a brand. This file is the standard `writing-quality-no-slop` protects and the store listing speaks in; it existed as a phase-2 promise with no producing node until now (2026-08-19 audit's phantom-read finding), which meant a run could reach store submission with a template brand and nothing would flag it.",
    reads: ["strategy/RESEARCH.md", "product/experience/11-star-experience/11_STAR_EXPERIENCE.md"],
    roleId: "role.design-guru",
    laneIds: ["design"],
    phaseIds: ["phase.2"],
    dependencies: ["workflow.research.research-backed-spec", "workflow.experience.11-star-experience"],
    outputPaths: ["strategy/BRAND.md"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.design.design-room-state-mutate-version-render",
    title: "Design Room (state→mutate→version→render)",
    domainId: "domain.design",
    areaIds: ["area.product-experience"],
    trigger: "Any design/visual-system/cross-surface/store-creative/landing/onboarding/paywall work",
    instructions:
      "Follow the mandatory STATE→MUTATE→CONTRACT→VERSION→RENDER loop. Read design/design.md, studio/seed/business.json, and studio/seed/theme.tokens.json before any design work. During STATE, load design-evidence-stack.md, record the change classification and affected scope, classify the decision, mark all six evidence sources required, not applicable, or unavailable with a reason, and record the evidence pass in design/design.md before mutation. Apply the Formation Craft Lens to substantive work. Explore three distinct concepts. Give objects a defined physical model. Use motion to explain structure. Recompose mobile instead of shrinking desktop. Make articles, walkthroughs, and videos native to their medium. Use quiet space to protect hierarchy. Specify immediate, interruptible microinteractions with subtle spring behavior instead of default slow fades. Record quality facets, reductions, convergence reason, state paths, and validation in the craft-reasoning table. Open only relevant external sources. Use one relevant source for every new or materially changed surface, and two complementary sources for onboarding, paywall, core-loop, AI-trust, and store-first-frame decisions; internal craft doctrine does not replace behavior or structure evidence. Treat abtest.design results as hypothesis seeds, not transferable causal proof. Derive design/design.md's Audience And Identity section from strategy/RESEARCH.md before locking any visual direction: audience facts, apps they love, category convention followed/broken, anti-references, and the fact→decision table with evidence — the derivation chain lives in audience-derived-identity.md, and a direction that only cites a trend is not a decision. Make one coherent state mutation. Update design/design.md in the same change when design intent or implementation guidance changes. When the 60fps.design MCP is connected, ground screen and interaction direction in real exemplars before locking states (60fps_search_shots, 60fps_get_shot, 60fps_get_motion_breakdown, 60fps_get_related_shots) and record each adopted principle in design/design.md — translate mechanics only, never another product's brand, assets, copy, or exact layout; when it is not connected, motion-craft-benchmarks.md's distilled recipes remain the contract. Validate the state and contract. Render the Design Room. Version the state, contract, tokens, and render together. Never create a separate design proposal, mood board, or HTML proof. Use surfaces-b2c.md for surface rules. Apply quality-lens.md before review. The founder approves the final brand direction.",
    reads: ["design/design.md", "studio/seed/business.json", "studio/seed/theme.tokens.json", "state/LAUNCH_TRACE.md", "strategy/RESEARCH.md"],
    roleId: "role.design-guru",
    laneIds: ["design"],
    phaseIds: ["phase.2"],
    dependencies: ["workflow.process.launch-trace-and-build-contracts", "workflow.design.brand-definition"],
    outputPaths: ["design/design.md", "studio/seed/business.json", "studio/seed/theme.tokens.json", "design/design-room.html"],
    gates: ["validate:design-state", "check:design-room", "render:design-room"],
    founderOnlyActions: ["approve final brand direction"],
    actionClass: "mutate",
    idempotent: true,
  }),
  workflow({
    id: "workflow.design.token-promotion",
    title: "Token promotion",
    domainId: "domain.design",
    areaIds: ["area.product-experience"],
    trigger: "Theme tokens change and the design is accepted",
    instructions:
      "Run npm run promote:design-tokens to derive studio/generated/system/tokens.json, design/system/tokens.css, and studio/generated/system/DesignTokens.swift from the accepted studio/seed/theme.tokens.json — this is a mechanical promotion step, not a redesign, so the promoted values must match the seed exactly, not a reinterpretation. Only run it after the founder has accepted the design in the Design Room; promoting unaccepted tokens ships a design nobody approved. check:token-promotion is the proof — a promoted file that drifts from the seed tokens fails it.",
    reads: ["studio/seed/theme.tokens.json"],
    roleId: "role.design-guru",
    laneIds: ["design"],
    phaseIds: ["phase.2"],
    dependencies: ["workflow.design.design-room-state-mutate-version-render"],
    outputPaths: ["studio/generated/system/tokens.json", "design/system/tokens.css", "studio/generated/system/DesignTokens.swift"],
    gates: ["check:token-promotion"],
    actionClass: "mutate",
    idempotent: true,
  }),
  workflow({
    id: "workflow.design.ux-patterns-refero",
    title: "UX patterns (Refero)",
    domainId: "domain.design",
    areaIds: ["area.product-experience"],
    trigger: "Before flow maps, state matrices, UX_PATTERNS.md, or bug-trap coverage",
    instructions:
      "Query Refero (refero_search_flows / refero_search_screens) for 2-4 real shipped flows relevant to the surfaces modeled in studio/seed/business.json, and summarize step count, friction, recovery, and system response into product/experience/ux-patterns/UX_PATTERNS.md and its rendered ux-patterns.html — Refero is evidence for pattern quality, not a replacement for this skill's own onboarding-conversion doctrine. If Refero access is unavailable, load paid-tool-routing.md and get founder confirmation before falling back to the bundled baseline pattern pack, and record the decision in strategy/TOOL_DECISIONS.md and state/PROJECT_STATE.yaml.tools.refero. Refero's iOS/mobile records cover journey structure only for Android — do not claim Android-specific UX proof from Refero alone.",
    reads: ["studio/seed/business.json"],
    roleId: "role.design-guru",
    laneIds: ["design"],
    phaseIds: ["phase.2"],
    dependencies: ["workflow.design.design-room-state-mutate-version-render"],
    outputPaths: ["product/experience/ux-patterns/UX_PATTERNS.md"],
    providers: ["provider.refero"],
    actionClass: "draft",
    idempotent: true,
  }),
  ...onboardingGraphWorkflows,
  workflow({
    id: "workflow.experience.onboarding-conversion",
    title: "Onboarding ONB-22: execute, cut over, and verify",
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Implement or finalize the accepted onboarding graph, verify the canonical artifacts, cut over, and prove zero legacy",
    instructions:
      "Execute ONB-21's Compound Engineering task list for real (implementation, review, tests, and provider validation), then assemble the canonical product/ONBOARDING.md by transcribing every ONB-00 through ONB-21 packet into its matching section, and mark every ONB-00 through ONB-22 row in the Graph Run table done with exactly one row per node. Only after the founder approves the hard cutover, delete the legacy runtime and transformation tooling per ONB-19's Deletion Manifest, and mark a row's Disposition delete only once that artifact is actually gone from the repository \u2014 check:onboarding-cutover-repository verifies every claimed deletion against real filesystem state, not prose. Confirm RevenueCat and PostHog readiness against operations/PROVIDER_PROOF.md before claiming provider rows ready, then re-render product/onboarding.html to match. check:onboarding-graph-complete, check:onboarding-page-fresh, check:onboarding-cutover-repository, and check:provider-proof-onboarding all gate this node, and none of them can be satisfied by prose alone.",
    reads: [
      "product/onboarding/graph/ONB-00-resume-scope.md",
      "product/onboarding/graph/ONB-01-current-state-trace.md",
      "product/onboarding/graph/ONB-02-evidence-plan.md",
      "product/onboarding/graph/ONB-03-current-guidance.md",
      "product/onboarding/graph/ONB-04-competitor-reviews.md",
      "product/onboarding/graph/ONB-05-onbo-hub-atlas.md",
      "product/onboarding/graph/ONB-06-internal-guidance-audit.md",
      "product/onboarding/graph/ONB-07-provider-policy-landscape.md",
      "product/onboarding/graph/ONB-08-motion-research.md",
      "product/onboarding/graph/ONB-09-evidence-join.md",
      "product/onboarding/graph/ONB-10-first-value-activation.md",
      "product/onboarding/graph/ONB-11-effort-question-audit.md",
      "product/onboarding/graph/ONB-12-state-identity-contract.md",
      "product/onboarding/graph/ONB-13-analytics-experiments.md",
      "product/onboarding/graph/ONB-14-trust-lifecycle-policy.md",
      "product/onboarding/graph/ONB-15-architecture-decision.md",
      "product/onboarding/graph/ONB-16-journey-graph.md",
      "product/onboarding/graph/ONB-17-screen-control-paywall-contract.md",
      "product/onboarding/graph/ONB-18-visual-design-prototype.md",
      "product/onboarding/graph/ONB-19-implementation-cutover-contract.md",
      "product/onboarding/graph/ONB-20-adversarial-qa.md",
      "product/onboarding/graph/ONB-21-compound-engineering-plan.md",
      "product/copy/COPY_DECK.md",
      "operations/PROVIDER_PROOF.md",
    ],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.2", "phase.5b"],
    dependencies: ["workflow.experience.onboarding-system.onb-21-compound-engineering-plan"],
    outputPaths: ["product/ONBOARDING.md", "product/onboarding.html"],
    // check:onboarding-graph-complete reads only product/ONBOARDING.md and project state -- it
    // has no way to notice product/onboarding.html drifting stale or going missing.
    // check:onboarding-page-fresh reuses check:generated-pages's own byte-match-against-a-fresh-
    // render mechanism, scoped with --page to product/onboarding.html only; the unscoped
    // check:generated-pages iterates every artifactPageEntries() entry, so citing it directly here
    // would make ONB-22's own acceptance depend on an unrelated page elsewhere in the manifest
    // (e.g. operations/orchestration.html) being fresh too, coupling this node to lanes it does
    // not own.
    // check:onboarding-cutover-repository-complete (--require-resolved: every Deletion Manifest
    // row must resolve to exactly one terminal disposition) and check:provider-proof-onboarding
    // are the independent
    // verification half: the two gates above only ever read product/ONBOARDING.md's own
    // self-authored text, so a Deletion Manifest row claiming "delete" or a provider row
    // claiming captured evidence would otherwise be trusted without ever checking the
    // repository or operations/PROVIDER_PROOF.md for the corresponding proof.
    // check:provider-proof-onboarding is a --providers-scoped invocation of check:provider-proof
    // (PostHog/RevenueCat only, this node's own declared providers below); the unscoped
    // check:provider-proof scans the whole PROVIDER_PROOF.md document for a claimed-ready/
    // open-blocker contradiction, so citing it directly here would make ONB-22's own acceptance
    // depend on an unrelated provider row (e.g. Resend or Sentry) elsewhere in that document.
    gates: [
      "check:onboarding-graph-complete",
      "check:onboarding-page-fresh",
      "check:onboarding-cutover-repository-complete",
      "check:provider-proof-onboarding",
    ],
    providers: ["provider.revenuecat", "provider.posthog"],
    // Hard cutover and legacy deletion, not a retryable content mutation -- classifying it
    // "mutate" would let the durable engine execute production deletion under an ordinary
    // experience-domain grant instead of the autonomy engine's protected destructive waiver path.
    actionClass: "destructive",
    protectedCategory: "destructive",
    founderOnlyActions: ["approve the hard cutover and legacy runtime deletion"],
    // Not idempotent: detectOrphans() treats an idempotent node's lost-heartbeat attempt as safe
    // to hand straight back to "ready" for the next dispatch cycle to blindly re-attempt. This
    // node applies a one-time provider/runtime transformation and deletes legacy architecture --
    // an orphaned attempt may have partially applied that before the heartbeat died, so a blind
    // retry could repeat destructive work. idempotent: false routes an orphan to needs_readback
    // instead, where it stays until a provider read-back establishes ground truth.
    idempotent: false,
  }),
  workflow({
    id: "workflow.design.premium-mobile-craft",
    title: "Premium mobile craft",
    domainId: "domain.design",
    areaIds: ["area.product-experience"],
    trigger: 'Before in-app UI build/polish, press-state/haptics/loading-empty wiring, live-state effects, or "premium feel"',
    instructions:
      "Wire the five invisible premium details into every screen — press states with the press spring family (response 0.3-0.4, damping 0.7-0.8, PremiumMotion.press), subtle motion, semantic haptics, keyboard behavior, and loading/empty states — using PremiumCraft.swift on SwiftUI (React Native/Flutter parity via the same DesignTokens.Motion tokens) as the primary target, honoring Reduce Motion throughout. Never hand-type a spring literal in view code: read the preset layer, and reserve the celebrate family (response 0.45-0.5, damping 0.5-0.7) for celebrations and earned-object reveals only — a celebrate-grade spring on an ordinary state change is as wrong as a flat ease on a celebration. When a surface needs stronger direction than the five details give, route to motion-craft-benchmarks.md's numbered recipes. Use R15-R18 for liquid morphs, state-bound beams, liquid-metal rings, and semantic thinking orbs. Bind every live effect to a real state, a plain fallback, and a reduced-motion result. Ground catalog recipes in a live exemplar first via the 60fps MCP when it is connected (60fps_search_shots, 60fps_get_motion_breakdown; rewrite any 60fps_get_motion_code output onto DesignTokens.Motion before it ships). check:motion-contract proves the contract was applied; adjectives in design/design.md do not.",
    reads: ["design/design.md", "studio/seed/business.json", "studio/seed/theme.tokens.json"],
    // UX_PATTERNS.md is a consult, not a read: its producer (ux-patterns-refero) can park
    // indefinitely on paid-tool routing, and design/design.md sits upstream of half the launch —
    // premium craft must not stall the graph waiting for optional pattern evidence.
    consults: ["product/experience/ux-patterns/UX_PATTERNS.md"],
    roleId: "role.design-guru",
    laneIds: ["design"],
    dependencies: ["workflow.design.design-room-state-mutate-version-render"],
    // The Design Room workflow owns design/design.md. This workflow verifies that
    // implementation uses the approved contract and promoted tokens.
    outputPaths: [],
    gates: ["check:motion-contract"],
    actionClass: "mutate",
    idempotent: true,
  }),
  workflow({
    id: "workflow.design.content-assets-remotion-generated-visuals",
    title: "Content assets / Remotion / generated visuals",
    domainId: "domain.design",
    areaIds: ["area.product-experience"],
    trigger: "Before rendered videos/stills, app previews, ad/social variants",
    instructions:
      "Decide the production route per asset before generating anything: Higgsfield for net-new AI-generated imagery, mascots, or presenter/UGC video; Remotion for reproducible compositions built from real app UI, design/design.md tokens, screenshots, copy, and data where many variants (hooks, formats, dimensions, locales) are needed. Do not generate when the founder has not approved the intended paid route's fallback, Remotion commercial-license eligibility for this business is unclear, or the source UI/asset rights are missing. Record every produced asset in growth/content-assets/CONTENT_ASSETS.md (and its content-assets.html) with its route, token/source inputs, and license basis — check:content-assets proves the manifest matches what actually rendered, and this node is not idempotent because each run can legitimately produce new asset variants.",
    reads: ["design/design.md", "studio/seed/theme.tokens.json"],
    roleId: "role.design-guru",
    laneIds: ["content_assets"],
    phaseIds: ["phase.2", "phase.3"],
    dependencies: ["workflow.design.design-room-state-mutate-version-render"],
    outputPaths: ["growth/content-assets/CONTENT_ASSETS.md", "growth/content-assets/content-assets.html"],
    gates: ["check:content-assets"],
    providers: ["provider.higgsfield"],
    actionClass: "mutate",
    idempotent: false,
  }),
  workflow({
    id: "workflow.words.writing-quality-no-slop",
    title: "Writing quality (no-slop)",
    domainId: "domain.words",
    areaIds: ["area.product-experience"],
    trigger: "Before writing or reviewing any founder-facing copy or any marketing copy the skill generates",
    instructions:
      "Before any founder-facing or marketing copy ships, identify which voice you are protecting — this skill's own direct/no-filler voice for founder-facing surfaces, or the launched business's strategy/BRAND.md voice and the tone 11_STAR_EXPERIENCE.md set for marketing copy — and make the minimum effective edit: strip filler, hedging, importance-inflation, and interpretive asides without flattening a brand's playful or clinical register into generic 'clean' English. Apply the portability test to each generic sentence: if it can move unchanged to another person, company, country, or product, replace it with a specific fact, mechanism, consequence, or judgment. Author every user-facing string as a keyed row in product/copy/COPY_DECK.md (with product/copy/COPY_BRIEF.md as the brief that precedes it) before any builder consumes it — builders read deck keys, they do not invent strings from the spec. Run the banned-words/patterns self-check and channel-specific limits (store character counts, push/email subject limits) before handoff; check:app-copy is the gate that fails a placeholder-shaped or missing deck row.",
    reads: ["strategy/BRAND.md", "product/experience/11-star-experience/11_STAR_EXPERIENCE.md"],
    roleId: "role.copy-specialist",
    outputPaths: ["product/copy/COPY_BRIEF.md", "product/copy/COPY_DECK.md"],
    gates: ["check:app-copy"],
    actionClass: "draft",
    idempotent: true,
  }),
] as const;
