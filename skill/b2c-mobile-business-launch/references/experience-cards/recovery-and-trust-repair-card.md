# Recovery and Trust Repair Card

Part of the Experience Card deck. Read [`../experience-cards.md`](../experience-cards.md) first — it carries the card shape, the summary table, the Ethics Ladder/attestation contract, and the per-card routing. Apply cards via `EMOTIONAL_DESIGN.md` per `emotional-design-system.md`; HIGH-risk mechanics carry the full ethics contract in `ethics-guardrail.md`.

## Recovery and Trust Repair Card

**One-liner.** A product that handles errors, lapses, failed payments, and crashes with speed,
transparency, and a restorative offer builds more durable trust than one that simply never
fails, because users remember the recovery more vividly than the failure itself.

**Emotional beat.** Relieved loyalty — "They handled that quickly and fairly; I trust them
more than before."

### Psychology + Canonical Research

The peak-end rule (Kahneman and Fredrickson, _Psychological Science_, 1993): a crash mid-
session is a valley; an immediate, warm recovery path that restores the user's progress is a
late peak. The memory encoded is of resolution, not failure. This is why the service recovery
paradox — documented by McCollough and Bharadwaj (1992, attribution-uncertain: well-supported
directional effect with mixed replication) — holds in the consumer mobile context: users who
experienced a failure and received an excellent recovery sometimes report higher satisfaction
than users who never failed at all, because the recovery proves the product's character under
stress.

Don Norman's emotional design framework (_Emotional Design_, 2004): visceral distress from a
failure activates the visceral tier immediately and forcefully. Recovery must respond at the
same tier first — fast, sensory, reassuring — before addressing the behavioral tier (restore
the state, replay the action) or the reflective tier (acknowledge what happened, offer
something forward-looking). Skipping visceral acknowledgment and jumping straight to a
technical explanation feels cold.

Fogg's Behavior Model (B=MAP, _Tiny Habits_, 2019): the recovery moment is a high-motivation,
low-ability crisis. The app must raise the user's ability (re-route the path) and validate
their motivation (confirm their goal still matters) before asking for any further action.

| Source | Finding | Confidence |
|---|---|---|
| Kahneman & Fredrickson, _Psychological Science_ (1993) | Peak-end rule: the overall memory of an experience is disproportionately shaped by its emotional peak and its final moment. A vivid, warm recovery is a late peak that overwrites the failure in memory. | solid |
| McCollough & Bharadwaj (1992) | Service recovery paradox: after a failure followed by an excellent recovery, customer satisfaction can exceed pre-failure baseline. | attribution-uncertain |
| Norman, _Emotional Design_ (2004) | Visceral distress from failure is recoverable if the behavioral and reflective design layers receive an adequate, staged response. | solid |
| Fogg, _Tiny Habits_ (2019) | A failure moment is a high-motivation, low-ability state. Recovery design must restore ability (re-route the path) before issuing any prompt. | solid |
| Buell & Norton, _Management Science_ (2011) | Showing the user what the system is doing to repair the situation raises perceived fairness and satisfaction, even when the actual fix time is identical to a silent repair. | solid |

### Mechanism Steps

1. Detect the failure class — crash, network error, payment decline, server timeout, lapse,
   or entitlement interruption — before choosing a recovery path. Each class requires a
   different tone and restoration offer.
2. Respond at the visceral layer first: within 300 ms of failure detection, surface a calm,
   on-brand signal (icon, color, single line of copy) that says the system knows something
   went wrong. No technical error codes visible at this stage.
3. Acknowledge at the behavioral layer: restore whatever user state is recoverable (in-
   progress form data, last screen position, cached plan state) and surface the clearest
   single action the user can take next. Limit to one CTA. If recovery is automatic, show the
   progress of the repair using real steps (operational transparency, Buell and Norton, 2011).
4. Offer a restorative gesture at the reflective layer when the failure was severe or
   repeated: a session credit, a grace period, a streak restore, or a plain written
   acknowledgment that names what happened and what the product is doing about it. The gesture
   must be proportionate and unconditional — not a coupon requiring a purchase.
5. Log the recovery event with failure class, time-to-recovery, restoration offer shown, and
   whether the user continued or churned.

### Real App Examples

**Duolingo — streak repair.** When a user misses a day, the app surfaces a calm streak-repair
screen that acknowledges the miss, shows the streak-freeze mechanic if available, or offers a
repair purchase — but critically separates the emotional acknowledgment screen from any spend
prompt by at least one deliberate interaction. The copy is warm, not shaming. The final moment
of the lapse experience is a warm offer, not a failure state.

**Apple Health / HealthKit-connected apps — background sync failure.** When a connected device
stops syncing, well-implemented health apps surface a single-sentence status card in the feed
("Last synced 2 hours ago — tap to reconnect") rather than a modal error. The status is
visible but non-blocking, and the repair path is one tap. Operational transparency (Buell and
Norton): the user can see the system's state and initiate repair without a crisis response.

