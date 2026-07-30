# Engineering Orchestration And Production Readiness

Use this before building the actual app, coordinating frontend/backend work, writing `AGENTS.md` or `CLAUDE.md`, creating `TECH_SPEC.md` or `ENGINEERING_PLAN.md`, dispatching subagents, using Compound Engineering skills, or declaring production readiness.

Load `parallel-agent-orchestration.md` alongside this file before multi-lane work, subagent dispatch, worktree routing, `ORCHESTRATION.md`, or any claim that parallel agents were used safely.

The goal is to turn the launch package into shippable software without losing strategy, design, analytics, entitlement, or testing truth.

## Contents

- 1. Compound Engineering Routing
- 1b. Standalone Engineering Loop (CE Unavailable)
- 2. Autonomy And Project State
- 3. 11-Star Experience And Product Brainstorm Checkpoint
- 4. Agent Entrypoints
- 4b. App-Local Agent Roster
- 5. Parallel Agent Orchestration
- 6. `ENGINEERING_PLAN.md` Requirements
- 7. End-To-End Production Readiness
- 8. MobAI, Native iOS Proof, And Device Testing
- 9. LaunchBench And Failure Cards
- 10. Done Rules

## 1. Compound Engineering Routing

Load `compound-engineering-routing.md` first for the enforceable route, state contract, freshness check, and artifact requirements.

Use Compound Engineering skills for non-trivial engineering-heavy work when available:

- `ce-brainstorm`: use after research when product shape, user behavior, scope boundaries, or success criteria are still ambiguous.
- `ce-plan`: use when research/spec/design/analytics docs are ready and the app needs an implementation plan.
- `ce-work`: use to execute a concrete plan or bounded implementation prompt.
- `ce-worktree`: use for isolated parallel feature lanes, PR review, or when the current checkout must stay clean.
- `ce-code-review`: use when implementation should be reviewed against requirements and autofixed when possible.
- `ce-test-browser`: use for web/local browser verification.
- `ce-test-xcode`: use for iOS build/test verification when applicable.
- `ce-proof` or `ce-demo-reel`: use when a visual or behavioral proof artifact helps the founder or reviewer inspect what shipped.

Do not route tiny doc-only edits or one-file copy changes through the full pipeline. Use Compound Engineering where the app build is multi-step, cross-surface, or production-sensitive. For core engineering work, record the route in `PROJECT_STATE.yaml` `compound_engineering`, `ORCHESTRATION.md`, `ENGINEERING_PLAN.md`, and `PRODUCTION_READINESS.md`.

If Compound Engineering skills are unavailable in the current runtime, do not silently skip them. Record the unavailable route and equivalent fallback in `ORCHESTRATION.md`, `PROJECT_STATE.yaml`, and `ENGINEERING_PLAN.md`, then run the Standalone Engineering Loop below — a fallback reason alone is documentation, not a path. `check:compound-engineering` errors when CE is unavailable and `ENGINEERING_PLAN.md` does not record the loop.

## 1b. Standalone Engineering Loop (CE Unavailable)

The Standalone Engineering Loop is the in-skill engineering path when `compound_engineering.availability` is `unavailable` or the route is `ce_fallback`. It works in any runtime — clone, CI, cloud session, or a machine without the CE plugin — and holds the same evidence bar as the CE pipeline. Record `Standalone Engineering Loop` in `ENGINEERING_PLAN.md` together with the `fallback_reason` in `PROJECT_STATE.yaml`.

The five stages, each with a CE-equivalent artifact:

