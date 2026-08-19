import { createId, launchWorkstreamId } from "./shared.mjs";
import { boardStepTitle } from "./presentation.mjs";

/**
 * Imports the launch skill's verified results into Formation's product records — the import half
 * of the platform-to-skill execution adapter (docs/platform/remaining-gaps.md, "Platform-to-skill
 * execution adapter", slice 3).
 *
 * The rules this module holds by construction:
 * - Only verified results import. The skill's boundary report already exports only settled,
 *   accepted work (`results[]`); this module never reaches past it into run internals, so an
 *   unverified or partially-verified node contributes nothing — not "contributes provisionally".
 * - Imported content enters as a draft, never as accepted fact: results become `recommendation`
 *   claims for founder review, and artifact candidates become `draft` deliverables. Nothing here
 *   creates a fact, answers a decision, or overwrites founder-authored content — a re-imported
 *   deliverable appends an immutable version and updates provenance, leaving the founder's own
 *   sections, title, and status alone.
 * - Staleness mirrors the skill's own conclusions. The skill's invalidateDescendants pass flips
 *   `accepted` off on every affected descendant binding; this module marks exactly the imported
 *   deliverables whose bindings report `accepted: false` and clears the mark when acceptance
 *   returns — never a second graph-walk that could disagree with the skill, and honest in both
 *   directions.
 * - Trace and cost metadata carry names, ids, and declared totals only. Every stored field is
 *   copied by explicit name from the typed report — a skill document is never spread into a
 *   Formation record, so a value that isn't part of the contract cannot leak into the store.
 * - Idempotent across retries: claims key on (runId, attemptId), deliverables on the stable
 *   skill artifact id plus its fingerprint, blocker tasks on the workflow id. Re-importing the
 *   same report changes nothing.
 */

/** Founder-plain phrasing for the skill's verification kinds (skill vocabulary stays behind the boundary). */
const VERIFICATION_PHRASES = Object.freeze({
  deterministic: "passed its checks",
  fresh_context: "was reviewed with fresh eyes before being accepted",
  human: "was confirmed by a person",
  none: "finished without a separate check",
});

/**
 * How much weight an imported result carries before the founder reviews it, by how it was
 * verified. Deliberately capped below the certainty a founder's own acceptance would express:
 * these are drafts to review, not settled truth.
 */
const VERIFICATION_CONFIDENCE = Object.freeze({
  deterministic: 85,
  human: 80,
  fresh_context: 70,
  none: 55,
});

/** Mirrors the claims API's own evidence bounds (validation.mjs: 20 items, TEXT_LIMITS.listItem). */
const EVIDENCE_ITEM_LIMIT = 20;
const EVIDENCE_ITEM_LENGTH = 2_000;

const STALE_REASON = "Earlier launch work this was built on changed, so Formation plans to redo it.";

function verificationPhrase(kind) {
  return VERIFICATION_PHRASES[kind] ?? VERIFICATION_PHRASES.none;
}

function verificationConfidence(kind) {
  return VERIFICATION_CONFIDENCE[kind] ?? VERIFICATION_CONFIDENCE.none;
}

function boundEvidence(evidence) {
  if (!Array.isArray(evidence)) return [];
  return evidence
    .filter((entry) => typeof entry === "string" && entry.trim().length > 0)
    .slice(0, EVIDENCE_ITEM_LIMIT)
    .map((entry) => (entry.length > EVIDENCE_ITEM_LENGTH ? `${entry.slice(0, EVIDENCE_ITEM_LENGTH - 1)}…` : entry));
}

/** Declared cost copied field-by-field; anything beyond amount and currency never crosses. */
function boundCostEstimate(estimate) {
  if (!estimate || !Number.isFinite(estimate.amount) || typeof estimate.currency !== "string") return null;
  return { amount: estimate.amount, currency: estimate.currency };
}

function isEngineResultClaim(claim) {
  return claim.source?.kind === "engine-result";
}

function isEngineArtifact(artifact) {
  return artifact.source?.kind === "engine-artifact";
}

function isEngineBlockerTask(task) {
  return task.source?.kind === "engine-blocker";
}

/**
 * The declared trace/cost rollup for one ready report: ids and totals only. This is what an
 * execution record carries as its imported-results summary.
 */
