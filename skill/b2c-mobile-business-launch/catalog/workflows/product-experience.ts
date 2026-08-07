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
 * `premium-mobile-craft`, whose real distinctive output is `design/DESIGN.md`.
 */
export const workflows = [
  workflow({
    id: "workflow.product.app-archetype-detection-and-starter",
    title: "App-archetype detection & starter",
    domainId: "domain.product",
    areaIds: ["area.product-experience"],
    trigger: "Request matches a known product shape (social / AI-chat / habit / photo-AI)",
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
    laneIds: ["design"],
    phaseIds: ["phase.2"],
    dependencies: ["workflow.process.launch-trace-and-build-contracts"],
    outputPaths: ["studio/seed/business.json", "studio/seed/theme.tokens.json", "design/design-room.html"],
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
    laneIds: ["design"],
    // lane.design's own dependencyIds chain (catalog/lanes.ts) implies this waits on
    // lane.product; every sibling domain.design workflow gets that transitively through
    // design-room-state-mutate-version-render, and this one previously had no
    // `dependencies` at all, so it was frontier-eligible before a spec or design state
    // existed (routing-depth audit, 2026-08-07).
    dependencies: ["workflow.design.design-room-state-mutate-version-render"],
    // product/experience/ux-patterns/UX_PATTERNS.md dropped: workflow.design.ux-patterns-refero
    // is its dedicated producer (see file header).
    outputPaths: ["design/DESIGN.md"],
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
    outputPaths: ["product/copy/COPY_BRIEF.md", "product/copy/COPY_DECK.md"],
    gates: ["check:app-copy"],
    actionClass: "draft",
    idempotent: true,
  }),
] as const;
