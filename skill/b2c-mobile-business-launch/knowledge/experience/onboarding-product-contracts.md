# Onboarding Product Contracts

Load from `onboarding-conversion.md` when `ONB-10` through `ONB-14` becomes ready. These nodes join product, data, money, trust, and customer-success decisions before architecture or screen design locks.

## 7. ONB-10: first value and activation

Define separately:

- first-value request
- first-value generation started
- first value rendered
- first value engaged
- first value saved, applied, or acted upon
- activation
- habit signal
- retention
- monetization
- review eligibility
- initial onboarding completion

A render is not activation.

Generate multiple first-value candidates and score them against comprehension, relevance, effort, latency, reliability, privacy, accessibility, cost, editability, persistence, monetization, and retention potential.

The chosen first value must be real, understandable, useful, and connected to the acquisition promise. Do not use a generic tutorial, static sample presented as personal, fake AI progress, or an empty dashboard.

Use historical data only after a data-quality check. If historical instrumentation is unreliable, define an explicit activation hypothesis, instrument it, and set a validation window. Do not manufacture a data-backed claim.

## 8. ONB-11: effort, questions, and personalization proof

Create an effort-before-value ledger containing:

- required screens and taps
- text entry and estimated typing
- selections
- image or file inputs
- permissions
- account actions
- network-dependent steps
- active time and wait time
- interruptions
- payment before or after value

Classify effort as passive, low, moderate, high, sensitive disclosure, permission, account commitment, or financial commitment.

For every question classify it as:

- required before first value
- useful before first value
- useful but deferrable
- better inferred
- better requested contextually later
- marketing or experiment only
- unnecessary
- harmful
- duplicate
- obsolete

A required question must identify the downstream behavior it changes and the screen where the user sees proof that it mattered. Inserting a name into generic copy is not personalization proof.

One dominant decision per screen is the default. Back, skip, restore, privacy, terms, and close can exist with intentionally lower hierarchy.

## 9. ONB-12: canonical state and continuity

Separate:

- identity
- onboarding journey
- profile completeness
- activation
- entitlement
- experiment assignment and exposure
- review eligibility
- permission and consent
- lifecycle

Do not use one `onboardingComplete` flag or persist screen names as business state.

For every transition define trigger, preconditions, actor, authoritative system, persistence, side effects, event, idempotency, retry, failure, compensation, consumers, and privacy class.

Support:

- anonymous mobile and web users
- anonymous-to-authenticated linking
- purchase before account creation
- web purchase before install
- reinstall and cross-device use
- account switching and deletion
- restore and delayed entitlement
- deep links and deferred deep links
- interrupted journeys
- expired trial, churn, win-back, and resubscription
- identity collisions and support-assisted recovery

A user does not repeat successful onboarding work because a surface, device, identity, or payment boundary changed.

## 10. ONB-13: analytics and experimentation

Analytics is a typed product contract.

Use one machine-readable schema and generated or typed clients where practical. Do not scatter raw event strings.

Distinguish:

- client interaction events
- backend-confirmed product outcomes
- provider-confirmed purchase and entitlement outcomes
- derived lifecycle metrics

One business outcome has one authoritative emitter.

The common envelope considers:

- event ID, name, and version
- occurred and received timestamps
- source, environment, platform, app and journey versions
- anonymous, user, installation, session, journey, correlation, causation, and request IDs
- experiment assignments and exposure
- acquisition and referral context
- storefront, locale, timezone, and consent
- provider customer identifier only when appropriate

Define identity stitching, offline queueing, retry, ordering, deduplication, replay, webhook idempotency, late arrival, and privacy.

The event dictionary reconstructs:

`acquisition -> first open -> onboarding start -> minimum input -> first-value request -> first value rendered -> first-value engagement -> account link -> paywall presentation -> checkout -> provider-confirmed transaction -> entitlement active -> activation -> retention -> cancellation -> expiration -> reactivation`

It also covers permissions, reviews, deep links, redemption, errors, lifecycle messages, share/referral, and experiments.

An assignment is not an exposure. Emit exposure only when the variant is actually experienced.

Every major path has an expected event sequence and an automated sequence test.

## 11. ONB-14: review, permissions, lifecycle, and trust

### Review requests

Earn review eligibility after real value and meaningful engagement.

Do not request a review inside first-run onboarding. The default early hypothesis is:

1. earn eligibility at the first qualifying success
2. finish first-run onboarding
3. request at a later natural success moment in normal product use
4. allow same-session request only after onboarding has ended and the user has completed a normal-product action; otherwise use a later session

Use only the native Apple and Google review APIs. Do not use a custom star screen, sentiment pre-screen, five-star ask, incentive, or route that sends happy users to the store while diverting unhappy users.

Suppress on recent error, crash recovery, checkout, restore, support, cancellation, another modal, insufficient experience, cooldown, or remote kill switch.

Record only observable facts, such as:

- `review_eligibility_earned`
- `review_request_suppressed`
- `review_request_attempted`
- `review_request_returned`

Do not claim the platform displayed a prompt, the user submitted a review, or a rating value unless a reliable permitted platform signal exists.

Private feedback and support remain available independently and are not used as a public-review gate.

### Permissions

Request photos, camera, notifications, tracking, calendar, contacts, or other protected access only in response to a user action with a visible benefit. Define denial, limited access, retry, settings, analytics, privacy, and fallback behavior.

### Lifecycle

Design abandoned-onboarding recovery, first-value follow-up, first-week education, progressive profiling, trial onboarding, trial-ending communication, post-purchase activation, habit formation, billing recovery, dormancy, churn, win-back, and resubscription.

One orchestration strategy owns channel eligibility and suppression. Providers do not independently send overlapping push, email, and in-app messages.

### Trust

Minimize data collection. Treat images, body or fit information, size, appearance inferences, confidence answers, location, free text, and purchase history as potentially sensitive.

Define purpose, storage, encryption, access, third parties, analytics treatment, retention, deletion, export, privacy disclosures, and age obligations.
