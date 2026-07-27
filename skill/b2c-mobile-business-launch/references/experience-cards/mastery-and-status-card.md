# Mastery and Status Card

Part of the Experience Card deck. Read [`../experience-cards.md`](../experience-cards.md) first — it carries the card shape, the summary table, the Ethics Ladder/attestation contract, and the per-card routing. Apply cards via `EMOTIONAL_DESIGN.md` per `emotional-design-system.md`; HIGH-risk mechanics carry the full ethics contract in `ethics-guardrail.md`.

## Mastery and Status Card

**One-liner.** Earned status through visible skill levels, domain-vocabulary badges, and
social proof of progress gives users an intrinsic and social reason to continue beyond the
functional goal — because earned identity is self-reinforcing and publicly displayable.

**Emotional beat.** Earned pride — "I've become someone who is good at this."

### Psychology + Canonical Research

Locke and Latham's goal-setting theory (1990): status and level labels function as a form of
concrete feedback — they make abstract improvement legible. When a user sees "Intermediate
Runner" replace "Beginner," the label sets a new internal standard and raises the
self-regulatory bar for what counts as slipping backward. This creates a forward-pull
structurally different from streak mechanics (which create loss aversion) because it operates
on identity, not loss.

Nir Eyal's Hook Model (_Hooked_, 2014) identifies "rewards of self" — mastery, competence,
achievement — as the most psychologically durable category of variable reward precisely because
they are internal and not dependent on external validation. Deci and Ryan's Self-Determination
Theory (1985; attribution-uncertain for specific mobile-app study citations beyond the
theoretical framework) identifies competence as one of three core psychological needs;
satisfying it produces intrinsic motivation categorically more stable than extrinsic
motivation. The combination means a well-designed mastery system is self-sustaining: the user
is not chasing a carrot the app controls, but experiencing genuine growth. The social display
layer adds a tribe-reward signal: a user who shares their "Advanced Meditator" badge is
publicly adopting an identity, which Cialdini's consistency principle predicts will increase
follow-through on future sessions.

| Source | Finding | Confidence |
|---|---|---|
| Locke & Latham, _A Theory of Goal Setting_ (1990) | Specific, challenging goals with explicit feedback produce significantly higher performance; status and level labels serve as a concrete feedback mechanism. | solid |
| Eyal, _Hooked_ (2014) | Rewards of self — mastery, competence, achievement — are the most durable category of variable reward in the Hook Model. | solid |
| Deci & Ryan, Self-Determination Theory (1985) | Competence is one of three core psychological needs; satisfying it through visible skill progress produces intrinsic motivation more stable than extrinsic reward-based engagement. | attribution-uncertain |
| Cialdini, _Influence_ (1984) | Public commitment to an identity (sharing a badge or level label) increases behavioral consistency. | solid |
| Kivetz, Urminsky & Zheng, _JMR_ (2006); Hull (1932) | Users accelerate effort as they approach a visible goal; showing a partially-filled mastery bar creates an endowed-progress effect. | solid |
| Cooper, _The Inmates Are Running the Asylum_ (1999) | Mastery vocabulary must map to the user's actual skill domain, otherwise the label is decorative, not identity-forming. | solid |

### Mechanism Steps

1. User completes a meaningful domain action (session, exercise, quiz, challenge, or
   core-loop completion).
2. The app accumulates progress toward the next skill level using a transparent, user-legible
   metric (sessions, minutes, accuracy, streaks, or composite score).
3. When a threshold is crossed, a level-up moment fires: a deliberate, celebratory reveal
   using domain vocabulary that reflects the user's actual competence, not generic game tiers.
4. The new level label propagates visually across the product — profile screen, dashboard
   header, streak surface — so the user encounters their earned identity on return visits.
5. An optional social-display surface (badge share, leaderboard rank, profile card) makes the
   status externally legible, adding a tribe-reward signal without requiring it.
