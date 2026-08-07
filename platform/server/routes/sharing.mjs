import {
  createShare,
  findLiveShare,
  founderShare,
  listShares,
  recordShareView,
  revokeShare,
  sharedView,
} from "../domain/sharing.mjs";
import { HttpError, json } from "../http.mjs";
import { readJsonBody } from "../validation.mjs";
import { clientAddressKey, requireWorkspace } from "./shared.mjs";

/**
 * Read-only links, and the one route that serves them.
 *
 * `GET /api/shared/:token` is the only route in the product that answers without a session. It is
 * handled with the public routes, before authentication, because the person reading it does not
 * have an account and is not supposed to need one.
 */

const SHARE_FIELDS = new Set(["scope", "artifactId"]);

export async function handleShareRoutes({ request, response, method, pathname, store, user }) {
  const collectionMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/shares$/);
  if (collectionMatch) {
    const workspaceId = decodeURIComponent(collectionMatch[1]);

    if (method === "GET") {
      const database = await store.read();
      // Every member can see what has been shared outside the company. Knowing the work is
      // circulating is not a privilege; deciding that it should is.
      requireWorkspace(database, workspaceId, user.id, "workspace-read");
      json(response, 200, { shares: listShares(database, workspaceId) });
      return;
    }

    if (method === "POST") {
      const body = await readJsonBody(request);
      for (const key of Object.keys(body)) {
        if (!SHARE_FIELDS.has(key)) throw new HttpError(400, "Only scope and artifactId may be provided with a link.");
      }
      const created = await store.transaction((database) => {
        requireWorkspace(database, workspaceId, user.id, "share-manage");
        return createShare(database, {
          workspaceId,
          scope: body.scope ?? "deliverable",
          artifactId: body.artifactId,
          createdBy: user,
        });
      });
      // The only time the raw token exists outside a hash.
      json(response, 201, {
        share: founderShare(created.share),
        viewPath: `/shared/${created.token}`,
        delivery: "Anyone with this link can read it — no account, no sign-in. Send it only to people who should have it.",
      });
      return;
    }

    throw new HttpError(405, "Method not allowed.");
  }

  const shareMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/shares\/([^/]+)$/);
  if (shareMatch) {
    if (method !== "DELETE") throw new HttpError(405, "Method not allowed.");
    const workspaceId = decodeURIComponent(shareMatch[1]);
    const shareId = decodeURIComponent(shareMatch[2]);
    const revoked = await store.transaction((database) => {
      requireWorkspace(database, workspaceId, user.id, "share-manage");
      return revokeShare(database, { workspaceId, shareId, actor: user });
    });
    json(response, 200, revoked);
    return;
  }
}

/**
 * The public read. Handled before authentication, and deliberately narrow: it takes a token,
 * returns a projection, and does nothing else. A wrong token is answered exactly as an expired or
 * stopped one is.
 */
export async function handleSharedRead({ request, response, method, pathname, store, authLimiters }) {
  const match = pathname.match(/^\/api\/shared\/([^/]+)$/);
  if (!match) return;
  if (method !== "GET") throw new HttpError(405, "Method not allowed.");

  // The token is 32 random bytes, so this bucket is flood control rather than the thing standing
  // between a stranger and the work. That makes the ordering matter more than the ceiling: the
  // token is looked up first, and only a miss spends an attempt. A correct link is never refused
  // because somebody else on the same connection guessed wrong ones.
  const key = clientAddressKey(request);
  const token = decodeURIComponent(match[1]);
  const database = await store.read();
  const share = findLiveShare(database, token);
  const view = share ? sharedView(database, share) : null;
  if (!view) {
    authLimiters.invitation.claim(key);
    throw new HttpError(404, "This link is not available. It may have been stopped, or it may have expired.");
  }

  // A shared page is not the founder's product surface: keep it out of search results and out of
  // any cache that might hand it to the next person on the same connection.
  response.setHeader("x-robots-tag", "noindex, nofollow, noarchive");
  response.setHeader("cache-control", "no-store");
  json(response, 200, view);

  // Counted after the answer: a founder should see that their link was read, and a failure to
  // record it must never cost the reader their page.
  await store.transaction((live) => recordShareView(live, share.id)).catch(() => undefined);
}
