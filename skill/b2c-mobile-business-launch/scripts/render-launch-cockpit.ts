#!/usr/bin/env node
import { asArray, asString, getPath, isRecord, loadProjectState, parseCliArgs, phaseOrder, readText, reportAndExit, writeText } from "./lib/launch-state.js";
import { renderFounderGateMarkup } from "./lib/founder-gate-presentation.js";
import { escapeHtml } from "./lib/html.js";
import {
  celebrationBeats,
  celebrationFor,
  emptyCopy,
  laneBlurb,
  laneLabel,
  laneMilestone,
  milestones,
  modeLabel,
  ownerLabel,
  phaseLabel,
  routeLabel,
  serviceLabel,
  statusLabel,
} from "./lib/founder-copy.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues = [...loaded.issues];

function list(items: unknown[], empty: string = emptyCopy.nothing): string {
  if (items.length === 0) {
    return `<span class="muted">${escapeHtml(empty)}</span>`;
  }
  return `<ul>${items.map((item) => `<li>${escapeHtml(typeof item === "string" ? item : JSON.stringify(item))}</li>`).join("")}</ul>`;
}

/** Founder-visible text with a plain-language fallback instead of a blank cell. */
function text(value: unknown, fallback: string = emptyCopy.notRecorded): string {
  const raw = asString(value)?.trim();
  return escapeHtml(raw && raw.length > 0 ? raw : fallback);
}

