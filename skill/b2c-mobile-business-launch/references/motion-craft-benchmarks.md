# Motion Craft Benchmarks: The In-App Swipe-File

Numeric motion recipes for in-app surfaces, distilled from the 60fps.design catalog (`https://60fps.design/` — the X account @60fpsdesign, ~1,800 curated screen recordings of interaction details from best-in-class consumer apps). This is the in-app counterpart to `landing-motion-craft.md`'s motionsites.ai benchmark: an inspiration benchmark, never a command-syntax source. Load it when a surface needs stronger motion direction than the craft doctrine's details give — celebration choreography, earned-object reveals, hero transitions, gesture physics, brand liveness — after [`premium-mobile-craft.md`](premium-mobile-craft.md) (doctrine, spring canon, frame budget) and alongside the experience card the moment serves.

Two ground rules before any recipe is applied:

- **Recipes are acceptance criteria, not adjectives.** Each states numbers a reviewer can check on a screen recording. "Feels springy" does not gate; "rotation overshoots past level and visibly reverses at least once" does.
- **Patterns, not clones.** The catalog showcases other apps' branded work. Take the mechanics — timing, damping, choreography structure — and never reproduce a featured app's branded asset, mascot, or visual identity.

Engagement figures below (`eng = likes + 2×bookmarks`, bookmarks weighted as the "saved as reference" signal) are point-in-time platform metrics from the 2026-07-26 catalog mine. They rank patterns within the catalog; they are not evidence for external claims and must never appear in founder or marketing copy.

## How Recipes Bind To The Token Scale

Every recipe rides the shipped motion scale — no ad-hoc millisecond values. Two vocabularies name that spine today: the tokens.json members and the SwiftUI presets. A third — the card aliases `brief`/`moderate`/`expressive` — was retired from every shipped reference on 2026-07-27; the alias column below stays only as a translation table for repos generated before that date:

| tokens.json (`motion.*`) | Value | SwiftUI preset (`PremiumCraft.swift`) | Retired card alias | Governs |
| --- | --- | --- | --- | --- |
| `durationFast` | 120ms | `PremiumMotion.press` (bounce 0.18) | `brief` | press feedback, micro-ticks |
| `durationBase` | 220ms | `PremiumMotion.standard` (bounce 0.12) | `moderate` | state changes, content arrival |
| `durationSlow` | 360ms | `PremiumMotion.emphasized` (bounce 0.10) | — | deliberate transitions |
| `durationCelebrate` | 500ms | `PremiumMotion.celebrate` (bounce 0.3), `PremiumMotion.celebrateLanding` (bounce 0.45) | — | celebrate-family springs: soft-settle reveals and R3 landings |
| `durationReveal` | 600ms | — (bounds celebrate choreography) | `expressive` (~500ms) | celebrations, earned-object landings |
| `durationCinematic` | 1200ms | — (web/brand lane only) | — | brand liveness, baked loops |
| `stagger` | 60ms | — | — | per-item cascade step |

One reconciliation note (historical — it predates the Phase 3 card stubs and is kept for provenance; the full card bodies it cites are MCP-served now): the retired `expressive` alias was overloaded — `experience-cards/peak-end-card.md` and `experience-cards/variable-reward-card.md` used it as the celebrate spring *response* (0.45–0.5s), `experience-cards/streak-and-loss-aversion-card.md` as a ~500ms choreography *duration*. Both readings survive without the alias: the spring response stays 0.45–0.5s, and `durationReveal` (600ms) bounds the full choreography — two different quantities, not a contradiction.

The two spring families — press (response 0.3–0.4 / damping 0.7–0.8) and celebrate (response 0.45–0.5 / damping 0.5–0.7) — are defined once, in `premium-mobile-craft.md` §1; recipes cite the family, not fresh numbers. Since 2026-07-28 the family ships in the preset layer: `motion.durationCelebrate` (500ms) carries `PremiumMotion.celebrate` (bounce 0.3, the soft-settle end) and `PremiumMotion.celebrateLanding` (bounce 0.45, the visible-oscillation end R3 rides). App code reads the presets — a hand-typed spring literal in view code is drift, and the first live output test (2026-07-28) confirmed builders hand-type numbers whenever no preset exists. The cards' `.spring(response:dampingFraction:)` literals remain the spec notation those presets implement.

## The Recipes

