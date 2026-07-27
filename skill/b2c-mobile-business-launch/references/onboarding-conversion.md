# Onboarding Conversion And Paywall Flow

Use this before designing onboarding, quizzes, personalization, attribution capture, mascot guidance, demo videos, review prompts, paywall timing, closing offers, trials, or first-session activation.

Load `paid-tool-routing.md` before replacing Higgsfield, MobAI Plus/Pro or intended cross-platform coverage, XcodeBuildMCP-approved fallback, RevenueCat experiments, PostHog experiments/surveys/replay, or any paid/account-gated onboarding tool with a free/manual route. MobAI Free needs no spend gate when it covers the lane. Load `remotion-content-assets.md` before using Remotion for onboarding demo clips, animated explainers, app-preview cuts, social hook clips, or local rendered assets.

## Contents

- Sources To Refresh
- Required Artifacts
- Out-Of-Box Attribution Data Contract
- Conversion Patterns
- Analytics Events
- Gates Before Build Handoff

## Sources To Refresh

Refresh current platform and monetization sources before locking a flow:
- RevenueCat State of Subscription Apps 2026: `https://www.revenuecat.com/state-of-subscription-apps/`
- RevenueCat paywall, experiment, and offerings docs when using RevenueCat UI or experiments
- Apple ratings and reviews: `https://developer.apple.com/app-store/ratings-and-reviews/`
- Apple App Review Guidelines: `https://developer.apple.com/app-store/review/guidelines/`
- Google Play In-App Reviews API: `https://developer.android.com/guide/playcore/in-app-review`
- Refero MCP docs and tools when researching current shipped onboarding, paywall, upgrade, cancellation, restore, and permissions flows: `https://doc.refero.design/llms.txt`
- User-provided Cesar Alvarez onboarding teardown links when the task references that research thread

## Required Artifacts

Load `analytics-attribution.md` before locking onboarding event names, attribution-source options, paywall variants, or the dashboard plan. Onboarding should implement the approved analytics catalog, not invent events while building screens.

Load `eleven-star-experience.md` before locking onboarding. The onboarding sequence should carry the product's 11-star V1 scalable slice: the user should see why the product is personally relevant before the flow asks for payment, long setup, or sensitive data.

Load `viral-growth-loops.md` before using referral unlocks, share-to-unlock mechanics, creator-code CTAs, social-comment loops, or viral paywall/onboarding sequences. Onboarding can create growth momentum, but the loop needs a fair fallback, abuse controls, analytics proof, and traceability before build handoff.

Create or update `ONBOARDING.md` when an app has more than one setup screen, asks personalization questions, uses a mascot/demo, has a paywall, or relies on first-session conversion.

Use Refero as evidence, not as replacement doctrine. The onboarding playbook in this file remains the default conversion contract. Refero should help find concrete examples for sequencing, copy density, state handling, and recovery paths; it should not remove early self-reported attribution, the native App Review popup immediately after first value, paywall proof, restore purchases, privacy/terms links, or backend attribution persistence unless a deliberate experiment is documented.

Before drafting any onboarding question copy, mascot line, demo-video caption, paywall headline, or closing-offer copy, load `references/no-slop-writing.md`; keep the tone `11_STAR_EXPERIENCE.md` and `BRAND.md` set for this product, not generic onboarding copy.

Onboarding is where most of the Experience Cards fire. When the 11-star target is 6-star or higher, load [`emotional-design-system.md`](emotional-design-system.md) for the card-timing contract and reflect it here: the Commitment Card fires at the first personalization/goal question; the Perceived Effort Delay Card fires at plan/result generation; the Intent Mirroring Card fires after first value and immediately before the paywall (never on the paywall screen itself or any cancel flow); the native App Review popup fires at or just after the emotional peak. These moments belong in `EMOTIONAL_DESIGN.md`'s Card Application Map with a PostHog event each, and the onboarding curve must cross positive before the paywall.

Recommended Refero searches when access is available:
- `refero_search_flows`: `signup onboarding`, `subscription onboarding paywall`, `permission request onboarding`, `subscription cancellation with retention offer`, `restore purchases`
- `refero_search_screens`: `ios onboarding progress question`, `ios paywall annual weekly lifetime`, `ios restore purchases settings`, `web pricing annual monthly toggle`
- `refero_get_flow` for 2-4 strongest flows, then summarize step count, friction, recovery, and system response in `UX_PATTERNS.md`

