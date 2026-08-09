import type { CatalogReference } from "./types.js";

/**
 * The R20 inversion (KTD6: "the catalog is the single authority for generated routing
 * docs"). v1's runtime/graph/catalog.ts discoverReferences() SCRAPED this loadWhen text out
 * of hand-authored knowledge/<domain>/README.md tables. Here the text is authored catalog
 * DATA; catalog/render-routing.ts projects it back OUT into catalog/generated/routing.md,
 * so the direction of authority flips from prose->code to code->prose.
 *
 * Only the 90 v1 knowledge files disposed "keep" in the port ledger
 * (docs/plans/attachments/2026-08-port-ledger.md) get an entry. The 14 domain README.md
 * files plus the top-level knowledge/README.md are themselves "drop" — their sole job was
 * the routing table this file now replaces — and knowledge/orchestration/autonomy-modes.md
 * is "drop", superseded by the autonomy engine's typed grant/waiver data (KTD3/KTD4).
 *
 * Most loadWhen text below is carried forward near-verbatim from the README table it
 * replaces (the trigger condition was already good; only its storage location was wrong).
 * A handful of v1 rows were themselves a generic placeholder that just restated the
 * filename ("working on secrets management") — those are rewritten here with a real
 * trigger, which is the concrete, checkable improvement this inversion buys (findings from
 * the U8 port-ledger research pass are cited inline).
 */
