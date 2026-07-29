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

  // Naming the value-reveal is not placement: asking BEFORE it is the violation.
  const onboardingPushBeforeValue = makeFixture("onboarding-push-before-value");
  {
    const state = readState(onboardingPushBeforeValue);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushBeforeValue, state);
  }
  writeFileSync(
    path.join(onboardingPushBeforeValue, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen, native App Review request, automatic 1-2 second delay while mounted, cooldown per milestone.",
      "Push permission: ask before the value-reveal so the token is ready early.",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested, push_permission_primed.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "push ask placed before the value reveal fails",
    onboardingPushBeforeValue,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.push_priming_missing",
  );

  // Documenting the prohibition ("never on launch") is compliance, not violation.
  const onboardingPushNegated = makeFixture("onboarding-push-negated-cold");
  {
    const state = readState(onboardingPushNegated);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushNegated, state);
  }
  writeFileSync(
    path.join(onboardingPushNegated, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "Push permission: prime after first value at an earned moment, system dialog user-initiated from the prime screen; never on launch.",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested, push_permission_primed.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture("negated cold-start guidance passes the priming gate", onboardingPushNegated, "check-onboarding-conversion.ts", 0);

  // Negating the placement while affirming the cold ask is still the violation.
  const onboardingPushNegatedInverse = makeFixture("onboarding-push-negated-inverse");
  {
    const state = readState(onboardingPushNegatedInverse);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushNegatedInverse, state);
  }
  writeFileSync(
    path.join(onboardingPushNegatedInverse, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "Push permission: not after first value\u2014request on launch so the token is ready.",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested, push_permission_primed.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "negated placement with an affirmative cold ask fails",
    onboardingPushNegatedInverse,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.push_priming_missing",
  );

  // The after-first-value slot belongs to one prompt: pairing push with the
  // review popup in the same step is the violation even though it is post-value.
  const onboardingPushSameStep = makeFixture("onboarding-push-review-same-step");
  {
    const state = readState(onboardingPushSameStep);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushSameStep, state);
  }
  writeFileSync(
    path.join(onboardingPushSameStep, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "Push permission prime: shown together with the App Review popup immediately after the first value screen.",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested, push_permission_primed.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "push prime in the same step as the review popup fails",
    onboardingPushSameStep,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.push_review_same_step",
  );

  // A bare not-applicable label does not earn the exemption.
  const onboardingPushNaBare = makeFixture("onboarding-push-na-bare");
  {
    const state = readState(onboardingPushNaBare);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushNaBare, state);
  }
  writeFileSync(
    path.join(onboardingPushNaBare, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "Push notifications: not applicable",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "a bare push-not-applicable label without a reason fails",
    onboardingPushNaBare,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.push_priming_missing",
  );

  // A reasoned not-applicable decision earns the exemption.
  const onboardingPushNaReasoned = makeFixture("onboarding-push-na-reasoned");
  {
    const state = readState(onboardingPushNaReasoned);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushNaReasoned, state);
  }
  writeFileSync(
    path.join(onboardingPushNaReasoned, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "Push notifications: not applicable — companion web app with no notification surface; the email lifecycle owns re-engagement.",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture("a reasoned push-not-applicable decision passes", onboardingPushNaReasoned, "check-onboarding-conversion.ts", 0);

  // Step-level correlation: separate rows sharing a numbered step are the same
  // back-to-back flow even though no single line says "same step".
  const onboardingPushStepTable = makeFixture("onboarding-push-review-step-table");
  {
    const state = readState(onboardingPushStepTable);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushStepTable, state);
  }
  writeFileSync(
    path.join(onboardingPushStepTable, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "",
      "| Step | Prompt |",
      "| --- | --- |",
      "| 3 | App Review popup via the native review prompt |",
      "| 3 | Push permission prime — only after value is visible |",
      "",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested, push_permission_primed.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "review and push assigned to the same numbered step on separate rows fails",
    onboardingPushStepTable,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.push_review_same_step",
  );

  // Canonical review aliases participate in the step correlation too.
  const onboardingPushStepAlias = makeFixture("onboarding-push-review-step-alias");
  {
    const state = readState(onboardingPushStepAlias);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushStepAlias, state);
  }
  writeFileSync(
    path.join(onboardingPushStepAlias, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "",
      "| Step | Prompt |",
      "| --- | --- |",
      "| 3 | Native review — rating prompt at the value milestone |",
      "| 3 | Push permission prime — only after value is visible |",
      "",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested, push_permission_primed.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "a review alias sharing the push prime's numbered step fails",
    onboardingPushStepAlias,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.push_review_same_step",
  );

  // Named step labels correlate the same way numbered ones do.
  const onboardingPushNamedStep = makeFixture("onboarding-push-review-named-step");
  {
    const state = readState(onboardingPushNamedStep);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushNamedStep, state);
  }
  writeFileSync(
    path.join(onboardingPushNamedStep, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "",
      "| Step | Prompt |",
      "| --- | --- |",
      "| Value reveal | App Review popup via the native review prompt |",
      "| Value reveal | Push permission prime — only after value is visible |",
      "",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested, push_permission_primed.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "review and push sharing a named step label fails",
    onboardingPushNamedStep,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.push_review_same_step",
  );

  // Both prompts inside one combined step row are the collision itself.
  const onboardingPushCombinedRow = makeFixture("onboarding-push-review-combined-row");
  {
    const state = readState(onboardingPushCombinedRow);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushCombinedRow, state);
  }
  writeFileSync(
    path.join(onboardingPushCombinedRow, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "",
      "| Step | Prompts |",
      "| --- | --- |",
      "| After first value | App Review popup; push permission prime — only after value is visible |",
      "",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested, push_permission_primed.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "review and push combined in one step row fails",
    onboardingPushCombinedRow,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.push_review_same_step",
  );

  // An exemption cannot coexist with an actual push flow.
  const onboardingPushNaContradicted = makeFixture("onboarding-push-na-contradicted");
  {
    const state = readState(onboardingPushNaContradicted);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushNaContradicted, state);
  }
  writeFileSync(
    path.join(onboardingPushNaContradicted, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "Push notifications: not applicable — desktop companion has no notification surface; the email lifecycle owns re-engagement.",
      "Push permission: request on launch so the token is ready early.",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "a push-not-applicable claim contradicted by a cold ask fails",
    onboardingPushNaContradicted,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.push_priming_missing",
  );

  // Timing alone is not the prime-first flow.
  const onboardingPushDialogNoPrime = makeFixture("onboarding-push-dialog-no-prime");
  {
    const state = readState(onboardingPushDialogNoPrime);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushDialogNoPrime, state);
  }
  writeFileSync(
    path.join(onboardingPushDialogNoPrime, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "Push permission: request the native system dialog directly after first value at an earned moment.",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "a well-timed direct system dialog without a soft prime fails",
    onboardingPushDialogNoPrime,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.push_priming_missing",
  );

  // An automatic delayed hard ask is still a hard ask.
  const onboardingPushAutoDialog = makeFixture("onboarding-push-auto-dialog");
  {
    const state = readState(onboardingPushAutoDialog);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushAutoDialog, state);
  }
  writeFileSync(
    path.join(onboardingPushAutoDialog, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "Push permission: soft-prime after first value, then automatically show the system dialog.",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested, push_permission_primed.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "a soft prime that auto-opens the system dialog without a tap fails",
    onboardingPushAutoDialog,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.push_priming_missing",
  );

  // The exemption line itself cannot smuggle an ask after the reason.
  const onboardingPushNaInlineAsk = makeFixture("onboarding-push-na-inline-ask");
  {
    const state = readState(onboardingPushNaInlineAsk);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushNaInlineAsk, state);
  }
  writeFileSync(
    path.join(onboardingPushNaInlineAsk, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "Push permission: not applicable — desktop has no surface; on iOS request the system dialog on launch.",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "an exemption whose reason carries an inline cold ask fails",
    onboardingPushNaInlineAsk,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.push_priming_missing",
  );

  // "Push notification priming" is the same canonical subject.
  const onboardingPushNotificationPriming = makeFixture("onboarding-push-notification-priming");
  {
    const state = readState(onboardingPushNotificationPriming);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushNotificationPriming, state);
  }
  writeFileSync(
    path.join(onboardingPushNotificationPriming, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "Push notification priming: soft-prime after first value; the system dialog is user-initiated after the user taps Allow; never on launch.",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested, push_permission_primed.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture("push-notification-priming wording passes the gate", onboardingPushNotificationPriming, "check-onboarding-conversion.ts", 0);

  // A negated capability statement is an exemption reason, not an ask.
  const onboardingPushCapabilityNa = makeFixture("onboarding-push-capability-na");
  {
    const state = readState(onboardingPushCapabilityNa);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushCapabilityNa, state);
  }
  writeFileSync(
    path.join(onboardingPushCapabilityNa, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "Push notifications: not applicable — this web-only product cannot show native notifications.",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture("a capability-based push exemption passes", onboardingPushCapabilityNa, "check-onboarding-conversion.ts", 0);

  // A dialog after the user taps Decline is a hard ask after a refusal.
  const onboardingPushDeclineTap = makeFixture("onboarding-push-decline-tap");
  {
    const state = readState(onboardingPushDeclineTap);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushDeclineTap, state);
  }
  writeFileSync(
    path.join(onboardingPushDeclineTap, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "Push permission priming: soft-prime after first value; after the user taps Decline, show the system dialog.",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested, push_permission_primed.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "a system dialog after the user taps Decline fails",
    onboardingPushDeclineTap,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.push_priming_missing",
  );

  // Declarative dialog behavior conflicts with the exemption too.
  const onboardingPushNaDeclarative = makeFixture("onboarding-push-na-declarative");
  {
    const state = readState(onboardingPushNaDeclarative);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushNaDeclarative, state);
  }
  writeFileSync(
    path.join(onboardingPushNaDeclarative, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "Push notifications: not applicable — desktop has no notification surface.",
      "Push permission on iOS: the native system dialog opens on launch.",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "an exemption beside a declarative launch dialog fails",
    onboardingPushNaDeclarative,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.push_priming_missing",
  );

  // The exemption line itself cannot smuggle a declarative flow either.
  const onboardingPushNaInlineDeclarative = makeFixture("onboarding-push-na-inline-declarative");
  {
    const state = readState(onboardingPushNaInlineDeclarative);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushNaInlineDeclarative, state);
  }
  writeFileSync(
    path.join(onboardingPushNaInlineDeclarative, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "Push notifications: not applicable — desktop has no surface; on iOS the native system dialog opens on launch.",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "an exemption whose reason declares a launch dialog fails",
    onboardingPushNaInlineDeclarative,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.push_priming_missing",
  );

  // A dialog that opens before the consent tap is the inverted order.
  const onboardingPushDialogBeforeTap = makeFixture("onboarding-push-dialog-before-tap");
  {
    const state = readState(onboardingPushDialogBeforeTap);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushDialogBeforeTap, state);
  }
  writeFileSync(
    path.join(onboardingPushDialogBeforeTap, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "Push permission priming: soft-prime after first value; the system dialog opens automatically; the user taps Continue afterward.",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested, push_permission_primed.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "a dialog that opens automatically before the consent tap fails",
    onboardingPushDialogBeforeTap,
    "check-onboarding-conversion.ts",
    1,
    "onboarding.push_priming_missing",
  );

  // "Push permission" is the same canonical noun as "push notifications" for
  // the not-applicable exemption.
  const onboardingPushPermissionNa = makeFixture("onboarding-push-permission-na");
  {
    const state = readState(onboardingPushPermissionNa);
    getLane(state, "onboarding")["status"] = "done";
    writeState(onboardingPushPermissionNa, state);
  }
  writeFileSync(
    path.join(onboardingPushPermissionNa, "ONBOARDING.md"),
    [
      "# Onboarding",
      "First value / value-reveal step: the user sees a personalized plan.",
      "App Review popup: immediately after the first value/value-reveal screen via SKStoreReviewController.requestReview(in:), automatic 1-2 second delay while mounted, cooldown per milestone.",
      "Push permission: not applicable — desktop companion has no notification surface; the email lifecycle owns re-engagement.",
      "Attribution: How did you hear about us? after the value promise.",
      "Analytics: review_prompt_eligible, review_prompt_requested.",
      "Fallback: flow continues if the review sheet is suppressed.",
    ].join("\n"),
    "utf8",
  );
  runFixture("a reasoned push-permission not-applicable decision passes", onboardingPushPermissionNa, "check-onboarding-conversion.ts", 0);

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

  const emotionalSpendNearReward = makeFixture("emotional-spend-near-reward");
  writeFileSync(
    path.join(emotionalSpendNearReward, "ONBOARDING.md"),
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
    path.join(emotionalSpendSeparated, "ONBOARDING.md"),
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
    path.join(emotionalSpendProhibited, "ONBOARDING.md"),
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
    path.join(emotionalSpendIap, "ONBOARDING.md"),
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
    path.join(emotionalSpendWrappedProhibition, "ONBOARDING.md"),
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
    path.join(emotionalSpendBorrowedProof, "ONBOARDING.md"),
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
    path.join(emotionalSpendUnrelatedNegation, "ONBOARDING.md"),
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
    path.join(emotionalSpendNegatedProof, "ONBOARDING.md"),
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
    path.join(emotionalSpendOtherClause, "ONBOARDING.md"),
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

  // Lane deferral skips deliverables, never the ethics veto over copy that already exists.
  const emotionalSpendDeferredLane = makeFixture("emotional-spend-deferred-lane");
  {
    const state = readState(emotionalSpendDeferredLane);
    getLane(state, "emotional_design")["status"] = "deferred";
    writeState(emotionalSpendDeferredLane, state);
  }
  writeFileSync(
    path.join(emotionalSpendDeferredLane, "ONBOARDING.md"),
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
    const refDir = path.join(emotionalTierMismatch, "references");
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
    const refDir = path.join(emotionalTierConflict, "references");
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
    const refDir = path.join(emotionalTierDuplicate, "references");
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
    const refDir = path.join(emotionalTierTypo, "references");
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
    const refDir = path.join(emotionalTierInterrupted, "references");
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
    const refDir = path.join(emotionalTierPlaceholderAbuse, "references");
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
    const refDir = path.join(emotionalTierDescendingRange, "references");
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
    const refDir = path.join(emotionalTierMotionWordAbuse, "references");
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
    const refDir = path.join(emotionalTierBucketDuplicate, "references");
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
    const refDir = path.join(emotionalTierBucketConflict, "references");
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
    const refDir = path.join(emotionalTierBrokenRow, "references");
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
    const refDir = path.join(emotionalTierRangeSpan, "references");
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
    const refDir = path.join(emotionalTierMotionSubstring, "references");
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
    const refDir = path.join(emotionalTierNameDrift, "references");
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
