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
      const completed = checkVerificationItems(fillProseDirectiveLines(fillTemplateDirectiveCells(text.replaceAll("not_started", "done"))));
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

  const doneWithUncheckedVerification = makeFixture("onboarding-graph-done-with-unchecked-verification");
  {
    markOnboardingDone(doneWithUncheckedVerification);
    // Same table- and prose-filling treatment as the passing "genuinely completed" fixture
    // above, but the Verification section's own "- [ ]" checklist is deliberately left untouched.
    mutateOnboarding(doneWithUncheckedVerification, (text) => fillProseDirectiveLines(fillTemplateDirectiveCells(text.replaceAll("not_started", "done"))));
  }
  runFixture(
    "a done lane with every Verification checklist item still unchecked fails",
    doneWithUncheckedVerification,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.verification_incomplete",
    ["--require-done"],
  );

  const statusColumnSpoofed = makeFixture("onboarding-graph-status-column-spoofed");
  {
    markOnboardingDone(statusColumnSpoofed);
    mutateOnboarding(statusColumnSpoofed, (text) => {
      const filled = checkVerificationItems(fillProseDirectiveLines(fillTemplateDirectiveCells(text.replaceAll("not_started", "done"))));
      // ONB-01's row now reads "done" in the Status column like every other row from the blanket
      // replace above; put it back to "partial" there while planting the literal word "done" in
      // its Result cell, proving the checker reads the Status column specifically, not any cell
      // in the row.
      return filled.replace(
        "| `ONB-01` | done | Engineering and product | Trace the current implementation |",
        "| `ONB-01` | partial | Engineering and product | done, this work is done |",
      );
    });
  }
  runFixture(
    "a Graph Run row's non-status cell mentioning done does not substitute for its Status column",
    statusColumnSpoofed,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.node_not_done",
    ["--require-done"],
  );

  const doneWithLegitimateAnswerWords = makeFixture("onboarding-graph-done-with-legitimate-answer-words");
  {
    markOnboardingDone(doneWithLegitimateAnswerWords);
    mutateOnboarding(doneWithLegitimateAnswerWords, (text) => {
      const filled = checkVerificationItems(fillProseDirectiveLines(fillTemplateDirectiveCells(text.replaceAll("not_started", "done"))));
      // The template itself prescribes these as the terminal answer format ("Yes or no" / "Pass
      // or gaps"); a real completed launch collapses them to the single chosen word.
      return filled.replaceAll("Yes or no", "Yes").replaceAll("Pass or gaps", "Pass");
    });
  }
  runFixture(
    "completed onboarding may answer Required/QA cells with the template's own prescribed Yes/Pass terminal words",
    doneWithLegitimateAnswerWords,
    "check-onboarding-graph.ts",
    0,
    undefined,
    ["--require-done"],
  );

  const doneWithUnfilledProseDirective = makeFixture("onboarding-graph-done-with-unfilled-prose-directive");
  {
    markOnboardingDone(doneWithUnfilledProseDirective);
    // Table cells, checklist, and status header are all completed, but the Execution Mode
    // section's own directive-verb-led paragraph ("Record `greenfield`, ...") is left exactly
    // as the shipped template wrote it -- table-only placeholder detection would miss this.
    mutateOnboarding(doneWithUnfilledProseDirective, (text) => checkVerificationItems(fillTemplateDirectiveCells(text.replaceAll("not_started", "done"))));
  }
  runFixture(
    "a done lane with an unfilled prose directive (Execution Mode, evidence trace, ...) fails",
    doneWithUnfilledProseDirective,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.placeholder_complete",
    ["--require-done"],
  );

  const staleStatusHeader = makeFixture("onboarding-graph-stale-status-header");
  {
    markOnboardingDone(staleStatusHeader);
    mutateOnboarding(staleStatusHeader, (text) => {
      const filled = checkVerificationItems(fillProseDirectiveLines(fillTemplateDirectiveCells(text.replaceAll("not_started", "done"))));
      // Every node, checklist item, and table cell now says done; put only the artifact's own
      // top-of-document "Status: `done`" header back to "partial" to prove it is independently
      // required to agree, not just inferred from everything else being done.
      return filled.replace("Status: `done`", "Status: `partial`");
    });
  }
  runFixture(
    "a done lane whose artifact Status header still says partial fails",
    staleStatusHeader,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.artifact_status_not_done",
    ["--require-done"],
  );

  const deferredRequireDone = makeFixture("onboarding-graph-deferred-require-done");
  {
    const state = readState(deferredRequireDone);
    const lane = getLane(state, "onboarding");
    lane["status"] = "deferred";
    lane["blockers"] = ["2026-08-08 founder deferred onboarding until the product hypothesis is validated"];
    writeState(deferredRequireDone, state);
  }
  runFixture("the general onboarding-graph check still honors an explicit deferral", deferredRequireDone, "check-onboarding-graph.ts", 0);
  runFixture(
    "a deferred onboarding lane still fails ONB-22's own --require-done gate",
    deferredRequireDone,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.not_marked_done",
    ["--require-done"],
  );

  function checkVerificationItems(text: string): string {
    return text.replace(/^-\s*\[\s*\]/gm, "- [x]");
  }

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

  // Mirrors check-onboarding-graph.ts's own proseDirectiveLines(): fills paragraph-level
  // directive lines (Execution Mode, Source Map And Current-State Trace, ...) the table-cell
  // filler above never touches. Several of these same sentences are also where requirePhrases()
  // finds its required doctrine phrases (e.g. line 105's "Define First value rendered, First
  // value engaged, Activation, ..." carries three of onboarding_graph.activation_contract's
  // required phrases) -- replacing the whole line would make those checks fail too. Swap only
  // the leading verb for a word outside TEMPLATE_DIRECTIVE_VERBS_PATTERN, keeping the rest of
  // the sentence (and its required phrases) verbatim.
  function fillProseDirectiveLines(text: string): string {
    return text
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.length === 0 || trimmed.startsWith("|") || trimmed.startsWith("#") || trimmed.startsWith("-")) return line;
        if (!TEMPLATE_DIRECTIVE_VERBS_PATTERN.test(line)) return line;
        return line.replace(/^(\s*)[A-Za-z]+/, "$1Confirmed");
      })
      .join("\n");
  }
}
