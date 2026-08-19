import { createId, launchWorkstreamId } from "./shared.mjs";
import { deliverableText, screenUntrustedText } from "./trust.mjs";

/**
 * Brings an existing launch repository's recorded work into Formation — the platform half of the
 * importer (docs/platform/remaining-gaps.md, "Existing launch repository importer"). The skill
 * half (`core/adapters/platform-import.ts`) reads the launch workspace and returns a typed report;
 * nothing in this module has, or can obtain, a path back into that workspace.
 *
 * The rules this module holds by construction:
 *
 * - **Preview and apply are the same computation.** `buildImportPlan` decides everything; apply
 *   only executes what the plan already said. A dry run that is a second implementation of the
 *   real thing is a dry run that eventually disagrees with it, and the whole point of showing a
 *   founder what an import will do is that it is what the import does.
 * - **Nothing imports as fact.** Recorded lane completions become `recommendation` claims to
 *   review, open questions become `question` claims, and documents become `draft` deliverables
 *   with an immutable first version. A launch workspace is an agent's working record, not evidence.
 * - **Founder work is never overwritten.** A company field is filled only when it is empty; where
 *   the launch workspace disagrees with what the founder has written, the disagreement becomes a
 *   claim naming both, not a silent replacement. A deliverable the founder has edited is never
 *   rewritten by a later import — it is marked as having drifted from its source instead.
 * - **Idempotent by content, not by order.** Every record keys on the skill's `importKey`, which
 *   is derived from what the record is. Re-importing an unchanged workspace changes nothing.
 * - **Contradictions travel with the records they undermine.** The skill reports them; this
 *   module carries them into the plan and records them as open questions on apply, so the doubt
 *   ends up in front of the founder rather than being resolved on their behalf.
 * - **Imported text that reads as an instruction is flagged, never edited.** A launch repository is
 *   a directory of Markdown that anyone with write access to it produced, and Formation assembles
 *   its own records into the context sent to a language model. `domain/trust.mjs` screens the text
 *   on the way in; the document still imports, word for word, and the founder is told — and
 *   `domain/prompts.mjs` keeps it out of a draft until they say otherwise.
 */

/** Where each engine lane's work belongs in the founder's own workstreams. */
const WORKSTREAM_BY_LANE = Object.freeze({
  research: "market",
  experience: "product",
  product: "product",
  onboarding: "product",
  design: "brand",
  emotional_design: "brand",
  content_assets: "go-to-market",
  paid_user_acquisition: "go-to-market",
  email: "go-to-market",
  growth: "go-to-market",
  revenue: "business-model",
});

/** How much weight an imported record carries before the founder looks at it. Deliberately modest. */
const IMPORTED_CONFIDENCE = Object.freeze({
  laneComplete: 55,
  question: 0,
  contradiction: 0,
  companyDisagreement: 40,
  deliverable: 45,
});

/** The company fields a launch workspace can speak to, and where each one lands. */
const COMPANY_FIELDS = Object.freeze([
  { reportField: "oneLiner", companyField: "oneLiner", label: "the company's one-line description" },
  { reportField: "targetCustomer", companyField: "targetCustomer", label: "the primary customer" },
]);

const IMPORT_SOURCE_KIND = "legacy-import";

const DELIVERABLE_DRIFT_REASON =
  "The launch workspace's copy of this document changed after you edited this one, so the two no longer match.";

function isImported(record) {
  return record.source?.kind === IMPORT_SOURCE_KIND;
}

function workstreamFor(workspace, laneKey) {
  const preferred = laneKey ? WORKSTREAM_BY_LANE[laneKey] : undefined;
  const streams = workspace.workstreams ?? [];
  if (preferred && streams.some((entry) => entry.id === preferred)) return preferred;
  return launchWorkstreamId(workspace);
}

