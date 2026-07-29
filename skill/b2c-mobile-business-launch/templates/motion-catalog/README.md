# Motion Catalog — Runnable Choreography Exemplars

Full-screen choreography templates that bind the recipes in
[`references/motion-craft-benchmarks.md`](../../references/motion-craft-benchmarks.md)
to the shipped token scale as compilable code. The 2026-07-28 live output test
showed builders drift whenever a rule exists only as prose; this pack is the
code half of that contract — copy a file, swap the placeholder content, keep
the physics.

## Files

| File | Lane | What it teaches |
| --- | --- | --- |
| `TokenSpring.swift` | native | Closed-form evaluation of the PremiumMotion presets for procedural scenes, plus `TokenEase.emphasis` and the declarative `Animation.emphasized(duration:)` bridge for `easingEmphasis`. |
| `MotionLabTheme.swift` | native | The one-page binding layer from `DesignTokens` hex strings to SwiftUI `Color`/`Font` values the demos read. Merge into the app's own theme layer. |
| `DemoCardReveal.swift` | native | Declarative mode: a six-beat unboxing (word cascade → materialize → 3D flip → flap unfold → hero card → CTA reflow) where every beat is a `withAnimation(PremiumMotion.*)`. Serves R3, R4, R8, R10. |
| `DemoSphereCloud.swift` | native | Procedural mode: a 30-card 3D content cloud (burst → orbit → camera dive → hero landing) in `TimelineView` + `Canvas`, every curve evaluated through `TokenSpring`. Serves R2's stagger rule, R3, R5's shared-clock rule, R7, R8. |
| `motion-tokens.ts` | web/video | The same presets as Remotion spring physics for token-true previews, App Store preview loops, and brand reels. `TokenSpring.swift`'s twin — one formula, both platforms. |

## Picking a mode

- **Declarative runner** (`DemoCardReveal`): one focal object, a fixed beat
  order, each beat a `withAnimation` on a preset. Reach for it first.
- **Procedural scene** (`DemoSphereCloud`): dozens of elements sharing one 3D
  scene, per-element springs, a camera. `TimelineView` + `Canvas` with
  `TokenSpring` keeps the curves identical to the declarative mode.

Both demos take a `Replay` toolbar action and implement their Reduce Motion
branch as a cross-fade to the settled state — keep both behaviors when
adapting.

## Copying into an app repo

1. The pack compiles beside `templates/design-system/DesignTokens.swift` and
   `templates/design-system/PremiumCraft.swift`; copy those first.
2. Replace the placeholder asset names (`card-foil`, `card-emblem`,
   `cloud-item-1`…`cloud-item-7`, `hero-emblem`) with brand art in the app's
   asset catalog — generate via the Higgsfield routing in
   `references/design-visual-system.md`. Adding the app's first asset catalog
   makes the asset compiler require an `AppIcon` set in the same catalog.
3. Replace the demo copy and scene hex colors with the brand's own; the token
   bindings and beat pacing stay.
4. `PremiumCraft.swift` is the canonical preset layer. `TokenSpring.swift` and
   `motion-tokens.ts` restate its bounce values; a bounce change is a
   three-file commit, and `check:motion-contract` fails the build when the
   copies drift from the canon.

## Traps these files already avoid

- A bare ViewBuilder tuple inside `TimelineView` does not guarantee overlay
  layout — wrap the scene in an explicit `ZStack` (`DemoSphereCloud` carries
  the comment).
- Procedural scenes must not hand-build spring constants; evaluate a
  `TokenSpring` preset so `withAnimation` and `Canvas` land on the same curve.
- On the web lane, a CSS `filter` on a `preserve-3d` ancestor flattens its
  subtree and breaks 3D z-ordering; Remotion's bundler also needs
  TypeScript 5.x (`motion-tokens.ts` header has both notes).

Mechanics in these demos are frame-read from the 60fps.design catalog
(`x-com-60fpsdesign-catalog` in the source registry; live MCP access in
`motion-craft-benchmarks.md`). Content, copy, and characters are original —
the catalog's ground rule is patterns, never clones.
