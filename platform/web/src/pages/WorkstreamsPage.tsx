import { useMemo, useState } from "react";
import { api } from "../api";
import {
  Button,
  ConfidenceMark,
  DateSignal,
  EmptyState,
  Field,
  PageHeader,
  Priority,
  ProgressLine,
  Section,
  StatusText,
  Tally,
  humanize,
  statusTone,
} from "../components/Primitives";
import { useCan } from "../capabilities";
import { runMutation, useWorkspace } from "../context";
import { navigate } from "../router";
import { Icon } from "../components/Icon";
import type { Task, Workstream } from "../types";
import { GenerateModal, NewTaskModal } from "./workstreams/WorkstreamModals";

export function WorkstreamsOverviewPage() {
  const { snapshot } = useWorkspace();
  const grouped = useMemo(() => {
    const groups = new Map<string, Workstream[]>();
    for (const stream of snapshot.workspace.workstreams) {
      const items = groups.get(stream.group) ?? [];
      items.push(stream);
      groups.set(stream.group, items);
    }
    return [...groups.entries()];
  }, [snapshot.workspace.workstreams]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Business workstreams"
        title="One company, eight connected bodies of work"
        description="Each workstream has a specific decision to improve, a current source of truth, and one next action."
      />
      {/* Column headings label progress and confidence once for the whole ledger, rather than
          repeating a caption inside every row or above every group. */}
      <div className="workstream-list__head" aria-hidden="true">
        <span>Body of work</span>
        <span>State</span>
        <span>Progress</span>
        <span>Confidence</span>
        <span>Next action</span>
        <span />
      </div>

      <div className="workstream-groups">
        {grouped.map(([group, streams]) => (
          <section key={group} className="workstream-group" aria-label={group}>
            <div className="workstream-group__head">
              <p className="section-kicker workstream-group__kicker"><span>{group}</span></p>
              {streams.length > 1 ? <Tally items={statusTally(streams)} /> : null}
            </div>
            <div className="workstream-list">
              {streams.map((stream) => (
                <button key={stream.id} className="workstream-row" onClick={() => navigate(`/workstreams/${stream.id}`)}>
                  <div className="workstream-row__identity">
                    <span className="workstream-row__index">{String(snapshot.workspace.workstreams.indexOf(stream) + 1).padStart(2, "0")}</span>
                    <div><h3>{stream.title}</h3><p>{stream.summary}</p></div>
                  </div>
                  <StatusText status={stream.status} />
                  <ProgressLine value={stream.progress} label={`${stream.title} progress`} tone={statusTone(stream.status)} />
                  <ConfidenceMark value={stream.confidence} caption={`${stream.title} confidence`} />
                  <div className="workstream-row__next">
                    <p>{stream.nextAction}</p>
                  </div>
                  <span className="workstream-row__arrow" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function WorkstreamDetailPage({ workstreamId }: { workstreamId: string }) {
  const { snapshot, reload, notify } = useWorkspace();
  const can = useCan();
  const stream = snapshot.workspace.workstreams.find((entry) => entry.id === workstreamId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stream ? toDraft(stream) : null);
  const [saving, setSaving] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  if (!stream || !draft) {
    return <EmptyState title="Workstream not found" description="This workstream may have been removed or renamed." action={<Button onClick={() => navigate("/workstreams")}>Back to workstreams</Button>} />;
  }

  const tasks = snapshot.tasks.filter((task) => task.workstreamId === stream.id);
  const artifacts = snapshot.artifacts.filter((artifact) => artifact.workstreamId === stream.id);
  const claims = snapshot.claims.filter((claim) => claim.workstreamId === stream.id && !["rejected", "superseded"].includes(claim.status));

  const save = async () => {
    setSaving(true);
    try {
      await api.updateWorkstream(snapshot.workspace.id, stream.id, {
        summary: draft.summary,
        status: draft.status,
        progress: draft.progress,
        confidence: draft.confidence,
        nextAction: draft.nextAction,
        rationale: draft.rationale,
        facts: lines(draft.facts),
        assumptions: lines(draft.assumptions),
        questions: lines(draft.questions),
      });
      await reload();
      setEditing(false);
      notify(`${stream.title} updated.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const updateTask = async (task: Task, status: Task["status"]) => {
    await runMutation(
      { reload, notify },
      () => api.updateTask(snapshot.workspace.id, task.id, { status }),
      "Task status updated.",
    );
  };

  const updateClaimStatus = async (claimId: string, status: string) => {
    await runMutation(
      { reload, notify },
      () => api.updateClaim(snapshot.workspace.id, claimId, { status }),
      "Claim status updated and contradictions recalculated.",
    );
  };

  return (
    <div className="page-stack">
      <a
        className="back-link"
        href="/workstreams"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          navigate("/workstreams");
        }}
      >
        <Icon name="arrow" width={15} height={15} /> All workstreams
      </a>
      <PageHeader
        eyebrow={`${stream.group} workstream`}
        title={stream.title}
        description={stream.summary}
        action={editing ? (
          <div className="button-row">
            <Button variant="secondary" onClick={() => { setDraft(toDraft(stream)); setEditing(false); }}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save workstream"}</Button>
          </div>
        ) : (
          <div className="button-row">
            {can("work-write") ? <Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>Edit</Button> : null}
            {can("generation-request") ? <Button icon="spark" onClick={() => setGenerateOpen(true)}>Create deliverable</Button> : null}
          </div>
        )}
      />

      <section className="workstream-hero">
        <div className="workstream-hero__reading">
          <p className="eyebrow">Progress</p>
          <strong>{stream.progress}%</strong>
          <ProgressLine value={stream.progress} label={`${stream.title} progress`} hideValue tone={statusTone(stream.status)} />
        </div>
        <div className="workstream-hero__reading">
          <p className="eyebrow">Decision confidence</p>
          <strong>{stream.confidence}%</strong>
          <ConfidenceMark value={stream.confidence} caption="Decision confidence" />
          <p>Confidence reflects evidence quality, not how polished the document looks.</p>
        </div>
        <div className="workstream-hero__status">
          <p className="eyebrow">Current state</p>
          <StatusText status={stream.status} />
        </div>
      </section>

      {editing ? (
        <Section title="Edit workstream source of truth">
          <div className="editor-stack">
            <Field label="Summary"><textarea rows={3} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} /></Field>
            <div className="form-grid form-grid--three">
              <Field label="Status">
                <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Workstream["status"] })}>
                  <option value="not-started">Not started</option><option value="on-track">On track</option><option value="needs-attention">Needs attention</option><option value="blocked">Blocked</option><option value="complete">Complete</option>
                </select>
              </Field>
              <Field label={`Progress: ${draft.progress}%`}><input type="range" min={0} max={100} value={draft.progress} onChange={(event) => setDraft({ ...draft, progress: Number(event.target.value) })} /></Field>
              <Field label={`Confidence: ${draft.confidence}%`}><input type="range" min={0} max={100} value={draft.confidence} onChange={(event) => setDraft({ ...draft, confidence: Number(event.target.value) })} /></Field>
            </div>
            <Field label="Next action"><textarea rows={2} value={draft.nextAction} onChange={(event) => setDraft({ ...draft, nextAction: event.target.value })} /></Field>
            <Field label="Rationale"><textarea rows={4} value={draft.rationale} onChange={(event) => setDraft({ ...draft, rationale: event.target.value })} /></Field>
            <div className="form-grid form-grid--three">
              <Field label="Facts" hint="One per line"><textarea rows={7} value={draft.facts} onChange={(event) => setDraft({ ...draft, facts: event.target.value })} /></Field>
              <Field label="Assumptions" hint="One per line"><textarea rows={7} value={draft.assumptions} onChange={(event) => setDraft({ ...draft, assumptions: event.target.value })} /></Field>
              <Field label="Open questions" hint="One per line"><textarea rows={7} value={draft.questions} onChange={(event) => setDraft({ ...draft, questions: event.target.value })} /></Field>
            </div>
          </div>
        </Section>
      ) : (
        <>
          <section className="next-action-block">
            <p className="eyebrow">The next useful move</p>
            <h2>{stream.nextAction}</h2>
            <p>{stream.rationale}</p>
          </section>

          <div className="three-column-evidence">
            <EvidenceColumn title="Facts" items={stream.facts} empty="No accepted facts yet." />
            <EvidenceColumn title="Assumptions" items={stream.assumptions} empty="No active assumptions recorded." />
            <EvidenceColumn title="Open questions" items={stream.questions} empty="No unresolved questions recorded." />
          </div>
        </>
      )}

      <div className="two-column-layout">
        <Section title="Work queue" description="Tasks directly connected to this workstream." action={can("work-write") ? <Button variant="quiet" icon="plus" onClick={() => setTaskOpen(true)}>Add task</Button> : undefined}>
          <div className="task-list task-list--compact">
            {tasks.length ? tasks.map((task) => (
              <article key={task.id} className="task-row">
                <button className={`task-check ${task.status === "done" ? "task-check--done" : ""}`} disabled={!can("work-write")} onClick={() => updateTask(task, task.status === "done" ? "next" : "done")} aria-label={task.status === "done" ? `Reopen ${task.title}` : `Complete ${task.title}`}>
                  {task.status === "done" ? "✓" : null}
                </button>
                <div>
                  <h3>{task.title}</h3>
                  {/* The queue used to name the priority in plain prose and drop the due date
                      entirely, so nothing here said which task to pick up first. */}
                  <p className="task-row__line"><Priority value={task.priority} /> <span>{task.owner}</span></p>
                  <DateSignal value={task.dueAt} />
                </div>
                <select value={task.status} disabled={!can("work-write")} onChange={(event) => updateTask(task, event.target.value as Task["status"])} aria-label={`Status for ${task.title}`}>
                  <option value="backlog">Backlog</option><option value="next">Next</option><option value="in-progress">In progress</option><option value="blocked">Blocked</option><option value="done">Done</option>
                </select>
              </article>
            )) : <EmptyState title="No tasks in this workstream" description="Add only work that changes the decision or removes a blocker." />}
          </div>
        </Section>

        <Section title="Deliverables" description="Editable working outputs, not frozen AI responses.">
          <div className="deliverable-compact-list">
            {artifacts.length ? artifacts.map((artifact) => (
              <button key={artifact.id} className="deliverable-compact" onClick={() => navigate(`/deliverables/${artifact.id}`)}>
                <div><StatusText status={artifact.status} /><h3>{artifact.title}</h3><p>{artifact.summary}</p></div>
                <span>v{artifact.version}</span>
              </button>
            )) : <EmptyState title="No deliverable yet" description="Create a structured draft once the workstream has enough context to make it useful." action={can("generation-request") ? <Button variant="secondary" icon="spark" onClick={() => setGenerateOpen(true)}>Create draft</Button> : undefined} />}
          </div>
        </Section>
      </div>

      <Section title="Claim ledger" description="The workstream’s evidence and recommendations remain inspectable after a deliverable changes.">
        <div className="ledger-table">
          {claims.map((claim) => (
            <article key={claim.id} className="ledger-row">
              <span className={`claim-kind claim-kind--${claim.kind}`}>{claim.kind}</span>
              <p>{claim.statement}</p>
              <ConfidenceMark value={claim.confidence} caption="Confidence" />
              <select value={claim.status} disabled={!can("evidence-write")} onChange={(event) => updateClaimStatus(claim.id, event.target.value)} aria-label={`Status for ${claim.statement}`}>
                <option value={claim.kind === "question" ? "open" : "active"}>{claim.kind === "question" ? "Open" : "Active"}</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
                <option value="superseded">Superseded</option>
              </select>
            </article>
          ))}
        </div>
      </Section>

      {generateOpen ? <GenerateModal stream={stream} onClose={() => setGenerateOpen(false)} /> : null}
      {taskOpen ? <NewTaskModal stream={stream} onClose={() => setTaskOpen(false)} /> : null}
    </div>
  );
}

/** How a group of workstreams actually stands, so the founder does not have to count rows. */
function statusTally(streams: Workstream[]) {
  const counts = new Map<string, number>();
  for (const stream of streams) counts.set(stream.status, (counts.get(stream.status) ?? 0) + 1);
  return ["blocked", "needs-attention", "on-track", "complete", "not-started"].map((status) => ({
    id: status,
    label: humanize(status).toLowerCase(),
    count: counts.get(status) ?? 0,
    tone: statusTone(status),
  }));
}

function EvidenceColumn({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section className="evidence-column">
      <div className="evidence-column__head"><h2>{title}</h2><span>{items.length}</span></div>
      {items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{empty}</p>}
    </section>
  );
}


function toDraft(stream: Workstream) {
  return { ...stream, facts: stream.facts.join("\n"), assumptions: stream.assumptions.join("\n"), questions: stream.questions.join("\n") };
}

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}
