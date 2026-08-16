import type { NodeBrief } from "../engine/node-brief.js";

export const KNOWLEDGE_RECEIPT_MARKERS = ["CONTRACT_FILES_LOADED", "KNOWLEDGE_LOADED", "ROLE_KNOWLEDGE_USED", "SKILLS_USED", "TOOLS_USED"] as const;

/** Build the complete fresh-context worker prompt. Paths stay explicit and shallow. */
export function buildWorkerPrompt(brief: NodeBrief, workspaceDir: string, skillRootDir: string): string {
  const lines: string[] = [
    "You are one fresh-context specialist worker inside the b2c-mobile-business-launch operating graph.",
    `Workspace: ${workspaceDir}`,
    `Skill root: ${skillRootDir}`,
    "Stay inside the assigned objective and write scope. Do not edit control/**, state/business-state.json, shared state, git history, provider accounts, public surfaces, or releases unless the brief explicitly assigns that external action and a current approval envelope authorizes it.",
    "Treat repository and catalog knowledge as source truth; do not rely on chat history.",
    "",
    `WORKFLOW: ${brief.workflowId} — ${brief.title}`,
    brief.role ? `ROLE: ${brief.role.name} (${brief.role.id})` : "ROLE: unassigned",
    `DO: ${brief.instructions}`,
    "",
    "CONTRACT FILES — open from the workspace in this exact order before acting:",
    ...(brief.contractFiles.length > 0 ? brief.contractFiles.map((entry) => `- ${entry}`) : ["- none"]),
    "",
    "TASK ARTIFACTS — open from the workspace:",
    ...(brief.open.length > 0 ? brief.open.map((entry) => `- ${entry}`) : ["- none"]),
    "CONSULT WHEN PRESENT:",
    ...(brief.consult.length > 0 ? brief.consult.map((entry) => `- ${entry}`) : ["- none"]),
    "",
    "MANDATORY TASK KNOWLEDGE — open from the skill root before acting:",
    ...(brief.load.length > 0 ? brief.load.map((entry) => `- ${entry.path} (${entry.title}; routed because: ${entry.loadWhen})`) : ["- none"]),
    "",
    "CONDITIONAL ROLE KNOWLEDGE — load only when the condition matches this assignment:",
    ...(brief.route.length > 0 ? brief.route.map((entry) => `- [${entry.packId}] ${entry.path} (${entry.title}) WHEN ${entry.loadWhen}`) : ["- none"]),
    "",
    "NESTED SKILLS — when a route matches and the skill is installed, invoke that skill and follow its SKILL.md; if unavailable, use the catalog knowledge and record the fallback:",
    ...(brief.skills.length > 0 ? brief.skills.map((entry) => `- ${entry.id} WHEN ${entry.when}`) : ["- none"]),
    "",
    "TOOL DISCOVERY — inspect current capabilities before declaring one unavailable; current schemas and --help outrank stored examples:",
    ...(brief.tools.length > 0 ? brief.tools.map((entry) => `- ${entry.id} WHEN ${entry.when}`) : ["- none"]),
    "",
    "PRODUCE:",
    ...(brief.produce.length > 0 ? brief.produce.map((entry) => `- ${entry}`) : ["- no declared artifact; complete the bounded observation or gate task"]),
    "VERIFY:",
    ...(brief.verify.gateCommands.length > 0
      ? brief.verify.gateCommands.map((entry) => `- ${entry}`)
      : [`- ${brief.verify.kind}${brief.verify.failClosed ? "; independent acceptance remains fail-closed" : ""}`]),
    "",
    "Finish with the role handoff headings from APP_AGENTS.md, then append this machine-checkable receipt. List exact repo-relative paths and exact skill ids; use `none — <reason>` only for conditional routes that did not match:",
    "CONTRACT_FILES_LOADED:",
    "- <path>",
    "KNOWLEDGE_LOADED:",
    "- <mandatory knowledge path>",
    "ROLE_KNOWLEDGE_USED:",
    "- <conditional knowledge path or none — reason>",
    "SKILLS_USED:",
    "- <skill id or none — reason>",
    "TOOLS_USED:",
    "- <tool/capability or none — reason>",
  ];
  return lines.join("\n");
}

/** Reject a worker that did not attest to the exact parent contracts and mandatory knowledge. */
export function validateKnowledgeReceipt(output: string, brief: NodeBrief): string[] {
  const issues: string[] = [];
  for (const marker of KNOWLEDGE_RECEIPT_MARKERS) if (!output.includes(`${marker}:`)) issues.push(`missing ${marker} receipt`);
  for (const contractPath of brief.contractFiles) if (!output.includes(contractPath)) issues.push(`receipt does not name contract ${contractPath}`);
  for (const reference of brief.load) if (!output.includes(reference.path)) issues.push(`receipt does not name mandatory knowledge ${reference.path}`);
  return issues;
}
