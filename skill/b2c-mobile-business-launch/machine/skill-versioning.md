# Skill Versioning And Runtime Freshness

This skill must detect when the installed runtime copy is behind the latest local source copy before starting substantial launch, design, store, revenue, or build work.

## Runtime Freshness Loop

1. Read `skill-version.json` from the installed skill runtime.
2. Compare it with the latest source copy when available.
3. If the installed runtime is current, continue the original request.
4. If the installed runtime is stale, pause before continuing the original request and use the AskUserQuestion flow when available:

```text
A newer b2c-mobile-business-launch skill is available: installed <installed_version>, latest <latest_version>.
Do you want me to update the local skill runtime now so I can use the latest launch and Design Room features, or continue with the installed version for this request?
```

If AskUserQuestion is unavailable in the current agent runtime, ask the same question plainly and wait for the founder's answer. Do not silently continue on a stale installed skill unless the founder declines the upgrade or the source copy is unavailable.

## Commands

From the source repo:

```bash
npm run check:skill-version -- --source skill/b2c-mobile-business-launch --installed ~/.codex/skills/b2c-mobile-business-launch
npm run check:version-discipline -- --repo-root . --skill-root skill/b2c-mobile-business-launch
```

When internet access is available and you need to compare against the pushed source of truth:

```bash
npm run check:skill-version -- \
  --installed ~/.codex/skills/b2c-mobile-business-launch \
  --remote-url https://raw.githubusercontent.com/Emuthmartinez/b2c-mobile-business-launch-skill/main/skill/b2c-mobile-business-launch/skill-version.json
```

From the installed runtime:

```bash
cd ~/.codex/skills/b2c-mobile-business-launch
# replace the --source path with your local clone of this repo
npm run check:skill-version -- --source "$HOME/code/b2c-mobile-business-launch-skill/skill/b2c-mobile-business-launch" --installed .
```

When the founder approves an upgrade on this machine:

```bash
repo_root="$HOME/code/b2c-mobile-business-launch-skill"  # path to your local clone of this repo
rsync -a --delete --exclude node_modules \
  "$repo_root/skill/b2c-mobile-business-launch/" \
  ~/.codex/skills/b2c-mobile-business-launch/
(
  cd ~/.codex/skills/b2c-mobile-business-launch
  npm install
  npm run audit
)
diff -qr --exclude node_modules \
  "$repo_root/skill/b2c-mobile-business-launch" \
  ~/.codex/skills/b2c-mobile-business-launch
```

`~/.claude/skills/b2c-mobile-business-launch` and `~/.agents/skills/b2c-mobile-business-launch` should point at the same Codex runtime copy on this machine. Verify symlinks after every runtime sync.

## Rules

- `skill-version.json` is the version source of truth for installed-runtime freshness.
- `check-skill-version.ts` must return a nonzero status when the installed runtime is older than the source copy.
- `check-version-discipline.ts` must pass before committing skill behavior changes; it enforces that meaningful skill edits and `skill-version.json` move together.
- A stale installed runtime is a founder decision gate, not a silent warning.
- If the source copy or remote manifest is unavailable, continue with the installed copy but report that latest-version verification could not be completed.
- Runtime upgrades must preserve user work: sync the skill directory only, exclude `node_modules`, reinstall dependencies, run audit, and verify the runtime diff.