`ONBOARDING.md` must include:
- target user state before onboarding and desired state after onboarding
- 11-star experience mapping: which step delivers or previews the magical moment from `11_STAR_EXPERIENCE.md`
- screen-by-screen sequence with purpose, question/copy, state, visual asset, animation, analytics event, and skip/back rules
- mascot/guide behavior if used: personality, reactions, emotion states, source assets, Higgsfield model/tool, and accessibility fallback
- demo-video plan: clip length, aha moment, source UI, visual treatment, no-audio fallback, Higgsfield or Remotion route, and where it appears
- data collection matrix: question, answer options, personalization use, attribution use, lifecycle-message use, privacy/legal note, and whether it is required
- attribution question: "How did you hear about us?" options, UTM/referrer capture, and free-text/other handling
- attribution source mapping to `ANALYTICS.md`: stored key, display label, PostHog person property, event property, lifecycle-message use, and privacy note
- App Review popup gate: first-value/value-reveal trigger, native platform API, automatic mounted-screen timing, cooldown, analytics, and fallback if the platform does not show the prompt
- push permission priming: the soft-prime screen and system-dialog placement per `push-notification-lifecycle.md` — after a first value moment, never cold on launch, and never in the same step as the review popup (value moment → one of the two; the other waits for the next earned moment)
- paywall placement and access model: hard paywall, soft paywall, reverse trial, freemium limit, or no paywall yet
- closing-offer behavior after paywall dismissal, if any
- pricing/trial package matrix and RevenueCat offering/experiment names
- first-session activation task after payment or before payment, depending on the model
- viral growth loop mapping when relevant: referral/share trigger, reward, recipient value, fallback, abuse controls, backend/provider proof, and related `VIRAL_GROWTH.md` trace IDs
- privacy/terms/support links shown before data collection or purchase

Create `onboarding.html` or include an onboarding section in `design.html`:
- render every onboarding screen at mobile dimensions
- include mascot states, data question UI, demo-video placeholder or clip, Remotion-rendered asset placeholder when selected, plan summary, paywall, closing offer, review prompt placeholder, loading/error/offline states, and post-paywall activation
- use CSS variables from `DESIGN.md`
- include reduced-motion behavior and no-video fallback

## Out-Of-Box Attribution Data Contract

Self-reported attribution is a data contract, not a screen. Every B2C app with onboarding, signup, waitlist, account creation, or a launch funnel must include self-reported attribution unless `ONBOARDING.md` and `ANALYTICS.md` explicitly mark it not applicable with a reason.

Placement:
- Show a visible, required "How did you hear about us?" screen after the value promise/demo is clear but within the first third of onboarding or signup.
- Do not bury attribution after long product, developer, or settings questions.
- Do not satisfy this requirement with analytics documentation alone; the rendered onboarding proof and implementation must show it.

Default source taxonomy, adjustable by product:

| stored_key | display label |
| --- | --- |
| `friend` | Friend or word of mouth |
| `tiktok` | TikTok |
| `instagram_reels` | Instagram or Reels |
| `youtube` | YouTube |
| `x_twitter` | X / Twitter |
| `reddit_search` | Reddit or search |
| `app_store_search` | App Store search |
| `play_store_search` | Google Play search |
| `creator` | Creator link or video |
| `podcast` | Podcast |
| `ai_search` | AI answer or chat search |
| `ad` | Ad |
| `other` | Other |

Implementation definition of done:
- Every option has a stable stored key. Display labels may change, but stored keys must remain stable for dashboards.
- `other` includes a free-text or follow-up field, with a product-appropriate max length, trim/sanitize behavior, and privacy copy that avoids sensitive data.
- The selected source is emitted as `attribution_source_selected` with `source_key`, `source_label`, `other_text_present`, `flow_id`, `step_id`, and technical context such as UTM/referrer/deep-link/referral code when available.
- The selected source is set as PostHog person properties: `self_reported_source`, `self_reported_source_label`, `self_reported_source_other_text_present`, and `self_reported_source_captured_at`. Store raw `self_reported_source_other` only when the privacy plan allows it.
- The selected source is persisted to the backend profile, waitlist, account, or Supabase profile record when identity exists. Use fields such as `self_reported_source`, `self_reported_source_label`, `self_reported_source_other`, `self_reported_source_captured_at`, and `self_reported_source_context`.
- Anonymous attribution is reconciled into the identified user after signup/login instead of being stranded on an anonymous event stream.
- If there is no backend/profile persistence path yet, mark attribution as blocked in `PRODUCTION_READINESS.md` with the exact missing backend contract; do not call it complete.
- Unit, UI, or live smoke tests prove selection, event delivery, PostHog person-property update, and backend/profile persistence where those surfaces exist.