/** Provenance stored on every imported record: enough to find the source again, and nothing else. */
function provenance(importKey, origin, sourceId, now, extra = {}) {
  return {
    kind: IMPORT_SOURCE_KIND,
    importKey,
    sourceId,
    sourcePath: origin?.sourcePath ?? null,
    laneKey: origin?.laneKey ?? null,
    laneTitle: origin?.laneLabel ?? null,
    importedAt: now,
    ...extra,
  };
}

/** The content the founder is looking at, hashed, so a later import can tell whether they edited it. */
function sectionsSignature(sections) {
  return JSON.stringify((sections ?? []).map((section) => [section.title, section.body]));
}

/**
 * Decides everything an import would do, without touching the database. The returned plan is both
 * what the preview shows and what apply executes — see the module note on why those must be one
 * computation rather than two.
 */
export function buildImportPlan(database, workspace, report, sourceId, now) {
  if (report?.workspaceReady !== true) {
    throw new Error("buildImportPlan requires a ready import report; callers must not plan an import from an unreadable launch workspace.");
  }

  const plan = {
    sourceId,
    company: report.company ?? null,
    companyFields: [],
    claims: [],
    decisions: [],
    tasks: [],
    deliverables: [],
    retiredClaims: [],
    retiredTasks: [],
    heldBack: [],
    contradictions: (report.contradictions ?? []).map((entry) => ({
      code: entry.code,
      severity: entry.severity,
      message: entry.message,
      relatesTo: entry.relatesTo ?? null,
      sourcePath: entry.origin?.sourcePath ?? null,
    })),
  };

  planCompanyFields(workspace, report, plan);
  planClaims(database, workspace, report, sourceId, now, plan);
  planDecisions(database, workspace, report, sourceId, now, plan);
  planTasks(database, workspace, report, sourceId, now, plan);
  planDeliverables(database, workspace, report, sourceId, now, plan);
  planScreenQuestions(database, workspace, sourceId, now, plan);
  planRetirements(database, workspace, report, plan);

  plan.totals = countPlan(plan);
  return plan;
}

function countPlan(plan) {
  const groups = [plan.claims, plan.decisions, plan.tasks, plan.deliverables];
  const count = (action) => groups.reduce((total, group) => total + group.filter((entry) => entry.action === action).length, 0);
  return {
    creates: count("create"),
    updates: count("update"),
    unchanged: count("unchanged"),
    drifted: count("drifted"),
    retires: plan.retiredClaims.length + plan.retiredTasks.length,
    companyFieldsFilled: plan.companyFields.filter((entry) => entry.action === "fill").length,
    companyFieldsDiffering: plan.companyFields.filter((entry) => entry.action === "differs").length,
    contradictions: plan.contradictions.length,
  };
}

/**
 * A company field is filled only when Formation has nothing there. Where both sides have written
 * something and they differ, the plan records the disagreement and `planClaims` turns it into a
 * claim — the founder reconciles it, because either side could be the one that is out of date.
 */
function planCompanyFields(workspace, report, plan) {
  const company = report.company;
  if (!company) return;
  for (const field of COMPANY_FIELDS) {
    const proposed = (company[field.reportField] ?? "").trim();
    if (!proposed) continue;
    const current = (workspace.company?.[field.companyField] ?? "").trim();
    if (!current) {
      plan.companyFields.push({ ...field, action: "fill", current, proposed });
    } else if (current !== proposed) {
      plan.companyFields.push({ ...field, action: "differs", current, proposed });
    } else {
      plan.companyFields.push({ ...field, action: "same", current, proposed });
    }
  }
}

