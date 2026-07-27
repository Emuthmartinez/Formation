# Revenue, Monetization, And Purchase Funnels

Use this before setting up RevenueCat, Stripe, App Store/Google Play products, web billing, web purchase links, web funnels, paywalls, subscriptions, taxes, webhooks, pricing, entitlement identity, or purchase validation.

This is not a payment approval. Founder approval is required before changing prices, creating live billing products, enabling paid checkout, spending on ads, publishing subscription terms, or submitting store builds with monetization changes.

Load `paid-tool-routing.md` before replacing RevenueCat, Stripe, app-store product setup, paid RevenueCat features, tax tooling, or provider dashboards with local mocks or free-tier-only planning. Mock purchases are implementation proof only; they are not live entitlement proof.

Load `viral-growth-loops.md` before using referral unlocks, share rewards, creator codes, closing offers, or viral paywall timing as part of monetization. A growth spike is only useful if the paywall, entitlement, analytics, refund/restore, and abuse controls are ready to catch it.

Load `paid-user-acquisition.md` before using paid ads, Apple Search Ads, web-to-app campaigns, paid creative tests, or custom product pages to drive purchases. A paid campaign is only launch-ready when CPA can be evaluated against RevenueCat LTV/cohorts, trial conversion, payback window, and entitlement proof.

## Contents

- 1. Official Sources To Refresh
- 2. Monetization Decision Matrix
- 3. RevenueCat Required Setup
- 4. App Store And Play Product Gates
- 4b. Promotional Image Production (IAP And Subscription Art)
- 4c. Paywall Timing, Plans, Trials, And Offers
- 5. Stripe Required Setup
- 6. RevenueCat Web Billing, Purchase Links, And Funnels
- 7. Pricing And Disclosure Rules
- 7a. Price-Point Decision Procedure
- 8. Backend And Analytics Contract
- 9. Founder-Only Gates
- 10. Anti-Patterns (Monetization And Growth Decision Traps)

## 1. Official Sources To Refresh

Refresh current docs before acting because payment, tax, and app-store rules change:
- RevenueCat product configuration: https://www.revenuecat.com/docs/projects/configuring-products
- RevenueCat store/provider connection and server notifications: https://www.revenuecat.com/docs/projects/connect-a-store
- RevenueCat Web overview: https://www.revenuecat.com/docs/web/web-billing/overview
- RevenueCat Web Purchase Links: https://www.revenuecat.com/docs/web/web-billing/web-purchase-links
- RevenueCat Redemption Links: https://www.revenuecat.com/docs/web/web-billing/redemption-links
- RevenueCat State of Subscription Apps: https://www.revenuecat.com/state-of-subscription-apps/
- RevenueCat solo UA system article: https://www.revenuecat.com/blog/growth/how-to-build-a-ua-system-when-youre-a-one-person-team
- Stripe subscriptions and webhooks: https://docs.stripe.com/billing/subscriptions/webhooks
- Stripe customer portal: https://docs.stripe.com/customer-management
- Stripe go-live checklist: https://docs.stripe.com/get-started/checklist/go-live
- Stripe Tax or tax rates when selling web subscriptions: https://docs.stripe.com/payments/advanced/tax
- Apple App Review Guideline 3.1.1 and external purchase rules: https://developer.apple.com/app-store/review/guidelines/
- Apple App Store Connect IAP setup and pricing docs from `app-store-listing-prep.md` when App Store products or subscriptions are in scope.
- Google Play payments policy: https://support.google.com/googleplay/android-developer/answer/9858738?hl=en
- Google Play subscription lifecycle and RTDNs: https://developer.android.com/google/play/billing/lifecycle/subscriptions

Record checked dates, links, and resulting decisions in `REVENUE_OPS.md` or `LEGAL_REVIEW.md`.

## 2. Monetization Decision Matrix

Choose the smallest reliable monetization path for the current phase:

- **Pre-build validation**: waitlist, pricing page, preorder interest, or non-charging web funnel. Do not imply paid access is active.
- **Mobile-only app subscription**: App Store/Google Play products, RevenueCat products/entitlements/offerings, in-app paywall, restore purchases, sandbox testing, store submission.
- **Web-to-app acquisition**: RevenueCat Web Billing or Stripe Billing through RevenueCat Web, Web Purchase Links or Web Funnels, Redemption Links, deep-link redemption, app entitlement validation.
- **Existing Stripe web business**: Stripe Billing remains billing engine, RevenueCat imports/syncs entitlements, Stripe webhooks and customer portal stay authoritative for billing management.
- **Direct Stripe without RevenueCat**: only use when the app does not need mobile store entitlements or cross-platform entitlement sync. For digital goods unlocked inside iOS/Android apps, review Apple/Google rules first.

