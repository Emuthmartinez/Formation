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

interface ReceiptFile { path: string; sha256: string }
interface RouteDecision { id: string; decision: "used" | "not_applicable" | "fallback"; reason: string; sha256?: string; evidence?: string }
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
    "You are one fresh-context specialist worker inside the b2c-mobile-business-launch operating graph.",
    `Workspace: ${workspaceDir}`,
    `Skill root: ${skillRootDir}`,
    "Stay inside the assigned objective and write scope. Do not edit control/**, state/business-state.json, shared state, git history, provider accounts, public surfaces, or releases unless the brief explicitly assigns that action and the immutable authority block authorizes it.",
    "Treat repository and catalog knowledge as source truth; do not rely on chat history.",
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
    "CONSULT WHEN PRESENT:", ...(brief.consult.length ? brief.consult.map((p) => `- ${p}`) : ["- none"]),
    "MANDATORY TASK KNOWLEDGE — open from skill root before acting:",
    ...(brief.load.length ? brief.load.map((r) => `- ${r.path} sha256=${digest(r.path)} (${r.title}; ${r.loadWhen})`) : ["- none"]),
    "CONDITIONAL ROLE KNOWLEDGE — return one used/not_applicable decision per exact route id:",
    ...(brief.route.length ? brief.route.map((r) => `- [${r.packId}:${r.path}] sha256=${digest(r.path)} ${r.title} WHEN ${r.loadWhen}`) : ["- none"]),
    "NESTED SKILLS — one used/fallback/not_applicable decision per id; used opens SKILL.md, fallback names the replacing source:",
    ...(brief.skills.length ? brief.skills.map((r) => `- ${r.id} WHEN ${r.when}`) : ["- none"]),
    "TOOL DISCOVERY — one decision per id; used/fallback cites concrete capability or invocation evidence:",
    ...(brief.tools.length ? brief.tools.map((r) => `- ${r.id} WHEN ${r.when}`) : ["- none"]),
    "PRODUCE:", ...(brief.produce.length ? brief.produce.map((p) => `- ${p}`) : ["- no declared artifact"]),
    "VERIFY:", ...(brief.verify.gateCommands.length ? brief.verify.gateCommands.map((g) => `- ${g}`) : [`- ${brief.verify.kind}${brief.verify.failClosed ? "; fail-closed" : ""}`]),
    "",
    "Finish with the role handoff headings, then append exactly one JSON receipt between these markers. Every routed item needs one decision; every output needs a knowledge-to-output explanation.",
    KNOWLEDGE_RECEIPT_BEGIN,
    JSON.stringify({
      schemaVersion: "2.0.0", workflowId: brief.workflowId, tokenBudget: brief.tokenBudget, authorizationDigest: authorityDigest,
      contractFiles: brief.contractFiles.map((p) => ({ path: p, sha256: digest(p) })),
      taskArtifacts: brief.open.map((p) => ({ path: p, sha256: digest(p) })),
      mandatoryKnowledge: brief.load.map((r) => ({ path: r.path, sha256: digest(r.path) })),
      conditionalKnowledge: brief.route.map((r) => ({ id: `${r.packId}:${r.path}`, decision: "used|not_applicable", reason: "<specific reason>", sha256: digest(r.path) })),
      skills: brief.skills.map((r) => ({ id: r.id, decision: "used|fallback|not_applicable", reason: "<specific reason>", evidence: "<SKILL.md or fallback source>" })),
      tools: brief.tools.map((r) => ({ id: r.id, decision: "used|fallback|not_applicable", reason: "<specific reason>", evidence: "<capability check or invocation>" })),
      outputEvidence: brief.produce.map((p) => ({ outputPath: p, knowledgePaths: ["<used path>"], summary: "<how knowledge shaped output>" })),
    }),
    KNOWLEDGE_RECEIPT_END,
  ].join("\n");
}

