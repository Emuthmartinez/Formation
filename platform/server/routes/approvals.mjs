import { HttpError, json } from "../http.mjs";
import { TEXT_LIMITS, optionalText, readJsonBody } from "../validation.mjs";
import { requireWorkspace } from "./shared.mjs";

/**
 * Founder approvals: the platform surface of the launch engine's parked founder gates.
 * Listing mirrors what the engine is asking into the decision system; answering travels back
 * through the engine's own sanctioned path (core/session/approve.ts) via the execution worker.
 * Membership is checked server-side for both; answering additionally requires the owner role.
 */

const ANSWER_FIELDS = new Set(["answer", "reason"]);

export async function handleApprovalRoutes({ request, response, method, pathname, store, executionWorker, user }) {
  const collectionMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/approvals$/);
  if (collectionMatch) {
    if (method !== "GET") throw new HttpError(405, "Method not allowed.");
    const workspaceId = decodeURIComponent(collectionMatch[1]);
    const database = await store.read();
    const workspace = requireWorkspace(database, workspaceId, user.id, "workspace-read");
    json(response, 200, await executionWorker.syncApprovals(workspace, user.id));
    return;
  }

  const answerMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/approvals\/([^/]+)$/);
  if (answerMatch) {
    if (method !== "POST") throw new HttpError(405, "Method not allowed.");
    const workspaceId = decodeURIComponent(answerMatch[1]);
    const decisionId = decodeURIComponent(answerMatch[2]);
    const body = await readJsonBody(request);
    for (const key of Object.keys(body)) {
      if (!ANSWER_FIELDS.has(key)) throw new HttpError(400, "Only answer and reason may be provided with an approval answer.");
    }
    if (body.answer !== "approve" && body.answer !== "decline") throw new HttpError(400, "Answer must be approve or decline.");
    const reason = body.reason === undefined || body.reason === null ? undefined : optionalText(body.reason, "Reason", TEXT_LIMITS.medium, { allowEmpty: true }) || undefined;
    const decision = await executionWorker.answerApproval({ workspaceId, user, decisionId, answer: body.answer, reason });
    json(response, 200, decision);
    return;
  }
}
