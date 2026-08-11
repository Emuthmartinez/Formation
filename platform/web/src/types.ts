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

/** What the instruction screen found in one piece of imported wording. */
export interface ScreenFinding {
  code: string;
  reason: string;
  excerpt: string;
}

/** Where a record's words came from, when they did not come from someone in this company. */
export interface RecordSource {
  kind?: string;
  sourcePath?: string | null;
  laneTitle?: string | null;
  screened?: ScreenFinding[];
  screenConfirmedAt?: string | null;
  screenConfirmedBy?: string | null;
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
  stale?: boolean;
  staleReason?: string | null;
  source?: RecordSource | null;
}

/** One thing that changed between a version and the one before it. */
export interface VersionChangeEntry {
  kind: string;
  label: string;
  detail: string;
}

export interface VersionChange {
  version: number;
  previousVersion: number | null;
  createdAt: string;
  createdBy: string;
  headline: string;
  changes: VersionChangeEntry[];
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
  /** What this version changed from the one before it. Computed from the versions themselves. */
  change?: VersionChange | null;
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
  /** Board-language one-liner: what this step gives the company. */
  summary?: string;
  /** The engine's own step name, when it differs from the board title. */
  technical?: string;
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
  /** The engine's own name for the work, when it differs from the board title. */
  technicalTitle?: string;
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

/** Whether the engine can do hands-on steps itself, said before work is requested — with the plain-language reason when it cannot. */
export interface SelfServeExecution {
  available: boolean;
  reason?: string;
}

export interface ExecutionList {
  executions: FounderExecution[];
  selfServeExecution: SelfServeExecution;
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

export interface BlockerRef {
  id: string;
  kind: "workstream" | "task" | "decision";
  label: string;
}

export interface ReadinessCategory {
  id: string;
  label: string;
  progress: number;
  status: "ready" | "blocked" | "in-progress" | "not-ready";
  blockers: string[];
  /** The same blockers, each still attached to the record that causes it. */
  blockerRefs: BlockerRef[];
}

export interface ReadinessDeduction {
  id: string;
  label: string;
  count: number;
  points: number;
}

export interface Readiness {
  score: number;
  baseScore: number;
  blockedCount: number;
  openDecisionCount: number;
  criticalTaskCount: number;
  /** The subtraction behind the score, so the number can be shown as arithmetic rather than asserted. */
  penalty: {
    applied: number;
    total: number;
    uncapped: number;
    cap: number;
    capped: boolean;
    deductions: ReadinessDeduction[];
  };
  categories: ReadinessCategory[];
  blockers: string[];
  blockerRefs: BlockerRef[];
}

/** The roles a member can hold on one company, least capable first. */
export type WorkspaceRole = "viewer" | "reviewer" | "editor" | "owner";

/** Mirrors the ids in server/domain/capabilities.mjs. The server decides who holds which. */
export type Capability =
  | "workspace-read"
  | "evidence-write"
  | "work-write"
  | "decision-write"
  | "generation-request"
  | "launch-engine-advance"
  | "company-write"
  | "approval-decide"
  | "share-manage"
  | "member-manage"
  | "launch-import"
  | "comment-write";

/** One launch workspace this server holds that a company could bring work in from. */
export interface ImportSource {
  id: string;
  updatedAt: string | null;
}

export interface ImportSourceList {
  /** False when this instance is not set up to bring in existing launch work at all. */
  configured: boolean;
  sources: ImportSource[];
}

export type ImportAction = "create" | "update" | "unchanged" | "drifted";

/**
 * What an import would do, or what it did. The same shape answers both, because the preview and
 * the apply are one computation on the server — see server/domain/imports.mjs.
 */
export interface ImportPlan {
  sourceId: string;
  company: {
    name: string;
    oneLiner: string;
    targetCustomer: string;
    stage: string;
    founderName: string;
    liveSince: string | null;
  } | null;
  totals: {
    creates: number;
    updates: number;
    unchanged: number;
    drifted: number;
    retires: number;
    companyFieldsFilled: number;
    companyFieldsDiffering: number;
    contradictions: number;
  };
  companyFields: Array<{ label: string; action: "fill" | "differs" | "same"; current: string; proposed: string }>;
  claims: Array<{ action: ImportAction; kind: string; statement: string }>;
  decisions: Array<{ action: ImportAction; title: string }>;
  tasks: Array<{ action: ImportAction; title: string }>;
  deliverables: Array<{ action: ImportAction; title: string; sectionCount: number | null }>;
  retiring: Array<{ kind: "claim" | "task"; label: string }>;
  /** Imported material whose own wording reads as an instruction to a machine. */
  heldBack: Array<{ kind: string; label: string; reason: string; excerpt: string }>;
  contradictions: Array<{ severity: "blocking" | "advisory"; message: string; sourcePath: string | null }>;
}

/** One way the record disagrees with itself, decided by looking at fields rather than at language. */
export interface Inconsistency {
  id: string;
  code: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  workstreamId: string | null;
  claimIds?: string[];
  taskIds?: string[];
  artifactId?: string;
  decisionId?: string;
}

/** What a conversation is attached to. A deliverable thread may name one of its sections. */
export interface CommentTarget {
  kind: "claim" | "decision" | "deliverable" | "workstream";
  id: string;
  sectionId?: string | null;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  mentions: string[];
  createdAt: string;
  editedAt: string | null;
  withdrawnAt: string | null;
}

export interface CommentThread {
  id: string;
  target: CommentTarget;
  resolvedAt: string | null;
  resolvedBy: string | null;
  comments: Comment[];
}

export type ReviewStatus = "requested" | "approved" | "changes-requested" | "withdrawn";

export interface ReviewRequest {
  id: string;
  target: CommentTarget;
  requestedBy: string;
  requestedByName: string;
  assigneeId: string;
  assigneeName: string;
  note: string;
  dueAt: string | null;
  status: ReviewStatus;
  answerNote: string | null;
  answeredAt: string | null;
  createdAt: string;
}

/** Who is in the company, by name. Enough to address a review or read a mention, and nothing more. */
export interface WorkspacePerson {
  userId: string;
  name: string;
  role: string;
}

export interface EconomicsFigure {
  value: number | null;
  unit: "money" | "percent" | "months" | "ratio" | "customers";
  /** Named inputs this figure is waiting for. Empty when it could be computed. */
  missing: string[];
}

export interface EconomicsScenario {
  id: string;
  name: string;
  currency: string;
  isPrimary: boolean;
  price: { amount: number | null; per: "month" | "year" | "one-time" };
  conversion: { visitorToTrial: number | null; trialToPaid: number | null };
  retention: { monthlyChurn: number | null };
  variableCostPerCustomer: number | null;
  acquisitionCost: number | null;
  capacity: { weeklyHours: number | null; monthlyOperatingCost: number | null };
  cash: { onHand: number | null; monthlyBurn: number | null };
  notes: string;
  updatedAt: string;
  lastChangedBy: string | null;
  /** Computed on read from the inputs above. Never stored — see server/domain/economics.mjs. */
  derived: {
    grossMargin: EconomicsFigure;
    monthlyContribution: EconomicsFigure;
    lifetimeMonths: EconomicsFigure;
    lifetimeValue: EconomicsFigure;
    ltvToCac: EconomicsFigure;
    paybackMonths: EconomicsFigure;
    runwayMonths: EconomicsFigure;
    customersToBreakEven: EconomicsFigure;
  };
}

export interface EconomicsView {
  currency: string;
  scenarios: EconomicsScenario[];
  sensitivity: { figure: string; base: number | null; inputs: Array<{ label: string; lower: number; higher: number; swingPercent: number | null }> } | null;
}

export interface WorkspaceSnapshot {
  workspace: Workspace;
  membership: { id: string; role: WorkspaceRole | string; userId: string; workspaceId: string };
  /** What the signed-in member may do here, as decided by the server. */
  capabilities: Capability[];
  claims: Claim[];
  decisions: Decision[];
  artifacts: Artifact[];
  artifactVersions: ArtifactVersion[];
  tasks: Task[];
  jobs: Job[];
  activity: Activity[];
  comments: CommentThread[];
  economics: EconomicsView;
  reviews: ReviewRequest[];
  people: WorkspacePerson[];
  contradictions: Contradiction[];
  inconsistencies: Inconsistency[];
  recommendations: Recommendation[];
  readiness: Readiness;
}

export interface ShareLink {
  id: string;
  scope: "deliverable" | "company";
  artifactId: string | null;
  label: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
}

export interface CreatedShare {
  share: ShareLink;
  viewPath: string;
  delivery: string;
}

/** What a link shows someone who has no account. Mirrors sharedView in domain/sharing.mjs. */
export type SharedView = {
  sharedBy: string;
  expiresAt: string;
  company: {
    name: string;
    stage: string;
    oneLiner: string;
    [field: string]: string | undefined;
  };
} & (
  | {
      scope: "deliverable";
      deliverable: {
        title: string;
        status: string;
        version: number;
        summary: string;
        updatedAt: string;
        sections: Array<{ title: string; body: string }>;
        evidence: Array<{ kind: string; statement: string }>;
      };
    }
  | {
      scope: "company";
      workstreams: Array<{ id: string; title: string; group: string; summary: string; status: string; progress: number }>;
    }
);

export interface AccountSession {
  id: string;
  device: string;
  signedInAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

export interface Member {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  role: WorkspaceRole | string;
  joinedAt: string | null;
  invitedBy: string | null;
}

export interface Invitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

export interface PeopleView {
  members: Member[];
  invitations: Invitation[];
  roles: WorkspaceRole[];
  canManage: boolean;
}

export interface CreatedInvitation {
  invitation: Invitation;
  acceptPath: string;
  delivery: string;
}

export interface InvitationPreview {
  company: string;
  role: WorkspaceRole;
  invitedBy: string;
  email: string;
  matchesYou: boolean;
  expiresAt: string;
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
