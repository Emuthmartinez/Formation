#!/usr/bin/env node
/**
 * check-portfolio-registry.ts — structure floor for the multi-app portfolio surface.
 *
 * PORTFOLIO_REGISTRY.md is the one page a repeat founder reads across every
 * business they run: per-app stage/MRR/verdict rows, an allocation paragraph,
 * cross-app learnings, and the next-launch pipeline. Most launches stay
 * single-business, so the file is optional — this check is a no-op when it is
 * absent. Once the file exists, its sections must all be present: a registry
 * that lists apps but never allocates, or allocates but never carries
 * learnings forward, is a status page, not a portfolio decision surface.
 *
 * Like every artifact-contract check, this grades structure, not truth — the
 * numbers in the rows come from each app's own RevenueCat/PostHog records and
 * the founder's weekly review is the backstop for their honesty.
 *
 * npm script: check:portfolio-registry
 * Usage: tsx scripts/check-portfolio-registry.ts --root /path/to/founder-workspace
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { issue, parseCliArgs, readText, reportAndExit, type Issue } from "./lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const issues: Issue[] = [];

const registryRelative = "PORTFOLIO_REGISTRY.md";
const registryPath = path.join(args.root, registryRelative);

if (existsSync(registryPath)) {
  const registry = (readText(args.root, registryRelative) ?? "").toLowerCase();

  const requiredSections = ["Businesses", "Allocation", "Cross-App Learnings", "Next Launch Pipeline"];
  for (const section of requiredSections) {
    if (registry.includes(section.toLowerCase())) continue;
    issues.push(
      issue(
        "error",
        `portfolio_registry.section_missing.${section.toLowerCase().replaceAll(/[^a-z]+/g, "_")}`,
        `${registryRelative} is missing the "${section}" section. The registry must carry the whole board — businesses, allocation, learnings, and the next-launch pipeline — or it is a status page, not a decision surface.`,
        registryRelative,
      ),
    );
  }

  if (!registry.includes("verdict")) {
    issues.push(
      issue(
        "error",
        "portfolio_registry.verdict_column_missing",
        `${registryRelative} carries no verdict column. Each business row must show its latest Kill, Hold, Or Scale decision so allocation follows verdicts instead of habit.`,
        registryRelative,
      ),
    );
  }
}

reportAndExit("Portfolio registry check", issues);
