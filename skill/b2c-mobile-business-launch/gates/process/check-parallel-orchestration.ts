#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import {
  asArray,
  asBoolean,
  asString,
  getPath,
  isRecord,
  issue,
  loadProjectState,
  missingPhraseCode,
  normalizedStringArray,
  parseCliArgs,
  readText,
  reportAndExit,
} from "../../scripts/lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;

const strategyValues = new Set(["not_evaluated", "inline", "serial_subagents", "parallel_subagents", "worktrees", "hybrid", "blocked", "not_needed"]);

function firstExistingText(candidates: string[]): { relativePath: string; text: string } | undefined {
  for (const candidate of candidates) {
    const text = readText(args.root, candidate);
    if (text) {
      return { relativePath: candidate, text };
    }
  }
  return undefined;
}

function existsAny(candidates: string[]): string | undefined {
  return candidates.find((candidate) => existsSync(path.join(args.root, candidate)));
}

function includes(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

function requiresParallelSafety(strategy: string | undefined, spawnedAgents: unknown[]): boolean {
  return strategy === "parallel_subagents" || strategy === "worktrees" || strategy === "hybrid" || spawnedAgents.length > 0;
}

function unitId(unit: Record<string, unknown>, index: number): string {
  return asString(unit.id)?.trim() || `unit-${index}`;
}

const orchestrationLaneStatus = state ? asString(getPath(state, "lanes.orchestration.status"))?.toLowerCase() : undefined;
const engineeringLaneStatus = state ? asString(getPath(state, "lanes.engineering.status"))?.toLowerCase() : undefined;
const skip = orchestrationLaneStatus === "not_needed" || orchestrationLaneStatus === "deferred";
const markdown = firstExistingText(["operations/ORCHESTRATION.md", "orchestration/operations/ORCHESTRATION.md"]);
const htmlPath = existsAny(["operations/orchestration.html", "orchestration/operations/orchestration.html"]);

if (!skip && !markdown) {
  issues.push(
    issue(
      "error",
      "orchestration.markdown_missing",
      "operations/ORCHESTRATION.md is required before broad launch, multi-lane build, subagent dispatch, or launch-readiness claims.",
      "operations/ORCHESTRATION.md",
    ),
  );
}

if (!skip && !htmlPath) {
  issues.push(
    issue(
      "warning",
      "operations/orchestration.html_missing",
      "operations/orchestration.html should render the parallel-agent board when orchestration is in scope.",
      "operations/orchestration.html",
    ),
  );
}

if (markdown) {
  const requiredPhrases = [
    "Orchestration Preflight",
    "Strategy",
    "Candidate Units",
    "Parallel Safety Check",
    "File Ownership",
    "Serialized Work",
    "Subagent Instructions",
    "Integration Plan",
    "Verification",
    "Founder-Only Gates",
    "State Updates",
    "Failure Cards",
  ];
  for (const phrase of requiredPhrases) {
    if (!includes(markdown.text, phrase)) {
      issues.push(issue("error", missingPhraseCode("orchestration", phrase), `operations/ORCHESTRATION.md should include ${phrase}.`, markdown.relativePath));
    }
  }

  if (
    /\b(?:subagent|subagents|worker|workers|specialist|specialists)\b[^\n.]{0,160}\b(?:can|may|should|will)\s+(?:stage|commit|push|merge)\b/i.test(
      markdown.text,
    )
  ) {
    issues.push(
      issue(
        "error",
        "orchestration.subagent_git_authority",
        "Subagents must not be granted git staging, commit, push, merge, or release authority.",
        markdown.relativePath,
      ),
    );
  }

  if (/\bsubagents?\b[\s\S]{0,160}\b(?:may|can|should|will|must)\s+run\s+(?:project-wide|full)\s+(?:test|suite|audit)/i.test(markdown.text)) {
    issues.push(
      issue(
        "error",
        "orchestration.subagent_project_wide_suite",
        "Parallel subagents should not run project-wide suites; the orchestrator owns full-suite validation after integration.",
        markdown.relativePath,
      ),
    );
  }

  const mentionsParallel = /\b(parallel|subagent|worker|worktree)\b/i.test(markdown.text);
  if (mentionsParallel && !/\bdo not\b[\s\S]{0,160}\bstage\b/i.test(markdown.text)) {
    issues.push(
      issue("error", "orchestration.no_stage_instruction_missing", "Subagent instructions should explicitly say not to stage files.", markdown.relativePath),
    );
  }
  if (mentionsParallel && !/\bdo not\b[\s\S]{0,160}\bcommit\b/i.test(markdown.text)) {
    issues.push(
      issue("error", "orchestration.no_commit_instruction_missing", "Subagent instructions should explicitly say not to commit.", markdown.relativePath),
    );
  }

  if (/\b(TODO|TBD|unknown|placeholder)\b/i.test(markdown.text) && /\b(status:\s*done|launch-ready|complete|production-ready)\b/i.test(markdown.text)) {
    issues.push(
      issue(
        "error",
        "orchestration.placeholder_complete",
        "operations/ORCHESTRATION.md cannot claim done/complete while placeholder language remains.",
        markdown.relativePath,
      ),
    );
  }
}

if (state && !skip) {
  const orchestration = getPath(state, "orchestration");
  if (!isRecord(orchestration)) {
    issues.push(
      issue("error", "orchestration.state_missing", "state/PROJECT_STATE.yaml must include a top-level orchestration block.", "state/PROJECT_STATE.yaml"),
    );
  } else {
    const strategy = asString(orchestration.strategy)?.trim();
    if (!strategy || !strategyValues.has(strategy)) {
      issues.push(
        issue(
          "error",
          "orchestration.strategy.invalid",
          `orchestration.strategy must be one of ${Array.from(strategyValues).join(", ")}.`,
          "state/PROJECT_STATE.yaml",
        ),
      );
    }

    for (const field of [
      "preflight_done",
      "manager_pattern",
      "file_overlap_checked",
      "actual_file_collision_check",
      "agent_outputs_reviewed",
      "state_reconciled",
    ]) {
      if (asBoolean(orchestration[field]) === undefined) {
        issues.push(issue("error", `orchestration.${field}.missing_boolean`, `orchestration.${field} must be true or false.`, "state/PROJECT_STATE.yaml"));
      }
    }

    for (const field of ["rationale", "integration_owner"]) {
      if (!asString(orchestration[field])?.trim()) {
        issues.push(issue("error", `orchestration.${field}.missing`, `orchestration.${field} must be recorded.`, "state/PROJECT_STATE.yaml"));
      }
    }

    const candidateUnits = asArray(orchestration.candidate_units);
    const spawnedAgents = asArray(orchestration.spawned_agents);
    const parallelUnitIds = new Set(normalizedStringArray(orchestration.parallel_safe_units));

    if ((strategy === "serial_subagents" || requiresParallelSafety(strategy, spawnedAgents)) && candidateUnits.length === 0) {
      issues.push(
        issue(
          "error",
          "orchestration.candidate_units.missing",
          "Subagent/worktree strategies must record candidate_units with objective, mode, files, shared resources, and safety decision.",
          "state/PROJECT_STATE.yaml",
        ),
      );
    }

    if (requiresParallelSafety(strategy, spawnedAgents) && asBoolean(orchestration.file_overlap_checked) !== true) {
      issues.push(
        issue(
          "error",
          "orchestration.file_overlap_unchecked",
          "Parallel or spawned-agent work requires file_overlap_checked: true.",
          "state/PROJECT_STATE.yaml",
        ),
      );
    }

    if (spawnedAgents.length > 0 && strategy === "inline") {
      issues.push(
        issue("error", "orchestration.spawned_agents_inline_strategy", "spawned_agents is non-empty but strategy is inline.", "state/PROJECT_STATE.yaml"),
      );
    }

    const fileOwners = new Map<string, string[]>();
    for (const [index, unit] of candidateUnits.entries()) {
      if (!isRecord(unit)) {
        issues.push(issue("error", `orchestration.candidate_units.${index}.invalid`, `Candidate unit ${index} must be an object.`, "state/PROJECT_STATE.yaml"));
        continue;
      }
      const id = unitId(unit, index);
      for (const field of ["role", "objective", "mode", "status"]) {
        if (!asString(unit[field])?.trim()) {
          issues.push(
            issue(
              "error",
              `orchestration.candidate_units.${index}.${field}.missing`,
              `Candidate unit ${id} must include ${field}.`,
              "state/PROJECT_STATE.yaml",
            ),
          );
        }
      }
      const files = normalizedStringArray(unit.files);
      const sharedResources = normalizedStringArray(unit.shared_resources);
      if (files.length === 0 && sharedResources.length === 0) {
        issues.push(
          issue(
            "error",
            `orchestration.candidate_units.${index}.scope_missing`,
            `Candidate unit ${id} must list files or shared_resources so safety can be checked.`,
            "state/PROJECT_STATE.yaml",
          ),
        );
      }
      const parallelSafe = asBoolean(unit.parallel_safe) === true || parallelUnitIds.has(id);
      if (parallelSafe) {
        for (const file of files) {
          const owners = fileOwners.get(file) ?? [];
          owners.push(id);
          fileOwners.set(file, owners);
        }
      }
    }

    for (const [file, owners] of fileOwners.entries()) {
      if (owners.length > 1) {
        issues.push(
          issue(
            "error",
            "orchestration.parallel_file_overlap",
            `Parallel-safe units share ${file}: ${owners.join(", ")}. Serialize these units or isolate them in worktrees.`,
            "state/PROJECT_STATE.yaml",
          ),
        );
      }
    }

    for (const [index, agent] of spawnedAgents.entries()) {
      if (!isRecord(agent)) {
        issues.push(issue("error", `orchestration.spawned_agents.${index}.invalid`, `Spawned agent ${index} must be an object.`, "state/PROJECT_STATE.yaml"));
        continue;
      }
      for (const field of ["id", "role", "objective", "mode", "status"]) {
        if (!asString(agent[field])?.trim()) {
          issues.push(
            issue(
              "error",
              `orchestration.spawned_agents.${index}.${field}.missing`,
              `Spawned agent ${index} must include ${field}.`,
              "state/PROJECT_STATE.yaml",
            ),
          );
        }
      }
      const forbidden = normalizedStringArray(agent.forbidden_actions).join(" ").toLowerCase();
      if (!forbidden.includes("stage") || !forbidden.includes("commit")) {
        issues.push(
          issue(
            "error",
            `orchestration.spawned_agents.${index}.forbidden_actions.git_missing`,
            `Spawned agent ${index} must be explicitly forbidden from staging and committing.`,
            "state/PROJECT_STATE.yaml",
          ),
        );
      }
      if (asString(agent.status)?.toLowerCase() === "completed" && !asString(agent.output_path)?.trim()) {
        issues.push(
          issue(
            "warning",
            `orchestration.spawned_agents.${index}.output_path.missing`,
            `Completed spawned agent ${index} should record output_path or equivalent proof.`,
            "state/PROJECT_STATE.yaml",
          ),
        );
      }
    }

    const doneOrReady = orchestrationLaneStatus === "done" || engineeringLaneStatus === "done";
    if (doneOrReady && asBoolean(orchestration.preflight_done) !== true) {
      issues.push(
        issue(
          "error",
          "orchestration.done_without_preflight",
          "Done engineering/orchestration lanes require preflight_done: true.",
          "state/PROJECT_STATE.yaml",
        ),
      );
    }
    if (doneOrReady && asBoolean(orchestration.state_reconciled) !== true) {
      issues.push(
        issue(
          "error",
          "orchestration.done_without_state_reconciled",
          "Done engineering/orchestration lanes require state_reconciled: true.",
          "state/PROJECT_STATE.yaml",
        ),
      );
    }
    if (doneOrReady && spawnedAgents.length > 0 && asBoolean(orchestration.agent_outputs_reviewed) !== true) {
      issues.push(
        issue(
          "error",
          "orchestration.done_without_agent_review",
          "Spawned-agent outputs must be reviewed before done/readiness claims.",
          "state/PROJECT_STATE.yaml",
        ),
      );
    }
    if (doneOrReady && requiresParallelSafety(strategy, spawnedAgents) && asBoolean(orchestration.actual_file_collision_check) !== true) {
      issues.push(
        issue(
          "error",
          "orchestration.done_without_actual_collision_check",
          "Parallel/spawned-agent work requires actual_file_collision_check: true before done/readiness claims.",
          "state/PROJECT_STATE.yaml",
        ),
      );
    }
  }
}

reportAndExit("Parallel orchestration check", issues);
