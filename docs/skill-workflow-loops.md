# Skill Loops — `b2c-mobile-business-launch`

> **Reconciled against skill v0.26.0 on 2026-07-26.** 56 loops, every one grounded in a section of SKILL.md that exists today.
>
> Keep it that way by running the four reproduce commands at the end of this file after any change to SKILL.md or the validator set. Checks (3) and (4) exist because a v0.26.0 re-scan found 96 citations pointing at a `Start Here` step enumeration and a `When To Load` list the entrypoint no longer has.
>
> Nothing in the repo reads this file, and neither `README.md` nor `AGENTS.md` links it. Treat a claim here as a lead worth verifying rather than as policy. That is how it earns its keep: `skill-version.json` records that this file's claim about `check-native-ios-proof.ts` running under `audit:ci` was false, and checking it found a fully-implemented 216-line validator with no npm binding, absent from the audit plan.

Tracking file for: read the skill end to end, inventory every distinct repeatable
workflow with its trigger, then emit exactly one grounded five-part loop
(**trigger · action · proof · memory · stopping condition**) per workflow until
coverage is complete with no gaps or overlaps.

- **Skill read:** `skill/b2c-mobile-business-launch/SKILL.md` (full, 239 lines) +
  directory listings of `references/`, `templates/`, `scripts/`, and
  `package.json` scripts. Spot-read references: `change-cascade.md`,
  `control-plane.md`, `premium-mobile-craft.md`, `consumer-product-design-agency.md`.
- **Grounding rule:** every loop's **action** steps cite a named section of the
  skill — a SKILL.md `Start Here` step, a `Phase Spine` phase, a named
  contract section, a `references/*.md` file, a `templates/*` artifact, and/or a
  `package.json` validator script. Nothing in an action step is invented; if the
  skill does not name it, it is not in the loop.
- **Distinctness rule:** a workflow is "distinct" when it has its own trigger +
  its own primary durable artifact + (usually) its own validator. Where two
  references share a trigger, artifact, and validator they are merged so no two
  loops overlap.

---

## Workflow Inventory

Status legend: ✅ covered by exactly one loop · ⬜ uncovered.

| # | Workflow | Trigger (what kicks it off) | Loop | Status |
|---|----------|------------------------------|------|--------|
| 1 | Runtime freshness gate (consumer side) | Before substantial launch/design/store/revenue/build work when the installed runtime may be behind source | L01 | ✅ |
| 2 | Session continuity / resume | New session, resume, status check, or handoff on an existing launch | L02 | ✅ |
| 3 | Orient, scaffold & state/cockpit upkeep | "Launch this app" / broad launch request; any lane/provider/proof/blocker status change | L03 | ✅ |
| 4 | Paid-tool routing & fallback | Before using or replacing any paid/account-gated tool, or before a free fallback | L04 | ✅ |
| 5 | Secrets baseline & routing | Before any new secret, key, token, env var, webhook secret, or `.env` | L05 | ✅ |
| 6 | App-archetype detection & starter | Request matches a known product shape (social / AI-chat / habit / photo-AI) | L06 | ✅ |
| 7 | Provider-proof verification | Before marking any provider-backed lane (analytics/revenue/email/store/security/eng) done | L07 | ✅ |
| 8 | Change cascade | Any change to a launched/near-launch app's feature, copy, brand, pricing, products, or data behavior | L08 | ✅ |
| 9 | Research-backed spec | Need category economics, competitor, review/social-language, keyword, or name-collision evidence | L09 | ✅ |
| 10 | Localization market research | Before localizing any surface or choosing locales | L10 | ✅ |
| 11 | Analytics & attribution blueprint | Before locking onboarding/paywall/funnels/store CTAs or any prompt naming events | L11 | ✅ |
| 12 | 11-star experience | "11-star run" / before SPEC, onboarding, ads, store creative, or eng plans harden | L12 | ✅ |
| 13 | Emotional experience design (producer) | Feature whose 11-star target is 6★+ / "charge this with emotion", "build a habit" | L13 | ✅ |
| 14 | Emotional design audit (auditor) | "Audit this app's emotional design" / "emotional UX audit" | L14 | ✅ |
| 15 | Paid user-acquisition system | Before paid ads, ASA, Meta/TikTok/Google campaigns, or spend-readiness claims | L15 | ✅ |
| 16 | Viral growth loop | Before referral/share-to-unlock/invite/comment-loop mechanics | L16 | ✅ |
| 17 | Launch narrative & cadence | Before the public announcement, launch-day run-of-show, or weekly release rhythm | L17 | ✅ |
| 18 | Launch trace & build contracts | Crossing research → product/design/build; deciding if `TECH_SPEC.md` is needed | L18 | ✅ |
| 19 | Security architecture & release gate | Before threat modeling, hardening, scans, or any security-readiness claim | L19 | ✅ |
| 20 | Design Room (state→mutate→version→render) | Any design/visual-system/cross-surface/store-creative/landing/onboarding/paywall work | L20 | ✅ |
| 21 | Token promotion | Theme tokens change and the design is accepted | L21 | ✅ |
| 22 | UX patterns (Refero) | Before flow maps, state matrices, `UX_PATTERNS.md`, or bug-trap coverage | L22 | ✅ |
| 23 | Onboarding conversion | Before onboarding quizzes, review-prompt timing, paywall timing, or first-session activation | L23 | ✅ |
| 24 | Premium mobile craft | Before in-app UI build/polish, press-state/haptics/loading-empty wiring, or "premium feel" | L24 | ✅ |
| 25 | Content assets / Remotion / generated visuals | Before rendered videos/stills, app previews, ad/social variants | L25 | ✅ |
| 26 | Business Control Plane extension | Extending the Design Room into new analytics/monetization/store/growth panels over the same state | L26 | ✅ |
| 27 | ASO & store ops | Before App Store/Play metadata, keyword research, ASA, or post-launch ASO loops | L27 | ✅ |
| 28 | App Store listing prep packet | Before listing fields, privacy questionnaire, IAP/subscription field maps, CPPs, in-app events | L28 | ✅ |
| 29 | Apple signing & release readiness | Before Apple Developer enrollment, Team ID, signing, profiles, archive/upload, TestFlight | L29 | ✅ |
| 30 | Apple App Store requirements (privacy manifest) | Before ASC upload — `PrivacyInfo.xcprivacy`, required-reason APIs, App Privacy answers | L30 | ✅ |
| 31 | Store console workflow | Before "where do I click / what do I paste" in ASC or Play Console | L31 | ✅ |
| 32 | ASC CLI automation | Before Rork `asc` CLI app creation, metadata, screenshots, TestFlight, RevenueCat sync | L32 | ✅ |
| 33 | Store screenshots production | Store screenshots needed (raw capture → composed iPhone/iPad/Play assets) | L33 | ✅ |
| 34 | Google Play release | Android in scope (platforms include android or an android bundle id exists) | L34 | ✅ |
| 35 | Engineering orchestration (CE + production readiness) | Before actual app implementation, builder prompts, or production-readiness claims | L35 | ✅ |
| 36 | Backend data contract | Before schema/auth prompts or `TECH_SPEC.md` data/API sections harden | L36 | ✅ |
| 37 | App agent roster & repo entrypoints | Before builder handoff bundles, `AGENTS.md`/`CLAUDE.md`, `APP_AGENTS.md`, `agents/` | L37 | ✅ |
| 38 | MobAI device automation & demo videos | Before device automation, app-flow demo videos, app previews, bug-repro recordings | L38 | ✅ |
| 39 | Native iOS proof (Route Ladder) | Before in-app iOS Simulator / Codex Desktop native iOS / XcodeBuildMCP / serve-sim / SnapshotPreviews proof | L39 | ✅ |
| 40 | Revenue monetization | Before RevenueCat/Stripe/web billing, products, paywall, entitlement, webhooks, pricing | L40 | ✅ |
| 41 | Privacy & terms | Before privacy policy, terms, EULA, subscription terms, account-deletion, store disclosures | L41 | ✅ |
| 42 | Resend email ops | Before Resend domains/keys, transactional/lifecycle/broadcast email, deliverability | L42 | ✅ |
| 43 | GEO/SEO public visibility | Before editing any landing/policy/blog copy, `robots.txt`, `llms.txt`, sitemap, schema, metadata | L43 | ✅ |
| 44 | Pre-launch funnel (landing/waitlist) | Phase 4 — landing page, waitlist/referral loop, web funnel, live deploy verification | L44 | ✅ |
| 45 | UGC creator engine | Before founder-led organic social, creator sourcing/contracts, format-discovery tests | L45 | ✅ |
| 46 | Fastlane growth ops | After launch approval/public beta, or usefastlane.ai/Blitz setup, scheduling, social analytics | L46 | ✅ |
| 47 | Post-launch operations | App live (phase_6/6b), "what now", weekly ops, incident response, retention reviews | L47 | ✅ |
| 48 | Source-freshness maintenance (maintainer) | Maintaining the skill, adding external URLs, refreshing third-party docs/commands | L48 | ✅ |
| 49 | LaunchBench / failure-cards / coverage audit | Before any launch-readiness claim, after a repeated miss, or adding a validator/scenario | L49 | ✅ |
| 50 | Skill runtime sync & version discipline (maintainer) | After any skill change — bump version, sync the installed runtime, run the readiness gate | L50 | ✅ |
| 51 | Founder-zero operator bootstrap | Every broad launch start; before account/social/Doppler bootstrap; when an agent is about to hand back a checklist | L51 | ✅ |
| 52 | Agent operations ledger | Before any authenticated browser/API/CLI/native action on a provider, social, or store account | L52 | ✅ |
| 53 | Writing quality (no-slop) | Before writing or reviewing any founder-facing copy or any marketing copy the skill generates | L53 | ✅ |
| 54 | Founder-language translation (maintainer) | Adding or renaming a lane, status, phase, autonomy mode, or provider route; any founder-visible surface change | L54 | ✅ |
| 55 | Skill triggering contract (maintainer) | Changing `SKILL.md` frontmatter, the skill description, or the trigger phrasing | L55 | ✅ |
| 56 | ASC command contract (maintainer) | Before changing any documented `asc` command in `references/app-store-connect-cli.md` | L56 | ✅ |

**Coverage:** 50 / 50 workflows mapped to exactly one loop. No uncovered rows; no
two loops share trigger + primary artifact + validator (see Distinctness Notes).

---

## Stopping-Condition Audit

A loop's most dangerous failure mode is a **vague stop** — one that terminates on
judgment ("until it looks good", "complete", "reconciles", "feels right",
"matches reality", "evidence-backed") rather than on something a second observer
could check without an opinion. The loops below were ranked by how subjective the
original stop was, the worst rewritten first, then re-audited until none stopped
on judgment.

