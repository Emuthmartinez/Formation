import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Harness, writeCompletePaidUserAcquisition } from "./_harness.js";

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
}