function planClaims(database, workspace, report, sourceId, now, plan) {
  const existing = database.claims.filter((claim) => claim.workspaceId === workspace.id && isImported(claim));
  const byKey = new Map(existing.map((claim) => [claim.source.importKey, claim]));

  const add = (importKey, kind, statement, evidence, origin, confidence) => {
    const found = byKey.get(importKey);
    if (found) {
      plan.claims.push({ importKey, action: "unchanged", kind, statement: found.statement, existingId: found.id });
      return;
    }
    plan.claims.push({
      importKey,
      action: "create",
      kind,
      statement,
      evidence,
      confidence,
      workstreamId: workstreamFor(workspace, origin?.laneKey),
      origin: origin ?? null,
      sourceId,
      now,
    });
  };

  for (const claim of report.claims ?? []) {
    add(claim.importKey, claim.kind, claim.statement, claim.evidence ?? [], claim.origin, claim.kind === "question" ? IMPORTED_CONFIDENCE.question : IMPORTED_CONFIDENCE.laneComplete);
  }

  // A disagreement between what the founder wrote and what the launch workspace says is a question
  // for the founder, not a field to overwrite. Keyed on the field so re-importing asks once.
  for (const field of plan.companyFields) {
    if (field.action !== "differs") continue;
    add(
      `company-field:${field.companyField}`,
      "question",
      `The launch workspace and Formation describe ${field.label} differently. The workspace says “${trim(field.proposed, 240)}”; Formation says “${trim(field.current, 240)}”. Which is current?`,
      [],
      null,
      IMPORTED_CONFIDENCE.companyDisagreement,
    );
  }

  // A blocking contradiction is something the launch workspace cannot answer for itself. It
  // becomes an open question so it survives the import rather than living only in a preview
  // screen the founder saw once.
  for (const contradiction of plan.contradictions) {
    if (contradiction.severity !== "blocking") continue;
    add(
      `contradiction:${contradiction.code}:${contradiction.relatesTo ?? contradiction.sourcePath ?? "workspace"}`,
      "question",
      trim(contradiction.message, 500),
      contradiction.sourcePath ? [contradiction.sourcePath] : [],
      { sourcePath: contradiction.sourcePath ?? null },
      IMPORTED_CONFIDENCE.contradiction,
    );
  }
}

/**
 * A decision is never revised by an import. A founder who has since changed their mind inside
 * Formation must not have the launch workspace's older record put back on top of it, and a
 * decision the workspace has stopped mentioning is still a decision that was made.
 */
function planDecisions(database, workspace, report, sourceId, now, plan) {
  const existing = database.decisions.filter((entry) => entry.workspaceId === workspace.id && isImported(entry));
  const byKey = new Map(existing.map((entry) => [entry.source.importKey, entry]));
  for (const decision of report.decisions ?? []) {
    const found = byKey.get(decision.importKey);
    if (found) {
      plan.decisions.push({ importKey: decision.importKey, action: "unchanged", title: found.title, existingId: found.id });
      continue;
    }
    plan.decisions.push({
      importKey: decision.importKey,
      action: "create",
      title: decision.title,
      decision: decision.decision,
      rationale: decision.rationale,
      status: decision.status,
      decidedAt: decision.decidedAt ?? null,
      workstreamId: workstreamFor(workspace, decision.origin?.laneKey),
      origin: decision.origin ?? null,
      sourceId,
      now,
    });
  }
}

const PRIORITY_BY_URGENCY = Object.freeze({ critical: "critical", high: "high", medium: "medium" });

function planTasks(database, workspace, report, sourceId, now, plan) {
  const existing = database.tasks.filter((entry) => entry.workspaceId === workspace.id && isImported(entry));
  const byKey = new Map(existing.map((entry) => [entry.source.importKey, entry]));
  for (const task of report.tasks ?? []) {
    const found = byKey.get(task.importKey);
    if (found) {
      plan.tasks.push({ importKey: task.importKey, action: "unchanged", title: found.title, existingId: found.id });
      continue;
    }
    plan.tasks.push({
      importKey: task.importKey,
      action: "create",
      title: task.title,
      status: task.blocked ? "blocked" : "next",
      priority: PRIORITY_BY_URGENCY[task.urgency] ?? "medium",
      workstreamId: workstreamFor(workspace, task.origin?.laneKey),
      origin: task.origin ?? null,
      sourceId,
      now,
    });
  }
}

