# Variable Reward Card

Part of the Experience Card deck. Read [`../experience-cards.md`](../experience-cards.md) first — it carries the card shape, the summary table, the Ethics Ladder/attestation contract, and the per-card routing. Apply cards via `EMOTIONAL_DESIGN.md` per `emotional-design-system.md`; HIGH-risk mechanics carry the full ethics contract in `ethics-guardrail.md`.

## Variable Reward Card

**One-liner.** Unpredictable positive outcomes delivered after an anticipation window produce
the highest engagement rate of any reinforcement schedule — because dopamine fires on the
wait, not the receipt.

**Emotional beat.** Anticipation-then-surprise: "I wonder what I'll get this time." The user
leans in during the wait. The reveal is secondary; the lean-in is the lever.

### Psychology + Canonical Research

B.F. Skinner's variable-ratio reinforcement schedule (_The Behavior of Organisms_, 1938) is
the mechanism: an action rewarded on an unpredictable interval produces a higher response rate
than any fixed schedule, and the behavior is the most resistant to extinction. Wolfram
Schultz's dopamine reward-prediction-error signal (_Science_, 1997) explains the neuroscience:
dopamine neurons fire maximally not when the reward is delivered but when an unexpected reward
is anticipated. When the reward is fully predicted, the dopamine signal moves earlier to the
cue — which means the app interaction (the tap, the completion) becomes the dopamine trigger,
not the reward itself.

Kent Berridge's wanting-vs-liking dissociation (_Neuroscience & Biobehavioral Reviews_, 1996)
adds the critical nuance: the dopamine-driven "wanting" system is anatomically and
functionally distinct from the opioid-driven "liking" system. A user can experience intense
wanting (compulsive check-back behavior) with modest liking (mild satisfaction at the result).
This dissociation is what makes variable reward the most potent — and most ethically
high-risk — card in the deck. Nir Eyal's Hook Model (_Hooked_, 2014) operationalizes all
three: Variable Reward is step 3 of the Trigger → Action → Variable Reward → Investment loop,
with three reward types — rewards of the tribe (social validation), rewards of the hunt
(information, content), and rewards of the self (mastery, progress).

| Source | Finding | Confidence |
|---|---|---|
| Skinner, _The Behavior of Organisms_ (1938) | Variable-ratio schedules produce highest response rates and greatest resistance to extinction. | solid |
| Schultz, _Science_ (1997) | Dopamine neurons fire on anticipation of uncertain reward, not its receipt; unexpected rewards produce largest spikes. | solid |
| Berridge et al., _Current Opinion in Pharmacology_ (2009) | Wanting (dopamine/incentive salience) and liking (opioid/hedonic pleasure) are dissociable; high wanting can coexist with low liking. | solid |
| Eyal, _Hooked_ (2014) | Variable Reward is step 3 of the Hook Model; three reward types map to user motivation: tribe, hunt, self. | solid |
| Fogg, _Tiny Habits_ (2019) | Variable reward increases effective motivation; card must be timed to naturally high-motivation, low-friction moments. | solid |
| Kahneman & Tversky, _Econometrica_ (1979) | The possibility of a positive surprise is weighted disproportionately to its probability — inflating perceived value of uncertain outcomes. | solid |
| Belgium/Netherlands gambling authority rulings on loot boxes, 2018–2019 | Paid money → uncertain outcome classified as gambling in multiple EU jurisdictions. | attribution-uncertain |

### Mechanism Steps

1. The user completes a meaningful action in the core loop.
2. The app introduces an anticipation window: 1.5–3 seconds of visible motion (pulsing,
   breathing, assembling) before the result is revealed. This is the dopamine trigger per
   Schultz 1997 — the wait is the emotional peak, not the result.
3. The result is revealed and it genuinely varies across a meaningful positive range. Not
   cosmetic variation (same outcome, different label color) but real variation: a different
   insight, a higher-quality match, a more detailed analysis, a surprising recommendation, a
   personal best, a new unlock.
4. The product reinforces the wanting loop by ending the reveal screen cleanly, without a
   spend prompt.
5. The investment phase begins: the user adds data, rates a result, continues a streak, or
   refines their profile — each investment makes the next variable reward more personally
   calibrated.

### Real App Examples

**Duolingo — lesson completion reveal.** Results screen shows animated XP count, streak flame
check, and occasionally a league position change or special achievement badge. The variation is
real: some sessions yield routine XP, others trigger a league promotion or rare badge. The
anticipation window (animated XP counter) fires the dopamine prediction-error signal before
the result is known. No spend prompt follows the reveal.

