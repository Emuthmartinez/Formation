import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { assert, skillRoot, type Harness } from "./_harness.js";
import { laneKeys } from "../../core/schema/types.js";
import { acquireLock, releaseLock } from "../../core/reducer/lock.js";
import { compilePlan, type CatalogInput } from "../../core/engine/compile.js";
import { seedRunState, writeRunState } from "../../core/engine/runstate.js";
import { internalVocabularyBlocklist } from "../../core/session/digest.js";
import { pathToFileURL } from "node:url";

/**
 * U5 session-runner fixtures: exercises core/session/run.ts as a real subprocess (mirroring
 * reducer.fixtures.ts's convention) against a bootstrapped temp workspace, plus a few in-process
 * checks of digest.ts's pure translation/push functions where a subprocess would add nothing.
 * RESEND_API_KEY is never present in any spawned session's environment here — no fixture may ever
 * attempt a real network send; the "attempted" push paths are covered in-process with a fake
 * transport instead.
 */

function resolveTsxBin(): string {
  const candidates = [path.join(skillRoot, "node_modules/.bin/tsx"), path.resolve(skillRoot, "../..", "node_modules/.bin/tsx")];
  return candidates.find((candidate) => existsSync(candidate)) ?? "tsx";
}

const tsxBin = resolveTsxBin();
const reducerCliPath = path.join(skillRoot, "core/reducer/cli.ts");
const runCliPath = path.join(skillRoot, "core/session/run.ts");

interface CliResult {
  readonly code: number;
  readonly output: string;
}

