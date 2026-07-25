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
 * It also enforces the split it recommends: every `references/<name>/`
 * directory needs a `references/<name>.md` index that links each topic file,
 * and every routing link out of that index must resolve. Without this, a split
 * rots silently — an unlinked topic file is unreachable and a dangling row
 * sends agents nowhere.
 *
 * npm script: check:reference-size
 * Usage: tsx scripts/check-reference-size.ts --skill-root /path/to/skill [--budget-bytes N]
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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

/**
 * Index completeness for split references.
 *
 * The remedy this gate recommends is "split into an index plus per-topic
 * files", so the split itself needs enforcement: a topic file no index links
 * to is unreachable by progressive disclosure, and a routing row pointing at a
 * deleted file sends agents to a 404. Every `references/<name>/` directory
 * must therefore have a `references/<name>.md` index that links each of its
 * files, and every link out of that index must resolve.
 */
if (existsSync(referencesDir)) {
  for (const entry of readdirSync(referencesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const topicDir = path.join(referencesDir, entry.name);
    const indexPath = path.join(referencesDir, `${entry.name}.md`);
    const indexRelative = `references/${entry.name}.md`;

    if (!existsSync(indexPath)) {
      issues.push(
        issue(
          "error",
          "reference_size.index_missing",
          `references/${entry.name}/ has no ${indexRelative} index. A split reference needs an index that routes to each topic file, or nothing can load it on demand.`,
          indexRelative,
        ),
      );
      continue;
    }

    const indexText = readFileSync(indexPath, "utf8");
    // Reachability means a real markdown link, not a mention. A filename that
    // only appears in prose or backticks reads as routed to a human skimming
    // the index but is not something an agent can follow, so both directions
    // below are checked against parsed link targets rather than raw text.
    const linked = new Set(linkedHrefs(indexText));

    for (const file of collectFilesRecursive(topicDir)) {
      const href = path.relative(referencesDir, file).split(path.sep).join("/");
      if (!linked.has(href)) {
        issues.push(
          issue(
            "error",
            "reference_size.index_incomplete",
            `${indexRelative} does not link references/${href}. Add a routing row with a load-when trigger (a bare mention is not a link), or delete the unreachable file.`,
            indexRelative,
          ),
        );
      }
    }

    for (const href of linked) {
      if (href.startsWith(`${entry.name}/`) && !existsSync(path.join(referencesDir, href))) {
        issues.push(
          issue("error", "reference_size.index_dangling_link", `${indexRelative} routes to references/${href}, which does not exist.`, indexRelative),
        );
      }
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

/**
 * Local markdown link targets, normalized: `#fragment` and an optional
 * `"title"` are stripped, and `./` prefixes collapsed. External links and
 * pure anchors are dropped so only routable file paths remain.
 */
function linkedHrefs(text: string): string[] {
  const hrefs: string[] = [];
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const raw = match[1]?.trim();
    if (!raw || raw.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      continue;
    }
    const target = raw.split(/\s+/)[0]?.split("#")[0]?.replace(/^\.\//, "");
    if (target) {
      hrefs.push(target);
    }
  }
  return hrefs;
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
