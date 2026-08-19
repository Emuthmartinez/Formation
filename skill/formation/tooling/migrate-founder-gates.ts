#!/usr/bin/env node
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { asString, getPath, isRecord, parseCliArgs } from "./lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const ledgerPath = path.join(args.root, "operations/business-access.json");
const schemaPath = path.join(args.root, "operations/business-access.schema.json");
const humanPath = path.join(args.root, "operations/BUSINESS_ACCESS.md");

if (!existsSync(ledgerPath)) {
  throw new Error(`Missing founder ledger: ${ledgerPath}`);
}

const parsedLedger: unknown = JSON.parse(readFileSync(ledgerPath, "utf8"));
if (!isRecord(parsedLedger) || !isRecord(parsedLedger.founderModel) || !isRecord(parsedLedger.founderModel.activeFounderGate)) {
  throw new Error("The founder ledger does not contain founderModel.activeFounderGate.");
}

const sourceVersion = asString(parsedLedger.schemaVersion);
if (sourceVersion === "2.0.0") {
  console.log("Founder gate contract is already at 2.0.0; no migration needed.");
  process.exit(0);
}
if (!sourceVersion || !/^1\./.test(sourceVersion)) {
  throw new Error(`Unsupported founder gate schema version: ${sourceVersion ?? "missing"}. Only 1.x can migrate to 2.0.0.`);
}

const stateSource = readFileSync(args.statePath, "utf8");
const parsedState: unknown = parseYaml(stateSource);
if (!isRecord(parsedState)) {
  throw new Error(`PROJECT_STATE did not parse to an object: ${args.statePath}`);
}

const founder = parsedLedger.founderModel as Record<string, unknown>;
const legacyGate = founder.activeFounderGate as Record<string, unknown>;
const legacyGateId = asString(legacyGate.id) ?? "legacy-founder-gate";
const phaseId = asString(getPath(parsedState, "project.phase")) ?? "phase_0_orient";
const migratedAgentAction = "Translate the original gate into plain language and re-present it as a new specific decision before taking the underlying action.";
const migratedFounderAction =
  "Choose whether I should re-present this older decision now or defer it; this migration does not authorize the underlying action.";
const now = new Date().toISOString();

founder.questionMode = "ask_user_question_when_available";
founder.currentPhase = {
  id: phaseId,
  label: "Review the migrated decision",
  outcome: "A new plain-language gate that preserves the founder's authority without guessing consent.",
};
founder.gateHistory = [
  ...((Array.isArray(founder.gateHistory) ? founder.gateHistory : []) as unknown[]),
  {
    id: legacyGateId,
    status: "stale",
    selectedOptionId: "",
    decidedAt: "",
    authority: "agent_migration",
    consequence: "No authorization or approval was carried into the new gate contract.",
    evidencePath: "",
    reason: "The legacy gate lacked explicit phase, choice, consequence, defer, and lifecycle fields.",
    context: {
      actionType: asString(legacyGate.actionType) ?? "decision",
      target: asString(legacyGate.target) ?? "legacy founder decision",
      whatThisIs: asString(legacyGate.whatThisIs) ?? "",
      whyNow: asString(legacyGate.whyNow) ?? "",
      founderAction: asString(legacyGate.founderAction) ?? "",
      agentActionNext: asString(legacyGate.agentActionNext) ?? "",
      successProof: asString(legacyGate.successProof) ?? "",
    },
  },
];
const migratedGate: Record<string, unknown> = {
  id: `migrate-${legacyGateId}`,
  actionType: "decision",
  target: asString(legacyGate.target) ?? "legacy founder decision",
  gateClass: "other",
  origin: "agent_proposal",
  phase: {
    id: phaseId,
    label: "Review the migrated decision",
    outcome: "A new plain-language gate that preserves the founder's authority without guessing consent.",
  },
  whatThisIs: "Recover an older founder decision into the clearer phase and choice format.",
  whyNow: "The previous record did not explain choices, consequences, or safe defer behavior.",
  definitions: [],
  founderAction: migratedFounderAction,
  question: {
    header: "Old decision",
    prompt: migratedFounderAction,
    options: [
      {
        id: "re_present_gate",
        label: "Explain it now",
        route: "proceed",
        description: "Have the agent translate the original decision and present a fresh, specific gate.",
        consequence: "No underlying action is authorized; a new specific gate must replace this migration gate.",
        agentActionNext: migratedAgentAction,
        evidenceEffect: "Only the migration step resolves; the original action remains unapproved.",
        recommended: true,
      },
      {
        id: "defer_migration",
        label: "Decide later",
        route: "defer",
        description: "Keep the older decision unresolved while the agent continues unrelated safe work.",
        consequence: "The original lane stays blocked, and no approval is inferred from silence or migration.",
        agentActionNext: "Continue only unrelated read-only or reversible work and keep the original lane blocked.",
        evidenceEffect: "The old gate remains stale and cannot count as readiness or approval evidence.",
        recommended: false,
      },
    ],
  },
  bypassPolicy: {
    mode: "defer_only",
    optionId: "defer_migration",
    reason: "A migration cannot determine whether the original action was safe to bypass.",
    fallbackAction: "Keep the original lane blocked and continue only unrelated read-only or reversible work.",
    revisitTrigger: "Before any work that depends on the original founder decision.",
  },
  safeWorkWhileWaiting: "Continue only unrelated read-only or reversible work; do not infer consent or execute the original action.",
  agentActionNext: migratedAgentAction,
  successProof: "The legacy gate is archived as stale and a new specific founder gate is presented before action.",
  lifecycle: {
    status: "pending",
    presentedAt: "",
    supersedesGateId: legacyGateId,
  },
};
founder.activeFounderGate = migratedGate;
founder.nextFounderAction = migratedFounderAction;
founder.nextAgentAction = migratedAgentAction;
parsedLedger.schemaVersion = "2.0.0";
parsedLedger.updatedAt = now;
if (parsedLedger.status === "not_started") parsedLedger.status = "active";

