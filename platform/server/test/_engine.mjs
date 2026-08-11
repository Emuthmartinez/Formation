import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFormationServer } from "../app.mjs";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";

/**
 * Shared engine-workspace and server harness for the execution-adapter test suites
 * (execution.test.mjs, approvals.test.mjs). Tests build a real engine workspace the same way
 * the engine's own fixture suite does: every reducer-owned document is created through the
 * reducer CLI with founder authority, never written directly.
 */

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(moduleDir, "../../..");
export const skillDir = path.join(repoRoot, "skill/b2c-mobile-business-launch");
export const tsxBin = [path.join(skillDir, "node_modules/.bin/tsx"), path.join(repoRoot, "node_modules/.bin/tsx")].find((candidate) => existsSync(candidate));

const LANE_KEYS = [
  "paid_tool_routing",
  "secrets",
  "security",
  "research",
  "traceability",
  "experience",
  "product",
  "design",
  "emotional_design",
  "content_assets",
  "analytics_attribution",
  "paid_user_acquisition",
  "onboarding",
  "revenue",
  "store_console",
  "apple_signing",
  "privacy_legal",
  "email",
  "orchestration",
  "engineering",
  "growth",
  "post_launch_ops",
];

let patchCounter = 0;

function runReducer(args) {
  const result = spawnSync(tsxBin, [path.join(skillDir, "core/reducer/cli.ts"), ...args], { cwd: skillDir, encoding: "utf8" });
  return { code: result.status ?? -1, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

export function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function commit(workspaceDir, targetFile, targetDoc, ops, declaredOutputs) {
  patchCounter += 1;
  const patch = {
    schemaVersion: "1.0.0",
    patchId: `platform-test-patch-${patchCounter}`,
    targetDoc,
    reason: "execution adapter test setup",
    authoredBy: "execution-test-setup",
    authoredAt: "2026-08-05T00:00:00.000Z",
    preconditions: [],
    ops,
    declaredOutputs,
  };
  const patchPath = path.join(workspaceDir, `${patch.patchId}.json`);
  writeJson(patchPath, patch);
  const result = runReducer([
    "commit",
    "--patch",
    patchPath,
    "--file",
    targetFile,
    "--manifest",
    path.join(workspaceDir, "control", "manifest.json"),
    "--audit",
    path.join(workspaceDir, "control", "audit.jsonl"),
    "--session",
    "execution-test-setup",
    "--founder-authority",
    "true",
  ]);
  assert.equal(result.code, 0, `engine workspace bootstrap commit failed: ${result.output}`);
}

export function engineGrant(domainId, level, now = "2026-08-01T00:00:00.000Z") {
  return { domainId, level, prerequisites: [], grantedAt: now, grantedBy: "founder", updatedAt: now };
}

export function engineWaiver(id, domainId, actionClass, protectedCategory, now = "2026-08-01T00:00:00.000Z") {
  return {
    id,
    domainId,
    actionClass,
    protectedCategory,
    scope: { resourcePattern: "*", description: "Test-authored waiver for the platform execution suites." },
    caps: { maxPerAction: 1000, maxPerPeriod: 10000, currency: "USD" },
    budgetPeriod: "monthly",
    expiry: "2099-01-01T00:00:00.000Z",
    undoContract: { kind: "mitigation", irreversibilityAcknowledgment: "This test waiver models an irreversible action.", mitigationSteps: ["Review the audit log"] },
    auditRef: "audit.fixture",
    status: "active",
    createdAt: now,
    createdBy: "founder",
  };
}

export function currentBudgetPeriod() {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Bootstraps one engine workspace under `engineRoot`. Defaults reproduce the slice-1 execution
 * suite's workspace (a two-step engineering catalog under run-with-guardrails); pass `catalog`,
 * `grants`, `waivers`, or `balances` to model other launches.
 */
export function bootstrapEngineWorkspace(engineRoot, slug, options = {}) {
  const workspaceDir = path.join(engineRoot, slug);
  mkdirSync(workspaceDir, { recursive: true });
  const lanes = {};
  for (const key of LANE_KEYS) lanes[key] = { status: "pending", evidence: [], blockers: [] };

  commit(
    workspaceDir,
    path.join(workspaceDir, "state", "business-state.json"),
    "business-state",
    [
      { op: "set", path: ["narrative"], value: { sinceLastTime: "", rightNow: "", yourCall: "", lastCelebratedPhase: "" } },
      {
        op: "set",
        path: ["project"],
        value: {
          name: "Execution Test App",
          slug,
          owner: "Founder",
          phase: "phase_0_orient",
          launchScope: "essentials",
          kickoffDate: "",
          platforms: ["ios"],
          bundleIds: { ios: "com.example.app", android: "" },
          publicUrls: { landing: "", privacy: "", terms: "" },
        },
      },
      { op: "set", path: ["lanes"], value: lanes },
      { op: "set", path: ["founderGates"], value: { pending: [] } },
    ],
    [["narrative"], ["project"], ["lanes"], ["founderGates"]],
  );

  commit(
    workspaceDir,
    path.join(workspaceDir, "control", "control.json"),
    "control",
    [
      { op: "set", path: ["businessSlug"], value: slug },
      { op: "set", path: ["killSwitch"], value: { engaged: false, engagedAt: "", engagedBy: "", reason: "" } },
      { op: "set", path: ["grants"], value: options.grants ?? { "domain.engineering": engineGrant("domain.engineering", "run-with-guardrails") } },
      { op: "set", path: ["waivers"], value: options.waivers ?? [] },
    ],
    [["businessSlug"], ["killSwitch"], ["grants"], ["waivers"]],
  );

  commit(
    workspaceDir,
    path.join(workspaceDir, "control", "budget-ledger.json"),
    "budget-ledger",
    [
      { op: "set", path: ["balances"], value: options.balances ?? [] },
      { op: "set", path: ["entries"], value: [] },
    ],
    [["balances"], ["entries"]],
  );

  writeJson(path.join(workspaceDir, "catalog.json"), options.catalog ?? twoStepEngineeringCatalog());
  return workspaceDir;
}

export function twoStepEngineeringCatalog() {
  return {
    version: "catalog.execution-test.v1",
    artifacts: [
      { id: "artifact.eng-change", path: "engineering/change.log" },
      { id: "artifact.eng-followup", path: "engineering/followup.log" },
    ],
    workflows: [
      {
        id: "workflow.eng-change",
        title: "Update the onboarding copy",
        domainId: "domain.engineering",
        actionClass: "mutate",
        dependencies: [],
        outputPaths: ["engineering/change.log"],
        providerIds: [],
        laneIds: [],
        founderOnlyActions: [],
        // Real, workspace-independent engine gate: gateless outputs no longer auto-accept
        // (2026-08 verification flip), and these suites need steps that can genuinely finish.
        // The no-op-executor suite is unaffected — its attempts fail before verification.
        gateCommands: ["check:gates-layout"],
        idempotent: true,
      },
      {
        id: "workflow.eng-followup",
        title: "Tidy the follow-up checklist",
        domainId: "domain.engineering",
        actionClass: "mutate",
        dependencies: ["workflow.eng-change"],
        outputPaths: ["engineering/followup.log"],
        providerIds: [],
        laneIds: [],
        founderOnlyActions: [],
        // Real, workspace-independent engine gate: gateless outputs no longer auto-accept
        // (2026-08 verification flip), and these suites need steps that can genuinely finish.
        // The no-op-executor suite is unaffected — its attempts fail before verification.
        gateCommands: ["check:gates-layout"],
        idempotent: true,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Platform server harness.
// ---------------------------------------------------------------------------

export async function startTestServer(execution, { storePrefix = "formation-execution-", imports } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), storePrefix));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();
  const { server, executionWorker } = createFormationServer({ store, allowDemoAuth: true, execution, imports });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    store,
    executionWorker,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

export async function login(baseUrl, email = "founder@formation.local") {
  const response = await fetch(`${baseUrl}/api/auth/demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

export function request(baseUrl, pathname, { cookie, method = "GET", body } = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export async function waitForExecution(store, executionId, predicate, attempts = 400) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const database = await store.read();
    const execution = database.executions.find((entry) => entry.id === executionId);
    if (execution && predicate(execution)) return execution;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const database = await store.read();
  return database.executions.find((entry) => entry.id === executionId);
}
