# Intent Mirroring Card

Part of the Experience Card deck. Read [`../experience-cards.md`](../experience-cards.md) first — it carries the card shape, the summary table, the Ethics Ladder/attestation contract, and the per-card routing. Apply cards via `EMOTIONAL_DESIGN.md` per `emotional-design-system.md`; HIGH-risk mechanics carry the full ethics contract in `ethics-guardrail.md`.

## Intent Mirroring Card

**One-liner.** A deliberate pause that reflects the user's declared goal back in their own
words — before effort or payment — turning a transactional interaction into a moment of
self-recognition that deepens motivation and perceived fit.

**Emotional beat.** Being seen — "This product understands what I actually want."

### Psychology + Canonical Research

The Intent Mirroring Card operates at Norman's reflective tier of emotional design — the level
where identity, meaning, and values are processed, not just usability or appearance (Don
Norman, _Emotional Design_, 2004). The reflective tier is where loyalty beyond usability is
formed. Most consumer apps reach the behavioral tier (they work smoothly), and a few reach
the visceral tier (they look right). Almost none reach the reflective tier in onboarding,
which is precisely why Intent Mirroring is differentiating.

The mechanism has two interlocking psychological components. First, Gollwitzer's implementation
intentions research (1999) shows that an explicit if-then plan dramatically increases follow-
through compared to a vague goal statement. Reading one's own goal back in a concrete,
contextual form reinforces the plan structure. When the product mirrors the goal in the user's
own phrasing rather than a generic paraphrase, it also activates Cialdini's commitment and
consistency principle (_Influence_, 1984): seeing your stated goal reflected back creates a
subtle but real pressure to behave consistently with it, because the goal now feels externally
witnessed and therefore more binding.

Alan Cooper's goal-directed design framework (_The Inmates Are Running the Asylum_, 1999)
provides the engineering frame: the product's onboarding must serve the user's actual goal —
the outcome they are trying to achieve in their life — not the task the app instructs them to
perform. Kahneman and Fredrickson's peak-end rule (_Psychological Science_, 1993) supplies the
conversion mechanic: the mirror is engineered to be the emotional peak of the onboarding curve,
positioned before the paywall so the subscription decision is made from a peak emotional state.

| Source | Finding | Confidence |
|---|---|---|
| Norman, _Emotional Design_ (2004) | The reflective tier — where self-image and values are processed — produces loyalty beyond usability; most apps never reach it. | solid |
| Gollwitzer, _American Psychologist_ (1999) | Explicit if-then plan dramatically increases follow-through; reading one's goal back in concrete, contextual language strengthens goal representation. | solid |
| Cialdini, _Influence_ (1984) — commitment and consistency | Seeing one's own stated goal reflected back by a third party increases consistency pressure; the goal now feels socially real. | solid |
| Cooper, _The Inmates Are Running the Asylum_ (1999) | Design from the user's final goal — the outcome they want in their life — and work backward. Products that make the user's actual goal visible create significantly stronger perceived fit. | solid |
| Picard, _Affective Computing_ (1997) | Systems that recognize and respond to a user's emotional state create significantly stronger engagement and trust; the recognition itself is a meaningful emotional event. | solid |
| Kahneman & Fredrickson, _Psychological Science_ (1993) — peak-end rule | Overall memory of an experience is dominated by the emotional peak and the end. Intent Mirroring is engineered to be the peak of the onboarding emotional curve. | solid |

### Mechanism Steps

1. Collect explicit goal data during onboarding — gather the user's goal, current state,
   biggest obstacle, or desired outcome as a discrete, queriable field (not free text embedded
   in a paragraph).
2. Select the mirror trigger moment — choose one of: (a) after commitment is captured and
   before the paywall, (b) at the start of a return session, or (c) immediately after the
   first value reveal. Do not use all three in the same session.
