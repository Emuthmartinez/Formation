import type { CatalogCapabilityRoute, CatalogRole, ContextPackId, RoleId } from "./types.js";

const parentPromptPaths = ["AGENTS.md", "APP_AGENTS.md"];
const route = (id: string, when: string): CatalogCapabilityRoute => ({ id, when });

function role(
  id: RoleId,
  name: string,
  prompt: string,
  scope: string,
  contextPackIds: ContextPackId[],
  skillRoutes: CatalogCapabilityRoute[],
  toolRoutes: CatalogCapabilityRoute[],
): CatalogRole {
  return { id, name, promptPath: `agents/${prompt}.md`, scope, parentPromptPaths: [...parentPromptPaths], contextPackIds, skillRoutes, toolRoutes };
}

/** Executable registry for every prepared APP_AGENTS.md specialist prompt. */
export const roles: CatalogRole[] = [
  role(
    "role.orchestrator",
    "Orchestrator",
    "orchestrator",
    "State owner, integration owner, sequencing, and final readiness gatekeeper.",
    ["context.process", "context.orchestration", "context.operations"],
    [route("b2c-mobile-business-launch", "always; this is the parent operating workflow")],
    [
      route("current runtime agent/subagent controls", "dispatching independent work"),
      route("git and repository validators", "integrating any completed unit"),
    ],
  ),
  role(
    "role.operator-readiness",
    "Operator readiness",
    "operator-readiness",
    "One-pass capability, access, budget, and standing-authority setup before unattended work.",
    ["context.operations", "context.store", "context.device"],
    [
      route("b2c-mobile-business-launch", "always"),
      route("browser:control-in-app-browser", "a provider has no semantic connector or CLI route"),
      route("chrome:control-chrome", "the founder explicitly chose Chrome"),
    ],
    [
      route("connector and plugin inventory", "always before requesting access"),
      route("provider API/CLI auth probes", "the launch scope names that provider"),
      route("native device/simulator inventory", "mobile build, screenshots, or store upload is in scope"),
    ],
  ),
  role(
    "role.research-strategist",
    "Research strategist",
    "research-strategist",
    "Category, customer, competitor, review, social-language, localization, and source-quality evidence.",
    ["context.research", "context.product"],
    [
      route("finding-app-niches", "category economics or App Store opportunity research"),
      route("analyzing-competitors", "competitor, review, or positioning research"),
      route("customer-research", "interviews, surveys, or customer-language synthesis"),
    ],
    [
      route("current web/search tools and canonical provider sources", "fresh external evidence is required"),
      route("AppKittie/XPOZ or approved equivalents", "category, keyword, review, or social-language evidence is required"),
    ],
  ),
  role(
    "role.product-leader",
    "Product leader",
    "product-leader",
    "ICP, 11-star experience, scope, onboarding, activation, retention, roadmap, and traceability.",
    ["context.product", "context.experience", "context.research"],
    [
      route("auditing-onboarding", "reviewing an existing onboarding flow"),
      route("onboarding", "creating or optimizing onboarding"),
      route("researching-paywalls", "competitive paywall evidence is needed"),
      route("paywalls", "designing the product paywall"),
    ],
    [route("simulator/browser product inspection", "auditing an implemented flow")],
  ),
  role(
    "role.design-guru",
    "Design guru",
    "design-guru",
    "Design system, visual proof, screenshots, accessibility, icons, motion, and content assets.",
    ["context.design", "context.experience", "context.words"],
    [
      route("design-system-architect", "creating or changing the design system"),
      route("superdesign", "producing senior-grade UI alternatives or implementation"),
      route("image", "creating or editing visual assets"),
    ],
    [
      route("image generation and visual inspection", "the assignment includes imagery or visual QA"),
      route("Design Room renderer", "design state or tokens change"),
    ],
  ),
  role(
    "role.copy-specialist",
    "Copy specialist",
    "copy-specialist",
    "Product, conversion, lifecycle, and store copy with claim and lexicon discipline.",
    ["context.words", "context.product", "context.growth", "context.store"],
    [
      route("copywriting", "creating net-new user-facing copy"),
      route("copy-editing", "rewriting or auditing existing copy"),
      route("product-marketing", "positioning or store/landing message hierarchy"),
    ],
    [route("copy and claim validators", "before returning final copy")],
  ),
  role(
    "role.marketing-guru",
    "Marketing guru",
    "marketing-guru",
    "ASO, GEO/SEO, acquisition, lifecycle, reviews, launch calendar, channels, and learning loops.",
    ["context.growth", "context.store", "context.data", "context.words"],
    [
      route("aso", "App Store or Google Play discovery work"),
      route("geo", "AI-search or GEO work"),
      route("launch", "launch planning or cadence"),
      route("ads", "paid acquisition work"),
      route("social", "organic social execution"),
    ],
    [route("current ASO, analytics, ad, and social provider tools", "the relevant channel is in scope")],
  ),
  role(
    "role.launch-surface-producer",
    "Launch surface producer",
    "launch-surface-producer",
    "Landing site, web onboarding, public copy, prices, screenshots, assets, and store product-page synchronization.",
    ["context.growth", "context.store", "context.design", "context.words", "context.money"],
    [
      route("sites:sites-building", "building or updating the landing site"),
      route("sites:sites-hosting", "deploying an approved site through a standing envelope"),
      route("cro", "landing conversion structure or experiments"),
      route("copywriting", "landing or store copy changes"),
      route("aso", "store listing or product-page changes"),
      route("ios-screenshots", "App Store screenshot production"),
      route("image", "marketing or store visual generation"),
    ],
    [
      route("site build and browser visual QA", "landing work is assigned"),
      route("App Store Connect/Google Play semantic tools or current CLIs", "store metadata/media work is assigned"),
      route("device capture and composition tools", "screenshots or previews are affected"),
    ],
  ),
  role(
    "role.mobile-engineer",
    "Mobile engineer",
    "mobile-engineer",
    "Mobile architecture, implementation, performance, platform behavior, and focused tests.",
    ["context.engineering", "context.design", "context.experience", "context.device"],
    [
      route("developing-mobile-apps", "always for mobile implementation"),
      route("reviewing-swiftui", "the app uses SwiftUI"),
      route("developing-flutter", "the app uses Flutter"),
      route("optimizing-react-native", "the app uses React Native"),
      route("building-with-xcode", "building, archiving, or testing Apple targets"),
    ],
    [
      route("current package manager and repository scripts", "always"),
      route("native build/simulator tools", "the target platform is locally reachable"),
      route("MobAI", "Android, physical-device, repeatable-matrix, or cross-platform proof is required"),
    ],
  ),
  role(
    "role.backend-infrastructure-engineer",
    "Backend infrastructure engineer",
    "backend-infrastructure-engineer",
    "Data, API, auth, jobs, deployment, observability, and provider integration.",
    ["context.engineering", "context.data", "context.money", "context.trust", "context.operations"],
    [
      route("supabase:supabase", "Supabase is selected"),
      route("supabase:supabase-postgres-best-practices", "Postgres schema or performance work is assigned"),
      route("firestore-ttl-policies", "Firestore TTL/retention is required"),
      route("sentry-sdk-setup", "observability setup is assigned"),
    ],
    [route("provider CLI/API and live proof route", "a backend provider is selected"), route("Doppler or approved secret manager", "credentials are required")],
  ),
  role(
    "role.accessibility-device-qa",
    "Accessibility and device QA",
    "accessibility-device-qa",
    "Assistive technology, locale stress, device coverage, and real-flow evidence.",
    ["context.device", "context.design", "context.store", "context.trust"],
    [
      route("auditing-accessibility", "auditing a mobile app"),
      route("testing-localization", "locale or dynamic-type stress is in scope"),
      route("running-smoke-tests", "a bounded release smoke pass is needed"),
      route("controlling-mobile-devices", "interactive device work is requested"),
    ],
    [route("accessibility tree and simulator/device controls", "runtime UI exists"), route("screenshot and recording export", "visual evidence is required")],
  ),
  role(
    "role.security-architect",
    "Security architect",
    "security-architect",
    "Threat model, hardening, app integrity, abuse controls, accepted risks, and incident response.",
    ["context.trust", "context.engineering", "context.operations"],
    [route("sentry-code-review", "Sentry findings or release-health review is in scope"), route("sentry-sdk-setup", "Sentry setup is required")],
    [
      route("security scanners and provider proof", "the stack supports them"),
      route("current platform security documentation", "store or platform rules may have changed"),
    ],
  ),
  role(
    "role.engineering-leader",
    "Engineering leader",
    "engineering-leader",
    "Cross-stack architecture, integration, orchestration, signing/release gates, and readiness.",
    ["context.engineering", "context.orchestration", "context.store", "context.trust"],
    [
      route("developing-mobile-apps", "reviewing the mobile implementation plan"),
      route("building-with-xcode", "Apple build/release work is assigned"),
      route("running-smoke-tests", "release readiness is being judged"),
    ],
    [
      route("repository validation and CI", "always before readiness"),
      route("provider and distribution proof tools", "provider-backed or store work is claimed complete"),
    ],
  ),
  role(
    "role.customer-success",
    "Customer success",
    "customer-success",
    "Support, FAQ, privacy/delete/refund/restore, lifecycle copy, response queues, and feedback.",
    ["context.operations", "context.trust", "context.words"],
    [route("emails", "lifecycle or support email is assigned"), route("churn-prevention", "retention, cancellation, or reactivation work is assigned")],
    [route("support/email provider tools", "live queues or delivery are in scope")],
  ),
];

export const roleIds: readonly RoleId[] = roles.map((item) => item.id);
