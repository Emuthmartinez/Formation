import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  type Harness,
  type MutableRecord,
  expectRecord,
  getLane,
  readState,
  skillRoot,
  writeCompleteCompoundEngineering,
  writeCompleteOrchestration,
  writeCompleteProviderProof,
  writeSourceRegistryFixture,
  writeState,
} from "./_harness.js";

export function register(h: Harness): void {
  const { makeFixture, makeEmptyFixture, runFixture } = h;

  const orchestrationNoPreflight = makeFixture("orchestration-no-preflight");
  const orchestrationNoPreflightState = readState(orchestrationNoPreflight);
  const noPreflightLane = getLane(orchestrationNoPreflightState, "orchestration");
  noPreflightLane["status"] = "done";
  noPreflightLane["evidence"] = ["orchestration/operations/ORCHESTRATION.md", "orchestration/operations/orchestration.html"];
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
        files: ["engineering/ENGINEERING_PLAN.md"],
        shared_resources: [],
        parallel_safe: true,
        status: "pending",
      },
      {
        id: "revenue-doc",
        role: "engineering leader",
        objective: "Update revenue plan.",
        mode: "edit",
        files: ["engineering/ENGINEERING_PLAN.md"],
        shared_resources: [],
        parallel_safe: true,
        status: "pending",
      },
    ],
    parallel_safe_units: ["analytics-doc", "revenue-doc"],
    serialized_units: ["state/PROJECT_STATE.yaml updates", "git staging, commits, merges, pushes, and releases"],
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

  const orchestrationManagerWithoutDispatch = makeFixture("orchestration-manager-without-dispatch");
  const managerWithoutDispatchState = readState(orchestrationManagerWithoutDispatch);
  const managerWithoutDispatch = expectRecord(managerWithoutDispatchState["orchestration"], "orchestration");
  managerWithoutDispatch["preflight_done"] = true;
  managerWithoutDispatch["strategy"] = "inline";
  managerWithoutDispatch["rationale"] = "The orchestrator chose a manager pattern for broad work.";
  delete managerWithoutDispatch["dispatch_reason"];
  managerWithoutDispatch["spawned_agents"] = [];
  writeState(orchestrationManagerWithoutDispatch, managerWithoutDispatchState);
  runFixture(
    "manager pattern without dispatch evidence or reason fails",
    orchestrationManagerWithoutDispatch,
    "check-parallel-orchestration.ts",
    1,
    "orchestration.manager_dispatch_missing",
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
    serialized_units: ["state/PROJECT_STATE.yaml updates", "git staging, commits, merges, pushes, and releases"],
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
    path.join(orchestrationPermissivePrompt, "operations/ORCHESTRATION.md"),
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
  writeFileSync(path.join(compoundSkipped, "engineering/ENGINEERING_PLAN.md"), "# Engineering Plan\n\nGeneric implementation checklist.\n", "utf8");
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
  rmSync(path.join(designRoomMissingRender, "design/design-room.html"), { force: true });
  runFixture("Design Room state without render fails", designRoomMissingRender, "check-design-room-contract.ts", 1, "design_room.render_missing");

  // The audience-derivation contract: a design.md without the Audience And
  // Identity section, or one whose section never cites strategy/RESEARCH.md,
  // is the generic-template failure the section exists to block.
  const designRoomAudienceMissing = makeFixture("design-room-audience-section-missing");
  {
    const contractPath = path.join(designRoomAudienceMissing, "design/design.md");
    const contract = readFileSync(contractPath, "utf8").replace(/^## Audience And Identity$/m, "## Audience Notes");
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "design.md without the Audience And Identity section fails",
    designRoomAudienceMissing,
    "check-design-room-contract.ts",
    1,
    "design_room.contract_section_missing",
  );

  // The realistic middle case: the template's boilerplate sentence (which
  // itself names strategy/RESEARCH.md) stays intact while a real derivation
  // row is authored WITHOUT a research citation — the check must read the
  // table's Evidence cells, not the section prose, or untouched boilerplate
  // satisfies it forever.
  const audienceTemplateRow = "| Not defined | Not defined | Not defined | Not captured |";
  const designRoomAudienceUntraced = makeFixture("design-room-audience-untraced");
  {
    const contractPath = path.join(designRoomAudienceUntraced, "design/design.md");
    const contract = readFileSync(contractPath, "utf8").replace(
      audienceTemplateRow,
      "| Runners check pace at arm's length | Dark canvas, large numerals | color.background | the team's taste |",
    );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "authored audience row without research evidence fails",
    designRoomAudienceUntraced,
    "check-design-room-contract.ts",
    1,
    "design_room.audience_research_missing",
  );

  const designRoomAudienceTraced = makeFixture("design-room-audience-traced");
  {
    const contractPath = path.join(designRoomAudienceTraced, "design/design.md");
    const contract = readFileSync(contractPath, "utf8").replace(
      audienceTemplateRow,
      "| Runners check pace at arm's length | Dark canvas, large numerals | color.background | strategy/RESEARCH.md R4 |",
    );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture("authored audience row citing research passes", designRoomAudienceTraced, "check-design-room-contract.ts", 0);

  const designRoomNestedEvidence = makeFixture("design-room-nested-reference-evidence");
  {
    const contractPath = path.join(designRoomNestedEvidence, "design/design.md");
    const contract = readFileSync(contractPath, "utf8").replace("## Reference Evidence", "### Reference Evidence");
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture("nested Reference Evidence does not become an authored audience row", designRoomNestedEvidence, "check-design-room-contract.ts", 0);

  const designRoomAudienceTableGone = makeFixture("design-room-audience-table-gone");
  {
    const contractPath = path.join(designRoomAudienceTableGone, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("| Audience fact | Decision it produced | Token or direction | Evidence |", "")
      .replace("| --- | --- | --- | --- |\n| Not defined | Not defined | Not defined | Not captured |", "");
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "Audience And Identity without a derivation table fails",
    designRoomAudienceTableGone,
    "check-design-room-contract.ts",
    1,
    "design_room.audience_research_missing",
  );

  const designRoomEvidenceSourceMissing = makeFixture("design-room-reference-evidence-source-missing");
  {
    const contractPath = path.join(designRoomEvidenceSourceMissing, "design/design.md");
    const contract = readFileSync(contractPath, "utf8").replace(
      /^\| UI Playbook \|.*$/m,
      "| Component reference omitted | Not reviewed | Not defined | Not defined | Not recorded |",
    );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "Reference Evidence without all six source rows fails",
    designRoomEvidenceSourceMissing,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_source_missing",
  );

  const designRoomEvidenceHeadingVariant = makeFixture("design-room-reference-evidence-heading-variant");
  {
    const contractPath = path.join(designRoomEvidenceHeadingVariant, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("## Reference Evidence", "### reference evidence")
      .replace(/^\| UI Playbook \|.*$/m, "| Component reference omitted | Not reviewed | Not defined | Not defined | Not recorded |");
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "case-insensitive H3 Reference Evidence still validates source rows",
    designRoomEvidenceHeadingVariant,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_source_missing",
  );

  const designRoomEvidenceStatusesUnreviewed = makeFixture("design-room-reference-evidence-statuses-unreviewed");
  {
    const statePath = path.join(designRoomEvidenceStatusesUnreviewed, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
  }
  runFixture(
    "review-ready Reference Evidence rejects Not reviewed statuses",
    designRoomEvidenceStatusesUnreviewed,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_status_invalid",
  );

  const designRoomSeededTriageReasons = makeFixture("design-room-reference-evidence-seeded-triage-reasons");
  {
    const statePath = path.join(designRoomSeededTriageReasons, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomSeededTriageReasons, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: small token-preserving correction")
      .replace("Change scope: Not defined", "Change scope: profile.settings")
      .replaceAll("| Not reviewed |", "| not applicable |");
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "seeded Reference Evidence triage instructions are not authored reasons",
    designRoomSeededTriageReasons,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_triage_incomplete",
  );

  const designRoomAdoptionHeaderMissing = makeFixture("design-room-reference-evidence-adoption-header-missing");
  {
    const statePath = path.join(designRoomAdoptionHeaderMissing, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomAdoptionHeaderMissing, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace("| Surface or decision | Source | Observation |", "| Surface or decision | Evidence source | Observation |");
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "Reference Evidence validates adoption headers against the adoption table",
    designRoomAdoptionHeaderMissing,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_table_invalid",
  );

  const designRoomMutatingEvidenceUnreviewed = makeFixture("design-room-mutating-reference-evidence-unreviewed");
  {
    const statePath = path.join(designRoomMutatingEvidenceUnreviewed, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "mutating";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
  }
  runFixture(
    "an active mutating Design Room validates evidence before mutation",
    designRoomMutatingEvidenceUnreviewed,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_status_invalid",
  );

  const designRoomHighImpactWithoutEvidence = makeFixture("design-room-high-impact-without-evidence");
  {
    const statePath = path.join(designRoomHighImpactWithoutEvidence, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomHighImpactWithoutEvidence, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: new or materially changed surface")
      .replace("Change scope: Not defined", "Change scope: paywall.primary")
      .replaceAll("| Not reviewed |", "| not applicable |");
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "a classified high-impact change cannot pass with every source not applicable",
    designRoomHighImpactWithoutEvidence,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_change_sources_missing",
  );

  const designRoomSmallCorrectionWithoutEvidence = makeFixture("design-room-small-correction-without-evidence");
  {
    const statePath = path.join(designRoomSmallCorrectionWithoutEvidence, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomSmallCorrectionWithoutEvidence, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: small token-preserving correction")
      .replace("Change scope: Not defined", "Change scope: success.color-token")
      .replaceAll("| Not reviewed |", "| not applicable |");
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "a classified small token correction can skip live evidence",
    designRoomSmallCorrectionWithoutEvidence,
    "check-design-room-contract.ts",
    1,
    "design_room.contract_placeholder",
    [],
    undefined,
    "design_room.reference_evidence_change_sources_missing",
  );

  const designRoomEvidenceRequiredIncomplete = makeFixture("design-room-reference-evidence-required-incomplete");
  {
    const statePath = path.join(designRoomEvidenceRequiredIncomplete, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomEvidenceRequiredIncomplete, "design/design.md");
    const contract = readFileSync(contractPath, "utf8").replaceAll("| Not reviewed |", "| required |");
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "required Reference Evidence needs an authored query and ISO evidence date",
    designRoomEvidenceRequiredIncomplete,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_triage_incomplete",
  );

  for (const [label, evidenceDate] of [
    ["impossible", "2026-99-99"],
    ["future", "2999-01-01"],
  ] as const) {
    const designRoomEvidenceInvalidDate = makeFixture(`design-room-reference-evidence-${label}-date`);
    const statePath = path.join(designRoomEvidenceInvalidDate, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomEvidenceInvalidDate, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| 60fps\.design \|.*$/m, `| 60fps.design | required | Motion proof is needed. | success transition | ${evidenceDate} |`);
    writeFileSync(contractPath, contract, "utf8");
    runFixture(
      `required Reference Evidence rejects an ${label} date`,
      designRoomEvidenceInvalidDate,
      "check-design-room-contract.ts",
      1,
      "design_room.reference_evidence_triage_incomplete",
    );
  }

  const designRoomEvidenceAdoptionMissing = makeFixture("design-room-reference-evidence-adoption-missing");
  {
    const statePath = path.join(designRoomEvidenceAdoptionMissing, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "baselined";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomEvidenceAdoptionMissing, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| 60fps\.design \|.*$/m, "| 60fps.design | required | Motion proof is needed. | success transition | 2026-08-20 |")
      .replace("| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |", "");
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "review-ready Reference Evidence needs a complete adoption row",
    designRoomEvidenceAdoptionMissing,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_adoption_missing",
  );

  const designRoomRequiredSourceMissing = makeFixture("design-room-reference-evidence-required-source-missing");
  {
    const statePath = path.join(designRoomRequiredSourceMissing, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomRequiredSourceMissing, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| 60fps\.design \|.*$/m, "| 60fps.design | required | Motion proof is needed. | success transition | 2026-08-20 |")
      .replace(/^\| catalogue\.projectsbyif\.com \|.*$/m, "| catalogue.projectsbyif.com | required | Trust proof is needed. | consent recovery | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Onboarding success | 60fps.design | A short state transition preserves context. | Adopt | Use the timing but keep Formation tokens. | designRoom.surfaces.onboarding | Device motion review | onboarding.primary |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "each required Reference Evidence source needs a complete adoption row",
    designRoomRequiredSourceMissing,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_required_source_missing",
  );

  const designRoomHighImpactSecondSourceMissing = makeFixture("design-room-reference-evidence-high-impact-second-source-missing");
  {
    const statePath = path.join(designRoomHighImpactSecondSourceMissing, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomHighImpactSecondSourceMissing, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| 60fps\.design \|.*$/m, "| 60fps.design | required | Motion proof is needed. | success transition | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Onboarding success | 60fps.design | A short state transition preserves context. | Adopt | Use the timing but keep Formation tokens. | designRoom.surfaces.onboarding | Device motion review | onboarding.primary |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "a high-impact decision needs two complementary evidence sources",
    designRoomHighImpactSecondSourceMissing,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_high_impact_sources_missing",
  );

  const designRoomStoreFirstFrames = makeFixture("design-room-reference-evidence-store-first-frames");
  {
    const statePath = path.join(designRoomStoreFirstFrames, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomStoreFirstFrames, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| Design Spells \|.*$/m, "| Design Spells | required | Store craft proof is needed. | first frames | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| First frames of a store listing | Design Spells | The opening composition shows the product outcome. | Adopt | Use the product's own visual language. | designRoom.surfaces.store | Store frame review | store.first-frame |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "plural store first-frame wording still requires complementary evidence",
    designRoomStoreFirstFrames,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_high_impact_sources_missing",
  );

  for (const conversionTask of ["Checkout", "Retention", "Referral"]) {
    const slug = conversionTask.toLowerCase();
    const designRoomConversionPair = makeFixture(`design-room-reference-evidence-${slug}-pair`);
    const statePath = path.join(designRoomConversionPair, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomConversionPair, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| abtest\.design \|.*$/m, `| abtest.design | required | ${conversionTask} proof is needed. | ${slug} pattern | 2026-08-20 |`)
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        `| ${conversionTask} decision | abtest.design | An external result suggests a hypothesis. | Adopt | Test it locally. | designRoom.surfaces.${slug} | Conversion experiment | ${slug}.primary |`,
      );
    writeFileSync(contractPath, contract, "utf8");
    runFixture(
      `${conversionTask} decisions require the routed complementary source pair`,
      designRoomConversionPair,
      "check-design-room-contract.ts",
      1,
      "design_room.reference_evidence_high_impact_sources_missing",
    );
  }

  const designRoomHighImpactSameLane = makeFixture("design-room-reference-evidence-high-impact-same-lane");
  {
    const statePath = path.join(designRoomHighImpactSameLane, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomHighImpactSameLane, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| 60fps\.design \|.*$/m, "| 60fps.design | required | Motion proof is needed. | success transition | 2026-08-20 |")
      .replace(/^\| Design Spells \|.*$/m, "| Design Spells | required | Delight proof is needed. | success feedback | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Onboarding success | 60fps.design | A short transition preserves context. | Adopt | Use Formation timing tokens. | designRoom.surfaces.onboarding | Device motion review | onboarding.primary |\n| Onboarding success | Design Spells | A small success moment adds personality. | Adopt | Use the product's own visual language. | designRoom.surfaces.onboarding | Audience review | onboarding.primary |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "two craft sources do not satisfy complementary onboarding evidence",
    designRoomHighImpactSameLane,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_high_impact_sources_missing",
  );

  const designRoomAiTrustWithoutIf = makeFixture("design-room-reference-evidence-ai-trust-without-if");
  {
    const statePath = path.join(designRoomAiTrustWithoutIf, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomAiTrustWithoutIf, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| UXSnaps \|.*$/m, "| UXSnaps | required | AI trust flow proof is needed. | consent recovery | 2026-08-20 |")
      .replace(/^\| Design Spells \|.*$/m, "| Design Spells | required | AI trust craft proof is needed. | consent feedback | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| AI trust decision | UXSnaps | A recovery flow preserves context. | Adopt | Keep the recovery path explicit. | designRoom.surfaces.core | Scenario review | ai-trust.primary |\n| AI trust decision | Design Spells | Feedback makes the state change visible. | Adopt | Use restrained product feedback. | designRoom.surfaces.core | Audience review | ai-trust.primary |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "AI trust evidence requires the IF Design Patterns Catalogue plus a complementary source",
    designRoomAiTrustWithoutIf,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_high_impact_sources_missing",
  );

  const designRoomCoreLoopWithoutUxSnaps = makeFixture("design-room-reference-evidence-core-loop-without-uxsnaps");
  {
    const statePath = path.join(designRoomCoreLoopWithoutUxSnaps, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomCoreLoopWithoutUxSnaps, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: high-impact or high-risk surface")
      .replace("Change scope: Not defined", "Change scope: core-loop.primary")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| 60fps\.design \|.*$/m, "| 60fps.design | required | Core-loop motion proof is needed. | state transition | 2026-08-20 |")
      .replace(
        /^\| catalogue\.projectsbyif\.com \|.*$/m,
        "| catalogue.projectsbyif.com | required | Core-loop structure proof is needed. | user control | 2026-08-20 |",
      )
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Core loop | catalogue.projectsbyif.com | The flow keeps user control visible. | Adopt | Keep the state boundary explicit. | designRoom.surfaces.core | Scenario review | core-loop.primary |\n| Core loop | 60fps.design | The transition preserves context. | Adopt | Use Formation motion tokens. | designRoom.surfaces.core | Device review | core-loop.primary |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "core-loop evidence requires UXSnaps plus a complementary source",
    designRoomCoreLoopWithoutUxSnaps,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_high_impact_sources_missing",
  );

  for (const [label, decision] of [
    ["consent", "Consent decision"],
    ["authentication", "Authentication decision"],
    ["permissions", "Permissions decision"],
    ["sensitive-data", "Sensitive data decision"],
  ] as const) {
    const designRoomTrustWithoutIf = makeFixture(`design-room-reference-evidence-${label}-without-if`);
    const statePath = path.join(designRoomTrustWithoutIf, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomTrustWithoutIf, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| UI Playbook \|.*$/m, `| UI Playbook | required | ${decision} component proof is needed. | trust component | 2026-08-20 |`)
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        `| ${decision} | UI Playbook | The component exposes the current state. | Adopt | Keep the state explicit. | designRoom.surfaces.core | Scenario review | ai-trust.primary |`,
      );
    writeFileSync(contractPath, contract, "utf8");
    runFixture(
      `${decision} evidence requires the IF Design Patterns Catalogue`,
      designRoomTrustWithoutIf,
      "check-design-room-contract.ts",
      1,
      "design_room.reference_evidence_high_impact_sources_missing",
    );
  }

  const designRoomIncompleteEvidenceRow = makeFixture("design-room-reference-evidence-incomplete-row");
  {
    const statePath = path.join(designRoomIncompleteEvidenceRow, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomIncompleteEvidenceRow, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Paywall choice | abtest.design | Price framing is a local hypothesis. | Adopt | Test with the target audience. | designRoom.surfaces.paywall | | paywall.primary |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "a declared evidence row cannot omit a required field",
    designRoomIncompleteEvidenceRow,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_adoption_incomplete",
  );

  const designRoomRejectedEvidence = makeFixture("design-room-reference-evidence-rejected-row");
  {
    const statePath = path.join(designRoomRejectedEvidence, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomRejectedEvidence, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| Design Spells \|.*$/m, "| Design Spells | required | Delight proof is needed. | success flourish | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Success feedback | Design Spells | A decorative flourish competes with the result. | Reject — it delays comprehension. | | | Audience review | success.primary |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "rejected evidence needs a rationale but no mutation fields",
    designRoomRejectedEvidence,
    "check-design-room-contract.ts",
    1,
    "design_room.contract_placeholder",
    [],
    undefined,
    "design_room.reference_evidence_adoption_incomplete",
  );

  const designRoomAmbiguousAdopt = makeFixture("design-room-reference-evidence-ambiguous-adopt");
  {
    const statePath = path.join(designRoomAmbiguousAdopt, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomAmbiguousAdopt, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| Design Spells \|.*$/m, "| Design Spells | required | Delight proof is needed. | success flourish | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Success feedback | Design Spells | A small flourish could reinforce completion. | Adopt later | Use a short flourish. | designRoom.surfaces.success | Audience review | success.primary |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "ambiguous adopt text is not an explicit decision",
    designRoomAmbiguousAdopt,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_adoption_incomplete",
  );

  const designRoomStaleEvidenceRows = makeFixture("design-room-reference-evidence-stale-rows");
  {
    const statePath = path.join(designRoomStaleEvidenceRows, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomStaleEvidenceRows, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Onboarding sequence | abtest.design | A shorter sequence improved activation elsewhere. | Adopt | Test locally. | designRoom.surfaces.onboarding | Conversion experiment | onboarding.primary |\n| Onboarding first-value step | UXSnaps | The first value arrives before permission. | Adopt | Preserve that order. | designRoom.surfaces.onboarding | Journey review | onboarding.primary |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "stale evidence rows do not count when their sources are not required",
    designRoomStaleEvidenceRows,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_high_impact_sources_missing",
  );

  const designRoomStableSurfaceCategory = makeFixture("design-room-reference-evidence-stable-surface-category");
  {
    const statePath = path.join(designRoomStableSurfaceCategory, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomStableSurfaceCategory, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| abtest\.design \|.*$/m, "| abtest.design | required | Conversion proof is needed. | first value | 2026-08-20 |")
      .replace(/^\| UXSnaps \|.*$/m, "| UXSnaps | required | Journey proof is needed. | onboarding order | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Onboarding sequence | abtest.design | A shorter sequence improved activation elsewhere. | Adopt | Test locally. | designRoom.surfaces.onboarding | Conversion experiment | onboarding.primary |\n| Onboarding first-value step | UXSnaps | The first value arrives before permission. | Adopt | Preserve that order. | designRoom.surfaces.onboarding | Journey review | onboarding.primary |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "different descriptions for one high-impact surface share a stable category",
    designRoomStableSurfaceCategory,
    "check-design-room-contract.ts",
    1,
    "design_room.contract_placeholder",
    [],
    undefined,
    "design_room.reference_evidence_high_impact_sources_missing",
  );

  const designRoomSameSurfaceDifferentPaths = makeFixture("design-room-reference-evidence-same-surface-different-paths");
  {
    const statePath = path.join(designRoomSameSurfaceDifferentPaths, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomSameSurfaceDifferentPaths, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: high-impact or high-risk surface")
      .replace("Change scope: Not defined", "Change scope: onboarding.primary")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| abtest\.design \|.*$/m, "| abtest.design | required | Onboarding proof is needed. | first value | 2026-08-20 |")
      .replace(/^\| UXSnaps \|.*$/m, "| UXSnaps | required | Journey proof is needed. | onboarding order | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| First-value sequence | abtest.design | A shorter sequence supplies a hypothesis. | Adopt | Test the sequence locally. | surfaces.mobileApp.flows[0].steps | Conversion experiment | onboarding.primary |\n| First-value sequence | UXSnaps | The journey preserves context. | Adopt | Preserve the screen order. | surfaces.mobileApp.flows[0].screens | Journey review | onboarding.primary |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "one surface key groups complementary evidence across exact mutation paths",
    designRoomSameSurfaceDifferentPaths,
    "check-design-room-contract.ts",
    1,
    "design_room.contract_placeholder",
    [],
    undefined,
    "design_room.reference_evidence_high_impact_sources_missing",
  );

  const designRoomMultiSurfaceScope = makeFixture("design-room-reference-evidence-multi-surface-scope");
  {
    const statePath = path.join(designRoomMultiSurfaceScope, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomMultiSurfaceScope, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: high-impact or high-risk surface")
      .replace("Change scope: Not defined", "Change scope: onboarding.primary, paywall.primary")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| 60fps\.design \|.*$/m, "| 60fps.design | required | Transition proof is needed. | first value | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| First-value sequence | 60fps.design | The transition preserves context. | Adopt | Use Formation motion tokens. | surfaces.mobileApp.flows[0].steps | Device review | onboarding.primary |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "each category in a multi-surface scope needs its own routed evidence",
    designRoomMultiSurfaceScope,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_high_impact_sources_missing",
  );

  const designRoomMotionWrongSource = makeFixture("design-room-reference-evidence-motion-wrong-source");
  {
    const statePath = path.join(designRoomMotionWrongSource, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomMotionWrongSource, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: new or materially changed surface")
      .replace("Change scope: Not defined", "Change scope: motion.primary")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| UXSnaps \|.*$/m, "| UXSnaps | required | Motion journey proof is needed. | transition | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Result transition | UXSnaps | The journey preserves context. | Adopt | Preserve the destination. | surfaces.mobileApp.result | Journey review | motion.primary |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "ordinary motion work requires its routed 60fps.design source",
    designRoomMotionWrongSource,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_routed_sources_missing",
  );

  const designRoomMotionUnavailableFallback = makeFixture("design-room-reference-evidence-motion-unavailable-fallback");
  {
    const statePath = path.join(designRoomMotionUnavailableFallback, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomMotionUnavailableFallback, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: new or materially changed surface")
      .replace("Change scope: Not defined", "Change scope: motion.primary")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(
        /^\| 60fps\.design \|.*$/m,
        "| 60fps.design | unavailable | The live catalogue cannot be reached in this runtime. | Not applicable | Not applicable |",
      )
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Result transition | motion-craft-benchmarks.md | The distilled recipe preserves context during the state change. | Adopt | Use Formation motion tokens and reduced motion. | surfaces.mobileApp.result | Device motion review | motion.primary |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "an unavailable 60fps.design route accepts the documented distilled motion fallback",
    designRoomMotionUnavailableFallback,
    "check-design-room-contract.ts",
    1,
    "design_room.contract_placeholder",
    [],
    undefined,
    "design_room.reference_evidence_routed_sources_missing",
  );

  const designRoomSignInWrongSource = makeFixture("design-room-reference-evidence-sign-in-wrong-source");
  {
    const statePath = path.join(designRoomSignInWrongSource, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomSignInWrongSource, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: new or materially changed surface")
      .replace("Change scope: Not defined", "Change scope: sign-in.primary")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| UI Playbook \|.*$/m, "| UI Playbook | required | Standard input proof is needed. | sign-in form | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Sign-in form | UI Playbook | Standard controls preserve platform conventions. | Adopt | Use Formation input tokens. | surfaces.mobileApp.signIn | Device review | sign-in.primary |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "sign-in surfaces require their routed trust catalogue evidence",
    designRoomSignInWrongSource,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_routed_sources_missing",
  );

  const designRoomUnroutedSurfaceMismatch = makeFixture("design-room-reference-evidence-unrouted-surface-mismatch");
  {
    const statePath = path.join(designRoomUnroutedSurfaceMismatch, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomUnroutedSurfaceMismatch, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: new or materially changed surface")
      .replace("Change scope: Not defined", "Change scope: profile.settings")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| UI Playbook \|.*$/m, "| UI Playbook | required | Standard component proof is needed. | banner controls | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Marketing banner | UI Playbook | Standard controls preserve platform conventions. | Adopt | Use Formation control tokens. | surfaces.marketing.banner | Device review | marketing.banner |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "an unrouted ordinary surface cannot borrow a required row from another surface",
    designRoomUnroutedSurfaceMismatch,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_change_sources_missing",
  );

  const designRoomDelightUnavailableFallback = makeFixture("design-room-reference-evidence-delight-unavailable-fallback");
  {
    const statePath = path.join(designRoomDelightUnavailableFallback, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomDelightUnavailableFallback, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: new or materially changed surface")
      .replace("Change scope: Not defined", "Change scope: delight.success")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(
        /^\| Design Spells \|.*$/m,
        "| Design Spells | unavailable | The inspiration catalogue cannot be reached in this runtime. | Not applicable | Not applicable |",
      )
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Success feedback | emotional-design-system.md | Earned feedback should support comprehension before decoration. | Adopt | Use the product's own visual language. | surfaces.mobileApp.success | Audience review | delight.success |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "an unavailable Design Spells route accepts the documented emotional-design fallback",
    designRoomDelightUnavailableFallback,
    "check-design-room-contract.ts",
    1,
    "design_room.contract_placeholder",
    [],
    undefined,
    "design_room.reference_evidence_routed_sources_missing",
  );

  for (const [sourceName, scope, fallbackSource, decision] of [
    ["catalogue.projectsbyif.com", "account.recovery", "consumer-product-design-agency.md", "Account recovery"],
    ["abtest.design", "conversion.offer", "paywall-pricing-and-experiments.md", "Conversion offer"],
    ["UXSnaps", "journey.primary", "refero-ux-patterns.md", "Primary journey"],
    ["UI Playbook", "standard.input", "premium-mobile-craft.md", "Standard input"],
  ] as const) {
    const designRoomDoctrineFallback = makeFixture(`design-room-reference-evidence-${scope.replaceAll(".", "-")}-doctrine-fallback`);
    const statePath = path.join(designRoomDoctrineFallback, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomDoctrineFallback, "design/design.md");
    const escapedSource = sourceName.replaceAll(".", "\\.");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: new or materially changed surface")
      .replace("Change scope: Not defined", `Change scope: ${scope}`)
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(
        new RegExp(`^\\| ${escapedSource} \\|.*$`, "m"),
        `| ${sourceName} | unavailable | The routed catalogue cannot be reached in this runtime. | Not applicable | Not applicable |`,
      )
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        `| ${decision} | ${fallbackSource} | Formation doctrine defines the bounded behavior for this surface. | Adopt | Apply the doctrine with Formation tokens and local validation. | surfaces.mobileApp.primary | Scenario review | ${scope} |`,
      );
    writeFileSync(contractPath, contract, "utf8");
    runFixture(
      `${sourceName} unavailable accepts its applicable Formation doctrine fallback`,
      designRoomDoctrineFallback,
      "check-design-room-contract.ts",
      1,
      "design_room.contract_placeholder",
      [],
      undefined,
      "design_room.reference_evidence_routed_sources_missing",
    );
  }

  for (const [scope, decision] of [
    ["account.recovery", "Account recovery"],
    ["automation.takeover", "Automation takeover"],
    ["user-control.permissions", "User control permissions"],
  ] as const) {
    const designRoomTrustRouteMissing = makeFixture(`design-room-reference-evidence-${scope.replaceAll(".", "-")}-missing`);
    const statePath = path.join(designRoomTrustRouteMissing, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomTrustRouteMissing, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: new or materially changed surface")
      .replace("Change scope: Not defined", `Change scope: ${scope}`)
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| UI Playbook \|.*$/m, `| UI Playbook | required | ${decision} component proof is needed. | recovery control | 2026-08-20 |`)
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        `| ${decision} | UI Playbook | Standard controls expose the current state. | Adopt | Keep the state explicit. | surfaces.mobileApp.trust | Scenario review | ${scope} |`,
      );
    writeFileSync(contractPath, contract, "utf8");
    runFixture(
      `${decision} surfaces require their routed trust catalogue evidence`,
      designRoomTrustRouteMissing,
      "check-design-room-contract.ts",
      1,
      "design_room.reference_evidence_routed_sources_missing",
    );
  }

  for (const [scope, decision] of [
    ["engagement.streak", "Engagement streak"],
    ["monetization.offer", "Monetization offer"],
  ] as const) {
    const designRoomExperimentRouteMissing = makeFixture(`design-room-reference-evidence-${scope.replaceAll(".", "-")}-missing`);
    const statePath = path.join(designRoomExperimentRouteMissing, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomExperimentRouteMissing, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: new or materially changed surface")
      .replace("Change scope: Not defined", `Change scope: ${scope}`)
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| Design Spells \|.*$/m, `| Design Spells | required | ${decision} craft proof is needed. | feedback treatment | 2026-08-20 |`)
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        `| ${decision} | Design Spells | Feedback can make progress visible. | Adopt | Keep feedback subordinate to comprehension. | surfaces.mobileApp.growth | Audience review | ${scope} |`,
      );
    writeFileSync(contractPath, contract, "utf8");
    runFixture(
      `${decision} surfaces require their routed experiment evidence`,
      designRoomExperimentRouteMissing,
      "check-design-room-contract.ts",
      1,
      "design_room.reference_evidence_routed_sources_missing",
    );
  }

  const designRoomOfficialGuidanceFallback = makeFixture("design-room-reference-evidence-official-guidance-fallback");
  {
    const statePath = path.join(designRoomOfficialGuidanceFallback, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomOfficialGuidanceFallback, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: new or materially changed surface")
      .replace("Change scope: Not defined", "Change scope: standard.input")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(
        /^\| UI Playbook \|.*$/m,
        "| UI Playbook | unavailable | The component catalogue cannot be reached in this runtime. | Not applicable | Not applicable |",
      )
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Standard input | https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ | The combobox pattern defines keyboard and semantic behavior. | Adopt | Preserve native semantics and Formation tokens. | surfaces.mobileApp.input | Keyboard and screen-reader review | standard.input |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "an unavailable routed source accepts current official platform guidance",
    designRoomOfficialGuidanceFallback,
    "check-design-room-contract.ts",
    1,
    "design_room.contract_placeholder",
    [],
    undefined,
    "design_room.reference_evidence_routed_sources_missing",
  );

  const designRoomOneFallbackTwoLanes = makeFixture("design-room-reference-evidence-one-fallback-two-lanes");
  {
    const statePath = path.join(designRoomOneFallbackTwoLanes, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomOneFallbackTwoLanes, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: high-impact or high-risk surface")
      .replace("Change scope: Not defined", "Change scope: onboarding.primary")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(
        /^\| abtest\.design \|.*$/m,
        "| abtest.design | unavailable | The experiment catalogue cannot be reached in this runtime. | Not applicable | Not applicable |",
      )
      .replace(/^\| UXSnaps \|.*$/m, "| UXSnaps | unavailable | The journey catalogue cannot be reached in this runtime. | Not applicable | Not applicable |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Onboarding input | https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ | The combobox pattern defines keyboard and semantic behavior. | Adopt | Preserve native semantics and Formation tokens. | surfaces.mobileApp.onboarding | Keyboard and screen-reader review | onboarding.primary |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "one official fallback row cannot satisfy two complementary unavailable lanes",
    designRoomOneFallbackTwoLanes,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_routed_sources_missing",
  );

  const designRoomUnroutedUnavailableFallback = makeFixture("design-room-reference-evidence-unrouted-unavailable-fallback");
  {
    const statePath = path.join(designRoomUnroutedUnavailableFallback, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomUnroutedUnavailableFallback, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: new or materially changed surface")
      .replace("Change scope: Not defined", "Change scope: profile.settings")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(
        /^\| UI Playbook \|.*$/m,
        "| UI Playbook | unavailable | The component catalogue cannot be reached in this runtime. | Not applicable | Not applicable |",
      )
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Profile settings | https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ | The combobox pattern defines keyboard and semantic behavior. | Adopt | Preserve native semantics and Formation tokens. | surfaces.mobileApp.profile | Keyboard and screen-reader review | profile.settings |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "an unrouted surface accepts official guidance for an explicitly unavailable source",
    designRoomUnroutedUnavailableFallback,
    "check-design-room-contract.ts",
    1,
    "design_room.contract_placeholder",
    [],
    undefined,
    "design_room.reference_evidence_change_sources_missing",
  );

  for (const scope of ["gestures.swipe", "transitions.success"] as const) {
    const designRoomPluralMotionRouteMissing = makeFixture(`design-room-reference-evidence-${scope.replaceAll(".", "-")}-missing`);
    const statePath = path.join(designRoomPluralMotionRouteMissing, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomPluralMotionRouteMissing, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: new or materially changed surface")
      .replace("Change scope: Not defined", `Change scope: ${scope}`)
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| UI Playbook \|.*$/m, "| UI Playbook | required | Standard component proof is needed. | control states | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        `| Motion surface | UI Playbook | Standard controls expose their state. | Adopt | Keep the control contract explicit. | surfaces.mobileApp.motion | Device review | ${scope} |`,
      );
    writeFileSync(contractPath, contract, "utf8");
    runFixture(
      `${scope} requires its routed 60fps.design evidence`,
      designRoomPluralMotionRouteMissing,
      "check-design-room-contract.ts",
      1,
      "design_room.reference_evidence_routed_sources_missing",
    );
  }

  for (const scope of ["micro-interactions.button", "empty-states.search", "magical-moments.reward"] as const) {
    const designRoomPluralDelightRouteMissing = makeFixture(`design-room-reference-evidence-${scope.replaceAll(".", "-")}-missing`);
    const statePath = path.join(designRoomPluralDelightRouteMissing, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomPluralDelightRouteMissing, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: new or materially changed surface")
      .replace("Change scope: Not defined", `Change scope: ${scope}`)
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| UI Playbook \|.*$/m, "| UI Playbook | required | Standard component proof is needed. | control states | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        `| Delight surface | UI Playbook | Standard controls expose their state. | Adopt | Keep the control contract explicit. | surfaces.mobileApp.delight | Device review | ${scope} |`,
      );
    writeFileSync(contractPath, contract, "utf8");
    runFixture(
      `${scope} requires its routed Design Spells evidence`,
      designRoomPluralDelightRouteMissing,
      "check-design-room-contract.ts",
      1,
      "design_room.reference_evidence_routed_sources_missing",
    );
  }

  const designRoomScopedSurfaceMismatch = makeFixture("design-room-reference-evidence-scoped-surface-mismatch");
  {
    const statePath = path.join(designRoomScopedSurfaceMismatch, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomScopedSurfaceMismatch, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: high-impact or high-risk surface")
      .replace("Change scope: Not defined", "Change scope: paywall.upgrade")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| abtest\.design \|.*$/m, "| abtest.design | required | Paywall proof is needed. | offer framing | 2026-08-20 |")
      .replace(/^\| UXSnaps \|.*$/m, "| UXSnaps | required | Paywall journey proof is needed. | upgrade flow | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Initial paywall | abtest.design | Offer framing supplies a hypothesis. | Adopt | Test the initial offer. | surfaces.mobileApp.paywalls.initial | Conversion experiment | paywall.initial |\n| Initial paywall | UXSnaps | The journey preserves context. | Adopt | Preserve the offer origin. | surfaces.mobileApp.paywalls.initial | Journey review | paywall.initial |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "scoped paywall work cannot use evidence from a different paywall key",
    designRoomScopedSurfaceMismatch,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_routed_sources_missing",
  );

  const designRoomSameCategorySeparateSurfaces = makeFixture("design-room-reference-evidence-same-category-separate-surfaces");
  {
    const statePath = path.join(designRoomSameCategorySeparateSurfaces, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomSameCategorySeparateSurfaces, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("Change classification: Not defined", "Change classification: high-impact or high-risk surface")
      .replace("Change scope: Not defined", "Change scope: paywall.initial, paywall.upgrade")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| abtest\.design \|.*$/m, "| abtest.design | required | Paywall proof is needed. | offer framing | 2026-08-20 |")
      .replace(/^\| UXSnaps \|.*$/m, "| UXSnaps | required | Paywall journey proof is needed. | upgrade flow | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Initial paywall | abtest.design | Offer framing supplies a local hypothesis. | Adopt | Test the initial offer. | designRoom.surfaces.initialPaywall | Conversion experiment | paywall.initial |\n| Upgrade paywall | UXSnaps | The upgrade journey keeps context. | Adopt | Preserve the upgrade origin. | designRoom.surfaces.upgradePaywall | Journey review | paywall.upgrade |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "two paywall surfaces each need their own complementary evidence pair",
    designRoomSameCategorySeparateSurfaces,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_high_impact_sources_missing",
  );

  const designRoomEscapedEvidencePipe = makeFixture("design-room-reference-evidence-escaped-pipe");
  {
    const statePath = path.join(designRoomEscapedEvidencePipe, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomEscapedEvidencePipe, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| 60fps\.design \|.*$/m, "| 60fps.design | required | Motion proof is needed. | success transition | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Success transition | 60fps.design | Loading \\| complete preserves context. | Adopt | Use Formation timing tokens. | designRoom.surfaces.success | Device motion review | success.primary |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "escaped pipes remain inside an authored evidence cell",
    designRoomEscapedEvidencePipe,
    "check-design-room-contract.ts",
    1,
    "design_room.contract_placeholder",
    [],
    undefined,
    "design_room.reference_evidence_adoption_incomplete",
  );

  const designRoomHighImpactSourcesCannotCrossSurface = makeFixture("design-room-reference-evidence-high-impact-cross-surface");
  {
    const statePath = path.join(designRoomHighImpactSourcesCannotCrossSurface, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
    const contractPath = path.join(designRoomHighImpactSourcesCannotCrossSurface, "design/design.md");
    const contract = readFileSync(contractPath, "utf8")
      .replaceAll("| Not reviewed |", "| not applicable |")
      .replace(/^\| 60fps\.design \|.*$/m, "| 60fps.design | required | Motion proof is needed. | success transition | 2026-08-20 |")
      .replace(/^\| abtest\.design \|.*$/m, "| abtest.design | required | Conversion proof is needed. | price framing | 2026-08-20 |")
      .replace(
        "| Not defined | Not captured | Not captured | Not defined | Not defined | Not defined | Not defined | Not defined |",
        "| Onboarding success | 60fps.design | A short state transition preserves context. | Adopt | Use Formation timing tokens. | designRoom.surfaces.onboarding | Device motion review | onboarding.primary |\n| Paywall choice | abtest.design | Price framing is a local hypothesis. | Adopt | Test with the target audience. | designRoom.surfaces.paywall | Conversion experiment | paywall.primary |",
      );
    writeFileSync(contractPath, contract, "utf8");
  }
  runFixture(
    "high-impact evidence sources cannot be pooled across different decisions",
    designRoomHighImpactSourcesCannotCrossSurface,
    "check-design-room-contract.ts",
    1,
    "design_room.reference_evidence_high_impact_sources_missing",
  );

  const designRoomFreeform = makeFixture("design-room-freeform-proposal");
  writeFileSync(path.join(designRoomFreeform, "design-proposal.html"), "<!doctype html><html><body>New idea</body></html>", "utf8");
  runFixture(
    "freeform design proposal fails Design Room contract",
    designRoomFreeform,
    "check-design-room-contract.ts",
    1,
    "design_room.freeform_design_artifact",
  );

  const designRoomSemanticMismatch = makeFixture("design-room-semantic-mismatch");
  {
    const renderPath = path.join(designRoomSemanticMismatch, "design/design-room.html");
    const render = readFileSync(renderPath, "utf8").replaceAll("App Name", "Wrong App");
    writeFileSync(renderPath, render, "utf8");
  }
  runFixture(
    "Design Room visible values must match state",
    designRoomSemanticMismatch,
    "check-design-room-contract.ts",
    1,
    "design_room.render_semantic_mismatch",
  );

  const designRoomPlaceholderReady = makeFixture("design-room-placeholder-ready");
  {
    const statePath = path.join(designRoomPlaceholderReady, "studio/seed/business.json");
    const designState = JSON.parse(readFileSync(statePath, "utf8")) as MutableRecord;
    const designRoom = expectRecord(designState["designRoom"], "designRoom");
    designRoom["status"] = "rendered";
    writeFileSync(statePath, `${JSON.stringify(designState, null, 2)}\n`, "utf8");
  }
  runFixture("render placeholder-ready Design Room fixture", designRoomPlaceholderReady, "render-design-room.ts", 0, undefined, ["--static-only"]);
  runFixture("review-ready Design Room rejects starter text", designRoomPlaceholderReady, "check-design-room-contract.ts", 1, "design_room.render_placeholder");

  const controlPlaneMissing = makeFixture("control-plane-missing-panel");
  {
    const designStatePath = path.join(controlPlaneMissing, "studio", "seed", "business.json");
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
    revenue["evidence"] = ["revenue/REVENUE_OPS.md"];
    writeState(providerProofMissing, state);
    rmSync(path.join(providerProofMissing, "operations/PROVIDER_PROOF.md"), { force: true });
  }
  runFixture("provider-backed done lane without proof fails", providerProofMissing, "check-live-provider-proof.ts", 1, "provider_proof.file_missing");

  const providerProofContradiction = makeFixture("provider-proof-contradiction");
  writeFileSync(
    path.join(providerProofContradiction, "operations/PROVIDER_PROOF.md"),
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
    analytics["evidence"] = ["analytics/ANALYTICS.md", "analytics/posthog-proof.md"];
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
    analytics["evidence"] = ["analytics/ANALYTICS.md"];
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
    analytics["evidence"] = ["analytics/ANALYTICS.md", "analytics/posthog-proof.md"];
    writeState(providerProofPipedCommand, state);
    writeCompleteProviderProof(providerProofPipedCommand);
    const proofPath = path.join(providerProofPipedCommand, "operations/PROVIDER_PROOF.md");
    const withPipedCommand = readFileSync(proofPath, "utf8").replace(
      "| PostHog | event and person property captured | inspect dashboard/API | analytics/posthog-proof.md |",
      "| PostHog | event and person property captured | curl api.posthog.com \\| jq .results | analytics/posthog-proof.md |",
    );
    writeFileSync(proofPath, withPipedCommand, "utf8");
    mkdirSync(path.join(providerProofPipedCommand, "analytics"), { recursive: true });
    writeFileSync(path.join(providerProofPipedCommand, "analytics", "posthog-proof.md"), "Captured live event on 2026-07-07.\n", "utf8");
  }
  runFixture("provider proof row with a piped proof command still grounds", providerProofPipedCommand, "check-live-provider-proof.ts", 0);

  // Regression (verification pass): the shipped engineering/PRODUCTION_READINESS.md
  // template's cautionary boilerplate ("Do not mark this app launch-ready
  // until ...") must not hard-fail a repo where no lane is done yet.
  const providerProofEarlyRepo = makeFixture("provider-proof-early-repo");
  rmSync(path.join(providerProofEarlyRepo, "operations/PROVIDER_PROOF.md"), { force: true });
  runFixture("readiness boilerplate without done lanes does not hard-fail provider proof", providerProofEarlyRepo, "check-live-provider-proof.ts", 0);

  const providerProofStaleStatus = makeFixture("provider-proof-stale-status");
  {
    const state = readState(providerProofStaleStatus);
    const analytics = getLane(state, "analytics_attribution");
    analytics["status"] = "done";
    analytics["evidence"] = ["analytics/ANALYTICS.md"];
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

  // Regression: "onboarding" was absent from proofRequiredLanes and providerLaneMap, so a
  // done onboarding lane (ONB-22's own lane) never required operations/PROVIDER_PROOF.md to
  // exist at all, even though ONB-22 declares provider.revenuecat and provider.posthog.
  const providerProofOnboardingMissing = makeFixture("provider-proof-onboarding-missing");
  {
    const state = readState(providerProofOnboardingMissing);
    getLane(state, "onboarding")["status"] = "done";
    writeState(providerProofOnboardingMissing, state);
    rmSync(path.join(providerProofOnboardingMissing, "operations/PROVIDER_PROOF.md"), { force: true });
  }
  runFixture(
    "done onboarding lane without proof now fails, same as any other provider-backed lane",
    providerProofOnboardingMissing,
    "check-live-provider-proof.ts",
    1,
    "provider_proof.file_missing",
  );

  // The onboarding lane maps to both PostHog and RevenueCat: grounding only one must not
  // silence the other.
  const providerProofOnboardingRevenueCatUngrounded = makeFixture("provider-proof-onboarding-revenuecat-ungrounded");
  {
    const state = readState(providerProofOnboardingRevenueCatUngrounded);
    getLane(state, "onboarding")["status"] = "done";
    writeState(providerProofOnboardingRevenueCatUngrounded, state);
    writeCompleteProviderProof(providerProofOnboardingRevenueCatUngrounded);
    mkdirSync(path.join(providerProofOnboardingRevenueCatUngrounded, "analytics"), { recursive: true });
    writeFileSync(
      path.join(providerProofOnboardingRevenueCatUngrounded, "analytics", "posthog-proof.md"),
      "Captured live event and person property on 2026-08-08.\n",
      "utf8",
    );
    // The shipped workspace template ships an (unfilled) revenue/revenuecat-proof.md stub, so
    // "ungrounded" has to remove it explicitly -- its mere presence would otherwise satisfy the
    // existsSync check regardless of content.
    rmSync(path.join(providerProofOnboardingRevenueCatUngrounded, "revenue", "revenuecat-proof.md"), { force: true });
  }
  runFixture(
    "done onboarding lane with PostHog grounded but RevenueCat evidence missing still fails",
    providerProofOnboardingRevenueCatUngrounded,
    "check-live-provider-proof.ts",
    1,
    "provider_proof.revenuecat.evidence_path_missing",
  );

  const providerProofOnboardingGrounded = makeFixture("provider-proof-onboarding-grounded");
  {
    const state = readState(providerProofOnboardingGrounded);
    getLane(state, "onboarding")["status"] = "done";
    writeState(providerProofOnboardingGrounded, state);
    writeCompleteProviderProof(providerProofOnboardingGrounded);
    mkdirSync(path.join(providerProofOnboardingGrounded, "analytics"), { recursive: true });
    writeFileSync(
      path.join(providerProofOnboardingGrounded, "analytics", "posthog-proof.md"),
      "Captured live event and person property on 2026-08-08.\n",
      "utf8",
    );
    mkdirSync(path.join(providerProofOnboardingGrounded, "revenue"), { recursive: true });
    writeFileSync(
      path.join(providerProofOnboardingGrounded, "revenue", "revenuecat-proof.md"),
      "Sandbox purchase confirmed: entitlement active and access granted inside the app.\n",
      "utf8",
    );
  }
  runFixture(
    "done onboarding lane with both PostHog and RevenueCat evidence on disk passes",
    providerProofOnboardingGrounded,
    "check-live-provider-proof.ts",
    0,
  );

  // Regression: the ready-claim/open-blocker check scanned the whole PROVIDER_PROOF.md document,
  // so an unrelated provider's still-pending row could block ONB-22 even though its own declared
  // providers (PostHog, RevenueCat) are genuinely ready. --providers scopes that specific check to
  // the named providers' own rows; every other check in this file (keyword presence, per-provider
  // ledger grounding) is unaffected and still runs against the whole document either way.
  const providerProofUnrelatedBlockerScoped = makeFixture("provider-proof-unrelated-blocker-scoped");
  {
    const state = readState(providerProofUnrelatedBlockerScoped);
    getLane(state, "onboarding")["status"] = "done";
    writeState(providerProofUnrelatedBlockerScoped, state);
    writeFileSync(
      path.join(providerProofUnrelatedBlockerScoped, "operations/PROVIDER_PROOF.md"),
      [
        "# Provider Proof",
        "Status: PostHog and RevenueCat are verified.",
        "Proof Ledger",
        "| Provider | current status | proof command | evidence path | founder-only gate |",
        "| --- | --- | --- | --- | --- |",
        "| PostHog | event and person property captured | inspect dashboard/API | analytics/posthog-proof.md | founder-only account access |",
        "| RevenueCat | sandbox purchase grants entitlement | sandbox purchase and entitlement check | revenue/revenuecat-proof.md | founder-only store product setup |",
        "| Resend | domain verification pending | send test email | email/resend-proof.md | founder-only DNS access |",
        "| App Store Connect | app record and metadata inspected | asc validation commands | store/asc-proof.md | founder-only submission access |",
        "| Sentry | release event captured | trigger handled test event | security/sentry-proof.md | founder-only project access |",
        "| MobAI | target-user onboarding walkthrough captured | run mobile walkthrough | mobile/mobai-proof.md | founder-only device access |",
        "| Doppler | runtime injection captured | doppler run -- printenv APP_ENV | secrets/doppler-proof.md | founder-only secrets access |",
        "No raw secrets, private account screenshots, signing material, or credential screenshots are stored in proof artifacts.",
        "",
      ].join("\n"),
      "utf8",
    );
    mkdirSync(path.join(providerProofUnrelatedBlockerScoped, "analytics"), { recursive: true });
    writeFileSync(path.join(providerProofUnrelatedBlockerScoped, "analytics", "posthog-proof.md"), "Captured live event on 2026-08-09.\n", "utf8");
    mkdirSync(path.join(providerProofUnrelatedBlockerScoped, "revenue"), { recursive: true });
    writeFileSync(
      path.join(providerProofUnrelatedBlockerScoped, "revenue", "revenuecat-proof.md"),
      "Sandbox purchase confirmed: entitlement active on 2026-08-09.\n",
      "utf8",
    );
  }
  runFixture(
    "the unscoped provider-proof check fails on an unrelated pending provider row",
    providerProofUnrelatedBlockerScoped,
    "check-live-provider-proof.ts",
    1,
    "provider_proof.ready_claim_with_blocker",
  );
  runFixture(
    "the --providers-scoped provider-proof check ignores that same unrelated pending row",
    providerProofUnrelatedBlockerScoped,
    "check-live-provider-proof.ts",
    0,
    undefined,
    ["--providers", "PostHog,RevenueCat"],
  );

  // The scope must not become a blanket bypass: a blocker inside one of the NAMED providers' own
  // rows still fails even under --providers.
  const providerProofOwnBlockerStillScoped = makeFixture("provider-proof-own-blocker-still-scoped");
  {
    const state = readState(providerProofOwnBlockerStillScoped);
    getLane(state, "onboarding")["status"] = "done";
    writeState(providerProofOwnBlockerStillScoped, state);
    writeFileSync(
      path.join(providerProofOwnBlockerStillScoped, "operations/PROVIDER_PROOF.md"),
      [
        "# Provider Proof",
        "Status: PostHog and RevenueCat are verified.",
        "Proof Ledger",
        "| Provider | current status | proof command | evidence path | founder-only gate |",
        "| --- | --- | --- | --- | --- |",
        "| PostHog | event capture pending | inspect dashboard/API | analytics/posthog-proof.md | founder-only account access |",
        "| RevenueCat | sandbox purchase grants entitlement | sandbox purchase and entitlement check | revenue/revenuecat-proof.md | founder-only store product setup |",
        "| Resend | domain and test send captured | send test email | email/resend-proof.md | founder-only DNS access |",
        "| App Store Connect | app record and metadata inspected | asc validation commands | store/asc-proof.md | founder-only submission access |",
        "| Sentry | release event captured | trigger handled test event | security/sentry-proof.md | founder-only project access |",
        "| MobAI | target-user onboarding walkthrough captured | run mobile walkthrough | mobile/mobai-proof.md | founder-only device access |",
        "| Doppler | runtime injection captured | doppler run -- printenv APP_ENV | secrets/doppler-proof.md | founder-only secrets access |",
        "No raw secrets, private account screenshots, signing material, or credential screenshots are stored in proof artifacts.",
        "",
      ].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "the --providers-scoped provider-proof check still fails on a blocker inside a named provider's own row",
    providerProofOwnBlockerStillScoped,
    "check-live-provider-proof.ts",
    1,
    "provider_proof.ready_claim_with_blocker",
    ["--providers", "PostHog,RevenueCat"],
  );

  // Regression (round 23): the per-provider ledger-grounding loop above still only ran once one
  // of a provider's mapped lanes read "done" -- but check:provider-proof-onboarding is invoked as
  // the PRECONDITION for marking the onboarding lane done, so at the point it actually needs to
  // run, the onboarding lane cannot yet be "done", and neither analytics_attribution nor revenue
  // is guaranteed done either. Against the untouched shipped workspace (no lane done anywhere,
  // PostHog/RevenueCat rows still reading their own shipped "needs ... evidence" status), the
  // scoped invocation used to pass trivially, letting ONB-22's destructive cutover proceed
  // without ever grounding its own declared providers.
  const providerProofScopedRequiresEvidenceBeforeLaneDone = makeFixture("provider-proof-scoped-requires-evidence-before-lane-done");
  runFixture(
    "the unscoped provider-proof check still passes against the untouched workspace with no lane done",
    providerProofScopedRequiresEvidenceBeforeLaneDone,
    "check-live-provider-proof.ts",
    0,
  );
  runFixture(
    "the --providers-scoped provider-proof check requires named-provider evidence even before any lane is done",
    providerProofScopedRequiresEvidenceBeforeLaneDone,
    "check-live-provider-proof.ts",
    1,
    "provider_proof.posthog.status_unproven",
    ["--providers", "PostHog,RevenueCat"],
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
    const tokensPath = path.join(tokenPromotionStale, "studio", "seed", "theme.tokens.json");
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
    JSON.stringify({ skill: "formation", version: "0.2.0", updatedAt: "2026-05-30" }, null, 2),
    "utf8",
  );
  writeFileSync(
    path.join(installedSkillRoot, "skill-version.json"),
    JSON.stringify({ skill: "formation", version: "0.1.0", updatedAt: "2026-05-01" }, null, 2),
    "utf8",
  );
  runFixture("stale installed skill version fails", staleSkillVersion, "check-skill-version.ts", 1, "skill_version.stale", [
    "--source",
    latestSkillRoot,
    "--installed",
    installedSkillRoot,
  ]);
}
