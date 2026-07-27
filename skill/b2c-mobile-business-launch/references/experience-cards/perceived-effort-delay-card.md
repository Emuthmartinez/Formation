# Perceived Effort Delay Card

Part of the Experience Card deck. Read [`../experience-cards.md`](../experience-cards.md) first — it carries the card shape, the summary table, the Ethics Ladder/attestation contract, and the per-card routing. Apply cards via `EMOTIONAL_DESIGN.md` per `emotional-design-system.md`; HIGH-risk mechanics carry the full ethics contract in `ethics-guardrail.md`.

## Perceived Effort Delay Card

**One-liner.** Show the system working through the user's specific inputs — a narrated
processing moment that converts wait time into perceived craftsmanship and raises willingness
to pay.

**Emotional beat.** Anticipatory trust — "It's working hard for me; this result must be worth
it."

### Psychology + Canonical Research

Ryan Buell and Michael Norton demonstrated in "The Labor Illusion: How Operational Transparency
Increases Perceived Value" (_Management Science_, 2011) that users rate service quality higher
and value outputs more when they can observe the effort expended on their behalf — even when
the underlying delay is partly artificial. In their canonical experiment, a travel-search site
that revealed its search process step-by-step was rated significantly better than one that
returned results instantly, despite identical result quality.

Norton, Mochon, and Ariely's IKEA Effect (_Journal of Consumer Psychology_, 2012) compounds
this: when a user participates in or witnesses the construction of their output — especially
when the system visibly processes their own inputs — the perceived value of that output
inflates because the user has psychological skin in the game. On mobile, the combination
produces a double lift: the labor signal raises the service's perceived quality (Buell/Norton
axis) and the user's involvement raises the output's perceived personal value (IKEA axis).

Gollwitzer's implementation intentions research (_American Psychologist_, 1999) adds a third
layer: when the system makes the user's stated inputs explicit during the build phase, it
strengthens the user's mental ownership of the result before they have even seen it.

| Source | Finding | Confidence |
|---|---|---|
| Buell & Norton, _Management Science_ (2011) | Users value outcomes more and rate service quality higher when they observe the effort behind them — even when delay is partly artificial. | solid |
| Norton, Mochon & Ariely, _Journal of Consumer Psychology_ (2012) | IKEA Effect: users place higher value on outputs they participated in creating; perceived effort delay strengthens this when users see the system working through their specific inputs. | solid |
| Gollwitzer, _American Psychologist_ (1999) | When the processing screen names the user's own inputs, it converts them into an implementation intention for the revealed result. | solid |
| Buell, attribution-uncertain follow-on work circa 2016–2019 | Extensions of operational transparency to algorithmic/mobile contexts; narration of algorithmic steps produces similar quality-perception lifts. | attribution-uncertain |

### Mechanism Steps

1. User completes the input phase (onboarding quiz, goal-setting, content upload, or query
   submission).
2. The app enters a processing state. The UI does NOT show a generic spinner. It opens with a
   scene-setting line tied to the user's context: "Building your plan, [name]…" or "Analyzing
   your answers…"
3. A sequence of 3–6 narration steps fires at paced intervals (not random). Each step names a
   dimension of the user's own input: "Matching your goal: sleep 8 hours…", "Calibrating for
   your schedule: 5 mornings a week…" Each step has a stable `copy_key` for analytics.
4. A visible progress indicator (bar, count, or stepped dots) advances with each narration
   step — not continuously — so the user reads each step before the next replaces it.
5. When real computation finishes, the final narration step resolves: "Your plan is ready."
   The transition to the result screen is a designed reveal moment, not an abrupt swap.
6. The revealed result screen immediately shows the user's own language back: their goal, their
   schedule, their named preferences.
7. An opt-out or cancel affordance is always present. A visible "Skip ahead" or "Cancel"
   ensures the mechanic serves users who do not want the wait.

### Real App Examples

**Noom.** After the onboarding quiz (~16 questions), Noom shows a multi-step "Creating your
personal plan" screen that ticks through named dimensions — BMI analysis, behavior change
strategy, pace recommendation — before revealing the program. The processing screen lasts 8–12
seconds and explicitly names the user's goal weight and timeline in the narration. Noom's
paywall conversion is among the highest in the health category; this mechanic is cited by
growth analysts as a primary lever.

**Headspace.** During initial setup, Headspace shows a "Preparing your session" state that
references the session type and duration the user chose. Even when content is pre-recorded and
instantaneous to serve, the processing state communicates deliberate matching. The user
perceives a matching act, not a random playlist.

**Lensa / AI avatar apps.** Show a prominently timed processing sequence — often 30–90 seconds
with visible step labels ("Training your model…", "Generating styles…") and a real progress
bar — before delivering the generated image set. Users who see the steps rate the output
quality higher than users shown a featureless progress bar for the same duration, even when
the images are identical.

### When to Use / When NOT to Use

