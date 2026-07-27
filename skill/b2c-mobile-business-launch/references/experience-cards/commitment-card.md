# Commitment Card

Part of the Experience Card deck. Read [`../experience-cards.md`](../experience-cards.md) first — it carries the card shape, the summary table, the Ethics Ladder/attestation contract, and the per-card routing. Apply cards via `EMOTIONAL_DESIGN.md` per `emotional-design-system.md`; HIGH-risk mechanics carry the full ethics contract in `ethics-guardrail.md`.

## Commitment Card

**One-liner.** Elicit one small, voluntary choice early in onboarding — then echo it
throughout the product — so users feel ownership over their goal rather than obligation to an
app.

**Emotional beat.** Ownership — "I said this matters to me; I should follow through."

### Psychology + Canonical Research

The consistency drive is one of the most stable forces in human motivation. Robert Cialdini's
_Influence_ (1984) identifies commitment and consistency as the second principle of influence:
once a person has actively committed to a position, they experience psychological pressure to
behave consistently — not because someone is watching, but because identity coherence is
intrinsically rewarding. The key amplifiers are: the commitment was active (chosen, not
passaged), written or stated, and voluntary (coerced commitments produce backlash, not
consistency). The foot-in-the-door technique (Freedman & Fraser, 1966, _Journal of Personality
and Social Psychology_) demonstrates that a small initial commitment dramatically increases
compliance with later, larger requests — mapping directly to the onboarding-to-subscription
conversion arc.

Goal-setting theory (Locke & Latham, 1990) adds the specificity dimension: vague intentions
produce far less behavioral change than specific, challenging goals. The commitment step
converts a vague user hope into a bounded goal the product can reflect back.
Implementation intentions (Gollwitzer, 1999, _American Psychologist_) complete the mechanism:
when a user specifies an if-then plan — "When I open the app in the morning, I will log my
first meal" — follow-through rates approximately double. BJ Fogg's Behavior Model (B=MAP,
_Tiny Habits_, 2019) adds the motivational amplification lens: a user who has declared intent
is already in a higher motivation state; the product's job is to match it with low friction
and well-timed prompts.

| Source | Finding | Confidence |
|---|---|---|
| Cialdini, _Influence_ (1984) Ch. 3 | Commitment and consistency: active, public, voluntary commitments create internal pressure to behave consistently; foot-in-the-door compounds the effect. | solid |
| Locke & Latham, _A Theory of Goal Setting_ (1990) | Specific, difficult goals produce significantly higher performance than vague intentions. | solid |
| Gollwitzer, _American Psychologist_ (1999) | If-then implementation intentions approximately double follow-through vs. goal statements alone. | solid |
| Fogg, _Tiny Habits_ (2019) — B=MAP | Declared intent raises baseline motivation; matched with high ability and a well-timed prompt, behavior is far more likely. | solid |
| Freedman & Fraser, _JPSP_ (1966) | Small, active, voluntary initial commitment makes subsequent larger compliance significantly more likely. | solid |
| Norman, _Emotional Design_ (2004) | Reflective design — products that help users reflect on their own values and goals — produces the strongest and most durable emotional engagement. | solid |

### Mechanism Steps

1. Surface a single, low-stakes, voluntary choice early in onboarding — a goal statement, a
   target, a schedule, or a preference — framed as the user's own decision, not a required
   form field.
2. Confirm the commitment with a quiet visual acknowledgment (~150 ms), not a
   congratulations. The acknowledgment should feel like the product heard the user.
3. Persist `commitment_type` and `commitment_value` to the user profile and PostHog person
   properties. This is the data backbone for every downstream echo.
4. Echo the commitment throughout the product: plan summary screens use the user's exact
   words, push notification copy references the stated goal, coach or guide responses invoke
   it, milestone headers reflect it, and paywall framing positions the subscription as
   unlocking the user's declared intent.
5. Prompt the user to specify when and where they will act: "When do you usually have 10
   minutes for yourself?" converts a goal into a trigger-anchored habit plan
   (Gollwitzer implementation intention).
6. Surface the commitment echo at session starts, at natural friction points, and at milestone
   moments.

### Real App Examples

**Duolingo.** Day 1 onboarding — user selects a daily goal (5–20 min/day) and immediately
sees a streak calendar initialized around that choice. Every session opens with that goal
visually present. Notifications say "You're just [X] minutes away from your goal today." The
choice is active, voluntary, and immediately reflected in the product's core metric. Cialdini
consistency pressure fires every time the user sees the streak counter under their stated goal.

