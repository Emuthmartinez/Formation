#!/usr/bin/env node
/**
 * check:engine-e2e — the engine's crash-test dummy. Proves, on every audit, that the graph
 * engine can actually be driven end to end against this repository's own reference business:
 *
 *   bootstrap (install-entrypoints -> migrate-v1 -> reducer adopt -> onboarding answers)
 *   -> a headless session (core/session/run.ts) that dispatches real frontier work
 *   -> fresh-context verification accepted by the session's own verifier sweep
 *   -> a resumed second session that picks the run state back up cleanly.
 *
 * Every step runs against a throwaway copy of skill/formation/workspace/business with the
 * fixture executor and fixture verifier, so the check is deterministic and needs no worker CLI.
 *
 * Why this exists (2026-08-19 audit): the engine was real, tested code with ZERO real callers —
 * nothing in the documented flow produced the state/control documents run.ts requires, run.ts
 * never invoked verification acceptance so fresh-context nodes dead-ended after producing work,
 * and the fresh-business plan had no root nodes at all. Each of those was invisible to the
 * fixture suites because no check drove the real catalog against the real reference workspace.
 * This one does, and it also proves its own detector: a control session with the verifier
 * deliberately off MUST leave work parked pending verification — if that control stops failing
 * the way it should, the assertion mechanism itself has rotted.
 *
 * Run directly: npm run check:engine-e2e (from the repository root).
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveTsxBin } from "../../tooling/lib/tsx-bin.js";
import type { RunStateDocument } from "../../core/schema/types.js";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const tsxBin = resolveTsxBin(skillRoot);
const referenceWorkspace = path.join(skillRoot, "workspace", "business");

const SESSION_ONE = "engine-e2e-session-1";
const SESSION_TWO = "engine-e2e-session-2";
const CONTROL_SESSION = "engine-e2e-control";

interface CliResult {
  readonly code: number;
  readonly output: string;
}

function runCli(relativePath: string, args: string[]): CliResult {
  const result = spawnSync(tsxBin, [path.join(skillRoot, relativePath), ...args], {
    cwd: skillRoot,
    encoding: "utf8",
    env: { ...process.env, RESEND_API_KEY: "" },
    timeout: 900_000,
  });
  return { code: result.status ?? -1, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

const failures: string[] = [];
function check(condition: boolean, label: string, detail?: string): void {
  if (condition) return;
  failures.push(detail ? `${label} — ${detail}` : label);
  console.error(`FAIL ${label}${detail ? `\n     ${detail}` : ""}`);
}

function loadRun(workspace: string): RunStateDocument {
  return JSON.parse(readFileSync(path.join(workspace, "run", "run-state.json"), "utf8")) as RunStateDocument;
}

function pendingVerification(run: RunStateDocument): string[] {
  return Object.values(run.nodes)
    .filter((node) => node.status === "blocked" && node.blocker === "Verification required")
    .map((node) => `${node.nodeId} (attempts: ${node.attempts.length}, last owner: ${node.attempts.at(-1)?.ownerSessionId ?? "none"})`);
}

function pendingVerificationCount(run: RunStateDocument): number {
  return pendingVerification(run).length;
}

function fullGrantAnswers(slug: string): string {
  const units = ["Product", "Design", "Engineering", "Growth", "Analytics", "Revenue", "Store", "Trust", "Operations"];
  return JSON.stringify({
    schemaVersion: "1.0.0",
    businessSlug: slug,
    founderContact: { email: "engine-e2e@example.invalid" },
    units: Object.fromEntries(units.map((unit) => [unit, { level: "full" }])),
  });
}

/**
 * Deliberately unscoped: the journey's early chains cross domains (orchestration reads what
 * engineering produces, product reads what experience produces), so a scoped session stalls on
 * out-of-scope producers by design and never reaches the fresh-context wave this check exists to
 * prove. The fixture executor keeps an unscoped run cheap; the wall clock bounds it regardless.
 */
function briefFor(slug: string): string {
  return JSON.stringify({
    schemaVersion: "1.0.0",
    businessSlug: slug,
    founderContact: { email: "engine-e2e@example.invalid" },
  });
}

