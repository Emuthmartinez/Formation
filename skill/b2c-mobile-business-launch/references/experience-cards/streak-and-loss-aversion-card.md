# Streak and Loss Aversion Card

Part of the Experience Card deck. Read [`../experience-cards.md`](../experience-cards.md) first — it carries the card shape, the summary table, the Ethics Ladder/attestation contract, and the per-card routing. Apply cards via `EMOTIONAL_DESIGN.md` per `emotional-design-system.md`; HIGH-risk mechanics carry the full ethics contract in `ethics-guardrail.md`.

## Streak and Loss Aversion Card

**One-liner.** Turn an earned run of days into a possession the user refuses to surrender —
driving daily return visits through the asymmetric pain of losing something already owned.

**Emotional beat.** Protective urgency — the user feels "I can't let this die; I've put too
much in." The streak is no longer an app metric; it is a personal object.

### Psychology + Canonical Research

Kahneman and Tversky's prospect theory (_Econometrica_, 1979) established that losses loom
approximately twice as large as equivalent gains in psychological weight — a three-day streak
lost hurts roughly twice as much as a three-day streak gained feels good. Thaler's endowment
effect (_Journal of Economic Behavior and Organization_, 1980) compounds this: people overvalue things they
already possess simply because they possess them. A streak at day 12 is not valued at twelve
repetitions of day-1 value; it is valued at whatever the user imagines would be lost by
breaking it — momentum, identity, social status, progress toward a goal.

The goal-gradient effect (Hull, 1932; confirmed for loyalty programs by Kivetz, Urminsky & Zheng,
_JMR_, 2006) adds a second lever: as the user approaches a milestone within the streak (day 7,
day 30, day 100), effort and visit frequency accelerate. The streak thus creates two
simultaneous motivational forces — loss aversion pulling the user back daily to protect the
accumulated asset, and goal-gradient urgency pulling them forward toward the next milestone.
The ethical boundary is sharp: when streak mechanics are decoupled from the user's actual goal
and serve only app-engagement metrics, the user is being exploited. Streak forgiveness
mechanics — shields, grace periods, streak freeze — are the required bright-line protection
that converts a potentially punitive pattern into a generous one.

| Source | Finding | Confidence |
|---|---|---|
| Kahneman & Tversky, _Econometrica_ (1979) | Losses loom approximately twice as large as equivalent gains. The pain of losing something outweighs the pleasure of gaining it by roughly 2:1. | solid |
| Thaler, _Journal of Economic Behavior and Organization_ (1980) | Endowment effect: people overvalue objects they already possess; ownership itself inflates perceived value. | solid |
| Hull (1932); Kivetz, Urminsky & Zheng, _JMR_ (2006) | Goal-gradient effect: effort and return frequency increase as a goal approaches. | solid |
| Empirical streak literature (Duolingo, Snapchat) | Industry-reported retention uplift from streak mechanics widely cited; peer-reviewed replication studies specific to mobile app streaks sparse as of 2025. | attribution-uncertain |
| Fogg, _Tiny Habits_ (2019) | A streak notification fires at high motivation (loss aversion) and high ability (habitual action) — placing the day's return in the highest-probability zone of B=MAP. | solid |
| Eyal, _Hooked_ (2014) | Each day added to a streak is stored value that increases the probability of a return trigger. The streak is the investment that loads the next trigger. | solid |

### Mechanism Steps

1. **Earn.** User completes the day's core action. The streak counter increments with a
   satisfying micro-animation.
2. **Possession signal.** The streak is made visually prominent on the home screen or
   dashboard — not buried in stats. The user must see the number without hunting for it. Visual
   weight is proportional to streak length: a 30-day streak looks materially different from a
   3-day streak.
3. **Anticipation window.** As the day's completion window approaches (typically evening), the
   app delivers a contextual reminder that names the streak length and the specific goal the
   streak is serving: "Day 14 of your Spanish goal — 10 minutes keeps it alive."
4. **Loss-aversion prime.** If the user has not yet completed the day's action by a threshold
   time, the streak display shifts to an endangered state — a visual cue (fading color,
   countdown, "At risk" label) that activates the endowment effect. The user is now protecting
   a possession, not pursuing a reward.
5. **Completion relief.** When the user completes the action, the streak counter animates back
   to full health. The relief of preservation is the emotional peak — not the achievement of
   a new number, but the relief of not losing the old one.
