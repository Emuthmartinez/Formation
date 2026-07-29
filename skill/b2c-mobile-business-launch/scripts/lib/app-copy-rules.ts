/**
 * app-copy-rules.ts — the machine-readable form of references/conversion-copy.md
 * §Banned In App Copy, plus the COPY_DECK.md table reader.
 *
 * The rule lists are PARSED OUT OF THE REFERENCE rather than duplicated here, the
 * same contract check-no-slop holds with no-slop-writing.md: the reference is the
 * single source of truth and this module is a reader for it. Only mechanically
 * checkable rules live here — banned internal vocabulary, placeholder shapes, and
 * identifier shapes. The judgment rules (tone, warmth, reading level) stay advisory
 * in the reference; regexing taste flattens brand voice.
 */
import { readFileSync } from "node:fs";

export interface AppCopyRules {
  /** Internal vocabulary that must never reach a user's screen. Whole-word, case-insensitive, inflected. */
  bannedTerms: string[];
  /** Filler that means a deck row was never authored. Substring, case-insensitive. */
  placeholderShapes: string[];
}

const LIST_MARKERS = {
  bannedTerms: "**Banned in app copy**",
  placeholderShapes: "**Placeholder shapes**",
} as const;

/**
 * Reads the rule lists out of the reference. Throws when a list is missing or
 * suspiciously short — a silently-empty banned list would make check:app-copy
 * pass copy it exists to catch.
 */
export function loadAppCopyRules(referencePath: string): AppCopyRules {
  const source = readFileSync(referencePath, "utf8");
  return {
    bannedTerms: extractList(source, LIST_MARKERS.bannedTerms, referencePath, 15),
    placeholderShapes: extractList(source, LIST_MARKERS.placeholderShapes, referencePath, 10),
  };
}

function extractList(source: string, marker: string, referencePath: string, minimumExpected: number): string[] {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`${referencePath} is missing the "${marker}" list. check:app-copy reads its rules from that list and cannot run without it.`);
  }
  const lines = source.slice(markerIndex + marker.length).split("\n");
  const listLine = lines.slice(1).find((line) => line.trim().length > 0 && !line.trim().startsWith("#") && !line.trim().startsWith("**"));
  if (!listLine) {
    throw new Error(`${referencePath} has "${marker}" but no list beneath it.`);
  }
  const items = listLine
    .split(",")
    .map((item) =>
      item
        .trim()
        .replace(/^\*\*|\*\*$/g, "")
        .replace(/\.$/, ""),
    )
    .filter((item) => item.length > 0);
  if (items.length < minimumExpected) {
    throw new Error(
      `${referencePath} lists only ${items.length} items under "${marker}", expected at least ${minimumExpected}. A truncated list would make check:app-copy pass copy it should catch.`,
    );
  }
  return items;
}

export interface DeckRow {
  key: string;
  moment: string;
  copy: string;
  notes: string;
  tier: string;
  /** 1-indexed line in the deck file, for actionable reporting. */
  line: number;
  /** The section heading the row sits under, e.g. "Onboarding". */
  section: string;
}

/** Deck keys are localization keys: lowercase dot-namespaced segments. */
export const DECK_KEY_SHAPE = /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/;

export interface ParsedDeck {
  rows: DeckRow[];
  /** Pipe rows that are not header/separator and did not split into 5 cells — a dropped row is a validation bypass, so they are reported, never skipped. */
  malformed: { line: number; cells: number }[];
}

/** Escaped pipes (\|) are literal characters in the cell, not column breaks. */
const ESCAPED_PIPE = "\u0000";
function splitRow(line: string): string[] {
  return line
    .replace(/\\\|/g, ESCAPED_PIPE)
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.replaceAll(ESCAPED_PIPE, "|").trim());
}

/**
 * Reads every string-table row out of a COPY_DECK.md. Header rows (first cell
 * "Key") and separator rows are skipped; a well-formed row has exactly 5 cells,
 * and every deck table is a string table, so anything else pipe-shaped is
 * reported as malformed rather than silently ignored.
 */
