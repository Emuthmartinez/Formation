## What changed and why

<!-- One paragraph. What this does, and the launch failure or gap it addresses. -->

## How it's enforced

<!--
The house rule is enforcement over reminders. Name the validator, fixture, or LaunchBench
eval that now covers this behavior. If the change genuinely cannot be checked, say why.
-->

- Validators added or tightened:
- Fixtures or LaunchBench scenarios added:
- Validators run locally:

## Checklist

- [ ] `npm run audit:ci` passes green locally.
- [ ] Edited the source under `skill/b2c-mobile-business-launch/`, not an installed runtime copy.
- [ ] Bumped `skill-version.json` in this commit if anything under `skill/` changed, with a concrete release note.
- [ ] Versions stay in parity across both `package.json` files, `skill-version.json`, and both lockfiles.
- [ ] Any new external URL is registered in `machine/source-registry.yaml`.
- [ ] Refreshed the official docs or local CLI `--help` before changing third-party command guidance.
- [ ] No secrets, tokens, or real-looking secret values in state, templates, cockpits, or fixtures.
- [ ] Updated every place that mirrors a changed command, reference, or template.

## Notes for the reviewer

<!-- Anything worth knowing: tradeoffs considered, what you deliberately left out, follow-up work. -->
