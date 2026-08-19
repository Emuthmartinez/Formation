# Project State And Launch Cockpit

Use this when starting, continuing, auditing, or handing off a launch. The goal is to keep one compact, machine-readable state file that a future agent can validate before it mutates the app or claims launch readiness.

## Required Artifacts

- `state/PROJECT_STATE.yaml`: compact source of truth for phase, autonomy mode, orchestration strategy, lane statuses, paid-tool routing, secrets, provider setup, proof, open questions, and active failure cards.
- `state/launch-cockpit.html`: founder-visible rendered view of the same state.
- `operations/BUSINESS_ACCESS.md` plus `operations/business-access.json`: founder-zero identity/access state and the versioned founder gate with phase, choices, fallback/defer behavior, lifecycle, and next actions.
- `operations/AGENT_OPERATIONS.md` plus `operations/agent-operations.json`: human and machine state for current capabilities, exact account/environment scope, approval envelopes, authenticated actions, research/media provenance, and reconciliation.
- `studio/seed/business.json`, `studio/seed/theme.tokens.json`, and `design/design-room.html`: separate Design Room state/render artifacts for cross-surface design. Update these through `design-room.md` when design changes affect launch surfaces.
- `LAUNCHBENCH.md` or `proof.launchbench` in `state/PROJECT_STATE.yaml`: eval/check history for known failure modes.

Use `workspace/business/state/PROJECT_STATE.yaml` as the starting point. Keep it names-only for secrets and credentials.

## Definition Graph Version

`definition_graph_version` records which immutable skill topology the business state was seeded against. It does not copy lane dependencies, provider contracts, operator permissions, or workflow definitions into mutable state. Existing business repos without the field remain readable; the next state reconciliation adds the current graph version without changing evidence, blockers, approvals, or decisions.

## Status Contract

Lane statuses must be one of:

- `done`: artifact, live dashboard, code path, provider state, or verification note exists.
- `partial`: work exists but the lane cannot be relied on yet.
- `blocked`: explicit blocker, owner, and next action exist.
- `not_needed`: reason is recorded and traceable to product scope.
- `deferred`: owner, reason, and revisit condition exist.

Never mark a lane `done` from prose alone. It needs evidence paths or live proof.

## The Pre-Build Clock

Record `project.kickoff_date` (ISO) when orient completes. Pre-build work — research through design, phases 0–2 — is a means, not a residence: on an essentials scope the target is a submitted build within about six founder-weeks. `validate:launch-state` errors on an invalid or future kickoff date and warns (`project.pre_build_stall`) when a launch is still in phases 0–2 more than 45 days after kickoff. The response is a founder decision, not silence — cut scope to essentials, run the Go/Pivot/Kill checkpoint again, or record the deliberate choice to continue with a dated reason. Most launches that die do so here, quietly; the clock makes the quiet visible.

## Lane Dependency Contract

Lanes are not independent. `SKILL.md`'s Operating Posture rule — "Lock phase outputs before depending on them. No design from an unlocked spec, no ASO from an unlocked name" — and the Flow Gates in [`flow-traceability.md`](../process/flow-traceability.md) describe real edges between them. `check:lane-coverage` enforces those edges mechanically:

**A lane may not be `done` while an upstream lane it depends on is `not_started`, `partial`, or `blocked`.**

- `done`, `not_needed`, and `deferred` all satisfy a dependency — the last two are resolved scope decisions (see launch scopes), not gaps.
- Working a lane *ahead* of its upstream is fine and common. Declaring it *finished* on a moving input is the drift bug this catches.
- The edge set ships in the skill (`tooling/lib/launch-state.ts`, `laneDependencies`) rather than in `state/PROJECT_STATE.yaml`, because an edge set a launch run can edit is an edge set a launch run can delete. It lists direct edges only; transitive ones are implied (`design → product → experience → research`).

The escape hatch is per-lane and auditable, never silent:

