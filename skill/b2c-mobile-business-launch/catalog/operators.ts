import type { CatalogDomainId } from "./types.js";

/**
 * Ported from runtime/graph/operators.ts + runtime/graph/define.ts's defineOperators()
 * (deleted at cutover, U11 — KTD11 "dead engine code superseded by v2"). defineOperators()
 * was an identity function carrying only a generic-const type constraint; that constraint is
 * inlined here as a direct `as const` annotation, matching every other catalog/*.ts module's
 * convention (catalog/lanes.ts, catalog/phases.ts).
 *
 * Not part of the v2 Catalog shape composeCatalog() returns — no v2 consumer needs the full
 * 12-operator roster except tooling/render-business-control-plane-workspace.ts, which reads
 * four of these (`operator.orchestrator`, `operator.product-leader`, `operator.design-guru`,
 * `operator.engineering-leader`) by id for the Business Control Plane's Agent Lanes panel.
 * The full roster ports rather than trimming to those four: `contextPackIds`/`domainIds`/
 * `promptPath` on the other eight (founder, marketing-guru, security-architect,
 * customer-success, maintainer, validator, renderer) are real, still-accurate role
 * definitions with live `promptPath` targets under
 * workspace/business/engineering/app-agent-roster/agents/ — dropping them would be a content
 * loss with no v2 consumer requiring it, not a cull the ledger or KTD11 calls for.
 */
export interface CatalogOperator {
  id: string;
  name: string;
  kind: "human" | "agent" | "system";
  goal: string;
  domainIds: readonly CatalogDomainId[];
  contextPackIds: readonly string[];
  allowedActions: readonly string[];
  founderGatedActions: readonly string[];
  forbiddenActions: readonly string[];
  artifactPaths: readonly string[];
  promptPath?: string;
}

const founderGates = [
  "credentials and account access",
  "spend",
  "legal and pricing approval",
  "public posting",
  "destructive actions",
  "final submission or release",
];
const agentForbidden = ["disclose raw secrets", "silently approve founder-only actions", "claim readiness without deterministic proof"];

