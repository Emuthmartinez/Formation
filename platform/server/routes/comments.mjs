import { CommentError, COMMENT_LIMITS, COMMENT_TARGETS, createComment, deleteComment, editComment, setCommentResolved } from "../domain/comments.mjs";
import { HttpError, json } from "../http.mjs";
import { TEXT_LIMITS, readJsonBody, requireText } from "../validation.mjs";
import { requireWorkspace, touchWorkspace } from "./shared.mjs";

/**
 * Conversation about the record.
 *
 * Threads travel in the workspace snapshot with every other record, so there is no read route here
 * — one fewer surface, and one fewer place for the two to disagree about what a thread is. What is
 * left is writing: adding to a conversation sits behind `comment-write`, which a reviewer holds,
 * because an advisor brought in to question the record has to be able to say so and that is the
 * whole reason the reviewer role exists.
 *
 * Editing and deleting are narrower than the capability, and deliberately so — the domain refuses
 * to let anyone touch words they did not write, at any role. An owner who can rewrite what an
 * advisor said is an owner who can rewrite the history of a decision.
 */

const CREATE_FIELDS = new Set(["target", "body", "parentId"]);
const PATCH_FIELDS = new Set(["body", "resolved"]);

function speakHttp(error) {
  if (error instanceof CommentError) throw new HttpError(error.status, error.message);
  throw error;
}

function normalizeTarget(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Say what this comment is about.");
  if (!COMMENT_TARGETS.includes(value.kind)) throw new HttpError(400, "That is not something Formation keeps conversation against.");
  const id = requireText(value.id, "Comment target", TEXT_LIMITS.key);
  const sectionId = value.sectionId === undefined || value.sectionId === null ? null : requireText(value.sectionId, "Comment section", TEXT_LIMITS.key);
  return { kind: value.kind, id, sectionId };
}

export async function handleCommentRoutes({ request, response, method, pathname, store, user }) {
  const collectionMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/comments$/);
  if (collectionMatch) {
    const workspaceId = decodeURIComponent(collectionMatch[1]);

    if (method === "POST") {
      const body = await readJsonBody(request);
      for (const key of Object.keys(body)) {
        if (!CREATE_FIELDS.has(key)) throw new HttpError(400, "Only target, body, and parentId may be provided with a comment.");
      }
      const target = normalizeTarget(body.target);
      const text = requireText(body.body, "Comment", COMMENT_LIMITS.body);
      const parentId = body.parentId === undefined || body.parentId === null ? null : requireText(body.parentId, "Reply target", TEXT_LIMITS.key);

      const comment = await store.transaction((database) => {
        const workspace = requireWorkspace(database, workspaceId, user.id, "comment-write");
        try {
          const created = createComment(database, workspace, { target, body: text, parentId, author: user }, new Date().toISOString());
          // Comments do not change the record, so this is deliberately not a record-change entry:
          // it says a conversation happened, which is what it is.
          touchWorkspace(database, workspace, user.name, parentId ? "Replied in a conversation" : "Started a conversation", text.slice(0, 200));
          return created;
        } catch (error) {
          speakHttp(error);
        }
      });
      json(response, 201, comment);
      return;
    }

    throw new HttpError(405, "Method not allowed.");
  }

  const detailMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/comments\/([^/]+)$/);
  if (detailMatch) {
    const workspaceId = decodeURIComponent(detailMatch[1]);
    const commentId = decodeURIComponent(detailMatch[2]);

    if (method === "PATCH") {
      const body = await readJsonBody(request);
      for (const key of Object.keys(body)) {
        if (!PATCH_FIELDS.has(key)) throw new HttpError(400, "Only body and resolved may be changed on a comment.");
      }
      if (body.body === undefined && body.resolved === undefined) throw new HttpError(400, "No supported comment changes were provided.");
      if (body.resolved !== undefined && typeof body.resolved !== "boolean") throw new HttpError(400, "Resolved must be true or false.");
      const text = body.body === undefined ? undefined : requireText(body.body, "Comment", COMMENT_LIMITS.body);

      const comment = await store.transaction((database) => {
        const workspace = requireWorkspace(database, workspaceId, user.id, "comment-write");
        const now = new Date().toISOString();
        try {
          let updated;
          if (text !== undefined) updated = editComment(database, workspace, commentId, { body: text, author: user }, now);
          if (body.resolved !== undefined) updated = setCommentResolved(database, workspace, commentId, { resolved: body.resolved, actor: user }, now);
          return updated;
        } catch (error) {
          speakHttp(error);
        }
      });
      json(response, 200, comment);
      return;
    }

    if (method === "DELETE") {
      const result = await store.transaction((database) => {
        const workspace = requireWorkspace(database, workspaceId, user.id, "comment-write");
        try {
          return deleteComment(database, workspace, commentId, { author: user }, new Date().toISOString());
        } catch (error) {
          speakHttp(error);
        }
      });
      json(response, 200, { removed: result.removed });
      return;
    }

    throw new HttpError(405, "Method not allowed.");
  }
}
