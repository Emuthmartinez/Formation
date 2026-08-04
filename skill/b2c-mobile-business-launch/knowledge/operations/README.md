# Running The Business

Founder access, credentials, which paid tools are approved, email, and life after launch.

Load the row whose trigger matches the work in front of you. Do not preload the set — each file is a full lane reference.

| Load when | Reference | Produces / gate |
| --- | --- | --- |
| every broad launch start; before account/social/Doppler bootstrap; when the founder is unsure; whenever an agent is about to hand back a checklist instead of operating the business | [`founder-zero-operator.md`](./founder-zero-operator.md) | `operations/BUSINESS_ACCESS.md`, `operations/business-access.json` · `check:founder-operator` |
| before authenticated browser/API/CLI/native action on any provider, social, or store account | [`frontier-agent-operations.md`](./frontier-agent-operations.md) | `operations/AGENT_OPERATIONS.md`, `operations/agent-operations.json` · `check:agent-operations` |
| before using or replacing any paid/account-gated tool, before running a free fallback, or when a service is missing from the runtime | [`paid-tool-routing.md`](./paid-tool-routing.md) | `strategy/TOOL_DECISIONS.md` · `check:paid-tool-decisions` |
| once the app is live (phase_6/phase_6b); after first store approval; on "what now"; for weekly ops, incidents, review responses, retention and kill-or-scale reviews, or resuming a live app; when a second business exists (portfolio registry) | [`post-launch-operations.md`](./post-launch-operations.md) | `operations/POST_LAUNCH_OPS.md` (Weekly Operating Rhythm, Crash Triage, Review Responses with an SLA, Release And Hotfix Cadence, Retention Review, Support Operations, Launch Retro) and `operations/LAUNCH_RETRO.md` at launch +7/30/90 days (day-30/90 carry the kill-or-scale verdict), feeding failure cards and LaunchBench candidates. "Approved for sale" is the handoff into operations, not the end of the launch package · `check:post-launch`; `strategy/PORTFOLIO_REGISTRY.md` · `check:portfolio-registry` |
| working on provider state recipes | [`provider-state-recipes.md`](./provider-state-recipes.md) | — |
| before push permission priming or notification lifecycle work; before Resend, API keys, transactional email, lifecycle automations, broadcasts, contacts/topics, webhooks, inbound email, unsubscribe, deliverability, or templates | [`resend-email-ops.md`](./resend-email-ops.md) | `growth/EMAIL_OPS.md` with SPF/DKIM DNS basis, unsubscribe handling, `design/DESIGN.md` brand tokens; push prime `product/ONBOARDING.md`, events `analytics/ANALYTICS.md`+`engineering/TECH_SPEC.md`, caps `operations/POST_LAUNCH_OPS.md` · `check:email`, `check:onboarding`, `check:analytics-catalog` |
| working on secrets management | [`secrets-management.md`](./secrets-management.md) | — |
