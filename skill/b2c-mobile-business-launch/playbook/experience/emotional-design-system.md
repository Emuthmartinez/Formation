# Emotional Experience System

Use this when building, auditing, or reviewing the emotional and behavioral layer of a B2C mobile app. Apps charged with emotions feel different: they anticipate, solve, and reward action. This file is the methodology. The canonical 12-card deck lives in `playbook/experience/experience-cards.md`; producer recipes for the four required cards are in `playbook/experience/emotional-experience-design.md`, and measurement contracts in `playbook/experience/emotional-experience-measurement.md`. Read both before implementation.

Cross-references (do NOT duplicate; integrate):
- `playbook/experience/eleven-star-experience.md` — the star ladder is the target; emotional mechanics are the means. Every card application must map to a star level.
- `playbook/design/quality-lens.md` — "specific to the user's emotional job, not a generic SaaS wrapper."
- `playbook/experience/onboarding-conversion.md` — onboarding is the primary sales surface; card timing relative to paywall and App Review popup is governed here.
- `playbook/data/analytics-attribution.md` — every emotional moment must emit a named PostHog event; the event catalog is extended here, not duplicated.
- `playbook/design/design-room.md` / `playbook/design/design-visual-system.md` — motion is a delight lever; every card-level motion moment must declare a `prefers-reduced-motion` / OS reduce-motion fallback in `DESIGN.md`.
- `playbook/process/failure-cards.md` — dark-pattern violations and missing card attestations become failure cards.
- `playbook/experience/ethics-guardrail.md` — the Guardrail Contract and per-mechanism prohibitions are the compliance boundary for every card applied by this system.
- `playbook/experience/consumer-product-design-agency.md` — the five-tier academic source synthesis; this file operationalizes it.

## Contents

- Principle
- Knowledge Hierarchy
- Experience Card Deck
- Emotional Review Framework
- Producer Protocol
- Auditor Protocol
- Ethics And Dark-Pattern Guardrail
- Required Artifacts
- Integration
- Run Protocol
- Audit Output Contract
- Gates Before Build
- Common Failures

---

## Principle

Functional apps complete tasks. Emotional apps create memories. The difference is not polish — it is deliberate design of anticipation, effort, recognition, and surprise.

Four questions drive this system:

- Where does the user feel something, and is that moment designed or accidental?
- Is the emotional peak placed before or after the paywall?
- Is the session-end moment shaped, or is it just a dismiss tap?
- What does the user tell their friend tomorrow, and which product moment made that sentence possible?

The system does not teach manipulation. Every card has a bright line (serves the user's real goal) and a dark line (extracts value against the user's interest). The dark line is a compliance veto: implementation stops until it is resolved.

The emotional layer is not separate from product, onboarding, and analytics. It is a constraint on how those systems are designed and measured. A card that does not emit a PostHog event does not exist. A card that cannot be verified on a running app — the in-app iOS Simulator (rung 0) is sufficient for a bright-line check such as "is this editable at any time", MobAI or a real device when Android, haptics, thermals, real-network latency, or a repeatable suite are in scope — does not ship.

---

## Knowledge Hierarchy

The system draws on five academic tiers, synthesized in `playbook/experience/consumer-product-design-agency.md`. That file is the source-of-truth for researcher attribution, tier artifacts, and failure modes. Do not duplicate it here; extend the operational layer.

Tier hierarchy for decision-making:

1. **Tier 1 — Human-Centered Design.** (Norman, Nielsen, Miller, Hick, WCAG.) Cognitive load, accessibility, and formative research. Determines onboarding screen count, choices per screen, and contrast/motion safety gates. Failure: onboarding that felt obvious to the team confuses real users.

2. **Tier 2 — Emotional Design.** (Norman visceral/behavioral/reflective, Picard, Cooper, Garrett.) The three Norman levels fire simultaneously from the first frame. `DESIGN.md` must encode a deliberate choice at each level before any screen is built. Failure: the app sits at 5-star because it is functionally correct but emotionally neutral.

3. **Tier 3 — Behavioral Science.** (Fogg B=MAP, Kahneman peak-end rule, Cialdini, Skinner, Schultz, Berridge, Eyal, Ariely, Thaler, Dai fresh-start.) The Four Required Cards are the primary Tier 3 artifacts. Peak-end rule governs session architecture. B=MAP governs onboarding conversion. Failure: Day-7 retention is low not because the loop is broken but because no deliberate peak was designed.

4. **Tier 4 — Service Design.** (Blueprinting, frontstage/backstage, journey mapping, systems thinking.) Maps every onboarding screen to its backstage dependency. Surfaces feedback loops that produce launch failures. Failure: beautiful frontstage, broken backstage; discovered from 1-star reviews, not pre-launch validation.