6. **Milestone amplification.** At key milestones (7, 14, 30, 60, 100 days), the app delivers
   an amplified celebration anchored to the user's stated goal: "You've practiced Spanish every
   day for 30 days — your stated goal was to speak before your trip in August."
7. **Streak forgiveness (required).** The app offers at least one grace-period mechanism — a
   streak shield, freeze, or recovery path — that the user can access without paying. Paid
   shield upgrades may exist, but the first protection must be earned or freely given.

### Real App Examples

**Duolingo.** The streak counter on the home screen is the most prominent metric. The "Streak
Society" and streak freeze features make forgiveness accessible. When a streak is at risk, the
owl mascot changes expression and a countdown appears. The streak notification names the streak
length and the language goal. Forgiveness mechanics (streak freeze, streak repair) are visible
and accessible, keeping the pattern on the bright side of the loss-aversion line.

**Snapchat.** Streak counters appear directly on friend tiles, making the streak a social
possession shared between two people. The fire emoji and number degrade toward expiry with a
countdown. Social streaks amplify the endowment effect by adding a second owner — breaking the
streak is letting down another person, activating social norm pressure on top of loss aversion.
The dark-line risk is high: Snapchat streaks are often criticized for creating anxiety detached
from the user's real social goal.

**Headspace / Calm.** Meditation streak on the home screen, with a calm visual indicator (flame
softens to a glow, not an alarm) when the streak approaches risk. Forgiveness is built in via
the "Rest Day" feature. The streak is framed around the user's wellness goal, not engagement.
Wellness apps face the highest ethical risk with streak mechanics — manufacturing anxiety in a
product sold to reduce it.

**Wordle / NYT Games.** The streak counter is a simple number, no animation pressure, no
notifications. Despite minimal UX investment, the streak drives daily return because the game
is one-a-day by design. Demonstrates that loss aversion operates even without aggressive UX.

### When to Use / When NOT to Use

**Use** when the app's core value is delivered through repeated daily or near-daily actions —
language learning, fitness, journaling, meditation, skill practice, habit tracking, nutrition
logging, or any product where a consistent return visit produces compounding real-world value.
The streak must be tied to the user's stated goal captured in the Commitment Card, not to
arbitrary app-engagement metrics.

**Do NOT use** when: (1) the core value is episodic or asynchronous and daily return is not
meaningful; (2) the product cannot deliver genuine daily value — a streak without value
delivery is pure extraction; (3) the user's emotional job is relaxation or stress relief and a
daily urgency prompt would contradict the product's therapeutic promise; (4) the user base
skews toward vulnerability populations (minors, people with anxiety disorders, compulsive
behavior histories); (5) the team cannot implement streak forgiveness mechanics in V1 — the
card must ship with forgiveness or not at all.

### Producer Recipe

