# Endowed Progress Card

Part of the Experience Card deck. Read [`../experience-cards.md`](../experience-cards.md) first — it carries the card shape, the summary table, the Ethics Ladder/attestation contract, and the per-card routing. Apply cards via `EMOTIONAL_DESIGN.md` per `emotional-design-system.md`; HIGH-risk mechanics carry the full ethics contract in `ethics-guardrail.md`.

## Endowed Progress Card

**One-liner.** Pre-credit users with partial progress at enrollment so completion feels like
finishing something already started, not beginning something from zero.

**Emotional beat.** Momentum — "I'm already partway there; walking away now would waste what
I've built."

### Psychology + Canonical Research

Kivetz, Urminsky, and Zheng's 2006 _Journal of Marketing Research_ study established the
endowed progress effect: loyalty-card holders given 2 pre-stamped slots on a 10-stamp card
outperformed holders given a blank 8-stamp card at the same real task requirement. The
pre-stamps did not reduce effort — they reframed the user's position on the goal-gradient.
Clark Hull's 1932 goal-gradient hypothesis provides the underlying drive mechanism: locomotion
toward a goal accelerates as the distance to the endpoint shrinks. Together: endowment moves
the user off the zero-position (which feels inert) onto the gradient (which feels alive).

Locke and Latham's goal-setting theory (1990) supplies the third layer: specific, proximal
sub-goals sustain motivation more reliably than vague distal ones. When an onboarding quiz
question is framed as "step 2 of 8" and two steps have already been pre-completed, the
sub-goal (finish the remaining six) is specific and proximal. This is not a trick — every
answer the user provided during onboarding, every permission they granted, every piece of
setup work they completed genuinely advances the product's ability to serve them. Pre-crediting
these real contributions is accurate and honest. The deception failure mode is pre-crediting
phantom work that contributes nothing to the product's ability to serve the user.

| Source | Finding | Confidence |
|---|---|---|
| Kivetz, Urminsky & Zheng, _JMR_ (2006) | Loyalty-card holders given 2 free stamps on a 10-stamp card outperformed holders given a blank 8-stamp card despite identical real effort — pre-credited progress increases goal completion rates. | solid |
| Clark Hull (1932) | Goal-gradient hypothesis: effort and motivation toward a goal accelerate as the distance to goal completion decreases. | solid |
| Locke & Latham (1990) | Specific, proximal goals sustain motivation better than vague or distal goals. | solid |

### Mechanism Steps

1. User arrives at the onboarding or feature enrollment entry point. The progress indicator is
   already partially filled — typically 20–30% — reflecting real contributions: account
   creation, permissions granted, onboarding answers, device locale, referral code scanned, or
   any system-level data the product has already collected.
