#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { composeCatalog } from "./index.js";
import type { Catalog } from "./types.js";

/**
 * Renders catalog/generated/routing.md and catalog/generated/spine.md from catalog data —
 * ported from runtime/graph/render.ts's renderDomainRouting()/renderPhaseSpine() and
 * tooling/render-skill-graph.ts's CLI/--check pattern, restructured against catalog/
 * types. This is the concrete implementation of R20's inversion: domain routing and the
 * phase spine are now GENERATED from catalog/domains.ts, catalog/phases.ts, and
 * catalog/references.ts's authored loadWhen data, rather than the old catalog scraping a
 * hand-authored README table (see catalog/references.ts's file header).
 *
 * These render into catalog/generated/ AND splice into SKILL.md's Lane Routing table
 * (KTD13/U11: the 14 knowledge/<slug>/README.md routing tables that used to anchor each
 * row's "Load" column are deleted at cutover — see catalog/domains.ts's header — so the
 * "Load" column now points at this file's own Reference Index section instead of a
 * per-domain file). SKILL.md sits at the skill root; catalog/generated/routing.md sits two
 * directories down, so its own knowledge-file links use a `../../` prefix back to the skill
 * root (see renderReferenceIndex below) — when the SAME domain-routing table is spliced into
 * SKILL.md, that prefix is stripped: a link from SKILL.md to this file needs no `../../` at
 * all, since SKILL.md already sits where those two `../../` would have landed.
 */

export const generatedStart = (name: string): string => `<!-- catalog-generated:start ${name} -->`;
export const generatedEnd = (name: string): string => `<!-- catalog-generated:end ${name} -->`;

/**
 * GitHub-flavored-markdown heading anchor: lowercase, strip everything but word
 * characters/spaces/hyphens, collapse spaces to hyphens. Must stay in lockstep with
 * renderReferenceIndex's `## ${domain.name}` headings below — both derive the same anchor
 * from the same domain.name so the domain-routing table's row links resolve.
 */
function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

/**
 * @param hrefPrefix Prepended to the `#anchor` fragment. Empty string for a same-file anchor
 *   (catalog/generated/routing.md linking to its own Reference Index section below);
 *   "catalog/generated/routing.md" when this table is spliced into SKILL.md, so the row
 *   links out to that file's section instead.
 */
export function renderDomainRouting(catalog: Catalog, hrefPrefix = ""): string {
  const rows = catalog.domains
    .filter((domain) => domain.slug !== "machine")
    .sort((a, b) => a.order - b.order)
    .map((domain) => `| ${domain.routeLabel} | ${domain.routeWhen} | [Index](${hrefPrefix}#${slugifyHeading(domain.name)}) |`)
    .join("\n");
  return [
    generatedStart("domain-routing"),
    "# Domain Routing",
    "",
    "Generated from catalog/domains.ts. Edit the catalog, not this file.",
    "",
    "| Area of the business | Route here when | Load |",
    "| --- | --- | --- |",
    rows,
    "",
    generatedEnd("domain-routing"),
  ].join("\n");
}

export function renderReferenceIndex(catalog: Catalog): string {
  const byDomain = new Map<string, typeof catalog.references>();
  for (const reference of catalog.references) {
    const list = byDomain.get(reference.domainId) ?? [];
    list.push(reference);
    byDomain.set(reference.domainId, list);
  }
  const sections = catalog.domains
    .filter((domain) => byDomain.has(domain.id))
    .sort((a, b) => a.order - b.order)
    .map((domain) => {
      const rows = (byDomain.get(domain.id) ?? [])
        .slice()
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((reference) => `| ${reference.loadWhen} | [\`${reference.path}\`](../../${reference.path}) |`)
        .join("\n");
      return `## ${domain.name}\n\n| Load when | Reference |\n| --- | --- |\n${rows}`;
    })
    .join("\n\n");
  return [
    generatedStart("reference-index"),
    "# Reference Index",
    "",
    "Generated from catalog/references.ts.",
    "",
    sections,
    "",
    generatedEnd("reference-index"),
  ].join("\n");
}

