#!/usr/bin/env node
/**
 * check-reference-size.ts — per-file context budget for references/.
 *
 * References are loaded into agent context on demand; a single oversized file
 * silently taxes every launch session that routes through it (the
 * experience-cards.md deck reached ~200KB before it was split into an index
 * plus per-card files). This gate keeps each reference under a generous
 * per-file byte budget so growth becomes a deliberate split/index decision
 * instead of accretion.
 *
 * Exclusions are explicit and carry a reason, in keeping with house culture;
 * an excluded file that drops back under budget warns so the exclusion gets
 * removed.
 *
 * npm script: check:reference-size
 * Usage: tsx scripts/check-reference-size.ts --skill-root /path/to/skill [--budget-bytes N]
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flagNumber, flagString, issue, parseFlags, reportAndExit, type Issue } from "./lib/launch-state.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "..");

/** Generous per-file budget: a reference at this size is already a heavy single load. */
const DEFAULT_BUDGET_BYTES = 64 * 1024;

/**
 * SKILL.md is the one file loaded on every trigger, so it gets its own budget
 * — previously it was the only shipped context file with no size gate at all.
 * The maintainer decision for the entrypoint is freeze-and-subtract: this
 * ceiling sits just above the current size so any addition must be paid for
 * by subtraction elsewhere in SKILL.md. Ratchet it DOWN as SKILL.md shrinks;
 * raising it is a reviewed decision, not a workaround.
 *
 * Ratcheted 68KB -> 45KB when SKILL.md's duplicated Start Here / When To Load
 * References enumerations were merged into one Lane Routing index and the
 * per-lane handoff checklist moved into launch-coverage.md.
 */
const ENTRYPOINT_BUDGET_BYTES = 45 * 1024;

/**
 * Files allowed over budget, each with a concrete reason. Adding an entry is a
 * reviewed decision, not a workaround — prefer splitting into an index plus
 * per-topic files (see references/experience-cards.md).
 */
const EXCLUSIONS: Record<string, string> = {
  "tool-recipes.md":
    "single lookup surface for ~20 third-party tool recipes; recipes are loaded together by design at setup time. Split into per-tool files is tracked as a follow-up candidate.",
  "artifact-contracts.md":
    "the canonical registry of every launch artifact's acceptance criteria; contracts are cross-referenced as one document during handoff audits and per-artifact splitting would fragment the acceptance pass.",
  "source-registry.yaml":
    "machine-read registry consumed by check-source-freshness and the weekly refresh workflow, not loaded into agent context as prose; one file per ~190 tracked sources is the tooling contract.",
};

const args = parseArgs(process.argv.slice(2));
const issues: Issue[] = [];
const referencesDir = path.join(args.skillRoot, "references");

if (!existsSync(referencesDir)) {
  issues.push(issue("error", "reference_size.dir_missing", `references/ is missing at ${referencesDir}.`, "references"));
} else {
  for (const file of collectFilesRecursive(referencesDir)) {
    const relative = path.relative(args.skillRoot, file).split(path.sep).join("/");
    const basename = path.basename(file);
    const size = statSync(file).size;
    const excluded = Object.prototype.hasOwnProperty.call(EXCLUSIONS, basename);

    if (size > args.budgetBytes && !excluded) {
      issues.push(
        issue(
          "error",
          "reference_size.over_budget",
          `${relative} is ${size} bytes (> ${args.budgetBytes} byte budget). Split it into an index plus per-topic files (see references/experience-cards.md), or add an exclusion with a concrete reason in check-reference-size.ts.`,
          relative,
        ),
      );
    }
    if (excluded && size <= args.budgetBytes) {
      issues.push(
        issue(
          "warning",
          "reference_size.exclusion_stale",
          `${relative} is excluded from the reference size budget but is now ${size} bytes (within budget). Remove its exclusion from check-reference-size.ts.`,
          relative,
        ),
      );
    }
  }
}

const entrypointPath = path.join(args.skillRoot, "SKILL.md");
if (!existsSync(entrypointPath)) {
  issues.push(issue("error", "reference_size.entrypoint_missing", `SKILL.md is missing at ${entrypointPath}.`, "SKILL.md"));
} else {
  const entrypointSize = statSync(entrypointPath).size;
  if (entrypointSize > ENTRYPOINT_BUDGET_BYTES) {
    issues.push(
      issue(
        "error",
        "reference_size.entrypoint_over_budget",
        `SKILL.md is ${entrypointSize} bytes (> ${ENTRYPOINT_BUDGET_BYTES} byte entrypoint budget). SKILL.md loads on every trigger; pay for the addition by subtracting or moving detail into a routed reference (freeze-and-subtract).`,
        "SKILL.md",
      ),
    );
  }
}

reportAndExit("Reference context-budget check", issues);

interface Args {
  skillRoot: string;
  budgetBytes: number;
}

function parseArgs(argv: string[]): Args {
  // Only --skill-root is authoritative; ignore a stray --root from the fixture harness.
  const flags = parseFlags(argv, [
    { flags: ["--skill-root"], key: "skillRoot" },
    { flags: ["--budget-bytes"], key: "budgetBytes", kind: "number" },
  ]);
  return {
    skillRoot: flagString(flags, "skillRoot") ?? defaultSkillRoot,
    budgetBytes: flagNumber(flags, "budgetBytes") ?? DEFAULT_BUDGET_BYTES,
  };
}

function collectFilesRecursive(root: string): string[] {
  const files: string[] = [];
  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".yaml"))) {
        files.push(fullPath);
      }
    }
  }
  visit(root);
  return files.sort();
}
