import { existsSync } from "node:fs";
import path from "node:path";
import type { CatalogContextPack, CatalogDomain, CatalogKnowledgePackage, CatalogWorkflowDef } from "./types.js";

export interface KnowledgeIssue {
  code: string;
  message: string;
}

function daysSince(date: string, now: Date): number {
  const reviewed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(reviewed.valueOf()) ? Number.POSITIVE_INFINITY : Math.floor((now.valueOf() - reviewed.valueOf()) / 86_400_000);
}

/**
 * An agent routes by matching work against load_when text, so two active packages carrying the
 * same trigger are indistinguishable in the generated Reference Index — the reader cannot tell
 * which file to load. Comparison is whitespace/case-normalized so a re-wrap does not hide a
 * duplicate.
 */
function normalizedTrigger(loadWhen: string): string {
  return loadWhen.toLowerCase().replace(/\s+/gu, " ").trim();
}

/** Triggers are matrix cells, not prose; past this many words they defeat scanning. */
export const LOAD_WHEN_WORD_LIMIT = 45;

export function validateKnowledgePackages(
  packages: readonly CatalogKnowledgePackage[],
  skillRoot: string,
  domains: readonly CatalogDomain[],
  workflows: readonly CatalogWorkflowDef[],
  contextPacks: readonly Omit<CatalogContextPack, "referenceIds">[],
  subscribers: ReadonlyArray<{ contextPackIds: readonly string[] }> = [],
  now = new Date(),
): KnowledgeIssue[] {
  const issues: KnowledgeIssue[] = [];
  // A context-pack binding only delivers knowledge through something that carries the pack — a
  // worker role (the bridge/brief path) or a control-plane operator (the maintainer path). A pack
  // nobody subscribes to is dead configuration that reads as wiring: the 2026-08-19 audit found
  // exactly that shape and the follow-up nearly deleted context.machine before noticing the
  // maintainer OPERATORS carry it — which is why this check unions both subscriber kinds instead
  // of assuming roles are the only delivery path. Empty `subscribers` (an older caller) skips the
  // check rather than failing everything closed.
  const subscribedPackIds = new Set(subscribers.flatMap((subscriber) => [...subscriber.contextPackIds]));
  const ids = new Set<string>();
  const paths = new Set<string>();
  const domainIds = new Set(domains.map((item) => item.id));
  const workflowIds = new Set(workflows.map((item) => item.id));
  const contextPackIds = new Set(contextPacks.map((item) => item.id));
  for (const item of packages) {
    if (ids.has(item.id)) issues.push({ code: "knowledge.id.duplicate", message: `Duplicate knowledge ID: ${item.id}.` });
    ids.add(item.id);
    if (paths.has(item.path)) issues.push({ code: "knowledge.path.duplicate", message: `Duplicate document path: ${item.path}.` });
    paths.add(item.path);
    if (!domainIds.has(item.domainId)) issues.push({ code: "knowledge.domain.invalid", message: `${item.id} uses unknown domain ${item.domainId}.` });
    if (!existsSync(path.join(skillRoot, item.path)))
      issues.push({ code: "knowledge.document.missing", message: `${item.id} document is missing: ${item.path}.` });
    for (const workflowId of item.workflowIds) {
      if (!workflowIds.has(workflowId)) issues.push({ code: "knowledge.workflow.invalid", message: `${item.id} uses unknown workflow ${workflowId}.` });
    }
    for (const contextPackId of item.contextPackIds) {
      if (!contextPackIds.has(contextPackId))
        issues.push({ code: "knowledge.context.invalid", message: `${item.id} uses unknown context pack ${contextPackId}.` });
      else if (subscribers.length > 0 && !subscribedPackIds.has(contextPackId))
        issues.push({
          code: "knowledge.context.unsubscribed",
          message: `${item.id} binds ${contextPackId}, but no role or operator subscribes to that pack — the binding delivers nothing. Subscribe a carrier or remove the binding.`,
        });
    }
    if (item.lifecycle === "active" && !item.sessionScoped && item.workflowIds.length === 0 && item.contextPackIds.length === 0) {
      issues.push({ code: "knowledge.active.unbound", message: `${item.id} is active but has no graph binding.` });
    }
    if (item.lifecycle === "deprecated" && item.replacementIds.length === 0 && !item.retired) {
      issues.push({ code: "knowledge.deprecated.replacement_missing", message: `${item.id} is deprecated but has no replacement.` });
    }
    if (item.retired && item.lifecycle !== "deprecated") {
      issues.push({ code: "knowledge.retired.lifecycle_invalid", message: `${item.id} sets retired: true but is not deprecated.` });
    }
    for (const replacementId of item.replacementIds) {
      if (!packages.some((candidate) => candidate.id === replacementId))
        issues.push({ code: "knowledge.deprecated.replacement_invalid", message: `${item.id} uses unknown replacement ${replacementId}.` });
    }
    for (const source of item.sources) {
      if (daysSince(source.lastReviewDate, now) > source.reviewCadenceDays)
        issues.push({ code: "knowledge.source.stale", message: `${item.id} source ${source.id} needs review.` });
    }
    if (item.lifecycle === "active") {
      const words = item.loadWhen.trim().split(/\s+/u).length;
      if (words > LOAD_WHEN_WORD_LIMIT) {
        issues.push({
          code: "knowledge.load_when.over_length",
          message: `${item.id} load_when runs ${words} words (limit ${LOAD_WHEN_WORD_LIMIT}); move cross-references into applicability_notes or the document body.`,
        });
      }
    }
  }
  const triggerOwners = new Map<string, string>();
  for (const item of packages) {
    if (item.lifecycle !== "active") continue;
    const key = normalizedTrigger(item.loadWhen);
    const owner = triggerOwners.get(key);
    if (owner) {
      issues.push({
        code: "knowledge.load_when.duplicate",
        message: `${owner} and ${item.id} share an identical load_when trigger; an agent scanning the Reference Index cannot tell which to load. Differentiate the triggers, or state an explicit co-load in one of them.`,
      });
    } else {
      triggerOwners.set(key, item.id);
    }
  }
  return issues;
}