**Observable-stop rule (applied to every loop):** a stopping condition must name
**one of** — (a) a `package.json` command and its pass state (`check:*`,
`probe:*`, `launchbench`, `audit:ci`), (b) a grep/diff-checkable property of a
named artifact (e.g., "zero `TODO`/placeholder tokens", "Lexicon Lock grep
returns 0 cross-surface mismatches", "every surface row marked `updated|unaffected`"),
or (c) a discrete recorded state in `PROJECT_STATE.yaml` (a lane set to
`done|locked|blocked`, or a named founder-only gate). No stop may rest on an
adjective alone.

**Ranking (most-subjective originals, worst first) and the observable stop each now uses:**

| Rank | Loop | Original stop (subjective phrase) | Rewritten to stop on |
|---|---|---|---|
| 1 | L24 Premium craft | "'feels right' details are not left to the build" | `check:ux-patterns` passes **and** the `UX_PATTERNS.md` Premium Craft Details checklist has every row marked `done\|n-a` (grep finds no unresolved row) |
| 2 | L03 Orient/cockpit | "the cockpit matches reality" | `validate:launch-state` passes **and** `render:launch-cockpit` re-run exits 0 with no diff on a second run **and** `project.launch_tier` is set |
| 3 | L09 Research spec | "spec and name are evidence-backed and locked" | every claim row in the `SPEC.md`/`RESEARCH.md` evidence ledger carries a source cell (grep finds no empty source) **and** `lanes.research: locked` |
| 4 | L18 Launch trace | "every build decision traces to evidence and the lexicon is locked" | every row in the `LAUNCH_TRACE.md` decision table has a non-empty evidence cell (grep) **and** the Lexicon Lock grep returns 0 cross-surface term mismatches |
| 5 | L28 Listing packet | "complete and reconciled" | `APP_STORE_LISTING.md` has no `TODO`/empty required-field token (grep) **and** its App Privacy answers diff-match `PRIVACY.md` **and** the founder-approval gate row exists |
| 6 | L41 Privacy/terms | "exist and reconcile" | `PRIVACY.md`+`TERMS.md` have no placeholder token (grep) **and** App Privacy/Data Safety answers diff-match the `check:apple-requirements`/`check:google-play` packets |
| 7 | L08 Change cascade | "all surfaces reconciled" | every surface row in the cascade pass is marked `updated\|unaffected` (grep finds none unmarked) **and** the Lexicon Lock grep returns 0 mismatches — else the `change-cascade-incomplete` failure card is open |
| 8 | L43 GEO/SEO | "crawl/schema/AI-visibility checks pass" (unnamed) + unobservable "loaded before first edit" | `check:landing-funnel` passes (robots/sitemap/llms/schema asserts) **and** a live `curl` of the deployed page returns the JSON-LD block |
| 9 | L17 Launch narrative | "public claims limited to what is true" | `check:launch-narrative` passes (guardrail + cadence asserts) **and** `lanes.launch_narrative: locked` |
| 10 | L38 MobAI demos | "demo artifacts exist with a rerender path" | `DEMO_VIDEO.md`/`CONTENT_ASSETS.md` rows have non-empty `source` + `rerender` fields (grep) — else the MobAI-access blocker is recorded in `PROJECT_STATE.yaml` |

Loops 11–50 used softer completeness language ("exist", "recorded", "complete")
but each already owned a validator or a checkable artifact; the re-audit pass
below rewrites all 50 stops to name that command/artifact/state explicitly, so
every stop is verifiable without an opinion. See the **Re-audit Result** at the
end for the closed-loop confirmation.

---

## Loops

Each loop's **action** steps end with a `→` citation to the named skill section
that grounds them. Conventions used in every loop:

- **Memory** always includes the relevant `PROJECT_STATE.yaml` lane plus the
  lane's durable artifact — grounded in SKILL.md *Operating Posture* ("Keep
  `PROJECT_STATE.yaml` current") and *Autopilot Run Contract*.
- **Stopping condition** for every loop names a verifiable terminator — a
  `package.json` command's pass state, a grep/diff-checkable artifact property, or
  a discrete `PROJECT_STATE.yaml` lane/gate state (per the Observable-stop rule
  above). For provider-backed lanes that terminator is a probe/validator output or
  a named founder-only gate — grounded in SKILL.md *Autopilot Run Contract*
  (provider-proof paragraph) and `references/provider-proof.md`. No stop rests on
  an adjective ("complete", "reconciles", "looks good", "feels right").

### L01 — Runtime freshness gate (consumer side)
- **Trigger:** About to start substantial launch/design/store/revenue/build work and the installed skill runtime may be behind the source copy.
- **Action:**
  1. Run `npm run check:skill-version` from the installed skill (or compare `skill-version.json` manually if the helper is unavailable). → SKILL.md *Runtime Freshness Gate*; `Lane Routing`.
  2. If stale, pause the original request and ask — via AskUserQuestion, or plainly if unavailable — update-now vs continue-on-installed. → SKILL.md *Runtime Freshness Gate*.
  3. Load `references/skill-versioning.md` for the commands/sync rules before acting on the answer. → `Lane Routing` (skill-versioning).
- **Proof:** `check:skill-version` output (fresh, or `skill_version.stale` recorded); the founder's decision captured.
- **Memory:** `PROJECT_STATE.yaml` records freshness status + the founder's update/continue choice.
- **Stopping condition:** `check:skill-version` reports not-stale, **or** `PROJECT_STATE.yaml` records the founder's decline / latest-source-unavailable as a named gate — then continue. Never proceed while `check:skill-version` reports `skill_version.stale` without a recorded decision.

### L02 — Session continuity / resume
- **Trigger:** New session, resume, status check, or handoff on an existing launch.
- **Action:**
  1. Read the Session Continuity source set: `AGENTS.md`, `PROJECT_STATE.yaml`, `launch-cockpit.html`, `ORCHESTRATION.md`, `PRODUCTION_READINESS.md`, `FAILURE_CARDS.md`, and `git status --short`. → `Start Here` (Session Continuity).
  2. Route broad work through `APP_AGENTS.md` role prompts, or record the unavailable-subagent rationale. → *Operating Posture* (session continuity contract).
  3. Reconstruct phase/lane/provider/blocker state from durable files, not chat memory. → *Operating Posture*.
- **Proof:** `npm run check:continuity-contract`; reconstructed state matches the durable files.
- **Memory:** `PROJECT_STATE.yaml` (phase, lanes, blockers) re-confirmed; next action left in state before any pause.
- **Stopping condition:** `check:continuity-contract` passes **and** the `next_action` field in `PROJECT_STATE.yaml` is non-empty; resume the in-flight lane.

### L03 — Orient, scaffold & state/cockpit upkeep
- **Trigger:** Broad "launch this app / turn this transcript into a business" request; or any lane/provider/proof/blocker status change thereafter.
- **Action:**
  1. Recover source truth: business name, wedge, platform, monetization intent, current phase. → `Start Here`; Phase 0.
  2. Create/refresh `PROJECT_STATE.yaml` from `templates/PROJECT_STATE.yaml`; set autonomy mode and confirm `project.launch_tier` (full/lite) with the founder. → `Start Here`; Phase 0; Launch Tiers.
  3. Render `launch-cockpit.html` early and re-render whenever lane/provider/orchestration/proof/gate state changes (`npm run render:launch-cockpit`). → `Start Here`; *Operating Posture*.
- **Proof:** `npm run validate:launch-state`; `launch-cockpit.html` re-rendered and reflects current lanes.
- **Memory:** `PROJECT_STATE.yaml` + `launch-cockpit.html` are the durable state contract.
- **Stopping condition:** `validate:launch-state` passes, `render:launch-cockpit` exits 0 and writes `launch-cockpit.html`, **and** `project.launch_tier` is set to `full|lite`. (Single-pass: re-runs only when a lane/provider/proof/gate field changes, never on a timer, so it cannot spin.)

### L04 — Paid-tool routing & fallback
- **Trigger:** Before using or replacing any paid/account-gated tool (AppKittie, XPOZ, Firecrawl, Higgsfield, MobAI, Fastlane, RevenueCat/Stripe/PostHog/Resend, etc.), or before a free fallback.
- **Action:**
  1. Load `references/paid-tool-routing.md` and classify each paid/account-gated lane. → `Start Here`; Phase 0b.
  2. Ask the founder before substituting a free route; missing runtime access is not permission to spend tokens on a fallback. → `Start Here`; *Operating Posture* (no silent downgrade).
  3. Record decisions in `TOOL_DECISIONS.md`, separating blocked access from founder-approved fallback. → Phase 0b.
- **Proof:** `npm run check:paid-tool-decisions`; `TOOL_DECISIONS.md` distinguishes blocked vs approved-fallback.
- **Memory:** `TOOL_DECISIONS.md` + `PROJECT_STATE.yaml` tool-routing entries.
- **Stopping condition:** `check:paid-tool-decisions` passes **and** every lane row in `TOOL_DECISIONS.md` reads exactly one of `confirmed-paid|founder-approved-fallback|blocked-pending-access` (grep finds no unmarked row).

### L05 — Secrets baseline & routing
- **Trigger:** Before any new API key, token, OAuth credential, webhook signing secret, service-account file, CI/deploy env var, or local `.env`.
- **Action:**
  1. Load `references/secrets-management.md` + `references/provider-state-recipes.md`; default to Doppler and `doppler run --` unless the founder approves another path. → `Start Here`; Phase 0c.
  2. Create/refresh `SECRETS.md`; map local/staging/production locations; add `doppler.yaml` / names-only `.env.example` from `templates/secrets/` when useful. → `Start Here`; Phase 0c.
  3. Refresh current provider docs / CLI `--help` before any setup command and record the docs/version basis. → `Start Here`; *Source Freshness*.
- **Proof:** `npm run check:secrets` (secret-routing); `SECRETS.md` records the docs basis and no secret values are committed.
- **Memory:** `SECRETS.md` + `PROJECT_STATE.yaml` secrets entries.
- **Stopping condition:** `check:secrets` and `check:template-safety` both pass (routed homes recorded, zero plaintext secret values) **and** `SECRETS.md` records the docs/version basis.

### L06 — App-archetype detection & starter
- **Trigger:** Request matches a known product shape — social/community, AI chat/companion, habit/utility, or photo/AI-media.
- **Action:**
  1. Detect the shape and load the matching lane reference (`social-network-lane.md` / `ai-chat-companion-lane.md` / `habit-tracker-lane.md` / `photo-ai-media-lane.md`). → `Start Here`.
  2. Confirm the archetype-specific variant (content/surface/optional systems) via AskUserQuestion and record it in `PROJECT_STATE.yaml`. → `Start Here`.
  3. Copy the runnable starter from `templates/app-archetypes/<pack>/starter/` as the floor and customize with the pack's prompts instead of improvising the wiring. → `Start Here`.
- **Proof:** `npm run check:app-archetype` and `npm run check:archetype-starter`.
- **Memory:** `PROJECT_STATE.yaml` archetype field + the copied starter scaffold.
- **Stopping condition:** `check:app-archetype` and `check:archetype-starter` both pass **and** the archetype field in `PROJECT_STATE.yaml` is set (the pack feeds the normal lanes; it does not bypass them).

### L07 — Provider-proof verification
- **Trigger:** Before marking any provider-backed lane (analytics, revenue, email, store, security, engineering) done.
- **Action:**
  1. Load `references/provider-proof.md` and gather live proof for the lane (e.g., `npm run probe:posthog`, `npm run probe:revenuecat`). → `Start Here` *Autopilot Run Contract*; `Start Here` step (provider-proof load).
  2. Record proof or an explicit founder-only gate in `PROVIDER_PROOF.md`; setup prose alone cannot mark the lane done. → *Autopilot Run Contract*.
- **Proof:** `npm run check:provider-proof`; live probe output or a named founder-only gate in `PROVIDER_PROOF.md`.
- **Memory:** `PROVIDER_PROOF.md` + `PROJECT_STATE.yaml` lane proof field.
- **Stopping condition:** `check:provider-proof` passes — each provider lane in `PROVIDER_PROOF.md` carries a probe/log artifact **or** a named founder-only gate; no provider lane reads `done` without one.

### L08 — Change cascade
- **Trigger:** Any change to a launched/near-launch app's feature, copy, brand vocabulary, pricing, products, design, or data behavior once a listing/landing/assets exist.
- **Action:**
  1. Classify the change against the Change Cascade Map. → `references/change-cascade.md` *Change Cascade Map*.
  2. Enumerate impacted surfaces (in-app, ASC listing/products, RevenueCat, landing+meta/JSON-LD, SEO/GEO, email, analytics, legal, content) per `LOCALIZATION_MARKET_RESEARCH.md` tiers, and update or justify each. → `change-cascade.md` *Process* + *Surface Inventory*.
  3. Re-render derived assets (screenshots/App Preview/ad creative) where copy/UI changed; reconcile the lexicon. → `change-cascade.md` *Process* steps 4–5; *Operating Posture* (Cascade every change).
- **Proof:** Every impacted surface updated or marked unaffected; derived assets re-rendered; lexicon consistent across surfaces.
- **Memory:** `LAUNCH_TRACE.md`/`CHANGE_LOG.md` + `PROJECT_STATE.yaml` lane evidence; `launch-cockpit.html` re-rendered.
- **Stopping condition:** The cascade table enumerates every surface from the matching Change Cascade Map rows (non-empty), every row is marked `updated|unaffected` (grep finds none unmarked), the Lexicon Lock grep returns 0 cross-surface mismatches, and the cascade is recorded in `LAUNCH_TRACE.md`/`CHANGE_LOG.md` — otherwise the `change-cascade-incomplete` failure card stays open.

### L09 — Research-backed spec
- **Trigger:** Need category/pricing/keyword/competitor/review-social-language/name-collision evidence before the spec is treated as ready.
- **Action:**
  1. Run category economics, competitor deep-dives, review/social-language mining (AppKittie, XPOZ), keyword scan, and name-collision checks. → Phase 1; *Operating Posture* (Evidence beats taste).
  2. Quarantine untrusted public content (reviews/social/scraped pages) and keep an evidence ledger in `RESEARCH.md`. → *Claude vs Codex Routing And Dynamic Workflows*; Phase 1.
  3. Produce the revised `SPEC.md` with the evidence ledger; lock the name before ASO/landing depend on it. → Phase 1; *Operating Posture* (Lock phase outputs).
- **Proof:** `RESEARCH.md` evidence ledger + `SPEC.md` with each claim sourced to App Store/competitor/review/XPOZ/funnel evidence.
- **Memory:** `RESEARCH.md`, `SPEC.md` + `PROJECT_STATE.yaml` research lane.
- **Stopping condition:** The `RESEARCH.md`/`SPEC.md` evidence ledger has ≥1 claim row and none has an empty source cell (grep finds no empty source), a name-collision result is recorded, and `lanes.research` reads `locked`.

### L10 — Localization market research
- **Trigger:** Before localizing any surface (metadata/keywords/screenshots, paywall/offers, landing, email, paid storefronts) or choosing which locales to ship.
- **Action:**
  1. Load `references/localization-market-research.md`; research per-storefront keyword popularity, difficulty, and demand (AppKittie, ASA, ASC App Analytics, XPOZ). → `Lane Routing` (localization); Phase 1.
  2. Rank markets into priority tiers (Tier 1 full localize / Tier 2 metadata-only / Tier 3 defer); localize on demand, not language. → `Lane Routing`; *Operating Posture*.
  3. Produce `LOCALIZATION_MARKET_RESEARCH.md` + `localization-market-research.html`. → `Lane Routing`.
- **Proof:** `npm run check:localization-research`; the opportunity matrix + priority tiers exist with demand evidence.
- **Memory:** `LOCALIZATION_MARKET_RESEARCH.md` + `PROJECT_STATE.yaml` localization lane.
- **Stopping condition:** `check:localization-research` passes — `LOCALIZATION_MARKET_RESEARCH.md` carries the per-storefront matrix and Tier 1/2/3 assignments with demand evidence on each row.

### L11 — Analytics & attribution blueprint
- **Trigger:** Before onboarding/paywalls/funnels/store CTAs/referrals/email lifecycle/paid UA, or any build prompt that names events.
- **Action:**
  1. Load `references/analytics-attribution.md`; map current PostHog docs, identity plan, and the self-reported attribution contract (early screen, stable source keys, `other` free text, person property, backend persistence, anon→identified reconciliation). → `Lane Routing`; Phase 1b.
  2. Build the event catalog, dashboards, experiment plan, and privacy guardrails in `ANALYTICS.md`; events named in `ONBOARDING.md`/`EMOTIONAL_DESIGN.md`/`VIRAL_GROWTH.md` must exist here first. → `Lane Routing`; `Lane Routing` (analytics-catalog reconciliation).
  3. Render `analytics-plan.html` early so measurement is inspectable. → Phase 1b.
- **Proof:** `npm run check:analytics-catalog` + `npm run check:attribution`; `analytics-plan.html` rendered.
- **Memory:** `ANALYTICS.md` + `PROJECT_STATE.yaml` analytics lane.
- **Stopping condition:** `check:analytics-catalog` and `check:attribution` both pass — every event named in ONBOARDING/EMOTIONAL_DESIGN/VIRAL_GROWTH resolves in `ANALYTICS.md`, and the self-reported attribution fields are all present.

### L12 — 11-star experience
- **Trigger:** "11-star run / pass" or before `SPEC.md`, onboarding, ads, store screenshots, content, or eng plans are treated as ready.
- **Action:**
  1. Load `references/eleven-star-experience.md`; if the founder said "11-star run", follow the *11-Star Run Protocol* before any other output. → `Lane Routing`; `Lane Routing` (eleven-star-experience).
  2. Define the 1/2/5/6/7/10/11-star ladder, draw the line of feasibility, and choose the V1 scalable slice. → Phase 1c.
  3. Produce `11_STAR_EXPERIENCE.md` + `11-star-experience.html`, then trace the V1 slice into product/design/analytics/revenue/store/content/build contracts. → `Lane Routing`.
- **Proof:** `npm run check:11-star`; the ladder, feasibility line, and V1 slice exist and trace outward.
- **Memory:** `11_STAR_EXPERIENCE.md` + `PROJECT_STATE.yaml` 11-star lane.
- **Stopping condition:** `check:11-star` passes — `11_STAR_EXPERIENCE.md` carries the 1–11 ladder, a marked line of feasibility, and a single named V1 slice traced outward.

### L13 — Emotional experience design (producer)
- **Trigger:** Any product/onboarding/core-loop/paywall work whose 11-star target is 6★+; "charge this feature with emotion", "make users stick / build a habit", "apply the commitment/variable-reward/perceived-effort/intent-mirroring card".
- **Action:**
  1. Load the Emotional Experience System set (`emotional-design-system.md` hub + `experience-cards.md` index, loading only in-scope per-card files); peer references `consumer-product-design-agency.md`/`quality-lens.md` cross-referenced. → `Lane Routing`; `Lane Routing`.
  2. Produce `EMOTIONAL_DESIGN.md` + `emotional-design.html`: Emotional North Star, target emotional curve, and a Card Application Map tying each magical moment to one named card + a PostHog event + a bright-line guardrail + a reduced-motion fallback. → `Lane Routing` (producer path).
  3. For HIGH-risk cards (variable reward, streak, scarcity, urgency, social proof) add a user-control escape hatch, a counter-metric, and a truthfulness proof; run the bright-line dark-pattern test. → `Lane Routing`; `references/ethics-guardrail.md`.
- **Proof:** `npm run check:emotional-design`; every applied card emits a named event + ethics attestation; dark patterns vetoed.
- **Memory:** `EMOTIONAL_DESIGN.md` + `PROJECT_STATE.yaml` emotional_design lane.
- **Stopping condition:** `check:emotional-design` passes — every Card Application Map row names a card + PostHog event + bright-line guardrail + reduced-motion fallback, HIGH-risk rows carry escape-hatch/counter-metric/truthfulness fields, and the bright-line dark-pattern test reports none.

### L14 — Emotional design audit (auditor)
- **Trigger:** "Audit this app's emotional design / emotional intelligence" or "emotional UX audit".
- **Action:**
  1. Load the Emotional Experience System set + `emotional-experience-design.md` (Six-Lens Review). → `Lane Routing` (auditor path).
  2. Enumerate every journey on-device and score each step through the Six-Lens Review. → `Lane Routing`.
  3. Produce `EMOTIONAL_AUDIT.md` giving each finding a concrete pathway to a better state, with ethics attestation on applied cards. → `Lane Routing` (auditor path).
- **Proof:** `npm run check:emotional-design`; `EMOTIONAL_AUDIT.md` enumerates journeys with per-step Six-Lens scores and remediation paths.
- **Memory:** `EMOTIONAL_AUDIT.md` + `PROJECT_STATE.yaml` emotional_design lane evidence.
- **Stopping condition:** `check:emotional-design` passes against `EMOTIONAL_AUDIT.md` — every enumerated journey step has a Six-Lens score and a remediation row (grep finds no unscored step); dark-pattern findings are filed as compliance vetoes.

### L15 — Paid user-acquisition system
- **Trigger:** Before paid ads, Apple Search Ads, Meta/TikTok/Google campaigns, CPP campaign routing, MMP/SDK choices, paid creative tests, or spend-readiness claims.
- **Action:**
  1. Load `references/paid-user-acquisition.md`; choose one-channel focus, creative production, and a tracking baseline. → `Lane Routing`; Phase 1d.
  2. Produce `PAID_UA.md`; trace blended reporting, RevenueCat LTV/CPA review, weekly cadence, and stop/scale rules into `ANALYTICS.md`/`REVENUE_OPS.md`/`APP_STORE_LISTING.md`/`LAUNCH_TRACE.md`. → `Lane Routing`.
  3. Mark founder-only spend gates explicitly. → `Lane Routing`; *Autopilot Run Contract* (founder gates).
- **Proof:** `npm run check:paid-ua`; one-channel choice + tracking baseline + stop/scale + spend gates present and traced.
- **Memory:** `PAID_UA.md` + `PROJECT_STATE.yaml` paid_ua lane.
- **Stopping condition:** `check:paid-ua` passes — `PAID_UA.md` records the one-channel choice, tracking baseline, RevenueCat LTV/CPA source, weekly cadence, and stop/scale rules; the `paid_user_acquisition` lane's spend gate stays unmet until founder-approved.

### L16 — Viral growth loop
- **Trigger:** Before referral unlocks, share-to-unlock, invite systems, social/comment loops, or features meant to spread on TikTok/Reels/Shorts.
- **Action:**
  1. Load `references/viral-growth-loops.md`; tie the 11-star slice to a product-led sharing/referral loop. → `Lane Routing`; Phase 1e.
  2. Produce `VIRAL_GROWTH.md`; trace product loop, content loop, monetization timing, abuse controls, and stop/scale rules into `LAUNCH_TRACE.md`/`ONBOARDING.md`/`REVENUE_OPS.md`/`UGC_PLAYBOOK.md`/`ANALYTICS.md`. → `Lane Routing`.
  3. Add abuse controls and analytics proof for every loop. → `Lane Routing`.
- **Proof:** `npm run check:viral-growth`; loop + abuse controls + analytics proof + stop/scale present and traced.
- **Memory:** `VIRAL_GROWTH.md` + `PROJECT_STATE.yaml` viral_growth lane.
- **Stopping condition:** `check:viral-growth` passes — `VIRAL_GROWTH.md` carries the product loop, abuse controls, analytics-event proof, and stop/scale rules, each traced to the named downstream docs.

### L17 — Launch narrative & cadence
- **Trigger:** Before drafting the announcement, the launch-day sequence, or the weekly release rhythm.
- **Action:**
  1. Load `references/launch-narrative-cadence.md`; set a feeling-first launch thesis + named emotional angle and the tentpole-plus-weekly-cadence model. → `Lane Routing`; Phase 1e.
  2. Produce `growth/LAUNCH_NARRATIVE.md` with a launch-day run-of-show, post copy in fenced blocks passing the 2026 guardrails (no hashtags/emojis; link in the first reply not the main post), a measurement plan, and founder-only posting gates. → `Lane Routing`.
  3. Trace it into `EMOTIONAL_DESIGN.md`/`11_STAR_EXPERIENCE.md`/`CONTENT_ASSETS.md`/`VIRAL_GROWTH.md`/`APP_STORE_LISTING.md`/`ANALYTICS.md`/`LAUNCH_TRACE.md`. → `Lane Routing`.
- **Proof:** `npm run check:launch-narrative`; copy passes the guardrails and the cadence/run-of-show exist.
- **Memory:** `growth/LAUNCH_NARRATIVE.md` + `PROJECT_STATE.yaml` launch_narrative lane.
- **Stopping condition:** `check:launch-narrative` passes (2026 copy-guardrail + tentpole/weekly-cadence + run-of-show asserts) **and** `lanes.launch_narrative` reads `locked`.

### L18 — Launch trace & build contracts
- **Trigger:** Moving from research to product experience / brand-design / implementation; deciding whether `TECH_SPEC.md` is needed.
- **Action:**
  1. Load `references/flow-traceability.md`; create `LAUNCH_TRACE.md` mapping evidence → product/11-star/paid-UA/viral/brand/design/build/analytics/revenue/privacy/store/verification. → `Lane Routing`; Phase 1f.
  2. Create `TECH_SPEC.md` when data/API/state/permissions/platform/integration behavior must be built. → `Lane Routing`; Phase 1f.
  3. Run the Lexicon Lock so one vocabulary holds across surfaces. → `flow-traceability.md` (Lexicon Lock, per change-cascade pairing).
- **Proof:** `LAUNCH_TRACE.md` connects each build decision back to evidence; `TECH_SPEC.md` exists when implementation is in scope.
- **Memory:** `LAUNCH_TRACE.md`, `TECH_SPEC.md` + `PROJECT_STATE.yaml` trace lane.
- **Stopping condition:** The `LAUNCH_TRACE.md` decision table is non-empty and every row has a non-empty evidence cell (grep) **and** the Lexicon Lock grep returns 0 cross-surface term mismatches; `TECH_SPEC.md` exists when implementation is in scope.

### L19 — Security architecture & release gate
- **Trigger:** Before threat modeling, hardening, OWASP MASVS/ASVS checks, MobSF/static scans, app-integrity decisions, Sentry/release-health, or any security-readiness claim.
- **Action:**
  1. Load `references/security-release-hardening.md`; build the threat model, data classification, and platform-hardening decisions in `SECURITY.md`. → `Start Here`; Phase 1g.
  2. Route Claude Security / Codex Security, run local scans (MobSF/static) or founder-approved paid security routes, and set entitlement/webhook abuse controls + monitoring/incident response. → `Start Here`; Phase 5c.
  3. Render `security-review.html`, resolve/accept risks, and attach proof to `PRODUCTION_READINESS.md`. → Phase 5c.
- **Proof:** `npm run check:security`; `security-review.html` rendered with scan/proof attached.
- **Memory:** `SECURITY.md`, `security-review.html` + `PROJECT_STATE.yaml` security lane.
- **Stopping condition:** `check:security` passes and `security-review.html` is rendered with scan output attached to `PRODUCTION_READINESS.md` — each residual risk is marked `resolved|accepted` with a named owner, or carries a founder gate.

### L20 — Design Room (state → mutate → version → render)
- **Trigger:** Any design, visual-system, cross-surface, App Store creative, landing, onboarding, paywall, or marketing-surface work.
- **Action:**
  1. **STATE:** read `state/business.json` + `state/theme.tokens.json` (seed from `state/` or `templates/state/` if missing). → SKILL.md *Design Room Contract* step 1.
  2. **MUTATE:** make one coherent JSON state mutation — no one-off proposal doc or ad-hoc HTML proof. → *Design Room Contract* step 2.
  3. **VERSION + RENDER:** `npm run validate:design-state`, `npm run render:design-room`, version with git (`git tag baseline/<name>`), and show `design-room.html` / `dist/design-room/`. → *Design Room Contract* steps 3–4; *Operating Posture* (design versioning is git state).
- **Proof:** `npm run check:design-room` + `npm run validate:design-state`; rendered Design Room reflects the state mutation.
- **Memory:** `state/business.json`, `state/theme.tokens.json`, git baselines + `PROJECT_STATE.yaml` design lane.
- **Stopping condition:** `check:design-room` and `validate:design-state` both pass **and** the mutation is committed as a git baseline tag (`baseline/<name>`) with `design-room.html` re-rendered from it.

### L21 — Token promotion
- **Trigger:** Theme tokens change and the design is accepted.
- **Action:**
  1. Run the token promotion path so `state/theme.tokens.json` flows into app-facing `design-system/` artifacts before implementation relies on the visual system (`npm run promote:design-tokens`). → SKILL.md *Design Room Contract* (token promotion paragraph); `Lane Routing`.
  2. Reconcile promoted tokens with `DESIGN.md` and downstream generated assets. → *Operating Posture* (token promotion as enforced contract).
- **Proof:** `npm run check:token-promotion`; promoted `design-system/` artifacts match the accepted tokens.
- **Memory:** `design-system/` artifacts + `PROJECT_STATE.yaml` design lane token state.
- **Stopping condition:** `check:token-promotion` passes — the promoted `design-system/` artifacts diff-match `state/theme.tokens.json` before implementation consumes them.

### L22 — UX patterns (Refero)
- **Trigger:** Before flow maps, state matrices, `UX_PATTERNS.md`, bug-trap coverage, or replacing Refero with a free fallback.
- **Action:**
  1. Load `references/refero-ux-patterns.md`; research web/mobile patterns via Refero, or a founder-approved free route using `templates/ux-patterns/`. → `Lane Routing`; `Lane Routing` (refero-ux-patterns).
  2. Produce `UX_PATTERNS.md` with flow maps, state matrices, a Premium Craft Details section, and bug traps. → `Lane Routing`; `premium-mobile-craft.md` pattern contract.
- **Proof:** `npm run check:ux-patterns`; flow maps + state matrices + bug traps present.
- **Memory:** `UX_PATTERNS.md` + `PROJECT_STATE.yaml` design/ux lane.
- **Stopping condition:** `check:ux-patterns` passes — `UX_PATTERNS.md` carries flow maps, state matrices, and bug traps for each V1 surface and records the Refero/fallback source.

### L23 — Onboarding conversion
- **Trigger:** Before onboarding quizzes, personalization, attribution questions, demo videos, App Review popups, paywall timing, trials, or first-session activation.
- **Action:**
  1. Load `references/onboarding-conversion.md`; design the onboarding sequence as the sales surface (value reveal, personalization/attribution capture, paywall/offer routing). → `Lane Routing`; Phase 1c surfaces.
  2. Place the native App Review popup immediately after the first value/value-reveal step. → `Lane Routing`.
  3. Wire onboarding analytics events into `ANALYTICS.md` (catalog reconciliation). → `Lane Routing`; L11.
- **Proof:** `npm run check:onboarding`; review-prompt placement and paywall timing satisfy the validator.
- **Memory:** `ONBOARDING.md` + `PROJECT_STATE.yaml` onboarding lane.
- **Stopping condition:** `check:onboarding` passes — the native App Review prompt sits immediately after the first value-reveal step and the paywall-timing/offer rows are present in `ONBOARDING.md`, before build handoff.

### L24 — Premium mobile craft
- **Trigger:** Before in-app UI build/polish, wiring press states/animation/haptics/keyboard/loading-empty states, or a "premium feel" request.
- **Action:**
  1. Load `references/premium-mobile-craft.md`; apply the invisible-details layer under `design-visual-system.md`/`refero-ux-patterns.md`/`emotional-design-system.md`. → `Lane Routing` (premium craft).
  2. Start from the shipped boilerplate `templates/design-system/PremiumCraft.swift` (with RN/Flutter parity), honoring Reduce Motion and reading `DesignTokens.Motion`. → `premium-mobile-craft.md` (boilerplate section).
  3. Record the Premium Craft Details + bug traps in `templates/ux-patterns/UX_PATTERNS.md`. → `premium-mobile-craft.md` (pattern contract).
- **Proof:** Press-state/haptics/keyboard/skeleton/empty-state details are implemented from the boilerplate and reflected in `UX_PATTERNS.md`; reduced-motion fallback present.
- **Memory:** `UX_PATTERNS.md` Premium Craft section + `PROJECT_STATE.yaml` design lane.
- **Stopping condition:** `check:ux-patterns` passes **and** the Premium Craft Details checklist in `UX_PATTERNS.md` has every row marked `done|n-a` (grep finds no unresolved row), including the reduced-motion fallback.

### L25 — Content assets / Remotion / generated visuals
- **Trigger:** Before rendered videos/stills, app-preview clips, ad/social/content variants, or claiming local rendered content assets are ready.
- **Action:**
  1. Load `references/remotion-content-assets.md` (and Higgsfield recipes in `tool-recipes/visual-and-motion-production.md`); decide Higgsfield vs Remotion local rendering per `paid-tool-routing.md`. → `Start Here` steps 15/22; `Lane Routing` (remotion-content-assets).
  2. Produce assets carrying current `DESIGN.md` tokens; record each in `CONTENT_ASSETS.md` with `prompt_brief`, `source_job_id`, `virality_score`, marking superseded entries. → `change-cascade.md` *Generated-Asset Regeneration* guardrails.
  3. Keep generated output as supporting art only — never substituting for truthful real app UI in screenshots/App Preview. → `change-cascade.md` guardrails.
- **Proof:** `npm run check:content-assets`; assets recorded with briefs/job ids and token basis.
- **Memory:** `CONTENT_ASSETS.md` (and `DEMO_VIDEO.md` where applicable) + `PROJECT_STATE.yaml` content lane.
- **Stopping condition:** `check:content-assets` passes — every `CONTENT_ASSETS.md` row has non-empty `prompt_brief`/`source_job_id` and a token basis, superseded rows are marked, and spend is founder-approved per `check:paid-tool-decisions`.

### L26 — Business Control Plane extension
- **Trigger:** Extending the Design Room into new analytics/monetization/store-ops/growth panels over the same state store and theme tokens.
- **Action:**
  1. Load `references/control-plane.md`; add the new panel over `state/business.json` + `state/theme.tokens.json` + `state/schema/business.schema.json` rather than a separate store. → `Lane Routing` (control-plane load); `control-plane.md` *Current Panel*.
  2. Keep the workspace read model consistent with the rendered panels. → *Operating Posture* (Control Plane as enforced contract).
- **Proof:** `npm run check:control-plane` + `npm run check:business-control-plane-workspace`.
- **Memory:** `state/business.json`/schema + the generated workspace read model + `PROJECT_STATE.yaml`.
- **Stopping condition:** `check:control-plane` and `check:business-control-plane-workspace` both pass — new panels render from `state/business.json` + `state/theme.tokens.json` with no separate store.

### L27 — ASO & store ops
- **Trigger:** Before App Store/Play metadata, screenshots, keyword research, Apple Search Ads, launch reviews, or post-launch growth loops.
- **Action:**
  1. Load `references/aso-store-ops.md`; do keyword research and draft App Store/Play metadata (name/subtitle/keywords/description/What's New). → `Lane Routing`; Phase 3.
  2. Plan ASA, ratings/reviews loops, and post-launch monitoring; localize per the `LOCALIZATION_MARKET_RESEARCH.md` tiers (L10). → `Lane Routing`.
- **Proof:** `npm run check:aso-metadata`; metadata fields validate against keyword/length rules.
- **Memory:** `APP_STORE_LISTING.md` ASO sections + `PROJECT_STATE.yaml` aso lane.
- **Stopping condition:** `check:aso-metadata` passes — every `APP_STORE_LISTING.md` ASO field is within its length/keyword rule and uses the locked name from L09.

### L28 — App Store listing prep packet
- **Trigger:** Before listing fields, interactive privacy questionnaire, IAP/subscription field maps, custom product pages, in-app events, or App Store marketing material tied to the design system.
- **Action:**
  1. Load `references/app-store-listing-prep.md`; assemble `APP_STORE_LISTING.md` (default listing fields, App Privacy answers, pricing/subscription setup, CPPs, in-app events, localization matrix). → `Lane Routing`; Phase 3.
  2. Align pricing/subscription copy with RevenueCat/Stripe/web-funnel (L40) and mark founder-only approval gates. → `Lane Routing`.
- **Proof:** `APP_STORE_LISTING.md` packet complete; App Privacy answers reconcile with `PRIVACY.md` (L41) and `GOOGLE_PLAY_RELEASE.md` Data Safety (L34).
- **Memory:** `APP_STORE_LISTING.md` + `PROJECT_STATE.yaml` listing lane.
- **Stopping condition:** `APP_STORE_LISTING.md` exists with every required-field section present and carries no `TODO`/empty token (grep), its App Privacy answers diff-match `PRIVACY.md`, and a founder-approval gate row precedes ASC entry.

### L29 — Apple signing & release readiness
- **Trigger:** Before Apple Developer enrollment, Team ID, bundle/App IDs, signing, capabilities, certificates, profiles, archives, exports, uploads, or TestFlight.
- **Action:**
  1. Load `references/apple-signing-release.md`; record account/Team ID/bundle ID/app record/signing/certificate/profile/archive/export/upload/TestFlight state in `APPLE_SIGNING.md`. → `Lane Routing`; Phase 3.
  2. State why simulator builds do or do not prove distribution readiness. → `Lane Routing`.
- **Proof:** `npm run check:apple-signing`; the signing packet is complete with founder-gated account steps flagged.
- **Memory:** `APPLE_SIGNING.md` + `PROJECT_STATE.yaml` signing lane.
- **Stopping condition:** `check:apple-signing` passes — `APPLE_SIGNING.md` records each of account/Team ID/bundle ID/cert/profile/archive/upload state, with founder-only enrollment/credential steps flagged as named gates.

### L30 — Apple App Store requirements (privacy manifest)
- **Trigger:** Before ASC upload readiness — `PrivacyInfo.xcprivacy`, required-reason APIs, third-party SDK manifests, App Privacy answers.
- **Action:**
  1. Load `references/apple-app-store-requirements` guidance; create `APPLE_APP_STORE_REQUIREMENTS.md` reconciling `PrivacyInfo.xcprivacy`, `NSPrivacyCollectedDataTypes`/`NSPrivacyAccessedAPITypes`, required-reason API reasons, tracking domains, SDK manifests/signatures, App Privacy answers, purpose strings, ATT, account deletion, review notes, and archive/upload warnings. → `Lane Routing`; Phase 3.
  2. Require founder approval before ASC upload/submission. → `Lane Routing`.
- **Proof:** `npm run check:apple-requirements`; the packet reconciles manifest/privacy answers/required-reason APIs.
- **Memory:** `APPLE_APP_STORE_REQUIREMENTS.md` + `PROJECT_STATE.yaml` apple-requirements lane.
- **Stopping condition:** `check:apple-requirements` passes — the validator confirms `APPLE_APP_STORE_REQUIREMENTS.md` matches the manifest, required-reason APIs, and App Privacy answers, with a founder-approval gate row before upload.

### L31 — Store console workflow
- **Trigger:** Before "where do I click / what do I paste" handoffs in App Store Connect or Google Play Console.
- **Action:**
  1. Load `references/store-console-workflow.md`; produce `STORE_CONSOLE.md` + `store-console.html` naming the exact ASC/Play pages, the field-by-field paste values, and which items need founder approval. → `Lane Routing`; Phase 3.
- **Proof:** `npm run check:store-console`; the packet maps each console page to its paste values and approval gates.
- **Memory:** `STORE_CONSOLE.md` + `store-console.html` + `PROJECT_STATE.yaml` store-console lane.
- **Stopping condition:** `check:store-console` passes — `STORE_CONSOLE.md` maps every required ASC/Play page to its paste values and marks each founder-approval gate (grep finds no "set this up in the console" placeholder).

### L32 — ASC CLI automation
- **Trigger:** Before automating App Store Connect with the Rork `asc` CLI / CLI skill pack — app creation, metadata, screenshots, TestFlight, review status, RevenueCat catalog sync.
- **Action:**
  1. Load `references/app-store-connect-cli.md`; refresh local `asc` CLI help first. → `Lane Routing`; *Source Freshness*.
  2. If `asc` is installed, run the auth-recovery ladder (keychain profiles, account-level keys, `asc auth init/login`) instead of reporting "cannot access ASC"; report any missing app/cert/RevenueCat record as a founder-gated setup step with the exact next command. → *Operating Posture* (ASC access as setup, not a wall).
- **Proof:** `asc` auth succeeds or the exact founder-gated next command is recorded; CLI command basis matches refreshed help.
- **Memory:** `STORE_CONSOLE.md`/`APP_STORE_LISTING.md` ASC-CLI notes + `PROJECT_STATE.yaml`.
- **Stopping condition:** `asc` commands exit 0, **or** each blocker is recorded in `PROJECT_STATE.yaml` as a founder-gated step with the exact next command (grep finds no bare "cannot access ASC" string).

### L33 — Store screenshots production
- **Trigger:** Store screenshots needed (raw app capture → composed iPhone/iPad/Play assets).
- **Action:**
  1. Capture raw app screens via the in-app iOS Simulator / MobAI / Codex Desktop native iOS / XcodeBuildMCP / serve-sim / SnapshotPreviews (preview-only when used) per the screenshot matrix. → `Lane Routing`; Phase 3 (screenshot matrix).
  2. Produce `SCREENSHOTS.md`; compose copy-led iPhone/iPad/Play assets via ParthJadhav/app-store-screenshots or an equivalent export board with current device wells; validate and visual-QA. → `Lane Routing`.
- **Proof:** `npm run check:store-screenshots` + `npm run grade:screenshots`; composed assets pass device-well validation + visual QA.
- **Memory:** `SCREENSHOTS.md` + `PROJECT_STATE.yaml` screenshots lane.
- **Stopping condition:** `check:store-screenshots` and `grade:screenshots` both pass — composed assets clear device-well validation and the visual-QA grade threshold, or blocked sets are named in `SCREENSHOTS.md`.

### L34 — Google Play release
- **Trigger:** Android in scope — platforms include android, or an android bundle id exists.
- **Action:**
  1. Load `references/google-play-release.md`; produce `GOOGLE_PLAY_RELEASE.md` (developer account type, Data Safety reconciled with iOS labels, content rating, Play App Signing/AAB, target API level, release tracks). → `Lane Routing`; Phase 3.
  2. Plan the personal-account closed-testing gate (12 testers / 14 days) into the launch calendar from day one and triage the pre-launch report. → `Lane Routing`.
- **Proof:** `npm run check:google-play`; Data Safety reconciles with iOS privacy labels and the closed-testing gate is scheduled.
- **Memory:** `GOOGLE_PLAY_RELEASE.md` + `PROJECT_STATE.yaml` google-play lane.
- **Stopping condition:** `check:google-play` passes — `GOOGLE_PLAY_RELEASE.md` Data Safety diff-matches the iOS privacy labels and the closed-testing gate is on the calendar, or each blocker is recorded.

### L35 — Engineering orchestration (CE + production readiness)
- **Trigger:** Before actual app implementation, backend/frontend work, generated builder prompts, parallel agents/worktrees, or production-readiness claims.
- **Action:**
  1. Load `compound-engineering-routing.md` + `parallel-agent-orchestration.md` + `engineering-orchestration.md`; route through CE freshness, `ce-brainstorm` (if product shape unresolved), `ce-plan`, `ce-work`/`ce-worktree`, `ce-code-review`, CE test + proof skills. → `Lane Routing`; Phase 5b.
  2. If CE is unavailable, record the fallback in state and run the Standalone Engineering Loop (plan → bounded slices → adversarial review → test → proof) with the same evidence bar. → `Lane Routing` (`engineering-orchestration.md` §1b).
  3. Produce `ENGINEERING_PLAN.md`, `ORCHESTRATION.md`, and `PRODUCTION_READINESS.md`; serialize shared resources and run MobAI/native iOS E2E (L38/L39). → Phase 5b.
- **Proof:** `npm run check:compound-engineering` + `npm run check:orchestration`; all five engineering stages (plan/slice/review/test/proof) carry evidence.
- **Memory:** `ENGINEERING_PLAN.md`, `ORCHESTRATION.md`, `PRODUCTION_READINESS.md` + `PROJECT_STATE.yaml` engineering lane.
- **Stopping condition:** `check:compound-engineering` and `check:orchestration` both pass — `PRODUCTION_READINESS.md` carries an evidence artifact for each of the five stages (plan/slice/review/test/proof); the `engineering` lane stays `partial` until all five are present.

### L36 — Backend data contract
- **Trigger:** Before schema/auth prompts run or `TECH_SPEC.md` data/API sections harden; founder wants Firebase/custom instead of the Supabase default.
- **Action:**
  1. Load `references/backend-data-contract.md`; record Backend Selection (supabase default / firebase / custom) with a reason, the Data Model, the tested Authorization Model (RLS/security rules/middleware authz), and Migrations And Environments. → `Lane Routing`; Phase 5b.
  2. Adapt archetype prompts to the selected route instead of running the Supabase defaults verbatim. → `Lane Routing`.
- **Proof:** `npm run check:backend-contract`; the authorization model is tested (RLS/security-rule tests) and the data contract is complete.
- **Memory:** `TECH_SPEC.md` Data Contract section + `PROJECT_STATE.yaml` backend lane.
- **Stopping condition:** `check:backend-contract` passes — `TECH_SPEC.md` Data Contract records backend selection + reason, data model, a passing authz test (RLS/security-rule), and migrations/environments.

### L37 — App agent roster & repo entrypoints
- **Trigger:** Before builder handoff bundles, business `AGENTS.md`/`CLAUDE.md`, `APP_AGENTS.md`, or `agents/` role prompts.
- **Action:**
  1. Load `references/app-agent-roster.md`; fill the shipped `templates/repo-agent-entrypoints/` `AGENTS.md`+`CLAUDE.md` with app-specific context so future agents keep using this skill without another founder prompt. → `Lane Routing`; Phase 5.
  2. Create `APP_AGENTS.md` + the seven role prompts under `agents/` (orchestrator, marketing-guru, engineering-leader, product-leader, design-guru, customer-success, security-architect). → `Lane Routing`.
- **Proof:** `npm run check:agent-entrypoints`; the entrypoints + roster + seven roles exist and route back to the skill.
- **Memory:** business `AGENTS.md`/`CLAUDE.md`, `APP_AGENTS.md`, `agents/` + `PROJECT_STATE.yaml` handoff lane.
- **Stopping condition:** `check:agent-entrypoints` passes — business `AGENTS.md`/`CLAUDE.md`, `APP_AGENTS.md`, and all seven `agents/*.md` role files exist and route back to the skill.

### L38 — MobAI device automation & demo videos
- **Trigger:** Before MobAI device automation, app-flow demo videos, app-preview clips, or bug-repro recordings.
- **Action:**
  1. Load `references/mobai-toolbelt.md`; use MobAI recorder skills to capture flows (`.mob`/`screenplay.json`). → `Start Here` steps 13/22; `Lane Routing` (mobai-toolbelt).
  2. Record raw capture, final export, captions, upload copy, and rerender path in `DEMO_VIDEO.md`/`CONTENT_ASSETS.md`. → Deliverable Standard (MobAI artifacts).
- **Proof:** Demo artifacts recorded with `.mob`/`screenplay.json`, raw capture, export, captions, and rerender path; MobAI used per `paid-tool-routing.md` (L04).
- **Memory:** `DEMO_VIDEO.md`/`CONTENT_ASSETS.md` + `PROJECT_STATE.yaml` demo lane.
- **Stopping condition:** At least one demo artifact row exists in `DEMO_VIDEO.md`/`CONTENT_ASSETS.md` with non-empty `source`/`rerender` fields (grep), **or** the MobAI-access blocker is recorded in `PROJECT_STATE.yaml`; no free-fallback downgrade without `check:paid-tool-decisions` approval.

### L39 — Native iOS proof (Route Ladder)
- **Trigger:** Before any Apple simulator/device proof — in-app iOS Simulator (rung 0), Codex Desktop native iOS, XcodeBuildMCP, serve-sim, or SnapshotPreviews — or command examples.
- **Action:**
  1. Load `references/xcodebuildmcp-testing.md` and start at its Route Ladder; on a local Mac, rung 0 (the in-app iOS Simulator) needs no install at all. Refresh official docs + local `xcodebuildmcp --help`, tool lists, SnapshotPreviews + serve-sim READMEs before writing commands for the higher rungs. → `Lane Routing`; *Source Freshness*.
  2. Run device/simulator E2E and capture proof, marking SnapshotPreviews exports preview-only. For rung 0, record the local session, the simulated device and OS, the fixture account, and the coverage the route does not provide. → `Lane Routing`; Phase 5b.
- **Proof:** `scripts/check-native-ios-proof.ts` (run via `npm run audit`); E2E/screenshot proof attached with the docs/CLI basis recorded.
- **Memory:** `PRODUCTION_READINESS.md` native-iOS proof section + `PROJECT_STATE.yaml`.
- **Stopping condition:** `scripts/check-native-ios-proof.ts` passes under `audit:ci` — `PRODUCTION_READINESS.md` carries E2E/screenshot proof with the recorded docs/CLI basis (SnapshotPreviews rows marked preview-only), or the blocker is recorded.

### L40 — Revenue monetization
- **Trigger:** Before RevenueCat, Stripe, app-store products, web billing, paywalls, subscriptions, webhooks, taxes, pricing, or entitlement validation.
- **Action:**
  1. Load `references/revenue-monetization.md`; choose RevenueCat + Stripe/Web Billing, define products, entitlement identity, paywall, and webhooks. → `Lane Routing`; Phase 3b.
  2. Produce `REVENUE_OPS.md`; validate sandbox and production purchases and reconcile pricing with `APP_STORE_LISTING.md`/legal. → Phase 3b.
- **Proof:** `npm run check:revenue` + `npm run probe:revenuecat`; sandbox + production purchase validation evidence (provider-proof, L07).
- **Memory:** `REVENUE_OPS.md` + `PROJECT_STATE.yaml` revenue lane.
- **Stopping condition:** `check:revenue` and `probe:revenuecat` both pass — `REVENUE_OPS.md` records a sandbox purchase granting the entitlement in app+backend, the production gate is marked founder-only, and prices diff-match `APP_STORE_LISTING.md`.

### L41 — Privacy & terms
- **Trigger:** Before drafting/publishing privacy policy, terms, EULA, subscription terms, data-deletion flows, or app-store privacy disclosures.
- **Action:**
  1. Load `references/privacy-terms.md`; draft `PRIVACY.md` + `TERMS.md` (and account-deletion/subscription terms) from `templates/PRIVACY.md`/`TERMS.md`. → `Lane Routing`.
  2. Reconcile App Store App Privacy answers + Play Data Safety with actual data collection/SDKs (pairs with L28/L30/L34). → `Lane Routing`; `change-cascade.md` privacy row.
- **Proof:** `PRIVACY.md`/`TERMS.md` published; privacy answers reconcile with the manifest, Data Safety, and analytics/SDK reality.
- **Memory:** `PRIVACY.md`, `TERMS.md` + `PROJECT_STATE.yaml` legal lane.
- **Stopping condition:** `PRIVACY.md` and `TERMS.md` exist, are non-empty, and carry no placeholder token (grep), and their App Privacy/Data Safety answers diff-match the `check:apple-requirements`/`check:google-play` packets; publishing stays a founder gate.

### L42 — Resend email ops
- **Trigger:** Before Resend domains/keys, transactional/lifecycle/broadcast email, contacts/topics, webhooks, inbound, unsubscribe, or deliverability work.
- **Action:**
  1. Load `references/resend-email-ops.md`; configure sender-domain DNS (SPF/DKIM), API keys (via L05), and starter templates from `templates/resend/email-templates.ts`. → `Lane Routing`; Phase 4.
  2. Produce `EMAIL_OPS.md` recording the SPF/DKIM basis, unsubscribe handling, and the `DESIGN.md` brand-token mapping; populate brand/tone from `DESIGN.md`/`11_STAR_EXPERIENCE.md`. → `Lane Routing`; `Lane Routing` (resend).
- **Proof:** `npm run check:email`; proof artifacts + `EMAIL_OPS.md` with DNS basis, unsubscribe, and brand-token mapping (provider-proof, L07).
- **Memory:** `EMAIL_OPS.md` + `PROJECT_STATE.yaml` email lane.
- **Stopping condition:** `check:email` passes — `EMAIL_OPS.md` records the SPF/DKIM basis, unsubscribe handling, the DESIGN.md brand-token mapping, and a Resend send/webhook log proof.

### L43 — GEO/SEO public visibility
- **Trigger:** Before editing any file with landing/policy/blog copy, component-level copy, screenshot metadata, `robots.txt`, `llms.txt`, `sitemap.xml`, schema, or metadata — not after the rewrite.
- **Action:**
  1. Load `references/geo-seo.md` before the first file edit; set target keywords, citability content, brand-entity signals, schema/JSON-LD, and AI-crawler access. → `Lane Routing`.
  2. Verify crawlability, schema marking, and AI-search discoverability after edits. → `Lane Routing`; *Operating Posture* (Verify what shipped).
- **Proof:** Public pages are crawlable, schema-marked, and AI-discoverable (overlaps with `check:landing-funnel` checks where the funnel exists).
- **Memory:** landing/policy files + `LAUNCH_TRACE.md` SEO/GEO notes + `PROJECT_STATE.yaml` geo lane.
- **Stopping condition:** `check:landing-funnel` passes (robots/sitemap/llms/schema asserts) **and** a live `curl` of the deployed page returns the expected JSON-LD block.

### L44 — Pre-launch funnel (landing/waitlist)
- **Trigger:** Phase 4 — landing page, waitlist/referral loop, web monetization funnel, domain, routed support/privacy email, live deploy verification.
- **Action:**
  1. Build the landing page + waitlist/referral loop (optional web monetization funnel from L40); wire domain, routed support/privacy email aliases (L42), PostHog/GA/Sentry, security headers, and GEO/SEO (L43). → Phase 4.
  2. Run local build, deploy checks, live HTTP checks, form-submission smoke tests, and analytics-event verification. → *Operating Posture* (Verify what shipped).
- **Proof:** `npm run check:landing-funnel`; live deploy + form submission + analytics events verified.
- **Memory:** landing repo/assets + `PROJECT_STATE.yaml` funnel lane.
- **Stopping condition:** `check:landing-funnel` passes and the live deploy is verified by an HTTP 200 + a form-submission smoke test + a PostHog event appearing; public deploy stays a founder gate.

### L45 — UGC creator engine
- **Trigger:** Before founder-led organic social, UGC sourcing, creator contracts/payments, or format-discovery tests.
- **Action:**
  1. Load `references/ugc-creator-engine.md` (and `viral-growth-loops.md` first when the plan depends on referrals/share-to-unlock/paywall timing). → `Lane Routing`; `Lane Routing` (ugc-creator-engine).
  2. Produce `UGC_PLAYBOOK.md`: UGC fit decision, 90-day creator format-discovery plan, sourcing approach, creator budget, script/format loop, disclosure rules, and stop/scale thresholds. → Deliverable Standard (UGC fit).
- **Proof:** `UGC_PLAYBOOK.md` complete with fit decision, 90-day plan, disclosure rules, and stop/scale thresholds; creator spend founder-gated (L04).
- **Memory:** `UGC_PLAYBOOK.md` + `PROJECT_STATE.yaml` ugc lane.
- **Stopping condition:** `UGC_PLAYBOOK.md` contains all five named rows — fit decision, 90-day plan, budget, disclosure rules, stop/scale thresholds — each present and non-empty (grep finds none missing or empty); creator payments/contracts stay a named founder gate.

### L46 — Fastlane growth ops
- **Trigger:** After launch approval/public beta, or usefastlane.ai setup, social account connection, Blitz angles/preferences, generated content, scheduling, or social analytics.
- **Action:**
  1. Load `references/fastlane-growth-ops.md`; set up the Fastlane workspace, social connections, and Blitz angles/preferences, feeding MobAI/native iOS/Higgsfield/Remotion media inputs (L25/L38/L39). → `Lane Routing`; Phase 6.
  2. Produce `FASTLANE_OPS.md`; QA generated/rendered content and run the weekly iteration loop. → Phase 6.
- **Proof:** `FASTLANE_OPS.md` workspace + connections + angles recorded; scheduling/posting founder-approved; analytics snapshots captured.
- **Memory:** `FASTLANE_OPS.md` + `PROJECT_STATE.yaml` fastlane lane.
- **Stopping condition:** `FASTLANE_OPS.md` exists with the workspace, connections, Blitz-angles, and weekly-loop sections present and a QA-pass log line recorded; social-account connection and posting/scheduling stay named founder gates.

### L47 — Post-launch operations
- **Trigger:** App live (phase_6/6b), "what now", weekly ops, incident response, review-response, or retention-review work.
- **Action:**
  1. Load `references/post-launch-operations.md`; produce `POST_LAUNCH_OPS.md` (Weekly Operating Rhythm, Crash Triage with route + release gate, Review Responses with an SLA, Release/Hotfix Cadence with staged rollout, Retention Review with cohort source + churn split, Support Operations). → `Lane Routing`; Phase 6b.
  2. Write `LAUNCH_RETRO.md` at launch +7/30/90 days so misses become failure cards + LaunchBench candidates; revisit any lite-tier deferred lanes at day 30. → Phase 6b.
- **Proof:** `npm run check:post-launch`; the weekly rhythm + retro cadence are present with SLAs and cohort sources.
- **Memory:** `POST_LAUNCH_OPS.md`, `LAUNCH_RETRO.md` + `PROJECT_STATE.yaml` post_launch_ops lane.
- **Stopping condition:** `check:post-launch` passes — `POST_LAUNCH_OPS.md` carries the weekly rhythm with a review-response SLA + crash route + cohort source, and `LAUNCH_RETRO.md` exists at the +7/30/90 cadence.

### L48 — Source-freshness maintenance (maintainer)
- **Trigger:** Maintaining this skill, adding external URLs, refreshing third-party docs/commands, or reviewing weekly source diffs.
- **Action:**
  1. Load `references/source-freshness-maintenance.md`; register every new external URL in `references/source-registry.yaml`. → `Lane Routing`; AGENTS.md *Source Freshness*.
  2. Refresh official docs / local CLI `--help` before changing any fast-moving command guidance and record the basis. → AGENTS.md *Source Freshness*.
  3. Run `npm run check:source-registry` and `npm run refresh:source-freshness`. → AGENTS.md Commands.
- **Proof:** `npm run check:source-registry` passes; refreshed candidates are reviewed before becoming accepted policy.
- **Memory:** `source-registry.yaml` + the reference/template/validator updates backing each candidate.
- **Stopping condition:** `check:source-registry` passes — every external URL is in `source-registry.yaml` with a recorded docs basis; auto-discovered candidates stay flagged until backed by a reference/template/validator update.

### L49 — LaunchBench / failure-cards / coverage audit
- **Trigger:** Before any launch-readiness claim, after a repeated agent miss, or when adding a validator/scenario.
- **Action:**
  1. Load `references/launchbench-evals.md` + `references/failure-cards.md`; run `npm run launchbench` (definition lint + deterministic fixtures) and `npm run check:lane-coverage`. → `Lane Routing`; `Lane Routing` (launchbench/failure-cards).
  2. Turn known misses into failure cards or LaunchBench scenarios (not oral lore); keep the split honest — `evals:behavioral` is the opt-in live-agent subset, not the same as `launchbench`. → `Lane Routing`; `Lane Routing`.
- **Proof:** `npm run launchbench` + `npm run check:lane-coverage` pass (or active failure cards are explicit); `npm run test:validators` green.
- **Memory:** `FAILURE_CARDS.md` + `evals/launchbench/` scenarios + `PROJECT_STATE.yaml` active failure cards.
- **Stopping condition:** `launchbench`, `check:lane-coverage`, and `test:validators` all pass — readiness is claimed only on green, with any remaining miss recorded as an open `FAILURE_CARDS.md` row.

### L50 — Skill runtime sync & version discipline (maintainer)
- **Trigger:** After any skill change — bump the version, sync the installed runtime (maintainer machine only), and run the readiness gate.
- **Action:**
  1. Load `references/skill-versioning.md`; bump `skill-version.json` and pass `check:version-discipline`/`check:skill-version`. → `Lane Routing`; AGENTS.md *Runtime Sync*.
  2. On the maintainer machine only (where `~/.codex/skills/b2c-mobile-business-launch` exists), mirror the checkout into the installed runtime, run the runtime audit, and verify the Claude/Agents symlinks; in clones/CI/cloud, skip runtime sync and use `npm run audit:ci` as the readiness gate. → CLAUDE.md (maintainer note); AGENTS.md *Runtime Sync*.
- **Proof:** `npm run check:skill-version` + `npm run check:version-discipline` pass; `npm run audit`/`audit:ci` green; runtime `diff -qr` clean where sync applies.
- **Memory:** `skill-version.json` manifest + the installed runtime copy (maintainer machine).
- **Stopping condition:** `check:skill-version`, `check:version-discipline`, and `audit:ci` all pass; on the maintainer machine `diff -qr` of source vs installed runtime is empty, else the non-maintainer skip is recorded in the work summary.

### L51 — Founder-zero operator bootstrap
- **Trigger:** Every broad launch start; before account/social/Doppler bootstrap; when the founder is unsure what to do next; whenever an agent is about to hand back a checklist instead of operating the business.
- **Action:**
  1. Load `references/founder-zero-operator.md` and seed access state before asking the founder anything a repo read can answer. → `Start Here` (recover source truth); `Lane Routing` (founder-zero operating).
  2. Record business identity, access, and the one-decision-at-a-time gates in `BUSINESS_ACCESS.md` + `operations/business-access.json`. → `Lane Routing` (founder-zero operating).
  3. Run `npm run check:founder-operator -- --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml`. → AGENTS.md Commands.
- **Proof:** `check:founder-operator` passes; the rendered cockpit phase matches `PROJECT_STATE.yaml`.
- **Memory:** `BUSINESS_ACCESS.md`, `operations/business-access.json`.
- **Stopping condition:** `check:founder-operator` passes — `BUSINESS_ACCESS.md` exists with its required sections and the rendered cockpit phase label equals the `phase` field in `PROJECT_STATE.yaml`. The validator fails closed on a missing artifact, so the stop cannot fire before the bootstrap runs.

### L52 — Agent operations ledger
- **Trigger:** Before any authenticated browser, API, CLI, or native action against a provider, social, or store account.
- **Action:**
  1. Load `references/frontier-agent-operations.md` before the first authenticated action. → `Lane Routing` (agent operations).
  2. Record the action, its authorization basis, and its outcome in `AGENT_OPERATIONS.md` + `operations/agent-operations.json`. → `Lane Routing` (agent operations).
  3. Tie every provider-backed claim to `PROVIDER_PROOF.md` rather than to prose. → `Prove It Before Calling It Done`.
  4. Run `npm run check:agent-operations -- --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml`. → AGENTS.md Commands.
- **Proof:** `check:agent-operations` passes; provider claims resolve to `PROVIDER_PROOF.md`.
- **Memory:** `AGENT_OPERATIONS.md`, `operations/agent-operations.json`, `PROVIDER_PROOF.md`.
- **Stopping condition:** `check:agent-operations` passes — the ledger exists and every recorded authenticated action carries an authorization basis and a recorded outcome. Fails closed when the ledger is absent, so an unrun lane cannot stop vacuously.

### L53 — Writing-quality gate (no-slop)
- **Trigger:** Before writing or reviewing any founder-facing copy, or any marketing copy this skill generates — onboarding, store listing, landing, paywall, lifecycle email, ads, launch posts, UGC scripts, GEO/SEO metadata.
- **Action:**
  1. Load `references/no-slop-writing.md` and establish the voice being protected from `BRAND.md` and `11_STAR_EXPERIENCE.md` before cutting a word. → `Lane Routing` (writing quality); no-slop-writing.md §1.
  2. Cut the banned words and named slop patterns; apply the per-channel character limits. → no-slop-writing.md §§4–5, §7.
  3. Run `npm run check:no-slop -- --root skill/b2c-mobile-business-launch/templates --skill-root skill/b2c-mobile-business-launch`. The gate parses its rule table out of the reference, so edit the reference and the gate follows. → AGENTS.md *Founder-Facing Copy*.
- **Proof:** `check:no-slop` reports zero errors; it errors on shipped copy surfaces and this repo's public docs, and warns on guidance prose.
- **Memory:** the edited copy surfaces + the `references/no-slop-writing.md` rule table the gate parses.
- **Stopping condition:** the edited copy surface exists and is non-empty, **and** `check:no-slop` exits 0 with zero errors. The existence clause comes first because a zero-error result over an absent surface is vacuously true. The judgment-dependent rules are deliberately outside the gate, so the terminator is the error count alone, never an assessment of whether the copy reads well.

### L54 — Founder-language translation (maintainer)
- **Trigger:** Adding or renaming a lane, status, phase, autonomy mode, or provider route; any change to a founder-visible surface.
- **Action:**
  1. Add the founder label in `scripts/lib/founder-copy.ts` in the *same commit* as the new lane, status, phase, autonomy mode, or provider route. → AGENTS.md *Founder-Facing Copy*.
  2. Route every founder-visible renderer through `lib/founder-copy.ts`; never print a raw `PROJECT_STATE.yaml` key into a founder surface. → AGENTS.md *Founder-Facing Copy*.
  3. When renaming a founder-visible heading, grep `scripts/` first — `check-founder-operator-bootstrap.ts` and `check-agent-operations.ts` both split the rendered cockpit on a literal `<h2>` string, so the rename and the validator update are one commit. → AGENTS.md *Founder-Facing Copy*.
  4. Run `npm run check:founder-copy -- --root skill/b2c-mobile-business-launch/templates --skill-root skill/b2c-mobile-business-launch`. → AGENTS.md Commands.
- **Proof:** `check:founder-copy` passes.
- **Memory:** the label table in `scripts/lib/founder-copy.ts`; the rendered cockpit.
- **Stopping condition:** `check:founder-copy` passes — every lane, status, phase, and autonomy mode in `lib/launch-state.ts` has founder copy, and no snake_case, SCREAMING_SNAKE, or pipe-delimited token reaches a founder-visible surface. Coverage is computed from `launch-state.ts`, so an unlabeled new lane fails the gate.

### L55 — Skill triggering contract (maintainer)
- **Trigger:** Changing `SKILL.md` frontmatter, the skill description, or the trigger phrasing that decides when this skill loads.
- **Action:**
  1. Keep the frontmatter description Anthropic-compatible — present, within the length ceiling, free of XML angle brackets, and carrying the required terms. → `check-autopilot-contract.ts`.
  2. Update `evals/triggering/autopilot-triggering.yaml` in the same commit so the triggering eval matches the new phrasing. → `check-autopilot-contract.ts`.
  3. Run `npm run check:autopilot`. → audit plan step.
- **Proof:** `check:autopilot` passes.
- **Memory:** `SKILL.md` frontmatter + `evals/triggering/autopilot-triggering.yaml`.
- **Stopping condition:** `check:autopilot` passes — the frontmatter parses to an object, the description is present, within length, angle-bracket-free, and carries its required terms, and the triggering eval parses. Fails closed when either file is missing.

### L56 — ASC command contract (maintainer)
- **Trigger:** Before changing any documented `asc` command in `references/app-store-connect-cli.md`.
- **Action:**
  1. Refresh the installed CLI's `--help`/version output first; never update a third-party command example from memory. → AGENTS.md *Source Freshness* and *Guardrails*.
  2. Reconcile every documented command against what the installed CLI actually reports. → `check-asc-command-contract.ts`.
  3. Run `npm run check:asc-command-contract -- --skill-root skill/b2c-mobile-business-launch`. → AGENTS.md Commands.
- **Proof:** `check:asc-command-contract` reports zero errors.
- **Memory:** the command table in `references/app-store-connect-cli.md`.
- **Stopping condition:** `check:asc-command-contract` exits 0 with zero errors. A missing reference is an error, so the stop cannot fire on an absent artifact; an installed CLI older than the stored contract downgrades to a named `live_cli_stale` warning rather than blocking, which keeps the stop reachable on a machine with a shadowed `asc`.

---

## Distinctness Notes (no-overlap justification)

- **L01 vs L50** — both touch `skill-versioning.md`, but L01 is the *consumer-side* freshness gate (founder asks to update before doing launch work) and L50 is the *maintainer-side* sync after changing the skill. Distinct trigger, distinct artifact (`PROJECT_STATE.yaml` decision vs `skill-version.json` bump).
- **L13 vs L14** — same Emotional Experience System references, but the producer path emits `EMOTIONAL_DESIGN.md` (design-forward) and the auditor path emits `EMOTIONAL_AUDIT.md` (Six-Lens scoring of an existing app). The `Lane Routing` emotional-design row explicitly splits them.
- **L20 vs L21 vs L26** — all over `state/`, but L20 is the per-change STATE→RENDER cycle, L21 is the one-shot token→`design-system/` promotion, and L26 is *extending* the Control Plane with new panels. Separate validators (`check:design-room`, `check:token-promotion`, `check:control-plane`).
- **L27–L34** are all "store ops" but each has a distinct artifact + validator (ASO metadata, listing packet, signing, requirements/privacy manifest, console script, ASC CLI, screenshots, Play). They reconcile with each other (privacy answers, pricing) without duplicating.
- **L24 (`premium-mobile-craft`)** is folded under design but kept distinct from L22 (UX patterns / flow shape) because it owns the in-app *craft* layer and ships `PremiumCraft.swift`. `consumer-product-design-agency.md` is treated as a peer grounding reference for L13/L14 rather than its own loop (it explicitly says "do not duplicate" the emotional/quality/onboarding references), avoiding an overlap.
- **L43 vs L44** — GEO/SEO is the copy/crawlability discipline that must load *before the first file edit*; the funnel loop is the build-and-verify-the-landing-site workflow. They cooperate (`check:landing-funnel`) without sharing a trigger.
- **L51 vs L05** — both touch access and credentials, but L05 owns *secret routing* (Doppler, `SECRETS.md`, names-only `.env.example`) and L51 owns *founder access and identity* (`BUSINESS_ACCESS.md`, which accounts exist and who can reach them). Separate artifacts, separate validators (`check:secrets` vs `check:founder-operator`).
- **L52 vs L07** — L07 is the *proof* loop that gates marking a provider-backed lane done (`PROVIDER_PROOF.md`); L52 is the *ledger* loop that records each authenticated action as it happens (`AGENT_OPERATIONS.md`). L52 feeds L07 rather than duplicating it.
- **L53 vs L17/L27/L45** — launch narrative, ASO metadata, and UGC scripts each own their channel's artifact and gate; L53 is the cross-cutting writing standard every one of them passes through. It has its own reference and its own validator, and it never decides *what* to say, only what to cut.
- **L54 vs L26** — both touch founder-visible rendering, but L26 extends the Control Plane with new panels while L54 keeps the machine-to-founder vocabulary complete. `check:control-plane` vs `check:founder-copy`.
- **L55 vs L50** — L50 bumps and syncs the runtime after a change; L55 governs the frontmatter contract that decides whether the skill loads at all. Distinct artifact (`skill-version.json` vs `SKILL.md` frontmatter + the triggering eval).
- **L56 vs L32** — L32 is the *consumer* side (run `asc` to create the app record, or record a blocker); L56 is the *maintainer* side (prove the documented commands still match the installed CLI before editing the reference). Distinct trigger, distinct artifact.

## Re-scan Result

Re-scanned 2026-07-26 against SKILL.md at v0.26.0 (`Start Here` moves 1–6,
`Lane Routing` sections, `Always-On Contracts`, `Phase Spine` 0–6b,
`Ground Rules`, `What Counts As Done`):

- Every loop maps back to a live named section of SKILL.md, a `references/*.md`
  file, an artifact template, and (where one exists) a `package.json` validator.
- Every `package.json` `check:*` / `probe:*` / `render:*` validator is claimed as
  the **proof** of exactly one loop (or, for cross-cutting validators like
  `check:provider-proof`, owned by L07 and *referenced* by provider lanes).
- No `Lane Routing` row or phase is left without a loop; no two loops share the
  same trigger + primary artifact + validator (see Distinctness Notes).

**Grounding repaired in this pass.** SKILL.md compressed `Start Here` from a
~27-step enumeration into six orientation moves and deleted the `When To Load`
list, moving that routing into `Lane Routing` tables. 96 citations still pointed
at the old structure — 81 `Start Here` step numbers, 13 `When To Load`, and 2
`Default Phase Flow` (now `Phase Spine`). Step numbers were dropped rather than
renumbered because the old numbering does not survive the compression: old step 3
was secrets routing, live move 3 is durable state. Citations in the six
orientation loops (L02–L06, L19) now read `Start Here`; the rest read
`Lane Routing`.

**Verify/stop met:** 56/56 workflows have exactly one grounded loop; each loop's
action steps trace to a section name that exists in SKILL.md today, and all 40
cited `references/*.md` files exist on disk.

## Re-audit Result (stopping conditions)

After ranking the loops by stop subjectivity and rewriting the worst first, all
56 stops were re-audited mechanically:

- **Judgment terminators:** 0 remaining. A grep of every stop for `looks good`,
  `feels right`, `matches reality`, `evidence-backed`, `reconciles`, `is/are
  complete`, `seems`, `polished`, `good enough`, `until it` returns nothing.
- **Concrete anchor per stop:** 56/56. Every stop names ≥1 of — a `package.json`
  command + pass state (`check:*`, `probe:*`, `launchbench`, `audit:ci`,
  `validate:*`, `render:*`), a grep/`diff`/`curl`/exit-code/HTTP-status check of a
  named artifact, or a discrete `PROJECT_STATE.yaml` lane/gate state. A grep of
  every stop for those anchors leaves 0 unanchored.
- **Validator coverage:** each `check:*`/`probe:*` script is the terminator of the
  loop that owns it. The set of loops with no dedicated validator has shrunk from
  eight to three: L08 gained `check:change-cascade`, L09 gained `check:research`,
  L18 gained `check:launch-trace`, L38 gained `check:mobai-proof`, and L41 gained
  `check:privacy-terms`. Only L28, L45, and L46 still terminate on a
  grep/`diff`-checkable artifact property plus a `PROJECT_STATE.yaml` gate, never
  on an adjective.

Reproduce the audit:

```bash
# (1) must print nothing
grep '^- \*\*Stopping condition:\*\*' docs/skill-workflow-loops.md \
  | grep -iE 'looks good|feels right|matches reality|evidence-backed|reconciles|is complete|are complete|seems|polished|good enough|until it'
# (2) must print nothing (every stop carries a concrete anchor)
grep '^- \*\*Stopping condition:\*\*' docs/skill-workflow-loops.md \
  | grep -vE 'check:|probe:|launchbench|audit:ci|validate:|render:|grep|diff|curl|exit 0|HTTP 200|PROJECT_STATE|lanes\.|\.md|\.yaml|asc |baseline/'

# (3) must print nothing (every cited SKILL.md section still exists)
SKILL=skill/b2c-mobile-business-launch/SKILL.md
grep -ohE '`(Start Here|Lane Routing|Phase Spine|Always-On Contracts|Ground Rules|What Counts As Done|Autopilot Run Contract|Founder Question Contract|Prove It Before Calling It Done|Runtime Freshness Gate)`' \
  docs/skill-workflow-loops.md | tr -d '`' | sort -u \
  | while read -r s; do grep -q "^#\{2,3\} $s$" "$SKILL" || echo "DEAD SECTION: $s"; done

# (4) must print nothing (every cited reference exists on disk)
grep -ohE 'references/[a-z0-9-]+\.md' docs/skill-workflow-loops.md | sort -u \
  | while read -r r; do [ -f "skill/b2c-mobile-business-launch/$r" ] || echo "MISSING: $r"; done
```

No loop stops on judgment, and no loop cites a section or reference that does not
exist. Checks (3) and (4) were added on 2026-07-26 after a re-scan found 96
citations pointing at a `Start Here` enumeration and a `When To Load` list that
SKILL.md no longer has.
