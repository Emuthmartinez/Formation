import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { assert, createHarness, repoCheckoutPresent, repoRoot, skillRoot, type Harness } from "./_harness.js";
import { resolveTsxBin } from "../../tooling/lib/tsx-bin.js";
import { buildAuditPlan } from "../../tooling/lib/audit-plan.js";
import { SHARD_RESULT_MARKER, parseShardOutput } from "../../tooling/lib/shard-pool.js";

/**
 * U9 meta-tests for the audit pipeline itself (KTD10's "single-source audit plan + parity
 * enforcement" pattern): does check-package-parity.ts really reject a gate-shaped script that
 * escaped tooling/lib/audit-plan.ts, does this whole harness's own issue-code-checking mechanism
 * actually discriminate (the recorded "fixture exit-code vs issue-code assertions" trap named in
 * the plan's directory-move trap list), and is every suite file actually reachable from a
 * runner's auto-discovery.
 */

const tsxBin = resolveTsxBin(skillRoot);

function copyFile(from: string, to: string): void {
  mkdirSync(path.dirname(to), { recursive: true });
  writeFileSync(to, readFileSync(from), "utf8");
}

/**
 * A faithful COPY of the real root+skill package manifests (never a hand-rolled minimal stand-in
 * — a stand-in would need to re-derive every audit-plan step's own required script, which is
 * exactly the kind of second, driftable copy this repo's "duplicated helpers have already
 * diverged" lesson warns against). check-package-parity.ts is pointed at the copy via
 * --repo-root/--skill-root, so the real, checked-in package.json files are never touched.
 */
function buildFaithfulParityFixture(harness: Harness): { repoRoot: string; skillRoot: string } {
  const tempRepoRoot = harness.makeTempDir("audit-plan-parity-fixture");
  const tempSkillRoot = path.join(tempRepoRoot, "skill", "formation");
  for (const [from, toRelativeToRepoRoot] of [
    [path.join(repoRoot, "package.json"), "package.json"],
    [path.join(repoRoot, "package-lock.json"), "package-lock.json"],
    [path.join(skillRoot, "package.json"), "skill/formation/package.json"],
    [path.join(skillRoot, "package-lock.json"), "skill/formation/package-lock.json"],
    [path.join(skillRoot, "skill-version.json"), "skill/formation/skill-version.json"],
  ] as const) {
    copyFile(from, path.join(tempRepoRoot, toRelativeToRepoRoot));
  }
  return { repoRoot: tempRepoRoot, skillRoot: tempSkillRoot };
}

