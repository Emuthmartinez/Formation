#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { asArray, asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit } from "./lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;
const relative = "APPLE_SIGNING.md";
const filePath = path.join(args.root, relative);
const text = readText(args.root, relative);

const platforms = state
  ? asArray(getPath(state, "project.platforms"))
      .map((item) => asString(item)?.toLowerCase())
      .filter((item): item is string => Boolean(item))
  : [];
const iosBundleId = state ? asString(getPath(state, "project.bundle_ids.ios")) : undefined;
const hasIos = state ? platforms.includes("ios") || Boolean(iosBundleId?.trim()) : true;
const appleSigningStatus = state ? asString(getPath(state, "lanes.apple_signing.status")) : undefined;
const skipAppleSigning = !hasIos || appleSigningStatus === "not_needed";

if (skipAppleSigning) {
  // Android-only or explicitly not-needed projects do not require Apple signing proof.
} else if (!existsSync(filePath) || !text) {
  issues.push(issue("error", "apple_signing.missing", "APPLE_SIGNING.md is required before TestFlight/App Store readiness is claimed.", relative));
} else {
  const requiredPhrases = [
    "Apple Developer",
    "Team ID",
    "DEVELOPMENT_TEAM",
    "Bundle ID",
    "App ID",
    "App Store Connect",
    "ASC CLI",
    "auth status",
    "App Record Creation Preflight",
    "app creation route",
    "certificate",
    "provisioning",
    "archive",
    "export",
    "upload",
    "TestFlight",
    "founder approval",
    // Pre-archive/export/upload preflight gates (apple-signing-pre-upload-checklist)
    "plutil -lint",
    "authenticationKeyPath",
    "SDK key",
    "preflight",
    "screenshot dimension",
  ];

  for (const phrase of requiredPhrases) {
    if (!text.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push(issue("error", `apple_signing.${phrase.replaceAll(" ", "_").toLowerCase()}.missing`, `APPLE_SIGNING.md should cover ${phrase}.`, relative));
    }
  }

  // The in-app simulator makes a successful run trivially easy to reach, and
  // people describe it in prose ("ran it in the pane and onboarding works")
  // rather than as a "simulator build passed" line — so the trigger has to
  // recognise those phrasings too, or the easiest route evades the guard.
  const simulatorSuccessClaim =
    /simulator build (succeeded|passes|passed)/i.test(text) ||
    /\b(?:ran|run|launched|tested|verified|works?(?:ed)?|working)\b[^.\n]{0,80}\b(?:in|on|through|via)\b[^.\n]{0,40}\b(?:the\s+)?(?:in-app\s+)?(?:iOS\s+)?simulator(?:\s+pane)?\b/i.test(
      text,
    ) ||
    /\b(?:simulator pane|in-app simulator|in-app iOS Simulator|build_run_sim|build-ios-apps)\b/i.test(text);
  if (simulatorSuccessClaim && !/simulator build alone is not|not release proof|distribution readiness/i.test(text)) {
    issues.push(
      issue(
        "error",
        "apple_signing.simulator_only_risk",
        "If simulator build success is mentioned, the doc must explicitly state it is not distribution readiness.",
        relative,
      ),
    );
  }

  const blockerTerms = [
    "Apple Developer",
    "Team ID",
    "DEVELOPMENT_TEAM",
    "Bundle ID",
    "App ID",
    "app record",
    "certificate",
    "provisioning",
    "archive",
    "export",
    "upload",
    "TestFlight",
  ];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^(if|when|before|after)\b/i.test(trimmed)) {
      continue;
    }
    const mentionsGate = blockerTerms.some((term) => trimmed.toLowerCase().includes(term.toLowerCase()));
    const unresolved =
      /\b(missing|unknown|blank|not configured|not set|unavailable|no distribution|no apple developer|no team|no certificate|no provisioning|no app record)\b/i.test(
        trimmed,
      );
    if (mentionsGate && unresolved) {
      issues.push(issue("error", "apple_signing.unresolved_distribution_gate", `Unresolved Apple distribution gate found: "${trimmed}"`, relative));
    }
  }

  // Pre-archive/export/upload preflight sign-off check (apple-signing-pre-upload-checklist theme)
  // If the doc claims archive/upload readiness but has no preflight sign-off block, flag it.
  const claimsArchiveReady = /\b(archive|export|upload|testflight)\b.{0,60}\b(pass|ready|done|complete|verified|uploaded)\b/i.test(text);
  const hasPreflightSignoff =
    /pre-archive.*preflight|preflight.*sign.?off|sdk key.*(pass|blocked)|plutil.*lint.*(pass|ok|blocked)|authenticationkeypath.*(ready|blocked|set)|screenshot dimension.*(pass|blocked)/i.test(
      text,
    );
  if (claimsArchiveReady && !hasPreflightSignoff) {
    issues.push(
      issue(
        "error",
        "apple_signing.preflight_signoff_missing",
        "APPLE_SIGNING.md claims archive/export/upload readiness but has no pre-archive/export/upload preflight sign-off covering SDK key injection, plutil -lint, exportArchive auth flags, and screenshot dimensions.",
        relative,
      ),
    );
  }
}

reportAndExit("Apple signing packet check", issues);
