# Variant — Simple Counter / Tracker Utility

Apply *instead of* growing the base — this variant **strips, not adds**. For a single-purpose tracker (water intake, days-since-X, pushups, "did I take my meds"), most of the pack is overproduction. Pair it with `launch_scope: lite` in `state/PROJECT_STATE.yaml`: one tracked thing, one screen, shipped fast to learn.

```
Strip the habit app down to a single-purpose counter/tracker utility.

Keep:
- Auth (prompt 02) with timezone capture — the local day boundary still matters
- One tracked item per user (or a small fixed set defined by the product, e.g.
  "water"), created automatically at first run — no habit editor, no habit list
- The one-tap log interaction from prompt 03 on a single screen, with
  optimistic UI and undo; support count-per-day if the use case needs it
  (e.g. 8 glasses) via a target on the tracked item
- The local-date data model and unique-per-day (or per-day count) constraints
  from prompt 01, with owner-only RLS unchanged
- One optional daily reminder (prompt 04), same no-guilt copy rules

Cut:
- Multiple habits, cadence options, archive, sort order
- Social accountability (prompt 07), programs, weekly review
- Streak mechanics by default: show a simple total and a 30-day mini-history
  instead. If the founder explicitly wants a streak, it carries the full
  prompt 03/04 ethics contract (free recovery, no guilt copy) — a essentials scope
  does not waive it

The result should be one screen a user can open, tap, and close in three
seconds. Resist re-adding features; the speed IS the product.

Strings: every user-facing label, headline, button, empty state, and error
comes from product/copy/COPY_DECK.md (author missing rows first — voice from product/copy/COPY_BRIEF.md,
craft from knowledge/words/conversion-copy.md), typed via the externalized resource
named in engineering/TECH_SPEC.md. Example copy in this prompt is voice guidance, not
shipping strings.
```

## Skill-integration notes

- This is the `launch_scope: lite` shape (`launch-phases.md`): defer breadth lanes with dated reasons in `state/PROJECT_STATE.yaml`, but remember the never-deferred set — revenue (if it charges), privacy/legal, security (RLS still tested), signing, and store lanes still apply in full.
- Dropping streaks by default removes the HIGH-risk card and its attestation burden — the main reason this variant ships faster. Re-adding a streak re-adds the full `ethics-guardrail.md` contract; the tier does not waive ethics.
- Timezone-correct local dates still matter (a water counter that resets at the wrong midnight is broken), so prompts 01/02's day model survives the strip.
- A utility this small is a strong one-time-purchase or low-friction-paywall candidate rather than a subscription — surface the `revenue-monetization.md` trade-offs and let the founder decide; do not default to a subscription out of habit.
- Keep `habit_checked_in` (or a `counter_logged` alias mapped in `analytics/ANALYTICS.md`) plus `reminder_sent` — even a lite launch needs its activation funnel measured.
