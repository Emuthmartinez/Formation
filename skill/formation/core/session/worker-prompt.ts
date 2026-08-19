import { createHash } from "node:crypto";
import type { NodeBrief } from "../engine/node-brief.js";

export const KNOWLEDGE_RECEIPT_BEGIN = "BEGIN_KNOWLEDGE_RECEIPT";
export const KNOWLEDGE_RECEIPT_END = "END_KNOWLEDGE_RECEIPT";

export interface WorkerAuthorization {
  readonly workflowId: string;
  readonly runId: string;
  readonly attemptId: string;
  readonly evaluatedAt: string;
  readonly actionClass: string;
  readonly protectedCategory?: string;
  readonly approvalRequirements: readonly {
    readonly id: string;
    readonly description: string;
    readonly status: "pending" | "approved" | "rejected";
    readonly envelopeId?: string;
    readonly actionId?: string;
    readonly validatedAt?: string;
  }[];
  readonly autonomy: {
    readonly reasonCode: string;
    readonly grantLevel?: string;
    readonly waiverId?: string;
    readonly evidenceRefs: readonly string[];
    readonly estimateAmount?: number;
    readonly estimateCurrency?: string;
    readonly remainingBudget?: number;
  };
}

export interface KnowledgeReceiptExpectations {
  /** Independently computed immediately before dispatch. Keys are workspace- or skill-relative paths. */
  readonly fileDigests?: Readonly<Record<string, string>>;
  readonly authorization?: WorkerAuthorization;
}

interface ReceiptFile {
  path: string;
  sha256: string;
}
interface RouteDecision {
  id: string;
  decision: "used" | "not_applicable" | "fallback";
  reason: string;
  sha256?: string;
  evidence?: string;
}
interface KnowledgeReceipt {
  schemaVersion: "2.0.0";
  workflowId: string;
  tokenBudget: number;
  authorizationDigest: string;
  contractFiles: ReceiptFile[];
  taskArtifacts: ReceiptFile[];
  mandatoryKnowledge: ReceiptFile[];
  conditionalKnowledge: RouteDecision[];
  skills: RouteDecision[];
  tools: RouteDecision[];
  outputEvidence: Array<{ outputPath: string; knowledgePaths: string[]; summary: string }>;
}

export function authorizationDigest(authorization: WorkerAuthorization | undefined): string {
  return authorization ? `sha256:${createHash("sha256").update(JSON.stringify(authorization)).digest("hex")}` : "none";
}

