import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { assert, skillRoot, type Harness } from "./_harness.js";
import { laneKeys, type BusinessStateV2, type Lane, type LaneKey } from "../../core/schema/types.js";
import { compilePlan, type CatalogInput } from "../../core/engine/compile.js";
import { seedRunState } from "../../core/engine/runstate.js";
import { computeFrontier, allowAllAutonomyEvaluator } from "../../core/engine/frontier.js";
import { buildDispatchBatches } from "../../core/engine/dispatch.js";
import { founderFacingRuntimeIds, wrapWithWallClock, type SessionInvocation, type SpawnResult } from "../../core/adapters/profile.js";
import { createClaudeProfile, probeClaudeAvailability, smokeClaudeTest } from "../../core/adapters/claude.js";
import { createCodexProfile, probeCodexAvailability, smokeCodexTest } from "../../core/adapters/codex.js";
import { createCursorProfile, smokeCursorTest } from "../../core/adapters/cursor.js";
import { createInlineProfile, buildInlineHeadlessCommand } from "../../core/adapters/inline.js";
import {
  applyCrontabInstall,
  applyCrontabUninstall,
  crontabSignature,
  launchdLabel,
  launchdPlistPath,
  legacyCrontabSignature,
  legacyLaunchdLabel,
  legacyLaunchdPlistPath,
  renderCrontabLine,
  renderLaunchdPlist,
  renderWrapperScript,
  translateCronToLaunchd,
  type ScheduleOptions,
} from "../../core/adapters/install-schedule.js";
import { applyTemplateVars, ENTRYPOINT_FILES, stripManagedHookEntries, type HookSettings } from "../../core/adapters/install-entrypoints.js";
import type { RuntimeCapabilityProfile } from "../../core/adapters/profile.js";

/**
 * U6 adapter fixtures: capability profiles + headless command construction, the scheduler
 * installer, and the entrypoint installer. NO fixture here ever invokes a real vendor CLI
 * (claude/codex/cursor-agent) or the real `crontab`/`launchctl` system services — every
 * availability/smoke probe below injects a fake spawn function, and every install-schedule
 * assertion works against the pure render/apply functions or against install-schedule.ts run in
 * (default) --dry-run mode. The one real probe pass lives entirely in core/adapters/probe.ts, run
 * once by hand outside this suite.
 */

function resolveTsxBin(): string {
  const candidates = [path.join(skillRoot, "node_modules/.bin/tsx"), path.resolve(skillRoot, "../..", "node_modules/.bin/tsx")];
  return candidates.find((candidate) => existsSync(candidate)) ?? "tsx";
}
const tsxBin = resolveTsxBin();

