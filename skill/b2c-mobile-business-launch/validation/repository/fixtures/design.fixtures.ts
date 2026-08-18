import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Harness, expectRecord, getLane, readState, writeState } from "./_harness.js";

export function register(h: Harness): void {
  const { makeFixture, runFixture } = h;

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
}
