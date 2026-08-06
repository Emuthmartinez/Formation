import { useState, type FormEvent } from "react";
import { api } from "../api";
import { Button, Field, PageHeader, Section } from "../components/Primitives";
import { navigate } from "../router";
import type { WorkspaceBrief } from "../types";

const initialBrief: WorkspaceBrief = {
  name: "",
  founderName: "",
  oneLiner: "",
  targetCustomer: "",
  problem: "",
  solution: "",
  currentGoal: "",
  constraints: [],
};

export function NewWorkspacePage({ onCreated }: { onCreated: (workspaceId: string) => Promise<void> }) {
  const [brief, setBrief] = useState<WorkspaceBrief>(initialBrief);
  const [constraints, setConstraints] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof WorkspaceBrief, value: string | number) => {
    setBrief((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const workspace = await api.createWorkspace({
        ...brief,
        constraints: constraints.split("\n").map((item) => item.trim()).filter(Boolean),
      });
      await onCreated(workspace.id);
      navigate("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-stack page-stack--narrow">
      <PageHeader
        eyebrow="New company"
        title="Start with the business, not a template"
        description="Give Formation the minimum context needed to create a durable source of truth and prioritize the first validation work."
      />
      <form onSubmit={submit}>
        <Section title="Company and founder" description="Enough identity to make the workspace concrete and shareable.">
          <div className="form-grid form-grid--two">
            <Field label="Company name">
              <input value={brief.name} onChange={(event) => update("name", event.target.value)} required />
            </Field>
            <Field label="Founder name">
              <input value={brief.founderName} onChange={(event) => update("founderName", event.target.value)} required />
            </Field>
          </div>
          <Field label="One-line description" hint="Describe the outcome, not the feature set.">
            <textarea rows={2} value={brief.oneLiner} onChange={(event) => update("oneLiner", event.target.value)} required />
          </Field>
        </Section>

        <Section title="Customer and problem" description="Formation will treat these as hypotheses until evidence supports them.">
          <Field label="Primary customer">
            <textarea rows={2} value={brief.targetCustomer} onChange={(event) => update("targetCustomer", event.target.value)} required />
          </Field>
          <Field label="Problem worth solving">
            <textarea rows={3} value={brief.problem} onChange={(event) => update("problem", event.target.value)} required />
          </Field>
          <Field label="Proposed solution">
            <textarea rows={3} value={brief.solution} onChange={(event) => update("solution", event.target.value)} required />
          </Field>
        </Section>

        <Section title="Current objective" description="A useful goal names the evidence or decision you need next.">
          <Field label="What must this company accomplish next?">
            <textarea rows={3} value={brief.currentGoal} onChange={(event) => update("currentGoal", event.target.value)} required />
          </Field>
          <div className="form-grid form-grid--two">
            <Field label="Target launch date" hint="Optional">
              <input type="date" value={brief.launchTarget ?? ""} onChange={(event) => update("launchTarget", event.target.value)} />
            </Field>
            <Field label="Founder hours per week" hint="Used to keep the plan credible.">
              <input
                type="number"
                min={1}
                max={100}
                value={brief.weeklyHours ?? 10}
                onChange={(event) => update("weeklyHours", Number(event.target.value))}
              />
            </Field>
          </div>
          <Field label="Constraints" hint="One per line. Examples: two-person team, iOS first, regulated market.">
            <textarea rows={4} value={constraints} onChange={(event) => setConstraints(event.target.value)} />
          </Field>
        </Section>

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="form-actions form-actions--sticky">
          <Button type="button" variant="secondary" onClick={() => navigate("/")}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Creating workspace…" : "Create founder workspace"}</Button>
        </div>
      </form>
    </div>
  );
}
