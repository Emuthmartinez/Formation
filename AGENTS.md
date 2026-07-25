# AGENTS.md

This repo maintains the `b2c-mobile-business-launch` skill: source skill files, references, templates, validators, LaunchBench evals, package metadata, and installed runtime sync.

This file is for maintaining this skill repo itself. Do not copy these instructions into a launched business or generated app repo. Business repos created through the skill must get their own product-specific `AGENTS.md` and `CLAUDE.md` from the shipped templates, filled with the current app, stack, launch state, and source-of-truth docs.

New contributor (human or agent)? Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup, the CI gate, and PR expectations; this file is the deeper maintainer reference behind it.

## Repo Map

- `README.md`: public overview and maintainer commands.
- `skill/b2c-mobile-business-launch/SKILL.md`: skill entrypoint and progressive-disclosure routing.
- `skill/b2c-mobile-business-launch/skill-version.json`: installed-runtime freshness manifest.
- `skill/b2c-mobile-business-launch/references/`: detailed launch, provider, source freshness, and maintenance references.
- `skill/b2c-mobile-business-launch/state/`: Design Room seed state, theme tokens, and JSON schema.
- `skill/b2c-mobile-business-launch/render/`: React/Vite Design Room renderer; `scripts/render-design-room.ts` also writes the static fallback.
- `skill/b2c-mobile-business-launch/templates/`: reusable launch artifacts copied into app repos.
- `skill/b2c-mobile-business-launch/templates/app-archetypes/`: per-product-shape packs (`social-network`, `ai-chat-companion`, `habit-tracker`, `photo-ai-media`) — each a lane-routed prompt pack plus a runnable `starter/` scaffold, enforced by `check-app-archetype` and `check-archetype-starter`.
- `skill/b2c-mobile-business-launch/templates/repo-agent-entrypoints/`: business-repo `AGENTS.md` and `CLAUDE.md` templates that keep future agents on the launch skill workflow.
- `skill/b2c-mobile-business-launch/scripts/`: deterministic validators, renderers, LaunchBench harness, and source freshness tooling.
- `skill/b2c-mobile-business-launch/evals/launchbench/`: known failure-mode scenarios.
- `skill/b2c-mobile-business-launch/agents/openai.yaml`: UI metadata.

## First Reads

1. `README.md`
2. `skill/b2c-mobile-business-launch/SKILL.md`
3. Any directly relevant reference under `skill/b2c-mobile-business-launch/references/`
4. The script/template/eval files you will change

Use the skill-creator guidance when changing skill structure, trigger text, references, bundled scripts, or validation behavior.

Use Compound Engineering for non-trivial repo maintenance: check CE freshness (`ce-update` or latest-release fallback), use `ce-plan` or `ce-brainstorm` when scope or product/engineering direction is ambiguous, execute bounded work with `ce-work`, route isolated lanes through `ce-worktree` when useful, and finish behavior changes with CE review/test/proof skills where applicable. If CE is unavailable, record the fallback reason in the work summary and keep validator/eval coverage as the readiness gate.

When changing generated business-repo guidance, edit the shipped templates and validators under `skill/b2c-mobile-business-launch/` first; only update this root file for repo-maintenance practices.

## Agent Legibility

Keep this file as a concise map, not a duplicate manual. Put detailed launch policy in `SKILL.md` and `references/`, reusable generated output in `templates/`, and deterministic enforcement in `scripts/` plus LaunchBench. When an agent miss repeats, add or tighten a validator/eval instead of relying on a longer reminder.

## Commands

From repo root:

