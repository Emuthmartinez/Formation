# Orchestration

## Orchestration Preflight

Current objective:

Critical path the orchestrator will keep locally:

Parallelism decision:

Strategy: `not_evaluated`

Rationale:

Manager pattern: one orchestrator owns user thread, state, integration, git, provider mutations, and release decisions.

Subagent availability:

If broad work is kept inline, record why subagents are unavailable, unsafe, or not useful.

## Session Continuity

Last state review:

Continuity source set: `AGENTS.md`, `PROJECT_STATE.yaml`, `launch-cockpit.html`, `BUSINESS_ACCESS.md`, `operations/business-access.json`, `AGENT_OPERATIONS.md`, `operations/agent-operations.json`, `ORCHESTRATION.md`, `PRODUCTION_READINESS.md`, `FAILURE_CARDS.md`

Memory policy: Do not rely on chat memory or prior transcripts as source truth; if they conflict with repo state, repo state wins.

Git status reviewed:

Drift risks or stale assumptions:

Next action:

State or cockpit rerender needed:

## Compound Engineering Routing

Availability:

CE freshness check:

CE skill inventory:

Route:

- `ce-update` or latest-release fallback:
- `ce-brainstorm`:
- `ce-plan`:
- `ce-work`:
- `ce-worktree`:
- `ce-code-review`:
- `ce-test-browser` / `ce-test-xcode` / MobAI:
- `ce-proof` / `ce-demo-reel`:

Fallback reason if unavailable:

## Candidate Units

| ID | Role | Objective | Mode | Files | Shared resources | Parallel safe | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| product-audit | product leader | Audit scope, 11-star experience, onboarding, activation, and traceability. | read_only | `SPEC.md`, `11_STAR_EXPERIENCE.md`, `ONBOARDING.md`, `LAUNCH_TRACE.md` | none | yes | pending |

## Parallel Safety Check

File-overlap check:

Shared mutable resources:

Units forced to serialize:

Worktree isolation needed:

## File Ownership

The orchestrator owns `PROJECT_STATE.yaml`, `launch-cockpit.html`, `BUSINESS_ACCESS.md`, `operations/business-access.json`, `AGENT_OPERATIONS.md`, `operations/agent-operations.json`, `ORCHESTRATION.md`, `ENGINEERING_PLAN.md`, `PRODUCTION_READINESS.md`, failure cards, git, and release coordination.

Specialists may edit only the file paths assigned in their prompt. Read-only auditors do not edit files.

## Serialized Work

- Provider/account mutations
- Founder gates, business identity, account creation/delegation, recovery, and 2FA
- Authenticated browser profiles, public replies/posts, and external action ledgers
- Credentials and secrets
- MobAI, simulator, or device control on the same target
- Git staging, commits, merges, pushes, tags, and releases
- App Store, Google Play, social posting, pricing, legal approval, and final launch decisions

## Subagent Instructions

All subagents receive:

```text
You are not alone in this repo. Do not revert or overwrite work by other agents.
Allowed write scope: read-only unless a specific path list is assigned.
Forbidden actions: do not stage files, commit, push, merge, run project-wide suites, mutate providers, change credentials, post publicly, submit builds, or make founder-only decisions.
Output: docs/files read, findings or changes, files changed if any, validation run or recommended, blockers, and failure cards.
```

## Integration Plan

After subagents return, the orchestrator reviews outputs, compares actual modified files, accepts or rejects findings, updates state, runs focused validators, then runs the full relevant suite.

## Verification

Focused validators:

Full suites:

Proof paths:

## Founder-Only Gates

- Spending, paid subscriptions, paid render infrastructure, and creator payments
- Credentials, account access, provider connections, and secret changes
- Pricing, legal acceptance, public claims, app-store submission, public posting, scheduling, and destructive repo actions

## State Updates

Update `PROJECT_STATE.yaml` top-level `orchestration` after the preflight, after subagent dispatch, after integration, and before launch-ready claims.

Render `launch-cockpit.html` after material state changes.

## Failure Cards

Create or update a failure card when:

- parallel safety is unclear
- a subagent finds a launch-grade gap
- actual modified files collide
- a founder-only gate blocks progress
- validators fail or proof is missing
