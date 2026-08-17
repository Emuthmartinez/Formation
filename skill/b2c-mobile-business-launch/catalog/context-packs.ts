import type { CatalogContextPack } from "./types.js";

/**
 * Executable role-level routing packs. A pack is deliberately a shallow list of catalog
 * references, not another prose index: the bridge resolves every id to path + loadWhen and the
 * worker prompt exposes those conditions beside the task's mandatory references. This keeps the
 * nesting useful without preloading an entire domain into every specialist context.
 */
export const contextPacks: readonly CatalogContextPack[] = [
  {
    id: "context.process",
    title: "Launch process",
    referenceIds: [
      "reference.process.launch-phases",
      "reference.process.artifact-contracts",
      "reference.process.flow-traceability",
      "reference.process.change-cascade",
    ],
  },
  {
    id: "context.orchestration",
    title: "Orchestration",
    referenceIds: [
      "reference.orchestration.project-state",
      "reference.orchestration.parallel-agent-orchestration",
      "reference.orchestration.dynamic-workflows",
      "reference.orchestration.compound-engineering-routing",
    ],
  },
  {
    id: "context.operations",
    title: "Founder-zero operations",
    referenceIds: [
      "reference.operations.founder-zero-operator",
      "reference.operations.frontier-agent-operations",
      "reference.operations.paid-tool-routing",
      "reference.operations.secrets-management",
      "reference.process.provider-proof",
    ],
  },
  {
    id: "context.research",
    title: "Research",
    referenceIds: [
      "reference.research.go-pivot-or-kill",
      "reference.research.localization-market-research",
      "reference.process.tool-recipes.research-intelligence",
    ],
  },
  { id: "context.product", title: "Product", referenceIds: ["reference.product.core-loop-and-v1-scope", "reference.product.product-moat"] },
  {
    id: "context.experience",
    title: "Experience",
    referenceIds: ["reference.experience.eleven-star-experience", "reference.experience.onboarding-conversion", "reference.experience.ethics-guardrail"],
  },
  {
    id: "context.design",
    title: "Design",
    referenceIds: [
      "reference.design.design-room",
      "reference.design.design-visual-system",
      "reference.design.premium-mobile-craft",
      "reference.design.quality-lens",
      "reference.design.surfaces-b2c",
    ],
  },
  { id: "context.words", title: "Words", referenceIds: ["reference.words.conversion-copy", "reference.words.no-slop-writing"] },
  {
    id: "context.engineering",
    title: "Engineering",
    referenceIds: [
      "reference.engineering.engineering-orchestration",
      "reference.engineering.backend-data-contract",
      "reference.engineering.app-agent-roster",
      "reference.process.tool-recipes.engineering-and-agent-orchestration",
    ],
  },
  {
    id: "context.device",
    title: "Device and accessibility proof",
    referenceIds: [
      "reference.engineering.mobai-toolbelt",
      "reference.engineering.xcodebuildmcp-testing",
      "reference.process.tool-recipes.device-capture-and-proof",
    ],
  },
  {
    id: "context.store",
    title: "Stores",
    referenceIds: [
      "reference.store.aso-store-ops",
      "reference.store.app-store-listing-prep",
      "reference.store.store-console-workflow",
      "reference.store.apple-signing-release",
      "reference.store.google-play-release",
      "reference.store.app-store-connect-cli",
    ],
  },
  {
    id: "context.growth",
    title: "Growth",
    referenceIds: [
      "reference.growth.cro-landing",
      "reference.growth.geo-seo",
      "reference.growth.launch-narrative-cadence",
      "reference.growth.paid-user-acquisition",
      "reference.growth.ugc-creator-engine",
    ],
  },
  { id: "context.data", title: "Analytics", referenceIds: ["reference.data.analytics-attribution"] },
  {
    id: "context.money",
    title: "Revenue",
    referenceIds: [
      "reference.money.revenue-monetization",
      "reference.money.revenuecat-and-store-products",
      "reference.money.stripe-and-web-billing",
      "reference.money.paywall-pricing-and-experiments",
    ],
  },
  { id: "context.trust", title: "Trust", referenceIds: ["reference.trust.privacy-terms", "reference.trust.security-release-hardening"] },
  {
    id: "context.machine",
    title: "Skill maintenance",
    referenceIds: ["reference.process.control-plane", "reference.process.failure-cards", "reference.process.launch-coverage"],
  },
];