**Noom.** A 10–15 question onboarding quiz culminating in a "Your plan is ready" screen that
reflects the user's exact answers — current weight, target weight, timeline, biggest obstacle
— back as a personalized plan with a projected date. The paywall immediately follows. The quiz
creates a series of small, active commitments that compound into one large one. By the time the
paywall appears, the user has made 10+ small voluntary choices. This is Gollwitzer's
implementation intention made visual.

**Headspace.** Onboarding asks the user to select their reason for meditating (Stress, Sleep,
Focus, Anxiety, Personal Growth) and set a daily reminder time. Both choices appear in the
home screen header — "Good morning, [Name]. Ready to work on [Focus] today?" — for the
duration of the subscription. The "reason" selection is a reflective-tier commitment; every
session that opens with the user's stated reason is an implementation intention reminder.

**Strava.** After adding a first activity, Strava prompts the user to set a weekly distance
goal. The goal appears as a progress ring on the home tab throughout the week, and the
week-end summary email uses the user's exact goal number as its anchor. The commitment
provides the reference point the goal-gradient effect requires.

### When to Use / When NOT to Use

**Use** when the app's value is tied to a user behavior change, habit, or goal pursuit:
fitness, language learning, finance, wellness, productivity, diet, creative practice, therapy.
Most effective in the first 3 screens of onboarding, before any friction or data-entry burden.

**Do NOT use** when: the product is a pure utility where goal-declaration would feel forced;
when the commitment cannot be echoed downstream (a commitment captured and never referenced is
worse than no commitment — it feels like the product ignored the user); or in distress/crisis
contexts where consistency pressure could become coercive.

### Producer Recipe

1. **Identify** the one commitment most predictive of long-term retention in your category. If
   the answer will never appear in another screen, do not collect it.
2. **Place** the commitment step after the value-promise screen, before any significant
   friction. Onboarding step 2–4 of typically 8–12.
3. **Frame** as the user's decision: "What are you here to do?" not "Set your goal."
4. **Add** an implementation intention prompt immediately after: "When do you usually have
   [X] minutes free?" + "Where will you typically be?"
5. **Confirm** with a minimal visual acknowledgment — a soft highlight, a 150 ms fade of the
   commitment value into the next screen's header. Not a celebration animation.
6. **Persist** `commitment_type` and `commitment_value` to user profile, PostHog person
   properties, and the push-notification personalization layer before onboarding completes.
   Emit `commitment_made` with all required properties.
7. **Echo** the commitment in: (a) personalized plan/summary screen immediately after
   onboarding, (b) home screen header or widget on every session, (c) push notification copy,
   (d) milestone celebration copy, (e) paywall framing. Each echo emits `commitment_echoed`
   with its surface.
8. **Verify editability:** the commitment must be modifiable from Settings or Profile without
   a support ticket. Test on device before marking this card complete.

### Auditor Signals

**Present**
- Onboarding contains at least one screen asking the user for a specific goal, target,
  frequency, or reason — not just demographic data
- The commitment value appears verbatim on the plan/summary screen immediately after the
  question
- Push notifications and lifecycle emails reference the user's stated goal, not generic copy
- Home screen or persistent UI element shows the user's commitment and current progress
- The commitment is editable from a Settings or Profile screen (verify on device)
- `commitment_made` and `commitment_echoed` PostHog events appear in the activity view after
  onboarding completion
- The commitment step appears before the paywall, not after it

**Missing**
- Onboarding asks about goals but answers are never reflected back in any downstream screen
- Plan/summary screen uses generic category language instead of the user's specific answer
- Push notifications use the same copy for all users regardless of stated commitment
- `commitment_made` event absent from PostHog after onboarding
- No editable commitment field in Settings or Profile
- Commitment step is placed after the paywall

