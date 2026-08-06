import { useState, type FormEvent } from "react";
import { api } from "../../api";
import { Button, Field, Modal } from "../../components/Primitives";
import { useWorkspace } from "../../context";
import { navigate } from "../../router";
import type { Job, Task, Workstream } from "../../types";

export function GenerateModal({ stream, onClose }: { stream: Workstream; onClose: () => void }) {
  const { snapshot, reload, notify } = useWorkspace();
  const [instruction, setInstruction] = useState("");
  const [artifactType, setArtifactType] = useState(defaultArtifactType(stream.id));
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const queued = await api.generate(snapshot.workspace.id, {
        workstreamId: stream.id,
        artifactType,
        instruction,
      });
      setJob(queued);
      const completed = await pollJob(snapshot.workspace.id, queued.id, setJob);
      if (completed.status === "failed") throw new Error(completed.error ?? "Generation failed.");
      await reload();
      notify("Structured deliverable created and linked to this workstream.");
      if (completed.artifactId) navigate(`/deliverables/${completed.artifactId}`);
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Create a ${stream.title.toLowerCase()} deliverable`}
      description="Formation will use the company source of truth, relevant decisions, claims, and existing deliverables."
      onClose={onClose}
    >
      <form onSubmit={submit} className="editor-stack">
        <Field label="Deliverable type">
          <select value={artifactType} onChange={(event) => setArtifactType(event.target.value)}>
            <option value={defaultArtifactType(stream.id)}>Recommended brief</option>
            <option value="decision-memo">Decision memo</option>
            <option value="evidence-plan">Evidence plan</option>
            <option value="launch-plan">Launch plan</option>
          </select>
        </Field>
        <Field
          label="Founder direction"
          hint="Optional. Give a decision to support, a constraint, or a point of view to test."
        >
          <textarea
            rows={5}
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="Example: Compare annual and lifetime offers without assuming subscription is correct."
          />
        </Field>
        {job ? (
          <div className="generation-state" role="status" aria-live="polite">
            <span className="spinner" />
            <div>
              <strong>{job.status === "queued" ? "Queued" : "Building the draft"}</strong>
              <p>This draft is saved as it builds. Closing the browser will not lose it.</p>
            </div>
          </div>
        ) : null}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" icon="spark" disabled={busy}>{busy ? "Creating…" : "Create structured draft"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function NewTaskModal({ stream, onClose }: { stream: Workstream; onClose: () => void }) {
  const { snapshot, reload, notify } = useWorkspace();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("high");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.createTask(snapshot.workspace.id, {
        workstreamId: stream.id,
        title,
        priority,
        dueAt: dueAt || null,
        owner: snapshot.workspace.founder.name,
      });
      await reload();
      notify("Task added to the workstream.");
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Add a useful task"
      description="A task belongs here only when it changes a decision, produces evidence, or removes a blocker."
      onClose={onClose}
    >
      <form onSubmit={submit} className="editor-stack">
        <Field label="Task">
          <textarea rows={3} value={title} onChange={(event) => setTitle(event.target.value)} required />
        </Field>
        <div className="form-grid form-grid--two">
          <Field label="Priority">
            <select value={priority} onChange={(event) => setPriority(event.target.value as Task["priority"])}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </Field>
          <Field label="Due date">
            <input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </Field>
        </div>
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add task"}</Button>
        </div>
      </form>
    </Modal>
  );
}

async function pollJob(workspaceId: string, jobId: string, update: (job: Job) => void): Promise<Job> {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const current = await api.job(workspaceId, jobId);
    update(current);
    if (["completed", "failed"].includes(current.status)) return current;
    await new Promise((resolve) => window.setTimeout(resolve, 350));
  }
  throw new Error("The draft is still generating. It stays queued in this workstream — check back in a moment.");
}

function defaultArtifactType(workstreamId: string) {
  if (workstreamId === "business-model") return "business-model";
  if (workstreamId === "go-to-market") return "go-to-market-brief";
  if (workstreamId === "launch") return "launch-plan";
  return `${workstreamId}-brief`;
}
