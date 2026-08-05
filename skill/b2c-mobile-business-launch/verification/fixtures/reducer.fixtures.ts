import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assert, skillRoot, type Harness } from "./_harness.js";
import { laneKeys } from "../../core/schema/types.js";
import { AUDIT_GENESIS_HASH, appendAuditEntry, readAuditLog, verifyAuditChain } from "../../core/reducer/audit.js";
import { acquireLock, checkYield, heartbeat, readLock, releaseLock, requestInteractive } from "../../core/reducer/lock.js";
import { sha256Hex, validatePatchShape, type StatePatch } from "../../core/reducer/patch.js";

function resolveTsxBin(): string {
  const candidates = [path.join(skillRoot, "node_modules/.bin/tsx"), path.resolve(skillRoot, "../..", "node_modules/.bin/tsx")];
  return candidates.find((candidate) => existsSync(candidate)) ?? "tsx";
}

const tsxBin = resolveTsxBin();
const cliPath = path.join(skillRoot, "core/reducer/cli.ts");

interface CliResult {
  readonly code: number;
  readonly output: string;
}

function runCli(args: string[], input?: string): CliResult {
  const result = spawnSync(tsxBin, [cliPath, ...args], { cwd: skillRoot, encoding: "utf8", input });
  return { code: result.status ?? -1, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

interface ScenarioPaths {
  readonly dir: string;
  readonly file: string;
  readonly manifest: string;
  readonly audit: string;
  readonly lock: string;
}

function scenarioPaths(harness: Harness, name: string, fileName = "business-state.json"): ScenarioPaths {
  const dir = harness.makeTempDir(`reducer-${name}`);
  const file = path.join(dir, fileName);
  return { dir, file, manifest: path.join(dir, "manifest.json"), audit: path.join(dir, "audit.jsonl"), lock: `${file}.lock` };
}

let patchCounter = 0;
function nextPatchId(): string {
  patchCounter += 1;
  return `patch-${patchCounter}`;
}

function buildPatch(targetDoc: string, ops: Array<Record<string, unknown>>, declaredOutputs: string[][], overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: "1.0.0",
    patchId: nextPatchId(),
    targetDoc,
    reason: "fixture patch",
    authoredBy: "session-fixture",
    authoredAt: "2026-08-04T12:00:00.000Z",
    preconditions: [],
    ops,
    declaredOutputs,
    ...overrides,
  };
}

function minimalLanes(): Record<string, unknown> {
  const lanes: Record<string, unknown> = {};
  for (const key of laneKeys) lanes[key] = { status: "pending", evidence: [], blockers: [] };
  return lanes;
}

function businessStateBootstrapPatch(): Record<string, unknown> {
  return buildPatch(
    "business-state",
    [
      { op: "set", path: ["narrative"], value: { sinceLastTime: "", rightNow: "", yourCall: "", lastCelebratedPhase: "" } },
      {
        op: "set",
        path: ["project"],
        value: {
          name: "App",
          slug: "app",
          owner: "Founder",
          phase: "phase_0_orient",
          launchScope: "essentials",
          kickoffDate: "",
          platforms: ["ios"],
          bundleIds: { ios: "com.example.app", android: "" },
          publicUrls: { landing: "", privacy: "", terms: "" },
        },
      },
      { op: "set", path: ["lanes"], value: minimalLanes() },
      { op: "set", path: ["founderGates"], value: { pending: [] } },
    ],
    [["narrative"], ["project"], ["lanes"], ["founderGates"]],
  );
}

function controlBootstrapPatch(): Record<string, unknown> {
  return buildPatch(
    "control",
    [
      { op: "set", path: ["businessSlug"], value: "app" },
      { op: "set", path: ["stateHash"], value: "" },
      { op: "set", path: ["killSwitch"], value: { engaged: false, engagedAt: "", engagedBy: "", reason: "" } },
      { op: "set", path: ["grants"], value: {} },
      { op: "set", path: ["waivers"], value: [] },
    ],
    [["businessSlug"], ["stateHash"], ["killSwitch"], ["grants"], ["waivers"]],
  );
}

function grantsBootstrapPatch(): Record<string, unknown> {
  return buildPatch("grants", [{ op: "set", path: ["grants"], value: {} }], [["grants"]]);
}

function waiversBootstrapPatch(): Record<string, unknown> {
  return buildPatch("waivers", [{ op: "set", path: ["waivers"], value: [] }], [["waivers"]]);
}

function budgetLedgerBootstrapPatch(): Record<string, unknown> {
  return buildPatch(
    "budget-ledger",
    [
      { op: "set", path: ["balances"], value: [] },
      { op: "set", path: ["entries"], value: [] },
    ],
    [["balances"], ["entries"]],
  );
}

function sampleLedgerEntry(id: string): Record<string, unknown> {
  return {
    id,
    unit: "Growth",
    domainId: "domain.growth",
    period: "2026-08",
    estimate: { amount: 5, currency: "USD", declaredAt: "2026-08-04T12:00:00.000Z" },
    actual: null,
    status: "estimated",
    auditRef: `audit.${id}`,
  };
}

function commit(dir: string, target: ScenarioPaths, patch: Record<string, unknown>, extraArgs: string[] = []): CliResult {
  const patchPath = path.join(dir, `${patch.patchId as string}.json`);
  writeJson(patchPath, patch);
  // These scenarios exercise reducer mechanics as a founder-authorized caller, so autonomy-doc
  // patches (control/grants/waivers) carry --founder-authority. The gate's own rejection path is
  // covered by a dedicated fixture below.
  return runCli(["commit", "--patch", patchPath, "--file", target.file, "--manifest", target.manifest, "--audit", target.audit, "--session", "session-fixture", "--founder-authority", "true", ...extraArgs]);
}

export function register(harness: Harness): void {
  // --- patch.ts shape validation (in-process, no subprocess needed) -----------------------

  harness.check("reducer/patch: shape validation rejects empty ops, empty declaredOutputs, and an unknown targetDoc", () => {
    const base = buildPatch("business-state", [{ op: "set", path: ["project"], value: {} }], [["project"]]);
    const noOps = validatePatchShape({ ...base, ops: [] } as unknown as StatePatch);
    assert(noOps.some((issue) => issue.code === "patch.empty_ops"), `expected patch.empty_ops, got: ${JSON.stringify(noOps)}`);
    const noOutputs = validatePatchShape({ ...base, declaredOutputs: [] } as unknown as StatePatch);
    assert(noOutputs.some((issue) => issue.code === "patch.empty_declared_outputs"), `expected patch.empty_declared_outputs, got: ${JSON.stringify(noOutputs)}`);
    const badTarget = validatePatchShape({ ...base, targetDoc: "not-a-real-target" } as unknown as StatePatch);
    assert(badTarget.some((issue) => issue.code === "patch.unknown_target"), `expected patch.unknown_target, got: ${JSON.stringify(badTarget)}`);
  });

  // --- founder-authority gate: autonomy-doc patches require --founder-authority ------------

  harness.check("reducer: a control/grants/waivers patch without --founder-authority is rejected (autonomous work cannot self-grant)", () => {
    const p = scenarioPaths(harness, "founder-authority-gate", "control.json");
    const patch = controlBootstrapPatch();
    const patchPath = path.join(p.dir, `${patch.patchId as string}.json`);
    writeJson(patchPath, patch);
    // Directly via runCli WITHOUT --founder-authority — the shape the autonomous session runner
    // would produce if it ever tried to write an autonomy document.
    const denied = runCli(["commit", "--patch", patchPath, "--file", p.file, "--manifest", p.manifest, "--audit", p.audit, "--session", "autonomous-session"]);
    assert(denied.code === 1, `expected exit 1 (rejected), got ${denied.code}: ${denied.output}`);
    assert(denied.output.includes("reducer.founder_authority_required"), `expected the founder-authority issue code, got: ${denied.output}`);
    assert(!existsSync(p.file), "control.json must not be written when the authority gate rejects the patch");
    // The same patch WITH the flag (as onboarding/approve pass it) commits normally.
    const allowed = commit(p.dir, p, controlBootstrapPatch());
    assert(allowed.code === 0, `expected the founder-authorized commit to succeed, got ${allowed.code}: ${allowed.output}`);
  });

  // --- required scenario 1: a patch omitting a declared output rejects, fail-closed --------

  harness.check("reducer: bootstrap commit creates the document, a manifest entry, and audit entry #1", () => {
    const p = scenarioPaths(harness, "bootstrap");
    const result = commit(p.dir, p, businessStateBootstrapPatch());
    assert(result.code === 0, `expected exit 0, got ${result.code}: ${result.output}`);
    assert(result.output.includes("RESULT: committed"), `expected a committed result, got: ${result.output}`);
    assert(existsSync(p.file), "business-state.json was not written");

    const doc = readJson<{ schemaVersion: string; lanes: Record<string, unknown> }>(p.file);
    assert(doc.schemaVersion === "2.0.0", `expected schemaVersion 2.0.0, got ${doc.schemaVersion}`);
    assert(Object.keys(doc.lanes).length === laneKeys.length, "not all lanes were written by the bootstrap patch");

    const manifest = readJson<{ entries: Record<string, { stateHash: string }> }>(p.manifest);
    const entry = manifest.entries[path.resolve(p.file)];
    assert(Boolean(entry), "manifest has no entry for the committed file");
    const onDiskHash = sha256Hex(readFileSync(p.file, "utf8"));
    assert(entry!.stateHash === onDiskHash, "manifest stateHash does not match the file's actual content hash");

    const audit = readAuditLog(p.audit);
    assert(audit.length === 1 && audit[0]!.seq === 1, "expected exactly one audit entry with seq 1");
    assert(audit[0]!.previousHash === AUDIT_GENESIS_HASH, "the first audit entry must chain to genesis");
    assert(!existsSync(p.lock), "the lock file was not released after a successful commit");
  });

  harness.check("reducer: a patch omitting a declared output is rejected, and no partial write lands", () => {
    const p = scenarioPaths(harness, "declared-output-missing", "budget-ledger.json");
    const boot = commit(p.dir, p, budgetLedgerBootstrapPatch());
    assert(boot.code === 0, `bootstrap failed: ${boot.output}`);
    const before = readFileSync(p.file, "utf8");
    const manifestBefore = readFileSync(p.manifest, "utf8");
    const auditBefore = readFileSync(p.audit, "utf8");

    // Declares "balances" as the output it changes, but its only op touches "entries" instead.
    const badPatch = buildPatch("budget-ledger", [{ op: "append", path: ["entries"], value: sampleLedgerEntry("e1") }], [["balances"]]);
    const result = commit(p.dir, p, badPatch);
    assert(result.code === 1, `expected exit 1, got ${result.code}: ${result.output}`);
    assert(result.output.includes("patch.declared_output_missing"), `expected patch.declared_output_missing, got: ${result.output}`);
    assert(result.output.includes("patch.undeclared_mutation"), `expected patch.undeclared_mutation for the un-declared entries write, got: ${result.output}`);

    assert(readFileSync(p.file, "utf8") === before, "the target file changed despite a rejected patch (no transactional guarantee)");
    assert(readFileSync(p.manifest, "utf8") === manifestBefore, "the manifest changed despite a rejected patch");
    assert(readFileSync(p.audit, "utf8") === auditBefore, "the audit log changed despite a rejected patch");
  });

  harness.check("reducer: a patch that tries to set a reducer-managed field is rejected before touching disk", () => {
    const p = scenarioPaths(harness, "protected-field", "budget-ledger.json");
    const patch = buildPatch("budget-ledger", [{ op: "set", path: ["schemaVersion"], value: "9.9.9" }], [["schemaVersion"]]);
    const result = commit(p.dir, p, patch);
    assert(result.code === 1, `expected exit 1, got ${result.code}: ${result.output}`);
    assert(result.output.includes("patch.protected_field"), `expected patch.protected_field, got: ${result.output}`);
    assert(!existsSync(p.file), "a rejected bootstrap patch must not create the file");
  });

  harness.check("reducer: a failed precondition rejects before any write", () => {
    const p = scenarioPaths(harness, "precondition-failed", "control.json");
    const boot = commit(p.dir, p, controlBootstrapPatch());
    assert(boot.code === 0, `bootstrap failed: ${boot.output}`);
    const before = readFileSync(p.file, "utf8");

    const patch = buildPatch(
      "control",
      [{ op: "set", path: ["killSwitch"], value: { engaged: true, engagedAt: "2026-08-04T12:10:00.000Z", engagedBy: "founder", reason: "test" } }],
      [["killSwitch"]],
      { preconditions: [{ path: ["killSwitch", "engaged"], operator: "equals", value: true }] }, // currently false: precondition must fail
    );
    const result = commit(p.dir, p, patch);
    assert(result.code === 1, `expected exit 1, got ${result.code}: ${result.output}`);
    assert(result.output.includes("patch.precondition_failed"), `expected patch.precondition_failed, got: ${result.output}`);
    assert(readFileSync(p.file, "utf8") === before, "the target file changed despite a failed precondition");
  });

  // --- transactional apply: failed schema validation leaves no partial write ---------------

  harness.check("reducer: a schema-invalid candidate is rejected, and the prior valid commit is preserved byte-for-byte", () => {
    const p = scenarioPaths(harness, "schema-invalid");
    const boot = commit(p.dir, p, businessStateBootstrapPatch());
    assert(boot.code === 0, `bootstrap failed: ${boot.output}`);
    const before = readFileSync(p.file, "utf8");

    const patch = buildPatch("business-state", [{ op: "set", path: ["project", "launchScope"], value: "bogus" }], [["project", "launchScope"]]);
    const result = commit(p.dir, p, patch);
    assert(result.code === 1, `expected exit 1, got ${result.code}: ${result.output}`);
    assert(result.output.includes("schema."), `expected an AJV schema.* issue code, got: ${result.output}`);
    assert(readFileSync(p.file, "utf8") === before, "the file changed despite a schema-invalid rejected patch");

    const audit = readAuditLog(p.audit);
    assert(audit.length === 1, "a rejected commit must not append an audit entry");
  });

  // --- required scenario 2: out-of-band edit between commits fails the next preflight ------

  harness.check("reducer: an out-of-band edit between commits fails the next preflight with a named error", () => {
    const p = scenarioPaths(harness, "out-of-band-preflight", "budget-ledger.json");
    const boot = commit(p.dir, p, budgetLedgerBootstrapPatch());
    assert(boot.code === 0, `bootstrap failed: ${boot.output}`);

    const preOk = runCli(["preflight", "--manifest", p.manifest]);
    assert(preOk.code === 0, `expected a clean preflight, got ${preOk.code}: ${preOk.output}`);

    // Simulate an out-of-band edit: mutate the file directly, bypassing the reducer entirely.
    const doc = readJson<{ balances: unknown[] }>(p.file);
    doc.balances = [{ unit: "Growth", period: "x", currency: "USD", allocated: 1, committed: 0, spent: 0, remaining: 1, updatedAt: "2026-08-04T12:00:00.000Z" }];
    writeJson(p.file, doc);

    const preflight = runCli(["preflight", "--manifest", p.manifest]);
    assert(preflight.code === 3, `expected exit 3, got ${preflight.code}: ${preflight.output}`);
    assert(preflight.output.includes("reducer.out_of_band_edit"), `expected reducer.out_of_band_edit, got: ${preflight.output}`);

    // The same tamper is also caught defensively by the next commit attempt, not only by standalone preflight.
    const patch = buildPatch("budget-ledger", [{ op: "append", path: ["entries"], value: sampleLedgerEntry("e1") }], [["entries"]]);
    const commitAfterTamper = commit(p.dir, p, patch);
    assert(commitAfterTamper.code === 3, `expected exit 3, got ${commitAfterTamper.code}: ${commitAfterTamper.output}`);
    assert(commitAfterTamper.output.includes("reducer.out_of_band_edit"), `expected reducer.out_of_band_edit, got: ${commitAfterTamper.output}`);
  });

  // --- required scenario 3: lock contention, stale-lock breaking, heartbeat refresh --------

  harness.check("reducer: commit backs off and reports 'did not run' while another session holds a live lock", () => {
    const p = scenarioPaths(harness, "lock-contention", "budget-ledger.json");
    const held = acquireLock(p.lock, { ownerSessionId: "other-session", ttlSeconds: 60 });
    assert(held.ok, "test setup: failed to pre-acquire the lock");

    const patch = budgetLedgerBootstrapPatch();
    const result = commit(p.dir, p, patch, ["--lock-retries", "1", "--lock-retry-delay-ms", "10"]);
    assert(result.code === 2, `expected exit 2, got ${result.code}: ${result.output}`);
    assert(result.output.includes("RESULT: did not run"), `expected "did not run", got: ${result.output}`);
    assert(result.output.includes("reducer.lock_held"), `expected reducer.lock_held, got: ${result.output}`);
    assert(!existsSync(p.file), "no file should have been written while the lock was contended");

    releaseLock(p.lock, "other-session");
    const retry = commit(p.dir, p, patch);
    assert(retry.code === 0, `expected the retry after release to succeed, got ${retry.code}: ${retry.output}`);
  });

  harness.check("reducer: a stale lock is only breakable with the explicit read-back-verified flag", () => {
    const p = scenarioPaths(harness, "lock-stale", "budget-ledger.json");
    const held = acquireLock(p.lock, { ownerSessionId: "dead-session", ttlSeconds: 1 });
    assert(held.ok, "test setup: failed to pre-acquire the lock");
    const lock = readLock(p.lock)!;
    writeJson(p.lock, { ...lock, heartbeatAt: new Date(Date.now() - 30_000).toISOString() });

    const patch = budgetLedgerBootstrapPatch();
    const withoutFlag = commit(p.dir, p, patch, ["--lock-retries", "0"]);
    assert(withoutFlag.code === 2, `expected exit 2 without the break-stale flag, got ${withoutFlag.code}: ${withoutFlag.output}`);
    assert(withoutFlag.output.includes("reducer.lock_stale_requires_break"), `expected reducer.lock_stale_requires_break, got: ${withoutFlag.output}`);
    assert(!existsSync(p.file), "no file should have been written without the break-stale flag");

    const withFlag = commit(p.dir, p, patch, ["--break-stale-verified", "true"]);
    assert(withFlag.code === 0, `expected the break-stale commit to succeed, got ${withFlag.code}: ${withFlag.output}`);
  });

  harness.check("reducer/lock: heartbeat refresh prevents a live lock from ever reading as stale", () => {
    const dir = harness.makeTempDir("reducer-lock-heartbeat");
    const lockPath = path.join(dir, "state.lock");
    const acquired = acquireLock(lockPath, { ownerSessionId: "scheduled-1", ttlSeconds: 1 });
    assert(acquired.ok, "failed to acquire the lock");
    for (let i = 0; i < 3; i += 1) {
      heartbeat(lockPath, "scheduled-1");
      const attempt = acquireLock(lockPath, { ownerSessionId: "someone-else", ttlSeconds: 1, retries: 0 });
      assert(!attempt.ok && attempt.reason === "held", `expected a heartbeat-refreshed lock to read as held (never stale), got: ${JSON.stringify(attempt)}`);
    }
    releaseLock(lockPath, "scheduled-1");
  });

  // --- required scenario 4: audit chain break detection + append-only ----------------------

  harness.check("reducer/audit: appendAuditEntry chains each entry to the previous entry's hash from genesis", () => {
    const dir = harness.makeTempDir("reducer-audit-unit");
    const auditPath = path.join(dir, "audit.jsonl");
    const e1 = appendAuditEntry(auditPath, { sessionId: "s", targetDoc: "control", patchId: "p1", action: "commit", summary: "one", stateHash: "h1" }, "2026-08-04T12:00:00.000Z");
    const e2 = appendAuditEntry(auditPath, { sessionId: "s", targetDoc: "control", patchId: "p2", action: "commit", summary: "two", stateHash: "h2" }, "2026-08-04T12:05:00.000Z");
    assert(e1.previousHash === AUDIT_GENESIS_HASH, "the first entry must chain to genesis");
    assert(e2.previousHash === e1.entryHash, "the second entry must chain to the first entry's hash");
    assert(e1.seq === 1 && e2.seq === 2, "sequence numbers must increment by one");
    const verification = verifyAuditChain(auditPath);
    assert(verification.valid && verification.entriesChecked === 2, `expected a clean two-entry chain, got: ${JSON.stringify(verification)}`);
  });

  harness.check("reducer: audit chain verification fails when a historical entry is mutated, alongside the append-only property", () => {
    const p = scenarioPaths(harness, "audit-chain", "budget-ledger.json");
    const r0 = commit(p.dir, p, budgetLedgerBootstrapPatch());
    assert(r0.code === 0, `commit 0 failed: ${r0.output}`);
    const afterFirst = readFileSync(p.audit, "utf8");

    const patch1 = buildPatch("budget-ledger", [{ op: "append", path: ["entries"], value: sampleLedgerEntry("e1") }], [["entries"]]);
    const r1 = commit(p.dir, p, patch1);
    assert(r1.code === 0, `commit 1 failed: ${r1.output}`);

    // append-only: the first entry's bytes are unchanged, and the log only grew.
    const afterSecond = readFileSync(p.audit, "utf8");
    assert(afterSecond.startsWith(afterFirst), "the audit log's first entry changed after a later append (not append-only)");
    assert(readAuditLog(p.audit).length === 2, "expected exactly two audit entries after two successful commits");

    const verify = runCli(["verify-audit", "--audit", p.audit]);
    assert(verify.code === 0, `expected a clean audit chain, got ${verify.code}: ${verify.output}`);

    // Mutate a historical entry directly (never via the reducer) and assert the break is detected.
    const lines = readFileSync(p.audit, "utf8").trimEnd().split("\n");
    const first = JSON.parse(lines[0]!) as { summary: string };
    first.summary = "TAMPERED";
    lines[0] = JSON.stringify(first);
    writeFileSync(p.audit, `${lines.join("\n")}\n`, "utf8");

    const brokenVerify = runCli(["verify-audit", "--audit", p.audit]);
    assert(brokenVerify.code === 3, `expected exit 3 after tampering, got ${brokenVerify.code}: ${brokenVerify.output}`);
    assert(brokenVerify.output.includes("reducer.audit_chain_broken"), `expected reducer.audit_chain_broken, got: ${brokenVerify.output}`);

    const direct = verifyAuditChain(p.audit);
    assert(!direct.valid && direct.brokenAtSeq === 1, `expected verifyAuditChain to report the break at seq 1, got: ${JSON.stringify(direct)}`);
  });

  // --- required scenario 5: cooperative yield acquires only at a batch boundary ------------

  harness.check("reducer/lock: a pending interactive request is honored only at the scheduled holder's next batch boundary, never mid-attempt", () => {
    const dir = harness.makeTempDir("reducer-lock-cooperative-yield");
    const lockPath = path.join(dir, "state.lock");

    const scheduled = acquireLock(lockPath, { ownerSessionId: "scheduled-session", ttlSeconds: 60 });
    assert(scheduled.ok, "scheduled session failed to acquire the lock");

    // Mid-attempt: the request is signaled, but the scheduled session has not reached a batch
    // boundary yet. It must not have released, and the interactive session must not acquire.
    requestInteractive(lockPath);
    const midAttempt = acquireLock(lockPath, { ownerSessionId: "interactive-session", ttlSeconds: 60, retries: 0 });
    assert(!midAttempt.ok && midAttempt.reason === "held", "the interactive session acquired the lock mid-attempt, before the scheduled holder's batch boundary");
    assert(readLock(lockPath)?.ownerSessionId === "scheduled-session", "lock ownership changed before the scheduled holder yielded");

    // The scheduled holder reaches its own batch boundary and checks for a pending request.
    const shouldYield = checkYield(lockPath, "scheduled-session");
    assert(shouldYield, "expected checkYield to report a pending interactive request at the batch boundary");
    releaseLock(lockPath, "scheduled-session");

    // Only now can the interactive session acquire.
    const afterYield = acquireLock(lockPath, { ownerSessionId: "interactive-session", ttlSeconds: 60, retries: 0 });
    assert(afterYield.ok, "interactive session failed to acquire immediately after the scheduled holder yielded at the boundary");
    releaseLock(lockPath, "interactive-session");
  });

  // --- concurrent hash-manifest correctness (judged missing, added per plan's instruction) --

  harness.check("reducer: two commits against the same file serialize through the lock; the manifest never drifts from the on-disk file", () => {
    const p = scenarioPaths(harness, "concurrent-manifest", "budget-ledger.json");
    const r0 = commit(p.dir, p, budgetLedgerBootstrapPatch());
    assert(r0.code === 0, `bootstrap failed: ${r0.output}`);

    // Simulate a second writer mid-write by holding the lock directly.
    const heldByB = acquireLock(p.lock, { ownerSessionId: "writer-b", ttlSeconds: 60 });
    assert(heldByB.ok, "test setup: writer-b failed to hold the lock");

    const patchA = buildPatch("budget-ledger", [{ op: "append", path: ["entries"], value: sampleLedgerEntry("from-a") }], [["entries"]]);
    const attemptA = commit(p.dir, p, patchA, ["--lock-retries", "0"]);
    assert(attemptA.code === 2, `expected writer-a to back off while writer-b holds the lock, got ${attemptA.code}: ${attemptA.output}`);

    const manifestDuringHold = readJson<{ entries: Record<string, { stateHash: string }> }>(p.manifest);
    const hashDuringHold = manifestDuringHold.entries[path.resolve(p.file)]!.stateHash;
    assert(hashDuringHold === sha256Hex(readFileSync(p.file, "utf8")), "the manifest must still match the on-disk file after a lock-contended, refused commit");

    releaseLock(p.lock, "writer-b");
    const attemptARetry = commit(p.dir, p, patchA);
    assert(attemptARetry.code === 0, `expected writer-a to succeed once the lock is free, got ${attemptARetry.code}: ${attemptARetry.output}`);

    const finalManifest = readJson<{ entries: Record<string, { stateHash: string }> }>(p.manifest);
    const finalHash = finalManifest.entries[path.resolve(p.file)]!.stateHash;
    assert(finalHash === sha256Hex(readFileSync(p.file, "utf8")), "the final manifest hash must match the final on-disk content (no lost update)");
    assert(readAuditLog(p.audit).length === 2, "expected exactly two committed audit entries: bootstrap + writer-a's successful retry");
  });

  // --- path-segment safety: dotted domain IDs are one key, never a nested path -------------

  harness.check('reducer: a dotted domain ID is a single map key, never a nested path (control.grants["domain.growth"])', () => {
    const p = scenarioPaths(harness, "dotted-domain-path", "control.json");
    const r0 = commit(p.dir, p, controlBootstrapPatch());
    assert(r0.code === 0, `bootstrap failed: ${r0.output}`);

    const grant = { domainId: "domain.growth", level: "run-with-guardrails", prerequisites: [], grantedAt: "2026-08-04T12:00:00.000Z", grantedBy: "founder", updatedAt: "2026-08-04T12:00:00.000Z" };
    const patch = buildPatch("control", [{ op: "merge", path: ["grants"], value: { "domain.growth": grant } }], [["grants"]]);
    const result = commit(p.dir, p, patch);
    assert(result.code === 0, `expected a valid grants merge to commit, got ${result.code}: ${result.output}`);

    const doc = readJson<{ grants: Record<string, unknown> }>(p.file);
    assert(Object.keys(doc.grants).length === 1 && "domain.growth" in doc.grants, `expected exactly one key "domain.growth", got: ${JSON.stringify(Object.keys(doc.grants))}`);
    assert(!("domain" in doc.grants), 'the dotted domain ID was split into a nested "domain" key instead of one literal key');
  });

  // --- coverage: all five target docs route to the correct U1 validator --------------------

  harness.check("reducer: grants and waivers target docs commit as standalone documents validated against U1's schemas", () => {
    const gp = scenarioPaths(harness, "grants-standalone", "grants.json");
    const gResult = commit(gp.dir, gp, grantsBootstrapPatch());
    assert(gResult.code === 0, `grants bootstrap failed: ${gResult.output}`);
    const gDoc = readJson<{ schemaVersion: string }>(gp.file);
    assert(gDoc.schemaVersion === "1.0.0", `grants document schemaVersion mismatch: ${gDoc.schemaVersion}`);

    const wp = scenarioPaths(harness, "waivers-standalone", "waivers.json");
    const wResult = commit(wp.dir, wp, waiversBootstrapPatch());
    assert(wResult.code === 0, `waivers bootstrap failed: ${wResult.output}`);
  });

  // --- CLI reads a patch from stdin, not only from a file -----------------------------------

  harness.check("reducer: commit reads a patch from stdin when --patch is omitted", () => {
    const p = scenarioPaths(harness, "stdin-patch", "budget-ledger.json");
    const patch = budgetLedgerBootstrapPatch();
    const result = runCli(["commit", "--file", p.file, "--manifest", p.manifest, "--audit", p.audit, "--session", "session-fixture"], JSON.stringify(patch));
    assert(result.code === 0, `expected a stdin-fed commit to succeed, got ${result.code}: ${result.output}`);
    assert(existsSync(p.file), "a stdin-fed commit did not write the target file");
  });
}
