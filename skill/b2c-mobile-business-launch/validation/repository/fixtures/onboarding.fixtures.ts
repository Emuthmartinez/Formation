import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Harness, getLane, readState, writeState } from "./_harness.js";

/** Deterministic fixtures for the generalized onboarding system graph gate. */
export function register(h: Harness): void {
  const { makeFixture, runFixture } = h;

  const onboardingPath = (fixtureRoot: string): string => path.join(fixtureRoot, "product/ONBOARDING.md");
  const mutateOnboarding = (fixtureRoot: string, mutate: (text: string) => string): void => {
    const file = onboardingPath(fixtureRoot);
    writeFileSync(file, mutate(readFileSync(file, "utf8")), "utf8");
  };

  const baseline = makeFixture("onboarding-graph-baseline");
  runFixture("shipped onboarding graph template passes before completion", baseline, "check-onboarding-graph.ts", 0);

  const graphNodeMissing = makeFixture("onboarding-graph-node-missing");
  mutateOnboarding(graphNodeMissing, (text) => text.replaceAll("ONB-22", "ONB-FINAL"));
  runFixture("onboarding graph missing a canonical node fails", graphNodeMissing, "check-onboarding-graph.ts", 1, "onboarding_graph.node_missing");

  const evidenceMissing = makeFixture("onboarding-graph-evidence-missing");
  mutateOnboarding(evidenceMissing, (text) => text.replace("## Onbo Hub Pattern Atlas", "## Flow Pattern Notes"));
  runFixture(
    "onboarding without the authorized Onbo Hub evidence contract fails",
    evidenceMissing,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.section_onbo_hub_pattern_atlas_missing",
  );

  const reviewInsideFirstRun = makeFixture("onboarding-graph-review-inside-first-run");
  mutateOnboarding(reviewInsideFirstRun, (text) =>
    text.replace(
      "The native request happens outside first-run onboarding.",
      "Show the native review prompt immediately after first value inside first-run onboarding.",
    ),
  );
  runFixture(
    "review request immediately after first value inside onboarding fails",
    reviewInsideFirstRun,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.review_inside_first_run",
  );

  const unobservableReview = makeFixture("onboarding-graph-unobservable-review-event");
  mutateOnboarding(unobservableReview, (text) => text.replace("`review_request_returned`", "`review_prompt_shown`"));
  runFixture(
    "analytics cannot claim that the platform displayed a review prompt",
    unobservableReview,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.review_unobservable_event",
  );

  const controlContractMissing = makeFixture("onboarding-graph-control-contract-missing");
  mutateOnboarding(controlContractMissing, (text) => text.replaceAll("ONB-CTL-001", "CONTROL-TBD"));
  runFixture("onboarding without stable control IDs fails", controlContractMissing, "check-onboarding-graph.ts", 1, "onboarding_graph.design_contract");

  const zeroLegacyMissing = makeFixture("onboarding-graph-zero-legacy-missing");
  mutateOnboarding(zeroLegacyMissing, (text) => text.replaceAll("Do not keep the old runtime", "Keep the old runtime"));
  runFixture("replacement plan that keeps the old runtime fails", zeroLegacyMissing, "check-onboarding-graph.ts", 1, "onboarding_graph.replacement_contract");

  const doneWithPlaceholders = makeFixture("onboarding-graph-done-with-placeholders");
  {
    const state = readState(doneWithPlaceholders);
    const lane = getLane(state, "onboarding");
    lane["status"] = "done";
    lane["evidence"] = ["product/ONBOARDING.md", "product/onboarding.html"];
    writeState(doneWithPlaceholders, state);
  }
  runFixture(
    "done onboarding lane with not_started nodes and template records fails",
    doneWithPlaceholders,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.placeholder_complete",
  );
}
