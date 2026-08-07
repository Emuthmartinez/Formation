import { capabilitiesForRole, hasCapability, resolveAccess } from "./capabilities.mjs";
import { clampNumber, humanizeKey, priorityRank, slug, stableValue, unique } from "./shared.mjs";

const READINESS_WEIGHTS = {
  strategy: 1.1,
  customer: 1.2,
  market: 0.8,
  product: 1.25,
  "business-model": 1.2,
  brand: 0.65,
  "go-to-market": 1.05,
  launch: 1.25,
};

/**
 * What a readiness score is docked for, and by how much. These live here rather than in the
 * web app so the founder-facing subtraction is rendered from the same numbers that produced
 * the score — a client-side copy of these weights would drift the moment one of them changes.
 */
const PENALTY_RULES = [
  { id: "blocked", label: "Blocked workstreams", pointsEach: 5 },
  { id: "critical-tasks", label: "Unfinished critical tasks", pointsEach: 3 },
  { id: "open-decisions", label: "Unresolved decisions", pointsEach: 2 },
];
const PENALTY_CAP = 24;

const READINESS_GROUPS = [
  { id: "foundation", label: "Business foundation", workstreams: ["strategy", "customer", "market"] },
  { id: "offer", label: "Product and economics", workstreams: ["product", "business-model"] },
  { id: "expression", label: "Brand and positioning", workstreams: ["brand"] },
  { id: "distribution", label: "Go-to-market", workstreams: ["go-to-market"] },
  { id: "launch", label: "Launch execution", workstreams: ["launch"] },
];

export function calculateReadiness(workspace, tasks = [], decisions = []) {
  const streams = workspace.workstreams ?? [];
  let weightedProgress = 0;
  let totalWeight = 0;

  for (const stream of streams) {
    const weight = READINESS_WEIGHTS[stream.id] ?? 1;
    weightedProgress += clampNumber(stream.progress, 0, 100) * weight;
    totalWeight += weight;
  }

  const openCriticalTasks = tasks.filter(
    (task) => task.workspaceId === workspace.id && task.priority === "critical" && task.status !== "done",
  );
  const openDecisions = decisions.filter(
    (decision) => decision.workspaceId === workspace.id && ["open", "proposed", "revisit"].includes(decision.status),
  );
  const blockedStreams = streams.filter((stream) => stream.status === "blocked");

  const baseScore = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
  const penaltyCounts = {
    blocked: blockedStreams.length,
    "critical-tasks": openCriticalTasks.length,
    "open-decisions": openDecisions.length,
  };
  const deductions = PENALTY_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    count: penaltyCounts[rule.id] ?? 0,
    points: (penaltyCounts[rule.id] ?? 0) * rule.pointsEach,
  }));
  const uncappedPenalty = deductions.reduce((sum, entry) => sum + entry.points, 0);
  const penalty = Math.min(PENALTY_CAP, uncappedPenalty);
  const score = clampNumber(baseScore - penalty, 0, 100);

  const categories = READINESS_GROUPS.map((group) => {
    const members = streams.filter((stream) => group.workstreams.includes(stream.id));
    const progress = members.length
      ? Math.round(members.reduce((sum, stream) => sum + clampNumber(stream.progress, 0, 100), 0) / members.length)
      : 0;
    const refs = [
      ...members.filter((stream) => stream.status === "blocked").map(blockerRef("workstream", "nextAction")),
      ...openCriticalTasks
        .filter((task) => members.some((stream) => stream.id === task.workstreamId))
        .map(blockerRef("task", "title")),
      ...openDecisions
        .filter((decision) => members.some((stream) => stream.id === decision.workstreamId))
        .map(blockerRef("decision", "title")),
    ];
    const blockers = refs.map((ref) => ref.label);
    return {
      id: group.id,
      label: group.label,
      progress,
      status: blockers.length > 0 ? "blocked" : progress >= 80 ? "ready" : progress >= 55 ? "in-progress" : "not-ready",
      blockers: unique(blockers).slice(0, 3),
      // The same blockers, each still attached to the record that causes it, so a founder can
      // get from "what is in the way" to the task or call itself. `blockers` stays a plain
      // string list — it is what the founder-facing prose reads from.
      blockerRefs: uniqueRefs(refs).slice(0, 3),
    };
  });

  return {
    score,
    baseScore,
    blockedCount: blockedStreams.length,
    openDecisionCount: openDecisions.length,
    criticalTaskCount: openCriticalTasks.length,
    // `applied` is the deduction the founder can actually see in the arithmetic: base minus
    // score. It differs from `penalty` only when the score floors at zero, and showing it
    // keeps the displayed subtraction reconcilable in every case.
    penalty: {
      applied: baseScore - score,
      total: penalty,
      uncapped: uncappedPenalty,
      cap: PENALTY_CAP,
      capped: uncappedPenalty > PENALTY_CAP,
      deductions,
    },
    categories,
    blockers: unique([
      ...blockedStreams.map((stream) => stream.nextAction),
      ...openCriticalTasks.map((task) => task.title),
      ...openDecisions.map((decision) => decision.title),
    ]).slice(0, 8),
    blockerRefs: uniqueRefs([
      ...blockedStreams.map(blockerRef("workstream", "nextAction")),
      ...openCriticalTasks.map(blockerRef("task", "title")),
      ...openDecisions.map(blockerRef("decision", "title")),
    ]).slice(0, 8),
  };
}