1. **Plan** (replaces `ce-plan`): write `ENGINEERING_PLAN.md` to the full §6 contract — requirements trace, implementation units with repo-relative paths, orchestration strategy, secret/flag/migration impacts, and test scenarios. If product shape is still ambiguous, resolve it with founder questions or an explicit assumptions block (replaces `ce-brainstorm`) before planning.
2. **Bounded slices** (replaces `ce-work`): execute one implementation unit at a time against the plan; never let a slice grow past its named files without updating `ORCHESTRATION.md`. Use worktrees or subagent file-ownership lanes per `parallel-agent-orchestration.md` when isolation helps (replaces `ce-worktree`).
3. **Adversarial review** (replaces `ce-code-review`): review each slice against the plan's requirements with a separate pass — a different agent, subagent, or at minimum a fresh session that reads the diff against `ENGINEERING_PLAN.md` and `TECH_SPEC.md` contracts. The producer of a slice is not its only reviewer.
4. **Test** (replaces `ce-test-browser`/`ce-test-xcode`): run the plan's test scenarios — happy path, edge, error, integration — plus the device/simulator routes from §8 when mobile journeys are in scope.
5. **Proof** (replaces `ce-proof`/`ce-demo-reel`): produce inspectable evidence — screenshots, run logs, validator output, backend records — and attach it to `PRODUCTION_READINESS.md` exactly as the CE route would.

Do not downgrade the bar because CE is missing: the engineering lane stays `partial` until all five stages have evidence, and §7 production-readiness gates apply unchanged.

## 2. Autonomy And Project State

Before implementation starts, create or refresh `PROJECT_STATE.yaml` and choose an autonomy mode:

- `scout`: read/research only
- `draft`: local docs and mocks
- `prepare`: setup plans and preflight packets
- `apply`: repo edits and tests
- `mutate`: founder-approved provider/API/CLI mutations
- `ship`: founder-approved release, submission, or public posting

Implementation work normally runs in `apply`. Provider/store/social mutations require `mutate` or `ship` with a named founder approval scope.

The orchestrator owns state updates:
- lane status and blockers
- provider docs checked date, preflight, validation, fallback, and required secret names
- proof commands and evidence paths
- active failure cards
- top-level `orchestration` strategy, candidate units, serialized resources, spawned agents, collision checks, integration proof, and validator runs
- LaunchBench/validator runs

Render `launch-cockpit.html` after material changes so the founder can inspect state without reading every doc.

## 3. 11-Star Experience And Product Brainstorm Checkpoint

After research and before engineering specs are actioned, decide whether the product is ready for implementation planning.

Create or update `11_STAR_EXPERIENCE.md` and `11-star-experience.html` before engineering work starts. The engineering plan should inherit the V1 scalable slice, not invent the magical moment from screen sketches.

Use `ce-brainstorm` when:
- AppKittie/XPOZ/Firecrawl findings reveal competing wedges.
- V1/V2/V3 boundaries are still disputed.
- onboarding, paywall, core loop, or activation can reasonably take multiple product shapes.
- user roles, data ownership, or success criteria are unclear.
- the agent would otherwise invent product behavior inside an engineering plan.

Outputs from the brainstorm should become the product requirements source for `ce-plan`. Preserve product intent, actors, key flows, acceptance examples, scope boundaries, and explicit non-goals.

If the research already makes the product direction obvious, skip the brainstorm and go directly to `ce-plan`.

## 4. Agent Entrypoints

Every real app build or builder handoff should create or update a business-specific `AGENTS.md` from `business/repo-agent-entrypoints/AGENTS.md`. Do not copy the skill repo's maintainer `AGENTS.md`. Keep `AGENTS.md` as a map to source docs, active plans, validation commands, and failure cards instead of a duplicate manual.

`AGENTS.md` must include:
- 60-second product brief
- explicit instruction to keep using `b2c-mobile-business-launch` for broad launch/business work without requiring another founder prompt
- repo map and first files to read
- source-of-truth docs: `SPEC.md`, `RESEARCH.md`, `LAUNCH_TRACE.md`, `11_STAR_EXPERIENCE.md`, `TECH_SPEC.md`, `DESIGN.md`, `design.md`, `COPY_DECK.md` (every user-facing string; builders type deck rows, never spec vocabulary — `conversion-copy.md`), `ANALYTICS.md`, `ONBOARDING.md`, `REVENUE_OPS.md`, `PRIVACY.md`, `APPLE_SIGNING.md`, `STORE_CONSOLE.md`
- `PROJECT_STATE.yaml`, `launch-cockpit.html`, active failure cards, and autonomy mode
- V1 scope, V2/V3 scope, and banned scope
- design-system and HTML proof rules
- analytics and attribution rules
- RevenueCat/Stripe entitlement rules when monetized
- secret-management rules: `SECRETS.md`, Doppler or approved provider, `doppler run --` wrappers, service token/provider-integration plan, CI/deploy injection, and no raw secrets in docs/logs/proofs
- privacy/legal/store disclosure constraints
- Compound Engineering routing: when to use `ce-brainstorm`, `ce-plan`, `ce-work`, worktrees, subagents, and review
- MobAI/native iOS/device-testing rules and serialized device ownership
- paid-tool routing and confirmed MobAI/XcodeBuildMCP fallback rules plus SnapshotPreviews/serve-sim limits
- backend/frontend E2E proof requirements
- common mistakes and launch blockers
- exact verification commands or scripts when known
- bundled validator/LaunchBench commands when copied into or callable from the repo

