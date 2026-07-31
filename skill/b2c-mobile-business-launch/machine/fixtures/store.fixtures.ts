import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  type Harness,
  type MutableRecord,
  expectRecord,
  getLane,
  getTools,
  readState,
  skillRoot,
  writeBusinessEntrypoints,
  writeCompleteAppleRequirements,
  writeCompleteAppleSigning,
  writeCompleteAttribution,
  writeCompleteCompoundEngineering,
  writeCompleteContentAssets,
  writeCompleteElevenStar,
  writeCompleteOrchestration,
  writeCompletePaidToolDecisions,
  writeCompletePaidUserAcquisition,
  writeCompleteProviderProof,
  writeCompleteSecurity,
  writeCompleteStoreConsole,
  writeCompleteStoreScreenshots,
  writeCompleteViralGrowth,
  writeSourceRegistryFixture,
  writeState,
} from "./_harness.js";

export function register(h: Harness): void {
  const { makeFixture, makeEmptyFixture, runFixture, runScriptArgs, results } = h;

  const simulatorOnly = makeFixture("simulator-only");
  writeFileSync(
    path.join(simulatorOnly, "APPLE_SIGNING.md"),
    [
      "# Apple Signing",
      "Apple Developer Team ID DEVELOPMENT_TEAM Bundle ID App ID App Store Connect ASC CLI auth status app creation route App Record Creation Preflight certificate provisioning archive export upload TestFlight founder approval.",
      "Simulator build passed.",
    ].join("\n"),
    "utf8",
  );
  runFixture("simulator-only Apple signing claim fails", simulatorOnly, "check-apple-signing-packet.ts", 1, "simulator_only_risk");

  // The in-app route makes people describe success in prose rather than as a
  // "simulator build passed" line; the guard has to catch that phrasing too.
  const paneRunOnly = makeFixture("apple-signing-pane-run-only");
  writeFileSync(
    path.join(paneRunOnly, "APPLE_SIGNING.md"),
    [
      "# Apple Signing",
      "Apple Developer Team ID DEVELOPMENT_TEAM Bundle ID App ID App Store Connect ASC CLI auth status app creation route App Record Creation Preflight certificate provisioning archive export upload TestFlight founder approval.",
      "Claude ran the app in the iOS Simulator pane and onboarding works, so the app is good to ship.",
    ].join("\n"),
    "utf8",
  );
  runFixture("in-app simulator run treated as Apple signing proof fails", paneRunOnly, "check-apple-signing-packet.ts", 1, "simulator_only_risk");

  const nativeIosProofThin = makeFixture("native-ios-proof-thin");
  writeFileSync(
    path.join(nativeIosProofThin, "PRODUCTION_READINESS.md"),
    [
      "# Production Readiness",
      "Status: ready.",
      "Native iOS Proof: Codex Desktop build passed. SnapshotPreviews passed. serve-sim worked.",
      "Implementation proof: ce-work completed.",
      "Review proof: ce-code-review passed.",
      "Proof artifact: ce-proof exists.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "thin native iOS proof fails without Codex Desktop session defaults",
    nativeIosProofThin,
    "check-native-ios-proof.ts",
    1,
    "native_ios_proof.codex_desktop_session_defaults_missing",
  );

  // The in-app simulator is the route an agent reaches for by default, so the
  // easy path must still carry its gates: local session, named device, fixture
  // account (device screenshots leave the machine), and the coverage it drops.
  const inAppSimulatorUngated = makeFixture("native-ios-in-app-simulator-ungated");
  writeFileSync(
    path.join(inAppSimulatorUngated, "PRODUCTION_READINESS.md"),
    [
      "# Production Readiness",
      "Status: ready.",
      "Native iOS Proof: ran the app in the iOS Simulator pane and tapped through onboarding.",
      "Launch-Critical Test Matrix covers the prerelease .xctestplan with unit, integration, UI, and performance targets across device, OS, locale, Dynamic Type, light and dark.",
      "Coverage includes permission denied, offline retry, background, foreground, deep link, notification, and interruption paths, an accessibility audit, and StoreKit entitlement, restore, and refund states.",
      "Release configuration on a physical device is deferred.",
      "Screenshots at screenshots/raw/home.png. Paired with PROVIDER_PROOF.md. A simulator build alone is not distribution readiness; see APPLE_SIGNING.md.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "in-app simulator proof without the fixture-account rule fails",
    inAppSimulatorUngated,
    "check-native-ios-proof.ts",
    1,
    "native_ios_proof.in_app_simulator_fixture_account_missing",
  );
  runFixture(
    "in-app simulator proof without the local-session record fails",
    inAppSimulatorUngated,
    "check-native-ios-proof.ts",
    1,
    "native_ios_proof.in_app_simulator_session_missing",
  );
  runFixture(
    "in-app simulator proof without its dropped-coverage statement fails",
    inAppSimulatorUngated,
    "check-native-ios-proof.ts",
    1,
    "native_ios_proof.in_app_simulator_coverage_limit_missing",
  );
  runFixture(
    "in-app simulator proof without a named simulated device fails",
    inAppSimulatorUngated,
    "check-native-ios-proof.ts",
    1,
    "native_ios_proof.in_app_simulator_device_missing",
  );

  // The template is the other witness for the happy path; this one proves a
  // hand-written in-app row passes on its own, so tightening scopedLines later
  // cannot silently start rejecting real-world readiness docs.
  const inAppSimulatorGated = makeFixture("native-ios-in-app-simulator-gated");
  writeFileSync(
    path.join(inAppSimulatorGated, "PRODUCTION_READINESS.md"),
    [
      "# Production Readiness",
      "Status: ready.",
      "Native iOS Proof: ran the app in the iOS Simulator pane in a local session on iPhone 17 Pro / iOS 26 with a fixture account, never a real founder or provider login.",
      "That route covers no Android and no physical device, so cross-platform and release-device proof stay open.",
      "Launch-Critical Test Matrix covers the prerelease .xctestplan with unit, integration, UI, and performance targets across device, OS, locale, Dynamic Type, light and dark.",
      "Coverage includes permission denied, offline retry, background, foreground, deep link, notification, and interruption paths, an accessibility audit, and StoreKit entitlement, restore, and refund states.",
      "Release configuration on a physical device is deferred.",
      "Screenshots at screenshots/raw/home.png. Paired with PROVIDER_PROOF.md. A simulator build alone is not distribution readiness; see APPLE_SIGNING.md.",
    ].join("\n"),
    "utf8",
  );
  runFixture("fully gated in-app simulator proof passes", inAppSimulatorGated, "check-native-ios-proof.ts", 0);

  const inAppSimulatorScreenshots = makeFixture("native-ios-in-app-simulator-screenshots");
  writeFileSync(
    path.join(inAppSimulatorScreenshots, "SCREENSHOTS.md"),
    [
      "# Store Screenshots",
      "Status: ready.",
      "Raw Capture Matrix: captured from the in-app simulator pane on iPhone 17 Pro / iOS 26 in a local session with a fixture account, exported to screenshots/raw/home.png.",
      "Production Composition Matrix: final upload path screenshots/final/iphone.png.",
    ].join("\n"),
    "utf8",
  );
  runFixture("in-app simulator captures satisfy the raw screenshot capture route", inAppSimulatorScreenshots, "check-native-ios-proof.ts", 0);

  const inAppSimulatorRealAccountScreenshots = makeFixture("native-ios-in-app-simulator-real-account-screenshots");
  writeFileSync(
    path.join(inAppSimulatorRealAccountScreenshots, "SCREENSHOTS.md"),
    [
      "# Store Screenshots",
      "Status: ready.",
      "Raw Capture Matrix: captured from the in-app simulator pane on iPhone 17 Pro / iOS 26, signed in as the founder so the flow looks real, exported to screenshots/raw/home.png.",
      "Production Composition Matrix: final upload path screenshots/final/iphone.png.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "in-app simulator captures without the fixture-account rule fail",
    inAppSimulatorRealAccountScreenshots,
    "check-native-ios-proof.ts",
    1,
    "native_ios_proof.screenshot_in_app_simulator_fixture_account_missing",
  );

  const nativeIosUngrounded = makeFixture("native-ios-proof-ungrounded");
  const nativeIosUngroundedState = readState(nativeIosUngrounded);
  getLane(nativeIosUngroundedState, "engineering")["status"] = "done";
  writeState(nativeIosUngrounded, nativeIosUngroundedState);
  runFixture(
    "done native iOS proof without an existing evidence artifact fails",
    nativeIosUngrounded,
    "check-native-ios-proof.ts",
    1,
    "native_ios_proof.grounded_evidence_missing",
  );

  const nativeIosGrounded = makeFixture("native-ios-proof-grounded");
  const nativeIosGroundedState = readState(nativeIosGrounded);
  getLane(nativeIosGroundedState, "engineering")["status"] = "done";
  writeState(nativeIosGrounded, nativeIosGroundedState);
  const groundedReadinessPath = path.join(nativeIosGrounded, "PRODUCTION_READINESS.md");
  mkdirSync(path.join(nativeIosGrounded, "mobile", "proof"), { recursive: true });
  const matrixProofs: Array<[string, string]> = [
    ["cold launch and core value journey", "cold-launch.log"],
    ["account lifecycle", "account.log"],
    ["purchase lifecycle", "purchase.log"],
    ["permissions", "permissions.log"],
    ["resilience", "resilience.log"],
    ["accessibility and presentation", "accessibility.log"],
    ["localization", "localization.log"],
    ["performance", "performance.log"],
    ["release device", "release-device.log"],
  ];
  let readinessText = readFileSync(groundedReadinessPath, "utf8");
  for (const [journey, filename] of matrixProofs) {
    writeFileSync(path.join(nativeIosGrounded, "mobile", "proof", filename), `${journey} fixture proof\n`, "utf8");
    readinessText = readinessText
      .split("\n")
      .map((line) => {
        if (!line.startsWith(`| ${journey} |`)) return line;
        const cells = line.split("|");
        cells[4] = ` \`mobile/proof/${filename}\` `;
        cells[5] = ` ${(cells[5] ?? "").replace(/pending/gi, "verified")} `;
        cells[6] = " Passed ";
        return cells.join("|");
      })
      .join("\n");
  }
  writeFileSync(groundedReadinessPath, readinessText, "utf8");
  runFixture("done native iOS proof with row-specific grounded evidence passes", nativeIosGrounded, "check-native-ios-proof.ts", 0);

  const snapshotOnlyScreenshots = makeFixture("snapshot-only-screenshots");
  writeFileSync(
    path.join(snapshotOnlyScreenshots, "SCREENSHOTS.md"),
    [
      "# Store Screenshots",
      "Status: ready.",
      "Raw Capture Matrix: SnapshotPreviews exported XCTest PNG/JSON proof through TEST_RUNNER_SNAPSHOTS_EXPORT_DIR into snapshot-images.",
      "Production Composition Matrix: final upload path screenshots/final/iphone.png.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "ready iOS screenshots fail when SnapshotPreviews is the only capture route",
    snapshotOnlyScreenshots,
    "check-native-ios-proof.ts",
    1,
    "native_ios_proof.screenshot_capture_route_missing",
  );

  const snapshotLimitScreenshots = makeFixture("snapshot-limit-screenshots");
  writeFileSync(
    path.join(snapshotLimitScreenshots, "SCREENSHOTS.md"),
    [
      "# Store Screenshots",
      "Status: ready.",
      "Raw Capture Matrix: MobAI captured screenshots/raw/home.png from the real UI.",
      "Component regression layer: SnapshotPreviews exported SnapshotTest PNG/JSON proof through TEST_RUNNER_SNAPSHOTS_EXPORT_DIR into snapshot-images.",
      "Production Composition Matrix: final upload path screenshots/final/iphone.png.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "ready iOS screenshots fail when SnapshotPreviews limitation is missing",
    snapshotLimitScreenshots,
    "check-native-ios-proof.ts",
    1,
    "native_ios_proof.screenshot_snapshot_previews_limit_missing",
  );

  const androidOnly = makeFixture("apple-android-only");
  const androidOnlyState = readState(androidOnly);
  expectRecord(androidOnlyState.project, "project")["platforms"] = ["android"];
  expectRecord(expectRecord(androidOnlyState.project, "project")["bundle_ids"], "project.bundle_ids")["ios"] = "";
  const androidAppleLane = getLane(androidOnlyState, "apple_signing");
  androidAppleLane["status"] = "not_needed";
  androidAppleLane["evidence"] = [];
  androidAppleLane["blockers"] = ["Android-only launch; no Apple distribution path."];
  writeState(androidOnly, androidOnlyState);
  runFixture("Android-only app does not require Apple signing packet", androidOnly, "check-apple-signing-packet.ts", 0);

  const appleMissingState = makeFixture("apple-missing-state");
  const appleMissingStateValue = readState(appleMissingState);
  const appleMissingLane = getLane(appleMissingStateValue, "apple_signing");
  appleMissingLane["status"] = "done";
  writeState(appleMissingState, appleMissingStateValue);
  writeFileSync(
    path.join(appleMissingState, "APPLE_SIGNING.md"),
    [
      "# Apple Signing",
      "Apple Developer membership missing.",
      "Team ID unknown and DEVELOPMENT_TEAM blank.",
      "Bundle ID and App ID are not configured.",
      "App Store Connect app record missing.",
      "ASC CLI auth status missing and app creation route blocked until founder approval.",
      "App Record Creation Preflight requires founder approval.",
      "Distribution certificate and provisioning profile missing.",
      "Archive, export, upload, and TestFlight are not configured.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "Apple signing packet with unresolved distribution gates fails",
    appleMissingState,
    "check-apple-signing-packet.ts",
    1,
    "apple_signing.unresolved_distribution_gate",
  );

  const missingAppleRequirements = makeFixture("apple-requirements-missing");
  rmSync(path.join(missingAppleRequirements, "APPLE_APP_STORE_REQUIREMENTS.md"), { force: true });
  runFixture(
    "missing Apple App Store requirements packet fails",
    missingAppleRequirements,
    "check-apple-app-store-requirements.ts",
    1,
    "apple_requirements.missing",
  );

  const thinAppleRequirements = makeFixture("apple-requirements-thin");
  writeFileSync(
    path.join(thinAppleRequirements, "APPLE_APP_STORE_REQUIREMENTS.md"),
    ["# Apple App Store Requirements", "Privacy is handled in the policy.", "The app can be uploaded to App Store Connect."].join("\n"),
    "utf8",
  );
  runFixture(
    "thin Apple App Store requirements packet fails",
    thinAppleRequirements,
    "check-apple-app-store-requirements.ts",
    1,
    "apple_requirements.privacyinfo_xcprivacy.missing",
  );

  const readyAppleRequirementsNoManifest = makeFixture("apple-requirements-no-manifest-file");
  writeCompleteAppleRequirements(readyAppleRequirementsNoManifest);
  rmSync(path.join(readyAppleRequirementsNoManifest, "ios"), { recursive: true, force: true });
  runFixture(
    "ready Apple requirements without PrivacyInfo file fails",
    readyAppleRequirementsNoManifest,
    "check-apple-app-store-requirements.ts",
    1,
    "apple_requirements.privacy_manifest_file_missing",
  );

  const iosOnlyStore = makeFixture("store-ios-only");
  const iosOnlyStoreState = readState(iosOnlyStore);
  expectRecord(iosOnlyStoreState.project, "project")["platforms"] = ["ios"];
  expectRecord(expectRecord(iosOnlyStoreState.project, "project")["bundle_ids"], "project.bundle_ids")["android"] = "";
  writeState(iosOnlyStore, iosOnlyStoreState);
  writeFileSync(
    path.join(iosOnlyStore, "STORE_CONSOLE.md"),
    [
      "# Store Console",
      "App Store Connect click path and ASC CLI routes cover app creation, asc-id-resolver ID resolution, app info, SKU, primary locale, bundle ID, App Privacy, pricing, RevenueCat, asc-revenuecat-catalog-sync, subscription setup, localization, custom product page strategy, In-App Event planning, Higgsfield-backed marketing assets, screenshots, TestFlight, review status, review notes, and account deletion.",
      "App Review Information notes cover purpose and target audience, setup and access instructions, the demo account decision (including an explicit no-login confirmation when there is no account system), the list of test devices and OS versions, and the external services used.",
      "If the app name is already in use, stop for founder approval before using any fallback name.",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(path.join(iosOnlyStore, "store-console.html"), "<!doctype html><html><body>iOS store packet</body></html>", "utf8");
  writeFileSync(
    path.join(iosOnlyStore, "APP_STORE_LISTING.md"),
    [
      "# App Store Listing",
      "App Privacy, pricing, RevenueCat, asc-revenuecat-catalog-sync, subscription setup, localization, custom product page strategy, In-App Event planning, App Icon direction, App Preview routing, SCREENSHOTS.md, iPad screenshot wells, copy overlay rules, ParthJadhav/app-store-screenshots, Higgsfield-backed marketing assets, and founder approval are documented.",
      "ASC route proof includes app creation, asc-app-create-ui, asc-id-resolver, asc-metadata-sync, asc-localize-metadata, asc-screenshot-resize, asc-shots-pipeline, asc-ppp-pricing, asc-subscription-localization, asc-testflight-orchestration, asc-submission-health, and asc-release-flow.",
      "Every screenshot row records version localization ID and every pricing row records base territory.",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(path.join(iosOnlyStore, "app-store-listing.html"), "<!doctype html><html><body>iOS listing packet</body></html>", "utf8");
  writeFileSync(path.join(iosOnlyStore, "app-privacy-questionnaire.html"), "<!doctype html><html><body>iOS privacy questionnaire</body></html>", "utf8");
  writeCompleteStoreScreenshots(iosOnlyStore);
  runFixture("iOS-only store packet does not require Google Play fields", iosOnlyStore, "check-store-console-packet.ts", 0);

  const missingListingArtifacts = makeFixture("store-missing-listing-artifacts");
  rmSync(path.join(missingListingArtifacts, "app-store-listing"), { recursive: true, force: true });
  writeFileSync(
    path.join(missingListingArtifacts, "STORE_CONSOLE.md"),
    [
      "# Store Console",
      "App Store Connect click path covers app info, SKU, primary locale, bundle ID, App Privacy, pricing, RevenueCat, subscription setup, localization, custom product page strategy, In-App Event planning, Higgsfield-backed marketing assets, screenshots, review notes, and account deletion.",
      "Google Play click path covers package name, Data safety, screenshots, review notes, privacy, and account deletion.",
      "If the app name is already in use, stop for founder approval before using any fallback name.",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(path.join(missingListingArtifacts, "store-console.html"), "<!doctype html><html><body>Store console only</body></html>", "utf8");
  runFixture(
    "iOS store packet without App Store listing artifacts fails",
    missingListingArtifacts,
    "check-store-console-packet.ts",
    1,
    "store_console.app_store_listing.markdown_missing",
  );

  const unresolvedListing = makeFixture("store-unresolved-listing");
  writeCompleteStoreConsole(unresolvedListing);
  const unresolvedListingState = readState(unresolvedListing);
  const unresolvedStoreLane = getLane(unresolvedListingState, "store_console");
  unresolvedStoreLane["status"] = "done";
  writeState(unresolvedListing, unresolvedListingState);
  writeFileSync(
    path.join(unresolvedListing, "APP_STORE_LISTING.md"),
    [
      "# App Store Listing",
      "App Privacy answers are Pending.",
      "Pricing, RevenueCat, subscription setup, localization, custom product page strategy, In-App Event planning, Higgsfield-backed marketing assets, and founder approval are documented.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "iOS App Store listing packet with unresolved placeholders fails",
    unresolvedListing,
    "check-store-console-packet.ts",
    1,
    "store_console.placeholder_or_unknown",
  );

  const thinAscMarketing = makeFixture("thin-asc-marketing");
  writeFileSync(
    path.join(thinAscMarketing, "STORE_CONSOLE.md"),
    [
      "# Store Console",
      "App Store Connect click path covers app info, SKU, primary locale, bundle ID, privacy, screenshots, review notes, and account deletion.",
      "Google Play click path covers package name, Data safety, screenshots, review notes, privacy, and account deletion.",
      "If the app name is already in use, stop for founder approval before using any fallback name.",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(path.join(thinAscMarketing, "store-console.html"), "<!doctype html><html><body>Thin store packet</body></html>", "utf8");
  runFixture(
    "thin ASC listing packet without App Privacy and marketing surfaces fails",
    thinAscMarketing,
    "check-store-console-packet.ts",
    1,
    "store_console.app_privacy.missing",
  );

  const unsafeFallback = makeFixture("unsafe-store-fallback");
  writeCompleteStoreConsole(unsafeFallback);
  writeFileSync(
    path.join(unsafeFallback, "STORE_CONSOLE.md"),
    [
      "# Store Console",
      "App Store Connect click path covers app info, SKU, primary locale, bundle ID, App Privacy, pricing, RevenueCat, subscription setup, localization, custom product page strategy, In-App Event planning, Higgsfield-backed marketing assets, screenshots, review notes, and account deletion.",
      "Google Play click path covers package name, Data safety, screenshots, review notes, privacy, and account deletion.",
      "Founder approval is required before submission.",
      "If the app name is already in use, retry with fallback name App - app.",
    ].join("\n"),
    "utf8",
  );
  runFixture("unsafe ASC fallback-name retry fails", unsafeFallback, "check-store-console-packet.ts", 1, "unapproved_name_fallback");

  const ascAppCreationUnderclaimed = makeFixture("asc-app-creation-underclaimed");
  writeCompleteStoreConsole(ascAppCreationUnderclaimed);
  writeFileSync(
    path.join(ascAppCreationUnderclaimed, "STORE_CONSOLE.md"),
    [
      "# Store Console",
      "App Store Connect click path and ASC CLI routes cover app creation, asc-id-resolver ID resolution, app info, SKU, primary locale, bundle ID, App Privacy, pricing, RevenueCat, asc-revenuecat-catalog-sync, subscription setup, localization, custom product page strategy, In-App Event planning, Higgsfield-backed marketing assets, screenshots, TestFlight, review status, review notes, and account deletion.",
      "App Review Information notes cover purpose and target audience, setup and access instructions, the demo account decision (including an explicit no-login confirmation when there is no account system), the list of test devices and OS versions, and the external services used.",
      "The founder must manually create the app record in App Store Connect.",
      "Google Play click path covers package name, Data safety, screenshots, review notes, privacy, and account deletion.",
      "If the app name is already in use, stop for founder approval before using any fallback name.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "manual-only ASC app creation underclaim fails",
    ascAppCreationUnderclaimed,
    "check-store-console-packet.ts",
    1,
    "store_console.asc_app_creation_underclaimed",
  );

  const phraseOnlyStore = makeFixture("store-phrase-only");
  const phraseOnlyStoreState = readState(phraseOnlyStore);
  const phraseOnlyStoreLane = getLane(phraseOnlyStoreState, "store_console");
  phraseOnlyStoreLane["status"] = "done";
  writeState(phraseOnlyStore, phraseOnlyStoreState);
  writeFileSync(
    path.join(phraseOnlyStore, "STORE_CONSOLE.md"),
    [
      "# Store Console",
      "App Store Connect click path TODO.",
      "Google Play click path unknown.",
      "Privacy not configured.",
      "Data safety unknown.",
      "Screenshots TODO.",
      "Review notes TODO.",
      "Account deletion unknown.",
      "SKU placeholder.",
      "Primary locale unknown.",
      "Bundle ID unknown.",
      "Package name unknown.",
      "If the app name is already in use, continue with fallback name automatically without founder approval.",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(path.join(phraseOnlyStore, "store-console.html"), "<!doctype html><html><body>Store packet</body></html>", "utf8");
  runFixture(
    "store packet with placeholders and unapproved fallback fails",
    phraseOnlyStore,
    "check-store-console-packet.ts",
    1,
    "store_console.unapproved_name_fallback",
  );

  const rawOnlyScreenshots = makeFixture("raw-only-screenshots");
  writeCompleteStoreConsole(rawOnlyScreenshots);
  writeFileSync(
    path.join(rawOnlyScreenshots, "SCREENSHOTS.md"),
    [
      "# Store Screenshots",
      "Status: ready for upload.",
      "Raw Capture Matrix",
      "| Slot | Platform | Device | Locale | Source screen | Capture tool | Raw path | Version localization ID | Status |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      "| 1 | iOS | iPhone | en-US | Home | MobAI | screenshots/raw/home.png | 123 | ready |",
      "Production Composition Matrix",
      "Device Wells: iPhone and iPad wells are covered.",
      "headline and copy overlay are not needed because raw screenshots are ready.",
      "DESIGN.md, 11_STAR_EXPERIENCE.md, Higgsfield, Remotion, App Icon, App Preview, asc-screenshot-resize, alpha, color space, thumbnail, visual QA, Google Play, feature graphic, and founder approval are mentioned.",
    ].join("\n"),
    "utf8",
  );
  runFixture("raw-only store screenshots fail", rawOnlyScreenshots, "check-store-screenshots.ts", 1, "store_screenshots.raw_capture_as_final");

  const appStoreScreenshotsUnvalidated = makeFixture("app-store-screenshots-unvalidated");
  writeCompleteStoreConsole(appStoreScreenshotsUnvalidated);
  writeFileSync(
    path.join(appStoreScreenshotsUnvalidated, "SCREENSHOTS.md"),
    [
      "# Store Screenshots",
      "Status: ready for upload.",
      "Raw Capture Matrix",
      "Production Composition Matrix",
      "Device Wells",
      "headline, copy overlay, DESIGN.md, 11_STAR_EXPERIENCE.md, MobAI, Higgsfield, Remotion, ParthJadhav/app-store-screenshots, App Icon, App Preview, asc-screenshot-resize, ASC device_type, screenshot count, required, scaled, version localization ID, alpha, color space, sRGB, thumbnail, visual QA, founder approval, iPhone, iPad, Google Play, and feature graphic are mentioned.",
      "Production artwork was styled with the external screenshot skill, but no saved board state or upload orchestration proof is recorded.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "app-store-screenshots mention without board or upload orchestration fails",
    appStoreScreenshotsUnvalidated,
    "check-store-screenshots.ts",
    1,
    "store_screenshots.app-store-screenshots.json.missing",
  );

  const appPreviewOptional = makeFixture("app-preview-optional");
  writeCompleteStoreConsole(appPreviewOptional);
  writeCompleteStoreScreenshots(appPreviewOptional);
  writeFileSync(
    path.join(appPreviewOptional, "APP_STORE_LISTING.md"),
    readFileSync(path.join(appPreviewOptional, "APP_STORE_LISTING.md"), "utf8") +
      "\n| App Preview 1 | App Store search/product page | real in-app footage | Remotion | previews/ios-preview-1.mp4 | poster frame | optional |\n",
    "utf8",
  );
  runFixture(
    "optional first App Preview without founder deferral fails",
    appPreviewOptional,
    "check-store-screenshots.ts",
    1,
    "store_screenshots.app_preview_optional_without_deferral",
  );
}
