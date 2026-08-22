/**
 * audit-plan.ts — the single source of truth for the maintainer audit pipeline.
 *
 * Both `npm run audit` / `npm run audit:ci` (repo root) and `npm run audit`
 * (installed skill runtime) execute tooling/run-audit.ts, which builds its
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
    "requires a generated business repo with a deployed landing funnel; the shipped templates contain no deployable funnel (workspace/business/growth/landing/ is a section component library, deliberately not site-shaped, and the validator's scope check ignores it)",
  "check:source-freshness": "alias of check:source-registry (same script and registry); running both would duplicate the step",
  "check:onboarding-page-fresh":
    "a --page-scoped invocation of check:generated-pages (already an audit step) for product/onboarding.html only, used as ONB-22's own catalog gate so its acceptance does not depend on an unrelated page elsewhere in the manifest; running the repo-wide check:generated-pages step already covers this page too, so running both in the general audit would duplicate the step",
  "test:validators": "executed by the launchbench step, which lints scenario definitions and then runs the validator fixture suite",
  "check:onboarding-cutover-repository-complete":
    "a strict --require-resolved wrapper around check:onboarding-cutover-repository (already an audit step), used only as ONB-22's own catalog gate; the shipped template's Deletion Manifest row deliberately keeps the unresolved disposition option list, so running this in the general audit would always fail",
  "check:onboarding-graph-complete":
    "a strict --require-done wrapper around check:onboarding-graph (already an audit step), used only as ONB-22's own catalog gate; the shipped onboarding template is deliberately not marked done, so running this in the general audit would always fail",
  "check:provider-proof-onboarding":
    "a --providers-scoped invocation of check:provider-proof (already an audit step) for PostHog/RevenueCat only, used as ONB-22's own catalog gate so its acceptance does not depend on an unrelated provider row (Resend, App Store Connect, Sentry, ...) elsewhere in operations/PROVIDER_PROOF.md; running the repo-wide check:provider-proof step already covers this file too, so running both in the general audit would duplicate the step",
  "check:onboarding-evidence-onb-00":
    "ONB-00's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-01":
    "ONB-01's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-02":
    "ONB-02's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-03":
    "ONB-03's own catalog gate: verifies that specific node's own output packet (product/onboarding/graph/ONB-03-current-guidance.md), which only exists once a durable run has actually produced it; the shipped template has never run the onboarding graph, so this always fails in the general audit",
  "check:onboarding-evidence-onb-04":
    "ONB-04's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-05":
    "ONB-05's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-06":
    "ONB-06's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-07":
    "ONB-07's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-08":
    "ONB-08's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-20":
    "ONB-20's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-21":
    "ONB-21's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-09":
    "ONB-09's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-10":
    "ONB-10's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-11":
    "ONB-11's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-12":
    "ONB-12's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-13":
    "ONB-13's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-14":
    "ONB-14's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-15":
    "ONB-15's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-16":
    "ONB-16's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-18":
    "ONB-18's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-17":
    "ONB-17's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
  "check:onboarding-evidence-onb-19":
    "ONB-19's own catalog gate; same rationale as check:onboarding-evidence-onb-03 -- its output packet does not exist until a durable run produces it",
};

/** Relative business-artifact root for the layout. */
function templatesRoot(layout: AuditLayout): string {
  return layout === "repo" ? "skill/formation/workspace/business" : "workspace/business";
}

/** Relative skill root for the layout. */
function skillRoot(layout: AuditLayout): string {
  return layout === "repo" ? "skill/formation" : ".";
}

/**
 * Ordered audit pipeline. The order mirrors the original audit script chains:
 * typecheck first, repo/skill structure gates, scenario lint + fixtures, then
 * the template-state gates, then renderers.
 *
 * `roots` overrides where the business artifacts and skill live — the session runner
 * (core/session/run.ts) reuses this plan as the single source of truth for each gate's
 * canonical argument shape when it runs a node's gates against a real business workspace.
 * Before that reuse existed, the runner passed only a BUSINESS_ROOT env var, and every gate
 * whose CLI takes --root/--state either failed against the wrong directory or — worse —
 * silently validated the skill's own reference workspace instead of the business under test.
 */
