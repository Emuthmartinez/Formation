#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { appendAuditEntry, verifyAuditChain } from "./audit.js";
import { acquireLock, releaseLock, type AcquireResult } from "./lock.js";
import {
  applyPatch,
  checkDeclaredOutputs,
  checkPreconditions,
  PatchRejected,
  sha256Hex,
  validatePatchShape,
  validateTargetDocument,
  type PatchIssue,
  type PatchTargetDoc,
  type StatePatch,
} from "./patch.js";

/**
 * The single-writer reducer CLI (KTD7, R14). Every mutation to a business/control/grants/
 * waivers/budget-ledger document flows through `commit`: read a typed patch, validate it,
 * apply it transactionally (write temp-then-rename — a rejection at any stage leaves the file
 * on disk untouched), record the resulting content hash into a manifest, and append a
 * hash-chained audit entry. `preflight` re-derives the same hashes and compares them to the
 * manifest so an out-of-band edit between commits is caught before the next one lands.
 *
 * Exit codes: 0 = committed/ok; 1 = patch rejected (validation); 2 = lock contention
 * ("did not run"); 3 = tamper detected (out-of-band edit or a broken audit chain).
 */

const SCHEMA_VERSION_BY_TARGET: Record<PatchTargetDoc, string> = {
  "business-state": "2.0.0",
  control: "1.0.0",
  grants: "1.0.0",
  waivers: "1.0.0",
  "budget-ledger": "1.0.0",
};

interface ManifestEntry {
  readonly targetDoc: PatchTargetDoc;
  readonly file: string;
  readonly stateHash: string;
  readonly updatedAt: string;
  readonly lastPatchId: string;
}