/**
 * A document imports once as a draft. On a later import:
 *
 * - unchanged source, unchanged draft → nothing happens;
 * - changed source, untouched draft → the draft is refreshed and an immutable version is appended;
 * - changed source, edited draft → the draft is left exactly as the founder left it and marked as
 *   having drifted from its source, because replacing a founder's edit with an agent's file is the
 *   one outcome an importer must never produce.
 */
function planDeliverables(database, workspace, report, sourceId, now, plan) {
  const existing = database.artifacts.filter((entry) => entry.workspaceId === workspace.id && isImported(entry));
  const byKey = new Map(existing.map((entry) => [entry.source.importKey, entry]));

  for (const deliverable of report.deliverables ?? []) {
    const found = byKey.get(deliverable.importKey);
    if (!found) {
      const fresh = screenUntrustedText(deliverableText(deliverable));
      plan.deliverables.push({
        importKey: deliverable.importKey,
        action: "create",
        title: deliverable.title,
        sections: deliverable.sections,
        fingerprint: deliverable.fingerprint,
        workstreamId: workstreamFor(workspace, deliverable.origin?.laneKey),
        origin: deliverable.origin ?? null,
        findings: fresh.findings,
        sourceId,
        now,
      });
      if (fresh.findings.length) {
        plan.heldBack.push({ kind: "deliverable", importKey: deliverable.importKey, label: deliverable.title, findings: fresh.findings });
      }
      continue;
    }
    if (found.source.fingerprint === deliverable.fingerprint) {
      plan.deliverables.push({ importKey: deliverable.importKey, action: "unchanged", title: found.title, existingId: found.id });
      continue;
    }
    const founderEdited = sectionsSignature(found.sections) !== found.source.importedSignature;
    const screen = screenUntrustedText(deliverableText(deliverable));
    plan.deliverables.push({
      importKey: deliverable.importKey,
      action: founderEdited ? "drifted" : "update",
      title: found.title,
      existingId: found.id,
      sections: deliverable.sections,
      fingerprint: deliverable.fingerprint,
      findings: screen.findings,
      now,
    });
    if (screen.findings.length && !founderEdited) {
      plan.heldBack.push({ kind: "deliverable", importKey: deliverable.importKey, label: found.title, findings: screen.findings });
    }
  }
}

/**
 * What the launch workspace has stopped saying. A recommendation whose lane is no longer finished
 * is history rather than a live recommendation, and work the workspace no longer reports is closed
 * — both stated honestly, neither deleted. Decisions and deliverables are never retired this way:
 * a decision that was made stays made, and a document that existed stays readable.
 */
function planRetirements(database, workspace, report, plan) {
  const reportedClaims = new Set((report.claims ?? []).map((entry) => entry.importKey));
  const reportedTasks = new Set((report.tasks ?? []).map((entry) => entry.importKey));
  const planned = new Set(plan.claims.map((entry) => entry.importKey));

  for (const claim of database.claims) {
    if (claim.workspaceId !== workspace.id || !isImported(claim) || claim.status !== "active") continue;
    // Claims this import raised itself (company disagreements, contradictions) are not lane
    // records, so their absence from `report.claims` means nothing about them.
    if (reportedClaims.has(claim.source.importKey) || planned.has(claim.source.importKey)) continue;
    plan.retiredClaims.push({ importKey: claim.source.importKey, existingId: claim.id, statement: claim.statement });
  }
  for (const task of database.tasks) {
    if (task.workspaceId !== workspace.id || !isImported(task) || task.status === "done") continue;
    if (reportedTasks.has(task.source.importKey)) continue;
    plan.retiredTasks.push({ importKey: task.source.importKey, existingId: task.id, title: task.title });
  }
}

/**
 * A question for every imported document whose own words read as an instruction to a machine.
 *
 * This is deliberately a question rather than a refusal. The document imports unchanged and stays
 * readable — a launch repository is the founder's own material, and a screen that quietly dropped
 * part of it would be worse than one that missed something. What the flag buys is that
 * `domain/prompts.mjs` will not put the text in front of a model as company context until a person
 * has looked at it, and that the founder finds out here rather than from a draft that behaved
 * strangely. Keyed on the document, so a re-import asks once.
 */
