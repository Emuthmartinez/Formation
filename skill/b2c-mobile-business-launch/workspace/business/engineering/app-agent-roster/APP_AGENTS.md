# {{APP_NAME}} App Agents

`AGENTS.md` is canonical. These role files are lightweight entrypoints for continuing the app after bootstrap. Do not duplicate product truth here; point back to the source docs.

## Source Docs

- Product: `product/SPEC.md`, `11_STAR_EXPERIENCE.md`, `11-star-experience.html`, `EMOTIONAL_DESIGN.md`, `EMOTIONAL_AUDIT.md`, `state/LAUNCH_TRACE.md`, `strategy/RESEARCH.md`
- State, ownership, access, and external actions: `state/PROJECT_STATE.yaml`, `state/launch-cockpit.html`, `operations/BUSINESS_ACCESS.md`, `operations/business-access.json`, `operations/AGENT_OPERATIONS.md`, `operations/agent-operations.json`, `LAUNCHBENCH.md`, `operations/FAILURE_CARDS.md`
- Design: `strategy/BRAND.md`, `design/DESIGN.md`, `design.md`, `design/design.html`, `SCREENSHOTS.md`, `CONTENT_ASSETS.md`, `content-assets.html`, `growth/DEMO_VIDEO.md`
- Onboarding and analytics: `product/ONBOARDING.md`, `product/onboarding.html`, `analytics/ANALYTICS.md`, `analytics/analytics-plan.html`
- Revenue, email, legal, store, secrets, security: `revenue/REVENUE_OPS.md`, `growth/EMAIL_OPS.md`, `SECRETS.md`, `trust/SECURITY.md`, `trust/security-review.html`, `trust/PRIVACY.md`, `trust/TERMS.md`, `store/APPLE_SIGNING.md`, `store/APPLE_APP_STORE_REQUIREMENTS.md`, `APP_STORE_LISTING.md`, `store/STORE_CONSOLE.md`
- Engineering: `engineering/TECH_SPEC.md`, `operations/ORCHESTRATION.md`, `engineering/ENGINEERING_PLAN.md`, `engineering/PRODUCTION_READINESS.md`

## Roles

- `agents/orchestrator.md`: state owner, integration owner, and final readiness gate.
- `agents/marketing-guru.md`: ASO, GEO/SEO, UGC, Fastlane, social research/profile/content queues, analytics read-back, reviews, launch calendar, claims, and channel learning.
- `agents/engineering-leader.md`: architecture, implementation, backend/frontend/provider proof, Apple signing/release gates, tests, and readiness.
- `agents/security-architect.md`: threat model, security tool routing, platform hardening, app integrity, abuse controls, accepted risks, and incident response.
- `agents/product-leader.md`: ICP, 11-star experience, scope, onboarding, activation, retention, roadmap, and traceability.
- `agents/design-guru.md`: design system, 11-star visual proof, HTML visual proofs, screenshots, accessibility, icons, motion, Higgsfield fit, and Remotion content assets.
- `agents/customer-success.md`: support, FAQ, privacy/delete/refund/restore, lifecycle copy, monitored inbox/comment/review response queues, and feedback triage.

## Operating Rules