Do not describe attribution as "wired", "complete", or "launch-ready" if it only updates local state or emits a one-off event. It is wired only when the source is represented by a stable key, forwarded to analytics, attached to the person/profile identity, and persisted to the app backend once identity exists.

## Conversion Patterns

### Mascot Or Guide

Use a mascot when the product benefits from warmth, reassurance, habit formation, play, coaching, or repeated progress. The mascot should:
- react to answers and progress
- soften friction without hiding cost, privacy, or limitations
- have 4-8 reusable emotion states before implementation
- be generated or refined with Higgsfield against `DESIGN.md`
- appear in HTML proofs before app implementation

Do not use a mascot when it makes a serious, regulated, or high-stakes product feel unserious.

### Short Demo Video

Use a short looping product demo to answer "what does it actually do?"
- keep it under 15 seconds unless there is a specific reason
- show the actual product state or a truthful prototype, not abstract feature bullets
- center the aha moment
- design for muted playback with captions or visible UI states
- generate/refine clips with Higgsfield Seedance 2.0 or Marketing Studio when no real capture exists
- score finished ad/demo clips with Higgsfield Virality Predictor when used for paid/social acquisition

### Data Collection

Ask questions only when the answer changes personalization, attribution, segmentation, lifecycle messaging, or product setup.
- common inputs: goal, current state, frequency, biggest obstacle, timeline, confidence, desired outcome, constraints, source/attribution
- for plan-builder apps, 8-15 short questions can work when each answer is reflected back in a personalized plan
- for utility apps, keep the sequence shorter and reach the product quickly
- always include an attribution question early enough that users remember the answer
- do not collect sensitive categories unless the product genuinely needs them and privacy terms cover them

The plan summary should reflect the user's own answers back to them. This is not magic personalization; it is commitment and clarity.

Attribution answers should be treated as first-class launch learning:
- ask while the user still remembers the source
- keep answer keys stable even if display copy changes
- use a typed enum or equivalent constants for stored keys instead of storing display labels
- include `other` free text or a follow-up field rather than making "Other" a dead-end bucket
- map creator, referral, social, search, App Store/Play search, ad, email/newsletter, AI answer, and word-of-mouth sources separately where useful
- pair the self-reported answer with technical UTMs/referrer/deep-link/referral-code context in PostHog
- persist the answer to the backend/profile record and reconcile anonymous answers after identify/signup
- avoid using the answer to make unsupported public claims about channel performance without enough volume

### App Review Popup After First Value

For apps with onboarding, the native App Review popup is part of onboarding by default. It belongs immediately after the first value moment: the first personalized plan, analysis, demo result, aha moment, or other value-reveal screen the user can actually judge.

Do not leave the review prompt as a vague later lifecycle idea. `ONBOARDING.md` must show the sequence: value promise/demo -> useful questions -> first value/value reveal -> App Review popup eligibility/request -> paywall or activation. If a product truly has no first-value moment in onboarding, record that as an experiment or blocker instead of silently dropping the prompt.

**Canonical placement — value-reveal screen, automatic trigger:**
- Fire the native review request automatically after the value-reveal screen is fully displayed (plan, analysis, demo result, or aha moment is visible on screen), with a 1-2 second async delay so the screen remains mounted and visible.
- Do not fire on the user's acceptance tap or on any button that causes the screen to dismiss or navigate away. Binding the trigger to a tap that tears down the current screen creates a teardown race: the view may be deallocated before the review sheet can present.
- Do not fire on the paywall screen or after the paywall is shown; the user must see the value first.

Rules:
- iOS: use Apple's native review request API path (`SKStoreReviewController.requestReview` or `requestReview(in:)`); do not build a custom App Store review prompt or incentive.
- Android: use Google Play In-App Review API, do not alter the review card, and do not ask opinion/predictive questions before showing it.
- never reward, unlock, or discount in exchange for a rating or review
- assume the platform may choose not to show the prompt; keep the onboarding flow functional with or without the sheet appearing
- log prompt eligibility, request attempt, and post-prompt continuation without trying to infer private rating content
- record `review_prompt_eligible` before requesting, `review_prompt_requested` when the native API is called, the cooldown/frequency cap, and the fallback continuation when the sheet is suppressed

### Paywall Timing

