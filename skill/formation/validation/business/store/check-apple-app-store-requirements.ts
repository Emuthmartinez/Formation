#!/usr/bin/env node
import path from "node:path";
import {
  asArray,
  asString,
  collectAllFiles,
  getPath,
  issue,
  loadProjectState,
  missingPhraseCode,
  normalizedIncludes,
  parseCliArgs,
  readText,
  reportAndExit,
} from "../../../tooling/lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const requireSigningReady = process.argv.slice(2).includes("--require-signing-ready");
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;
const relative = "store/APPLE_APP_STORE_REQUIREMENTS.md";
const text = readText(args.root, relative);
const signingRelative = "store/APPLE_SIGNING.md";
const signingText = readText(args.root, signingRelative);

function statusForLane(name: string): string | undefined {
  return state ? asString(getPath(state, `lanes.${name}.status`))?.toLowerCase() : undefined;
}

function statusLineClaimsReady(markdown: string): boolean {
  return markdown
    .split(/\r?\n/)
    .some((line) => /^\s*(status|asc status|submission status)\s*:/i.test(line) && /\b(done|complete|completed|ready|verified|approved)\b/i.test(line));
}

function findPrivacyManifests(): string[] {
  return collectAllFiles(args.root)
    .filter((file) => path.basename(file) === "PrivacyInfo.xcprivacy")
    .map((file) => path.relative(args.root, file));
}

function checkPrivacyManifestContent(relativePath: string): void {
  const manifest = readText(args.root, relativePath);
  if (!manifest) {
    return;
  }

  // Detect JSON brace format — Apple requires plist format; JSON braces cause parse errors on upload
  const trimmed = manifest.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    issues.push(
      issue(
        "error",
        "apple_requirements.privacy_manifest_json_format",
        "PrivacyInfo.xcprivacy appears to be JSON (starts with { or [) rather than an Apple property list. Apple requires plist format. Running `plutil -lint` on this file will fail with a parse error. Rewrite as a plist and verify with `plutil -lint` before archiving.",
        relativePath,
      ),
    );
    return; // Skip further key checks on invalid format
  }

  const expectedKeys = ["NSPrivacyCollectedDataTypes", "NSPrivacyAccessedAPITypes", "NSPrivacyTracking"];
  const presentKeys = expectedKeys.filter((key) => normalizedIncludes(manifest, key));
  if (presentKeys.length === 0) {
    issues.push(
      issue(
        "error",
        "apple_requirements.privacy_manifest_keys_missing",
        "PrivacyInfo.xcprivacy exists but does not declare collected data, accessed API types, or tracking posture.",
        relativePath,
      ),
    );
  }

  // Detect empty NSPrivacyAccessedAPITypes array when UserDefaults is likely in use
  // (The array being present but empty is a common mistake that Apple catches on upload)
  const emptyAccessedApiTypes =
    /<key>NSPrivacyAccessedAPITypes<\/key>\s*<array\s*\/>/i.test(manifest) || /<key>NSPrivacyAccessedAPITypes<\/key>\s*<array>\s*<\/array>/i.test(manifest);
  if (emptyAccessedApiTypes) {
    issues.push(
      issue(
        "warning",
        "apple_requirements.privacy_manifest_accessed_api_types_empty",
        "NSPrivacyAccessedAPITypes in PrivacyInfo.xcprivacy is declared but empty. Confirm the app genuinely uses no required-reason APIs — apps using UserDefaults, file timestamps, system boot time, or disk space must declare reasons here or Apple flags an upload warning/rejection. Audit required-reason API usage; populate the array if any are used.",
        relativePath,
      ),
    );
  }
}

