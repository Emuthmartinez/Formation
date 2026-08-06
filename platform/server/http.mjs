import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { AuthError } from "./auth.mjs";
import { GenerationError } from "./generation.mjs";

export async function serveApplication({ request, response, url, staticRoot }) {
  if (!["GET", "HEAD"].includes(request.method ?? "GET")) throw new HttpError(405, "Method not allowed.");
  if (!staticRoot) throw new HttpError(404, "The web application has not been built.");

  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.resolve(staticRoot, `.${requested}`);
  const rootPrefix = `${staticRoot}${path.sep}`;
  if (safePath !== staticRoot && !safePath.startsWith(rootPrefix)) throw new HttpError(400, "Invalid path.");

  let filePath = safePath;
  try {
    const details = await stat(filePath);
    if (details.isDirectory()) filePath = path.join(filePath, "index.html");
    await access(filePath);
  } catch {
    if (path.extname(url.pathname)) throw new HttpError(404, "Static asset not found.");
    filePath = path.join(staticRoot, "index.html");
  }

  const extension = path.extname(filePath).toLowerCase();
  response.statusCode = 200;
  response.setHeader("content-type", contentType(extension));
  response.setHeader("cache-control", filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable");
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  await pipeline(createReadStream(filePath), response);
}


export function applySecurityHeaders(response, requestId) {
  response.setHeader("x-request-id", requestId);
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  response.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("cross-origin-opener-policy", "same-origin");
  response.setHeader("x-frame-options", "DENY");
  if (process.env.NODE_ENV === "production") {
    response.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");
  }
  response.setHeader(
    "content-security-policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  );
}

export function json(response, status, payload) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(`${JSON.stringify(payload)}\n`);
}

function contentType(extension) {
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon",
  }[extension] ?? "application/octet-stream";
}

export function normalizeError(error) {
  if (error instanceof HttpError || error instanceof AuthError || error instanceof GenerationError) {
    return {
      status: error.status,
      message: error.message,
      retryAfterSeconds: error.metadata?.retryAfterSeconds,
    };
  }
  return {
    status: 500,
    message: "Formation could not complete the request.",
    cause: error instanceof Error ? error.stack ?? error.message : String(error),
  };
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const defaultDistDir = path.resolve(moduleDir, "../dist");
