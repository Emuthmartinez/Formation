# Project State And Launch Cockpit

Use this when starting, continuing, auditing, or handing off a launch. The goal is to keep one compact, machine-readable state file that a future agent can validate before it mutates the app or claims launch readiness.

## Required Artifacts

- `PROJECT_STATE.yaml`: compact source of truth for phase, autonomy mode, orchestration strategy, lane statuses, paid-tool routing, secrets, provider setup, proof, open questions, and active failure cards.
- `launch-cockpit.html`: founder-visible rendered view of the same state.
- `BUSINESS_ACCESS.md` plus `operations/business-access.json`: founder-zero identity/access state and the versioned founder gate with phase, choices, fallback/defer behavior, lifecycle, and next actions.
- `AGENT_OPERATIONS.md` plus `operations/agent-operations.json`: human and machine state for current capabilities, exact account/environment scope, approval envelopes, authenticated actions, research/media provenance, and reconciliation.
- `state/business.json`, `state/theme.tokens.json`, and `design-room.html`: separate Design Room state/render artifacts for cross-surface design. Update these through `design-room.md` when design changes affect launch surfaces.
- `LAUNCHBENCH.md` or `proof.launchbench` in `PROJECT_STATE.yaml`: eval/check history for known failure modes.

Use `templates/PROJECT_STATE.yaml` as the starting point. Keep it names-only for secrets and credentials.

## Status Contract

Lane statuses must be one of:

- `done`: artifact, live dashboard, code path, provider state, or verification note exists.
- `partial`: work exists but the lane cannot be relied on yet.
- `blocked`: explicit blocker, owner, and next action exist.
- `not_needed`: reason is recorded and traceable to product scope.
- `deferred`: owner, reason, and revisit condition exist.

Never mark a lane `done` from prose alone. It needs evidence paths or live proof.

## Lane Dependency Contract

Lanes are not independent. `SKILL.md`'s Operating Posture rule — "Lock phase outputs before depending on them. No design from an unlocked spec, no ASO from an unlocked name" — and the Flow Gates in [`flow-traceability.md`](flow-traceability.md) describe real edges between them. `check:lane-coverage` enforces those edges mechanically:

**A lane may not be `done` while an upstream lane it depends on is `not_started`, `partial`, or `blocked`.**

- `done`, `not_needed`, and `deferred` all satisfy a dependency — the last two are resolved scope decisions (see launch tiers), not gaps.
- Working a lane *ahead* of its upstream is fine and common. Declaring it *finished* on a moving input is the drift bug this catches.
- The edge set ships in the skill (`scripts/lib/launch-state.ts`, `laneDependencies`) rather than in `PROJECT_STATE.yaml`, because an edge set a launch run can edit is an edge set a launch run can delete. It lists direct edges only; transitive ones are implied (`design → product → experience → research`).

The escape hatch is per-lane and auditable, never silent:

```yaml
lanes:
  design:
    status: "done"
    evidence:
      - "DESIGN.md"
    # Dated reason. Downgrades the edge error to a standing warning and is itself
    # checked for staleness. Use only when the lane is genuinely independent of
    # the open upstream work — not to clear a red validator.
    dependency_override: "2026-07-25 Brand and type system locked from founder identity work; the open SPEC.md item is a V2 scope question that touches no design token."
```

If an override is still present weeks later, the upstream lane never locked and this lane's evidence rests on a moving input — that is the signal to revisit, not to re-date the override.

## Update Cadence

Update `PROJECT_STATE.yaml`:

- at the start of a new session after source-truth recovery
- before using a paid/account-gated fallback
- before dispatching subagents, worktrees, or parallel specialist audits
- when a new secret, provider, bundle ID, app record, product, entitlement, analytics event, email route, or store field appears
- before crossing research -> 11-star experience, experience -> design, design -> build, build -> proof, or proof -> submission
- after any build is archived, exported, or uploaded to App Store Connect or Google Play — update the `apple_signing` lane evidence, build number, upload status, and `updated_at` before committing
- after any store-ops event (custom product page created, in-app event attempted or submitted, iPad/new-platform target enabled, TestFlight group added, app record mutated) — update the affected lane status/evidence before committing
- before and after any authenticated browser/account/provider/social/native-device action — refresh `agent_operations`, the structured ledger, affected canonical docs, provider proof, and cockpit
- after validation or LaunchBench runs
- after any Design Room mutation that changes launch surfaces, App Store creative, onboarding, paywalls, landing pages, or marketing assets
- before final handoff or commit

