# Contributing

Thanks for wanting to improve the **B2C Mobile Business Launch Skill**. Humans and AI agents are both first-class contributors here, and both are held to the same gates.

This repo is a skill (markdown launch playbooks plus deterministic TypeScript validators), not an app. The validators are the contract. If your change matters, it should show up in a validator, a LaunchBench eval, a template, or a reference, not only in prose.

## TL;DR

1. Fork or branch from `main`.
2. `npm install` and `npm install --prefix skill/b2c-mobile-business-launch`.
3. Make your change. Edit the source under `skill/b2c-mobile-business-launch/`, never the installed runtime copy.
4. If you touched anything under `skill/`, bump the version manifest. See [Versioning discipline](#versioning-discipline).
5. Run the gate. `npm run audit:ci` must pass green.
6. Open a **draft PR** and fill in the template. Mark it ready once CI is green.

## Project layout

Read these first, in order:

1. [`README.md`](README.md): what the skill is and who it's for.
2. [`AGENTS.md`](AGENTS.md): the maintainer guide and repo map, canonical for how the repo is organized and maintained.
3. [`CLAUDE.md`](CLAUDE.md): Claude-specific maintainer notes.
4. [`docs/validators.md`](docs/validators.md): every gate and what it checks.
5. `skill/b2c-mobile-business-launch/SKILL.md`: the skill entrypoint and routing.
6. The specific `references/`, `business/`, `scripts/`, or `evals/` file you intend to change.

All real content lives under `skill/b2c-mobile-business-launch/`. The author's machine mirrors that into an installed runtime at `~/.codex/skills/...`; that sync is maintainer-only and external contributors never need to do it. Always edit the repo source.

## Local setup

Requires **Node.js 22**, matching CI.

```bash
npm install
npm install --prefix skill/b2c-mobile-business-launch
```

Run the full local audit. This is the gate, plus a maintainer-only skill lint that auto-skips when its tooling isn't installed:

```bash
npm run audit
```

To run exactly what CI runs, with no maintainer-only steps:

```bash
npm run audit:ci
```

Individual validators are useful while iterating:

```bash
npm run test:validators        # validator unit fixtures
npm run launchbench            # known failure-mode scenarios
npm run audit:links            # internal link integrity
npm run audit -- --only check:security
```

[`docs/validators.md`](docs/validators.md) lists every gate, its flags, and what it checks.

## The rules CI enforces

These are not style preferences. `npm run audit:ci` will fail your PR if you skip them.

### Versioning discipline

Any change under `skill/b2c-mobile-business-launch/` must bump `skill/b2c-mobile-business-launch/skill-version.json` in the same commit:

- `version`: semver, increment it.
- `updatedAt`: `YYYY-MM-DD`.
- `releaseNotes`: at least one concrete note for what changed. The file requires two notes total.

Keep versions in parity across `package.json` (root), `skill/b2c-mobile-business-launch/package.json`, `skill-version.json`, and both `package-lock.json` files. After bumping, run `npm install --package-lock-only` in both locations so the lockfiles match. `check:package-parity` and `check:version-discipline` verify this.

### Source freshness

Any new external URL you reference anywhere in the repo must be registered in `skill/b2c-mobile-business-launch/machine/source-registry.yaml` with an `id`, `url`, `owner`, and the `locations` it appears in. `check:source-registry` enforces this at error severity, and it scans markdown, YAML, JSON, and TypeScript alike.

For fast-moving third-party tools (Doppler, RevenueCat, Stripe, PostHog, Resend, Apple and App Store Connect, Google Play, Fastlane, Remotion), refresh the official docs or local CLI `--help` before changing command guidance. Do not rely on memory or old transcripts.

### Secrets

Never commit secrets. `.env.example` files are names-only. State files, cockpits, and templates must not contain real or real-looking secret values. The secret and template-safety validators check for this.

### Writing quality

`check:no-slop` reads its banned words and slop patterns out of [`playbook/words/no-slop-writing.md`](skill/b2c-mobile-business-launch/playbook/words/no-slop-writing.md) and scans shipped copy templates, guidance references, and this repo's own root docs including `README.md` and `CONTRIBUTING.md`. Edit the reference and the gate follows. The judgment-dependent rules stay advisory on purpose, because turning "cut the adverb when it adds nothing" into a regex would flatten brand voice.

### Prefer enforcement over reminders

When a mistake can recur, tighten a validator or add a LaunchBench eval rather than writing a longer paragraph of instructions. If you're changing generated business-repo guidance, edit the shipped templates and validators under `skill/b2c-mobile-business-launch/` first, not the root maintainer files.

## Pull request expectations

The [PR template](.github/PULL_REQUEST_TEMPLATE.md) covers most of this. In short:

- **Scope.** One concern per PR. Discuss large refactors in an issue first.
- **Draft first.** Open as a draft, mark ready once CI is green. Don't request a merge on red CI.
- **Green gate.** `npm run audit:ci` must pass locally before you push. CI runs the same thing on Node 22.
- **Description.** Explain what changed and why, and note which validators or evals you added or ran. If you changed behavior, point at the gate that now covers it.
- **No drift.** If you change a command, reference, or template, update every place that mirrors it. The audit usually catches divergence.
- **Tests for behavior.** Behavior changes should come with validator-fixture or LaunchBench coverage, not only doc edits.

A good PR is one a reviewer can verify by reading the diff and watching CI go green.

## How `main` is protected

`main` is a protected branch: nobody, including the maintainer, pushes to it directly. Every change lands through a squash-merged pull request with the `audit` check green and any review conversations resolved.

If you're a first-time contributor (human or AI agent), GitHub holds your very first pull request's checks at "waiting for approval" until the maintainer clicks **Approve and run workflow** in the Actions tab. That's a GitHub default for public repos, not a rejection of your PR — it runs automatically on every PR after your first one.

## Notes for AI-agent contributors

If you are an agent working in this repo:

- **Read `AGENTS.md` and `CLAUDE.md` before editing.** They are the canonical maintainer contracts.
- **Edit the repo source, not the installed runtime**, and skip the maintainer-only runtime sync unless you are the maintainer on the author's machine.
- **Run the validators yourself.** Do not mark a change ready based on subagent findings alone. The orchestrator owns integration, the version bump, git, and final verification.
- **Bump `skill-version.json`** in the same change when you touch `skill/`, and keep package and lockfile parity.
- **Refresh upstream docs and CLI help** before changing any third-party command guidance.
- **Encode recurring misses as a validator or eval**, not a longer prompt.

## Scope of the project

This skill is opinionated and targets subscription and freemium consumer mobile apps. It does not currently cover one-time purchases or ad-based monetization. Contributions that deepen the existing lanes (research, design, onboarding, paywalls, store ops, growth, verification) are very welcome. Open an issue first to discuss proposals that expand scope.

## Code of conduct and licensing

Participation is governed by [`.github/CODE_OF_CONDUCT.md`](.github/CODE_OF_CONDUCT.md). Report security issues through [`.github/SECURITY.md`](.github/SECURITY.md) rather than a public issue.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE) that covers this repository.

## Documentation synchronization

A behavior or schema change is incomplete until the repository README, `SKILL.md`, graph README, architecture guide, implementation guide, validator reference, affected domain README indexes, generated projections, and `skill-version.json` agree. Review every README even when only canonical surfaces need edits. Generated blocks are changed through definitions and renderers, never by hand.
