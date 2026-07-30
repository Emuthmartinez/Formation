# Brainstorm: motionsites-grade landing motion as a skill lane

Date: 2026-06-13
Status: **implemented** (founder greenlit the full change-set 2026-07-07; shipped as v0.15.0 — `playbook/design/landing-motion-craft.md`, `templates/landing/`, the landing motion-token promotion, the `check:landing-funnel` motion-craft gates, and the `landing-motion-progressive-enhancement-missing` LaunchBench scenario)
Compound Engineering note: CE tooling (`ce-brainstorm`/`ce-plan`/`ce-work`) is unavailable in this cloud session; per `playbook/engineering/engineering-orchestration.md` §1b this design pass is the Standalone Engineering Loop equivalent (plan → bounded slice → adversarial review via the existing validators → proof via `npm run audit:ci`). The proof artifact is committed; the validator/eval/template work below is scoped but deliberately not yet written, because the founder asked to "practice making some here and **see if we can match the level of quality** to abstract it into a skill" — i.e. evaluate first, then abstract.

## The ask

> How can we use Remotion or other animation tools to make the landing sites this skill deploys more like motionsites.ai / motionsites.ai/sections — practice making some here, see if we can match the quality, then abstract it into a skill.

## What motionsites.ai actually is (technique inventory)

It is a gallery of **animated landing-page _sections_** ("copy, paste, launch") spanning SaaS / agency / fintech / web3 / portfolio looks. The motion vocabulary, cataloged from the site:

| Section type | Signature motion |
| --- | --- |
| Hero | gradient-mesh / video backgrounds (they serve them via Mux), scroll parallax, cinematic word reveals |
| Features | scroll-reveal **stagger**, "liquid glass" tabs |
| Pricing | glassmorphic cards, animated billing toggle |
| Testimonials | radial/orbit diagrams, scroll reveals |
| Cards / bento | hover tilt, stagger, bento stat grids, sticky cards |
| CTA | mouse-trail / cursor spotlight, glassmorphism, gradient morph |
| Marquee | seamless infinite scroll |
| Footer / forms | reveal-on-enter, interactive validation |

Cross-cutting: **dark-mode + glassmorphism + gradient morphing + scroll-triggered choreography + cursor-following interaction + 3D transforms**. Delivery stack they expose: **Mux** (animated/video previews) + **Cloudinary** (stills) + a **Bolt.new** "edit the code" handoff. No proprietary runtime — these are standard web techniques (scroll-linked + in-view animation, CSS gradients/filters, transforms).

## The honest answer on tooling: Remotion is the wrong primary tool here

The premise "use Remotion to make landing sites more animated" mostly mis-routes. The skill already draws the right line (in `playbook/design/remotion-content-assets.md` and `playbook/growth/geo-seo.md` §3a) and the motionsites teardown confirms it:

