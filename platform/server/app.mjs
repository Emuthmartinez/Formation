import http from "node:http";
import path from "node:path";
import { AuthRateLimiter } from "./auth.mjs";
import { handleApi } from "./api.mjs";
import { createId } from "./domain.mjs";
import { ExecutionWorker } from "./execution.mjs";
import { GenerationWorker } from "./generation.mjs";
import { applySecurityHeaders, defaultDistDir, json, normalizeError, serveApplication } from "./http.mjs";

export function createFormationServer({
  store,
  distDir,
  allowDemoAuth = process.env.NODE_ENV !== "production",
  allowRegistration = process.env.ALLOW_REGISTRATION !== "false",
  execution,
} = {}) {
  if (!store) throw new Error("createFormationServer requires a store.");
  const worker = new GenerationWorker(store);
  const executionWorker = new ExecutionWorker(store, execution);
  const authLimiters = {
    account: new AuthRateLimiter({ maximumFailures: 7 }),
    address: new AuthRateLimiter({ maximumFailures: 35 }),
    // Redeeming an invitation is not signing in, and it must not share a bucket with it. Keyed on
    // the device only — there is no account to key on until the link is accepted — with room for
    // several people behind one address to each mistype a link.
    invitation: new AuthRateLimiter({
      maximumFailures: 20,
      message: "Too many invitation links have been tried from this device. Wait a few minutes and try again.",
    }),
    // Every read of a shared link pays this one, hit or miss: answering the route reads the whole
    // store, and nothing about the caller is known. The ceiling is far above what reading a
    // document looks like, and far below what a flood looks like.
    sharedRead: new AuthRateLimiter({
      maximumFailures: 300,
      message: "Formation is receiving too many requests from this device. Wait a few minutes and try again.",
    }),
  };
  const staticRoot = distDir ? path.resolve(distDir) : null;
  const server = http.createServer(async (request, response) => {
    const requestId = createId("req");
    applySecurityHeaders(response, requestId);

    try {
      const url = new URL(request.url ?? "/", requestOrigin(request));
      if (url.pathname.startsWith("/api/")) {
        await handleApi({ request, response, url, store, worker, executionWorker, allowDemoAuth, allowRegistration, authLimiters });
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

  server.on("listening", () => {
    worker.start();
    executionWorker.start();
  });
  server.on("close", () => {
    worker.stop();
    executionWorker.stop();
  });
  return { server, worker, executionWorker };
}

function requestOrigin(request) {
  const protocol = request.socket?.encrypted === true ? "https" : "http";
  return [protocol, "://", request.headers.host ?? "localhost"].join("");
}

export { defaultDistDir };
