import { HttpError } from "./http.mjs";

const BODY_LIMIT_BYTES = 1_000_000;
const COMPANY_FIELDS = new Set([
  "oneLiner",
  "thesis",
  "targetCustomer",
  "problem",
  "solution",
  "positioning",
  "differentiation",
  "businessModel",
  "pricing",
  "northStarMetric",
  "currentGoal",
  "constraints",
]);
const WORKSPACE_STAGES = new Set(["idea", "discovery", "validation", "build", "beta", "launch", "growth"]);
const WORKSPACE_PATCH_FIELDS = new Set(["name", "stage", "launchTarget", "founder"]);
const WORKSTREAM_PATCH_FIELDS = new Set(["summary", "nextAction", "rationale", "facts", "assumptions", "questions", "status", "progress", "confidence"]);
const CLAIM_PATCH_FIELDS = new Set(["kind", "statement", "key", "value", "confidence", "status", "evidence"]);
const DECISION_PATCH_FIELDS = new Set(["title", "decision", "rationale", "owner", "status", "reviewAt"]);
const TASK_PATCH_FIELDS = new Set(["title", "status", "priority", "owner", "dueAt"]);
const WORKSTREAM_STATUSES = new Set(["not-started", "on-track", "needs-attention", "blocked", "complete"]);
const DECISION_STATUSES = new Set(["open", "proposed", "decided", "revisit", "superseded"]);
const TASK_STATUSES = new Set(["backlog", "next", "in-progress", "blocked", "done"]);
const CLAIM_KINDS = new Set(["fact", "assumption", "recommendation", "question"]);
const TEXT_LIMITS = Object.freeze({
  name: 120,
  owner: 120,
  key: 240,
  title: 300,
  short: 500,
  medium: 4_000,
  long: 20_000,
  listItem: 2_000,
  instruction: 5_000,
  artifactType: 120,
});

export {
  CLAIM_KINDS,
  CLAIM_PATCH_FIELDS,
  COMPANY_FIELDS,
  DECISION_PATCH_FIELDS,
  DECISION_STATUSES,
  TASK_PATCH_FIELDS,
  TASK_STATUSES,
  TEXT_LIMITS,
  WORKSPACE_PATCH_FIELDS,
  WORKSPACE_STAGES,
  WORKSTREAM_PATCH_FIELDS,
  WORKSTREAM_STATUSES,
};

export function requireSupportedPatch(patch, supportedFields, label) {
  const supported = Object.keys(patch).filter((key) => supportedFields.has(key));
  if (!supported.length) throw new HttpError(400, `No supported ${label} changes were provided.`);
}

