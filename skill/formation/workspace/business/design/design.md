# Product Design Contract

Status: not started

This file explains the approved design decisions for the product. Every person or agent who changes a user-facing surface must read it first.

## Source Ownership

- `design/design.md` owns design intent, interaction rules, and cross-surface guidance.
- `studio/seed/business.json` owns the structured surface inventory and its status.
- `studio/seed/theme.tokens.json` owns exact visual and motion values.
- `design/system/` contains promoted token output. Do not edit that output by hand.
- `design/design-room.html` shows the current state and tokens to the founder.

Do not copy token values into this file as a second source of truth. Name the semantic token instead.

## Product Experience

Describe the product feeling in one sentence. Name the user goal that the design serves. Name the one V1 moment that must feel exceptional.

### Experience principles

1. Define the first principle and the user behavior it protects.
2. Define the second principle and the trade-off it resolves.
3. Define the third principle and the quality it makes visible.

### Experience to avoid

List the visual clichés, interaction traps, false claims, and category conventions that this product must not copy.

## Audience And Identity

Every visual decision derives from the target user in `strategy/RESEARCH.md`, not from a trend or a template default. Name the audience facts, then trace the decisions to them. The derivation chain and the generic-design tells live in the audience-derived-identity design reference.

- Who the user is and what they aspire to feel or be seen as, with the `strategy/RESEARCH.md` evidence rows.
- The 2-3 apps this audience already loves, and the visual codes those set.
- The category convention this product follows, the one it breaks, and the stated reason for each.
- Anti-references: 2-3 named aesthetics or apps this product must not resemble.
- The one physical or sensory metaphor the identity is built on.

| Audience fact | Decision it produced | Token or direction | Evidence |
| --- | --- | --- | --- |
| Not defined | Not defined | Not defined | Not captured |

Logo-swap test: strip the wordmark from five screens and state whether the target user would still recognize their app. Record the result in the Decision Log when the direction is accepted.

## Reference Evidence

Complete this evidence pass before a design mutation. Triage every source. Open only the sources that fit the decision. Use two complementary sources for onboarding, a paywall, the core loop, an AI trust surface, or the first frames of a store listing.

Change classification: Not defined
Change scope: Not defined

Use `small token-preserving correction`, `new or materially changed surface`, or `high-impact or high-risk surface` for the change classification. Name the affected surface or decision in the change scope.

| Source | Status | Why | Query or pattern | Evidence date |
| --- | --- | --- | --- | --- |
| 60fps.design | Not reviewed | Classify motion, transition, gesture, loading, success, and magical-moment needs. | Not defined | Not recorded |
| catalogue.projectsbyif.com | Not reviewed | Classify AI, automation, trust, consent, sign-in, permission, data, and recovery needs. | Not defined | Not recorded |
| abtest.design | Not reviewed | Classify conversion, onboarding, paywall, checkout, retention, and referral hypotheses. | Not defined | Not recorded |
| Design Spells | Not reviewed | Classify delight, personality, empty-state, success-state, and micro-interaction needs. | Not defined | Not recorded |
| UXSnaps | Not reviewed | Classify journey, hierarchy, onboarding, dashboard, and content-discovery critique needs. | Not defined | Not recorded |
| UI Playbook | Not reviewed | Classify standard component, state, focus, keyboard, and accessibility needs. | Not defined | Not recorded |

Use only `required`, `not applicable`, or `unavailable` for an authored status. Give a reason. Treat an experiment result or breakdown as a hypothesis until local evidence supports it.

| Surface or decision | Source | Observation | Adopt or reject | Adaptation | State path | Validation | Surface key |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |

## Visual Direction

Describe the visual idea with concrete nouns and verbs. Explain how it differs from the closest products in the category.

- Color roles: reference `color.*` tokens and explain their jobs.
- Type roles: reference `font.*` tokens and explain hierarchy.
- Shape and depth: reference `radius.*`, border, and shadow tokens.
- Spacing and density: reference `space.*` tokens and state the density rule.
- Imagery: state the subject, crop, treatment, source, and rights rule.
- Iconography: state the family, stroke or fill rule, optical size, and app-icon concept.

## Interaction System

### Core loop

Describe the shortest path from intent to value. State the dominant action at each step.

### Screen and state matrix