```bash
npm install
npm run audit
npm run launchbench
npm run test:validators
npm run check:source-registry
npm run check:agent-entrypoints
npm run check:founder-operator -- --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml
npm run check:workflow-adherence
npm run check:skill-version -- --source skill/b2c-mobile-business-launch --installed skill/b2c-mobile-business-launch
npm run check:version-discipline -- --repo-root . --skill-root skill/b2c-mobile-business-launch
npm run check:artifact-templates -- --skill-root skill/b2c-mobile-business-launch
npm run check:agent-evals
npm run check:compound-engineering -- --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml
npm run check:control-plane -- --root skill/b2c-mobile-business-launch/templates
npm run check:business-control-plane-workspace
npm run check:provider-proof -- --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml
npm run check:agent-operations -- --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml
npm run check:asc-command-contract -- --skill-root skill/b2c-mobile-business-launch
npm run check:mobai-proof -- --skill-root skill/b2c-mobile-business-launch --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml
npm run check:token-promotion -- --root skill/b2c-mobile-business-launch/templates
npm run check:template-safety
npm run check:onboarding -- --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml
npm run check:post-launch -- --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml
npm run check:google-play -- --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml
npm run check:backend-contract -- --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml
npm run check:analytics-catalog -- --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml
npm run check:app-archetype -- --skill-root skill/b2c-mobile-business-launch
npm run check:archetype-starter -- --skill-root skill/b2c-mobile-business-launch
npm run check:reference-size -- --skill-root skill/b2c-mobile-business-launch
npm run evals:behavioral -- --list
npm pack --dry-run --json
```

Runtime copy:

```bash
repo_root="$PWD"

rsync -a --delete --exclude node_modules \
  "$repo_root/skill/b2c-mobile-business-launch/" \
  ~/.codex/skills/b2c-mobile-business-launch/

(
  cd ~/.codex/skills/b2c-mobile-business-launch
  npm install
  npm run audit
  npm pack --dry-run --json
)

diff -qr --exclude node_modules \
  "$repo_root/skill/b2c-mobile-business-launch" \
  ~/.codex/skills/b2c-mobile-business-launch

ls -ld ~/.codex/skills/b2c-mobile-business-launch \
  ~/.claude/skills/b2c-mobile-business-launch \
  ~/.agents/skills/b2c-mobile-business-launch
```

## Runtime Sync

Edit the repo source first. Runtime sync applies only on the maintainer machine, where `~/.codex/skills/b2c-mobile-business-launch` exists: before claiming the skill is installed there, mirror the current checkout's `skill/b2c-mobile-business-launch/` into `~/.codex/skills/b2c-mobile-business-launch/`, run the runtime audit there, and verify the Claude/Agents symlinks (`~/.claude/skills/b2c-mobile-business-launch` and `~/.agents/skills/b2c-mobile-business-launch` point to the Codex runtime copy). In clones, CI, or cloud sessions without that installed copy, do not attempt runtime sync; `npm run audit:ci` is the readiness gate.

Broad launch/design/store/revenue/build work should first run `npm run check:skill-version -- --source skill/b2c-mobile-business-launch --installed ~/.codex/skills/b2c-mobile-business-launch` from the source repo, or the equivalent command from the installed runtime. If the installed copy is stale, use AskUserQuestion or a plain founder choice before continuing the original request.

## Source Freshness

New external URLs must be tracked in `skill/b2c-mobile-business-launch/references/source-registry.yaml`.

Use:

```bash
npm run check:source-registry
npm run refresh:source-freshness
```

For Doppler, PostHog, RevenueCat, Stripe, Resend, Apple/App Store Connect, Google Play, the in-app iOS Simulator surfaces (the Claude Code Desktop pane is in public beta and CLI computer use is a research preview, so their version, plan, and policy gates move fastest of all), XcodeBuildMCP, MobAI, Refero, Higgsfield, Fastlane, Remotion, and similar fast-moving tools, do not trust memory or old transcripts for command syntax. Refresh official docs or local CLI `--help`/version output before changing setup guidance.

The weekly freshness workflow may auto-add candidate URLs, but candidates are not accepted launch policy until reviewed and backed by reference/template/validator/eval updates when relevant.

## Subagents

Use subagents for independent bounded audits and disjoint implementation slices. The orchestrator owns integration, final edits, git, runtime sync, and final verification. Do not let subagent findings alone mark the skill ready.

Useful subagent lanes:

- source freshness scout
- ASC capability auditor
- validator/eval auditor
- template consistency auditor
- runtime install auditor

## Guardrails

- Do not commit secrets, provider keys, screenshots of credentials, `.p8`, `.p12`, `.mobileprovision`, or local `.env` values.
- Do not silently downgrade paid/account-gated tooling to free fallbacks.
- Do not update third-party command examples from memory.
- Do not add a new known miss as prose only; add a validator or LaunchBench scenario when deterministic coverage is possible.
- Do not call repo work complete until source audit, LaunchBench, validator fixtures, runtime sync, and git status are clean or blockers are explicit.
