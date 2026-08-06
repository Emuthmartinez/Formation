import { useEffect, useState } from "react";
import { api } from "../api";
import { Button, EmptyState, PageHeader, ProgressLine, Section, StatusText, TechnicalDisclosure, formatCount, formatDate, timeAgo } from "../components/Primitives";
import { Motif } from "../components/Motif";
import { runMutation, useWorkspace } from "../context";
import { navigate } from "../router";
import type { FounderExecution, Task } from "../types";

export function LaunchPage() {
  const { snapshot, reload, notify } = useWorkspace();
  const { workspace, readiness } = snapshot;
  const criticalTasks = snapshot.tasks
    .filter((task) => task.status !== "done" && ["critical", "high"].includes(task.priority))
    .sort((left, right) => taskRank(left) - taskRank(right));
  const openDecisions = snapshot.decisions.filter((decision) => ["open", "proposed", "revisit"].includes(decision.status));

  const completeTask = async (task: Task) => {
    await runMutation(
      { reload, notify },
      () => api.updateTask(workspace.id, task.id, { status: "done" }),
      "Critical path updated and readiness recalculated.",
    );
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Launch readiness"
        title={`${workspace.name} is ${readiness.score}% ready for the current launch definition`}
        description="Readiness is an opinionated decision aid. It combines workstream progress with explicit penalties for blockers, critical tasks, and unresolved decisions."
      />

      <section className="launch-scoreboard">
        <div className="launch-scoreboard__score">
          <p className="eyebrow">Readiness score</p>
          <strong>{readiness.score}</strong>
          <div className="score-rule">
            <ProgressLine value={readiness.score} label="Readiness score" hideValue />
            <span className="score-rule__annotation">{readiness.score} / 100</span>
          </div>
        </div>
        <div className="launch-scoreboard__target">
          <p className="eyebrow">Target launch</p>
          <strong>{formatDate(workspace.launchTarget)}</strong>
          <p>{workspace.company.currentGoal}</p>
        </div>
        <dl className="launch-scoreboard__facts">
          <div><dt>Base progress</dt><dd>{readiness.baseScore}%</dd></div>
          <div><dt>Blocked areas</dt><dd>{formatCount(readiness.blockedCount)}</dd></div>
          <div><dt>Open decisions</dt><dd>{formatCount(readiness.openDecisionCount)}</dd></div>
          <div><dt>Critical tasks</dt><dd>{formatCount(readiness.criticalTaskCount)}</dd></div>
        </dl>
      </section>

      <Section title="Readiness by business outcome" description="These are not departments. Each category represents a launch question that must have a credible answer.">
        <div className="readiness-category-list">
          {readiness.categories.map((category, index) => (
            <article key={category.id} className="readiness-category">
              <span className="readiness-category__index">{String(index + 1).padStart(2, "0")}</span>
              <div className="readiness-category__body">
                <div><h3>{category.label}</h3><StatusText status={category.status} /></div>
                <ProgressLine value={category.progress} label={`${category.label} progress`} />
                {category.blockers.length ? <ul>{category.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : <p>No active blocker recorded.</p>}
              </div>
            </article>
          ))}
        </div>
      </Section>

      <EngineWorkSection workspaceId={workspace.id} workspaceName={workspace.name} />

      <div className="two-column-layout">
        <Section title="Critical path" description="Work that materially changes whether this launch is responsible and decision-grade.">
          <div className="critical-path-list">
            {criticalTasks.length ? criticalTasks.map((task, index) => (
              <article key={task.id} className="critical-path-row">
                <span>{index + 1}</span>
                <div>
                  <p className="eyebrow">{workspace.workstreams.find((stream) => stream.id === task.workstreamId)?.title}</p>
                  <h3>{task.title}</h3>
                  <p>{task.owner} · {formatDate(task.dueAt, "No due date")}</p>
                </div>
                <Button variant="quiet" onClick={() => completeTask(task)}>Mark complete</Button>
              </article>
            )) : <EmptyState title="No unfinished critical work" description="The remaining path contains no task currently marked critical or high priority." />}
          </div>
        </Section>

        <Section title="Calls before launch" description="A launch date is not a substitute for these decisions.">
          <div className="launch-decision-list">
            {openDecisions.length ? openDecisions.map((decision) => (
              <button key={decision.id} onClick={() => navigate(`/decisions#${decision.id}`)}>
                <StatusText status={decision.status} />
                <h3>{decision.title}</h3>
                <p>{decision.decision}</p>
                <span>Review {formatDate(decision.reviewAt, "now")}</span>
              </button>
            )) : <EmptyState title="No unresolved launch decisions" description="All currently recorded decisions have been accepted or superseded." />}
          </div>
        </Section>
      </div>

      {readiness.blockers.length ? (
        <Section title="What prevents a clean launch claim" description="Formation will not call the company launch-ready while these remain unresolved.">
          <ol className="blocker-ledger">
            {readiness.blockers.map((blocker, index) => <li key={blocker}><span>{String(index + 1).padStart(2, "0")}</span><p>{blocker}</p></li>)}
          </ol>
        </Section>
      ) : null}

      <section className="launch-definition">
        <Motif />
        <div>
          <p className="eyebrow">Launch definition</p>
          <h2>A launch is ready when the team can explain the customer, offer, evidence, economics, distribution, risks, and execution plan without contradicting itself.</h2>
        </div>
        <Button variant="secondary" onClick={() => navigate("/deliverables")}>Review launch deliverables</Button>
      </section>
    </div>
  );
}

function taskRank(task: Task) {
  const priority = { critical: 0, high: 1, medium: 2, low: 3 }[task.priority];
  const status = { blocked: 0, "in-progress": 1, next: 2, backlog: 3, done: 4 }[task.status];
  return priority * 10 + status;
}

// The engine's step statuses, said the way a founder would say them.
const engineStepLabels: Record<string, string> = {
  finished: "Done",
  "in-progress": "In motion",
  ready: "Ready to run",
  "needs-founder": "Waiting on you",
  held: "Needs your go-ahead",
  failed: "Did not go through",
  upcoming: "Queued",
};

const engineSessionLabels: Record<string, string> = {
  queued: "Queued",
  running: "Working now",
  completed: "Session complete",
  failed: "Stopped",
};

/**
 * What the launch engine is actually doing for this company, step by step. The engine reports
 * only settled, verified work across the boundary; this section makes that work visible so a
 * founder can follow what is happening and why — without graph or agent vocabulary.
 */
function EngineWorkSection({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) {
  const [executions, setExecutions] = useState<FounderExecution[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const load = async () => {
      try {
        const list = await api.listExecutions(workspaceId);
        if (cancelled) return;
        setExecutions(list);
        setFailed(false);
        // While a session is live, keep the picture current without asking the founder to refresh.
        if (list.some((entry) => entry.status === "queued" || entry.status === "running")) {
          timer = window.setTimeout(load, 12_000);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [workspaceId]);

  const latest = executions?.[0] ?? null;
  const earlier = executions && executions.length > 1 ? executions.slice(1, 4) : [];

  return (
    <Section
      title="The launch engine at work"
      description="Formation can execute launch work for this company. Every result is verified before it enters your workspace, and the consequential calls always come back to you."
    >
      {failed ? (
        <p className="muted-copy">Could not check on launch-engine work just now. What you see below may be behind.</p>
      ) : null}

      {latest ? (
        <article className="engine-session">
          <header className="engine-session__head">
            <div>
              <StatusText status={latest.status} />
              <h3>{latest.title ?? "Launch work session"}</h3>
              {latest.report?.headline ? <p className="engine-session__headline">{latest.report.headline}</p> : null}
            </div>
            <div className="engine-session__meta">
              <span>{engineSessionLabels[latest.status] ?? latest.status}</span>
              <span>{latest.lastSessionAt ? `Last session ${timeAgo(latest.lastSessionAt)}` : `Requested ${timeAgo(latest.createdAt)}`}</span>
              {latest.importedResults && latest.importedResults.verifiedResults > 0 ? (
                <span className="engine-session__imported">
                  {latest.importedResults.verifiedResults} verified result{latest.importedResults.verifiedResults === 1 ? "" : "s"} imported
                </span>
              ) : null}
            </div>
          </header>

          {latest.report?.steps.length ? (
            <>
              <ol className="engine-steps">
                {latest.report.steps.map((step) => (
                  <li key={step.workflowId} className={`engine-step engine-step--${step.status}`}>
                    <span className="engine-step__marker" aria-hidden="true" />
                    <div>
                      <p className="engine-step__title">{step.title}</p>
                      {step.reason ? <p className="engine-step__reason">{step.reason}</p> : step.summary ? <p className="engine-step__reason">{step.summary}</p> : null}
                    </div>
                    <span className="engine-step__status">{engineStepLabels[step.status] ?? step.status}</span>
                  </li>
                ))}
              </ol>
              {latest.report.steps.some((step) => step.technical) ? (
                <TechnicalDisclosure label="Technical detail — the team’s own step names">
                  <ul>
                    {latest.report.steps.filter((step) => step.technical).map((step) => (
                      <li key={step.workflowId}><strong>{step.title}</strong> — {step.technical}</li>
                    ))}
                  </ul>
                </TechnicalDisclosure>
              ) : null}
            </>
          ) : null}

          {latest.error ? <p className="engine-session__note">{latest.error}</p> : null}
          {latest.notes.length ? <p className="engine-session__note">{latest.notes[latest.notes.length - 1]}</p> : null}
          {latest.report?.counts.waitingOnFounder ? (
            <Button variant="secondary" onClick={() => navigate("/decisions")}>Review what is waiting on you</Button>
          ) : null}

          {earlier.length ? (
            <div className="engine-session__earlier">
              <p className="eyebrow">Earlier sessions</p>
              {earlier.map((entry) => (
                <p key={entry.id} className="muted-copy">
                  {entry.title ?? "Launch work session"} · {engineSessionLabels[entry.status] ?? entry.status} · {formatDate(entry.completedAt ?? entry.updatedAt)}
                </p>
              ))}
            </div>
          ) : null}
        </article>
      ) : (
        <div className="engine-explainer">
          <ol className="engine-explainer__flow">
            <li>
              <span aria-hidden="true">1</span>
              <h3>You set the context</h3>
              <p>The business source of truth — customer, offer, constraints — is the brief for every piece of work.</p>
            </li>
            <li>
              <span aria-hidden="true">2</span>
              <h3>The engine does the work</h3>
              <p>Launch steps run as real work sessions: research, drafts, checks — not chat answers.</p>
            </li>
            <li>
              <span aria-hidden="true">3</span>
              <h3>Results are verified first</h3>
              <p>Only work that passes verification enters {workspaceName} — as recommendations and drafts, never as silent facts.</p>
            </li>
            <li>
              <span aria-hidden="true">4</span>
              <h3>You make the calls</h3>
              <p>Consequential steps park as decisions for you. Nothing ships on your behalf without your answer.</p>
            </li>
          </ol>
          <p className="muted-copy">When a work session runs for {workspaceName}, it appears here — every step, its state, and what it produced.</p>
        </div>
      )}
    </Section>
  );
}
