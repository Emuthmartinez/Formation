import { composeSkillGraph } from "../../../runtime/graph/graph.js";
import type { GraphIssue, SkillGraph } from "../../../runtime/graph/types.js";
import { validateSkillGraph } from "../../../runtime/graph/validate.js";
import { type Harness, skillRoot } from "./_harness.js";

export function register(harness: Harness): void {
  const baseline = composeSkillGraph(skillRoot);
  expectNoErrors(harness, "typed graph passes on shipped definitions", validateSkillGraph(baseline, skillRoot));

  const emptyContract = clone(baseline);
  emptyContract.workflows[0]!.outputPaths = [];
  emptyContract.workflows[0]!.gateCommands = [];
  expectIssue(harness, "typed graph rejects workflow without outputs or gates", emptyContract, "skill_graph.workflow.contract_empty");

  const duplicateId = clone(baseline);
  duplicateId.domains[1]!.id = duplicateId.domains[0]!.id;
  expectIssue(harness, "typed graph rejects duplicate ids", duplicateId, "skill_graph.id.duplicate");

  const laneCycle = clone(baseline);
  laneCycle.lanes[0]!.dependencyIds = [laneCycle.lanes[1]!.id];
  laneCycle.lanes[1]!.dependencyIds = [laneCycle.lanes[0]!.id];
  expectIssue(harness, "typed graph rejects lane cycles", laneCycle, "skill_graph.lane.cycle");

  const unknownLane = clone(baseline);
  unknownLane.workflows[0]!.laneIds = ["lane.missing"];
  expectIssue(harness, "typed graph rejects unknown workflow lanes", unknownLane, "skill_graph.workflow.unknown_lane");

  const unknownGate = clone(baseline);
  unknownGate.workflows[0]!.gateCommands = ["check:missing"];
  expectIssue(harness, "typed graph rejects unregistered workflow gates", unknownGate, "skill_graph.workflow.unknown_gate");

  const workflowCycle = clone(baseline);
  workflowCycle.workflows[0]!.dependencies = [workflowCycle.workflows[1]!.id];
  workflowCycle.workflows[1]!.dependencies = [workflowCycle.workflows[0]!.id];
  expectIssue(harness, "typed graph rejects workflow cycles", workflowCycle, "skill_graph.workflow.cycle");

  const progressiveWithoutEntry = clone(baseline);
  const progressive = progressiveWithoutEntry.contextPacks.find((pack) => pack.strategy === "progressive")!;
  progressive.entryReferenceIds = [];
  expectIssue(harness, "typed graph rejects progressive context without entry", progressiveWithoutEntry, "skill_graph.context.progressive_entry_missing");

  const selectOneWithoutChoices = clone(baseline);
  const selectOne = selectOneWithoutChoices.contextPacks.find((pack) => pack.strategy === "select-one")!;
  selectOne.referenceIds = selectOne.referenceIds.slice(0, 1);
  expectIssue(harness, "typed graph rejects select-one context without choices", selectOneWithoutChoices, "skill_graph.context.select_one_ambiguous");
}

function clone(graph: SkillGraph): SkillGraph {
  return structuredClone(graph);
}

function expectIssue(harness: Harness, label: string, graph: SkillGraph, code: string): void {
  const issues = validateSkillGraph(graph, skillRoot);
  const ok = issues.some((issue) => issue.code === code);
  harness.results.push({
    label,
    ok,
    expectedCode: 1,
    actualCode: ok ? 1 : 0,
    expectedText: code,
    output: issues.map(formatIssue).join("\n"),
  });
}

function expectNoErrors(harness: Harness, label: string, issues: GraphIssue[]): void {
  const errors = issues.filter((issue) => issue.severity === "error");
  harness.results.push({
    label,
    ok: errors.length === 0,
    expectedCode: 0,
    actualCode: errors.length === 0 ? 0 : 1,
    output: issues.map(formatIssue).join("\n"),
  });
}

function formatIssue(issue: GraphIssue): string {
  return `${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`;
}
