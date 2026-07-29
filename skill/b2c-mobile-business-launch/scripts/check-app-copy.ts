#!/usr/bin/env node
/**
 * check-app-copy.ts — the gate that keeps internal vocabulary off a user's screen.
 *
 * The failure this exists for: builder agents reach a screen with no authored
 * words and fill it from the spec, so users read "Product-specific value promise"
 * and "Habit Tracker Starter" instead of the product. check:founder-copy closed
 * this class for founder-facing surfaces; this gate closes it for the app's own
 * strings by holding the artifact that carries them: COPY_DECK.md.
 *
 * Rule lists are parsed from references/conversion-copy.md §Banned In App Copy
 * (see lib/app-copy-rules.ts), so the doc an agent reads and the gate that fails
 * the build cannot drift. Identifier shapes are detected structurally, same as
 * check:founder-copy. The judgment rules — tone, warmth, case taste — stay
 * advisory; this gate catches shapes, not voice.
 *
 * Scope, deliberately: the deck, the ONBOARDING.md Copy column, TECH_SPEC.md's
 * externalization contract, and (in the skill repo) the shipped templates and
 * archetype starters. It does not walk arbitrary app source — code TODOs are not
 * copy, and AST-scanning every stack is a different tool. The deck is the source
 * of truth the build types from; LaunchBench covers the behavioral side.
 *
 * Grandfathering (live apps): when project.phase is a post-launch phase
 * (phase_6*), business-repo findings downgrade to warnings — a shipped app gets
 * a tracked backfill, not a broken build. New launches get errors.
 *
 * npm script: check:app-copy
 * Usage: tsx scripts/check-app-copy.ts --skill-root <skill> [--root <templates-or-app>] [--state <PROJECT_STATE.yaml>]
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  asString,
  flagString,
  getPath,
  issue,
  loadProjectState,
  parseCliArgs,
  parseFlags,
  readText,
  reportAndExit,
  type Issue,
  type Severity,
} from "./lib/launch-state.js";
import { copyColumnCells, DECK_KEY_SHAPE, deckAllowedTerms, identifierShapes, keyPrefixReferences, loadAppCopyRules, parseDeck } from "./lib/app-copy-rules.js";
import { matchesTerm } from "./lib/no-slop-rules.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "..");

// --root/--state resolve the way every sibling state gate resolves them
// (relative --state joins the scanned root, not the process cwd); --skill-root
// is parsed separately because parseCliArgs does not know it.
const flags = parseFlags(process.argv.slice(2), [{ flags: ["--skill-root"], key: "skillRoot" }]);
const skillRoot = path.resolve(flagString(flags, "skillRoot") ?? defaultSkillRoot);
const hasRootFlag = process.argv.includes("--root");
const cli = parseCliArgs(process.argv.slice(2));
const root = hasRootFlag ? cli.root : path.join(skillRoot, "templates");
const statePath = hasRootFlag ? cli.statePath : path.join(root, "PROJECT_STATE.yaml");

const issues: Issue[] = [];

const referenceRelative = "references/conversion-copy.md";
const referencePath = path.join(skillRoot, referenceRelative);
if (!existsSync(referencePath)) {
  issues.push(
    issue(
      "error",
      "app_copy.reference_missing",
      `${referenceRelative} is required. It is the source of truth for the rule lists this gate reads.`,
      referenceRelative,
    ),
  );
  reportAndExit("App copy", issues);
}
const rules = loadAppCopyRules(referencePath);

// ---------------------------------------------------------------------------
// Business / templates scan: the deck, the onboarding Copy column, TECH_SPEC.
// ---------------------------------------------------------------------------

const loaded = loadProjectState({ root, statePath });
const state = loaded.state;
// State problems are already every state-gate's job; this gate only needs lanes.
// project.phase is the canonical location (see check-lane-coverage, founder-copy).
const phase = state ? (asString(getPath(state, "project.phase")) ?? "") : "";
const live = /^phase_6/.test(phase);
/** Live apps launched before this contract get warnings while their backfill is tracked. */
const sev = (base: Severity): Severity => (live ? "warning" : base);
const laneStatus = (lane: string): string => (state ? (asString(getPath(state, `lanes.${lane}.status`)) ?? "") : "").toLowerCase();
const deckRequired = laneStatus("design") === "done" || laneStatus("onboarding") === "done";

