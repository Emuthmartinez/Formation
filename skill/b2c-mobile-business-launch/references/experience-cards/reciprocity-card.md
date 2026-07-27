# Reciprocity Card

Part of the Experience Card deck. Read [`../experience-cards.md`](../experience-cards.md) first — it carries the card shape, the summary table, the Ethics Ladder/attestation contract, and the per-card routing. Apply cards via `EMOTIONAL_DESIGN.md` per `emotional-design-system.md`; HIGH-risk mechanics carry the full ethics contract in `ethics-guardrail.md`.

## Reciprocity Card

**One-liner.** Deliver unexpected value before asking for anything in return — a free
capability, a personalised insight, a gift — so the user feels genuinely obligated to give
back: an upgrade, a permission grant, a share.

**Emotional beat.** Surprised gratitude — "They gave me something I didn't ask for; I feel
like I owe them a chance."

### Psychology + Canonical Research

Reciprocity is the first and most universal principle of social influence: when someone does
something for us, we feel a deep psychological obligation to return the favour. The obligation
is strongest when the gift is uninvited, personalised, and meaningful — not a transactional
sample (Robert Cialdini, _Influence_, 1984). Uninvited gifts create stronger obligation than
requested ones because they cannot be reframed as a quid-pro-quo exchange; the receiver has
no script for refusing a gift they did not seek, and social norms around reciprocity are
cross-cultural and deeply pre-cognitive.

Nir Eyal's Hook Model (_Hooked_, 2014): the Investment phase creates reciprocity in reverse —
the user invests time and data, the app owes them a useful result. The Reciprocity Card runs
this logic forward: the app invests first, so the user feels the obligation to invest (upgrade,
share, grant permissions) next. BJ Fogg's Behavior Model (B=MAP, _Tiny Habits_, 2019):
motivation spikes briefly around unexpected positive events — the moment after receiving an
unexpected gift is a peak-motivation window for prompting an action that would otherwise
require significant persuasion. The prompt must fire inside this window, not minutes later.
If the gift is personalised to the user's stated goal (captured via the Commitment Card or
Intent Mirroring Card), the obligation intensifies further, because the user recognises the
product understood them, which turns the gift from a marketing tactic into a relational signal.

| Source | Finding | Confidence |
|---|---|---|
| Cialdini, _Influence_ (1984) | Reciprocity is the first and most universal principle of social influence; uninvited gifts create stronger obligation than requested ones. | solid |
| Eyal, _Hooked_ (2014) | The Hook Model's Investment phase creates reciprocity obligations — the app investing in the user first accelerates the user's willingness to invest back. | solid |
| Fogg, _Tiny Habits_ (2019); B=MAP | Motivation spikes briefly around unexpected positive events; the window immediately after a gift reveal is the highest-leverage moment for a prompt-to-action. | solid |
| Berridge, _Neuroscience & Biobehavioral Reviews_ (1996) | Wanting (dopamine) and liking (hedonic) are dissociable systems. Applying this to distinguish a genuine gift (wanting + liking) from a manipulative freebie (wanting alone) is a design-domain extrapolation, not a direct finding. | attribution-uncertain: Berridge 1996 framework applied to gift-vs-manipulation context |
| Buell & Norton, _Management Science_ (2011) | Users value outcomes more when they can observe effort being made on their behalf; a reciprocity gift that visibly represents work done for this specific user produces stronger obligation. | solid |
| Dai, Milkman & Riis, _Management Science_ (2014) — fresh-start effect | Delivering a reciprocity gift at a natural restart moment amplifies the obligatory response because the user is already primed for new commitments. | solid |

### Mechanism Steps

1. Identify the highest-value capability or insight the app can genuinely deliver before any
   payment or permission request — it must be complete and useful on its own, not a teaser.
2. Tie the gift to the user's stated goal or recent input (from the Commitment Card or Intent
   Mirroring Card): a generic freebie creates transactional obligation; a personalised gift
   creates relational obligation.
