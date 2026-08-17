/**
 * The single status vocabulary shared by business-state lanes and engine run nodes
 * (KTD6: "the lane-status/RunNodeStatus split dies"). Keep in sync with
 * core/schema/status.schema.json's $defs/status enum.
 */
export type Status =
  | "pending"
  | "ready"
  | "running"
  | "waiting_founder"
  | "blocked"
  | "orphaned"
  | "needs_readback"
  | "succeeded"
  | "failed"
  | "stale"
  | "skipped"
  | "not_needed"
  | "deferred"
  | "cancelled";

export const statusValues: readonly Status[] = [
  "pending",
  "ready",
  "running",
  "waiting_founder",
  "blocked",
  "orphaned",
  "needs_readback",
  "succeeded",
  "failed",
  "stale",
  "skipped",
  "not_needed",
  "deferred",
  "cancelled",
];

/** v1 business-state lane status (tooling/lib/launch-state.ts statusValues). */
export type V1LaneStatus = "not_started" | "partial" | "blocked" | "not_needed" | "deferred" | "done";

export const v1LaneStatusValues: readonly V1LaneStatus[] = ["not_started", "partial", "blocked", "not_needed", "deferred", "done"];

/**
 * v1 run-node status, inlined (runtime/graph/execution.ts's RunNodeStatus literal union —
 * that module is deleted at cutover, U11; KTD11 "dead engine code superseded by v2").
 */
export type V1RunNodeStatus = "pending" | "ready" | "running" | "waiting_human" | "blocked" | "succeeded" | "failed" | "skipped" | "cancelled" | "stale";

export const v1RunNodeStatusValues: readonly V1RunNodeStatus[] = [
  "pending",
  "ready",
  "running",
  "waiting_human",
  "blocked",
  "succeeded",
  "failed",
  "skipped",
  "cancelled",
  "stale",
];

/**
 * Total, unambiguous map from every v1 lane status to exactly one canonical Status.
 * Each source value maps to a single, distinct target — there is no case where a v1
 * lane status could reasonably land on more than one canonical value.
 */
const v1LaneStatusToStatus: Record<V1LaneStatus, Status> = {
  not_started: "pending",
  partial: "running",
  blocked: "blocked",
  not_needed: "not_needed",
  deferred: "deferred",
  done: "succeeded",
};

/**
 * Total, unambiguous map from every v1 RunNodeStatus to exactly one canonical Status.
 * Identity for every value except waiting_human, which renames to waiting_founder.
 */
const v1RunNodeStatusToStatus: Record<V1RunNodeStatus, Status> = {
  pending: "pending",
  ready: "ready",
  running: "running",
  waiting_human: "waiting_founder",
  blocked: "blocked",
  succeeded: "succeeded",
  failed: "failed",
  skipped: "skipped",
  cancelled: "cancelled",
  stale: "stale",
};

export function mapV1LaneStatus(value: V1LaneStatus): Status {
  return v1LaneStatusToStatus[value];
}

export function mapV1RunNodeStatus(value: V1RunNodeStatus): Status {
  return v1RunNodeStatusToStatus[value];
}

/** The 12 domains a founder can grant autonomy over (KTD3). domain.process and domain.orchestration are system domains and never appear here. */
export type GrantableDomainId =
  | "domain.research"
  | "domain.product"
  | "domain.experience"
  | "domain.words"
  | "domain.design"
  | "domain.engineering"
  | "domain.growth"
  | "domain.data"
  | "domain.money"
  | "domain.store"
  | "domain.trust"
  | "domain.operations";

export const grantableDomainIds: readonly GrantableDomainId[] = [
  "domain.research",
  "domain.product",
  "domain.experience",
  "domain.words",
  "domain.design",
  "domain.engineering",
  "domain.growth",
  "domain.data",
  "domain.money",
  "domain.store",
  "domain.trust",
  "domain.operations",
];

export const systemDomainIds: readonly string[] = ["domain.process", "domain.orchestration"];

/** Every domain the execution engine may compile. System domains are runtime-owned and never founder-grantable. */
export type SystemDomainId = "domain.process" | "domain.orchestration" | "domain.machine";
export type DomainId = GrantableDomainId | SystemDomainId;

export function isSystemDomainId(value: string): value is SystemDomainId {
  return value === "domain.process" || value === "domain.orchestration" || value === "domain.machine";
}

/** Business units are a copy-layer grouping over domains (KTD3); a unit selection writes the same grant level to every member domain. */
export type BusinessUnit = "Product" | "Design" | "Engineering" | "Growth" | "Analytics" | "Revenue" | "Store" | "Trust" | "Operations";

export const businessUnitDomains: Record<BusinessUnit, readonly GrantableDomainId[]> = {
  Product: ["domain.research", "domain.product", "domain.experience", "domain.words"],
  Design: ["domain.design"],
  Engineering: ["domain.engineering"],
  Growth: ["domain.growth"],
  Analytics: ["domain.data"],
  Revenue: ["domain.money"],
  Store: ["domain.store"],
  Trust: ["domain.trust"],
  Operations: ["domain.operations"],
};

