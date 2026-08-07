import { assertSameOrigin, getAuthenticatedUser } from "./auth.mjs";
import { HttpError } from "./http.mjs";
import { handleAccountRoutes } from "./routes/account.mjs";
import { handleApprovalRoutes } from "./routes/approvals.mjs";
import { handleArtifactRoutes } from "./routes/artifacts.mjs";
import { handleCommentRoutes } from "./routes/comments.mjs";
import { handleReviewRoutes } from "./routes/reviews.mjs";
import { handleEvidenceRoutes } from "./routes/evidence.mjs";
import { handleExecutionRoutes } from "./routes/executions.mjs";
import { handleImportRoutes } from "./routes/imports.mjs";
import { handleMemberRoutes } from "./routes/members.mjs";
import { handlePublicRoutes } from "./routes/public.mjs";
import { handleShareRoutes, handleSharedRead } from "./routes/sharing.mjs";
import { handleWorkspaceRoutes } from "./routes/workspaces.mjs";

export async function handleApi({ request, response, url, store, worker, executionWorker, importService, allowDemoAuth, allowRegistration, authLimiters }) {
  assertSameOrigin(request);
  const method = request.method ?? "GET";
  const pathname = url.pathname;
  const context = { request, response, method, pathname, store, worker, executionWorker, importService, allowDemoAuth, allowRegistration, authLimiters };

  await handlePublicRoutes(context);
  if (response.writableEnded) return;
  // The one authenticated-by-token read: the person holding a shared link has no account.
  await handleSharedRead(context);
  if (response.writableEnded) return;

  const user = await getAuthenticatedUser(store, request);
  if (!user) throw new HttpError(401, "Sign in to continue.");
  const privateContext = { ...context, user };

  await handleAccountRoutes(privateContext);
  if (response.writableEnded) return;
  await handleWorkspaceRoutes(privateContext);
  if (response.writableEnded) return;
  await handleMemberRoutes(privateContext);
  if (response.writableEnded) return;
  await handleShareRoutes(privateContext);
  if (response.writableEnded) return;
  await handleExecutionRoutes(privateContext);
  if (response.writableEnded) return;
  await handleImportRoutes(privateContext);
  if (response.writableEnded) return;
  await handleApprovalRoutes(privateContext);
  if (response.writableEnded) return;
  await handleEvidenceRoutes(privateContext);
  if (response.writableEnded) return;
  await handleCommentRoutes(privateContext);
  if (response.writableEnded) return;
  await handleReviewRoutes(privateContext);
  if (response.writableEnded) return;
  await handleArtifactRoutes(privateContext);
  if (response.writableEnded) return;

  throw new HttpError(404, "API route not found.");
}
