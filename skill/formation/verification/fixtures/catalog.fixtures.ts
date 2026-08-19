import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assert, repoCheckoutPresent, repoRoot, skillRoot, type Harness } from "./_harness.js";
import { toCatalogInput } from "../../catalog/bridge.js";
import { composeCatalog } from "../../catalog/index.js";
import { renderGeneratedFiles } from "../../catalog/render-routing.js";
import type { Catalog, CatalogWorkflowDef } from "../../catalog/types.js";
import { validateCatalog } from "../../catalog/validate.js";
import { compilePlan } from "../../core/engine/compile.js";

// skillRoot is skill/formation; the ledger lives at repo-root docs/plans/attachments/.
const resolvedLedgerPath = path.join(repoRoot, "docs", "plans", "attachments", "2026-08-port-ledger.md");

function baseWorkflow(overrides: Partial<CatalogWorkflowDef> = {}): CatalogWorkflowDef {
  return {
    id: "workflow.research.fixture-a",
    title: "Fixture A",
    domainId: "domain.research",
    areaIds: ["area.product-experience"],
    trigger: "fixture trigger",
    instructions: "Produce the fixture output artifact and stop; this synthetic contract exists only to satisfy validation.",
    reads: [],
    consults: [],
    // Bound by default: every non-machine workflow must carry knowledge (workflow.no_knowledge),
    // so per-scenario defects stay singular. Scenarios testing the gate override this to [].
    referenceIds: ["reference.research.fixture"],
    roleId: "role.fixture",
    laneIds: [],
    phaseIds: [],
    dependencies: [],
    outputPaths: ["fixture/output.md"],
    gateCommands: [],
    providerIds: [],
    founderOnlyActions: [],
    actionClass: "draft",
    idempotent: true,
    applicability: { mode: "always" },
    ...overrides,
  };
}

/** Minimal but otherwise-valid fixture catalog, mutated per-scenario to introduce exactly one defect. */
function baseFixtureCatalog(): Catalog {
  return {
    schemaVersion: "2.0.0",
    skillVersion: "0.0.0-fixture",
    areas: [{ id: "area.product-experience", name: "Product And Experience", description: "fixture", domainIds: ["domain.research"] }],
    domains: [
      {
        id: "domain.research",
        slug: "research",
        name: "Market Research",
        areaIds: ["area.product-experience"],
        routeLabel: "Market research",
        routeWhen: "fixture",
        order: 10,
        // deliberately no indexPath: avoids a real filesystem existence check in this fixture catalog.
      },
    ],
    phases: [],
    lanes: [],
    roles: [
      {
        id: "role.fixture",
        name: "Fixture Role",
        promptPath: "agents/fixture.md",
        scope: "fixture",
        parentPromptPaths: ["AGENTS.md", "APP_AGENTS.md"],
        contextPackIds: ["context.founder-language"],
        skillRoutes: [{ id: "fixture-skill", when: "fixture" }],
        toolRoutes: [{ id: "fixture-tool", when: "fixture" }],
        capabilityIds: [],
        outputPathPrefixes: ["fixture/"],
      },
    ],
    contextPacks: [{ id: "context.founder-language", title: "Founder language", referenceIds: ["reference.research.fixture"] }],
    references: [
      {
        id: "reference.research.fixture",
        path: "package.json",
        domainId: "domain.research",
        title: "Fixture knowledge",
        loadWhen: "always",
        sessionScoped: true,
        lifecycle: "active",
        applicabilityNotes: "Fixture.",
        sourceExemption: "Fixture.",
        sources: [],
        replacementIds: [],
      },
    ],
    workflows: [baseWorkflow()],
    artifacts: [{ id: "artifact.fixture.output.md", path: "fixture/output.md", ownerDomainId: "domain.research", laneIds: [], generated: false }],
    gates: [],
    presentationGroups: [],
  };
}

