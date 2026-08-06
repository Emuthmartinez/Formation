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
  const penalty = Math.min(24, blockedStreams.length * 5 + openCriticalTasks.length * 3 + openDecisions.length * 2);
  const score = clampNumber(baseScore - penalty, 0, 100);

  const categories = READINESS_GROUPS.map((group) => {
    const members = streams.filter((stream) => group.workstreams.includes(stream.id));
    const progress = members.length
      ? Math.round(members.reduce((sum, stream) => sum + clampNumber(stream.progress, 0, 100), 0) / members.length)
      : 0;
    const blockers = [
      ...members.filter((stream) => stream.status === "blocked").map((stream) => stream.nextAction),
      ...openCriticalTasks
        .filter((task) => members.some((stream) => stream.id === task.workstreamId))
        .map((task) => task.title),
      ...openDecisions
        .filter((decision) => members.some((stream) => stream.id === decision.workstreamId))
        .map((decision) => decision.title),
    ];
    return {
      id: group.id,
      label: group.label,
      progress,
      status: blockers.length > 0 ? "blocked" : progress >= 80 ? "ready" : progress >= 55 ? "in-progress" : "not-ready",
      blockers: unique(blockers).slice(0, 3),
    };
  });

  return {
    score,
    baseScore,
    blockedCount: blockedStreams.length,
    openDecisionCount: openDecisions.length,
    criticalTaskCount: openCriticalTasks.length,
    categories,
    blockers: unique([
      ...blockedStreams.map((stream) => stream.nextAction),
      ...openCriticalTasks.map((task) => task.title),
      ...openDecisions.map((decision) => decision.title),
    ]).slice(0, 8),
  };
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
      claimIds: entries.map((entry) => entry.id),
      workstreamIds: unique(entries.map((entry) => entry.workstreamId).filter(Boolean)),
    });
  }

  return contradictions;
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
      detail: `Due ${criticalTasks[0].dueAt ?? "soon"}. Owner: ${criticalTasks[0].owner}.`,
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

export function buildWorkspaceSnapshot(database, workspaceId, userId) {
  const membership = database.memberships.find(
    (entry) => entry.userId === userId && entry.workspaceId === workspaceId,
  );
  if (!membership) return null;

  const workspace = database.workspaces.find((entry) => entry.id === workspaceId);
  if (!workspace) return null;

  const claims = database.claims.filter((entry) => entry.workspaceId === workspaceId);
  const decisions = database.decisions.filter((entry) => entry.workspaceId === workspaceId);
  const artifacts = database.artifacts.filter((entry) => entry.workspaceId === workspaceId);
  const artifactVersions = database.artifactVersions
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt));
  const tasks = database.tasks.filter((entry) => entry.workspaceId === workspaceId);
  const jobs = database.jobs.filter((entry) => entry.workspaceId === workspaceId);
  const activity = database.activity
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    workspace,
    membership,
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

