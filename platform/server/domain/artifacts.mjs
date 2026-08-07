import { randomUUID } from "node:crypto";
import { clampNumber, createId, unique } from "./shared.mjs";

export function createGeneratedArtifact({ workspace, workstream, artifactType, instruction = "" }) {
  const type = artifactType || defaultArtifactType(workstream.id);
  const company = workspace.company;
  const title = artifactTitle(type, workstream.title);
  const contextNote = instruction.trim() ? `Founder direction: ${instruction.trim()}` : "";

  const sections = artifactSections(type, company, workstream, contextNote).map((section) => ({
    id: `sec_${randomUUID().slice(0, 8)}`,
    ...section,
  }));

  return {
    id: `art_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
    workspaceId: workspace.id,
    workstreamId: workstream.id,
    type,
    title,
    status: "draft",
    version: 1,
    confidence: Math.min(90, Math.max(45, workstream.confidence + 4)),
    summary: `A structured ${title.toLowerCase()} grounded in the current ${workspace.name} source of truth.`,
    sections,
    sourceClaimIds: [],
    linkedDecisionIds: [],
  };
}

export function createArtifactVersion(artifact, actor = "Formation") {
  const createdAt = artifact.updatedAt ?? artifact.createdAt ?? new Date().toISOString();
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
    sourceClaimIds: [...artifact.sourceClaimIds],
    linkedDecisionIds: [...artifact.linkedDecisionIds],
    createdAt,
    createdBy: actor,
  };
}

export function generationClaims({ workspaceId, workstreamId, artifact }) {
  const timestamp = new Date().toISOString();
  return [
    {
      id: `clm_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
      workspaceId,
      workstreamId,
      kind: "recommendation",
      key: null,
      statement: `Use the generated ${artifact.title.toLowerCase()} as a draft for founder review, not as accepted fact.`,
      value: artifact.id,
      confidence: artifact.confidence,
      status: "active",
      evidence: [artifact.id],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
}

export function applyArtifactPatch(artifact, patch) {
  const next = { ...artifact };
  if (typeof patch.title === "string" && patch.title.trim()) next.title = patch.title.trim().slice(0, 300);
  if (typeof patch.summary === "string") next.summary = patch.summary.trim().slice(0, 4_000);
  if (["draft", "reviewed", "approved", "superseded"].includes(patch.status)) next.status = patch.status;
  if (Number.isFinite(patch.confidence)) next.confidence = Math.round(clampNumber(patch.confidence, 0, 100));
  if (Array.isArray(patch.sections)) {
    const sections = patch.sections
      .filter((section) => section && typeof section.title === "string" && typeof section.body === "string")
      .slice(0, 24)
      .map((section) => ({
        id: typeof section.id === "string" && section.id ? section.id.slice(0, 240) : `sec_${randomUUID().slice(0, 8)}`,
        title: section.title.trim().slice(0, 300),
        body: section.body.trim().slice(0, 20_000),
      }))
      .filter((section) => section.title && section.body);
    if (sections.length > 0) next.sections = sections;
  }
  if (Array.isArray(patch.sourceClaimIds)) next.sourceClaimIds = unique(patch.sourceClaimIds.map(String)).slice(0, 100);
  if (Array.isArray(patch.linkedDecisionIds)) next.linkedDecisionIds = unique(patch.linkedDecisionIds.map(String)).slice(0, 100);
  // Confirming imported wording changes nothing a reader would see, so it is recorded on the
  // record's provenance rather than on the record. Only a record that has a provenance can carry
  // it: there is nothing to confirm about words the company wrote itself.
  if (typeof patch.wordingConfirmed === "boolean" && next.source) {
    next.source = patch.wordingConfirmed
      ? { ...next.source, screenConfirmedAt: new Date().toISOString(), screenConfirmedBy: patch.confirmedBy ?? "Founder" }
      : { ...next.source, screenConfirmedAt: null, screenConfirmedBy: null };
  }
  next.version = Number.isInteger(artifact.version) ? artifact.version + 1 : 1;
  next.updatedAt = new Date().toISOString();
  return next;
}

/**
 * A value, or an honest statement that it is not recorded yet.
 *
 * Every field these documents interpolate is one a founder is allowed to leave blank or clear
 * later, and a blank does not fail here — it produces a sentence with a hole in it ("​. The current
 * working price is .") or a section with nothing in it at all. Both are worse than saying plainly
 * that the answer is not there yet, which is also the answer the founder needs to see.
 */
function said(value, absent) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || absent;
}

