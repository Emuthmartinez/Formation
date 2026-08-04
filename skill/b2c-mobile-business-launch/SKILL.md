---
name: b2c-mobile-business-launch
description: "Use when the user wants to launch, prepare, submit, market, design, version, baseline, operationalize, or have an agent run a B2C mobile app business from an idea, transcript, spec, early repo, or half-built app. Trigger on natural requests like 'launch this app', 'turn this transcript into a business', 'set up the business side', 'run my mobile business', 'set up or manage my socials', 'organize secure operator access with Doppler', 'get this iOS app ready for TestFlight/App Store Connect', 'prepare App Store/Google Play submission', 'set up RevenueCat/Stripe/PostHog/Resend', 'prepare paid user acquisition', or 'create a launch package'. Runs the end-to-end launch autopilot plus Design Room workflow: state, research, 11-star experience, security, analytics, paid UA, ASO/store ops, revenue, privacy/terms, email, testing, production readiness, and LaunchBench. Do not use for narrow one-off code fixes, generic legal copy, or unrelated B2B/internal tools."
metadata:
  short-description: Launch a B2C mobile app business end to end
---

# B2C Mobile Business Launch

Turn an app idea, transcript, spec, or half-built repo into a launchable business: evidence, positioning, 11-star experience, design, build, store, revenue, growth, and verification. A run leaves durable state behind — `state/PROJECT_STATE.yaml`, a founder-visible `state/launch-cockpit.html`, a versioned Design Room over `studio/seed/business.json`, and validator/LaunchBench proof for known failure modes.

Two rules shape everything. **Evidence first:** AppKittie/category economics, then social-language research, then canonical docs, then a builder-ready bundle and a live waitlist or purchase funnel. **Nothing carries over:** never copy names, prices, tokens, domains, or credentials from a prior launch unless this project explicitly owns them.

## How To Use This File

1. **Always-On Contracts** govern every session — read once, apply throughout.
2. **Start Here** is the opening sequence: six moves before any lane work.
3. **Lane Routing** is the index. Find the row matching the work in front of you, load only that row's references, produce its artifacts, run its gate. Do not preload the table.
4. This file *routes*. Phase detail lives in [`knowledge/process/launch-phases.md`](./knowledge/process/launch-phases.md); artifact acceptance criteria live in [`knowledge/process/artifact-contracts.md`](./knowledge/process/artifact-contracts.md); completeness auditing lives in [`knowledge/process/launch-coverage.md`](./knowledge/process/launch-coverage.md).

## Always-On Contracts

Never speak this file's internal vocabulary to a founder: no lane ids, no phase codes, no status values like `not_started` or `blocked`, no bare "gate," and no tool names such as AskUserQuestion. Say what is actually happening, in plain language. Load [`knowledge/words/no-slop-writing.md`](./knowledge/words/no-slop-writing.md) before writing anything a founder reads.

### Autopilot Run Contract

When this skill activates for broad launch/business work, keep running the launch workflow without asking the user to re-invoke this skill. Compile the applicable definition graph into the launch-specific run graph and execute its readiness frontier. Load the next needed reference yourself. Workers return outputs, evidence, and proposed state patches; the orchestrator-owned reducer is the only writer to update `state/PROJECT_STATE.yaml`, render `state/launch-cockpit.html`, mutate shared provider state, and reconcile integration state. Run the relevant validators before readiness claims. Do not stop with instructions. When the cockpit changes or the session ends, narrate what happened, what is next, and what needs the founder.

Assume a beginner founder. Load [`knowledge/operations/founder-zero-operator.md`](./knowledge/operations/founder-zero-operator.md), seed access state, present one plain-language action, do the rest, and continue when access clears.

Only pause for founder-only gates: credentials, secrets, account access; spend; legal/pricing; domains; public actions; destruction; or final submission/release decisions. Everything else — bounded strategy and design calls included — you resolve yourself (prefer `llm-council` when available).

### Founder Question Contract

Every gate follows [`knowledge/operations/founder-zero-operator.md`](./knowledge/operations/founder-zero-operator.md): name the current phase and the outcome at stake, define unfamiliar terms, offer two or three choices with the recommendation first, state each choice's consequence and the next agent action, and always include a Skip or defer route plus a fallback. Use AskUserQuestion when available and the same choices as a plain-text fallback otherwise.

Protected gates (access, spend, legal/pricing, public, release, destructive) may defer but never bypass approval; silence does not grant consent; direct founder instructions supersede stale gates.

### Prove It Before Calling It Done

