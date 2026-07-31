#!/usr/bin/env node
/**
 * check-hooks-installed.ts — the hooks are the enforcement layer; this proves
 * they were actually delivered.
 *
 * business/repo-agent-entrypoints/settings.json ships PostToolUse hooks that
 * fire depth-check validators after artifact writes and block the screenshot
 * grading pass. scripts/fixtures/hooks.fixtures.ts proves those commands
 * behave correctly. Nothing proved a generated business repo had installed
 * them: the instruction lived in a JSON comment ("Copy this file to
 * .claude/settings.json"), so a launch could pass every other gate with zero
 * automatic enforcement running.
 *
 * Two modes, because a hollow pass is worse than no gate:
 *
 *   TEMPLATE MODE (--skill-root only) — validates the shipped payload is
 *   well-formed and reinstallable. This is what the maintainer audit runs,
 *   and it is real work: the audit's --root is business/, which is not a
 *   business repo, so asserting "hooks installed" there would always pass
 *   vacuously.
 *
 *   BUSINESS-REPO MODE (--root <repo>) — validates that repo's
 *   .claude/settings.json actually carries the current hooks.
 *
 * HONEST LIMIT: this proves the hook entries are present and current. It
 * cannot prove they ever fired, and it cannot prove the founder's shell has
 * jq and SKILL_ROOT at the moment an agent runs — those are checked here as
 * warnings because they are the two documented ways these hooks silently
 * no-op, but the machine running the check is not necessarily the machine
 * running the agent.
 *
 * npm script: check:hooks-installed
 * Usage: tsx gates/process/check-hooks-installed.ts --skill-root /path/to/skill [--root /path/to/business-repo]
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expandHome, flagString, issue, parseFlags, reportAndExit, type Issue } from "../../scripts/lib/launch-state.js";
import {
  HOOK_TEMPLATE_RELATIVE,
  MANAGED_MARKER,
  entrySignature,
  isManagedEntry,
  readHookTemplate,
  type HookEntry,
  type HookSettings,
} from "../../scripts/lib/hook-contract.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "../..");

interface Args {
  skillRoot: string;
  root?: string;
}

function parseArgs(argv: string[]): Args {
  const flags = parseFlags(argv, [
    { flags: ["--skill-root"], key: "skillRoot" },
    { flags: ["--root"], key: "root" },
  ]);
  const root = flagString(flags, "root");
  return {
    skillRoot: path.resolve(expandHome(flagString(flags, "skillRoot") ?? defaultSkillRoot)),
    root: root ? path.resolve(expandHome(root)) : undefined,
  };
}

const args = parseArgs(process.argv.slice(2));
const issues: Issue[] = [];

/* ---------------------------------------------------------------- template */

const template = readHookTemplate(args.skillRoot);
const templateRelative = HOOK_TEMPLATE_RELATIVE.split(path.sep).join("/");

if (template.error) {
  issues.push(issue("error", "hooks_installed.template_unreadable", template.error, templateRelative));
} else {
  template.entries.forEach((entry, index) => {
    const where = `${templateRelative} PostToolUse[${index}]`;
    if (!entry.matcher) {
      issues.push(issue("error", "hooks_installed.template_matcher_missing", `${where} has no matcher; it would never fire.`, templateRelative));
    }
    const commands = entry.hooks ?? [];
    if (commands.length === 0) {
      issues.push(issue("error", "hooks_installed.template_command_missing", `${where} has no hooks[].command.`, templateRelative));
    }
    for (const command of commands) {
      if (!command.command || command.command.trim() === "") {
        issues.push(issue("error", "hooks_installed.template_command_empty", `${where} has an empty command.`, templateRelative));
        continue;
      }
      // The legacy ownership detector in hook-contract.ts falls back to this
      // substring for repos installed before `_managed` existed. If a future
      // hook drops the name, reinstalls would duplicate instead of replace.
      if (!command.command.includes(MANAGED_MARKER)) {
        issues.push(
          issue(
            "error",
            "hooks_installed.template_unattributed",
            `${where} command does not mention "${MANAGED_MARKER}". The reinstall path matches pre-marker entries by that substring; without it a reinstall duplicates hooks instead of replacing them.`,
            templateRelative,
          ),
        );
      }
    }
  });
}

/* ----------------------------------------------------------- business repo */

/**
 * business/ carries PROJECT_STATE.yaml like a real business repo does, so
 * the discriminator is repo-agent-entrypoints/ — a directory that only exists
 * inside the skill's own template tree.
 */
