# LaunchBench Evals

LaunchBench is the skill's regression harness. It exists to keep future agents from repeating known launch-grade mistakes after the prose has grown.

## What To Evaluate

Use LaunchBench for failure modes that have happened before or would be expensive to miss:

- attribution screen emits an event but does not persist a stable key, PostHog person property, backend/profile value, or `other` free text
- simulator build passes but Apple distribution signing, Team ID, bundle ID, app record, certificate/profile, archive/export/upload, or TestFlight state is unknown
- iOS readiness skips the in-app iOS Simulator (rung 0) on a local Mac and installs or requests a heavier route for a one-off screen/flow check, ignores exposed native tools, claims a simulator run from a cloud/SSH session, signs a driven device into a real account, or names SnapshotPreviews/serve-sim without exported PNG/JSON paths, simulator URL/port, provider-proof pairing, and simulator/preview/distribution limitations
- App Store Connect app name is taken and the CLI proposes a fallback name without founder approval
- MobAI is unavailable and the agent silently switches to XcodeBuildMCP or the in-app iOS Simulator without recording the lost Android/repeatable-suite/CI/physical-device coverage; neither MobAI Free nor the built-in in-app simulator needs spend approval
- MobAI desktop, MCP, and CLI versions are collapsed into one number, 2.5-era repeat/host-script safety is omitted, or AI-healed flows are accepted without diff review and a passing rerun
- RevenueCat products exist but entitlement grant, restore, webhook, or backend projection is unproven
- Resend templates ignore `design/DESIGN.md`, unsubscribe rules, sender-domain proof, or support reply paths
- a new API key/env var appears but `SECRETS.md`, Doppler, CI injection, or public/server-only classification is not updated
- a new third-party docs/tooling URL appears but is not added to `source-registry.yaml`
- upstream App Store Connect CLI skills or provider docs change but stale command snippets remain in references/templates
- iOS ASC upload readiness is claimed from metadata/privacy prose while `store/APPLE_APP_STORE_REQUIREMENTS.md`, `PrivacyInfo.xcprivacy`, required reason APIs, SDK manifests/signatures, Xcode privacy report, protected-resource purpose strings, ATT, account deletion, review notes, or upload-warning proof is missing
- store screenshot work treats raw device captures as final App Store upload artwork without composed iPhone/iPad assets, copy overlays, device-well validation, icon/preview routing, and visual QA
- weekly source refresh treats auto-discovered links as accepted launch policy without review
- product/design/build handoff starts without `11_STAR_EXPERIENCE.md`, `11-star-experience.html`, a line of feasibility, and a V1 scalable slice
- product, onboarding, core-loop, or paywall work proceeds without `EMOTIONAL_DESIGN.md` when the 11-star target is 6-star or higher; or a HIGH-risk card (variable reward, streak, scarcity, urgency, social proof) ships without an Ethics Attestation, a `user_control_escape_hatch`, a `counter_metric`, and a truthfulness proof; or an emotional/UX audit returns prose with no per-journey card mapping or pathway to a better state
- onboarding reaches first value, a personalized plan, or a value-reveal screen but omits the native App Review popup immediately after that first-value moment
- design work produces a freeform `design-proposal.html`, mood board, or Markdown version label instead of mutating `studio/seed/business.json`/`studio/seed/theme.tokens.json`, rendering `design/design-room.html`, and versioning state with git
- monetization defaults are locked by reflex — soft paywall, ≤4-day trial, monthly-only, low price, English-only, ads before the paywall is proven, day-30 win-back as the retention plan — without surfacing the RevenueCat 2026 anti-pattern trade-offs (`revenue-monetization.md` §10 digest, `onboarding-conversion.md` Conversion Anti-Patterns, `paid-user-acquisition.md` Anti-Patterns) as founder-gated decisions to test
- paid growth is marked ready from ad-channel ideas without `PAID_UA.md`, one-channel focus, creative cadence, tracking baseline, blended report, RevenueCat LTV/CPA review, stop/scale rules, and founder spend approval
- social growth is marked ready from UGC ideas, views, or TikTok hooks without `VIRAL_GROWTH.md`, product-loop contract, abuse controls, monetization timing, analytics proof, and stop/scale rules
- a primary paid tool or tier (AppKittie, XPOZ, Higgsfield, Refero, MobAI Plus/Pro) is bypassed without first using ToolSearch to confirm the MCP path is absent, asking the founder when spend/coverage changes, and recording tool, tier, lane, access, confirmation, route, and fallback limitation in strategy/TOOL_DECISIONS.md
- a simple reversible founder request becomes a jargon-heavy multi-field blocker with no phase/outcome, selectable question, consequences, safe skip/defer route, or stale-gate supersession
- XPOZ MCP tools are listed in the system-reminder but the agent declares XPOZ unavailable and runs curl or web search without a ToolSearch verification step
- AppKittie MCP tools are available in the session but ASO keyword difficulty or competitor data is produced without calling them
- Higgsfield is authenticated and MCP tools are present but the agent does not invoke them and does not ask the founder to confirm the lane is deferred
- Refero "not found" is silently dropped with no strategy/TOOL_DECISIONS.md entry and no founder prompt
- fallback output is presented as equivalent to paid-tool quality without a confidence label, limitation note, and strategy/TOOL_DECISIONS.md entry
- Higgsfield is unavailable and the agent silently uses Remotion or local media without founder-approved fallback routing
- Remotion content assets are marked ready without license status, source inputs, manifest entries, render proof, or claim review
- paid video creatives move to distribution without a Virality Predictor (`brain_activity`) score and a recorded `virality_score`/`hook_dmn_risk` in `PAID_UA.md`
- a Higgsfield/Marketing Studio manifest asset is generated without a `prompt_brief` carrying the `design/DESIGN.md` tokens, or the Click-to-Ad `--url` shortcut is used without injecting the brief into `--prompt`
- a Soul identity is retrained from scratch while `state/PROJECT_STATE.yaml` `tools.higgsfield.identity` already holds a usable `soul_reference_id`/`avatar_id`, without checking `show_characters` first
- broad launch work starts without an orchestration preflight, critical-path/sidecar split, or `operations/ORCHESTRATION.md`
- parallel agents are marked safe while sharing files, provider accounts, devices, migrations, git actions, or final readiness decisions
- spawned agents are allowed to stage, commit, push, mutate providers, control devices, run project-wide suites, or make founder-only decisions
- subagent findings are not reviewed, reconciled into `state/PROJECT_STATE.yaml`, converted into failure cards, or verified by focused and full-suite validators
- core engineering starts without a Compound Engineering freshness check, `ce-plan`, `ce-work`, review, test, and proof routing or an unavailable-with-reason fallback
- landing page is declared ready after a curl/API test while the live URL was never opened in a browser, a form field was never filled and submitted, and the success state was never visually confirmed
- wrangler deploy runs with an uncommitted working tree, an outdated major version, or a token whose scope was never verified with `wrangler whoami`
- Alpine.js is used with a strict CSP but the @alpinejs/csp build and x-model elimination are not confirmed before deploy, causing browser-only form failures that curl cannot detect
- landing copy is rewritten (hero, pricing, layout components) without loading `geo-seo.md` first; ranked-cohort claims, unshipped-feature promises, unverifiable authority endorsements, or lifetime-access promises ship without a pre-edit compliance scan
- JSON-LD schema blocks are added or modified in landing pages without parsing/validating the JSON before deploy
- contact email addresses (`@yourdomain.com`) are written into privacy/legal pages before MX records exist for the domain
- a waitlist form is live but duplicate-email idempotency (HTTP 200 for repeated submits) is undocumented

