<!-- catalog-generated:start node-contracts -->
# Node Contracts

Generated from catalog/workflows and core/provisioning/requirements.ts. Edit the catalog, not this file.

One entry per workflow node: what it consumes (Reads blocks readiness; Consults is open-if-present),
what it produces, the knowledge bound to it, and the providers it touches with the access routes each
provider declares. The chosen route for a running business lives in state, not here.

## Running The Launch

### Provider-proof verification

_Before marking any provider-backed lane (analytics/revenue/email/store/security/eng) done_

- **Role:** Orchestrator
- **Phases:** Cross-phase (always-on)
- **Providers:** `provider.posthog` (api, browser), `provider.revenuecat` (api, browser), `provider.resend` (api, browser), `provider.app-store-connect` (cli, api, browser)
- **Reads:** `operations/PROVIDER_PROOF.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `operations/PROVIDER_PROOF.md`
- **Gates:** `check:provider-proof`
- **Knowledge:** [Launch Coverage](../../knowledge/process/launch-coverage.md), [Provider Proof](../../knowledge/process/provider-proof.md)

### Change cascade

_When design/design.md is accepted, and after each app, product, copy, brand, pricing, product, or data change_

- **Role:** Orchestrator
- **Phases:** Cross-phase (always-on)
- **Providers:** —
- **Reads:** `state/PROJECT_STATE.yaml`, `state/LAUNCH_TRACE.md`, `design/design.md`, `engineering/SOURCE_CHANGE_MANIFEST.json`
- **Consults:** —
- **Produces:** `state/CHANGE_CASCADE_RECEIPT.json`
- **Gates:** `check:change-cascade`
- **Knowledge:** [Cascade Edges](../../knowledge/process/cascade-edges.yaml), [Change Cascade](../../knowledge/process/change-cascade.md), [Flow Traceability](../../knowledge/process/flow-traceability.md)

### Launch trace & build contracts

_Crossing research → product/design/build; deciding if engineering/TECH_SPEC.md is needed_

- **Role:** Product leader
- **Phases:** 1f
- **Providers:** —
- **Reads:** `strategy/RESEARCH.md`, `product/experience/11-star-experience/11_STAR_EXPERIENCE.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `state/LAUNCH_TRACE.md`, `engineering/TECH_SPEC.md`
- **Gates:** —
- **Knowledge:** [Artifact Contracts](../../knowledge/process/artifact-contracts.md), [Flow Traceability](../../knowledge/process/flow-traceability.md), [Launch Coverage](../../knowledge/process/launch-coverage.md)

### Business Control Plane extension

_Extending the Design Room into new analytics/monetization/store/growth panels over the same state_

- **Role:** Orchestrator
- **Phases:** Cross-phase (always-on)
- **Providers:** —
- **Reads:** `studio/seed/business.json`, `studio/seed/theme.tokens.json`, `state/PROJECT_STATE.yaml`, `design/design-room.html`
- **Consults:** —
- **Produces:** `state/workspace.generated.json`
- **Gates:** `check:control-plane`, `check:business-control-plane-workspace`
- **Knowledge:** [Project State](../../knowledge/orchestration/project-state.md), [Control Plane](../../knowledge/process/control-plane.md)

### LaunchBench / failure-cards / coverage audit

_Before any launch-readiness claim, after a repeated miss, or adding a validator/scenario_

- **Role:** Orchestrator
- **Phases:** Cross-phase (always-on)
- **Providers:** —
- **Reads:** `operations/FAILURE_CARDS.md`, `state/PROJECT_STATE.yaml`, `engineering/PRODUCTION_READINESS.md`
- **Consults:** —
- **Produces:** `operations/FAILURE_CARDS.md`, `LAUNCHBENCH.md`
- **Gates:** `launchbench`, `check:lane-coverage`
- **Knowledge:** [Artifact Contracts](../../knowledge/process/artifact-contracts.md), [Failure Cards](../../knowledge/process/failure-cards.md), [Launch Coverage](../../knowledge/process/launch-coverage.md)

## Driving The Work

### Session continuity / resume

_New session, resume, status check, or handoff on an existing launch_

- **Role:** Orchestrator
- **Phases:** Cross-phase (always-on)
- **Providers:** —
- **Reads:** `AGENTS.md`, `state/PROJECT_STATE.yaml`, `state/launch-cockpit.html`, `operations/ORCHESTRATION.md`, `engineering/PRODUCTION_READINESS.md`, `operations/FAILURE_CARDS.md`
- **Consults:** —
- **Produces:** —
- **Gates:** `check:continuity-contract`
- **Knowledge:** [Parallel Agent Orchestration](../../knowledge/orchestration/parallel-agent-orchestration.md), [Project State](../../knowledge/orchestration/project-state.md)

### Orient, scaffold & state/cockpit upkeep

_"Launch this app" / broad launch request; any lane/provider/proof/blocker status change_

- **Role:** Orchestrator
- **Phases:** 0
- **Providers:** —
- **Reads:** `state/PROJECT_STATE.yaml`, `operations/ORCHESTRATION.md`, `operations/FAILURE_CARDS.md`, `engineering/PRODUCTION_READINESS.md`
- **Consults:** —
- **Produces:** `state/PROJECT_STATE.yaml`, `state/launch-cockpit.html`
- **Gates:** `validate:launch-state`, `render:launch-cockpit`
- **Knowledge:** [Dynamic Workflows](../../knowledge/orchestration/dynamic-workflows.md), [Project State](../../knowledge/orchestration/project-state.md), [Artifact Contracts](../../knowledge/process/artifact-contracts.md), [Launch Phases](../../knowledge/process/launch-phases.md), [Tool Recipes](../../knowledge/process/tool-recipes.md)

## Running The Business

### Paid-tool routing & fallback

_Before using or replacing any paid/account-gated tool, or before a free fallback_

- **Role:** Operator readiness
- **Phases:** 0b
- **Providers:** `provider.doppler` (cli, browser)
- **Reads:** `strategy/TOOL_DECISIONS.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `strategy/TOOL_DECISIONS.md`
- **Gates:** —
- **Knowledge:** [Paid Tool Routing](../../knowledge/operations/paid-tool-routing.md)

### Secrets baseline & routing

_Before any new secret, key, token, env var, webhook secret, or .env_

- **Role:** Engineering leader
- **Phases:** 0c
- **Providers:** `provider.doppler` (cli, browser)
- **Reads:** `trust/secrets/SECRETS.md`, `strategy/TOOL_DECISIONS.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `trust/secrets/SECRETS.md`
- **Gates:** `check:secrets`
- **Knowledge:** [Doppler Organization Across A Portfolio](../../knowledge/operations/doppler-organization.md), [Provider State Recipes](../../knowledge/operations/provider-state-recipes.md), [Secrets Management](../../knowledge/operations/secrets-management.md), [Secrets And Environment](../../knowledge/process/tool-recipes/secrets-and-environment.md)

