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
import {
  copyColumnCells,
  DECK_KEY_SHAPE,
  deckAllowedTerms,
  identifierShapes,
  keyPrefixReferences,
  loadAppCopyRules,
  malformedKeyReferences,
  parseDeck,
  stripMarkdownComments,
} from "./lib/app-copy-rules.js";
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
// A missing or unparseable state file must fail loudly: with no lanes, every
// requirement below silently resolves to "not required" and the standalone
// command would pass a business root with no deck at all.
issues.push(...loaded.issues);
// project.phase is the canonical location (see check-lane-coverage, founder-copy).
const phase = state ? (asString(getPath(state, "project.phase")) ?? "") : "";
const live = /^phase_6/.test(phase);
/** Live apps launched before this contract get warnings while their backfill is tracked. */
const sev = (base: Severity): Severity => (live ? "warning" : base);
const laneStatus = (lane: string): string => (state ? (asString(getPath(state, `lanes.${lane}.status`)) ?? "") : "").toLowerCase();
// Engineering is the lane that types the strings, so the deck is required the
// moment the build STARTS (partial), not only when it finishes — the window
// between "building" and "done" is exactly where improvised copy gets typed.
// A blocked build already started — its copy obligations do not un-happen.
const engineeringActive = ["partial", "blocked", "done"].includes(laneStatus("engineering"));
const deckRequired = laneStatus("design") === "done" || laneStatus("onboarding") === "done" || engineeringActive;

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

// A done lane needs a deck that says it is done: "Status: draft" or a missing
// status is the deck's own workflow state calling itself unfinished.
// The date is the handoff provenance: "Status: authored" alone is unfinished paperwork.
const deckIsAuthored = Boolean(deckText && /^Status:\s*authored\s+\d{4}-\d{2}-\d{2}\b/im.test(deckText));
if (deckText && !deckIsTemplate && !deckIsAuthored && deckRequired) {
  issues.push(
    issue(
      sev("error"),
      "app_copy.deck_status_unauthored",
      "COPY_DECK.md does not declare 'Status: authored <date>' while the design/onboarding lane claims done — a draft or unlabeled deck is " +
        "unfinished by its own account. Finish the cells, then set the status.",
      "COPY_DECK.md",
    ),
  );
}

