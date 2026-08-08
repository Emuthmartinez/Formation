import { workflow } from "./helpers.js";

/**
 * Ported from runtime/graph/workflows/maintenance.ts. All seven are domain.machine —
 * skill-maintenance, never founder-grantable (operator.maintainer is a human role, not a
 * business unit) — so catalog/bridge.ts's toCatalogInput() excludes them from the
 * dispatchable CatalogInput for the same reason it excludes domain.process/orchestration.
 */
export const workflows = [
  workflow({
    id: "workflow.machine.runtime-freshness-gate-consumer-side",
    title: "Runtime freshness gate (consumer side)",
    domainId: "domain.machine",
    areaIds: ["area.skill-maintenance"],
    trigger: "Before substantial launch/design/store/revenue/build work when the installed runtime may be behind source",
    outputPaths: ["skill-version.json"],
    gates: ["check:skill-version"],
    actionClass: "observe",
    idempotent: true,
  }),
  workflow({
    id: "workflow.machine.source-freshness-maintenance-maintainer",
    title: "Source-freshness maintenance (maintainer)",
    domainId: "domain.machine",
    areaIds: ["area.skill-maintenance"],
    trigger: "Maintaining the skill, adding external URLs, refreshing third-party docs/commands",
    outputPaths: ["validation/repository/source-registry.yaml"],
    gates: ["check:source-registry"],
    actionClass: "mutate",
    idempotent: true,
  }),
  workflow({
    id: "workflow.machine.skill-runtime-sync-and-version-discipline-maintainer",
    title: "Skill runtime sync & version discipline (maintainer)",
    domainId: "domain.machine",
    areaIds: ["area.skill-maintenance"],
    trigger: "After any skill change — bump version, sync the installed runtime, run the readiness gate",
    dependencies: ["workflow.machine.source-freshness-maintenance-maintainer"],
    // outputPaths intentionally empty: bumps skill-version.json, which
    // workflow.machine.runtime-freshness-gate-consumer-side already owns as its output.
    gates: ["check:version-discipline", "check:skill-version"],
    actionClass: "mutate",
    idempotent: true,
  }),
  workflow({
    id: "workflow.machine.founder-language-translation-maintainer",
    title: "Founder-language translation (maintainer)",
    domainId: "domain.machine",
    areaIds: ["area.skill-maintenance"],
    trigger: "Adding or renaming a lane, status, phase, autonomy mode, or provider route; any founder-visible surface change",
    dependencies: ["workflow.words.writing-quality-no-slop"],
    outputPaths: ["tooling/lib/founder-copy.ts"],
    gates: ["check:founder-copy"],
    actionClass: "mutate",
    idempotent: true,
  }),
  workflow({
    id: "workflow.machine.skill-triggering-contract-maintainer",
    title: "Skill triggering contract (maintainer)",
    domainId: "domain.machine",
    areaIds: ["area.skill-maintenance"],
    trigger: "Changing SKILL.md frontmatter, the skill description, or the trigger phrasing",
    outputPaths: ["SKILL.md"],
    gates: ["check:autopilot"],
    actionClass: "mutate",
    idempotent: true,
  }),
  workflow({
    id: "workflow.machine.asc-command-contract-maintainer",
    title: "ASC command contract (maintainer)",
    domainId: "domain.machine",
    areaIds: ["area.skill-maintenance"],
    trigger: "Before changing any documented asc command in knowledge/store/app-store-connect-cli.md",
    laneIds: ["store_console"],
    dependencies: ["workflow.store.asc-cli-automation"],
    outputPaths: ["knowledge/store/app-store-connect-cli.md"],
    gates: ["check:asc-command-contract"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.machine.definition-graph-maintenance",
    title: "Definition graph maintenance",
    domainId: "domain.machine",
    areaIds: ["area.skill-maintenance"],
    trigger: "Changing a domain, workflow, phase, lane, artifact, gate, reference, or generated catalog projection",
    outputPaths: ["catalog/generated/routing.md", "catalog/generated/spine.md"],
    // Points at THIS unit's own gates (check:catalog / catalog:render-routing), not v1's
    // check:skill-graph / render:skill-graph — the port ledger marks check-skill-graph.ts
    // "port" precisely because catalog/validate.ts + catalog/render-routing.ts is its
    // replacement, shipped in this same unit.
    gates: ["check:catalog", "catalog:render-routing"],
    actionClass: "mutate",
    idempotent: true,
  }),
  workflow({
    id: "workflow.machine.eval-suite-execution-maintainer",
    title: "Eval suite execution (maintainer)",
    domainId: "domain.machine",
    areaIds: ["area.skill-maintenance"],
    // domain.machine's own routeWhen names "evals" as a pillar, but no workflow owned it —
    // the suites ran inside `npm run audit` with no dispatchable node a maintainer session
    // could point at. launchbench cannot appear in gates below: discoverGates() only picks
    // up check:/validate:/render:/catalog:-prefixed scripts, and launchbench is named for
    // the aggregate harness it runs seriously as its own audit step, not a narrow check.
    // evals:behavioral (live-agent runs against a real model) is excluded from gates for a
    // different reason — cost and run-to-run variance make it unfit as a merge gate — and
    // is run by hand when a live behavioral signal is actually needed, never automatically.
    trigger:
      "Adding, removing, or renaming a validator, a LaunchBench scenario, or an agent-behavior eval; before trusting that any of them still catch what they claim to. Also run `npm run launchbench` (scenario lint + validator fixture suite) directly, and `npm run evals:behavioral` by hand when a live-agent signal is worth the cost and variance.",
    outputPaths: ["validation/repository/evals/launchbench/", "validation/repository/evals/agent-behavior/"],
    gates: ["check:agent-evals"],
    actionClass: "observe",
    idempotent: true,
  }),
] as const;