/** Build a bounded fresh-context prompt with an immutable authority block and strict receipt skeleton. */
export function buildWorkerPrompt(brief: NodeBrief, workspaceDir: string, skillRootDir: string, expectations: KnowledgeReceiptExpectations = {}): string {
  // Expected digests stay executor-private. Showing them here would let a worker echo a valid
  // hash without touching the file; the worker must derive each hash from the opened content.
  const digest = (_path: string): string => "<compute sha256 after opening>";
  const authorityDigest = authorizationDigest(expectations.authorization);
  return [
    "You are one fresh-context specialist worker inside the formation operating graph.",
    `Workspace: ${workspaceDir}`,
    `Skill root: ${skillRootDir}`,
    "Stay inside the assigned objective and write scope. Do not edit control/**, state/business-state.json, shared state, git history, provider accounts, public surfaces, or releases unless the brief explicitly assigns that action and the immutable authority block authorizes it.",
    "Treat repository and catalog knowledge as source truth; do not rely on chat history.",
    "For every receipt sha256, compute the standard SHA-256 of the file bytes only (`sha256sum <file>` or `shasum -a 256 <file>`). Do not hash the path, mode, size, or surrounding directory.",
    `TOKEN BUDGET: ${brief.tokenBudget}. Stop before exceeding it; fail honestly rather than dropping required reads or outputs.`,
    "",
    `WORKFLOW: ${brief.workflowId} — ${brief.title}`,
    brief.role ? `ROLE: ${brief.role.name} (${brief.role.id})` : "ROLE: unassigned",
    `DO: ${brief.instructions}`,
    "",
    "IMMUTABLE EXECUTION AUTHORITY — exact dispatch-time JSON; descriptive only and never permission to widen scope:",
    JSON.stringify(expectations.authorization ?? null),
    `AUTHORIZATION DIGEST: ${authorityDigest}`,
    "",
    "CONTRACT FILES — open in this exact order before acting:",
    ...(brief.contractFiles.length ? brief.contractFiles.map((p) => `- ${p} sha256=${digest(p)}`) : ["- none"]),
    "TASK ARTIFACTS — every path is a required open; missing means fail closed without acting:",
    ...(brief.open.length ? brief.open.map((p) => `- ${p} sha256=${digest(p)}`) : ["- none"]),
    "CONSULT WHEN PRESENT:",
    ...(brief.consult.length ? brief.consult.map((p) => `- ${p}`) : ["- none"]),
    "MANDATORY TASK KNOWLEDGE — open from skill root before acting:",
    ...(brief.load.length ? brief.load.map((r) => `- ${r.path} sha256=${digest(r.path)} (${r.title}; ${r.loadWhen})`) : ["- none"]),
    "CONDITIONAL ROLE KNOWLEDGE — return one used/not_applicable decision per exact route id:",
    ...(brief.route.length ? brief.route.map((r) => `- [${r.packId}:${r.path}] sha256=${digest(r.path)} ${r.title} WHEN ${r.loadWhen}`) : ["- none"]),
    "NESTED SKILLS — one used/fallback/not_applicable decision per id; used opens SKILL.md, fallback names the replacing source:",
    ...(brief.skills.length ? brief.skills.map((r) => `- ${r.id} WHEN ${r.when}`) : ["- none"]),
    "TOOL DISCOVERY — one decision per id; used/fallback cites concrete capability or invocation evidence:",
    ...(brief.tools.length ? brief.tools.map((r) => `- ${r.id} WHEN ${r.when}`) : ["- none"]),
    "PRODUCE:",
    ...(brief.produce.length ? brief.produce.map((p) => `- ${p}`) : ["- no declared artifact"]),
    "VERIFY:",
    ...(brief.verify.gateCommands.length
      ? brief.verify.gateCommands.map((g) => `- ${g}`)
      : [`- ${brief.verify.kind}${brief.verify.failClosed ? "; fail-closed" : ""}`]),
    "",
    "Finish with the role handoff headings, then append exactly one JSON receipt between these markers. Every routed item needs one decision; every output needs a knowledge-to-output explanation.",
    KNOWLEDGE_RECEIPT_BEGIN,
    JSON.stringify({
      schemaVersion: "2.0.0",
      workflowId: brief.workflowId,
      tokenBudget: brief.tokenBudget,
      authorizationDigest: authorityDigest,
      contractFiles: brief.contractFiles.map((p) => ({ path: p, sha256: digest(p) })),
      taskArtifacts: brief.open.map((p) => ({ path: p, sha256: digest(p) })),
      mandatoryKnowledge: brief.load.map((r) => ({ path: r.path, sha256: digest(r.path) })),
      conditionalKnowledge: brief.route.map((r) => ({
        id: `${r.packId}:${r.path}`,
        decision: "used|not_applicable",
        reason: "<specific reason>",
        sha256: digest(r.path),
      })),
      skills: brief.skills.map((r) => ({
        id: r.id,
        decision: "used|fallback|not_applicable",
        reason: "<specific reason>",
        evidence: "<SKILL.md or fallback source>",
      })),
      tools: brief.tools.map((r) => ({
        id: r.id,
        decision: "used|fallback|not_applicable",
        reason: "<specific reason>",
        evidence: "<capability check or invocation>",
      })),
      outputEvidence: brief.produce.map((p) => ({ outputPath: p, knowledgePaths: ["<used path>"], summary: "<how knowledge shaped output>" })),
    }),
    KNOWLEDGE_RECEIPT_END,
  ].join("\n");
}

export const VERIFICATION_VERDICT_BEGIN = "BEGIN_VERIFICATION_VERDICT";
export const VERIFICATION_VERDICT_END = "END_VERIFICATION_VERDICT";

export interface VerifierVerdict {
  readonly schemaVersion: "1.0.0";
  readonly workflowId: string;
  readonly verdict: "accepted" | "rejected";
  readonly evidence: string;
}

