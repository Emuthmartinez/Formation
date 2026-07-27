#!/usr/bin/env node
/**
 * check-revenue.ts
 *
 * PRESENT / PROVEN / OPTIMIZED checks for the revenue lane.
 *
 * Hard errors (exit 1):
 *   - Revenue lane is "done" but revenue/revenuecat-proof.json does not exist.
 *   - Revenue lane is "done" but the proof JSON is invalid or missing the
 *     "probe":"revenuecat@1" fingerprint.
 *   - Revenue lane is "done" but proof JSON offering_id is empty/missing.
 *   - Revenue lane is "done" but proof JSON entitlement_ids is empty.
 *   - Revenue lane is "done" but proof JSON is byte-identical to the example
 *     file (Tier-1 anti-gaming floor).
 *   - Revenue lane is "done" but proof JSON is below the minimum byte
 *     threshold (Tier-1 anti-gaming floor).
 *   - Revenue lane is "done" but REVENUE_OPS.md contains any product in
 *     MISSING_METADATA state.
 *   - Revenue lane is "done" but REVENUE_OPS.md contains a product mapped as
 *     non_renewing_subscription (lifetime must be non_consumable).
 *   - Revenue lane is "done" but REVENUE_OPS.md contains no product table rows.
 *   - Revenue lane is "done" but REVENUE_OPS.md contains no currentOffering ID.
 *   - Revenue lane is "done" but restore-purchase test is not confirmed in
 *     revenue/revenuecat-proof.md or PRODUCTION_READINESS.md.
 *
 * Warnings:
 *   - Proof JSON timestamp is older than 30 days (stale probe).
 *   - Proof JSON offering_resolved or entitlements_present is false (probe
 *     ran but failed to confirm live state).
 *   - Paywall model/trial/price decision is undocumented or left at template
 *     placeholder text.
 *   - Annual plan is not offered or not highlighted as the recommended option.
 *   - Freemium model chosen without a documented network-effect rationale.
 *   - Involuntary-churn recovery not addressed when lane is done.
 *   - Orphan state: revenue lane is "partial" but REVENUE_OPS.md is missing.
 *   - Proof artifact path declared in REVENUE_OPS.md references a bare word
 *     (no slash/dot) that is not a recognizable file path.
 *   - Prose fallback: revenuecat-proof.md present but lacks entitlement/release
 *     confirmation (warning only; JSON is the authoritative proof).
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit, type Issue } from "./lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues: Issue[] = [...loaded.issues];
const state = loaded.state;

const revenueOpsPath = "REVENUE_OPS.md";
const providerProofPath = "PROVIDER_PROOF.md";
const productionReadinessPath = "PRODUCTION_READINESS.md";
const proofJsonRelPath = "revenue/revenuecat-proof.json";
const proofMdRelPath = "revenue/revenuecat-proof.md";
// The example file ships with the skill; used for the byte-identity Tier-1 floor.
const proofJsonExampleRelPath = "revenue/revenuecat-proof.example.json";

// Minimum byte threshold for a real proof artifact (Tier-1 anti-gaming floor).
// The example JSON is ~490 bytes; a minimal real artifact with a real offering ID
// and entitlement is at least this size.
const PROOF_JSON_MIN_BYTES = 300;

const revenueOpsText = readText(args.root, revenueOpsPath);
const providerProofText = readText(args.root, providerProofPath);
const productionReadinessText = readText(args.root, productionReadinessPath);

const revenueStatus = state ? asString(getPath(state, "lanes.revenue.status"))?.toLowerCase() : undefined;
const revenueDone = revenueStatus === "done";
const revenueSkipped = revenueStatus === "not_needed" || revenueStatus === "deferred";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return true when text contains the given pattern (case-insensitive). */
function textHasPattern(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

/**
 * The block from the first `## `-level heading whose text matches `pattern`
 * to the next `## ` heading (or EOF). Sub-headings (###) stay inside the block.
 */
function markdownSectionLoose(markdown: string, pattern: RegExp): string {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s/.test(line) && pattern.test(line));
  if (start === -1) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s/.test(lines[i] ?? "")) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

/** Return true when a path value looks like a placeholder rather than a real path. */
function isPlaceholderPath(value: string): boolean {
  return /MISSING|TODO|TBD|placeholder|example|_example_/i.test(value);
}

/**
 * Warn when an evidence path string is a bare word with no slash or dot
 * (cannot be a real relative file path).
 */
