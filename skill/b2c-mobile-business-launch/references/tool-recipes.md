# Tool Recipes

Use current tools and live data whenever possible. Treat this file as workflow, not fixed facts.

## Contents

- AppKittie App-Store Intelligence
- Paid Tool Decision Protocol
- Doppler And Secret Routing
- Social-Language Research
- Firecrawl Web Intelligence
- Refero UX Pattern Research
- Higgsfield Visual And Motion Production
- Remotion Content Asset Production
- Name And Keyword Collision
- ASO Skill Routing
- In-App Simulator, MobAI Toolbelt, Recorders, Native iOS, And CLI Simulator Capture
- UGC Creator Engine Routing
- Fastlane Organic Growth Routing
- GEO/SEO Skill Routing
- Revenue And Monetization Routing
- Resend Email Routing
- PostHog Analytics And Attribution Routing
- Compound Engineering And Agent Orchestration
- Founder-Only Gates
- Privacy And Terms Research
- Cloudflare Email Routing
- Landing Funnel Verification
- Cloudflare/Supabase Waitlist Pattern
- Audit Prompt Pattern

## Paid Tool Decision Protocol

Before using a free fallback for any paid or account-gated tool, load `paid-tool-routing.md` and ask the founder to confirm the route. Missing runtime access is not evidence that the founder lacks the paid tool or does not want to use it.

Paid/account-gated lanes in this skill include AppKittie, XPOZ, Firecrawl, Refero, Higgsfield, MobAI Plus/Pro capabilities, Fastlane AI, paid ASO/MMP/ad tools, Sideshift or creator marketplaces, and paid/account features of RevenueCat, Stripe, PostHog, and Resend. MobAI's free tier does not require spend approval; replacing its cross-platform route still requires a recorded coverage decision.

Record the selected route in `TOOL_DECISIONS.md` or the relevant ops doc:
- paid tool used
- user-provided export used
- free fallback approved
- blocked waiting for access
- deferred with reason

Do not spend tokens on the weaker fallback until the founder confirms.

## Doppler And Secret Routing

Load `secrets-management.md` before adding or using secrets. Default to Doppler unless the founder selected another provider.

Refresh current Doppler official docs and `https://docs.doppler.com/llms.txt` before installation, setup, service-token, or CI/live-environment instructions. Record docs checked date, docs URLs, observed CLI version/install route, and any docs-vs-local mismatch in `SECRETS.md`.

Local check:
```bash
doppler --version
doppler setup
doppler run -- npm test
```

Rules:
- `doppler login` and account/project access are founder/operator actions when authentication is required.
- Run `doppler me` before secrets work to confirm the active account.
- **Config name preflight:** Before any `doppler run --project X --config Y` command, read the config name from `SECRETS.md` or run `doppler configs --project X`. Never guess from memory (e.g. "prod" vs "prd" differ by project and both are valid naming conventions).
- Use `doppler run -- <command>` for local commands that need secrets.
- Use Doppler service tokens, provider integrations, OIDC, or platform-native secrets for CI/live environments.
- Do not print `doppler secrets get --plain` output.
- **Env file extraction:** Never `source` a `.env`, `.p8`, or credential file. Use `awk -F= '/^KEY=/{print $2}' file` for single values. Do not commit awk/shell extraction snippets that print raw credential values to committed docs.
- **JS inside doppler run:** When the command contains JavaScript template literals (`${...}`), pass the script via a single-quoted heredoc (`doppler run -- node --input-type=module <<'NODE' ... NODE`) so bash does not expand template syntax before Doppler injects secrets.
- Update `SECRETS.md` whenever a new secret, `process.env`, webhook signing secret, provider key, service-account file, app-store credential, mobile build setting, or CI/deploy secret appears.
- Commit `.env.example` names only; never commit `.env`, private keys, service-account JSON, signing files, OAuth refresh tokens, or raw provider keys.

## AppKittie App-Store Intelligence

Purpose: choose the market/category by revenue and downloads, then position inside or against it. Also use AppKittie to monitor competitors, ads, creators, screenshots, keywords, reviews, and post-launch deltas.

Access:
- AppKittie is a paid/account-gated intelligence path. If unavailable in the runtime, use `paid-tool-routing.md` before substituting public store research.

Run:
- `search_apps` across 3-5 plausible categories or query clusters
- top revenue apps, top download apps, trending apps, and fastest growth apps by downloads/revenue/reviews
- filtered searches for apps with Meta ads, Apple Search Ads, creator partnerships, websites, or contact emails
- `get_app_detail` for the top 5-10 competitors, including screenshots, IAPs, developer/site/socials, historical downloads/revenue/reviews/ratings, ads, and creator partnerships
- `get_app_reviews` for 50-300 recent reviews across the most relevant competitors, depending on credit budget
- `batch_keyword_difficulty` for the candidate name, subtitle, category terms, competitor alternatives, and long-tail pains; use `get_keyword_difficulty` for final deep dives
- `get_supported_countries` before non-US keyword research

Record:
- monthly downloads and revenue estimates
- lifetime downloads/revenue where available
- rating and review count
- update recency
- pricing and trial structure
- in-app purchase tiers
- app age and growth rate
- ad presence and creative pattern
- screenshots and app-store positioning
- user complaints and feature requests
- Meta/ASA ad presence and creative patterns
- creator/influencer partnership signals
- contact emails, websites, and social links for partnership/press/ads research
- keyword popularity, difficulty, traffic, and top-ranking apps by country

Decision rule:
- The storefront category is where users already search and spend.
- The product identity can be a contrarian wedge against that category.
- If a phrase has no search volume, keep it as brand/category creation, not the only acquisition path.
- AppKittie data is directional unless first-party; cite it as estimates and pair it with reviews/social evidence.

## Social-Language Research

Purpose: find the words users already use for the pain.

Sources:
- Reddit subreddits around the job-to-be-done and competitor categories
- TikTok hashtags and creator formats
- X/Twitter keyword clusters
- YouTube/creator comments when the concept is creator-led

Preferred local tool:
- Use XPOZ for Reddit, TikTok, X/Twitter, and Instagram social/market-language research when available.
- Prefer the installed XPOZ MCP/CLI. If only a local CLI exists, resolve its path before use instead of assuming it is on `PATH`.
- Put global flags before the platform: `xpoz-cli --output json tiktok search_posts ...`
- Check auth first: `xpoz-cli --output pretty auth status`
- Useful platforms/methods: `reddit search_posts`, `reddit search_comments`, `reddit get_subreddit_with_posts`, `tiktok search_posts`, `tiktok search_users`, `tiktok get_posts_by_user`, `twitter search_posts`, `twitter count_posts`, `instagram search_posts`, `instagram get_posts_by_user`.

Access:
- XPOZ is a paid/account-gated research path. If auth is missing or the CLI is unavailable, ask before using public search, platform-native browser search, reviews, or founder-provided screenshots as the fallback.

