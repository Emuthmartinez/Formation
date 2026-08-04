from pathlib import Path
import re

root = Path("skill/b2c-mobile-business-launch")
workflow_dir = root / "graph/workflows"

for file in workflow_dir.glob("*.ts"):
    if file.name == "helpers.ts":
        continue
    text = file.read_text()
    text = re.sub(r'\n\s*legacyId: "L\d+",', "", text)
    text = text.replace("upstreamWorkflowIds:", "dependencies:")
    text = text.replace("artifacts:", "outputPaths:")
    file.write_text(text)

types = root / "graph/types.ts"
text = types.read_text()
text = re.sub(r'\n\s*legacyId\?: `L\$\{string\}`;', "", text)
for field in ("action: string[];", "proof: string[];", "memory: string[];", "stoppingCondition: string;"):
    text = text.replace("\n  " + field, "")
text = text.replace("upstreamWorkflowIds: WorkflowId[];", "dependencies: WorkflowId[];")
text = text.replace("artifactPaths: string[];", "outputPaths: string[];")
types.write_text(text)

helpers = root / "graph/workflows/helpers.ts"
helpers.write_text('''import type { AreaId, DomainId, LaneId, OperatorId, PhaseId, ProviderId, WorkflowDefinition, WorkflowId } from "../types.js";

export interface WorkflowSeed {
  id: WorkflowId;
  title: string;
  domainId: DomainId;
  areaIds: AreaId[];
  trigger: string;
  laneIds?: LaneId[];
  phaseIds?: PhaseId[];
  dependencies?: WorkflowId[];
  outputPaths?: string[];
  gates?: string[];
  providers?: ProviderId[];
  operators?: OperatorId[];
  founderOnlyActions?: string[];
}

export function workflow(seed: WorkflowSeed): WorkflowDefinition {
  return {
    id: seed.id,
    title: seed.title,
    domainId: seed.domainId,
    areaIds: seed.areaIds,
    trigger: seed.trigger,
    negativeTriggers: [],
    contextPackIds: [`context.${seed.domainId.slice("domain.".length)}`],
    referenceIds: [],
    phaseIds: seed.phaseIds ?? [],
    laneIds: seed.laneIds ?? [],
    dependencies: seed.dependencies ?? [],
    outputPaths: seed.outputPaths ?? [],
    gateCommands: seed.gates ?? [],
    providerIds: seed.providers ?? [],
    operatorIds: seed.operators ?? ["operator.orchestrator"],
    founderOnlyActions: seed.founderOnlyActions ?? [],
    sourcePath: "graph/workflows",
  };
}
''')

for relative in ("graph/execution.ts", "graph/graph.ts"):
    file = root / relative
    text = file.read_text()
    text = text.replace(".artifactPaths", ".outputPaths")
    text = text.replace(".upstreamWorkflowIds", ".dependencies")
    text = text.replace("legacyWorkflowEdges", "dependencyEdges")
    text = text.replace("inferredArtifactInputs", "artifactInputs")
    if relative.endswith("execution.ts"):
        text = text.replace("compatibility:", "catalog:")
    file.write_text(text)

render = root / "graph/render.ts"
text = render.read_text()
text = text.replace("workflow.upstreamWorkflowIds", "workflow.dependencies")
text = text.replace("workflow.artifactPaths", "workflow.outputPaths")
text = re.sub(
    r'`\| \$\{workflow\.legacyId \?\? ""\} \| `?\\?`\$\{workflow\.id\}\\?`? \| \$\{workflow\.title\} \| `?\\?`\$\{workflow\.domainId\}\\?`? \| \$\{workflow\.gateCommands\.map\(\(gate\) => `\\?`\$\{gate\}\\?``\)\.join\(", "\) \|\| "artifact proof"\} \|`',
    '`| \\`${workflow.id}\\` | ${workflow.title} | \\`${workflow.domainId}\\` | ${workflow.gateCommands.map((gate) => `\\`${gate}\\``).join(", ") || "output contract"} |`',
    text,
)
text = text.replace(
    "| Legacy | Stable ID | Workflow | Domain | Proof gates |\n| --- | --- | --- | --- | --- |",
    "| Stable ID | Workflow | Domain | Verification gates |\n| --- | --- | --- | --- |",
)
text = text.replace('`${workflow.legacyId ?? ""} ${workflow.title}`.trim()', "workflow.title")
render.write_text(text)

