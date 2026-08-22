# Validator reference

Every gate the launch skill ships, what it checks, and how to run it. This file is the full map; [CONTRIBUTING.md](../CONTRIBUTING.md) has the short version.

## How the pipeline works

`npm run audit` and `npm run audit:ci` both run [`tooling/run-audit.ts`](../skill/formation/tooling/run-audit.ts), the single orchestrator over the plan defined in [`tooling/lib/audit-plan.ts`](../skill/formation/tooling/lib/audit-plan.ts). Typecheck runs first, then every gate, with independent steps sharing a small concurrency pool.

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
cd ~/.codex/skills/formation
npm install
npm run validate:launch-state -- --root /path/to/app
```

## State and coverage

| Command | What it checks |
| --- | --- |
| `validate:launch-state` | `state/PROJECT_STATE.yaml` structure, statuses, provider fields, evidence, blockers, and failure cards |
| `check:lane-coverage` | Every lane is represented, its dependency edges are satisfied, and founder-gated blockers carry a dated presentation that is re-presented past 30 days (warnings pre-launch, errors on a live app) |
| `check:change-cascade` | A change in one lane propagates to the lanes the Change Cascade Map says it must |
| `check:onboarding-graph` | `product/ONBOARDING.md` is the canonical onboarding graph record: required sections, Graph Run rows for ONB-00..ONB-22, and live (non-hidden) structure |
| `check:onboarding-graph-complete` | The `--require-done` wrapper ONB-22 gates on: every Graph Run row must be done |
| `check:onboarding-cutover-repository` | Every Deletion Manifest row resolved to `delete` names artifacts genuinely absent from the repository — filesystem truth, not prose |
| `check:onboarding-cutover-repository-complete` | The `--require-resolved` wrapper ONB-22 gates on: every Deletion Manifest row must resolve to exactly one terminal disposition |
| `check:onboarding-page-fresh` | `product/onboarding.html` byte-matches a fresh render of `product/ONBOARDING.md` (a `--page`-scoped `check:generated-pages`) |
| `check:provider-proof-onboarding` | ONB-22's provider rows (PostHog/RevenueCat) are backed by `operations/PROVIDER_PROOF.md` evidence (a `--providers`-scoped `check:provider-proof`) |
| `check:onboarding-evidence-onb-00` | ONB-00's own output packet (`product/onboarding/graph/`) exists with real, non-templated resume/scope classification content |
| `check:onboarding-evidence-onb-01` | ONB-01's own output packet (`product/onboarding/graph/`) exists with real, non-templated current-state trace content |
| `check:onboarding-evidence-onb-02` | ONB-02's own output packet (`product/onboarding/graph/`) exists with real, non-templated evidence plan content |
| `check:onboarding-evidence-onb-03` | ONB-03's own output packet (`product/onboarding/graph/`) exists with real, non-templated current guidance research content |
| `check:onboarding-evidence-onb-04` | ONB-04's own output packet (`product/onboarding/graph/`) exists with real, non-templated competitor review mining content |
| `check:onboarding-evidence-onb-05` | ONB-05's own output packet (`product/onboarding/graph/`) exists with real, non-templated authorized Onbo Hub atlas content |
| `check:onboarding-evidence-onb-06` | ONB-06's own output packet (`product/onboarding/graph/`) exists with real, non-templated internal guidance audit content |
| `check:onboarding-evidence-onb-07` | ONB-07's own output packet (`product/onboarding/graph/`) exists with real, non-templated provider and policy landscape content |
| `check:onboarding-evidence-onb-08` | ONB-08's own output packet (`product/onboarding/graph/`) exists with real, non-templated 60fps motion research content |
| `check:onboarding-evidence-onb-09` | ONB-09's own output packet (`product/onboarding/graph/`) exists with real, non-templated evidence join and decisions content |
| `check:onboarding-evidence-onb-10` | ONB-10's own output packet (`product/onboarding/graph/`) exists with real, non-templated first-value and activation milestones content |
| `check:onboarding-evidence-onb-11` | ONB-11's own output packet (`product/onboarding/graph/`) exists with real, non-templated effort and question audit content |
| `check:onboarding-evidence-onb-12` | ONB-12's own output packet (`product/onboarding/graph/`) exists with real, non-templated state and identity contract content |
| `check:onboarding-evidence-onb-13` | ONB-13's own output packet (`product/onboarding/graph/`) exists with real, non-templated analytics and experiment contract content |
| `check:onboarding-evidence-onb-14` | ONB-14's own output packet (`product/onboarding/graph/`) exists with real, non-templated trust, lifecycle, and policy contract content |
| `check:onboarding-evidence-onb-15` | ONB-15's own output packet (`product/onboarding/graph/`) exists with real, non-templated architecture decision content |
| `check:onboarding-evidence-onb-16` | ONB-16's own output packet (`product/onboarding/graph/`) exists with real, non-templated journey graph content |
| `check:onboarding-evidence-onb-17` | ONB-17's own output packet (`product/onboarding/graph/`) exists with real, non-templated screen/control/paywall contract content |
| `check:onboarding-evidence-onb-18` | ONB-18's own output packet (`product/onboarding/graph/`) exists with real, non-templated visual design and prototype proof content |
| `check:onboarding-evidence-onb-19` | ONB-19's own output packet (`product/onboarding/graph/`) exists with real, non-templated implementation and cutover contract content |
| `check:onboarding-evidence-onb-20` | ONB-20's own output packet (`product/onboarding/graph/`) exists with real, non-templated adversarial QA and pre-mortem content |
| `check:onboarding-evidence-onb-21` | ONB-21's own output packet (`product/onboarding/graph/`) exists with real, non-templated Compound Engineering plan content |
| `check:continuity-contract` | A run can be picked up by a different agent without losing state |
| `check:autopilot` | Trigger coverage, negative-trigger guards, and the hands-off run contract |
| `render:launch-cockpit` | Renders `state/launch-cockpit.html` from `state/PROJECT_STATE.yaml` |

## Founder-facing surfaces

| Command | What it checks |
| --- | --- |
| `check:founder-operator` | Business identity, Doppler, account access, and one-decision-at-a-time bootstrap |
| `check:founder-copy` | No raw identifier, phase code, status value, or internal vocabulary reaches a founder-visible surface. `tooling/lib/founder-copy.ts` is the only sanctioned path from state to founder text |
| `check:no-slop` | Banned words and named slop patterns in shipped copy and repo docs, with rules parsed from `knowledge/words/no-slop-writing.md` |
| `check:app-copy` | No internal vocabulary, placeholder filler, or raw identifier in the words a user reads: `product/copy/COPY_DECK.md` cells, the `product/ONBOARDING.md` Copy column, `engineering/TECH_SPEC.md`'s string-externalization contract, and the shipped starters. Rules parsed from `knowledge/words/conversion-copy.md`; live apps (phase_6*) warn while their backfill is tracked |
| `check:generated-pages` | No founder-facing page in `business/` is hand-authored or undeclared: every HTML page names its Markdown source and matches it |
| `check:agent-operations` | Capability inventory, approval envelopes, exact account and environment targeting, prompt-injection policy, before/after evidence, redaction, and state reconciliation |
| `migrate:founder-gates` | One-time migration of older founder-gate shapes |

## Research, product, and experience

| Command | What it checks |
| --- | --- |
| `check:research` | Launch evidence exists and is attributable |

## Design

| Command | What it checks |
| --- | --- |
| `validate:design-state` | `studio/seed/business.json` against its schema |
| `check:design-room` | The Design Room artifact contract |
| `check:control-plane` | Design Room, analytics, monetization, store ops, and growth are modeled as Control Plane panels |
| `check:business-control-plane-workspace` | The committed generated workspace read model is not stale |
| `check:emotional-design` | Emotional Experience System contract, per-card guardrails, PostHog event mapping, reduced-motion fallbacks, dark-pattern veto scans (spend-near-reward co-location is an error unless the copy states the separation or prohibits the pattern), and cross-file risk-tier parity between the `experience-cards.md` index and the `ethics-guardrail.md` risk table (one row per mechanism, valid tiers only) |
| `check:scrollytelling` | Checks the shipped runtime and applicable landing contracts for stable IDs, story order, sources, locales, fallbacks, and recorded viewport QA. Browser tests must verify timing and visual quality. |
| `check:token-promotion` | `studio/seed/theme.tokens.json` reached `design/system/` before handoff |
| `check:vibecoded-tells` | The mechanical subset of `knowledge/design/vibecoded-tells.md` over landing/web-surface source: default icon packs and missing terms/privacy links as errors, plus warning-tier default tells (emoji in markup, default fonts, indigo-purple gradients, glassmorphism, blobs, sparkle icons, checkmark walls, bounce cues) that each demand a `design/design.md` derivation row |
| `promote:design-tokens` | Promotes theme tokens into `design/system/` |
| `render:design-room` | Renders the Design Room, with a static fallback |
| `render:business-control-plane-workspace` | Adapts state into the portable workspace read model and validates it against `state/schema/workspace.schema.json` |
| `seed:design-brief` | Seeds a starting design brief |
| `design:version` | Baselines, diffs, restores, and versions design state |

## Security, privacy, and secrets

| Command | What it checks |
| --- | --- |
| `check:secrets` | `SECRETS.md`, names-only routing, forbidden local secret files, and raw secret patterns |
| `check:security` | `trust/SECURITY.md`, security-review routing, OWASP and platform basis, mobile hardening, entitlement and webhook abuse controls, supply-chain checks, incident response, and accepted risks |
| `check:privacy` | The mechanical subset of the ten-risk legal/privacy checklist in `knowledge/trust/privacy-terms.md` §7: `trust/PRIVACY.md`/`trust/TERMS.md` existence, data-collection/third-party/AI/deletion disclosures, cancellation-as-easy-as-signup and auto-renewal-reminder terms, a public-storage-bucket smell in `engineering/TECH_SPEC.md`/`trust/SECURITY.md`, and a self-harm/crisis response in `trust/AI_SAFETY.md` |
| `check:template-safety` | Templates carry no real or real-looking secret values |

## Revenue, growth, and email

| Command | What it checks |
| --- | --- |
| `check:revenue` | RevenueCat/Stripe products, offering, pricing decision, live probe proof, and — once live four-plus weeks — current Paywall Experiment Backlog activity (active row, completed row within eight weeks, or a dated next experiment) |
| `check:paid-ua` | `PAID_UA.md` one-channel focus, creative cadence, tracking baseline, blended report, LTV/CPA review, weekly schedule, stop/scale rules with recorded decision thresholds, and founder-only spend gates |
| `check:landing-funnel` | Landing and funnel structure against the launch funnel contract |
| `check:email` | Resend DNS, sender map, webhooks, audiences, lifecycle automations, inbound handling, and unsubscribe rules |
| `check:post-launch` | `operations/POST_LAUNCH_OPS.md` operating cadence after release, including the day-30/day-90 Kill, Hold, Or Scale verdict in `operations/LAUNCH_RETRO.md` |
| `check:portfolio-registry` | `strategy/PORTFOLIO_REGISTRY.md` multi-app board (businesses, allocation, cross-app learnings, next-launch pipeline); no-op until the registry exists |
| `probe:revenuecat` | Live probe against a configured RevenueCat project |

## Analytics

| Command | What it checks |
| --- | --- |
| `check:attribution` | Attribution as a data contract: stable keys, `other` free text, PostHog person properties, backend persistence, anonymous-to-identified reconciliation, and proof |
| `check:analytics-catalog` | Events named in `product/ONBOARDING.md`, `EMOTIONAL_DESIGN.md`, `VIRAL_GROWTH.md`, and `revenue/REVENUE_OPS.md` reconcile against the `analytics/ANALYTICS.md` catalog. Warns at partial, errors at done |
| `probe:posthog` | Live probe against a configured PostHog project |

## Store operations and release

| Command | What it checks |
| --- | --- |
| `check:apple-requirements` | Privacy manifests, required-reason APIs, third-party SDK manifests and signatures, Xcode privacy report reconciliation, App Privacy URLs and labels, purpose strings, ATT, account deletion, review notes, and archive gates |
| `check:store-console` | App Store Connect and Google Play packet coverage and founder-facing console requirements |
| `check:store-screenshots` | `SCREENSHOTS.md`, raw versus composed separation, export routing, iPhone/iPad/Play wells, App Icon and App Preview routing, copy overlays, and visual QA proof |
| `check:asc-command-contract` | Rejects known-invalid stored `asc` command forms and, when `asc` is installed, checks the documented contract against live local help |
| `check:motion-contract` | Motion craft contract consistency: the spring-family bands, token table, and presets stated in `premium-mobile-craft.md`/`motion-craft-benchmarks.md` must match `tokens.json`, `PremiumCraft.swift`, and the experience-card canon; the cinematic token stays out of the in-app doctrine; every `DesignTokens.Motion` member, `motion.*` token (inline or fenced, including embedded expressions), and `--motion-*` CSS variable cited by reference or template markdown resolves to a shipped name; `design/DESIGN.md` and `EMOTIONAL_DESIGN.md` agree on each card moment's tokens; the motion-catalog pack's copied presets (`TokenSpring.swift`, `motion-tokens.ts`) match `PremiumCraft.swift`'s duration members and bounces and `motion-tokens.ts`'s ms table matches `tokens.json`. Run `npm run check:motion-contract -- --workspace-root /path/to/business-workspace` from the skill source checkout or installed runtime to validate an active workspace. |
| `grade:screenshots` | Grades screenshot compositions against the visual rubric |

## Engineering and proof

| Command | What it checks |
| --- | --- |
| `check:native-ios` | iOS readiness claims: in-app Simulator routing, named device and OS, fixture-account rule, explicit coverage statement, XcodeBuildMCP routing, preview exports, evidence paths, and stated limitations |
| `check:mobai-proof` | Keeps desktop, MCP, and CLI versions separate, rejects stale executable command guidance, and requires grounded iOS/Android flow evidence plus AI-heal and host-script safety proof |
| `check:source-checkpoint` | A recoverable source checkpoint (repository + first commit) exists before the launch reports build progress; warning during setup, error once engineering starts |
| `check:orchestration` | `operations/ORCHESTRATION.md` strategy, candidate units, overlapping files, spawned-agent forbidden actions, output review, collision checks, and state reconciliation |
| `check:backend-contract` | The backend data contract behind the app |
| `check:compound-engineering` | Blocks core engineering readiness when Compound Engineering freshness, plan, work, review, test, and proof routing are missing or silently skipped |
| `check:content-assets` | `CONTENT_ASSETS.md` route decisions, fallback approval, license status, source inputs, render proof, claim review, and manifest shape |
| `check:provider-proof` | Blocks provider-backed readiness claims until `operations/PROVIDER_PROOF.md` has live evidence or founder-only gates |

## Skill maintenance

These run against this repo rather than a target app.

| Command | What it checks |
| --- | --- |
| `check:skill-version` | Whether the installed runtime is behind local source, emitting the upgrade gate when stale |
| `check:version-discipline` | Meaningful skill changes bump `skill-version.json` in the same release commit |
| `check:package-parity` | Source-root and runtime package versions, lockfiles, critical scripts, audit coverage, and runtime dependency parity |
| `check:reference-size` | A 64KB per-file budget over `knowledge/` and `validation/repository/` and a 45KB budget on `SKILL.md`, with a reasoned exclusion list; `validation/repository/evals/` and `validation/repository/fixtures/` are exempt as machine-read data rather than agent-loaded prose |
| `check:catalog` | Catalog graph integrity: id/path/binding resolution, node contracts (instructions/reads/knowledge/role), hub flags, plus the knowledge-package rules — duplicate or over-length `load_when` triggers, source staleness against review cadence, lifecycle/binding validity, and `workflow.no_knowledge` for business workflows |
| `catalog:render-routing` | Renders the generated projections — `catalog/generated/routing.md` (domain routing + Reference Index with role-scoped markers), `spine.md` (phase spine + the phase × area matrix), `contracts.md` (per-node contract sheet + provider access-route matrix), `catalog.json`, `knowledge/README.md`, and the SKILL.md Lane Routing splice; `-- --check` fails on drift |
| `check:hub-spoke` | Bidirectional hub↔spoke integrity: every spoke's `Part of the` backlink is reciprocated by its hub, and the catalog `hub:` flag matches reality in both directions |
| `check:learning-grounding` | Captured learnings under `knowledge/*/learnings/`: the four contract sections exist, every evidence citation resolves to a real file and line, dates are valid, refresh verdicts pair with the manifest lifecycle, and reviews older than 180 days surface as warnings |
| `check:adapter-contract` | Contract A's gate: every golden boundary/import report validates against its schema at the declared `ADAPTER_CONTRACT_VERSION`, negative controls are correctly refused (the detector proving it detects), and a code-version bump without regenerated goldens fails — the bump discipline made mechanical |
| `check:engine-e2e` | The engine end to end against a throwaway copy of the reference business: bootstrap (entrypoints → v1 migration → reducer adoption → onboarding answers), a fixture-executor session that dispatches real frontier work, founder approvals through `approve.ts`, a resumed session whose verifier sweep independently accepts fresh-context work with an audit-log attestation, and a verifier-off control run that must leave work parked — proving the detector detects |
| `check:validator-docs` | This file: every documented command exists as an npm script, and every `check:*`/`validate:*` script has a row here |
| `check:documentation-ste100` | The mechanically checkable ASD-STE100 subset (sentence length, present-perfect tense) over this repo's technical docs and knowledge references |
| `check:gates-layout` | `validation/business/` mirrors the `knowledge/` domains: nothing sits at the `validation/business/` root, every gate folder names a real domain (read from `knowledge/`, never hardcoded), and no basename is held by two script roots at once — a guarantee a flat `validation/business/` gave for free |
| `check:artifact-templates` | Every template `state/PROJECT_STATE.yaml` evidence path has a starter artifact |
| `check:app-archetype` | The archetype packs cover their advertised shapes |
| `check:archetype-starter` | Starter scaffolds: structure completeness with lockfiles, names-only `.env.example`, no secret patterns, RLS migrations plus pgTAP tests, snake_case event catalogs, and a prompt-to-scaffold map |
| `check:source-registry` / `check:source-freshness` | External docs, tools, and sites referenced anywhere in the repo are registered for weekly freshness tracking; when the refresh job's snapshot state exists, sources past their cadence surface as warnings. Generated freshness reports and machine-local `.claude/worktrees/` checkouts are excluded from the scan |
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
| `test:fixtures` | Skill fixtures: compile/frontier/dispatch/run-state/boundary behavior, the launch-matrix projection, knowledge-package rules, and port-ledger completeness |
| `test:boundaries` | Capability-boundary suites: each attempts a forbidden action through the real autonomy modules (grants, budget, waivers, kill switch, prerequisites, producer-never-writes) and asserts rejection with a recorded reason |
| `test:parity` | Cross-runtime adapter parity: one fixture scenario through every capability profile must yield identical node reachability, approval/waiver requirements, and parked reasons |
| `check:agent-evals` | Validates behavior eval definitions for routing choices deterministic validators cannot simulate |
| `evals:behavioral` | Runs the opt-in `behavioral: true` scenarios against a live agent and grades must_catch, should_say, and forbidden with a structured grader. Outside the PR gate by design |

`npm run evals:behavioral -- --list` prints the behavioral subset without spending tokens.
