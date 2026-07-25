# Change Cascade

A change to a launched (or near-launch) B2C app rarely lives on one surface. Rename a feature and the App Store description, screenshots, landing page, JSON-LD, paywall copy, and RevenueCat product names can all go stale at once. This reference is the **impact-propagation checklist**: given a change, enumerate every surface it touches, update each (or record why it is unaffected), and reconcile before calling the change done.

Use this **after any change to the app, product, brand, pricing, or data behavior** once an App Store listing, landing page, or store assets exist. It pairs with the "Lexicon Lock" in [`flow-traceability.md`](flow-traceability.md) (one vocabulary across every surface).

## Surface Inventory

The full set of surfaces a B2C mobile launch maintains. A cascade check walks the relevant rows of this list.

- **App (in-app):** onboarding copy/flow, core feature UI + copy, paywall copy + plan labels, settings, empty/error states, push/notification copy.
- **App Store Connect listing:** app name, subtitle, promotional text, description, keyword field, "What's New", **screenshots + caption overlays**, **App Preview** video, **App Icon**, **in-app events**, **custom product pages**, and **every localization** of all of the above.
- **App Store Connect products:** IAP/subscription **display names + descriptions**, **promoted-IAP promotional images** (unique per product, never the app icon — see `app-store-connect-cli.md`), pricing, intro/trial offers, **App Review Information notes**.
- **RevenueCat / billing:** offering/package/product display names, paywall configuration, entitlement identifiers, Stripe/web-funnel product copy and prices.
- **Landing / web:** hero, method/how-it-works, FAQ, pricing section, footer, **`<meta>` description + Open Graph**, **JSON-LD / structured data** (description, FAQ, product schema), `robots.txt`/`llms.txt`/`sitemap.xml`.
- **SEO / GEO:** target keywords, citability content, brand-entity signals.
- **Lifecycle email:** transactional + lifecycle templates, brand tokens, plan/price/feature mentions.
- **Analytics:** event names, funnel/dashboard definitions, attribution sources.
- **Legal:** privacy policy, terms, App Privacy answers, Data safety — when data collection, third-party SDKs, or account behavior changes.
- **Content / UGC / ads:** ad creative, demo videos, screenshots reused in ads, creator scripts.

## Change Cascade Map

For each change type, the surfaces most likely to need an update. Treat these as "check and update or justify," not "always edit."