| Surface | User job | Primary action | Empty | Loading | Success | Error or offline | Copy keys | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| First product surface | Not defined | Not defined | Not defined | Not defined | Not defined | Not defined | Not defined | Not captured |

Every implemented surface must appear in `studio/seed/business.json`. The row and the structured state must describe the same user job and status.

### Onboarding

Define each onboarding beat, its exit path, the value shown before permission or payment, and the copy keys it uses. State whether each step is optional, skippable, or required.

### Motion and haptics

Use `motion.*` tokens for timing and easing. Define the purpose, trigger, interruption behavior, and reduced-motion result for each important motion.

| Moment | Purpose | Token or preset | Haptic | Reduced-motion result |
| --- | --- | --- | --- | --- |
| First-value moment | Not defined | Not defined | Not defined | Not defined |

### Live-surface effects

Use a live effect only when it explains a real state or relationship. Do not add one only to make a surface look active.

| Surface | Real state or relationship | Recipe | Visible or semantic signal | Stop condition | Reduced-motion result | Low-power fallback |
| --- | --- | --- | --- | --- | --- | --- |
| Not defined | Not defined | R15, R16, R17, R18, or none | Not defined | Not defined | Not defined | Not defined |

Thinking orbs show indeterminate AI activity. They do not show progress. Beams and metal rings do not replace focus, selection, or purchase disclosures.

### Card motion spec

| Card moment | Motion contract | Reduced-motion result |
| --- | --- | --- |
| Commitment echo | Use `motion.durationFast` for the confirmation fade. | Show the confirmation without movement. |
| Perceived Effort | Use `motion.durationFast` for real step changes and a celebrate-family final reveal. | Show the real progress count and final result without movement. |
| Variable Reward | Use `motion.durationBase` for anticipation and a celebrate-family reveal. | Show the result immediately with a static badge. |
| Intent Mirror | Use `motion.durationReveal` for the entrance. | Show the user's words immediately as static text. |

Web surfaces use promoted CSS motion tokens. Native apps use platform-native animation. Do not import a web motion library into a native app.

## Cross-Surface Direction

The product promise and visual idea must remain consistent. Adapt composition and copy length to each surface.

| Surface family | Required design decision | Required state | Proof |
| --- | --- | --- | --- |
| App UI | Screen hierarchy, states, feedback, accessibility | `surfaces.mobileApp` | Real or faithful running-app capture |
| Onboarding | Sequence, optional routes, value moment, permission timing | Mobile screens and flows | Complete first-run recording |
| Landing and web funnel | Message hierarchy, mobile CTA, proof, responsive behavior | `surfaces.landingPages` and `surfaces.webFunnels` | Mobile and desktop render |
| App icon | Distinct silhouette, small-size contrast, rights basis | `surfaces.marketingAssets` | 1024px master and thumbnail test |
| Store creative | Screenshot story, truthful UI, locale and device plan | `surfaces.appStore` | Export board and store-size files |
| Ads and social | Hook, first frame, product visibility, claim boundary | `surfaces.marketingAssets` | Rendered asset and source manifest |
| Lifecycle marketing | Brand layout, accessible email or push treatment | Relevant marketing asset | Test render or device capture |

## Accessibility

- Use text and control contrast that meets the selected WCAG target.
- Support Dynamic Type or the platform equivalent.
- Keep controls at the platform minimum target size.
- Preserve meaning without color, motion, sound, or haptics.
- Define focus order, labels, and error announcements for each interactive flow.

## Implementation Rules

- Read this file before work on UI, onboarding, motion, landing, icons, store creative, ads, or marketing surfaces.
- Read `studio/seed/business.json` for the exact surface list and status.
- Read `studio/seed/theme.tokens.json` for exact values.
- Update structured state before the design contract when a surface changes.
- Update this file in the same change when the mutation changes design intent or implementation guidance.
- Render `design/design-room.html` after the mutation.
- Run the design state, Design Room, and token promotion checks before handoff.

## Decision Log

| Date | Decision | Reason | State paths | Affected surfaces | Evidence |
| --- | --- | --- | --- | --- | --- |
| Not recorded | Initial contract needs product-specific decisions. | The starter does not invent a brand. | `studio/seed/business.json` | All | Not captured |
