import http from "node:http";
import path from "node:path";
import { AuthRateLimiter } from "./auth.mjs";
import { handleApi } from "./api.mjs";
import { createId } from "./domain.mjs";
import { GenerationWorker } from "./generation.mjs";
import { applySecurityHeaders, defaultDistDir, json, normalizeError, serveApplication } from "./http.mjs";

export function createFormationServer({
  store,
  distDir,
  allowDemoAuth = process.env.NODE_ENV !== "production",
  allowRegistration = process.env.ALLOW_REGISTRATION !== "false",
} = {}) {
  if (!store) throw new Error("createFormationServer requires a store.");
  const worker = new GenerationWorker(store);
  const authLimiters = {
    account: new AuthRateLimiter({ maximumFailures: 7 }),
    address: new AuthRateLimiter({ maximumFailures: 35 }),
  };
  const staticRoot = distDir ? path.resolve(distDir) : null;
  const server = http.createServer(async (request, response) => {
    const requestId = createId("req");
    applySecurityHeaders(response, requestId);

    try {
      const url = new URL(request.url ?? "/", requestOrigin(request));
      if (url.pathname.startsWith("/api/")) {
        await handleApi({ request, response, url, store, worker, allowDemoAuth, allowRegistration, authLimiters });
      } else {
        await serveApplication({ request, response, url, staticRoot });
      }
    } catch (error) {
      const normalized = normalizeError(error);
      if (!response.headersSent) {
        if (normalized.retryAfterSeconds) response.setHeader("retry-after", String(normalized.retryAfterSeconds));
        json(response, normalized.status, {
          error: normalized.message,
          requestId,
          ...(process.env.NODE_ENV === "development" && normalized.cause ? { detail: normalized.cause } : {}),
        });
      } else {
        response.destroy();
      }
    }
  });

  server.on("listening", () => worker.start());
  server.on("close", () => worker.stop());
  return { server, worker };
}

function requestOrigin(request) {
  const protocol = request.socket?.encrypted === true ? "https" : "http";
  return [protocol, "://", request.headers.host ?? "localhost"].join("");
}

export { defaultDistDir };