/** One sentence, ending like one. Founder-written fields arrive with and without a full stop. */
function sentence(value) {
  const text = String(value ?? "").trim();
  return text && !/[.!?]$/.test(text) ? `${text}.` : text;
}

/** A bullet list, or the same honesty when there is nothing to list. */
function listed(items, absent) {
  const lines = (Array.isArray(items) ? items : []).map((item) => String(item ?? "").trim()).filter(Boolean);
  return lines.length ? lines.map((item) => `- ${item}`).join("\n") : absent;
}

function artifactSections(type, company, workstream, contextNote) {
  const shared = contextNote ? `\n\n${contextNote}` : "";
  switch (type) {
    case "business-model":
      return [
        {
          title: "Commercial hypothesis",
          // Built from parts rather than one template, so an unrecorded model does not leave the
          // paragraph starting with a full stop and an unrecorded price does not swallow its own
          // introduction.
          body:
            [
              sentence(said(company.businessModel, "The commercial model has not been decided yet.")),
              sentence(said(company.pricing, "") ? `The current working price is ${said(company.pricing, "")}` : "No working price has been set yet."),
            ].join(" ") + shared,
        },
        {
          title: "What must be true",
          body: listed(workstream.assumptions, "No assumptions have been recorded for this workstream yet. Name what must be true for the commercial model to hold before pricing it."),
        },
        {
          title: "Decision required",
          body: listed(workstream.questions, said(workstream.nextAction, "Describe the natural unit of value before choosing a price.")),
        },
      ];
    case "go-to-market-brief":
      return [
        {
          title: "Launch audience",
          body: said(company.targetCustomer, "The primary customer has not been named yet. Distribution cannot be chosen before it is."),
        },
        {
          title: "Promise",
          body: said(company.positioning, "The promise this company makes has not been written down yet."),
        },
        {
          title: "First motion",
          body: `${said(workstream.nextAction, "Identify where the primary customer already looks for help with this problem.")} Define the first conversion event as an observable customer outcome: ${said(company.northStarMetric, "the outcome that means the product worked, once it is named.")}${shared}`,
        },
        {
          title: "Learning loop",
          body: "Name the channel, message, conversion event, owner, and weekly evidence review before committing meaningful spend.",
        },
      ];
    case "launch-plan":
      return [
        {
          title: "Launch objective",
          body: said(company.currentGoal, "The objective for this launch has not been written down yet. Everything below is provisional until it is."),
        },
        {
          title: "Critical path",
          body: `${said(workstream.nextAction, "Decide what evidence the next business decision requires.")} Protect the target date until the customer, offer, economics, distribution, trust, and operational assumptions are decision-grade.${shared}`,
        },
        {
          title: "Evidence required",
          body: `- The primary customer reaches the promised outcome\n- The core behavior can be repeated reliably\n- The offer and pricing have explicit evidence\n- Acquisition and activation can be measured\n- Material trust, support, and operational risks have owners`,
        },
        {
          title: "Launch threshold",
          body: `Formation should not call this launch ready until the team can explain how ${said(company.northStarMetric, "the outcome that means the product worked").toLowerCase()} will be observed, and which unresolved assumptions would still make the launch irresponsible.`,
        },
      ];
    default:
      return [
        {
          title: "Current position",
          body: `${said(workstream.summary, "This workstream has no summary yet.")}\n\n${said(workstream.rationale, "No rationale has been recorded for its current state.")}${shared}`,
        },
        {
          title: "What we know",
          body: listed(workstream.facts, "No accepted facts yet."),
        },
        {
          title: "Assumptions to test",
          body: listed(workstream.assumptions, "No active assumptions recorded."),
        },
        {
          title: "Next decision",
          body: listed(workstream.questions, said(workstream.nextAction, "No next action has been chosen for this workstream yet.")),
        },
      ];
  }
}

function defaultArtifactType(workstreamId) {
  if (workstreamId === "business-model") return "business-model";
  if (workstreamId === "go-to-market") return "go-to-market-brief";
  if (workstreamId === "launch") return "launch-plan";
  return `${workstreamId}-brief`;
}

function artifactTitle(type, fallback) {
  const titles = {
    "business-model": "Business model brief",
    "go-to-market-brief": "Go-to-market brief",
    "launch-plan": "Launch plan",
  };
  return titles[type] ?? `${fallback} brief`;
}

