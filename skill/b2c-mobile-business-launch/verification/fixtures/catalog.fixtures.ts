import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assert, repoCheckoutPresent, repoRoot, skillRoot, type Harness } from "./_harness.js";
import { toCatalogInput } from "../../catalog/bridge.js";
import { composeCatalog } from "../../catalog/index.js";
import type { Catalog, CatalogWorkflowDef } from "../../catalog/types.js";
import { validateCatalog } from "../../catalog/validate.js";
import { compilePlan } from "../../core/engine/compile.js";

// skillRoot is skill/b2c-mobile-business-launch; the ledger lives at repo-root docs/plans/attachments/.
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
    referenceIds: [],
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
    roles: [{ id: "role.fixture", name: "Fixture Role", promptPath: "agents/fixture.md", scope: "fixture" }],
    references: [],
    workflows: [baseWorkflow()],
    artifacts: [{ id: "artifact.fixture.output.md", path: "fixture/output.md", ownerDomainId: "domain.research", laneIds: [], generated: false }],
    gates: [],
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
    catalog.references = [{ id: "reference.research.fixture", path: "package.json", domainId: "domain.research", title: "Fixture", loadWhen: "   " }];
    const issues = validateCatalog(catalog, skillRoot);
    assert(
      issues.some((issue) => issue.code === "catalog_graph.reference.load_when_missing"),
      `expected catalog_graph.reference.load_when_missing, got: ${issues.map((i) => i.code).join(", ")}`,
    );
  });

  harness.check("validate: a reference pointing at a missing file is caught with a named issue code", () => {
    const catalog = baseFixtureCatalog();
    catalog.references = [
      { id: "reference.research.fixture", path: "knowledge/research/does-not-exist.md", domainId: "domain.research", title: "Fixture", loadWhen: "fixture" },
    ];
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

  harness.check("validate: a reference no workflow binds is caught, and sessionScoped clears it", () => {
    const catalog = baseFixtureCatalog();
    catalog.references = [{ id: "reference.research.fixture", path: "package.json", domainId: "domain.research", title: "Fixture", loadWhen: "fixture" }];
    const unbound = validateCatalog(catalog, skillRoot);
    assert(
      unbound.some((issue) => issue.code === "catalog_graph.reference.unbound"),
      `expected catalog_graph.reference.unbound, got: ${unbound.map((i) => i.code).join(", ")}`,
    );
    catalog.references = [
      { id: "reference.research.fixture", path: "package.json", domainId: "domain.research", title: "Fixture", loadWhen: "fixture", sessionScoped: true },
    ];
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

  harness.check("validate: a protected-class workflow without protectedCategory is caught — gates verify after the fact, the category authorizes before dispatch", () => {
    const catalog = baseFixtureCatalog();
    catalog.workflows = [baseWorkflow({ actionClass: "release", gateCommands: ["check:catalog"], founderOnlyActions: ["approve the release"] })];
    const naked = validateCatalog(catalog, skillRoot);
    assert(
      naked.some((issue) => issue.code === "catalog_graph.workflow.protected_category_missing"),
      `expected catalog_graph.workflow.protected_category_missing even with a gate and founder-only action present, got: ${naked.map((i) => i.code).join(", ")}`,
    );
    catalog.workflows = [baseWorkflow({ actionClass: "release", protectedCategory: "release" })];
    const categorized = validateCatalog(catalog, skillRoot);
    assert(!categorized.some((issue) => issue.code === "catalog_graph.workflow.protected_category_missing"), "naming the protected category clears the issue");
  });

  harness.check("validate: a knowledge file on disk with no CatalogReference is caught (disk-to-catalog sweep), and registering it clears the issue", () => {
    const tempSkillRoot = harness.makeTempDir("validate-knowledge-sweep");
    const knowledgeDir = path.join(tempSkillRoot, "knowledge", "research");
    mkdirSync(knowledgeDir, { recursive: true });
    writeFileSync(path.join(knowledgeDir, "registered.md"), "# registered\n", "utf8");
    writeFileSync(path.join(knowledgeDir, "orphan.md"), "# orphan\n", "utf8");
    const catalog = baseFixtureCatalog();
    catalog.references = [
      { id: "reference.research.registered", path: "knowledge/research/registered.md", domainId: "domain.research", title: "Registered", loadWhen: "fixture", sessionScoped: true },
    ];
    const swept = validateCatalog(catalog, tempSkillRoot);
    assert(
      swept.some((issue) => issue.code === "catalog_graph.reference.file_unregistered" && issue.path === "knowledge/research/orphan.md"),
      `expected catalog_graph.reference.file_unregistered for orphan.md, got: ${swept.map((i) => i.code).join(", ")}`,
    );
    catalog.references = [
      ...catalog.references,
      { id: "reference.research.orphan", path: "knowledge/research/orphan.md", domainId: "domain.research", title: "Orphan", loadWhen: "fixture", sessionScoped: true },
    ];
    const registered = validateCatalog(catalog, tempSkillRoot);
    assert(!registered.some((issue) => issue.code === "catalog_graph.reference.file_unregistered"), "registering the file clears the sweep issue");
  });

  harness.check("validate: the real catalog composed from disk has zero structural errors", () => {
    const catalog = composeCatalog(skillRoot);
    const issues = validateCatalog(catalog, skillRoot).filter((issue) => issue.severity === "error");
    assert(issues.length === 0, `expected the real catalog to be clean, got: ${issues.map((i) => `${i.code}: ${i.message}`).join("; ")}`);
    assert(catalog.domains.length === 15, `expected 15 domains, got ${catalog.domains.length}`);
    assert(catalog.workflows.length === 58, `expected 58 workflows, got ${catalog.workflows.length}`);
  });

  // ---------------------------------------------------------------------
  // catalog/bridge.ts: toCatalogInput() -> compile.ts compatibility
  // ---------------------------------------------------------------------

  harness.check("bridge: toCatalogInput() excludes system/machine domains and compilePlan() accepts the result", () => {
    const catalog = composeCatalog(skillRoot);
    const input = toCatalogInput(catalog);
    // CatalogWorkflowNode.domainId is typed GrantableDomainId (compile.ts) — a
    // domain.process/orchestration/machine workflow literally cannot type-check its way
    // into `input.workflows`, so the exclusion is a compile-time guarantee, not just a
    // runtime filter. What's left to prove at runtime: the bridge actually narrowed the
    // set (it's a strict subset), and what remains still compiles cleanly.
    assert(input.workflows.length < catalog.workflows.length, "the bridged input should be a strict subset of the full 58-workflow catalog");
    const excludedCount = catalog.workflows.length - input.workflows.length;
    assert(excludedCount === 15, `expected exactly 15 excluded system/machine-domain workflows (7 process/orchestration + 8 machine), got ${excludedCount}`);

    // Must not throw: proves no dangling dependency survived the domain filter and no
    // artifact-path collision survived either.
    const plan = compilePlan(input, "2026-08-05T00:00:00.000Z");
    assert(plan.nodes.length === input.workflows.length, "compiled plan should have one node per bridged workflow");
  });

  harness.check("bridge: a grantable workflow's dependency on an excluded system-domain workflow is stripped, not left dangling", () => {
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
      !bridged.dependencies.includes("workflow.process.launch-trace-and-build-contracts" as never),
      "the bridged node must not carry a dependency on an excluded system-domain workflow",
    );
  });

  // ---------------------------------------------------------------------
  // catalog/render-routing.ts: --check drift gate
  // ---------------------------------------------------------------------

  harness.check("render: --check is green against the freshly rendered real catalog", () => {
    harness.runScript("render-routing --check (clean)", "catalog/render-routing.ts", ["--check"], 0);
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
    harness.runScript("render-routing --check (mutated, scratch root)", "catalog/render-routing.ts", ["--skill-root", tempSkillRoot, "--check"], 1, "catalog_render.generated_drift");
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
    assertOneToOne(onDisk, ledgerRows, "knowledge file");
  });

  ledgerCase("port ledger: every surviving check:*/validate:* script (both package.json manifests) targeting validation/business or validation/repository appears exactly once, plus the one documented addition", () => {
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
  });

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

/** The repo-root package.json prefixes every script path with skill/b2c-mobile-business-launch/. */
function stripRepoPrefix(scriptPath: string): string {
  const prefix = "skill/b2c-mobile-business-launch/";
  return scriptPath.startsWith(prefix) ? scriptPath.slice(prefix.length) : scriptPath;
}