export const references: readonly CatalogReference[] = [
  // ---------------------------------------------------------------------------------
  // domain.data
  // ---------------------------------------------------------------------------------
  {
    id: "reference.data.analytics-attribution",
    path: "knowledge/data/analytics-attribution.md",
    domainId: "domain.data",
    title: "Analytics And Attribution",
    loadWhen:
      "before onboarding, paywalls, funnels, store CTAs, referrals, lifecycle email, UGC/Fastlane campaigns, paid UA, or any builder prompt that names events; before PostHog setup, dashboards, deep links, feature flags, experiments, or session replay",
  },

  // ---------------------------------------------------------------------------------
  // domain.design
  // ---------------------------------------------------------------------------------
  {
    id: "reference.design.design-room",
    path: "knowledge/design/design-room.md",
    domainId: "domain.design",
    title: "Design Room",
    hub: true,
    loadWhen:
      "designing, versioning, baselining, restoring, wiping, or rendering B2C design state; custom product page, PPO, In-App Event, landing, onboarding, paywall, or marketing-surface proposals; whenever a design output would otherwise be freeform — the STATE→MUTATE→VERSION→RENDER hub; see surfaces-b2c.md for App Store surface schemas and quality-lens.md for the taste filter applied during a mutation",
  },
  {
    id: "reference.design.design-visual-system",
    path: "knowledge/design/design-visual-system.md",
    domainId: "domain.design",
    title: "Design Visual System",
    loadWhen:
      "creating or changing design/DESIGN.md, lowercase design.md, visual systems, UI mockups, generated visual concepts, Higgsfield-backed visuals/motion/icons/mascots, mobile screen specs, App Store creative, screenshot frames, design audits, or HTML visual artifacts",
  },
  {
    id: "reference.design.landing-motion-craft",
    path: "knowledge/design/landing-motion-craft.md",
    domainId: "domain.design",
    title: "Landing Motion Craft",
    loadWhen: "before building or animating any landing page, funnel page, or web marketing surface",
  },
  {
    id: "reference.design.motion-craft-benchmarks",
    path: "knowledge/design/motion-craft-benchmarks.md",
    domainId: "domain.design",
    title: "Motion Craft Benchmarks",
    loadWhen:
      "implementing or auditing a specific motion recipe against check:motion-contract's numeric spring/duration tokens, tying a micro-interaction to the Experience Card it serves, or designing a cold-launch splash/loading/welcome-screen entrance (R11-R14)",
  },
  {
    id: "reference.design.premium-mobile-craft",
    path: "knowledge/design/premium-mobile-craft.md",
    domainId: "domain.design",
    title: "Premium Mobile Craft",
    loadWhen: 'building or polishing in-app UI; wiring press states, animation, haptics, keyboard, loading/empty states; any "premium feel" request',
  },
  {
    id: "reference.design.quality-lens",
    path: "knowledge/design/quality-lens.md",
    domainId: "domain.design",
    title: "Quality Lens",
    loadWhen:
      "judging whether a design-room output is actually good, not just present — the 11-star taste filter, anti-generic checks, and inspiration sources applied during a design-room mutation (distinct from design-room.md's protocol and surfaces-b2c.md's schemas)",
  },
  {
    id: "reference.design.refero-ux-patterns",
    path: "knowledge/design/refero-ux-patterns.md",
    domainId: "domain.design",
    title: "Refero UX Patterns",
    loadWhen:
      "before using Refero, replacing Refero with a free pattern route, creating UX_PATTERNS.md, drawing web/mobile flow maps, or auditing pattern coverage",
  },
  {
    id: "reference.design.remotion-content-assets",
    path: "knowledge/design/remotion-content-assets.md",
    domainId: "domain.design",
    title: "Remotion Content Assets",
    loadWhen:
      'replacing Higgsfield with Remotion; scaffolding a Remotion project; code-rendered videos/stills; app-preview clips; social/ad/content variants; any "local rendered assets are ready" claim',
  },
  {
    id: "reference.design.surfaces-b2c",
    path: "knowledge/design/surfaces-b2c.md",
    domainId: "domain.design",
    title: "Surfaces B2C",
    loadWhen:
      "modeling Custom Product Page, Product Page Optimization, or In-App Event state with Apple's numeric limits (70 CPPs, 3 PPO treatments/90 days, 10 published/15 approved In-App Events); cross-surface consistency checks across web/landing/mobile-app/store families",
  },

  // ---------------------------------------------------------------------------------
  // domain.engineering
  // ---------------------------------------------------------------------------------
  {
    id: "reference.engineering.app-agent-roster",
    path: "knowledge/engineering/app-agent-roster.md",
    domainId: "domain.engineering",
    title: "App Agent Roster",
    loadWhen: "before app handoffs, builder-ready bundles, business-repo AGENTS.md/CLAUDE.md, or post-launch operating docs",
  },
  {
    id: "reference.engineering.backend-data-contract",
    path: "knowledge/engineering/backend-data-contract.md",
    domainId: "domain.engineering",
    title: "Backend Data Contract",
    loadWhen:
      "before engineering/TECH_SPEC.md data/API sections harden; before archetype schema/auth prompts run; when the founder wants Firebase or a custom backend instead of the Supabase default; auditing an existing data layer",
  },
  {
    id: "reference.engineering.engineering-orchestration",
    path: "knowledge/engineering/engineering-orchestration.md",
    domainId: "domain.engineering",
    title: "Engineering Orchestration",
    loadWhen:
      "before app implementation, backend/frontend work, generated builder prompts, parallel agents, worktrees, engineering/ENGINEERING_PLAN.md, engineering/PRODUCTION_READINESS.md, or production-readiness claims",
  },
  {
    id: "reference.engineering.mobai-toolbelt",
    path: "knowledge/engineering/mobai-toolbelt.md",
    domainId: "domain.engineering",
    title: "MobAI Toolbelt",
    loadWhen:
      "before MobAI device automation, .mob generation/healing, repeat or host-script actions, Sync Mode/multi-device work, performance gates, screenshots, polished demo videos, app previews, bug repro recordings, MobAI CI, or recorder-skill setup",
  },
  {
    id: "reference.engineering.xcodebuildmcp-testing",
    path: "knowledge/engineering/xcodebuildmcp-testing.md",
    domainId: "domain.engineering",
    title: "XcodeBuildMCP Testing",
    loadWhen:
      'first for any "run the app", "check this screen", "walk this flow", or "reproduce this bug" request on a local Mac — the Route Ladder starts at the zero-setup in-app iOS Simulator before XcodeBuildMCP CLI/MCP; also Codex Desktop native iOS tools, SnapshotPreviews exports, serve-sim streaming, or simulator/device screenshots',
  },

  // ---------------------------------------------------------------------------------
  // domain.experience
  // ---------------------------------------------------------------------------------
  {
    id: "reference.experience.consumer-product-design-agency",
    path: "knowledge/experience/consumer-product-design-agency.md",
    domainId: "domain.experience",
    title: "Consumer Product Design Agency",
    loadWhen: "grounding the emotional/behavioral layer in its research tiers, or auditing whether the four required Experience Cards are implemented",
  },
  {
    id: "reference.experience.eleven-star-experience",
    path: "knowledge/experience/eleven-star-experience.md",
    domainId: "domain.experience",
    title: "Eleven-Star Experience",
    loadWhen:
      'before product/SPEC.md, design/DESIGN.md, onboarding, ads, store screenshots, content assets, or engineering plans are treated as ready; on "11-star run"/"11-star pass" — follow the reference\'s 11-Star Run Protocol before any other output',
  },
  {
    id: "reference.experience.emotional-design-system",
    path: "knowledge/experience/emotional-design-system.md",
    domainId: "domain.experience",
    title: "Emotional Design System",
    hub: true,
    loadWhen:
      'any product, onboarding, core-loop, paywall, or return-session work targeting 6-star ("better than expected") or higher; "charge this feature with emotion", "make users stick / build a habit", "apply the <name> card", "emotional UX audit" — the methodology hub; see experience-cards.md for the card deck, emotional-experience-design.md for full producer detail, emotional-experience-measurement.md for instrumentation, and ethics-guardrail.md for the regulatory/legal contract',
  },
  {
    id: "reference.experience.emotional-experience-design",
    path: "knowledge/experience/emotional-experience-design.md",
    domainId: "domain.experience",
    title: "Emotional Experience Design",
    loadWhen:
      "implementing one of the four required Experience Cards (Commitment, Variable Reward, Perceived Effort Delay, Intent Mirroring) — full psychological basis, trigger timing, deterministic guardrail tests, named PostHog events, and the Six-Lens Design Review Framework in full",
  },
  {
    id: "reference.experience.emotional-experience-measurement",
    path: "knowledge/experience/emotional-experience-measurement.md",
    domainId: "domain.experience",
    title: "Emotional Experience Measurement",
    loadWhen:
      "instrumenting an emotional-design or Experience Card feature — system-level events/metrics, per-card PostHog events, leading behavioral metrics, dark-pattern counter-metrics, and A/B experiment design (measurement only; see emotional-design-system.md for the psychology)",
  },
  {
    id: "reference.experience.ethics-guardrail",
    path: "knowledge/experience/ethics-guardrail.md",
    domainId: "domain.experience",
    title: "Ethics Guardrail",
    loadWhen:
      "a HIGH-risk Experience Card (variable reward, streak, scarcity, urgency, social proof) is in play, or before any regulatory/platform-compliance claim about an engagement mechanic — Bright-Line/Dark-Line test, FTC/EU DSA/Apple/Google Play/COPPA landscape, the guardrail attestation-block contract consumed by check:emotional-design",
  },
  {
    id: "reference.experience.experience-cards",
    path: "knowledge/experience/experience-cards.md",
    domainId: "domain.experience",
    title: "Experience Cards",
    hub: true,
    loadWhen:
      "selecting or auditing an engagement mechanic — the 12-card deck index: card shape contract, live-MCP access model, Card Routing table to every card in experience-cards/, and the Ethics Ladder attestation-block contract",
  },
  {
    id: "reference.experience.experience-cards.commitment-card",
    path: "knowledge/experience/experience-cards/commitment-card.md",
    domainId: "domain.experience",
    title: "Commitment Card",
    loadWhen: "eliciting one voluntary early commitment from a user and echoing it downstream — routed from experience-cards.md's Card Routing table",
  },
  {
    id: "reference.experience.experience-cards.endowed-progress-card",
    path: "knowledge/experience/experience-cards/endowed-progress-card.md",
    domainId: "domain.experience",
    title: "Endowed Progress Card",
    loadWhen: "pre-crediting real prior progress at enrollment to accelerate a user toward their first milestone — routed from experience-cards.md",
  },
  {
    id: "reference.experience.experience-cards.fresh-start-card",
    path: "knowledge/experience/experience-cards/fresh-start-card.md",
    domainId: "domain.experience",
    title: "Fresh Start Card",
    loadWhen: "using a temporal landmark (new week/month/season) to reopen a lapsed journey without guilt copy — routed from experience-cards.md",
  },
  {
    id: "reference.experience.experience-cards.identity-and-self-expression-card",
    path: "knowledge/experience/experience-cards/identity-and-self-expression-card.md",
    domainId: "domain.experience",
    title: "Identity And Self-Expression Card",
    loadWhen: "letting a user author an identity anchor (avatar, name, stated goal) that increases self-consistency pressure — routed from experience-cards.md",
  },
  {
    id: "reference.experience.experience-cards.intent-mirroring-card",
    path: "knowledge/experience/experience-cards/intent-mirroring-card.md",
    domainId: "domain.experience",
    title: "Intent Mirroring Card",
    loadWhen: "reflecting a user's own stated goal back to them before an ask (e.g. a paywall) — routed from experience-cards.md",
  },
  {
    id: "reference.experience.experience-cards.mastery-and-status-card",
    path: "knowledge/experience/experience-cards/mastery-and-status-card.md",
    domainId: "domain.experience",
    title: "Mastery And Status Card",
    loadWhen:
      "surfacing earned skill/status visibility to sustain intrinsic motivation; pins a canonical motion-contract spring — routed from experience-cards.md",
  },
  {
    id: "reference.experience.experience-cards.peak-end-card",
    path: "knowledge/experience/experience-cards/peak-end-card.md",
    domainId: "domain.experience",
    title: "Peak-End Card",
    loadWhen:
      "engineering one session peak plus a strong close for memory-based re-engagement; pins a canonical motion-contract spring — routed from experience-cards.md",
  },
  {
    id: "reference.experience.experience-cards.perceived-effort-delay-card",
    path: "knowledge/experience/experience-cards/perceived-effort-delay-card.md",
    domainId: "domain.experience",
    title: "Perceived Effort Delay Card",
    loadWhen: "showing real work happening during a wait to convert delay into perceived craft — routed from experience-cards.md",
  },
  {
    id: "reference.experience.experience-cards.reciprocity-card",
    path: "knowledge/experience/experience-cards/reciprocity-card.md",
    domainId: "domain.experience",
    title: "Reciprocity Card",
    loadWhen: "giving unannounced real value before making any ask — routed from experience-cards.md",
  },
  {
    id: "reference.experience.experience-cards.recovery-and-trust-repair-card",
    path: "knowledge/experience/experience-cards/recovery-and-trust-repair-card.md",
    domainId: "domain.experience",
    title: "Recovery And Trust Repair Card",
    loadWhen: "designing fast, transparent failure recovery after an app or provider error — routed from experience-cards.md",
  },
  {
    id: "reference.experience.experience-cards.streak-and-loss-aversion-card",
    path: "knowledge/experience/experience-cards/streak-and-loss-aversion-card.md",
    domainId: "domain.experience",
    title: "Streak And Loss-Aversion Card",
    loadWhen:
      "HIGH-risk: a streak or earned-continuity mechanic a user could feel loss-averse about losing — escape hatch and counter-metric required — routed from experience-cards.md",
  },
  {
    id: "reference.experience.experience-cards.variable-reward-card",
    path: "knowledge/experience/experience-cards/variable-reward-card.md",
    domainId: "domain.experience",
    title: "Variable Reward Card",
    loadWhen:
      "HIGH-risk: an unpredictable-positive-outcome mechanic (reveal, spin, box); pins a canonical motion-contract spring; escape hatch and counter-metric required — routed from experience-cards.md",
  },
  {
    id: "reference.experience.onboarding-conversion",
    path: "knowledge/experience/onboarding-conversion.md",
    domainId: "domain.experience",
    title: "Onboarding Conversion",
    loadWhen:
      "before onboarding quizzes, welcome/splash screens, personalization, attribution questions, demo videos, App Review popups, paywall timing, closing offers, trials, or first-session activation",
  },
  {
    id: "reference.experience.push-notification-lifecycle",
    path: "knowledge/experience/push-notification-lifecycle.md",
    domainId: "domain.experience",
    title: "Push Notification Lifecycle",
    loadWhen:
      "before push permission priming or notification lifecycle work; before Resend, API keys, transactional email, lifecycle automations, broadcasts, contacts/topics, webhooks, inbound email, unsubscribe, deliverability, or templates",
  },

  // ---------------------------------------------------------------------------------
  // domain.growth
  // ---------------------------------------------------------------------------------
  {
    id: "reference.growth.cro-landing",
    path: "knowledge/growth/cro-landing.md",
    domainId: "domain.growth",
    title: "CRO Landing",
    loadWhen: "before building or auditing a public conversion surface: landing/waitlist, web-to-app, or launch page",
  },
  {
    id: "reference.growth.fastlane-growth-ops",
    path: "knowledge/growth/fastlane-growth-ops.md",
    domainId: "domain.growth",
    title: "Fastlane Growth Ops",
    loadWhen:
      "after launch approval or public beta; on any usefastlane.ai request — workspace setup, social connections, Blitz campaigns, generated organic content, scheduling, canceling posts, short-form analytics",
  },
  {
    id: "reference.growth.geo-seo",
    path: "knowledge/growth/geo-seo.md",
    domainId: "domain.growth",
    title: "GEO/SEO",
    loadWhen:
      "before the first file edit, not the deploy — any landing page file, component copy, screenshot metadata, policy page, robots.txt, llms.txt, sitemap.xml, schema, or metadata; also before publishing, AI-crawler access, or brand/entity signals",
  },
  {
    id: "reference.growth.influencer-sponsorship-engine",
    path: "knowledge/growth/influencer-sponsorship-engine.md",
    domainId: "domain.growth",
    title: "Influencer Sponsorship Engine",
    loadWhen:
      "before sponsoring established creators who already have an audience to integrate the app into their own content — sponsorship DMs/deal calls, flat/CPM/view-guarantee structures, brand-account credibility, meme/topic-page amplification, or per-deal payback tracking",
  },
  {
    id: "reference.growth.launch-narrative-cadence",
    path: "knowledge/growth/launch-narrative-cadence.md",
    domainId: "domain.growth",
    title: "Launch Narrative Cadence",
    loadWhen: "before drafting the announcement, the launch-day sequence, the tentpole-vs-weekly-cadence plan, or launch post copy",
  },
  {
    id: "reference.growth.paid-user-acquisition",
    path: "knowledge/growth/paid-user-acquisition.md",
    domainId: "domain.growth",
    title: "Paid User Acquisition",
    loadWhen:
      "before paid ads, Apple Search Ads, Meta/TikTok/Google campaigns, custom product page campaign routing, MMP/ad-network SDK choices, paid creative tests, or spend-readiness claims",
  },
  {
    id: "reference.growth.ugc-creator-engine",
    path: "knowledge/growth/ugc-creator-engine.md",
    domainId: "domain.growth",
    title: "UGC Creator Engine",
    loadWhen:
      "before founder-run creator operations on new niche accounts the program controls — TikTok/Reels/Shorts UGC, founder-led format-discovery experiments, hired micro-creator sourcing/contracts/payments, or post-launch social distribution where the algorithm, not an existing audience, is the distribution engine",
  },
  {
    id: "reference.growth.viral-growth-loops",
    path: "knowledge/growth/viral-growth-loops.md",
    domainId: "domain.growth",
    title: "Viral Growth Loops",
    loadWhen:
      "before referral unlocks, share-to-unlock, invite systems, social/comment loops, viral onboarding or paywall flows, creator CTAs, content format labs, or features meant to spread on TikTok/Reels/Shorts",
  },

  // ---------------------------------------------------------------------------------
  // domain.money
  // ---------------------------------------------------------------------------------
  {
    id: "reference.money.revenue-monetization",
    path: "knowledge/money/revenue-monetization.md",
    domainId: "domain.money",
    title: "Revenue Monetization",
    hub: true,
    loadWhen:
      "before RevenueCat, Stripe, app-store products, web billing, web purchase links, funnels, paywalls, subscriptions, webhooks, taxes, pricing, restore purchases, or entitlements — the Decision Matrix, Founder-Only Gates, and anti-pattern digest hub; see revenuecat-and-store-products.md, stripe-and-web-billing.md, paywall-pricing-and-experiments.md, and billing-health-and-reactivation.md for setup and procedure detail",
  },
  {
    id: "reference.money.revenuecat-and-store-products",
    path: "knowledge/money/revenuecat-and-store-products.md",
    domainId: "domain.money",
    title: "RevenueCat And Store Products",
    loadWhen:
      "RevenueCat project/product/entitlement/offering setup, App Store or Play product gates, MISSING_METADATA or RevenueCat product-type reconciliation, paywall smoke proof, or promotional IAP/subscription art — routed from revenue-monetization.md",
  },
  {
    id: "reference.money.stripe-and-web-billing",
    path: "knowledge/money/stripe-and-web-billing.md",
    domainId: "domain.money",
    title: "Stripe And Web Billing",
    loadWhen:
      "Stripe account/checkout/webhook/customer-portal setup, or RevenueCat Web Billing, Web Purchase Links, Web Funnels, Web SDK, or Redemption Links — routed from revenue-monetization.md",
  },
  {
    id: "reference.money.paywall-pricing-and-experiments",
    path: "knowledge/money/paywall-pricing-and-experiments.md",
    domainId: "domain.money",
    title: "Paywall, Pricing, And Experiments",
    loadWhen:
      "paywall timing/placement/trials/offers, pricing disclosure rules, the price-point decision procedure, or the standing paywall experiment cadence — routed from revenue-monetization.md",
  },
  {
    id: "reference.money.billing-health-and-reactivation",
    path: "knowledge/money/billing-health-and-reactivation.md",
    domainId: "domain.money",
    title: "Billing Health And Reactivation",
    loadWhen:
      "the purchase-events backend/analytics contract, involuntary billing-failure recovery, or reactivation and win-back after a purchase already happened — routed from revenue-monetization.md",
  },

  // ---------------------------------------------------------------------------------
  // domain.operations
  // ---------------------------------------------------------------------------------
  {
    id: "reference.operations.founder-zero-operator",
    path: "knowledge/operations/founder-zero-operator.md",
    domainId: "domain.operations",
    title: "Founder-Zero Operator",
    loadWhen:
      "every broad launch start; before account/social/Doppler bootstrap; when the founder is unsure; whenever an agent is about to hand back a checklist instead of operating the business",
  },
  {
    id: "reference.operations.frontier-agent-operations",
    path: "knowledge/operations/frontier-agent-operations.md",
    domainId: "domain.operations",
    title: "Frontier Agent Operations",
    loadWhen: "before authenticated browser/API/CLI/native action on any provider, social, or store account",
  },
  {
    id: "reference.operations.paid-tool-routing",
    path: "knowledge/operations/paid-tool-routing.md",
    domainId: "domain.operations",
    title: "Paid Tool Routing",
    loadWhen: "before using or replacing any paid/account-gated tool, before running a free fallback, or when a service is missing from the runtime",
  },
  {
    id: "reference.operations.post-launch-operations",
    path: "knowledge/operations/post-launch-operations.md",
    domainId: "domain.operations",
    title: "Post-Launch Operations",
    loadWhen:
      'once the app is live (phase_6/phase_6b); after first store approval; on "what now"; for weekly ops, incidents, review responses, retention and kill-or-scale reviews, or resuming a live app; when a second business exists',
  },
  {
    id: "reference.operations.provider-state-recipes",
    path: "knowledge/operations/provider-state-recipes.md",
    domainId: "domain.operations",
    title: "Provider State Recipes",
    loadWhen:
      "setting up or auditing any provider account (Doppler, Supabase/Firebase, PostHog, RevenueCat, Stripe, Resend, Sentry, App Store Connect, Google Play, Cloudflare) — what to record before and while configuring each, distinct from the deep secrets-management.md reference (Doppler is one of ten entries here, not the focus)",
  },
  {
    id: "reference.operations.resend-email-ops",
    path: "knowledge/operations/resend-email-ops.md",
    domainId: "domain.operations",
    title: "Resend Email Ops",
    loadWhen:
      "before Resend, API keys, transactional email, lifecycle automations, broadcasts, contacts/topics, webhooks, inbound email, unsubscribe, deliverability, or templates",
  },
  {
    id: "reference.operations.secrets-management",
    path: "knowledge/operations/secrets-management.md",
    domainId: "domain.operations",
    title: "Secrets Management",
    loadWhen:
      "before any new secret, key, token, env var, webhook secret, or .env; classifying a discovered secret; Doppler config preflight, shell-safety patterns, or production-readiness secret gates — the deep reference tool-recipes/secrets-and-environment.md routes into",
  },
  {
    id: "reference.operations.doppler-organization",
    path: "knowledge/operations/doppler-organization.md",
    domainId: "domain.operations",
    title: "Doppler Organization Across A Portfolio",
    loadWhen:
      "deciding which project or config a credential belongs in; setting up secrets for a new business; adding a second business to an existing secret store; or splitting secrets across web, mobile, backend, and CI — the portfolio-shape companion to secrets-management.md, which covers one secret at a time",
  },

  // ---------------------------------------------------------------------------------
  // domain.orchestration (autonomy-modes.md deliberately absent — see port ledger)
  // ---------------------------------------------------------------------------------
  {
    id: "reference.orchestration.project-state",
    path: "knowledge/orchestration/project-state.md",
    domainId: "domain.orchestration",
    title: "Project State",
    loadWhen: "start of multi-lane work; resuming a prior session; before provider/store mutations, handoff, or subagent dispatch; when rendering the cockpit",
  },
  {
    id: "reference.orchestration.parallel-agent-orchestration",
    path: "knowledge/orchestration/parallel-agent-orchestration.md",
    domainId: "domain.orchestration",
    title: "Parallel Agent Orchestration",
    loadWhen: "start of multi-lane work; resuming a prior session; before provider/store mutations, handoff, or subagent dispatch; when rendering the cockpit",
  },
  {
    id: "reference.orchestration.dynamic-workflows",
    path: "knowledge/orchestration/dynamic-workflows.md",
    domainId: "domain.orchestration",
    title: "Dynamic Workflows",
    loadWhen:
      "a stage needs dozens-to-hundreds of agents, a codified quality pattern (adversarial verification, tournament, loop-until-done), or a run you want to read and rerun; documents a Claude Code preview feature — refresh the source basis before trusting a named flag/API",
  },
  {
    id: "reference.orchestration.compound-engineering-routing",
    path: "knowledge/orchestration/compound-engineering-routing.md",
    domainId: "domain.orchestration",
    title: "Compound Engineering Routing",
    loadWhen:
      "before app implementation, backend/frontend work, generated builder prompts, parallel agents, worktrees, engineering/ENGINEERING_PLAN.md, engineering/PRODUCTION_READINESS.md, or production-readiness claims",
  },

  // ---------------------------------------------------------------------------------
  // domain.process
  // ---------------------------------------------------------------------------------
  {
    id: "reference.process.artifact-contracts",
    path: "knowledge/process/artifact-contracts.md",
    domainId: "domain.process",
    title: "Artifact Contracts",
    loadWhen: "writing docs, handoff bundles, or acceptance criteria",
  },
  {
    id: "reference.process.cascade-edges",
    path: "knowledge/process/cascade-edges.yaml",
    domainId: "domain.process",
    title: "Cascade Edges",
    loadWhen:
      "machine-read by check:change-cascade — the surfaces/change-types adjacency map; edit together with change-cascade.md, which renders the same map as a human table (twin-format pattern, not a duplicate)",
  },
  {
    id: "reference.process.change-cascade",
    path: "knowledge/process/change-cascade.md",
    domainId: "domain.process",
    title: "Change Cascade",
    loadWhen: "after any change to a launched or near-launch app's features, copy, brand vocabulary, pricing, products, design, or data behavior",
  },
  {
    id: "reference.process.control-plane",
    path: "knowledge/process/control-plane.md",
    domainId: "domain.process",
    title: "Control Plane",
    loadWhen: "extending the Design Room, or planning future analytics/monetization/store-ops/growth panels over the same state store and theme tokens",
  },
  {
    id: "reference.process.failure-cards",
    path: "knowledge/process/failure-cards.md",
    domainId: "domain.process",
    title: "Failure Cards",
    loadWhen: "before readiness claims; after a repeated agent miss; when adding a validator or scenario",
  },
  {
    id: "reference.process.flow-traceability",
    path: "knowledge/process/flow-traceability.md",
    domainId: "domain.process",
    title: "Flow Traceability",
    loadWhen: "crossing a phase boundary; deciding whether engineering/TECH_SPEC.md is needed; auditing whether research reached experience, design, and specs",
  },
  {
    id: "reference.process.launch-coverage",
    path: "knowledge/process/launch-coverage.md",
    domainId: "domain.process",
    title: "Launch Coverage",
    loadWhen: '"what else is missing", "launch readiness"; moving from planning to build or submission',
  },
  {
    id: "reference.process.launch-phases",
    path: "knowledge/process/launch-phases.md",
    domainId: "domain.process",
    title: "Launch Phases",
    loadWhen: "any multi-phase launch or continuation; deciding where work starts",
  },
  {
    id: "reference.process.provider-proof",
    path: "knowledge/process/provider-proof.md",
    domainId: "domain.process",
    title: "Provider Proof",
    loadWhen:
      "before marking any provider-backed lane (analytics/revenue/email/store/security/eng) done — evidence rules and the minimum PROVIDER_PROOF.md ledger row shape",
  },
  {
    id: "reference.process.tool-recipes",
    path: "knowledge/process/tool-recipes.md",
    domainId: "domain.process",
    title: "Tool Recipes",
    hub: true,
    loadWhen:
      "running research, setting up the funnel, configuring domain/email routing, checking analytics, choosing stack, or verifying deployment — the Recipe Routing hub into the 8 files in tool-recipes/, the Paid Tool Decision Protocol, and the Founder-Only Gates list",
  },
  {
    id: "reference.process.tool-recipes.device-capture-and-proof",
    path: "knowledge/process/tool-recipes/device-capture-and-proof.md",
    domainId: "domain.process",
    title: "Device Capture And Proof",
    loadWhen:
      "capturing truthful app UI proof — the Route Ladder from the in-app iOS Simulator through XcodeBuildMCP/SnapshotPreviews/serve-sim — routed from tool-recipes.md",
  },
  {
    id: "reference.process.tool-recipes.engineering-and-agent-orchestration",
    path: "knowledge/process/tool-recipes/engineering-and-agent-orchestration.md",
    domainId: "domain.process",
    title: "Engineering And Agent Orchestration",
    loadWhen: "routing engineering work through CE skills, parallel-agent rules, and the three engineering record contracts — routed from tool-recipes.md",
  },
  {
    id: "reference.process.tool-recipes.funnel-domain-and-privacy",
    path: "knowledge/process/tool-recipes/funnel-domain-and-privacy.md",
    domainId: "domain.process",
    title: "Funnel Domain And Privacy",
    loadWhen: "privacy/terms research minimums, domain/email routing setup, or landing-funnel verification — routed from tool-recipes.md",
  },
  {
    id: "reference.process.tool-recipes.growth-and-store-routing",
    path: "knowledge/process/tool-recipes/growth-and-store-routing.md",
    domainId: "domain.process",
    title: "Growth And Store Routing",
    loadWhen: "routing ASO/paid-UA/viral-loop/UGC/Fastlane/GEO work to the right specialist reference — routed from tool-recipes.md",
  },
  {
    id: "reference.process.tool-recipes.research-intelligence",
    path: "knowledge/process/tool-recipes/research-intelligence.md",
    domainId: "domain.process",
    title: "Research Intelligence",
    loadWhen:
      "AppKittie store intelligence, XPOZ social-language research, Firecrawl web intelligence, Refero UX pattern research, or name/keyword collision checks — routed from tool-recipes.md",
  },
  {
    id: "reference.process.tool-recipes.revenue-email-analytics",
    path: "knowledge/process/tool-recipes/revenue-email-analytics.md",
    domainId: "domain.process",
    title: "Revenue Email Analytics",
    loadWhen: "routing RevenueCat/Stripe, Resend, or PostHog setup work, including the RevenueCat Economics Pull recipe — routed from tool-recipes.md",
  },
  {
    id: "reference.process.tool-recipes.secrets-and-environment",
    path: "knowledge/process/tool-recipes/secrets-and-environment.md",
    domainId: "domain.process",
    title: "Secrets And Environment",
    loadWhen: "the routing pointer into secrets-management.md, plus the config-name-preflight and env-file-extraction rules — routed from tool-recipes.md",
  },
  {
    id: "reference.process.tool-recipes.visual-and-motion-production",
    path: "knowledge/process/tool-recipes/visual-and-motion-production.md",
    domainId: "domain.process",
    title: "Visual And Motion Production",
    loadWhen:
      "Higgsfield or Remotion production routing, including the six named chained recipes for ads/UGC/virality/seasonal restyle — routed from tool-recipes.md",
  },

  // ---------------------------------------------------------------------------------
  // domain.product
  // ---------------------------------------------------------------------------------
  {
    id: "reference.product.ai-chat-companion",
    path: "knowledge/product/ai-chat-companion.md",
    domainId: "domain.product",
    title: "AI Chat Companion",
    loadWhen:
      '"an AI assistant", "a chatbot for <domain>", "an AI companion/character", a coach/tutor chat app; before specing conversation schema, model integration, memory, usage metering, or the safety layer',
  },
  {
    id: "reference.product.core-loop-and-v1-scope",
    path: "knowledge/product/core-loop-and-v1-scope.md",
    domainId: "domain.product",
    title: "Core Loop And V1 Scope (Non-Archetype Products)",
    loadWhen:
      "the product does not match one of the four shipped app archetypes (habit tracker, photo/AI media, social network, AI chat companion) — before naming the core loop, deciding which systems are in V1 vs. later, or specing schema for any other product shape",
  },
  {
    id: "reference.product.habit-tracker",
    path: "knowledge/product/habit-tracker.md",
    domainId: "domain.product",
    title: "Habit Tracker",
    loadWhen:
      '"a habit tracker", "a streak app", a daily routine or wellness/productivity utility; before specing habits, check-ins, streaks, reminders, or insights',
  },
  {
    id: "reference.product.photo-ai-media",
    path: "knowledge/product/photo-ai-media.md",
    domainId: "domain.product",
    title: "Photo AI Media",
    loadWhen:
      'AI headshots/avatars, photo enhancer/restorer, AI art studio, "an app that turns photos into <X>"; before specing media storage, the generation pipeline, credits/metering, sharing, or safety',
  },
  {
    id: "reference.product.product-moat",
    path: "knowledge/product/product-moat.md",
    domainId: "domain.product",
    title: "Product Moat",
    loadWhen:
      'before product/SPEC.md, design/DESIGN.md, onboarding, ads, store screenshots, content assets, or engineering plans are treated as ready; on "11-star run"/"11-star pass" — follow the 11-Star Run Protocol before any other output',
  },
  {
    id: "reference.product.social-network",
    path: "knowledge/product/social-network.md",
    domainId: "domain.product",
    title: "Social Network",
    loadWhen:
      '"build a social network", an X/Instagram/TikTok clone, "a community app for <niche>"; before specing schema, auth, feed, profiles, search, DMs, monetization, or invites',
  },

  // ---------------------------------------------------------------------------------
  // domain.research
  // ---------------------------------------------------------------------------------
  {
    id: "reference.research.go-pivot-or-kill",
    path: "knowledge/research/go-pivot-or-kill.md",
    domainId: "domain.research",
    title: "Go, Pivot, Or Kill: The Pre-Build Research Verdict",
    loadWhen:
      "writing or updating strategy/RESEARCH.md's Category Revenue Reality or Go, Pivot, Or Kill sections; deciding whether a category and wedge earn a build before Phase 2 design/build spend",
  },
  {
    id: "reference.research.localization-market-research",
    path: "knowledge/research/localization-market-research.md",
    domainId: "domain.research",
    title: "Localization Market Research",
    loadWhen:
      "before localizing any surface (store metadata/keywords/screenshots, paywall/offers, landing/web, lifecycle email, paid storefronts) or choosing which locales to ship",
  },

  // ---------------------------------------------------------------------------------
  // domain.store
  // ---------------------------------------------------------------------------------
  {
    id: "reference.store.app-store-connect-cli",
    path: "knowledge/store/app-store-connect-cli.md",
    domainId: "domain.store",
    title: "App Store Connect CLI",
    loadWhen:
      "before automating App Store Connect with the Rork asc CLI or CLI skill pack — app creation, metadata, screenshots, TestFlight, review status, RevenueCat catalog sync",
  },
  {
    id: "reference.store.app-store-listing-prep",
    path: "knowledge/store/app-store-listing-prep.md",
    domainId: "domain.store",
    title: "App Store Listing Prep",
    loadWhen:
      "before listing packets, privacy questionnaires, pricing/subscription field maps, custom product pages, in-app events, promotion pages, localization matrices, App Icon/App Preview work, or App Store marketing material",
  },
  {
    id: "reference.store.apple-signing-release",
    path: "knowledge/store/apple-signing-release.md",
    domainId: "domain.store",
    title: "Apple Signing Release",
    loadWhen: "before ASC upload readiness on any iOS submission path",
  },
  {
    id: "reference.store.aso-store-ops",
    path: "knowledge/store/aso-store-ops.md",
    domainId: "domain.store",
    title: "ASO Store Ops",
    loadWhen:
      "before App Store/Play metadata, screenshot planning, ASO audits, keyword research, Apple Search Ads, release/rejection handling, ratings/reviews, or post-launch monitoring",
  },
  {
    id: "reference.store.google-play-release",
    path: "knowledge/store/google-play-release.md",
    domainId: "domain.store",
    title: "Google Play Release",
    loadWhen:
      "Android is in scope (platforms include android, or an android bundle id exists); before Play Console setup, Data Safety answers, content rating, Play App Signing, release tracks, closed testing, or pre-launch report triage",
  },
  {
    id: "reference.store.store-console-workflow",
    path: "knowledge/store/store-console-workflow.md",
    domainId: "domain.store",
    title: "Store Console Workflow",
    loadWhen:
      'before App Store Connect or Play Console setup, privacy labels/Data safety, screenshot capture/upload, reviewer notes, account-deletion console work, or any "where do I click and what do I paste" handoff',
  },

  // ---------------------------------------------------------------------------------
  // domain.trust
  // ---------------------------------------------------------------------------------
  {
    id: "reference.trust.privacy-terms",
    path: "knowledge/trust/privacy-terms.md",
    domainId: "domain.trust",
    title: "Privacy Terms",
    loadWhen:
      "before drafting or publishing privacy policy, terms, EULA, subscription terms, account/data deletion flows, or app-store privacy/Data safety disclosures",
  },
  {
    id: "reference.trust.security-release-hardening",
    path: "knowledge/trust/security-release-hardening.md",
    domainId: "domain.trust",
    title: "Security Release Hardening",
    loadWhen:
      "before threat modeling, hardening, scans, or any security-readiness claim — Default Output contract, OWASP MASVS/ASVS and platform security basis, paid-tool routing with fallbacks, mobile hardening checklists, and revenue/entitlement abuse controls feeding trust/SECURITY.md",
  },

  // ---------------------------------------------------------------------------------
  // domain.words
  // ---------------------------------------------------------------------------------
  {
    id: "reference.words.conversion-copy",
    path: "knowledge/words/conversion-copy.md",
    domainId: "domain.words",
    title: "Conversion Copy",
    loadWhen:
      "before writing any words a user reads: conversion copy (hero/CTA, store, paywall) and every in-app string (buttons, empty states, errors, settings); and l10n readiness",
  },
  {
    id: "reference.words.no-slop-writing",
    path: "knowledge/words/no-slop-writing.md",
    domainId: "domain.words",
    title: "No-Slop Writing",
    loadWhen:
      "before writing or reviewing any founder-facing copy, or any marketing copy this skill generates — onboarding, store listing, landing, paywall, email, ads, launch posts, UGC scripts, GEO/SEO",
  },
] as const;
