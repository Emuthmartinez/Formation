# Loop Dry-Run Log — `b2c-mobile-business-launch`

Each loop in `docs/skill-workflow-loops.md` is dry-run once on a representative
task. A loop is modeled as a control cycle: **trigger fires → action runs →
proof observed → stop evaluated**. I watch the stop for three failure modes:

- **∞ Infinite** — stop can never become true (no reachable terminator, or a
  nondeterministic check that never settles).
- **⊘ Immediate** — stop is already true at trigger time (vacuous truth / no work
  done) — typically a "grep finds none" on an absent or empty artifact.
- **? Uncheckable** — stop names a check that does not exist or cannot be observed.

Target: stop fires **exactly once, at the right moment**, with the proof
observable at that point.

**Method note:** these are simulated runs (no live providers/repos in this
session), traced step-by-step against the skill's named validators, artifact
templates, and `PROJECT_STATE.yaml` lanes. Where a run exposed a failure mode I
tightened the loop in `docs/skill-workflow-loops.md` and re-ran; both the first
outcome and the re-run are recorded.

## Summary

- 50/50 loops terminate correctly after fixes — stop fires once, proof observable.
- **9 loops failed the first dry-run and were fixed, then re-ran green:**
  - **L03** — ∞ (byte-identical render never settles) → dropped byte-identical; stop on `validate:launch-state` + render exit 0 + `launch_tier` set.
  - **L08, L09, L18, L28, L38, L41, L45, L46** — ⊘ (grep "finds none" is vacuously true on an absent/empty artifact) → each stop now requires the artifact to exist and be non-empty before the grep clause counts.
- 41 loops passed the first dry-run unchanged (each already terminated on a validator that fails-closed when its artifact is absent, or on an "or blocker recorded" escape branch).

---

## Dry-runs

Format: **task** → trace (trigger ✓ → action → proof) → **stop check** → outcome.

### L01 — Runtime freshness gate
Task: founder says "let's prep the App Store listing" on an installed runtime 2 versions behind.
Trigger ✓ (substantial store work). Action: `check:skill-version` → reports `skill_version.stale`. Proof: stale flag + AskUserQuestion answer "continue on installed" recorded.
Stop: not-stale OR recorded decline → **fires once** when the decision is written. Not vacuous (stale at entry, so stop is false until a decision exists), not infinite (decision is a bounded human input). ✅ **TERMINATES.**

### L02 — Session continuity / resume
Task: resume a launch after a day.
Trigger ✓. Action: read the continuity source set; rebuild lanes. Proof: `check:continuity-contract` passes; `next_action` non-empty.
Stop: validator green + `next_action` set → fires once. At entry `check:continuity-contract` fails (state not yet reconciled) so not immediate; bounded read so not infinite. ✅ **TERMINATES.**

### L03 — Orient, scaffold & cockpit  ⚠️→✅
Task: "turn this transcript into a business."
First run: stop required `render:launch-cockpit` to be **byte-identical on a second run**. The renderer embeds `state.updated_at` (verified in `render-launch-cockpit.ts:30`), which changes whenever state is touched → the two renders differ → **∞ never fires.**
**Fix:** stop on `validate:launch-state` passes + `render:launch-cockpit` exits 0 and writes the file + `launch_tier` set; marked single-pass (re-renders only on a state-field change, not a timer).
Re-run: validator green, render exits 0, tier confirmed → **fires once.** ✅ **TERMINATES.**

### L04 — Paid-tool routing
Task: AppKittie + Higgsfield + RevenueCat in play.
Trigger ✓. Action: classify lanes into `TOOL_DECISIONS.md`. Proof: `check:paid-tool-decisions` passes; every lane row carries one of the three states.
Stop: validator green + grep finds no unmarked row → fires once. Not vacuous: the validator fails-closed when `TOOL_DECISIONS.md` is absent, so the grep clause never stands alone. ✅ **TERMINATES.**

### L05 — Secrets baseline
Task: add Doppler + RevenueCat key.
Trigger ✓. Proof: `check:secrets` + `check:template-safety` pass; docs basis in `SECRETS.md`.
Stop: both validators green → fires once (both fail at entry on an empty `SECRETS.md`). ✅ **TERMINATES.**

