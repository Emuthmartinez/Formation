import { createId } from "./shared.mjs";

/**
 * Asking a specific person to look at a specific thing, and recording what they said.
 *
 * A comment is a conversation anyone may join. A review request is narrower and more useful: it
 * names one person, one record, and one question — "does this hold?" — and it stays visible until
 * that person answers. That is the difference between a workspace people can talk in and a
 * workspace work actually moves through.
 *
 * **A review is an opinion, not an authority.** Approving a review changes nothing about the record
 * it is about: a reviewer's yes does not promote a deliverable to approved, does not decide a
 * decision, and does not move readiness. If it did, reviews would be a back door around the
 * capability ladder — a reviewer who cannot edit a deliverable could nonetheless settle one by
 * approving a review of it. The answer is recorded, the person who can act on it acts on it, and
 * the two remain separate acts by separate people. This is the same rule comments hold, for the
 * same reason.
 *
 * Two identity rules the capability ladder cannot express, so they live here:
 *
 * - only the person a review was assigned to may answer it. An owner answering on a reviewer's
 *   behalf would put words in their mouth, and the whole value of the record is whose opinion it is;
 * - only the person who asked may withdraw the request. Withdrawing someone else's ask is deciding
 *   for them that their question did not need an answer.
 */

export const REVIEW_STATUSES = Object.freeze(["requested", "approved", "changes-requested", "withdrawn"]);
export const REVIEW_TARGETS = Object.freeze(["claim", "decision", "deliverable", "workstream"]);

export const REVIEW_LIMITS = Object.freeze({
  note: 2_000,
  perWorkspace: 1_000,
});

export class ReviewError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ReviewError";
    this.status = status;
  }
}

const TARGET_COLLECTION = Object.freeze({ claim: "claims", decision: "decisions", deliverable: "artifacts" });

/** The same existence rule comments hold: you cannot ask about something that is not here. */
export function reviewTargetExists(database, workspace, target) {
  if (!target || !REVIEW_TARGETS.includes(target.kind)) return false;
  if (target.kind === "workstream") return (workspace.workstreams ?? []).some((entry) => entry.id === target.id);
  const record = (database[TARGET_COLLECTION[target.kind]] ?? []).find((entry) => entry.id === target.id && entry.workspaceId === workspace.id);
  if (!record) return false;
  if (target.kind === "deliverable" && target.sectionId) return (record.sections ?? []).some((section) => section.id === target.sectionId);
  return !target.sectionId;
}

function memberOf(database, workspaceId, userId) {
  const membership = database.memberships.find((entry) => entry.workspaceId === workspaceId && entry.userId === userId);
  if (!membership) return null;
  const user = database.users.find((entry) => entry.id === userId);
  return { userId, name: user?.name ?? "Someone", role: membership.role };
}

export function requestReview(database, workspace, { target, assigneeId, note, dueAt, requester }, now) {
  if (!reviewTargetExists(database, workspace, target)) {
    throw new ReviewError(404, "There is nothing here to ask about.");
  }
  const assignee = memberOf(database, workspace.id, assigneeId);
  if (!assignee) throw new ReviewError(404, "That person is not in this company.");
  if (assignee.userId === requester.id) throw new ReviewError(400, "Asking yourself for a review records nothing anyone else can act on.");

  const reviews = database.reviews.filter((entry) => entry.workspaceId === workspace.id);
  if (reviews.length >= REVIEW_LIMITS.perWorkspace) {
    throw new ReviewError(429, "This company has as many review requests as Formation will keep. Close some before asking again.");
  }
  const alreadyOpen = reviews.some(
    (entry) =>
      entry.status === "requested" &&
      entry.assigneeId === assignee.userId &&
      entry.target.kind === target.kind &&
      entry.target.id === target.id &&
      (entry.target.sectionId ?? null) === (target.sectionId ?? null),
  );
  if (alreadyOpen) throw new ReviewError(409, "You have already asked this person to look at this, and they have not answered yet.");

  const review = {
    id: createId("rvw"),
    workspaceId: workspace.id,
    target: { kind: target.kind, id: target.id, sectionId: target.kind === "deliverable" && target.sectionId ? target.sectionId : null },
    requestedBy: requester.id,
    requestedByName: requester.name,
    assigneeId: assignee.userId,
    assigneeName: assignee.name,
    note: note ?? "",
    dueAt: dueAt ?? null,
    status: "requested",
    answeredAt: null,
    answerNote: null,
    createdAt: now,
    updatedAt: now,
  };
  database.reviews.push(review);
  return review;
}

/**
 * The assignee's answer. Recorded as theirs and only theirs — see the module note on why an owner
 * answering on someone else's behalf is refused rather than allowed as an administrative shortcut.
 */
export function answerReview(database, workspace, reviewId, { answer, note, responder }, now) {
  const review = findReview(database, workspace, reviewId);
  if (review.assigneeId !== responder.id) throw new ReviewError(403, "Only the person this was asked of can answer it.");
  if (review.status !== "requested") throw new ReviewError(409, "This request has already been answered or withdrawn.");
  if (!["approved", "changes-requested"].includes(answer)) throw new ReviewError(400, "A review is answered with approval or a request for changes.");

  review.status = answer;
  review.answerNote = note ?? "";
  review.answeredAt = now;
  review.updatedAt = now;
  return review;
}

/** Taking back the ask. Only the person who made it — see the module note. */
export function withdrawReview(database, workspace, reviewId, { requester }, now) {
  const review = findReview(database, workspace, reviewId);
  if (review.requestedBy !== requester.id) throw new ReviewError(403, "Only the person who asked can withdraw the request.");
  if (review.status !== "requested") throw new ReviewError(409, "This request has already been answered.");
  review.status = "withdrawn";
  review.updatedAt = now;
  return review;
}

function findReview(database, workspace, reviewId) {
  const review = database.reviews.find((entry) => entry.id === reviewId && entry.workspaceId === workspace.id);
  if (!review) throw new ReviewError(404, "That review request is no longer here.");
  return review;
}

/**
 * The workspace's review requests, open ones first and oldest open first inside that — the one
 * somebody has been waiting longest for is the one to answer next.
 */
export function reviewList(database, workspaceId) {
  return database.reviews
    .filter((entry) => entry.workspaceId === workspaceId)
    .map((entry) => ({
      id: entry.id,
      target: { ...entry.target },
      requestedBy: entry.requestedBy,
      requestedByName: entry.requestedByName,
      assigneeId: entry.assigneeId,
      assigneeName: entry.assigneeName,
      note: entry.note,
      dueAt: entry.dueAt,
      status: entry.status,
      answerNote: entry.answerNote,
      answeredAt: entry.answeredAt,
      createdAt: entry.createdAt,
    }))
    .sort((a, b) => {
      const open = (entry) => (entry.status === "requested" ? 0 : 1);
      if (open(a) !== open(b)) return open(a) - open(b);
      return open(a) === 0 ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt);
    });
}
