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