2. Each completed step is labeled with its real contribution ("You answered 3 questions — your
   profile is taking shape"). The label must name what was earned, not just show a number.
3. As the user advances through remaining steps, the progress indicator updates with each
   action. Steps remaining, not steps taken, is the headline number on the final stretch.
4. When the user completes the final step, the progress bar completes with a distinct
   animation — a brief fill-and-pulse on mobile that signals the transition from "building" to
   "ready." This is the emotional peak for this card.
5. The completed progress is echoed in downstream surfaces: the plan summary header, the first
   session greeting, and the paywall context line ("Your personalized plan is ready").

### Real App Examples

**Duolingo.** When a returning user opens a new skill, their existing XP and streak history
pre-populate the course-level progress indicator so they enter the new unit already above zero,
feeling momentum from the broader learning arc rather than facing a blank start. The
pre-populated progress represents real prior work (vocabulary learned, streaks maintained), so
the endowment is honest.

**Noom.** During onboarding, Noom's multi-step quiz uses a progress bar that begins visually
advanced before the user has answered all questions — partially credited for signing up, for
providing their goal, and for granting notification permission — so by question 5 of a
10-question quiz the bar is already past the halfway mark. Each credited action is real setup
work the product used to personalize the plan.

**Headspace.** New users who link an existing Apple Health record or import sleep data see a
"foundations" progress indicator that begins at 1 of 5 rather than 0 of 5, with the pre-
credited step labeled "Sleep data connected" — before they have listened to a single session.
The connected health data is genuinely used to personalize the first session recommendation.

### When to Use / When NOT to Use

**Use** during onboarding when the product has already collected real inputs from the user
(account creation, device locale, permissions granted, referral source, prior usage data,
connected health/calendar/social accounts, quiz answers already given). Use at feature
enrollment when prior in-app behavior constitutes genuine groundwork for the new feature. Use
at subscription upgrade when the user's free-tier history can be honestly represented as a
head-start on the paid-tier progress arc.

**Do NOT use** at the start of a genuinely blank-slate task where no real prior contribution
exists — the pre-fill must represent actual work done, not fabricated credits. Do NOT use when
the progress indicator tracks a safety-critical or legally significant completion (medical
intake, legal agreement, financial setup) where partial-completion framing could mislead. Do
NOT apply to paywall progress indicators that imply the user is "almost there" toward a paid
feature they have not yet earned — this crosses into manufactured urgency. Do NOT combine with
fabricated scarcity copy.

### Producer Recipe

1. **Audit the user's state** at the enrollment entry point. List every real contribution
   already made: account/device setup, permissions granted, locale/language selected, onboarding
   answers provided, referral code scanned, calendar/health/social data connected, prior
   free-tier activity. Each item is a candidate credit. Discard any item that does not actually
   improve the product's ability to serve the user.
2. **Map candidate credits to named steps.** Each credit must have a one-line label ("You set
   a goal: run 3x per week", "Notifications enabled — we can remind you", "We detected your
   timezone"). Step labels are shown in a completed-step list below or beside the progress bar.
3. **Choose a pre-fill percentage:** 20% for a light onboarding (1–2 real prior contributions);
   30–40% for a rich prior state (3+ real contributions). Do not exceed 40% pre-fill on
   first-time onboarding.
4. **Implement the progress component** with two visual states: (a) pre-credited segments
   rendered in a slightly lower-opacity or "banked" fill color; (b) real-time fill as the user
   advances. Pre-credited fill animates in on screen-mount using `DesignTokens.Motion`.
   Implement prefers-reduced-motion: fallback is instant fill with no animation.
5. **Wire the "named head-start" label.** At the top of the progress surface: "You've already
   [N action labels] — here's your head start." This label must populate from real user state,
   never from static copy.
6. **Emit PostHog events.** Fire `endowed_progress_shown` on screen mount with:
   `credits_count`, `credits_labeled` (array of credit label keys), `total_steps`,
   `pre_fill_pct`, `surface`, `flow_id`. Fire `endowed_progress_completed` when the user
   finishes the remaining steps, with: `credits_count`, `steps_completed_by_user`,
   `total_duration_ms`, `completion_pct_at_mount`.
7. **Verify the bright line before shipping:** open `TECH_SPEC.md`, confirm every pre-credited
   step has a documented mapping to a real product operation. If any credit cannot be mapped,
   remove it. Record the step-to-operation map in `TECH_SPEC.md` and reference it in
   `PRODUCTION_READINESS.md`.

### Auditor Signals

**Present**
- Progress indicator is partially filled on first appearance at the enrollment entry point
- Each pre-filled step has a visible text label explaining what was earned
- A "named head-start" summary line appears near the progress indicator
- Pre-credited fill is visually distinguishable from steps the user completes in the current
  session (different fill opacity, color, or icon state)
- Fill animation respects prefers-reduced-motion / OS reduce-motion
- `endowed_progress_shown` PostHog event fires with `credits_count`, `pre_fill_pct`, and
  `surface` properties
- `endowed_progress_completed` fires with `steps_completed_by_user` and `total_duration_ms`

**Missing**
- Progress indicator starts at 0% despite the user having completed real prior steps
- No labeled explanation for pre-filled steps — the bar is partially filled but the user
  cannot tell why
- No "named head-start" summary — the pre-fill is silent
- No PostHog events for the progress surface
- Progress indicator on the paywall surface implies proximity to unlocking paid features
  without the user having earned that proximity
- No prefers-reduced-motion fallback on the fill animation

**Misused**
- Pre-filled steps represent phantom work ("Welcome!" or "Account type: Free") that
  contributes nothing to product personalization
- Pre-fill percentage exceeds 70% at onboarding entry, simulating near-completion before any
  real work
- Progress indicator is placed on the paywall screen with copy implying the user is "almost
  there" toward a subscription benefit — manufactured urgency
- Pre-credited step list includes future actions not yet taken, framed as completed
- Progress bar is reset to 0% on re-entry after the user leaves and returns, erasing the
  endowment
- Pre-fill applied to safety-critical or legally significant completion steps

### Measurement Events

| Event | What it proves | Required properties |
|---|---|---|
| `endowed_progress_shown` | Card rendering with non-zero pre-fill at enrollment entry point | `credits_count`, `pre_fill_pct`, `total_steps`, `surface`, `flow_id` |
| `endowed_progress_completed` | User finished the remaining steps | `credits_count`, `steps_completed_by_user`, `total_duration_ms`, `completion_pct_at_mount` |
| `onboarding_step_viewed` | Step-level dropout after the endowed progress surface | compare dropout rates by step for users who saw the pre-filled indicator vs. those who did not |
| `paywall_viewed` | Endowed-progress completers reach the paywall at a higher rate than non-completers | segment by `credits_count` |

### Mobile Implementation + Reduced-Motion

**SwiftUI.** Custom `ProgressView` or `HStack` of step-segment capsules. Pre-credited segments
fill using `withAnimation(.easeOut(duration: DesignTokens.Motion.durationBase))` on `onAppear`.
Check `UIAccessibility.isReduceMotionEnabled` before animating; if true, render the pre-
credited fill instantly. Each step segment carries a label below it using the named credit key
resolved to a localized string.

**Flutter.** `AnimatedContainer` or `TweenAnimationBuilder` for fill segments. Wrap inside
`MediaQuery.of(context).disableAnimations` check; when true, use `duration: Duration.zero`.

**React Native (Reanimated / Moti).** `Moti's useAnimationState` to drive fill width from
0 → `pre_fill_pct` on mount. Guard with `useReducedMotion()`.

**Web (motion/react).** `motion.div` with `transition={{ duration: var(--motion-duration-base), ease: 'easeOut' }}`. Use `useReducedMotion()` from motion/react; when true, set `animate={{ width: pre_fill_pct + '%' }}` without a transition. Credit labels in a `<ul>` with `role="list"` and `aria-label="Your head-start steps"`.

Token references: `--motion-duration-fast` (120 ms) for step-by-step user-progress fill; `--motion-duration-base` (220 ms) for the initial pre-credit fill on mount; `--motion-duration-slow` (360 ms) for the completion pulse animation. Completion fill-and-pulse uses a spring (stiffness 200, damping 20) on mobile and `motion.div whileInView={{ scale: [1, 1.03, 1] }}` on web.

### Bright Line / Dark Line / Guardrail

**Bright line.** Pre-credit only real contributions the user has already made (setup actions,
answered questions, granted permissions, connected data sources) that the product actually uses
to personalize or configure the experience. The progress label and completion rate must be
truthful representations of work done and work remaining.

**Dark line.** Fabricating pre-credited steps that correspond to no real user action or product
operation, in order to manufacture completion anxiety and pressure the user to finish onboarding,
reach the paywall, or stay subscribed.

**Guardrail.** Before ship: open `TECH_SPEC.md` and verify that every pre-credited step has a
documented one-to-one mapping to a real product operation. Count the mapped steps. The ratio
of mapped-to-total credited steps must be 100% — unlike the Perceived Effort Delay Card's 50%
threshold, the Endowed Progress Card represents completed work (past tense), so every credit
must be real. Record the step-to-operation map in `TECH_SPEC.md` and attest compliance in
`PRODUCTION_READINESS.md` before any build is marked experience-card-ready. Run
`npm run check:emotional-design -- --root .` to verify the attestation block exists.

### Pairs With

- Commitment Card — the user's stated goal becomes the first pre-credited step ("Goal set:
  feel confident before your presentation"), anchoring the endowment in the user's own words
- Perceived Effort Delay Card — the effort display in plan generation can be the final step
  that completes the endowed progress bar
- Intent Mirroring Card — the "named head-start" summary can double as an intent mirror in a
  single screen, as long as the content sources only from user-provided fields
- Variable Reward Card — the completion animation when the progress bar fills can transition
  directly into the variable reward anticipation window

### 11-Star Level

**6-star (Better than expected).** Onboarding answers automatically count as completed steps;
the user arrives at the product's first real screen already mid-journey, not at a blank start.
Minimum correct implementation.

**7-star (Way beyond).** The system names what was already earned in the user's own language
("You set a goal to run 3x per week — that's step 1, done"), making the head-start feel
personally curated rather than automatically applied. The named variant produces the "made for
me" recognition that maps to 7-star in the eleven-star ladder.

---
