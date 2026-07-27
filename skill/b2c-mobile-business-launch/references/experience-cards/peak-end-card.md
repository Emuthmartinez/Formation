# Peak-End Card

Part of the Experience Card deck. Read [`../experience-cards.md`](../experience-cards.md) first — it carries the card shape, the summary table, the Ethics Ladder/attestation contract, and the per-card routing. Apply cards via `EMOTIONAL_DESIGN.md` per `emotional-design-system.md`; HIGH-risk mechanics carry the full ethics contract in `ethics-guardrail.md`.

## Peak-End Card

**One-liner.** Engineer one unforgettable in-session peak and a strong close; the remembering
self makes every re-engagement decision based on those two moments, not the average.

**Emotional beat.** Elation-then-completeness — the user experiences one moment of genuine
surprise or delight, then the session closes with a micro-celebration that confirms they
accomplished something real.

### Psychology + Canonical Research

Kahneman and Fredrickson (1993, _Psychological Science_) established that the remembered
utility of an experience is determined almost entirely by its peak affect and its end affect —
not by duration, not by the average valence across the session. The implication for consumer
mobile is stark: a session that is mediocre for five minutes and excellent for thirty seconds
is remembered as a good session. A session that is good for five minutes but ends neutrally is
remembered as a mediocre session.

The remembering self — Kahneman's term for the narrative-constructing self that makes all
future decisions about whether to return, subscribe, or recommend — is not the same as the
experiencing self. Designing for the experiencing self (reducing average friction) is necessary
but insufficient; designing for the remembering self requires deliberately engineering where
the peak falls and how the session closes.

Don Norman's emotional design tiers are directly relevant: the visceral tier (the first
sensory impression of a peak moment) fires immediately; the behavioral tier (interaction
fluency of the closing state) sustains it; and the reflective tier (the meaning the user
assigns after the fact) is what the remembering self encodes into memory and word-of-mouth. A
peak that reaches the reflective tier — "You saved 12 minutes this week; that's time back with
your family" — creates the kind of emotional memory that drives retention and organic sharing.

| Source | Finding | Confidence |
|---|---|---|
| Kahneman & Fredrickson, _Psychological Science_ (1993) | Remembered utility of an experience is dominated by the peak affect and the end affect, not by duration or average valence. | solid |
| Kahneman, _Thinking, Fast and Slow_ (2011) | The experiencing self and the remembering self are dissociated; the remembering self makes all future behavioral decisions based on peak-end encoding. | solid |
| Norman, _Emotional Design_ (2004) | Three tiers of emotional design — visceral, behavioral, reflective — each contribute to peak moments. Reflective-level design creates lasting emotional memory. | solid |
| Fredrickson, _American Psychologist_ (2001); _Review of General Psychology_ (1998) — broaden-and-build | Positive emotions broaden thought-action repertoires. Applying this to peak design-moment value expansion is an extrapolation. | attribution-uncertain: closest basis Fredrickson 2001 |
| Csikszentmihalyi, flow states | Flow states produce the most intense positive peaks and are disproportionately represented in retrospective reports of best experiences. | attribution-uncertain |

### Mechanism Steps

1. Identify the single highest-value result moment in the core loop — the moment the user
   first sees their personalized output, progress milestone, or earned insight. This is the
   engineered peak candidate.
2. Personalize the peak to the user's actual result. Reference the user's own data, goal, or
   commitment (from the Commitment Card) in the peak reveal copy and visual. Generic confetti
   is visceral-tier only; personalized result copy with motion reaches the reflective tier.
3. Time the peak correctly: it must occur before or at the paywall / primary CTA, never after.
4. Engineer the session close as a second deliberate moment — not a neutral dismiss. A close-
   state micro-celebration, summary card, or progress stamp confirms the session was complete
   and worthwhile. The close should feel like a period at the end of a sentence, not a door
   slamming.
5. Control the emotional valley before the peak: reduce friction, cognitive load, and ambiguity
   in the steps immediately preceding the peak so that contrast amplifies the emotional
   response.
6. Emit the PostHog peak and close events immediately at each trigger.

### Real App Examples

**Duolingo.** Lesson completion screen: animated celebration with XP earned, streak count, and
league-progress bar — all personalized to the user's current standing. The peak (animated
result reveal) is reflective-tier because it references the user's streak and league rank —
their identity. The close reinforces the session narrative before returning to home.

**Strava.** Activity summary screen after a run or ride: personal-record badges, relative
effort score, segment comparisons, and a shareable visual card. The peak is personalized (PRs
and segment ranks are unique to each athlete) and reaches the reflective tier — the user sees
their performance in the context of their history. The shareable card extends the peak into a
word-of-mouth mechanic, converting the remembering-self experience into organic growth.

