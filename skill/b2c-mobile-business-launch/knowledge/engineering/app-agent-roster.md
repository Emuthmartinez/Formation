# App-Local Agent Roster

Use this when creating `AGENTS.md`, `CLAUDE.md`, `PROMPTS.md`, `engineering/ENGINEERING_PLAN.md`, builder-ready bundles, or any real app handoff that should continue after bootstrap.

Load `parallel-agent-orchestration.md` and `engineering-orchestration.md` first for orchestration rules. Load `artifact-contracts.md` for accepted file names and handoff structure.

## Required Output

Every real B2C app build or builder-ready package should include:

```text
AGENTS.md
CLAUDE.md
APP_AGENTS.md
agents/
  orchestrator.md
  operator-readiness.md
  research-strategist.md
  product-leader.md
  design-guru.md
  copy-specialist.md
  marketing-guru.md
  launch-surface-producer.md
  mobile-engineer.md
  backend-infrastructure-engineer.md
  accessibility-device-qa.md
  security-architect.md
  engineering-leader.md
  customer-success.md
```

Use `workspace-template/repo-agent-entrypoints/` for the repo-root `AGENTS.md` and `CLAUDE.md`, then use `workspace/business/engineering/app-agent-roster/` for `APP_AGENTS.md` and `agents/`. Install the portable `catalog.json`, `.b2c-launch/runtime.json`, and founder-owned `.b2c-launch/BUSINESS_CONTEXT.md` with them. Refresh managed prompts from the current skill version, preserve replaced prompt bytes for recovery, and never overwrite `BUSINESS_CONTEXT.md`.

## Role Model

The app-local roster is not a replacement for `AGENTS.md`, `product/experience/11-star-experience/11_STAR_EXPERIENCE.md`, `engineering/TECH_SPEC.md`, `design/design.md`, `analytics/ANALYTICS.md`, `product/ONBOARDING.md`, or `engineering/PRODUCTION_READINESS.md`. It is a lightweight routing layer for future agents. `AGENTS.md` remains the business-specific canonical guide and must explicitly tell future agents to continue using the `b2c-mobile-business-launch` workflow instead of asking the founder to re-invoke it.

- Orchestrator owns sequencing, source truth, founder-zero business operations, `operations/BUSINESS_ACCESS.md`, its structured ledger, reducer-mediated `state/business-state.json`, orchestration, failure cards, validators, integration, git/release coordination, and final proof.
- Orchestrator owns Session Continuity: read `AGENTS.md`, state/cockpit, both business/agent operations ledgers, orchestration/readiness/failure docs, and git status; do not rely on chat memory over durable state.
- Orchestrator assumes beginner founder knowledge. It runs `operator-readiness.md` once at orient,
  creates standing authority for routine external work, and combines missing access into one handoff.
- Every prepared prompt has matching `catalog/roles.ts` and `catalog/operators.ts` records. A prompt that cannot be selected by the graph is a validation failure.
- Dispatch nesting is fixed: `AGENTS.md` → `.b2c-launch/BUSINESS_CONTEXT.md` → `APP_AGENTS.md` → specialist prompt → mandatory workflow references → matching role context-pack references → matching installed skills → current tool schemas. The always-on founder-language pack is present for every role. The worker returns an exact knowledge receipt before its output can reconcile.
- Research strategist owns source quality, customer language, market/category evidence, competitor evidence, and research-to-decision traceability.
- Product leader acts as the product and UX expert for ICP, scope, core loop, onboarding, activation, retention, interaction behavior, and evidence-to-product traceability.
- Design guru acts as the visual-design expert for hierarchy, composition, design-system expression, HTML visual proofs, screenshots, icons, imagery, and motion.
- Copy specialist owns product copy, conversion copy, brand voice, comprehension, customer language, and claim discipline.
- Marketing guru acts as the marketing and growth expert for positioning, ASO, GEO/SEO, acquisition, lifecycle, conversion, reviews, and channel learning.
- Launch surface producer builds the local landing site after design acceptance. This role also keeps public surfaces synchronized with app changes.
- Mobile engineer owns iOS and Android architecture, implementation, performance, platform behavior, and focused mobile tests.
- Backend and infrastructure engineer owns data, API, auth, jobs, deployment, observability, and provider integration.
- Accessibility and device QA specialist owns assistive-technology checks, device coverage, locale and screen stress, and real-flow evidence.
- Security architect acts as the security and release reviewer for threat analysis, platform hardening, privacy controls, signing, store requirements, supply-chain checks, and readiness evidence.
- Engineering leader owns cross-stack integration review, plan coherence, and unresolved frontend/backend/provider seams.
- Customer success owns support, FAQ/help, privacy/delete/refund/restore paths, lifecycle copy, review responses, and feedback triage.

