# Fresh Start Card

Part of the Experience Card deck. Read [`../experience-cards.md`](../experience-cards.md) first — it carries the card shape, the summary table, the Ethics Ladder/attestation contract, and the per-card routing. Apply cards via `EMOTIONAL_DESIGN.md` per `emotional-design-system.md`; HIGH-risk mechanics carry the full ethics contract in `ethics-guardrail.md`.

## Fresh Start Card

**One-liner.** Surface time-based reset opportunities — new year, new month, Monday, birthday,
post-lapse — so re-engagement feels like a new chapter rather than a failed attempt.

**Emotional beat.** Clean-slate optimism — "That was before; this is a new chapter."

### Psychology + Canonical Research

Hengchen Dai, Katherine Milkman, and Jason Riis (_Management Science_, 2014) documented the
fresh-start effect: aspirational behaviors — gym attendance, diet searches, goal-setting —
spike measurably at temporal landmarks such as the new year, a new week, a birthday, and the
start of a semester. The mechanism is mental account separation: users psychologically close
the ledger on past failures at these boundaries and open a clean account for future
performance.

Gollwitzer's work on implementation intentions (_American Psychologist_, 1999): "when-then"
plans produce dramatically higher follow-through than vague intentions. Fresh-start moments are
the natural if-then anchor: the temporal landmark supplies the "when" automatically, which
means the product only needs to supply a frictionless "then." Delivering a concrete,
pre-personalized re-entry action at the moment the mental account resets converts the
peak-aspiration moment into a behavioral contract before the motivation dissipates.

| Source | Finding | Confidence |
|---|---|---|
| Dai, Milkman & Riis, _Management Science_ (2014) | Aspirational behaviors spike measurably at temporal landmarks (new year, new week, birthdays, semester starts) because people mentally separate past failures from future performance at these boundaries. | solid |
| Gollwitzer, _American Psychologist_ (1999) | When-then plans significantly increase follow-through vs. stated intentions alone; fresh-start moments supply the "when" automatically. | solid |
| Kahneman & Fredrickson, _Psychological Science_ (1993) — peak-end rule | A well-designed re-entry moment at a temporal landmark can become the emotional peak the user associates with the product, overwriting the memory of the lapse that preceded it. | solid |
| Cialdini, _Influence_ (1984) | A fresh-start prompt that captures a re-commitment ("I'm starting again") activates consistency pressure for the session that follows. | solid |
| Fogg, _Tiny Habits_ (2019) | Temporal landmarks supply peak motivation; a fresh-start prompt converts motivation into action before it dissipates. Attribution-uncertain: specific mobile re-engagement studies using Fogg framing post-2019 exist but exact authors not confirmed. | attribution-uncertain |

### Mechanism Steps

1. Detect the temporal landmark: new year, new month, new week (Monday), user birthday,
   N-day lapse (configurable threshold, typically 3–14 days), post-payment failure recovery,
   or app version first-open after a dormant period.
2. Personalise the frame using the user's stored commitment (from the Commitment Card): surface
   their own stated goal, not a generic category message. "You wanted to run 3x a week. New
   week starts today."
3. Present a low-friction re-entry action — a single tap or swipe — that begins the first core
   action of the new chapter. Do NOT present a summary of missed days, a streak reset count,
   or a lost-progress screen first.
4. Optionally anchor with a new implementation intention: offer a "when-then" micro-plan for
   the current cycle ("Tap to set your first session for this week") that takes under 10
   seconds to complete.
5. Emit the re-entry event and update streak/progress state from this moment forward, treating
   it as Day 1 of a new cycle.
6. Deliver a light acknowledgment of the reset at the end of the first completed action — not
   at the start — to reinforce that the chapter is now open, not just announced.

### Real App Examples

**Duolingo.** Monday morning push: "New week, fresh start. Your streak is protected — let's
make this one count." The app does not lead with the number of missed days; it leads with the
temporal landmark and a single CTA that begins a lesson immediately. The streak-shield mechanic
reduces the punishment signal, leaving only the aspiration signal active.

**Headspace / Calm (meditation category).** New Year and first-of-month re-engagement push:
"January 1. A fresh start. Your [pack name] is still here, exactly where you left it." The
app re-surfaces the user's last chosen content as the re-entry point. Surfacing the specific
content the user chose previously activates the Commitment Card echo — combined with fresh-
start aspiration and Gollwitzer implementation-intention specificity.

**Noom / MyFitnessPal.** Post-lapse re-engagement at 7 days of no logging: "No streak
pressure. Just today. What did you have for breakfast?" — a single minimal-friction logging
prompt that does not reference the gap. The lapse itself is a personal temporal landmark.
Removing the gap-shame and offering a single concrete action applies Fogg B=MAP.

**Fabulous.** Birthday in-app screen: full-screen illustrated moment, user's name, a message
framing the new year of their life as a fresh chapter, a single CTA to set one habit for this
year — no data-entry form, no paywall. The birthday is the strongest personal temporal landmark
in Dai et al.'s data.

### When to Use / When NOT to Use

