#!/usr/bin/env node
/**
 * check:motion-contract — deterministic consistency gate for the motion craft
 * contract (premium-mobile-craft.md two-family spring canon + motion-craft-benchmarks.md
 * recipes) against the shipped token sources (design-system/tokens.json,
 * templates/design-system/PremiumCraft.swift) and the experience-card canon files.
 *
 * This is the machine-checkable half of the motion acceptance contract. It cannot
 * inspect a generated app's UI code (that adherence is covered behaviorally by the
 * motion-craft-prose-never-applied LaunchBench scenario); what it CAN do is make the
 * contract itself undriftable: every numeric band, token value, and preset the two
 * references state must agree with the files that ship those numbers. The celebrate-band
 * blocker the 2026-07-26 pre-PR review caught by hand (a band that excluded a canon
 * card's own values) is exactly the class of failure this gate automates.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flagString, issue, parseFlags, reportAndExit, type Issue } from "./lib/launch-state.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "..");

function parseArgs(argv: string[]): { skillRoot: string } {
  const flags = parseFlags(argv, [{ flags: ["--skill-root", "--root"], key: "skillRoot" }]);
  return { skillRoot: flagString(flags, "skillRoot") ?? defaultSkillRoot };
}

const { skillRoot } = parseArgs(process.argv.slice(2));

/** Regex capture groups are typed string|undefined under noUncheckedIndexedAccess; every use below is a group the pattern guarantees. */
const g = (m: RegExpMatchArray, i: number): string => m[i] ?? "";
const issues: Issue[] = [];

const BENCH = "references/motion-craft-benchmarks.md";
const CRAFT = "references/premium-mobile-craft.md";
const TOKENS = "design-system/tokens.json";
const SWIFT = "templates/design-system/PremiumCraft.swift";
const CANON_CARDS = [
  "references/experience-cards/peak-end-card.md",
  "references/experience-cards/mastery-and-status-card.md",
  "references/experience-cards/variable-reward-card.md",
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
  const REQUIRED_ROWS = ["durationFast", "durationBase", "durationSlow", "durationReveal", "durationCinematic", "stagger"];
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
    const presetRef = presetCell.match(/PremiumMotion\.(\w+)`?\s*\(bounce ([\d.]+)\)/);
    if (presetRef) {
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
  for (const m of bench.matchAll(/`motion\.([A-Za-z]+)`/g)) {
    if (!(g(m, 1) in motionTokens)) {
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
  for (const m of text.matchAll(/PremiumMotion\.([A-Za-z]+)/g)) {
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
  const familyRe = /\|\s*\*\*(press|celebrate)\*\*\s*\|\s*response\s+([\d.]+)[–-]([\d.]+),\s*dampingFraction\s+([\d.]+)[–-]([\d.]+)/g;
  for (const m of craft.matchAll(familyRe)) {
    bands.set(g(m, 1), { respLo: Number(g(m, 2)), respHi: Number(g(m, 3)), dampLo: Number(g(m, 4)), dampHi: Number(g(m, 5)) });
  }
  for (const family of ["press", "celebrate"]) {
    if (!bands.has(family)) {
      issues.push(
        issue("error", "motion_contract.family_table.missing", `premium-mobile-craft.md's spring table has no parseable ${family} family row.`, CRAFT),
      );
    }
  }
}

if (bench !== undefined && bands.has("press") && bands.has("celebrate")) {
  const mirrorRe =
    /press \(response ([\d.]+)[–-]([\d.]+) \/ damping ([\d.]+)[–-]([\d.]+)\) and celebrate \(response ([\d.]+)[–-]([\d.]+) \/ damping ([\d.]+)[–-]([\d.]+)\)/;
  const m = bench.match(mirrorRe);
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
    const springs = [...text.matchAll(/\.spring\(response:\s*([\d.]+|DesignTokens\.Motion\.expressive),\s*dampingFraction:\s*([\d.]+)\)/g)];
    if (springs.length === 0) {
      issues.push(
        issue("error", "motion_contract.canon.spring_missing", `${rel} no longer contains a parseable .spring(response:dampingFraction:) canon value.`, rel),
      );
      continue;
    }
    for (const s of springs) {
      // A symbolic DesignTokens.Motion.expressive response is in-band by definition:
      // the benchmarks' reconciliation note reads the overloaded name as the celebrate
      // spring response. Only numeric responses are range-checked.
      const response = g(s, 1).includes("expressive") ? NaN : Number(g(s, 1));
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

reportAndExit("Motion craft contract check", issues);