## Harness Shape

Scenario files live under `evals/launchbench/*.yaml` and should include:

- `id`
- `title`
- `prompt`
- `expected_guardrail`
- `validators`
- `must_catch`
- `should_say`

Run:

```bash
npm run launchbench
npm run test:validators
```

Be precise about what executes: `npm run launchbench` is a scenario **definition lint** plus the deterministic validator-fixture suite. It checks that every scenario YAML has the required fields and references known validators, then runs positive/negative fixtures against the validators themselves. **Scenario `prompt`s are never executed against a live agent by this harness**, and `run-agent-evals.ts` likewise validates eval definitions only. Do not describe LaunchBench output as behavioral coverage. For live agent behavior, use the Behavioral Eval Harness below (or run a scenario prompt against a fresh agent manually and compare to `must_catch`/`should_say`).

## Behavioral Eval Harness (manual, not PR-gating)

`npm run evals:behavioral` (`tooling/run-behavioral-evals.ts`) is the execution layer the definition lint deliberately lacks. It runs the **opt-in flagship subset** — scenarios carrying `behavioral: true` in `evals/launchbench/*.yaml` or `evals/agent-behavior/*.yaml` — against a live Claude agent primed with `SKILL.md`, grades every `must_catch` / `should_say` / `must_use` / `forbidden` assertion with a structured-output grader call, and writes a JSON results artifact (agent model, grader model, per-assertion verdicts with quoted evidence). `must_catch`/`must_use`/`forbidden` failures are hard (nonzero exit); `should_say` misses are soft.

