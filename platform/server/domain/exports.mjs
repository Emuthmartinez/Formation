/**
 * Taking the company's work out of Formation.
 *
 * A founder needs to hand this record to a lawyer, an investor, an accountant, or their own future
 * self on a different tool. The requirement that makes an export worth building rather than
 * copy-and-paste is **lineage**: a deliverable that arrives with the claims it rests on and the
 * decisions it is linked to, resolved to what they actually say. A bundle whose lineage is a list
 * of `clm_a1b2c3` is not lineage anybody can read, and an export that drops it entirely hands over
 * conclusions with their reasoning removed.
 *
 * Built by naming the fields that may leave, the same discipline as `domain/sharing.mjs` and
 * `domain/prompts.mjs`. What that keeps out matters as much as what it lets through: no comments,
 * no review requests, no invitations, no sessions, no member email addresses, no engine internals.
 * A bundle is a document about the *work*, and one that quietly carried a private argument between
 * cofounders into a file the founder mailed to an investor would be the same failure as a shared
 * link that did.
 *
 * The manifest says what was deliberately left out, because a reader who cannot see the omissions
 * cannot tell a complete record from a filtered one.
 */

export const EXPORT_FORMATS = Object.freeze(["json", "markdown", "csv"]);

const EXCLUDED = Object.freeze([
  "conversations and review requests, which are about the work rather than part of it",
  "who has access, their email addresses, and any pending invitations",
  "sign-in sessions and anything that could be used to reach this company",
  "launch-engine run internals, which live with the engine",
]);

/** Claims and decisions this deliverable rests on, resolved to what they say. */
function lineageFor(artifact, claimsById, decisionsById) {
  return {
    restsOn: (artifact.sourceClaimIds ?? [])
      .map((id) => claimsById.get(id))
      .filter(Boolean)
      .map((claim) => ({ kind: claim.kind, statement: claim.statement, confidence: claim.confidence, status: claim.status, evidence: [...(claim.evidence ?? [])] })),
    linkedDecisions: (artifact.linkedDecisionIds ?? [])
      .map((id) => decisionsById.get(id))
      .filter(Boolean)
      .map((decision) => ({ title: decision.title, decision: decision.decision, rationale: decision.rationale, status: decision.status, decidedAt: decision.decidedAt ?? null })),
    // Named so a reader can tell "this deliverable cites nothing" from "the citations were dropped
    // on the way out" — two very different things to learn about a document.
    unresolved:
      (artifact.sourceClaimIds ?? []).filter((id) => !claimsById.has(id)).length +
      (artifact.linkedDecisionIds ?? []).filter((id) => !decisionsById.has(id)).length,
  };
}

/**
 * The structured bundle. `snapshot` is a workspace snapshot; nothing here reaches back into the
 * database, so an export can only contain what a member could already read.
 */