`CLAUDE.md` should exist when Claude Code or a builder expects it. Start from `business/repo-agent-entrypoints/CLAUDE.md` and keep it short:
- point to `AGENTS.md` as canonical
- remind Claude to keep using `b2c-mobile-business-launch` for launch/business work
- list Claude-specific skills/plugins/tools if useful
- avoid duplicating product truth that will drift

Do not let generated builders rely on a prompt only. Durable repo-local instructions are part of the launch package.

### 4b. App-Local Agent Roster

Every real app build or builder handoff should include `APP_AGENTS.md` and a tiny `agents/` directory so future work can continue without reinventing responsibilities.

Required roles:
- orchestrator: owns canonical docs, `PROJECT_STATE.yaml`, `launch-cockpit.html`, failure cards, sequencing, subagent routing, file-overlap checks, integration, git/release coordination, and production-readiness proof
- marketing guru: owns ASO, GEO/SEO, Fastlane, UGC, reviews, launch calendar, claims, attribution learning, and channel experiments
- engineering leader: owns architecture, `TECH_SPEC.md`, `ENGINEERING_PLAN.md`, provider/backend/frontend proof, Apple signing/release gates, observability, tests, and readiness gates
- security architect: owns `SECURITY.md`, threat model, security tool routing, platform hardening, app integrity, entitlement/webhook abuse controls, scanner/review proof, accepted risks, and incident response
- product leader: owns ICP, V1/V2/V3 scope, onboarding, activation, retention loops, and evidence-to-product traceability
- design guru: owns `DESIGN.md`, `design.md`, HTML visual proofs, accessibility, screenshots, icons, motion, and Higgsfield asset fit
- customer success: owns support/privacy/delete/refund/restore paths, FAQ/help, lifecycle copy, review responses, and feedback triage

Keep each role prompt short: mission, canonical docs to read first, responsibilities, forbidden actions, founder-only gates, and required output shape. Role agents review and propose by default. They may implement only when the orchestrator assigns an isolated unit with a file-overlap check and verification plan.

## 5. Parallel Agent Orchestration

Use `parallel-agent-orchestration.md` as the detailed contract. This section is the engineering-specific summary.

At the start of broad launch or build work, the orchestrator should ask:
- what critical-path work should stay local
- what independent sidecar work can run in parallel
- which specialists can improve consistency or catch launch-grade misses
- which files, providers, devices, accounts, and git actions are shared resources
- whether the current runtime actually allows subagent delegation

For broad multi-lane work, the orchestrator must either dispatch read-only or isolated specialist audits from `APP_AGENTS.md`, or record why subagents are unavailable, unsafe, or not useful in `ORCHESTRATION.md` and `PROJECT_STATE.yaml`.

Good parallel lanes:
- AppKittie competitor/review pass, XPOZ social-language pass, Firecrawl web pass
- privacy/data inventory, ASO metadata, analytics catalog, and design audit when files do not overlap
- independent skill-definition audits for attribution, onboarding, analytics, revenue, store, privacy, security, design, and production-readiness coverage
- frontend and backend implementation in separate repos or isolated worktrees
- test-writing or fixture-building units with non-overlapping files
- screenshot planning, store-console copy, and launch calendar drafting