- **Remotion renders _frames_ → video/stills.** It is deterministic, off-line, frame-driven (`useCurrentFrame`/`interpolate`/`spring`). It is excellent for assets you _bake once and embed_: ad creative, app-preview clips, store art — and, relevant here, **the looping hero background video** (exactly the Mux-served loops motionsites uses) and section "media" tiles. Render once → ship an `.mp4`/`.webm` with a poster.
- **Remotion cannot drive _live_ scroll/hover/cursor interaction.** Scroll-linked reveals, sticky scrollytelling, parallax, 3D tilt, cursor spotlight, marquee, count-up — these are live-DOM behaviors. They belong to **`motion` (`motion/react`, framer-motion's successor)** + a scroll primitive, already the skill's mandated web-surface library.

So the real architecture is the **two-lane content model the skill already names**, made concrete for landing craft:

```
            ┌────────────────────────────────────────────┐
            │  shared motion tokens (--motion-*, easings) │  ← one brand feel
            └───────────────┬───────────────┬─────────────┘
                            │               │
        Remotion lane  ◄────┘               └────►  motion/react lane
   (bake & embed)                                  (live choreography)
   • hero loop .webm/.mp4 + poster              • whileInView stagger reveals
   • section media tiles, ad/store art          • useScroll/useTransform parallax
   • deterministic, license-gated               • sticky scrollytelling, count-up
                                                 • cursor spotlight, 3D tilt, marquee
```

The "wow" of motionsites is ~85% the **live** lane and ~15% the **baked** lane. Today the skill ships neither as a reusable section library — that is the gap.

## Gap analysis — where the skill currently undershoots

1. **No section library.** `templates/` has design/onboarding/store HTML proofs but **no landing-page section catalog**. Landing pages are improvised per launch; `check-landing-funnel.ts` even fingerprints an **Alpine.js + static HTML** funnel (CSP gate), i.e. the current floor is a simple form page, not a motionsites-grade site.
2. **Motion doctrine is tuned for in-app micro-motion, not cinematic web.** `design-system/tokens.css` tops out at `--motion-duration-slow: 360ms` with one easing. Correct for the shipped binary; too short/flat for hero word-reveals and scroll choreography. There is no expo-out / spring easing and no stagger token for web.
3. **Landing validator checks plumbing, not craft.** `check-landing-funnel.ts` enforces deploy gates, GEO/SEO files, copy compliance, waitlist idempotency — **zero** checks on motion quality, reduced-motion fallback, or that animation didn't gate LCP/hide text from crawlers.
4. **The cinematic-vs-GEO tension is unresolved in guidance.** §3a says "motion is progressive enhancement, don't delay LCP" — right, but it reads as a brake. Nothing shows a team _how_ to be cinematic **and** crawlable/fast at once.

## The practice proof: `docs/landing-motion-lab.html`

A single, **fully self-contained** file (zero external fonts/scripts/CDNs — required so it passes `check:source-registry`, and so it opens offline anywhere). It is built **entirely on the skill's real brand tokens** (the cream/green/coral + Fraunces/Source Sans system from `design-system/tokens.css`) to prove the section library is token-driven, not a generic dark SaaS skin. Open it in a browser and toggle "Pattern labels" to read each section's technique.

Coverage vs the motionsites catalog:

| § | Section | Technique demonstrated | motionsites analogue |
| --- | --- | --- | --- |
| 1 | Hero | animated gradient mesh, scroll parallax, **word-by-word** stagger, mouse **3D tilt**, floating UI cards, cursor glow | Nexar / Digital Reality hero |
| 2 | Trust | **seamless marquee**, pause-on-hover, edge mask | Scroll Marquee |
| 3 | Bento | IntersectionObserver **stagger**, hover lift, live streak bars + progress ring | Bento Grid Stats |
| 4 | How it works | **sticky-pinned scrollytelling**: scroll-linked step activation + cross-fading phone screens | sticky cards / scroll storytelling |
| 5 | Stats | **count-up** on in-view (rAF, eased) | animated stat counters |
| 6 | Testimonials | stagger reveal + **cursor spotlight** | Kova / radial testimonial |
| 7 | Pricing | **glassmorphism** + animated billing toggle (re-prices live) | Liquid Glass / SaaS pricing |
| 8 | CTA | conic **gradient morph** + cursor **spotlight** + glass | Liquid Glass / Mouse Trail CTA |

### Honest quality self-assessment

**Matches the bar:** the _motion vocabulary_ is all there and reads as premium — mesh hero, scrollytelling, glass, marquee, spotlight, stagger, count-up, 3D tilt. On a warm editorial brand it actually looks _more_ distinctive than the default dark-cyberpunk gallery entries, which is the point: **motionsites-grade motion, your brand tokens.**

**Where a single static file falls short of a shipped motionsites section (be honest):**
- **Type.** motionsites leans on licensed display faces; the proof uses the token fallback stack (Georgia stands in for Fraunces) to stay dependency-free. Production must self-host the real webfont (subset, `font-display: swap`, preload) — a webfont, not a CDN call.
- **Baked video.** No Mux-style hero _video_ loop here (that is the Remotion lane). The CSS mesh is a strong, lighter-weight stand-in; the highest-fidelity hero adds a baked `.webm`.
- **Hand-rolled vs library.** Choreography is vanilla JS so the proof needs no build. The production section library should be **`motion/react`** (`whileInView`, `useScroll`/`useTransform`, layout animations) — less code, spring physics, better interruption handling — server-rendered (Next/Astro) with motion hydrated after.
- **Scroll smoothness.** No smooth-scroll layer. motionsites-feel often adds Lenis; optional, and must degrade cleanly + respect reduced-motion.

**The load-bearing insight (proven, not asserted):** cinematic and GEO/perf-safe is **not** a tradeoff. In the proof, with JS off or `prefers-reduced-motion: reduce`, **all copy is present and legible**, the hero headline is real text (split into spans only after `js` is set on `<html>`), nothing is hidden behind an animation, and every transform/parallax/cursor effect collapses to a calm static state. That is the template the skill should encode as enforceable.

## Proposed abstraction into the skill (scoped, not yet built)

If we greenlight, the change-set (each piece earns its place per AGENTS.md "add a validator/eval, not prose"):

1. **`playbook/design/landing-motion-craft.md`** — the two-lane model, the section catalog with technique + the "progressive-enhancement contract" (SSR text, `js`-gated reveals, reduced-motion collapse, no LCP gate), and the Remotion↔motion handoff. Routed from `geo-seo.md` §3a and `design-visual-system.md`.
2. **`templates/landing/`** — a runnable **section library** (Next or Astro + `motion/react`) mirroring the proof's sections, each a typed, token-driven component reading `--motion-*`. Ships `robots.txt`/`llms.txt`/`sitemap.xml` (already required) and a baked-video slot wired to the Remotion content-assets lane.
3. **Motion-token promotion** — add `--motion-duration-reveal`, `--motion-duration-cinematic`, `--motion-easing-emphasis` (expo-out), `--motion-easing-spring`, `--motion-stagger` to `design-system/tokens.css` + `tokens.json` (the proof prototypes them in `:root`), so Remotion ads and the landing page share one timing system. Bumps the design-token hash → run `promote-design-tokens`.
4. **Extend `check-landing-funnel.ts`** — when a landing site is in scope, additionally assert: `prefers-reduced-motion` block present; no animation library imported into the shipped mobile binary; above-the-fold text exists in static HTML (anti-LCP-gate / anti-crawler-hiding heuristic); motion reads tokenized `--motion-*` rather than magic numbers.
5. **LaunchBench eval** — `landing-motion-progressive-enhancement-missing.yaml`: a landing site that hides hero copy until JS / ignores reduced-motion must fail.
6. **Source registry** — add `motion.dev` scroll/in-view doc pages actually used; record `motionsites.ai` as an _inspiration benchmark_ (visual reference, not a command-syntax source). Lenis only if adopted.
7. **Version + sync** — skill change ⇒ bump `skill-version.json` (per `check:version-discipline`); maintainer runtime rsync; `npm run audit:ci` is the gate.

## Open decisions for the founder

1. **Scope now:** ship the full lane (1–7) in one change-set, or land `playbook/design/landing-motion-craft.md` + the section-library template first and add validator/eval coverage second?
2. **Library:** standardize the section library on **Next.js + `motion/react`** (matches the archetype starters) — or Astro for the lightest static-first landing? (Recommend Next, for parity with `templates/app-archetypes/*/starter`.)
3. **Baked hero video:** make the Remotion hero-loop slot a default in the template, or opt-in per launch (license-gated as today)?
4. **Default aesthetic:** keep the section library brand-token-driven and aesthetic-neutral (proven here on the warm editorial brand), confirming we are _not_ hard-coding the dark/glass motionsites look.

## Try the proof

```bash
open docs/landing-motion-lab.html      # macOS
xdg-open docs/landing-motion-lab.html  # Linux
# then toggle "Pattern labels" in the nav; test prefers-reduced-motion in devtools rendering pane
```