function runReducer(args: string[], input?: string): CliResult {
  const result = spawnSync(tsxBin, [reducerCliPath, ...args], { cwd: skillRoot, encoding: "utf8", input });
  return { code: result.status ?? -1, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

/** Env with RESEND_API_KEY stripped, regardless of the host shell — a spawned session must never see a real key. */
function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.RESEND_API_KEY;
  return env;
}

function runSession(args: string[]): CliResult {
  const result = spawnSync(tsxBin, [runCliPath, ...args], { cwd: skillRoot, encoding: "utf8", env: cleanEnv() });
  return { code: result.status ?? -1, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

let patchCounter = 0;
function nextPatchId(): string {
  patchCounter += 1;
  return `session-fixture-patch-${patchCounter}`;
}

function buildPatch(targetDoc: string, ops: Array<Record<string, unknown>>, declaredOutputs: string[][]): Record<string, unknown> {
  return { schemaVersion: "1.0.0", patchId: nextPatchId(), targetDoc, reason: "session fixture setup", authoredBy: "session-fixture-setup", authoredAt: "2026-08-05T00:00:00.000Z", preconditions: [], ops, declaredOutputs };
}

function minimalLanes(): Record<string, unknown> {
  const lanes: Record<string, unknown> = {};
  for (const key of laneKeys) lanes[key] = { status: "pending", evidence: [], blockers: [] };
  return lanes;
}

interface WorkspaceHandle {
  readonly dir: string;
  readonly statePath: string;
  readonly controlPath: string;
  readonly ledgerPath: string;
  readonly manifestPath: string;
  readonly auditPath: string;
  readonly catalogPath: string;
  readonly briefPath: string;
  readonly digestPath: (sessionId: string) => string;
}

function commit(handle: WorkspaceHandle, targetFile: string, patch: Record<string, unknown>): CliResult {
  const patchPath = path.join(handle.dir, `${patch.patchId as string}.json`);
  writeJson(patchPath, patch);
  // Workspace bootstrap stands in for the founder-initiated onboarding flow, so it carries
  // --founder-authority (the reducer requires it for control/grants/waivers patches).
  const result = runReducer(["commit", "--patch", patchPath, "--file", targetFile, "--manifest", handle.manifestPath, "--audit", handle.auditPath, "--session", "session-fixture-setup", "--founder-authority", "true"]);
  assert(result.code === 0, `workspace bootstrap commit failed: ${result.output}`);
  return result;
}

interface BootstrapOptions {
  readonly pendingGates?: Array<{ id: string; category: string; reason: string; createdAt: string }>;
  readonly grants?: Record<string, unknown>;
  readonly waivers?: unknown[];
  readonly balances?: unknown[];
  readonly founderEmail?: string;
  readonly scopeHints?: string[];
}

function bootstrapWorkspace(harness: Harness, name: string, catalog: CatalogInput, options: BootstrapOptions = {}): WorkspaceHandle {
  const dir = harness.makeTempDir(`session-${name}`);
  const handle: WorkspaceHandle = {
    dir,
    statePath: path.join(dir, "state", "business-state.json"),
    controlPath: path.join(dir, "control", "control.json"),
    ledgerPath: path.join(dir, "control", "budget-ledger.json"),
    manifestPath: path.join(dir, "control", "manifest.json"),
    auditPath: path.join(dir, "control", "audit.jsonl"),
    catalogPath: path.join(dir, "catalog.json"),
    briefPath: path.join(dir, "brief.json"),
    digestPath: (sessionId: string) => path.join(dir, "digests", `${sessionId}.md`),
  };

  commit(
    handle,
    handle.statePath,
    buildPatch(
      "business-state",
      [
        { op: "set", path: ["narrative"], value: { sinceLastTime: "", rightNow: "", yourCall: "", lastCelebratedPhase: "" } },
        {
          op: "set",
          path: ["project"],
          value: { name: "Fixture App", slug: name, owner: "Founder", phase: "phase_0_orient", launchScope: "essentials", kickoffDate: "", platforms: ["ios"], bundleIds: { ios: "com.example.app", android: "" }, publicUrls: { landing: "", privacy: "", terms: "" } },
        },
        { op: "set", path: ["lanes"], value: minimalLanes() },
        { op: "set", path: ["founderGates"], value: { pending: options.pendingGates ?? [] } },
      ],
      [["narrative"], ["project"], ["lanes"], ["founderGates"]],
    ),
  );

  commit(
    handle,
    handle.controlPath,
    buildPatch(
      "control",
      [
        { op: "set", path: ["businessSlug"], value: name },
        { op: "set", path: ["stateHash"], value: "" },
        { op: "set", path: ["killSwitch"], value: { engaged: false, engagedAt: "", engagedBy: "", reason: "" } },
        { op: "set", path: ["grants"], value: options.grants ?? {} },
        { op: "set", path: ["waivers"], value: options.waivers ?? [] },
      ],
      [["businessSlug"], ["stateHash"], ["killSwitch"], ["grants"], ["waivers"]],
    ),
  );

  commit(handle, handle.ledgerPath, buildPatch("budget-ledger", [{ op: "set", path: ["balances"], value: options.balances ?? [] }, { op: "set", path: ["entries"], value: [] }], [["balances"], ["entries"]]));

  writeJson(handle.catalogPath, catalog);
  writeJson(handle.briefPath, {
    schemaVersion: "1.0.0",
    businessSlug: name,
    founderContact: { email: options.founderEmail ?? "founder@example.com" },
    ...(options.scopeHints ? { scopeHints: options.scopeHints } : {}),
  });

  return handle;
}

function grant(domainId: string, level: string, now = "2026-08-01T00:00:00.000Z"): Record<string, unknown> {
  return { domainId, level, prerequisites: [], grantedAt: now, grantedBy: "founder", updatedAt: now };
}

function waiver(id: string, domainId: string, actionClass: string, protectedCategory: string, now = "2026-08-01T00:00:00.000Z"): Record<string, unknown> {
  return {
    id,
    domainId,
    actionClass,
    protectedCategory,
    scope: { resourcePattern: "*", description: "Fixture-authored waiver for the session-runner fixture suite." },
    caps: { maxPerAction: 1000, maxPerPeriod: 10000, currency: "USD" },
    budgetPeriod: "monthly",
    expiry: "2099-01-01T00:00:00.000Z",
    undoContract: { kind: "mitigation", irreversibilityAcknowledgment: "This fixture waiver models an irreversible action for the session-runner suite.", mitigationSteps: ["Review the audit log"] },
    auditRef: "audit.fixture",
    status: "active",
    createdAt: now,
    createdBy: "founder",
  };
}

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

function assertNoInternalVocabulary(label: string, text: string): void {
  const leaked = internalVocabularyBlocklist.filter((term) => text.includes(term));
  assert(leaked.length === 0, `${label}: digest leaked internal vocabulary: ${JSON.stringify(leaked)}\n---\n${text}`);
}

function readDigest(handle: WorkspaceHandle, sessionId: string): string {
  const filePath = handle.digestPath(sessionId);
  assert(existsSync(filePath), `expected a digest file at ${filePath} — a session must never exit silently`);
  return readFileSync(filePath, "utf8");
}

// --- fixture catalogs -----------------------------------------------------------------------

function singleNodeCatalog(): CatalogInput {
  return {
    version: "catalog.session-fixture.single",
    artifacts: [{ id: "artifact.eng-change", path: "engineering/change.log" }],
    workflows: [
      { id: "workflow.eng-change", title: "Update the onboarding copy", domainId: "domain.engineering", actionClass: "mutate", dependencies: [], outputPaths: ["engineering/change.log"], providerIds: [], laneIds: [], founderOnlyActions: [], gateCommands: [], idempotent: true },
    ],
  };
}

function comprehensiveCatalog(): CatalogInput {
  return {
    version: "catalog.session-fixture.comprehensive",
    artifacts: [
      { id: "artifact.growth-scan", path: "growth/scan.md" },
      { id: "artifact.money-report", path: "money/report.md" },
      { id: "artifact.eng-change", path: "engineering/change.log" },
    ],
    workflows: [
      { id: "workflow.growth-scan", title: "Scan what people are saying", domainId: "domain.growth", actionClass: "observe", dependencies: [], outputPaths: ["growth/scan.md"], providerIds: [], laneIds: [], founderOnlyActions: [], gateCommands: [], idempotent: true },
      {
        id: "workflow.money-report",
        title: "Pull this week's revenue report",
        domainId: "domain.money",
        actionClass: "spend",
        protectedCategory: "spend",
        costEstimate: { amount: 25, currency: "USD" },
        dependencies: [],
        outputPaths: ["money/report.md"],
        providerIds: [],
        laneIds: [],
        founderOnlyActions: [],
        gateCommands: [],
        idempotent: false,
      },
      { id: "workflow.eng-change", title: "Update the onboarding copy", domainId: "domain.engineering", actionClass: "mutate", dependencies: [], outputPaths: ["engineering/change.log"], providerIds: [], laneIds: [], founderOnlyActions: [], gateCommands: [], idempotent: true },
    ],
  };
}

function singleGrowthNodeCatalog(): CatalogInput {
  return {
    version: "catalog.session-fixture.orphan",
    artifacts: [{ id: "artifact.growth-scan", path: "growth/scan.md" }],
    workflows: [{ id: "workflow.growth-scan", title: "Scan what people are saying", domainId: "domain.growth", actionClass: "observe", dependencies: [], outputPaths: ["growth/scan.md"], providerIds: [], laneIds: [], founderOnlyActions: [], gateCommands: [], idempotent: true }],
  };
}

export function register(harness: Harness): void {
  // --- scenario 1: all nodes gated exits cleanly with a parked digest, not silence -----------

  harness.check("session: a session with all nodes gated exits cleanly with a populated 'parked' digest, not silence", () => {
    const handle = bootstrapWorkspace(harness, "all-gated", singleNodeCatalog(), { grants: {} }); // no grants at all: everything parks
    const result = runSession(["--workspace", handle.dir, "--brief", handle.briefPath, "--session", "sess-all-gated-1"]);
    assert(result.code === 0, `expected exit 0 for a cleanly-parked session, got ${result.code}: ${result.output}`);

    const text = readDigest(handle, "sess-all-gated-1");
    assert(text.includes("Nothing moved forward this time."), `expected an explicit 'nothing moved forward' line, got:\n${text}`);
    assert(text.includes("Update the onboarding copy"), `expected the gated node's title in the digest, got:\n${text}`);
    assert(!text.includes("Nothing is waiting on you right now."), `expected the parked section to be populated (not the empty state), got:\n${text}`);
    assert(text.includes("You haven't told me how much I can do in this area yet."), `expected the translated no-grant reason, got:\n${text}`);
    assertNoInternalVocabulary("all-gated", text);
  });

  // --- scenario 2: digest content (advanced/parked/spend/anomalies), founder vocabulary only -

  harness.check("session: digest content is populated from run state (advanced/parked/spend) in founder vocabulary only, and push-skipped-no-key is recorded", () => {
    const period = currentPeriod();
    const handle = bootstrapWorkspace(harness, "comprehensive", comprehensiveCatalog(), {
      grants: { "domain.growth": grant("domain.growth", "review-first"), "domain.money": grant("domain.money", "full") },
      waivers: [waiver("waiver.money.1", "domain.money", "spend", "spend")],
      balances: [{ unit: "Revenue", period, currency: "USD", allocated: 1000, committed: 0, spent: 0, remaining: 1000, updatedAt: "2026-08-01T00:00:00.000Z" }],
      pendingGates: [{ id: "gate.eng-change", category: "other", reason: "Update the onboarding copy", createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() }],
    });

    const result = runSession(["--workspace", handle.dir, "--brief", handle.briefPath, "--session", "sess-comprehensive-1", "--executor", "fixture"]);
    assert(result.code === 0, `expected exit 0, got ${result.code}: ${result.output}`);

    const text = readDigest(handle, "sess-comprehensive-1");
    assert(text.includes("Scan what people are saying"), `expected the observe node in 'advanced', got:\n${text}`);
    assert(text.includes("Pull this week's revenue report"), `expected the spend node in 'advanced', got:\n${text}`);
    assert(text.includes("Update the onboarding copy"), `expected the ungranted node in 'parked', got:\n${text}`);
    assert(text.includes("You haven't told me how much I can do in this area yet."), `expected the translated no-grant reason for the parked node, got:\n${text}`);
    assert(/waiting 3 days?/.test(text), `expected an age annotation on the parked founder-gate item, got:\n${text}`);
    assert(text.includes("$25.00 of $1000.00 spent"), `expected the spend section to reflect the recorded actual, got:\n${text}`);
    assert(text.includes("$975.00 left"), `expected the spend section to reflect the decremented remaining balance, got:\n${text}`);
    assert(text.includes("Sent to your inbox: skipped (no key)."), `expected a push-skipped-no-key line, got:\n${text}`);
    assertNoInternalVocabulary("comprehensive", text);
  });

  // --- judgment scenario: a node execution failure is reported, not silently dropped ---------

  harness.check("session: a node execution failure is neither 'advanced' nor silently dropped — it shows up as something to watch", () => {
    const handle = bootstrapWorkspace(harness, "exec-failure", singleNodeCatalog(), { grants: { "domain.engineering": grant("domain.engineering", "run-with-guardrails") } });
    // Deliberately omit --executor: the default no-op executor fails every attempt.
    const result = runSession(["--workspace", handle.dir, "--brief", handle.briefPath, "--session", "sess-exec-failure-1"]);
    assert(result.code === 0, `expected exit 0 (a node failure is not a session crash), got ${result.code}: ${result.output}`);

    const text = readDigest(handle, "sess-exec-failure-1");
    assert(text.includes("Update the onboarding copy"), `expected the failed node's title to be named, got:\n${text}`);
    assert(text.includes("didn't go through"), `expected the execution failure to be reported as an anomaly rather than silently dropped, got:\n${text}`);
    assert(!text.includes("Nothing out of the ordinary."), `expected the anomalies section to be populated, got:\n${text}`);
    const advancedSection = text.split("## What moved forward")[1]!.split("## Needs your call")[0]!;
    assert(!advancedSection.includes("Update the onboarding copy"), `a failed node must not be reported as 'advanced', got advanced section:\n${advancedSection}`);
    assertNoInternalVocabulary("exec-failure", text);
  });

  // --- judgment scenario: an internal crash never leaks engine vocabulary into the digest ----

  harness.check("session: an internal crash (malformed catalog) is reported without leaking engine vocabulary, and still exits non-zero", () => {
    const handle = bootstrapWorkspace(harness, "crash", singleNodeCatalog());
    // Corrupt the catalog after bootstrap: an unknown dependency reference makes compilePlan() throw.
    writeJson(handle.catalogPath, {
      version: "catalog.broken",
      artifacts: [{ id: "artifact.eng-change", path: "engineering/change.log" }],
      workflows: [{ id: "workflow.eng-change", title: "Update the onboarding copy", domainId: "domain.engineering", actionClass: "mutate", dependencies: ["workflow.does-not-exist"], outputPaths: ["engineering/change.log"], providerIds: [], laneIds: [], founderOnlyActions: [], gateCommands: [], idempotent: true }],
    });

    const result = runSession(["--workspace", handle.dir, "--brief", handle.briefPath, "--session", "sess-crash-1"]);
    assert(result.code === 1, `expected exit 1 on an internal crash, got ${result.code}: ${result.output}`);

    const text = readDigest(handle, "sess-crash-1");
    assert(text.toLowerCase().includes("unexpected"), `expected a plain 'something went wrong' anomaly, got:\n${text}`);
    assertNoInternalVocabulary("crash", text);
  });

  // --- scenario 3: preflight failure -> anomalies digest entry + non-zero exit ---------------

  harness.check("session: a preflight failure (state-hash mismatch) produces an anomalies digest entry and a non-zero exit, never a silent death", () => {
    const handle = bootstrapWorkspace(harness, "preflight-fail", singleNodeCatalog());
    // Out-of-band edit: mutate business-state.json directly, bypassing the reducer entirely.
    const doc = JSON.parse(readFileSync(handle.statePath, "utf8")) as { project: { name: string } };
    doc.project.name = "Tampered Directly";
    writeJson(handle.statePath, doc);

    const result = runSession(["--workspace", handle.dir, "--brief", handle.briefPath, "--session", "sess-preflight-fail-1"]);
    assert(result.code === 3, `expected exit 3 on preflight failure, got ${result.code}: ${result.output}`);

    const text = readDigest(handle, "sess-preflight-fail-1");
    assert(text.toLowerCase().includes("saved files") || text.toLowerCase().includes("changed them outside"), `expected an anomaly describing the out-of-band edit, got:\n${text}`);
    assert(!text.includes("Nothing out of the ordinary."), `expected the anomalies section to be populated, not the empty state, got:\n${text}`);
    assertNoInternalVocabulary("preflight-fail", text);
  });

  // --- scenario 4: wall-clock cap exceeded -> timed-out digest entry -------------------------

  harness.check("session: a run exceeding its wall-clock cap stops on purpose and writes a timed-out digest entry", () => {
    const period = currentPeriod();
    const handle = bootstrapWorkspace(harness, "timeout", comprehensiveCatalog(), {
      grants: { "domain.growth": grant("domain.growth", "review-first"), "domain.money": grant("domain.money", "full") },
      waivers: [waiver("waiver.money.1", "domain.money", "spend", "spend")],
      balances: [{ unit: "Revenue", period, currency: "USD", allocated: 1000, committed: 0, spent: 0, remaining: 1000, updatedAt: "2026-08-01T00:00:00.000Z" }],
    });

    const result = runSession(["--workspace", handle.dir, "--brief", handle.briefPath, "--session", "sess-timeout-1", "--executor", "fixture", "--wall-clock-seconds", "0"]);
    assert(result.code === 0, `expected exit 0 for a graceful timeout, got ${result.code}: ${result.output}`);

    const text = readDigest(handle, "sess-timeout-1");
    assert(text.includes("ran out of time") || text.includes("hit my time limit"), `expected timed-out language in the digest, got:\n${text}`);
    assert(text.includes("Nothing moved forward this time."), `expected zero progress once the cap was already exceeded at session start, got:\n${text}`);
    assertNoInternalVocabulary("timeout", text);
  });

  // --- scenario 5: crash before digest -> next session detects the orphaned run --------------

  harness.check("session: a crash before the digest is detected as an orphaned run by the next session and reported in its digest", () => {
    const handle = bootstrapWorkspace(harness, "orphan", singleGrowthNodeCatalog(), { grants: { "domain.growth": grant("domain.growth", "review-first") } });

    // Simulate a prior session that crashed mid-attempt: seed a plan/run and hand-craft a stale "running" attempt, then write it directly (this IS the engine's own file, not reducer-owned).
    const catalog = singleGrowthNodeCatalog();
    const plan = compilePlan(catalog, "2026-08-01T00:00:00.000Z");
    const businessState = JSON.parse(readFileSync(handle.statePath, "utf8"));
    const run = seedRunState(plan, businessState, { ownerSessionId: "prior-crashed-session", ttlSeconds: 300, wallClockCapSeconds: 1800, now: "2026-08-01T00:00:00.000Z" });
    const nodeId = plan.nodes[0]!.id;
    const staleHeartbeat = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    run.nodes[nodeId]!.status = "running";
    run.nodes[nodeId]!.attempts.push({ id: `${nodeId}.attempt.1`, nodeId, number: 1, status: "running", ownerSessionId: "prior-crashed-session", heartbeatAt: staleHeartbeat, ttlSeconds: 300, inputFingerprint: "x", startedAt: staleHeartbeat, evidence: [], readbackRequired: false });
    mkdirSync(path.join(handle.dir, "run"), { recursive: true });
    writeRunState(path.join(handle.dir, "run", "run-state.json"), run);

    const result = runSession(["--workspace", handle.dir, "--brief", handle.briefPath, "--session", "sess-orphan-2", "--executor", "fixture"]);
    assert(result.code === 0, `expected exit 0, got ${result.code}: ${result.output}`);

    const text = readDigest(handle, "sess-orphan-2");
    assert(text.includes("didn't finish cleanly last session"), `expected an orphan anomaly, got:\n${text}`);
    assert(text.includes("Scan what people are saying"), `expected the orphaned (idempotent) node to be retried and appear in 'advanced' this session, got:\n${text}`);
    assertNoInternalVocabulary("orphan", text);
  });

  // --- judgment scenario: lock back-off digest ------------------------------------------------

  harness.check("session: lock contention backs off, exits 2, and still writes a 'did not run' digest", () => {
    const handle = bootstrapWorkspace(harness, "lock-contention", singleNodeCatalog());
    const lockPath = path.join(handle.dir, "control", "session.lock");
    const held = acquireLock(lockPath, { ownerSessionId: "other-session", ttlSeconds: 60 });
    assert(held.ok, "test setup: failed to pre-acquire the session lock");

    const result = runSession(["--workspace", handle.dir, "--brief", handle.briefPath, "--session", "sess-lock-1", "--lock-retries", "0"]);
    assert(result.code === 2, `expected exit 2 on lock contention, got ${result.code}: ${result.output}`);

    const text = readDigest(handle, "sess-lock-1");
    assert(text.toLowerCase().includes("backed off") || text.toLowerCase().includes("locked"), `expected a lock-contention anomaly, got:\n${text}`);
    assertNoInternalVocabulary("lock-contention", text);

    releaseLock(lockPath, "other-session");
  });

  // --- judgment scenario: founder-vocabulary blocklist is real, not vacuous -------------------

  harness.check("session/digest: the internal-vocabulary blocklist actually catches a leak (the check is not vacuous)", () => {
    assert(internalVocabularyBlocklist.length > 0, "the blocklist must not be empty");
    const leaking = "See run.workflow.eng-change in domain.engineering — schemaVersion 1.0.0, actionClass mutate, reasonCode autonomy.no_grant.";
    const leaked = internalVocabularyBlocklist.filter((term) => leaking.includes(term));
    assert(leaked.length > 0, "the blocklist scan failed to catch an obviously internal-vocabulary string — the check would pass vacuously");
  });

  // --- judgment scenario: pushDigest attempted-ok / attempted-failed, in-process with a fake --
  // Run as a spawned script (not an in-harness async check: the shared harness's `check` runs
  // fn() synchronously — see _harness.ts — so an async assertion here would race cleanup()/
  // reportResults() rather than being awaited). A tiny driver script exercises the real,
  // async pushDigest with an injected fake transport; nothing here ever touches the real network.

  harness.check("session/digest: pushDigest attempts a send only when a key is present, and a push failure never throws", () => {
    const digestModuleUrl = pathToFileURL(path.join(skillRoot, "core/session/digest.ts")).href;
    const driverPath = path.join(harness.makeTempDir("session-push-driver"), "drive-push.mts");
    const driverSource = `
import { pushDigest, renderDigest } from ${JSON.stringify(digestModuleUrl)};
const rendered = renderDigest({ sessionId: "s1", businessSlug: "app", startedAt: "2026-08-05T00:00:00.000Z", endedAt: "2026-08-05T00:05:00.000Z", outcome: "completed", advanced: [], parked: [], spend: [], anomalies: [] });
async function main() {
  const skipped = await pushDigest(rendered, "founder@example.com", { env: {} });
  if (skipped.attempted !== false || skipped.skippedReason !== "no key") throw new Error("skip-path failed: " + JSON.stringify(skipped));

  const ok = await pushDigest(rendered, "founder@example.com", { env: { RESEND_API_KEY: "fixture-fake-key" }, transport: { send: async () => ({ ok: true, id: "fixture-send-1" }) } });
  if (!(ok.attempted && ok.ok === true && ok.id === "fixture-send-1")) throw new Error("ok-path failed: " + JSON.stringify(ok));

  const failed = await pushDigest(rendered, "founder@example.com", { env: { RESEND_API_KEY: "fixture-fake-key" }, transport: { send: async () => ({ ok: false, error: "fixture: simulated network failure" }) } });
  if (!(failed.attempted && failed.ok === false && failed.error === "fixture: simulated network failure")) throw new Error("fail-path failed: " + JSON.stringify(failed));

  console.log("PUSH_DRIVER_OK");
}
main().catch((error) => { console.error(String(error)); process.exit(1); });
`;
    writeFileSync(driverPath, driverSource, "utf8");
    const result = spawnSync(tsxBin, [driverPath], { cwd: skillRoot, encoding: "utf8" });
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    assert(result.status === 0 && output.includes("PUSH_DRIVER_OK"), `pushDigest driver failed (exit ${result.status}):\n${output}`);
  });

  // --- judgment scenario: scope hints restrict what a session dispatches ---------------------

  harness.check("session: scope hints restrict this session to matching domains, leaving out-of-scope ready nodes untouched for a future session", () => {
    const handle = bootstrapWorkspace(harness, "scope-hints", comprehensiveCatalog(), {
      grants: { "domain.growth": grant("domain.growth", "review-first"), "domain.money": grant("domain.money", "full") },
      waivers: [waiver("waiver.money.1", "domain.money", "spend", "spend")],
      balances: [{ unit: "Revenue", period: currentPeriod(), currency: "USD", allocated: 1000, committed: 0, spent: 0, remaining: 1000, updatedAt: "2026-08-01T00:00:00.000Z" }],
      scopeHints: ["domain.growth"],
    });

    const result = runSession(["--workspace", handle.dir, "--brief", handle.briefPath, "--session", "sess-scope-1", "--executor", "fixture"]);
    assert(result.code === 0, `expected exit 0, got ${result.code}: ${result.output}`);

    const text = readDigest(handle, "sess-scope-1");
    assert(text.includes("Scan what people are saying"), `expected the in-scope growth node to advance, got:\n${text}`);
    assert(!text.includes("Pull this week's revenue report"), `expected the out-of-scope money node to be left untouched (neither advanced nor parked) this session, got:\n${text}`);
    assertNoInternalVocabulary("scope-hints", text);
  });
}
