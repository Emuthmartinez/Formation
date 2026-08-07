import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { Button, ErrorNotice } from "../components/Primitives";
import type { InvitationPreview } from "../types";

const ROLE_SUMMARY: Record<string, string> = {
  owner: "You will be able to change anything about this company, including what it is and what it commits to.",
  editor: "You will be able to do the work: workstreams, decisions, deliverables, and launch steps.",
  reviewer: "You will be able to raise questions and record evidence. The rest of the company stays as it is.",
  viewer: "You will be able to see the whole company. You will not be able to change anything.",
};

/**
 * Someone arriving on an invitation link, already signed in.
 *
 * The account they are signed in as may be the wrong one — a forwarded link is useless to whoever
 * it was forwarded to — so this page says which address the invitation is for rather than failing
 * at the last step. Everything shown here comes from the server, which will only describe an
 * invitation that is still live.
 */
export function JoinPage({ token, onJoined }: {
  token: string;
  onJoined: (workspaceId: string) => Promise<void>;
}) {
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api
      .previewInvitation(token)
      .then(setPreview)
      .catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
  }, [token]);

  if (error) {
    return (
      <main className="join-page">
        <div className="join-card">
          <ErrorNotice message={error} />
          <Button variant="secondary" onClick={() => window.location.assign("/")}>Go to Formation</Button>
        </div>
      </main>
    );
  }

  if (!preview) return <main className="join-page"><div className="join-card"><span className="spinner" /> Checking the invitation…</div></main>;

  const accept = async () => {
    setBusy(true);
    try {
      const joined = await api.acceptInvitation(token);
      await onJoined(joined.workspaceId);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : String(caught));
      setBusy(false);
    }
  };

  return (
    <main className="join-page">
      <div className="join-card">
        <p className="eyebrow">{preview.invitedBy} invited you</p>
        <h1>Join {preview.company}</h1>
        <p>{ROLE_SUMMARY[preview.role] ?? "You will be able to see this company."}</p>
        {preview.matchesYou ? (
          <>
            <Button onClick={accept} disabled={busy}>{busy ? "Joining…" : `Join ${preview.company}`}</Button>
            <p className="muted-copy">This invitation expires {preview.expiresAt.slice(0, 10)}.</p>
          </>
        ) : (
          <>
            <ErrorNotice message={`This invitation was sent to ${preview.email}, and you are signed in as someone else. Sign in with ${preview.email} to accept it.`} />
            <Button variant="secondary" onClick={() => window.location.assign("/")}>Go to Formation</Button>
          </>
        )}
      </div>
    </main>
  );
}