function checkUnresolvedLines(markdown: string): void {
  const gateTerms = [
    "PrivacyInfo.xcprivacy",
    "NSPrivacyCollectedDataTypes",
    "NSPrivacyAccessedAPITypes",
    "NSPrivacyAccessedAPITypeReasons",
    "NSPrivacyTracking",
    "NSPrivacyTrackingDomains",
    "required reason API",
    "third-party SDK",
    "SDK signatures",
    "Xcode privacy report",
    "Privacy Policy URL",
    "Privacy Choices URL",
    "protected resources",
    "UsageDescription",
    "Info.plist",
    "NSUserTrackingUsageDescription",
    "App Tracking Transparency",
    "account deletion",
    "review notes",
    "archive",
    "upload",
  ];

  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^(if|when|before|after)\b/i.test(trimmed)) {
      continue;
    }
    const mentionsGate = gateTerms.some((term) => normalizedIncludes(trimmed, term));
    const unresolved = /\b(TODO|TBD|unknown|missing|not configured|not set|placeholder|fill in|to fill|pending|blocked|N\/A)\b/i.test(trimmed);
    if (mentionsGate && unresolved) {
      issues.push(
        issue("error", "apple_requirements.placeholder_or_unknown", `Apple App Store requirements packet contains unresolved state: "${trimmed}"`, relative),
      );
    }
  }
}