export function buildResultTotals(report) {
  const results = report?.results ?? [];
  let declaredTokenBudget = 0;
  const byCurrency = new Map();
  for (const result of results) {
    if (Number.isFinite(result.declaredTokenBudget)) declaredTokenBudget += result.declaredTokenBudget;
    const estimate = boundCostEstimate(result.declaredCostEstimate);
    if (estimate) byCurrency.set(estimate.currency, (byCurrency.get(estimate.currency) ?? 0) + estimate.amount);
  }
  return {
    verifiedResults: results.length,
    declaredTokenBudget,
    declaredCostEstimates: [...byCurrency.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({ currency, amount })),
  };
}

/**
 * Reconciles the store's imported records with a live skill boundary report. Mutates `database`
 * (call inside a store transaction) and returns what changed so the caller can write activity
 * entries. The report must be reachable and ready — callers guard that; this function refuses to
 * run otherwise rather than import from silence.
 */
export function syncEngineResults(database, workspace, report, now) {
  if (report?.workspaceReady !== true) {
    throw new Error("syncEngineResults requires a ready skill report; callers must not import from an unreachable or unready skill.");
  }
  const changes = {
    claimsCreated: [],
    claimsSuperseded: [],
    artifactsCreated: [],
    artifactsUpdated: [],
    markedStale: [],
    markedFresh: [],
    tasksOpened: [],
    tasksClosed: [],
    totals: buildResultTotals(report),
  };
  // Results and artifact state exist only for the durable run (`runId` present); the workflow
  // list is always present on a ready report, so blocker mirroring runs regardless.
  if (report.runId) {
    importVerifiedResults(database, workspace, report, now, changes);
    mirrorArtifactStaleness(database, workspace, report, now, changes);
  }
  syncBlockerTasks(database, workspace, report, now, changes);
  return changes;
}

function importVerifiedResults(database, workspace, report, now, changes) {
  const runId = report.runId;
  const workspaceClaims = database.claims.filter((claim) => claim.workspaceId === workspace.id && isEngineResultClaim(claim));

  for (const result of report.results ?? []) {
    const alreadyImported = workspaceClaims.some((claim) => claim.source.runId === runId && claim.source.attemptId === result.attemptId);
    let resultClaim = workspaceClaims.find((claim) => claim.source.workflowId === result.workflowId && claim.status === "active");

    if (!alreadyImported) {
      // A newer verified attempt replaces the previous result claim for the same step: the old
      // recommendation is history, not a second live claim to weigh against the new one.
      for (const claim of workspaceClaims) {
        if (claim.source.workflowId !== result.workflowId || claim.status !== "active") continue;
        claim.status = "superseded";
        claim.updatedAt = now;
        changes.claimsSuperseded.push(claim);
      }

      const phrase = verificationPhrase(result.verification);
      resultClaim = {
        id: createId("clm"),
        workspaceId: workspace.id,
        workstreamId: launchWorkstreamId(workspace),
        kind: "recommendation",
        key: null,
        statement: `Formation finished “${boardStepTitle(result.workflowId, result.workflowTitle)}” and the work ${phrase}. Review the result before treating it as fact.`,
        value: null,
        confidence: verificationConfidence(result.verification),
        status: "active",
        evidence: boundEvidence(result.evidence),
        createdAt: now,
        updatedAt: now,
        source: {
          kind: "engine-result",
          workflowId: result.workflowId,
          workflowTitle: result.workflowTitle,
          attemptId: result.attemptId,
          runId,
          planId: report.planId ?? null,
          verification: result.verification,
          declaredTokenBudget: Number.isFinite(result.declaredTokenBudget) ? result.declaredTokenBudget : null,
          declaredCostEstimate: boundCostEstimate(result.declaredCostEstimate),
        },
      };
      database.claims.push(resultClaim);
      workspaceClaims.push(resultClaim);
      changes.claimsCreated.push(resultClaim);
    }

    importArtifactCandidates(database, workspace, report, result, resultClaim, now, changes);
  }
}