### When to Use / When NOT to Use

**Use** on any feature or journey where the product can fail in a way the user will notice:
crash recovery, network timeout, failed payment or subscription lapse, missed streak or goal,
app update breaking state, server error during a value-reveal moment.

**Do NOT use** as a template for normal empty states (no content yet, first session), loading
states with no prior error, or cancellation confirmation flows. Do not apply to errors the
user caused intentionally (e.g., entering an invalid promo code deliberately) — those need
standard validation copy, not a restorative gesture. The restorative gesture is reserved for
failures the system or infrastructure caused.

### Producer Recipe

1. **Map every failure class** the product can produce before writing recovery copy: crash/ANR,
   network timeout, payment decline, subscription lapse, sync failure, permission revoked, data
   corruption, server error. Each class gets its own recovery entry in `TECH_SPEC.md` with:
   failure detection signal, time-to-detection target, visceral-layer response, behavioral-
   layer action, reflective-layer gesture (if severity warrants it), and PostHog event.
2. **Write recovery copy** in the product's brand voice for each class: name what happened in
   plain language, state what the product is doing about it, and offer one clear action. No
   technical error codes on the primary surface. No stack traces.
3. **Implement state preservation** before implementing recovery UI: cache the user's last
   known good state at every high-stakes moment. Recovery from a crash must restore to the
   last cached state, not to the app home screen. Document the cache points in `TECH_SPEC.md`.
4. **Add proactive detection** for the most common failure precursors: subscription payment
   failure webhook from RevenueCat (fire a push or in-app banner before the grace period ends,
   not after the entitlement is revoked); sync gap exceeding a product-defined threshold.
5. **For payment-failure recovery specifically:** wire the RevenueCat grace-period webhook to
   trigger a push notification and an in-app banner within the grace window. The banner must
   show the failure reason, the remaining grace period in plain language, and one tap to the
   platform's native subscription management or a web payment update link.
6. **Add a restorative gesture decision tree** to `SPEC.md`: if the failure is the product's
   fault (server error, sync failure, crash), offer a proportionate gesture unconditionally.
   If the failure is the user's (missed session, skipped goal), acknowledge warmly without
   guilt and offer a recovery path, but hold the restorative gesture for repeat occurrences.
7. **Emit recovery events:** `recovery_initiated`, `recovery_completed`, and
   `recovery_offer_shown` PostHog events with `failure_class`, `time_to_recovery_ms`,
   `restoration_offer_type`, and `user_continued: bool` before calling any recovery surface
   build-ready.

### Auditor Signals

**Present**
- Error screens have a single clear CTA that routes the user to the next recoverable action,
  not to the app home screen
- Payment failure surfaces show the reason in plain language and link to the platform's native
  subscription management within a grace period, not after entitlement is revoked
- Crash recovery restores the user's last known state (cached form data, screen position,
  partial progress) rather than restarting from scratch
- A proactive in-app banner or push appears for subscription payment failure before the grace
  period expires
- Recovery copy is in the product's brand voice — warm, specific, not generic
- PostHog shows `recovery_initiated` and `recovery_completed` events with `failure_class`
  and `time_to_recovery_ms` properties
- Recovery UI has a prefers-reduced-motion fallback for any animation
- Restorative gestures (session credit, streak restore, grace period extension) are
  unconditional and do not require a purchase to activate
- Lapse recovery (missed streak, skipped goal) is separated from any spend prompt by at
  least one distinct screen or user interaction

**Missing**
- No error states for key failure classes — the app shows a blank screen, spinner that never
  resolves, or crashes to home without acknowledgment
- Payment failure is only detected after the entitlement is already revoked
- Recovery screens show a generic error code or "Unknown error" with no product-specific
  context
- No state caching at high-stakes moments — crash recovery always restarts from app home
- PostHog has no recovery-specific events
- Restorative gesture absent even for severe or repeated failures caused by the product's
  infrastructure
- Recovery UI uses animated transitions with no reduced-motion fallback

**Misused**
- Recovery screen is used as a paywall entry point — a spend prompt appears on the same
  screen as the failure acknowledgment — compliance veto
