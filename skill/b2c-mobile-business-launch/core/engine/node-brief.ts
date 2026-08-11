import type { CompiledPlan, CompiledRunNode } from "./compile.js";

/**
 * Composes the per-node worker brief from a compiled node's authored contract — the one place
 * that turns catalog data into "what a fresh-context worker actually receives". Three consumers
 * share it so they cannot drift: core/session/plan.ts (interactive sessions read briefs off the
 * frontier report instead of guessing which knowledge to load), core/adapters/
 * platform-execution.ts (the platform's describe boundary), and the future real executor (U6),
 * which gains a complete contract to hand a runtime CLI the day it is wired.
 *
 * Absent contract fields are surfaced as explicit "(not authored)" markers, never silently
 * dropped — a brief that hides a missing contract would recreate the title-only dispatch the
 * 2026-08 audit found, one layer up.
 */
export interface NodeBrief {
  workflowId: string;
  title: string;
  role?: { id: string; name: string; promptPath: string };
  instructions: string;
  /** Workspace paths the worker should open, in authored order. */
  open: string[];
  /** Open-if-present references — consulted when they exist, never a readiness gate. */
  consult: string[];
  /** Knowledge to load before working: path plus the authored load condition. */
  load: Array<{ path: string; title: string; loadWhen: string }>;
  /** Declared outputs the worker must produce (workspace paths). */
  produce: string[];
  /** How the work is verified: gate commands when deterministic, otherwise the policy kind. */
  verify: { kind: string; gateCommands: string[]; failClosed: boolean };
  /** Founder-only actions this node parks on (approval descriptions). */
  approvals: string[];
  tokenBudget: number;
}

const NOT_AUTHORED = "(not authored — this node predates the contract fields; work from title, trigger, and domain knowledge, and say so in the result)";

export function composeNodeBrief(node: CompiledRunNode, plan: CompiledPlan): NodeBrief {
  const pathsByArtifactId = new Map(plan.artifactBindings.map((binding) => [binding.artifactId, binding.path]));
  return {
    workflowId: node.workflowId,
    title: node.title,
    role: node.role,
    instructions: node.instructions?.trim() || NOT_AUTHORED,
    open: node.reads ?? [],
    consult: node.consults ?? [],
    load: (node.references ?? []).map((reference) => ({ path: reference.path, title: reference.title, loadWhen: reference.loadWhen })),
    produce: node.outputs.map((artifactId) => pathsByArtifactId.get(artifactId) ?? artifactId),
    verify: { kind: node.verification.kind, gateCommands: node.verification.gateIds, failClosed: node.verification.failClosed },
    approvals: node.approvals.map((approval) => approval.description),
    tokenBudget: node.tokenBudget,
  };
}

/** The brief as compact markdown, for the frontier report's human rendering. */
export function renderNodeBrief(brief: NodeBrief): string {
  const lines: string[] = [`### ${brief.title} (${brief.workflowId})`];
  if (brief.role) lines.push(`Role: ${brief.role.name} (${brief.role.promptPath})`);
  lines.push(`Do: ${brief.instructions}`);
  if (brief.open.length > 0) lines.push(`Open: ${brief.open.join(", ")}`);
  if (brief.consult.length > 0) lines.push(`Consult when present: ${brief.consult.join(", ")}`);
  if (brief.load.length > 0) lines.push(`Load: ${brief.load.map((entry) => entry.path).join(", ")}`);
  if (brief.produce.length > 0) lines.push(`Produce: ${brief.produce.join(", ")}`);
  lines.push(
    brief.verify.gateCommands.length > 0
      ? `Verify: ${brief.verify.gateCommands.join(", ")}`
      : `Verify: ${brief.verify.kind}${brief.verify.failClosed ? " (fail-closed: outputs stay unaccepted until a non-producer verifier accepts with evidence — `npm run verify:node`)" : ""}`,
  );
  if (brief.approvals.length > 0) lines.push(`Founder-only: ${brief.approvals.join("; ")}`);
  return lines.join("\n");
}
