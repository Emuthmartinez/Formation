# Identity and Self-Expression Card

Part of the Experience Card deck. Read [`../experience-cards.md`](../experience-cards.md) first — it carries the card shape, the summary table, the Ethics Ladder/attestation contract, and the per-card routing. Apply cards via `EMOTIONAL_DESIGN.md` per `emotional-design-system.md`; HIGH-risk mechanics carry the full ethics contract in `ethics-guardrail.md`.

## Identity and Self-Expression Card

**One-liner.** When users author their own experience — naming a goal, choosing an avatar,
labeling a streak, customizing a theme — they conflate their identity with the product's
success, making abandonment feel like self-contradiction.

**Emotional beat.** Ownership-pride — "This is mine; it reflects who I am."

### Psychology + Canonical Research

Don Norman's three-tier emotional design model (_Emotional Design_, 2004) identifies the
reflective level as the deepest tier — the layer where self-image, personal narrative, and
identity are processed. Visceral (appearance) and behavioral (usability) tiers set the stage,
but only the reflective tier produces lasting loyalty. A product that enters this tier makes
the user feel that the object says something true about who they are: it becomes an extension
of the self, not a utility. Norman explicitly distinguishes reflective-level attachment from
mere satisfaction — it is pride, not pleasure.

Cialdini's commitment and consistency principle (_Influence_, 1984): once a person has
actively labeled themselves — "I am someone who runs before breakfast," "I am building my
savings" — they experience internal pressure to behave consistently with that self-label.
Alan Cooper's goal-directed design framework (_The Inmates Are Running the Asylum_, 1999):
design for the user's self-image goal — not just their instrumental goal — and the product
earns a place in identity rather than remaining a mere tool. Norton, Mochon, and Ariely's
IKEA Effect (_Journal of Consumer Psychology_, 2012): when a user authors or witnesses the
construction of their output, the perceived value of that output inflates.

| Source | Finding | Confidence |
|---|---|---|
| Norman, _Emotional Design_ (2004) | Reflective design level produces the deepest and most durable product loyalty; products that engage it become extensions of the self. | solid |
| Cialdini, _Influence_ (1984) | Commitment and consistency: once a person actively labels themselves, internal pressure to behave consistently with that label activates. | solid |
| Picard, _Affective Computing_ (1997) | Systems that recognize, interpret, and adapt to personal affect create significantly stronger emotional bonds and trust. | solid |
| Cooper, _The Inmates Are Running the Asylum_ (1999) | Goal-directed design: design for the user's self-image goal; products that target self-image goals earn deeper engagement. | solid |
| Norton, Mochon & Ariely, _Journal of Consumer Psychology_ (2012) | IKEA effect: people value outcomes they helped produce more than identical outcomes delivered to them. | solid |
| Kahneman & Tversky / Thaler (1979–1980) | Endowment effect: people value things more once they own or personalize them; losing a personalized artifact feels worse than never having it — raising switching cost proportionally to expressed identity investment. | solid |
| Attribution-uncertain: closest basis is Cialdini (1984) foot-in-the-door and self-perception research | Publicly visible or shared self-expression amplifies consistency pressure beyond private commitment alone. | attribution-uncertain |

### Mechanism Steps

1. **Identity Anchor.** Early in onboarding (before the paywall), present one low-friction
   identity choice: name a goal, choose a persona or archetype, select an avatar or color
   theme, or write a short self-statement. This is the authorship moment. The product accepts
   it as authored content, not a preference.
2. **Persistent Echo.** Every subsequent screen that is reasonably related references the
   identity anchor explicitly: plan headers use the user's goal name, push notifications
   address the persona, streak labels reflect the chosen archetype, empty states speak to the
   self-image. The product never lapses back to generic copy once the anchor is set.
3. **Visible Ownership Signals.** Surface the user's identity choices as visible artifacts:
   a named profile card, a custom theme that affects every screen, a goal badge displayed on
   completion screens, or an avatar that appears in milestone moments.
4. **Milestone Reflection.** At key achievement moments (day-7 streak, first goal met, plan
   completion), pause to reflect the identity anchor back: "You said you wanted to [goal]. You
   did it." Reflective-level moment, not a gamification reward.
