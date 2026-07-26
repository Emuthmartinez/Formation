# Post-Launch Operations

Use this after the first store approval. A launched app is a live business, not a finished launch package: approval is the moment crash health, reviews, retention, support, and growth start compounding — or start decaying while nobody watches. This reference is the operating system for the first 90 days of running the live app. It orchestrates the weekly rhythm; the tactical lanes (`aso-store-ops.md`, `paid-user-acquisition.md`, `fastlane-growth-ops.md`, `revenue-monetization.md`) own their own playbooks.

Track the lane in `lanes.post_launch_ops` in `PROJECT_STATE.yaml`, using the standard status vocabulary (not_started → partial → blocked/not_needed/deferred → done, with evidence paths). The artifacts are `POST_LAUNCH_OPS.md` (the live runbook: rhythm, routes, SLAs, thresholds) and `LAUNCH_RETRO.md` (the retrospective that feeds `failure-cards.md` and `launchbench-evals.md`). Enforced by `npm run check:post-launch`.

This lane covers the `launch-coverage.md` rows "Crash/performance", "Support/reputation", and "Post-launch loop" as a single rhythm. Do not duplicate the per-lane tactics here; cross-reference them.

## Contents

- 1. When To Load
- 2. Weekly Operating Rhythm
- 3. Crash Triage
- 4. Review Responses
- 5. Release And Hotfix Cadence
- 6. Retention Review
- 7. Support Operations
- 8. Post-Launch Growth Scaling
- 9. Kill-Or-Scale Review
- 10. Launch Retro Loop
- 11. Artifact Contract
- 12. Founder-Only Gates
- 13. Anti-Patterns

## 1. When To Load

Load this reference when any of the following is true:

- The project enters phase_6/phase_6b (post-launch growth and operations) or the first store approval lands on either store.
- The founder asks "what now", "the app is live, what do I do", or any variant of "how do I run this".
- A weekly ops session is due (the rhythm in §2 — the default standing session once live).
- An incident is in progress: crash spike, review-bombing, billing outage, store policy notice, or a bad release.
- An agent resumes work on an app that is already live (continuity review shows a shipped app but no `POST_LAUNCH_OPS.md` — create it before doing anything else).

If the app is live and `lanes.post_launch_ops` is still not_started, that is the highest-priority gap: a live business with no operating rhythm is the launch-and-vanish failure mode in progress.

## 2. Weekly Operating Rhythm

Run one named weekly session — the **Weekly Ops Review** — and record each pass in `POST_LAUNCH_OPS.md` with the date and what changed. The fixed order matters: read reality first, fix what is broken, then grow.

1. **Metrics review.** PostHog (activation, retention cohorts, funnel deltas), RevenueCat (trials, conversions, renewals, refunds, MRR), App Store Connect / Play Console (impressions, page views, conversion rate, downloads by territory).
2. **Crash and review triage.** Sentry release health and new issues (§3); new store reviews on both consoles (§4). Severity-route before anything else gets attention.
3. **Support sweep.** Clear the support inbox to zero or to documented escalations (§7).
4. **ASO and rankings delta.** Keyword rankings, category rank, conversion-rate movement, competitor deltas via AppKittie and first-party console data — route the tactics through `aso-store-ops.md` §10.
5. **Growth and spend review.** Paid performance against the stop/scale rules in `paid-user-acquisition.md`; organic cadence per `fastlane-growth-ops.md` (§8).
6. **Ship one improvement.** Every week ships at least one user-visible or measurable improvement — a fix, a copy change, a paywall tweak, a metadata refresh — chosen from what steps 1–5 surfaced. A week with no shipped improvement is a recorded exception with a reason, not a silent skip.

Keep the session under one focused pass. The rhythm is the product: each step feeds the next, and the weekly improvement is how the loop compounds instead of just observing.

Two cadence rules:

- The Weekly Ops Review runs even in a "quiet" week. Quiet weeks are where regressions hide; the review is how you know it was actually quiet.
- Record a one-line delta per step ("D7 cohort -3pts", "2 new launch-blockers triaged", "inbox cleared", "ranked #4 → #6 on primary keyword", "spend held", "shipped 1.2.1 paywall copy fix") so the next session — or the next agent — can read the trend in seconds.