/** The 22 business-state lane keys (runtime/graph/lanes.ts key field), unchanged by the v2 migration. */
export type LaneKey =
  | "paid_tool_routing"
  | "secrets"
  | "security"
  | "research"
  | "traceability"
  | "experience"
  | "product"
  | "design"
  | "emotional_design"
  | "content_assets"
  | "analytics_attribution"
  | "paid_user_acquisition"
  | "onboarding"
  | "revenue"
  | "store_console"
  | "apple_signing"
  | "privacy_legal"
  | "email"
  | "orchestration"
  | "engineering"
  | "growth"
  | "post_launch_ops";

export const laneKeys: readonly LaneKey[] = [
  "paid_tool_routing",
  "secrets",
  "security",
  "research",
  "traceability",
  "experience",
  "product",
  "design",
  "emotional_design",
  "content_assets",
  "analytics_attribution",
  "paid_user_acquisition",
  "onboarding",
  "revenue",
  "store_console",
  "apple_signing",
  "privacy_legal",
  "email",
  "orchestration",
  "engineering",
  "growth",
  "post_launch_ops",
];

/** Action classes (knowledge/operations/frontier-agent-operations.md). */
export type ActionClass = "observe" | "draft" | "mutate" | "publish" | "spend" | "release" | "destructive";

/** R8's six protected classes, layered onto action classes as a tag rather than a new gateClass value (KTD4). */
export type ProtectedCategory = "spend" | "credentials_access" | "legal_pricing" | "public_actions" | "release" | "destructive";

export const protectedCategories: readonly ProtectedCategory[] = ["spend", "credentials_access", "legal_pricing", "public_actions", "release", "destructive"];

/** Waivable action classes: observe/draft never need a waiver, so they are excluded here. */
export type WaivableActionClass = "mutate" | "publish" | "spend" | "release" | "destructive";

export type GrantLevel = "review-first" | "run-with-guardrails" | "full";

export const grantLevels: readonly GrantLevel[] = ["review-first", "run-with-guardrails", "full"];

/** review-first -> draft ceiling; run-with-guardrails -> mutate/publish ceiling (protected classes still gated); full -> destructive ceiling (protected classes only via waivers). */
export const grantLevelCeilings: Record<GrantLevel, readonly ActionClass[]> = {
  "review-first": ["observe", "draft"],
  "run-with-guardrails": ["observe", "draft", "mutate", "publish"],
  full: ["observe", "draft", "mutate", "publish", "destructive"],
};

export type PrerequisiteStatus = "unverified" | "verified" | "lapsed";

export interface DopplerAuthProbe {
  id: string;
  kind: "doppler_auth";
  ttlSeconds: number;
  status: PrerequisiteStatus;
  verifiedAt?: string;
  evidencePath?: string;
}

export interface BudgetFundedProbe {
  id: string;
  kind: "budget_funded";
  ttlSeconds: number;
  status: PrerequisiteStatus;
  verifiedAt?: string;
  budgetRef: string;
}

export interface CustomProbe {
  id: string;
  kind: "custom";
  ttlSeconds: number;
  status: PrerequisiteStatus;
  verifiedAt?: string;
  evidencePath?: string;
  description: string;
}

export type PrerequisiteProbe = DopplerAuthProbe | BudgetFundedProbe | CustomProbe;

export interface Grant {
  domainId: GrantableDomainId;
  level: GrantLevel;
  prerequisites: PrerequisiteProbe[];
  grantedAt: string;
  grantedBy: "founder";
  grantedViaUnit?: BusinessUnit;
  updatedAt: string;
  notes?: string;
}

export type GrantsMap = Partial<Record<GrantableDomainId, Grant>>;

export interface GrantsDocument {
  schemaVersion: "1.0.0";
  updatedAt: string;
  grants: GrantsMap;
}

export type UndoContract =
  | { kind: "literal_undo"; undoAction: string; undoVerifiedPath?: string }
  | { kind: "mitigation"; irreversibilityAcknowledgment: string; mitigationSteps: string[] };

export type BudgetPeriod = "daily" | "weekly" | "monthly" | "per_run";

export interface WaiverCaps {
  maxPerAction: number;
  maxPerPeriod: number;
  currency?: string;
}

export interface Waiver {
  id: string;
  domainId: GrantableDomainId;
  actionClass: WaivableActionClass;
  protectedCategory: ProtectedCategory;
  scope: { resourcePattern: string; description: string };
  caps: WaiverCaps;
  budgetPeriod: BudgetPeriod;
  expiry: string;
  undoContract: UndoContract;
  auditRef: string;
  status: "active" | "expired" | "revoked";
  createdAt: string;
  createdBy: "founder";
  lastVerifiedAt?: string;
}

export interface WaiversDocument {
  schemaVersion: "1.0.0";
  updatedAt: string;
  waivers: Waiver[];
}

export interface BudgetBalance {
  unit: BusinessUnit;
  period: string;
  currency: string;
  allocated: number;
  committed: number;
  spent: number;
  remaining: number;
  updatedAt: string;
}

