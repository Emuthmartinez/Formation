# Visual And Motion Production

Use current tools and live data whenever possible. Treat this file as workflow, not fixed facts.

Part of the [Tool Recipes](../tool-recipes.md) index. Before using any paid or account-gated tool named below, honor the **Paid Tool Decision Protocol** and **Founder-Only Gates** in that index.

---

## Higgsfield Visual And Motion Production

Purpose: produce launch visuals, mockups, icons, mascots, animations, demo videos, screenshot art, and ad creative from the locked design system.

Use after `design/DESIGN.md` exists or after a provisional design direction is explicitly labeled `draft`.

Access:
- Higgsfield is a paid/account-gated visual production path. If unavailable, ask before using Remotion, local HTML/CSS/SVG/canvas, founder-owned assets, public-domain assets, or real app screenshots as the free fallback.

Local skill routing:
- `higgsfield-product-photoshoot` for product/brand images, hero banners, lifestyle scenes, Pinterest pins, social carousels, and static ad creative packs.
- `higgsfield-generate` for app icons, general images, text-forward graphics, UI illustrations, video generation, image-to-video, Marketing Studio ads, and Virality Predictor analysis.
- `higgsfield-soul-id` for face-faithful founder/presenter/avatar identity when owned photos are available and the user approves.
- `higgsfield-marketplace-cards` when a marketplace/listing visual card is the target output.

Model intent:
- GPT Image 2: icons, graphic UI imagery, launch visuals, text-forward concepts.
- Nano Banana 2/Pro: mascots, character sheets, stylized references, expressive guide states.
- Soul Location: environment/background art, paywall scene backgrounds, empty-state art, and abstract scenes — prompt-only, no reference photo required.
- Soul Cast: text-only characterful mascot or persona generation when no reference photo is available.
- Seedream 4.5: vector/flat-illustration sequences and face-anchored complex scene edits.
- Seedance 2.0: 4-15 second product demos, onboarding animation clips, image-to-video, multi-shot motion.
- Marketing Studio: UGC ads, presenter videos, product demos, unboxing/review formats, hooks/settings/avatars/products.
- Virality Predictor: score finished demo/ad/onboarding videos for hook, attention, retention, and distraction risk.

Media preflight: `media_upload` + `media_confirm` are REQUIRED before Soul training (`--image`), Virality scoring (`--video`), ad-reference creation, and custom avatar creation. Run both steps and confirm the upload ID before proceeding.

Session discovery (read-only, free): before generating, use `show_characters`, `show_medias`, `show_generations`, `show_reference_elements`, `presets_show`, and `models_explore` to reuse existing Soul characters, uploaded media, prior outputs, brand/style references, and presets instead of re-uploading or re-generating. For a multi-app account, call `select_workspace` first so Soul identities, avatars, and product entities do not bleed across brands. For category-specific modes not listed above (e.g. `virtual_try_on` / `ugc_virtual_try_on` for apparel, `closeup_product_with_person` for beauty, `conceptual_product`, `wild_card`), consult the `higgsfield-generate` and `higgsfield-product-photoshoot` skill mode/model catalogs.

Format caution — Veo 3.1: hard format limits are 16:9 or 9:16 only, and durations 4/6/8s only. Do not use Veo 3.1 for non-standard App Preview ratios or durations outside those values.

Ad-reference caution: ad references (`--ad-reference-id`) are MUTUALLY EXCLUSIVE with `--hook_id`/`--setting_id` at generation time. Pick reference-driven OR composed-from-blocks, never both in the same call.

Cost-Tier Discipline: by default, use the quality-first model for each task (matching the upstream `higgsfield-generate` skill default). The cheap-first z_image → production-model path (Recipe 6 below) is a spend-reduction option offered ONLY at the `paid-tool-routing.md` spend-confirmation prompt, never applied silently. This intentionally overrides the upstream quality-first default because this skill is spend-sensitive and founder-gated.