function planScreenQuestions(database, workspace, sourceId, now, plan) {
  if (!plan.heldBack.length) return;
  const existing = new Set(
    database.claims.filter((claim) => claim.workspaceId === workspace.id && isImported(claim)).map((claim) => claim.source.importKey),
  );
  for (const entry of plan.heldBack) {
    const importKey = `screen:${entry.importKey}`;
    if (existing.has(importKey) || plan.claims.some((claim) => claim.importKey === importKey)) {
      plan.claims.push({ importKey, action: "unchanged", kind: "question", statement: entry.label });
      continue;
    }
    const finding = entry.findings[0];
    plan.claims.push({
      importKey,
      action: "create",
      kind: "question",
      statement: trim(
        `“${entry.label}” came in from the launch workspace containing wording that reads as an instruction to a machine rather than a description of the business. ${finding?.reason ?? ""} It says: “${finding?.excerpt ?? ""}”. Formation is leaving this document out of anything it drafts until you confirm the wording is meant.`,
        LIMIT_SCREEN_STATEMENT,
      ),
      evidence: [entry.importKey.replace(/^deliverable:/, "")].filter(Boolean),
      confidence: IMPORTED_CONFIDENCE.contradiction,
      workstreamId: launchWorkstreamId(workspace),
      origin: null,
      sourceId,
      now,
    });
  }
}

/** Long enough to quote the wording and say what happens next, short enough to read at a glance. */
const LIMIT_SCREEN_STATEMENT = 900;

function trim(text, maximum) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > maximum ? `${normalized.slice(0, maximum - 1)}…` : normalized;
}

/**
 * Executes a plan. Mutates `database` — call inside a store transaction — and returns what changed
 * so the caller can write activity. Every decision was already made in `buildImportPlan`; nothing
 * here re-derives one.
 */