**Use** in any consumer mobile app where the user's core value loop requires repeated behavior
over time — health, fitness, learning, meditation, journaling, finance habits, diet, language,
productivity. Most potent at: (1) post-lapse re-engagement flows, (2) Monday and first-of-month
push/in-app notifications, (3) new year in-app experiences, (4) birthday personalization
moments, (5) post-payment-failure recovery flows.

**Do NOT use** on every session open — overuse destroys the specialness of the temporal
landmark; on transactional surfaces where no behavioral loop exists; as a disguise for a
paywall (the fresh-start moment must never be the screen immediately before a hard paywall
CTA); or to manufacture false urgency by inventing a landmark that does not correspond to a
real calendar or personal event.

### Producer Recipe

1. **Map the temporal landmarks** available for your app's user base: (a) universal calendar
   events the product can detect; (b) personal user events the product already knows (sign-up
   anniversary, birthday from profile, subscription renewal date, return after N-day lapse —
   set your lapse threshold in `ONBOARDING.md` and `TECH_SPEC.md`); (c) personal achievement
   thresholds that create a "new level" sense.
2. **Pull the user's stored `commitment_value` and `commitment_type`** from the Commitment
   Card data layer. The fresh-start message MUST use the user's own language. If commitment
   data is absent, surface the user's most recently completed core action as the re-entry
   anchor instead.
3. **Design the re-entry screen or notification** with this constraint: no mention of the gap,
   missed sessions, broken streak, or lost progress on the initial screen. Record this copy
   rule in `BRAND.md` or `design.md §Copy Rules`.
4. **Implement a single, immediate re-entry action:** a button that begins the first core
   action of the new cycle — not a settings screen, not a recap, not a paywall.
5. **Wire the push notification or in-app trigger:** for calendar landmarks, use a scheduled
   notification at the user's historically active time-of-day (derived from
   `session_start_time` distribution in PostHog). For lapse landmarks, fire at the same time-
   of-day the user was historically active. If time-of-day data is unavailable, default to
   mid-morning (9–10 AM local).
6. **Instrument PostHog events:** `fresh_start_triggered`, `fresh_start_cta_tapped`,
   `fresh_start_core_action_completed`, `fresh_start_dismissed`. Add to `ANALYTICS.md` before
   implementation. Set person properties: `last_fresh_start_landmark_type`,
   `last_fresh_start_at`, `fresh_start_activations_total`.
7. **Implement reduced-motion fallback:** fresh-start screen typically uses a full-screen
   animated transition (spring or fade, `DesignTokens.Motion.durationSlow` on native;
   motion/react `AnimatePresence` on web). Fallback: instant opacity transition — no spring,
   no transform. Document in `TECH_SPEC.md`.
8. **Verify the bright-line compliance check** before ship: confirm the fresh-start screen is
   not followed by a paywall in the same screen, the user can dismiss freely, and no language
   implies the user "lost" anything during the gap. Record attestation in
   `PRODUCTION_READINESS.md`.

### Auditor Signals

**Present**
- Push notification copy or in-app screen opens with a temporal-landmark frame ("New week",
  "New month", "New year", "New chapter") rather than a gap-shame frame ("You missed X days",
  "Your streak is broken")
- Re-entry message references the user's stored commitment or last core action
- A single, immediate, low-friction CTA begins the core action without a form or settings
  step in between
- `fresh_start_triggered` event fires in PostHog with `landmark_type`, `days_since_last_session`,
  and `commitment_type` properties
- Product does not mention the gap duration, missed-session count, or streak-break count on
  the initial fresh-start screen
- Landmark detection covers at least two types: calendar and lapse-based
- Notification delivery time is personalized to the user's historical active hour
- Reduced-motion fallback exists for the fresh-start screen transition

**Missing**
- No post-lapse re-engagement flow: after N days of inactivity the app sends a generic "we
  miss you" notification with no temporal framing and no direct re-entry action
- Fresh-start message uses generic copy unconnected to the user's stored commitment
- The fresh-start screen requires multiple taps or a settings/profile update before the user
  can begin their first action
- `fresh_start_triggered` event absent from `ANALYTICS.md` and PostHog
- No calendar landmark detection
- No birthday or anniversary landmark implemented despite the product having the user's
  birthdate or sign-up date
- Lapse threshold hard-coded and never tuned

**Misused**
- Fresh-start screen opens directly into a paywall or subscription offer — weaponizing the
  peak-aspiration moment for extraction. Primary dark pattern, compliance veto.
- Gap duration or missed-session count is displayed prominently on the fresh-start screen —
  converts the clean-slate frame into a shame frame
- Card fires on every session open — every day — destroying temporal-landmark scarcity
- A manufactured temporal landmark is used: a countdown timer with no real calendar basis
- Fresh-start frame used on a cancel or unsubscribe flow as retention friction
- Commitment echoed in the fresh-start message is stale or inaccurate (12+ months old)

### Measurement Events