### Resend email ops

_Before Resend domains/keys, transactional/lifecycle/broadcast email, deliverability_

- **Role:** Customer success
- **Phases:** 4, 6
- **Providers:** `provider.resend` (api, browser)
- **Reads:** `design/design.md`, `analytics/ANALYTICS.md`, `product/experience/11-star-experience/11_STAR_EXPERIENCE.md`, `growth/resend/email-templates.ts`
- **Consults:** —
- **Produces:** `growth/EMAIL_OPS.md`
- **Gates:** `check:email`
- **Knowledge:** [Analytics And Attribution](../../knowledge/data/analytics-attribution.md), [Resend Email Ops](../../knowledge/operations/resend-email-ops.md), [Revenue Email Analytics](../../knowledge/process/tool-recipes/revenue-email-analytics.md), [Consumer Copy Benchmarks](../../knowledge/words/consumer-copy-benchmarks.md), [Conversion Copy](../../knowledge/words/conversion-copy.md), [No-Slop Writing](../../knowledge/words/no-slop-writing.md)

### Post-launch operations

_App live (phase_6/6b), "what now", weekly ops, incident response, retention reviews_

- **Role:** Orchestrator
- **Phases:** 6b
- **Providers:** —
- **Reads:** `state/PROJECT_STATE.yaml`, `operations/POST_LAUNCH_OPS.md`, `operations/LAUNCH_RETRO.md`
- **Consults:** `growth/PAID_UA.md`
- **Produces:** `operations/POST_LAUNCH_OPS.md`, `operations/LAUNCH_RETRO.md`
- **Gates:** `check:post-launch`
- **Knowledge:** [Paid User Acquisition](../../knowledge/growth/paid-user-acquisition.md), [Billing Health And Reactivation](../../knowledge/money/billing-health-and-reactivation.md), [Post-Launch Operations](../../knowledge/operations/post-launch-operations.md), [Change Cascade](../../knowledge/process/change-cascade.md), [ASO Store Ops](../../knowledge/store/aso-store-ops.md)

### Founder-zero operator bootstrap

_Every broad launch start; before account/social/Doppler bootstrap; when an agent is about to hand back a checklist_

- **Role:** Operator readiness
- **Phases:** Cross-phase (always-on)
- **Providers:** —
- **Reads:** `operations/BUSINESS_ACCESS.md`, `operations/business-access.json`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `operations/BUSINESS_ACCESS.md`, `operations/business-access.json`
- **Gates:** `check:founder-operator`
- **Knowledge:** [Founder-Zero Operator](../../knowledge/operations/founder-zero-operator.md), [Frontier Agent Operations](../../knowledge/operations/frontier-agent-operations.md), [Secrets Management](../../knowledge/operations/secrets-management.md)

### Agent operations ledger

_Before any authenticated browser/API/CLI/native action on a provider, social, or store account_

- **Role:** Operator readiness
- **Phases:** Cross-phase (always-on)
- **Providers:** `provider.doppler` (cli, browser), `provider.app-store-connect` (cli, api, browser), `provider.google-play` (api, browser), `provider.posthog` (api, browser), `provider.revenuecat` (api, browser), `provider.stripe` (api, cli, browser), `provider.resend` (api, browser), `provider.app-store-screenshots` (skill_pack), `provider.higgsfield` (mcp), `provider.mobai` (mcp, cli), `provider.in-app-ios-simulator` (native_device), `provider.codex-native-ios` (local tooling — deliberately undeclared, see core/provisioning/requirements.ts), `provider.snapshot-previews` (local tooling — deliberately undeclared, see core/provisioning/requirements.ts), `provider.serve-sim` (local tooling — deliberately undeclared, see core/provisioning/requirements.ts), `provider.aso-skills` (skill_pack), `provider.refero` (api), `provider.security-review` (cli, manual), `provider.sentry` (api, cli, browser), `provider.paid-ad-channels` (manual)
- **Reads:** `operations/AGENT_OPERATIONS.md`, `operations/agent-operations.json`, `operations/PROVIDER_PROOF.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `operations/AGENT_OPERATIONS.md`, `operations/agent-operations.json`
- **Gates:** `check:agent-operations`
- **Knowledge:** [Founder-Zero Operator](../../knowledge/operations/founder-zero-operator.md), [Frontier Agent Operations](../../knowledge/operations/frontier-agent-operations.md), [Secrets Management](../../knowledge/operations/secrets-management.md)

## Market Research

### Research-backed spec

_Need category economics, competitor, review/social-language, keyword, or name-collision evidence_

- **Role:** Research strategist
- **Phases:** 1
- **Providers:** —
- **Reads:** `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `strategy/RESEARCH.md`, `product/SPEC.md`
- **Gates:** `check:research`
- **Knowledge:** [Research Intelligence](../../knowledge/process/tool-recipes/research-intelligence.md), [Core Loop And V1 Scope (Non-Archetype Products)](../../knowledge/product/core-loop-and-v1-scope.md), [Product Moat](../../knowledge/product/product-moat.md), [Go, Pivot, Or Kill: The Pre-Build Research Verdict](../../knowledge/research/go-pivot-or-kill.md)

### Localization market research

_Before localizing any surface or choosing locales_

- **Role:** Research strategist
- **Phases:** 1
- **Providers:** `provider.aso-skills` (skill_pack)
- **Reads:** `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `strategy/localization-market-research/LOCALIZATION_MARKET_RESEARCH.md`
- **Gates:** —
- **Knowledge:** [Localization Market Research](../../knowledge/research/localization-market-research.md)

## What You're Building

### App-archetype detection & starter

_Request matches a known product shape (social / AI-chat / habit / photo-AI)_

- **Role:** Mobile engineer
- **Phases:** Cross-phase (always-on)
- **Providers:** —
- **Reads:** `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** —
- **Gates:** `check:app-archetype`, `check:archetype-starter`
- **Knowledge:** [Core Loop And V1 Scope (Non-Archetype Products)](../../knowledge/product/core-loop-and-v1-scope.md)

## How The App Feels

### 11-star experience

_"11-star run" / before SPEC, onboarding, ads, store creative, or eng plans harden_

- **Role:** Product leader
- **Phases:** 1c
- **Providers:** —
- **Reads:** `product/SPEC.md`
- **Consults:** —
- **Produces:** `product/experience/11-star-experience/11_STAR_EXPERIENCE.md`, `product/experience/11-star-experience/11-star-experience.html`
- **Gates:** —
- **Knowledge:** [Eleven-Star Experience](../../knowledge/experience/eleven-star-experience.md)

### Emotional experience design (producer)

_Feature whose 11-star target is 6★+ / "charge this with emotion", "build a habit"_