export function applyImportPlan(database, workspace, plan, now) {
  const changes = {
    sourceId: plan.sourceId,
    claimsCreated: [],
    claimsRetired: [],
    decisionsCreated: [],
    tasksCreated: [],
    tasksClosed: [],
    deliverablesCreated: [],
    deliverablesUpdated: [],
    deliverablesDrifted: [],
    companyFieldsFilled: [],
  };

  for (const field of plan.companyFields) {
    if (field.action !== "fill") continue;
    workspace.company = workspace.company ?? {};
    workspace.company[field.companyField] = field.proposed;
    changes.companyFieldsFilled.push(field);
  }

  for (const entry of plan.claims) {
    if (entry.action !== "create") continue;
    const claim = {
      id: createId("clm"),
      workspaceId: workspace.id,
      workstreamId: entry.workstreamId,
      kind: entry.kind,
      key: null,
      statement: entry.statement,
      value: null,
      confidence: entry.confidence,
      status: "active",
      evidence: [...(entry.evidence ?? [])],
      createdAt: now,
      updatedAt: now,
      source: provenance(entry.importKey, entry.origin, plan.sourceId, now),
    };
    database.claims.push(claim);
    changes.claimsCreated.push(claim);
  }

  for (const entry of plan.decisions) {
    if (entry.action !== "create") continue;
    const decision = {
      id: createId("dec"),
      workspaceId: workspace.id,
      workstreamId: entry.workstreamId,
      title: entry.title,
      decision: entry.decision,
      rationale: entry.rationale,
      status: entry.status,
      owner: workspace.founder?.name ?? "Founder",
      decidedAt: entry.decidedAt,
      reviewAt: null,
      createdAt: now,
      updatedAt: now,
      source: provenance(entry.importKey, entry.origin, plan.sourceId, now),
    };
    database.decisions.push(decision);
    changes.decisionsCreated.push(decision);
  }

  for (const entry of plan.tasks) {
    if (entry.action !== "create") continue;
    const task = {
      id: createId("tsk"),
      workspaceId: workspace.id,
      workstreamId: entry.workstreamId,
      title: entry.title,
      status: entry.status,
      priority: entry.priority,
      owner: workspace.founder?.name ?? "Founder",
      dueAt: null,
      createdAt: now,
      updatedAt: now,
      source: provenance(entry.importKey, entry.origin, plan.sourceId, now),
    };
    database.tasks.push(task);
    changes.tasksCreated.push(task);
  }

  for (const entry of plan.deliverables) {
    if (entry.action === "create") {
      const artifact = {
        id: createId("art"),
        workspaceId: workspace.id,
        workstreamId: entry.workstreamId,
        type: "launch-document",
        title: entry.title,
        status: "draft",
        version: 1,
        confidence: IMPORTED_CONFIDENCE.deliverable,
        summary: `Brought across from this company's existing launch work. It stays a draft until you review it.`,
        sections: entry.sections.map((section) => ({ id: createId("sec"), title: section.title, body: section.body })),
        sourceClaimIds: [],
        linkedDecisionIds: [],
        stale: false,
        staleReason: null,
        staleSince: null,
        createdAt: now,
        updatedAt: now,
        source: provenance(entry.importKey, entry.origin, plan.sourceId, now, {
          fingerprint: entry.fingerprint,
          importedSignature: sectionsSignature(entry.sections),
          // What the screen found, stored beside the document rather than only in the activity
          // entry, so any surface that shows the document can say why it is being held back.
          screened: entry.findings ?? [],
        }),
      };
      database.artifacts.push(artifact);
      database.artifactVersions.push(buildImportedVersion(artifact, now));
      const stream = (workspace.workstreams ?? []).find((candidate) => candidate.id === artifact.workstreamId);
      if (stream && Array.isArray(stream.deliverableIds) && !stream.deliverableIds.includes(artifact.id)) {
        stream.deliverableIds.push(artifact.id);
      }
      changes.deliverablesCreated.push(artifact);
      continue;
    }

    const artifact = database.artifacts.find((candidate) => candidate.id === entry.existingId);
    if (!artifact) continue;

    if (entry.action === "update") {
      artifact.sections = entry.sections.map((section) => ({ id: createId("sec"), title: section.title, body: section.body }));
      artifact.version = Number.isInteger(artifact.version) ? artifact.version + 1 : 1;
      artifact.stale = false;
      artifact.staleReason = null;
      artifact.staleSince = null;
      artifact.updatedAt = now;
      artifact.source = {
        ...artifact.source,
        fingerprint: entry.fingerprint,
        importedSignature: sectionsSignature(entry.sections),
        screened: entry.findings ?? [],
        importedAt: now,
      };
      database.artifactVersions.push(buildImportedVersion(artifact, now));
      changes.deliverablesUpdated.push(artifact);
      continue;
    }

    if (entry.action === "drifted" && artifact.stale !== true) {
      artifact.stale = true;
      artifact.staleReason = DELIVERABLE_DRIFT_REASON;
      artifact.staleSince = now;
      artifact.updatedAt = now;
      changes.deliverablesDrifted.push(artifact);
    }
  }

  for (const entry of plan.retiredClaims) {
    const claim = database.claims.find((candidate) => candidate.id === entry.existingId);
    if (!claim || claim.status !== "active") continue;
    claim.status = "superseded";
    claim.updatedAt = now;
    changes.claimsRetired.push(claim);
  }
  for (const entry of plan.retiredTasks) {
    const task = database.tasks.find((candidate) => candidate.id === entry.existingId);
    if (!task || task.status === "done") continue;
    task.status = "done";
    task.updatedAt = now;
    changes.tasksClosed.push(task);
  }

  workspace.updatedAt = now;
  return changes;
}

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
    createdBy: "Existing launch work",
  };
}