The honest split, on purpose:

- **Deterministic gate (PR-blocking):** `npm run audit:ci`, including the launchbench definition lint and validator fixtures. No model in the loop; reproducible; cheap.
- **Behavioral runs (manual, advisory):** the `behavioral-evals` GitHub Actions workflow (`workflow_dispatch`, `ANTHROPIC_API_KEY` repo secret) or a local run. Live model calls cost money and carry variance/flake, so they never gate PRs; results are an artifact a human reviews, and regressions become validator/scenario tightening, not a red X on someone's unrelated PR.

The flagship set (enforced by the launchbench lint — these must keep `behavioral: true`): `stale-installed-skill-runtime`, `live-provider-proof-missing` (the provider-proof-before-ready behavior; its agent-behavior twin is also opted in), `post-launch-ops-runbook-missing`, `launch-tier-overproduction`, `monetization-cozy-default-stack-unexamined`, `founder-zero-operator-skipped`, and `founder-gate-jargon-without-choice`. Current model ids come from the `claude-api` skill (default `claude-opus-5` as of 2026-07-25) — never hardcode date-suffixed ids. Only the deterministic surfaces (`--list`, the missing-credential gate) are covered by validator fixtures; the live path is exercised by the workflow itself.

## Validator Phrase Contracts

Most artifact validators are deterministic phrase/regex gates over Markdown and state files. That is a deliberate design (reproducible, fast, no model in the loop) with two known edges:

- **False negative wording:** a genuinely correct artifact can fail because it used a synonym the validator does not accept. The accepted vocabulary for each gate lives in its validator source under `tooling/` — that file is the contract, not this prose. When a validator rejects wording that is semantically right, either adopt the canonical phrase or extend the validator's accepted list (with a fixture) in the same change.
- **Gaming:** pasting the magic phrases without doing the work passes the gate. The anti-gaming helpers in `tooling/lib/launch-state.ts` (dated, substantive reasons; stall staleness) raise the bar but cannot prove work happened. Founder review and provider-proof artifacts are the backstop, as the validators' own comments state.

Frequently-tripped literal tokens worth knowing before authoring artifacts by hand:

- `product/ONBOARDING.md` (`check:onboarding`): must contain the literal analytics event names `review_prompt_eligible` and `review_prompt_requested`, a named native review API (`SKStoreReviewController`, `requestReview`, StoreKit, or Google Play In-App Review), a cooldown/frequency cap, and a suppressed-prompt fallback — see `validation/business/experience/check-onboarding-conversion.ts` for the full accepted lists.
- `growth/LAUNCH_NARRATIVE.md` (`check:launch-narrative`): fenced post copy is scanned against the 2026 guardrails (no hashtags, no emojis, no link in the main post) — see `validation/business/growth/check-launch-narrative.ts`.
- `analytics/ANALYTICS.md` (`check:attribution`): expects the stable event/person-property names (e.g. `attribution_source_selected`, `self_reported_source`) plus backend persistence and reconciliation language — see `validation/business/data/check-attribution-contract.ts`.
- `SCREENSHOTS.md` (`check:store-screenshots`): expects raw-vs-final separation, device wells, and composition routing phrases — see `validation/business/store/check-store-screenshots.ts`.

When a new validator gains a phrase vocabulary, add the high-traffic literals here and to the shipped template so authors discover the contract before the red X.

## Independent Audit Use

After major skill edits or before declaring a launch complete:

- run deterministic validators against the current app repo
- run LaunchBench scenario checks
- run source freshness checks when the skill itself or third-party references changed
- use parallel audit agents only for independent review, not for final integration
- pass each audit agent the minimum scenario and artifact paths, not the intended answer
- write failures into `state/PROJECT_STATE.yaml` as active failure cards

## Acceptance

- At least the known failure scenarios remain represented.
- New real-world misses become new scenarios or failure cards.
- Deterministic validators are preferred over vague review prompts whenever a condition can be checked from files.
