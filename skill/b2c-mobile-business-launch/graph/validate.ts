import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isGraphId } from "./ids.js";
import type { GraphId, GraphIssue, SkillGraph, WorkflowDefinition } from "./types.js";

export function validateSkillGraph(graph: SkillGraph, skillRoot: string): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const groups = [
    graph.areas,
    graph.domains,
    graph.phases,
    graph.lanes,
    graph.references,
    graph.contextPacks,
    graph.workflows,
    graph.artifacts,
    graph.gates,
    graph.operators,
    graph.providers,
  ] as const;
  const allIds = new Map<string, string>();

  for (const group of groups) {
    for (const node of group) {
      if (!isGraphId(node.id)) {
        issues.push(error("skill_graph.id.invalid", `Invalid graph id: ${node.id}`));
      }
      const previous = allIds.get(node.id);
      if (previous) issues.push(error("skill_graph.id.duplicate", `Duplicate graph id ${node.id} in ${previous} and another definition.`));
      allIds.set(node.id, node.id.split(".")[0] ?? "node");
    }
  }

  const areaIds = new Set(graph.areas.map((item) => item.id));
  const domainIds = new Set(graph.domains.map((item) => item.id));
  const phaseIds = new Set(graph.phases.map((item) => item.id));
  const laneIds = new Set(graph.lanes.map((item) => item.id));
  const referenceIds = new Set(graph.references.map((item) => item.id));
  const contextIds = new Set(graph.contextPacks.map((item) => item.id));
  const workflowIds = new Set(graph.workflows.map((item) => item.id));
  const artifactPaths = new Set(graph.artifacts.map((item) => item.path));
  const gateCommands = new Set(graph.gates.map((item) => item.command));
  const operatorIds = new Set(graph.operators.map((item) => item.id));
  const providerIds = new Set(graph.providers.map((item) => item.id));

  for (const area of graph.areas) {
    if (area.domainIds.length === 0) issues.push(error("skill_graph.area.empty", `${area.id} has no domains.`));
    for (const domainId of area.domainIds) checkKnown(issues, domainIds, domainId, "skill_graph.area.unknown_domain", area.id);
  }

  for (const domain of graph.domains) {
    if (domain.areaIds.length === 0) issues.push(error("skill_graph.domain.area_missing", `${domain.id} has no business-area projection.`));
    for (const areaId of domain.areaIds) checkKnown(issues, areaIds, areaId, "skill_graph.domain.unknown_area", domain.id);
    if (domain.indexPath && !existsSync(path.join(skillRoot, domain.indexPath))) {
      issues.push(error("skill_graph.domain.index_missing", `${domain.id} index does not exist: ${domain.indexPath}`, domain.indexPath));
    }
  }

  uniqueBy(graph.phases, (item) => item.key, "skill_graph.phase.key_duplicate", issues);
  uniqueBy(graph.phases, (item) => String(item.order), "skill_graph.phase.order_duplicate", issues);
  uniqueBy(graph.lanes, (item) => item.key, "skill_graph.lane.key_duplicate", issues);
  for (const lane of graph.lanes) {
    checkKnown(issues, domainIds, lane.ownerDomainId, "skill_graph.lane.unknown_domain", lane.id);
    for (const dependencyId of lane.dependencyIds) checkKnown(issues, laneIds, dependencyId, "skill_graph.lane.unknown_dependency", lane.id);
  }
  detectCycles(
    graph.lanes.map((lane) => ({ id: lane.id, dependencies: lane.dependencyIds })),
    "skill_graph.lane.cycle",
    issues,
  );

  uniqueBy(graph.references, (item) => item.path, "skill_graph.reference.path_duplicate", issues);
  for (const reference of graph.references) {
    checkKnown(issues, domainIds, reference.domainId, "skill_graph.reference.unknown_domain", reference.id);
    if (!existsSync(path.join(skillRoot, reference.path))) {
      issues.push(error("skill_graph.reference.path_missing", `${reference.id} points to missing file ${reference.path}.`, reference.path));
    }
    if (!reference.loadWhen.trim()) issues.push(error("skill_graph.reference.load_when_missing", `${reference.id} has no load condition.`, reference.path));
  }

  const routedReferences = new Set<string>();
  for (const pack of graph.contextPacks) {
    checkKnown(issues, domainIds, pack.domainId, "skill_graph.context.unknown_domain", pack.id);
    if (pack.indexReferenceId) checkKnown(issues, referenceIds, pack.indexReferenceId, "skill_graph.context.unknown_index", pack.id);
    if (pack.strategy === "load-all" && pack.entryReferenceIds.length < 2) {
      issues.push(warning("skill_graph.context.load_all_thin", `${pack.id} uses load-all with fewer than two entry references.`));
    }
    if (pack.strategy === "select-one" && pack.referenceIds.length < 2) {
      issues.push(error("skill_graph.context.select_one_ambiguous", `${pack.id} uses select-one without at least two choices.`));
    }
    if (pack.strategy === "progressive" && pack.entryReferenceIds.length === 0) {
      issues.push(error("skill_graph.context.progressive_entry_missing", `${pack.id} has no progressive entry reference.`));
    }
    for (const referenceId of [...pack.entryReferenceIds, ...pack.referenceIds]) {
      checkKnown(issues, referenceIds, referenceId, "skill_graph.context.unknown_reference", pack.id);
      routedReferences.add(referenceId);
    }
  }
  for (const reference of graph.references) {
    if (!reference.index && !routedReferences.has(reference.id)) {
      issues.push(error("skill_graph.reference.unrouted", `${reference.id} is not reachable through a context pack.`, reference.path));
    }
  }

  uniqueBy(graph.workflows, (item) => item.legacyId ?? item.id, "skill_graph.workflow.legacy_id_duplicate", issues);
  for (const workflow of graph.workflows) {
    validateWorkflow(workflow, issues);
    checkKnown(issues, domainIds, workflow.domainId, "skill_graph.workflow.unknown_domain", workflow.id);
    for (const areaId of workflow.areaIds) checkKnown(issues, areaIds, areaId, "skill_graph.workflow.unknown_area", workflow.id);
    for (const contextId of workflow.contextPackIds) checkKnown(issues, contextIds, contextId, "skill_graph.workflow.unknown_context", workflow.id);
    for (const referenceId of workflow.referenceIds) checkKnown(issues, referenceIds, referenceId, "skill_graph.workflow.unknown_reference", workflow.id);
    for (const phaseId of workflow.phaseIds) checkKnown(issues, phaseIds, phaseId, "skill_graph.workflow.unknown_phase", workflow.id);
    for (const laneId of workflow.laneIds) checkKnown(issues, laneIds, laneId, "skill_graph.workflow.unknown_lane", workflow.id);
    for (const upstreamId of workflow.upstreamWorkflowIds) checkKnown(issues, workflowIds, upstreamId, "skill_graph.workflow.unknown_upstream", workflow.id);
    for (const artifactPath of workflow.artifactPaths) {
      if (!artifactPaths.has(artifactPath))
        issues.push(error("skill_graph.workflow.unknown_artifact", `${workflow.id} names unregistered artifact ${artifactPath}.`));
    }
    for (const command of workflow.gateCommands) {
      if (!gateCommands.has(command)) issues.push(error("skill_graph.workflow.unknown_gate", `${workflow.id} names unregistered gate command ${command}.`));
    }
    for (const providerId of workflow.providerIds) checkKnown(issues, providerIds, providerId, "skill_graph.workflow.unknown_provider", workflow.id);
    for (const operatorId of workflow.operatorIds) checkKnown(issues, operatorIds, operatorId, "skill_graph.workflow.unknown_operator", workflow.id);
  }
  detectCycles(
    graph.workflows.map((workflow) => ({ id: workflow.id, dependencies: workflow.upstreamWorkflowIds })),
    "skill_graph.workflow.cycle",
    issues,
  );
  for (let number = 1; number <= 57; number += 1) {
    const expected = `L${String(number).padStart(2, "0")}`;
    if (!graph.workflows.some((workflow) => workflow.legacyId === expected)) {
      issues.push(error("skill_graph.workflow.inventory_gap", `Workflow inventory is missing ${expected}.`));
    }
  }

  uniqueBy(graph.artifacts, (item) => item.path, "skill_graph.artifact.path_duplicate", issues);
  for (const artifact of graph.artifacts) {
    checkKnown(issues, domainIds, artifact.ownerDomainId, "skill_graph.artifact.unknown_domain", artifact.id);
    for (const laneId of artifact.laneIds) checkKnown(issues, laneIds, laneId, "skill_graph.artifact.unknown_lane", artifact.id);
  }

  for (const gate of graph.gates) {
    checkKnown(issues, domainIds, gate.ownerDomainId, "skill_graph.gate.unknown_domain", gate.id);
    if (gate.scriptPath && !existsSync(path.join(skillRoot, gate.scriptPath))) {
      issues.push(error("skill_graph.gate.script_missing", `${gate.command} points to missing script ${gate.scriptPath}.`, gate.scriptPath));
    }
    if ((gate.command.startsWith("check:") || gate.command.startsWith("validate:")) && gate.audit === "manual") {
      issues.push(error("skill_graph.gate.audit_unregistered", `${gate.command} is neither in the audit plan nor explicitly excluded.`));
    }
  }

  for (const operator of graph.operators) {
    for (const domainId of operator.domainIds) checkKnown(issues, domainIds, domainId, "skill_graph.operator.unknown_domain", operator.id);
    for (const contextId of operator.contextPackIds) checkKnown(issues, contextIds, contextId, "skill_graph.operator.unknown_context", operator.id);
    if (operator.promptPath) {
      const promptPath = path.join(skillRoot, operator.promptPath);
      if (!existsSync(promptPath)) {
        issues.push(error("skill_graph.operator.prompt_missing", `${operator.id} prompt is missing: ${operator.promptPath}.`, operator.promptPath));
      } else if (!readFileSync(promptPath, "utf8").includes(operator.id)) {
        issues.push(
          error("skill_graph.operator.prompt_identity_missing", `${operator.promptPath} must declare stable id ${operator.id}.`, operator.promptPath),
        );
      }
    }
  }

  for (const provider of graph.providers) {
    checkKnown(issues, domainIds, provider.ownerDomainId, "skill_graph.provider.unknown_domain", provider.id);
    for (const secret of provider.requiredSecrets) {
      if (!/^[A-Z][A-Z0-9_]+$/.test(secret))
        issues.push(error("skill_graph.provider.secret_name_invalid", `${provider.id} has invalid secret name ${secret}.`));
    }
  }

  return issues;
}

