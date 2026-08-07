import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { FALLBACK_ROLE, ROLES, isRole } from "./capabilities.mjs";
import { createId } from "./shared.mjs";

/**
 * Who is in a company, and how they got there.
 *
 * Every function here runs inside a store transaction and returns a founder-readable answer. The
 * invariants are the point: a company always keeps at least one owner, an invitation is single-use
 * and belongs to one email address, and the raw invitation token exists only in the response that
 * created it — the store keeps a hash, exactly as it does for a session.
 *
 * Formation has no mail transport yet. Rather than pretend otherwise, the founder receives the
 * invitation link once and shares it themselves. That is honest about the boundary and changes
 * nothing about the security model: the link is a bearer token bound to one email address, with an
 * expiry, revocable at any time, and useless to anyone signed in as someone else.
 */

/** Long enough that guessing is not a strategy, short enough to paste into a message. */
const TOKEN_BYTES = 32;
export const INVITATION_TTL_DAYS = 14;
/** A bound on outstanding invitations, so a compromised owner account cannot mint them forever. */
export const MAX_PENDING_INVITATIONS = 25;

export class MemberError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "MemberError";
    this.status = status;
  }
}

export function hashInvitationToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

/**
 * Who is in this company, in the order they joined. Email addresses are visible to every member:
 * people who share a company can see who else is in it, and hiding that would only make the list
 * useless without making anything safer.
 */
export function listMembers(database, workspaceId) {
  return database.memberships
    .filter((entry) => entry.workspaceId === workspaceId)
    .map((membership) => {
      const user = database.users.find((entry) => entry.id === membership.userId);
      return {
        id: membership.id,
        userId: membership.userId,
        name: user?.name ?? "Removed account",
        email: user?.email ?? null,
        role: isRole(membership.role) ? membership.role : FALLBACK_ROLE,
        joinedAt: membership.createdAt ?? null,
        invitedBy: membership.invitedByName ?? null,
      };
    })
    .sort((a, b) => String(a.joinedAt).localeCompare(String(b.joinedAt)));
}

/** Invitations that could still be accepted. Never carries the token hash. */
export function listPendingInvitations(database, workspaceId, now = new Date().toISOString()) {
  return database.invitations
    .filter((entry) => entry.workspaceId === workspaceId && isPending(entry, now))
    .map(founderInvitation)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function founderInvitation(invitation) {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    invitedBy: invitation.invitedByName,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
  };
}

function isPending(invitation, now) {
  return !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt > now;
}

function ownerCount(database, workspaceId) {
  return database.memberships.filter((entry) => entry.workspaceId === workspaceId && entry.role === "owner").length;
}

/**
 * Invite someone by email. Returns the durable record and the raw token, which the caller shows to
 * the inviter once and never stores.
 */
export function createInvitation(database, { workspaceId, email, role, invitedBy, now = new Date().toISOString() }) {
  if (!isRole(role)) throw new MemberError(400, "Choose one of viewer, reviewer, editor, or owner.");

  const alreadyMember = database.memberships.some((membership) => {
    if (membership.workspaceId !== workspaceId) return false;
    const user = database.users.find((entry) => entry.id === membership.userId);
    return user?.email === email;
  });
  if (alreadyMember) throw new MemberError(409, "That person is already part of this company.");

  const pending = database.invitations.filter((entry) => entry.workspaceId === workspaceId && isPending(entry, now));
  if (pending.some((entry) => entry.email === email)) {
    throw new MemberError(409, "There is already an open invitation for that email address. Cancel it first to send a new one.");
  }
  if (pending.length >= MAX_PENDING_INVITATIONS) {
    throw new MemberError(409, `This company already has ${pending.length} invitations waiting. Cancel some before sending more.`);
  }

  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const invitation = {
    id: createId("inv"),
    workspaceId,
    email,
    role,
    tokenHash: hashInvitationToken(token),
    invitedByUserId: invitedBy.id,
    invitedByName: invitedBy.name,
    createdAt: now,
    expiresAt: new Date(new Date(now).getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1_000).toISOString(),
    acceptedAt: null,
    acceptedByUserId: null,
    revokedAt: null,
    revokedByUserId: null,
  };
  database.invitations.push(invitation);
  recordAccessChange(database, workspaceId, {
    type: "member-invited",
    title: `${email} invited as ${role}`,
    detail: `The invitation expires ${invitation.expiresAt.slice(0, 10)} and can be cancelled at any time.`,
    actor: invitedBy.name,
    now,
  });
  return { invitation, token };
}

export function revokeInvitation(database, { workspaceId, invitationId, actor, now = new Date().toISOString() }) {
  const invitation = database.invitations.find((entry) => entry.id === invitationId && entry.workspaceId === workspaceId);
  if (!invitation) throw new MemberError(404, "Invitation not found.");
  if (!isPending(invitation, now)) throw new MemberError(409, "That invitation is no longer open.");
  invitation.revokedAt = now;
  invitation.revokedByUserId = actor.id;
  recordAccessChange(database, workspaceId, {
    type: "member-invite-revoked",
    title: `Invitation to ${invitation.email} cancelled`,
    detail: "The link no longer works.",
    actor: actor.name,
    now,
  });
  return founderInvitation(invitation);
}

/**
 * Find the invitation a raw token refers to, comparing in constant time so a caller cannot learn
 * about a near-miss from how long the answer took. Returns null for anything that is not a live,
 * pending invitation — expired, revoked, already accepted, and never-existed are one answer.
 */
