import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  type Harness,
  type MutableRecord,
  expectRecord,
  getLane,
  getTools,
  readState,
  skillRoot,
  writeBusinessEntrypoints,
  writeCompleteAppleRequirements,
  writeCompleteAppleSigning,
  writeCompleteAttribution,
  writeCompleteCompoundEngineering,
  writeCompleteContentAssets,
  writeCompleteElevenStar,
  writeCompleteOrchestration,
  writeCompletePaidToolDecisions,
  writeCompletePaidUserAcquisition,
  writeCompleteProviderProof,
  writeCompleteSecurity,
  writeCompleteStoreConsole,
  writeCompleteStoreScreenshots,
  writeCompleteViralGrowth,
  writeSourceRegistryFixture,
  writeState,
} from "./_harness.js";

export function register(h: Harness): void {
  const { makeFixture, makeEmptyFixture, runFixture, runScriptArgs, results } = h;

  const orchestrationNoPreflight = makeFixture("orchestration-no-preflight");
  const orchestrationNoPreflightState = readState(orchestrationNoPreflight);
  const noPreflightLane = getLane(orchestrationNoPreflightState, "orchestration");
  noPreflightLane["status"] = "done";
  noPreflightLane["evidence"] = ["orchestration/ORCHESTRATION.md", "orchestration/orchestration.html"];
  writeState(orchestrationNoPreflight, orchestrationNoPreflightState);
  runFixture(
    "orchestration done without preflight fails",
    orchestrationNoPreflight,
    "check-parallel-orchestration.ts",
    1,
    "orchestration.done_without_preflight",
  );

  const orchestrationOverlap = makeFixture("orchestration-overlap");
  const orchestrationOverlapState = readState(orchestrationOverlap);
  orchestrationOverlapState["orchestration"] = {
    preflight_done: true,
    strategy: "parallel_subagents",
    rationale: "Attempted two parallel implementation units.",
    integration_owner: "orchestrator",
    manager_pattern: true,
    file_overlap_checked: true,
    actual_file_collision_check: false,
    agent_outputs_reviewed: false,
    state_reconciled: false,
    candidate_units: [
      {
        id: "analytics-doc",
        role: "engineering leader",
        objective: "Update analytics plan.",
        mode: "edit",
        files: ["ENGINEERING_PLAN.md"],
        shared_resources: [],
        parallel_safe: true,
        status: "pending",
      },
      {
        id: "revenue-doc",
        role: "engineering leader",
        objective: "Update revenue plan.",
        mode: "edit",
        files: ["ENGINEERING_PLAN.md"],
        shared_resources: [],
        parallel_safe: true,
        status: "pending",
      },
    ],
    parallel_safe_units: ["analytics-doc", "revenue-doc"],
    serialized_units: ["PROJECT_STATE.yaml updates", "git staging, commits, merges, pushes, and releases"],
    spawned_agents: [],
    focused_validators_run: [],
    full_suites_run: [],
  };
  writeState(orchestrationOverlap, orchestrationOverlapState);
  runFixture(
    "parallel units with same file fail orchestration check",
    orchestrationOverlap,
    "check-parallel-orchestration.ts",
    1,
    "orchestration.parallel_file_overlap",
  );

  const orchestrationAgentGit = makeFixture("orchestration-agent-git");
  const orchestrationAgentGitState = readState(orchestrationAgentGit);
  orchestrationAgentGitState["orchestration"] = {
    preflight_done: true,
    strategy: "parallel_subagents",
    rationale: "A spawned worker is assigned an isolated patch.",
    integration_owner: "orchestrator",
    manager_pattern: true,
    file_overlap_checked: true,
    actual_file_collision_check: false,
    agent_outputs_reviewed: false,
    state_reconciled: false,
    candidate_units: [
      {
        id: "worker-doc",
        role: "worker",
        objective: "Patch one isolated doc.",
        mode: "edit",
        files: ["docs/worker.md"],
        shared_resources: [],
        parallel_safe: true,
        status: "pending",
      },
    ],
    parallel_safe_units: ["worker-doc"],
    serialized_units: ["PROJECT_STATE.yaml updates", "git staging, commits, merges, pushes, and releases"],
    spawned_agents: [
      {
        id: "agent-worker",
        role: "worker",
        objective: "Patch one isolated doc.",
        mode: "edit",
        status: "running",
        forbidden_actions: ["provider mutation"],
      },
    ],
    focused_validators_run: [],
    full_suites_run: [],
  };
  writeState(orchestrationAgentGit, orchestrationAgentGitState);
  runFixture(
    "spawned agent without git forbidden actions fails",
    orchestrationAgentGit,
    "check-parallel-orchestration.ts",
    1,
    "orchestration.spawned_agents.0.forbidden_actions.git_missing",
  );

  const orchestrationUnreviewed = makeFixture("orchestration-unreviewed");
  writeCompleteOrchestration(orchestrationUnreviewed);
  const orchestrationUnreviewedState = readState(orchestrationUnreviewed);
  expectRecord(orchestrationUnreviewedState["orchestration"], "orchestration")["agent_outputs_reviewed"] = false;
  expectRecord(orchestrationUnreviewedState["orchestration"], "orchestration")["actual_file_collision_check"] = false;
  writeState(orchestrationUnreviewed, orchestrationUnreviewedState);
  runFixture(
    "done spawned-agent orchestration without review fails",
    orchestrationUnreviewed,
    "check-parallel-orchestration.ts",
    1,
    "orchestration.done_without_agent_review",
  );

  const orchestrationPermissivePrompt = makeFixture("orchestration-permissive-prompt");
  writeFileSync(
    path.join(orchestrationPermissivePrompt, "ORCHESTRATION.md"),
    [
      "# Orchestration",
      "Orchestration Preflight",
      "Strategy",
      "Candidate Units",
      "Parallel Safety Check",
      "File Ownership",
      "Serialized Work",
      "Subagent Instructions: subagents may stage and commit their changes after they finish.",
      "Integration Plan",
      "Verification",
      "Founder-Only Gates",
      "State Updates",
      "Failure Cards",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "subagent git authority in prompt fails",
    orchestrationPermissivePrompt,
    "check-parallel-orchestration.ts",
    1,
    "orchestration.subagent_git_authority",
  );

  const compoundComplete = makeFixture("compound-complete");
  writeCompleteCompoundEngineering(compoundComplete);
  runFixture("complete Compound Engineering route passes", compoundComplete, "check-compound-engineering-routing.ts", 0);

  const compoundSkipped = makeFixture("compound-skipped");
  {
    const state = readState(compoundSkipped);
    getLane(state, "engineering")["status"] = "done";
    writeState(compoundSkipped, state);
  }
  writeFileSync(path.join(compoundSkipped, "ENGINEERING_PLAN.md"), "# Engineering Plan\n\nGeneric implementation checklist.\n", "utf8");
  runFixture(
    "core engineering without Compound Engineering route fails",
    compoundSkipped,
    "check-compound-engineering-routing.ts",
    1,
    "compound_engineering.not_evaluated",
  );

  const compoundFreshnessMissing = makeFixture("compound-freshness-missing");
  writeCompleteCompoundEngineering(compoundFreshnessMissing);
  {
    const state = readState(compoundFreshnessMissing);
    const compound = expectRecord(state["compound_engineering"], "compound_engineering");
    const latestCheck = expectRecord(compound["latest_check"], "compound_engineering.latest_check");
    latestCheck["status"] = "not_checked";
    writeState(compoundFreshnessMissing, state);
  }
  runFixture(
    "Compound Engineering route without freshness check fails",
    compoundFreshnessMissing,
    "check-compound-engineering-routing.ts",
    1,
    "compound_engineering.latest_check.not_checked",
  );

  const sourceRegistryMissing = makeEmptyFixture("source-registry-missing-url");
  writeSourceRegistryFixture(sourceRegistryMissing, false);
  runFixture("unregistered external source fails source freshness", sourceRegistryMissing, "check-source-freshness.ts", 1, "source_freshness.url_unregistered");

  const designRoomMissingRender = makeFixture("design-room-missing-render");
  rmSync(path.join(designRoomMissingRender, "design-room.html"), { force: true });
  runFixture("Design Room state without render fails", designRoomMissingRender, "check-design-room-contract.ts", 1, "design_room.render_missing");

  const designRoomFreeform = makeFixture("design-room-freeform-proposal");
  writeFileSync(path.join(designRoomFreeform, "design-proposal.html"), "<!doctype html><html><body>New idea</body></html>", "utf8");
  runFixture(
    "freeform design proposal fails Design Room contract",
    designRoomFreeform,
    "check-design-room-contract.ts",
    1,
    "design_room.freeform_design_artifact",
  );

  const controlPlaneMissing = makeFixture("control-plane-missing-panel");
  {
    const designStatePath = path.join(controlPlaneMissing, "state", "business.json");
    const designState = JSON.parse(readFileSync(designStatePath, "utf8")) as MutableRecord;
    const controlPlane = expectRecord(designState["controlPlane"], "controlPlane");
    controlPlane["panels"] = [];
    writeFileSync(designStatePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
  }
  runFixture("Control Plane without required panels fails", controlPlaneMissing, "check-control-plane-contract.ts", 1, "control_plane.design-room.missing");

  const providerProofMissing = makeFixture("provider-proof-missing");
  {
    const state = readState(providerProofMissing);
    const revenue = getLane(state, "revenue");
    revenue["status"] = "done";
    revenue["evidence"] = ["REVENUE_OPS.md"];
    writeState(providerProofMissing, state);
    rmSync(path.join(providerProofMissing, "PROVIDER_PROOF.md"), { force: true });
  }
  runFixture("provider-backed done lane without proof fails", providerProofMissing, "check-live-provider-proof.ts", 1, "provider_proof.file_missing");

  const providerProofContradiction = makeFixture("provider-proof-contradiction");
  writeFileSync(
    path.join(providerProofContradiction, "PROVIDER_PROOF.md"),
    [
      "# Provider Proof",
      "Status: verified but pending founder-only blocker.",
      "PostHog RevenueCat Resend App Store Connect Sentry MobAI Doppler current status proof command evidence path founder-only",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "provider proof ready claim with open blocker fails",
    providerProofContradiction,
    "check-live-provider-proof.ts",
    1,
    "provider_proof.ready_claim_with_blocker",
  );

  // Ledger grounding: once a mapped lane is done, the provider row's evidence
  // path must exist on disk and its status must read as captured evidence.
  const providerProofGrounded = makeFixture("provider-proof-grounded");
  {
    const state = readState(providerProofGrounded);
    const analytics = getLane(state, "analytics_attribution");
    analytics["status"] = "done";
    analytics["evidence"] = ["ANALYTICS.md", "analytics/posthog-proof.md"];
    writeState(providerProofGrounded, state);
    writeCompleteProviderProof(providerProofGrounded);
    mkdirSync(path.join(providerProofGrounded, "analytics"), { recursive: true });
    writeFileSync(path.join(providerProofGrounded, "analytics", "posthog-proof.md"), "Captured live event and person property on 2026-07-07.\n", "utf8");
  }
  runFixture("provider proof with on-disk evidence for done lane passes", providerProofGrounded, "check-live-provider-proof.ts", 0);

  const providerProofUngrounded = makeFixture("provider-proof-ungrounded");
  {
    const state = readState(providerProofUngrounded);
    const analytics = getLane(state, "analytics_attribution");
    analytics["status"] = "done";
    analytics["evidence"] = ["ANALYTICS.md"];
    writeState(providerProofUngrounded, state);
    writeCompleteProviderProof(providerProofUngrounded);
  }
  runFixture(
    "provider proof whose evidence path does not exist fails",
    providerProofUngrounded,
    "check-live-provider-proof.ts",
    1,
    "provider_proof.posthog.evidence_path_missing",
  );

  // Regression (verification pass): a literal pipe in the proof-command cell
  // shifts naive positional column parsing; the whole row is scanned instead.
  const providerProofPipedCommand = makeFixture("provider-proof-piped-command");
  {
    const state = readState(providerProofPipedCommand);
    const analytics = getLane(state, "analytics_attribution");
    analytics["status"] = "done";
    analytics["evidence"] = ["ANALYTICS.md", "analytics/posthog-proof.md"];
    writeState(providerProofPipedCommand, state);
    writeCompleteProviderProof(providerProofPipedCommand);
    const proofPath = path.join(providerProofPipedCommand, "PROVIDER_PROOF.md");
    const withPipedCommand = readFileSync(proofPath, "utf8").replace(
      "| PostHog | event and person property captured | inspect dashboard/API | analytics/posthog-proof.md |",
      "| PostHog | event and person property captured | curl api.posthog.com \\| jq .results | analytics/posthog-proof.md |",
    );
    writeFileSync(proofPath, withPipedCommand, "utf8");
    mkdirSync(path.join(providerProofPipedCommand, "analytics"), { recursive: true });
    writeFileSync(path.join(providerProofPipedCommand, "analytics", "posthog-proof.md"), "Captured live event on 2026-07-07.\n", "utf8");
  }
  runFixture("provider proof row with a piped proof command still grounds", providerProofPipedCommand, "check-live-provider-proof.ts", 0);

  // Regression (verification pass): the shipped PRODUCTION_READINESS.md
  // template's cautionary boilerplate ("Do not mark this app launch-ready
  // until ...") must not hard-fail a repo where no lane is done yet.
  const providerProofEarlyRepo = makeFixture("provider-proof-early-repo");
  rmSync(path.join(providerProofEarlyRepo, "PROVIDER_PROOF.md"), { force: true });
  runFixture("readiness boilerplate without done lanes does not hard-fail provider proof", providerProofEarlyRepo, "check-live-provider-proof.ts", 0);

  const providerProofStaleStatus = makeFixture("provider-proof-stale-status");
  {
    const state = readState(providerProofStaleStatus);
    const analytics = getLane(state, "analytics_attribution");
    analytics["status"] = "done";
    analytics["evidence"] = ["ANALYTICS.md"];
    writeState(providerProofStaleStatus, state);
    // Keep the shipped template ledger: its PostHog status still reads "needs
    // live event and person-property evidence", which cannot back a done lane.
  }
  runFixture(
    "provider proof with still-planned ledger status fails",
    providerProofStaleStatus,
    "check-live-provider-proof.ts",
    1,
    "provider_proof.posthog.status_unproven",
  );

  const artifactTemplateGap = makeFixture("artifact-template-gap");
  {
    const state = readState(artifactTemplateGap);
    const design = getLane(state, "design");
    design["evidence"] = ["MISSING_TEMPLATE_STARTER.md"];
    writeState(artifactTemplateGap, state);
  }
  runFixture("template evidence without starter fails", artifactTemplateGap, "check-artifact-templates.ts", 1, "artifact_templates.design.starter_missing", [
    "--skill-root",
    skillRoot,
  ]);

  const artifactTemplatePathDrift = makeFixture("artifact-template-path-drift");
  {
    const state = readState(artifactTemplatePathDrift);
    const design = getLane(state, "design");
    design["evidence"] = ["UX_PATTERNS.md"];
    writeState(artifactTemplatePathDrift, state);
  }
  runFixture("template evidence basename drift fails", artifactTemplatePathDrift, "check-artifact-templates.ts", 1, "no exact starter template path", [
    "--skill-root",
    skillRoot,
  ]);

  const agentEvalGap = makeEmptyFixture("agent-eval-gap");
  runFixture("too few agent behavior evals fail", agentEvalGap, "run-agent-evals.ts", 1, "agent_evals.too_few");

  const tokenPromotionStale = makeFixture("token-promotion-stale");
  {
    const tokensPath = path.join(tokenPromotionStale, "state", "theme.tokens.json");
    const tokens = JSON.parse(readFileSync(tokensPath, "utf8")) as MutableRecord;
    const tokenRoot = expectRecord(tokens["tokens"], "tokens");
    expectRecord(tokenRoot["color"], "tokens.color")["primary"] = "#123456";
    writeFileSync(tokensPath, `${JSON.stringify(tokens, null, 2)}\n`, "utf8");
  }
  runFixture("stale promoted design tokens fail", tokenPromotionStale, "check-token-promotion.ts", 1, "token_promotion.json_stale");

  const staleSkillVersion = makeEmptyFixture("stale-skill-version");
  const latestSkillRoot = path.join(staleSkillVersion, "latest");
  const installedSkillRoot = path.join(staleSkillVersion, "installed");
  mkdirSync(latestSkillRoot, { recursive: true });
  mkdirSync(installedSkillRoot, { recursive: true });
  writeFileSync(
    path.join(latestSkillRoot, "skill-version.json"),
    JSON.stringify({ skill: "b2c-mobile-business-launch", version: "0.2.0", updatedAt: "2026-05-30" }, null, 2),
    "utf8",
  );
  writeFileSync(
    path.join(installedSkillRoot, "skill-version.json"),
    JSON.stringify({ skill: "b2c-mobile-business-launch", version: "0.1.0", updatedAt: "2026-05-01" }, null, 2),
    "utf8",
  );
  runFixture("stale installed skill version fails", staleSkillVersion, "check-skill-version.ts", 1, "skill_version.stale", [
    "--source",
    latestSkillRoot,
    "--installed",
    installedSkillRoot,
  ]);
}
