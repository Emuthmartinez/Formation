import { cpSync, mkdirSync, writeFileSync } from "node:fs";
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
}
