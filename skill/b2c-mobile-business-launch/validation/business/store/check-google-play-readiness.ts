#!/usr/bin/env node
/**
 * check-google-play-readiness
 *
 * Enforces Google Play distribution parity when Android is in scope. iOS has
 * deep packet coverage (store/APPLE_SIGNING.md, store/APPLE_APP_STORE_REQUIREMENTS.md);
 * this validator stops the Play side from shipping as an afterthought clone
 * of the ASC packet. When the project targets Android (platforms include
 * android or an android bundle id exists) and the store lane is active:
 *   1. store/GOOGLE_PLAY_RELEASE.md must exist.
 *   2. It must carry the Play-specific sections: Developer Account,
 *      Data Safety, Content Rating, Play App Signing, Target API Level,
 *      Release Tracks, Closed Testing, Pre-Launch Report.
 *   3. done additionally requires: an AAB (not APK) route, the
 *      personal-account closed-testing gate addressed (12 testers / 14 days,
 *      or an organization account recorded), and Data Safety reconciliation
 *      with the iOS privacy answers stated.
 *
 * See knowledge/store/google-play-release.md.
 *
 * Run:
 *   npm run check:google-play -- --root <app-repo-root>
 */
import { asArray, asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit } from "../../../tooling/lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;

function includes(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => includes(text, phrase));
}

// ── Scope guard: Android must actually be in scope ──────────────────────────

const platforms = state
  ? asArray(getPath(state, "project.platforms"))
      .map((item) => asString(item)?.toLowerCase())
      .filter((item): item is string => Boolean(item))
  : [];
const androidBundleId = state ? asString(getPath(state, "project.bundle_ids.android")) : undefined;
const androidInScope = platforms.includes("android") || Boolean(androidBundleId?.trim());

const storeStatus = state ? asString(getPath(state, "lanes.store_console.status"))?.toLowerCase() : undefined;
const storeSkipped = ["not_needed", "deferred"].includes(storeStatus ?? "");
const storeDone = storeStatus === "done";

if (!androidInScope || storeSkipped) {
  reportAndExit("Google Play readiness check", issues);
  // No argument: honor the exit code reportAndExit set (errors still fail on the skip path).
  process.exit();
}

// ── Check 0: packet exists ──────────────────────────────────────────────────

const packetCandidates = ["store/GOOGLE_PLAY_RELEASE.md", "google-play/store/GOOGLE_PLAY_RELEASE.md"];
const packetPath = packetCandidates.find((candidate) => Boolean(readText(args.root, candidate)));
const packet = packetPath ? readText(args.root, packetPath) : undefined;

if (!packet || !packetPath) {
  issues.push(
    issue(
      storeDone ? "error" : "warning",
      "google_play.packet_missing",
      "Android is in scope (platforms/bundle id) but store/GOOGLE_PLAY_RELEASE.md does not exist. " +
        "Plan the Play side early — the personal-account closed-testing gate (12 testers for 14 continuous days) " +
        "can slip a launch date by weeks when discovered late. See knowledge/store/google-play-release.md.",
      "store/GOOGLE_PLAY_RELEASE.md",
    ),
  );
  reportAndExit("Google Play readiness check", issues);
  process.exit();
}

// ── Check 1: Play-specific sections present ─────────────────────────────────

const requiredSections = [
  "Developer Account",
  "Data Safety",
  "Content Rating",
  "Play App Signing",
  "Target API Level",
  "Release Tracks",
  "Closed Testing",
  "Pre-Launch Report",
];

for (const section of requiredSections) {
  if (!includes(packet, section)) {
    issues.push(
      issue(
        storeDone ? "error" : "warning",
        `google_play.section_missing.${section.toLowerCase().replaceAll(" ", "_")}`,
        `${packetPath} is missing the "${section}" section. The Play packet must cover Play's own gates, not mirror the ASC packet.`,
        packetPath,
      ),
    );
  }
}

// ── Check 2: done-status proof floor ────────────────────────────────────────

if (storeDone) {
  if (!includesAny(packet, ["android app bundle", "aab"])) {
    issues.push(
      issue(
        "error",
        "google_play.aab_route_missing",
        `${packetPath} does not record the Android App Bundle (AAB) upload route. New Play apps cannot ship APK-only.`,
        packetPath,
      ),
    );
  }
  if (!includesAny(packet, ["12 testers", "organization account", "org account"])) {
    issues.push(
      issue(
        "error",
        "google_play.closed_testing_gate_unaddressed",
        `${packetPath} does not address the personal-account production gate (12 testers opted in for 14 continuous days) ` +
          "or record that an organization account makes it inapplicable. This gate moves launch dates; it cannot stay implicit.",
        packetPath,
      ),
    );
  }
  if (!includesAny(packet, ["reconcil", "matches ios", "matches the ios"])) {
    issues.push(
      issue(
        "error",
        "google_play.data_safety_reconciliation_missing",
        `${packetPath} does not state that the Data Safety answers are reconciled with the iOS App Privacy labels and the actual SDK/data behavior. ` +
          "Contradictory store privacy answers are a rejection and trust risk.",
        packetPath,
      ),
    );
  }
}

reportAndExit("Google Play readiness check", issues);
