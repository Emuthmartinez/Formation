import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { Button, EmptyState, ErrorNotice, Field, PageHeader, Section, formatDate } from "../components/Primitives";
import { useWorkspace } from "../context";
import { navigate } from "../router";
import type { CreatedInvitation, PeopleView, WorkspaceRole } from "../types";

/**
 * What each role means, in the words a founder chooses one with. The server holds the same
 * summaries beside the ladder that enforces them; these are the ones a person reads while deciding
 * how much of their company to hand over.
 */
const ROLE_COPY: Record<WorkspaceRole, { title: string; summary: string }> = {
  owner: { title: "Owner", summary: "Everything, including what the company is and what it commits to." },
  editor: { title: "Editor", summary: "Does the work: workstreams, decisions, deliverables, and launch steps." },
  reviewer: { title: "Reviewer", summary: "Can raise questions and record evidence. Changes nothing else." },
  viewer: { title: "Viewer", summary: "Sees the whole company and changes nothing." },
};

const ROLE_ORDER: WorkspaceRole[] = ["owner", "editor", "reviewer", "viewer"];

export function PeoplePage() {
  const { snapshot, session, reload, notify } = useWorkspace();
  const workspaceId = snapshot.workspace.id;
  const [people, setPeople] = useState<PeopleView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedInvitation | null>(null);

  const load = useCallback(async () => {
    try {
      setPeople(await api.people(workspaceId));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusy(key);
    try {
      await action();
      await load();
      notify(message);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : String(caught), "error");
    } finally {
      setBusy(null);
    }
  };

  const leave = async (membershipId: string) => {
    setBusy(membershipId);
    try {
      await api.removeMember(workspaceId, membershipId);
      notify("You have left this company.");
      // The workspace this page belongs to is gone for them now; the shell reloads onto whatever
      // company they still have, or onto creating one.
      window.location.assign("/");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : String(caught), "error");
      setBusy(null);
    }
  };

  if (error) return <main className="page-stack"><ErrorNotice message={error} onRetry={load} /></main>;
  if (!people) return <div className="page-loading"><span className="spinner" /> Loading the people in this company…</div>;

  const you = people.members.find((member) => member.userId === session.user.id);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Access"
        title="Who works on this company"
        description={
          people.canManage
            ? "Everyone here sees the same company. What they can change is what you decide."
            : "Everyone here sees the same company. Only an owner can change who has access."
        }
      />

      <Section title="People" description="In the order they joined.">
        <div className="people-list">
          {people.members.map((member) => {
            const isYou = member.userId === session.user.id;
            const role = ROLE_COPY[member.role as WorkspaceRole];
            return (
              <article key={member.id} className="people-row">
                <div className="people-row__identity">
                  <h3>
                    {member.name}
                    {isYou ? <span className="people-row__you">you</span> : null}
                  </h3>
                  <p>{member.email}</p>
                  <p className="people-row__joined">
                    {member.joinedAt ? `Joined ${formatDate(member.joinedAt)}` : "Founding member"}
                    {member.invitedBy ? ` · invited by ${member.invitedBy}` : ""}
                  </p>
                </div>
                <div className="people-row__role">
                  {people.canManage ? (
                    <label>
                      <span className="visually-hidden">{`What ${member.name} can do`}</span>
                      <select
                        value={member.role}
                        disabled={busy === member.id}
                        onChange={(event) =>
                          void act(
                            member.id,
                            () => api.changeMemberRole(workspaceId, member.id, event.target.value as WorkspaceRole),
                            `${member.name} is now ${event.target.value === "owner" ? "an owner" : `a ${event.target.value}`}.`,
                          )
                        }
                      >
                        {ROLE_ORDER.map((entry) => (
                          <option key={entry} value={entry}>{ROLE_COPY[entry].title}</option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <strong>{role?.title ?? member.role}</strong>
                  )}
                  <p>{role?.summary}</p>
                </div>
                <div className="people-row__action">
                  {isYou ? (
                    <Button variant="quiet" disabled={busy === member.id} onClick={() => void leave(member.id)}>
                      Leave company
                    </Button>
                  ) : people.canManage ? (
                    <Button
                      variant="quiet"
                      disabled={busy === member.id}
                      onClick={() => void act(member.id, () => api.removeMember(workspaceId, member.id), `${member.name} no longer has access.`)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
        {you?.role === "owner" && people.members.filter((member) => member.role === "owner").length === 1 ? (
          <p className="muted-copy">
            You are this company’s only owner. To step down or leave, make someone else an owner first — a company
            without an owner cannot answer its own approvals or invite anyone back in.
          </p>
        ) : null}
      </Section>

      {people.canManage ? (
        <Section title="Invite someone" description="They join with their own account, at the role you choose.">
          <InviteForm
            workspaceId={workspaceId}
            onCreated={async (invitation) => {
              setCreated(invitation);
              await load();
              await reload();
            }}
          />
          {created ? <InvitationLink created={created} onDismiss={() => setCreated(null)} /> : null}
        </Section>
      ) : null}

      {people.canManage ? (
        <Section title="Waiting to join" description="Invitations that have not been used yet.">
          {people.invitations.length ? (
            <div className="people-list">
              {people.invitations.map((invitation) => (
                <article key={invitation.id} className="people-row people-row--invitation">
                  <div className="people-row__identity">
                    <h3>{invitation.email}</h3>
                    <p className="people-row__joined">
                      Invited by {invitation.invitedBy} · expires {formatDate(invitation.expiresAt)}
                    </p>
                  </div>
                  <div className="people-row__role">
                    <strong>{ROLE_COPY[invitation.role]?.title ?? invitation.role}</strong>
                    <p>{ROLE_COPY[invitation.role]?.summary}</p>
                  </div>
                  <div className="people-row__action">
                    <Button
                      variant="quiet"
                      disabled={busy === invitation.id}
                      onClick={() => void act(invitation.id, () => api.cancelInvitation(workspaceId, invitation.id), "Invitation cancelled. The link no longer works.")}
                    >
                      Cancel
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nobody is waiting"
              description="Invite a cofounder, an advisor, or a contractor above. You choose what each of them can change."
            />
          )}
        </Section>
      ) : null}
    </div>
  );
}

function InviteForm({ workspaceId, onCreated }: { workspaceId: string; onCreated: (invitation: CreatedInvitation) => Promise<void> }) {
  const { notify } = useWorkspace();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("editor");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const invitation = await api.invite(workspaceId, email, role);
      setEmail("");
      await onCreated(invitation);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : String(caught), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="invite-form" onSubmit={submit}>
      <div className="form-grid form-grid--two">
        <Field label="Their email address">
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} />
        </Field>
        <Field label="What they can do" hint={ROLE_COPY[role].summary}>
          <select value={role} onChange={(event) => setRole(event.target.value as WorkspaceRole)}>
            {ROLE_ORDER.map((entry) => (
              <option key={entry} value={entry}>{ROLE_COPY[entry].title}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="form-actions">
        <Button type="submit" disabled={busy}>{busy ? "Creating the link…" : "Create invitation"}</Button>
      </div>
    </form>
  );
}

/**
 * The one moment the link exists outside a hash. Formation has no mail transport yet, so the
 * founder carries it themselves — said plainly, and shown once, because there is no way to show it
 * again and pretending otherwise would cost someone an invitation.
 */
function InvitationLink({ created, onDismiss }: { created: CreatedInvitation; onDismiss: () => void }) {
  const link = `${window.location.origin}${created.acceptPath}`;
  const [copied, setCopied] = useState(false);

  return (
    <div className="invitation-link">
      <p className="eyebrow">Send this to {created.invitation.email}</p>
      <p>{created.delivery}</p>
      <code>{link}</code>
      <div className="button-row">
        <Button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(link).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDismiss}>Done</Button>
      </div>
      <p className="muted-copy">
        This link is shown once. If you lose it, cancel the invitation and create a new one.
      </p>
    </div>
  );
}

export function PeopleLink() {
  return (
    <Button variant="quiet" onClick={() => navigate("/people")}>
      Manage access
    </Button>
  );
}