export function register(harness: Harness): void {
  // ---------------------------------------------------------------------
  // catalog/validate.ts: structural gate
  // ---------------------------------------------------------------------

  harness.check("validate: a clean minimal fixture catalog has zero errors", () => {
    const catalog = baseFixtureCatalog();
    const issues = validateCatalog(catalog, skillRoot).filter((issue) => issue.severity === "error");
    assert(issues.length === 0, `expected no errors, got: ${issues.map((i) => `${i.code}: ${i.message}`).join("; ")}`);
  });

  harness.check("validate: a knowledge-less business workflow fails while a machine workflow stays exempt", () => {
    const catalog = baseFixtureCatalog();
    catalog.workflows = [baseWorkflow({ referenceIds: [] })];
    const issues = validateCatalog(catalog, skillRoot);
    assert(
      issues.some((issue) => issue.code === "catalog_graph.workflow.no_knowledge"),
      `expected catalog_graph.workflow.no_knowledge, got: ${issues.map((i) => i.code).join(", ")}`,
    );

    const exempt = baseFixtureCatalog();
    exempt.areas = [
      { id: "area.product-experience", name: "Product And Experience", description: "fixture", domainIds: ["domain.research", "domain.machine"] },
    ];
    exempt.domains = [
      ...exempt.domains,
      { id: "domain.machine", slug: "machine", name: "Machine", areaIds: ["area.product-experience"], routeLabel: "Machine", routeWhen: "fixture", order: 99 },
    ];
    exempt.workflows = [baseWorkflow({ id: "workflow.machine.fixture", domainId: "domain.machine", referenceIds: [] })];
    const exemptIssues = validateCatalog(exempt, skillRoot);
    assert(
      !exemptIssues.some((issue) => issue.code === "catalog_graph.workflow.no_knowledge"),
      "a machine-domain workflow must stay exempt from the knowledge requirement",
    );
  });

  harness.check("validate: workflow providers must be executable by the assigned role", () => {
    const catalog = baseFixtureCatalog();
    catalog.workflows = [baseWorkflow({ providerIds: ["provider.fixture"] })];
    // A fixture registry blesses provider.fixture so this case keeps exactly one defect (the
    // role capability), doubling as the clearing test for the injectable-registry rule.
    const issues = validateCatalog(catalog, skillRoot, { providerIds: ["provider.fixture"], deliberatelyUndeclared: [] });
    assert(
      issues.some((issue) => issue.code === "catalog_graph.workflow.role_capability_missing"),
      `expected catalog_graph.workflow.role_capability_missing, got: ${issues.map((i) => i.code).join(", ")}`,
    );
    assert(
      !issues.some((issue) => issue.code === "catalog_graph.workflow.provider_unknown"),
      "a registry-blessed provider id must not trip catalog_graph.workflow.provider_unknown",
    );
  });

  harness.check("validate: workflow providers must exist in the provider registry or its documented exceptions", () => {
    const failing = baseFixtureCatalog();
    // The role declares the capability so the only defect is the missing registry entry.
    failing.roles = failing.roles.map((role) => ({ ...role, capabilityIds: ["provider.not-registered"] }));
    failing.workflows = [baseWorkflow({ providerIds: ["provider.not-registered"] })];
    const failingIssues = validateCatalog(failing, skillRoot);
    assert(
      failingIssues.some((issue) => issue.code === "catalog_graph.workflow.provider_unknown"),
      `expected catalog_graph.workflow.provider_unknown, got: ${failingIssues.map((i) => i.code).join(", ")}`,
    );

    const cleared = validateCatalog(failing, skillRoot, { providerIds: ["provider.not-registered"], deliberatelyUndeclared: [] });
    assert(
      !cleared.some((issue) => issue.code === "catalog_graph.workflow.provider_unknown"),
      "registering the provider id must clear catalog_graph.workflow.provider_unknown",
    );
  });

  harness.check("validate: a deliberately-undeclared provider id no workflow references is flagged stale", () => {
    const catalog = baseFixtureCatalog();
    catalog.roles = catalog.roles.map((role) => ({ ...role, capabilityIds: ["provider.known"] }));
    catalog.workflows = [baseWorkflow({ providerIds: ["provider.known"] })];
    const registry = { providerIds: ["provider.known"], deliberatelyUndeclared: ["provider.ghost"] };
    const issues = validateCatalog(catalog, skillRoot, registry);
    assert(
      issues.some((issue) => issue.code === "catalog_graph.provider.exception_stale"),
      `expected catalog_graph.provider.exception_stale, got: ${issues.map((i) => i.code).join(", ")}`,
    );

    // Referencing the exception id clears the staleness flag.
    const cleared = baseFixtureCatalog();
    cleared.roles = cleared.roles.map((role) => ({ ...role, capabilityIds: ["provider.known", "provider.ghost"] }));
    cleared.workflows = [
      baseWorkflow({ providerIds: ["provider.known"] }),
      baseWorkflow({ id: "workflow.research.fixture-ghost", title: "Fixture ghost", providerIds: ["provider.ghost"], outputPaths: [] }),
    ];
    const clearedIssues = validateCatalog(cleared, skillRoot, registry);
    assert(
      !clearedIssues.some((issue) => issue.code === "catalog_graph.provider.exception_stale"),
      "an exception id a workflow references must not be flagged stale",
    );

    // Scope guard: a catalog referencing no registry provider is never judged against the
    // exception list (minimal fixture catalogs stay one-defect-per-case).
    const unscoped = baseFixtureCatalog();
    const unscopedIssues = validateCatalog(unscoped, skillRoot, { providerIds: ["provider.known"], deliberatelyUndeclared: ["provider.ghost"] });
    assert(
      !unscopedIssues.some((issue) => issue.code === "catalog_graph.provider.exception_stale"),
      "the staleness rule must stay silent for a catalog that references no registry provider",
    );
  });

  harness.check("validate: workflow outputs must stay inside the assigned role's write scope", () => {
    const catalog = baseFixtureCatalog();
    catalog.artifacts = [{ id: "artifact.fixture.outside.md", path: "outside.md", ownerDomainId: "domain.research", laneIds: [], generated: false }];
    catalog.workflows = [baseWorkflow({ outputPaths: ["outside.md"] })];
    const issues = validateCatalog(catalog, skillRoot);
    assert(
      issues.some((issue) => issue.code === "catalog_graph.workflow.role_output_out_of_scope"),
      `expected catalog_graph.workflow.role_output_out_of_scope, got: ${issues.map((i) => i.code).join(", ")}`,
    );
  });

  harness.check("validate: every dispatched role must inherit always-on founder-language knowledge", () => {
    const catalog = baseFixtureCatalog();
    catalog.roles[0]!.contextPackIds = [];
    const issues = validateCatalog(catalog, skillRoot);
    assert(
      issues.some((issue) => issue.code === "catalog_graph.role.founder_language_missing"),
      `expected catalog_graph.role.founder_language_missing, got: ${issues.map((i) => i.code).join(", ")}`,
    );
  });

  harness.check("validate: a dangling reference id is caught with a named issue code", () => {
    const catalog = baseFixtureCatalog();
    catalog.workflows = [baseWorkflow({ dependencies: ["workflow.research.does-not-exist"] })];
    const issues = validateCatalog(catalog, skillRoot);
    assert(
      issues.some((issue) => issue.code === "catalog_graph.workflow.unknown_dependency"),
      `expected catalog_graph.workflow.unknown_dependency, got: ${issues.map((i) => i.code).join(", ")}`,
    );
  });

  harness.check("validate: a dangling domain reference on an area is caught with a named issue code", () => {
    const catalog = baseFixtureCatalog();
    catalog.areas = [{ id: "area.product-experience", name: "Product And Experience", description: "fixture", domainIds: ["domain.does-not-exist"] }];
    const issues = validateCatalog(catalog, skillRoot);
    assert(
      issues.some((issue) => issue.code === "catalog_graph.area.unknown_domain"),
      `expected catalog_graph.area.unknown_domain, got: ${issues.map((i) => i.code).join(", ")}`,
    );
  });

  harness.check("validate: a workflow dependency cycle is caught with a named issue code", () => {
    const catalog = baseFixtureCatalog();
    catalog.artifacts = [
      { id: "artifact.fixture.a", path: "fixture/a.md", ownerDomainId: "domain.research", laneIds: [], generated: false },
      { id: "artifact.fixture.b", path: "fixture/b.md", ownerDomainId: "domain.research", laneIds: [], generated: false },
    ];
    catalog.workflows = [
      baseWorkflow({ id: "workflow.research.fixture-a", outputPaths: ["fixture/a.md"], dependencies: ["workflow.research.fixture-b"] }),
      baseWorkflow({ id: "workflow.research.fixture-b", outputPaths: ["fixture/b.md"], dependencies: ["workflow.research.fixture-a"] }),
    ];
    const issues = validateCatalog(catalog, skillRoot);
    assert(
      !issues.some((issue) => issue.code === "catalog_graph.workflow.ambiguous_write"),
      "this scenario should isolate the cycle defect, not also trip an unrelated ambiguous-write issue",
    );
    assert(
      issues.some((issue) => issue.code === "catalog_graph.workflow.cycle"),
      `expected catalog_graph.workflow.cycle, got: ${issues.map((i) => i.code).join(", ")}`,
    );
  });

  harness.check("validate: an always workflow cannot depend ambiguously on conditional work", () => {
    const catalog = baseFixtureCatalog();
    const conditional = baseWorkflow({
      id: "workflow.research.conditional",
      outputPaths: [],
      applicability: { mode: "conditional", question: "Is this work required?" },
    });
    const dependent = baseWorkflow({ id: "workflow.research.dependent", dependencies: [conditional.id], outputPaths: [] });
    catalog.workflows = [conditional, dependent];
    catalog.artifacts = [];
    const issues = validateCatalog(catalog, skillRoot);
    assert(
      issues.some((issue) => issue.code === "catalog_graph.workflow.conditional_dependency_ambiguous"),
      "expected conditional dependency error",
    );
  });

  harness.check("validate: two workflows declaring the same output is caught with a named issue code", () => {
    const catalog = baseFixtureCatalog();
    catalog.artifacts = [{ id: "artifact.fixture", path: "fixture.md", ownerDomainId: "domain.research", laneIds: [], generated: false }];
    catalog.workflows = [
      baseWorkflow({ id: "workflow.research.fixture-a", outputPaths: ["fixture.md"] }),
      baseWorkflow({ id: "workflow.research.fixture-b", outputPaths: ["fixture.md"] }),
    ];
    const issues = validateCatalog(catalog, skillRoot);
    assert(
      issues.some((issue) => issue.code === "catalog_graph.workflow.ambiguous_write"),
      `expected catalog_graph.workflow.ambiguous_write, got: ${issues.map((i) => i.code).join(", ")}`,
    );
  });

  harness.check("validate: a reference with no load-when text is caught with a named issue code", () => {
    const catalog = baseFixtureCatalog();
    catalog.references = [{ ...catalog.references[0]!, title: "Fixture", loadWhen: "   " }];
    const issues = validateCatalog(catalog, skillRoot);
    assert(
      issues.some((issue) => issue.code === "catalog_graph.reference.load_when_missing"),
      `expected catalog_graph.reference.load_when_missing, got: ${issues.map((i) => i.code).join(", ")}`,
    );
  });

  harness.check("validate: a reference pointing at a missing file is caught with a named issue code", () => {
    const catalog = baseFixtureCatalog();
    catalog.references = [{ ...catalog.references[0]!, path: "knowledge/research/does-not-exist.md", title: "Fixture", loadWhen: "fixture" }];
    const issues = validateCatalog(catalog, skillRoot);
    assert(
      issues.some((issue) => issue.code === "catalog_graph.reference.path_missing"),
      `expected catalog_graph.reference.path_missing, got: ${issues.map((i) => i.code).join(", ")}`,
    );
  });

  // ---------------------------------------------------------------------
  // catalog/validate.ts: the 2026-08 node-contract rules — every new gate is
  // exercised failing at least once here, never trusted green-by-vacuity.
  // ---------------------------------------------------------------------

  harness.check("validate: instructions under the 40-char floor are caught with a named issue code", () => {
    const catalog = baseFixtureCatalog();
    catalog.workflows = [baseWorkflow({ instructions: "too short" })];
    const issues = validateCatalog(catalog, skillRoot);
    assert(
      issues.some((issue) => issue.code === "catalog_graph.workflow.instructions_missing"),
      `expected catalog_graph.workflow.instructions_missing, got: ${issues.map((i) => i.code).join(", ")}`,
    );
  });

  harness.check("validate: instructions that merely echo the trigger are caught with the same issue code", () => {
    const catalog = baseFixtureCatalog();
    catalog.workflows = [
      baseWorkflow({
        trigger: "a trigger sentence comfortably over the length floor for this scenario",
        instructions: "A trigger sentence comfortably over the length floor for this scenario",
      }),
    ];
    const issues = validateCatalog(catalog, skillRoot);
    assert(
      issues.some((issue) => issue.code === "catalog_graph.workflow.instructions_missing"),
      `expected catalog_graph.workflow.instructions_missing for a trigger echo, got: ${issues.map((i) => i.code).join(", ")}`,
    );
  });

  harness.check("validate: an unregistered roleId is caught with a named issue code", () => {
    const catalog = baseFixtureCatalog();
    catalog.workflows = [baseWorkflow({ roleId: "role.does-not-exist" })];
    const issues = validateCatalog(catalog, skillRoot);
    assert(
      issues.some((issue) => issue.code === "catalog_graph.workflow.role_unknown"),
      `expected catalog_graph.workflow.role_unknown, got: ${issues.map((i) => i.code).join(", ")}`,
    );
  });

  harness.check("validate: a workflow binding an unregistered reference is caught with a named issue code", () => {
    const catalog = baseFixtureCatalog();
    catalog.workflows = [baseWorkflow({ referenceIds: ["reference.research.does-not-exist"] })];
    const issues = validateCatalog(catalog, skillRoot);
    assert(
      issues.some((issue) => issue.code === "catalog_graph.workflow.reference_unknown"),
      `expected catalog_graph.workflow.reference_unknown, got: ${issues.map((i) => i.code).join(", ")}`,
    );
  });

  harness.check("validate: a reference no workflow or context pack binds is caught, and sessionScoped clears it", () => {
    const catalog = baseFixtureCatalog();
    catalog.references.push({
      ...catalog.references[0]!,
      id: "reference.research.orphan",
      path: "README.md",
      title: "Orphan",
      loadWhen: "fixture",
      sessionScoped: false,
    });
    const unbound = validateCatalog(catalog, skillRoot);
    assert(
      unbound.some((issue) => issue.code === "catalog_graph.reference.unbound"),
      `expected catalog_graph.reference.unbound, got: ${unbound.map((i) => i.code).join(", ")}`,
    );
    catalog.references = catalog.references.map((reference) =>
      reference.id === "reference.research.orphan" ? { ...reference, sessionScoped: true } : reference,
    );
    const scoped = validateCatalog(catalog, skillRoot);
    assert(!scoped.some((issue) => issue.code === "catalog_graph.reference.unbound"), "sessionScoped: true should clear reference.unbound");
  });

  harness.check("validate: a read that nothing produces and the template does not ship is caught; an artifact-path read passes", () => {
    const catalog = baseFixtureCatalog();
    catalog.workflows = [baseWorkflow({ reads: ["nowhere/does-not-exist.md"] })];
    const bad = validateCatalog(catalog, skillRoot);
    assert(
      bad.some((issue) => issue.code === "catalog_graph.workflow.read_unresolvable"),
      `expected catalog_graph.workflow.read_unresolvable, got: ${bad.map((i) => i.code).join(", ")}`,
    );
    catalog.workflows = [baseWorkflow({ reads: ["fixture/output.md"] })];
    const good = validateCatalog(catalog, skillRoot);
    assert(!good.some((issue) => issue.code === "catalog_graph.workflow.read_unresolvable"), "a declared artifact path must resolve as a read");
  });

  harness.check("validate: a spend workflow without costEstimate is surfaced as a WARNING — the fail-closed park is the designed control, not a defect", () => {
    const catalog = baseFixtureCatalog();
    catalog.workflows = [baseWorkflow({ actionClass: "spend", protectedCategory: "spend", founderOnlyActions: ["approve spend"] })];
    const issues = validateCatalog(catalog, skillRoot);
    const found = issues.find((issue) => issue.code === "catalog_graph.workflow.cost_estimate_missing");
    assert(Boolean(found), `expected catalog_graph.workflow.cost_estimate_missing, got: ${issues.map((i) => i.code).join(", ")}`);
    assert(found!.severity === "warning", `cost_estimate_missing must be a warning (the park is the control), got severity ${found!.severity}`);
  });

  harness.check(
    "validate: a protected-class workflow without protectedCategory is caught — gates verify after the fact, the category authorizes before dispatch",
    () => {
      const catalog = baseFixtureCatalog();
      catalog.workflows = [baseWorkflow({ actionClass: "release", gateCommands: ["check:catalog"], founderOnlyActions: ["approve the release"] })];
      const naked = validateCatalog(catalog, skillRoot);
      assert(
        naked.some((issue) => issue.code === "catalog_graph.workflow.protected_category_missing"),
        `expected catalog_graph.workflow.protected_category_missing even with a gate and founder-only action present, got: ${naked.map((i) => i.code).join(", ")}`,
      );
      catalog.workflows = [baseWorkflow({ actionClass: "release", protectedCategory: "release" })];
      const categorized = validateCatalog(catalog, skillRoot);
      assert(
        !categorized.some((issue) => issue.code === "catalog_graph.workflow.protected_category_missing"),
        "naming the protected category clears the issue",
      );
    },
  );

  harness.check("validate: a knowledge file on disk with no CatalogReference is caught (disk-to-catalog sweep), and registering it clears the issue", () => {
    const tempSkillRoot = harness.makeTempDir("validate-knowledge-sweep");
    const knowledgeDir = path.join(tempSkillRoot, "knowledge", "research");
    mkdirSync(knowledgeDir, { recursive: true });
    writeFileSync(path.join(knowledgeDir, "registered.md"), "# registered\n", "utf8");
    writeFileSync(path.join(knowledgeDir, "orphan.md"), "# orphan\n", "utf8");
    const catalog = baseFixtureCatalog();
    catalog.references = [
      {
        ...catalog.references[0]!,
        id: "reference.research.registered",
        path: "knowledge/research/registered.md",
        domainId: "domain.research",
        title: "Registered",
        loadWhen: "fixture",
        sessionScoped: true,
      },
    ];
    const swept = validateCatalog(catalog, tempSkillRoot);
    assert(
      swept.some((issue) => issue.code === "catalog_graph.reference.file_unregistered" && issue.path === "knowledge/research/orphan.md"),
      `expected catalog_graph.reference.file_unregistered for orphan.md, got: ${swept.map((i) => i.code).join(", ")}`,
    );
    catalog.references = [
      ...catalog.references,
      {
        ...catalog.references[0]!,
        id: "reference.research.orphan",
        path: "knowledge/research/orphan.md",
        domainId: "domain.research",
        title: "Orphan",
        loadWhen: "fixture",
        sessionScoped: true,
      },
    ];
    const registered = validateCatalog(catalog, tempSkillRoot);
    assert(!registered.some((issue) => issue.code === "catalog_graph.reference.file_unregistered"), "registering the file clears the sweep issue");
  });

  harness.check("validate: the real catalog composed from disk has zero structural errors", () => {
    const catalog = composeCatalog(skillRoot);
    const issues = validateCatalog(catalog, skillRoot).filter((issue) => issue.severity === "error");
    assert(issues.length === 0, `expected the real catalog to be clean, got: ${issues.map((i) => `${i.code}: ${i.message}`).join("; ")}`);
    assert(catalog.domains.length === 15, `expected 15 domains, got ${catalog.domains.length}`);
    assert(catalog.workflows.length === 93, `expected 93 workflows, got ${catalog.workflows.length}`);
    assert(catalog.references.length === 108, `expected 108 references, got ${catalog.references.length}`);

    const landingBuild = catalog.workflows.find((wf) => wf.id === "workflow.growth.pre-launch-funnel-landing-waitlist");
    const landingPublish = catalog.workflows.find((wf) => wf.id === "workflow.growth.landing-funnel-publication-and-live-proof");
    const appBuild = catalog.workflows.find((wf) => wf.id === "workflow.engineering.engineering-orchestration-ce-production-readiness");
    assert(Boolean(landingBuild && landingPublish && appBuild), "expected local landing, landing publish, and app build workflows");
    assert(
      landingBuild!.dependencies.includes("workflow.design.design-room-state-mutate-version-render") &&
        appBuild!.dependencies.includes("workflow.design.design-room-state-mutate-version-render"),
      "local landing and app implementation must share the design-lock dependency",
    );
    assert(landingBuild!.actionClass !== "publish", "the local landing build must not be blocked by public-action approval");
    assert(landingPublish!.actionClass === "publish", "the live landing deployment must remain a protected public action");
    assert(
      landingPublish!.dependencies.includes("workflow.growth.pre-launch-funnel-landing-waitlist"),
      "the public landing workflow must depend on the local build",
    );
  });

  // ---------------------------------------------------------------------
  // catalog/bridge.ts: toCatalogInput() -> compile.ts compatibility
  // ---------------------------------------------------------------------

  harness.check("bridge: toCatalogInput() executes process/orchestration knowledge, excludes machine maintenance, and compiles", () => {
    const catalog = composeCatalog(skillRoot);
    const input = toCatalogInput(catalog);
    assert(input.workflows.length < catalog.workflows.length, "the bridged input should exclude maintenance-only machine workflows");
    const excludedCount = catalog.workflows.length - input.workflows.length;
    assert(excludedCount === 10, `expected exactly 10 excluded machine-domain workflows, got ${excludedCount}`);
    assert(
      input.workflows.some((workflow) => workflow.id === "workflow.process.change-cascade") &&
        input.workflows.some((workflow) => workflow.id === "workflow.orchestration.session-continuity-resume"),
      "process and orchestration knowledge must survive into the executable graph",
    );

    // Must not throw: proves no dangling dependency survived the domain filter and no
    // artifact-path collision survived either.
    const plan = compilePlan(input, "2026-08-05T00:00:00.000Z");
    assert(plan.nodes.length === input.workflows.length, "compiled plan should have one node per bridged workflow");
  });

  harness.check("bridge: a business workflow retains its executable process dependency", () => {
    const catalog = composeCatalog(skillRoot);
    const designRoom = catalog.workflows.find((wf) => wf.id === "workflow.design.design-room-state-mutate-version-render");
    assert(Boolean(designRoom), "expected workflow.design.design-room-state-mutate-version-render to exist in the full catalog");
    assert(
      designRoom!.dependencies.includes("workflow.process.launch-trace-and-build-contracts"),
      "expected the full catalog to still carry the process-domain dependency edge (this is what validate.ts checks referential integrity against)",
    );
    const input = toCatalogInput(catalog);
    const bridged = input.workflows.find((wf) => wf.id === "workflow.design.design-room-state-mutate-version-render")!;
    assert(
      bridged.dependencies.includes("workflow.process.launch-trace-and-build-contracts"),
      "the bridged node must retain the process dependency that supplies its launch trace and build contract",
    );
  });

  harness.check("dispatch registry: every prepared specialist is graph-addressable, used, and the readiness node gates both app and landing work", () => {
    const catalog = composeCatalog(skillRoot);
    const promptDir = path.join(skillRoot, "workspace", "business", "engineering", "app-agent-roster", "agents");
    const promptNames = readdirSync(promptDir)
      .filter((name) => name.endsWith(".md"))
      .map((name) => name.replace(/\.md$/, ""))
      .sort();
    const roleNames = catalog.roles.map((role) => path.basename(role.promptPath, ".md")).sort();
    assert(
      JSON.stringify(promptNames) === JSON.stringify(roleNames),
      `prepared prompts and catalog roles must match exactly: prompts=${promptNames.join(",")} roles=${roleNames.join(",")}`,
    );
    const unusedRoles = catalog.roles.filter((role) => !catalog.workflows.some((workflow) => workflow.roleId === role.id));
    assert(unusedRoles.length === 0, `every prepared specialist must own at least one workflow: ${unusedRoles.map((role) => role.id).join(",")}`);
    const readiness = catalog.workflows.find((workflow) => workflow.id === "workflow.operations.agent-operations-ledger")!;
    const app = catalog.workflows.find((workflow) => workflow.id === "workflow.engineering.engineering-orchestration-ce-production-readiness")!;
    const landing = catalog.workflows.find((workflow) => workflow.id === "workflow.growth.pre-launch-funnel-landing-waitlist")!;
    assert(readiness.roleId === "role.operator-readiness", "capability preflight must route to the prepared operator-readiness prompt");
    assert(
      app.dependencies.includes(readiness.id) && landing.dependencies.includes(readiness.id),
      "app and landing work must both wait for the one-pass capability preflight",
    );
    assert(
      app.dependencies.includes("workflow.design.design-room-state-mutate-version-render") &&
        landing.dependencies.includes("workflow.design.design-room-state-mutate-version-render"),
      "app and landing work must share the accepted design dependency so they can fan out together",
    );
  });

  harness.check("dispatch registry: prompts use the v2 state model, canonical artifact paths, and complete launch-surface nesting", () => {
    const catalog = composeCatalog(skillRoot);
    const promptRoot = path.join(skillRoot, "workspace", "business", "engineering", "app-agent-roster");
    const promptText = [
      path.join(promptRoot, "APP_AGENTS.md"),
      ...readdirSync(path.join(promptRoot, "agents")).map((name) => path.join(promptRoot, "agents", name)),
    ]
      .map((filePath) => readFileSync(filePath, "utf8"))
      .join("\n");
    for (const stale of [
      "state/PROJECT_STATE.yaml",
      "`APP_STORE_LISTING.md`",
      "`SCREENSHOTS.md`",
      "`CONTENT_ASSETS.md`",
      "`SECRETS.md`",
      "`11_STAR_EXPERIENCE.md`",
    ]) {
      assert(!promptText.includes(stale), `prepared prompts must not reference stale or noncanonical path ${stale}`);
    }
    assert(promptText.includes("state/business-state.json"), "prepared prompts must use the canonical v2 state document");
    assert(promptText.includes(".b2c-launch/BUSINESS_CONTEXT.md"), "prepared prompts must preserve and load business-specific context");
    const producer = catalog.roles.find((role) => role.id === "role.launch-surface-producer")!;
    assert(producer.contextPackIds.includes("context.process"), "launch-surface work must load the executable change-process doctrine");
    for (const skillId of ["ios-screenshots", "pricing", "paywalls", "analytics", "video", "remotion", "usefastlane-ai"]) {
      assert(
        producer.skillRoutes.some((route) => route.id === skillId),
        `launch-surface producer must route nested skill ${skillId}`,
      );
    }
    for (const role of catalog.roles) {
      assert(role.contextPackIds.includes("context.founder-language"), `${role.id} must carry always-on founder-language knowledge`);
    }
  });

  // ---------------------------------------------------------------------
  // catalog/render-routing.ts: --check drift gate
  // ---------------------------------------------------------------------

  harness.check("render: --check is green against the freshly rendered real catalog", () => {
    harness.runScript("render-routing --check (clean)", "catalog/render-routing.ts", ["--check"], 0);
  });

  harness.check("render: contracts.md carries a real node contract and the provider route matrix", () => {
    const rendered = renderGeneratedFiles(composeCatalog(skillRoot))["catalog/generated/contracts.md"]!;
    assert(rendered.includes("# Node Contracts"), "contracts.md is missing its Node Contracts section");
    assert(
      rendered.includes("`provider.higgsfield` (mcp)"),
      "contracts.md should annotate provider.higgsfield with its declared mcp route on the nodes that touch it",
    );
    assert(
      /\| `provider\.higgsfield` \| ai-generated-marketing-visuals \| ✓ \|/.test(rendered),
      "the provider route matrix should mark provider.higgsfield's mcp column",
    );
    assert(rendered.includes("`provider.serve-sim` (local tooling"), "deliberately-undeclared ids should render as local tooling, not silently as unknown");
  });

  harness.check("render: --check fails on a mutated generated file — exercised against a scratch skill root, never the checked-in repo file", () => {
    // The old version of this check mutated the real, checked-in catalog/generated/routing.md
    // in place, restoring it in a `finally` — not SIGKILL-safe (a hard kill mid-test would leave
    // the repo's own generated file corrupted). Operate on a scratch copy instead.
    const tempSkillRoot = harness.makeTempDir("render-routing-check-drift");
    // render-routing.ts's composeCatalog() only reads skill-version.json and package.json (for
    // gate discovery) off `--skill-root`; every other catalog input (areas/domains/phases/lanes/
    // references/workflows) is statically imported TS data, independent of the filesystem — so a
    // two-file scratch root is enough for it to run standalone.
    writeFileSync(path.join(tempSkillRoot, "package.json"), JSON.stringify({ scripts: {} }), "utf8");
    writeFileSync(path.join(tempSkillRoot, "skill-version.json"), JSON.stringify({ version: "0.0.0-fixture" }), "utf8");

    // Write mode first: populates catalog/generated/{routing.md,spine.md,catalog.json} under the
    // scratch root with genuinely fresh, self-consistent content, so the "clean" baseline this
    // test then mutates was never hand-constructed or copied from the real repo.
    harness.runScript("render-routing (write, scratch root)", "catalog/render-routing.ts", ["--skill-root", tempSkillRoot], 0);

    const target = path.join(tempSkillRoot, "catalog", "generated", "routing.md");
    const original = readFileSync(target, "utf8");
    writeFileSync(target, `${original}\n<!-- fixture-mutation -->\n`, "utf8");
    // No try/finally restore needed: this is a scratch directory the harness deletes wholesale in
    // cleanup() — even a hard kill mid-test leaves the real checked-in file untouched.
    harness.runScript(
      "render-routing --check (mutated, scratch root)",
      "catalog/render-routing.ts",
      ["--skill-root", tempSkillRoot, "--check"],
      1,
      "catalog_render.generated_drift",
    );
  });

  // ---------------------------------------------------------------------
  // Port ledger: completeness (every v1 file exactly once, no TBD rows)
  // ---------------------------------------------------------------------

  // The ledger is a repository artifact under docs/, and an installed runtime ships no docs/ —
  // so from the runtime these four assert something that is not merely failing but absent.
  // Routed through the harness's skip so `npm run sync:runtime`, which runs this whole audit
  // inside the installed copy, stops reporting red for a reason no install could ever fix.
  // Dispatching on the case function rather than listing the labels twice keeps the skip list
  // from drifting away from the cases it is supposed to cover.
  const ledgerCase: (label: string, fn: () => void) => void = repoCheckoutPresent()
    ? harness.check
    : (label) => harness.skip(label, `repo-only: no port ledger at ${resolvedLedgerPath} (an installed runtime ships no docs/)`);

  ledgerCase("port ledger: file exists and has no TBD rows", () => {
    const text = readFileSync(resolvedLedgerPath, "utf8");
    const tbdRowPattern = /^\|\s*(?:knowledge|validation)\/[^\s|]+\s*\|\s*TBD\s*\|/m;
    assert(!tbdRowPattern.test(text), "port ledger must not contain a row whose disposition column is TBD");
  });

  ledgerCase("port ledger: every surviving knowledge/**/*.{md,yaml,yml} file (excluding evals/fixtures dirs) appears exactly once", () => {
    const text = readFileSync(resolvedLedgerPath, "utf8");
    // U11 cutover executed every "drop" disposition, so those ledger rows now describe files
    // that no longer exist by design — the ledger is the historical record of the deletion,
    // not a live description of current file state. The completeness check is therefore scoped
    // to non-drop rows only; a "drop" row surviving on disk (or vice versa) is caught by the
    // ledger-drop execution itself, not this fixture.
    const ledgerRows = new Set(
      [...parseLedgerRowsWithDisposition(text)].filter((row) => row.path.startsWith("knowledge/") && row.disposition !== "drop").map((row) => row.path),
    );
    const onDisk = walkKnowledgeFiles(path.join(skillRoot, "knowledge"));
    // knowledge/README.md is the generated orientation stub render-routing.ts writes and
    // drift-checks — not ported content, so it never earns a ledger row (same class as the
    // generated projections under catalog/generated/).
    onDisk.delete("knowledge/README.md");
    assertOneToOne(onDisk, ledgerRows, "knowledge file");
  });

  ledgerCase(
    "port ledger: every surviving check:*/validate:* script (both package.json manifests) targeting validation/business or validation/repository appears exactly once, plus the one documented addition",
    () => {
      const text = readFileSync(resolvedLedgerPath, "utf8");
      // validation/repository/check-skill-graph.ts is ledgered "port" (its referential-integrity +
      // drift-check PATTERN is preserved), but its "port" target is a wholesale mechanism
      // replacement in different files (catalog/validate.ts + catalog/render-routing.ts --check,
      // shipped in an earlier unit) rather than an in-place rewrite — and the original file's own
      // imports point at runtime/graph/*.ts, which U11 deletes. The cutover task explicitly names
      // it for deletion alongside the rest of the runtime/graph cull, so — unlike every other
      // "port" row, which stays at its path — this one is excluded here too.
      const portedAwayFromOriginalPath = new Set(["validation/repository/check-skill-graph.ts"]);
      const ledgerRows = new Set(
        [...parseLedgerRowsWithDisposition(text)]
          .filter((row) => row.path.startsWith("validation/") && row.disposition !== "drop" && !portedAwayFromOriginalPath.has(row.path))
          .map((row) => row.path),
      );
      const skillScripts = discoverValidatorScriptPaths(path.join(skillRoot, "package.json"));
      const rootScripts = discoverValidatorScriptPaths(path.join(repoRoot, "package.json")).map((p) => stripRepoPrefix(p));
      const validators = new Set<string>([...skillScripts, ...rootScripts]);
      // The one documented addition beyond the two literal buckets (see the ledger's own
      // "Scope and methodology" section).
      validators.add("validation/repository/README.md");
      assertOneToOne(validators, ledgerRows, "validator/addition");
    },
  );

  ledgerCase("port ledger: disposition counts match the summary table's grand total", () => {
    const text = readFileSync(resolvedLedgerPath, "utf8");
    const rows = parseLedgerRowsWithDisposition(text);
    const counts = { keep: 0, port: 0, merge: 0, drop: 0 };
    for (const row of rows) counts[row.disposition] += 1;
    const summaryMatch = text.match(/\*\*Total\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*/);
    assert(Boolean(summaryMatch), "expected a **Total** row in the summary table");
    const [, keep, port, merge, drop, total] = summaryMatch!.map(Number);
    assert(counts.keep === keep, `keep count mismatch: table rows=${counts.keep}, summary=${keep}`);
    assert(counts.port === port, `port count mismatch: table rows=${counts.port}, summary=${port}`);
    assert(counts.merge === merge, `merge count mismatch: table rows=${counts.merge}, summary=${merge}`);
    assert(counts.drop === drop, `drop count mismatch: table rows=${counts.drop}, summary=${drop}`);
    assert(rows.length === total, `total row count mismatch: parsed=${rows.length}, summary=${total}`);
  });
}