- Session Continuity: before role work after a new session, resume, status check, or handoff, the orchestrator reconstructs current state from `AGENTS.md`, `state/PROJECT_STATE.yaml`, `state/launch-cockpit.html`, `operations/BUSINESS_ACCESS.md`, `operations/business-access.json`, `operations/AGENT_OPERATIONS.md`, `operations/agent-operations.json`, `operations/ORCHESTRATION.md`, `engineering/PRODUCTION_READINESS.md`, `operations/FAILURE_CARDS.md`, and `git status --short`. Do not rely on chat memory; role prompts inherit this source set.
- The orchestrator owns `state/PROJECT_STATE.yaml`, `state/launch-cockpit.html`, `operations/BUSINESS_ACCESS.md`, `operations/business-access.json`, `operations/AGENT_OPERATIONS.md`, `operations/agent-operations.json`, `operations/ORCHESTRATION.md`, active failure cards, sequencing, file-overlap checks, actual file collision checks, integration, git/release coordination, and `engineering/PRODUCTION_READINESS.md`.
- Onboarding work loads the routed `knowledge/experience/onboarding-conversion.md` reference and executes the nested `ONB-00` through `ONB-22` graph recorded in `product/ONBOARDING.md`. The orchestrator is the single writer for canonical onboarding state, IDs, pricing, provider decisions, cutover, and readiness. Specialists return evidence or implementation packets unless assigned disjoint paths.
- A rebuild, standardization, replacement, or from-first-principles onboarding request defaults to replacement mode: preserve durable user value through an isolated one-time transformation, hard-cut to the target system, and remove all old runtime code, state, events, provider configuration, tests, and documents. Do not invent an incremental compatibility project because the rebuild is difficult.
- Review eligibility may be earned after meaningful first value, but native review requests occur outside first-run onboarding at a later natural success in normal product use. No custom rating gate, sentiment pre-screen, or unobservable review-submission event is permitted.
- Assume beginner founder knowledge. The orchestrator runs the business workflow, surfaces one plain-language founder action, and resumes the agent's next action immediately after the gate clears.
- Specialists review and propose by default. They implement only when assigned an isolated unit with paths and verification.
- No role may stage, commit, release, submit app-store builds, publish social posts, spend money, change pricing, or connect accounts without founder approval and orchestrator assignment.
- No role may print, paste, commit, screenshot, or log raw secret values. New secrets must be routed through `SECRETS.md` and Doppler or the approved provider before work is called complete.
- Use parallel agents only for independent audits or isolated work with recorded file ownership; serialize shared files, migrations, provider/account mutations, device automation, git, releases, pricing/legal/public posting/submission decisions, and final readiness calls.
- Run deterministic validators or LaunchBench scenarios where available before declaring launch-ready, and record the outcome in `state/PROJECT_STATE.yaml`.

## Required Audit Before Launch-Ready

- Product: 11-star V1 scalable slice, scope, onboarding, activation, and retention match evidence.
- Onboarding graph: `product/ONBOARDING.md` records all `ONB-00` through `ONB-22` nodes, evidence joins, first value, effort, state, screens, controls, paywall, analytics, review, design proof, implementation, and zero-legacy cutover; `check-onboarding-graph.ts` passes.
- Onboarding evidence and design: competitor negative and positive reviews, authorized Onbo Hub flows, internal B2C guidance, current provider and policy capabilities, and 60fps motion references are dispositioned into actual screen designs, button behavior, an interactive prototype, analytics, tests, and deletion tasks.
- Emotional design: `EMOTIONAL_DESIGN.md` or `EMOTIONAL_AUDIT.md` maps applicable moments to Experience Cards, events, bright-line guardrails, reduced-motion fallbacks, and counter-metrics; `check:emotional-design` passes.
- Marketing: ASO, store console, Apple pre-ASC requirements, claims, UGC/Fastlane, GEO/SEO, and attribution channels are ready.
- Design: HTML proofs match `design/DESIGN.md`, no mobile clipping/overlap, `SCREENSHOTS.md` separates raw captures from composed iPhone/iPad/Play assets, and generated/rendered content assets are traceable in `CONTENT_ASSETS.md`.
- Engineering: app, backend, revenue, email, analytics, provider, Apple signing/release, and device paths are verified.
- Secrets: new env vars, webhook secrets, provider keys, CI/deploy secrets, and store credentials are listed in `SECRETS.md` and injected through Doppler or the approved provider.
- Security: `trust/SECURITY.md`, `trust/security-review.html`, threat model, paid/free security-tool route, platform hardening, app integrity, Apple privacy manifest/purpose-string/ATT checks, revenue/webhook abuse controls, supply-chain checks, Sentry/release health, public reporting route, and accepted risks are current.
- Customer success: support, privacy, terms, delete, refund, restore, lifecycle, and review-response paths are ready.
- Attribution: stable source key, `other` free text, `attribution_source_selected`, PostHog `self_reported_source`, backend/profile persistence, and anonymous-to-identified reconciliation are proven when onboarding/signup/waitlist exists.
- Agent operations: capability inventory, exact approval scope, authenticated-browser/native action proof, research provenance, and cross-artifact reconciliation pass `check:agent-operations`.
- Founder-zero operations: business identity, Doppler, social/store account inventory, delegated access, recovery/2FA ownership, and one-next-action continuity pass `check:founder-operator`.
- State: `state/PROJECT_STATE.yaml` matches current artifacts, `state/launch-cockpit.html` is rendered, and active failure cards are assigned or resolved with proof.
- Orchestration: `operations/ORCHESTRATION.md` records strategy, candidate units, serialized resources, subagent forbidden actions, output review, collision checks, integration, and validators.