5. **Shareability of Authorship.** Make the identity artifact shareable: a named goal card, a
   progress summary with the chosen theme, a streak milestone that displays the persona label.
   Sharing doubles the identity investment.
6. **Re-commitment Gate (optional, session restart).** On returning sessions where engagement
   has lapsed, offer a brief re-anchor: "You chose [goal]. Still the right direction?" Not
   guilt — a genuine check that creates a fresh commitment and activates the fresh-start effect.

### Real App Examples

**Duolingo.** Choosing a streak name and a custom league avatar; the streak counter and the
league leaderboard display the user's chosen identity token on every return visit, making
missing a day feel like abandoning a self-declared commitment. The identity anchor (streak
name, avatar) is publicly visible inside the league, creating Cialdini consistency pressure
reinforced by social proof.

**Nike Run Club.** Naming a run (a personal race, a route, a goal challenge) and receiving a
personalized achievement card with the user's name, photo frame, and goal language after
completion — shareable as a social card. The IKEA effect is triggered by co-authoring the
achievement: the user named the goal, ran it, and now receives a card that is theirs.

**Notion.** Creating and naming a personal workspace, choosing a cover image, setting a page
icon — the product visually becomes "yours" before you have entered a single piece of real
content. Visible ownership signals appear immediately at setup (Norman reflective tier: the
space looks like me). The endowment effect kicks in before any functional value is delivered.

**Strava.** The user names their training goal ("Sub-4 Marathon — Spring 2026"), which then
appears as a header on every weekly summary and feed card, referenced in auto-generated workout
context ("On track for your goal"). Cialdini consistency: the named public goal creates
commitment. Cooper's self-image goal design: the product targets who the user wants to be.

### When to Use / When NOT to Use

**Use** when the product has any of the following: a personalized plan, a goal declaration, a
profile name or avatar, a selectable theme or persona, a named streak, a community or league
membership, a shared achievement surface, or any repeating loop where the user's stated
identity is the frame for progress.

**Do NOT use** when: the product collects identity information for algorithmic targeting
without surfacing it back to the user as authored content; there is no mechanism to echo the
identity anchor back in subsequent screens; during high-stakes purchase flows where identity
pressure could coerce a transaction; or when the product cannot store and surface the identity
information reliably.

### Producer Recipe

1. **Map the identity anchor point.** Identify the single strongest identity declaration
   available in your product — the one that best answers "who does the user want to become by
   using this?" Do not collect more than one anchor in onboarding unless they serve distinct
   product surfaces.
2. **Implement the anchor screen in onboarding.** Place it after the value-promise step but
   before the paywall. One tap or a short text field, feel like authorship not a settings form.
   Log `identity_anchor_set` with `anchor_type`, `anchor_value`, `flow_id`, `step_id`.
3. **Persist the anchor everywhere it can be echoed.** Store as a user property in PostHog
   (`identity_anchor_type`, `identity_anchor_value`), in your backend user record, and in your
   push/email personalization layer.
4. **Build echo surfaces.** Audit every repeating screen in the core loop and identify where
   the anchor can appear as authored copy. Plan summary headers, streak labels, milestone
   messages, coach prompts, and push notifications are all echo surfaces. Implement echo on at
   least three distinct surfaces before calling the card active.
5. **Create a visible ownership artifact.** Produce at least one visual element the user can
   see as "theirs": a named plan card, a color-themed screen, a goal badge, a profile tile.
6. **Add a milestone reflection moment.** At the first significant achievement (day-7, first
   goal milestone, plan completion), show a full-screen reflective moment that names the
   anchor: "You said you wanted [anchor_value]. Here is what you did." Log
   `identity_milestone_reflected` with `anchor_type`, `anchor_value`, `milestone_id`.
7. **Implement the shareability surface.** Make the ownership artifact shareable as a card or
   image. Include the user's goal name, their theme/avatar, and their progress stat. Log
   `identity_artifact_shared` with `share_surface`, `anchor_type`.
