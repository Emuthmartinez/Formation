import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { assert, assertSchemaInvalid, assertSchemaValid, skillRoot, type Harness } from "./_harness.js";
import { grantableDomainIds, laneKeys, mapV1LaneStatus, mapV1RunNodeStatus, statusValues, v1LaneStatusValues, v1RunNodeStatusValues } from "../../core/schema/types.js";
import { migrateProjectStateV1 } from "../../core/schema/migrate-v1.js";

const schemaDir = path.join(skillRoot, "core/schema");

const BUSINESS_STATE_SCHEMA = "urn:b2c-mobile-business-launch:core:business-state-schema";
const GRANTS_SCHEMA = "urn:b2c-mobile-business-launch:core:grants-schema";
const WAIVERS_SCHEMA = "urn:b2c-mobile-business-launch:core:waivers-schema";
const BUDGET_LEDGER_SCHEMA = "urn:b2c-mobile-business-launch:core:budget-ledger-schema";
const CONTROL_SCHEMA = "urn:b2c-mobile-business-launch:core:control-schema";
const RUN_STATE_SCHEMA = "urn:b2c-mobile-business-launch:core:run-state-schema";
const CHECKPOINT_SCHEMA = "urn:b2c-mobile-business-launch:core:checkpoint-schema";

const now = "2026-08-04T12:00:00.000Z";

function validGrant() {
  return {
    domainId: "domain.growth",
    level: "run-with-guardrails",
    prerequisites: [
      { id: "doppler-proof", kind: "doppler_auth", ttlSeconds: 3600, status: "verified", verifiedAt: now, evidencePath: "trust/secrets/SECRETS.md" },
    ],
    grantedAt: now,
    grantedBy: "founder",
    grantedViaUnit: "Growth",
    updatedAt: now,
  };
}

function validGrantsDoc() {
  return { schemaVersion: "1.0.0", updatedAt: now, grants: { "domain.growth": validGrant() } };
}

function validWaiver() {
  return {
    id: "waiver-destructive-prune-stale-branches",
    domainId: "domain.engineering",
    actionClass: "destructive",
    protectedCategory: "destructive",
    scope: { resourcePattern: "resource.git.integration", description: "Delete stale feature branches merged more than 30 days ago." },
    caps: { maxPerAction: 1, maxPerPeriod: 5 },
    budgetPeriod: "weekly",
    expiry: "2026-12-31T00:00:00.000Z",
    undoContract: {
      kind: "mitigation",
      irreversibilityAcknowledgment: "Deleted branches cannot be restored from the remote once pruned.",
      mitigationSteps: ["Tag the branch head before deletion.", "Keep a 30-day local mirror of pruned refs."],
    },
    auditRef: "audit.entry.0001",
    status: "active",
    createdAt: now,
    createdBy: "founder",
  };
}

function validWaiversDoc() {
  return { schemaVersion: "1.0.0", updatedAt: now, waivers: [validWaiver()] };
}

function validLedgerDoc() {
  return {
    schemaVersion: "1.0.0",
    updatedAt: now,
    balances: [{ unit: "Growth", period: "2026-08", currency: "USD", allocated: 500, committed: 120, spent: 80, remaining: 300, updatedAt: now }],
    entries: [
      {
        id: "ledger-entry-0001",
        unit: "Growth",
        domainId: "domain.growth",
        nodeRef: "run.paid-ua-campaign-launch",
        period: "2026-08",
        estimate: { amount: 50, currency: "USD", declaredAt: now },
        actual: null,
        status: "estimated",
        auditRef: "audit.entry.0002",
      },
    ],
  };
}

function validControlDoc() {
  return {
    schemaVersion: "1.0.0",
    updatedAt: now,
    businessSlug: "ocho",
    killSwitch: { engaged: false, engagedAt: "", engagedBy: "", reason: "" },
    grants: {},
    waivers: [],
  };
}

function validRunStateDoc() {
  return {
    schemaVersion: "1.0.0",
    runId: "execution.abc123",
    planId: "plan.abc123",
    planRevision: 1,
    createdAt: now,
    updatedAt: now,
    ownerSessionId: "session-001",
    heartbeatAt: now,
    ttlSeconds: 600,
    wallClockCapSeconds: 1800,
    approvals: {},
    artifactBindings: [],
    nodes: {
      "run.research-competitive-scan": { nodeId: "run.research-competitive-scan", status: "pending", attempts: [] },
    },
  };
}

