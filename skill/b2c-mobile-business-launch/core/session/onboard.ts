#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { resolveWorkspacePaths } from "./run.js";
import { validateControl, validateGrants, validateWaivers } from "../schema/index.js";
import type { StatePatch, PatchOp, PatchPath } from "../reducer/patch.js";
import type {
  BusinessUnit,
  ControlFile,
  Grant,
  GrantLevel,
  GrantsMap,
  ProtectedCategory,
  UndoContract,
  Waiver,
  WaivableActionClass,
  WaiverCaps,
  BudgetPeriod,
  GrantableDomainId,
} from "../schema/types.js";
import { businessUnitDomains, grantLevels } from "../schema/types.js";

/**
 * The scripted onboarding driver (U7, R5): a founder onboarding conversation (run interactively
 * against content/onboarding/autonomy-onboarding.md, or replayed for a rehearsal/test) ends with
 * a recorded transcript — this file is what turns that transcript into the founder's actual
 * grants and waivers. It never writes control.json directly: every change is expressed as a
 * typed StatePatch and applied through core/reducer/cli.ts, exactly like every other write to a
 * reducer-owned document (KTD7). A waiver whose envelope (scope, cap+period, expiry, undo-or-
 * mitigation) is incomplete refuses the *entire* run before anything is committed — onboarding
 * either activates cleanly or not at all, never partially.
 *
 * CLI: tsx core/session/onboard.ts --workspace <dir> --answers <file> [--dry-run] [--now <iso>]
 *
 * Exit codes mirror the reducer's own convention (see core/reducer/cli.ts, core/session/run.ts):
 * 0 = committed (or a dry run / no-op that needed no commit), 1 = the answers file or a waiver
 * envelope is invalid (refused before any write), 2 = did not run (lock contention), 3 = tamper
 * detected (out-of-band edit caught by the reducer's preflight).
 */

// --- the answers-file contract ------------------------------------------------------------------

export interface OnboardingWaiverInput {
  readonly domainId: GrantableDomainId;
  readonly actionClass: WaivableActionClass;
  readonly protectedCategory: ProtectedCategory;
  readonly scope: { readonly resourcePattern: string; readonly description: string };
  readonly caps: WaiverCaps;
  readonly budgetPeriod: BudgetPeriod;
  readonly expiry: string;
  readonly undoContract: UndoContract;
}

export interface OnboardingAnswers {
  readonly schemaVersion: "1.0.0";
  readonly businessSlug: string;
  readonly founderContact: { readonly email: string };
  /** Not every unit needs an answer in one run: a unit absent here is left exactly as it was. */
  readonly units: Partial<Record<BusinessUnit, { readonly level: GrantLevel }>>;
  readonly waivers?: readonly OnboardingWaiverInput[];
}

export class AnswersInvalid extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super(`Onboarding answers are invalid: ${issues.join("; ")}`);
    this.issues = issues;
  }
}

const businessUnits = Object.keys(businessUnitDomains) as readonly BusinessUnit[];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Structural validation only, mirroring brief.ts: this document has no U1 schema registry entry of its own (it never lands on disk verbatim — it is consumed once and turned into a control-file patch). */
export function validateAnswersShape(value: unknown): string[] {
  const issues: string[] = [];
  if (!isPlainObject(value)) return ["answers must be a JSON object"];

  if (value.schemaVersion !== "1.0.0") issues.push('schemaVersion must be "1.0.0"');
  if (!isNonEmptyString(value.businessSlug)) issues.push("businessSlug is required");

  const contact = value.founderContact;
  if (!isPlainObject(contact) || !isNonEmptyString(contact.email) || !contact.email.includes("@")) {
    issues.push("founderContact.email is required and must look like an email address");
  }

  const units = value.units;
  if (!isPlainObject(units)) {
    issues.push("units is required and must be an object");
  } else {
    for (const [unit, answer] of Object.entries(units)) {
      if (!businessUnits.includes(unit as BusinessUnit)) {
        issues.push(`units."${unit}" is not a recognized business unit (expected one of ${businessUnits.join(", ")})`);
        continue;
      }
      if (!isPlainObject(answer) || !grantLevels.includes(answer.level as GrantLevel)) {
        issues.push(`units."${unit}".level must be one of ${grantLevels.join(", ")}`);
      }
    }
  }

  if (value.waivers !== undefined) {
    if (!Array.isArray(value.waivers)) issues.push("waivers, when present, must be an array");
    else value.waivers.forEach((entry, index) => issues.push(...validateWaiverInputShape(entry, index)));
  }

  return issues;
}