Provider-backed work — analytics, revenue, email, store, security, engineering — needs live proof or a recorded founder-only decision in `operations/PROVIDER_PROOF.md`. Setup prose alone does not make a lane done. Load [`knowledge/process/provider-proof.md`](./knowledge/process/provider-proof.md) as any provider-backed lane nears readiness.

Before browser, provider, social, or device work: load [`knowledge/operations/frontier-agent-operations.md`](./knowledge/operations/frontier-agent-operations.md), scope what you're approved to do, quarantine untrusted page content, and reconcile its ledger with state and the cockpit afterward.

### Runtime Freshness Gate

Before substantial launch, design, store, revenue, or build work, check whether the installed skill runtime is behind the latest available source copy: run `npm run check:skill-version` from the installed skill, or compare `skill-version.json` manually if the helper is unavailable.

If the runtime is stale, ask the founder whether to update now or continue on the installed version. Never silently continue stale unless the founder declines or the latest source copy is unavailable. [`validation/repository/skill-versioning.md`](./validation/repository/skill-versioning.md) carries the ask flow, commands, and local sync rules.

### Design Runs Through State, Not Documents

All design, visual-system, cross-surface, App Store creative, landing, onboarding, paywall, and marketing-surface work follows one loop: **STATE → MUTATE → VERSION → RENDER**.

1. **STATE** — read `studio/seed/business.json` and `studio/seed/theme.tokens.json`; seed from the skill's `state/` or `business/state/` if missing.
2. **MUTATE** — make one coherent JSON state mutation. Never invent a one-off design proposal doc or ad-hoc HTML proof.
3. **VERSION** — validate, render, and version with git. Baselines are `git tag baseline/<name>`; diffs and restores operate on `state/`.
4. **RENDER** — show `design/design-room.html` or the React/Vite build in `dist/design-room/`. The renderer reads state and tokens; it is the committed visual medium.

The founder reviews the rendered Design Room; the agent edits the state. When theme tokens change and the design is accepted, run the token promotion path so `studio/seed/theme.tokens.json` flows into app-facing `design/system/` artifacts before implementation depends on the visual system.

### Runtime Routing And Dynamic Workflows

The skill recommends Claude for the pre-build stages through the spec and Codex for
the core app build. This is a bias, not a gate: either runtime can do any stage, the
founder decides, and the skill never blocks or refuses work in whichever runtime is
in front of it. Record which runtime owns which lane in `operations/ORCHESTRATION.md` and
`state/PROJECT_STATE.yaml` so later sessions do not re-litigate it.

**On a non-Claude-Code runtime** (detectable because `ultracode`/`/workflows`/`/deep-research`
are unavailable) doing a pre-build stage: surface the recommendation **once**, plainly, not as
a founder-only gate; record that it was surfaced in `state/PROJECT_STATE.yaml`; then continue in the
current runtime regardless. Never downgrade quality because a runtime lacks workflows — run the
same fan-out, adversarial-verification, and quarantine shapes as subagents or inline.

Load [`knowledge/orchestration/dynamic-workflows.md`](./knowledge/orchestration/dynamic-workflows.md) **when
starting any pre-build stage** — on Claude Code to decide whether that stage earns a workflow,
and on a non-Claude runtime to run the surfacing protocol above. Not "before proposing a
workflow": on Claude that is after the selection decision the reference exists to inform, and
on Codex it never fires at all. The reference carries which stages qualify, the token-budget
and quarantine rules, and the subagent fallback.

## Start Here

Six moves, in order, before lane work begins.