1. **Anchor to the Commitment Card:** confirm the Commitment Card has fired and a named goal
   is stored. The streak must visually reference the goal ("Day 14 of your daily Spanish
   practice"). Without the commitment anchor, the streak is gamification noise.
2. **Define the daily action precisely:** one completable action per day, achievable in under
   10 minutes at minimum so ability is never the blocker. Confirm this maps to a real event in
   `ANALYTICS.md`.
3. **Build the streak state machine:** four states required — (a) healthy: completed today;
   (b) at-risk: not yet completed, within active window; (c) endangered: within 2 hours of
   expiry; (d) broken: window closed without completion. Each state must have a distinct visual
   representation using `DesignTokens.Motion`.
4. **Make the streak a visible possession:** place the streak counter at the primary visual
   anchor of the home/dashboard screen. Use a dedicated visual treatment (flame, ring, badge)
   that scales or changes character as the streak grows. A 100-day streak should look
   materially different from a 3-day streak. Use `DesignTokens.Motion` spring animation on the
   number increment.
5. **Design the at-risk notification:** a single contextual push notification naming the streak
   length and the user's goal. Template: "Day [N] of [goal] — [action] keeps your streak
   alive." No guilt language, no countdown panic. One notification per day maximum. Emit
   `streak_at_risk_notification_sent` with `streak_length`, `goal_id`, `notification_time`.
6. **Implement streak forgiveness (non-negotiable):** minimum viable forgiveness is a 24-hour
   grace period after a missed day, visible to the user as "Streak at risk — complete today to
   recover." At least one freely earned streak shield must be available before any paid shield
   is offered. The forgiveness mechanic must be discoverable without a support ticket. Emit
   `streak_forgiveness_applied` with `forgiveness_type` and `streak_length_preserved`.
7. **Build milestone celebrations:** at 7, 14, 30, 60, 100 days, trigger an amplified
   celebration moment with goal-progress reflection. Milestone copy must reference the user's
   committed goal, not the streak number alone. Emit `streak_milestone_reached` with
   `milestone_day`, `goal_id`, `share_initiated`.
8. **Emit all required PostHog events:** `streak_started`, `streak_incremented`,
   `streak_at_risk_shown`, `streak_at_risk_notification_sent`, `streak_broken`,
   `streak_forgiveness_applied`, `streak_milestone_reached`. Wire before build handoff. Record
   event names in `ANALYTICS.md` before implementation.
9. **Record bright-line compliance:** in `PRODUCTION_READINESS.md`, document (a) the goal
   field anchoring the streak, (b) the forgiveness mechanic available without payment, (c) the
   copy review confirming no guilt or manufactured anxiety language, (d) the Commitment Card
   cross-reference. The streak card is not build-ready until all four are recorded.

### Auditor Signals

**Present**
- Streak counter is visible on the primary home or dashboard screen without navigation
- Streak display references the user's stated goal or commitment, not only a number
- At least one freely accessible forgiveness mechanic exists (grace period, earned shield,
  rest day)
- Streak at-risk state has a distinct visual treatment from the healthy state
- Push notification copy names both the streak length and the user's goal
- Streak milestones trigger a celebration moment with goal-progress context
- `streak_incremented` and `streak_broken` PostHog events are present in the analytics
  activity view
- `streak_forgiveness_applied` event fires when forgiveness is used
- Reduced-motion fallback exists for streak animation states

**Missing**
- Streak counter is buried in a stats or profile screen
- Streak is tied to "days active in app" rather than a specific user-defined goal action
- No forgiveness mechanic exists — one missed day resets to zero with no recovery path
- Milestone celebrations absent or identical to regular daily completions
- Streak at-risk notification fires multiple times per day or uses guilt/countdown panic
  language
- PostHog events for `streak_incremented`, `streak_broken`, and `streak_forgiveness_applied`
  absent from `ANALYTICS.md`
- Streak length does not visually scale — a 100-day streak looks identical to a 3-day streak

**Misused**
- Streak shield is sold but not earned — no freely accessible forgiveness path exists
- Streak counter increments on any app open rather than core action completion
- At-risk notification fires before the user's active window has closed
- Streak milestone copy references only the streak number without connecting to the user's
  stated goal
- Streak repair purchase surfaced immediately after a break with no grace period — pure
  loss-aversion extraction
- Streak mechanics in a wellness/meditation app use high-urgency visual language (red
  countdown, alarm framing) that contradicts the product's anxiety-reduction promise
- Streak is visually designed to look like a social proof metric when no social element exists

### Measurement Events

| Event | What it proves | Required properties |
|---|---|---|
| `streak_started` | User initiated their first streak | baseline for cohort retention analysis |
| `streak_incremented` | Core action completed for the day and streak state advanced — primary daily retention signal | `streak_length`, `goal_id`, `action_type` |
| `streak_at_risk_shown` | At-risk UI state was surfaced in-app | `streak_length`, `hours_until_expiry` |
| `streak_at_risk_notification_sent` | Loss-aversion push notification was delivered | pairs with `streak_incremented` next-day to measure notification-driven recovery rate |
| `streak_broken` | User missed a day and streak reset | segment by `streak_length_at_break` to find the loss-value threshold |
| `streak_forgiveness_applied` | Forgiveness mechanic was used | `forgiveness_type`, `streak_length_preserved` — measures bright-line compliance |
| `streak_milestone_reached` | User hit a milestone day | `milestone_day`, `goal_id`, `share_initiated` |
| `streak_repair_offered` | Paid or earned streak repair was surfaced after a break | needed to detect if repair is offered before grace period expires = dark pattern |
| `streak_repair_accepted` | User accepted a repair offer | `repair_type`, `streak_length_at_break`, `days_since_break` |

### Mobile Implementation + Reduced-Motion

Streak state is a four-value enum (`healthy`, `atRisk`, `endangered`, `broken`) stored in app
state and persisted to the backend. Each state maps to a distinct visual token from
`DesignTokens.Motion`.

**Healthy.** Streak counter pulse spring on increment: duration `DesignTokens.Motion.durationFast`
(120 ms), spring response 0.4, damping 0.7.

**At-risk.** Flame or badge icon transitions to muted color via cross-fade (duration
`DesignTokens.Motion.durationBase`, 220 ms); no animation loop — urgency is conveyed through color
and copy, not motion.

**Endangered.** Streak container softly breathes (opacity oscillates 1.0 to 0.7, loop,
duration `DesignTokens.Motion.durationBase`, easing: `easeInOut`) — one pulse every 2 seconds
maximum.

**Broken.** Counter resets with a deflate spring (scale 1.0 to 0.85 to 1.0, duration
`DesignTokens.Motion.durationFast`).

**Milestone celebration.** Spring scale-up on the milestone badge (scale 0.8 to 1.15 to 1.0,
choreography ~500 ms, bounded by `DesignTokens.Motion.durationReveal` at 600 ms) followed by
a particle or confetti burst using the app's primary palette tokens.

**Web (motion/react).** Use tokenized `--motion-duration-fast`, `--motion-duration-base`,
`--motion-duration-reveal` CSS variables. Drive the counter increment with a spring animation.
At-risk breathing uses `animate` with `repeat: Infinity, repeatType: 'mirror'`.

**Reduced-motion fallback (REQUIRED).** Wrap every animated streak state change in a
`UIAccessibility.isReduceMotionEnabled` check (SwiftUI), `MediaQuery.of(context).disableAnimations` (Flutter), `AccessibilityInfo.isReduceMotionEnabled` (React Native), or `prefers-reduced-motion` media query / `useReducedMotion()` hook (web). Fallback: static
color-only state transition with no animation. The streak counter increments instantly.
Document fallback behavior for each of the four states in `TECH_SPEC.md`.

### Bright Line / Dark Line / Guardrail

**Bright line.** The streak is anchored to the user's stated goal (captured by the Commitment
Card) and measures completion of a core action that delivers real value toward that goal.
Forgiveness mechanics are freely accessible — at minimum a grace period, without requiring
payment. Notification copy names the goal, not just the streak length. The streak serves the
user's retention of their habit, not the app's engagement metrics.