export function buildExportBundle(snapshot, { exportedBy, now }) {
  const workspace = snapshot.workspace;
  const claimsById = new Map(snapshot.claims.map((claim) => [claim.id, claim]));
  const decisionsById = new Map(snapshot.decisions.map((decision) => [decision.id, decision]));
  const versionCounts = new Map();
  for (const version of snapshot.artifactVersions ?? []) {
    versionCounts.set(version.artifactId, (versionCounts.get(version.artifactId) ?? 0) + 1);
  }

  return {
    manifest: {
      company: workspace.name,
      exportedAt: now,
      exportedBy,
      formatVersion: "1.0.0",
      deliberatelyExcluded: [...EXCLUDED],
    },
    company: {
      name: workspace.name,
      stage: workspace.stage,
      launchTarget: workspace.launchTarget ?? null,
      founder: { name: workspace.founder?.name ?? null, role: workspace.founder?.role ?? null },
      ...Object.fromEntries(
        ["oneLiner", "thesis", "targetCustomer", "problem", "solution", "positioning", "differentiation", "businessModel", "pricing", "northStarMetric", "currentGoal"].map(
          (field) => [field, workspace.company?.[field] ?? ""],
        ),
      ),
      constraints: [...(workspace.company?.constraints ?? [])],
    },
    readiness: { score: snapshot.readiness.score, blockers: [...(snapshot.readiness.blockers ?? [])] },
    workstreams: (workspace.workstreams ?? []).map((stream) => ({
      title: stream.title,
      status: stream.status,
      progress: stream.progress,
      confidence: stream.confidence,
      summary: stream.summary,
      nextAction: stream.nextAction,
      rationale: stream.rationale,
      facts: [...(stream.facts ?? [])],
      assumptions: [...(stream.assumptions ?? [])],
      questions: [...(stream.questions ?? [])],
    })),
    claims: snapshot.claims.map((claim) => ({
      kind: claim.kind,
      statement: claim.statement,
      confidence: claim.confidence,
      status: claim.status,
      evidence: [...(claim.evidence ?? [])],
      origin: claim.source?.kind ?? "founder",
    })),
    decisions: snapshot.decisions.map((decision) => ({
      title: decision.title,
      decision: decision.decision,
      rationale: decision.rationale,
      status: decision.status,
      owner: decision.owner,
      decidedAt: decision.decidedAt ?? null,
      reviewAt: decision.reviewAt ?? null,
      origin: decision.source?.kind ?? "founder",
    })),
    deliverables: snapshot.artifacts.map((artifact) => ({
      title: artifact.title,
      status: artifact.status,
      version: artifact.version,
      confidence: artifact.confidence,
      summary: artifact.summary,
      versionsKept: versionCounts.get(artifact.id) ?? 0,
      sections: (artifact.sections ?? []).map((section) => ({ title: section.title, body: section.body })),
      lineage: lineageFor(artifact, claimsById, decisionsById),
    })),
    tasks: snapshot.tasks.map((task) => ({ title: task.title, status: task.status, priority: task.priority, owner: task.owner, dueAt: task.dueAt ?? null })),
    economics: {
      currency: snapshot.economics?.currency ?? null,
      scenarios: (snapshot.economics?.scenarios ?? []).map((scenario) => ({
        name: scenario.name,
        isPrimary: scenario.isPrimary,
        price: { ...scenario.price },
        variableCostPerCustomer: scenario.variableCostPerCustomer,
        acquisitionCost: scenario.acquisitionCost,
        retention: { ...scenario.retention },
        cash: { ...scenario.cash },
        derived: Object.fromEntries(Object.entries(scenario.derived ?? {}).map(([name, figure]) => [name, figure.value])),
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Renderings.
// ---------------------------------------------------------------------------

function heading(level, text) {
  return `${"#".repeat(level)} ${text}`;
}

function bullets(items, empty) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : `_${empty}_`;
}

/** The bundle as a document somebody would actually read, lineage under each deliverable. */
export function renderExportMarkdown(bundle) {
  const lines = [];
  lines.push(heading(1, bundle.company.name), "");
  lines.push(`Exported ${bundle.manifest.exportedAt.slice(0, 10)} by ${bundle.manifest.exportedBy}. Launch readiness ${bundle.readiness.score}/100.`, "");
  lines.push(`_This bundle deliberately leaves out: ${bundle.manifest.deliberatelyExcluded.join("; ")}._`, "");

  lines.push(heading(2, "The company"), "");
  for (const [label, field] of [
    ["What it is", "oneLiner"],
    ["Thesis", "thesis"],
    ["Customer", "targetCustomer"],
    ["Problem", "problem"],
    ["Solution", "solution"],
    ["Positioning", "positioning"],
    ["Business model", "businessModel"],
    ["Pricing", "pricing"],
    ["North star", "northStarMetric"],
    ["Current goal", "currentGoal"],
  ]) {
    if (bundle.company[field]) lines.push(`**${label}.** ${bundle.company[field]}`, "");
  }

  if (bundle.economics.scenarios.length) {
    lines.push(heading(2, "Economics"), "");
    for (const scenario of bundle.economics.scenarios) {
      lines.push(heading(3, `${scenario.name}${scenario.isPrimary ? " (primary)" : ""}`), "");
      lines.push(
        bullets(
          Object.entries(scenario.derived)
            .filter(([, value]) => value !== null)
            .map(([name, value]) => `${humanize(name)}: ${value}`),
          "Not enough recorded yet to work anything out.",
        ),
        "",
      );
    }
  }

  lines.push(heading(2, "Decisions"), "");
  lines.push(
    bundle.decisions.length
      ? bundle.decisions.map((decision) => `### ${decision.title}\n\n**${decision.status}.** ${decision.decision}\n\n_Why:_ ${decision.rationale}`).join("\n\n")
      : "_No decisions recorded._",
    "",
  );

  lines.push(heading(2, "Deliverables"), "");
  for (const deliverable of bundle.deliverables) {
    lines.push(heading(3, deliverable.title), "");
    lines.push(`**${deliverable.status}**, version ${deliverable.version}, ${deliverable.versionsKept} kept. ${deliverable.summary}`, "");
    for (const section of deliverable.sections) {
      lines.push(heading(4, section.title), "", section.body, "");
    }
    lines.push(heading(4, "What this rests on"), "");
    lines.push(
      bullets(
        deliverable.lineage.restsOn.map((claim) => `**${claim.kind}** (${claim.confidence}%, ${claim.status}): ${claim.statement}`),
        "Nothing was cited.",
      ),
      "",
    );
    if (deliverable.lineage.linkedDecisions.length) {
      lines.push(bullets(deliverable.lineage.linkedDecisions.map((decision) => `**Decision:** ${decision.title} — ${decision.decision}`), ""), "");
    }
    if (deliverable.lineage.unresolved) {
      lines.push(`_${deliverable.lineage.unresolved} cited record(s) could not be resolved and are not shown._`, "");
    }
  }

  lines.push(heading(2, "Claims and evidence"), "");
  lines.push(
    bullets(
      bundle.claims.map((claim) => `**${claim.kind}** (${claim.confidence}%, ${claim.status}): ${claim.statement}${claim.evidence.length ? ` — evidence: ${claim.evidence.join("; ")}` : " — no evidence recorded"}`),
      "No claims recorded.",
    ),
    "",
  );

  lines.push(heading(2, "Open work"), "");
  lines.push(
    bullets(
      bundle.tasks.filter((task) => task.status !== "done").map((task) => `${task.title} (${task.priority}, ${task.owner}${task.dueAt ? `, due ${task.dueAt}` : ""})`),
      "Nothing outstanding.",
    ),
    "",
  );

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

function humanize(value) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase());
}

/** A field escaped for CSV. Quotes are doubled; anything with a comma, quote, or newline is quoted. */
export function csvField(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * The economics as a spreadsheet: one row per scenario, inputs and derived figures side by side.
 * Money stays in minor units and the header says so — a column silently mixing pounds and pence is
 * how a spreadsheet ends up off by a hundred.
 */
export function renderEconomicsCsv(bundle) {
  const currency = bundle.economics.currency ?? "";
  const columns = [
    ["Scenario", (scenario) => scenario.name],
    ["Primary", (scenario) => (scenario.isPrimary ? "yes" : "no")],
    [`Price (${currency} minor units)`, (scenario) => scenario.price.amount],
    ["Charged", (scenario) => scenario.price.per],
    [`Cost to serve (${currency} minor units)`, (scenario) => scenario.variableCostPerCustomer],
    [`Cost to win (${currency} minor units)`, (scenario) => scenario.acquisitionCost],
    ["Monthly churn (%)", (scenario) => scenario.retention.monthlyChurn],
    [`Cash on hand (${currency} minor units)`, (scenario) => scenario.cash.onHand],
    [`Monthly spend (${currency} minor units)`, (scenario) => scenario.cash.monthlyBurn],
    ["Gross margin (%)", (scenario) => scenario.derived.grossMargin],
    [`Monthly contribution (${currency} minor units)`, (scenario) => scenario.derived.monthlyContribution],
    ["Customer lifetime (months)", (scenario) => scenario.derived.lifetimeMonths],
    [`Customer worth (${currency} minor units)`, (scenario) => scenario.derived.lifetimeValue],
    ["Worth against cost to win", (scenario) => scenario.derived.ltvToCac],
    ["Payback (months)", (scenario) => scenario.derived.paybackMonths],
    ["Runway (months)", (scenario) => scenario.derived.runwayMonths],
    ["Customers to break even", (scenario) => scenario.derived.customersToBreakEven],
  ];

  const rows = [columns.map(([header]) => csvField(header)).join(",")];
  for (const scenario of bundle.economics.scenarios) {
    rows.push(columns.map(([, read]) => csvField(read(scenario))).join(","));
  }
  return `${rows.join("\n")}\n`;
}