- **Role:** Product leader
- **Phases:** 1c
- **Providers:** —
- **Reads:** `product/experience/11-star-experience/11_STAR_EXPERIENCE.md`, `analytics/ANALYTICS.md`
- **Consults:** —
- **Produces:** `product/experience/emotional-design/EMOTIONAL_DESIGN.md`
- **Gates:** `check:emotional-design`
- **Knowledge:** [Experience Cards](../../knowledge/experience/experience-cards.md), [Emotional Design System](../../knowledge/experience/emotional-design-system.md), [Emotional Experience Design](../../knowledge/experience/emotional-experience-design.md), [Emotional Experience Measurement](../../knowledge/experience/emotional-experience-measurement.md), [Ethics Guardrail](../../knowledge/experience/ethics-guardrail.md)

### Emotional design audit (auditor)

_"Audit this app's emotional design" / "emotional UX audit"_

- **Role:** Security architect
- **Phases:** 1c
- **Providers:** —
- **Reads:** `product/experience/emotional-design/EMOTIONAL_DESIGN.md`
- **Consults:** —
- **Produces:** `product/experience/emotional-design/EMOTIONAL_AUDIT.md`
- **Gates:** `check:emotional-design`
- **Knowledge:** [Experience Cards](../../knowledge/experience/experience-cards.md), [Consumer Product Design Agency](../../knowledge/experience/consumer-product-design-agency.md), [Emotional Design System](../../knowledge/experience/emotional-design-system.md), [Ethics Guardrail](../../knowledge/experience/ethics-guardrail.md)

### Onboarding conversion

_Before onboarding quizzes, review-prompt timing, paywall timing, or first-session activation_

- **Role:** Product leader
- **Phases:** 1c, 2
- **Providers:** —
- **Reads:** `design/design.md`, `product/experience/11-star-experience/11_STAR_EXPERIENCE.md`, `analytics/ANALYTICS.md`, `product/copy/COPY_DECK.md`
- **Consults:** —
- **Produces:** `product/ONBOARDING.md`, `product/onboarding.html`
- **Gates:** —
- **Knowledge:** [Eleven-Star Experience](../../knowledge/experience/eleven-star-experience.md), [Onboarding Conversion](../../knowledge/experience/onboarding-conversion.md), [Push Notification Lifecycle](../../knowledge/experience/push-notification-lifecycle.md), [Consumer Copy Benchmarks](../../knowledge/words/consumer-copy-benchmarks.md), [Conversion Copy](../../knowledge/words/conversion-copy.md)

## Look And Feel

### Design Room (state→mutate→version→render)

_Any design/visual-system/cross-surface/store-creative/landing/onboarding/paywall work_

- **Role:** Design guru
- **Phases:** 2
- **Providers:** —
- **Reads:** `design/design.md`, `studio/seed/business.json`, `studio/seed/theme.tokens.json`, `state/LAUNCH_TRACE.md`, `strategy/RESEARCH.md`
- **Consults:** —
- **Produces:** `design/design.md`, `studio/seed/business.json`, `studio/seed/theme.tokens.json`, `design/design-room.html`
- **Gates:** `validate:design-state`, `check:design-room`, `render:design-room`
- **Knowledge:** [Audience-Derived Identity](../../knowledge/design/audience-derived-identity.md), [Design Room](../../knowledge/design/design-room.md), [Landing Motion Craft](../../knowledge/design/landing-motion-craft.md), [Quality Lens](../../knowledge/design/quality-lens.md), [Surfaces B2C](../../knowledge/design/surfaces-b2c.md), [Vibecoded Tells](../../knowledge/design/vibecoded-tells.md)

### Token promotion

_Theme tokens change and the design is accepted_

- **Role:** Design guru
- **Phases:** 2
- **Providers:** —
- **Reads:** `studio/seed/theme.tokens.json`
- **Consults:** —
- **Produces:** `studio/generated/system/tokens.json`, `design/system/tokens.css`, `studio/generated/system/DesignTokens.swift`
- **Gates:** `check:token-promotion`
- **Knowledge:** [Design Room](../../knowledge/design/design-room.md), [Design Visual System](../../knowledge/design/design-visual-system.md)

### UX patterns (Refero)

_Before flow maps, state matrices, UX_PATTERNS.md, or bug-trap coverage_

- **Role:** Design guru
- **Phases:** 2
- **Providers:** `provider.refero` (api)
- **Reads:** `studio/seed/business.json`
- **Consults:** —
- **Produces:** `product/experience/ux-patterns/UX_PATTERNS.md`
- **Gates:** —
- **Knowledge:** [Refero UX Patterns](../../knowledge/design/refero-ux-patterns.md)

### Premium mobile craft

_Before in-app UI build/polish, press-state/haptics/loading-empty wiring, or "premium feel"_

- **Role:** Design guru
- **Phases:** Cross-phase (always-on)
- **Providers:** —
- **Reads:** `design/design.md`, `studio/seed/business.json`, `studio/seed/theme.tokens.json`
- **Consults:** `product/experience/ux-patterns/UX_PATTERNS.md`
- **Produces:** —
- **Gates:** `check:motion-contract`
- **Knowledge:** [Motion Craft Benchmarks](../../knowledge/design/motion-craft-benchmarks.md), [Premium Mobile Craft](../../knowledge/design/premium-mobile-craft.md)

### Content assets / Remotion / generated visuals

_Before rendered videos/stills, app previews, ad/social variants_

- **Role:** Design guru
- **Phases:** 2, 3
- **Providers:** `provider.higgsfield` (mcp)
- **Reads:** `design/design.md`, `studio/seed/theme.tokens.json`
- **Consults:** —
- **Produces:** `growth/content-assets/CONTENT_ASSETS.md`, `growth/content-assets/content-assets.html`
- **Gates:** `check:content-assets`
- **Knowledge:** [Design Visual System](../../knowledge/design/design-visual-system.md), [Remotion Content Assets](../../knowledge/design/remotion-content-assets.md), [Visual And Motion Production](../../knowledge/process/tool-recipes/visual-and-motion-production.md)

## Every Word A User Reads

### Writing quality (no-slop)

_Before writing or reviewing any founder-facing copy or any marketing copy the skill generates_

- **Role:** Copy specialist
- **Phases:** Cross-phase (always-on)
- **Providers:** —
- **Reads:** `strategy/BRAND.md`, `product/experience/11-star-experience/11_STAR_EXPERIENCE.md`
- **Consults:** —
- **Produces:** `product/copy/COPY_BRIEF.md`, `product/copy/COPY_DECK.md`
- **Gates:** `check:app-copy`
- **Knowledge:** [Consumer Copy Benchmarks](../../knowledge/words/consumer-copy-benchmarks.md), [Conversion Copy](../../knowledge/words/conversion-copy.md), [No-Slop Writing](../../knowledge/words/no-slop-writing.md)

## Building The App

### App source change ingestion

_When design is accepted and after every accepted app-source, build-config, localization, onboarding, feature, paywall, SDK, or visual change_

