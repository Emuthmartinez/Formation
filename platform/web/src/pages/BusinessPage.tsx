import { useMemo, useState, type FormEvent } from "react";
import { api } from "../api";
import { Button, ContradictionStatements, Field, Modal, PageHeader, Section, humanize } from "../components/Primitives";
import { runMutation, useWorkspace } from "../context";
import type { Claim, Workspace } from "../types";

const companyFieldLabels: Array<[keyof Workspace["company"], string, string]> = [
  ["thesis", "Business thesis", "The strategic case for why this company should exist and win."],
  ["targetCustomer", "Primary customer", "One first customer, not a list of everybody who might benefit."],
  ["problem", "Problem", "The costly or emotionally important job that creates urgency."],
  ["solution", "Product and offer", "The smallest credible route to the promised outcome."],
  ["positioning", "Positioning", "What the customer should understand and remember."],
  ["differentiation", "Differentiation", "Why this approach is meaningfully different from alternatives."],
  ["businessModel", "Business model", "What the customer buys and how value recurs."],
  ["pricing", "Pricing hypothesis", "Current working price and packaging logic."],
  ["northStarMetric", "North-star metric", "A behavior that demonstrates recurring customer value."],
];

const emptyClaimCopy: Record<Claim["kind"], string> = {
  fact: "Nothing verified yet. When evidence lands, record it with “Add claim”.",
  assumption: "No working assumptions. Capture what the plan is betting on with “Add claim”.",
  recommendation: "No recommendations yet. They arrive as evidence and drafts accumulate.",
  question: "No open questions. Add the ones that would change a decision.",
};

export function BusinessPage() {
  const { snapshot, reload, notify } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(snapshot.workspace.company);
  const [workspaceDraft, setWorkspaceDraft] = useState({
    name: snapshot.workspace.name,
    stage: snapshot.workspace.stage,
    launchTarget: snapshot.workspace.launchTarget ?? "",
    founder: { ...snapshot.workspace.founder },
  });
  const [saving, setSaving] = useState(false);
  const [claimModal, setClaimModal] = useState(false);
  const primaryContradiction = snapshot.contradictions[0];

  const claimsByKind = useMemo(() => {
    return ["fact", "assumption", "recommendation", "question"].map((kind) => ({
      kind: kind as Claim["kind"],
      claims: snapshot.claims.filter((claim) => claim.kind === kind && !["rejected", "superseded"].includes(claim.status)),
    }));
  }, [snapshot.claims]);

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        api.updateCompany(snapshot.workspace.id, draft),
        api.updateWorkspace(snapshot.workspace.id, {
          name: workspaceDraft.name,
          stage: workspaceDraft.stage,
          launchTarget: workspaceDraft.launchTarget || null,
          founder: workspaceDraft.founder,
        }),
      ]);
      await reload();
      setEditing(false);
      notify("Business source of truth updated.");
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const updateClaimStatus = async (claim: Claim, status: string) => {
    await runMutation(
      { reload, notify },
      () => api.updateClaim(snapshot.workspace.id, claim.id, { status }),
      status === "active" || status === "open" ? "Claim reopened." : "Claim status updated and contradictions recalculated.",
    );
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Company source of truth"
        title={snapshot.workspace.company.oneLiner}
        description="This context is reused across every recommendation, workstream, decision, and generated deliverable."
        action={editing ? (
          <div className="button-row">
            <Button variant="secondary" onClick={() => {
              setDraft(snapshot.workspace.company);
              setWorkspaceDraft({ name: snapshot.workspace.name, stage: snapshot.workspace.stage, launchTarget: snapshot.workspace.launchTarget ?? "", founder: { ...snapshot.workspace.founder } });
              setEditing(false);
            }}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save source of truth"}</Button>
          </div>
        ) : <Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>Edit business</Button>}
      />

      <Section className="business-overview" title="What this company is building" description="The stable context that keeps the platform from generating a new company every time you ask a question.">
        {editing ? (
          <div className="editor-stack">
            <div className="form-grid form-grid--three">
              <Field label="Company name"><input value={workspaceDraft.name} onChange={(event) => setWorkspaceDraft({ ...workspaceDraft, name: event.target.value })} /></Field>
              <Field label="Company stage">
                <select value={workspaceDraft.stage} onChange={(event) => setWorkspaceDraft({ ...workspaceDraft, stage: event.target.value })}>
                  <option value="idea">Idea</option><option value="discovery">Discovery</option><option value="validation">Validation</option><option value="build">Build</option><option value="beta">Beta</option><option value="launch">Launch</option><option value="growth">Growth</option>
                </select>
              </Field>
              <Field label="Target launch"><input type="date" value={workspaceDraft.launchTarget} onChange={(event) => setWorkspaceDraft({ ...workspaceDraft, launchTarget: event.target.value })} /></Field>
            </div>
            <div className="form-grid form-grid--three">
              <Field label="Founder name"><input value={workspaceDraft.founder.name} onChange={(event) => setWorkspaceDraft({ ...workspaceDraft, founder: { ...workspaceDraft.founder, name: event.target.value } })} /></Field>
              <Field label="Founder role"><input value={workspaceDraft.founder.role} onChange={(event) => setWorkspaceDraft({ ...workspaceDraft, founder: { ...workspaceDraft.founder, role: event.target.value } })} /></Field>
              <Field label="Founder hours per week"><input type="number" min={1} max={100} value={workspaceDraft.founder.weeklyHours} onChange={(event) => setWorkspaceDraft({ ...workspaceDraft, founder: { ...workspaceDraft.founder, weeklyHours: Number(event.target.value) } })} /></Field>
            </div>
            <Field label="One-line description">
              <textarea rows={2} value={draft.oneLiner} onChange={(event) => setDraft({ ...draft, oneLiner: event.target.value })} />
            </Field>
            {companyFieldLabels.map(([key, label, hint]) => (
              <Field key={key} label={label} hint={hint}>
                <textarea rows={key === "thesis" ? 5 : 3} value={String(draft[key])} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
              </Field>
            ))}
            <Field label="Current objective" hint="The evidence or decision the company needs next.">
              <textarea rows={3} value={draft.currentGoal} onChange={(event) => setDraft({ ...draft, currentGoal: event.target.value })} />
            </Field>
            <Field label="Constraints" hint="One constraint per line.">
              <textarea rows={4} value={draft.constraints.join("\n")} onChange={(event) => setDraft({ ...draft, constraints: event.target.value.split("\n") })} />
            </Field>
          </div>
        ) : (
          <div className="business-statement-list">
            {companyFieldLabels.map(([key, label, hint]) => (
              <article key={key} className="business-statement">
                <div><p className="eyebrow">{label}</p><p className="business-statement__hint">{hint}</p></div>
                <p>{String(snapshot.workspace.company[key])}</p>
              </article>
            ))}
            <article className="business-statement">
              <div><p className="eyebrow">Operating constraints</p><p className="business-statement__hint">Boundaries the plan must respect.</p></div>
              <ul>{snapshot.workspace.company.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}</ul>
            </article>
          </div>
        )}
      </Section>

      <Section
        title="Claims and evidence"
        description="Facts, assumptions, recommendations, and unresolved questions stay distinct. That is less magical, and much more useful."
        action={<Button variant="secondary" icon="plus" onClick={() => setClaimModal(true)}>Add claim</Button>}
      >
        {primaryContradiction ? (
          <div className="source-conflict-inline">
            <strong>{snapshot.contradictions.length} contradiction{snapshot.contradictions.length === 1 ? "" : "s"} detected</strong>
            <ContradictionStatements entries={primaryContradiction.entries} fallback={primaryContradiction.summary} />
          </div>
        ) : null}
        <div className="claim-columns">
          {claimsByKind.map(({ kind, claims }) => (
            <div key={kind} className="claim-column">
              <div className="claim-column__head">
                <h3>{humanize(kind)}s</h3>
                <span>{claims.length}</span>
              </div>
              {claims.map((claim) => (
                <article key={claim.id} className="claim-row">
                  <p>{claim.statement}</p>
                  <div className="claim-row__controls">
                    <span>{claim.confidence}% confidence</span>
                    <select value={claim.status} onChange={(event) => updateClaimStatus(claim, event.target.value)} aria-label={`Status for ${claim.statement}`}>
                      <option value={claim.kind === "question" ? "open" : "active"}>{claim.kind === "question" ? "Open" : "Active"}</option>
                      <option value="resolved">Resolved</option>
                      <option value="rejected">Rejected</option>
                      <option value="superseded">Superseded</option>
                    </select>
                  </div>
                </article>
              ))}
              {!claims.length ? <p className="muted-copy">{emptyClaimCopy[kind]}</p> : null}
            </div>
          ))}
        </div>
      </Section>

      {claimModal ? <NewClaimModal onClose={() => setClaimModal(false)} /> : null}
    </div>
  );
}

