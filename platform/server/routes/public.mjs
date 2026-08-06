import {
  authenticatePassword,
  createDemoSession,
  destroySession,
  expiredSessionCookie,
  registerAccount,
  sessionCookie,
} from "../auth.mjs";
import { HttpError, json } from "../http.mjs";
import { readJsonBody } from "../validation.mjs";
import { authAttemptKeys, assertAuthAllowed, recordAuthFailure } from "./shared.mjs";

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
    if (!allowRegistration) throw new HttpError(404, "Registration is disabled.");
    const body = await readJsonBody(request);
    const keys = authAttemptKeys(request, body.email);
    assertAuthAllowed(authLimiters, keys);
    try {
      const session = await registerAccount(store, body);
      authLimiters.account.clear(keys.account);
      response.setHeader("set-cookie", sessionCookie(session.token, request, session.expiresAt));
      json(response, 201, { user: session.user, expiresAt: session.expiresAt });
    } catch (error) {
      recordAuthFailure(authLimiters, keys);
      throw error;
    }
    return;
  }

  if (method === "POST" && pathname === "/api/auth/login") {
    const body = await readJsonBody(request);
    const keys = authAttemptKeys(request, body.email);
    assertAuthAllowed(authLimiters, keys);
    try {
      const session = await authenticatePassword(store, body);
      authLimiters.account.clear(keys.account);
      response.setHeader("set-cookie", sessionCookie(session.token, request, session.expiresAt));
      json(response, 200, { user: session.user, expiresAt: session.expiresAt });
    } catch (error) {
      recordAuthFailure(authLimiters, keys);
      throw error;
    }
    return;
  }

  if (method === "POST" && pathname === "/api/auth/demo") {
    if (!allowDemoAuth && process.env.ALLOW_DEMO_AUTH !== "true") {
      throw new HttpError(404, "Demo authentication is disabled.");
    }
    const body = await readJsonBody(request);
    const session = await createDemoSession(store, body.email ?? "founder@formation.local");
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