function runCli(scriptRelative: string, args: string[]): { code: number; output: string } {
  const result = spawnSync(tsxBin, [path.join(skillRoot, scriptRelative), ...args], { cwd: skillRoot, encoding: "utf8" });
  return { code: result.status ?? -1, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

function fakeSpawn(status: number | null, stdout: string, stderr: string, error?: NodeJS.ErrnoException): () => SpawnResult {
  return () => ({ status, stdout, stderr, error });
}

function enoent(): NodeJS.ErrnoException {
  const err = new Error("spawn ENOENT") as NodeJS.ErrnoException;
  err.code = "ENOENT";
  return err;
}

const PROFILES: readonly RuntimeCapabilityProfile[] = [createClaudeProfile(), createCodexProfile(), createCursorProfile()];

function minimalBusinessState(slug: string): BusinessStateV2 {
  const lanes = {} as Record<LaneKey, Lane>;
  for (const key of laneKeys) lanes[key] = { status: "pending", evidence: [], blockers: [] };
  return {
    schemaVersion: "2.0.0",
    updatedAt: "2026-08-05T00:00:00.000Z",
    narrative: { sinceLastTime: "", rightNow: "", yourCall: "", lastCelebratedPhase: "" },
    project: { name: slug, slug, owner: "Founder", phase: "phase_0_orient", launchScope: "essentials", kickoffDate: "", platforms: ["ios"], bundleIds: { ios: "com.example.app", android: "" }, publicUrls: { landing: "", privacy: "", terms: "" } },
    lanes,
    founderGates: { pending: [] },
  };
}

function twoNodeCatalog(): CatalogInput {
  return {
    version: "catalog.adapters-fixture",
    artifacts: [
      { id: "artifact.growth-scan", path: "growth/scan.md" },
      { id: "artifact.eng-change", path: "engineering/change.log" },
    ],
    workflows: [
      { id: "workflow.growth-scan", title: "Scan what people are saying", domainId: "domain.growth", actionClass: "observe", dependencies: [], outputPaths: ["growth/scan.md"], providerIds: [], laneIds: [], founderOnlyActions: [], gateCommands: [], idempotent: true },
      { id: "workflow.eng-change", title: "Update the onboarding copy", domainId: "domain.engineering", actionClass: "mutate", dependencies: [], outputPaths: ["engineering/change.log"], providerIds: [], laneIds: [], founderOnlyActions: [], gateCommands: [], idempotent: true },
    ],
  };
}

export function register(harness: Harness): void {
  // --- profile shape: tool allowlist honesty (KTD7) -------------------------------------------

  harness.check("adapters: every founder-facing profile's toolAllowlist covers the reducer-owned paths and names its own enforcementGaps (never silent enforcement)", () => {
    for (const profile of PROFILES) {
      const patterns = profile.toolAllowlist.deniedPathPatterns;
      assert(patterns.includes("control/**"), `${profile.runtime}: deniedPathPatterns must cover control/** (control.json/grants/waivers/budget-ledger.json/manifest.json/audit.jsonl), got ${JSON.stringify(patterns)}`);
      assert(patterns.includes("state/business-state.json"), `${profile.runtime}: deniedPathPatterns must cover state/business-state.json (also reducer-owned), got ${JSON.stringify(patterns)}`);
      assert(profile.toolAllowlist.enforcementGaps.length > 0, `${profile.runtime}: a CLI-backed profile must name at least one enforcementGap rather than silently claim airtight enforcement`);
      assert(profile.authEnvVar && profile.authEnvVar.length > 0, `${profile.runtime}: must declare its own authEnvVar`);
    }
  });

  harness.check("adapters: the inline profile has no external tool surface, so an empty enforcementGaps is legitimate there and only there", () => {
    const inline = createInlineProfile();
    assert(inline.toolAllowlist.mode === "no-external-surface", `inline profile should be mode "no-external-surface", got "${inline.toolAllowlist.mode}"`);
    assert(inline.toolAllowlist.enforcementGaps.length === 0, "inline profile's enforcementGaps should be empty: it never spawns a shell or exposes a tool an LLM could misuse");
    for (const profile of PROFILES) assert(profile.toolAllowlist.mode !== "no-external-surface", `${profile.runtime} is a real CLI-backed profile and must not claim "no-external-surface"`);
  });

  // --- headless command construction: brief by path, session id + workspace present, wall-clock -

  harness.check("adapters: buildHeadlessCommand never inlines the brief's content — only its file path — and always carries session id, workspace, and the wall-clock cap through to the inner run.ts call", () => {
    const invocation: SessionInvocation = {
      workspaceDir: "/tmp/adapters-fixture-workspace",
      briefPath: "/tmp/adapters-fixture-workspace/brief.json",
      sessionId: "sess-adapters-fixture-1",
      wallClockSeconds: 1234,
    };
    const secretMarker = "founder@example.com-should-never-appear-in-argv";

    for (const profile of [...PROFILES, createInlineProfile()]) {
      const headless = profile.buildHeadlessCommand(invocation);
      const joined = headless.args.join(" \u0000 ");
      assert(!joined.includes(secretMarker), `${profile.runtime}: a brief-content marker leaked into argv (it must only ever appear inside the brief file, never inline)`);
      assert(joined.includes(invocation.briefPath), `${profile.runtime}: expected the brief PATH to appear in the constructed command, got: ${joined}`);
      assert(joined.includes(invocation.workspaceDir), `${profile.runtime}: expected the workspace dir to appear, got: ${joined}`);
      assert(joined.includes(invocation.sessionId), `${profile.runtime}: expected the session id to appear, got: ${joined}`);
      assert(joined.includes(String(invocation.wallClockSeconds)), `${profile.runtime}: expected the wall-clock cap to appear, got: ${joined}`);
      assert(headless.command.length > 0, `${profile.runtime}: headless command must name a binary to run`);
    }
  });

  harness.check("adapters: wrapWithWallClock prefers a real 'timeout' binary when present on PATH", () => {
    const invocation: SessionInvocation = { workspaceDir: "/tmp/w", briefPath: "/tmp/w/brief.json", sessionId: "sess-1", wallClockSeconds: 900 };
    const onlyTimeout = (command: string) => command === "timeout";
    for (const profile of PROFILES) {
      const headless = profile.buildHeadlessCommand(invocation);
      const wrapped = wrapWithWallClock(headless, 900, onlyTimeout);
      assert(wrapped.command === "timeout", `${profile.runtime}: expected the timeout wrapper, got command "${wrapped.command}"`);
      assert(wrapped.osLevelEnforced === true, `${profile.runtime}: expected osLevelEnforced true when 'timeout' is on PATH`);
      assert(wrapped.enforcementGap === undefined, `${profile.runtime}: expected no enforcementGap when 'timeout' is on PATH`);
      assert(wrapped.args[0] === "900s", `${profile.runtime}: expected a 900s timeout arg, got "${wrapped.args[0]}"`);
      assert(wrapped.args[1] === headless.command, `${profile.runtime}: expected the wrapped inner command to be preserved`);
    }
  });

  harness.check("adapters: wrapWithWallClock falls back to 'gtimeout' (macOS coreutils) when 'timeout' is absent but 'gtimeout' is present", () => {
    const invocation: SessionInvocation = { workspaceDir: "/tmp/w", briefPath: "/tmp/w/brief.json", sessionId: "sess-2", wallClockSeconds: 300 };
    const onlyGtimeout = (command: string) => command === "gtimeout";
    const headless = createClaudeProfile().buildHeadlessCommand(invocation);
    const wrapped = wrapWithWallClock(headless, 300, onlyGtimeout);
    assert(wrapped.command === "gtimeout", `expected the gtimeout fallback, got command "${wrapped.command}"`);
    assert(wrapped.osLevelEnforced === true, "expected osLevelEnforced true when 'gtimeout' is on PATH");
    assert(wrapped.enforcementGap === undefined, "expected no enforcementGap when a usable timeout binary is on PATH");
    assert(wrapped.args[0] === "300s" && wrapped.args[1] === headless.command, "expected gtimeout to wrap the inner command the same way timeout would");
  });

  harness.check("adapters: wrapWithWallClock emits the command unwrapped (never fails) when neither 'timeout' nor 'gtimeout' is on PATH, and names the gap", () => {
    const invocation: SessionInvocation = { workspaceDir: "/tmp/w", briefPath: "/tmp/w/brief.json", sessionId: "sess-3", wallClockSeconds: 120 };
    const neither = () => false;
    for (const profile of PROFILES) {
      const headless = profile.buildHeadlessCommand(invocation);
      const wrapped = wrapWithWallClock(headless, 120, neither);
      assert(wrapped.command === headless.command && wrapped.args === headless.args, `${profile.runtime}: expected the unwrapped inner command when no timeout binary is available`);
      assert(wrapped.osLevelEnforced === false, `${profile.runtime}: expected osLevelEnforced false with neither binary on PATH`);
      assert(Boolean(wrapped.enforcementGap) && /timeout/.test(wrapped.enforcementGap!), `${profile.runtime}: expected a named enforcementGap explaining the missing OS-level cap, got: ${wrapped.enforcementGap}`);
    }
  });

  harness.check("adapters: wrapWithWallClock leaves the inline profile's command untouched regardless of what's on PATH (wallClockEnforcedBy: not-applicable)", () => {
    const invocation: SessionInvocation = { workspaceDir: "/tmp/w", briefPath: "/tmp/w/brief.json", sessionId: "sess-4", wallClockSeconds: 900 };
    const inlineHeadless = buildInlineHeadlessCommand(invocation);
    const inlineWrapped = wrapWithWallClock(inlineHeadless, 900, () => false);
    assert(inlineWrapped.command === inlineHeadless.command && inlineWrapped.args === inlineHeadless.args, "inline's command should pass through wrapWithWallClock unchanged");
    assert(inlineWrapped.osLevelEnforced === false, "inline was never wrapper-enforced in the first place");
    assert(inlineWrapped.enforcementGap === undefined, "inline should never report an enforcementGap — no wrapper was ever expected for it");
  });

  // --- parity: reachability is profile-invariant; profiles differ only in concurrency ----------

  harness.check("adapters: parity — node reachability is identical across every capability profile; profiles differ only in concurrency (never in which nodes are reachable)", () => {
    const catalog = twoNodeCatalog();
    const plan = compilePlan(catalog, "2026-08-05T00:00:00.000Z");
    const businessState = minimalBusinessState("adapters-parity-fixture");
    const run = seedRunState(plan, businessState, { ownerSessionId: "adapters-fixture", ttlSeconds: 300, wallClockCapSeconds: 1800, now: "2026-08-05T00:00:00.000Z" });

    // computeFrontier does not take a profile at all — reachability is a pure function of the
    // plan/run/state/autonomy-evaluator. That is the parity guarantee, made structurally true
    // rather than merely asserted: there is no profile-shaped input for it to vary on.
    const frontier = computeFrontier(plan, run, businessState, allowAllAutonomyEvaluator);
    assert(frontier.ready.length === 2, `expected both fixture nodes ready, got ${JSON.stringify(frontier.ready)}`);

    const maxConcurrencies = new Set<number>();
    for (const profile of PROFILES) {
      const batches = buildDispatchBatches(plan, frontier.ready, profile.maxConcurrency);
      const dispatched = batches.flatMap((batch) => batch.nodeIds).sort();
      assert(JSON.stringify(dispatched) === JSON.stringify([...frontier.ready].sort()), `${profile.runtime}: dispatched node set must equal the frontier's ready set regardless of concurrency, got ${JSON.stringify(dispatched)}`);
      maxConcurrencies.add(profile.maxConcurrency);
    }
    assert(maxConcurrencies.size > 1, "expected at least two distinct maxConcurrency values across profiles — otherwise this parity test can't tell 'differs only in concurrency' from 'differs in nothing'");
  });

  // --- auth-expiry simulation: named failure, never a silent no-op -----------------------------

  harness.check("adapters: an auth failure from the smoke test is classified as a named auth_failed result, not a silent no-op or a generic crash", () => {
    const claudeAuthFail = smokeClaudeTest(fakeSpawn(1, "", "Error: Invalid API key. Please log in again."));
    assert(claudeAuthFail.status === "auth_failed", `expected auth_failed, got "${claudeAuthFail.status}": ${claudeAuthFail.detail}`);
    assert(claudeAuthFail.detail.length > 0, "an auth failure must carry a non-empty detail string, not just a bare status");

    const codexAuthFail = smokeCodexTest(fakeSpawn(1, "", "401 Unauthorized: token expired"));
    assert(codexAuthFail.status === "auth_failed", `expected auth_failed for codex, got "${codexAuthFail.status}"`);

    const cursorAuthFail = smokeCursorTest(fakeSpawn(1, "", "not logged in — run `cursor-agent login`"));
    assert(cursorAuthFail.status === "auth_failed", `expected auth_failed for cursor, got "${cursorAuthFail.status}"`);
  });

  harness.check("adapters: a missing CLI is classified as not_found (never confused with an auth failure), and a real success is classified as available/ok", () => {
    const missing = probeClaudeAvailability(fakeSpawn(null, "", "", enoent()));
    assert(missing.status === "not_found", `expected not_found for a missing binary, got "${missing.status}"`);

    const available = probeClaudeAvailability(fakeSpawn(0, "1.2.3\n", ""));
    assert(available.status === "available" && available.version === "1.2.3", `expected available/1.2.3, got ${JSON.stringify(available)}`);

    const ok = smokeClaudeTest(fakeSpawn(0, "OK\n", ""));
    assert(ok.status === "ok", `expected ok, got "${ok.status}"`);

    const genericError = probeCodexAvailability(fakeSpawn(1, "", "internal error: segfault"));
    assert(genericError.status === "error", `expected a generic error to classify as "error" (not auth_failed, not not_found), got "${genericError.status}"`);
  });

  // --- install-schedule: dry-run content, uninstall-exactly-reverses ---------------------------

  harness.check("adapters/install-schedule: renders a correct crontab line, and uninstall exactly reverses install (foreign lines survive both)", () => {
    const dir = harness.makeTempDir("schedule-cron");
    const options: ScheduleOptions = {
      workspaceDir: dir,
      runtime: "claude",
      schedule: "*/30 * * * *",
      briefPath: path.join(dir, "brief.json"),
      wallClockSeconds: 1800,
      skillRoot,
      wrapperPath: path.join(dir, "schedule", "run-claude.mts"),
      logPath: path.join(dir, "schedule", "run-claude.log"),
      workspaceSlug: "adapters-fixture-biz",
    };

    const line = renderCrontabLine(options);
    assert(line.startsWith(options.schedule), `expected the line to start with the schedule, got: ${line}`);
    assert(line.includes(options.wrapperPath), `expected the wrapper path in the line, got: ${line}`);
    assert(line.includes(`# ${crontabSignature(options)}`), `expected the signature comment, got: ${line}`);

    const foreignLine = "0 3 * * * /usr/bin/some-other-job.sh # unrelated";
    const installed = applyCrontabInstall(`${foreignLine}\n`, options);
    assert(installed.nextContent.includes(foreignLine), "install must preserve a pre-existing foreign crontab line");
    assert(installed.nextContent.includes(line), "install must add our line");

    // Reinstalling with a different schedule replaces (never duplicates) our own line.
    const changedOptions: ScheduleOptions = { ...options, schedule: "0 * * * *" };
    const reinstalled = applyCrontabInstall(installed.nextContent, changedOptions);
    const ourLines = reinstalled.nextContent.split("\n").filter((entry) => entry.includes(crontabSignature(options)));
    assert(ourLines.length === 1, `expected exactly one of our lines after reinstalling with a changed schedule, got ${ourLines.length}: ${reinstalled.nextContent}`);
    assert(ourLines[0]!.startsWith("0 * * * *"), `expected the reinstalled line to carry the new schedule, got: ${ourLines[0]}`);

    const uninstalled = applyCrontabUninstall(installed.nextContent, options);
    assert(uninstalled.nextContent === `${foreignLine}\n`, `expected uninstall to leave exactly the foreign line, got: ${JSON.stringify(uninstalled.nextContent)}`);
    assert(uninstalled.removed.length === 1 && uninstalled.removed[0] === line, "expected uninstall to report exactly the one line it removed");

    // Reversal with no foreign lines at all: install then uninstall nets back to empty.
    const cleanInstall = applyCrontabInstall("", options);
    const cleanUninstall = applyCrontabUninstall(cleanInstall.nextContent, options);
    assert(cleanUninstall.nextContent === "", `expected uninstall to exactly reverse a clean install, got: ${JSON.stringify(cleanUninstall.nextContent)}`);

    // A pre-rename install left a line tagged with the legacy skill name. Install replaces it
    // (never a second job racing the first), uninstall removes it, and foreign lines survive both.
    // The signature is pinned as a literal, never via legacyCrontabSignature(), so this fixture
    // fails if the constant drifts from what pre-rename installs actually wrote.
    const legacyLine = `${options.schedule} /usr/bin/env tsx ${options.wrapperPath} >> ${options.logPath} 2>&1 # b2c-mobile-business-launch:${options.workspaceSlug}:${options.runtime}`;
    assert(legacyCrontabSignature(options) === `b2c-mobile-business-launch:${options.workspaceSlug}:${options.runtime}`, `legacyCrontabSignature drifted from the pre-rename format: ${legacyCrontabSignature(options)}`);
    const migrated = applyCrontabInstall(`${foreignLine}\n${legacyLine}\n`, options);
    assert(!migrated.nextContent.includes(legacyCrontabSignature(options)), `install must remove the legacy-signature line, got: ${JSON.stringify(migrated.nextContent)}`);
    assert(migrated.nextContent.includes(foreignLine) && migrated.nextContent.includes(line), "install must keep the foreign line and add exactly our current-signature line");
    const legacyUninstall = applyCrontabUninstall(`${foreignLine}\n${legacyLine}\n`, options);
    assert(legacyUninstall.nextContent === `${foreignLine}\n`, `uninstall must remove a legacy-signature line, got: ${JSON.stringify(legacyUninstall.nextContent)}`);
    assert(legacyUninstall.removed.length === 1 && legacyUninstall.removed[0] === legacyLine, "uninstall must report the legacy line it removed");

    // The legacy launchd identity stays resolvable so pre-rename plists can be found and removed.
    assert(legacyLaunchdLabel(options) === `com.b2c-mobile-business-launch.${options.workspaceSlug}.${options.runtime}`, `unexpected legacy launchd label: ${legacyLaunchdLabel(options)}`);
    assert(legacyLaunchdPlistPath(options, "/tmp/fake-home").endsWith(`${legacyLaunchdLabel(options)}.plist`), "legacy plist path must be derived from the legacy label");
  });

  harness.check("adapters/install-schedule: translates the two supported cron shapes into launchd content and cleanly reports what it cannot translate", () => {
    const everyN = translateCronToLaunchd("*/15 * * * *");
    assert(everyN.kind === "interval" && everyN.seconds === 900, `expected a 900s interval, got ${JSON.stringify(everyN)}`);

    const daily = translateCronToLaunchd("5 9 * * *");
    assert(daily.kind === "calendar" && daily.hour === 9 && daily.minute === 5, `expected a 09:05 daily calendar entry, got ${JSON.stringify(daily)}`);

    const unsupported = translateCronToLaunchd("0 0 * * 1-5");
    assert(unsupported.kind === "unsupported" && unsupported.reason.length > 0, `expected an honest unsupported reason, got ${JSON.stringify(unsupported)}`);

    const dir = harness.makeTempDir("schedule-launchd");
    const options: ScheduleOptions = {
      workspaceDir: dir,
      runtime: "codex",
      schedule: "*/15 * * * *",
      briefPath: path.join(dir, "brief.json"),
      wallClockSeconds: 900,
      skillRoot,
      wrapperPath: path.join(dir, "schedule", "run-codex.mts"),
      logPath: path.join(dir, "schedule", "run-codex.log"),
      workspaceSlug: "adapters-fixture-biz-2",
    };
    const plist = renderLaunchdPlist(options);
    assert(plist.ok, `expected a supported schedule to render, got: ${JSON.stringify(plist)}`);
    if (plist.ok) {
      assert(plist.xml.includes(launchdLabel(options)), "expected the plist to carry its own Label");
      assert(plist.xml.includes("StartInterval") && plist.xml.includes("900"), "expected a 900-second StartInterval");
      assert(plist.xml.includes(options.wrapperPath), "expected ProgramArguments to reference the wrapper script");
    }
    const badOptions: ScheduleOptions = { ...options, schedule: "0 0 * * 1-5" };
    const badPlist = renderLaunchdPlist(badOptions);
    assert(!badPlist.ok, "expected an unsupported schedule to fail plist rendering rather than silently approximate it");

    const plistPath = launchdPlistPath(options, "/tmp/adapters-fixture-home");
    assert(plistPath.startsWith("/tmp/adapters-fixture-home/Library/LaunchAgents/"), `expected the plist path under a fake home's LaunchAgents dir, got: ${plistPath}`);
    assert(plistPath.endsWith(".plist"), `expected a .plist extension, got: ${plistPath}`);
  });

  harness.check("adapters/install-schedule: the generated wrapper script builds the headless command through the same adapter module it schedules, never a re-derived duplicate", () => {
    const dir = harness.makeTempDir("schedule-wrapper");
    const options: ScheduleOptions = {
      workspaceDir: dir,
      runtime: "cursor",
      schedule: "*/10 * * * *",
      briefPath: path.join(dir, "brief.json"),
      wallClockSeconds: 600,
      skillRoot,
      wrapperPath: path.join(dir, "schedule", "run-cursor.mts"),
      logPath: path.join(dir, "schedule", "run-cursor.log"),
      workspaceSlug: "adapters-fixture-biz-3",
    };
    const script = renderWrapperScript(options);
    assert(script.includes("createCursorProfile"), `expected the wrapper to import the cursor profile factory, got:\n${script}`);
    assert(script.includes("core/adapters/cursor.ts"), "expected the wrapper to import from the cursor adapter module, not a duplicated copy");
    assert(script.includes("wrapWithWallClock"), "expected the wrapper to reuse the shared wall-clock wrapper, not reimplement timeout logic");
    assert(script.includes(JSON.stringify(options.workspaceDir)), "expected the workspace dir to be baked into the wrapper");
    assert(script.includes(String(options.wallClockSeconds)), "expected the wall-clock cap to be baked into the wrapper");
  });

  harness.check("adapters/install-schedule CLI: --dry-run (the default) prints the plan and touches no real system, for both mechanisms", () => {
    const dir = harness.makeTempDir("schedule-cli-cron");
    const result = runCli("core/adapters/install-schedule.ts", ["--workspace", dir, "--runtime", "claude", "--schedule", "*/20 * * * *", "--brief", path.join(dir, "brief.json")]);
    assert(result.code === 0, `expected exit 0, got ${result.code}: ${result.output}`);
    assert(result.output.includes("DRY RUN"), `expected a DRY RUN banner, got:\n${result.output}`);
    assert(result.output.includes("*/20 * * * *"), `expected the crontab line preview, got:\n${result.output}`);

    const uninstallResult = runCli("core/adapters/install-schedule.ts", ["--workspace", dir, "--runtime", "claude", "--schedule", "*/20 * * * *", "--brief", path.join(dir, "brief.json"), "--uninstall"]);
    assert(uninstallResult.code === 0, `expected exit 0, got ${uninstallResult.code}: ${uninstallResult.output}`);
    assert(uninstallResult.output.includes("DRY RUN"), `expected a DRY RUN banner on uninstall too, got:\n${uninstallResult.output}`);

    const launchdDir = harness.makeTempDir("schedule-cli-launchd");
    const launchdResult = runCli("core/adapters/install-schedule.ts", ["--workspace", launchdDir, "--runtime", "codex", "--schedule", "*/5 * * * *", "--brief", path.join(launchdDir, "brief.json"), "--mechanism", "launchd"]);
    assert(launchdResult.code === 0, `expected exit 0, got ${launchdResult.code}: ${launchdResult.output}`);
    assert(launchdResult.output.includes("launchd"), `expected launchd content in the preview, got:\n${launchdResult.output}`);

    const missingArgs = runCli("core/adapters/install-schedule.ts", ["--runtime", "claude"]);
    assert(missingArgs.code === 1, `expected exit 1 with a missing --workspace, got ${missingArgs.code}: ${missingArgs.output}`);
  });

  // --- install-entrypoints: template writing + hook-removal, preserving founder entries --------

  harness.check("adapters/install-entrypoints: applyTemplateVars substitutes known placeholders and leaves unknown ones intact", () => {
    const rendered = applyTemplateVars("Hello {{APP_NAME}}, welcome to {{BUSINESS_NAME}} and {{UNKNOWN_TOKEN}}.", { APP_NAME: "Ocho", BUSINESS_NAME: "Ocho Inc" });
    assert(rendered === "Hello Ocho, welcome to Ocho Inc and {{UNKNOWN_TOKEN}}.", `unexpected substitution result: ${rendered}`);
  });

  harness.check("adapters/install-entrypoints: stripManagedHookEntries removes only _managed entries and leaves every foreign entry and setting untouched", () => {
    const settings: HookSettings = {
      permissions: { allow: ["Bash(npm run test:*)"] },
      hooks: {
        PostToolUse: [
          { _managed: "formation", matcher: "Write|Edit", hooks: [{ type: "command", command: "echo managed", statusMessage: "managed hook" }] },
          { matcher: "Write|Edit", hooks: [{ type: "command", command: "echo founder-owned", statusMessage: "founder hook" }] },
        ],
      },
    };
    const stripped = stripManagedHookEntries(settings);
    assert(stripped.changed === true, "expected a change to be reported");
    assert(stripped.removedCount === 1 && stripped.preservedForeignCount === 1, `expected 1 removed / 1 preserved, got ${JSON.stringify(stripped)}`);
    const remaining = stripped.settings.hooks?.PostToolUse ?? [];
    assert(remaining.length === 1 && remaining[0]!.hooks?.[0]?.command === "echo founder-owned", `expected only the founder-owned entry to remain, got: ${JSON.stringify(remaining)}`);
    assert(JSON.stringify(stripped.settings.permissions) === JSON.stringify(settings.permissions), "expected unrelated top-level settings (permissions) to be preserved untouched");

    const noManaged: HookSettings = { hooks: { PostToolUse: [{ matcher: "Write", hooks: [{ command: "echo only-founder" }] }] } };
    const untouched = stripManagedHookEntries(noManaged);
    assert(untouched.changed === false && untouched.removedCount === 0, "expected no-op when nothing is managed");

    // Entries written before the formation rename: a stamped legacy marker, and an unstamped v1
    // entry whose command names the old skill. Both must strip. A founder-authored command that
    // merely CONTAINS the substring "formation" (here: trans-formation) must never match — the
    // command-text fallback is legacy-name-only precisely because "formation" is too short to scan for.
    const legacy: HookSettings = {
      hooks: {
        PostToolUse: [
          { _managed: "b2c-mobile-business-launch", matcher: "Write|Edit", hooks: [{ type: "command", command: "echo managed-legacy" }] },
          { matcher: "Write|Edit", hooks: [{ type: "command", command: "tsx ~/.codex/skills/b2c-mobile-business-launch/validation/run-checks.ts" }] },
          { matcher: "Write|Edit", hooks: [{ type: "command", command: "echo my-transformation-notes" }] },
        ],
      },
    };
    const legacyStripped = stripManagedHookEntries(legacy);
    assert(legacyStripped.removedCount === 2, `expected both pre-rename entries to strip, got ${JSON.stringify({ removed: legacyStripped.removedCount, preserved: legacyStripped.preservedForeignCount })}`);
    const legacyRemaining = legacyStripped.settings.hooks?.PostToolUse ?? [];
    assert(
      legacyRemaining.length === 1 && legacyRemaining[0]!.hooks?.[0]?.command === "echo my-transformation-notes",
      `a founder command containing the word formation must never be treated as managed, got: ${JSON.stringify(legacyRemaining)}`,
    );
  });

  harness.check("adapters/install-entrypoints CLI: --dry-run writes nothing; --apply writes all three v2 entrypoint files and removes only the managed hook entry from a temp target repo", () => {
    const target = harness.makeTempDir("entrypoints-target");
    mkdirSync(path.join(target, ".claude"), { recursive: true });
    writeFileSync(
      path.join(target, ".claude", "settings.json"),
      JSON.stringify(
        {
          env: { FOUNDER_OWNED: "true" },
          hooks: {
            PostToolUse: [
              { _managed: "formation", matcher: "Write|Edit", hooks: [{ type: "command", command: "echo managed-v1-hook", statusMessage: "v1 depth check" }] },
              { matcher: "Bash", hooks: [{ type: "command", command: "echo founder-custom-hook", statusMessage: "founder's own hook" }] },
            ],
          },
        },
        null,
        2,
      ),
    );

    const dryRun = runCli("core/adapters/install-entrypoints.ts", ["--target", target, "--skill-root", skillRoot]);
    assert(dryRun.code === 0, `expected exit 0, got ${dryRun.code}: ${dryRun.output}`);
    assert(dryRun.output.includes("DRY RUN"), `expected a DRY RUN banner, got:\n${dryRun.output}`);
    for (const file of ENTRYPOINT_FILES) assert(!existsSync(path.join(target, file.relativePath)), `dry-run must not have written ${file.relativePath}`);
    const settingsAfterDryRun = JSON.parse(readFileSync(path.join(target, ".claude", "settings.json"), "utf8")) as HookSettings;
    assert((settingsAfterDryRun.hooks?.PostToolUse ?? []).length === 2, "dry-run must not have modified settings.json");

    const applied = runCli("core/adapters/install-entrypoints.ts", ["--target", target, "--skill-root", skillRoot, "--apply", "--var", "APP_NAME=AdaptersFixtureApp"]);
    assert(applied.code === 0, `expected exit 0, got ${applied.code}: ${applied.output}`);

    for (const file of ENTRYPOINT_FILES) {
      const destination = path.join(target, file.relativePath);
      assert(existsSync(destination), `expected ${file.relativePath} to be written`);
    }
    const agentsContent = readFileSync(path.join(target, "AGENTS.md"), "utf8");
    assert(agentsContent.includes("AdaptersFixtureApp"), "expected the {{APP_NAME}} placeholder to be substituted in the written AGENTS.md");
    assert(!agentsContent.includes("{{APP_NAME}}"), "expected no unresolved {{APP_NAME}} placeholder once a value was supplied");
    const claudeContent = readFileSync(path.join(target, "CLAUDE.md"), "utf8");
    assert(claudeContent.includes("Read `AGENTS.md` first"), "expected the CLAUDE.md thin pointer to point at AGENTS.md");
    const cursorRules = readFileSync(path.join(target, ".cursor", "rules", "agents.mdc"), "utf8");
    assert(cursorRules.includes("AGENTS.md"), "expected the Cursor rules addendum to point back at AGENTS.md");

    const settingsAfterApply = JSON.parse(readFileSync(path.join(target, ".claude", "settings.json"), "utf8")) as HookSettings;
    const remainingHooks = settingsAfterApply.hooks?.PostToolUse ?? [];
    assert(remainingHooks.length === 1, `expected exactly one surviving PostToolUse entry, got ${remainingHooks.length}: ${JSON.stringify(remainingHooks)}`);
    assert(remainingHooks[0]!.hooks?.[0]?.command === "echo founder-custom-hook", `expected the founder-owned entry to survive untouched, got: ${JSON.stringify(remainingHooks[0])}`);
    assert(settingsAfterApply.env?.FOUNDER_OWNED === "true", "expected the unrelated env key to survive untouched");
  });

  harness.check("adapters/install-entrypoints CLI: a target with no .claude/settings.json at all still gets the three entrypoint files, with no error", () => {
    const target = harness.makeTempDir("entrypoints-target-no-settings");
    const result = runCli("core/adapters/install-entrypoints.ts", ["--target", target, "--skill-root", skillRoot, "--apply"]);
    assert(result.code === 0, `expected exit 0, got ${result.code}: ${result.output}`);
    for (const file of ENTRYPOINT_FILES) assert(existsSync(path.join(target, file.relativePath)), `expected ${file.relativePath} to be written even with no pre-existing settings.json`);
    assert(!existsSync(path.join(target, ".claude", "settings.json")), "must not invent a settings.json where the founder never had one");
  });

  harness.check("adapters/install-entrypoints CLI: --target pointing at a nonexistent directory fails loudly instead of silently no-op-ing", () => {
    const result = runCli("core/adapters/install-entrypoints.ts", ["--target", path.join(harness.tempRoot, "does-not-exist"), "--skill-root", skillRoot]);
    assert(result.code === 1, `expected exit 1, got ${result.code}: ${result.output}`);
  });

  // --- founder-facing runtime set sanity (used by parity/rehearsal work in U9/U10) -------------

  harness.check("adapters: founderFacingRuntimeIds names exactly claude/codex/cursor, and excludes inline from the parity/rehearsal set", () => {
    assert(founderFacingRuntimeIds.length === 3, `expected 3 founder-facing runtimes, got ${JSON.stringify(founderFacingRuntimeIds)}`);
    assert(!founderFacingRuntimeIds.includes("inline"), "inline must never be counted as a founder-facing runtime");
    for (const runtime of ["claude", "codex", "cursor"] as const) assert(founderFacingRuntimeIds.includes(runtime), `expected "${runtime}" in founderFacingRuntimeIds`);
  });
}
