import type { CatalogRole, RoleId } from "./types.js";

/**
 * The specialist-role registry: the same seven roles the installed app-agent roster
 * (workspace-template/business/engineering/app-agent-roster/APP_AGENTS.md) hands to future
 * sessions, promoted from prose to catalog data so a workflow node can name which specialist
 * owns it and validate.ts can reject a role nobody defined. `promptPath` points at the role's
 * entrypoint inside a provisioned business workspace (a workspace-relative path, not a skill
 * path — the roster ships with the business, so the catalog cannot existsSync it here).
 *
 * Keep this list in lockstep with APP_AGENTS.md's Roles section: that file remains the
 * founder-facing definition of what each role may do; this registry is the routing key.
 */
export const roles: CatalogRole[] = [
  {
    id: "role.orchestrator",
    name: "Orchestrator",
    promptPath: "agents/orchestrator.md",
    scope: "State owner, integration owner, sequencing, and the final readiness gatekeeper.",
  },
  {
    id: "role.product-leader",
    name: "Product leader",
    promptPath: "agents/product-leader.md",
    scope: "ICP, 11-star experience, scope, onboarding, activation, retention, roadmap, traceability.",
  },
  {
    id: "role.design-guru",
    name: "Design guru",
    promptPath: "agents/design-guru.md",
    scope: "Design system, visual proof, screenshots, accessibility, icons, motion, content assets.",
  },
  {
    id: "role.engineering-leader",
    name: "Engineering leader",
    promptPath: "agents/engineering-leader.md",
    scope: "Architecture, implementation, provider proof, signing/release gates, tests, readiness.",
  },
  {
    id: "role.marketing-guru",
    name: "Marketing guru",
    promptPath: "agents/marketing-guru.md",
    scope: "ASO, GEO/SEO, UGC, social, analytics read-back, reviews, launch calendar, channels.",
  },
  {
    id: "role.security-architect",
    name: "Security architect",
    promptPath: "agents/security-architect.md",
    scope: "Threat model, hardening, app integrity, abuse controls, accepted risks, incident response.",
  },
  {
    id: "role.customer-success",
    name: "Customer success",
    promptPath: "agents/customer-success.md",
    scope: "Support, FAQ, privacy/delete/refund/restore, lifecycle copy, response queues, feedback.",
  },
];

export const roleIds: readonly RoleId[] = roles.map((role) => role.id);
