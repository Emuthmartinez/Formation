import { createId } from "./shared.mjs";

/**
 * Conversation about the record, kept strictly separate from the record.
 *
 * The rule this module exists to hold is the one the gaps document states and that every product
 * with comments eventually breaks: **a comment is never a source of truth.** The moment a company's
 * actual answer lives in a thread — "we decided in the comments to go monthly" — the record stops
 * being the record, and everything Formation does downstream of it (readiness, contradictions,
 * what is sent to a provider, what a shared link shows) is reading the wrong document.
 *
 * So comments are load-bearing for people and inert for the system. They do not affect readiness.
 * They are not screened, weighed, or sent as generation context. They never reach a shared link.
 * Nothing computes off them. When a comment settles something, the settlement belongs in the claim,
 * the decision, or the deliverable, and the thread is where the argument for it is kept.
 *
 * Two consequences worth naming:
 *
 * - **A comment is attributed and it stays attributed.** Editing your own words is fine; the record
 *   keeps that it was edited and when, because a thread whose history can be rewritten is not a
 *   record of a conversation.
 * - **Resolving is not deleting.** A resolved thread stays readable, with who resolved it and when,
 *   because "we talked about this and settled it" is exactly the thing a founder needs six weeks
 *   later and exactly the thing a delete button destroys.
 *
 * Mentions are in-product only, and honestly so: Formation has no mail transport, so a mention is
 * something the mentioned person finds here rather than something that reaches them. Saying that
 * plainly is the same position the invitation flow takes.
 */

/** What a comment can be about. A thread always names one, and the id must exist in the workspace. */
export const COMMENT_TARGETS = Object.freeze(["claim", "decision", "deliverable", "workstream"]);

export const COMMENT_LIMITS = Object.freeze({
  body: 4_000,
  perWorkspace: 5_000,
  perThread: 200,
  mentions: 20,
});

/** The collection each target kind lives in, so a target can be checked without a switch per call site. */
const TARGET_COLLECTION = Object.freeze({
  claim: "claims",
  decision: "decisions",
  deliverable: "artifacts",
});

/**
 * Does this target exist in this workspace? A comment on a record that is not here would be a
 * thread nobody can ever find, and a comment naming another company's record would be worse.
 */
export function targetExists(database, workspace, target) {
  if (!target || !COMMENT_TARGETS.includes(target.kind)) return false;
  if (target.kind === "workstream") {
    return (workspace.workstreams ?? []).some((entry) => entry.id === target.id);
  }
  const collection = database[TARGET_COLLECTION[target.kind]] ?? [];
  const record = collection.find((entry) => entry.id === target.id && entry.workspaceId === workspace.id);
  if (!record) return false;
  if (target.kind === "deliverable" && target.sectionId) {
    return (record.sections ?? []).some((section) => section.id === target.sectionId);
  }
  return !target.sectionId;
}

/**
 * Members named in the body, resolved to accounts. Matching is by exact display name or email
 * after an `@`, against this company's members only — a mention cannot name someone outside the
 * company, which is the same boundary the members list itself holds.
 */
export function resolveMentions(body, members) {
  const text = String(body ?? "");
  const found = new Set();
  for (const member of members) {
    const handles = [member.email, member.name].filter((value) => typeof value === "string" && value.trim());
    for (const handle of handles) {
      // Word-boundary-ish: an @ followed by the handle, not part of a longer run of name characters.
      const pattern = new RegExp(`@${escapeForPattern(handle.trim())}(?![\\w.@-])`, "i");
      if (pattern.test(text)) {
        found.add(member.userId);
        break;
      }
    }
    if (found.size >= COMMENT_LIMITS.mentions) break;
  }
  return [...found];
}

function escapeForPattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class CommentError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "CommentError";
    this.status = status;
  }
}

export function createComment(database, workspace, { target, body, parentId, author }, now) {
  if (!targetExists(database, workspace, target)) {
    throw new CommentError(404, "There is nothing here to comment on.");
  }

  const workspaceComments = database.comments.filter((entry) => entry.workspaceId === workspace.id);
  if (workspaceComments.length >= COMMENT_LIMITS.perWorkspace) {
    throw new CommentError(429, "This company has as many comments as Formation will keep. Resolve some before adding more.");
  }

  let resolvedParentId = null;
  if (parentId) {
    const parent = workspaceComments.find((entry) => entry.id === parentId);
    if (!parent) throw new CommentError(404, "The comment being replied to is no longer here.");
    // One level of nesting. A reply to a reply joins the same thread rather than starting a deeper
    // one — depth is a structure people have to hold in their heads, and it buys nothing here.
    resolvedParentId = parent.parentId ?? parent.id;
    const replies = workspaceComments.filter((entry) => entry.parentId === resolvedParentId).length;
    if (replies >= COMMENT_LIMITS.perThread) throw new CommentError(429, "This conversation is as long as Formation will keep it.");
  }

  const members = database.memberships.filter((entry) => entry.workspaceId === workspace.id).map((membership) => {
    const user = database.users.find((entry) => entry.id === membership.userId);
    return { userId: membership.userId, name: user?.name ?? "", email: user?.email ?? "" };
  });

  const comment = {
    id: createId("cmt"),
    workspaceId: workspace.id,
    target: {
      kind: target.kind,
      id: target.id,
      sectionId: target.kind === "deliverable" && target.sectionId ? target.sectionId : null,
    },
    parentId: resolvedParentId,
    authorId: author.id,
    authorName: author.name,
    body,
    mentions: resolveMentions(body, members),
    createdAt: now,
    updatedAt: now,
    editedAt: null,
    resolvedAt: null,
    resolvedBy: null,
  };
  database.comments.push(comment);
  return comment;
}