export async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > BODY_LIMIT_BYTES) throw new HttpError(413, "Request body is too large.");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  const source = Buffer.concat(chunks).toString("utf8");
  try {
    const payload = JSON.parse(source);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Expected an object.");
    return payload;
  } catch (error) {
    throw new HttpError(400, `Invalid JSON body: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function normalizeWorkspaceBrief(body) {
  const normalized = {
    name: requireText(body.name, "Company name", TEXT_LIMITS.name),
    oneLiner: requireText(body.oneLiner, "One-line description", TEXT_LIMITS.short),
    targetCustomer: requireText(body.targetCustomer, "Primary customer", TEXT_LIMITS.medium),
    problem: requireText(body.problem, "Customer problem", TEXT_LIMITS.long),
    solution: requireText(body.solution, "Proposed solution", TEXT_LIMITS.long),
    currentGoal: requireText(body.currentGoal, "Current goal", TEXT_LIMITS.medium),
  };
  for (const key of [
    "founderName",
    "founderRole",
    "positioning",
    "differentiation",
    "businessModel",
    "pricing",
    "northStarMetric",
  ]) {
    if (body[key] !== undefined) {
      const maximum = ["founderName", "founderRole"].includes(key) ? TEXT_LIMITS.owner : TEXT_LIMITS.long;
      normalized[key] = optionalText(body[key], humanizeField(key), maximum, { allowEmpty: true });
    }
  }
  if (body.weeklyHours !== undefined) normalized.weeklyHours = boundedInteger(body.weeklyHours, 1, 100, "Founder hours");
  if (body.launchTarget !== undefined) normalized.launchTarget = validDateOrNull(body.launchTarget);
  if (body.constraints !== undefined) normalized.constraints = textList(body.constraints, "Constraints", 12, TEXT_LIMITS.listItem);
  return normalized;
}

export function normalizeArtifactPatch(patch) {
  const normalized = {};
  if (patch.title !== undefined) normalized.title = requireText(patch.title, "Deliverable title", TEXT_LIMITS.title);
  if (patch.summary !== undefined) normalized.summary = optionalText(patch.summary, "Deliverable summary", TEXT_LIMITS.medium, { allowEmpty: true });
  if (patch.status !== undefined) {
    if (!["draft", "reviewed", "approved", "superseded"].includes(patch.status)) {
      throw new HttpError(400, "Invalid deliverable status.");
    }
    normalized.status = patch.status;
  }
  if (patch.confidence !== undefined) normalized.confidence = boundedInteger(patch.confidence, 0, 100, "Deliverable confidence");
  if (patch.sections !== undefined) {
    if (!Array.isArray(patch.sections) || patch.sections.length < 1 || patch.sections.length > 24) {
      throw new HttpError(400, "A deliverable must contain between 1 and 24 sections.");
    }
    normalized.sections = patch.sections.map((section, index) => {
      if (!section || typeof section !== "object" || Array.isArray(section)) {
        throw new HttpError(400, `Section ${index + 1} must be an object.`);
      }
      return {
        id: section.id === undefined
          ? undefined
          : requireText(section.id, `Section ${index + 1} id`, TEXT_LIMITS.key),
        title: requireText(section.title, `Section ${index + 1} title`, TEXT_LIMITS.title),
        body: requireText(section.body, `Section ${index + 1} body`, TEXT_LIMITS.long),
      };
    });
  }
  if (patch.sourceClaimIds !== undefined) {
    normalized.sourceClaimIds = textList(patch.sourceClaimIds, "Source claims", 100, TEXT_LIMITS.key);
  }
  if (patch.linkedDecisionIds !== undefined) {
    normalized.linkedDecisionIds = textList(patch.linkedDecisionIds, "Linked decisions", 100, TEXT_LIMITS.key);
  }
  if (Object.keys(normalized).length === 0) throw new HttpError(400, "No supported deliverable changes were provided.");
  return normalized;
}

export function normalizeClaimValue(value) {
  if (value === undefined || value === null) return null;
  if (["number", "boolean"].includes(typeof value)) return value;
  if (typeof value === "string") return optionalText(value, "Claim value", TEXT_LIMITS.long, { allowEmpty: true });
  throw new HttpError(400, "Claim value must be text, a number, a boolean, or null.");
}

export function requireText(value, label, maximumLength = TEXT_LIMITS.long) {
  const normalized = optionalText(value, label, maximumLength, { allowEmpty: false });
  return normalized;
}

export function optionalText(value, label, maximumLength, { allowEmpty = true } = {}) {
  if (typeof value !== "string") throw new HttpError(400, `${label} must be text.`);
  const normalized = value.trim();
  if (!allowEmpty && !normalized) throw new HttpError(400, `${label} is required.`);
  if (normalized.length > maximumLength) {
    throw new HttpError(400, `${label} must be ${maximumLength.toLocaleString("en-US")} characters or fewer.`);
  }
  return normalized;
}

export function textList(value, label, maximumItems, maximumItemLength) {
  if (!Array.isArray(value)) throw new HttpError(400, `${label} must be a list.`);
  if (value.length > maximumItems) throw new HttpError(400, `${label} may contain at most ${maximumItems} items.`);
  return value
    .map((item, index) => optionalText(item, `${label} item ${index + 1}`, maximumItemLength, { allowEmpty: true }))
    .filter(Boolean);
}

export function humanizeField(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

export function boundedInteger(value, min, max, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number)) throw new HttpError(400, `${label} must be a whole number.`);
  if (number < min || number > max) throw new HttpError(400, `${label} must be between ${min} and ${max}.`);
  return number;
}

export function validDateOrNull(value) {
  if (value === null || value === "" || value === undefined) return null;
  if (typeof value !== "string" || !isCalendarDate(value)) {
    throw new HttpError(400, "Date must be a real calendar date using YYYY-MM-DD.");
  }
  return value;
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