3. Deliver the gift without warning or announcement — no "here is your free trial" banner.
   The surprise is load-bearing; announced gifts are perceived as marketing, not generosity.
4. Let the value land: give the user 2–4 seconds to experience or read the gift before any
   CTA appears. The emotional peak must register before the ask.
5. Make the request immediately after the gift lands — inside the BJ Fogg motivation spike
   window. The request must be proportional: do not ask for payment inside the gift reveal;
   ask for a permission grant, a share, or a soft upgrade prompt.
6. Name the gift explicitly when making the ask: "We just gave you your full first plan —
   want to keep this momentum going?" The explicit reference closes the reciprocity loop.
7. Emit the named PostHog events and verify the gift was personalised (not generic) before
   recording the card as compliant.

### Real App Examples

**Duolingo.** The app completes a full lesson and awards the user an XP streak badge on the
first session — before any paywall mention — then surfaces the Plus upgrade prompt on the
celebration screen. The user already has something to protect. The completed lesson is a
genuine, self-contained gift; the streak badge personalises the obligation; the upgrade ask
follows immediately on the emotional peak, inside the BJ Fogg motivation window.

**Calm.** On first open, Calm plays a full, uninterrupted 10-minute Sleep Story — no account
required, no paywall — then asks for notification permission on the gratitude screen after the
story ends. The story is complete and premium-quality, not a teaser. The notification
permission ask is proportional and arrives at the emotional low-arousal moment after
relaxation, when compliance is highest (Fogg B=MAP).

**Spotify.** Discover Weekly delivers a personalised 30-track playlist every Monday before the
subscription ask — free-tier users receive a genuine, curated gift that feels bespoke, then
encounter the premium upgrade prompt when they try to skip a track or go offline. The playlist
is personalised to listening history (relational, not transactional), delivered without
announcement (surprise intact), and the upgrade ask is proportional and contextual.

**MyFitnessPal.** After completing food logging for one day, the app reveals a full macro and
micronutrient breakdown — a genuinely useful analysis — before any premium gate. The premium
ask surfaces only when the user tries to view the weekly trend. The day-one breakdown is
complete and personalised to what the user actually ate. The reciprocity obligation from the
free daily value makes the upgrade feel like a natural continuation.

### When to Use / When NOT to Use

**Use** at: (1) end of first session, before any paywall mention; (2) immediately after the
user's first personalised plan or result is revealed (pairs with Perceived Effort Delay Card);
(3) at the point where a permission is about to be requested — deliver value first, then ask;
(4) at re-engagement after a multi-day absence — deliver an insight the user missed while away,
then prompt return to the core loop.

**Do NOT use** when: the "gift" is actually a watered-down teaser that withholds the promised
value behind a paywall; the ask immediately follows the gift on the same screen with no
breathing room; the gift is generic and not tied to the user's stated goal; the user is in a
distressed state (failed payment, subscription lapse, error screen).

### Producer Recipe

1. **Identify the single highest-value capability** your app can deliver fully and completely
   without a subscription. If nothing qualifies, redesign the free tier before adding the
   reciprocity trigger; a teaser does not activate the norm.
2. **Personalise the gift** to the user's stated goal or recent input. Query the commitment
   value or onboarding answer captured by the Commitment Card. Render the gift copy with the
   user's own words.
3. **Deliver the gift without announcement or framing as a free trial.** No banner reading
   "Try premium free." The gift must appear as a natural product action. The surprise is
   load-bearing.
4. **Insert a 2–4 second no-CTA hold** after the gift is fully visible. Implement as an async
   delay on the CTA element mount, not as a blocking overlay.
5. **Surface a proportional, low-cost ask** immediately after the hold expires — inside the
   BJ Fogg motivation spike window. Proportional means: permission grant, soft upgrade prompt,
   or share action — not a hard paywall.
6. **Name the gift explicitly** in the ask copy: "We just built your complete plan — want to
   keep building on it?"