```yaml
lanes:
  design:
    status: "done"
    evidence:
      - "design/design.md"
    # Dated, substantive reason. Downgrades the edge error to a standing warning
    # and is itself checked for staleness. An undated or trivial override buys
    # nothing — the edge error stands until the reason carries an ISO date and
    # the concrete independence rationale. Use only when the lane is genuinely
    # independent of the open upstream work — not to clear a red validator.
    dependency_override: "2026-07-25 Brand and type system locked from founder identity work; the open product/SPEC.md item is a V2 scope question that touches no design token."
```

If an override is still present weeks later, the upstream lane never locked and this lane's evidence rests on a moving input — that is the signal to revisit, not to re-date the override.

## Founder-Gate Re-Engagement

A founder gate is a pause awaiting a decision, not a termination. The observed failure on real launches: `blockers: ["founder-gated: paid campaign launch and budget spend"]` sat unchanged for months while the fully planned spend never turned on — nobody decided that outcome; the question just never came back.

The contract:

- An **active** founder gate uses the canonical prefix syntax — the blocker starts with `founder-gated`, `founder-only`, or `awaiting founder`; a standing policy note ("Founder approval is required before paid spend") is a reminder, not a gate, and is never aged. Every founder-gated blocker carries the ISO date it was **last presented**, in the documented position — between the gate keyword and the colon: `founder-gated 2026-07-26: paid campaign launch and budget spend`. A date elsewhere in the text (a campaign date, a deadline) does not count; `check:lane-coverage` reads only the presentation slot. Re-dating happens only when the gate is actually re-presented and the founder responds — never to quiet a validator.
- At session start and in the weekly ops review, re-present any founder gate older than 30 days: what the gate is, what changed since it was last asked (new numbers, new evidence, new deadline), and the same choices as before with a recommendation. The founder may approve, defer again (re-date), or drop the lane (`not_needed` with a dated reason).
- Silence defers again; it never converts to approval, and it never means forever.
- `check:lane-coverage` warns pre-launch on undated founder gates and on gates past the 30-day window; once the app is live (`phase_6`/`phase_6b`) both are errors — a live app with its growth levers parked behind a forgotten question is the distribution-never-turns-on failure mode.

## Update Cadence

Update `state/PROJECT_STATE.yaml`:

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

Create the Git repository and the first source checkpoint before broad build work starts. The checkpoint must include the source that the build uses. Run `check:source-checkpoint` before you report engineering progress. The check gives a warning during setup. The check gives an error after build work starts in these conditions:

- The project is not the repository root.
- The repository contains no commit.
- The repository contains untracked source files.

Build output and an engine audit log do not replace a source checkpoint.

If `engineering/PRODUCTION_READINESS.md` evidence is produced during an audit session, write it to the file in that session — do not defer the write. Verbal or in-chat readiness notes that are not written to `engineering/PRODUCTION_READINESS.md` are not counted as evidence by validators. (Failure card: `project-state-stale-after-upload`.)

## State Rules

