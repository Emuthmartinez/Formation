import { workflow } from "./helpers.js";

/**
 * Ported from runtime/graph/workflows/product-experience.ts. All thirteen are
 * grantable-domain.
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
 */
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
    referenceIds: ["reference.product.core-loop-and-v1-scope"],
    roleId: "role.mobile-engineer",
    laneIds: ["product"],
    // outputPaths intentionally empty: workflow.research.research-backed-spec is
    // product/SPEC.md's single writer (see file header); this workflow's proof is the
    // matched starter scaffold, checked separately by check:archetype-starter.
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
      "Assemble category-economics, competitor, review/social-language, keyword, and name-collision evidence into strategy/RESEARCH.md's Category Revenue Reality table — a sourced, dated revenue estimate per competitor row judged against a stated bar (default: top-10 category gross ≥$5M/year combined with 2+ apps clearing $1M/year each) — then run the mandatory Go/Pivot/Kill table; check:research fails a pass verdict with no stated threshold or a table with rows but no judgment line. Before product/SPEC.md hardens, run the product-moat one-week-copy test naming which moat class the wedge is building toward and the specific beat moment against the top incumbents; a wedge with no surviving beat moment is Go/Pivot/Kill evidence, not a reason to soften the table. For a product that doesn't match one of the four shipped archetypes, use core-loop-and-v1-scope's general method to name the core loop and draw the V1 line instead of improvising. The founder alone decides Go, Pivot, or Kill — present the evidence, do not decide for them.",
    reads: ["state/PROJECT_STATE.yaml"],
    referenceIds: [
      "reference.research.go-pivot-or-kill",
      "reference.product.product-moat",
      "reference.product.core-loop-and-v1-scope",
      "reference.process.tool-recipes.research-intelligence",
    ],
    roleId: "role.research-strategist",
    laneIds: ["research", "product"],
    phaseIds: ["phase.1"],
    outputPaths: ["strategy/RESEARCH.md", "product/SPEC.md"],
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
    referenceIds: ["reference.research.localization-market-research"],
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
    referenceIds: ["reference.experience.eleven-star-experience"],
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
    referenceIds: [
      "reference.experience.emotional-design-system",
      "reference.experience.emotional-experience-design",
      "reference.experience.experience-cards",
      "reference.experience.ethics-guardrail",
      "reference.experience.emotional-experience-measurement",
    ],
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
    referenceIds: [
      "reference.experience.emotional-design-system",
      "reference.experience.consumer-product-design-agency",
      "reference.experience.ethics-guardrail",
      "reference.experience.experience-cards",
    ],
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
    id: "workflow.design.design-room-state-mutate-version-render",
    title: "Design Room (state→mutate→version→render)",
    domainId: "domain.design",
    areaIds: ["area.product-experience"],
    trigger: "Any design/visual-system/cross-surface/store-creative/landing/onboarding/paywall work",
    instructions:
      "Follow the mandatory STATE→MUTATE→CONTRACT→VERSION→RENDER loop. Read design/design.md, studio/seed/business.json, and studio/seed/theme.tokens.json before any design work. Make one coherent state mutation. Update design/design.md in the same change when design intent or implementation guidance changes. Validate the state and contract. Render the Design Room. Version the state, contract, tokens, and render together. Never create a separate design proposal, mood board, or HTML proof. Use surfaces-b2c.md for surface rules. Apply quality-lens.md before review. The founder approves the final brand direction.",
    reads: ["design/design.md", "studio/seed/business.json", "studio/seed/theme.tokens.json", "state/LAUNCH_TRACE.md"],
    referenceIds: ["reference.design.design-room", "reference.design.surfaces-b2c", "reference.design.landing-motion-craft", "reference.design.quality-lens"],
    roleId: "role.design-guru",
    laneIds: ["design"],
    phaseIds: ["phase.2"],
    dependencies: ["workflow.process.launch-trace-and-build-contracts"],
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
    referenceIds: ["reference.design.design-room", "reference.design.design-visual-system"],
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
    referenceIds: ["reference.design.refero-ux-patterns"],
    roleId: "role.design-guru",
    laneIds: ["design"],
    phaseIds: ["phase.2"],
    dependencies: ["workflow.design.design-room-state-mutate-version-render"],
    outputPaths: ["product/experience/ux-patterns/UX_PATTERNS.md"],
    providers: ["provider.refero"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.experience.onboarding-conversion",
    title: "Onboarding conversion",
    domainId: "domain.experience",
    areaIds: ["area.product-experience"],
    trigger: "Before onboarding quizzes, review-prompt timing, paywall timing, or first-session activation",
    instructions:
      "Design the screen-by-screen onboarding sequence in product/ONBOARDING.md — purpose, question/copy, state, visual asset, animation, and analytics event per screen — so the user sees the 11-star V1 slice's magic before being asked for payment, long setup, or sensitive data. Place the native App Review popup and the push-permission soft-prime at the first-value moment, but never in the same session step as each other (value moment claims one; the other waits for the next earned moment per push-notification-lifecycle.md), and sequence the Commitment (first goal question), Perceived Effort Delay (plan/result generation), and Intent Mirroring (immediately pre-paywall, never on the paywall or cancel screen) card triggers against that same moment. Pull the final on-screen words from product/copy/COPY_DECK.md by key — check:app-copy fails a flow whose deck rows are missing or still placeholder-shaped — and confirm the onboarding curve crosses positive before the paywall, not just that a paywall exists.",
    reads: ["design/design.md", "product/experience/11-star-experience/11_STAR_EXPERIENCE.md", "analytics/ANALYTICS.md", "product/copy/COPY_DECK.md"],
    referenceIds: [
      "reference.experience.onboarding-conversion",
      "reference.experience.push-notification-lifecycle",
      "reference.experience.eleven-star-experience",
    ],
    roleId: "role.product-leader",
    laneIds: ["onboarding"],
    phaseIds: ["phase.1c", "phase.2"],
    dependencies: ["workflow.data.analytics-and-attribution-blueprint", "workflow.experience.11-star-experience"],
    outputPaths: ["product/ONBOARDING.md", "product/onboarding.html"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.design.premium-mobile-craft",
    title: "Premium mobile craft",
    domainId: "domain.design",
    areaIds: ["area.product-experience"],
    trigger: 'Before in-app UI build/polish, press-state/haptics/loading-empty wiring, or "premium feel"',
    instructions:
      "Wire the five invisible premium details into every screen — press states with the press spring family (response 0.3-0.4, damping 0.7-0.8, PremiumMotion.press), subtle motion, semantic haptics, keyboard behavior, and loading/empty states — using PremiumCraft.swift on SwiftUI (React Native/Flutter parity via the same DesignTokens.Motion tokens) as the primary target, honoring Reduce Motion throughout. Never hand-type a spring literal in view code: read the preset layer, and reserve the celebrate family (response 0.45-0.5, damping 0.5-0.7) for celebrations and earned-object reveals only — a celebrate-grade spring on an ordinary state change is as wrong as a flat ease on a celebration. When a surface needs stronger direction than the five details give (celebration choreography, gesture physics, hero transitions), route to motion-craft-benchmarks.md's numbered recipes for the checkable acceptance criteria; check:motion-contract is what proves the tokens were actually used, not adjectives in design/design.md.",
    reads: ["design/design.md", "studio/seed/business.json", "studio/seed/theme.tokens.json"],
    // UX_PATTERNS.md is a consult, not a read: its producer (ux-patterns-refero) can park
    // indefinitely on paid-tool routing, and design/design.md sits upstream of half the launch —
    // premium craft must not stall the graph waiting for optional pattern evidence.
    consults: ["product/experience/ux-patterns/UX_PATTERNS.md"],
    referenceIds: ["reference.design.premium-mobile-craft", "reference.design.motion-craft-benchmarks"],
    roleId: "role.design-guru",
    laneIds: ["design"],
    // lane.design's own dependencyIds chain (catalog/lanes.ts) implies this waits on
    // lane.product; every sibling domain.design workflow gets that transitively through
    // design-room-state-mutate-version-render, and this one previously had no
    // `dependencies` at all, so it was frontier-eligible before a spec or design state
    // existed (routing-depth audit, 2026-08-07).
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
    referenceIds: [
      "reference.design.remotion-content-assets",
      "reference.design.design-visual-system",
      "reference.process.tool-recipes.visual-and-motion-production",
    ],
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
      "Before any founder-facing or marketing copy ships, identify which voice you are protecting — this skill's own direct/no-filler voice for founder-facing surfaces, or the launched business's strategy/BRAND.md voice and the tone 11_STAR_EXPERIENCE.md set for marketing copy — and make the minimum effective edit: strip filler, hedging, and importance-inflation without flattening a brand's playful or clinical register into generic 'clean' English. Author every user-facing string as a keyed row in product/copy/COPY_DECK.md (with product/copy/COPY_BRIEF.md as the brief that precedes it) before any builder consumes it — builders read deck keys, they do not invent strings from the spec. Run the banned-words/patterns self-check and channel-specific limits (store character counts, push/email subject limits) before handoff; check:app-copy is the gate that fails a placeholder-shaped or missing deck row.",
    reads: ["strategy/BRAND.md", "product/experience/11-star-experience/11_STAR_EXPERIENCE.md"],
    referenceIds: ["reference.words.no-slop-writing", "reference.words.conversion-copy"],
    roleId: "role.copy-specialist",
    outputPaths: ["product/copy/COPY_BRIEF.md", "product/copy/COPY_DECK.md"],
    gates: ["check:app-copy"],
    actionClass: "draft",
    idempotent: true,
  }),
] as const;
