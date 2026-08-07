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
    laneIds: ["store_console"],
    phaseIds: ["phase.3"],
    dependencies: ["workflow.store.aso-and-store-ops"],
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