/** One blocker, still carrying the record it came from. */
function blockerRef(kind, labelField) {
  return (entry) => ({ id: entry.id, kind, label: entry[labelField] });
}

/** Deduplicate on the founder-visible label, matching how `blockers` is deduplicated. */
function uniqueRefs(refs) {
  const seen = new Set();
  return refs.filter((ref) => (seen.has(ref.label) ? false : seen.add(ref.label)));
}

export function detectContradictions(claims) {
  const active = claims.filter((claim) => claim.status === "active" && claim.key && claim.value !== null && claim.value !== undefined);
  const byKey = new Map();

  for (const claim of active) {
    const entries = byKey.get(claim.key) ?? [];
    entries.push(claim);
    byKey.set(claim.key, entries);
  }

  const contradictions = [];
  for (const [key, entries] of byKey) {
    const distinct = new Map(entries.map((entry) => [stableValue(entry.value), entry]));
    if (distinct.size < 2) continue;
    contradictions.push({
      id: `ctr_${slug(key)}`,
      key,
      severity: entries.some((entry) => entry.kind === "fact") ? "high" : "medium",
      title: humanizeKey(key),
      summary: entries.map((entry) => entry.statement).join(" / "),
      // Each conflicting claim stays individually attributable so a founder can see which
      // statement is which kind and retire the right one, instead of parsing a joined sentence.
      entries: entries.map((entry) => ({
        claimId: entry.id,
        kind: entry.kind,
        workstreamId: entry.workstreamId ?? null,
        statement: entry.statement,
      })),
      claimIds: entries.map((entry) => entry.id),
      workstreamIds: unique(entries.map((entry) => entry.workstreamId).filter(Boolean)),
    });
  }

  return contradictions;
}

