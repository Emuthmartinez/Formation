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

  // Mirrors check-onboarding-graph.ts's own TEMPLATE_DIRECTIVE_VERBS set: this fixture needs
  // to fill every cell the validator itself would call a placeholder, not just the ones
  // literally starting with "Record" -- the shipped template also opens cells with "Define",
  // "Choose", etc., and leaving those unfilled means this "completed" fixture was never
  // actually complete, so its assertions proved nothing about the cells it didn't touch.
  const TEMPLATE_DIRECTIVE_VERBS_PATTERN =
    /^\s*(?:add|added|capture|captured|choose|chosen|complete|completed|define|defined|describe|described|document|documented|enter|entered|fill|filled|finish|finished|include|included|insert|inserted|mark|marked|note|noted|provide|provided|record|replace|replaced|select|selected|specify|specified|update|updated|write|written)\b/i;

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

  const deferredWithLegacyArtifact = makeFixture("onboarding-graph-deferred-with-legacy-artifact");
  {
    const state = readState(deferredWithLegacyArtifact);
    const lane = getLane(state, "onboarding");
    lane["status"] = "deferred";
    lane["blockers"] = ["2026-08-08 founder deferred onboarding until the product hypothesis is validated"];
    writeState(deferredWithLegacyArtifact, state);
    writeFileSync(onboardingPath(deferredWithLegacyArtifact), "# Legacy onboarding notes\n\nRetained for history.\n", "utf8");
  }
  runFixture("explicitly deferred onboarding ignores a retained legacy artifact", deferredWithLegacyArtifact, "check-onboarding-graph.ts", 0);

  const doneWithPlaceholders = makeFixture("onboarding-graph-done-with-placeholders");
  {
    markOnboardingDone(doneWithPlaceholders);
  }
  runFixture(
    "done onboarding lane with not_started nodes and template records fails",
    doneWithPlaceholders,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.placeholder_complete",
  );

  const doneWithRenamedPlaceholders = makeFixture("onboarding-graph-done-with-renamed-placeholders");
  {
    markOnboardingDone(doneWithRenamedPlaceholders);
    mutateOnboarding(doneWithRenamedPlaceholders, (text) => text.replaceAll("not_started", "done").replaceAll("Record", "Completed"));
  }
  runFixture(
    "renaming template directives does not create a completed onboarding contract",
    doneWithRenamedPlaceholders,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.placeholder_complete",
  );

  const doneWithOrdinaryRecordProse = makeFixture("onboarding-graph-done-with-ordinary-record-prose");
  {
    markOnboardingDone(doneWithOrdinaryRecordProse);
    mutateOnboarding(doneWithOrdinaryRecordProse, (text) => {
      const completed = fillTemplateDirectiveCells(text.replaceAll("not_started", "done"));
      return `${completed}\nThis remains the canonical execution record for the completed onboarding system.\n`;
    });
  }
  runFixture("completed onboarding may use the ordinary word record outside template cells", doneWithOrdinaryRecordProse, "check-onboarding-graph.ts", 0);
  runFixture("a genuinely completed onboarding graph also satisfies --require-done", doneWithOrdinaryRecordProse, "check-onboarding-graph.ts", 0, undefined, [
    "--require-done",
  ]);

  // ONB-22's own catalog gate (check:onboarding-graph-complete) passes --require-done
  // unconditionally -- the shipped template's lane is still not_started, so this is the
  // one case that must fail even though the lenient baseline case above passes clean.
  runFixture(
    "the shipped template's own gate (--require-done) refuses to accept an unstarted onboarding lane",
    baseline,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.not_marked_done",
    ["--require-done"],
  );

  function markOnboardingDone(fixtureRoot: string): void {
    const state = readState(fixtureRoot);
    const lane = getLane(state, "onboarding");
    lane["status"] = "done";
    lane["evidence"] = ["product/ONBOARDING.md", "product/onboarding.html"];
    writeState(fixtureRoot, state);
  }

  function fillTemplateDirectiveCells(text: string): string {
    let evidenceNumber = 0;
    return text
      .split("\n")
      .map((line) => {
        if (!line.trim().startsWith("|")) return line;
        return line
          .split("|")
          .map((cell) => {
            if (!TEMPLATE_DIRECTIVE_VERBS_PATTERN.test(cell)) return cell;
            evidenceNumber += 1;
            return ` Evidence-${evidenceNumber}: source-backed implementation detail dated 2026-08-08 `;
          })
          .join("|");
      })
      .join("\n");
  }
}