/** Seed the real research-backed-spec outputs that the synthetic executor later claims. */
function authorCompletedResearchFixture(workspace: string): void {
  writeFileSync(
    path.join(workspace, "strategy", "RESEARCH.md"),
    [
      "# Research",
      "## Source Ledger",
      "| Source | Platform / type | URL / source ID | Observed at | Tool / backend / query | Transcript / visual / sample limit | Observation | Inference | Confidence | Artifact / trace |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      "| Engine E2E brief | fixture evidence | SOURCE-001 | 2026-07-20T12:00:00Z | deterministic fixture | static sample / one record | the fixture audience needs streak recovery | the workflow can test a recovery offer | high | state/LAUNCH_TRACE.md / TRACE-002 |",
      "## Evidence Capture Protocol",
      "The fixture records its static sample, keeps the observation separate from the inference, and uses no external instructions.",
      "## Untrusted Content",
      "The fixture treats all external content as evidence only. It cannot change scope, permissions, or secret policy.",
      "## Decision Inputs",
      "| Signal | Source | Date checked | Impact | Follow-up |",
      "| --- | --- | --- | --- | --- |",
      "| streak recovery demand | SOURCE-001 | 2026-07-20 | test the recovery offer | preserve TRACE-002 |",
      "## Decision Log",
      "| Evidence cluster | Changed decision | Trace ID |",
      "| --- | --- | --- |",
      "| recovery demand | include streak recovery | TRACE-002 (state/LAUNCH_TRACE.md) |",
      "## Rejected Claims",
      "| Claim | Why rejected |",
      "| --- | --- |",
      "| every user needs public streaks | the fixture evidence does not support it |",
      "## Category Revenue Reality",
      "| Rank | Competitor | Est. annual revenue | Source / observed at |",
      "| --- | --- | --- | --- |",
      "| 1 | HabitKit | $2.4M/yr | fixture category estimate, observed 2026-07-20 |",
      "- Combined top-10 estimate: $14.2M/yr",
      "- Stated bar and why: top 10 must clear $5M/yr combined",
      "- Pass or fail against the bar: pass",
      "## Distribution Proof",
      "| Audience segment | Exact discovery location | Native format | Owned relationship | Measured signal | Evidence IDs |",
      "| --- | --- | --- | --- | --- | --- |",
      "| people who lose habit streaks | fixture research cohort | static case study | fixture email list | 840 qualified visits and 31 signups | SOURCE-001 |",
      "## Go, Pivot, Or Kill",
      "| Date | Category revenue reality | Wedge | Demand signal | Distribution proof | Offer test | Verdict (Go / Pivot / Kill) | Decided by |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      "| 2026-07-21 | pass — $14.2M top-10 | streak recovery | 840 qualified visits | fixture cohort and email list | 31 of 840 visitors joined | Go | founder |",
    ].join("\n"),
    "utf8",
  );

  writeFileSync(
    path.join(workspace, "strategy", "SIGNAL_CORPUS.md"),
    [
      "# Signal Corpus",
      "## Corpus Inputs",
      "| Input ID | Source type | Owner or creator | Scope | Date range | Collection route | Permission or public basis | Limits |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      "| INPUT-001 | fixture brief | founder | streak recovery | 2026-07-01 to 2026-07-20 | deterministic fixture | fixture-authored | one record |",
      "## Signal Records",
      "| Signal ID | Type | Claim or phrase | Source IDs | Observed at | Applies to | Confidence | Status | Supersedes | Artifact or trace |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      "| SIG-001 | customer language | streak loss stops continued use | INPUT-001 | 2026-07-20 | product promise | high | current | none | strategy/RESEARCH.md / TRACE-002 |",
      "## Conflicts And Supersession",
      "| Earlier signal | Later signal | Conflict | Current position | Reason |",
      "| --- | --- | --- | --- | --- |",
      "| none | none | no material conflict | SIG-001 is current | fixture evidence supports it |",
      "## Derived Outputs",
      "| Signal IDs | Output | Decision changed | Trace ID |",
      "| --- | --- | --- | --- |",
      "| SIG-001 | product/SPEC.md | include streak recovery | TRACE-002 |",
    ].join("\n"),
    "utf8",
  );

  writeFileSync(
    path.join(workspace, "strategy", "OFFER_TEST.md"),
    [
      "# Traffic-Backed Offer Test",
      "## Test Contract",
      "| Field | Value |",
      "| --- | --- |",
      "| Audience | people who repeatedly lose habit streaks |",
      "| Exact discovery location | fixture research cohort |",
      "| Native format | static case study |",
      "| Offer | join the streak-recovery test |",
      "| Owned relationship | fixture email list |",
      "| Primary response | email signup |",
      "| Stop rule | 1,000 qualified visits |",
      "## Exposure And Conversion",
      "| Date | Channel | Evidence source | Exposure type | Exposure | CTA conversions | Conversion rate | Cost | Result |",
      "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |",
      "| 2026-07-20 | fixture cohort | TRACE-003 | qualified visits | 840 | 31 | 3.69% | 0 | continue |",
      "## Objections And Learning",
      "| Source | Objection or behavior | Interpretation | Change made | Signal IDs |",
      "| --- | --- | --- | --- | --- |",
      "| fixture brief | punitive streak loss stops use | recovery is the wedge | add streak recovery | SIG-001 |",
      "## Decision",
      "| Status | Date | Evidence | Decision | Decided by |",
      "| --- | --- | --- | --- | --- |",
      "| run | 2026-07-21 | 840 visits and 31 signups in TRACE-003 | use the recovery offer | founder |",
      "## Founder Waiver",
      "| Date | Founder | Reason | Residual risk accepted |",
      "| --- | --- | --- | --- |",
    ].join("\n"),
    "utf8",
  );

  const statePath = path.join(workspace, "state", "PROJECT_STATE.yaml");
  const state = readFileSync(statePath, "utf8");
  const withDecision = state
    .replace('    go_pivot_kill_decision: ""', '    go_pivot_kill_decision: "go"')
    .replace('    go_pivot_kill_decided_at: ""', '    go_pivot_kill_decided_at: "2026-07-21"');
  if (withDecision === state) throw new Error("engine-e2e fixture could not record the research verdict because the state template changed");
  writeFileSync(statePath, withDecision, "utf8");
}