### When to Use / When NOT to Use

**Use** on any B2C mobile app where the core loop produces a result the user cares about —
fitness, language learning, financial insights, creative output, health coaching, productivity.
Apply during: first-value reveal in onboarding (the peak before the paywall), recurring session
completion (the close that drives return), and milestone or streak moments.

**Do NOT apply** to: transactional confirmation screens (payment received, item added to cart);
error or failure recovery states where an upbeat close would feel tone-deaf; mid-task modals
where a forced celebration interrupts the user's actual task. One engineered peak per session
and one deliberate close per session is the ceiling for most apps.

### Producer Recipe

1. **Map the core-loop result moment:** identify exactly which screen shows the user their
   personalized output for the first time in a session. This is the peak candidate. It must
   occur before or at the paywall. If no such screen exists, the product has a peak design
   gap — open the `peak-end-peak-missing` failure card.
2. **Personalize the peak copy:** the reveal text must reference the user's actual result,
   name, goal, or commitment value. Pull from the Commitment Card value if available. "You
   translated 47 words in 4 minutes — your fastest session yet." is reflective-tier. "Great
   job!" is visceral-tier only.
3. **Animate the peak at the reflective tier:** use a spring reveal (celebrate-family spring
   on mobile — response 0.45–0.5, dampingFraction 0.5–0.7; motion/react with the tokenized
   `motion.easingSpring` value on web) for the result number or badge. Follow with a brief
   (`motion.durationFast`, 120 ms) ambient
   glow or particle emission. Implement OS reduce-motion fallback: static result text with no
   animation, identical copy.
4. **Design the session close:** after the primary action (save, share, continue), the close
   screen or modal must include a single completion signal — a progress stamp, a streak
   confirmation, a summary card. Copy confirms the session was complete. Avoid filler
   ("Thanks for using [App]!") and avoid launching into the next CTA immediately.
5. **Validate contrast before the peak:** run Lens 3 (Emotional Journey) from the Six-Lens
   Design Review on the steps immediately preceding the peak. Reduce cognitive load and
   friction in the two steps before the peak.
6. **Emit PostHog events:** fire `peak_moment_reached` at the peak screen and
   `session_close_shown` at the close screen. Confirm both events appear in the PostHog
   activity view before build-ready status is claimed.
7. **Document in `PRODUCTION_READINESS.md`:** the peak screen name, the personalization field
   sourced (must be a user-provided value), the close screen copy, and the reduce-motion
   fallback state for each animation. Map both moments to the star-ladder level in
   `11_STAR_EXPERIENCE.md`.

### Auditor Signals

**Present**
- Core-loop result screen includes personalized copy referencing the user's actual result,
  goal, or data — not a generic congratulations string
- Peak moment is animated with a spring or expressive easing sourced from `DesignTokens.Motion`
- Session close screen contains a completion signal (streak count, progress stamp, summary
  card) rather than a neutral dismiss or immediate next-CTA
- PostHog events `peak_moment_reached` and `session_close_shown` are present in `ANALYTICS.md`
  and firing in the PostHog activity view
- The emotional peak in the Emotional Curve artifact (Lens 3) occurs at or before the paywall
  marker
- prefers-reduced-motion / OS reduce-motion fallback is documented in `TECH_SPEC.md` for both
  the peak animation and the close animation
- Peak copy references a field the user explicitly provided or a result the product computed
  from their data — traceable to a real source field in `PRODUCTION_READINESS.md`

**Missing**
- No peak moment is engineered — the result screen is a plain text confirmation with no
  personalization and no animation
- Session ends with a neutral dismiss ("Done") or an immediate re-engagement CTA with no
  completion signal
- Peak occurs after the paywall — the user buys before experiencing the moment that would
  justify the purchase
- PostHog events are absent or fire on the wrong trigger
- Emotional Curve artifact is missing or not rendered in `design.html`
- Close screen copy is identical across all users regardless of their result

**Misused**
- Confetti animation fires on every screen transition regardless of whether the user
  accomplished anything — scarcity is destroyed
- Peak copy uses manufactured urgency or framing not grounded in the user's actual result
  ("You almost lost your streak!") — crosses the bright line into anxiety exploitation
- Close screen launches a paywall immediately after the peak with no breathing room
- Peak animation has no reduce-motion fallback — vestibular distress risk for users with motion
  sensitivity — accessibility violation and failure-card trigger
