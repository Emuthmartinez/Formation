#!/usr/bin/env node
/**
 * check:motion-contract — deterministic consistency gate for the motion craft
 * contract (premium-mobile-craft.md two-family spring canon + motion-craft-benchmarks.md
 * recipes) against the shipped token sources (design-system/tokens.json,
 * business/design/system/PremiumCraft.swift) and the experience-card canon files.
 *
 * This is the machine-checkable half of the motion acceptance contract. It cannot
 * inspect a generated app's UI code (that adherence is covered behaviorally by the
 * motion-craft-prose-never-applied LaunchBench scenario); what it CAN do is make the
 * contract itself undriftable: every numeric band, token value, and preset the two
 * references state must agree with the files that ship those numbers, and every motion
 * name any reference or template cites (DesignTokens.Motion members, motion.* tokens,
 * --motion-* CSS variables) must resolve to a shipped definition. The celebrate-band
 * blocker the 2026-07-26 pre-PR review caught by hand (a band that excluded a canon
 * card's own values) is exactly the class of failure this gate automates.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flagString, issue, parseFlags, reportAndExit, type Issue } from "../../../tooling/lib/launch-state.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "../../..");

function parseArgs(argv: string[]): { skillRoot: string } {
  const flags = parseFlags(argv, [{ flags: ["--skill-root", "--root"], key: "skillRoot" }]);
  return { skillRoot: flagString(flags, "skillRoot") ?? defaultSkillRoot };
}

const { skillRoot } = parseArgs(process.argv.slice(2));

/** Regex capture groups are typed string|undefined under noUncheckedIndexedAccess; every use below is a group the pattern guarantees. */
const g = (m: RegExpMatchArray, i: number): string => m[i] ?? "";
const issues: Issue[] = [];

const BENCH = "knowledge/design/motion-craft-benchmarks.md";
const CRAFT = "knowledge/design/premium-mobile-craft.md";
const TOKENS = "studio/generated/system/tokens.json";
const SWIFT = "workspace/business/design/system/PremiumCraft.swift";
const SWIFT_TOKENS = "studio/generated/system/DesignTokens.swift";
const TEMPLATE_TOKENS = "workspace/business/design/system/tokens.json";
const TEMPLATE_SWIFT_TOKENS = "workspace/business/design/system/DesignTokens.swift";
const CANON_CARDS = [
  "knowledge/experience/experience-cards/peak-end-card.md",
  "knowledge/experience/experience-cards/mastery-and-status-card.md",
  "knowledge/experience/experience-cards/variable-reward-card.md",
];

function read(rel: string): string | undefined {
  const full = path.join(skillRoot, rel);
  if (!existsSync(full)) {
    issues.push(issue("error", "motion_contract.file_missing", `${rel} is missing; the motion contract cannot be checked without it.`, rel));
    return undefined;
  }
  return readFileSync(full, "utf8");
}

const bench = read(BENCH);
const craft = read(CRAFT);
const tokensRaw = read(TOKENS);
const swift = read(SWIFT);
const swiftTokens = read(SWIFT_TOKENS);
const templateTokensRaw = read(TEMPLATE_TOKENS);
const templateSwiftTokens = read(TEMPLATE_SWIFT_TOKENS);

// PremiumCraft.swift ships from business/design/system/ next to its own copies of the
// token artifacts; a generated app compiles against THOSE, not the top-level pair. The
// two copies must agree on every motion value or the doc-side checks are checking the
// wrong binary truth.
if (tokensRaw !== undefined && templateTokensRaw !== undefined) {
  try {
    const top = JSON.parse(tokensRaw) as { tokens?: { motion?: unknown }; motion?: unknown };
    const tpl = JSON.parse(templateTokensRaw) as { tokens?: { motion?: unknown }; motion?: unknown };
    const topMotion = JSON.stringify(top.tokens?.motion ?? top.motion ?? null);
    const tplMotion = JSON.stringify(tpl.tokens?.motion ?? tpl.motion ?? null);
    if (topMotion !== tplMotion) {
      issues.push(
        issue(
          "error",
          "motion_contract.template_tokens.drift",
          "business/design/system/tokens.json motion block differs from design-system/tokens.json — the copy shipped beside PremiumCraft.swift is the one apps compile against.",
          TEMPLATE_TOKENS,
        ),
      );
    }
  } catch {
    issues.push(issue("error", "motion_contract.template_tokens.invalid_json", "business/design/system/tokens.json failed to parse.", TEMPLATE_TOKENS));
  }
}
if (swiftTokens !== undefined && templateSwiftTokens !== undefined) {
  const motionOf = (text: string): string => {
    const m = text.match(/enum Motion \{([\s\S]*?)\n {2}\}/);
    return m ? (m[1] ?? "") : "";
  };
  if (motionOf(swiftTokens).trim() !== motionOf(templateSwiftTokens).trim()) {
    issues.push(
      issue(
        "error",
        "motion_contract.template_tokens.drift",
        "business/design/system/DesignTokens.swift Motion enum differs from design-system/DesignTokens.swift — the copy shipped beside PremiumCraft.swift is the one apps compile against.",
        TEMPLATE_SWIFT_TOKENS,
      ),
    );
  }
}

