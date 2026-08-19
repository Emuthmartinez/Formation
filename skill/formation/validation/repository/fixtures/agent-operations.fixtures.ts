import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Harness, readState, writeState } from "./_harness.js";

const DIGEST = `sha256:${"a".repeat(64)}`;

export function register(h: Harness): void {
  const { makeFixture, makeEmptyFixture, runFixture, runScriptArgs } = h;

  const baseline = makeFixture("agent-operations-baseline");
  runFixture("shipped agent operations templates pass", baseline, "check-agent-operations.ts", 0);

  const missingCapability = makeFixture("agent-operations-missing-capability");
  const missingCapabilityLedger = readLedger(missingCapability);
  missingCapabilityLedger.capabilities = [];
  writeLedger(missingCapability, missingCapabilityLedger);
  runFixture(
    "agent operations without capability inventory fails",
    missingCapability,
    "check-agent-operations.ts",
    1,
    "agent_operations.capability_connector_missing",
  );

  const unsafePolicy = makeFixture("agent-operations-unsafe-policy");
  const unsafePolicyLedger = readLedger(unsafePolicy);
  (unsafePolicyLedger.policies as Record<string, unknown>).ignoreEmbeddedInstructions = false;
  writeLedger(unsafePolicy, unsafePolicyLedger);
  runFixture(
    "agent operations without prompt-injection quarantine fails",
    unsafePolicy,
    "check-agent-operations.ts",
    1,
    "agent_operations.policy_ignore_embedded_instructions_missing",
  );

  const mutationNoApproval = makeFixture("agent-operations-mutation-no-approval");
  writeProofFiles(mutationNoApproval);
  const mutationNoApprovalLedger = completeLedger(mutationNoApproval);
  mutationNoApprovalLedger.approvalEnvelopes = [];
  writeLedger(mutationNoApproval, mutationNoApprovalLedger);
  runFixture(
    "authenticated browser mutation without scoped approval fails",
    mutationNoApproval,
    "check-agent-operations.ts",
    1,
    "approval_missing_or_mismatched",
  );

  const untraceableResearch = makeFixture("agent-operations-untraceable-research");
  const untraceableLedger = readLedger(untraceableResearch);
  const now = new Date().toISOString();
  untraceableLedger.status = "active";
  untraceableLedger.updatedAt = now;
  untraceableLedger.capabilityCheckedAt = now;
  const untraceableCapabilities = untraceableLedger.capabilities as Array<Record<string, unknown>>;
  const researchBrowser = untraceableCapabilities.find((entry) => entry.id === "authenticated-browser")!;
  Object.assign(researchBrowser, {
    provider: "YouTube",
    status: "available",
    checkedAt: now,
    account: "public",
    team: "",
    project: "launch research",
    environment: "public",
    modes: ["observe"],
  });
  untraceableLedger.actions = [
    {
      id: "ACT-research",
      class: "observe",
      purpose: "media_analysis",
      operation: "research.video.observe",
      resource: "youtube/videos/example",
      capabilityId: "authenticated-browser",
      occurredAt: now,
      surface: "social video research",
      provider: "YouTube",
      route: "browser",
      account: "public",
      team: "",
      project: "launch research",
      environment: "public",
      payloadDigest: "",
      contentDigest: "",
      spendAmount: null,
      currency: "",
      riskClass: "low",
      voicePolicy: "",
      authorization: { approvalId: "", basis: "Read-only research requested by founder" },
      preflight: { targetVerified: true, beforeState: "Public video opened", evidencePath: "" },
      result: { status: "succeeded", externalId: "", afterState: "Notes captured", evidencePath: "", rollbackOrRecovery: "No mutation" },
      redactionAttested: true,
      reconciliation: { projectStateUpdated: false, canonicalDocs: [], providerProofUpdated: false, cockpitRendered: false, at: "" },
    },
  ];
  writeLedger(untraceableResearch, untraceableLedger);
  runFixture(
    "browser research without source and observation provenance fails",
    untraceableResearch,
    "check-agent-operations.ts",
    1,
    "research_provenance_missing",
  );

  const complete = makeFixture("agent-operations-complete");
  writeProofFiles(complete);
  const completeValue = completeLedger(complete);
  writeLedger(complete, completeValue);
  reconcileFixture(complete, completeValue);
  runFixture("scoped authenticated browser mutation with grounded proof passes", complete, "check-agent-operations.ts", 0);

  const excluded = makeFixture("agent-operations-excluded-operation");
  writeProofFiles(excluded);
  const excludedValue = completeLedger(excluded);
  (excludedValue.actions as Array<Record<string, unknown>>)[0]!.operation = "pricing.subscription.change";
  writeLedger(excluded, excludedValue);
  reconcileFixture(excluded, excludedValue);
  runFixture("approval exclusions block a risky operation", excluded, "check-agent-operations.ts", 1, "approval_missing_or_mismatched");

  const overspend = makeFixture("agent-operations-overspend");
  writeProofFiles(overspend);
  const overspendValue = completeLedger(overspend);
  const overspendAction = (overspendValue.actions as Array<Record<string, unknown>>)[0]!;
  Object.assign(overspendAction, {
    class: "spend",
    purpose: "spend",
    operation: "ads.campaign.spend",
    resource: "ads/campaigns/launch",
    spendAmount: 150,
    currency: "USD",
    riskClass: "high",
  });
  const overspendApproval = (overspendValue.approvalEnvelopes as Array<Record<string, unknown>>)[0]!;
  Object.assign(overspendApproval, {
    actionClasses: ["spend"],
    operations: ["ads.campaign.spend"],
    resourcePatterns: ["ads/campaigns/*"],
    exclusions: [],
    spendCeiling: 100,
  });
  (overspendValue.capabilities as Array<Record<string, unknown>>).find((entry) => entry.id === "authenticated-browser")!.modes = ["observe", "spend"];
  writeLedger(overspend, overspendValue);
  reconcileFixture(overspend, overspendValue);
  runFixture("spend approval ceiling is enforced", overspend, "check-agent-operations.ts", 1, "approval_missing_or_mismatched");

  const voiceMismatch = makeFixture("agent-operations-voice-mismatch");
  writeProofFiles(voiceMismatch);
  const voiceValue = completeLedger(voiceMismatch);
  const voiceAction = (voiceValue.actions as Array<Record<string, unknown>>)[0]!;
  Object.assign(voiceAction, {
    class: "publish",
    purpose: "social_engagement",
    operation: "social.post.publish",
    resource: "social/accounts/founder/posts/draft-1",
    contentDigest: `sha256:${"b".repeat(64)}`,
    voicePolicy: "brand-voice-v1",
    riskClass: "high",
  });
  const voiceApproval = (voiceValue.approvalEnvelopes as Array<Record<string, unknown>>)[0]!;
  Object.assign(voiceApproval, {
    actionClasses: ["publish"],
    operations: ["social.post.publish"],
    resourcePatterns: ["social/accounts/founder/posts/*"],
    exclusions: [],
    voicePolicy: "brand-voice-v2",
  });
  (voiceValue.capabilities as Array<Record<string, unknown>>).find((entry) => entry.id === "authenticated-browser")!.modes = ["observe", "publish"];
  writeLedger(voiceMismatch, voiceValue);
  reconcileFixture(voiceMismatch, voiceValue);
  runFixture("publish approval voice policy is enforced", voiceMismatch, "check-agent-operations.ts", 1, "approval_missing_or_mismatched");

  const staleState = makeFixture("agent-operations-stale-state");
  writeProofFiles(staleState);
  writeLedger(staleState, completeLedger(staleState));
  runFixture("self-attested reconciliation with stale canonical state fails", staleState, "check-agent-operations.ts", 1, "state_status_mismatch");

  const unavailableCapability = makeFixture("agent-operations-unavailable-capability");
  writeProofFiles(unavailableCapability);
  const unavailableValue = completeLedger(unavailableCapability);
  (unavailableValue.capabilities as Array<Record<string, unknown>>).find((entry) => entry.id === "authenticated-browser")!.status = "blocked";
  writeLedger(unavailableCapability, unavailableValue);
  reconcileFixture(unavailableCapability, unavailableValue);
  runFixture("action bound to an unavailable capability fails", unavailableCapability, "check-agent-operations.ts", 1, "capability_unavailable");

  const historical = makeFixture("agent-operations-historical-approval");
  writeProofFiles(historical);
  const historicalValue = completeLedger(historical, "2026-01-02T12:00:00.000Z", "2026-01-03T00:00:00.000Z");
  writeLedger(historical, historicalValue);
  reconcileFixture(historical, historicalValue);
  runFixture("historical action remains valid after its approval expires", historical, "check-agent-operations.ts", 0);

  const browserObservation = makeFixture("agent-operations-browser-observation");
  writeProofFiles(browserObservation);
  const browserObservationValue = completeLedger(browserObservation);
  browserObservationValue.approvalEnvelopes = [];
  const browserObservationAction = (browserObservationValue.actions as Array<Record<string, unknown>>)[0]!;
  Object.assign(browserObservationAction, {
    class: "observe",
    purpose: "operational_observation",
    operation: "provider.status.observe",
    resource: "apps/Example App/status",
    payloadDigest: "",
    riskClass: "low",
    authorization: { approvalId: "", basis: "Read-only provider inspection requested by founder" },
    reconciliation: {
      projectStateUpdated: false,
      canonicalDocs: [],
      providerProofUpdated: false,
      cockpitRendered: true,
      at: "",
    },
  });
  (browserObservationValue.capabilities as Array<Record<string, unknown>>).find((entry) => entry.id === "authenticated-browser")!.modes = ["observe"];
  writeLedger(browserObservation, browserObservationValue);
  reconcileFixture(browserObservation, browserObservationValue);
  runFixture("authenticated browser provider observation does not require research provenance", browserObservation, "check-agent-operations.ts", 0);

  const reused = makeFixture("agent-operations-one-shot-reused");
  writeProofFiles(reused);
  const reusedValue = completeLedger(reused);
  const reusedActions = reusedValue.actions as Array<Record<string, unknown>>;
  reusedActions.push({ ...reusedActions[0], id: "ACT-asc-draft-second" });
  writeLedger(reused, reusedValue);
  reconcileFixture(reused, reusedValue);
  runFixture("one-shot approval cannot authorize two attempts", reused, "check-agent-operations.ts", 1, "one_shot_reused");

  const failedUnauthorized = makeFixture("agent-operations-failed-unauthorized");
  writeProofFiles(failedUnauthorized);
  const failedUnauthorizedValue = completeLedger(failedUnauthorized);
  failedUnauthorizedValue.approvalEnvelopes = [];
  const failedAction = (failedUnauthorizedValue.actions as Array<Record<string, unknown>>)[0]!;
  (failedAction.result as Record<string, unknown>).status = "failed";
  writeLedger(failedUnauthorized, failedUnauthorizedValue);
  reconcileFixture(failedUnauthorized, failedUnauthorizedValue);
  runFixture("failed risky attempt still requires scoped approval", failedUnauthorized, "check-agent-operations.ts", 1, "approval_missing_or_mismatched");

  const secretHuman = makeFixture("agent-operations-secret-human-log");
  writeFileSync(
    path.join(secretHuman, "operations/AGENT_OPERATIONS.md"),
    `${readFileSync(path.join(secretHuman, "operations/AGENT_OPERATIONS.md"), "utf8")}\npassword: \"do-not-store-me\"\n`,
    "utf8",
  );
  runFixture("raw secret in human operations log fails", secretHuman, "check-agent-operations.ts", 1, "raw_secret_detected");

  const secretProof = makeFixture("agent-operations-secret-proof");
  writeProofFiles(secretProof);
  const secretProofValue = completeLedger(secretProof);
  writeFileSync(path.join(secretProof, "operations", "proof", "after.txt"), 'token: "never-store-this-value"\n', "utf8");
  writeLedger(secretProof, secretProofValue);
  reconcileFixture(secretProof, secretProofValue);
  runFixture("raw secret in referenced proof fails", secretProof, "check-agent-operations.ts", 1, "raw_secret_detected");

  const missingPanel = makeFixture("agent-operations-control-panel-missing");
  const businessPath = path.join(missingPanel, "studio", "seed", "business.json");
  const business = JSON.parse(readFileSync(businessPath, "utf8")) as Record<string, unknown>;
  const controlPlane = business.controlPlane as Record<string, unknown>;
  controlPlane.panels = (controlPlane.panels as Array<Record<string, unknown>>).filter((panel) => panel.id !== "agent-ops");
  writeFileSync(businessPath, `${JSON.stringify(business, null, 2)}\n`, "utf8");
  runFixture("control plane without agent operations panel fails", missingPanel, "check-control-plane-contract.ts", 1, "control_plane.agent-ops.missing");

  const ascContract = makeEmptyFixture("asc-command-contract");
  mkdirSync(path.join(ascContract, "knowledge", "store"), { recursive: true });
  const currentAscCommands = [
    "asc install-skills",
    "asc telemetry status",
    "asc-analytics-reports",
    "asc-ad-hoc-distribution",
    "asc apps view --id APP_ID",
    "asc status --app APP_ID",
    "asc review status --app APP_ID",
    "asc review doctor --app APP_ID",
    "asc review submissions-list --app APP_ID",
    "asc diff localizations --app APP_ID",
    "asc validate --app APP_ID --version VERSION_STRING or --version-id <VERSION_ID>",
  ].join("\n");
  writeFileSync(path.join(ascContract, "knowledge", "store", "app-store-connect-cli.md"), currentAscCommands, "utf8");
  runScriptArgs("current ASC command contract passes", "check-asc-command-contract.ts", ["--skill-root", ascContract], 0);
  writeFileSync(path.join(ascContract, "knowledge", "store", "app-store-connect-cli.md"), `${currentAscCommands}\nasc apps get --id APP_ID\n`, "utf8");
  runScriptArgs(
    "known-invalid ASC command fails",
    "check-asc-command-contract.ts",
    ["--skill-root", ascContract],
    1,
    "asc_command_contract.stale_asc_apps_get",
  );
}

