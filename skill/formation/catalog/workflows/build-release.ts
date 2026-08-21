import { workflow } from "./helpers.js";

/**
 * Ported from runtime/graph/workflows/build-release.ts. All thirteen are grantable-domain.
 *
 * One structural fix versus v1: v1's `asc-cli-automation` and `store-console-workflow` both
 * declared `store/STORE_CONSOLE.md` as an output. v1's graph tolerated this silently
 * (runtime/graph/graph.ts dedupes discovered artifacts into a path-keyed map with no
 * collision check); compile.ts's compilePlan() does not — it fails closed on "Ambiguous
 * shared write(s)" by design (KTD6, carrying the v0.65.1 Compiler steps 1/9 rule). Since
 * `asc-cli-automation` already depends on `store-console-workflow` and only extends that
 * document rather than authoring a distinct one, its outputPaths drops the duplicate here
 * rather than the catalog silently tolerating an unresolvable two-writer artifact.
 *
 * Same fix, same reason, for `engineering/PRODUCTION_READINESS.md`: v1 had THREE workflows
 * declare it as an output (engineering-orchestration-ce-production-readiness,
 * mobai-device-automation-and-demo-videos, native-ios-proof-route-ladder). The latter two
 * both already depend on the first, which is the artifact's actual author; they attach
 * evidence to it (device proof, MobAI proof) rather than authoring it, so their
 * outputPaths drop the duplicate here too.
 *
 * `engineering/TECH_SPEC.md` had the same problem one level up: both
 * workflow.process.launch-trace-and-build-contracts (operating-system.ts) and this file's
 * `backend-data-contract` declared it. `backend-data-contract` already depends on
 * `launch-trace-and-build-contracts`, which authors the file; `backend-data-contract`
 * hardens its data/API sections rather than authoring it fresh, so it drops the duplicate.
 */
