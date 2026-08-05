#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { businessUnitCoversAllGrantableDomains } from "./business-units.js";
import { isCatalogId, type CatalogId } from "./ids.js";
import { composeCatalog } from "./index.js";
import type { Catalog, CatalogIssue } from "./types.js";

/**
 * Structural validation for the v2 catalog (U8). Ported from runtime/graph/validate.ts's
 * checks — duplicate/invalid IDs, dangling references, cycles, missing files — restructured
 * against the catalog/types.ts shape. Named issue codes throughout (never a bare boolean),
 * matching the `catalog_graph.*` family so a future capability-boundary or fixture test can
 * assert on a specific code rather than "did it exit non-zero".
 */
export function validateCatalog(catalog: Catalog, skillRoot: string): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const groups = [catalog.areas, catalog.domains, catalog.phases, catalog.lanes, catalog.references, catalog.workflows, catalog.artifacts, catalog.gates] as const;
  const allIds = new Map<string, string>();

  for (const group of groups) {
    for (const node of group) {
      if (!isCatalogId(node.id)) issues.push(error("catalog_graph.id.invalid", `Invalid catalog id: ${node.id}`));
      const previous = allIds.get(node.id);
      if (previous) issues.push(error("catalog_graph.id.duplicate", `Duplicate catalog id ${node.id} (seen more than once).`));
      allIds.set(node.id, node.id.split(".")[0] ?? "node");
    }
  }

  const areaIds = new Set(catalog.areas.map((item) => item.id));
  const domainIds = new Set(catalog.domains.map((item) => item.id));
  const phaseIds = new Set(catalog.phases.map((item) => item.id));
  const laneIds = new Set(catalog.lanes.map((item) => item.id));
  const workflowIds = new Set(catalog.workflows.map((item) => item.id));
  const artifactsByPath = new Map(catalog.artifacts.map((item) => [item.path, item.id]));
  const gateCommands = new Set(catalog.gates.map((item) => item.command));

  for (const area of catalog.areas) {
    if (area.domainIds.length === 0) issues.push(error("catalog_graph.area.empty", `${area.id} has no domains.`));
    for (const domainId of area.domainIds) checkKnown(issues, domainIds, domainId, "catalog_graph.area.unknown_domain", area.id);
  }

  for (const domain of catalog.domains) {
    if (domain.areaIds.length === 0) issues.push(error("catalog_graph.domain.area_missing", `${domain.id} has no business-area projection.`));
    for (const areaId of domain.areaIds) checkKnown(issues, areaIds, areaId, "catalog_graph.domain.unknown_area", domain.id);
    if (domain.indexPath && !existsSync(path.join(skillRoot, domain.indexPath))) {
      issues.push(error("catalog_graph.domain.index_missing", `${domain.id} index does not exist: ${domain.indexPath}`, domain.indexPath));
    }
  }

  uniqueBy(catalog.phases, (item) => item.key, "catalog_graph.phase.key_duplicate", issues);
  uniqueBy(catalog.phases, (item) => String(item.order), "catalog_graph.phase.order_duplicate", issues);

  uniqueBy(catalog.lanes, (item) => item.key, "catalog_graph.lane.key_duplicate", issues);
  for (const lane of catalog.lanes) {
    checkKnown(issues, domainIds, lane.ownerDomainId, "catalog_graph.lane.unknown_domain", lane.id);
    for (const dependencyId of lane.dependencyIds) checkKnown(issues, laneIds, dependencyId, "catalog_graph.lane.unknown_dependency", lane.id);
  }
  detectCycles(
    catalog.lanes.map((lane) => ({ id: lane.id, dependencies: lane.dependencyIds })),
    "catalog_graph.lane.cycle",
    issues,
  );

  uniqueBy(catalog.references, (item) => item.path, "catalog_graph.reference.path_duplicate", issues);
  for (const reference of catalog.references) {
    checkKnown(issues, domainIds, reference.domainId, "catalog_graph.reference.unknown_domain", reference.id);
    if (!existsSync(path.join(skillRoot, reference.path))) {
      issues.push(error("catalog_graph.reference.path_missing", `${reference.id} points to missing file ${reference.path}.`, reference.path));
    }
    if (!reference.loadWhen.trim()) {
      issues.push(error("catalog_graph.reference.load_when_missing", `${reference.id} has no load condition.`, reference.path));
    }
  }

  for (const workflow of catalog.workflows) {
    validateWorkflow(workflow, issues);
    checkKnown(issues, domainIds, workflow.domainId, "catalog_graph.workflow.unknown_domain", workflow.id);
    for (const areaId of workflow.areaIds) checkKnown(issues, areaIds, areaId, "catalog_graph.workflow.unknown_area", workflow.id);
    for (const phaseId of workflow.phaseIds) checkKnown(issues, phaseIds, phaseId, "catalog_graph.workflow.unknown_phase", workflow.id);
    for (const dependencyId of workflow.dependencies) checkKnown(issues, workflowIds, dependencyId, "catalog_graph.workflow.unknown_dependency", workflow.id);
    for (const outputPath of workflow.outputPaths) {
      if (!artifactsByPath.has(outputPath)) issues.push(error("catalog_graph.workflow.unknown_output", `${workflow.id} names unregistered artifact ${outputPath}.`));
    }
    for (const command of workflow.gateCommands) {
      if (!gateCommands.has(command)) issues.push(error("catalog_graph.workflow.unknown_gate", `${workflow.id} names unregistered gate command ${command}.`));
    }
  }
  detectCycles(
    catalog.workflows.map((workflow) => ({ id: workflow.id, dependencies: workflow.dependencies })),
    "catalog_graph.workflow.cycle",
    issues,
  );

  const writerCounts = new Map<string, number>();
  for (const workflow of catalog.workflows) {
    for (const outputPath of workflow.outputPaths) writerCounts.set(outputPath, (writerCounts.get(outputPath) ?? 0) + 1);
  }
  for (const [outputPath, count] of writerCounts) {
    if (count > 1) issues.push(error("catalog_graph.workflow.ambiguous_write", `${outputPath} is declared as an output by ${count} workflows (single-writer rule).`, outputPath));
  }

  uniqueBy(catalog.artifacts, (item) => item.path, "catalog_graph.artifact.path_duplicate", issues);
  for (const artifact of catalog.artifacts) {
    checkKnown(issues, domainIds, artifact.ownerDomainId, "catalog_graph.artifact.unknown_domain", artifact.id);
  }

  for (const gate of catalog.gates) {
    checkKnown(issues, domainIds, gate.ownerDomainId, "catalog_graph.gate.unknown_domain", gate.id);
    if (gate.scriptPath && !existsSync(path.join(skillRoot, gate.scriptPath))) {
      issues.push(error("catalog_graph.gate.script_missing", `${gate.command} points to missing script ${gate.scriptPath}.`, gate.scriptPath));
    }
    if ((gate.command.startsWith("check:") || gate.command.startsWith("validate:")) && gate.audit === "manual") {
      issues.push(error("catalog_graph.gate.audit_unregistered", `${gate.command} is neither in the audit plan nor explicitly excluded.`));
    }
  }

  if (!businessUnitCoversAllGrantableDomains()) {
    issues.push(error("catalog_graph.business_unit.coverage_gap", "businessUnitDomains (core/schema/types.ts) does not cover every grantable domain."));
  }

  return issues;
}