**Misused**
- Commitment step is framed as a mandatory form required to proceed — removes voluntariness
- Commitment value used to manufacture urgency or guilt in paywall copy ("You said this was
  important — don't let yourself down")
- Commitment elicited and then immediately ignored — never echoed
- Commitment used to imply fabricated social proof ("10,000 people with your goal started
  today")
- Multiple commitment questions stacked on the same screen — commitment fatigue
- Commitment editable only by contacting support — editability gating is a compliance
  violation

### Measurement Events

| Event | What it proves | Required properties |
|---|---|---|
| `commitment_made` | User actively selected a goal during onboarding | `commitment_type`, `commitment_value`, `flow_id`, `step_id`, `platform` |
| `commitment_echoed` | Product surfaced the commitment on a downstream screen or notification | `surface`, `commitment_type`, `commitment_value` |
| `commitment_edited` | User updated their stated commitment from Settings | `old_commitment_value`, `new_commitment_value`, `surface` |
| `onboarding_step_viewed` | Commitment step was reached and rendered | filter by `step_id` matching the commitment screen to measure drop-off |
| `return_session_started` | User returned | segment by `commitment_type` to measure D1/D7/D30 return rates |
| `core_action_completed` | User completed an action aligned with their commitment | segment by `commitment_type` to validate Gollwitzer mechanism |
| `paywall_viewed` | Reach paywall | segment by whether `commitment_made` fired before `paywall_viewed` |

### Mobile Implementation + Reduced-Motion

**Web (motion/react).** `import { motion } from "motion/react" }`. Use `whileTap` scale pulse
on selection tile (scale 0.97 → 1.0, duration: `--motion-duration-fast` 120 ms), then
`AnimatePresence` to transition the selected value into the next screen's header (y: 8px → 0,
opacity 0 → 1, duration: `--motion-duration-base` 220 ms, easing: ease-out). Reduced-motion: use
`useReducedMotion()` hook; when true, skip the scale pulse and apply an instant opacity swap
— no translate, no scale.

**SwiftUI.** Wrap the commitment tile in a `Button` with `.buttonStyle(.plain)`. On selection,
animate the confirmation with `.animation(.easeOut(duration: DesignTokens.Motion.durationFast),
value: selectedCommitment)` — a background color transition. The commitment value fades into
the next view's header via the standard `NavigationStack` transition with a custom `.opacity`
modifier driven by `DesignTokens.Motion.durationBase`. Reduce-motion: check
`@Environment(\.accessibilityReduceMotion)` and replace transition with
`.transaction { $0.animation = nil }`. No spring effects on the confirmation.

**Flutter.** `AnimatedContainer` for the color-fill transition (duration:
`DesignTokens.Motion.durationFast`). `FadeTransition` with
`CurvedAnimation(curve: Curves.easeOut)` for the value into the summary header. Reduce-motion:
check `MediaQuery.of(context).disableAnimations` and substitute `duration: Duration.zero`.

**React Native / Reanimated.** `withTiming` (duration: `DesignTokens.Motion.durationFast`) for
the selection fill; `withTiming` with `Easing.out(Easing.ease)` for the value fade. Check
`AccessibilityInfo.isReduceMotionEnabled()` and set duration to 0 when true. All durations
must read from `DesignTokens.Motion` constants, not hardcoded milliseconds.

### Bright Line / Dark Line / Guardrail

**Bright line.** The commitment reflects the user's real intent and the product uses it
exclusively to serve that intent better — personalizing plan copy, push timing, coach
responses, milestone framing, and paywall positioning around what the user said they actually
wanted to achieve.

**Dark line.** Using the commitment to manufacture guilt, urgency, or loss-aversion in service
of a purchase decision the user would not otherwise make; using a vague commitment to imply
the user agreed to a subscription they did not explicitly understand; fabricating social proof
from commitment data. All three are compliance vetoes.

**Guardrail.** Before this card is marked launch-ready, verify two things on a real device:
(1) navigate to Settings or Profile and confirm the user can update or delete their stated
commitment without a support ticket; (2) review every copy surface that echoes the commitment
and confirm none uses the commitment value to manufacture guilt, urgency, or loss-aversion.
Run `npm run check:emotional-design -- --root .` and verify zero errors on
commitment-echoed copy surfaces.

### Pairs With

- Intent Mirroring Card — reflects the commitment back at a meaningful moment
- Variable Reward Card — the commitment provides the reference frame for variation to feel
  personally meaningful
- Perceived Effort Delay Card — echoing the commitment during plan-generation amplifies the
  IKEA effect
- `references/onboarding-conversion.md` — the commitment step is an onboarding-conversion
  surface; placement and framing directly affect paywall conversion rate
- `references/eleven-star-experience.md` — maps to 6-star (product remembers me) and 7-star
  (made for me)

### 11-Star Level

**6-star (Better than Expected).** The product remembers the user's stated commitment and
surfaces it consistently — in plan summaries, push copy, milestone headers, and coach
responses — without the user having to repeat themselves. The product acts like a
knowledgeable partner who listened.

**7-star (Way Beyond — Made for Me).** The product adapts its cadence, copy, coach tone,
push timing, and paywall framing precisely to the user's stated commitment AND the
implementation intention context (when and where they said they would act) — so every
touchpoint feels authored for this specific person's goal, not drawn from a template.

---
