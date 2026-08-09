import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { assert, skillRoot, type Harness } from "./_harness.js";
import { laneKeys, type BusinessStateV2 } from "../../core/schema/types.js";
import { acquireLock, releaseLock } from "../../core/reducer/lock.js";
import { compilePlan, type CatalogInput } from "../../core/engine/compile.js";
import { seedRunState, writeRunState } from "../../core/engine/runstate.js";
import { buildBoundaryArtifacts, buildBoundaryResults } from "../../core/adapters/platform-execution.js";
import { internalVocabularyBlocklist } from "../../core/session/digest.js";
import { pathToFileURL } from "node:url";
import { resolveTsxBin } from "../../tooling/lib/tsx-bin.js";

/**
 * U5 session-runner fixtures: exercises core/session/run.ts as a real subprocess (mirroring
 * reducer.fixtures.ts's convention) against a bootstrapped temp workspace, plus a few in-process
 * checks of digest.ts's pure translation/push functions where a subprocess would add nothing.
 * RESEND_API_KEY is never present in any spawned session's environment here — no fixture may ever
 * attempt a real network send; the "attempted" push paths are covered in-process with a fake
 * transport instead.
 */

const tsxBin = resolveTsxBin(skillRoot);
const reducerCliPath = path.join(skillRoot, "core/reducer/cli.ts");
const runCliPath = path.join(skillRoot, "core/session/run.ts");
const approveCliPath = path.join(skillRoot, "core/session/approve.ts");
const boundaryCliPath = path.join(skillRoot, "core/adapters/platform-execution.ts");

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