const operator = isRecord(parsedState.business_operator) ? parsedState.business_operator : {};
parsedState.business_operator = operator;
Object.assign(operator, {
  status: parsedLedger.status,
  current_phase: phaseId,
  current_phase_label: "Review the migrated decision",
  current_phase_outcome: "A new plain-language gate that preserves the founder's authority without guessing consent.",
  active_gate_id: `migrate-${legacyGateId}`,
  active_gate_class: "other",
  active_gate_origin: "agent_proposal",
  active_gate_status: "pending",
  active_gate_bypass_mode: "defer_only",
  question_mode: "ask_user_question_when_available",
  next_founder_action: migratedFounderAction,
  next_agent_action: migratedAgentAction,
  next_business_operation: founder.nextBusinessOperation,
  state_reconciled: true,
});

writeFileSync(ledgerPath, `${JSON.stringify(parsedLedger, null, 2)}\n`, "utf8");
writeFileSync(args.statePath, stringifyYaml(parsedState, { lineWidth: 160 }), "utf8");
copyFileSync(path.join(scriptDir, "../workspace/business/operations/business-access.schema.json"), schemaPath);
const migratedHuman = replaceOneNextAction(readFileSync(humanPath, "utf8"), migratedGate, founder).replace(
  /^Status:.*$/m,
  `Status: ${String(parsedLedger.status)}. The agent assumes the founder is new to business operations and leads one plain-language step at a time.`,
);
writeFileSync(humanPath, migratedHuman, "utf8");
renderCockpit();

console.log(`Migrated founder gate ${legacyGateId} to contract 2.0.0 without carrying approval forward.`);

function replaceOneNextAction(source: string, gate: Record<string, unknown>, model: Record<string, unknown>): string {
  const phase = gate.phase as Record<string, unknown>;
  const question = gate.question as Record<string, unknown>;
  const options = question.options as Array<Record<string, unknown>>;
  const recommended = options[0];
  const deferred = options[1];
  if (!recommended || !deferred) throw new Error("Migrated founder gate must have a recommended and defer option.");
  const bypass = gate.bypassPolicy as Record<string, unknown>;
  const definitions = (gate.definitions as Array<Record<string, unknown>>).map((entry) => `${String(entry.term)}: ${String(entry.meaning)}`).join("; ");
  const replacement = `## One Next Action

- Phase: ${String(phase.label)} (\`${String(phase.id)}\`)
- Outcome: ${String(phase.outcome)}
- Decision type: Other founder decision; requested by the agent migration.
- What this is: ${String(gate.whatThisIs)}
- Why now: ${String(gate.whyNow)}
- Definitions: ${definitions || "None needed for this decision."}
- Founder action: ${String(model.nextFounderAction)}
- Question mode: AskUserQuestion when available; otherwise present the same choices in plain text and wait for an explicit selection.
- Recommended choice: ${String(recommended.label)} - ${String(recommended.consequence)} Agent next: ${String(recommended.agentActionNext)} Evidence: ${String(recommended.evidenceEffect)}
- Defer choice: ${String(deferred.label)} - ${String(deferred.consequence)} Agent next: ${String(deferred.agentActionNext)} Evidence: ${String(deferred.evidenceEffect)}
- Skip/bypass policy: This can be deferred, not bypassed, through \`${String(bypass.optionId)}\`; ${String(bypass.reason)} ${String(bypass.fallbackAction)}
- Revisit before: ${String(bypass.revisitTrigger)}
- Safe work while waiting: ${String(gate.safeWorkWhileWaiting)}
- Agent action next: ${String(model.nextAgentAction)}
- Success proof: ${String(gate.successProof)}
- Next business operation: ${String(model.nextBusinessOperation)}
`;
  return source.match(/## One Next Action[\s\S]*?(?=\n## )/)
    ? source.replace(/## One Next Action[\s\S]*?(?=\n## )/, replacement.trimEnd())
    : `${replacement}\n${source}`;
}

function renderCockpit(): void {
  const candidates = [path.join(scriptDir, "../node_modules/.bin/tsx"), path.resolve(scriptDir, "../../../node_modules/.bin/tsx")];
  const tsxBin = candidates.find((candidate) => existsSync(candidate)) ?? "tsx";
  const result = spawnSync(tsxBin, [path.join(scriptDir, "render-launch-cockpit.ts"), "--root", args.root, "--state", args.statePath], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Founder gate migrated, but cockpit rendering failed:\n${result.stdout}\n${result.stderr}`);
  }
}
