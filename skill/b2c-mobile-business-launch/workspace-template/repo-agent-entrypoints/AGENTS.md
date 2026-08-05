# {{APP_NAME}} Agent Guide

This repo is the operating home for {{APP_NAME}}, a B2C mobile app business run under the
`b2c-mobile-business-launch` autonomous runtime (v2). This file is the canonical entrypoint for
every agent working here — interactive or scheduled, on Claude Code, Codex, or Cursor. `CLAUDE.md`
and `.cursor/rules/` only add runtime-specific notes; they never restate or override what is here.

## Read This First, Every Session

Reconstruct truth from these files, never from chat memory or a prior transcript:

- `state/business-state.json` — canonical business state (lanes, phase, founder-gates, narrative)
- `control/control.json` — kill switch, autonomy grants, and waivers (founder-set, per business unit)
- `control/budget-ledger.json` — spend estimates, actuals, and remaining balance per unit/period
- `run/run-state.json`, `run/checkpoint.json` — the current or most recent scheduled run's progress
- `digests/` — one file per scheduled session, written in founder-plain language; the founder's own
  view of what happened, not an internal log
- `git status --short` — anything changed outside the files above

If any of these is missing, this workspace has not finished onboarding — say so plainly rather than
inventing a starting state.

## The One Rule: Never Write Around The Reducer

`state/business-state.json`, `control/control.json` (which holds grants, waivers, and the kill
switch together), `control/budget-ledger.json`, `control/manifest.json`, and `control/audit.jsonl`
are reducer-owned. No agent — interactive or scheduled — edits these files directly with
Write, Edit, or a Bash redirect. Every change goes through the reducer CLI as a typed patch:

```
tsx <skill-root>/core/reducer/cli.ts commit --patch <patch.json> --file <target-file> \
    --manifest control/manifest.json --audit control/audit.jsonl --session <session-id>
```

A direct edit to any of those five files is caught at the next session's preflight (a state-hash
mismatch) and stops that session before it touches anything else. The reducer is not a suggestion —
it is the only path that leaves the audit trail and out-of-band-tamper detection intact.

## How A Scheduled Session Works

An external trigger (cron/launchd, or a vendor scheduler) invokes this business's runtime adapter,
which runs a headless agent CLI with one fixed instruction: execute
`tsx <skill-root>/core/session/run.ts --workspace . --brief <brief-file> --session <id> --wall-clock-seconds <n>`
and report its output verbatim. That command — not the agent — decides what work is ready, checks
the kill switch and every autonomy grant, dispatches within budget, and writes the session's
digest. An interactive agent session in this repo follows the same state-first posture even though
it isn't invoked this way: read state, propose the same patches a scheduled session would produce,
and let the reducer apply them.

## Autonomy, In Plain Terms

The founder has set a grant level — review-first, run-with-guardrails, or full — for each business
unit (Product, Design, Engineering, Growth, Analytics, Revenue, Store, Trust, Operations) in
`control/control.json`. Spend, credential/access, legal/pricing, public-posting,
release/store-submission, and destructive actions additionally require an explicit, time-boxed
waiver even at the "full" grant level — a grant alone never authorizes one of those six. Do not
treat a high grant level as blanket permission for a protected action; check for an active,
in-scope waiver first, and if there isn't one, park the action and let the digest carry it to the
founder rather than asking mid-session.

## Kill Switch

If `control.json`'s `killSwitch.engaged` is true, no autonomous work proceeds — not "proceeds
cautiously," not at all. An interactive session may still read and discuss state, but should not
dispatch further work until the founder disengages it.

## Runtime Notes

- Claude Code: see `CLAUDE.md`.
- Cursor: see `.cursor/rules/agents.mdc`.
- Codex: this file is sufficient; Codex has no separate addendum.

## Common Mistakes

- Do not hand-edit any reducer-owned file listed above — always go through the reducer CLI.
- Do not treat a digest mention of a parked item as founder approval; only an explicit founder
  response re-dates a parked gate.
- Do not invent state that is not in `state/business-state.json` — if something looks undone, it is
  undone.
- Do not copy maintainer-only instructions from the skill repo into this business repo.