function runApprove(args: string[]): CliResult {
  const result = spawnSync(tsxBin, [approveCliPath, ...args], { cwd: skillRoot, encoding: "utf8" });
  return { code: result.status ?? -1, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

/** stdout kept separate from stderr: the boundary CLI's stdout is a JSON document a caller parses. */
function runBoundary(args: string[]): { code: number; stdout: string; stderr: string } {
  const result = spawnSync(tsxBin, [boundaryCliPath, ...args], { cwd: skillRoot, encoding: "utf8" });
  return { code: result.status ?? -1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
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
        { op: "set", path: ["killSwitch"], value: { engaged: false, engagedAt: "", engagedBy: "", reason: "" } },
        { op: "set", path: ["grants"], value: options.grants ?? {} },
        { op: "set", path: ["waivers"], value: options.waivers ?? [] },
      ],
      [["businessSlug"], ["killSwitch"], ["grants"], ["waivers"]],
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

/** growth-entry's only dependency sits in a different domain, both granted, so an unscoped session could dispatch either -- reproduces a scoped session's entry node being blocked entirely by an out-of-scope, not-yet-succeeded prerequisite. */
function crossDomainDependencyCatalog(): CatalogInput {
  return {
    version: "catalog.session-fixture.cross-domain-dependency",
    artifacts: [
      { id: "artifact.money-prereq", path: "money/prereq.md" },
      { id: "artifact.growth-entry", path: "growth/entry.md" },
    ],
    workflows: [
      {
        id: "workflow.money-prereq",
        title: "Confirm the revenue baseline",
        domainId: "domain.money",
        actionClass: "observe",
        dependencies: [],
        outputPaths: ["money/prereq.md"],
        providerIds: [],
        laneIds: [],
        founderOnlyActions: [],
        gateCommands: [],
        idempotent: true,
      },
      {
        id: "workflow.growth-entry",
        title: "Scan what people are saying",
        domainId: "domain.growth",
        actionClass: "observe",
        dependencies: ["workflow.money-prereq"],
        outputPaths: ["growth/entry.md"],
        providerIds: [],
        laneIds: [],
        founderOnlyActions: [],
        gateCommands: [],
        idempotent: true,
      },
    ],
  };
}

/** eng-change is deliberately capped at maxAttempts: 1 so a single hand-seeded prior attempt puts it at its ceiling. */
function exhaustibleTwoNodeCatalog(): CatalogInput {
  return {
    version: "catalog.session-fixture.exhausted-attempts",
    artifacts: [
      { id: "artifact.growth-scan", path: "growth/scan.md" },
      { id: "artifact.eng-change", path: "engineering/change.log" },
    ],
    workflows: [
      { id: "workflow.growth-scan", title: "Scan what people are saying", domainId: "domain.growth", actionClass: "observe", dependencies: [], outputPaths: ["growth/scan.md"], providerIds: [], laneIds: [], founderOnlyActions: [], gateCommands: [], idempotent: true },
      { id: "workflow.eng-change", title: "Update the onboarding copy", domainId: "domain.engineering", actionClass: "mutate", dependencies: [], outputPaths: ["engineering/change.log"], providerIds: [], laneIds: [], founderOnlyActions: [], gateCommands: [], idempotent: true, maxAttempts: 1 },
    ],
  };
}

/** A single node with a non-empty founderOnlyActions, so — once autonomy (grant+waiver+budget) allows it — it still lands waiting_founder pending an explicit approval decision. */
function approvalGatedCatalog(): CatalogInput {
  return {
    version: "catalog.session-fixture.approval-gated",
    artifacts: [{ id: "artifact.money-report", path: "money/report.md" }],
    workflows: [
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
        founderOnlyActions: ["Approve pulling this week's revenue report"],
        gateCommands: [],
        idempotent: false,
      },
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

/** ttlSeconds: 1 keeps the lock-liveness fixture fast — the slow-silent executor's delay is several multiples of this TTL, not real-world minutes. */
function slowSilentCatalog(): CatalogInput {
  return {
    version: "catalog.session-fixture.slow-silent",
    artifacts: [{ id: "artifact.eng-change", path: "engineering/change.log" }],
    workflows: [
      { id: "workflow.eng-change", title: "Update the onboarding copy", domainId: "domain.engineering", actionClass: "mutate", dependencies: [], outputPaths: ["engineering/change.log"], providerIds: [], laneIds: [], founderOnlyActions: [], gateCommands: [], idempotent: true, ttlSeconds: 1 },
    ],
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

  harness.check("session: digest content is populated from run state (advanced/parked/spend) in founder vocabulary only, and push-skipped-no-from-address is recorded", () => {
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
    // run.ts calls pushDigest() with no `from` argument (that's the exact integration point the
    // provisioning layer's from-address config is meant to fill in later — see core/provisioning),
    // so today this always skips on the from-address check, before the key is even looked at.
    assert(text.includes("Sent to your inbox: skipped (the digest from-address isn't configured yet"), `expected a push-skipped-no-from-address line, got:\n${text}`);
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

  // --- judgment scenario: a node that already exhausted its retries must park, never crash the whole session ----

  harness.check("session: a node that already exhausted its retry budget is parked for that node only — the session keeps going and other nodes still advance", () => {
    const handle = bootstrapWorkspace(harness, "exhausted-attempts", exhaustibleTwoNodeCatalog(), {
      grants: { "domain.growth": grant("domain.growth", "review-first"), "domain.engineering": grant("domain.engineering", "run-with-guardrails") },
    });

    // Pre-seed run-state with workflow.eng-change already at its (maxAttempts: 1) ceiling, status
    // still "pending" so frontier still offers it as ready — this is exactly the shape beginAttempt
    // throws on (state.attempts.length >= node.maxAttempts) if the dispatch loop doesn't guard it.
    const catalog = exhaustibleTwoNodeCatalog();
    const plan = compilePlan(catalog, "2026-08-01T00:00:00.000Z");
    const businessState = JSON.parse(readFileSync(handle.statePath, "utf8"));
    const run = seedRunState(plan, businessState, { ownerSessionId: "prior-session", ttlSeconds: 300, wallClockCapSeconds: 1800, now: "2026-08-01T00:00:00.000Z" });
    const engNodeId = plan.nodes.find((node) => node.id.includes("eng-change"))!.id;
    run.nodes[engNodeId]!.attempts.push({
      id: `${engNodeId}.attempt.1`,
      nodeId: engNodeId,
      number: 1,
      status: "failed",
      ownerSessionId: "prior-session",
      heartbeatAt: "2026-08-01T00:00:00.000Z",
      ttlSeconds: 300,
      inputFingerprint: "x",
      startedAt: "2026-08-01T00:00:00.000Z",
      finishedAt: "2026-08-01T00:00:05.000Z",
      evidence: [],
      readbackRequired: false,
    });
    mkdirSync(path.join(handle.dir, "run"), { recursive: true });
    writeRunState(path.join(handle.dir, "run", "run-state.json"), run);

    const result = runSession(["--workspace", handle.dir, "--brief", handle.briefPath, "--session", "sess-exhausted-1", "--executor", "fixture"]);
    assert(result.code === 0, `expected exit 0 — an exhausted-attempts node must park, not crash the whole session, got ${result.code}: ${result.output}`);

    const text = readDigest(handle, "sess-exhausted-1");
    assert(!text.toLowerCase().includes("something went wrong"), `expected no whole-session crash framing, got:\n${text}`);
    assert(text.includes("Scan what people are saying"), `expected the independent, healthy node to still advance despite the other node's exhausted retries, got:\n${text}`);
    const advancedSection = text.split("## What moved forward")[1]?.split("## Needs your call")[0] ?? "";
    assert(!advancedSection.includes("Update the onboarding copy"), `the exhausted-attempts node must not be reported as advanced, got advanced section:\n${advancedSection}`);
    assert(text.includes("Update the onboarding copy"), `expected the exhausted-attempts node's title to still be named (parked, not vanished), got:\n${text}`);
    assert(text.includes("stopped trying it automatically"), `expected the translated exhausted-attempts blocker text, got:\n${text}`);
    assertNoInternalVocabulary("exhausted-attempts", text);
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

  // --- judgment scenario: lock/attempt heartbeat liveness does not depend on the executor -----
  // Run as a spawned driver script (same reason as the pushDigest driver below: this needs to
  // poll a *running* child process while it executes, which the shared harness's synchronous
  // `check` cannot do). The driver spawns run.ts itself against the --executor slow-silent stand-
  // in (core/session/executor.ts), which sleeps well past the (deliberately tiny) TTL window and
  // never calls context.heartbeat() — proving the session's own timer, not executor cooperation,
  // is what keeps the lock's heartbeatAt fresh. The driver also bounds the child with a watchdog:
  // if a lingering un-cleared timer kept the runner's event loop alive, the child would never emit
  // its own 'exit' and the watchdog would fire, failing the test instead of hanging the suite.

  harness.check("session: a slow, silent executor that never calls context.heartbeat still gets its lock/attempt heartbeat refreshed by the session's own timer, staying fresh past the TTL window, and the runner exits cleanly with no lingering handle", () => {
    const handle = bootstrapWorkspace(harness, "slow-silent-heartbeat", slowSilentCatalog(), {
      grants: { "domain.engineering": grant("domain.engineering", "run-with-guardrails") },
    });
    const lockPath = path.join(handle.dir, "control", "session.lock");
    const sessionId = "sess-slow-silent-1";
    const ttlSeconds = 1;
    // 6s (not 3s): more heartbeat-interval ticks (~333ms each) means a single delayed tick from
    // host scheduling jitter costs less of the "at least 3 distinct refreshes" budget below.
    const slowDelayMs = 6000;
    const watchdogMs = slowDelayMs + 10_000;

    const driverPath = path.join(harness.makeTempDir("session-heartbeat-driver"), "drive-heartbeat.mts");
    const driverSource = `
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const tsxBin = ${JSON.stringify(tsxBin)};
const runCliPath = ${JSON.stringify(runCliPath)};
const skillRoot = ${JSON.stringify(skillRoot)};
const workspace = ${JSON.stringify(handle.dir)};
const briefPath = ${JSON.stringify(handle.briefPath)};
const lockPath = ${JSON.stringify(lockPath)};
const ttlSeconds = ${ttlSeconds};
const slowDelayMs = ${slowDelayMs};
const watchdogMs = ${watchdogMs};

function readLockHeartbeat() {
  if (!existsSync(lockPath)) return undefined;
  try {
    return JSON.parse(readFileSync(lockPath, "utf8")).heartbeatAt;
  } catch {
    return undefined;
  }
}

async function main() {
  const env = { ...process.env };
  delete env.RESEND_API_KEY;
  const child = spawn(tsxBin, [
    runCliPath,
    "--workspace", workspace,
    "--brief", briefPath,
    "--session", ${JSON.stringify(sessionId)},
    "--executor", "slow-silent",
    "--slow-delay-ms", String(slowDelayMs),
    "--lock-ttl-seconds", String(ttlSeconds),
    "--lock-retries", "0",
  ], { cwd: skillRoot, env });

  const seen = [];
  const poller = setInterval(() => {
    const hb = readLockHeartbeat();
    if (hb && seen[seen.length - 1] !== hb) seen.push(hb);
  }, 100);

  const exitInfo = await new Promise((resolve, reject) => {
    const watchdog = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("runner did not exit within the watchdog window (" + watchdogMs + "ms) — a lingering handle likely kept the process alive"));
    }, watchdogMs);
    watchdog.unref();
    child.on("exit", (code, signal) => {
      clearTimeout(watchdog);
      resolve({ code, signal });
    });
    child.on("error", (error) => {
      clearTimeout(watchdog);
      reject(error);
    });
  });
  clearInterval(poller);

  if (exitInfo.code !== 0) throw new Error("expected exit 0, got " + exitInfo.code + " signal " + String(exitInfo.signal));
  if (seen.length < 3) throw new Error("expected at least 3 distinct lock heartbeat refreshes during the " + slowDelayMs + "ms slow execution (TTL " + ttlSeconds + "s), saw " + seen.length + ": " + JSON.stringify(seen));

  // core/reducer/lock.ts's own isStale() has no grace period at all (gap > ttlSeconds*1000 is
  // stale, full stop) — that bare comparison is only evaluated when a second session actually
  // contends for the lock, never proactively against a live holder. The per-tick interval this
  // proves out (core/session/run.ts: ttlSeconds*1000/3, here ~333ms) is what keeps a real
  // contended gap far under that bound in practice. The tolerance below is deliberately much
  // looser than either of those: Node's setInterval is best-effort, not real-time, and a spawned
  // child two process-hops deep (harness -> driver -> run.ts) can lose the CPU for a second or
  // more on a busy host without any regression in the mechanism itself. This check exists to
  // catch the timer not firing at all (interval math regresses, unref/clearInterval breaks, etc.)
  // — a real break shows up as a gap near the full slowDelayMs, not a one-or-two-tick slip.
  for (let i = 1; i < seen.length; i++) {
    const gapMs = Date.parse(seen[i]) - Date.parse(seen[i - 1]);
    const toleranceMs = Math.max(ttlSeconds * 1000 * 5, 5000);
    if (gapMs > toleranceMs) {
      throw new Error("heartbeat gap " + gapMs + "ms between refreshes exceeded the liveness tolerance (TTL " + (ttlSeconds * 1000) + "ms, tolerance " + toleranceMs + "ms) — the lock would have gone stale mid-execution: " + JSON.stringify(seen));
    }
  }

  console.log("HEARTBEAT_DRIVER_OK " + seen.length + " refreshes, clean exit, code " + exitInfo.code);
}
main().catch((error) => { console.error(String((error && error.stack) || error)); process.exit(1); });
`;
    writeFileSync(driverPath, driverSource, "utf8");
    const result = spawnSync(tsxBin, [driverPath], { cwd: skillRoot, encoding: "utf8", timeout: watchdogMs + 15_000 });
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    assert(result.status === 0 && output.includes("HEARTBEAT_DRIVER_OK"), `heartbeat-liveness driver failed (exit ${result.status}, signal ${result.signal}):\n${output}`);
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

  harness.check("session/digest: pushDigest requires a configured from-address before it will even check for a key, attempts a send only once both are present, and a push failure never throws", () => {
    const digestModuleUrl = pathToFileURL(path.join(skillRoot, "core/session/digest.ts")).href;
    const driverPath = path.join(harness.makeTempDir("session-push-driver"), "drive-push.mts");
    const driverSource = `
import { pushDigest, renderDigest } from ${JSON.stringify(digestModuleUrl)};
const rendered = renderDigest({ sessionId: "s1", businessSlug: "app", startedAt: "2026-08-05T00:00:00.000Z", endedAt: "2026-08-05T00:05:00.000Z", outcome: "completed", advanced: [], parked: [], spend: [], anomalies: [] });
async function main() {
  // No from-address at all: must skip before ever looking at the key, even when a key is present —
  // this is the fix for the motivating bug (a hardcoded placeholder from-address).
  const noFrom = await pushDigest(rendered, "founder@example.com", { env: { RESEND_API_KEY: "fixture-fake-key" } });
  if (noFrom.attempted !== false || !noFrom.skippedReason || !noFrom.skippedReason.includes("from-address")) throw new Error("no-from-path failed: " + JSON.stringify(noFrom));

  // From-address present, key absent: skip on the key, not the from-address.
  const skipped = await pushDigest(rendered, "founder@example.com", { env: {}, from: "Launch Digest <digest@updates.fixture-domain.test>" });
  if (skipped.attempted !== false || skipped.skippedReason !== "no key") throw new Error("skip-path failed: " + JSON.stringify(skipped));

  const ok = await pushDigest(rendered, "founder@example.com", { env: { RESEND_API_KEY: "fixture-fake-key" }, from: "Launch Digest <digest@updates.fixture-domain.test>", transport: { send: async () => ({ ok: true, id: "fixture-send-1" }) } });
  if (!(ok.attempted && ok.ok === true && ok.id === "fixture-send-1")) throw new Error("ok-path failed: " + JSON.stringify(ok));

  const failed = await pushDigest(rendered, "founder@example.com", { env: { RESEND_API_KEY: "fixture-fake-key" }, from: "Launch Digest <digest@updates.fixture-domain.test>", transport: { send: async () => ({ ok: false, error: "fixture: simulated network failure" }) } });
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

  harness.check("session: a scoped session whose entry node is blocked entirely by an out-of-scope prerequisite reports why instead of exiting silently", () => {
    const handle = bootstrapWorkspace(harness, "scope-cross-domain", crossDomainDependencyCatalog(), {
      grants: { "domain.growth": grant("domain.growth", "review-first"), "domain.money": grant("domain.money", "review-first") },
      scopeHints: ["domain.growth"],
    });

    const result = runSession(["--workspace", handle.dir, "--brief", handle.briefPath, "--session", "sess-scope-2", "--executor", "fixture"]);
    assert(result.code === 0, `expected exit 0, got ${result.code}: ${result.output}`);

    const text = readDigest(handle, "sess-scope-2");
    assert(!text.includes("Scan what people are saying"), `expected the growth entry node to NOT advance -- its only dependency never ran, got:\n${text}`);
    assert(
      text.includes("Confirm the revenue baseline"),
      `expected an anomaly naming the blocking out-of-scope prerequisite by title, so the session doesn't exit with no explanation, got:\n${text}`,
    );
    assertNoInternalVocabulary("scope-cross-domain", text);
  });

  // --- judgment scenario: approve.ts against a workspace with no run yet fails with a friendly message, never an uncaught exception ----

  harness.check("session/approve: a workspace with no run state yet produces the friendly no_run_state message and exit 1, not an uncaught exception", () => {
    const handle = bootstrapWorkspace(harness, "approve-no-run", singleNodeCatalog());
    // Deliberately never run a session: run/run-state.json does not exist yet.
    const result = runApprove(["--workspace", handle.dir, "--approval", "workflow.eng-change.approval.1", "--decision", "approved", "--session", "sess-approve-1"]);
    assert(result.code === 1, `expected exit 1 when no run state exists yet, got ${result.code}: ${result.output}`);
    assert(result.output.includes("ISSUE approve.no_run_state"), `expected the named no_run_state ISSUE, got:\n${result.output}`);
    assert(!/at\s+\S+\s+\(.*:\d+:\d+\)/.test(result.output), `expected a friendly message, not a raw stack trace, got:\n${result.output}`);

    const listResult = runApprove(["--workspace", handle.dir, "--list"]);
    assert(listResult.code === 1, `expected --list to also fail cleanly with no run state, got ${listResult.code}: ${listResult.output}`);
    assert(listResult.output.includes("ISSUE approve.no_run_state"), `expected the named no_run_state ISSUE on --list too, got:\n${listResult.output}`);
  });

  harness.check("session/approve: an existing pending approval can be listed and granted once a session has run", () => {
    const handle = bootstrapWorkspace(harness, "approve-happy", approvalGatedCatalog(), {
      grants: { "domain.money": grant("domain.money", "full") },
      waivers: [waiver("waiver.money.1", "domain.money", "spend", "spend")],
      balances: [{ unit: "Revenue", period: currentPeriod(), currency: "USD", allocated: 1000, committed: 0, spent: 0, remaining: 1000, updatedAt: "2026-08-01T00:00:00.000Z" }],
      // Autonomy (grant+waiver+budget) is fully satisfied, but founderOnlyActions is non-empty,
      // so the node still lands waiting_founder pending an explicit approval decision.
    });
    const sessionResult = runSession(["--workspace", handle.dir, "--brief", handle.briefPath, "--session", "sess-approve-setup-1", "--executor", "fixture"]);
    assert(sessionResult.code === 0, `expected exit 0 for the setup session, got ${sessionResult.code}: ${sessionResult.output}`);

    const listResult = runApprove(["--workspace", handle.dir, "--list"]);
    assert(listResult.code === 0, `expected exit 0 when a run state exists, got ${listResult.code}: ${listResult.output}`);
    assert(listResult.output.includes("PENDING"), `expected at least one PENDING approval listed, got:\n${listResult.output}`);
    const pendingId = listResult.output.match(/PENDING (\S+)/)?.[1];
    assert(Boolean(pendingId), `could not parse a pending approval id from:\n${listResult.output}`);

    const approveResult = runApprove(["--workspace", handle.dir, "--approval", pendingId!, "--decision", "approved", "--session", "sess-approve-grant-1"]);
    assert(approveResult.code === 0, `expected exit 0 recording the approval, got ${approveResult.code}: ${approveResult.output}`);
    assert(approveResult.output.includes(`RECORDED ${pendingId} approved`), `expected a RECORDED confirmation, got:\n${approveResult.output}`);
  });

  // --- judgment scenario: the platform boundary reports approvals only from the durable run ----

  harness.check("session/approve: the platform boundary reports a parked approval only once a durable run exists, and reflects the recorded decision", () => {
    const handle = bootstrapWorkspace(harness, "approve-boundary", approvalGatedCatalog(), {
      grants: { "domain.money": grant("domain.money", "full") },
      waivers: [waiver("waiver.money.1", "domain.money", "spend", "spend")],
      balances: [{ unit: "Revenue", period: currentPeriod(), currency: "USD", allocated: 1000, committed: 0, spent: 0, remaining: 1000, updatedAt: "2026-08-01T00:00:00.000Z" }],
    });

    // Before any session: the step is predicted as needs-founder, but there is no durable run to
    // record an answer against, so no approval may be advertised as answerable.
    const before = runBoundary(["--workspace", handle.dir]);
    assert(before.code === 0, `expected exit 0 from the boundary before a run, got ${before.code}: ${before.stderr}`);
    const beforeReport = JSON.parse(before.stdout);
    assert(beforeReport.workspaceReady === true && beforeReport.hasDurableRun === false, `expected a ready workspace with no durable run, got: ${before.stdout}`);
    assert(Array.isArray(beforeReport.approvals) && beforeReport.approvals.length === 0, `expected no answerable approvals before a durable run, got: ${JSON.stringify(beforeReport.approvals)}`);
    assert(beforeReport.workflows.some((entry: { status: string }) => entry.status === "needs-founder"), `expected the gated step to report needs-founder, got: ${before.stdout}`);

    const sessionResult = runSession(["--workspace", handle.dir, "--brief", handle.briefPath, "--session", "sess-approve-boundary-1", "--executor", "fixture"]);
    assert(sessionResult.code === 0, `expected exit 0 for the setup session, got ${sessionResult.code}: ${sessionResult.output}`);

    const parked = runBoundary(["--workspace", handle.dir]);
    assert(parked.code === 0, `expected exit 0 from the boundary after a run, got ${parked.code}: ${parked.stderr}`);
    const parkedReport = JSON.parse(parked.stdout);
    assert(parkedReport.hasDurableRun === true, `expected a durable run after the session, got: ${parked.stdout}`);
    assert(parkedReport.approvals.length === 1, `expected exactly one approval, got: ${JSON.stringify(parkedReport.approvals)}`);
    const approval = parkedReport.approvals[0];
    assert(approval.approvalId === "workflow.money-report.approval.1", `unexpected approval id: ${JSON.stringify(approval)}`);
    assert(approval.status === "pending", `expected a pending approval, got: ${JSON.stringify(approval)}`);
    assert(approval.workflowId === "workflow.money-report" && approval.workflowTitle === "Pull this week's revenue report", `approval must carry its workflow identity: ${JSON.stringify(approval)}`);
    assert(approval.description === "Approve pulling this week's revenue report", `approval must carry the catalog's founder-facing description: ${JSON.stringify(approval)}`);
    assert(approval.protectedCategory === "spend", `expected the node's effective protected category, got: ${JSON.stringify(approval)}`);

    const approveResult = runApprove(["--workspace", handle.dir, "--approval", approval.approvalId, "--decision", "approved", "--session", "sess-approve-boundary-2"]);
    assert(approveResult.code === 0, `expected exit 0 recording the approval, got ${approveResult.code}: ${approveResult.output}`);

    const after = runBoundary(["--workspace", handle.dir]);
    assert(after.code === 0, `expected exit 0 from the boundary after approving, got ${after.code}: ${after.stderr}`);
    const afterReport = JSON.parse(after.stdout);
    assert(afterReport.approvals.length === 1 && afterReport.approvals[0].status === "approved", `expected the recorded decision to be reflected, got: ${JSON.stringify(afterReport.approvals)}`);
    const step = afterReport.workflows.find((entry: { workflowId: string }) => entry.workflowId === "workflow.money-report");
    assert(step.status === "ready", `expected the approved step to leave needs-founder and become ready, got: ${JSON.stringify(step)}`);
  });

  // --- judgment scenario: verified results cross the boundary, and only verified results --------

  harness.check("session/boundary: a verified result crosses the boundary with evidence, artifact candidates, and declared cost — and only from a durable run", () => {
    const handle = bootstrapWorkspace(harness, "results-boundary", singleNodeCatalog(), {
      grants: { "domain.engineering": grant("domain.engineering", "run-with-guardrails") },
    });

    // Before any session: reachable and ready, but no durable run — results and artifact state
    // must be empty, never invented from the throwaway seeded run.
    const before = runBoundary(["--workspace", handle.dir]);
    assert(before.code === 0, `expected exit 0 from the boundary before a run, got ${before.code}: ${before.stderr}`);
    const beforeReport = JSON.parse(before.stdout);
    assert(beforeReport.hasDurableRun === false, `expected no durable run before a session, got: ${before.stdout}`);
    assert(Array.isArray(beforeReport.results) && beforeReport.results.length === 0, `expected no results before a durable run, got: ${JSON.stringify(beforeReport.results)}`);
    assert(Array.isArray(beforeReport.artifacts) && beforeReport.artifacts.length === 0, `expected no artifact state before a durable run, got: ${JSON.stringify(beforeReport.artifacts)}`);

    const sessionResult = runSession(["--workspace", handle.dir, "--brief", handle.briefPath, "--session", "sess-results-boundary-1", "--executor", "fixture"]);
    assert(sessionResult.code === 0, `expected exit 0 for the session, got ${sessionResult.code}: ${sessionResult.output}`);

    const after = runBoundary(["--workspace", handle.dir]);
    assert(after.code === 0, `expected exit 0 from the boundary after the session, got ${after.code}: ${after.stderr}`);
    const report = JSON.parse(after.stdout);
    assert(report.results.length === 1, `expected exactly one verified result, got: ${JSON.stringify(report.results)}`);
    const result = report.results[0];
    assert(result.workflowId === "workflow.eng-change" && result.workflowTitle === "Update the onboarding copy", `result must carry its stable workflow identity: ${JSON.stringify(result)}`);
    assert(result.attemptId.length > 0 && result.attemptNumber === 1, `result must carry its attempt identity: ${JSON.stringify(result)}`);
    assert(result.verification === "none", `an ungated engineering node verifies as kind none, got: ${JSON.stringify(result)}`);
    assert(Array.isArray(result.evidence) && result.evidence.length > 0, `result must carry the attempt's evidence: ${JSON.stringify(result)}`);
    assert(result.artifacts.length === 1 && result.artifacts[0].artifactId === "artifact.eng-change" && result.artifacts[0].fingerprint.length > 0, `result must reference its accepted output: ${JSON.stringify(result)}`);
    assert(typeof result.declaredTokenBudget === "number" && result.declaredTokenBudget > 0, `result must carry the node's declared token budget: ${JSON.stringify(result)}`);
    const artifactState = report.artifacts.find((entry: { artifactId: string }) => entry.artifactId === "artifact.eng-change");
    assert(artifactState.accepted === true && artifactState.workflowId === "workflow.eng-change", `artifact state must report acceptance and its producer: ${JSON.stringify(artifactState)}`);
  });

  harness.check("session/boundary: a node still pending verification exports no result — finished is not verified", () => {
    // domain.research is a judgment domain: no gates, so verification is fresh_context and the
    // fixture executor's completion lands blocked pending acceptance, never settled.
    const researchCatalog: CatalogInput = {
      version: "catalog.session-fixture.unverified-research",
      artifacts: [{ id: "artifact.research-scan", path: "research/scan.md" }],
      workflows: [
        { id: "workflow.research-scan", title: "Research what people need", domainId: "domain.research", actionClass: "draft", dependencies: [], outputPaths: ["research/scan.md"], providerIds: [], laneIds: [], founderOnlyActions: [], gateCommands: [], idempotent: true },
      ],
    };
    const handle = bootstrapWorkspace(harness, "unverified-results", researchCatalog, {
      grants: { "domain.research": grant("domain.research", "run-with-guardrails") },
    });
    const sessionResult = runSession(["--workspace", handle.dir, "--brief", handle.briefPath, "--session", "sess-unverified-1", "--executor", "fixture"]);
    assert(sessionResult.code === 0, `expected exit 0 for the session, got ${sessionResult.code}: ${sessionResult.output}`);

    const boundary = runBoundary(["--workspace", handle.dir]);
    assert(boundary.code === 0, `expected exit 0 from the boundary, got ${boundary.code}: ${boundary.stderr}`);
    const report = JSON.parse(boundary.stdout);
    assert(report.hasDurableRun === true, `expected a durable run, got: ${boundary.stdout}`);
    assert(report.results.length === 0, `an unverified node must contribute nothing — not provisionally: ${JSON.stringify(report.results)}`);
    const artifactState = report.artifacts.find((entry: { artifactId: string }) => entry.artifactId === "artifact.research-scan");
    assert(artifactState.accepted === false, `the unverified output must report accepted: false, got: ${JSON.stringify(artifactState)}`);
    const step = report.workflows.find((entry: { workflowId: string }) => entry.workflowId === "workflow.research-scan");
    assert(step.status !== "finished", `a node pending verification must never report finished, got: ${JSON.stringify(step)}`);
  });

  harness.check("session/boundary: a lane-seeded succeeded node exports no result — a seed fingerprint is not importable work", () => {
    const seededCatalog: CatalogInput = {
      version: "catalog.session-fixture.seeded-results",
      artifacts: [{ id: "artifact.eng-change", path: "engineering/change.log" }],
      workflows: [
        { id: "workflow.eng-change", title: "Update the onboarding copy", domainId: "domain.engineering", actionClass: "mutate", dependencies: [], outputPaths: ["engineering/change.log"], providerIds: [], laneIds: ["engineering"], founderOnlyActions: [], gateCommands: [], idempotent: true },
      ],
    };
    const plan = compilePlan(seededCatalog, "2026-08-05T00:00:00.000Z");
    const lanes = minimalLanes() as Record<string, { status: string; evidence: string[]; blockers: string[] }>;
    lanes.engineering = { status: "succeeded", evidence: [], blockers: [] };
    const businessState = {
      schemaVersion: "2.0.0",
      updatedAt: "2026-08-05T00:00:00.000Z",
      narrative: { sinceLastTime: "", rightNow: "", yourCall: "", lastCelebratedPhase: "" },
      project: { name: "Fixture App", slug: "seeded-results", owner: "Founder", phase: "phase_0_orient", launchScope: "essentials", kickoffDate: "", platforms: ["ios"], bundleIds: { ios: "com.example.app", android: "" }, publicUrls: { landing: "", privacy: "", terms: "" } },
      lanes,
      founderGates: { pending: [] },
    } as unknown as BusinessStateV2;
    const run = seedRunState(plan, businessState, { ownerSessionId: "seeded-results-check", ttlSeconds: 300, wallClockCapSeconds: 0, now: "2026-08-05T00:00:00.000Z" });
    assert(run.nodes["run.eng-change"]!.status === "succeeded", "the lane-done node must seed succeeded");

    const results = buildBoundaryResults(plan, run);
    assert(results.length === 0, `a seeded-succeeded node has no attempt, no evidence, and no real output — it must export nothing: ${JSON.stringify(results)}`);
    const artifacts = buildBoundaryArtifacts(plan, run);
    assert(artifacts.length === 1 && artifacts[0]!.accepted === true, `the seeded binding itself is still reported as accepted state: ${JSON.stringify(artifacts)}`);
  });
}