Default for B2C mobile subscriptions: RevenueCat owns entitlements and cross-platform subscription state. Stripe may be the web payment rail or billing engine, but a successful Stripe payment is not launch-ready until it unlocks the correct RevenueCat entitlement in the app.

## 3. RevenueCat Required Setup

Required concepts:
- Product: what a user buys, created in Test Store for development or imported from App Store Connect, Play Console, Stripe, or Paddle for production.
- Entitlement: what access the product unlocks; default to `premium` unless the product truly has multiple access tiers.
- Offering: what the paywall displays; default to `default` and read `currentOffering` in the app rather than hardcoding product IDs.

Setup:
- create RevenueCat project
- add app configurations for iOS/Android and web configuration when needed
- keep Test Store separate from production store products
- create/import products with stable identifiers and durations
- create `premium` entitlement and attach all products that unlock it
- create `default` offering and packages for monthly/annual/lifetime or approved product mix
- configure App Store Connect shared secret/IAP key/API key and Google Play service credentials when production stores are in scope
- configure platform server notifications so subscription changes reach RevenueCat promptly
- configure RevenueCat webhooks when the backend, CRM, analytics, or lifecycle emails need server-side subscription events
- add SDK public API keys to the product app only through the app's environment/secrets pattern; keep secret API keys server-side only

Validation:
- fetch offerings in the app
- make a sandbox/Test Store purchase
- verify entitlement active in app, RevenueCat customer view, backend projection if one exists, and analytics events
- restore purchases on a fresh install
- test cancellation/expiration path where sandbox supports it
- verify no mock RevenueCat gateway is enabled in release builds

## 4. App Store And Play Product Gates

**CRITICAL — App container price vs IAP distinction (surface this before any store pricing work begins):**
Subscription and IAP-based apps must remain **Free** at the App Store container level (Pricing and Availability > Price: Free). The container price is the upfront download fee — setting it to $79.99 means every user pays $79.99 just to install the app before seeing the paywall. A Lifetime access offer is a **NON_CONSUMABLE** in-app purchase product created in App Store Connect > In-App Purchases, attached to the app version and mapped to a RevenueCat entitlement/offering. Never set the app container price to the lifetime price. Surface this distinction proactively at the start of any store pricing work; do not wait for the founder to make the error. If `STORE_CONSOLE.md` or `REVENUE_OPS.md` includes a Lifetime offer, verify a NON_CONSUMABLE IAP SKU exists before marking pricing ready.

iOS:
- set app container price to **Free** for any app that monetizes via subscriptions, IAP, or in-app paywalls
- create subscription group and products in App Store Connect
- create NON_CONSUMABLE products for any Lifetime offer; do not use the container price or a consumable/subscription for this purpose
- complete product localization, screenshot/metadata, review information, and pricing
- attach IAP/subscription products to the app version where required
- configure StoreKit testing or sandbox testers
- include restore purchases and clear subscription management/cancellation paths
- do not add external web checkout calls to action without checking current storefront eligibility and Apple rules

Android:
- create subscriptions/base plans/offers in Play Console
- configure license testers and closed/internal testing tracks
- support restore and account hold/grace-period behavior through RevenueCat or backend state
- if handling Play directly, use RTDN and Play Developer API as source of truth; with RevenueCat, confirm notifications reach RevenueCat
- review Google Play Billing and alternative billing eligibility before linking to external checkout

Gate:
- store products must match paywall copy, screenshots, app metadata, privacy/terms, RevenueCat products, and analytics event names.
- App Store listing work must produce an `APP_STORE_LISTING.md` or `STORE_CONSOLE.md` pricing section that ties each App Store product/subscription to RevenueCat entitlement/offering/package, web funnel/Stripe route when used, review status, sandbox proof, and founder approval.

## 4a. Subscription MISSING_METADATA, RevenueCat Product-Type, And Paywall Smoke Proof

These three gaps repeatedly shipped a broken paywall ("Purchases unavailable" / zero packages) across multiple TestFlight builds. Treat each as a hard gate before any build is called paywall-ready.

