/**
 * Who may do what inside one company.
 *
 * Formation workspaces are shared: a founder brings in a cofounder, an advisor, a contractor, an
 * investor. Membership alone used to answer every question — anyone who could see a company could
 * rewrite its thesis, spend its generation budget, and answer its launch approvals. This module is
 * the single place that says otherwise.
 *
 * The roles form a ladder rather than a grid. Each capability records the *least* role that holds
 * it, so granting a new capability is one decision instead of four, and a role value the ladder
 * does not recognise — a hand-edited store file, a future bug — holds nothing at all.
 *
 * This module is pure. It reads a database snapshot and answers questions. The two throwing
 * wrappers live where their error types belong: `requireWorkspace` in routes/shared.mjs speaks
 * HttpError, and `requireMembership` in execution.mjs speaks ExecutionError.
 */

/** Least capable first. A role's index is its rank; every role holds what the roles below it hold. */
export const ROLES = ["viewer", "reviewer", "editor", "owner"];

/**
 * What each role means in a company, in the words a founder would use to choose one. The web app
 * renders these when the founder picks who someone is, so they belong beside the ladder that gives
 * them force rather than in a copy file that can drift away from it.
 */
export const ROLE_DESCRIPTIONS = {
  viewer: {
    title: "Viewer",
    summary: "Sees the whole company and changes nothing.",
    detail: "For an investor, a board member, or anyone who needs the full picture without a hand on the wheel.",
  },
  reviewer: {
    title: "Reviewer",
    summary: "Can question the record and add evidence to it.",
    detail: "For an advisor or a domain expert: they can raise open questions and attach what they know, but the company's source of truth, its deliverables, and its decisions stay with the team.",
  },
  editor: {
    title: "Editor",
    summary: "Does the work: workstreams, decisions, deliverables, and launch steps.",
    detail: "For a cofounder or a contractor doing the building. They cannot rewrite what the company is, and they cannot answer a launch approval.",
  },
  owner: {
    title: "Owner",
    summary: "Everything, including what the company is and what it commits to.",
    detail: "Owners change the company's source of truth and answer the launch engine's approvals. Every company keeps at least one.",
  },
};

/**
 * Every workspace-scoped capability, the least role that holds it, and what a founder is told when
 * they do not. Adding a route means adding it to an existing capability here or naming a new one —
 * there is no third option, because the membership lookup will not run without a capability id.
 */
export const CAPABILITIES = {
  "workspace-read": {
    minimumRole: "viewer",
    covers: "Seeing the company: its snapshot, evidence, decisions, tasks, deliverables, launch runs, and approvals.",
    denial: "You do not have access to this company.",
  },
  "evidence-write": {
    minimumRole: "reviewer",
    covers: "Recording and revising claims — facts, assumptions, recommendations, and open questions — and the evidence behind them.",
    denial: "You can read this company's evidence but not change it. Ask an owner to make you a reviewer.",
  },
  "work-write": {
    minimumRole: "editor",
    covers: "The working record: workstream context and next actions, tasks, and deliverable edits.",
    denial: "Only this company's editors and owners can change the work.",
  },
  "decision-write": {
    minimumRole: "editor",
    covers: "Recording and revising decisions, their rationale, and their review dates.",
    denial: "Only this company's editors and owners can record a decision.",
  },
  "generation-request": {
    minimumRole: "editor",
    covers: "Asking Formation to draft a deliverable.",
    denial: "Only this company's editors and owners can request a draft.",
  },
  "launch-engine-advance": {
    minimumRole: "editor",
    covers: "Asking the launch engine to take the next step on this company's plan.",
    denial: "Only this company's editors and owners can advance the launch plan.",
  },
  "company-write": {
    minimumRole: "owner",
    covers: "The company's source of truth: name, stage, launch target, founder capacity, thesis, customer, problem, solution, positioning, business model, and pricing.",
    denial: "Only this company's owner can change what the company is.",
  },
  "approval-decide": {
    minimumRole: "owner",
    covers: "Answering a launch approval on the company's behalf.",
    denial: "Only this company's owner can answer a launch approval.",
  },
};

/**
 * Surfaces that deliberately sit outside the ladder, recorded here so that "this route has no
 * capability" is always a stated decision rather than an omission.
 *
 * - `GET /api/health`, `GET /api/config`, and everything under `/api/auth/` run before any
 *   membership exists. They are gated by deployment flags, not by a role.
 * - `GET /api/session` and `GET /api/workspaces` return only the caller's own memberships.
 * - `POST /api/workspaces` creates a company and makes the caller its owner. There is no existing
 *   company to hold a capability on.
 */
export const UNSCOPED_SURFACES = Object.freeze([
  "public-access",
  "own-session-read",
  "workspace-create",
]);

const RANK = new Map(ROLES.map((role, index) => [role, index]));

/** The default for a role value the ladder does not recognise. Least privilege, not most. */
export const FALLBACK_ROLE = "viewer";

export function isRole(value) {
  return typeof value === "string" && RANK.has(value);
}

/**
 * Does this role hold this capability?
 *
 * Throws on an unknown capability id so a typo at a call site fails loudly at the first request
 * rather than silently granting or denying. Returns false — never throws — for an unknown role, so
 * a corrupted membership row locks its holder out instead of crashing the company for everyone.
 */
export function hasCapability(role, capabilityId) {
  const capability = CAPABILITIES[capabilityId];
  if (!capability) throw new Error(`Unknown workspace capability: ${String(capabilityId)}`);
  const held = RANK.get(role);
  if (held === undefined) return false;
  return held >= RANK.get(capability.minimumRole);
}

/** Everything this role holds, for the web app to gate its own controls with. */
export function capabilitiesForRole(role) {
  return Object.keys(CAPABILITIES).filter((capabilityId) => hasCapability(role, capabilityId));
}

export function denialMessage(capabilityId) {
  const capability = CAPABILITIES[capabilityId];
  if (!capability) throw new Error(`Unknown workspace capability: ${String(capabilityId)}`);
  return capability.denial;
}

/**
 * The one membership lookup. Returns the workspace, the membership, and whether the capability is
 * held — the callers decide which error type to raise, because a missing company and a missing
 * capability are different answers and the platform tells them apart deliberately:
 * a stranger is told the company does not exist; a member is told what they cannot do.
 */
export function resolveAccess(database, workspaceId, userId, capabilityId) {
  if (!CAPABILITIES[capabilityId]) throw new Error(`Unknown workspace capability: ${String(capabilityId)}`);
  const membership = database.memberships.find(
    (entry) => entry.workspaceId === workspaceId && entry.userId === userId,
  );
  const workspace = database.workspaces.find((entry) => entry.id === workspaceId);
  if (!membership || !workspace) return { found: false, allowed: false, workspace: null, membership: null };
  return { found: true, allowed: hasCapability(membership.role, capabilityId), workspace, membership };
}