- **Role:** Mobile engineer
- **Phases:** 3
- **Providers:** —
- **Reads:** `run/app-source-fingerprint.sha256`, `design/design.md`, `engineering/TECH_SPEC.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `engineering/SOURCE_CHANGE_MANIFEST.json`
- **Gates:** `check:change-cascade`
- **Knowledge:** [Cascade Edges](../../knowledge/process/cascade-edges.yaml), [Change Cascade](../../knowledge/process/change-cascade.md), [Flow Traceability](../../knowledge/process/flow-traceability.md)

### Engineering orchestration (CE + production readiness)

_Before actual app implementation, builder prompts, or production-readiness claims_

- **Role:** Engineering leader
- **Phases:** 5b
- **Providers:** —
- **Reads:** `engineering/TECH_SPEC.md`, `state/LAUNCH_TRACE.md`, `design/design.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `engineering/ENGINEERING_PLAN.md`, `operations/ORCHESTRATION.md`, `engineering/PRODUCTION_READINESS.md`
- **Gates:** `check:compound-engineering`, `check:orchestration`
- **Knowledge:** [Premium Mobile Craft](../../knowledge/design/premium-mobile-craft.md), [Quality Lens](../../knowledge/design/quality-lens.md), [Engineering Orchestration](../../knowledge/engineering/engineering-orchestration.md), [Eleven-Star Experience](../../knowledge/experience/eleven-star-experience.md), [Compound Engineering Routing](../../knowledge/orchestration/compound-engineering-routing.md), [Parallel Agent Orchestration](../../knowledge/orchestration/parallel-agent-orchestration.md), [Project State](../../knowledge/orchestration/project-state.md), [Engineering And Agent Orchestration](../../knowledge/process/tool-recipes/engineering-and-agent-orchestration.md)

### Backend data contract

_Before schema/auth prompts or engineering/TECH_SPEC.md data/API sections harden_

- **Role:** Backend infrastructure engineer
- **Phases:** 1f, 5b
- **Providers:** —
- **Reads:** `engineering/TECH_SPEC.md`, `state/PROJECT_STATE.yaml`
- **Consults:** `design/design.md`, `trust/PRIVACY.md`
- **Produces:** —
- **Gates:** `check:backend-contract`
- **Knowledge:** [Backend Data Contract](../../knowledge/engineering/backend-data-contract.md), [Secrets Management](../../knowledge/operations/secrets-management.md), [Flow Traceability](../../knowledge/process/flow-traceability.md), [Privacy Terms](../../knowledge/trust/privacy-terms.md)

### App agent roster & repo entrypoints

_Before builder handoff bundles, AGENTS.md/CLAUDE.md, APP_AGENTS.md, agents/_

- **Role:** Orchestrator
- **Phases:** 5
- **Providers:** —
- **Reads:** `engineering/ENGINEERING_PLAN.md`, `operations/ORCHESTRATION.md`, `engineering/PRODUCTION_READINESS.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `AGENTS.md`, `CLAUDE.md`, `APP_AGENTS.md`
- **Gates:** —
- **Knowledge:** [App Agent Roster](../../knowledge/engineering/app-agent-roster.md), [Parallel Agent Orchestration](../../knowledge/orchestration/parallel-agent-orchestration.md), [Artifact Contracts](../../knowledge/process/artifact-contracts.md)

### MobAI device automation & demo videos

_Before device automation, app-flow demo videos, app previews, bug-repro recordings_

- **Role:** Accessibility and device QA
- **Phases:** 5b
- **Providers:** `provider.mobai` (mcp, cli)
- **Reads:** `engineering/ENGINEERING_PLAN.md`, `engineering/PRODUCTION_READINESS.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `growth/DEMO_VIDEO.md`
- **Gates:** `check:mobai-proof`
- **Knowledge:** [MobAI Toolbelt](../../knowledge/engineering/mobai-toolbelt.md), [Paid Tool Routing](../../knowledge/operations/paid-tool-routing.md), [Device Capture And Proof](../../knowledge/process/tool-recipes/device-capture-and-proof.md)

### Native iOS proof (Route Ladder)

_Before in-app iOS Simulator / Codex Desktop native iOS / XcodeBuildMCP / serve-sim / SnapshotPreviews proof_

- **Role:** Accessibility and device QA
- **Phases:** 5b
- **Providers:** `provider.in-app-ios-simulator` (native_device), `provider.codex-native-ios` (local tooling — deliberately undeclared, see core/provisioning/requirements.ts), `provider.snapshot-previews` (local tooling — deliberately undeclared, see core/provisioning/requirements.ts), `provider.serve-sim` (local tooling — deliberately undeclared, see core/provisioning/requirements.ts)
- **Reads:** `engineering/PRODUCTION_READINESS.md`, `engineering/ENGINEERING_PLAN.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** —
- **Gates:** `check:native-ios`
- **Knowledge:** [XcodeBuildMCP Testing](../../knowledge/engineering/xcodebuildmcp-testing.md), [Device Capture And Proof](../../knowledge/process/tool-recipes/device-capture-and-proof.md), [Apple Signing Release](../../knowledge/store/apple-signing-release.md)

### Accessibility common-task proof

_Before beta or store submission on every mobile launch_

- **Role:** Accessibility and device QA
- **Phases:** 5b
- **Providers:** `provider.in-app-ios-simulator` (native_device), `provider.mobai` (mcp, cli)
- **Reads:** `engineering/PRODUCTION_READINESS.md`, `design/design.md`
- **Consults:** —
- **Produces:** `engineering/ACCESSIBILITY_READINESS.md`
- **Gates:** —
- **Knowledge:** [Accessibility Readiness](../../knowledge/engineering/accessibility-readiness.md)

### App quality and vitals

_Before beta or store submission on every mobile launch_

- **Role:** Engineering leader
- **Phases:** 5b
- **Providers:** `provider.sentry` (api, cli, browser)
- **Reads:** `engineering/PRODUCTION_READINESS.md`, `engineering/TECH_SPEC.md`
- **Consults:** —
- **Produces:** `engineering/APP_QUALITY.md`
- **Gates:** —
- **Knowledge:** [App Quality And Vitals](../../knowledge/engineering/app-quality.md)

## App Store And Google Play

### ASO & store ops

_Before App Store/Play metadata, keyword research, ASA, or post-launch ASO loops_

- **Role:** Marketing guru
- **Phases:** 3
- **Providers:** —
- **Reads:** `design/design.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `STORE_OPS.md`
- **Gates:** —
- **Knowledge:** [Paid User Acquisition](../../knowledge/growth/paid-user-acquisition.md), [Growth And Store Routing](../../knowledge/process/tool-recipes/growth-and-store-routing.md), [Localization Market Research](../../knowledge/research/localization-market-research.md), [ASO Store Ops](../../knowledge/store/aso-store-ops.md), [Consumer Copy Benchmarks](../../knowledge/words/consumer-copy-benchmarks.md), [Conversion Copy](../../knowledge/words/conversion-copy.md), [No-Slop Writing](../../knowledge/words/no-slop-writing.md)

