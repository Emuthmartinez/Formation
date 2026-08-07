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

/**
 * Spend an attempt before doing the slow work of checking it. A caller that turns out to be
 * legitimate settles it with `settleAuthSuccess`; anything else has already been counted, so a
 * failure path has nothing left to do.
 */
export function claimAuthAttempt(limiters, keys) {
  limiters.address.claim(keys.address);
  try {
    limiters.account.claim(keys.account);
  } catch (error) {
    // The account bucket refused, so the address attempt was never really made.
    limiters.address.release(keys.address);
    throw error;
  }
}

/** A correct answer: forget this account's attempts, and give the address its attempt back. */
export function settleAuthSuccess(limiters, keys) {
  limiters.address.release(keys.address);
  limiters.account.clear(keys.account);
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

/**
 * Refuses a change built from a version of a record that somebody else has already replaced.
 *
 * Two members editing one deliverable used to end in silence: whoever saved second overwrote the
 * first, whose work survived only in version history nobody had a reason to open. The first person
 * had no way to know it had happened.
 *
 * The guard is **opt-in by the caller**. A request that names the version or timestamp it was built
 * from is checked; one that names neither proceeds, because a caller who did not read the record
 * first is not claiming to have. That keeps every existing integration working and makes the web
 * app's editor — the one place a person spends minutes on a change — the place that opts in.
 *
 * The refusal names who moved it and when, because "someone changed this" is not a sentence anyone
 * can act on. Recovering the caller's unsaved work is the client's job, and the client does it:
 * refusing without preserving their text would be worse than the overwrite this replaces.
 */
export function assertUnchanged(record, expected, label) {
  if (expected?.version !== undefined && expected.version !== null) {
    if (!Number.isInteger(expected.version)) throw new HttpError(400, "The version being changed must be a whole number.");
    if (record.version !== expected.version) throw new HttpError(409, conflictMessage(record, label));
  }
  if (expected?.updatedAt !== undefined && expected.updatedAt !== null) {
    if (typeof expected.updatedAt !== "string") throw new HttpError(400, "The version being changed must be named by its timestamp.");
    if (record.updatedAt !== expected.updatedAt) throw new HttpError(409, conflictMessage(record, label));
  }
}

function conflictMessage(record, label) {
  const who = record.lastChangedBy ?? record.createdBy ?? null;
  const when = record.updatedAt ? ` at ${record.updatedAt.slice(11, 16)} UTC on ${record.updatedAt.slice(0, 10)}` : "";
  return who
    ? `${who} saved a newer ${label}${when}. Nothing was lost — read theirs, then decide whether yours still applies.`
    : `Someone else saved a newer ${label}${when}. Nothing was lost — read theirs, then decide whether yours still applies.`;
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
