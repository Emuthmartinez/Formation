# Design Room Protocol

Use this reference before designing, changing, comparing, baselining, restoring, or wiping a B2C mobile app business design. The Design Room is a versioned state workspace, not a document format.

## Governing Loop

**STATE -> MUTATE -> CONTRACT -> VERSION -> RENDER** is mandatory for design work.

1. **STATE**: read `studio/seed/business.json` and `studio/seed/theme.tokens.json` in the app repo.
2. **MUTATE**: make one coherent change to the JSON state. Keep the mutation small enough to review: one audience, one surface cluster, one token pass, one store experiment, or one wipe.
3. **CONTRACT**: update `design/design.md` when the change affects design intent or implementation guidance.
4. **VERSION**: validate and commit the state, contract, tokens, and render together.
5. **RENDER**: run the renderer. Show `design/design-room.html` or `dist/design-room/index.html` to the founder.

The user looks at the rendered Design Room. The agent edits only the state.

## Canonical Files

In the business repo:

```text
studio/seed/business.json       # identity, positioning, surfaces, Design Room version log, Control Plane panels
studio/seed/theme.tokens.json   # semantic tokens (color/font/space/radius/motion) used by every rendered surface; motion.* promotes to web (--motion-* / framer-motion) and DesignTokens.Motion (SwiftUI)
design/design.md                # design intent, interaction rules, accessibility, and cross-surface guidance
design/design-room.html          # static fallback render with design-state-hash
dist/design-room/         # React/Vite build, when available
```

In the skill:

```text
studio/seed/schema/business.schema.json
studio/seed/schema/business.empty.json
validation/business/design/validate-state.ts
tooling/render-design-room.ts
tooling/version.ts
validation/business/design/check-design-room-contract.ts
tooling/promote-design-tokens.ts
validation/business/design/check-token-promotion.ts
render/
```

`design/design.md` does not own exact state or token values. The JSON files own those values.

The Design Room must show the current JSON state. The validator checks the state hash and visible state values.

## Commands

Run from the installed skill or skill repo, passing the app repo with `--root`:

```bash
npm run validate:design-state -- --root /path/to/app
npm run render:design-room -- --root /path/to/app
npm run check:design-room -- --root /path/to/app
npm run promote:design-tokens -- --root /path/to/app
npm run check:token-promotion -- --root /path/to/app
npm run seed:design-brief -- --root /path/to/app
npm run check:template-safety
```

Version operations:

```bash
npm run design:version -- version --root /path/to/app --message "design: tune onboarding and CPP"
npm run design:version -- baseline onboarding-v1 --root /path/to/app
npm run design:version -- diff onboarding-v1 --root /path/to/app
npm run design:version -- restore onboarding-v1 --root /path/to/app --yes
npm run design:version -- wipe --root /path/to/app --yes --message "design: wipe slate"
```

`restore` and `wipe` change files and require `--yes`. Wipe is a forward commit from the empty skeleton; never rewrite history to erase an old design.

## Mutation Shape

Before editing state, choose the mutation boundary:

- **Theme mutation**: changes semantic tokens in `studio/seed/theme.tokens.json`; rerender all panels.
- **Brief mutation**: sets or updates the optional `designBrief` in `studio/seed/business.json` (recommended style, palette/typography mood, key effects, anti-patterns, motion notes). Seed it from ui-ux-pro-max guidance with `npm run seed:design-brief` (reference-only; adapt, do not paste its data). It renders in `design/design-room.html`.
- **Surface mutation**: adds or changes a web funnel, landing page, marketing asset, mobile app screen/flow, App Store page, PPO test, or In-App Event in `studio/seed/business.json`.
- **Positioning mutation**: changes business promise, audience, or surface claims; cascade to affected surfaces instead of changing only one page.
- **Baseline mutation**: tags the current commit as `baseline/<name>` after validation and render pass.
- **Wipe mutation**: replaces `studio/seed/business.json` with the schema-valid empty skeleton and commits the reset.

Each mutation must update `designRoom.versionLog`. Include a short summary, `statePaths`, and `renderedArtifacts`.

Every design worker must read `design/design.md` first. This rule applies to app UI, onboarding, and motion.

It also applies to landing pages, icons, store creative, ads, and lifecycle marketing.

Theme mutations that are accepted for implementation must also promote tokens into `design/system/tokens.json`, `design/system/tokens.css`, and `design/system/DesignTokens.swift`. Treat those files as generated handoff artifacts from the Design Room, not as a second source of truth.

## App Store Surfaces

Use `surfaces-b2c.md` for detailed App Store modeling. At minimum, the state must treat these as first-class versioned surfaces:

- default product page
- custom product pages
- Product Page Optimization tests
- In-App Events
- app icon, screenshots, app previews, and store screenshot story

Do not plan custom product pages without an audience, traffic source, measurement reason, keywords/media, and approval state. Do not plan In-App Events unless the app has real time-bound in-app content, schedule, deep link, localized copy, media, and review readiness.

## Render Standard

The primary medium is the React/Vite app in `render/`. It reads `studio/seed/business.json` and `studio/seed/theme.tokens.json`, turns tokens into CSS variables, and renders panels for the modeled surfaces.

The fallback is `design/design-room.html`, a self-contained render with a `design-state-hash` meta tag. The contract validator compares this hash to the current state so stale renders cannot pass.

Never inline brand colors, type choices, radius, or spacing in one-off artifacts. Add or mutate semantic tokens, then render.

## Done Definition

Design work is ready for review only when:

- `studio/seed/business.json` and `studio/seed/theme.tokens.json` validate.
- `design/design.md` exists and contains all required sections.
- `designRoom.versionLog` names the mutation and rendered artifacts.
- `design/design-room.html` hash matches the current state.
- The rendered name, positioning, audience, mutation summary, and surface totals match the current state.
- A rendered or baselined design contains no starter text.
- React/Vite build exists when dependencies are installed, or the static fallback is explicitly recorded.
- `check-design-room-contract` passes.
- `check-token-promotion` passes when theme tokens changed or implementation is about to consume the design system.
- If the design affects launch status, `state/PROJECT_STATE.yaml` and `state/launch-cockpit.html` are updated too.
