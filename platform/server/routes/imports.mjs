import { HttpError, json } from "../http.mjs";
import { ImportError } from "../imports.mjs";
import { readJsonBody } from "../validation.mjs";
import { requireWorkspace } from "./shared.mjs";

/**
 * Bringing a company's existing launch work into Formation.
 *
 * Three surfaces, all behind `launch-import` (owner only): list what could be brought in, show
 * exactly what an import would do, and do it. The preview is a POST because it takes a body, not
 * because it writes — it writes nothing, and the plan it returns is the same computation the apply
 * runs, so the founder is never shown a rehearsal that differs from the performance.
 *
 * The request names a source id, never a path. See `server/imports.mjs` for why that distinction
 * is the whole of the security posture here.
 */

const IMPORT_REQUEST_FIELDS = new Set(["sourceId"]);

function readSourceId(body) {
  for (const key of Object.keys(body)) {
    if (!IMPORT_REQUEST_FIELDS.has(key)) throw new HttpError(400, "Only sourceId may be provided with an import request.");
  }
  if (typeof body.sourceId !== "string" || !body.sourceId.trim()) {
    throw new HttpError(400, "Name which launch workspace to bring in.");
  }
  return body.sourceId.trim();
}

/** The service speaks its own error type; the API speaks HTTP. One translation, in one place. */
async function speakingHttp(work) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ImportError) throw new HttpError(error.status, error.message);
    throw error;
  }
}

export async function handleImportRoutes({ request, response, method, pathname, store, importService, user }) {
  const sourcesMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/import-sources$/);
  if (sourcesMatch) {
    if (method !== "GET") throw new HttpError(405, "Method not allowed.");
    const workspaceId = decodeURIComponent(sourcesMatch[1]);
    const database = await store.read();
    requireWorkspace(database, workspaceId, user.id, "launch-import");
    json(response, 200, importService.listSources());
    return;
  }

  const previewMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/imports\/preview$/);
  if (previewMatch) {
    if (method !== "POST") throw new HttpError(405, "Method not allowed.");
    const workspaceId = decodeURIComponent(previewMatch[1]);
    const body = await readJsonBody(request);
    const sourceId = readSourceId(body);
    const database = await store.read();
    const workspace = requireWorkspace(database, workspaceId, user.id, "launch-import");
    const plan = await speakingHttp(() => importService.preview({ workspace, sourceId }));
    json(response, 200, plan);
    return;
  }

  const applyMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/imports$/);
  if (applyMatch) {
    if (method !== "POST") throw new HttpError(405, "Method not allowed.");
    const workspaceId = decodeURIComponent(applyMatch[1]);
    const body = await readJsonBody(request);
    const sourceId = readSourceId(body);
    const database = await store.read();
    const workspace = requireWorkspace(database, workspaceId, user.id, "launch-import");
    const result = await speakingHttp(() => importService.apply({ workspace, sourceId, actor: user.name ?? "Founder" }));
    json(response, 201, result);
    return;
  }
}
