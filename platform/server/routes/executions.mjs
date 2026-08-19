import { toFounderExecution } from "../execution.mjs";
import { HttpError, json } from "../http.mjs";
import { readJsonBody } from "../validation.mjs";
import { requireWorkspace } from "./shared.mjs";

const EXECUTION_REQUEST_FIELDS = new Set(["workflowId"]);

function normalizeWorkflowId(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new HttpError(400, "workflowId must be a string.");
  const trimmed = value.trim();
  // Stable catalog ids are dot-separated kebab segments, e.g. workflow.engineering.backend-data-contract.
  if (!/^workflow(\.[a-z0-9][a-z0-9-]*)+$/.test(trimmed) || trimmed.length > 200) {
    throw new HttpError(400, "workflowId must be a stable launch-plan step id.");
  }
  return trimmed;
}

export async function handleExecutionRoutes({ request, response, method, pathname, store, executionWorker, user }) {
  const matrixMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/launch-matrix$/);
  if (matrixMatch) {
    if (method !== "GET") throw new HttpError(405, "Method not allowed.");
    const workspaceId = decodeURIComponent(matrixMatch[1]);
    const database = await store.read();
    const workspace = requireWorkspace(database, workspaceId, user.id, "workspace-read");
    json(response, 200, await executionWorker.launchMatrix(workspace));
    return;
  }

  const collectionMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/executions$/);
  if (collectionMatch) {
    const workspaceId = decodeURIComponent(collectionMatch[1]);

    if (method === "GET") {
      const database = await store.read();
      requireWorkspace(database, workspaceId, user.id, "workspace-read");
      const executions = database.executions
        .filter((entry) => entry.workspaceId === workspaceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(toFounderExecution);
      // The capability travels on the page's actual read path (Codex round 2): the founder
      // learns whether the skill can do hands-on steps itself BEFORE asking for work, not from
      // a detail view they only reach afterwards.
      json(response, 200, { executions, selfServeExecution: executionWorker.selfServeExecution() });
      return;
    }

    if (method === "POST") {
      // An empty body is a valid request ("run whatever is ready"); unknown fields are not.
      const body = await readJsonBody(request);
      for (const key of Object.keys(body)) {
        if (!EXECUTION_REQUEST_FIELDS.has(key)) throw new HttpError(400, "Only workflowId may be provided with an execution request.");
      }
      const workflowId = normalizeWorkflowId(body.workflowId);
      const { execution, resumed } = await executionWorker.submit({ workspaceId, user, workflowId });
      json(response, resumed ? 200 : 201, { ...toFounderExecution(execution), resumed });
      return;
    }

    throw new HttpError(405, "Method not allowed.");
  }

  const detailMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/executions\/([^/]+)$/);
  if (detailMatch) {
    if (method !== "GET") throw new HttpError(405, "Method not allowed.");
    const workspaceId = decodeURIComponent(detailMatch[1]);
    const executionId = decodeURIComponent(detailMatch[2]);

    const database = await store.read();
    const workspace = requireWorkspace(database, workspaceId, user.id, "workspace-read");
    const execution = database.executions.find((entry) => entry.id === executionId && entry.workspaceId === workspaceId);
    if (!execution) throw new HttpError(404, "Execution not found.");

    // The live skill answer travels alongside the durable record. When the skill cannot be
    // reached, that is said explicitly — the stored report is the last known state, never a
    // stand-in for a fresh one.
    const engine = await executionWorker.inspect(workspace);
    json(response, 200, { ...toFounderExecution(execution), engineState: engine });
    return;
  }
}
