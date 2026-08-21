#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getToken, loadDesignState, parseDesignCliArgs, rel, skillRoot, summarizeSurfaces } from "../../../tooling/lib/design-state.js";
import { collectAllFiles, issue, reportAndExit, type Issue } from "../../../tooling/lib/launch-state.js";
import { asArray, asString, isRecord } from "../../../tooling/lib/launch-state.js";

const args = parseDesignCliArgs(process.argv.slice(2));
const issues: Issue[] = [];
const designArtifacts = collectDesignArtifacts(args.root);
const hasDesignState = existsSync(args.statePath) && existsSync(args.tokensPath);
const requiredContractSections = [
  "Source Ownership",
  "Product Experience",
  "Audience And Identity",
  "Reference Evidence",
  "Visual Direction",
  "Interaction System",
  "Onboarding",
  "Motion and haptics",
  "Cross-Surface Direction",
  "Accessibility",
  "Implementation Rules",
  "Decision Log",
];

if (designArtifacts.length > 0 && !hasDesignState) {
  issues.push(
    issue(
      "error",
      "design_room.state_missing_for_artifacts",
      `Design artifacts exist without studio/seed/business.json and studio/seed/theme.tokens.json: ${designArtifacts.slice(0, 6).join(", ")}`,
      args.root,
    ),
  );
}