5. **Tier 5 — Human-Centered AI.** (Stanford HAI, MIT CSAIL, CMU HCII.) Trust calibration, agency, explainability. First AI result sets trust. Agency path (≤2 taps to override) is required for every AI-generated recommendation. Failure: "AI feels like a gimmick" 3-star pattern — a perception gap not visible in crash analytics.

Researcher attribution for every claim used in card design is required. Where a canonical paper exists, name it. Where attribution is uncertain, write `attribution-uncertain: <closest known basis>` rather than inventing a citation.

---

## Experience Card Deck

Twelve cards cover the full behavioral arc from first session through churn recovery. The four named cards are required. The eight additional cards fill temporal, memorial, social, identity, pre-conversion, and failure-state gaps that the named four leave open.

Use this table as a navigation surface. The files under `playbook/experience/experience-cards/` (e.g. `playbook/experience/experience-cards/commitment-card.md`), routed by the index at `playbook/experience/experience-cards.md`, are frozen free-layer stubs — title, one-liner, risk tier, bright/dark lines, and a served-by-MCP pointer. The full card specs — psychological basis, trigger timing, motion spec, guardrail detail, PostHog events, and dark-pattern tests — are served per card by the Retention Mechanics MCP (`retention_get_mechanic`). Load only the cards in scope; the index carries the card shape, summary table, and Ethics Ladder.

