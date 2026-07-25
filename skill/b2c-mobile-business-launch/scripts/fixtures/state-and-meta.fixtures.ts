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

  const clean = makeFixture("clean");
  writeBusinessEntrypoints(clean);
  writeCompleteAttribution(clean);
  writeCompleteAppleSigning(clean);
  writeCompleteAppleRequirements(clean);
  writeCompleteStoreConsole(clean);
  writeCompleteStoreScreenshots(clean);
  writeCompleteElevenStar(clean);
  writeCompleteSecurity(clean);
  writeCompleteContentAssets(clean);
  writeCompleteViralGrowth(clean);
  writeCompletePaidUserAcquisition(clean);
  writeCompleteOrchestration(clean);
  writeCompleteProviderProof(clean);
  runFixture("complete project state passes", clean, "validate-project-state.ts", 0);
  runFixture("complete attribution contract passes", clean, "check-attribution-contract.ts", 0);
  runFixture("clean secret routing passes", clean, "check-secret-routing.ts", 0);
  runFixture("complete security release packet passes", clean, "check-security-release.ts", 0);
  runFixture("complete content assets packet passes", clean, "check-content-assets.ts", 0);
  runFixture("complete viral growth packet passes", clean, "check-viral-growth-loop.ts", 0);
  runFixture("complete paid UA packet passes", clean, "check-paid-user-acquisition.ts", 0);
  runFixture("complete orchestration packet passes", clean, "check-parallel-orchestration.ts", 0);
  runFixture("complete Design Room state passes", clean, "validate-state.ts", 0);
  runFixture("complete Design Room contract passes", clean, "check-design-room-contract.ts", 0);
  runFixture("complete Control Plane contract passes", clean, "check-control-plane-contract.ts", 0);
  runFixture("complete token promotion passes", clean, "check-token-promotion.ts", 0);
  runFixture("complete provider proof passes", clean, "check-live-provider-proof.ts", 0);
  runFixture("complete Apple signing packet passes", clean, "check-apple-signing-packet.ts", 0);
  runFixture("complete Apple App Store requirements packet passes", clean, "check-apple-app-store-requirements.ts", 0);
  runFixture("complete store console packet passes", clean, "check-store-console-packet.ts", 0);
  runFixture("complete store screenshots packet passes", clean, "check-store-screenshots.ts", 0);
  runFixture("complete native iOS proof packet passes", clean, "check-native-ios-proof.ts", 0);
  runFixture("complete UX pattern packet passes", clean, "check-ux-patterns.ts", 0);
  runFixture("complete onboarding conversion packet passes", clean, "check-onboarding-conversion.ts", 0);
  runFixture("complete 11-star experience packet passes", clean, "check-eleven-star-experience.ts", 0);
  runFixture("complete emotional design packet passes", clean, "check-emotional-design.ts", 0);
  runFixture("aso metadata packet passes", clean, "check-aso-metadata.ts", 0);
  runFixture("localization market research packet passes", clean, "check-localization-research.ts", 0);
  runFixture("landing funnel skips without landing scope", clean, "check-landing-funnel.ts", 0);
  runFixture("current skill version passes", skillRoot, "check-skill-version.ts", 0, undefined, ["--source", skillRoot, "--installed", skillRoot]);
  runFixture("current version discipline passes", skillRoot, "check-version-discipline.ts", 0, undefined, [
    "--repo-root",
    path.resolve(skillRoot, "../.."),
    "--skill-root",
    skillRoot,
  ]);
  runFixture("artifact template coverage passes", path.join(skillRoot, "templates"), "check-artifact-templates.ts", 0, undefined, ["--skill-root", skillRoot]);
  runFixture("continuity contract templates pass", skillRoot, "check-continuity-contract.ts", 0, undefined, ["--skill-root", skillRoot]);
  runFixture("generated business continuity contract passes", clean, "check-continuity-contract.ts", 0);
  const emptyBusinessForContinuity = makeEmptyFixture("continuity-empty-business");
  runScriptArgs(
    "continuity root override after skill-root checks business root",
    "check-continuity-contract.ts",
    ["--skill-root", skillRoot, "--root", emptyBusinessForContinuity],
    1,
    "continuity.file_missing",
  );
  runFixture("agent behavior eval definitions pass", path.join(skillRoot, "evals/agent-behavior"), "run-agent-evals.ts", 0);
  runFixture("app archetype packs pass", skillRoot, "check-app-archetype.ts", 0, undefined, ["--skill-root", skillRoot]);
  const archetypeMissing = makeEmptyFixture("app-archetype-missing");
  runScriptArgs("app archetype layer missing fails", "check-app-archetype.ts", ["--skill-root", archetypeMissing], 1, "app_archetype.dir_missing");
  runFixture("compound engineering not in scope passes", clean, "check-compound-engineering-routing.ts", 0);
  writeCompletePaidToolDecisions(clean);
  runFixture("complete paid-tool decisions packet passes", clean, "check-paid-tool-decisions.ts", 0);

  const asoMissingListing = makeFixture("aso-missing-listing");
  rmSync(path.join(asoMissingListing, "app-store-listing"), { recursive: true, force: true });
  rmSync(path.join(asoMissingListing, "APP_STORE_LISTING.md"), { force: true });
  runFixture("aso metadata without APP_STORE_LISTING fails", asoMissingListing, "check-aso-metadata.ts", 1, "aso_metadata.app_store_listing_missing");

  const paidToolMissing = makeFixture("paid-tool-missing-decisions");
  rmSync(path.join(paidToolMissing, "TOOL_DECISIONS.md"), { force: true });
  runFixture(
    "missing TOOL_DECISIONS.md fails when paid tools in scope",
    paidToolMissing,
    "check-paid-tool-decisions.ts",
    1,
    "paid_tool_decisions.file_missing",
  );

  const localizationTranslateFirst = makeFixture("localization-translate-first");
  rmSync(path.join(localizationTranslateFirst, "localization-market-research"), { recursive: true, force: true });
  writeFileSync(
    path.join(localizationTranslateFirst, "APP_STORE_LISTING.md"),
    ["# App Store Listing", "Localization matrix: target locales ja, de, pt-BR.", "Localized keywords prepared for all locales."].join("\n"),
    "utf8",
  );
  runFixture(
    "localization without market research fails as translate-first",
    localizationTranslateFirst,
    "check-localization-research.ts",
    1,
    "localization_research.translate_first",
  );

  const wranglerCreds = makeFixture("wrangler-toml-credentials");
  writeFileSync(
    path.join(wranglerCreds, "wrangler.toml"),
    ['name = "app-landing"', "[vars]", 'SUPABASE_ANON = "sb_publishable_abcdefghijklmnopqrstuvwx"'].join("\n"),
    "utf8",
  );
  runFixture("wrangler.toml committed credential warns", wranglerCreds, "check-secret-routing.ts", 0, "secrets.wrangler_toml_credentials");

  const sourceRegistryClean = makeEmptyFixture("source-registry-clean");
  writeSourceRegistryFixture(sourceRegistryClean);
  runFixture("source registry with registered URL passes", sourceRegistryClean, "check-source-freshness.ts", 0);
  runFixture("template secret docs pass from bundled template path", path.join(skillRoot, "templates"), "check-secret-routing.ts", 0);
  const cockpitPath = path.join(clean, "launch-cockpit.html");
  runFixture("launch cockpit renders", clean, "render-launch-cockpit.ts", 0, undefined, ["--out", cockpitPath]);
  if (!existsSync(cockpitPath)) {
    results.push({
      label: "launch cockpit output exists",
      ok: false,
      expectedCode: 0,
      actualCode: null,
      output: `Missing ${cockpitPath}`,
    });
  }

  const continuityMissingAgents = makeFixture("continuity-missing-agents");
  writeBusinessEntrypoints(continuityMissingAgents);
  writeFileSync(
    path.join(continuityMissingAgents, "AGENTS.md"),
    readFileSync(path.join(continuityMissingAgents, "AGENTS.md"), "utf8").replace(/## Session Continuity[\s\S]*?## Source Of Truth/, "## Source Of Truth"),
    "utf8",
  );
  runFixture("generated business without continuity entrypoint fails", continuityMissingAgents, "check-continuity-contract.ts", 1, "continuity.term_missing");

  const continuityMissingState = makeFixture("continuity-missing-state");
  writeBusinessEntrypoints(continuityMissingState);
  const stateWithoutContinuity = readState(continuityMissingState);
  delete stateWithoutContinuity.continuity;
  writeState(continuityMissingState, stateWithoutContinuity);
  runFixture("project state without continuity block fails", continuityMissingState, "check-continuity-contract.ts", 1, "continuity.project_state_missing");

  const continuityMissingSourceFile = makeFixture("continuity-missing-source-file");
  writeBusinessEntrypoints(continuityMissingSourceFile);
  rmSync(path.join(continuityMissingSourceFile, "PRODUCTION_READINESS.md"), { force: true });
  runFixture("business continuity without source file fails", continuityMissingSourceFile, "check-continuity-contract.ts", 1, "continuity.source_file_missing");

  const continuityMissingGitStatus = makeFixture("continuity-missing-git-status");
  writeBusinessEntrypoints(continuityMissingGitStatus);
  const stateWithoutGitStatus = readState(continuityMissingGitStatus);
  const continuityWithoutGitStatus = expectRecord(stateWithoutGitStatus.continuity, "continuity");
  delete continuityWithoutGitStatus.git_status_reviewed;
  writeState(continuityMissingGitStatus, stateWithoutGitStatus);
  runFixture(
    "project state without git status continuity field fails",
    continuityMissingGitStatus,
    "check-continuity-contract.ts",
    1,
    "continuity.project_state_git_status_missing",
  );

  const missingEvidence = makeFixture("missing-evidence");
  const missingEvidenceState = readState(missingEvidence);
  const missingEvidenceDesign = getLane(missingEvidenceState, "design");
  missingEvidenceDesign["status"] = "done";
  missingEvidenceDesign["evidence"] = ["MISSING.md"];
  writeState(missingEvidence, missingEvidenceState);
  runFixture("done lane with missing local evidence fails", missingEvidence, "validate-project-state.ts", 1, "done_evidence_missing");

  const blankEvidence = makeFixture("blank-evidence");
  const blankEvidenceState = readState(blankEvidence);
  const blankEvidenceDesign = getLane(blankEvidenceState, "design");
  blankEvidenceDesign["status"] = "done";
  blankEvidenceDesign["evidence"] = [""];
  writeState(blankEvidence, blankEvidenceState);
  runFixture("done lane with blank evidence fails", blankEvidence, "validate-project-state.ts", 1, "evidence.0.blank");

  const placeholderDate = makeFixture("placeholder-date");
  const placeholderDateState = readState(placeholderDate);
  placeholderDateState["updated_at"] = "YYYY-MM-DD";
  writeState(placeholderDate, placeholderDateState);
  runFixture("placeholder updated_at fails", placeholderDate, "validate-project-state.ts", 1, "updated_at.placeholder");

  const unreasonedNotNeeded = makeFixture("unreasoned-not-needed");
  const unreasonedState = readState(unreasonedNotNeeded);
  const unreasonedRevenue = getLane(unreasonedState, "revenue");
  unreasonedRevenue["status"] = "not_needed";
  unreasonedRevenue["evidence"] = [];
  unreasonedRevenue["blockers"] = [];
  writeState(unreasonedNotNeeded, unreasonedState);
  runFixture("not_needed lane without evidence or blocker fails", unreasonedNotNeeded, "validate-project-state.ts", 1, "not_needed_without_reason");

  const missingStateEmotionalLane = makeFixture("state-missing-emotional-lane");
  {
    const state = readState(missingStateEmotionalLane);
    const lanes = expectRecord(state.lanes, "PROJECT_STATE.yaml lanes");
    delete lanes.emotional_design;
    writeState(missingStateEmotionalLane, state);
  }
  runFixture("project state without emotional design lane fails", missingStateEmotionalLane, "validate-project-state.ts", 1, "lanes.emotional_design.missing");

  const unreasonedDeferredEmotional = makeFixture("unreasoned-deferred-emotional");
  const unreasonedDeferredState = readState(unreasonedDeferredEmotional);
  const unreasonedDeferredLane = getLane(unreasonedDeferredState, "emotional_design");
  unreasonedDeferredLane["status"] = "deferred";
  unreasonedDeferredLane["evidence"] = [];
  unreasonedDeferredLane["blockers"] = [];
  writeState(unreasonedDeferredEmotional, unreasonedDeferredState);
  runFixture("deferred emotional design lane without reason fails", unreasonedDeferredEmotional, "validate-project-state.ts", 1, "deferred_without_reason");

  // not_started lanes are exempt from the attribution contract (nothing to attribute yet);
  // a "partial" lane with an incomplete contract is a WARNING (WIP), and only "done" hard-errors.
  const partialAttribution = makeFixture("partial-attribution");
  const partialAttributionState = readState(partialAttribution);
  getLane(partialAttributionState, "analytics_attribution")["status"] = "partial";
  writeState(partialAttribution, partialAttributionState);
  runFixture("partial attribution contract warns", partialAttribution, "check-attribution-contract.ts", 0, "attribution.screen_early.incomplete");

  const attributionAlias = makeFixture("attribution-alias");
  const attributionAliasState = readState(attributionAlias);
  getLane(attributionAliasState, "analytics_attribution")["status"] = "partial";
  const aliasContract = expectRecord(getLane(attributionAliasState, "analytics_attribution").attribution_contract, "attribution_contract");
  aliasContract["screen_early"] = true;
  aliasContract["other_free_text"] = true;
  aliasContract["backend_persistence"] = true;
  aliasContract["anonymous_reconciliation"] = true;
  aliasContract["verified"] = true;
  aliasContract["event_name"] = "signup_attribution_selected";
  aliasContract["event_alias_reason"] = "Existing production dashboards map signup_attribution_selected to attribution_source_selected.";
  writeState(attributionAlias, attributionAliasState);
  writeFileSync(
    path.join(attributionAlias, "ANALYTICS.md"),
    [
      "# Analytics",
      "signup_attribution_selected is the app event alias for attribution_source_selected.",
      "PostHog person property: self_reported_source.",
    ].join("\n"),
    "utf8",
  );
  runFixture("documented attribution event alias passes with warning", attributionAlias, "check-attribution-contract.ts", 0, "attribution.event_name.alias");

  const attributionMissingImplementation = makeFixture("attribution-code-missing");
  const attributionMissingState = readState(attributionMissingImplementation);
  const missingContract = expectRecord(getLane(attributionMissingState, "analytics_attribution").attribution_contract, "attribution_contract");
  const missingAttributionLane = getLane(attributionMissingState, "analytics_attribution");
  missingAttributionLane["status"] = "done";
  missingAttributionLane["evidence"] = ["ANALYTICS.md"];
  missingContract["screen_early"] = true;
  missingContract["other_free_text"] = true;
  missingContract["backend_persistence"] = true;
  missingContract["anonymous_reconciliation"] = true;
  missingContract["verified"] = true;
  writeState(attributionMissingImplementation, attributionMissingState);
  writeFileSync(
    path.join(attributionMissingImplementation, "ANALYTICS.md"),
    "# Analytics\n\nAnalytics implementation details are intentionally absent in this fixture.\n",
    "utf8",
  );
  runFixture(
    "done attribution without implementation text fails",
    attributionMissingImplementation,
    "check-attribution-contract.ts",
    1,
    "attribution.text.self_reported_source.not_found",
  );

  const attributionNotNeeded = makeFixture("attribution-not-needed");
  const attributionNotNeededState = readState(attributionNotNeeded);
  const attributionNotNeededLane = getLane(attributionNotNeededState, "analytics_attribution");
  attributionNotNeededLane["status"] = "not_needed";
  attributionNotNeededLane["evidence"] = [];
  attributionNotNeededLane["blockers"] = ["No onboarding, signup, or user identity surface exists in this app."];
  writeState(attributionNotNeeded, attributionNotNeededState);
  runFixture("attribution not_needed with reason passes attribution check", attributionNotNeeded, "check-attribution-contract.ts", 0);

  // --- check-landing-funnel (in-scope paths + scope-skip exit regression) ---
  const landingGateEvidence = [
    "# Landing Deploy Log",
    "git status --porcelain was clean before deploy (no uncommitted changes).",
    "wrangler version 4 checked and current before deploy.",
    "wrangler whoami confirmed the Cloudflare token carries Pages:Edit scope.",
    "Opened the live URL in a real browser, filled the form, submitted the form, and the success state rendered.",
    "Waitlist duplicate email submits are idempotent (HTTP 200 for repeated submits).",
  ].join("\n");

  const landingInScopePass = makeEmptyFixture("landing-funnel-in-scope-pass");
  writeFileSync(path.join(landingInScopePass, "PROJECT_STATE.yaml"), readFileSync(path.join(skillRoot, "templates", "PROJECT_STATE.yaml"), "utf8"), "utf8");
  mkdirSync(path.join(landingInScopePass, "landing"), { recursive: true });
  writeFileSync(path.join(landingInScopePass, "landing", "README.md"), landingGateEvidence, "utf8");
  mkdirSync(path.join(landingInScopePass, "public"), { recursive: true });
  for (const staticFile of ["robots.txt", "llms.txt", "sitemap.xml"]) {
    writeFileSync(path.join(landingInScopePass, "public", staticFile), "seeded by fixture\n", "utf8");
  }
  runFixture("landing funnel in scope with full gate evidence passes", landingInScopePass, "check-landing-funnel.ts", 0);

  const landingInScopeFail = makeEmptyFixture("landing-funnel-in-scope-missing-gates");
  writeFileSync(path.join(landingInScopeFail, "PROJECT_STATE.yaml"), readFileSync(path.join(skillRoot, "templates", "PROJECT_STATE.yaml"), "utf8"), "utf8");
  mkdirSync(path.join(landingInScopeFail, "landing"), { recursive: true });
  writeFileSync(path.join(landingInScopeFail, "landing", "index.html"), "<h1>Launch page</h1>\n", "utf8");
  writeFileSync(path.join(landingInScopeFail, "landing", "README.md"), "# Landing\nDeployed.\n", "utf8");
  runFixture("landing funnel in scope without gate evidence fails", landingInScopeFail, "check-landing-funnel.ts", 1, "landing_funnel.git_clean_gate.missing");

  // A copied-in section library (no index.html/public/wrangler.toml) is not a
  // deployed site and must not trigger the deploy gates.
  const landingPackOnly = makeEmptyFixture("landing-funnel-pack-only");
  writeFileSync(path.join(landingPackOnly, "PROJECT_STATE.yaml"), readFileSync(path.join(skillRoot, "templates", "PROJECT_STATE.yaml"), "utf8"), "utf8");
  mkdirSync(path.join(landingPackOnly, "landing", "sections"), { recursive: true });
  writeFileSync(path.join(landingPackOnly, "landing", "README.md"), "# Landing section library (not a deployed site yet).\n", "utf8");
  writeFileSync(path.join(landingPackOnly, "landing", "sections", "Hero.tsx"), '"use client";\nexport function Hero() {\n  return null;\n}\n', "utf8");
  runFixture("landing section pack without a site stays out of scope", landingPackOnly, "check-landing-funnel.ts", 0);

  const landingNoState = makeEmptyFixture("landing-funnel-missing-state");
  runFixture("landing funnel fails loudly when project state is missing", landingNoState, "check-landing-funnel.ts", 1, "project_state.missing");

  // --- landing motion craft (references/landing-motion-craft.md) ---
  const animatedIndexHtml = (options: { reducedMotion: boolean; tokenized: boolean; staticHero: boolean }): string =>
    [
      "<!doctype html>",
      "<style>",
      "@keyframes rise { to { transform: none; opacity: 1; } }",
      options.tokenized
        ? ".hero { animation: rise var(--motion-duration-reveal) var(--motion-easing-emphasis) forwards; }"
        : ".hero { animation: rise 600ms ease-out forwards; }",
      options.reducedMotion ? "@media (prefers-reduced-motion: reduce) { .hero { animation: none; opacity: 1; } }" : "",
      "</style>",
      options.staticHero ? '<h1 class="hero">Ship your launch page</h1>' : '<h1 class="hero"></h1>',
      "<p>Copy stays legible without JavaScript.</p>",
    ].join("\n");

  const withLandingSite = (root: string, html: string): void => {
    writeFileSync(path.join(root, "PROJECT_STATE.yaml"), readFileSync(path.join(skillRoot, "templates", "PROJECT_STATE.yaml"), "utf8"), "utf8");
    mkdirSync(path.join(root, "landing"), { recursive: true });
    writeFileSync(path.join(root, "landing", "index.html"), html, "utf8");
    writeFileSync(path.join(root, "landing", "README.md"), landingGateEvidence, "utf8");
    mkdirSync(path.join(root, "public"), { recursive: true });
    for (const staticFile of ["robots.txt", "llms.txt", "sitemap.xml"]) {
      writeFileSync(path.join(root, "public", staticFile), "seeded by fixture\n", "utf8");
    }
  };

  const motionCompliant = makeEmptyFixture("landing-motion-compliant");
  withLandingSite(motionCompliant, animatedIndexHtml({ reducedMotion: true, tokenized: true, staticHero: true }));
  runFixture("animated landing with reduced-motion, tokens, and static hero passes", motionCompliant, "check-landing-funnel.ts", 0);

  const motionNoReduced = makeEmptyFixture("landing-motion-no-reduced");
  withLandingSite(motionNoReduced, animatedIndexHtml({ reducedMotion: false, tokenized: true, staticHero: true }));
  runFixture(
    "animated landing without reduced-motion handling fails",
    motionNoReduced,
    "check-landing-funnel.ts",
    1,
    "landing_funnel.motion.reduced_motion_missing",
  );

  const motionJsGatedHero = makeEmptyFixture("landing-motion-js-gated-hero");
  withLandingSite(motionJsGatedHero, animatedIndexHtml({ reducedMotion: true, tokenized: true, staticHero: false }));
  runFixture(
    "animated landing whose hero text is not static fails",
    motionJsGatedHero,
    "check-landing-funnel.ts",
    1,
    "landing_funnel.motion.hero_text_not_static",
  );

  const motionUntokenized = makeEmptyFixture("landing-motion-untokenized");
  withLandingSite(motionUntokenized, animatedIndexHtml({ reducedMotion: true, tokenized: false, staticHero: true }));
  runFixture(
    "animated landing with raw duration literals warns toward the token scale",
    motionUntokenized,
    "check-landing-funnel.ts",
    0,
    "landing_funnel.motion.untokenized_duration",
  );

  // Regression (verification pass): prose mentioning "transition:" in an .mdx
  // file is not animation and must not demand reduced-motion handling.
  const motionProseOnly = makeEmptyFixture("landing-motion-prose-only");
  withLandingSite(motionProseOnly, "<h1>Static launch page</h1>\n<p>No animation here.</p>\n");
  writeFileSync(path.join(motionProseOnly, "landing", "notes.mdx"), "The onboarding transition: from waitlist to full access happens at launch.\n", "utf8");
  runFixture("landing prose mentioning transition is not treated as animation", motionProseOnly, "check-landing-funnel.ts", 0);

  // Regression (verification pass): reduced-motion handling may live outside
  // the landing tree (styles/globals.css) and still satisfies the gate.
  const motionReducedElsewhere = makeEmptyFixture("landing-motion-reduced-elsewhere");
  withLandingSite(motionReducedElsewhere, animatedIndexHtml({ reducedMotion: false, tokenized: true, staticHero: true }));
  mkdirSync(path.join(motionReducedElsewhere, "styles"), { recursive: true });
  writeFileSync(
    path.join(motionReducedElsewhere, "styles", "globals.css"),
    "@media (prefers-reduced-motion: reduce) { * { animation: none; transition: none; } }\n",
    "utf8",
  );
  runFixture("reduced-motion handling outside landing/ satisfies the gate", motionReducedElsewhere, "check-landing-funnel.ts", 0);

  // Regression (verification pass): JS-only animation (camelCase style keys)
  // is still detected as motion.
  const motionJsOnly = makeEmptyFixture("landing-motion-js-only");
  withLandingSite(motionJsOnly, "<h1>Static launch page</h1>\n");
  mkdirSync(path.join(motionJsOnly, "landing", "sections"), { recursive: true });
  writeFileSync(path.join(motionJsOnly, "landing", "sections", "Reveal.tsx"), 'export const style = { opacity: 0, transitionDuration: "600ms" };\n', "utf8");
  runFixture(
    "JS-only animation without reduced-motion handling fails",
    motionJsOnly,
    "check-landing-funnel.ts",
    1,
    "landing_funnel.motion.reduced_motion_missing",
  );

  // --- check-version-discipline (fail branches) ---
  const versionManifestMissing = makeEmptyFixture("version-discipline-manifest-missing");
  runScriptArgs(
    "version discipline fails when skill-version.json is missing",
    "check-version-discipline.ts",
    ["--skill-root", versionManifestMissing],
    1,
    "version_discipline.manifest_missing",
  );

  const versionManifestMalformed = makeEmptyFixture("version-discipline-manifest-malformed");
  writeFileSync(
    path.join(versionManifestMalformed, "skill-version.json"),
    JSON.stringify({ version: "not-semver", updatedAt: "13-06-2026", releaseNotes: [] }, null, 2),
    "utf8",
  );
  runScriptArgs(
    "version discipline fails on a malformed manifest",
    "check-version-discipline.ts",
    ["--skill-root", versionManifestMalformed],
    1,
    "version_discipline.semver_invalid",
  );

  // --- validate-state (fail branch) ---
  const designStateMissing = makeEmptyFixture("design-state-missing");
  runFixture("design state validation fails when state files are missing", designStateMissing, "validate-state.ts", 1, "design_state.file_missing");

  // --- check-lane-coverage ---
  const laneCoverageBaseline = makeFixture("lane-coverage-baseline");
  runFixture("shipped template lane set passes coverage", laneCoverageBaseline, "check-lane-coverage.ts", 0);

  const laneCoverageMissingLane = makeFixture("lane-coverage-missing-lane");
  const laneCoverageState = readState(laneCoverageMissingLane);
  delete expectRecord(laneCoverageState.lanes, "PROJECT_STATE.yaml lanes")["revenue"];
  writeState(laneCoverageMissingLane, laneCoverageState);
  runFixture("state missing a required lane fails coverage", laneCoverageMissingLane, "check-lane-coverage.ts", 1, "lane_coverage.revenue.missing");

  // --- check-lane-coverage: lane dependency edges ---
  // Mechanizes "Lock phase outputs before depending on them" (SKILL.md) — a lane
  // may not claim done while an upstream lane is still not_started/partial/blocked.

  /** Set a lane's status and evidence in one call, returning the mutated state. */
  const withLane = (root: string, lane: string, patch: MutableRecord): MutableRecord => {
    const state = readState(root);
    Object.assign(getLane(state, lane), patch);
    writeState(root, state);
    return state;
  };

  // done on a partial upstream = error.
  const depUnlocked = makeFixture("lane-dependency-unlocked");
  const depUnlockedState = readState(depUnlocked);
  expectRecord(depUnlockedState.project, "PROJECT_STATE.yaml project").phase = "phase_2_design";
  Object.assign(getLane(depUnlockedState, "design"), { status: "done", evidence: ["DESIGN.md"] });
  Object.assign(getLane(depUnlockedState, "product"), { status: "partial", evidence: ["SPEC.md"] });
  writeState(depUnlocked, depUnlockedState);
  runFixture("lane done on a partial upstream lane fails coverage", depUnlocked, "check-lane-coverage.ts", 1, "lane_coverage.design.dependency_unlocked");

  // done on a blocked upstream = error (blocked is not a resolved scope decision).
  const depBlocked = makeFixture("lane-dependency-blocked-upstream");
  const depBlockedState = readState(depBlocked);
  expectRecord(depBlockedState.project, "PROJECT_STATE.yaml project").phase = "phase_2_design";
  Object.assign(getLane(depBlockedState, "design"), { status: "done", evidence: ["DESIGN.md"] });
  Object.assign(getLane(depBlockedState, "product"), { status: "blocked", blockers: ["Awaiting founder call on the V2 boundary."] });
  writeState(depBlocked, depBlockedState);
  runFixture("lane done on a blocked upstream lane fails coverage", depBlocked, "check-lane-coverage.ts", 1, "lane_coverage.design.dependency_unlocked");

  // deferred/not_needed upstream IS a resolved scope decision (launch tiers), so
  // it unblocks a downstream lane. Uses the content_assets -> design edge, whose
  // upstream chain is otherwise untouched.
  const depDeferred = makeFixture("lane-dependency-deferred-upstream");
  const depDeferredState = readState(depDeferred);
  Object.assign(getLane(depDeferredState, "design"), {
    status: "deferred",
    reason: "2026-07-25 Lite tier: shipping on the archetype starter's default system, so no bespoke design pass. Revisit at day 30.",
  });
  Object.assign(getLane(depDeferredState, "content_assets"), { status: "done", evidence: ["CONTENT_ASSETS.md"] });
  writeState(depDeferred, depDeferredState);
  runFixture("deferred upstream lane does not block a downstream done lane", depDeferred, "check-lane-coverage.ts", 0);

  // A dated override downgrades the error to a warning (exit 0, still visible).
  const depOverride = makeFixture("lane-dependency-override");
  const depOverrideState = readState(depOverride);
  Object.assign(getLane(depOverrideState, "design"), {
    status: "done",
    evidence: ["DESIGN.md"],
    dependency_override:
      "2026-07-25 Brand and type system locked from founder identity work; the open SPEC.md item is a V2 scope question that does not touch any design token.",
  });
  Object.assign(getLane(depOverrideState, "product"), { status: "partial", evidence: ["SPEC.md"] });
  writeState(depOverride, depOverrideState);
  runFixture(
    "dated dependency_override downgrades the edge error to a warning",
    depOverride,
    "check-lane-coverage.ts",
    0,
    "lane_coverage.design.dependency_overridden",
  );

  // An undated/trivial override still records the warning but is itself flagged.
  const depOverrideThin = makeFixture("lane-dependency-override-thin");
  withLane(depOverrideThin, "product", { status: "partial", evidence: ["SPEC.md"] });
  withLane(depOverrideThin, "design", { status: "done", evidence: ["DESIGN.md"], dependency_override: "not needed" });
  runFixture("undated dependency_override is flagged as thin", depOverrideThin, "check-lane-coverage.ts", 0, "lanes.design.reason_undated_or_trivial");
}
