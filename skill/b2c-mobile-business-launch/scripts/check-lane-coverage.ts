#!/usr/bin/env node
/**
 * check-lane-coverage.ts — aggregate readiness floor for all required lanes.
 *
 * Reports a coverage ledger that makes "did nothing" loud:
 *
 *   ERROR   — lane is not_started and the project is past the orient phase
 *   ERROR   — lane is partial and the project is past orient AND has neither
 *             evidence nor blockers nor a reason field
 *   WARNING — lane is partial with no evidence, no blockers, and no reason
 *             (regardless of phase — silent stall is always visible)
 *   CLEAN   — done (with evidence) | blocked (with blocker) |
 *             not_needed (with reason) | deferred (with reason)
 *
 * npm script: check:lane-coverage
 * Usage: tsx scripts/check-lane-coverage.ts --root /path/to/app
 */

import {
  asArray,
  asString,
  getPath,
  isRecord,
  isPastOrientPhase,
  issue,
  Issue,
  laneDependencies,
  loadProjectState,
  parseCliArgs,
  reportAndExit,
  requiredLanes,
  satisfiedDependencyStatuses,
  validateLaneDependencyGraph,
  validateReason,
} from "./lib/launch-state.js";

/**
 * Calls validateReason and returns the count of new warnings pushed (0 or 1+).
 * This lets the caller keep the counts.warning ledger accurate.
 */
function validateReasonAndCount(reason: string | undefined, lanePath: string, context: string, issues: Issue[]): number {
  const before = issues.length;
  validateReason(reason, lanePath, context, issues);
  // Count only warnings that were actually pushed.
  return issues.slice(before).filter((i) => i.severity === "warning").length;
}

/**
 * Edge rule: a lane may not claim `done` while an upstream lane it depends on
 * is still not_started, partial, or blocked.
 *
 * This is the machine-readable form of "Lock phase outputs before depending on
 * them" (SKILL.md, Operating Posture) and the Flow Gates in
 * flow-traceability.md — previously prose only, and therefore self-attestable.
 *
 * The escape hatch is `lanes.<lane>.dependency_override`: a dated reason
 * downgrades the error to a warning and is itself checked for staleness. Silent
 * bypass is not available, which is the point.
 */
function checkLaneDependencies(state: unknown, lane: string, issues: Issue[]): { errors: number; warnings: number } {
  const dependencies = laneDependencies[lane] ?? [];
  if (dependencies.length === 0) return { errors: 0, warnings: 0 };

  const unlocked = dependencies
    .map((dep) => ({ dep, status: asString(getPath(state, `lanes.${dep}.status`)) ?? "missing" }))
    .filter(({ status }) => !satisfiedDependencyStatuses.has(status));

  if (unlocked.length === 0) return { errors: 0, warnings: 0 };

  const detail = unlocked.map(({ dep, status }) => `${dep} (${status})`).join(", ");
  const override = asString(getPath(state, `lanes.${lane}.dependency_override`));
  const hasOverride = Boolean(override?.trim());

  if (hasOverride) {
    // Overridden: surface it as a warning that never goes quiet, and hold the
    // reason to the same dated/substantive/stale bar as every other reason.
    issues.push(
      issue(
        "warning",
        `lane_coverage.${lane}.dependency_overridden`,
        `lanes.${lane} is done while upstream ${detail} is unlocked, permitted by dependency_override. ` +
          `Confirm the override still holds; an upstream lane that never locks means this lane's evidence rests on a moving input.`,
        "PROJECT_STATE.yaml",
      ),
    );
    const reasonWarnings = validateReasonAndCount(override, `lanes.${lane}`, "dependency override", issues);
    return { errors: 0, warnings: 1 + reasonWarnings };
  }

  issues.push(
    issue(
      "error",
      `lane_coverage.${lane}.dependency_unlocked`,
      `lanes.${lane} is done but upstream ${detail} is not locked. ` +
        `A lane cannot be finished on an input that is still moving (SKILL.md: "Lock phase outputs before depending on them"). ` +
        `Advance the upstream lane to done/not_needed/deferred, or record a dated lanes.${lane}.dependency_override explaining why this lane is genuinely independent of it.`,
      "PROJECT_STATE.yaml",
    ),
  );
  return { errors: 1, warnings: 0 };
}

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;

// Authoring-integrity guard on the shipped edge map itself (unknown lane ids,
// self-edges, cycles). Cheap, and it fails loudly for the maintainer editing
// laneDependencies rather than silently for the founder running a launch.
validateLaneDependencyGraph(issues);