export const operators: readonly CatalogOperator[] = [
  {
    id: "operator.founder",
    name: "Founder",
    kind: "human",
    goal: "Own irreversible, financial, legal, public, and credential-bearing decisions while delegating the operating work.",
    domainIds: ["domain.operations", "domain.money", "domain.store", "domain.trust"],
    contextPackIds: ["context.operations"],
    allowedActions: founderGates,
    founderGatedActions: [],
    forbiddenActions: ["treat silence as approval"],
    artifactPaths: ["operations/BUSINESS_ACCESS.md", "state/PROJECT_STATE.yaml"],
  },
  {
    id: "operator.orchestrator",
    name: "Orchestrator",
    kind: "agent",
    goal: "Own sequencing, integration, durable state, proof, and the next safe action across the launch.",
    domainIds: ["domain.process", "domain.orchestration", "domain.operations"],
    contextPackIds: ["context.process", "context.orchestration", "context.operations"],
    allowedActions: ["assign bounded work", "update durable state", "integrate outputs", "run validators", "prepare founder decisions"],
    founderGatedActions: founderGates,
    forbiddenActions: agentForbidden,
    artifactPaths: ["state/PROJECT_STATE.yaml", "state/launch-cockpit.html", "operations/ORCHESTRATION.md", "engineering/PRODUCTION_READINESS.md"],
    promptPath: "workspace/business/engineering/app-agent-roster/agents/orchestrator.md",
  },
  {
    id: "operator.marketing-guru",
    name: "Marketing Guru",
    kind: "agent",
    goal: "Own evidence-backed distribution, store visibility, launch narrative, creators, paid acquisition, and channel learning.",
    domainIds: ["domain.growth", "domain.store", "domain.data", "domain.words"],
    contextPackIds: ["context.growth", "context.store", "context.data", "context.words"],
    allowedActions: ["research channels", "prepare campaigns", "draft public copy", "audit attribution"],
    founderGatedActions: ["spend", "public posting", "account connections"],
    forbiddenActions: agentForbidden,
    artifactPaths: ["PAID_UA.md", "growth/UGC_PLAYBOOK.md", "growth/FASTLANE_OPS.md", "growth/LAUNCH_NARRATIVE.md"],
    promptPath: "workspace/business/engineering/app-agent-roster/agents/marketing-guru.md",
  },
  {
    id: "operator.engineering-leader",
    name: "Engineering Leader",
    kind: "agent",
    goal: "Own architecture, implementation, tests, providers, device proof, and production-readiness evidence.",
    domainIds: ["domain.engineering", "domain.store", "domain.data", "domain.money"],
    contextPackIds: ["context.engineering", "context.store", "context.data", "context.money"],
    allowedActions: ["implement bounded changes", "run builds and tests", "prepare release evidence"],
    founderGatedActions: ["production mutations", "store submission", "destructive actions"],
    forbiddenActions: agentForbidden,
    artifactPaths: ["engineering/TECH_SPEC.md", "engineering/ENGINEERING_PLAN.md", "engineering/PRODUCTION_READINESS.md"],
    promptPath: "workspace/business/engineering/app-agent-roster/agents/engineering-leader.md",
  },
  {
    id: "operator.security-architect",
    name: "Security Architect",
    kind: "agent",
    goal: "Own threat modeling, hardening, security-tool routing, accepted risks, and incident readiness.",
    domainIds: ["domain.trust", "domain.engineering", "domain.operations"],
    contextPackIds: ["context.trust", "context.engineering", "context.operations"],
    allowedActions: ["audit controls", "run approved scanners", "prepare accepted-risk decisions"],
    founderGatedActions: ["security spend", "production credential changes", "risk acceptance"],
    forbiddenActions: agentForbidden,
    artifactPaths: ["trust/SECURITY.md", "trust/security-review.html", "engineering/PRODUCTION_READINESS.md"],
    promptPath: "workspace/business/engineering/app-agent-roster/agents/security-architect.md",
  },
  {
    id: "operator.product-leader",
    name: "Product Leader",
    kind: "agent",
    goal: "Own customer evidence, scope, the core loop, activation, retention, and evidence-to-product traceability.",
    domainIds: ["domain.research", "domain.product", "domain.experience"],
    contextPackIds: ["context.research", "context.product", "context.experience"],
    allowedActions: ["research", "propose scope", "audit product contracts"],
    founderGatedActions: ["go-pivot-kill decision", "material scope change"],
    forbiddenActions: agentForbidden,
    artifactPaths: ["strategy/RESEARCH.md", "product/SPEC.md", "product/experience/11-star-experience/11_STAR_EXPERIENCE.md", "state/LAUNCH_TRACE.md"],
    promptPath: "workspace/business/engineering/app-agent-roster/agents/product-leader.md",
  },
  {
    id: "operator.design-guru",
    name: "Design Guru",
    kind: "agent",
    goal: "Own visual state, tokens, screen craft, accessibility, screenshots, and generated visual assets.",
    domainIds: ["domain.design", "domain.experience", "domain.words"],
    contextPackIds: ["context.design", "context.experience", "context.words"],
    allowedActions: ["mutate design state", "render visual proof", "audit accessibility"],
    founderGatedActions: ["approve final brand", "purchase visual tools", "publish assets"],
    forbiddenActions: agentForbidden,
    artifactPaths: ["strategy/BRAND.md", "design/DESIGN.md", "design/design.html", "growth/content-assets/CONTENT_ASSETS.md"],
    promptPath: "workspace/business/engineering/app-agent-roster/agents/design-guru.md",
  },
  {
    id: "operator.customer-success",
    name: "Customer Success",
    kind: "agent",
    goal: "Own support, lifecycle communication, refunds, deletion, feedback, and review-response readiness.",
    domainIds: ["domain.operations", "domain.trust", "domain.words"],
    contextPackIds: ["context.operations", "context.trust", "context.words"],
    allowedActions: ["prepare support operations", "draft lifecycle copy", "triage feedback"],
    founderGatedActions: ["public responses", "refund policy changes", "legal commitments"],
    forbiddenActions: agentForbidden,
    artifactPaths: ["growth/EMAIL_OPS.md", "operations/POST_LAUNCH_OPS.md", "trust/PRIVACY.md", "trust/TERMS.md"],
    promptPath: "workspace/business/engineering/app-agent-roster/agents/customer-success.md",
  },
  {
    id: "operator.maintainer",
    name: "Skill Maintainer",
    kind: "human",
    goal: "Own source architecture, releases, compatibility decisions, and the installed runtime.",
    domainIds: ["domain.machine"],
    contextPackIds: ["context.machine"],
    allowedActions: ["change graph definitions", "cut releases", "approve catalog schema changes"],
    founderGatedActions: [],
    forbiddenActions: ["merge red changes", "publish secret-bearing fixtures"],
    artifactPaths: ["skill-version.json", "docs/architecture.md", "docs/validators.md"],
  },
  {
    id: "operator.validator",
    name: "Deterministic Validator System",
    kind: "system",
    goal: "Reject unsupported readiness claims and structural drift with stable issue codes.",
    domainIds: ["domain.machine", "domain.process"],
    contextPackIds: ["context.machine"],
    allowedActions: ["read files", "emit findings", "fail the audit"],
    founderGatedActions: [],
    forbiddenActions: ["mutate business state", "silently waive findings"],
    artifactPaths: ["state/PROJECT_STATE.yaml", "LAUNCHBENCH.md"],
  },
  {
    id: "operator.renderer",
    name: "Deterministic Renderer System",
    kind: "system",
    goal: "Project typed state and graph definitions into reproducible human-readable artifacts.",
    domainIds: ["domain.machine", "domain.design", "domain.process"],
    contextPackIds: ["context.machine", "context.design", "context.process"],
    allowedActions: ["read canonical state", "write generated projections"],
    founderGatedActions: [],
    forbiddenActions: ["invent business truth", "write timestamps into deterministic projections"],
    artifactPaths: ["state/launch-cockpit.html", "design/design-room.html", "catalog/generated/catalog.json"],
  },
] as const;