// Matches the client's formatDate style ("Aug 12, 2026") so server-composed prose never
// drifts from the dates rendered around it.
function formatFounderDate(value) {
  if (!value) return "soon";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "soon";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function buildRecommendations({ workspace, tasks, decisions, claims, artifacts }) {
  const openDecisions = decisions
    .filter((decision) => decision.workspaceId === workspace.id && ["open", "proposed", "revisit"].includes(decision.status))
    .sort((a, b) => String(a.reviewAt ?? "9999").localeCompare(String(b.reviewAt ?? "9999")));
  const criticalTasks = tasks
    .filter((task) => task.workspaceId === workspace.id && task.status !== "done")
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  const contradictions = detectContradictions(claims.filter((claim) => claim.workspaceId === workspace.id));
  const recommendations = [];

  if (contradictions[0]) {
    recommendations.push({
      id: `rec_${contradictions[0].id}`,
      kind: "resolve-contradiction",
      title: `Resolve ${contradictions[0].title.toLowerCase()}`,
      detail: contradictions[0].summary,
      rationale: "Contradictory assumptions create inconsistent artifacts and waste downstream work.",
      confidence: 92,
      workstreamId: contradictions[0].workstreamIds[0] ?? "strategy",
      actionLabel: "Review evidence",
    });
  }

  if (openDecisions[0]) {
    recommendations.push({
      id: `rec_${openDecisions[0].id}`,
      kind: "decision",
      title: openDecisions[0].title,
      detail: openDecisions[0].decision,
      rationale: openDecisions[0].rationale,
      confidence: 84,
      workstreamId: openDecisions[0].workstreamId,
      actionLabel: "Make the call",
    });
  }

  if (criticalTasks[0]) {
    recommendations.push({
      id: `rec_${criticalTasks[0].id}`,
      kind: "task",
      title: criticalTasks[0].title,
      detail: `Due ${formatFounderDate(criticalTasks[0].dueAt)}. Owner: ${criticalTasks[0].owner}.`,
      rationale: "This is the highest-impact unfinished task currently blocking launch confidence.",
      confidence: 80,
      workstreamId: criticalTasks[0].workstreamId,
      actionLabel: "Open workstream",
    });
  }

  const staleArtifact = artifacts
    .filter((artifact) => artifact.workspaceId === workspace.id && artifact.status === "draft")
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[0];
  if (staleArtifact) {
    recommendations.push({
      id: `rec_${staleArtifact.id}`,
      kind: "artifact",
      title: `Finish ${staleArtifact.title.toLowerCase()}`,
      detail: staleArtifact.summary,
      rationale: "The current draft is already referenced by downstream work and should become a reviewed source of truth.",
      confidence: 72,
      workstreamId: staleArtifact.workstreamId,
      artifactId: staleArtifact.id,
      actionLabel: "Edit deliverable",
    });
  }

  return recommendations.slice(0, 4);
}

/**
 * Activity that names a person who is not a member. Anything added here is hidden from members who
 * cannot manage access — the list exists so a new sensitive event is a deliberate decision about
 * who may read it, rather than an unnoticed second path to something withheld elsewhere.
 */
const INVITATION_ACTIVITY = new Set(["member-invited", "member-invite-revoked"]);

export function buildWorkspaceSnapshot(database, workspaceId, userId) {
  const access = resolveAccess(database, workspaceId, userId, "workspace-read");
  if (!access.found || !access.allowed) return null;
  const { membership, workspace } = access;

  const claims = database.claims.filter((entry) => entry.workspaceId === workspaceId);
  const decisions = database.decisions.filter((entry) => entry.workspaceId === workspaceId);
  const artifacts = database.artifacts.filter((entry) => entry.workspaceId === workspaceId);
  const artifactVersions = database.artifactVersions
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt));
  const tasks = database.tasks.filter((entry) => entry.workspaceId === workspaceId);
  const jobs = database.jobs.filter((entry) => entry.workspaceId === workspaceId);
  // An invitation names someone who is not in the company yet, so it is the owner's to see —
  // the members list withholds it from everyone else and the history has to agree. Once someone
  // has actually joined, their name is on the members list anyway and their arrival is company
  // history like any other.
  const canSeeInvitations = hasCapability(membership.role, "member-manage");
  const activity = database.activity
    .filter((entry) => entry.workspaceId === workspaceId)
    .filter((entry) => canSeeInvitations || !INVITATION_ACTIVITY.has(entry.type))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    workspace,
    membership,
    // What this member may do, derived from the same ladder the server enforces with. The web app
    // reads this rather than keeping its own copy of the rules — a second copy would go stale the
    // first time a capability moved, and it would go stale silently.
    capabilities: capabilitiesForRole(membership.role),
    claims,
    decisions,
    artifacts,
    artifactVersions,
    tasks,
    jobs,
    activity,
    contradictions: detectContradictions(claims),
    recommendations: buildRecommendations({ workspace, tasks, decisions, claims, artifacts }),
    readiness: calculateReadiness(workspace, tasks, decisions),
  };
}