export const workflows = [
  workflow({
    id: "workflow.store.aso-and-store-ops",
    title: "ASO & store ops",
    domainId: "domain.store",
    areaIds: ["area.build-release"],
    trigger: "Before App Store/Play metadata, keyword research, ASA, or post-launch ASO loops",
    instructions:
      "Build app-marketing-context (app name, category, target country, top competitors, primary/secondary/long-tail keyword candidates, current listing state, and public support/privacy URLs) before locking a single metadata field, then run keyword and name-collision checks in the target country and separate brand language from search language. Route any localization call through the demand-first priority tiers in LOCALIZATION_MARKET_RESEARCH.md rather than translating on inference, and route Apple Search Ads storefront targeting from the same tiers. Draft final metadata fields plus rejected alternatives with rationale into STORE_OPS.md, and run every metadata/keyword string through the no-slop-writing.md self-check before calling it locked. For the recurring post-launch loop, track keyword rank deltas, ASA search-term mining, and localization opportunities weekly rather than treating ASO as a one-time pass.",
    reads: ["design/design.md", "state/PROJECT_STATE.yaml"],
    roleId: "role.marketing-guru",
    laneIds: ["store_console"],
    phaseIds: ["phase.3"],
    dependencies: ["workflow.design.design-room-state-mutate-version-render"],
    outputPaths: ["STORE_OPS.md"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.store.app-store-listing-prep-packet",
    title: "App Store listing prep packet",
    domainId: "domain.store",
    areaIds: ["area.build-release"],
    trigger: "Before listing fields, privacy questionnaire, IAP/subscription field maps, CPPs, in-app events",
    instructions:
      "Build APP_STORE_LISTING.md as the bridge document: default listing fields, App Privacy answers derived from the actual data inventory and SDK/vendor behavior (never from policy prose alone), and pricing/subscription mapping reconciled against revenue/REVENUE_OPS.md's RevenueCat/Stripe/web-funnel state. Anchor screenshot, App Preview, custom-product-page, and In-App Event concepts to the real V1 scalable slice in 11_STAR_EXPERIENCE.md so the listing never invents a promise the app cannot keep. Run the finished description/keyword/promotional-text copy through the no-slop-writing.md self-check, then confirm `npm run check:store-console -- --root .` passes before calling the packet ready. Founder approval gates any live product creation, price change, or submission — draft the packet, do not publish it.",
    reads: [
      "design/design.md",
      "STORE_OPS.md",
      "revenue/REVENUE_OPS.md",
      "product/experience/11-star-experience/11_STAR_EXPERIENCE.md",
      "state/PROJECT_STATE.yaml",
    ],
    roleId: "role.marketing-guru",
    laneIds: ["store_console"],
    phaseIds: ["phase.3"],
    // Listing IAP/subscription field maps must name the same products RevenueCat already owns
    // (see check:store-console's cross-check against revenue/REVENUE_OPS.md) — without this
    // edge, store console work and RevenueCat product setup could each create the "same" live
    // App Store/Play product with no ordering guarantee or drift detection.
    dependencies: ["workflow.store.aso-and-store-ops", "workflow.money.revenue-monetization"],
    outputPaths: ["store/app-store-listing/APP_STORE_LISTING.md"],
    gates: ["check:store-console"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.store.apple-signing-and-release-readiness",
    title: "Apple signing & release readiness",
    domainId: "domain.store",
    areaIds: ["area.build-release"],
    trigger: "Before Apple Developer enrollment, Team ID, signing, profiles, archive/upload, TestFlight",
    instructions:
      "Classify the Apple account state (membership, Team ID, role, agreements signed) before any TestFlight/App Store distribution claim, and treat a simulator build as engineering proof only, never distribution readiness. Run the five-item pre-archive/export/upload preflight checklist — SDK keys actually injected into the archived Info.plist, `plutil -lint` on PrivacyInfo.xcprivacy, NSPrivacyAccessedAPITypes coverage, API-key (not interactive-session) export auth, and native screenshot dimension floors — and record pass/BLOCKED for each in store/APPLE_SIGNING.md before archiving. Do not begin `xcodebuild archive` until every item is pass or ready. A current exact TestFlight upload standing envelope authorizes archive/upload without another prompt; read back the build state and record proof. Enrollment, certificate creation/rotation, agreements, pricing, final review submission, and production release remain founder decisions unless the opening envelope names that exact action.",
    reads: ["store/app-store-listing/APP_STORE_LISTING.md", "state/PROJECT_STATE.yaml"],
    roleId: "role.engineering-leader",
    laneIds: ["apple_signing"],
    phaseIds: ["phase.3"],
    dependencies: ["workflow.store.app-store-listing-prep-packet"],
    outputPaths: ["store/APPLE_SIGNING.md"],
    providers: ["provider.app-store-connect"],
    founderOnlyActions: ["approve signing, upload, or submission actions not covered by an exact current standing envelope"],
    actionClass: "release",
    protectedCategory: "release",
    idempotent: false,
  }),
  workflow({
    id: "workflow.store.apple-app-store-requirements-privacy-manifest",
    title: "Apple App Store requirements (privacy manifest)",
    domainId: "domain.store",
    areaIds: ["area.build-release"],
    trigger: "Before ASC upload — PrivacyInfo.xcprivacy, required-reason APIs, App Privacy answers",
    instructions:
      "Reconcile the App Privacy answers against the real data inventory: code/SDK list, analytics/ANALYTICS.md, revenue/REVENUE_OPS.md, backend schema, and the public privacy/terms pages — never answer from policy prose alone. Prove the bundled PrivacyInfo.xcprivacy lints clean, NSPrivacyAccessedAPITypes covers every required-reason API the code actually uses (UserDefaults, file-timestamp APIs, etc.), and third-party SDK manifests/signatures plus the Xcode privacy report are reconciled before any ASC upload-readiness claim. Write the result to store/APPLE_APP_STORE_REQUIREMENTS.md and pass `npm run check:apple-requirements -- --root .`; a passed App Store Connect upload with an invalid or incomplete privacy manifest is a release blocker, not post-submit cleanup. Founder approval is required on the final App Privacy answers before they are published in App Store Connect.",
    reads: [
      "store/app-store-listing/APP_STORE_LISTING.md",
      "trust/PRIVACY.md",
      "trust/TERMS.md",
      "analytics/ANALYTICS.md",
      "revenue/REVENUE_OPS.md",
      "state/PROJECT_STATE.yaml",
    ],
    roleId: "role.security-architect",
    laneIds: ["store_console", "privacy_legal"],
    phaseIds: ["phase.3"],
    dependencies: ["workflow.store.app-store-listing-prep-packet", "workflow.trust.privacy-and-terms"],
    outputPaths: ["store/APPLE_APP_STORE_REQUIREMENTS.md"],
    gates: ["check:apple-requirements"],
    providers: ["provider.app-store-connect"],
    founderOnlyActions: ["approve privacy answers"],
    actionClass: "mutate",
    protectedCategory: "legal_pricing",
    idempotent: true,
  }),
  workflow({
    id: "workflow.store.store-console-workflow",
    title: "Store console workflow",
    domainId: "domain.store",
    areaIds: ["area.build-release"],
    trigger: 'Before "where do I click / what do I paste" in ASC or Play Console',
    instructions:
      "Produce the console-ready packet that tells the founder exactly where to click, what to paste, and what still needs their approval: fill store/STORE_CONSOLE.md field-by-field (click path, character limit, paste-ready value, evidence source, status) for every App Store Connect and Google Play Console page in scope, then render store/store-console.html as the copy-paste surface grouped by console page. Distinguish the Apple readiness states explicitly — simulator-build-ok, apple-account-ready, bundle-id-ready, app-record-ready, signing-ready, archive-ready, upload-ready — and never call the launch 'TestFlight-ready' from a simulator build alone. Reconcile Apple App Privacy answers against Google Play Data safety answers so the two stores never contradict each other for the same codebase, then confirm `npm run check:store-console -- --root .` passes. Founder approval is required before any external console mutation — app creation, metadata apply, screenshot upload, submission.",
    reads: ["store/app-store-listing/APP_STORE_LISTING.md", "store/APPLE_SIGNING.md", "state/PROJECT_STATE.yaml"],
    roleId: "role.marketing-guru",
    laneIds: ["store_console"],
    phaseIds: ["phase.3"],
    dependencies: ["workflow.store.app-store-listing-prep-packet", "workflow.store.apple-signing-and-release-readiness"],
    outputPaths: ["store/STORE_CONSOLE.md", "store/store-console.html"],
    gates: ["check:store-console"],
    providers: ["provider.app-store-connect", "provider.google-play"],
    founderOnlyActions: ["approve external console mutations"],
    actionClass: "mutate",
    protectedCategory: "credentials_access",
    idempotent: false,
  }),
  workflow({
    id: "workflow.store.asc-cli-automation",
    title: "ASC CLI automation",
    domainId: "domain.store",
    areaIds: ["area.build-release"],
    trigger: "Before Rork asc CLI app creation, metadata, screenshots, TestFlight, RevenueCat sync",
    instructions:
      "Default to the `asc` CLI/skill-pack route for App Store Connect work — reads, ID resolution, metadata/screenshot dry-runs, and TestFlight/review-status checks are safe without new approval. Work the auth ladder before reporting ASC as blocked: check an existing keychain profile first (`asc --profile <Name>`), never `source` a credential `.env` file, and treat 'app record not found' as a setup step. Confirm `--help` before any unverified subcommand. Apply approved metadata, screenshots, previews, product pages, and TestFlight uploads automatically when an exact current standing envelope covers the workflow, target, resource, and action class; use the required confirmation flag, capture before-state, and read back the provider result. Ask only when that scope is absent or expired. Pricing, agreements, final review submission, and public release remain exceptional unless explicitly named in the envelope. Pass `npm run check:asc-command-contract -- --root .` and return the state/STORE_CONSOLE reconciliation patch after every external change.",
    reads: ["store/STORE_CONSOLE.md", "store/store-console.html", "state/PROJECT_STATE.yaml"],
    roleId: "role.engineering-leader",
    laneIds: ["store_console"],
    phaseIds: ["phase.3"],
    dependencies: ["workflow.store.store-console-workflow"],
    // outputPaths intentionally empty: extends store/STORE_CONSOLE.md, which
    // workflow.store.store-console-workflow already owns as its output (see file header).
    gates: ["check:asc-command-contract"],
    providers: ["provider.app-store-connect"],
    founderOnlyActions: ["approve App Store Connect mutations"],
    actionClass: "mutate",
    protectedCategory: "credentials_access",
    idempotent: false,
  }),
  workflow({
    id: "workflow.store.store-screenshots-production",
    title: "Store screenshots production",
    domainId: "domain.store",
    areaIds: ["area.build-release"],
    trigger: "Store screenshots needed (raw capture → composed iPhone/iPad/Play assets)",
    instructions:
      "Capture raw app UI first — in-app iOS Simulator (rung 0) for a local Mac, MobAI for Android or a repeatable matrix — and treat those raw captures as proof inputs, never final store creative. Before composing or materially changing a store frame, rerun workflow.design.design-room-state-mutate-version-render with a store-first-frame change classification and affected scope so the Design Room's single writer records a fresh Design Evidence pass in design/design.md; then run check:design-room. An accepted Design Room dependency from an earlier or unrelated scope is not evidence for new store creative. Compose final assets from the Asset Knowledge Brief (strategy/RESEARCH.md's user/problem, 11_STAR_EXPERIENCE.md's magical moment, the emotion/card from EMOTIONAL_DESIGN.md, design/design.md's tokens) with headline, copy overlay, device frame, and export every required iPhone/iPad/Play well — never a generic, knowledge-free hook. Run every composed frame through quality-lens.md's Anti-Generic Checks before calling the deck done, and write the raw-path/composition-path/upload-status table to SCREENSHOTS.md. Pass `npm run check:store-screenshots -- --root .`; a technically correct, on-brand screenshot that still reads as generic fails the done bar.",
    reads: [
      "design/design.md",
      "store/app-store-listing/APP_STORE_LISTING.md",
      "product/experience/11-star-experience/11_STAR_EXPERIENCE.md",
      "strategy/RESEARCH.md",
      "product/experience/emotional-design/EMOTIONAL_DESIGN.md",
      "state/PROJECT_STATE.yaml",
    ],
    roleId: "role.design-guru",
    laneIds: ["store_console", "content_assets"],
    phaseIds: ["phase.3"],
    dependencies: ["workflow.design.design-room-state-mutate-version-render", "workflow.store.app-store-listing-prep-packet"],
    outputPaths: ["store/app-store-listing/SCREENSHOTS.md"],
    gates: ["check:design-room", "check:store-screenshots"],
    providers: ["provider.app-store-screenshots"],
    actionClass: "mutate",
    idempotent: false,
  }),
  workflow({
    id: "workflow.store.google-play-release",
    title: "Google Play release",
    domainId: "domain.store",
    areaIds: ["area.build-release"],
    trigger: "Android in scope (platforms include android or an android bundle id exists)",
    instructions:
      "Classify the Play developer account (organization vs personal, verification status, payments profile) before any Android readiness claim, and if personal, plan the 12-tester/14-continuous-day closed-testing production gate into the launch timeline now — it is a calendar gate, not a paperwork gate. Complete every Policy > App content task (Data safety, content rating, App access demo credentials, account deletion) and reconcile the Data safety answers against the same data inventory used for Apple App Privacy; a divergence between the two stores for one codebase is a reconciliation failure unless explicitly documented. Enroll in Play App Signing, upload an AAB (never an APK) as the readiness artifact, and stage production rollout in percentages with a named halt owner rather than 0% straight to 100%. Write the eight required sections (Developer Account, Data Safety, Content Rating, Play App Signing, Target API Level, Release Tracks, Closed Testing, Pre-Launch Report) to store/GOOGLE_PLAY_RELEASE.md before calling the Play side of lanes.store_console done.",
    reads: ["store/app-store-listing/APP_STORE_LISTING.md", "state/PROJECT_STATE.yaml"],
    roleId: "role.engineering-leader",
    laneIds: ["store_console"],
    phaseIds: ["phase.3"],
    dependencies: ["workflow.store.app-store-listing-prep-packet"],
    outputPaths: ["store/GOOGLE_PLAY_RELEASE.md"],
    providers: ["provider.google-play"],
    founderOnlyActions: ["approve Play Console release"],
    actionClass: "release",
    protectedCategory: "release",
    idempotent: false,
  }),
  workflow({
    id: "workflow.store.google-play-metadata-standing-envelope",
    title: "Google Play metadata standing envelope",
    domainId: "domain.store",
    areaIds: ["area.build-release"],
    trigger: "Google Play listing metadata is ready and a matching metadata standing envelope is current",
    instructions:
      "Apply only the approved Google Play listing text, localized metadata, custom store listings, and promotional content covered by the exact current standing envelope. Verify account, package, track-neutral resource IDs, locales, payload digest, and capability immediately before mutation. Capture before-state and read back every locale. Write store/proof/google-play-metadata-apply.json with approval ID, request digest, before state, provider operation IDs, readback state, and timestamps. Do not upload media, change products, submit a release, or widen the envelope.",
    reads: ["store/STORE_CONSOLE.md", "store/app-store-listing/APP_STORE_LISTING.md", "state/PROJECT_STATE.yaml"],
    roleId: "role.marketing-guru",
    laneIds: ["store_console"],
    phaseIds: ["phase.3"],
    dependencies: ["workflow.store.store-console-workflow"],
    gates: ["check:store-console", "check:provider-proof"],
    outputPaths: ["store/proof/google-play-metadata-apply.json"],
    providers: ["provider.google-play"],
    founderOnlyActions: ["approve Google Play metadata when no exact standing envelope exists"],
    actionClass: "mutate",
    protectedCategory: "credentials_access",
    idempotent: false,
  }),
  workflow({
    id: "workflow.store.google-play-media-standing-envelope",
    title: "Google Play media standing envelope",
    domainId: "domain.store",
    areaIds: ["area.build-release"],
    trigger: "Google Play screenshots, feature graphics, or promo video are ready and a matching media standing envelope is current",
    instructions:
      "Upload only the locale, device-family, custom-store-listing, screenshot, feature-graphic, and promo-video assets covered by the exact current standing envelope. Verify every file digest and Play resource ID immediately before upload. Capture before-state and read back the resulting media set. Write store/proof/google-play-media-apply.json with approval ID, per-file digest, locale, device family, product-page/listing ID, provider operation IDs, readback state, and timestamps. Do not apply text metadata, products, testing tracks, or release state.",
    reads: ["store/STORE_CONSOLE.md", "store/app-store-listing/SCREENSHOTS.md", "state/PROJECT_STATE.yaml"],
    roleId: "role.marketing-guru",
    laneIds: ["store_console", "content_assets"],
    phaseIds: ["phase.3"],
    dependencies: ["workflow.store.store-screenshots-production", "workflow.store.store-console-workflow"],
    gates: ["check:store-screenshots"],
    outputPaths: ["store/proof/google-play-media-apply.json"],
    providers: ["provider.google-play"],
    founderOnlyActions: ["approve Google Play media upload when no exact standing envelope exists"],
    actionClass: "mutate",
    protectedCategory: "credentials_access",
    idempotent: false,
  }),
  workflow({
    id: "workflow.store.google-play-testing-track-standing-envelope",
    title: "Google Play testing-track standing envelope",
    domainId: "domain.store",
    areaIds: ["area.build-release"],
    trigger: "An AAB is proven and an exact internal or closed-testing track standing envelope is current",
    instructions:
      "Upload the exact AAB digest and assign it only to the named internal or closed-testing track covered by the current standing envelope. Verify package, signing, version code, tester cohort, country scope, rollout state, and release notes immediately before upload. Read back processing and tester availability. Write store/proof/google-play-testing-track-apply.json with approval ID, AAB digest, version code, track, provider operation ID, processing/readback state, tester cohort, and timestamps. Production submission and public rollout remain separate founder decisions.",
    reads: ["store/GOOGLE_PLAY_RELEASE.md", "engineering/PRODUCTION_READINESS.md", "state/PROJECT_STATE.yaml"],
    roleId: "role.engineering-leader",
    laneIds: ["store_console", "engineering"],
    phaseIds: ["phase.5b"],
    dependencies: ["workflow.store.google-play-release", "workflow.engineering.engineering-orchestration-ce-production-readiness"],
    gates: ["check:provider-proof"],
    outputPaths: ["store/proof/google-play-testing-track-apply.json"],
    providers: ["provider.google-play"],
    founderOnlyActions: ["approve testing-track upload when no exact standing envelope exists"],
    actionClass: "release",
    protectedCategory: "release",
    idempotent: false,
  }),
  workflow({
    id: "workflow.engineering.source-change-manifest",
    title: "App source change ingestion",
    domainId: "domain.engineering",
    areaIds: ["area.build-release"],
    trigger: "When design is accepted and after every accepted app-source, build-config, localization, onboarding, feature, paywall, SDK, or visual change",
    instructions:
      "Fingerprint the mobile source roots, dependency locks, build configuration, localization resources, analytics schema, onboarding, paywall, and privacy manifests. Compare them with the last accepted checkpoint. Write engineering/SOURCE_CHANGE_MANIFEST.json with changed paths, before/after digests, and every applicable Change Cascade Map type. A change can carry multiple types. Open the matching change-cascade work before the app slice merges. An empty change list is valid only when the current aggregate digest matches the accepted checkpoint.",
    reads: ["run/app-source-fingerprint.sha256", "design/design.md", "engineering/TECH_SPEC.md", "state/PROJECT_STATE.yaml"],
    roleId: "role.mobile-engineer",
    laneIds: ["engineering", "orchestration"],
    phaseIds: ["phase.3"],
    dependencies: ["workflow.design.design-room-state-mutate-version-render"],
    outputPaths: ["engineering/SOURCE_CHANGE_MANIFEST.json"],
    gates: ["check:change-cascade"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.engineering.engineering-orchestration-ce-production-readiness",
    title: "Engineering orchestration (CE + production readiness)",
    domainId: "domain.engineering",
    areaIds: ["area.build-release"],
    trigger: "Before actual app implementation, builder prompts, or production-readiness claims",
    instructions:
      "Route non-trivial implementation through the Compound Engineering loop. Use the five-stage Standalone Engineering Loop when CE is unavailable. Record the route in engineering/ENGINEERING_PLAN.md. When design/design.md is accepted, start app implementation and the local landing build in the same ready batch. Also dispatch the prepared launch-surface prompt for store copy, product-page plans, screenshot plans, marketing assets, and price-copy checks. Give each agent a disjoint write scope. Before each app slice merges, start a read-only launch-surface impact audit. Apply affected public-surface updates in parallel with the next app slice. Record file ownership and serialized resources in operations/ORCHESTRATION.md. Require build, typecheck, lint, integration tests, mobile end-to-end proof, provider proof, and an on-device taste pass. Write the results to engineering/PRODUCTION_READINESS.md. Run check:compound-engineering and check:orchestration before the engineering lane is done.",
    reads: ["engineering/TECH_SPEC.md", "state/LAUNCH_TRACE.md", "design/design.md", "state/PROJECT_STATE.yaml"],
    roleId: "role.engineering-leader",
    laneIds: ["engineering", "orchestration"],
    phaseIds: ["phase.5b"],
    dependencies: [
      "workflow.process.launch-trace-and-build-contracts",
      "workflow.design.design-room-state-mutate-version-render",
      "workflow.operations.agent-operations-ledger",
      "workflow.engineering.source-change-manifest",
    ],
    outputPaths: ["engineering/ENGINEERING_PLAN.md", "operations/ORCHESTRATION.md", "engineering/PRODUCTION_READINESS.md"],
    gates: ["check:compound-engineering", "check:orchestration"],
    actionClass: "mutate",
    idempotent: true,
  }),
  workflow({
    id: "workflow.engineering.backend-data-contract",
    title: "Backend data contract",
    domainId: "domain.engineering",
    areaIds: ["area.build-release"],
    trigger: "Before schema/auth prompts or engineering/TECH_SPEC.md data/API sections harden",
    instructions:
      "Pick one backend route (Supabase, Firebase, or custom), record the reason in engineering/TECH_SPEC.md's Backend Selection sub-section, and never silently substitute another route mid-build — a switch is a change-cascade event and a founder-only gate. Write the Data Model as one row per entity (owner, key fields, relationships, retention/deletion path, PII class) and the Authorization Model as a create/read/update/delete matrix expressed in the route's actual enforcement mechanism — RLS policies, Firestore security rules, or middleware authz — deny by default. Treat untested authorization as absent: exercise owner/anonymous/other-user access for every matrix row and record the exact test command and evidence path, not just 'RLS' in prose. Pass `npm run check:backend-contract -- --root . --state state/PROJECT_STATE.yaml`; the account-deletion promise in this contract's retention rules must match trust/PRIVACY.md's deletion promise exactly, not just approximately.",
    reads: ["engineering/TECH_SPEC.md", "state/PROJECT_STATE.yaml"],
    // DESIGN.md and PRIVACY.md land after this node's phase-1f architecture firing — consults,
    // so the early data contract is not held on later lanes; the deletion-promise exact-match is
    // re-enforced by change-cascade once trust/PRIVACY.md exists.
    consults: ["design/design.md", "trust/PRIVACY.md"],
    roleId: "role.backend-infrastructure-engineer",
    laneIds: ["engineering"],
    phaseIds: ["phase.1f", "phase.5b"],
    // lane.engineering's dependencyIds (catalog/lanes.ts) name both lane.design and
    // lane.traceability; this workflow previously enforced only traceability, so it could
    // dispatch before Design Room output existed (routing-depth audit, 2026-08-07).
    dependencies: ["workflow.process.launch-trace-and-build-contracts", "workflow.design.design-room-state-mutate-version-render"],
    // outputPaths intentionally empty: hardens engineering/TECH_SPEC.md's data/API
    // sections; workflow.process.launch-trace-and-build-contracts already owns the file
    // (see this file's header).
    gates: ["check:backend-contract"],
    actionClass: "draft",
    idempotent: true,
  }),
  workflow({
    id: "workflow.engineering.app-agent-roster-and-repo-entrypoints",
    title: "App agent roster & repo entrypoints",
    domainId: "domain.engineering",
    areaIds: ["area.build-release"],
    trigger: "Before builder handoff bundles, AGENTS.md/CLAUDE.md, APP_AGENTS.md, agents/",
    instructions:
      "Fill AGENTS.md, CLAUDE.md, APP_AGENTS.md, and the complete agents/ roster from the current business documents. Include agents/launch-surface-producer.md. AGENTS.md must tell future agents to keep using the Formation skill's workflow. It must require state updates, cockpit renders, validators, and the design-lock fan-out. Assign each role its audit surface. Specialists can edit only an assigned disjoint scope. They never stage, commit, release, spend, submit, or publish. A fresh agent must be able to resume from AGENTS.md and the roster without chat history.",
    reads: ["engineering/ENGINEERING_PLAN.md", "operations/ORCHESTRATION.md", "engineering/PRODUCTION_READINESS.md", "state/PROJECT_STATE.yaml"],
    roleId: "role.orchestrator",
    laneIds: ["engineering"],
    phaseIds: ["phase.5"],
    dependencies: ["workflow.engineering.engineering-orchestration-ce-production-readiness"],
    outputPaths: ["AGENTS.md", "CLAUDE.md", "APP_AGENTS.md"],
    actionClass: "mutate",
    idempotent: true,
  }),
  workflow({
    id: "workflow.engineering.mobai-device-automation-and-demo-videos",
    title: "MobAI device automation & demo videos",
    domainId: "domain.engineering",
    areaIds: ["area.build-release"],
    trigger:
      "Before MobAI-delta device work — Android coverage, repeatable .mob suites, multi-device or physical-hardware runs, performance gates, MobAI CI, or recorder-skill demo videos/app previews — after the Route Ladder (native-ios-proof-route-ladder) routes past the in-app simulator",
    instructions:
      "First confirm the lane needs a MobAI delta: Android, a repeatable .mob suite, multi-device or physical hardware, performance gates, MobAI CI, or recorder-polished demo output. A run-the-app, screen-check, flow-walk, or one-off bug-repro request on a local Mac belongs at rung 0 of the Route Ladder (workflow.engineering.native-ios-proof-route-ladder) — starting MobAI there wastes founder time exactly the way silently downgrading coverage loses proof, so record the rung decision in strategy/TOOL_DECISIONS.md. Run the MobAI session-startup checklist (refresh the live MCP surface, verify device discovery, start the bridge, pin the device ID) before any automation command — most 'device not found' failures come from skipping it. Use MobAI's free tier without a spend gate for one device/current quota; load paid-tool-routing.md and ask the founder before any Plus/Pro spend or before narrowing an intended cross-platform route to Apple-only. For demo videos, follow the recorder's explore -> script -> dry-run -> record -> edit/export sequence exactly — never improvise during final recording — and write the choreography path, raw capture, final export, and privacy/sensitive-screen review to growth/DEMO_VIDEO.md. Pass `npm run check:mobai-proof -- --root .`; pair every action sequence with backend/provider verification (the onboarding answer actually lands in profile state) because a clean UI pass is not proof the mutation landed.",
    reads: ["engineering/ENGINEERING_PLAN.md", "engineering/PRODUCTION_READINESS.md", "state/PROJECT_STATE.yaml"],
    roleId: "role.accessibility-device-qa",
    laneIds: ["engineering", "content_assets"],
    phaseIds: ["phase.5b"],
    dependencies: ["workflow.engineering.engineering-orchestration-ce-production-readiness"],
    outputPaths: ["growth/DEMO_VIDEO.md"],
    gates: ["check:mobai-proof"],
    providers: ["provider.mobai"],
    actionClass: "mutate",
    idempotent: false,
  }),
  workflow({
    id: "workflow.engineering.native-ios-proof-route-ladder",
    title: "Native iOS proof (Route Ladder)",
    domainId: "domain.engineering",
    areaIds: ["area.build-release"],
    trigger:
      "First for any device automation, run-the-app, screen-check, flow-walk, bug-repro, screenshot, or screen-recording request — pick the rung before picking a tool (in-app iOS Simulator, XcodeBuildMCP, serve-sim, SnapshotPreviews, or MobAI)",
    instructions:
      "Start at rung 0 (the in-app iOS Simulator — Claude Code Desktop's pane, or Codex's build-ios-apps plugin) for any 'run the app / check this screen / walk this flow' request; it needs no install and no account, and escalating straight to XcodeBuildMCP or MobAI for a single screen check wastes founder time. Escalate only for what rung 0 cannot cover: physical devices or CI need XcodeBuildMCP (rung 2), deterministic preview PNG/JSON needs SnapshotPreviews, a browser-visible stream for a remote/CLI session needs serve-sim — record the rung chosen and why in strategy/TOOL_DECISIONS.md. Use fixture or sandbox accounts only on any device the agent drives, since device screenshots leave the machine and are retained under normal conversation policy; never sign a real founder/customer/store account into an agent-driven simulator. Attach the exact simulator/device, OS, tool route, and screenshot/log paths as evidence in engineering/PRODUCTION_READINESS.md and pass `npm run check:native-ios -- --root .`; a cloud/SSH session cannot reach a local Mac's simulators at all, so record that as a named blocker rather than narrating a run that did not happen.",
    reads: ["engineering/PRODUCTION_READINESS.md", "engineering/ENGINEERING_PLAN.md", "state/PROJECT_STATE.yaml"],
    roleId: "role.accessibility-device-qa",
    laneIds: ["engineering"],
    phaseIds: ["phase.5b"],
    dependencies: ["workflow.engineering.engineering-orchestration-ce-production-readiness"],
    // outputPaths intentionally empty: attaches device-proof evidence to
    // engineering/PRODUCTION_READINESS.md, which the CE/production-readiness workflow
    // above already owns as its output (see file header).
    gates: ["check:native-ios"],
    providers: ["provider.in-app-ios-simulator", "provider.codex-native-ios", "provider.snapshot-previews", "provider.serve-sim"],
    actionClass: "mutate",
    idempotent: false,
  }),
  workflow({
    id: "workflow.engineering.accessibility-common-task-proof",
    title: "Accessibility common-task proof",
    domainId: "domain.engineering",
    areaIds: ["area.build-release"],
    trigger: "Before beta or store submission on every mobile launch",
    instructions:
      "Define the common tasks that a customer must complete. Test each task with platform assistive technology, large text, reduced motion, sufficient contrast, and keyboard or switch access where the platform supports it. Record the device, operating system, build, result, defect, owner, and evidence. Reconcile the proof with the App Store accessibility declarations. Write engineering/ACCESSIBILITY_READINESS.md. Do not claim readiness from static lint results alone.",
    reads: ["engineering/PRODUCTION_READINESS.md", "design/design.md"],
    roleId: "role.accessibility-device-qa",
    laneIds: ["engineering"],
    phaseIds: ["phase.5b"],
    dependencies: ["workflow.engineering.engineering-orchestration-ce-production-readiness"],
    outputPaths: ["engineering/ACCESSIBILITY_READINESS.md"],
    providers: ["provider.in-app-ios-simulator", "provider.mobai"],
    actionClass: "mutate",
    idempotent: true,
  }),
  workflow({
    id: "workflow.engineering.app-quality-and-vitals",
    title: "App quality and vitals",
    domainId: "domain.engineering",
    areaIds: ["area.build-release"],
    trigger: "Before beta or store submission on every mobile launch",
    instructions:
      "Measure crash-free operation, application-not-responding events, startup time, battery use, app size, offline behavior, and adaptive-layout behavior on supported devices. Define release thresholds and owners. Record observed values and evidence in engineering/APP_QUALITY.md. Mark missing device or production evidence as a blocker. Do not replace measured results with general guidance.",
    reads: ["engineering/PRODUCTION_READINESS.md", "engineering/TECH_SPEC.md"],
    roleId: "role.engineering-leader",
    laneIds: ["engineering"],
    phaseIds: ["phase.5b"],
    dependencies: ["workflow.engineering.engineering-orchestration-ce-production-readiness"],
    outputPaths: ["engineering/APP_QUALITY.md"],
    providers: ["provider.sentry"],
    actionClass: "mutate",
    idempotent: true,
  }),
  workflow({
    id: "workflow.store.marketplace-regional-compliance",
    title: "Marketplace and regional compliance",
    domainId: "domain.store",
    areaIds: ["area.build-release"],
    trigger: "Before store distribution in every selected region",
    instructions:
      "List each store and distribution region. Confirm seller or trader status, identity verification, banking, tax, payout, age rating, content declarations, and local contact requirements. Record the responsible owner and evidence in store/MARKETPLACE_COMPLIANCE.md. Separate global requirements from region-specific requirements. Treat an incomplete declaration or verification as a release blocker.",
    reads: ["store/app-store-listing/APP_STORE_LISTING.md", "operations/business-access.json"],
    roleId: "role.engineering-leader",
    laneIds: ["store_console", "privacy_legal"],
    phaseIds: ["phase.3", "phase.5c"],
    dependencies: ["workflow.store.app-store-listing-prep-packet", "workflow.operations.agent-operations-ledger"],
    outputPaths: ["store/MARKETPLACE_COMPLIANCE.md"],
    providers: ["provider.app-store-connect", "provider.google-play"],
    founderOnlyActions: ["confirm seller identity, trader status, banking, tax, and payout details"],
    actionClass: "mutate",
    protectedCategory: "legal_pricing",
    idempotent: true,
  }),
] as const;
