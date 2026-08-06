import { assertSameOrigin, getAuthenticatedUser } from "./auth.mjs";
import { HttpError } from "./http.mjs";
import { handleArtifactRoutes } from "./routes/artifacts.mjs";
import { handleEvidenceRoutes } from "./routes/evidence.mjs";
import { handleExecutionRoutes } from "./routes/executions.mjs";
import { handlePublicRoutes } from "./routes/public.mjs";
import { handleWorkspaceRoutes } from "./routes/workspaces.mjs";

export async function handleApi({ request, response, url, store, worker, executionWorker, allowDemoAuth, allowRegistration, authLimiters }) {
  assertSameOrigin(request);
  const method = request.method ?? "GET";
  const pathname = url.pathname;
  const context = { request, response, method, pathname, store, worker, executionWorker, allowDemoAuth, allowRegistration, authLimiters };

  await handlePublicRoutes(context);
  if (response.writableEnded) return;

  const user = await getAuthenticatedUser(store, request);
  if (!user) throw new HttpError(401, "Sign in to continue.");
  const privateContext = { ...context, user };

  await handleWorkspaceRoutes(privateContext);
  if (response.writableEnded) return;
  await handleExecutionRoutes(privateContext);
  if (response.writableEnded) return;
  await handleEvidenceRoutes(privateContext);
  if (response.writableEnded) return;
  await handleArtifactRoutes(privateContext);
  if (response.writableEnded) return;

  throw new HttpError(404, "API route not found.");
}
