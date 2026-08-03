import type { DomainDefinition, PhaseDefinition, SkillGraph } from "./types.js";

export const graphGeneratedStart = (name: string): string => `<!-- graph-generated:start ${name} -->`;
export const graphGeneratedEnd = (name: string): string => `<!-- graph-generated:end ${name} -->`;

export function renderGeneratedFiles(graph: SkillGraph): Record<string, string> {
  return {
    "graph/generated/skill-graph.json": `${JSON.stringify(graph, null, 2)}\n`,
    "graph/generated/skill-graph.md": renderGraphMarkdown(graph),
    "graph/generated/skill-graph.mmd": renderMermaid(graph),
    "graph/generated/context-report.json": `${JSON.stringify(contextReport(graph), null, 2)}\n`,
  };
}

export function renderDomainRouting(domains: readonly DomainDefinition[]): string {
  const rows = domains
    .filter((domain) => domain.slug !== "machine")
    .sort((a, b) => a.order - b.order)
    .map((domain) => `| ${domain.routeLabel} | ${domain.routeWhen} | [\`${domain.indexPath}\`](${domain.indexPath}) |`)
    .join("\n");
  return [
    graphGeneratedStart("domain-routing"),
    "| Area of the business | Route here when | Load |",
    "| --- | --- | --- |",
    rows,
    graphGeneratedEnd("domain-routing"),
  ].join("\n");
}

export function renderPhaseSpine(phases: readonly PhaseDefinition[]): string {
  const rows = [...phases]
    .sort((a, b) => a.order - b.order)
    .filter((phase) => phase.key !== "phase_0a")
    .map((phase) => `| ${phase.label} | ${phase.focus} | ${phase.primaryOutput} |`)
    .join("\n");
  return [graphGeneratedStart("phase-spine"), "| Phase | Focus | Primary output |", "| --- | --- | --- |", rows, graphGeneratedEnd("phase-spine")].join("\n");
}

export function replaceGeneratedBlock(text: string, name: string, block: string): string {
  const start = graphGeneratedStart(name);
  const end = graphGeneratedEnd(name);
  const from = text.indexOf(start);
  const to = text.indexOf(end);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`Missing generated block markers for ${name}.`);
  }
  return `${text.slice(0, from)}${block}${text.slice(to + end.length)}`;
}

function contextReport(graph: SkillGraph): object {
  const referenceById = new Map(graph.references.map((reference) => [reference.id, reference]));
  const packs = graph.contextPacks.map((pack) => {
    const entryReferences = pack.entryReferenceIds.map((id) => referenceById.get(id)).filter(Boolean);
    const allReferences = pack.referenceIds.map((id) => referenceById.get(id)).filter(Boolean);
    return {
      id: pack.id,
      strategy: pack.strategy,
      initialReferenceCount: entryReferences.length,
      initialBytes: entryReferences.reduce((sum, reference) => sum + (reference?.bytes ?? 0), 0),
      availableReferenceCount: allReferences.length,
      availableBytes: allReferences.reduce((sum, reference) => sum + (reference?.bytes ?? 0), 0),
      selectionRule: pack.selectionRule,
      entryPaths: entryReferences.map((reference) => reference!.path),
    };
  });
  const sharedReferences = graph.references
    .map((reference) => ({
      path: reference.path,
      packIds: graph.contextPacks.filter((pack) => pack.referenceIds.includes(reference.id)).map((pack) => pack.id),
    }))
    .filter((item) => item.packIds.length > 1);
  return {
    schemaVersion: graph.schemaVersion,
    skillVersion: graph.skillVersion,
    counts: {
      areas: graph.areas.length,
      domains: graph.domains.length,
      workflows: graph.workflows.length,
      contextPacks: graph.contextPacks.length,
      references: graph.references.length,
      phases: graph.phases.length,
      lanes: graph.lanes.length,
      artifacts: graph.artifacts.length,
      gates: graph.gates.length,
      operators: graph.operators.length,
      providers: graph.providers.length,
    },
    packs,
    sharedReferences,
  };
}

function renderGraphMarkdown(graph: SkillGraph): string {
  const areaRows = graph.areas.map((area) => `| \`${area.id}\` | ${area.name} | ${area.domainIds.map((id) => `\`${id}\``).join(", ")} |`).join("\n");
  const workflowRows = graph.workflows
    .map(
      (workflow) =>
        `| ${workflow.legacyId ?? ""} | \`${workflow.id}\` | ${workflow.title} | \`${workflow.domainId}\` | ${workflow.gateCommands.map((gate) => `\`${gate}\``).join(", ") || "artifact proof"} |`,
    )
    .join("\n");
  return `# Typed Skill Graph\n\nGenerated from the TypeScript definition graph. Edit graph definitions, not this file.\n\n## Business areas\n\n| ID | Name | Domains |\n| --- | --- | --- |\n${areaRows}\n\n## Workflows\n\n| Legacy | Stable ID | Workflow | Domain | Proof gates |\n| --- | --- | --- | --- | --- |\n${workflowRows}\n`;
}

function renderMermaid(graph: SkillGraph): string {
  const lines = ["flowchart LR"];
  for (const area of graph.areas) {
    lines.push(`  ${mermaidId(area.id)}["${escapeMermaid(area.name)}"]`);
    for (const domainId of area.domainIds) lines.push(`  ${mermaidId(area.id)} --> ${mermaidId(domainId)}`);
  }
  for (const domain of graph.domains) lines.push(`  ${mermaidId(domain.id)}["${escapeMermaid(domain.name)}"]`);
  for (const workflow of graph.workflows) {
    lines.push(`  ${mermaidId(workflow.id)}["${escapeMermaid(`${workflow.legacyId ?? ""} ${workflow.title}`.trim())}"]`);
    lines.push(`  ${mermaidId(workflow.domainId)} --> ${mermaidId(workflow.id)}`);
    for (const laneId of workflow.laneIds) lines.push(`  ${mermaidId(workflow.id)} --> ${mermaidId(laneId)}`);
  }
  for (const lane of graph.lanes) {
    lines.push(`  ${mermaidId(lane.id)}["${escapeMermaid(lane.label)}"]`);
    for (const dependencyId of lane.dependencyIds) lines.push(`  ${mermaidId(dependencyId)} --> ${mermaidId(lane.id)}`);
  }
  return `${lines.join("\n")}\n`;
}

function mermaidId(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "_");
}

function escapeMermaid(value: string): string {
  return value.replace(/"/g, "'");
}