export function parseDeck(deckText: string): ParsedDeck {
  const rows: DeckRow[] = [];
  const malformed: { line: number; cells: number }[] = [];
  let section = "";
  deckText.split(/\r?\n/).forEach((rawLine, index) => {
    const heading = rawLine.match(/^##\s+(.+)$/);
    if (heading?.[1]) {
      section = heading[1].trim();
      return;
    }
    const line = rawLine.trim();
    if (!line.startsWith("|")) return;
    const cells = splitRow(line);
    if (cells.every((cell) => /^:?-+:?$/.test(cell) || cell.length === 0)) return;
    if ((cells[0] ?? "").toLowerCase() === "key") return;
    if (cells.length !== 5) {
      malformed.push({ line: index + 1, cells: cells.length });
      return;
    }
    const [key = "", moment = "", copy = "", notes = "", tier = ""] = cells;
    rows.push({
      key: key.replace(/`/g, ""),
      moment,
      copy,
      notes,
      tier,
      line: index + 1,
      section,
    });
  });
  return { rows, malformed };
}

/**
 * Backticked deck-key references in guidance cells, e.g. `onboarding.promise.*`
 * or `paywall.cta` — the ONBOARDING.md screen table names its strings this way.
 * Returned as prefixes (the trailing .* stripped) so coverage can be reconciled
 * against the authored deck's actual keys.
 */
export function keyPrefixReferences(text: string): string[] {
  const prefixes = new Set<string>();
  for (const match of text.matchAll(/`([a-z0-9]+(?:[._-][a-z0-9]+)*)(\.\*)?`/g)) {
    const token = match[1] ?? "";
    if (!token.includes(".")) continue;
    if (/\.(md|html|ts|tsx|yaml|json)$/.test(token)) continue;
    prefixes.add(token);
  }
  return [...prefixes];
}

/**
 * Deck-local allowlist: product-owned words declared under "## Allowed terms",
 * one bullet each, term before any dash/colon reason. Mirrors check:founder-copy's
 * allowlist so a product whose voice genuinely owns a flagged word can say so
 * in the artifact itself.
 */
export function deckAllowedTerms(deckText: string): string[] {
  const match = deckText.match(/^##\s+Allowed terms\s*$([\s\S]*?)(?=^##\s|\n*$(?![\s\S]))/im);
  if (!match?.[1]) return [];
  const terms: string[] = [];
  for (const line of match[1].split(/\r?\n/)) {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (!bullet?.[1]) continue;
    const term = (bullet[1].split(/\s+[—–:-]\s+/)[0] ?? "").replace(/`/g, "").trim();
    if (term) terms.push(term);
  }
  return terms;
}

/**
 * Extracts the Copy-column cells from any markdown table whose third column
 * header starts with "Copy" — the ONBOARDING.md screen-sequence shape. Returns
 * the cell text with its 1-indexed line so a placeholder can be pointed at.
 */
export function copyColumnCells(markdownText: string): { text: string; line: number }[] {
  const cells: { text: string; line: number }[] = [];
  const lines = markdownText.split(/\r?\n/);
  let inCopyTable = false;
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line.startsWith("|")) {
      inCopyTable = false;
      return;
    }
    const rowCells = splitRow(line);
    const third = rowCells[2];
    if (rowCells.length < 3 || third === undefined) return;
    if (/^copy\b/i.test(third)) {
      inCopyTable = true;
      return;
    }
    if (!inCopyTable) return;
    if (rowCells.every((cell) => /^:?-+:?$/.test(cell))) return;
    cells.push({ text: third, line: index + 1 });
  });
  return cells;
}

/**
 * Machine-shaped tokens in copy: snake_case and SCREAMING_SNAKE identifiers,
 * ported from check-founder-copy. Deck keys never count — they live in the key
 * column, not the copy cell. ICU interpolations like {count} are stripped first:
 * a named placeholder is the localization contract working, not a leak.
 */
export function identifierShapes(text: string): string[] {
  const stripped = text.replace(/\{[a-zA-Z0-9_]+\}/g, " ").replace(/`[^`\n]*`/g, " ");
  const found = new Set<string>();
  for (const match of stripped.matchAll(/\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b/g)) {
    found.add(match[0]);
  }
  return [...found];
}
