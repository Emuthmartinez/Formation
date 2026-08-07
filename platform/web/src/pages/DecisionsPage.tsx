import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api";
import { Button, DateSignal, EmptyState, Field, Modal, PageHeader, Section, StatusText, Tally, TechnicalDisclosure, dateSignal, formatDate } from "../components/Primitives";
import { Conversation } from "../components/Conversation";
import { useCan } from "../capabilities";
import { runMutation, useWorkspace } from "../context";
import { navigate } from "../router";
import type { Decision } from "../types";

export function DecisionsPage({ openNew = false, targetId = "" }: { openNew?: boolean; targetId?: string }) {
  const { snapshot, reload, notify } = useWorkspace();
  const [newOpen, setNewOpen] = useState(openNew);
  const [updating, setUpdating] = useState<string | null>(null);
  const [engineNote, setEngineNote] = useState<string | null>(null);

  useEffect(() => {
    setNewOpen(openNew);
  }, [openNew]);

  // Ask the launch engine what it is waiting on, so a parked approval shows up here without a
  // work session in between. An unreachable engine is said out loud, never shown as "no
  // approvals waiting".
  const workspaceId = snapshot.workspace.id;
  useEffect(() => {
    let cancelled = false;
    api
      .listApprovals(workspaceId)
      .then((view) => {
        if (cancelled) return;
        setEngineNote(view.connected && !view.reachable ? "The launch engine could not be reached just now, so approvals shown here may be behind." : null);
        return reload();
      })
      .catch(() => {
        // The guarantee above holds even when the check itself fails: say it out loud.
        if (!cancelled) setEngineNote("Could not check the launch engine for new approvals just now.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync once per workspace, not per snapshot reload
  }, [workspaceId]);

  useEffect(() => {
    if (targetId) {
      window.setTimeout(() => document.getElementById(targetId)?.scrollIntoView({ block: "center" }), 50);
    }
  }, [targetId]);

  const can = useCan();

  const sections = useMemo(() => {
    const active = snapshot.decisions.filter((decision) => ["open", "proposed", "revisit"].includes(decision.status));
    const decided = snapshot.decisions.filter((decision) => decision.status === "decided");
    const archived = snapshot.decisions.filter((decision) => decision.status === "superseded");
    return { active, decided, archived };
  }, [snapshot.decisions]);

  // How big the open queue is, and how much of it has already slipped past its review date.
  const openTally = useMemo(() => {
    const overdue = sections.active.filter((decision) => (dateSignal(decision.reviewAt).days ?? 0) < 0).length;
    return [
      { id: "open", label: "unresolved", count: sections.active.length, tone: "caution" as const },
      { id: "overdue", label: "past review", count: overdue, tone: "critical" as const },
    ];
  }, [sections.active]);

  const updateStatus = async (decision: Decision, status: Decision["status"]) => {
    setUpdating(decision.id);
    try {
      await runMutation(
        { reload, notify },
        () => api.updateDecision(snapshot.workspace.id, decision.id, { status }),
        status === "decided" ? "Decision accepted and propagated to the workspace." : "Decision status updated.",
      );
    } finally {
      setUpdating(null);
    }
  };

  const answerApproval = async (decision: Decision, answer: "approve" | "decline") => {
    setUpdating(decision.id);
    try {
      await runMutation(
        { reload, notify },
        () => api.answerApproval(snapshot.workspace.id, decision.id, { answer }),
        answer === "approve"
          ? "Approved. The launch engine will pick this step up on its next work session."
          : "Declined. The launch engine will hold this step.",
      );
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Decision system"
        title="Make the important calls visible"
        description="Formation keeps the decision, rationale, owner, review date, and downstream context together so yesterday’s choice does not become tomorrow’s mystery."
        action={can("decision-write") ? <Button icon="plus" onClick={() => navigate("/decisions?new=1")}>Record decision</Button> : undefined}
      />

      <Section
        title="Needs a call"
        description="Unresolved choices that are holding back confidence or downstream work."
        action={<Tally items={openTally} />}
      >
        {engineNote ? <p className="muted-copy">{engineNote}</p> : null}
        {sections.active.length ? (
          <div className="decision-list">
            {sections.active.map((decision) => (
              <DecisionRow key={decision.id} decision={decision} updating={updating === decision.id} onStatus={updateStatus} onAnswer={answerApproval} />
            ))}
          </div>
        ) : <EmptyState title="No open decisions" description="The decision queue is clear. Formation will surface a new call when workstreams conflict or evidence changes." />}
      </Section>

      <Section
        title="Decision log"
        description="Accepted decisions remain reviewable and can carry an explicit reconsideration date."
        action={<Tally items={[{ id: "decided", label: "accepted", count: sections.decided.length, tone: "positive" as const }]} />}
      >
        <div className="decision-list decision-list--history">
          {sections.decided.map((decision) => (
            <DecisionRow key={decision.id} decision={decision} updating={updating === decision.id} onStatus={updateStatus} onAnswer={answerApproval} />
          ))}
          {!sections.decided.length ? <p className="muted-copy">No accepted decisions yet.</p> : null}
        </div>
      </Section>

      {sections.archived.length ? (
        <details className="archive-details">
          <summary>{sections.archived.length} superseded decision{sections.archived.length === 1 ? "" : "s"}</summary>
          <div className="decision-list decision-list--history">
            {sections.archived.map((decision) => <DecisionRow key={decision.id} decision={decision} updating={false} onStatus={updateStatus} onAnswer={answerApproval} />)}
          </div>
        </details>
      ) : null}

      {newOpen ? <NewDecisionModal onClose={() => { setNewOpen(false); navigate("/decisions"); }} /> : null}
    </div>
  );
}

function DecisionRow({
  decision,
  updating,
  onStatus,
  onAnswer,
}: {
  decision: Decision;
  updating: boolean;
  onStatus: (decision: Decision, status: Decision["status"]) => void;
  onAnswer: (decision: Decision, answer: "approve" | "decline") => void;
}) {
  const { snapshot } = useWorkspace();
  const can = useCan();
  const workstream = snapshot.workspace.workstreams.find((entry) => entry.id === decision.workstreamId);
  const isEngineApproval = decision.source?.kind === "engine-approval";

  return (
    <article id={decision.id} className={`decision-row decision-row--${decision.status}`}>
      <div className="decision-row__meta">
        <StatusText status={decision.status} />
        <span>{workstream?.title ?? decision.workstreamId}</span>
        <span>Owner: {decision.owner}</span>
        {isEngineApproval ? <span>Launch engine</span> : null}
      </div>
      <div className="decision-row__content">
        <h2>{decision.title}</h2>
        <p className="decision-row__statement">{decision.decision}</p>
        <p className="decision-row__rationale"><strong>Rationale:</strong> {decision.rationale}</p>
        {decision.note ? <p className="muted-copy">{decision.note}</p> : null}
        {isEngineApproval && decision.source ? (
          <TechnicalDisclosure>
            <p>The team’s own name for this step: <strong>{decision.source.workflowTitle}</strong>. The specific ask: “{decision.source.description}”.</p>
          </TechnicalDisclosure>
        ) : null}
      </div>
      <div className="decision-row__dates">
        <div><span>Decided</span><strong>{formatDate(decision.decidedAt, "Not yet")}</strong></div>
        <div><span>Review</span><DateSignal value={decision.reviewAt} fallback="No review set" /></div>
      </div>
      {isEngineApproval ? (
        // A launch approval is answered with the engine, never edited in place: the engine
        // records the answer first and this record closes only after it confirms.
        decision.status === "open" && can("approval-decide") ? (
          <div className="decision-row__actions">
            <Button onClick={() => onAnswer(decision, "approve")} disabled={updating}>Approve</Button>
            <Button variant="secondary" onClick={() => onAnswer(decision, "decline")} disabled={updating}>Decline</Button>
          </div>
        ) : null
      ) : can("decision-write") ? (
        <div className="decision-row__actions">
          {decision.status !== "decided" ? <Button onClick={() => onStatus(decision, "decided")} disabled={updating}>Accept decision</Button> : null}
          {/* Accepting has one path — the button above. The select moves between the other states. */}
          <select
            value={decision.status}
            onChange={(event) => onStatus(decision, event.target.value as Decision["status"])}
            disabled={updating}
            aria-label={`Move ${decision.title} to another status`}
          >
            {decision.status === "decided" ? <option value="decided">Decided</option> : null}
            <option value="open">Open</option>
            <option value="proposed">Proposed</option>
            <option value="revisit">Revisit</option>
            <option value="superseded">Superseded</option>
          </select>
        </div>
      ) : null}

      <Conversation target={{ kind: "decision", id: decision.id }} label="Conversation about this call" />
    </article>
  );
}

function NewDecisionModal({ onClose }: { onClose: () => void }) {
  const { snapshot, reload, notify } = useWorkspace();
  const [title, setTitle] = useState("");
  const [decision, setDecision] = useState("");
  const [rationale, setRationale] = useState("");
  const [workstreamId, setWorkstreamId] = useState("strategy");
  const [status, setStatus] = useState<Decision["status"]>("open");
  const [reviewAt, setReviewAt] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.createDecision(snapshot.workspace.id, {
        title,
        decision,
        rationale,
        workstreamId,
        status,
        reviewAt: reviewAt || null,
        owner: snapshot.workspace.founder.name,
      });
      await reload();
      notify("Decision recorded in the company source of truth.");
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Record a business decision" description="Capture the call and the reasoning. A decision without rationale is just future archaeology." onClose={onClose}>
      <form onSubmit={submit} className="editor-stack">
        <Field label="Decision title"><input value={title} onChange={(event) => setTitle(event.target.value)} required /></Field>
        <Field label="The call"><textarea rows={3} value={decision} onChange={(event) => setDecision(event.target.value)} required /></Field>
        <Field label="Why this is the right call now"><textarea rows={4} value={rationale} onChange={(event) => setRationale(event.target.value)} required /></Field>
        <div className="form-grid form-grid--three">
          <Field label="Workstream"><select value={workstreamId} onChange={(event) => setWorkstreamId(event.target.value)}>{snapshot.workspace.workstreams.map((stream) => <option key={stream.id} value={stream.id}>{stream.title}</option>)}</select></Field>
          <Field label="Status" hint="A fresh decision usually starts Open — an unanswered call.">
            <select value={status} onChange={(event) => setStatus(event.target.value as Decision["status"])}><option value="open">Open</option><option value="proposed">Proposed</option><option value="decided">Decided</option></select>
          </Field>
          <Field label="Review date"><input type="date" value={reviewAt} onChange={(event) => setReviewAt(event.target.value)} /></Field>
        </div>
        <div className="form-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Recording…" : "Record decision"}</Button></div>
      </form>
    </Modal>
  );
}