function looksLikeBareWord(value: string): boolean {
  return !value.includes("/") && !value.includes("\\") && !value.includes(".");
}

/**
 * Extract the evidence path from a PROVIDER_PROOF.md RevenueCat row.
 * The template row pattern is:
 *   | RevenueCat | ... | ... | revenue/revenuecat-proof.json | ... |
 */
function extractRevenueCatEvidencePath(text: string): string | undefined {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("|")) {
      continue;
    }
    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter((_, index, array) => index > 0 && index < array.length - 1);

    if (cells.length < 2) {
      continue;
    }

    const [provider, , , evidenceCell] = cells;
    if (!provider?.toLowerCase().includes("revenuecat")) {
      continue;
    }

    // A literal pipe in an earlier cell (shell pipeline in the proof command)
    // shifts positional cells, so only accept the positional candidate when it
    // actually looks like a file path; otherwise fall through to scanning the
    // row for an extension-bearing cell.
    const candidate = evidenceCell ?? "";
    if (candidate && !isPlaceholderPath(candidate) && /\.[A-Za-z0-9]+$/.test(candidate)) {
      return candidate;
    }

    for (const cell of cells.slice(1)) {
      if (/\.(md|json|yaml|yml|txt|csv|html)$/i.test(cell) && !isPlaceholderPath(cell)) {
        return cell;
      }
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Tier-1 content floor helpers
// ---------------------------------------------------------------------------

/**
 * Read raw bytes (utf8 string) from a path relative to root.
 * Returns undefined if the file does not exist.
 */
function rawContent(relativePath: string): string | undefined {
  const fullPath = path.join(args.root, relativePath);
  if (!existsSync(fullPath)) {
    return undefined;
  }
  return readFileSync(fullPath, "utf8");
}

/**
 * Check whether the proof JSON content is byte-identical to the example file.
 * Also checks whether it falls below the minimum size threshold.
 * Pushes issues and returns true if the content fails the Tier-1 floor.
 */
function checkTier1Floor(proofContent: string): boolean {
  let failed = false;

  // Byte size floor.
  const byteLength = Buffer.byteLength(proofContent, "utf8");
  if (byteLength < PROOF_JSON_MIN_BYTES) {
    issues.push(
      issue(
        "error",
        "revenue.proof_json.tier1_too_small",
        `revenue/revenuecat-proof.json is ${byteLength} bytes, below the ${PROOF_JSON_MIN_BYTES}-byte minimum. The file appears to be empty or a stub — run the live probe (doppler run -- npm run probe:revenuecat) to generate a real artifact.`,
        proofJsonRelPath,
      ),
    );
    failed = true;
  }

  // Byte-identity check against the example file. Compare against the app
  // repo's copy AND the copy shipped inside this skill: an app repo that never
  // seeded the example used to silently skip this floor, so pasting the
  // shipped example's content as "proof" evaded detection.
  const shippedExamplePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "templates", proofJsonExampleRelPath);
  const exampleContents = [rawContent(proofJsonExampleRelPath), existsSync(shippedExamplePath) ? readFileSync(shippedExamplePath, "utf8") : undefined];
  for (const exampleContent of exampleContents) {
    if (exampleContent === undefined) {
      continue;
    }
    const proofNormalized = proofContent.trim();
    const exampleNormalized = exampleContent.trim();
    if (proofNormalized === exampleNormalized) {
      issues.push(
        issue(
          "error",
          "revenue.proof_json.tier1_example_copy",
          "revenue/revenuecat-proof.json is byte-identical to the shipped example file. Copy-pasting the example does not constitute proof. Run the live probe (doppler run -- npm run probe:revenuecat) to generate a real artifact from live API calls.",
          proofJsonRelPath,
        ),
      );
      failed = true;
      break;
    }
  }

  return failed;
}

// ---------------------------------------------------------------------------
// Tier-3 proof JSON verification helpers
// ---------------------------------------------------------------------------

interface ProofJson {
  probe?: unknown;
  probed_at?: unknown;
  offering_id?: unknown;
  entitlement_ids?: unknown;
  offering_resolved?: unknown;
  entitlements_present?: unknown;
  warnings?: unknown;
  [k: string]: unknown;
}

/**
 * Parse and validate the revenuecat-proof.json artifact.
 * Pushes issues and returns the parsed object (or undefined on failure).
 */
