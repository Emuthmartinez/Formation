import { buildWorkspaceSnapshot } from "../domain.mjs";
import { EXPORT_FORMATS, buildExportBundle, renderEconomicsCsv, renderExportMarkdown } from "../domain/exports.mjs";
import { HttpError } from "../http.mjs";
import { requireWorkspace } from "./shared.mjs";

/**
 * Taking the work out.
 *
 * Reading, so it sits behind `workspace-read` — an export contains exactly what the member asking
 * for it could already see on screen, built from the same snapshot rather than from a second pass
 * over the database. That is the property worth having: there is no path by which an export can
 * carry something the snapshot would not.
 *
 * The response is a download with a filename, because a founder asking for a bundle wants a file
 * rather than a wall of JSON in a browser tab.
 */

const CONTENT_TYPES = Object.freeze({
  json: "application/json; charset=utf-8",
  markdown: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
});
const EXTENSIONS = Object.freeze({ json: "json", markdown: "md", csv: "csv" });

/** A filename a filesystem will accept, from a company name that may contain anything. */
function fileNameFor(company, format, now) {
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "company";
  return `${slug}-${now.slice(0, 10)}.${EXTENSIONS[format]}`;
}

export async function handleExportRoutes({ response, method, pathname, url, store, user }) {
  const match = pathname.match(/^\/api\/workspaces\/([^/]+)\/export$/);
  if (!match) return;
  if (method !== "GET") throw new HttpError(405, "Method not allowed.");

  const workspaceId = decodeURIComponent(match[1]);
  const format = url.searchParams.get("format") ?? "markdown";
  if (!EXPORT_FORMATS.includes(format)) throw new HttpError(400, "Formation exports as markdown, json, or csv.");

  const database = await store.read();
  requireWorkspace(database, workspaceId, user.id, "workspace-read");
  const snapshot = buildWorkspaceSnapshot(database, workspaceId, user.id);
  if (!snapshot) throw new HttpError(404, "Workspace not found.");

  const now = new Date().toISOString();
  const bundle = buildExportBundle(snapshot, { exportedBy: user.name, now });
  const body = format === "json" ? `${JSON.stringify(bundle, null, 2)}\n` : format === "csv" ? renderEconomicsCsv(bundle) : renderExportMarkdown(bundle);

  response.statusCode = 200;
  response.setHeader("content-type", CONTENT_TYPES[format]);
  response.setHeader("content-disposition", `attachment; filename="${fileNameFor(bundle.company.name, format, now)}"`);
  response.end(body);
}
