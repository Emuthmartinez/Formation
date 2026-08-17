import { assert, skillRoot, type Harness } from "./_harness.js";
import { resolveKnowledgeGraph } from "../../catalog/knowledge-packages.js";
import { validateKnowledgePackages } from "../../catalog/knowledge-validation.js";
import type { CatalogContextPack, CatalogDomain, CatalogKnowledgePackage, CatalogWorkflowDef } from "../../catalog/types.js";

const domain: CatalogDomain = {
  id: "domain.research", slug: "research", name: "Research", areaIds: ["area.product-experience"], routeLabel: "Research", routeWhen: "fixture", order: 1,
};
const workflow: CatalogWorkflowDef = {
  id: "workflow.research.fixture-a", title: "Fixture", domainId: "domain.research", areaIds: ["area.product-experience"], trigger: "fixture",
  instructions: "Produce a fixture output with enough detail to satisfy the catalog contract.", reads: [], consults: [], referenceIds: [], roleId: "role.fixture",
  laneIds: [], phaseIds: [], dependencies: [], outputPaths: [], gateCommands: [], providerIds: [], founderOnlyActions: [], actionClass: "draft", idempotent: true,
  applicability: { mode: "always" },
};
const contextPack: Omit<CatalogContextPack, "referenceIds"> = { id: "context.fixture", title: "Fixture" };

function knowledge(overrides: Partial<CatalogKnowledgePackage> = {}): CatalogKnowledgePackage {
  return {
    id: "reference.research.fixture", title: "Fixture", domainId: "domain.research", path: "package.json", loadWhen: "during fixture work",
    lifecycle: "active", applicabilityNotes: "Fixture applicability.", sourceExemption: "Internal fixture guidance.", sources: [], replacementIds: [],
    workflowIds: [workflow.id], contextPackIds: [], manifestPath: "catalog/knowledge/research/fixture.yaml", ...overrides,
  };
}

function codes(packages: CatalogKnowledgePackage[]): string[] {
  return validateKnowledgePackages(packages, skillRoot, [domain], [workflow], [contextPack], new Date("2026-08-17T00:00:00Z")).map((issue) => issue.code);
}

export function register(harness: Harness): void {
  harness.check("knowledge: a valid active package passes", () => assert(codes([knowledge()]).length === 0, "valid package produced issues"));
  harness.check("knowledge: duplicate IDs and document paths fail", () => {
    const result = codes([knowledge(), knowledge({ id: "reference.research.second" })]);
    assert(result.includes("knowledge.path.duplicate") && result.includes("knowledge.id.duplicate") === false, "expected path duplicate only with distinct ids");
    assert(codes([knowledge(), knowledge()]).includes("knowledge.id.duplicate"), "expected duplicate id");
  });
  harness.check("knowledge: missing documents and invalid domains or bindings fail", () => {
    const result = codes([knowledge({ path: "knowledge/absent.md", domainId: "domain.absent", workflowIds: ["workflow.research.absent"], contextPackIds: ["context.absent"] })]);
    for (const code of ["knowledge.document.missing", "knowledge.domain.invalid", "knowledge.workflow.invalid", "knowledge.context.invalid"]) assert(result.includes(code), `missing ${code}`);
  });
  harness.check("knowledge: an unbound active package fails, while a draft stays out of the resolved graph", () => {
    assert(codes([knowledge({ workflowIds: [] })]).includes("knowledge.active.unbound"), "expected unbound active error");
    const resolved = resolveKnowledgeGraph([knowledge({ lifecycle: "draft" })], [workflow], [contextPack]);
    assert(resolved.references.length === 0 && resolved.workflows[0]?.referenceIds.length === 0, "draft entered the active graph");
  });
  harness.check("knowledge: stale sources fail", () => {
    const result = codes([knowledge({ sourceExemption: undefined, sources: [{ id: "source.fixture", name: "Fixture", sourceType: "official_docs", url: "https://example.com", reviewCadenceDays: 7, claimScope: "Fixture", lastReviewDate: "2026-01-01", reviewer: "fixture" }] })]);
    assert(result.includes("knowledge.source.stale"), "expected stale source error");
  });
  harness.check("knowledge: deprecated packages require valid replacements", () => {
    assert(codes([knowledge({ lifecycle: "deprecated", workflowIds: [] })]).includes("knowledge.deprecated.replacement_missing"), "expected missing replacement");
    assert(codes([knowledge({ lifecycle: "deprecated", workflowIds: [], replacementIds: ["reference.research.absent"] })]).includes("knowledge.deprecated.replacement_invalid"), "expected invalid replacement");
  });
}