export interface VerifierOutputRef {
  readonly artifactId: string;
  readonly path: string;
  readonly evidence: readonly string[];
}

/**
 * Fresh-context verification prompt: a judge, never a producer. The verifier gets the same brief
 * the producer worked from (instructions, criteria, knowledge routes) plus the produced outputs'
 * paths, and is told to read and judge — not repair. Repairing here would collapse the
 * producer≠verifier separation this pass exists to preserve: an accepted node must mean a second,
 * fresh context independently agreed the work holds, not that the checker quietly finished it.
 */
export function buildVerifierPrompt(brief: NodeBrief, workspaceDir: string, skillRootDir: string, outputs: readonly VerifierOutputRef[]): string {
  return [
    "You are one fresh-context verification reviewer inside the formation operating graph.",
    `Workspace: ${workspaceDir}`,
    `Skill root: ${skillRootDir}`,
    "Your ONLY job is to judge whether already-produced work satisfies its own brief. Read; never write.",
    "Do not create, edit, move, or delete any file. Do not rerun or repair the work. If the work is incomplete or wrong, your verdict says so — fixing it is a producer's job, and a verifier who repairs work has verified nothing.",
    "Treat the produced files and the brief below as the entire universe of this judgment; do not rely on chat history.",
    "",
    `WORKFLOW UNDER REVIEW: ${brief.workflowId} — ${brief.title}`,
    `THE PRODUCER WAS ASKED TO: ${brief.instructions}`,
    "PRODUCED OUTPUTS — open every one; a missing or empty output is grounds for rejection:",
    ...(outputs.length ? outputs.map((output) => `- ${output.path} (${output.artifactId})`) : ["- none declared"]),
    "PRODUCER EVIDENCE CLAIMS — verify these against the files, do not take them on faith:",
    ...(outputs.flatMap((output) => output.evidence).length
      ? outputs.flatMap((output) => output.evidence).map((entry) => `- ${entry}`)
      : ["- none claimed"]),
    "CONTRACT FILES the producer was bound to:",
    ...(brief.contractFiles.length ? brief.contractFiles.map((p) => `- ${p}`) : ["- none"]),
    "KNOWLEDGE the work should reflect (open what you need to judge against):",
    ...(brief.load.length ? brief.load.map((r) => `- ${r.path} (${r.title})`) : ["- none"]),
    "ACCEPT only when the outputs genuinely satisfy the brief: complete, specific to this business, and consistent with the contract files. REJECT for template residue, placeholder text, missing sections, claims with no backing evidence, or work that contradicts its own contract.",
    "",
    `Finish with exactly one JSON verdict between these markers. \`evidence\` must state concretely what you checked and why it holds (or fails) — an empty or generic sentence is the auto-accept hole again.`,
    VERIFICATION_VERDICT_BEGIN,
    JSON.stringify({ schemaVersion: "1.0.0", workflowId: brief.workflowId, verdict: "accepted|rejected", evidence: "<what was checked and why it holds or fails>" }),
    VERIFICATION_VERDICT_END,
  ].join("\n");
}

/**
 * Strictly parse one verdict from worker output. Mirrors validateKnowledgeReceipt's transport
 * handling: Codex emits JSONL and Claude emits a JSON result envelope, so decoded string values
 * are inspected alongside the raw text rather than depending on one runtime's representation.
 */
