# {{APP_NAME}} App Agents

`AGENTS.md` is canonical. These role files are lightweight entrypoints for continuing the app after bootstrap. Do not duplicate product truth here; point back to the source docs.

## Source Docs

- Product: `SPEC.md`, `11_STAR_EXPERIENCE.md`, `11-star-experience.html`, `EMOTIONAL_DESIGN.md`, `EMOTIONAL_AUDIT.md`, `LAUNCH_TRACE.md`, `RESEARCH.md`
- State, ownership, access, and external actions: `PROJECT_STATE.yaml`, `launch-cockpit.html`, `BUSINESS_ACCESS.md`, `operations/business-access.json`, `AGENT_OPERATIONS.md`, `operations/agent-operations.json`, `LAUNCHBENCH.md`, `FAILURE_CARDS.md`
- Design: `BRAND.md`, `DESIGN.md`, `design.md`, `design.html`, `SCREENSHOTS.md`, `CONTENT_ASSETS.md`, `content-assets.html`, `DEMO_VIDEO.md`
- Onboarding and analytics: `ONBOARDING.md`, `onboarding.html`, `ANALYTICS.md`, `analytics-plan.html`
- Revenue, email, legal, store, secrets, security: `REVENUE_OPS.md`, `EMAIL_OPS.md`, `SECRETS.md`, `SECURITY.md`, `security-review.html`, `PRIVACY.md`, `TERMS.md`, `APPLE_SIGNING.md`, `APPLE_APP_STORE_REQUIREMENTS.md`, `APP_STORE_LISTING.md`, `STORE_CONSOLE.md`
- Engineering: `TECH_SPEC.md`, `ORCHESTRATION.md`, `ENGINEERING_PLAN.md`, `PRODUCTION_READINESS.md`

## Roles

- `agents/orchestrator.md`: state owner, integration owner, and final readiness gate.
- `agents/marketing-guru.md`: ASO, GEO/SEO, UGC, Fastlane, social research/profile/content queues, analytics read-back, reviews, launch calendar, claims, and channel learning.
- `agents/engineering-leader.md`: architecture, implementation, backend/frontend/provider proof, Apple signing/release gates, tests, and readiness.
- `agents/security-architect.md`: threat model, security tool routing, platform hardening, app integrity, abuse controls, accepted risks, and incident response.
- `agents/product-leader.md`: ICP, 11-star experience, scope, onboarding, activation, retention, roadmap, and traceability.
- `agents/design-guru.md`: design system, 11-star visual proof, HTML visual proofs, screenshots, accessibility, icons, motion, Higgsfield fit, and Remotion content assets.
- `agents/customer-success.md`: support, FAQ, privacy/delete/refund/restore, lifecycle copy, monitored inbox/comment/review response queues, and feedback triage.

## Operating Rules

- Session Continuity: before role work after a new session, resume, status check, or handoff, the orchestrator reconstructs current state from `AGENTS.md`, `PROJECT_STATE.yaml`, `launch-cockpit.html`, `BUSINESS_ACCESS.md`, `operations/business-access.json`, `AGENT_OPERATIONS.md`, `operations/agent-operations.json`, `ORCHESTRATION.md`, `PRODUCTION_READINESS.md`, `FAILURE_CARDS.md`, and `git status --short`. Do not rely on chat memory; role prompts inherit this source set.
- The orchestrator owns `PROJECT_STATE.yaml`, `launch-cockpit.html`, `BUSINESS_ACCESS.md`, `operations/business-access.json`, `AGENT_OPERATIONS.md`, `operations/agent-operations.json`, `ORCHESTRATION.md`, active failure cards, sequencing, file-overlap checks, actual file collision checks, integration, git/release coordination, and `PRODUCTION_READINESS.md`.
- Assume beginner founder knowledge. The orchestrator runs the business workflow, surfaces one plain-language founder action, and resumes the agent's next action immediately after the gate clears.
- Specialists review and propose by default. They implement only when assigned an isolated unit with paths and verification.
- No role may stage, commit, release, submit app-store builds, publish social posts, spend money, change pricing, or connect accounts without founder approval and orchestrator assignment.
- No role may print, paste, commit, screenshot, or log raw secret values. New secrets must be routed through `SECRETS.md` and Doppler or the approved provider before work is called complete.
- Use parallel agents only for independent audits or isolated work with recorded file ownership; serialize shared files, migrations, provider/account mutations, device automation, git, releases, pricing/legal/public posting/submission decisions, and final readiness calls.
- Run deterministic validators or LaunchBench scenarios where available before declaring launch-ready, and record the outcome in `PROJECT_STATE.yaml`.

## Required Audit Before Launch-Ready

- Product: 11-star V1 scalable slice, scope, onboarding, activation, and retention match evidence.
- Emotional design: `EMOTIONAL_DESIGN.md` or `EMOTIONAL_AUDIT.md` maps applicable moments to Experience Cards, events, bright-line guardrails, reduced-motion fallbacks, and counter-metrics; `check:emotional-design` passes.
- Marketing: ASO, store console, Apple pre-ASC requirements, claims, UGC/Fastlane, GEO/SEO, and attribution channels are ready.
- Design: HTML proofs match `DESIGN.md`, no mobile clipping/overlap, `SCREENSHOTS.md` separates raw captures from composed iPhone/iPad/Play assets, and generated/rendered content assets are traceable in `CONTENT_ASSETS.md`.
- Engineering: app, backend, revenue, email, analytics, provider, Apple signing/release, and device paths are verified.
- Secrets: new env vars, webhook secrets, provider keys, CI/deploy secrets, and store credentials are listed in `SECRETS.md` and injected through Doppler or the approved provider.
- Security: `SECURITY.md`, `security-review.html`, threat model, paid/free security-tool route, platform hardening, app integrity, Apple privacy manifest/purpose-string/ATT checks, revenue/webhook abuse controls, supply-chain checks, Sentry/release health, public reporting route, and accepted risks are current.
- Customer success: support, privacy, terms, delete, refund, restore, lifecycle, and review-response paths are ready.
- Attribution: stable source key, `other` free text, `attribution_source_selected`, PostHog `self_reported_source`, backend/profile persistence, and anonymous-to-identified reconciliation are proven when onboarding/signup/waitlist exists.
- Agent operations: capability inventory, exact approval scope, authenticated-browser/native action proof, research provenance, and cross-artifact reconciliation pass `check:agent-operations`.
- Founder-zero operations: business identity, Doppler, social/store account inventory, delegated access, recovery/2FA ownership, and one-next-action continuity pass `check:founder-operator`.
- State: `PROJECT_STATE.yaml` matches current artifacts, `launch-cockpit.html` is rendered, and active failure cards are assigned or resolved with proof.
- Orchestration: `ORCHESTRATION.md` records strategy, candidate units, serialized resources, subagent forbidden actions, output review, collision checks, integration, and validators.
