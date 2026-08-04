# Look And Feel

Brand, visual system, motion, screens, and the workflow that turns design decisions into something you can look at.

Load the row whose trigger matches the work in front of you. Do not preload the set — each file is a full lane reference.

| Load when | Reference | Produces / gate |
| --- | --- | --- |
| designing, versioning, baselining, restoring, wiping, or rendering B2C design state; custom product page, PPO, In-App Event, landing, onboarding, paywall, or marketing-surface proposals; whenever a design output would otherwise be freeform | [`design-room.md`](design-room.md) | mutated `state/`, `render-design-room.ts` output · `check:design-room`, `validate:design-state` |
| creating or changing `design/DESIGN.md`, lowercase `design.md`, visual systems, UI mockups, generated visual concepts, Higgsfield-backed visuals/motion/icons/mascots, mobile screen specs, App Store creative, screenshot frames, design audits, or HTML visual artifacts | [`design-visual-system.md`](design-visual-system.md) | `strategy/BRAND.md`, `design/DESIGN.md`, `design.md`, `design/design.html`; accepted decisions cascade into docs and assets · `check:token-promotion` |
| before building or animating any landing page, funnel page, or web marketing surface | [`landing-motion-craft.md`](landing-motion-craft.md) | real text always renders, reduced-motion collapse, no LCP gating, tokens not magic numbers · `check:landing-funnel` |
| working on motion craft benchmarks | [`motion-craft-benchmarks.md`](motion-craft-benchmarks.md) | — |
| building or polishing in-app UI; wiring press states, animation, haptics, keyboard, loading/empty states; any "premium feel" request | [`premium-mobile-craft.md`](premium-mobile-craft.md) | ships `business/design/system/PremiumCraft.swift` (SwiftUI, with React Native and Flutter parity) |
| designing, versioning, baselining, restoring, wiping, or rendering B2C design state; custom product page, PPO, In-App Event, landing, onboarding, paywall, or marketing-surface proposals; whenever a design output would otherwise be freeform | [`quality-lens.md`](quality-lens.md) | mutated `state/`, `render-design-room.ts` output · `check:design-room`, `validate:design-state` |
| before using Refero, replacing Refero with a free pattern route, creating `UX_PATTERNS.md`, drawing web/mobile flow maps, or auditing pattern coverage | [`refero-ux-patterns.md`](refero-ux-patterns.md) | `UX_PATTERNS.md` · `check:ux-patterns` |
| replacing Higgsfield with Remotion; scaffolding a Remotion project; code-rendered videos/stills; app-preview clips; social/ad/content variants; any "local rendered assets are ready" claim | [`remotion-content-assets.md`](remotion-content-assets.md) | `CONTENT_ASSETS.md`, `content-assets.html`, `manifest.json` · `check:content-assets` |
| designing, versioning, baselining, restoring, wiping, or rendering B2C design state; custom product page, PPO, In-App Event, landing, onboarding, paywall, or marketing-surface proposals; whenever a design output would otherwise be freeform | [`surfaces-b2c.md`](surfaces-b2c.md) | mutated `state/`, `render-design-room.ts` output · `check:design-room`, `validate:design-state` |
