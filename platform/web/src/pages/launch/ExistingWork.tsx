import { useEffect, useState } from "react";
import { api } from "../../api";
import { Button, EmptyState, Field, Section, Select, formatDate, timeAgo } from "../../components/Primitives";
import { useCan } from "../../capabilities";
import { useWorkspace } from "../../context";
import type { ImportPlan, ImportSource } from "../../types";

/**
 * Work the founder already did, before Formation.
 *
 * A founder who has been running a launch with the engine has months of decisions, blockers, and
 * documents sitting in a launch workspace. This section brings it in — but never as a surprise:
 * nothing happens until the founder has read exactly what would arrive, and what arrives is
 * explicitly a draft.
 *
 * Two things this surface refuses to do. It never asks for a path — the founder chooses from what
 * the server holds, because a text box for a filesystem path is an invitation to read files nobody
 * meant to share. And it shows the launch workspace's own contradictions *above* what it would
 * bring in, not folded away below it: a record that disagrees with itself is the most important
 * thing on the screen, not a footnote to a success message.
 */
export function ExistingWorkSection() {
  const { snapshot, reload, notify } = useWorkspace();
  const can = useCan();
  const workspaceId = snapshot.workspace.id;

  const [sources, setSources] = useState<ImportSource[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [selected, setSelected] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [imported, setImported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const allowed = can("launch-import");

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await api.importSources(workspaceId);
        if (cancelled) return;
        setConfigured(list.configured);
        setSources(list.sources);
        // One launch workspace is the common case. Choosing it and showing what it holds saves the
        // founder two steps and still changes nothing — a preview writes nothing on the server.
        const only = list.sources.length === 1 ? list.sources[0] : undefined;
        if (!only) return;
        setSelected(only.id);
        try {
          const preview = await api.previewImport(workspaceId, only.id);
          if (!cancelled) setPlan(preview);
        } catch (error) {
          if (!cancelled) setProblem(error instanceof Error ? error.message : String(error));
        }
      } catch {
        if (!cancelled) setSources([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, workspaceId]);

  // Nothing to offer and nothing the founder could do about it: an owner on an instance with no
  // launch workspaces attached is better served by an absent section than an explained one.
  if (!allowed || !configured || (sources !== null && sources.length === 0)) return null;

  const runPreview = async (sourceId: string) => {
    setBusy(true);
    setProblem(null);
    setImported(false);
    try {
      setPlan(await api.previewImport(workspaceId, sourceId));
    } catch (error) {
      setPlan(null);
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!selected) return;
    setBusy(true);
    setProblem(null);
    try {
      const result = await api.applyImport(workspaceId, selected);
      setPlan(result);
      setImported(true);
      await reload();
      notify(summarise(result));
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const blocking = plan?.contradictions.filter((entry) => entry.severity === "blocking") ?? [];
  const advisory = plan?.contradictions.filter((entry) => entry.severity === "advisory") ?? [];
  const arriving = plan ? plan.totals.creates : 0;
  const pending = plan ? plan.totals.creates + plan.totals.updates + plan.totals.flagged + plan.totals.retires > 0 : false;

  return (
    <Section
      title="Work you have already done"
      description="If this company has been running a launch outside Formation, its record can come in here — decisions, blockers, and documents. Everything arrives as a draft for you to confirm."
    >
      <div className="import-picker">
        <Field label="Which launch workspace" hint="These are the launch workspaces this server holds.">
          <Select
            value={selected}
            disabled={busy}
            onChange={(event) => {
              const next = event.target.value;
              setSelected(next);
              setPlan(null);
              setImported(false);
              if (next) void runPreview(next);
            }}
          >
            <option value="">Choose one…</option>
            {(sources ?? []).map((source) => (
              <option key={source.id} value={source.id}>
                {source.id}
                {source.updatedAt ? ` — last worked on ${timeAgo(source.updatedAt)}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        {/* No button when there is nothing to do. An import that would change nothing is not a
            choice the founder needs to make, and offering it reads as work that is still pending. */}
        {selected && plan && !imported && pending ? (
          <Button onClick={runImport} disabled={busy}>
            {busy ? "Working…" : arriving ? `Bring in ${arriving} ${arriving === 1 ? "item" : "items"}` : "Bring it in"}
          </Button>
        ) : null}
      </div>

      {problem ? <p className="notice notice--error" role="alert">{problem}</p> : null}

      {plan ? (
        <div className="import-plan">
          {imported ? <p className="notice notice--success" role="status">{summarise(plan)}</p> : null}

          {blocking.length ? (
            <div className="import-plan__contradictions">
              <p className="eyebrow">This record disagrees with itself</p>
              <ul>
                {blocking.map((entry, index) => (
                  <li key={`${entry.message}-${index}`}>
                    {entry.message}
                    {imported ? <span className="import-plan__note"> Kept as an open question for you.</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {plan.company ? (
            <dl className="import-plan__company">
              <div>
                <dt>Company</dt>
                <dd>{plan.company.name}</dd>
              </div>
              <div>
                <dt>What it promises</dt>
                <dd>{plan.company.oneLiner}</dd>
              </div>
              <div>
                <dt>Who it is for</dt>
                <dd>{plan.company.targetCustomer}</dd>
              </div>
              {plan.company.liveSince ? (
                <div>
                  <dt>Live since</dt>
                  <dd>{formatDate(plan.company.liveSince)}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="import-plan__groups">
            <PlanGroup
              label="Recorded work and open questions"
              entries={plan.claims.map((entry) => ({ action: entry.action, label: entry.statement }))}
              imported={imported}
            />
            <PlanGroup
              label="Decisions"
              entries={plan.decisions.map((entry) => ({ action: entry.action, label: entry.title }))}
              imported={imported}
            />
            <PlanGroup
              label="Work still outstanding"
              entries={plan.tasks.map((entry) => ({ action: entry.action, label: entry.title }))}
              imported={imported}
            />
            <PlanGroup
              label="Documents"
              entries={plan.deliverables.map((entry) => ({
                action: entry.action,
                label: entry.sectionCount ? `${entry.title} (${entry.sectionCount} section${entry.sectionCount === 1 ? "" : "s"})` : entry.title,
              }))}
              imported={imported}
            />
          </div>

          {/* Only the fields being filled are listed here. A field the two records disagree on is
              already stated in full, quoting both, as one of the open questions above — saying it
              twice would read as two findings rather than one. */}
          {plan.companyFields.some((entry) => entry.action === "fill") ? (
            <div className="import-plan__fields">
              <p className="eyebrow">Taken from the launch workspace</p>
              <ul>
                {plan.companyFields
                  .filter((entry) => entry.action === "fill")
                  .map((entry) => (
                    <li key={entry.label}>
                      Formation has nothing recorded for {entry.label}, so it {imported ? "took" : "will take"} “{entry.proposed}”.
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          {plan.retiring.length ? (
            <div className="import-plan__retiring">
              <p className="eyebrow">No longer recorded over there</p>
              <ul>
                {plan.retiring.map((entry, index) => (
                  <li key={`${entry.kind}-${index}`}>{entry.label}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {advisory.length ? (
            <details className="import-plan__advisory">
              <summary>{advisory.length} thing{advisory.length === 1 ? "" : "s"} worth knowing about this record</summary>
              <ul>
                {advisory.map((entry, index) => (
                  <li key={`${entry.message}-${index}`}>{entry.message}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : selected && !busy && !problem ? (
        <EmptyState title="Nothing to show yet" description="Choose a launch workspace to see exactly what would come across." />
      ) : null}
    </Section>
  );
}

/** One group of proposed records. Says what is new, what is already here, and what needs a look. */
function PlanGroup({
  label,
  entries,
  imported,
}: {
  label: string;
  entries: Array<{ action: string; label: string }>;
  imported: boolean;
}) {
  const fresh = entries.filter((entry) => entry.action === "create" || entry.action === "update" || entry.action === "drifted");
  const already = entries.length - fresh.length;
  if (!entries.length) return null;

  return (
    <div className="import-plan__group">
      <p className="eyebrow">{label}</p>
      {fresh.length ? (
        <ul>
          {fresh.slice(0, 8).map((entry, index) => (
            <li key={`${entry.label}-${index}`}>
              <span className={`import-plan__action import-plan__action--${entry.action}`}>{actionLabels[entry.action] ?? entry.action}</span>
              {entry.label}
            </li>
          ))}
        </ul>
      ) : null}
      {fresh.length > 8 ? <p className="muted-copy">and {fresh.length - 8} more</p> : null}
      {already ? (
        <p className="muted-copy">
          {already} already {imported ? "were" : "here"} — {imported ? "left" : "will be left"} exactly as {imported ? "they were" : "they are"}.
        </p>
      ) : null}
    </div>
  );
}

const actionLabels: Record<string, string> = {
  create: "New",
  update: "Refreshed",
  drifted: "Needs a look",
};

function summarise(plan: ImportPlan): string {
  if (!plan.totals.creates && !plan.totals.updates && !plan.totals.flagged) {
    return "Nothing new — this company already has everything that launch workspace recorded.";
  }
  const parts: string[] = [];
  if (plan.totals.creates) parts.push(`${plan.totals.creates} brought in`);
  if (plan.totals.updates) parts.push(`${plan.totals.updates} refreshed`);
  if (plan.totals.flagged) parts.push(`${plan.totals.flagged} flagged for a look`);
  return `${parts.join(", ")}. Everything arrived as a draft.`;
}
