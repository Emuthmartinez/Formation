export type RequiredTableSectionErrorKind =
  | "invalid-request"
  | "section-missing"
  | "section-duplicate"
  | "table-missing"
  | "table-duplicate"
  | "table-invalid"
  | "header-empty"
  | "header-duplicate"
  | "header-missing"
  | "unsupported-markdown";

export interface RequiredTableSectionError {
  readonly kind: RequiredTableSectionErrorKind;
  readonly message: string;
  readonly sourceLine?: number;
}

export interface SimplePipeTableRow {
  /** One-based source line in the full Markdown document. */
  readonly sourceLine: number;
  /** The source line without leading or trailing whitespace. */
  readonly raw: string;
  /** Trimmed cells in their authored order, without the boundary pipes. */
  readonly cells: readonly string[];
  /** Authored cell width. No missing cells are padded and no extra cells are dropped. */
  readonly rawCellCount: number;
}

export interface SimplePipeTableHeader extends SimplePipeTableRow {
  /** Case-folded, whitespace-collapsed header names in their authored order. */
  readonly normalizedCells: readonly string[];
}

export interface RequiredTableSection {
  readonly heading: string;
  /** One-based source line of the matching H2 heading. */
  readonly headingLine: number;
  /**
   * Raw lines after the matching heading and before the next rendered H2.
   * Fenced content remains present and unmodified.
   */
  readonly body: string;
  /** Non-fenced body lines in source order, joined with LF line endings. */
  readonly renderedBody: string;
  /** One-based, half-open source range occupied by `body`. */
  readonly bodyRange: {
    readonly startLine: number;
    readonly endLineExclusive: number;
  };
  readonly header: SimplePipeTableHeader;
  readonly separator: SimplePipeTableRow;
  readonly rows: readonly SimplePipeTableRow[];
  /** The header row's authored width. Data-row widths remain available on each row. */
  readonly width: number;
  /** Every normalized header name mapped to its zero-based column index. */
  readonly headerIndexes: ReadonlyMap<string, number>;
}

export type RequiredTableSectionResult =
  { readonly ok: true; readonly section: RequiredTableSection } | { readonly ok: false; readonly errors: readonly RequiredTableSectionError[] };

interface ScannedLine {
  readonly raw: string;
  readonly sourceLine: number;
  readonly sourceOffset: number;
  readonly rendered: boolean;
}

interface Fence {
  readonly marker: "`" | "~";
  readonly length: number;
}

interface FenceCandidate {
  readonly marker: string;
  readonly trailing: string;
}

interface UnsupportedMarkdownSyntax {
  readonly lineIndex: number;
  readonly sourceLine: number;
  readonly description: string;
}

interface MarkdownScan {
  readonly lines: readonly ScannedLine[];
  readonly unsupported: readonly UnsupportedMarkdownSyntax[];
}

/**
 * Parse the one simple pipe table in an exact H2 section.
 *
 * Section and header names compare after trimming, collapsing whitespace, and
 * case folding. Headings and pipe rows inside backtick or tilde fences do not
 * participate. This intentionally supports only simple pipe tables; it does
 * not interpret escaped pipes or other Markdown table extensions.
 */
