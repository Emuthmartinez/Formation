# Reporting a vulnerability in this repo

This policy covers **this repository**: the TypeScript validators under `skill/b2c-mobile-business-launch/tooling/`, the templates and references it ships, the GitHub Actions workflows, and the npm dependency chain behind them.

It does not cover apps launched with this skill. Those get their own security plan from `business/trust/SECURITY.md`, which is a different document for a different audience: the threat model, hardening, and release gates of a shipped consumer app.

## How to report

Use [GitHub's private vulnerability reporting form](https://github.com/Emuthmartinez/b2c-mobile-business-launch-skill/security/advisories/new). Do not open a public issue for a security problem.

Include, as far as you have it:

- What an attacker gains, and what access they need to start.
- The file or command involved, and a reproduction.
- Which version you tested against (`skill/b2c-mobile-business-launch/skill-version.json`).

Expect an acknowledgement within a few days. This is a small project, so please allow reasonable time for a fix before public disclosure.

## Supported versions

Fixes land on `main` and go out in the next version bump. Older releases are not backported. Check the installed runtime against source before assuming you're current:

```bash
npm run check:skill-version -- \
  --source skill/b2c-mobile-business-launch \
  --installed ~/.codex/skills/b2c-mobile-business-launch
```

## In scope

- A validator that passes copy, state, or configuration it exists to reject, where the miss lets a real secret, credential, or unsafe release through.
- Secret values, tokens, or credentials committed anywhere in this repo, including fixtures and generated reports.
- A template or starter scaffold that ships an insecure default into every business created from it. The archetype starters carry RLS policies and pgTAP tests precisely because this class of bug propagates.
- Code execution or path traversal reachable through a validator's flags or input files.
- A workflow that leaks secrets, runs untrusted input with write permissions, or lets a fork PR reach privileged scopes.
- A compromised or malicious dependency in either `package.json`.

## Out of scope

- Security issues in an app you launched with this skill. Those belong to that app.
- Vulnerabilities in third-party services the playbooks reference (RevenueCat, Doppler, PostHog, Stripe, Resend, Apple, Google). Report those to the vendor.
- Findings that require an attacker to already control your machine, your agent runtime, or your shell.
- Missing hardening with no demonstrated impact.

## What we already do

- GitHub Actions are pinned to full commit SHAs with version comments.
- Workflows default to `contents: read`, and only the weekly source-refresh job re-grants write scopes.
- `check:secrets` and `check:template-safety` fail the build on raw secret patterns and real-looking values in state, templates, and cockpits.
- `.env.example` files are names-only by contract, enforced for the shipped archetype starters by `check:archetype-starter`.
- The live behavioral eval workflow is manual-dispatch only, so an API key never runs on an untrusted PR.