1. **Recover source truth.** Read the transcript/spec/repo; identify business, platform, and phase. Load `founder-zero-operator.md`, seed access state, ask only when a decision genuinely remains.
2. **Detect the app archetype.** If the request matches a shipped product shape, route its pack instead of improvising schema and core loop — see the App Archetypes table below. Confirm the shape via AskUserQuestion (variant, primary surface web vs native, optional systems) and record it in `state/PROJECT_STATE.yaml`.
3. **Create or refresh durable state.** Use [`knowledge/orchestration/project-state.md`](./knowledge/orchestration/project-state.md), [`knowledge/orchestration/autonomy-modes.md`](./knowledge/orchestration/autonomy-modes.md), and [`workspace/business/state/PROJECT_STATE.yaml`](./workspace/business/state/PROJECT_STATE.yaml). Resume from `AGENTS.md`, state, cockpit, `operations/BUSINESS_ACCESS.md`, both operations ledgers, readiness/failure docs, and git status — repo truth beats chat memory. Render the cockpit early and again after state or gates change. Confirm the launch scope now (essentials is the first-launch default) per [`knowledge/process/launch-phases.md`](./knowledge/process/launch-phases.md).
4. **Resolve paid-tool routing before any fallback.** Use [`knowledge/operations/paid-tool-routing.md`](./knowledge/operations/paid-tool-routing.md) before replacing AppKittie, XPOZ, Firecrawl, Higgsfield, MobAI Plus/Pro capability or cross-platform coverage, Fastlane, paid ASO/MMP tools, creator marketplaces, or RevenueCat/Stripe/PostHog/Resend account features with a free route. MobAI Free needs no spend gate when its one-device/quota limits fit. Missing runtime access is never permission to narrow platform coverage silently — and the zero-setup in-app simulator is a rung, not a replacement: choosing it where the lane needs Android, a repeatable suite, CI, or distribution proof is the same downgrade and needs the same ask.
5. **Route secrets before service setup.** Use [`knowledge/operations/secrets-management.md`](./knowledge/operations/secrets-management.md) and [`knowledge/operations/provider-state-recipes.md`](./knowledge/operations/provider-state-recipes.md) plus [`business/trust/secrets/`](./workspace/business/trust/secrets) before any API key, token, OAuth credential, webhook signing secret, service-account file, CI/deploy env var, or local `.env`. Default to Doppler and `doppler run --` unless the founder approves another path. Refresh current provider docs and local CLI help before install/setup commands, and record the docs basis in `SECRETS.md` and `state/PROJECT_STATE.yaml`.
6. **Plan security before architecture hardens.** Use [`knowledge/trust/security-release-hardening.md`](./knowledge/trust/security-release-hardening.md) before threat modeling, security-tool routing, OWASP MASVS/ASVS checks, MobSF/static scans, app-integrity decisions, Sentry/release-health setup, `trust/SECURITY.md`, `trust/security-review.html`, public `security.txt`, or any security readiness claim.

From there, route by the work in front of you using Lane Routing below. When the question is *what comes next* rather than *what governs this*, use the Phase Spine below.

## Lane Routing

Find the row matching the work in front of you and load that domain's index. Each index carries the per-file load-when triggers, the artifacts, and the gates — load only the row it names, never the whole domain. Do not preload this table's targets.

<!-- graph-generated:start domain-routing -->
| Area of the business | Route here when | Load |
| --- | --- | --- |
| Running the launch | starting or auditing a launch: phases, coverage, artifact contracts, traceability, provider proof, or propagating a change across surfaces | [`knowledge/process/README.md`](knowledge/process/README.md) |
| Driving the work | resuming a session, durable state, how much to decide alone, subagents, dynamic workflows, engineering routing | [`knowledge/orchestration/README.md`](knowledge/orchestration/README.md) |
| Running the business | founder access and accounts, credentials and secrets, paid-tool decisions, authenticated actions, lifecycle email, and life after launch | [`knowledge/operations/README.md`](knowledge/operations/README.md) |
| Market research | before the spec hardens: category economics, competitors, review mining, social language, and which storefronts and locales are worth shipping | [`knowledge/research/README.md`](knowledge/research/README.md) |
| What you're building | scope, the core loop, V1 versus later, the copy-proof test, and shipped app archetypes | [`knowledge/product/README.md`](knowledge/product/README.md) |
| How the app feels | the standout moment, onboarding and activation, engagement mechanics and their ethics limits, push lifecycle, and work targeting better-than-expected | [`knowledge/experience/README.md`](knowledge/experience/README.md) |
| Look and feel | brand, visual system, design tokens, motion, premium in-app craft, UX patterns, screen specs, rendered design state, and generated visual assets | [`knowledge/design/README.md`](knowledge/design/README.md) |
| Every word a user reads | conversion copy, every in-app string, brand voice, and the writing-quality bar for anything a human reads | [`knowledge/words/README.md`](knowledge/words/README.md) |
| Building the app | architecture, backend and data contract, engineering orchestration, device and simulator proof, and agent roles handed to future sessions | [`knowledge/engineering/README.md`](knowledge/engineering/README.md) |
| App Store and Google Play | metadata, ASO, keywords, screenshots, listing packets, privacy answers, locale choices, console walkthroughs, signing, uploads, release and rejection handling | [`knowledge/store/README.md`](knowledge/store/README.md) |
| Pricing and getting paid | RevenueCat, Stripe, store products, paywalls, subscriptions, entitlements, webhooks, taxes, restore purchases, and purchase proof | [`knowledge/money/README.md`](knowledge/money/README.md) |
| Marketing and growth | paid acquisition, viral and referral loops, launch narrative, creators, scheduled social, landing and funnel pages, and search visibility | [`knowledge/growth/README.md`](knowledge/growth/README.md) |
| Analytics and tracking | before anything names an event: the event catalog, attribution, dashboards, funnels, flags, experiments, and replay | [`knowledge/data/README.md`](knowledge/data/README.md) |
| Privacy, security, and legal | threat modeling, platform hardening, scans, privacy policy and terms, account and data deletion, and store privacy disclosures | [`knowledge/trust/README.md`](knowledge/trust/README.md) |
<!-- graph-generated:end domain-routing -->

