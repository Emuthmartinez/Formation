import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type {
  CatalogContextPack,
  CatalogKnowledgePackage,
  CatalogKnowledgeSource,
  CatalogReference,
  CatalogWorkflowDef,
  ContextPackId,
  ReferenceId,
  WorkflowId,
} from "./types.js";

type RecordValue = Record<string, unknown>;

function record(value: unknown, field: string, manifestPath: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${manifestPath}: ${field} must be an object.`);
  return value as RecordValue;
}

function text(value: unknown, field: string, manifestPath: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${manifestPath}: ${field} must be a non-empty string.`);
  return value.trim();
}

function list(value: unknown, field: string, manifestPath: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${manifestPath}: ${field} must be a string array.`);
  }
  return value as string[];
}

function source(value: unknown, manifestPath: string): CatalogKnowledgeSource {
  const item = record(value, "sources[]", manifestPath);
  const cadence = Number(item.review_cadence_days);
  if (!Number.isInteger(cadence) || cadence < 1 || cadence > 3650)
    throw new Error(`${manifestPath}: source review_cadence_days must be an integer between 1 and 3650.`);
  return {
    id: text(item.id, "sources[].id", manifestPath),
    name: text(item.name, "sources[].name", manifestPath),
    sourceType: text(item.source_type, "sources[].source_type", manifestPath),
    url: text(item.url, "sources[].url", manifestPath),
    reviewCadenceDays: cadence,
    claimScope: text(item.claim_scope, "sources[].claim_scope", manifestPath),
    lastReviewDate: text(String(item.last_review_date ?? ""), "sources[].last_review_date", manifestPath),
    reviewer: text(item.reviewer, "sources[].reviewer", manifestPath),
  };
}

function discoverYaml(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return discoverYaml(target);
    return entry.isFile() && /\.ya?ml$/u.test(entry.name) ? [target] : [];
  });
}

export function loadKnowledgePackages(skillRoot: string): CatalogKnowledgePackage[] {
  const directory = path.join(skillRoot, "catalog/knowledge");
  return discoverYaml(directory)
    .sort()
    .map((manifestPath) => {
      const parsed = record(YAML.parse(readFileSync(manifestPath, "utf8")), "manifest", manifestPath);
      const bindings = record(parsed.bindings, "bindings", manifestPath);
      const lifecycle = text(parsed.lifecycle, "lifecycle", manifestPath);
      if (!new Set(["draft", "active", "deprecated"]).has(lifecycle)) throw new Error(`${manifestPath}: lifecycle is invalid.`);
      const sources = Array.isArray(parsed.sources) ? parsed.sources.map((item) => source(item, manifestPath)) : [];
      const sourceExemption = typeof parsed.source_exemption === "string" ? parsed.source_exemption.trim() : undefined;
      if (lifecycle === "active" && sources.length === 0 && !sourceExemption) {
        throw new Error(`${manifestPath}: an active package needs a source or a source_exemption.`);
      }
      return {
        id: text(parsed.id, "id", manifestPath) as ReferenceId,
        title: text(parsed.title, "title", manifestPath),
        domainId: text(parsed.domain_id, "domain_id", manifestPath) as `domain.${string}`,
        path: text(parsed.document_path, "document_path", manifestPath),
        loadWhen: text(parsed.load_when, "load_when", manifestPath),
        lifecycle: lifecycle as CatalogKnowledgePackage["lifecycle"],
        hub: parsed.hub === true || undefined,
        sessionScoped: parsed.session_scoped === true || undefined,
        applicabilityNotes: text(parsed.applicability_notes, "applicability_notes", manifestPath),
        sourceExemption,
        sources,
        retired: parsed.retired === true || undefined,
        replacementIds: list(parsed.replacement_ids, "replacement_ids", manifestPath) as ReferenceId[],
        workflowIds: list(bindings.workflow_ids, "bindings.workflow_ids", manifestPath) as WorkflowId[],
        contextPackIds: list(bindings.context_pack_ids, "bindings.context_pack_ids", manifestPath) as ContextPackId[],
        manifestPath: path.relative(skillRoot, manifestPath),
      };
    });
}

export function resolveKnowledgeGraph(
  packages: readonly CatalogKnowledgePackage[],
  workflows: readonly CatalogWorkflowDef[],
  contextPacks: readonly Omit<CatalogContextPack, "referenceIds">[],
): { references: CatalogReference[]; workflows: CatalogWorkflowDef[]; contextPacks: CatalogContextPack[] } {
  const active = packages.filter((item) => item.lifecycle === "active");
  const byWorkflow = new Map<WorkflowId, ReferenceId[]>();
  const byContextPack = new Map<ContextPackId, ReferenceId[]>();
  for (const item of active) {
    for (const workflowId of item.workflowIds) byWorkflow.set(workflowId, [...(byWorkflow.get(workflowId) ?? []), item.id]);
    for (const contextPackId of item.contextPackIds) byContextPack.set(contextPackId, [...(byContextPack.get(contextPackId) ?? []), item.id]);
  }
  return {
    references: active.map(({ workflowIds: _workflowIds, contextPackIds: _contextPackIds, manifestPath: _manifestPath, ...reference }) => reference),
    workflows: workflows.map((workflow) => ({ ...workflow, referenceIds: byWorkflow.get(workflow.id) ?? [] })),
    contextPacks: contextPacks.map((pack) => ({ ...pack, referenceIds: byContextPack.get(pack.id) ?? [] })),
  };
}