validate = root / "graph/validate.ts"
text = validate.read_text()
text = text.replace(
    "const artifactPaths = new Set(graph.artifacts.map((item) => item.path));",
    "const artifactsByPath = new Map(graph.artifacts.map((item) => [item.path, item.id]));",
)
text = re.sub(r'\n\s*uniqueBy\(graph\.workflows, \(item\) => item\.legacyId \?\? item\.id,.*?;', "", text)
text = text.replace("workflow.upstreamWorkflowIds", "workflow.dependencies")
text = text.replace("workflow.artifactPaths", "workflow.outputPaths")
text = text.replace("upstreamId", "dependencyId")
text = text.replace("unknown_upstream", "unknown_dependency")
text = text.replace("artifactPath", "outputPath")
text = text.replace("artifactPaths.has(outputPath)", "artifactsByPath.has(outputPath)")
text = text.replace("outputPaths.has(outputPath)", "artifactsByPath.has(outputPath)")
text = text.replace("unknown_artifact", "unknown_output")
text = re.sub(r'\n  for \(let number = 1; number <= 57; number \+= 1\) \{.*?\n  \}', "", text, flags=re.S)
text = re.sub(
    r'function validateWorkflow\(workflow: WorkflowDefinition, issues: GraphIssue\[\]\): void \{.*?\n\}',
    '''function validateWorkflow(workflow: WorkflowDefinition, issues: GraphIssue[]): void {
  if (!workflow.trigger.trim()) issues.push(error("skill_graph.workflow.trigger_missing", `${workflow.id} has no trigger.`));
  if (workflow.contextPackIds.length === 0) issues.push(error("skill_graph.workflow.context_missing", `${workflow.id} has no context pack.`));
  if (workflow.operatorIds.length === 0) issues.push(error("skill_graph.workflow.operator_missing", `${workflow.id} has no eligible operator.`));
  if (workflow.outputPaths.length === 0 && workflow.gateCommands.length === 0) issues.push(error("skill_graph.workflow.contract_empty", `${workflow.id} has neither outputs nor verification gates.`));
}''',
    text,
    flags=re.S,
)
validate.write_text(text)

fixtures = root / "machine/fixtures/graph.fixtures.ts"
text = fixtures.read_text()
text = re.sub(
    r'\n  const withoutProof = clone\(baseline\);.*?skill_graph\.workflow\.proof_missing"\);',
    '''
  const emptyContract = clone(baseline);
  emptyContract.workflows[0]!.outputPaths = [];
  emptyContract.workflows[0]!.gateCommands = [];
  expectIssue(harness, "typed graph rejects workflow without outputs or gates", emptyContract, "skill_graph.workflow.contract_empty");''',
    text,
    flags=re.S,
)
text = text.replace("upstreamWorkflowIds", "dependencies")
fixtures.write_text(text)

readme = root / "graph/README.md"
text = readme.read_text()
text = text.replace(
    "Paths are attributes. Stable graph IDs are identities. The compatibility compiler can bind current path-shaped workflow outputs while the catalogue migrates, but runtime edges and accepted versions use graph identities.",
    "Paths are attributes. Stable graph IDs are identities. Workflow dependencies and output contracts are native graph fields consumed directly by the compiler.",
)
text = text.replace(
    "The graph is the only normal dispatch source. Compatibility fields may be read while the 57 workflow contracts migrate, but they must not create a second scheduler.",
    "The graph is the only normal dispatch source. Workflow definitions, compiler output, run state, and evidence form one execution model without a compatibility scheduler.",
)
readme.write_text(text)