**Dark line.** The streak is anchored to any app open or passive action rather than the user's
goal-relevant core behavior. Forgiveness is exclusively paid. A repair purchase is surfaced
immediately after a break with no grace period. Notification copy uses guilt, countdown panic,
or manufactured shame ("You're failing your goal — don't break now"). In a wellness app, streak
mechanics produce the anxiety the product is sold to reduce.

**Guardrail.** Before the streak card ships, `PRODUCTION_READINESS.md` must contain all four
of: (1) the exact goal or commitment field (from the Commitment Card) that the streak action
is anchored to; (2) documentation of at least one freely accessible forgiveness mechanic
(grace period or earned shield) that does not require payment; (3) copy review attestation
confirming no guilt, countdown panic, or shame language appears in at-risk notifications or
broken-streak screens, verified against `BRAND.md §Voice`; (4) confirmation that the
`streak_incremented` event fires on core action completion, not on app open. If any of the
four entries is absent, the streak card is non-compliant and must not ship. Run:
`npm run check:emotional-design -- --root .`

### Pairs With

- Commitment Card — the streak must be anchored to a commitment captured there; without a
  named goal the streak is gamification noise
- Variable Reward Card — milestone celebrations can incorporate a variable reward reveal to
  amplify the milestone emotional peak
- Intent Mirroring Card — after a milestone is reached, a mirror moment ("You said you wanted
  to feel confident in Spanish — 30 days in, you're on track") converts a number celebration
  into a meaningful moment
- Perceived Effort Delay Card — a streak recovery or repair flow can show the user's
  accumulated effort before the repair mechanic is offered, reinforcing the endowment effect

### 11-Star Level

**5-star (Expected).** A visible streak counter that increments on daily core action completion
and resets on a missed day. Table stakes in any habit or learning app; users expect it.

**6-star (Better than expected).** Streak-repair and forgiveness options that feel generous
rather than monetization pressure — a visible grace period, an earned shield the user can bank,
a "rest day" that counts as maintenance. The generosity signals that the product is on the
user's side.

**7-star (Way beyond).** The streak is explicitly tied to the user's verbatim stated goal,
milestone celebrations reflect goal-progress context ("30 days in — your trip to Spain is in
60 days, and you've now completed 200 lessons"), and the streak dashboard shows a projection
of where their current pace takes them relative to their stated outcome. The user does not see
a streak; they see evidence that they are becoming who they said they wanted to become.

---
