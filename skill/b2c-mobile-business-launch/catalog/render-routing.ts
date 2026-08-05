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
 * These render into catalog/generated/ (a v2 location), not SKILL.md/spine.md — KTD13/U11:
 * the SKILL.md splice happens at cutover, not here (per the U8 unit instructions: do not
 * edit SKILL.md now).
 */

export const generatedStart = (name: string): string => `<!-- catalog-generated:start ${name} -->`;
export const generatedEnd = (name: string): string => `<!-- catalog-generated:end ${name} -->`;

export function renderDomainRouting(catalog: Catalog): string {
  const rows = catalog.domains
    .filter((domain) => domain.slug !== "machine")
    .sort((a, b) => a.order - b.order)
    .map((domain) => `| ${domain.routeLabel} | ${domain.routeWhen} | [\`${domain.indexPath ?? ""}\`](../../${domain.indexPath ?? ""}) |`)
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
  return [generatedStart("reference-index"), "# Reference Index", "", "Generated from catalog/references.ts.", "", sections, "", generatedEnd("reference-index")].join(
    "\n",
  );
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