## 3. Crash Triage

Crash health is the first gate every week and the first responder for incidents. Route crashes through Sentry; where Sentry is unavailable or was founder-deferred (see the `sentry` tool route in `PROJECT_STATE.yaml`), use App Store Connect / Play Console crash reports as the fallback and record the limitation in `POST_LAUNCH_OPS.md`.

Severity ladder — assign one of three levels to every new issue:

- **Launch-blocker.** Crash on launch, crash in the purchase/paywall path, data loss, or anything pushing crash-free sessions below threshold. Hotfix now (§5); do not wait for the weekly train.
- **Degraded.** A feature is broken or a flow crashes for a meaningful segment, but the core job and the purchase path work. Fix on the next scheduled release; note the affected segment.
- **Cosmetic.** Visual defects, rare-device edge cases, non-blocking errors. Batch into the backlog; mention in the weekly review only if recurring.

Operating rules:

- Set a **crash-free-sessions threshold** (default 99.5%; record the chosen number in `POST_LAUNCH_OPS.md`) and treat it as a release gate: a new version that drops below threshold during its monitoring window (§5) halts further rollout and triggers the rollback/kill-switch decision.
- Configure **alert routing** so launch-blockers page the founder/agent channel immediately (Sentry alert rules to the support/ops email via Resend-routed aliases, or console email alerts as fallback). Degraded and cosmetic issues wait for the weekly triage; launch-blockers do not.
- A crash forces a hotfix when it is a launch-blocker, when it affects new-user first sessions (it poisons reviews and retention simultaneously), or when it breaks billing. Everything else rides the weekly release.
- Watch the **performance budget** alongside crashes: cold-start time, ANR rate (Play), and hang rate (Apple) degrade reviews and retention before they ever show as crashes. Treat a sustained budget breach as degraded severity.
- Log every launch-blocker as a candidate failure card in `failure-cards.md` — repeated crash classes are skill-improvement signal, not just bugs.

## 4. Review Responses

Reviews are a public support channel, a research corpus, and a ranking input at once. Respond from App Store Connect and Play Console — replies are public and indexed against the listing.

- **Response SLA:** respond to every 1–3-star review within 72 hours and to substantive 4–5-star reviews weekly. Record the chosen SLA in `POST_LAUNCH_OPS.md`; the validator checks that one is stated.
- **Never paste boilerplate.** Every reply addresses the specific complaint, names the fix or workaround if one exists, and invites the user to the support inbox for anything needing account detail. A templated "thanks for your feedback" reply is worse than no reply — it reads as automated to both the reviewer and prospective users.
- **Mine reviews every week** for three outputs: recurring complaints that should become failure cards or backlog items; the exact words users use to describe the app's job (feed these into the ASO keyword field via `aso-store-ops.md` — user language beats invented keywords); and feature demand worth a roadmap conversation.
- **Flag abuse for store appeal.** Review-bombing (sudden coordinated negative waves), reviews violating store content policies, or reviews about a different app are appeal candidates in both consoles. Document the evidence before filing; the appeal itself is a founder-gated public action (§12).
- When a review reports a real bug, link the review to the Sentry issue or backlog item in the weekly notes so the eventual reply can say "fixed in X.Y.Z".

## 5. Release And Hotfix Cadence

Run a predictable release train so fixes and improvements ship on rhythm instead of on panic.

- **Semantic versioning.** Patch for hotfixes, minor for the weekly/biweekly feature train, major for changes that alter the core job or require migration. The version string is communication — reviewers, support replies, and release notes all hang off it.
- **Release train.** Default to a weekly or biweekly release that carries the week's improvement (§2 step 6) plus accumulated degraded/cosmetic fixes. A standing train beats ad-hoc releases: it caps the blast radius of any one change and keeps store review friction routine.
- **Hotfixes.** When §3 forces a hotfix, ship the minimal diff. On Apple, request an expedited review for genuine launch-blockers (use sparingly — repeated requests erode credibility with App Review). On both stores, a billing-path or launch-crash fix justifies it.
- **Staged rollout.** Use phased release on the App Store and staged rollout percentages on Play Console for every release, including hotfixes where speed allows. Start small, watch the monitoring window, then expand.
- **Post-release monitoring window.** For 24–48 hours after each release, watch crash-free sessions, the conversion funnel, and review sentiment before expanding rollout or moving on. Shipping and immediately disengaging is the hotfix-without-monitoring anti-pattern (§13).
- **Rollback/kill-switch posture.** Know before shipping what the rollback story is: halt the phased rollout, re-expedite the previous build, or flip the remote kill switch for the offending feature (the QA/release lane in `launch-coverage.md` expects one to exist). Killing or rolling back a live release is founder-gated (§12).

