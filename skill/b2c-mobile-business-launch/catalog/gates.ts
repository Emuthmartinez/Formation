import { readFileSync } from "node:fs";
import path from "node:path";
import { auditExcludedScripts, buildAuditPlan } from "../tooling/lib/audit-plan.js";
import { catalogId } from "./ids.js";
import type { CatalogDomain, CatalogGate } from "./types.js";

/**
 * Gates are npm scripts, not hand-authored data — duplicating them as a static array would
 * be exactly the kind of drift-prone copy R20 is retiring elsewhere. Ported from
 * runtime/graph/catalog.ts's discoverGates(), adapted to the v2 CatalogDomain shape.
 * Still dynamic: the source of truth is package.json + tooling/lib/audit-plan.ts, read at
 * catalog-build time.
 */
export function discoverGates(skillRoot: string, domains: readonly CatalogDomain[]): CatalogGate[] {
  const packageJson = JSON.parse(readFileSync(path.join(skillRoot, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  const scripts = packageJson.scripts ?? {};
  const planIds = new Set(buildAuditPlan("skill").map((step) => step.id));

  return Object.entries(scripts)
    .filter(
      ([name]) =>
        name.startsWith("check:") ||
        name.startsWith("validate:") ||
        name.startsWith("render:") ||
        name.startsWith("catalog:") ||
        ["audit:links", "launchbench", "test:validators", "evals:behavioral"].includes(name),
    )
    .map(([command, script]) => {
      const scriptPath = script.match(/(?:^|\s)(?:tsx\s+)([^\s]+\.ts)/)?.[1];
      const ownerDomainId = inferGateDomain(scriptPath, command, domains);
      const audit = planIds.has(command) ? "required" : command in auditExcludedScripts ? "excluded" : "manual";
      return {
        id: catalogId("gate", command),
        command,
        scriptPath,
        ownerDomainId,
        audit,
      } satisfies CatalogGate;
    })
    .sort((a, b) => a.command.localeCompare(b.command));
}

function inferGateDomain(scriptPath: string | undefined, command: string, domains: readonly CatalogDomain[]): CatalogDomain["id"] {
  if (scriptPath?.startsWith("validation/business/")) {
    const slugValue = scriptPath.split("/")[1];
    const domain = domains.find((candidate) => candidate.slug === slugValue);
    if (domain) return domain.id;
  }
  if (scriptPath?.startsWith("validation/repository/")) return "domain.machine";
  if (command.includes("design")) return "domain.design";
  return "domain.process";
}