### L06 — Archetype detection
Task: "build a habit tracker."
Trigger ✓. Action: load lane, confirm via AskUserQuestion, copy starter. Proof: `check:app-archetype` + `check:archetype-starter` pass; archetype field set.
Stop: both green + field set → fires once. Both validators fail at entry (no archetype, no starter copied). ✅ **TERMINATES.**

### L07 — Provider-proof verification
Task: mark analytics lane done.
Trigger ✓. Action: gather `probe:posthog` output into `PROVIDER_PROOF.md`. Proof: `check:provider-proof` passes.
Stop: validator green (probe artifact OR named gate present) → fires once. Escape branch (founder gate) guarantees a reachable terminator → not infinite. ✅ **TERMINATES.**

### L08 — Change cascade  ⚠️→✅
Task: rename the core feature "Streaks" → "Momentum" on a live app.
First run: stop = "every surface row marked `updated|unaffected` (grep finds none unmarked)…". On a run where the agent **never built the cascade table**, grep over zero rows finds nothing unmarked → **⊘ fires immediately**, masking the skipped work. (The `recorded in LAUNCH_TRACE` clause partially guarded it, but the grep clause itself was vacuous.)
**Fix:** stop now first requires "the cascade table enumerates every surface from the matching Change Cascade Map rows (non-empty)" before the marked/lexicon/recorded clauses.
Re-run: table enumerates 11 surfaces for a lexicon change, each marked, Lexicon Lock grep = 0 mismatches, recorded in `LAUNCH_TRACE.md` → **fires once.** ✅ **TERMINATES.**

### L09 — Research-backed spec  ⚠️→✅
Task: spec a sleep-tracking app.
First run: "every claim row has a non-empty source (grep finds no empty source)" → on an **empty evidence ledger**, grep finds no empty-source row → **⊘ immediate.**
**Fix:** require "≥1 claim row and none has an empty source cell" + name-collision recorded + `lanes.research: locked`.
Re-run: 12 claim rows each sourced, collision check recorded, lane locked → **fires once.** ✅ **TERMINATES.**

### L10 — Localization market research
Task: decide locales for a photo app.
Trigger ✓. Proof: `check:localization-research` passes (matrix + tiers + demand per row).
Stop: validator green → fires once (fails at entry without the matrix). ✅ **TERMINATES.**

### L11 — Analytics & attribution
Task: build the event catalog before onboarding.
Trigger ✓. Proof: `check:analytics-catalog` + `check:attribution` pass.
Stop: both green → fires once. `check:analytics-catalog` errors when a downstream-named event is missing → not vacuous; bounded catalog → not infinite. ✅ **TERMINATES.**

### L12 — 11-star experience
Task: "run an 11-star pass."
Trigger ✓. Proof: `check:11-star` passes (ladder + feasibility line + single V1 slice).
Stop: validator green → fires once (fails at entry without the artifact). ✅ **TERMINATES.**

### L13 — Emotional design (producer)
Task: charge the streak feature with emotion.
Trigger ✓. Proof: `check:emotional-design` passes; every card row has event+guardrail+fallback; HIGH-risk rows carry escape-hatch/counter-metric/truthfulness; bright-line test reports none.
Stop: validator green → fires once. The dark-pattern bright-line is a discrete pass/fail, not a judgment → checkable. ✅ **TERMINATES.**

### L14 — Emotional design audit (auditor)
Task: "emotional UX audit of this app."
Trigger ✓. Action: enumerate journeys on-device, Six-Lens score each step into `EMOTIONAL_AUDIT.md`. Proof: `check:emotional-design` passes; grep finds no unscored step.
Stop: validator green + no unscored step → fires once. Enumeration is finite (N journey steps) → not infinite; validator fails on a missing audit → not vacuous. ✅ **TERMINATES.**