function readLedger(root: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(root, "operations", "agent-operations.json"), "utf8")) as Record<string, unknown>;
}

function writeLedger(root: string, ledger: Record<string, unknown>): void {
  writeFileSync(path.join(root, "operations", "agent-operations.json"), `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}

function writeProofFiles(root: string): void {
  const proofDir = path.join(root, "operations", "proof");
  mkdirSync(proofDir, { recursive: true });
  writeFileSync(path.join(proofDir, "before.txt"), "Sanitized draft metadata before state.\n", "utf8");
  writeFileSync(path.join(proofDir, "after.txt"), "Sanitized draft metadata after state and provider read-back.\n", "utf8");
}

function completeLedger(root: string, now = new Date().toISOString(), expiresAt = "2099-01-01T00:00:00.000Z"): Record<string, unknown> {
  const ledger = readLedger(root);
  ledger.status = "active";
  ledger.updatedAt = now;
  ledger.capabilityCheckedAt = now;
  const capabilities = ledger.capabilities as Array<Record<string, unknown>>;
  const browser = capabilities.find((entry) => entry.kind === "browser");
  if (browser) {
    browser.provider = "App Store Connect";
    browser.status = "available";
    browser.checkedAt = now;
    browser.account = "founder@example.invalid";
    browser.team = "Example Team";
    browser.project = "Example App";
    browser.environment = "production console";
    browser.modes = ["observe", "draft", "mutate"];
  }
  ledger.approvalEnvelopes = [
    {
      id: "APR-asc-draft",
      provider: "App Store Connect",
      account: "founder@example.invalid",
      team: "Example Team",
      project: "Example App",
      environment: "production console",
      actionClasses: ["mutate"],
      operations: ["metadata.draft.edit"],
      resourcePatterns: ["apps/Example App/versions/*/localizations/*"],
      payloadDigests: [DIGEST],
      exclusions: ["submission.*", "release.*", "pricing.*", "privacy.*"],
      mode: "one_shot",
      basis: "Current founder request authorizes one reversible draft metadata edit",
      approvedAt: now,
      expiresAt,
      status: "consumed",
      consumedByActionIds: ["ACT-asc-draft"],
      revokedAt: "",
      spendCeiling: null,
      voicePolicy: "",
    },
  ];
  ledger.actions = [
    {
      id: "ACT-asc-draft",
      class: "mutate",
      purpose: "provider_mutation",
      operation: "metadata.draft.edit",
      resource: "apps/Example App/versions/1.0/localizations/en-US",
      capabilityId: "authenticated-browser",
      occurredAt: now,
      surface: "App Store Connect draft metadata",
      provider: "App Store Connect",
      route: "browser",
      account: "founder@example.invalid",
      team: "Example Team",
      project: "Example App",
      environment: "production console",
      payloadDigest: DIGEST,
      contentDigest: "",
      spendAmount: null,
      currency: "",
      riskClass: "medium",
      voicePolicy: "",
      authorization: { approvalId: "APR-asc-draft", basis: "Current founder request exact scope" },
      preflight: {
        targetVerified: true,
        beforeState: "Correct team, app, version, locale, and draft field verified",
        evidencePath: "operations/proof/before.txt",
      },
      result: {
        status: "succeeded",
        externalId: "draft-localization-example",
        afterState: "Provider read-back matches the approved draft copy",
        evidencePath: "operations/proof/after.txt",
        rollbackOrRecovery: "Restore the before-state copy from the sanitized proof packet",
      },
      redactionAttested: true,
      reconciliation: {
        projectStateUpdated: true,
        canonicalDocs: ["store/STORE_CONSOLE.md", "operations/AGENT_OPERATIONS.md"],
        providerProofUpdated: true,
        cockpitRendered: true,
        at: now,
      },
    },
  ];
  return ledger;
}

function reconcileFixture(root: string, ledger: Record<string, unknown>): void {
  const actions = ledger.actions as Array<Record<string, unknown>>;
  const latest = actions.at(-1)!;
  const latestId = String(latest.id);
  const result = latest.result as Record<string, unknown>;
  const reconciled = result.status === "succeeded" && ["mutate", "publish", "spend", "release", "destructive"].includes(String(latest.class));
  const state = readState(root);
  const operations = state.agent_operations as Record<string, unknown>;
  operations.status = ledger.status;
  operations.capability_checked_at = ledger.capabilityCheckedAt;
  operations.active_approval_ids = [];
  operations.last_action_id = latestId;
  operations.state_reconciled = reconciled;
  writeState(root, state);

  const humanPath = path.join(root, "operations/AGENT_OPERATIONS.md");
  writeFileSync(
    humanPath,
    `${readFileSync(humanPath, "utf8").replace(/^Status:.*$/m, `Status: ${String(ledger.status)}`)}\n| ${latestId} | mutate | exact fixture target | browser | APR-asc-draft | sanitized before/after | ${String(result.status)} | yes |\n`,
    "utf8",
  );
  const cockpitPath = path.join(root, "state/launch-cockpit.html");
  const cockpitSource = readFileSync(cockpitPath, "utf8");
  const marker = "<h2>Behind The Scenes</h2>";
  const markerIndex = cockpitSource.indexOf(marker);
  const cockpitHead = cockpitSource.slice(0, markerIndex + marker.length);
  const cockpitTail = cockpitSource
    .slice(markerIndex + marker.length)
    .replace(/<span class="status [^"]+">[^<]+<\/span>/, `<span class="status ${String(ledger.status)}">${String(ledger.status)}</span>`)
    .replace(/Capability checked: [^<]*/, `Capability checked: ${String(ledger.capabilityCheckedAt)}`)
    .replace("Last action: </p>", `Last action: ${latestId}</p>`)
    .replace("State reconciled: false", `State reconciled: ${String(reconciled)}`);
  writeFileSync(cockpitPath, `${cockpitHead}${cockpitTail}`, "utf8");
  for (const relative of ["store/STORE_CONSOLE.md", "operations/PROVIDER_PROOF.md"]) {
    const fullPath = path.join(root, relative);
    const existing = readFileSync(fullPath, "utf8");
    writeFileSync(fullPath, `${existing}\nAgent operation proof: ${latestId}.\n`, "utf8");
  }
}
