import type {
  ApprovalsView,
  Artifact,
  Claim,
  Decision,
  FounderExecution,
  Job,
  PublicConfig,
  SessionPayload,
  Task,
  Workspace,
  WorkspaceBrief,
  WorkspaceSnapshot,
  Workstream,
} from "./types";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event("formation:unauthorized"));
    throw new ApiError(response.status, payload?.error ?? `Request failed with ${response.status}.`);
  }
  return payload as T;
}

export const api = {
  config: () => request<PublicConfig>("/api/config"),
  session: () => request<SessionPayload>("/api/session"),
  login: (email: string, password: string) =>
    request<{ user: SessionPayload["user"]; expiresAt: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string) =>
    request<{ user: SessionPayload["user"]; expiresAt: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  demoLogin: (email = "founder@formation.local") =>
    request<{ user: SessionPayload["user"]; expiresAt: string }>("/api/auth/demo", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST", body: "{}" }),
  workspace: (workspaceId: string) => request<WorkspaceSnapshot>(`/api/workspaces/${workspaceId}`),
  createWorkspace: (brief: WorkspaceBrief) =>
    request<Workspace>("/api/workspaces", { method: "POST", body: JSON.stringify(brief) }),
  updateWorkspace: (workspaceId: string, patch: Partial<Pick<Workspace, "name" | "stage" | "launchTarget" | "founder">>) =>
    request<Workspace>(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  updateCompany: (workspaceId: string, patch: Partial<Workspace["company"]>) =>
    request<Workspace["company"]>(`/api/workspaces/${workspaceId}/company`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  updateWorkstream: (workspaceId: string, workstreamId: string, patch: Partial<Workstream>) =>
    request<Workstream>(`/api/workspaces/${workspaceId}/workstreams/${workstreamId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  createClaim: (workspaceId: string, payload: Partial<Claim>) =>
    request<Claim>(`/api/workspaces/${workspaceId}/claims`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateClaim: (workspaceId: string, claimId: string, patch: Partial<Claim>) =>
    request<Claim>(`/api/workspaces/${workspaceId}/claims/${claimId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  createDecision: (workspaceId: string, payload: Partial<Decision>) =>
    request<Decision>(`/api/workspaces/${workspaceId}/decisions`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateDecision: (workspaceId: string, decisionId: string, patch: Partial<Decision>) =>
    request<Decision>(`/api/workspaces/${workspaceId}/decisions/${decisionId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  listApprovals: (workspaceId: string) => request<ApprovalsView>(`/api/workspaces/${workspaceId}/approvals`),
  listExecutions: (workspaceId: string) => request<FounderExecution[]>(`/api/workspaces/${workspaceId}/executions`),
  answerApproval: (workspaceId: string, decisionId: string, payload: { answer: "approve" | "decline"; reason?: string }) =>
    request<Decision>(`/api/workspaces/${workspaceId}/approvals/${decisionId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createTask: (workspaceId: string, payload: Partial<Task>) =>
    request<Task>(`/api/workspaces/${workspaceId}/tasks`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTask: (workspaceId: string, taskId: string, patch: Partial<Task>) =>
    request<Task>(`/api/workspaces/${workspaceId}/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  updateArtifact: (workspaceId: string, artifactId: string, patch: Partial<Artifact>) =>
    request<Artifact>(`/api/workspaces/${workspaceId}/artifacts/${artifactId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  generate: (
    workspaceId: string,
    payload: { workstreamId: string; artifactType?: string; instruction?: string },
  ) =>
    request<Job>(`/api/workspaces/${workspaceId}/generate`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  job: (workspaceId: string, jobId: string) => request<Job>(`/api/workspaces/${workspaceId}/jobs/${jobId}`),
};
