# Technical Audit — b2c-mobile-business-launch-skill

> **Historical record. Reflects skill v0.9.0 on 2026-06-09; the repo is now v0.26.0.** Read the Executive Summary below as the state of the repo in June 2026, not as the state today.
>
> Every finding it opens with was resolved on 2026-06-10 — the [Resolution Log](#resolution-log-2026-06-10) at the end of this file is that record. The headline finding has moved furthest. The audit pipeline no longer lives in `package.json`: `audit` and `audit:ci` both call [`scripts/run-audit.ts`](../../skill/b2c-mobile-business-launch/scripts/run-audit.ts) over the declarative plan in [`scripts/lib/audit-plan.ts`](../../skill/b2c-mobile-business-launch/scripts/lib/audit-plan.ts), and `check:package-parity` now fails when a `check:*` or `validate:*` script is neither a plan step nor a recorded exclusion.
>
> One item the Resolution Log left open has since closed. Open Question 1 asked whether LaunchBench should stay a definition lint or also execute scenarios against an agent; the answer was both. `npm run launchbench` lints the definitions inside the PR gate, and `npm run evals:behavioral` runs flagged scenarios against a live agent outside it (needs `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, or `--use-profile`).
>
> This file lives under `docs/history/` and is kept out of `README.md` deliberately. A dated audit linked from the front door reads as current, and the filename carries the version so a reader knows before opening it. For what the repo enforces today see [`docs/validators.md`](../validators.md); for the maintainer map see [`AGENTS.md`](../../AGENTS.md).

Date: 2026-06-09 · Auditor: principal-level review session · Scope: full repo at commit `e9ad92e` · Method: read-only analysis; all repo gates were executed to verify claims (`tsc --noEmit`, `audit:links`, `check:source-registry`, `launchbench`, `test:validators` — all green).

---

## Executive Summary

**Overall health: B+.** This is an unusually disciplined repo for its category (an agent skill: Markdown playbooks + deterministic TypeScript validators). Strict TypeScript compiles clean, 124 positive/negative validator fixtures all pass, there are zero npm vulnerabilities, zero committed secrets, and the repo enforces its own rules (version discipline, package parity, link audits) mechanically. What keeps it out of the A range is maintainability debt concentrated in three places: the audit pipeline is two near-identical ~4,300-character shell strings in `package.json`, the fixture suite is a single 2,083-line file, and ~13 scripts re-implement the same argument parser. **Top 3 risks:** (1) the duplicated `audit`/`audit:ci` mega-strings will eventually drift and silently drop a gate; (2) "LaunchBench" and "agent evals" validate YAML shape but never execute a prompt against an agent — the names promise behavioral testing that does not exist, which could lead maintainers to over-trust coverage; (3) the CI workflow grants `contents: write` to the PR-triggered audit job that only needs read, combined with a tag-pinned (not SHA-pinned) third-party PR-creation action. **Top 3 opportunities:** (1) replace the package.json mega-strings with a single TypeScript audit orchestrator (also fixes the ~50-subprocess sequential slowness); (2) extract a shared validator kernel to kill the 13 duplicate `parseArgs` and 8 duplicate `normalize` implementations; (3) fix the maintainer-doc contradictions that give cloned/CI agents impossible instructions about syncing a runtime that only exists on the author's machine.

---

## Repo Map

**Purpose.** A reusable Claude Code / Codex *skill* that drives an AI agent through launching a B2C subscription mobile app business end-to-end. It is not an app; the deliverable is playbooks (Markdown), templates (copied into generated business repos), and deterministic validators (TypeScript) that gate "launch-ready" claims.

**Stack.** TypeScript (strict, `NodeNext`, `noUncheckedIndexedAccess`) run via `tsx`; `yaml` + `ajv` for state validation; a small React 19 + Vite 6 renderer for the Design Room; GitHub Actions for CI and a weekly source-freshness job. Node 22 in CI. ~349 files, ~4 MB, ~16,000 lines of TS in `scripts/`, ~17,000 lines of Markdown in `references/`.

**Architecture sketch.** Three layers:
1. **Playbooks** — `SKILL.md` (entrypoint, progressive-disclosure routing) → 50+ `references/*.md` lane guides.
2. **State contract** — `business/state/PROJECT_STATE.yaml` (+ `state/business.json`, JSON schemas) is the machine-readable launch state that generated business repos carry.
3. **Enforcement** — ~45 `scripts/check-*.ts` validators grep state + artifacts; `run-validator-fixtures.ts` exercises each with positive/negative fixtures; `run-launchbench.ts` schema-validates 78 failure-mode scenario YAMLs; `.github/workflows/source-freshness.yml` runs `audit:ci` on every PR and a weekly URL-freshness refresh over the 194-entry `source-registry.yaml`.

**Key directories.**
| Path | What it is |
| --- | --- |
| `skill/b2c-mobile-business-launch/SKILL.md` | Skill entrypoint; routing rules for when to load each reference |
| `…/references/` | 50+ launch-lane playbooks + `source-registry.yaml` (194 tracked URLs) |
| `…/scripts/` | ~60 validators/renderers/probes; shared helpers in `scripts/lib/launch-state.ts` and `lib/design-state.ts` |
| `…/business/` | Artifacts copied into generated app repos (state, docs, Claude hooks `settings.json`, Swift design tokens, email templates) |
| `…/evals/launchbench/` (78), `…/evals/agent-behavior/` (8), `…/evals/triggering/` (1) | Scenario YAML definitions |
| `…/render/` | React/Vite Design Room renderer (small: `App.tsx` 267 lines) |
| `…/state/` | Seed Design Room state + JSON schemas + committed generated workspace model (staleness-gated) |
| `docs/` | Prototypes and brainstorm artifacts (HTML/JSON), not shipped policy |

**Maturity.** Public, pre-1.0 (`0.9.0`), actively maintained, single-maintainer culture with explicit human+agent contributor flow. Calibration: recommendations below avoid enterprise ceremony and focus on what protects this repo's actual contract — validator trustworthiness.

**Surprises.**
- Every advertised gate actually runs and passes; README's script inventory matches `package.json` exactly. Rare.
- The repo is self-aware about its weakest point: validators carry "anti-gaming" helpers (`scripts/lib/launch-state.ts:319-437`) and "HONEST LIMIT" comments (`business/engineering/repo-agent-entrypoints/settings.json`, `scripts/probe-posthog.ts:20-24`).
- The eval harness names ("LaunchBench", "agent evals") oversell what is executed — see A3.

---

## Audit Report

Severity legend: **Critical / High / Medium / Low**. Each finding labeled **[fact]** (verified in code) or **[judgment]** (assessment).

There are **no Critical findings and no High security findings.** The ugliest parts — the ones to fix first — are A1, A2, and A3 below.

### Architecture & design

**A1 · Medium · [fact] — The audit pipeline lives as two ~4,300-character duplicated shell strings.**
`package.json:58` (`audit:ci`) and `package.json:59` (`audit`) are near-identical `&&`-chains of ~50 npm script invocations, differing only in `validate:skill`. The same pipeline is mirrored again in `skill/b2c-mobile-business-launch/package.json`. Consequence: adding a validator requires editing up to four places; a missed `&&` or omitted entry in one copy silently drops a gate with no error. `check-package-parity.ts` mitigates cross-file drift but nothing protects against editing `audit` and forgetting `audit:ci` content beyond string-diff parity. This is the single most fragile artifact in the repo.

**A2 · Medium · [fact] — `run-validator-fixtures.ts` is a 2,083-line god file.**
All ~124 fixtures, their builders (`writeCompleteAttribution`, `writeCompleteOrchestration` at 130 lines, etc.), and the runner share one file (`scripts/run-validator-fixtures.ts`). Consequence: contributors adding a validator must navigate and append to a 2k-line file; merge conflicts concentrate here; it is the hardest file in the repo to review.

**A3 · Medium · [fact + judgment] — "LaunchBench" and "agent evals" never execute behavior.**
`scripts/run-launchbench.ts:64-105` only checks that scenario YAML has `id/title/prompt/expected_guardrail/validators/must_catch` fields and that named validators exist; the `prompt` is never run against an agent. `run-agent-evals.ts` likewise validates definitions (README.md:168 says so). Fact: the only executed tests are the deterministic fixtures. Judgment: the names create an inflated sense of coverage — a maintainer reading "78 LaunchBench scenarios pass" may believe regression *behavior* is tested when only scenario *metadata* is. Either rename the gate (e.g., "scenario lint") or build a real execution harness; the current middle ground is the repo's biggest honesty gap with itself.

**A4 · Low · [judgment] — Phrase-list validators are brittle in both directions.**
Example: `check-onboarding-conversion.ts:112-126` requires the literal strings `review_prompt_eligible` / `review_prompt_requested`; `:96-102` requires one of six review-API phrases. A genuinely correct doc using `review_prompt_eligibility` fails; a doc that pastes the magic phrases without implementing anything passes. This is an accepted design tradeoff (acknowledged in `lib/launch-state.ts` anti-gaming comments), but the accepted-phrase vocabulary is invisible to template authors until the validator fails. Not a bug; a documentation/UX gap on the validators themselves.

### Code quality

**C1 · Medium · [fact] — Argument parsing and text helpers are duplicated across scripts.**
13 scripts define a private `parseArgs` instead of extending `lib/launch-state.ts:parseCliArgs` (`check-agent-entrypoints.ts`, `check-app-archetype.ts`, `check-artifact-templates.ts`, `check-autopilot-contract.ts`, `check-continuity-contract.ts`, `check-package-parity.ts`, `check-skill-version.ts`, `check-source-freshness.ts`, `check-version-discipline.ts`, `check-workflow-adherence.ts`, `refresh-source-freshness.ts`, `render-business-control-plane-workspace.ts`, `run-agent-evals.ts`). 8 scripts re-implement `normalize`, 2 re-implement `requireAny`. Consequence: flag-handling bugs must be fixed N times; new flags (`--quiet`, `--json`) can't be added centrally.

**C2 · Low · [fact] — Minor type-discipline inconsistency.**
`run-launchbench.ts:12` declares `const issues = []` (implicitly-evolving `any[]`) where sibling scripts use `const issues: Issue[]`. Compiles, but weakens the strict-TS contract in the one file that orchestrates everything.

**C3 · Low · [fact] — 16 bare `catch {}` blocks.**
All inspected instances are intentional best-effort fallbacks (e.g., `check-skill-version.ts:148`, `refresh-source-freshness.ts:108-110` returning empty snapshots). No swallowed errors that hide failures were found; flagging for completeness only.

**C4 · Low · [fact] — Fixture temp directories are never cleaned up.**
`run-validator-fixtures.ts:22` creates `mkdtempSync(tmpdir(), "b2c-validator-fixtures-")`; `rmSync` is only used to delete files *within* fixtures (`:788-789`), never the `tempRoot` itself. Each `npm run test:validators` leaves ~124 copied template trees in `/tmp`. Harmless on ephemeral CI; unbounded growth on a developer machine that runs the suite often.

### Security

**S1 · Medium · [fact] — CI write permissions are workflow-scoped, not job-scoped.**
`.github/workflows/source-freshness.yml:12-14` grants `contents: write` + `pull-requests: write` at the workflow level, so the PR/push-triggered `audit` job (lines 17-29) — which only checks out, installs, and runs validators — receives write tokens it never uses. Consequence: any compromised dev dependency executing during `npm ci`/`npm run audit:ci` on a same-repo push holds a write-capable `GITHUB_TOKEN`. (Fork PRs are read-only by GitHub default, which limits blast radius.)

**S2 · Low · [fact] — Third-party action pinned by tag, not SHA.**
`source-freshness.yml:57` uses `peter-evans/create-pull-request@v6` in the job that *does* legitimately hold write permissions. A tag is mutable; SHA-pinning is the standard hardening for write-permission jobs.

**S3 · Healthy — Secrets discipline is exemplary.**
Full-repo scan found no credentials; the only matches are a deliberately fake key inside a negative fixture (`run-validator-fixtures.ts:974`) and a `phc_...` placeholder in a template. `probe-posthog.ts` / `probe-revenuecat.ts` read keys exclusively from env, never log or persist them, and exit 0 with founder instructions when absent. `check-secret-routing.ts` mechanically forbids committed `.env`/`.p8`/`.p12`/`.pem` files and raw key patterns. `npm audit`: 0 vulnerabilities (prod and dev).

**S4 · Low · [judgment] — Weekly auto-PR over 194 fetched URLs is an accepted, managed risk.**
`refresh-source-freshness.ts` hashes fetched content (never executes it) and the auto-PR body instructs human review before adoption. Residual risk is a human merging poisoned upstream content as policy; the existing review instruction is the right control at this maturity.

### Testing

**T1 · Healthy — The core contract is genuinely tested.**
124 positive + negative fixtures cover the validators (the business-critical 20%), run in CI on every PR, and assert exit codes plus expected output text — behavior, not just execution. Verified passing in 56s.

**T2 · Medium · [fact] — Non-validator code has no tests.**
`grade-screenshots.ts` (526 lines), `probe-posthog.ts`/`probe-revenuecat.ts` (~625 lines combined), and the React renderer (`render/src/`) have zero fixture coverage; renderers are only smoke-exercised via `render:design-room --static-only` in `audit:ci`. The probes shape the provider-proof artifacts that other validators trust, so a regression there silently weakens the proof chain.

**T3 · Low · [fact] — Claimed Node 18 support is untested and contradicted.**
README.md:16 says "Node.js 18+ to run the validators"; CONTRIBUTING.md says "Requires Node.js 22 (matches CI)"; CI runs only Node 22. Either drop the 18+ claim or add a matrix entry.

### Performance

**P1 · Medium · [fact] — `audit:ci` pays ~50 sequential `npm run` + `tsx` boot costs.**
The `package.json:58` chain spawns each validator as a separate `npm run` (each: npm boot + tsx/esbuild boot) strictly sequentially. Fixtures alone take 56s; the full gate is several minutes of mostly process-startup overhead. Consequence: slow PR feedback, and the cost grows linearly with every validator added. An in-process orchestrator (one tsx boot, imported validators, optional concurrency) would cut this dramatically. This dovetails with A1 — same fix.

**P2 · Low · [fact] — Weekly refresh worst case is ~49 minutes.**
`refresh-source-freshness.ts:248-251` fetches all 194 sources sequentially with a 15s timeout each; the comment says sequencing is deliberate politeness. A small concurrency pool (e.g., 5) with per-host serialization preserves politeness at ~10× speed. Only matters if the registry keeps growing.

### Dependencies

**Healthy.** 8 devDependencies, 0 vulnerabilities, both lockfiles committed, root/skill parity mechanically enforced (`check-package-parity.ts`). Majors are available (Vite 6→8, TypeScript 5→6, plugin-react 4→6) but nothing is unmaintained or risky; upgrade opportunistically, not urgently. MIT-licensed with no license-risk dependencies spotted.

### DevEx & operations

**X1 · Medium · [fact] — No lint or format enforcement exists.**
No ESLint/Prettier/Biome config anywhere in the repo; style consistency across 16k lines of TS is currently maintained by hand and by review. For a repo that explicitly invites agent contributors (CONTRIBUTING.md), a mechanical formatter is cheap drift insurance.

**X2 · Medium · [fact] — Shipped Claude hooks are untestable ~3,000-character inline shell strings.**
`business/engineering/repo-agent-entrypoints/settings.json` embeds three large shell one-liners as `PostToolUse` hooks. Its own `_comment_setup` admits: without `jq` on PATH or `SKILL_ROOT` set, hooks "fail silently" and "no validator fires" — i.e., the enforcement layer the template promises can no-op invisibly in generated repos. No fixture executes these hooks. Consequence: the most failure-prone shipped artifact is the least tested one.

**X3 · Medium · [fact] — Maintainer docs give cloned/CI agents impossible, contradictory instructions.**
`CLAUDE.md:15` tells every agent: "After any skill change, ensure the Codex installed runtime is synced … through symlinks on this machine." `AGENTS.md:94` likewise says "On this machine, `~/.claude/skills/…` point to the Codex runtime copy." But CONTRIBUTING.md:33 correctly states the runtime sync is "maintainer-only and not something external contributors need to do." Consequence: any agent working in a clone, codespace, or CI container (including this audit session) receives a standing instruction it cannot satisfy, and must guess which doc wins. These author-machine assumptions are a leftover that commit `e067304` ("remove author machine paths") missed.

### Documentation

**Healthy overall** — README, AGENTS.md, and CONTRIBUTING.md are accurate and unusually well cross-referenced; the README script inventory matches `package.json` exactly. Two Low items: the Node-version contradiction (T3), and README's Layout block (~line 229) lists only `evals/launchbench/` while `evals/agent-behavior/` and `evals/triggering/` also exist.

### Strengths (preserve these)

1. **Self-enforcing repo culture.** Version discipline, package parity, link audits, artifact-template coverage, and template safety are all validators, not conventions — and they all pass. The AGENTS.md rule "when an agent miss repeats, add a validator instead of prose" is the repo's best idea.
2. **Test discipline on the core contract** — paired positive/negative fixtures so validator false-negatives become audit failures (`run-validator-fixtures.ts`), exactly where testing matters most here.
3. **Secrets hygiene** that most production services don't match (S3).
4. **Strict TypeScript** including `noUncheckedIndexedAccess`; `tsc --noEmit` is the first gate of `audit:ci`.
5. **Epistemic honesty in-code**: "HONEST LIMIT" annotations, anti-gaming helpers, founder-approval backstops — the repo documents what its checks *cannot* prove.
6. **Tiny dependency surface** (8 devDeps) for what it does.

---

## Improvement Strategy

### Theme 1 — The pipeline is data, not code (explains A1, P1, partially C1)
The audit pipeline is the repo's spine, yet it lives as duplicated shell strings with per-step process-boot overhead. **Target state:** a single `scripts/run-audit.ts` orchestrator that owns the ordered validator list once, imports validators in-process (or spawns once via tsx), takes `--ci` to skip maintainer-only steps, and is invoked by both `audit` and `audit:ci`. **Principle:** one source of truth for anything that gates releases.

### Theme 2 — Shared validator kernel (explains C1, C2, A2)
Validators were grown by accretion; helpers got copy-pasted. **Target state:** `lib/launch-state.ts` (or a new `lib/cli.ts`) is the only place `parseArgs`, `normalize`, `requireAny`, and issue reporting exist; `run-validator-fixtures.ts` becomes a thin runner over per-validator fixture modules. **Principle:** a contributor adding validator #46 should write ~100 new lines, not navigate 2,000.

### Theme 3 — Say what the evals are (explains A3)
**Target state:** either the gate is renamed to what it does (scenario/definition lint) or a minimal behavioral harness exists for a *subset* of scenarios. **Principle:** a guardrail-heavy repo cannot afford its own guardrails overstating coverage.

### Theme 4 — CI and supply-chain hygiene (explains S1, S2, X1)
**Target state:** job-scoped permissions (audit job: `contents: read`), SHA-pinned third-party actions, and a formatter check in CI. All cheap, all one-file changes.

### Theme 5 — Docs that survive leaving the author's machine (explains X3, T3, DOC drift)
**Target state:** root `CLAUDE.md`/`AGENTS.md` express runtime sync as conditional ("if you are on the maintainer machine with `~/.codex/skills` present…"), and version/layout claims match CI reality. **Principle:** instructions must be satisfiable by every agent that can read them.

### Explicitly NOT recommended (trade-offs)
- **Do not replace regex-over-prose validation with LLM grading.** It is the repo's core design, its limits are documented, determinism is the feature. Cost/nondeterminism outweigh gains at this maturity.
- **Do not stop committing generated artifacts** (`design/design-room.html`, `state/workspace.generated.json`): staleness is already CI-gated; committed copies serve agent consumers.
- **Do not collapse the dual package.json/lockfile structure.** The installed-runtime model requires it and parity is enforced.
- **Do not chase major dependency upgrades (Vite 8, TS 6) now.** Zero vulns; upgrade when something needs it.
- **Do not add unit tests to the React renderer.** 267 lines, smoke-rendered in CI; effort exceeds payoff.

### Definition of done (measurable)
- The ordered validator list is defined in exactly **one** file; `package.json:58-59` are each ≤ 1 line.
- `grep -l "function parseArgs" scripts/*.ts` returns **0** files (excluding the shared lib).
- No source file in `scripts/` exceeds **600** lines.
- CI: audit job runs with `contents: read`; all third-party actions SHA-pinned; `npm run lint` (format check) is a CI step that fails on violation.
- `audit:ci` wall time reduced ≥ 50% from the current multi-minute baseline.
- Zero contradictions: Node version, runtime-sync instructions, and README layout each state one truth.
- Eval gate output no longer claims behavior coverage it doesn't execute (rename or harness).

---

## Task Plan

### Milestone 0 — Safety net (do before refactoring)

| # | Task | Files | Acceptance criteria | Effort | Risk | Deps |
|---|---|---|---|---|---|---|
| 0.1 | **Snapshot the current gate as the refactor oracle.** Capture the exact ordered list of commands `audit`/`audit:ci` run today (script that parses package.json and emits the list to a committed fixture), so the new orchestrator can be diffed against it. | `package.json`, new `scripts/lib/audit-plan.ts` + fixture | Committed canonical step list; a test fails if orchestrator coverage ≠ snapshot | S | None (additive) | — |
| 0.2 | **Add CI formatter check.** Adopt Prettier (or Biome) with config matching current style; run `--check` in CI; one-time `--write` commit. | new config, `.github/workflows/source-freshness.yml`, whole-repo format commit | CI fails on unformatted code; format-only commit isolated from logic changes | M | Low (mechanical; review the one big diff) | — |

### Milestone 1 — Critical fixes (security & correctness)

| # | Task | Files | Acceptance criteria | Effort | Risk | Deps |
|---|---|---|---|---|---|---|
| 1.1 | **Scope CI permissions per job.** Move write perms from workflow level into `weekly-source-refresh` only; audit job gets `contents: read`. | `source-freshness.yml:12-14` | PR-triggered job token is read-only; weekly job still opens PRs | S | Low | — |
| 1.2 | **SHA-pin third-party actions.** Pin `peter-evans/create-pull-request` (and optionally `actions/*`) to full commit SHAs with version comments. | `source-freshness.yml:21,22,36,38,48,57` | No mutable tags on write-permission jobs | S | Low | — |
| 1.3 | **Resolve the maintainer-machine doc contradiction.** Make runtime-sync instructions conditional on the maintainer environment; align CLAUDE.md/AGENTS.md with CONTRIBUTING.md's "maintainer-only" stance. | `CLAUDE.md:15`, `AGENTS.md:92-96` | A fresh-clone agent has no unsatisfiable standing instructions; `check:agent-entrypoints` still passes | S | Low | — |
| 1.4 | **Fix Node-version and layout doc drift.** Pick one supported Node floor (recommend: 22, matching CI) and state it everywhere; add `evals/agent-behavior/` + `evals/triggering/` to README Layout. | `README.md:16,~229`, `CONTRIBUTING.md` | Zero contradictory version claims | S | None | — |

### Milestone 2 — High-leverage improvements

| # | Task | Files | Acceptance criteria | Effort | Risk | Deps |
|---|---|---|---|---|---|---|
| 2.1 | **Build `run-audit.ts` orchestrator; shrink package.json scripts to one-liners.** See sketch below. | new `scripts/run-audit.ts`, `package.json:58-59`, skill `package.json`, CI workflow | `audit`/`audit:ci` ≤ 1 line each; step list matches 0.1 snapshot; wall time ≥ 50% faster; parity check updated | L | **Medium** — this is the release gate itself; ship behind the 0.1 oracle | 0.1 |
| 2.2 | **Extract shared CLI/text kernel; delete duplicates.** Move `parseArgs` variants into a parameterized `lib` helper; consolidate `normalize`/`requireAny`; type `run-launchbench.ts:12`. | 13 scripts listed in C1, `lib/launch-state.ts` | `grep "function parseArgs" scripts/*.ts` (excl. lib) = 0; fixtures all pass unchanged | M | Low-Medium (flag-parsing edge cases; fixtures cover exit codes) | — |
| 2.3 | **Split `run-validator-fixtures.ts` into per-validator fixture modules.** `scripts/fixtures/<validator>.fixtures.ts` exporting cases; thin shared runner. | `run-validator-fixtures.ts` → ~30 modules + runner | Same 124 fixtures pass; no file > 600 lines; adding a fixture touches only its module | L | Low (pure mechanical move; oracle = identical PASS list) | 2.2 helpful |
| 2.4 | **Rename or implement the behavioral eval gate.** Decision task (see Open Questions). Minimum: rename output/docs from "LaunchBench scenario validation" to "scenario definition lint" and say in README that prompts are not executed. Maximum: harness that runs N flagship scenarios against a live agent in a manual workflow. | `run-launchbench.ts`, `run-agent-evals.ts`, README.md:174, `machine/launchbench-evals.md` | Gate output and docs accurately describe what executed | S (rename) / XL (real harness) | Low (rename) | Owner decision |

### Milestone 3 — Quality & polish

| # | Task | Files | Acceptance criteria | Effort | Risk | Deps |
|---|---|---|---|---|---|---|
| 3.1 | **Clean up fixture temp dirs.** `try/finally` + `rmSync(tempRoot, {recursive, force})` (keep on `--keep-temp` for debugging). | `run-validator-fixtures.ts:22` | `/tmp` clean after suite run | S | None | — |
| 3.2 | **Extract shipped hooks from inline JSON to a tested script.** Move the shell logic from `settings.json` hooks into `scripts/hooks/post-tool-use.sh` (or `.ts`); hooks become short invocations; add a fixture that executes the script with sample `CLAUDE_TOOL_INPUT` payloads, including the no-`jq`/no-`SKILL_ROOT` paths (should warn loudly, not silently no-op). | `business/engineering/repo-agent-entrypoints/settings.json`, new script + fixture | Hook logic is testable; silent-failure modes produce visible warnings; `check:template-safety` passes | M | Medium (changes shipped behavior in generated repos; version-bump per discipline) | — |
| 3.3 | **Add fixture coverage for `grade-screenshots.ts` and probe argument/artifact shapes.** Probes: golden-file test of the proof JSON writer with a mocked fetch; grader: template-emit and ledger-validation paths. | `scripts/fixtures/` | Proof-artifact shape changes break CI | M | Low | 2.3 |
| 3.4 | **Concurrency pool for source refresh.** Pool of ~5 with per-host serialization; keep the politeness comment honest. | `refresh-source-freshness.ts:248-251` | Weekly job ≤ ~10 min at 194 sources; per-host sequential | S | Low | — |
| 3.5 | **Document validator phrase vocabularies.** Per-validator "accepted phrases" section generated or hand-written next to each template, so authors know the contract before the red X (addresses A4). | `machine/launchbench-evals.md` or per-template notes | Each phrase-gated validator's vocabulary is discoverable without reading its source | M | None | — |

### Quick wins (high impact, S effort — do immediately)
- **1.1** job-scoped CI permissions · **1.2** SHA-pin actions · **1.3** fix the impossible runtime-sync instruction · **1.4** Node/layout doc truth · **3.1** temp-dir cleanup · **2.4-minimum** rename the eval gate output honestly.

### Implementation sketches — top 3 tasks

**2.1 `run-audit.ts` orchestrator.**
Approach: declare `const steps: AuditStep[]` (`{ id, args | fn, ciOnly?, maintainerOnly?, serializeWith? }`) mirroring today's order exactly (oracle from 0.1). Phase 1: spawn each step via one shared tsx process pool (`spawnSync` per step is still fine — the win is deleting npm-boot overhead and the duplicate string). Phase 2 (optional): import validator mains in-process; this requires the small refactor of converting top-level-statement scripts (e.g., `check-onboarding-conversion.ts:4-33` runs at import time) into exported `main(args)` functions — do that incrementally, per validator, behind the same fixture suite. `audit` = `tsx scripts/run-audit.ts`, `audit:ci` = `tsx scripts/run-audit.ts --ci`. Gotchas: `validate:skill` is env-dependent (author machine), keep its soft-skip semantics; `check-package-parity.ts` asserts on script presence in both package.json files — update its expectations in the same commit; keep stdout format compatible with anything grepping `error(s), warning(s)`.

**2.2 Shared CLI kernel.**
Approach: extend `lib/launch-state.ts` with `parseFlags(argv, spec)` where `spec` maps flag→key (covers the 13 variants: they differ only in flag names like `--skill-root`, `--registry`, `--installed`). Migrate one script, run its fixtures, repeat; finish with a repo-wide grep gate (could even be a new self-check validator, in keeping with house culture). Gotchas: two scripts treat `--root` defaults differently (cwd vs script-relative); preserve each script's current default in its spec rather than unifying behavior silently.

**2.3 Fixture suite split.**
Approach: keep `runFixture`/`makeFixture`/`writeComplete*` builders in `scripts/fixtures/_harness.ts`; move each validator's cases into `scripts/fixtures/<validator>.fixtures.ts` exporting `register(harness)`. The runner globs modules, runs all, prints the identical `PASS <label>` lines (oracle: byte-compare the PASS list before/after). Gotchas: several builders are shared across validators (`writeCompleteOrchestration` used by orchestration *and* lane-coverage cases) — they live in the harness, not a validator module; preserve the single `mkdtemp` root so 3.1's cleanup stays in one place.

---

## Open Questions (need a human decision)

1. **Eval ambition (drives 2.4's S-vs-XL fork):** Is "LaunchBench" intended to eventually *execute* scenarios against an agent (CI-invocable harness, model costs, flake budget), or is definition-linting the permanent scope? If the latter, renaming is the whole fix.
2. **npm publishing intent:** `package.json` is `private: false` at `0.9.0` and CI runs `npm pack --dry-run`. Is the root package (or the inner skill package) actually meant to be published to npm? If yes, a `files` whitelist should be deliberate (currently `.npmignore` ships nearly everything, including `docs/` prototypes); if no, mark private and drop the pack step.
3. **Node support floor:** README promises 18+, CI tests only 22. Which is the contract? (Recommendation: declare 22, add `"engines"`.)
4. **`docs/` prototypes lifecycle:** `business-control-plane-prototype.html` (55 KB) and `remotion-content-assets-plan.html` are design-time artifacts. Are they still load-bearing references, or deprecation candidates once the Control Plane ships?
5. **CI time budget:** Is there a target wall-time for the PR gate? P1's fix is sized differently for "under 2 minutes" vs "whatever, keep it simple."
6. **Hook strictness in generated repos (3.2):** When `jq`/`SKILL_ROOT` are missing, should hooks hard-fail the agent turn (strict) or warn loudly (current intent, today silent)? This changes shipped behavior for every generated business repo.

---

## Resolution Log (2026-06-10)

All findings from this audit were resolved on this branch (skill version bumped 0.9.0 → 0.10.0). Compound Engineering tooling was unavailable in this environment; per `AGENTS.md`, validator/fixture coverage served as the readiness gate, and the full `audit:ci` pipeline plus the fixture suite were run green before each push.

| Finding | Resolution | Evidence |
|---|---|---|
| A1 audit pipeline as duplicated shell strings | `scripts/run-audit.ts` orchestrator over a declarative plan in `scripts/lib/audit-plan.ts`; `audit`/`audit:ci` are one-liners in both packages | `package.json` scripts; `npm run audit:ci -- --list` |
| A2 2,083-line fixture god-file | Split into `scripts/fixtures/` harness + builder/state modules + 8 domain modules (all <600 lines); entrypoint is ~45 lines; PASS-list byte-identical before/after | `scripts/fixtures/`, oracle diff in PR history |
| A3 eval gate overstates coverage | Gate output renamed to "scenario definition lint (prompts are not executed against an agent)"; README and `machine/launchbench-evals.md` state the executed scope explicitly | `run-launchbench.ts`, README, launchbench-evals.md "Harness Shape" |
| A4 phrase-list brittleness undocumented | New "Validator Phrase Contracts" section documents the literal-vocabulary design, its two edges, and the most-tripped tokens | `machine/launchbench-evals.md` |
| C1 13 duplicate `parseArgs`, duplicated helpers | Shared kernel (`expandHome`, `parseFlags`, flag accessors, `normalizedIncludes`, `missingPhraseCode`, `normalizedStringArray`) in `lib/launch-state.ts`; all 13 scripts migrated with byte-identical CLI semantics; one deliberate non-dedupe (`check-parallel-orchestration`'s space-only `missingPhraseCode`) kept to preserve emitted issue codes | `scripts/lib/launch-state.ts` + migrated validators |
| C2 untyped `issues` array | `const issues: Issue[]` in `run-launchbench.ts` | `run-launchbench.ts:12` |
| C4 fixture temp dirs never cleaned | `try/finally` + `rmSync(tempRoot)`; `--keep-temp` opt-out | `run-validator-fixtures.ts` |
| S1 workflow-level write permissions | Workflow defaults to `contents: read`; write scopes re-granted only to `weekly-source-refresh` | `.github/workflows/source-freshness.yml` |
| S2 tag-pinned actions | All four actions pinned to full commit SHAs (resolved via `git ls-remote`) with version comments | `.github/workflows/source-freshness.yml` |
| T2 untested probes/grader/hooks | 12 new fixtures: probe no-credential paths, four `grade-screenshots` paths, six hook executions with sample `CLAUDE_TOOL_INPUT` payloads; plus a latent ESM `require()` bug found and fixed in `grade-screenshots.ts` (PNG dimension read was unreachable under tsx) | `scripts/fixtures/probes-and-grading.fixtures.ts`, `scripts/fixtures/hooks.fixtures.ts` |
| T3/DOC Node + layout drift | README declares Node 22 (matches CI/CONTRIBUTING); layout lists `evals/agent-behavior/` and `evals/triggering/` | README.md |
| P1 ~50 sequential npm boots | Orchestrator spawns tsx directly with a concurrency pool (typecheck barrier first, launchbench serialized); full `audit:ci` measured at ~1m23s wall | `scripts/run-audit.ts` |
| P2 ~49-minute worst-case weekly refresh | Per-host-serialized fetch pool (5 workers) keeps politeness per docs site | `refresh-source-freshness.ts` |
| X1 no lint/format enforcement | Prettier adopted (printWidth 160), `lint:format` step in the audit plan, one-time mechanical reformat of `scripts/**/*.ts` | `.prettierrc.json`, audit plan |
| X2 silent hook failure modes | Missing `jq`/`SKILL_ROOT` now warn loudly to stderr and exit 0; blocking screenshot gates still fire without `SKILL_ROOT`; behavior covered by executed-hook fixtures | `business/engineering/repo-agent-entrypoints/settings.json`, `fixtures/hooks.fixtures.ts` |
| X3 impossible maintainer-machine instructions | Runtime-sync guidance in root `AGENTS.md`/`CLAUDE.md` is now conditional on the maintainer machine; clones/CI are told `audit:ci` is the gate | AGENTS.md, CLAUDE.md |

Additionally, `check-package-parity` now enforces audit-plan coverage structurally (every `check:*`/`validate:*` script must be a plan step or carry a recorded exclusion reason; every step must resolve in both packages; both audit entrypoints must route through `run-audit.ts`) — this supersedes and strengthens the old string-derived coverage check.

Remaining open (deliberate): the S-vs-XL fork on executing LaunchBench scenarios against a live agent (Open Question 1) — the rename resolves the honesty gap; a behavioral harness stays a product decision. Major dependency upgrades (Vite 8, TS 6) remain non-urgent.
