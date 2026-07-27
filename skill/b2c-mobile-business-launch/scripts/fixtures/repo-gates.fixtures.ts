import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Harness, skillRoot } from "./_harness.js";
import { auditExcludedScripts, buildAuditPlan, type AuditLayout } from "../lib/audit-plan.js";

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
    scripts[step.id] = step.id === "audit" ? "tsx scripts/run-audit.ts" : `tsx scripts/${step.id.replace(/:/g, "-")}.ts`;
  }
  for (const name of Object.keys(auditExcludedScripts)) {
    scripts[name] = `tsx scripts/${name.replace(/:/g, "-")}.ts`;
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
    audit: "tsx skill/pkg/scripts/run-audit.ts",
    "audit:ci": "tsx skill/pkg/scripts/run-audit.ts --ci",
  };
  const runtimeScripts = {
    ...planScripts("skill"),
    audit: "tsx scripts/run-audit.ts",
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

/**
 * Synthetic skill-root + templates-root pair for check-no-slop. The real banned-word list is
 * copied in rather than invented, so these fixtures fail if the reference and the matcher
 * ever stop agreeing. BRAND.md is a shipped surface, which makes every finding an error.
 */
function writeNoSlopRoots(root: string, brandCopy: string): { fixtureSkillRoot: string; fixtureTemplates: string } {
  const fixtureSkillRoot = path.join(root, "skill");
  mkdirSync(path.join(fixtureSkillRoot, "references"), { recursive: true });
  cpSync(path.join(skillRoot, "references", "no-slop-writing.md"), path.join(fixtureSkillRoot, "references", "no-slop-writing.md"));
  const fixtureTemplates = path.join(root, "templates");
  mkdirSync(fixtureTemplates, { recursive: true });
  writeFileSync(path.join(fixtureTemplates, "BRAND.md"), `# Brand\n\n${brandCopy}\n`, "utf8");
  return { fixtureSkillRoot, fixtureTemplates };
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

  // --- check-agent-entrypoints ---
  runScriptArgs("agent entrypoints pass on the shipped skill", "check-agent-entrypoints.ts", ["--skill-root", skillRoot], 0);
  const entrypointsEmpty = makeEmptyFixture("agent-entrypoints-empty-skill-root");
  runScriptArgs(
    "agent entrypoints fail when the shipped templates are missing",
    "check-agent-entrypoints.ts",
    ["--skill-root", entrypointsEmpty],
    1,
    "agent_entrypoints.template_agents.missing",
  );

  // --- check-workflow-adherence ---
  runScriptArgs("workflow adherence passes on the shipped skill", "check-workflow-adherence.ts", ["--skill-root", skillRoot], 0);
  const workflowEmpty = makeEmptyFixture("workflow-adherence-empty-skill-root");
  runScriptArgs(
    "workflow adherence fails when orchestration references are missing",
    "check-workflow-adherence.ts",
    ["--skill-root", workflowEmpty],
    1,
    "workflow.parallel_agent_reference.missing",
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
  mkdirSync(path.join(allowlistPair.parityScriptRoot, "scripts"), { recursive: true });
  writeFileSync(path.join(allowlistPair.parityScriptRoot, "scripts", "validate-project-state.ts"), "// stub\n", "utf8");
  writeFileSync(
    path.join(allowlistPair.parityScriptRoot, "scripts", "run-launchbench.ts"),
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

  // --- audit-skill-links ---
  const wireLinkRoot = (root: string): void => {
    mkdirSync(path.join(root, "references"), { recursive: true });
    mkdirSync(path.join(root, "templates"), { recursive: true });
    writeFileSync(path.join(root, "references", "guide.md"), "See [the template](../templates/artifact.md) for the artifact contract.\n", "utf8");
    writeFileSync(path.join(root, "templates", "artifact.md"), "# Artifact\nRouted from references/guide.md — keep both sides linked.\n", "utf8");
  };

  const linksClean = makeEmptyFixture("skill-links-clean");
  wireLinkRoot(linksClean);
  runScriptArgs("link audit passes on a wired reference/template pair", "audit-skill-links.ts", ["--skill-root", linksClean], 0);

  const linksBroken = makeEmptyFixture("skill-links-broken");
  wireLinkRoot(linksBroken);
  writeFileSync(path.join(linksBroken, "references", "guide.md"), "See [the template](../templates/missing.md); artifact.md still routes.\n", "utf8");
  runScriptArgs("link audit fails on a broken local link", "audit-skill-links.ts", ["--skill-root", linksBroken], 1, "skill_links.broken_local_link");

  const linksOrphan = makeEmptyFixture("skill-links-orphan");
  wireLinkRoot(linksOrphan);
  writeFileSync(path.join(linksOrphan, "references", "unrouted.md"), "No other file mentions this reference, so no agent can load it.\n", "utf8");
  runScriptArgs("link audit fails on an orphaned reference file", "audit-skill-links.ts", ["--skill-root", linksOrphan], 1, "skill_links.orphan_file");

  // Regression (verification pass): a basename that is a substring of another
  // mentioned file's basename ("lane.md" inside "sub-lane.md") is not a mention.
  const linksSubstringOrphan = makeEmptyFixture("skill-links-substring-orphan");
  wireLinkRoot(linksSubstringOrphan);
  writeFileSync(path.join(linksSubstringOrphan, "references", "lane.md"), "Nothing references this file by its own name.\n", "utf8");
  writeFileSync(
    path.join(linksSubstringOrphan, "references", "guide.md"),
    "See [the template](../templates/artifact.md); also read sub-lane.md notes.\n",
    "utf8",
  );
  writeFileSync(path.join(linksSubstringOrphan, "references", "sub-lane.md"), "Routed from references/guide.md.\n", "utf8");
  runScriptArgs("link audit flags a basename-substring orphan", "audit-skill-links.ts", ["--skill-root", linksSubstringOrphan], 1, "skill_links.orphan_file");

  const linksDuplicate = makeEmptyFixture("skill-links-duplicate");
  wireLinkRoot(linksDuplicate);
  const duplicateBody =
    "# Duplicate body\nThis exact content is shipped twice under templates/, which will drift apart silently over time once one copy is edited and the other is forgotten.\n";
  writeFileSync(path.join(linksDuplicate, "templates", "copy-one.md"), duplicateBody, "utf8");
  writeFileSync(path.join(linksDuplicate, "templates", "copy-two.md"), duplicateBody, "utf8");
  writeFileSync(
    path.join(linksDuplicate, "references", "guide.md"),
    "See [the template](../templates/artifact.md), plus copy-one.md and copy-two.md.\n",
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
  // mandated (references/landing-motion-craft.md); the same import outside
  // landing/ still fails above.
  const templateSafetyLanding = makeEmptyFixture("template-safety-landing-pack");
  mkdirSync(path.join(templateSafetyLanding, "landing", "sections"), { recursive: true });
  writeFileSync(
    path.join(templateSafetyLanding, "landing", "sections", "Hero.tsx"),
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
    ["--root", path.join(skillRoot, "templates"), "--out", path.join(skillRoot, "state", "workspace.generated.json"), "--check"],
    0,
  );

  // Aggregate mode: repeated --business dirs concatenate into one board over
  // the same per-business adapter. Distinct slugs render; colliding slugs fail
  // loudly instead of silently overlaying rows.
  const aggregateRoot = makeEmptyFixture("workspace-aggregate");
  const aggregateA = path.join(aggregateRoot, "business-a");
  const aggregateB = path.join(aggregateRoot, "business-b");
  cpSync(path.join(skillRoot, "templates"), aggregateA, { recursive: true });
  cpSync(path.join(skillRoot, "templates"), aggregateB, { recursive: true });
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
  cpSync(path.join(skillRoot, "templates"), aggregateDupA, { recursive: true });
  cpSync(path.join(skillRoot, "templates"), aggregateDupB, { recursive: true });
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
    ["--root", path.join(skillRoot, "templates"), "--out", staleWorkspacePath, "--check"],
    1,
    "business_workspace.output.drift",
  );

  // --- check-no-slop ---
  /**
   * Inflected banned words. The matcher's trailing boundary excluded letters until v0.26.1,
   * so "leverage" failed the gate and "leverages" walked straight through it: the same word
   * doing the same damage, waved past on one letter. Each fixture below carries the inflected
   * form ONLY, never the base word, so a passing run can only come from suffix tolerance.
   */
  const noSlopInflections: { label: string; copy: string; word: string }[] = [
    { label: "-ing after a dropped e", copy: "The copy engine leveraging a founder transcript beats copy written from a blank page.", word: "leverage" },
    { label: "-s", copy: "Onboarding that empowers the first session is the one worth shipping.", word: "empower" },
    { label: "-d on an e-final verb", copy: "The paywall streamlined into a single screen after the first round of testing.", word: "streamline" },
    { label: "-ies", copy: "Store copy reads as tapestries of adjectives instead of one plain promise.", word: "tapestry" },
    { label: "-s on a multi-word term", copy: "Two paradigm shifts in one release note is two too many.", word: "paradigm shift" },
  ];

  for (const inflection of noSlopInflections) {
    const roots = writeNoSlopRoots(makeEmptyFixture(`no-slop-inflection-${inflection.word.replace(/\s+/g, "-")}`), inflection.copy);
    runScriptArgs(
      `no-slop catches "${inflection.word}" inflected with ${inflection.label}`,
      "check-no-slop.ts",
      ["--skill-root", roots.fixtureSkillRoot, "--root", roots.fixtureTemplates],
      1,
      `"${inflection.word}" is banned`,
    );
  }

  /**
   * The other half of the contract. Suffix tolerance stops at the regular inflections, so a
   * word that merely starts with a banned word keeps its own meaning: an elevator is not an
   * elevation, and robustness is a property rather than the adjective the rules ban.
   */
  const noSlopNearMisses = writeNoSlopRoots(
    makeEmptyFixture("no-slop-near-misses"),
    "Write the elevator pitch first. Judge the robustness of a gate by what it catches. Utilization stays flat until the second session, and embarkation is a word nobody says out loud.",
  );
  runScriptArgs(
    "no-slop leaves words that only begin with a banned word alone",
    "check-no-slop.ts",
    ["--skill-root", noSlopNearMisses.fixtureSkillRoot, "--root", noSlopNearMisses.fixtureTemplates],
    0,
    "0 error(s)",
  );

  // --- check-founder-copy ---
  // The gate had zero fixture coverage: nothing proved it could fail.
  runScriptArgs(
    "founder copy passes on the shipped skill and templates",
    "check-founder-copy.ts",
    ["--root", path.join(skillRoot, "templates"), "--skill-root", skillRoot],
    0,
  );

  const founderCopyRawId = makeEmptyFixture("founder-copy-raw-identifier");
  writeFileSync(
    path.join(founderCopyRawId, "launch-cockpit.html"),
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
    path.join(founderCopyStaleNarrative, "PROJECT_STATE.yaml"),
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
  mkdirSync(path.join(founderCopyUnwired, "skill", "scripts", "lib"), { recursive: true });
  cpSync(path.join(skillRoot, "scripts", "lib", "founder-copy.ts"), path.join(founderCopyUnwired, "skill", "scripts", "lib", "founder-copy.ts"));
  writeFileSync(path.join(founderCopyUnwired, "skill", "scripts", "render-launch-cockpit.ts"), "// stub renderer with no beat wiring\n", "utf8");
  runScriptArgs(
    "renderer without celebration wiring fails founder copy",
    "check-founder-copy.ts",
    ["--root", founderCopyUnwired, "--skill-root", path.join(founderCopyUnwired, "skill")],
    1,
    "founder_copy.celebration_unwired",
  );

  /**
   * Backticks mean code in markdown and nothing at all in rendered HTML. A banned word
   * wrapped in backticks on an HTML surface reaches the founder's eyes verbatim, so the
   * gate must still catch it there — while the same span in a markdown surface stays out
   * of scope as code. One fixture per side pins the asymmetry.
   */
  const noSlopHtmlBackticks = writeNoSlopRoots(makeEmptyFixture("no-slop-html-backtick-banned-word"), "Plain brand copy with nothing banned.");
  writeFileSync(
    path.join(noSlopHtmlBackticks.fixtureTemplates, "onboarding.html"),
    "<html><body><p>We `leverage` your first session to unlock the plan.</p></body></html>\n",
    "utf8",
  );
  runScriptArgs(
    "no-slop catches a backtick-wrapped banned word on a shipped HTML surface",
    "check-no-slop.ts",
    ["--skill-root", noSlopHtmlBackticks.fixtureSkillRoot, "--root", noSlopHtmlBackticks.fixtureTemplates],
    1,
    '"leverage" is banned',
  );

  const noSlopMarkdownBackticks = writeNoSlopRoots(
    makeEmptyFixture("no-slop-markdown-backtick-code-span"),
    "The setup step runs `leverage --dry-run` before anything ships.",
  );
  runScriptArgs(
    "no-slop still exempts backtick code spans on markdown surfaces",
    "check-no-slop.ts",
    ["--skill-root", noSlopMarkdownBackticks.fixtureSkillRoot, "--root", noSlopMarkdownBackticks.fixtureTemplates],
    0,
    "0 error(s)",
  );

  // --- check-motion-contract ---
  // The real contract files are copied in rather than invented, so each failing
  // fixture is the shipped skill plus exactly one seeded drift — if the shipped
  // files and the parser ever stop agreeing, the passing fixture goes red too.
  const motionContractFiles = [
    "references/motion-craft-benchmarks.md",
    "references/premium-mobile-craft.md",
    "design-system/tokens.json",
    "design-system/DesignTokens.swift",
    "templates/design-system/tokens.json",
    "templates/design-system/DesignTokens.swift",
    "templates/design-system/PremiumCraft.swift",
    "references/experience-cards/peak-end-card.md",
    "references/experience-cards/mastery-and-status-card.md",
    "references/experience-cards/variable-reward-card.md",
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
    rel === "templates/design-system/tokens.json" ? text.replace('"durationBase": "220ms"', '"durationBase": "240ms"') : text,
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
}
