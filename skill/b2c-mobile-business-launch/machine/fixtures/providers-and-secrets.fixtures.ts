import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Harness, expectRecord, getLane, getTools, readState, skillRoot, writeCompleteSecurity, writeState } from "./_harness.js";

export function register(h: Harness): void {
  const { makeFixture, runFixture } = h;

  const nestedEnv = makeFixture("nested-env");
  mkdirSync(path.join(nestedEnv, "config"), { recursive: true });
  writeFileSync(path.join(nestedEnv, "config", ".env"), "POSTHOG_PROJECT_API_KEY=example\n", "utf8");
  runFixture("nested .env fails secret routing", nestedEnv, "check-secret-routing.ts", 1, "secrets.forbidden_file..env");

  const rawEnvExample = makeFixture("raw-env-example");
  mkdirSync(path.join(rawEnvExample, "trust", "secrets"), { recursive: true });
  writeFileSync(path.join(rawEnvExample, "trust", "secrets", ".env.example"), "STRIPE_SECRET_KEY=sk_test_1234567890abcdef\n", "utf8");
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

  // The credential-extraction scan matches command names, and the command names
  // have to be word-bounded. Unanchored, `sed` matched inside ordinary prose —
  // "closed", "exposed", "compromised" — so any incident write-up that also said
  // "credentials" was reported as an extraction snippet. The gate was failing the
  // security docs it exists to protect, and the only ways out were editing shared
  // tooling or doctoring a dated incident record.
  const extractionProse = makeFixture("credential-extraction-prose");
  mkdirSync(path.join(extractionProse, "incidents"), { recursive: true });
  writeFileSync(
    path.join(extractionProse, "incidents", "2026-07-15-review.md"),
    [
      "# Incident review",
      "",
      "- fail-closed guard | PASS — anonymous credentials rejected",
      "- treat the exposed account as compromised and rotate its credentials",
      "- we parsed the response before any credentials were stored",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "prose using closed/exposed/compromised near 'credentials' is not an extraction snippet",
    extractionProse,
    "check-secret-routing.ts",
    0,
    undefined,
    [],
    undefined,
    "secrets.credential_extraction_in_markdown",
  );

  // ...and the snippet the gate actually exists for still warns.
  const extractionSnippet = makeFixture("credential-extraction-snippet");
  mkdirSync(path.join(extractionSnippet, "docs"), { recursive: true });
  writeFileSync(
    path.join(extractionSnippet, "docs", "store-notes.md"),
    ["# Store notes", "", "VAR=$(awk -F= '/^ASC_ISSUER=/{print $2}' /path/to/file.env)", ""].join("\n"),
    "utf8",
  );
  runFixture(
    "a real awk extraction snippet in committed markdown still warns",
    extractionSnippet,
    "check-secret-routing.ts",
    0,
    "secrets.credential_extraction_in_markdown",
  );

  // Word boundaries exclude prefixed executables too, so the variants are
  // enumerated. GNU-prefixed (`gawk`, `gsed`, `ggrep`) and compression-wrapper
  // (`zgrep`, `bzgrep`, `xzgrep`) forms extract the same raw values and were
  // only ever caught by substring luck; each one gets a line here so the
  // enumeration cannot silently rot back to catching just the three bare names.
  // A prefix wildcard would be shorter and wrong — English words end in these
  // tokens, which is the exact bug this gate just fixed.
  const extractionVariants = [
    "gawk",
    "mawk",
    "nawk",
    "gsed",
    "ggrep",
    "egrep",
    "fgrep",
    "rg",
    "ripgrep",
    "zgrep",
    "zegrep",
    "zfgrep",
    "bzgrep",
    "bzegrep",
    "bzfgrep",
    "xzgrep",
    "xzegrep",
    "xzfgrep",
    "lzgrep",
    "zstdgrep",
  ];
  for (const command of extractionVariants) {
    const variantRoot = makeFixture(`credential-extraction-${command}`);
    mkdirSync(path.join(variantRoot, "docs"), { recursive: true });
    writeFileSync(
      path.join(variantRoot, "docs", "store-notes.md"),
      ["# Store notes", "", `VAR=$(${command} '^ASC_ISSUER=' /path/to/file.env)`, ""].join("\n"),
      "utf8",
    );
    runFixture(
      `${command} extraction snippet in committed markdown still warns`,
      variantRoot,
      "check-secret-routing.ts",
      0,
      "secrets.credential_extraction_in_markdown",
    );
  }

  // ...and the boundaries still hold against the prose that looks like them.
  const extractionNearMiss = makeFixture("credential-extraction-near-miss");
  mkdirSync(path.join(extractionNearMiss, "incidents"), { recursive: true });
  writeFileSync(
    path.join(extractionNearMiss, "incidents", "2026-07-16-review.md"),
    [
      "# Incident review",
      "",
      "- awkward handling of credentials, and grepping around for credentials",
      "- our org rotated the rgb theme and its credentials",
      "- a squawk about the mohawk build, and the credentials it used",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "awkward/grepping/squawk/mohawk/org/rgb near 'credentials' are not extraction commands",
    extractionNearMiss,
    "check-secret-routing.ts",
    0,
    undefined,
    [],
    undefined,
    "secrets.credential_extraction_in_markdown",
  );

  // The exemption for the skill's own guidance prose is named for the directory
  // that prose lives in, so a rename can kill it silently. `references/` became
  // `playbook/` in v0.53.0 and the exemption kept naming the old directory for
  // eight releases: it matched nothing, and the gate warned about
  // playbook/operations/secrets-management.md, the document whose whole job is to
  // describe credential handling. These two fixtures pin the exemption to a name
  // that exists and prove it is still scoped rather than blanket.
  const extractionPlaybook = makeFixture("credential-extraction-playbook-exempt");
  mkdirSync(path.join(extractionPlaybook, "playbook", "operations"), { recursive: true });
  writeFileSync(
    path.join(extractionPlaybook, "playbook", "operations", "secrets-management.md"),
    ["# Secrets management", "", "Never do this:", "", "VAR=$(awk -F= '/^ASC_ISSUER=/{print $2}' /path/to/file.env)", ""].join("\n"),
    "utf8",
  );
  runFixture(
    "the skill's own playbook prose may describe an extraction snippet",
    extractionPlaybook,
    "check-secret-routing.ts",
    0,
    undefined,
    [],
    undefined,
    "secrets.credential_extraction_in_markdown",
  );

  // The old name must not still buy a pass, or the rename would be cosmetic and
  // an app repo could silence this gate by naming a directory `references/`.
  const extractionOldName = makeFixture("credential-extraction-references-not-exempt");
  mkdirSync(path.join(extractionOldName, "references"), { recursive: true });
  writeFileSync(
    path.join(extractionOldName, "references", "notes.md"),
    ["# Notes", "", "VAR=$(awk -F= '/^ASC_ISSUER=/{print $2}' /path/to/file.env)", ""].join("\n"),
    "utf8",
  );
  runFixture(
    "an app-side references/ directory is not the skill's playbook and still warns",
    extractionOldName,
    "check-secret-routing.ts",
    0,
    "secrets.credential_extraction_in_markdown",
  );

  const missingSecurity = makeFixture("missing-security");
  rmSync(path.join(missingSecurity, "trust/SECURITY.md"), { force: true });
  runFixture("missing security packet fails", missingSecurity, "check-security-release.ts", 1, "security.markdown_missing");

  const thinSecurity = makeFixture("thin-security");
  writeFileSync(path.join(thinSecurity, "trust/SECURITY.md"), ["# Security", "We will be secure.", "Sentry is planned."].join("\n"), "utf8");
  runFixture("thin security packet fails", thinSecurity, "check-security-release.ts", 1, "security.source_basis.missing");

  const unresolvedSecurity = makeFixture("unresolved-security");
  writeCompleteSecurity(unresolvedSecurity);
  writeFileSync(
    path.join(unresolvedSecurity, "trust/SECURITY.md"),
    [
      "# Security Release Plan",
      "Source Basis: OWASP MASVS, OWASP ASVS, Apple Platform Security, Android security best practices, Claude Security, Codex Security, MobSF, Doppler, Sentry.",
      "Security Review Tool Routing: free fallback requires founder approval.",
      "Threat Model: Assets, Trust Boundaries, Attacker Capabilities, and Data Classification are present.",
      "Mobile Hardening: Keychain, App Transport Security, App Attest, DeviceCheck, entitlements, store/APPLE_SIGNING.md, Android Keystore, Network Security Config, and Play Integrity are listed.",
      "Authentication and Authorization protect Backend and API routes. Secrets use Doppler.",
      "Revenue, Entitlements, RevenueCat, Stripe, restore, webhook, and idempotency are covered.",
      "Privacy and Analytics include PostHog, session replay, PII, PII scrubbing, and self-reported attribution.",
      "Email security includes SPF, DKIM, DMARC, unsubscribe, and Resend. Public web uses security.txt and security headers.",
      "Supply Chain, Monitoring, Incident Response, Release Checks, Accepted Risks, Founder Approval, Sentry, release health, and MobSF are covered.",
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
  const shippedExample = readFileSync(path.join(skillRoot, "business", "revenue", "revenuecat-proof.example.json"), "utf8");
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
  const missingMetadataOps = readFileSync(path.join(revenueMissingMetadata, "revenue/REVENUE_OPS.md"), "utf8");
  writeFileSync(
    path.join(revenueMissingMetadata, "revenue/REVENUE_OPS.md"),
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
  const clearanceOps = readFileSync(path.join(revenueClearanceNo, "revenue/REVENUE_OPS.md"), "utf8");
  writeFileSync(
    path.join(revenueClearanceNo, "revenue/REVENUE_OPS.md"),
    clearanceOps.replace(/(\| Store Product ID \|[^\n]*\n\|[ \-|]*\n)/, "$1| com.app.pro.monthly | pro_monthly | auto_renewable | premium | monthly | no |\n"),
    "utf8",
  );
  runFixture("done revenue lane with a clearance column answering no fails", revenueClearanceNo, "check-revenue.ts", 1, "revenue.missing_metadata.unresolved");

  // Paywall experiment cadence (§7b): once the app has been live four weeks
  // with the revenue lane done, the backlog needs a dated active or completed
  // row — the one-and-done paywall is the plateau the gate exists to stop.
  const experimentIsoDaysAgo = (days: number): string => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
  };

  const revenueExperimentEmpty = makeFixture("revenue-experiment-backlog-empty");
  {
    const state = readState(revenueExperimentEmpty);
    getLane(state, "revenue")["status"] = "done";
    getLane(state, "post_launch_ops")["live_since"] = experimentIsoDaysAgo(40);
    writeState(revenueExperimentEmpty, state);
  }
  runFixture(
    "done revenue lane live four-plus weeks with an empty experiment backlog fails",
    revenueExperimentEmpty,
    "check-revenue.ts",
    1,
    "revenue.experiment_backlog.empty",
  );

  const revenueExperimentMissing = makeFixture("revenue-experiment-backlog-missing");
  {
    const state = readState(revenueExperimentMissing);
    getLane(state, "revenue")["status"] = "done";
    getLane(state, "post_launch_ops")["live_since"] = experimentIsoDaysAgo(40);
    writeState(revenueExperimentMissing, state);
    const opsPath = path.join(revenueExperimentMissing, "revenue/REVENUE_OPS.md");
    writeFileSync(opsPath, readFileSync(opsPath, "utf8").replace("## Paywall Experiment Backlog", "## Old Notes"), "utf8");
  }
  runFixture(
    "done revenue lane live four-plus weeks without the backlog section fails",
    revenueExperimentMissing,
    "check-revenue.ts",
    1,
    "revenue.experiment_backlog.missing",
  );

  // "completed" inside a hypothesis must not satisfy the cadence: the Status
  // cell is parsed by its header column.
  const revenueExperimentWordDrift = makeFixture("revenue-experiment-status-word-drift");
  {
    const state = readState(revenueExperimentWordDrift);
    getLane(state, "revenue")["status"] = "done";
    getLane(state, "post_launch_ops")["live_since"] = experimentIsoDaysAgo(40);
    writeState(revenueExperimentWordDrift, state);
    const opsPath = path.join(revenueExperimentWordDrift, "revenue/REVENUE_OPS.md");
    const ops = readFileSync(opsPath, "utf8").replace(
      "| --- | --- | --- | --- | --- | --- |\n\n## Founder-Gated Probe Step",
      `| --- | --- | --- | --- | --- | --- |\n| ${experimentIsoDaysAgo(10)} | users completed checkout faster with the annual anchor | anchor-first paywall | trial-start rate | planned | |\n\n## Founder-Gated Probe Step`,
    );
    writeFileSync(opsPath, ops, "utf8");
  }
  runFixture(
    "planned backlog row with 'completed' in its hypothesis does not satisfy the cadence",
    revenueExperimentWordDrift,
    "check-revenue.ts",
    1,
    "revenue.experiment_backlog.empty",
  );

  // A bogus Started date must not silence the cadence forever.
  const revenueExperimentBogusStart = makeFixture("revenue-experiment-bogus-start");
  {
    const state = readState(revenueExperimentBogusStart);
    getLane(state, "revenue")["status"] = "done";
    getLane(state, "post_launch_ops")["live_since"] = experimentIsoDaysAgo(40);
    writeState(revenueExperimentBogusStart, state);
    const opsPath = path.join(revenueExperimentBogusStart, "revenue/REVENUE_OPS.md");
    const ops = readFileSync(opsPath, "utf8").replace(
      "| --- | --- | --- | --- | --- | --- |\n\n## Founder-Gated Probe Step",
      "| --- | --- | --- | --- | --- | --- |\n| 2026-99-99 | anchor-first paywall lifts trials | anchor-first | trial-start rate | active | |\n\n## Founder-Gated Probe Step",
    );
    writeFileSync(opsPath, ops, "utf8");
  }
  runFixture(
    "active backlog row with an impossible start date does not satisfy the cadence",
    revenueExperimentBogusStart,
    "check-revenue.ts",
    1,
    "revenue.experiment_backlog.empty",
  );

  // One historical test must not satisfy the cadence forever.
  const revenueExperimentStale = makeFixture("revenue-experiment-stale");
  {
    const state = readState(revenueExperimentStale);
    getLane(state, "revenue")["status"] = "done";
    getLane(state, "post_launch_ops")["live_since"] = experimentIsoDaysAgo(180);
    writeState(revenueExperimentStale, state);
    const opsPath = path.join(revenueExperimentStale, "revenue/REVENUE_OPS.md");
    const ops = readFileSync(opsPath, "utf8").replace(
      "| --- | --- | --- | --- | --- | --- |\n\n## Founder-Gated Probe Step",
      `| --- | --- | --- | --- | --- | --- |\n| ${experimentIsoDaysAgo(120)} | anchor-first paywall lifts trials | anchor-first | trial-start rate | completed | +12% trial starts, trial-to-paid held at 20% over one renewal window; kept |\n\n## Founder-Gated Probe Step`,
    );
    writeFileSync(opsPath, ops, "utf8");
  }
  runFixture(
    "a single completed experiment from four months ago does not satisfy the cadence",
    revenueExperimentStale,
    "check-revenue.ts",
    1,
    "revenue.experiment_backlog.stale",
  );

  // A recently completed experiment is current activity — the backlog codes stay silent.
  const revenueExperimentCurrent = makeFixture("revenue-experiment-current");
  {
    const state = readState(revenueExperimentCurrent);
    getLane(state, "revenue")["status"] = "done";
    getLane(state, "post_launch_ops")["live_since"] = experimentIsoDaysAgo(40);
    writeState(revenueExperimentCurrent, state);
    const opsPath = path.join(revenueExperimentCurrent, "revenue/REVENUE_OPS.md");
    const ops = readFileSync(opsPath, "utf8").replace(
      "| --- | --- | --- | --- | --- | --- |\n\n## Founder-Gated Probe Step",
      `| --- | --- | --- | --- | --- | --- |\n| ${experimentIsoDaysAgo(10)} | annual anchor first lifts trial starts | anchor-first layout | trial-start rate | completed | +18% trial starts, trial-to-paid held at 22% over one renewal window; founder kept it |\n\n## Founder-Gated Probe Step`,
    );
    writeFileSync(opsPath, ops, "utf8");
  }
  runFixture(
    "a recently completed experiment satisfies the cadence",
    revenueExperimentCurrent,
    "check-revenue.ts",
    1,
    "error(s),",
    [],
    undefined,
    "revenue.experiment_backlog",
  );

  // An old completed test plus a dated next experiment is also current activity.
  const revenueExperimentDatedNext = makeFixture("revenue-experiment-dated-next");
  {
    const state = readState(revenueExperimentDatedNext);
    getLane(state, "revenue")["status"] = "done";
    getLane(state, "post_launch_ops")["live_since"] = experimentIsoDaysAgo(90);
    writeState(revenueExperimentDatedNext, state);
    const opsPath = path.join(revenueExperimentDatedNext, "revenue/REVENUE_OPS.md");
    const ops = readFileSync(opsPath, "utf8").replace(
      "| --- | --- | --- | --- | --- | --- |\n\n## Founder-Gated Probe Step",
      `| --- | --- | --- | --- | --- | --- |\n| ${experimentIsoDaysAgo(80)} | anchor-first paywall lifts trials | anchor-first | trial-start rate | completed | +12% trial starts, trial-to-paid held at 20% over one renewal window; kept |\n| ${experimentIsoDaysAgo(-14)} | reverse trial beats opt-in | reverse-trial | trial-to-paid | planned | |\n\n## Founder-Gated Probe Step`,
    );
    writeFileSync(opsPath, ops, "utf8");
  }
  runFixture(
    "an old completed test with a dated next experiment satisfies the cadence",
    revenueExperimentDatedNext,
    "check-revenue.ts",
    1,
    "error(s),",
    [],
    undefined,
    "revenue.experiment_backlog",
  );

  // A live app recording its FIRST dated planned experiment must be able to pass.
  const revenueExperimentFirstPlanned = makeFixture("revenue-experiment-first-planned");
  {
    const state = readState(revenueExperimentFirstPlanned);
    getLane(state, "revenue")["status"] = "done";
    getLane(state, "post_launch_ops")["live_since"] = experimentIsoDaysAgo(40);
    writeState(revenueExperimentFirstPlanned, state);
    const opsPath = path.join(revenueExperimentFirstPlanned, "revenue/REVENUE_OPS.md");
    const ops = readFileSync(opsPath, "utf8").replace(
      "| --- | --- | --- | --- | --- | --- |\n\n## Founder-Gated Probe Step",
      `| --- | --- | --- | --- | --- | --- |\n| ${experimentIsoDaysAgo(-14)} | paywall after value reveal beats paywall-first | delayed paywall | trial-start rate | planned | |\n\n## Founder-Gated Probe Step`,
    );
    writeFileSync(opsPath, ops, "utf8");
  }
  runFixture(
    "a first planned experiment dated within the horizon satisfies the cadence",
    revenueExperimentFirstPlanned,
    "check-revenue.ts",
    1,
    "error(s),",
    [],
    undefined,
    "revenue.experiment_backlog",
  );

  // A date plus a status word is not an experiment.
  const revenueExperimentBlankRow = makeFixture("revenue-experiment-blank-row");
  {
    const state = readState(revenueExperimentBlankRow);
    getLane(state, "revenue")["status"] = "done";
    getLane(state, "post_launch_ops")["live_since"] = experimentIsoDaysAgo(40);
    writeState(revenueExperimentBlankRow, state);
    const opsPath = path.join(revenueExperimentBlankRow, "revenue/REVENUE_OPS.md");
    const ops = readFileSync(opsPath, "utf8").replace(
      "| --- | --- | --- | --- | --- | --- |\n\n## Founder-Gated Probe Step",
      `| --- | --- | --- | --- | --- | --- |\n| ${experimentIsoDaysAgo(10)} | | | | active | |\n\n## Founder-Gated Probe Step`,
    );
    writeFileSync(opsPath, ops, "utf8");
  }
  runFixture(
    "a dated status-only row with blank experiment cells does not satisfy the cadence",
    revenueExperimentBlankRow,
    "check-revenue.ts",
    1,
    "revenue.experiment_backlog.empty",
  );

  // Short standard metric identifiers are defined experiments.
  const revenueExperimentShortMetric = makeFixture("revenue-experiment-short-metric");
  {
    const state = readState(revenueExperimentShortMetric);
    getLane(state, "revenue")["status"] = "done";
    getLane(state, "post_launch_ops")["live_since"] = experimentIsoDaysAgo(40);
    writeState(revenueExperimentShortMetric, state);
    const opsPath = path.join(revenueExperimentShortMetric, "revenue/REVENUE_OPS.md");
    const ops = readFileSync(opsPath, "utf8").replace(
      "| --- | --- | --- | --- | --- | --- |\n\n## Founder-Gated Probe Step",
      `| --- | --- | --- | --- | --- | --- |\n| ${experimentIsoDaysAgo(10)} | annual anchor first lifts conversion | anchor-first layout | CVR | completed | +9% CVR with trial-to-paid steady over one renewal window; founder kept it |\n\n## Founder-Gated Probe Step`,
    );
    writeFileSync(opsPath, ops, "utf8");
  }
  runFixture(
    "a defined experiment measured on CVR satisfies the cadence",
    revenueExperimentShortMetric,
    "check-revenue.ts",
    1,
    "error(s),",
    [],
    undefined,
    "revenue.experiment_backlog",
  );

  // "unknown"/"NA" cells are empty states wearing characters.
  const revenueExperimentNegativeCells = makeFixture("revenue-experiment-negative-cells");
  {
    const state = readState(revenueExperimentNegativeCells);
    getLane(state, "revenue")["status"] = "done";
    getLane(state, "post_launch_ops")["live_since"] = experimentIsoDaysAgo(40);
    writeState(revenueExperimentNegativeCells, state);
    const opsPath = path.join(revenueExperimentNegativeCells, "revenue/REVENUE_OPS.md");
    const ops = readFileSync(opsPath, "utf8").replace(
      "| --- | --- | --- | --- | --- | --- |\n\n## Founder-Gated Probe Step",
      `| --- | --- | --- | --- | --- | --- |\n| ${experimentIsoDaysAgo(10)} | unknown | unknown | NA | completed | unknown |\n\n## Founder-Gated Probe Step`,
    );
    writeFileSync(opsPath, ops, "utf8");
  }
  runFixture(
    "a completed row of unknown/NA cells does not satisfy the cadence",
    revenueExperimentNegativeCells,
    "check-revenue.ts",
    1,
    "revenue.experiment_backlog.empty",
  );

  // Day-one conversion alone is not a completed test.
  const revenueExperimentDayOne = makeFixture("revenue-experiment-day-one-result");
  {
    const state = readState(revenueExperimentDayOne);
    getLane(state, "revenue")["status"] = "done";
    getLane(state, "post_launch_ops")["live_since"] = experimentIsoDaysAgo(40);
    writeState(revenueExperimentDayOne, state);
    const opsPath = path.join(revenueExperimentDayOne, "revenue/REVENUE_OPS.md");
    const ops = readFileSync(opsPath, "utf8").replace(
      "| --- | --- | --- | --- | --- | --- |\n\n## Founder-Gated Probe Step",
      `| --- | --- | --- | --- | --- | --- |\n| ${experimentIsoDaysAgo(10)} | annual anchor first lifts conversion | anchor-first layout | CVR | completed | +9% day-one conversion, kept |\n\n## Founder-Gated Probe Step`,
    );
    writeFileSync(opsPath, ops, "utf8");
  }
  runFixture(
    "a completed row judged on day-one conversion alone does not satisfy the cadence",
    revenueExperimentDayOne,
    "check-revenue.ts",
    1,
    "revenue.experiment_backlog.empty",
  );

  // Naming the economics noun while negating it is not evidence.
  const revenueExperimentNegatedCohort = makeFixture("revenue-experiment-negated-cohort");
  {
    const state = readState(revenueExperimentNegatedCohort);
    getLane(state, "revenue")["status"] = "done";
    getLane(state, "post_launch_ops")["live_since"] = experimentIsoDaysAgo(40);
    writeState(revenueExperimentNegatedCohort, state);
    const opsPath = path.join(revenueExperimentNegatedCohort, "revenue/REVENUE_OPS.md");
    const ops = readFileSync(opsPath, "utf8").replace(
      "| --- | --- | --- | --- | --- | --- |\n\n## Founder-Gated Probe Step",
      `| --- | --- | --- | --- | --- | --- |\n| ${experimentIsoDaysAgo(10)} | annual anchor first lifts conversion | anchor-first layout | CVR | completed | No cohort or renewal evidence was collected |\n\n## Founder-Gated Probe Step`,
    );
    writeFileSync(opsPath, ops, "utf8");
  }
  runFixture(
    "a completed row with negated cohort evidence does not satisfy the cadence",
    revenueExperimentNegatedCohort,
    "check-revenue.ts",
    1,
    "revenue.experiment_backlog.empty",
  );

  // An availability negative after the semicolon affirms nothing either.
  const revenueExperimentUnavailableCohort = makeFixture("revenue-experiment-unavailable-cohort");
  {
    const state = readState(revenueExperimentUnavailableCohort);
    getLane(state, "revenue")["status"] = "done";
    getLane(state, "post_launch_ops")["live_since"] = experimentIsoDaysAgo(40);
    writeState(revenueExperimentUnavailableCohort, state);
    const opsPath = path.join(revenueExperimentUnavailableCohort, "revenue/REVENUE_OPS.md");
    const ops = readFileSync(opsPath, "utf8").replace(
      "| --- | --- | --- | --- | --- | --- |\n\n## Founder-Gated Probe Step",
      `| --- | --- | --- | --- | --- | --- |\n| ${experimentIsoDaysAgo(10)} | annual anchor first lifts conversion | anchor-first layout | CVR | completed | No cohort evidence was collected; renewal window unavailable |\n\n## Founder-Gated Probe Step`,
    );
    writeFileSync(opsPath, ops, "utf8");
  }
  runFixture(
    "a completed row whose renewal window is unavailable does not satisfy the cadence",
    revenueExperimentUnavailableCohort,
    "check-revenue.ts",
    1,
    "revenue.experiment_backlog.empty",
  );

  // A future plan is not an observed result.
  const revenueExperimentFuturePlan = makeFixture("revenue-experiment-future-plan");
  {
    const state = readState(revenueExperimentFuturePlan);
    getLane(state, "revenue")["status"] = "done";
    getLane(state, "post_launch_ops")["live_since"] = experimentIsoDaysAgo(40);
    writeState(revenueExperimentFuturePlan, state);
    const opsPath = path.join(revenueExperimentFuturePlan, "revenue/REVENUE_OPS.md");
    const ops = readFileSync(opsPath, "utf8").replace(
      "| --- | --- | --- | --- | --- | --- |\n\n## Founder-Gated Probe Step",
      `| --- | --- | --- | --- | --- | --- |\n| ${experimentIsoDaysAgo(10)} | annual anchor first lifts conversion | anchor-first layout | CVR | completed | Cohort economics will be measured during the renewal window |\n\n## Founder-Gated Probe Step`,
    );
    writeFileSync(opsPath, ops, "utf8");
  }
  runFixture(
    "a completed row whose result is a future measurement plan does not satisfy the cadence",
    revenueExperimentFuturePlan,
    "check-revenue.ts",
    1,
    "revenue.experiment_backlog.empty",
  );

  // Top-of-funnel alone is not cohort economics.
  const revenueExperimentTrialStartOnly = makeFixture("revenue-experiment-trial-start-only");
  {
    const state = readState(revenueExperimentTrialStartOnly);
    getLane(state, "revenue")["status"] = "done";
    getLane(state, "post_launch_ops")["live_since"] = experimentIsoDaysAgo(40);
    writeState(revenueExperimentTrialStartOnly, state);
    const opsPath = path.join(revenueExperimentTrialStartOnly, "revenue/REVENUE_OPS.md");
    const ops = readFileSync(opsPath, "utf8").replace(
      "| --- | --- | --- | --- | --- | --- |\n\n## Founder-Gated Probe Step",
      `| --- | --- | --- | --- | --- | --- |\n| ${experimentIsoDaysAgo(10)} | annual anchor first lifts trial starts | anchor-first layout | trial-start rate | completed | Trial-start rate +9%; kept |\n\n## Founder-Gated Probe Step`,
    );
    writeFileSync(opsPath, ops, "utf8");
  }
  runFixture(
    "a completed row with trial-start-only evidence does not satisfy the cadence",
    revenueExperimentTrialStartOnly,
    "check-revenue.ts",
    1,
    "revenue.experiment_backlog.empty",
  );

  const revenueWrongType = makeFixture("revenue-lifetime-wrong-product-type");
  const revenueWrongTypeState = readState(revenueWrongType);
  getLane(revenueWrongTypeState, "revenue")["status"] = "done";
  writeState(revenueWrongType, revenueWrongTypeState);
  const wrongTypeOps = readFileSync(path.join(revenueWrongType, "revenue/REVENUE_OPS.md"), "utf8");
  writeFileSync(
    path.join(revenueWrongType, "revenue/REVENUE_OPS.md"),
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
  const commentedDateOps = readFileSync(path.join(revenuePricingCommentedDate, "revenue/REVENUE_OPS.md"), "utf8");
  writeFileSync(
    path.join(revenuePricingCommentedDate, "revenue/REVENUE_OPS.md"),
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
  const pricingOps = readFileSync(path.join(revenuePricingMissing, "revenue/REVENUE_OPS.md"), "utf8");
  writeFileSync(path.join(revenuePricingMissing, "revenue/REVENUE_OPS.md"), pricingOps.replace("## Trial And Pricing Decision", "## Trial Notes"), "utf8");
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
