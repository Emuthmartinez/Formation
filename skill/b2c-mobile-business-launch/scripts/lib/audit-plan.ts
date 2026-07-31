/**
 * audit-plan.ts — the single source of truth for the maintainer audit pipeline.
 *
 * Both `npm run audit` / `npm run audit:ci` (repo root) and `npm run audit`
 * (installed skill runtime) execute scripts/run-audit.ts, which builds its
 * step list from this module. check-package-parity.ts imports the same plan
 * to verify that every gate-shaped npm script (check:*, validate:*,
 * launchbench, audit:links) is either a step here or explicitly excluded
 * with a reason — so a validator can no longer be silently dropped from the
 * pipeline by editing one of several near-identical shell strings.
 */

export type AuditLayout = "repo" | "skill";

export interface AuditStep {
  /** npm script name in the governing package.json, or a special kind id. */
  id: string;
  /**
   * - "script": resolve package.json scripts[id] (must start with "tsx ") and spawn tsx directly.
   * - "shell": run package.json scripts[id] through a shell (env-dependent steps like validate:skill).
   * - "tsc": run the TypeScript no-emit typecheck (npm exec tsc -- --noEmit equivalent).
   */
  kind: "script" | "shell" | "tsc";
  /** Extra args appended after the script's own args (the old `npm run x -- <args>` tail). */
  args?: string[];
  /** Skipped when running with --ci (maintainer-machine-only steps). */
  ciSkip?: boolean;
  /** Only part of the repo-root pipeline (script does not exist in the runtime package). */
  repoOnly?: boolean;
  /**
   * Must not run inside the concurrency pool (spawns its own heavy process
   * tree, e.g. the launchbench fixture suite).
   */
  serial?: boolean;
}

/**
 * Gate-shaped npm scripts that are deliberately NOT part of the audit
 * pipeline. Every entry needs a concrete reason; check-package-parity fails
 * when a "check:" or "validate:" script is neither a step nor listed here.
 */
export const auditExcludedScripts: Record<string, string> = {
  "check:landing-funnel":
    "requires a generated business repo with a deployed landing funnel; the shipped templates contain no deployable funnel (business/landing/ is a section component library, deliberately not site-shaped, and the validator's scope check ignores it)",
  "check:source-freshness": "alias of check:source-registry (same script and registry); running both would duplicate the step",
  "test:validators": "executed by the launchbench step, which lints scenario definitions and then runs the validator fixture suite",
};

/** Relative business-artifact root for the layout. */
function templatesRoot(layout: AuditLayout): string {
  return layout === "repo" ? "skill/b2c-mobile-business-launch/business" : "business";
}

/** Relative skill root for the layout. */
function skillRoot(layout: AuditLayout): string {
  return layout === "repo" ? "skill/b2c-mobile-business-launch" : ".";
}

/**
 * Ordered audit pipeline. The order mirrors the original audit script chains:
 * typecheck first, repo/skill structure gates, scenario lint + fixtures, then
 * the template-state gates, then renderers.
 */
