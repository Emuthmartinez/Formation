import { createId } from "../domain.mjs";
import { denialMessage, resolveAccess } from "../domain/capabilities.mjs";
import { HttpError } from "../http.mjs";

export function authAttemptKeys(request, email) {
  const forwarded = process.env.TRUST_PROXY === "true" ? request.headers["x-forwarded-for"] : null;
  const address = Array.isArray(forwarded)
    ? forwarded[0]
    : String(forwarded ?? request.socket?.remoteAddress ?? "unknown").split(",")[0].trim();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  return {
    account: `account:${address}:${normalizedEmail}`,
    address: `address:${address}`,
  };
}

/** The requesting device, for limiters that have no account to key on. */
export function clientAddressKey(request) {
  return authAttemptKeys(request, "").address;
}

export function assertAuthAllowed(limiters, keys) {
  limiters.address.assertAllowed(keys.address);
  limiters.account.assertAllowed(keys.account);
}

export function recordAuthFailure(limiters, keys) {
  limiters.address.recordFailure(keys.address);
  limiters.account.recordFailure(keys.account);
}

/**
 * The one gate every workspace-scoped route passes through. The capability is required, not
 * optional: a route that does not name what it is doing cannot look a membership up at all, which
 * is what keeps a future handler from quietly inheriting a member's full authority.
 *
 * Someone with no membership is told the company was not found — a stranger learns nothing about
 * which companies exist. A member who lacks the capability is told what they cannot do, because
 * hiding it from them would only make the product feel broken.
 */
export function requireWorkspace(database, workspaceId, userId, capabilityId) {
  const access = resolveAccess(database, workspaceId, userId, capabilityId);
  if (!access.found) throw new HttpError(404, "Workspace not found.");
  if (!access.allowed) throw new HttpError(403, denialMessage(capabilityId));
  return access.workspace;
}

export function requireWorkstream(workspace, workstreamId) {
  if (typeof workstreamId !== "string" || !workspace.workstreams.some((entry) => entry.id === workstreamId)) {
    throw new HttpError(400, "A valid workstream is required.");
  }
}

export function touchWorkspace(database, workspace, actor, title, detail) {
  const now = new Date().toISOString();
  workspace.updatedAt = now;
  database.activity.push({
    id: createId("act"),
    workspaceId: workspace.id,
    type: "workspace-updated",
    title,
    detail,
    actor,
    createdAt: now,
  });
}
