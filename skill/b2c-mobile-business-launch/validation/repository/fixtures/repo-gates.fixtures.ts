import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Harness, skillRoot } from "./_harness.js";
import { artifactPageEntries } from "../../../tooling/lib/artifact-pages.js";
import { auditExcludedScripts, buildAuditPlan, type AuditLayout } from "../../../tooling/lib/audit-plan.js";

/**
 * Fixtures for the repo/skill-level gates that previously had zero fixture
 * coverage: the live audit pipeline only ever exercised their PASS path, so
 * nothing proved they could fail. Each gate gets at least one failing input
 * here so a regression that makes it always-pass is caught by test:validators.
 */

/** Scripts object that satisfies checkAuditPlanCoverage for a layout: every plan step resolves, no extra gate scripts. */
function planScripts(layout: AuditLayout): Record<string, string> {
  const scripts: Record<string, string> = {};
  for (const step of buildAuditPlan(layout)) {
    if (step.kind === "tsc") {
      continue;
    }
    scripts[step.id] = step.id === "audit" ? "tsx tooling/run-audit.ts" : `tsx tooling/${step.id.replace(/:/g, "-")}.ts`;
  }
  for (const name of Object.keys(auditExcludedScripts)) {
    scripts[name] = `tsx tooling/${name.replace(/:/g, "-")}.ts`;
  }
  return scripts;
}

function lockFor(name: string, version: string): string {
  return JSON.stringify({ name, version, lockfileVersion: 3, packages: { "": { name, version } } }, null, 2);
}

/** Write a minimal synthetic repo-root + skill-root pair that check-package-parity accepts. */
function writeParityPair(root: string, options: { rootVersion: string; skillVersion: string }): { repoRoot: string; parityScriptRoot: string } {
  const repoRoot = path.join(root, "repo");
  const parityScriptRoot = path.join(repoRoot, "skill", "pkg");
  mkdirSync(parityScriptRoot, { recursive: true });

  const rootScripts = {
    ...planScripts("repo"),
    audit: "tsx skill/pkg/tooling/run-audit.ts",
    "audit:ci": "tsx skill/pkg/tooling/run-audit.ts --ci",
  };
  const runtimeScripts = {
    ...planScripts("skill"),
    audit: "tsx tooling/run-audit.ts",
  };

  writeFileSync(
    path.join(repoRoot, "package.json"),
    JSON.stringify({ name: "parity-root", version: options.rootVersion, scripts: rootScripts, devDependencies: {} }, null, 2),
    "utf8",
  );
  writeFileSync(path.join(repoRoot, "package-lock.json"), lockFor("parity-root", options.rootVersion), "utf8");
  writeFileSync(
    path.join(parityScriptRoot, "package.json"),
    JSON.stringify({ name: "parity-runtime", version: options.skillVersion, scripts: runtimeScripts, devDependencies: {} }, null, 2),
    "utf8",
  );
  writeFileSync(path.join(parityScriptRoot, "package-lock.json"), lockFor("parity-runtime", options.skillVersion), "utf8");
  writeFileSync(path.join(parityScriptRoot, "skill-version.json"), JSON.stringify({ version: options.skillVersion }, null, 2), "utf8");
  return { repoRoot, parityScriptRoot };
}

