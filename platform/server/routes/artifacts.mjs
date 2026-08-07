import { applyArtifactPatch, createArtifactVersion } from "../domain.mjs";
import { HttpError, json } from "../http.mjs";
import { TEXT_LIMITS, normalizeArtifactPatch, optionalText, readJsonBody, requireText } from "../validation.mjs";
import { requireWorkspace, requireWorkstream, touchWorkspace } from "./shared.mjs";

export async function handleArtifactRoutes({ request, response, method, pathname, store, user, worker }) {
  const artifactMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/artifacts\/([^/]+)$/);
  if (artifactMatch && method === "PATCH") {
    const workspaceId = decodeURIComponent(artifactMatch[1]);
    const artifactId = decodeURIComponent(artifactMatch[2]);
    const patch = normalizeArtifactPatch(await readJsonBody(request));
    const artifact = await store.transaction((database) => {
      const workspace = requireWorkspace(database, workspaceId, user.id, "work-write");
      const index = database.artifacts.findIndex((entry) => entry.id === artifactId && entry.workspaceId === workspaceId);
      if (index < 0) throw new HttpError(404, "Deliverable not found.");
      if (patch.sourceClaimIds) {
        const validClaimIds = new Set(database.claims.filter((entry) => entry.workspaceId === workspaceId).map((entry) => entry.id));
        if (patch.sourceClaimIds.some((id) => !validClaimIds.has(id))) throw new HttpError(400, "A source claim does not belong to this workspace.");
      }
      if (patch.linkedDecisionIds) {
        const validDecisionIds = new Set(database.decisions.filter((entry) => entry.workspaceId === workspaceId).map((entry) => entry.id));
        if (patch.linkedDecisionIds.some((id) => !validDecisionIds.has(id))) throw new HttpError(400, "A linked decision does not belong to this workspace.");
      }
      const next = applyArtifactPatch(database.artifacts[index], { ...patch, confirmedBy: user.name });
      database.artifacts[index] = next;
      database.artifactVersions.push(createArtifactVersion(next, user.name));
      touchWorkspace(database, workspace, user.name, `${next.title} updated`, `Version ${next.version} saved.`);
      return next;
    });
    json(response, 200, artifact);
    return;
  }

  const generationMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/generate$/);
  if (generationMatch && method === "POST") {
    const workspaceId = decodeURIComponent(generationMatch[1]);
    const body = await readJsonBody(request);
    const database = await store.read();
    const workspace = requireWorkspace(database, workspaceId, user.id, "generation-request");
    requireWorkstream(workspace, body.workstreamId);
    const artifactType = body.artifactType === undefined || body.artifactType === null
      ? null
      : requireText(body.artifactType, "Deliverable type", TEXT_LIMITS.artifactType);
    const instruction = body.instruction === undefined
      ? ""
      : optionalText(body.instruction, "Founder direction", TEXT_LIMITS.instruction, { allowEmpty: true });
    const job = await worker.enqueue({
      workspaceId,
      workstreamId: body.workstreamId,
      artifactType,
      instruction,
      requestedBy: user.name,
    });
    json(response, 202, job);
    return;
  }

  const jobMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/jobs\/([^/]+)$/);
  if (jobMatch && method === "GET") {
    const workspaceId = decodeURIComponent(jobMatch[1]);
    const jobId = decodeURIComponent(jobMatch[2]);
    const database = await store.read();
    requireWorkspace(database, workspaceId, user.id, "workspace-read");
    const job = database.jobs.find((entry) => entry.id === jobId && entry.workspaceId === workspaceId);
    if (!job) throw new HttpError(404, "Generation job not found.");
    json(response, 200, job);
    return;
  }

}
