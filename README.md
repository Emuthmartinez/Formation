# B2C Mobile Business Launch Skill

A reusable Codex and Claude skill for turning a B2C mobile app idea, transcript, early repo, or half-built product into a launch-ready business package.

This is a founder-zero launch operating system for consumer apps: the agent assumes the founder knows none of the business tooling, leads setup one plain-language action at a time, and runs research, identity/access, Doppler, socials, positioning, design, security, analytics, revenue, store ops, growth, authenticated operations, device testing, and production-readiness proof.

> **Status:** Public, actively maintained. Licensed under [MIT](LICENSE).

## Who this is for & what you need

This skill is **highly opinionated** and built for **subscription / freemium consumer apps** — not one-time purchases, and it does not (yet) cover ad-based monetization. It encodes proven launch formulas so an agent can take an idea, transcript, or half-built repo and drive it to a real launch.

To use it you need:

- **An AI coding agent that supports skills** — [Claude Code](https://claude.com/claude-code) or Codex. The skill is a set of markdown playbooks plus TypeScript validators that the agent reads and runs; it is **not** a standalone app you launch by itself.
- **Node.js 22** to run the validators (`npm install`); this matches CI and CONTRIBUTING.md.
- *(Optional, swappable)* accounts for the third-party providers the playbooks reference — RevenueCat, Doppler, PostHog, Stripe, Resend, Apple App Store Connect / Google Play, Firecrawl, and similar. Most have free tiers. **None are required to read the playbooks or run the validators**, and the skill always routes an explicit fallback when a paid tool is unavailable.

Install it as a skill (see [Install](#install) below), then give your agent one broad launch request — examples are in [Autopilot Usage](#autopilot-usage).

> Want to **maintain or contribute to** this skill rather than use it? Start with [`AGENTS.md`](AGENTS.md). That file and `CLAUDE.md` are maintainer guides, not usage docs.

## Core Idea

The skill now has two layers:

- Human-readable launch playbooks in `skill/b2c-mobile-business-launch/references/`.
- Machine-checkable launch state and validators through `PROJECT_STATE.yaml`, `launch-cockpit.html`, LaunchBench scenarios, and TypeScript scripts.

That means future agents do not just "remember" the launch process. They can inspect state, render a founder-facing cockpit, run checks, and keep known failure modes visible as failure cards.

## Autopilot Usage

Give one broad launch request and let the skill run. Good prompts look like:

- "Take this transcript and turn it into a business I can launch."
- "I have a half-built B2C app; get it launch-ready and stop only for real approval or access blockers."
- "Get this iOS app ready for TestFlight, App Store Connect, RevenueCat, PostHog, Resend, and launch."

The skill should not require repeated "now use this skill" prompts. Once activated, it routes itself through the right references, tools, artifacts, and validators, then pauses only for founder-only gates such as credentials, spend, legal/pricing approval, public posting, destructive actions, or final submission/release.

## What It Produces

| Lane | Output |
| --- | --- |
| State | `PROJECT_STATE.yaml`, `launch-cockpit.html`, `skill-version.json`, runtime freshness checks, autonomy mode, lane statuses, provider state, proof, and failure cards |
| Founder-Zero Operator | `BUSINESS_ACCESS.md`, `operations/business-access.json`, phase-labeled AskUserQuestion choices, plain-language definitions, skip/fallback/defer behavior, gate lifecycle, business identity, Doppler, account access, and founder/agent next actions |
| Agent Operations | `AGENT_OPERATIONS.md`, `operations/agent-operations.json`, capability discovery, account/environment targeting, scoped approval envelopes, authenticated-browser/API/CLI/native routing, prompt-injection quarantine, before/after proof, and state reconciliation |
| Design Room | `state/business.json`, `state/theme.tokens.json`, `design-room.html`, React/Vite `dist/design-room/`, git-backed versions, baselines, diffs, restores, and wipe-slate operations |
| Research | AppKittie, XPOZ, Firecrawl, ASO, GEO/SEO, review mining, competitor positioning, and launch evidence |
| Experience | `11_STAR_EXPERIENCE.md`, `11-star-experience.html`, 1/2/5/6/7/10/11-star ladder, line of feasibility, V1 scalable slice, and surface translation |
| Product | `SPEC.md`, `TECH_SPEC.md`, `LAUNCH_TRACE.md`, scope locks, acceptance criteria, and builder prompts |
| App Archetypes | Reusable packs for known B2C product shapes, enforced by `check:app-archetype` and `check:archetype-starter`: Social / Community Platform (`references/social-network-lane.md`), AI Chat / Companion (`references/ai-chat-companion-lane.md`), Habit Tracker / Utility (`references/habit-tracker-lane.md`), and Photo / AI Media (`references/photo-ai-media-lane.md`). Each does upfront AskUserQuestion archetype/variant detection (web vs native), names its core systems, ships a **runnable starter scaffold** (Next.js + Supabase with tested RLS, Stripe/RevenueCat stubs, PostHog event catalog, names-only env, CI) plus a dependency-ordered prompt sequence as the customization layer, and threads into the research, design, security, revenue, and growth lanes rather than bypassing them |
| Security | `SECURITY.md`, `security-review.html`, threat model, paid/free security-tool routing, OWASP MASVS/ASVS basis, platform hardening, app integrity, abuse controls, scanner/review proof, and accepted risks |
| Design | `DESIGN.md`, lowercase `design.md`, `UX_PATTERNS.md`, HTML visual proofs, Refero/fallback UX pattern research, Higgsfield visual guidance, Remotion content assets, screenshot systems, and audit gates |
| Analytics | `ANALYTICS.md`, `analytics-plan.html`, PostHog event catalog, attribution contract, dashboards, and QA probes |
| Paid UA | `PAID_UA.md`, one-channel paid acquisition system, creative cadence, tracking baseline, blended report, RevenueCat LTV/CPA review, weekly schedule, and founder-only spend gates |
| Monetization | RevenueCat, Stripe, app-store products, web funnels, entitlement validation, webhooks, restore/refund flows, and proof |
| Viral Growth | `VIRAL_GROWTH.md`, product-led referral/share loops, content format lab, monetization timing, abuse controls, analytics proof, and stop/scale rules |
| Email | Resend DNS, sender map, webhooks, audiences, lifecycle automations, inbound handling, unsubscribe rules, and starter templates |
| Store Ops | App Store listing packets, Apple pre-ASC requirements, App Privacy worksheets, App Store Connect and Google Play copy-paste packets, Apple signing/release readiness, privacy manifest/required-reason API proof, pricing/subscription mapping, CPP/In-App Event plans, localization, ParthJadhav/app-store-screenshots production boards for iPhone/iPad screenshot compositions, App Icon/App Preview routing, review notes, and ASC CLI routing |
| Demo Media | MobAI 2.5-era cross-platform `.mob` flows, Sync Mode/device capture, mobile/desktop recorder routing, Remotion rendered clips/stills, raw capture, edited export, captions, upload copy, and rerender notes |
| Orchestration | `ORCHESTRATION.md`, parallel-agent preflight, candidate units, serialized resources, worktree routing, subagent forbidden actions, collision checks, and integration proof |
| Workflows | Recommended Claude-vs-Codex runtime split (Claude for research-through-spec, Codex for the build — a bias, not a gate; Codex pre-build users get the recommendation surfaced) and Claude Dynamic Workflows for the long-running/parallel/adversarial pre-build stages — `ultracode`, the agent/parallel/pipeline patterns, token/`/goal` discipline, quarantine for untrusted input, and save/ship-as-skill |
| Engineering | business-specific `AGENTS.md`, `CLAUDE.md`, `APP_AGENTS.md`, role prompts, continued skill routing, Compound Engineering routing, the in-app iOS Simulator as the zero-setup default proof route, MobAI test/heal/repeat/host-script safety, performance/debug/CI proof, native iOS E2E, SnapshotPreviews/serve-sim CLI proof, and production readiness |
| Source Freshness | `source-registry.yaml`, weekly upstream docs/tool checks, source-refresh reports, and candidate-source PRs for third-party drift |
| Evals | LaunchBench scenarios and deterministic checks for attribution, signing, store console, UX patterns, secrets, security, source freshness, and launch state |

## Non-Negotiables

- `PROJECT_STATE.yaml` is the compact state contract for phase, autonomy, lane status, provider setup, proof, blockers, and failure cards.
- Broad launches start with a founder-zero operator bootstrap: the agent chooses the next useful step, explains only the founder gate, secures business identity/Doppler/social access, and continues operating instead of returning a checklist.
- Authenticated operations require capability discovery and `AGENT_OPERATIONS.md` plus its structured ledger; account access is never blanket authorization, and completed mutations need exact-target preflight, scoped approval, read-back proof, redaction, and state reconciliation.
- `launch-cockpit.html` is the founder-visible dashboard over that state.
- Research must flow into product, brand, design, implementation, store copy, revenue, privacy, and verification through `LAUNCH_TRACE.md`.
- Every real product needs an 11-star experience contract before build handoff: the visual ladder, line of feasibility, V1 scalable slice, and surface translation must shape `SPEC.md`, `DESIGN.md`, `ONBOARDING.md`, `TECH_SPEC.md`, ads, screenshots, and content.
- Secrets route through `SECRETS.md`, Doppler by default, live docs checks, `doppler run --`, names-only `.env.example`, and production service-token/provider-integration gates.
- Security is a release lane: `SECURITY.md`, `security-review.html`, threat model, security tool routing, mobile/backend/revenue hardening, scanner/review proof, incident response, and accepted risks.
- Attribution is a data contract, not a screen: stable keys, `other` free text, PostHog person properties, backend persistence, anonymous-to-identified reconciliation, and proof.
- Visual work must produce tokenized design docs and rendered HTML proofs, not prose-only direction.
- Content assets route through `CONTENT_ASSETS.md`; Higgsfield fallbacks, Remotion license status, source inputs, render proof, and public-use gates must be explicit.
- Parallel agents are considered by default for broad work, but `ORCHESTRATION.md` and `PROJECT_STATE.yaml` must record the strategy, safe units, serialized resources, forbidden actions, collision checks, integration, and validation proof.
- The skill recommends (as a default bias, not a requirement) Claude for the pre-build stages through the spec and Codex for the core app build; long-running, parallel, or adversarial pre-build stages are best run as Claude Dynamic Workflows (`ultracode`) with a token budget, `/goal`-bounded loops, quarantined untrusted input, and separate producer/verifier agents. When a Codex (or other non-Claude-Code) runtime is doing pre-build work, the skill surfaces that recommendation once without blocking and continues. The runtime in use and any workflow use are recorded in `ORCHESTRATION.md` and `PROJECT_STATE.yaml`. See [`references/dynamic-workflows.md`](skill/b2c-mobile-business-launch/references/dynamic-workflows.md).
- Third-party docs and tool references are tracked in `source-registry.yaml`; new URLs must be registered and weekly source-refresh PRs should be reviewed before becoming launch policy.
- Paid/account-gated tooling requires explicit fallback routing; missing runtime access is not permission to silently downgrade.
- Apple distribution readiness must be proven through `APPLE_SIGNING.md`; a simulator build alone is not enough.
- Apple App Store submission readiness must be proven through `APPLE_APP_STORE_REQUIREMENTS.md`; privacy manifests, required reason APIs, third-party SDK manifest/signature status, App Privacy answers, protected-resource purpose strings, ATT, account deletion, review notes, and archive/upload warnings must be accounted for before pushing a build into App Store Connect.
- Launch-readiness claims should run LaunchBench or deterministic validators where available.

## TypeScript Tooling

The skill ships small TypeScript utilities for generated app repos and skill audits:

```bash
npm install
npm run validate:launch-state -- --root /path/to/app
npm run check:attribution -- --root /path/to/app
npm run check:secrets -- --root /path/to/app
npm run check:security -- --root /path/to/app
npm run check:content-assets -- --root /path/to/app
npm run check:store-screenshots -- --root /path/to/app
npm run check:agent-operations -- --root /path/to/app
npm run check:founder-operator -- --root /path/to/app
npm run check:asc-command-contract -- --skill-root skill/b2c-mobile-business-launch
npm run check:orchestration -- --root /path/to/app
npm run check:apple-signing -- --root /path/to/app
npm run check:apple-requirements -- --root /path/to/app
npm run check:store-console -- --root /path/to/app
npm run check:ux-patterns -- --root /path/to/app
npm run check:onboarding -- --root /path/to/app
npm run check:11-star -- --root /path/to/app
npm run check:emotional-design -- --root /path/to/app
npm run check:viral-growth -- --root /path/to/app
npm run check:paid-ua -- --root /path/to/app
npm run check:post-launch -- --root /path/to/app
npm run check:google-play -- --root /path/to/app
npm run check:backend-contract -- --root /path/to/app
npm run check:analytics-catalog -- --root /path/to/app
npm run check:agent-entrypoints
npm run check:workflow-adherence
npm run check:continuity-contract
npm run check:skill-version -- --source skill/b2c-mobile-business-launch --installed ~/.codex/skills/b2c-mobile-business-launch
npm run check:package-parity
npm run check:compound-engineering -- --root /path/to/app
npm run validate:design-state -- --root /path/to/app
npm run render:design-room -- --root /path/to/app
npm run check:design-room -- --root /path/to/app
npm run render:business-control-plane-workspace -- --root /path/to/app --out /path/to/workspace.json
npm run check:business-control-plane-workspace
npm run design:version -- baseline onboarding-v1 --root /path/to/app
npm run check:source-registry
npm run refresh:source-freshness
npm run check:autopilot
npm run check:app-archetype
npm run check:archetype-starter
npm run check:reference-size
npm run audit:links
npm run render:launch-cockpit -- --root /path/to/app
npm run launchbench
npm run test:validators
npm run evals:behavioral -- --list
```

When running from an installed skill instead of this repo:

```bash
cd ~/.codex/skills/b2c-mobile-business-launch
npm install
npm run validate:launch-state -- --root /path/to/app
```

The scripts are intentionally simple:

- `validate-project-state.ts` checks `PROJECT_STATE.yaml` structure, statuses, provider fields, evidence, blockers, and failure cards.
- `check-attribution-contract.ts` blocks launch-ready attribution unless event, person property, backend persistence, stable keys, `other`, reconciliation, and proof are represented.
- `check-secret-routing.ts` checks `SECRETS.md`, names-only secret routing, forbidden local secret files, and raw secret patterns.
- `check-security-release.ts` checks `SECURITY.md`, security-review routing, OWASP/platform basis, mobile hardening, entitlement/webhook abuse controls, privacy/analytics/email controls, supply-chain checks, incident response, and accepted risks.
- `check-content-assets.ts` checks `CONTENT_ASSETS.md`, Remotion/Higgsfield route decisions, fallback approval, license status, source inputs, render proof, claim review, and manifest shape.
- `check-viral-growth-loop.ts` checks `VIRAL_GROWTH.md`, product/referral/content loops, monetization timing, analytics proof, abuse controls, stop/scale rules, and format-lab evidence.
- `check-launch-narrative.ts` checks `growth/LAUNCH_NARRATIVE.md`, the feeling-first launch thesis and emotional angle, the tentpole-plus-weekly-cadence model and standing-audience compounding, the launch-day run-of-show, traceability refs, and the deterministic 2026 copy guardrails (no hashtags, no emojis, no link in the main announcement post) scanned against the fenced post copy.
- `check-paid-user-acquisition.ts` checks `PAID_UA.md`, one-channel paid acquisition focus, creative cadence, tracking baseline, blended report, RevenueCat LTV/CPA review, weekly schedule, stop/scale rules, and founder-only spend gates.
- `check-store-screenshots.ts` checks `SCREENSHOTS.md`, raw-vs-composed screenshot separation, ParthJadhav/app-store-screenshots or equivalent export routing, iPhone/iPad/Play wells, App Icon/App Preview routing, copy overlays, validation, and visual QA proof.
- `check-native-ios-proof.ts` checks iOS readiness claims for in-app iOS Simulator routing (local session, named simulated device/OS, fixture-account rule, and an explicit no-Android/no-physical-device coverage statement), Codex Desktop native iOS/XcodeBuildMCP routing, SnapshotPreviews preview exports, serve-sim simulator streams, evidence paths, provider-proof pairing, and simulator/preview/signing limitations.
- `check-mobai-proof.ts` keeps desktop/MCP/CLI versions separate, rejects stale executable command guidance, and requires grounded iOS/Android flow evidence plus AI-heal and host-script safety proof when MobAI is used.
- `check-agent-operations.ts` validates the structured capability inventory, approval envelopes, exact account/project/environment targeting, authenticated-browser research provenance, prompt-injection policy, grounded before/after evidence, redaction, and canonical state reconciliation.
- `check-asc-command-contract.ts` rejects known-invalid stored ASC command forms and, when `asc` is installed, checks the documented contract against live local help.
- `check-parallel-orchestration.ts` checks `ORCHESTRATION.md`, top-level orchestration state, strategy, candidate units, overlapping files, spawned-agent forbidden actions, output review, collision checks, and state reconciliation.
- `check-apple-signing-packet.ts` checks Apple Developer, Team ID, bundle ID/App ID, app record, signing, archive/export/upload, TestFlight, and founder gates.
- `check-apple-app-store-requirements.ts` checks `APPLE_APP_STORE_REQUIREMENTS.md`, privacy manifests, required reason APIs, third-party SDK manifests/signatures, Xcode privacy report reconciliation, App Privacy URLs/labels, protected-resource purpose strings, ATT, account deletion, review notes, and archive/upload gates before ASC readiness.
- `check-store-console-packet.ts` checks App Store Connect/Google Play packet coverage and founder-facing console requirements.
- `check-ux-patterns.ts` checks Refero or approved-fallback UX pattern packets, flow maps, state matrices, and HTML proof routing.
- `check-onboarding-conversion.ts` checks `ONBOARDING.md` for the native App Review popup immediately after first value, native API timing, cooldown, analytics, and suppressed-prompt fallback.
- `check-eleven-star-experience.ts` checks the 11-star experience ladder, line of feasibility, V1 scalable slice, surface matrix, visual board, and trace/build links.
- `check-emotional-design.ts` checks the Emotional Experience System artifact contract, per-card guardrails, PostHog event mapping, reduced-motion fallbacks, and dark-pattern veto scans.
- `check-source-freshness.ts` checks that external docs, tools, and websites referenced by the skill are registered for weekly freshness tracking.
- `check-agent-entrypoints.ts` checks maintainer-only root docs and shipped business-repo `AGENTS.md`/`CLAUDE.md` templates stay separated and keep future agents on the launch skill workflow.
- `check-workflow-adherence.ts` checks harness-style agent maps, subagent availability gates, Compound Engineering routing, and LaunchBench coverage for workflow adherence.
- `check-skill-version.ts` checks whether the installed runtime is behind the latest local source copy and emits the AskUserQuestion upgrade gate when stale.
- `check-version-discipline.ts` checks that meaningful skill changes bump `skill-version.json` in the same release commit.
- `check-package-parity.ts` checks source-root and runtime package versions, lockfile versions, critical scripts, audit coverage, and runtime dependency parity.
- `check-compound-engineering-routing.ts` blocks core engineering readiness when CE freshness, plan, work, review, test, and proof routing are missing or silently skipped.
- `check-control-plane-contract.ts` checks that Design Room, analytics, monetization, store ops, and growth are modeled as Control Plane panels.
- `render-business-control-plane-workspace.ts` adapts `state/business.json` plus `PROJECT_STATE.yaml` into the portable Business Control workspace read model and validates it against `state/schema/workspace.schema.json`; `check:business-control-plane-workspace` fails when the committed generated model is stale.
- `check-live-provider-proof.ts` blocks provider-backed readiness claims until `PROVIDER_PROOF.md` has live evidence or founder-only gates.
- `check-artifact-templates.ts` checks that every template `PROJECT_STATE.yaml` evidence path has a starter artifact.
- `run-agent-evals.ts` validates behavior eval definitions for routing choices that deterministic validators cannot fully simulate.
- `check-archetype-starter.ts` checks the runnable starter scaffolds inside the archetype packs: structure completeness with lockfiles, names-only `.env.example`, no secret patterns, RLS migrations plus pgTAP tests, snake_case event catalogs, and a prompt-to-scaffold map covering every pack prompt.
- `check-reference-size.ts` enforces a per-file context budget (64KB) over `references/` plus a tighter budget (45KB) on `SKILL.md`, which loads on every trigger, with an explicit reasoned exclusion list — so oversized references become deliberate split/index decisions and entrypoint additions must be paid for by subtraction.
- `check-analytics-catalog.ts` reconciles events named in `ONBOARDING.md`/`EMOTIONAL_DESIGN.md`/`VIRAL_GROWTH.md` against `ANALYTICS.md`'s catalog (warning at partial, error at done).
- `run-behavioral-evals.ts` is the manual live execution layer: it runs the opt-in `behavioral: true` flagship scenarios against a live Claude agent and grades must_catch/should_say/forbidden with a structured grader — outside the PR gate by design (see the behavioral-evals workflow).
- `promote-design-tokens.ts` and `check-token-promotion.ts` promote `state/theme.tokens.json` into `design-system/` and block stale token handoff.
- `refresh-source-freshness.ts` fetches registered sources, writes a Markdown/HTML/JSON report, and lets the weekly workflow open a reviewable PR.
- `check-autopilot-contract.ts` checks Anthropic-style trigger coverage, negative trigger guards, and the hands-off run contract.
- `audit-skill-links.ts` checks bundled Markdown files for broken local links.
- `render-launch-cockpit.ts` renders `launch-cockpit.html` from `PROJECT_STATE.yaml`.
- `run-launchbench.ts` lints the reusable regression scenario definitions under `evals/launchbench/` (required fields, known-validator references) and then runs the deterministic validator fixtures. Scenario prompts are definitions for agents and reviewers; they are not executed against a live agent by this harness.
- `run-validator-fixtures.ts` exercises positive and negative fixtures so validator false negatives become audit failures.

## Resend Starter Templates

The skill includes `skill/b2c-mobile-business-launch/templates/resend/email-templates.ts`, a TypeScript starter pack for common B2C app email tasks:

- waitlist confirmation
- support request received
- support reply
- entitlement granted
- restore purchases help
- payment failed
- trial expiring
- account deletion confirmed

Each template returns subject, preview, HTML, text, tags, reply-to, optional unsubscribe headers, and an idempotency-key hint. The pack requires `LaunchEmailBrand.designSystem`, so production templates inherit logo, sender identity, colors, typography, radius, spacing, footer rules, support SLA, and legal links from the app's `DESIGN.md`.

## Install

Clone the repo, then install the skill into the Codex runtime copy. Keep Claude
and Agents pointed at the Codex runtime copy so freshness checks can compare
source against installed runtime instead of comparing a symlink to itself:

```bash
mkdir -p ~/.codex/skills ~/.claude/skills ~/.agents/skills

repo_root="$PWD"
rsync -a --delete --exclude node_modules \
  "$repo_root/skill/b2c-mobile-business-launch/" \
  ~/.codex/skills/b2c-mobile-business-launch/

(
  cd ~/.codex/skills/b2c-mobile-business-launch
  npm install
  npm run audit
)

diff -qr --exclude node_modules \
  "$repo_root/skill/b2c-mobile-business-launch" \
  ~/.codex/skills/b2c-mobile-business-launch

ln -sfn ~/.codex/skills/b2c-mobile-business-launch ~/.claude/skills/b2c-mobile-business-launch
ln -sfn ~/.codex/skills/b2c-mobile-business-launch ~/.agents/skills/b2c-mobile-business-launch
```

## Layout

```text
skill/
  b2c-mobile-business-launch/
    SKILL.md
    package.json
    tsconfig.json
    agents/openai.yaml
    evals/launchbench/
    evals/agent-behavior/
    evals/triggering/
    state/
      business.json
      theme.tokens.json
      schema/business.schema.json
    render/
      index.html
      src/
    references/
      source-registry.yaml
    scripts/
    templates/
      PROJECT_STATE.yaml
      state/
      BRAND.md
      DEMO_VIDEO.md
      11-star-experience/
      repo-agent-entrypoints/
      orchestration/
      content-assets/
      growth/
      app-agent-roster/
      resend/
      SECURITY.md
      security-review.html
      secrets/
```

## Validate

```bash
npm install
npm run audit
```

`audit` and `audit:ci` run `scripts/run-audit.ts`, the single orchestrator over the pipeline defined in `scripts/lib/audit-plan.ts` (typecheck first, then every gate, with independent steps run through a small concurrency pool). Useful flags: `--list` (print the resolved plan), `--only <step>` (run a subset), `--serial`, `--concurrency N`. `check:package-parity` fails if a `check:*`/`validate:*` script is neither an audit step nor explicitly excluded with a reason, so gates cannot be silently dropped from the pipeline.

Before broad launch/design work, compare the installed runtime to the source skill:

```bash
npm run check:skill-version -- --source skill/b2c-mobile-business-launch --installed ~/.codex/skills/b2c-mobile-business-launch
```

This skill is intentionally guardrail-heavy. Its job is to prevent launch drift across research, design, build, revenue, legal, store, email, growth, and verification surfaces.

## Contributing

Contributions from humans and agents are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup, the `npm run audit:ci` gate, versioning/source-freshness rules, and PR expectations. Maintainer details live in [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md). The repo is licensed under [MIT](LICENSE).
