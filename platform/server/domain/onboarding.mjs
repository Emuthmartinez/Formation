import { randomUUID } from "node:crypto";
import { createArtifactVersion } from "./artifacts.mjs";
import { clampNumber, cleanText, createId, normalizeDate, slug } from "./shared.mjs";

export function createWorkspaceFromBrief({ brief, userId, existingSlugs = [] }) {
  const now = new Date().toISOString();
  const workspaceId = createId("wrk");
  const name = cleanText(brief.name, "Untitled company", 120);
  const slugBase = slug(name) || "company";
  let workspaceSlug = slugBase;
  let suffix = 2;
  while (existingSlugs.includes(workspaceSlug)) workspaceSlug = `${slugBase}-${suffix++}`;

  const founderName = cleanText(brief.founderName, "Founder", 120);
  const oneLiner = cleanText(brief.oneLiner, `${name} is defining its first focused offer.`, 500);
  const targetCustomer = cleanText(brief.targetCustomer, "A narrowly defined early customer segment", 4_000);
  const problem = cleanText(brief.problem, "The customer problem still needs evidence and sharper boundaries.", 20_000);
  const solution = cleanText(brief.solution, "A focused first product that solves the priority customer job.", 20_000);
  const currentGoal = cleanText(brief.currentGoal, "Turn the initial thesis into a decision-grade validation plan.", 4_000);
  const launchTarget = normalizeDate(brief.launchTarget);

  const workstreams = workspaceTemplates({ targetCustomer, problem, solution, currentGoal });
  const workspace = {
    id: workspaceId,
    slug: workspaceSlug,
    name,
    stage: "discovery",
    launchTarget,
    createdAt: now,
    updatedAt: now,
    founder: {
      name: founderName,
      role: cleanText(brief.founderRole, "Founder", 120),
      operatingMode: "review-first",
      weeklyHours: clampNumber(brief.weeklyHours ?? 10, 1, 100),
    },
    company: {
      oneLiner,
      thesis: `${targetCustomer} experiences ${problem.toLowerCase()} ${name} will test whether ${solution.toLowerCase()} can create a meaningfully better outcome.`,
      targetCustomer,
      problem,
      solution,
      positioning: cleanText(brief.positioning, `A focused way for ${targetCustomer.toLowerCase()} to solve the problem without the usual friction.`, 20_000),
      differentiation: cleanText(brief.differentiation, "The defensible difference is not yet proven.", 20_000),
      businessModel: cleanText(brief.businessModel, "Commercial model not yet decided.", 20_000),
      pricing: cleanText(brief.pricing, "Pricing hypothesis not yet decided.", 20_000),
      northStarMetric: cleanText(brief.northStarMetric, "A customer reaches the promised outcome and repeats the core behavior.", 20_000),
      currentGoal,
      constraints: Array.isArray(brief.constraints)
        ? brief.constraints.map((item) => cleanText(item, "", 2_000)).filter(Boolean).slice(0, 12)
        : [],
    },
    workstreams,
  };

  const artifactId = createId("art");
  const artifact = {
    id: artifactId,
    workspaceId,
    workstreamId: "strategy",
    type: "business-snapshot",
    title: "Business snapshot",
    status: "draft",
    version: 1,
    confidence: 45,
    summary: `The initial source of truth for ${name}, created from founder onboarding.`,
    sections: [
      { id: createId("sec"), title: "Company", body: oneLiner },
      { id: createId("sec"), title: "Customer and problem", body: `${targetCustomer}\n\n${problem}` },
      { id: createId("sec"), title: "Proposed solution", body: solution },
      { id: createId("sec"), title: "Current objective", body: currentGoal },
    ],
    sourceClaimIds: [],
    linkedDecisionIds: [],
    createdAt: now,
    updatedAt: now,
  };
  workstreams.find((entry) => entry.id === "strategy").deliverableIds.push(artifactId);

  const claims = [
    {
      id: createId("clm"),
      workspaceId,
      workstreamId: "customer",
      kind: "assumption",
      key: "customer.primary",
      statement: `${targetCustomer} is the best first customer segment.`,
      value: targetCustomer,
      confidence: 45,
      status: "active",
      evidence: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: createId("clm"),
      workspaceId,
      workstreamId: "product",
      kind: "assumption",
      key: "product.solution",
      statement: `${solution} is the smallest credible route to the desired outcome.`,
      value: solution,
      confidence: 40,
      status: "active",
      evidence: [],
      createdAt: now,
      updatedAt: now,
    },
  ];

  const decision = {
    id: createId("dec"),
    workspaceId,
    workstreamId: "strategy",
    title: "Confirm the first strategic wedge",
    decision: `Focus the first validation cycle on ${targetCustomer}.`,
    rationale: "A single primary customer keeps research, product scope, messaging, and launch evidence aligned.",
    status: "proposed",
    owner: founderName,
    decidedAt: null,
    reviewAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const tasks = [
    {
      id: createId("tsk"),
      workspaceId,
      workstreamId: "customer",
      title: "Schedule five problem interviews with the primary customer",
      status: "next",
      priority: "critical",
      owner: founderName,
      dueAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: createId("tsk"),
      workspaceId,
      workstreamId: "market",
      title: "Map the customer’s current alternatives and switching triggers",
      status: "next",
      priority: "high",
      owner: founderName,
      dueAt: null,
      createdAt: now,
      updatedAt: now,
    },
  ];

  return {
    workspace,
    membership: {
      id: createId("mem"),
      userId,
      workspaceId,
      role: "owner",
      createdAt: now,
    },
    claims,
    decisions: [decision],
    artifacts: [artifact],
    artifactVersions: [createArtifactVersion(artifact, founderName)],
    tasks,
    activity: [
      {
        id: createId("act"),
        workspaceId,
        type: "workspace-created",
        title: `${name} workspace created`,
        detail: "Formation created an initial business snapshot and prioritized the first validation work.",
        actor: founderName,
        createdAt: now,
      },
    ],
  };
}

function workspaceTemplates({ targetCustomer, problem, solution, currentGoal }) {
  return [
    {
      id: "strategy",
      title: "Business thesis",
      group: "Foundation",
      summary: "Define the wedge, strategic choices, and explicit non-goals.",
      status: "needs-attention",
      progress: 28,
      confidence: 42,
      nextAction: "Confirm the first strategic wedge and what the company will not pursue yet.",
      rationale: "A narrow thesis prevents every downstream workstream from optimizing for a different company.",
      facts: [],
      assumptions: [`${targetCustomer} is the best first customer segment.`],
      questions: ["What must be true for this company to deserve to exist?"],
      deliverableIds: [],
    },
    {
      id: "customer",
      title: "Customer and problem",
      group: "Foundation",
      summary: "Choose the primary customer, trigger, job, and current alternatives.",
      status: "needs-attention",
      progress: 22,
      confidence: 38,
      nextAction: "Run five problem interviews with the primary customer segment.",
      rationale: "The problem is founder-reported and has not yet been tested with enough outside evidence.",
      facts: [],
      assumptions: [problem],
      questions: ["What event makes this problem urgent enough to act on now?"],
      deliverableIds: [],
    },
    {
      id: "market",
      title: "Market and competition",
      group: "Evidence",
      summary: "Understand substitutes, category language, and credible opportunity size.",
      status: "not-started",
      progress: 12,
      confidence: 30,
      nextAction: "Map the customer’s current alternatives before building a competitor feature table.",
      rationale: "The most dangerous competitor is often the workaround or decision to do nothing.",
      facts: [],
      assumptions: [],
      questions: ["What does the customer do today instead of buying this?"],
      deliverableIds: [],
    },
    {
      id: "product",
      title: "Product and offer",
      group: "Build",
      summary: "Define the smallest offer that delivers the promised outcome.",
      status: "needs-attention",
      progress: 26,
      confidence: 40,
      nextAction: "Translate the proposed solution into one first-value path and a strict beta scope.",
      rationale: "The solution needs to become a testable behavior loop rather than a feature collection.",
      facts: [],
      assumptions: [solution],
      questions: ["What is the smallest observable outcome worth paying for?"],
      deliverableIds: [],
    },
    {
      id: "business-model",
      title: "Business model and pricing",
      group: "Economics",
      summary: "Choose the offer, pricing logic, and economic assumptions.",
      status: "not-started",
      progress: 8,
      confidence: 20,
      nextAction: "Describe the natural unit of value before choosing a price.",
      rationale: "Pricing should reflect the customer’s value model, not a familiar SaaS default.",
      facts: [],
      assumptions: [],
      questions: ["What exactly is the customer buying and how often does value recur?"],
      deliverableIds: [],
    },
    {
      id: "brand",
      title: "Brand and positioning",
      group: "Expression",
      summary: "Create a credible promise, narrative, and visual direction.",
      status: "not-started",
      progress: 10,
      confidence: 25,
      nextAction: "Wait until customer language and the product promise are sharper.",
      rationale: "Brand expression should follow strategic clarity rather than camouflage its absence.",
      facts: [],
      assumptions: [],
      questions: ["What should the customer understand and feel within five seconds?"],
      deliverableIds: [],
    },
    {
      id: "go-to-market",
      title: "Go-to-market",
      group: "Distribution",
      summary: "Choose the first repeatable route to trusted demand.",
      status: "not-started",
      progress: 6,
      confidence: 18,
      nextAction: "Identify where the primary customer already seeks help for this problem.",
      rationale: "A distribution plan is only credible when it names a channel, message, conversion event, and learning loop.",
      facts: [],
      assumptions: [],
      questions: ["Where can the first 25 customers be reached with earned trust?"],
      deliverableIds: [],
    },
    {
      id: "launch",
      title: "Launch plan",
      group: "Execution",
      summary: "Turn the business into a staged launch with proof thresholds and owners.",
      status: "not-started",
      progress: 5,
      confidence: 15,
      nextAction: currentGoal,
      rationale: "Launch planning should begin with the evidence required to make the next business decision.",
      facts: [],
      assumptions: [],
      questions: ["What evidence will make the launch a success even if revenue is initially small?"],
      deliverableIds: [],
    },
  ];
}
