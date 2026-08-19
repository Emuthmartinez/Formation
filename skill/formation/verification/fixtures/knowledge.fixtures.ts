import { assert, skillRoot, type Harness } from "./_harness.js";
import { resolveKnowledgeGraph } from "../../catalog/knowledge-packages.js";
import { validateKnowledgePackages } from "../../catalog/knowledge-validation.js";
import type { CatalogContextPack, CatalogDomain, CatalogKnowledgePackage, CatalogWorkflowDef } from "../../catalog/types.js";

const domain: CatalogDomain = {
  id: "domain.research",
  slug: "research",
  name: "Research",
  areaIds: ["area.product-experience"],
  routeLabel: "Research",
  routeWhen: "fixture",
  order: 1,
};
const workflow: CatalogWorkflowDef = {
  id: "workflow.research.fixture-a",
  title: "Fixture",
  domainId: "domain.research",
  areaIds: ["area.product-experience"],
  trigger: "fixture",
  instructions: "Produce a fixture output with enough detail to satisfy the catalog contract.",
  reads: [],
  consults: [],
  referenceIds: [],
  roleId: "role.fixture",
  laneIds: [],
  phaseIds: [],
  dependencies: [],
  outputPaths: [],
  gateCommands: [],
  providerIds: [],
  founderOnlyActions: [],
  actionClass: "draft",
  idempotent: true,
  applicability: { mode: "always" },
};
const contextPack: Omit<CatalogContextPack, "referenceIds"> = { id: "context.fixture", title: "Fixture" };

function knowledge(overrides: Partial<CatalogKnowledgePackage> = {}): CatalogKnowledgePackage {
  return {
    id: "reference.research.fixture",
    title: "Fixture",
    domainId: "domain.research",
    path: "package.json",
    loadWhen: "during fixture work",
    lifecycle: "active",
    applicabilityNotes: "Fixture applicability.",
    sourceExemption: "Internal fixture guidance.",
    sources: [],
    replacementIds: [],
    workflowIds: [workflow.id],
    contextPackIds: [],
    manifestPath: "catalog/knowledge/research/fixture.yaml",
    ...overrides,
  };
}

function codes(packages: CatalogKnowledgePackage[]): string[] {
  return validateKnowledgePackages(packages, skillRoot, [domain], [workflow], [contextPack], new Date("2026-08-17T00:00:00Z")).map((issue) => issue.code);
}

export function register(harness: Harness): void {
  harness.check("knowledge: a valid active package passes", () => assert(codes([knowledge()]).length === 0, "valid package produced issues"));
  harness.check("knowledge: duplicate IDs and document paths fail", () => {
    const result = codes([knowledge(), knowledge({ id: "reference.research.second" })]);
    assert(
      result.includes("knowledge.path.duplicate") && result.includes("knowledge.id.duplicate") === false,
      "expected path duplicate only with distinct ids",
    );
    assert(codes([knowledge(), knowledge()]).includes("knowledge.id.duplicate"), "expected duplicate id");
  });
  harness.check("knowledge: missing documents and invalid domains or bindings fail", () => {
    const result = codes([
      knowledge({ path: "knowledge/absent.md", domainId: "domain.absent", workflowIds: ["workflow.research.absent"], contextPackIds: ["context.absent"] }),
    ]);
    for (const code of ["knowledge.document.missing", "knowledge.domain.invalid", "knowledge.workflow.invalid", "knowledge.context.invalid"])
      assert(result.includes(code), `missing ${code}`);
  });
  harness.check("knowledge: an unbound active package fails, while a draft stays out of the resolved graph", () => {
    assert(codes([knowledge({ workflowIds: [] })]).includes("knowledge.active.unbound"), "expected unbound active error");
    const resolved = resolveKnowledgeGraph([knowledge({ lifecycle: "draft" })], [workflow], [contextPack]);
    assert(resolved.references.length === 0 && resolved.workflows[0]?.referenceIds.length === 0, "draft entered the active graph");
  });
  harness.check("knowledge: stale sources fail", () => {
    const result = codes([
      knowledge({
        sourceExemption: undefined,
        sources: [
          {
            id: "source.fixture",
            name: "Fixture",
            sourceType: "official_docs",
            url: "https://example.com",
            reviewCadenceDays: 7,
            claimScope: "Fixture",
            lastReviewDate: "2026-01-01",
            reviewer: "fixture",
          },
        ],
      }),
    ]);
    assert(result.includes("knowledge.source.stale"), "expected stale source error");
  });
  harness.check("knowledge: deprecated packages require valid replacements", () => {
    assert(
      codes([knowledge({ lifecycle: "deprecated", workflowIds: [] })]).includes("knowledge.deprecated.replacement_missing"),
      "expected missing replacement",
    );
    assert(
      codes([knowledge({ lifecycle: "deprecated", workflowIds: [], replacementIds: ["reference.research.absent"] })]).includes(
        "knowledge.deprecated.replacement_invalid",
      ),
      "expected invalid replacement",
    );
  });
  harness.check("knowledge: retired exempts a deprecated package from the replacement rule, and requires deprecation", () => {
    // A terminal deprecation (retired learning, withdrawn contract) has no successor to point at.
    assert(
      !codes([knowledge({ lifecycle: "deprecated", workflowIds: [], retired: true })]).includes("knowledge.deprecated.replacement_missing"),
      "retired: true must exempt the replacement requirement",
    );
    assert(codes([knowledge({ retired: true })]).includes("knowledge.retired.lifecycle_invalid"), "retired on a non-deprecated package must fail");
  });
  harness.check("knowledge: two active packages sharing a load_when trigger fail, and normalization defeats whitespace disguises", () => {
    const twin = knowledge({ id: "reference.research.twin", path: "package-lock.json" });
    assert(codes([knowledge(), twin]).includes("knowledge.load_when.duplicate"), "expected duplicate trigger error");
    const rewrapped = knowledge({ id: "reference.research.rewrapped", path: "package-lock.json", loadWhen: "  During   Fixture\nwork " });
    assert(codes([knowledge(), rewrapped]).includes("knowledge.load_when.duplicate"), "a re-wrapped trigger must still count as a duplicate");
    // A deprecated twin no longer competes for the trigger.
    assert(
      !codes([knowledge(), { ...twin, lifecycle: "deprecated" as const, workflowIds: [], replacementIds: [knowledge().id] }]).includes(
        "knowledge.load_when.duplicate",
      ),
      "deprecated packages must not trip the duplicate gate",
    );
    // Distinct triggers pass.
    assert(
      !codes([knowledge(), knowledge({ id: "reference.research.other", path: "package-lock.json", loadWhen: "during other fixture work" })]).includes(
        "knowledge.load_when.duplicate",
      ),
      "distinct triggers were flagged",
    );
  });
  harness.check("knowledge: a paragraph-length load_when fails the word cap while a scannable one passes", () => {
    const words = Array.from({ length: 46 }, (_unused, index) => `word${index}`).join(" ");
    assert(codes([knowledge({ loadWhen: words })]).includes("knowledge.load_when.over_length"), "expected over-length trigger error");
    assert(!codes([knowledge()]).includes("knowledge.load_when.over_length"), "a short trigger was flagged");
  });
}