Queries:
- problem phrases from the source spec
- competitor names plus "quit", "alternative", "too much", "expensive", "worth it"
- category verbs, not just nouns
- aspirational phrases and "I wish..." phrases
- trend containers such as "Sunday reset", "weekly review", "AI coach", "habit tracker", adapted to the current product

Record:
- verbatim language
- emotional register
- repeated failure modes
- screenshots/posts worth citing
- social formats that can become ads or organic content

Rules:
- Do not overfit to one viral post.
- Separate broad cultural trend from app-store search behavior.
- Keep sensitive or copyrighted material summarized unless the source allows direct quotation.
- Prefer creator handles, subreddits, compact hashtags, and competitor names over broad generic phrases; broad XPOZ queries are often noisy.
- Record query, platform, date, result URL/post ID/creator handle where possible, and how the evidence changed positioning or copy.

## Firecrawl Web Intelligence

Purpose: inspect public web surfaces that AppKittie and XPOZ do not cover well: competitor landing pages, pricing pages, docs, help centers, policy pages, blog/SEO content, feature pages, and funnel claims.

Use Firecrawl MCP/API when available:
- `firecrawl_search` for broad web discovery with scraped result content
- `firecrawl_map` to discover URLs on a competitor/domain and find pricing, terms, support, blog, FAQ, or docs pages
- `firecrawl_scrape` for a single page when the URL is known
- `firecrawl_crawl` for multi-page competitor/site audits
- `firecrawl_extract` for structured fields such as pricing, plans, claims, CTAs, features, testimonials, integrations, and policy commitments
- batch scrape when comparing several competitors or policy pages

Fallback:
- Firecrawl is a paid/account-gated crawler. If unavailable or blocked, use `paid-tool-routing.md` before switching to ordinary web search, `curl`, browser snapshots, `sitemap.xml`, `robots.txt`, or manual page notes.

Record:
- source URL, crawl date, page type, extracted facts, claims copied into product/marketing, and claims rejected as unsupported
- competitor pricing and plan names
- funnel steps and CTAs
- support/privacy/contact/deletion pages
- SEO/GEO content patterns: FAQ, schema, blog topics, `llms.txt`, sitemap, and robots behavior

Rules:
- Respect robots, login walls, paywalls, and terms. Do not bypass access controls.
- Use Firecrawl for public web evidence, not for App Store intelligence where AppKittie/ASO tools are stronger.
- Do not rely on Firecrawl metadata extraction alone for schema/security checks; verify important items directly on the live page when launching.

## Refero UX Pattern Research

Purpose: ground web and mobile UX decisions in shipped product screens, styles, and flows before building app screens, onboarding, paywalls, web funnels, settings, support, and legal/account flows.

Current docs basis to refresh at runtime:
- docs index: `https://doc.refero.design/llms.txt`
- MCP server URL: `https://api.refero.design/mcp`
- Getting Started, Tools, Data Model, Examples, and Refero Skill pages

Access:
- Refero is a paid/account-gated design research path. Current docs say Refero Pro is required for MCP use and auth can be OAuth or an Authorization Bearer token.
- If Refero is not available in the runtime, load `paid-tool-routing.md` and ask before using the bundled baseline pattern pack, public inspiration galleries, Page Flows/UI Sources-style public references, app-store screenshots, or founder-provided examples.

Use the current MCP tool names:
- `refero_search_styles` for visual direction, typography, surfaces, spacing, and design-system inspiration.
- `refero_get_style` for full design guidance after choosing style candidates.
- `refero_search_screens` with `platform: "web"` or `platform: "ios"` for concrete UI patterns, components, copy hierarchy, and state handling.
- `refero_get_screen` for detailed screen metadata.
- `refero_get_similar_screens` to expand from one strong reference.
- `refero_get_screen_image` only when metadata is not enough and visual inspection is required.
- `refero_search_flows` with `platform: "web"` or `platform: "ios"` for onboarding, signup, checkout, cancellation, upgrade, account deletion, password reset, permissions, and settings changes.
- `refero_get_flow` for full journey logic, step goals, actions, system responses, and related queries.
- Current Refero docs list `web` and `ios` for screen/flow platform filters. For Android launches, use Refero iOS/mobile findings only as journey evidence, then adapt to Android-native controls, permissions, billing, and device screenshots before marking Android UX ready.

Research packet:
- 3-5 styles for the brand/design direction, with one primary and 1-2 secondary influences.
- 5-10 screens for each critical surface family: onboarding, paywall, pricing, restore, settings/account, support/privacy, empty/error/offline, referral/share, search/filter.
- 2-4 flows for each critical journey: onboarding, purchase/upgrade, cancellation/retention, restore purchases, account deletion, password reset or login recovery, and permission requests when applicable.
- A `UX_PATTERNS.md` source ledger with query, platform, selected records, observed pattern, adopted decision, rejected decisions, and caveats.
- A `ux-patterns.html` or `design.html` section rendering pattern inventory, flow maps, state matrix, and bug traps.

Rules:
- Use Refero as research ingredients, not a template library to copy.
- Preserve the onboarding conversion playbook unless the user explicitly approves a named experiment.
- Do not commit paid Refero screenshots unless licensing/permission is clear; summarize metadata and link source records instead.
- Pair Refero findings with product trace rows, analytics events, accessibility checks, and implementation state matrices.
- Record free fallback approval and limitations in `TOOL_DECISIONS.md` when Refero is unavailable.

## Higgsfield Visual And Motion Production

Purpose: produce launch visuals, mockups, icons, mascots, animations, demo videos, screenshot art, and ad creative from the locked design system.

Use after `DESIGN.md` exists or after a provisional design direction is explicitly labeled `draft`.

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
- Put `DESIGN.md` constraints into the generation brief: palette, typography mood, shapes, texture, motion energy, banned aesthetics, and intended surface.
- All generated assets must be embedded or referenced in HTML proofs: `design.html`, `onboarding.html`, screenshot HTML, landing HTML, or ad-preview HTML.
- Label assets as `direction`, `draft`, or `production`.
- Do not present generated screenshots as real app functionality. Store screenshots must show truthful app UI and avoid unsupported claims, prices, or features.
- For animations, write the storyboard and reduced-motion fallback before generation, then verify the clip in layout.

## Higgsfield Chained Recipes

These are the canonical recipe bodies. Other files route to a recipe by name and add only their surface-specific note.

### Recipe 1: Soul-Once Founder-Face Ads

Purpose: create a reusable founder/presenter Soul identity once, then produce weekly Marketing Studio video ads from it.