const deckText = readText(root, "COPY_DECK.md");
const deckIsTemplate = Boolean(deckText && /^Status:\s*template\b/im.test(deckText));

if (!deckText && deckRequired) {
  issues.push(
    issue(
      sev("error"),
      "app_copy.deck_missing",
      "COPY_DECK.md is missing while the design/onboarding lane claims done. Every user-facing string is authored in the deck before the build " +
        "types it (references/conversion-copy.md §The Copy Deck); a build with no deck improvises labels from the spec.",
      "COPY_DECK.md",
    ),
  );
}

if (deckText && deckIsTemplate && deckRequired) {
  issues.push(
    issue(
      sev("error"),
      "app_copy.deck_still_template",
      "COPY_DECK.md still declares 'Status: template' while the design/onboarding lane claims done — the example cells were never replaced " +
        "with this product's words. Author every cell, then set the status to authored with the date.",
      "COPY_DECK.md",
    ),
  );
}

// Cell rules apply to authored decks. The shipped template is exempt by its own
// declaration — its cells are deliberately example copy from a fictional brand
// that the placeholder list detects the moment it leaks into an authored deck.
const authoredDeckKeys = new Set<string>();
if (deckText && !deckIsTemplate) {
  const { rows, malformed } = parseDeck(deckText);
  for (const bad of malformed) {
    issues.push(
      issue(
        sev("error"),
        "app_copy.deck_row_malformed",
        `COPY_DECK.md line ${bad.line} is a table row with ${bad.cells} cells instead of 5 — a dropped row is a string nobody validates. Fix the row (escape literal pipes as \\|).`,
        `COPY_DECK.md:${bad.line}`,
      ),
    );
  }
  if (rows.length === 0) {
    issues.push(
      issue(
        sev("error"),
        "app_copy.deck_empty",
        "COPY_DECK.md has no string rows. The deck carries one row per user-facing string — an empty deck is a missing deck with a title.",
        "COPY_DECK.md",
      ),
    );
  }
  const allowed = deckAllowedTerms(deckText);
  const allowedSet = new Set(allowed.map((term) => term.toLowerCase()));
  const ctaCases = new Set<string>();
  for (const row of rows) {
    const where = `COPY_DECK.md:${row.line}`;
    // Deck keys ship unchanged into the string resources, where a duplicate
    // key silently overwrites another row's copy.
    if (authoredDeckKeys.has(row.key)) {
      issues.push(
        issue(
          sev("error"),
          "app_copy.deck_key_duplicate",
          `Deck key "${row.key}" appears more than once. Localization resources keep one value per key, so the second row's copy would silently replace the first.`,
          where,
        ),
      );
    }
    authoredDeckKeys.add(row.key);
    if (!DECK_KEY_SHAPE.test(row.key)) {
      issues.push(
        issue(
          sev("error"),
          "app_copy.deck_key_shape",
          `"${row.key}" is not a localization key (lowercase dot-namespaced, e.g. onboarding.promise.headline). Deck keys ship unchanged into the string resources.`,
          where,
        ),
      );
    }
    if (!row.copy) {
      issues.push(
        issue(
          sev("error"),
          "app_copy.deck_cell_empty",
          `Deck row "${row.key}" has an empty copy cell — the row exists but the words were never authored.`,
          where,
        ),
      );
      continue;
    }
    for (const shape of rules.placeholderShapes) {
      if (row.copy.toLowerCase().includes(shape.toLowerCase())) {
        issues.push(
          issue(
            sev("error"),
            "app_copy.deck_placeholder",
            `Deck row "${row.key}" still carries placeholder copy ("${shape}"). Author the real words before the build consumes this row.`,
            where,
          ),
        );
      }
    }
    for (const term of rules.bannedTerms) {
      if (allowedSet.has(term.toLowerCase())) continue;
      if (matchesTerm(row.copy, term)) {
        issues.push(
          issue(
            sev("error"),
            "app_copy.deck_internal_vocabulary",
            `Deck row "${row.key}" says "${term}" — internal vocabulary in a user's screen. Say the human sentence the moment needs, or declare the word under "## Allowed terms" with a reason if this product genuinely owns it.`,
            where,
          ),
        );
      }
    }
    for (const token of identifierShapes(row.copy)) {
      issues.push(
        issue(
          sev("error"),
          "app_copy.deck_raw_identifier",
          `Deck row "${row.key}" shows the raw identifier "${token}" to a user. Translate machine state into a sentence before it reaches the deck.`,
          where,
        ),
      );
    }
    if (!/^[123]$/.test(row.tier)) {
      issues.push(
        issue(
          "warning",
          "app_copy.deck_tier_missing",
          `Deck row "${row.key}" has locale tier "${row.tier}"; expected 1, 2, or 3 from LOCALIZATION_MARKET_RESEARCH.md.`,
          where,
        ),
      );
    }
    // Case consistency is a warning by design: Apple says pick-one-and-hold-it,
    // Material mandates sentence case — a hard universal rule would contradict
    // one platform. Mixing within the product's own controls is the real smell.
    if (/\.(cta|confirm|cancel|accept|decline|label)$/.test(row.key) && /^[A-Za-z]/.test(row.copy)) {
      const words = row.copy.split(/\s+/);
      const titleCased = words.length >= 2 && words.slice(0, 2).every((word) => /^[A-Z]/.test(word));
      ctaCases.add(titleCased ? "title" : "sentence");
    }
  }
  if (ctaCases.size > 1) {
    issues.push(
      issue(
        "warning",
        "app_copy.case_mixed",
        "Control labels mix title case and sentence case. Pick one case system in COPY_BRIEF.md and hold it — either reads fine, mixing reads sloppy.",
        "COPY_DECK.md",
      ),
    );
  }
}

