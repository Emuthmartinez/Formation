/**
 * hook-contract.ts — one definition of "a hook this skill owns".
 *
 * install-hooks.ts writes them, check-hooks-installed.ts verifies them, and
 * the fixture suite round-trips them. Keeping the marker, the template path,
 * and the drift comparison in one module means an upgrade to the hook payload
 * cannot leave the installer and the validator disagreeing about what counts
 * as installed — the failure mode that made "copy this file by hand" unsafe
 * in the first place.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Marks a PostToolUse entry as owned by this skill and safe to replace on reinstall. */
export const MANAGED_MARKER = "b2c-mobile-business-launch";

export interface HookCommand {
  type?: string;
  command?: string;
  timeout?: number;
  statusMessage?: string;
}

export interface HookEntry {
  _managed?: string;
  _comment?: string;
  matcher?: string;
  hooks?: HookCommand[];
}

export interface HookSettings {
  env?: Record<string, string>;
  hooks?: { PostToolUse?: HookEntry[]; [key: string]: unknown };
  [key: string]: unknown;
}

/** Relative location of the shipped hook payload inside the skill. */
export const HOOK_TEMPLATE_RELATIVE = path.join("business", "engineering/repo-agent-entrypoints", "settings.json");

/**
 * An entry belongs to this skill when it carries the marker, or — for repos
 * installed before the marker existed — when its command text names the skill.
 * The legacy path matters: without it, a reinstall would append duplicates
 * alongside the founder's already-working hooks instead of replacing them.
 */
export function isManagedEntry(entry: HookEntry): boolean {
  if (entry?._managed === MANAGED_MARKER) {
    return true;
  }
  return (entry?.hooks ?? []).some((hook) => typeof hook?.command === "string" && hook.command.includes(MANAGED_MARKER));
}

/**
 * A stable identity for one managed entry, used to match installed against
 * shipped.
 *
 * Deliberately excludes the command text. The signature's job is to say
 * "these two entries are the same hook", so that a changed command reports as
 * drift (fix: reinstall) rather than as an absent hook plus an unexpected
 * extra one. Matcher alone is not enough — two shipped entries share
 * `Write|Edit` — so the status message, which names what the hook does and
 * changes far less often than the command body, is the discriminator.
 */
export function entrySignature(entry: HookEntry): string {
  const matcher = entry.matcher ?? "";
  const status = entry.hooks?.[0]?.statusMessage ?? "";
  return `${matcher}::${status}`;
}

export interface HookTemplate {
  entries: HookEntry[];
  error?: string;
}

/** Load the shipped hook entries from the skill, with the marker applied. */
export function readHookTemplate(skillRoot: string): HookTemplate {
  const templatePath = path.join(skillRoot, HOOK_TEMPLATE_RELATIVE);
  if (!existsSync(templatePath)) {
    return { entries: [], error: `hook template is missing at ${templatePath}.` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(templatePath, "utf8"));
  } catch (error) {
    return { entries: [], error: `hook template at ${templatePath} is not valid JSON (${(error as Error).message}).` };
  }
  const settings = parsed as HookSettings;
  const entries = settings?.hooks?.PostToolUse;
  if (!Array.isArray(entries) || entries.length === 0) {
    return { entries: [], error: `hook template at ${templatePath} has no hooks.PostToolUse entries.` };
  }
  // `_comment_setup` and any other template-only scaffolding stays behind; only
  // the entries themselves are portable into a business repo.
  return { entries: entries.map((entry) => ({ ...entry, _managed: MANAGED_MARKER })) };
}
