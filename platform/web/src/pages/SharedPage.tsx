import { useEffect, useState } from "react";
import { api } from "../api";
import { ErrorNotice, MarkdownBody, StatusText, formatDate, humanize } from "../components/Primitives";
import type { SharedView } from "../types";

/**
 * What someone sees when a founder sends them a link.
 *
 * They have no account and no navigation — there is nowhere else in Formation for them to go, and
 * offering them somewhere would be an invitation nobody made. The page says who shared it and when
 * it stops working, so a reader knows what they are holding.
 */
export function SharedPage({ token }: { token: string }) {
  const [view, setView] = useState<SharedView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .sharedView(token)
      .then(setView)
      .catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
  }, [token]);

  if (error) {
    return (
      <main className="shared-page">
        <div className="shared-card">
          <div className="shared-mark">F</div>
          <ErrorNotice message={error} />
        </div>
      </main>
    );
  }

  if (!view) {
    return <main className="shared-page"><div className="shared-card"><span className="spinner" /> Opening…</div></main>;
  }

  return (
    <main className="shared-page">
      <article className="shared-card">
        <header className="shared-head">
          <div className="shared-mark">F</div>
          <div>
            <p className="eyebrow">{view.company.name} · {humanize(view.company.stage)}</p>
            <p className="shared-head__note">
              Shared by {view.sharedBy}. This link stops working on {formatDate(view.expiresAt)}.
            </p>
          </div>
        </header>

        {view.scope === "deliverable" ? (
          <>
            <h1>{view.deliverable.title}</h1>
            <div className="shared-meta">
              <StatusText status={view.deliverable.status} />
              <span>Version {view.deliverable.version}</span>
              <span>Updated {formatDate(view.deliverable.updatedAt)}</span>
            </div>
            <p className="shared-summary">{view.deliverable.summary}</p>
            {view.deliverable.sections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                <MarkdownBody body={section.body} />
              </section>
            ))}
            {view.deliverable.evidence.length ? (
              <section className="shared-evidence">
                <h2>What this is based on</h2>
                <ul>
                  {view.deliverable.evidence.map((entry) => (
                    <li key={entry.statement}>
                      <span className={`claim-kind claim-kind--${entry.kind}`}>{entry.kind}</span>
                      {entry.statement}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : (
          <>
            <h1>{view.company.oneLiner}</h1>
            <p className="shared-summary">{view.company.thesis}</p>
            {COMPANY_FIELDS.map(([key, label]) => (
              <section key={key}>
                <h2>{label}</h2>
                <MarkdownBody body={String(view.company[key] ?? "")} />
              </section>
            ))}
            <section className="shared-evidence">
              <h2>Where the work stands</h2>
              <ul>
                {view.workstreams.map((stream) => (
                  <li key={stream.id}>
                    <strong>{stream.title}</strong> — {stream.summary} <em>({stream.progress}% · {humanize(stream.status)})</em>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </article>
    </main>
  );
}

const COMPANY_FIELDS: Array<[string, string]> = [
  ["targetCustomer", "Who this is for"],
  ["problem", "The problem"],
  ["solution", "The product"],
  ["positioning", "Positioning"],
  ["differentiation", "What makes it different"],
  ["businessModel", "How it makes money"],
  ["pricing", "Pricing"],
  ["northStarMetric", "What success looks like"],
  ["currentGoal", "What the company is working on now"],
];
