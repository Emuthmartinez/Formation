# The Phase Spine

The ordered walk through a launch. `SKILL.md` routes by *what governs this*; this
file answers *what comes next*.

Read it when you need the sequence — at kickoff, when resuming a launch, or when
deciding what the next lane is. Do **not** preload it to work through top to
bottom: `SKILL.md`'s Lane Routing is still the entrypoint, and a row's references
load when its trigger fires, not before.

Phases are a sequence, not a schedule. Several run in parallel once their inputs
exist, and the launch scope (essentials is the first-launch default) decides which
sub-phases apply at all.

Full entry criteria, work, and exit criteria for each phase are in [`playbook/process/launch-phases.md`](playbook/process/launch-phases.md):

<!-- graph-generated:start phase-spine -->
| Phase | Focus | Primary output |
| --- | --- | --- |
| 0 | Founder-zero orient and scaffold | operations/BUSINESS_ACCESS.md + ledger, state/PROJECT_STATE.yaml, autonomy/scope, first cockpit |
| 0b | Paid-tool access and fallback routing | strategy/TOOL_DECISIONS.md |
| 0c | Secrets baseline | SECRETS.md, doppler.yaml, names-only .env.example |
| 1 | Research-backed spec | strategy/RESEARCH.md, LOCALIZATION_MARKET_RESEARCH.md, revised product/SPEC.md |
| 1b | Analytics and attribution blueprint | analytics/ANALYTICS.md, analytics/analytics-plan.html |
| 1c | 11-star experience and product brainstorm | 11_STAR_EXPERIENCE.md, 11-star-experience.html |
| 1d | Paid user acquisition system | PAID_UA.md |
| 1e | Viral growth loop contract | VIRAL_GROWTH.md, growth/LAUNCH_NARRATIVE.md |
| 1f | Launch trace and build contracts | state/LAUNCH_TRACE.md, engineering/TECH_SPEC.md |
| 1g | Security architecture | trust/SECURITY.md, trust/security-review.html |
| 2 | Brand and design | strategy/BRAND.md, design/DESIGN.md, design.md, rendered proofs, key assets |
| 3 | Launch dossier and store operations | Store listing, signing, console, screenshot, content-asset, and launch packets |
| 3b | Revenue and monetization operations | revenue/REVENUE_OPS.md and sandbox/production purchase validation |
| 4 | Pre-launch funnel | Landing page, waitlist/referral loop, email/domain routes, analytics, deploy proof |
| 5 | Builder and agent handoff | AGENTS.md, CLAUDE.md, APP_AGENTS.md, agents/, PROMPTS.md, audit bundle |
| 5b | Engineering orchestration and production readiness | engineering/ENGINEERING_PLAN.md, operations/ORCHESTRATION.md, engineering/PRODUCTION_READINESS.md, device proof |
| 5c | Security release gate | Scan and review proof attached to engineering/PRODUCTION_READINESS.md |
| 6 | Post-launch UGC and Fastlane growth engine | growth/UGC_PLAYBOOK.md, growth/FASTLANE_OPS.md, 90-day format-discovery plan |
| 6b | Post-launch operations | operations/POST_LAUNCH_OPS.md, operations/LAUNCH_RETRO.md, day-30 scope revisit |
<!-- graph-generated:end phase-spine -->