/** Numeric members of the shipped DesignTokens.Motion enum, for resolving symbolic spring responses. */
const swiftMotionMembers = new Map<string, number>();
if (swiftTokens !== undefined) {
  const motionEnum = swiftTokens.match(/enum Motion \{([\s\S]*?)\n {2}\}/);
  const enumBody = motionEnum ? (motionEnum[1] ?? "") : "";
  for (const m of enumBody.matchAll(/static let (\w+): Double = (\d+(?:\.\d+)?)\n/g)) {
    swiftMotionMembers.set(g(m, 1), Number(g(m, 2)));
  }
  for (const m of enumBody.matchAll(/static let (\w+): Double = ([^\n]+)/g)) {
    if (!swiftMotionMembers.has(g(m, 1))) {
      issues.push(
        issue(
          "error",
          "motion_contract.swift_tokens.member_malformed",
          `DesignTokens.Motion.${g(m, 1)} declares a Double that does not parse as a valid decimal (${g(m, 2).trim()}) — the enum would not compile.`,
          SWIFT_TOKENS,
        ),
      );
    }
  }
  if (swiftMotionMembers.size === 0) {
    issues.push(
      issue(
        "error",
        "motion_contract.swift_tokens.motion_unparseable",
        "No numeric DesignTokens.Motion members could be parsed from DesignTokens.swift.",
        SWIFT_TOKENS,
      ),
    );
  }
}

let motionTokens: Record<string, string> = {};
if (tokensRaw !== undefined) {
  try {
    const parsed = JSON.parse(tokensRaw) as Record<string, unknown>;
    const tokens = (parsed.tokens ?? parsed) as Record<string, unknown>;
    const motion = tokens.motion;
    if (motion && typeof motion === "object") {
      motionTokens = Object.fromEntries(Object.entries(motion as Record<string, unknown>).map(([k, v]) => [k, String(v)]));
    } else {
      issues.push(issue("error", "motion_contract.tokens.motion_missing", "tokens.json has no motion token block.", TOKENS));
    }
  } catch (error) {
    issues.push(issue("error", "motion_contract.tokens.invalid_json", `tokens.json failed to parse: ${String(error)}`, TOKENS));
  }
}

/** PremiumMotion presets parsed from PremiumCraft.swift: name -> { durationMember, bounce }. */
const swiftPresets = new Map<string, { durationMember: string; bounce: number }>();
if (swift !== undefined) {
  const presetRe = /static let (\w+) = Animation\.spring\(\s*duration: DesignTokens\.Motion\.(\w+),\s*bounce: ([\d.]+)\s*\)/g;
  for (const m of swift.matchAll(presetRe)) {
    swiftPresets.set(g(m, 1), { durationMember: g(m, 2), bounce: Number(g(m, 3)) });
  }
  if (swiftPresets.size === 0) {
    issues.push(
      issue("error", "motion_contract.swift.presets_unparseable", "No PremiumMotion Animation.spring presets could be parsed from PremiumCraft.swift.", SWIFT),
    );
  }
}