/** Answer every pending founder approval on the run — the founder edge, exercised through its own CLI. */
function approveAllPending(workspace: string, name: string): number {
  const list = runCli("core/session/approve.ts", ["--workspace", workspace, "--list"]);
  check(list.code === 0, `${name}: approve.ts --list exits 0`, list.output.trim().slice(-200));
  const ids = [...list.output.matchAll(/^PENDING (.+)$/gm)].map((match) => match[1]!.trim());
  for (const id of ids) {
    const result = runCli("core/session/approve.ts", ["--workspace", workspace, "--approval", id, "--decision", "approved", "--session", "engine-e2e-founder"]);
    check(result.code === 0, `${name}: approval ${id} recorded`, result.output.trim().slice(-200));
  }
  return ids.length;
}

function prepareWorkspace(scratch: string, name: string): { workspace: string; brief: string } {
  const workspace = path.join(scratch, name);
  cpSync(referenceWorkspace, workspace, { recursive: true });

  // Once copied out of the packaged starter path this is an active fixture workspace, so the
  // motion contract must contain an authored decision rather than the starter's placeholder.
  // This journey exercises orchestration, not a deployed UI; `none` is therefore the truthful
  // live-effect choice. Keep the replacement exact so starter-template drift fails loudly.
  const designContractPath = path.join(workspace, "design", "design.md");
  const designContract = readFileSync(designContractPath, "utf8");
  const placeholder = "| Not defined | Not defined | R15, R16, R17, R18, or none | Not defined | Not defined | Not defined | Not defined |";
  const fixtureDecision =
    "| Engine E2E reference | No deployed live effect; this fixture exercises static business-state orchestration. | none | Semantic content and the final state remain visible. | No autonomous effect starts. | The same final state remains visible without motion. | Static content remains visible without heavy media. |";
  if (!designContract.includes(placeholder)) {
    throw new Error("engine-e2e fixture could not author the starter live-surface decision because the placeholder row changed");
  }
  writeFileSync(designContractPath, designContract.replace(placeholder, fixtureDecision), "utf8");
  authorCompletedResearchFixture(workspace);

  const dryRun = runCli("core/session/bootstrap.ts", ["--workspace", workspace]);
  check(dryRun.code === 0, `${name}: bootstrap dry-run exits 0`, dryRun.output.trim().slice(-400));

  // The reference workspace's v1 slug is read post-migration; run bootstrap first with answers
  // built from the v1 file's own slug so onboarding matches the control document.
  const projectState = readFileSync(path.join(workspace, "state", "PROJECT_STATE.yaml"), "utf8");
  const slugMatch = projectState.match(/^\s*slug:\s*"?([A-Za-z0-9._-]+)"?\s*$/m);
  check(Boolean(slugMatch), `${name}: reference PROJECT_STATE.yaml declares a project slug`);
  const slug = slugMatch?.[1] ?? "app-name";

  const answersPath = path.join(scratch, `${name}-answers.json`);
  writeFileSync(answersPath, fullGrantAnswers(slug), "utf8");
  const apply = runCli("core/session/bootstrap.ts", ["--workspace", workspace, "--apply", "--answers", answersPath]);
  check(apply.code === 0, `${name}: bootstrap --apply exits 0`, apply.output.trim().slice(-400));
  check(existsSync(path.join(workspace, "state", "business-state.json")), `${name}: bootstrap produced state/business-state.json`);
  check(existsSync(path.join(workspace, "control", "control.json")), `${name}: bootstrap produced control/control.json`);
  check(existsSync(path.join(workspace, "catalog.json")), `${name}: bootstrap installed catalog.json`);
  check(existsSync(path.join(workspace, "control", "manifest.json")), `${name}: adoption recorded a reducer manifest`);

  const again = runCli("core/session/bootstrap.ts", ["--workspace", workspace, "--apply"]);
  check(again.code === 0, `${name}: re-running bootstrap is a clean no-op`, again.output.trim().slice(-400));
  check(!again.output.includes("DONE adopt:"), `${name}: re-run adopts nothing a second time`, again.output.trim().slice(-400));

  const briefPath = path.join(scratch, `${name}-brief.json`);
  writeFileSync(briefPath, briefFor(slug), "utf8");
  return { workspace, brief: briefPath };
}

