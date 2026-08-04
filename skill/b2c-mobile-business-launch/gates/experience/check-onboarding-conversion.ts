#!/usr/bin/env node
import { asArray, asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit, type Issue } from "../../scripts/lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues: Issue[] = [...loaded.issues];
const state = loaded.state;

const onboardingStatus = state ? asString(getPath(state, "lanes.onboarding.status"))?.toLowerCase() : undefined;
const onboardingEvidence = asArray(state ? getPath(state, "lanes.onboarding.evidence") : undefined)
  .map((item) => asString(item))
  .filter((item): item is string => Boolean(item?.trim()));

// The one canonical review-term set: the position checks (findReviewIndex)
// and the push/review step-collision check must recognize the same aliases.
const CANONICAL_REVIEW_TERM = /app review|review (popup|prompt)|native review|rating prompt|skstorereviewcontroller|requestreview|google play in-app review/i;

const markdown = firstText(["product/ONBOARDING.md", "onboarding/product/ONBOARDING.md"]);
const onboardingHtml = firstText(["product/onboarding.html", "onboarding/product/onboarding.html"]);
const onboardingDone = onboardingStatus === "done";
const onboardingExpected = onboardingDone || onboardingEvidence.some((item) => /(^|\/)ONBOARDING\.md$/i.test(item));

