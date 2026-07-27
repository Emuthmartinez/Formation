#!/usr/bin/env node
import { asArray, asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit, type Issue } from "./lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues: Issue[] = [...loaded.issues];
const state = loaded.state;

const onboardingStatus = state ? asString(getPath(state, "lanes.onboarding.status"))?.toLowerCase() : undefined;
const onboardingEvidence = asArray(state ? getPath(state, "lanes.onboarding.evidence") : undefined)
  .map((item) => asString(item))
  .filter((item): item is string => Boolean(item?.trim()));

const markdown = firstText(["ONBOARDING.md", "onboarding/ONBOARDING.md"]);
const onboardingHtml = firstText(["onboarding.html", "onboarding/onboarding.html"]);
const onboardingDone = onboardingStatus === "done";
const onboardingExpected = onboardingDone || onboardingEvidence.some((item) => /(^|\/)ONBOARDING\.md$/i.test(item));

if (onboardingDone && !markdown) {
  issues.push(issue("error", "onboarding.markdown_missing", "ONBOARDING.md is required before the onboarding lane can be done.", "ONBOARDING.md"));
} else if (onboardingExpected && !markdown) {
  issues.push(
    issue("warning", "onboarding.markdown_missing_partial", "ONBOARDING.md is listed as onboarding evidence but is not present yet.", "ONBOARDING.md"),
  );
}

if (markdown) {
  validateMarkdown(markdown.text, markdown.relativePath);
}

if (onboardingHtml) {
  validateHtml(onboardingHtml.text, onboardingHtml.relativePath);
}

// Push permission priming (push-notification-lifecycle.md): a done onboarding
// contract either places the primed push ask at an earned moment or records
// push as not applicable with a reason — a full email lifecycle with no push
// strategy is the low-open-channel default the audit found.
if (onboardingDone && markdown) {
  const notApplicable = /push notifications?:? not applicable/i.test(markdown.text);
  const pushLines = markdown.text.split(/\r?\n/).filter((line) => /push (permission|priming|prime)|notification permission/i.test(line));
  // Mention is not placement: the prime must sit at an earned post-value
  // moment, and a cold ask on launch is the contract violation itself.
  const placementOk = pushLines.some((line) => /after (the )?first value|earned moment|value[- ]reveal|value is visible/i.test(line));
  const coldAsk = pushLines.some((line) => /\bcold\b|first launch|on launch|at startup|app start/i.test(line));
  if (!notApplicable && (pushLines.length === 0 || !placementOk || coldAsk)) {
    issues.push(
      issue(
        "error",
        "onboarding.push_priming_missing",
        "ONBOARDING.md does not place the push permission prime at an earned post-value moment (or places it cold on launch), and records " +
          "no push-not-applicable decision. The soft-prime sits after a first value moment — never cold, never the same step as the review " +
          "popup — per push-notification-lifecycle.md; a raw ask on launch converts most installs into permanent opt-outs.",
        markdown.relativePath,
      ),
    );
  }
}

reportAndExit("Onboarding conversion check", issues);

function firstText(candidates: string[]): { relativePath: string; text: string } | undefined {
  for (const candidate of candidates) {
    const text = readText(args.root, candidate);
    if (text) {
      return { relativePath: candidate, text };
    }
  }
  return undefined;
}