## 6. Retention Review

Retention is the post-launch metric that decides whether growth spend is buying a business or a leak. Review it weekly from PostHog cohorts; record the cohort source in `POST_LAUNCH_OPS.md` (the validator checks that one is named).

- **D0/D7/D30 cohorts.** Track activation-day, day-7, and day-30 retention by weekly install cohort in PostHog. Watch the trend across cohorts, not the absolute number of any single one — a declining D7 across consecutive cohorts is the earliest cheap warning.
- **First-renewal inflection.** The first renewal is the economic cliff. Route the response through `revenue-monetization.md` §4c: accelerate time-to-value so the user has banked real value before renewal #1, rather than discounting at the cliff.
- **Split churn voluntary vs involuntary.** Involuntary churn (failed payments, expired cards, billing errors) is recoverable revenue, not fate — route it through the billing-health playbook in `revenue-monetization.md` §8a (RevenueCat billing-issue events, grace periods, recovery flows).
- **Reactivation and win-back.** Lapsed-user win-back is its own lever with its own rules — `revenue-monetization.md` §8b. Coordinate win-back sends through the lifecycle email setup (Resend) rather than improvising one-off blasts.
- **Retention evidence triggers product change.** When cohorts show a consistent drop at a specific step, that is a product decision, not an ops note: open it through `change-cascade.md` so the fix propagates across onboarding, paywall, listing, and messaging surfaces consistently, and trace the decision in `LAUNCH_TRACE.md`.

## 7. Support Operations

Support is reputation infrastructure: every unanswered email is a future 1-star review.

