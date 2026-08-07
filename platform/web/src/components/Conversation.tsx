import { useState } from "react";
import { api } from "../api";
import { Button, timeAgo } from "./Primitives";
import { useCan } from "../capabilities";
import { useWorkspace } from "../context";
import type { CommentTarget, CommentThread } from "../types";

/**
 * Conversation about one record.
 *
 * Deliberately quiet. A comment is not part of the record — it is people arguing about the record —
 * so this never competes with the document it sits beside: closed until there is something to read,
 * collapsed to a count when there is, and never styled like a notification.
 *
 * Resolved threads stay, folded. "We talked about this and settled it" is exactly what a founder
 * needs six weeks later and exactly what a delete button destroys.
 */
export function Conversation({ target, label = "Conversation" }: { target: CommentTarget; label?: string }) {
  const { snapshot, reload, notify } = useWorkspace();
  const can = useCan();
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const threads = (snapshot.comments ?? []).filter(
    (thread) =>
      thread.target.kind === target.kind &&
      thread.target.id === target.id &&
      (thread.target.sectionId ?? null) === (target.sectionId ?? null),
  );
  const unresolved = threads.filter((thread) => !thread.resolvedAt);
  const mayWrite = can("comment-write");

  const run = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await work();
      await reload();
      notify(success);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    const body = draft.trim();
    if (!body) return;
    await run(() => api.comment(snapshot.workspace.id, { target, body }), "Comment added.");
    setDraft("");
  };

  const reply = async (threadId: string) => {
    const body = replyDraft.trim();
    if (!body) return;
    await run(() => api.comment(snapshot.workspace.id, { target, body, parentId: threadId }), "Reply added.");
    setReplyDraft("");
    setReplyTo(null);
  };

  const setResolved = async (threadId: string, resolved: boolean) =>
    run(
      () => api.updateComment(snapshot.workspace.id, threadId, { resolved }),
      resolved ? "Conversation settled. It stays here to read." : "Conversation reopened.",
    );

  if (!threads.length && !mayWrite) return null;

  return (
    <div className="conversation">
      <button type="button" className="conversation__toggle" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {label}
        {unresolved.length ? <span className="conversation__count">{unresolved.length}</span> : null}
        {!unresolved.length && threads.length ? <span className="conversation__count conversation__count--settled">{threads.length} settled</span> : null}
      </button>

      {open ? (
        <div className="conversation__body">
          {threads.map((thread) => (
            <article key={thread.id} className={`conversation-thread ${thread.resolvedAt ? "conversation-thread--settled" : ""}`}>
              {thread.comments.map((comment) => (
                <div key={comment.id} className="conversation-comment">
                  <p className="conversation-comment__meta">
                    <strong>{comment.authorName}</strong>
                    <span>{timeAgo(comment.createdAt)}</span>
                    {comment.editedAt ? <span>edited</span> : null}
                  </p>
                  <p className="conversation-comment__body">
                    {comment.withdrawnAt ? <em>This comment was withdrawn. The rest of the conversation is below.</em> : comment.body}
                  </p>
                </div>
              ))}

              <div className="conversation-thread__actions">
                {thread.resolvedAt ? (
                  <>
                    <span className="conversation-thread__settled">Settled by {thread.resolvedBy} {timeAgo(thread.resolvedAt)}</span>
                    {mayWrite ? <Button variant="quiet" disabled={busy} onClick={() => void setResolved(thread.id, false)}>Reopen</Button> : null}
                  </>
                ) : mayWrite ? (
                  <>
                    <Button variant="quiet" disabled={busy} onClick={() => setReplyTo(replyTo === thread.id ? null : thread.id)}>
                      {replyTo === thread.id ? "Cancel" : "Reply"}
                    </Button>
                    <Button variant="quiet" disabled={busy} onClick={() => void setResolved(thread.id, true)}>Settle</Button>
                  </>
                ) : null}
              </div>

              {replyTo === thread.id ? (
                <div className="conversation__compose">
                  <textarea rows={2} value={replyDraft} placeholder="Reply…" onChange={(event) => setReplyDraft(event.target.value)} />
                  <Button disabled={busy || !replyDraft.trim()} onClick={() => void reply(thread.id)}>Post reply</Button>
                </div>
              ) : null}
            </article>
          ))}

          {mayWrite ? (
            <div className="conversation__compose">
              <textarea
                rows={2}
                value={draft}
                placeholder="Start a conversation about this. Mention someone with @ and their name."
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button disabled={busy || !draft.trim()} onClick={() => void start()}>Post</Button>
            </div>
          ) : null}

          {mayWrite ? (
            <p className="conversation__note">
              Mentions are found here rather than sent — Formation has no way to email anyone yet, and would rather say so than look like it did.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export type { CommentThread };
