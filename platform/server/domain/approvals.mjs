import { boardStepTitle, presentApprovalAsk } from "./presentation.mjs";
import { createId, launchWorkstreamId } from "./shared.mjs";

/**
 * Mirrors the launch skill's founder approvals into Formation's decision system (the
 * "preserve engine approvals and protected actions" behaviour of the platform-to-skill
 * execution adapter, docs/platform/remaining-gaps.md).
 *
 * The rules this module holds by construction:
 * - The skill's run state is the source of truth. A mirrored decision record never answers,
 *   weakens, or bypasses an engine approval — answering happens only through
 *   core/session/approve.ts, driven by the execution worker, and only after the founder acted.
 * - Silence is never consent. Nothing here runs a clock; an unanswered approval stays an open
 *   decision until the founder answers it or the skill stops asking.
 * - Every transition (create, close, supersede) requires a reachable, ready skill report.
 *   An unreachable engine changes nothing in the store.
 * - Formation's `workspace.founder.operatingMode` shares the skill's grant-level vocabulary,
 *   but it is presentation only on this boundary: no mode auto-answers an approval, because the
 *   engine's grants and waivers — not a platform field — decide what may run without one.
 */

/**
 * Founder-plain phrasing for the skill's protected categories (skill vocabulary stays on the
 * engine side of the boundary; founders read these).
 */
const CATEGORY_PHRASES = Object.freeze({
  spend: "It spends money",
  credentials_access: "It uses accounts or credentials you control",
  legal_pricing: "It touches legal terms or pricing",
  public_actions: "It acts in public on your behalf",
  release: "It ships a release",
  destructive: "It makes changes that are hard to undo",
});

export function approvalRationale(boardTitle, category) {
  const phrase = CATEGORY_PHRASES[category];
  return phrase
    ? `“${boardTitle}” is waiting for your go-ahead. ${phrase}, so it stays parked until you answer — nothing answers this for you.`
    : `“${boardTitle}” is waiting for your go-ahead. It stays parked until you answer — nothing answers this for you.`;
}

/** The board-ready text for one skill approval mirror: title, the ask, and the why. */
function boardApprovalCopy(approval) {
  const stepTitle = boardStepTitle(approval.workflowId, approval.workflowTitle);
  return {
    title: `Your go-ahead: ${stepTitle}`,
    decision: presentApprovalAsk(approval.description, approval.protectedCategory),
    rationale: approvalRationale(stepTitle, approval.protectedCategory),
  };
}

function isEngineApproval(decision) {
  return decision.source?.kind === "engine-approval";
}

/**
 * Reconciles the store's mirrored decisions with a live skill boundary report. Mutates
 * `database` (call inside a store transaction) and returns what changed so the caller can write
 * activity entries. The report must be reachable and ready — callers guard that; this function
 * refuses to run otherwise rather than mutate records from silence.
 *
 * Identity is (approvalId, runId): approval ids are stable per catalog, but a re-seeded engine
 * run asks its questions afresh, so a record answered against an old run is history, not an
 * answer to the new run's question.
 */