- **Inbox routing.** Use the support aliases established in the funnel/email phase (Resend sender domain plus Cloudflare email-routing aliases, e.g. support@ and the security contact) — see `resend-email-ops.md`. Confirm the alias actually delivers; a dead support address is a store-policy and reputation risk.
- **SLA and sweep.** Clear the inbox in the weekly sweep (§2 step 3) at minimum; same-week response on everything, same-day on billing and data issues.
- **Refund path.** Both stores own the payment relationship: route refund requests per store rules (Apple's request-a-refund flow; Play Console refund tooling). Document the per-store path in `POST_LAUNCH_OPS.md` so replies are accurate. Any goodwill refund beyond store-automatic handling is founder-gated (§12).
- **FAQ/help doc.** Maintain a lightweight FAQ on the landing site from real ticket patterns; link it from review replies and support responses. Update it in the weekly sweep when the same question arrives twice.
- **Escalation ladder.** Define who handles what: agent answers known patterns from the FAQ; anything touching credentials, refunds beyond store-automatic, legal threats, or press goes to the founder; security reports route per `SECURITY.md`.
- **Data-deletion requests.** Route account/data-deletion requests exactly per the commitments in `privacy-terms.md` and the published privacy policy — these are compliance items with deadlines, not ordinary tickets. Log completion evidence.

## 8. Post-Launch Growth Scaling

This reference owns the rhythm; the growth lanes own the tactics. In the weekly growth review (§2 step 5):

- **Paid:** apply the stop/scale rules already written in `growth/PAID_UA.md` per `paid-user-acquisition.md`. Do not invent new spend logic in the ops session; if the rules need changing, change them in that lane with founder approval.
- **Organic/UGC:** run the Fastlane weekly loop per `fastlane-growth-ops.md` — campaign performance, creative refresh, schedule health.
- **ASO:** run the post-launch monitoring loop per `aso-store-ops.md` §10 — keyword/ranking deltas, conversion-rate movement, listing experiments, and the localization-tier refresh in `localization-market-research.md` §7.

The integration rule: retention evidence (§6) gates growth scaling. Scaling acquisition into a cohort curve that does not hold is buying churn — when D7/D30 trends are deteriorating, the weekly improvement budget goes to retention fixes before any spend increase.

## 9. Kill-Or-Scale Review

Every stop/scale rule above this section gates one layer down — a paid channel, a creative format, a release. This one gates the whole app. The question it forces is the one that decides whether repeated launches compound into a real business: keep investing in this app, run it lean, or wind it down and put the next launch on the calendar. Only ~4.6% of newly launched apps reach $10K/month within two years, and roughly 75% of the apps that clear $1K/month never clear $10K (RevenueCat State of Subscription Apps 2026). The median outcome is an app that plateaus — and the expensive failure mode is not the plateau, it is running the Weekly Ops Review on a plateaued app for a year because no session ever asked the question.

Run this review at the day-30 and day-90 `LAUNCH_RETRO.md` checkpoints, and again whenever the founder asks "is this working". The agent prepares the evidence pack; **the verdict itself is the founder's call** (§12) — never auto-kill, never auto-scale.

The evidence pack, from sources the rhythm already reads:

- **Revenue trajectory.** MRR and new-trial starts across the last four weeks (RevenueCat). Direction matters more than level: growing, flat, or declining.
- **Retention trend.** D7/D30 across consecutive weekly cohorts (PostHog, §6). Two or more consecutive cohorts declining is a red signal regardless of the absolute number.
- **Unit economics.** CAC against realized LTV and payback window from the paid-UA baseline when spend is active (`growth/PAID_UA.md`); organic-only apps substitute install-to-paid conversion against the category evidence in `RESEARCH.md`.
- **Founder cost.** Hours per week the app actually consumes, from the weekly log. An app earning $200/month on ten founder-hours a week is losing money by any honest accounting.

Default verdict bands — record the chosen thresholds in `POST_LAUNCH_OPS.md` and adjust per category evidence, the same way the crash-free threshold works:

| Verdict | Default signal | What happens next |
| --- | --- | --- |
| Scale | MRR growing, retention holding or improving, payback inside the recorded window | Raise investment through the existing lanes: spend per `paid-user-acquisition.md` stop/scale rules, deeper localization tiers, feature train — each through its own founder gate |
| Hold | MRR flat but positive, retention stable, founder cost low | Maintenance mode: keep the weekly rhythm, ship fixes, stop net-new feature and spend investment; revisit next checkpoint |
| Fix | One named metric broken while the others hold (e.g. retention cliff at a known step) | The weekly improvement budget goes entirely to the named break through `change-cascade.md`; a Fix verdict twice in a row on the same metric becomes Kill-or-Hold |
| Kill | MRR declining or immaterial at day 90, retention deteriorating across cohorts, or founder cost out of proportion to trajectory | Wind-down checklist below, retro filed, next launch scheduled |

A Kill verdict is a wind-down, not an abandonment:

- Decide delisting vs. maintenance mode: an app with live subscribers keeps its purchase path, support alias, and privacy commitments working until the last renewal cycle completes.
- Honor subscriber obligations: cancel-at-period-end handling, store-rule refunds, and a plain-language notice if the app is leaving the store.
- Data deletion commitments in the published privacy policy keep their deadlines through and after wind-down.
- File the final `LAUNCH_RETRO.md` pass while the evidence is fresh — what the category taught, what the funnel numbers were, which plays transfer. That retro is the highest-value asset the app produces on its way out; it seeds the next launch per `control-plane.md`'s portfolio layer.
- What carries forward: learnings, reusable engineering patterns, and any audience the founder owns outright (their own email list, their own social following) where the published terms allow. What never carries forward: the app's name, brand vocabulary, tokens, domains, or credentials — the "Nothing carries over" rule holds in both directions.

Record the verdict and date in `LAUNCH_RETRO.md` (Kill, Hold, Or Scale section) and in `PROJECT_STATE.yaml` under `lanes.post_launch_ops.kill_or_scale_decision` / `kill_or_scale_decided_at`. `check:post-launch` enforces the substance, not just the heading: a done lane needs the verdict section, and once the Retro Window records a completed Day 30 or Day 90 pass, that checkpoint's row must carry an actual verdict and the state mirror must hold a valid decision and ISO date — an operating rhythm with no exit question is the zombie-app failure mode wearing a green check.

## 10. Launch Retro Loop

The retro is how each real launch improves the skill. Fill `LAUNCH_RETRO.md` three times: shortly after launch (first 1–2 weeks live), at day 30, and at day 90. Each pass records:

- **Lanes used vs skipped.** Which references/lanes were actually loaded and which were skipped or marked not_needed — and whether any skip turned out to be a mistake.
- **Where the agent stalled.** Steps that took multiple attempts, blocked on missing access, or required the founder to unstick — with enough detail to reproduce the stall.
- **What surprised.** Anything reality did that the skill's playbooks did not predict: store review behavior, metric shapes, tool gaps, user reactions.
- **What should feed back.** Which misses should become failure cards in `failure-cards.md` and which deserve a LaunchBench scenario per `launchbench-evals.md` so the next launch is tested against them. Propose the cards/scenarios in the retro; actually landing them in the skill repo is maintainer work, not business-repo work.

The day-30 and day-90 passes also grade the operating rhythm itself: was the weekly review actually run, did the weekly improvement ship, which thresholds (crash-free, SLA) were the wrong numbers. Update `POST_LAUNCH_OPS.md` from those findings.

## 11. Artifact Contract

`POST_LAUNCH_OPS.md` must contain these section headers exactly (a deterministic validator greps for the strings):

- "Weekly Operating Rhythm"
- "Crash Triage"
- "Review Responses"
- "Release And Hotfix Cadence"
- "Retention Review"
- "Support Operations"
- "Launch Retro"

Lane entry in `PROJECT_STATE.yaml` (same shape as every other lane):

```yaml
lanes:
  post_launch_ops:
    status: "not_started"
    evidence:
      - "POST_LAUNCH_OPS.md"
      - "LAUNCH_RETRO.md"
    blockers: []
```

`lanes.post_launch_ops` may be marked done only when:

- A named crash route exists (Sentry, or store crash reports recorded as the founder-approved fallback).
- A review-response SLA is stated.
- A retention cohort source is named (PostHog by default).
- `LAUNCH_RETRO.md` exists with at least the post-launch pass filled.

Validator: `npm run check:post-launch -- --root . --state PROJECT_STATE.yaml`. The validator checks structure and the done-status facts above; it cannot verify that the rhythm is actually being run, that replies are non-boilerplate, or that monitoring windows are honored — the founder's weekly review of `POST_LAUNCH_OPS.md` session notes is the backstop for those.

## 12. Founder-Only Gates

Pause and obtain explicit founder approval before:

- **Refunds beyond store-automatic handling** — goodwill refunds, comped subscriptions, or anything touching money outside the stores' own flows.
- **Public replies posted under the business identity** — store review responses and public support posts speak as the business; the founder approves the first occurrences and the standing tone, after which routine replies within that approved pattern may proceed per the autonomy mode.
- **Paid spend changes** — any budget increase, new channel, or restart of paused spend (route through `paid-user-acquisition.md` gates).
- **Killing or rolling back a live release** — halting a phased rollout, expediting a replacement build, or flipping a kill switch affects every live user.
- **Policy appeals** — review-removal requests, store policy disputes, or anything filed formally with Apple or Google.

## 13. Anti-Patterns

- **Launch-and-vanish.** The app is approved, the cockpit says done, and no weekly rhythm exists. Crash regressions, unanswered reviews, and billing leaks compound silently. This is the failure `check:post-launch` exists to catch.
- **Boilerplate review replies.** Templated responses pasted across reviews — reads as automated, converts nobody, and wastes the public-reply surface.
- **Hotfix without monitoring.** Shipping the fix and disengaging before the 24–48-hour window confirms crash-free sessions held and the funnel did not regress.
- **Involuntary churn treated as inevitable.** Failed payments written off as normal churn instead of routed through the recovery levers in `revenue-monetization.md` §8a.
- **Skipping the retro.** No `LAUNCH_RETRO.md`, so the next launch repeats the same stalls and misses — the one failure mode that makes every future launch worse, because nothing feeds back into failure cards or LaunchBench.
- **Scaling spend against a leaking cohort.** Increasing acquisition while D7/D30 trends deteriorate, buying churn instead of a business (§8).