### App Store listing prep packet

_Before listing fields, privacy questionnaire, IAP/subscription field maps, CPPs, in-app events_

- **Role:** Marketing guru
- **Phases:** 3
- **Providers:** —
- **Reads:** `design/design.md`, `STORE_OPS.md`, `revenue/REVENUE_OPS.md`, `product/experience/11-star-experience/11_STAR_EXPERIENCE.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `store/app-store-listing/APP_STORE_LISTING.md`
- **Gates:** `check:store-console`
- **Knowledge:** [Eleven-Star Experience](../../knowledge/experience/eleven-star-experience.md), [Revenue Monetization](../../knowledge/money/revenue-monetization.md), [App Store Listing Prep](../../knowledge/store/app-store-listing-prep.md), [Consumer Copy Benchmarks](../../knowledge/words/consumer-copy-benchmarks.md), [Conversion Copy](../../knowledge/words/conversion-copy.md), [No-Slop Writing](../../knowledge/words/no-slop-writing.md)

### Apple signing & release readiness

_Before Apple Developer enrollment, Team ID, signing, profiles, archive/upload, TestFlight_

- **Role:** Engineering leader
- **Phases:** 3
- **Providers:** `provider.app-store-connect` (cli, api, browser)
- **Reads:** `store/app-store-listing/APP_STORE_LISTING.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `store/APPLE_SIGNING.md`
- **Gates:** —
- **Knowledge:** [Secrets Management](../../knowledge/operations/secrets-management.md), [App Store Connect CLI](../../knowledge/store/app-store-connect-cli.md), [Apple Signing Release](../../knowledge/store/apple-signing-release.md)

### Apple App Store requirements (privacy manifest)

_Before ASC upload — PrivacyInfo.xcprivacy, required-reason APIs, App Privacy answers_

- **Role:** Security architect
- **Phases:** 3
- **Providers:** `provider.app-store-connect` (cli, api, browser)
- **Reads:** `store/app-store-listing/APP_STORE_LISTING.md`, `trust/PRIVACY.md`, `trust/TERMS.md`, `analytics/ANALYTICS.md`, `revenue/REVENUE_OPS.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `store/APPLE_APP_STORE_REQUIREMENTS.md`
- **Gates:** `check:apple-requirements`
- **Knowledge:** [App Store Listing Prep](../../knowledge/store/app-store-listing-prep.md), [Store Console Workflow](../../knowledge/store/store-console-workflow.md), [Privacy Terms](../../knowledge/trust/privacy-terms.md)

### Store console workflow

_Before "where do I click / what do I paste" in ASC or Play Console_

- **Role:** Marketing guru
- **Phases:** 3
- **Providers:** `provider.app-store-connect` (cli, api, browser), `provider.google-play` (api, browser)
- **Reads:** `store/app-store-listing/APP_STORE_LISTING.md`, `store/APPLE_SIGNING.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `store/STORE_CONSOLE.md`, `store/store-console.html`
- **Gates:** `check:store-console`
- **Knowledge:** [App Store Connect CLI](../../knowledge/store/app-store-connect-cli.md), [Apple Signing Release](../../knowledge/store/apple-signing-release.md), [Google Play Release](../../knowledge/store/google-play-release.md), [Store Console Workflow](../../knowledge/store/store-console-workflow.md)

### ASC CLI automation

_Before Rork asc CLI app creation, metadata, screenshots, TestFlight, RevenueCat sync_

- **Role:** Engineering leader
- **Phases:** 3
- **Providers:** `provider.app-store-connect` (cli, api, browser)
- **Reads:** `store/STORE_CONSOLE.md`, `store/store-console.html`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** —
- **Gates:** `check:asc-command-contract`
- **Knowledge:** [Secrets Management](../../knowledge/operations/secrets-management.md), [App Store Connect CLI](../../knowledge/store/app-store-connect-cli.md), [Store Console Workflow](../../knowledge/store/store-console-workflow.md), [Conversion Copy](../../knowledge/words/conversion-copy.md)

### Store screenshots production

_Store screenshots needed (raw capture → composed iPhone/iPad/Play assets)_

- **Role:** Design guru
- **Phases:** 3
- **Providers:** `provider.app-store-screenshots` (skill_pack)
- **Reads:** `design/design.md`, `store/app-store-listing/APP_STORE_LISTING.md`, `product/experience/11-star-experience/11_STAR_EXPERIENCE.md`, `strategy/RESEARCH.md`, `product/experience/emotional-design/EMOTIONAL_DESIGN.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `store/app-store-listing/SCREENSHOTS.md`
- **Gates:** `check:store-screenshots`
- **Knowledge:** [Design Visual System](../../knowledge/design/design-visual-system.md), [Quality Lens](../../knowledge/design/quality-lens.md), [MobAI Toolbelt](../../knowledge/engineering/mobai-toolbelt.md), [Device Capture And Proof](../../knowledge/process/tool-recipes/device-capture-and-proof.md), [ASO Store Ops](../../knowledge/store/aso-store-ops.md), [Consumer Copy Benchmarks](../../knowledge/words/consumer-copy-benchmarks.md), [Conversion Copy](../../knowledge/words/conversion-copy.md)

### Google Play release

_Android in scope (platforms include android or an android bundle id exists)_

- **Role:** Engineering leader
- **Phases:** 3
- **Providers:** `provider.google-play` (api, browser)
- **Reads:** `store/app-store-listing/APP_STORE_LISTING.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `store/GOOGLE_PLAY_RELEASE.md`
- **Gates:** —
- **Knowledge:** [Revenue Monetization](../../knowledge/money/revenue-monetization.md), [Google Play Release](../../knowledge/store/google-play-release.md), [Store Console Workflow](../../knowledge/store/store-console-workflow.md), [Privacy Terms](../../knowledge/trust/privacy-terms.md)

### Google Play metadata standing envelope

_Google Play listing metadata is ready and a matching metadata standing envelope is current_

- **Role:** Marketing guru
- **Phases:** 3
- **Providers:** `provider.google-play` (api, browser)
- **Reads:** `store/STORE_CONSOLE.md`, `store/app-store-listing/APP_STORE_LISTING.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `store/proof/google-play-metadata-apply.json`
- **Gates:** `check:store-console`, `check:provider-proof`
- **Knowledge:** [Google Play Release](../../knowledge/store/google-play-release.md), [Store Console Workflow](../../knowledge/store/store-console-workflow.md), [Conversion Copy](../../knowledge/words/conversion-copy.md)

### Google Play media standing envelope

_Google Play screenshots, feature graphics, or promo video are ready and a matching media standing envelope is current_

- **Role:** Marketing guru
- **Phases:** 3
- **Providers:** `provider.google-play` (api, browser)
- **Reads:** `store/STORE_CONSOLE.md`, `store/app-store-listing/SCREENSHOTS.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `store/proof/google-play-media-apply.json`
- **Gates:** `check:store-screenshots`
- **Knowledge:** [ASO Store Ops](../../knowledge/store/aso-store-ops.md), [Google Play Release](../../knowledge/store/google-play-release.md)