function hasUnresolvedTemplateState(markdown: string): boolean {
  return /\{\{[^{}\r\n]+\}\}/.test(markdown) || /^\s*Status\s*:\s*(?:scaffold|draft|template)\s*$/im.test(markdown);
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function currentIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function hasUnresolvedEvidence(value: string): boolean {
  return /\b(?:blocked|TBD|pending|unknown|missing|not configured|not set|placeholder|fill in|to fill|N\/A)\b/i.test(value);
}

function normalizedTableKey(value: string): string {
  return value.replaceAll("`", "").trim().toLowerCase();
}

function isResolvedIdentityValue(value: string): boolean {
  return Boolean(value.trim()) && !hasUnresolvedEvidence(value) && !hasUnresolvedTemplateState(value);
}

function checkResolvedAppleSignOff(markdown: string): void {
  if (hasUnresolvedTemplateState(markdown)) {
    issues.push(
      issue(
        "error",
        "apple_requirements.signing_unresolved_template",
        "A ready Apple submission cannot use scaffold status or unresolved {{...}} values in store/APPLE_SIGNING.md.",
        signingRelative,
      ),
    );
  }

  const signOffMatch = /Pre-archive sign-off\s*\(recorded\s+(\d{4}-\d{2}-\d{2})\)\s*:/i.exec(markdown);
  const signOffDate = signOffMatch?.[1];
  if (!signOffDate || !isValidIsoDate(signOffDate)) {
    issues.push(
      issue(
        "error",
        "apple_requirements.signing_date_missing",
        "A ready Apple submission needs an ISO-dated pre-archive sign-off in store/APPLE_SIGNING.md (YYYY-MM-DD).",
        signingRelative,
      ),
    );
  } else if (signOffDate < currentIsoDate()) {
    issues.push(
      issue(
        "error",
        "apple_requirements.signing_date_stale",
        "The Apple pre-archive sign-off is stale. Refresh Apple's live requirements and record the sign-off on the archive date.",
        signingRelative,
      ),
    );
  } else if (signOffDate > currentIsoDate()) {
    issues.push(
      issue(
        "error",
        "apple_requirements.signing_date_future",
        "The Apple pre-archive sign-off date is in the future and cannot prove checks performed for the current archive.",
        signingRelative,
      ),
    );
  }

  const checks = [
    ["Live Apple release sources", "Xcode/SDK compatibility"],
    ["Intended Release bundle ID", "version", "build", "App Store Connect"],
    ["plutil -lint", "PrivacyInfo.xcprivacy"],
    ["NSPrivacyAccessedAPITypes", "actual API usage"],
    ["exportArchive", "authenticationKeyPath", "authenticationKeyID", "authenticationKeyIssuerID"],
    ["Screenshot dimension floor", "no upscaling"],
    ["New compiled archive", "Info.plist identity", "SDK keys"],
  ];
  const lines = markdown.split(/\r?\n/);
  const preArchiveHeadingIndex = lines.findIndex((line) => /Pre-archive sign-off\s*\(recorded\s+\d{4}-\d{2}-\d{2}\)\s*:/i.test(line));
  const postArchiveHeadingIndex = lines.findIndex((line) => /Post-archive sign-off\s*\(recorded before export\/upload\)\s*:/i.test(line));
  if (postArchiveHeadingIndex === -1) {
    issues.push(
      issue(
        "error",
        "apple_requirements.post_archive_signing_heading_missing",
        "A ready Apple submission needs a post-archive sign-off recorded before export/upload in store/APPLE_SIGNING.md.",
        signingRelative,
      ),
    );
  }
  const itemSevenIndex = lines.findIndex((line) => /^\s*7\.\s+/.test(line));
  const postArchiveEvidenceIndex = lines.findIndex((line) => /^\s*Archive evidence\s*:/i.test(line));
  const postArchiveEvidenceLine = postArchiveEvidenceIndex === -1 ? "" : (lines[postArchiveEvidenceIndex] ?? "");
  const postArchiveEvidenceMatch =
    /Archive evidence\s*:\s*path=([^;\r\n]+\.xcarchive)\s*;\s*created_at=(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s*;\s*Info\.plist SHA-256=([a-f\d]{64})\s*$/i.exec(
      postArchiveEvidenceLine,
    );
  const archivePath = postArchiveEvidenceMatch?.[1]?.trim();
  const archiveTimestamp = postArchiveEvidenceMatch?.[2];
  const archiveInfoPlistSha = postArchiveEvidenceMatch?.[3]?.toLowerCase();
  const parsedArchiveTimestamp = archiveTimestamp ? new Date(archiveTimestamp) : undefined;
  const archiveEvidenceIsCurrent =
    Boolean(parsedArchiveTimestamp && !Number.isNaN(parsedArchiveTimestamp.getTime())) && archiveTimestamp?.slice(0, 10) === currentIsoDate();
  const archiveEvidenceIsPositioned =
    postArchiveHeadingIndex !== -1 && postArchiveEvidenceIndex > postArchiveHeadingIndex && itemSevenIndex > postArchiveEvidenceIndex;
  if (!archivePath || !archiveInfoPlistSha || !archiveEvidenceIsCurrent || !archiveEvidenceIsPositioned) {
    issues.push(
      issue(
        "error",
        "apple_requirements.post_archive_evidence_invalid",
        "Post-archive sign-off needs a same-day ISO timestamp, an .xcarchive path, and a 64-hex Info.plist SHA-256 before item 7.",
        signingRelative,
      ),
    );
  }
  const itemSevenLine = itemSevenIndex === -1 ? "" : (lines[itemSevenIndex] ?? "");
  const itemSevenEvidenceMatch = /archive path=([^;\r\n]+\.xcarchive)\s*;\s*Info\.plist SHA-256=([a-f\d]{64})\s*:\s*(?:pass|ready|ok)\.?\s*$/i.exec(
    itemSevenLine,
  );
  const itemSevenArchivePath = itemSevenEvidenceMatch?.[1]?.trim();
  const itemSevenInfoPlistSha = itemSevenEvidenceMatch?.[2]?.toLowerCase();
  if (!archivePath || !archiveInfoPlistSha || itemSevenArchivePath !== archivePath || itemSevenInfoPlistSha !== archiveInfoPlistSha) {
    issues.push(
      issue(
        "error",
        "apple_requirements.post_archive_evidence_mismatch",
        "Apple signing item 7 must repeat the exact archive path and Info.plist SHA-256 from the post-archive evidence record.",
        signingRelative,
      ),
    );
  }
  const signingStatus = lines.find((line) => /^\s*Status\s*:/i.test(line));
  if (!signingStatus || hasUnresolvedEvidence(signingStatus) || !/\b(?:done|complete|completed|ready|verified|approved)\b/i.test(signingStatus)) {
    issues.push(
      issue(
        "error",
        "apple_requirements.signing_status_unresolved",
        "A ready Apple submission needs a resolved ready, complete, verified, or approved status in store/APPLE_SIGNING.md.",
        signingRelative,
      ),
    );
  }

  const detailedEvidence = [
    { terms: ["upcoming-requirements"], dated: true },
    { terms: ["app-store/submitting"], dated: true },
    { terms: ["xcode/system-requirements"], dated: true },
    { terms: ["manage-builds/upload-builds"], dated: true },
  ];

  detailedEvidence.forEach(({ terms, dated }, index) => {
    const row = lines.find((line) => /^\s*\|/.test(line) && terms.every((term) => normalizedIncludes(line, term)));
    const cells = row
      ?.split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const result = cells?.at(-1) ?? "";
    const hasCurrentDate = !dated || Boolean(signOffDate && cells?.includes(signOffDate) && signOffDate === currentIsoDate());
    if (!row || !cells || cells.some(hasUnresolvedEvidence) || !hasCurrentDate || !/^(?:pass|ready|ok|verified|matched)\.?$/i.test(result)) {
      issues.push(
        issue(
          "error",
          `apple_requirements.signing_detail_${index + 1}_unresolved`,
          `Apple signing detail row ${index + 1} needs current, resolved evidence and a passing result in store/APPLE_SIGNING.md.`,
          signingRelative,
        ),
      );
    }
  });

  const tableRows = lines
    .filter((line) => /^\s*\|/.test(line))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
  const identitySpecs = [
    { key: "CFBundleIdentifier", code: "bundle_id", validateFormat: (_value: string) => true },
    {
      key: "CFBundleShortVersionString",
      code: "version",
      validateFormat: (value: string) => /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(value),
    },
    { key: "CFBundleVersion", code: "build", validateFormat: (value: string) => /^\d+(?:\.\d+){0,2}$/.test(value) },
  ];

  identitySpecs.forEach(({ key, code, validateFormat }) => {
    const cells = tableRows.find((row) => normalizedTableKey(row[0] ?? "") === key.toLowerCase());
    const intended = cells?.[1] ?? "";
    const compiled = cells?.[2] ?? "";
    const appStoreConnect = cells?.[3] ?? "";
    const result = cells?.[4] ?? "";
    const values = [intended, compiled, appStoreConnect];
    const valuesResolved = values.every(isResolvedIdentityValue);
    const valuesMatch = valuesResolved && compiled === intended && appStoreConnect === intended;
    const resultResolved = /^(?:pass|ready|ok|verified|matched|unique)\.?$/i.test(result) && !hasUnresolvedEvidence(result);
    if (!cells || cells.length !== 5 || !valuesMatch || !validateFormat(intended) || !resultResolved) {
      issues.push(
        issue(
          "error",
          `apple_requirements.signing_identity_${code}_invalid`,
          `${key} must have matching, resolved intended, compiled archive, and App Store Connect values plus a valid result in store/APPLE_SIGNING.md.`,
          signingRelative,
        ),
      );
    }
  });

  checks.forEach((requiredTerms, index) => {
    const itemNumber = index + 1;
    const lineIndex = lines.findIndex((candidate) => new RegExp(`^\\s*${itemNumber}\\.\\s+`).test(candidate));
    const line = lineIndex === -1 ? undefined : lines[lineIndex];
    const hasRequiredTerms = Boolean(line && requiredTerms.every((term) => normalizedIncludes(line, term)));
    const hasResolvedResult = Boolean(line && /:\s*(?:pass|ready|ok)\.?\s*$/i.test(line));
    const isInRequiredStage =
      itemNumber <= 6
        ? preArchiveHeadingIndex !== -1 && postArchiveHeadingIndex !== -1 && lineIndex > preArchiveHeadingIndex && lineIndex < postArchiveHeadingIndex
        : postArchiveHeadingIndex !== -1 && lineIndex > postArchiveHeadingIndex;
    if (!line || !hasRequiredTerms || !hasResolvedResult || !isInRequiredStage || hasUnresolvedTemplateState(line) || hasUnresolvedEvidence(line)) {
      issues.push(
        issue(
          "error",
          `apple_requirements.signing_check_${itemNumber}_unresolved`,
          `Apple pre-archive check ${itemNumber} needs resolved evidence and a terminal pass, ready, or ok result in store/APPLE_SIGNING.md.`,
          signingRelative,
        ),
      );
    }
  });
}

const platforms = state
  ? asArray(getPath(state, "project.platforms"))
      .map((item) => asString(item)?.toLowerCase())
      .filter((item): item is string => Boolean(item))
  : [];
const iosBundleId = state ? asString(getPath(state, "project.bundle_ids.ios")) : undefined;
const hasIos = state ? platforms.includes("ios") || Boolean(iosBundleId?.trim()) : true;
const storeStatus = statusForLane("store_console");
const appleSigningStatus = statusForLane("apple_signing");
const appleRequirementsSkipped = !hasIos || storeStatus === "not_needed" || appleSigningStatus === "not_needed";
const readyClaim = Boolean(text && (statusLineClaimsReady(text) || storeStatus === "done" || appleSigningStatus === "done"));

if (appleRequirementsSkipped) {
  // Android-only or explicitly out-of-scope Apple distribution paths do not require this packet.
} else if (!text) {
  issues.push(
    issue(
      "error",
      "apple_requirements.missing",
      "store/APPLE_APP_STORE_REQUIREMENTS.md is required before an iOS app is pushed to App Store Connect.",
      relative,
    ),
  );
} else {
  const requiredPhrases = [
    "Source Basis",
    "Adding a privacy manifest",
    "Privacy Manifest",
    "PrivacyInfo.xcprivacy",
    "NSPrivacyCollectedDataTypes",
    "NSPrivacyAccessedAPITypes",
    "NSPrivacyAccessedAPITypeReasons",
    "required reason API",
    "NSPrivacyTracking",
    "NSPrivacyTrackingDomains",
    "third-party SDK",
    "SDK signatures",
    "Xcode privacy report",
    "App Privacy",
    "Privacy Nutrition Labels",
    "Privacy Policy URL",
    "Privacy Choices URL",
    "protected resources",
    "UsageDescription",
    "Info.plist",
    "NSUserTrackingUsageDescription",
    "App Tracking Transparency",
    "account deletion",
    "review notes",
    "archive",
    "upload",
    "delivery warnings",
    "App Store Connect",
    "store/APPLE_SIGNING.md",
    "APP_STORE_LISTING.md",
    "store/STORE_CONSOLE.md",
    "trust/PRIVACY.md",
    "trust/SECURITY.md",
    "founder approval",
  ];

  for (const phrase of requiredPhrases) {
    if (!normalizedIncludes(text, phrase)) {
      issues.push(issue("error", missingPhraseCode("apple_requirements", phrase), `store/APPLE_APP_STORE_REQUIREMENTS.md should include ${phrase}.`, relative));
    }
  }

  if (readyClaim || requireSigningReady) {
    const signingReleasePhrases = [
      "Live Apple Release Baseline",
      "upcoming-requirements",
      "xcodebuild -version",
      "xcodebuild -showsdks",
      "Version And Build Identity",
      "CFBundleIdentifier",
      "CFBundleShortVersionString",
      "CFBundleVersion",
      "App Store Connect",
      "leading zeroes",
      "compiled archive",
    ];

    if (!signingText) {
      issues.push(issue("error", "apple_requirements.signing_packet_missing", "A ready Apple submission needs store/APPLE_SIGNING.md.", signingRelative));
    } else {
      for (const phrase of signingReleasePhrases) {
        if (!normalizedIncludes(signingText, phrase)) {
          issues.push(
            issue(
              "error",
              missingPhraseCode("apple_release_baseline", phrase),
              `store/APPLE_SIGNING.md should include ${phrase} before release readiness is claimed.`,
              signingRelative,
            ),
          );
        }
      }
      checkResolvedAppleSignOff(signingText);
    }

    checkUnresolvedLines(text);
    if (hasUnresolvedTemplateState(text)) {
      issues.push(
        issue(
          "error",
          "apple_requirements.requirements_unresolved_template",
          "A ready Apple submission cannot use scaffold status or unresolved {{...}} values in store/APPLE_APP_STORE_REQUIREMENTS.md.",
          relative,
        ),
      );
    }
    const privacyManifests = findPrivacyManifests();
    if (privacyManifests.length === 0) {
      issues.push(
        issue(
          "error",
          "apple_requirements.privacy_manifest_file_missing",
          "A ready Apple submission needs an actual PrivacyInfo.xcprivacy file in the app bundle source tree.",
          relative,
        ),
      );
    }
    for (const privacyManifest of privacyManifests) {
      checkPrivacyManifestContent(privacyManifest);
    }
  }
}

reportAndExit("Apple App Store requirements check", issues);