8. **Implement the re-commitment gate on lapse.** When a user returns after a configurable
   inactivity gap (e.g., 3+ days), show a single-screen re-anchor: their original goal, a
   brief "still on track?" prompt, and a one-tap re-commit. Log
   `identity_recommitment_shown` and `identity_recommitment_confirmed`. Do not guilt-trip.
9. **Implement the reduced-motion fallback.** Every animated reveal of an ownership artifact
   must degrade to an opacity-only or instant change when prefers-reduced-motion / OS
   reduce-motion is active. Document the fallback in `TECH_SPEC.md`.
10. **Verify editability.** The identity anchor must be editable from a settings or profile
    screen with no friction. Run on device before calling the card launch-ready and record
    evidence in `PRODUCTION_READINESS.md`.

### Auditor Signals

**Present**
- Onboarding contains a visible identity-declaration step (goal name, persona, avatar, or
  theme selection) placed before the paywall
- The declared identity anchor appears in at least three distinct in-app surfaces after
  onboarding
- A visible ownership artifact exists — something the user can identify as "theirs"
- Milestone reflection moments use the user's own anchor language, not generic achievement
  copy
- The identity anchor is editable from settings or profile without a support ticket
- `identity_anchor_set` and `identity_anchor_echoed` PostHog events fire with expected
  properties
- Shareability surface exists for at least one ownership artifact
- Reduced-motion fallback is implemented for animated ownership reveals

**Missing**
- Onboarding collects a name or avatar but never echoes it in any subsequent screen
- No visible ownership artifact exists; the product looks and behaves identically for all
  users after onboarding
- Milestone messages are generic ("Great job!") rather than anchored to the user's declared
  goal or persona
- The identity anchor is stored but not persisted to PostHog person properties or backend
  profile
- No re-commitment gate on lapse
- `identity_anchor_set` event missing from `ANALYTICS.md` or fires without `anchor_type`
  and `anchor_value` properties

**Misused**
- Identity pressure applied immediately before or on a paywall screen — "You chose [goal].
  Don't let yourself down — upgrade now." Cialdini consistency exploit against the user's
  interest. Dark pattern, compliance veto.
- Identity anchor fabricated or suggested ("Most users like you choose Achiever") rather than
  freely chosen
- Avatar or theme customization placed behind a paywall with no free equivalent — makes
  identity expression a purchase
- Product deletes or resets the identity anchor after a subscription lapse as a retention
  tactic ("Your goal was removed. Resubscribe to restore it.") — endowment-effect hostage
  dark pattern
- Re-commitment gate uses guilt language ("Remember why you started?", "Don't give up now")
  rather than neutral fresh-start language

### Measurement Events

| Event | What it proves | Required properties |
|---|---|---|
| `identity_anchor_set` | User completed the identity-declaration step | `anchor_type`, `anchor_value`, `flow_id`, `step_id` |
| `identity_anchor_echoed` | The declared anchor was surfaced back to the user on a named screen | `surface`, `anchor_type`, `anchor_value`, `echo_position` |
| `identity_milestone_reflected` | A milestone reflection moment fired and named the user's anchor | `anchor_type`, `anchor_value`, `milestone_id`, `milestone_label` |
| `identity_artifact_shared` | User shared an ownership artifact | `share_surface`, `anchor_type`, `anchor_value` |
| `identity_recommitment_shown` | Re-commitment gate displayed to a lapsed user | `anchor_type`, `anchor_value`, `days_inactive`, `trigger_surface` |
| `identity_recommitment_confirmed` | Lapsed user tapped re-commit | `anchor_type`, `anchor_value`, `days_inactive` |
| `identity_anchor_edited` | User updated their identity anchor from settings | `anchor_type`, `old_value_hash`, `new_value_hash`, `edit_surface` |

### Mobile Implementation + Reduced-Motion

**SwiftUI.** Render the identity anchor capture screen as a full-bleed card stack. On
selection, use a celebrate-family spring (scale from
0.95 to 1.0, opacity 0 to 1, duration `DesignTokens.Motion.durationBase`, 220 ms) to confirm
authorship. Apply the chosen theme token immediately to the navigation bar and background so
the user sees the ownership effect in real time. For the milestone reflection full-screen, use
a slow fade-in with `DesignTokens.Motion.durationReveal` (600 ms) plus a one-line text reveal
with a stagger. Reduced-motion fallback: check `UIAccessibility.isReduceMotionEnabled` and
fall back to `.easeIn(duration: 0.1)` opacity only, no scale or stagger.