function NewClaimModal({ onClose }: { onClose: () => void }) {
  const { snapshot, reload, notify } = useWorkspace();
  const [kind, setKind] = useState<Claim["kind"]>("assumption");
  const [workstreamId, setWorkstreamId] = useState("strategy");
  const [statement, setStatement] = useState("");
  const [key, setKey] = useState("");
  const [confidence, setConfidence] = useState(50);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.createClaim(snapshot.workspace.id, { kind, workstreamId, statement, key: key || null, confidence });
      await reload();
      notify(`${humanize(kind)} recorded.`);
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Add a business claim" description="Use a stable key when two statements should be checked for contradiction." onClose={onClose}>
      <form onSubmit={submit} className="editor-stack">
        <div className="form-grid form-grid--two">
          <Field label="Kind">
            <select value={kind} onChange={(event) => setKind(event.target.value as Claim["kind"])}>
              <option value="fact">Fact</option><option value="assumption">Assumption</option><option value="recommendation">Recommendation</option><option value="question">Question</option>
            </select>
          </Field>
          <Field label="Workstream">
            <select value={workstreamId} onChange={(event) => setWorkstreamId(event.target.value)}>
              {snapshot.workspace.workstreams.map((stream) => <option key={stream.id} value={stream.id}>{stream.title}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Statement"><textarea rows={4} value={statement} onChange={(event) => setStatement(event.target.value)} required /></Field>
        <Field label="Comparison key" hint="Example: pricing.model or customer.primary. Optional."><input value={key} onChange={(event) => setKey(event.target.value)} /></Field>
        <Field label={`Confidence: ${confidence}%`}><input type="range" min={0} max={100} value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></Field>
        <div className="form-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Add claim"}</Button></div>
      </form>
    </Modal>
  );
}