7. **Emit `reciprocity_gift_delivered`** immediately when the gift is shown. Emit
   `reciprocity_ask_shown` when the CTA appears. Emit `reciprocity_ask_accepted` or
   `reciprocity_ask_dismissed` on user action. Verify all three events appear in PostHog
   activity before calling the card implemented.
8. **Add the card attestation block** to `ONBOARDING.md` or `11_STAR_EXPERIENCE.md` with
   `bright_line`, `dark_line`, and `guardrail` fields filled. Run
   `npm run check:emotional-design -- --root .` and confirm zero errors.
9. **Document the gift in `PRODUCTION_READINESS.md`** with the completeness proof: confirm
   the gift is a self-contained, usable output — not a truncated sample. Record that no paywall
   appears on the same screen as the gift.

### Auditor Signals

**Present**
- A distinct, personalised, complete capability or insight is delivered before the first
  paywall or permission request in the onboarding flow
- The gift is tied to the user's stated goal or input — references their own words, goal, or
  data
- The gift appears without announcement as a marketing move — no "free trial" banner on the
  gift screen
- A visible CTA-free hold of 2–4 seconds exists between gift reveal and the ask CTA mounting
- The ask is proportional — a permission grant, soft upgrade, or share prompt — not a hard
  paywall on the same screen
- PostHog events `reciprocity_gift_delivered`, `reciprocity_ask_shown`, and
  `reciprocity_ask_accepted` / `reciprocity_ask_dismissed` are all present in `ANALYTICS.md`
  and firing in production
- `reciprocity_gift_is_complete: true` is set in the event properties