**Flutter.** `AnimatedContainer` or `Hero` transition for avatar/persona card selection. Check
`MediaQuery.of(context).disableAnimations` for reduced-motion.

**React Native (Reanimated).** `useSharedValue + withSpring` for card selection. Respect
`AccessibilityInfo.isReduceMotionEnabled()`.

**Web (motion/react).** Drive durations from `--motion-duration-base` and
`--motion-easing-spring` CSS variables. Use `useReducedMotion()` hook; when true, set
`transition={{ duration: 0 }}` on all identity-reveal animations. The ownership artifact
share card should use `AnimatePresence` for mount/unmount.

### Bright Line / Dark Line / Guardrail

**Bright line.** The identity anchor is collected, stored, echoed, and reflected back for the
sole purpose of helping the user pursue the goal or self-image they explicitly declared. Every
surface that uses the anchor makes the user more likely to achieve what they said they wanted.

**Dark line.** Using the identity anchor as a coercion lever: placing it immediately before a
paywall CTA with copy that ties abandonment to self-betrayal; holding the ownership artifact
hostage behind a subscription; manufacturing the anchor through suggested identities with false
social proof; using guilt-loaded language in the re-commitment gate. All are compliance vetoes.

**Guardrail.** Before shipping any screen or copy that uses the identity anchor, answer all of
the following; a single "no" blocks ship:
1. Is the identity anchor freely chosen by the user with no suggested default that benefits
   the product's conversion rate?
2. Is the anchor editable from a settings or profile screen without friction or a support
   ticket? (Verify on device.)
3. Does the anchor echo appear on surfaces that genuinely serve the user's goal — not on the
   paywall or a purchase CTA?
4. Does the re-commitment gate use neutral fresh-start language, not guilt or loss framing?
5. Is the ownership artifact available to free-tier users (at least a baseline version) before
   any purchase?
6. Is the anchor's content sourced exclusively from fields the user explicitly provided —
   never inferred, manufactured, or suggested?
7. Are all animated reveals guarded by a prefers-reduced-motion / OS reduce-motion check with
   a documented fallback in `TECH_SPEC.md`?
8. Are `identity_anchor_set`, `identity_anchor_echoed`, and `identity_milestone_reflected`
   events present in `ANALYTICS.md` with required properties and verified in PostHog activity
   view?

Record pass/fail for each item in `PRODUCTION_READINESS.md`. Run
`npm run check:emotional-design -- --root .`.

### Pairs With

- Commitment Card — the Commitment Card captures the behavioral pledge; the Identity Card
  captures the self-image anchor. They are complementary: the commitment drives action, the
  identity creates the self-label that makes breaking the commitment feel wrong.
- Intent Mirroring Card — the mirror reflects the user's stated intent back at a specific
  moment; the Identity Card operates at the persistent-artifact level. Pair them so the mirror
  uses the identity anchor's language.
- Variable Reward Card — when the identity anchor is a goal, each session's result is a
  variable reward relative to that named goal. The anchor makes the variable outcome personally
  meaningful.
- `references/viral-growth-loops.md` — the ownership artifact (named goal card, achievement
  summary with theme) is the highest-trust shareable unit for organic growth.

### 11-Star Level

**7-star (Way beyond).** Every screen feels authored by the user, not served to them: their
goal name is in the header, their chosen theme is in the palette, their persona label is in
the coach's voice. The product has no generic fallback copy once the identity anchor is set.

**10-star (Impossible concierge).** A personal coach who had read the user's journal for a year
would know not just their goal but the exact framing, the setbacks they fear, and the milestone
language that resonates with their self-image. The 7-star V1 scalable slice is: named goal
anchor + three echo surfaces + one milestone reflection moment. The 10-star inspiration drives
the copy depth and personalization ambition for V2.

---