Do not parallelize:
- edits to the same files
- migrations plus backend code that depend on the migration state unless sequenced
- device automation on the same simulator/device
- git staging, commits, merges, or releases
- final production-readiness decision

Parallel safety check:
- Map every candidate unit to create/modify/test files.
- If two units touch the same file, run them serially.
- Record the decision in `ORCHESTRATION.md` and the top-level `PROJECT_STATE.yaml` `orchestration` block before dispatch.
- Use specialist subagents to audit against the skill definition before declaring completeness, especially for attribution, monetization, store-console, privacy, email, and E2E readiness.
- Use one orchestrator to reconcile `PROJECT_STATE.yaml` and failure cards after parallel work; specialists should not independently mark lanes done.
- For parallel implementation in one repo, the orchestrator owns staging, commits, and full test suites.
- Instruct parallel subagents not to run project-wide suites, stage files, or commit.
- After parallel work returns, compare actual modified files, resolve collisions, run focused tests, then run integration/E2E suites.

Use `ce-worktree` when parallel engineering lanes need isolation. Prefer meaningful branch/worktree names such as `feat/onboarding-analytics` or `fix/revenuecat-entitlement-sync`.

MobAI is serialized: one orchestrator owns the device flow, while other agents may inspect code, prepare fixtures, or analyze logs in parallel. Its free tier needs no spend approval; Plus/Pro-only capabilities do. If MobAI is unavailable, use `paid-tool-routing.md` before substituting XcodeBuildMCP or another device/simulator route because the replacement changes platform coverage and proof quality.

## 6. `ENGINEERING_PLAN.md` Requirements

Before `ce-work` or a generated builder starts, produce `ENGINEERING_PLAN.md` through `ce-plan` or an equivalent implementation-plan doc.

The plan must include:
- requirements trace to launch docs and `LAUNCH_TRACE.md` IDs
- 11-star V1 scalable slice, line of feasibility, and magical-moment proof requirements
- `PROJECT_STATE.yaml` phase, autonomy mode, active blockers, and failure cards that constrain implementation
- `TECH_SPEC.md` pointer or inline technical contracts when data/API/state/integration behavior is in scope
- `COPY_DECK.md` coverage for every screen the units build, and the string-externalization mechanism from `TECH_SPEC.md` §Strings And Localization Readiness
- implementation units with repo-relative file paths
- orchestration strategy, candidate units, safe parallel lanes, serialized lanes, worktree needs, shared resources, and subagent forbidden actions from `ORCHESTRATION.md`
- frontend, backend, database, analytics, revenue, email, and store-console impacts
- secret impacts: new secret or env var, secret class, Doppler/provider routing, service token/provider-integration plan, CI/deploy injection, `.env.example` names-only updates, and bundle-safety checks
- feature flags or rollout controls
- migration and data-backfill plan when needed
- auth/session, permission, app integrity, API/RPC/webhook, and state-machine impacts when relevant
- test scenarios for happy path, edge cases, error paths, and integration paths
- MobAI/native iOS/device-test scenarios for mobile user journeys, plus XcodeBuildMCP/SnapshotPreviews/serve-sim scenarios when they are the Apple-platform proof route
- backend verification scenarios showing real test data persisted or projected correctly
- production-readiness gates and known blockers
- validator and LaunchBench checks that must pass before done

Do not put unsupported product behavior into `ENGINEERING_PLAN.md`. Send unresolved product questions back to `ce-brainstorm` or make explicit assumptions.

## 7. End-To-End Production Readiness

Do not mark an app build production-ready from unit tests alone.