if (hasDesignState) {
  const loaded = loadDesignState(args);
  issues.push(...loaded.issues);
  const designRoom = loaded.state && isRecord(loaded.state) && isRecord(loaded.state.designRoom) ? loaded.state.designRoom : {};
  const status = asString(designRoom.status);
  const reviewReady = status === "rendered" || status === "baselined";
  const isPackagedStarter = path.resolve(args.root) === path.resolve(skillRoot, "workspace/business");
  const evidenceRequired = reviewReady || (status === "mutating" && !isPackagedStarter);

  const contractPath = path.join(args.root, "design/design.md");
  if (!existsSync(contractPath)) {
    issues.push(issue("error", "design_room.contract_missing", "design/design.md is required for all product design work.", rel(args.root, contractPath)));
  } else {
    const contract = readFileSync(contractPath, "utf8");
    for (const section of requiredContractSections) {
      if (!new RegExp(`^#{2,3} ${escapeRegExp(section)}\\s*$`, "im").test(contract)) {
        issues.push(
          issue("error", "design_room.contract_section_missing", `design/design.md must include the section: ${section}.`, rel(args.root, contractPath)),
        );
      }
    }
    for (const sourcePath of ["studio/seed/business.json", "studio/seed/theme.tokens.json", "design/design-room.html"]) {
      if (!contract.includes(sourcePath)) {
        issues.push(
          issue("error", "design_room.contract_source_missing", `design/design.md must name its source: ${sourcePath}.`, rel(args.root, contractPath)),
        );
      }
    }

    // The Audience And Identity section is only real when its derivation table
    // carries research-cited rows. The citation is checked on the table's
    // Evidence cells, not on the section prose: the template's own boilerplate
    // sentence names strategy/RESEARCH.md, so a prose-substring check would be
    // satisfied by untouched boilerplate and never fire on an underived
    // direction — the exact words-not-work trap check-research-evidence.ts
    // documents for its own section. Placeholder rows are the template's, so
    // they carry no obligation here; once a real row exists, the derivation
    // must trace, and the ready-status placeholder gate below forces real rows.
    const audienceBody = sectionBody(contract, "Audience And Identity");
    if (audienceBody !== undefined) {
      const tableRows = audienceBody
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("|"))
        .map((line) => parseMarkdownRow(line).filter((cell) => cell.length > 0))
        .filter((cells) => cells.length >= 2 && !cells.every((cell) => /^:?-+:?$/.test(cell)));
      const dataRows = tableRows.slice(1);
      const realRows = dataRows.filter((cells) => !containsTemplatePlaceholder(cells.join(" ")));
      if (tableRows.length === 0) {
        issues.push(
          issue(
            "error",
            "design_room.audience_research_missing",
            "design/design.md's Audience And Identity section has no derivation table — every visual decision must trace to a strategy/RESEARCH.md audience fact in a fact→decision row.",
            rel(args.root, contractPath),
          ),
        );
      } else if (realRows.length > 0 && !realRows.some((cells) => (cells.at(-1) ?? "").includes("strategy/RESEARCH.md"))) {
        issues.push(
          issue(
            "error",
            "design_room.audience_research_missing",
            "design/design.md's Audience And Identity derivation table carries authored rows but no Evidence cell cites strategy/RESEARCH.md — visual decisions derive from the target user, not from a trend or the team's taste.",
            rel(args.root, contractPath),
          ),
        );
      }
    }

    const evidenceBody = sectionBody(contract, "Reference Evidence");
    if (evidenceBody !== undefined) {
      const requiredSources = ["60fps.design", "catalogue.projectsbyif.com", "abtest.design", "Design Spells", "UXSnaps", "UI Playbook"];
      const tables = markdownTables(evidenceBody);
      const triageTable = tables.find((table) => tableHasHeaders(table, ["Source", "Status", "Why", "Query or pattern", "Evidence date"]));
      const adoptionHeaders = ["Surface or decision", "Source", "Observation", "Adopt or reject", "Adaptation", "State path", "Validation"];
      const adoptionTable = tables.find((table) => tableHasHeaders(table, adoptionHeaders));
      const requiredEvidenceSources = new Set<string>();
      for (const source of requiredSources) {
        const sourceRow = triageTable?.rows.find((row) => normalizedCell(row[triageTable.headers.indexOf("source")]).toLowerCase() === source.toLowerCase());
        if (!sourceRow) {
          issues.push(
            issue(
              "error",
              "design_room.reference_evidence_source_missing",
              `design/design.md's Reference Evidence section must triage ${source}.`,
              rel(args.root, contractPath),
            ),
          );
          continue;
        }
        if (evidenceRequired) {
          const statusCell = normalizedCell(sourceRow[triageTable!.headers.indexOf("status")]).toLowerCase();
          if (statusCell === "required") requiredEvidenceSources.add(source.toLowerCase());
          if (!["required", "not applicable", "unavailable"].includes(statusCell)) {
            issues.push(
              issue(
                "error",
                "design_room.reference_evidence_status_invalid",
                `design/design.md must give ${source} one authored status: required, not applicable, or unavailable.`,
                rel(args.root, contractPath),
              ),
            );
          }
          const why = normalizedCell(sourceRow[triageTable!.headers.indexOf("why")]);
          const query = normalizedCell(sourceRow[triageTable!.headers.indexOf("query or pattern")]);
          const evidenceDate = normalizedCell(sourceRow[triageTable!.headers.indexOf("evidence date")]);
          const missingReason = !isAuthoredEvidenceCell(why);
          const missingRequiredEvidence = statusCell === "required" && (!isAuthoredEvidenceCell(query) || !isValidEvidenceDate(evidenceDate));
          if (missingReason || missingRequiredEvidence) {
            issues.push(
              issue(
                "error",
                "design_room.reference_evidence_triage_incomplete",
                `design/design.md must give ${source} a reason. A required source also needs a query or pattern and a real, non-future ISO evidence date.`,
                rel(args.root, contractPath),
              ),
            );
          }
        }
      }
      const requiredFields = [
        "Source",
        "Status",
        "Why",
        "Query or pattern",
        "Evidence date",
        "Surface or decision",
        "Observation",
        "Adopt or reject",
        "Adaptation",
        "State path",
        "Validation",
      ];
      for (const field of requiredFields) {
        if (!evidenceBody.includes(field)) {
          issues.push(
            issue(
              "error",
              "design_room.reference_evidence_field_missing",
              `design/design.md's Reference Evidence section must include the field: ${field}.`,
              rel(args.root, contractPath),
            ),
          );
        }
      }
      if (evidenceRequired) {
        const declaredAdoptionRows = adoptionTable?.rows.filter((row) => row.some((cell) => isAuthoredEvidenceCell(normalizedCell(cell)))) ?? [];
        const authoredAdoptionRows = declaredAdoptionRows.filter((row) => {
          const decision = normalizedCell(row[adoptionTable!.headers.indexOf("adopt or reject")]);
          const commonFields = ["surface or decision", "source", "observation", "validation"];
          const commonFieldsComplete = commonFields.every((header) => isAuthoredEvidenceCell(normalizedCell(row[adoptionTable!.headers.indexOf(header)])));
          if (/^adopt$/i.test(decision)) {
            return adoptionHeaders.every((header) => isAuthoredEvidenceCell(normalizedCell(row[adoptionTable!.headers.indexOf(header.toLowerCase())])));
          }
          return commonFieldsComplete && /^reject\b[\s:—-]+\S/i.test(decision);
        });
        if (declaredAdoptionRows.length !== authoredAdoptionRows.length) {
          issues.push(
            issue(
              "error",
              "design_room.reference_evidence_adoption_incomplete",
              "Every declared Reference Evidence row needs its surface, source, observation, decision, and validation. Adopted rows also need an adaptation and state path. Rejected rows need a rationale after Reject.",
              rel(args.root, contractPath),
            ),
          );
        }
        if (requiredEvidenceSources.size > 0 && authoredAdoptionRows.length === 0) {
          issues.push(
            issue(
              "error",
              "design_room.reference_evidence_adoption_missing",
              "A review-ready design/design.md needs at least one complete evidence row. Adopted rows need an adaptation and state path; rejected rows need a rationale.",
              rel(args.root, contractPath),
            ),
          );
        }
        const adoptedSources = new Set(authoredAdoptionRows.map((row) => normalizedCell(row[adoptionTable!.headers.indexOf("source")]).toLowerCase()));
        for (const requiredSource of requiredEvidenceSources) {
          if (!adoptedSources.has(requiredSource)) {
            issues.push(
              issue(
                "error",
                "design_room.reference_evidence_required_source_missing",
                `A source marked required needs its own complete adopted-or-rejected evidence row: ${requiredSource}.`,
                rel(args.root, contractPath),
              ),
            );
          }
        }
        const highImpactSourcesByDecision = new Map<string, Set<string>>();
        for (const row of authoredAdoptionRows) {
          const decision = normalizedCell(row[adoptionTable!.headers.indexOf("surface or decision")]).toLowerCase();
          const category = highImpactCategory(decision);
          if (category === undefined) continue;
          const sources = highImpactSourcesByDecision.get(category) ?? new Set<string>();
          const source = normalizedCell(row[adoptionTable!.headers.indexOf("source")]).toLowerCase();
          if (requiredEvidenceSources.has(source)) sources.add(source);
          highImpactSourcesByDecision.set(category, sources);
        }
        for (const [category, sources] of highImpactSourcesByDecision) {
          if (!hasComplementaryEvidence(category, sources)) {
            issues.push(
              issue(
                "error",
                "design_room.reference_evidence_high_impact_sources_missing",
                `The ${category} design decision needs complete evidence rows from complementary behavior/structure and craft/validation sources. Onboarding, paywall, checkout, retention, and referral decisions need abtest.design plus UXSnaps. AI trust decisions need catalogue.projectsbyif.com plus a craft or validation source.`,
                rel(args.root, contractPath),
              ),
            );
          }
        }
      }
    }

    if (reviewReady && containsTemplatePlaceholder(contract)) {
      issues.push(
        issue(
          "error",
          "design_room.contract_placeholder",
          "design/design.md contains starter text although the Design Room status claims review-ready work.",
          rel(args.root, contractPath),
        ),
      );
    }
  }

  if (loaded.tokens) {
    // WCAG AA contrast check on the tokenized palette, mirroring the ui-ux-pro-max
    // pre-delivery checklist (body text >= 4.5:1, large/UI accent >= 3:1). Warning only:
    // the lowest-cost place to catch a contrast regression is here, before Xcode/Flutter.
    const background = String(getToken(loaded.tokens, "color.background") ?? "");
    const text = String(getToken(loaded.tokens, "color.text") ?? "");
    const primary = String(getToken(loaded.tokens, "color.primary") ?? "");
    const textRatio = contrastRatio(text, background);
    if (textRatio !== undefined && textRatio < 4.5) {
      issues.push(
        issue(
          "warning",
          "design_room.contrast_text",
          `color.text on color.background is ${textRatio.toFixed(2)}:1 (WCAG AA body text needs >= 4.5:1).`,
          "studio/seed/theme.tokens.json",
        ),
      );
    }
    const primaryRatio = contrastRatio(primary, background);
    if (primaryRatio !== undefined && primaryRatio < 3) {
      issues.push(
        issue(
          "warning",
          "design_room.contrast_primary",
          `color.primary on color.background is ${primaryRatio.toFixed(2)}:1 (large text / UI accents need >= 3:1).`,
          "studio/seed/theme.tokens.json",
        ),
      );
    }

    // Machine-checkable slice of quality-lens.md's Anti-Generic Checks ("the palette is
    // not a single-hue default"): flag primary/accent tokens that sit within the same
    // narrow hue band while both carry real saturation — the generic "one brand color at
    // different opacities" look the checklist exists to catch. Warning only: the other six
    // checks in that list (nouns/verbs, typography, claims-match-scope, ...) need judgment
    // this script cannot apply, so this covers the one item that is pure arithmetic.
    const accent = String(getToken(loaded.tokens, "color.accent") ?? "");
    const hueDrift = singleHueDrift(primary, accent);
    if (hueDrift !== undefined && hueDrift.hueDelta < 12 && hueDrift.minSaturation > 0.15) {
      issues.push(
        issue(
          "warning",
          "design_room.palette_single_hue",
          `color.primary and color.accent are only ${hueDrift.hueDelta.toFixed(0)}deg apart in hue (both saturated) — this reads as the single-hue-default look quality-lens.md's Anti-Generic Checks warns against. Pick a genuinely distinct accent hue, or a deliberately desaturated/neutral one.`,
          "studio/seed/theme.tokens.json",
        ),
      );
    }
  }

  if (loaded.state && loaded.stateHash) {
    const renderPath = path.join(args.root, "design/design-room.html");
    if (!existsSync(renderPath)) {
      issues.push(
        issue(
          "error",
          "design_room.render_missing",
          "design/design-room.html must be rendered from state before design is claimed ready.",
          rel(args.root, renderPath),
        ),
      );
    } else {
      const html = readFileSync(renderPath, "utf8");
      const match = html.match(/<meta name="design-state-hash" content="([^"]+)"/);
      if (!match) {
        issues.push(
          issue("error", "design_room.render_hash_missing", "design/design-room.html must include the design-state-hash meta tag.", rel(args.root, renderPath)),
        );
      } else if (match[1] !== loaded.stateHash) {
        issues.push(
          issue(
            "error",
            "design_room.render_stale",
            `design/design-room.html hash ${match[1]} does not match current state hash ${loaded.stateHash}. Re-run render-design-room.ts.`,
            rel(args.root, renderPath),
          ),
        );
      }

      const state = loaded.state;
      if (isRecord(state)) {
        const business = isRecord(state.business) ? state.business : {};
        const designRoom = isRecord(state.designRoom) ? state.designRoom : {};
        const renderedText = htmlText(html);
        const expectedText = [asString(business.name), asString(business.positioning), asString(business.targetAudience)].filter((value): value is string =>
          Boolean(value),
        );
        const latestVersion = asArray(designRoom.versionLog).at(-1);
        if (isRecord(latestVersion)) {
          const summary = asString(latestVersion.summary);
          if (summary) expectedText.push(summary);
        }
        for (const expected of expectedText) {
          if (!renderedText.includes(normalizeText(expected))) {
            issues.push(
              issue(
                "error",
                "design_room.render_semantic_mismatch",
                `design/design-room.html does not show the current state value: ${expected}`,
                rel(args.root, renderPath),
              ),
            );
          }
        }
        for (const summary of summarizeSurfaces(state)) {
          const expected = `${summary.label} ${summary.count} ${summary.ready} ready / ${summary.blocked} blocked / ${summary.notStarted} draft`;
          if (!renderedText.includes(normalizeText(expected))) {
            issues.push(
              issue(
                "error",
                "design_room.render_surface_mismatch",
                `design/design-room.html does not match the current ${summary.label} surface totals.`,
                rel(args.root, renderPath),
              ),
            );
          }
        }
        const status = asString(designRoom.status);
        if ((status === "rendered" || status === "baselined") && containsTemplatePlaceholder(renderedText)) {
          issues.push(
            issue(
              "error",
              "design_room.render_placeholder",
              "design/design-room.html contains starter text although the Design Room status claims review-ready work.",
              rel(args.root, renderPath),
            ),
          );
        }
      }
    }
  }
}

