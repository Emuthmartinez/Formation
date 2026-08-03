# CLAUDE.md

Read `AGENTS.md` first; it is the canonical maintainer guide for this skill repo.

This file is maintainer-only. Do not copy it into businesses created by the skill; launched business repos should use the shipped `business/repo-agent-entrypoints/CLAUDE.md` addendum after it has been filled with the app-specific context.

Claude-specific notes:

- Use subagents only for scoped independent audits or isolated file ownership assigned by the orchestrator.
- Use Compound Engineering for non-trivial maintainer work: freshness check, planning or brainstorm when needed, `ce-work` execution, CE review/test/proof where applicable, and an explicit fallback note if CE is unavailable.
- Do not stage, commit, push, sync runtime copies, or mark readiness from subagent findings alone.
- Refresh official docs and local CLI help before changing third-party command guidance.
- Keep generated business-repo instructions in the shipped templates and validators, not in this root maintainer file.
- Keep this file as a Claude-specific pointer; detailed policy belongs in `AGENTS.md`, skill references, validators, and LaunchBench.
- Maintainer machine only: after any skill change, if `~/.codex/skills/b2c-mobile-business-launch` exists, sync and audit that installed runtime, because Claude, Agents, and Cursor all consume that installed copy through symlinks there. In clones, CI, or cloud sessions without that installed copy, skip runtime sync entirely; `npm run audit:ci` is the readiness gate.
