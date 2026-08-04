import { createHash } from "node:crypto";
import type { ArtifactId, GateId, OperatorId, ProviderId, SkillGraph, WorkflowId } from "./types.js";

export type RunNodeStatus = "pending" | "ready" | "running" | "waiting_human" | "blocked" | "succeeded" | "failed" | "skipped" | "cancelled" | "stale";

export type ResourceMode = "shared" | "exclusive";
export type ExecutionMode = "inline" | "serial_subagent" | "parallel_subagent" | "worktree" | "dynamic_workflow";
export type VerificationKind = "deterministic" | "fresh_context" | "human" | "none";

export interface ArtifactBinding {
  artifactId: ArtifactId;
  path: string;
  fingerprint?: string;
  accepted: boolean;
  producedBy?: RunNodeId;
  attemptId?: string;
}

export interface ResourceClaim {
  id: string;
  mode: ResourceMode;
}

export interface StatePredicate {
  path: string;
  operator: "exists" | "equals" | "in" | "not_in";
  value?: unknown;
}

export interface ApprovalRequirement {
  id: string;
  description: string;
}

export interface VerificationPolicy {
  kind: VerificationKind;
  gateIds: GateId[];
  freshContext: boolean;
  failClosed: boolean;
}

export interface ExecutionPolicy {
  allowedModes: ExecutionMode[];
  maxAttempts: number;
  timeoutSeconds: number;
  idempotent: boolean;
  tokenBudget: number;
}

export interface ContextContract {
  referenceIds: string[];
  stateSelectors: string[];
  artifactIds: ArtifactId[];
  trust: "trusted" | "mixed" | "untrusted";
  freshContext: boolean;
}

export type RunNodeId = `run.${string}`;

export interface CompiledRunNode {
  id: RunNodeId;
  workflowId: WorkflowId;
  title: string;
  inputs: ArtifactId[];
  outputs: ArtifactId[];
  dependencies: RunNodeId[];
  statePredicates: StatePredicate[];
  approvals: ApprovalRequirement[];
  resources: ResourceClaim[];
  operators: OperatorId[];
  providers: ProviderId[];
  verification: VerificationPolicy;
  execution: ExecutionPolicy;
  context: ContextContract;
}

export interface GraphExecutionPlan {
  schemaVersion: "2.0.0";
  graphVersion: string;
  planRevision: number;
  planId: string;
  compiledAt: string;
  nodes: CompiledRunNode[];
  artifactBindings: ArtifactBinding[];
  catalog: {
    dependencyEdges: number;
    artifactInputs: number;
    sharedOutputArtifacts: ArtifactId[];
  };
}

export interface AttemptRecord {
  id: string;
  nodeId: RunNodeId;
  number: number;
  status: RunNodeStatus;
  inputFingerprint: string;
  startedAt?: string;
  finishedAt?: string;
  evidence: string[];
  error?: string;
}

export interface RunNodeState {
  nodeId: RunNodeId;
  status: RunNodeStatus;
  acceptedOutputFingerprint?: string;
  attempts: AttemptRecord[];
  blocker?: string;
}

export interface GraphRunState {
  schemaVersion: "1.0.0";
  runId: string;
  planId: string;
  planRevision: number;
  createdAt: string;
  updatedAt: string;
  approvals: Record<string, "pending" | "approved" | "rejected">;
  artifactBindings: ArtifactBinding[];
  nodes: Record<RunNodeId, RunNodeState>;
}

export interface RuntimeCapabilities {
  dynamicWorkflows: boolean;
  subagents: boolean;
  worktrees: boolean;
  maxConcurrency: number;
}

export interface DispatchBatch {
  mode: ExecutionMode;
  nodeIds: RunNodeId[];
}

export interface StatePatch {
  nodeId: RunNodeId;
  attemptId: string;
  outputs: Array<{ artifactId: ArtifactId; path: string; fingerprint: string; evidence: string[] }>;
  proposedState: Record<string, unknown>;
}

const canonicalResources = ["resource.state.project", "resource.git.integration", "resource.cockpit.render"];