3. Compose the mirror in the user's own language — use the exact phrasing from their selection
   or, if free text, their verbatim words. Do not paraphrase, generalize, or psychologically
   escalate.
4. Design a deliberate pause — animate the mirror text with a slow fade-in using
   `motion.durationReveal` (600 ms) so the screen has a quiet, considered energy distinct from
   transition screens.
5. Confirm forward motion — after the mirror, provide a single, goal-aligned CTA: "Let's
   build your plan" / "Start your first session." The CTA must NOT be a paywall trigger on
   the same screen.
6. Emit the PostHog event — fire `intent_mirror_shown` when the mirror screen is fully
   visible; fire `intent_mirror_continued` when the user taps the CTA.
7. Apply the reduced-motion fallback — when prefers-reduced-motion is active, render the
   mirror text as instantly visible, styled text with no animation.
8. Limit to 1–2 triggers per session maximum.

### Real App Examples

**Duolingo.** After language-and-why onboarding questions, before the first lesson, Duolingo
surfaces: "Your goal is to hold a basic conversation in French in 3 months. We'll do 10
minutes a day." The user's own selections — language, goal type, daily time — are reflected
back as a concrete plan. The mirror activates Gollwitzer's implementation intention: the if-
then plan ('10 minutes a day / French / 3 months') is more cognitively activating than a
vague "learn French" goal. The user is deciding to purchase from a peak of felt alignment.

**Noom.** After 15+ onboarding questions, Noom presents: "Based on what you told us, you're
most likely struggling with emotional eating triggered by stress at work. Here's how we'll
address it." The user's specific obstacle — not a generic category — is named back. Noom's
mirror operates at Norman's reflective tier: the user feels understood at the level of identity
and emotional pattern. The mirror is placed immediately before the paywall — the emotional peak
of the onboarding curve (Kahneman and Fredrickson peak-end rule).

**Headspace.** At the start of every session after initial onboarding, Headspace briefly
surfaces the user's stated reason for meditating — "You're here to reduce anxiety before
sleep" — and names the session type that addresses it. This return-session mirror is the
10-star implementation of Intent Mirroring: a human advisor would restate your goal at the
beginning of every session. Headspace makes this scalable by storing the user's stated reason
and surfacing it as a contextual opener. It activates Cialdini's consistency on each return.

**Calm.** After selecting a sleep story, Calm briefly shows a screen that connects the
selection to the user's stated sleep goal: "You said you want to fall asleep faster. Sleep
stories are one of the most effective tools our members use for that." The mechanism is brief
(one sentence) but operates at Norman's reflective tier by connecting the immediate action to
the user's self-concept.

### When to Use / When NOT to Use

**Use** in consumer mobile apps that collect personalization data in onboarding — goal-setting,
health, fitness, education, habit, finance, creativity, and coaching apps. Trigger at one of
three moments: (1) after commitment is captured and before the paywall — canonical placement,
making it the emotional peak that precedes the purchase decision; (2) at the beginning of a
return session — concierge-level implementation; (3) immediately after the first value reveal.

**Do NOT use** in: (a) utility apps where the user has no declared goal beyond task completion;
(b) apps where no onboarding questions were asked; (c) more than 1–2 times per session; (d) on
the same screen as a paywall CTA; (e) crisis, mental health, or grief contexts where reflecting
a user's stated distress back to them without clinical support could cause harm.

### Producer Recipe

1. **Map the mirror sources in `ONBOARDING.md`** — identify every question whose answer will
   be used in a mirror. For each: record the field name, data type, stored key in the backend
   profile, and PostHog person property.
2. **Choose the mirror trigger moment** — select one primary trigger. Document the trigger in
   `ONBOARDING.md` with the screen ID, the step that precedes it, and the step that follows.
   Confirm the paywall does not appear on the same screen.
3. **Write the mirror template using the user's own language.** Use the user's exact selection
   text, not a paraphrase. Test every combination of onboarding answers.