Show value before the paywall whenever possible:
- reveal a personalized plan, analysis, preview, demo result, or clear "next unlocked step"
- choose hard paywall when time-to-value is fast, marginal serving cost is high, and free users do not drive network effects
- choose soft paywall/freemium when free usage drives word of mouth, marketplace/network value, UGC inventory, or longer trust-building
- use RevenueCat offerings/experiments rather than hardcoded product IDs
- keep restore purchases visible and recovery-friendly

RevenueCat 2026 data supports testing hard paywalls seriously: hard paywall apps show much higher Day 35 download-to-paid conversion than freemium, but the right choice still depends on product dynamics and acquisition strategy.

### Closing Offer Or Reverse Trial

Treat paywall close as a second conversion moment:
- test a transparent downsell, shorter commitment, trial, intro offer, or reverse trial after dismissal
- avoid fake scarcity, manipulative roulette, surprise billing, or unclear renewal terms
- if discounting, disclose standard price, renewal price, duration, cancellation, and eligibility
- track dismiss, offer shown, offer accepted, offer rejected, and later conversion

RevenueCat's 2026 report calls the moment after paywall dismissal a high-leverage conversion point; encode it as an experiment, not a one-off trick.

### In-App Visual Assets (Paywall Hero, Illustrations, Empty-State, Celebration)

Route generated art by surface:

- **Paywall hero / background art** — use `soul_location` (environment/scene, prompt-only) or `gpt_image_2` via the `higgsfield-generate` skill. These are decorative backgrounds embedded in HTML proofs; they are never substitutes for real app UI.
- **Onboarding illustrations, empty-state art, and celebration frames** — use the `higgsfield-generate` skill. Every prompt must carry `DESIGN.md` tokens (palette, type mood, shapes, texture, banned aesthetics, intended surface); generating without the brief is a named failure mode.
- **Direction iteration before committing production-model credits** — route through the **Cheap-First Direction** recipe in `tool-recipes/visual-and-motion-production.md`. Per that recipe's Rule-5 reconciliation, cheap-first is offered as a spend-reduction option at the `paid-tool-routing.md` spend-confirmation prompt — never applied silently.

Guardrails:
- Generated art is decoration embedded in HTML proofs; it is **never** a substitute for truthful real app UI in store screenshots or product claims.
- Spend-confirmation applies before every generation run; confirm with the founder per `paid-tool-routing.md` and surface current balance when possible.
- Record every generated asset in `CONTENT_ASSETS.md` with route, prompt brief (`DESIGN.md` tokens used), output paths, QA, and approval gate.

### Plan And Trial Mix

Default candidate package set for subscription apps:
- weekly or monthly entry plan depending on category norms
- annual plan highlighted as recommended when retention and cost structure support it
- lifetime only when support costs, AI costs, and long-term liability are sustainable
- trial length tested against product cost and learning speed; do not default to very short trials without a reason

RevenueCat 2026 benchmarks show longer trials can convert better, but shorter trials can improve experiment velocity and cash-flow feedback. Pick an initial hypothesis, then test with RevenueCat experiments or an equivalent feature flag.

**Paid intro offers as a free-trial alternative.** The 2026 report flags a structural shift: paid intro offers (e.g. `$0.99` for the first month/week, then auto-renewing to full price) are increasingly replacing free trials because they create commitment, reduce trial abuse, improve early cash flow, and often convert at higher quality. Context to calibrate against, not copy blindly: only ~9.3% of apps currently use promotional offers, yet ~30% of new subscribers (median) enter through an intro discount — and reliance is inverted by scale (hobby-tier apps often run 65–99% of new subs through intro offers, while top performers rely on them for ~0–10%). Treat a low-priced paid intro as one candidate alongside a free trial in the plan-mix hypothesis, disclose the renewal price/terms clearly (see `revenue-monetization.md` §7), and avoid building a business that *depends* on permanent heavy discounting. This is a founder-approved pricing decision (`revenue-monetization.md` §9).

### Conversion Anti-Patterns

Name the cozy defaults that feel safe and quietly lose. These are the onboarding/trial entries in the monetization-and-growth digest in [`revenue-monetization.md`](revenue-monetization.md) §10; figures are from the **RevenueCat State of Subscription Apps 2026** report. Treat each as a strong default to test, not dogma — the anti-pattern is reaching for the comfortable choice by reflex.