### R1 — Asynchronous-grid liveness

**Serves:** brand reels, landing heroes, App Store preview loops, ambient non-scrolling in-app dashboards. No experience card owns this pattern — it belongs to the brand-motion family, whose full lane is deliberately deferred; web surfaces route via `landing-motion-craft.md`. **Rides:** `motion.durationCinematic` per swap on web/brand surfaces; in-app ambient variants pace swaps at 1–2× `motion.durationReveal` instead (the same 0.6–1.2s band — the cinematic token stays web/brand-lane); phase offsets in multiples of `motion.stagger`.

A composition feels alive when its regions run on independent clocks inside one fixed grid: each cell swaps its fill or content every 0.6–1.2s, deliberately out of phase, while layout never moves.

- [ ] The grid never reflows: cell positions and sizes are constant; only content inside cells animates.
- [ ] No two adjacent cells swap within ~200ms of each other — phase offsets are deliberate, not accidental simultaneity.
- [ ] Each swap animates transform/opacity only; the loop produces zero layout passes per frame.

**Exemplars:** SarvamAI breathing-shapes identity (eng 4,375 — the catalog's top post); Nuvion 8-panel rebrand reel (eng 1,568).

### R2 — Two-phase celebration bloom

**Serves:** `experience-cards/peak-end-card.md` (engineered peak), `experience-cards/variable-reward-card.md` (reveal), system-reveal moments. **Rides:** celebrate-family spring for contraction and reconvergence; each phase bounded by `motion.durationReveal`; hold 1–1.5s.

The hero contracts slightly (3–5% scale), spawns 15–20 miniature variant clones (varied hue or silhouette) scattering outward, holds, then reconverges to one settled shape. The clones' hue variation is R8's documented composition-level exemption — see R8's scope notes for its boundary.

- [ ] Two phases, then rest: contract → burst → hold 1–1.5s → reconverge. Never an endless particle loop.
- [ ] 15–20 clones with visible variation; per-clone stagger ≤15ms so the burst reads as one event, not a sequence (the 60ms `motion.stagger` step is for content cascades, not particle bursts).
- [ ] Fires only on a genuinely earned moment per the experience card's bright line — never on app open or idle.
- [ ] Reduce Motion: a static celebratory frame plus the success haptic; no clone scatter.

**Exemplars:** SarvamAI breathing-shapes bloom (eng 4,375).

### R3 — Overshoot-and-settle object landing

**Serves:** `experience-cards/mastery-and-status-card.md` (badge/level reveal), `experience-cards/variable-reward-card.md`, collectible and earned-object reveals. **Rides:** celebrate-family spring at damping 0.5–0.6 (the visible-oscillation end — ships as `PremiumMotion.celebrateLanding`); the reveal completes within `motion.durationReveal`.

A decelerating tween reads as "panel animating in"; an oscillating overshoot reads as "physical object landing." That distinction is the whole recipe.

- [ ] The object enters as a blurred small silhouette (20–30% of final scale) and grows to a 3D-tilted hero over 400–600ms.
- [ ] Motion blur only during the fast phase (R7); the landing is tack-sharp.
- [ ] Rotation overshoots past level and visibly reverses at least once (1–2 oscillations).
- [ ] 100% of surrounding chrome is static during the landing — the full motion budget concentrates on one focal object.
- [ ] Reduce Motion: cross-fade to the settled object; no scale/rotation choreography.

**Exemplars:** mymind collectible achievement cards (eng 1,540); Opal gem unlock.

### R4 — Pinch-open perspective accordion

**Serves:** onboarding hero reveals, carousel/wheel introductions; craft detail 2 (motion answers a question the user just asked). **Rides:** `motion.durationBase`–`durationSlow` with `motion.easingEmphasis` (ease-out, no overshoot); cascade steps of 150–200ms (2–3× the `motion.stagger` step).

- [ ] The hero expands from near-zero width at a single vanishing point via scale+translate over 250–400ms, ease-out, no overshoot.
- [ ] Surrounding text cascades top-to-bottom (headline → body → CTA) at 150–200ms intervals after the hero lands.
- [ ] Nothing else on screen animates during the reveal.

**Exemplars:** Melius wheel reveal; Reactiive carousel work (engagement not separately recorded for these posts in the mine).

### R5 — Scrub-linked theming

**Serves:** time/level/progress scrubbers whose position re-themes the surface; the gesture-physics rules below. **Rides:** no duration token while scrubbing — the finger is the clock; the release settle uses `PremiumMotion.standard`.

- [ ] Every themed property — background gradient, ink color, icon tint, glow blur — derives from one shared 0–1 scrub value; nothing reads its own clock, so nothing desyncs.
- [ ] The light/dark ink switch crosses inside the middle third of the range and interpolates through a warm off-white (not pure white) so contrast holds at every position — verify at scrub 0, 0.25, 0.5, 0.75, 1.
- [ ] The "return to now/home" resting state is distinct: a unique icon and copy swap reward reaching it.

**Exemplars:** Good Air time-scrub sky theming (eng 1,804).

### R6 — Data-driven 3D extrusion + camera turn

**Serves:** share cards, system-reveal moments, year-in-review stats; the `mastery-and-status-card.md` display layer. **Rides:** `motion.durationReveal` — extrude and camera turn complete together in 500–800ms.

- [ ] 2D pixel/data values map to voxel heights (background 0, foreground ~8–12 units), so any generated flat asset can grow into 3D without bespoke modeling.
- [ ] Every extrude/collapse pairs with a simultaneous camera rotation (0° → 30–35° isometric) completing together — scale alone reads as inflation; scale plus rotation reads as the object turning toward you.
- [ ] Collapse plays a brief off-axis wobble (100–150ms), never a symmetric rewind.
- [ ] A soft elliptical drop shadow appears only while the object is "lifted."

**Exemplars:** Reactiive QR → voxel tree (eng 2,704; ~49% bookmark-to-like ratio — a technique reference, not eye-candy).

### R7 — Motion blur as a velocity cue

**Serves:** any recipe with a fast interpolation phase (R3, R6); craft detail 2. **Rides:** the underlying movement's spring; blur adds no time of its own.

- [ ] Blur appears only during high-velocity phases of a movement and scales with velocity.
- [ ] Every landing is tack-sharp; no blur persists at rest.
- [ ] Blur is applied to the moving object only, never as a full-screen filter — blur is one of the costly effects the frame budget in `premium-mobile-craft.md` warns about, so keep the blurred region small and profile it.

**Exemplars:** mymind card landings (eng 1,540); Reactiive extrusions (eng 2,704).

### R8 — One saturated hero, neutral chrome

**Serves:** `quality-lens.md` anti-generic checks; every celebration and reveal composition. **Rides:** the design-token palette — this is color discipline, not a duration.

**Scope.** The rule governs where attention goes, not whether chrome may carry the brand hue. Conventional interactive chrome — the primary CTA fill, progress indicators, selected-state tints — may ride the single brand hue; what the rule bans is a second saturated hue competing for attention, and chrome that outshouts or moves against the hero. The first live output test (2026-07-28) read the old wording literally and graded every brand-colored CTA a violation — that reading is wrong; judge the content composition, not the existence of a colored button.

Two more scope boundaries, both caught when the 2026-07-28 adversarial review graded the first runnable reproductions of this file's own recipes:

- **R2's clone burst is the one composition-level exemption.** A celebration bloom's 15–20 clones scatter "varied hue or silhouette" by R2's own spec — during the burst's bounded phases (contract → burst → hold → reconverge) the multi-hue scatter *is* the hero. The single-hue discipline resumes the moment the clones reconverge; an ambient surface that keeps multiple saturated hues after the celebration ends is a violation, not an exemption.
- **User content is not chrome.** A collage, cloud, or grid of the user's own saved items — photo thumbnails, album art, imported cards — carries whatever colors the content has. The rule governs *designed* composition elements: hero objects, chrome, brand surfaces. Grade the frame around the content, never the content itself.

- [ ] Exactly one hero/content object per composition carries saturated color; remaining chrome stays neutral or rides the same brand hue quieter than the hero — never a second saturated hue.
- [ ] Chroma and type-weight concentrate on the same element — attention has a single address.
- [ ] In celebration moments the saturated hero is the earned thing itself, not the chrome around it.
- [ ] During a landing or celebration, brand-hued chrome holds still; CTAs and chrome arrive only after the hero settles — via R10's post-reveal reflow, or after R2's hold when the moment choreographs one — so the full motion budget stays on the hero.

**Exemplars:** consistent across the catalog's top reveals — Nuvion (eng 1,568), mymind (eng 1,540), Melius.

### R9 — Contained edge-warp transition (web lane only)

**Serves:** landing/funnel scroll moments — route via `landing-motion-craft.md`. Never the mobile binary: the frame-read confirmed the exemplar is a website scroll effect (system.studio portfolio), not native app UI.

- [ ] Any warp/chromatic-aberration shader stays inside a thin margin (5–8% of container width) at the boundary.
- [ ] RGB channel-split stays at 0.3–0.8% of frame width — larger reads as a broken signal.
- [ ] Warp intensity derives from an element's proximity to the edge, not a global timer.
- [ ] The underlying scroll stays completely plain: the warp is the composition's only loud element.

**Exemplars:** screen-edge warp scroll (eng 2,841).

### R10 — Scratch-card reward reveal

**Serves:** `experience-cards/variable-reward-card.md` directly (anticipation → reveal); reward moments near the paywall. **Rides:** the reveal is finger-driven (no clock); the post-reveal CTA reflow uses 150–250ms (`motion.durationFast`–`durationBase`), no bounce.

- [ ] The reveal-mask edge is noise-generated (8–15px jagged perturbation) — torn foil, never a clean circle or wipe; an eraser edge reads as digital.
- [ ] The payoff value renders on its own top z-layer, so legibility is never gated on mask completion.
- [ ] When the post-reveal CTA appears, the card nudges up 15–20px while the CTA slides in over 150–250ms, no bounce — one coordinated reflow.
- [ ] Touch/cursor affordances swap per interaction state (scratchable → revealed).
- [ ] The reward beneath is real and genuinely variable per the card's bright line.
- [ ] Accessibility: a tap-to-reveal alternative exists (motor access), and under Reduce Motion the reveal is a cross-fade.

**Exemplars:** scratch-to-reveal reward card (eng 1,904 — the gamification family's top post); Duolingo reward mechanics (7 catalog posts, eng 2,935 combined across mascot joy, treasure chest, and streaks — the catalog's most-featured app).

## Gesture & Scroll Physics

The catalog's hardest-bookmarked family per post (rollout wheel scrub eng 3,037; pinch-to-close thread 601; Good Air scrub 1,804) — mechanics designers save to reuse. These rules govern any in-app gesture surface and read the same tokens as everything above.

**The two clocks rule.** While a finger is down, the gesture owns the clock: the surface tracks the finger 1:1 with zero added easing or duration (direct manipulation). Duration and spring tokens govern only what happens after release. Easing a surface *toward* the finger reads as lag.

**Velocity handoff.** On release, feed the gesture's ending velocity into the settle spring's initial velocity — SwiftUI: read `velocity` off the final `DragGesture.Value` (iOS 17+) and start the settle with `.interpolatingSpring(..., initialVelocity:)`, normalized by the remaining travel (a projected end *target* alone does not carry velocity into the spring); Reanimated `withSpring(target, { velocity })`; Flutter `SpringSimulation` with the drag velocity. A settle that ignores release velocity visibly "resets" and breaks the physical illusion.

**Rubber-band overscroll.** Content dragged past its bounds follows with diminishing returns, never a hard stop — iOS's classic resistance constant is ≈0.55, with displacement asymptotically approaching a limit proportional to the container dimension. Match the platform default; never disable overscroll bounce on scrolling content to make it "feel tight."

**Pull-to-refresh elasticity.** Trigger threshold 60–80pt of pull; the indicator's progress maps to pull *distance*, not time, so the user feels it arming; one `impactLight` haptic exactly at the arm point; release settles with `PremiumMotion.standard`; the spinner region collapses over `motion.durationBase` when the refresh completes.

**Drag-to-dismiss velocity.** Commit the dismissal when projected velocity exceeds ~1,000pt/s or displacement passes ~1/3 of the dismissable dimension, whichever comes first; otherwise spring back with the press family — no overshoot, because a bounce on a failed dismissal reads as mockery. The gesture stays interruptible in both directions at every point.

**Scrub-linked state.** R5's shared-value rule generalizes: any gesture that themes or transforms multiple properties drives them all off one scalar, so nothing desyncs.

**Reduce Motion.** Finger-tracking stays 1:1 — it is user-generated direct manipulation, not app-generated motion. Release settles collapse to the shortest non-bouncing settle, and decorative side-effects of the gesture (parallax, tilt, glow) are dropped.

Accept when:

- [ ] Tracking is 1:1 while the finger is down; nothing eases toward the finger.
- [ ] Every release settle receives the gesture's ending velocity.
- [ ] Overscroll rubber-bands at platform-default resistance; nothing hard-stops at an edge.
- [ ] Pull-to-refresh arms by distance with a single haptic at the threshold.
- [ ] Drag-to-dismiss commits on velocity or displacement and springs back without overshoot otherwise.
- [ ] All gestures are interruptible mid-flight.

## Where The Catalog Says Motion Budget Pays

From the full 300-post mine (123 showcase posts):

- **Tactile micro-interactions are the #1 family** by both count and engagement (14 posts, eng 10,266) — confirming the press-state-first doctrine. Branded press feedback (key-flips, jelly presses, cassette-style controls) is the differentiation layer above the baseline five details.
- **Celebration/milestone moments punch ~3× above their post count** (10 posts, eng 6,253): reward moments are disproportionately saved. R2, R3, and R10 are where craft investment compounds fastest — pair them with the experience card that earns the moment.
- **Gesture physics is the most-bookmarked family per post** — designers save mechanics for reuse, which is why the physics rules above are stated as numbers.
- **Brand-motion posts are the catalog's top outliers** (SarvamAI eng 4,375; Nuvion 1,568): living brand systems outdraw UI tricks. R1 is the entry point; a full brand-motion lane is deliberately out of scope here.

## Live Catalog Access (60fps.design MCP)

The catalog behind this file is queryable live when the 60fps.design MCP server is connected (`https://60fps.design/mcp` — tools named `60fps_*`). Use it to ground a specific surface in a real exemplar before applying a recipe:

- `60fps_search_shots` — semantic search over the shot library (~2,000 iOS interaction clips) by natural-language description, filter slugs, app, or platform.
- `60fps_get_shot` — full detail for one shot: keyframe images at 1s intervals, interaction pattern, motion behaviors, intensity, mood.
- `60fps_get_motion_breakdown` — the shot's motion anatomy: trigger, start → transition → end states, why it works. The right tool when recreating, not just finding.
- `60fps_get_motion_code` — starter SwiftUI tuned by the shot's motion parameters. Treat the output as a sketch to rewrite onto the token scale: replace its raw timing values with `DesignTokens.Motion` members and `PremiumMotion` presets before it ships.
- `60fps_get_related_shots` — nearest-neighbour variations of an interaction.

Ground rules carry over unchanged: mechanics only, never a featured app's branded asset, mascot, or copy; every recipe still binds to the token scale exactly as this file states. The MCP is a live convenience over the registered catalog source (`x-com-60fpsdesign-catalog`); when it is not connected, this file's recipes remain the distilled contract and searching the catalog is not required. Two shots newer than the library's index were reproduced by frame-reading the source videos directly — the same fallback applies to any shot the MCP cannot return.

Runnable reproductions of these recipes ship in [`templates/motion-catalog/`](../templates/motion-catalog/README.md): two full-screen choreography exemplars (declarative and procedural modes), the closed-form `TokenSpring` evaluator, and the Remotion twin for token-true video renders.

## Provenance & Refresh

- Source: the 60fps.design catalog, mined 2026-07-26 (300 posts, 123 showcase). Registered as `x-com-60fpsdesign-catalog` (`inspiration_benchmark`) in `source-registry.yaml` with a 30-day refresh cadence. The live MCP endpoint (`https://60fps.design/mcp`) is registered separately as `sixty-fps-design-mcp`.
- Recipe timings and damping values come from frame-reads of the catalog's top videos, estimated from sampled frames (±1 frame-interval). Where a frame-read gave only a qualitative cue, this file states an operational threshold so reviews have a number to check — R1's ~200ms adjacency window, R2's 3–5% contraction and ≤15ms clone stagger are that kind of operationalization, not catalog measurements.
- The Gesture & Scroll Physics numbers (rubber-band ≈0.55, 60–80pt refresh threshold, ~1,000pt/s dismiss velocity, 1/3 displacement) are platform-behavior defaults from iOS convention, stated here as the baseline to match; the catalog motivates the section but did not produce those constants.
- Engagement numbers rank patterns within this catalog only; never repeat them as external claims.
- Exemplar apps' branded assets stay theirs. Recipes transfer mechanics only.