export function register(h: Harness): void {
  const { makeEmptyFixture, runFixture, runScriptArgs } = h;

  // --- check-autopilot-contract ---
  runScriptArgs("autopilot contract passes on the shipped skill", "check-autopilot-contract.ts", ["--skill-root", skillRoot], 0);
  const autopilotEmpty = makeEmptyFixture("autopilot-empty-skill-root");
  runScriptArgs(
    "autopilot contract fails when SKILL.md is missing",
    "check-autopilot-contract.ts",
    ["--skill-root", autopilotEmpty],
    1,
    "autopilot.skill_missing",
  );

  // --- check-gates-layout ---
  //
  // The shipped tree must pass, and each of the three rules must be provably
  // able to fail. A flat validation/business/ made duplicate basenames structurally
  // impossible; the mirrored layout does not, so that rule in particular is
  // the one carrying a guarantee the previous layout gave for free.
  runScriptArgs("gates layout passes on the shipped skill", "check-gates-layout.ts", ["--skill-root", skillRoot], 0);

  /** Minimal skill root: playbook domains define the permitted gate folders. */
  const layoutRoot = (name: string, build: (root: string) => void): string => {
    const root = makeEmptyFixture(name);
    for (const domain of ["money", "process"]) {
      mkdirSync(path.join(root, "knowledge", domain), { recursive: true });
    }
    mkdirSync(path.join(root, "validation", "business", "money"), { recursive: true });
    writeFileSync(path.join(root, "validation", "business", "money", "check-revenue.ts"), "// stub\n", "utf8");
    build(root);
    return root;
  };

  const layoutClean = layoutRoot("gates-layout-clean", () => {});
  runScriptArgs("gates layout passes when every gate nests in a real domain", "check-gates-layout.ts", ["--skill-root", layoutClean], 0);

  const layoutUngrouped = layoutRoot("gates-layout-ungrouped", (root) => {
    writeFileSync(path.join(root, "validation", "business", "check-stray.ts"), "// stub\n", "utf8");
  });
  runScriptArgs(
    "gates layout fails on a gate left at the validation/business/ root",
    "check-gates-layout.ts",
    ["--skill-root", layoutUngrouped],
    1,
    "gates_layout.ungrouped_gate",
  );

  const layoutUnknownDomain = layoutRoot("gates-layout-unknown-domain", (root) => {
    mkdirSync(path.join(root, "validation", "business", "finance"), { recursive: true });
    writeFileSync(path.join(root, "validation", "business", "finance", "check-invoices.ts"), "// stub\n", "utf8");
  });
  runScriptArgs(
    "gates layout fails on a folder that is not a playbook domain",
    "check-gates-layout.ts",
    ["--skill-root", layoutUnknownDomain],
    1,
    "gates_layout.unknown_domain",
  );

  const layoutDuplicate = layoutRoot("gates-layout-duplicate-basename", (root) => {
    mkdirSync(path.join(root, "validation", "business", "process"), { recursive: true });
    // Same basename as validation/business/money/check-revenue.ts — impossible under a flat
    // validation/business/, permitted by the filesystem once the domains are folders.
    writeFileSync(path.join(root, "validation", "business", "process", "check-revenue.ts"), "// stub\n", "utf8");
  });
  runScriptArgs(
    "gates layout fails when two domains hold the same basename",
    "check-gates-layout.ts",
    ["--skill-root", layoutDuplicate],
    1,
    "gates_layout.duplicate_basename",
  );

  // The runtime-routing protocol was routed out of SKILL.md in v0.58.0 behind a
  // "before proposing or running a workflow" trigger — which never fires on the
  // one runtime that cannot run workflows. audit:ci stayed green through it.
  // Prose cannot stop the next compaction re-making that cut, so the trigger is
  // pinned as required_terms and proven failable here.
  const autopilotStripped = makeEmptyFixture("autopilot-runtime-routing-stripped");
  mkdirSync(path.join(autopilotStripped, "validation", "repository", "evals", "triggering"), { recursive: true });
  cpSync(
    path.join(skillRoot, "validation", "repository", "evals", "triggering", "autopilot-triggering.yaml"),
    path.join(autopilotStripped, "validation", "repository", "evals", "triggering", "autopilot-triggering.yaml"),
  );
  writeFileSync(
    path.join(autopilotStripped, "SKILL.md"),
    readFileSync(path.join(skillRoot, "SKILL.md"), "utf8").replace("non-Claude-Code runtime", "some other runtime"),
    "utf8",
  );
  runScriptArgs(
    "autopilot contract fails when SKILL.md drops the non-Claude runtime-routing trigger",
    "check-autopilot-contract.ts",
    ["--skill-root", autopilotStripped],
    1,
    "autopilot.body.required_term_missing",
  );

  // --- check-generated-pages ---
  //
  // Four founder-facing pages had drifted from the documents they were written
  // from while the audit stayed green, so every rule here has to be provably
  // able to fail. All three assertions matter: page-is-declared alone misses a
  // deleted page, declared-page-exists alone misses stale content, and the
  // byte-match alone misses a new hand-authored page nobody declared.
  runScriptArgs(
    "generated pages pass on the shipped business documents",
    "check-generated-pages.ts",
    ["--root", path.join(skillRoot, "workspace", "business")],
    0,
  );

  /**
   * A business root holding only what this gate reads: every declared page plus
   * every Markdown source. Copying the whole of business/ would work and would
   * cost ~300 files per fixture for no extra coverage.
   */
  const pagesRoot = (name: string, build: (root: string) => void): string => {
    const root = makeEmptyFixture(name);
    for (const [html, entry] of artifactPageEntries()) {
      cpSync(path.join(skillRoot, "workspace", "business", html), path.join(root, html));
      if (entry.kind === "authored-from") {
        cpSync(path.join(skillRoot, "workspace", "business", entry.markdown), path.join(root, entry.markdown));
      }
    }
    build(root);
    return root;
  };

  runScriptArgs(
    "generated pages fail when the business directory is absent",
    "check-generated-pages.ts",
    ["--root", path.join(skillRoot, "workspace", "business", "no-such-directory")],
    1,
    "generated_pages.business_root_missing",
  );

  const pagesClean = pagesRoot("generated-pages-clean", () => {});
  runScriptArgs("generated pages pass on a root holding exactly the declared set", "check-generated-pages.ts", ["--root", pagesClean], 0);

  const pagesUndeclared = pagesRoot("generated-pages-undeclared", (root) => {
    writeFileSync(path.join(root, "revenue-board.html"), "<!doctype html><html><body>hand written</body></html>", "utf8");
  });
  runScriptArgs(
    "generated pages fail on a page added with no declared source",
    "check-generated-pages.ts",
    ["--root", pagesUndeclared],
    1,
    "generated_pages.undeclared_page",
  );

  const pagesDeleted = pagesRoot("generated-pages-deleted", (root) => {
    rmSync(path.join(root, "store/store-console.html"));
  });
  runScriptArgs(
    "generated pages fail when a declared page is deleted",
    "check-generated-pages.ts",
    ["--root", pagesDeleted],
    1,
    "generated_pages.missing_page",
  );

  const pagesSourceGone = pagesRoot("generated-pages-source-missing", (root) => {
    rmSync(path.join(root, "trust/SECURITY.md"));
  });
  runScriptArgs(
    "generated pages fail when the document a page is written from is deleted",
    "check-generated-pages.ts",
    ["--root", pagesSourceGone],
    1,
    "generated_pages.source_missing",
  );

  // The drift case is the one the four broken pages would have been caught by:
  // the file exists, is declared, and no longer says what its source says.
  const pagesDrift = pagesRoot("generated-pages-drift", (root) => {
    const page = path.join(root, "product/onboarding.html");
    writeFileSync(page, readFileSync(page, "utf8").replace("Push permission prime", "Push permission (removed by hand)"), "utf8");
  });
  runScriptArgs(
    "generated pages fail when a page is edited away from its source",
    "check-generated-pages.ts",
    ["--root", pagesDrift],
    1,
    "generated_pages.drift",
  );

  // markdown-lite rejects constructs outside its subset instead of rendering
  // them as something else. A silent downgrade to a paragraph is exactly how a
  // section turns to mush behind a green gate.
  const pagesUnsupported = pagesRoot("generated-pages-unsupported-markdown", (root) => {
    const source = path.join(root, "operations/ORCHESTRATION.md");
    writeFileSync(source, `${readFileSync(source, "utf8")}\n#### Too deep for this renderer\n`, "utf8");
  });
  runScriptArgs(
    "generated pages fail on Markdown outside the subset rather than mangling it",
    "check-generated-pages.ts",
    ["--root", pagesUnsupported],
    1,
    "generated_pages.unsupported_markdown",
  );

  // --- check-package-parity ---
  const parityClean = makeEmptyFixture("package-parity-clean");
  const cleanPair = writeParityPair(parityClean, { rootVersion: "0.0.1", skillVersion: "0.0.1" });
  runScriptArgs(
    "package parity passes on a version-aligned synthetic pair",
    "check-package-parity.ts",
    ["--repo-root", cleanPair.repoRoot, "--skill-root", cleanPair.parityScriptRoot],
    0,
  );

  const parityDrift = makeEmptyFixture("package-parity-version-drift");
  const driftPair = writeParityPair(parityDrift, { rootVersion: "0.0.1", skillVersion: "0.0.2" });
  runScriptArgs(
    "package parity fails when versions drift from skill-version.json",
    "check-package-parity.ts",
    ["--repo-root", driftPair.repoRoot, "--skill-root", driftPair.parityScriptRoot],
    1,
    "must match skill-version.json",
  );

  // A wired validator absent from run-launchbench.ts's knownValidators literal
  // is structurally barred from scenario coverage — the drift that let five real
  // PR-blocking gates go scenario-invisible. The parity check now reads the
  // literal and fails on the gap.
  const parityAllowlist = makeEmptyFixture("package-parity-launchbench-allowlist-gap");
  const allowlistPair = writeParityPair(parityAllowlist, { rootVersion: "0.0.1", skillVersion: "0.0.1" });
  mkdirSync(path.join(allowlistPair.parityScriptRoot, "tooling"), { recursive: true });
  writeFileSync(path.join(allowlistPair.parityScriptRoot, "tooling", "validate-project-state.ts"), "// stub\n", "utf8");
  writeFileSync(
    path.join(allowlistPair.parityScriptRoot, "tooling", "run-launchbench.ts"),
    'const knownValidators = new Set(["validate-project-state"]);\nexport { knownValidators };\n',
    "utf8",
  );
  runScriptArgs(
    "package parity fails when a wired validator is missing from the launchbench allowlist",
    "check-package-parity.ts",
    ["--repo-root", allowlistPair.repoRoot, "--skill-root", allowlistPair.parityScriptRoot],
    1,
    "package_parity.launchbench_validator_missing",
  );

  // A wired validator whose command names no script under validation/business/, validation/repository/ or
  // tooling/ used to be skipped in silence: the basename regex simply failed to
  // match and the loop moved on, so the allowlist cross-check above could grade
  // nothing while still exiting 0. That is the exact shape of failure the
  // validation/business/ + validation/repository/ split could have reintroduced, so the unparseable command
  // is now an error in its own right and is proven to fail here.
  const parityUnparseable = makeEmptyFixture("package-parity-unparseable-validator-command");
  const unparseablePair = writeParityPair(parityUnparseable, { rootVersion: "0.0.1", skillVersion: "0.0.1" });
  mkdirSync(path.join(unparseablePair.parityScriptRoot, "tooling"), { recursive: true });
  writeFileSync(path.join(unparseablePair.parityScriptRoot, "tooling", "validate-project-state.ts"), "// stub\n", "utf8");
  writeFileSync(
    path.join(unparseablePair.parityScriptRoot, "tooling", "run-launchbench.ts"),
    'const knownValidators = new Set(["validate-project-state"]);\nexport { knownValidators };\n',
    "utf8",
  );
  for (const packagePath of [path.join(unparseablePair.repoRoot, "package.json"), path.join(unparseablePair.parityScriptRoot, "package.json")]) {
    const parsed = JSON.parse(readFileSync(packagePath, "utf8")) as { scripts: Record<string, string> };
    // tools/ is not one of the three script roots, so no basename can be read.
    parsed.scripts["check:revenue"] = "tsx tools/check-revenue.ts";
    writeFileSync(packagePath, JSON.stringify(parsed, null, 2), "utf8");
  }
  runScriptArgs(
    "package parity fails loudly when a wired validator command names no known script root",
    "check-package-parity.ts",
    ["--repo-root", unparseablePair.repoRoot, "--skill-root", unparseablePair.parityScriptRoot],
    1,
    "package_parity.launchbench_validator_unparseable",
  );

  // --- audit-skill-links ---
  const wireLinkRoot = (root: string): void => {
    mkdirSync(path.join(root, "knowledge"), { recursive: true });
    mkdirSync(path.join(root, "workspace", "business"), { recursive: true });
    writeFileSync(path.join(root, "knowledge", "guide.md"), "See [the template](../workspace/business/artifact.md) for the artifact contract.\n", "utf8");
    writeFileSync(path.join(root, "workspace", "business", "artifact.md"), "# Artifact\nRouted from references/guide.md — keep both sides linked.\n", "utf8");
  };

  const linksClean = makeEmptyFixture("skill-links-clean");
  wireLinkRoot(linksClean);
  runScriptArgs("link audit passes on a wired reference/template pair", "audit-skill-links.ts", ["--skill-root", linksClean], 0);

  const linksBroken = makeEmptyFixture("skill-links-broken");
  wireLinkRoot(linksBroken);
  writeFileSync(path.join(linksBroken, "knowledge", "guide.md"), "See [the template](../workspace/business/missing.md); artifact.md still routes.\n", "utf8");
  runScriptArgs("link audit fails on a broken local link", "audit-skill-links.ts", ["--skill-root", linksBroken], 1, "skill_links.broken_local_link");

  const linksOrphan = makeEmptyFixture("skill-links-orphan");
  wireLinkRoot(linksOrphan);
  writeFileSync(path.join(linksOrphan, "knowledge", "unrouted.md"), "No other file mentions this reference, so no agent can load it.\n", "utf8");
  runScriptArgs("link audit fails on an orphaned reference file", "audit-skill-links.ts", ["--skill-root", linksOrphan], 1, "skill_links.orphan_file");

  // Regression (verification pass): a basename that is a substring of another
  // mentioned file's basename ("lane.md" inside "sub-lane.md") is not a mention.
  const linksSubstringOrphan = makeEmptyFixture("skill-links-substring-orphan");
  wireLinkRoot(linksSubstringOrphan);
  writeFileSync(path.join(linksSubstringOrphan, "knowledge", "lane.md"), "Nothing references this file by its own name.\n", "utf8");
  writeFileSync(
    path.join(linksSubstringOrphan, "knowledge", "guide.md"),
    "See [the template](../workspace/business/artifact.md); also read sub-lane.md notes.\n",
    "utf8",
  );
  writeFileSync(path.join(linksSubstringOrphan, "knowledge", "sub-lane.md"), "Routed from references/guide.md.\n", "utf8");
  runScriptArgs("link audit flags a basename-substring orphan", "audit-skill-links.ts", ["--skill-root", linksSubstringOrphan], 1, "skill_links.orphan_file");

  const linksDuplicate = makeEmptyFixture("skill-links-duplicate");
  wireLinkRoot(linksDuplicate);
  const duplicateBody =
    "# Duplicate body\nThis exact content is shipped twice under business/, which will drift apart silently over time once one copy is edited and the other is forgotten.\n";
  writeFileSync(path.join(linksDuplicate, "workspace", "business", "copy-one.md"), duplicateBody, "utf8");
  writeFileSync(path.join(linksDuplicate, "workspace", "business", "copy-two.md"), duplicateBody, "utf8");
  writeFileSync(
    path.join(linksDuplicate, "knowledge", "guide.md"),
    "See [the template](../workspace/business/artifact.md), plus copy-one.md and copy-two.md.\n",
    "utf8",
  );
  runScriptArgs(
    "link audit fails on byte-identical template duplicates",
    "audit-skill-links.ts",
    ["--skill-root", linksDuplicate],
    1,
    "skill_links.duplicate_template",
  );

  // --- check-template-safety ---
  const templateSafetyClean = makeEmptyFixture("template-safety-clean");
  writeFileSync(path.join(templateSafetyClean, "component.tsx"), 'import { View } from "react-native";\nexport const Ok = View;\n', "utf8");
  runFixture("template safety passes on native-animation-only code", templateSafetyClean, "check-template-safety.ts", 0);

  const templateSafetyStaleMobai = makeEmptyFixture("template-safety-stale-mobai");
  writeFileSync(path.join(templateSafetyStaleMobai, "TESTING.md"), "Call mcp__mobai__get_screenshot directly.\n", "utf8");
  runFixture(
    "template safety rejects hardcoded MobAI MCP identifiers",
    templateSafetyStaleMobai,
    "check-template-safety.ts",
    1,
    "template_safety.stale_mobai_mcp_name",
  );

  const templateSafetyBad = makeEmptyFixture("template-safety-framer-motion");
  writeFileSync(path.join(templateSafetyBad, "component.tsx"), 'import { motion } from "framer-motion";\nexport const Bad = motion.div;\n', "utf8");
  runFixture(
    "template safety fails on a framer-motion import in template code",
    templateSafetyBad,
    "check-template-safety.ts",
    1,
    "template_safety.framer_motion_in_template",
  );

  // The landing section library is a web-only surface where motion/react is
  // mandated (knowledge/design/landing-motion-craft.md); the same import outside
  // landing/ still fails above.
  const templateSafetyLanding = makeEmptyFixture("template-safety-landing-pack");
  mkdirSync(path.join(templateSafetyLanding, "growth", "landing", "sections"), { recursive: true });
  writeFileSync(
    path.join(templateSafetyLanding, "growth", "landing", "sections", "Hero.tsx"),
    'import { motion } from "motion/react";\nexport const Hero = motion.section;\n',
    "utf8",
  );
  runFixture("template safety allows motion/react inside the landing web pack", templateSafetyLanding, "check-template-safety.ts", 0);

  // Regression (verification pass): the exception is anchored to the TOP-LEVEL
  // landing/ pack; a nested directory named landing stays covered by the gate.
  const templateSafetyNestedLanding = makeEmptyFixture("template-safety-nested-landing");
  mkdirSync(path.join(templateSafetyNestedLanding, "mobile", "landing"), { recursive: true });
  writeFileSync(
    path.join(templateSafetyNestedLanding, "mobile", "landing", "Screen.tsx"),
    'import { motion } from "framer-motion";\nexport const Screen = motion.div;\n',
    "utf8",
  );
  runFixture(
    "template safety still fails motion imports in nested landing dirs",
    templateSafetyNestedLanding,
    "check-template-safety.ts",
    1,
    "template_safety.framer_motion_in_template",
  );

  // --- render-business-control-plane-workspace (--check mode) ---
  runScriptArgs(
    "workspace render check passes against the committed output",
    "render-business-control-plane-workspace.ts",
    [
      "--root",
      path.join(skillRoot, "workspace", "business"),
      "--business-state",
      "../../studio/seed/business.json",
      "--out",
      path.join(skillRoot, "studio", "seed", "workspace.generated.json"),
      "--check",
    ],
    0,
  );

  // Aggregate mode: repeated --business dirs concatenate into one board over
  // the same per-business adapter. Distinct slugs render; colliding slugs fail
  // loudly instead of silently overlaying rows.
  const aggregateRoot = makeEmptyFixture("workspace-aggregate");
  const aggregateA = path.join(aggregateRoot, "business-a");
  const aggregateB = path.join(aggregateRoot, "business-b");
  cpSync(path.join(skillRoot, "workspace", "business"), aggregateA, { recursive: true });
  cpSync(path.join(skillRoot, "workspace", "business"), aggregateB, { recursive: true });
  writeFileSync(
    path.join(aggregateB, "state", "business.json"),
    readFileSync(path.join(aggregateB, "state", "business.json"), "utf8").replace(/"slug": "[^"]*"/, '"slug": "second-app"'),
    "utf8",
  );
  runScriptArgs(
    "aggregate render concatenates two businesses onto one board",
    "render-business-control-plane-workspace.ts",
    ["--business", aggregateA, "--business", aggregateB, "--out", path.join(aggregateRoot, "board.json")],
    0,
  );
  runScriptArgs(
    "aggregate check passes against the freshly rendered board",
    "render-business-control-plane-workspace.ts",
    ["--business", aggregateA, "--business", aggregateB, "--out", path.join(aggregateRoot, "board.json"), "--check"],
    0,
  );

  const aggregateDupRoot = makeEmptyFixture("workspace-aggregate-duplicate-id");
  const aggregateDupA = path.join(aggregateDupRoot, "business-a");
  const aggregateDupB = path.join(aggregateDupRoot, "business-b");
  cpSync(path.join(skillRoot, "workspace", "business"), aggregateDupA, { recursive: true });
  cpSync(path.join(skillRoot, "workspace", "business"), aggregateDupB, { recursive: true });
  runScriptArgs(
    "aggregate render fails when two businesses share a slug",
    "render-business-control-plane-workspace.ts",
    ["--business", aggregateDupA, "--business", aggregateDupB, "--out", path.join(aggregateDupRoot, "board.json")],
    1,
    "business_workspace.duplicate_business_id",
  );

  const workspaceDrift = makeEmptyFixture("workspace-check-drift");
  const staleWorkspacePath = path.join(workspaceDrift, "workspace.generated.json");
  writeFileSync(staleWorkspacePath, '{"stale": true}\n', "utf8");
  runScriptArgs(
    "workspace render check fails on stale committed output",
    "render-business-control-plane-workspace.ts",
    ["--root", path.join(skillRoot, "workspace", "business"), "--out", staleWorkspacePath, "--check"],
    1,
    "business_workspace.output.drift",
  );

  // --- check-founder-copy ---
  // The gate had zero fixture coverage: nothing proved it could fail.
  runScriptArgs(
    "founder copy passes on the shipped skill and templates",
    "check-founder-copy.ts",
    ["--root", path.join(skillRoot, "workspace", "business"), "--skill-root", skillRoot],
    0,
  );

  const founderCopyRawId = makeEmptyFixture("founder-copy-raw-identifier");
  writeFileSync(
    path.join(founderCopyRawId, "state/launch-cockpit.html"),
    "<html><body><h2>Progress</h2><p>paid_tool_routing | not_started</p></body></html>\n",
    "utf8",
  );
  runScriptArgs(
    "raw snake_case on a founder surface fails founder copy",
    "check-founder-copy.ts",
    ["--root", founderCopyRawId, "--skill-root", skillRoot],
    1,
    "founder_copy.raw_identifier",
  );

  // The narrative-freshness rule the PROJECT_STATE template comment has
  // promised since v0.25.0: empty narrative past orient is an error.
  const founderCopyStaleNarrative = makeEmptyFixture("founder-copy-stale-narrative");
  writeFileSync(
    path.join(founderCopyStaleNarrative, "state/PROJECT_STATE.yaml"),
    ["narrative:", '  since_last_time: ""', '  right_now: ""', '  your_call: ""', "project:", '  phase: "phase_1"'].join("\n"),
    "utf8",
  );
  runScriptArgs(
    "empty narrative past orient fails founder copy",
    "check-founder-copy.ts",
    ["--root", founderCopyStaleNarrative, "--skill-root", skillRoot],
    1,
    "founder_copy.narrative_stale.since_last_time",
  );

  // Beats defined but never rendered was the original miss — a skill root
  // whose renderer lacks the celebration wiring must fail.
  const founderCopyUnwired = makeEmptyFixture("founder-copy-celebration-unwired");
  mkdirSync(path.join(founderCopyUnwired, "skill", "tooling", "lib"), { recursive: true });
  cpSync(path.join(skillRoot, "tooling", "lib", "founder-copy.ts"), path.join(founderCopyUnwired, "skill", "tooling", "lib", "founder-copy.ts"));
  writeFileSync(path.join(founderCopyUnwired, "skill", "tooling", "render-launch-cockpit.ts"), "// stub renderer with no beat wiring\n", "utf8");
  runScriptArgs(
    "renderer without celebration wiring fails founder copy",
    "check-founder-copy.ts",
    ["--root", founderCopyUnwired, "--skill-root", path.join(founderCopyUnwired, "skill")],
    1,
    "founder_copy.celebration_unwired",
  );

  /**
   * Rule 4 — the experience-card naming decision. The twelve technique names are
   * deliberately NOT translated for a founder, which is a decision that leaves no trace in
   * the tree and so rots faster than a change would. These four fixtures are the trace.
   *
   * Each builds a fake skill root: the real dictionary and renderer (so rules 1–3 stay
   * quiet) plus a card-stub directory whose tiers and names the fixture controls.
   */
  function makeCardSkillRoot(name: string, stubs: { file: string; heading: string; tier: string }[], dictionary?: string): string {
    const root = makeEmptyFixture(name);
    const skill = path.join(root, "skill");
    mkdirSync(path.join(skill, "tooling", "lib"), { recursive: true });
    mkdirSync(path.join(skill, "knowledge", "experience", "experience-cards"), { recursive: true });
    writeFileSync(
      path.join(skill, "tooling", "lib", "founder-copy.ts"),
      dictionary ?? readFileSync(path.join(skillRoot, "tooling", "lib", "founder-copy.ts"), "utf8"),
      "utf8",
    );
    cpSync(path.join(skillRoot, "tooling", "render-launch-cockpit.ts"), path.join(skill, "tooling", "render-launch-cockpit.ts"));
    for (const stub of stubs) {
      writeFileSync(
        path.join(skill, "knowledge", "experience", "experience-cards", stub.file),
        [`# ${stub.heading} Card`, "", `**Risk tier.** ${stub.tier} — canonical in the routing table.`, ""].join("\n"),
        "utf8",
      );
    }
    return root;
  }

  /** The shipped HIGH set. A fixture that keeps both of these leaves rule 4a quiet. */
  const attestedStubs = [
    { file: "variable-reward-card.md", heading: "Variable Reward", tier: "HIGH" },
    { file: "streak-and-loss-aversion-card.md", heading: "Streak and Loss Aversion", tier: "HIGH" },
  ];

  runScriptArgs(
    "card stubs matching the attested HIGH set pass founder copy",
    "check-founder-copy.ts",
    ["--root", makeEmptyFixture("founder-copy-cards-clean"), "--skill-root", path.join(makeCardSkillRoot("cards-clean", attestedStubs), "skill")],
    0,
  );

  // 4a — demoting a HIGH card in its stub must not silently shrink what the founder
  // attests to by name. This is the rule that makes the stub tiers load-bearing.
  const cardsDemoted = makeCardSkillRoot("cards-high-demoted", [
    { file: "variable-reward-card.md", heading: "Variable Reward", tier: "MEDIUM" },
    { file: "streak-and-loss-aversion-card.md", heading: "Streak and Loss Aversion", tier: "HIGH" },
  ]);
  runScriptArgs(
    "a HIGH card demoted in its stub fails the attested-technique tie",
    "check-founder-copy.ts",
    ["--root", makeEmptyFixture("founder-copy-cards-demoted"), "--skill-root", path.join(cardsDemoted, "skill")],
    1,
    "founder_copy.attested_technique_drift",
  );

  // 4a, other direction — promoting a card to HIGH without adding it to attestedTechniques
  // would leave a founder signing off on a mechanic the copy layer never named.
  const cardsPromoted = makeCardSkillRoot("cards-extra-high", [...attestedStubs, { file: "peak-end-card.md", heading: "Peak-End", tier: "HIGH" }]);
  runScriptArgs(
    "a card promoted to HIGH without founder copy fails the attested-technique tie",
    "check-founder-copy.ts",
    ["--root", makeEmptyFixture("founder-copy-cards-promoted"), "--skill-root", path.join(cardsPromoted, "skill")],
    1,
    "founder_copy.attested_technique_drift",
  );

  // 4b — banning a technique name is how the decision gets reversed by accident: the
  // banned list's contract is "say this instead", which is exactly the euphemism these
  // names must not acquire. "Proof" is already banned vocabulary, so a technique that
  // takes that name must fail rather than quietly inherit a replacement.
  const cardsBannedName = makeCardSkillRoot("cards-banned-name", [...attestedStubs, { file: "proof-card.md", heading: "Proof", tier: "MEDIUM" }]);
  runScriptArgs(
    "a technique named as banned vocabulary fails founder copy",
    "check-founder-copy.ts",
    ["--root", makeEmptyFixture("founder-copy-cards-banned"), "--skill-root", path.join(cardsBannedName, "skill")],
    1,
    "founder_copy.technique_alias_banned",
  );

  // 4c — the umbrella phrase is what a founder gets instead of twelve new words. Declaring
  // it as a constant proves nothing; it has to survive in the lane blurb they read.
  const cardsNoUmbrella = makeCardSkillRoot(
    "cards-umbrella-reworded",
    attestedStubs,
    readFileSync(path.join(skillRoot, "tooling", "lib", "founder-copy.ts"), "utf8").replace(
      "The moments that make the app satisfying to use, and the limits we hold ourselves to.",
      "How we handle engagement mechanics and their limits.",
    ),
  );
  runScriptArgs(
    "an emotional-design blurb that drops the umbrella phrase fails founder copy",
    "check-founder-copy.ts",
    ["--root", makeEmptyFixture("founder-copy-cards-umbrella"), "--skill-root", path.join(cardsNoUmbrella, "skill")],
    1,
    "founder_copy.umbrella_unreachable",
  );

  // --- check-motion-contract ---
  // The real contract files are copied in rather than invented, so each failing
  // fixture is the shipped skill plus exactly one seeded drift — if the shipped
  // files and the parser ever stop agreeing, the passing fixture goes red too.
  const motionContractFiles = [
    "knowledge/design/motion-craft-benchmarks.md",
    "knowledge/design/premium-mobile-craft.md",
    "studio/generated/system/tokens.json",
    "studio/generated/system/DesignTokens.swift",
    "workspace/business/design/system/tokens.json",
    "workspace/business/design/system/DesignTokens.swift",
    "workspace/business/design/system/PremiumCraft.swift",
    "knowledge/experience/experience-cards/peak-end-card.md",
    "knowledge/experience/experience-cards/mastery-and-status-card.md",
    "knowledge/experience/experience-cards/variable-reward-card.md",
    "workspace/business/design/DESIGN.md",
    "workspace/business/product/experience/emotional-design/EMOTIONAL_DESIGN.md",
    "workspace/business/design/motion-catalog/TokenSpring.swift",
    "workspace/business/design/motion-catalog/motion-tokens.ts",
  ];
  const writeMotionContractRoot = (name: string, mutate?: (rel: string, text: string) => string): string => {
    const root = makeEmptyFixture(name);
    for (const rel of motionContractFiles) {
      const target = path.join(root, rel);
      mkdirSync(path.dirname(target), { recursive: true });
      const text = readFileSync(path.join(skillRoot, rel), "utf8");
      writeFileSync(target, mutate ? mutate(rel, text) : text, "utf8");
    }
    return root;
  };

  runScriptArgs("motion contract passes on the shipped skill", "check-motion-contract.ts", ["--skill-root", skillRoot], 0);

  const motionMirrorDrift = writeMotionContractRoot("motion-contract-mirror-drift", (rel, text) =>
    rel.endsWith("motion-craft-benchmarks.md")
      ? text.replace("celebrate (response 0.45–0.5 / damping 0.5–0.7)", "celebrate (response 0.45–0.6 / damping 0.5–0.7)")
      : text,
  );
  runScriptArgs(
    "motion contract fails when the benchmarks spring-family mirror drifts from the craft table",
    "check-motion-contract.ts",
    ["--skill-root", motionMirrorDrift],
    1,
    "motion_contract.family_mirror.drift",
  );

  const motionTokenDrift = writeMotionContractRoot("motion-contract-token-drift", (rel, text) =>
    rel.endsWith("tokens.json") ? text.replace('"durationBase": "220ms"', '"durationBase": "200ms"') : text,
  );
  runScriptArgs(
    "motion contract fails when a documented token value drifts from tokens.json",
    "check-motion-contract.ts",
    ["--skill-root", motionTokenDrift],
    1,
    "motion_contract.token_row.value_drift",
  );

  const motionCanonDrift = writeMotionContractRoot("motion-contract-canon-outside-band", (rel, text) =>
    rel.endsWith("peak-end-card.md") ? text.replace(".spring(response: 0.45, dampingFraction: 0.7)", ".spring(response: 0.45, dampingFraction: 0.85)") : text,
  );
  runScriptArgs(
    "motion contract fails when a canon card's spring falls outside the stated celebrate band",
    "check-motion-contract.ts",
    ["--skill-root", motionCanonDrift],
    1,
    "motion_contract.canon.outside_band",
  );

  const motionPresetDrift = writeMotionContractRoot("motion-contract-preset-duration-drift", (rel, text) =>
    rel.endsWith("PremiumCraft.swift") ? text.replace("duration: DesignTokens.Motion.durationFast,", "duration: DesignTokens.Motion.durationBase,") : text,
  );
  runScriptArgs(
    "motion contract fails when a preset rides a different duration token than the table maps",
    "check-motion-contract.ts",
    ["--skill-root", motionPresetDrift],
    1,
    "motion_contract.preset.duration_mismatch",
  );

  const motionRowLost = writeMotionContractRoot("motion-contract-table-row-lost", (rel, text) =>
    rel.endsWith("motion-craft-benchmarks.md")
      ? text
          .split("\n")
          .filter((line) => !line.startsWith("| `durationSlow` |"))
          .join("\n")
      : text,
  );
  runScriptArgs(
    "motion contract fails when the token table silently loses a required row",
    "check-motion-contract.ts",
    ["--skill-root", motionRowLost],
    1,
    "motion_contract.token_table.row_missing",
  );

  // The durationCelebrate row carries TWO presets; the gate must validate the
  // second annotation, not just the first, and must notice the row vanishing.
  const motionLandingBounceDrift = writeMotionContractRoot("motion-contract-landing-bounce-drift", (rel, text) =>
    rel.endsWith("PremiumCraft.swift") ? text.replace("bounce: 0.45", "bounce: 0.5") : text,
  );
  runScriptArgs(
    "motion contract fails when the celebrateLanding preset bounce drifts from the table",
    "check-motion-contract.ts",
    ["--skill-root", motionLandingBounceDrift],
    1,
    "motion_contract.preset.bounce_drift",
  );

  const motionCelebrateRowLost = writeMotionContractRoot("motion-contract-celebrate-row-lost", (rel, text) =>
    rel.endsWith("motion-craft-benchmarks.md")
      ? text
          .split("\n")
          .filter((line) => !line.startsWith("| `durationCelebrate` |"))
          .join("\n")
      : text,
  );
  runScriptArgs(
    "motion contract fails when the celebrate mapping row is removed from the table",
    "check-motion-contract.ts",
    ["--skill-root", motionCelebrateRowLost],
    1,
    "motion_contract.token_table.row_missing",
  );

  const motionAnnotationLost = writeMotionContractRoot("motion-contract-preset-annotation-lost", (rel, text) =>
    rel.endsWith("motion-craft-benchmarks.md") ? text.replace("`PremiumMotion.press` (bounce 0.18)", "`PremiumMotion.press`") : text,
  );
  runScriptArgs(
    "motion contract fails when a preset row loses its bounce annotation",
    "check-motion-contract.ts",
    ["--skill-root", motionAnnotationLost],
    1,
    "motion_contract.preset.annotation_missing",
  );

  const motionMalformedRef = writeMotionContractRoot("motion-contract-malformed-token-ref", (rel, text) =>
    rel.endsWith("motion-craft-benchmarks.md") ? `${text}\nWeb loops may also ride \`motion.durationReveal2\` or \`motion.constructor\` when staged.\n` : text,
  );
  runScriptArgs(
    "motion contract fails on a malformed token reference that truncation used to let pass",
    "check-motion-contract.ts",
    ["--skill-root", motionMalformedRef],
    1,
    "motion_contract.token_reference.unknown",
  );

  const motionSymbolUnresolvable = writeMotionContractRoot("motion-contract-symbol-unresolvable", (rel, text) =>
    rel.endsWith("variable-reward-card.md")
      ? text.replace(".spring(response: 0.5, dampingFraction: 0.6)", ".spring(response: DesignTokens.Motion.expressive, dampingFraction: 0.6)")
      : text,
  );
  runScriptArgs(
    "motion contract fails when a canon spring cites a Motion member the enum does not define",
    "check-motion-contract.ts",
    ["--skill-root", motionSymbolUnresolvable],
    1,
    "motion_contract.canon.symbol_unresolvable",
  );

  const motionVocabMember = writeMotionContractRoot("motion-contract-vocab-phantom-member", (rel, text) =>
    rel.endsWith("mastery-and-status-card.md") ? `${text}\nThe badge scale-in rides \`DesignTokens.Motion.expressive\` timing.\n` : text,
  );
  runScriptArgs(
    "motion contract fails on a prose reference to a Motion member the enum does not define",
    "check-motion-contract.ts",
    ["--skill-root", motionVocabMember],
    1,
    "motion_contract.vocabulary.member_unknown",
  );

  const motionVocabToken = writeMotionContractRoot("motion-contract-vocab-phantom-token", (rel, text) =>
    rel.endsWith("peak-end-card.md") ? `${text}\nThe stamp fade rides \`motion.brief\` timing.\n` : text,
  );
  runScriptArgs(
    "motion contract fails on a card token reference tokens.json does not define",
    "check-motion-contract.ts",
    ["--skill-root", motionVocabToken],
    1,
    "motion_contract.vocabulary.token_unknown",
  );

  const motionVocabCssVar = writeMotionContractRoot("motion-contract-vocab-phantom-css-var", (rel, text) =>
    rel.endsWith("variable-reward-card.md") ? `${text}\nWeb pulses read the \`--motion-brief\` variable.\n` : text,
  );
  runScriptArgs(
    "motion contract fails on a CSS variable the token promotion pipeline does not mint",
    "check-motion-contract.ts",
    ["--skill-root", motionVocabCssVar],
    1,
    "motion_contract.vocabulary.css_var_unknown",
  );

  const motionVocabPunctuatedToken = writeMotionContractRoot("motion-contract-vocab-punctuated-token", (rel, text) =>
    rel.endsWith("peak-end-card.md") ? `${text}\nStaged loops may also ride \`motion.durationReveal-extra\` cycles.\n` : text,
  );
  runScriptArgs(
    "motion contract fails on a punctuated card token reference outside the benchmarks",
    "check-motion-contract.ts",
    ["--skill-root", motionVocabPunctuatedToken],
    1,
    "motion_contract.vocabulary.token_unknown",
  );

  const motionVocabEmbeddedToken = writeMotionContractRoot("motion-contract-vocab-embedded-token", (rel, text) =>
    rel.endsWith("variable-reward-card.md") ? `${text}\nWeb: \`transition={{ repeat: Infinity, duration: motion.moderate }}\` for anticipation.\n` : text,
  );
  runScriptArgs(
    "motion contract fails on a phantom token embedded in an implementation code span",
    "check-motion-contract.ts",
    ["--skill-root", motionVocabEmbeddedToken],
    1,
    "motion_contract.vocabulary.token_unknown",
  );

  const motionVocabFencedToken = writeMotionContractRoot("motion-contract-vocab-fenced-token", (rel, text) =>
    rel.endsWith("peak-end-card.md") ? `${text}\n\`\`\`swift\nlet duration = motion.moderate\n\`\`\`\n` : text,
  );
  runScriptArgs(
    "motion contract fails on a phantom token inside a fenced code block",
    "check-motion-contract.ts",
    ["--skill-root", motionVocabFencedToken],
    1,
    "motion_contract.vocabulary.token_unknown",
  );

  const motionVocabIntrinsics = writeMotionContractRoot("motion-contract-vocab-intrinsic-elements", (rel, text) =>
    rel.endsWith("peak-end-card.md")
      ? `${text}\nWrap the section in \`motion.article\` or \`<motion.nav layout>\`; \`motion.form\` and \`motion.main\` also animate.\n`
      : text,
  );
  runScriptArgs(
    "motion contract accepts motion/react intrinsic elements beyond a fixed tag list",
    "check-motion-contract.ts",
    ["--skill-root", motionVocabIntrinsics],
    0,
  );

  const motionPackBounceDrift = writeMotionContractRoot("motion-contract-pack-bounce-drift", (rel, text) =>
    rel.endsWith("TokenSpring.swift")
      ? text.replace(
          "TokenSpring(duration: DesignTokens.Motion.durationCelebrate, bounce: 0.45)",
          "TokenSpring(duration: DesignTokens.Motion.durationCelebrate, bounce: 0.5)",
        )
      : text,
  );
  runScriptArgs(
    "motion contract fails when TokenSpring.swift's copied bounce drifts from PremiumCraft",
    "check-motion-contract.ts",
    ["--skill-root", motionPackBounceDrift],
    1,
    "motion_contract.token_spring.bounce_drift",
  );

  const motionPackTsValueDrift = writeMotionContractRoot("motion-contract-pack-ts-value-drift", (rel, text) =>
    rel.endsWith("motion-tokens.ts") ? text.replace("durationCelebrate: 500,", "durationCelebrate: 450,") : text,
  );
  runScriptArgs(
    "motion contract fails when motion-tokens.ts's ms table drifts from tokens.json",
    "check-motion-contract.ts",
    ["--skill-root", motionPackTsValueDrift],
    1,
    "motion_contract.motion_tokens.token_value_drift",
  );

  const motionPackPresetMissing = writeMotionContractRoot("motion-contract-pack-preset-missing", (rel, text) =>
    rel.endsWith("motion-tokens.ts") ? text.replace("  celebrateLanding: springFromPreset(Motion.durationCelebrate, 0.45),\n", "") : text,
  );
  runScriptArgs(
    "motion contract fails when motion-tokens.ts drops a PremiumCraft preset",
    "check-motion-contract.ts",
    ["--skill-root", motionPackPresetMissing],
    1,
    "motion_contract.motion_tokens.preset_missing",
  );

  const motionCardMomentDrift = writeMotionContractRoot("motion-contract-card-moment-drift", (rel, text) =>
    rel.endsWith("workspace/business/design/DESIGN.md")
      ? text.replace("| Intent Mirror entrance | `motion.durationReveal` |", "| Intent Mirror entrance | `motion.durationSlow` |")
      : text,
  );
  runScriptArgs(
    "motion contract fails when the two seeded templates disagree on a card moment's tokens",
    "check-motion-contract.ts",
    ["--skill-root", motionCardMomentDrift],
    1,
    "motion_contract.card_moments.drift",
  );

  const motionVocabCssVarSuffix = writeMotionContractRoot("motion-contract-vocab-css-var-suffix", (rel, text) =>
    rel.endsWith("variable-reward-card.md") ? `${text}\nWeb pulses may read the \`--motion-duration-fast_extra\` variable.\n` : text,
  );
  runScriptArgs(
    "motion contract fails on a CSS variable that extends a promoted name past an identifier boundary",
    "check-motion-contract.ts",
    ["--skill-root", motionVocabCssVarSuffix],
    1,
    "motion_contract.vocabulary.css_var_unknown",
  );

  const motionFamilyDuplicate = writeMotionContractRoot("motion-contract-family-duplicate", (rel, text) =>
    rel.endsWith("premium-mobile-craft.md")
      ? text.replace(
          "| **celebrate** | response 0.45\u20130.5, dampingFraction 0.5\u20130.7",
          "| **press** | response 0.2\u20130.3, dampingFraction 0.9\u20130.95 | stale contradictory row | none |\n| **celebrate** | response 0.45\u20130.5, dampingFraction 0.5\u20130.7",
        )
      : text,
  );
  runScriptArgs(
    "motion contract fails when the spring table states a family twice",
    "check-motion-contract.ts",
    ["--skill-root", motionFamilyDuplicate],
    1,
    "motion_contract.family_table.duplicate",
  );

  const motionPunctuatedRef = writeMotionContractRoot("motion-contract-punctuated-token-ref", (rel, text) =>
    rel.endsWith("motion-craft-benchmarks.md") ? `${text}\nStaged loops may also ride \`motion.durationReveal-extra\` cycles.\n` : text,
  );
  runScriptArgs(
    "motion contract fails on a punctuated token reference the closing-backtick rule now captures",
    "check-motion-contract.ts",
    ["--skill-root", motionPunctuatedRef],
    1,
    "motion_contract.token_reference.unknown",
  );

  const motionMalformedSpring = writeMotionContractRoot("motion-contract-malformed-spring-literal", (rel, text) =>
    rel.endsWith("mastery-and-status-card.md")
      ? text.replace(".spring(response: 0.5, dampingFraction: 0.7)", ".spring(response: 0..5, dampingFraction: 0.7)")
      : text,
  );
  runScriptArgs(
    "motion contract fails when a canon spring literal does not parse as a valid decimal",
    "check-motion-contract.ts",
    ["--skill-root", motionMalformedSpring],
    1,
    "motion_contract.canon.spring_malformed",
  );

  const motionTemplateDrift = writeMotionContractRoot("motion-contract-template-token-drift", (rel, text) =>
    rel === "workspace/business/design/system/tokens.json" ? text.replace('"durationBase": "220ms"', '"durationBase": "240ms"') : text,
  );
  runScriptArgs(
    "motion contract fails when the template token copy drifts from the top-level artifact",
    "check-motion-contract.ts",
    ["--skill-root", motionTemplateDrift],
    1,
    "motion_contract.template_tokens.drift",
  );

  const motionPresetValueDrift = writeMotionContractRoot("motion-contract-preset-value-drift", (rel, text) =>
    rel.endsWith("DesignTokens.swift") ? text.replace("static let durationFast: Double = 0.12", "static let durationFast: Double = 0.15") : text,
  );
  runScriptArgs(
    "motion contract fails when the Swift duration value drifts from the documented milliseconds",
    "check-motion-contract.ts",
    ["--skill-root", motionPresetValueDrift],
    1,
    "motion_contract.token_row.swift_value_drift",
  );

  const motionMirrorDuplicate = writeMotionContractRoot("motion-contract-mirror-duplicate", (rel, text) =>
    rel.endsWith("motion-craft-benchmarks.md")
      ? `${text}\nStale: press (response 0.2\u20130.3 / damping 0.9\u20130.95) and celebrate (response 0.7\u20130.8 / damping 0.3\u20130.4) were the old bands.\n`
      : text,
  );
  runScriptArgs(
    "motion contract fails when a second stale spring-family mirror statement appears",
    "check-motion-contract.ts",
    ["--skill-root", motionMirrorDuplicate],
    1,
    "motion_contract.family_mirror.duplicate",
  );

  const motionInvertedRange = writeMotionContractRoot("motion-contract-inverted-range", (rel, text) =>
    rel.endsWith("premium-mobile-craft.md")
      ? text.replace("| **press** | response 0.3\u20130.4, dampingFraction 0.7\u20130.8", "| **press** | response 0.4\u20130.3, dampingFraction 0.7\u20130.8")
      : text,
  );
  runScriptArgs(
    "motion contract fails when a spring-family range is inverted",
    "check-motion-contract.ts",
    ["--skill-root", motionInvertedRange],
    1,
    "motion_contract.family_table.inverted_range",
  );

  const motionSwiftMemberLost = writeMotionContractRoot("motion-contract-swift-member-lost", (rel, text) =>
    rel.endsWith("DesignTokens.swift")
      ? text
          .split("\n")
          .filter((line) => !line.includes("static let stagger: Double"))
          .join("\n")
      : text,
  );
  runScriptArgs(
    "motion contract fails when a documented token member is deleted from the Swift enum",
    "check-motion-contract.ts",
    ["--skill-root", motionSwiftMemberLost],
    1,
    "motion_contract.token_row.swift_member_missing",
  );

  const motionCinematicLeak = writeMotionContractRoot("motion-contract-cinematic-leak", (rel, text) =>
    rel.endsWith("premium-mobile-craft.md") ? `${text}\nUse durationCinematic for hero moments.\n` : text,
  );
  runScriptArgs(
    "motion contract fails when the cinematic token leaks into the in-app craft doctrine",
    "check-motion-contract.ts",
    ["--skill-root", motionCinematicLeak],
    1,
    "motion_contract.cinematic.in_craft_doctrine",
  );

  // --- check-no-slop ---
  //
  // The gate had zero fixture coverage: nothing proved the tier split (public
  // front-door docs error, maintainer-only docs warn) or the advisory-only
  // status of empty adverbs/phrases could actually fire. The real
  // no-slop-writing.md is copied in rather than a fixture-only word list, so a
  // rule added there is exercised here without duplicating it.
  runScriptArgs("no-slop passes on the shipped repo's own front door", "check-no-slop.ts", ["--skill-root", skillRoot], 0);

  function writeNoSlopRoot(name: string, overrides: Partial<Record<string, string>> = {}): { repoRoot: string; skillRoot: string } {
    const root = makeEmptyFixture(name);
    const repoRoot = path.join(root, "repo");
    const fixtureSkillRoot = path.join(repoRoot, "skill", "pkg");
    mkdirSync(path.join(fixtureSkillRoot, "knowledge", "words"), { recursive: true });
    const defaults: Record<string, string> = {
      "README.md": "# Example\n\nA plain description of what this project does.\n",
      "CONTRIBUTING.md": "# Contributing\n\nOpen a pull request with a clear description of the change.\n",
      ".github/SECURITY.md": "# Security\n\nReport issues to security@example.com.\n",
      ".github/CODE_OF_CONDUCT.md": "# Code Of Conduct\n\nBe respectful in every interaction.\n",
      "AGENTS.md": "# Agents\n\nFollow the repository conventions documented here.\n",
      "CLAUDE.md": "# Claude Instructions\n\nFollow the repository conventions documented here.\n",
    };
    for (const [relative, content] of Object.entries({ ...defaults, ...overrides })) {
      if (content === undefined) continue;
      const target = path.join(repoRoot, relative);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, content, "utf8");
    }
    cpSync(path.join(skillRoot, "knowledge", "words", "no-slop-writing.md"), path.join(fixtureSkillRoot, "knowledge", "words", "no-slop-writing.md"));
    return { repoRoot, skillRoot: fixtureSkillRoot };
  }

  const noSlopClean = writeNoSlopRoot("no-slop-clean");
  runScriptArgs(
    "no-slop passes on a synthetic clean front door",
    "check-no-slop.ts",
    ["--repo-root", noSlopClean.repoRoot, "--skill-root", noSlopClean.skillRoot],
    0,
  );

  const noSlopMissing = writeNoSlopRoot("no-slop-missing-file");
  rmSync(path.join(noSlopMissing.repoRoot, "CONTRIBUTING.md"));
  runScriptArgs(
    "no-slop fails when a declared front-door file is missing",
    "check-no-slop.ts",
    ["--repo-root", noSlopMissing.repoRoot, "--skill-root", noSlopMissing.skillRoot],
    1,
    "no_slop.front_door_missing",
  );

  const noSlopBannedReadme = writeNoSlopRoot("no-slop-banned-word-readme", {
    "README.md": "# Example\n\nThis tool leverages a robust workflow.\n",
  });
  runScriptArgs(
    "no-slop fails when the repo's own README uses a banned word",
    "check-no-slop.ts",
    ["--repo-root", noSlopBannedReadme.repoRoot, "--skill-root", noSlopBannedReadme.skillRoot],
    1,
    "no_slop.banned_word",
  );

  const noSlopPattern = writeNoSlopRoot("no-slop-pattern-throat-clearing", {
    "CONTRIBUTING.md": "# Contributing\n\nHere's the thing: open a pull request with a clear description.\n",
  });
  runScriptArgs(
    "no-slop fails on a mechanical slop pattern, not just banned words",
    "check-no-slop.ts",
    ["--repo-root", noSlopPattern.repoRoot, "--skill-root", noSlopPattern.skillRoot],
    1,
    "no_slop.pattern.throat_clearing",
  );

  // AGENTS.md and CLAUDE.md are maintainer-only guidance: the same banned word
  // that fails the gate on README.md only warns here, per no-slop-writing.md
  // §2's own documented tier split.
  const noSlopBannedAgents = writeNoSlopRoot("no-slop-banned-word-agents", {
    "AGENTS.md": "# Agents\n\nThis skill leverages a shared runtime.\n",
  });
  runScriptArgs(
    "no-slop demotes the same banned word to a warning on maintainer-only docs",
    "check-no-slop.ts",
    ["--repo-root", noSlopBannedAgents.repoRoot, "--skill-root", noSlopBannedAgents.skillRoot],
    0,
    "WARNING no_slop.banned_word",
  );

  // Empty adverbs/phrases are documented as advisory-only in every
  // no-slop-rules.ts consumer, never promoted to an error even on a
  // public-front-door file — this is the fixture that proves it.
  const noSlopAdverb = writeNoSlopRoot("no-slop-empty-adverb-readme", {
    "README.md": "# Example\n\nThis actually just describes what the project does.\n",
  });
  runScriptArgs(
    "no-slop keeps an empty adverb a warning even on a public front-door file",
    "check-no-slop.ts",
    ["--repo-root", noSlopAdverb.repoRoot, "--skill-root", noSlopAdverb.skillRoot],
    0,
    "WARNING no_slop.empty_adverb",
  );
}