// --- Port ledger parsing helpers --------------------------------------------------------

const ledgerRowPattern = /^\|\s*((?:knowledge|validation)\/[^\s|]+)\s*\|\s*(keep|port|merge|drop)\s*\|/;

function parseLedgerRowsWithDisposition(text: string): Array<{ path: string; disposition: "keep" | "port" | "merge" | "drop" }> {
  const rows: Array<{ path: string; disposition: "keep" | "port" | "merge" | "drop" }> = [];
  for (const line of text.split("\n")) {
    const match = line.match(ledgerRowPattern);
    if (match) rows.push({ path: match[1]!, disposition: match[2] as "keep" | "port" | "merge" | "drop" });
  }
  return rows;
}

/** Both arguments must already be filtered to the same namespace (e.g. only "knowledge/" or only "validation/" paths). */
function assertOneToOne(onDisk: Set<string> | readonly string[], ledgerRows: Set<string>, label: string): void {
  const diskSet = onDisk instanceof Set ? onDisk : new Set(onDisk);
  const missingFromLedger = [...diskSet].filter((p) => !ledgerRows.has(p));
  const staleInLedger = [...ledgerRows].filter((p) => !diskSet.has(p));
  assert(missingFromLedger.length === 0, `${label}(s) on disk but missing from the ledger: ${missingFromLedger.join(", ")}`);
  assert(staleInLedger.length === 0, `${label}(s) in the ledger but not found by the completeness glob: ${staleInLedger.join(", ")}`);
}