function exactSection<T extends Record<string, unknown>>(issues: string[], name: string, actual: unknown, expectedIds: readonly string[], idOf: (entry: T) => string): T[] {
  if (!Array.isArray(actual)) { issues.push(`${name} must be an array`); return []; }
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
    if (typeof value === "string") { sources.add(value); return; }
    if (Array.isArray(value)) { for (const entry of value) collectStrings(entry); return; }
    if (value && typeof value === "object") for (const entry of Object.values(value)) collectStrings(entry);
  };
  // Codex emits JSONL and Claude emits a JSON result envelope. Inspect decoded string values so
  // the receipt remains strict without depending on one runtime's transport representation.
  for (const candidate of [output, ...output.split(/\r?\n/).filter(Boolean)]) {
    try { collectStrings(JSON.parse(candidate)); } catch { /* plain worker text is expected */ }
  }
  for (const source of sources) {
    if (source.split(KNOWLEDGE_RECEIPT_BEGIN).length !== 2 || source.split(KNOWLEDGE_RECEIPT_END).length !== 2) continue;
    const raw = source.slice(source.indexOf(KNOWLEDGE_RECEIPT_BEGIN) + KNOWLEDGE_RECEIPT_BEGIN.length, source.indexOf(KNOWLEDGE_RECEIPT_END)).trim();
    try { parsedReceipts.push(JSON.parse(raw) as KnowledgeReceipt); } catch { /* another envelope/string may carry the decoded receipt */ }
  }
  if (parsedReceipts.length !== 1) return [`receipt must contain exactly one valid structured ${KNOWLEDGE_RECEIPT_BEGIN}/${KNOWLEDGE_RECEIPT_END} pair; found ${parsedReceipts.length}`];
  const receipt = parsedReceipts[0]!;
  if (receipt.schemaVersion !== "2.0.0") issues.push('receipt schemaVersion must be "2.0.0"');
  if (receipt.workflowId !== brief.workflowId) issues.push(`receipt workflowId must equal ${brief.workflowId}`);
  if (receipt.tokenBudget !== brief.tokenBudget) issues.push(`receipt tokenBudget must equal ${brief.tokenBudget}`);
  if (receipt.authorizationDigest !== authorizationDigest(expectations.authorization)) issues.push("receipt authorizationDigest does not match dispatch authority");

  const validateFiles = (name: string, actual: unknown, paths: readonly string[]): void => {
    const entries = exactSection<ReceiptFile & Record<string, unknown>>(issues, name, actual, paths, (entry) => String(entry.path));
    for (const entry of entries) if (!expectations.fileDigests?.[entry.path] || entry.sha256 !== expectations.fileDigests[entry.path]) issues.push(`${name} digest mismatch for ${entry.path}`);
  };
  validateFiles("contractFiles", receipt.contractFiles, brief.contractFiles);
  validateFiles("taskArtifacts", receipt.taskArtifacts, brief.open);
  validateFiles("mandatoryKnowledge", receipt.mandatoryKnowledge, brief.load.map((r) => r.path));

  const routeIds = brief.route.map((r) => `${r.packId}:${r.path}`);
  const conditional = exactSection<RouteDecision & Record<string, unknown>>(issues, "conditionalKnowledge", receipt.conditionalKnowledge, routeIds, (entry) => String(entry.id));
  const usedKnowledge = new Set(brief.load.map((r) => r.path));
  for (const entry of conditional) {
    if (entry.decision !== "used" && entry.decision !== "not_applicable") issues.push(`conditionalKnowledge ${entry.id} has invalid decision`);
    if (!entry.reason || entry.reason.trim().length < 8) issues.push(`conditionalKnowledge ${entry.id} needs a specific reason`);
    const route = brief.route.find((r) => `${r.packId}:${r.path}` === entry.id);
    if (entry.decision === "used") {
      if (route) usedKnowledge.add(route.path);
      if (!route || !expectations.fileDigests?.[route.path] || entry.sha256 !== expectations.fileDigests[route.path]) issues.push(`conditionalKnowledge ${entry.id} used without verified digest`);
    } else if (entry.sha256) issues.push(`conditionalKnowledge ${entry.id} is not_applicable but claims a digest`);
  }

  const validateRoutes = (name: "skills" | "tools", actual: unknown, expected: readonly { id: string }[]): void => {
    const entries = exactSection<RouteDecision & Record<string, unknown>>(issues, name, actual, expected.map((r) => r.id), (entry) => String(entry.id));
    for (const entry of entries) {
      if (!["used", "fallback", "not_applicable"].includes(entry.decision)) issues.push(`${name} ${entry.id} has invalid decision`);
      if (!entry.reason || entry.reason.trim().length < 8) issues.push(`${name} ${entry.id} needs a specific reason`);
      if ((entry.decision === "used" || entry.decision === "fallback") && (!entry.evidence || entry.evidence.trim().length < 4)) issues.push(`${name} ${entry.id} ${entry.decision} needs concrete evidence`);
    }
  };
  validateRoutes("skills", receipt.skills, brief.skills);
  validateRoutes("tools", receipt.tools, brief.tools);

  const outputs = exactSection<{ outputPath: string; knowledgePaths: string[]; summary: string } & Record<string, unknown>>(issues, "outputEvidence", receipt.outputEvidence, brief.produce, (entry) => String(entry.outputPath));
  for (const entry of outputs) {
    if (!Array.isArray(entry.knowledgePaths) || entry.knowledgePaths.length === 0) issues.push(`outputEvidence ${entry.outputPath} must cite knowledge`);
    else for (const cited of entry.knowledgePaths) if (!usedKnowledge.has(cited) && !brief.contractFiles.includes(cited)) issues.push(`outputEvidence ${entry.outputPath} cites unused knowledge ${cited}`);
    if (!entry.summary || entry.summary.trim().length < 12) issues.push(`outputEvidence ${entry.outputPath} needs a concrete summary`);
  }
  return issues;
}