if (!loaded.state) {
  reportAndExit("Launch cockpit render", issues);
} else {
  const state = loaded.state;
  const projectName = asString(getPath(state, "project.name")) ?? "Untitled app";
  const phase = asString(getPath(state, "project.phase")) ?? "unknown";
  const mode = asString(getPath(state, "autonomy.mode")) ?? "unknown";
  const updatedAt = asString(getPath(state, "updated_at")) ?? "unknown";
  const lanes = isRecord(getPath(state, "lanes")) ? (getPath(state, "lanes") as Record<string, unknown>) : {};
  const tools = isRecord(getPath(state, "tools")) ? (getPath(state, "tools") as Record<string, unknown>) : {};
  const orchestration = isRecord(getPath(state, "orchestration")) ? (getPath(state, "orchestration") as Record<string, unknown>) : {};
  const businessOperator = isRecord(getPath(state, "business_operator")) ? (getPath(state, "business_operator") as Record<string, unknown>) : {};
  const accessLedgerSource = readText(args.root, "operations/business-access.json");
  if (!accessLedgerSource) throw new Error("operations/business-access.json is required before the cockpit can render.");
  const accessLedger = parseJsonRecord(accessLedgerSource);
  const founderModel = isRecord(accessLedger?.founderModel) ? accessLedger.founderModel : {};
  const agentOperations = isRecord(getPath(state, "agent_operations")) ? (getPath(state, "agent_operations") as Record<string, unknown>) : {};
  const cards = asArray(getPath(state, "failure_cards.active"));
  const gates = asArray(getPath(state, "autonomy.founder_only_gates"));
  const proofCommands = asArray(getPath(state, "proof.commands"));
  /**
   * The narrated update. A founder opening this page wants to know what happened while
   * they were away, what is happening now, and what is owed — before any table. When
   * the agent has not written these, the page falls back to the operator next-action
   * fields rather than showing an empty box.
   */
  const narrative = isRecord(getPath(state, "narrative")) ? (getPath(state, "narrative") as Record<string, unknown>) : {};
  /**
   * When the agent has not written narrative.your_call, point at the decision section
   * rather than repeating its exact sentence. The two used to render the same string back
   * to back, which read like a glitch.
   */
  const hasOpenDecision =
    (asString(businessOperator.next_founder_action) ?? "").trim().length > 0 && asString(businessOperator.active_gate_status) !== "resolved";
  const yourCallFallback = hasOpenDecision ? "One decision, spelled out just below." : emptyCopy.noDecision;

  /**
   * The earned-but-unspoken progress beat. A beat is earned once the project has
   * moved past the phase whose exit it marks; the latest earned beat renders as a
   * celebration card until the agent records it as spoken in
   * narrative.last_celebrated_phase — the beats existed in the dictionary long
   * before anything showed them to the founder, which defeated their whole point.
   */
  const currentPhaseIndex = phaseOrder.indexOf(asString(getPath(state, "project.phase")) ?? "");
  const lastCelebratedPhase = asString(narrative.last_celebrated_phase) ?? "";
  const latestEarnedBeatPhase = celebrationBeats
    .map((beat) => beat.phase)
    .filter((phase) => currentPhaseIndex !== -1 && phaseOrder.indexOf(phase) !== -1 && phaseOrder.indexOf(phase) < currentPhaseIndex)
    .sort((a, b) => phaseOrder.indexOf(a) - phaseOrder.indexOf(b))
    .pop();
  const unspokenCelebration = latestEarnedBeatPhase && latestEarnedBeatPhase !== lastCelebratedPhase ? celebrationFor(latestEarnedBeatPhase) : undefined;

  const laneEntries = Object.entries(lanes).map(([name, value]) => ({
    id: name,
    status: isRecord(value) ? (asString(value.status) ?? "not_started") : "not_started",
    evidence: isRecord(value) ? asArray(value.evidence) : [],
    blockers: isRecord(value) ? asArray(value.blockers) : [],
  }));

  /**
   * Nine named milestones instead of 22 flat rows. A founder cannot hold a 22-row table
   * in their head, and the ids were in system-key order rather than the order they
   * happen. Each milestone shows the plainest true summary of the areas beneath it.
   */
  const milestoneRows = milestones
    .map((milestone) => {
      const members = laneEntries.filter((lane) => laneMilestone(lane.id) === milestone.id);
      if (members.length === 0) return "";
      const counted = members.filter((lane) => lane.status !== "not_needed");
      const doneCount = counted.filter((lane) => lane.status === "done").length;
      const blocked = counted.filter((lane) => lane.status === "blocked");
      const started = counted.filter((lane) => lane.status === "partial");
      const summary =
        blocked.length > 0
          ? statusLabel("blocked")
          : counted.length === 0
            ? statusLabel("not_needed")
            : doneCount === counted.length
              ? statusLabel("done")
              : doneCount + started.length > 0
                ? statusLabel("partial")
                : statusLabel("not_started");
      const cls =
        blocked.length > 0
          ? "blocked"
          : doneCount === counted.length && counted.length > 0
            ? "done"
            : doneCount + started.length > 0
              ? "partial"
              : "not_started";
      const progress = counted.length > 0 ? `${doneCount} of ${counted.length} done` : emptyCopy.noneNeeded;
      return `<tr><td><strong>${escapeHtml(milestone.label)}</strong><br /><span class="muted">${escapeHtml(milestone.blurb)}</span></td><td><span class="status ${cls}">${escapeHtml(summary)}</span></td><td>${escapeHtml(progress)}</td></tr>`;
    })
    .join("");

  const laneRows = laneEntries
    .map((lane) => {
      return `<tr><td><strong>${escapeHtml(laneLabel(lane.id))}</strong><br /><span class="muted">${escapeHtml(laneBlurb(lane.id))}</span></td><td><span class="status ${escapeHtml(lane.status)}">${escapeHtml(statusLabel(lane.status))}</span></td><td>${list(lane.evidence)}</td><td>${list(lane.blockers, emptyCopy.noBlockers)}</td></tr>`;
    })
    .join("");

  /** Every open blocker, pulled to the top so a founder never hunts for what is stuck. */
  const blockerItems = laneEntries.flatMap((lane) => lane.blockers.map((blocker) => `${laneLabel(lane.id)}: ${asString(blocker) ?? ""}`));

  /**
   * The founder's view of a service: what it is, how we are using it, which keys it needs,
   * and whether it has been checked. Secret names stay visible because a founder pastes
   * those exact strings into a provider, but they render inside <code> so they read as
   * identifiers rather than as prose. The verification wording behind each service is
   * agent-facing and lives in the technical-details table instead.
   */
  const toolRows = Object.entries(tools)
    .map(([name, value]) => {
      const record = isRecord(value) ? value : {};
      const secrets = asArray(record.required_secrets);
      const secretMarkup =
        secrets.length === 0
          ? `<span class="muted">${escapeHtml(emptyCopy.noneNeeded)}</span>`
          : `<ul>${secrets.map((secret) => `<li><code>${escapeHtml(asString(secret) ?? "")}</code></li>`).join("")}</ul>`;
      const checked = asString(record.docs_checked_at)?.trim();
      return `<tr><td>${escapeHtml(serviceLabel(name))}</td><td>${escapeHtml(routeLabel(asString(record.route) ?? ""))}</td><td>${secretMarkup}</td><td>${escapeHtml(checked && checked.length > 0 ? checked : emptyCopy.notCheckedYet)}</td></tr>`;
    })
    .join("");

  /** Full service detail, including the verification wording, for whoever picks this up. */
  const toolDetailRows = Object.entries(tools)
    .map(([name, value]) => {
      const record = isRecord(value) ? value : {};
      return `<tr><td><code>${escapeHtml(name)}</code></td><td><code>${escapeHtml(asString(record.route) ?? "")}</code></td><td>${text(record.preflight, emptyCopy.notRecorded)}</td><td>${text(record.validation, emptyCopy.notRecorded)}</td></tr>`;
    })
    .join("");

  const cardMarkup = cards
    .map((card) => {
      const record = isRecord(card) ? card : {};
      const severity = asString(record.severity) ?? "";
      const watching = severity.toLowerCase() === "high" ? "Worth your attention" : "Keeping an eye on this";
      // Role ids are agent vocabulary; ownerLabel translates them before they
      // reach the founder. Raw "orchestrator" rendered here for a long time.
      const owner = asString(record.owner);
      const ownerText = owner ? escapeHtml(ownerLabel(owner)) : emptyCopy.notRecorded;
      return `<article class="card"><h3>${escapeHtml(watching)}</h3><p>${text(record.next_action)}</p><p class="muted">Handled by: ${ownerText}</p></article>`;
    })
    .join("");

  const commandMarkup = proofCommands
    .map((command) => {
      const record = isRecord(command) ? command : {};
      return `<article class="proof"><p><strong>${text(record.expected, "Checked")}</strong></p><p>Result: ${text(record.actual, emptyCopy.notCheckedYet)}</p><p class="muted">Saved at: ${text(record.evidence, emptyCopy.notRecorded)}</p></article>`;
    })
    .join("");

  const orchestrationMarkup = `<div class="grid">
    <article class="card"><h3>Strategy</h3><p>${escapeHtml(orchestration.strategy ?? "not recorded")}</p><p class="muted">${escapeHtml(orchestration.rationale ?? "")}</p></article>
    <article class="card"><h3>Owner</h3><p>${escapeHtml(orchestration.integration_owner ?? "not recorded")}</p><p class="muted">Manager pattern: ${escapeHtml(orchestration.manager_pattern ?? "unknown")}</p></article>
    <article class="card"><h3>Safety</h3><p>File overlap checked: ${escapeHtml(orchestration.file_overlap_checked ?? "unknown")}</p><p>Actual collision check: ${escapeHtml(orchestration.actual_file_collision_check ?? "unknown")}</p></article>
    <article class="card"><h3>Integration</h3><p>Outputs reviewed: ${escapeHtml(orchestration.agent_outputs_reviewed ?? "unknown")}</p><p>State reconciled: ${escapeHtml(orchestration.state_reconciled ?? "unknown")}</p></article>
  </div>`;

  const agentOperationsMarkup = `<div class="grid">
    <article class="card"><h3>Status</h3><p><span class="status ${escapeHtml(agentOperations.status ?? "not_started")}">${escapeHtml(agentOperations.status ?? "not_started")}</span></p><p class="muted">Capability checked: ${escapeHtml(agentOperations.capability_checked_at ?? "not recorded")}</p></article>
    <article class="card"><h3>Artifacts</h3><p>${escapeHtml(agentOperations.human_log ?? "operations/AGENT_OPERATIONS.md")}</p><p>${escapeHtml(agentOperations.structured_ledger ?? "operations/agent-operations.json")}</p></article>
    <article class="card"><h3>Approvals</h3>${list(asArray(agentOperations.active_approval_ids))}</article>
    <article class="card"><h3>Reconciliation</h3><p>Last action: ${escapeHtml(agentOperations.last_action_id ?? "none")}</p><p>State reconciled: ${escapeHtml(agentOperations.state_reconciled ?? false)}</p></article>
  </div>`;

  const businessOperatorMarkup = renderFounderGateMarkup(founderModel, businessOperator);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(projectName)} — your business dashboard</title>
  <style>
    :root {
      --bg: #f7f3ec;
      --ink: #161512;
      --muted: #686159;
      --line: #d8d0c3;
      --panel: #fffdfa;
      --accent: #0c7c59;
      --warn: #a05a00;
      --bad: #b3261e;
      --radius: 8px;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.45 ui-sans-serif, system-ui, sans-serif; }
    header { padding: 32px; border-bottom: 1px solid var(--line); background: linear-gradient(120deg, #fffdfa, #e5f1ea); }
    h1 { margin: 0 0 8px; font-size: clamp(28px, 5vw, 56px); line-height: 0.95; letter-spacing: 0; }
    h2 { margin: 0 0 14px; font-size: 20px; }
    h3 { margin: 0 0 8px; }
    main { padding: 24px; display: grid; gap: 18px; }
    section { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; overflow: auto; }
    .meta { display: flex; gap: 10px; flex-wrap: wrap; color: var(--muted); }
    .pill { border: 1px solid var(--line); border-radius: 999px; padding: 6px 10px; background: #fff; }
    table { width: 100%; border-collapse: collapse; min-width: 760px; }
    th, td { text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); padding: 10px; }
    th { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
    ul { margin: 0; padding-left: 18px; }
    .muted { color: var(--muted); }
    .status { display: inline-block; border-radius: 999px; padding: 3px 8px; background: #eee5d9; }
    .done { background: #d8eee2; color: #06472f; }
    .blocked { background: #f8d7d4; color: var(--bad); }
    .partial { background: #f7ead5; color: var(--warn); }
    .deferred, .not_needed { background: #e8e5df; color: #514b45; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
    .card, .proof { border: 1px solid var(--line); border-radius: var(--radius); padding: 14px; background: #fff; }
    .lede { margin: 0 0 12px; font-size: clamp(17px, 2.4vw, 22px); color: var(--muted); }
    .narrative { display: grid; gap: 12px; }
    .beat { border-left: 3px solid var(--line); padding: 2px 0 2px 14px; }
    .beat h3 { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; margin: 0 0 4px; }
    .beat p { margin: 0; font-size: 16px; }
    .your-call { border-left-color: var(--accent); }
    .celebrate { border-left-color: #2e9e5b; background: #f2faf5; border-radius: 0 var(--radius) var(--radius) 0; padding-right: 14px; }
    .tech { background: transparent; border-style: dashed; }
    .tech summary { cursor: pointer; color: var(--muted); font-size: 14px; }
    .tech-body { padding-top: 14px; display: grid; gap: 14px; }
    .tech-body h2 { font-size: 15px; margin: 0; }
    @media (max-width: 720px) { header, main { padding: 18px; } table { min-width: 640px; } }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(projectName)}</h1>
    <p class="lede">${escapeHtml(phaseLabel(phase))}</p>
    <div class="meta">
      <span class="pill">${escapeHtml(modeLabel(mode))}</span>
      <span class="pill">Last updated ${escapeHtml(updatedAt)}</span>
    </div>
  </header>
  <main>
    <section class="narrative">
      <h2>Where We Are</h2>
      ${unspokenCelebration ? `<article class="beat celebrate"><h3>Worth a moment</h3><p>${escapeHtml(unspokenCelebration)}</p></article>` : ""}
      <article class="beat"><h3>Since last time</h3><p>${text(narrative.since_last_time, "This is the first update, so there is nothing to catch up on yet.")}</p></article>
      <article class="beat"><h3>What I am doing now</h3><p>${text(narrative.right_now, asString(businessOperator.next_agent_action) ?? emptyCopy.notRecorded)}</p></article>
      <article class="beat your-call"><h3>What I need from you</h3><p>${text(narrative.your_call, yourCallFallback)}</p></article>
    </section>
    <section>
      <h2>What I Need From You</h2>
      ${businessOperatorMarkup}
    </section>
    <section>
      <h2>How Far Along We Are</h2>
      <table><thead><tr><th>Stage</th><th>Where it stands</th><th>Progress</th></tr></thead><tbody>${milestoneRows}</tbody></table>
    </section>
    <section>
      <h2>What Is In The Way</h2>
      ${list(blockerItems, emptyCopy.noBlockers)}
      <h3>Things I am watching</h3>
      <div class="grid">${cardMarkup || `<p class="muted">${escapeHtml(emptyCopy.nothing)}</p>`}</div>
    </section>
    <section>
      <h2>What Only You Can Decide</h2>
      <p class="muted">I will always stop and ask before any of these. I never assume a yes from silence.</p>
      ${list(gates)}
    </section>
    <section>
      <h2>Your Connected Tools And Services</h2>
      <table><thead><tr><th>Service</th><th>How we are using it</th><th>Keys it needs</th><th>Checked</th></tr></thead><tbody>${toolRows}</tbody></table>
    </section>
    <section>
      <h2>How I Checked My Work</h2>
      <div class="grid">${commandMarkup || `<p class="muted">${escapeHtml(emptyCopy.notCheckedYet)}</p>`}</div>
    </section>
    <section class="tech">
      <details>
        <summary>Technical details, for whoever picks this up next</summary>
        <div class="tech-body">
          <h3>Every area in detail</h3>
          <table><thead><tr><th>Area</th><th>Where it stands</th><th>What proves it</th><th>What is in the way</th></tr></thead><tbody>${laneRows}</tbody></table>
          <h3>Service verification detail</h3>
          <table><thead><tr><th>Service key</th><th>Route</th><th>Preflight</th><th>Validation</th></tr></thead><tbody>${toolDetailRows}</tbody></table>
          <h2>Behind The Scenes</h2>
          ${agentOperationsMarkup}
          <h3>How the work is split up</h3>
          ${orchestrationMarkup}
        </div>
      </details>
    </section>
  </main>
</body>
</html>
`;

  const output = args.outputPath ?? `${args.root}/state/launch-cockpit.html`;
  writeText(output, html);
  console.log(`Launch cockpit written to ${output}`);
  reportAndExit("Launch cockpit render", issues);
}

function parseJsonRecord(source: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(source);
  if (!isRecord(parsed)) throw new Error("operations/business-access.json must parse to a JSON object.");
  return parsed;
}
