import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api";
import { Button, ConfidenceMark, ContradictionStatements, Field, Modal, PageHeader, Section, ShareLinkNotice, formatCount, formatDate, humanize } from "../components/Primitives";
import { Icon } from "../components/Icon";
import { Economics } from "../components/Economics";
import { useCan } from "../capabilities";
import { runMutation, useWorkspace } from "../context";
import { navigate } from "../router";
import type { Claim, CreatedShare, ShareLink, Workspace } from "../types";

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

/**
 * Ten consecutive statements read as one undifferentiated wall, so a founder looking for the
 * pricing logic has to scan all of it. These three headings are the questions the statements
 * answer, which lets the reader jump to the part of the company they came to check.
 */
const statementGroups: Array<{ id: string; title: string; fields: Array<keyof Workspace["company"]> }> = [
  { id: "thesis", title: "Who this is for and why it matters", fields: ["thesis", "targetCustomer", "problem"] },
  { id: "offer", title: "What the company actually sells", fields: ["solution", "positioning", "differentiation"] },
  { id: "economics", title: "How it makes money and what proves it", fields: ["businessModel", "pricing", "northStarMetric"] },
];

const emptyClaimCopy: Record<Claim["kind"], string> = {
  fact: "Nothing verified yet. When evidence lands, record it with “Add claim”.",
  assumption: "No working assumptions. Capture what the plan is betting on with “Add claim”.",
  recommendation: "No recommendations yet. They arrive as evidence and drafts accumulate.",
  question: "No open questions. Add the ones that would change a decision.",
};

export function BusinessPage() {
  const { snapshot, reload, notify } = useWorkspace();
  const can = useCan();
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
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [createdShare, setCreatedShare] = useState<CreatedShare | null>(null);
  const [sharing, setSharing] = useState(false);
  const primaryContradiction = snapshot.contradictions[0];

  const loadShares = useCallback(async () => {
    try {
      const all = await api.shares(snapshot.workspace.id);
      setShares(all.shares.filter((entry) => entry.scope === "company"));
    } catch {
      // The company still reads perfectly well when the link list is unavailable.
    }
  }, [snapshot.workspace.id]);

  useEffect(() => {
    void loadShares();
  }, [loadShares]);

  const shareOverview = async () => {
    setSharing(true);
    try {
      setCreatedShare(await api.createShare(snapshot.workspace.id, { scope: "company" }));
      await loadShares();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setSharing(false);
    }
  };

  const stopShare = async (shareId: string) => {
    setSharing(true);
    try {
      await api.stopShare(snapshot.workspace.id, shareId);
      setCreatedShare(null);
      notify("The link stopped working.");
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      await loadShares();
      setSharing(false);
    }
  };

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
        ) : (
          <div className="button-row">
            {can("share-manage") ? (
              <Button variant="quiet" disabled={sharing} onClick={() => void shareOverview()}>
                {shares.length ? "Share again" : "Share overview"}
              </Button>
            ) : null}
            {can("company-write") ? <Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>Edit business</Button> : null}
          </div>
        )}
      />

      {createdShare ? <ShareLinkNotice created={createdShare} onDismiss={() => setCreatedShare(null)} /> : null}
      {shares.length ? (
        <Section title="Shared outside the company" description="Anyone holding one of these links can read the company overview — no account, no sign-in.">
          <div className="share-list share-list--flush">
            {shares.map((entry) => (
              <div key={entry.id} className="share-row">
                <div>
                  <strong>Shared by {entry.createdBy}</strong>
                  <p>
                    Read {entry.viewCount === 1 ? "once" : `${entry.viewCount} times`}
                    {entry.lastViewedAt ? `, last on ${formatDate(entry.lastViewedAt)}` : ""} · stops {formatDate(entry.expiresAt)}
                  </p>
                </div>
                {can("share-manage") ? (
                  <Button variant="quiet" disabled={sharing} onClick={() => void stopShare(entry.id)}>Stop this link</Button>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

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
          <div className="business-statement-groups">
            {statementGroups.map((group) => (
              <section key={group.id} className="business-statement-group" aria-label={group.title}>
                <h3 className="business-statement-group__title">{group.title}</h3>
                <div className="business-statement-list">
                  {group.fields.map((key) => {
                    const entry = companyFieldLabels.find(([field]) => field === key);
                    if (!entry) return null;
                    const [, label, hint] = entry;
                    return (
                      <article key={key} className="business-statement">
                        <div><p className="eyebrow">{label}</p><p className="business-statement__hint">{hint}</p></div>
                        <p>{String(snapshot.workspace.company[key])}</p>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
            <section className="business-statement-group" aria-label="Boundaries the plan must respect">
              <h3 className="business-statement-group__title">Boundaries the plan must respect</h3>
              <div className="business-statement-list">
                <article className="business-statement">
                  <div><p className="eyebrow">Operating constraints</p><p className="business-statement__hint">What the plan is not allowed to assume away.</p></div>
                  <ul>{snapshot.workspace.company.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}</ul>
                </article>
              </div>
            </section>
          </div>
        )}
      </Section>

      <Economics />

      <Section
        title="Claims and evidence"
        description="Facts, assumptions, recommendations, and unresolved questions stay distinct. That is less magical, and much more useful."
        action={can("evidence-write") ? <Button variant="secondary" icon="plus" onClick={() => setClaimModal(true)}>Add claim</Button> : undefined}
      >
        {/* The same treatment Today gives a conflict. A contradiction between two claims is the
            single most consequential thing this page can report, and a quiet inline strip made
            it read as a footnote to the list it sits above. */}
        {primaryContradiction ? (
          <section className="contradiction-banner">
            <Icon name="warning" width={22} height={22} />
            <div>
              <p className="eyebrow">Source-of-truth conflict</p>
              <h2>{primaryContradiction.title}</h2>
              <ContradictionStatements entries={primaryContradiction.entries} fallback={primaryContradiction.summary} />
            </div>
            <Button variant="secondary" onClick={() => navigate(`/workstreams/${primaryContradiction.workstreamIds[0] ?? "strategy"}`)}>
              Resolve conflict
            </Button>
          </section>
        ) : null}
        {/* One ledger grouped by kind rather than four columns of unequal length: a column grid
            leaves three quarters of the band empty whenever the evidence is not evenly spread. */}
        <div className="claim-ledger">
          {claimsByKind.map(({ kind, claims }) => (
            <section key={kind} className="claim-ledger__group" aria-label={`${humanize(kind)}s`}>
              <div className="claim-ledger__head">
                <h3>{humanize(kind)}s</h3>
                <span>{formatCount(claims.length)}</span>
              </div>
              {claims.length ? (
                claims.map((claim) => (
                  <article key={claim.id} className="claim-ledger__row">
                    <p>{claim.statement}</p>
                    <ConfidenceMark value={claim.confidence} caption="Confidence" />
                    <select value={claim.status} disabled={!can("evidence-write")} onChange={(event) => updateClaimStatus(claim, event.target.value)} aria-label={`Status for ${claim.statement}`}>
                      <option value={claim.kind === "question" ? "open" : "active"}>{claim.kind === "question" ? "Open" : "Active"}</option>
                      <option value="resolved">Resolved</option>
                      <option value="rejected">Rejected</option>
                      <option value="superseded">Superseded</option>
                    </select>
                  </article>
                ))
              ) : (
                <p className="claim-ledger__empty">{emptyClaimCopy[kind]}</p>
              )}
            </section>
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