| Event | What it proves | Required properties |
|---|---|---|
| `fresh_start_triggered` | Product detected a temporal or lapse landmark and surfaced a fresh-start moment | `landmark_type`, `days_since_last_session`, `commitment_type`, `has_stored_commitment: bool`, `notification_channel`, `surface`, `variant_id` |
| `fresh_start_cta_tapped` | User accepted the clean-slate frame and initiated re-entry — primary conversion event | `landmark_type`, `days_since_last_session`, `commitment_type`, `time_to_tap_ms` |
| `fresh_start_core_action_completed` | User completed their first core action in the new chapter | `landmark_type`, `days_since_last_session`, `core_action_type`, `session_duration_ms`, `is_first_action_in_new_cycle: bool` |
| `fresh_start_dismissed` | User saw the fresh-start screen and chose not to engage — counter-metric | `landmark_type`, `dismiss_reason`, `time_to_dismiss_ms` |
| `fresh_start_implementation_intention_set` | User completed the optional when-then micro-plan | `landmark_type`, `intention_type`, `commitment_type` |

### Mobile Implementation + Reduced-Motion

**Native mobile.** Full-bleed, low-information layout — landmark label at top, one line of
personalized commitment echo, and a single primary action button. Animate entry with a spring
transition reading `DesignTokens.Motion.durationSlow` (360 ms) and
`DesignTokens.Motion.easingEmphasis`; the screen fades in from slight scale-up (1.04 → 1.0)
to signal a meaningful arrival. Exit on CTA tap uses `DesignTokens.Motion.durationBase`
(220 ms) with a dissolve.

**iOS.** Implement prefers-reduced-motion by checking `UIAccessibility.isReduceMotionEnabled`;
fallback is an instant opacity transition with no scale transform.

**Flutter.** Check `MediaQuery.of(context).disableAnimations`.

**React Native.** Use `AccessibilityInfo.isReduceMotionEnabled()` from the react-native
accessibility API.

**Push notification.** Use the user's historically active hour from PostHog session data.
On iOS, schedule via `UNUserNotificationCenter` with a `UNCalendarNotificationTrigger` for
predictable landmarks; use a server-side scheduled push (Resend + backend job or RevenueCat
push) for lapse-based triggers. Notification copy must fit in 65 characters for the title and
110 characters for the body. Include a deep link that opens directly to the fresh-start screen
via a Universal Link / App Link.

**Web (motion/react).** Use `AnimatePresence` for the fresh-start section entry. Duration
values must read from the promoted `--motion-duration-slow` CSS variable (from `state/theme.tokens.json`).
Add `@media (prefers-reduced-motion: reduce) { transition: none; animation: none; }` at the
global level.

### Bright Line / Dark Line / Guardrail

**Bright line.** The fresh-start frame is delivered at a real temporal or personal landmark,
uses the user's own stored commitment language to create recognition, and immediately offers a
value-delivering action so the re-engagement moment serves the user's stated goal.

**Dark line.** Using the peak-aspiration moment of a temporal landmark to surface a paywall,
a guilt-laden lapse summary, a manufactured countdown with no real calendar basis, or a
cancellation-retention screen. The fresh-start frame on a cancel or unsubscribe flow is
explicitly prohibited — it is the Intent Mirroring Card dark pattern applied to an exit path.

**Guardrail.** Before any fresh-start screen or notification ships, answer all three: (1) Does
the landmark correspond to a real calendar event or a real lapse event (N days configurable
and documented in `TECH_SPEC.md`)? Manufactured countdown timers are blocked. (2) Is the next
screen after the fresh-start CTA the first core action of the app — not a paywall, not a
settings form, not a gap-summary screen? (3) Does the fresh-start copy avoid mentioning the
gap duration, missed-session count, or streak-break count on the initial screen? All three
must be yes. Record attestation in `PRODUCTION_READINESS.md`. Run
`npm run check:emotional-design -- --root .`.

### Pairs With

- Commitment Card — `commitment_value` captured during onboarding is the source material for
  the personalized fresh-start echo; these two cards share a data dependency:
  `commitment_made` must precede `fresh_start_triggered` in the user's lifecycle
- Intent Mirroring Card — a fresh-start re-entry moment is a natural trigger for an intent
  mirror; constraint: the intent mirror must fire after the fresh-start CTA is tapped, not as
  a gate before the CTA
- Variable Reward Card — the first core action of the new chapter is a candidate trigger for a
  variable reward reveal, making the re-engagement session memorable rather than routine
- Perceived Effort Delay Card — when the fresh-start session involves a plan rebuild, the
  Perceived Effort Delay Card can be applied to the plan-generation step; only appropriate
  when real re-personalization computation occurs

### 11-Star Level

**6-star (Better Than Expected).** The lapse notification and re-entry screen frame the return
as a fresh chapter rather than a guilt trip — the user expected punishment and received
permission instead. Minimum viable implementation of the card.

**7-star (Way Beyond).** The product proactively detects a temporal landmark — Monday, first
of month, the user's birthday — and surfaces a personalized reset offer using the user's own
commitment language before the user has thought to open the app. Requires: (a) server-side
landmark detection with push delivery, (b) `commitment_value` stored and retrievable per user,
(c) a single-tap re-entry action that begins value delivery within 10 seconds of opening the
notification. Map both levels explicitly in `11_STAR_EXPERIENCE.md`.

---