When a `retention-mechanics` MCP server is connected, prefer it over loading card files directly: `retention_search_mechanics` routes a product moment to candidate cards without loading the whole deck, and `retention_get_mechanic` / `retention_get_ethics_ladder` serve the maintained, versioned card content and the tier-appropriate attestation scaffold. The bundled deck stays the frozen offline snapshot — validators always read it, and it is authoritative whenever the server is not connected (see the index's live-deck-access note).

| Card | Thesis | 11-Star Level | Bright-Line Guardrail | Stub Pointer (full spec via MCP) |
|---|---|---|---|---|
| **Commitment Card** | A voluntary, user-authored goal statement creates ownership; the product echoes it back throughout the experience, making future behavior self-consistent. (Cialdini commitment/consistency; Locke & Latham goal-setting; Gollwitzer implementation intentions.) | 6–7 star | Commitment must be user-authored, revisable from settings at any time, and used only to serve the stated goal — not to guilt-trigger re-subscription. | `experience-cards/commitment-card.md` |
| **Variable Reward Card** | Unpredictable, genuine variability in outcome produces stronger and more persistent approach behavior than fixed rewards. Dopamine fires on anticipation, not receipt. (Skinner variable-ratio; Schultz 1997; Berridge wanting-vs-liking; Eyal Hook Model.) | 6–7 star | Reward variability must be real in content (≥30% observable difference or documented convergence proof in `PRODUCTION_READINESS.md`); must not gate already-paid features; must have a non-variable fallback. | `experience-cards/variable-reward-card.md` |
| **Perceived Effort Delay Card** | Users value outcomes more when they can see effort expended on their behalf. Participation in creation inflates perceived value further. (Buell & Norton labor illusion 2011; Norton-Mochon-Ariely IKEA effect 2012; Kahneman peak-end rule.) | 6–7 star | ≥50% of displayed steps must map to real computation; map documented in `TECH_SPEC.md`. No stage may claim a data source the app does not access. Delay ≤800ms with a single honest label if computation is cached. | `experience-cards/perceived-effort-delay-card.md` |
| **Intent Mirroring Card** | A deliberate pause that reflects the user's stated intent back to them — using their own words — turns a tap into a meaningful moment and elevates perceived product trustworthiness. (Gollwitzer implementation intentions; Kahneman-Fredrickson peak-end; Norman reflective design; Picard affective computing.) | 7 star | Must use user-authored phrase from committed goal or last session action. Must not appear on the same screen as a paywall CTA. Dismissable in ≤1 tap. ≤once per session. | `experience-cards/intent-mirroring-card.md` |
| **Endowed Progress Card** | Showing users they have already made progress before they begin raises completion rate significantly. The illusion of a head start lowers the psychological cost of starting. (Kivetz, Urminsky & Zheng goal-gradient hypothesis and endowed progress effect, _Journal of Marketing Research_ 2006.) | 6 star | Progress shown must reflect real onboarding inputs or real prior actions, not fabricated completions. No fake stamps or pre-filled loyalty cards. | `experience-cards/endowed-progress-card.md` |
| **Peak-End Card** | Memory of an experience is dominated by its emotional peak and its final moment — not its duration or average quality. Designing both shapes what the user remembers and retells. (Kahneman & Fredrickson _Psychological Science_ 1993.) | 6–7 star | Peak must be a real product outcome, not a manufactured celebration. End moment must not be a paywall decline or an error state. | `emotional-experience-design.md §Peak-End Card` |
| **Streak And Loss Aversion Card** | A maintained streak becomes a possession; losing it triggers loss aversion, which motivates return. Streaks are high-leverage for daily-return products. (Kahneman & Tversky prospect theory; Thaler endowment effect; Eyal Hook Model investment phase.) | 6 star | Streak loss must be real (not a countdown that resets). Spend prompt must never appear on a streak-break screen. Streak freeze / skip features are required at meaningful lengths (≥7 days) to prevent anxiety-driven churn. | `experience-cards/streak-and-loss-aversion-card.md` |
| **Reciprocity Card** | An unexpected gift before a purchase request lowers psychological purchase resistance. The gift must be genuine value, not a teaser designed to create artificial scarcity. (Cialdini reciprocity, _Influence_ 1984.) | 6 star | Gift must be real, unconditional value the user can keep regardless of purchase decision. No gift that disappears after the paywall is dismissed. No fake countdown on the gift offer. | `experience-cards/reciprocity-card.md` |
| **Identity And Self-Expression Card** | When users express preferences, customize a surface, or choose a persona, the product becomes part of their self-concept. Abandoning it then feels like self-contradiction. (Cialdini consistency; Norman reflective design; Cooper goal-directed design.) | 7–10 star | Customization must be real (genuinely changes product behavior or appearance). Must not lock expression behind a paywall that is shown before the user has experienced the value. | `emotional-experience-design.md §Identity And Self-Expression Card` |
| **Fresh Start Card** | Temporal landmarks (new week, new month, post-milestone) lower the psychological cost of re-entry after a lapse. A "fresh start" frame re-activates dormant users without manufacturing guilt. (Hengchen Dai fresh-start effect; Cialdini commitment/consistency for re-entry framing.) | 6 star | Re-engagement copy must reference a real temporal landmark or a real user milestone, not a fabricated urgency trigger. Must not imply the user has lost progress they have not lost. | `experience-cards/fresh-start-card.md` |
| **Mastery And Status Card** | Visible skill progression and earned-tier indicators provide the intrinsic motivation layer (competence, visible achievement) that sustains engagement after extrinsic novelty fades. (Deci & Ryan self-determination theory; Cooper goal-directed design.) | 7 star | Status must be earned through real product behavior, not purchased or inflated. Level labels must be calibrated so early levels are achievable, preventing the "forever beginner" drop-off. | `experience-cards/mastery-and-status-card.md` |
| **Recovery And Trust Repair Card** | Failure states (errors, crashes, failed payments, lapsed streaks) are where trust is won or destroyed permanently. A thoughtful, honest recovery message converts a negative peak into a trust-building moment. (Kahneman-Fredrickson peak-end; Norman reflective design.) | 6–7 star | Recovery copy must not manufacture guilt. It must state what happened honestly and offer a clear, single next action. Spend prompts are prohibited on recovery screens. | `experience-cards/recovery-and-trust-repair-card.md` |

**Deck coverage rationale.** The four required cards (Commitment, Variable Reward, Perceived Effort Delay, Intent Mirroring) are strongest at 6-star and 7-star and operate primarily within a single session or the onboarding funnel. The eight additional cards fill five gaps: temporal momentum and return-visit drive (Endowed Progress, Streak and Loss Aversion, Fresh Start); memory and word-of-mouth formation (Peak-End); intrinsic and social motivation (Mastery and Status); identity anchoring (Identity and Self-Expression); and pre-conversion motivation and failure resilience (Reciprocity, Recovery and Trust Repair). No card in the deck duplicates another's mechanism.

---

## Emotional Review Framework

Use this framework on any feature, screen, or user journey before committing to build. Run it on the running app when auditing an existing app: the in-app iOS Simulator (rung 0) pre-walks a journey quickly, while the audit of record needs a real device via MobAI, because haptics, thermals, and real-network latency drive the emotional read. Run it on rendered HTML proofs when auditing a spec in progress.

Score each lens 0–2 (0 = absent or harmful, 1 = present but weak, 2 = deliberate and strong). Total out of 12. Score ≥9 = build-ready. Score <7 = redesign before build. Score 7–8 = proceed with named blockers tracked as failure cards.

### Lens 1 — Human Goal And JTBD

Does this feature serve the job the user actually hired the app to do? Not what the feature does, but what the user was trying to accomplish in their life. State the JTBD in one sentence using the form: "When [situation], I want to [motivation], so I can [expected outcome]." If the team cannot agree on the JTBD sentence, score 0 and do not proceed.

Evidence required: `SPEC.md` JTBD statement or `11_STAR_EXPERIENCE.md` user scene for the relevant star level.

### Lens 2 — Emotional Goal

What emotion should the user feel during and after this interaction? Name it specifically (confidence, relief, surprise, pride, curiosity, belonging). A feature that produces no deliberate emotion produces no memory. A feature that produces the wrong emotion (anxiety, confusion, guilt) damages trust.

Evidence required: the `DESIGN.md` three-level emotional tone block (visceral/behavioral/reflective) for this screen or feature cluster.

### Lens 3 — Emotional Journey

Map the emotional arc across the session or flow: entry state → trigger → build → peak → resolve → exit state. Identify the peak explicitly. The peak must occur before the paywall, not after. The exit state must not be a paywall decline.

Evidence required: the Emotional Curve artifact (see below) plotted for this flow.

### Lens 4 — Behavioral Analysis (Fogg B=MAP)

At the moment you want the user to act, is Motivation high enough, Ability low enough (friction minimized), and Prompt timed correctly? Identify which factor is weakest. Score 2 only if all three are deliberately designed, not assumed.

Evidence required: the B=MAP audit row in `ONBOARDING.md` for onboarding features; the equivalent note in `SPEC.md` for core-loop features.

### Lens 5 — Experience Quality (Norman's Three Levels)

Does the feature work at all three Norman levels simultaneously?
- Visceral: does it look and feel right on first sight? (palette, motion, typography)
- Behavioral: does it do what the user expects with minimal friction? (affordances, signifiers, CTA copy)
- Reflective: does it make the user feel something about themselves? (goal language, identity, memory)

Score 0 if any level is absent or actively harmful. Score 2 only if all three are deliberate.

Evidence required: the three-level tone block in `DESIGN.md` and signifier audit in `ONBOARDING.md`.

### Lens 6 — Service Design

Is every frontstage moment backed by a verified backstage dependency? Name the API, entitlement state, analytics event, and permission required for this feature. A frontstage/backstage table gap is a known launch risk, not a cosmetic issue.

Evidence required: the frontstage/backstage dependency table in `TECH_SPEC.md` for this screen or feature.

### Emotional Curve Artifact

The Emotional Curve is a required output of the Emotional Review Framework. It is a plot of emotional intensity over the session or flow, derived from the Lens 3 journey table.

Requirements:
- Plot it in `emotional-design.html` using the project's design tokens (`--motion-*`, `DesignTokens.Motion`).
- The curve must peak at or before the paywall marker. This is a deterministic validator rule: a curve that peaks after the paywall fails the audit.
- Mark the positions of each applied Experience Card on the curve.
- Mark the App Review popup position (must be at or after the peak, per `onboarding-conversion.md`).
- Include a reduced-motion fallback (flat curve with labeled milestones) for `prefers-reduced-motion` contexts.

Validator phrase: `Emotional Curve` must appear in `EMOTIONAL_DESIGN.md`. The paywall marker and peak position must be documented in that file as machine-checkable values.

---

## Producer Protocol

Use this when the task is to charge a feature with emotion ("turn this feature into an emotional experience", "charge this feature", "apply the X card to this flow").

This protocol produces `EMOTIONAL_DESIGN.md` updates, card applications, measurement events, and an ethics attestation. It does not produce a separate report — it updates existing artifacts.

### Ordered Steps

1. **Load context.** Read `eleven-star-experience.md`, `analytics-attribution.md`, `onboarding-conversion.md`, and `design-visual-system.md` if not already loaded. Read `SPEC.md` and `ONBOARDING.md` for the target feature.

2. **Name the JTBD.** Write one JTBD sentence for the feature being charged. If it does not exist in `SPEC.md`, add it before proceeding.

3. **Run the Emotional Review Framework.** Score all six lenses for the current state of the feature. Record the score in `EMOTIONAL_DESIGN.md §Review Scores`. A score ≥9 means the feature is already charged; audit and document rather than redesign.

4. **Select cards.** From the twelve-card deck, identify which cards apply to this feature and at which moments. The four required cards (Commitment, Variable Reward, Perceived Effort Delay, Intent Mirroring) are always evaluated — mark them not-applicable with a reason if genuinely inapplicable. Justify each selected additional card with a JTBD-level reason, not a "would be cool" reason.

5. **Design the Emotional Curve.** Map the entry state, build, peak, resolve, and exit state for the flow. Verify the peak falls before the paywall. Render the curve in `emotional-design.html`.

6. **Write card applications.** For each selected card, write the application block in `EMOTIONAL_DESIGN.md`:
   - trigger moment (screen name, state, user action)
   - copy or interaction spec (≤3 sentences; use the user's goal language, not generic copy)
   - motion spec (design token reference; `prefers-reduced-motion` fallback)
   - PostHog event(s) from `emotional-experience-measurement.md` for this card
   - bright-line attestation (one sentence confirming it serves the user's real goal)
   - dark-line check (one sentence confirming no forbidden pattern is present)

7. **Update `ANALYTICS.md`.** Add the card-specific PostHog events to the event catalog. Do not reuse existing event names — extend them per the naming rules in `analytics-attribution.md`.

8. **Update `DESIGN.md`.** Add the three-level emotional tone block for this feature if absent. Add the motion spec for each card's delight moment with a reduce-motion fallback.

9. **Update `TECH_SPEC.md`.** Add the frontstage/backstage dependency table row for each card-carrying screen.

10. **Write the ethics attestation.** For each applied card, write the attestation block required by `ethics-guardrail.md §Guardrail Contract`. Run `npm run check:emotional-design -- --root .` and fix all errors before proceeding.

11. **Run the validator.** `npm run check:emotional-design -- --root .` must pass before claiming any card is applied.

12. **Update `PRODUCTION_READINESS.md`.** Add the card application as an evidence row. Mark it `pending verification` until a running-app audit — in-app iOS Simulator (rung 0) or MobAI — confirms the behavior on the device class the card targets.

**Output.** The producer protocol modifies existing artifacts, does not create new standalone documents. The one exception is the first run: create `EMOTIONAL_DESIGN.md` from the template if it does not exist.

---

## Auditor Protocol

Use this when the task is to audit an existing app's emotional design ("audit this app's emotional design", "score this flow", "find where we're leaving emotional value on the table").

This protocol runs against the live app, scores each screen against the Emotional Review Framework, and produces `EMOTIONAL_AUDIT.md` with a pathway to a better state. The in-app iOS Simulator (rung 0) is the fast way to pre-walk a journey and draft the step list, but it does not satisfy `EMOTIONAL_AUDIT.md`'s real-device checkbox: haptics, thermal behavior, and real-network latency are exactly the inputs a simulator cannot reproduce, and they are what the emotional read depends on. Use MobAI or a real device for the audit of record.

### Ordered Steps

1. **Load context.** Read `eleven-star-experience.md`, `emotional-experience-design.md`, `mobai-toolbelt.md`, and `ethics-guardrail.md`. Read the existing `11_STAR_EXPERIENCE.md` and `EMOTIONAL_DESIGN.md` if present.

2. **List screens.** On rung 0, ask the runtime to run the app in the simulator and read the screen; on MobAI, read the active MCP resources or current CLI help and use the exposed app/device/bridge route. Navigate each screen in the primary journey (onboarding → first value → paywall → core loop → re-engagement). Use the route's screenshot tool — the pane's capture shortcut, the Codex screenshot tool, or the `mobai screenshot` form from live help — to capture each state. Do not pre-choreograph multi-step chains without per-step screen verification; that applies to a rung-0 tap sequence exactly as it does to a MobAI DSL block (see `mobai-onboarding-chain-unverified` failure card).

3. **Score each screen.** Apply the six-lens framework to each captured screen. Record: lens scores, which cards are present / missing / misused, the emotional curve impact of this screen, and any dark-pattern signals.

4. **Plot the actual Emotional Curve.** Map the screen sequence to an emotional intensity estimate. Identify the actual peak. Compare it to the expected peak position from `11_STAR_EXPERIENCE.md`. If the actual peak is after the paywall, flag a critical finding.

5. **Write findings.** Each finding follows the Audit Output Contract (see below). Do not write findings as narrative prose.

6. **Generate pathways to better state.** For each finding rated score 0 or 1 on any lens, write a specific recommendation that applies one or more cards from the deck. Include the card name, the trigger moment, the copy sketch, and the PostHog event that would measure the change.

7. **Open failure cards.** For any finding where a dark-pattern flag is YES, open a failure card in `FAILURE_CARDS.md` using the shape from `failure-cards.md`. For any finding where a required card is missing on a key screen, open a failure card with severity `high`.

8. **Update `PROJECT_STATE.yaml`.** Add the audit result to `lanes.emotional_design.evidence` with a path to `EMOTIONAL_AUDIT.md` and the overall score (total / 12 per screen, median across the primary journey).

9. **Run `npm run check:emotional-design -- --root .`.** Record any validator errors as additional failure cards. Do not mark the audit complete until the validator is run.

**Output.** `EMOTIONAL_AUDIT.md`, updated `FAILURE_CARDS.md`, updated `PROJECT_STATE.yaml`.

---

## Ethics And Dark-Pattern Guardrail

This section is a compliance surface. The full policy, regulatory basis, and per-mechanism prohibitions live in `playbook/experience/ethics-guardrail.md`. Do not duplicate that file — integrate it.

### Bright-Line Vs Dark-Line

Every card application must pass the three-question operational test:

1. **Goal alignment.** Does this mechanism help the user move toward the goal they stated or implied when they opened the app?
2. **Truthfulness.** Is every element of this mechanism (copy, progress label, reward, social proof, scarcity signal) factually accurate and verifiable?
3. **Informed exit.** Can the user exit this mechanism, pause it, or opt out without penalty to already-earned value?

All three must be YES. Any NO is a compliance veto. Implementation stops.

### Hard Gates (Unconditional Vetoes)

The following are never permitted regardless of A/B test results, conversion uplift, or founder request. Each is a compliance veto enforced by `check:emotional-design`:

- Fake scarcity: countdown timers that reset on reload; user counts that are fabricated or inflated.
- Fake social proof: activity notifications that are synthetic ("Sarah just signed up") without real-time data backing.
- Fake effort: progress stages that do not map to real computation; arbitrary sleep delays presented as analysis.
- Spend prompt inside a grief screen: any purchase CTA adjacent to a streak-break, payment failure, error, or loss-of-progress message.
- Confirmshaming: opt-out labels designed to induce shame ("No thanks, I don't want to improve" style).
- Ratings outside the native API: custom pre-screening ("Would you rate us 5 stars?" before showing the native sheet).
- Pre-ticked subscription boxes: any subscription pre-selected on any screen.
- Hidden subscription terms: any paywall where the renewal price, renewal date, or cancellation path is not visible before purchase.

### Regulatory Basis

Summarized from `playbook/experience/ethics-guardrail.md §2`:
- **FTC Act §5** and FTC "Bringing Dark Patterns to Light" (Sept 2022): deceptive design practices are unfair or deceptive acts.
- **FTC Click-to-Cancel Rule** (Oct 2024, 16 CFR Part 425): cancellation must be as easy as subscription.
- **EU DSA Art. 25**: deceptive or manipulative techniques that distort autonomous decision-making are prohibited.
- **Apple App Store Review Guidelines §4.0**: exploiting emotions is grounds for rejection.
- **Google Play Deceptive Behavior policy**: misleading behavior, false information, or violations of user trust are policy violations.

For full regulatory detail, per-card risk tables, and the Guardrail Contract attestation block shape, see `playbook/experience/ethics-guardrail.md`.

---

## Required Artifacts

Create or update before calling the emotional layer build-ready:

- `EMOTIONAL_DESIGN.md`: the applied card deck for this product. Sections: Review Scores, Card Applications (one block per applied card), Emotional Curve (text representation; rendered in `emotional-design.html`), Ethics Attestations.
- `emotional-design.html`: rendered Emotional Curve using design tokens; position markers for each card, paywall, and App Review popup.
- `ANALYTICS.md`: card-specific PostHog events added to the event catalog.
- `DESIGN.md`: three-level emotional tone block; motion spec per card with reduce-motion fallback.
- `TECH_SPEC.md`: frontstage/backstage dependency table for each card-carrying screen.
- `PRODUCTION_READINESS.md`: card application evidence rows; real-device verification status.
- `FAILURE_CARDS.md` (or `PROJECT_STATE.yaml`): open cards for any dark-pattern findings, missing cards on key screens, or validator errors.

Update `PROJECT_STATE.yaml`:

```yaml
lanes:
  emotional_design:
    status: "partial"
    evidence:
      - "EMOTIONAL_DESIGN.md"
      - "emotional-design.html"
    blockers: []
```

---

## Integration

### Eleven-Star Experience (`eleven-star-experience.md`)

Every card application must reference a star level in `11_STAR_EXPERIENCE.md`. The mapping rule:
- 5-star: no card applied; the feature works but creates no emotional memory.
- 6-star (better than expected): Commitment, Variable Reward, Perceived Effort Delay, Endowed Progress, Streak, Reciprocity, Fresh Start, Recovery cards elevate to this level.
- 7-star (made for me): Intent Mirroring, Identity and Self-Expression, Mastery and Status, Peak-End cards operate primarily at this level.
- 10–11 star: inspiration reference only; no cards operate here by default.

The Emotional Review Framework score (Lens 3 — Emotional Journey) maps directly to the star level achieved by the feature.

### Quality Lens (`quality-lens.md`)

The anti-generic check from `quality-lens.md` applies to every card application: the card implementation must use the product's actual nouns, verbs, and the user's own words — not generic "keep going!" copy. The Reflective Norman level is where "specific to the user's emotional job" is tested. A card that passes the bright-line test but uses generic copy is at 5-star, not 6.

### Onboarding Conversion (`onboarding-conversion.md`)

Card timing relative to the paywall and App Review popup is governed by `onboarding-conversion.md`. Required timings:
- **Commitment Card**: during onboarding, at the first personalization question. Echo appears before the paywall.
- **Perceived Effort Delay Card**: at the personalized plan reveal, before the paywall.
- **Intent Mirroring Card**: after first value or at session end. Must not appear on the same screen as a paywall CTA.
- **App Review popup**: immediately after the first value moment (the peak of the Emotional Curve), with a 1–2 second async delay after the screen mounts. Must not be bound to a tap that dismisses the screen.
- **Paywall**: shown after the Emotional Curve peak, not before.

### Analytics Attribution (`analytics-attribution.md`)

Every card emits PostHog events. The events are named and specified in `emotional-experience-measurement.md`. Integration rules:
- Add events to `ANALYTICS.md` before implementation.
- Do not reuse existing event names; extend the catalog.
- Use `snake_case` event names consistent with the catalog.
- System-level envelope events (`emotion_card_fired`, `emotion_card_completed`, `emotion_card_abandoned`, `emotion_card_opt_out`) fire for every card activation and feed the Dark-Pattern Watch dashboard.
- Peak-end event pair (Variable Reward reveal = peak; Intent Mirror or last core action = end) feeds the north-star retention dashboard.

### Design Room And Visual System (`design-room.md`, `design-visual-system.md`)

Motion is a delight lever, not decoration. Rules:
- Every card-level delight moment must reference a named `DesignTokens.Motion` token (for SwiftUI / Flutter / Reanimated native targets) or a `--motion-*` CSS variable (for web).
- Every motion moment must declare a `prefers-reduced-motion` / OS reduce-motion fallback in `DESIGN.md`.
- The Emotional Curve rendered in `emotional-design.html` uses the project's motion tokens for its own animation.
- Generated or token-derived motion proofs must live in `emotional-design.html`, not in a standalone mood board.

### Failure Cards (`failure-cards.md`)

Card-level failure shapes to open when violations are found:

| ID | Trigger | Required Fix |
|---|---|---|
| `emotional-card-missing-on-key-screen` | A required card (Commitment, Variable Reward, Perceived Effort Delay, Intent Mirroring) is absent on a screen that would benefit from it according to the JTBD and star-level target | Apply the card per the Producer Protocol; add PostHog event to `ANALYTICS.md`; run `check:emotional-design` |
| `emotional-card-dark-line-crossed` | Any applied card fails the three-question bright-line test or uses a prohibited pattern from `ethics-guardrail.md §Non-Negotiable Prohibitions` | Stop implementation; remove or redesign the mechanism; run `check:emotional-design`; open as severity critical |
| `emotional-curve-peaks-after-paywall` | The Emotional Curve plot in `EMOTIONAL_DESIGN.md` or `emotional-design.html` shows the emotional peak occurring after the paywall marker | Redesign the flow so the peak occurs before the paywall; re-render `emotional-design.html` |
| `emotional-card-no-posthog-event` | A card is applied in `EMOTIONAL_DESIGN.md` but no corresponding event exists in `ANALYTICS.md` | Add the event to `ANALYTICS.md` before implementation; verify with `check:attribution` |
| `emotional-card-motion-no-fallback` | A card's motion moment is specified in `DESIGN.md` without a `prefers-reduced-motion` fallback | Add the fallback; re-run `check:token-promotion` |
| `emotional-audit-unintegrated` | An audit (`EMOTIONAL_AUDIT.md`) exists but findings have not been converted to failure cards or `PROJECT_STATE.yaml` updates | Accept or reject each finding; open failure cards; update `PROJECT_STATE.yaml` |

---

## Run Protocol

When the founder says "turn this feature into an emotional experience", "charge this feature", "audit this app's emotional design", "score this flow", or "apply the X card", the first output must be a written or updated `EMOTIONAL_DESIGN.md`. Do not begin code changes, subagent audits, or implementation before `EMOTIONAL_DESIGN.md` is created or updated. This is a hard ordered sequence, not a preference.

**Trigger phrases that invoke the Producer Protocol:**
- "turn this feature into an emotional experience"
- "charge this feature"
- "apply the [card name] card"
- "add [card name] to [flow]"
- any equivalent instruction to add emotional design to a new or existing feature

**Trigger phrases that invoke the Auditor Protocol:**
- "audit this app's emotional design"
- "score this flow"
- "find where we're leaving emotional value on the table"
- "do an emotional design pass"
- any equivalent instruction to evaluate existing emotional design

**Hard ordered output sequence for a Producer run:**

1. Create or update `EMOTIONAL_DESIGN.md` with the card applications, Emotional Curve, and ethics attestations.
2. Update `ANALYTICS.md` with the new PostHog events.
3. Update `DESIGN.md` with the three-level tone block and motion spec.
4. Update `TECH_SPEC.md` with the frontstage/backstage dependency rows.
5. Render or update `emotional-design.html` with the Emotional Curve.
6. Run `npm run check:emotional-design -- --root .`. Fix all errors before continuing.
7. Update `PRODUCTION_READINESS.md` evidence rows.
8. Update `PROJECT_STATE.yaml` `lanes.emotional_design`.
9. Only after the above eight steps: proceed to implementation changes or subagent build work.

**Hard ordered output sequence for an Auditor run:**

1. Attach to the running app. Rung 0 (the in-app iOS Simulator) is fine for drafting the step list; the audit of record attaches to a real device via MobAI. Capture screenshots of every screen in the primary journey.
2. Score each screen against the six-lens framework.
3. Plot the actual Emotional Curve and compare to the target from `11_STAR_EXPERIENCE.md`.
4. Write findings per the Audit Output Contract (see below).
5. Open failure cards for all critical and high findings.
6. Update `PROJECT_STATE.yaml`.
7. Run `npm run check:emotional-design -- --root .`.

If the founder asks for both "charge this feature" and "make your changes" in a single turn, produce `EMOTIONAL_DESIGN.md` and pass the validators first, then apply implementation changes using the card applications as the governing constraint.

---

## Audit Output Contract

When an auditor subagent or the Auditor Protocol produces findings, each finding must include all of the following. Findings missing any field are incomplete and must be rejected by the orchestrator.

| Field | Required Content |
|---|---|
| `journey_step` | The specific screen name and position in the primary journey (e.g. "Onboarding step 3 — Goal selection") |
| `cards_involved` | Which card(s) from the deck are present, missing, or misused at this step |
| `present_missing_misused` | One of: `present` (correctly applied), `missing` (applicable but absent), `misused` (present but crosses a dark line or is weakly implemented) |
| `emotional_curve_impact` | How this screen's state affects the Emotional Curve: raises, lowers, or disrupts the arc; approximate intensity score 0–10 |
| `dark_pattern_flag` | `yes` or `no`; if yes, name the specific prohibited pattern from `ethics-guardrail.md §Non-Negotiable Prohibitions` |
| `measurement_event` | The PostHog event that would measure improvement at this step; must be present in or added to `ANALYTICS.md` |
| `recommendation` | The specific card application or design change recommended; include trigger moment, copy sketch, and motion token |
| `pathway_to_better_state` | The ordered steps to move this screen from its current star level to the target star level in `11_STAR_EXPERIENCE.md`; include which card to apply first and what artifact to update |
| `star_level_current` | The star level (1–11) this screen currently achieves, mapped to `11_STAR_EXPERIENCE.md` |
| `star_level_target` | The star level the screen should reach with the recommended change |
| `failure_card_flag` | `open failure card: yes/no` with reason; if yes, include the draft card shape from `failure-cards.md` |

---

## Gates Before Build

Do not move to engineering handoff for any feature with an emotional design component until:

- `EMOTIONAL_DESIGN.md` exists with card applications for the feature.
- The Emotional Curve is plotted and the peak falls before the paywall marker.
- Every applied card has a bright-line attestation (three-question test answered YES) in `EMOTIONAL_DESIGN.md`.
- Every applied card has a PostHog event in `ANALYTICS.md`.
- Every card-level motion moment has a `prefers-reduced-motion` fallback in `DESIGN.md`.
- Every card-carrying screen has a frontstage/backstage row in `TECH_SPEC.md`.
- All four required cards (Commitment, Variable Reward, Perceived Effort Delay, Intent Mirroring) are either applied or explicitly marked not-applicable with a reason in `EMOTIONAL_DESIGN.md`.
- No dark-pattern flag is open in `FAILURE_CARDS.md` for this feature.
- `npm run check:emotional-design -- --root .` passes.
- `PROJECT_STATE.yaml` `lanes.emotional_design` status is `done` or `partial` with named blockers.

---

## Common Failures

- The "emotional design" pass produces only copy changes (warmer button labels) without engaging any card mechanism. The result is 5-star with nicer words.
- Cards are named in `SPEC.md` but not specified: no trigger moment, no copy sketch, no PostHog event. Unnamed implementations are unmeasurable and untestable.
- The Emotional Curve is described in prose but not rendered in `emotional-design.html`. The paywall-marker rule cannot be validated from prose.
- The Perceived Effort Delay stage labels are written for marketing impact, not accuracy. Fabricated labels ("Analyzing 47 data points…" for a cached lookup) are a compliance veto, not a copy problem.
- Variable Reward motion is specced but has no reduce-motion fallback. Accessibility is a launch gate, not a polish task.
- The Intent Mirroring Card copy uses generic filler ("Great job on your session!") rather than the user's own words from the Commitment Card. This is a 5-star implementation labeled as 7-star.
- The Emotional Curve peaks after the paywall. Conversion suffers because the user's highest-engagement moment is locked behind a purchase gate rather than creating the motivation to purchase.
- Cards are applied to success paths only. Failure states (errors, lapsed streaks, payment failures) receive no card — producing negative peaks that dominate the user's memory per the peak-end rule.
- The audit produces narrative findings with no `journey_step`, `star_level_current`, or `pathway_to_better_state`. Findings that cannot be integrated into the experience contract are wasted effort.
- `check:emotional-design` is never run during the producer or auditor session. Known validation gaps accumulate invisibly and block the next agent.
- The ethics attestation blocks in `EMOTIONAL_DESIGN.md` are filled with "N/A" or empty strings. Empty attestations are not compliant; they are the same as no attestation.
- An auditor chains 6+ onboarding steps in a single MobAI DSL block without per-step screen verification. Navigation silently stalls on the wrong screen and the audit findings are invalid. Follow the Onboarding-Flow Navigation Pattern in `mobai-toolbelt.md`.