### Google Play testing-track standing envelope

_An AAB is proven and an exact internal or closed-testing track standing envelope is current_

- **Role:** Engineering leader
- **Phases:** 5b
- **Providers:** `provider.google-play` (api, browser)
- **Reads:** `store/GOOGLE_PLAY_RELEASE.md`, `engineering/PRODUCTION_READINESS.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `store/proof/google-play-testing-track-apply.json`
- **Gates:** `check:provider-proof`
- **Knowledge:** [Provider Proof](../../knowledge/process/provider-proof.md), [Google Play Release](../../knowledge/store/google-play-release.md)

### Marketplace and regional compliance

_Before store distribution in every selected region_

- **Role:** Engineering leader
- **Phases:** 3, 5c
- **Providers:** `provider.app-store-connect` (cli, api, browser), `provider.google-play` (api, browser)
- **Reads:** `store/app-store-listing/APP_STORE_LISTING.md`, `operations/business-access.json`
- **Consults:** —
- **Produces:** `store/MARKETPLACE_COMPLIANCE.md`
- **Gates:** —
- **Knowledge:** [Marketplace And Regional Compliance](../../knowledge/store/marketplace-regional-compliance.md)

## Pricing And Getting Paid

### Revenue monetization

_Before RevenueCat/Stripe/web billing, products, paywall, entitlement, webhooks, pricing_

- **Role:** Engineering leader
- **Phases:** 3b
- **Providers:** `provider.revenuecat` (api, browser), `provider.stripe` (api, cli, browser)
- **Reads:** `state/LAUNCH_TRACE.md`, `strategy/RESEARCH.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `revenue/REVENUE_OPS.md`
- **Gates:** `check:revenue`
- **Knowledge:** [Billing Health And Reactivation](../../knowledge/money/billing-health-and-reactivation.md), [Paywall, Pricing, And Experiments](../../knowledge/money/paywall-pricing-and-experiments.md), [Revenue Monetization](../../knowledge/money/revenue-monetization.md), [RevenueCat And Store Products](../../knowledge/money/revenuecat-and-store-products.md), [Stripe And Web Billing](../../knowledge/money/stripe-and-web-billing.md), [Consumer Copy Benchmarks](../../knowledge/words/consumer-copy-benchmarks.md), [Conversion Copy](../../knowledge/words/conversion-copy.md)

## Marketing And Growth

### Paid user-acquisition system

_Before paid ads, ASA, Meta/TikTok/Google campaigns, or spend-readiness claims_

- **Role:** Marketing guru
- **Phases:** 1d
- **Providers:** `provider.paid-ad-channels` (manual), `provider.posthog` (api, browser), `provider.revenuecat` (api, browser)
- **Reads:** `design/design.md`, `analytics/ANALYTICS.md`, `strategy/localization-market-research/LOCALIZATION_MARKET_RESEARCH.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `growth/PAID_UA.md`
- **Gates:** `check:paid-ua`
- **Knowledge:** [Paid User Acquisition](../../knowledge/growth/paid-user-acquisition.md), [Revenue Monetization](../../knowledge/money/revenue-monetization.md), [Paid Tool Routing](../../knowledge/operations/paid-tool-routing.md), [Localization Market Research](../../knowledge/research/localization-market-research.md)

### Viral growth loop

_Before referral/share-to-unlock/invite/comment-loop mechanics_

- **Role:** Marketing guru
- **Phases:** 1e
- **Providers:** —
- **Reads:** `design/design.md`, `analytics/ANALYTICS.md`, `product/experience/11-star-experience/11_STAR_EXPERIENCE.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `growth/VIRAL_GROWTH.md`
- **Gates:** —
- **Knowledge:** [Ethics Guardrail](../../knowledge/experience/ethics-guardrail.md), [Onboarding Conversion](../../knowledge/experience/onboarding-conversion.md), [Viral Growth Loops](../../knowledge/growth/viral-growth-loops.md), [Revenue Monetization](../../knowledge/money/revenue-monetization.md), [Consumer Copy Benchmarks](../../knowledge/words/consumer-copy-benchmarks.md), [Conversion Copy](../../knowledge/words/conversion-copy.md)

### Launch narrative & cadence

_Before the public announcement, launch-day run-of-show, or weekly release rhythm_

- **Role:** Marketing guru
- **Phases:** 1e, 3, 6
- **Providers:** —
- **Reads:** `design/design.md`, `growth/VIRAL_GROWTH.md`, `product/experience/11-star-experience/11_STAR_EXPERIENCE.md`
- **Consults:** `growth/content-assets/CONTENT_ASSETS.md`
- **Produces:** `growth/LAUNCH_NARRATIVE.md`
- **Gates:** —
- **Knowledge:** [Ethics Guardrail](../../knowledge/experience/ethics-guardrail.md), [Launch Narrative Cadence](../../knowledge/growth/launch-narrative-cadence.md), [Viral Growth Loops](../../knowledge/growth/viral-growth-loops.md), [Consumer Copy Benchmarks](../../knowledge/words/consumer-copy-benchmarks.md), [No-Slop Writing](../../knowledge/words/no-slop-writing.md)

### GEO/SEO public-surface plan

_Before editing any landing/policy/blog copy, robots.txt, llms.txt, sitemap, schema, or metadata_

- **Role:** Marketing guru
- **Phases:** 4
- **Providers:** —
- **Reads:** `state/LAUNCH_TRACE.md`, `analytics/ANALYTICS.md`, `strategy/localization-market-research/LOCALIZATION_MARKET_RESEARCH.md`
- **Consults:** —
- **Produces:** `GEO_SEO.md`
- **Gates:** —
- **Knowledge:** [GEO/SEO](../../knowledge/growth/geo-seo.md), [Localization Market Research](../../knowledge/research/localization-market-research.md), [No-Slop Writing](../../knowledge/words/no-slop-writing.md)

### Local landing site and waitlist build

_Immediately after design/design.md is accepted — build the local landing site while app implementation runs_

