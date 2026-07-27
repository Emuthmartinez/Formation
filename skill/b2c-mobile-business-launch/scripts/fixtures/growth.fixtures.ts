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

  const contentFallbackUnapproved = makeFixture("content-fallback-unapproved");
  mkdirSync(path.join(contentFallbackUnapproved, "content-assets"), { recursive: true });
  writeFileSync(
    path.join(contentFallbackUnapproved, "content-assets", "CONTENT_ASSETS.md"),
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
  mkdirSync(path.join(remotionLicenseUnchecked, "content-assets"), { recursive: true });
  writeFileSync(
    path.join(remotionLicenseUnchecked, "content-assets", "CONTENT_ASSETS.md"),
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
    path.join(remotionLicenseUnchecked, "content-assets", "manifest.json"),
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
            inputs: ["DESIGN.md"],
            outputs: ["content-assets/out/ad.mp4"],
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
  mkdirSync(path.join(thinContentManifest, "content-assets"), { recursive: true });
  writeFileSync(
    path.join(thinContentManifest, "content-assets", "CONTENT_ASSETS.md"),
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
    path.join(thinContentManifest, "content-assets", "manifest.json"),
    JSON.stringify({ assets: [{ asset_id: "thin", route: "remotion", status: "draft" }] }, null, 2),
    "utf8",
  );
  runFixture("thin Remotion content manifest fails", thinContentManifest, "check-content-assets.ts", 1, "content_assets.manifest.assets.0.surface.missing");

  const higgsfieldNoBrief = makeFixture("content-higgsfield-no-brief");
  mkdirSync(path.join(higgsfieldNoBrief, "content-assets"), { recursive: true });
  writeFileSync(
    path.join(higgsfieldNoBrief, "content-assets", "CONTENT_ASSETS.md"),
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
    path.join(higgsfieldNoBrief, "content-assets", "manifest.json"),
    JSON.stringify(
      {
        assets: [
          {
            asset_id: "founder-ad",
            surface: "meta_paid",
            route: "higgsfield_marketing_studio",
            status: "draft",
            dimensions: "1080x1920",
            inputs: ["DESIGN.md"],
            outputs: ["content-assets/out/founder-ad.mp4"],
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
  writeFileSync(path.join(viralGrowthNoUgcScale, "UGC_PLAYBOOK.md"), "# UGC Playbook\n\nCreator scripts use GROW-001 and the format lab.\n", "utf8");
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
  writeFileSync(path.join(viralGrowthUgcScaleThin, "UGC_PLAYBOOK.md"), "# UGC Playbook\n\nPost-breakout band founder.\n", "utf8");
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
  rmSync(path.join(viralGrowthNoPlaybook, "UGC_PLAYBOOK.md"), { force: true });
  runFixture("done growth lane without UGC_PLAYBOOK.md fails", viralGrowthNoPlaybook, "check-viral-growth-loop.ts", 1, "viral_growth.ugc_playbook_missing");

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
    path.join(viralGrowthLabelsOnly, "UGC_PLAYBOOK.md"),
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
      loopTable("| 2026-07-20 | 3.1 | 0.2 | 0.62 | 6 | hold and retest the share moment |"),
    ),
    "utf8",
  );
  runFixture("a dated loop row with a numeric k passes", viralGrowthMeasuredRow, "check-viral-growth-loop.ts", 0);

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
