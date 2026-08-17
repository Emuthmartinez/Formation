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
    instructions:
      "Read the installed skill-version.json and compare it against the latest source copy (local checkout, or the pushed raw-GitHub manifest when internet access is available). check:skill-version must return nonzero when installed trails source — that nonzero is the signal this gate exists to produce. If the installed runtime is stale, stop before continuing the original request and ask the founder via AskUserQuestion (or plain text if unavailable) whether to sync now or continue on the installed copy; never continue on a stale runtime silently. Record whichever answer the founder gives, then resume the original request.",
    reads: ["skill-version.json"],
    roleId: "role.orchestrator",
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
    instructions:
      "Scan SKILL.md, references, templates, scripts, README, AGENTS.md/CLAUDE.md, workflows, and the last week of commits for new http(s) URLs, and register every real one (not example.com/localhost/generated reports) as a row in validation/repository/source-registry.yaml — a canonical list, not prose. When a weekly report shows changed upstream material, classify it (ignore/docs/commands/template/validator/eval/breaking) and route the fix to the matching layer instead of hand-waving a summary. Never execute fetched content, never let an auto-discovered URL become launch policy without review, and never silently swap a paid/account-gated source for a free fallback. check:source-registry passes only when every URL actually used in the tracked files above has a registry row; run npm run refresh:source-freshness then npm run audit as the acceptance loop.",
    reads: ["SKILL.md", "validation/repository/source-registry.yaml"],
    roleId: "role.engineering-leader",
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
    instructions:
      "After any meaningful skill-behavior edit, bump skill-version.json and write matching release notes in the same change — check:version-discipline fails a change that edits behavior without moving the version alongside it. On a founder-approved sync, rsync (excluding node_modules, with --delete) the skill directory into the installed runtime copy, run npm install and npm run audit inside that runtime, then diff -qr the two trees to prove they match. check:skill-version must report installed == source afterward; also verify the ~/.claude and ~/.agents skill symlinks still resolve to the same synced Codex runtime copy on this machine.",
    reads: ["skill-version.json"],
    roleId: "role.engineering-leader",
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
    instructions:
      'Add or update the founder-visible label and one-line blurb in tooling/lib/founder-copy.ts for every new or renamed lane, status, phase, autonomy mode, or provider route — this file is the only sanctioned path from machine state (lane ids, status enums, phase codes, route enums) to text a founder reads. Labels are sentence case, plain language, and free of internal vocabulary; never put an identifier, enum value, or tool name in a label, and keep the explanation in the blurb. check:founder-copy fails when a value in launch-state.ts has no matching label here, so add both in the same commit — the failure mode this guards is a founder reading raw machine state like "paid_tool_routing | not_started" on their own dashboard. One deliberate exception (check-founder-copy.ts Rule 4): the twelve Experience Card technique names are kept verbatim in lane blurbs, never translated into friendlier language.',
    reads: ["tooling/lib/founder-copy.ts"],
    roleId: "role.orchestrator",
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
    instructions:
      "Edit SKILL.md's YAML frontmatter description whenever the skill's claimed scope changes, or a lane/status/phase/autonomy mode/provider route is added or renamed enough to shift what requests should route here. check:autopilot (check-autopilot-contract.ts) validates the frontmatter against validation/repository/evals/triggering/autopilot-triggering.yaml: the description must exist, parse as valid frontmatter, stay at or under the eval's max_chars, contain every required_terms entry, carry no angle brackets, and its should_trigger/should_not_trigger cases must still hold. The decision that matters is whether the description still accurately routes the requests it should and excludes the ones it should not — an untested trigger phrasing is capability nothing routes to. Write the description in the flat STE100 register per technical-documentation-ste100.md: one meaning per word, active voice, simple tense, sentences at or under 20 words.",
    reads: ["SKILL.md"],
    roleId: "role.product-leader",
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
    instructions:
      "Before storing any asc command as executable guidance in knowledge/store/app-store-connect-cli.md, refresh it against local `asc --help`/skill-pack help and the current official Apple/Rork docs — never update command syntax from memory. check:asc-command-contract fails closed when a known-invalid command family (e.g. `asc apps get`, `asc validate app-store-version`) still appears anywhere in stored guidance, and separately checks that current commands (e.g. `asc apps view`) are the ones documented. When upstream CLI or skill-pack docs change but stale snippets remain, that is the `asc-command-guidance-stale` failure card — fix the reference, any evals, and business templates in the same change, not just this one file.",
    reads: ["knowledge/store/app-store-connect-cli.md"],
    roleId: "role.engineering-leader",
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
    instructions:
      "Edit the authored catalog data when adding, renaming, or rewiring graph definitions. Add knowledge through catalog/knowledge manifests and the knowledge commands. Keep every existing catalog ID stable when a path moves. Never hand-edit generated routing or spine files. Run knowledge:check and check:catalog. Regenerate routing, then confirm catalog:render-routing -- --check passes.",
    reads: ["catalog/generated/routing.md", "catalog/generated/spine.md"],
    // No referenceIds: this node edits structured catalog TS data and regenerates projections;
    // its doctrine lives in the validators it must pass, and the documentation-register
    // reference belongs to the nodes that write prose surfaces, not this one.
    roleId: "role.orchestrator",
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
    instructions:
      "When a validator, LaunchBench scenario, or agent-behavior eval is added, removed, or renamed — or after any repeated real-world miss — add or update the scenario/fixture under validation/repository/evals/launchbench/ or evals/agent-behavior/ so the same miss cannot recur silently. Keep the deterministic/behavioral split honest: `npm run launchbench` is a scenario-definition lint plus the deterministic validator-fixture suite only, never live-agent execution, and must not be described as behavioral coverage; `npm run evals:behavioral` is the separate live-agent run against the opt-in `behavioral: true` flagship subset, advisory and cost/variance-bearing, never PR-gating. check:agent-evals is the wired gate; the flagship set (stale-installed-skill-runtime, live-provider-proof-missing, post-launch-ops-runbook-missing, launch-tier-overproduction, monetization-cozy-default-stack-unexamined, founder-zero-operator-skipped, founder-gate-jargon-without-choice) must keep `behavioral: true` — the launchbench lint enforces that this list cannot silently shrink.",
    reads: ["validation/repository/evals/launchbench/", "validation/repository/evals/agent-behavior/"],
    roleId: "role.engineering-leader",
    outputPaths: ["validation/repository/evals/launchbench/", "validation/repository/evals/agent-behavior/"],
    gates: ["check:agent-evals"],
    actionClass: "observe",
    idempotent: true,
  }),
] as const;
