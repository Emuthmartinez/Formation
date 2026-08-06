import { buildWorkspaceSnapshot, createWorkspaceFromBrief } from "../domain.mjs";
import { HttpError, json } from "../http.mjs";
import {
  COMPANY_FIELDS,
  TEXT_LIMITS,
  WORKSPACE_PATCH_FIELDS,
  WORKSPACE_STAGES,
  WORKSTREAM_PATCH_FIELDS,
  WORKSTREAM_STATUSES,
  boundedInteger,
  humanizeField,
  normalizeWorkspaceBrief,
  optionalText,
  readJsonBody,
  requireSupportedPatch,
  requireText,
  textList,
  validDateOrNull,
} from "../validation.mjs";
import { requireWorkspace, touchWorkspace } from "./shared.mjs";

export async function handleWorkspaceRoutes({ request, response, method, pathname, store, user }) {
  if (method === "GET" && pathname === "/api/session") {
    const database = await store.read();
    const memberships = database.memberships.filter((entry) => entry.userId === user.id);
    json(response, 200, {
      user,
      workspaces: memberships
        .map((membership) => {
          const workspace = database.workspaces.find((entry) => entry.id === membership.workspaceId);
          return workspace
            ? {
                id: workspace.id,
                slug: workspace.slug,
                name: workspace.name,
                stage: workspace.stage,
                launchTarget: workspace.launchTarget,
                role: membership.role,
                updatedAt: workspace.updatedAt,
              }
            : null;
        })
        .filter(Boolean),
    });
    return;
  }

  if (method === "GET" && pathname === "/api/workspaces") {
    const database = await store.read();
    const workspaceIds = new Set(
      database.memberships.filter((entry) => entry.userId === user.id).map((entry) => entry.workspaceId),
    );
    json(
      response,
      200,
      database.workspaces
        .filter((workspace) => workspaceIds.has(workspace.id))
        .map((workspace) => ({
          id: workspace.id,
          slug: workspace.slug,
          name: workspace.name,
          stage: workspace.stage,
          launchTarget: workspace.launchTarget,
          oneLiner: workspace.company.oneLiner,
          updatedAt: workspace.updatedAt,
        })),
    );
    return;
  }

  if (method === "POST" && pathname === "/api/workspaces") {
    const brief = normalizeWorkspaceBrief(await readJsonBody(request));

    const workspace = await store.transaction((database) => {
      const bundle = createWorkspaceFromBrief({
        brief,
        userId: user.id,
        existingSlugs: database.workspaces.map((entry) => entry.slug),
      });
      database.workspaces.push(bundle.workspace);
      database.memberships.push(bundle.membership);
      database.claims.push(...bundle.claims);
      database.decisions.push(...bundle.decisions);
      database.artifacts.push(...bundle.artifacts);
      database.artifactVersions.push(...bundle.artifactVersions);
      database.tasks.push(...bundle.tasks);
      database.activity.push(...bundle.activity);
      return bundle.workspace;
    });
    json(response, 201, workspace);
    return;
  }

  const workspaceMatch = pathname.match(/^\/api\/workspaces\/([^/]+)$/);
  if (workspaceMatch) {
    const workspaceId = decodeURIComponent(workspaceMatch[1]);
    if (method === "GET") {
      const database = await store.read();
      const snapshot = buildWorkspaceSnapshot(database, workspaceId, user.id);
      if (!snapshot) throw new HttpError(404, "Workspace not found.");
      json(response, 200, snapshot);
      return;
    }
    if (method === "PATCH") {
      const patch = await readJsonBody(request);
      requireSupportedPatch(patch, WORKSPACE_PATCH_FIELDS, "company operating context");
      const updated = await store.transaction((database) => {
        const workspace = requireWorkspace(database, workspaceId, user.id);
        if (patch.name !== undefined) workspace.name = requireText(patch.name, "Company name", TEXT_LIMITS.name);
        if (patch.stage !== undefined) {
          if (!WORKSPACE_STAGES.has(patch.stage)) throw new HttpError(400, "Invalid company stage.");
          workspace.stage = patch.stage;
        }
        if (patch.launchTarget !== undefined) workspace.launchTarget = validDateOrNull(patch.launchTarget);
        if (patch.founder !== undefined) {
          if (!patch.founder || typeof patch.founder !== "object" || Array.isArray(patch.founder)) {
            throw new HttpError(400, "Founder must be an object.");
          }
          if (patch.founder.name !== undefined) workspace.founder.name = requireText(patch.founder.name, "Founder name", TEXT_LIMITS.name);
          if (patch.founder.role !== undefined) workspace.founder.role = requireText(patch.founder.role, "Founder role", TEXT_LIMITS.owner);
          if (patch.founder.weeklyHours !== undefined) workspace.founder.weeklyHours = boundedInteger(patch.founder.weeklyHours, 1, 100, "Founder hours");
        }
        touchWorkspace(database, workspace, user.name, "Company operating context updated", "Stage, launch target, or founder capacity changed.");
        return workspace;
      });
      json(response, 200, updated);
      return;
    }
    throw new HttpError(405, "Method not allowed.");
  }

  const companyMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/company$/);
  if (companyMatch && method === "PATCH") {
    const workspaceId = decodeURIComponent(companyMatch[1]);
    const patch = await readJsonBody(request);
    requireSupportedPatch(patch, COMPANY_FIELDS, "company source of truth");
    const updated = await store.transaction((database) => {
      const workspace = requireWorkspace(database, workspaceId, user.id);
      for (const [key, value] of Object.entries(patch)) {
        if (!COMPANY_FIELDS.has(key)) continue;
        if (key === "constraints") {
          workspace.company.constraints = textList(value, "Constraints", 20, TEXT_LIMITS.listItem);
        } else {
          workspace.company[key] = optionalText(value, humanizeField(key), TEXT_LIMITS.long, { allowEmpty: true });
        }
      }
      touchWorkspace(database, workspace, user.name, "Company context updated", "The durable business source of truth changed.");
      return workspace.company;
    });
    json(response, 200, updated);
    return;
  }

  const workstreamMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/workstreams\/([^/]+)$/);
  if (workstreamMatch && method === "PATCH") {
    const workspaceId = decodeURIComponent(workstreamMatch[1]);
    const workstreamId = decodeURIComponent(workstreamMatch[2]);
    const patch = await readJsonBody(request);
    requireSupportedPatch(patch, WORKSTREAM_PATCH_FIELDS, "workstream");
    const updated = await store.transaction((database) => {
      const workspace = requireWorkspace(database, workspaceId, user.id);
      const workstream = workspace.workstreams.find((entry) => entry.id === workstreamId);
      if (!workstream) throw new HttpError(404, "Workstream not found.");

      for (const key of ["summary", "nextAction", "rationale"]) {
        if (patch[key] !== undefined) workstream[key] = optionalText(patch[key], humanizeField(key), TEXT_LIMITS.medium, { allowEmpty: true });
      }
      for (const key of ["facts", "assumptions", "questions"]) {
        if (patch[key] !== undefined) {
          workstream[key] = textList(patch[key], humanizeField(key), 30, TEXT_LIMITS.listItem);
        }
      }
      if (patch.status !== undefined) {
        if (!WORKSTREAM_STATUSES.has(patch.status)) throw new HttpError(400, "Invalid workstream status.");
        workstream.status = patch.status;
      }
      if (patch.progress !== undefined) workstream.progress = boundedInteger(patch.progress, 0, 100, "Progress");
      if (patch.confidence !== undefined) workstream.confidence = boundedInteger(patch.confidence, 0, 100, "Confidence");
      touchWorkspace(database, workspace, user.name, `${workstream.title} updated`, "The workstream context and next action changed.");
      return workstream;
    });
    json(response, 200, updated);
    return;
  }


}
