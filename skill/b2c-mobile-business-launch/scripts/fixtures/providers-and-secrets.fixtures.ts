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

  const nestedEnv = makeFixture("nested-env");
  mkdirSync(path.join(nestedEnv, "config"), { recursive: true });
  writeFileSync(path.join(nestedEnv, "config", ".env"), "POSTHOG_PROJECT_API_KEY=example\n", "utf8");
  runFixture("nested .env fails secret routing", nestedEnv, "check-secret-routing.ts", 1, "secrets.forbidden_file..env");

  const rawEnvExample = makeFixture("raw-env-example");
  writeFileSync(path.join(rawEnvExample, "secrets", ".env.example"), "STRIPE_SECRET_KEY=sk_test_1234567890abcdef\n", "utf8");
  runFixture("raw-looking test key in .env.example fails", rawEnvExample, "check-secret-routing.ts", 1, "secrets.raw_secret_pattern");

  const missingSecretEntry = makeFixture("missing-secret-entry");
  const missingSecretState = readState(missingSecretEntry);
  const missingSecretTools = getTools(missingSecretState);
  expectRecord(missingSecretTools["resend"], "tools.resend")["required_secrets"] = [];
  writeState(missingSecretEntry, missingSecretState);
  writeFileSync(
    path.join(missingSecretEntry, "SECRETS.md"),
    "# Secrets\n\nNo raw secrets. Provider: Doppler. CI and production use `doppler run --`.\n",
    "utf8",
  );
  mkdirSync(path.join(missingSecretEntry, "src"), { recursive: true });
  writeFileSync(path.join(missingSecretEntry, "src", "email.ts"), "export const resendKey = process.env.RESEND_API_KEY;\n", "utf8");
  runFixture(
    "code secret reference missing from state and secrets doc fails",
    missingSecretEntry,
    "check-secret-routing.ts",
    1,
    "secrets.RESEND_API_KEY.unrouted",
  );

  const missingSecurity = makeFixture("missing-security");
  rmSync(path.join(missingSecurity, "SECURITY.md"), { force: true });
  runFixture("missing security packet fails", missingSecurity, "check-security-release.ts", 1, "security.markdown_missing");

  const thinSecurity = makeFixture("thin-security");
  writeFileSync(path.join(thinSecurity, "SECURITY.md"), ["# Security", "We will be secure.", "Sentry is planned."].join("\n"), "utf8");
  runFixture("thin security packet fails", thinSecurity, "check-security-release.ts", 1, "security.source_basis.missing");

  const unresolvedSecurity = makeFixture("unresolved-security");
  writeCompleteSecurity(unresolvedSecurity);
  writeFileSync(
    path.join(unresolvedSecurity, "SECURITY.md"),
    [
      "# Security Release Plan",
      "Source Basis: OWASP MASVS, OWASP ASVS, Apple Platform Security, Android security best practices, Claude Security, Codex Security, MobSF, Doppler, Sentry.",
      "Security Review Tool Routing: free fallback requires founder approval.",
      "Threat Model: Assets, Trust Boundaries, Attacker Capabilities, and Data Classification are present.",
      "Mobile Hardening: Keychain, App Transport Security, App Attest, DeviceCheck, entitlements, APPLE_SIGNING.md, Android Keystore, Network Security Config, and Play Integrity are listed.",
      "Authentication and Authorization protect Backend and API routes. Secrets use Doppler.",
      "Revenue, Entitlements, RevenueCat, Stripe, restore, webhook, and idempotency are covered.",
      "Privacy and Analytics include PostHog, session replay, PII, PII scrubbing, and self-reported attribution.",
      "Email security includes SPF, DKIM, DMARC, unsubscribe, and Resend. Public web uses security.txt and security headers.",
      "Supply Chain, Monitoring, Incident Response, Release Proof, Accepted Risks, Founder Approval, Sentry, release health, and MobSF are covered.",
      "App Attest is pending.",
    ].join("\n"),
    "utf8",
  );
  runFixture("security packet with unresolved platform gate fails", unresolvedSecurity, "check-security-release.ts", 1, "security.placeholder_or_unknown");

  // --- check-revenue ---
  const revenueBaseline = makeFixture("revenue-baseline");
  runFixture("shipped revenue template passes before the lane is claimed", revenueBaseline, "check-revenue.ts", 0);

  const revenueDoneNoProof = makeFixture("revenue-done-no-proof");
  const revenueDoneNoProofState = readState(revenueDoneNoProof);
  getLane(revenueDoneNoProofState, "revenue")["status"] = "done";
  writeState(revenueDoneNoProof, revenueDoneNoProofState);
  runFixture("done revenue lane without a live probe artifact fails", revenueDoneNoProof, "check-revenue.ts", 1, "revenue.proof_json.missing");

  // Example-copy evasion: pasting the shipped example's content as "proof"
  // must fail even when the app repo never seeded the example file (the old
  // comparison only looked at the app repo's copy).
  const revenueExampleCopy = makeFixture("revenue-example-copy-unseeded");
  const revenueExampleCopyState = readState(revenueExampleCopy);
  getLane(revenueExampleCopyState, "revenue")["status"] = "done";
  writeState(revenueExampleCopy, revenueExampleCopyState);
  const shippedExample = readFileSync(path.join(skillRoot, "templates", "revenue", "revenuecat-proof.example.json"), "utf8");
  writeFileSync(path.join(revenueExampleCopy, "revenue", "revenuecat-proof.json"), shippedExample, "utf8");
  rmSync(path.join(revenueExampleCopy, "revenue", "revenuecat-proof.example.json"), { force: true });
  runFixture(
    "done revenue lane with pasted example proof fails even when the example was never seeded",
    revenueExampleCopy,
    "check-revenue.ts",
    1,
    "revenue.proof_json.tier1_example_copy",
  );

  // The three RevenueCat traps documented in failure-cards.md each have a code
  // branch; these fixtures prove the branches actually fire. MISSING_METADATA
  // left unresolved empties the live offering; non_renewing_subscription
  // silently expires a "lifetime" unlock; an unconfirmed Release build is the
  // classic sandbox-only proof.
  const revenueMissingMetadata = makeFixture("revenue-missing-metadata-unresolved");
  const revenueMissingMetadataState = readState(revenueMissingMetadata);
  getLane(revenueMissingMetadataState, "revenue")["status"] = "done";
  writeState(revenueMissingMetadata, revenueMissingMetadataState);
  const missingMetadataOps = readFileSync(path.join(revenueMissingMetadata, "REVENUE_OPS.md"), "utf8");
  writeFileSync(
    path.join(revenueMissingMetadata, "REVENUE_OPS.md"),
    `${missingMetadataOps}\n| com.app.pro.monthly | RevenueCat | auto_renewable | MISSING_METADATA |\n`,
    "utf8",
  );
  runFixture(
    "done revenue lane with a product still in MISSING_METADATA fails",
    revenueMissingMetadata,
    "check-revenue.ts",
    1,
    "revenue.missing_metadata.unresolved",
  );

  // The clearance column itself: a row answering "no" in "MISSING_METADATA
  // cleared?" never repeats the MISSING_METADATA string, so the literal row
  // check cannot see it — the column parse must.
  const revenueClearanceNo = makeFixture("revenue-clearance-column-no");
  const revenueClearanceNoState = readState(revenueClearanceNo);
  getLane(revenueClearanceNoState, "revenue")["status"] = "done";
  writeState(revenueClearanceNo, revenueClearanceNoState);
  const clearanceOps = readFileSync(path.join(revenueClearanceNo, "REVENUE_OPS.md"), "utf8");
  writeFileSync(
    path.join(revenueClearanceNo, "REVENUE_OPS.md"),
    clearanceOps.replace(/(\| Store Product ID \|[^\n]*\n\|[ \-|]*\n)/, "$1| com.app.pro.monthly | pro_monthly | auto_renewable | premium | monthly | no |\n"),
    "utf8",
  );
  runFixture("done revenue lane with a clearance column answering no fails", revenueClearanceNo, "check-revenue.ts", 1, "revenue.missing_metadata.unresolved");

  const revenueWrongType = makeFixture("revenue-lifetime-wrong-product-type");
  const revenueWrongTypeState = readState(revenueWrongType);
  getLane(revenueWrongTypeState, "revenue")["status"] = "done";
  writeState(revenueWrongType, revenueWrongTypeState);
  const wrongTypeOps = readFileSync(path.join(revenueWrongType, "REVENUE_OPS.md"), "utf8");
  writeFileSync(
    path.join(revenueWrongType, "REVENUE_OPS.md"),
    `${wrongTypeOps}\n| com.app.lifetime | RevenueCat | non_renewing_subscription | Ready |\n`,
    "utf8",
  );
  runFixture(
    "done revenue lane with a lifetime product typed non_renewing_subscription fails",
    revenueWrongType,
    "check-revenue.ts",
    1,
    "revenue.product_type.non_renewing_subscription",
  );

  // Pricing decision floor (§7a): heading, real anchor rows, dated approval.
  // The shipped template carries the structure with example-only content, so a
  // done lane on the untouched template fails the anchor and approval checks.
  const revenuePricingUnfilled = makeFixture("revenue-pricing-unfilled");
  const revenuePricingUnfilledState = readState(revenuePricingUnfilled);
  getLane(revenuePricingUnfilledState, "revenue")["status"] = "done";
  writeState(revenuePricingUnfilled, revenuePricingUnfilledState);
  runFixture("done revenue lane with example-only competitor anchor fails", revenuePricingUnfilled, "check-revenue.ts", 1, "revenue.pricing_anchor.empty");
  runFixture(
    "done revenue lane without dated founder pricing approval fails",
    revenuePricingUnfilled,
    "check-revenue.ts",
    1,
    "revenue.pricing_approval.undated",
  );

  // A real ISO date typed inside the template's HTML comment is guidance the
  // founder never confirmed — comments are stripped before the approval check.
  const revenuePricingCommentedDate = makeFixture("revenue-pricing-approval-in-comment");
  const revenuePricingCommentedDateState = readState(revenuePricingCommentedDate);
  getLane(revenuePricingCommentedDateState, "revenue")["status"] = "done";
  writeState(revenuePricingCommentedDate, revenuePricingCommentedDateState);
  const commentedDateOps = readFileSync(path.join(revenuePricingCommentedDate, "REVENUE_OPS.md"), "utf8");
  writeFileSync(
    path.join(revenuePricingCommentedDate, "REVENUE_OPS.md"),
    commentedDateOps.replace(/^Founder approved:.*$/m, "Founder approved: <!-- 2026-07-26 -->"),
    "utf8",
  );
  runFixture(
    "founder approval date hidden inside an HTML comment still fails",
    revenuePricingCommentedDate,
    "check-revenue.ts",
    1,
    "revenue.pricing_approval.undated",
  );

  const revenuePricingMissing = makeFixture("revenue-pricing-section-missing");
  const revenuePricingMissingState = readState(revenuePricingMissing);
  getLane(revenuePricingMissingState, "revenue")["status"] = "done";
  writeState(revenuePricingMissing, revenuePricingMissingState);
  const pricingOps = readFileSync(path.join(revenuePricingMissing, "REVENUE_OPS.md"), "utf8");
  writeFileSync(path.join(revenuePricingMissing, "REVENUE_OPS.md"), pricingOps.replace("## Trial And Pricing Decision", "## Trial Notes"), "utf8");
  runFixture("done revenue lane without a pricing decision section fails", revenuePricingMissing, "check-revenue.ts", 1, "revenue.pricing_decision.missing");

  const revenueSandboxOnly = makeFixture("revenue-release-build-unconfirmed");
  const revenueSandboxOnlyState = readState(revenueSandboxOnly);
  getLane(revenueSandboxOnlyState, "revenue")["status"] = "done";
  writeState(revenueSandboxOnly, revenueSandboxOnlyState);
  writeFileSync(
    path.join(revenueSandboxOnly, "revenue", "revenuecat-proof.md"),
    ["# RevenueCat Proof", "", "Sandbox purchase confirmed: entitlement active and access granted inside the app.", ""].join("\n"),
    "utf8",
  );
  runFixture(
    "revenuecat-proof.md without Release-build confirmation surfaces the sandbox-only warning",
    revenueSandboxOnly,
    "check-revenue.ts",
    1,
    "revenue.proof_md.release_unconfirmed",
  );
}