function validCheckpointDoc() {
  return { schemaVersion: "1.0.0", writtenAt: now, writerSessionId: "session-001", stateHash: "deadbeef", runState: validRunStateDoc() };
}

function validBusinessStateDoc() {
  const lanes: Record<string, unknown> = {};
  for (const key of laneKeys) lanes[key] = { status: "pending", evidence: [], blockers: [] };
  return {
    schemaVersion: "2.0.0",
    updatedAt: now,
    narrative: { sinceLastTime: "", rightNow: "", yourCall: "", lastCelebratedPhase: "" },
    project: {
      name: "App Name",
      slug: "app-name",
      owner: "Founder",
      phase: "phase_0_orient",
      launchScope: "essentials",
      kickoffDate: "",
      platforms: ["ios"],
      bundleIds: { ios: "com.example.app", android: "" },
      publicUrls: { landing: "", privacy: "", terms: "" },
    },
    lanes,
    founderGates: { pending: [] },
  };
}

export function register(harness: Harness): void {
  const checkSchema = (schemaId: string, data: unknown) => harness.checkSchema(schemaId, data);

  harness.check("status schema: canonical status count matches types.ts", () => {
    const schema = JSON.parse(readFileSync(path.join(schemaDir, "status.schema.json"), "utf8")) as { $defs: { status: { enum: string[] } } };
    assert(
      schema.$defs.status.enum.length === statusValues.length,
      `status.schema.json declares ${schema.$defs.status.enum.length} values, types.ts declares ${statusValues.length}`,
    );
    for (const value of statusValues) assert(schema.$defs.status.enum.includes(value), `status.schema.json is missing "${value}"`);
  });

  harness.check("grants: valid grant document validates", () => {
    assertSchemaValid(checkSchema(GRANTS_SCHEMA, validGrantsDoc()), "valid grants document");
  });

  harness.check("grants: system domains are not valid grant keys", () => {
    const doc = validGrantsDoc();
    (doc.grants as Record<string, unknown>)["domain.orchestration"] = validGrant();
    assertSchemaInvalid(checkSchema(GRANTS_SCHEMA, doc), "additional", "grant on a system domain");
  });

  harness.check("grants: spend-class prerequisite without a budget ref rejects", () => {
    const doc = validGrantsDoc();
    (doc.grants as Record<string, { prerequisites: unknown[] }>)["domain.growth"]!.prerequisites = [
      { id: "budget-check", kind: "budget_funded", ttlSeconds: 86400, status: "unverified", verifiedAt: "" },
    ];
    assertSchemaInvalid(checkSchema(GRANTS_SCHEMA, doc), "budgetRef", "budget_funded prerequisite missing budgetRef");
  });

  harness.check("waivers: valid waiver document validates", () => {
    assertSchemaValid(checkSchema(WAIVERS_SCHEMA, validWaiversDoc()), "valid waivers document");
  });

  harness.check("waivers: waiver without expiry rejects", () => {
    const doc = validWaiversDoc();
    delete (doc.waivers[0] as Record<string, unknown>).expiry;
    assertSchemaInvalid(checkSchema(WAIVERS_SCHEMA, doc), "expiry", "waiver missing expiry");
  });

  harness.check("waivers: cap without budget period rejects", () => {
    const doc = validWaiversDoc();
    delete (doc.waivers[0] as Record<string, unknown>).budgetPeriod;
    assertSchemaInvalid(checkSchema(WAIVERS_SCHEMA, doc), "budgetPeriod", "waiver with caps but no budgetPeriod");
  });

  harness.check("waivers: destructive waiver without undo or mitigation rejects", () => {
    const doc = validWaiversDoc();
    delete (doc.waivers[0] as Record<string, unknown>).undoContract;
    assertSchemaInvalid(checkSchema(WAIVERS_SCHEMA, doc), "undoContract", "destructive waiver missing undoContract");
  });

  harness.check("waivers: release waiver without undo or mitigation rejects", () => {
    const doc = validWaiversDoc();
    const waiver = doc.waivers[0] as Record<string, unknown>;
    waiver.actionClass = "release";
    waiver.protectedCategory = "release";
    delete waiver.undoContract;
    assertSchemaInvalid(checkSchema(WAIVERS_SCHEMA, doc), "undoContract", "release waiver missing undoContract");
  });

  harness.check("waivers: undo contract accepts the literal-undo variant", () => {
    const doc = validWaiversDoc();
    const waiver = doc.waivers[0] as Record<string, unknown>;
    waiver.undoContract = { kind: "literal_undo", undoAction: "Re-create the branch from the recorded pre-deletion commit SHA." };
    assertSchemaValid(checkSchema(WAIVERS_SCHEMA, doc), "waiver with literal undo contract");
  });

  harness.check("budget ledger: valid ledger document validates", () => {
    assertSchemaValid(checkSchema(BUDGET_LEDGER_SCHEMA, validLedgerDoc()), "valid budget ledger document");
  });

  harness.check("budget ledger: entry without a declared estimate rejects", () => {
    const doc = validLedgerDoc();
    delete (doc.entries[0] as Record<string, unknown>).estimate;
    assertSchemaInvalid(checkSchema(BUDGET_LEDGER_SCHEMA, doc), "estimate", "ledger entry missing declared estimate");
  });

  harness.check("control: valid control document validates", () => {
    assertSchemaValid(checkSchema(CONTROL_SCHEMA, validControlDoc()), "valid control document");
  });

  harness.check("control: control document composes the grants and waivers shapes", () => {
    const doc = validControlDoc();
    (doc.grants as Record<string, unknown>)["domain.growth"] = validGrant();
    (doc as Record<string, unknown>).waivers = [validWaiver()];
    assertSchemaValid(checkSchema(CONTROL_SCHEMA, doc), "control document with embedded grant and waiver");
  });

  harness.check("control: missing kill switch rejects", () => {
    const doc = validControlDoc() as Record<string, unknown>;
    delete doc.killSwitch;
    assertSchemaInvalid(checkSchema(CONTROL_SCHEMA, doc), "killSwitch", "control document missing kill switch");
  });

  harness.check("run state: valid run state document validates", () => {
    assertSchemaValid(checkSchema(RUN_STATE_SCHEMA, validRunStateDoc()), "valid run state document");
  });

  harness.check("run state: orphaned and needs_readback are legal node statuses", () => {
    const doc = validRunStateDoc();
    (doc.nodes as Record<string, { status: string }>)["run.research-competitive-scan"]!.status = "needs_readback";
    assertSchemaValid(checkSchema(RUN_STATE_SCHEMA, doc), "run state node in needs_readback");
  });

  harness.check("run state: attempt without an owner session id rejects", () => {
    const doc = validRunStateDoc();
    (doc.nodes as Record<string, { attempts: unknown[] }>)["run.research-competitive-scan"]!.attempts = [
      { id: "run.research-competitive-scan.attempt.1", nodeId: "run.research-competitive-scan", number: 1, status: "running", ttlSeconds: 600, inputFingerprint: "", evidence: [], readbackRequired: false },
    ];
    assertSchemaInvalid(checkSchema(RUN_STATE_SCHEMA, doc), "ownerSessionId", "attempt missing ownerSessionId");
  });

  harness.check("checkpoint: valid checkpoint document validates", () => {
    assertSchemaValid(checkSchema(CHECKPOINT_SCHEMA, validCheckpointDoc()), "valid checkpoint document");
  });

  harness.check("checkpoint: missing state hash rejects", () => {
    const doc = validCheckpointDoc() as Record<string, unknown>;
    delete doc.stateHash;
    assertSchemaInvalid(checkSchema(CHECKPOINT_SCHEMA, doc), "stateHash", "checkpoint missing stateHash");
  });

  harness.check("business state: valid state document validates", () => {
    assertSchemaValid(checkSchema(BUSINESS_STATE_SCHEMA, validBusinessStateDoc()), "valid business state document");
  });

  harness.check("business state: unknown lane key rejects", () => {
    const doc = validBusinessStateDoc();
    (doc.lanes as Record<string, unknown>).not_a_real_lane = { status: "pending", evidence: [], blockers: [] };
    assertSchemaInvalid(checkSchema(BUSINESS_STATE_SCHEMA, doc), "additional", "business state with an unknown lane key");
  });

  harness.check("status vocabulary: every v1 lane status maps to exactly one canonical status, no gaps", () => {
    const seen = new Map<string, string>();
    for (const v1 of v1LaneStatusValues) {
      const mapped = mapV1LaneStatus(v1);
      assert(statusValues.includes(mapped), `v1 lane status "${v1}" mapped to unknown canonical status "${mapped}"`);
      assert(!seen.has(v1), `v1 lane status "${v1}" was visited twice`);
      seen.set(v1, mapped);
    }
    assert(seen.size === v1LaneStatusValues.length, "not every v1 lane status was mapped");
  });

  harness.check("status vocabulary: every v1 run-node status maps to exactly one canonical status, no gaps", () => {
    const seen = new Map<string, string>();
    for (const v1 of v1RunNodeStatusValues) {
      const mapped = mapV1RunNodeStatus(v1);
      assert(statusValues.includes(mapped), `v1 run-node status "${v1}" mapped to unknown canonical status "${mapped}"`);
      assert(!seen.has(v1), `v1 run-node status "${v1}" was visited twice`);
      seen.set(v1, mapped);
    }
    assert(seen.size === v1RunNodeStatusValues.length, "not every v1 run-node status was mapped");
  });

  harness.check("status vocabulary: mapping is deterministic across repeated calls", () => {
    for (const v1 of v1LaneStatusValues) assert(mapV1LaneStatus(v1) === mapV1LaneStatus(v1), `v1 lane status "${v1}" mapped inconsistently`);
    for (const v1 of v1RunNodeStatusValues) assert(mapV1RunNodeStatus(v1) === mapV1RunNodeStatus(v1), `v1 run-node status "${v1}" mapped inconsistently`);
  });

  harness.check("migration: v1 PROJECT_STATE.yaml migrates to a valid state v2 document with every gate demoted", () => {
    const v1Path = path.join(skillRoot, "workspace/business/state/PROJECT_STATE.yaml");
    const v1Source = readFileSync(v1Path, "utf8");
    const v1State: unknown = parseYaml(v1Source);
    const migrated = migrateProjectStateV1(v1State);

    const stateResult = checkSchema(BUSINESS_STATE_SCHEMA, migrated.businessState);
    assertSchemaValid(stateResult, "migrated business state v2 document");
    const controlResult = checkSchema(CONTROL_SCHEMA, migrated.control);
    assertSchemaValid(controlResult, "migrated control document");

    assert(migrated.businessState.founderGates.pending.length > 0, "migration produced no pending founder gates to re-present");
    for (const gate of migrated.businessState.founderGates.pending) {
      assert(gate.reason.length > 0, `migrated gate "${gate.id}" has no reason recorded`);
    }
    assert(Object.keys(migrated.control.grants).length === 0, "migration must not carry forward any auto-granted domain");
    assert(migrated.control.waivers.length === 0, "migration must not carry forward any auto-approved waiver");
    assert(migrated.control.killSwitch.engaged === false, "migration must not silently engage the kill switch");
  });

  harness.check("migration: every lane status round-trips through the shared vocabulary", () => {
    const v1Path = path.join(skillRoot, "workspace/business/state/PROJECT_STATE.yaml");
    const v1State: unknown = parseYaml(readFileSync(v1Path, "utf8"));
    const migrated = migrateProjectStateV1(v1State);
    for (const key of laneKeys) {
      const lane = migrated.businessState.lanes[key];
      assert(Boolean(lane), `migrated business state is missing lane "${key}"`);
      assert(statusValues.includes(lane!.status), `migrated lane "${key}" has non-canonical status "${lane!.status}"`);
    }
  });

  harness.check("migration: a non-empty v1 project.source_truth is dropped with a warning naming the field", () => {
    const v1State = { project: { name: "App", slug: "app", source_truth: { transcript: "", repo: "", current_docs: ["product/SPEC.md"] } }, lanes: {} };
    const migrated = migrateProjectStateV1(v1State, now);
    assert(
      migrated.warnings.some((w) => w.includes("project.source_truth")),
      `expected a warning naming project.source_truth, got: ${migrated.warnings.join(" | ")}`,
    );
    assert(!("sourceTruth" in migrated.businessState.project), "v2 project should carry no source_truth-derived field");
  });

  harness.check("migration: an all-empty v1 project.source_truth (no real content) does not warn", () => {
    const v1State = { project: { name: "App", slug: "app", source_truth: { transcript: "", repo: "", current_docs: [] } }, lanes: {} };
    const migrated = migrateProjectStateV1(v1State, now);
    assert(!migrated.warnings.some((w) => w.includes("project.source_truth")), "an entirely-empty source_truth carries nothing to lose, so it should not warn");
  });

  harness.check("migration: a non-empty v1 autonomy.mode is discarded with a warning naming the mode", () => {
    const v1State = { project: { name: "App", slug: "app" }, lanes: {}, autonomy: { mode: "prepare" } };
    const migrated = migrateProjectStateV1(v1State, now);
    assert(
      migrated.warnings.some((w) => w.includes("autonomy.mode") && w.includes("prepare")),
      `expected a warning naming the discarded autonomy.mode "prepare", got: ${migrated.warnings.join(" | ")}`,
    );
  });

  harness.check("migration: a case-variant active_gate_status of 'Pending' still carries the gate forward (not dropped, no warning)", () => {
    const v1State = {
      project: { name: "App", slug: "app" },
      lanes: {},
      business_operator: { active_gate_id: "confirm-working-name", active_gate_status: "Pending", active_gate_class: "scope" },
    };
    const migrated = migrateProjectStateV1(v1State, now);
    const carried = migrated.businessState.founderGates.pending.find((gate) => gate.sourceLegacyId === "confirm-working-name");
    assert(Boolean(carried), `expected the case-variant 'Pending' active gate to be carried forward as a founder gate, got pending: ${JSON.stringify(migrated.businessState.founderGates.pending)}`);
    assert(!migrated.warnings.some((w) => w.includes("unrecognized active_gate_status")), "a recognized case-variant of 'pending' must not be reported as unrecognized");
  });

  harness.check("migration: an unrecognized active_gate_status (with an active_gate_id present) warns rather than silently dropping the gate", () => {
    const v1State = {
      project: { name: "App", slug: "app" },
      lanes: {},
      business_operator: { active_gate_id: "confirm-working-name", active_gate_status: "awaiting_review", active_gate_class: "scope" },
    };
    const migrated = migrateProjectStateV1(v1State, now);
    const carried = migrated.businessState.founderGates.pending.find((gate) => gate.sourceLegacyId === "confirm-working-name");
    assert(!carried, "an unrecognized status is not itself carried forward as a re-presented gate");
    assert(
      migrated.warnings.some((w) => w.includes("unrecognized active_gate_status") && w.includes("confirm-working-name")),
      `expected a warning naming the unrecognized active_gate_status, got: ${migrated.warnings.join(" | ")}`,
    );
  });

  harness.check("migration: a recognized terminal active_gate_status ('resolved') is dropped without a warning", () => {
    const v1State = {
      project: { name: "App", slug: "app" },
      lanes: {},
      business_operator: { active_gate_id: "confirm-working-name", active_gate_status: "resolved", active_gate_class: "scope" },
    };
    const migrated = migrateProjectStateV1(v1State, now);
    assert(!migrated.warnings.some((w) => w.includes("unrecognized active_gate_status")), "a known terminal status should not be reported as unrecognized");
  });

  harness.check("grant levels cover exactly review-first, run-with-guardrails, full", () => {
    const schema = JSON.parse(readFileSync(path.join(schemaDir, "grants.schema.json"), "utf8")) as {
      $defs: { grant: { properties: { level: { enum: string[] } } } };
    };
    const levels = schema.$defs.grant.properties.level.enum;
    assert(levels.length === 3, `expected 3 grant levels, found ${levels.length}`);
    for (const level of ["review-first", "run-with-guardrails", "full"]) assert(levels.includes(level), `grants.schema.json is missing level "${level}"`);
  });

  harness.check("grantable domain enum matches the 12 business-unit-mapped domains", () => {
    const schema = JSON.parse(readFileSync(path.join(schemaDir, "grants.schema.json"), "utf8")) as {
      $defs: { grant: { properties: { domainId: { enum: string[] } } } };
    };
    const declared = schema.$defs.grant.properties.domainId.enum;
    assert(declared.length === grantableDomainIds.length, `grants.schema.json declares ${declared.length} domains, types.ts declares ${grantableDomainIds.length}`);
    for (const id of grantableDomainIds) assert(declared.includes(id), `grants.schema.json is missing domain "${id}"`);
  });
}