**3. Default to a 3-day / short trial because "urgency converts."** Trials of ≤4 days convert to paid at ~25.5%, vs ~37.4% at 5–9 days and ~42.5% at 17–32 days — yet ~46.5% of apps still ship trials of 4 days or less. Short trials manufacture pressure but cut conversion; longer trials let the user reach real value before deciding. Do not pick the short trial by default (see Plan And Trial Mix above: "do not default to very short trials without a reason"). Set a trial-length hypothesis and test it; shorter trials are a deliberate choice for faster learning or cash-flow feedback, not a reflex.

**4. Ignore the first session and bank on a day-30 win-back email.** ~78–90% of trials start on Day 0 (Business ~89.9%, Health & Fitness ~82.1%, Productivity ~78%), and ~55% of 3-day-trial cancellations happen on Day 0 — before any day-30 win-back email could ever send. The beautifully written re-engagement email reaches a user who already churned. Win or lose the user in the first session: the onboarding flow must prove value, explain billing clearly, and route to the first activation task on Day 0 (see `revenue-monetization.md` §4c). Win-back email is a supplement, never the plan.

**10. Run one paywall experiment a year and call it focus.** Testing a button color in March is not an experimentation program. RevenueCat 2026 guidance: lift comes from running smaller, parallel experiments across *when* the paywall appears and *what* it offers — keeping a true control and judging outcomes on cohort LTV, refunds, and early churn — not a once-a-year tweak. Stand up a continuous experiment cadence with RevenueCat Experiments or an equivalent feature-flag/holdout setup; "staying lean" by never testing is the trap, and it quietly loses to teams that test their headline and timing repeatedly.

## Analytics Events

Add these to `ANALYTICS.md` before implementation:
- `onboarding_started`
- `onboarding_step_viewed`
- `onboarding_answer_selected`
- `attribution_source_selected`
- `demo_video_viewed`
- `personalized_plan_viewed`
- `review_prompt_eligible`
- `review_prompt_requested`
- `paywall_viewed`
- `paywall_dismissed`
- `closing_offer_viewed`
- `closing_offer_selected`
- `trial_started`
- `purchase_completed`
- `entitlement_active`
- `restore_started`
- `restore_succeeded`
- `onboarding_completed`
- `activation_task_completed`

Include dimensions: step_id, answer_key, attribution_source, source_key, source_label, other_text_present, demo_id, mascot_state, paywall_variant, offering_id, package_id, trial_state, platform, campaign/source/medium, and error_state.

**Event naming rule — cross-check before proposing:** Any onboarding event name not in the approved catalog above must be verified against `ANALYTICS.md` before being proposed or implemented. Do not invent new event names (e.g. first-use coach events, tutorial events) without first checking whether `ANALYTICS.md` already defines an equivalent. If no equivalent exists, add the candidate name to `ANALYTICS.md` explicitly before referencing it in implementation docs or code. Invented event names that bypass this step create permanent dashboard schema drift.

## Gates Before Build Handoff

- `ONBOARDING.md` exists and maps every question to a real use.
- `ONBOARDING.md` references `11_STAR_EXPERIENCE.md` and shows where the V1 scalable slice appears.
- `onboarding.html` or `design.html` renders the full onboarding/paywall/review/closing-offer path.
- Higgsfield asset plan exists for mascot, icons, demo video, screenshot frames, and animations when visuals are not already final.
- If Higgsfield is unavailable, the founder confirmed the free/local visual fallback and limitations are recorded.
- `EMAIL_OPS.md` covers any onboarding resume, welcome, trial, payment recovery, or win-back emails triggered by the flow.
- App Review popup is inside onboarding immediately after first value/value reveal, uses the native platform API, is not incentivized, auto-triggers after the value-reveal screen mounts with a 1-2s delay, and is not bound to an acceptance tap or to any navigation action that dismisses the screen.
- `npm run check:onboarding -- --root <app>` passes before onboarding or build handoff is called ready.
- Paywall placement, product IDs, offerings, prices, trial, and closing offer match `REVENUE_OPS.md`.
- Privacy/terms links and data-use explanations match the data collection matrix.
- Analytics events are named before implementation, and every proposed event name is present in `ANALYTICS.md`; no event name is invented during implementation without a prior `ANALYTICS.md` entry.
- `analytics-plan.html` shows the onboarding and paywall funnel before build handoff.
- Self-reported attribution passes the data contract: early visible screen, stable source keys, `other` free text, analytics event, PostHog person property, backend/profile persistence, anonymous-to-identified reconciliation, and verification evidence.
- Onboarding, paywall, and closing-offer copy passes the `no-slop-writing.md` self-check (§6) and `check:no-slop` in the product's `BRAND.md`/`11_STAR_EXPERIENCE.md` voice.
