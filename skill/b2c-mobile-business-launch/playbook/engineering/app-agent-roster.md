# App-Local Agent Roster

Use this when creating `AGENTS.md`, `CLAUDE.md`, `PROMPTS.md`, `ENGINEERING_PLAN.md`, builder-ready bundles, or any real app handoff that should continue after bootstrap.

Load `parallel-agent-orchestration.md` and `engineering-orchestration.md` first for orchestration rules. Load `artifact-contracts.md` for accepted file names and handoff structure.

## Required Output

Every real B2C app build or builder-ready package should include:

```text
AGENTS.md
CLAUDE.md
APP_AGENTS.md
agents/
  orchestrator.md
  marketing-guru.md
  engineering-leader.md
  product-leader.md
  design-guru.md
  customer-success.md
  security-architect.md
```

Use `templates/repo-agent-entrypoints/` for the repo-root `AGENTS.md` and `CLAUDE.md`, then use `templates/app-agent-roster/` for `APP_AGENTS.md` and `agents/`. Fill placeholders with the current app's source-of-truth docs, stack, paid-tool decisions, and launch gates.

## Role Model

The app-local roster is not a replacement for `AGENTS.md`, `11_STAR_EXPERIENCE.md`, `TECH_SPEC.md`, `DESIGN.md`, `ANALYTICS.md`, `ONBOARDING.md`, or `PRODUCTION_READINESS.md`. It is a lightweight routing layer for future agents. `AGENTS.md` remains the business-specific canonical guide and must explicitly tell future agents to continue using the `b2c-mobile-business-launch` workflow instead of asking the founder to re-invoke it.

- Orchestrator owns sequencing, source truth, founder-zero business operations, `BUSINESS_ACCESS.md`, its structured ledger, `PROJECT_STATE.yaml`, cockpit, orchestration, failure cards, validators, integration, git/release coordination, and final proof.
- Orchestrator owns Session Continuity: read `AGENTS.md`, state/cockpit, both business/agent operations ledgers, orchestration/readiness/failure docs, and git status; do not rely on chat memory over durable state.
- Orchestrator assumes beginner founder knowledge, gives one plain-language founder action, executes everything else, and continues from the recorded next agent action instead of returning a checklist.
- Marketing guru owns ASO, GEO/SEO, UGC, Fastlane, reviews, launch calendar, claims, channel tests, and attribution learning.
- Engineering leader owns architecture, implementation plans, backend/frontend/provider proof, Apple signing/release gates, observability, tests, and readiness gates.
- Security architect owns `SECURITY.md`, threat model, security tool routing, mobile platform hardening, app integrity, entitlement/webhook abuse controls, supply-chain checks, accepted risks, and incident response.
- Product leader owns ICP, scope, onboarding, activation, retention, roadmap, and evidence-to-product traceability.
- Design guru owns the design system, HTML visual proofs, screenshots, icons, motion, accessibility, and Higgsfield asset fit.
- Customer success owns support, FAQ/help, privacy/delete/refund/restore paths, lifecycle copy, review responses, and feedback triage.

## Subagent Audit Pattern

For non-trivial launches, use the roster to run independent review lanes before declaring the build or launch package complete:

- Product leader reviews `SPEC.md`, `11_STAR_EXPERIENCE.md`, `LAUNCH_TRACE.md`, `ONBOARDING.md`, and activation/retention assumptions.
- Marketing guru reviews `RESEARCH.md`, `LAUNCH.md`, `STORE_CONSOLE.md`, `GEO_SEO.md`, `PAID_UA.md`, `VIRAL_GROWTH.md`, `UGC_PLAYBOOK.md`, `FASTLANE_OPS.md`, and attribution-channel learning.
- Design guru reviews `DESIGN.md`, `design.md`, `design.html`, `11-star-experience.html`, `onboarding.html`, screenshots, accessibility, and visual consistency.
- Engineering leader reviews `TECH_SPEC.md`, `ENGINEERING_PLAN.md`, `APPLE_SIGNING.md`, analytics/revenue/email/backend contracts, signing/release readiness, and test coverage.
- Security architect reviews `SECURITY.md`, `security-review.html`, `SECRETS.md`, `TECH_SPEC.md`, `REVENUE_OPS.md`, `ANALYTICS.md`, `EMAIL_OPS.md`, `PRIVACY.md`, `APPLE_SIGNING.md`, `PRODUCTION_READINESS.md`, scanner/review evidence, app-integrity posture, and accepted risks.
- Customer success reviews `PRIVACY.md`, `TERMS.md`, support routes, refund/restore/delete paths, lifecycle email, FAQ, and review-response readiness.
- Engineering leader and orchestrator review `SECRETS.md` for each new secret, new env vars, Doppler/provider routing, `doppler run --` command wrappers, service token/provider-integration plan, CI/deploy injection, `.env.example` names-only coverage, and public-bundle safety.
- Orchestrator merges findings, resolves conflicts, updates source-of-truth docs, updates `ORCHESTRATION.md`, updates `PROJECT_STATE.yaml`, rerenders `launch-cockpit.html`, and records proof or blockers in `PRODUCTION_READINESS.md`.

Specialist agents should review and propose by default. They may implement only when the orchestrator assigns an isolated unit with file paths, acceptance checks, forbidden actions, and a verification method recorded in `ORCHESTRATION.md`. Specialists must not stage, commit, release, change pricing, connect accounts, spend money, submit store builds, or publish social posts.

## Attribution Audit Gate

The product, engineering, and marketing roles must all check self-reported attribution when onboarding, signup, waitlist, or account creation exists:

- visible "How did you hear about us?" screen appears after the promise/demo but within the first third of onboarding/signup
- source options use stable stored keys instead of display labels
- `other` includes sanitized free text or a documented follow-up field
- `attribution_source_selected` includes the stable key and technical context where available
- PostHog person properties include `self_reported_source`
- backend/profile storage persists the selected source when identity exists
- anonymous attribution is reconciled after signup/login
- tests or live smoke proof show event, person property, and backend/profile write

If any item is missing, do not call attribution wired, complete, or launch-ready.

## Acceptance

- `APP_AGENTS.md` points to canonical docs and states the orchestrator is the integration owner.
- `AGENTS.md` and `CLAUDE.md` are filled for the current business, not copied from this skill repo's maintainer docs.
- `AGENTS.md` tells future agents to keep using `b2c-mobile-business-launch`, update `PROJECT_STATE.yaml`, rerender `launch-cockpit.html`, and run validators until a founder-only gate.
- `AGENTS.md`, `CLAUDE.md`, `APP_AGENTS.md`, `ORCHESTRATION.md`, and `PROJECT_STATE.yaml` encode the Session Continuity source set and next-action handoff.
- Seven role files exist and remain short enough to be used.
- Each role has clear responsibilities, forbidden actions, founder-only gates, and output shape.
- The roster gives future agents a clean way to audit and continue the app without duplicating product truth.
- The orchestrator can show the founder current state through `launch-cockpit.html`, keep orchestration decisions inspectable in `ORCHESTRATION.md`, and keep known misses visible as failure cards.
- The orchestrator can prove business identity, Doppler, account/social access, recovery/2FA ownership, and one-next-action continuity through `BUSINESS_ACCESS.md`, its ledger, and `check:founder-operator`.
