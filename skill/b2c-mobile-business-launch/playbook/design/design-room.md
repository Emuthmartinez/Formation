# Design Room Protocol

Use this reference before designing, changing, comparing, baselining, restoring, or wiping a B2C mobile app business design. The Design Room is a versioned state workspace, not a document format.

## Governing Loop

**STATE -> MUTATE -> VERSION -> RENDER** is mandatory for design work.

1. **STATE**: read `state/business.json` and `state/theme.tokens.json` in the app repo. If missing, copy the skill's `state/` seed or `templates/state/` into the app repo.
2. **MUTATE**: make one coherent change to the JSON state. Keep the mutation small enough to review: one audience, one surface cluster, one token pass, one store experiment, or one wipe.
3. **VERSION**: validate, render, and commit the state change. A design version is a git commit over `state/` and `design-room.html`, not a Markdown label.
4. **RENDER**: run the renderer and show the user `design-room.html` or `dist/design-room/index.html`. Do not freehand a one-off `DESIGN_PROPOSAL.md`, mood board, or ad-hoc HTML proof.

The user looks at the rendered Design Room. The agent edits only the state.

## Canonical Files

In the business repo:

```text
state/business.json       # identity, positioning, surfaces, Design Room version log, Control Plane panels
state/theme.tokens.json   # semantic tokens (color/font/space/radius/motion) used by every rendered surface; motion.* promotes to web (--motion-* / framer-motion) and DesignTokens.Motion (SwiftUI)
design-room.html          # static fallback render with design-state-hash
dist/design-room/         # React/Vite build, when available
```

In the skill:

```text
state/schema/business.schema.json
scripts/validate-state.ts
scripts/render-design-room.ts
scripts/version.ts
scripts/check-design-room-contract.ts
scripts/promote-design-tokens.ts
scripts/check-token-promotion.ts
render/
```

`PROJECT_STATE.yaml` and `launch-cockpit.html` remain the launch-status cockpit. `state/business.json` and `design-room.html` are the design/control-plane cockpit. Keep both current when design changes affect launch lanes.

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

- **Theme mutation**: changes semantic tokens in `state/theme.tokens.json`; rerender all panels.
- **Brief mutation**: sets or updates the optional `designBrief` in `state/business.json` (recommended style, palette/typography mood, key effects, anti-patterns, motion notes). Seed it from ui-ux-pro-max guidance with `npm run seed:design-brief` (reference-only; adapt, do not paste its data). It renders in `design-room.html`.
- **Surface mutation**: adds or changes a web funnel, landing page, marketing asset, mobile app screen/flow, App Store page, PPO test, or In-App Event in `state/business.json`.
- **Positioning mutation**: changes business promise, audience, or surface claims; cascade to affected surfaces instead of changing only one page.
- **Baseline mutation**: tags the current commit as `baseline/<name>` after validation and render pass.
- **Wipe mutation**: replaces `state/business.json` with the schema-valid empty skeleton and commits the reset.

Each mutation should update `designRoom.versionLog` with a short summary, `statePaths`, and `renderedArtifacts`.

Theme mutations that are accepted for implementation must also promote tokens into `design-system/tokens.json`, `design-system/tokens.css`, and `design-system/DesignTokens.swift`. Treat those files as generated handoff artifacts from the Design Room, not as a second source of truth.

## App Store Surfaces

Use `surfaces-b2c.md` for detailed App Store modeling. At minimum, the state must treat these as first-class versioned surfaces:

- default product page
- custom product pages
- Product Page Optimization tests
- In-App Events
- app icon, screenshots, app previews, and store screenshot story

Do not plan custom product pages without an audience, traffic source, measurement reason, keywords/media, and approval state. Do not plan In-App Events unless the app has real time-bound in-app content, schedule, deep link, localized copy, media, and review readiness.

## Render Standard

The primary medium is the React/Vite app in `render/`. It reads `state/business.json` and `state/theme.tokens.json`, turns tokens into CSS variables, and renders panels for the modeled surfaces.

The fallback is `design-room.html`, a self-contained render with a `design-state-hash` meta tag. The contract validator compares this hash to the current state so stale renders cannot pass.

Never inline brand colors, type choices, radius, or spacing in one-off artifacts. Add or mutate semantic tokens, then render.

## Done Definition

Design work is ready for review only when:

- `state/business.json` and `state/theme.tokens.json` validate.
- `designRoom.versionLog` names the mutation and rendered artifacts.
- `design-room.html` hash matches the current state.
- React/Vite build exists when dependencies are installed, or the static fallback is explicitly recorded.
- `check-design-room-contract` passes.
- `check-token-promotion` passes when theme tokens changed or implementation is about to consume the design system.
- If the design affects launch status, `PROJECT_STATE.yaml` and `launch-cockpit.html` are updated too.