- **Role:** Launch surface producer
- **Phases:** 4
- **Providers:** —
- **Reads:** `GEO_SEO.md`, `analytics/ANALYTICS.md`, `product/copy/COPY_BRIEF.md`, `product/copy/COPY_DECK.md`, `product/ONBOARDING.md`, `strategy/localization-market-research/LOCALIZATION_MARKET_RESEARCH.md`, `design/design.md`
- **Consults:** `revenue/REVENUE_OPS.md`, `store/app-store-listing/SCREENSHOTS.md`, `growth/content-assets/CONTENT_ASSETS.md`
- **Produces:** `growth/landing/`
- **Gates:** —
- **Knowledge:** [Analytics And Attribution](../../knowledge/data/analytics-attribution.md), [Landing Motion Craft](../../knowledge/design/landing-motion-craft.md), [Vibecoded Tells](../../knowledge/design/vibecoded-tells.md), [CRO Landing](../../knowledge/growth/cro-landing.md), [Funnel Domain And Privacy](../../knowledge/process/tool-recipes/funnel-domain-and-privacy.md), [Consumer Copy Benchmarks](../../knowledge/words/consumer-copy-benchmarks.md), [Conversion Copy](../../knowledge/words/conversion-copy.md)

### Landing funnel publication and live proof

_After the local landing build passes and an exact website-deployment standing envelope or one-shot approval is current_

