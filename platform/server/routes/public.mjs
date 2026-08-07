import {
  authenticatePassword,
  createDemoSession,
  destroySession,
  expiredSessionCookie,
  registerAccount,
  sessionCookie,
} from "../auth.mjs";
import { findLiveInvitation } from "../domain/members.mjs";
import { HttpError, json } from "../http.mjs";
import { readJsonBody } from "../validation.mjs";
import { authAttemptKeys, claimAuthAttempt, settleAuthSuccess } from "./shared.mjs";

export async function handlePublicRoutes({ request, response, method, pathname, store, allowDemoAuth, allowRegistration, authLimiters }) {
  if (method === "GET" && pathname === "/api/health") {
    json(response, 200, { ok: true, service: "formation", time: new Date().toISOString() });
    return;
  }

  if (method === "GET" && pathname === "/api/config") {
    json(response, 200, {
      product: "Formation",
      demoAuthEnabled: Boolean(allowDemoAuth || process.env.ALLOW_DEMO_AUTH === "true"),
      registrationEnabled: Boolean(allowRegistration),
    });
    return;
  }

  if (method === "POST" && pathname === "/api/auth/register") {
    const body = await readJsonBody(request);
    const keys = authAttemptKeys(request, body.email);
    claimAuthAttempt(authLimiters, keys);
    // A closed instance still has to let in the people it invited. An invitation naming this exact
    // email address is a decision an owner already made, so it opens the door for that address
    // alone — which is what makes closing open registration a usable setting rather than one that
    // quietly breaks the invite flow.
    if (!allowRegistration) {
      const invited = await invitationAllowsRegistration(store, body);
      if (!invited) throw new HttpError(404, "Registration is disabled.");
    }
    try {
      const session = await registerAccount(store, body, request);
      settleAuthSuccess(authLimiters, keys);
      response.setHeader("set-cookie", sessionCookie(session.token, request, session.expiresAt));
      json(response, 201, { user: session.user, expiresAt: session.expiresAt });
    } catch (error) {
      // The attempt was spent on the way in; there is nothing to record here.
      throw error;
    }
    return;
  }

  if (method === "POST" && pathname === "/api/auth/login") {
    const body = await readJsonBody(request);
    const keys = authAttemptKeys(request, body.email);
    claimAuthAttempt(authLimiters, keys);
    try {
      const session = await authenticatePassword(store, body, request);
      settleAuthSuccess(authLimiters, keys);
      response.setHeader("set-cookie", sessionCookie(session.token, request, session.expiresAt));
      json(response, 200, { user: session.user, expiresAt: session.expiresAt });
    } catch (error) {
      throw error;
    }
    return;
  }

  if (method === "POST" && pathname === "/api/auth/demo") {
    if (!allowDemoAuth && process.env.ALLOW_DEMO_AUTH !== "true") {
      throw new HttpError(404, "Demo authentication is disabled.");
    }
    const body = await readJsonBody(request);
    const session = await createDemoSession(store, body.email ?? "founder@formation.local", request);
    response.setHeader("set-cookie", sessionCookie(session.token, request, session.expiresAt));
    json(response, 200, { user: session.user, expiresAt: session.expiresAt });
    return;
  }

  if (method === "POST" && pathname === "/api/auth/logout") {
    await destroySession(store, request);
    response.setHeader("set-cookie", expiredSessionCookie(request));
    json(response, 200, { ok: true });
    return;
  }

}

/**
 * Does an open invitation name this exact email address? Compared against the same normalization
 * the account itself will use, so "Sam@Example.com " and "sam@example.com" are one person.
 */
async function invitationAllowsRegistration(store, body) {
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) return false;
  const database = await store.read();
  const invitation = findLiveInvitation(database, body.invitationToken);
  return Boolean(invitation && invitation.email === email);
}