- `autonomy.mode` controls what the agent may do without founder approval.
- `project.launch_scope` sizes the work to the product: `essentials` (the recommended default for a first launch, and the shipped template's seed) runs the core spine and defers the named breadth lanes with dated reasons through normal deferral mechanics; `full` runs every lane and is a deliberate flagship choice (see `launch-phases.md` "Launch Scopes"). Only `full`/`essentials` are valid, and the scope never silently disables a validator. It is named scope rather than tier because "tier" collided with the founder's own app pricing tiers, which is an unrelated decision. **Backward compatible:** the legacy `project.launch_tier` key is still read and the legacy value `lite` still resolves to `essentials`, so a business repo launched before the rename keeps validating without a migration. New state files use `launch_scope`.
- top-level `orchestration` records preflight, strategy, candidate units, parallel-safe units, serialized units, spawned agents, collision checks, output review, state reconciliation, and validators.
- top-level `compound_engineering` records whether Compound Engineering skills were available, used, blocked, or replaced with an equivalent fallback.
- top-level `agent_operations` points to the human log and structured ledger, records capability freshness and active approvals, and confirms state reconciliation; use `frontier-agent-operations.md` rather than treating account access as blanket permission.
- top-level `business_operator` assumes beginner founder knowledge, makes the agent the operating lead, and mirrors Doppler/social readiness plus `current_phase*`, `active_gate_*`, `question_mode`, and the founder/agent next actions from the ledger.
- `tools.*.docs_checked_at` records current-doc refresh dates for fast-moving CLIs and providers.
- `tools.*.required_secrets` lists names only. Values belong in Doppler or the approved provider.
- `lanes.security` tracks `trust/SECURITY.md`, `trust/security-review.html`, security tool routing, accepted risks, and release proof.
- `lanes.experience` tracks `11_STAR_EXPERIENCE.md`, `11-star-experience.html`, the line of feasibility, and the V1 scalable slice.
- `lanes.analytics_attribution.attribution_contract` is a hard data contract, not a UI note.
- `lanes.paid_user_acquisition` tracks `PAID_UA.md`, one-channel paid acquisition fit, creative cadence, tracking baseline, blended report, RevenueCat economics, stop/scale rules, and founder-only spend gates.
- `lanes.growth` tracks `VIRAL_GROWTH.md`, product-led referral/share mechanics, content format evidence, UGC/Fastlane state, and growth proof.
- `lanes.post_launch_ops` tracks `operations/POST_LAUNCH_OPS.md` (the live-app operating runbook: weekly rhythm, crash triage, review responses, release cadence, retention review, support) and `operations/LAUNCH_RETRO.md`; it stays not_started or deferred-with-reason until the app is live, then gates on `check:post-launch`.
- `proof.commands` should include command, expected result, actual result, and evidence path.
- `failure_cards.active` should point to concrete risks, not generic reminders.

## Validation Commands

When the app repo has this skill's scripts copied or callable from the skill path:

```bash
npm run validate:launch-state -- --root /path/to/app
npm run check:attribution -- --root /path/to/app
npm run check:secrets -- --root /path/to/app
npm run check:security -- --root /path/to/app
npm run check:paid-ua -- --root /path/to/app
npm run check:orchestration -- --root /path/to/app
npm run check:apple-requirements -- --root /path/to/app
npm run check:store-console -- --root /path/to/app
npm run check:store-screenshots -- --root /path/to/app
npm run check:agent-operations -- --root /path/to/app
npm run check:founder-operator -- --root /path/to/app
npm run check:source-checkpoint -- --root /path/to/app
npm run render:launch-cockpit -- --root /path/to/app
```

If the scripts are executed directly from the installed skill, run them with `tsx` and pass `--root` to the app repo.

## Launch Cockpit

Render `state/launch-cockpit.html` whenever state changes materially. It should show:

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

The first section is a short milestone digest. It contains only:

- the concrete result since the prior update
- the work that happens next
- one current founder action, when the work needs one

Do not repeat the founder action in several summary sections. Put its choices and consequences in the decision section. Do not show the complete service inventory or secret-name list on the main page. Show counts for services that are ready, waiting for access, or planned. Keep exact routes and service setup detail in the closed technical section.

The cockpit must agree with its source state. `check:founder-copy` detects these errors:

- a stale project name or template text after setup
- service or progress counts that do not agree with the state
- a connected service that is also blocked
- saved check evidence without a result
- repeated or empty update sentences

Correct the source state. Then, render the cockpit again.

Rendering the file is necessary but not sufficient. The founder does not sit refreshing an HTML file in a git repo — in autopilot runs, subagent dispatches, and long workflow sessions nobody may be watching anything when the render lands. Whenever the cockpit is (re)rendered or a launch session ends, say the narrative in the reply itself: what changed since last time, what is happening now, and what needs the founder (the same three beats the cockpit's `narrative` block carries). A milestone the founder was never told about did not land as a milestone.

Progress beats follow the same say-then-record loop: when a phase exit earns a celebration beat, the cockpit shows it as a "Worth a moment" card until `narrative.last_celebrated_phase` records it as spoken. Say the beat in the reply, then set the field — never set the field without having said it, and never re-celebrate a phase the field already names.

## Acceptance

- A future agent can tell what to work on next without rereading every artifact.
- The founder can see blockers, proof, and approvals in one rendered HTML file.
- Validators catch the known failure modes before a launch is called ready.
- State never contains raw secrets, passwords, private keys, credential file contents, or real-looking placeholder secrets.
