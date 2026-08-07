import { useState } from "react";
import { api } from "../api";
import { Button, Select, timeAgo } from "./Primitives";
import { useCan } from "../capabilities";
import { useWorkspace } from "../context";
import type { CommentTarget, ReviewRequest } from "../types";

/**
 * Asking someone to look at this, and what they said.
 *
 * Sits beside the conversation rather than inside it because the two are different acts: a comment
 * is addressed to nobody in particular, and a review names one person and stays open until they
 * answer. Only the person asked sees the answer controls — an owner answering on a reviewer's
 * behalf is refused by the server, so offering the button would be offering something that does
 * not work.
 */
export function ReviewRequests({ target, label = "Reviews" }: { target: CommentTarget; label?: string }) {
  const { snapshot, reload, notify } = useWorkspace();
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const me = snapshot.membership.userId;
  const reviews = (snapshot.reviews ?? []).filter(
    (entry) =>
      entry.target.kind === target.kind &&
      entry.target.id === target.id &&
      (entry.target.sectionId ?? null) === (target.sectionId ?? null),
  );
  const openRequests = reviews.filter((entry) => entry.status === "requested");
  const mayAsk = can("comment-write");

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

  const request = async () => {
    if (!assignee) return;
    await run(() => api.requestReview(snapshot.workspace.id, { target, assigneeId: assignee, note: note.trim() }), "Asked. It stays open until they answer.");
    setAssignee("");
    setNote("");
  };

  if (!reviews.length && !mayAsk) return null;

  return (
    <div className="reviews">
      <button type="button" className="conversation__toggle" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {label}
        {openRequests.length ? <span className="conversation__count">{openRequests.length} open</span> : null}
      </button>

      {open ? (
        <div className="conversation__body">
          {reviews.map((review) => (
            <article key={review.id} className={`review-row review-row--${review.status}`}>
              <p className="review-row__line">
                <strong>{review.assigneeName}</strong>
                <span>{ASKED[review.status] ?? review.status}</span>
                <span>asked by {review.requestedByName} {timeAgo(review.createdAt)}</span>
              </p>
              {review.note ? <p className="review-row__note">{review.note}</p> : null}
              {review.answerNote ? <p className="review-row__answer">“{review.answerNote}”</p> : null}

              {review.status === "requested" && review.assigneeId === me ? (
                <div className="button-row">
                  <Button variant="secondary" disabled={busy} onClick={() => void run(() => api.answerReview(snapshot.workspace.id, review.id, { answer: "approved" }), "Answered.")}>
                    This holds
                  </Button>
                  <Button variant="quiet" disabled={busy} onClick={() => void run(() => api.answerReview(snapshot.workspace.id, review.id, { answer: "changes-requested" }), "Answered.")}>
                    Needs changes
                  </Button>
                </div>
              ) : null}
              {review.status === "requested" && review.requestedBy === me ? (
                <Button variant="quiet" disabled={busy} onClick={() => void run(() => api.withdrawReview(snapshot.workspace.id, review.id), "Request withdrawn.")}>
                  Withdraw
                </Button>
              ) : null}
            </article>
          ))}

          {mayAsk ? (
            <div className="review-ask">
              <Select value={assignee} disabled={busy} onChange={(event) => setAssignee(event.target.value)} aria-label="Who to ask">
                <option value="">Ask someone to look at this…</option>
                {(snapshot.people ?? []).filter((member) => member.userId !== me).map((member) => (
                  <option key={member.userId} value={member.userId}>{member.name}</option>
                ))}
              </Select>
              {assignee ? (
                <>
                  <textarea rows={2} value={note} placeholder="What should they look at?" onChange={(event) => setNote(event.target.value)} />
                  <Button disabled={busy} onClick={() => void request()}>Ask</Button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const ASKED: Record<string, string> = {
  requested: "has not answered yet",
  approved: "said this holds",
  "changes-requested": "asked for changes",
  withdrawn: "was no longer needed",
};

export type { ReviewRequest };
