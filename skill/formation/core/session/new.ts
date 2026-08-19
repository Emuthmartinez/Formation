#!/usr/bin/env node
/**
 * formation new — a fresh business's birthplace (layering plan R5).
 *
 * Before this command, `bootstrap` could only migrate a workspace that already existed, so a
 * consumer arriving with nothing had no first step. `new` scaffolds one from the package's own
 * reference seed (workspace/business — the same tree check:engine-e2e drives on every audit, so
 * the seed cannot rot silently) plus the repo agent entrypoints, stamps the founder's slug and
 * display name into the v1 state file, and prints the exact commands that make it runnable.
 *
 *   formation new <slug> [--dir <path>] [--name "Display Name"]
 *
 * The slug obeys the workspace-registry rule (^[a-z0-9][a-z0-9-]*$) so the same identifier works
 * for the directory, the registry id, and the engine's slug checks. Generated projections
 * (dist/) are not copied — they are re-rendered from real state, and a fresh business inheriting
 * the reference's rendered pages would show another product's name.
 *
 * Product archetype starters (starters/) are deliberately NOT copied here: the app repository is
 * the engineering nodes' work, produced during the run — the workspace holds business state, not
 * app code.
 *
 * Exit codes: 0 = scaffolded; 1 = invalid slug, occupied target, or seed drift.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMainModule } from "../lib/cli.js";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SLUG_RULE = /^[a-z0-9][a-z0-9-]*$/;
const SEED_NAME = 'name: "App Name"';
const SEED_SLUG = 'slug: "app-name"';

function callerCwd(): string {
  return process.env.FORMATION_CALLER_CWD?.trim() || process.cwd();
}

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function main(): number {
  const argv = process.argv.slice(2);
  const VALUE_FLAGS = new Set(["--dir", "--name", "--slug"]);
  const slug = argv.find((token, index) => !token.startsWith("--") && !VALUE_FLAGS.has(argv[index - 1] ?? "")) ?? (argv.includes("--slug") ? argv[argv.indexOf("--slug") + 1] : undefined);
  const flagValue = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  if (!slug || !SLUG_RULE.test(slug)) {
    console.error('Usage: formation new <slug> [--dir <path>] [--name "Display Name"] — slugs are lowercase letters, digits, and hyphens');
    return 1;
  }
  const name = flagValue("--name") ?? titleCase(slug);
  const target = path.resolve(callerCwd(), flagValue("--dir") ?? slug);

  if (existsSync(target) && readdirSync(target).length > 0) {
    console.error(`ISSUE new.target_occupied: ${target} exists and is not empty — new never writes over anything.`);
    return 1;
  }

  const seed = path.join(skillRoot, "workspace", "business");
  const statePath = path.join(seed, "state", "PROJECT_STATE.yaml");
  const seedState = readFileSync(statePath, "utf8");
  if (!seedState.includes(SEED_NAME) || !seedState.includes(SEED_SLUG)) {
    console.error(`ISSUE new.seed_drift: the reference seed at ${statePath} no longer carries ${SEED_NAME} / ${SEED_SLUG} — update new.ts's stamping to match the seed.`);
    return 1;
  }

  mkdirSync(target, { recursive: true });
  cpSync(seed, target, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(seed, source);
      return relative !== "dist" && !relative.startsWith(`dist${path.sep}`);
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const stamped = readFileSync(path.join(target, "state", "PROJECT_STATE.yaml"), "utf8")
    .replace(SEED_NAME, `name: "${name}"`)
    .replace(SEED_SLUG, `slug: "${slug}"`)
    .replace(/^updated_at: ".*"$/m, `updated_at: "${today}"`);
  writeFileSync(path.join(target, "state", "PROJECT_STATE.yaml"), stamped, "utf8");

  const templates = path.join(skillRoot, "workspace-template", "repo-agent-entrypoints");
  for (const file of ["AGENTS.md", "CLAUDE.md"]) {
    const source = path.join(templates, file);
    if (existsSync(source)) cpSync(source, path.join(target, file));
  }

  console.log(
    [
      `CREATED ${target} — "${name}" (${slug})`,
      "",
      "Next steps:",
      `  1. Make it runnable:            formation bootstrap --workspace ${target} --apply --answers <answers.json>`,
      `  2. Let this machine address it: formation workspaces register ${slug} ${target}`,
      `  3. See the frontier:            formation plan --workspace ${target}`,
      "",
      "The app repository itself is built by the run's engineering nodes (archetype starters ship in the package under starters/).",
    ].join("\n"),
  );
  return 0;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = main();
}