**Apple MISSING_METADATA resolution.** Every App Store subscription product needs a **subscription-group localization** (display name + description per language) before it leaves the `MISSING_METADATA` state — this is separate from app metadata. Until it clears, RevenueCat returns an empty offering. Resolve it: list products and localizations (`asc subscriptions list --app <APP_ID> --output json`, then the subscriptions localizations list/create verbs — confirm exact flags with `asc subscriptions --help`), create the missing localization, then resubmit for review (founder-approved, with `--confirm`). **Gate:** do not map a product into the RevenueCat catalog or claim paywall-ready while any product is in `MISSING_METADATA`. (Failure card: `revenuecat-missing-metadata-unresolved`.)

**RevenueCat product-type reconciliation.** The product *type inside the RevenueCat dashboard* must match its App Store counterpart: App Store non-consumable IAP → RC `non_consumable`; App Store auto-renewable subscription → RC `auto_renewable_subscription`. A lifetime/one-time unlock mapped as RC `non_renewing_subscription` behaves like a timed unlock and can silently expire. Verify type alignment before attaching to an entitlement/offering, and use `asc-revenuecat-catalog-sync` to surface mismatches. (Failure card: `revenuecat-product-type-mismatch`. This is the RC-dashboard mapping, distinct from the App Store NON_CONSUMABLE rule in section 4.)

**Debug-preview masking + Release smoke proof.** Debug builds often seed preview packages when RevenueCat returns nil/empty, which hides a broken *production* paywall from developer testing. Before any TestFlight upload is marked paywall-ready, run a **Release-scheme** smoke check against sandbox — the in-app iOS Simulator (rung 0) is the fastest sufficient route for this single-screen check; use MobAI or XcodeBuildMCP when the lane already owns one — confirming `currentOffering?.packages` is non-empty, and confirm no code path seeds packages when the RC fetch is empty in the Release target. Also confirm the RevenueCat public key actually injected into the compiled binary (`plutil -p <archive>/Products/Applications/<App>.app/Info.plist | grep -i revenuecat`) — a raw `$(VAR)` placeholder means the key never expanded. (Failure cards: `revenuecat-debug-preview-masking`; key injection is covered by `apple-pre-upload-preflight-skipped`.)

## 4b. Promotional Image Production (IAP And Subscription Art)

Apple requires a **unique 1024x1024 promotional image** for each promoted IAP and subscription product. These are store-facing assets (App Store promoted IAP slots), not app UI screenshots, so Higgsfield output is eligible.

Production route:
- Write a DESIGN.md brief for each product's promotional image (palette, mood, banned aesthetics, intended surface: App Store promoted IAP).
- Generate via `higgsfield generate create gpt_image_2 --prompt "<DESIGN.md brief>" --aspect_ratio 1:1 --wait`. See the **Cheap-First Direction (z_image → production model)** recipe in `tool-recipes/visual-and-motion-production.md` if spend-reduction drafts are needed first; cheap-first must be offered as an explicit spend option, never applied silently — confirm spend per `paid-tool-routing.md`.
- Record every generated asset in `CONTENT_ASSETS.md` with `prompt_brief`, `source_job_id`, QA status, and approval gate. Cross-reference `app-store-listing-prep.md` for upload and metadata sequencing.
- Gate: founder must approve each promotional image before upload. Do not upload while the product is still in `MISSING_METADATA` (see section 4a).

**Paywall hero art:** Route paywall background/hero images through `higgsfield generate create soul_location` (the environment model; prompt-only) with a DESIGN.md brief, or `gpt_image_2` when on-image text is required. This produces environment/background art consistent with the visual system defined in `design-visual-system.md`. Record outputs in `CONTENT_ASSETS.md`; apply the same spend-confirmation and founder-approval gates. Higgsfield output must never substitute for truthful real app UI in store screenshots.

## 4c. Paywall Timing, Plans, Trials, And Offers

Load `onboarding-conversion.md` when paywall placement is part of the first-session flow.
Load `viral-growth-loops.md` when the paywall is paired with referral/share alternatives, creator-code entry, social proof loops, or content-driven impulse purchase timing.

Required decisions:
- hard paywall, soft paywall/freemium, reverse trial, web funnel, or no paywall yet
- value moment shown before paywall: personalized plan, analysis, preview, product demo, or completed setup
- paywall placement in onboarding and fallback if offerings fail to load
- closing offer or reverse-trial behavior after paywall dismissal
- package mix: weekly/monthly entry, annual recommended, lifetime optional only if sustainable
- trial duration hypothesis and experiment plan
- paid UA hypothesis when in scope: target event, CPA/LTV/payback window, selected channel, baseline window, and blended reporting owner

