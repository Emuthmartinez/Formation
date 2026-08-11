import { workflow } from "./helpers.js";

/** Ported from runtime/graph/workflows/growth-revenue.ts. All nine are grantable-domain. */
export const workflows = [
  workflow({
    id: "workflow.data.analytics-and-attribution-blueprint",
    title: "Analytics & attribution blueprint",
    domainId: "domain.data",
    areaIds: ["area.growth-revenue"],
    trigger: "Before locking onboarding/paywall/funnels/store CTAs or any prompt naming events",
    instructions:
      "Write analytics/ANALYTICS.md and render analytics/analytics-plan.html before onboarding, paywall, funnel, or store-CTA copy locks: define the identity model (one internal user ID reused across PostHog, RevenueCat, Stripe, Resend, and support), the dual attribution model (UTMs/click-IDs plus self-reported source using stable stored keys, never display labels), and the event catalog grouped by surface with owner/trigger/properties/QA method per event. Flip state/PROJECT_STATE.yaml's attribution contract booleans to true only after each is implemented and proven, not planned. The node is done when check:analytics-catalog and check:attribution pass and at least one real event shows up in PostHog activity — a local event log is implementation proof, not live proof.",
    reads: ["strategy/RESEARCH.md", "product/SPEC.md", "state/PROJECT_STATE.yaml"],
    referenceIds: ["reference.data.analytics-attribution", "reference.process.artifact-contracts", "reference.process.provider-proof"],
    roleId: "role.engineering-leader",
    laneIds: ["analytics_attribution"],
    phaseIds: ["phase.1b"],
    dependencies: ["workflow.research.research-backed-spec"],
    outputPaths: ["analytics/ANALYTICS.md", "analytics/analytics-plan.html"],
    gates: ["check:analytics-catalog", "check:attribution"],
    providers: ["provider.posthog"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.growth.paid-user-acquisition-system",
    title: "Paid user-acquisition system",
    domainId: "domain.growth",
    areaIds: ["area.growth-revenue"],
    trigger: "Before paid ads, ASA, Meta/TikTok/Google campaigns, or spend-readiness claims",
    instructions:
      "Write growth/PAID_UA.md: record the fit-gate decision, commit to exactly one paid channel with its target event and campaign destination, and mine the platform's public ad library for high-impression, long-running competitor ads before inventing angles. Build the RevenueCat/App-Store/PostHog/self-reported tracking baseline before any spend and record the four Decision Thresholds — attribution tolerance (default +/-20%), payback window (default 90 days), creative signal floor (default 2x target CPA or 7 days per creative), scale trigger (default 14 consecutive days at/under target CPA) — so growth/paid-ua-report.csv can be judged against a number, not a feeling. Target only the storefronts LOCALIZATION_MARKET_RESEARCH.md ranks Tier 1. Connecting ad accounts, creating campaigns, or committing spend is a founder-only gate that must be confirmed before check:paid-ua passes.",
    // revenue/REVENUE_OPS.md is deliberately NOT in reads: its producer runs at phase.3b while
    // this node fires at phase.1d, so the file structurally cannot exist yet — pricing-claim
    // cross-checks happen once revenue-monetization has run.
    reads: ["analytics/ANALYTICS.md", "strategy/localization-market-research/LOCALIZATION_MARKET_RESEARCH.md", "state/PROJECT_STATE.yaml"],
    referenceIds: [
      "reference.growth.paid-user-acquisition",
      "reference.operations.paid-tool-routing",
      "reference.research.localization-market-research",
      "reference.money.revenue-monetization",
    ],
    roleId: "role.marketing-guru",
    // costEstimate is deliberately ABSENT: paid-user-acquisition.md defers the amount to the
    // founder-approved budget cap, and an authored placeholder would both mis-park a smaller
    // approved budget and be recorded as the actual by buildActualPatch. Without it the autonomy
    // engine parks this node fail-closed until the founder's approved amount exists — that park
    // IS the control, and validate.ts surfaces the absence as a warning, not an error.
    laneIds: ["paid_user_acquisition"],
    phaseIds: ["phase.1d"],
    dependencies: ["workflow.data.analytics-and-attribution-blueprint"],
    outputPaths: ["growth/PAID_UA.md"],
    gates: ["check:paid-ua"],
    providers: ["provider.paid-ad-channels", "provider.posthog", "provider.revenuecat"],
    founderOnlyActions: ["approve ad-account access and spend"],
    actionClass: "spend",
    protectedCategory: "spend",
    idempotent: false,
  }),
  workflow({
    id: "workflow.growth.viral-growth-loop",
    title: "Viral growth loop",
    domainId: "domain.growth",
    areaIds: ["area.growth-revenue"],
    trigger: "Before referral/share-to-unlock/invite/comment-loop mechanics",
    instructions:
      "Write growth/VIRAL_GROWTH.md: record the fit-gate decision, the product-specific growth thesis (audience/platform, visible result, emotional trigger, product loop, content loop, conversion moment), and the full Product Loop Contract (trigger, reward, recipient value, share artifact, surface, fallback, abuse controls, policy constraints). Sequence monetization timing so the paywall catches demand after emotional investment forms, not before, per onboarding-conversion.md and revenue-monetization.md. Compute the loop's real economics weekly in the Loop Economics section — viral coefficient k = (invites/shares per active user) x (recipient conversion rate to install/activation), plus cycle time — since k below 0.15 means the loop is decoration, not a growth engine, and share/view counts alone never justify calling the lane done. Any referral/share/unlock mechanic carrying streak, scarcity, or social-proof pressure gets an ethics-guardrail pass before it ships.",
    reads: ["analytics/ANALYTICS.md", "product/experience/11-star-experience/11_STAR_EXPERIENCE.md", "state/PROJECT_STATE.yaml"],
    referenceIds: [
      "reference.growth.viral-growth-loops",
      "reference.experience.onboarding-conversion",
      "reference.money.revenue-monetization",
      "reference.experience.ethics-guardrail",
    ],
    roleId: "role.marketing-guru",
    laneIds: ["growth"],
    phaseIds: ["phase.1e"],
    dependencies: ["workflow.data.analytics-and-attribution-blueprint"],
    outputPaths: ["growth/VIRAL_GROWTH.md"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.growth.launch-narrative-and-cadence",
    title: "Launch narrative & cadence",
    domainId: "domain.growth",
    areaIds: ["area.growth-revenue"],
    trigger: "Before the public announcement, launch-day run-of-show, or weekly release rhythm",
    instructions:
      "Write growth/LAUNCH_NARRATIVE.md covering the Fit Gate, feeling-first Launch Thesis, the Two Launch Types (rare tentpole vs. weekly feature-launch heartbeat), the Launch-Day Run-of-Show, and all post copy in fenced code blocks. Every post shapes a feeling before naming the feature and clears the 2026 DO-NOT-DO list: no hashtags, no emojis carrying the message, no link in the root post (first self-reply only), no seeded 'congrats!' replies, plus the no-slop-writing.md self-check. Public claims are limited to what is true and attributable — never launder the launch agency's own aggregate stats as this app's results — and any rage-bait line clears an ethics-guardrail review before it ships. Public posting, account connections, and paid amplification spend are founder-only gates that must be confirmed before launch goes live.",
    reads: ["growth/VIRAL_GROWTH.md", "product/experience/11-star-experience/11_STAR_EXPERIENCE.md"],
    // CONTENT_ASSETS.md is a consult: this node's phase-1e narrative-thesis firing predates the
    // producer (phase 2/3); the phase-3/6 firings pick the hero asset up once it exists.
    consults: ["growth/content-assets/CONTENT_ASSETS.md"],
    referenceIds: [
      "reference.growth.launch-narrative-cadence",
      "reference.words.no-slop-writing",
      "reference.experience.ethics-guardrail",
      "reference.growth.viral-growth-loops",
    ],
    roleId: "role.marketing-guru",
    laneIds: ["growth"],
    phaseIds: ["phase.1e", "phase.3", "phase.6"],
    dependencies: ["workflow.data.analytics-and-attribution-blueprint", "workflow.growth.viral-growth-loop"],
    outputPaths: ["growth/LAUNCH_NARRATIVE.md"],
    founderOnlyActions: ["approve public launch posting"],
    actionClass: "publish",
    protectedCategory: "public_actions",
    idempotent: true,
  }),
  workflow({
    id: "workflow.money.revenue-monetization",
    title: "Revenue monetization",
    domainId: "domain.money",
    areaIds: ["area.growth-revenue"],
    trigger: "Before RevenueCat/Stripe/web billing, products, paywall, entitlement, webhooks, pricing",
    instructions:
      "Write revenue/REVENUE_OPS.md across all four spokes: RevenueCat project/entitlement/offering setup with the App Store container price held at Free (a Lifetime offer is a NON_CONSUMABLE IAP, never the container price), Stripe/web-billing setup when a web funnel is in scope, and the Price-Point Decision Procedure's competitor anchor table (5-10 rows from strategy/RESEARCH.md, dated) under a 'Pricing Decision' heading. Resolve the three named paywall-breaking gaps before calling any paywall ready: Apple MISSING_METADATA subscription-group localization, RevenueCat product-type reconciliation against the App Store counterpart, and a Release-scheme (not debug-preview) smoke check confirming currentOffering.packages is non-empty. Stand up the billing-health recovery system (grace period/account hold, billing-issue webhook to dunning push/email, one-tap update-payment) — roughly 31% of Play cancellations and 14% of App Store cancellations are involuntary billing failures, not churn. Creating live products, changing any price/trial/renewal term, or enabling live checkout is a founder-only gate; check:revenue is the pass signal.",
    reads: ["state/LAUNCH_TRACE.md", "strategy/RESEARCH.md", "state/PROJECT_STATE.yaml"],
    referenceIds: [
      "reference.money.revenue-monetization",
      "reference.money.revenuecat-and-store-products",
      "reference.money.stripe-and-web-billing",
      "reference.money.paywall-pricing-and-experiments",
      "reference.money.billing-health-and-reactivation",
    ],
    roleId: "role.engineering-leader",
    laneIds: ["revenue"],
    phaseIds: ["phase.3b"],
    dependencies: ["workflow.process.launch-trace-and-build-contracts"],
    outputPaths: ["revenue/REVENUE_OPS.md"],
    gates: ["check:revenue"],
    providers: ["provider.revenuecat", "provider.stripe"],
    founderOnlyActions: ["approve pricing and product catalog"],
    actionClass: "mutate",
    protectedCategory: "legal_pricing",
    idempotent: false,
  }),
  workflow({
    id: "workflow.growth.geo-seo-public-visibility",
    title: "GEO/SEO public visibility",
    domainId: "domain.growth",
    areaIds: ["area.growth-revenue"],
    trigger: "Before editing any landing/policy/blog copy, robots.txt, llms.txt, sitemap, schema, metadata",
    instructions:
      "Write GEO_SEO.md before editing any landing/policy/blog file, not after: run the Copy Compliance Pre-Edit Scan for false or unverifiable claims (ranked-cohort superlatives, unshipped-feature promises, implied-authority claims, lifetime/free-tier promises that don't match revenue/REVENUE_OPS.md) and the no-slop-writing.md self-check before any title tag, meta description, or answer-style section ships. Produce and live-verify the technical surface — title/description/canonical/OG/Twitter cards, robots.txt, sitemap.xml, llms.txt, JSON-LD schema — with a curl/HTTP-200 check and a JSON.parse pass on every JSON-LD block, not just files existing locally. Localize hreflang/llms.txt/schema/answer sections only for the markets LOCALIZATION_MARKET_RESEARCH.md ranks Tier 1 with real demand evidence, never by translating every page into every language. check:landing-funnel is the pass signal once the funnel this feeds is verified live.",
    reads: ["state/LAUNCH_TRACE.md", "analytics/ANALYTICS.md", "strategy/localization-market-research/LOCALIZATION_MARKET_RESEARCH.md"],
    referenceIds: ["reference.growth.geo-seo", "reference.research.localization-market-research", "reference.words.no-slop-writing"],
    roleId: "role.marketing-guru",
    laneIds: ["growth"],
    phaseIds: ["phase.4"],
    // lane.growth depends on lane.analytics-attribution (catalog/lanes.ts); this workflow
    // and workflow.growth.pre-launch-funnel-landing-waitlist (which depends on it
    // transitively) previously enforced only traceability, so a landing/funnel page could
    // publish before event tracking existed (routing-depth audit, 2026-08-07).
    dependencies: ["workflow.process.launch-trace-and-build-contracts", "workflow.data.analytics-and-attribution-blueprint"],
    outputPaths: ["GEO_SEO.md"],
    gates: ["check:landing-funnel"],
    actionClass: "publish",
    // Publishing public web/SEO surfaces is a public action; the category authorizes, the gate verifies.
    protectedCategory: "public_actions",
    idempotent: true,
  }),
  workflow({
    id: "workflow.growth.pre-launch-funnel-landing-waitlist",
    title: "Pre-launch funnel (landing/waitlist)",
    domainId: "domain.growth",
    areaIds: ["area.growth-revenue"],
    trigger: "Phase 4 — landing page, waitlist/referral loop, web funnel, live deploy verification",
    instructions:
      "Build the landing/waitlist funnel in growth/landing/ and write CRO_AUDIT.md: pick the single conversion goal, verify the above-the-fold promise/subhead/CTA/proof element needs no scroll, and match the hero promise to whichever ad or creative drove the click. Run the Friction Audit (cut every non-essential field or click) and the Mobile Viewport Rules (thumb-reachable sticky CTA, Core Web Vitals pass on a mid-tier device) since most B2C traffic is mobile. Any waitlist email-capture endpoint must return HTTP 200, not 4xx, on a duplicate submission — test it before calling the funnel live — and declare landing_viewed/landing_cta_clicked/waitlist_submitted events in analytics/ANALYTICS.md before implementing them. check:landing-funnel's live-deploy and form-smoke-test gates are the pass signal; motion is progressive enhancement that must never delay LCP/INP or hide text from crawlers.",
    reads: ["GEO_SEO.md", "analytics/ANALYTICS.md", "product/copy/COPY_BRIEF.md", "design/DESIGN.md"],
    referenceIds: [
      "reference.growth.cro-landing",
      "reference.design.landing-motion-craft",
      "reference.data.analytics-attribution",
      "reference.words.conversion-copy",
      "reference.process.tool-recipes.funnel-domain-and-privacy",
    ],
    roleId: "role.marketing-guru",
    laneIds: ["growth"],
    phaseIds: ["phase.4"],
    dependencies: ["workflow.growth.geo-seo-public-visibility"],
    outputPaths: ["growth/landing/"],
    gates: ["check:landing-funnel"],
    actionClass: "publish",
    // A live landing/waitlist funnel is a public action; the category authorizes, the gate verifies.
    protectedCategory: "public_actions",
    idempotent: false,
  }),
  workflow({
    id: "workflow.growth.ugc-creator-engine",
    title: "UGC creator engine",
    domainId: "domain.growth",
    areaIds: ["area.growth-revenue"],
    trigger: "Before founder-led organic social, creator sourcing/contracts, format-discovery tests",
    instructions:
      "Write growth/UGC_PLAYBOOK.md: record the fit-gate decision, then run the Day 0 format-discovery model — 3-5 creators, founder-written scripts for the first 4-8 weeks, same-day time-coded feedback, 5-8 reps per format before judging it — and only call a format scale-ready after 2-3 hits from the same structure across 2+ creators plus downstream install/referral/revenue evidence. Every script in ugc/script-bank.md survives the judge panel (separate reviewer passes with fresh context, one job each — pacing, vocabulary, idea strength, structure — at least one grounded in a real creator's transcript corpus) before it earns filming or generation spend; record script_id and a passed/survived judge_verdict, since check:content-assets blocks any UGC-family generation missing either. Route to influencer-sponsorship-engine.md instead when the plan is paying creators who already have an audience rather than running new niche accounts. Creator payments, paid creator-platform spend, and public posting/scheduling are founder-only gates.",
    reads: ["growth/VIRAL_GROWTH.md", "growth/LAUNCH_NARRATIVE.md", "product/experience/11-star-experience/11_STAR_EXPERIENCE.md"],
    referenceIds: [
      "reference.growth.ugc-creator-engine",
      "reference.growth.influencer-sponsorship-engine",
      "reference.growth.viral-growth-loops",
      "reference.words.no-slop-writing",
    ],
    roleId: "role.marketing-guru",
    laneIds: ["growth"],
    phaseIds: ["phase.6"],
    dependencies: ["workflow.growth.viral-growth-loop", "workflow.growth.launch-narrative-and-cadence"],
    outputPaths: ["growth/UGC_PLAYBOOK.md"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.growth.fastlane-growth-ops",
    title: "Fastlane growth ops",
    domainId: "domain.growth",
    areaIds: ["area.growth-revenue"],
    trigger: "After launch approval/public beta, or usefastlane.ai/Blitz setup, scheduling, social analytics",
    instructions:
      "Write growth/FASTLANE_OPS.md and the fastlane/ artifact set (campaign-brief.md, prompts.md, angles.json, preferences.json, schedule.json) only after the Launch Readiness Gate is true: live store/TestFlight URL, current brand/onboarding/design docs, and product claims matching store/legal/revenue docs. Run safe API reads (GET /connections, /blitz/preferences, /blitz/angles, /content, /posts) before any mutation, keep format weights summing to 100 and angle weights covering every active angle exactly once, and never write FASTLANE_API_KEY to a committed file. Source real app media (MobAI or the Apple-only XcodeBuildMCP fallback) before generic generated visuals, and run the weekly Analytics And Iteration loop tying posts back to installs/trials/purchases/attribution rather than vanity engagement. Connecting accounts, first public post, and any scheduling change are founder-only gates; check:post-launch is the pass signal.",
    // growth/UGC_PLAYBOOK.md is deliberately NOT in reads: ugc-creator-engine (its producer)
    // shares phase.6 with this node but is not a dependency, so the file may not exist when this
    // fires — Fastlane sourcing works from the narrative and script bank it can rely on.
    reads: ["growth/LAUNCH_NARRATIVE.md", "ugc/script-bank.md"],
    referenceIds: [
      "reference.growth.fastlane-growth-ops",
      "reference.growth.ugc-creator-engine",
      "reference.growth.viral-growth-loops",
      "reference.operations.paid-tool-routing",
    ],
    roleId: "role.marketing-guru",
    laneIds: ["growth", "post_launch_ops"],
    phaseIds: ["phase.6"],
    dependencies: ["workflow.growth.launch-narrative-and-cadence"],
    outputPaths: ["growth/FASTLANE_OPS.md"],
    gates: ["check:post-launch"],
    founderOnlyActions: ["approve social connections and scheduled posts"],
    actionClass: "publish",
    protectedCategory: "public_actions",
    idempotent: false,
  }),
] as const;
