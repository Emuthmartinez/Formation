import { useMemo, useState } from "react";
import { api } from "../api";
import { useWorkspace } from "../context";
import { navigate } from "../router";
import type { Recommendation, Task } from "../types";
import { Icon } from "../components/Icon";
import {
  Button,
  EmptyState,
  PageHeader,
  ProgressLine,
  Section,
  StatusText,
  formatDate,
  timeAgo,
} from "../components/Primitives";

export function TodayPage() {
  const { snapshot, reload, notify } = useWorkspace();
  const { workspace, recommendations, readiness, tasks, decisions, contradictions, activity } = snapshot;
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);
  const primaryContradiction = contradictions[0];
  const nextTasks = useMemo(
    () => tasks.filter((task) => task.status !== "done").sort(compareTasks).slice(0, 5),
    [tasks],
  );

  const completeTask = async (task: Task) => {
    setUpdatingTask(task.id);
    try {
      await api.updateTask(workspace.id, task.id, { status: "done" });
      await reload();
      notify("Task completed. Readiness has been recalculated.");
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setUpdatingTask(null);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date())}
        title={`What moves ${workspace.name} forward now`}
        description={workspace.company.currentGoal}
      />

      <section className="today-grid" aria-label="Founder priorities">
        <div className="priority-column">
          <div className="section-kicker">
            <span>Recommended sequence</span>
            <span>{recommendations.length} moves</span>
          </div>
          {recommendations.length ? (
            <ol className="recommendation-list">
              {recommendations.map((recommendation, index) => (
                <li key={recommendation.id} className="recommendation-row">
                  <span className="recommendation-row__number">{String(index + 1).padStart(2, "0")}</span>
                  <div className="recommendation-row__body">
                    <div className="recommendation-row__meta">
                      <span>{recommendation.kind.replaceAll("-", " ")}</span>
                      <span>{recommendation.confidence}% confidence</span>
                    </div>
                    <h2>{recommendation.title}</h2>
                    <p>{recommendation.detail}</p>
                    <p className="recommendation-row__rationale">Why now: {recommendation.rationale}</p>
                  </div>
                  <button className="recommendation-row__action" onClick={() => openRecommendation(recommendation)}>
                    {recommendation.actionLabel}
                    <Icon name="arrow" width={17} height={17} />
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              title="No urgent recommendation"
              description="Formation will surface the next best move as evidence, decisions, and workstream state change."
            />
          )}
        </div>

        <aside className="readiness-rail">
          <p className="eyebrow">Launch readiness</p>
          <div className="readiness-score">
            <strong>{readiness.score}</strong>
            <span>/ 100</span>
          </div>
          <ProgressLine value={readiness.score} label="Launch readiness" />
          <p className="readiness-rail__note">
            The score discounts blocked work, unresolved critical decisions, and unfinished critical tasks. No vanity math allowed.
          </p>
          <dl className="readiness-facts">
            <div><dt>Target</dt><dd>{formatDate(workspace.launchTarget)}</dd></div>
            <div><dt>Open decisions</dt><dd>{readiness.openDecisionCount}</dd></div>
            <div><dt>Critical tasks</dt><dd>{readiness.criticalTaskCount}</dd></div>
            <div><dt>Blocked workstreams</dt><dd>{readiness.blockedCount}</dd></div>
          </dl>
          <Button variant="secondary" onClick={() => navigate("/launch")}>Review launch path</Button>
        </aside>
      </section>

      {primaryContradiction ? (
        <section className="contradiction-banner">
          <Icon name="warning" width={22} height={22} />
          <div>
            <p className="eyebrow">Source-of-truth conflict</p>
            <h2>{primaryContradiction.title}</h2>
            <p>{primaryContradiction.summary}</p>
          </div>
          <Button variant="secondary" onClick={() => navigate(`/workstreams/${primaryContradiction.workstreamIds[0] ?? "strategy"}`)}>
            Resolve conflict
          </Button>
        </section>
      ) : null}

      <div className="two-column-layout">
        <Section
          title="This week"
          description="The smallest set of work that changes a decision or removes a launch blocker."
          action={<Button variant="quiet" icon="plus" onClick={() => navigate("/workstreams")}>Add from a workstream</Button>}
        >
          <div className="task-list">
            {nextTasks.length ? nextTasks.map((task) => (
              <article key={task.id} className="task-row">
                <button
                  className="task-check"
                  onClick={() => completeTask(task)}
                  disabled={updatingTask === task.id}
                  aria-label={`Complete ${task.title}`}
                >
                  {updatingTask === task.id ? <span className="spinner" /> : null}
                </button>
                <div>
                  <h3>{task.title}</h3>
                  <p>{workspace.workstreams.find((stream) => stream.id === task.workstreamId)?.title} · {task.owner}</p>
                </div>
                <div className="task-row__meta">
                  <span className={`priority priority--${task.priority}`}>{task.priority}</span>
                  <span>{formatDate(task.dueAt, "No date")}</span>
                </div>
              </article>
            )) : <EmptyState title="The weekly queue is clear" description="Choose the next action from a workstream when you are ready to advance it." />}
          </div>
        </Section>

        <Section title="Decisions needing attention" description="Open calls that can change downstream work.">
          <div className="decision-compact-list">
            {decisions.filter((decision) => ["open", "proposed", "revisit"].includes(decision.status)).slice(0, 4).map((decision) => (
              <button key={decision.id} className="decision-compact" onClick={() => navigate(`/decisions#${decision.id}`)}>
                <div>
                  <StatusText status={decision.status} />
                  <h3>{decision.title}</h3>
                  <p>{decision.decision}</p>
                </div>
                <span>{formatDate(decision.reviewAt, "Review now")}</span>
              </button>
            ))}
          </div>
          <Button variant="quiet" onClick={() => navigate("/decisions")}>See decision log <Icon name="arrow" width={16} height={16} /></Button>
        </Section>
      </div>

      <Section title="Recent movement" description="A plain record of what changed and why it matters.">
        <div className="activity-list">
          {activity.slice(0, 6).map((entry) => (
            <article key={entry.id} className="activity-row">
              <span className="activity-row__line" />
              <div>
                <h3>{entry.title}</h3>
                <p>{entry.detail}</p>
              </div>
              <span>{entry.actor} · {timeAgo(entry.createdAt)}</span>
            </article>
          ))}
        </div>
      </Section>
    </div>
  );
}

function compareTasks(left: Task, right: Task) {
  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  return rank[left.priority] - rank[right.priority] || String(left.dueAt ?? "9999").localeCompare(String(right.dueAt ?? "9999"));
}

function openRecommendation(recommendation: Recommendation) {
  if (recommendation.kind === "decision") navigate(`/decisions#${recommendation.id.replace(/^rec_/, "")}`);
  else if (recommendation.kind === "artifact" && recommendation.artifactId) navigate(`/deliverables/${recommendation.artifactId}`);
  else navigate(`/workstreams/${recommendation.workstreamId}`);
}
