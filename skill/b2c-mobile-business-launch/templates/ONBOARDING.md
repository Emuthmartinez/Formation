# Onboarding

Status: partial until the flow is product-specific and visually verified.

## Goal

- Target user state before onboarding: define the user's current problem, motivation, and skepticism.
- Desired state after onboarding: the user has seen first value, understands why the app fits them, and knows the next action.
- 11-star mapping: tie the first value/value-reveal moment to `11_STAR_EXPERIENCE.md` and `LAUNCH_TRACE.md`.

## Screen Sequence

| Step | Purpose | Copy / question | State | Visual / motion | Analytics | Back / skip |
| --- | --- | --- | --- | --- | --- | --- |
| Promise | Show what the app does | Product-specific value promise | visible | product demo or truthful prototype | `onboarding_started`, `onboarding_step_viewed` | back allowed |
| Attribution | Capture launch learning | How did you hear about us? | required unless not applicable | simple source list with Other text | `attribution_source_selected` | no skip unless documented |
| Personalization | Collect useful setup | Product-specific question | optional or required per matrix | accessible form controls | `onboarding_answer_selected` | back allowed |
| First value / value-reveal | Show the personalized plan, analysis, demo result, aha moment, or first win | Product-specific first value | visible before paywall | stable mounted screen | `personalized_plan_viewed` | continue allowed |
| App Review popup | Immediately after the first value/value-reveal screen | Native App Review request | eligible only after value is visible | automatic 1-2 second delay while mounted | `review_prompt_eligible`, `review_prompt_requested` | flow continues if suppressed |
| Push permission prime | The next earned moment after first value — never the same step as the review popup | soft-prime screen, then the system dialog (`push-notification-lifecycle.md`) | only after value is visible; hard denial falls back to email lifecycle | user-initiated from the prime screen | `push_permission_primed`, `push_permission_granted`, `push_permission_denied` | flow continues either way |
| Paywall or activation | Convert or complete first action | Product-specific offer or task | after first value and review request | RevenueCat or activation UI | `paywall_viewed`, `activation_task_completed` | restore/support visible |

## Data Collection Matrix

| Question | Answer options | Personalization use | Attribution use | Lifecycle use | Privacy note | Required |
| --- | --- | --- | --- | --- | --- | --- |
| How did you hear about us? | stable source keys plus `other` text | none | source key, label, UTM/referrer context | segmentation | avoid sensitive data | yes |

## App Review Popup

- Placement: immediately after the first value/value-reveal screen, before paywall or activation detours.
- Native API: iOS uses `SKStoreReviewController.requestReview(in:)`; Android uses Google Play In-App Review / `ReviewManager`.
- Timing: automatically request after the value screen is fully displayed and visible with a 1-2 second async delay.
- Trigger guard: do not bind the request to an acceptance tap or navigation action that dismisses the screen.
- Cooldown: respect platform frequency caps and app-level eligibility rules.
- Analytics: emit `review_prompt_eligible` before the request and `review_prompt_requested` when the native API is called.
- Fallback: the platform may not show the review sheet; continue the onboarding flow without blocking, inferring rating content, or incentivizing reviews.

## Emotional Card Timing

Onboarding is where most Experience Cards fire. When the 11-star target is 6-star or higher, mirror the card-timing contract from `references/emotional-design-system.md §Integration §Onboarding Conversion` and record each moment in the `EMOTIONAL_DESIGN.md` Card Application Map with a PostHog event:

- **Commitment Card** — at the first personalization / goal question; echoed (not used as friction) on the plan reveal and paywall. Event: `commitment_made`.
- **Perceived Effort Delay Card** — at plan / result generation, narrating real computation (≥50% real-step ratio). Event: `perceived_effort_started` / `perceived_effort_completed`.
- **Intent Mirroring Card** — after first value and immediately before the paywall; never on the paywall screen itself or any cancel flow. Event: `intent_mirror_shown`.
- **App Review popup** — at or just after the emotional peak (the first value/value-reveal), per the App Review Popup section below.

The onboarding emotional curve must cross positive (+2) at or before the paywall; a curve that first turns positive after the paywall is a conversion-design failure. Every animated card moment needs a `prefers-reduced-motion` fallback.

## Build Handoff Gates

- `onboarding.html` shows the value-reveal screen followed by the App Review popup placeholder.
- `ANALYTICS.md` includes all onboarding, attribution, review prompt, paywall, and activation events.
- `EMOTIONAL_DESIGN.md` Card Application Map covers the onboarding card moments above with a measurement event each (when the emotional_design lane is in scope).
- `REVENUE_OPS.md`, `PRIVACY.md`, `TERMS.md`, and support links match the flow before implementation.
- `npm run check:onboarding -- --root <app>` passes.