export interface BudgetLedgerEntry {
  id: string;
  unit: BusinessUnit;
  domainId: GrantableDomainId;
  nodeRef?: string;
  period: string;
  estimate: { amount: number; currency: string; declaredAt: string };
  actual: { amount: number; currency: string; recordedAt: string } | null;
  status: "estimated" | "actualized" | "rejected";
  waiverRef?: string;
  auditRef: string;
}

export interface BudgetLedgerDocument {
  schemaVersion: "1.0.0";
  updatedAt: string;
  balances: BudgetBalance[];
  entries: BudgetLedgerEntry[];
}

/**
 * Non-secret provisioning config (core/provisioning), e.g. the digest from-address and a Doppler
 * project/config binding. Optional and migrate-safe: absent means unset, never a placeholder
 * default — secret values never live here, only Doppler/.env do. dopplerProject/dopplerConfig
 * bind this business's own tier; dopplerPlatformProject/dopplerPlatformConfig optionally bind the
 * shared account-level `formation` project (knowledge/operations/doppler-organization.md) — cross-
 * project inheritance is a paid Doppler feature, so resolve.ts composes the two tiers itself,
 * business winning over platform on conflict.
 */
export interface ProvisioningConfig {
  digestFromAddress?: string;
  dopplerProject?: string;
  dopplerConfig?: string;
  dopplerPlatformProject?: string;
  dopplerPlatformConfig?: string;
}

export interface ControlFile {
  schemaVersion: "1.0.0";
  updatedAt: string;
  businessSlug: string;
  killSwitch: { engaged: boolean; engagedAt: string; engagedBy: "" | "founder" | "system"; reason: string };
  grants: GrantsMap;
  waivers: Waiver[];
  provisioning?: ProvisioningConfig;
}

export interface ArtifactBindingV2 {
  artifactId: string;
  path: string;
  fingerprint?: string;
  accepted: boolean;
  producedBy?: string;
  attemptId?: string;
}

export interface AttemptRecordV2 {
  id: string;
  nodeId: string;
  number: number;
  status: Status;
  ownerSessionId: string;
  heartbeatAt?: string;
  ttlSeconds: number;
  inputFingerprint: string;
  startedAt?: string;
  finishedAt?: string;
  evidence: string[];
  error?: string;
  readbackRequired: boolean;
  readbackEvidence?: string;
}

export interface RunNodeStateV2 {
  nodeId: string;
  status: Status;
  acceptedOutputFingerprint?: string;
  attempts: AttemptRecordV2[];
  blocker?: string;
  /**
   * The session that accepted this node's verification (gate-running session for deterministic
   * nodes, the reviewing session for fresh-context ones). Run-state provenance, not a trusted
   * identity by itself — the execution boundary refuses to export a fresh-context result whose
   * verifier session equals the producing attempt's owner, so self-verification cannot cross to
   * the platform as independent work.
   */
  verifiedBySessionId?: string;
  applicabilityFingerprint?: string;
}

export interface RunStateDocument {
  schemaVersion: "1.0.0";
  runId: string;
  planId: string;
  planRevision: number;
  createdAt: string;
  updatedAt: string;
  ownerSessionId: string;
  heartbeatAt: string;
  ttlSeconds: number;
  wallClockCapSeconds: number;
  approvals: Record<string, "pending" | "approved" | "rejected">;
  approvalProvenance?: Record<
    string,
    {
      source: "standing_envelope";
      envelopeId: string;
      actionId: string;
      validatedAt: string;
    }
  >;
  artifactBindings: ArtifactBindingV2[];
  nodes: Record<string, RunNodeStateV2>;
}

export interface CheckpointDocument {
  schemaVersion: "1.0.0";
  writtenAt: string;
  writerSessionId: string;
  stateHash: string;
  runState: RunStateDocument;
}

export interface Lane {
  status: Status;
  evidence: string[];
  blockers: string[];
  [extra: string]: unknown;
}

export type LanesMap = Record<LaneKey, Lane>;

export interface PendingFounderGate {
  id: string;
  category: ProtectedCategory | "other";
  reason: string;
  sourceLegacyId?: string;
  createdAt: string;
}

export interface BusinessStateV2 {
  schemaVersion: "2.0.0";
  updatedAt: string;
  narrative: { sinceLastTime: string; rightNow: string; yourCall: string; lastCelebratedPhase: string };
  project: {
    name: string;
    slug: string;
    owner: string;
    phase: string;
    launchScope: "essentials" | "full";
    kickoffDate: string;
    platforms: Array<"ios" | "android">;
    bundleIds: { ios: string; android: string };
    publicUrls: { landing: string; privacy: string; terms: string };
  };
  lanes: LanesMap;
  founderGates: { pending: PendingFounderGate[] };
  continuity?: { lastStateReview?: string; sourceFiles?: string[]; gitStatusReviewed?: boolean; nextAction?: string };
  workflowApplicability?: Record<
    string,
    { verdict: "required" | "not-needed"; reason: string; evidence: string[]; updatedAt: string }
  >;
}