export function findLiveInvitation(database, token, now = new Date().toISOString()) {
  if (typeof token !== "string" || !token) return null;
  const supplied = Buffer.from(hashInvitationToken(token), "hex");
  for (const invitation of database.invitations) {
    const stored = Buffer.from(String(invitation.tokenHash ?? ""), "hex");
    if (stored.length !== supplied.length) continue;
    if (!timingSafeEqual(stored, supplied)) continue;
    return isPending(invitation, now) ? invitation : null;
  }
  return null;
}

/**
 * Join a company with an invitation. The signed-in account's email must be the invited one: a
 * forwarded link is useless to whoever it was forwarded to, which is what makes the invitation a
 * statement about a person rather than about whoever holds the URL.
 */
export function acceptInvitation(database, { token, user, now = new Date().toISOString() }) {
  const invitation = findLiveInvitation(database, token, now);
  if (!invitation) throw new MemberError(404, "That invitation link is not valid. It may have been used, cancelled, or expired.");
  if (invitation.email !== String(user.email ?? "").toLowerCase()) {
    throw new MemberError(403, `This invitation was sent to ${invitation.email}. Sign in with that email address to accept it.`);
  }

  const workspace = database.workspaces.find((entry) => entry.id === invitation.workspaceId);
  if (!workspace) throw new MemberError(404, "That company no longer exists.");

  const existing = database.memberships.find(
    (entry) => entry.workspaceId === invitation.workspaceId && entry.userId === user.id,
  );
  if (existing) {
    // Already in: close the invitation rather than leaving it open, but never change a role that
    // someone already holds — an old invitation must not be able to demote or promote them.
    invitation.acceptedAt = now;
    invitation.acceptedByUserId = user.id;
    return { workspace, membership: existing, alreadyMember: true };
  }

  const membership = {
    id: createId("mem"),
    userId: user.id,
    workspaceId: invitation.workspaceId,
    role: invitation.role,
    createdAt: now,
    invitedByUserId: invitation.invitedByUserId,
    invitedByName: invitation.invitedByName,
  };
  database.memberships.push(membership);
  invitation.acceptedAt = now;
  invitation.acceptedByUserId = user.id;
  recordAccessChange(database, invitation.workspaceId, {
    type: "member-joined",
    title: `${user.name} joined as ${invitation.role}`,
    detail: `Invited by ${invitation.invitedByName}.`,
    actor: user.name,
    now,
  });
  return { workspace, membership, alreadyMember: false };
}

export function changeMemberRole(database, { workspaceId, membershipId, role, actor, now = new Date().toISOString() }) {
  if (!isRole(role)) throw new MemberError(400, "Choose one of viewer, reviewer, editor, or owner.");
  const membership = database.memberships.find((entry) => entry.id === membershipId && entry.workspaceId === workspaceId);
  if (!membership) throw new MemberError(404, "That person is not part of this company.");
  if (membership.role === role) return listMembers(database, workspaceId).find((entry) => entry.id === membershipId);

  // A company without an owner cannot answer its own approvals or invite anyone back in. The last
  // owner must hand the role over before stepping down — promote first, then demote.
  if (membership.role === "owner" && ownerCount(database, workspaceId) <= 1) {
    throw new MemberError(409, "This is the company's only owner. Make someone else an owner first.");
  }

  const previous = membership.role;
  membership.role = role;
  const user = database.users.find((entry) => entry.id === membership.userId);
  recordAccessChange(database, workspaceId, {
    type: "member-role-changed",
    title: `${user?.name ?? "A member"} is now ${role}`,
    detail: `Changed from ${previous}.`,
    actor: actor.name,
    now,
  });
  return listMembers(database, workspaceId).find((entry) => entry.id === membershipId);
}

export function removeMember(database, { workspaceId, membershipId, actor, now = new Date().toISOString() }) {
  const membership = database.memberships.find((entry) => entry.id === membershipId && entry.workspaceId === workspaceId);
  if (!membership) throw new MemberError(404, "That person is not part of this company.");
  const leaving = membership.userId === actor.id;
  if (membership.role === "owner" && ownerCount(database, workspaceId) <= 1) {
    // Only the sole owner can ever reach this, and only by trying to leave — but say which act
    // was refused rather than describing one they did not take.
    throw new MemberError(
      409,
      leaving
        ? "You are this company's only owner. Make someone else an owner before you leave."
        : "This is the company's only owner. Make someone else an owner before removing them.",
    );
  }

  const user = database.users.find((entry) => entry.id === membership.userId);
  database.memberships = database.memberships.filter((entry) => entry.id !== membershipId);
  recordAccessChange(database, workspaceId, {
    type: leaving ? "member-left" : "member-removed",
    title: leaving ? `${actor.name} left the company` : `${user?.name ?? "A member"} was removed`,
    detail: leaving ? "They no longer have access." : `Removed by ${actor.name}.`,
    actor: actor.name,
    now,
  });
  return { removed: true, leaving };
}

/**
 * Access changes go in the same activity feed as the work, because who can see a company is part
 * of that company's history — not a separate log a founder has to know to look for.
 */
function recordAccessChange(database, workspaceId, { type, title, detail, actor, now }) {
  database.activity.push({ id: createId("act"), workspaceId, type, title, detail, actor, createdAt: now });
}