**Use** at any moment where the app transitions from user input to a personalized output. The
card has the highest impact immediately before the paywall or the first-value reveal screen.
Canonical trigger points: (1) after the onboarding quiz, before the personalized plan reveal;
(2) after a user submits a goal for AI/algorithmic processing; (3) after a workout or session
completes while the summary is being composed; (4) after a file/photo upload while analysis
runs.

**Do NOT use:** (1) when there is no real computation, data processing, or UI composition
happening and the delay would be entirely synthetic — this crosses the dark line; (2) on error
or payment-failure screens; (3) on cancel, unsubscribe, or downgrade flows; (4) for repeat
actions after the user has already seen the card multiple times in the same session.

### Producer Recipe

1. **Identify the input boundary.** Locate the exact screen or event where the user's inputs
   are complete and the app transitions to output. Name it in `ONBOARDING.md` as the "effort
   delay trigger point." Document what real computation occurs here. If the answer is "none,"
   the card cannot be applied — stop here and record the blocker.
2. **Audit your inputs.** List every user answer, selection, or preference the system now
   holds. Map each to a plain-language template phrase.
3. **Design the step sequence.** Write 3–6 narration steps. First step references the user's
   primary goal. Middle steps reference supporting inputs. Final step: "Your [plan/result] is
   ready." Assign a stable `step_copy_key` to each step. The displayed copy can be A/B tested;
   the key must never change.
4. **Implement the timing contract.** Duration is real computation time, minimum 2 seconds,
   maximum 15 seconds for onboarding flows, 90 seconds for legitimate AI/GPU workloads. If
   real computation finishes before the minimum, hold the UI until the minimum elapses — but
   document this in code comments as a UX hold, not a fake delay. Never add arbitrary sleep
   timers beyond the UX hold minimum.
5. **Build the reveal transition.** Fade or upward-reveal animation using `DesignTokens.Motion`
   on native; framer-motion/motion on web. Result screen must surface the user's own language
   in its hero copy.
6. **Add the opt-out affordance.** Include a visible "Skip" or "Continue without waiting"
   control. Log skip events as `perceived_effort_cancelled`.
7. **Instrument all events.** Wire `perceived_effort_started` (with `computation_type`),
   `perceived_effort_step_shown` (per step, with `step_copy_key` and `inputs_personalized: bool`),
   `perceived_effort_completed`, `perceived_effort_cancelled`, `perceived_effort_result_engaged`, and
   `perceived_effort_result_dismissed`. Set person properties `plan_built_at`,
   `plan_inputs_count`, `plan_effort_steps_seen`.
8. **Implement reduced-motion fallback.** Read the OS-level preference before starting any
   animation. When reduce-motion is active: remove all transitions and step-fade animations;
   display narration steps as a static list that auto-advances via text change only.
9. **Validate computation type.** Before any experiment is enabled, a code reviewer must
   confirm every `perceived_effort_started` event tagged `computation_type: ui_composition` or
   `real_data_processing` has a corresponding real operation — not a sleep timer. Log in
   `TECH_SPEC.md`. This is the guardrail gate.
10. **Run the A/B experiment.** Deploy the `exp_perceived_effort_<app_slug>_<YYYYMM>` flag with
    three variants: control (generic spinner), personalized steps, personalized steps + visible
    progress count. Primary metric: `paywall_viewed → trial_started` or `purchase_completed`.

### Auditor Signals

**Present**
- Processing screen shows narration steps that reference the user's own inputs by name or
  category — not generic steps like "Loading…" or "Please wait…"
- Each narration step has a stable `copy_key` in the codebase
- `perceived_effort_started` event fires with `computation_type` populated and
  `user_inputs_referenced_count > 0`
- `perceived_effort_step_shown` fires per step with `inputs_personalized: true` for at least the
  first step
- A visible Skip or Cancel affordance exists on the processing screen
- Result reveal screen surfaces the user's own language in the hero copy
- `reduce_motion_active` property is set in `perceived_effort_started` and fallback rendering is
  verified in device accessibility settings
- `computation_type` is documented in `TECH_SPEC.md` with no arbitrary sleep timers beyond
  a documented UX hold minimum

**Missing**
- Processing screen shows a generic spinner with no narration
- Narration steps reference system-internal steps ("Connecting to servers…") rather than user
  inputs
- `perceived_effort_started` fires but `user_inputs_referenced_count = 0`
- No Skip / Cancel affordance on the processing screen
- Result reveal screen shows a generic output header with no user-language echo
- No reduced-motion fallback
- `plan_effort_steps_seen` person property not set
- `TECH_SPEC.md` has no `computation_type` documentation

**Misused**
- Delay implemented with an arbitrary sleep timer that fires even when the API response has
  already returned — pure theater, crosses the dark line
- Processing screen fires on the cancel or unsubscribe flow — adds friction to exit,
  compliance veto
- Processing screen fires on a payment-failure or error screen — compliance veto
- The same processing screen fires on every subsequent session for repeat actions
- Progress bar advances continuously and randomly regardless of actual computation stages —
  fake progress bar, canonical dark-line example