**Missing**
- The free capability is a watered-down teaser that withholds core value
- The gift is generic (not personalised to the user's stated goal or data)
- No breathing room between gift reveal and ask — the CTA appears simultaneously with the
  gift
- The ask is disproportionate — a full hard paywall immediately follows the gift on the same
  screen
- PostHog events are absent or only partially implemented
- No `ANALYTICS.md` entry for `reciprocity_gift_delivered` before implementation

**Misused**
- The "gift" is framed as a free trial with a countdown timer — converts the reciprocity norm
  into a scarcity dark pattern
- The reciprocity ask fires on a distressed screen (failed payment, subscription lapse, error
  state)
- The gift is announced as "FREE gift inside!" during onboarding — announcement destroys the
  surprise (Cialdini)
- The card fires more than once in a session — repeated "unexpected gifts" in a single session
  are perceived as manipulation
- The gift is used on the cancel or unsubscribe flow as a retention dark pattern

### Measurement Events

| Event | What it proves | Required properties |
|---|---|---|
| `reciprocity_gift_delivered` | The gift was shown | `surface`, `gift_type`, `gift_is_personalised: bool`, `gift_is_complete: bool`, `user_goal_referenced: bool`, `flow_id`, `step_id`, `variant_id`, `reduce_motion_active: bool` |
| `reciprocity_gift_engaged` | User interacted with the gift before the ask appeared | `gift_type`, `time_to_engage_ms`, `engagement_action` |
| `reciprocity_ask_shown` | The proportional ask was surfaced after the hold period | `ask_type`, `time_since_gift_ms`, `gift_type`, `surface`, `variant_id` |
| `reciprocity_ask_accepted` | User accepted the ask — primary conversion signal | `ask_type`, `time_to_accept_ms`, `gift_type`, `gift_is_personalised` |
| `reciprocity_ask_dismissed` | User dismissed the ask — counter-metric | `ask_type`, `time_to_dismiss_ms`, `gift_type`, `dismiss_reason` |
| `emotion_card_fired` | System-level card activation | `card_id: reciprocity` |
| `emotion_card_abandoned` | User exited during or immediately after the card | `rage_tap_detected: bool` |

### Mobile Implementation + Reduced-Motion

**Native mobile (SwiftUI / Flutter / React Native Reanimated).** The gift reveal uses a spring
entrance animation driven by the celebrate-family spring (response 0.45–0.5, dampingFraction
0.5–0.7 — same family as the Variable Reward Card reveal). The CTA hold is implemented as an async `Task.sleep` in SwiftUI
or `Future.delayed` in Flutter — a fixed 2–4 second delay before the CTA view mounts. The CTA
fades in with `DesignTokens.Motion.durationFast` (120 ms). The full gift card enters with a vertical
spring (offset Y from +40 to 0, spring stiffness 300, damping 28 in SwiftUI `withSpring`).

**Reduced-motion fallback.** When `UIAccessibility.isReduceMotionEnabled` (iOS) or
`SemanticsService.disableAnimations` (Flutter) is true, suppress all spring and fade
animations; the gift card and CTA appear instantly at full opacity with no motion. Record
`reduce_motion_active: true` in all emitted events.

**Web (motion/react).** Read `state/theme.tokens.json` `motion.durationReveal` and `motion.durationFast`
tokens promoted to `--motion-duration-reveal`/`--motion-duration-fast` CSS variables. Drive the gift card entrance with
`<motion.div initial={{opacity:0, y:40}} animate={{opacity:1, y:0}} transition={{type:'spring', stiffness:300, damping:28}}>`. CTA mount uses `<motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{duration: var(--motion-duration-fast, 120ms)}} style={{transitionDelay: '2.5s'}}>`. Implement `prefers-reduced-motion` via `useReducedMotion()` from motion/react.

### Bright Line / Dark Line / Guardrail

**Bright line.** The gift is a complete, self-contained, genuinely useful capability or insight
derived from the user's own inputs — delivered without announcement, before any ask — so the
user's obligation flows naturally from gratitude. The ask that follows is proportional
(permission, soft upgrade, or share) and occurs at least 2 seconds after the gift lands. The
user can dismiss the ask without losing the gift they already received.

**Dark line.** The Reciprocity Card crosses into manipulation when: (1) the "gift" withholds
the genuinely useful part behind a paywall — the user receives a teaser, not a complete value;
(2) the ask fires on a distressed screen; (3) the gift is deployed on the cancel or unsubscribe
flow as a retention tactic; (4) the gift is announced as a marketing tactic rather than
delivered as a surprise.

**Guardrail.** Before the card is called compliant, a deterministic check must pass: the
artifact doc must contain a Reciprocity Card attestation block with all required fields
including `gift_is_complete: true`, `ask_is_proportional: true`, `distress_state_excluded: true`,
and `surprise_preserved: true`. Run `npm run check:emotional-design -- --root .` — the
validator must find zero errors for the reciprocity card instance. Additionally:
`reciprocity_gift_delivered` with `gift_is_complete: false` appearing in PostHog production
events is an immediate blocker — the card is shipping a teaser and must be redesigned before
the experiment continues.

### Pairs With

- Commitment Card — captures the user's stated goal; the Reciprocity Card personalises the
  gift to that goal, making the obligation relational rather than transactional
- Perceived Effort Delay Card — makes the gift feel crafted and effortful; when both fire in
  sequence (visible effort → gift reveal → ask), the Labor Illusion amplifies the reciprocity
  obligation
- Intent Mirroring Card — confirms the user's intent before the ask; pairing after the
  reciprocity gift creates a three-step arc: gift → gratitude peak → mirror confirmation →
  ask
- Variable Reward Card — the Variable Reward Card creates anticipation before a reveal; the
  Reciprocity Card can be layered on top of the reveal moment — but the ask must be separated
  by at least one screen to avoid collapsing the emotional stack into a single extraction
  moment

### 11-Star Level

**6-star (Better than expected).** The free gift is complete and polished — it delivers the
full value promise, not a teaser. The user did not expect to receive this before paying.

**7-star (Way beyond).** The free gift is personally relevant to the user's exact stated goal
— it uses their own words, their own inputs, their own timeline — and it arrives as a genuine
surprise at the moment it is most useful. At 7-star, the user does not say "I got a free
thing"; they say "this product already knows what I need."

---
