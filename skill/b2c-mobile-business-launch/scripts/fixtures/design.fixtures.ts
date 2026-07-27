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

  const uxFallbackUnapproved = makeFixture("ux-fallback-unapproved");
  writeFileSync(
    path.join(uxFallbackUnapproved, "UX_PATTERNS.md"),
    [
      "# UX Patterns",
      "Refero Route",
      "Refero unavailable, using free baseline route.",
      "Pattern Inventory",
      "Flow Map",
      "State Matrix",
      "Bug Traps",
      "Onboarding Playbook",
      "Do not copy one app directly.",
    ].join("\n"),
    "utf8",
  );
  runFixture("Refero fallback without founder approval fails", uxFallbackUnapproved, "check-ux-patterns.ts", 1, "ux_patterns.refero_fallback_unapproved");

  const onboardingNoReview = makeFixture("onboarding-no-review");
  writeFileSync(
    path.join(onboardingNoReview, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan before the paywall.",
      "Paywall: present the RevenueCat offering after the plan.",
      "Analytics: onboarding_started, personalized_plan_viewed, paywall_viewed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "onboarding without App Review popup after first value fails",
    onboardingNoReview,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.app_review_after_first_value.missing",
  );

  const onboardingReviewBeforeValue = makeFixture("onboarding-review-before-value");
  writeFileSync(
    path.join(onboardingReviewBeforeValue, "ONBOARDING.md"),
    [
      "# Onboarding",
      "App Review popup: immediately request SKStoreReviewController.requestReview(in:) on app open.",
      "First value / value-reveal step: the user sees the personalized plan after the review sheet.",
      "Automatic timing: the screen is visible with a 1-2 second delay.",
      "Cooldown: one eligible request per milestone.",
      "Analytics: review_prompt_eligible and review_prompt_requested.",
      "Fallback: the platform may not show the review sheet.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "onboarding review prompt before first value fails",
    onboardingReviewBeforeValue,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.app_review_before_first_value",
  );

  // Mention is not placement: a cold push ask on launch is the contract
  // violation the lifecycle reference forbids.
  const onboardingColdPush = makeFixture("onboarding-cold-push-ask");
  {
    const state = readState(onboardingColdPush);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingColdPush, state);
  }
  writeFileSync(
    path.join(onboardingColdPush, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen, native App Review request, automatic 1-2 second delay while mounted, cooldown per milestone.",
      "Push permission: request cold on first launch so we never miss a user.",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested, push_permission_primed.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "cold push ask on launch fails the priming placement gate",
    onboardingColdPush,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.push_priming_missing",
  );

  const elevenStarMissing = makeFixture("eleven-star-missing");
  rmSync(path.join(elevenStarMissing, "11-star-experience"), { recursive: true, force: true });
  runFixture("missing 11-star experience packet fails", elevenStarMissing, "check-eleven-star-experience.ts", 1, "eleven_star.markdown_missing");

  const emotionalDesignMissing = makeFixture("emotional-design-missing");
  rmSync(path.join(emotionalDesignMissing, "emotional-design"), { recursive: true, force: true });
  runFixture("missing emotional design contract fails", emotionalDesignMissing, "check-emotional-design.ts", 1, "emotional_design.contract_missing");

  const emotionalDesignLaneAbsent = makeFixture("emotional-design-lane-absent");
  {
    const state = readState(emotionalDesignLaneAbsent);
    const lanes = expectRecord(state.lanes, "PROJECT_STATE.yaml lanes");
    delete lanes.emotional_design;
    writeState(emotionalDesignLaneAbsent, state);
  }
  runFixture("missing emotional design lane fails", emotionalDesignLaneAbsent, "check-emotional-design.ts", 1, "emotional_design.lane_missing");

  const emotionalDesignGenericHtml = makeFixture("emotional-design-generic-html");
  rmSync(path.join(emotionalDesignGenericHtml, "emotional-design", "emotional-design.html"), { force: true });
  runFixture(
    "generic design.html does not satisfy emotional board",
    emotionalDesignGenericHtml,
    "check-emotional-design.ts",
    1,
    "emotional_design.html_missing",
  );

  const emotionalSocialProofUnproven = makeFixture("emotional-social-proof-unproven");
  {
    const cardPath = path.join(emotionalSocialProofUnproven, "emotional-design", "EMOTIONAL_DESIGN.md");
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
      path.join(emotionalSocialProofUnproven, "ONBOARDING.md"),
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
    const cardPath = path.join(emotionalDesignUnguardedReward, "emotional-design", "EMOTIONAL_DESIGN.md");
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

  const elevenStarThin = makeFixture("eleven-star-thin");
  writeFileSync(
    path.join(elevenStarThin, "11-star-experience", "11_STAR_EXPERIENCE.md"),
    [
      "# 11-Star Experience",
      "Experience Thesis: Make it feel magical.",
      "Star Ladder",
      "| Stars | Label | User scene | Product behavior implied | Emotional reaction | What we learn |",
      "| --- | --- | --- | --- | --- | --- |",
      "| 5 | Expected | It works. | Build it. | Fine. | Baseline. |",
    ].join("\n"),
    "utf8",
  );
  runFixture("thin 11-star experience packet fails", elevenStarThin, "check-eleven-star-experience.ts", 1, "eleven_star.line_of_feasibility.missing");

  const elevenStarDonePlaceholder = makeFixture("eleven-star-done-placeholder");
  const elevenStarDonePlaceholderState = readState(elevenStarDonePlaceholder);
  const doneExperienceLane = getLane(elevenStarDonePlaceholderState, "experience");
  doneExperienceLane["status"] = "done";
  doneExperienceLane["evidence"] = ["11-star-experience/11_STAR_EXPERIENCE.md", "11-star-experience/11-star-experience.html"];
  writeState(elevenStarDonePlaceholder, elevenStarDonePlaceholderState);
  runFixture(
    "done 11-star experience with placeholders fails",
    elevenStarDonePlaceholder,
    "check-eleven-star-experience.ts",
    1,
    "eleven_star.placeholder_complete",
  );
}