function validateWaiverInputShape(value: unknown, index: number): string[] {
  const prefix = `waivers[${index}]`;
  if (!isPlainObject(value)) return [`${prefix} must be an object`];
  const issues: string[] = [];
  if (!isNonEmptyString(value.domainId)) issues.push(`${prefix}.domainId is required`);
  if (!isNonEmptyString(value.actionClass)) issues.push(`${prefix}.actionClass is required`);
  if (!isNonEmptyString(value.protectedCategory)) issues.push(`${prefix}.protectedCategory is required`);
  if (!isPlainObject(value.scope) || !isNonEmptyString(value.scope.resourcePattern) || !isNonEmptyString(value.scope.description)) {
    issues.push(`${prefix}.scope (resourcePattern, description) is required — what exactly this covers`);
  }
  if (!isPlainObject(value.caps) || typeof value.caps.maxPerAction !== "number" || typeof value.caps.maxPerPeriod !== "number") {
    issues.push(`${prefix}.caps (maxPerAction, maxPerPeriod) is required — the cap and how it resets`);
  }
  if (!isNonEmptyString(value.budgetPeriod)) issues.push(`${prefix}.budgetPeriod is required — how often the cap resets`);
  if (!isNonEmptyString(value.expiry)) issues.push(`${prefix}.expiry is required — when this pre-approval runs out`);
  if (!isPlainObject(value.undoContract)) {
    issues.push(`${prefix}.undoContract is required — a real undo, or an irreversibility acknowledgment plus mitigation steps`);
  }
  return issues;
}

export function parseAnswers(raw: string): OnboardingAnswers {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new AnswersInvalid([`answers file is not valid JSON (${error instanceof Error ? error.message : String(error)})`]);
  }
  const issues = validateAnswersShape(parsed);
  if (issues.length > 0) throw new AnswersInvalid(issues);
  return parsed as OnboardingAnswers;
}

export function loadAnswers(answersPath: string): OnboardingAnswers {
  return parseAnswers(readFileSync(answersPath, "utf8"));
}

// --- transcript -> grants/waivers ----------------------------------------------------------------

/**
 * Expands unit-level answers to domain-level grants (KTD3: business units are a copy-layer
 * grouping over domains; grants themselves always bind to the domain id). A domain whose unit was
 * not answered this run, or whose answer did not actually change its level, is left byte-for-byte
 * as it was — re-running onboarding with an unchanged answer must not manufacture a spurious
 * updatedAt churn.
 */
export function buildGrantsPatch(existing: GrantsMap, units: OnboardingAnswers["units"], now: string): GrantsMap {
  const next: GrantsMap = { ...existing };
  for (const [unit, answer] of Object.entries(units) as Array<[BusinessUnit, { level: GrantLevel } | undefined]>) {
    if (!answer) continue;
    for (const domainId of businessUnitDomains[unit]) {
      const current = next[domainId];
      if (current && current.level === answer.level) continue; // unchanged: leave exactly as it was
      const grant: Grant = {
        domainId,
        level: answer.level,
        prerequisites: current?.prerequisites ?? [],
        grantedAt: current?.grantedAt ?? now,
        grantedBy: "founder",
        grantedViaUnit: unit,
        updatedAt: now,
      };
      next[domainId] = grant;
    }
  }
  return next;
}

let waiverSequence = 0;
function nextWaiverId(domainId: string): string {
  waiverSequence += 1;
  return `waiver.${domainId.slice("domain.".length)}.onboarding-${waiverSequence}`;
}

/** Every founder pre-approval is a fresh, deliberate record — onboarding always appends, never silently overwrites a prior one. */
export function buildWaivers(existing: readonly Waiver[], inputs: readonly OnboardingWaiverInput[], now: string): Waiver[] {
  const added: Waiver[] = inputs.map((input) => {
    const id = nextWaiverId(input.domainId);
    return {
      id,
      domainId: input.domainId,
      actionClass: input.actionClass,
      protectedCategory: input.protectedCategory,
      scope: input.scope,
      caps: input.caps,
      budgetPeriod: input.budgetPeriod,
      expiry: input.expiry,
      undoContract: input.undoContract,
      auditRef: `audit.onboarding.${id}`,
      status: "active",
      createdAt: now,
      createdBy: "founder",
    };
  });
  return [...existing, ...added];
}

// --- workspace plumbing (mirrors core/session/run.ts's reducer-subprocess convention) -----------

function skillRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function resolveTsxBin(): string {
  const candidates = [path.join(skillRoot(), "node_modules/.bin/tsx"), path.resolve(skillRoot(), "../..", "node_modules/.bin/tsx")];
  return candidates.find((candidate) => existsSync(candidate)) ?? "tsx";
}

interface ReducerResult {
  readonly code: number;
  readonly output: string;
}

