import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Button, ConfidenceMark, EmptyState, Field, MarkdownBody, PageHeader, ShareLinkNotice, StatusText, formatDate, humanize } from "../components/Primitives";
import { useCan } from "../capabilities";
import { useWorkspace } from "../context";
import { navigate } from "../router";
import type { Artifact, ArtifactSection, CreatedShare, ShareLink } from "../types";

export function DeliverablesPage({ artifactId }: { artifactId?: string }) {
  const { snapshot } = useWorkspace();
  const sorted = useMemo(
    () => [...snapshot.artifacts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [snapshot.artifacts],
  );
  const selected = artifactId ? sorted.find((artifact) => artifact.id === artifactId) : sorted[0];

  useEffect(() => {
    if ((!artifactId || !selected) && sorted[0]) navigate(`/deliverables/${sorted[0].id}`);
  }, [artifactId, selected, sorted]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Deliverable library"
        title="Working documents your team can trust"
        description="Every deliverable is editable, versioned, linked to business context, and designed to improve through review instead of being replaced by the next AI answer."
      />

      {sorted.length ? (
        <div className="deliverable-workspace">
          <aside className="deliverable-index" aria-label="Deliverables">
            <div className="deliverable-index__head"><span>{sorted.length} deliverables</span><span>Updated</span></div>
            {sorted.map((artifact) => (
              <button key={artifact.id} className={`deliverable-index__item ${selected?.id === artifact.id ? "deliverable-index__item--active" : ""}`} onClick={() => navigate(`/deliverables/${artifact.id}`)}>
                <div><StatusText status={artifact.status} /><h3>{artifact.title}</h3><p>{artifact.summary}</p></div>
                {/* Version and evidence quality decide whether a document is worth opening. */}
                <div className="deliverable-index__signals">
                  <span>{formatDate(artifact.updatedAt)}</span>
                  <span>v{artifact.version}</span>
                  <ConfidenceMark value={artifact.confidence} caption={`${artifact.title} confidence`} />
                </div>
              </button>
            ))}
          </aside>
          <div className="deliverable-editor-wrap">
            {selected ? <DeliverableEditor key={selected.id} artifact={selected} /> : null}
          </div>
        </div>
      ) : (
        <EmptyState title="No deliverables yet" description="Open a workstream and create the first structured brief once the source context is strong enough." action={<Button onClick={() => navigate("/workstreams")}>Open workstreams</Button>} />
      )}
    </div>
  );
}

function DeliverableEditor({ artifact }: { artifact: Artifact }) {
  const { snapshot, reload, notify } = useWorkspace();
  const can = useCan();
  const [draft, setDraft] = useState(artifact);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [createdShare, setCreatedShare] = useState<CreatedShare | null>(null);
  const [sharing, setSharing] = useState(false);
  const workstream = snapshot.workspace.workstreams.find((stream) => stream.id === artifact.workstreamId);
  const linkedDecisions = snapshot.decisions.filter((decision) => artifact.linkedDecisionIds.includes(decision.id));
  const sourceClaims = snapshot.claims.filter((claim) => artifact.sourceClaimIds.includes(claim.id));
  const versions = snapshot.artifactVersions
    .filter((version) => version.artifactId === artifact.id)
    .sort((a, b) => b.version - a.version);

  const loadShares = useCallback(async () => {
    try {
      const all = await api.shares(snapshot.workspace.id);
      setShares(all.shares.filter((entry) => entry.artifactId === artifact.id));
    } catch {
      // A deliverable still reads perfectly well when the link list is unavailable.
    }
  }, [snapshot.workspace.id, artifact.id]);

  useEffect(() => {
    void loadShares();
  }, [loadShares]);

  const shareThis = async () => {
    setSharing(true);
    try {
      setCreatedShare(await api.createShare(snapshot.workspace.id, { scope: "deliverable", artifactId: artifact.id }));
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
      await loadShares();
      notify("The link stopped working.");
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
      // It may already have been stopped somewhere else. Whatever happened, the list on this page
      // must stop claiming the link is live.
      await loadShares();
    } finally {
      setSharing(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateArtifact(snapshot.workspace.id, artifact.id, {
        title: draft.title,
        summary: draft.summary,
        status: draft.status,
        sections: draft.sections,
      });
      setDraft(updated);
      await reload();
      setEditing(false);
      notify(`${updated.title} saved as version ${updated.version}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setSaving(false);
    }
  };


  const restoreVersion = async (version: (typeof versions)[number]) => {
    setSaving(true);
    try {
      const restored = await api.updateArtifact(snapshot.workspace.id, artifact.id, {
        title: version.title,
        summary: version.summary,
        status: "draft",
        confidence: version.confidence,
        sections: version.sections,
        sourceClaimIds: version.sourceClaimIds,
        linkedDecisionIds: version.linkedDecisionIds,
      });
      setDraft(restored);
      await reload();
      notify(`Version ${version.version} restored as version ${restored.version}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmWording = async () => {
    setSaving(true);
    try {
      const updated = await api.updateArtifact(snapshot.workspace.id, artifact.id, { wordingConfirmed: true });
      setDraft(updated);
      await reload();
      notify("Confirmed. This document can be used in drafts again — its wording was not changed.");
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (index: number, patch: Partial<ArtifactSection>) => {
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...patch } : section),
    }));
  };

  const addSection = () => {
    setDraft((current) => ({
      ...current,
      sections: [...current.sections, { id: `draft-${Date.now()}`, title: "New section", body: "" }],
    }));
  };

  const removeSection = (index: number) => {
    setDraft((current) => current.sections.length <= 1
      ? current
      : { ...current, sections: current.sections.filter((_, sectionIndex) => sectionIndex !== index) });
  };

  return (
    <article className="deliverable-editor">
      <header className="deliverable-editor__head">
        <div>
          <p className="eyebrow">{workstream?.title ?? artifact.workstreamId}</p>
          {editing ? <input className="title-input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /> : <h1>{draft.title}</h1>}
          <div className="deliverable-editor__meta">
            <StatusText status={draft.status} />
            <span>Version {draft.version}</span>
            <ConfidenceMark value={draft.confidence} caption="Confidence" />
            <span>Updated {formatDate(draft.updatedAt)}</span>
          </div>
        </div>
        <div className="button-row">
          <Button variant="quiet" icon="download" onClick={() => downloadMarkdown(snapshot.workspace.name, draft)}>Export</Button>
          {can("share-manage") && !editing ? (
            <Button variant="quiet" disabled={sharing} onClick={() => void shareThis()}>
              {shares.length ? "Share again" : "Share by link"}
            </Button>
          ) : null}
          {editing ? (
            <><Button variant="secondary" onClick={() => { setDraft(artifact); setEditing(false); }}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save new version"}</Button></>
          ) : can("work-write") ? <Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>Edit</Button> : null}
        </div>
      </header>

      <WordingHeldBack artifact={draft} onConfirm={confirmWording} busy={saving} />

      {createdShare ? <ShareLinkNotice created={createdShare} onDismiss={() => setCreatedShare(null)} /> : null}
      {shares.length ? (
        <div className="share-list">
          <p className="eyebrow">Live links to this deliverable</p>
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
      ) : null}

      {editing ? (
        <div className="deliverable-edit-form">
          <div className="form-grid form-grid--two">
            <Field label="Status"><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Artifact["status"] })}><option value="draft">Draft</option><option value="reviewed">Reviewed</option><option value="approved">Approved</option><option value="superseded">Superseded</option></select></Field>
            <Field label="Summary"><textarea rows={2} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} /></Field>
          </div>
          {draft.sections.map((section, index) => (
            <section key={section.id} className="section-editor">
              <div className="section-editor__head"><span>Section {index + 1}</span><button onClick={() => removeSection(index)} type="button" disabled={draft.sections.length <= 1} aria-label={`Remove section ${index + 1}: ${section.title}`}>Remove</button></div>
              <input value={section.title} onChange={(event) => updateSection(index, { title: event.target.value })} aria-label={`Title for section ${index + 1}`} />
              <textarea rows={Math.max(5, section.body.split("\n").length + 2)} value={section.body} onChange={(event) => updateSection(index, { body: event.target.value })} aria-label={`Body for ${section.title}`} />
            </section>
          ))}
          <Button type="button" variant="secondary" icon="plus" onClick={addSection}>Add section</Button>
        </div>
      ) : (
        <div className="deliverable-document">
          <p className="deliverable-document__summary">{draft.summary}</p>
          {draft.sections.map((section) => (
            <section key={section.id}>
              <h2>{section.title}</h2>
              <MarkdownBody body={section.body} />
            </section>
          ))}
        </div>
      )}

      <footer className="deliverable-lineage">
        <div><p className="eyebrow">Context lineage</p><p>{sourceClaims.length || linkedDecisions.length ? "This deliverable is connected to the following accepted context." : "No explicit source links have been recorded yet."}</p></div>
        <div className="lineage-items">
          {sourceClaims.map((claim) => <span key={claim.id}>{humanize(claim.kind)}: {claim.statement}</span>)}
          {linkedDecisions.map((decision) => <span key={decision.id}>Decision: {decision.title}</span>)}
        </div>
      </footer>

      <section className="version-history" aria-labelledby="version-history-title">
        <div className="version-history__head">
          <div>
            <p className="eyebrow">Durable history</p>
            <h2 id="version-history-title">Version history</h2>
          </div>
          <span>{versions.length} retained {versions.length === 1 ? "snapshot" : "snapshots"}</span>
        </div>
        <div className="version-history__list">
          {versions.map((version) => (
            <details key={version.id} className="version-row" open={version.version === draft.version}>
              <summary>
                <span>
                  <strong>Version {version.version}</strong>
                  <small>{version.createdBy}</small>
                  {/* What this version actually did, on the row a founder scans before deciding
                      whether to open it — the reason the history exists at all. */}
                  {version.change ? <small className="version-row__headline">{version.change.headline}</small> : null}
                </span>
                <span><StatusText status={version.status} /><ConfidenceMark value={version.confidence} caption="Confidence" /><small>{formatDate(version.createdAt)}</small></span>
              </summary>
              <div className="version-row__body">
                {version.change?.changes.length ? (
                  <ul className="version-changes">
                    {version.change.changes.map((entry, index) => (
                      <li key={`${entry.kind}-${index}`}>
                        <span className="version-changes__label">{entry.label}</span>
                        <span>{entry.detail}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p>{version.summary || "No summary recorded for this version."}</p>
                <ul>{version.sections.map((section) => <li key={section.id}>{section.title}</li>)}</ul>
                {version.version === draft.version ? (
                  <span className="version-row__current">Current version</span>
                ) : can("work-write") ? (
                  <Button type="button" variant="secondary" onClick={() => void restoreVersion(version)} disabled={saving}>
                    Restore as new version
                  </Button>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </section>
    </article>
  );
}

/**
 * A document brought in from a launch workspace whose own wording reads as an instruction to a
 * machine rather than a description of the business.
 *
 * It is shown, in full, unchanged — the founder's material stays the founder's material. What is
 * being said is narrower and worth saying plainly: Formation will not put this text in front of a
 * model as company context until someone here says the wording is meant. The screen is a rough
 * instrument and will sometimes be wrong, so confirming is one click and changes nothing.
 */
function WordingHeldBack({ artifact, onConfirm, busy }: { artifact: Artifact; onConfirm: () => void; busy: boolean }) {
  const can = useCan();
  const findings = artifact.source?.screened ?? [];
  if (!findings.length || artifact.source?.screenConfirmedAt) return null;

  return (
    <div className="wording-hold" role="note">
      <p className="eyebrow">Held back from drafts</p>
      <p>
        This came in from an existing launch workspace, and part of its wording reads as an instruction to a machine rather
        than a description of the business. Formation is leaving it out of anything it drafts until someone here confirms
        the wording is meant. Nothing has been changed, and the document is unaffected everywhere else.
      </p>
      <ul>
        {findings.map((finding, index) => (
          <li key={`${finding.code}-${index}`}>
            <span>{finding.reason}</span>
            <q>{finding.excerpt}</q>
          </li>
        ))}
      </ul>
      {can("work-write") ? (
        <Button variant="secondary" disabled={busy} onClick={onConfirm}>
          {busy ? "Working…" : "The wording is meant — use it"}
        </Button>
      ) : null}
    </div>
  );
}

function downloadMarkdown(companyName: string, artifact: Artifact) {
  const source = [
    `# ${artifact.title}`,
    "",
    `**Company:** ${companyName}`,
    `**Status:** ${artifact.status}`,
    `**Version:** ${artifact.version}`,
    `**Confidence:** ${artifact.confidence}%`,
    "",
    artifact.summary,
    "",
    ...artifact.sections.flatMap((section) => [`## ${section.title}`, "", section.body, ""]),
  ].join("\n");
  const blob = new Blob([source], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const filename = artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "formation-deliverable";
  anchor.download = `${filename}.md`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