// ONBOARDING.md Copy column: the cell that used to say "Product-specific value
// promise". Deck keys, quoted final strings, and guidance are all fine; filler,
// banned vocabulary, and raw identifiers are the leak this gate exists for.
const onboarding = readText(root, "ONBOARDING.md") ?? readText(root, "onboarding/ONBOARDING.md");
if (onboarding) {
  const onboardingAllowed = new Set((deckText ? deckAllowedTerms(deckText) : []).map((term) => term.toLowerCase()));
  for (const cell of copyColumnCells(onboarding)) {
    const where = `ONBOARDING.md:${cell.line}`;
    // Backticked spans are deck keys and file references, not prose the user reads.
    const prose = cell.text.replace(/`[^`\n]*`/g, " ");
    for (const shape of rules.placeholderShapes) {
      if (cell.text.toLowerCase().includes(shape.toLowerCase())) {
        issues.push(
          issue(
            sev("error"),
            "app_copy.onboarding_placeholder",
            `ONBOARDING.md's Copy column still says "${shape}" — the screen has no authored words. Name the COPY_DECK.md keys that hold them (references/conversion-copy.md).`,
            where,
          ),
        );
      }
    }
    // The Copy column was the original leak site, so it gets the same
    // internal-vocabulary scan the deck gets, with the same deck allowlist.
    for (const term of rules.bannedTerms) {
      if (onboardingAllowed.has(term.toLowerCase())) continue;
      if (matchesTerm(prose, term)) {
        issues.push(
          issue(
            sev("error"),
            "app_copy.onboarding_internal_vocabulary",
            `ONBOARDING.md's Copy column says "${term}" — internal vocabulary where a screen's words belong. Copy cells carry deck keys or final human words.`,
            where,
          ),
        );
      }
    }
    for (const token of identifierShapes(cell.text)) {
      issues.push(
        issue(
          sev("error"),
          "app_copy.onboarding_raw_identifier",
          `ONBOARDING.md's Copy column shows the raw identifier "${token}". Copy cells carry deck keys or final words, not machine state.`,
          where,
        ),
      );
    }
  }

  // Coverage: the screen table names its strings as deck-key prefixes. An
  // authored deck that resolves none of them is a one-row deck wearing an
  // authored status — the incomplete-deck bypass, reconciled here.
  if (deckText && !deckIsTemplate) {
    for (const prefix of keyPrefixReferences(
      copyColumnCells(onboarding)
        .map((cell) => cell.text)
        .join("\n"),
    )) {
      const covered = [...authoredDeckKeys].some((key) => key === prefix || key.startsWith(`${prefix}.`));
      if (!covered) {
        issues.push(
          issue(
            sev("error"),
            "app_copy.deck_coverage_missing",
            `ONBOARDING.md names "${prefix}" strings but COPY_DECK.md has no key under that prefix. Author the rows before the build reaches that screen.`,
            "COPY_DECK.md",
          ),
        );
      }
    }
  }
}

