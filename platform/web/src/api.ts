import type {
  AccountSession,
  Comment,
  CommentTarget,
  ReviewRequest,
  CreatedShare,
  ApprovalsView,
  Artifact,
  Claim,
  CreatedInvitation,
  Decision,
  FounderExecution,
  ImportPlan,
  ImportSourceList,
  InvitationPreview,
  Job,
  Member,
  PeopleView,
  PublicConfig,
  SessionPayload,
  ShareLink,
  SharedView,
  Task,
  Workspace,
  WorkspaceBrief,
  WorkspaceRole,
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
  register: (name: string, email: string, password: string, invitationToken?: string) =>
    request<{ user: SessionPayload["user"]; expiresAt: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, ...(invitationToken ? { invitationToken } : {}) }),
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
  comment: (workspaceId: string, payload: { target: CommentTarget; body: string; parentId?: string }) =>
    request<Comment>(`/api/workspaces/${workspaceId}/comments`, { method: "POST", body: JSON.stringify(payload) }),
  updateComment: (workspaceId: string, commentId: string, patch: { body?: string; resolved?: boolean }) =>
    request<Comment>(`/api/workspaces/${workspaceId}/comments/${commentId}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteComment: (workspaceId: string, commentId: string) =>
    request<{ removed: boolean }>(`/api/workspaces/${workspaceId}/comments/${commentId}`, { method: "DELETE" }),
  requestReview: (workspaceId: string, payload: { target: CommentTarget; assigneeId: string; note?: string; dueAt?: string | null }) =>
    request<ReviewRequest>(`/api/workspaces/${workspaceId}/reviews`, { method: "POST", body: JSON.stringify(payload) }),
  answerReview: (workspaceId: string, reviewId: string, payload: { answer: "approved" | "changes-requested"; note?: string }) =>
    request<ReviewRequest>(`/api/workspaces/${workspaceId}/reviews/${reviewId}`, { method: "POST", body: JSON.stringify(payload) }),
  withdrawReview: (workspaceId: string, reviewId: string) =>
    request<ReviewRequest>(`/api/workspaces/${workspaceId}/reviews/${reviewId}`, { method: "POST", body: JSON.stringify({ withdrawn: true }) }),
  listApprovals: (workspaceId: string) => request<ApprovalsView>(`/api/workspaces/${workspaceId}/approvals`),
  listExecutions: (workspaceId: string) => request<FounderExecution[]>(`/api/workspaces/${workspaceId}/executions`),
  importSources: (workspaceId: string) => request<ImportSourceList>(`/api/workspaces/${workspaceId}/import-sources`),
  previewImport: (workspaceId: string, sourceId: string) =>
    request<ImportPlan>(`/api/workspaces/${workspaceId}/imports/preview`, {
      method: "POST",
      body: JSON.stringify({ sourceId }),
    }),
  applyImport: (workspaceId: string, sourceId: string) =>
    request<ImportPlan>(`/api/workspaces/${workspaceId}/imports`, {
      method: "POST",
      body: JSON.stringify({ sourceId }),
    }),
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
  updateArtifact: (workspaceId: string, artifactId: string, patch: Partial<Artifact> & { wordingConfirmed?: boolean; expectedVersion?: number }) =>
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
  sessions: () => request<{ sessions: AccountSession[] }>("/api/account/sessions"),
  revokeSession: (sessionId: string) =>
    request<{ revoked: number; endedCurrentSession: boolean }>(`/api/account/sessions/${sessionId}`, { method: "DELETE" }),
  revokeOtherSessions: () => request<{ revoked: number }>("/api/account/sessions", { method: "DELETE" }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ changed: boolean; signedOutElsewhere: number }>("/api/account/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  shares: (workspaceId: string) => request<{ shares: ShareLink[] }>(`/api/workspaces/${workspaceId}/shares`),
  createShare: (workspaceId: string, payload: { scope: "deliverable" | "company"; artifactId?: string }) =>
    request<CreatedShare>(`/api/workspaces/${workspaceId}/shares`, { method: "POST", body: JSON.stringify(payload) }),
  stopShare: (workspaceId: string, shareId: string) =>
    request<ShareLink>(`/api/workspaces/${workspaceId}/shares/${shareId}`, { method: "DELETE" }),
  sharedView: (token: string) => request<SharedView>(`/api/shared/${encodeURIComponent(token)}`),
  people: (workspaceId: string) => request<PeopleView>(`/api/workspaces/${workspaceId}/members`),
  invite: (workspaceId: string, email: string, role: WorkspaceRole) =>
    request<CreatedInvitation>(`/api/workspaces/${workspaceId}/invitations`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
  cancelInvitation: (workspaceId: string, invitationId: string) =>
    request<unknown>(`/api/workspaces/${workspaceId}/invitations/${invitationId}`, { method: "DELETE" }),
  changeMemberRole: (workspaceId: string, membershipId: string, role: WorkspaceRole) =>
    request<Member>(`/api/workspaces/${workspaceId}/members/${membershipId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  removeMember: (workspaceId: string, membershipId: string) =>
    request<{ removed: boolean; leaving: boolean }>(`/api/workspaces/${workspaceId}/members/${membershipId}`, {
      method: "DELETE",
    }),
  previewInvitation: (token: string) =>
    request<InvitationPreview>("/api/invitations/preview", { method: "POST", body: JSON.stringify({ token }) }),
  acceptInvitation: (token: string) =>
    request<{ workspaceId: string; company: string; role: WorkspaceRole; alreadyMember: boolean }>(
      "/api/invitations/accept",
      { method: "POST", body: JSON.stringify({ token }) },
    ),
};