interface ReducerManifest {
  schemaVersion: "1.0.0";
  entries: Record<string, ManifestEntry>;
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

function readPatchInput(patchArg: string | undefined): string {
  if (!patchArg || patchArg === "-") return readFileSync(0, "utf8");
  return readFileSync(patchArg, "utf8");
}

function writeFileAtomic(filePath: string, contents: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
  writeFileSync(tmp, contents, "utf8");
  renameSync(tmp, filePath);
}

function loadManifest(manifestPath: string): ReducerManifest {
  if (!existsSync(manifestPath)) return { schemaVersion: "1.0.0", entries: {} };
  return JSON.parse(readFileSync(manifestPath, "utf8")) as ReducerManifest;
}

function saveManifest(manifestPath: string, manifest: ReducerManifest): void {
  writeFileAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function printIssues(issues: readonly PatchIssue[]): void {
  for (const issue of issues) console.log(`ISSUE ${issue.code}: ${issue.message}${issue.path ? ` (${issue.path})` : ""}`);
}

function requireArgs(args: Record<string, string>, names: readonly string[]): string | undefined {
  const missing = names.filter((name) => !args[name]);
  if (missing.length === 0) return undefined;
  return `reducer.missing_argument: --${missing.join(", --")} ${missing.length === 1 ? "is" : "are"} required`;
}

function runCommit(args: Record<string, string>): number {
  const missing = requireArgs(args, ["file", "manifest", "audit"]);
  if (missing) {
    console.log(`ISSUE ${missing}`);
    console.log("RESULT: rejected");
    return 1;
  }
  const filePath = path.resolve(args.file!);
  const manifestPath = path.resolve(args.manifest!);
  const auditPath = path.resolve(args.audit!);

  let patch: StatePatch;
  try {
    patch = JSON.parse(readPatchInput(args.patch)) as StatePatch;
  } catch (error) {
    console.log(`ISSUE patch.invalid_shape: patch input is not valid JSON (${error instanceof Error ? error.message : String(error)})`);
    console.log("RESULT: rejected");
    return 1;
  }

  const shapeIssues = validatePatchShape(patch);
  if (shapeIssues.length > 0) {
    printIssues(shapeIssues);
    console.log("RESULT: rejected");
    return 1;
  }

  const session = args.session ?? patch.authoredBy;
  const lockPath = args.lock ?? `${filePath}.lock`;
  const acquireResult: AcquireResult = acquireLock(lockPath, {
    ownerSessionId: session,
    ttlSeconds: Number(args["lock-ttl"] ?? 30),
    retries: Number(args["lock-retries"] ?? 3),
    retryDelayMs: Number(args["lock-retry-delay-ms"] ?? 25),
    breakStale: args["break-stale-verified"] === "true",
  });
  if (!acquireResult.ok) {
    const code = acquireResult.reason === "held" ? "reducer.lock_held" : "reducer.lock_stale_requires_break";
    console.log(`ISSUE ${code}: lock at ${lockPath} is held by session "${acquireResult.holder.ownerSessionId}" (heartbeat ${acquireResult.holder.heartbeatAt || "<none>"})`);
    console.log("RESULT: did not run");
    return 2;
  }

  try {
    const manifest = loadManifest(manifestPath);
    const existingEntry = manifest.entries[filePath];
    const fileExists = existsSync(filePath);

    if (existingEntry) {
      if (!fileExists) {
        console.log(`ISSUE reducer.out_of_band_edit: ${filePath} is tracked in the manifest but is missing on disk`);
        console.log("RESULT: tamper_detected");
        return 3;
      }
      const currentHash = sha256Hex(readFileSync(filePath, "utf8"));
      if (currentHash !== existingEntry.stateHash) {
        console.log(`ISSUE reducer.out_of_band_edit: ${filePath} changed outside the reducer since the last commit (expected ${existingEntry.stateHash}, found ${currentHash})`);
        console.log("RESULT: tamper_detected");
        return 3;
      }
    } else if (fileExists) {
      console.log(`ISSUE reducer.out_of_band_edit: ${filePath} exists on disk but is not tracked in the manifest; commit a baseline through the reducer first`);
      console.log("RESULT: tamper_detected");
      return 3;
    }

    const before: unknown = fileExists ? JSON.parse(readFileSync(filePath, "utf8")) : {};

    const preconditionIssues = checkPreconditions(before, patch);
    if (preconditionIssues.length > 0) {
      printIssues(preconditionIssues);
      console.log("RESULT: rejected");
      return 1;
    }

    let candidate: Record<string, unknown>;
    try {
      candidate = applyPatch(before, patch);
    } catch (error) {
      if (error instanceof PatchRejected) {
        printIssues(error.issues);
        console.log("RESULT: rejected");
        return 1;
      }
      throw error;
    }

    const now = args.now ?? new Date().toISOString();
    candidate.schemaVersion = SCHEMA_VERSION_BY_TARGET[patch.targetDoc];
    candidate.updatedAt = now;

    const declaredOutputIssues = checkDeclaredOutputs(before, candidate, patch);
    if (declaredOutputIssues.length > 0) {
      printIssues(declaredOutputIssues);
      console.log("RESULT: rejected");
      return 1; // nothing written: the file on disk is untouched (transactional apply)
    }

    const schemaIssues = validateTargetDocument(patch.targetDoc, candidate);
    if (schemaIssues.length > 0) {
      printIssues(schemaIssues);
      console.log("RESULT: rejected");
      return 1; // nothing written: the file on disk is untouched (transactional apply)
    }

    const bytes = `${JSON.stringify(candidate, null, 2)}\n`;
    const newHash = sha256Hex(bytes);
    writeFileAtomic(filePath, bytes);

    manifest.entries[filePath] = { targetDoc: patch.targetDoc, file: filePath, stateHash: newHash, updatedAt: now, lastPatchId: patch.patchId };
    saveManifest(manifestPath, manifest);

    const auditEntry = appendAuditEntry(
      auditPath,
      { sessionId: session, targetDoc: patch.targetDoc, patchId: patch.patchId, action: "commit", summary: patch.reason, stateHash: newHash },
      now,
    );

    console.log(`COMMITTED ${patch.targetDoc} ${filePath} stateHash=${newHash} auditSeq=${auditEntry.seq}`);
    console.log("RESULT: committed");
    return 0;
  } finally {
    releaseLock(lockPath, session);
  }
}

function runPreflight(args: Record<string, string>): number {
  const missing = requireArgs(args, ["manifest"]);
  if (missing) {
    console.log(`ISSUE ${missing}`);
    console.log("RESULT: rejected");
    return 1;
  }
  const manifestPath = path.resolve(args.manifest!);
  const manifest = loadManifest(manifestPath);
  const problems: string[] = [];
  for (const entry of Object.values(manifest.entries)) {
    if (!existsSync(entry.file)) {
      problems.push(`ISSUE reducer.out_of_band_edit: ${entry.file} (${entry.targetDoc}) is tracked but missing on disk`);
      continue;
    }
    const currentHash = sha256Hex(readFileSync(entry.file, "utf8"));
    if (currentHash !== entry.stateHash) {
      problems.push(`ISSUE reducer.out_of_band_edit: ${entry.file} (${entry.targetDoc}) changed outside the reducer (expected ${entry.stateHash}, found ${currentHash})`);
    }
  }
  if (problems.length > 0) {
    for (const problem of problems) console.log(problem);
    console.log("RESULT: preflight_failed");
    return 3;
  }
  console.log(`PREFLIGHT OK: ${Object.keys(manifest.entries).length} tracked document(s) match the manifest`);
  console.log("RESULT: preflight_ok");
  return 0;
}

function runVerifyAudit(args: Record<string, string>): number {
  const missing = requireArgs(args, ["audit"]);
  if (missing) {
    console.log(`ISSUE ${missing}`);
    console.log("RESULT: rejected");
    return 1;
  }
  const auditPath = path.resolve(args.audit!);
  const verification = verifyAuditChain(auditPath);
  if (!verification.valid) {
    console.log(`ISSUE reducer.audit_chain_broken: ${verification.reason}`);
    console.log("RESULT: audit_chain_broken");
    return 3;
  }
  console.log(`AUDIT CHAIN OK: ${verification.entriesChecked} entries verified from genesis`);
  console.log("RESULT: audit_chain_ok");
  return 0;
}

function main(): number {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  switch (command) {
    case "commit":
      return runCommit(args);
    case "preflight":
      return runPreflight(args);
    case "verify-audit":
      return runVerifyAudit(args);
    default:
      console.error(`Unknown reducer command "${command ?? ""}". Expected one of: commit, preflight, verify-audit.`);
      return 1;
  }
}

function isMainModule(): boolean {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  process.exitCode = main();
}
