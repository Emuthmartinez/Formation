import { REVIEW_LIMITS, REVIEW_TARGETS, ReviewError, answerReview, requestReview, withdrawReview } from "../domain/reviews.mjs";
import { HttpError, json } from "../http.mjs";
import { TEXT_LIMITS, optionalText, readJsonBody, requireText, validDateOrNull } from "../validation.mjs";
import { requireWorkspace } from "./shared.mjs";

/**
 * Asking someone to look at something, and recording what they said.
 *
 * Requests travel in the workspace snapshot with every other record, so there is no read route.
 * Asking sits behind `comment-write`: it is a coordinating act that creates no authority, and a
 * reviewer who can question the record can equally ask someone else to.
 *
 * Answering and withdrawing are narrower than the capability, and the domain enforces that: only
 * the person a review was asked of may answer it, and only the person who asked may take it back.
 * Neither is something a role can override — an owner answering on a reviewer's behalf would put
 * words in their mouth, and whose opinion it is happens to be the entire value of the record.
 */

const REQUEST_FIELDS = new Set(["target", "assigneeId", "note", "dueAt"]);
const ANSWER_FIELDS = new Set(["answer", "note", "withdrawn"]);

function speakHttp(error) {
  if (error instanceof ReviewError) throw new HttpError(error.status, error.message);
  throw error;
}

function normalizeTarget(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Say what the review is about.");
  if (!REVIEW_TARGETS.includes(value.kind)) throw new HttpError(400, "That is not something Formation asks for review on.");
  return {
    kind: value.kind,
    id: requireText(value.id, "Review target", TEXT_LIMITS.key),
    sectionId: value.sectionId === undefined || value.sectionId === null ? null : requireText(value.sectionId, "Review section", TEXT_LIMITS.key),
  };
}

export async function handleReviewRoutes({ request, response, method, pathname, store, user }) {
  const collectionMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/reviews$/);
  if (collectionMatch) {
    if (method !== "POST") throw new HttpError(405, "Method not allowed.");
    const workspaceId = decodeURIComponent(collectionMatch[1]);
    const body = await readJsonBody(request);
    for (const key of Object.keys(body)) {
      if (!REQUEST_FIELDS.has(key)) throw new HttpError(400, "Only target, assigneeId, note, and dueAt may be provided with a review request.");
    }
    const target = normalizeTarget(body.target);
    const assigneeId = requireText(body.assigneeId, "Who to ask", TEXT_LIMITS.key);
    const note = body.note === undefined ? "" : optionalText(body.note, "Review note", REVIEW_LIMITS.note, { allowEmpty: true });
    const dueAt = body.dueAt === undefined ? null : validDateOrNull(body.dueAt);

    const review = await store.transaction((database) => {
      const workspace = requireWorkspace(database, workspaceId, user.id, "comment-write");
      try {
        return requestReview(database, workspace, { target, assigneeId, note, dueAt, requester: user }, new Date().toISOString());
      } catch (error) {
        speakHttp(error);
      }
    });
    json(response, 201, review);
    return;
  }

  const detailMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/reviews\/([^/]+)$/);
  if (detailMatch) {
    if (method !== "POST") throw new HttpError(405, "Method not allowed.");
    const workspaceId = decodeURIComponent(detailMatch[1]);
    const reviewId = decodeURIComponent(detailMatch[2]);
    const body = await readJsonBody(request);
    for (const key of Object.keys(body)) {
      if (!ANSWER_FIELDS.has(key)) throw new HttpError(400, "Only answer, note, and withdrawn may be provided.");
    }
    const note = body.note === undefined ? "" : optionalText(body.note, "Review note", REVIEW_LIMITS.note, { allowEmpty: true });

    const review = await store.transaction((database) => {
      const workspace = requireWorkspace(database, workspaceId, user.id, "comment-write");
      const now = new Date().toISOString();
      try {
        if (body.withdrawn === true) return withdrawReview(database, workspace, reviewId, { requester: user }, now);
        return answerReview(database, workspace, reviewId, { answer: body.answer, note, responder: user }, now);
      } catch (error) {
        speakHttp(error);
      }
    });
    json(response, 200, review);
    return;
  }
}