export function syncEngineApprovals(database, workspace, report, now) {
  if (report?.workspaceReady !== true) {
    throw new Error("syncEngineApprovals requires a ready skill report; callers must not sync from an unreachable or unready skill.");
  }
  const runId = report.runId ?? null;
  const engineApprovals = report.approvals ?? [];
  const mirrored = database.decisions.filter((entry) => entry.workspaceId === workspace.id && isEngineApproval(entry));

  const changes = { created: [], answeredWithEngine: [], superseded: [] };

  // An open record from a run the skill no longer has cannot be answered any more — the skill
  // is not asking that question. Retiring the mirror is not answering the gate: if the new run
  // asks again, it gets a fresh open record below.
  for (const record of mirrored) {
    if (record.status !== "open" || record.source.runId === runId) continue;
    record.status = "superseded";
    record.note = "The launch plan moved on before this was answered, so Formation is no longer asking it.";
    record.updatedAt = now;
    changes.superseded.push(record);
  }

  for (const approval of engineApprovals) {
    const existing = mirrored.filter((entry) => entry.source.approvalId === approval.approvalId && entry.source.runId === runId);
    const open = existing.find((entry) => entry.status === "open");

    if (approval.status === "pending") {
      // If the skill says pending and no open mirror exists, create one — even when an older
      // record for this run was already resolved. A gate the skill is asking must always be
      // visible; a record that disagrees with the skill is history, never a reason to hide it.
      const board = boardApprovalCopy(approval);
      if (open) {
        // Presentation is a shared, evolving capability: an open mirror created before the
        // board-language table improved refreshes to the current copy. The skill's own wording
        // stays untouched in `source` — this only re-presents, never re-answers.
        if (open.title !== board.title || open.decision !== board.decision || open.rationale !== board.rationale) {
          open.title = board.title;
          open.decision = board.decision;
          open.rationale = board.rationale;
          open.updatedAt = now;
        }
        continue;
      }
      const record = {
        id: createId("dec"),
        workspaceId: workspace.id,
        workstreamId: launchWorkstreamId(workspace),
        title: board.title,
        decision: board.decision,
        rationale: board.rationale,
        status: "open",
        owner: workspace.founder?.name ?? "Founder",
        decidedAt: null,
        reviewAt: null,
        createdAt: now,
        updatedAt: now,
        source: {
          kind: "engine-approval",
          approvalId: approval.approvalId,
          workflowId: approval.workflowId,
          workflowTitle: approval.workflowTitle,
          description: approval.description,
          category: approval.protectedCategory ?? null,
          runId,
          planId: report.planId ?? null,
        },
        answer: null,
      };
      database.decisions.push(record);
      changes.created.push(record);
      continue;
    }

    // approved | rejected. An open mirror means the answer was recorded with the skill directly
    // (its CLI is a sanctioned path too) — close the mirror to match, honestly attributed.
    if (open) {
      const approved = approval.status === "approved";
      open.status = "decided";
      open.decidedAt = now.slice(0, 10);
      open.decision = `${approved ? "Approved" : "Declined"}: ${presentApprovalAsk(approval.description, approval.protectedCategory)}`;
      open.answer = {
        value: approved ? "approved" : "declined",
        answeredBy: "Recorded with Formation's launch records",
        answeredAt: now,
        reason: null,
        recordedVia: "engine",
      };
      open.updatedAt = now;
      changes.answeredWithEngine.push(open);
    }
  }

  return changes;
}

/** Activity entries for what a sync changed, in founder vocabulary. */
export function recordApprovalActivity(database, workspaceId, changes, now) {
  for (const record of changes.created) {
    database.activity.push({
      id: createId("act"),
      workspaceId,
      type: "approval-requested",
      title: `Your decision is needed: ${boardStepTitle(record.source.workflowId, record.source.workflowTitle)}`,
      detail: record.decision,
      actor: "Formation",
      createdAt: now,
    });
  }
  for (const record of changes.answeredWithEngine) {
    database.activity.push({
      id: createId("act"),
      workspaceId,
      type: "approval-answered",
      title: `${record.answer.value === "approved" ? "Approved" : "Declined"}: ${boardStepTitle(record.source.workflowId, record.source.workflowTitle)}`,
      detail: record.decision,
      actor: "Founder",
      createdAt: now,
    });
  }
  for (const record of changes.superseded) {
    database.activity.push({
      id: createId("act"),
      workspaceId,
      type: "approval-superseded",
      title: `No longer asked: ${boardStepTitle(record.source.workflowId, record.source.workflowTitle)}`,
      detail: record.note,
      actor: "Formation",
      createdAt: now,
    });
  }
}

/** The mirrored approval decisions for one workspace, newest first — the approvals view the API returns. */
export function listEngineApprovals(database, workspaceId) {
  return database.decisions
    .filter((entry) => entry.workspaceId === workspaceId && isEngineApproval(entry))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
