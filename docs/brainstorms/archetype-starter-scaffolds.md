# Brainstorm: Executable Archetype Starter Scaffolds

Date: 2026-06-10
Status: decided (implemented in the same change-set)
Compound Engineering note: CE tooling (`ce-brainstorm`/`ce-plan`/`ce-work`) is unavailable in this cloud session; per `playbook/engineering/engineering-orchestration.md` §1b this design pass plus the validator/fixture/eval coverage below is the Standalone Engineering Loop equivalent (plan → bounded slices → adversarial review via validators → test via fixtures → proof via `npm run audit:ci`).

## Problem

The app-archetype packs (`social-network`, `ai-chat-companion`) ship prompts only. A founder gets markdown, not running code: the first hour of every archetype launch is spent re-deriving the same Next.js + Supabase scaffold the prompts assume, and nothing deterministic guarantees that what the agent improvises actually has tested RLS, names-only env handling, or the analytics catalog conventions.

## Decision

Ship a runnable starter under `templates/app-archetypes/<pack>/starter/` for each shipped pack. The prompts remain the customization layer — the starter is the floor they customize, never a replacement for them.

### Shape

Each starter is a minimal, pinned, installable Next.js App Router + Supabase project:

- `package.json` + `package-lock.json` (lockfile generated with `npm install --package-lock-only`; dependency versions pinned from the npm registry at authoring time, recorded in the starter README with the refresh date).
- Supabase wiring per the current `@supabase/ssr` docs (browser client, server client, `proxy.ts` session refresh — Next.js 16 renamed `middleware.ts` to `proxy.ts`; verified against the v16 upgrade guide).
- `supabase/migrations/*.sql` schema with RLS enabled and per-table policies, plus `supabase/tests/*.sql` pgTAP tests exercising owner access and cross-user/anonymous denial — "tested RLS" per `playbook/engineering/backend-data-contract.md`, not prose.
- Stripe stub (checkout + webhook routes, server-only key) and RevenueCat stub (webhook → entitlement projection) so the revenue lane has a place to land; both are inert without keys.
- PostHog wiring with a typed event catalog (`lib/analytics/events.ts`) using the analytics lane's snake_case names (`app_opened`, `signup_completed`, `paywall_viewed`, `purchase_completed`, `attribution_source_selected`, …) plus pack-specific core-loop events.
- `.env.example` names-only (every line `NAME=`), routed per `playbook/operations/secrets-management.md`; every secret-shaped name is registered in `templates/secrets/SECRETS.md` so `check:secrets` sees it as routed.
- A CI workflow (`.github/workflows/ci.yml`) running typecheck + build (placeholder public env only — never secrets).
- A starter README that maps **each existing prompt file** to the scaffold area it customizes.

### Versioning

Starters version with the skill: any starter change is a skill change and bumps `skill-version.json` in the same commit (`check:version-discipline` already enforces this). The starter's own `package.json` version stays `0.1.0` — it is the founder's app's first version, not the skill's. Dependency pins are refreshed deliberately (registry check + docs refresh), not automatically; the weekly source-freshness workflow surfaces upstream doc drift, and a pin refresh is a normal reviewed skill change.

### Sync

Single source of truth: the starter lives only under `templates/app-archetypes/<pack>/starter/` and is copied (`cp -R`) into the business repo like every other template. The maintainer runtime rsync already mirrors `templates/`, so no extra sync machinery. No generation step; what is committed is what ships.

### Validation

New deterministic validator `check:archetype-starter` (`scripts/check-archetype-starter.ts`), registered in `scripts/lib/audit-plan.ts`, both package.json script sets, and `run-launchbench` knownValidators. Per starter it enforces:

- structure completeness (package.json with the pinned core deps and dev/build/typecheck scripts, lockfile present and parseable, tsconfig, next config, `proxy.ts`, app routes, Supabase client/server helpers, Stripe + RevenueCat stubs, PostHog wiring, CI workflow);
- migrations contain `enable row level security` and `create policy`, and an RLS test file exists under `supabase/tests/`;
- `.env.example` is names-only and carries the required names; no real-looking secret pattern anywhere in the starter (same regex family as `check:secrets`); no committed `.env`;
- the event catalog contains the canonical analytics events plus the pack's named core-loop events, all snake_case;
- the starter README references every prompt file in the pack (the prompt→scaffold map), keeping prompts the customization layer.

`check-app-archetype` is extended so a shipped pack declares whether it has a starter; pack README must route to it. Paired pass/fail fixtures live in `scripts/fixtures/archetype.fixtures.ts`; the LaunchBench scenario `archetype-starter-ignored.yaml` locks in the routing behavior (use the shipped starter; do not improvise a scaffold or commit real env values).

### Backend adaptability

The Supabase default stays adaptable per `playbook/engineering/backend-data-contract.md`: the starter README states plainly that if the founder selects Firebase or a custom backend, the migrations/RLS/auth pieces are replaced via the data-contract lane (Backend Selection with a reason, Data Model, tested Authorization Model, Migrations And Environments) and the archetype prompts are adapted — the starter is the supabase-route artifact, not a backend mandate.

## Alternatives considered

- **create-next-app at launch time** — rejected: non-deterministic output over time, no RLS/analytics/secret conventions, network-dependent at the worst moment, and nothing for validators to check.
- **Generator script in `scripts/`** — rejected: a second source of truth that drifts from the prompts; committed files are reviewable and validator-checkable as-is.
- **Starter as a separate repo/template registry** — rejected: breaks the single-skill install story and the runtime sync contract.
- **Vendoring `node_modules` or building in CI** — rejected: lockfile + pinned manifest is enough determinism; installs happen in the business repo.