1. **Check for existing Soul.** Call `mcp__claude_ai_Higgsfield__show_characters` and check `PROJECT_STATE.yaml` `tools.higgsfield.identity.soul_reference_id`. If a trained Soul exists, jump to step 6.
2. **Media preflight.** For each founder photo, call `mcp__claude_ai_Higgsfield__media_upload` then `mcp__claude_ai_Higgsfield__media_confirm`. Record each `upload_id`.
3. **Spend confirm.** Surface current balance via `mcp__claude_ai_Higgsfield__balance`. Confirm Soul training spend with the founder per `paid-tool-routing.md`.
4. **Train Soul.** Use `--soul-2` for still/image-driven campaigns; use `--soul-cinematic` when the launch needs talking-head or presenter VIDEO:
   ```bash
   higgsfield soul-id create --name "founder" --soul-2 \
     --image a.png --image b.png --output-dir ./identity
   ```
   Save the returned `reference_id` to `PROJECT_STATE.yaml` `tools.higgsfield.identity.soul_reference_id` and `./identity/training-manifest.json`.
5. **Create avatar.** Use the upload ID from the preflight:
   ```bash
   higgsfield marketing-studio avatars create --name "Founder" --image <upload_id>
   ```
   Save `avatar_id` to `PROJECT_STATE.yaml` `tools.higgsfield.identity.avatar_id`. Write `avatars.json` as `[{"id":"<avatar_id>","type":"custom"}]`.
6. **Import app product.** If not already done:
   ```bash
   higgsfield marketing-studio webproducts fetch \
     --url <app-store-url> --wait
   ```
7. **Spend confirm for ad batch.** Surface current balance via `mcp__claude_ai_Higgsfield__balance`. Confirm weekly generation spend with the founder per `paid-tool-routing.md`.
8. **Generate ads (weekly).** Inject DESIGN.md tokens into every `--prompt`:
   ```bash
   higgsfield generate create marketing_studio_video \
     --prompt "<hook + DESIGN.md brief>" \
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
2. **Pick avatar.** Use a preset avatar or a custom Soul avatar. For custom Soul, confirm `avatar_id` exists in `PROJECT_STATE.yaml`; if not, run Recipe 1 steps 2–5 first.
3. **Spend confirm.** Surface balance via `mcp__claude_ai_Higgsfield__balance`. Confirm spend for the planned mode batch with the founder per `paid-tool-routing.md`.
4. **Generate parallel mode batch.** Inject DESIGN.md tokens into every `--prompt`. The `--url` shortcut reuses the backend entity but does NOT inject brief — always add `--prompt` explicitly:
   ```bash
   higgsfield generate create marketing_studio_video \
     --url <app-store-url> \
     --prompt "<hook + DESIGN.md brief>" \
     --mode ugc --duration 15 --aspect_ratio 9:16 \
     --output-dir ./ads/ugc --wait

   higgsfield generate create marketing_studio_video \
     --url <app-store-url> \
     --prompt "<hook + DESIGN.md brief>" \
     --mode ugc_unboxing --duration 15 --aspect_ratio 9:16 \
     --output-dir ./ads/ugc_unboxing --wait

   higgsfield generate create marketing_studio_video \
     --url <app-store-url> \
     --prompt "<hook + DESIGN.md brief>" \
     --mode product_review --duration 15 --aspect_ratio 9:16 \
     --output-dir ./ads/product_review --wait

   higgsfield generate create marketing_studio_video \
     --url <app-store-url> \
     --prompt "<hook + DESIGN.md brief>" \
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
     --prompt "<seasonal context + DESIGN.md palette: colors, texture, mood, banned aesthetics>" \
     --image ./supporting-art/background.jpg \
     --count 3 \
     --output-dir ./seasonal/<season>
   ```
   Generate 2–3 variants. Label all outputs `status:draft`.
5. **CONTENT_ASSETS.md.** Record prompt_brief (with DESIGN.md tokens and seasonal context), source asset, output paths, variant labels (status:draft), and approval gate.
6. **Founder gate.** Founder must approve before CPP upload, App Store event submission, or IAP promotional art upload. Do not upload any seasonal restyle without explicit founder approval.
7. **Upload.** On approval, use `app-store-connect-cli.md` upload procedures for CPP/event/IAP art.

---

### Recipe 6: Cheap-First Direction (z_image → production model)

Purpose: minimize credit spend on direction-finding before committing production-quality credits.

**Rule-5 reconciliation:** the upstream `higgsfield-generate` skill defaults to quality-first and says do NOT pre-optimize for cheaper models unless asked. In this spend-sensitive, founder-gated skill, cheap-first is offered ONLY as a spend-reduction option at the `paid-tool-routing.md` spend-confirmation prompt — never applied silently. Present it as an option, let the founder choose, then proceed.

1. **At spend-confirmation prompt.** Offer the cheap-first path as an option: "Run z_image drafts first (cheaper) to lock direction, then production model on the winner. Saves approximately X credits vs. running production model on all variants. Proceed with cheap-first or production-only?"
2. **Translate DESIGN.md brief.** Extract palette, typography mood, shapes, texture, banned aesthetics, and intended surface into a tight prompt.
3. **Check icon_style token.** If `DESIGN.md` `icon_style` is `character`, `cartoon`, or `mascot`, use `nano_banana_2` or `nano_banana_pro` for drafts, not `z_image`. Otherwise, use `z_image` for cheap drafts.
4. **Draft run (z_image, 5–8 variants):**
   ```bash
   higgsfield generate create z_image \
     --prompt "<DESIGN.md brief>" \
     --aspect_ratio 1:1 \
     --wait
   ```
   Label all outputs `status:direction`. Render in `design.html` for founder side-by-side review.
5. **Pick 2–3 directions.** Founder (or, if the founder delegates to the agent, the agent using the council) selects directions to promote.
6. **Production-model run on confirmed directions:**
   ```bash
   higgsfield generate create gpt_image_2 \
     --prompt "<DESIGN.md brief, on-image text if needed>" \
     --aspect_ratio 1:1 \
     --wait
   ```
   (Use `nano_banana_2`/`nano_banana_pro` for character/mascot; `seedream_v4_5` for vector/flat illustration.)
   Label promoted outputs `status:draft`.
7. **Design proof.** Update `design.html` with `status:draft` variants in a side-by-side layout.
8. **Founder selects.** Founder picks final production asset. Label selected output `status:production`.
9. **CONTENT_ASSETS.md.** Record prompt_brief (DESIGN.md tokens), model used at each stage, direction outputs (status:direction), draft outputs (status:draft), final output (status:production), output paths, QA, and approval state.

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
- Record license eligibility or founder approval in `CONTENT_ASSETS.md` or `TOOL_DECISIONS.md`.

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
- Record source inputs, render commands, output paths, dimensions, duration, route decision, license status, and claim checks in `CONTENT_ASSETS.md` and `content-assets/manifest.json`.
- Do not publish, schedule, upload store assets, run paid campaigns, or pay for rendering infrastructure without founder approval.

## Name And Keyword Collision

Check:
- App Store search and exact title collisions
- high-revenue apps/games using the term
- generic utility apps that own the keyword
- domain availability
- trademark obvious conflicts
- social handle availability when relevant
- pronunciation and "did you do your ___?" usability

Decision rule:
- A beautiful name that is invisible in App Store search can still win if the brand has another acquisition path, but the launch dossier must compensate.
- Do not lock a name until ASO collision and domain options are known.

## ASO Skill Routing

Purpose: avoid re-creating specialist ASO work inside the broad launch skill.

Use `aso-store-ops.md` as the router. Load `app-store-listing-prep.md` for Apple listing packets, pricing/privacy/growth surfaces, and `store-console-workflow.md` when the work moves into App Store Connect, Google Play Console, privacy forms, screenshots, or submission. When the runtime exposes ASO skills, delegate:
- `aso-router` and `app-marketing-context` before any broad or ambiguous ASO project
- `market-pulse`, `market-movers`, `category-positioning`, `competitor-analysis`, and `competitor-tracking` for category, chart, and competitor context
- `keyword-research`, `metadata-optimization`, `seasonal-aso`, `localization`, and `android-aso` before title/subtitle/keywords/Play copy locks
- `screenshot-optimization`, `ios-screenshots`, `app-icon-optimization`, `app-preview-video`, and `ab-test-store-listing` before screenshot, App Icon, App Preview, or PPO work
- `custom-product-pages`, `in-app-events`, `app-store-featured`, and `app-clips` before Apple marketing-surface plans
- `apple-search-ads`, `ua-campaign`, `attribution-setup`, and `web-to-app-funnel` for paid traffic, CPP routing, SKAN/MMP/deep links, and web-to-app funnels
- `monetization-strategy`, `paywall-optimization`, and `subscription-lifecycle` for pricing, paywall, trial, churn, and subscription lifecycle work
- `onboarding-optimization`, `retention-optimization`, and `referral-program` for activation, engagement, and viral loops that shape store claims
- `review-management`, `rating-prompt-strategy`, `crash-analytics`, and `app-rejection-recovery` for quality loops, ratings/reviews, stability, and resubmission
- `asc-metrics` and `app-analytics` for first-party performance and dashboards after launch
- `app-launch`, `creator-ugc-marketing`, and `press-and-pr` for launch calendar, UGC/creator strategy, and press kit consistency

Fallback:
- If the ASO skills are installed but not discoverable in the current runtime, search local skill/plugin directories for the skill name and read its `SKILL.md`.
- If the Eronred ASO skill set is relevant, refresh `https://github.com/Eronred/aso-skills` and prefer installed or vendored skill docs over memory.
- If no ASO skill pack is installed, use `paid-tool-routing.md` before replacing paid ASO tooling with AppKittie, public App Store/Play Console research, manual keyword sheets, and the same outputs: context, keyword map, metadata variants, `APP_STORE_LISTING.md`, `STORE_CONSOLE.md`, `app-store-listing.html`, `store-console.html`, `SCREENSHOTS.md`, launch calendar, and post-launch monitoring loop.