// The deck inherits its voice from the brief; a done design/onboarding lane
// whose COPY_BRIEF.md is missing, template-status, or unlabeled shipped its
// strings without the voice source they are supposed to speak. Conversion
// surfaces (store listing, paywall, lifecycle email) require the brief on
// their own — conversion-copy.md ties it to those surfaces, not to the deck.
const briefRequired = deckRequired || ["store_console", "revenue", "email"].some((lane) => laneStatus(lane) === "done");
if (briefRequired) {
  // Commented-out sections render nothing and count for nothing.
  const rawBrief = readText(root, "COPY_BRIEF.md");
  const brief = rawBrief === undefined ? undefined : stripMarkdownComments(rawBrief);
  // A hollow status stub is not a brief: the sections the deck inherits from
  // must exist and carry content, not just headings.
  const REQUIRED_BRIEF_SECTIONS = [
    "Value proposition",
    "Message hierarchy",
    "Voice and tone",
    "Voice-of-customer phrase bank",
    "Per-surface copy blocks",
    "Claims ledger",
  ];
  // The template's per-section instruction line surviving means the section
  // was never authored, no matter how many characters surround it.
  if (brief && /^Status:\s*authored\s+\d{4}-\d{2}-\d{2}\b/im.test(brief) && /Replace this line with this product's content/i.test(brief)) {
    issues.push(
      issue(
        sev("error"),
        "app_copy.brief_hollow",
        "COPY_BRIEF.md declares itself authored but still carries the template's replace-this-line instruction — the sections were never filled with this product's content.",
        "COPY_BRIEF.md",
      ),
    );
  }
  const hollowSections = REQUIRED_BRIEF_SECTIONS.filter((section) => {
    const body = (brief ?? "").match(new RegExp(`##\\s+${section}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i"))?.[1] ?? "";
    return body.replace(/[^A-Za-z0-9]/g, "").length < 40;
  });
  if (brief && /^Status:\s*authored\s+\d{4}-\d{2}-\d{2}\b/im.test(brief) && hollowSections.length > 0) {
    issues.push(
      issue(
        sev("error"),
        "app_copy.brief_hollow",
        `COPY_BRIEF.md declares itself authored but these sections are missing or empty: ${hollowSections.join(", ")}. The deck inherits its voice from the brief — a status line with no source material grants nothing.`,
        "COPY_BRIEF.md",
      ),
    );
  }
  if (!brief || !/^Status:\s*authored\s+\d{4}-\d{2}-\d{2}\b/im.test(brief)) {
    issues.push(
      issue(
        sev("error"),
        "app_copy.brief_unauthored",
        "COPY_BRIEF.md is missing or not authored ('Status: authored <date>') while the design/onboarding lane claims done. The deck's voice " +
          "comes from the brief — author the promise, voice rules, and claims ledger before the lane is done (references/conversion-copy.md).",
        "COPY_BRIEF.md",
      ),
    );
  }
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
  // The exemption is earned by the reason: a reasonless bullet is reported
  // and NOT honored, so a bare "- lane" cannot silently suppress the scan.
  const declaredTerms = deckAllowedTerms(deckText);
  const reasonIsSubstantive = (reason: string): boolean =>
    reason.replace(/[^a-z0-9]/gi, "").length >= 12 && !rules.placeholderShapes.some((shape) => matchesTerm(reason, shape));
  for (const declared of declaredTerms) {
    if (!reasonIsSubstantive(declared.reason)) {
      issues.push(
        issue(
          sev("error"),
          "app_copy.allowlist_reason_missing",
          `Allowed term "${declared.term}" has no substantive reason. The exemption is earned by one line on why this product owns the word — a bare bullet grants nothing.`,
          "COPY_DECK.md",
        ),
      );
    }
  }
  const allowed = declaredTerms.filter((declared) => reasonIsSubstantive(declared.reason)).map((declared) => declared.term);
  const allowedSet = new Set(allowed.map((term) => term.toLowerCase()));
  const ctaCases = new Set<string>();
  // Allowed terms clear placeholder shapes too — "Todoist" declared as a
  // product-owned word must not keep tripping the "todo" shape.
  const scrubAllowed = (text: string): string => {
    let out = text;
    for (const term of allowed) {
      // Whole-word scrub with the matchesTerm boundary: an allowed "run" must
      // not eat the middle of "runnable starter" and conceal the placeholder.
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`(^|[^A-Za-z0-9'-])(?:${escaped})(?=[^A-Za-z0-9'-]|$)`, "gi"), "$1 ");
    }
    return out;
  };
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
    // Whole-word matching, not substring: "Todoist" must not trip "todo".
    const scrubbedCopy = scrubAllowed(row.copy);
    for (const shape of rules.placeholderShapes) {
      if (matchesTerm(scrubbedCopy, shape)) {
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
      // Inflection-aware exemption: declaring "lanes" clears the banned "lane"
      // the same way the banned list matches inflections of its own entries.
      if (allowed.some((granted) => matchesTerm(granted, term) || matchesTerm(term, granted))) continue;
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
      // Tier decisions are the translation-handoff contract: on a required
      // deck a missing tier blocks; on an early draft it only warns.
      issues.push(
        issue(
          deckRequired ? sev("error") : "warning",
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

  // The documented minimum surface set (conversion-copy.md §The Copy Deck):
  // each canonical section carries rows, or keeps its heading with an explicit
  // "Not applicable — reason" line. ONBOARDING-prefix coverage alone would let
  // a deck skip every error, empty state, and settings string.
  if (deckRequired) {
    const requiredSurfaces: { name: string; heading: RegExp }[] = [
      { name: "Onboarding", heading: /^onboarding\b/i },
      { name: "Paywall", heading: /^paywall\b/i },
      { name: "Core loop", heading: /^core loop\b/i },
      { name: "Empty states", heading: /^empty states?\b/i },
      { name: "Errors", heading: /^errors?\b/i },
      { name: "Settings and dialogs", heading: /^(settings|dialogs)\b/i },
    ];
    const sectionsWithRows = new Set(rows.map((row) => row.section));
    const sectionBodies = new Map<string, string>();
    let currentHeading = "";
    // Commented-out headings and exemptions are invisible in the rendered deck
    // and grant nothing here either.
    for (const line of stripMarkdownComments(deckText).split(/\r?\n/)) {
      const heading = line.match(/^##\s+(.+)$/);
      if (heading?.[1]) {
        currentHeading = heading[1].trim();
        if (!sectionBodies.has(currentHeading)) sectionBodies.set(currentHeading, "");
        continue;
      }
      if (currentHeading) sectionBodies.set(currentHeading, `${sectionBodies.get(currentHeading) ?? ""}${line}\n`);
    }
    for (const surface of requiredSurfaces) {
      const matchingHeadings = [...sectionBodies.keys()].filter((name) => surface.heading.test(name));
      const hasRows = matchingHeadings.some((name) => sectionsWithRows.has(name));
      // The exemption is earned by a real reason: placeholder filler in the
      // reason ("Not applicable — todo") does not waive the surface.
      const notApplicable = matchingHeadings.some((name) => {
        const reason = (sectionBodies.get(name) ?? "").match(/not applicable\s*[—–:-]\s*(\S.{11,})/i)?.[1] ?? "";
        return reason.length > 0 && !rules.placeholderShapes.some((shape) => matchesTerm(reason, shape));
      });
      if (!hasRows && !notApplicable) {
        issues.push(
          issue(
            sev("error"),
            "app_copy.deck_surface_missing",
            `COPY_DECK.md has no "${surface.name}" strings — the surface set is the contract (onboarding, paywall, core loop, empty states, errors, settings and dialogs). Author the rows, or keep the heading with a "Not applicable — <reason>" line when this product genuinely lacks the surface.`,
            "COPY_DECK.md",
          ),
        );
      }
    }
  }
}

// ONBOARDING.md Copy column: the cell that used to say "Product-specific value
// promise". Deck keys, quoted final strings, and guidance are all fine; filler,
// banned vocabulary, and raw identifiers are the leak this gate exists for.
const onboarding = readText(root, "ONBOARDING.md") ?? readText(root, "onboarding/ONBOARDING.md");
if (onboarding) {
  // Same earned-exemption rule as the deck: reasonless bullets grant nothing.
  const onboardingAllowedTerms = (deckText ? deckAllowedTerms(deckText) : [])
    .filter(
      (declared) => declared.reason.replace(/[^a-z0-9]/gi, "").length >= 12 && !rules.placeholderShapes.some((shape) => matchesTerm(declared.reason, shape)),
    )
    .map((declared) => declared.term);
  const onboardingAllowed = new Set(onboardingAllowedTerms.map((term) => term.toLowerCase()));
  const scrubOnboarding = (text: string): string => {
    let out = text;
    for (const term of onboardingAllowedTerms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`(^|[^A-Za-z0-9'-])(?:${escaped})(?=[^A-Za-z0-9'-]|$)`, "gi"), "$1 ");
    }
    return out;
  };
  const copyColumn = copyColumnCells(onboarding);
  // A done onboarding lane with no recognized Copy table has nothing for any
  // of these scans to hold — the table is the contract, so its absence fails.
  if (laneStatus("onboarding") === "done" && copyColumn.cells.length === 0) {
    issues.push(
      issue(
        sev("error"),
        "app_copy.onboarding_copy_table_missing",
        "ONBOARDING.md has no screen table with a Copy column while the onboarding lane claims done. The screen sequence names its COPY_DECK.md keys in that column (references/conversion-copy.md) — without it, no string is reconciled.",
        "ONBOARDING.md",
      ),
    );
  }
  // A row that lost or gained a cell moves text out of the scanned column —
  // reported as malformed so a broken row cannot hide copy from the scan.
  for (const bad of copyColumn.malformed) {
    issues.push(
      issue(
        sev("error"),
        "app_copy.onboarding_row_malformed",
        `ONBOARDING.md line ${bad.line} is a screen-table row with ${bad.cells} cells where the header has ${bad.expected} — a shifted or missing cell hides copy from this scan. Fix the row (escape literal pipes as \\|).`,
        `ONBOARDING.md:${bad.line}`,
      ),
    );
  }
  // A mistyped backticked key reference would silently match nothing in the
  // coverage loop — a pointer at a nonexistent key is reported, not skipped.
  for (const badRef of malformedKeyReferences(copyColumn.cells.map((cell) => cell.text).join("\n"))) {
    issues.push(
      issue(
        sev("error"),
        "app_copy.onboarding_key_reference_malformed",
        `ONBOARDING.md's Copy column references \`${badRef}\`, which is not a localization key shape (lowercase dot-namespaced, optional trailing .*). Fix the reference so coverage can reconcile it against COPY_DECK.md.`,
        "ONBOARDING.md",
      ),
    );
  }
  for (const cell of copyColumn.cells) {
    const where = `ONBOARDING.md:${cell.line}`;
    // An empty Copy cell is a screen with no words and nothing to reconcile.
    if (!cell.text.trim()) {
      issues.push(
        issue(
          sev("error"),
          "app_copy.onboarding_copy_cell_empty",
          "ONBOARDING.md has a screen row with an empty Copy cell — name the COPY_DECK.md keys that hold the screen's words, or the final words themselves.",
          where,
        ),
      );
      continue;
    }
    // Backticked spans are deck keys and file references, not prose the user
    // reads — a legitimate key like `onboarding.email.placeholder` must not
    // trip the placeholder scan, so every prose rule reads the stripped text.
    // Whole-word matching plus the deck allowlist keep "Todoist" clear of "todo".
    const prose = scrubOnboarding(cell.text.replace(/`[^`\n]*`/g, " "));
    for (const shape of rules.placeholderShapes) {
      if (matchesTerm(prose, shape)) {
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
      if (onboardingAllowedTerms.some((granted) => matchesTerm(granted, term) || matchesTerm(term, granted))) continue;
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
    for (const token of identifierShapes(cell.text, { stripInlineCode: true })) {
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

  // Coverage: the screen table names its strings as deck-key references. A
  // namespace reference (`onboarding.promise.*`) accepts any key under the
  // prefix; an exact reference must resolve to that exact key — the build's
  // localization lookup is exact, so a descendant key is not a substitute.
  if (deckText && !deckIsTemplate) {
    for (const reference of keyPrefixReferences(copyColumn.cells.map((cell) => cell.text).join("\n"))) {
      const covered = reference.wildcard
        ? [...authoredDeckKeys].some((key) => key === reference.key || key.startsWith(`${reference.key}.`))
        : authoredDeckKeys.has(reference.key);
      if (!covered) {
        issues.push(
          issue(
            sev("error"),
            "app_copy.deck_coverage_missing",
            reference.wildcard
              ? `ONBOARDING.md names "${reference.key}" strings but COPY_DECK.md has no key under that prefix. Author the rows before the build reaches that screen.`
              : `ONBOARDING.md references the exact key "${reference.key}" but COPY_DECK.md has no such row — the localization lookup at build time is exact. Author the row before the build reaches that screen.`,
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

// ENGINEERING_PLAN.md is what a builder follows in isolation — a customized
// plan that drops the deck route reopens the improvisation path every other
// gate here closes, so the route is held in the plan itself.
if (deckRequired) {
  const plan = readText(root, "ENGINEERING_PLAN.md");
  // With engineering underway, a missing plan is the same failure as a plan
  // without the route: the builder has nothing directing strings to the deck.
  if (engineeringActive && !plan) {
    issues.push(
      issue(
        sev("error"),
        "app_copy.plan_deck_route_missing",
        "ENGINEERING_PLAN.md is missing while engineering is underway — there is no plan directing builders to type strings from COPY_DECK.md.",
        "ENGINEERING_PLAN.md",
      ),
    );
  }
  // The route must be affirmative: "Do not use COPY_DECK.md" contains the
  // filename while reopening the improvisation path.
  const planRoutesToDeck = (plan ?? "")
    .split(/\r?\n/)
    .some((line) => line.includes("COPY_DECK.md") && !/\b(do not|don't|never|avoid|skip|without|instead of)\b/i.test(line));
  if (plan && !planRoutesToDeck) {
    issues.push(
      issue(
        sev("error"),
        "app_copy.plan_deck_route_missing",
        "ENGINEERING_PLAN.md does not route strings through COPY_DECK.md. Builders follow the plan in isolation — restore the rule that work " +
          "units type deck rows (and stop to author missing ones) so screens are never implemented from spec vocabulary.",
        "ENGINEERING_PLAN.md",
      ),
    );
  }
}

// TECH_SPEC.md: localization readiness is a day-one engineering property. When
// the engineering lane claims done, the spec names the externalization mechanism.
if (engineeringActive) {
  const techSpec = readText(root, "TECH_SPEC.md");
  const hasSection = Boolean(techSpec) && /##\s+Strings And Localization Readiness/i.test(techSpec ?? "");
  // The decision lives in its section: "we rejected i18next" elsewhere in the
  // spec is not a selected mechanism, so only the section body can satisfy.
  const readinessSection = (techSpec ?? "").match(/##\s+Strings And Localization Readiness\s*\n([\s\S]*?)(?=\n##\s|$)/i)?.[1] ?? "";
  // An affirmative declaration line, not a mention: "we rejected i18next"
  // names a mechanism while selecting nothing. The choice lives on a line
  // that declares a mechanism and carries no negation.
  const MECHANISM =
    /(xcstrings|string catalog|i18next|expo-localization|\barb\b|gen-l10n|next-intl|strings module|strings\.xml|string resources|localizable\.strings)/i;
  // Negation is scoped to the text BEFORE the mechanism choice: "Mechanism:
  // none — we rejected i18next" negates the choice, while "Mechanism: i18next
  // — no strings remain inline" is a compliant declaration with a compliance
  // note after it.
  // A choice is exactly ONE mechanism group ("i18next + expo-localization"
  // is one pairing; "i18next or next-intl" is two), with nothing pending.
  const MECHANISM_GROUPS: ((line: string) => boolean)[] = [
    (line) => /xcstrings|string catalog|localizable\.strings/i.test(line),
    // expo-localization alone is locale detection with no string resources —
    // the RN mechanism is i18next (expo-localization rides along).
    (line) => /i18next/i.test(line),
    // ARB is only the resource format and gen-l10n only the generator — the
    // Flutter mechanism is the pair.
    (line) => /\barb\b/i.test(line) && /gen-l10n/i.test(line),
    (line) => /next-intl/i.test(line),
    (line) => /strings module/i.test(line),
    (line) => /strings\.xml|string resources/i.test(line),
  ];
  const namesMechanism = readinessSection.split(/\r?\n/).some((line) => {
    if (!/mechanism[^:\n]*:/i.test(line)) return false;
    if (/\b(tbd|to be decided|undecided|decide (later|after)|pending|after the spike)\b/i.test(line)) return false;
    const mechanismAt = line.search(MECHANISM);
    if (mechanismAt === -1) return false;
    if (MECHANISM_GROUPS.filter((group) => group(line)).length !== 1) return false;
    // Negation counts inside the CLAUSE that carries the choice: "Mechanism:
    // i18next was rejected; ..." negates it, while a compliance note in a
    // later clause ("— no strings remain inline") does not.
    const matched = line.slice(mechanismAt).match(MECHANISM)?.[0] ?? "";
    const clauseEndOffset = line.slice(mechanismAt + matched.length).search(/[;.—–]/);
    const clauseEnd = clauseEndOffset === -1 ? line.length : mechanismAt + matched.length + clauseEndOffset;
    const clause = line.slice(0, clauseEnd);
    return !/\b(reject(ed|s)?|declin(ed|es|e)|none|not|no|won't|inline)\b/i.test(clause);
  });
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

  // Archetype build prompts drive implementation directly, so each one must
  // carry the deck route — a prompt that invents strings inline is the exact
  // improvisation path this gate exists to close.
  const archetypePromptsDir = path.join(root, "app-archetypes");
  if (existsSync(archetypePromptsDir)) {
    for (const pack of readdirSync(archetypePromptsDir)) {
      const promptsDir = path.join(archetypePromptsDir, pack, "prompts");
      if (!existsSync(promptsDir) || !statSync(promptsDir).isDirectory()) continue;
      for (const file of walkMarkdown(promptsDir)) {
        // The rule must live INSIDE the runnable fenced block — that block is
        // what a builder copies; prose around it never reaches the build.
        // The FIRST fenced block is the runnable prompt a builder copies; a
        // rule parked in a later example fence never reaches the build.
        const firstFence = readFileSync(file, "utf8").match(/```[\s\S]*?```/)?.[0] ?? "";
        if (!firstFence.includes("COPY_DECK.md")) {
          const relative = path.relative(skillRoot, file);
          issues.push(
            issue(
              "error",
              "app_copy.prompt_deck_route_missing",
              `${relative} does not route strings through COPY_DECK.md. Every archetype build prompt carries the deck rule so a builder following it in isolation cannot invent copy inline.`,
              relative,
            ),
          );
        }
      }
    }
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
      // Externalization cannot silently regress: a JSX text node with real
      // words is hardcoded copy that bypassed lib/strings.ts, even when the
      // words themselves are benign.
      for (const dir of ["app", "components", "lib"])
        for (const file of existsSync(path.join(starterApp, dir)) ? walkCodeFiles(path.join(starterApp, dir)) : []) {
          const relative = path.relative(skillRoot, file);
          const source = readFileSync(file, "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, " ")
            .replace(/^\s*\/\/.*$/gm, " ");
          for (const match of source.matchAll(/>([^<>{}]+)</g)) {
            const text = (match[1] ?? "").trim();
            if (!/[A-Za-z0-9]{2}/.test(text)) continue;
            issues.push(
              issue(
                "error",
                "app_copy.starter_hardcoded_text",
                `${relative} hardcodes the JSX text "${text.slice(0, 50)}" — starter UI strings live in lib/strings.ts so externalization cannot silently regress.`,
                relative,
              ),
            );
          }
          // User-visible attribute literals are copy too: placeholder="Say
          // something" bypasses lib/strings.ts the same way JSX text does.
          // A string literal wrapped in a JSX expression ({"Welcome back"}) is
          // the same hardcoded copy with braces around it.
          for (const match of source.matchAll(/\{\s*(["'])((?:(?!\1)[^\n]){2,})\1\s*\}/g)) {
            const value = match[2] ?? "";
            if (!/[A-Za-z0-9]{2}/.test(value)) continue;
            issues.push(
              issue(
                "error",
                "app_copy.starter_hardcoded_text",
                `${relative} hardcodes the JSX expression literal "${value.slice(0, 50)}" — starter UI strings live in lib/strings.ts.`,
                relative,
              ),
            );
          }
          for (const match of source.matchAll(/\b(placeholder|title|alt|aria-label|aria-description)\s*=\s*(["'])((?:(?!\2)[^\n]){2,})\2/g)) {
            const value = match[3] ?? "";
            if (!/[A-Za-z0-9]{2}/.test(value)) continue;
            issues.push(
              issue(
                "error",
                "app_copy.starter_hardcoded_text",
                `${relative} hardcodes the ${match[1]} attribute "${value.slice(0, 50)}" — user-visible attribute strings live in lib/strings.ts too.`,
                relative,
              ),
            );
          }
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
  for (const match of withoutComments.matchAll(/>([^<>{}]+)</g)) {
    const text = (match[1] ?? "").trim();
    if (text.length > 1) out.push(text);
  }
  return out;
}

function walkMarkdown(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkMarkdown(full));
    } else if (entry.endsWith(".md")) {
      out.push(full);
    }
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
    } else if (/\.(tsx?|jsx?|swift|kt|kts|dart)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}
