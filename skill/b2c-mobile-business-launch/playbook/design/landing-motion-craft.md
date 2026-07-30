# Landing Motion Craft

Motionsites-grade landing motion on the project's own brand tokens — cinematic AND crawlable/fast, proven (not asserted) by `docs/landing-motion-lab.html` in the skill repo. Load this reference before building or animating any landing page, funnel page, or web marketing surface; it is routed from `geo-seo.md` §3a and `design-visual-system.md`. The inspiration benchmark is motionsites.ai (`https://motionsites.ai`) — a visual reference, not a command-syntax source.

## The two-lane content model

One brand timing system, two delivery lanes. Both read the same promoted `--motion-*` tokens (`design-system/tokens.css`, generated from `state/theme.tokens.json` by `npm run promote:design-tokens`):

| Lane | Tool | Owns | Never does |
| --- | --- | --- | --- |
| **Baked** | Remotion (`remotion-content-assets.md`) | hero loop `.webm`/`.mp4` + poster, section media tiles, ad/store art — render once, embed | live scroll/hover/cursor behavior |
| **Live** | `motion/react` (`https://motion.dev/docs/react`) | in-view stagger reveals, scroll-linked parallax, sticky scrollytelling, count-up, cursor spotlight, 3D tilt, marquee | frame-exact video output |

Remotion is the wrong *primary* tool for landing motion: it renders frames, not live DOM behavior. The "wow" of a motionsites-grade page is ~85% the live lane. Do not re-litigate this split per launch; record the baked-video opt-in (license-gated per `paid-tool-routing.md`) in `TOOL_DECISIONS.md`.

## The section library

`business/landing/` ships the reusable sections — Hero (mesh/video, parallax, word stagger, tilt), Marquee, Bento, Scrollytelling, Stats count-up, Testimonials spotlight, Pricing glass + billing toggle, CTA gradient morph — plus `lib/motion-tokens.ts` (SSR-safe token reader) and `motion.css` (js-gated reveal utilities, reduced-motion collapse). Start from the library and customize copy/layout; do not improvise section choreography from scratch. The pack is aesthetic-neutral: warm-editorial and dark-glass brands come out of the same components purely via tokens.

Two web-lane recipes live in the in-app benchmark file [`motion-craft-benchmarks.md`](motion-craft-benchmarks.md): R9, the contained edge-warp scroll transition (margin, channel-split, and edge-proximity rules), and R1, asynchronous-grid hero liveness. Load it when a landing hero or scroll moment calls for either.

Before drafting copy for any section slot — hero headline/subhead, testimonial spotlight quotes, stats captions, or CTA button/microcopy — load `playbook/words/no-slop-writing.md`; keep the brand's voice from `BRAND.md`/`11_STAR_EXPERIENCE.md`, not a flattened landing-page register.

Host: a Next.js App Router project (the archetype starters are the expected hosts) or any React SSR site; Astro via client islands. `motion/react` is mandated for the web surface and **must never be imported by the mobile binary** — `check:template-safety` enforces the boundary (the `business/landing/` exception is deliberate and web-only).

## The progressive-enhancement contract (enforceable)

Cinematic and GEO/perf-safe is not a tradeoff. Rules 1, 2, and 4 are mechanically enforced by `check:landing-funnel` when landing sources animate; rule 3 is architectural guidance verified through the deploy gates and live checks rather than a static scan:

1. **Real text, always.** Above-the-fold copy exists in static HTML and is never animation-gated. Reveal states apply only under `html.js` (set on hydration); with JavaScript off the page is a calm, legible document. Hero word-spans are created only after hydration so crawlers see the intact headline.
2. **Reduced motion collapses everything.** Landing sources that animate must carry a `prefers-reduced-motion` block (and component-level `useReducedMotion()` checks) that zeroes durations and removes transforms — the calm final state, immediately.
3. **Motion never gates LCP/INP.** Server-render or statically render content; hydrate choreography after. Entrance animation must not delay first paint or hide text from crawlers.
4. **Tokens, not magic numbers.** Durations/easings read the `--motion-*` scale. Raw millisecond literals in landing motion styles are flagged — retime the brand by re-promoting tokens, not by editing sections.

## The landing motion token scale

The in-app micro-motion band (120–360ms) is deliberately too short for cinematic web work; the landing lane adds:

| Token | Default | Use |
| --- | --- | --- |
| `--motion-duration-reveal` | 600ms | in-view reveals, word stagger |
| `--motion-duration-cinematic` | 1200ms | mesh drift, scrollytelling cross-fades, count-up, marquee base unit |
| `--motion-easing-emphasis` | expo-out | entrances that should feel decisive |
| `--motion-easing-spring` | springy overshoot | playful accents (toggle re-price, badges) |
| `--motion-stagger` | 60ms | per-item stagger step |

These live in `state/theme.tokens.json` → promoted into `design-system/tokens.css`, `tokens.json`, and `DesignTokens.swift` (`check:token-promotion` gates the hash). Remotion compositions read the same values so baked and live motion share one feel.

## Production floor (beyond the proof)

- **Type:** self-host the real display webfont (subset, `font-display: swap`, preload). The token fallback stack is for dependency-free proofs only.
- **Baked hero video:** opt-in per launch through the Remotion lane; always ship a poster and keep the mesh fallback.
- **Smooth scroll (Lenis):** optional; if adopted it must degrade cleanly, respect reduced motion, and be registered in `source-registry.yaml` before use.
- **Copy:** section copy passes the `no-slop-writing.md` self-check (§6) and `check:no-slop` before `check:landing-funnel` runs — brand voice from `BRAND.md` wins over generic landing-page register.
- **Verification:** run `check:landing-funnel` (deploy gates + GEO/SEO files + copy guardrails + motion craft) before calling the landing lane ready; the LaunchBench scenario `landing-motion-progressive-enhancement-missing` locks the failure mode.
