# Consumer Quality Lens

Use this reference when a Design Room mutation needs taste, consumer-grade judgment, or inspiration. This is a lens applied to state, not a mandatory output template.

## What Good Means

A B2C mobile app launch design should feel:

- specific to the user's emotional job, not a generic SaaS wrapper
- coherent across app, landing, screenshots, email, paid creative, and store metadata
- honest about what the app can do today
- fast to understand in a tiny phone screenshot or short social hook
- durable enough that future agents can extend it without re-deciding the brand

The quality bar is not "pretty." It is whether the design makes the product's V1 scalable slice easier to believe, use, share, and buy.

## 11-Star Lens

Apply the 11-star material from [`eleven-star-experience.md`](../experience/eleven-star-experience.md) as a filter over state:

- Which modeled surface proves the magical V1 moment fastest?
- Which 10-star or 11-star idea should remain inspiration, not scope?
- Which 6-star or 7-star slice is feasible enough for V1?
- Which screenshot, onboarding step, or landing promise would a real user retell?

Do not produce a 20-section ladder every time. Use the ladder to mutate the state where it matters.

## Inspiration Sources

When the design needs stronger direction, inspect the relevant source and summarize the effect on state:

- Google Labs `design.md` for token/prose design-system structure
- Refero for current UX patterns when available
- Taste-style review for visual distinctiveness and category fit
- Layers-style product clarity before surface polish
- Impeccable-style visual QA for typography, spacing, contrast, motion, responsive behavior, and UX writing
- `ui-ux-pro-max` skill for senior-grade UI direction, palette/typography pairings, and motion/anti-pattern checklists when web-surface or design-system direction needs a stronger start (reference-only; adapt, do not copy its data). Capture the adapted result in `state.designBrief` via `npm run seed:design-brief` so the theme stops being provisional.
- 60fps.design catalog via `motion-craft-benchmarks.md` for named, numeric in-app motion recipes — celebrations, reveals, gesture physics — when a magical-moment surface needs motion direction beyond adjectives
- Higgsfield for production-quality visuals when the founder approves paid/account-gated generation
- Remotion for repeatable local rendered assets from real UI, captions, and tokens

The result should be a state mutation: token, surface, claim, flow, screenshot, App Store page, or asset route.

## Anti-Generic Checks

Before a design state mutation is accepted:

- the page or screen uses the business's actual nouns and verbs
- the palette is not a single-hue default
- typography is purposeful and tied to the category
- mobile frames, store screenshots, and web panels share tokens
- app and store claims match real implementation scope
- generated visuals support real app UI instead of replacing it
- edge states are represented when they affect conversion or trust
- every visual decision traces to an audience fact in `strategy/RESEARCH.md`, and the direction shows no generic-template tell. [`audience-derived-identity.md`](./audience-derived-identity.md) carries the tells table, the derivation chain, and the logo-swap test.

If the mutation cannot pass these checks, keep the state in `draft` or `blocked`.

## Review Prompt

Use this compact review prompt for a Design Room pass:

```text
Review studio/seed/business.json and studio/seed/theme.tokens.json through the consumer quality lens.
Name the one strongest inconsistency across app, landing, store, and marketing surfaces.
Propose one state mutation, not a new document.
Then validate, version, and render.
```