function isSkillTemplateDir(root: string): boolean {
  return existsSync(path.join(root, "repo-agent-entrypoints", "settings.json"));
}

if (args.root && !template.error) {
  if (isSkillTemplateDir(args.root)) {
    console.log(`check-hooks-installed: --root ${args.root} is the skill's template tree, not a business repo; installation checks skipped by design.`);
  } else {
    const settingsRelative = ".claude/settings.json";
    const settingsPath = path.join(args.root, settingsRelative);
    const installCommand = `npm run --prefix ${args.skillRoot} install:hooks -- --target ${args.root}`;

    if (!existsSync(settingsPath)) {
      issues.push(
        issue(
          "error",
          "hooks_installed.settings_missing",
          `${settingsRelative} is missing, so no depth-check hooks run in this repo. Install them: ${installCommand}`,
          settingsRelative,
        ),
      );
    } else {
      let settings: HookSettings | undefined;
      try {
        const parsed: unknown = JSON.parse(readFileSync(settingsPath, "utf8"));
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          issues.push(issue("error", "hooks_installed.settings_not_object", `${settingsRelative} is not a JSON object.`, settingsRelative));
        } else {
          settings = parsed as HookSettings;
        }
      } catch (error) {
        issues.push(
          issue("error", "hooks_installed.settings_invalid_json", `${settingsRelative} is not valid JSON (${(error as Error).message}).`, settingsRelative),
        );
      }

      if (settings) {
        const installed = Array.isArray(settings.hooks?.PostToolUse) ? (settings.hooks?.PostToolUse as HookEntry[]) : [];
        const managed = installed.filter(isManagedEntry);

        if (managed.length === 0) {
          issues.push(
            issue(
              "error",
              "hooks_installed.no_managed_hooks",
              `${settingsRelative} has no hooks from this skill, so artifact writes trigger no depth checks. Install them: ${installCommand}`,
              settingsRelative,
            ),
          );
        }

        const installedBySignature = new Map(managed.map((entry) => [entrySignature(entry), entry]));
        for (const shipped of template.entries) {
          const signature = entrySignature(shipped);
          const match = installedBySignature.get(signature);
          const label = shipped.hooks?.[0]?.statusMessage ?? shipped.matcher ?? "hook";
          if (!match) {
            // A same-matcher entry present but not matching means drift, not
            // absence — report it as the more actionable of the two.
            const sameMatcher = managed.some((entry) => entry.matcher === shipped.matcher);
            issues.push(
              issue(
                "error",
                sameMatcher ? "hooks_installed.hook_stale" : "hooks_installed.hook_absent",
                sameMatcher
                  ? `${settingsRelative} has a "${shipped.matcher}" hook that no longer matches the shipped "${label}" — the skill has been updated since it was installed. Refresh: ${installCommand}`
                  : `${settingsRelative} is missing the shipped "${label}" hook (matcher ${shipped.matcher}). Install it: ${installCommand}`,
                settingsRelative,
              ),
            );
            continue;
          }
          const shippedCommand = shipped.hooks?.[0]?.command ?? "";
          const installedCommand = match.hooks?.[0]?.command ?? "";
          if (shippedCommand !== installedCommand) {
            issues.push(
              issue(
                "error",
                "hooks_installed.command_drift",
                `${settingsRelative} "${label}" hook command differs from the version this skill ships. Refresh: ${installCommand}`,
                settingsRelative,
              ),
            );
          }
        }

        // Prerequisites. Warnings, not errors: this validator may not be
        // running on the machine that will run the agent.
        const skillRootRecorded = typeof settings.env?.SKILL_ROOT === "string" && settings.env.SKILL_ROOT.trim() !== "";
        if (!skillRootRecorded && !process.env.SKILL_ROOT) {
          issues.push(
            issue(
              "warning",
              "hooks_installed.skill_root_unresolved",
              `SKILL_ROOT is neither recorded in ${settingsRelative} env nor set in this environment. The hooks resolve to "." and go inactive without failing. Fix: ${installCommand} --write-skill-root`,
              settingsRelative,
            ),
          );
        }
      }
    }
  }
}

if (spawnSync("sh", ["-c", "command -v jq"], { encoding: "utf8" }).status !== 0) {
  issues.push(
    issue(
      "warning",
      "hooks_installed.jq_missing",
      "jq is not on PATH in this environment. Every shipped hook warns and exits 0 (inactive) without it: brew install jq",
      templateRelative,
    ),
  );
}

reportAndExit("Hook installation check", issues);