Rules:
- Put `design/DESIGN.md` constraints into the generation brief: palette, typography mood, shapes, texture, motion energy, banned aesthetics, and intended surface.
- All generated assets must be embedded or referenced in HTML proofs: `design/design.html`, `product/onboarding.html`, screenshot HTML, landing HTML, or ad-preview HTML.
- Label assets as `direction`, `draft`, or `production`.
- Do not present generated screenshots as real app functionality. Store screenshots must show truthful app UI and avoid unsupported claims, prices, or features.
- For animations, write the storyboard and reduced-motion fallback before generation, then verify the clip in layout.

## Product Ad Structure And Prompt Craft

Purpose: replace the `<hook + design/DESIGN.md brief>` placeholder used across the Chained Recipes below with a concrete structure, so a generated ad proves one specific feature instead of drifting into abstract mood with no UI on screen. Applies to every `--prompt` passed to `marketing_studio_video` (`ugc`, `ugc_unboxing`, `product_review`, `tv_spot`) and to any Remotion ad/social composition.

Before writing the prompt, fix two things:
- **The reference.** Which screenshot, icon, or UI state is actually in frame, and its real shape, color, and layout — the prompt must not contradict it.
- **The one claim.** What the feature is, what it does, and why it is worth opening the app for. One claim per ad; do not stack three features into one 15-second cut.

