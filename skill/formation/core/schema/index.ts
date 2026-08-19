import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020, type AnySchema, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";

import type {
  BudgetLedgerDocument,
  BusinessStateV2,
  CheckpointDocument,
  ControlFile,
  GrantsDocument,
  RunStateDocument,
  Waiver,
  WaiversDocument,
} from "./types.js";

const schemaDir = path.dirname(fileURLToPath(import.meta.url));

export interface SchemaIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  path: string;
}

export interface ValidationResult<T> {
  valid: boolean;
  value?: T;
  issues: SchemaIssue[];
}

function isDateTime(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(new Date(value).getTime()));
}

let registry: Ajv2020 | undefined;

function getRegistry(): Ajv2020 {
  if (registry) return registry;
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: true });
  ajv.addFormat("date-time", { type: "string", validate: isDateTime });
  for (const fileName of readdirSync(schemaDir)) {
    if (!fileName.endsWith(".schema.json")) continue;
    const schema = JSON.parse(readFileSync(path.join(schemaDir, fileName), "utf8")) as AnySchema;
    ajv.addSchema(schema);
  }
  registry = ajv;
  return ajv;
}

function issuesFromErrors(errors: ErrorObject[] | null | undefined): SchemaIssue[] {
  return (errors ?? []).map((error) => ({
    severity: "error",
    code: `schema.${error.keyword}`,
    message: error.message ?? "is invalid",
    path: error.instancePath || "/",
  }));
}

function validateAgainst<T>(schemaId: string, value: unknown): ValidationResult<T> {
  const validate: ValidateFunction | undefined = getRegistry().getSchema(schemaId);
  if (!validate) throw new Error(`Unknown schema $id: ${schemaId}`);
  const valid = Boolean(validate(value));
  return valid ? { valid: true, value: value as T, issues: [] } : { valid: false, issues: issuesFromErrors(validate.errors) };
}

export function validateBusinessState(value: unknown): ValidationResult<BusinessStateV2> {
  return validateAgainst<BusinessStateV2>("urn:formation:core:business-state-schema", value);
}

export function validateGrants(value: unknown): ValidationResult<GrantsDocument> {
  return validateAgainst<GrantsDocument>("urn:formation:core:grants-schema", value);
}

export function validateWaivers(value: unknown): ValidationResult<WaiversDocument> {
  const structural = validateAgainst<WaiversDocument>("urn:formation:core:waivers-schema", value);
  if (!structural.valid || !structural.value) return structural;
  const semanticIssues = structural.value.waivers.flatMap((waiver, index) => validateWaiverSemantics(waiver, `/waivers/${index}`));
  return semanticIssues.length > 0 ? { valid: false, issues: semanticIssues } : structural;
}

/** protectedCategory must be consistent with actionClass per KTD4: spend->spend, release->release, destructive->destructive; mutate/publish may tag any of credentials_access/legal_pricing/public_actions. */
export function validateWaiverSemantics(waiver: Waiver, pathPrefix = ""): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  const directCategories: Record<string, string> = { spend: "spend", release: "release", destructive: "destructive" };
  const expected = directCategories[waiver.actionClass];
  if (expected && waiver.protectedCategory !== expected) {
    issues.push({
      severity: "error",
      code: "waiver.action_class_category_mismatch",
      message: `actionClass "${waiver.actionClass}" must carry protectedCategory "${expected}", found "${waiver.protectedCategory}"`,
      path: `${pathPrefix}/protectedCategory`,
    });
  }
  if ((waiver.actionClass === "mutate" || waiver.actionClass === "publish") && directCategories[waiver.protectedCategory]) {
    issues.push({
      severity: "error",
      code: "waiver.action_class_category_mismatch",
      message: `actionClass "${waiver.actionClass}" cannot carry protectedCategory "${waiver.protectedCategory}"; use credentials_access, legal_pricing, or public_actions`,
      path: `${pathPrefix}/protectedCategory`,
    });
  }
  return issues;
}

export function validateBudgetLedger(value: unknown): ValidationResult<BudgetLedgerDocument> {
  return validateAgainst<BudgetLedgerDocument>("urn:formation:core:budget-ledger-schema", value);
}

export function validateControl(value: unknown): ValidationResult<ControlFile> {
  return validateAgainst<ControlFile>("urn:formation:core:control-schema", value);
}

export function validateRunState(value: unknown): ValidationResult<RunStateDocument> {
  return validateAgainst<RunStateDocument>("urn:formation:core:run-state-schema", value);
}

/** Adapter contract A: the emitters call these on their OWN output before printing — an invalid report is never emitted. */
export function validateBoundaryReport<T>(value: unknown): ValidationResult<T> {
  return validateAgainst<T>("urn:formation:core:boundary-report-schema", value);
}

export function validateImportBoundaryReport<T>(value: unknown): ValidationResult<T> {
  return validateAgainst<T>("urn:formation:core:import-boundary-report-schema", value);
}

export function validateCheckpoint(value: unknown): ValidationResult<CheckpointDocument> {
  return validateAgainst<CheckpointDocument>("urn:formation:core:checkpoint-schema", value);
}