const ignoredKnowledgeDirs = new Set(["evals", "fixtures", "node_modules", "dist"]);
const knowledgeExtensions = new Set([".md", ".yaml", ".yml"]);

function walkKnowledgeFiles(root: string): Set<string> {
  const results = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (ignoredKnowledgeDirs.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (entry.isFile() && knowledgeExtensions.has(path.extname(entry.name))) {
        const relative = path.relative(skillRoot, path.join(dir, entry.name)).split(path.sep).join("/");
        results.add(relative);
      }
    }
  };
  walk(root);
  return results;
}

function discoverValidatorScriptPaths(packageJsonPath: string): string[] {
  const stat = statSync(packageJsonPath, { throwIfNoEntry: false });
  if (!stat) return [];
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { scripts?: Record<string, string> };
  const scripts = pkg.scripts ?? {};
  const paths: string[] = [];
  for (const [name, script] of Object.entries(scripts)) {
    if (!(name.startsWith("check:") || name.startsWith("validate:"))) continue;
    const match = script.match(/((?:[\w./-]*\/)?(?:validation\/(?:business|repository)\/[^\s]+\.ts))/);
    if (match) paths.push(match[1]!);
  }
  return paths;
}

/** The repo-root package.json prefixes every script path with skill/formation/. */
function stripRepoPrefix(scriptPath: string): string {
  const prefix = "skill/formation/";
  return scriptPath.startsWith(prefix) ? scriptPath.slice(prefix.length) : scriptPath;
}