for (const artifact of designArtifacts) {
  if (/design[-_ ]?(proposal|concept)|visual[-_ ]?proof|mood[-_ ]?board|design-v\d+/i.test(path.basename(artifact))) {
    issues.push(
      issue(
        "error",
        "design_room.freeform_design_artifact",
        "Design proposal artifacts must be represented as state mutations and rendered through Design Room, not one-off proposal files.",
        artifact,
      ),
    );
  }
}

reportAndExit("Design Room contract validation", issues);

/**
 * Full body of an H2 or H3 section: heading line to the next required contract
 * section or heading at the same or a higher level, or end of file. Line-based on purpose — a lazy regex with the m flag lets
 * `$` match the first line end, silently truncating the body to one line.
 */
function sectionBody(contract: string, section: string): string | undefined {
  const lines = contract.split("\n");
  const pattern = new RegExp(`^(#{2,3})\\s+${escapeRegExp(section)}\\s*$`, "i");
  const start = lines.findIndex((line) => pattern.test(line.trim()));
  if (start === -1) {
    return undefined;
  }
  const startMatch = lines[start]!.trim().match(pattern)!;
  const depth = startMatch[1]!.length;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const heading = (lines[index] ?? "").trim().match(/^(#{2,6})\s+(.+?)\s*$/);
    const startsRequiredSection = heading !== null && requiredContractSections.some((required) => required.toLowerCase() === heading[2]!.toLowerCase());
    if (heading && (heading[1]!.length <= depth || startsRequiredSection)) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n");
}

type MarkdownTable = { headers: string[]; rows: string[][] };

function markdownTables(body: string): MarkdownTable[] {
  const tables: MarkdownTable[] = [];
  let block: string[] = [];
  const flush = (): void => {
    if (block.length >= 2) {
      const parsed = block.map(parseMarkdownRow);
      const headers = parsed[0]!.map((cell) => normalizedCell(cell).toLowerCase());
      const separator = parsed[1] ?? [];
      if (separator.length === headers.length && separator.every((cell) => /^:?-{3,}:?$/.test(normalizedCell(cell)))) {
        tables.push({ headers, rows: parsed.slice(2).filter((row) => row.some((cell) => normalizedCell(cell).length > 0)) });
      }
    }
    block = [];
  };
  for (const line of body.split("\n")) {
    if (line.trim().startsWith("|")) block.push(line.trim());
    else flush();
  }
  flush();
  return tables;
}

function parseMarkdownRow(line: string): string[] {
  const source = line.replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let cell = "";
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\\") {
      let end = index;
      while (source[end] === "\\") end += 1;
      const count = end - index;
      if (source[end] === "|") {
        cell += "\\".repeat(Math.floor(count / 2));
        if (count % 2 === 1) {
          cell += "|";
          index = end;
          continue;
        }
        index = end - 1;
        continue;
      }
      cell += "\\".repeat(count);
      index = end - 1;
      continue;
    }
    if (source[index] === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += source[index];
    }
  }
  cells.push(cell.trim());
  return cells;
}

