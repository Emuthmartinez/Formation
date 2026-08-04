import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Harness, getLane, readState, writeCompletePaidUserAcquisition, writeCompleteViralGrowth, writeState } from "./_harness.js";

export function register(h: Harness): void {
  const { makeFixture, runFixture } = h;

  const contentFallbackUnapproved = makeFixture("content-fallback-unapproved");
  mkdirSync(path.join(contentFallbackUnapproved, "growth", "content-assets"), { recursive: true });
  writeFileSync(
    path.join(contentFallbackUnapproved, "growth", "content-assets", "CONTENT_ASSETS.md"),
    [
      "# Content Assets",
      "Route Matrix",
      "Higgsfield unavailable, using Remotion fallback.",
      "Remotion",
      "License status: Remotion license status checked before commercial use.",
      "Source Inputs",
      "Composition Manifest",
      "Render Commands",
      "Claim Review",
      "Output Registry",
      "Public Use Gates",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "Higgsfield content fallback without founder approval fails",
    contentFallbackUnapproved,
    "check-content-assets.ts",
    1,
    "content_assets.higgsfield_fallback_unapproved",
  );

  const remotionLicenseUnchecked = makeFixture("remotion-license-unchecked");
  mkdirSync(path.join(remotionLicenseUnchecked, "growth", "content-assets"), { recursive: true });
  writeFileSync(
    path.join(remotionLicenseUnchecked, "growth", "content-assets", "CONTENT_ASSETS.md"),
    [
      "# Content Assets",
      "Route Matrix",
      "Higgsfield",
      "Remotion",
      "Founder approval recorded for Remotion fallback.",
      "License status: unchecked.",
      "Source Inputs",
      "Composition Manifest",
      "Render Commands",
      "Claim Review",
      "Output Registry",
      "Public Use Gates",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    path.join(remotionLicenseUnchecked, "growth", "content-assets", "manifest.json"),
    JSON.stringify(
      {
        assets: [
          {
            asset_id: "license-thin",
            surface: "ad",
            route: "remotion",
            status: "draft",
            composition_id: "Ad",
            dimensions: "1080x1080",
            inputs: ["design/DESIGN.md"],
            outputs: ["growth/content-assets/out/ad.mp4"],
            truth_constraints: ["real app UI visible"],
            approvals: ["founder approval before public use"],
            render_proof: "npx remotion render Ad --output ../out/ad.mp4",
            license_status: "unchecked",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );
  runFixture(
    "Remotion asset without license status fails",
    remotionLicenseUnchecked,
    "check-content-assets.ts",
    1,
    "content_assets.manifest.assets.0.license_status.unchecked",
  );

  const thinContentManifest = makeFixture("content-manifest-thin");
  mkdirSync(path.join(thinContentManifest, "growth", "content-assets"), { recursive: true });
  writeFileSync(
    path.join(thinContentManifest, "growth", "content-assets", "CONTENT_ASSETS.md"),
    [
      "# Content Assets",
      "Route Matrix",
      "Higgsfield",
      "Remotion",
      "Founder approval recorded for fallback.",
      "License status: Remotion license status checked before commercial use.",
      "Source Inputs",
      "Composition Manifest",
      "Render Commands",
      "Claim Review",
      "Output Registry",
      "Public Use Gates",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    path.join(thinContentManifest, "growth", "content-assets", "manifest.json"),
    JSON.stringify({ assets: [{ asset_id: "thin", route: "remotion", status: "draft" }] }, null, 2),
    "utf8",
  );
  runFixture("thin Remotion content manifest fails", thinContentManifest, "check-content-assets.ts", 1, "content_assets.manifest.assets.0.surface.missing");

  const higgsfieldNoBrief = makeFixture("content-higgsfield-no-brief");
  mkdirSync(path.join(higgsfieldNoBrief, "growth", "content-assets"), { recursive: true });
  writeFileSync(
    path.join(higgsfieldNoBrief, "growth", "content-assets", "CONTENT_ASSETS.md"),
    [
      "# Content Assets",
      "Route Matrix",
      "Higgsfield",
      "Remotion",
      "Founder approval recorded for fallback.",
      "License status: Remotion license status checked before commercial use.",
      "Source Inputs",
      "Composition Manifest",
      "Render Commands",
      "Claim Review",
      "Output Registry",
      "Public Use Gates",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    path.join(higgsfieldNoBrief, "growth", "content-assets", "manifest.json"),
    JSON.stringify(
      {
        assets: [
          {
            asset_id: "founder-ad",
            surface: "meta_paid",
            route: "higgsfield_marketing_studio",
            status: "draft",
            dimensions: "1080x1920",
            inputs: ["design/DESIGN.md"],
            outputs: ["growth/content-assets/out/founder-ad.mp4"],
            truth_constraints: ["real app UI remains truthful"],
            approvals: ["founder approval before public posting"],
            license_status: "Higgsfield account/credit route",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );
  runFixture(
    "Higgsfield manifest asset without prompt_brief fails",
    higgsfieldNoBrief,
    "check-content-assets.ts",
    1,
    "content_assets.manifest.assets.0.prompt_brief.missing",
  );

  const viralGrowthMissing = makeFixture("viral-growth-missing");
  rmSync(path.join(viralGrowthMissing, "growth"), { recursive: true, force: true });
  runFixture("missing viral growth packet fails", viralGrowthMissing, "check-viral-growth-loop.ts", 1, "viral_growth.markdown_missing");

  const viralGrowthThin = makeFixture("viral-growth-thin");
  mkdirSync(path.join(viralGrowthThin, "growth"), { recursive: true });
  writeFileSync(
    path.join(viralGrowthThin, "growth", "VIRAL_GROWTH.md"),
    ["# Viral Growth", "Fit Gate", "Growth Thesis: post on TikTok and see what happens."].join("\n"),
    "utf8",
  );
  runFixture("thin viral growth packet fails", viralGrowthThin, "check-viral-growth-loop.ts", 1, "viral_growth.product_loop.missing");

  const viralGrowthDonePlaceholder = makeFixture("viral-growth-done-placeholder");
  writeCompleteViralGrowth(viralGrowthDonePlaceholder);
  writeFileSync(
    path.join(viralGrowthDonePlaceholder, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthDonePlaceholder, "growth", "VIRAL_GROWTH.md"), "utf8") + "\nTODO: choose final creator CTA.\n",
    "utf8",
  );
  runFixture("done viral growth with placeholders fails", viralGrowthDonePlaceholder, "check-viral-growth-loop.ts", 1, "viral_growth.placeholder_complete");

  // Counting shares is not measuring a loop: the contract needs the Loop
  // Economics section (k = invites/user × recipient conversion, cycle time).
  const viralGrowthNoLoopEconomics = makeFixture("viral-growth-no-loop-economics");
  writeCompleteViralGrowth(viralGrowthNoLoopEconomics);
  writeFileSync(
    path.join(viralGrowthNoLoopEconomics, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthNoLoopEconomics, "growth", "VIRAL_GROWTH.md"), "utf8").replace(/^Loop Economics:.*$/m, ""),
    "utf8",
  );
  runFixture(
    "viral growth without the loop economics contract fails",
    viralGrowthNoLoopEconomics,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.loop_economics.missing",
  );

  // The heading without the number is counting shares with extra steps.
  const viralGrowthLoopUnmeasured = makeFixture("viral-growth-loop-unmeasured");
  writeCompleteViralGrowth(viralGrowthLoopUnmeasured);
  writeFileSync(
    path.join(viralGrowthLoopUnmeasured, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthLoopUnmeasured, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      "Loop Economics: we will track the loop as it matures.",
    ),
    "utf8",
  );
  runFixture(
    "loop economics without a measured k or dated commitment fails",
    viralGrowthLoopUnmeasured,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.loop_economics_unmeasured",
  );

  // A playbook that stops at the Day-0 roster leaves the scaled state undefined.
  const viralGrowthNoUgcScale = makeFixture("viral-growth-no-ugc-scale");
  writeCompleteViralGrowth(viralGrowthNoUgcScale);
  writeFileSync(path.join(viralGrowthNoUgcScale, "growth/UGC_PLAYBOOK.md"), "# UGC Playbook\n\nCreator scripts use GROW-001 and the format lab.\n", "utf8");
  runFixture(
    "UGC playbook without the post-breakout scale model fails",
    viralGrowthNoUgcScale,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.ugc_scale_model_missing",
  );

  // Keyword confetti is not a scale model: bands, budgets, and fatigue must
  // actually be defined.
  const viralGrowthUgcScaleThin = makeFixture("viral-growth-ugc-scale-thin");
  writeCompleteViralGrowth(viralGrowthUgcScaleThin);
  writeFileSync(path.join(viralGrowthUgcScaleThin, "growth/UGC_PLAYBOOK.md"), "# UGC Playbook\n\nPost-breakout band founder.\n", "utf8");
  runFixture(
    "keyword-only scale model without bands and fatigue fails",
    viralGrowthUgcScaleThin,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.ugc_scale_model_missing",
  );

  // A deleted playbook is the Day-0 ceiling with the evidence removed.
  const viralGrowthNoPlaybook = makeFixture("viral-growth-no-ugc-playbook");
  writeCompleteViralGrowth(viralGrowthNoPlaybook);
  rmSync(path.join(viralGrowthNoPlaybook, "growth/UGC_PLAYBOOK.md"), { force: true });
  runFixture(
    "done growth lane without growth/UGC_PLAYBOOK.md fails",
    viralGrowthNoPlaybook,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.ugc_playbook_missing",
  );

  // A dated numeric row in a LATER section must not read as a loop measurement.
  const viralGrowthLoopCrossSection = makeFixture("viral-growth-loop-cross-section");
  writeCompleteViralGrowth(viralGrowthLoopCrossSection);
  writeFileSync(
    path.join(viralGrowthLoopCrossSection, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthLoopCrossSection, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      "## Loop Economics\n\n## Ledger Extras\n| 2026-07-01 | GROW-001 | 5 |",
    ),
    "utf8",
  );
  runFixture(
    "dated numbers in a later section do not count as loop measurements",
    viralGrowthLoopCrossSection,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.loop_economics_unmeasured",
  );

  // A table-of-contents mention must not orphan the measured section below it.
  const viralGrowthLoopToc = makeFixture("viral-growth-loop-toc-mention");
  writeCompleteViralGrowth(viralGrowthLoopToc);
  writeFileSync(
    path.join(viralGrowthLoopToc, "growth", "VIRAL_GROWTH.md"),
    "Contents: Fit Gate, Product Loop, Loop Economics, Stop And Scale Rules\n" +
      readFileSync(path.join(viralGrowthLoopToc, "growth", "VIRAL_GROWTH.md"), "utf8"),
    "utf8",
  );
  runFixture("a contents-line mention does not orphan the measured loop section", viralGrowthLoopToc, "check-viral-growth-loop.ts", 0);

  // A target is not a measurement.
  const viralGrowthAspirationalK = makeFixture("viral-growth-aspirational-k");
  writeCompleteViralGrowth(viralGrowthAspirationalK);
  writeFileSync(
    path.join(viralGrowthAspirationalK, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthAspirationalK, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      "Loop Economics: target for launch is k: 1 with weekly cycle-time tracking.",
    ),
    "utf8",
  );
  runFixture(
    "aspirational k target does not count as a measurement",
    viralGrowthAspirationalK,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.loop_economics_unmeasured",
  );

  // A due date must be a real calendar date and cannot defer forever.
  const viralGrowthBogusDue = makeFixture("viral-growth-bogus-due-date");
  writeCompleteViralGrowth(viralGrowthBogusDue);
  writeFileSync(
    path.join(viralGrowthBogusDue, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthBogusDue, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      "Loop Economics: first weekly k computation due 2026-99-99.",
    ),
    "utf8",
  );
  runFixture("impossible loop-measurement due date fails", viralGrowthBogusDue, "check-viral-growth-loop.ts", 1, "viral_growth.loop_economics_unmeasured");

  // Band labels without roster numbers define nothing.
  const viralGrowthLabelsOnly = makeFixture("viral-growth-band-labels-only");
  writeCompleteViralGrowth(viralGrowthLabelsOnly);
  writeFileSync(
    path.join(viralGrowthLabelsOnly, "growth/UGC_PLAYBOOK.md"),
    "# UGC Playbook\n\nPost-Breakout Scale Model: discovery, proven, scale; founder reviews; track fatigue.\n",
    "utf8",
  );
  runFixture(
    "band labels without numbers or budget gates fail",
    viralGrowthLabelsOnly,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.ugc_scale_model_missing",
  );

  // A dated row without a numeric k is a no-data row, not a measurement.
  const growthIsoDaysAgo = (days: number): string => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
  };
  const loopTable = (row: string): string =>
    [
      "Loop Economics:",
      "",
      "| Week | Invites / active user | Recipient conversion | k | Cycle time (days) | Trend / decision |",
      "| --- | --- | --- | --- | --- | --- |",
      row,
    ].join("\n");
  const viralGrowthNoDataRow = makeFixture("viral-growth-no-data-row");
  writeCompleteViralGrowth(viralGrowthNoDataRow);
  writeFileSync(
    path.join(viralGrowthNoDataRow, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthNoDataRow, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      loopTable("| 2026-07-01 | no result for week 1 | | | | |"),
    ),
    "utf8",
  );
  runFixture("a dated loop row with no numeric k fails", viralGrowthNoDataRow, "check-viral-growth-loop.ts", 1, "viral_growth.loop_economics_unmeasured");

  // A dated row with a numeric k in the k column is the real measurement.
  const viralGrowthMeasuredRow = makeFixture("viral-growth-measured-row");
  writeCompleteViralGrowth(viralGrowthMeasuredRow);
  writeFileSync(
    path.join(viralGrowthMeasuredRow, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthMeasuredRow, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      loopTable(`| ${growthIsoDaysAgo(7)} | 3.1 | 0.2 | 0.62 | 6 | hold and retest the share moment |`),
    ),
    "utf8",
  );
  runFixture("a dated loop row with a numeric k passes", viralGrowthMeasuredRow, "check-viral-growth-loop.ts", 0);

  // The shipped template's band table has structure but no state: empty
  // Budget and Entered/evidence cells must not satisfy the scale model.
  const viralGrowthTemplateUntouched = makeFixture("viral-growth-template-untouched");
  const shippedUgcPlaybook = readFileSync(path.join(viralGrowthTemplateUntouched, "growth/UGC_PLAYBOOK.md"), "utf8");
  writeCompleteViralGrowth(viralGrowthTemplateUntouched);
  writeFileSync(path.join(viralGrowthTemplateUntouched, "growth/UGC_PLAYBOOK.md"), shippedUgcPlaybook, "utf8");
  runFixture(
    "the untouched UGC template's empty band cells fail the scale model",
    viralGrowthTemplateUntouched,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.ugc_scale_model_missing",
  );

  // A populated band row (budget + entered/evidence) is the operative state.
  const viralGrowthBandPopulated = makeFixture("viral-growth-band-table-populated");
  writeCompleteViralGrowth(viralGrowthBandPopulated);
  writeFileSync(
    path.join(viralGrowthBandPopulated, "growth/UGC_PLAYBOOK.md"),
    [
      "# UGC Playbook",
      "",
      "Creator scripts use GROW-001 and the format lab.",
      "",
      "## Post-Breakout Scale Model",
      "",
      "| Band | Roster | Weekly video volume | Budget (founder-gated) | Entered on / evidence |",
      "| --- | --- | --- | --- | --- |",
      "| Discovery | 3-5 | 9-15 | $300/week founder-approved | 2026-07-01 — install-per-video 210 |",
      "| Proven format | ~10 | 30-40 | | |",
      "| Scale | ~30 | 90-120 | | |",
      "| Volume | 75+ | 200+ | | |",
      "",
      "- Control format install-per-video (weekly): fatigue check — two consecutive declines trigger the next variant test.",
    ].join("\n"),
    "utf8",
  );
  runFixture("a populated band row satisfies the scale model", viralGrowthBandPopulated, "check-viral-growth-loop.ts", 0);

  // A commitment already missed must not keep the lane green.
  const viralGrowthOverdue = makeFixture("viral-growth-overdue-commitment");
  writeCompleteViralGrowth(viralGrowthOverdue);
  writeFileSync(
    path.join(viralGrowthOverdue, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthOverdue, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      "Loop Economics: first weekly k computation due 2020-01-01.",
    ),
    "utf8",
  );
  runFixture("an overdue first-measurement commitment fails", viralGrowthOverdue, "check-viral-growth-loop.ts", 1, "viral_growth.loop_economics_unmeasured");

  // Illustrative copy is not a measurement.
  const viralGrowthIllustrativeK = makeFixture("viral-growth-illustrative-k");
  writeCompleteViralGrowth(viralGrowthIllustrativeK);
  writeFileSync(
    path.join(viralGrowthIllustrativeK, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthIllustrativeK, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      "Loop Economics: Example: k = 0.5; at k = 1 the loop self-compounds.",
    ),
    "utf8",
  );
  runFixture(
    "illustrative k copy does not count as a measurement",
    viralGrowthIllustrativeK,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.loop_economics_unmeasured",
  );

  // Punctuation is not band evidence.
  const viralGrowthDashCells = makeFixture("viral-growth-band-dash-cells");
  writeCompleteViralGrowth(viralGrowthDashCells);
  writeFileSync(
    path.join(viralGrowthDashCells, "growth/UGC_PLAYBOOK.md"),
    [
      "# UGC Playbook",
      "",
      "Creator scripts use GROW-001 and the format lab.",
      "",
      "## Post-Breakout Scale Model",
      "",
      "| Band | Roster | Weekly video volume | Budget (founder-gated) | Entered on / evidence |",
      "| --- | --- | --- | --- | --- |",
      "| Discovery | 3-5 | 9-15 | — | — |",
      "| Proven format | ~10 | 30-40 | - | - |",
      "| Scale | ~30 | 90-120 | | |",
      "| Volume | 75+ | 200+ | | |",
      "",
      "- Control format install-per-video (weekly): fatigue check — two consecutive declines trigger the next variant test.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "dash-filled band cells do not satisfy the scale model",
    viralGrowthDashCells,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.ugc_scale_model_missing",
  );

  // "not yet" is a non-entry, not evidence.
  const viralGrowthNegativeEvidence = makeFixture("viral-growth-band-negative-evidence");
  writeCompleteViralGrowth(viralGrowthNegativeEvidence);
  writeFileSync(
    path.join(viralGrowthNegativeEvidence, "growth/UGC_PLAYBOOK.md"),
    [
      "# UGC Playbook",
      "",
      "Creator scripts use GROW-001 and the format lab.",
      "",
      "## Post-Breakout Scale Model",
      "",
      "| Band | Roster | Weekly video volume | Budget (founder-gated) | Entered on / evidence |",
      "| --- | --- | --- | --- | --- |",
      "| Discovery | 3-5 | 9-15 | $300/week | not yet |",
      "| Proven format | ~10 | 30-40 | | |",
      "| Scale | ~30 | 90-120 | | |",
      "| Volume | 75+ | 200+ | | |",
      "",
      "- Control format install-per-video (weekly): fatigue check — two consecutive declines trigger the next variant test.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "a band row with negative evidence does not satisfy the scale model",
    viralGrowthNegativeEvidence,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.ugc_scale_model_missing",
  );

  // A k number alone is a partial measurement — cycle time and trend complete it.
  const viralGrowthKNoCycle = makeFixture("viral-growth-k-without-cycle");
  writeCompleteViralGrowth(viralGrowthKNoCycle);
  writeFileSync(
    path.join(viralGrowthKNoCycle, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthKNoCycle, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      "Loop Economics: measured k = 0.4 in week 1.",
    ),
    "utf8",
  );
  runFixture("a measured k without cycle time and trend fails", viralGrowthKNoCycle, "check-viral-growth-loop.ts", 1, "viral_growth.loop_economics_unmeasured");

  // Only a modeled band's row is operative evidence.
  const viralGrowthNotesRow = makeFixture("viral-growth-band-notes-row");
  writeCompleteViralGrowth(viralGrowthNotesRow);
  writeFileSync(
    path.join(viralGrowthNotesRow, "growth/UGC_PLAYBOOK.md"),
    [
      "# UGC Playbook",
      "",
      "Creator scripts use GROW-001 and the format lab.",
      "",
      "## Post-Breakout Scale Model",
      "",
      "| Band | Roster | Weekly video volume | Budget (founder-gated) | Entered on / evidence |",
      "| --- | --- | --- | --- | --- |",
      "| Discovery | 3-5 | 9-15 | | |",
      "| Proven format | ~10 | 30-40 | | |",
      "| Scale | ~30 | 90-120 | | |",
      "| Volume | 75+ | 200+ | | |",
      "| Notes | | | $300 | contract saved |",
      "",
      "- Control format install-per-video (weekly): fatigue check — two consecutive declines trigger the next variant test.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "an unrelated notes row with a budget number does not enter a band",
    viralGrowthNotesRow,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.ugc_scale_model_missing",
  );

  // A ### section ends at the next heading of any accepted level.
  const viralGrowthHeadingBoundary = makeFixture("viral-growth-heading-boundary");
  writeCompleteViralGrowth(viralGrowthHeadingBoundary);
  writeFileSync(
    path.join(viralGrowthHeadingBoundary, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthHeadingBoundary, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      [
        "### Loop Economics",
        "",
        "### Traceability",
        "",
        "| Week | Invites / active user | Recipient conversion | k | Cycle time (days) | Trend / decision |",
        "| --- | --- | --- | --- | --- | --- |",
        "| 2026-07-20 | 3.1 | 0.2 | 0.62 | 6 | hold |",
      ].join("\n"),
    ),
    "utf8",
  );
  runFixture(
    "a dated k table in the next same-level section does not measure the loop",
    viralGrowthHeadingBoundary,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.loop_economics_unmeasured",
  );

  // Guidance prose mentioning "trend" records no trend.
  const viralGrowthGenericTrend = makeFixture("viral-growth-generic-trend");
  writeCompleteViralGrowth(viralGrowthGenericTrend);
  writeFileSync(
    path.join(viralGrowthGenericTrend, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthGenericTrend, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      "Loop Economics: measured k = 0.4 in week 1; cycle time: 6 days; the stop/scale rules key on k and its trend.",
    ),
    "utf8",
  );
  runFixture(
    "a measured k whose only trend language is guidance prose fails",
    viralGrowthGenericTrend,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.loop_economics_unmeasured",
  );

  // Negative measurement cells record nothing.
  const viralGrowthNegativeRow = makeFixture("viral-growth-negative-row-cells");
  writeCompleteViralGrowth(viralGrowthNegativeRow);
  writeFileSync(
    path.join(viralGrowthNegativeRow, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthNegativeRow, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      loopTable("| 2026-07-20 | 3.1 | 0.2 | 0.62 | not measured in week 1 | no decision yet |"),
    ),
    "utf8",
  );
  runFixture(
    "a dated row with negative cycle and trend cells fails",
    viralGrowthNegativeRow,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.loop_economics_unmeasured",
  );

  // The recorded exemption stands even when the shipped template remains.
  const viralGrowthUgcExempt = makeFixture("viral-growth-ugc-exempt-template");
  const shippedUgcPlaybookExempt = readFileSync(path.join(viralGrowthUgcExempt, "growth/UGC_PLAYBOOK.md"), "utf8");
  writeCompleteViralGrowth(viralGrowthUgcExempt);
  writeFileSync(path.join(viralGrowthUgcExempt, "growth/UGC_PLAYBOOK.md"), shippedUgcPlaybookExempt, "utf8");
  writeFileSync(
    path.join(viralGrowthUgcExempt, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthUgcExempt, "growth", "VIRAL_GROWTH.md"), "utf8") +
      "\nCreator content: not in scope — the founder rejected the creator loop for v1; product-loop referrals only.\n",
    "utf8",
  );
  runFixture("a recorded creator-content exemption stands with the template present", viralGrowthUgcExempt, "check-viral-growth-loop.ts", 0);

  // The digit must belong to the cycle-time phrase, not a nearby k value.
  const viralGrowthCycleUnavailable = makeFixture("viral-growth-cycle-unavailable");
  writeCompleteViralGrowth(viralGrowthCycleUnavailable);
  writeFileSync(
    path.join(viralGrowthCycleUnavailable, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthCycleUnavailable, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      "Loop Economics: measured k = 0.4 in week 1; cycle time unavailable; trend: flat.",
    ),
    "utf8",
  );
  runFixture(
    "an unavailable cycle time beside a measured k fails",
    viralGrowthCycleUnavailable,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.loop_economics_unmeasured",
  );

  // k is a formula, not a free variable.
  const viralGrowthKMismatch = makeFixture("viral-growth-k-mismatch");
  writeCompleteViralGrowth(viralGrowthKMismatch);
  writeFileSync(
    path.join(viralGrowthKMismatch, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthKMismatch, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      loopTable(`| ${growthIsoDaysAgo(7)} | 3.1 | 0.2 | 9.9 | 6 | hold |`),
    ),
    "utf8",
  );
  runFixture("a k value inconsistent with its inputs fails", viralGrowthKMismatch, "check-viral-growth-loop.ts", 1, "viral_growth.loop_economics_unmeasured");

  // A week-one prose measurement cannot stay green once the loop is running.
  const viralGrowthStaleMeasurement = makeFixture("viral-growth-stale-measurement");
  writeCompleteViralGrowth(viralGrowthStaleMeasurement);
  {
    const state = readState(viralGrowthStaleMeasurement);
    getLane(state, "post_launch_ops")["live_since"] = growthIsoDaysAgo(60);
    writeState(viralGrowthStaleMeasurement, state);
  }
  runFixture(
    "an undated week-one measurement on a long-live app fails",
    viralGrowthStaleMeasurement,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.loop_economics_unmeasured",
  );

  // A dated current-window row keeps a running loop green.
  const viralGrowthLiveCurrentRow = makeFixture("viral-growth-live-current-row");
  writeCompleteViralGrowth(viralGrowthLiveCurrentRow);
  {
    const state = readState(viralGrowthLiveCurrentRow);
    getLane(state, "post_launch_ops")["live_since"] = growthIsoDaysAgo(60);
    writeState(viralGrowthLiveCurrentRow, state);
  }
  writeFileSync(
    path.join(viralGrowthLiveCurrentRow, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthLiveCurrentRow, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      loopTable(`| ${growthIsoDaysAgo(5)} | 3.1 | 0.2 | 0.62 | 6 | hold and retest the share moment |`),
    ),
    "utf8",
  );
  runFixture("a current-window dated row keeps a running loop green", viralGrowthLiveCurrentRow, "check-viral-growth-loop.ts", 0);

  // A fossil row from years ago is not a measurement even pre-live.
  const viralGrowthAncientRow = makeFixture("viral-growth-ancient-row");
  writeCompleteViralGrowth(viralGrowthAncientRow);
  writeFileSync(
    path.join(viralGrowthAncientRow, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthAncientRow, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      loopTable("| 2020-01-01 | 3.1 | 0.2 | 0.62 | 6 | hold |"),
    ),
    "utf8",
  );
  runFixture(
    "a fossil measured row fails the absolute floor",
    viralGrowthAncientRow,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.loop_economics_unmeasured",
  );

  // A running loop cannot keep postponing its first measurement.
  const viralGrowthLiveCommitment = makeFixture("viral-growth-live-commitment");
  writeCompleteViralGrowth(viralGrowthLiveCommitment);
  {
    const state = readState(viralGrowthLiveCommitment);
    getLane(state, "post_launch_ops")["live_since"] = growthIsoDaysAgo(60);
    writeState(viralGrowthLiveCommitment, state);
  }
  writeFileSync(
    path.join(viralGrowthLiveCommitment, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthLiveCommitment, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      `Loop Economics: first weekly k computation due ${growthIsoDaysAgo(-14)}.`,
    ),
    "utf8",
  );
  runFixture(
    "a first-measurement commitment on a long-live app fails",
    viralGrowthLiveCommitment,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.loop_economics_unmeasured",
  );

  // Percentage conversion rates are the same rate.
  const viralGrowthPercentRow = makeFixture("viral-growth-percent-row");
  writeCompleteViralGrowth(viralGrowthPercentRow);
  writeFileSync(
    path.join(viralGrowthPercentRow, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthPercentRow, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      loopTable(`| ${growthIsoDaysAgo(7)} | 3.1 | 20% | 0.62 | 6 | hold and retest the share moment |`),
    ),
    "utf8",
  );
  runFixture("a percentage-form conversion rate recomputes correctly", viralGrowthPercentRow, "check-viral-growth-loop.ts", 0);

  // The word "budget" alone authorizes nothing.
  const viralGrowthBudgetNoGate = makeFixture("viral-growth-budget-no-gate");
  writeCompleteViralGrowth(viralGrowthBudgetNoGate);
  writeFileSync(
    path.join(viralGrowthBudgetNoGate, "growth/UGC_PLAYBOOK.md"),
    [
      "# UGC Playbook",
      "",
      "Creator scripts use GROW-001 and the format lab.",
      "",
      "## Post-Breakout Scale Model",
      "",
      "| Band | Roster | Weekly video volume | Budget | Entered on / evidence |",
      "| --- | --- | --- | --- | --- |",
      `| Discovery | 3-5 | 9-15 | $300/week | ${growthIsoDaysAgo(7)} — install-per-video 210 |`,
      "| Proven format | ~10 | 30-40 | | |",
      "| Scale | ~30 | 90-120 | | |",
      "| Volume | 75+ | 200+ | | |",
      "",
      "- Control format install-per-video (weekly): fatigue check — two consecutive declines trigger the next variant test.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "a populated band table without a founder gate fails",
    viralGrowthBudgetNoGate,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.ugc_scale_model_missing",
  );

  // An explicitly undecided loop is not a recorded decision.
  const viralGrowthNoDecisionProse = makeFixture("viral-growth-no-decision-prose");
  writeCompleteViralGrowth(viralGrowthNoDecisionProse);
  writeFileSync(
    path.join(viralGrowthNoDecisionProse, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthNoDecisionProse, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      "Loop Economics: measured k = 0.4 in week 1; cycle time: 6 days; decision: no decision yet.",
    ),
    "utf8",
  );
  runFixture(
    "a prose measurement with an undecided decision fails",
    viralGrowthNoDecisionProse,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.loop_economics_unmeasured",
  );

  // An unrelated dated line cannot re-arm a stale measurement.
  const viralGrowthUnrelatedDate = makeFixture("viral-growth-unrelated-date");
  writeCompleteViralGrowth(viralGrowthUnrelatedDate);
  {
    const state = readState(viralGrowthUnrelatedDate);
    getLane(state, "post_launch_ops")["live_since"] = growthIsoDaysAgo(60);
    writeState(viralGrowthUnrelatedDate, state);
  }
  writeFileSync(
    path.join(viralGrowthUnrelatedDate, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthUnrelatedDate, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      ["Loop Economics: measured k = 0.4 in week 1 with a 6-day cycle time, trend flat.", `Notes reviewed: ${growthIsoDaysAgo(1)}.`].join("\n"),
    ),
    "utf8",
  );
  runFixture(
    "an unrelated dated note does not make a stale measurement current",
    viralGrowthUnrelatedDate,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.loop_economics_unmeasured",
  );

  // Shares and activation are the documented aliases — the formula still holds.
  const viralGrowthAliasMismatch = makeFixture("viral-growth-alias-k-mismatch");
  writeCompleteViralGrowth(viralGrowthAliasMismatch);
  writeFileSync(
    path.join(viralGrowthAliasMismatch, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthAliasMismatch, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      [
        "Loop Economics:",
        "",
        "| Week | Shares / active user | Activation rate | k | Cycle time (days) | Trend / decision |",
        "| --- | --- | --- | --- | --- | --- |",
        `| ${growthIsoDaysAgo(7)} | 3.1 | 0.2 | 9.9 | 6 | hold |`,
      ].join("\n"),
    ),
    "utf8",
  );
  runFixture(
    "an alias-headed row with inconsistent k fails",
    viralGrowthAliasMismatch,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.loop_economics_unmeasured",
  );

  // A prose computation that contradicts its own factors is not a measurement.
  const viralGrowthProseKMismatch = makeFixture("viral-growth-prose-k-mismatch");
  writeCompleteViralGrowth(viralGrowthProseKMismatch);
  writeFileSync(
    path.join(viralGrowthProseKMismatch, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthProseKMismatch, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      "Loop Economics: measured k = 9.9 in week 1 from 3.1 shares per active user and 20% recipient conversion; cycle time: 6 days; trend: flat.",
    ),
    "utf8",
  );
  runFixture(
    "a prose k contradicting its own factors fails",
    viralGrowthProseKMismatch,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.loop_economics_unmeasured",
  );

  // Goal lines cannot supply the cycle time and trend for a measured k.
  const viralGrowthGoalCycleTrend = makeFixture("viral-growth-goal-cycle-trend");
  writeCompleteViralGrowth(viralGrowthGoalCycleTrend);
  writeFileSync(
    path.join(viralGrowthGoalCycleTrend, "growth", "VIRAL_GROWTH.md"),
    readFileSync(path.join(viralGrowthGoalCycleTrend, "growth", "VIRAL_GROWTH.md"), "utf8").replace(
      /^Loop Economics:.*$/m,
      ["Loop Economics: measured k = 0.4 in week 1.", "Goal: cycle time: 6 days; trend: rising."].join("\n"),
    ),
    "utf8",
  );
  runFixture(
    "goal-line cycle time and trend do not complete a measurement",
    viralGrowthGoalCycleTrend,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.loop_economics_unmeasured",
  );

  // Budget digits size no roster.
  const viralGrowthBudgetDigitBands = makeFixture("viral-growth-budget-digit-bands");
  writeCompleteViralGrowth(viralGrowthBudgetDigitBands);
  writeFileSync(
    path.join(viralGrowthBudgetDigitBands, "growth/UGC_PLAYBOOK.md"),
    [
      "# UGC Playbook",
      "",
      "Creator scripts use GROW-001 and the format lab.",
      "",
      "## Post-Breakout Scale Model",
      "",
      "Each band is a founder-gated budget step with install-per-video fatigue measured weekly.",
      "",
      "| Band | Roster | Weekly video volume | Budget (founder-gated) | Entered on / evidence |",
      "| --- | --- | --- | --- | --- |",
      `| Discovery | | | $300 | ${growthIsoDaysAgo(7)} — install-per-video 210 |`,
      "| Proven format | | | $500 | |",
      "| Scale | | | $1000 | |",
      "| Volume | | | $2500 | |",
      "",
      "- Control format install-per-video (weekly): fatigue check — two consecutive declines trigger the next variant test.",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "budget digits without roster or volume numbers define no bands",
    viralGrowthBudgetDigitBands,
    "check-viral-growth-loop.ts",
    1,
    "viral_growth.ugc_scale_model_missing",
  );

  const paidUaMissing = makeFixture("paid-ua-missing");
  rmSync(path.join(paidUaMissing, "growth", "PAID_UA.md"), { force: true });
  runFixture("missing paid UA packet fails", paidUaMissing, "check-paid-user-acquisition.ts", 1, "paid_ua.markdown_missing");

  const paidUaThin = makeFixture("paid-ua-thin");
  mkdirSync(path.join(paidUaThin, "growth"), { recursive: true });
  writeFileSync(
    path.join(paidUaThin, "growth", "PAID_UA.md"),
    ["# Paid User Acquisition", "Fit Gate", "Channel Choice: try Meta, TikTok, Google, and Apple Ads at the same time."].join("\n"),
    "utf8",
  );
  runFixture("thin paid UA packet fails", paidUaThin, "check-paid-user-acquisition.ts", 1, "paid_ua.creative_production.missing");

  // Stop/scale rules without recorded numbers are vibes: the four Decision
  // Thresholds must be present so a weekly report can be judged mechanically.
  const paidUaNoThresholds = makeFixture("paid-ua-no-decision-thresholds");
  writeCompletePaidUserAcquisition(paidUaNoThresholds);
  writeFileSync(
    path.join(paidUaNoThresholds, "growth", "PAID_UA.md"),
    readFileSync(path.join(paidUaNoThresholds, "growth", "PAID_UA.md"), "utf8")
      .split("\n")
      .filter((line) => !line.startsWith("Decision Thresholds:"))
      .join("\n"),
    "utf8",
  );
  runFixture("paid UA without decision thresholds fails", paidUaNoThresholds, "check-paid-user-acquisition.ts", 1, "paid_ua.decision_thresholds.missing");

  // Labels without values are not thresholds: a done lane whose numbers still
  // sit in template comments fails per label.
  const paidUaBlankThresholds = makeFixture("paid-ua-blank-threshold-values");
  writeCompletePaidUserAcquisition(paidUaBlankThresholds);
  writeFileSync(
    path.join(paidUaBlankThresholds, "growth", "PAID_UA.md"),
    readFileSync(path.join(paidUaBlankThresholds, "growth", "PAID_UA.md"), "utf8").replace(
      /^Decision Thresholds:.*$/m,
      ["Decision Thresholds:", "Attribution tolerance:", "Payback window:", "Creative signal floor:", "Scale trigger:"].join("\n"),
    ),
    "utf8",
  );
  runFixture(
    "done paid UA with valueless thresholds fails",
    paidUaBlankThresholds,
    "check-paid-user-acquisition.ts",
    1,
    "paid_ua.attribution_tolerance.value_missing",
  );

  const paidUaDonePlaceholder = makeFixture("paid-ua-done-placeholder");
  writeCompletePaidUserAcquisition(paidUaDonePlaceholder);
  writeFileSync(
    path.join(paidUaDonePlaceholder, "growth", "PAID_UA.md"),
    readFileSync(path.join(paidUaDonePlaceholder, "growth", "PAID_UA.md"), "utf8") + "\nTODO: choose final weekly budget.\n",
    "utf8",
  );
  runFixture("done paid UA with placeholders fails", paidUaDonePlaceholder, "check-paid-user-acquisition.ts", 1, "paid_ua.placeholder_complete");

  const paidUaDoneReportMissing = makeFixture("paid-ua-done-report-missing");
  writeCompletePaidUserAcquisition(paidUaDoneReportMissing);
  rmSync(path.join(paidUaDoneReportMissing, "growth", "paid-ua-report.csv"), { force: true });
  runFixture("done paid UA without report fails", paidUaDoneReportMissing, "check-paid-user-acquisition.ts", 1, "paid_ua.report_missing_done");

  const paidUaNoVirality = makeFixture("paid-ua-no-virality");
  writeCompletePaidUserAcquisition(paidUaNoVirality);
  {
    const paidUaPath = path.join(paidUaNoVirality, "growth", "PAID_UA.md");
    const withoutVirality = readFileSync(paidUaPath, "utf8")
      .split("\n")
      .filter((line) => !line.includes("Virality Predictor"))
      .join("\n");
    writeFileSync(paidUaPath, withoutVirality, "utf8");
  }
  runFixture("paid UA without virality scoring gate fails", paidUaNoVirality, "check-paid-user-acquisition.ts", 1, "paid_ua.virality_gate.missing");

  const paidUaStubReport = makeFixture("paid-ua-stub-report");
  writeCompletePaidUserAcquisition(paidUaStubReport);
  writeFileSync(path.join(paidUaStubReport, "growth", "paid-ua-report.csv"), "done\n", "utf8");
  runFixture("done paid UA with a stub report file fails", paidUaStubReport, "check-paid-user-acquisition.ts", 1, "paid_ua.report_content_thin");

  // --- check-launch-narrative ---
  const narrativeBaseline = makeFixture("launch-narrative-baseline");
  runFixture("shipped launch narrative template passes", narrativeBaseline, "check-launch-narrative.ts", 0);

  const narrativeMissing = makeFixture("launch-narrative-missing");
  rmSync(path.join(narrativeMissing, "growth", "LAUNCH_NARRATIVE.md"), { force: true });
  runFixture("active growth lane without a launch narrative fails", narrativeMissing, "check-launch-narrative.ts", 1, "launch_narrative.markdown_missing");

  const narrativeHashtag = makeFixture("launch-narrative-hashtag-copy");
  {
    const narrativePath = path.join(narrativeHashtag, "growth", "LAUNCH_NARRATIVE.md");
    const withHashtagCopy = `${readFileSync(narrativePath, "utf8")}\n\n\`\`\`text\nWe are live today. #LaunchDay\n\`\`\`\n`;
    writeFileSync(narrativePath, withHashtagCopy, "utf8");
  }
  runFixture("launch post copy with a hashtag fails the 2026 guardrails", narrativeHashtag, "check-launch-narrative.ts", 1, "launch_narrative.copy_hashtag");
}