- `computation_type` tagged `real_api_call` in analytics but implementation uses `setTimeout`
- Narration steps reference user's inputs but those inputs were never used in the computation

### Measurement Events

| Event | What it proves | Required properties |
|---|---|---|
| `perceived_effort_started` | Card fired; `computation_type` confirms delay is honest | `computation_type`, `user_inputs_referenced_count`, `flow_id`, `variant_id` |
| `perceived_effort_step_shown` | Each narration step reached the user | `step_copy_key`, `inputs_personalized: bool`, `step_index` |
| `perceived_effort_completed` | User saw the full processing sequence | `actual_duration_ms`, `target_duration_ms`, `reduce_motion_active: bool` |
| `perceived_effort_cancelled` | User chose to skip | `time_to_cancel_ms`, `step_at_cancel` |
| `perceived_effort_result_engaged` | User found the result worth acting on | `time_to_first_engagement_ms` |
| `perceived_effort_result_dismissed` | Counter-metric | `time_to_dismiss_ms` (< 1000 ms is the clearest signal wait wasn't worth it) |
| `emotion_card_fired` | System-level card registry event | `card_id: perceived_effort_delay` |
| `emotion_card_abandoned` | User exited during or immediately after the card | `rage_tap_detected: bool` |

### Mobile Implementation + Reduced-Motion

**SwiftUI.** Full-screen overlay with a `VStack` of narration labels that fade in sequentially
using `withAnimation(.easeInOut(duration: DesignTokens.Motion.durationBase))`. Advance
steps using a timer tied to real async task state, not a fixed `DispatchQueue.asyncAfter`
chain. Reduced-motion: check `UIAccessibility.isReduceMotionEnabled`; when true, render all
steps as a static list with instant text replacement, no opacity transitions, no progress bar
animation. The step auto-advance timer still runs.

**Flutter.** `AnimatedSwitcher` with `FadeTransition` for each step label; drive step index
from a `StreamController` that emits on real computation milestones. Check
`MediaQuery.of(context).disableAnimations` for the reduced-motion gate.

**React Native (Reanimated 3).** `useSharedValue + withTiming` for step opacity; drive from a
`useEffect` that listens to real Promise resolution events. Reduced-motion gate:
`AccessibilityInfo.isReduceMotionEnabled`.

**Web (motion/react).** Use the motion library with variants for step entry (opacity: 0 → 1,
y: 8 → 0, transition: { duration: 0.3, ease: 'easeOut' }). Gate all variants behind the
`prefers-reduced-motion` media query via `useReducedMotion()` from motion/react. Progress bar:
use a stepped indicator that advances only when a real step fires — not an indeterminate
spinner. Each segment lights up with a short fill animation (`DesignTokens.Motion.durationSlow`, 360 ms).

### Bright Line / Dark Line / Guardrail

**Bright line.** The processing delay shows the user evidence of real work — a real API call,
real data processing, or real UI composition — narrated in the user's own language. The user
can cancel at any time. Accuracy of the steps is upheld: if the system says "Analyzing your 5
goals," it used all 5 goals in the computation.

**Dark line.** An artificial delay added by a sleep timer or arbitrary `setTimeout` with no
underlying computation — pure theater. Equally: a progress bar that advances randomly
regardless of real computation stages (a fake progress bar). A discovered fake delay produces
a trust collapse worse than no delay at all, triggers "just a spinner" and "doesn't actually
analyze" review clusters, and is a compliance veto.

**Guardrail.** Before any `perceived_effort_started` event is instrumented, the code reviewer
must confirm in `TECH_SPEC.md`: (1) `computation_type` is one of `real_api_call`,
`real_data_processing`, or `ui_composition` — no sleep-timer-only path; (2) the minimum UX
hold (if any) is documented with exact milliseconds and a code comment; (3) narration steps
are driven by real async milestones, not a fixed timer sequence; (4) at least one narration
step references a real user input by value or category. Run `npm run check:emotional-design
-- --root .`. If `computation_type = ui_composition` and `perceived_effort_cancelled` rate exceeds
10% in any variant, halt the experiment and file the emotional-card-dark-line-crossed failure
card immediately.

### Pairs With

- Variable Reward Card — effort delay builds anticipation that the variable reward card
  delivers into
- Commitment Card — the processing screen can echo the user's committed goal, reinforcing
  commitment and activating the IKEA effect simultaneously
- Intent Mirroring Card — the result reveal screen that follows is the natural placement for a
  brief intent mirror

### 11-Star Level

**6-star (Better than expected).** A loading screen that narrates what the system is doing
converts wait into perceived work — users arrive at the result trusting it more than they would
from an instant response. Minimum viable Labor Illusion application; baseline target for V1.

**7-star (Way beyond).** The narration names user-specific details drawn from their actual
inputs — their stated goal, their selected schedule, their named obstacle — so the processing
screen feels like watching a skilled practitioner read their file before prescribing. At this
level, the IKEA effect and implementation-intention mechanisms are both active, and the result
reveal feels co-created rather than retrieved.

---
