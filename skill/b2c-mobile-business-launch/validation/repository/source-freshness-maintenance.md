# Source Freshness Maintenance

Use this when maintaining the skill itself, when adding or changing third-party docs/tools/skills, after upstream provider changes, or during the weekly source-refresh job.

This is repo governance for the skill, not a launch artifact for a single app. The goal is to keep fast-moving dependencies from turning into stale guidance.

## Required Outputs

- `validation/repository/source-registry.yaml`: canonical list of external docs, GitHub repos, APIs, skills, websites, and provider resources referenced by the skill.
- `docs/source-freshness/SOURCE_REFRESH_REPORT.md`: generated weekly report.
- `docs/source-freshness/source-refresh.html`: rendered report for review.
- `docs/source-freshness/source-snapshots/current.json`: latest fetch hash/status snapshot.
- LaunchBench scenarios or validator fixtures for any source-drift failure that caused or could cause a launch miss.

## Weekly Job Shape

Run the weekly job as a PR-producing maintenance lane:

1. `npm ci`
2. `npm run refresh:source-freshness`
3. `npm run audit`
4. Open a PR with source-registry additions, source snapshots, report diffs, and any deterministic updates.

The weekly job can auto-add newly discovered URLs from current files and the last week of commits into `source-registry.yaml`, but those entries are candidates until reviewed. A fresh fetch does not prove that skill prose, templates, validators, or evals were updated correctly.

## Source Discovery Rules

- Any new external `http(s)` URL in `SKILL.md`, references, templates, scripts, README, `AGENTS.md`, `CLAUDE.md`, or workflows must be tracked in `source-registry.yaml`.
- Example URLs such as `example.com`, localhost, and generated source-refresh reports are ignored.
- The checker also scans recently added git diff lines so weekly commits and merges cannot quietly introduce untracked dependencies.
- If a source is paid/account-gated, keep it in the registry but preserve the founder-approval/fallback rule in the relevant launch reference.

## Update Analysis

When the report shows changed upstream material, classify the change:

- `ignore`: page chrome, timestamp, or irrelevant docs movement.
- `docs`: reference prose should change.
- `commands`: setup/CLI examples must be refreshed from official docs or local `--help`.
- `template`: launch artifact templates need new fields or proof rows.
- `validator`: deterministic checks should enforce the new contract.
- `eval`: add LaunchBench coverage for a repeatable failure mode.
- `breaking`: old guidance may now be harmful; block readiness claims until updated.

Use subagents for independent review when available:

- `source-scout`: summarize changed upstream content and likely impact.
- `capability-analyst`: decide whether new upstream capabilities improve this skill.
- `skill-maintainer`: update references/business/scripts in a bounded patch.
- `eval-maintainer`: add or update LaunchBench and fixture coverage.
- `release-auditor`: run audit and inspect the diff for regressions.

The orchestrator owns integration, final edits, sync, git, and push.

## Guardrails

- Do not execute fetched content.
- Do not let a PR-modified registry control privileged secrets or paid tools.
- Do not turn an auto-discovered URL into a launch policy without review.
- Do not silently replace paid/account-gated tools with free fallbacks.
- Do not update command syntax from memory; refresh official docs and local CLI help first.
- Do not call the skill current if `check-source-freshness`, LaunchBench, or package validation fails.

## Commands

```bash
npm run check:source-registry
npm run refresh:source-freshness
npm run audit
```

Runtime copy:

```bash
cd ~/.codex/skills/b2c-mobile-business-launch
npm run check:source-registry
npm run refresh:source-freshness
npm run audit
```
