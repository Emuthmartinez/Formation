import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Button, ConfidenceMark, EmptyState, Field, PageHeader, StatusText, formatDate, humanize } from "../components/Primitives";
import { useWorkspace } from "../context";
import { navigate } from "../router";
import type { Artifact, ArtifactSection } from "../types";

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
  const [draft, setDraft] = useState(artifact);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const workstream = snapshot.workspace.workstreams.find((stream) => stream.id === artifact.workstreamId);
  const linkedDecisions = snapshot.decisions.filter((decision) => artifact.linkedDecisionIds.includes(decision.id));
  const sourceClaims = snapshot.claims.filter((claim) => artifact.sourceClaimIds.includes(claim.id));
  const versions = snapshot.artifactVersions
    .filter((version) => version.artifactId === artifact.id)
    .sort((a, b) => b.version - a.version);

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
          {editing ? (
            <><Button variant="secondary" onClick={() => { setDraft(artifact); setEditing(false); }}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save new version"}</Button></>
          ) : <Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>Edit</Button>}
        </div>
      </header>

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
                <span><strong>Version {version.version}</strong><small>{version.createdBy}</small></span>
                <span><StatusText status={version.status} /><ConfidenceMark value={version.confidence} caption="Confidence" /><small>{formatDate(version.createdAt)}</small></span>
              </summary>
              <div className="version-row__body">
                <p>{version.summary || "No summary recorded for this version."}</p>
                <ul>{version.sections.map((section) => <li key={section.id}>{section.title}</li>)}</ul>
                {version.version !== draft.version ? (
                  <Button type="button" variant="secondary" onClick={() => void restoreVersion(version)} disabled={saving}>
                    Restore as new version
                  </Button>
                ) : <span className="version-row__current">Current version</span>}
              </div>
            </details>
          ))}
        </div>
      </section>
    </article>
  );
}

function MarkdownBody({ body }: { body: string }) {
  const blocks = body.split(/\n\n+/);
  return <>{blocks.map((block, index) => block.startsWith("- ") ? (
    <ul key={index}>{block.split("\n").map((line, lineIndex) => <li key={`${index}-${lineIndex}`}>{line.replace(/^\-\s*/, "")}</li>)}</ul>
  ) : <p key={index}>{block}</p>)}</>;
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
