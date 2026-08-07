import { changePassword, expiredSessionCookie, listSessions, revokeOtherSessions, revokeSession } from "../auth.mjs";
import { HttpError, json } from "../http.mjs";
import { readJsonBody } from "../validation.mjs";
import { clientAddressKey } from "./shared.mjs";
import { currentSessionKey } from "../auth.mjs";

/**
 * The account's own security surface.
 *
 * Nothing here is workspace-scoped, and nothing here takes an identifier that could point at
 * another person's account: every route acts on the signed-in user, resolved from the session
 * cookie by the time it gets here.
 */

const PASSWORD_FIELDS = new Set(["currentPassword", "newPassword"]);

export async function handleAccountRoutes({ request, response, method, pathname, store, user, authLimiters }) {
  if (pathname === "/api/account/sessions") {
    if (method === "GET") {
      json(response, 200, { sessions: await listSessions(store, request, user.id) });
      return;
    }
    if (method === "DELETE") {
      const result = await revokeOtherSessions(store, request, user.id);
      json(response, 200, result);
      return;
    }
    throw new HttpError(405, "Method not allowed.");
  }

  const sessionMatch = pathname.match(/^\/api\/account\/sessions\/([^/]+)$/);
  if (sessionMatch) {
    if (method !== "DELETE") throw new HttpError(405, "Method not allowed.");
    const result = await revokeSession(store, request, user.id, decodeURIComponent(sessionMatch[1]));
    // Signing out the device you are holding is allowed; the cookie goes with it so the page does
    // not sit there looking signed in against a session that no longer exists.
    if (result.endedCurrentSession) response.setHeader("set-cookie", expiredSessionCookie(request));
    json(response, 200, result);
    return;
  }

  if (pathname === "/api/account/password") {
    if (method !== "POST") throw new HttpError(405, "Method not allowed.");
    const body = await readJsonBody(request);
    for (const key of Object.keys(body)) {
      if (!PASSWORD_FIELDS.has(key)) throw new HttpError(400, "Only currentPassword and newPassword may be provided.");
    }
    // Guessing the current password from an already-signed-in session is still guessing, and is
    // limited the same way signing in is — spent on the way in, so a wave of concurrent guesses
    // cannot all pass the check before any of them is counted.
    //
    // Keyed on the session rather than the account: changing the password is exactly how an owner
    // evicts a session that should not be there, so a hostile session must not be able to spend
    // the owner's attempts and hold that door shut.
    const keys = { address: clientAddressKey(request), account: `password:${currentSessionKey(request) ?? user.id}` };
    authLimiters.address.claim(keys.address);
    try {
      authLimiters.account.claim(keys.account);
    } catch (error) {
      authLimiters.address.release(keys.address);
      throw error;
    }
    const result = await changePassword(store, request, user.id, body);
    authLimiters.address.release(keys.address);
    authLimiters.account.clear(keys.account);
    json(response, 200, result);
    return;
  }
}
