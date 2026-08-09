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

  // A durable-engine-managed v2 workspace has no state/PROJECT_STATE.yaml at all (its canonical
  // state is state/business-state.json, per core/session/run.ts's resolveWorkspacePaths()) --
  // without loadLaneFromBusinessStateV2()'s fallback in check-onboarding-graph.ts, ONB-22's own
  // --require-done gate would report the lane permanently missing on every genuinely completed
  // v2 run, since loadProjectState() alone only ever reads the v1 file.
  const v2LaneComplete = makeFixture("onboarding-graph-v2-business-state-complete");
  {
    rmSync(path.join(v2LaneComplete, "state/PROJECT_STATE.yaml"), { force: true });
    writeFileSync(
      path.join(v2LaneComplete, "state/business-state.json"),
      JSON.stringify({
        schemaVersion: "2.0.0",
        lanes: { onboarding: { status: "succeeded", evidence: ["product/ONBOARDING.md", "product/onboarding.html"], blockers: [] } },
      }),
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

  const v2LanePending = makeFixture("onboarding-graph-v2-business-state-pending");
  {
    rmSync(path.join(v2LanePending, "state/PROJECT_STATE.yaml"), { force: true });
    writeFileSync(
      path.join(v2LanePending, "state/business-state.json"),
      JSON.stringify({ schemaVersion: "2.0.0", lanes: { onboarding: { status: "pending", evidence: [], blockers: [] } } }),
      "utf8",
    );
  }
  runFixture(
    "a v2 workspace with an unfinished onboarding lane still fails --require-done, citing state/business-state.json not the absent v1 file",
    v2LanePending,
    "check-onboarding-graph.ts",
    1,
    "onboarding_graph.not_marked_done",
    ["--require-done"],
    undefined,
    "state/PROJECT_STATE.yaml",
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