function tableHasHeaders(table: MarkdownTable, required: string[]): boolean {
  return required.every((header) => table.headers.includes(header.toLowerCase()));
}

function normalizedCell(value: string | undefined): string {
  return (value ?? "").replace(/`/g, "").replace(/\s+/g, " ").trim();
}

function isAuthoredEvidenceCell(value: string): boolean {
  return value.length > 0 && !containsTemplatePlaceholder(value) && !/^not reviewed$/i.test(value);
}

function isValidEvidenceDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getTime() <= Date.now();
}

function highImpactCategory(value: string): string | undefined {
  if (/\bonboarding\b/i.test(value)) return "onboarding";
  if (/\bpaywall\b/i.test(value)) return "paywall";
  if (/\bcheckout\b/i.test(value)) return "checkout";
  if (/\bretention\b/i.test(value)) return "retention";
  if (/\breferral\b/i.test(value)) return "referral";
  if (/\bcore[- ]loop\b/i.test(value)) return "core loop";
  if (/\bai[- ]trust\b/i.test(value)) return "AI trust";
  if (/\bstore\b.*\bfirst[- ]frames?\b|\bfirst[- ]frames?\b.*\bstore\b/i.test(value)) return "store first frame";
  return undefined;
}

function hasComplementaryEvidence(category: string, sources: Set<string>): boolean {
  if (["onboarding", "paywall", "checkout", "retention", "referral"].includes(category)) {
    return sources.has("abtest.design") && sources.has("uxsnaps");
  }
  const craftOrValidation = ["60fps.design", "abtest.design", "design spells", "ui playbook"];
  if (category === "AI trust") {
    return sources.has("catalogue.projectsbyif.com") && craftOrValidation.some((source) => sources.has(source));
  }
  const behaviorOrStructure = ["catalogue.projectsbyif.com", "uxsnaps"];
  return behaviorOrStructure.some((source) => sources.has(source)) && craftOrValidation.some((source) => sources.has(source));
}

function containsTemplatePlaceholder(value: string): boolean {
  return /\bApp Name\b|One-sentence promise still to be defined|Primary consumer segment still to be defined|Empty Design Room state seeded|\bNot defined\b|\bNot captured\b|\bNot recorded\b|\bPending\b|\bTBD\b|\bTODO\b/i.test(
    value,
  );
}

function htmlText(value: string): string {
  return normalizeText(
    value
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">"),
  );
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectDesignArtifacts(root: string): string[] {
  const ignoredSegments = new Set(["node_modules", ".git", "dist", "state", "render"]);
  return collectAllFiles(root)
    .map((filePath) => path.relative(root, filePath))
    .filter((relativePath) => !relativePath.split(path.sep).some((segment) => ignoredSegments.has(segment)))
    .filter((relativePath) => {
      const normalized = relativePath.replaceAll(path.sep, "/");
      return [
        /(^|\/)DESIGN\.md$/i,
        /(^|\/)design\.md$/i,
        /(^|\/)design\.html$/i,
        /(^|\/)UX_PATTERNS\.md$/i,
        /(^|\/)ux-patterns\.html$/i,
        /(^|\/)design[-_ ]?(proposal|concept|v\d+).*\.(md|html)$/i,
        /(^|\/)visual[-_ ]?proof.*\.(md|html)$/i,
        /(^|\/)mood[-_ ]?board.*\.(md|html)$/i,
      ].some((pattern) => pattern.test(normalized));
    });
}

function parseHex(value: string): [number, number, number] | undefined {
  const captured = value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (!captured) {
    return undefined;
  }
  const hex =
    captured.length === 3
      ? captured
          .split("")
          .map((char) => char + char)
          .join("")
      : captured;
  return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number): number => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(foreground: string, background: string): number | undefined {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (!fg || !bg) {
    return undefined;
  }
  const lighter = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const darker = Math.min(relativeLuminance(fg), relativeLuminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

function hexToHsl(hex: string): { hue: number; saturation: number } | undefined {
  const rgb = parseHex(hex);
  if (!rgb) {
    return undefined;
  }
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return { hue, saturation };
}

function singleHueDrift(primaryHex: string, accentHex: string): { hueDelta: number; minSaturation: number } | undefined {
  const primary = hexToHsl(primaryHex);
  const accent = hexToHsl(accentHex);
  if (!primary || !accent) {
    return undefined;
  }
  const rawDelta = Math.abs(primary.hue - accent.hue);
  return { hueDelta: Math.min(rawDelta, 360 - rawDelta), minSaturation: Math.min(primary.saturation, accent.saturation) };
}
