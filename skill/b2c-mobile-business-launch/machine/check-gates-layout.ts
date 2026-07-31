#!/usr/bin/env node
/**
 * check-gates-layout.ts — the gates/ tree defends its own shape.
 *
 * ARCHITECTURE.md settled two rules when the validators split in v0.55.0:
 * `gates/` mirrors the playbook domains, and there is no top-level exception
 * bucket — a genuinely cross-cutting gate goes to `gates/process/`. Nothing
 * enforced either. A new gate filed under the wrong domain, or dropped at
 * `gates/` root, was invisible to every other check.
 *
 * The duplicate-basename rule is the one that actually regressed. A FLAT
 * `gates/` made two files with the same name structurally impossible — one
 * directory cannot hold them. Mirroring bought browsability and gave that
 * guarantee up: nothing stops `gates/money/check-revenue.ts` and
 * `gates/growth/check-revenue.ts` both existing after a bad merge. Callers
 * address scripts by basename alone, so a collision is not cosmetic — it makes
 * `resolveScriptPath` ambiguous, and every fixture that spawns by basename
 * starts resolving to whichever file the walk happened to reach first.
 * `indexScripts` already throws on it, but only at spawn time, which is a
 * backstop rather than a gate.
 *
 * The domain list is read from `playbook/` rather than hardcoded, so the two
 * trees cannot drift: adding a playbook domain automatically permits the
 * matching gates folder, and deleting one immediately flags its orphaned gates.
 *
 * npm script: check:gates-layout
 * Usage: tsx machine/check-gates-layout.ts --skill-root /path/to/skill
 */
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flagString, issue, parseFlags, reportAndExit, type Issue } from "../scripts/lib/launch-state.js";
import { SCRIPT_ROOTS, indexScripts } from "../scripts/lib/script-paths.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "..");
const flags = parseFlags(process.argv.slice(2), [{ flags: ["--skill-root", "--root"], key: "skillRoot" }]);
const skillRoot = flagString(flags, "skillRoot") ?? defaultSkillRoot;
const issues: Issue[] = [];

const gatesRoot = path.join(skillRoot, "gates");
const playbookRoot = path.join(skillRoot, "playbook");

if (!existsSync(gatesRoot)) {
  issues.push(issue("error", "gates_layout.gates_missing", `gates/ is missing under ${skillRoot}.`, "gates"));
} else if (!existsSync(playbookRoot)) {
  issues.push(
    issue(
      "error",
      "gates_layout.playbook_missing",
      "playbook/ is missing, so the permitted gate domains cannot be derived. gates/ mirrors playbook/ by definition; there is no hardcoded fallback list on purpose.",
      "playbook",
    ),
  );
} else {
  const domains = new Set(
    readdirSync(playbookRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );

  for (const entry of readdirSync(gatesRoot, { withFileTypes: true })) {
    // Rule 1: nothing executable sits at gates/ root.
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      issues.push(
        issue(
          "error",
          "gates_layout.ungrouped_gate",
          `gates/${entry.name} sits at the gates/ root. Every gate nests in a domain folder — a genuinely cross-cutting gate belongs in gates/process/, which ARCHITECTURE.md defines as the cross-cutting launch-method domain. There is deliberately no top-level exception bucket.`,
          `gates/${entry.name}`,
        ),
      );
      continue;
    }
    if (!entry.isDirectory()) continue;

    // Rule 2: every gate folder names a real playbook domain.
    if (!domains.has(entry.name)) {
      issues.push(
        issue(
          "error",
          "gates_layout.unknown_domain",
          `gates/${entry.name}/ does not correspond to a playbook domain (${[...domains].sort().join(", ")}). gates/ mirrors playbook/: either add playbook/${entry.name}/ with its README.md index, or file these gates under the domain that already owns the subject.`,
          `gates/${entry.name}`,
        ),
      );
    }
  }
}

// Rule 3: basenames stay unique across every script root. indexScripts throws on
// a collision because a duplicate makes basename resolution ambiguous; catching
// it here turns a spawn-time crash into a reviewable audit failure.
try {
  indexScripts(skillRoot);
} catch (error) {
  issues.push(
    issue(
      "error",
      "gates_layout.duplicate_basename",
      `${error instanceof Error ? error.message : String(error)} A flat gates/ made this impossible; the mirrored layout does not, so it is checked here instead of only at spawn time.`,
      SCRIPT_ROOTS.map((root) => `${root}/`).join(", "),
    ),
  );
}

reportAndExit("Gates layout check", issues);