if (onboardingDone && !markdown) {
  issues.push(
    issue("error", "onboarding.markdown_missing", "product/ONBOARDING.md is required before the onboarding lane can be done.", "product/ONBOARDING.md"),
  );
} else if (onboardingExpected && !markdown) {
  issues.push(
    issue(
      "warning",
      "onboarding.markdown_missing_partial",
      "product/ONBOARDING.md is listed as onboarding evidence but is not present yet.",
      "product/ONBOARDING.md",
    ),
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
  // The not-applicable exemption must be earned: a bare label would let a run
  // silence the email-only lifecycle miss, so the line has to carry a
  // substantive, non-placeholder reason after the declaration.
  // Separators stay on the declaration line ([ \t], not \s): a newline must
  // not let the next line masquerade as the reason.
  const affirmativeOf = (line: string): string =>
    line.replace(/\b(cannot|can not|can't|won't|will not|unable to|unsupported|never|not|don't|do not|no)\b[^.;,—–:()|]*/gi, "");
  const notApplicableMatch = markdown.text.match(/push (?:notifications?|permissions?):?[ \t]*not applicable\b[ \t:;—–,-]*(.*)$/im);
  const NA_PLACEHOLDER = /\b(unverified|tbd|todo|to be filled|pending|placeholder)\b/i;
  const notApplicableReason = (notApplicableMatch?.[1] ?? "").trim();
  const pushLinePattern = /push (notifications? )?(permission|priming|prime)|notification permission/i;
  const pushLines = markdown.text.split(/\r?\n/).filter((line) => pushLinePattern.test(line));
  // The exemption is mutually exclusive with an actual push flow: a document
  // that both declares push not applicable and instructs an ask must stand on
  // the instructions, which the gates below then judge on their own terms.
  const affirmativePushInstruction = pushLines
    .filter((line) => !/not applicable/i.test(line))
    .some((line) =>
      /\b(request|requested|ask|asked|prompt|prime|primed|priming|show|shown|present|presented|display|displayed|opens?|appears?|pops? up|launches?)\b/i.test(
        affirmativeOf(line),
      ),
    );
  // The exemption line itself may smuggle an ask after the reason — the
  // reason's affirmative residue must carry no instruction verbs.
  const reasonCarriesAsk = /\b(request|requested|ask|asked|prompt|show|shown|present|presented|display|displayed|opens?|appears?|pops? up|launches?)\b/i.test(
    affirmativeOf(notApplicableReason),
  );
  const notApplicable =
    Boolean(notApplicableMatch) &&
    notApplicableReason.replace(/[^a-z0-9]/gi, "").length >= 12 &&
    !NA_PLACEHOLDER.test(notApplicableReason) &&
    !reasonCarriesAsk &&
    !affirmativePushInstruction;
  // Mention is not placement: the prime must sit at an earned post-value
  // moment, and a cold ask on launch is the contract violation itself.
  // Polarity is evaluated per clause: negation strips only to the next clause
  // boundary (including dashes and colons), so "not after first value—request
  // on launch" keeps its affirmative cold ask, and "never on launch" keeps its
  // affirmative placement language intact for the placement test.
  // Timing alone is not the prime-first flow: the contract needs an owned
  // soft-prime surface before the system dialog, not a well-timed cold ask.
  const primeEvidence = pushLines.some((line) => /\b(soft[- ]?primes?|pre[- ]?permission|priming|primed?)\b/i.test(affirmativeOf(line)));
  // The native dialog appears only after an affirmative tap on the owned
  // prime surface — an automatic delayed hard ask is still a hard ask.
  // The tap must be an affirmative choice — a dialog that follows the user
  // tapping Decline is a hard ask after a refusal.
  const userInitiated = pushLines.some((line) =>
    /user[- ]initiated|affirmative tap|opt[- ]in tap|from the prime screen|after (the user )?(accepts|agrees|opts[- ]?in)|taps? (yes|allow|enable|accept|continue|turn[- ]?on)/i.test(
      affirmativeOf(line),
    ),
  );
  // An automatically opening dialog is a hard ask regardless of what the
  // user taps afterward — the tap must come first, and "automatic" plus a
  // dialog on one push line is the inverted order.
  const autoDialog = pushLines.some((line) =>
    /automatic\w*[^.;\n]{0,40}\b(dialog|ask|prompt)\b|\b(dialog|ask|prompt)\b[^.;\n]{0,40}automatic\w*/i.test(affirmativeOf(line)),
  );
  const placementOk =
    primeEvidence &&
    userInitiated &&
    !autoDialog &&
    pushLines.some((line) => /after (the )?(first )?value([- ]reveal)?|earned moment|only after value is visible/i.test(affirmativeOf(line)));
  const coldAsk = pushLines.some((line) =>
    /\bcold\b|first launch|on launch|at startup|app start|before (the )?(first )?value([- ]reveal)?/i.test(affirmativeOf(line)),
  );
  // The after-first-value slot belongs to ONE prompt: a push line that pairs
  // itself with the review prompt in the same step is the violation the
  // lifecycle contract names, even when the shared placement is post-value.
  const reviewTermPattern = CANONICAL_REVIEW_TERM;
  const adjacencyPattern =
    /same (session )?(step|screen|moment|dialog)|alongside|back[- ]to[- ]back|together with|immediately (after|before)|right (after|before)|in the same/i;
  const sameLineCollision = pushLines.some((line) => {
    const affirmative = affirmativeOf(line);
    if (!reviewTermPattern.test(affirmative)) return false;
    if (adjacencyPattern.test(affirmative)) return true;
    // A push line that names the review prompt affirmatively without
    // sequencing language (a combined step row like "App Review popup; push
    // permission prime") is the same-step collision itself; only an explicit
    // next-moment ordering escapes.
    return !/next (natural |earned )?(moment|step|session)/i.test(affirmative);
  });
  // Structured contracts assign prompts to numbered steps on separate rows —
  // correlate by step label so a shared step fails without the words
  // "same step" ever appearing on one line.
  const stepOf = (line: string): string | undefined => {
    const affirmative = affirmativeOf(line);
    const numbered = affirmative.match(/step\s*#?\s*(\d+)/i);
    if (numbered) return numbered[1];
    // Table rows carry their step in the first cell — numeric or named. A
    // normalized textual label correlates "Value reveal" rows the same way
    // numbered ones do; structural header words are not labels.
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && !trimmed.includes("---")) {
      const firstCell = (trimmed.split("|")[1] ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      if (firstCell && !/^(step|stage|screen|moment|phase|prompt)s?$/.test(firstCell)) return firstCell;
    }
    return undefined;
  };
  const reviewSteps = markdown.text
    .split(/\r?\n/)
    .filter((line) => !pushLinePattern.test(line) && reviewTermPattern.test(affirmativeOf(line)))
    .map(stepOf)
    .filter((step): step is string => Boolean(step));
  const pushSteps = pushLines.map(stepOf).filter((step): step is string => Boolean(step));
  const sameStepAsReview = sameLineCollision || pushSteps.some((step) => reviewSteps.includes(step));
  if (!notApplicable && sameStepAsReview) {
    issues.push(
      issue(
        "error",
        "onboarding.push_review_same_step",
        "product/ONBOARDING.md places the push permission prime and the App Review popup in the same step. The after-first-value slot goes to one " +
          "prompt — value moment, then review prompt OR push prime; the other waits for the next natural moment (push-notification-lifecycle.md). " +
          "Back-to-back system prompts turn one earned moment into two denials.",
        markdown.relativePath,
      ),
    );
  }
  if (!notApplicable && (pushLines.length === 0 || !placementOk || coldAsk)) {
    issues.push(
      issue(
        "error",
        "onboarding.push_priming_missing",
        "product/ONBOARDING.md does not place the push permission prime at an earned post-value moment (or places it cold on launch), and records " +
          "no push-not-applicable decision with a substantive reason. The soft-prime sits after a first value moment — never cold, never the " +
          "same step as the review popup — per push-notification-lifecycle.md; a raw ask on launch converts most installs into permanent " +
          "opt-outs, and a bare 'not applicable' label without a reason does not earn the exemption.",
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
        "product/ONBOARDING.md must name the first value, value-reveal, personalized plan, demo result, or aha moment before review/paywall timing.",
        filePath,
      ),
    );
  }

  if (review === -1) {
    issues.push(
      issue(
        "error",
        "onboarding.app_review_after_first_value.missing",
        "product/ONBOARDING.md must include the native App Review popup immediately after the first-value/value-reveal step.",
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
    "product/ONBOARDING.md must say the App Review popup appears right after first value, not just somewhere in onboarding.",
    filePath,
  );

  requireAny(
    normalized,
    [/skstorereviewcontroller/, /requestreview/, /storekit/, /google play in-app review/, /reviewmanager/, /native review/],
    "onboarding.native_review_api.missing",
    "product/ONBOARDING.md must name the native platform review API path, such as SKStoreReviewController or Google Play In-App Review.",
    filePath,
  );

  requireAny(
    normalized,
    [/automatic/, /automatically/, /screen mount/, /screen mounts/, /fully displayed/, /visible.{0,80}(1-2|1 to 2|one to two)/],
    "onboarding.review_prompt_mount_timing.missing",
    "product/ONBOARDING.md must specify an automatic trigger after the value screen is mounted and visible, with a short async delay.",
    filePath,
  );

  requireAny(
    normalized,
    [/review_prompt_eligible/],
    "onboarding.review_prompt_eligible_event.missing",
    "product/ONBOARDING.md must include review_prompt_eligible analytics before requesting the native prompt.",
    filePath,
  );

  requireAny(
    normalized,
    [/review_prompt_requested/],
    "onboarding.review_prompt_requested_event.missing",
    "product/ONBOARDING.md must include review_prompt_requested analytics for the native prompt request attempt.",
    filePath,
  );

  requireAny(
    normalized,
    [/cooldown/, /frequency cap/, /rate limit/],
    "onboarding.review_prompt_cooldown.missing",
    "product/ONBOARDING.md must document a cooldown or frequency cap for App Review prompt eligibility.",
    filePath,
  );

  requireAny(
    normalized,
    [/fallback.{0,120}(not show|not shown|does not show|not displayed|suppressed)/, /(may|might|can).{0,80}not show/, /platform.{0,80}not show/],
    "onboarding.review_prompt_fallback.missing",
    "product/ONBOARDING.md must record the fallback path because platforms may choose not to show the review sheet.",
    filePath,
  );

  if (
    /\b(todo|tbd|unknown|placeholder)\b/.test(normalized) &&
    /\b(status:\s*(done|complete|launch-ready)|launch-ready|ready for build|ready for handoff)\b/.test(normalized)
  ) {
    issues.push(
      issue("error", "onboarding.placeholder_complete", "product/ONBOARDING.md cannot claim done/complete while placeholder language remains.", filePath),
    );
  }
}

function validateHtml(text: string, filePath: string): void {
  const normalized = normalize(text);
  if (findReviewIndex(normalized) === -1) {
    issues.push(
      issue(
        "error",
        "product/onboarding.html_app_review_missing",
        "product/onboarding.html must visibly include the App Review popup placeholder in the onboarding flow.",
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
        "product/onboarding.html_app_review_before_first_value",
        "product/onboarding.html shows the review prompt before the first-value screen; move it immediately after first value.",
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
  return findAnyIndex(text, [CANONICAL_REVIEW_TERM]);
}

function findAnyIndex(text: string, patterns: RegExp[]): number {
  const indexes = patterns.map((pattern) => text.search(pattern)).filter((index) => index >= 0);
  return indexes.length > 0 ? Math.min(...indexes) : -1;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}