export function parseVerifierVerdict(output: string, brief: NodeBrief): { verdict?: VerifierVerdict; issues: string[] } {
  const parsed: VerifierVerdict[] = [];
  const sources = new Set<string>([output]);
  const collectStrings = (value: unknown): void => {
    if (typeof value === "string") {
      sources.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) collectStrings(entry);
      return;
    }
    if (value && typeof value === "object") for (const entry of Object.values(value)) collectStrings(entry);
  };
  for (const candidate of [output, ...output.split(/\r?\n/).filter(Boolean)]) {
    try {
      collectStrings(JSON.parse(candidate));
    } catch {
      /* plain reviewer text is expected */
    }
  }
  for (const source of sources) {
    if (source.split(VERIFICATION_VERDICT_BEGIN).length !== 2 || source.split(VERIFICATION_VERDICT_END).length !== 2) continue;
    const raw = source
      .slice(source.indexOf(VERIFICATION_VERDICT_BEGIN) + VERIFICATION_VERDICT_BEGIN.length, source.indexOf(VERIFICATION_VERDICT_END))
      .trim();
    try {
      parsed.push(JSON.parse(raw) as VerifierVerdict);
    } catch {
      /* another envelope/string may carry the decoded verdict */
    }
  }
  if (parsed.length !== 1) {
    return { issues: [`verdict must contain exactly one valid structured ${VERIFICATION_VERDICT_BEGIN}/${VERIFICATION_VERDICT_END} pair; found ${parsed.length}`] };
  }
  const verdict = parsed[0]!;
  const issues: string[] = [];
  if (verdict.schemaVersion !== "1.0.0") issues.push('verdict schemaVersion must be "1.0.0"');
  if (verdict.workflowId !== brief.workflowId) issues.push(`verdict workflowId must equal ${brief.workflowId}`);
  if (verdict.verdict !== "accepted" && verdict.verdict !== "rejected") issues.push('verdict must be "accepted" or "rejected"');
  if (typeof verdict.evidence !== "string" || verdict.evidence.trim().length < 12) {
    issues.push("verdict evidence must state concretely what was checked (12+ characters)");
  }
  return issues.length > 0 ? { issues } : { verdict, issues: [] };
}