export function compileExecutionPlan(graph: SkillGraph, now = "1970-01-01T00:00:00.000Z"): GraphExecutionPlan {
  const artifactsByPath = new Map(graph.artifacts.map((artifact) => [artifact.path, artifact]));
  const outputsByWorkflow = new Map<WorkflowId, ArtifactId[]>();
  for (const workflow of graph.workflows) {
    outputsByWorkflow.set(
      workflow.id,
      workflow.outputPaths.map((path) => artifactsByPath.get(path)?.id).filter((id): id is ArtifactId => Boolean(id)),
    );
  }

  const runIdByWorkflow = new Map<WorkflowId, RunNodeId>(graph.workflows.map((workflow) => [workflow.id, toRunNodeId(workflow.id)]));
  let artifactInputs = 0;
  const nodes = graph.workflows.map((workflow): CompiledRunNode => {
    const inputs = unique(workflow.dependencies.flatMap((upstreamId) => outputsByWorkflow.get(upstreamId) ?? []));
    artifactInputs += inputs.length;
    const outputs = outputsByWorkflow.get(workflow.id) ?? [];
    const gateIds = workflow.gateCommands.map((command) => graph.gates.find((gate) => gate.command === command)?.id).filter((id): id is GateId => Boolean(id));
    const judgment = workflow.domainId === "domain.research" || workflow.domainId === "domain.words" || workflow.domainId === "domain.design";
    const resources: ResourceClaim[] = [
      ...workflow.outputPaths.map((path) => ({ id: `resource.path.${normalizeResource(path)}`, mode: "exclusive" as const })),
      ...workflow.providerIds.map((id) => ({ id: `resource.${id}`, mode: "exclusive" as const })),
    ];
    if (workflow.outputPaths.includes("PROJECT_STATE.yaml")) resources.push({ id: canonicalResources[0]!, mode: "exclusive" });
    if (workflow.founderOnlyActions.length > 0) resources.push({ id: "resource.founder.attention", mode: "exclusive" });

    return {
      id: runIdByWorkflow.get(workflow.id)!,
      workflowId: workflow.id,
      title: workflow.title,
      inputs,
      outputs,
      dependencies: workflow.dependencies.map((id) => runIdByWorkflow.get(id)!).filter(Boolean),
      statePredicates: workflow.laneIds.map((laneId) => ({ path: `lanes.${laneId.slice("lane.".length)}.status`, operator: "not_in", value: ["blocked"] })),
      approvals: workflow.founderOnlyActions.map((description, index) => ({ id: `${workflow.id}.approval.${index + 1}`, description })),
      resources: dedupeClaims(resources),
      operators: workflow.operatorIds,
      providers: workflow.providerIds,
      verification: {
        kind: gateIds.length > 0 ? "deterministic" : judgment ? "fresh_context" : "none",
        gateIds,
        freshContext: judgment,
        failClosed: gateIds.length > 0 || judgment,
      },
      execution: {
        allowedModes: chooseAllowedModes(resources, workflow.founderOnlyActions.length > 0),
        maxAttempts: 3,
        timeoutSeconds: 1800,
        idempotent: workflow.providerIds.length === 0 && workflow.founderOnlyActions.length === 0,
        tokenBudget: judgment ? 20_000 : 8_000,
      },
      context: {
        referenceIds: workflow.referenceIds,
        stateSelectors: workflow.laneIds.map((laneId) => `lanes.${laneId.slice("lane.".length)}`),
        artifactIds: inputs,
        trust: workflow.domainId === "domain.research" ? "untrusted" : "trusted",
        freshContext: judgment,
      },
    };
  });

  const writers = new Map<ArtifactId, number>();
  for (const node of nodes) for (const artifactId of node.outputs) writers.set(artifactId, (writers.get(artifactId) ?? 0) + 1);
  const sharedOutputArtifacts = [...writers.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  const artifactBindings = graph.artifacts.map((artifact) => ({ artifactId: artifact.id, path: artifact.path, accepted: false }));
  const planBody = JSON.stringify({ graphVersion: graph.skillVersion, nodes, artifactBindings });
  return {
    schemaVersion: "2.0.0",
    graphVersion: graph.skillVersion,
    planRevision: 1,
    planId: `plan.${sha256(planBody).slice(0, 16)}`,
    compiledAt: now,
    nodes,
    artifactBindings,
    catalog: {
      dependencyEdges: graph.workflows.reduce((sum, workflow) => sum + workflow.dependencies.length, 0),
      artifactInputs,
      sharedOutputArtifacts,
    },
  };
}

export function initializeRun(plan: GraphExecutionPlan, now = "1970-01-01T00:00:00.000Z"): GraphRunState {
  const nodes = Object.fromEntries(plan.nodes.map((node) => [node.id, { nodeId: node.id, status: "pending", attempts: [] } satisfies RunNodeState])) as Record<
    RunNodeId,
    RunNodeState
  >;
  const approvals = Object.fromEntries(plan.nodes.flatMap((node) => node.approvals.map((approval) => [approval.id, "pending" as const])));
  return {
    schemaVersion: "1.0.0",
    runId: `execution.${plan.planId.slice("plan.".length)}`,
    planId: plan.planId,
    planRevision: plan.planRevision,
    createdAt: now,
    updatedAt: now,
    approvals,
    artifactBindings: structuredClone(plan.artifactBindings),
    nodes,
  };
}

export function computeFrontier(plan: GraphExecutionPlan, run: GraphRunState, projectState: unknown): RunNodeId[] {
  const accepted = new Set(run.artifactBindings.filter((binding) => binding.accepted).map((binding) => binding.artifactId));
  const frontier: RunNodeId[] = [];
  for (const node of plan.nodes) {
    const state = run.nodes[node.id];
    if (!state || !["pending", "ready", "stale"].includes(state.status)) continue;
    if (node.dependencies.some((dependency) => run.nodes[dependency]?.status !== "succeeded")) continue;
    if (node.inputs.some((artifactId) => !accepted.has(artifactId))) continue;
    if (!node.statePredicates.every((predicate) => evaluatePredicate(projectState, predicate))) continue;
    const approvalStatuses = node.approvals.map((approval) => run.approvals[approval.id]);
    if (approvalStatuses.some((status) => status === "rejected")) continue;
    if (approvalStatuses.some((status) => status !== "approved")) {
      state.status = "waiting_human";
      state.blocker = "Founder approval required";
      continue;
    }
    state.status = "ready";
    state.blocker = undefined;
    frontier.push(node.id);
  }
  return frontier;
}

export function buildDispatchBatches(plan: GraphExecutionPlan, run: GraphRunState, capabilities: RuntimeCapabilities, projectState: unknown): DispatchBatch[] {
  const frontier = computeFrontier(plan, run, projectState);
  const batches: DispatchBatch[] = [];
  let current: CompiledRunNode[] = [];
  for (const nodeId of frontier) {
    const node = plan.nodes.find((candidate) => candidate.id === nodeId)!;
    if (current.some((candidate) => conflicts(candidate, node)) || current.length >= Math.max(1, capabilities.maxConcurrency)) {
      batches.push({ mode: selectMode(current, capabilities), nodeIds: current.map((item) => item.id) });
      current = [];
    }
    current.push(node);
  }
  if (current.length > 0) batches.push({ mode: selectMode(current, capabilities), nodeIds: current.map((item) => item.id) });
  return batches;
}

export function beginAttempt(plan: GraphExecutionPlan, run: GraphRunState, nodeId: RunNodeId, now: string): AttemptRecord {
  const node = plan.nodes.find((candidate) => candidate.id === nodeId);
  const state = run.nodes[nodeId];
  if (!node || !state) throw new Error(`Unknown run node ${nodeId}`);
  if (state.attempts.length >= node.execution.maxAttempts) throw new Error(`${nodeId} exhausted ${node.execution.maxAttempts} attempts`);
  const inputFingerprint = fingerprintInputs(node.inputs, run.artifactBindings);
  const attempt: AttemptRecord = {
    id: `${nodeId}.attempt.${state.attempts.length + 1}`,
    nodeId,
    number: state.attempts.length + 1,
    status: "running",
    inputFingerprint,
    startedAt: now,
    evidence: [],
  };
  state.attempts.push(attempt);
  state.status = "running";
  run.updatedAt = now;
  return attempt;
}

export function reconcilePatch(plan: GraphExecutionPlan, run: GraphRunState, patch: StatePatch, now: string): void {
  const node = plan.nodes.find((candidate) => candidate.id === patch.nodeId);
  const state = run.nodes[patch.nodeId];
  const attempt = state?.attempts.find((candidate) => candidate.id === patch.attemptId);
  if (!node || !state || !attempt) throw new Error("Patch does not match an active graph attempt");
  if (attempt.status !== "running") throw new Error(`Attempt ${attempt.id} is not running`);
  const expected = new Set(node.outputs);
  const actual = new Set(patch.outputs.map((output) => output.artifactId));
  const missing = [...expected].filter((artifactId) => !actual.has(artifactId));
  if (missing.length > 0) throw new Error(`Silent node failure: ${patch.nodeId} omitted ${missing.join(", ")}`);
  for (const output of patch.outputs) {
    if (!expected.has(output.artifactId)) throw new Error(`${patch.nodeId} returned undeclared output ${output.artifactId}`);
    const binding = run.artifactBindings.find((candidate) => candidate.artifactId === output.artifactId);
    if (!binding) throw new Error(`Missing artifact binding ${output.artifactId}`);
    binding.path = output.path;
    binding.fingerprint = output.fingerprint;
    binding.accepted = node.verification.kind === "none";
    binding.producedBy = node.id;
    binding.attemptId = attempt.id;
    attempt.evidence.push(...output.evidence);
  }
  attempt.finishedAt = now;
  attempt.status = node.verification.kind === "none" ? "succeeded" : "blocked";
  state.status = node.verification.kind === "none" ? "succeeded" : "blocked";
  state.blocker = node.verification.kind === "none" ? undefined : "Verification required";
  run.updatedAt = now;
}

export function acceptVerification(plan: GraphExecutionPlan, run: GraphRunState, nodeId: RunNodeId, evidence: string[], now: string): void {
  const node = plan.nodes.find((candidate) => candidate.id === nodeId);
  const state = run.nodes[nodeId];
  const attempt = state?.attempts.at(-1);
  if (!node || !state || !attempt) throw new Error(`No attempt to verify for ${nodeId}`);
  if (node.verification.kind !== "none" && evidence.length === 0 && node.verification.failClosed)
    throw new Error(`Verification for ${nodeId} requires evidence`);
  for (const artifactId of node.outputs) {
    const binding = run.artifactBindings.find((candidate) => candidate.artifactId === artifactId && candidate.attemptId === attempt.id);
    if (binding) binding.accepted = true;
  }
  attempt.evidence.push(...evidence);
  attempt.status = "succeeded";
  attempt.finishedAt = now;
  state.status = "succeeded";
  state.acceptedOutputFingerprint = sha256(
    node.outputs.map((id) => run.artifactBindings.find((binding) => binding.artifactId === id)?.fingerprint ?? "").join("|"),
  );
  state.blocker = undefined;
  run.updatedAt = now;
}

export function invalidateDescendants(plan: GraphExecutionPlan, run: GraphRunState, changedArtifactIds: ArtifactId[]): RunNodeId[] {
  const changed = new Set(changedArtifactIds);
  const invalidated: RunNodeId[] = [];
  let advanced = true;
  while (advanced) {
    advanced = false;
    for (const node of plan.nodes) {
      const state = run.nodes[node.id];
      if (!state || state.status === "stale") continue;
      if (node.inputs.some((artifactId) => changed.has(artifactId))) {
        state.status = "stale";
        state.acceptedOutputFingerprint = undefined;
        for (const artifactId of node.outputs) {
          changed.add(artifactId);
          const binding = run.artifactBindings.find((candidate) => candidate.artifactId === artifactId);
          if (binding) binding.accepted = false;
        }
        invalidated.push(node.id);
        advanced = true;
      }
    }
  }
  return invalidated;
}

export function validateExecutionArchitecture(graph: SkillGraph): string[] {
  const problems: string[] = [];
  const plan = compileExecutionPlan(graph);
  const nodeIds = new Set(plan.nodes.map((node) => node.id));
  for (const node of plan.nodes) {
    if (node.dependencies.some((dependency) => !nodeIds.has(dependency))) problems.push(`${node.id} has an unknown dependency`);
    if (node.execution.maxAttempts < 1) problems.push(`${node.id} has no retry budget`);
    if (node.context.freshContext !== node.verification.freshContext && node.verification.kind === "fresh_context") {
      problems.push(`${node.id} fresh-context verifier is not context-isolated`);
    }
    if (node.resources.some((claim) => !claim.id.startsWith("resource."))) problems.push(`${node.id} has an invalid resource claim`);
  }
  const run = initializeRun(plan);
  const roots = plan.nodes.filter((node) => node.dependencies.length === 0 && node.inputs.length === 0);
  computeFrontier(plan, run, {});
  if (roots.length > 0 && !roots.some((node) => ["ready", "waiting_human"].includes(run.nodes[node.id]?.status ?? ""))) {
    problems.push("execution plan has roots but no computable frontier");
  }
  if (plan.planId !== compileExecutionPlan(graph).planId) problems.push("execution compiler is not deterministic");
  return problems;
}

function chooseAllowedModes(resources: ResourceClaim[], founderGated: boolean): ExecutionMode[] {
  if (founderGated || resources.some((claim) => claim.id.includes("provider.") || claim.id.includes("device."))) return ["inline"];
  if (resources.some((claim) => claim.mode === "exclusive")) return ["inline", "serial_subagent", "worktree"];
  return ["inline", "serial_subagent", "parallel_subagent", "worktree", "dynamic_workflow"];
}

function selectMode(nodes: CompiledRunNode[], capabilities: RuntimeCapabilities): ExecutionMode {
  const allowed = nodes.map((node) => new Set(node.execution.allowedModes));
  const allAllow = (mode: ExecutionMode) => allowed.every((set) => set.has(mode));
  if (nodes.length > 1 && capabilities.dynamicWorkflows && allAllow("dynamic_workflow")) return "dynamic_workflow";
  if (nodes.length > 1 && capabilities.subagents && allAllow("parallel_subagent")) return "parallel_subagent";
  if (capabilities.worktrees && allAllow("worktree")) return "worktree";
  if (capabilities.subagents && allAllow("serial_subagent")) return "serial_subagent";
  return "inline";
}

function conflicts(a: CompiledRunNode, b: CompiledRunNode): boolean {
  for (const left of a.resources) {
    const right = b.resources.find((candidate) => candidate.id === left.id || resourcePrefixOverlap(candidate.id, left.id));
    if (right && (left.mode === "exclusive" || right.mode === "exclusive")) return true;
  }
  return false;
}

function resourcePrefixOverlap(a: string, b: string): boolean {
  return a.startsWith(`${b}.`) || b.startsWith(`${a}.`);
}

function evaluatePredicate(state: unknown, predicate: StatePredicate): boolean {
  const value = getPath(state, predicate.path);
  if (predicate.operator === "exists") return value !== undefined;
  if (predicate.operator === "equals") return Object.is(value, predicate.value);
  const values = Array.isArray(predicate.value) ? predicate.value : [];
  if (predicate.operator === "in") return values.includes(value);
  return !values.includes(value);
}

function getPath(value: unknown, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((current, key) => {
    if (typeof current !== "object" || current === null || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function fingerprintInputs(inputs: ArtifactId[], bindings: ArtifactBinding[]): string {
  return sha256(
    inputs.map((artifactId) => `${artifactId}:${bindings.find((binding) => binding.artifactId === artifactId)?.fingerprint ?? "missing"}`).join("|"),
  );
}

function toRunNodeId(workflowId: WorkflowId): RunNodeId {
  return `run.${workflowId.slice("workflow.".length)}`;
}

function normalizeResource(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "")
    .toLowerCase();
}

function dedupeClaims(claims: ResourceClaim[]): ResourceClaim[] {
  const byId = new Map<string, ResourceClaim>();
  for (const claim of claims) {
    const previous = byId.get(claim.id);
    byId.set(claim.id, { id: claim.id, mode: previous?.mode === "exclusive" || claim.mode === "exclusive" ? "exclusive" : "shared" });
  }
  return [...byId.values()];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
