import { existsSync, readFileSync } from "node:fs";
import type { CompiledPlan, CompiledRunNode } from "../engine/compile.js";
import type { RunStateDocument } from "../schema/types.js";

interface StandingEnvelope {
  id: string;
  provider: string;
  actionClasses: string[];
  operations: string[];
  resourcePatterns: string[];
  exclusions: string[];
  mode: "one_shot" | "standing";
  expiresAt: string;
  status: string;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/^provider\./, "")
    .replace(/[^a-z0-9]+/g, "");
}

function pathMatches(pattern: string, value: string): boolean {
  if (pattern === value) return true;
  if (pattern.endsWith("/**")) return value === pattern.slice(0, -3) || value.startsWith(pattern.slice(0, -2));
  if (pattern.endsWith("*")) return value.startsWith(pattern.slice(0, -1));
  return false;
}

function envelopeCoversNode(envelope: StandingEnvelope, node: CompiledRunNode, now: string): boolean {
  if (envelope.status !== "active" || envelope.mode !== "standing") return false;
  if (!Number.isFinite(Date.parse(envelope.expiresAt)) || Date.parse(envelope.expiresAt) <= Date.parse(now)) return false;
  if (!envelope.actionClasses.includes(node.actionClass)) return false;
  if (!envelope.operations.includes(node.workflowId)) return false;
  if (envelope.exclusions.some((entry) => entry === node.workflowId || node.outputPaths.some((outputPath) => pathMatches(entry, outputPath)))) return false;
  if (node.outputPaths.length > 0 && !node.outputPaths.every((outputPath) => envelope.resourcePatterns.some((pattern) => pathMatches(pattern, outputPath))))
    return false;
  if (
    node.providerIds.length > 0 &&
    !node.providerIds.every(
      (providerId) =>
        normalize(envelope.provider) === normalize(providerId) || envelope.resourcePatterns.some((pattern) => normalize(pattern) === normalize(providerId)),
    )
  )
    return false;
  return true;
}

function readEnvelopes(ledgerPath: string): StandingEnvelope[] {
  if (!existsSync(ledgerPath)) return [];
  try {
    const value = JSON.parse(readFileSync(ledgerPath, "utf8")) as { approvalEnvelopes?: unknown[] };
    return (Array.isArray(value.approvalEnvelopes) ? value.approvalEnvelopes : []).filter((entry): entry is StandingEnvelope => {
      if (!entry || typeof entry !== "object") return false;
      const item = entry as Partial<StandingEnvelope>;
      return (
        typeof item.id === "string" &&
        typeof item.provider === "string" &&
        Array.isArray(item.actionClasses) &&
        Array.isArray(item.operations) &&
        Array.isArray(item.resourcePatterns) &&
        Array.isArray(item.exclusions) &&
        typeof item.expiresAt === "string" &&
        typeof item.status === "string" &&
        (item.mode === "standing" || item.mode === "one_shot")
      );
    });
  } catch {
    return [];
  }
}

export interface StandingApprovalMatch {
  nodeId: string;
  workflowId: string;
  envelopeId: string;
}

/**
 * Convert exact, current standing envelopes into the run-state approvals the frontier already
 * understands. No fuzzy description matching: the envelope must name the exact workflow, cover
 * its action class, outputs, and providers, and remain unexpired. One-shot envelopes stay manual
 * because consumption must be recorded atomically with the action.
 */
export function applyStandingApprovals(plan: CompiledPlan, run: RunStateDocument, ledgerPath: string, now: string): StandingApprovalMatch[] {
  const envelopes = readEnvelopes(ledgerPath);
  const matches: StandingApprovalMatch[] = [];
  for (const node of plan.nodes) {
    if (node.approvals.length === 0) continue;
    const envelope = envelopes.find((candidate) => envelopeCoversNode(candidate, node, now));
    if (!envelope) continue;
    for (const approval of node.approvals) run.approvals[approval.id] = "approved";
    const state = run.nodes[node.id];
    if (state?.status === "waiting_founder") {
      state.status = "pending";
      state.blocker = undefined;
    }
    matches.push({ nodeId: node.id, workflowId: node.workflowId, envelopeId: envelope.id });
  }
  return matches;
}
