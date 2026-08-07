import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { Button, ErrorNotice, Field, PageHeader, Section, formatDate } from "../components/Primitives";
import { useWorkspace } from "../context";
import type { AccountSession } from "../types";

/**
 * The account's own security surface: which devices are signed in, and changing the password.
 *
 * Nothing on this page belongs to a company — a founder who works on three companies has one
 * account, and this is where they look after it.
 */
export function AccountPage() {
  const { session, notify } = useWorkspace();
  const [sessions, setSessions] = useState<AccountSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSessions((await api.sessions()).sessions);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const endSession = async (entry: AccountSession) => {
    setBusy(entry.id);
    try {
      const result = await api.revokeSession(entry.id);
      if (result.endedCurrentSession) {
        // The session this page was using is gone; a reload is the honest next state.
        window.location.assign("/");
        return;
      }
      await load();
      notify(`${entry.device} was signed out.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : String(caught), "error");
    } finally {
      setBusy(null);
    }
  };

  const endOthers = async () => {
    setBusy("others");
    try {
      const result = await api.revokeOtherSessions();
      await load();
      notify(
        result.revoked === 0
          ? "This is the only device signed in."
          : `Signed out of ${result.revoked} other ${result.revoked === 1 ? "device" : "devices"}.`,
      );
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : String(caught), "error");
    } finally {
      setBusy(null);
    }
  };

  const others = (sessions ?? []).filter((entry) => !entry.current).length;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Your account"
        title={session.user.name}
        description={session.user.email}
      />

      <Section
        title="Where you are signed in"
        description="Every device holding a live session for this account. If one of these is not you, sign it out and change your password."
        action={
          others > 0 ? (
            <Button variant="secondary" disabled={busy === "others"} onClick={() => void endOthers()}>
              Sign out everywhere else
            </Button>
          ) : undefined
        }
      >
        {error ? <ErrorNotice message={error} onRetry={load} /> : null}
        {sessions ? (
          <div className="people-list">
            {sessions.map((entry) => (
              <article key={entry.id} className="people-row">
                <div className="people-row__identity">
                  <h3>
                    {entry.device}
                    {entry.current ? <span className="people-row__you">this device</span> : null}
                  </h3>
                  <p className="people-row__joined">
                    Signed in {formatDate(entry.signedInAt)} · last used {formatDate(entry.lastSeenAt)}
                  </p>
                </div>
                <div className="people-row__role">
                  <p>Access ends {formatDate(entry.expiresAt)} unless it is used again.</p>
                </div>
                <div className="people-row__action">
                  <Button variant="quiet" disabled={busy === entry.id} onClick={() => void endSession(entry)}>
                    {entry.current ? "Sign out" : "Sign out this device"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="page-loading"><span className="spinner" /> Checking your devices…</div>
        )}
      </Section>

      <Section
        title="Change your password"
        description="Your current password is required even here — a session someone else walked up to should not be enough to take the account."
      >
        <PasswordForm onChanged={load} />
      </Section>
    </div>
  );
}

function PasswordForm({ onChanged }: { onChanged: () => Promise<void> }) {
  const { notify } = useWorkspace();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      await onChanged();
      notify(
        result.signedOutElsewhere === 0
          ? "Password changed."
          : `Password changed, and ${result.signedOutElsewhere} other ${result.signedOutElsewhere === 1 ? "device was" : "devices were"} signed out.`,
      );
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : String(caught), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="invite-form" onSubmit={submit}>
      <div className="form-grid form-grid--two">
        <Field label="Current password">
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            maxLength={128}
          />
        </Field>
        <Field label="New password" hint="Use 12 to 128 characters. Every other device is signed out.">
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            minLength={12}
            maxLength={128}
          />
        </Field>
      </div>
      <div className="form-actions">
        <Button type="submit" disabled={busy}>{busy ? "Changing…" : "Change password"}</Button>
      </div>
    </form>
  );
}