export function buildAuditPlan(layout: AuditLayout, roots?: { businessRoot?: string; skillRoot?: string }): AuditStep[] {
  const T = roots?.businessRoot ?? templatesRoot(layout);
  const S = roots?.skillRoot ?? skillRoot(layout);
  const stateArgs = ["--root", T, "--state", "state/PROJECT_STATE.yaml"];
  const rootArgs = ["--root", T];

  const steps: AuditStep[] = [
    { id: "tsc", kind: "tsc" },
    { id: "lint:format", kind: "shell" },
    { id: "validate:skill", kind: "shell", ciSkip: true },
    { id: "audit:links", kind: "script" },
    { id: "check:source-registry", kind: "script" },
    { id: "check:asc-command-contract", kind: "script", args: ["--skill-root", S] },
    { id: "check:motion-contract", kind: "script", args: ["--skill-root", S, "--workspace-root", T] },
    { id: "check:scrollytelling", kind: "script", args: ["--skill-root", S, "--workspace-root", T] },
    { id: "check:mobai-proof", kind: "script", args: ["--skill-root", S, ...stateArgs] },
    { id: "check:source-checkpoint", kind: "script", args: rootArgs },
    { id: "check:continuity-contract", kind: "script" },
    { id: "check:autopilot", kind: "script" },
    { id: "check:skill-version", kind: "script", args: ["--source", S, "--installed", S] },
    {
      id: "check:version-discipline",
      kind: "script",
      args: layout === "repo" ? ["--repo-root", ".", "--skill-root", S] : ["--skill-root", S],
    },
    { id: "check:adapter-contract", kind: "script" },
    { id: "check:package-parity", kind: "script", repoOnly: true },
    { id: "check:artifact-templates", kind: "script", args: ["--skill-root", S] },
    { id: "check:generated-pages", kind: "script", args: rootArgs },
    { id: "check:app-archetype", kind: "script", args: ["--skill-root", S] },
    { id: "check:archetype-starter", kind: "script", args: ["--skill-root", S] },
    { id: "check:reference-size", kind: "script", args: ["--skill-root", S] },
    { id: "check:hub-spoke", kind: "script", args: ["--skill-root", S] },
    { id: "check:learning-grounding", kind: "script", args: ["--skill-root", S] },
    { id: "check:catalog", kind: "script", args: ["--skill-root", S] },
    { id: "catalog:render-routing", kind: "script", args: ["--check", "--skill-root", S] },
    { id: "check:gates-layout", kind: "script", args: ["--skill-root", S] },
    { id: "check:validator-docs", kind: "script", args: ["--repo-root", "."], repoOnly: true },
    { id: "check:agent-evals", kind: "script" },
    { id: "launchbench", kind: "script", serial: true },
    // U9's v2 verification surface (fixture suites, capability-boundary suites, cross-runtime
    // parity suite). Each spawns many of its own tsx subprocesses internally, so — like
    // launchbench above — it runs serially rather than sharing the concurrency pool with the
    // lighter single-shot validators.
    { id: "test:fixtures", kind: "script", serial: true },
    { id: "test:boundaries", kind: "script", serial: true },
    { id: "test:parity", kind: "script", serial: true },
    // The engine's crash-test dummy: bootstrap a throwaway copy of the reference business, drive
    // two fixture-executor sessions (with the founder-approval edge between them), prove the
    // fresh-context verifier sweep accepts work, and prove the verifier-off control still parks
    // it. Spawns its own session subprocesses, so it runs serially like the suites above; repo
    // layout only, since it copies workspace/business out of the source tree.
    { id: "check:engine-e2e", kind: "script", serial: true, repoOnly: true },
    { id: "validate:launch-state", kind: "script", args: stateArgs },
    { id: "validate:design-state", kind: "script", args: rootArgs },
    { id: "check:design-room", kind: "script", args: rootArgs },
    { id: "check:control-plane", kind: "script", args: rootArgs },
    { id: "check:business-control-plane-workspace", kind: "script" },
    { id: "check:token-promotion", kind: "script", args: rootArgs },
    { id: "check:vibecoded-tells", kind: "script", args: rootArgs },
    { id: "check:template-safety", kind: "script" },
    { id: "check:founder-copy", kind: "script", args: [...rootArgs, "--skill-root", S] },
    { id: "check:app-copy", kind: "script", args: [...stateArgs, "--skill-root", S] },
    {
      id: "check:no-slop",
      kind: "script",
      // The installed skill package deliberately does not ship Formation's
      // repository-level front-door files. LaunchBench still exercises the
      // checker's synthetic positive and negative controls in both layouts.
      args: layout === "repo" ? ["--skill-root", S] : ["--skill-root", S, "--skip-repo-front-door"],
    },
    { id: "check:documentation-ste100", kind: "script", args: ["--skill-root", S] },
    { id: "check:founder-operator", kind: "script", args: stateArgs },
    { id: "check:agent-operations", kind: "script", args: stateArgs },
    { id: "check:provider-proof", kind: "script", args: stateArgs },
    { id: "check:compound-engineering", kind: "script", args: stateArgs },
    { id: "check:security", kind: "script", args: stateArgs },
    { id: "check:privacy", kind: "script", args: stateArgs },
    { id: "check:content-assets", kind: "script", args: stateArgs },
    { id: "check:paid-ua", kind: "script", args: stateArgs },
    { id: "check:apple-requirements", kind: "script", args: stateArgs },
    { id: "check:store-console", kind: "script", args: stateArgs },
    { id: "check:store-screenshots", kind: "script", args: stateArgs },
    { id: "check:native-ios", kind: "script", args: stateArgs },
    { id: "check:orchestration", kind: "script", args: stateArgs },
    { id: "check:emotional-design", kind: "script", args: stateArgs },
    { id: "check:onboarding-graph", kind: "script", args: stateArgs },
    { id: "check:onboarding-cutover-repository", kind: "script", args: rootArgs },
    { id: "check:attribution", kind: "script", args: stateArgs },
    { id: "check:secrets", kind: "script", args: stateArgs },
    { id: "check:lane-coverage", kind: "script", args: stateArgs },
    { id: "check:change-cascade", kind: "script", args: [...stateArgs, "--skill-root", S] },
    { id: "check:research", kind: "script", args: stateArgs },
    { id: "check:revenue", kind: "script", args: stateArgs },
    { id: "check:email", kind: "script", args: stateArgs },
    { id: "check:analytics-catalog", kind: "script", args: stateArgs },
    { id: "check:post-launch", kind: "script", args: stateArgs },
    { id: "check:portfolio-registry", kind: "script", args: rootArgs },
    { id: "check:backend-contract", kind: "script", args: stateArgs },
    {
      id: "render:launch-cockpit",
      kind: "script",
      args: [...stateArgs, "--out", "/tmp/b2c-state/launch-cockpit.html"],
    },
    {
      id: "render:design-room",
      kind: "script",
      args: [...rootArgs, "--out", "/tmp/b2c-design/design-room.html", "--static-only"],
    },
  ];

  return layout === "repo" ? steps : steps.filter((step) => !step.repoOnly);
}