export function buildAuditPlan(layout: AuditLayout): AuditStep[] {
  const T = templatesRoot(layout);
  const S = skillRoot(layout);
  const stateArgs = ["--root", T, "--state", "PROJECT_STATE.yaml"];
  const rootArgs = ["--root", T];

  const steps: AuditStep[] = [
    { id: "tsc", kind: "tsc" },
    { id: "lint:format", kind: "shell" },
    { id: "validate:skill", kind: "shell", ciSkip: true },
    { id: "audit:links", kind: "script" },
    { id: "check:source-registry", kind: "script" },
    { id: "check:asc-command-contract", kind: "script", args: ["--skill-root", S] },
    { id: "check:motion-contract", kind: "script", args: ["--skill-root", S] },
    { id: "check:mobai-proof", kind: "script", args: ["--skill-root", S, ...stateArgs] },
    { id: "check:agent-entrypoints", kind: "script" },
    // Template mode only: --root is deliberately omitted. The pipeline's --root
    // is business/, which is not a business repo, so an installation
    // assertion there would pass vacuously. This step proves the shipped hook
    // payload is well-formed and reinstallable; installation itself is checked
    // against a real repo with --root.
    { id: "check:hooks-installed", kind: "script", args: ["--skill-root", S] },
    { id: "check:workflow-adherence", kind: "script" },
    { id: "check:continuity-contract", kind: "script" },
    { id: "check:autopilot", kind: "script" },
    { id: "check:skill-version", kind: "script", args: ["--source", S, "--installed", S] },
    {
      id: "check:version-discipline",
      kind: "script",
      args: layout === "repo" ? ["--repo-root", ".", "--skill-root", S] : ["--skill-root", S],
    },
    { id: "check:package-parity", kind: "script", repoOnly: true },
    { id: "check:artifact-templates", kind: "script", args: ["--skill-root", S] },
    { id: "check:generated-pages", kind: "script", args: rootArgs },
    { id: "check:app-archetype", kind: "script", args: ["--skill-root", S] },
    { id: "check:archetype-starter", kind: "script", args: ["--skill-root", S] },
    { id: "check:reference-size", kind: "script", args: ["--skill-root", S] },
    { id: "check:gates-layout", kind: "script", args: ["--skill-root", S] },
    { id: "check:agent-evals", kind: "script" },
    { id: "launchbench", kind: "script", serial: true },
    { id: "validate:launch-state", kind: "script", args: stateArgs },
    { id: "validate:design-state", kind: "script", args: rootArgs },
    { id: "check:design-room", kind: "script", args: rootArgs },
    { id: "check:control-plane", kind: "script", args: rootArgs },
    { id: "check:business-control-plane-workspace", kind: "script" },
    { id: "check:token-promotion", kind: "script", args: rootArgs },
    { id: "check:template-safety", kind: "script" },
    { id: "check:founder-copy", kind: "script", args: [...rootArgs, "--skill-root", S] },
    { id: "check:no-slop", kind: "script", args: [...rootArgs, "--skill-root", S, "--repo-root", "."] },
    { id: "check:app-copy", kind: "script", args: [...stateArgs, "--skill-root", S] },
    { id: "check:founder-operator", kind: "script", args: stateArgs },
    { id: "check:agent-operations", kind: "script", args: stateArgs },
    { id: "check:provider-proof", kind: "script", args: stateArgs },
    { id: "check:compound-engineering", kind: "script", args: stateArgs },
    { id: "check:ux-patterns", kind: "script", args: stateArgs },
    { id: "check:onboarding", kind: "script", args: stateArgs },
    { id: "check:11-star", kind: "script", args: stateArgs },
    { id: "check:security", kind: "script", args: stateArgs },
    { id: "check:content-assets", kind: "script", args: stateArgs },
    { id: "check:viral-growth", kind: "script", args: stateArgs },
    { id: "check:launch-narrative", kind: "script", args: stateArgs },
    { id: "check:paid-ua", kind: "script", args: stateArgs },
    { id: "check:apple-signing", kind: "script", args: stateArgs },
    { id: "check:apple-requirements", kind: "script", args: stateArgs },
    { id: "check:store-console", kind: "script", args: stateArgs },
    { id: "check:store-screenshots", kind: "script", args: stateArgs },
    { id: "check:native-ios", kind: "script", args: stateArgs },
    { id: "check:orchestration", kind: "script", args: stateArgs },
    { id: "check:emotional-design", kind: "script", args: stateArgs },
    { id: "check:attribution", kind: "script", args: stateArgs },
    { id: "check:secrets", kind: "script", args: stateArgs },
    { id: "check:aso-metadata", kind: "script", args: stateArgs },
    { id: "check:localization-research", kind: "script", args: stateArgs },
    { id: "check:paid-tool-decisions", kind: "script", args: stateArgs },
    { id: "check:lane-coverage", kind: "script", args: stateArgs },
    { id: "check:change-cascade", kind: "script", args: [...stateArgs, "--skill-root", S] },
    { id: "check:research", kind: "script", args: stateArgs },
    { id: "check:product-spec", kind: "script", args: stateArgs },
    { id: "check:launch-trace", kind: "script", args: stateArgs },
    { id: "check:privacy-terms", kind: "script", args: stateArgs },
    { id: "check:revenue", kind: "script", args: stateArgs },
    { id: "check:email", kind: "script", args: stateArgs },
    { id: "check:analytics-catalog", kind: "script", args: stateArgs },
    { id: "check:post-launch", kind: "script", args: stateArgs },
    { id: "check:portfolio-registry", kind: "script", args: rootArgs },
    { id: "check:google-play", kind: "script", args: stateArgs },
    { id: "check:backend-contract", kind: "script", args: stateArgs },
    {
      id: "render:launch-cockpit",
      kind: "script",
      args: [...stateArgs, "--out", "/tmp/b2c-launch-cockpit.html"],
    },
    {
      id: "render:design-room",
      kind: "script",
      args: [...rootArgs, "--out", "/tmp/b2c-design-room.html", "--static-only"],
    },
  ];

  return layout === "repo" ? steps : steps.filter((step) => !step.repoOnly);
}
