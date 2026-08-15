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
    referenceIds: [
      "reference.store.aso-store-ops",
      "reference.growth.paid-user-acquisition",
      "reference.research.localization-market-research",
      "reference.words.no-slop-writing",
      "reference.process.tool-recipes.growth-and-store-routing",
    ],
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
    referenceIds: [
      "reference.store.app-store-listing-prep",
      "reference.money.revenue-monetization",
      "reference.experience.eleven-star-experience",
      "reference.words.no-slop-writing",
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
      "Classify the Apple account state (membership, Team ID, role, agreements signed) before any TestFlight/App Store distribution claim, and treat a simulator build as engineering proof only, never distribution readiness. Run the five-item pre-archive/export/upload preflight checklist — SDK keys actually injected into the archived Info.plist, `plutil -lint` on PrivacyInfo.xcprivacy, NSPrivacyAccessedAPITypes coverage, API-key (not interactive-session) export auth, and native screenshot dimension floors — and record pass/BLOCKED for each in store/APPLE_SIGNING.md before archiving. Do not begin `xcodebuild archive` until every item is pass or ready; a blocked item stays open, it does not get re-archived on hope. Founder approval is required before enrolling, creating/rotating certificates, uploading a build, or submitting for review — this node prepares that approval, it does not grant itself autonomy to submit.",
    reads: ["store/app-store-listing/APP_STORE_LISTING.md", "state/PROJECT_STATE.yaml"],
    referenceIds: ["reference.store.apple-signing-release", "reference.store.app-store-connect-cli", "reference.operations.secrets-management"],
    roleId: "role.engineering-leader",
    laneIds: ["apple_signing"],
    phaseIds: ["phase.3"],
    dependencies: ["workflow.store.app-store-listing-prep-packet"],
    outputPaths: ["store/APPLE_SIGNING.md"],
    providers: ["provider.app-store-connect"],
    founderOnlyActions: ["approve signing and submission"],
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
    referenceIds: ["reference.store.app-store-listing-prep", "reference.trust.privacy-terms", "reference.store.store-console-workflow"],
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
    referenceIds: [
      "reference.store.store-console-workflow",
      "reference.store.apple-signing-release",
      "reference.store.google-play-release",
      "reference.store.app-store-connect-cli",
    ],
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
      "Default to the `asc` CLI/skill-pack route for App Store Connect work — reads, ID resolution, metadata/screenshot dry-runs, and TestFlight/review-status checks are safe without new approval; do not tell the founder an agent cannot create the app or manage state until `asc auth status`, `asc auth doctor`, and the refreshed skill-pack docs actually prove a blocker. Work the auth ladder before reporting ASC as blocked: check an existing keychain profile first (`asc --profile <Name>`), never `source` a credential `.env` file, and treat 'app record not found' as a setup step, not inaccessibility. Confirm `--help` before any subcommand not already verified here, and never run a mutating command (`--confirm`, metadata apply, screenshot upload, submit/release) without both the CLI flag and explicit founder approval. Pass `npm run check:asc-command-contract -- --root .` and update state/PROJECT_STATE.yaml plus store/STORE_CONSOLE.md after every action that changes build, metadata, or TestFlight state.",
    reads: ["store/STORE_CONSOLE.md", "store/store-console.html", "state/PROJECT_STATE.yaml"],
    referenceIds: ["reference.store.app-store-connect-cli", "reference.store.store-console-workflow", "reference.operations.secrets-management"],
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
      "Capture raw app UI first — in-app iOS Simulator (rung 0) for a local Mac, MobAI for Android or a repeatable matrix — and treat those raw captures as proof inputs, never final store creative. Compose final assets from the Asset Knowledge Brief (strategy/RESEARCH.md's user/problem, 11_STAR_EXPERIENCE.md's magical moment, the emotion/card from EMOTIONAL_DESIGN.md, design/design.md's tokens) with headline, copy overlay, device frame, and export every required iPhone/iPad/Play well — never a generic, knowledge-free hook. Run every composed frame through quality-lens.md's Anti-Generic Checks before calling the deck done, and write the raw-path/composition-path/upload-status table to SCREENSHOTS.md. Pass `npm run check:store-screenshots -- --root .`; a technically correct, on-brand screenshot that still reads as generic fails the done bar.",
    reads: [
      "design/design.md",
      "store/app-store-listing/APP_STORE_LISTING.md",
      "product/experience/11-star-experience/11_STAR_EXPERIENCE.md",
      "strategy/RESEARCH.md",
      "product/experience/emotional-design/EMOTIONAL_DESIGN.md",
      "state/PROJECT_STATE.yaml",
    ],
    referenceIds: [
      "reference.store.aso-store-ops",
      "reference.design.design-visual-system",
      "reference.design.quality-lens",
      "reference.process.tool-recipes.device-capture-and-proof",
      "reference.engineering.mobai-toolbelt",
    ],
    roleId: "role.design-guru",
    laneIds: ["store_console", "content_assets"],
    phaseIds: ["phase.3"],
    dependencies: ["workflow.design.design-room-state-mutate-version-render", "workflow.store.app-store-listing-prep-packet"],
    outputPaths: ["store/app-store-listing/SCREENSHOTS.md"],
    gates: ["check:store-screenshots"],
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
    referenceIds: [
      "reference.store.google-play-release",
      "reference.store.store-console-workflow",
      "reference.trust.privacy-terms",
      "reference.money.revenue-monetization",
    ],
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
    id: "workflow.engineering.engineering-orchestration-ce-production-readiness",
    title: "Engineering orchestration (CE + production readiness)",
    domainId: "domain.engineering",
    areaIds: ["area.build-release"],
    trigger: "Before actual app implementation, builder prompts, or production-readiness claims",
    instructions:
      "Route non-trivial implementation through the Compound Engineering loop (ce-brainstorm when product shape is still ambiguous, ce-plan, ce-work, ce-code-review, ce-test, ce-proof); when CE is unavailable, run the five-stage Standalone Engineering Loop instead — plan, bounded slices, adversarial review by someone other than the producer, test, proof — recorded in engineering/ENGINEERING_PLAN.md, never a silent downgrade. Before implementation starts, set the autonomy mode in state/PROJECT_STATE.yaml (scout/draft/prepare/apply/mutate/ship) and decide the parallel-vs-serial split for candidate units, recording collisions and serialized resources in operations/ORCHESTRATION.md. Do not mark production readiness from unit tests alone: require build/typecheck/lint, integration tests against real providers, mobile E2E paired with backend/provider verification, and an on-device taste pass against premium-mobile-craft.md/quality-lens.md, all written to engineering/PRODUCTION_READINESS.md. Pass `npm run check:compound-engineering -- --root .` and `npm run check:orchestration -- --root .` before calling the engineering lane done.",
    reads: ["engineering/TECH_SPEC.md", "state/LAUNCH_TRACE.md", "design/design.md", "state/PROJECT_STATE.yaml"],
    referenceIds: [
      "reference.engineering.engineering-orchestration",
      "reference.orchestration.compound-engineering-routing",
      "reference.orchestration.parallel-agent-orchestration",
      "reference.orchestration.project-state",
      "reference.experience.eleven-star-experience",
      "reference.design.premium-mobile-craft",
      "reference.design.quality-lens",
      "reference.process.tool-recipes.engineering-and-agent-orchestration",
    ],
    roleId: "role.engineering-leader",
    laneIds: ["engineering", "orchestration"],
    phaseIds: ["phase.5b"],
    dependencies: ["workflow.process.launch-trace-and-build-contracts", "workflow.design.design-room-state-mutate-version-render"],
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
    referenceIds: [
      "reference.engineering.backend-data-contract",
      "reference.process.flow-traceability",
      "reference.trust.privacy-terms",
      "reference.operations.secrets-management",
    ],
    roleId: "role.engineering-leader",
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
      "Fill AGENTS.md, CLAUDE.md, APP_AGENTS.md, and the seven-file agents/ roster (orchestrator, product-leader, design-guru, engineering-leader, marketing-guru, security-architect, customer-success) from the current business's own source-of-truth docs, not from this skill repo's maintainer files. AGENTS.md must explicitly tell future agents to keep using the b2c-mobile-business-launch workflow, update state/PROJECT_STATE.yaml, rerender state/launch-cockpit.html, and run validators until a founder-only gate — a builder handoff that relies on a prompt alone loses this instruction on the next session. Assign each role its subagent-audit surface (the review-lane table in app-agent-roster.md) so future launches can dispatch independent review instead of self-attesting completeness, and make explicit that specialists propose, never stage/commit/release/spend/submit without an orchestrator-assigned scope. The proof that matters most: a fresh agent reading only AGENTS.md and this roster can resume the launch without reconstructing decisions from chat memory.",
    reads: ["engineering/ENGINEERING_PLAN.md", "operations/ORCHESTRATION.md", "engineering/PRODUCTION_READINESS.md", "state/PROJECT_STATE.yaml"],
    referenceIds: ["reference.engineering.app-agent-roster", "reference.orchestration.parallel-agent-orchestration", "reference.process.artifact-contracts"],
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
    trigger: "Before device automation, app-flow demo videos, app previews, bug-repro recordings",
    instructions:
      "Run the MobAI session-startup checklist (refresh the live MCP surface, verify device discovery, start the bridge, pin the device ID) before any automation command — most 'device not found' failures come from skipping it. Use MobAI's free tier without a spend gate for one device/current quota; load paid-tool-routing.md and ask the founder before any Plus/Pro spend or before narrowing an intended cross-platform route to Apple-only. For demo videos, follow the recorder's explore -> script -> dry-run -> record -> edit/export sequence exactly — never improvise during final recording — and write the choreography path, raw capture, final export, and privacy/sensitive-screen review to growth/DEMO_VIDEO.md. Pass `npm run check:mobai-proof -- --root .`; pair every action sequence with backend/provider verification (the onboarding answer actually lands in profile state) because a clean UI pass is not proof the mutation landed.",
    reads: ["engineering/ENGINEERING_PLAN.md", "engineering/PRODUCTION_READINESS.md", "state/PROJECT_STATE.yaml"],
    referenceIds: ["reference.engineering.mobai-toolbelt", "reference.process.tool-recipes.device-capture-and-proof", "reference.operations.paid-tool-routing"],
    roleId: "role.engineering-leader",
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
    trigger: "Before in-app iOS Simulator / Codex Desktop native iOS / XcodeBuildMCP / serve-sim / SnapshotPreviews proof",
    instructions:
      "Start at rung 0 (the in-app iOS Simulator — Claude Code Desktop's pane, or Codex's build-ios-apps plugin) for any 'run the app / check this screen / walk this flow' request; it needs no install and no account, and escalating straight to XcodeBuildMCP or MobAI for a single screen check wastes founder time. Escalate only for what rung 0 cannot cover: physical devices or CI need XcodeBuildMCP (rung 2), deterministic preview PNG/JSON needs SnapshotPreviews, a browser-visible stream for a remote/CLI session needs serve-sim — record the rung chosen and why in strategy/TOOL_DECISIONS.md. Use fixture or sandbox accounts only on any device the agent drives, since device screenshots leave the machine and are retained under normal conversation policy; never sign a real founder/customer/store account into an agent-driven simulator. Attach the exact simulator/device, OS, tool route, and screenshot/log paths as evidence in engineering/PRODUCTION_READINESS.md and pass `npm run check:native-ios -- --root .`; a cloud/SSH session cannot reach a local Mac's simulators at all, so record that as a named blocker rather than narrating a run that did not happen.",
    reads: ["engineering/PRODUCTION_READINESS.md", "engineering/ENGINEERING_PLAN.md", "state/PROJECT_STATE.yaml"],
    referenceIds: [
      "reference.engineering.xcodebuildmcp-testing",
      "reference.process.tool-recipes.device-capture-and-proof",
      "reference.store.apple-signing-release",
    ],
    roleId: "role.engineering-leader",
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
] as const;
