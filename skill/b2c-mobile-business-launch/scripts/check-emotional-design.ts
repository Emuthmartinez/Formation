#!/usr/bin/env node
/**
 * check-emotional-design.ts
 *
 * Deterministic gate for the Emotional Experience System lane.
 *
 * Enforces two things at once:
 *   1. The artifact contract — EMOTIONAL_DESIGN.md (+ emotional-design.html, and
 *      EMOTIONAL_AUDIT.md when an audit exists) carry the required sections,
 *      cross-references, and per-card application map.
 *   2. The ethics / dark-pattern guardrail — every applied Experience Card block
 *      declares its bright-line, dark-line, guardrail, measurement event, and
 *      reduced-motion fallback; HIGH-risk mechanisms (variable reward, streak,
 *      scarcity, urgency, social proof) additionally require an ethics
 *      attestation, a user-control escape hatch, a counter-metric, and a
 *      mechanism-specific truthfulness proof. Live artifacts are scanned (outside
 *      card blocks) for fake scarcity, fabricated social proof, confirmshaming,
 *      and commitment-guilt copy.
 *
 * Lane skip: only explicit lanes.emotional_design.status not_needed/deferred
 * skips artifact checks. Missing lanes are errors so migrated and new repos
 * cannot bypass the emotional-design contract accidentally. The ethics phrase
 * scans always run when the artifacts exist.
 *
 * Reference integrity: when references/ethics-guardrail.md (and the
 * experience-cards.md index) resolve next to the root, the §3 risk table must
 * keep one tier per mechanism and the index Risk column must agree with it.
 */

import { asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit, type Issue, type Severity } from "./lib/launch-state.js";
import { existsSync } from "node:fs";
import path from "node:path";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues: Issue[] = [...loaded.issues];
const state = loaded.state;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function includesPhrase(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

function codeFor(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function firstExistingText(candidates: string[]): { relativePath: string; text: string } | undefined {
  for (const candidate of candidates) {
    const text = readText(args.root, candidate);
    if (text) {
      return { relativePath: candidate, text };
    }
  }
  return undefined;
}

function existsAny(candidates: string[]): string | undefined {
  return candidates.find((candidate) => existsSync(path.join(args.root, candidate)));
}

/** Remove fenced code blocks so dark_line examples inside card YAML are not
 * mistaken for live confirmshaming / scarcity copy. */
function stripFencedBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, "");
}

// ---------------------------------------------------------------------------
// Card block parsing
// ---------------------------------------------------------------------------

interface CardBlock {
  filePath: string;
  fields: Map<string, string>;
}