## In-App Simulator, MobAI Toolbelt, Recorders, Native iOS, And CLI Simulator Capture

Purpose: capture truthful app UI for App Store and Google Play screenshots, record polished demo videos, create app-preview/social proof, and compose final assets with the design system.

Load `xcodebuildmcp-testing.md` first for any "run the app / check this screen / walk this flow / reproduce this bug" request: its Route Ladder starts at the in-app iOS Simulator (rung 0 — Claude Code Desktop's simulator pane or Codex with the `build-ios-apps` plugin), which needs no install and no account, and it also covers the CLI `computer-use` route, XcodeBuildMCP, SnapshotPreviews preview exports, serve-sim streaming, and Apple simulator/device command examples. Always load `mobai-toolbelt.md` before MobAI device automation, recorder skills, Android coverage, repeatable `.mob` suites, polished demo/app-preview recording, or MobAI-adjacent build/test tooling. Refresh the MobAI org and relevant repo docs before installing or naming commands.

Use when:
- a local iOS or Android build exists
- store screenshots need real app state
- review/rejection work depends on what a reviewer sees
- screenshot copy or layout must be verified on actual device sizes
- launch, store, Fastlane, UGC, support, or investor materials need a polished app-flow video

Preferred routing:
- For a single screen check, flow walk, or bug repro on a local Mac, use the in-app iOS Simulator (rung 0) and stop there — no MCP server, no CLI install, no founder gate.
- Use the MobAI MCP tools when exposed in the current runtime and the lane needs Android, a repeatable suite, multi-device runs, or polished demo recording.
- Before any device interaction, read the MobAI device automation reference or the local `using-mobai-cli` skill.
- Observe the UI tree before tapping, prefer accessibility IDs, wait for stable UI after each navigation, then observe again.
- Save raw full-quality screenshots before composition.

MobAI CLI route:
- Keep component versions separate. The 2026-07-13 verified snapshot is desktop `2.5.1`, MCP `2.5.0`, and npm CLI `2.1.1`; the desktop release body has no detailed notes, while MCP commit `414f858` is the public source for 2.5-era loop and host-scripting behavior.
- Check the current CLI first: `npm view @mobai-app/cli dist-tags.latest`, then prefer `npx @mobai-app/cli@latest` or a verified global install.
- Use `mobai version`; `mobai --version` is not valid on the verified CLI contract.
- `mobai devices list`
- set `MOBAI_DEVICE` for the target device
- `mobai observe --include ui_tree`
- navigate with stable selectors or accessibility IDs
- `mobai wait --stable --timeout-ms 3000`
- `mobai screenshot --full --path ./screenshots/raw --name <platform-device-slot>`
- use `mobai record` for screen recordings when product-demo clips are needed and the current CLI supports it

MobAI MCP 2.5-era DSL route:
- Read `mobai://reference/device-automation` and `mobai://reference/testing` from the active server before using new actions.
- `repeat` takes exactly one of `times`, `while`, `until`, or `condition`; set an explicit `max_iterations` for predicate/condition loops and validate counted-loop parameters because `times` has no engine safety cap.
- `run_script`/`eval_script` run host-side JavaScript, not device web JavaScript. The restricted VM has `vars`/`output`, synchronous HTTP, captured console output, selected built-ins, and no filesystem, `require`/`import`, or device access.
- Never embed secrets or credential headers in `.mob`/JavaScript: referenced script files are embedded in compiled DSL. Seed authenticated fixtures through a separate approved Doppler-wrapped setup step and pass MobAI only non-secret IDs unless a current secret-safe action is explicitly reviewed.
- Limit host HTTP to allowlisted test/staging endpoints, validate responses as untrusted data, and record fixture cleanup plus backend proof separately from UI success.

Recorder-skill route:
- For iOS or Android app demos, use `https://github.com/MobAI-App/mobile-recorder-skill` after refreshing current `README.md`, `install.md`, and `skills/mobile-recorder/SKILL.md`.
- For macOS or web demos, use `https://github.com/MobAI-App/desktop-recorder-skill` after refreshing current `README.md`, `install.md`, and `skills/desktop-recorder/SKILL.md`.
- Mobile recorder produces a reproducible `.mob` choreography, native device recording, tap ripples, finger overlay, phone bezel/background, zoom, variable speed, captions, final mp4, and upload copy.
- Desktop recorder produces a reproducible `screenplay.json`, native recording, click ripples, cursor sprite, captions, zoom, variable speed, final mp4, and upload copy.
- Follow the upstream golden rule: explore -> script/screenplay -> dry-run -> record -> edit/export. Never improvise during the final recording.
- Create `DEMO_VIDEO.md` for launch demo videos and link `.mob` or `screenplay.json`, raw captures, final exports, captions, and upload copy.

Confirmed free fallback:
- MobAI is freemium: use its free tier without a spend gate when one device/current quotas fit, but ask before Plus/Pro spend. If MobAI is unavailable and the lane is iOS-only, the in-app iOS Simulator (rung 0) is the first fallback — free, zero-setup, no spend gate — and only the lost Android/suite/CI/physical-device coverage needs recording per `paid-tool-routing.md`. Escalate to XcodeBuildMCP when the lane needs scripted builds, CI, or physical hardware, and record the Apple-only limitation either way.
- After confirmation, load `xcodebuildmcp-testing.md` for iOS/iPadOS/macOS/tvOS/watchOS/visionOS build, run, UI automation, screenshot, video, and log workflows.
- Refresh official XcodeBuildMCP docs and local `xcodebuildmcp --help`/`xcodebuildmcp tools` output before setup commands, CLI syntax, MCP tool names, screenshot captures, or readiness proof.
- Use XcodeBuildMCP for Apple simulator/device captures and record the missing MobAI coverage. Use Android emulator/ADB or mark Android proof blocked for Android-only flows.

In-app native iOS route (rung 0, both runtimes):
- In Claude Code Desktop on a Mac (local sessions only — never cloud or SSH), state the goal plainly ("run the app in the iOS Simulator and tap through the signup flow"); the simulator pane opens itself when the app runs. Consent is per device, and screenshots of the device leave the machine — use fixture/sandbox accounts only, never a real account.
- In Codex with the `build-ios-apps` plugin, call `session_show_defaults` before the first build/run/test, use `build_run_sim` when defaults are set, read the accessibility hierarchy before interacting, and prefer stable labels over raw coordinates.
- Record the runtime and app version, the plan/policy gate cleared, that the session was local, the simulated device and OS, the fixture account, output paths, and the simulator-only/no-Android/no-distribution limitation in `PRODUCTION_READINESS.md`.

CLI proof tools:
- SnapshotPreviews (`https://github.com/getsentry/SnapshotPreviews`) exports preview PNG/JSON proof from XCTest. Link `SnapshottingTests`, use `SnapshotTest` or `PreviewLayoutTest`, set `TEST_RUNNER_SNAPSHOTS_EXPORT_DIR`, and record that this is preview-only coverage.
- serve-sim (`https://github.com/EvanBacon/serve-sim`) streams and controls a booted iOS Simulator in a browser. Run `npx serve-sim` for the default `http://localhost:3200` preview, record the booted simulator/device, URL/port, actions, logs, and the limitation that simulator streaming does not replace provider proof or App Store signing readiness.

Record in `SCREENSHOTS.md`:
- platform, device model/class, OS, app build, locale, theme, account fixture, and data fixture
- screen path and selector path used to reach it
- raw capture path
- demo choreography path: `.mob` or `screenplay.json` when recording video
- design-system frame/composition path
- final upload path and dimensions
- Apple display well or Google device class satisfied
- visual QA notes and upload status

Rules:
- Do not use generated art as a replacement for real app UI.
- Use Higgsfield for supporting backgrounds, mascots, icons, motion, or frame art only after the app screen is truthful.
- Keep raw captures separate from final upload assets.
- If capture is blocked by missing device/app access, leave the exact blocker. Continue with a clearly labeled design-system mock only after the founder approves the fallback.

## Paid User Acquisition Routing

Purpose: decide whether the product is ready for a small paid acquisition test before treating ad-channel ideas as a growth plan.

Use `paid-user-acquisition.md` before:
- paid ads, Apple Search Ads, Meta/TikTok/Google campaigns, paid creative tests, or paid-growth readiness claims
- custom product page campaign routing or web-to-app paid traffic
- MMP/ad-network SDK decisions, ad-account reporting, or baseline uplift plans
- using RevenueCat LTV/cohort data to judge CPA, trial conversion, payback, or ROAS

Inputs:
- `SPEC.md`, `11_STAR_EXPERIENCE.md`, `CONTENT_ASSETS.md`, `ANALYTICS.md`, `REVENUE_OPS.md`, `APP_STORE_LISTING.md`, `LAUNCH_TRACE.md`, `PRIVACY.md`, `TERMS.md`
- RevenueCat LTV/cohort/trial/purchase/entitlement data when available
- App Store Connect or Play Console baseline metrics
- ad-channel access and budget approval state

Outputs:
- `PAID_UA.md`
- `growth/paid-ua-report.csv` when spend is planned or active
- updated `ANALYTICS.md`, `REVENUE_OPS.md`, `CONTENT_ASSETS.md`, `APP_STORE_LISTING.md`, and `LAUNCH_TRACE.md`

Rules:
- Start with one channel or document the exception.
- Do not launch campaigns, connect accounts, install privacy-affecting ad SDKs, or change budgets without founder approval.
- Do not call installs success unless paywall reach, purchase, entitlement, revenue, and retention quality are visible.

## Viral Growth Loop Routing

Purpose: decide whether the product can grow through built-in sharing, referrals, invite loops, social-comment mechanics, or creator CTAs before treating content as the whole growth plan.

Use `viral-growth-loops.md` before:
- referral unlocks, share-to-unlock mechanics, invite systems, or referral codes
- viral onboarding/paywall flows and closing-offer mechanics tied to sharing
- TikTok/Reels/Shorts hooks that depend on users commenting, sharing, tagging, searching, or posting their own results
- creator CTAs that must map to product rewards, store search, landing links, or self-reported attribution
- calling a social channel ready from views, likes, or UGC ideas alone

Inputs:
- `SPEC.md`, `11_STAR_EXPERIENCE.md`, `ONBOARDING.md`, `REVENUE_OPS.md`, `ANALYTICS.md`, `LAUNCH_TRACE.md`, `PRIVACY.md`, `TERMS.md`
- AppKittie/XPOZ/review/social evidence for category, platform, creator language, device mix, and content formats
- real product screens or truthful prototypes that show the shareable result

Outputs:
- `VIRAL_GROWTH.md`
- `growth/format-lab.csv` or `ugc/script-bank.md`
- `growth/referral-loop-map.md` when referral/unlock mechanics are non-trivial
- updated `UGC_PLAYBOOK.md`, `FASTLANE_OPS.md`, `CONTENT_ASSETS.md`, and `ANALYTICS.md` when content or automation is in scope

Rules:
- Treat UGC as supply and viral growth as the system that converts attention into product actions.
- Do not force referral/share mechanics without fallback, abuse controls, and policy review.
- Do not scale from one viral post; wait for repeatable format evidence plus downstream app, paywall, revenue, or retention signal.
- Ask before creator payments, paid tools, public posting, social account connections, pricing changes, or legal/policy-sensitive incentives.

## UGC Creator Engine Routing

Purpose: decide whether creator-led organic growth is a real channel and, if so, run a Day 0 format-discovery program before scaling or feeding Fastlane.

Use `ugc-creator-engine.md` before:
- TikTok/Reels/Shorts founder-led organic content
- Sideshift or other creator marketplace work
- creator sourcing, contracts, payments, or account ownership decisions
- UGC scripts, shot lists, creator briefs, or tracker artifacts
- adapting creator videos into ads or Fastlane campaigns

Inputs:
- `SPEC.md`, `BRAND.md`, `DESIGN.md`, `ONBOARDING.md`, `LAUNCH.md`, `ANALYTICS.md`, `REVENUE_OPS.md`, `PRIVACY.md`, `TERMS.md`
- AppKittie/XPOZ/review evidence for audience language and competitor creator patterns
- real app screenshots/recordings from MobAI, Codex Desktop native iOS/XcodeBuildMCP, serve-sim, or approved fallback
- Higgsfield visuals only as supporting assets constrained by `DESIGN.md`

Outputs:
- `UGC_PLAYBOOK.md`
- `ugc/creator-list.csv`
- `ugc/creator-brief.md`
- `ugc/script-bank.md`
- `ugc/tracker.csv` or sheet link
- `ugc/weekly-review.md`

Rules:
- Ask before spending on Sideshift, creator platforms, paid creator tools, or creator payments.
- Do not start a mature creator program at Day 0. Start with 3-5 creators and founder-written scripts.
- Do not schedule or post creator content without disclosure, claim review, and founder approval.
- Treat one viral video as luck; treat 2-3 hits from one structure across creators as the earliest scale signal.

## Fastlane Organic Growth Routing

Purpose: set up Fastlane AI as the post-launch content engine for organic TikTok, Instagram Reels, YouTube Shorts, and any other connected destinations supported in the current workspace.

Use `fastlane-growth-ops.md` after launch approval/public beta or when the user asks for `usefastlane.ai`, Fastlane setup, the Fastlane guide, developer API, Blitz campaigns, content generation, scheduling, or short-form analytics.

Access:
- Fastlane AI is paid/account-gated. If the app, API, workspace, or installed skill is unavailable, use `paid-tool-routing.md` before switching to a manual content calendar, local prompt set, platform-native drafts, or spreadsheet schedule.

Delegate:
- load the installed `usefastlane-ai` skill before API work
- compare a user-provided Fastlane `SKILL.md` against the installed skill when the user supplies one
- use current app/docs/API state as source truth because `developers.usefastlane.ai` can be a JavaScript shell
- use safe reads first: preferences, angles, connections, content, posts, analytics when post IDs exist
- build `FASTLANE_OPS.md` and `fastlane/` artifacts before generating or scheduling content

Inputs:
- `SPEC.md`, `BRAND.md`, `DESIGN.md`, `LAUNCH.md`, `ONBOARDING.md`, `REVENUE_OPS.md`, `PRIVACY.md`, `TERMS.md`, and `RESEARCH.md`
- MobAI screenshots/recordings for real app proof
- Codex Desktop native iOS/XcodeBuildMCP or serve-sim screenshots/recordings when Apple-platform media proof is available or approved as a fallback
- Higgsfield assets for design-system constrained hooks, mascots, backgrounds, and motion
- `UGC_PLAYBOOK.md`, `ugc/script-bank.md`, and creator/post results when a creator-led engine exists

Rules:
- never store or print `FASTLANE_API_KEY`
- ask before connecting accounts, scheduling, canceling, deleting, changing profiles, or posting publicly
- treat platform posting limits and account warmup as launch gates
- QA every generated content item against brand, legal, store, pricing, and product truth before scheduling
- connect content metrics back to installs, trials, purchases, attribution answers, and product analytics

## GEO/SEO Skill Routing

Purpose: make the public launch funnel discoverable by both traditional search and AI answer engines.

Use `geo-seo.md` as the router. When the runtime exposes GEO skills from the `geo-seo-claude` workflow, delegate:
- `geo` or `geo-audit` for the full GEO+SEO pass
- `geo-technical` for crawlability, SSR/static rendering, performance, security, and indexability
- `geo-crawlers` for AI crawler access through `robots.txt`, meta tags, and headers
- `geo-llmstxt` for `llms.txt` generation or validation
- `geo-schema` for JSON-LD entity markup
- `geo-citability` for answer-style sections and citation readiness
- `geo-content` for E-E-A-T and proof structure
- `geo-brand-mentions` for entity/authority gaps
- `geo-platform-optimizer` for ChatGPT, Perplexity, Gemini, Google AI Overviews, and Bing Copilot differences
- `geo-compare` for monthly before/after tracking

Fallback:
- If the GEO skills are installed but not discoverable in the current runtime, search `.agents/skills`, `.claude/skills`, `.codex/skills`, and plugin caches for the relevant `SKILL.md`.
- If no GEO skill pack is installed, still produce the minimum launch outputs: metadata, schema, `robots.txt`, `sitemap.xml`, `llms.txt`, AI-crawler access notes, citability notes, and live HTTP checks.

## Revenue And Monetization Routing

Purpose: set up purchase infrastructure without confusing payment success with app entitlement access.

Use `revenue-monetization.md` as the router. Delegate to local skills when available:
- `setup-revenuecat` for initial RevenueCat project, `premium` entitlement, and default offering scaffold.
- `stripe-best-practices` before Stripe Checkout, Payment Links, Billing, Customer Portal, webhooks, or tax decisions.
- ASO `monetization-strategy`, `subscription-lifecycle`, and `retention-optimization` for pricing, paywall timing, churn, and lifecycle loops.
- `setup-posthog` once the product repo exists and purchase/subscription events need validation.
- `setup-supabase` if the funnel or backend needs accounts, waitlist, referrals, or subscription projection storage.
- `resend-email-ops.md` before subscription lifecycle emails, payment recovery, receipts, trial reminders, or billing-support notifications.

Rules:
- RevenueCat should be the entitlement source of truth for B2C mobile subscriptions unless the project explicitly chooses a different architecture.
- Stripe may process web payments, but web payment success must be mapped into RevenueCat entitlement or backend access before launch-ready.
- App Store/Google Play product setup, web billing, pricing, taxes, subscription terms, and live checkout are founder-only gates.
- Use sandbox/Test Store first; do not publish production purchase links or live prices until validation passes and the founder approves.
- RevenueCat, Stripe, tax, and store-account features can be paid/account-gated. Use `paid-tool-routing.md` before replacing provider setup with local mocks or free-tier planning, and never call mocks live entitlement proof.

## Resend Email Routing

Purpose: set up outbound, lifecycle, broadcast, and optional inbound email without damaging domain reputation or creating compliance gaps.

Use `resend-email-ops.md` before:
- Resend domain creation or DNS changes
- transactional email send wrappers
- waitlist confirmations, welcome messages, trial reminders, payment recovery, receipts, support confirmations, or admin alerts
- Contacts, Topics, Segments, Broadcasts, or Automations
- unsubscribe/preference handling
- Resend webhooks, inbound receiving, or attachment processing

Rules:
- Prefer a verified sending subdomain over the root domain.
- Keep Resend API keys server-side only; never use `NEXT_PUBLIC_` or browser bundles.
- Prefer sending-access/domain-scoped keys for runtime senders.
- Use idempotency keys for retryable transactional sends.
- Verify webhooks with the raw request body and store `svix-id` to handle duplicates.
- Add unsubscribe/preference handling for lifecycle and marketing email.
- Treat inbound MX changes as founder-gated when they could affect existing mailboxes or Cloudflare Email Routing.
- Resend account/domain features can be paid/account-gated. Use `paid-tool-routing.md` before replacing Resend with local email previews, logs, Gmail, Cloudflare Email Routing, or another provider.

## PostHog Analytics And Attribution Routing

Purpose: make analytics, attribution, and launch learning visible before implementation and then validate the first real events once a repo exists.

Use `analytics-attribution.md` before:
- PostHog setup or SDK installation
- event catalogs, funnels, dashboards, or PostHog project decisions
- landing/waitlist/referral analytics
- onboarding attribution questions
- paywall, trial, closing-offer, or RevenueCat/Stripe event naming
- feature flags, experiments, session replay, surveys, or data pipelines
- Fastlane/social campaign UTM conventions
- builder prompts that ask another agent to implement events

Delegate:
- `setup-posthog` only after the product repo exists and can receive an event scaffold.
- `setup-posthog` handles initial project/setup validation; this launch skill owns the upfront `ANALYTICS.md` and `analytics-plan.html`.
- Use current PostHog docs or Context7/web docs for stack-specific SDK details because PostHog SDK options, defaults, and product docs change.

Default stack:
- PostHog primary for product analytics, web analytics, feature flags, funnels, session replay when explicitly enabled, surveys, and experiments.
- RevenueCat as subscription entitlement truth and subscription event source.
- Stripe as web payment truth when direct checkout exists.
- GA4/ad-network tooling only when paid ads, Google attribution, or platform reporting require it.
- Sentry for errors/crashes, not product analytics.

Rules:
- Create `ANALYTICS.md` and a founder-visible `analytics-plan.html` before implementation.
- Track waitlist, referral, pricing-section, app-store CTA, onboarding steps, attribution answer, demo video, personalized plan, review prompt eligibility/request, paywall view/dismissal, closing offer, activation, subscription lifecycle, restore, refund, email lifecycle, and Fastlane campaign events when relevant.
- Combine technical attribution with self-reported attribution; UTMs alone miss word-of-mouth, creator, AI-search, and social discovery.
- Use one analytics wrapper per surface; do not scatter vendor SDK calls throughout app code.
- Validate at least one real event in the dashboard before saying analytics is live.
- Do not enable replay, surveys, ad identifiers, or sensitive event properties without privacy/store-disclosure mapping.
- PostHog paid/account features can affect replay, surveys, experiments, retention, and data pipelines. Use `paid-tool-routing.md` before replacing them with static plans or local event logs.

## Compound Engineering And Agent Orchestration

Purpose: turn the launch package into production-ready software without losing product, design, analytics, entitlement, or testing truth.

Use `engineering-orchestration.md` before:
- actual app, backend, or web-funnel implementation
- builder/Rork/Codex/Claude handoff prompts that will create app code
- `ORCHESTRATION.md`, `AGENTS.md`, `CLAUDE.md`, `LAUNCH_TRACE.md`, `TECH_SPEC.md`, `ENGINEERING_PLAN.md`, or `PRODUCTION_READINESS.md`
- deciding whether to use product brainstorm, planning, parallel agents, or worktrees
- declaring beta, store-submission, or production readiness

Load `compound-engineering-routing.md` before core engineering. It is the enforceable CE route and state contract; this section is the quick recipe.

Use `parallel-agent-orchestration.md` before any subagent dispatch or multi-lane launch run. The default runtime habit should be: keep the critical path local, identify safe sidecar agents, serialize shared resources, and write the preflight before claiming speed from parallelism.

Delegate:
- `ce-update` in Claude Code, or a recorded local inventory/latest-release fallback, before a substantial engineering run.
- `ce-brainstorm` after AppKittie/XPOZ/Firecrawl research when product shape, onboarding, paywall, core loop, activation, or scope still has multiple defensible directions.
- `ce-plan` when launch docs are stable enough to become an implementation plan.
- `ce-work` for bounded execution from a concrete plan.
- `ce-worktree` for isolated parallel engineering lanes, PR review, or keeping a dirty main checkout safe.
- `ce-code-review` before treating non-trivial implementation as complete.
- `ce-test-browser` for web funnels, checkout, policy pages, support flows, dashboards, and responsive browser checks.
- `ce-test-xcode` for iOS build/test verification where applicable.
- `ce-proof` or `ce-demo-reel` when the founder/reviewer needs a visual proof artifact.
- MobAI MCP or the local `using-mobai-cli` skill for serialized mobile-device E2E and store screenshot capture.
- If Compound Engineering is unavailable, record the unavailable route and equivalent fallback in `ORCHESTRATION.md`, `PROJECT_STATE.yaml`, and `ENGINEERING_PLAN.md`; do not let agents skip directly from docs to readiness.

Parallel rules:
- Parallelize research, static audits, independent docs, isolated frontend/backend units, fixtures, and test-writing only after mapping each unit to create/modify/test files.
- If two lanes touch the same file, migration state, simulator/device, git staging, release action, or final readiness decision, run them serially.
- The orchestrator owns staging, commits, merges, project-wide suites, MobAI device ownership, production-readiness judgment, and final ship/hold decisions.
- Instruct parallel subagents not to run project-wide suites, stage files, commit, merge, publish, submit, schedule content, or mutate shared credentials.
- After parallel work returns, compare modified files, resolve collisions, run focused tests, then run integration/E2E checks.

Record in `ORCHESTRATION.md` and `PROJECT_STATE.yaml`:
- CE availability, latest-version check, skills considered, selected route, and fallback reason if unavailable
- selected strategy: `not_evaluated`, `inline`, `serial_subagents`, `parallel_subagents`, `worktrees`, `hybrid`, `blocked`, or `not_needed`
- critical path kept local by the orchestrator
- candidate units, roles, objectives, modes, files, shared resources, and safety decisions
- spawned agents, forbidden actions, output paths, actual file collision check, and integration status
- focused validators and full suites run after integration

Record in `ENGINEERING_PLAN.md`:
- product brainstorm source or skip rationale
- requirements trace to `LAUNCH_TRACE.md`, `TECH_SPEC.md`, `SPEC.md`, `DESIGN.md`, `design.md`, `ANALYTICS.md`, `ONBOARDING.md`, `REVENUE_OPS.md`, `EMAIL_OPS.md`, `PRIVACY.md`, `APPLE_SIGNING.md`, and `STORE_CONSOLE.md`
- implementation units, repo-relative paths, serial dependencies, worktree needs, safe parallel lanes, serialized resources, and subagent output contracts
- frontend, backend, database, analytics, revenue, email, privacy, store-console, app-integrity, permission, and state-machine impacts
- test scenarios, MobAI E2E scenarios, backend/provider verification, release gates, and blockers

Record in `PRODUCTION_READINESS.md`:
- build/typecheck/lint/test commands and outcomes for every touched repo
- browser/mobile E2E evidence, including MobAI steps and screenshots where relevant
- backend/database/provider proof for frontend actions, RevenueCat/Stripe entitlements, PostHog events, Resend sends/webhooks, and account deletion/support paths when in scope
- release-build/staging-build proof that mocks are disabled and secrets are not bundled
- remaining blockers and founder-only gates

Rules:
- `AGENTS.md` is mandatory for real app builds and builder handoffs; start from `templates/repo-agent-entrypoints/AGENTS.md` so future agents keep using `b2c-mobile-business-launch` without another founder prompt. `CLAUDE.md` should start from `templates/repo-agent-entrypoints/CLAUDE.md` and point back to `AGENTS.md` instead of duplicating product truth. Keep these files as maps to source docs, active plans, validators, and failure cards.
- Unit tests are not enough for production readiness.
- Screenshot proof from any device route — in-app simulator, MobAI, XcodeBuildMCP — is not backend proof; pair device actions with database/provider/dashboard evidence.
- Do not use generated builders from a prompt alone. Include repo-local instructions and artifacts so later agents can continue without reconstructing the launch logic.

## Founder-Only Gates

Always ask before:
- switching from an intended paid/account-gated tool to a free fallback
- buying a domain
- changing DNS or MX records that affect receiving mail
- changing billing, subscriptions, pricing, or spend
- using credentials or secrets not already available
- creating paid cloud resources beyond normal free-tier/dev usage
- publishing or materially changing privacy policy, terms, EULA, subscription terms, data deletion commitments, legal, medical, financial, or endorsement claims
- sending partner/creator emails
- sending marketing/broadcast email to real users
- connecting social accounts, changing social profiles, scheduling posts, canceling posts, deleting content, or posting publicly through Fastlane or another social scheduler
- force-pushing, deleting repos, dropping tables, or destructive cleanup
- final App Store submission, launch, merge, or ship/hold calls

Self-resolve:
- category framing when evidence is clear
- brand/design direction within a locked brief
- document organization
- landing stack among low-risk viable options
- sequencing of non-destructive work

## Privacy And Terms Research

Use `privacy-terms.md` before drafting public policy pages or store disclosures. Always refresh official sources because privacy, subscription, and platform requirements change.

Minimum research set:
- Apple App Privacy Details and App Store Connect EULA guidance for iOS launches
- Google Play User Data and Data safety requirements for Android launches
- FTC privacy/security guidance, and COPPA guidance if children or teens may be involved
- California CCPA/CPRA and CalOPPA guidance when serving U.S. consumers
- EU GDPR transparency guidance when offering to EU/EEA users
- current subscription/negative-option rules when free trials, renewals, or recurring billing exist
- vendor docs for analytics, ads, AI, payments, crash reporting, backend, email, and push providers

Evidence to gather:
- SDK/package list
- app permissions and platform privacy manifests
- backend schema/tables/buckets
- analytics event catalog
- payment/subscription provider behavior
- AI provider data-use settings
- support/email tooling
- ad pixels and attribution tooling
- data retention/deletion implementation

Do not use generic legal-policy generators as source truth. They can help with wording only after the actual data inventory and official requirements are known.

## Cloudflare Email Routing

Use when a launch domain needs working inbound email aliases for support, privacy, security, press, or founder contact.

Important:
- Dashboard routing rules can appear active while the zone-level Email Routing status is still disabled or DNS records are not configured.
- Cloudflare Email Routing custom addresses are inbound forwarding addresses. Do not assume they can send outbound mail as the domain.
- Cloudflare requires destination address verification before a route can receive mail.
- A custom address should have one current destination rule unless a Worker handles multi-destination routing.

Setup:
- create or verify destination address
- create rules for `support@domain`, `privacy@domain`, and any `hello@domain`, `security@domain`, or founder alias
- click the Email Routing connect/enable flow and add the required `MX` and `TXT` records
- keep catch-all disabled/drop unless the founder explicitly wants a monitored catch-all
- send test emails from an external account and verify receipt
- record whether outbound send-as is covered by Gmail/Workspace, Cloudflare Email Service, Resend/Postmark/Mailgun, or another provider

Record:
- alias, destination, purpose, status, last test timestamp, and where the address is published
- DNS status and dashboard status
- outbound sending gap, if any

Founder gates:
- ask before deleting existing `MX` records or migrating mail providers
- ask before publishing a founder personal alias
- ask before enabling catch-all forwarding

## Landing Funnel Verification

Local:
- install dependencies
- run typecheck/lint/build
- run local dev server
- test desktop and mobile responsive views
- test waitlist form success and error states
- test referral URL preservation
- verify no secrets appear in public bundles

Deploy:
- deploy preview
- deploy production
- bind custom domain
- confirm cert/DNS status
- HTTP check preview and canonical domain
- verify security headers on `GET`
- verify `robots.txt`, `sitemap.xml`, `llms.txt`, schema, OG image
- submit a test signup against production or staging
- verify analytics events arrive
- remove or mark test data before public launch

Useful checks:
```bash
curl -I https://example.com
curl -s https://example.com/robots.txt
curl -s https://example.com/llms.txt
curl -s https://example.com/sitemap.xml
```

## Cloudflare/Supabase Waitlist Pattern

Use when the launch needs a simple, measurable waitlist and referral loop.

Pattern:
- browser posts email/referral/source to a server endpoint
- server rate-limits and validates input
- server calls a Supabase RPC or equivalent backend function
- database function creates/refetches waitlist row, generates referral code, increments referrer if valid
- frontend reveals share link and position
- leaderboard masks emails and never exposes PII

Security posture:
- RLS on
- direct table access denied to anonymous clients
- anonymous callers use narrow RPC functions only
- SECURITY DEFINER functions lock `search_path`
- extension functions schema-qualified
- service keys stay server-side only
- rate limits exist before public traffic

## Audit Prompt Pattern

For any public funnel, generate a reusable `AUDIT_PROMPT.md` with:
- what the site is supposed to do
- current live URLs
- stack
- brand rules
- specific audit dimensions and output format
- "do not recommend" constraints
- validation URLs/tools

The prompt is part of launch quality. It lets the founder send the site to another model or engineer for a focused review without re-explaining the business.
