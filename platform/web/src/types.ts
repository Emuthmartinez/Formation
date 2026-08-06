export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface PublicConfig {
  product: string;
  demoAuthEnabled: boolean;
  registrationEnabled: boolean;
}

export interface WorkspaceSummary {
  id: string;
  slug: string;
  name: string;
  stage: string;
  launchTarget: string | null;
  role?: string;
  oneLiner?: string;
  updatedAt: string;
}

export interface SessionPayload {
  user: User;
  workspaces: WorkspaceSummary[];
}

export type WorkstreamStatus = "not-started" | "on-track" | "needs-attention" | "blocked" | "complete";

export interface Workstream {
  id: string;
  title: string;
  group: string;
  summary: string;
  status: WorkstreamStatus;
  progress: number;
  confidence: number;
  nextAction: string;
  rationale: string;
  facts: string[];
  assumptions: string[];
  questions: string[];
  deliverableIds: string[];
}

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  stage: string;
  launchTarget: string | null;
  createdAt: string;
  updatedAt: string;
  founder: {
    name: string;
    role: string;
    operatingMode: string;
    weeklyHours: number;
  };
  company: {
    oneLiner: string;
    thesis: string;
    targetCustomer: string;
    problem: string;
    solution: string;
    positioning: string;
    differentiation: string;
    businessModel: string;
    pricing: string;
    northStarMetric: string;
    currentGoal: string;
    constraints: string[];
  };
  workstreams: Workstream[];
}

export interface Claim {
  id: string;
  workspaceId: string;
  workstreamId: string;
  kind: "fact" | "assumption" | "recommendation" | "question";
  key: string | null;
  statement: string;
  value: unknown;
  confidence: number;
  status: string;
  evidence: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Decision {
  id: string;
  workspaceId: string;
  workstreamId: string;
  title: string;
  decision: string;
  rationale: string;
  status: "open" | "proposed" | "decided" | "revisit" | "superseded";
  owner: string;
  decidedAt: string | null;
  reviewAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on decisions mirrored from the launch engine's founder approvals. */
  source?: {
    kind: "engine-approval";
    approvalId: string;
    workflowId: string;
    workflowTitle: string;
    description: string;
    category: string | null;
    runId: string | null;
    planId: string | null;
  };
  answer?: {
    value: "approved" | "declined";
    answeredBy: string;
    answeredAt: string;
    reason: string | null;
    recordedVia: "formation" | "engine";
  } | null;
  /** Set when a mirrored approval was retired without an answer (the launch plan moved on). */
  note?: string;
}

export interface ApprovalsView {
  connected: boolean;
  reachable: boolean;
  ready?: boolean;
  checkedAt?: string;
  operatingMode: string | null;
  reason?: string;
  approvals: Decision[];
}

export interface ArtifactSection {
  id: string;
  title: string;
  body: string;
}

export interface Artifact {
  id: string;
  workspaceId: string;
  workstreamId: string;
  type: string;
  title: string;
  status: "draft" | "reviewed" | "approved" | "superseded";
  version: number;
  confidence: number;
  summary: string;
  sections: ArtifactSection[];
  sourceClaimIds: string[];
  linkedDecisionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactVersion {
  id: string;
  artifactId: string;
  workspaceId: string;
  workstreamId: string;
  version: number;
  title: string;
  status: Artifact["status"];
  confidence: number;
  summary: string;
  sections: ArtifactSection[];
  sourceClaimIds: string[];
  linkedDecisionIds: string[];
  createdAt: string;
  createdBy: string;
}

export interface Task {
  id: string;
  workspaceId: string;
  workstreamId: string;
  title: string;
  status: "backlog" | "next" | "in-progress" | "blocked" | "done";
  priority: "critical" | "high" | "medium" | "low";
  owner: string;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  workspaceId: string;
  workstreamId: string;
  artifactType: string | null;
  instruction: string;
  requestedBy: string;
  status: "queued" | "processing" | "completed" | "failed";
  artifactId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface Activity {
  id: string;
  workspaceId: string;
  type: string;
  title: string;
  detail: string;
  actor: string;
  createdAt: string;
}

export interface ContradictionEntry {
  claimId: string;
  kind: Claim["kind"];
  workstreamId: string | null;
  statement: string;
}

export interface Contradiction {
  id: string;
  key: string;
  severity: "high" | "medium";
  title: string;
  summary: string;
  entries: ContradictionEntry[];
  claimIds: string[];
  workstreamIds: string[];
}

export interface ExecutionRunStep {
  workflowId: string;
  title: string;
  status: "finished" | "ready" | "in-progress" | "needs-founder" | "held" | "failed" | "upcoming" | string;
  reason?: string;
}

export interface ExecutionRunView {
  generatedAt: string;
  runStarted: boolean;
  autonomyUnset: boolean;
  headline: string;
  counts: {
    total: number;
    finished: number;
    ready: number;
    inProgress: number;
    waitingOnFounder: number;
    held: number;
    failed: number;
    upcoming: number;
  };
  steps: ExecutionRunStep[];
}

export interface FounderExecution {
  id: string;
  workflowId: string | null;
  title: string | null;
  status: "queued" | "running" | "completed" | "failed" | string;
  failureKind: string | null;
  error: string | null;
  notes: string[];
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  sessionCount: number;
  lastSessionAt: string | null;
  report: ExecutionRunView | null;
  importedResults: { verifiedResults: number } | null;
}

export interface Recommendation {
  id: string;
  kind: string;
  title: string;
  detail: string;
  rationale: string;
  confidence: number;
  workstreamId: string;
  artifactId?: string;
  actionLabel: string;
}

export interface ReadinessCategory {
  id: string;
  label: string;
  progress: number;
  status: "ready" | "blocked" | "in-progress" | "not-ready";
  blockers: string[];
}

export interface Readiness {
  score: number;
  baseScore: number;
  blockedCount: number;
  openDecisionCount: number;
  criticalTaskCount: number;
  categories: ReadinessCategory[];
  blockers: string[];
}

export interface WorkspaceSnapshot {
  workspace: Workspace;
  membership: { id: string; role: string; userId: string; workspaceId: string };
  claims: Claim[];
  decisions: Decision[];
  artifacts: Artifact[];
  artifactVersions: ArtifactVersion[];
  tasks: Task[];
  jobs: Job[];
  activity: Activity[];
  contradictions: Contradiction[];
  recommendations: Recommendation[];
  readiness: Readiness;
}

export interface WorkspaceBrief {
  name: string;
  founderName: string;
  founderRole?: string;
  oneLiner: string;
  targetCustomer: string;
  problem: string;
  solution: string;
  currentGoal: string;
  launchTarget?: string;
  positioning?: string;
  differentiation?: string;
  businessModel?: string;
  pricing?: string;
  northStarMetric?: string;
  weeklyHours?: number;
  constraints?: string[];
}