Evidence rules:
- RevenueCat's 2026 report shows hard paywalls materially outperform freemium on Day 35 download-to-paid conversion, but freemium can still be correct when free users drive word of mouth, network effects, UGC, or trust-building.
- RevenueCat's 2026 report shows longer trials can convert better, while shorter trials can speed learning and cash-flow feedback. Treat trial length as an experiment, not dogma.
- RevenueCat's 2026 report identifies the moment after paywall dismissal as a high-leverage conversion point. Test transparent downsells, reverse trials, or shorter commitments without fake scarcity or unclear renewal terms.
- Day 0 is the cancellation-risk window. The first session must prove value, explain billing clearly, and route users to the first activation task.
- RevenueCat's 2026 report shows AI-centric apps earn ~41% more revenue per payer but churn ~30% faster, and LLM-backed features carry real per-subscriber serving cost. Treat AI value as a conversion driver, not a retention guarantee: instrument retention from the first cohort, and follow the report's own unit-economics pattern for AI apps (lead with annual plans, run less-generous freemium, and add a higher-priced AI tier) rather than assuming novelty will keep users. See §8a for the involuntary-churn side of retention.
- **The first renewal is the retention inflection.** Per the 2026 report, ~half of monthly subscribers and ~three in four yearly subscribers don't make it past the first renewal, but retention jumps ~18–30pp between the first and second renewal across all durations — surviving Renewal #1 is the true filter. Yearly plans retain ~3–10× better than weekly by Y1 (higher upfront commitment filters for stronger need), and access method (freemium vs. hard paywall) barely moves Y1 retention. Y1 retention is also softening year-over-year (annual median ~31%→28%, monthly ~10%→8%). The winning move is not gating harder or charging differently — it's **accelerating time-to-value before the first renewal decision**, so design onboarding/activation to land real value well inside the first billing cycle.

## 5. Stripe Required Setup

Use Stripe directly only for web checkout, physical/outside-app goods, B2B invoices, or a chosen web billing engine. For mobile app digital subscriptions, Stripe alone is not enough.

Setup:
- create/verify Stripe account, business profile, branding, support email, statement descriptor, and payout bank
- decide Checkout/Payment Links/Customer Portal vs custom Payment Element; prefer hosted Stripe surfaces for speed and lower risk
- create products and recurring prices if using Stripe Billing
- configure Stripe Tax or explicit tax posture before live subscription sales
- configure customer portal for billing details, invoices, cancellation, and plan changes
- configure webhooks and verify signatures; handle subscription status, invoice paid/failed/finalization failures, payment action required, and cancellation
- use Stripe CLI/sandbox to test all lifecycle events before live mode
- switch to live API keys only after Stripe go-live checklist, webhook endpoint, domain, and terms/privacy pages are ready

Validation:
- test subscription signup
- test failed payment and action-required path
- test customer portal cancellation/update
- verify webhook processing updates the app/backend entitlement source
- verify receipts/emails/support/refund path
- verify public pricing matches Stripe/RevenueCat configured prices

## 6. RevenueCat Web Billing, Purchase Links, And Funnels

RevenueCat Web can support:
- Web Billing with Stripe as payment gateway and RevenueCat managing billing lifecycle
- Stripe Billing connected into RevenueCat Web, where Stripe owns products, subscriptions, emails, and management
- Web Purchase Links for no-code hosted checkout
- Web SDK for custom logged-in web apps
- Web Paywalls and Web Funnels for hosted multi-step web acquisition
- Redemption Links so anonymous web purchasers can redeem access inside the mobile app

**Why web is worth the effort (2026 report signal).** Web revenue adoption scales sharply with success: **~41% of top-tier apps generate web revenue vs. just ~1.3% of hobby-tier apps** — a ~31× gap, with adoption roughly doubling at each revenue tier. Web is still only ~3.2% of total revenue globally (higher in North America at ~4.9%, lower in IN/SEA at ~0.8%), so treat it as a high-leverage *acquisition and margin* lane for a scaling app, not a day-one requirement for a pre-revenue one. The report's framing is that smaller apps under-adopt web mostly because they *haven't tried*, not because it can't work.