function runReducer(args: string[], input?: string): ReducerResult {
  const cliPath = path.join(skillRoot(), "core/reducer/cli.ts");
  const result = spawnSync(resolveTsxBin(), [cliPath, ...args], { cwd: skillRoot(), encoding: "utf8", input });
  return { code: result.status ?? -1, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

function tryLoadJson(filePath: string): unknown | undefined {
  if (!existsSync(filePath)) return undefined;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return undefined;
  }
}

function loadExistingControl(controlPath: string): ControlFile | undefined {
  const raw = tryLoadJson(controlPath);
  if (raw === undefined) return undefined;
  const result = validateControl(raw);
  return result.valid ? result.value : undefined;
}

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token?.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        index += 1;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  const missing = ["workspace", "answers"].filter((name) => !args[name]);
  if (missing.length > 0) {
    console.error(`onboard.missing_argument: --${missing.join(", --")} ${missing.length === 1 ? "is" : "are"} required`);
    return 1;
  }

  const workspace = path.resolve(args.workspace!);
  const paths = resolveWorkspacePaths(workspace);
  const now = args.now ?? new Date().toISOString();
  const dryRun = args["dry-run"] === "true";

  let answers: OnboardingAnswers;
  try {
    answers = loadAnswers(path.resolve(args.answers!));
  } catch (error) {
    const message = error instanceof AnswersInvalid ? error.issues.join("; ") : error instanceof Error ? error.message : String(error);
    console.error(`ISSUE onboard.answers_invalid: ${message}`);
    return 1;
  }

  const existingControl = loadExistingControl(paths.control);
  if (existingControl && existingControl.businessSlug !== answers.businessSlug) {
    console.error(
      `ISSUE onboard.business_slug_mismatch: answers file names "${answers.businessSlug}" but this workspace's control file is "${existingControl.businessSlug}"`,
    );
    return 1;
  }

  // --- build and validate the candidate grants + waivers against U1's real schemas (never a
  // second, hand-rolled copy of the same rules) before anything is written -----------------------

  const candidateGrants = buildGrantsPatch(existingControl?.grants ?? {}, answers.units, now);
  const grantsCheck = validateGrants({ schemaVersion: "1.0.0", updatedAt: now, grants: candidateGrants });
  if (!grantsCheck.valid) {
    for (const issue of grantsCheck.issues) console.error(`ISSUE onboard.grant_invalid: ${issue.message} (${issue.path})`);
    return 1;
  }

  const waiverInputs = answers.waivers ?? [];
  const candidateWaivers = buildWaivers(existingControl?.waivers ?? [], waiverInputs, now);
  const waiversCheck = validateWaivers({ schemaVersion: "1.0.0", updatedAt: now, waivers: candidateWaivers });
  if (!waiversCheck.valid) {
    // "a waiver opt-in missing any envelope field refuses activation" — the whole run refuses,
    // not just the incomplete waiver, so nothing is committed here even if other waivers or all
    // of the grant choices were fine.
    for (const issue of waiversCheck.issues) console.error(`ISSUE onboard.waiver_incomplete: ${issue.message} (${issue.path})`);
    return 1;
  }

  const grantsChanged = !deepEqual(existingControl?.grants ?? {}, candidateGrants);
  const waiversChanged = waiverInputs.length > 0; // always an append when present; never a no-op

  const ops: PatchOp[] = [];
  const declaredOutputs: PatchPath[] = [];
  const isBootstrap = !existingControl;

  if (isBootstrap) {
    // control.schema.json requires grants and waivers on every document, so a first-ever
    // commit for this workspace must set both even when this run's answers left one of them
    // unchanged from the (nonexistent) baseline — "changed vs. before" only means something
    // once a before exists.
    ops.push(
      { op: "set", path: ["businessSlug"], value: answers.businessSlug },
      { op: "set", path: ["stateHash"], value: "" },
      { op: "set", path: ["killSwitch"], value: { engaged: false, engagedAt: "", engagedBy: "", reason: "" } },
      { op: "set", path: ["grants"], value: candidateGrants },
      { op: "set", path: ["waivers"], value: candidateWaivers },
    );
    declaredOutputs.push(["businessSlug"], ["stateHash"], ["killSwitch"], ["grants"], ["waivers"]);
  } else {
    if (grantsChanged) {
      ops.push({ op: "set", path: ["grants"], value: candidateGrants });
      declaredOutputs.push(["grants"]);
    }
    if (waiversChanged) {
      ops.push({ op: "set", path: ["waivers"], value: candidateWaivers });
      declaredOutputs.push(["waivers"]);
    }
  }

  if (ops.length === 0) {
    console.log("Nothing to update: every answered area already matches this business's current settings.");
    return 0;
  }

  if (dryRun) {
    console.log(`DRY RUN: would ${isBootstrap ? "create" : "update"} ${paths.control} with:`);
    console.log(JSON.stringify({ grants: grantsChanged ? candidateGrants : undefined, waivers: waiversChanged ? candidateWaivers : undefined }, null, 2));
    return 0;
  }

  const patch: StatePatch = {
    schemaVersion: "1.0.0",
    patchId: `patch.onboard.${answers.businessSlug}.${Date.parse(now) || Date.now()}`,
    targetDoc: "control",
    reason: "Applying founder autonomy onboarding answers",
    authoredBy: "onboarding-driver",
    authoredAt: now,
    preconditions: [],
    ops,
    declaredOutputs,
  };

  const result = runReducer(
    ["commit", "--file", paths.control, "--manifest", paths.manifest, "--audit", paths.audit, "--session", "onboarding-driver", "--now", now],
    JSON.stringify(patch),
  );
  process.stdout.write(result.output);
  return result.code;
}

function isMainModule(): boolean {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  process.exitCode = main();
}