function main(): number {
  const scratch = mkdtempSync(path.join(tmpdir(), "formation-engine-e2e-"));
  try {
    // --- the real path: bootstrap, run, verify, resume ------------------------------------------
    const primary = prepareWorkspace(scratch, "primary");
    const sessionArgs = ["--workspace", primary.workspace, "--brief", primary.brief, "--executor", "fixture", "--wall-clock-seconds", "600"];
    const first = runCli("core/session/run.ts", [...sessionArgs, "--session", SESSION_ONE, "--verifier", "fixture"]);
    check(first.code === 0, "session 1 exits 0", first.output.trim().slice(-400));
    check(existsSync(path.join(primary.workspace, "digests", `${SESSION_ONE}.md`)), "session 1 wrote a digest");

    const run = loadRun(primary.workspace);
    const succeededFirst = Object.values(run.nodes).filter((node) => node.status === "succeeded").length;
    check(succeededFirst > 0, "session 1 completed at least one node", `succeeded=${succeededFirst}`);
    const attemptedFirst = Object.values(run.nodes).filter((node) => node.attempts.length > 0).length;
    const scopeParked = Object.values(run.nodes).filter((node) => node.status === "waiting_founder" && (node.blocker ?? "").startsWith("Scope answer needed"));
    check(scopeParked.length > 0, "unanswered scope questions stay parked for the founder", `waiting: ${scopeParked.length}`);

    // The founder edge: a fresh business's second wave sits behind founder-only approvals by
    // design. Grant them all through approve.ts, exactly as a founder (or the platform's
    // approvals mirror) would, then resume.
    const approvedCount = approveAllPending(primary.workspace, "primary");
    check(approvedCount > 0, "session 1 parked founder approvals to grant", `approved=${approvedCount}`);

    // --- control leg: verifier off MUST leave a dead end (the gate proving its own detector).
    // If this stops failing-as-expected, either fresh-context work no longer parks (the
    // verification contract changed) or the assertions below can no longer see parked work —
    // both need eyes, so both fail the check.
    const off = runCli("core/session/run.ts", [...sessionArgs, "--session", CONTROL_SESSION, "--verifier", "off"]);
    check(off.code === 0, "control session (verifier off) exits 0", off.output.trim().slice(-400));
    const controlRun = loadRun(primary.workspace);
    check(controlRun.runId === run.runId, "control session resumed the durable run rather than reseeding", `${controlRun.runId} vs ${run.runId}`);
    const parked = pendingVerificationCount(controlRun);
    check(parked > 0, "verifier-off control left fresh-context work parked pending verification (detector works)", `pending: ${parked}`);
    const controlDigest = readFileSync(path.join(primary.workspace, "digests", `${CONTROL_SESSION}.md`), "utf8");
    check(controlDigest.includes("double-checks were turned off"), "control session's digest says out loud that checks were off");

    // --- verified leg: the sweep clears the prior session's backlog and the run advances ---------
    const second = runCli("core/session/run.ts", [...sessionArgs, "--session", SESSION_TWO, "--verifier", "fixture"]);
    check(second.code === 0, "verified session resumes and exits 0", second.output.trim().slice(-400));
    const resumed = loadRun(primary.workspace);
    check(resumed.runId === run.runId, "verified session resumed the durable run rather than reseeding", `${resumed.runId} vs ${run.runId}`);
    const succeeded = Object.values(resumed.nodes).filter((node) => node.status === "succeeded").length;
    check(succeeded > 0, "the journey still has completed work at the end", `final succeeded=${succeeded}`);
    // "succeeded" is a moving population mid-journey — a first-time production legitimately
    // re-stales work accepted on top of the file it replaced — so the monotonic progress metric
    // is graph coverage: nodes that have ever been attempted only ever grows.
    const attemptedFinal = Object.values(resumed.nodes).filter((node) => node.attempts.length > 0).length;
    check(
      attemptedFinal > attemptedFirst,
      "the journey advanced past session 1 (more of the graph attempted)",
      `session1=${attemptedFirst} final=${attemptedFinal}`,
    );

    const verifierAccepted = Object.values(resumed.nodes).filter((node) => node.verifiedBySessionId === `${SESSION_TWO}.verifier`);
    check(
      verifierAccepted.length > 0,
      "the session's verifier sweep independently accepted fresh-context work (including the control's backlog)",
      `nodes with verifiedBySessionId=${SESSION_TWO}.verifier: ${verifierAccepted.length}`,
    );
    check(
      pendingVerificationCount(resumed) === 0,
      "no produced work is left dead-ended pending verification",
      `pending: ${pendingVerification(resumed).join("; ") || "none"}\n     session output tail: ${second.output.trim().slice(-600)}`,
    );
    const stillUnanswered = Object.values(resumed.nodes).filter(
      (node) => node.status === "waiting_founder" && (node.blocker ?? "").startsWith("Scope answer needed"),
    );
    check(
      stillUnanswered.length === scopeParked.length,
      "unanswered scope questions never rode staleness into dispatch",
      `before: ${scopeParked.length} after: ${stillUnanswered.length}`,
    );

    const audit = readFileSync(path.join(primary.workspace, "control", "audit.jsonl"), "utf8");
    check(audit.includes("verification_accepted"), "verification acceptance is attested in the audit log");
    check(audit.includes("founder_approval_granted"), "founder approvals are attested in the audit log");

    const list = runCli("core/session/verify.ts", ["--workspace", primary.workspace, "--list"]);
    check(
      list.code === 0 && list.output.includes("No nodes waiting on verification."),
      "verify.ts --list agrees nothing is waiting",
      list.output.trim().slice(-200),
    );

    // --- re-pin leg (layering plan R4): a workspace pinned to an older catalog adopts the newer
    // one ONLY through an explicit bootstrap --apply, mid-journey, without losing its run. The
    // older pin is simulated by rewriting the runtime binding's recorded version — exactly the
    // state a real workspace is in after the engine updates underneath it.
    const runtimeManifestPath = path.join(primary.workspace, ".b2c-launch", "runtime.json");
    const runtimeManifest = JSON.parse(readFileSync(runtimeManifestPath, "utf8")) as { skillVersion: string };
    const realVersion = runtimeManifest.skillVersion;
    writeFileSync(runtimeManifestPath, JSON.stringify({ ...runtimeManifest, skillVersion: "0.0.1" }, null, 2), "utf8");

    const repinDry = runCli("core/session/bootstrap.ts", ["--workspace", primary.workspace]);
    check(repinDry.code === 0, "re-pin dry-run exits 0", repinDry.output.trim().slice(-300));
    check(
      repinDry.output.includes("re-pin the workspace catalog from 0.0.1"),
      "the version drift is NAMED in the dry-run, never silently skipped",
      repinDry.output.trim().slice(-300),
    );

    const repin = runCli("core/session/bootstrap.ts", ["--workspace", primary.workspace, "--apply"]);
    check(repin.code === 0, "re-pin --apply exits 0", repin.output.trim().slice(-300));
    check(
      repin.output.includes(`re-pinned the workspace catalog from 0.0.1 to ${realVersion}`),
      "bootstrap --apply re-pins to the engine's version",
      repin.output.trim().slice(-300),
    );
    const repinned = JSON.parse(readFileSync(runtimeManifestPath, "utf8")) as { skillVersion: string };
    check(repinned.skillVersion === realVersion, "the runtime binding records the new pin", `pinned: ${repinned.skillVersion}`);
    const afterRepin = loadRun(primary.workspace);
    check(afterRepin.runId === run.runId, "the durable run survives a re-pin untouched", `${afterRepin.runId} vs ${run.runId}`);

    // --- fresh-business leg (layering plan R5): a business born from `formation new` — not a copy
    // of the reference workspace — bootstraps and plans. This is the forwarded-repo user's actual
    // first journey; before new.ts existed there was no birthplace to test.
    const freshDir = path.join(scratch, "fresh-born");
    const born = runCli("core/session/new.ts", ["fresh-e2e", "--dir", freshDir, "--name", "Fresh E2E"]);
    check(born.code === 0, "formation new scaffolds a fresh workspace", born.output.trim().slice(-300));
    const freshState = readFileSync(path.join(freshDir, "state", "PROJECT_STATE.yaml"), "utf8");
    check(freshState.includes('slug: "fresh-e2e"') && freshState.includes('name: "Fresh E2E"'), "the fresh workspace carries the founder's slug and name");
    check(existsSync(path.join(freshDir, "AGENTS.md")), "the fresh workspace has repo agent entrypoints");
    check(!existsSync(path.join(freshDir, "dist")), "generated projections are not inherited from the seed");

    const bornAgain = runCli("core/session/new.ts", ["fresh-e2e", "--dir", freshDir]);
    check(
      bornAgain.code === 1 && bornAgain.output.includes("new.target_occupied"),
      "new refuses an occupied target by name",
      bornAgain.output.trim().slice(-200),
    );

    const freshAnswers = path.join(scratch, "fresh-answers.json");
    writeFileSync(freshAnswers, fullGrantAnswers("fresh-e2e"), "utf8");
    const freshApply = runCli("core/session/bootstrap.ts", ["--workspace", freshDir, "--apply", "--answers", freshAnswers]);
    check(freshApply.code === 0, "a new-born workspace bootstraps", freshApply.output.trim().slice(-400));
    const freshPlan = runCli("core/session/plan.ts", ["--workspace", freshDir]);
    check(freshPlan.code === 0, "a new-born workspace plans", freshPlan.output.trim().slice(-300));

    if (failures.length > 0) {
      console.error(`\ncheck:engine-e2e — ${failures.length} failure(s).`);
      return 1;
    }
    console.log(
      `check:engine-e2e ok — bootstrap, ${succeeded} node(s) completed, ${verifierAccepted.length} fresh-context acceptance(s) after a parked backlog of ${parked}, and the verifier-off control behaved.`,
    );
    return 0;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

process.exitCode = main();