**Spotify Discover Weekly / Wrapped.** Discover Weekly's value proposition is variable reward:
every Monday the user opens a playlist they did not curate and discovers whether the algorithm
found something they love. The anticipation ("I wonder what my top artist will be") is the
product moment. Variation is real and personalized — two users get radically different
playlists. No spend is attached to the reveal.

**AI-generated personalized plans (Future, Freeletics).** After onboarding questions, the user
sees an animated "building your plan" sequence followed by a personalized training plan reveal.
Variation is real: different exercise mixes, volume prescriptions, and focus weeks. This shows
the Variable Reward Card layered with the Perceived Effort Delay Card. The variation must be
real — if every user gets the same template plan with name substitution, the mechanic collapses
into fake effort and the guardrail is violated.

### When to Use / When NOT to Use

**Use** at: the first result or insight reveal after onboarding effort; core-loop completions
where the outcome is legitimately variable (match quality, recommendation novelty, AI analysis
depth, plan personalization, streak milestone check); any surface where the user has invested
effort and does not know what quality of output they will receive.

**Do NOT use** on: transactional, predictable confirmations; any screen directly coupled to a
spend prompt or paywall — this combination is the highest-risk dark pattern in the
ethics-guardrail reference and a compliance veto; routine CRUD operations; surfaces targeting
children.

### Producer Recipe

1. Identify the core-loop action where the outcome is or could be genuinely variable.
   Document the variation space in `TECH_SPEC.md`: what is the range of possible outputs, what
   makes each output different, what percentage of consecutive completions will produce
   observably different content (target: ≥30%).
2. Design the anticipation window before building the reveal animation. 1.5–3 seconds — long
   enough for the dopamine cue to fire, short enough not to feel like a load error. Use a
   breathing or pulsing animation driven by `DesignTokens.Motion`. Implement prefers-reduced-
   motion fallback: collapse to a single static state with no animation.
3. Design the reveal animation with a celebrate-family spring (response 0.45–0.5,
   dampingFraction 0.5–0.7 — `premium-mobile-craft.md` §1). The reveal
   should feel like an arrival. Use scale + opacity entrance for the result card; for milestone
   unlocks, add a particle or confetti burst using native canvas or SwiftUI Canvas.
4. Add the escape hatch in Settings > Accessibility: a toggle that disables animated reward
   reveals and shows results immediately as plain text. Document the toggle in `TECH_SPEC.md`
   and in the Guardrail Contract attestation block (`user_control_escape_hatch`).
5. Emit PostHog events: `variable_reward_anticipation_started` (when the window opens, with
   `surface`, `reward_type`, `flow_id`) and `variable_reward_revealed` (when the result
   appears, with `surface`, `reward_type`, `reward_variant`, `anticipation_duration_ms`). Add
   both to `ANALYTICS.md` before implementation.
6. Write the Guardrail Contract attestation block in `ONBOARDING.md`, `SPEC.md`, or a
   dedicated `ETHICS.md`. Fill all HIGH-tier fields: `bright_line`, `dark_line`, `guardrail`,
   `user_control_escape_hatch`, `ethics_attestation`. Run `npm run check:emotional-design
   -- --root .`.
7. Verify variation is real on device: run the same core-loop action twice in succession.
   Confirm the backend returns observably different content at least 30% of the time, or
   document why personalization convergence makes consecutive variation unlikely. Record proof
   in `PRODUCTION_READINESS.md`.

### Auditor Signals

**Present**
- Anticipation window of 1.5–3 s precedes result reveal with visible animation
- Reveal animation uses spring easing (expressive timing), not a linear fade
- `variable_reward_anticipation_started` and `variable_reward_revealed` events appear in
  PostHog with required properties including `anticipation_duration_ms` and `reward_variant`
- Result content observably differs across sessions for the same user (documented in
  `PRODUCTION_READINESS.md`)
- Settings > Accessibility contains a toggle to disable animated reward reveals
- prefers-reduced-motion / OS reduce-motion fallback is implemented
- No spend prompt or paywall CTA appears on the same screen as the variable reward reveal
- Guardrail Contract attestation block exists with all HIGH-tier fields filled
- `reward_variant` property is populated with a meaningful category, not null

**Missing**
- No anticipation window — result appears instantly with no emotional beat
- `variable_reward_revealed` fires but `variable_reward_anticipation_started` is absent
- `reward_variant` is null, empty, or always the same value
- Settings > Accessibility has no escape hatch for animated reveals
- prefers-reduced-motion fallback is absent
- Guardrail Contract attestation block is missing or has empty required fields
- `anticipation_duration_ms` not recorded

