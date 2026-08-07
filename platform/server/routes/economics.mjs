import { BILLING_PERIODS, ECONOMICS_LIMITS, EconomicsError, createScenario, deleteScenario, updateScenario } from "../domain/economics.mjs";
import { HttpError, json } from "../http.mjs";
import { TEXT_LIMITS, optionalText, readJsonBody, requireText } from "../validation.mjs";
import { assertUnchanged, requireWorkspace, touchWorkspace } from "./shared.mjs";

/**
 * The company's economics as structured assumptions.
 *
 * Scenarios travel in the workspace snapshot with their derivations already computed, so there is
 * no read route. Writing sits behind `company-write`: the capability ladder already names business
 * model and pricing as the company's source of truth, and a scenario is that source of truth with
 * the numbers pulled out of the prose.
 *
 * Amounts cross the wire in minor units — pence, cents — as integers. A planning model that
 * accumulates float error eventually disagrees with itself about a number the founder typed in
 * exactly, and rejecting `79.5` at the boundary is cheaper than explaining that later.
 */

const CREATE_FIELDS = new Set(["name", "currency"]);
const PATCH_FIELDS = new Set([
  "name",
  "notes",
  "price",
  "conversion",
  "retention",
  "variableCostPerCustomer",
  "acquisitionCost",
  "capacity",
  "cash",
  "isPrimary",
  "expectedUpdatedAt",
]);

function speakHttp(error) {
  if (error instanceof EconomicsError) throw new HttpError(error.status, error.message);
  throw error;
}

export async function handleEconomicsRoutes({ request, response, method, pathname, store, user }) {
  const collectionMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/economics\/scenarios$/);
  if (collectionMatch) {
    if (method !== "POST") throw new HttpError(405, "Method not allowed.");
    const workspaceId = decodeURIComponent(collectionMatch[1]);
    const body = await readJsonBody(request);
    for (const key of Object.keys(body)) {
      if (!CREATE_FIELDS.has(key)) throw new HttpError(400, "Only name and currency may be provided when adding a scenario.");
    }
    const name = requireText(body.name, "Scenario name", ECONOMICS_LIMITS.name);
    const currency = body.currency === undefined ? "GBP" : requireText(body.currency, "Currency", 3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new HttpError(400, "A currency is a three-letter code.");

    const scenario = await store.transaction((database) => {
      const workspace = requireWorkspace(database, workspaceId, user.id, "company-write");
      try {
        const created = createScenario(database, workspace, { name, currency, actor: user }, new Date().toISOString());
        touchWorkspace(database, workspace, user.name, `Pricing scenario added: ${name}`, "A scenario records the numbers rather than describing them.");
        return created;
      } catch (error) {
        speakHttp(error);
      }
    });
    json(response, 201, scenario);
    return;
  }

  const detailMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/economics\/scenarios\/([^/]+)$/);
  if (detailMatch) {
    const workspaceId = decodeURIComponent(detailMatch[1]);
    const scenarioId = decodeURIComponent(detailMatch[2]);

    if (method === "PATCH") {
      const patch = await readJsonBody(request);
      for (const key of Object.keys(patch)) {
        if (!PATCH_FIELDS.has(key)) throw new HttpError(400, `A scenario has no "${key}" to change.`);
      }
      if (patch.name !== undefined) patch.name = requireText(patch.name, "Scenario name", ECONOMICS_LIMITS.name);
      if (patch.notes !== undefined) patch.notes = optionalText(patch.notes, "Scenario notes", ECONOMICS_LIMITS.notes, { allowEmpty: true });
      if (patch.price?.per !== undefined && !BILLING_PERIODS.includes(patch.price.per)) {
        throw new HttpError(400, "A price is charged monthly, yearly, or once.");
      }

      const scenario = await store.transaction((database) => {
        const workspace = requireWorkspace(database, workspaceId, user.id, "company-write");
        const existing = (workspace.economics?.scenarios ?? []).find((entry) => entry.id === scenarioId);
        if (!existing) throw new HttpError(404, "That scenario is no longer here.");
        assertUnchanged(existing, { updatedAt: patch.expectedUpdatedAt }, "version of this scenario");
        try {
          return updateScenario(database, workspace, scenarioId, patch, user, new Date().toISOString());
        } catch (error) {
          speakHttp(error);
        }
      });
      json(response, 200, scenario);
      return;
    }

    if (method === "DELETE") {
      const result = await store.transaction((database) => {
        const workspace = requireWorkspace(database, workspaceId, user.id, "company-write");
        try {
          return deleteScenario(database, workspace, scenarioId);
        } catch (error) {
          speakHttp(error);
        }
      });
      json(response, 200, result);
      return;
    }

    throw new HttpError(405, "Method not allowed.");
  }
}
