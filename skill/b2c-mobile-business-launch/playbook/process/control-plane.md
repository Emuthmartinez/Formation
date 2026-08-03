# Business Control Plane

The Design Room is the first panel of a larger Business Control Plane: a founder-facing layer above the actual business where state, decisions, proof, blockers, and rendered views stay connected.

## Current Panel

`design-room.html` and `dist/design-room/` render the Design Room from:

- `state/business.json`
- `state/theme.tokens.json`
- `state/schema/business.schema.json`

The portable workspace read model renders from:

- `state/business.json`
- `PROJECT_STATE.yaml`
- `state/schema/workspace.schema.json`
- `scripts/render-business-control-plane-workspace.ts`

This panel owns cross-surface design state: app screens, web funnels, marketing assets, App Store pages, Product Page Optimization tests, In-App Events, and shared theme tokens.

## Modeled Panel Shells

The Design Room is active now. The next Control Plane panels are modeled as state-backed shells now, with deeper implementation deferred until the Design Room loop remains stable:

- **Analytics**: activation, attribution, conversion, retention, and experiment dashboards.
- **Monetization**: RevenueCat/Stripe products, entitlements, paywalls, trials, refunds, and LTV/CPA evidence.
- **Store Ops**: App Store Connect/Google Play readiness, screenshots, privacy answers, review notes, releases, CPPs, PPO, and In-App Events.
- **Growth**: paid UA, creator/UGC, Fastlane, referral/share loops, and content cadence.

Each shell must live in `state/business.json` under `controlPlane.panels`, include `stateRefs`, include `renderedArtifacts`, and appear in `design-room.html`. Future panel depth should read the same state store and theme tokens rather than inventing parallel docs.

## Architectural Rules

- Use JSON state when humans need line-level git diffs, baselines, and restore.
- Render views from state; do not hand-author dashboard HTML.
- Keep panel-specific detail in references and scripts, not `SKILL.md`.
- Use stable graph IDs for operators, panels, views, lanes, artifacts, and gates; UI labels are projections and may change without changing identity.
- Read operator capabilities and ownership from the typed definition graph rather than inventing renderer-only roles.
- Let `PROJECT_STATE.yaml` remain the launch lane/status cockpit while `state/business.json` grows into the cross-surface business model.
- Let `render-business-control-plane-workspace.ts` adapt both files into the open Business Control workspace schema instead of teaching UI code to scrape each source directly.
- Add validators before adding new panels so the Control Plane does not become another long prose checklist.
- Run `check-control-plane-contract` and `check:business-control-plane-workspace` whenever panel state changes.

## Portfolio Layer

Everything above is one business deep. The portfolio layer is the surface for the founder's second launch onward — the point where "is this app working" becomes "which of my apps deserves the next hour".

- `business/PORTFOLIO_REGISTRY.md` is the artifact: one row per business (stage, MRR trend, latest Kill, Hold, Or Scale verdict, founder hours), an allocation paragraph, a cross-app learnings table fed by each `LAUNCH_RETRO.md`, and the next-launch pipeline. It lives in the founder's own workspace, never inside a single app's repo, and refreshes at each app's day-30/day-90 retro checkpoints.
- The verdict feeding each row comes from the Kill-Or-Scale Review in `post-launch-operations.md` §9; the registry is where verdicts across apps turn into an allocation decision.
- The per-business rules still hold at portfolio scope: names, brand vocabulary, tokens, domains, and credentials never move between businesses; learnings, engineering patterns, and audiences the founder owns outright do.
- Gate: `check:portfolio-registry` — a no-op until the registry exists, structural once it does. Run it against the founder workspace where the registry actually lives (`npm run check:portfolio-registry -- --root <founder-workspace>` from the installed skill), never bare from inside an app repo — there the file is absent by design and the gate reports a hollow pass. The gate cannot know how many businesses exist, so one-row-per-business completeness is the founder's read of the board, not a machine check.
- Rendered board: `render-business-control-plane-workspace.ts` aggregates several businesses with repeated `--business <dir>` flags (each dir holding its `state/business.json` + `PROJECT_STATE.yaml`), concatenating one entry per business into the `businesses[]` array `state/schema/workspace.schema.json` already models — same per-business adapter, one board. Two businesses resolving to the same slug fail loudly instead of overlaying rows. Example: `npx tsx scripts/render-business-control-plane-workspace.ts --business ~/businesses/app-one --business ~/businesses/app-two --out ~/businesses/board.json` from the installed skill; `--check` verifies a committed board the same way it does single-business output.

## Promotion Path

When a Design Room decision is accepted:

1. Commit the state and render.
2. Run `promote-design-tokens` when theme tokens changed, then commit `design-system/tokens.json`, `design-system/tokens.css`, and `design-system/DesignTokens.swift`.
3. Cascade the accepted decision to canonical business docs such as `DESIGN.md`, `design.md`, `APP_STORE_LISTING.md`, `ONBOARDING.md`, `CONTENT_ASSETS.md`, and `REVENUE_OPS.md` only when those files are in scope.
4. Update `PROJECT_STATE.yaml` if launch readiness changed.
5. Render both `design-room.html` and `launch-cockpit.html` when both state layers changed.
6. Re-render the Business Control workspace read model and run `check:business-control-plane-workspace` before calling it maintained.
