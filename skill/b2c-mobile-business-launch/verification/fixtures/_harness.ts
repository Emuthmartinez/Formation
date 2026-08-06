import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Ajv2020, type AnySchema, type ErrorObject } from "ajv/dist/2020.js";
import { resolveTsxBin } from "../../tooling/lib/tsx-bin.js";

export interface CaseResult {
  label: string;
  ok: boolean;
  detail: string;
}

export interface SchemaCheckResult {
  valid: boolean;
  errors: ErrorObject[];
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const skillRoot = path.resolve(scriptDir, "../..");

function isDateTime(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(new Date(value).getTime()));
}

export function createSchemaRegistry(schemaDir: string): Ajv2020 {
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: true });
  ajv.addFormat("date-time", { type: "string", validate: isDateTime });
  for (const fileName of readdirSync(schemaDir)) {
    if (!fileName.endsWith(".schema.json")) continue;
    const schema = JSON.parse(readFileSync(path.join(schemaDir, fileName), "utf8")) as AnySchema;
    ajv.addSchema(schema);
  }
  return ajv;
}

export class AssertionFailure extends Error {}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AssertionFailure(message);
}

export function formatAjvError(error: ErrorObject): string {
  const missing = error.params && "missingProperty" in error.params ? ` (${(error.params as { missingProperty: string }).missingProperty})` : "";
  return `${error.instancePath || "/"} ${error.message ?? "invalid"}${missing}`;
}

export function assertSchemaValid(result: SchemaCheckResult, context: string): void {
  if (!result.valid) {
    throw new AssertionFailure(`${context}: expected valid, got errors: ${result.errors.map(formatAjvError).join("; ")}`);
  }
}

export function assertSchemaInvalid(result: SchemaCheckResult, expectedFragment: string, context: string): void {
  if (result.valid) throw new AssertionFailure(`${context}: expected invalid (matching "${expectedFragment}"), but the document validated`);
  const messages = result.errors.map(formatAjvError);
  if (!messages.some((message) => message.includes(expectedFragment))) {
    throw new AssertionFailure(`${context}: expected an error mentioning "${expectedFragment}", got: ${messages.join("; ")}`);
  }
}

export interface Harness {
  readonly tempRoot: string;
  readonly results: CaseResult[];
  makeTempDir: (name: string) => string;
  check: (label: string, fn: () => void) => void;
  checkSchema: (schemaId: string, data: unknown) => SchemaCheckResult;
  runScript: (label: string, scriptPath: string, args: string[], expectedCode: number, expectedText?: string) => void;
  cleanup: () => void;
}

export function createHarness(schemaDir: string): Harness {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "b2c-core-fixtures-"));
  const results: CaseResult[] = [];
  const tsxBin = resolveTsxBin(skillRoot);
  const ajv = createSchemaRegistry(schemaDir);

  const makeTempDir = (name: string): string => {
    const dir = path.join(tempRoot, name);
    mkdirSync(dir, { recursive: true });
    return dir;
  };

  const check = (label: string, fn: () => void): void => {
    try {
      fn();
      results.push({ label, ok: true, detail: "" });
    } catch (error) {
      results.push({ label, ok: false, detail: error instanceof Error ? error.message : String(error) });
    }
  };

  const checkSchema = (schemaId: string, data: unknown): SchemaCheckResult => {
    const validate = ajv.getSchema(schemaId);
    if (!validate) throw new Error(`Unknown schema $id: ${schemaId}`);
    const valid = Boolean(validate(data));
    return { valid, errors: [...(validate.errors ?? [])] };
  };

  const runScript = (label: string, scriptPath: string, args: string[], expectedCode: number, expectedText?: string): void => {
    const result = spawnSync(tsxBin, [scriptPath, ...args], { cwd: skillRoot, encoding: "utf8" });
    const output = `${result.stdout}\n${result.stderr}`;
    const ok = result.status === expectedCode && (!expectedText || output.includes(expectedText));
    results.push({ label, ok, detail: ok ? "" : `expected exit ${expectedCode}, got ${result.status}\n${output.trim()}` });
  };

  const cleanup = (): void => {
    rmSync(tempRoot, { recursive: true, force: true });
  };

  return { tempRoot, results, makeTempDir, check, checkSchema, runScript, cleanup };
}

export function reportResults(results: CaseResult[]): number {
  const failed = results.filter((result) => !result.ok);
  console.log("Core fixture tests");
  console.log(`${failed.length} failure(s), ${results.length - failed.length} passed`);
  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"} ${result.label}`);
    if (!result.ok) console.log(`  ${result.detail}`);
  }
  return failed.length;
}