function unquote(value: string): string {
  return value
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

function extractCardBlocks(filePath: string, text: string): CardBlock[] {
  const blocks: CardBlock[] = [];
  const lines = text.split("\n");
  let inBlock = false;
  let blockLines: string[] = [];

  const finish = () => {
    if (inBlock && blockLines.length > 1) {
      blocks.push(parseBlock(filePath, blockLines));
    }
    inBlock = false;
    blockLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine ?? "";
    if (/^experience_card:\s*$/i.test(line.trim())) {
      finish();
      inBlock = true;
      blockLines = [line];
    } else if (inBlock) {
      if (line.trim() === "" || /^```/.test(line.trim()) || /^---\s*$/.test(line.trim())) {
        finish();
      } else {
        blockLines.push(line);
      }
    }
  }
  finish();
  return blocks;
}

function parseBlock(filePath: string, lines: string[]): CardBlock {
  const fields = new Map<string, string>();
  let currentKey = "";
  let currentValue: string[] = [];

  const flush = () => {
    if (currentKey) {
      fields.set(currentKey.trim(), unquote(currentValue.join(" ")));
    }
  };

  for (const line of lines) {
    const match = line.match(/^\s{2}([a-z_]+):\s*(.*)$/);
    if (match) {
      flush();
      currentKey = match[1] ?? "";
      currentValue = [(match[2] ?? "").replace(/^[>|]\s*/, "").trim()];
    } else if (currentKey && /^\s{4,}\S/.test(line)) {
      currentValue.push(line.trim());
    }
  }
  flush();
  return { filePath, fields };
}

// ---------------------------------------------------------------------------
// Mechanism contracts
// ---------------------------------------------------------------------------

const BASE_REQUIRED_FIELDS = ["bright_line", "dark_line", "guardrail"];

// Extra required fields per mechanism (beyond base + posthog_event). HIGH-risk
// mechanisms (variable reward, streak, scarcity, urgency, social proof) each
// require an ethics attestation, a user-control escape hatch, a counter-metric,
// and a mechanism-specific truthfulness proof.
const EXTRA_FIELD_REQUIREMENTS: Record<string, string[]> = {
  variable_reward: ["ethics_attestation", "user_control_escape_hatch", "counter_metric", "reward_variation_proof"],
  streak: ["ethics_attestation", "user_control_escape_hatch", "counter_metric", "streak_recovery_mechanism"],
  streak_loss_aversion: ["ethics_attestation", "user_control_escape_hatch", "counter_metric", "streak_recovery_mechanism"],
  loss_aversion: ["ethics_attestation", "user_control_escape_hatch", "counter_metric", "streak_recovery_mechanism"],
  scarcity: ["ethics_attestation", "counter_metric", "scarcity_enforcement_proof"],
  urgency: ["ethics_attestation", "counter_metric", "scarcity_enforcement_proof"],
  social_proof: ["ethics_attestation", "counter_metric", "social_proof_truthfulness_proof"],
  perceived_effort_delay: ["effort_truthfulness_attestation", "computation_type"],
  intent_mirroring: ["prohibited_surfaces"],
  rating_prompt: ["platform_api_used"],
};

// Cards whose moment animates → must declare a reduced-motion fallback.
const MOTION_MECHANISMS = new Set(["commitment", "variable_reward", "perceived_effort_delay", "intent_mirroring", "peak_end"]);

const COMPUTATION_TYPE_ALLOWLIST = new Set(["real_api_call", "real_data_processing", "ui_composition"]);

function field(block: CardBlock, key: string): string {
  return block.fields.get(key) ?? "";
}

function checkCardBlock(block: CardBlock): void {
  const mechanism = field(block, "mechanism");
  const appliedTo = field(block, "applied_to") || "(unnamed)";
  const where = block.filePath;
  const label = `card "${appliedTo}" [${mechanism || "no-mechanism"}]`;

  if (!mechanism) {
    issues.push(
      issue(
        "error",
        "emotional_design.card_missing_mechanism",
        `Experience card ${appliedTo} in ${where} must declare a "mechanism" (e.g. commitment, variable_reward, perceived_effort_delay, intent_mirroring).`,
        where,
      ),
    );
  }

  for (const f of BASE_REQUIRED_FIELDS) {
    if (field(block, f).length < 10) {
      issues.push(
        issue(
          "error",
          `emotional_design.card_missing_${f}`,
          `${label} in ${where} is missing or has an empty "${f}". Every applied card must declare its bright-line, dark-line, and guardrail.`,
          where,
        ),
      );
    }
  }

  if (field(block, "posthog_event").length < 3) {
    issues.push(
      issue(
        "error",
        "emotional_design.card_missing_posthog_event",
        `${label} in ${where} is missing "posthog_event". Every emotional moment must emit a named PostHog event from ANALYTICS.md.`,
        where,
      ),
    );
  }

  // Reduced-motion fallback for animated cards (in guardrail text or a dedicated field).
  if (MOTION_MECHANISMS.has(mechanism)) {
    const guardrail = field(block, "guardrail");
    const reducedMotion = field(block, "reduced_motion");
    const hasFallback = /reduce[- ]?motion|reduced[- ]motion|prefers-reduced-motion|accessibility/i.test(`${guardrail} ${reducedMotion}`);
    if (!hasFallback) {
      issues.push(
        issue(
          "error",
          "emotional_design.card_missing_reduced_motion",
          `Motion-bearing ${label} in ${where} must declare a prefers-reduced-motion / OS reduce-motion fallback in its "guardrail" or "reduced_motion" field.`,
          where,
        ),
      );
    }
  }

  // HIGH-tier + per-mechanism extra fields.
  const extras = EXTRA_FIELD_REQUIREMENTS[mechanism] ?? [];
  for (const f of extras) {
    if (field(block, f).length < 8) {
      issues.push(
        issue(
          "error",
          `emotional_design.${codeFor(mechanism)}_missing_${f}`,
          `${label} in ${where} requires a non-empty "${f}" field per references/ethics-guardrail.md §Guardrail Contract.`,
          where,
        ),
      );
    }
  }

  // Perceived effort: computation_type allowlist + optional max_delay_ms cap.
  if (mechanism === "perceived_effort_delay") {
    const computation = field(block, "computation_type");
    if (computation && !COMPUTATION_TYPE_ALLOWLIST.has(computation)) {
      issues.push(
        issue(
          "error",
          "emotional_design.perceived_effort_bad_computation_type",
          `${label} in ${where} has computation_type "${computation}". Must be one of: real_api_call, real_data_processing, ui_composition. A sleep timer with no real work is a dark pattern.`,
          where,
        ),
      );
    }
    const maxDelayRaw = field(block, "max_delay_ms");
    if (maxDelayRaw) {
      const maxDelay = Number(maxDelayRaw.replace(/[^0-9]/g, ""));
      const cap = computation === "ui_composition" ? 15000 : 90000;
      if (Number.isFinite(maxDelay) && maxDelay > cap) {
        issues.push(
          issue(
            "error",
            "emotional_design.perceived_effort_delay_too_long",
            `${label} in ${where} sets max_delay_ms=${maxDelay} which exceeds the ${cap}ms cap for computation_type "${computation || "non-ui"}". Inflated waits over real-work duration are user-hostile.`,
            where,
          ),
        );
      }
    }
  }

  // Intent mirroring must be barred from cancel/downgrade flows.
  if (mechanism === "intent_mirroring") {
    const prohibited = field(block, "prohibited_surfaces");
    if (prohibited && !/cancel|downgrade|unsubscribe/i.test(prohibited)) {
      issues.push(
        issue(
          "error",
          "emotional_design.intent_mirror_prohibited_surfaces_weak",
          `${label} in ${where} must list cancel/downgrade/unsubscribe in "prohibited_surfaces" — mirroring intent on retention-friction flows is a dark pattern.`,
          where,
        ),
      );
    }
    if (/free[_ ]?text|verbatim|typed/i.test(field(block, "guardrail") + field(block, "applied_to")) && field(block, "free_text_sanitization").length < 8) {
      issues.push(
        issue(
          "warning",
          "emotional_design.intent_mirror_free_text_unsanitized",
          `${label} in ${where} reflects free-text user input but declares no "free_text_sanitization" approach (trim/truncate, strip markup, allowlist).`,
          where,
        ),
      );
    }
  }

  // Endowed progress must not fabricate the head start (low severity → warning).
  if (mechanism === "endowed_progress" && field(block, "progress_sourcing_attestation").length < 8) {
    issues.push(
      issue(
        "warning",
        "emotional_design.endowed_progress_unsourced",
        `${label} in ${where} should declare "progress_sourcing_attestation" confirming the head start derives from real onboarding input or prior actions, not a marketing constant.`,
        where,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Phrase scans (live copy only — fenced card blocks are stripped first)
// ---------------------------------------------------------------------------

const FAKE_SCARCITY_PATTERNS = [
  /\bonly \d+ (spots?|left|remaining|available)\b/i,
  /\blimited spots?\b/i,
  /\bselling out\b/i,
  /\b\d+ people (are )?viewing\b/i,
  /\boffer expires in \d/i,
];
const FAKE_SOCIAL_PROOF_PATTERNS = [
  /\bjoin \d[\d,]* (users|people|members)\b/i,
  /\bover \d[\d,]* (customers|members|users|downloads)\b/i,
  /\bthousands of (users|people) (just )?(like you|started)\b/i,
];
const CONFIRMSHAMING_PATTERNS = [
  /no thanks,?\s+i (prefer|like|want|don't|won't|wouldn't)\b/i,
  /no,?\s+i (don't|won't|wouldn't|do not) want\b/i,
  /i prefer to (fail|lose|remain|stay)\b/i,
  /i'?ll (stay|remain|keep being|keep|be) (bad|terrible|worse|stuck|behind|unfit|unhealthy)\b/i,
  /i'?d rather (not|stay|remain|fail)\b/i,
];
const COMMITMENT_GUILT_PATTERNS = [
  /you said this (matters|mattered|was important)/i,
  /don'?t let yourself down/i,
  /you committed to\b/i,
  /are you sure you want to (quit|give up|stop|cancel|leave)/i,
  /remember why you started/i,
  /don'?t give up now/i,
];
const SPEND_KEYWORDS = /\b(paywall|purchase|upgrade now|subscribe|buy now|unlock for|renew now|start (your )?(trial|subscription))\b/i;
const REWARD_STREAK_KEYWORDS = /\b(streak|variable reward|reward reveal|reward screen|loss aversion|streak[- ]break)\b/i;

const LOCAL_SCARCITY_PROOF_PATTERN =
  /\b(scarcity_enforcement_proof|backend[- ]enforced|server[- ]enforced|real[- ]time (inventory|capacity|slots?)|database[- ]backed|founder[- ]verified|source:|evidence:|as of \d{4}-\d{2}-\d{2})\b/i;
const LOCAL_SOCIAL_PROOF_PATTERN =
  /\b(social_proof_truthfulness_proof|App Store|Google Play|store data|verified (count|source)|source:|evidence:|as of \d{4}-\d{2}-\d{2})\b|\b(PostHog|analytics)\b.{0,48}\b(count|users|members|downloads|source|verified)\b/i;
const LOCAL_SEPARATION_PROOF_PATTERN =
  /\b(separate (screen|surface|flow|session)|different screen|not (on|shown on|displayed on) the same screen|never on the same screen|one (user )?interaction (later|after|between)|interaction between|after (the user )?(leaves|dismisses|closes|returns)|next session|spend[- ]free)\b/i;
// Compliant copy often states the rule itself ("Never show the paywall inside a streak-break
// grief screen") — but the negation must bind to *placing the spend surface*, clause-locally
// (a semicolon ends the clause), so "Do not animate the streak; show the paywall on the same
// screen" cannot ride an unrelated negation past the veto. Two shapes: negation → placement
// verb → spend object, and spend object → negation → placement verb (passive).
const PROHIBITION_NEGATION = String.raw`(?:never|no|not|do not|don'?t|must not|cannot|may not|won'?t|avoid|without|prohibit(?:s|ed)?|forbidden|ban(?:s|ned)?|block(?:s|ed)?)`;
const PROHIBITION_VERB = String.raw`(?:show(?:s|n|ing)?|display(?:s|ed|ing)?|present(?:s|ed|ing)?|place(?:s|d|ment)?|pair(?:s|ed|ing)?|co-?locate[sd]?|prompt(?:s|ed|ing)?|trigger(?:s|ed|ing)?|surface[sd]?|appear(?:s|ed|ing)?)`;
const PROHIBITION_SPEND = String.raw`(?:spend|paywall|purchase|subscri(?:be|ption)|upgrade|iap|offer(?:ing)?)`;
const LOCAL_PROHIBITION_PATTERN = new RegExp(
  `\\b${PROHIBITION_NEGATION}\\b[^.;\\n]{0,60}?\\b${PROHIBITION_VERB}\\b[^.;\\n]{0,60}?\\b${PROHIBITION_SPEND}\\b` +
    `|\\b${PROHIBITION_SPEND}s?\\b[^.;\\n]{0,60}?\\b${PROHIBITION_NEGATION}\\b[^.;\\n]{0,40}?\\b${PROHIBITION_VERB}\\b`,
  "i",
);

function hasLocalProof(lines: string[], lineIndex: number, proofPattern: RegExp): boolean {
  const start = Math.max(0, lineIndex - 2);
  const end = Math.min(lines.length, lineIndex + 3);
  return proofPattern.test(lines.slice(start, end).join("\n"));
}

function findUnprovenClaim(lines: string[], patterns: RegExp[], proofPattern: RegExp): { pattern: RegExp; line: number } | undefined {
  for (const pattern of patterns) {
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      if (pattern.test(lines[lineIndex] ?? "") && !hasLocalProof(lines, lineIndex, proofPattern)) {
        return { pattern, line: lineIndex + 1 };
      }
    }
  }
  return undefined;
}

function scanLiveCopy(relativePath: string, rawText: string, spendScan: boolean): void {
  const text = stripFencedBlocks(rawText);
  const lines = text.split("\n");

  const unprovenScarcity = findUnprovenClaim(lines, FAKE_SCARCITY_PATTERNS, LOCAL_SCARCITY_PROOF_PATTERN);
  if (unprovenScarcity) {
    issues.push(
      issue(
        "error",
        "emotional_design.fake_scarcity_phrase",
        `${relativePath}:${unprovenScarcity.line} contains scarcity/urgency copy matching /${unprovenScarcity.pattern.source}/ without adjacent real enforcement proof. Back the exact claim with live inventory/capacity evidence or remove it.`,
        relativePath,
      ),
    );
  }

  const unprovenSocialProof = findUnprovenClaim(lines, FAKE_SOCIAL_PROOF_PATTERNS, LOCAL_SOCIAL_PROOF_PATTERN);
  if (unprovenSocialProof) {
    issues.push(
      issue(
        "error",
        "emotional_design.fake_social_proof_phrase",
        `${relativePath}:${unprovenSocialProof.line} contains social-proof copy matching /${unprovenSocialProof.pattern.source}/ without adjacent real source proof. Source the exact count from store data, analytics, or a verified source, or remove it.`,
        relativePath,
      ),
    );
  }

  for (const pattern of CONFIRMSHAMING_PATTERNS) {
    if (pattern.test(text)) {
      issues.push(
        issue(
          "error",
          "emotional_design.confirmshaming_phrase",
          `${relativePath} contains a confirmshaming opt-out label matching /${pattern.source}/. Use a neutral, non-self-deprecating label.`,
          relativePath,
        ),
      );
      break;
    }
  }
  for (const pattern of COMMITMENT_GUILT_PATTERNS) {
    if (pattern.test(text)) {
      issues.push(
        issue(
          "error",
          "emotional_design.commitment_guilt_phrase",
          `${relativePath} contains commitment-guilt copy matching /${pattern.source}/ as live text. Commitment echoes must inform, never shame. Move it into a dark_line example or remove it.`,
          relativePath,
        ),
      );
      break;
    }
  }

  // Spend prompt co-located with a streak/reward moment (ethics-guardrail.md Non-Negotiable
  // Prohibition 4: "spend prompts inside streak-break grief screens"). The prohibition allows
  // no founder override, so co-location is an error unless the surrounding lines state the
  // separation (same trust model as the scarcity/social-proof local-proof escapes).
  if (spendScan) {
    const rewardLines: number[] = [];
    const spendLines: number[] = [];
    lines.forEach((line, index) => {
      if (REWARD_STREAK_KEYWORDS.test(line)) rewardLines.push(index);
      if (SPEND_KEYWORDS.test(line)) spendLines.push(index);
    });
    // Separation proof binds to the pair's own span (plus the line right after, where a
    // trailing "shown on a separate screen" note lands) — a note for one compliant flow
    // must not bless a different dark flow beside it.
    const pairHasSeparationProof = (r: number, s: number): boolean => {
      const lo = Math.min(r, s);
      const hi = Math.max(r, s);
      return LOCAL_SEPARATION_PROOF_PATTERN.test(lines.slice(lo, hi + 2).join("\n"));
    };
    const unprovenPair = rewardLines
      .flatMap((r) => spendLines.map((s) => ({ r, s })))
      .find(
        ({ r, s }) =>
          Math.abs(r - s) <= 4 &&
          !pairHasSeparationProof(r, s) &&
          !LOCAL_PROHIBITION_PATTERN.test(lines[r] ?? "") &&
          !LOCAL_PROHIBITION_PATTERN.test(lines[s] ?? ""),
      );
    if (unprovenPair) {
      issues.push(
        issue(
          "error",
          "emotional_design.spend_prompt_after_reward",
          `${relativePath}:${unprovenPair.s + 1} places a spend prompt (paywall/purchase/subscribe) within a few lines of a streak or reward moment. Spend prompts inside streak-break or reward screens are a non-negotiable dark pattern — move the prompt at least one user interaction away and state the separation next to the copy (e.g. "separate screen, one interaction between").`,
          relativePath,
        ),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const laneStatus = state ? asString(getPath(state, "lanes.emotional_design.status")) : undefined;
const laneAbsent = state ? getPath(state, "lanes.emotional_design") === undefined : true;
const skip = laneStatus === "not_needed" || laneStatus === "deferred";

const design = firstExistingText(["EMOTIONAL_DESIGN.md", "emotional-design/EMOTIONAL_DESIGN.md"]);
const designHtml = existsAny(["emotional-design.html", "emotional-design/emotional-design.html"]);
const audit = firstExistingText(["EMOTIONAL_AUDIT.md", "emotional-design/EMOTIONAL_AUDIT.md"]);

const designBlocks = design ? extractCardBlocks(design.relativePath, design.text) : [];
const auditCardBlocks = audit ? extractCardBlocks(audit.relativePath, audit.text) : [];

if (!skip && laneAbsent) {
  issues.push(
    issue(
      "error",
      "emotional_design.lane_missing",
      "PROJECT_STATE.yaml must include lanes.emotional_design unless the emotional design lane is explicitly not_needed or deferred with founder-approved rationale.",
      "PROJECT_STATE.yaml",
    ),
  );
}

if (!skip && !design) {
  issues.push(
    issue(
      "error",
      "emotional_design.contract_missing",
      "EMOTIONAL_DESIGN.md is required to define the Emotional North Star, target emotional journey, card application map, ethics attestation, and measurement plan.",
      "EMOTIONAL_DESIGN.md",
    ),
  );
}

if (design) {
  const requiredSections = [
    "Emotional North Star",
    "Target Emotional Journey",
    "Card Application Map",
    "Ethics Attestation",
    "Measurement Plan",
    "Integration",
    "Acceptance Checklist",
  ];
  for (const section of requiredSections) {
    if (!includesPhrase(design.text, section)) {
      issues.push(
        issue(
          "error",
          `emotional_design.section_${codeFor(section)}_missing`,
          `EMOTIONAL_DESIGN.md should include the ${section} section.`,
          design.relativePath,
        ),
      );
    }
  }

  for (const ref of ["11_STAR_EXPERIENCE.md", "ANALYTICS.md", "DESIGN.md", "ONBOARDING.md"]) {
    if (!design.text.includes(ref)) {
      issues.push(
        issue(
          "error",
          `emotional_design.ref_${codeFor(ref)}_missing`,
          `EMOTIONAL_DESIGN.md should reference ${ref} so the emotional contract threads the star ladder, analytics catalog, design tokens, and onboarding.`,
          design.relativePath,
        ),
      );
    }
  }

  const blocks = designBlocks;
  if (blocks.length === 0) {
    issues.push(
      issue(
        "error",
        "emotional_design.no_card_blocks",
        "EMOTIONAL_DESIGN.md has no experience_card: attestation blocks. Each applied card needs a machine-checkable block under Ethics Attestation.",
        design.relativePath,
      ),
    );
  }
  const mechanisms = new Set(blocks.map((b) => field(b, "mechanism")));
  for (const required of ["commitment", "variable_reward", "perceived_effort_delay", "intent_mirroring"]) {
    if (!mechanisms.has(required)) {
      issues.push(
        issue(
          "warning",
          `emotional_design.card_${required}_not_applied`,
          `EMOTIONAL_DESIGN.md applies no "${required}" card. The four named cards are the default deck; mark a deferral with a founder-approved rationale if one is intentionally out of scope.`,
          design.relativePath,
        ),
      );
    }
  }
  for (const block of blocks) {
    checkCardBlock(block);
  }

  scanLiveCopy(design.relativePath, design.text, false);

  if (laneStatus === "done" && /\b(TODO|TBD|unknown|placeholder|pending|\[fill)\b/i.test(stripFencedBlocks(design.text))) {
    issues.push(
      issue(
        "error",
        "emotional_design.placeholder_complete",
        "The emotional_design lane cannot be done while TODO/TBD/unknown/placeholder/pending/[fill language remains in EMOTIONAL_DESIGN.md.",
        design.relativePath,
      ),
    );
  }
}

if (!skip && !designHtml) {
  issues.push(
    issue(
      "error",
      "emotional_design.html_missing",
      "emotional-design.html should render the emotional curve and card application map for founder review. A generic design.html proof does not satisfy the emotional design board.",
      "emotional-design.html",
    ),
  );
}

if (designHtml) {
  const htmlText = readText(args.root, designHtml) ?? "";
  for (const phrase of ["Emotional Curve", "Card Application"]) {
    if (!includesPhrase(htmlText, phrase)) {
      issues.push(issue("warning", `emotional_design.html_${codeFor(phrase)}_missing`, `The emotional-design board should render ${phrase}.`, designHtml));
    }
  }
}

// EMOTIONAL_AUDIT.md (auditor deliverable) — checked whenever present.
if (audit) {
  const requiredAuditPhrases = ["Journey Discovery", "Six-Lens Review", "Card Application", "Counter-Metric", "Star Level", "Pathway to Better State"];
  for (const phrase of requiredAuditPhrases) {
    if (!includesPhrase(audit.text, phrase)) {
      issues.push(
        issue(
          "error",
          `emotional_audit.section_${codeFor(phrase)}_missing`,
          `EMOTIONAL_AUDIT.md should include ${phrase} so every journey is enumerated, scored, and given a concrete upgrade path.`,
          audit.relativePath,
        ),
      );
    }
  }
  const auditBlocks = auditCardBlocks;
  const namedCards = ["Commitment Card", "Variable Reward Card", "Perceived Effort Delay Card", "Intent Mirroring Card"];
  const allNamed = namedCards.every((c) => audit.text.includes(c));
  if (auditBlocks.length === 0 && !allNamed) {
    issues.push(
      issue(
        "error",
        "emotional_audit.no_card_mapping",
        "EMOTIONAL_AUDIT.md must map findings to cards: include at least one experience_card: block or reference all four named cards (Commitment Card, Variable Reward Card, Perceived Effort Delay Card, Intent Mirroring Card). Prose-only findings are rejected.",
        audit.relativePath,
      ),
    );
  }
  for (const block of auditBlocks) {
    checkCardBlock(block);
  }
  scanLiveCopy(audit.relativePath, audit.text, false);
}

// Live-copy docs (actual app/store copy) — scan for dark patterns INCLUDING the
// spend-near-reward co-location, which the guardrail names ONBOARDING/SPEC/listing as targets
// for. Deliberately NOT gated on the lane skip: deferring the emotional-design lane skips its
// deliverables, never the non-negotiable ethics veto over copy that already exists.
{
  for (const doc of ["ONBOARDING.md", "SPEC.md", "APP_STORE_LISTING.md", "app-store-listing/APP_STORE_LISTING.md", "PAYWALL.md"]) {
    const liveText = readText(args.root, doc);
    if (liveText) {
      scanLiveCopy(doc, liveText, true);
    }
  }
}

// Children audience check — business.json field plus age-language in scope docs (incl. EMOTIONAL_DESIGN.md).
const ageRange = state ? (asString(getPath(state, "business.audience.age_range")) ?? asString(getPath(state, "audience.age_range"))) : undefined;
const scopeText = [
  ageRange ?? "",
  readText(args.root, "SPEC.md"),
  readText(args.root, "ONBOARDING.md"),
  readText(args.root, "APP_STORE_LISTING.md"),
  design?.text,
]
  .filter(Boolean)
  .join("\n");
// Under-13 is the COPPA hard legal boundary → error. 13-17 (teen) → warning.
const under13 = /\b(under.?1[0-3]|for kids|for children|kids app|children'?s app|coppa|ages? [4-9]\b|ages 1[0-2]\b)\b/i.test(scopeText);
const targetsMinors =
  under13 ||
  /\b(teens?|tweens?|kids|youth|minors?|under.?1[4-8]|under-1[4-8]|ages 1[3-7]|13-17|K-12|high[- ]school|middle[- ]school|family app|parental controls|for teens)\b/i.test(
    scopeText,
  );
if (!skip && design && targetsMinors) {
  const privacy =
    (readText(args.root, "ETHICS.md") ?? "") + (readText(args.root, "PRIVACY.md") ?? "") + (readText(args.root, "PRIVACY_POLICY.md") ?? "") + design.text;
  const reviewed = /COPPA|Children'?s Code|Age-Appropriate Design|AADC|under 13|under-13/i.test(privacy);
  if (!reviewed) {
    const severity: Severity = under13 ? "error" : "warning";
    issues.push(
      issue(
        severity,
        "emotional_design.children_unreviewed",
        `The audience appears to include minors${under13 ? " under 13 (the COPPA hard legal boundary)" : ""}, but no COPPA / UK Age-Appropriate Design Code review is documented. High-risk cards (variable reward, streak) and any beyond-conscious persuasion need a children's-compliance review (and DPIA where required) before ship.`,
        design.relativePath,
      ),
    );
  }
}

// Reference integrity — ethics-guardrail.md must keep its load-bearing sections.
const ethicsRef = readText(path.join(args.root, ".."), "references/ethics-guardrail.md") ?? readText(args.root, "references/ethics-guardrail.md");
if (ethicsRef) {
  for (const section of [
    "Bright-Line Vs Dark-Line Distinction",
    "Regulatory And Platform Landscape",
    "Per-Mechanism Risk Table",
    "Guardrail Contract",
    "Acceptance Checklist",
  ]) {
    if (!includesPhrase(ethicsRef, section)) {
      issues.push(
        issue(
          "error",
          `emotional_design.reference_${codeFor(section)}_missing`,
          `references/ethics-guardrail.md must contain a section with the phrase "${section}".`,
          "references/ethics-guardrail.md",
        ),
      );
    }
  }
}

// Cross-file risk-tier parity — the experience-cards.md index Risk column must agree with
// the ethics-guardrail.md §3 Per-Mechanism Risk Table, and the risk table must not carry two
// explicit rows for one mechanism with different tiers (the 2026-07-28 drift class). Range
// tiers (LOW-MEDIUM) admit any tier inside the range. Cards without a table row (and rows
// with no tier, like the motion-fallback row) are out of parity scope. Skipped entirely when
// the reference files are not present (business repos without vendored references).

const TIER_WORDS = new Set(["LOW", "MEDIUM", "HIGH"]);

function normalizeCardName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\bcards?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTierSet(raw: string): Set<string> | undefined {
  const cleaned = raw.replace(/\*/g, "").replace(/[–—]/g, "-").trim().toUpperCase();
  if (!cleaned) return undefined;
  const parts = cleaned.split(/\s*-\s*/).filter(Boolean);
  if (parts.length === 0 || parts.some((part) => !TIER_WORDS.has(part))) return undefined;
  return new Set(parts);
}

function tierKey(tiers: Set<string>): string {
  return [...tiers].sort().join("-");
}

/** A placeholder tier ("—") is legitimate ONLY on the motion-fallback row — callers must pair
 * this with a motion-row name check; anywhere else an unparseable cell is a typo the gate must
 * not skip. */
function isTierPlaceholder(raw: string): boolean {
  const cleaned = raw.replace(/[*`]/g, "").replace(/[–—]/g, "-").trim();
  return cleaned === "" || /^-+$/.test(cleaned) || /^n\/?a$/i.test(cleaned);
}

interface TableRow {
  name: string;
  tierRaw: string;
}

function parseTableRows(text: string, headerPattern: RegExp, nameCell: number, tierCell: number): TableRow[] {
  const rows: TableRow[] = [];
  let inTable = false;
  for (const line of text.split("\n")) {
    if (!inTable) {
      if (headerPattern.test(line)) inTable = true;
      continue;
    }
    const trimmed = line.trim();
    // Only the next section heading ends the scan — a blank or prose interruption
    // mid-table must not silently drop the rows below it from the parity gate.
    if (trimmed.startsWith("#")) break;
    if (!trimmed.startsWith("|")) continue;
    if (/^\|[\s|:-]+\|?$/.test(trimmed)) continue;
    const cells = line.split("|").map((cell) => cell.trim());
    const name = cells[nameCell] ?? "";
    if (name) rows.push({ name, tierRaw: cells[tierCell] ?? "" });
  }
  return rows;
}

function nameMatches(indexName: string, tableName: string): boolean {
  return indexName === tableName || indexName.startsWith(`${tableName} `) || tableName.startsWith(`${indexName} `);
}

const cardsIndexRef = readText(path.join(args.root, ".."), "references/experience-cards.md") ?? readText(args.root, "references/experience-cards.md");

if (ethicsRef) {
  const riskRows = parseTableRows(ethicsRef, /^\|\s*Mechanism\s*\|\s*Risk Tier\s*\|/i, 1, 2);
  if (riskRows.length === 0 && includesPhrase(ethicsRef, "Per-Mechanism Risk Table")) {
    issues.push(
      issue(
        "error",
        "emotional_design.risk_table_unparsed",
        "references/ethics-guardrail.md §3 declares a Per-Mechanism Risk Table but no `| Mechanism | Risk Tier |` rows parse — the risk-tier parity gate has gone blind.",
        "references/ethics-guardrail.md",
      ),
    );
  }

  // Explicit rows assign one tier per mechanism; bucket rows ("All other deck cards (A, B)")
  // constrain a named list with a shared (often range) tier.
  const explicitTiers = new Map<string, { tierRaw: string; tiers: Set<string> }>();
  const bucketTiers = new Map<string, Set<string>>();
  for (const row of riskRows) {
    const tiers = parseTierSet(row.tierRaw);
    if (!tiers) {
      // Only the motion-fallback row may carry a placeholder tier; a canonical mechanism
      // with "—" or a typo would silently vanish from parity.
      if (!(isTierPlaceholder(row.tierRaw) && /motion/i.test(row.name))) {
        issues.push(
          issue(
            "error",
            "emotional_design.risk_tier_unrecognized",
            `references/ethics-guardrail.md §3 tier "${row.tierRaw}" for "${row.name}" is not LOW/MEDIUM/HIGH or a LOW-MEDIUM range (a placeholder tier is allowed only on the motion-fallback row). Fix the cell — otherwise the parity gate silently skips this mechanism.`,
            "references/ethics-guardrail.md",
          ),
        );
      }
      continue;
    }
    const bucket = row.name.match(/^all other deck cards\s*\(([^)]*)\)/i);
    if (bucket) {
      for (const member of (bucket[1] ?? "").split(",")) {
        const key = normalizeCardName(member);
        if (!key) continue;
        const existingBucket = bucketTiers.get(key);
        if (existingBucket && tierKey(existingBucket) !== tierKey(tiers)) {
          issues.push(
            issue(
              "error",
              "emotional_design.risk_tier_conflict",
              `references/ethics-guardrail.md §3 assigns "${member.trim()}" disagreeing tiers across two bucket rows. One tier per mechanism.`,
              "references/ethics-guardrail.md",
            ),
          );
        } else if (!existingBucket) {
          bucketTiers.set(key, tiers);
        }
      }
      continue;
    }
    const key = normalizeCardName(row.name);
    const existing = explicitTiers.get(key);
    if (existing && tierKey(existing.tiers) !== tierKey(tiers)) {
      issues.push(
        issue(
          "error",
          "emotional_design.risk_tier_conflict",
          `references/ethics-guardrail.md §3 lists "${row.name}" twice with disagreeing risk tiers (${existing.tierRaw} vs ${row.tierRaw}). Dedupe to a single row with one tier.`,
          "references/ethics-guardrail.md",
        ),
      );
    } else if (existing) {
      issues.push(
        issue(
          "error",
          "emotional_design.risk_tier_duplicate_row",
          `references/ethics-guardrail.md §3 lists "${row.name}" twice (both ${row.tierRaw}). Duplicate rows are how tier drift starts — merge into a single row.`,
          "references/ethics-guardrail.md",
        ),
      );
    } else {
      explicitTiers.set(key, { tierRaw: row.tierRaw, tiers });
    }
  }

  // An explicit row may narrow a bucket range (Rating Prompt MEDIUM inside LOW-MEDIUM) but
  // must not contradict it — order-independent, so checked after the full table is read.
  for (const [bucketKey, bucketSet] of bucketTiers) {
    const explicit = [...explicitTiers.entries()].find(([tableKey]) => nameMatches(bucketKey, tableKey))?.[1];
    if (explicit && ![...explicit.tiers].every((tier) => bucketSet.has(tier))) {
      issues.push(
        issue(
          "error",
          "emotional_design.risk_tier_conflict",
          `references/ethics-guardrail.md §3 tiers "${bucketKey}" ${explicit.tierRaw} in its explicit row but ${[...bucketSet].sort().join("-")} in a bucket row. One tier per mechanism.`,
          "references/ethics-guardrail.md",
        ),
      );
    }
  }

  if (cardsIndexRef) {
    const indexRows = parseTableRows(cardsIndexRef, /^\|\s*Card\s*\|\s*Load when\s*\|\s*Risk\s*\|/i, 1, 3);
    if (indexRows.length === 0) {
      issues.push(
        issue(
          "error",
          "emotional_design.card_index_unparsed",
          "references/experience-cards.md exists but no `| Card | Load when | Risk |` routing rows parse — the risk-tier parity gate has gone blind.",
          "references/experience-cards.md",
        ),
      );
    }
    for (const row of indexRows) {
      const indexTiers = parseTierSet(row.tierRaw);
      if (!indexTiers) {
        // The index routes real cards only — no row there may plead a placeholder tier.
        issues.push(
          issue(
            "error",
            "emotional_design.risk_tier_unrecognized",
            `references/experience-cards.md Risk cell "${row.tierRaw}" for "${row.name}" is not LOW/MEDIUM/HIGH or a LOW-MEDIUM range. Fix the cell — otherwise the parity gate silently skips this card.`,
            "references/experience-cards.md",
          ),
        );
        continue;
      }
      const key = normalizeCardName(row.name);
      const explicit = [...explicitTiers.entries()].find(([tableKey]) => nameMatches(key, tableKey))?.[1];
      const allowed = explicit?.tiers ?? [...bucketTiers.entries()].find(([tableKey]) => nameMatches(key, tableKey))?.[1];
      if (allowed && ![...indexTiers].every((tier) => allowed.has(tier))) {
        issues.push(
          issue(
            "error",
            "emotional_design.risk_tier_mismatch",
            `references/experience-cards.md routes "${row.name}" as ${row.tierRaw} but references/ethics-guardrail.md §3 tiers it ${explicit?.tierRaw ?? [...allowed].join("-")}. The guardrail table is canonical — make both files agree.`,
            "references/experience-cards.md",
          ),
        );
      }
    }
  }
}

reportAndExit("Emotional Experience System check", issues);
