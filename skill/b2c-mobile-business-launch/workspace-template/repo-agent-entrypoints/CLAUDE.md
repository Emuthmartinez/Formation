# CLAUDE.md

Read `AGENTS.md` first; it is the canonical operating guide for {{APP_NAME}}.

Claude-specific notes:

- Scheduled sessions on Claude Code run headless (`claude -p --bare`) with `Write` and `Edit`
  denied via `--disallowedTools` — the only mutation path reachable from inside a run is the
  reducer CLI, invoked as a Bash subprocess by `core/session/run.ts`. An interactive Claude Code
  session in this repo should hold itself to the same rule even though the tool restriction isn't
  enforced then: use the reducer CLI for state changes on any of the five reducer-owned files named
  in `AGENTS.md`, never the Write or Edit tools directly.
- `ANTHROPIC_API_KEY` for a scheduled session is injected from a Doppler service token scoped to
  this business's currently active grants at session start — never a bare long-lived key sitting in
  the process environment while the session reads repo- or web-sourced content.
- Do not stage, commit, push, spend money, change pricing, mutate credentials, or mark a protected
  action done from a grant alone; check for an active waiver first (see `AGENTS.md`'s Autonomy
  section).