function validateWorkflow(workflow: Catalog["workflows"][number], issues: CatalogIssue[]): void {
  if (!workflow.trigger.trim()) issues.push(error("catalog_graph.workflow.trigger_missing", `${workflow.id} has no trigger.`));
  if (workflow.outputPaths.length === 0 && workflow.gateCommands.length === 0) {
    issues.push(error("catalog_graph.workflow.contract_empty", `${workflow.id} has neither outputs nor verification gates.`));
  }
}

function checkKnown(issues: CatalogIssue[], known: Set<CatalogId>, value: CatalogId, code: string, owner: string): void {
  if (!known.has(value)) issues.push(error(code, `${owner} references unknown ${value}.`));
}

function uniqueBy<T>(items: readonly T[], key: (item: T) => string, code: string, issues: CatalogIssue[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) issues.push(error(code, `Duplicate value ${value}.`));
    seen.add(value);
  }
}

function detectCycles<T extends CatalogId>(nodes: Array<{ id: T; dependencies: readonly T[] }>, code: string, issues: CatalogIssue[]): void {
  const edges = new Map(nodes.map((node) => [node.id, node.dependencies]));
  const active = new Set<T>();
  const settled = new Set<T>();
  const pathStack: T[] = [];
  const visit = (id: T): void => {
    if (settled.has(id)) return;
    if (active.has(id)) {
      const start = pathStack.indexOf(id);
      issues.push(error(code, `Cycle: ${[...pathStack.slice(start), id].join(" -> ")}.`));
      return;
    }
    active.add(id);
    pathStack.push(id);
    for (const dependency of edges.get(id) ?? []) visit(dependency);
    pathStack.pop();
    active.delete(id);
    settled.add(id);
  };
  for (const id of edges.keys()) visit(id);
}

function error(code: string, message: string, issuePath?: string): CatalogIssue {
  return { severity: "error", code, message, path: issuePath };
}

// --- CLI entry -----------------------------------------------------------------------

const isMain = (() => {
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return invoked === fileURLToPath(import.meta.url);
})();

if (isMain) {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultSkillRoot = path.resolve(scriptDir, "..");
  const skillRoot = parseSkillRoot(process.argv.slice(2), defaultSkillRoot);
  const catalog = composeCatalog(skillRoot);
  const issues = validateCatalog(catalog, skillRoot);
  const errors = issues.filter((issue) => issue.severity === "error");
  for (const issue of issues) console.error(`${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`);
  if (errors.length > 0) {
    console.error(`catalog/validate.ts: ${errors.length} error(s).`);
    process.exit(1);
  }
  console.log(
    `catalog/validate.ts: clean — ${catalog.domains.length} domains, ${catalog.workflows.length} workflows, ${catalog.references.length} references, ${catalog.gates.length} gates.`,
  );
}

function parseSkillRoot(argv: string[], fallback: string): string {
  for (let index = 0; index < argv.length; index += 1) {
    if ((argv[index] === "--skill-root" || argv[index] === "--root") && argv[index + 1]) return path.resolve(argv[index + 1]!);
  }
  return fallback;
}