// --- 1. The benchmarks token table must match tokens.json values exactly. ---
if (bench !== undefined) {
  const rowRe = /^\|\s*`(\w+)`\s*\|\s*(\d+)ms\s*\|([^|]*)\|/gm;
  const REQUIRED_ROWS = ["durationFast", "durationBase", "durationSlow", "durationCelebrate", "durationReveal", "durationCinematic", "stagger"];
  const seenRows: string[] = [];
  for (const m of bench.matchAll(rowRe)) {
    const name = g(m, 1);
    seenRows.push(name);
    const ms = g(m, 2);
    const presetCell = g(m, 3);
    const actual = motionTokens[name];
    if (actual === undefined) {
      issues.push(
        issue("error", "motion_contract.token_row.unknown_token", `Benchmarks token table names motion.${name}, which does not exist in tokens.json.`, BENCH),
      );
    } else if (actual !== `${ms}ms`) {
      issues.push(
        issue("error", "motion_contract.token_row.value_drift", `Benchmarks token table says motion.${name} = ${ms}ms but tokens.json ships ${actual}.`, BENCH),
      );
    }
    // Every numeric row must also exist in and match the Swift enum, preset or not —
    // durationReveal/durationCinematic/stagger have no PremiumMotion mapping but
    // apps still compile against their Swift members, and a member deleted from the
    // enum breaks that compile even while doc/JSON parity stays green.
    if (swiftMotionMembers.size > 0 && !swiftMotionMembers.has(name)) {
      issues.push(
        issue(
          "error",
          "motion_contract.token_row.swift_member_missing",
          `Benchmarks token table documents motion.${name} but DesignTokens.Motion defines no numeric ${name} member — code referencing it will not compile.`,
          BENCH,
        ),
      );
    } else if (swiftMotionMembers.has(name) && Math.round((swiftMotionMembers.get(name) ?? 0) * 1000) !== Number(ms)) {
      issues.push(
        issue(
          "error",
          "motion_contract.token_row.swift_value_drift",
          `Benchmarks token table says motion.${name} = ${ms}ms but DesignTokens.Motion.${name} ships ${(swiftMotionMembers.get(name) ?? 0) * 1000}ms.`,
          BENCH,
        ),
      );
    }
    // Validate EVERY preset annotation in the cell, not just the first — a
    // two-preset row (durationCelebrate) must keep both presets synchronized,
    // and an un-annotated mention must fail rather than ride along unchecked.
    const presetRefs = [...presetCell.matchAll(/PremiumMotion\.(\w+)`?\s*\(bounce ([\d.]+)\)/g)];
    const presetMentions = (presetCell.match(/PremiumMotion\./g) ?? []).length;
    if (presetMentions > presetRefs.length) {
      issues.push(
        issue(
          "error",
          "motion_contract.preset.annotation_missing",
          `Benchmarks token table row for motion.${name} names a PremiumMotion preset without its (bounce N) annotation; the stated bounce is what the gate keeps synchronized.`,
          BENCH,
        ),
      );
    }
    for (const presetRef of presetRefs) {
      const preset = swiftPresets.get(g(presetRef, 1));
      if (!preset) {
        issues.push(
          issue(
            "error",
            "motion_contract.preset.unknown",
            `Benchmarks token table cites PremiumMotion.${g(presetRef, 1)}, which is not a parsed PremiumCraft.swift preset.`,
            BENCH,
          ),
        );
      } else if (preset.durationMember !== name) {
        issues.push(
          issue(
            "error",
            "motion_contract.preset.duration_mismatch",
            `Benchmarks token table maps PremiumMotion.${g(presetRef, 1)} to motion.${name} but PremiumCraft.swift rides DesignTokens.Motion.${preset.durationMember}.`,
            BENCH,
          ),
        );
      } else if (preset.bounce !== Number(g(presetRef, 2))) {
        issues.push(
          issue(
            "error",
            "motion_contract.preset.bounce_drift",
            `Benchmarks token table says PremiumMotion.${g(presetRef, 1)} bounce ${g(presetRef, 2)} but PremiumCraft.swift ships ${preset.bounce}.`,
            BENCH,
          ),
        );
      }
    }
  }
  for (const required of REQUIRED_ROWS) {
    if (!seenRows.includes(required)) {
      issues.push(
        issue(
          "error",
          "motion_contract.token_table.row_missing",
          `Benchmarks token table lost its motion.${required} row; the mapping must stay complete.`,
          BENCH,
        ),
      );
    }
  }
  for (const dup of seenRows.filter((name, i) => seenRows.indexOf(name) !== i)) {
    issues.push(
      issue(
        "error",
        "motion_contract.token_table.duplicate_row",
        `Benchmarks token table lists motion.${dup} more than once; duplicates can mask omissions.`,
        BENCH,
      ),
    );
  }

  // Every motion.<name> reference in the benchmarks must resolve to a shipped token.
  for (const m of bench.matchAll(/`motion\.([^`]+)`/g)) {
    // `motion.*` is the namespace label (table header prose), not a token reference.
    if (g(m, 1) === "*") continue;
    if (!Object.hasOwn(motionTokens, g(m, 1))) {
      issues.push(
        issue("error", "motion_contract.token_reference.unknown", `Benchmarks reference motion.${g(m, 1)}, which does not exist in tokens.json.`, BENCH),
      );
    }
  }
}

// --- 2. Every PremiumMotion.<name> mention in both references must be a real preset. ---
for (const [rel, text] of [
  [BENCH, bench],
  [CRAFT, craft],
] as const) {
  if (text === undefined || swift === undefined) continue;
  for (const m of text.matchAll(/PremiumMotion\.([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*)/g)) {
    if (!swiftPresets.has(g(m, 1))) {
      issues.push(
        issue("error", "motion_contract.premium_motion.unknown", `${rel} references PremiumMotion.${g(m, 1)}, which PremiumCraft.swift does not define.`, rel),
      );
    }
  }
}

// --- 3. The two-family spring table, its benchmarks mirror, and the card canon must agree. ---
interface Band {
  respLo: number;
  respHi: number;
  dampLo: number;
  dampHi: number;
}
const bands = new Map<string, Band>();
if (craft !== undefined) {
  const familyRe =
    /\|\s*\*\*(press|celebrate)\*\*\s*\|\s*response\s+(\d+(?:\.\d+)?)[–-](\d+(?:\.\d+)?),\s*dampingFraction\s+(\d+(?:\.\d+)?)[–-](\d+(?:\.\d+)?)/g;
  for (const m of craft.matchAll(familyRe)) {
    const family = g(m, 1);
    if (bands.has(family)) {
      issues.push(
        issue(
          "error",
          "motion_contract.family_table.duplicate",
          `premium-mobile-craft.md's spring table states the ${family} family more than once; two incompatible canons could coexist silently.`,
          CRAFT,
        ),
      );
      continue;
    }
    bands.set(family, { respLo: Number(g(m, 2)), respHi: Number(g(m, 3)), dampLo: Number(g(m, 4)), dampHi: Number(g(m, 5)) });
  }
  for (const family of ["press", "celebrate"]) {
    const band = bands.get(family);
    if (!band) {
      issues.push(
        issue("error", "motion_contract.family_table.missing", `premium-mobile-craft.md's spring table has no parseable ${family} family row.`, CRAFT),
      );
      continue;
    }
    if (band.respLo > band.respHi || band.dampLo > band.dampHi) {
      issues.push(
        issue(
          "error",
          "motion_contract.family_table.inverted_range",
          `premium-mobile-craft.md's ${family} family states an inverted range (response ${band.respLo}-${band.respHi}, damping ${band.dampLo}-${band.dampHi}) — an empty valid range gates nothing.`,
          CRAFT,
        ),
      );
    }
  }
}

if (bench !== undefined && bands.has("press") && bands.has("celebrate")) {
  const mirrorRe =
    /press \(response (\d+(?:\.\d+)?)[–-](\d+(?:\.\d+)?) \/ damping (\d+(?:\.\d+)?)[–-](\d+(?:\.\d+)?)\) and celebrate \(response (\d+(?:\.\d+)?)[–-](\d+(?:\.\d+)?) \/ damping (\d+(?:\.\d+)?)[–-](\d+(?:\.\d+)?)\)/;
  const mirrors = [...bench.matchAll(new RegExp(mirrorRe, "g"))];
  if (mirrors.length > 1) {
    issues.push(
      issue(
        "error",
        "motion_contract.family_mirror.duplicate",
        `Benchmarks state the spring-family mirror ${mirrors.length} times; a stale second statement could publish an incompatible canon.`,
        BENCH,
      ),
    );
  }
  const m = mirrors[0];
  if (!m) {
    issues.push(
      issue("error", "motion_contract.family_mirror.missing", "Benchmarks no longer state the two spring families in the expected mirror form.", BENCH),
    );
  } else {
    const press = bands.get("press");
    const celebrate = bands.get("celebrate");
    if (!press || !celebrate) throw new Error("unreachable: bands checked above");
    const stated: Array<[number, number, string]> = [
      [Number(g(m, 1)), press.respLo, "press response low"],
      [Number(g(m, 2)), press.respHi, "press response high"],
      [Number(g(m, 3)), press.dampLo, "press damping low"],
      [Number(g(m, 4)), press.dampHi, "press damping high"],
      [Number(g(m, 5)), celebrate.respLo, "celebrate response low"],
      [Number(g(m, 6)), celebrate.respHi, "celebrate response high"],
      [Number(g(m, 7)), celebrate.dampLo, "celebrate damping low"],
      [Number(g(m, 8)), celebrate.dampHi, "celebrate damping high"],
    ];
    for (const [got, want, label] of stated) {
      if (got !== want) {
        issues.push(
          issue(
            "error",
            "motion_contract.family_mirror.drift",
            `Benchmarks mirror states ${label} = ${got} but premium-mobile-craft.md's table says ${want}.`,
            BENCH,
          ),
        );
      }
    }
  }
}

const celebrateBand = bands.get("celebrate");
if (celebrateBand) {
  const celebrate = celebrateBand;
  for (const rel of CANON_CARDS) {
    const text = read(rel);
    if (text === undefined) continue;
    const NUM = "\\d+(?:\\.\\d+)?";
    const springs = [
      ...text.matchAll(
        new RegExp(`\\.spring\\(\\s*response:\\s*(${NUM}|DesignTokens\\.Motion\\.[A-Za-z0-9_]+)\\s*,\\s*dampingFraction:\\s*(${NUM})\\s*\\)`, "g"),
      ),
    ];
    const springSites = (text.match(/\.spring\(\s*response:/g) ?? []).length;
    if (springSites > springs.length) {
      issues.push(
        issue(
          "error",
          "motion_contract.canon.spring_malformed",
          `${rel} contains ${springSites - springs.length} .spring(response:...) recipe(s) that do not parse as valid numeric or DesignTokens.Motion springs — a malformed literal like 0..5 would not compile.`,
          rel,
        ),
      );
    }
    if (springs.length === 0) {
      issues.push(
        issue("error", "motion_contract.canon.spring_missing", `${rel} no longer contains a parseable .spring(response:dampingFraction:) canon value.`, rel),
      );
      continue;
    }
    for (const s of springs) {
      // A symbolic response must resolve to a real numeric member of the shipped
      // DesignTokens.Motion enum — a name the enum does not define would not even
      // compile in the card's SwiftUI snippet, so it can never be treated as in-band.
      let response: number;
      const rawResponse = g(s, 1);
      if (rawResponse.startsWith("DesignTokens.Motion.")) {
        const member = rawResponse.slice("DesignTokens.Motion.".length);
        const resolved = swiftMotionMembers.get(member);
        if (resolved === undefined) {
          issues.push(
            issue(
              "error",
              "motion_contract.canon.symbol_unresolvable",
              `${rel} ships a canon spring response ${rawResponse}, but DesignTokens.Motion defines no numeric ${member} member — the snippet would not compile.`,
              rel,
            ),
          );
          continue;
        }
        response = resolved;
      } else {
        response = Number(rawResponse);
      }
      const damping = Number(g(s, 2));
      if (Number.isFinite(response) && (response < celebrate.respLo || response > celebrate.respHi)) {
        issues.push(
          issue(
            "error",
            "motion_contract.canon.outside_band",
            `${rel} ships a celebrate-canon spring response ${response} outside the stated family band ${celebrate.respLo}–${celebrate.respHi}.`,
            rel,
          ),
        );
      }
      if (damping < celebrate.dampLo || damping > celebrate.dampHi) {
        issues.push(
          issue(
            "error",
            "motion_contract.canon.outside_band",
            `${rel} ships a celebrate-canon dampingFraction ${damping} outside the stated family band ${celebrate.dampLo}–${celebrate.dampHi}.`,
            rel,
          ),
        );
      }
    }
  }
}

// --- 4. The cinematic token stays out of the in-app doctrine and rides only web/brand routes. ---
if (craft !== undefined && craft.includes("durationCinematic")) {
  issues.push(
    issue(
      "error",
      "motion_contract.cinematic.in_craft_doctrine",
      "premium-mobile-craft.md (in-app doctrine) references durationCinematic; the mobile binary keeps to the 120-360ms band.",
      CRAFT,
    ),
  );
}
if (bench !== undefined) {
  for (const line of bench.split("\n")) {
    if (line.includes("durationCinematic") && !/web|brand|landing/i.test(line)) {
      issues.push(
        issue(
          "error",
          "motion_contract.cinematic.unrouted",
          `Benchmarks line mentions durationCinematic without routing it to the web/brand lane: "${line.trim().slice(0, 120)}"`,
          BENCH,
        ),
      );
    }
  }
}

// --- 5. Motion vocabulary must resolve to shipped names on every guidance surface. ---
// The 2026-07-27 sweep retired a phantom vocabulary (motion.brief/moderate/expressive/
// deliberate token names, DesignTokens.Motion.spring/stepFadeDuration-style members,
// --motion-brief-style CSS variables) that the canon checks above cannot see: prose
// references outside .spring(response:) forms compile nowhere, so they drifted silently.
// Every DesignTokens.Motion member, backticked motion.<name> token, and --motion-<name>
// CSS variable cited by reference or template markdown must exist in the shipped
// sources. Files are scanned when present so partial fixture trees stay valid.
const swiftMotionMemberNames = new Set<string>(swiftMotionMembers.keys());
if (swiftTokens !== undefined) {
  const motionEnum = swiftTokens.match(/enum Motion \{([\s\S]*?)\n {2}\}/);
  // String members (easing/easingEmphasis/easingSpring) are valid reference targets
  // even though only numeric members can carry a spring response.
  for (const m of (motionEnum ? (motionEnum[1] ?? "") : "").matchAll(/static let (\w+) = "/g)) {
    swiftMotionMemberNames.add(g(m, 1));
  }
}
// Mirrors the cssName column promote-design-tokens.ts mints (check:token-promotion
// proves the promoted artifacts agree with it). Promotion is the only pipeline that
// creates --motion-* names, so a reference outside this set resolves to nothing.
const PROMOTED_MOTION_CSS_VARS = new Set([
  "--motion-duration-fast",
  "--motion-duration-base",
  "--motion-duration-slow",
  "--motion-duration-celebrate",
  "--motion-duration-reduced",
  "--motion-easing",
  "--motion-duration-reveal",
  "--motion-duration-cinematic",
  "--motion-easing-emphasis",
  "--motion-easing-spring",
  "--motion-stagger",
]);
// The retired card vocabulary stays hard-banned by name: these are the aliases the
// 2026-07-27 sweep removed (the benchmarks table's "Retired card alias" column), and
// they are the one class of lowercase word that must never read as a component name.
const RETIRED_MOTION_ALIASES = new Set(["brief", "moderate", "expressive", "deliberate"]);
/**
 * Validate one motion.<name> occurrence found inside code (inline span or fenced block).
 * Tokens resolve against tokens.json. A first segment that is a pure-lowercase word and
 * not a shipped token is a component namespace, not a token: motion/react exposes every
 * intrinsic element as motion.<tag> (motion.div, motion.article, motion.nav, ...), and
 * motion.dev / motion.css ride the same prefix — a shape rule covers them all without
 * enumerating a partial HTML tag list. Shipped lowercase tokens (easing, stagger) resolve
 * before the shape rule, and the retired aliases are banned before it, so token-shaped
 * names (any uppercase or punctuation in the first segment) and alias reintroductions
 * still fail. Residual: a brand-new all-lowercase phantom word reads as a component
 * namespace — acceptable because the shipped naming convention is camelCase and any
 * lowercase token added to tokens.json resolves before this rule.
 */
function checkMotionTokenName(rel: string, name: string): void {
  if (Object.hasOwn(motionTokens, name)) return;
  const firstSegment = name.split(".")[0] ?? "";
  if (!RETIRED_MOTION_ALIASES.has(firstSegment) && /^[a-z][a-z0-9]*$/.test(firstSegment) && !Object.hasOwn(motionTokens, firstSegment)) {
    return;
  }
  issues.push(issue("error", "motion_contract.vocabulary.token_unknown", `${rel} references motion.${name}, which does not exist in tokens.json.`, rel));
}
const mdFilesUnder = (relDir: string): string[] => {
  const fullDir = path.join(skillRoot, relDir);
  if (!existsSync(fullDir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(fullDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = `${relDir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...mdFilesUnder(rel));
    else if (entry.name.endsWith(".md")) found.push(rel);
  }
  return found;
};
for (const rel of [...mdFilesUnder("playbook"), ...mdFilesUnder("business")]) {
  const text = readFileSync(path.join(skillRoot, rel), "utf8");
  if (swiftMotionMemberNames.size > 0) {
    for (const m of text.matchAll(/DesignTokens\.Motion\.([A-Za-z0-9_]+)/g)) {
      if (!swiftMotionMemberNames.has(g(m, 1))) {
        issues.push(
          issue(
            "error",
            "motion_contract.vocabulary.member_unknown",
            `${rel} references DesignTokens.Motion.${g(m, 1)}, which the shipped Motion enum does not define — code following it would not compile.`,
            rel,
          ),
        );
      }
    }
  }
  // The benchmarks' motion.<name> references are already resolved by check 1.
  if (rel !== BENCH && Object.keys(motionTokens).length > 0) {
    // Scan token occurrences anywhere inside code, not just span-initial ones, so
    // `transition={{ duration: motion.moderate }}` fails the same way `motion.moderate`
    // does. Fenced blocks are scanned independently (a fenced `const d = motion.moderate`
    // example must fail too), then removed before inline-span pairing so a fence's
    // backticks cannot pair with prose backticks and swallow paragraphs. The name class
    // captures punctuated typos whole (motion.durationReveal-extra is not its prefix).
    const scanCodeForTokens = (code: string): void => {
      for (const m of code.matchAll(/\bmotion\.([A-Za-z0-9_.-]+)/g)) {
        checkMotionTokenName(rel, g(m, 1));
      }
    };
    for (const fence of text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)) {
      scanCodeForTokens(g(fence, 1));
    }
    const inlineText = text.replace(/```[\s\S]*?```/g, "");
    for (const span of inlineText.matchAll(/`([^`]+)`/g)) {
      scanCodeForTokens(g(span, 1));
    }
  }
  // Capture the full CSS identifier so an undefined variable that merely extends a
  // promoted name (--motion-duration-fast_extra) fails instead of passing as its prefix.
  for (const m of text.matchAll(/--motion-[A-Za-z0-9_-]+/g)) {
    if (!PROMOTED_MOTION_CSS_VARS.has(m[0])) {
      issues.push(
        issue(
          "error",
          "motion_contract.vocabulary.css_var_unknown",
          `${rel} references ${m[0]}, which promote-design-tokens.ts does not mint — the variable would be undefined at runtime.`,
          rel,
        ),
      );
    }
  }
}

// --- 6. The two seeded templates must prescribe the same per-moment motion tokens. ---
// design/DESIGN.md's "Card motion spec" table and EMOTIONAL_DESIGN.md's design/DESIGN.md integration
// row describe the SAME four card moments; when both seed a business repo they must
// agree on the tokens per moment, or the generated artifacts contradict each other
// (the pre-reconciliation state: 120ms vs 220ms steps, celebrate vs 360ms reveals).
// Soft-skipped when either template is absent, matching check 5's fixture tolerance.
const CARD_MOMENTS = ["Commitment echo", "Perceived Effort", "Variable Reward", "Intent Mirror"];
const DESIGN_TPL = "business/design/DESIGN.md";
const EMOTIONAL_TPL = "business/product/experience/emotional-design/EMOTIONAL_DESIGN.md";
const designTplPath = path.join(skillRoot, DESIGN_TPL);
const emotionalTplPath = path.join(skillRoot, EMOTIONAL_TPL);
if (existsSync(designTplPath) && existsSync(emotionalTplPath)) {
  const tokensCited = (chunk: string): string[] => [...chunk.matchAll(/`motion\.([A-Za-z0-9_]+)`/g)].map((m) => g(m, 1)).sort();

  // design/DESIGN.md: one table row per moment; the row's cells carry its tokens.
  const designText = readFileSync(designTplPath, "utf8");
  const designMoments = new Map<string, string[]>();
  for (const line of designText.split("\n")) {
    if (!line.startsWith("|")) continue;
    const moment = CARD_MOMENTS.find((name) => line.includes(name));
    if (moment) designMoments.set(moment, tokensCited(line));
  }

  // EMOTIONAL_DESIGN.md: all four moments live in one integration-table cell; slice
  // the cell at each moment name and read the tokens up to the next moment.
  const emotionalText = readFileSync(emotionalTplPath, "utf8");
  const emotionalRow = emotionalText.split("\n").find((line) => line.includes("Motion tokens for each card moment"));
  const emotionalMoments = new Map<string, string[]>();
  if (emotionalRow !== undefined) {
    const positions = CARD_MOMENTS.map((name) => ({ name, at: emotionalRow.indexOf(name) }))
      .filter((entry) => entry.at >= 0)
      .sort((a, b) => a.at - b.at);
    positions.forEach((entry, index) => {
      const end = positions[index + 1]?.at ?? emotionalRow.length;
      emotionalMoments.set(entry.name, tokensCited(emotionalRow.slice(entry.at, end)));
    });
  }

  for (const moment of CARD_MOMENTS) {
    const inDesign = designMoments.get(moment);
    const inEmotional = emotionalMoments.get(moment);
    if (inDesign === undefined || inEmotional === undefined) {
      issues.push(
        issue(
          "error",
          "motion_contract.card_moments.missing",
          `The "${moment}" card moment is missing from ${inDesign === undefined ? DESIGN_TPL : EMOTIONAL_TPL}'s motion mapping; both seeded templates must state every moment.`,
          inDesign === undefined ? DESIGN_TPL : EMOTIONAL_TPL,
        ),
      );
      continue;
    }
    if (JSON.stringify(inDesign) !== JSON.stringify(inEmotional)) {
      issues.push(
        issue(
          "error",
          "motion_contract.card_moments.drift",
          `The "${moment}" card moment cites motion tokens [${inDesign.join(", ")}] in ${DESIGN_TPL} but [${inEmotional.join(", ")}] in ${EMOTIONAL_TPL} — the seeded artifacts would contradict each other.`,
          DESIGN_TPL,
        ),
      );
    }
  }
}

// --- 8. The motion-catalog pack's copied presets must match PremiumCraft. ---
// TokenSpring.swift (native procedural scenes) and motion-tokens.ts (Remotion)
// each restate the preset bounces and duration members so procedural and video
// surfaces ride the same physics as withAnimation. The pack README says a
// bounce change is a three-file commit; this section is that instruction as a
// gate (PR #71 review) — prose alone would go stale the first time
// PremiumCraft moved.
const TOKEN_SPRING = "workspace/business/design/motion-catalog/TokenSpring.swift";
const MOTION_TOKENS_TS = "workspace/business/design/motion-catalog/motion-tokens.ts";

const tokenSpringRaw = read(TOKEN_SPRING);
if (tokenSpringRaw !== undefined && swiftPresets.size > 0) {
  const copies = new Map<string, { durationMember: string; bounce: number }>();
  const re = /static let (\w+) = TokenSpring\(duration: DesignTokens\.Motion\.(\w+), bounce: ([\d.]+)\)/g;
  for (const m of tokenSpringRaw.matchAll(re)) {
    copies.set(g(m, 1), { durationMember: g(m, 2), bounce: Number(g(m, 3)) });
  }
  if (copies.size === 0) {
    issues.push(
      issue(
        "error",
        "motion_contract.token_spring.presets_unparseable",
        "No TokenSpring(duration: DesignTokens.Motion.<member>, bounce: N) presets could be parsed from TokenSpring.swift.",
        TOKEN_SPRING,
      ),
    );
  } else {
    for (const [name, preset] of swiftPresets) {
      const copy = copies.get(name);
      if (copy === undefined) {
        issues.push(
          issue(
            "error",
            "motion_contract.token_spring.preset_missing",
            `PremiumCraft.swift ships PremiumMotion.${name} but TokenSpring.swift has no ${name} preset — procedural scenes would silently lack it.`,
            TOKEN_SPRING,
          ),
        );
        continue;
      }
      if (copy.durationMember !== preset.durationMember) {
        issues.push(
          issue(
            "error",
            "motion_contract.token_spring.duration_drift",
            `TokenSpring.${name} rides DesignTokens.Motion.${copy.durationMember} but PremiumMotion.${name} rides ${preset.durationMember}.`,
            TOKEN_SPRING,
          ),
        );
      }
      if (copy.bounce !== preset.bounce) {
        issues.push(
          issue(
            "error",
            "motion_contract.token_spring.bounce_drift",
            `TokenSpring.${name} states bounce ${copy.bounce} but PremiumMotion.${name} ships bounce ${preset.bounce} — the procedural curve would diverge from withAnimation.`,
            TOKEN_SPRING,
          ),
        );
      }
    }
    for (const name of copies.keys()) {
      if (!swiftPresets.has(name)) {
        issues.push(
          issue(
            "error",
            "motion_contract.token_spring.preset_unknown",
            `TokenSpring.swift defines a ${name} preset that PremiumCraft.swift does not ship — the pack must restate the canon, never extend it.`,
            TOKEN_SPRING,
          ),
        );
      }
    }
  }
}

const motionTokensTsRaw = read(MOTION_TOKENS_TS);
if (motionTokensTsRaw !== undefined) {
  if (Object.keys(motionTokens).length > 0) {
    const msRe = /^\s*(durationFast|durationBase|durationSlow|durationCelebrate|durationReveal|durationCinematic|stagger):\s*(\d+),/gm;
    const seen = new Set<string>();
    for (const m of motionTokensTsRaw.matchAll(msRe)) {
      const name = g(m, 1);
      seen.add(name);
      const actual = motionTokens[name];
      if (actual !== undefined && actual !== `${g(m, 2)}ms`) {
        issues.push(
          issue(
            "error",
            "motion_contract.motion_tokens.token_value_drift",
            `motion-tokens.ts states ${name} = ${g(m, 2)}ms but tokens.json ships ${actual}.`,
            MOTION_TOKENS_TS,
          ),
        );
      }
    }
    for (const name of ["durationFast", "durationBase", "durationSlow", "durationCelebrate", "durationReveal", "durationCinematic", "stagger"]) {
      if (!seen.has(name)) {
        issues.push(
          issue("error", "motion_contract.motion_tokens.token_missing", `motion-tokens.ts's Motion table has no parseable ${name} entry.`, MOTION_TOKENS_TS),
        );
      }
    }
  }
  if (swiftPresets.size > 0) {
    const copies = new Map<string, { durationMember: string; bounce: number }>();
    const re = /(\w+): springFromPreset\(Motion\.(\w+), ([\d.]+)\)/g;
    for (const m of motionTokensTsRaw.matchAll(re)) {
      copies.set(g(m, 1), { durationMember: g(m, 2), bounce: Number(g(m, 3)) });
    }
    if (copies.size === 0) {
      issues.push(
        issue(
          "error",
          "motion_contract.motion_tokens.presets_unparseable",
          "No springFromPreset(Motion.<member>, N) presets could be parsed from motion-tokens.ts.",
          MOTION_TOKENS_TS,
        ),
      );
    } else {
      for (const [name, preset] of swiftPresets) {
        const copy = copies.get(name);
        if (copy === undefined) {
          issues.push(
            issue(
              "error",
              "motion_contract.motion_tokens.preset_missing",
              `PremiumCraft.swift ships PremiumMotion.${name} but motion-tokens.ts has no ${name} preset — video renders would silently lack it.`,
              MOTION_TOKENS_TS,
            ),
          );
          continue;
        }
        if (copy.durationMember !== preset.durationMember) {
          issues.push(
            issue(
              "error",
              "motion_contract.motion_tokens.duration_drift",
              `motion-tokens.ts ${name} rides Motion.${copy.durationMember} but PremiumMotion.${name} rides ${preset.durationMember}.`,
              MOTION_TOKENS_TS,
            ),
          );
        }
        if (copy.bounce !== preset.bounce) {
          issues.push(
            issue(
              "error",
              "motion_contract.motion_tokens.bounce_drift",
              `motion-tokens.ts ${name} states bounce ${copy.bounce} but PremiumMotion.${name} ships bounce ${preset.bounce} — the rendered curve would diverge from the native preset.`,
              MOTION_TOKENS_TS,
            ),
          );
        }
      }
      for (const name of copies.keys()) {
        if (!swiftPresets.has(name)) {
          issues.push(
            issue(
              "error",
              "motion_contract.motion_tokens.preset_unknown",
              `motion-tokens.ts defines a ${name} preset that PremiumCraft.swift does not ship — the pack must restate the canon, never extend it.`,
              MOTION_TOKENS_TS,
            ),
          );
        }
      }
    }
  }
}

reportAndExit("Motion craft contract check", issues);