**Misused**
- Spend prompt (paywall, IAP, upgrade) appears on the same screen as the reveal — highest-risk
  dark pattern, compliance veto
- Near-miss engineering: result artificially degraded to "almost good enough" to increase
  retry behavior
- Variation is cosmetic only: same backend result, different animation or label color
- Anticipation window artificially inflated beyond 3 s with no real computation
- Variable reward coupled to paid spend: loot-box mechanic, classified as gambling in EU
- The escape hatch toggle exists but disabling it still shows the animation

### Measurement Events

| Event | What it proves | Required properties |
|---|---|---|
| `variable_reward_anticipation_started` | Anticipation window triggered and measured | `surface`, `reward_type` (tribe/hunt/self), `flow_id` |
| `variable_reward_revealed` | Result delivered after anticipation | `surface`, `reward_type`, `reward_variant`, `anticipation_duration_ms` |
| `core_action_completed` | Upstream action that triggered the loop completed | join with `anticipation_started` to measure drop-off |
| `return_session_started` | User returned | segment by `reward_variant` tier in last session vs. D1 return rate |

### Mobile Implementation + Reduced-Motion

**SwiftUI.** Anticipation: `.scaleEffect(isAnticipating ? 1.05 : 1.0).animation(.easeInOut(duration: DesignTokens.Motion.durationBase).repeatForever(autoreverses: true), value: isAnticipating)`. Reveal: `.spring(response: 0.5, dampingFraction: 0.6)` (0.5 is the celebrate-family response reading — see the reconciliation note in `motion-craft-benchmarks.md`; `DesignTokens.Motion` ships durations, not spring responses, so the response stays numeric). Reduced-motion: check `UIAccessibility.isReduceMotionEnabled` before setting up the repeat animation; if true, skip directly to the reveal state with a 0-duration transition.

**Flutter.** `AnimationController` with `CurvedAnimation(curve: Curves.easeInOut)` for
anticipation; `AnimatedContainer` or `AnimatedScale` for reveal. Check
`MediaQuery.of(context).disableAnimations` for the reduced-motion gate.

**React Native (Reanimated 2).** `useSharedValue + withRepeat(withTiming(1.05, { duration: DesignTokens.Motion.durationBase }), -1, true)` for anticipation; `withSpring` for reveal. Check `AccessibilityInfo.isReduceMotionEnabled` async on mount; skip the `withRepeat` call when true.

**Web (motion/react).** `animate={{ scale: [1, 1.05, 1] }}` with `transition={{ repeat: Infinity, duration: motion.durationBase }}` for anticipation; `whileInView` + spring for reveal. Wrap in `useReducedMotion()` from motion/react — if true, use `animate={{ opacity: [0, 1] }}` with duration 0 as fallback. All durations reference promoted `--motion-*` CSS variables.

### Bright Line / Dark Line / Guardrail

**Bright line.** The variation is real and every possible result serves the user's stated goal.
The user could receive any result in the range and feel the app worked for them. The mechanic
keeps users curious about their own progress, not anxious about an outcome they paid for.

**Dark line.** Applying variable reward to paid spend (loot boxes); engineering near-miss
signals to increase retry behavior; coupling the dopamine anticipation window to a spend prompt
on the same screen; using cosmetic variation to manufacture engagement without genuine
personalization.

**Guardrail.** Before ship: (1) Run the core-loop action twice in succession on a test account;
if the backend returns identical content both times with no documented reason, the card is
non-compliant. (2) Confirm no paywall CTA or IAP prompt appears on the same screen or within
one navigation step of the reveal screen. (3) Confirm Settings > Accessibility contains a
functional toggle that disables animated reveals and falls back to static text. Test with OS
Reduce Motion enabled. (4) Run `npm run check:emotional-design -- --root .` and confirm zero
errors.

### Pairs With

- Perceived Effort Delay Card — show effort being done, then reveal a variable result
- Commitment Card — the commitment provides the personalization signal that makes variation
  real and personal
- Intent Mirroring Card — mirror intent before a high-stakes reveal to prime the wanting state

### 11-Star Level

**6-star (Better Than Expected).** The result lands with more emotional weight than a plain
data display — the user feels surprised and pleased, not just informed.

**7-star (Way Beyond).** The result feels personally discovered rather than algorithmically
generated — the user tells someone else what they found. Requires `reward_variant` to be
genuinely personalized to the user's commitment and history.

---