// The starters ship example copy under fictional brands so that shipping it
// verbatim is detectable. In a business repo, those names surviving anywhere a
// user can see them means the copy pass never ran on the copied starter.
const fictionalBrands = ["fernpath", "wrenfeed", "loomroom", "glimmerjar"];
if (root !== path.join(skillRoot, "templates")) {
  for (const dir of ["app", "lib", "components", "src"]) {
    const sourceDir = path.join(root, dir);
    if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) continue;
    for (const file of walkCodeFiles(sourceDir)) {
      const relative = path.relative(root, file);
      for (const visible of visibleStrings(readFileSync(file, "utf8"))) {
        for (const brand of fictionalBrands) {
          if (visible.toLowerCase().includes(brand)) {
            issues.push(
              issue(
                sev("error"),
                "app_copy.fictional_brand_shipped",
                `${relative} still shows the starter's fictional example brand "${brand}" in user-visible text ("${visible.slice(0, 60)}"). The copy pass replaces starter example copy from COPY_DECK.md before anything ships.`,
                relative,
              ),
            );
          }
        }
      }
    }
  }
}

// TECH_SPEC.md: localization readiness is a day-one engineering property. When
// the engineering lane claims done, the spec names the externalization mechanism.
if (laneStatus("engineering") === "done") {
  const techSpec = readText(root, "TECH_SPEC.md");
  const hasSection = Boolean(techSpec) && /##\s+Strings And Localization Readiness/i.test(techSpec ?? "");
  const namesMechanism =
    Boolean(techSpec) && /(xcstrings|string catalog|i18next|expo-localization|\barb\b|gen-l10n|next-intl|strings module)/i.test(techSpec ?? "");
  // The shipped template lists every mechanism as an option menu ending in
  // "Record the choice here." — that sentinel surviving means nobody chose.
  // A missing TECH_SPEC.md is the same failure: no committed mechanism.
  const choiceStillOpen = /record the choice here/i.test(techSpec ?? "");
  if (!hasSection || !namesMechanism || choiceStillOpen) {
    issues.push(
      issue(
        sev("error"),
        "app_copy.externalization_missing",
        "TECH_SPEC.md does not commit to a string-externalization mechanism: the Strings And Localization Readiness section must exist and name " +
          "ONE concrete choice for this stack (String Catalogs, i18next + expo-localization, ARB + gen-l10n, or next-intl) — a missing spec or " +
          "the template's untouched option menu does not count. Externalized strings are decided on day one, not retrofitted — " +
          "references/conversion-copy.md §Localization Readiness.",
        "TECH_SPEC.md",
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Skill self-scan: the shipped templates and starters hold the standard the
// skill imposes on every launch. Runs when the scanned root is the skill's own
// templates directory; always hard errors — this repo has no grandfather.
// ---------------------------------------------------------------------------

if (root === path.join(skillRoot, "templates")) {
  if (!deckText) {
    issues.push(
      issue(
        "error",
        "app_copy.deck_template_missing",
        "templates/COPY_DECK.md is missing — the deck contract has no starting artifact.",
        "templates/COPY_DECK.md",
      ),
    );
  } else {
    if (!deckIsTemplate) {
      issues.push(
        issue(
          "error",
          "app_copy.deck_template_status",
          "templates/COPY_DECK.md must declare 'Status: template' — the shipped deck is example voice, and the status line is what exempts it from cell rules.",
          "templates/COPY_DECK.md",
        ),
      );
    }
    const { rows, malformed } = parseDeck(deckText);
    for (const bad of malformed) {
      issues.push(
        issue(
          "error",
          "app_copy.deck_template_row_malformed",
          `templates/COPY_DECK.md line ${bad.line} splits into ${bad.cells} cells instead of 5 — the template must demonstrate well-formed rows.`,
          `templates/COPY_DECK.md:${bad.line}`,
        ),
      );
    }
    if (rows.length < 20) {
      issues.push(
        issue(
          "error",
          "app_copy.deck_template_thin",
          `templates/COPY_DECK.md has ${rows.length} example rows; the template demonstrates the full surface set (expected at least 20 across onboarding, paywall, core loop, empty states, errors, settings).`,
          "templates/COPY_DECK.md",
        ),
      );
    }
    for (const row of rows) {
      if (!DECK_KEY_SHAPE.test(row.key)) {
        issues.push(
          issue(
            "error",
            "app_copy.deck_template_key_shape",
            `templates/COPY_DECK.md example key "${row.key}" breaks the localization-key shape it exists to demonstrate.`,
            `templates/COPY_DECK.md:${row.line}`,
          ),
        );
      }
    }
  }
  if (!readText(root, "COPY_BRIEF.md")) {
    issues.push(
      issue(
        "error",
        "app_copy.brief_template_missing",
        "templates/COPY_BRIEF.md is missing — conversion-copy.md requires the brief and the skill ships its starting artifact.",
        "templates/COPY_BRIEF.md",
      ),
    );
  }

  // Starters: user-visible position is held to the same standard. Strings live
  // in lib/strings.ts (the externalization convention seed); the old internal
  // copy ("archetype scaffold", "customize it with the prompt pack") is banned
  // by the placeholder list. The fictional example brands are allowed HERE —
  // they are the tripwire the business-root scan above fires on.
  const templateBrandAllowlist = new Set(fictionalBrands);
  const archetypesDir = path.join(root, "app-archetypes");
  if (existsSync(archetypesDir)) {
    for (const pack of readdirSync(archetypesDir)) {
      const starterApp = path.join(archetypesDir, pack, "starter");
      if (!existsSync(starterApp) || !statSync(starterApp).isDirectory()) continue;
      const stringsModule = path.join(starterApp, "lib", "strings.ts");
      if (!existsSync(stringsModule)) {
        issues.push(
          issue(
            "error",
            `app_copy.starter_strings_missing`,
            `templates/app-archetypes/${pack}/starter/lib/strings.ts is missing. Starters seed the externalized-strings convention; pages import their words instead of hardcoding them.`,
            `templates/app-archetypes/${pack}/starter/lib/strings.ts`,
          ),
        );
      }
      // Only what a user can see counts as copy: JSX text nodes and string
      // literal values. Whole-file scanning would flag code TODO comments and
      // the JSX attribute NAME `placeholder=`, which are code, not copy.
      for (const file of walkCodeFiles(starterApp)) {
        const relative = path.relative(skillRoot, file);
        for (const visible of visibleStrings(readFileSync(file, "utf8"))) {
          for (const shape of rules.placeholderShapes) {
            if (templateBrandAllowlist.has(shape.toLowerCase())) continue;
            if (visible.toLowerCase().includes(shape.toLowerCase())) {
              issues.push(
                issue(
                  "error",
                  "app_copy.starter_placeholder",
                  `${relative} shows "${shape}" in user-visible text ("${visible.slice(0, 60)}") — internal placeholder copy in starter UI.`,
                  relative,
                ),
              );
            }
          }
        }
      }
    }
  }
}

reportAndExit("App copy", issues);

/**
 * The strings a user could actually see in a UI code file: JSX text nodes and
 * quoted string literal values. Comments never count; module specifiers after
 * `from` never count. This is a lexer-lite heuristic, deliberately — it scans
 * the skill's own four starters, whose shape this repo controls.
 */
function visibleStrings(source: string): string[] {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/([^:])\/\/[^\n]*/g, "$1 ");
  const out: string[] = [];
  for (const match of withoutComments.matchAll(/(?:^|[^\\])(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    const literal = match[2] ?? "";
    const before = withoutComments.slice(Math.max(0, (match.index ?? 0) - 12), match.index ?? 0);
    if (/from\s*$|import\s*\($/.test(before)) continue;
    if (literal.trim().length > 1) out.push(literal);
  }
  for (const match of withoutComments.matchAll(/>([^<>{}\n]+)</g)) {
    const text = (match[1] ?? "").trim();
    if (text.length > 1) out.push(text);
  }
  return out;
}

function walkCodeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      out.push(...walkCodeFiles(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}