Required proof, adjusted to the product:
- build/typecheck/lint pass for every touched repo
- unit tests for pure logic and edge cases
- integration tests for app-to-backend, provider callbacks, database writes, entitlement projection, email sends, and analytics wrappers
- browser E2E for web funnels, checkout, privacy/terms pages, support flows, and dashboards where applicable
- mobile E2E for onboarding, attribution, paywall, restore, activation, settings, account deletion, and screenshot-critical flows: in-app iOS Simulator (rung 0) for iOS-only walkthroughs and repro, MobAI for Android coverage and repeatable suites, XcodeBuildMCP when the lane needs scripted/CI builds or physical hardware — record the rung used and the coverage it does not provide
- backend proof that frontend actions create the expected records/events in the real test backend, database, Firestore/Supabase/Postgres, RevenueCat, Stripe, Resend, or PostHog target
- app integrity, rate-limit, idempotency, and abuse-path proof when paid access, user accounts, sensitive data, or backend mutation are in scope
- release-build or staging-build verification that mocks are disabled, production flags are sane, and secrets are not bundled
- secret-management verification: `SECRETS.md` covers all secret-bearing services, commands use `doppler run --` or the approved provider wrapper, CI/deploy injects secrets from the selected provider, and public bundles contain no server secrets
- rollback or kill-switch plan for risky features
- `PROJECT_STATE.yaml` updated with final lane statuses, proof, and unresolved founder-only gates
- `launch-cockpit.html` rendered from current state

Record proof in `PRODUCTION_READINESS.md` or the repo's existing release/readiness artifact:
- command run
- environment
- account/fixture used
- evidence path or dashboard link
- expected result
- actual result
- blocker or follow-up

Attribution-specific production-readiness proof is mandatory when onboarding, signup, or waitlist exists:
- the user sees the attribution screen early in the flow
- the stored source is a stable stored key, not display copy
- `other` captures sanitized free text or a documented follow-up value
- PostHog receives `attribution_source_selected`
- PostHog person properties include `self_reported_source`
- backend/profile storage contains the source once identity exists
- anonymous attribution is stitched to the identified user after signup/login

## 8. In-App Simulator, MobAI, Native iOS Proof, And Device Testing