4. **Design the motion spec** — slow fade-in using `motion.durationReveal` (600 ms) with a brief
   pause before the CTA appears (~300 ms after text is fully visible). Specify the reduced-
   motion fallback in `TECH_SPEC.md`.
5. **Implement the PostHog events** — add `intent_mirror_shown` (with `surface`,
   `mirror_type`, `source_field`, `trigger_context`, `has_free_text`, `user_goal_category`)
   and `intent_mirror_continued` (with `surface`, `next_action`, `time_on_screen_ms`) to
   `ANALYTICS.md` before implementation.
6. **Write the guardrail attestation block** — in `ONBOARDING.md` or `ETHICS.md`, add the
   experience card attestation block: `id`, `mechanism (intent_mirroring)`, `applied_to`,
   `star_level (7)`, `posthog_event`, `bright_line`, `dark_line`, `guardrail`. Record the
   content source (field names from the data collection matrix).
7. **Verify on device before build handoff:** (a) mirror text uses exact words from user's
   selections, (b) CTA follows the mirror and does not trigger a paywall on the same screen,
   (c) reduced-motion fallback renders correctly with Accessibility > Reduce Motion enabled,
   (d) both PostHog events appear in the PostHog activity view, (e) mirror is absent from any
   screen where the paywall is present.
8. **Record evidence in `PRODUCTION_READINESS.md`** — document the content source (field
   names and stored keys), the trigger context, the screen ID, and the result of the bright-
   line three-question test.

### Auditor Signals

**Present**
- Onboarding includes a dedicated screen that displays the user's stated goal or obstacle in
  their own words before the paywall or first core action
- Mirrored text uses the user's exact phrasing, not a generic paraphrase like "your goal"
- Mirror screen has a distinct visual treatment with a deliberate pace — slow fade-in or a
  brief pause
- CTA on the mirror screen is goal-aligned ("Let's build your plan"), not purchase-oriented
  ("Start your free trial") — paywall appears on a subsequent screen
- `intent_mirror_shown` and `intent_mirror_continued` events are present in PostHog with
  `source_field` and `trigger_context` properties
- Reduced-motion fallback is implemented — text renders instantly with no animation when OS
  reduce-motion is enabled, verified on device
- Mirror fires at most once or twice per session
- `ETHICS.md` or `ONBOARDING.md` contains the experience card attestation block with
  `bright_line`, `dark_line`, and `guardrail` fields filled

**Missing**
- No mirror screen in onboarding — onboarding collects personalization data but never reflects
  it back before the paywall
- Mirror is present but generic — "Here is your personalized plan" without the user's actual
  words
- Mirror fires on the same screen as the paywall CTA
- Mirror is implemented as a subtitle or small caption, not as a deliberate, prominent pause
- `intent_mirror_shown` event missing from PostHog
- Reduced-motion fallback absent
- No `source_field` property on the PostHog event
- Attestation block missing or has empty required fields

**Misused**
- Mirror reflects an inferred or computed emotional state the user did not explicitly state
- Mirror escalates the user's stated obstacle into anxiety language
- Mirror used immediately before a paywall on the same screen — recognition moment primes
  the purchase rather than serving the user's goal
- Mirror fires on every screen transition throughout onboarding — 3+ times in a single flow
- Confirmshaming applied in the same flow ("No thanks, I prefer to stay stuck")
- Mirror used in a streak-break grief screen combining loss-aversion with the mirror to
  manufacture urgency
- Free-text content from the user used verbatim in the mirror without sanitization

### Measurement Events

| Event | What it proves | Required properties |
|---|---|---|
| `intent_mirror_shown` | Mirror fired — user saw their stated goal reflected back | `surface`, `mirror_type`, `source_field`, `trigger_context`, `has_free_text`, `user_goal_category` |
| `intent_mirror_continued` | User tapped the goal-aligned CTA | `surface`, `next_action`, `time_on_screen_ms` |
| `paywall_viewed` | Downstream cohort split | segment users who saw `intent_mirror_shown` before `paywall_viewed` vs. those who did not |
| `return_session_started` | When mirror fires on return sessions | measure `core_action_completed` rates for sessions with mirror shown vs. without |

