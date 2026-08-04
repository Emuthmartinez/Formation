# Design System

Status: partial until Design Room state has been mutated, versioned, rendered, and promoted.

## Canonical Medium

Design proposals must use STATE -> MUTATE -> VERSION -> RENDER. Edit `studio/seed/business.json` and `studio/seed/theme.tokens.json`; render `design/design-room.html`; do not hand-author one-off visual proposals.

## Token Source

Shared tokens live in `studio/seed/theme.tokens.json` and promote into `design/system/` after acceptance.

## Starter Tokens

| Token | Value | Notes |
| --- | --- | --- |
| color.background | `#f7f3ec` | page and app shell background |
| color.primary | `#0c7c59` | primary actions and emphasis |
| color.accent | `#ff6f5c` | conversion accents and highlights |
| color.text | `#161512` | primary readable text |
| radius.md | `8px` | default card and control radius |

## Motion

Motion is tokenized in `studio/seed/theme.tokens.json` under `motion.*` and promoted to every platform. Use one scale everywhere; do not hand-pick durations.

| Token | Value | Web (CSS var) | iOS (`DesignTokens.Motion`) |
| --- | --- | --- | --- |
| motion.durationFast | `120ms` | `--motion-duration-fast` | `durationFast` (0.12s) |
| motion.durationBase | `220ms` | `--motion-duration-base` | `durationBase` (0.22s) |
| motion.durationSlow | `360ms` | `--motion-duration-slow` | `durationSlow` (0.36s) |
| motion.reducedMotionDuration | `0ms` | `--motion-duration-reduced` | `reducedMotionDuration` (0s) |
| motion.easing | `cubic-bezier(0.2, 0, 0, 1)` | `--motion-easing` | `easing` |

Per-surface implementation:

- **Web surfaces ship motion** — landing pages, funnels, web paywall, and the Design Room preview animate with framer-motion / the `motion` library (`import { motion } from "motion/react"`), reading durations from the promoted `--motion-*` variables. This is the primary place framer-motion and the `ui-ux-pro-max` skill apply.
- **The mobile binary does not use framer-motion** — SwiftUI uses `DesignTokens.Motion` with `.animation`; Flutter uses implicit/explicit animations; React Native uses Reanimated/Moti. All read the same token values.
- **Reduced motion is required everywhere** — honor `prefers-reduced-motion` on web and the OS reduce-motion setting on device; fall back to opacity-only or instant changes.

## Emotional Tone And Card Motion

Required when `EMOTIONAL_DESIGN.md` is in scope. Translate the Emotional North Star into Norman's three levels, then bind each Experience Card moment to a motion token and a reduced-motion fallback. Web surfaces animate with `motion/react` reading `--motion-*` variables; the mobile binary uses `DesignTokens.Motion`. See `knowledge/experience/emotional-design-system.md §Integration §Design Room`.

**Three-level tone (fill product-specific):**

- **Visceral** (first 500ms impression): the feeling before reading — color, weight, imagery.
- **Behavioral** (in-use): how the core loop feels — pace, feedback, friction.
- **Reflective** (afterward): the story the user retells — the Emotional North Star.

**Card motion spec:**

| Card moment | Motion token | Web (`motion/react`) | Reduced-motion fallback |
| --- | --- | --- | --- |
| Commitment echo | `motion.durationFast` | opacity/position highlight | instant static text, no fade |
| Perceived Effort step transitions | `motion.durationFast` between steps + celebrate-family final reveal | staged step list + spring reveal | static step list, count only |
| Variable Reward anticipation → reveal | `motion.durationBase` loop + celebrate-family spring reveal | anticipation loop then reveal | instant plain-text result |
| Intent Mirror entrance | `motion.durationReveal` | deliberate fade-in | static block appears instantly |

Every animated card moment must declare its `prefers-reduced-motion` / OS reduce-motion behavior here and in `engineering/TECH_SPEC.md`.

## Screen Spec

Screen-level implementation guidance lives in `design/screen-design/design.md` so this case-insensitive filesystem can still ship both the canonical visual-system file and the lowercase screen spec convention.