Maintaining this skill rather than running a launch — versioning, the eval harness, source freshness — is [`validation/repository/README.md`](./validation/repository/README.md), not a lane.

## Ground Rules

- **Evidence beats taste.** Category, pricing, keywords, social language, and moat claims need App Store, competitor, review, XPOZ/social, or live funnel evidence.
- **Design the extreme before cutting scope.** The 11-star ladder chooses the one magical V1 moment every downstream lane must carry.
- **Charge every user-facing moment before specs harden.** Experience Cards are mechanics that fill the 6/7-star levels, not decoration; each needs a PostHog event, a bright-line guardrail, and a reduced-motion fallback before build handoff. Engineered emotion serving the user's real goal builds durable retention; the same mechanics aimed at extraction are dark patterns and a compliance veto.
- **Lock phase outputs before depending on them.** No design from an unlocked spec, no ASO from an unlocked name, no landing page from drifting pricing or voice.
- **Scope before producing.** Confirm the launch scope at orient; essentials defers breadth lanes with dated reasons. Overproduction and silent lane-skipping are both misses — and most dead launches die in planning.
- **Keep `state/PROJECT_STATE.yaml` current.** It is the compact state contract validators, subagents, and future sessions read instead of re-reading every doc.
- **Treat session continuity as a validator-backed contract.** New sessions, resumes, status checks, and handoffs reconstruct state from durable files, route broad work through `APP_AGENTS.md` role prompts or record why subagents were unavailable, and leave the next action in state before pausing.
- **Never silently downgrade paid or account-gated tooling.** Missing runtime access means ask, wait for access/export, or use a founder-approved fallback.
- **Keep third-party guidance fresh.** New external sources get registered in `source-registry.yaml`; fast-moving commands need current docs or local CLI help before an agent repeats them.
- **Preserve a clear source of truth.** Every launch leaves an agent entrypoint (`AGENTS.md`) plus product, brand, design, analytics, launch, and handoff docs.
- **Treat public claims as liabilities.** Avoid unsupported endorsement, revenue, neuroscience, health, urgency, scarcity, and pricing claims.
- **Treat security as a release lane.** Working screens are not launch-ready; threat model, secret routing, platform hardening, entitlement/webhook abuse controls, monitoring, and incident response need evidence or explicit blockers.
- **Verify what shipped.** Landing and funnel work: local build, deploy and live HTTP checks, form smoke tests, analytics event checks, crawl, GEO/SEO, and AI-crawler checks, and mobile/desktop visual QA.
- **Recommend the runtime split, do not enforce it.** See Runtime Routing And Dynamic Workflows.
- **Treat versioning as git state, not prose labels.** Baselines, diffs, restores, and wipes operate on `state/`.
- **Treat Control Plane, the Business Control workspace read model, live-provider proof, behavior evals, artifact starters, and token promotion as mechanically enforced contracts.** Run their validators before completion claims.

## Phase Spine

The ordered walk lives in [`spine.md`](./spine.md) — phases, focus, and primary
output per phase. Load it when the question is *what comes next*; this file
answers *what governs this*. Entry and exit criteria per phase are in
[`knowledge/process/launch-phases.md`](./knowledge/process/launch-phases.md).

## What Counts As Done

A launch package is complete when a future agent can pick it up **without re-deciding the business**. From durable files, not chat memory, the repo answers:

- what the app is, who it is for, what category it competes in and why
- what ships in V1, what is explicitly V2/V3, and what is banned
- what `state/PROJECT_STATE.yaml` says about phase, autonomy mode, lane statuses, launch scope and its dated deferrals, provider state, orchestration strategy, proof, active failure cards, and current blockers — and what `state/launch-cockpit.html` shows the founder
- how research became product, experience, brand, design, build, store, legal, revenue, analytics, and verification decisions (`state/LAUNCH_TRACE.md`)
- which founder-only gates are open and whether each intended paid tool was approved, fell back, or is blocked
- what is live, what has live provider proof, and what still requires founder action

The full per-lane evidence checklist is the Coverage Matrix and Handoff Completeness Checklist in [`knowledge/process/launch-coverage.md`](./knowledge/process/launch-coverage.md); per-artifact acceptance criteria are in [`knowledge/process/artifact-contracts.md`](./knowledge/process/artifact-contracts.md). Audit against those before claiming readiness, and let no known miss hide behind prose.