**Web funnels are a different funnel, not a copy of onboarding.** Two report findings to encode when designing a web funnel (see `onboarding-conversion.md`): (1) web audiences sit higher in the consideration phase, so a web funnel should **sell the problem before the solution** rather than rush to the in-app "aha"; (2) on web, **a discounted paid trial often outperforms a free trial** — free web trials attract immediate-cancel users that pollute ad-optimization signal (this is the web-specific case of the paid-intro-offer finding in `onboarding-conversion.md`). Run web and app-install creative separately; winners on one channel frequently fail on the other.

Choose:
- **Web Purchase Link** for fastest static landing page checkout.
- **Web Funnel** when paid ads need quiz/onboarding steps before checkout.
- **Web SDK** when the user is logged into a web app and needs a custom checkout UI.
- **Stripe Billing integration** when Stripe products/subscriptions already exist.
- **RevenueCat Web Billing** when starting fresh and wanting RevenueCat-centered subscription lifecycle and reporting.

Required for anonymous web-to-app:
- enable Redemption Links
- register RevenueCat custom URL scheme/deep link in iOS/Android app
- test purchase on a mobile device with the app installed
- show desktop fallback with QR code or install instructions
- handle expired redemption links and support recovery
- verify final entitlement in the mobile app after redemption

Do not publish sandbox purchase links. Keep production and sandbox URLs clearly labeled.

## 7. Pricing And Disclosure Rules

Before publishing pricing:
- founder approves price, trial, intro offer, renewal price, cancellation language, and refund posture
- paywall, landing page, app metadata, screenshots, terms, privacy, store products, RevenueCat offerings, Stripe prices, and analytics all match
- App Store Connect pricing, RevenueCat offering/package IDs, Stripe/web funnel prices, screenshots/app previews, custom product pages, In-App Events, and localized metadata all use the same approved price/trial/renewal facts
- if showing an annual intro offer, keep first-year price, renewal price, and monthly option visible together on direct funnel pages
- avoid fake scarcity, hidden renewal mechanics, or unsupported savings claims
- include platform billing caveats: App Store/Google Play manage in-app purchases; Stripe/RevenueCat/Paddle manage web purchases depending on chosen engine

## 7a. Price-Point Decision Procedure

§7 governs how an approved price is disclosed; this section is how the price gets chosen. "Do pricing research" is not a procedure — this is, and its output lands in `REVENUE_OPS.md` under a "Pricing Decision" heading that `check:revenue` requires before the lane is done.

1. **Anchor against the category.** Pull the subscription prices of 5–10 direct competitors from `RESEARCH.md`'s competitor set — AppKittie app details (IAP lists) plus the live store listings are the sources. Record each competitor's monthly and annual price with the date checked, and compute the category range and median. An anchor table with fewer than five real rows means the research lane is not done enough to price against.
2. **Choose two or three candidate points, biased high.** The benchmarks already in §10 are the prior: higher-priced apps show ~5.4x monthly realized LTV and *higher* download-to-paid conversion, because price reads as a quality signal. Default candidates: the category median, and one point meaningfully above it justified by the 11-star slice. Only go below median with a written reason (deliberate land-grab, network-effect freemium per §4c). Anchor annual as the highlighted plan per §4c and anti-pattern #5.
3. **Design the trial against the value moment, not the calendar.** Trial length and paywall placement route through `onboarding-conversion.md` (Plan And Trial Mix, Paywall Timing) — the trial must be long enough to reach the magical moment from `11_STAR_EXPERIENCE.md` at a realistic usage cadence, and trial length is an experiment, not a constant.
4. **Record the decision.** The chosen points, the anchor table, the rationale, and the founder's approval date go in `REVENUE_OPS.md` ("Pricing Decision"). Pricing is founder-only (§9); the procedure prepares the decision, it never makes it.
5. **Revisit on evidence, not anniversaries.** Post-launch price changes are driven by the cancellation-reason mix (§8b), realized LTV vs. the anchor assumptions (Economics Snapshot in `REVENUE_OPS.md`), and the kill-or-scale evidence pack — and every change routes through `change-cascade.md` so store products, RevenueCat offerings, screenshots, landing, and legal move together.

## 7b. Paywall Experiment Cadence