function loadAndVerifyProofJson(proofContent: string): ProofJson | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(proofContent);
  } catch {
    issues.push(
      issue(
        "error",
        "revenue.proof_json.invalid_json",
        "revenue/revenuecat-proof.json exists but is not valid JSON. Re-run the live probe to regenerate it.",
        proofJsonRelPath,
      ),
    );
    return undefined;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    issues.push(
      issue(
        "error",
        "revenue.proof_json.wrong_shape",
        "revenue/revenuecat-proof.json must be a JSON object. Re-run the live probe to regenerate it.",
        proofJsonRelPath,
      ),
    );
    return undefined;
  }

  const obj = parsed as ProofJson;

  // Fingerprint check — distinguishes real probe output from hand-typed JSON.
  // Acknowledged: this is a raised bar, not cryptographically unforgeable.
  // The fingerprint prefix check allows future minor versions (e.g. "revenuecat@2").
  const probeValue = typeof obj.probe === "string" ? obj.probe : "";
  if (!probeValue.startsWith("revenuecat@")) {
    issues.push(
      issue(
        "error",
        "revenue.proof_json.fingerprint_missing",
        'revenue/revenuecat-proof.json is missing the "probe":"revenuecat@1" fingerprint. Hand-typed JSON is not accepted as proof. Run the live probe (doppler run -- npm run probe:revenuecat) to generate a real artifact.',
        proofJsonRelPath,
      ),
    );
    return obj; // continue partial validation
  }

  // Timestamp freshness.
  const probedAt = typeof obj.probed_at === "string" ? obj.probed_at : "";
  if (!probedAt) {
    issues.push(
      issue(
        "error",
        "revenue.proof_json.timestamp_missing",
        'revenue/revenuecat-proof.json is missing the "probed_at" ISO timestamp. Re-run the live probe to regenerate it.',
        proofJsonRelPath,
      ),
    );
  } else {
    const probeDate = new Date(probedAt);
    if (Number.isNaN(probeDate.getTime())) {
      issues.push(
        issue(
          "error",
          "revenue.proof_json.timestamp_invalid",
          `revenue/revenuecat-proof.json has an invalid "probed_at" timestamp: "${probedAt}". Re-run the live probe.`,
          proofJsonRelPath,
        ),
      );
    } else {
      const ageMs = Date.now() - probeDate.getTime();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      if (ageMs > thirtyDaysMs) {
        const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
        issues.push(
          issue(
            "warning",
            "revenue.proof_json.stale",
            `revenue/revenuecat-proof.json was generated ${ageDays} days ago (probed_at: ${probedAt}). Re-run the live probe before launch to confirm offerings and entitlements are still current.`,
            proofJsonRelPath,
          ),
        );
      }
    }
  }

  // Offering ID.
  const offeringId = typeof obj.offering_id === "string" ? obj.offering_id.trim() : "";
  if (!offeringId) {
    issues.push(
      issue(
        "error",
        "revenue.proof_json.offering_id_empty",
        'revenue/revenuecat-proof.json has an empty or missing "offering_id". The live probe must return a non-empty offering before the revenue lane is marked done. Check that the RevenueCat project has a current offering configured.',
        proofJsonRelPath,
      ),
    );
  }

  // Entitlements.
  const entitlementIds = Array.isArray(obj.entitlement_ids) ? obj.entitlement_ids : [];
  if (entitlementIds.length === 0) {
    issues.push(
      issue(
        "error",
        "revenue.proof_json.entitlements_empty",
        'revenue/revenuecat-proof.json has an empty "entitlement_ids" array. The live probe must return at least one entitlement before the revenue lane is marked done. Create entitlements in the RevenueCat dashboard first.',
        proofJsonRelPath,
      ),
    );
  }

  // offering_resolved / entitlements_present flag consistency (warn, not error —
  // the authoritative checks are the field values above).
  if (obj.offering_resolved === false) {
    issues.push(
      issue(
        "warning",
        "revenue.proof_json.offering_unresolved",
        'revenue/revenuecat-proof.json reports "offering_resolved": false. The probe ran but could not confirm the offering. Re-run after configuring the current offering in RevenueCat.',
        proofJsonRelPath,
      ),
    );
  }
  if (obj.entitlements_present === false) {
    issues.push(
      issue(
        "warning",
        "revenue.proof_json.entitlements_absent",
        'revenue/revenuecat-proof.json reports "entitlements_present": false. The probe ran but found no entitlements. Create entitlements in RevenueCat and re-run the probe.',
        proofJsonRelPath,
      ),
    );
  }

  // Surface probe warnings recorded in the artifact.
  const probeWarnings = Array.isArray(obj.warnings) ? obj.warnings : [];
  for (const warn of probeWarnings) {
    if (typeof warn === "string" && warn.trim()) {
      issues.push(issue("warning", "revenue.proof_json.probe_warning", `Probe warning from revenuecat-proof.json: ${warn}`, proofJsonRelPath));
    }
  }

  return obj;
}