if (state) {
  const currentPhase = asString(getPath(state, "project.phase")) ?? "";
  const pastOrient = isPastOrientPhase(currentPhase);

  const counts = {
    clean: 0,
    warning: 0,
    error: 0,
    missing: 0,
  };

  for (const lane of requiredLanes) {
    const lanePath = `lanes.${lane}`;

    if (!isRecord(getPath(state, lanePath))) {
      counts.missing += 1;
      issues.push(
        issue(
          "error",
          `lane_coverage.${lane}.missing`,
          `${lanePath} is missing entirely. All ${requiredLanes.length} required lanes must be present in PROJECT_STATE.yaml.`,
          "PROJECT_STATE.yaml",
        ),
      );
      continue;
    }

    const status = asString(getPath(state, `${lanePath}.status`));
    const evidence = asArray(getPath(state, `${lanePath}.evidence`));
    const nonEmptyEvidence = evidence.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    const blockers = asArray(getPath(state, `${lanePath}.blockers`));
    const nonEmptyBlockers = blockers.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    const reason = asString(getPath(state, `${lanePath}.reason`));
    const hasReason = Boolean(reason?.trim());
    const hasAnyEvidence = nonEmptyEvidence.length > 0;
    const hasAnyBlocker = nonEmptyBlockers.length > 0;

    // --- not_started ---
    if (status === "not_started") {
      if (pastOrient) {
        // Past orient: not_started is a hard error.
        counts.error += 1;
        issues.push(
          issue(
            "error",
            `lane_coverage.${lane}.not_started_past_orient`,
            `lanes.${lane} is not_started but the project is past the orient phase (${currentPhase || "unknown"}). ` +
              `Start the lane, block it with a reason, or explicitly mark it not_needed or deferred.`,
            "PROJECT_STATE.yaml",
          ),
        );
      } else {
        // Still in orient window: not_started is expected and clean.
        counts.clean += 1;
      }
      continue;
    }

    // --- partial ---
    if (status === "partial") {
      const silentStall = !hasAnyEvidence && !hasAnyBlocker && !hasReason;
      if (silentStall && pastOrient) {
        // Partial + no evidence + no blocker + no reason, past orient = error.
        counts.error += 1;
        issues.push(
          issue(
            "error",
            `lane_coverage.${lane}.partial_stall_past_orient`,
            `lanes.${lane} is partial with no evidence, no blockers, and no reason — and the project is past the orient phase (${currentPhase || "unknown"}). ` +
              `Add an evidence path, a blocker, or a reason field to show intentional progress, or advance the lane status.`,
            "PROJECT_STATE.yaml",
          ),
        );
      } else if (silentStall) {
        // Partial + silent stall during orient window = warning.
        counts.warning += 1;
        issues.push(
          issue(
            "warning",
            `lane_coverage.${lane}.partial_no_evidence_no_blocker`,
            `lanes.${lane} is partial but has no evidence paths, no blockers, and no reason. ` +
              `Add an evidence path, a blocker, or a reason field to show intentional progress.`,
            "PROJECT_STATE.yaml",
          ),
        );
      } else {
        // Partial with at least some signal = counts as in-flight but clean.
        counts.clean += 1;
        // Tier-1: validate that the reason (if present) is dated and non-trivial.
        if (hasReason) {
          counts.warning += validateReasonAndCount(reason, `lanes.${lane}`, "partial stall", issues);
        }
      }
      continue;
    }

    // --- done ---
    if (status === "done") {
      if (!hasAnyEvidence) {
        // done without evidence = error (existing rule mirrored here for the ledger).
        counts.error += 1;
        issues.push(
          issue(
            "error",
            `lane_coverage.${lane}.done_without_evidence`,
            `lanes.${lane} is done but has no evidence paths. Done status requires at least one concrete artifact path or live-proof reference.`,
            "PROJECT_STATE.yaml",
          ),
        );
      } else {
        counts.clean += 1;
      }

      // Edge check runs regardless of the evidence outcome: "done with evidence"
      // on an unlocked upstream is exactly the drift this rule exists to catch.
      const edge = checkLaneDependencies(state, lane, issues);
      counts.error += edge.errors;
      counts.warning += edge.warnings;
      continue;
    }

    // --- blocked ---
    if (status === "blocked") {
      if (!hasAnyBlocker) {
        // blocked without a blocker = error (existing rule mirrored here).
        counts.error += 1;
        issues.push(
          issue(
            "error",
            `lane_coverage.${lane}.blocked_without_blocker`,
            `lanes.${lane} is blocked but has no blocker entry. Add at least one non-empty string to the blockers array.`,
            "PROJECT_STATE.yaml",
          ),
        );
      } else {
        counts.clean += 1;
      }
      continue;
    }

    // --- not_needed | deferred ---
    if (status === "not_needed" || status === "deferred") {
      if (!hasAnyEvidence && !hasAnyBlocker && !hasReason) {
        // Skipping without a reason = error.
        counts.error += 1;
        issues.push(
          issue(
            "error",
            `lane_coverage.${lane}.${status}_without_reason`,
            `lanes.${lane} is ${status} but has no evidence, blockers, or reason explaining why. ` +
              `Record the rationale so a future agent can verify the skip is intentional.`,
            "PROJECT_STATE.yaml",
          ),
        );
      } else {
        counts.clean += 1;
        // Tier-1: if a free-text reason is present, validate it is dated and non-trivial.
        if (hasReason) {
          counts.warning += validateReasonAndCount(reason, `lanes.${lane}`, status, issues);
        }
      }
      continue;
    }

    // Unknown / invalid status: not our job to validate here (validate-project-state handles it),
    // but count it so the ledger total is complete.
    counts.missing += 1;
  }

  // Ledger summary line always printed regardless of errors.
  const total = requiredLanes.length;
  const phaseLabel = currentPhase || "unknown";
  console.log(`Lane coverage ledger — phase: ${phaseLabel} | past-orient enforcement: ${pastOrient ? "ON" : "OFF"}`);
  console.log(`  ${counts.clean}/${total} clean  |  ${counts.warning} warning(s)  |  ${counts.error} error(s)  |  ${counts.missing} missing`);
}

reportAndExit("Lane coverage check", issues);