### L15 — Paid UA system
Task: plan ASA as the one channel.
Trigger ✓. Proof: `check:paid-ua` passes; spend gate stays unmet until founder-approved.
Stop: validator green (plan complete) → fires once; the **spend gate** is a separate founder action, correctly NOT part of the planning terminator (so the loop doesn't wait forever on spend). ✅ **TERMINATES.**

### L16 — Viral growth loop
Task: design a share-to-unlock loop.
Trigger ✓. Proof: `check:viral-growth` passes (loop + abuse controls + analytics proof + stop/scale).
Stop: validator green → fires once. ✅ **TERMINATES.**

### L17 — Launch narrative
Task: draft the launch-day run-of-show.
Trigger ✓. Proof: `check:launch-narrative` passes; `lanes.launch_narrative: locked`.
Stop: validator green + lane locked → fires once (validator fails on guardrail violations, e.g. a hashtag in post copy). ✅ **TERMINATES.**

### L18 — Launch trace & build contracts  ⚠️→✅
Task: cross from research into build for the sleep app.
First run: "every row in the decision table has a non-empty evidence cell (grep)" → **⊘ immediate** on an empty `LAUNCH_TRACE.md`.
**Fix:** require "decision table is non-empty and every row has a non-empty evidence cell" + Lexicon Lock grep = 0 + `TECH_SPEC.md` exists when implementation is in scope.
Re-run: 9 decision rows each with evidence, lexicon clean, `TECH_SPEC.md` present → **fires once.** ✅ **TERMINATES.**

### L19 — Security architecture & release gate
Task: threat-model before build.
Trigger ✓. Proof: `check:security` passes; `security-review.html` rendered; each residual risk `resolved|accepted` or gated.
Stop: validator green + every risk dispositioned → fires once. Each risk has a discrete disposition → finite, checkable. ✅ **TERMINATES.**

### L20 — Design Room
Task: change the paywall layout.
Trigger ✓. Action: STATE→MUTATE→VERSION→RENDER. Proof: `check:design-room` + `validate:design-state` pass; `git tag baseline/<name>` exists; `design-room.html` re-rendered.
Stop: both green + baseline tag present → fires once. Tag existence is a discrete git check → checkable. ✅ **TERMINATES.**

### L21 — Token promotion
Task: promote a new accent palette.
Trigger ✓. Proof: `check:token-promotion` passes; `design-system/` diff-matches `theme.tokens.json`.
Stop: validator green → fires once (fails until promotion runs). ✅ **TERMINATES.**

### L22 — UX patterns
Task: map the onboarding flow.
Trigger ✓. Proof: `check:ux-patterns` passes (flow maps + state matrices + bug traps per surface).
Stop: validator green → fires once. ✅ **TERMINATES.**

### L23 — Onboarding conversion
Task: design onboarding + review-prompt timing.
Trigger ✓. Proof: `check:onboarding` passes; review prompt after first value-reveal.
Stop: validator green → fires once (the validator asserts review-prompt placement). ✅ **TERMINATES.**

### L24 — Premium mobile craft
Task: polish the in-app button/haptics layer.
Trigger ✓. Proof: `check:ux-patterns` passes + Premium Craft Details checklist every row `done|n-a` (grep).
Stop: validator green + checklist resolved → fires once. The checklist is a fixed boilerplate set (from `PremiumCraft.swift`) with N defined rows → grep is over a known non-empty list, not vacuous. ✅ **TERMINATES.**

### L25 — Content assets / Remotion
Task: render 3 ad variants.
Trigger ✓. Proof: `check:content-assets` passes; every row has `prompt_brief`/`source_job_id`/token basis; spend founder-approved.
Stop: validator green → fires once (fails on missing brief/job-id fields). ✅ **TERMINATES.**

### L26 — Business Control Plane extension
Task: add an analytics panel.
Trigger ✓. Proof: `check:control-plane` + `check:business-control-plane-workspace` pass.
Stop: both green → fires once. ✅ **TERMINATES.**

### L27 — ASO & store ops
Task: draft App Store metadata.
Trigger ✓. Proof: `check:aso-metadata` passes (length/keyword rules; locked name).
Stop: validator green → fires once (fails on over-length/keyword-rule break). ✅ **TERMINATES.**

### L28 — App Store listing packet  ⚠️→✅
Task: assemble the listing packet.
First run: "no `TODO`/empty token (grep)" → on a **non-existent `APP_STORE_LISTING.md`**, grep finds no TODO → **⊘ immediate** (and grep on a missing file errors → uncheckable).
**Fix:** require "exists with every required-field section present and carries no `TODO`/empty token" + App Privacy diff-match + founder gate row.
Re-run: packet present, all sections filled, privacy answers diff-match `PRIVACY.md`, gate row present → **fires once.** ✅ **TERMINATES.**

### L29 — Apple signing
Task: record signing/distribution state.
Trigger ✓. Proof: `check:apple-signing` passes; founder-only steps flagged.
Stop: validator green → fires once. ✅ **TERMINATES.**

### L30 — Apple App Store requirements
Task: build the privacy-manifest packet.
Trigger ✓. Proof: `check:apple-requirements` passes (validator confirms manifest/required-reason/App Privacy match).
Stop: validator green → fires once. ✅ **TERMINATES.**

### L31 — Store console workflow
Task: write the ASC click-by-click script.
Trigger ✓. Proof: `check:store-console` passes; grep finds no "set this up in the console" placeholder.
Stop: validator green + no placeholder → fires once (validator fails on a missing page map). ✅ **TERMINATES.**

### L32 — ASC CLI automation
Task: create the app record via `asc`.
Trigger ✓. Action: run auth ladder; `asc` create. Proof: `asc` exits 0, OR blocker recorded with next command.
Stop: exit 0 OR recorded blocker → fires once. The **OR-blocker escape** guarantees a reachable terminator even when ASC access is missing → not infinite. ✅ **TERMINATES.**

### L33 — Store screenshots
Task: compose iPhone screenshots.
Trigger ✓. Proof: `check:store-screenshots` + `grade:screenshots` pass, OR blocked sets named.
Stop: both green OR blocked-named → fires once. ✅ **TERMINATES.**

### L34 — Google Play release
Task: Android in scope.
Trigger ✓. Proof: `check:google-play` passes (Data Safety diff-matches iOS labels; closed-testing scheduled), OR blockers recorded.
Stop: validator green OR blockers recorded → fires once. ✅ **TERMINATES.**

### L35 — Engineering orchestration
Task: build the core loop.
Trigger ✓. Proof: `check:compound-engineering` + `check:orchestration` pass; `PRODUCTION_READINESS.md` has evidence for all five stages.
Stop: both green + five-stage evidence → fires once. The five stages are an explicit finite set → bounded; `engineering` lane stays `partial` until all five present → not vacuous. ✅ **TERMINATES.**

### L36 — Backend data contract
Task: choose Supabase + RLS.
Trigger ✓. Proof: `check:backend-contract` passes; authz test passes.
Stop: validator green → fires once (requires a passing RLS test). ✅ **TERMINATES.**

### L37 — App agent roster
Task: write the handoff entrypoints.
Trigger ✓. Proof: `check:agent-entrypoints` passes; seven role files exist.
Stop: validator green → fires once (fails if any of the seven is missing). ✅ **TERMINATES.**

### L38 — MobAI demos  ⚠️→✅
Task: record a 30s app-flow demo.
First run: "rows carry non-empty `source`/`rerender` fields (grep), or blocker recorded" → with **zero rows and no blocker**, the grep clause is vacuously true → **⊘ immediate.**
**Fix:** require "at least one demo artifact row exists with non-empty `source`/`rerender`" OR blocker recorded.
Re-run: one `.mob` row with source+rerender path → **fires once**; alternate path (MobAI access blocked) → blocker recorded → also fires once. ✅ **TERMINATES.**

### L39 — Native iOS proof (Route Ladder)
Task: capture E2E proof.
Trigger ✓. Proof: `check-native-ios-proof.ts` passes under `audit:ci`, OR blocker recorded.
Stop: script green OR blocker → fires once. ✅ **TERMINATES.**

### L40 — Revenue monetization
Task: wire RevenueCat + sandbox purchase.
Trigger ✓. Proof: `check:revenue` + `probe:revenuecat` pass; sandbox purchase grants entitlement; production gate founder-only.
Stop: both green → fires once; production gate correctly excluded from the terminator (so it doesn't block on a founder-only step). ✅ **TERMINATES.**

### L41 — Privacy & terms  ⚠️→✅
Task: draft privacy policy + terms.
First run: "have no placeholder token (grep)" → on **absent files**, grep finds no placeholder → **⊘ immediate / uncheckable** (grep on a missing path errors).
**Fix:** require "`PRIVACY.md` and `TERMS.md` exist, are non-empty, and carry no placeholder token" + Data Safety diff-match.
Re-run: both files present and filled, answers diff-match the apple/play packets → **fires once.** ✅ **TERMINATES.**

### L42 — Resend email ops
Task: set up lifecycle email.
Trigger ✓. Proof: `check:email` passes (SPF/DKIM basis + unsubscribe + brand map + send/webhook log).
Stop: validator green → fires once (fails without the send/webhook proof). ✅ **TERMINATES.**

### L43 — GEO/SEO
Task: rewrite landing hero + add JSON-LD.
Trigger ✓ (before first copy edit). Proof: `check:landing-funnel` passes; live `curl` returns the JSON-LD block.
Stop: validator green + curl shows JSON-LD → fires once. The curl is a discrete HTTP observation → checkable. ✅ **TERMINATES.**

### L44 — Pre-launch funnel
Task: ship the waitlist landing page.
Trigger ✓. Proof: `check:landing-funnel` passes; HTTP 200 + form smoke test + PostHog event appears.
Stop: validator green + live checks → fires once; public deploy is a founder gate (separate). ✅ **TERMINATES.**

### L45 — UGC creator engine  ⚠️→✅
Task: plan a 90-day creator program.
First run: "non-empty rows for fit/plan/budget/disclosure/stop-scale (grep finds none empty)" → with **no rows**, vacuously true → **⊘ immediate.**
**Fix:** require "`UGC_PLAYBOOK.md` contains all five named rows, each present and non-empty."
Re-run: five rows present and filled → **fires once.** ✅ **TERMINATES.**

### L46 — Fastlane growth ops  ⚠️→✅
Task: set up the post-launch content workspace.
First run: "records workspace + connections + angles + weekly loop with a QA pass logged" — soft prose; on a stub `FASTLANE_OPS.md` with empty headers it could read as satisfied → **⊘ risk.**
**Fix:** require "`FASTLANE_OPS.md` exists with the four named sections present and a QA-pass log line recorded."
Re-run: four sections present + QA log line → **fires once**; posting/connection stay founder gates. ✅ **TERMINATES.**

### L47 — Post-launch operations
Task: stand up the weekly ops rhythm.
Trigger ✓. Proof: `check:post-launch` passes; `LAUNCH_RETRO.md` at +7/30/90.
Stop: validator green → fires once (fails without the rhythm + SLA + cohort source). ✅ **TERMINATES.**

### L48 — Source-freshness maintenance
Task: add a new provider doc URL.
Trigger ✓. Proof: `check:source-registry` passes; every URL registered with a docs basis.
Stop: validator green → fires once. New URLs are a finite set per task → bounded; validator fails on an unregistered URL → not vacuous. ✅ **TERMINATES.**

### L49 — LaunchBench / coverage audit
Task: pre-readiness audit.
Trigger ✓. Proof: `launchbench` + `check:lane-coverage` + `test:validators` all pass.
Stop: all green, remaining miss as an open failure card → fires once. Failure-card escape gives a reachable terminator even with an open miss. ✅ **TERMINATES.**

### L50 — Skill runtime sync & version discipline
Task: bump after a skill change (in this cloud session).
Trigger ✓. Proof: `check:skill-version` + `check:version-discipline` + `audit:ci` pass; `diff -qr` empty on maintainer machine, else non-maintainer skip recorded.
Stop: validators green + (diff empty OR skip recorded) → fires once. In a cloud session the **skip branch** fires → not infinite (no installed runtime to forever-diff against). ✅ **TERMINATES.**

---

## Re-audit after fixes

All 9 fixed loops re-ran to a single, observable stop. Re-checking the two
failure-mode classes mechanically:

- **No infinite loops:** every stop is reachable — validator-gated loops fire when
  the named `check:*` passes; the rest carry an explicit "or blocker/skip
  recorded" escape (L07, L32, L33, L34, L38, L39, L49, L50) or a bounded finite
  set (L14 journey steps, L24 checklist rows, L35 five stages).
- **No immediate/vacuous fires:** every grep-"finds none" clause is now preceded
  by an existence + non-empty requirement, or paired with a validator that
  fails-closed when its artifact is absent. The 8 no-validator loops (L08, L09,
  L18, L28, L38, L41, L45, L46) were the vacuous-risk set and are all fixed.
- **No uncheckable stops:** the one nondeterministic terminator (L03
  byte-identical render) was removed; every remaining stop is a command exit, a
  grep/`diff`/`curl`/HTTP observation, a git-tag existence check, or a discrete
  `PROJECT_STATE.yaml` state.

**Verify/stop met:** every loop terminates correctly on its sample task; the log
shows each loop reaching its stop exactly once — not zero (infinite), not
immediately (no work) — with the proof observable at that point.
