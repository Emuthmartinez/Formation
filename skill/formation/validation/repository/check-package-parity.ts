#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { flagString, isRecord, issue, parseFlags, reportAndExit, type Issue } from "../../tooling/lib/launch-state.js";
import { auditExcludedScripts, buildAuditPlan, type AuditLayout } from "../../tooling/lib/audit-plan.js";
import { SCRIPT_ROOTS, findScriptPath, scriptBasenameFromCommand } from "../../tooling/lib/script-paths.js";

interface PackageJson {
  name?: string;
  version?: string;
  files?: string[];
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface Args {
  repoRoot: string;
  skillRoot: string;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "../..");
const defaultRepoRoot = path.resolve(defaultSkillRoot, "../..");
const args = parseArgs(process.argv.slice(2));
const issues: Issue[] = [];

const rootPackage = readJson<PackageJson>(path.join(args.repoRoot, "package.json"), "root_package");
const runtimePackage = readJson<PackageJson>(path.join(args.skillRoot, "package.json"), "runtime_package");
const rootLock = readJson<Record<string, unknown>>(path.join(args.repoRoot, "package-lock.json"), "root_package_lock");
const runtimeLock = readJson<Record<string, unknown>>(path.join(args.skillRoot, "package-lock.json"), "runtime_package_lock");
const skillVersion = readJson<{ version?: string }>(path.join(args.skillRoot, "skill-version.json"), "skill_version");

if (rootPackage.value && runtimePackage.value && skillVersion.value) {
  const expectedVersion = skillVersion.value.version;
  for (const [label, pkg] of [
    ["root package.json", rootPackage.value],
    ["runtime package.json", runtimePackage.value],
  ] as const) {
    if (pkg.version !== expectedVersion) {
      issues.push(
        issue(
          "error",
          `package_parity.${code(label)}.version_mismatch`,
          `${label} version ${pkg.version ?? "(missing)"} must match skill-version.json ${expectedVersion}.`,
          "package.json",
        ),
      );
    }
  }
}

checkLockVersion("root", rootPackage.value, rootLock.value, path.join(args.repoRoot, "package-lock.json"));
checkLockVersion("runtime", runtimePackage.value, runtimeLock.value, path.join(args.skillRoot, "package-lock.json"));

if (rootPackage.value && runtimePackage.value) {
  const rootScripts = rootPackage.value.scripts ?? {};
  const runtimeScripts = runtimePackage.value.scripts ?? {};
  for (const scriptName of requiredScriptNames(runtimeScripts)) {
    if (!rootScripts[scriptName]) {
      issues.push(issue("error", "package_parity.root_script_missing", `Root package.json must expose runtime script ${scriptName}.`, "package.json"));
    }
  }

  // The audit pipeline is defined once in lib/audit-plan.ts; both audit
  // entrypoints must route through the orchestrator, and every gate-shaped
  // script must be a plan step or an explicitly excluded script.
  for (const [label, scriptName, script] of [
    ["root audit", "audit", rootScripts.audit],
    ["root audit:ci", "audit:ci", rootScripts["audit:ci"]],
    ["runtime audit", "audit", runtimeScripts.audit],
  ] as const) {
    if (!script?.includes("run-audit.ts")) {
      issues.push(
        issue(
          "error",
          `package_parity.${code(label)}.not_orchestrated`,
          `${label} (${scriptName}) must invoke tooling/run-audit.ts so the audit pipeline stays defined in one place.`,
          "package.json",
        ),
      );
    }
  }
  if (rootScripts["audit:ci"] && !rootScripts["audit:ci"].includes("--ci")) {
    issues.push(issue("error", "package_parity.root_audit_ci.missing_ci_flag", "Root audit:ci must pass --ci to run-audit.ts.", "package.json"));
  }
  if (rootScripts.audit?.includes("--ci")) {
    issues.push(
      issue(
        "error",
        "package_parity.root_audit.unexpected_ci_flag",
        "Root audit must not pass --ci; the full audit includes maintainer-only steps.",
        "package.json",
      ),
    );
  }

  checkAuditPlanCoverage("root", "repo", rootScripts);
  checkAuditPlanCoverage("runtime", "skill", runtimeScripts);
  checkLaunchbenchValidatorParity(runtimeScripts);

  const rootDevDeps = rootPackage.value.devDependencies ?? {};
  const runtimeDevDeps = { ...(runtimePackage.value.devDependencies ?? {}), ...(runtimePackage.value.dependencies ?? {}) };
  for (const [dep, version] of Object.entries(rootDevDeps)) {
    if (!runtimeDevDeps[dep]) {
      issues.push(
        issue(
          "error",
          "package_parity.runtime_dependency_missing",
          `Runtime package.json is missing devDependency ${dep}, present in root package.json.`,
          "skill/formation/package.json",
        ),
      );
    } else if (runtimeDevDeps[dep] !== version) {
      issues.push(
        issue(
          "warning",
          "package_parity.runtime_dependency_version_drift",
          `Runtime devDependency ${dep} (${runtimeDevDeps[dep]}) differs from root (${version}).`,
          "skill/formation/package.json",
        ),
      );
    }
  }
}

if (runtimePackage.value) checkPackStandalone(runtimePackage.value);

issues.push(...rootPackage.issues, ...runtimePackage.issues, ...rootLock.issues, ...runtimeLock.issues, ...skillVersion.issues);
reportAndExit("Package parity check", issues);

/**
 * The npm-pack smoke test (layering plan R3): the skill package must be installable standalone,
 * so the tarball npm would build has to carry everything the runtime needs — and nothing
 * development-only. `npm pack --dry-run --json` is purely local (no network, no tarball on disk),
 * so this runs on every audit. Three failure modes, each watched failing before first green:
 * a missing `files` manifest (npm would ship the entire tree, node_modules excepted), a runtime
 * import left in devDependencies (standalone install crashes at first use), and a dev-only
 * directory leaking into the artifact.
 */
function checkPackStandalone(runtimePkg: PackageJson): void {
  // Synthetic parity fixtures and manifest-only copies have no package tree to pack, so the pack
  // smoke only runs where the packaged bin exists on disk. This cannot rot into a silent skip on
  // the real package: the cli fixture suite pins bin/formation.mjs's existence there, so the file
  // vanishing fails the audit through that gate instead.
  if (!existsSync(path.join(args.skillRoot, "bin", "formation.mjs"))) return;
  if (!Array.isArray(runtimePkg.files) || runtimePkg.files.length === 0) {
    issues.push(
      issue(
        "error",
        "package_parity.pack_files_manifest_missing",
        "Runtime package.json has no files manifest — npm pack would ship the whole tree (fixtures, studio, businesses) or nothing deliberate. Declare files explicitly.",
        "skill/formation/package.json",
      ),
    );
    return;
  }

  // Every package the shipped runtime imports must survive a production install.
  const runtimeDeps = runtimePkg.dependencies ?? {};
  for (const dep of ["tsx", "yaml", "@modelcontextprotocol/sdk", "zod"]) {
    if (!runtimeDeps[dep]) {
      issues.push(
        issue(
          "error",
          "package_parity.pack_runtime_dep_misfiled",
          `${dep} is imported (or execed) by shipped runtime code but is not in dependencies — a standalone install would not receive it.`,
          "skill/formation/package.json",
        ),
      );
    }
  }

  const pack = spawnSync("npm", ["pack", "--dry-run", "--json"], { cwd: args.skillRoot, encoding: "utf8", timeout: 120_000 });
  if (pack.status !== 0) {
    issues.push(
      issue(
        "error",
        "package_parity.pack_dry_run_failed",
        `npm pack --dry-run exited ${pack.status ?? "signal"}: ${(pack.stderr ?? "").trim().slice(-300)}`,
        "skill/formation/package.json",
      ),
    );
    return;
  }
  let packed: string[] = [];
  try {
    const parsed = JSON.parse(pack.stdout) as Array<{ files?: Array<{ path: string }> }>;
    packed = (parsed[0]?.files ?? []).map((file) => file.path);
  } catch {
    issues.push(
      issue("error", "package_parity.pack_output_unparseable", "npm pack --dry-run --json did not print parseable JSON.", "skill/formation/package.json"),
    );
    return;
  }

  // The artifact's load-bearing files: one representative per shipped layer, plus every address.
  const required = [
    "bin/formation.mjs",
    "bin/formation-mcp.mjs",
    "SKILL.md",
    "skill-version.json",
    "tsconfig.json",
    "catalog/generated/catalog.json",
    "core/mcp/server.ts",
    "core/session/run.ts",
    "tooling/lib/audit-plan.ts",
    "workspace/business/state/PROJECT_STATE.yaml",
    "workspace-template/repo-agent-entrypoints/AGENTS.md",
  ];
  const packedSet = new Set(packed);
  for (const file of required) {
    if (!packedSet.has(file)) {
      issues.push(
        issue(
          "error",
          "package_parity.pack_missing_file",
          `npm pack would not include ${file} — the standalone artifact is incomplete.`,
          "skill/formation/package.json",
        ),
      );
    }
  }
  for (const prefix of ["knowledge/", "validation/", "starters/"]) {
    if (!packed.some((file) => file.startsWith(prefix))) {
      issues.push(
        issue(
          "error",
          "package_parity.pack_missing_layer",
          `npm pack includes nothing under ${prefix} — a shipped layer is absent from the artifact.`,
          "skill/formation/package.json",
        ),
      );
    }
  }

  // Development-only surfaces must never ride along.
  for (const prefix of ["verification/", "content/", "studio/", "business/", "agents/", "dist/", "node_modules/"]) {
    const leaked = packed.find((file) => file.startsWith(prefix));
    if (leaked) {
      issues.push(
        issue(
          "error",
          "package_parity.pack_dev_leak",
          `npm pack would ship development-only ${leaked} — tighten the files manifest.`,
          "skill/formation/package.json",
        ),
      );
    }
  }
  if (packedSet.has("design-room.html")) {
    issues.push(
      issue("error", "package_parity.pack_dev_leak", "npm pack would ship design-room.html — tighten the files manifest.", "skill/formation/package.json"),
    );
  }
}

function parseArgs(argv: string[]): Args {
  const flags = parseFlags(argv, [
    { flags: ["--repo-root"], key: "repoRoot" },
    { flags: ["--skill-root", "--root"], key: "skillRoot" },
  ]);
  return {
    repoRoot: flagString(flags, "repoRoot") ?? defaultRepoRoot,
    skillRoot: flagString(flags, "skillRoot") ?? defaultSkillRoot,
  };
}

/**
 * Every gate-shaped script (check:*, validate:*, launchbench, audit:links,
 * test:validators) must be an audit-plan step or an explicitly excluded
 * script with a recorded reason; and every plan step must resolve to a real
 * script in this package.
 */
function checkAuditPlanCoverage(label: string, layout: AuditLayout, scripts: Record<string, string>): void {
  const plan = buildAuditPlan(layout);
  const planIds = new Set(plan.map((step) => step.id));

  const gateScripts = Object.keys(scripts).filter(
    (name) => name.startsWith("check:") || name.startsWith("validate:") || ["launchbench", "audit:links", "test:validators"].includes(name),
  );
  for (const name of gateScripts) {
    if (!planIds.has(name) && !(name in auditExcludedScripts)) {
      issues.push(
        issue(
          "error",
          `package_parity.${label}_audit_plan_gap`,
          `${label} package.json script ${name} is neither an audit-plan step nor listed in auditExcludedScripts with a reason. Add it to lib/audit-plan.ts or exclude it explicitly.`,
          "package.json",
        ),
      );
    }
  }

  for (const step of plan) {
    if (step.kind !== "tsc" && !scripts[step.id]) {
      issues.push(
        issue(
          "error",
          `package_parity.${label}_audit_step_unresolved`,
          `Audit-plan step ${step.id} has no matching script in the ${label} package.json.`,
          "package.json",
        ),
      );
    }
  }

  for (const [name, reason] of Object.entries(auditExcludedScripts)) {
    if (!reason.trim() || reason.trim().length < 20) {
      issues.push(
        issue(
          "error",
          "package_parity.audit_exclusion_reason_thin",
          `auditExcludedScripts entry ${name} needs a concrete reason (>= 20 chars).`,
          "tooling/lib/audit-plan.ts",
        ),
      );
    }
  }
}

/**
 * run-launchbench.ts rejects any scenario citing a validator outside its
 * knownValidators literal — which means a validator missing from that literal
 * can never gain scenario coverage, silently. This cross-check keeps the
 * literal in lockstep with reality in both directions: every wired check/validate
 * script must be listed, and every listed name must have a backing file under
 * one of the three script roots. Skipped quietly when run-launchbench.ts is
 * absent (synthetic fixture roots); the real skill always ships it, and the
 * launchbench audit step itself fails if it goes missing there.
 *
 * Both lookups below deliberately go through lib/script-paths.ts rather than
 * hardcoding a directory. The previous `tooling/(...)` regex did not merely
 * break when validation/business/ and validation/repository/ appeared — it stopped MATCHING, so `basename`
 * went undefined and the loop skipped every validator while still exiting 0.
 * A gate that silently grades nothing is the failure mode this whole file
 * exists to prevent, so it must not be reintroduced by a path assumption.
 */
function checkLaunchbenchValidatorParity(runtimeScripts: Record<string, string>): void {
  // Resolved, not assumed. This lookup used to hardcode tooling/, and when
  // run-launchbench.ts moved to validation/repository/ the existsSync went false and this
  // whole function returned early — silently skipping the entire allowlist
  // cross-check while still exiting 0. That is the same trap the comment above
  // describes, one directory move later, at the file-locate step instead of
  // inside the loop.
  const launchbenchRel = findScriptPath(args.skillRoot, "run-launchbench");
  if (!launchbenchRel) return;
  const launchbenchPath = path.join(args.skillRoot, launchbenchRel);
  if (!existsSync(launchbenchPath)) return;

  const source = readFileSync(launchbenchPath, "utf8");
  const literal = source.match(/const knownValidators = new Set\(\[([\s\S]*?)\]\);/);
  if (!literal) {
    issues.push(
      issue(
        "error",
        "package_parity.launchbench_allowlist_unparseable",
        "run-launchbench.ts no longer contains a parseable `const knownValidators = new Set([...])` literal; this parity check needs it to keep scenario coverage honest.",
        "tooling/run-launchbench.ts",
      ),
    );
    return;
  }
  const known = new Set([...(literal[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? ""));

  for (const [name, script] of Object.entries(runtimeScripts)) {
    if (!name.startsWith("check:") && !name.startsWith("validate:")) continue;
    const basename = scriptBasenameFromCommand(script);
    if (!basename) {
      // Two very different cases hide behind "no basename", and the old blanket
      // `continue` treated them the same — which is how a directory move could
      // turn this whole cross-check into a no-op that still exits 0.
      //
      // Legitimate: the script never invokes a .ts validator at all. validate:skill
      // is a shell step that runs a python linter, so there is nothing to cross-check.
      if (!/[\w./-]+\.ts\b/.test(script)) continue;
      // Dangerous: the command DOES name a .ts file, but not under any known
      // script root — so it is a validator we failed to place, not a shell step.
      issues.push(
        issue(
          "error",
          "package_parity.launchbench_validator_unparseable",
          `Wired validator script ${name} ("${script}") does not name a .ts file under ${SCRIPT_ROOTS.map((root) => `${root}/`).join(", ")}, so its LaunchBench coverage cannot be checked. Point it at a real script path.`,
          "package.json",
        ),
      );
      continue;
    }
    if (known.has(basename)) continue;
    issues.push(
      issue(
        "error",
        "package_parity.launchbench_validator_missing",
        `${basename} (${name}) is a wired validator but is absent from knownValidators in run-launchbench.ts — no LaunchBench scenario can cite it until it is added.`,
        "tooling/run-launchbench.ts",
      ),
    );
  }

  for (const name of known) {
    if (findScriptPath(args.skillRoot, name)) continue;
    issues.push(
      issue(
        "error",
        "package_parity.launchbench_validator_dead",
        `knownValidators entry ${name} has no backing ${name}.ts under ${SCRIPT_ROOTS.map((root) => `${root}/`).join(", ")} — scenarios citing it would pass lint while pointing at nothing.`,
        "tooling/run-launchbench.ts",
      ),
    );
  }
}

function readJson<T>(filePath: string, label: string): { value?: T; issues: Issue[] } {
  if (!existsSync(filePath)) {
    return { issues: [issue("error", `package_parity.${label}.missing`, `${label} is missing at ${filePath}.`, filePath)] };
  }
  try {
    return { value: JSON.parse(readFileSync(filePath, "utf8")) as T, issues: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { issues: [issue("error", `package_parity.${label}.invalid_json`, `${label} is not valid JSON: ${message}`, filePath)] };
  }
}

function requiredScriptNames(runtimeScripts: Record<string, string>): string[] {
  return Object.keys(runtimeScripts)
    .filter(
      (name) =>
        name.startsWith("check:") ||
        name.startsWith("validate:") ||
        name.startsWith("render:") ||
        ["test:validators", "launchbench", "audit:links"].includes(name),
    )
    .sort();
}

function checkLockVersion(label: string, pkg?: PackageJson, lock?: Record<string, unknown>, filePath?: string): void {
  const packages = lock?.packages;
  const rootPackage = isRecord(packages) ? packages[""] : undefined;
  const lockVersion = isRecord(rootPackage) && typeof rootPackage.version === "string" ? rootPackage.version : undefined;
  if (pkg?.version && lockVersion !== pkg.version) {
    issues.push(
      issue(
        "error",
        `package_parity.${label}_lock_version_mismatch`,
        `${label} package-lock root version ${lockVersion ?? "(missing)"} must match package.json ${pkg.version}.`,
        filePath,
      ),
    );
  }
}

function code(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
