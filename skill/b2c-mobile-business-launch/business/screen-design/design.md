# Screen Design Spec

This starter records the screen-level product design contract. Keep `DESIGN.md`
as the visual-system source of truth, then use this file to map approved
screens, states, and implementation details back to that system.

## Sources

- Visual system: `DESIGN.md`
- Product spec: `SPEC.md`
- Onboarding contract: `ONBOARDING.md`
- UX pattern packet: `UX_PATTERNS.md`
- Store screenshot packet: `SCREENSHOTS.md`

## Screen Inventory

| Screen | Job | Primary action | Secondary action | Motion + reduced-motion | Evidence | Status |
|---|---|---|---|---|---|---|
| Onboarding door | State the product promise and route into the first useful action. | Pending | Pending | Pending (`motion.*` token + reduced-motion fallback) | Pending mock or production screen | draft |
| Personalization step | Capture one high-signal preference without branching noise. | Pending | Back or skip when allowed | Pending (`motion.*` token + reduced-motion fallback) | Pending mock or production screen | draft |
| Permission explainer | Explain why access is needed before the native prompt. | Pending | Manual fallback | Pending (`motion.*` token + reduced-motion fallback) | Pending mock or production screen | draft |
| Paywall | Connect the paid unlock to the completed setup or preview. | Pending | Restore or close when allowed | Pending (`motion.*` token + reduced-motion fallback) | Pending mock or production screen | draft |
| Result or home | Deliver the first saved artifact, plan, or proof loop. | Pending | Share, save, or reminder | Pending (`motion.*` token + reduced-motion fallback) | Pending mock or production screen | draft |

## State Matrix

| Surface | Empty | Loading | Success | Error | Offline | Analytics |
|---|---|---|---|---|---|---|
| Onboarding | Pending | Pending | Pending | Pending | Pending | `onboarding_step_viewed`, `onboarding_answer_selected` |
| Paywall | Pending | Pending | Pending | Pending | Pending | `paywall_viewed`, `purchase_started`, `restore_started` |
| Result | Pending | Pending | Pending | Pending | Pending | Pending |

## Implementation Notes

- Keep copy, spacing, components, and motion tied to `DESIGN.md`. Motion durations/easing
  come from the `motion.*` tokens: web surfaces animate with framer-motion / `motion`; the
  mobile binary uses native animation from `DesignTokens.Motion`. Never import framer-motion
  into the SwiftUI/Flutter app.
- Record approved mock paths, generated assets, or production screenshots for
  every user-facing screen before implementation handoff.
- Document native permission timing, fallback routes, persistence keys, and
  analytics events on the affected screen row.
- Separate raw production screenshots from composed App Store screenshots in
  `SCREENSHOTS.md`.

## Acceptance Checklist

- [ ] Every screen has one dominant user action.
- [ ] Every permission screen has a pre-permission explanation and fallback.
- [ ] Every paid screen names the entitlement, restore path, and close behavior.
- [ ] Every approved mock maps to an implementation surface and analytics event.
- [ ] Every screen names its entrance/transition motion and reduced-motion fallback, tied to the `motion.*` tokens.
- [ ] Mobile screenshots have no clipped text, overlap, or unreadable controls.