/** Activity entries for what an import changed, in founder vocabulary. */
export function recordImportActivity(database, workspaceId, changes, now, actor) {
  const push = (type, title, detail) => {
    database.activity.push({ id: createId("act"), workspaceId, type, title, detail, actor, createdAt: now });
  };
  const counted = [
    [changes.claimsCreated.length, "claim", "claims"],
    [changes.decisionsCreated.length, "decision", "decisions"],
    [changes.tasksCreated.length, "task", "tasks"],
    [changes.deliverablesCreated.length, "deliverable", "deliverables"],
  ]
    .filter(([count]) => count > 0)
    .map(([count, one, many]) => `${count} ${count === 1 ? one : many}`);

  push(
    "launch-work-imported",
    "Existing launch work brought in",
    counted.length ? `Added ${counted.join(", ")}. Everything arrived as a draft for you to review.` : "Nothing new was found — this company already had everything the launch workspace recorded.",
  );

  for (const artifact of changes.deliverablesUpdated) {
    push("deliverable-updated", `Refreshed from the launch workspace: ${artifact.title}`, "The source document changed and you had not edited this copy, so it was brought up to date.");
  }
  for (const artifact of changes.deliverablesDrifted) {
    push("deliverable-stale", `No longer matches its source: ${artifact.title}`, DELIVERABLE_DRIFT_REASON);
  }
  for (const claim of changes.claimsRetired) {
    push("claim-superseded", "No longer recorded in the launch workspace", claim.statement);
  }
  for (const task of changes.tasksClosed) {
    push("task-closed", `No longer outstanding: ${task.title}`, "The launch workspace has stopped reporting this.");
  }
  for (const field of changes.companyFieldsFilled) {
    push("company-updated", `Filled in ${field.label}`, `Taken from the launch workspace, because Formation had nothing recorded here.`);
  }
}

/**
 * The founder-facing projection of a plan: built by naming the fields that may leave, never by
 * taking the plan and removing what should not go (the `sharedView` discipline in
 * domain/sharing.mjs). Full document bodies stay on the server — a preview says what will happen,
 * and the deliverables themselves arrive when the founder says yes.
 */
export function toFounderPlan(plan) {
  return {
    sourceId: plan.sourceId,
    company: plan.company
      ? {
          name: plan.company.name,
          oneLiner: plan.company.oneLiner,
          targetCustomer: plan.company.targetCustomer,
          stage: plan.company.stage,
          founderName: plan.company.founderName,
          liveSince: plan.company.liveSince ?? null,
        }
      : null,
    totals: plan.totals,
    companyFields: plan.companyFields.map((entry) => ({
      label: entry.label,
      action: entry.action,
      current: trim(entry.current, 300),
      proposed: trim(entry.proposed, 300),
    })),
    claims: plan.claims.map((entry) => ({ action: entry.action, kind: entry.kind, statement: trim(entry.statement, 300) })),
    decisions: plan.decisions.map((entry) => ({ action: entry.action, title: trim(entry.title, 300) })),
    tasks: plan.tasks.map((entry) => ({ action: entry.action, title: trim(entry.title, 300) })),
    deliverables: plan.deliverables.map((entry) => ({
      action: entry.action,
      title: trim(entry.title, 300),
      sectionCount: entry.sections?.length ?? null,
    })),
    retiring: [
      ...plan.retiredClaims.map((entry) => ({ kind: "claim", label: trim(entry.statement, 300) })),
      ...plan.retiredTasks.map((entry) => ({ kind: "task", label: trim(entry.title, 300) })),
    ],
    heldBack: plan.heldBack.map((entry) => ({
      kind: entry.kind,
      label: trim(entry.label, 300),
      reason: trim(entry.findings[0]?.reason ?? "", 300),
      excerpt: trim(entry.findings[0]?.excerpt ?? "", 300),
    })),
    contradictions: plan.contradictions.map((entry) => ({
      severity: entry.severity,
      message: trim(entry.message, 500),
      sourcePath: entry.sourcePath,
    })),
  };
}
