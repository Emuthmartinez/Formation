import { api } from "../api";
import { Button, EmptyState, PageHeader, ProgressLine, Section, StatusText, formatDate } from "../components/Primitives";
import { useWorkspace } from "../context";
import { navigate } from "../router";
import type { Task } from "../types";

export function LaunchPage() {
  const { snapshot, reload, notify } = useWorkspace();
  const { workspace, readiness } = snapshot;
  const criticalTasks = snapshot.tasks
    .filter((task) => task.status !== "done" && ["critical", "high"].includes(task.priority))
    .sort((left, right) => taskRank(left) - taskRank(right));
  const openDecisions = snapshot.decisions.filter((decision) => ["open", "proposed", "revisit"].includes(decision.status));

  const completeTask = async (task: Task) => {
    try {
      await api.updateTask(workspace.id, task.id, { status: "done" });
      await reload();
      notify("Critical path updated and readiness recalculated.");
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    }
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
          <ProgressLine value={readiness.score} />
        </div>
        <div className="launch-scoreboard__target">
          <p className="eyebrow">Target launch</p>
          <strong>{formatDate(workspace.launchTarget)}</strong>
          <p>{workspace.company.currentGoal}</p>
        </div>
        <dl className="launch-scoreboard__facts">
          <div><dt>Base progress</dt><dd>{readiness.baseScore}%</dd></div>
          <div><dt>Blocked areas</dt><dd>{readiness.blockedCount}</dd></div>
          <div><dt>Open decisions</dt><dd>{readiness.openDecisionCount}</dd></div>
          <div><dt>Critical tasks</dt><dd>{readiness.criticalTaskCount}</dd></div>
        </dl>
      </section>

      <Section title="Readiness by business outcome" description="These are not departments. Each category represents a launch question that must have a credible answer.">
        <div className="readiness-category-list">
          {readiness.categories.map((category, index) => (
            <article key={category.id} className="readiness-category">
              <span className="readiness-category__index">{String(index + 1).padStart(2, "0")}</span>
              <div className="readiness-category__body">
                <div><h3>{category.label}</h3><StatusText status={category.status} /></div>
                <ProgressLine value={category.progress} />
                {category.blockers.length ? <ul>{category.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : <p>No active blocker recorded.</p>}
              </div>
            </article>
          ))}
        </div>
      </Section>

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
