#!/usr/bin/env node
/**
 * check-localization-research
 *
 * Enforces the research-first localization contract: a launch must research
 * search demand per market and rank markets into priority tiers BEFORE any
 * surface is localized. Translating into many languages with no demand
 * evidence (the "translate-first" anti-pattern) is the failure this catches.
 *
 * When a store launch is in scope (store_console lane not deferred/not_needed
 * and a mobile platform is present), this validator requires:
 *   1. LOCALIZATION_MARKET_RESEARCH.md to exist.
 *   2. A market opportunity matrix with priority tiers (Tier 1/2/3).
 *   3. Per-market popularity AND difficulty signals.
 *   4. At least one demand-research tool source (AppKittie / Apple Search Ads /
 *      App Analytics / XPOZ).
 *   5. No "translate-first": if a listing/console doc claims localized surfaces
 *      but the research matrix is missing, that is a hard error.
 *
 * Run:
 *   npm run check:localization-research -- --root <app-repo-root>
 */
import { asArray, asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit } from "./lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;

function firstExistingText(candidates: string[]): { relativePath: string; text: string } | undefined {
  for (const candidate of candidates) {
    const text = readText(args.root, candidate);
    if (text) {
      return { relativePath: candidate, text };
    }
  }
  return undefined;
}

function includes(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => includes(text, phrase));
}

// ── Lane guards ─────────────────────────────────────────────────────────────

const platforms = state
  ? asArray(getPath(state, "project.platforms"))
      .map((item) => asString(item)?.toLowerCase())
      .filter((item): item is string => Boolean(item))
  : [];
const iosBundleId = state ? asString(getPath(state, "project.bundle_ids.ios")) : undefined;
const androidBundleId = state ? asString(getPath(state, "project.bundle_ids.android")) : undefined;
const hasStorePlatform = state
  ? platforms.includes("ios") || platforms.includes("android") || Boolean(iosBundleId?.trim()) || Boolean(androidBundleId?.trim())
  : true;

const storeStatus = state ? asString(getPath(state, "lanes.store_console.status"))?.toLowerCase() : undefined;
const storeSkipped = ["not_needed", "deferred"].includes(storeStatus ?? "");

if (storeSkipped || !hasStorePlatform) {
  // Localization research is only required when a store launch is in scope.
  reportAndExit("Localization market research check", issues);
  // No argument: honor the exit code reportAndExit set (errors still fail on the skip path).
  process.exit();
}

// ── File discovery ──────────────────────────────────────────────────────────

const research = firstExistingText(["LOCALIZATION_MARKET_RESEARCH.md", "localization-market-research/LOCALIZATION_MARKET_RESEARCH.md"]);

const listing = firstExistingText(["APP_STORE_LISTING.md", "app-store-listing/APP_STORE_LISTING.md"]);
const storeConsole = firstExistingText(["STORE_CONSOLE.md"]);

// ── Check 0: translate-first guard ──────────────────────────────────────────
//
// If a listing/console doc already claims localized surfaces but no research
// matrix exists, localization was started without demand evidence.

const localizedSurfaceClaimed =
  (listing && includesAny(listing.text, ["localization matrix", "localized metadata", "localized keyword", "localized screenshot", "target locales"])) ||
  (storeConsole && includesAny(storeConsole.text, ["localization", "localized name", "localized keyword"]));

if (!research) {
  if (localizedSurfaceClaimed) {
    issues.push(
      issue(
        "error",
        "localization_research.translate_first",
        "Localized surfaces are claimed (metadata/keywords/screenshots) but LOCALIZATION_MARKET_RESEARCH.md does not exist. " +
          "Research search demand per market and rank markets into priority tiers BEFORE localizing. " +
          "Translating without a demand matrix is the translate-first anti-pattern.",
        "LOCALIZATION_MARKET_RESEARCH.md",
      ),
    );
  } else {
    issues.push(
      issue(
        "error",
        "localization_research.file_missing",
        "LOCALIZATION_MARKET_RESEARCH.md is required before localization when a store launch is in scope. " +
          "Produce the market opportunity matrix (popularity, difficulty, priority tiers) in the research phase, " +
          "or set lanes.store_console.status to deferred/not_needed with a reason. " +
          "See playbook/research/localization-market-research.md.",
        "LOCALIZATION_MARKET_RESEARCH.md",
      ),
    );
  }
  reportAndExit("Localization market research check", issues);
  process.exit();
}

const text = research.text;
const file = research.relativePath;

// ── Check 1: priority tiers present ─────────────────────────────────────────

const hasTierColumn = includesAny(text, ["priority tier", "localization priority"]);
const hasTierValues = includes(text, "tier 1") && includes(text, "tier 2") && includes(text, "tier 3");

if (!hasTierColumn || !hasTierValues) {
  issues.push(
    issue(
      "error",
      "localization_research.tiers_missing",
      `${file} must rank markets into priority tiers (Tier 1 full localize / Tier 2 metadata-only / Tier 3 defer) ` +
        "with a priority-tier column. Effort scales with opportunity, not with the number of available languages.",
      file,
    ),
  );
}

// ── Check 2: popularity AND difficulty signals ──────────────────────────────

if (!includes(text, "popularity")) {
  issues.push(
    issue(
      "error",
      "localization_research.popularity_missing",
      `${file} records no keyword popularity signal per market. Capture popularity by storefront ` +
        "(AppKittie keyword popularity/traffic or Apple Search Ads popularity) before assigning tiers.",
      file,
    ),
  );
}
if (!includes(text, "difficulty")) {
  issues.push(
    issue(
      "error",
      "localization_research.difficulty_missing",
      `${file} records no keyword difficulty/competition signal per market. Capture difficulty by storefront ` +
        "(AppKittie batch_keyword_difficulty/get_keyword_difficulty) before assigning tiers.",
      file,
    ),
  );
}

// ── Check 3: demand-research tool sourcing ──────────────────────────────────

const hasToolSource = includesAny(text, ["appkittie", "apple search ads", "app analytics", "google play statistics", "xpoz"]);

if (!hasToolSource) {
  issues.push(
    issue(
      "error",
      "localization_research.evidence_missing",
      `${file} cites no demand-research tool source. Per-market popularity/difficulty/demand must be sourced from ` +
        "AppKittie, Apple Search Ads, App Store Connect App Analytics / Google Play statistics, or XPOZ — not guessed. " +
        "Route through paid-tool-routing.md before any free fallback.",
      file,
    ),
  );
}

// ── Check 4: native-keyword discipline (warning) ────────────────────────────

if (!includesAny(text, ["native", "in-language", "in language"])) {
  issues.push(
    issue(
      "warning",
      "localization_research.native_keywords_unconfirmed",
      `${file} does not confirm that localized keywords are native search terms rather than literal translations. ` +
        "Source in-language vocabulary (storefront popularity + XPOZ) instead of machine-translating the English keyword set.",
      file,
    ),
  );
}

reportAndExit("Localization market research check", issues);