## Subagent Audit Pattern

For non-trivial launches, select the specialists that match ready work. Run independent read-only reviews in parallel. Keep edit scopes disjoint. Give each role only the bounded source set in its prompt.

- Product leader reviews `product/SPEC.md`, `product/experience/11-star-experience/11_STAR_EXPERIENCE.md`, `state/LAUNCH_TRACE.md`, `product/ONBOARDING.md`, and activation/retention assumptions.
- Marketing guru reviews `strategy/RESEARCH.md`, `growth/LAUNCH_NARRATIVE.md`, `store/STORE_CONSOLE.md`, `GEO_SEO.md`, `growth/PAID_UA.md`, `growth/VIRAL_GROWTH.md`, `growth/UGC_PLAYBOOK.md`, `growth/FASTLANE_OPS.md`, and attribution-channel learning.
- Design guru reviews `design/design.md`, `design/design.html`, `product/experience/11-star-experience/11-star-experience.html`, `product/onboarding.html`, screenshots, accessibility, and visual consistency.
- Launch surface producer uses `initial-build` mode when `design/design.md` is accepted. Use `impact-audit` mode before each accepted app slice merges.
- Orchestrator uses `operator-readiness.md` before build work and before an unattended resume with stale capabilities. This is a serialized provider prompt, not a specialist mutation lane.
- Engineering leader reviews `engineering/TECH_SPEC.md`, `engineering/ENGINEERING_PLAN.md`, `store/APPLE_SIGNING.md`, analytics/revenue/email/backend contracts, signing/release readiness, and test coverage.
- Security architect reviews `trust/SECURITY.md`, `trust/security-review.html`, `trust/secrets/SECRETS.md`, `engineering/TECH_SPEC.md`, `revenue/REVENUE_OPS.md`, `analytics/ANALYTICS.md`, `growth/EMAIL_OPS.md`, `trust/PRIVACY.md`, `store/APPLE_SIGNING.md`, `engineering/PRODUCTION_READINESS.md`, scanner/review evidence, app-integrity posture, and accepted risks.
- Customer success reviews `trust/PRIVACY.md`, `trust/TERMS.md`, support routes, refund/restore/delete paths, lifecycle email, FAQ, and review-response readiness.
- Engineering leader and orchestrator review `trust/secrets/SECRETS.md` for each new secret, new env vars, Doppler/provider routing, `doppler run --` command wrappers, service token/provider-integration plan, CI/deploy injection, `.env.example` names-only coverage, and public-bundle safety.
- Orchestrator merges findings, resolves conflicts, updates source-of-truth docs, updates `operations/ORCHESTRATION.md`, commits typed state patches through the reducer to `state/business-state.json`, and records proof or blockers in `engineering/PRODUCTION_READINESS.md`.

Specialist agents should review and propose by default. They may implement only when the orchestrator assigns an isolated unit with file paths, acceptance checks, forbidden actions, and a verification method recorded in `operations/ORCHESTRATION.md`. They never mutate shared state, stage, commit, spend, change protected pricing/legal/identity fields, or decide a final release. They may apply an approved provider mutation, public artifact, store-media/metadata update, or test-build upload only in an exact assigned workflow with a matching current standing envelope, before-state, and provider read-back.

Every prompt uses the same handoff headings: Scope reviewed, Evidence, Findings, Recommendations, Files changed, Validation, Risks and blockers, and Proposed state patch. The orchestrator accepts or rejects the proposed patch and is the only writer of shared state.

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
- `AGENTS.md` tells future agents to keep using `b2c-mobile-business-launch`, update `state/business-state.json` only through the reducer, and run validators until a founder-only gate.
- `AGENTS.md`, `CLAUDE.md`, `APP_AGENTS.md`, `.b2c-launch/runtime.json`, `.b2c-launch/BUSINESS_CONTEXT.md`, `catalog.json`, `operations/ORCHESTRATION.md`, and `state/business-state.json` encode the Session Continuity source set and next-action handoff.
- The orchestrator, specialist prompts, engineering integration prompt, and customer-success prompt exist and remain short enough to be used.
- The launch-surface prompt gives future agents exact initial-build, impact-audit, bounded-update, and approved-external-apply modes.
- Each role has clear responsibilities, forbidden actions, founder-only gates, and output shape.
- The roster gives future agents a clean way to audit and continue the app without duplicating product truth.
- The orchestrator can show the founder current state through the session digest, keep orchestration decisions inspectable in `operations/ORCHESTRATION.md`, and keep known misses visible as failure cards.
- The orchestrator can prove business identity, Doppler, account/social access, recovery/2FA ownership, and one-next-action continuity through `operations/BUSINESS_ACCESS.md`, its ledger, and `check:founder-operator`.