Start at rung 0. On a local Mac with Xcode, the in-app iOS Simulator (Claude Code Desktop's simulator pane, or Codex with the `build-ios-apps` plugin) builds, installs, launches, taps, reads the screen, screenshots, records, and streams logs with no install and no account — use it for "run the app", "check this screen", "walk this flow", and "reproduce this bug". Escalate per the Route Ladder in `xcodebuildmcp-testing.md`. Use MobAI MCP for Android, repeatable `.mob` suites, multi-device runs, performance gates, and polished demo recording. Use the local `using-mobai-cli` skill when only CLI access is available or the environment is unfamiliar.

MobAI is a freemium third-party tool. Use its free tier without a spend gate when one device and the current quota satisfy the lane. Ask before any Plus/Pro upgrade or before replacing the intended cross-platform route; continue after the founder confirms paid capability, provides exports/screenshots, or approves a fallback with recorded platform limits.

Load `xcodebuildmcp-testing.md` before any Apple simulator/device proof, in either runtime. In Claude Code Desktop the simulator pane opens automatically when the agent runs the app in a simulator — local sessions only, per-device consent, fixture accounts only because device screenshots leave the machine. In Codex, call `session_show_defaults` before the first build/run/test and use exposed MCP tools such as `build_run_sim` when defaults are set. Either way record runtime and version, project/workspace, scheme, simulated device and OS, tool names, screenshot/log paths, and the simulator-only limitation in `PRODUCTION_READINESS.md`.

Use XcodeBuildMCP after confirmation for Apple-platform build/run/test/UI automation/screenshots/logs/video:
- load `xcodebuildmcp-testing.md`
- refresh official XcodeBuildMCP docs and local CLI/tool help before install/setup/commands/proof
- use MCP tools when exposed, otherwise the `xcodebuildmcp-cli` skill and CLI
- run `session_show_defaults` before first MCP build/run/test in a session
- use one-shot build/run tools when defaults are configured
- record Apple-only scope and any missing Android/MobAI coverage
- record docs checked date, docs URLs, CLI/tool snapshot, install route/version, and any docs-vs-skill mismatch in `PRODUCTION_READINESS.md`

For CLI users, use the same reference before SnapshotPreviews or serve-sim:
- SnapshotPreviews exports SwiftUI/UIKit/AppKit preview PNG/JSON proof through XCTest using `TEST_RUNNER_SNAPSHOTS_EXPORT_DIR`; record it as preview-only coverage, not runtime E2E proof.
- serve-sim exposes a booted iOS Simulator at a browser URL such as `http://localhost:3200`; record simulator/device, URL/port, actions, logs, and the fact that it does not replace provider proof or App Store signing readiness.

Device loop:
- observe UI tree before acting
- prefer accessibility IDs
- act
- wait for stable UI
- observe again
- capture screenshots only after the state is verified

For store screenshots, keep raw captures separate from composed assets. For E2E readiness, pair each MobAI action sequence with backend/provider verification:
- onboarding answer appears in profile/backend state
- attribution answer appears in analytics/person properties
- purchase or restore activates entitlement in app and RevenueCat/backend
- support/privacy/delete action reaches the intended backend/email route
- lifecycle email/webhook appears in provider logs when expected

If device access is blocked, mark production readiness as blocked for that flow. A cloud, SSH, or container session cannot reach a local Mac's simulators at all, so rung 0 is simply unavailable there: record that as the blocker and route the proof to a machine that can, rather than narrating a simulator run that did not happen. Do not replace live-device proof with screenshots, preview snapshots, or unit tests. If XcodeBuildMCP, SnapshotPreviews, or serve-sim is used, write the exact simulator/device, OS, workflow, output paths, and limitation into `PRODUCTION_READINESS.md`.

## 9. LaunchBench And Failure Cards

Run deterministic validators where the app repo has the required artifacts or code paths:

```bash
npm run validate:launch-state -- --root .
npm run check:orchestration -- --root .
npm run check:attribution -- --root .
npm run check:secrets -- --root .
npm run check:apple-signing -- --root .
npm run check:store-console -- --root .
npm run render:launch-cockpit -- --root .
npm run launchbench
```

If the scripts are available only from the installed skill, call them with `tsx` and pass the app repo as `--root`.

Use failure cards when a validator fails, a subagent finds a launch-grade gap, a provider mutation is blocked, or a known miss reappears. Cards should include severity, owner, evidence, impact, next action, validator, and closure proof. Keep active cards in `PROJECT_STATE.yaml`; use `FAILURE_CARDS.md` only when more detail is useful.

## 10. Done Rules

Engineering-heavy work is done only when:
- `AGENTS.md` exists and points to canonical docs.
- `PROJECT_STATE.yaml` exists, is current, and `launch-cockpit.html` has been rendered when the launch has multiple lanes.
- `CLAUDE.md` exists when Claude/builders need compatibility guidance.
- `APP_AGENTS.md` and the seven-file `agents/` roster exist for real app builds or handoffs, including `security-architect.md`.
- `LAUNCH_TRACE.md` exists or equivalent trace rows are embedded in `RESEARCH.md`.
- `TECH_SPEC.md` exists when data/API/state/platform contracts are non-trivial.
- `ENGINEERING_PLAN.md` exists when actual implementation is in scope.
- `ORCHESTRATION.md` exists for multi-lane or subagent-assisted work, and `PROJECT_STATE.yaml` records strategy, candidate units, serialized resources, spawned agents, collision checks, integration proof, and validator runs.
- `SECRETS.md` exists when any API key, token, webhook secret, service-account file, CI/deploy secret, store credential, or local env file is in scope.
- Compound Engineering or equivalent workflow produced product requirements, implementation plan, execution, review, and proof for non-trivial app work.
- Parallel agents were considered by default, used where safe, and serialized where required.
- Specialist audit agents or equivalent independent review checked the build against attribution, onboarding, analytics, revenue, store, privacy, design, and production-readiness requirements where in scope.
- frontend, backend, analytics, revenue, email, and mobile-device paths were tested end to end where in scope.
- In-app simulator proof (rung 0), MobAI proof, XcodeBuildMCP proof, serve-sim simulator proof, or SnapshotPreviews preview proof is paired with backend/provider verification where app flows mutate state, and the simulator-only/preview-only/no-Android/no-distribution limits are explicit.
- production-readiness evidence is written down.
- deterministic validators or LaunchBench scenarios were run where applicable, and active failure cards are explicit.
- remaining blockers are explicit founder-only gates, access gaps, platform review waits, or external service issues.
