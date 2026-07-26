import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Harness, type MutableRecord, expectRecord, getLane, readState, skillRoot, writeCompleteCompoundEngineering, writeState } from "./_harness.js";

/**
 * Lifecycle fixtures: post-launch operations, Google Play readiness, the
 * backend data contract, the CE-unavailable Standalone Engineering Loop, and
 * the launch-tier state field.
 */
export function register(h: Harness): void {
  const { makeFixture, makeEmptyFixture, runFixture } = h;

  // ── Post-launch operations ────────────────────────────────────────────────

  const postLaunchComplete = makeFixture("post-launch-complete");
  {
    const state = readState(postLaunchComplete);
    expectRecord(state.project, "project")["phase"] = "phase_6b";
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["POST_LAUNCH_OPS.md", "LAUNCH_RETRO.md"];
    writeState(postLaunchComplete, state);
  }
  runFixture("post-launch lane done with complete runbook passes", postLaunchComplete, "check-post-launch-ops.ts", 0);

  const postLaunchNoRunbook = makeFixture("post-launch-no-runbook");
  {
    const state = readState(postLaunchNoRunbook);
    expectRecord(state.project, "project")["phase"] = "phase_6";
    writeState(postLaunchNoRunbook, state);
    rmSync(path.join(postLaunchNoRunbook, "POST_LAUNCH_OPS.md"));
  }
  runFixture("post-launch phase without runbook fails", postLaunchNoRunbook, "check-post-launch-ops.ts", 1, "post_launch_ops.runbook_missing");

  const postLaunchNoRetro = makeFixture("post-launch-no-retro");
  {
    const state = readState(postLaunchNoRetro);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["POST_LAUNCH_OPS.md"];
    writeState(postLaunchNoRetro, state);
    rmSync(path.join(postLaunchNoRetro, "LAUNCH_RETRO.md"));
  }
  runFixture("post-launch done without launch retro fails", postLaunchNoRetro, "check-post-launch-ops.ts", 1, "post_launch_ops.launch_retro_missing");

  // A retro with no whole-app verdict surface is the zombie-app setup: the
  // weekly rhythm runs forever and no checkpoint ever asks kill, hold, or scale.
  const postLaunchNoVerdict = makeFixture("post-launch-retro-no-verdict");
  {
    const state = readState(postLaunchNoVerdict);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["POST_LAUNCH_OPS.md", "LAUNCH_RETRO.md"];
    writeState(postLaunchNoVerdict, state);
    writeFileSync(
      path.join(postLaunchNoVerdict, "LAUNCH_RETRO.md"),
      ["# Launch Retro", "", "## Lane Usage", "", "## Stalls And Blockers", "", "## Surprises", "", "## Failure Card Candidates"].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "post-launch done with a retro missing the kill-or-scale verdict fails",
    postLaunchNoVerdict,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.kill_or_scale_missing",
  );

  // Mentioning the phrase in prose is not the section: only the real heading
  // (and its table) counts as the verdict surface.
  const postLaunchProsePhrase = makeFixture("post-launch-retro-prose-phrase-only");
  {
    const state = readState(postLaunchProsePhrase);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["POST_LAUNCH_OPS.md", "LAUNCH_RETRO.md"];
    writeState(postLaunchProsePhrase, state);
    writeFileSync(
      path.join(postLaunchProsePhrase, "LAUNCH_RETRO.md"),
      ["# Launch Retro", "", "## Surprises", "", "We should think about kill, hold, or scale at some point.", "", "## Failure Card Candidates"].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "retro mentioning the verdict phrase in prose without the section fails",
    postLaunchProsePhrase,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.kill_or_scale_missing",
  );

  // The heading alone is words-not-work: once the Retro Window records a
  // completed Day 30/Day 90 pass, the checkpoint's verdict row and the state
  // mirror must both carry the decision.
  const verdictTemplateRetro = (root: string, options: { day30Date: string; day30Verdict: string }): void => {
    const retro = readFileSync(path.join(root, "LAUNCH_RETRO.md"), "utf8")
      .replace("| Day 30 | | |", `| Day 30 | ${options.day30Date} | founder |`)
      .replace("| Day 30 | | | | | | |", `| Day 30 | flat | declining | n/a | 8 | ${options.day30Verdict} | |`);
    writeFileSync(path.join(root, "LAUNCH_RETRO.md"), retro, "utf8");
  };

  const postLaunchVerdictEmpty = makeFixture("post-launch-checkpoint-verdict-empty");
  {
    const state = readState(postLaunchVerdictEmpty);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["POST_LAUNCH_OPS.md", "LAUNCH_RETRO.md"];
    writeState(postLaunchVerdictEmpty, state);
    verdictTemplateRetro(postLaunchVerdictEmpty, { day30Date: "2026-06-28", day30Verdict: "" });
  }
  runFixture(
    "completed day-30 checkpoint with an empty verdict row fails",
    postLaunchVerdictEmpty,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.kill_or_scale_verdict_unfilled",
  );

  const postLaunchVerdictNoState = makeFixture("post-launch-verdict-without-state-mirror");
  {
    const state = readState(postLaunchVerdictNoState);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["POST_LAUNCH_OPS.md", "LAUNCH_RETRO.md"];
    writeState(postLaunchVerdictNoState, state);
    verdictTemplateRetro(postLaunchVerdictNoState, { day30Date: "2026-06-28", day30Verdict: "Hold" });
  }
  runFixture(
    "recorded verdict without the PROJECT_STATE mirror fails",
    postLaunchVerdictNoState,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.kill_or_scale_state_missing",
  );

  const postLaunchVerdictComplete = makeFixture("post-launch-verdict-complete");
  {
    const state = readState(postLaunchVerdictComplete);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["POST_LAUNCH_OPS.md", "LAUNCH_RETRO.md"];
    lane["kill_or_scale_decision"] = "hold";
    lane["kill_or_scale_decided_at"] = "2026-06-28";
    writeState(postLaunchVerdictComplete, state);
    verdictTemplateRetro(postLaunchVerdictComplete, { day30Date: "2026-06-28", day30Verdict: "Hold — flat but positive, low founder cost" });
  }
  runFixture("completed checkpoint with verdict and state mirror passes", postLaunchVerdictComplete, "check-post-launch-ops.ts", 0);

  // A verdict without its evidence pack is a mood, not a decision.
  const postLaunchVerdictNoEvidence = makeFixture("post-launch-verdict-without-evidence");
  {
    const state = readState(postLaunchVerdictNoEvidence);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["POST_LAUNCH_OPS.md", "LAUNCH_RETRO.md"];
    lane["kill_or_scale_decision"] = "hold";
    lane["kill_or_scale_decided_at"] = "2026-06-28";
    writeState(postLaunchVerdictNoEvidence, state);
    const retro = readFileSync(path.join(postLaunchVerdictNoEvidence, "LAUNCH_RETRO.md"), "utf8")
      .replace("| Day 30 | | |", "| Day 30 | 2026-06-28 | founder |")
      .replace("| Day 30 | | | | | | |", "| Day 30 | | | | | Hold | |");
    writeFileSync(path.join(postLaunchVerdictNoEvidence, "LAUNCH_RETRO.md"), retro, "utf8");
  }
  runFixture(
    "verdict recorded without the evidence pack fails",
    postLaunchVerdictNoEvidence,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.kill_or_scale_evidence_unfilled",
  );

  // The state mirror must agree with the latest completed checkpoint's verdict.
  const postLaunchVerdictMismatch = makeFixture("post-launch-verdict-state-mismatch");
  {
    const state = readState(postLaunchVerdictMismatch);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["POST_LAUNCH_OPS.md", "LAUNCH_RETRO.md"];
    lane["kill_or_scale_decision"] = "scale";
    lane["kill_or_scale_decided_at"] = "2026-06-28";
    writeState(postLaunchVerdictMismatch, state);
    verdictTemplateRetro(postLaunchVerdictMismatch, { day30Date: "2026-06-28", day30Verdict: "Hold" });
  }
  runFixture(
    "state mirror disagreeing with the retro verdict fails",
    postLaunchVerdictMismatch,
    "check-post-launch-ops.ts",
    1,
    "post_launch_ops.kill_or_scale_state_mismatch",
  );

  // ── Portfolio registry ────────────────────────────────────────────────────

  // Optional surface: single-business founders have no registry and stay clean.
  const portfolioAbsent = makeEmptyFixture("portfolio-registry-absent");
  runFixture("missing portfolio registry is a clean no-op", portfolioAbsent, "check-portfolio-registry.ts", 0);

  // Once the registry exists it must carry the whole board, not just app rows.
  const portfolioThin = makeEmptyFixture("portfolio-registry-thin");
  writeFileSync(
    path.join(portfolioThin, "PORTFOLIO_REGISTRY.md"),
    ["# Portfolio Registry", "", "## Businesses", "", "| Business | Repo | Stage |", "| --- | --- | --- |", "| Ocho | ~/code/rork-ocho | live |"].join("\n"),
    "utf8",
  );
  runFixture(
    "portfolio registry without allocation, learnings, and pipeline fails",
    portfolioThin,
    "check-portfolio-registry.ts",
    1,
    "portfolio_registry.section_missing.allocation",
  );

  // A board with every heading and zero real business rows is a blank board
  // claiming to exist — token presence is not substance. The shipped template
  // stays inert through its _example:_ row, exercised by the audit-plan step.
  const portfolioBlank = makeEmptyFixture("portfolio-registry-blank-board");
  writeFileSync(
    path.join(portfolioBlank, "PORTFOLIO_REGISTRY.md"),
    [
      "# Portfolio Registry",
      "",
      "## Businesses",
      "",
      "| Business | Repo | Stage | MRR (trend) | Last verdict (date) |",
      "| --- | --- | --- | --- | --- |",
      "",
      "## Allocation",
      "",
      "Hours go where the verdicts point.",
      "",
      "## Cross-App Learnings",
      "",
      "| Learning | Source app | Date | Applied where next |",
      "| --- | --- | --- | --- |",
      "",
      "## Next Launch Pipeline",
      "",
      "| Idea | Evidence so far | Starts when |",
      "| --- | --- | --- |",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "portfolio registry with headings but no business rows fails",
    portfolioBlank,
    "check-portfolio-registry.ts",
    1,
    "portfolio_registry.businesses_empty",
  );

  const portfolioFilled = makeEmptyFixture("portfolio-registry-filled");
  const shippedPortfolio = readFileSync(path.join(skillRoot, "templates", "PORTFOLIO_REGISTRY.md"), "utf8");
  writeFileSync(
    path.join(portfolioFilled, "PORTFOLIO_REGISTRY.md"),
    shippedPortfolio.replace(
      /\| _example: Ocho_[^\n]*\n/,
      "| Ocho | ~/code/rork-ocho | 2026-05-29 | live | $180 flat | hold (2026-06-28) | 8 | day-90 retro |\n",
    ),
    "utf8",
  );
  runFixture("portfolio registry with a real business row passes", portfolioFilled, "check-portfolio-registry.ts", 0);

  const postLaunchThin = makeFixture("post-launch-thin-runbook");
  {
    const state = readState(postLaunchThin);
    const lane = getLane(state, "post_launch_ops");
    lane["status"] = "done";
    lane["evidence"] = ["POST_LAUNCH_OPS.md", "LAUNCH_RETRO.md"];
    writeState(postLaunchThin, state);
    writeFileSync(
      path.join(postLaunchThin, "POST_LAUNCH_OPS.md"),
      ["# Post-Launch Operations", "We will check Sentry sometimes and reply to reviews when there is time."].join("\n"),
      "utf8",
    );
  }
  runFixture("post-launch done with thin runbook fails", postLaunchThin, "check-post-launch-ops.ts", 1, "post_launch_ops.section_missing");

  // ── Google Play readiness ─────────────────────────────────────────────────

  function setAndroidStore(root: string, storeStatus: string): void {
    const state = readState(root);
    const project = expectRecord(state.project, "project");
    project["platforms"] = ["ios", "android"];
    expectRecord(project["bundle_ids"], "bundle_ids")["android"] = "com.example.app";
    const lane = getLane(state, "store_console");
    lane["status"] = storeStatus;
    lane["evidence"] = ["STORE_CONSOLE.md", "GOOGLE_PLAY_RELEASE.md"];
    writeState(root, state);
  }

  const playComplete = makeFixture("google-play-complete");
  setAndroidStore(playComplete, "done");
  runFixture("android scope with complete play packet passes", playComplete, "check-google-play-readiness.ts", 0);

  const playMissing = makeFixture("google-play-missing");
  setAndroidStore(playMissing, "done");
  rmSync(path.join(playMissing, "GOOGLE_PLAY_RELEASE.md"));
  runFixture("android store done without play packet fails", playMissing, "check-google-play-readiness.ts", 1, "google_play.packet_missing");

  const playIosOnly = makeFixture("google-play-ios-only");
  rmSync(path.join(playIosOnly, "GOOGLE_PLAY_RELEASE.md"));
  runFixture("ios-only project skips google play check", playIosOnly, "check-google-play-readiness.ts", 0);

  const playUnreconciled = makeFixture("google-play-unreconciled");
  setAndroidStore(playUnreconciled, "done");
  writeFileSync(
    path.join(playUnreconciled, "GOOGLE_PLAY_RELEASE.md"),
    [
      "# Google Play Release",
      "## Developer Account",
      "Organization account; verification complete.",
      "## Data Safety",
      "Form filled in the console.",
      "## Content Rating",
      "IARC questionnaire completed.",
      "## Play App Signing",
      "Enrolled; upload via Android App Bundle (AAB).",
      "## Target API Level",
      "Requirement checked at release time.",
      "## Release Tracks",
      "Internal -> closed -> production with staged rollout.",
      "## Closed Testing",
      "Organization account: the 12 testers gate does not apply; closed test still runs for the pre-launch report.",
      "## Pre-Launch Report",
      "Reviewed on the closed track.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "android done without data safety reconciliation fails",
    playUnreconciled,
    "check-google-play-readiness.ts",
    1,
    "google_play.data_safety_reconciliation_missing",
  );

  // ── Backend data contract ─────────────────────────────────────────────────

  function setEngineeringDone(root: string): void {
    const state = readState(root);
    const lane = getLane(state, "engineering");
    lane["status"] = "done";
    lane["evidence"] = ["TECH_SPEC.md", "ENGINEERING_PLAN.md", "PRODUCTION_READINESS.md"];
    writeState(root, state);
  }

  const backendComplete = makeFixture("backend-contract-complete");
  setEngineeringDone(backendComplete);
  runFixture("engineering done with template data contract passes", backendComplete, "check-backend-data-contract.ts", 0);

  const backendNoSection = makeFixture("backend-contract-no-section");
  setEngineeringDone(backendNoSection);
  writeFileSync(
    path.join(backendNoSection, "TECH_SPEC.md"),
    ["# Tech Spec", "Implementation contracts are traced from LAUNCH_TRACE.md; schema lives wherever the builder put it."].join("\n"),
    "utf8",
  );
  runFixture("engineering done without data contract section fails", backendNoSection, "check-backend-data-contract.ts", 1, "backend_contract.section_missing");

  const backendNoSpec = makeFixture("backend-contract-no-spec");
  setEngineeringDone(backendNoSpec);
  rmSync(path.join(backendNoSpec, "TECH_SPEC.md"));
  runFixture("engineering done without tech spec fails", backendNoSpec, "check-backend-data-contract.ts", 1, "backend_contract.tech_spec_missing");

  // Words-vs-work grounding: naming RLS in prose is not tested authorization.
  const backendUntestedAuth = makeFixture("backend-contract-untested-auth");
  setEngineeringDone(backendUntestedAuth);
  writeFileSync(
    path.join(backendUntestedAuth, "TECH_SPEC.md"),
    [
      "# Tech Spec",
      "## Data Contract",
      "### Backend Selection",
      "supabase — chosen for the archetype starter default.",
      "### Data Model",
      "profiles and entities per the starter schema.",
      "### Authorization Model",
      "Enforcement: Postgres RLS policies. Deny-by-default.",
      "### Migrations And Environments",
      "Migrations run through the supabase CLI; dev/staging/prod separated.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "engineering done with untested prose-only RLS claim fails",
    backendUntestedAuth,
    "check-backend-data-contract.ts",
    1,
    "backend_contract.authorization_untested",
  );

  const backendUngroundedAuth = makeFixture("backend-contract-ungrounded-auth");
  setEngineeringDone(backendUngroundedAuth);
  writeFileSync(
    path.join(backendUngroundedAuth, "TECH_SPEC.md"),
    [
      "# Tech Spec",
      "## Data Contract",
      "### Backend Selection",
      "supabase — chosen for the archetype starter default.",
      "### Data Model",
      "profiles and entities per the starter schema.",
      "### Authorization Model",
      "Enforcement: Postgres RLS policies. Deny-by-default. Rules are tested via supabase/tests/rls.test.sql (owner, anonymous, cross-user).",
      "### Migrations And Environments",
      "Migrations run through the supabase CLI; dev/staging/prod separated.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "engineering done with tested-authz claim but no artifact on disk fails",
    backendUngroundedAuth,
    "check-backend-data-contract.ts",
    1,
    "backend_contract.authorization_proof_missing",
  );

  // Regression (verification pass): numbered headings must not defeat the
  // Authorization Model section extraction and silently widen the scan.
  const backendNumberedHeading = makeFixture("backend-contract-numbered-heading");
  setEngineeringDone(backendNumberedHeading);
  writeFileSync(
    path.join(backendNumberedHeading, "TECH_SPEC.md"),
    [
      "# Tech Spec",
      "## Data Contract",
      "### 1. Backend Selection",
      "supabase — chosen for the archetype starter default.",
      "### 2. Data Model",
      "profiles and entities per the starter schema. Integration tested elsewhere.",
      "### 3. Authorization Model",
      "Enforcement: Postgres RLS policies. Deny-by-default.",
      "### 4. Migrations And Environments",
      "Migrations run through the supabase CLI; dev/staging/prod separated.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "numbered authorization heading still gates untested prose-only RLS",
    backendNumberedHeading,
    "check-backend-data-contract.ts",
    1,
    "backend_contract.authorization_untested",
  );

  // ── Standalone Engineering Loop (CE unavailable) ──────────────────────────

  function setCeUnavailable(root: string): void {
    const state = readState(root);
    const compound = expectRecord(state.compound_engineering, "compound_engineering") as MutableRecord;
    compound["availability"] = "unavailable";
    compound["route"] = "ce_fallback";
    compound["fallback_reason"] =
      "2026-06-10: Compound Engineering plugin is not installed in this cloud runtime; standalone loop carries the same evidence bar.";
    expectRecord(compound["latest_check"], "latest_check")["status"] = "unavailable_with_reason";
    writeState(root, state);
  }

  const ceFallbackNoLoop = makeFixture("ce-fallback-no-loop");
  writeCompleteCompoundEngineering(ceFallbackNoLoop);
  setCeUnavailable(ceFallbackNoLoop);
  runFixture(
    "ce unavailable without standalone loop in plan fails",
    ceFallbackNoLoop,
    "check-compound-engineering-routing.ts",
    1,
    "compound_engineering.standalone_loop_missing",
  );

  const ceFallbackWithLoop = makeFixture("ce-fallback-with-loop");
  writeCompleteCompoundEngineering(ceFallbackWithLoop);
  setCeUnavailable(ceFallbackWithLoop);
  writeFileSync(
    path.join(ceFallbackWithLoop, "ENGINEERING_PLAN.md"),
    [
      "# Engineering Plan",
      "Compound Engineering: unavailable in this runtime; ce-plan and ce-work are replaced by the Standalone Engineering Loop with the same evidence bar.",
      "Standalone Engineering Loop: plan, bounded slices, adversarial review, test, and proof per engineering-orchestration.md section 1b.",
      "Brainstorm: product direction already decisive; brainstorm skipped with rationale recorded.",
    ].join("\n"),
    "utf8",
  );
  runFixture("ce unavailable with standalone loop in plan passes", ceFallbackWithLoop, "check-compound-engineering-routing.ts", 0);

  // ── Email lane deepening (DNS reference, unsubscribe, brand tokens) ──────

  function setEmailDone(root: string): void {
    const state = readState(root);
    const lane = getLane(state, "email");
    lane["status"] = "done";
    lane["evidence"] = ["EMAIL_OPS.md"];
    writeState(root, state);
    mkdirSync(path.join(root, "proof"), { recursive: true });
    for (const proof of ["email-domain-verified.txt", "email-spf-dkim-pass.txt", "email-test-send-log.txt"]) {
      writeFileSync(path.join(root, "proof", proof), "captured 2026-06-10\n", "utf8");
    }
    appendFileSync(
      path.join(root, "SECRETS.md"),
      "\n| `RESEND_API_KEY` | Resend | server_secret | local/staging/prod | backend | server-only | Doppler project/config | founder | quarterly | routed |\n",
      "utf8",
    );
    // Populate the sender map / domain rows the template ships as placeholders.
    const emailOpsPath = path.join(root, "EMAIL_OPS.md");
    const emailOps = readFileSync(emailOpsPath, "utf8")
      .replaceAll("<!-- e.g. hello@mail.example.com -->", "hello@mail.example.com")
      .replaceAll("<!-- e.g. support@example.com -->", "support@example.com")
      .replaceAll("<!-- e.g. mail.example.com -->", "mail.example.com");
    writeFileSync(emailOpsPath, emailOps, "utf8");
  }

  const emailDoneComplete = makeFixture("email-done-complete");
  setEmailDone(emailDoneComplete);
  runFixture("email lane done with dns/unsubscribe/brand contract passes", emailDoneComplete, "check-email.ts", 0);

  const emailDoneUnbranded = makeFixture("email-done-unbranded");
  setEmailDone(emailDoneUnbranded);
  {
    const emailOpsPath = path.join(emailDoneUnbranded, "EMAIL_OPS.md");
    writeFileSync(emailOpsPath, readFileSync(emailOpsPath, "utf8").replaceAll("DESIGN.md", "the design doc"), "utf8");
  }
  runFixture("email lane done without DESIGN.md brand tokens fails", emailDoneUnbranded, "check-email.ts", 1, "email.brand_tokens_missing");

  const emailDoneNoDns = makeFixture("email-done-no-dns");
  setEmailDone(emailDoneNoDns);
  writeFileSync(
    path.join(emailDoneNoDns, "EMAIL_OPS.md"),
    [
      "# Email Ops",
      "Sender map:",
      "| Email | From address | Template | Unsubscribe required |",
      "| --- | --- | --- | --- |",
      "| welcome | hello@mail.example.com | resend/email-templates.ts `welcomeEmail` | no (transactional) |",
      "Brand tokens pulled from DESIGN.md per email-templates.ts.",
    ].join("\n"),
    "utf8",
  );
  runFixture("email lane done without SPF/DKIM reference fails", emailDoneNoDns, "check-email.ts", 1, "email.dns_proof_reference_missing");

  // ── Analytics event-catalog completeness ─────────────────────────────────

  function setAnalyticsDone(root: string): void {
    const state = readState(root);
    const lane = getLane(state, "analytics_attribution");
    lane["status"] = "done";
    writeState(root, state);
  }

  const catalogReconciled = makeFixture("analytics-catalog-reconciled");
  setAnalyticsDone(catalogReconciled);
  runFixture("analytics done with reconciled event catalog passes", catalogReconciled, "check-analytics-catalog.ts", 0);

  const catalogDrift = makeFixture("analytics-catalog-drift");
  setAnalyticsDone(catalogDrift);
  appendFileSync(path.join(catalogDrift, "growth", "VIRAL_GROWTH.md"), "\n- `invented_share_event`\n", "utf8");
  runFixture(
    "analytics done with an uncataloged doc event fails",
    catalogDrift,
    "check-analytics-catalog.ts",
    1,
    "analytics_catalog.invented_share_event.uncataloged",
  );

  // ── Launch scope state field ──────────────────────────────────────────────
  // Renamed from launch_tier because "tier" collided with the founder's own app pricing
  // tiers. Three cases matter: an invalid current value fails, an invalid LEGACY value
  // still fails (a pre-rename business repo is not silently exempted), and the legacy
  // "lite" value still resolves to a valid scope so those repos keep validating.

  const invalidScope = makeFixture("launch-scope-invalid");
  {
    const state = readState(invalidScope);
    expectRecord(state.project, "project")["launch_scope"] = "minimal";
    writeState(invalidScope, state);
  }
  runFixture("invalid launch scope fails", invalidScope, "validate-project-state.ts", 1, "project.launch_scope.invalid");

  const invalidLegacyTier = makeFixture("launch-tier-legacy-invalid");
  {
    const state = readState(invalidLegacyTier);
    const project = expectRecord(state.project, "project");
    delete project["launch_scope"];
    project["launch_tier"] = "minimal";
    writeState(invalidLegacyTier, state);
  }
  runFixture("invalid legacy launch tier still fails", invalidLegacyTier, "validate-project-state.ts", 1, "project.launch_scope.invalid");

  const legacyLiteTier = makeFixture("launch-tier-legacy-lite");
  {
    const state = readState(legacyLiteTier);
    const project = expectRecord(state.project, "project");
    delete project["launch_scope"];
    project["launch_tier"] = "lite";
    writeState(legacyLiteTier, state);
  }
  runFixture("legacy lite launch tier still validates", legacyLiteTier, "validate-project-state.ts", 0);

  // ── Scope-skip exit regression ────────────────────────────────────────────
  // The skip paths used process.exit(0), which discarded the
  // project_state.missing error reportAndExit had already emitted (exit 0 with
  // "1 error(s)" printed). The skip path must still fail on a missing state.

  const postLaunchNoState = makeEmptyFixture("post-launch-missing-state");
  runFixture("post-launch ops fails loudly when project state is missing", postLaunchNoState, "check-post-launch-ops.ts", 1, "project_state.missing");

  const googlePlayNoState = makeEmptyFixture("google-play-missing-state");
  runFixture(
    "google play readiness fails loudly when project state is missing",
    googlePlayNoState,
    "check-google-play-readiness.ts",
    1,
    "project_state.missing",
  );
}