export function renderPhaseSpine(catalog: Catalog): string {
  const rows = [...catalog.phases]
    .sort((a, b) => a.order - b.order)
    .filter((phase) => phase.key !== "phase_0a")
    .map((phase) => `| ${phase.label} | ${phase.focus} | ${phase.primaryOutput} |`)
    .join("\n");
  return [
    generatedStart("phase-spine"),
    "# Phase Spine",
    "",
    "Generated from catalog/phases.ts. Edit the catalog, not this file.",
    "",
    "| Phase | Focus | Primary output |",
    "| --- | --- | --- |",
    rows,
    "",
    generatedEnd("phase-spine"),
  ].join("\n");
}

export function renderGeneratedFiles(catalog: Catalog): Record<string, string> {
  return {
    "catalog/generated/routing.md": `${renderDomainRouting(catalog)}\n\n${renderReferenceIndex(catalog)}\n`,
    "catalog/generated/spine.md": `${renderPhaseSpine(catalog)}\n`,
    "catalog/generated/catalog.json": `${JSON.stringify(catalog, null, 2)}\n`,
  };
}

/**
 * Ported from runtime/graph/render.ts. Replaces the content between a named generated-block
 * marker pair, leaving everything else in `text` untouched.
 */
export function replaceGeneratedBlock(text: string, name: string, block: string): string {
  const start = generatedStart(name);
  const end = generatedEnd(name);
  const from = text.indexOf(start);
  const to = text.indexOf(end);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`Missing generated block markers for ${name}.`);
  }
  return `${text.slice(0, from)}${block}${text.slice(to + end.length)}`;
}

/**
 * SKILL.md is NOT itself generated — it carries the hand-authored Always-On Contracts, Start
 * Here, Ground Rules, and What Counts As Done sections. This module owns only its Lane
 * Routing table splice (KTD13/U11; v1's equivalent lived in the deleted
 * tooling/render-skill-graph.ts, driven by runtime/graph/render.ts). The Phase Spine section
 * is a link-out to catalog/generated/spine.md rather than a second inline splice, so SKILL.md
 * only carries one generated block to stay drift-checkable and inside its byte budget
 * (check:reference-size's entrypoint budget).
 */
export function spliceSkillMd(catalog: Catalog, currentSkillMd: string): string {
  return replaceGeneratedBlock(currentSkillMd, "domain-routing", renderDomainRouting(catalog, "catalog/generated/routing.md"));
}

// --- CLI entry -----------------------------------------------------------------------

const isMain = (() => {
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return invoked === fileURLToPath(import.meta.url);
})();

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultSkillRoot = path.resolve(scriptDir, "..");
  const skillRoot = args.skillRoot ?? defaultSkillRoot;
  const catalog = composeCatalog(skillRoot);
  const files = renderGeneratedFiles(catalog);

  const skillMdPath = path.join(skillRoot, "SKILL.md");
  if (existsSync(skillMdPath)) {
    try {
      files["SKILL.md"] = spliceSkillMd(catalog, readFileSync(skillMdPath, "utf8"));
    } catch (error) {
      console.error(`ERROR catalog_render.skill_md_markers_missing: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }

  let drift = false;
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(skillRoot, relative);
    if (args.check) {
      if (!existsSync(target)) {
        console.error(`ERROR catalog_render.generated_missing: ${relative}`);
        drift = true;
      } else if (readFileSync(target, "utf8") !== content) {
        console.error(`ERROR catalog_render.generated_drift: ${relative}`);
        drift = true;
      }
    } else {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, content, "utf8");
      console.log(`Wrote ${relative}`);
    }
  }
  if (drift) process.exitCode = 1;
  else console.log(`catalog/render-routing.ts: ${Object.keys(files).length} projection(s) ${args.check ? "current" : "written"}.`);
}

function parseArgs(argv: string[]): { skillRoot?: string; check: boolean } {
  let skillRoot: string | undefined;
  let check = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--skill-root" && argv[index + 1]) {
      skillRoot = path.resolve(argv[index + 1]!);
      index += 1;
    } else if (argv[index] === "--check") check = true;
  }
  return { skillRoot, check };
}
