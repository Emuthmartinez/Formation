# Design System And HTML Visual Proofs

Use this reference before any brand, UI, screenshot, landing-page, paywall, onboarding, or generated-app handoff work. The goal is to make visual decisions durable for agents and inspectable by humans.

Read `design/design.md` before you change a user-facing surface. This file contains the design intent.

Read `studio/seed/business.json` for the surface inventory. Read `studio/seed/theme.tokens.json` for exact values.

Do not create a second visual-system document. Update the contract and structured sources in one change.

## Contents

- Source Tooling
- Routing Order
- Required Artifacts
- Naming Contract
- Higgsfield Production Routing
- HTML Implementation Rules
- Design Gates
- Common Failures

## Source Tooling

Treat these repositories as live source material when the work depends on their details:
- Google Labs `design.md`: `https://github.com/google-labs-code/design.md`
- Impeccable: `https://github.com/pbakaus/impeccable`
- Taste Skill: `https://github.com/Leonxlnx/taste-skill`
- Layers Skills: `https://github.com/jamiemill/layers-skills`
- Refero MCP and Refero Styles: `https://doc.refero.design/llms.txt`, `https://api.refero.design/mcp`, `https://styles.refero.design/`
- Higgsfield local skills: `higgsfield-generate`, `higgsfield-product-photoshoot`, `higgsfield-soul-id`, `higgsfield-marketplace-cards`
- ui-ux-pro-max skill (senior-grade UI generation: 67 styles, 161 palettes, 57 font pairings, 99 UX guidelines, framer-motion/Magic UI motion patterns, and anti-pattern/pre-delivery checklists; MIT-licensed, reference-only — invoke it or adapt its guidance, do not copy its CSV data into this repo or business repos): `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`
- Motion (framer-motion's successor package, `motion/react`) for web-surface animation driven by the tokenized motion scale: `https://motion.dev/docs/react`. For landing/funnel sections, load [`landing-motion-craft.md`](./landing-motion-craft.md) and start from the `business/growth/landing/` section library instead of improvising choreography.
- 60fps.design (X @60fpsdesign) — curated catalog of in-app interaction details from best-in-class consumer apps; the in-app inspiration benchmark, counterpart to motionsites.ai on the landing lane. Use it through [`motion-craft-benchmarks.md`](./motion-craft-benchmarks.md), which distills it into numeric, checkable recipes on the token scale: `https://60fps.design/`. When the 60fps.design MCP server is connected (`https://60fps.design/mcp`), the catalog is queryable live — shot search, per-shot motion breakdowns, and SwiftUI starter code; that reference's Live Catalog Access section states the tools and the token-rewrite rule for generated code.

If matching local skills are installed, load and use them. If Refero or Higgsfield is unavailable, load `paid-tool-routing.md` and ask before replacing it with local HTML/CSS/SVG/canvas, founder-owned assets, public-domain assets, public UX pattern libraries, bundled pattern templates, or real app screenshots. If the design-system source skills are not installed, apply the source workflow directly and cite the repository URL in the design notes.

## Routing Order

1. **Trace and experience first.** Load `flow-traceability.md` and `eleven-star-experience.md`; identify the research/product trace rows, magical moment, line of feasibility, and V1 scalable slice the brand and visual system must express.
2. **Layers first when product clarity is weak.** Use Layers-style thinking to verify observed behavior, domain language, user needs, product strategy, conceptual model, interaction flow, and surface decisions before locking screens.
3. **Refero or baseline UX patterns for real flow shape.** Use `refero-ux-patterns.md` to study styles, screens, and flows before locking interaction structure. If Refero is unavailable, use the bundled `business/product/experience/ux-patterns/` pack only after founder-approved fallback routing.
4. **Canonical design contract.** Produce `design/design.md`. Keep intent, screens, states, and implementation rules in this file.
5. **Taste for direction.** Derive the identity from the audience first with [`audience-derived-identity.md`](./audience-derived-identity.md). It turns `strategy/RESEARCH.md` facts into palette/type/motion/imagery decisions and names the generic-template tells. Record the result in `design/design.md`'s Audience And Identity section; `check:design-room` requires it. Then apply this skill's own [`quality-lens.md`](./quality-lens.md) Anti-Generic Checks — it is the in-repo, concrete taste contract with a Review Prompt built for exactly this step. Then use Taste-style review (Source Tooling above) to avoid generic output, set variance/motion/density, and choose a design language that fits the category instead of default SaaS patterns.
6. **Impeccable for audit and polish.** Use Impeccable-style checks for typography, color/contrast, spatial design, motion, interaction states, responsive behavior, and UX writing.
6a. **Premium craft for in-app feel.** Load [`premium-mobile-craft.md`](./premium-mobile-craft.md) before building or polishing in-app UI. It carries the five invisible details — press states/spring physics, subtle motion, haptics discipline, keyboard behavior, and loading/empty states — and ships them as SwiftUI boilerplate (`business/design/system/PremiumCraft.swift`) with React Native and Flutter parity, all reading `DesignTokens.Motion` and honoring Reduce Motion. When a surface needs celebration choreography, shared-element continuity, or gesture physics beyond the five details, it routes to [`motion-craft-benchmarks.md`](./motion-craft-benchmarks.md) for the numeric recipe layer.
7. **Higgsfield for visual production.** Use Higgsfield for generated visuals, mockups, app icons, mascots, brand imagery, screenshot art, demo videos, onboarding animation clips, ad creative, and UGC/presenter videos unless production assets already exist.
8. **Fallback only after confirmation.** If Refero, Higgsfield, or another paid visual/UX tool is unavailable, get founder confirmation before using the free/local route and label limitations in `strategy/TOOL_DECISIONS.md`.
9. **HTML proof before handoff.** Render the visual system, UX pattern board, and key screens in HTML using the same tokens. Do not leave visual work only as Markdown, screenshots, Figma notes, or generated images.

## Required Artifacts

### `design/design.md`

Use `design/design.md` as the only design contract. It must contain:

- Product experience and anti-patterns
- Visual direction and semantic token references
- Surface inventory and navigation model
- Screen states, copy keys, analytics hooks, and proof paths
- Onboarding, motion, haptics, and reduced-motion behavior
- Landing, icon, store, ad, and lifecycle marketing direction
- Accessibility and implementation rules

Validate when possible:

```bash
npx @google/design.md lint design/design.md
```

If the CLI is unavailable or the package registry fails, record the exact blocker and manually check token references, contrast, section order, and duplicate headings.

### `design/design.html`

Create a rendered proof that uses the design system, not a separate visual language. It should include:
- token swatches, type specimens, spacing/radius examples, motion samples, and component states
- mobile app frames for the main product sequence and edge states
- responsive landing/funnel/legal/support/page examples when the launch includes web surfaces
- App Store/Play screenshot concepts when store creative is in scope
- generated images or external assets embedded with `direction`, `draft`, or `production` labels
- source notes for image/model/reference inputs and any license or permission caveats

All visual artifacts created by this skill should appear in HTML. This includes brand books, asset boards, icon directions, mascot sheets, onboarding storyboards, screenshot frames, paywall explorations, landing sections, and app-screen mocks.

### `UX_PATTERNS.md` And `ux-patterns.html`

Use `UX_PATTERNS.md` for the product-specific pattern inventory and flow decisions. It must include:
- Refero route: docs checked, MCP availability, query pack, selected style/screen/flow records, and what each changed
- founder-approved fallback route when Refero is unavailable, with limitations and the bundled baseline patterns used
- pattern inventory for onboarding, signup/login, permissions, paywall, restore purchases, settings/account, support/privacy/legal, empty/loading/error/offline, search/filter, referral/share, and account deletion when relevant
- flow maps that preserve the onboarding conversion playbook in `onboarding-conversion.md`
- state matrix and bug traps for each critical flow
- source ledger that summarizes references instead of copying paid screenshots or protected material into the repo

Render the same material in `ux-patterns.html` or inside `design/design.html` so the founder can inspect the flow architecture visually.

## Naming Contract

Use only `design/design.md` as the design contract. Do not create a root `design.md` or `design/DESIGN.md`.

If a target repo uses `DESIGN_SYSTEM.md`, make it an appendix. It must defer to `design/design.md`.

## Higgsfield Production Routing

Before generating assets, translate `design/design.md` into the generation brief: palette names and hexes, type mood, shape/radius language, illustration style, motion energy, forbidden aesthetics, and intended surface.

The Higgsfield skill/model routing, media preflight steps, and asset-labeling rules are the canonical recipe body in [`tool-recipes/visual-and-motion-production.md`](../process/tool-recipes/visual-and-motion-production.md) — load that section rather than a second, drifting copy here.

**App Icon Direction Batch.** Before locking an app icon direction: check the `icon_style` token in `design/design.md`. If the style is `character`, `cartoon`, or `mascot`, route to `nano_banana_2` or `nano_banana_pro`; otherwise route to `gpt_image_2`. Produce a minimum 3-concept batch before direction lock. See the **Cheap-First Direction** recipe in `tool-recipes/visual-and-motion-production.md` for the z_image draft → production-model run workflow. Cheap-first is offered only as a spend-reduction option at the `paid-tool-routing.md` spend-confirmation prompt — never applied silently.

## Motion: Web Surfaces vs Mobile Binary

Motion is a tokenized, cross-platform contract. Values live once in `studio/seed/theme.tokens.json` under `motion.*` (`durationFast`, `durationBase`, `durationSlow`, `reducedMotionDuration`, `easing`) and promote to `design/system/tokens.css` (`--motion-*` variables) and `DesignTokens.Motion` in `DesignTokens.swift`. `promote-design-tokens.ts` writes them and `check-token-promotion.ts` gates them.

Where each tool applies:

- **Web surfaces ship motion.** Landing pages, marketing funnels, web paywall, and the Design Room app (`studio/app/src/`) animate with framer-motion / the `motion` library (`import { motion } from "motion/react"`), reading durations from the promoted `--motion-*` variables. This is the natural home for framer-motion and for `ui-ux-pro-max`'s Magic UI / motion patterns (staggered reveals, `AnimatePresence`, `whileTap`, layout transitions).
- **The shipped mobile binary does not use framer-motion.** SwiftUI uses `DesignTokens.Motion` with `.animation`; Flutter uses implicit/explicit animations; React Native uses Reanimated/Moti. All read the same token values so motion stays consistent across web and app.
- **Reduced motion is mandatory everywhere.** Honor `prefers-reduced-motion` on web (`useReducedMotion()` plus reduced-motion CSS) and OS reduce-motion on device; degrade to opacity-only or instant changes and never block first paint on an animation.
- **`ui-ux-pro-max` is reference-only (MIT).** Invoke the skill or adapt its motion/anti-pattern guidance (smooth 150-300ms transitions, visible focus states, reduced-motion support). Do not copy its CSV datasets into templates or business repos; independently authored WCAG values are fine. Capture the adapted recommendation in `state.designBrief` (schema-backed; seed it with `npm run seed:design-brief`).
- **`check:template-safety` guards the boundary.** It fails CI if framer-motion / `motion` is imported from a shipped template code file, because that import would break a launched Flutter/SwiftUI repo. Keep framer-motion in `render/` and web surfaces only.

## HTML Implementation Rules

- Use CSS variables derived from `design/design.md` token names.
- Keep the HTML self-contained unless the target repo already has an asset pipeline.
- Build mobile-first frames with stable dimensions and responsive desktop variants where relevant.
- Avoid placeholder-only UI. Real copy, real state labels, and realistic content density expose design problems earlier.
- Do not hide important visuals in remote-only assets. If images are required, embed local assets or include clear fallbacks.
- Use accessible text, semantic structure, alt text for meaningful images, focus states, reduced-motion CSS, and contrast checks.
- Serve locally for browser validation when the tool cannot open `file://` URLs. Choose an open port and record it in the verification notes.

## Design Gates

Before moving to ASO, landing implementation, or builder handoff:
- `state/LAUNCH_TRACE.md` shows which research/product decisions the visual system expresses.
- `11_STAR_EXPERIENCE.md` and `11-star-experience.html` show the product's magical moment and V1 scalable slice before screens are locked.
- `design/design.md` exists and is the token source of truth.
- `design/design.md` maps screens to tokens, states, analytics hooks, and HTML proof paths.
- `UX_PATTERNS.md` exists, records Refero or founder-approved fallback research, and preserves the onboarding playbook.
- `ux-patterns.html` or a dedicated `design/design.html` section renders the pattern inventory, flow maps, and state matrix.
- `design/design.html` or equivalent loads locally and shows mobile plus relevant desktop states.
- mobile and desktop visual checks pass for text fit, overlap, contrast, tappable size, and responsive framing.
- Impeccable/Taste/Layers routing is documented: which checks were used, skipped, or blocked.
- generated visuals are labeled as direction or production, with source and permission caveats.

## Copy Rewrites And Brand-Owned Vocabulary

Before rewriting any landing page, onboarding, paywall, or in-app copy, check two documents in this order:

1. **`strategy/BRAND.md` owned-words list and `design/design.md` §7 calibration set (or equivalent).** These sections define phrases that belong exclusively to the product's brand voice. Do not replace, rephrase, or delete them unless the founder has explicitly approved a brand-voice change. Scanning for third-party IP risk is not a license to rewrite owned vocabulary.

2. **Third-party IP risk scan scope.** IP risk scanning covers only: names of third-party frameworks, SDKs, companies, or products presented as if they are the app's own capability; phrases from competitor marketing or product copy; trademarked terms used in a confusing or endorsing way. It does not cover product-specific metaphors, brand names, or calibrated copy phrases the app owns.

Rule: if a copy change removes or alters a phrase that appears in `strategy/BRAND.md` or `design/design.md` calibration set, that change must be flagged as out-of-scope for IP scanning and requires founder approval before the rewrite is applied.

## Locked Production Design

When native production code — a SwiftUI component library, a Flutter widget package, a React Native design-system package, or equivalent locked implementation — is the founder's canonical visual source, these rules apply before any design audit, asset generation, or doc update:

**Establishing the lock.** A production native implementation is canonical when the founder explicitly says so ("this component is locked", "don't change the character geometry", "the existing app look is final") or when a named source file (e.g. `OchoComponents.swift`, `AppCharacter.kt`) is described as the truth for geometry, palette, or animation. Record this in `design/design.md` as a `visual_lock` block:

```yaml
visual_lock:
  status: locked
  canonical_source: "path/to/LockedComponent.swift"   # or equivalent
  locked_by: "founder"
  locked_date: "YYYY-MM-DD"
  locked_properties:
    - geometry
    - palette
    - animation
  generated_asset_role: "concept-only"
```

**Generated assets are concept-only when a lock exists.** Generated outputs after a visual lock are `concept` or `direction` assets. If `design/design.md` calls one a canonical target, correct it before handoff.

**`CONTENT_ASSETS.md` manifest status.** When a visual lock is in effect, any generated asset in `growth/content-assets/manifest.json` must use `status: concept`, `status: direction`, or `status: draft` — never `status: production` or `status: approved` for a field (`truth_constraints`) that conflicts with the locked native implementation.

**Audit scope for a locked production character.** When auditing Higgsfield or other generated assets against a locked native implementation:
- Do not spend time adjusting generated outputs to match the locked native design; treat the native code as ground truth.
- Flag only genuine gaps where the generated assets would mislead a builder into ignoring the locked native geometry, palette, or animation.
- Correct any docs that assign canonical status to generated assets and record the correction in `state/PROJECT_STATE.yaml`.
- Do not propose re-generating assets to narrow the gap; ask the founder whether the generated assets are still needed as concept references.

**Failure card.** Raise `design-canonical-conflict` when any of these conditions exist:
- `design/design.md` labels a generated asset as a canonical visual target and native production code exists.
- `CONTENT_ASSETS.md` manifest lists a generated asset as `production` or `approved` when the native implementation is locked.
- A design-guru or audit subagent spent more than one iteration comparing generated assets to locked native code without correcting the doc conflict first.

## Common Failures

- `DESIGN_SYSTEM.md` and `design/design.md` disagree; fix by making `design/design.md` canonical and reducing the other doc to an appendix.
- screenshot or landing visuals look good as images but are impossible to build because tokens/components were never specified.
- generated images carry the brand while the actual app UI stays generic; require HTML app frames using the same design language.
- Phase 2 jumps straight to surface style even though user needs, conceptual model, or flow are unresolved; run Layers-style orientation first.
- no browser/mobile proof exists, so cramped copy, broken contrast, and clipped controls are discovered during implementation or store screenshot production.
- copy rewrite sweeps that target IP risk also alter brand-owned phrases from `design/design.md` calibration set or `strategy/BRAND.md`; scope IP-risk sweeps to third-party names only and preserve owned vocabulary.
- `design.md` calls Higgsfield-generated assets "canonical visual targets" while a locked native component library is the true canonical source; correct the doc before auditing assets, not after.