- Restorative gesture is conditional on a purchase or subscription upgrade ("Restore your
  streak for $2.99")
- Recovery copy uses confirmshaming language ("Don't give up now") that exploits the user's
  emotional state at the failure moment
- The "proactive" detection banner fires on every session regardless of actual failure state
- Operational transparency steps during automatic repair show fake progress with no
  relationship to the actual repair operations

### Measurement Events

| Event | What it proves | Required properties |
|---|---|---|
| `recovery_initiated` | App detected a failure and entered a recovery path | `failure_class`, `failure_detected_at_ms`, `surface` |
| `recovery_completed` | User successfully continued past the failure state | `failure_class`, `time_to_recovery_ms`, `user_continued: bool` |
| `recovery_offer_shown` | A restorative gesture was presented to the user | `failure_class`, `restoration_offer_type`, `is_conditional: bool` |
| `recovery_offer_accepted` | User accepted the restorative gesture | `restoration_offer_type`, `failure_class` |
| `recovery_churned` | User did not continue past the failure state after recovery was offered | `failure_class`, `time_to_churn_ms` |
| `proactive_recovery_triggered` | Product detected a failure precursor and acted before the user hit a wall | `failure_precursor_type`, `hours_before_impact` |

### Mobile Implementation + Reduced-Motion

**iOS (SwiftUI).** Use a custom error view modifier presenting recovery UI as a bottom sheet
(`.sheet` with `.presentationDetents([.medium])`) rather than a full-screen modal. The sheet
preserves the underlying content view in context, signaling continuity rather than failure.
Animate the sheet presentation with a press-family spring (`.spring(response: 0.4, dampingFraction: 0.8)` — `premium-mobile-craft.md` §1). For prefers-reduced-motion:
check `UIAccessibility.isReduceMotionEnabled`; if true, present the sheet instantly with
`animation: nil`. For payment-failure banners, use a pinned top banner with
`DesignTokens.Motion.durationFast` fade-in (120 ms). Reduced-motion: instant alpha swap, no fade.

**Flutter.** `showModalBottomSheet` with `useSafeArea: true`. Check
`MediaQuery.of(context).disableAnimations` and pass `Duration.zero` when true.

**React Native (Reanimated).** Use `useAnimatedStyle` with a spring config sourced from the
project's design token map. Check `AccessibilityInfo.isReduceMotionEnabled()`. Recovery
banners use `react-native-toast-message` or an equivalent overlay — never a navigation push.

**Web (motion/react).** Drive recovery banners with `motion.div` using the `--motion-duration-fast`
CSS variable. Wrap the animation in `useReducedMotion()` from motion/react; when true,
substitute `initial={false}` and `animate={false}` to produce an instant, accessible state
change.

### Bright Line / Dark Line / Guardrail

**Bright line.** Use this card to restore the user's path toward their stated goal as quickly
and honestly as possible. A recovery that names what happened, restores what can be restored,
and offers an unconditional gesture when the failure was the product's fault serves the user's
real interest. The peak-end rule ensures the memory of the recovery — not the failure —
becomes the dominant emotional impression, which aligns user benefit with product retention.

**Dark line.** Exploiting the user's distress at a failure moment to drive a spend action:
surfacing a paywall, an IAP offer, or a streak-restore purchase inside or immediately after
the failure/grief screen. This is the recovery equivalent of the prohibited pattern in
`ethics-guardrail.md` (spend prompt inside a grief screen). It is a non-negotiable prohibited
pattern under Apple App Store Review Guidelines §4.0 (exploit emotions) and FTC dark-patterns
enforcement. A second dark-pattern variant: using operational transparency theatrics during a
fake repair — showing animated "fixing your account" steps when no actual repair is occurring.

**Guardrail.** Before any recovery surface ships, verify: (1) no spend prompt (paywall, IAP,
upgrade CTA) appears on the same screen as the failure acknowledgment or within a single user
interaction of the failure notification — enforce a minimum one full screen separation;
(2) any restorative gesture is unconditional and does not require payment to activate;
(3) operational transparency steps shown during automatic repair correspond to real system
operations — document the step-to-operation map in `TECH_SPEC.md` with the same ≥50%
real-operation ratio required by the Perceived Effort Delay Card; (4) recovery copy contains
no confirmshaming language, no manufactured urgency, and no fabricated social proof. Run
`npm run check:emotional-design -- --root .` before calling any recovery surface build-ready.

### Pairs With

- Commitment Card — the commitment made early is the anchor that makes recovery copy
  meaningful without manufacturing emotional urgency
- Perceived Effort Delay Card — when automatic repair requires real computation, operational
  transparency during the repair is the honest version of effort display
- Intent Mirroring Card — after a lapse recovery, a single intent-mirror moment before the
  next action converts a recovery into a recommitment without guilt or pressure
- Variable Reward Card — do NOT chain a variable reward reveal immediately after a recovery
  gesture; that sequence (failure → recovery offer → reward reveal) can look like manufactured
  anticipation and approaches the spend-prompt-after-reward dark pattern; separate them by at
  least one session

### 11-Star Level

**5-star (Expected).** Errors are handled without dead ends — every failure class has an error
view with a single recovery CTA and the user is never left on a blank screen or forced to
force-quit.

**6-star (Better than expected).** The recovery path acknowledges what specifically went wrong
in plain language, restores the user's last known good state, and offers a proportionate
restorative gesture when the failure was the product's fault.

**7-star (Way beyond).** The product detects failure precursors proactively — a subscription
payment about to fail, a sync gap widening, offline mode approaching a data-loss threshold —
and surfaces a resolution path before the user notices any degradation. The user's first
awareness of the problem is the product's offer to solve it, not the failure itself.
