import { ROLES, isRole } from "../domain/capabilities.mjs";
import {
  acceptInvitation,
  changeMemberRole,
  createInvitation,
  findLiveInvitation,
  founderInvitation,
  listMembers,
  listPendingInvitations,
  removeMember,
  revokeInvitation,
} from "../domain/members.mjs";
import { HttpError, json } from "../http.mjs";
import { optionalText, readJsonBody } from "../validation.mjs";
import { clientAddressKey, requireWorkspace } from "./shared.mjs";

/**
 * Who is in a company, and how someone joins one.
 *
 * Listing members is open to every member — people who share a company can see who else is in it.
 * Everything that *changes* access is the owner's, and the invitation flow is deliberately not
 * workspace-scoped: the person accepting is not a member yet, so the invitation token is the
 * authorization, checked against the signed-in account's own email address.
 */

const INVITE_FIELDS = new Set(["email", "role"]);
const ROLE_FIELDS = new Set(["role"]);

function normalizeInviteEmail(value) {
  const email = optionalText(value ?? "", "Email address", 254, { allowEmpty: false }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  return email;
}

function requireOnly(body, fields, label) {
  for (const key of Object.keys(body)) {
    if (!fields.has(key)) throw new HttpError(400, `Only ${[...fields].join(" and ")} may be provided with ${label}.`);
  }
}

export async function handleMemberRoutes({ request, response, method, pathname, store, user, authLimiters }) {
  const membersMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/members$/);
  if (membersMatch) {
    if (method !== "GET") throw new HttpError(405, "Method not allowed.");
    const workspaceId = decodeURIComponent(membersMatch[1]);
    const database = await store.read();
    requireWorkspace(database, workspaceId, user.id, "workspace-read");
    const membership = database.memberships.find((entry) => entry.workspaceId === workspaceId && entry.userId === user.id);
    const canManage = membership?.role === "owner";
    json(response, 200, {
      members: listMembers(database, workspaceId),
      // An open invitation names someone who is not in the company yet. That is the owner's
      // business to see; a viewer learning who is being courted is a disclosure with no upside.
      invitations: canManage ? listPendingInvitations(database, workspaceId) : [],
      roles: ROLES,
      canManage,
    });
    return;
  }

  const memberMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/members\/([^/]+)$/);
  if (memberMatch) {
    const workspaceId = decodeURIComponent(memberMatch[1]);
    const membershipId = decodeURIComponent(memberMatch[2]);

    if (method === "PATCH") {
      const body = await readJsonBody(request);
      requireOnly(body, ROLE_FIELDS, "a role change");
      if (!isRole(body.role)) throw new HttpError(400, `Choose one of ${ROLES.join(", ")}.`);
      const updated = await store.transaction((database) => {
        requireWorkspace(database, workspaceId, user.id, "member-manage");
        return changeMemberRole(database, { workspaceId, membershipId, role: body.role, actor: user });
      });
      json(response, 200, updated);
      return;
    }

    if (method === "DELETE") {
      const result = await store.transaction((database) => {
        // Leaving a company is not an act of administration — anyone may show themselves out, and
        // being removed by someone else is the owner's call.
        const target = database.memberships.find((entry) => entry.id === membershipId && entry.workspaceId === workspaceId);
        const leaving = target?.userId === user.id;
        requireWorkspace(database, workspaceId, user.id, leaving ? "workspace-read" : "member-manage");
        return removeMember(database, { workspaceId, membershipId, actor: user });
      });
      json(response, 200, result);
      return;
    }

    throw new HttpError(405, "Method not allowed.");
  }

  const invitationsMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/invitations$/);
  if (invitationsMatch) {
    if (method !== "POST") throw new HttpError(405, "Method not allowed.");
    const workspaceId = decodeURIComponent(invitationsMatch[1]);
    const body = await readJsonBody(request);
    requireOnly(body, INVITE_FIELDS, "an invitation");
    const email = normalizeInviteEmail(body.email);
    const role = body.role ?? "editor";
    if (!isRole(role)) throw new HttpError(400, `Choose one of ${ROLES.join(", ")}.`);

    const created = await store.transaction((database) => {
      requireWorkspace(database, workspaceId, user.id, "member-manage");
      return createInvitation(database, { workspaceId, email, role, invitedBy: user });
    });

    // The only time the raw token exists outside a hash. Formation has no mail transport yet, so
    // the founder carries the link themselves — said plainly rather than dressed up as "sent".
    json(response, 201, {
      invitation: founderInvitation(created.invitation),
      acceptPath: `/join/${created.token}`,
      delivery: "Formation cannot send email yet. Copy this link and send it to them yourself — it only works for their email address.",
    });
    return;
  }

  const invitationMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/invitations\/([^/]+)$/);
  if (invitationMatch) {
    if (method !== "DELETE") throw new HttpError(405, "Method not allowed.");
    const workspaceId = decodeURIComponent(invitationMatch[1]);
    const invitationId = decodeURIComponent(invitationMatch[2]);
    const revoked = await store.transaction((database) => {
      requireWorkspace(database, workspaceId, user.id, "member-manage");
      return revokeInvitation(database, { workspaceId, invitationId, actor: user });
    });
    json(response, 200, revoked);
    return;
  }

  if (pathname === "/api/invitations/preview") {
    if (method !== "POST") throw new HttpError(405, "Method not allowed.");
    const body = await readJsonBody(request);
    // Its own bucket, keyed on the device: a token is not an account, and someone guessing links
    // must not be able to lock a colleague out of a real invitation — or be told their sign-ins
    // are the problem.
    const key = clientAddressKey(request);
    const database = await store.read();
    const invitation = findLiveInvitation(database, body.token);
    if (!invitation) {
      // Only a miss spends an attempt: a real invitation must not depend on nobody else on the
      // same connection having guessed.
      authLimiters.invitation.claim(key);
      throw new HttpError(404, "That invitation link is not valid. It may have been used, cancelled, or expired.");
    }
    const workspace = database.workspaces.find((entry) => entry.id === invitation.workspaceId);
    json(response, 200, {
      company: workspace?.name ?? "A company on Formation",
      role: invitation.role,
      invitedBy: invitation.invitedByName,
      email: invitation.email,
      matchesYou: invitation.email === user.email,
      expiresAt: invitation.expiresAt,
    });
    return;
  }

  if (pathname === "/api/invitations/accept") {
    if (method !== "POST") throw new HttpError(405, "Method not allowed.");
    const body = await readJsonBody(request);
    const key = clientAddressKey(request);
    try {
      const joined = await store.transaction((database) => acceptInvitation(database, { token: body.token, user }));
      json(response, joined.alreadyMember ? 200 : 201, {
        workspaceId: joined.workspace.id,
        company: joined.workspace.name,
        role: joined.membership.role,
        alreadyMember: joined.alreadyMember,
      });
    } catch (error) {
      authLimiters.invitation.claim(key);
      throw error;
    }
    return;
  }
}