- **Role:** Launch surface producer
- **Phases:** 4
- **Providers:** —
- **Reads:** `growth/landing/`, `GEO_SEO.md`, `analytics/ANALYTICS.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** —
- **Gates:** `check:landing-funnel`
- **Knowledge:** [CRO Landing](../../knowledge/growth/cro-landing.md), [GEO/SEO](../../knowledge/growth/geo-seo.md), [Funnel Domain And Privacy](../../knowledge/process/tool-recipes/funnel-domain-and-privacy.md), [Conversion Copy](../../knowledge/words/conversion-copy.md)

### UGC creator engine

_Before founder-led organic social, creator sourcing/contracts, format-discovery tests_

- **Role:** Marketing guru
- **Phases:** 6
- **Providers:** —
- **Reads:** `design/design.md`, `growth/VIRAL_GROWTH.md`, `growth/LAUNCH_NARRATIVE.md`, `product/experience/11-star-experience/11_STAR_EXPERIENCE.md`
- **Consults:** —
- **Produces:** `growth/UGC_PLAYBOOK.md`
- **Gates:** —
- **Knowledge:** [Influencer Sponsorship Engine](../../knowledge/growth/influencer-sponsorship-engine.md), [UGC Creator Engine](../../knowledge/growth/ugc-creator-engine.md), [Viral Growth Loops](../../knowledge/growth/viral-growth-loops.md), [No-Slop Writing](../../knowledge/words/no-slop-writing.md)

### Fastlane growth ops

_After launch approval/public beta, or usefastlane.ai/Blitz setup, scheduling, social analytics_

- **Role:** Marketing guru
- **Phases:** 6
- **Providers:** —
- **Reads:** `design/design.md`, `growth/LAUNCH_NARRATIVE.md`, `ugc/script-bank.md`
- **Consults:** —
- **Produces:** `growth/FASTLANE_OPS.md`
- **Gates:** `check:post-launch`
- **Knowledge:** [Fastlane Growth Ops](../../knowledge/growth/fastlane-growth-ops.md), [UGC Creator Engine](../../knowledge/growth/ugc-creator-engine.md), [Viral Growth Loops](../../knowledge/growth/viral-growth-loops.md), [Paid Tool Routing](../../knowledge/operations/paid-tool-routing.md)

## Analytics And Tracking

### Analytics & attribution blueprint

_Before locking onboarding/paywall/funnels/store CTAs or any prompt naming events_

- **Role:** Backend infrastructure engineer
- **Phases:** 1b
- **Providers:** `provider.posthog` (api, browser)
- **Reads:** `strategy/RESEARCH.md`, `product/SPEC.md`, `state/PROJECT_STATE.yaml`
- **Consults:** —
- **Produces:** `analytics/ANALYTICS.md`, `analytics/analytics-plan.html`
- **Gates:** `check:analytics-catalog`, `check:attribution`
- **Knowledge:** [Analytics And Attribution](../../knowledge/data/analytics-attribution.md), [Artifact Contracts](../../knowledge/process/artifact-contracts.md), [Provider Proof](../../knowledge/process/provider-proof.md)

## Privacy, Security, And Legal

### Security architecture & release gate

_Before threat modeling, hardening, scans, or any security-readiness claim_

- **Role:** Security architect
- **Phases:** 1g, 5c
- **Providers:** `provider.security-review` (cli, manual), `provider.sentry` (api, cli, browser)
- **Reads:** `trust/SECURITY.md`, `engineering/TECH_SPEC.md`, `strategy/TOOL_DECISIONS.md`
- **Consults:** `trust/PRIVACY.md`, `revenue/REVENUE_OPS.md`
- **Produces:** `trust/SECURITY.md`, `trust/security-review.html`
- **Gates:** `check:security`
- **Knowledge:** [Privacy Terms](../../knowledge/trust/privacy-terms.md), [Security Release Hardening](../../knowledge/trust/security-release-hardening.md)

### Privacy & terms

_Before privacy policy, terms, EULA, subscription terms, account-deletion, store disclosures_

- **Role:** Customer success
- **Phases:** 3
- **Providers:** —
- **Reads:** `state/LAUNCH_TRACE.md`, `engineering/TECH_SPEC.md`
- **Consults:** —
- **Produces:** `trust/PRIVACY.md`, `trust/TERMS.md`, `LEGAL_REVIEW.md`
- **Gates:** `check:privacy`
- **Knowledge:** [Privacy Terms](../../knowledge/trust/privacy-terms.md)

### Community and user safety

_When the product includes social, chat, creator, or other user-generated content_

- **Role:** Security architect
- **Phases:** 3, 5c
- **Providers:** —
- **Reads:** `product/SPEC.md`, `trust/PRIVACY.md`
- **Consults:** —
- **Produces:** `trust/COMMUNITY_SAFETY.md`
- **Gates:** —
- **Knowledge:** [Community And User Safety](../../knowledge/trust/community-safety.md)

### Generative-AI safety

_When the product generates text, images, audio, or video_

- **Role:** Security architect
- **Phases:** 3, 5c
- **Providers:** —
- **Reads:** `product/SPEC.md`, `trust/SECURITY.md`, `trust/PRIVACY.md`
- **Consults:** —
- **Produces:** `trust/AI_SAFETY.md`
- **Gates:** —
- **Knowledge:** [Generative-AI Safety](../../knowledge/trust/generative-ai-safety.md)

## The Skill's Own Upkeep

### Runtime freshness gate (consumer side)

_Before substantial launch/design/store/revenue/build work when the installed runtime may be behind source_

- **Role:** Orchestrator
- **Phases:** Cross-phase (always-on)
- **Providers:** —
- **Reads:** `skill-version.json`
- **Consults:** —
- **Produces:** `skill-version.json`
- **Gates:** `check:skill-version`
- **Knowledge:** —

### Source-freshness maintenance (maintainer)

_Maintaining the skill, adding external URLs, refreshing third-party docs/commands_

- **Role:** Engineering leader
- **Phases:** Cross-phase (always-on)
- **Providers:** —
- **Reads:** `SKILL.md`, `validation/repository/source-registry.yaml`
- **Consults:** —
- **Produces:** `validation/repository/source-registry.yaml`
- **Gates:** `check:source-registry`
- **Knowledge:** —

### Skill runtime sync & version discipline (maintainer)

_After any skill change — bump version, sync the installed runtime, run the readiness gate_

- **Role:** Engineering leader
- **Phases:** Cross-phase (always-on)
- **Providers:** —
- **Reads:** `skill-version.json`
- **Consults:** —
- **Produces:** —
- **Gates:** `check:version-discipline`, `check:skill-version`
- **Knowledge:** [Run The Maintainer Audit From The Repository Root](../../knowledge/process/learnings/audit-runs-from-repo-root.md)

### Founder-language translation (maintainer)

_Adding or renaming a lane, status, phase, autonomy mode, or provider route; any founder-visible surface change_

- **Role:** Orchestrator
- **Phases:** Cross-phase (always-on)
- **Providers:** —
- **Reads:** `tooling/lib/founder-copy.ts`
- **Consults:** —
- **Produces:** `tooling/lib/founder-copy.ts`
- **Gates:** `check:founder-copy`
- **Knowledge:** [No-Slop Writing](../../knowledge/words/no-slop-writing.md)

### Skill triggering contract (maintainer)

_Changing SKILL.md frontmatter, the skill description, or the trigger phrasing_

- **Role:** Product leader
- **Phases:** Cross-phase (always-on)
- **Providers:** —
- **Reads:** `SKILL.md`
- **Consults:** —
- **Produces:** `SKILL.md`
- **Gates:** `check:autopilot`
- **Knowledge:** [Technical Documentation In ASD-STE100](../../knowledge/engineering/technical-documentation-ste100.md)

### ASC command contract (maintainer)

_Before changing any documented asc command in knowledge/store/app-store-connect-cli.md_

- **Role:** Engineering leader
- **Phases:** Cross-phase (always-on)
- **Providers:** —
- **Reads:** `knowledge/store/app-store-connect-cli.md`
- **Consults:** —
- **Produces:** `knowledge/store/app-store-connect-cli.md`
- **Gates:** `check:asc-command-contract`
- **Knowledge:** [Failure Cards](../../knowledge/process/failure-cards.md), [App Store Connect CLI](../../knowledge/store/app-store-connect-cli.md)

### Definition graph maintenance

_Changing a domain, workflow, phase, lane, artifact, gate, reference, or generated catalog projection_

- **Role:** Orchestrator
- **Phases:** Cross-phase (always-on)
- **Providers:** —
- **Reads:** `catalog/generated/routing.md`, `catalog/generated/spine.md`, `catalog/generated/contracts.md`
- **Consults:** —
- **Produces:** `catalog/generated/routing.md`, `catalog/generated/spine.md`, `catalog/generated/contracts.md`
- **Gates:** `check:catalog`, `catalog:render-routing`
- **Knowledge:** —

### Eval suite execution (maintainer)

_Adding, removing, or renaming a validator, a LaunchBench scenario, or an agent-behavior eval; before trusting that any of them still catch what they claim to. Also run `npm run launchbench` (scenario lint + validator fixture suite) directly, and `npm run evals:behavioral` by hand when a live-agent signal is worth the cost and variance._

- **Role:** Engineering leader
- **Phases:** Cross-phase (always-on)
- **Providers:** —
- **Reads:** `validation/repository/evals/launchbench/`, `validation/repository/evals/agent-behavior/`
- **Consults:** —
- **Produces:** `validation/repository/evals/launchbench/`, `validation/repository/evals/agent-behavior/`
- **Gates:** `check:agent-evals`
- **Knowledge:** [Failure Cards](../../knowledge/process/failure-cards.md)

### Learning capture (maintainer)

_After a solved and verified problem, a closed audit, or a post-merge lesson produces operating knowledge future runs should load_

- **Role:** Orchestrator
- **Phases:** Cross-phase (always-on)
- **Providers:** —
- **Reads:** —
- **Consults:** —
- **Produces:** —
- **Gates:** `check:learning-grounding`
- **Knowledge:** [Learning Capture](../../knowledge/process/learning-capture.md)

### Learning corpus refresh (maintainer)

_A learning_grounding.review_overdue warning, a change to files a learning cites, or a scheduled corpus pass over knowledge/*/learnings/_

- **Role:** Engineering leader
- **Phases:** Cross-phase (always-on)
- **Providers:** —
- **Reads:** —
- **Consults:** —
- **Produces:** —
- **Gates:** `check:learning-grounding`
- **Knowledge:** [Learning Capture](../../knowledge/process/learning-capture.md)

<!-- catalog-generated:end node-contracts -->

<!-- catalog-generated:start provider-route-matrix -->
# Provider Access Routes

Generated from core/provisioning/requirements.ts. Edit the manifest, not this file.

| Provider | Capability | mcp | api | cli | browser | native_device | skill_pack | manual |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `provider.doppler` | secret-storage-and-injection |  |  | ✓ | ✓ |  |  |  |
| `provider.resend` | founder-digest-email |  | ✓ |  | ✓ |  |  |  |
| `provider.posthog` | product-analytics-and-attribution |  | ✓ |  | ✓ |  |  |  |
| `provider.revenuecat` | subscription-entitlements |  | ✓ |  | ✓ |  |  |  |
| `provider.stripe` | web-checkout-billing |  | ✓ | ✓ | ✓ |  |  |  |
| `provider.sentry` | crash-and-error-monitoring |  | ✓ | ✓ | ✓ |  |  |  |
| `provider.app-store-connect` | ios-distribution-and-testflight |  | ✓ | ✓ | ✓ |  |  |  |
| `provider.google-play` | android-distribution |  | ✓ |  | ✓ |  |  |  |
| `provider.paid-ad-channels` | paid-user-acquisition-spend |  |  |  |  |  |  | ✓ |
| `provider.refero` | ux-pattern-research |  | ✓ |  |  |  |  |  |
| `provider.higgsfield` | ai-generated-marketing-visuals | ✓ |  |  |  |  |  |  |
| `provider.mobai` | device-automation-and-demo-capture | ✓ |  | ✓ |  |  |  |  |
| `provider.security-review` | security-scanning-and-release-gate |  |  | ✓ |  |  |  | ✓ |
| `provider.app-store-screenshots` | store-screenshot-composition |  |  |  |  |  | ✓ |  |
| `provider.aso-skills` | aso-specialist-guidance |  |  |  |  |  | ✓ |  |
| `provider.in-app-ios-simulator` | local-device-proof |  |  |  |  | ✓ |  |  |

Not listed: `provider.codex-native-ios`, `provider.snapshot-previews`, `provider.serve-sim` — deliberately
undeclared local tooling sharing `provider.in-app-ios-simulator`'s no-secret shape (see
core/provisioning/requirements.ts).

<!-- catalog-generated:end provider-route-matrix -->
