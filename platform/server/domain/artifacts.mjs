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

function artifactSections(type, company, workstream, contextNote) {
  const shared = contextNote ? `\n\n${contextNote}` : "";
  switch (type) {
    case "business-model":
      return [
        {
          title: "Commercial hypothesis",
          body: `${company.businessModel}. The current working price is ${company.pricing}.${shared}`,
        },
        {
          title: "What must be true",
          body: workstream.assumptions.map((item) => `- ${item}`).join("\n"),
        },
        {
          title: "Decision required",
          body: workstream.questions.map((item) => `- ${item}`).join("\n"),
        },
      ];
    case "go-to-market-brief":
      return [
        {
          title: "Launch audience",
          body: company.targetCustomer,
        },
        {
          title: "Promise",
          body: company.positioning,
        },
        {
          title: "First motion",
          body: `${workstream.nextAction} Define the first conversion event as an observable customer outcome: ${company.northStarMetric}.${shared}`,
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
          body: company.currentGoal,
        },
        {
          title: "Critical path",
          body: `${workstream.nextAction} Protect the target date until the customer, offer, economics, distribution, trust, and operational assumptions are decision-grade.${shared}`,
        },
        {
          title: "Evidence required",
          body: `- The primary customer reaches the promised outcome\n- The core behavior can be repeated reliably\n- The offer and pricing have explicit evidence\n- Acquisition and activation can be measured\n- Material trust, support, and operational risks have owners`,
        },
        {
          title: "Launch threshold",
          body: `Formation should not call this launch ready until the team can explain how ${company.northStarMetric.toLowerCase()} will be observed and which unresolved assumptions would still make the launch irresponsible.`,
        },
      ];
    default:
      return [
        {
          title: "Current position",
          body: `${workstream.summary}\n\n${workstream.rationale}${shared}`,
        },
        {
          title: "What we know",
          body: workstream.facts.map((item) => `- ${item}`).join("\n") || "No accepted facts yet.",
        },
        {
          title: "Assumptions to test",
          body: workstream.assumptions.map((item) => `- ${item}`).join("\n") || "No active assumptions recorded.",
        },
        {
          title: "Next decision",
          body: workstream.questions.map((item) => `- ${item}`).join("\n") || workstream.nextAction,
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

