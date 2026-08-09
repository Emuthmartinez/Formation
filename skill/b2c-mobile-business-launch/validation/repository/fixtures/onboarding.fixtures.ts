import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  const requiredSectionInFence = makeFixture("onboarding-graph-required-section-in-fence");
  mutateOnboarding(requiredSectionInFence, (text) => {
    // Relocate the entire live "## Privacy And Security" section into a fenced code sample,
    // leaving it absent from the live document -- hasHeading() has no notion of fences, so
    // before liveText was computed up front (and used for every structural check, not only the
    // deep --require-done block) this would have still been accepted as present.
    const section = text.match(/## Privacy And Security\n[\s\S]*?(?=\n## )/)?.[0];
    if (!section) throw new Error("fixture setup: could not locate the Privacy And Security section to relocate");
    const withoutLiveSection = text.replace(section, "");
    return `${withoutLiveSection}\n\`\`\`markdown\n${section}\n\`\`\`\n`;
  });
  runFixture(
    "a required section relocated into a fenced example still fails as missing",
    requiredSectionInFence,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.section_privacy_and_security_missing",
  );

  const requiredSectionInHtmlComment = makeFixture("onboarding-graph-required-section-in-html-comment");
  mutateOnboarding(requiredSectionInHtmlComment, (text) => {
    // Same relocation as requiredSectionInFence, but into an HTML comment rather than a
    // triple-backtick fence -- a comment renders nothing at all, yet stripFencedBlocks() only
    // ever stripped backtick fences, so this form stayed live and readable to every structural
    // check.
    const section = text.match(/## Performance And Observability\n[\s\S]*?(?=\n## )/)?.[0];
    if (!section) throw new Error("fixture setup: could not locate the Performance And Observability section to relocate");
    const withoutLiveSection = text.replace(section, "");
    return `${withoutLiveSection}\n<!--\n${section}\n-->\n`;
  });
  runFixture(
    "a required section relocated into an HTML comment still fails as missing",
    requiredSectionInHtmlComment,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.section_performance_and_observability_missing",
  );

  const requiredSectionInTildeFence = makeFixture("onboarding-graph-required-section-in-tilde-fence");
  mutateOnboarding(requiredSectionInTildeFence, (text) => {
    // Same relocation again, into a CommonMark tilde fence (~~~) -- an equally valid fence
    // delimiter to triple backticks, which stripFencedBlocks() never recognized at all.
    const section = text.match(/## Accessibility And Localization\n[\s\S]*?(?=\n## )/)?.[0];
    if (!section) throw new Error("fixture setup: could not locate the Accessibility And Localization section to relocate");
    const withoutLiveSection = text.replace(section, "");
    return `${withoutLiveSection}\n~~~markdown\n${section}\n~~~\n`;
  });
  runFixture(
    "a required section relocated into a tilde fence still fails as missing",
    requiredSectionInTildeFence,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.section_accessibility_and_localization_missing",
  );

  const requiredSectionInUnterminatedFence = makeFixture("onboarding-graph-required-section-in-unterminated-fence");
  mutateOnboarding(requiredSectionInUnterminatedFence, (text) => {
    // Same relocation again, but the opening fence is never closed -- CommonMark still renders
    // an unterminated fence as extending to the end of the document (code, not prose), yet the
    // old paired-delimiter regex required a closing run of backticks to match anything at all,
    // so with no closer present it stripped nothing and left the relocated heading exactly as
    // live and findable as if it had never been fenced.
    const section = text.match(/## Prototype And Design Proof\n[\s\S]*?(?=\n## )/)?.[0];
    if (!section) throw new Error("fixture setup: could not locate the Prototype And Design Proof section to relocate");
    const withoutLiveSection = text.replace(section, "");
    return `${withoutLiveSection}\n\`\`\`markdown\n${section}\n`;
  });
  runFixture(
    "a required section relocated into an unterminated fence still fails as missing",
    requiredSectionInUnterminatedFence,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.section_prototype_and_design_proof_missing",
  );

  const requiredSectionAfterShortInnerFence = makeFixture("onboarding-graph-required-section-after-short-inner-fence");
  mutateOnboarding(requiredSectionAfterShortInnerFence, (text) => {
    // Opens with a four-backtick fence, then contains a three-backtick run before the relocated
    // section and a real four-backtick closer after it. CommonMark only closes a fence with a
    // same-character run at least as long as the opener, so the inner three-backtick line is
    // literal fence content, not a closer -- the whole block, including the relocated section,
    // stays hidden until the real four-backtick closer. A naive "any run of 3+ backticks closes
    // it" strip would stop at the inner three-backtick line instead, leaving the section (and the
    // real closer line after it) live and readable.
    const section = text.match(/## Synthetic One-Star Pre-Mortem\n[\s\S]*?(?=\n## )/)?.[0];
    if (!section) throw new Error("fixture setup: could not locate the Synthetic One-Star Pre-Mortem section to relocate");
    const withoutLiveSection = text.replace(section, "");
    return `${withoutLiveSection}\n\`\`\`\`markdown\nA decoy line that looks like a fence close but is too short to be one.\n\`\`\`\n${section}\n\`\`\`\`\n`;
  });
  runFixture(
    "a required section placed after a shorter inner fence run (not a real closer) still fails as missing",
    requiredSectionAfterShortInnerFence,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.section_synthetic_one_star_pre_mortem_missing",
  );

  const requiredHeadingIndented = makeFixture("onboarding-graph-required-heading-indented");
  mutateOnboarding(requiredHeadingIndented, (text) =>
    // Indenting the heading line by 4 spaces turns it into a CommonMark indented code block (a
    // completely different construct from a heading) rather than a fence or comment -- it is
    // preceded by a blank line in the shipped template, which is what lets an indented line begin
    // a code block instead of lazily continuing a paragraph. hasHeading() has no notion of
    // indentation and only ever compares each line's own *trimmed* text, so an indented,
    // non-rendering heading line still registered as the section being present.
    text.replace("## Verification\n", "    ## Verification\n"),
  );
  runFixture(
    "a required heading indented into a CommonMark code block still fails as missing",
    requiredHeadingIndented,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.section_verification_missing",
  );

  const requiredSectionInScriptBlock = makeFixture("onboarding-graph-required-section-in-script-block");
  mutateOnboarding(requiredSectionInScriptBlock, (text) => {
    // Relocate the entire live "## Failure And Recovery" section into a <script type="text/plain">
    // block -- a browser never renders script content as visible page text, the same reasoning
    // already applied to HTML comments and fences, but stripNonRenderedMarkdown() had no notion of
    // raw HTML blocks at all, so before this fix the relocated heading stayed live and findable.
    const section = text.match(/## Failure And Recovery\n[\s\S]*?(?=\n## )/)?.[0];
    if (!section) throw new Error("fixture setup: could not locate the Failure And Recovery section to relocate");
    const withoutLiveSection = text.replace(section, "");
    return `${withoutLiveSection}\n<script type="text/plain">\n${section}\n</script>\n`;
  });
  runFixture(
    "a required section relocated into a script block still fails as missing",
    requiredSectionInScriptBlock,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.section_failure_and_recovery_missing",
  );

  const requiredHeadingTabIndented = makeFixture("onboarding-graph-required-heading-tab-indented");
  mutateOnboarding(requiredHeadingTabIndented, (text) =>
    // A single leading tab expands to CommonMark's own 4-column tab stop, the same indentation
    // threshold as four literal spaces -- it is preceded by a blank line in the shipped template,
    // so it opens an indented code block exactly like the space-indented case above. A check that
    // only recognized four literal space characters would miss this and still find the heading.
    text.replace("## Permissions And Lifecycle\n", "\t## Permissions And Lifecycle\n"),
  );
  runFixture(
    "a required heading indented with a tab into a CommonMark code block still fails as missing",
    requiredHeadingTabIndented,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.section_permissions_and_lifecycle_missing",
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

  const doneWithTodoInInlineCodeSpan = makeFixture("onboarding-graph-done-with-todo-in-inline-code-span");
  {
    markOnboardingDone(doneWithTodoInInlineCodeSpan);
    mutateOnboarding(doneWithTodoInInlineCodeSpan, (text) => {
      const completed = checkVerificationItems(fillProseDirectiveLines(fillTemplateDirectiveCells(text.replaceAll("not_started", "done"))));
      // A triple-backtick code SPAN (CommonMark allows any run length as a code-span delimiter,
      // not just single backticks) sitting mid-line inside a sentence -- not alone on its own
      // line -- is not a fence at all; the rendered document shows TODO right there, in the open.
      // A fence-stripper that matches a run of 3+ backticks anywhere, ignoring line position,
      // cannot tell this apart from a real fence and would erase the word along with its
      // delimiters, hiding a genuine unfinished-work marker from the placeholder scan below.
      return `${completed}\nThis section still displays \`\`\`TODO\`\`\` inline as a worked example of what NOT to leave in a finished artifact.\n`;
    });
  }
  runFixture(
    "a TODO marker inside an inline triple-backtick code span still fails --require-done as incomplete",
    doneWithTodoInInlineCodeSpan,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.placeholder_complete",
    ["--require-done"],
  );

  const doneWithTodoAfterIndentedFenceLookalike = makeFixture("onboarding-graph-done-with-todo-after-indented-fence-lookalike");
  {
    markOnboardingDone(doneWithTodoAfterIndentedFenceLookalike);
    mutateOnboarding(doneWithTodoAfterIndentedFenceLookalike, (text) => {
      const completed = checkVerificationItems(fillProseDirectiveLines(fillTemplateDirectiveCells(text.replaceAll("not_started", "done"))));
      // Both backtick runs are indented 4 spaces -- CommonMark's own cutoff for "this indentation
      // starts an indented code block instead of a fence" (a fence may be indented at most 3
      // spaces). A position-blind stripper that ignores indentation would still pair these two
      // runs as an opener/closer and erase the live TODO line sitting between them; a real
      // renderer never treats either line as a fence delimiter, so the TODO stays visible.
      return `${completed}\n    \`\`\`\nThis line still visibly says TODO and sits between two over-indented backtick runs.\n    \`\`\`\n`;
    });
  }
  runFixture(
    "a TODO marker between two over-indented (4-space) backtick runs still fails --require-done as incomplete",
    doneWithTodoAfterIndentedFenceLookalike,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.placeholder_complete",
    ["--require-done"],
  );

  const doneWithIndentedGraphRunTable = makeFixture("onboarding-graph-done-with-indented-graph-run-table");
  {
    markOnboardingDone(doneWithIndentedGraphRunTable);
    mutateOnboarding(doneWithIndentedGraphRunTable, (text) => {
      const completed = checkVerificationItems(fillProseDirectiveLines(fillTemplateDirectiveCells(text.replaceAll("not_started", "done"))));
      // Indenting the whole Graph Run table by 4 spaces turns it into a CommonMark indented code
      // block (preceded by the blank line right after the "## Graph Run" heading) -- a rendered
      // page shows this as inert code text, not as the graph's actual completion record.
      // graphRunRows() has no notion of indentation and only ever matches each line's own
      // *trimmed* text against "starts with |", so an indented, non-rendering table still
      // registered every node as done.
      const table = completed.match(/\| Node \| Status \| Owner \| Result or next action \|\n(?:\|.*\|\n?)+/);
      if (!table) throw new Error("fixture setup: could not locate the Graph Run table to indent");
      const indented = table[0]
        .split("\n")
        .map((line) => (line.length > 0 ? `    ${line}` : line))
        .join("\n");
      return completed.replace(table[0], indented);
    });
  }
  runFixture(
    "a Graph Run table indented into a CommonMark code block still fails every node as not done",
    doneWithIndentedGraphRunTable,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.node_not_done",
    ["--require-done"],
  );

  // ONB-22's own catalog gate (check:onboarding-graph-complete) passes --require-done
  // unconditionally -- the shipped template's Graph Run table still reads not_started for every
  // node, so this is the one case that must fail even though the lenient baseline case above
  // passes clean. This no longer depends on lanes.onboarding.status: the content checks below
  // (which --require-done always runs, regardless of that field's value) reject the unstarted
  // template on their own.
  runFixture(
    "the shipped template's own gate (--require-done) refuses to accept an unstarted onboarding lane",
    baseline,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.placeholder_complete",
    ["--require-done"],
  );

  const completeArtifactLaneNeverMarkedDone = makeFixture("onboarding-graph-complete-artifact-lane-never-marked-done");
  {
    // Deliberately does NOT call markOnboardingDone -- lanes.onboarding.status stays at the
    // shipped default (not_started), exactly as it would in a real durable-engine run: no
    // production code path ever commits lanes.onboarding.status to "done" as a *result* of
    // ONB-22's gate passing (core/engine/runstate.ts's reconcilePatch()/acceptVerification() only
    // mutate run-state.json, never business-state.json). Requiring that field to already say done
    // as --require-done's own precondition was therefore a deadlock the engine could never
    // legitimately clear -- this proves the artifact's own content is sufficient on its own.
    mutateOnboarding(completeArtifactLaneNeverMarkedDone, (text) => {
      const completed = checkVerificationItems(fillProseDirectiveLines(fillTemplateDirectiveCells(text.replaceAll("not_started", "done"))));
      return `${completed}\nThis remains the canonical execution record for the completed onboarding system.\n`;
    });
  }
  runFixture(
    "ONB-22's --require-done gate passes on a genuinely complete artifact even though lanes.onboarding.status was never externally marked done",
    completeArtifactLaneNeverMarkedDone,
    "check-onboarding-graph.ts",
    0,
    undefined,
    ["--require-done"],
  );

  // A durable-engine-managed v2 workspace has no state/PROJECT_STATE.yaml at all (its canonical
  // state is state/business-state.json, per core/session/run.ts's resolveWorkspacePaths()) --
  // without loadLaneFromBusinessStateV2()'s fallback in check-onboarding-graph.ts, ONB-22's own
  // --require-done gate would report the lane permanently missing on every genuinely completed
  // v2 run, since loadProjectState() alone only ever reads the v1 file. buildValidBusinessStateV2
  // produces a complete, schema-valid document (loadLaneFromBusinessStateV2 runs every v2 document
  // through validateBusinessState() and fails closed on anything less -- a fixture using a partial
  // object would test a state the real validator never actually accepts).
  const ALL_LANE_KEYS = [
    "paid_tool_routing",
    "secrets",
    "security",
    "research",
    "traceability",
    "experience",
    "product",
    "design",
    "emotional_design",
    "content_assets",
    "analytics_attribution",
    "paid_user_acquisition",
    "onboarding",
    "revenue",
    "store_console",
    "apple_signing",
    "privacy_legal",
    "email",
    "orchestration",
    "engineering",
    "growth",
    "post_launch_ops",
  ];

  function buildValidBusinessStateV2(onboardingLane: { status: string; evidence: string[]; blockers: string[] }): Record<string, unknown> {
    const lanes: Record<string, unknown> = {};
    for (const key of ALL_LANE_KEYS) {
      lanes[key] = key === "onboarding" ? onboardingLane : { status: "pending", evidence: [], blockers: [] };
    }
    return {
      schemaVersion: "2.0.0",
      updatedAt: "2026-08-09T00:00:00.000Z",
      narrative: { sinceLastTime: "", rightNow: "", yourCall: "", lastCelebratedPhase: "" },
      project: {
        name: "Fixture App",
        slug: "fixture-app",
        owner: "Founder",
        phase: "phase_2_build",
        launchScope: "essentials",
        kickoffDate: "",
        platforms: ["ios"],
        bundleIds: { ios: "com.example.app", android: "" },
        publicUrls: { landing: "", privacy: "", terms: "" },
      },
      lanes,
      founderGates: { pending: [] },
    };
  }

  const v2LaneComplete = makeFixture("onboarding-graph-v2-business-state-complete");
  {
    rmSync(path.join(v2LaneComplete, "state/PROJECT_STATE.yaml"), { force: true });
    writeFileSync(
      path.join(v2LaneComplete, "state/business-state.json"),
      JSON.stringify(buildValidBusinessStateV2({ status: "succeeded", evidence: ["product/ONBOARDING.md", "product/onboarding.html"], blockers: [] })),
      "utf8",
    );
    mutateOnboarding(v2LaneComplete, (text) => {
      const completed = checkVerificationItems(fillProseDirectiveLines(fillTemplateDirectiveCells(text.replaceAll("not_started", "done"))));
      return `${completed}\nThis remains the canonical execution record for the completed onboarding system.\n`;
    });
  }
  runFixture(
    "a v2 workspace with no PROJECT_STATE.yaml reads a completed lanes.onboarding from state/business-state.json and satisfies --require-done",
    v2LaneComplete,
    "check-onboarding-graph.ts",
    0,
    undefined,
    ["--require-done"],
  );

  const v2LanePendingIncompleteArtifact = makeFixture("onboarding-graph-v2-business-state-pending-incomplete-artifact");
  {
    rmSync(path.join(v2LanePendingIncompleteArtifact, "state/PROJECT_STATE.yaml"), { force: true });
    writeFileSync(
      path.join(v2LanePendingIncompleteArtifact, "state/business-state.json"),
      JSON.stringify(buildValidBusinessStateV2({ status: "pending", evidence: [], blockers: [] })),
      "utf8",
    );
  }
  runFixture(
    "a v2 workspace with an unfinished onboarding lane and an unfinished artifact still fails --require-done",
    v2LanePendingIncompleteArtifact,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.placeholder_complete",
    ["--require-done"],
  );

  // lanes.onboarding.status never legitimately becomes "succeeded" as a *result* of ONB-22's own
  // gate passing under the durable engine (core/engine/runstate.ts's reconcilePatch()/
  // acceptVerification() only ever mutate run-state.json, never business-state.json) -- so a
  // canonical v2 lane realistically sits at "pending" for the entire run, including at the exact
  // moment ONB-22 itself finally executes. --require-done must not deadlock on that: it validates
  // the artifact's own content, not an externally-tracked field nothing ever sets to done for it.
  const v2LanePendingCompleteArtifact = makeFixture("onboarding-graph-v2-business-state-pending-complete-artifact");
  {
    rmSync(path.join(v2LanePendingCompleteArtifact, "state/PROJECT_STATE.yaml"), { force: true });
    writeFileSync(
      path.join(v2LanePendingCompleteArtifact, "state/business-state.json"),
      JSON.stringify(buildValidBusinessStateV2({ status: "pending", evidence: [], blockers: [] })),
      "utf8",
    );
    mutateOnboarding(v2LanePendingCompleteArtifact, (text) => {
      const completed = checkVerificationItems(fillProseDirectiveLines(fillTemplateDirectiveCells(text.replaceAll("not_started", "done"))));
      return `${completed}\nThis remains the canonical execution record for the completed onboarding system.\n`;
    });
  }
  runFixture(
    "ONB-22's --require-done gate does not deadlock on a canonical v2 lane still pending once the artifact itself is genuinely complete",
    v2LanePendingCompleteArtifact,
    "check-onboarding-graph.ts",
    0,
    undefined,
    ["--require-done"],
  );

  // check-onboarding-graph.ts must fail closed on a malformed/partial business-state.json, never
  // silently extract the one field it wants from an unvalidated document -- a corrupt canonical
  // file must not quietly authorize the destructive ONB-22 cutover.
  const v2LaneInvalid = makeFixture("onboarding-graph-v2-business-state-invalid");
  {
    rmSync(path.join(v2LaneInvalid, "state/PROJECT_STATE.yaml"), { force: true });
    writeFileSync(
      path.join(v2LaneInvalid, "state/business-state.json"),
      JSON.stringify({ schemaVersion: "2.0.0", lanes: { onboarding: { status: "succeeded", evidence: [], blockers: [] } } }),
      "utf8",
    );
  }
  runFixture(
    "a malformed business-state.json (missing required top-level fields) fails closed instead of trusting its one readable field",
    v2LaneInvalid,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.business_state_invalid",
  );

  // A migrated workspace can retain a stale v1 PROJECT_STATE.yaml alongside the live v2 document --
  // the engine only ever writes v2, so v2 must win even when v1 is also present. --require-done no
  // longer depends on lanes.onboarding.status's value at all (see the deadlock fixtures above), but
  // the general (non-strict) check still uses it to decide whether to run the deep completion
  // checks in the first place: if it wrongly trusted a stale v1 "done" over canonical v2's
  // "pending", it would run those checks against this fixture's deliberately untouched (still
  // unstarted) artifact and fail on the placeholder content -- passing cleanly here proves it
  // correctly used v2's "pending" (which the general check does not treat as a completion claim)
  // instead.
  const v2WinsOverStaleV1Done = makeFixture("onboarding-graph-v2-wins-over-stale-v1-done");
  {
    const v1State = readState(v2WinsOverStaleV1Done);
    getLane(v1State, "onboarding")["status"] = "done";
    writeState(v2WinsOverStaleV1Done, v1State);
    writeFileSync(
      path.join(v2WinsOverStaleV1Done, "state/business-state.json"),
      JSON.stringify(buildValidBusinessStateV2({ status: "pending", evidence: [], blockers: [] })),
      "utf8",
    );
  }
  runFixture(
    "the general onboarding-graph check trusts canonical v2 pending over a stale v1 done, rather than running deep checks against an unfinished artifact",
    v2WinsOverStaleV1Done,
    "check-onboarding-graph.ts",
    0,
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

  const duplicateGraphRunRow = makeFixture("onboarding-graph-duplicate-row");
  {
    markOnboardingDone(duplicateGraphRunRow);
    mutateOnboarding(duplicateGraphRunRow, (text) => {
      const filled = checkVerificationItems(fillProseDirectiveLines(fillTemplateDirectiveCells(text.replaceAll("not_started", "done"))));
      // A resumed or merged run can retain a stale row for a node alongside a freshly appended
      // one instead of updating it in place -- duplicate ONB-01's row with a conflicting status
      // to prove the checker rejects this instead of accepting the node because some row says done.
      return filled.replace(
        "| `ONB-01` | done | Engineering and product | Trace the current implementation |",
        "| `ONB-01` | partial | Engineering and product | Trace the current implementation |\n| `ONB-01` | done | Engineering and product | Trace the current implementation |",
      );
    });
  }
  runFixture(
    "duplicate Graph Run rows for one node fail even when one of them says done",
    duplicateGraphRunRow,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.node_duplicate_row",
    ["--require-done"],
  );

  const fencedFakeGraphRunTable = makeFixture("onboarding-graph-fenced-fake-table");
  {
    markOnboardingDone(fencedFakeGraphRunTable);
    mutateOnboarding(fencedFakeGraphRunTable, (text) => {
      const completed = checkVerificationItems(fillProseDirectiveLines(fillTemplateDirectiveCells(text.replaceAll("not_started", "done"))));
      const graphRunSection = completed.match(/## Graph Run\n[\s\S]*?(?=\n## )/)?.[0];
      if (!graphRunSection) throw new Error("fixture setup: could not locate the Graph Run section to relocate");
      // Remove the live "## Graph Run" heading and table entirely and relocate the exact same
      // (all-done) content into a fenced code sample instead -- it is now the ONLY "## Graph Run"
      // heading anywhere in the document. sectionBody()'s own line search finds whichever "##
      // Graph Run" line comes first with no regard for fences, so before this fix this fenced
      // sample would have been picked up as the canonical run record and accepted every node as
      // done; after the fix, graphRunNodeStatus() reads only the fence-stripped live text, finds
      // no live Graph Run table at all, and correctly reports every node as not recorded.
      const withoutLiveTable = completed.replace(graphRunSection, "");
      return `${withoutLiveTable}\n\`\`\`markdown\n${graphRunSection}\n\`\`\`\n`;
    });
  }
  runFixture(
    "a fenced fake Graph Run table cannot substitute for the removed live one",
    fencedFakeGraphRunTable,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.node_not_done",
    ["--require-done"],
  );

  const verificationChecklistDeleted = makeFixture("onboarding-graph-verification-checklist-deleted");
  {
    markOnboardingDone(verificationChecklistDeleted);
    mutateOnboarding(verificationChecklistDeleted, (text) => {
      const completed = fillProseDirectiveLines(fillTemplateDirectiveCells(text.replaceAll("not_started", "done")));
      // Delete every Verification checklist item outright (not just leave it unchecked) --
      // countUncheckedItems() alone reads 0 just as happily on an emptied section as on a
      // genuinely completed one, so this must be caught by a minimum-item-count check instead.
      return completed.replace(/## Verification[\s\S]*$/, "## Verification\n");
    });
  }
  runFixture(
    "deleting the Verification checklist outright still fails even though nothing is left unchecked",
    verificationChecklistDeleted,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.verification_items_missing",
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
  // --require-done's skip variable is deliberately `laneExempt && hasDeferralReason && !requireDone`
  // -- the deferral exemption belongs to the general (lenient) invocation only. Under
  // --require-done, ONB-22's own gate still runs the full content checks against this fixture's
  // deliberately untouched (still unstarted) artifact regardless of the deferred status, and fails
  // on the same placeholder content the baseline unstarted-template fixture does.
  runFixture(
    "a deferred onboarding lane still fails ONB-22's own --require-done gate",
    deferredRequireDone,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.placeholder_complete",
    ["--require-done"],
  );

  const deferredWithoutReason = makeFixture("onboarding-graph-deferred-without-reason");
  {
    const state = readState(deferredWithoutReason);
    const lane = getLane(state, "onboarding");
    lane["status"] = "deferred";
    // Deliberately no blockers or reason recorded -- evidence alone (already present from
    // markOnboardingDone-adjacent shipped state) is not an explanation of why the lane stopped.
    writeState(deferredWithoutReason, state);
  }
  runFixture(
    "a deferred lane with no recorded blockers or reason fails even the general check",
    deferredWithoutReason,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.deferred_without_reason",
  );

  const doneWithCounterBoilerplate = makeFixture("onboarding-graph-done-with-counter-boilerplate");
  {
    markOnboardingDone(doneWithCounterBoilerplate);
    // Every directive cell gets the exact same boilerplate sentence with only an incrementing
    // number varying -- technically unique per cellTextCounts, but not real content.
    let counter = 0;
    mutateOnboarding(doneWithCounterBoilerplate, (text) =>
      checkVerificationItems(
        fillProseDirectiveLines(
          text
            .replaceAll("not_started", "done")
            .split("\n")
            .map((line) => {
              if (!line.trim().startsWith("|")) return line;
              return line
                .split("|")
                .map((cell) => {
                  if (!TEMPLATE_DIRECTIVE_VERBS_PATTERN.test(cell)) return cell;
                  counter += 1;
                  return ` Evidence-${counter}: source-backed implementation detail dated 2026-08-08 `;
                })
                .join("|");
            })
            .join("\n"),
        ),
      ),
    );
  }
  runFixture(
    "a done lane whose table cells are all the same counter-varying boilerplate fails",
    doneWithCounterBoilerplate,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.placeholder_complete",
    ["--require-done"],
  );

  const doneWithFixedDoctrineProse = makeFixture("onboarding-graph-done-with-fixed-doctrine-prose");
  {
    markOnboardingDone(doneWithFixedDoctrineProse);
    mutateOnboarding(doneWithFixedDoctrineProse, (text) => {
      const filled = checkVerificationItems(fillProseDirectiveLines(fillTemplateDirectiveCells(text.replaceAll("not_started", "done"))));
      // fillProseDirectiveLines swaps every directive-verb-led line's leading word, including
      // two sentences that sit directly above their own capture table (Analytics Contract's
      // "Define a machine-readable schema..." and First Value And Activation's "Define First
      // value rendered..."). Put those two back to literally "Define ..." -- exactly as shipped
      // -- while every genuine fill-in line stays filled, proving the validator's own
      // has-table-in-section exemption rather than a swapped-verb version of the same text.
      return filled
        .replace(
          "Confirmed First value rendered, First value engaged, Activation, habit signal, retention, monetization, review eligibility, and onboarding completion separately.",
          "Define First value rendered, First value engaged, Activation, habit signal, retention, monetization, review eligibility, and onboarding completion separately.",
        )
        .replace("Confirmed a machine-readable schema and typed clients.", "Define a machine-readable schema and typed clients.");
    });
  }
  runFixture(
    "fixed doctrine prose above a capture table passes even though it starts with a directive verb",
    doneWithFixedDoctrineProse,
    "check-onboarding-graph.ts",
    0,
    undefined,
    ["--require-done"],
  );

  // check-onboarding-evidence-packet.ts: ONB-03..ONB-08's own per-node deterministic gate
  // (round 5's production-verification fix). It reads --root and --path exactly the way
  // runDeterministicGates() invokes it.
  const evidenceScript = "check-onboarding-evidence-packet.ts";
  const writeEvidencePacket = (fixtureRoot: string, relativePath: string, content: string): void => {
    const filePath = path.join(fixtureRoot, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, "utf8");
  };
  const substantiveResearchProse = (topic: string): string => {
    const sentence = `This is a substantive, source-backed paragraph describing real research into ${topic}. `;
    return `## Findings\n\n${sentence.repeat(15)}\n`;
  };

  const onb00PacketMissing = makeFixture("onboarding-evidence-onb00-missing");
  runFixture(
    "ONB-00's gate fails when the resume/scope packet does not exist yet",
    onb00PacketMissing,
    evidenceScript,
    1,
    "onboarding_evidence.packet_missing",
    ["--node", "ONB-00", "--path", "product/onboarding/graph/ONB-00-resume-scope.md"],
  );

  const onb00PacketComplete = makeFixture("onboarding-evidence-onb00-complete");
  writeEvidencePacket(
    onb00PacketComplete,
    "product/onboarding/graph/ONB-00-resume-scope.md",
    substantiveResearchProse("whether this run is greenfield, replacement, audit-only, or a bounded incremental scope"),
  );
  runFixture("ONB-00's gate passes a genuinely substantive, marker-free resume/scope packet", onb00PacketComplete, evidenceScript, 0, undefined, [
    "--node",
    "ONB-00",
    "--path",
    "product/onboarding/graph/ONB-00-resume-scope.md",
  ]);

  const onb01PacketMissing = makeFixture("onboarding-evidence-onb01-missing");
  runFixture(
    "ONB-01's gate fails when the current-state trace does not exist yet",
    onb01PacketMissing,
    evidenceScript,
    1,
    "onboarding_evidence.packet_missing",
    ["--node", "ONB-01", "--path", "product/onboarding/graph/ONB-01-current-state-trace.md"],
  );

  const onb01PacketComplete = makeFixture("onboarding-evidence-onb01-complete");
  writeEvidencePacket(
    onb01PacketComplete,
    "product/onboarding/graph/ONB-01-current-state-trace.md",
    substantiveResearchProse("the actual onboarding implementation, documents, routes, state, providers, events, failures, tests, and legacy surfaces"),
  );
  runFixture("ONB-01's gate passes a genuinely substantive, marker-free current-state trace", onb01PacketComplete, evidenceScript, 0, undefined, [
    "--node",
    "ONB-01",
    "--path",
    "product/onboarding/graph/ONB-01-current-state-trace.md",
  ]);

  const onb02PacketMissing = makeFixture("onboarding-evidence-onb02-missing");
  runFixture("ONB-02's gate fails when the evidence plan does not exist yet", onb02PacketMissing, evidenceScript, 1, "onboarding_evidence.packet_missing", [
    "--node",
    "ONB-02",
    "--path",
    "product/onboarding/graph/ONB-02-evidence-plan.md",
  ]);

  const onb02PacketComplete = makeFixture("onboarding-evidence-onb02-complete");
  writeEvidencePacket(
    onb02PacketComplete,
    "product/onboarding/graph/ONB-02-evidence-plan.md",
    substantiveResearchProse("the onboarding evidence hierarchy, access constraints, sample plan, and freshness cutoff"),
  );
  runFixture("ONB-02's gate passes a genuinely substantive, marker-free evidence plan", onb02PacketComplete, evidenceScript, 0, undefined, [
    "--node",
    "ONB-02",
    "--path",
    "product/onboarding/graph/ONB-02-evidence-plan.md",
  ]);

  const evidencePacketMissing = makeFixture("onboarding-evidence-packet-missing");
  runFixture(
    "ONB-03's gate fails when its evidence packet does not exist yet",
    evidencePacketMissing,
    evidenceScript,
    1,
    "onboarding_evidence.packet_missing",
    ["--node", "ONB-03", "--path", "product/onboarding/graph/ONB-03-current-guidance.md"],
  );

  const evidencePacketThin = makeFixture("onboarding-evidence-packet-thin");
  writeEvidencePacket(evidencePacketThin, "product/onboarding/graph/ONB-04-competitor-reviews.md", "## Findings\n\nDone.\n");
  runFixture("ONB-04's gate rejects a stub-length evidence packet", evidencePacketThin, evidenceScript, 1, "onboarding_evidence.packet_too_thin", [
    "--node",
    "ONB-04",
    "--path",
    "product/onboarding/graph/ONB-04-competitor-reviews.md",
  ]);

  const evidencePacketHtmlCommentOnly = makeFixture("onboarding-evidence-packet-html-comment-only");
  writeEvidencePacket(
    evidencePacketHtmlCommentOnly,
    "product/onboarding/graph/ONB-04-competitor-reviews.md",
    `<!--\n${substantiveResearchProse("a competitor review that was never actually written, only faked inside this comment")}\n-->\n`,
  );
  runFixture(
    "an evidence packet whose only content is inside an HTML comment still fails as thin",
    evidencePacketHtmlCommentOnly,
    evidenceScript,
    1,
    "onboarding_evidence.packet_too_thin",
    ["--node", "ONB-04", "--path", "product/onboarding/graph/ONB-04-competitor-reviews.md"],
  );

  const evidencePacketTildeFenceOnly = makeFixture("onboarding-evidence-packet-tilde-fence-only");
  writeEvidencePacket(
    evidencePacketTildeFenceOnly,
    "product/onboarding/graph/ONB-04-competitor-reviews.md",
    `~~~markdown\n${substantiveResearchProse("a competitor review that was never actually written, only faked inside this tilde fence")}\n~~~\n`,
  );
  runFixture(
    "an evidence packet whose only content is inside a tilde fence still fails as thin",
    evidencePacketTildeFenceOnly,
    evidenceScript,
    1,
    "onboarding_evidence.packet_too_thin",
    ["--node", "ONB-04", "--path", "product/onboarding/graph/ONB-04-competitor-reviews.md"],
  );

  const evidencePacketUnterminatedFenceOnly = makeFixture("onboarding-evidence-packet-unterminated-fence-only");
  writeEvidencePacket(
    evidencePacketUnterminatedFenceOnly,
    "product/onboarding/graph/ONB-04-competitor-reviews.md",
    // The opening fence is never closed. CommonMark still renders everything after it as code,
    // not prose, to the end of the document -- but the old paired-delimiter regex only stripped
    // a fence when it found a matching close, so with none present here it stripped nothing and
    // this faked content still cleared the 400-character substantive-length check.
    `\`\`\`markdown\n${substantiveResearchProse("a competitor review that was never actually written, only faked inside this unterminated fence")}\n`,
  );
  runFixture(
    "an evidence packet whose only content is inside an unterminated fence still fails as thin",
    evidencePacketUnterminatedFenceOnly,
    evidenceScript,
    1,
    "onboarding_evidence.packet_too_thin",
    ["--node", "ONB-04", "--path", "product/onboarding/graph/ONB-04-competitor-reviews.md"],
  );

  const evidencePacketShortInnerFenceOnly = makeFixture("onboarding-evidence-packet-short-inner-fence-only");
  writeEvidencePacket(
    evidencePacketShortInnerFenceOnly,
    "product/onboarding/graph/ONB-04-competitor-reviews.md",
    // Four-backtick opener, a three-backtick decoy line, the faked content, then a real
    // four-backtick closer. CommonMark requires a closer at least as long as the opener, so the
    // decoy never closes the block -- the faked content stays hidden inside the fence the entire
    // way to the real closer. A strip that accepted any run of 3+ backticks as a valid closer
    // would stop at the decoy and let everything after it, including the real closer line, count
    // as live substantive text.
    `\`\`\`\`markdown\nA decoy line that looks like a fence close but is too short to be one.\n\`\`\`\n${substantiveResearchProse(
      "a competitor review that was never actually written, only faked past a too-short inner fence run",
    )}\n\`\`\`\`\n`,
  );
  runFixture(
    "an evidence packet whose only content sits past a shorter inner fence run still fails as thin",
    evidencePacketShortInnerFenceOnly,
    evidenceScript,
    1,
    "onboarding_evidence.packet_too_thin",
    ["--node", "ONB-04", "--path", "product/onboarding/graph/ONB-04-competitor-reviews.md"],
  );

  const evidencePacketIndentedContentOnly = makeFixture("onboarding-evidence-packet-indented-content-only");
  writeEvidencePacket(
    evidencePacketIndentedContentOnly,
    "product/onboarding/graph/ONB-04-competitor-reviews.md",
    // Every line indented 4 spaces at the very start of the document is a CommonMark indented
    // code block (the document start counts the same as a preceding blank line for the "cannot
    // interrupt a paragraph" rule) -- a rendered page shows this whole packet as inert code text,
    // not as a real finding. Without stripping indented code blocks the same way fenced and
    // commented-out blocks are stripped, a packet that never actually renders as prose still
    // cleared the substantive-length check.
    substantiveResearchProse("a competitor review that was never actually written, only indented into a CommonMark code block")
      .split("\n")
      .map((line) => (line.length > 0 ? `    ${line}` : line))
      .join("\n"),
  );
  runFixture(
    "an evidence packet whose only content is indented into a CommonMark code block still fails as thin",
    evidencePacketIndentedContentOnly,
    evidenceScript,
    1,
    "onboarding_evidence.packet_too_thin",
    ["--node", "ONB-04", "--path", "product/onboarding/graph/ONB-04-competitor-reviews.md"],
  );

  const evidencePacketStyleBlockOnly = makeFixture("onboarding-evidence-packet-style-block-only");
  writeEvidencePacket(
    evidencePacketStyleBlockOnly,
    "product/onboarding/graph/ONB-04-competitor-reviews.md",
    // A browser never renders <style> content as visible page text, the same non-rendering
    // reasoning already applied to HTML comments and fences -- but stripNonRenderedMarkdown() had
    // no notion of raw HTML blocks at all, so this faked content still cleared the 400-character
    // substantive-length check before this fix.
    `<style type="text/plain">\n${substantiveResearchProse(
      "a competitor review that was never actually written, only faked inside this style block",
    )}\n</style>\n`,
  );
  runFixture(
    "an evidence packet whose only content is inside a style block still fails as thin",
    evidencePacketStyleBlockOnly,
    evidenceScript,
    1,
    "onboarding_evidence.packet_too_thin",
    ["--node", "ONB-04", "--path", "product/onboarding/graph/ONB-04-competitor-reviews.md"],
  );

  const evidencePacketTabIndentedContentOnly = makeFixture("onboarding-evidence-packet-tab-indented-content-only");
  writeEvidencePacket(
    evidencePacketTabIndentedContentOnly,
    "product/onboarding/graph/ONB-04-competitor-reviews.md",
    // A single leading tab expands to CommonMark's own 4-column tab stop, the same indentation
    // threshold as four literal spaces -- a check that only recognized literal space characters
    // would miss this and let the faked content clear the substantive-length check.
    substantiveResearchProse("a competitor review that was never actually written, only tab-indented into a CommonMark code block")
      .split("\n")
      .map((line) => (line.length > 0 ? `\t${line}` : line))
      .join("\n"),
  );
  runFixture(
    "an evidence packet whose only content is tab-indented into a CommonMark code block still fails as thin",
    evidencePacketTabIndentedContentOnly,
    evidenceScript,
    1,
    "onboarding_evidence.packet_too_thin",
    ["--node", "ONB-04", "--path", "product/onboarding/graph/ONB-04-competitor-reviews.md"],
  );

  const evidencePacketTodoInInlineCodeSpan = makeFixture("onboarding-evidence-packet-todo-in-inline-code-span");
  writeEvidencePacket(
    evidencePacketTodoInInlineCodeSpan,
    "product/onboarding/graph/ONB-05-onbo-hub-atlas.md",
    // The TODO sits inside a mid-sentence triple-backtick code span, not alone on its own line --
    // a real render shows it in the open, as inline code. A position-blind fence stripper that
    // matches any run of 3+ backticks, wherever it appears, would erase the span and the word
    // along with it, letting a packet that visibly still says TODO pass the placeholder scan.
    `${substantiveResearchProse("the authorized Onbo Hub flow atlas")}\n\nThis draft still shows \`\`\`TODO\`\`\` inline where the real citation belongs.\n`,
  );
  runFixture(
    "ONB-05's gate rejects a TODO marker hidden inside an inline triple-backtick code span",
    evidencePacketTodoInInlineCodeSpan,
    evidenceScript,
    1,
    "onboarding_evidence.packet_placeholder",
    ["--node", "ONB-05", "--path", "product/onboarding/graph/ONB-05-onbo-hub-atlas.md"],
  );

  const evidencePacketPlaceholder = makeFixture("onboarding-evidence-packet-placeholder");
  writeEvidencePacket(
    evidencePacketPlaceholder,
    "product/onboarding/graph/ONB-05-onbo-hub-atlas.md",
    `${substantiveResearchProse("the authorized Onbo Hub flow atlas")}\n\nTODO: fill in the rest once access is granted.\n`,
  );
  runFixture(
    "ONB-05's gate rejects a packet that still carries a TODO/TBD/PLACEHOLDER marker",
    evidencePacketPlaceholder,
    evidenceScript,
    1,
    "onboarding_evidence.packet_placeholder",
    ["--node", "ONB-05", "--path", "product/onboarding/graph/ONB-05-onbo-hub-atlas.md"],
  );

  const evidencePacketNoProse = makeFixture("onboarding-evidence-packet-no-prose");
  writeEvidencePacket(
    evidencePacketNoProse,
    "product/onboarding/graph/ONB-06-internal-guidance-audit.md",
    `## Findings\n\n| Rule | Status |\n| --- | --- |\n${"| internal-guidance-rule | resolved |\n".repeat(20)}`,
  );
  runFixture(
    "ONB-06's gate rejects a packet with a long table but no prose finding",
    evidencePacketNoProse,
    evidenceScript,
    1,
    "onboarding_evidence.packet_no_prose",
    ["--node", "ONB-06", "--path", "product/onboarding/graph/ONB-06-internal-guidance-audit.md"],
  );

  const evidencePacketMissingPathFlag = makeFixture("onboarding-evidence-packet-missing-path-flag");
  runFixture(
    "the evidence-packet gate refuses to run without --path",
    evidencePacketMissingPathFlag,
    evidenceScript,
    1,
    "onboarding_evidence.missing_path_flag",
    ["--node", "ONB-07"],
  );

  const evidencePacketComplete = makeFixture("onboarding-evidence-packet-complete");
  writeEvidencePacket(
    evidencePacketComplete,
    "product/onboarding/graph/ONB-08-motion-research.md",
    substantiveResearchProse("60fps motion references translated into the target framework"),
  );
  runFixture("ONB-08's gate passes a genuinely substantive, marker-free evidence packet", evidencePacketComplete, evidenceScript, 0, undefined, [
    "--node",
    "ONB-08",
    "--path",
    "product/onboarding/graph/ONB-08-motion-research.md",
  ]);

  const onb20PacketMissing = makeFixture("onboarding-evidence-onb20-missing");
  runFixture(
    "ONB-20's gate fails when the adversarial-QA packet does not exist yet",
    onb20PacketMissing,
    evidenceScript,
    1,
    "onboarding_evidence.packet_missing",
    ["--node", "ONB-20", "--path", "product/onboarding/graph/ONB-20-adversarial-qa.md"],
  );

  const onb20PacketComplete = makeFixture("onboarding-evidence-onb20-complete");
  writeEvidencePacket(
    onb20PacketComplete,
    "product/onboarding/graph/ONB-20-adversarial-qa.md",
    substantiveResearchProse("the synthetic one-star pre-mortem, policy review, instrumentation QA, and accessibility review"),
  );
  runFixture("ONB-20's gate passes a genuinely substantive, marker-free adversarial-QA packet", onb20PacketComplete, evidenceScript, 0, undefined, [
    "--node",
    "ONB-20",
    "--path",
    "product/onboarding/graph/ONB-20-adversarial-qa.md",
  ]);

  const onb21PacketMissing = makeFixture("onboarding-evidence-onb21-missing");
  runFixture(
    "ONB-21's gate fails when the Compound Engineering plan does not exist yet",
    onb21PacketMissing,
    evidenceScript,
    1,
    "onboarding_evidence.packet_missing",
    ["--node", "ONB-21", "--path", "product/onboarding/graph/ONB-21-compound-engineering-plan.md"],
  );

  const onb21PacketComplete = makeFixture("onboarding-evidence-onb21-complete");
  writeEvidencePacket(
    onb21PacketComplete,
    "product/onboarding/graph/ONB-21-compound-engineering-plan.md",
    substantiveResearchProse("the implementation-ready Compound Engineering plan translated from the accepted onboarding graph"),
  );
  runFixture("ONB-21's gate passes a genuinely substantive, marker-free implementation plan", onb21PacketComplete, evidenceScript, 0, undefined, [
    "--node",
    "ONB-21",
    "--path",
    "product/onboarding/graph/ONB-21-compound-engineering-plan.md",
  ]);

  const onb09PacketMissing = makeFixture("onboarding-evidence-onb09-missing");
  runFixture("ONB-09's gate fails when the evidence join does not exist yet", onb09PacketMissing, evidenceScript, 1, "onboarding_evidence.packet_missing", [
    "--node",
    "ONB-09",
    "--path",
    "product/onboarding/graph/ONB-09-evidence-join.md",
  ]);

  const onb09PacketComplete = makeFixture("onboarding-evidence-onb09-complete");
  writeEvidencePacket(
    onb09PacketComplete,
    "product/onboarding/graph/ONB-09-evidence-join.md",
    substantiveResearchProse("the joined guidance, reviews, flow evidence, internal doctrine, provider facts, policy, and motion research decisions"),
  );
  runFixture("ONB-09's gate passes a genuinely substantive, marker-free evidence join", onb09PacketComplete, evidenceScript, 0, undefined, [
    "--node",
    "ONB-09",
    "--path",
    "product/onboarding/graph/ONB-09-evidence-join.md",
  ]);

  const onb10PacketMissing = makeFixture("onboarding-evidence-onb10-missing");
  runFixture(
    "ONB-10's gate fails when the first-value and activation packet does not exist yet",
    onb10PacketMissing,
    evidenceScript,
    1,
    "onboarding_evidence.packet_missing",
    ["--node", "ONB-10", "--path", "product/onboarding/graph/ONB-10-first-value-activation.md"],
  );

  const onb10PacketComplete = makeFixture("onboarding-evidence-onb10-complete");
  writeEvidencePacket(
    onb10PacketComplete,
    "product/onboarding/graph/ONB-10-first-value-activation.md",
    substantiveResearchProse("first value rendered, first value engaged, activation, habit, and retention hypotheses"),
  );
  runFixture("ONB-10's gate passes a genuinely substantive, marker-free first-value and activation packet", onb10PacketComplete, evidenceScript, 0, undefined, [
    "--node",
    "ONB-10",
    "--path",
    "product/onboarding/graph/ONB-10-first-value-activation.md",
  ]);

  const onb11PacketMissing = makeFixture("onboarding-evidence-onb11-missing");
  runFixture(
    "ONB-11's gate fails when the effort and question audit does not exist yet",
    onb11PacketMissing,
    evidenceScript,
    1,
    "onboarding_evidence.packet_missing",
    ["--node", "ONB-11", "--path", "product/onboarding/graph/ONB-11-effort-question-audit.md"],
  );

  const onb11PacketComplete = makeFixture("onboarding-evidence-onb11-complete");
  writeEvidencePacket(
    onb11PacketComplete,
    "product/onboarding/graph/ONB-11-effort-question-audit.md",
    substantiveResearchProse("effort before value, question usefulness, permissions, interruption budget, and visible personalization proof"),
  );
  runFixture("ONB-11's gate passes a genuinely substantive, marker-free effort and question audit", onb11PacketComplete, evidenceScript, 0, undefined, [
    "--node",
    "ONB-11",
    "--path",
    "product/onboarding/graph/ONB-11-effort-question-audit.md",
  ]);

  const onb12PacketMissing = makeFixture("onboarding-evidence-onb12-missing");
  runFixture(
    "ONB-12's gate fails when the state and identity contract does not exist yet",
    onb12PacketMissing,
    evidenceScript,
    1,
    "onboarding_evidence.packet_missing",
    ["--node", "ONB-12", "--path", "product/onboarding/graph/ONB-12-state-identity-contract.md"],
  );

  const onb12PacketComplete = makeFixture("onboarding-evidence-onb12-complete");
  writeEvidencePacket(
    onb12PacketComplete,
    "product/onboarding/graph/ONB-12-state-identity-contract.md",
    substantiveResearchProse("the canonical journey, profile, identity, entitlement, continuity, and cross-surface state transitions"),
  );
  runFixture("ONB-12's gate passes a genuinely substantive, marker-free state and identity contract", onb12PacketComplete, evidenceScript, 0, undefined, [
    "--node",
    "ONB-12",
    "--path",
    "product/onboarding/graph/ONB-12-state-identity-contract.md",
  ]);

  const onb13PacketMissing = makeFixture("onboarding-evidence-onb13-missing");
  runFixture(
    "ONB-13's gate fails when the analytics and experiments packet does not exist yet",
    onb13PacketMissing,
    evidenceScript,
    1,
    "onboarding_evidence.packet_missing",
    ["--node", "ONB-13", "--path", "product/onboarding/graph/ONB-13-analytics-experiments.md"],
  );

  const onb13PacketComplete = makeFixture("onboarding-evidence-onb13-complete");
  writeEvidencePacket(
    onb13PacketComplete,
    "product/onboarding/graph/ONB-13-analytics-experiments.md",
    substantiveResearchProse(
      "typed analytics, authoritative emitters, identity stitching, deduplication, experiment assignment, exposure, and expected sequences",
    ),
  );
  runFixture("ONB-13's gate passes a genuinely substantive, marker-free analytics and experiments packet", onb13PacketComplete, evidenceScript, 0, undefined, [
    "--node",
    "ONB-13",
    "--path",
    "product/onboarding/graph/ONB-13-analytics-experiments.md",
  ]);

  const onb14PacketMissing = makeFixture("onboarding-evidence-onb14-missing");
  runFixture(
    "ONB-14's gate fails when the trust, lifecycle, and policy packet does not exist yet",
    onb14PacketMissing,
    evidenceScript,
    1,
    "onboarding_evidence.packet_missing",
    ["--node", "ONB-14", "--path", "product/onboarding/graph/ONB-14-trust-lifecycle-policy.md"],
  );

  const onb14PacketComplete = makeFixture("onboarding-evidence-onb14-complete");
  writeEvidencePacket(
    onb14PacketComplete,
    "product/onboarding/graph/ONB-14-trust-lifecycle-policy.md",
    substantiveResearchProse("review timing, permissions, lifecycle, privacy, security, accessibility, and policy behavior"),
  );
  runFixture(
    "ONB-14's gate passes a genuinely substantive, marker-free trust, lifecycle, and policy packet",
    onb14PacketComplete,
    evidenceScript,
    0,
    undefined,
    ["--node", "ONB-14", "--path", "product/onboarding/graph/ONB-14-trust-lifecycle-policy.md"],
  );

  const onb15PacketMissing = makeFixture("onboarding-evidence-onb15-missing");
  runFixture(
    "ONB-15's gate fails when the architecture decision does not exist yet",
    onb15PacketMissing,
    evidenceScript,
    1,
    "onboarding_evidence.packet_missing",
    ["--node", "ONB-15", "--path", "product/onboarding/graph/ONB-15-architecture-decision.md"],
  );

  const onb15PacketComplete = makeFixture("onboarding-evidence-onb15-complete");
  writeEvidencePacket(
    onb15PacketComplete,
    "product/onboarding/graph/ONB-15-architecture-decision.md",
    substantiveResearchProse("the native-first, hosted-funnel-first, hybrid, web-first, and evidence-backed architecture comparison and selection"),
  );
  runFixture("ONB-15's gate passes a genuinely substantive, marker-free architecture decision", onb15PacketComplete, evidenceScript, 0, undefined, [
    "--node",
    "ONB-15",
    "--path",
    "product/onboarding/graph/ONB-15-architecture-decision.md",
  ]);

  const onb16PacketMissing = makeFixture("onboarding-evidence-onb16-missing");
  runFixture(
    "ONB-16's gate fails when the canonical journey graph does not exist yet",
    onb16PacketMissing,
    evidenceScript,
    1,
    "onboarding_evidence.packet_missing",
    ["--node", "ONB-16", "--path", "product/onboarding/graph/ONB-16-journey-graph.md"],
  );

  const onb16PacketComplete = makeFixture("onboarding-evidence-onb16-complete");
  writeEvidencePacket(
    onb16PacketComplete,
    "product/onboarding/graph/ONB-16-journey-graph.md",
    substantiveResearchProse("the acquisition-specific journeys that converge on one semantic onboarding state graph"),
  );
  runFixture("ONB-16's gate passes a genuinely substantive, marker-free canonical journey graph", onb16PacketComplete, evidenceScript, 0, undefined, [
    "--node",
    "ONB-16",
    "--path",
    "product/onboarding/graph/ONB-16-journey-graph.md",
  ]);

  const onb17PacketMissing = makeFixture("onboarding-evidence-onb17-missing");
  runFixture(
    "ONB-17's gate fails when the screen, control, and paywall contract does not exist yet",
    onb17PacketMissing,
    evidenceScript,
    1,
    "onboarding_evidence.packet_missing",
    ["--node", "ONB-17", "--path", "product/onboarding/graph/ONB-17-screen-control-paywall-contract.md"],
  );

  const onb17PacketComplete = makeFixture("onboarding-evidence-onb17-complete");
  writeEvidencePacket(
    onb17PacketComplete,
    "product/onboarding/graph/ONB-17-screen-control-paywall-contract.md",
    substantiveResearchProse("every onboarding screen, copy key, control, action, paywall state, failure, recovery, accessibility, and localization behavior"),
  );
  runFixture(
    "ONB-17's gate passes a genuinely substantive, marker-free screen, control, and paywall contract",
    onb17PacketComplete,
    evidenceScript,
    0,
    undefined,
    ["--node", "ONB-17", "--path", "product/onboarding/graph/ONB-17-screen-control-paywall-contract.md"],
  );

  const onb18PacketMissing = makeFixture("onboarding-evidence-onb18-missing");
  runFixture(
    "ONB-18's gate fails when the visual design and prototype packet does not exist yet",
    onb18PacketMissing,
    evidenceScript,
    1,
    "onboarding_evidence.packet_missing",
    ["--node", "ONB-18", "--path", "product/onboarding/graph/ONB-18-visual-design-prototype.md"],
  );

  const onb18PacketComplete = makeFixture("onboarding-evidence-onb18-complete");
  writeEvidencePacket(
    onb18PacketComplete,
    "product/onboarding/graph/ONB-18-visual-design-prototype.md",
    substantiveResearchProse("the high-fidelity onboarding design, motion, interactive prototype, and design QA"),
  );
  runFixture(
    "ONB-18's gate passes a genuinely substantive, marker-free visual design and prototype packet",
    onb18PacketComplete,
    evidenceScript,
    0,
    undefined,
    ["--node", "ONB-18", "--path", "product/onboarding/graph/ONB-18-visual-design-prototype.md"],
  );

  const onb19PacketMissing = makeFixture("onboarding-evidence-onb19-missing");
  runFixture(
    "ONB-19's gate fails when the implementation and cutover contract does not exist yet",
    onb19PacketMissing,
    evidenceScript,
    1,
    "onboarding_evidence.packet_missing",
    ["--node", "ONB-19", "--path", "product/onboarding/graph/ONB-19-implementation-cutover-contract.md"],
  );

  const onb19PacketComplete = makeFixture("onboarding-evidence-onb19-complete");
  writeEvidencePacket(
    onb19PacketComplete,
    "product/onboarding/graph/ONB-19-implementation-cutover-contract.md",
    substantiveResearchProse("the implementation units, reliability, performance, observability, privacy, migration, hard cutover, and deletion plan"),
  );
  runFixture(
    "ONB-19's gate passes a genuinely substantive, marker-free implementation and cutover contract",
    onb19PacketComplete,
    evidenceScript,
    0,
    undefined,
    ["--node", "ONB-19", "--path", "product/onboarding/graph/ONB-19-implementation-cutover-contract.md"],
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

  // check-onboarding-graph.ts's tablePlaceholderCells() now also rejects boilerplate that
  // repeats with only an embedded counter varying (e.g. "Evidence-1: ...", "Evidence-2: ..."),
  // since that is exactly the shape of filler that is technically unique but carries no real
  // content. This filler derives each cell's text from its own table's column header and its
  // row's own identifying content instead of a counter, so distinct rows and columns produce
  // genuinely distinct text -- the same way a real completed launch's answers would differ
  // because they are about different things, not because of an incrementing label.
  function fillTemplateDirectiveCells(text: string): string {
    const lines = text.split("\n");
    let header: string[] | null = null;
    let pendingHeader: string[] | null = null;

    return lines
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith("|")) {
          header = null;
          pendingHeader = null;
          return line;
        }
        if (/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(trimmed)) {
          header = pendingHeader;
          pendingHeader = null;
          return line;
        }
        if (header === null) {
          pendingHeader = line.split("|").map((cell) => cell.trim());
          return line;
        }
        const rawCells = line.split("|");
        const trimmedCells = rawCells.map((cell) => cell.trim().replaceAll("`", ""));
        const rowIdentity = trimmedCells.slice(1, -1).find((cell) => cell.length > 0 && !TEMPLATE_DIRECTIVE_VERBS_PATTERN.test(cell)) || "this row";
        const resolvedHeader = header;
        return rawCells
          .map((cell, index) => {
            if (!TEMPLATE_DIRECTIVE_VERBS_PATTERN.test(cell)) return cell;
            const columnName = (resolvedHeader?.[index] || "field").toLowerCase();
            return ` Confirmed ${columnName} for ${rowIdentity} `;
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