6. Near-level progress is surfaced as an endowed-progress element (e.g., "3 sessions to
   Intermediate") to exploit the goal-gradient effect at level boundaries.

### Real App Examples

**Duolingo.** League placement at end-of-week: Bronze → Silver → Gold with a fanfare animation
and social leaderboard showing the user's exact rank among peers. Domain vocabulary
(language-learning leagues) maps to a real skill ladder. The weekly cadence creates a fresh-
start temporal landmark that resets competition and re-engages dormant users.

**Nike Run Club.** Earning a Coach milestone badge ("First 5K", "Consistent Runner", "Speed
Demon") after hitting a threshold, with a full-screen badge reveal and a share CTA. Badge
labels use domain vocabulary the running community already values. Share CTA converts internal
mastery into public identity commitment (Cialdini).

**Headspace.** Reaching a meditation streak milestone that unlocks a "Mindful Month"
achievement and surfaces a personalized stat ("You've meditated X hours — that's more than
most people ever do"). Combines mastery identity with social-proof framing without a
competitive leaderboard, suitable for the app's calm emotional register.

**Brilliant (math/science).** Course completion unlocks a topic-specific "Mastery" indicator
on the user's profile, visible to anyone who sees their public learning path. Mastery is the
product's core value proposition; the label is literally what the app claims to deliver.
Profile visibility makes the status externally legible and creates a referral signal.

### When to Use / When NOT to Use

**Use** when the product has a genuine skill dimension — the user can objectively become better
at something over time — AND the app can measure that improvement with a real metric, not a
proxy gamification score. Fire the level-up reveal on the moment of completion, not on the
next app open.

**Do NOT use** on products with no real skill dimension; on purely transactional outcomes; when
the social leaderboard sub-feature cannot populate meaningful peer comparisons (an empty or
static leaderboard signals abandonment).

### Producer Recipe

1. **Define the skill ladder in domain vocabulary first.** Write out 4–6 level names using
   the actual language of the user's skill domain (e.g., for a language app: "Phrase Learner
   → Conversationalist → Fluent Speaker", not "Level 1 → Level 2"). Record the ladder and
   thresholds in `SPEC.md` and `TECH_SPEC.md` before any implementation.
2. **Define the mastery metric.** Identify the single real-world competence signal the app can
   measure. Document it in `ANALYTICS.md` as the canonical mastery metric. Do not use a
   composite gamification score as the sole input.
3. **Implement the near-level progress surface.** Show "X actions to [next level]" or a
   partially-filled progress bar always visible near the level boundary (within 20% of the
   threshold). Emit `mastery_progress_shown` with `current_level`, `next_level`,
   `progress_pct`, `surface`.
4. **Build the level-up reveal moment** as a designed emotional peak — a full-screen or
   sheet-level moment with domain-vocabulary congratulation copy, the new level name
   prominently displayed, and at least one motion transition. The reveal must fire on the
   completion action, not deferred. Emit `mastery_level_up` with `previous_level`,
   `new_level`, `mastery_metric_value`, `session_count`.
5. **Propagate the level label across the product.** Update the profile screen, dashboard
   header or greeting, and any streak or progress surface. The user should encounter their
   level label on every return visit.
6. **Add the optional social-display surface** — a shareable badge card or a leaderboard —
   only after the core identity layer is working and only if the user base or design register
   supports it. Emit `mastery_badge_shared` or `mastery_leaderboard_viewed`.
7. **Wire the reduced-motion fallback.** Level-up reveal animation must check OS reduce-motion
   preference. Fallback: a static screen with the same copy, the new level name, and a CTA.
8. **Record the Guardrail Contract attestation block** in `PRODUCTION_READINESS.md` before
   ship: mastery metric traces to real skill behavior, level labels use domain vocabulary from
   `SPEC.md`, opt-out path exists, social features are optional, no fake-mastery proxy score
   used as the sole input.

### Auditor Signals

**Present**
- Level labels use domain vocabulary specific to the app's skill area, not generic "Level N"
  or "Rank N" labels
- Progress toward next level is visible in at least one persistent surface (dashboard,
  profile, streak card)
- Level-up fires as a designed moment (full-screen, sheet, or equivalent) — not a passive
  badge in a notification center
- The level label appears on the profile screen and at least one return-visit surface
- `mastery_level_up` PostHog event exists in `ANALYTICS.md` with required properties
- The mastery metric traces to a real skill behavior documented in `ANALYTICS.md` and
  `TECH_SPEC.md`
- Level-up animation has a prefers-reduced-motion / OS reduce-motion fallback documented in
  `TECH_SPEC.md`

**Missing**
- No visible near-level progress indicator
- Level labels are generic game tiers with no connection to the app's skill domain
- Level-up fires as a silent counter increment or a toast — no designed emotional peak moment
- Level label does not persist across sessions
- `mastery_level_up` event absent from `ANALYTICS.md` or `TECH_SPEC.md`
- No domain-vocabulary skill ladder defined in `SPEC.md`
- Social sharing or leaderboard features present but there is no opt-out

**Misused**
- Mastery metric is a proxy engagement score (page views, taps, time-in-app) that does not
  reflect real skill improvement — fake mastery, dark-line violation
- Level labels used as a paywall gate: user must subscribe to see their current level
- Near-level progress bar resets or hides after subscription cancellation, manufacturing
  artificial loss to drive re-subscription
- Leaderboard compares absolute totals instead of normalized or cohort-relative performance,
  permanently advantaging early users
- Level-up moment fires during or immediately before a paywall CTA on the same screen —
  compliance veto

### Measurement Events

| Event | What it proves | Required properties |
|---|---|---|
| `mastery_progress_shown` | Near-level progress surface live and visible near a level boundary | `current_level`, `next_level`, `progress_pct`, `surface` |
| `mastery_level_up` | Level-up moment fires on genuine skill-threshold crossing | `previous_level`, `new_level`, `mastery_metric_value`, `session_count` |
| `mastery_level_up_engaged` | User interacted with the level-up reveal | `engagement_action` |
| `mastery_badge_shared` | Social display layer generating organic sharing events | `share_surface`, `anchor_type`, `new_level` |
| `mastery_leaderboard_viewed` | Social comparison surface being used | segment by rank position to detect learned-helplessness signal in bottom-quartile users |
| `mastery_level_dismissed` | Counter-metric: user closed the level-up reveal without engaging | `time_to_dismiss_ms` |

### Mobile Implementation + Reduced-Motion

**SwiftUI.** Level-up reveal is a full-screen or sheet-level modal. Use
`withAnimation(.spring(response: 0.5, dampingFraction: 0.7))` — the celebrate
family from `premium-mobile-craft.md` §1 — for the badge scale-in, and a soft fade
(`DesignTokens.Motion.durationFast`, 120 ms) for the level-label text appearance.

**Flutter.** `AnimationController` with `CurvedAnimation(curve: Curves.elasticOut)` reading
`durationBase` from the token map.

**React Native.** Reanimated `withSpring` with the exported motion token values.

**Web (motion/react).** Drive the reveal with motion/react using the promoted
`--motion-easing-spring` CSS variable for spring easing and `--motion-duration-fast` for the text reveal.
`AnimatePresence` wraps the level-up sheet.

**Reduced-motion fallback (mandatory).** Check `UIAccessibility.isReduceMotionEnabled`
(SwiftUI), `MediaQuery.of(context).disableAnimations` (Flutter), `useReducedMotion()` (React
Native / web). Fallback: static screen with level badge rendered at final scale, copy fully
visible, no transition animations. The fallback must still deliver the full copy — domain
vocabulary, new level name, progress stat — because the identity signal is in the words, not
the motion. Document the fallback per card in `TECH_SPEC.md`.

### Bright Line / Dark Line / Guardrail

**Bright line.** The level label reflects genuine skill improvement measured by a real
behavioral metric documented in `ANALYTICS.md` and `TECH_SPEC.md`; the vocabulary is drawn
from the user's skill domain and feels earned; progress is always visible; and social display
is optional, with a clear opt-out.

**Dark line.** The mastery metric is a proxy engagement score with no relationship to real
skill improvement; level-up reveals gated behind a subscription paywall; near-level progress
bars hidden or reset on cancellation; the level-up reveal fires on the same screen as a
paywall CTA, weaponizing earned pride as a purchase trigger.

**Guardrail.** Before any mastery-status surface ships, verify all of the following in
`PRODUCTION_READINESS.md`: (1) the mastery metric is documented in `ANALYTICS.md` and traces
to a real skill behavior in `TECH_SPEC.md` — not a proxy engagement score; (2) the skill-level
vocabulary is defined in `SPEC.md` using domain language, reviewed by the founder, and does
not use generic game tiers; (3) the level-up reveal is not on the same screen as a paywall CTA
(same-screen coupling is a hard veto); (4) the near-level progress bar and level label do not
reset or hide on subscription cancellation or downgrade; (5) social sharing and leaderboard
features have a visible user-controlled opt-out; (6) the `mastery_level_up` PostHog event is
in `ANALYTICS.md` with all required properties before implementation; (7) prefers-reduced-
motion / OS reduce-motion fallback is implemented and documented. Run
`npm run check:emotional-design -- --root .`.

### Pairs With

- Variable Reward Card — layer the anticipation mechanic onto the level-up reveal when the
  exact threshold-crossing moment is not trivially predictable
- Commitment Card — a user who stated a specific goal in onboarding should see their level
  label echoed in downstream surfaces as progress confirmation
- Intent Mirroring Card — at a milestone level-up, an intent mirror ("You said you wanted to
  become fluent — you just crossed into Advanced") turns a functional threshold into a
  reflective identity moment

### 11-Star Level

**6-star (Better than expected).** Level-up is celebrated, not just incremented — a designed
emotional peak replaces a silent counter.

**7-star (Way beyond).** The level label maps to the user's actual skill domain vocabulary and
reflects their real competence; users feel the product tracked their genuine growth, not a
gamification proxy. The Mastery and Status Card is the primary mechanism for reaching the
7-star "made for me" identity claim in the experience ladder.

---