// ---------------------------------------------------------------------------
// PRESENT checks (orphan warnings when lane is partial)
// ---------------------------------------------------------------------------

if (!revenueSkipped) {
  if (!revenueOpsText) {
    issues.push(
      issue(
        revenueDone ? "error" : "warning",
        "revenue.ops_doc.missing",
        "REVENUE_OPS.md is required for the revenue lane. Copy templates/REVENUE_OPS.md and fill in products, offering, and paywall model.",
        revenueOpsPath,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// PROVEN checks (hard errors when lane is "done")
// ---------------------------------------------------------------------------

if (revenueDone && revenueOpsText) {
  // 1. currentOffering must be identified (not a template placeholder).
  const hasCurrentOffering =
    textHasPattern(revenueOpsText, /current offering\s*id\s*:/i) ||
    textHasPattern(revenueOpsText, /currentoffering/i) ||
    textHasPattern(revenueOpsText, /offering[^:]*:\s*`[^`]+`/i);
  if (!hasCurrentOffering) {
    issues.push(
      issue(
        "error",
        "revenue.offering_id.missing",
        "REVENUE_OPS.md must identify the currentOffering ID (e.g. 'default') before the revenue lane is marked done.",
        revenueOpsPath,
      ),
    );
  }

  // 2. At least one real product table row (not the example/placeholder row).
  //    Counted inside the product table itself — the one whose header names
  //    "Store Product ID" — so rows in the anchor, cancellation, or snapshot
  //    tables cannot stand in for a real product.
  const productTableRows = ((): string[] => {
    const lines = revenueOpsText.split(/\r?\n/);
    const headerIndex = lines.findIndex((line) => line.trim().startsWith("|") && line.toLowerCase().includes("store product id"));
    if (headerIndex === -1) return [];
    const rows: string[] = [];
    for (let i = headerIndex + 1; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      if (!line.trim().startsWith("|")) break;
      if (line.includes("---")) continue;
      if (/_example_|_example:/i.test(line)) continue;
      rows.push(line);
    }
    return rows;
  })();
  if (productTableRows.length === 0) {
    issues.push(
      issue(
        "error",
        "revenue.product_table.empty",
        "REVENUE_OPS.md must contain at least one product table row with real product IDs (in the Store Product ID table) before the revenue lane is marked done.",
        revenueOpsPath,
      ),
    );
  }

  // 2b. Pricing decision floor — the §7a procedure's output. The heading, at
  //     least one real competitor row in the anchor table, and a dated founder
  //     approval must all be present before the lane is done: a price chosen
  //     with no anchor and no recorded approval is a default, not a decision.
  // Comments are stripped first: a date or an anchor row sitting inside an
  // HTML comment is template guidance the founder never confirmed, not a
  // recorded decision.
  const pricingSection = markdownSectionLoose(revenueOpsText, /pricing decision/i).replace(/<!--[\s\S]*?-->/g, " ");
  if (!pricingSection) {
    issues.push(
      issue(
        "error",
        "revenue.pricing_decision.missing",
        'REVENUE_OPS.md has no "Pricing Decision" section. Run the price-point decision procedure (revenue-monetization.md §7a) and record the anchor table, candidates, and founder approval before the revenue lane is marked done.',
        revenueOpsPath,
      ),
    );
  } else {
    // Anchor rows live under the Competitor Anchor sub-heading specifically —
    // rows in the cancellation-mix table (same parent section) do not count.
    const anchorLines = pricingSection.split(/\r?\n/);
    const anchorStart = anchorLines.findIndex((line) => /^###\s/.test(line) && /competitor anchor/i.test(line));
    let anchorEnd = anchorLines.length;
    for (let i = anchorStart + 1; anchorStart !== -1 && i < anchorLines.length; i += 1) {
      if (/^###?\s/.test(anchorLines[i] ?? "")) {
        anchorEnd = i;
        break;
      }
    }
    const anchorRows = (anchorStart === -1 ? [] : anchorLines.slice(anchorStart + 1, anchorEnd))
      .filter((line) => line.trim().startsWith("|"))
      .filter((line) => !line.includes("---"))
      .filter((line) => !/^\|\s*competitor\s*\|/i.test(line.trim()))
      .filter((line) => !/_example_|_example:/i.test(line))
      .filter((line) => line.split("|").some((cell, index) => index > 0 && cell.trim().length > 0));
    if (anchorRows.length === 0) {
      issues.push(
        issue(
          "error",
          "revenue.pricing_anchor.empty",
          "The Pricing Decision section has no real competitor anchor rows. Price against the category (revenue-monetization.md §7a step 1) — an empty anchor table means the price was picked from air.",
          revenueOpsPath,
        ),
      );
    }
    const approvalLine = pricingSection.split(/\r?\n/).find((line) => /founder approved/i.test(line));
    if (!approvalLine || !/\d{4}-\d{2}-\d{2}/.test(approvalLine)) {
      issues.push(
        issue(
          "error",
          "revenue.pricing_approval.undated",
          "The Pricing Decision section records no dated founder approval. Pricing is founder-only (revenue-monetization.md §9) — record the ISO date the founder approved the chosen points.",
          revenueOpsPath,
        ),
      );
    }
  }

  // 2c. Paywall experiment cadence — the §7b program's output. The first
  //     paywall is a hypothesis; once the app has been live four weeks with the
  //     revenue lane done, the backlog must show at least one active or
  //     completed experiment row. One reasonable paywall shipped and never
  //     touched again is the plateau the skill's own anti-pattern list names —
  //     this makes it a red check instead of a prose warning.
  const liveSinceRaw = state ? ((asString(getPath(state, "lanes.post_launch_ops.live_since")) ?? "").trim()) : "";
  const liveSinceDate = /^\d{4}-\d{2}-\d{2}$/.test(liveSinceRaw) ? new Date(`${liveSinceRaw}T00:00:00Z`) : undefined;
  const liveDays =
    liveSinceDate && !Number.isNaN(liveSinceDate.getTime()) && liveSinceDate.getTime() <= Date.now()
      ? Math.floor((Date.now() - liveSinceDate.getTime()) / 86_400_000)
      : 0;
  if (liveDays >= 28) {
    const backlogSection = markdownSectionLoose(revenueOpsText, /paywall experiment backlog/i).replace(/<!--[\s\S]*?-->/g, " ");
    if (!backlogSection) {
      issues.push(
        issue(
          "error",
          "revenue.experiment_backlog.missing",
          'REVENUE_OPS.md has no "Paywall Experiment Backlog" section and the app has been live four-plus weeks. The first paywall is a ' +
            "hypothesis, not a decision — stand up the experiment program (revenue-monetization.md §7b) before the plateau sets in.",
          revenueOpsPath,
        ),
      );
    } else {
      const backlogRows = backlogSection
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("|") && !line.includes("---") && !/hypothesis/i.test(line));
      const activeOrCompleted = backlogRows.filter((line) => /\b(active|completed)\b/i.test(line) && /\d{4}-\d{2}-\d{2}/.test(line));
      if (activeOrCompleted.length === 0) {
        issues.push(
          issue(
            "error",
            "revenue.experiment_backlog.empty",
            `The Paywall Experiment Backlog has no dated active or completed experiment row and the app has been live ${liveDays} days. ` +
              "A backlog of empty headers is the one-and-done plateau wearing a green check — start the first timing/packaging/trial test " +
              "(revenue-monetization.md §7b) and record it with its start date.",
            revenueOpsPath,
          ),
        );
      }
    }
  }

  // Table data rows only: not separators, not header rows, not guidance prose.
  // Both checks below must judge what the table STATES, never what the template's
  // own guidance text or column headers merely mention — the old document-wide
  // regexes were neutralized by the header "MISSING_METADATA cleared?" (gate
  // could never fire) and false-fired on the guidance sentence naming
  // non_renewing_subscription (gate always fired).
  const tableDataRows = revenueOpsText
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|"))
    .filter((line) => !line.includes("---") && !line.toLowerCase().includes("store product id"));

  // 3. MISSING_METADATA check — no product row may still be in MISSING_METADATA.
  //    Two reads: a row that records the state literally, and — when the shipped
  //    table schema is present — the "MISSING_METADATA cleared?" column itself,
  //    where a "no", a negative phrase, or an unanswered cell is unresolved even
  //    though the row never repeats the MISSING_METADATA string.
  const unresolvedMetadataRows = tableDataRows
    .filter((line) => /MISSING_METADATA/i.test(line))
    .filter((line) => !/cleared|yes/i.test(line.replace(/MISSING_METADATA/gi, " ")));

  const clearanceColumnUnresolved = ((): boolean => {
    const lines = revenueOpsText.split(/\r?\n/);
    const headerIndex = lines.findIndex((line) => line.trim().startsWith("|") && /MISSING_METADATA\s+cleared/i.test(line));
    if (headerIndex === -1) return false;
    const clearanceCell = (lines[headerIndex] ?? "").split("|").findIndex((cell) => /MISSING_METADATA\s+cleared/i.test(cell));
    for (let i = headerIndex + 1; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      if (!line.trim().startsWith("|")) break;
      if (line.includes("---")) continue;
      if (/_example_|_example:/i.test(line)) continue;
      const cell = (line.split("|")[clearanceCell] ?? "").trim();
      if (cell === "" || /^(no\b|not\b|pending|blocked|missing)/i.test(cell)) return true;
    }
    return false;
  })();

  if (unresolvedMetadataRows.length > 0 || clearanceColumnUnresolved) {
    issues.push(
      issue(
        "error",
        "revenue.missing_metadata.unresolved",
        'REVENUE_OPS.md contains a product in MISSING_METADATA state (a row recording the state, or a product table row whose "MISSING_METADATA cleared?" column is negative or unanswered). All App Store subscription products must clear MISSING_METADATA (subscription-group localizations created) before the revenue lane is marked done.',
        revenueOpsPath,
      ),
    );
  }

  // 4. Product-type reconciliation — non_renewing_subscription is wrong for lifetime.
  if (tableDataRows.some((line) => /non_renewing_subscription/i.test(line))) {
    issues.push(
      issue(
        "error",
        "revenue.product_type.non_renewing_subscription",
        "REVENUE_OPS.md lists a product typed as non_renewing_subscription. Lifetime/one-time unlock products must be non_consumable; non_renewing_subscription silently expires and is the wrong type for a permanent unlock.",
        revenueOpsPath,
      ),
    );
  }

  // 5. RevenueCat proof JSON artifact (Tier-3 live probe artifact verification).
  //    This replaces the previous prose/keyword scan on PROVIDER_PROOF.md.
  const proofJsonContent = rawContent(proofJsonRelPath);
  if (!proofJsonContent) {
    issues.push(
      issue(
        "error",
        "revenue.proof_json.missing",
        `revenue/revenuecat-proof.json does not exist. Run the founder-gated live probe before marking the revenue lane done: doppler run -- npm run probe:revenuecat`,
        proofJsonRelPath,
      ),
    );
  } else {
    // Tier-1 content floor: reject example copies and tiny stubs.
    const tier1Failed = checkTier1Floor(proofJsonContent);

    // Only run deeper validation if the Tier-1 floor passed (no point parsing
    // a stub that will fail anyway, and byte-identity check would also fail JSON
    // parse in the example's case).
    if (!tier1Failed) {
      loadAndVerifyProofJson(proofJsonContent);
    }
  }

  // 5b. Proof JSON path declared in REVENUE_OPS.md — warn if it is a bare word.
  const proofPathFromOps = (() => {
    const match = revenueOpsText.match(/RevenueCat proof artifact path\s*:\s*`?([^\s`\n]+)`?/i);
    if (match && match[1] && !isPlaceholderPath(match[1])) {
      return match[1];
    }
    return undefined;
  })();

  if (!proofPathFromOps) {
    issues.push(
      issue(
        "error",
        "revenue.proof_artifact.path_undeclared",
        "REVENUE_OPS.md must declare a 'RevenueCat proof artifact path' pointing to the on-disk proof file (e.g. revenue/revenuecat-proof.json).",
        revenueOpsPath,
      ),
    );
  } else if (looksLikeBareWord(proofPathFromOps)) {
    // Tier-1: bare-word evidence path is suspicious — warn (not error) since the
    // JSON artifact check above is the authoritative gating mechanism.
    issues.push(
      issue(
        "warning",
        "revenue.proof_artifact.path_bare_word",
        `The RevenueCat proof artifact path in REVENUE_OPS.md ("${proofPathFromOps}") looks like a bare word rather than a relative file path (no slash or dot). Expected a path like revenue/revenuecat-proof.json.`,
        revenueOpsPath,
      ),
    );
  }

  // 5c. Prose fallback: revenuecat-proof.md — warn if it exists but lacks
  //     entitlement/release confirmation. This is a warning only; the JSON
  //     artifact is the authoritative proof.
  const proofMdText = readText(args.root, proofMdRelPath);
  if (proofMdText) {
    const confirmsEntitlement = textHasPattern(
      proofMdText,
      /entitlement.*active|entitlement.*granted|entitlement.*unlock|access.*granted|premium.*active|sandbox purchase.*grant|confirmed granted inside app.*yes/i,
    );
    if (!confirmsEntitlement) {
      issues.push(
        issue(
          "warning",
          "revenue.proof_md.entitlement_unconfirmed",
          `revenue/revenuecat-proof.md exists but does not confirm that a sandbox purchase granted the named entitlement inside the app. Fill in the "Entitlement Granted Inside App" section before marking the revenue lane done.`,
          proofMdRelPath,
        ),
      );
    }

    const confirmsRelease = textHasPattern(proofMdText, /release build tested.*yes|release.*scheme.*release|currentoffering non-empty in release.*yes/i);
    if (!confirmsRelease) {
      issues.push(
        issue(
          "warning",
          "revenue.proof_md.release_unconfirmed",
          `revenue/revenuecat-proof.md exists but does not confirm that the offering resolves in a Release-scheme build. Fill in the "Release Build Confirmed" section.`,
          proofMdRelPath,
        ),
      );
    }
  }

  // 6. Restore tested — check proof.md companion or PRODUCTION_READINESS.md.
  const restoreInProofMd = proofMdText
    ? textHasPattern(proofMdText, /restore.*purchase|purchase.*restore|restore.*tested|restore.*verified|restore result.*succeeded/i)
    : false;
  const restoreInReadiness = productionReadinessText ? textHasPattern(productionReadinessText, /restore.*purchase|purchase.*restore/i) : false;
  if (!restoreInProofMd && !restoreInReadiness) {
    issues.push(
      issue(
        "error",
        "revenue.restore.unconfirmed",
        "Restore-purchases path must be confirmed tested in revenue/revenuecat-proof.md or PRODUCTION_READINESS.md before the revenue lane is marked done.",
        proofMdRelPath,
      ),
    );
  }

  // 7. PROVIDER_PROOF.md must reference RevenueCat (still required for cross-file
  //    consistency; the primary proof is now the JSON artifact).
  if (!providerProofText) {
    issues.push(
      issue(
        "error",
        "revenue.provider_proof.missing",
        "PROVIDER_PROOF.md is required when the revenue lane is done. It must include a RevenueCat row with a real evidence path.",
        providerProofPath,
      ),
    );
  } else {
    if (!providerProofText.toLowerCase().includes("revenuecat")) {
      issues.push(
        issue(
          "error",
          "revenue.provider_proof.revenuecat_row.missing",
          "PROVIDER_PROOF.md must contain a RevenueCat row with current status, proof command, and evidence path.",
          providerProofPath,
        ),
      );
    } else {
      const evidencePath = extractRevenueCatEvidencePath(providerProofText);
      if (!evidencePath) {
        issues.push(
          issue(
            "error",
            "revenue.provider_proof.evidence_path.missing",
            "The RevenueCat row in PROVIDER_PROOF.md must contain a real evidence path (not a placeholder) pointing to the on-disk proof artifact.",
            providerProofPath,
          ),
        );
      } else {
        // Tier-1: warn (not error) if the evidence path is a bare word.
        if (looksLikeBareWord(evidencePath)) {
          issues.push(
            issue(
              "warning",
              "revenue.provider_proof.evidence_path_bare_word",
              `The RevenueCat evidence path in PROVIDER_PROOF.md ("${evidencePath}") looks like a bare word rather than a relative file path. Expected a path like revenue/revenuecat-proof.json.`,
              providerProofPath,
            ),
          );
        } else {
          const resolvedEvidencePath = path.join(args.root, evidencePath);
          if (!existsSync(resolvedEvidencePath)) {
            issues.push(
              issue(
                "error",
                "revenue.provider_proof.evidence_file.missing",
                `The RevenueCat evidence path in PROVIDER_PROOF.md (${evidencePath}) does not exist on disk. Run the live probe and ensure the artifact exists before marking the revenue lane done.`,
                evidencePath,
              ),
            );
          }
        }
      }
    }
  }

  // 8. Check for unresolved placeholder text in REVENUE_OPS.md.
  const placeholderPatterns = [/<!--\s*fill in/i, /example:\s*com\.app\./i, /_example_/i, /\bTODO\b/, /\bTBD\b/, /\bpending\b.*model/i];
  for (const pattern of placeholderPatterns) {
    if (textHasPattern(revenueOpsText, pattern)) {
      issues.push(
        issue(
          "error",
          "revenue.ops_doc.placeholder_unresolved",
          `REVENUE_OPS.md contains unfilled template placeholder text (matched: ${pattern.source}). Fill in product IDs, paywall model, offering ID, and proof path before marking the revenue lane done.`,
          revenueOpsPath,
        ),
      );
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// OPTIMIZED checks (warnings — taste stays human)
// ---------------------------------------------------------------------------

if (!revenueSkipped && revenueOpsText) {
  const hasPaWallModelDecision =
    /model\s*:\s*(hard_paywall|freemium|reverse_trial|web_funnel)/i.test(revenueOpsText) || /paywall model\s*decision/i.test(revenueOpsText);
  if (!hasPaWallModelDecision) {
    issues.push(
      issue(
        "warning",
        "revenue.paywall_model.undocumented",
        "REVENUE_OPS.md does not record an explicit paywall model decision (hard_paywall | freemium | reverse_trial | web_funnel). Document the choice and rationale citing benchmarks.",
        revenueOpsPath,
      ),
    );
  }

  const hasPricingDecision = /trial duration\s*:/i.test(revenueOpsText) || /price.*annual\s*:/i.test(revenueOpsText);
  if (!hasPricingDecision) {
    issues.push(
      issue(
        "warning",
        "revenue.pricing_decision.undocumented",
        "REVENUE_OPS.md does not record trial duration and price as explicit decisions. Document the plan mix, trial, and pricing with a benchmark citation (e.g. RevenueCat State of Subscription Apps 2026).",
        revenueOpsPath,
      ),
    );
  }

  const choosesFreemium = /model\s*:\s*freemium/i.test(revenueOpsText);
  if (choosesFreemium) {
    const hasFreemiumRationale = /network[- ]effect|ugc|word.of.mouth|marketplace|rationale/i.test(revenueOpsText);
    if (!hasFreemiumRationale) {
      issues.push(
        issue(
          "warning",
          "revenue.freemium.rationale_missing",
          "Freemium model chosen but no network-effect, UGC, or word-of-mouth rationale is documented. Per benchmarks, freemium yields ~5x lower D35 conversion vs. hard paywall. Document the deliberate reason (see revenue-monetization.md §10 anti-pattern 2).",
          revenueOpsPath,
        ),
      );
    }
  }

  const offersAnnual = /annual/i.test(revenueOpsText);
  const annualHighlighted = /highlighted plan\s*:\s*annual/i.test(revenueOpsText);
  if (offersAnnual && !annualHighlighted && revenueDone) {
    issues.push(
      issue(
        "warning",
        "revenue.annual_plan.not_highlighted",
        "Annual plan is present but not recorded as the highlighted (recommended) plan. Per benchmarks, featuring annual as the default option improves realized LTV. Set 'Highlighted plan: annual' or document the deliberate reason.",
        revenueOpsPath,
      ),
    );
  }

  if (revenueDone) {
    const hasChurnRecovery = /involuntary.churn|billing.issue|grace.period|dunning|billing.recovery/i.test(revenueOpsText);
    const addressedInReadiness = productionReadinessText ? /billing.issue|grace.period|dunning/i.test(productionReadinessText) : false;
    if (!hasChurnRecovery && !addressedInReadiness) {
      issues.push(
        issue(
          "warning",
          "revenue.involuntary_churn_recovery.unaddressed",
          "Revenue lane is done but involuntary-churn recovery (grace period, billing-issue webhook, dunning) is not addressed in REVENUE_OPS.md or PRODUCTION_READINESS.md. On Google Play ~31% of cancellations are involuntary billing failures (see revenue-monetization.md §8a).",
          revenueOpsPath,
        ),
      );
    }
  }
}

reportAndExit("Revenue lane check", issues);
