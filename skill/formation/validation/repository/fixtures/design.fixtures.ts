import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Harness, expectRecord, getLane, readState, writeState } from "./_harness.js";

export function register(h: Harness): void {
  const { makeFixture, makeEmptyFixture, runFixture } = h;

  const emotionalDesignMissing = makeFixture("emotional-design-missing");
  rmSync(path.join(emotionalDesignMissing, "product", "experience", "emotional-design"), { recursive: true, force: true });
  runFixture("missing emotional design contract fails", emotionalDesignMissing, "check-emotional-design.ts", 1, "emotional_design.contract_missing");

  const emotionalDesignLaneAbsent = makeFixture("emotional-design-lane-absent");
  {
    const state = readState(emotionalDesignLaneAbsent);
    const lanes = expectRecord(state.lanes, "state/PROJECT_STATE.yaml lanes");
    delete lanes.emotional_design;
    writeState(emotionalDesignLaneAbsent, state);
  }
  runFixture("missing emotional design lane fails", emotionalDesignLaneAbsent, "check-emotional-design.ts", 1, "emotional_design.lane_missing");

  const emotionalDesignGenericHtml = makeFixture("emotional-design-generic-html");
  rmSync(path.join(emotionalDesignGenericHtml, "product", "experience", "emotional-design", "emotional-design.html"), { force: true });
  runFixture(
    "generic design/design.html does not satisfy emotional board",
    emotionalDesignGenericHtml,
    "check-emotional-design.ts",
    1,
    "emotional_design/design.html_missing",
  );

  const emotionalSocialProofUnproven = makeFixture("emotional-social-proof-unproven");
  {
    const cardPath = path.join(emotionalSocialProofUnproven, "product", "experience", "emotional-design", "EMOTIONAL_DESIGN.md");
    const text = readFileSync(cardPath, "utf8");
    writeFileSync(
      cardPath,
      `${text}

experience_card:
  card_id: social-proof-attested-elsewhere
  mechanism: social_proof
  trigger_moment: testimonial rail
  bright_line: The claim helps users evaluate whether the app has real usage.
  dark_line: The count must never be fabricated or borrowed from a different market.
  guardrail: Only publish the testimonial rail when the count source is verified.
  posthog_event: social_proof_viewed
  ethics_attestation: The proof supports user confidence without manufacturing pressure.
  counter_metric: Track social_proof_dismissed and complaint reports.
  social_proof_truthfulness_proof: Verified from App Store and Google Play store data.
`,
      "utf8",
    );
    writeFileSync(
      path.join(emotionalSocialProofUnproven, "product/ONBOARDING.md"),
      [
        "# Onboarding",
        "First value / value-reveal step: the user sees a personalized plan before the paywall.",
        "Join 999 users who already started today.",
        "Paywall: present the RevenueCat offering after the plan.",
        "Analytics: onboarding_started, personalized_plan_viewed, paywall_viewed.",
      ].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "unrelated social proof card does not bless live copy",
    emotionalSocialProofUnproven,
    "check-emotional-design.ts",
    1,
    "emotional_design.fake_social_proof_phrase",
  );

  const emotionalDesignUnguardedReward = makeFixture("emotional-design-unguarded-reward");
  {
    const cardPath = path.join(emotionalDesignUnguardedReward, "product", "experience", "emotional-design", "EMOTIONAL_DESIGN.md");
    const text = readFileSync(cardPath, "utf8");
    // Rename the variable_reward escape-hatch + counter-metric keys so the HIGH-tier gate fires.
    const stripped = text.replace("  user_control_escape_hatch: >", "  removed_escape_hatch: >").replace("  counter_metric: >", "  removed_counter_metric: >");
    writeFileSync(cardPath, stripped, "utf8");
  }
  runFixture(
    "variable reward card without escape hatch fails",
    emotionalDesignUnguardedReward,
    "check-emotional-design.ts",
    1,
    "emotional_design.variable_reward_missing_user_control_escape_hatch",
  );

  const emotionalSpendNearReward = makeFixture("emotional-spend-near-reward");
  writeFileSync(
    path.join(emotionalSpendNearReward, "product/ONBOARDING.md"),
    [
      "# Onboarding",
      "Streak reveal: day 7 celebration with the weekly progress recap.",
      "Paywall: present the RevenueCat offering right here.",
      "Analytics: streak_celebrated, paywall_viewed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "spend prompt beside a streak moment without stated separation fails",
    emotionalSpendNearReward,
    "check-emotional-design.ts",
    1,
    "emotional_design.spend_prompt_after_reward",
  );

  const emotionalSpendSeparated = makeFixture("emotional-spend-separated");
  writeFileSync(
    path.join(emotionalSpendSeparated, "product/ONBOARDING.md"),
    [
      "# Onboarding",
      "Streak reveal: day 7 celebration with the weekly progress recap.",
      "Paywall: presented on a separate screen, one interaction after the streak reveal resolves.",
      "Analytics: streak_celebrated, paywall_viewed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "spend prompt with a stated separation from the streak moment passes",
    emotionalSpendSeparated,
    "check-emotional-design.ts",
    0,
    undefined,
    [],
    undefined,
    "spend_prompt_after_reward",
  );

  const emotionalSpendProhibited = makeFixture("emotional-spend-prohibited");
  writeFileSync(
    path.join(emotionalSpendProhibited, "product/ONBOARDING.md"),
    ["# Onboarding", "Never show the paywall inside a streak-break grief screen.", "Analytics: streak_celebrated, paywall_viewed."].join("\n"),
    "utf8",
  );
  runFixture(
    "copy that prohibits the spend-near-reward pattern passes",
    emotionalSpendProhibited,
    "check-emotional-design.ts",
    0,
    undefined,
    [],
    undefined,
    "spend_prompt_after_reward",
  );

  // IAP is the guardrail's own spend terminology — it must trip the veto vocabulary.
  const emotionalSpendIap = makeFixture("emotional-spend-iap");
  writeFileSync(
    path.join(emotionalSpendIap, "product/ONBOARDING.md"),
    [
      "# Onboarding",
      "Streak reveal: day 7 celebration with the weekly progress recap.",
      "IAP offer: surface the premium IAP offer right here.",
      "Analytics: streak_celebrated, iap_viewed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "an IAP offer beside a streak moment without stated separation fails",
    emotionalSpendIap,
    "check-emotional-design.ts",
    1,
    "emotional_design.spend_prompt_after_reward",
  );

  // Markdown wrapping must not turn a compliant prohibition into a false veto.
  const emotionalSpendWrappedProhibition = makeFixture("emotional-spend-wrapped-prohibition");
  writeFileSync(
    path.join(emotionalSpendWrappedProhibition, "product/ONBOARDING.md"),
    ["# Onboarding", "Never show the", "paywall inside a streak-break grief screen.", "Analytics: streak_celebrated, paywall_viewed."].join("\n"),
    "utf8",
  );
  runFixture(
    "a prohibition wrapped across two lines still earns its escape",
    emotionalSpendWrappedProhibition,
    "check-emotional-design.ts",
    0,
    undefined,
    [],
    undefined,
    "spend_prompt_after_reward",
  );

  // A separation note for one compliant flow must not bless a different dark flow beside it.
  const emotionalSpendBorrowedProof = makeFixture("emotional-spend-borrowed-proof");
  writeFileSync(
    path.join(emotionalSpendBorrowedProof, "product/ONBOARDING.md"),
    [
      "# Onboarding",
      "Streak recap flow: the weekly recap celebrates the run so far.",
      "Paywall: presented on a separate screen, one interaction after the recap resolves.",
      "Streak-break grief screen: shows the lost streak with the recovery path.",
      "Paywall: present the RevenueCat offering right here on this screen.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "a separation note for one flow does not bless the dark flow beside it",
    emotionalSpendBorrowedProof,
    "check-emotional-design.ts",
    1,
    "emotional_design.spend_prompt_after_reward",
  );

  // The negation must bind to placing the spend surface — an unrelated negation in the same
  // sentence must not ride past the veto.
  const emotionalSpendUnrelatedNegation = makeFixture("emotional-spend-unrelated-negation");
  writeFileSync(
    path.join(emotionalSpendUnrelatedNegation, "product/ONBOARDING.md"),
    ["# Onboarding", "Do not animate the streak; show the paywall on the same screen.", "Analytics: streak_celebrated, paywall_viewed."].join("\n"),
    "utf8",
  );
  runFixture(
    "an unrelated negation does not suppress the spend veto",
    emotionalSpendUnrelatedNegation,
    "check-emotional-design.ts",
    1,
    "emotional_design.spend_prompt_after_reward",
  );

  // "there is no separate screen" is an admission, not separation proof.
  const emotionalSpendNegatedProof = makeFixture("emotional-spend-negated-proof");
  writeFileSync(
    path.join(emotionalSpendNegatedProof, "product/ONBOARDING.md"),
    [
      "# Onboarding",
      "Streak-break grief screen and paywall share one view; there is no separate screen.",
      "Analytics: streak_celebrated, paywall_viewed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "a negated separation phrase does not count as proof",
    emotionalSpendNegatedProof,
    "check-emotional-design.ts",
    1,
    "emotional_design.spend_prompt_after_reward",
  );

  // The prohibitive clause must be the one holding the spend/reward keywords.
  const emotionalSpendOtherClause = makeFixture("emotional-spend-other-clause");
  writeFileSync(
    path.join(emotionalSpendOtherClause, "product/ONBOARDING.md"),
    [
      "# Onboarding",
      "Show the paywall on the streak screen, but do not display an upgrade after dismissal.",
      "Analytics: streak_celebrated, paywall_viewed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "a prohibition in an unrelated clause does not suppress the spend veto",
    emotionalSpendOtherClause,
    "check-emotional-design.ts",
    1,
    "emotional_design.spend_prompt_after_reward",
  );

  // A prohibited clause about a different spend surface must not bless the violating clause.
  const emotionalSpendSecondClause = makeFixture("emotional-spend-second-clause");
  writeFileSync(
    path.join(emotionalSpendSecondClause, "product/ONBOARDING.md"),
    [
      "# Onboarding",
      "Show the paywall on the streak screen, but do not show a purchase offer after dismissal.",
      "Analytics: streak_celebrated, paywall_viewed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "a prohibited second clause with its own spend word does not suppress the veto",
    emotionalSpendSecondClause,
    "check-emotional-design.ts",
    1,
    "emotional_design.spend_prompt_after_reward",
  );

  // Checkout screens are spend surfaces — the guardrail's own vocabulary.
  const emotionalSpendCheckout = makeFixture("emotional-spend-checkout");
  writeFileSync(
    path.join(emotionalSpendCheckout, "product/ONBOARDING.md"),
    ["# Onboarding", "Streak-break grief screen opens Stripe Checkout here.", "Analytics: streak_celebrated."].join("\n"),
    "utf8",
  );
  runFixture(
    "a checkout surface beside a streak moment fails the spend veto",
    emotionalSpendCheckout,
    "check-emotional-design.ts",
    1,
    "emotional_design.spend_prompt_after_reward",
  );

  // Lane deferral skips deliverables, never the ethics veto over copy that already exists.
  const emotionalSpendDeferredLane = makeFixture("emotional-spend-deferred-lane");
  {
    const state = readState(emotionalSpendDeferredLane);
    getLane(state, "emotional_design")["status"] = "deferred";
    writeState(emotionalSpendDeferredLane, state);
  }
  writeFileSync(
    path.join(emotionalSpendDeferredLane, "product/ONBOARDING.md"),
    [
      "# Onboarding",
      "Streak reveal: day 7 celebration with the weekly progress recap.",
      "Paywall: present the RevenueCat offering right here.",
      "Analytics: streak_celebrated, paywall_viewed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "a deferred emotional-design lane still runs the spend veto",
    emotionalSpendDeferredLane,
    "check-emotional-design.ts",
    1,
    "emotional_design.spend_prompt_after_reward",
  );

  const guardrailFixtureHeader = [
    "# Ethics And Dark-Pattern Guardrail",
    "## 1. Bright-Line Vs Dark-Line Distinction",
    "## 2. Regulatory And Platform Landscape",
    "## 3. Per-Mechanism Risk Table",
    "| Mechanism | Risk Tier | Primary Risk | Bright-Line Test | Required Attestation Fields |",
    "|---|---|---|---|---|",
  ];
  const guardrailFixtureFooter = ["## 5. Guardrail Contract", "## 7. Acceptance Checklist"];

  const emotionalTierMismatch = makeFixture("emotional-risk-tier-mismatch");
  {
    const refDir = path.join(emotionalTierMismatch, "knowledge", "experience");
    mkdirSync(refDir, { recursive: true });
    writeFileSync(
      path.join(refDir, "ethics-guardrail.md"),
      [
        ...guardrailFixtureHeader,
        "| Endowed Progress | LOW | Fabricated head start | Progress reflects real inputs | `bright_line` |",
        ...guardrailFixtureFooter,
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      path.join(refDir, "experience-cards.md"),
      [
        "# Experience Cards",
        "## Card Routing",
        "| Card | Load when | Risk | Spec |",
        "|---|---|---|---|",
        "| Endowed Progress | Real prior progress exists to surface | MEDIUM | link |",
      ].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "index risk tier disagreeing with the guardrail table fails",
    emotionalTierMismatch,
    "check-emotional-design.ts",
    1,
    "emotional_design.risk_tier_mismatch",
  );

  const emotionalTierConflict = makeFixture("emotional-risk-tier-conflict");
  {
    const refDir = path.join(emotionalTierConflict, "knowledge", "experience");
    mkdirSync(refDir, { recursive: true });
    writeFileSync(
      path.join(refDir, "ethics-guardrail.md"),
      [
        ...guardrailFixtureHeader,
        "| Intent Mirroring | MEDIUM | Retention friction on cancel | Never on cancel/downgrade | `bright_line` |",
        "| Intent Mirroring | LOW-MEDIUM | Cancellation friction disguised as confirmation | Pause serves the user | `bright_line` |",
        ...guardrailFixtureFooter,
      ].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "duplicate risk-table rows with disagreeing tiers fail",
    emotionalTierConflict,
    "check-emotional-design.ts",
    1,
    "emotional_design.risk_tier_conflict",
  );

  const emotionalTierDuplicate = makeFixture("emotional-risk-tier-duplicate");
  {
    const refDir = path.join(emotionalTierDuplicate, "knowledge", "experience");
    mkdirSync(refDir, { recursive: true });
    writeFileSync(
      path.join(refDir, "ethics-guardrail.md"),
      [
        ...guardrailFixtureHeader,
        "| Endowed Progress | LOW | Fabricated head start | Progress reflects real inputs | `bright_line`, `posthog_event` |",
        "| Endowed Progress | LOW | Manufactured progress on fake tasks | Starting progress reflects real investment | `bright_line` |",
        ...guardrailFixtureFooter,
      ].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "duplicate risk-table rows with agreeing tiers fail",
    emotionalTierDuplicate,
    "check-emotional-design.ts",
    1,
    "emotional_design.risk_tier_duplicate_row",
  );

  const emotionalTierTypo = makeFixture("emotional-risk-tier-typo");
  {
    const refDir = path.join(emotionalTierTypo, "knowledge", "experience");
    mkdirSync(refDir, { recursive: true });
    writeFileSync(
      path.join(refDir, "ethics-guardrail.md"),
      [
        ...guardrailFixtureHeader,
        "| Endowed Progress | MEDUM | Fabricated head start | Progress reflects real inputs | `bright_line` |",
        ...guardrailFixtureFooter,
      ].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "a misspelled risk tier fails instead of silently dropping the row",
    emotionalTierTypo,
    "check-emotional-design.ts",
    1,
    "emotional_design.risk_tier_unrecognized",
  );

  // A blank line mid-table must not silently drop the rows below it from parity.
  const emotionalTierInterrupted = makeFixture("emotional-risk-tier-interrupted");
  {
    const refDir = path.join(emotionalTierInterrupted, "knowledge", "experience");
    mkdirSync(refDir, { recursive: true });
    writeFileSync(
      path.join(refDir, "ethics-guardrail.md"),
      [
        ...guardrailFixtureHeader,
        "| Endowed Progress | LOW | Fabricated head start | Progress reflects real inputs | `bright_line`, `posthog_event` |",
        "",
        "| Endowed Progress | LOW | Manufactured progress on fake tasks | Starting progress reflects real investment | `bright_line` |",
        ...guardrailFixtureFooter,
      ].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "rows below a mid-table interruption still reach the parity gate",
    emotionalTierInterrupted,
    "check-emotional-design.ts",
    1,
    "emotional_design.risk_tier_duplicate_row",
  );

  // A placeholder tier is legitimate only on the motion-fallback row.
  const emotionalTierPlaceholderAbuse = makeFixture("emotional-risk-tier-placeholder-abuse");
  {
    const refDir = path.join(emotionalTierPlaceholderAbuse, "knowledge", "experience");
    mkdirSync(refDir, { recursive: true });
    writeFileSync(
      path.join(refDir, "ethics-guardrail.md"),
      [
        ...guardrailFixtureHeader,
        "| Endowed Progress | — | Fabricated head start | Progress reflects real inputs | `bright_line` |",
        ...guardrailFixtureFooter,
      ].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "a placeholder tier on a canonical mechanism fails",
    emotionalTierPlaceholderAbuse,
    "check-emotional-design.ts",
    1,
    "emotional_design.risk_tier_unrecognized",
  );

  // A descending or multi-endpoint range must be malformed, not laundered into a
  // permissive full range by min/max.
  const emotionalTierDescendingRange = makeFixture("emotional-risk-tier-descending-range");
  {
    const refDir = path.join(emotionalTierDescendingRange, "knowledge", "experience");
    mkdirSync(refDir, { recursive: true });
    writeFileSync(
      path.join(refDir, "ethics-guardrail.md"),
      [
        ...guardrailFixtureHeader,
        "| Endowed Progress | HIGH-LOW | Fabricated head start | Progress reflects real inputs | `bright_line` |",
        ...guardrailFixtureFooter,
      ].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "a descending risk-tier range fails instead of expanding to all tiers",
    emotionalTierDescendingRange,
    "check-emotional-design.ts",
    1,
    "emotional_design.risk_tier_unrecognized",
  );

  // The placeholder allowance identifies the motion-fallback row by its full normalized
  // name — the word "motion" inside an unrelated row name earns no exemption.
  const emotionalTierMotionWordAbuse = makeFixture("emotional-risk-tier-motion-word-abuse");
  {
    const refDir = path.join(emotionalTierMotionWordAbuse, "knowledge", "experience");
    mkdirSync(refDir, { recursive: true });
    writeFileSync(
      path.join(refDir, "ethics-guardrail.md"),
      [...guardrailFixtureHeader, "| Variable Reward Motion | — | Compulsion loop | User can always stop | `bright_line` |", ...guardrailFixtureFooter].join(
        "\n",
      ),
      "utf8",
    );
  }
  runFixture(
    "a placeholder tier on a non-fallback row containing the word motion fails",
    emotionalTierMotionWordAbuse,
    "check-emotional-design.ts",
    1,
    "emotional_design.risk_tier_unrecognized",
  );

  // Equal-tier duplicates across bucket rows are still duplicate assignments.
  const emotionalTierBucketDuplicate = makeFixture("emotional-risk-tier-bucket-duplicate");
  {
    const refDir = path.join(emotionalTierBucketDuplicate, "knowledge", "experience");
    mkdirSync(refDir, { recursive: true });
    writeFileSync(
      path.join(refDir, "ethics-guardrail.md"),
      [
        ...guardrailFixtureHeader,
        "| All other deck cards (Reciprocity, Fresh Start) | LOW–MEDIUM | Card-specific | The card's own bright-line test | base fields |",
        "| All other deck cards (Reciprocity) | LOW–MEDIUM | Card-specific | The card's own bright-line test | base fields |",
        ...guardrailFixtureFooter,
      ].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "the same member in two equal-tier bucket rows fails as a duplicate",
    emotionalTierBucketDuplicate,
    "check-emotional-design.ts",
    1,
    "emotional_design.risk_tier_duplicate_row",
  );

  // An explicit row may narrow a bucket range but must not contradict it.
  const emotionalTierBucketConflict = makeFixture("emotional-risk-tier-bucket-conflict");
  {
    const refDir = path.join(emotionalTierBucketConflict, "knowledge", "experience");
    mkdirSync(refDir, { recursive: true });
    writeFileSync(
      path.join(refDir, "ethics-guardrail.md"),
      [
        ...guardrailFixtureHeader,
        "| All other deck cards (Rating Prompt) | LOW–MEDIUM | Card-specific | The card's own bright-line test | base fields |",
        "| Rating Prompt | HIGH | Platform policy violation | Native API only | `bright_line`, `platform_api_used` |",
        ...guardrailFixtureFooter,
      ].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "an explicit row contradicting its bucket range fails",
    emotionalTierBucketConflict,
    "check-emotional-design.ts",
    1,
    "emotional_design.risk_tier_conflict",
  );

  // A row that lost its leading pipe is a broken row, not prose.
  const emotionalTierBrokenRow = makeFixture("emotional-risk-tier-broken-row");
  {
    const refDir = path.join(emotionalTierBrokenRow, "knowledge", "experience");
    mkdirSync(refDir, { recursive: true });
    writeFileSync(
      path.join(refDir, "ethics-guardrail.md"),
      [
        ...guardrailFixtureHeader,
        "| Variable Reward | HIGH | Compulsion loop | User can always stop | `bright_line` |",
        "Endowed Progress | HIGH | Fabricated head start | Progress reflects real inputs | `bright_line` |",
        ...guardrailFixtureFooter,
      ].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "a risk row missing its leading pipe fails instead of vanishing",
    emotionalTierBrokenRow,
    "check-emotional-design.ts",
    1,
    "emotional_design.risk_table_malformed_row",
  );

  // An ordered range spans its intermediate tiers: LOW-HIGH admits MEDIUM.
  const emotionalTierRangeSpan = makeFixture("emotional-risk-tier-range-span");
  {
    const refDir = path.join(emotionalTierRangeSpan, "knowledge", "experience");
    mkdirSync(refDir, { recursive: true });
    writeFileSync(
      path.join(refDir, "ethics-guardrail.md"),
      [
        ...guardrailFixtureHeader,
        "| Endowed Progress | LOW–HIGH | Fabricated head start | Progress reflects real inputs | `bright_line` |",
        ...guardrailFixtureFooter,
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      path.join(refDir, "experience-cards.md"),
      [
        "# Experience Cards",
        "## Card Routing",
        "| Card | Load when | Risk | Spec |",
        "|---|---|---|---|",
        "| Endowed Progress | Real prior progress exists to surface | MEDIUM | link |",
      ].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "an index tier inside an ordered guardrail range passes",
    emotionalTierRangeSpan,
    "check-emotional-design.ts",
    0,
    undefined,
    [],
    undefined,
    "risk_tier_mismatch",
  );

  // "Emotional Commitment" contains "motion" only as a substring — no placeholder pass.
  const emotionalTierMotionSubstring = makeFixture("emotional-risk-tier-motion-substring");
  {
    const refDir = path.join(emotionalTierMotionSubstring, "knowledge", "experience");
    mkdirSync(refDir, { recursive: true });
    writeFileSync(
      path.join(refDir, "ethics-guardrail.md"),
      [...guardrailFixtureHeader, "| Emotional Commitment | — | Confirmshaming | Exit path is frictionless | `bright_line` |", ...guardrailFixtureFooter].join(
        "\n",
      ),
      "utf8",
    );
  }
  runFixture(
    "a motion substring in the name does not license a placeholder tier",
    emotionalTierMotionSubstring,
    "check-emotional-design.ts",
    1,
    "emotional_design.risk_tier_unrecognized",
  );

  // A misspelled index card name must not silently skip parity.
  const emotionalTierNameDrift = makeFixture("emotional-risk-tier-name-drift");
  {
    const refDir = path.join(emotionalTierNameDrift, "knowledge", "experience");
    mkdirSync(refDir, { recursive: true });
    writeFileSync(
      path.join(refDir, "ethics-guardrail.md"),
      [
        ...guardrailFixtureHeader,
        "| Endowed Progress | LOW | Fabricated head start | Progress reflects real inputs | `bright_line` |",
        ...guardrailFixtureFooter,
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      path.join(refDir, "experience-cards.md"),
      [
        "# Experience Cards",
        "## Card Routing",
        "| Card | Load when | Risk | Spec |",
        "|---|---|---|---|",
        "| Endowed Progres | Real prior progress exists to surface | MEDIUM | link |",
      ].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "a drifted index card name fails instead of skipping parity",
    emotionalTierNameDrift,
    "check-emotional-design.ts",
    1,
    "emotional_design.risk_tier_unmapped_card",
  );

  // A truncated index name cannot inherit a canonical tier by prefix.
  const emotionalTierTruncatedName = makeFixture("emotional-risk-tier-truncated-name");
  {
    const refDir = path.join(emotionalTierTruncatedName, "knowledge", "experience");
    mkdirSync(refDir, { recursive: true });
    writeFileSync(
      path.join(refDir, "ethics-guardrail.md"),
      [
        ...guardrailFixtureHeader,
        "| Endowed Progress | LOW | Fabricated head start | Progress reflects real inputs | `bright_line` |",
        ...guardrailFixtureFooter,
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      path.join(refDir, "experience-cards.md"),
      [
        "# Experience Cards",
        "## Card Routing",
        "| Card | Load when | Risk | Spec |",
        "|---|---|---|---|",
        "| Endowed | Real prior progress exists | LOW | link |",
      ].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "a truncated index card name fails instead of inheriting a tier",
    emotionalTierTruncatedName,
    "check-emotional-design.ts",
    1,
    "emotional_design.risk_tier_unmapped_card",
  );

  // Deleting canonical cards from the index must not pass on the survivor.
  const emotionalTierIndexTruncated = makeFixture("emotional-risk-tier-index-truncated");
  {
    const refDir = path.join(emotionalTierIndexTruncated, "knowledge", "experience");
    mkdirSync(refDir, { recursive: true });
    writeFileSync(
      path.join(refDir, "ethics-guardrail.md"),
      [
        ...guardrailFixtureHeader,
        "| Variable Reward | HIGH | Compulsion loop | User can always stop | `bright_line` |",
        "| Endowed Progress | LOW | Fabricated head start | Progress reflects real inputs | `bright_line` |",
        ...guardrailFixtureFooter,
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      path.join(refDir, "experience-cards.md"),
      [
        "# Experience Cards",
        "## Card Routing",
        "| Card | Load when | Risk | Spec |",
        "|---|---|---|---|",
        "| Variable Reward | An outcome genuinely varies | HIGH | link |",
      ].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "an index missing a canonical tiered card fails reverse coverage",
    emotionalTierIndexTruncated,
    "check-emotional-design.ts",
    1,
    "emotional_design.risk_tier_index_missing_card",
  );

  // The routing index must not retain two Risk values for one card.
  const emotionalTierIndexDuplicate = makeFixture("emotional-risk-tier-index-duplicate");
  {
    const refDir = path.join(emotionalTierIndexDuplicate, "knowledge", "experience");
    mkdirSync(refDir, { recursive: true });
    writeFileSync(
      path.join(refDir, "ethics-guardrail.md"),
      [
        ...guardrailFixtureHeader,
        "| All other deck cards (Reciprocity) | LOW–MEDIUM | Card-specific | The card's own bright-line test | base fields |",
        ...guardrailFixtureFooter,
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      path.join(refDir, "experience-cards.md"),
      [
        "# Experience Cards",
        "## Card Routing",
        "| Card | Load when | Risk | Spec |",
        "|---|---|---|---|",
        "| Reciprocity | An unprompted, real gift can precede any ask | LOW | link |",
        "| Reciprocity | An unprompted, real gift can precede any ask | MEDIUM | link |",
      ].join("\n"),
      "utf8",
    );
  }
  runFixture(
    "duplicate routing rows for one card fail even inside a bucket range",
    emotionalTierIndexDuplicate,
    "check-emotional-design.ts",
    1,
    "emotional_design.risk_tier_duplicate_row",
  );

  /**
   * The third leg of the tier triangle: the card stubs. The index and the guardrail table
   * have been checked against each other since v0.45.0, but each stub declares its own
   * "**Risk tier.**" line and nothing read it. check:founder-copy now derives the HIGH set
   * from those lines to decide which technique names a founder attests to by name, so an
   * unchecked stub tier is a forgeable input to a consent surface.
   */
  function writeCardDeck(name: string, indexRows: string[], stubs: { file: string; heading: string; tier: string }[]): string {
    const root = makeFixture(name);
    const refDir = path.join(root, "knowledge", "experience");
    mkdirSync(path.join(refDir, "experience-cards"), { recursive: true });
    writeFileSync(
      path.join(refDir, "ethics-guardrail.md"),
      [
        ...guardrailFixtureHeader,
        "| Variable Reward | HIGH | Compulsion loop | User can always stop | `bright_line` |",
        "| Endowed Progress | LOW | Fabricated head start | Progress reflects real inputs | `bright_line` |",
        ...guardrailFixtureFooter,
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      path.join(refDir, "experience-cards.md"),
      ["# Experience Cards", "## Card Routing", "| Card | Load when | Risk | Spec |", "|---|---|---|---|", ...indexRows].join("\n"),
      "utf8",
    );
    for (const stub of stubs) {
      writeFileSync(
        path.join(refDir, "experience-cards", stub.file),
        [`# ${stub.heading} Card`, "", `**Risk tier.** ${stub.tier} — canonical in the routing table.`, ""].join("\n"),
        "utf8",
      );
    }
    return root;
  }

  const variableRewardRow = "| Variable Reward | An outcome genuinely varies | HIGH | link |";
  const endowedRow = "| Endowed Progress | Real prior progress exists to surface | LOW | link |";

  runFixture(
    "stub tiers agreeing with the routing index pass",
    writeCardDeck(
      "emotional-card-stub-clean",
      [variableRewardRow, endowedRow],
      [
        { file: "variable-reward-card.md", heading: "Variable Reward", tier: "HIGH" },
        { file: "endowed-progress-card.md", heading: "Endowed Progress", tier: "LOW" },
      ],
    ),
    "check-emotional-design.ts",
    0,
    undefined,
    [],
    undefined,
    "card_stub",
  );

  runFixture(
    "a stub tier disagreeing with its routing row fails",
    writeCardDeck("emotional-card-stub-mismatch", [variableRewardRow], [{ file: "variable-reward-card.md", heading: "Variable Reward", tier: "MEDIUM" }]),
    "check-emotional-design.ts",
    1,
    "emotional_design.card_stub_tier_mismatch",
  );

  // An unparseable tier line drops the card out of parity AND out of the attestation set,
  // so it must fail rather than skip — the same reasoning as risk_tier_unrecognized.
  runFixture(
    "a stub with no parseable risk tier fails instead of skipping",
    writeCardDeck("emotional-card-stub-no-tier", [variableRewardRow], [{ file: "variable-reward-card.md", heading: "Variable Reward", tier: "SEVERE" }]),
    "check-emotional-design.ts",
    1,
    "emotional_design.card_stub_tier_unrecognized",
  );

  // A stub nobody routes still contributes its tier to the HIGH set.
  runFixture(
    "a stub with no routing row fails",
    writeCardDeck(
      "emotional-card-stub-unrouted",
      [variableRewardRow],
      [
        { file: "variable-reward-card.md", heading: "Variable Reward", tier: "HIGH" },
        { file: "invented-mechanic-card.md", heading: "Invented Mechanic", tier: "HIGH" },
      ],
    ),
    "check-emotional-design.ts",
    1,
    "emotional_design.card_stub_unmapped",
  );

  // Deleting a stub must not silently shrink the deck the founder attests against.
  runFixture(
    "a routed card with no stub file fails reverse coverage",
    writeCardDeck(
      "emotional-card-stub-deleted",
      [variableRewardRow, endowedRow],
      [{ file: "variable-reward-card.md", heading: "Variable Reward", tier: "HIGH" }],
    ),
    "check-emotional-design.ts",
    1,
    "emotional_design.card_stub_missing",
  );

  // --- check-vibecoded-tells ---------------------------------------------------------------

  // Negative control: the shipped section library is deliberately clean of every mechanical
  // tell, so the untouched template must produce zero findings — a false positive here would
  // put permanent noise on every audit run.
  runFixture(
    "clean landing template carries no vibecoded tells",
    makeFixture("vibecode-clean"),
    "check-vibecoded-tells.ts",
    0,
    undefined,
    [],
    undefined,
    "vibecode.",
  );

  const vibecodeIconPack = makeFixture("vibecode-icon-pack");
  writeFileSync(
    path.join(vibecodeIconPack, "growth", "landing", "sections", "IconBar.tsx"),
    'import { Sparkles } from "lucide-react";\nexport function IconBar() {\n  return <Sparkles />;\n}\n',
    "utf8",
  );
  runFixture("default icon pack import fails the gate", vibecodeIconPack, "check-vibecoded-tells.ts", 1, "vibecode.default_icon_pack");

  // A site-shaped landing (index.html present) owes the Tier 1 legal links.
  const vibecodeNoLegal = makeFixture("vibecode-no-legal");
  writeFileSync(
    path.join(vibecodeNoLegal, "growth", "landing", "index.html"),
    '<main><h1>Launch</h1><footer><a href="/about">About</a></footer></main>\n',
    "utf8",
  );
  runFixture("site-shaped landing without terms/privacy links fails", vibecodeNoLegal, "check-vibecoded-tells.ts", 1, "vibecode.legal_links_missing");

  // The same site shape with both links passes — the scope check must not demand legal pages
  // from the bare section component library.
  const vibecodeLegalOk = makeFixture("vibecode-legal-ok");
  writeFileSync(
    path.join(vibecodeLegalOk, "growth", "landing", "index.html"),
    '<main><h1>Launch</h1><footer><a href="/terms">Terms</a><a href="/privacy">Privacy</a></footer></main>\n',
    "utf8",
  );
  runFixture("site-shaped landing with legal links passes", vibecodeLegalOk, "check-vibecoded-tells.ts", 0);

  // Tier 2 default tells surface as warnings — visible, exit 0 — per the reference's scoring
  // rule: a warning demands a derivation row, it does not block the build on its own.
  const vibecodeWarningTier = makeFixture("vibecode-warning-tier");
  writeFileSync(
    path.join(vibecodeWarningTier, "growth", "landing", "sections", "Glass.tsx"),
    'export function Glass() {\n  return <div className="backdrop-blur-md">glass panel</div>;\n}\n',
    "utf8",
  );
  runFixture("warning-tier tell reports without failing", vibecodeWarningTier, "check-vibecoded-tells.ts", 0, "vibecode.glassmorphism");

  // --- check-scrollytelling-contract ------------------------------------------------------

  const validScrollySource = `
import { useReducedMotion } from "motion/react";
export function Story() {
  const reduced = useReducedMotion();
  const anchor = document.querySelector("[data-scrolly-step]")?.getBoundingClientRect();
  const style = { "--scene-p": 0.5, "--beat-t": 0.25, "--beat-index": 1 };
  return <section style={style} data-scene-id="response" data-state-id="response-ready">
    <ol><li data-scrolly-step="response">The complete static story remains visible.</li></ol>
    <span>{String(reduced)} {String(anchor)}</span>
  </section>;
}
`;

  const localizedTextDigest = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

  function validScrollyContract(): Record<string, unknown> {
    const scene = (id: string, guide: number): Record<string, unknown> => ({
      id,
      narrative_roles: ["need", "mechanism", "proof"],
      states: [`${id}-need`, `${id}-mechanism`, `${id}-proof`],
      visual_job: `Show the evidence-bearing ${id} state and its relationship to the next beat.`,
      source_kind: "html",
      evidence_id: `evidence-${id}`,
      localizations: ["en-US", "es-US"].map((locale) => {
        const captionText = locale === "en-US" ? `Caption for ${id}.` : `Leyenda para ${id}.`;
        const descriptionText = locale === "en-US" ? `Description of the ${id} evidence and change.` : `Descripción de la evidencia y el cambio de ${id}.`;
        return {
          locale,
          beats: [`${id}-need`, `${id}-mechanism`, `${id}-proof`].map((stateId) => {
            const text = locale === "en-US" ? `Copy for ${id}, state ${stateId}.` : `Texto para ${id}, estado ${stateId}.`;
            return {
              state_id: stateId,
              text,
              copy_key: `landing.story.${id}.${stateId}.${locale}`,
              copy_sha256: localizedTextDigest(text),
            };
          }),
          caption: {
            text: captionText,
            copy_key: `landing.story.${id}.caption.${locale}`,
            copy_sha256: localizedTextDigest(captionText),
          },
          accessible_description: {
            text: descriptionText,
            copy_key: `landing.story.${id}.accessible_description.${locale}`,
            copy_sha256: localizedTextDigest(descriptionText),
          },
        };
      }),
      activation_guides: { desktop: guide, mobile: guide + 0.2, short_mobile: guide + 0.35 },
      modes: { mobile: "recomposed", reduced_motion: "final", no_js: "final", save_data: "code-native" },
      forward_reverse: true,
    });
    const scenes = [scene("need", 0.15), scene("response", 0.5)];
    const qa: Array<Record<string, unknown>> = [];
    for (const row of scenes) {
      const id = String(row.id);
      const states = row.states as string[];
      for (const locale of ["en-US", "es-US"]) {
        for (const [stateIndex, state] of states.entries()) {
          for (const direction of ["forward", "reverse"]) {
            const browser = direction === "reverse" ? "Chrome" : (["Chrome", "Safari", "Firefox"][stateIndex] ?? "Chrome");
            const platform = browser === "Firefox" ? "Windows 11" : "macOS 15";
            const viewport = browser === "Safari" ? "desktop 1024x768" : browser === "Firefox" ? "desktop 1366x768" : "desktop 1440x900";
            qa.push({
              viewport,
              browser,
              platform,
              mode: "default",
              locale,
              direction,
              scene_id: id,
              expected_state: state,
              result: "pass",
              evidence: `growth/landing/evidence/browser-matrix.md#${id}-${locale}-${state}-${direction}`,
            });
          }
        }
        qa.push({
          viewport: "mobile 390x844",
          browser: "Chrome",
          platform: "Android 16",
          mode: "default",
          locale,
          direction: "jump",
          scene_id: id,
          expected_state: states[1],
          result: "pass",
          evidence: `growth/landing/evidence/browser-matrix.md#${id}-${locale}-jump`,
        });
        for (const [mode, viewport, browser, platform] of [
          ["short_mobile", "short-mobile 667x375", "Safari", "iOS 19"],
          ["reduced_motion", "mobile 390x844", "Chrome", "Android 16"],
          ["no_js", "desktop 1440x900", "Firefox", "Linux"],
          ["save_data", "mobile 390x844", "Chrome", "Android 16"],
        ] as const) {
          qa.push({
            viewport,
            browser,
            platform,
            mode,
            locale,
            direction: "jump",
            scene_id: id,
            expected_state: states.at(-1),
            result: "pass",
            evidence: `growth/landing/evidence/browser-matrix.md#${id}-${locale}-${mode}`,
          });
        }
      }
    }
    const matrixScene = String(scenes[0]!.id);
    const matrixState = (scenes[0]!.states as string[]).at(-1);
    for (const [browser, platform] of [
      ["Chrome", "macOS 15"],
      ["Safari", "macOS 15"],
      ["Firefox", "Windows 11"],
    ] as const) {
      for (const viewport of ["desktop 1280x720", "desktop 1440x1000"]) {
        qa.push({
          viewport,
          browser,
          platform,
          mode: "default",
          locale: "en-US",
          direction: "jump",
          scene_id: matrixScene,
          expected_state: matrixState,
          result: "pass",
          evidence: `growth/landing/evidence/browser-matrix.md#${browser.toLowerCase()}-${viewport.replaceAll(" ", "-")}`,
        });
      }
    }
    for (const [browser, platform] of [
      ["Safari", "iOS 19"],
      ["Chrome", "Android 16"],
    ] as const) {
      for (const [mode, viewport] of [
        ["short_mobile", "mobile 390x568"],
        ["default", "mobile 390x844"],
      ] as const) {
        qa.push({
          viewport,
          browser,
          platform,
          mode,
          locale: "en-US",
          direction: "jump",
          scene_id: matrixScene,
          expected_state: matrixState,
          result: "pass",
          evidence: `growth/landing/evidence/browser-matrix.md#${platform.toLowerCase().replaceAll(" ", "-")}-${mode}`,
        });
      }
    }
    return {
      locales: [
        { locale: "en-US", evidence: "growth/landing/evidence/en-US/" },
        { locale: "es-US", evidence: "growth/landing/evidence/es-US/" },
      ],
      scrollytelling: {
        applicable: true,
        evidence: "growth/landing/evidence/scrollytelling-contract.md#decision",
        locales: ["en-US", "es-US"],
        scenes,
        qa,
      },
    };
  }

  function writeScrollyFixture(name: string, mutate?: (contract: Record<string, unknown>) => void, source = validScrollySource): string {
    const root = makeEmptyFixture(name);
    const appDir = path.join(root, "growth/landing/app");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(path.join(appDir, "ScrollyStory.tsx"), source, "utf8");
    const evidenceDir = path.join(root, "growth/landing/evidence");
    mkdirSync(evidenceDir, { recursive: true });
    const contract = validScrollyContract();
    const baselineScrolly = expectRecord(contract.scrollytelling, "scrollytelling");
    const baselineFragments = new Set(
      (baselineScrolly.qa as Array<Record<string, unknown>>)
        .map((row) => String(row.evidence).split("#")[1])
        .filter((fragment): fragment is string => Boolean(fragment)),
    );
    writeFileSync(
      path.join(evidenceDir, "scrollytelling-contract.md"),
      "# Scrollytelling contract\n\n## Decision\n\nThe evidence supports a sequence.\n",
      "utf8",
    );
    writeFileSync(
      path.join(evidenceDir, "browser-matrix.md"),
      `# Browser matrix\n\n${[...baselineFragments].map((fragment) => `<a id="${fragment}"></a>`).join("\n")}\n`,
      "utf8",
    );
    mutate?.(contract);
    writeFileSync(path.join(root, "growth/landing/surface-contract.json"), `${JSON.stringify(contract, null, 2)}\n`, "utf8");
    return root;
  }

  interface ScrollyContentAssetSpec {
    assetId: string;
    kind: "image" | "video";
    status?: string;
    writeOutput?: boolean;
    overrides?: Record<string, unknown>;
  }

  function writeScrollyContentAssetManifest(root: string, specs: ScrollyContentAssetSpec[]): void {
    const manifestDir = path.join(root, "growth/content-assets");
    const outputDir = path.join(manifestDir, "out");
    mkdirSync(outputDir, { recursive: true });
    const input = "growth/landing/surface-contract.json";
    const inputDigest = createHash("sha256")
      .update(readFileSync(path.join(root, input)))
      .digest("hex");
    const assets = specs.map((spec) => {
      const extension = spec.kind === "video" ? "mp4" : "webp";
      const output = `growth/content-assets/out/${spec.assetId}.${extension}`;
      if (spec.writeOutput !== false) {
        writeFileSync(path.join(root, output), `fixture ${spec.kind} output for ${spec.assetId}\n`, "utf8");
      }
      return {
        asset_id: spec.assetId,
        surface: "landing_scrollytelling",
        route: spec.kind === "video" ? "founder_owned_recording" : "authored_still",
        status: spec.status ?? "approved",
        composition_id: `Scrolly${spec.kind === "video" ? "Video" : "Still"}`,
        dimensions: spec.kind === "video" ? "1920x1080" : "1280x720",
        ...(spec.kind === "video" ? { duration_seconds: 12, asset_kind: "demo" } : {}),
        inputs: [input],
        input_digests: { [input]: inputDigest },
        outputs: [output],
        truth_constraints: ["The approved output supports only the scene narrative recorded in the landing contract."],
        approvals: ["Founder approved this fixture asset for landing use."],
        render_proof: `Authored fixture output: ${output}`,
        license_status: "Rights cleared for approved fixture use.",
        ...spec.overrides,
      };
    });
    writeFileSync(path.join(manifestDir, "manifest.json"), `${JSON.stringify({ schema_version: "1", assets }, null, 2)}\n`, "utf8");
  }

  function writeScrollyMediaFixture(name: string, mutate: (contract: Record<string, unknown>) => void, assets: ScrollyContentAssetSpec[]): string {
    const root = writeScrollyFixture(name, mutate);
    writeScrollyContentAssetManifest(root, assets);
    return root;
  }

  runFixture("complete scrollytelling contract and source hooks pass", writeScrollyFixture("scrolly-complete"), "check-scrollytelling-contract.ts", 0);

  runFixture(
    "a bare shipped section library does not require an active surface contract",
    makeFixture("scrolly-inactive-library"),
    "check-scrollytelling-contract.ts",
    0,
  );

  const scrollyMissingContract = makeEmptyFixture("scrolly-surface-contract-missing");
  mkdirSync(path.join(scrollyMissingContract, "growth/landing/app"), { recursive: true });
  writeFileSync(path.join(scrollyMissingContract, "growth/landing/app/ScrollyStory.tsx"), validScrollySource, "utf8");
  runFixture(
    "active scrollytelling source without a surface contract fails",
    scrollyMissingContract,
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.business.surface_contract_missing",
  );

  const scrollyDeclarationMissing = makeEmptyFixture("scrolly-declaration-missing");
  mkdirSync(path.join(scrollyDeclarationMissing, "growth/landing"), { recursive: true });
  writeFileSync(path.join(scrollyDeclarationMissing, "growth/landing/index.html"), "<main><h1>Active landing</h1></main>\n", "utf8");
  writeFileSync(path.join(scrollyDeclarationMissing, "growth/landing/surface-contract.json"), '{"locales":[]}\n', "utf8");
  runFixture(
    "every active landing surface contract declares scrollytelling applicability",
    scrollyDeclarationMissing,
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.business.declaration_missing",
  );

  runFixture(
    "duplicate scene IDs fail while state IDs may recur across scenes",
    writeScrollyFixture("scrolly-duplicate-ids", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      const scenes = scrolly.scenes as Array<Record<string, unknown>>;
      scenes[1]!.id = scenes[0]!.id;
      scenes[1]!.states = scenes[0]!.states;
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.scene_id.duplicate",
  );

  runFixture(
    "contract slugs reject digit-leading IDs before SSR does",
    writeScrollyFixture("scrolly-digit-leading-scene-id", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      const scenes = scrolly.scenes as Array<Record<string, unknown>>;
      scenes[0]!.id = "1-need";
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.scene_id.invalid",
  );

  runFixture(
    "stable state IDs may recur in different scenes",
    writeScrollyFixture("scrolly-state-ids-recur", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      const scenes = scrolly.scenes as Array<Record<string, unknown>>;
      scenes[1]!.states = scenes[0]!.states;
      for (const localization of scenes[1]!.localizations as Array<Record<string, unknown>>) {
        for (const beat of localization.beats as Array<Record<string, unknown>>) {
          beat.state_id = String(beat.state_id).replace(/^response-/u, "need-");
        }
      }
      for (const row of scrolly.qa as Array<Record<string, unknown>>) {
        if (row.scene_id === "response") row.expected_state = String(row.expected_state).replace(/^response-/u, "need-");
      }
    }),
    "check-scrollytelling-contract.ts",
    0,
  );

  runFixture(
    "out-of-order narrative roles fail",
    writeScrollyFixture("scrolly-role-order", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      const scenes = scrolly.scenes as Array<Record<string, unknown>>;
      scenes[0]!.narrative_roles = ["proof", "mechanism", "need"];
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.narrative_sequence.out_of_order",
  );

  runFixture(
    "narrative roles and visual states must map one to one",
    writeScrollyFixture("scrolly-role-state-count", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      const scenes = scrolly.scenes as Array<Record<string, unknown>>;
      scenes[0]!.narrative_roles = ["need", "mechanism", "outcome", "proof"];
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.role_state_count_mismatch",
  );

  runFixture(
    "responsive activation guides cannot all reuse the desktop value",
    writeScrollyFixture("scrolly-activation-guides-uniform", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      const scenes = scrolly.scenes as Array<Record<string, unknown>>;
      scenes[0]!.activation_guides = { desktop: 0.5, mobile: 0.5, short_mobile: 0.5 };
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.activation_guides.responsive_authorship_missing",
  );

  runFixture(
    "short-mobile activation is independently authored",
    writeScrollyFixture("scrolly-short-mobile-guide-reused", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      const scenes = scrolly.scenes as Array<Record<string, unknown>>;
      scenes[0]!.activation_guides = { desktop: 0.5, mobile: 0.7, short_mobile: 0.7 };
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.activation_guides.short_mobile_not_distinct",
  );

  runFixture(
    "an active contract cannot claim bidirectional completion with a false proof flag",
    writeScrollyFixture("scrolly-forward-reverse-unverified", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      const scenes = scrolly.scenes as Array<Record<string, unknown>>;
      scenes[0]!.forward_reverse = false;
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.forward_reverse.missing",
  );

  runFixture(
    "every scene carries exactly one localization row per locale",
    writeScrollyFixture("scrolly-localization-coverage", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      const scenes = scrolly.scenes as Array<Record<string, unknown>>;
      (scenes[0]!.localizations as Array<Record<string, unknown>>).pop();
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.localization.locale_coverage",
  );

  runFixture(
    "localized beats must preserve scene state order",
    writeScrollyFixture("scrolly-localization-beat-order", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      const scenes = scrolly.scenes as Array<Record<string, unknown>>;
      const localizations = scenes[0]!.localizations as Array<Record<string, unknown>>;
      (localizations[0]!.beats as Array<Record<string, unknown>>).reverse();
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.localization.beat_state_order_mismatch",
  );

  runFixture(
    "active localized copy cannot keep a zero digest",
    writeScrollyFixture("scrolly-localization-placeholder-digest", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      const scenes = scrolly.scenes as Array<Record<string, unknown>>;
      const localizations = scenes[0]!.localizations as Array<Record<string, unknown>>;
      const beats = localizations[0]!.beats as Array<Record<string, unknown>>;
      beats[0]!.copy_sha256 = "0".repeat(64);
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.scene.0.localization.0.beat.0.copy_sha256.placeholder",
  );

  runFixture(
    "every localized beat carries the exact rendered text",
    writeScrollyFixture("scrolly-localization-beat-text-missing", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      const scenes = scrolly.scenes as Array<Record<string, unknown>>;
      const localizations = scenes[0]!.localizations as Array<Record<string, unknown>>;
      const beats = localizations[0]!.beats as Array<Record<string, unknown>>;
      delete beats[0]!.text;
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.scene.0.localization.0.beat.0.text.missing",
  );

  runFixture(
    "localized beat digests hash their exact rendered text",
    writeScrollyFixture("scrolly-localization-beat-digest-mismatch", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      const scenes = scrolly.scenes as Array<Record<string, unknown>>;
      const localizations = scenes[0]!.localizations as Array<Record<string, unknown>>;
      const beats = localizations[0]!.beats as Array<Record<string, unknown>>;
      beats[0]!.text = `${String(beats[0]!.text)} Changed after hashing.`;
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.localization.copy_digest_mismatch",
  );

  runFixture(
    "localized caption and description digests hash their exact text",
    writeScrollyFixture("scrolly-localization-text-digest-mismatch", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      const scenes = scrolly.scenes as Array<Record<string, unknown>>;
      const localizations = scenes[0]!.localizations as Array<Record<string, unknown>>;
      const caption = expectRecord(localizations[0]!.caption, "caption");
      caption.text = `${String(caption.text)} Changed after hashing.`;
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.localization.copy_digest_mismatch",
  );

  runFixture(
    "heavy narrative media resolves approved primary and poster records",
    writeScrollyMediaFixture(
      "scrolly-media-poster-complete",
      (contract) => {
        const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
        const scenes = scrolly.scenes as Array<Record<string, unknown>>;
        scenes[0]!.source_kind = "video";
        scenes[0]!.asset_id = "response-sequence-video";
        scenes[0]!.poster_asset_id = "response-sequence-poster";
        scenes[0]!.modes = { mobile: "recomposed", reduced_motion: "final", no_js: "final", save_data: "poster" };
      },
      [
        { assetId: "response-sequence-video", kind: "video" },
        { assetId: "response-sequence-poster", kind: "image" },
      ],
    ),
    "check-scrollytelling-contract.ts",
    0,
  );

  runFixture(
    "heavy narrative media may be explicitly omitted under Save-Data after its primary asset resolves",
    writeScrollyMediaFixture(
      "scrolly-media-save-data-omit",
      (contract) => {
        const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
        const scenes = scrolly.scenes as Array<Record<string, unknown>>;
        scenes[0]!.source_kind = "video";
        scenes[0]!.asset_id = "response-sequence-video";
        scenes[0]!.modes = { mobile: "recomposed", reduced_motion: "final", no_js: "final", save_data: "omit" };
      },
      [{ assetId: "response-sequence-video", kind: "video" }],
    ),
    "check-scrollytelling-contract.ts",
    0,
  );

  runFixture(
    "a poster mode without an authored poster identifier fails",
    writeScrollyMediaFixture(
      "scrolly-media-poster-missing",
      (contract) => {
        const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
        const scenes = scrolly.scenes as Array<Record<string, unknown>>;
        scenes[0]!.source_kind = "image";
        scenes[0]!.asset_id = "response-sequence-image";
        scenes[0]!.modes = { mobile: "recomposed", reduced_motion: "final", no_js: "final", save_data: "poster" };
      },
      [{ assetId: "response-sequence-image", kind: "image" }],
    ),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.poster_asset_id.missing",
  );

  runFixture(
    "an omitted heavy-media fallback cannot retain a stale poster claim",
    writeScrollyMediaFixture(
      "scrolly-media-omit-stale-poster",
      (contract) => {
        const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
        const scenes = scrolly.scenes as Array<Record<string, unknown>>;
        scenes[0]!.source_kind = "image";
        scenes[0]!.asset_id = "response-sequence-image";
        scenes[0]!.poster_asset_id = "unused-poster";
        scenes[0]!.modes = { mobile: "recomposed", reduced_motion: "final", no_js: "final", save_data: "omit" };
      },
      [{ assetId: "response-sequence-image", kind: "image" }],
    ),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.poster_asset_id.unexpected",
  );

  runFixture(
    "active heavy media fails when the canonical content-asset manifest is missing",
    writeScrollyFixture("scrolly-media-manifest-missing", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      const scenes = scrolly.scenes as Array<Record<string, unknown>>;
      scenes[0]!.source_kind = "video";
      scenes[0]!.asset_id = "response-sequence-video";
      scenes[0]!.modes = { mobile: "recomposed", reduced_motion: "final", no_js: "final", save_data: "omit" };
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.content_asset_manifest.missing",
  );

  runFixture(
    "an active image or video scene cannot omit its primary asset ID",
    writeScrollyMediaFixture(
      "scrolly-media-primary-id-missing",
      (contract) => {
        const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
        const scenes = scrolly.scenes as Array<Record<string, unknown>>;
        scenes[0]!.source_kind = "video";
        delete scenes[0]!.asset_id;
        scenes[0]!.modes = { mobile: "recomposed", reduced_motion: "final", no_js: "final", save_data: "omit" };
      },
      [{ assetId: "approved-video", kind: "video" }],
    ),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.asset_id.missing",
  );

  runFixture(
    "an arbitrary primary asset ID that is absent from the manifest fails",
    writeScrollyMediaFixture(
      "scrolly-media-primary-unknown",
      (contract) => {
        const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
        const scenes = scrolly.scenes as Array<Record<string, unknown>>;
        scenes[0]!.source_kind = "video";
        scenes[0]!.asset_id = "invented-video";
        scenes[0]!.modes = { mobile: "recomposed", reduced_motion: "final", no_js: "final", save_data: "omit" };
      },
      [{ assetId: "approved-video", kind: "video" }],
    ),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.asset_id.unknown",
  );

  runFixture(
    "a draft primary content asset is not approved scrollytelling evidence",
    writeScrollyMediaFixture(
      "scrolly-media-primary-unapproved",
      (contract) => {
        const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
        const scenes = scrolly.scenes as Array<Record<string, unknown>>;
        scenes[0]!.source_kind = "video";
        scenes[0]!.asset_id = "draft-video";
        scenes[0]!.modes = { mobile: "recomposed", reduced_motion: "final", no_js: "final", save_data: "omit" };
      },
      [{ assetId: "draft-video", kind: "video", status: "draft" }],
    ),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.asset_id.unapproved",
  );

  runFixture(
    "an unknown status cannot masquerade as content-asset approval",
    writeScrollyMediaFixture(
      "scrolly-media-primary-status-unknown",
      (contract) => {
        const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
        const scenes = scrolly.scenes as Array<Record<string, unknown>>;
        scenes[0]!.source_kind = "image";
        scenes[0]!.asset_id = "self-described-verified-image";
        scenes[0]!.modes = { mobile: "recomposed", reduced_motion: "final", no_js: "final", save_data: "omit" };
      },
      [{ assetId: "self-described-verified-image", kind: "image", status: "verified" }],
    ),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.asset_id.unapproved",
  );

  runFixture(
    "an arbitrary Save-Data poster ID that is absent from the manifest fails",
    writeScrollyMediaFixture(
      "scrolly-media-poster-unknown",
      (contract) => {
        const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
        const scenes = scrolly.scenes as Array<Record<string, unknown>>;
        scenes[0]!.source_kind = "video";
        scenes[0]!.asset_id = "approved-video";
        scenes[0]!.poster_asset_id = "invented-poster";
        scenes[0]!.modes = { mobile: "recomposed", reduced_motion: "final", no_js: "final", save_data: "poster" };
      },
      [{ assetId: "approved-video", kind: "video" }],
    ),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.poster_asset_id.unknown",
  );

  runFixture(
    "a draft poster is not approved Save-Data evidence",
    writeScrollyMediaFixture(
      "scrolly-media-poster-unapproved",
      (contract) => {
        const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
        const scenes = scrolly.scenes as Array<Record<string, unknown>>;
        scenes[0]!.source_kind = "video";
        scenes[0]!.asset_id = "approved-video";
        scenes[0]!.poster_asset_id = "draft-poster";
        scenes[0]!.modes = { mobile: "recomposed", reduced_motion: "final", no_js: "final", save_data: "poster" };
      },
      [
        { assetId: "approved-video", kind: "video" },
        { assetId: "draft-poster", kind: "image", status: "draft" },
      ],
    ),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.poster_asset_id.unapproved",
  );

  runFixture(
    "a heavy primary record cannot also serve as its own poster",
    writeScrollyMediaFixture(
      "scrolly-media-poster-same-as-primary",
      (contract) => {
        const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
        const scenes = scrolly.scenes as Array<Record<string, unknown>>;
        scenes[0]!.source_kind = "video";
        scenes[0]!.asset_id = "approved-video";
        scenes[0]!.poster_asset_id = "approved-video";
        scenes[0]!.modes = { mobile: "recomposed", reduced_motion: "final", no_js: "final", save_data: "poster" };
      },
      [{ assetId: "approved-video", kind: "video" }],
    ),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.poster_asset_id.same_as_primary",
  );

  runFixture(
    "a distinct video record is still too heavy to serve as a Save-Data poster",
    writeScrollyMediaFixture(
      "scrolly-media-poster-heavy",
      (contract) => {
        const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
        const scenes = scrolly.scenes as Array<Record<string, unknown>>;
        scenes[0]!.source_kind = "video";
        scenes[0]!.asset_id = "approved-video";
        scenes[0]!.poster_asset_id = "other-video";
        scenes[0]!.modes = { mobile: "recomposed", reduced_motion: "final", no_js: "final", save_data: "poster" };
      },
      [
        { assetId: "approved-video", kind: "video" },
        { assetId: "other-video", kind: "video" },
      ],
    ),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.poster_asset_id.not_lightweight",
  );

  runFixture(
    "a done-tier manifest row with a missing local output is not usable evidence",
    writeScrollyMediaFixture(
      "scrolly-media-output-missing",
      (contract) => {
        const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
        const scenes = scrolly.scenes as Array<Record<string, unknown>>;
        scenes[0]!.source_kind = "image";
        scenes[0]!.asset_id = "missing-output-image";
        scenes[0]!.modes = { mobile: "recomposed", reduced_motion: "final", no_js: "final", save_data: "omit" };
      },
      [{ assetId: "missing-output-image", kind: "image", writeOutput: false }],
    ),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.asset_id.output_missing",
  );

  runFixture(
    "missing short-height QA evidence fails",
    writeScrollyFixture("scrolly-short-height-qa", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      scrolly.qa = (scrolly.qa as Array<Record<string, unknown>>).filter((row) => row.mode !== "short_mobile");
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.qa.short_mobile.missing",
  );

  runFixture(
    "each state needs forward and reverse default QA",
    writeScrollyFixture("scrolly-direction-state-qa", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      scrolly.qa = (scrolly.qa as Array<Record<string, unknown>>).filter(
        (row) => !(row.mode === "default" && row.direction === "reverse" && row.scene_id === "need" && row.expected_state === "need-mechanism"),
      );
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.qa.state_direction.missing",
  );

  runFixture(
    "every Tier 1 locale covers every state in both directions",
    writeScrollyFixture("scrolly-locale-state-direction-qa", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      scrolly.qa = (scrolly.qa as Array<Record<string, unknown>>).filter(
        (row) =>
          !(
            row.locale === "es-US" &&
            row.mode === "default" &&
            row.direction === "reverse" &&
            row.scene_id === "need" &&
            row.expected_state === "need-mechanism"
          ),
      );
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.qa.locale_state_direction.missing",
  );

  runFixture(
    "each scene needs default-mode restored-position QA",
    writeScrollyFixture("scrolly-default-jump-qa", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      scrolly.qa = (scrolly.qa as Array<Record<string, unknown>>).filter(
        (row) => !(row.mode === "default" && row.direction === "jump" && row.scene_id === "need"),
      );
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.qa.jump.missing",
  );

  runFixture(
    "every Tier 1 locale covers restored-position QA",
    writeScrollyFixture("scrolly-locale-default-jump-qa", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      scrolly.qa = (scrolly.qa as Array<Record<string, unknown>>).filter(
        (row) => !(row.locale === "es-US" && row.mode === "default" && row.direction === "jump" && row.scene_id === "need"),
      );
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.qa.locale_jump.missing",
  );

  runFixture(
    "every Tier 1 locale covers each degraded mode",
    writeScrollyFixture("scrolly-locale-degraded-mode-qa", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      scrolly.qa = (scrolly.qa as Array<Record<string, unknown>>).filter(
        (row) => !(row.locale === "es-US" && row.mode === "save_data" && row.scene_id === "need"),
      );
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.qa.locale_mode.missing",
  );

  runFixture(
    "every QA row names its browser and platform",
    writeScrollyFixture("scrolly-qa-browser-platform-fields", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      const qa = scrolly.qa as Array<Record<string, unknown>>;
      delete qa[0]!.browser;
      delete qa[1]!.platform;
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.qa.0.browser.missing",
  );

  runFixture(
    "desktop browser-family coverage includes Firefox",
    writeScrollyFixture("scrolly-qa-firefox-missing", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      for (const row of scrolly.qa as Array<Record<string, unknown>>) {
        if (row.browser === "Firefox") row.browser = "Chrome";
      }
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.qa.browser.firefox.missing",
  );

  runFixture(
    "mobile coverage includes iOS Safari",
    writeScrollyFixture("scrolly-qa-ios-safari-missing", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      for (const row of scrolly.qa as Array<Record<string, unknown>>) {
        if (String(row.platform).includes("iOS")) row.platform = "macOS 15";
      }
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.qa.ios_safari.missing",
  );

  runFixture(
    "mobile coverage includes Android Chrome",
    writeScrollyFixture("scrolly-qa-android-chrome-missing", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      for (const row of scrolly.qa as Array<Record<string, unknown>>) {
        if (String(row.platform).includes("Android")) row.platform = "macOS 15";
      }
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.qa.android_chrome.missing",
  );

  runFixture(
    "desktop QA uses at least two distinct viewport heights",
    writeScrollyFixture("scrolly-qa-desktop-viewports", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      for (const row of scrolly.qa as Array<Record<string, unknown>>) {
        if (/macOS|Windows|Linux/u.test(String(row.platform))) {
          row.viewport = row.browser === "Safari" ? "desktop 1024x900" : row.browser === "Firefox" ? "desktop 1366x900" : "desktop 1440x900";
        }
      }
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.qa.desktop_viewports.insufficient",
  );

  runFixture(
    "each desktop browser carries its own short and tall height evidence",
    writeScrollyFixture("scrolly-qa-desktop-browser-height-cross-product", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      for (const row of scrolly.qa as Array<Record<string, unknown>>) {
        if (row.browser === "Safari" && String(row.platform).includes("macOS")) row.viewport = "desktop 1280x900";
      }
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.qa.browser.safari.heights_insufficient",
  );

  runFixture(
    "short-mobile QA is shorter than the normal mobile viewport",
    writeScrollyFixture("scrolly-qa-mobile-height-diversity", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      for (const row of scrolly.qa as Array<Record<string, unknown>>) {
        if (row.mode === "short_mobile") row.viewport = "short-mobile 390x844";
      }
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.qa.mobile_heights.insufficient",
  );

  runFixture(
    "iOS Safari carries its own genuinely shorter short-mobile evidence",
    writeScrollyFixture("scrolly-qa-ios-height-cross-product", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      for (const row of scrolly.qa as Array<Record<string, unknown>>) {
        if (String(row.platform).includes("iOS") && row.mode === "short_mobile") row.viewport = "mobile 390x844";
      }
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.qa.ios_safari.heights_insufficient",
  );

  runFixture(
    "Android Chrome carries its own short-mobile evidence",
    writeScrollyFixture("scrolly-qa-android-height-cross-product", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      scrolly.qa = (scrolly.qa as Array<Record<string, unknown>>).filter((row) => !(String(row.platform).includes("Android") && row.mode === "short_mobile"));
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.qa.android_chrome.heights_insufficient",
  );

  runFixture(
    "active evidence paths must exist inside the workspace",
    writeScrollyFixture("scrolly-evidence-path-missing", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      scrolly.evidence = "growth/landing/evidence/does-not-exist.md#decision";
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.evidence_path.missing",
  );

  runFixture(
    "every active QA evidence path must exist inside the workspace",
    writeScrollyFixture("scrolly-qa-evidence-path-missing", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      const qa = scrolly.qa as Array<Record<string, unknown>>;
      qa[0]!.evidence = "growth/landing/evidence/missing-browser-run.md#need-forward";
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.evidence_path.missing",
  );

  runFixture(
    "active evidence fragments resolve to authored anchors",
    writeScrollyFixture("scrolly-qa-evidence-fragment-missing", (contract) => {
      const scrolly = expectRecord(contract.scrollytelling, "scrollytelling");
      const qa = scrolly.qa as Array<Record<string, unknown>>;
      qa[0]!.evidence = "growth/landing/evidence/browser-matrix.md#not-an-authored-run";
    }),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.evidence_fragment.missing",
  );

  const scrollyNotApplicable = makeEmptyFixture("scrolly-not-applicable-reason");
  mkdirSync(path.join(scrollyNotApplicable, "growth/landing"), { recursive: true });
  writeFileSync(path.join(scrollyNotApplicable, "growth/landing/index.html"), "<main><h1>Static landing</h1></main>\n", "utf8");
  writeFileSync(
    path.join(scrollyNotApplicable, "growth/landing/surface-contract.json"),
    `${JSON.stringify(
      {
        scrollytelling: {
          applicable: false,
          evidence: "The short landing has no sequential evidence that needs a scroll-linked treatment.",
          locales: [],
          scenes: [],
          qa: [],
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  runFixture("a not-applicable declaration keeps a plain non-path rationale", scrollyNotApplicable, "check-scrollytelling-contract.ts", 0);

  const scrollyNotApplicableWithoutReason = makeEmptyFixture("scrolly-not-applicable-reason-missing");
  mkdirSync(path.join(scrollyNotApplicableWithoutReason, "growth/landing"), { recursive: true });
  writeFileSync(path.join(scrollyNotApplicableWithoutReason, "growth/landing/index.html"), "<main><h1>Static landing</h1></main>\n", "utf8");
  writeFileSync(
    path.join(scrollyNotApplicableWithoutReason, "growth/landing/surface-contract.json"),
    `${JSON.stringify({ scrollytelling: { applicable: false, evidence: "", locales: [], scenes: [], qa: [] } }, null, 2)}\n`,
    "utf8",
  );
  runFixture(
    "a not-applicable declaration still needs a plain rationale",
    scrollyNotApplicableWithoutReason,
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.evidence.missing",
  );

  const scrollyNotApplicableWrongShape = makeEmptyFixture("scrolly-not-applicable-shape-invalid");
  mkdirSync(path.join(scrollyNotApplicableWrongShape, "growth/landing"), { recursive: true });
  writeFileSync(path.join(scrollyNotApplicableWrongShape, "growth/landing/index.html"), "<main><h1>Static landing</h1></main>\n", "utf8");
  writeFileSync(
    path.join(scrollyNotApplicableWrongShape, "growth/landing/surface-contract.json"),
    `${JSON.stringify(
      {
        scrollytelling: {
          applicable: false,
          evidence: "The landing has no sequential evidence.",
          locales: "none",
          scenes: {},
          qa: null,
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  runFixture(
    "a not-applicable declaration still uses the exact array shape",
    scrollyNotApplicableWrongShape,
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.locales.invalid",
  );

  const scrollyNotApplicableWithRows = makeEmptyFixture("scrolly-not-applicable-rows-present");
  mkdirSync(path.join(scrollyNotApplicableWithRows, "growth/landing"), { recursive: true });
  writeFileSync(path.join(scrollyNotApplicableWithRows, "growth/landing/index.html"), "<main><h1>Static landing</h1></main>\n", "utf8");
  writeFileSync(
    path.join(scrollyNotApplicableWithRows, "growth/landing/surface-contract.json"),
    `${JSON.stringify(
      {
        scrollytelling: {
          applicable: false,
          evidence: "The landing has no sequential evidence.",
          locales: ["en-US"],
          scenes: [{ id: "should-not-exist" }],
          qa: [{ result: "pending" }],
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  runFixture(
    "a not-applicable declaration cannot retain scene or QA rows",
    scrollyNotApplicableWithRows,
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.contract.not_applicable.locales_not_empty",
  );

  const scrollyReducedMotionCss = writeScrollyFixture(
    "scrolly-reduced-motion-shared-css",
    undefined,
    validScrollySource
      .replace('import { useReducedMotion } from "motion/react";\n', "")
      .replace("  const reduced = useReducedMotion();\n", "")
      .replace("{String(reduced)} ", ""),
  );
  writeFileSync(
    path.join(scrollyReducedMotionCss, "growth/landing/motion.css"),
    "@media (prefers-reduced-motion: reduce) { .lm-scrolly { scroll-behavior: auto; } }\n",
    "utf8",
  );
  runFixture("shared landing CSS can own the reduced-motion fallback", scrollyReducedMotionCss, "check-scrollytelling-contract.ts", 0);

  runFixture(
    "equal-bucket source quantization fails",
    writeScrollyFixture("scrolly-equal-buckets", undefined, `${validScrollySource}\nconst active = Math.floor(scrollYProgress * steps.length);\n`),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.business.equal_bucket_quantization",
  );

  runFixture(
    "Save-Data cannot freeze code-native progress",
    writeScrollyFixture(
      "scrolly-save-data-freeze",
      undefined,
      `${validScrollySource}\nfunction sceneProgress(saveData: boolean) { if (saveData) return 0; return 1; }\n`,
    ),
    "check-scrollytelling-contract.ts",
    1,
    "scrollytelling.business.save_data_code_native_freeze",
  );
}