The first paywall is a hypothesis, not a decision. The apps that clear the $1K-to-$10K climb run continuous paywall/pricing experiments — timing, packaging, trial shape, offer — while the ~75% that never clear it typically shipped one reasonable paywall and stopped (anti-pattern #10 in `onboarding-conversion.md` names this; this section is its procedure). The cadence is a standing program, not a launch task:

- **The backlog is a living artifact.** `REVENUE_OPS.md`'s Paywall Experiment Backlog carries planned/active/completed rows: hypothesis, variant, primary metric, start date, result, decision. `check:revenue` requires current activity once the app has been live four weeks with the revenue lane done — an active row, a completed row started within eight weeks, or a dated next experiment; a backlog of empty headers or one fossilized test is the one-and-done plateau wearing a green check.
- **One experiment at a time per surface,** measured on cohort economics (trial-start rate × trial-to-paid × early churn — §10's guidance), never on day-one conversion alone. Minimum one full renewal-decision window before judging.
- **The test menu, in rough order of historical lift:** paywall timing/placement in onboarding, packaging mix (annual anchor, lifetime presence), trial length and type (opt-in vs opt-out, reverse trial), price point per §7a's revisit procedure, closing offer, and paywall design/copy last.
- **Route by tooling:** RevenueCat Experiments when available (it randomizes and reads revenue truth); otherwise a dated before/after with cohort comparison, honestly labeled as weaker evidence.
- **Founder gates hold:** price changes and new offers are founder-approved per §9; the experiment program proposes, the founder disposes, and every completed test lands its decision back into §7a's pricing record through `change-cascade.md`.

## 8. Backend And Analytics Contract

Create or update `ANALYTICS.md` and backend docs with:
- stable user ID strategy across app, web, RevenueCat, Stripe, Supabase/Firebase, analytics, and support
- anonymous web purchase and redemption behavior
- purchase events: paywall viewed, product selected, checkout started, purchase completed, entitlement active, restore started/succeeded/failed, cancellation, refund, renewal, billing issue
- revenue source dimensions: platform, store, product_id, offering_id, price, currency, intro/trial state, campaign/source/medium
- webhook events and idempotency keys
- support lookup path for Apple Hide My Email or anonymous purchases

Acceptance:
- a support agent can find a user by app UID, RevenueCat App User ID, Stripe customer ID, store transaction ID, email, or anonymous redemption path.

## 8a. Billing Health And Involuntary Churn (Recovery As A Growth Lever)

Not all churn is a user decision. RevenueCat's **State of Subscription Apps 2026** finds that on **Google Play ~31% of all subscription cancellations are involuntary billing failures** (a ~32.2% billing-error rate) — **more than double the App Store's ~14%** (~15.2%). The report's framing: for Android-heavy apps, *fixing billing is one of the highest-leverage growth levers available*, because recovered payments are retained revenue you already earned with no new acquisition spend. Refund medians cluster around 3–5%; involuntary churn is the larger, more recoverable leak.

This is distinct from the win-the-first-session work in `onboarding-conversion.md` (that is voluntary churn / failure to activate). Billing health is the recovery system for users who already decided to pay and then hit a card decline, expired card, insufficient funds, or grace-period lapse.

Treat billing recovery as a first-class system, not an afterthought:
- **Grace period + account hold (Android):** enable Google Play grace period and account hold so a failed renewal retries instead of revoking access instantly. Handle the Play RTDN states (`SUBSCRIPTION_IN_GRACE_PERIOD`, `SUBSCRIPTION_ON_HOLD`, `SUBSCRIPTION_RECOVERED`) through RevenueCat or the backend so entitlement state tracks the recovery, not just the first failure. Confirm exact state names against current Play billing docs before implementing (§1).
- **Billing retry (iOS):** Apple retries failed renewals automatically; surface the App Store-managed *Billing Issue* / update-payment path rather than treating the first decline as a hard cancel.
- **RevenueCat billing-issue webhook → dunning:** wire the RevenueCat `BILLING_ISSUE` / billing-issue webhook to a recovery sequence — an in-app banner and a push *before* the grace period ends, plus the `payment.failed` lifecycle email in `resend-email-ops.md`. Give the user one tap to update the payment method (native subscription management deep link), and show the remaining grace period in plain language.
- **Experience-card alignment:** the payment-failure recovery card in `experience-cards.md` (restorative gesture, grace-period-aware copy, no spend prompt on a failure screen) is the UX contract for this; keep the copy non-punitive.

Analytics: emit `billing_issue_detected`, `billing_recovery_prompt_shown`, `payment_method_update_started`, and `billing_recovered` / `billing_issue_churned` with `platform`, `store`, `grace_state`, and `failure_reason` dimensions so involuntary churn and recovery rate are measurable separately from voluntary churn. Do not report retention health without splitting voluntary vs. involuntary churn by platform.

## 8b. Reactivation And Win-Back (Plan-Dependent, Mostly Monthly)

Some churn is recoverable later. RevenueCat's **State of Subscription Apps 2026** defines reactivation as the share of churned subscribers who become active again within 12 months, and the headline is that **reactivation is highly plan-dependent**: monthly-plan churners reactivate at ~18–24% across regions (~20% overall), weekly at ~7–10%, and **annual at just ~4–6% — annual churn is largely permanent** regardless of geography or price tier. Category spread is wide (monthly reactivation ranges ~6% to ~36%, highest in Productivity / AI-heavy apps), and high-priced monthly plans win back best (~28.9%) while high-priced annual churners (~4.4%) rarely return.

Design implications:
- **Don't bank win-back on annual churners.** Once an annual subscriber leaves, the data says they almost never come back inside a year. Put win-back energy where it pays off (monthly/weekly cohorts), and price/position annual to *prevent* the churn rather than chase the return.
- **Reactivation fires when the problem recurs, not when the email lands.** For cyclical-need categories (dating, fitness, entertainment, seasonal/shopping), the durable move is staying useful after cancellation and making return frictionless — not campaign spam. Pair with the lifecycle/`payment.failed`/win-back sequences in `resend-email-ops.md`, but treat the email as a reminder for users whose need already returned, consistent with `onboarding-conversion.md` anti-pattern #4.
- **Offer pause instead of cancel, and keep return one tap.** Let users pause a subscription rather than fully cancel, and don't force them to re-enter payment details to come back. Surface this in the cancellation flow alongside the transparent downsell/closing offer (`onboarding-conversion.md`), without dark patterns.
- **Capture the cancellation reason at the moment of cancellation.** One screen in the in-app cancellation/pause flow — before the store-managed cancel handoff — with a fixed reason-code taxonomy: `too_expensive`, `missing_feature`, `found_alternative`, `not_needed`, `technical_issue`, `other` (free text optional, never required). Emit `cancellation_reason_selected` with `reason_code` and `plan_duration`. A delayed exit-survey email measures who answers email, not why people cancel — same Day-0 logic as the rest of this file. The aggregated mix feeds the Pricing Decision revisit (§7a step 5: a `too_expensive` majority is pricing evidence), win-back targeting here in §8b (`missing_feature` churners are the reachable cohort when the feature ships), and the kill-or-scale evidence pack. Never gate the actual cancellation on answering — the screen is skippable in one tap, per the ethics guardrail.

Analytics: track `subscription_paused`, `reactivation_offer_shown`, `reactivated`, and `cancellation_reason_selected` with `prior_plan_duration`, `days_since_churn`, `price_tier`, and `reason_code` so reactivation is measured by plan duration (where the real gains are) rather than as a single blended rate. All §8a/§8b event names live in the `ANALYTICS.md` Event Contract first — `check:analytics-catalog` reconciles `REVENUE_OPS.md` against the catalog the same way it does onboarding and growth docs.

## 9. Founder-Only Gates

Always ask before:
- creating live Stripe/RevenueCat/Apple/Google products
- changing prices, trials, discounts, intro offers, renewal terms, tax settings, or billing engine
- enabling live checkout or publishing purchase links
- submitting IAP/subscriptions for review
- enabling external purchase links/calls to action in app
- changing refund/cancellation/legal language
- switching from Test Store/sandbox to production

Agents may self-resolve doc organization, sandbox validation sequencing, and which non-live checklist to run first.

## 10. Anti-Patterns (Monetization And Growth Decision Traps)

This skill mostly tells agents what to do. This section names what *not* to do: the comfortable defaults that feel safe and quietly lose. They share one pattern — founders fall in love with building, then reach for the cozy choice on money and distribution. The losing moves are documented in public benchmarks; the winning moves are slightly uncomfortable.

Every figure below is from the **RevenueCat State of Subscription Apps 2026** report (already tracked in `references/source-registry.yaml`). Treat each direction as a strong default to test against your product, not dogma — the existing nuance in §4c and `onboarding-conversion.md` still holds (freemium can be right when free users drive network effects; trial length is an experiment). The anti-pattern is reaching for the cozy default *by reflex* and never surfacing the trade-off.

This is the digest index. Traps 1–2, 5–6, and 13–14 are detailed here; the rest live in their home references.

| # | Anti-pattern (the cozy default) | Lives in |
| --- | --- | --- |
| 1 | Assume you are the exception | here |
| 2 | Soft paywall by default because a hard paywall "feels pushy" | here + `onboarding-conversion.md` |
| 3 | Default to a 3-day/short trial because "urgency converts" | `onboarding-conversion.md` |
| 4 | Ignore the first session and bank on a day-30 win-back email | `onboarding-conversion.md` |
| 5 | Push monthly, skip annual | here |
| 6 | Price low to be "humble" | here |
| 7 | Ship English-only; treat localization as optional translation | `app-store-listing-prep.md` |
| 8 | Run ads before you can read the result | `paid-user-acquisition.md` |
| 9 | Optimize ad creative first | `paid-user-acquisition.md` |
| 10 | Run one paywall experiment a year and call it focus | `onboarding-conversion.md` |
| 11 | Chase views / vanity reach | `paid-user-acquisition.md` + `viral-growth-loops.md` |
| 12 | Skip the App Preview video because it "feels like a real project" | `app-store-listing-prep.md` |
| 13 | Treat involuntary (billing-failure) churn as inevitable | here + §8a |
| 14 | Bank on AI novelty for retention | here + §4c |

**1. Assume you are the exception.** Only ~4.6% of newly launched apps reach $10K/month within two years, with roughly a 75% drop-off from the $1K to the $10K milestone. A vision board does not move you into the 4.6%. Do not pick a monetization model that only works if you are an outlier. Choose the path that survives if you are the median app, and instrument the funnel so you learn fast enough to climb.

**2. Soft paywall by default because a hard paywall "feels pushy."** Hard paywalls show a median ~10.7% Day-35 download-to-paid conversion vs ~2.1% for freemium (about 5x), and roughly 8–9x higher D14 revenue per install ($2.32 vs $0.27). Letting everyone in free and gently whispering "maybe upgrade someday" is the cozy choice that leaves most of the money behind. Default to *testing* a hard paywall after a clear value moment; choose freemium **deliberately** when free users drive network effects, UGC inventory, marketplace value, or word of mouth (see §4c and `onboarding-conversion.md` Paywall Timing), not because forcing a decision feels rude.

**5. Push monthly, skip annual.** Apps whose most popular plan is yearly generate the highest realized revenue per install (D14 $0.36, D60 $0.46 — above weekly- and monthly-dominant apps); an annual commitment locks in retention instead of handing the renewal decision back to the store every month. Do not lead with monthly because it "feels honest and low-commitment." Offer annual as the highlighted plan with monthly and any entry plan visible alongside it (see `onboarding-conversion.md` Plan And Trial Mix), and test the mix.

**6. Price low to be "humble."** High-priced apps show ~5.4x the monthly realized LTV of low-priced apps ($35.89 vs $6.67) and ~6x the yearly LTV ($62.19 vs $10.69) — and download-to-paid is *higher* at higher prices (2.8% vs 1.4%), because price reads as a quality signal. Pricing at $2.99 "to avoid gouging anyone" trains users to value the app at nothing; it is not generous. Set price from delivered value and willingness to pay, then test it. (This is distinct from the App Store **container price**, which must stay Free for subscription/IAP apps — see §4. The anti-pattern here is the *subscription/IAP price* being anchored low out of timidity.)

**13. Treat involuntary (billing-failure) churn as inevitable.** On Google Play ~31% of cancellations are involuntary billing failures (~32.2% billing-error rate) vs. ~14% (~15.2%) on the App Store — and the report calls fixing billing one of the highest-leverage growth levers for Android apps, because recovered payments are revenue you already earned. Shipping the paywall and then shrugging at declines is the cozy default that quietly leaks retained revenue. Stand up the recovery system in §8a (grace period / account hold, billing-issue webhook → dunning push + in-app banner + `payment.failed` email, one-tap update-payment), and split voluntary vs. involuntary churn by platform in analytics. Do not call retention "healthy" without measuring the involuntary slice.

**14. Bank on AI novelty for retention.** AI-centric apps earn ~41% more revenue per payer but churn ~30% faster (per the 2026 report), and LLM features carry real per-subscriber cost. Assuming the AI wow-factor will keep users — and skipping the retention/unit-economics work — is the trap. Instrument retention from the first cohort, protect margin per the report's AI pattern (annual-led plans, less-generous freemium, a higher-priced AI tier; see §4c), and judge an AI app on second/third-cycle renewal and reactivation, not just install-day conversion.

Founder-only gate reminder: pricing, plan mix, trial length, and paywall-model changes are all founder-approved (see §9). Surface the benchmark trade-off; do not silently apply or silently skip it.