### Mobile Implementation + Reduced-Motion

**SwiftUI.** Implement the mirror screen as a dedicated `SwiftUI View` with
`@State var isVisible = false` and `.opacity(isVisible ? 1 : 0)` animated with
`withAnimation(.easeInOut(duration: 0.6)) { isVisible = true }` in `onAppear`. Use
`UIAccessibility.isReduceMotionEnabled` to gate: if reduce-motion is on, set
`isVisible = true` immediately in `onAppear` with no animation. Text fades in first; CTA
appears after a 0.9 s delay. Token: `DesignTokens.Motion.durationReveal` (600 ms).

**Flutter.** `AnimatedOpacity(opacity: _visible ? 1.0 : 0.0, duration: const Duration(milliseconds: 600), curve: Curves.easeInOut)`. Reduced-motion gate: `MediaQuery.of(context).disableAnimations`.

**React Native (Reanimated).** `withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })`. Gate on `AccessibilityInfo.isReduceMotionEnabled()`; if true, set opacity to 1 immediately.

**Web (motion/react).** `motion.div` with `initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, ease: 'easeInOut' }}`. Use `useReducedMotion()` from motion/react to gate. Typography: use the product's heading-level type token for the mirrored goal text. Layout: full-screen or nearly full-screen, centered vertically, ample breathing room — the screen should feel like a pause, not a slide.

### Bright Line / Dark Line / Guardrail

**Bright line.** The mirror reflects the user's own stated words or explicit selections — their
actual goal, obstacle, or declared intent — back to them, at a quiet moment, before asking for
effort or payment, in service of making them more likely to achieve what they came to the app
to achieve. The user feels recognized, not analyzed.

**Dark line.** Mirroring an inferred, escalated, or manufactured emotional state the user did
not explicitly express — to manufacture anxiety, urgency, or guilt that primes a purchase.
Using the mirror on a cancellation or downgrade path as a confirmshaming device. Both are the
mirror mechanism weaponized as a retention dark pattern.

**Guardrail.** Verify all five conditions before ship: (1) Content source check — every word
in the mirror text traces to an explicit user input field documented in `ONBOARDING.md`.
(2) Paywall separation check — mirror screen and paywall screen are distinct, separate screens.
Verify in the rendered `onboarding.html` and on device. (3) Frequency check — count mirror
triggers per session in PostHog; max 2 per `session_id`. (4) Tone check — review mirror copy
against `BRAND.md §Voice`; any phrase that could be read as guilt-inducing, crisis-escalating,
or confirmshaming is a veto. (5) Reduced-motion check — enable OS reduce-motion on a real
device and run the onboarding flow; confirm the mirror screen is still present and readable.
Record all five check results in `PRODUCTION_READINESS.md`.

### Pairs With

- Commitment Card — the commitment is the source data for the mirror; these two fire in
  sequence
- Perceived Effort Delay Card — mirror sets the emotional frame; effort delay builds
  anticipation; reveal is the paywall-adjacent emotional peak
- Variable Reward Card — mirror anchors the session to a meaningful goal; variable reward
  provides moment-to-moment engagement
- `references/onboarding-conversion.md` — canonical mirror trigger is pre-paywall; mirror
  must appear before the App Review popup

### 11-Star Level

**7-star (Way Beyond).** The mirror is not a generic recap. It uses the user's exact phrasing
and reflects back their motivation, not a product description. The user recognizes themselves
in the product's output — the moment that produces the 7-star label "made for me" in
`11_STAR_EXPERIENCE.md`. The return-session mirror is the scalable implementation of the
10-star concierge behavior (a human advisor who restates your goal at the beginning of every
session).

---