Four-beat structure (scale the timings below to the recipe's `--duration`; ratios assume a 15s ad):
1. **Identification hook (0–2s).** The app or feature is on screen in a clean hero shot before anything else happens. Never open on abstract particles, smoke, or a transition effect with no real UI visible — hiding the product for the first two seconds loses the viewer who would have recognized it.
2. **Usage / function (2–8s).** Show the feature being used, or the screen changing state, in a way that makes the mechanism obvious without narration — a tap, a result appearing, a before/after.
3. **Creative escalation (8–12s).** Turn the benefit into one memorable image. Stay anchored to the real product here — escalate the feeling, not the feature list.
4. **Final hero shot (12–15s).** End clean, on the app's actual icon or screen, matching `design/DESIGN.md` palette and motion energy.

Consistency and accuracy rules — apply regardless of which tool renders the ad:
- Keep exact screens, copy, icons, and proportions from the real app; do not invent functionality, ratings, or claims the product does not have. This is the same truthful-UI rule the block above states for store screenshots — it applies to ad creative too.
- Cut on action (hard cut, match cut, cut on motion) between beats. Avoid morphing/dissolve transitions mid-cut — they make the product illegible at the exact moment a viewer would recognize it.
- Match the beat to the feature type: a utility feature reads best as a before/after; a creative/output feature needs the result visible; a habit/streak feature needs the moment of use shown, not just the icon.

Fill the `--prompt` argument in Recipe 1 step 8 and Recipe 2 step 4 below with the four beats above, written specifically to the feature being advertised and the current `design/DESIGN.md` tokens — then discard the placeholder text.

### Master Prompt Template

A literal starting point for the four-beat structure above — use this as the `--prompt` body when a call needs the full text instead of being composed from scratch. Attach the app's actual screenshot/icon references as the generation input; the block below is the text prompt only. Keep the structure and rules intact; only the bracketed brief content should change per app/feature.

```
Use all attached images as references for one product commercial.
Create a highly creative premium product advertisement for the exact product shown in the reference images.
Format: [match the --aspect_ratio of the generation call this prompt is passed to — 9:16 vertical for Recipe 1 and every Recipe 2 mode below; 16:9 only if that specific call requests horizontal].
Duration: maximum 15 seconds.
Goal: make the viewer immediately understand what the product is, what it is used for, why it is desirable, and what emotional/visual world belongs to it.

Important:
This must be a clear advertising creative, not an abstract VFX film. Do not begin with random dust, ice, smoke, particles, explosions, liquid, or abstract textures unless the actual product is visible and understandable in the same moment. The product must appear clearly within the first 1-2 seconds.

First, silently analyze the attached references:
For a mobile app reference (screenshot, icon, or App Store listing) — this skill's primary case — identify the screen or feature shown, its controls, the state transition or action it performs, its color and shape language, target user, desired outcome, and emotional promise. Do not infer packaging, physical materials, or ingredients for an app reference. For a physical-product reference (used only with the Market Category Modifiers below, outside this skill's core scope), identify the main product, its packaging, shape, label, color, material, ingredients, usage ritual, target customer, desired result, and emotional promise.

Universal creative rule:
Build the concept from the product itself. The ad can be surreal, cinematic, luxurious, playful, futuristic, sensory, scientific, mythic, or dramatic, but it must always stay anchored to the real product and its use.

Ad structure:
0-3 seconds — PRODUCT IDENTIFICATION HOOK:
Open with the product clearly visible in a premium hero shot.
3-8 seconds — USAGE / FUNCTION / TRANSFORMATION:
Show the product being used or interacting with its world in a way that makes its purpose obvious.
8-12 seconds — CREATIVE ESCALATION:
Turn the product's benefit into a memorable cinematic image.
12-15 seconds — FINAL HERO SHOT:
End with a clean, premium final product shot.

Camera:
macro close-ups for texture, clean product hero shots for packaging, hands-in-action for usage, slow luxury push-ins for premium feeling, fast precise cuts for performance.

Lighting:
soft clean light for hygiene, glossy reflections for premium, rim light for silhouette, warm light for comfort, clinical light for precision, dramatic contrast for power.

CRITICAL — Editing:
Do not use morphing transitions. Every cut must be a clean editorial transition: hard cut, match cut, cut on motion, whip-pan cut, or product close-up cut.

Product accuracy:
Keep the product visually consistent with the reference image. Preserve its main shape, colors, materials, proportions.
```

### Market Category Modifiers

Append the matching row's modifier text to the end of the Master Prompt above; replace bracketed placeholders with the app's real feature detail. For this skill's actual output — a mobile app — Tech / Electronics (functional/setup features) and Everyday Products (single-benefit features) are the nearest fit; keep the remaining rows for a founder producing ecommerce or physical-product ad creative outside this skill's core app-launch scope, or for an app feature that genuinely behaves like one of these categories (e.g. a fitness app's workout feature under Sports / Fitness).

| Category | What the video must prove | Modifier text |
|---|---|---|
| Tech / Electronics | Setup, response, or functional change | Show [main feature] during realistic use. Include an interaction shot, a visible response, and a close-up of [physical detail, or for an app the specific UI control]. Keep interfaces, controls or ports (whichever the reference actually has), proportions, and behavior accurate. |
| Skincare / Beauty | Texture, application, finish, or routine | Show the real texture, amount, application, and cosmetic finish of [product]. Use soft light and clean macro details. Do not invent ingredients, medical effects, or unrealistic transformations. |
| Automotive / Accessories | Installation, fit, visibility, or before/after appearance | Show where [product] attaches, how it fits, and the off/on or before/after difference. Keep scale, mounting position, reflections, and light behavior realistic. |
| Fashion / Apparel | Fit, silhouette, fabric behavior, and construction | Show [product] on the body from useful angles. Include texture, seams, fastening details, and movement demonstrating [stretch, support, or drape]. Preserve its real cut, color, and material. |
| Food / Drink | Preparation, texture, serving moment, and appetite appeal | Show [product] being prepared, opened, served, or consumed realistically. Use macro texture and appetite cues. Add steam, splashes, or ingredients only when physically relevant. |
| Home / Lifestyle | Scale, setup, spatial use, and everyday benefit | Establish the product's real size in a believable environment. Show setup, interaction, and the change created by [main benefit]. Preserve its dimensions and construction. |
| Sports / Fitness | Fit, grip, resistance, support, or movement | Show [product] during its intended activity. Use close-ups of grip, material, contact points, and movement to demonstrate [specific function]. Avoid unsupported claims. |
| Everyday Products | One simple problem and one visible payoff | Use one sequence: [problem] → [product action] → [visible result]. Show the product immediately and increase perceived value without disguising what it is. |

## Higgsfield Chained Recipes

These are the canonical recipe bodies. Other files route to a recipe by name and add only their surface-specific note.

### Recipe 1: Soul-Once Founder-Face Ads

Purpose: create a reusable founder/presenter Soul identity once, then produce weekly Marketing Studio video ads from it.

1. **Check for existing Soul.** Call `mcp__claude_ai_Higgsfield__show_characters` and check `state/PROJECT_STATE.yaml` `tools.higgsfield.identity.soul_reference_id`. If a trained Soul exists, jump to step 6.
2. **Media preflight.** For each founder photo, call `mcp__claude_ai_Higgsfield__media_upload` then `mcp__claude_ai_Higgsfield__media_confirm`. Record each `upload_id`.
3. **Spend confirm.** Surface current balance via `mcp__claude_ai_Higgsfield__balance`. Confirm Soul training spend with the founder per `paid-tool-routing.md`.
4. **Train Soul.** Use `--soul-2` for still/image-driven campaigns; use `--soul-cinematic` when the launch needs talking-head or presenter VIDEO:
   ```bash
   higgsfield soul-id create --name "founder" --soul-2 \
     --image a.png --image b.png --output-dir ./identity
   ```
   Save the returned `reference_id` to `state/PROJECT_STATE.yaml` `tools.higgsfield.identity.soul_reference_id` and `./identity/training-manifest.json`.
5. **Create avatar.** Use the upload ID from the preflight:
   ```bash
   higgsfield marketing-studio avatars create --name "Founder" --image <upload_id>
   ```
   Save `avatar_id` to `state/PROJECT_STATE.yaml` `tools.higgsfield.identity.avatar_id`. Write `avatars.json` as `[{"id":"<avatar_id>","type":"custom"}]`.
6. **Import app product.** If not already done:
   ```bash
   higgsfield marketing-studio webproducts fetch \
     --url <app-store-url> --wait
   ```
7. **Spend confirm for ad batch.** Surface current balance via `mcp__claude_ai_Higgsfield__balance`. Confirm weekly generation spend with the founder per `paid-tool-routing.md`.
8. **Generate ads (weekly).** Inject design/DESIGN.md tokens into every `--prompt`, structured per **Product Ad Structure And Prompt Craft** above:
   ```bash
   higgsfield generate create marketing_studio_video \
     --prompt "<hook + design/DESIGN.md brief>" \
     --avatars @avatars.json \
     --product_ids @products.json \
     --mode ugc \
     --duration 15 --resolution 720p --aspect_ratio 9:16 \
     --output-dir ./ads/ugc --wait
   ```
9. **Score virality.** Media preflight the output video, then:
   ```bash
   higgsfield generate create brain_activity --video ./ads/ugc/<output>.mp4 --wait
   ```
   Record `virality_score` (overall, peak hook second, sustain %, Default Mode risk) in `CONTENT_ASSETS.md` and `PAID_UA.md`.
10. **Reframe winner.** Use `mcp__claude_ai_Higgsfield__reframe` for 9:16 / 1:1 / 16:9 variants. Confirm the exact invocation via the `higgsfield-generate` skill or MCP tool help before running.
11. **CONTENT_ASSETS.md.** Record prompt_brief, soul_reference_id, avatar_id, source_job_id, virality_score, output paths, QA, and approval state.
12. **Founder gate.** Founder approves before public posting, store upload, or paid campaign launch.
13. **Distribute.** On approval, hand off to Fastlane per `fastlane-growth-ops.md`.

---

### Recipe 2: App Store URL → UGC Ad Batch (Click-to-Ad)

Purpose: turn the live App Store listing into a multi-format UGC ad batch without manual product setup.

1. **Import via App Store URL:**
   ```bash
   higgsfield marketing-studio webproducts fetch \
     --url <app-store-url> --wait
   ```
2. **Pick avatar.** Use a preset avatar or a custom Soul avatar. For custom Soul, confirm `avatar_id` exists in `state/PROJECT_STATE.yaml`; if not, run Recipe 1 steps 2–5 first.
3. **Spend confirm.** Surface balance via `mcp__claude_ai_Higgsfield__balance`. Confirm spend for the planned mode batch with the founder per `paid-tool-routing.md`.
4. **Generate parallel mode batch.** Inject design/DESIGN.md tokens into every `--prompt`, structured per **Product Ad Structure And Prompt Craft** above. The `--url` shortcut reuses the backend entity but does NOT inject brief — always add `--prompt` explicitly:
   ```bash
   higgsfield generate create marketing_studio_video \
     --url <app-store-url> \
     --prompt "<hook + design/DESIGN.md brief>" \
     --mode ugc --duration 15 --aspect_ratio 9:16 \
     --output-dir ./ads/ugc --wait

   higgsfield generate create marketing_studio_video \
     --url <app-store-url> \
     --prompt "<hook + design/DESIGN.md brief>" \
     --mode ugc_unboxing --duration 15 --aspect_ratio 9:16 \
     --output-dir ./ads/ugc_unboxing --wait

   higgsfield generate create marketing_studio_video \
     --url <app-store-url> \
     --prompt "<hook + design/DESIGN.md brief>" \
     --mode product_review --duration 15 --aspect_ratio 9:16 \
     --output-dir ./ads/product_review --wait

   higgsfield generate create marketing_studio_video \
     --url <app-store-url> \
     --prompt "<hook + design/DESIGN.md brief>" \
     --mode tv_spot --duration 15 --aspect_ratio 9:16 \
     --output-dir ./ads/tv_spot --wait
   ```
5. **Score each variant.** Media preflight each output, then run `brain_activity` per Recipe 3. Record virality scores in `CONTENT_ASSETS.md` and `PAID_UA.md`.
6. **Save winners as ad references.** Ad references are MUTUALLY EXCLUSIVE with `--hook_id`/`--setting_id` — do not mix:
   ```bash
   higgsfield marketing-studio ad-references create --job <job_id> --json | jq -r .id
   ```
7. **CONTENT_ASSETS.md.** Record prompt_brief, webproduct_id, avatar_id, source_job_id, virality_score, ad-reference IDs, output paths, QA, and approval state.
8. **Founder gate.** Founder approves before upload or paid campaign launch.

---

### Recipe 3: Virality Closed Loop

Purpose: score every creative before distribution; never pay for a campaign without a recorded virality score.

1. **Generate or capture creative.** Use any generation recipe or real app footage.
2. **Media preflight.** Call `mcp__claude_ai_Higgsfield__media_upload` then `mcp__claude_ai_Higgsfield__media_confirm` for the video file. Record the upload ID.
3. **Score:**
   ```bash
   higgsfield generate create brain_activity --video ./ad.mp4 --wait
   ```
   Returns: overall 0–100, peak hook second, sustain %, Default Mode Network risk. No prompt required.
4. **Decision rules:**
   - Overall < 50: revise hook or switch mode; regenerate before paid distribution.
   - Default Mode risk HIGH: shorten the video or front-load the core value prop.
   - Sustain < 70%: re-cut to remove drop-off section before distribution.
5. **Iterate.** Revise, regenerate, re-score until the decision threshold is met.
6. **Record.** Log score history (overall, peak hook second, sustain %, DMN risk) in `CONTENT_ASSETS.md` per-asset `virality_score` field and in `PAID_UA.md` `virality_score` + `hook_dmn_risk` columns.
7. **Gate.** Paid distribution proceeds ONLY after a virality score is recorded in `CONTENT_ASSETS.md`. This is a hard gate — record the score before handing off to `paid-user-acquisition.md` or Fastlane.

---

### Recipe 4: Master → All Platforms (reframe + personal_clipper)

Purpose: produce one high-quality master video then derive all platform ratios and short clips without re-generating.

1. **Source master.** For App Preview: MUST be real app footage — an in-app simulator recording (rung 0), MobAI, or XcodeBuildMCP capture per `xcodebuildmcp-testing.md` / `mobai-toolbelt.md`; verify the capture's native resolution against the target well before compositing. For ads/social: generated or captured footage is acceptable.
2. **Long-recording trim (optional).** For recordings longer than 60 seconds, use `mcp__claude_ai_Higgsfield__personal_clipper_create` to extract short clips, then poll `mcp__claude_ai_Higgsfield__personal_clipper_status` until complete. Confirm the exact invocation via the `higgsfield-generate` skill or MCP tool help before running.
3. **Spend confirm.** Surface balance via `mcp__claude_ai_Higgsfield__balance`. Confirm reframe spend with the founder per `paid-tool-routing.md`.
4. **Reframe to all platform ratios.** Use `mcp__claude_ai_Higgsfield__reframe` with the master video to produce 9:16, 1:1, and 16:9 variants. Confirm the exact invocation via the `higgsfield-generate` skill or MCP tool help before running. Veo 3.1 format limits (16:9 or 9:16 only; 4/6/8s only) do NOT apply to `reframe` — reframe operates on existing footage.
5. **Score each variant.** Media preflight each variant, then run `brain_activity` per Recipe 3.
6. **CONTENT_ASSETS.md.** Record all output URLs, source_job_id (link derivative to master), virality_score per variant, intended platform, QA, and approval state.
7. **Founder gate.** Founder approves before upload, scheduling, or store submission.
8. **Distribute.** On approval, hand off to Fastlane per `fastlane-growth-ops.md` or App Store Connect per `app-store-connect-cli.md`.

---

### Recipe 5: Seasonal Restyle Refresh

Purpose: refresh CPP backgrounds, event art, and supporting screenshot art for seasonal App Store windows without touching the real-UI screenshot layer.

1. **Check seasonal window.** Confirm with `aso-store-ops.md` / `seasonal-aso` skill that the seasonal window is active or approaching.
2. **Load locked supporting asset.** Identify the specific CPP background, event art, or empty-state asset to restyle. This must be the SUPPORTING ART layer — do NOT restyle or replace the real-UI screenshot layer.
3. **Spend confirm.** Surface balance via `mcp__claude_ai_Higgsfield__balance`. Confirm spend with the founder per `paid-tool-routing.md`.
4. **Restyle with seasonal context:**
   ```bash
   higgsfield product-photoshoot create \
     --mode restyle \
     --prompt "<seasonal context + design/DESIGN.md palette: colors, texture, mood, banned aesthetics>" \
     --image ./supporting-art/background.jpg \
     --count 3 \
     --output-dir ./seasonal/<season>
   ```
   Generate 2–3 variants. Label all outputs `status:draft`.
5. **CONTENT_ASSETS.md.** Record prompt_brief (with design/DESIGN.md tokens and seasonal context), source asset, output paths, variant labels (status:draft), and approval gate.
6. **Founder gate.** Founder must approve before CPP upload, App Store event submission, or IAP promotional art upload. Do not upload any seasonal restyle without explicit founder approval.
7. **Upload.** On approval, use `app-store-connect-cli.md` upload procedures for CPP/event/IAP art.

---

### Recipe 6: Cheap-First Direction (z_image → production model)

Purpose: minimize credit spend on direction-finding before committing production-quality credits.

**Rule-5 reconciliation:** the upstream `higgsfield-generate` skill defaults to quality-first and says do NOT pre-optimize for cheaper models unless asked. In this spend-sensitive, founder-gated skill, cheap-first is offered ONLY as a spend-reduction option at the `paid-tool-routing.md` spend-confirmation prompt — never applied silently. Present it as an option, let the founder choose, then proceed.

1. **At spend-confirmation prompt.** Offer the cheap-first path as an option: "Run z_image drafts first (cheaper) to lock direction, then production model on the winner. Saves approximately X credits vs. running production model on all variants. Proceed with cheap-first or production-only?"
2. **Translate design/DESIGN.md brief.** Extract palette, typography mood, shapes, texture, banned aesthetics, and intended surface into a tight prompt.
3. **Check icon_style token.** If `design/DESIGN.md` `icon_style` is `character`, `cartoon`, or `mascot`, use `nano_banana_2` or `nano_banana_pro` for drafts, not `z_image`. Otherwise, use `z_image` for cheap drafts.
4. **Draft run (z_image, 5–8 variants):**
   ```bash
   higgsfield generate create z_image \
     --prompt "<design/DESIGN.md brief>" \
     --aspect_ratio 1:1 \
     --wait
   ```
   Label all outputs `status:direction`. Render in `design/design.html` for founder side-by-side review.
5. **Pick 2–3 directions.** Founder (or, if the founder delegates to the agent, the agent using the council) selects directions to promote.
6. **Production-model run on confirmed directions:**
   ```bash
   higgsfield generate create gpt_image_2 \
     --prompt "<design/DESIGN.md brief, on-image text if needed>" \
     --aspect_ratio 1:1 \
     --wait
   ```
   (Use `nano_banana_2`/`nano_banana_pro` for character/mascot; `seedream_v4_5` for vector/flat illustration.)
   Label promoted outputs `status:draft`.
7. **Design proof.** Update `design/design.html` with `status:draft` variants in a side-by-side layout.
8. **Founder selects.** Founder picks final production asset. Label selected output `status:production`.
9. **CONTENT_ASSETS.md.** Record prompt_brief (design/DESIGN.md tokens), model used at each stage, direction outputs (status:direction), draft outputs (status:draft), final output (status:production), output paths, QA, and approval state.

## Remotion Content Asset Production

Purpose: create reproducible videos, stills, screenshot frames, app previews, UGC overlays, captions, and ad/social variants from real product UI, brand tokens, copy, and source media.

Use when:
- the founder does not want to pay for Higgsfield or approves a lower-cost local route
- a code-rendered template is better than a one-off generated visual
- assets must be batch-rendered across hooks, CTAs, locales, dimensions, or campaign variants
- real app screenshots/recordings need framing, captions, motion, or store/social formatting

Access and license:
- Load `paid-tool-routing.md` before replacing Higgsfield with Remotion.
- Load `remotion-content-assets.md` before scaffolding a Remotion project or claiming rendered assets are ready.
- Refresh current Remotion docs and license before setup, CLI flags, commercial-use guidance, or renderer API examples.
- Record license eligibility or founder approval in `CONTENT_ASSETS.md` or `strategy/TOOL_DECISIONS.md`.

Recommended setup in the launch repo, not inside this skill package:

```bash
mkdir -p content-assets
cd content-assets
npx create-video@latest --yes --blank --no-tailwind remotion
cd remotion
npx remotion studio
```

Common commands:

```bash
npx remotion compositions
npx remotion still <composition-id> --scale=0.25 --frame=30 --output ../out/frame30.png
npx remotion render <composition-id> --output ../out/video.mp4
npx remotion still <still-id> --output ../out/still.png
```

Rules:
- Use the `remotion-best-practices` skill when available.
- Prefer `<Composition>` and `<Still>` entries with typed props and Zod schemas for variable copy or dimensions.
- Put local images, video, audio, and captions in the Remotion `public/` folder and reference them with `staticFile()`.
- Use frame-based animation APIs such as `useCurrentFrame()`, `interpolate()`, `spring()`, and `Sequence`; do not rely on CSS animations for render-critical motion.
- Keep real app UI visible when the asset claims to show the app.
- Record source inputs, render commands, output paths, dimensions, duration, route decision, license status, and claim checks in `CONTENT_ASSETS.md` and `growth/content-assets/manifest.json`.
- Do not publish, schedule, upload store assets, run paid campaigns, or pay for rendering infrastructure without founder approval.
