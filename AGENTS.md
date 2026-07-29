# AGENTS.md

This repo maintains the `b2c-mobile-business-launch` skill: source skill files, references, templates, validators, LaunchBench evals, package metadata, and installed runtime sync.

This file is for maintaining this skill repo itself. Do not copy these instructions into a launched business or generated app repo. Business repos created through the skill must get their own product-specific `AGENTS.md` and `CLAUDE.md` from the shipped templates, filled with the current app, stack, launch state, and source-of-truth docs.

New contributor (human or agent)? Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup, the CI gate, and PR expectations; this file is the deeper maintainer reference behind it.

## Repo Map

- `README.md`: public overview. Keep it short and route depth elsewhere; the full command and gate reference lives in `docs/VALIDATORS.md`.
- `docs/VALIDATORS.md`: every validator, renderer, and eval command with what it checks. Add a row here when you add a gate.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`: contributor-facing surfaces. Root `SECURITY.md` covers this repo's validators, workflows, and dependency chain, and is a different document from the shipped `templates/SECURITY.md` security release plan.
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
- `scripts/sync-skill-runtime.sh`: maintainer-only installed-runtime sync (`npm run sync:runtime`); see [Runtime Sync](#runtime-sync).

## First Reads

1. `README.md`
2. `skill/b2c-mobile-business-launch/SKILL.md`
3. Any directly relevant reference under `skill/b2c-mobile-business-launch/references/`
4. The script/template/eval files you will change

Use the skill-creator guidance when changing skill structure, trigger text, references, bundled scripts, or validation behavior.

Use Compound Engineering for non-trivial repo maintenance: check CE freshness (`ce-update` or latest-release fallback), use `ce-plan` or `ce-brainstorm` when scope or product/engineering direction is ambiguous, execute bounded work with `ce-work`, route isolated lanes through `ce-worktree` when useful, and finish behavior changes with CE review/test/proof skills where applicable. If CE is unavailable, record the fallback reason in the work summary and keep validator/eval coverage as the readiness gate.

When changing generated business-repo guidance, edit the shipped templates and validators under `skill/b2c-mobile-business-launch/` first; only update this root file for repo-maintenance practices.

## Agent Legibility

Keep this file as a concise map, not a duplicate manual. Put detailed launch policy in `references/`, reusable generated output in `templates/`, and deterministic enforcement in `scripts/` plus LaunchBench. When an agent miss repeats, add or tighten a validator/eval instead of relying on a longer reminder.

`SKILL.md` is a **router, not a manual** — it loads on every trigger, so its job is the always-on contracts plus one Lane Routing index (route here when / load / produce / gate). Detail belongs in the reference the row points at. `check:reference-size` holds a 45KB entrypoint budget on freeze-and-subtract terms: a new lane row is paid for by compressing or relocating existing entrypoint text, never by raising the ceiling. Do not reintroduce a second enumeration of the same routing (the old "Start Here" narrative and "When To Load References" list said the same thing twice and drifted).

## Founder-Facing Copy

Internal vocabulary is for agents and validators, never for founders. `scripts/lib/founder-copy.ts` is the only sanctioned path from machine state to founder-visible text; every founder-facing renderer imports from it. Adding a lane, status, phase, autonomy mode, or provider route means adding its label there **in the same commit** — `check:founder-copy` proves coverage and fails the build when a raw identifier, phase code, status enum, or banned internal word reaches a founder-visible surface. When a founder-visible heading is renamed, grep `scripts/` first: `check-founder-operator-bootstrap.ts` and `check-agent-operations.ts` both split the rendered cockpit on a literal `<h2>` string, so the rename and the validator update are one commit or the audit breaks.

Writing quality is enforced, not advised. `references/no-slop-writing.md` holds the banned words, named slop patterns, and per-channel limits for everything this skill writes and everything it generates for a launched business; the rules are adapted from [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop) (MIT). `check:no-slop` **parses its rule table out of that reference** rather than duplicating it, so edit the reference and the gate follows. It errors on shipped copy surfaces, errors on this repo's own public docs (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, scanned via `--repo-root`), warns on guidance prose and on `AGENTS.md`/`CLAUDE.md`, and it deliberately does not enforce the judgment-dependent rules — turning "cut the adverb when it adds nothing" into a regex would flatten brand voice, which is the failure the source skill warns about.

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
npm run check:founder-copy -- --root skill/b2c-mobile-business-launch/templates --skill-root skill/b2c-mobile-business-launch
npm run check:no-slop -- --root skill/b2c-mobile-business-launch/templates --skill-root skill/b2c-mobile-business-launch
npm run check:app-copy -- --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml --skill-root skill/b2c-mobile-business-launch
npm run check:onboarding -- --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml
npm run check:post-launch -- --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml
npm run check:google-play -- --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml
npm run check:backend-contract -- --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml
npm run check:analytics-catalog -- --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml
npm run check:change-cascade -- --root skill/b2c-mobile-business-launch/templates --state PROJECT_STATE.yaml --skill-root skill/b2c-mobile-business-launch
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

`scripts/sync-skill-runtime.sh` performs that whole sequence and is the preferred way to run it:

```bash
npm run sync:runtime                # pull main, audit source, mirror, audit runtime, prove parity + symlinks
npm run sync:runtime -- --dry-run   # preview the mirror without mutating anything
npm run sync:runtime -- --bootstrap  # create the runtime when this machine has none yet
```

It exits 0 with an explanatory message on machines with no installed runtime, refuses to sync from a non-`main` branch or a dirty tree without an explicit choice, fails on post-sync drift, and fails if a consumer path is a real directory instead of a symlink (that copy would silently keep serving stale content).

**When the runtime goes missing.** Deleting `~/.codex/skills/<skill>` leaves `~/.claude/skills/<skill>` and `~/.agents/skills/<skill>` as *dangling* symlinks: both tools keep listing the skill while every read of it resolves to nothing. Plain `sync:runtime` cannot fix that — skipping is correct for clones, CI, and cloud sessions, which legitimately have no install. The no-runtime message now names any dangling links it finds so the state is visible instead of silent, and `--bootstrap` creates the runtime and repairs them in one step. Note that `[ -e ]` follows symlinks, so it reports a dangling link as *absent*; use `[ -L ]` (or `ls -ld`) when checking whether a consumer link exists.

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