function importArtifactCandidates(database, workspace, report, result, resultClaim, now, changes) {
  const candidates = result.artifacts ?? [];
  for (const [index, candidate] of candidates.entries()) {
    const existing = database.artifacts.find(
      (artifact) => artifact.workspaceId === workspace.id && isEngineArtifact(artifact) && artifact.source.engineArtifactId === candidate.artifactId,
    );

    if (!existing) {
      const boardTitle = boardStepTitle(result.workflowId, result.workflowTitle);
      const title = candidates.length > 1 ? `${boardTitle} (${index + 1} of ${candidates.length})` : boardTitle;
      const phrase = verificationPhrase(result.verification);
      const artifact = {
        id: createId("art"),
        workspaceId: workspace.id,
        workstreamId: launchWorkstreamId(workspace),
        type: "launch-deliverable",
        title,
        status: "draft",
        version: 1,
        confidence: verificationConfidence(result.verification),
        summary: `Formation produced this while working on “${boardTitle}”, and the work ${phrase} before arriving here. It stays a draft until you review it.`,
        sections: [
          {
            id: `sec_${createId("x").slice(2, 10)}`,
            title: "Where this came from",
            body: `Formation completed “${boardTitle}” and the work ${phrase}. The result arrives as an editable draft — review it, adjust it, and approve it when it matches your intent. Nothing downstream should rely on it until you do.` + (result.workflowTitle && result.workflowTitle !== boardTitle ? ` (Technical step name: ${result.workflowTitle}.)` : ""),
          },
        ],
        sourceClaimIds: resultClaim ? [resultClaim.id] : [],
        linkedDecisionIds: [],
        stale: false,
        staleReason: null,
        staleSince: null,
        createdAt: now,
        updatedAt: now,
        source: {
          kind: "engine-artifact",
          engineArtifactId: candidate.artifactId,
          fingerprint: candidate.fingerprint,
          workflowId: result.workflowId,
          workflowTitle: result.workflowTitle,
          attemptId: result.attemptId,
          runId: report.runId,
          importedAt: now,
        },
      };
      database.artifacts.push(artifact);
      database.artifactVersions.push(buildImportedVersion(artifact, now));
      changes.artifactsCreated.push(artifact);
      continue;
    }

    if (existing.source.fingerprint === candidate.fingerprint) continue;

    // A newer verified result replaced the skill's output. Provenance and version history move
    // forward; the founder's own title, status, and sections are never touched.
    existing.version = Number.isInteger(existing.version) ? existing.version + 1 : 1;
    existing.stale = false;
    existing.staleReason = null;
    existing.staleSince = null;
    existing.updatedAt = now;
    if (resultClaim && Array.isArray(existing.sourceClaimIds) && !existing.sourceClaimIds.includes(resultClaim.id)) {
      existing.sourceClaimIds = [...existing.sourceClaimIds, resultClaim.id].slice(0, 100);
    }
    existing.source = {
      ...existing.source,
      fingerprint: candidate.fingerprint,
      workflowId: result.workflowId,
      workflowTitle: result.workflowTitle,
      attemptId: result.attemptId,
      runId: report.runId,
      importedAt: now,
    };
    database.artifactVersions.push(buildImportedVersion(existing, now));
    changes.artifactsUpdated.push(existing);
  }
}

/** An immutable version snapshot for an imported change, attributed to the skill, never a founder. */
function buildImportedVersion(artifact, now) {
  return {
    id: createId("ver"),
    artifactId: artifact.id,
    workspaceId: artifact.workspaceId,
    workstreamId: artifact.workstreamId,
    version: artifact.version,
    title: artifact.title,
    status: artifact.status,
    confidence: artifact.confidence,
    summary: artifact.summary,
    sections: structuredClone(artifact.sections),
    sourceClaimIds: [...(artifact.sourceClaimIds ?? [])],
    linkedDecisionIds: [...(artifact.linkedDecisionIds ?? [])],
    createdAt: now,
    createdBy: "Formation",
  };
}

/**
 * Mirrors the skill's per-artifact acceptance conclusions onto imported deliverables. Marking is
 * exact in both directions: only a binding the skill reports as no longer accepted marks its
 * deliverable stale, and only restored acceptance of the very fingerprint we imported clears it.
 * A binding missing from the report (the plan moved on) changes nothing — absence is not evidence.
 * The stale mark is currency metadata, not a content change, so it does not consume a version.
 */
