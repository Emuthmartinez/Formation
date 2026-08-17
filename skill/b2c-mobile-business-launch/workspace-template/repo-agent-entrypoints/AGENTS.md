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
- `APP_AGENTS.md`, then the selected `agents/<role>.md` — specialist routing and bounded handoff
- `operations/agent-operations.json` — verified capabilities and exact standing approval envelopes
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
mismatch) and, mid-session, at every dispatch-batch boundary — the run stops before it touches
anything else. The reducer is not a suggestion — it is the only path that leaves the audit trail
and out-of-band-tamper detection intact.

## Autonomy Trust Boundary (deployment sets this up)

The rules above are enforced in three layers, strongest last:

1. **Adapter tool allowlist** — a scheduled session's `Write`/`Edit` tools are denied on the
   `control/` paths, so the agent cannot edit an autonomy document with its file tools.
2. **Founder-authority gate** — the reducer refuses a `control`/`grants`/`waivers` patch unless the
   caller passes `--founder-authority`, which only the founder-initiated onboarding and approve
   flows do. The autonomous session runner never passes it, so a stray control write from
   autonomous work fails loudly. This defends against bugs, not a jailbroken agent that could pass
   the flag itself.
3. **OS write-protection (the real prevention layer — the founder/deploy step).** A scheduled
   session still runs a shell. To make self-granting genuinely impossible, the `control/` directory
   must be writable only by a uid the agent process does not run as: the scheduled session runs as
   an unprivileged user with read-only access to `control/`, and the reducer commit for an
   autonomy document runs as the founder (interactively, or via a small privileged helper the
   scheduler invokes for founder-authorized patches). Without this OS boundary, layers 1–2 are
   bug-defense only. Set it up before granting any autonomy above review-first, with:
   ```
   tsx <skill-root>/core/adapters/install-control-permissions.ts --workspace . \
       [--agent-user <name-of-the-unprivileged-scheduled-session-account>] --apply
   ```
   (`npm run install:control-permissions -- --workspace . --agent-user <name> --apply` from the
   skill root works the same way.) Default is a dry run — it prints what it would change and
   touches nothing until `--apply` is passed. It never runs `sudo`, never creates or modifies a
   user account, and never `chown`s anything; if it needs privileges it doesn't have, it prints the
   exact command for the founder to run themselves rather than attempting a workaround. Without
   `--agent-user`, or if that account doesn't exist yet, the permissions it applies are advisory
   only, not a real boundary — a scheduled session's own digest names this explicitly (via
   `verifyControlBoundary`'s `enforced` / `advisory_only` / `unprotected` verdict) whenever a grant
   above review-first is relying on a boundary that isn't genuinely enforced yet.

## How A Scheduled Session Works

An external trigger (cron/launchd, or a vendor scheduler) invokes this business's runtime adapter,
which runs a headless agent CLI with one fixed instruction: execute
`tsx <skill-root>/core/session/run.ts --workspace . --brief <brief-file> --session <id> --wall-clock-seconds <n>`
and report its output verbatim. That command — not the agent — decides what work is ready, checks
the kill switch and every autonomy grant, dispatches fresh-context specialist workers through a
real CLI executor, verifies their knowledge receipts and declared outputs, and writes the session's
digest. An interactive agent session in this repo follows the same state-first posture even though
it isn't invoked this way: read state, propose the same patches a scheduled session would produce,
and let the reducer apply them.

## Autonomy, In Plain Terms

The founder has set a grant level — review-first, run-with-guardrails, or full — for each business
unit (Product, Design, Engineering, Growth, Analytics, Revenue, Store, Trust, Operations) in
`control/control.json`. Spend, credential/access, legal/pricing, public-posting,
release/store-submission, and destructive actions additionally require an explicit, time-boxed
waiver or exact current standing envelope even at the "full" grant level — a grant alone never authorizes one of those six. Do not
treat a high grant level as blanket permission for a protected action; check for an active,
in-scope waiver or envelope first. Exact standing envelopes for website deployment, approved
assets, store metadata/media, and TestFlight/Play testing uploads are consumed without asking
again. If neither exists, park the action for the consolidated founder handoff.

## Specialist Dispatch Contract

Never send a role prompt alone. Use the graph's assembled node brief, which supplies the ordered
parent contracts, task-local artifacts, mandatory skill references, conditional role context
packs, matching installed skills, current tool-discovery routes, declared outputs, and verification.
Every worker returns `CONTRACT_FILES_LOADED`, `KNOWLEDGE_LOADED`, `ROLE_KNOWLEDGE_USED`,
`SKILLS_USED`, and `TOOLS_USED`; a missing receipt is a failed attempt.

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