function runCheckPackageParity(args: string[]): { code: number; output: string } {
  const result = spawnSync(tsxBin, [path.join(skillRoot, "validation/repository/check-package-parity.ts"), ...args], { cwd: skillRoot, encoding: "utf8" });
  return { code: result.status ?? -1, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

export function register(harness: Harness): void {
  // --- audit-plan parity: a check:* script the plan doesn't know about must fail the gate -------

  // These two read the repository's own package.json/package-lock.json to build their fixture.
  // An installed runtime has neither above it, so from there the subject is absent rather than
  // wrong — skip with the reason instead of failing every `npm run sync:runtime`.
  const parityCase: (label: string, fn: () => void) => void = repoCheckoutPresent()
    ? harness.check
    : (label) => harness.skip(label, `repo-only: no repository manifests at ${repoRoot} (installed runtime)`);

  parityCase("audit-plan parity: a faithful copy of the real manifests passes check-package-parity cleanly (the positive control for the next case)", () => {
    const fixture = buildFaithfulParityFixture(harness);
    const result = runCheckPackageParity(["--repo-root", fixture.repoRoot, "--skill-root", fixture.skillRoot]);
    assert(result.code === 0, `expected a faithful, unmutated copy of the real manifests to pass check-package-parity, got ${result.code}:\n${result.output}`);
  });

  parityCase(
    "audit-plan parity: a check:* script not in tooling/lib/audit-plan.ts's plan (and not explicitly excluded) fails check-package-parity with a named reason",
    () => {
      const fixture = buildFaithfulParityFixture(harness);
      const rootPackagePath = path.join(fixture.repoRoot, "package.json");
      const rootPackage = JSON.parse(readFileSync(rootPackagePath, "utf8")) as { scripts: Record<string, string> };
      // A script name that cannot already exist in the real plan/exclusion list, so this can never
      // pass by accident of the real audit-plan.ts's own current contents.
      rootPackage.scripts["check:u9-audit-plan-parity-fixture-probe"] = "tsx tooling/does-not-exist.ts";
      writeFileSync(rootPackagePath, `${JSON.stringify(rootPackage, null, 2)}\n`, "utf8");

      const result = runCheckPackageParity(["--repo-root", fixture.repoRoot, "--skill-root", fixture.skillRoot]);
      assert(result.code !== 0, `expected the parity check to fail once an unregistered check:* script was added, got exit ${result.code}`);
      assert(result.output.includes("package_parity.root_audit_plan_gap"), `expected the specific audit_plan_gap issue code, got:\n${result.output}`);
      assert(
        result.output.includes("check:u9-audit-plan-parity-fixture-probe"),
        `expected the offending script name to be named in the output, got:\n${result.output}`,
      );
    },
  );

  // --- the issue-code-checking trap: prove the harness's own mechanism discriminates -------------

  harness.check(
    "harness/runScript: genuinely discriminates on issue TEXT, not just exit code — the recorded 'fixture exit-code vs issue-code assertions' trap, proven non-vacuous here",
    () => {
      // A throwaway harness, not the shared one: this deliberately runs one case with the WRONG
      // expected text so it can inspect the *result*, not let a deliberate mismatch count as a real
      // suite failure.
      const probe = createHarness(path.join(skillRoot, "core/schema"));
      try {
        const script = path.join(skillRoot, "catalog/render-routing.ts");
        // Right exit code (0), right text expectation: should read as ok.
        probe.runScript("control: --check should pass with a correct expectation", script, ["--check"], 0, "current");
        // Right exit code (0), WRONG text expectation: must read as a FAILURE — this is exactly the
        // trap. A harness that only compared exit codes would call this "ok" too, which would mean a
        // validator failing for the wrong reason could still satisfy a fixture that only checks exit
        // code. Real tests never assert this shape (its whole job is to prove the discrimination
        // exists), so this doesn't count as suite coverage of --check itself.
        probe.runScript(
          "control: --check with a deliberately wrong expectation must be reported as a failure",
          script,
          ["--check"],
          0,
          "this text will never appear in render-routing's output",
        );

        assert(probe.results.length === 2, `expected exactly 2 probe results, got ${probe.results.length}`);
        assert(probe.results[0]!.ok === true, `expected the correctly-expected case to read ok, got: ${JSON.stringify(probe.results[0])}`);
        assert(
          probe.results[1]!.ok === false,
          `expected the wrongly-expected case to read as a failure even though the exit code matched — if this is true, the harness is NOT vacuously trusting exit codes`,
        );
      } finally {
        probe.cleanup();
      }
    },
  );

  // --- all suites registered: every runner-discoverable file exports register(), and every ------
  // --- verification/scenarios/ file is actually wired into scenarios.fixtures.ts -----------------

  harness.check("all suites registered: every *.fixtures.ts / *.boundaries.ts / *.parity.ts file exports a register(harness) function", () => {
    const roots: Array<{ dir: string; suffix: string }> = [
      { dir: path.join(skillRoot, "verification/fixtures"), suffix: ".fixtures.ts" },
      { dir: path.join(skillRoot, "verification/boundaries"), suffix: ".boundaries.ts" },
      { dir: path.join(skillRoot, "verification/parity"), suffix: ".parity.ts" },
    ];
    let checkedCount = 0;
    for (const { dir, suffix } of roots) {
      for (const fileName of readdirSync(dir)) {
        if (!fileName.endsWith(suffix)) continue;
        checkedCount += 1;
        const source = readFileSync(path.join(dir, fileName), "utf8");
        assert(
          /export function register\(/.test(source),
          `${path.join(path.basename(dir), fileName)} does not export register(harness) — the runner's auto-discovery would silently error at import time instead of registering real coverage`,
        );
      }
    }
    assert(checkedCount >= 3, `expected to check at least 3 suite files across fixtures/boundaries/parity, checked ${checkedCount}`);
  });

  harness.check(
    "all suites registered: every file under verification/scenarios/ (the LaunchBench port) is imported and registered by verification/fixtures/scenarios.fixtures.ts",
    () => {
      const scenariosDir = path.join(skillRoot, "verification/scenarios");
      const registrySource = readFileSync(path.join(skillRoot, "verification/fixtures/scenarios.fixtures.ts"), "utf8");
      const scenarioFiles = readdirSync(scenariosDir).filter((name) => name.endsWith(".ts") && !name.startsWith("_"));
      assert(scenarioFiles.length > 0, "expected at least one ported scenario file under verification/scenarios/");
      for (const fileName of scenarioFiles) {
        const moduleStem = fileName.replace(/\.ts$/, "");
        assert(
          registrySource.includes(`../scenarios/${moduleStem}.js`),
          `verification/scenarios/${fileName} exists but is not imported by scenarios.fixtures.ts — it would silently never run`,
        );
      }
    },
  );

  // --- shard-pool: the audit's two slow steps parallelize INSIDE their runners ------------------

  harness.check(
    "shard-pool: launchbench and test:fixtures stay serial:true in both audit-plan layouts — their parallelism lives inside the runner (tooling/lib/shard-pool.ts), and letting them also ride the 4-wide audit pool would multiply the process fan-out",
    () => {
      for (const layout of ["repo", "skill"] as const) {
        for (const id of ["launchbench", "test:fixtures"]) {
          const step = buildAuditPlan(layout).find((candidate) => candidate.id === id);
          assert(step !== undefined, `expected ${id} to be a step in the ${layout} audit plan`);
          assert(step.serial === true, `${id} must stay serial:true in the ${layout} plan — see the shard-pool doc comment before "fixing" this`);
        }
      }
    },
  );

  harness.check(
    "shard-pool: parseShardOutput distinguishes crashed-before-reporting (results undefined) from reported results — the load-bearing crash-representation property of the sharded runners",
    () => {
      const reported = parseShardOutput(`stray diagnostics\n${SHARD_RESULT_MARKER}[{"label":"x","ok":true}]\ntrailing noise`);
      assert(Array.isArray(reported.results) && reported.results.length === 1, "expected the marker payload to parse to exactly one result");
      assert(!reported.output.includes(SHARD_RESULT_MARKER), "expected the marker line to be stripped from the diagnostic output");
      const crashed = parseShardOutput("boom: a stack trace and no marker line\n");
      assert(crashed.results === undefined, "a shard with no marker line must parse as crashed (undefined results), never as empty-and-passing");
      const malformed = parseShardOutput(`${SHARD_RESULT_MARKER}{not json]`);
      assert(malformed.results === undefined, "a malformed marker payload must parse as crashed (undefined results), never as empty-and-passing");
    },
  );

  harness.runScript(
    "shard-pool: the validator-fixture runner rejects an unknown --shard name with a named error instead of reporting an empty pass",
    path.join(skillRoot, "validation/repository/run-validator-fixtures.ts"),
    ["--shard", "no-such-module"],
    1,
    "Unknown fixture module",
  );
}
