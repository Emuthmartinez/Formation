# Validator reference

Every gate this skill ships, what it checks, and how to run it. The short version lives in the [README](../README.md#validators); this file is the full map.

## How the pipeline works

`npm run audit` and `npm run audit:ci` both run [`scripts/run-audit.ts`](../skill/b2c-mobile-business-launch/scripts/run-audit.ts), the single orchestrator over the plan defined in [`scripts/lib/audit-plan.ts`](../skill/b2c-mobile-business-launch/scripts/lib/audit-plan.ts). Typecheck runs first, then every gate, with independent steps sharing a small concurrency pool.

```bash
npm install
npm run audit                       # full local pipeline
npm run audit:ci                    # exactly what CI runs, no maintainer-only steps
npm run audit -- --list             # print the resolved plan without running it
npm run audit -- --only check:secrets
npm run audit -- --serial
npm run audit -- --concurrency 4
```

Two properties keep the plan honest:

- `check:package-parity` fails when a `check:*` or `validate:*` script is neither an audit step nor explicitly excluded with a reason, so a gate cannot be quietly dropped.
- `npm run test:validators` runs positive and negative fixtures, so a validator that silently stops catching its failure mode becomes an audit failure rather than a green build.

Steps marked `[ci-skip]` in `--list` are maintainer-only and skip automatically when their tooling is absent. `[repo-only]` steps run against this repo rather than a target app.

## Running a gate against your app

Most validators take `--root`, pointing at the app repo the skill is launching:

```bash
npm run validate:launch-state -- --root /path/to/app
npm run check:security       -- --root /path/to/app
npm run check:revenue        -- --root /path/to/app
```

From an installed runtime copy instead of this repo:

```bash
cd ~/.codex/skills/b2c-mobile-business-launch
npm install
npm run validate:launch-state -- --root /path/to/app
```

## State and coverage

| Command | What it checks |
| --- | --- |
| `validate:launch-state` | `PROJECT_STATE.yaml` structure, statuses, provider fields, evidence, blockers, and failure cards |
| `check:lane-coverage` | Every lane is represented, its dependency edges are satisfied, and founder-gated blockers carry a dated presentation that is re-presented past 30 days (warnings pre-launch, errors on a live app) |
| `check:change-cascade` | A change in one lane propagates to the lanes the Change Cascade Map says it must |
| `check:launch-trace` | Research reaches product, brand, design, store copy, revenue, privacy, and verification through `LAUNCH_TRACE.md` |
| `check:continuity-contract` | A run can be picked up by a different agent without losing state |
| `check:autopilot` | Trigger coverage, negative-trigger guards, and the hands-off run contract |
| `render:launch-cockpit` | Renders `launch-cockpit.html` from `PROJECT_STATE.yaml` |

## Founder-facing surfaces

| Command | What it checks |
| --- | --- |
| `check:founder-operator` | Business identity, Doppler, account access, and one-decision-at-a-time bootstrap |
| `check:founder-copy` | No raw identifier, phase code, status value, or internal vocabulary reaches a founder-visible surface. `scripts/lib/founder-copy.ts` is the only sanctioned path from state to founder text |
| `check:no-slop` | Banned words and named slop patterns in shipped copy and repo docs, with rules parsed from `references/no-slop-writing.md` |
| `check:agent-operations` | Capability inventory, approval envelopes, exact account and environment targeting, prompt-injection policy, before/after evidence, redaction, and state reconciliation |
| `migrate:founder-gates` | One-time migration of older founder-gate shapes |

## Research, product, and experience

| Command | What it checks |
| --- | --- |
| `check:research` | Launch evidence exists and is attributable |
| `check:product-spec` | `SPEC.md` scope locks, acceptance criteria, and — at a done product lane — the Differentiation And Moat contract: two research-grounded incumbent rows, an affirmed moat class with its build plan (or the named-dated-day-30 V1 exception), and a substantive one-week-copy answer |
| `check:11-star` | The experience ladder, line of feasibility, V1 scalable slice, surface matrix, visual board, and build links |
| `check:onboarding` | Onboarding contract: attribution, App Review popup after first value, paywall proof, and the push permission prime at an earned post-value moment — never in the same step as the review popup (or a not-applicable decision with a substantive reason) |
| `check:ux-patterns` | Refero or approved-fallback UX pattern packets, flow maps, state matrices, and HTML proof routing |
| `check:localization-research` | Market and locale research behind localization decisions |

## Design

| Command | What it checks |
| --- | --- |
| `validate:design-state` | `state/business.json` against its schema |
| `check:design-room` | The Design Room artifact contract |
| `check:control-plane` | Design Room, analytics, monetization, store ops, and growth are modeled as Control Plane panels |
| `check:business-control-plane-workspace` | The committed generated workspace read model is not stale |
| `check:emotional-design` | Emotional Experience System contract, per-card guardrails, PostHog event mapping, reduced-motion fallbacks, and dark-pattern veto scans |
| `check:token-promotion` | `state/theme.tokens.json` reached `design-system/` before handoff |
| `promote:design-tokens` | Promotes theme tokens into `design-system/` |
| `render:design-room` | Renders the Design Room, with a static fallback |
| `render:business-control-plane-workspace` | Adapts state into the portable workspace read model and validates it against `state/schema/workspace.schema.json` |
| `seed:design-brief` | Seeds a starting design brief |
| `design:version` | Baselines, diffs, restores, and versions design state |

## Security, privacy, and secrets

| Command | What it checks |
| --- | --- |
| `check:secrets` | `SECRETS.md`, names-only routing, forbidden local secret files, and raw secret patterns |
| `check:security` | `SECURITY.md`, security-review routing, OWASP and platform basis, mobile hardening, entitlement and webhook abuse controls, supply-chain checks, incident response, and accepted risks |
| `check:privacy-terms` | `PRIVACY.md` and `TERMS.md` coverage against what the app actually collects |
| `check:template-safety` | Templates carry no real or real-looking secret values |

## Revenue, growth, and email

| Command | What it checks |
| --- | --- |
| `check:revenue` | RevenueCat/Stripe products, offering, pricing decision, live probe proof, and — once live four-plus weeks — current Paywall Experiment Backlog activity (active row, completed row within eight weeks, or a dated next experiment) |
| `check:paid-ua` | `PAID_UA.md` one-channel focus, creative cadence, tracking baseline, blended report, LTV/CPA review, weekly schedule, stop/scale rules with recorded decision thresholds, and founder-only spend gates |
| `check:viral-growth` | Viral loop contract: mechanics, abuse controls, analytics proof, measured Loop Economics (k) at done, and the UGC playbook with its Post-Breakout Scale Model |
| `check:launch-narrative` | `growth/LAUNCH_NARRATIVE.md` launch thesis, tentpole-plus-weekly cadence, run-of-show, traceability, and the deterministic copy guardrails scanned against the fenced post copy |
| `check:landing-funnel` | Landing and funnel structure against the launch funnel contract |
| `check:email` | Resend DNS, sender map, webhooks, audiences, lifecycle automations, inbound handling, and unsubscribe rules |
| `check:post-launch` | `POST_LAUNCH_OPS.md` operating cadence after release, including the day-30/day-90 Kill, Hold, Or Scale verdict in `LAUNCH_RETRO.md` |
| `check:portfolio-registry` | `PORTFOLIO_REGISTRY.md` multi-app board (businesses, allocation, cross-app learnings, next-launch pipeline); no-op until the registry exists |
| `probe:revenuecat` | Live probe against a configured RevenueCat project |

## Analytics

| Command | What it checks |
| --- | --- |
| `check:attribution` | Attribution as a data contract: stable keys, `other` free text, PostHog person properties, backend persistence, anonymous-to-identified reconciliation, and proof |
| `check:analytics-catalog` | Events named in `ONBOARDING.md`, `EMOTIONAL_DESIGN.md`, `VIRAL_GROWTH.md`, and `REVENUE_OPS.md` reconcile against the `ANALYTICS.md` catalog. Warns at partial, errors at done |
| `probe:posthog` | Live probe against a configured PostHog project |

## Store operations and release

| Command | What it checks |
| --- | --- |
| `check:apple-signing` | Apple Developer, Team ID, bundle ID and App ID, app record, signing, archive, export, upload, TestFlight, and founder gates |
| `check:apple-requirements` | Privacy manifests, required-reason APIs, third-party SDK manifests and signatures, Xcode privacy report reconciliation, App Privacy URLs and labels, purpose strings, ATT, account deletion, review notes, and archive gates |
| `check:store-console` | App Store Connect and Google Play packet coverage and founder-facing console requirements |
| `check:store-screenshots` | `SCREENSHOTS.md`, raw versus composed separation, export routing, iPhone/iPad/Play wells, App Icon and App Preview routing, copy overlays, and visual QA proof |
| `check:aso-metadata` | Store metadata against field limits and keyword strategy |
| `check:google-play` | Google Play release readiness |
| `check:asc-command-contract` | Rejects known-invalid stored `asc` command forms and, when `asc` is installed, checks the documented contract against live local help |
| `check:motion-contract` | Motion craft contract consistency: the spring-family bands, token table, and presets stated in `premium-mobile-craft.md`/`motion-craft-benchmarks.md` must match `tokens.json`, `PremiumCraft.swift`, and the experience-card canon; the cinematic token stays out of the in-app doctrine; every `DesignTokens.Motion` member, `motion.*` token (inline or fenced, including embedded expressions), and `--motion-*` CSS variable cited by reference or template markdown resolves to a shipped name; `DESIGN.md` and `EMOTIONAL_DESIGN.md` agree on each card moment's tokens; the motion-catalog pack's copied presets (`TokenSpring.swift`, `motion-tokens.ts`) match `PremiumCraft.swift`'s duration members and bounces and `motion-tokens.ts`'s ms table matches `tokens.json` |
| `grade:screenshots` | Grades screenshot compositions against the visual rubric |

## Engineering and proof

| Command | What it checks |
| --- | --- |
| `check:native-ios` | iOS readiness claims: in-app Simulator routing, named device and OS, fixture-account rule, explicit coverage statement, XcodeBuildMCP routing, preview exports, evidence paths, and stated limitations |
| `check:mobai-proof` | Keeps desktop, MCP, and CLI versions separate, rejects stale executable command guidance, and requires grounded iOS/Android flow evidence plus AI-heal and host-script safety proof |
| `check:orchestration` | `ORCHESTRATION.md` strategy, candidate units, overlapping files, spawned-agent forbidden actions, output review, collision checks, and state reconciliation |
| `check:backend-contract` | The backend data contract behind the app |
| `check:compound-engineering` | Blocks core engineering readiness when Compound Engineering freshness, plan, work, review, test, and proof routing are missing or silently skipped |
| `check:content-assets` | `CONTENT_ASSETS.md` route decisions, fallback approval, license status, source inputs, render proof, claim review, and manifest shape |
| `check:provider-proof` | Blocks provider-backed readiness claims until `PROVIDER_PROOF.md` has live evidence or founder-only gates |
| `check:paid-tool-decisions` | Paid and account-gated tooling has explicit fallback routing |

## Skill maintenance

These run against this repo rather than a target app.

| Command | What it checks |
| --- | --- |
| `check:agent-entrypoints` | Maintainer-only root docs and shipped business-repo `AGENTS.md`/`CLAUDE.md` templates stay separated |
| `check:workflow-adherence` | Agent maps, subagent availability gates, Compound Engineering routing, and LaunchBench coverage |
| `check:skill-version` | Whether the installed runtime is behind local source, emitting the upgrade gate when stale |
| `check:version-discipline` | Meaningful skill changes bump `skill-version.json` in the same release commit |
| `check:package-parity` | Source-root and runtime package versions, lockfiles, critical scripts, audit coverage, and runtime dependency parity |
| `check:reference-size` | A 64KB per-file budget over `references/` and a 45KB budget on `SKILL.md`, with a reasoned exclusion list |
| `check:artifact-templates` | Every template `PROJECT_STATE.yaml` evidence path has a starter artifact |
| `check:app-archetype` | The archetype packs cover their advertised shapes |
| `check:archetype-starter` | Starter scaffolds: structure completeness with lockfiles, names-only `.env.example`, no secret patterns, RLS migrations plus pgTAP tests, snake_case event catalogs, and a prompt-to-scaffold map |
| `check:source-registry` | External docs, tools, and sites referenced anywhere in the repo are registered for weekly freshness tracking; generated freshness reports and machine-local `.claude/worktrees/` checkouts are excluded from the scan |
| `refresh:source-freshness` | Fetches registered sources, writes a report, and lets the weekly workflow open a reviewable PR |
| `audit:links` | Bundled markdown files have no broken local links |
| `validate:skill` | Maintainer-only skill lint, skipped when its tooling is absent |
| `lint:format` / `format` | Prettier over the validator sources |
| `sync:runtime` | Maintainer-only installed-runtime sync. Takes `--bootstrap` when no install exists |

## Evals

| Command | What it runs |
| --- | --- |
| `launchbench` | Lints the regression scenario definitions under `evals/launchbench/` (required fields, known-validator references), then runs the deterministic validator fixtures. Scenario prompts are definitions for agents and reviewers, not live executions |
| `test:validators` | Positive and negative fixtures, so validator false negatives become audit failures |
| `check:agent-evals` | Validates behavior eval definitions for routing choices deterministic validators cannot simulate |
| `evals:behavioral` | Runs the opt-in `behavioral: true` scenarios against a live agent and grades must_catch, should_say, and forbidden with a structured grader. Outside the PR gate by design |

`npm run evals:behavioral -- --list` prints the behavioral subset without spending tokens.