function mirrorArtifactStaleness(database, workspace, report, now, changes) {
  const states = new Map((report.artifacts ?? []).map((entry) => [entry.artifactId, entry]));
  for (const artifact of database.artifacts) {
    if (artifact.workspaceId !== workspace.id || !isEngineArtifact(artifact)) continue;
    const state = states.get(artifact.source.engineArtifactId);
    if (!state) continue;

    if (state.accepted === false && artifact.stale !== true) {
      artifact.stale = true;
      artifact.staleReason = STALE_REASON;
      artifact.staleSince = now;
      artifact.updatedAt = now;
      changes.markedStale.push(artifact);
    } else if (state.accepted === true && state.fingerprint === artifact.source.fingerprint && artifact.stale === true) {
      artifact.stale = false;
      artifact.staleReason = null;
      artifact.staleSince = null;
      artifact.updatedAt = now;
      changes.markedFresh.push(artifact);
    }
  }
}

/**
 * Mirrors the skill's failed steps as founder tasks. Only "failed" mirrors — an autonomy park is
 * configuration the run view already reports, and mirroring every parked step of an ungranted
 * workspace would bury the founder in tasks the skill never asked for. A task closes when the
 * skill stops reporting its step as failed; if the step fails again later, a fresh task opens.
 */
function syncBlockerTasks(database, workspace, report, now, changes) {
  const failedSteps = new Map((report.workflows ?? []).filter((entry) => entry.status === "failed").map((entry) => [entry.workflowId, entry]));
  const mirrored = database.tasks.filter((task) => task.workspaceId === workspace.id && isEngineBlockerTask(task));

  for (const task of mirrored) {
    if (task.status === "done" || failedSteps.has(task.source.workflowId)) continue;
    task.status = "done";
    task.updatedAt = now;
    changes.tasksClosed.push(task);
  }

  for (const [workflowId, step] of failedSteps) {
    const open = mirrored.find((task) => task.source.workflowId === workflowId && task.status !== "done");
    if (open) continue;
    const task = {
      id: createId("tsk"),
      workspaceId: workspace.id,
      workstreamId: launchWorkstreamId(workspace),
      title: `A launch step needs attention: ${boardStepTitle(workflowId, step.title)} did not go through`,
      status: "next",
      priority: "high",
      owner: workspace.founder?.name ?? "Founder",
      dueAt: null,
      createdAt: now,
      updatedAt: now,
      source: {
        kind: "engine-blocker",
        workflowId,
        workflowTitle: step.title,
        runId: report.runId ?? null,
        reason: typeof step.founderReason === "string" ? step.founderReason : null,
      },
    };
    database.tasks.push(task);
    changes.tasksOpened.push(task);
  }
}

/** Activity entries for what an import changed, in founder vocabulary. */
export function recordResultActivity(database, workspaceId, changes, now) {
  const push = (type, title, detail) => {
    database.activity.push({ id: createId("act"), workspaceId, type, title, detail, actor: "Formation", createdAt: now });
  };
  for (const claim of changes.claimsCreated) {
    push("result-imported", `Launch result imported: ${claim.source.workflowTitle}`, claim.statement);
  }
  for (const artifact of changes.artifactsCreated) {
    push("deliverable-imported", `New draft deliverable from Formation: ${artifact.title}`, artifact.summary);
  }
  for (const artifact of changes.artifactsUpdated) {
    push("deliverable-updated", `Deliverable refreshed by Formation: ${artifact.title}`, "A newer verified result replaced the previous version. Your own edits were not touched.");
  }
  for (const artifact of changes.markedStale) {
    push("deliverable-stale", `Needs a refresh: ${artifact.title}`, artifact.staleReason ?? STALE_REASON);
  }
  for (const artifact of changes.markedFresh) {
    push("deliverable-fresh", `Up to date again: ${artifact.title}`, "The launch work this deliverable was built on is settled again.");
  }
  for (const task of changes.tasksOpened) {
    push("engine-blocker-opened", `Formation could not finish: ${task.source.workflowTitle}`, task.source.reason ?? "Formation kept its own record of what happened.");
  }
  for (const task of changes.tasksClosed) {
    push("engine-blocker-closed", `No longer stuck: ${task.source.workflowTitle}`, "Formation is no longer reporting this step as failed.");
  }
}