function validateWorkflow(workflow: WorkflowDefinition, issues: GraphIssue[]): void {
  if (!workflow.trigger.trim()) issues.push(error("skill_graph.workflow.trigger_missing", `${workflow.id} has no trigger.`));
  if (workflow.action.length === 0 || workflow.action.some((step) => !step.trim()))
    issues.push(error("skill_graph.workflow.action_missing", `${workflow.id} has no complete action sequence.`));
  if (workflow.proof.length === 0) issues.push(error("skill_graph.workflow.proof_missing", `${workflow.id} has no proof contract.`));
  if (workflow.memory.length === 0) issues.push(error("skill_graph.workflow.memory_missing", `${workflow.id} has no durable memory destination.`));
  if (!workflow.stoppingCondition.trim()) issues.push(error("skill_graph.workflow.stop_missing", `${workflow.id} has no stopping condition.`));
  if (!/(exits? 0|PROJECT_STATE|records?|contains?|diff|grep|status|blocker|gate|artifact)/i.test(workflow.stoppingCondition)) {
    issues.push(error("skill_graph.workflow.stop_unobservable", `${workflow.id} stopping condition is not observably checkable.`));
  }
  if (workflow.contextPackIds.length === 0) issues.push(error("skill_graph.workflow.context_missing", `${workflow.id} has no context pack.`));
  if (workflow.operatorIds.length === 0) issues.push(error("skill_graph.workflow.operator_missing", `${workflow.id} has no eligible operator.`));
}

function checkKnown<T extends GraphId>(issues: GraphIssue[], known: Set<T>, value: T, code: string, owner: string): void {
  if (!known.has(value)) issues.push(error(code, `${owner} references unknown ${value}.`));
}

function uniqueBy<T>(items: readonly T[], key: (item: T) => string, code: string, issues: GraphIssue[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) issues.push(error(code, `Duplicate value ${value}.`));
    seen.add(value);
  }
}

function detectCycles<T extends GraphId>(nodes: Array<{ id: T; dependencies: readonly T[] }>, code: string, issues: GraphIssue[]): void {
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

function error(code: string, message: string, issuePath?: string): GraphIssue {
  return { severity: "error", code, message, path: issuePath };
}

function warning(code: string, message: string, issuePath?: string): GraphIssue {
  return { severity: "warning", code, message, path: issuePath };
}
