import { createId } from "../domain.mjs";
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

export function assertAuthAllowed(limiters, keys) {
  limiters.address.assertAllowed(keys.address);
  limiters.account.assertAllowed(keys.account);
}

export function recordAuthFailure(limiters, keys) {
  limiters.address.recordFailure(keys.address);
  limiters.account.recordFailure(keys.account);
}

export function requireWorkspace(database, workspaceId, userId) {
  const membership = database.memberships.find(
    (entry) => entry.workspaceId === workspaceId && entry.userId === userId,
  );
  if (!membership) throw new HttpError(404, "Workspace not found.");
  const workspace = database.workspaces.find((entry) => entry.id === workspaceId);
  if (!workspace) throw new HttpError(404, "Workspace not found.");
  return workspace;
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
