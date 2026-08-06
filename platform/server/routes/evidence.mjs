import { createId } from "../domain.mjs";
import { HttpError, json } from "../http.mjs";
import {
  CLAIM_KINDS,
  CLAIM_PATCH_FIELDS,
  DECISION_PATCH_FIELDS,
  DECISION_STATUSES,
  TASK_PATCH_FIELDS,
  TASK_STATUSES,
  TEXT_LIMITS,
  boundedInteger,
  normalizeClaimValue,
  optionalText,
  readJsonBody,
  requireSupportedPatch,
  requireText,
  textList,
  validDateOrNull,
} from "../validation.mjs";
import { requireWorkspace, requireWorkstream, touchWorkspace } from "./shared.mjs";

export async function handleEvidenceRoutes({ request, response, method, pathname, store, user }) {
  const claimsCollectionMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/claims$/);
  if (claimsCollectionMatch && method === "POST") {
    const workspaceId = decodeURIComponent(claimsCollectionMatch[1]);
    const body = await readJsonBody(request);
    if (!CLAIM_KINDS.has(body.kind)) throw new HttpError(400, "Claim kind must be fact, assumption, recommendation, or question.");
    const statement = requireText(body.statement, "Claim statement", TEXT_LIMITS.long);
    const key = body.key === null || body.key === undefined
      ? null
      : optionalText(body.key, "Claim key", TEXT_LIMITS.key, { allowEmpty: true }) || null;
    const value = normalizeClaimValue(body.value);
    const evidence = body.evidence === undefined ? [] : textList(body.evidence, "Evidence", 20, TEXT_LIMITS.listItem);
    const claim = await store.transaction((database) => {
      const workspace = requireWorkspace(database, workspaceId, user.id);
      requireWorkstream(workspace, body.workstreamId);
      const now = new Date().toISOString();
      const next = {
        id: createId("clm"),
        workspaceId,
        workstreamId: body.workstreamId,
        kind: body.kind,
        key,
        statement,
        value,
        confidence: boundedInteger(body.confidence ?? 50, 0, 100, "Confidence"),
        status: body.kind === "question" ? "open" : "active",
        evidence,
        createdAt: now,
        updatedAt: now,
      };
      database.claims.push(next);
      touchWorkspace(database, workspace, user.name, "Business claim added", next.statement);
      return next;
    });
    json(response, 201, claim);
    return;
  }

  const claimMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/claims\/([^/]+)$/);
  if (claimMatch && method === "PATCH") {
    const workspaceId = decodeURIComponent(claimMatch[1]);
    const claimId = decodeURIComponent(claimMatch[2]);
    const patch = await readJsonBody(request);
    requireSupportedPatch(patch, CLAIM_PATCH_FIELDS, "claim");
    const claim = await store.transaction((database) => {
      const workspace = requireWorkspace(database, workspaceId, user.id);
      const target = database.claims.find((entry) => entry.id === claimId && entry.workspaceId === workspaceId);
      if (!target) throw new HttpError(404, "Claim not found.");
      if (patch.kind !== undefined) {
        if (!CLAIM_KINDS.has(patch.kind)) throw new HttpError(400, "Invalid claim kind.");
        target.kind = patch.kind;
      }
      if (patch.statement !== undefined) target.statement = requireText(patch.statement, "Claim statement", TEXT_LIMITS.long);
      if (patch.key !== undefined) {
        target.key = patch.key === null
          ? null
          : optionalText(patch.key, "Claim key", TEXT_LIMITS.key, { allowEmpty: true }) || null;
      }
      if (patch.value !== undefined) target.value = normalizeClaimValue(patch.value);
      if (patch.confidence !== undefined) target.confidence = boundedInteger(patch.confidence, 0, 100, "Confidence");
      if (patch.status !== undefined) {
        if (!["active", "open", "resolved", "rejected", "superseded"].includes(patch.status)) {
          throw new HttpError(400, "Invalid claim status.");
        }
        target.status = patch.status;
      }
      if (patch.evidence !== undefined) target.evidence = textList(patch.evidence, "Evidence", 20, TEXT_LIMITS.listItem);
      target.updatedAt = new Date().toISOString();
      touchWorkspace(database, workspace, user.name, "Business claim updated", target.statement);
      return target;
    });
    json(response, 200, claim);
    return;
  }

  const decisionsCollectionMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/decisions$/);
  if (decisionsCollectionMatch && method === "POST") {
    const workspaceId = decodeURIComponent(decisionsCollectionMatch[1]);
    const body = await readJsonBody(request);
    const title = requireText(body.title, "Decision title", TEXT_LIMITS.title);
    const decisionStatement = requireText(body.decision, "Decision statement", TEXT_LIMITS.long);
    const rationale = requireText(body.rationale, "Decision rationale", TEXT_LIMITS.long);
    const owner = body.owner === undefined
      ? user.name
      : requireText(body.owner, "Decision owner", TEXT_LIMITS.owner);
    if (body.status !== undefined && !DECISION_STATUSES.has(body.status)) {
      throw new HttpError(400, "Invalid decision status.");
    }
    const decision = await store.transaction((database) => {
      const workspace = requireWorkspace(database, workspaceId, user.id);
      requireWorkstream(workspace, body.workstreamId);
      const now = new Date().toISOString();
      const status = body.status ?? "open";
      const next = {
        id: createId("dec"),
        workspaceId,
        workstreamId: body.workstreamId,
        title,
        decision: decisionStatement,
        rationale,
        status,
        owner,
        decidedAt: status === "decided" ? new Date().toISOString().slice(0, 10) : null,
        reviewAt: validDateOrNull(body.reviewAt),
        createdAt: now,
        updatedAt: now,
      };
      database.decisions.push(next);
      touchWorkspace(database, workspace, user.name, "Decision recorded", next.title);
      return next;
    });
    json(response, 201, decision);
    return;
  }

  const decisionMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/decisions\/([^/]+)$/);
  if (decisionMatch && method === "PATCH") {
    const workspaceId = decodeURIComponent(decisionMatch[1]);
    const decisionId = decodeURIComponent(decisionMatch[2]);
    const patch = await readJsonBody(request);
    requireSupportedPatch(patch, DECISION_PATCH_FIELDS, "decision");
    const decision = await store.transaction((database) => {
      const workspace = requireWorkspace(database, workspaceId, user.id);
      const target = database.decisions.find((entry) => entry.id === decisionId && entry.workspaceId === workspaceId);
      if (!target) throw new HttpError(404, "Decision not found.");
      // A launch approval must never be "decided" by editing its mirror — that would leave the
      // engine's gate parked while Formation claims it was answered. The approvals flow records
      // the answer with the engine first and closes the record only after it confirms.
      if (target.source?.kind === "engine-approval") {
        throw new HttpError(409, "This is a launch approval. Approve or decline it from the approvals flow so the launch engine records your answer.");
      }
      if (patch.title !== undefined) target.title = requireText(patch.title, "Decision title", TEXT_LIMITS.title);
      if (patch.decision !== undefined) target.decision = requireText(patch.decision, "Decision statement", TEXT_LIMITS.long);
      if (patch.rationale !== undefined) target.rationale = requireText(patch.rationale, "Decision rationale", TEXT_LIMITS.long);
      if (patch.owner !== undefined) target.owner = requireText(patch.owner, "Decision owner", TEXT_LIMITS.owner);
      if (patch.status !== undefined) {
        if (!DECISION_STATUSES.has(patch.status)) throw new HttpError(400, "Invalid decision status.");
        target.status = patch.status;
        target.decidedAt = patch.status === "decided" ? target.decidedAt ?? new Date().toISOString().slice(0, 10) : null;
      }
      if (patch.reviewAt !== undefined) target.reviewAt = validDateOrNull(patch.reviewAt);
      target.updatedAt = new Date().toISOString();
      touchWorkspace(database, workspace, user.name, "Decision updated", target.title);
      return target;
    });
    json(response, 200, decision);
    return;
  }

  const tasksCollectionMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/tasks$/);
  if (tasksCollectionMatch && method === "POST") {
    const workspaceId = decodeURIComponent(tasksCollectionMatch[1]);
    const body = await readJsonBody(request);
    const title = requireText(body.title, "Task title", TEXT_LIMITS.short);
    const owner = body.owner === undefined ? user.name : requireText(body.owner, "Task owner", TEXT_LIMITS.owner);
    if (body.status !== undefined && !TASK_STATUSES.has(body.status)) throw new HttpError(400, "Invalid task status.");
    if (body.priority !== undefined && !["critical", "high", "medium", "low"].includes(body.priority)) {
      throw new HttpError(400, "Invalid task priority.");
    }
    const task = await store.transaction((database) => {
      const workspace = requireWorkspace(database, workspaceId, user.id);
      requireWorkstream(workspace, body.workstreamId);
      const now = new Date().toISOString();
      const next = {
        id: createId("tsk"),
        workspaceId,
        workstreamId: body.workstreamId,
        title,
        status: body.status ?? "next",
        priority: body.priority ?? "medium",
        owner,
        dueAt: validDateOrNull(body.dueAt),
        createdAt: now,
        updatedAt: now,
      };
      database.tasks.push(next);
      touchWorkspace(database, workspace, user.name, "Task added", next.title);
      return next;
    });
    json(response, 201, task);
    return;
  }

  const taskMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/tasks\/([^/]+)$/);
  if (taskMatch && method === "PATCH") {
    const workspaceId = decodeURIComponent(taskMatch[1]);
    const taskId = decodeURIComponent(taskMatch[2]);
    const patch = await readJsonBody(request);
    requireSupportedPatch(patch, TASK_PATCH_FIELDS, "task");
    const task = await store.transaction((database) => {
      const workspace = requireWorkspace(database, workspaceId, user.id);
      const target = database.tasks.find((entry) => entry.id === taskId && entry.workspaceId === workspaceId);
      if (!target) throw new HttpError(404, "Task not found.");
      if (patch.title !== undefined) target.title = requireText(patch.title, "Task title", TEXT_LIMITS.short);
      if (patch.status !== undefined) {
        if (!TASK_STATUSES.has(patch.status)) throw new HttpError(400, "Invalid task status.");
        target.status = patch.status;
      }
      if (patch.priority !== undefined) {
        if (!["critical", "high", "medium", "low"].includes(patch.priority)) throw new HttpError(400, "Invalid task priority.");
        target.priority = patch.priority;
      }
      if (patch.owner !== undefined) target.owner = requireText(patch.owner, "Task owner", TEXT_LIMITS.owner);
      if (patch.dueAt !== undefined) target.dueAt = validDateOrNull(patch.dueAt);
      target.updatedAt = new Date().toISOString();
      touchWorkspace(database, workspace, user.name, "Task updated", target.title);
      return target;
    });
    json(response, 200, task);
    return;
  }


}