- Peak timed to a generic milestone (every 5 app-opens) rather than an earned result

### Measurement Events

| Event | What it proves | Required properties |
|---|---|---|
| `peak_moment_reached` | User experienced the engineered peak in this session | `surface`, `personalization_field`, `result_value` (hashed), `session_id`, `time_since_session_start_ms`, `star_level` |
| `session_close_shown` | Deliberate session-close moment surfaced to the user | `surface`, `close_type` (streak_stamp/summary_card/progress_milestone/generic), `completion_signal_present: bool`, `session_duration_ms` |
| `session_close_shared` | Close state generated a share action | `surface`, `share_destination`, `result_value` |
| `peak_end_return_session` | User opened the app again within 24 hours of a session that fired `peak_moment_reached` | computed as a derived PostHog insight — measures the remembering-self re-engagement effect |

### Mobile Implementation + Reduced-Motion

**SwiftUI.** Wrap the peak result view in `.transition(.scale(scale: 0.85).combined(with: .opacity))` with a celebrate-family spring (response ~0.45, dampingFraction ~0.7). For ambient glow, use a `.shadow` modifier animated with `withAnimation(.spring(response: 0.45, dampingFraction: 0.7))`. Detect reduce-motion with `@Environment(\.accessibilityReduceMotion)` and skip the spring/glow entirely if true — render result text statically. The close-state streak stamp uses `.transition(.opacity)` with `DesignTokens.Motion.durationFast` (120 ms linear).

**Flutter.** `AnimatedContainer` with `Curves.elasticOut` for the peak reveal; `FadeTransition` for the close stamp. Check `MediaQuery.of(context).disableAnimations`.

**React Native.** `withSpring(value, { damping: 14, stiffness: 180 })` for the peak; fade `withTiming` for the close. Gate on `useReducedMotion()` from the react-native-reanimated API.

**Web (motion/react).** `motion.div` with `initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}` driven by the `--motion-easing-spring` token. Close stamp uses a simple `opacity` transition with `--motion-duration-fast`. Wrap with `useReducedMotion()` from motion/react; when true, set `transition={{ duration: 0 }}`. Record both native and web fallback states in `TECH_SPEC.md`.

### Bright Line / Dark Line / Guardrail

**Bright line.** The peak moment celebrates the user's actual earned result — a computation,
milestone, or insight grounded in their real actions and data — and the session close confirms
their genuine accomplishment. Every personalization field referenced in peak or close copy must
trace to a field the user explicitly provided or a result the product computed from their real
activity.

**Dark line.** Manufacturing an emotional peak from fabricated or inflated results ("You're in
the top 5% of users!" on day one with no real comparison basis); using the peak as a warm-up
for an immediate hard-sell paywall on the same screen; triggering the peak animation on every
tap regardless of earned result; using the close state to inject anxiety ("Don't lose your
progress — subscribe now") rather than completing the session with satisfaction.

**Guardrail.** Before any peak-end implementation ships: (1) Confirm the peak copy references
only fields the user explicitly provided or results computed from their real session data — no
manufactured rankings, no fabricated statistics. Document the personalization field source in
`PRODUCTION_READINESS.md`. (2) Confirm the peak screen and the paywall/primary CTA are not on
the same screen view — there must be at least one navigation step or a deliberate breathing
pause between them. (3) Confirm the peak animation has a documented reduce-motion fallback in
`TECH_SPEC.md`. (4) Run `npm run check:emotional-design -- --root .` and
verify no peak-end dark-pattern flag is raised.

### Pairs With

- Commitment Card — peak copy that references the user's stated goal is only possible if the
  Commitment Card captured and stored that value
- Perceived Effort Delay Card — labor illusion that precedes the result reveal amplifies the
  peak by making the outcome feel earned
- Variable Reward Card — the anticipation window is the setup; the Peak-End Card governs the
  reveal and the close
- Intent Mirroring Card — a session close that mirrors back the user's stated intent operates
  at the reflective tier and is a peak-end close combined with an intent mirror

### 11-Star Level

**6-star (Better than expected).** Every session closes with a deliberate completion signal
rather than a neutral dismiss — the user reliably ends sessions feeling the product acknowledged
their effort.

**7-star (Way beyond).** The peak moment is personalized to the user's specific result, goal
language, and current milestone — it feels made for them. The peak at 7-star reaches Norman's
reflective tier: it makes the user think about their identity and progress, not just react to
a visual stimulus. The `11_STAR_EXPERIENCE.md` star-ladder entry for 6 and 7 must map to the
specific peak screen and close-state screen names in the product, not to a generic description.

---
