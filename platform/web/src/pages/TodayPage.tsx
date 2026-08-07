import { useMemo, useState } from "react";
import { api } from "../api";
import { runMutation, useWorkspace } from "../context";
import { navigate } from "../router";
import type { Activity, Recommendation, Task } from "../types";
import { Icon } from "../components/Icon";
import { Motif } from "../components/Motif";
import { ReadinessLedger } from "../components/Readiness";
import {
  Button,
  ConfidenceMark,
  DateSignal,
  EmptyState,
  ContradictionStatements,
  PageHeader,
  Priority,
  ProgressLine,
  Section,
  StatusText,
  Tally,
  humanize,
  statusTone,
  timeAgo,
  type Tone,
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
  // Where the eight bodies of work actually stand. The founder would otherwise have to open
  // Workstreams and count rows to learn this.
  const workstreamTally = useMemo(() => {
    const counts = new Map<string, number>();
    for (const stream of workspace.workstreams) counts.set(stream.status, (counts.get(stream.status) ?? 0) + 1);
    return ["blocked", "needs-attention", "on-track", "complete", "not-started"]
      .map((status) => ({ id: status, label: humanize(status).toLowerCase(), count: counts.get(status) ?? 0, tone: statusTone(status) }));
  }, [workspace.workstreams]);

  const completeTask = async (task: Task) => {
    setUpdatingTask(task.id);
    try {
      await runMutation(
        { reload, notify },
        () => api.updateTask(workspace.id, task.id, { status: "done" }),
        "Task completed. Readiness has been recalculated.",
      );
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
                      {/* Which body of work this move belongs to — the row named the type and the
                          confidence but never the part of the company it would change. */}
                      <span>{workspace.workstreams.find((stream) => stream.id === recommendation.workstreamId)?.title}</span>
                      <ConfidenceMark value={recommendation.confidence} />
                    </div>
                    <h2>{recommendation.title}</h2>
                    {recommendation.kind === "resolve-contradiction" ? (
                      <ContradictionStatements
                        entries={contradictions.find((entry) => `rec_${entry.id}` === recommendation.id)?.entries}
                        fallback={recommendation.detail}
                      />
                    ) : (
                      <p>{recommendation.detail}</p>
                    )}
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
          {/* The rule runs the full height of the band so the column reads as deliberate;
              only the instrument inside it is sticky. */}
          <div className="readiness-rail__inner">
          <Motif />
          <p className="eyebrow">Launch readiness</p>
          <div className="readiness-score">
            <strong>{readiness.score}</strong>
            <span>/ 100</span>
          </div>
          <div className="score-rule">
            <ProgressLine
              value={readiness.score}
              label="Launch readiness"
              hideValue
              tone={readiness.score >= 70 ? "positive" : readiness.score >= 40 ? "caution" : "critical"}
            />
          </div>

          <ReadinessLedger readiness={readiness} />

          <div className="readiness-rail__target">
            <span className="eyebrow">Target launch</span>
            {/* The countdown to launch is the point of this date, so it keeps a long horizon. */}
            <DateSignal value={workspace.launchTarget} fallback="No target set" horizonDays={365} />
          </div>

          <div className="readiness-rail__tally">
            <span className="eyebrow">Where the work stands</span>
            <Tally items={workstreamTally} />
          </div>

          <Button variant="secondary" onClick={() => navigate("/launch")}>Review launch path</Button>
          </div>
        </aside>
      </section>

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
                  <Priority value={task.priority} />
                  <DateSignal value={task.dueAt} />
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
                <DateSignal value={decision.reviewAt} fallback="Review now" />
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
              <span className={`activity-row__line tone-${activityTone(entry)}`} />
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

/**
 * What kind of movement an activity entry records. Every marker used to be forest green, so a
 * failed work session and a resolved contradiction looked like equal progress.
 *
 * The decline check is a case-insensitive substring on purpose: the two code paths that record
 * a decline title it differently ("Declined: …" and "Approval declined: …").
 */
function activityTone(entry: Activity): Tone {
  if (entry.type.includes("failed") || entry.type === "contradiction" || /declined/i.test(entry.title)) return "critical";
  if (entry.type.includes("requested") || entry.type.includes("queued")) return "caution";
  return "positive";
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