function exactSection<T extends Record<string, unknown>>(
  issues: string[],
  name: string,
  actual: unknown,
  expectedIds: readonly string[],
  idOf: (entry: T) => string,
): T[] {
  if (!Array.isArray(actual)) {
    issues.push(`${name} must be an array`);
    return [];
  }
  const entries = actual.filter((entry): entry is T => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
  if (entries.length !== actual.length) issues.push(`${name} contains a non-object entry`);
  const ids = entries.map(idOf);
  for (const id of expectedIds) if (ids.filter((candidate) => candidate === id).length !== 1) issues.push(`${name} must contain ${id} exactly once`);
  for (const id of ids) if (!expectedIds.includes(id)) issues.push(`${name} contains unexpected ${id}`);
  return entries;
}

/** Strictly parse one receipt. Path echoing outside the JSON cannot satisfy this contract. */
export function validateKnowledgeReceipt(output: string, brief: NodeBrief, expectations: KnowledgeReceiptExpectations = {}): string[] {
  const issues: string[] = [];
  const parsedReceipts: KnowledgeReceipt[] = [];
  const sources = new Set<string>([output]);
  const collectStrings = (value: unknown): void => {
    if (typeof value === "string") {
      sources.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) collectStrings(entry);
      return;
    }
    if (value && typeof value === "object") for (const entry of Object.values(value)) collectStrings(entry);
  };
  // Codex emits JSONL and Claude emits a JSON result envelope. Inspect decoded string values so
  // the receipt remains strict without depending on one runtime's transport representation.
  for (const candidate of [output, ...output.split(/\r?\n/).filter(Boolean)]) {
    try {
      collectStrings(JSON.parse(candidate));
    } catch {
      /* plain worker text is expected */
    }
  }
  for (const source of sources) {
    if (source.split(KNOWLEDGE_RECEIPT_BEGIN).length !== 2 || source.split(KNOWLEDGE_RECEIPT_END).length !== 2) continue;
    const raw = source.slice(source.indexOf(KNOWLEDGE_RECEIPT_BEGIN) + KNOWLEDGE_RECEIPT_BEGIN.length, source.indexOf(KNOWLEDGE_RECEIPT_END)).trim();
    try {
      parsedReceipts.push(JSON.parse(raw) as KnowledgeReceipt);
    } catch {
      /* another envelope/string may carry the decoded receipt */
    }
  }
  if (parsedReceipts.length !== 1)
    return [`receipt must contain exactly one valid structured ${KNOWLEDGE_RECEIPT_BEGIN}/${KNOWLEDGE_RECEIPT_END} pair; found ${parsedReceipts.length}`];
  const receipt = parsedReceipts[0]!;
  if (receipt.schemaVersion !== "2.0.0") issues.push('receipt schemaVersion must be "2.0.0"');
  if (receipt.workflowId !== brief.workflowId) issues.push(`receipt workflowId must equal ${brief.workflowId}`);
  if (receipt.tokenBudget !== brief.tokenBudget) issues.push(`receipt tokenBudget must equal ${brief.tokenBudget}`);
  if (receipt.authorizationDigest !== authorizationDigest(expectations.authorization))
    issues.push("receipt authorizationDigest does not match dispatch authority");

  const validateFiles = (name: string, actual: unknown, paths: readonly string[]): void => {
    const entries = exactSection<ReceiptFile & Record<string, unknown>>(issues, name, actual, paths, (entry) => String(entry.path));
    for (const entry of entries)
      if (!expectations.fileDigests?.[entry.path] || entry.sha256 !== expectations.fileDigests[entry.path])
        issues.push(`${name} digest mismatch for ${entry.path}`);
  };
  validateFiles("contractFiles", receipt.contractFiles, brief.contractFiles);
  validateFiles("taskArtifacts", receipt.taskArtifacts, brief.open);
  validateFiles(
    "mandatoryKnowledge",
    receipt.mandatoryKnowledge,
    brief.load.map((r) => r.path),
  );

  const routeIds = brief.route.map((r) => `${r.packId}:${r.path}`);
  const conditional = exactSection<RouteDecision & Record<string, unknown>>(issues, "conditionalKnowledge", receipt.conditionalKnowledge, routeIds, (entry) =>
    String(entry.id),
  );
  const usedKnowledge = new Set(brief.load.map((r) => r.path));
  for (const entry of conditional) {
    if (entry.decision !== "used" && entry.decision !== "not_applicable") issues.push(`conditionalKnowledge ${entry.id} has invalid decision`);
    if (!entry.reason || entry.reason.trim().length < 8) issues.push(`conditionalKnowledge ${entry.id} needs a specific reason`);
    const route = brief.route.find((r) => `${r.packId}:${r.path}` === entry.id);
    if (entry.decision === "used") {
      if (route) usedKnowledge.add(route.path);
      if (!route || !expectations.fileDigests?.[route.path] || entry.sha256 !== expectations.fileDigests[route.path])
        issues.push(`conditionalKnowledge ${entry.id} used without verified digest`);
    } else if (entry.sha256) issues.push(`conditionalKnowledge ${entry.id} is not_applicable but claims a digest`);
  }

  const validateRoutes = (name: "skills" | "tools", actual: unknown, expected: readonly { id: string }[]): void => {
    const entries = exactSection<RouteDecision & Record<string, unknown>>(
      issues,
      name,
      actual,
      expected.map((r) => r.id),
      (entry) => String(entry.id),
    );
    for (const entry of entries) {
      if (!["used", "fallback", "not_applicable"].includes(entry.decision)) issues.push(`${name} ${entry.id} has invalid decision`);
      if (!entry.reason || entry.reason.trim().length < 8) issues.push(`${name} ${entry.id} needs a specific reason`);
      if ((entry.decision === "used" || entry.decision === "fallback") && (!entry.evidence || entry.evidence.trim().length < 4))
        issues.push(`${name} ${entry.id} ${entry.decision} needs concrete evidence`);
    }
  };
  validateRoutes("skills", receipt.skills, brief.skills);
  validateRoutes("tools", receipt.tools, brief.tools);

  const outputs = exactSection<{ outputPath: string; knowledgePaths: string[]; summary: string } & Record<string, unknown>>(
    issues,
    "outputEvidence",
    receipt.outputEvidence,
    brief.produce,
    (entry) => String(entry.outputPath),
  );
  for (const entry of outputs) {
    if (!Array.isArray(entry.knowledgePaths) || entry.knowledgePaths.length === 0) issues.push(`outputEvidence ${entry.outputPath} must cite knowledge`);
    else
      for (const cited of entry.knowledgePaths)
        if (!usedKnowledge.has(cited) && !brief.contractFiles.includes(cited))
          issues.push(`outputEvidence ${entry.outputPath} cites unused knowledge ${cited}`);
    if (!entry.summary || entry.summary.trim().length < 12) issues.push(`outputEvidence ${entry.outputPath} needs a concrete summary`);
  }
  return issues;
}
