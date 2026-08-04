#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import {
  asArray,
  asString,
  autonomyModes,
  getPath,
  isRecord,
  isPastOrientPhase,
  issue,
  launchScopes,
  acceptedLaunchScopeValues,
  resolveLaunchScope,
  loadProjectState,
  parseCliArgs,
  reportAndExit,
  requiredLanes,
  requireStatus,
  requireString,
  validateReason,
} from "../../../tooling/lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;

if (state) {
  requireString(state, "schema_version", issues);
  requireString(state, "updated_at", issues);
  const updatedAt = asString(getPath(state, "updated_at"));
  if (updatedAt && !/^\d{4}-\d{2}-\d{2}(?:T[\d:.+-]+Z?)?$/.test(updatedAt)) {
    issues.push(issue("error", "updated_at.placeholder", "updated_at must be a concrete ISO date, not a placeholder.", "state/PROJECT_STATE.yaml"));
  }
  requireString(state, "project.name", issues);
  requireString(state, "project.slug", issues);
  requireString(state, "project.phase", issues);

  const mode = asString(getPath(state, "autonomy.mode"));
  if (!mode || !autonomyModes.has(mode)) {
    issues.push(issue("error", "autonomy.mode.invalid", `autonomy.mode must be one of ${Array.from(autonomyModes).join(", ")}.`, "state/PROJECT_STATE.yaml"));
  }

  // Launch scope is optional (defaults to full) but must be a known value when present,
  // so a typo cannot silently exempt lanes from coverage expectations. Both the current
  // key (project.launch_scope) and the legacy one (project.launch_tier) are read, and
  // "lite" still resolves to "essentials", so a business repo launched before the rename
  // keeps validating.
  const launchScope = resolveLaunchScope(asString(getPath(state, "project.launch_scope")), asString(getPath(state, "project.launch_tier")));
  if (launchScope !== undefined && !launchScopes.has(launchScope.normalized)) {
    issues.push(
      issue(
        "error",
        "project.launch_scope.invalid",
        `project.launch_scope must be one of ${acceptedLaunchScopeValues.join(", ")} when present.`,
        "state/PROJECT_STATE.yaml",
      ),
    );
  }

  // The pre-build clock: kickoff_date is recorded when orient completes, and a
  // launch still in the planning/design phases (0-2) 45+ days later is the most
  // common way a business dies — quietly, in artifact work, with nobody ever
  // deciding to stop. Warning, not error: a slow burn is a legitimate founder
  // choice, but it has to be a choice someone can see being made.
  const PRE_BUILD_STALL_DAYS = 45;
  const kickoffRaw = (asString(getPath(state, "project.kickoff_date")) ?? "").trim();
  // The blank seed is legitimate only during orientation: past orient, a
  // missing kickoff date is a clock that can never fire — the exact omission
  // that lets a launch sit in planning indefinitely.
  if (!kickoffRaw && isPastOrientPhase(asString(getPath(state, "project.phase")) ?? "")) {
    issues.push(
      issue(
        "error",
        "project.kickoff_date.missing",
        "project.kickoff_date is blank but the project is past orientation. Record the ISO date orient completed — without it the " +
          'pre-build clock can never surface a stall (launch-phases.md "The Pre-Build Clock").',
        "state/PROJECT_STATE.yaml",
      ),
    );
  }
  if (kickoffRaw) {
    const kickoffValid =
      /^\d{4}-\d{2}-\d{2}$/.test(kickoffRaw) &&
      !Number.isNaN(new Date(`${kickoffRaw}T00:00:00Z`).getTime()) &&
      new Date(`${kickoffRaw}T00:00:00Z`).toISOString().slice(0, 10) === kickoffRaw &&
      new Date(`${kickoffRaw}T00:00:00Z`).getTime() <= Date.now();
    if (!kickoffValid) {
      issues.push(
        issue(
          "error",
          "project.kickoff_date.invalid",
          `project.kickoff_date ("${kickoffRaw}") must be a real past ISO date (YYYY-MM-DD). An invalid or future date disarms the pre-build clock.`,
          "state/PROJECT_STATE.yaml",
        ),
      );
    } else if (/^phase_[0-2]/.test((asString(getPath(state, "project.phase")) ?? "").toLowerCase())) {
      const kickoffAgeDays = Math.floor((Date.now() - new Date(`${kickoffRaw}T00:00:00Z`).getTime()) / 86_400_000);
      if (kickoffAgeDays > PRE_BUILD_STALL_DAYS) {
        issues.push(
          issue(
            "warning",
            "project.pre_build_stall",
            `This launch has been in pre-build phases for ${kickoffAgeDays} days (kickoff ${kickoffRaw}). Pre-build work is a means, not a residence — ` +
              `cut scope to essentials, re-run the Go/Pivot/Kill checkpoint, or record the deliberate founder choice to continue with a dated reason ` +
              `(see launch-phases.md "The Pre-Build Clock").`,
            "state/PROJECT_STATE.yaml",
          ),
        );
      }
    }
  }

  // Phase-gated coverage: used inside the lane loop below.
  const currentPhase = asString(getPath(state, "project.phase")) ?? "";
  const pastOrient = isPastOrientPhase(currentPhase);

  for (const lane of requiredLanes) {
    const lanePath = `lanes.${lane}`;
    if (!isRecord(getPath(state, lanePath))) {
      issues.push(issue("error", `${lanePath}.missing`, `${lanePath} is required.`, "state/PROJECT_STATE.yaml"));
      continue;
    }
    requireStatus(state, `${lanePath}.status`, issues);
    const evidence = asArray(getPath(state, `${lanePath}.evidence`));
    const nonEmptyEvidence = evidence.filter((item) => (typeof item === "string" ? item.trim().length > 0 : Boolean(item)));
    for (const [index, evidenceItem] of evidence.entries()) {
      if (typeof evidenceItem === "string" && evidenceItem.trim().length === 0) {
        issues.push(issue("error", `${lanePath}.evidence.${index}.blank`, `${lanePath}.evidence entries must not be blank.`, "state/PROJECT_STATE.yaml"));
      }
    }
    const status = asString(getPath(state, `${lanePath}.status`));
    if (status === "done" && nonEmptyEvidence.length === 0) {
      issues.push(issue("error", `${lanePath}.done_without_evidence`, `${lanePath} cannot be done without evidence paths.`, "state/PROJECT_STATE.yaml"));
    }
    const blockers = asArray(getPath(state, `${lanePath}.blockers`));
    const nonEmptyBlockers = blockers.filter((item) => (typeof item === "string" ? item.trim().length > 0 : Boolean(item)));
    for (const [index, blocker] of blockers.entries()) {
      if (typeof blocker === "string" && blocker.trim().length === 0) {
        issues.push(issue("error", `${lanePath}.blockers.${index}.blank`, `${lanePath}.blockers entries must not be blank.`, "state/PROJECT_STATE.yaml"));
      }
    }
    if (status === "blocked" && nonEmptyBlockers.length === 0) {
      issues.push(issue("error", `${lanePath}.blocked_without_blocker`, `${lanePath} is blocked but has no blocker.`, "state/PROJECT_STATE.yaml"));
    }
    if ((status === "deferred" || status === "not_needed") && nonEmptyBlockers.length === 0 && nonEmptyEvidence.length === 0) {
      issues.push(
        issue(
          "error",
          `${lanePath}.${status}_without_reason`,
          `${lanePath} is ${status} but has no evidence or blocker/reason explaining why.`,
          "state/PROJECT_STATE.yaml",
        ),
      );
    }

    // Phase-gated coverage rules (added alongside existing checks; do not replace them).
    // Once the project moves past the orient/scaffold window (phase_1+), lanes
    // still at not_started are a hard error because they represent work the
    // project claimed to be doing but never started.
    if (status === "not_started" && pastOrient) {
      issues.push(
        issue(
          "error",
          `${lanePath}.not_started_past_orient`,
          `${lanePath} is not_started but the project is past the orient phase (${currentPhase}). Start the lane, block it with a reason, or explicitly mark it not_needed or deferred.`,
          "state/PROJECT_STATE.yaml",
        ),
      );
    }

    // A lane that is partial with no evidence, no blockers, and no reason
    // string is a silent stall — flag it as a warning so it surfaces in the
    // audit output without breaking the run.
    if (status === "partial" && nonEmptyEvidence.length === 0 && nonEmptyBlockers.length === 0) {
      const reason = asString(getPath(state, `${lanePath}.reason`));
      if (!reason?.trim()) {
        issues.push(
          issue(
            "warning",
            `${lanePath}.partial_no_evidence_no_blocker`,
            `${lanePath} is partial but has no evidence paths, no blockers, and no reason. Add an evidence path, a blocker, or a reason field to show intentional progress.`,
            "state/PROJECT_STATE.yaml",
          ),
        );
      } else {
        // Tier-1: reason exists but validate it is dated and non-trivial.
        validateReason(reason, lanePath, "partial stall", issues);
      }
    }

    // Tier-1: deferred/not_needed reasons must also be dated and non-trivial.
    if (
      (status === "deferred" || status === "not_needed") &&
      (nonEmptyEvidence.length > 0 || nonEmptyBlockers.length > 0 || asString(getPath(state, `${lanePath}.reason`))?.trim())
    ) {
      const reason = asString(getPath(state, `${lanePath}.reason`));
      // Only validate the reason field itself when it exists; blockers/evidence
      // satisfy the base "has a rationale" check already handled above, but we
      // also validate the free-text reason when it is present because that is
      // where staleness info lives.
      if (reason?.trim()) {
        validateReason(reason, lanePath, status, issues);
      }
    }
    if (status === "done") {
      for (const evidenceItem of evidence) {
        const evidencePath = asString(evidenceItem);
        if (!evidencePath || /^[a-z]+:/i.test(evidencePath) || evidencePath.startsWith("#")) {
          // URLs (http://, https://, revcat://, etc.) and anchor-style notes are
          // intentionally skipped for the existsSync check — they are remote or
          // human-readable references, not local paths.
          continue;
        }
        const looksLikeLocalPath = evidencePath.includes("/") || evidencePath.includes(".");
        if (looksLikeLocalPath) {
          // Local-path-style evidence: must exist on disk.
          const localEvidencePath = path.join(args.root, evidencePath);
          if (!existsSync(localEvidencePath)) {
            issues.push(
              issue(
                "error",
                `${lanePath}.done_evidence_missing`,
                `${lanePath} is done but local evidence path does not exist: ${evidencePath}.`,
                "state/PROJECT_STATE.yaml",
              ),
            );
          }
        } else {
          // Tier-1: bare word with no slash and no dot — not resolvable as a
          // local path and not a URL/anchor.  Surface as a warning so a note
          // like "submitted" or "approved" is visible rather than a silent free
          // pass.  Do NOT error — note-style evidence is sometimes legitimate
          // (e.g. "App Store review approved").
          issues.push(
            issue(
              "warning",
              `${lanePath}.evidence.not_a_resolvable_path`,
              `${lanePath} evidence entry "${evidencePath}" is not a resolvable local path and not a URL/anchor reference. ` +
                `If this is a human note, prefix it with "#" so its intent is explicit. ` +
                `If it is a file path, ensure it contains a "/" or "." so existence can be verified.`,
              "state/PROJECT_STATE.yaml",
            ),
          );
        }
      }
    }
  }

  const tools = getPath(state, "tools");
  if (!isRecord(tools)) {
    issues.push(
      issue(
        "error",
        "tools.missing",
        "tools must map provider names to route, docs, secrets, preflight, validation, and fallback state.",
        "state/PROJECT_STATE.yaml",
      ),
    );
  } else {
    for (const [toolName, value] of Object.entries(tools)) {
      if (!isRecord(value)) {
        issues.push(issue("error", `tools.${toolName}.invalid`, `tools.${toolName} must be an object.`, "state/PROJECT_STATE.yaml"));
        continue;
      }
      for (const field of ["route", "preflight", "validation", "fallback"]) {
        if (!asString(value[field])?.trim()) {
          issues.push(issue("warning", `tools.${toolName}.${field}.missing`, `tools.${toolName}.${field} should be recorded.`, "state/PROJECT_STATE.yaml"));
        }
      }
      const requiredSecrets = asArray(value.required_secrets);
      for (const secretName of requiredSecrets) {
        if (!asString(secretName)?.trim()) {
          issues.push(
            issue(
              "error",
              `tools.${toolName}.required_secrets.invalid`,
              `tools.${toolName}.required_secrets must contain names only.`,
              "state/PROJECT_STATE.yaml",
            ),
          );
        }
      }
    }
  }

  const activeCards = asArray(getPath(state, "failure_cards.active"));
  for (const [index, card] of activeCards.entries()) {
    if (!isRecord(card)) {
      issues.push(issue("error", `failure_cards.active.${index}.invalid`, "Each active failure card must be an object.", "state/PROJECT_STATE.yaml"));
      continue;
    }
    for (const field of ["id", "severity", "owner", "status", "next_action"]) {
      if (!asString(card[field])?.trim()) {
        issues.push(
          issue("error", `failure_cards.active.${index}.${field}.missing`, `Active failure card ${index} is missing ${field}.`, "state/PROJECT_STATE.yaml"),
        );
      }
    }
  }
}

reportAndExit("PROJECT_STATE validation", issues);