/**
 * Editing your own words. Someone else's are not yours to edit at any role: an owner who can
 * rewrite what an advisor said is an owner who can rewrite the history of a decision.
 */
export function editComment(database, workspace, commentId, { body, author }, now) {
  const comment = findComment(database, workspace, commentId);
  if (comment.authorId !== author.id) {
    throw new CommentError(403, "You can only edit what you wrote.");
  }
  if (comment.resolvedAt) {
    throw new CommentError(409, "This conversation has been resolved. Reopen it before editing.");
  }
  const members = database.memberships.filter((entry) => entry.workspaceId === workspace.id).map((membership) => {
    const user = database.users.find((entry) => entry.id === membership.userId);
    return { userId: membership.userId, name: user?.name ?? "", email: user?.email ?? "" };
  });
  comment.body = body;
  comment.mentions = resolveMentions(body, members);
  comment.editedAt = now;
  comment.updatedAt = now;
  return comment;
}

/**
 * Settling a thread, or reopening one. Resolution lands on the thread's first comment, since that
 * is what a thread is; replies do not carry their own resolution state.
 */
export function setCommentResolved(database, workspace, commentId, { resolved, actor }, now) {
  const comment = findComment(database, workspace, commentId);
  if (comment.parentId) throw new CommentError(400, "Resolve the conversation, not one reply inside it.");
  if (resolved && comment.resolvedAt) return comment;
  if (!resolved && !comment.resolvedAt) return comment;

  comment.resolvedAt = resolved ? now : null;
  comment.resolvedBy = resolved ? actor.name : null;
  comment.updatedAt = now;
  return comment;
}

/** Removing what you wrote. Nobody else's, at any role — see the note on editing. */
export function deleteComment(database, workspace, commentId, { author }, now) {
  const comment = findComment(database, workspace, commentId);
  if (comment.authorId !== author.id) {
    throw new CommentError(403, "You can only delete what you wrote.");
  }
  const replies = database.comments.filter((entry) => entry.parentId === comment.id);
  if (replies.length) {
    // Deleting the opening comment of a live conversation would orphan every reply to it. The
    // words go; the thread and the fact that something was said stay.
    comment.body = "";
    comment.mentions = [];
    comment.editedAt = now;
    comment.updatedAt = now;
    comment.withdrawnAt = now;
    return { removed: false, comment };
  }
  database.comments = database.comments.filter((entry) => entry.id !== comment.id);
  return { removed: true, comment };
}

function findComment(database, workspace, commentId) {
  const comment = database.comments.find((entry) => entry.id === commentId && entry.workspaceId === workspace.id);
  if (!comment) throw new CommentError(404, "That comment is no longer here.");
  return comment;
}

/**
 * The workspace's comments as threads, newest conversation first, replies oldest first inside each.
 * The projection names the fields that may leave rather than returning records — the same
 * discipline as `domain/sharing.mjs`, for the same reason.
 */
export function commentThreads(database, workspaceId) {
  const all = database.comments.filter((entry) => entry.workspaceId === workspaceId);
  const openers = all.filter((entry) => !entry.parentId);
  const repliesByParent = new Map();
  for (const entry of all) {
    if (!entry.parentId) continue;
    const group = repliesByParent.get(entry.parentId) ?? [];
    group.push(entry);
    repliesByParent.set(entry.parentId, group);
  }

  return openers
    .map((opener) => ({
      id: opener.id,
      target: { ...opener.target },
      resolvedAt: opener.resolvedAt,
      resolvedBy: opener.resolvedBy,
      comments: [opener, ...(repliesByParent.get(opener.id) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt))].map(project),
    }))
    .sort((a, b) => {
      // Open conversations first — a resolved thread is history, and history does not need to be
      // at the top of a page somebody opened to find what still needs answering.
      if (Boolean(a.resolvedAt) !== Boolean(b.resolvedAt)) return a.resolvedAt ? 1 : -1;
      return b.comments[0].createdAt.localeCompare(a.comments[0].createdAt);
    });
}

function project(comment) {
  return {
    id: comment.id,
    authorId: comment.authorId,
    authorName: comment.authorName,
    body: comment.body,
    mentions: [...(comment.mentions ?? [])],
    createdAt: comment.createdAt,
    editedAt: comment.editedAt ?? null,
    withdrawnAt: comment.withdrawnAt ?? null,
  };
}