If `PRODUCTION_READINESS.md` evidence is produced during an audit session, write it to the file in that session — do not defer the write. Verbal or in-chat readiness notes that are not written to `PRODUCTION_READINESS.md` are not counted as evidence by validators. (Failure card: `project-state-stale-after-upload`.)

## State Rules

- `autonomy.mode` controls what the agent may do without founder approval. See `autonomy-modes.md`.
- `project.launch_tier` scopes the artifact burden: `full` (default) runs every lane; `lite` defers the named breadth lanes with dated reasons through normal deferral mechanics (see `launch-phases.md` "Launch Tiers"). Only `full`/`lite` are valid; the tier never silently disables a validator.
- top-level `orchestration` records preflight, strategy, candidate units, parallel-safe units, serialized units, spawned agents, collision checks, output review, state reconciliation, and validators.
- top-level `compound_engineering` records whether Compound Engineering skills were available, used, blocked, or replaced with an equivalent fallback.
- top-level `agent_operations` points to the human log and structured ledger, records capability freshness and active approvals, and confirms state reconciliation; use `frontier-agent-operations.md` rather than treating account access as blanket permission.
- top-level `business_operator` assumes beginner founder knowledge, makes the agent the operating lead, and mirrors Doppler/social readiness plus `current_phase*`, `active_gate_*`, `question_mode`, and the founder/agent next actions from the ledger.
- `tools.*.docs_checked_at` records current-doc refresh dates for fast-moving CLIs and providers.
- `tools.*.required_secrets` lists names only. Values belong in Doppler or the approved provider.
- `lanes.security` tracks `SECURITY.md`, `security-review.html`, security tool routing, accepted risks, and release proof.
- `lanes.experience` tracks `11_STAR_EXPERIENCE.md`, `11-star-experience.html`, the line of feasibility, and the V1 scalable slice.
- `lanes.analytics_attribution.attribution_contract` is a hard data contract, not a UI note.
- `lanes.paid_user_acquisition` tracks `PAID_UA.md`, one-channel paid acquisition fit, creative cadence, tracking baseline, blended report, RevenueCat economics, stop/scale rules, and founder-only spend gates.
- `lanes.growth` tracks `VIRAL_GROWTH.md`, product-led referral/share mechanics, content format evidence, UGC/Fastlane state, and growth proof.
- `lanes.post_launch_ops` tracks `POST_LAUNCH_OPS.md` (the live-app operating runbook: weekly rhythm, crash triage, review responses, release cadence, retention review, support) and `LAUNCH_RETRO.md`; it stays not_started or deferred-with-reason until the app is live, then gates on `check:post-launch`.
- `proof.commands` should include command, expected result, actual result, and evidence path.
- `failure_cards.active` should point to concrete risks, not generic reminders.

## Validation Commands

When the app repo has this skill's scripts copied or callable from the skill path:

```bash
npm run validate:launch-state -- --root /path/to/app
npm run check:attribution -- --root /path/to/app
npm run check:secrets -- --root /path/to/app
npm run check:security -- --root /path/to/app
npm run check:11-star -- --root /path/to/app
npm run check:viral-growth -- --root /path/to/app
npm run check:paid-ua -- --root /path/to/app
npm run check:orchestration -- --root /path/to/app
npm run check:apple-signing -- --root /path/to/app
npm run check:apple-requirements -- --root /path/to/app
npm run check:store-console -- --root /path/to/app
npm run check:store-screenshots -- --root /path/to/app
npm run check:agent-operations -- --root /path/to/app
npm run check:founder-operator -- --root /path/to/app
npm run render:launch-cockpit -- --root /path/to/app
```

If the scripts are executed directly from the installed skill, run them with `tsx` and pass `--root` to the app repo.

## Launch Cockpit

Render `launch-cockpit.html` whenever state changes materially. It should show:

- project, phase, platform, bundle IDs, and autonomy mode
- orchestration strategy, serialized resources, spawned-agent status, and collision/reconciliation proof
- lane statuses and evidence paths
- 11-star experience status, visual proof, and V1 scalable slice blockers
- paid-tool/provider route, docs checked date, required secret names, preflight, validation, and fallback
- attribution contract completeness
- security lane, accepted risks, and security-tool routing
- active failure cards and founder-only gates
- latest proof commands and blocked next actions

The cockpit is not a replacement for canonical docs. It is a dashboard over them.

## Acceptance

- A future agent can tell what to work on next without rereading every artifact.
- The founder can see blockers, proof, and approvals in one rendered HTML file.
- Validators catch the known failure modes before a launch is called ready.
- State never contains raw secrets, passwords, private keys, credential file contents, or real-looking placeholder secrets.
