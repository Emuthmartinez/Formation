import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { assert, assertSchemaValid, skillRoot, type Harness } from "./_harness.js";
import { laneKeys } from "../../core/schema/types.js";
import { founderSurfaceVocabularyBlocklist } from "../../tooling/render-autonomy-console.js";

/**
 * U7 fixtures: the scripted onboarding driver (core/session/onboard.ts) and the autonomy console
 * renderer (tooling/render-autonomy-console.ts), exercised as real subprocesses against a
 * bootstrapped temp workspace — mirroring reducer.fixtures.ts and session.fixtures.ts's own
 * convention rather than importing internals and asserting in-process.
 */

function resolveTsxBin(): string {
  const candidates = [path.join(skillRoot, "node_modules/.bin/tsx"), path.resolve(skillRoot, "../..", "node_modules/.bin/tsx")];
  return candidates.find((candidate) => existsSync(candidate)) ?? "tsx";
}

const tsxBin = resolveTsxBin();
const reducerCliPath = path.join(skillRoot, "core/reducer/cli.ts");
const onboardCliPath = path.join(skillRoot, "core/session/onboard.ts");
const consoleCliPath = path.join(skillRoot, "tooling/render-autonomy-console.ts");
const onboardingContentPath = path.join(skillRoot, "content/onboarding/autonomy-onboarding.md");

const CONTROL_SCHEMA = "urn:b2c-mobile-business-launch:core:control-schema";

interface CliResult {
  readonly code: number;
  readonly output: string;
}