| Change type | Cascade to |
| --- | --- |
| **Feature added / changed / removed** | in-app copy → App Store description + keywords + "What's New" + screenshots/captions + App Preview + in-app events → custom product pages → landing (hero/method/FAQ + meta + JSON-LD) → SEO/GEO keywords → lifecycle email feature mentions → analytics events → privacy/Data safety (if new data/SDK) → ad creative |
| **Core copy / feature name / brand vocabulary change** (lexicon) | **every** surface that names it: in-app, onboarding, paywall, App Store name/subtitle/description/keywords + all localizations, landing hero/method/FAQ + meta description + JSON-LD/FAQ schema, RevenueCat product/offering names, email, ad copy. Run the Lexicon Lock sweep — grep all surfaces, update together. |
| **Onboarding flow change** | onboarding screenshots + App Store screenshot set (if it shows onboarding) → App Preview → activation analytics events/funnels → review-prompt timing → landing "how it works" |
| **Paywall / pricing / plan / trial change** | paywall copy → App Store screenshots that show pricing → IAP/subscription display names + prices + intro offers → RevenueCat offering/packages → Stripe/web funnel → landing pricing section → terms (auto-renew/price disclosure) → lifecycle email (trial/renewal/win-back) → analytics revenue events |
| **Visual / UI / design-token change** | App Store screenshots (re-render) → App Preview → App Icon (if brand mark changed) → landing UI → email brand tokens → ad creative → `DESIGN.md` |
| **New / renamed IAP or subscription product** | RevenueCat product+entitlement+offering → App Store product display name/description/**promo image** → paywall copy → pricing/terms → analytics product IDs → review notes |
| **Privacy / data / SDK change** | `PrivacyInfo.xcprivacy` + required-reason APIs → App Privacy answers → Play Data safety → privacy policy + terms → App Review notes (external services) → analytics/attribution |
| **Domain / brand / company-name change** | everything in "lexicon" + email sender domains + legal entity references + landing footer + App Store seller/marketing URLs |
| **Design token / feature / copy / pricing change affecting generated assets** | all Higgsfield-generated surfaces that carry the changed token → see **Generated-Asset Regeneration** below |

## Generated-Asset Regeneration

Higgsfield-generated assets embed design tokens, feature names, copy, and pricing at generation time. When any locked token changes, every previously-generated asset that carries it is **stale** and must be regenerated before the change is considered done.

**Stale-trigger changes:** locked design token (palette, typography, illustration style), feature addition/removal/rename, brand vocabulary or copy change, pricing/offer change.

**Surfaces that go stale:**

| Surface | Regeneration path |
| --- | --- |
| **Ad creative** (UGC video, DTC static, Marketing Studio) | See the **App Store URL → UGC Ad Batch (Click-to-Ad)** and **Soul-Once Founder-Face Ads** recipes in `tool-recipes/visual-and-motion-production.md` |
| **Screenshot supporting art** (backgrounds, mascots, illustration overlays — not the real-UI layer) | See the **Cheap-First Direction** recipe in `tool-recipes/visual-and-motion-production.md`; real-UI screenshot layer is re-rendered separately per the Visual/UI row in the cascade map |
| **App Preview B-roll** (motion backdrops, intro/outro art — NOT the real app footage layer) | See the **Master → All Platforms** recipe in `tool-recipes/visual-and-motion-production.md`; real app footage source must remain unchanged |
| **Promoted-IAP promotional images** | See the **Cheap-First Direction** recipe in `tool-recipes/visual-and-motion-production.md`; re-upload via `app-store-connect-cli.md` after founder approval |
| **CPP and in-app-event art** | See the **Seasonal restyle Refresh** recipe in `tool-recipes/visual-and-motion-production.md` as a model; re-upload via `app-store-connect-cli.md` after founder approval |
| **Viral share cards** | See the **Cheap-First Direction** recipe in `tool-recipes/visual-and-motion-production.md`; update `CONTENT_ASSETS.md` and linked `viral-growth-loops.md` surfaces |
| **Lifecycle-email header art** | See the **Cheap-First Direction** recipe in `tool-recipes/visual-and-motion-production.md`; update `resend-email-ops.md` template references |

**Guardrails that apply to every regeneration:**

- Higgsfield output is supporting art only. It must **never substitute** for truthful real app UI in store screenshots or App Preview footage.
- Every generation prompt must carry current `DESIGN.md` tokens. Regenerating without an updated brief defeats the purpose of a cascade.
- Confirm spend with the founder per `paid-tool-routing.md` before each generation run. Surface current credit balance (`mcp__claude_ai_Higgsfield__balance`) at the confirmation prompt.
- Record every new asset in `CONTENT_ASSETS.md` with updated `prompt_brief`, `source_job_id`, and `virality_score` fields, and mark prior entries `status:superseded`.
- Store uploads, ad launches, and public posting remain **founder-gated** regardless of regeneration trigger.

## Process

1. **Classify the change** against the map above (a change can be more than one type).
2. **Enumerate impacted surfaces.** List each surface from the matching rows. For surfaces with localizations, the cascade applies to **every localized locale** — and "which locales" is defined by the `LOCALIZATION_MARKET_RESEARCH.md` priority tiers (see [`localization-market-research.md`](localization-market-research.md)), not every language the stores support. Cascade Tier 1 markets across all surfaces (incl. paywall/offers), Tier 2 markets across metadata only.
3. **Update or justify each.** Edit the surface, or record one line of why it is unaffected. A surface left stale by omission is the `change-cascade-incomplete` failure card.
4. **Re-render derived assets.** Copy or UI changes that appear in App Store screenshots, App Preview, or ad creative require a **re-render**, not just a doc edit — old screenshots showing old copy will drift and can draw a Guideline 2.3 metadata rejection.
5. **Reconcile the lexicon.** Confirm the canonical terms (from `DESIGN.md`/`BRAND.md`) read identically across in-app, store, landing, schema, RevenueCat, and email.
6. **Record the cascade.** Note the change and the surfaces touched in `LAUNCH_TRACE.md` (or a `CHANGE_LOG.md` for a live app), update `PROJECT_STATE.yaml` lane evidence, and re-render `launch-cockpit.html`.
7. **Gate the public surfaces.** App Store metadata/screenshot/product changes, landing deploys, public posting, pricing, and legal edits remain founder-approved.

## Done Definition

A change is not "done" until: every impacted surface is updated or explicitly marked unaffected; derived assets (screenshots, App Preview, ad creative) are re-rendered where copy/UI changed; the lexicon is consistent across all surfaces; the cascade is recorded in `LAUNCH_TRACE.md`/`CHANGE_LOG.md` and `PROJECT_STATE.yaml`; and public-surface updates are founder-approved.