export function parseRequiredTableSection(markdown: string, heading: string, requiredHeaders: readonly string[] = []): RequiredTableSectionResult {
  const normalizedHeading = normalizeLabel(heading);
  const normalizedRequiredHeaders = requiredHeaders.map(normalizeLabel);
  const requestErrors: RequiredTableSectionError[] = [];

  if (normalizedHeading.length === 0) {
    requestErrors.push({ kind: "invalid-request", message: "The required H2 heading must not be empty." });
  }
  if (normalizedRequiredHeaders.some((header) => header.length === 0)) {
    requestErrors.push({ kind: "invalid-request", message: "Required table header names must not be empty." });
  }
  if (new Set(normalizedRequiredHeaders).size !== normalizedRequiredHeaders.length) {
    requestErrors.push({ kind: "invalid-request", message: "Required table header names must be unique after normalization." });
  }
  if (requestErrors.length > 0) return { ok: false, errors: requestErrors };

  const scan = scanRenderedLines(markdown);
  const lines = scan.lines;
  const headings = lines.flatMap((line, lineIndex) => {
    if (!line.rendered) return [];
    const title = h2Title(line.raw);
    return title === undefined ? [] : [{ normalizedTitle: normalizeLabel(title), sourceLine: line.sourceLine, lineIndex }];
  });
  const matches = headings.filter((candidate) => candidate.normalizedTitle === normalizedHeading);

  if (matches.length === 0) {
    return { ok: false, errors: [{ kind: "section-missing", message: `The H2 section "${heading.trim()}" is missing.` }] };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      errors: matches.map((match) => ({
        kind: "section-duplicate",
        message: `The H2 section "${heading.trim()}" is declared more than once.`,
        sourceLine: match.sourceLine,
      })),
    };
  }

  const match = matches[0]!;
  const nextHeading = headings.find((candidate) => candidate.lineIndex > match.lineIndex);
  const sectionEnd = nextHeading?.lineIndex ?? lines.length;
  const unsupported = scan.unsupported.filter((candidate) => candidate.lineIndex > match.lineIndex && candidate.lineIndex < sectionEnd);
  if (unsupported.length > 0) {
    return {
      ok: false,
      errors: unsupported.map((candidate) => ({
        kind: "unsupported-markdown",
        message: `The H2 section "${heading.trim()}" contains ${candidate.description}; strict evidence tables cannot be read from hidden or indented Markdown.`,
        sourceLine: candidate.sourceLine,
      })),
    };
  }
  const bodyStartOffset = lines[match.lineIndex + 1]?.sourceOffset ?? markdown.length;
  const bodyEndOffset = lines[sectionEnd]?.sourceOffset ?? markdown.length;
  const renderedBody = lines
    .slice(match.lineIndex + 1, sectionEnd)
    .filter((line) => line.rendered)
    .map((line) => line.raw)
    .join("\n");
  const tableBlocks = contiguousPipeBlocks(lines, match.lineIndex + 1, sectionEnd);

  if (tableBlocks.length === 0) {
    return {
      ok: false,
      errors: [{ kind: "table-missing", message: `The H2 section "${heading.trim()}" has no simple pipe table.`, sourceLine: match.sourceLine }],
    };
  }
  if (tableBlocks.length > 1) {
    return {
      ok: false,
      errors: tableBlocks.map((block) => ({
        kind: "table-duplicate",
        message: `The H2 section "${heading.trim()}" must contain exactly one contiguous simple pipe table.`,
        sourceLine: block[0]!.sourceLine,
      })),
    };
  }

  const tableLines = tableBlocks[0]!;
  if (tableLines.length < 2) {
    return {
      ok: false,
      errors: [{ kind: "table-invalid", message: "A simple pipe table needs a header and separator row.", sourceLine: tableLines[0]!.sourceLine }],
    };
  }
  if (tableLines.some((line) => line.raw.includes("\\|"))) {
    const sourceLine = tableLines.find((line) => line.raw.includes("\\|"))!.sourceLine;
    return {
      ok: false,
      errors: [{ kind: "table-invalid", message: "Escaped pipes are not supported in a simple pipe table.", sourceLine }],
    };
  }

  const parsedRows = tableLines.map(parseSimplePipeRow);
  const headerRow = parsedRows[0]!;
  const separator = parsedRows[1]!;
  if (separator.rawCellCount !== headerRow.rawCellCount || separator.cells.length === 0 || !separator.cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
    return {
      ok: false,
      errors: [{ kind: "table-invalid", message: "The table separator must have one Markdown separator cell per header.", sourceLine: separator.sourceLine }],
    };
  }

  const normalizedHeaders = headerRow.cells.map(normalizeLabel);
  const headerErrors: RequiredTableSectionError[] = [];
  const headerIndexes = new Map<string, number>();
  normalizedHeaders.forEach((normalizedHeader, index) => {
    if (normalizedHeader.length === 0) {
      headerErrors.push({ kind: "header-empty", message: "Table header names must not be empty.", sourceLine: headerRow.sourceLine });
      return;
    }
    if (headerIndexes.has(normalizedHeader)) {
      headerErrors.push({
        kind: "header-duplicate",
        message: `The normalized table header "${normalizedHeader}" is declared more than once.`,
        sourceLine: headerRow.sourceLine,
      });
      return;
    }
    headerIndexes.set(normalizedHeader, index);
  });
  for (const [index, normalizedRequiredHeader] of normalizedRequiredHeaders.entries()) {
    if (!headerIndexes.has(normalizedRequiredHeader)) {
      headerErrors.push({
        kind: "header-missing",
        message: `The required table header "${requiredHeaders[index]!.trim()}" is missing.`,
        sourceLine: headerRow.sourceLine,
      });
    }
  }
  if (headerErrors.length > 0) return { ok: false, errors: headerErrors };

  const header: SimplePipeTableHeader = { ...headerRow, normalizedCells: normalizedHeaders };
  return {
    ok: true,
    section: {
      heading: heading.trim(),
      headingLine: match.sourceLine,
      body: markdown.slice(bodyStartOffset, bodyEndOffset),
      renderedBody,
      bodyRange: {
        startLine: match.sourceLine + 1,
        endLineExclusive: nextHeading?.sourceLine ?? lines.length + 1,
      },
      header,
      separator,
      rows: parsedRows.slice(2),
      width: header.rawCellCount,
      headerIndexes,
    },
  };
}

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function h2Title(line: string): string | undefined {
  const match = line.match(/^ {0,3}##(?:[\t ]+|$)(.*)$/u);
  if (!match) return undefined;
  return (match[1] ?? "").replace(/[\t ]+#+[\t ]*$/u, "").trim();
}

function scanRenderedLines(markdown: string): MarkdownScan {
  const lines = markdown.split(/\r?\n/);
  const scanned: ScannedLine[] = [];
  const unsupported: UnsupportedMarkdownSyntax[] = [];
  let fence: Fence | undefined;
  let unsupportedFence: Fence | undefined;
  let htmlComment = false;
  let sourceOffset = 0;

  for (const [index, raw] of lines.entries()) {
    const lineOffset = sourceOffset;
    sourceOffset += raw.length;
    if (markdown.startsWith("\r\n", sourceOffset)) sourceOffset += 2;
    else if (markdown[sourceOffset] === "\n") sourceOffset += 1;

    const markerMatch = raw.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
    const marker = validFenceMarker(markerMatch?.[1], markerMatch?.[2]);
    if (fence) {
      scanned.push({ raw, sourceLine: index + 1, sourceOffset: lineOffset, rendered: false });
      if (marker && marker[0] === fence.marker && marker.length >= fence.length && (markerMatch?.[2] ?? "").trim().length === 0) {
        fence = undefined;
      }
      continue;
    }
    if (unsupportedFence) {
      const closingCandidate = looseFenceCandidate(raw) ?? unsupportedFenceCandidate(raw);
      scanned.push({ raw, sourceLine: index + 1, sourceOffset: lineOffset, rendered: false });
      if (
        closingCandidate &&
        closingCandidate.marker[0] === unsupportedFence.marker &&
        closingCandidate.marker.length >= unsupportedFence.length &&
        closingCandidate.trailing.trim().length === 0
      ) {
        unsupportedFence = undefined;
      }
      continue;
    }
    if (htmlComment) {
      unsupported.push({ lineIndex: index, sourceLine: index + 1, description: "an HTML comment" });
      scanned.push({ raw, sourceLine: index + 1, sourceOffset: lineOffset, rendered: false });
      htmlComment = advanceHtmlCommentState(htmlComment, raw);
      continue;
    }
    if (marker) {
      fence = { marker: marker[0] as "`" | "~", length: marker.length };
      scanned.push({ raw, sourceLine: index + 1, sourceOffset: lineOffset, rendered: false });
      continue;
    }

    if (raw.includes("<!--")) {
      unsupported.push({ lineIndex: index, sourceLine: index + 1, description: "an HTML comment" });
      scanned.push({ raw, sourceLine: index + 1, sourceOffset: lineOffset, rendered: false });
      htmlComment = advanceHtmlCommentState(false, raw);
      continue;
    }

    const containerFence = unsupportedFenceCandidate(raw);
    if (containerFence) {
      unsupported.push({ lineIndex: index, sourceLine: index + 1, description: "an unsupported container-relative fence" });
      unsupportedFence = { marker: containerFence.marker[0] as "`" | "~", length: containerFence.marker.length };
      scanned.push({ raw, sourceLine: index + 1, sourceOffset: lineOffset, rendered: false });
      continue;
    }

    const leadingWhitespace = raw.match(/^[ \t]*/u)?.[0] ?? "";
    const indented = leadingWhitespace.includes("\t") || leadingWhitespace.length > 3;
    if (indented && looksLikePipeRow(raw)) {
      unsupported.push({
        lineIndex: index,
        sourceLine: index + 1,
        description: "an indented code table row",
      });
      scanned.push({ raw, sourceLine: index + 1, sourceOffset: lineOffset, rendered: false });
      continue;
    }
    scanned.push({ raw, sourceLine: index + 1, sourceOffset: lineOffset, rendered: true });
  }

  return { lines: scanned, unsupported };
}

function validFenceMarker(marker: string | undefined, trailing: string | undefined): string | undefined {
  if (!marker) return undefined;
  if (marker[0] === "`" && (trailing ?? "").includes("`")) return undefined;
  return marker;
}

function looseFenceCandidate(line: string): FenceCandidate | undefined {
  const match = line.trimStart().match(/^(`{3,}|~{3,})(.*)$/u);
  const marker = validFenceMarker(match?.[1], match?.[2]);
  return marker ? { marker, trailing: match?.[2] ?? "" } : undefined;
}

function unsupportedFenceCandidate(line: string): FenceCandidate | undefined {
  const indented = line.match(/^(?: {4,}|\t[ \t]*)(`{3,}|~{3,})(.*)$/u);
  const container = line.match(/^ {0,3}(?:(?:> ?)|(?:(?:[-+*]|\d{1,9}[.)])[ \t]+))+(`{3,}|~{3,})(.*)$/u);
  const match = indented ?? container;
  const marker = validFenceMarker(match?.[1], match?.[2]);
  return marker ? { marker, trailing: match?.[2] ?? "" } : undefined;
}

function advanceHtmlCommentState(initialState: boolean, line: string): boolean {
  let inside = initialState;
  let cursor = 0;
  while (cursor < line.length) {
    const delimiter = inside ? "-->" : "<!--";
    const delimiterIndex = line.indexOf(delimiter, cursor);
    if (delimiterIndex < 0) return inside;
    inside = !inside;
    cursor = delimiterIndex + delimiter.length;
  }
  return inside;
}

function contiguousPipeBlocks(lines: readonly ScannedLine[], start: number, end: number): ScannedLine[][] {
  const blocks: ScannedLine[][] = [];
  let block: ScannedLine[] = [];

  const flush = (): void => {
    if (block.length > 0) blocks.push(block);
    block = [];
  };

  for (let index = start; index < end; index += 1) {
    const line = lines[index]!;
    if (line.rendered && isSimplePipeRow(line.raw)) block.push(line);
    else flush();
  }
  flush();
  return blocks;
}

function isSimplePipeRow(line: string): boolean {
  const leadingWhitespace = line.match(/^[ \t]*/u)?.[0] ?? "";
  if (leadingWhitespace.includes("\t") || leadingWhitespace.length > 3) return false;
  return looksLikePipeRow(line);
}

function looksLikePipeRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length >= 2 && trimmed.startsWith("|") && trimmed.endsWith("|");
}

function parseSimplePipeRow(line: ScannedLine): SimplePipeTableRow {
  const raw = line.raw.trim();
  const cells = raw
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
  return { sourceLine: line.sourceLine, raw, cells, rawCellCount: cells.length };
}