function runOnboard(args: string[]): CliResult {
  const result = spawnSync(tsxBin, [onboardCliPath, ...args], { cwd: skillRoot, encoding: "utf8" });
  return { code: result.status ?? -1, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

function runConsole(args: string[]): CliResult {
  const result = spawnSync(tsxBin, [consoleCliPath, ...args], { cwd: skillRoot, encoding: "utf8" });
  return { code: result.status ?? -1, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

function runReducer(args: string[], input?: string): CliResult {
  const result = spawnSync(tsxBin, [reducerCliPath, ...args], { cwd: skillRoot, encoding: "utf8", input });
  return { code: result.status ?? -1, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

let patchCounter = 0;
function nextPatchId(): string {
  patchCounter += 1;
  return `console-fixture-patch-${patchCounter}`;
}

function buildPatch(targetDoc: string, ops: Array<Record<string, unknown>>, declaredOutputs: string[][]): Record<string, unknown> {
  return {
    schemaVersion: "1.0.0",
    patchId: nextPatchId(),
    targetDoc,
    reason: "console fixture setup",
    authoredBy: "console-fixture-setup",
    authoredAt: "2026-08-05T00:00:00.000Z",
    preconditions: [],
    ops,
    declaredOutputs,
  };
}

function minimalLanes(): Record<string, unknown> {
  const lanes: Record<string, unknown> = {};
  for (const key of laneKeys) lanes[key] = { status: "pending", evidence: [], blockers: [] };
  return lanes;
}

interface WorkspaceHandle {
  readonly dir: string;
  readonly controlPath: string;
  readonly manifestPath: string;
  readonly auditPath: string;
  readonly consoleOutPath: string;
}

function commit(handle: WorkspaceHandle, targetFile: string, patch: Record<string, unknown>): CliResult {
  const patchPath = path.join(handle.dir, `${patch.patchId as string}.json`);
  writeJson(patchPath, patch);
  const result = runReducer([
    "commit",
    "--patch",
    patchPath,
    "--file",
    targetFile,
    "--manifest",
    handle.manifestPath,
    "--audit",
    handle.auditPath,
    "--session",
    "console-fixture-setup",
  ]);
  assert(result.code === 0, `workspace bootstrap commit failed: ${result.output}`);
  return result;
}

function makeWorkspace(harness: Harness, name: string): WorkspaceHandle {
  const dir = harness.makeTempDir(`console-${name}`);
  return {
    dir,
    controlPath: path.join(dir, "control", "control.json"),
    manifestPath: path.join(dir, "control", "manifest.json"),
    auditPath: path.join(dir, "control", "audit.jsonl"),
    consoleOutPath: path.join(dir, "state", "autonomy-console.html"),
  };
}

function bulkDefaultUnits(): Record<string, unknown> {
  return {
    Product: { level: "run-with-guardrails" },
    Design: { level: "run-with-guardrails" },
    Engineering: { level: "run-with-guardrails" },
    Growth: { level: "run-with-guardrails" },
    Analytics: { level: "run-with-guardrails" },
    Operations: { level: "run-with-guardrails" },
    Revenue: { level: "review-first" },
    Store: { level: "review-first" },
    Trust: { level: "review-first" },
  };
}

function baseAnswers(businessSlug: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { schemaVersion: "1.0.0", businessSlug, founderContact: { email: "founder@example.com" }, units: bulkDefaultUnits(), ...extra };
}

function fullWaiverInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    domainId: "domain.money",
    actionClass: "spend",
    protectedCategory: "spend",
    scope: { resourcePattern: "*", description: "Pay for routine ad spend on the approved growth channels only." },
    caps: { maxPerAction: 50, maxPerPeriod: 500, currency: "USD" },
    budgetPeriod: "monthly",
    expiry: "2027-01-01T00:00:00.000Z",
    undoContract: {
      kind: "mitigation",
      irreversibilityAcknowledgment: "Ad spend already delivered cannot be clawed back once it has run.",
      mitigationSteps: ["Pause the campaign immediately.", "Review spend in the next session."],
    },
    ...overrides,
  };
}

export function register(harness: Harness): void {
  // --- scenario 1: bulk-defaults onboarding produces a valid, conservative control file --------

  harness.check("onboard: a bulk-defaults transcript produces a valid control file (checked against the real U1 control schema)", () => {
    const handle = makeWorkspace(harness, "bulk-defaults");
    const answersPath = path.join(handle.dir, "answers.json");
    writeJson(answersPath, baseAnswers("fixture-bulk"));

    const result = runOnboard(["--workspace", handle.dir, "--answers", answersPath, "--now", "2026-08-05T00:00:00.000Z"]);
    assert(result.code === 0, `expected exit 0, got ${result.code}: ${result.output}`);
    assert(existsSync(handle.controlPath), "expected onboard.ts to write control.json");

    const parsed = JSON.parse(readFileSync(handle.controlPath, "utf8"));
    assertSchemaValid(harness.checkSchema(CONTROL_SCHEMA, parsed), "onboarded control document");

    assert(parsed.grants["domain.money"].level === "review-first", "expected the Revenue unit's conservative default (review-first) on domain.money");
    assert(parsed.grants["domain.store"].level === "review-first", "expected the Store unit's conservative default (review-first) on domain.store");
    assert(parsed.grants["domain.trust"].level === "review-first", "expected the Trust unit's conservative default (review-first) on domain.trust");
    assert(parsed.grants["domain.growth"].level === "run-with-guardrails", "expected the Growth unit's default (run-with-guardrails) on domain.growth");
    assert(
      parsed.grants["domain.research"].level === "run-with-guardrails",
      "expected the Product unit's default to expand to every member domain, including domain.research",
    );
    assert(Array.isArray(parsed.waivers) && parsed.waivers.length === 0, "bulk defaults must not pre-approve any protected action");
    assert(parsed.killSwitch.engaged === false, "onboarding must not engage the kill switch");
  });

  // --- scenario 2: a waiver missing a required envelope field refuses activation entirely -------

  harness.check("onboard: a waiver missing a required envelope field (structural) refuses the entire run, not just that waiver", () => {
    const handle = makeWorkspace(harness, "waiver-missing-field");
    const incompleteWaiver = fullWaiverInput();
    delete (incompleteWaiver as Record<string, unknown>).expiry;
    const answersPath = path.join(handle.dir, "answers.json");
    writeJson(answersPath, baseAnswers("fixture-waiver-missing", { waivers: [incompleteWaiver] }));

    const result = runOnboard(["--workspace", handle.dir, "--answers", answersPath, "--now", "2026-08-05T00:00:00.000Z"]);
    assert(result.code !== 0, `expected a non-zero exit for an incomplete waiver envelope, got ${result.code}`);
    assert(result.output.includes("ISSUE onboard."), `expected a named ISSUE error, got:\n${result.output}`);
    assert(result.output.toLowerCase().includes("expiry"), `expected the error to name the missing field (expiry), got:\n${result.output}`);
    assert(!existsSync(handle.controlPath), "an incomplete waiver must refuse activation before anything is written — control.json must not exist");
  });

  harness.check("onboard: a waiver failing the real U1 waiver schema (too-short description) refuses activation and writes nothing", () => {
    const handle = makeWorkspace(harness, "waiver-schema-invalid");
    const badWaiver = fullWaiverInput({ scope: { resourcePattern: "*", description: "too short" } }); // < 20 chars, fails waivers.schema.json
    const answersPath = path.join(handle.dir, "answers.json");
    writeJson(answersPath, baseAnswers("fixture-waiver-schema", { waivers: [badWaiver] }));

    const result = runOnboard(["--workspace", handle.dir, "--answers", answersPath, "--now", "2026-08-05T00:00:00.000Z"]);
    assert(result.code !== 0, `expected a non-zero exit, got ${result.code}: ${result.output}`);
    assert(result.output.includes("ISSUE onboard.waiver_incomplete"), `expected a named waiver_incomplete error, got:\n${result.output}`);
    assert(!existsSync(handle.controlPath), "a schema-invalid waiver must refuse activation before anything is written");
  });

  // --- judgment scenario: --dry-run never writes -------------------------------------------------

  harness.check("onboard: --dry-run reports what would change without writing control.json", () => {
    const handle = makeWorkspace(harness, "dry-run");
    const answersPath = path.join(handle.dir, "answers.json");
    writeJson(answersPath, baseAnswers("fixture-dry-run"));

    const result = runOnboard(["--workspace", handle.dir, "--answers", answersPath, "--dry-run", "--now", "2026-08-05T00:00:00.000Z"]);
    assert(result.code === 0, `expected exit 0 for a dry run, got ${result.code}: ${result.output}`);
    assert(result.output.includes("DRY RUN"), `expected dry-run output to say so, got:\n${result.output}`);
    assert(!existsSync(handle.controlPath), "a dry run must never write control.json");
  });

  // --- judgment scenario: re-running with an unchanged answer is a no-op -------------------------

  harness.check("onboard: re-running with answers that match the current settings is a no-op (no spurious commit)", () => {
    const handle = makeWorkspace(harness, "idempotent");
    const answersPath = path.join(handle.dir, "answers.json");
    writeJson(answersPath, baseAnswers("fixture-idempotent"));

    const first = runOnboard(["--workspace", handle.dir, "--answers", answersPath, "--now", "2026-08-05T00:00:00.000Z"]);
    assert(first.code === 0, `expected exit 0 on first run, got ${first.code}: ${first.output}`);
    const beforeSecond = readFileSync(handle.controlPath, "utf8");

    const second = runOnboard(["--workspace", handle.dir, "--answers", answersPath, "--now", "2026-08-05T01:00:00.000Z"]);
    assert(second.code === 0, `expected exit 0 on the repeat run, got ${second.code}: ${second.output}`);
    assert(second.output.includes("Nothing to update"), `expected the repeat run to report a no-op, got:\n${second.output}`);
    const afterSecond = readFileSync(handle.controlPath, "utf8");
    assert(beforeSecond === afterSecond, "an unchanged repeat onboarding run must not rewrite control.json");
  });

  // --- founder-vocabulary: the onboarding content itself carries no internal vocabulary ----------

  harness.check("founder copy: the onboarding content file uses no internal vocabulary", () => {
    const text = readFileSync(onboardingContentPath, "utf8");
    const leaked = founderSurfaceVocabularyBlocklist.filter((term) => text.includes(term));
    assert(leaked.length === 0, `content/onboarding/autonomy-onboarding.md leaked internal vocabulary: ${JSON.stringify(leaked)}`);
  });

  // --- founder-vocabulary: the rendered console HTML carries no internal vocabulary --------------

  harness.check("founder copy: the rendered autonomy console carries no internal vocabulary, across a fully populated workspace", () => {
    const handle = makeWorkspace(harness, "vocab-console");
    const answersPath = path.join(handle.dir, "answers.json");
    writeJson(answersPath, baseAnswers("fixture-vocab", { waivers: [fullWaiverInput()] }));
    const onboardResult = runOnboard(["--workspace", handle.dir, "--answers", answersPath, "--now", "2026-08-05T00:00:00.000Z"]);
    assert(onboardResult.code === 0, `onboarding setup for the vocabulary fixture failed: ${onboardResult.output}`);

    // A budget balance and a pending founder gate exercise the money and parked-items sections too.
    const budgetLedgerPath = path.join(handle.dir, "control", "budget-ledger.json");
    commit(
      handle,
      budgetLedgerPath,
      buildPatch(
        "budget-ledger",
        [
          {
            op: "set",
            path: ["balances"],
            value: [
              {
                unit: "Revenue",
                period: "2026-08",
                currency: "USD",
                allocated: 1000,
                committed: 0,
                spent: 250,
                remaining: 750,
                updatedAt: "2026-08-05T00:00:00.000Z",
              },
            ],
          },
          { op: "set", path: ["entries"], value: [] },
        ],
        [["balances"], ["entries"]],
      ),
    );

    const businessStatePath = path.join(handle.dir, "state", "business-state.json");
    commit(
      handle,
      businessStatePath,
      buildPatch(
        "business-state",
        [
          { op: "set", path: ["narrative"], value: { sinceLastTime: "", rightNow: "", yourCall: "", lastCelebratedPhase: "" } },
          {
            op: "set",
            path: ["project"],
            value: {
              name: "Fixture App",
              slug: "fixture-vocab",
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
          {
            op: "set",
            path: ["founderGates"],
            value: {
              pending: [
                { id: "gate.pricing-change", category: "legal_pricing", reason: "Approve the new subscription price.", createdAt: "2026-08-01T00:00:00.000Z" },
              ],
            },
          },
        ],
        [["narrative"], ["project"], ["lanes"], ["founderGates"]],
      ),
    );

    const consoleResult = runConsole(["--workspace", handle.dir, "--now", "2026-08-05T02:00:00.000Z"]);
    assert(consoleResult.code === 0, `expected the console render to succeed, got ${consoleResult.code}: ${consoleResult.output}`);
    assert(existsSync(handle.consoleOutPath), "expected the console to write state/autonomy-console.html");

    const html = readFileSync(handle.consoleOutPath, "utf8");
    assert(html.includes("Approve the new subscription price."), `expected the pending founder gate to appear in the console, got:\n${html}`);
    assert(html.includes("Ask me first") && html.includes("Handle the routine stuff"), `expected translated grant-level labels in the console, got:\n${html}`);
    const leaked = founderSurfaceVocabularyBlocklist.filter((term) => html.includes(term));
    assert(leaked.length === 0, `rendered autonomy console leaked internal vocabulary: ${JSON.stringify(leaked)}`);
  });

  // --- judgment scenario: the blocklist scan is real, not vacuous --------------------------------

  harness.check("console: the founder-surface vocabulary blocklist actually catches a leak (the check is not vacuous)", () => {
    assert(founderSurfaceVocabularyBlocklist.length > 0, "the blocklist must not be empty");
    const leaking = "Grant for domain.money at level review-first; protectedCategory spend; mutate the ledger.";
    const leaked = founderSurfaceVocabularyBlocklist.filter((term) => leaking.includes(term));
    assert(leaked.length > 0, "the blocklist scan failed to catch an obviously internal-vocabulary string — the check would pass vacuously");
  });

  // --- scenario: console renders gracefully for a completely unconfigured workspace -------------

  harness.check("console: renders a graceful empty state for a workspace that has not been onboarded yet", () => {
    const handle = makeWorkspace(harness, "empty");
    const result = runConsole(["--workspace", handle.dir, "--now", "2026-08-05T00:00:00.000Z"]);
    assert(result.code === 0, `expected exit 0 for an unconfigured workspace, got ${result.code}: ${result.output}`);
    const html = readFileSync(handle.consoleOutPath, "utf8");
    assert(html.includes("Not set up yet"), `expected a graceful "not set up yet" state, got:\n${html}`);
    assert(html.includes("Nothing is waiting on you right now."), `expected the empty parked-items state, got:\n${html}`);
  });

  // --- scenario: console --check drift fails on a mutated output ---------------------------------

  harness.check("console: --check passes right after a render and fails once the output is mutated out of band", () => {
    const handle = makeWorkspace(harness, "drift");
    const first = runConsole(["--workspace", handle.dir, "--now", "2026-08-05T00:00:00.000Z"]);
    assert(first.code === 0, `expected the initial render to succeed, got ${first.code}: ${first.output}`);

    const checkOk = runConsole(["--workspace", handle.dir, "--check", "--now", "2026-08-05T00:00:00.000Z"]);
    assert(checkOk.code === 0, `expected --check to pass immediately after a render, got ${checkOk.code}: ${checkOk.output}`);

    const mutated = `${readFileSync(handle.consoleOutPath, "utf8")}<!-- tampered -->`;
    writeFileSync(handle.consoleOutPath, mutated, "utf8");

    const checkDrift = runConsole(["--workspace", handle.dir, "--check", "--now", "2026-08-05T00:00:00.000Z"]);
    assert(checkDrift.code !== 0, `expected --check to fail after the output was mutated, got ${checkDrift.code}`);
    assert(checkDrift.output.includes("autonomy_console.generated_drift"), `expected a named drift error, got:\n${checkDrift.output}`);

    const checkMissing = runConsole(["--workspace", handle.dir, "--check", "--out", path.join(handle.dir, "state", "does-not-exist.html")]);
    assert(checkMissing.code !== 0, `expected --check to fail when the output is missing entirely, got ${checkMissing.code}`);
    assert(checkMissing.output.includes("autonomy_console.generated_missing"), `expected a named missing-output error, got:\n${checkMissing.output}`);
  });
}