function validateMarkdown(text: string, filePath: string): void {
  const normalized = normalize(text);
  const firstValue = findFirstValueIndex(normalized);
  const review = findReviewIndex(normalized);

  if (firstValue === -1) {
    issues.push(
      issue(
        "error",
        "onboarding.first_value_missing",
        "ONBOARDING.md must name the first value, value-reveal, personalized plan, demo result, or aha moment before review/paywall timing.",
        filePath,
      ),
    );
  }

  if (review === -1) {
    issues.push(
      issue(
        "error",
        "onboarding.app_review_after_first_value.missing",
        "ONBOARDING.md must include the native App Review popup immediately after the first-value/value-reveal step.",
        filePath,
      ),
    );
  }

  if (firstValue !== -1 && review !== -1 && review < firstValue) {
    issues.push(
      issue(
        "error",
        "onboarding.app_review_before_first_value",
        "The App Review prompt is documented before the first-value moment; move it immediately after first value is visible.",
        filePath,
      ),
    );
  }

  requireAny(
    normalized,
    [
      /right after (the )?(first value|first-value|value reveal|value-reveal|personalized plan|plan reveal|aha moment|first win|demo result)/,
      /immediately after (the )?(first value|first-value|value reveal|value-reveal|personalized plan|plan reveal|aha moment|first win|demo result)/,
      /after (the )?(first value|first-value|value reveal|value-reveal|personalized plan|plan reveal|aha moment|first win|demo result).{0,160}(app review|review prompt|native review|rating prompt)/,
      /(app review|review prompt|native review|rating prompt).{0,160}after (the )?(first value|first-value|value reveal|value-reveal|personalized plan|plan reveal|aha moment|first win|demo result)/,
    ],
    "onboarding.app_review_after_first_value.position_missing",
    "ONBOARDING.md must say the App Review popup appears right after first value, not just somewhere in onboarding.",
    filePath,
  );

  requireAny(
    normalized,
    [/skstorereviewcontroller/, /requestreview/, /storekit/, /google play in-app review/, /reviewmanager/, /native review/],
    "onboarding.native_review_api.missing",
    "ONBOARDING.md must name the native platform review API path, such as SKStoreReviewController or Google Play In-App Review.",
    filePath,
  );

  requireAny(
    normalized,
    [/automatic/, /automatically/, /screen mount/, /screen mounts/, /fully displayed/, /visible.{0,80}(1-2|1 to 2|one to two)/],
    "onboarding.review_prompt_mount_timing.missing",
    "ONBOARDING.md must specify an automatic trigger after the value screen is mounted and visible, with a short async delay.",
    filePath,
  );

  requireAny(
    normalized,
    [/review_prompt_eligible/],
    "onboarding.review_prompt_eligible_event.missing",
    "ONBOARDING.md must include review_prompt_eligible analytics before requesting the native prompt.",
    filePath,
  );

  requireAny(
    normalized,
    [/review_prompt_requested/],
    "onboarding.review_prompt_requested_event.missing",
    "ONBOARDING.md must include review_prompt_requested analytics for the native prompt request attempt.",
    filePath,
  );

  requireAny(
    normalized,
    [/cooldown/, /frequency cap/, /rate limit/],
    "onboarding.review_prompt_cooldown.missing",
    "ONBOARDING.md must document a cooldown or frequency cap for App Review prompt eligibility.",
    filePath,
  );

  requireAny(
    normalized,
    [/fallback.{0,120}(not show|not shown|does not show|not displayed|suppressed)/, /(may|might|can).{0,80}not show/, /platform.{0,80}not show/],
    "onboarding.review_prompt_fallback.missing",
    "ONBOARDING.md must record the fallback path because platforms may choose not to show the review sheet.",
    filePath,
  );

  if (
    /\b(todo|tbd|unknown|placeholder)\b/.test(normalized) &&
    /\b(status:\s*(done|complete|launch-ready)|launch-ready|ready for build|ready for handoff)\b/.test(normalized)
  ) {
    issues.push(issue("error", "onboarding.placeholder_complete", "ONBOARDING.md cannot claim done/complete while placeholder language remains.", filePath));
  }
}

function validateHtml(text: string, filePath: string): void {
  const normalized = normalize(text);
  if (findReviewIndex(normalized) === -1) {
    issues.push(
      issue(
        "error",
        "onboarding.html_app_review_missing",
        "onboarding.html must visibly include the App Review popup placeholder in the onboarding flow.",
        filePath,
      ),
    );
  }

  const firstValue = findFirstValueIndex(normalized);
  const review = findReviewIndex(normalized);
  if (firstValue !== -1 && review !== -1 && review < firstValue) {
    issues.push(
      issue(
        "error",
        "onboarding.html_app_review_before_first_value",
        "onboarding.html shows the review prompt before the first-value screen; move it immediately after first value.",
        filePath,
      ),
    );
  }
}

function requireAny(text: string, patterns: RegExp[], code: string, message: string, filePath: string): void {
  if (!patterns.some((pattern) => pattern.test(text))) {
    issues.push(issue("error", code, message, filePath));
  }
}

function findFirstValueIndex(text: string): number {
  return findAnyIndex(text, [
    /first value/,
    /first-value/,
    /value reveal/,
    /value-reveal/,
    /personalized plan/,
    /plan reveal/,
    /aha moment/,
    /first win/,
    /demo result/,
  ]);
}

function findReviewIndex(text: string): number {
  return findAnyIndex(text, [
    /app review/,
    /review prompt/,
    /native review/,
    /rating prompt/,
    /skstorereviewcontroller/,
    /requestreview/,
    /google play in-app review/,
  ]);
}

function findAnyIndex(text: string, patterns: RegExp[]): number {
  const indexes = patterns.map((pattern) => text.search(pattern)).filter((index) => index >= 0);
  return indexes.length > 0 ? Math.min(...indexes) : -1;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}
