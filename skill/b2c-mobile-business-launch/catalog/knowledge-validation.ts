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

export function validateKnowledgePackages(
  packages: readonly CatalogKnowledgePackage[],
  skillRoot: string,
  domains: readonly CatalogDomain[],
  workflows: readonly CatalogWorkflowDef[],
  contextPacks: readonly Omit<CatalogContextPack, "referenceIds">[],
  now = new Date(),
): KnowledgeIssue[] {
  const issues: KnowledgeIssue[] = [];
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
    }
    if (item.lifecycle === "active" && !item.sessionScoped && item.workflowIds.length === 0 && item.contextPackIds.length === 0) {
      issues.push({ code: "knowledge.active.unbound", message: `${item.id} is active but has no graph binding.` });
    }
    if (item.lifecycle === "deprecated" && item.replacementIds.length === 0) {
      issues.push({ code: "knowledge.deprecated.replacement_missing", message: `${item.id} is deprecated but has no replacement.` });
    }
    for (const replacementId of item.replacementIds) {
      if (!packages.some((candidate) => candidate.id === replacementId))
        issues.push({ code: "knowledge.deprecated.replacement_invalid", message: `${item.id} uses unknown replacement ${replacementId}.` });
    }
    for (const source of item.sources) {
      if (daysSince(source.lastReviewDate, now) > source.reviewCadenceDays)
        issues.push({ code: "knowledge.source.stale", message: `${item.id} source ${source.id} needs review.` });
    }
  }
  return issues;
}
