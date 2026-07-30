# The Skill's Own Upkeep

What a maintainer touches to keep this skill green. Nothing here is about running a business, and an agent mid-launch has no reason to load it.

The line matters: a file about *how a launch is run* is method and lives in [`../playbook/process/`](../playbook/process/README.md), not here. Mixing the two is what made "the skill talking about itself" measure at 22% of the repo when much of that was really the method the skill exists to carry.

| Load when | Reference | Produces / gate |
| --- | --- | --- |
| Writing or auditing a LaunchBench scenario, adding a failure mode to the regression suite, or deciding whether a miss deserves a new gate | [`launchbench-evals.md`](launchbench-evals.md) | `npm run launchbench` lints scenario definitions and runs the deterministic validator fixtures; `npm run evals:behavioral` is a different gate against a live agent — never claim one as the other |
| Checking whether the installed runtime is behind source, syncing runtime copies, or cutting a version | [`skill-versioning.md`](skill-versioning.md) | `check:skill-version`, `check:version-discipline` |
| Adding an external link, refreshing an upstream pack, reviewing the weekly source diff, or changing fast-moving setup commands | [`source-freshness-maintenance.md`](source-freshness-maintenance.md) | `check:source-registry` |
| Registering a new external source the skill depends on | [`source-registry.yaml`](source-registry.yaml) | machine-read by `check-source-freshness` and the weekly refresh workflow — one row per tracked source, not prose |
