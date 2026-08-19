#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveWorkspacePaths } from "../core/session/run.js";
import { formatAge, internalVocabularyBlocklist, translateParkReason } from "../core/session/digest.js";
import { validateBudgetLedger, validateBusinessState, validateControl, validateRunState } from "../core/schema/index.js";
import { compilePlan, type CatalogInput, type CompiledPlan } from "../core/engine/compile.js";
import { domainBusinessUnit } from "../core/autonomy/budget.js";
import { businessUnitDomains } from "../core/schema/types.js";
import type {
  ActionClass,
  BudgetLedgerDocument,
  BudgetPeriod,
  BusinessStateV2,
  BusinessUnit,
  ControlFile,
  GrantLevel,
  GrantableDomainId,
  ProtectedCategory,
  RunStateDocument,
  Waiver,
} from "../core/schema/types.js";
import { domains as catalogDomains } from "../catalog/domains.js";
import { escapeHtml } from "./lib/html.js";

/**
 * Autonomy console (U7, R16/R17): cockpit v2's read model over one business workspace's
 * autonomy state. Reads control.json (grants + waivers + kill switch), budget-ledger.json, the
 * most recent digest, and run/run-state.json's parked nodes; writes a single self-contained HTML
 * page. Follows the render + --check drift convention already established by
 * catalog/render-routing.ts and tooling/render-business-control-plane-workspace.ts: without
 * --check it (re)writes the file, with --check it fails on any drift instead of touching disk.
 *
 * Every value that reaches the page goes through a translation table first — never a raw domain
 * id, action class, grant level, or protectedCategory string (R17; verification/fixtures/console.fixtures.ts
 * scans this file's own output against founderSurfaceVocabularyBlocklist below, the same style of
 * check core/session/digest.ts already uses on the founder digest).
 *
 * CLI: tsx tooling/render-autonomy-console.ts --workspace <dir> [--out <path>] [--check] [--now <iso>]
 */

export const founderSurfaceVocabularyBlocklist: readonly string[] = [
  ...internalVocabularyBlocklist,
  "lane.",
  "mutate",
  "gateClass",
  "RunNode",
  "domainId",
  "businessSlug",
  "founderOnlyActions",
  "resourcePattern",
  "waiverRef",
  "budgetPeriod",
  "costEstimate",
  "killSwitch",
  "stateHash",
  "grantedViaUnit",
  "ttlSeconds",
  "auditRef",
  "patchId",
];

const GRANT_LEVEL_LABEL: Record<GrantLevel, string> = {
  "review-first": "Ask me first",
  "run-with-guardrails": "Handle the routine stuff",
  full: "Full trust",
};

const ACTION_CLASS_LABEL: Record<ActionClass, string> = {
  observe: "look into something",
  draft: "prepare a draft",
  mutate: "change something",
  publish: "post something",
  spend: "spend money",
  release: "submit a release",
  destructive: "delete or permanently change something",
};

const PROTECTED_CATEGORY_LABEL: Record<ProtectedCategory, string> = {
  spend: "spending beyond the routine amount",
  credentials_access: "using a login or credential",
  legal_pricing: "changing a price or legal term",
  public_actions: "posting something publicly",
  release: "submitting the app for release",
  destructive: "deleting or permanently changing something",
};

const BUDGET_PERIOD_LABEL: Record<BudgetPeriod, string> = { daily: "day", weekly: "week", monthly: "month", per_run: "session" };

const WAIVER_STATUS_LABEL: Record<Waiver["status"], string> = { active: "Active", expired: "Expired", revoked: "Revoked" };

const businessUnits = Object.keys(businessUnitDomains) as readonly BusinessUnit[];

function formatMoney(amount: number, currency: string): string {
  return currency === "USD" ? `$${amount.toFixed(2)}` : `${amount.toFixed(2)} ${currency}`;
}

function formatDate(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "an unknown date";
  return new Date(parsed).toISOString().slice(0, 10);
}

function domainLabel(domainId: GrantableDomainId): string {
  return catalogDomains.find((domain) => domain.id === domainId)?.routeLabel ?? "This area";
}

// --- workspace reads -----------------------------------------------------------------------------

function tryLoadJson(filePath: string): unknown | undefined {
  if (!existsSync(filePath)) return undefined;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return undefined;
  }
}

function loadControl(controlPath: string): ControlFile | undefined {
  const raw = tryLoadJson(controlPath);
  if (raw === undefined) return undefined;
  const result = validateControl(raw);
  return result.valid ? result.value : undefined;
}

function loadLedger(ledgerPath: string): BudgetLedgerDocument | undefined {
  const raw = tryLoadJson(ledgerPath);
  if (raw === undefined) return undefined;
  const result = validateBudgetLedger(raw);
  return result.valid ? result.value : undefined;
}

function loadBusinessState(statePath: string): BusinessStateV2 | undefined {
  const raw = tryLoadJson(statePath);
  if (raw === undefined) return undefined;
  const result = validateBusinessState(raw);
  return result.valid ? result.value : undefined;
}

function loadRun(runStatePath: string): RunStateDocument | undefined {
  const raw = tryLoadJson(runStatePath);
  if (raw === undefined) return undefined;
  const result = validateRunState(raw);
  return result.valid ? result.value : undefined;
}

function loadPlan(catalogPath: string): CompiledPlan | undefined {
  const raw = tryLoadJson(catalogPath) as CatalogInput | undefined;
  if (!raw) return undefined;
  try {
    return compilePlan(raw);
  } catch {
    return undefined;
  }
}

interface DigestSummary {
  readonly sessionId: string;
  readonly title: string;
  readonly when: string;
  readonly headline: string;
  readonly fullText: string;
}

/** Picks the most recently written digest file — mtime, not filename order, since session ids are not guaranteed sortable. */
function loadLatestDigest(digestsDir: string): DigestSummary | undefined {
  if (!existsSync(digestsDir)) return undefined;
  const files = readdirSync(digestsDir).filter((name) => name.endsWith(".md"));
  if (files.length === 0) return undefined;
  const newest = files.map((name) => ({ name, mtime: statSync(path.join(digestsDir, name)).mtimeMs })).sort((a, b) => b.mtime - a.mtime)[0]!;
  const fullText = readFileSync(path.join(digestsDir, newest.name), "utf8");
  const lines = fullText.split("\n");
  const title = (lines[0] ?? "").replace(/^#\s*/, "").replace(/\s*—\s*session update\s*$/, "");
  const whenLine = lines.find((line) => line.startsWith("When: ")) ?? "";
  const whenIndex = lines.indexOf(whenLine);
  const headline = lines.slice(whenIndex + 1).find((line) => line.trim().length > 0) ?? "";
  return { sessionId: newest.name.replace(/\.md$/, ""), title, when: whenLine.replace(/^When:\s*/, ""), headline, fullText };
}

interface ParkedItem {
  readonly title: string;
  readonly unit: BusinessUnit;
  readonly reasonText: string;
  readonly ageText?: string;
}

/**
 * Mirrors core/session/run.ts's own parked-item construction (run-state nodes in blocked/
 * waiting_founder, deduplicated against founderGates.pending) so the console agrees with the
 * digest about what is waiting on the founder. run.ts does not export this as a reusable
 * function — if its parked-list logic changes, this should change with it.
 */
function buildParkedItems(
  plan: CompiledPlan | undefined,
  run: RunStateDocument | undefined,
  businessState: BusinessStateV2 | undefined,
  now: string,
): ParkedItem[] {
  const parked: ParkedItem[] = [];
  if (plan && run) {
    for (const node of plan.nodes) {
      const state = run.nodes[node.id];
      if (!state || (state.status !== "blocked" && state.status !== "waiting_founder")) continue;
      parked.push({ title: node.title, unit: domainBusinessUnit(node.domainId), reasonText: translateParkReason({ blocker: state.blocker }) });
    }
  }
  for (const gate of businessState?.founderGates.pending ?? []) {
    if (parked.some((item) => gate.reason.includes(item.title))) continue;
    parked.push({ title: gate.reason, unit: "Operations", reasonText: "This has been waiting on you.", ageText: formatAge(gate.createdAt, now) });
  }
  return parked;
}

// --- grants + waivers presentation ----------------------------------------------------------------

interface UnitGrantSummary {
  readonly unit: BusinessUnit;
  readonly whatItCovers: string;
  readonly summaryLabel: string;
  readonly mixed: boolean;
  readonly domainBreakdown: ReadonlyArray<{ label: string; levelLabel: string }>;
}

function unitWhatItCovers(unit: BusinessUnit): string {
  const labels = businessUnitDomains[unit].map((id) => domainLabel(id));
  return labels.join(", ");
}

function buildUnitGrantSummaries(control: ControlFile | undefined): UnitGrantSummary[] {
  return businessUnits.map((unit) => {
    const domainIds = businessUnitDomains[unit];
    const breakdown = domainIds.map((id) => ({
      label: domainLabel(id),
      levelLabel: control?.grants[id] ? GRANT_LEVEL_LABEL[control.grants[id]!.level] : "Not set up yet",
    }));
    const distinctLevels = new Set(domainIds.map((id) => control?.grants[id]?.level).filter((level): level is GrantLevel => Boolean(level)));
    const mixed = distinctLevels.size > 1;
    const summaryLabel =
      distinctLevels.size === 0 ? "Not set up yet" : mixed ? "Mixed — different settings within this area" : GRANT_LEVEL_LABEL[[...distinctLevels][0]!];
    return { unit, whatItCovers: unitWhatItCovers(unit), summaryLabel, mixed, domainBreakdown: breakdown };
  });
}

interface WaiverRow {
  readonly unit: BusinessUnit;
  readonly statusLabel: string;
  readonly covers: string;
  readonly description: string;
  readonly capText: string;
  readonly expiryText: string;
}

function buildWaiverRows(control: ControlFile | undefined): WaiverRow[] {
  return (control?.waivers ?? []).map((waiver) => ({
    unit: domainBusinessUnit(waiver.domainId),
    statusLabel: WAIVER_STATUS_LABEL[waiver.status],
    covers: `${PROTECTED_CATEGORY_LABEL[waiver.protectedCategory]} (${ACTION_CLASS_LABEL[waiver.actionClass]})`,
    description: waiver.scope.description,
    capText: `${formatMoney(waiver.caps.maxPerAction, waiver.caps.currency ?? "USD")} per action, ${formatMoney(waiver.caps.maxPerPeriod, waiver.caps.currency ?? "USD")} per ${BUDGET_PERIOD_LABEL[waiver.budgetPeriod]}`,
    expiryText: `Expires ${formatDate(waiver.expiry)}`,
  }));
}

interface BalanceRow {
  readonly unit: BusinessUnit;
  readonly period: string;
  readonly spentText: string;
  readonly remainingText: string;
}

function buildBalanceRows(ledger: BudgetLedgerDocument | undefined): BalanceRow[] {
  return (ledger?.balances ?? []).map((balance) => ({
    unit: balance.unit,
    period: balance.period,
    spentText: `${formatMoney(balance.spent, balance.currency)} of ${formatMoney(balance.allocated, balance.currency)} spent`,
    remainingText: `${formatMoney(balance.remaining, balance.currency)} left`,
  }));
}

// --- HTML render -----------------------------------------------------------------------------------

function list(items: string[], empty: string): string {
  if (items.length === 0) return `<p class="muted">${escapeHtml(empty)}</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderHtml(opts: {
  businessSlug: string;
  killSwitchEngaged: boolean;
  killSwitchReason: string;
  unitSummaries: UnitGrantSummary[];
  waiverRows: WaiverRow[];
  balanceRows: BalanceRow[];
  parkedItems: ParkedItem[];
  latestDigest?: DigestSummary;
}): string {
  const unitCards = opts.unitSummaries
    .map((summary) => {
      const breakdown = summary.mixed
        ? `<ul class="breakdown">${summary.domainBreakdown.map((entry) => `<li>${escapeHtml(entry.label)}: ${escapeHtml(entry.levelLabel)}</li>`).join("")}</ul>`
        : "";
      return `<article class="card"><h3>${escapeHtml(summary.unit)}</h3><p class="muted">${escapeHtml(summary.whatItCovers)}</p><p class="level">${escapeHtml(summary.summaryLabel)}</p>${breakdown}</article>`;
    })
    .join("");

  const waiverRows = opts.waiverRows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.unit)}</td><td>${escapeHtml(row.covers)}<br/><span class="muted">${escapeHtml(row.description)}</span></td><td>${escapeHtml(row.capText)}</td><td>${escapeHtml(row.expiryText)}</td><td><span class="status ${escapeHtml(row.statusLabel.toLowerCase())}">${escapeHtml(row.statusLabel)}</span></td></tr>`,
    )
    .join("");

  const balanceRows = opts.balanceRows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.unit)}</td><td>${escapeHtml(row.period)}</td><td>${escapeHtml(row.spentText)}</td><td>${escapeHtml(row.remainingText)}</td></tr>`,
    )
    .join("");

  const parkedList = list(
    opts.parkedItems.map((item) => `${item.title} (${item.unit}) — ${item.reasonText}${item.ageText ? `, waiting ${item.ageText}` : ""}`),
    "Nothing is waiting on you right now.",
  );

  const digestSection = opts.latestDigest
    ? `<article class="beat"><p><strong>${escapeHtml(opts.latestDigest.when)}</strong></p><p>${escapeHtml(opts.latestDigest.headline)}</p><details><summary>Full session update</summary><pre>${escapeHtml(opts.latestDigest.fullText)}</pre></details></article>`
    : `<p class="muted">No session has run yet.</p>`;

  const killSwitchBanner = opts.killSwitchEngaged
    ? `<div class="banner"><strong>Autonomous work is paused for this business right now.</strong>${opts.killSwitchReason ? ` <span>${escapeHtml(opts.killSwitchReason)}</span>` : ""}</div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.businessSlug)} — autonomy console</title>
  <style>
    :root {
      --bg: #f7f3ec; --ink: #161512; --muted: #686159; --line: #d8d0c3; --panel: #fffdfa;
      --accent: #0c7c59; --warn: #a05a00; --bad: #b3261e; --radius: 8px;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.45 ui-sans-serif, system-ui, sans-serif; }
    header { padding: 28px; border-bottom: 1px solid var(--line); background: linear-gradient(120deg, #fffdfa, #e5f1ea); }
    h1 { margin: 0 0 6px; font-size: clamp(24px, 4vw, 40px); }
    h2 { margin: 0 0 14px; font-size: 19px; }
    h3 { margin: 0 0 6px; }
    main { padding: 22px; display: grid; gap: 16px; }
    section { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; overflow: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 640px; }
    th, td { text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); padding: 8px; }
    th { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
    ul { margin: 0; padding-left: 18px; }
    .muted { color: var(--muted); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    .card { border: 1px solid var(--line); border-radius: var(--radius); padding: 12px; background: #fff; }
    .card .level { font-weight: 600; }
    .breakdown { margin-top: 6px; font-size: 13px; color: var(--muted); }
    .status { display: inline-block; border-radius: 999px; padding: 2px 8px; background: #eee5d9; }
    .status.active { background: #d8eee2; color: #06472f; }
    .status.expired, .status.revoked { background: #e8e5df; color: #514b45; }
    .banner { background: #f8d7d4; color: var(--bad); border-radius: var(--radius); padding: 12px 16px; }
    .beat { border-left: 3px solid var(--accent); padding: 4px 0 4px 14px; }
    pre { white-space: pre-wrap; font-size: 13px; }
    @media (max-width: 720px) { header, main { padding: 16px; } table { min-width: 560px; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(opts.businessSlug)}</h1>
    <p class="muted">What I'm allowed to do on my own, area by area — and what's waiting on you.</p>
  </header>
  <main>
    ${killSwitchBanner}
    <section>
      <h2>Your latest session update</h2>
      ${digestSection}
    </section>
    <section>
      <h2>What's waiting on you</h2>
      ${parkedList}
    </section>
    <section>
      <h2>How much I can do in each area</h2>
      <div class="grid">${unitCards}</div>
    </section>
    <section>
      <h2>Pre-approvals in effect</h2>
      ${
        opts.waiverRows.length > 0
          ? `<table><thead><tr><th>Area</th><th>Covers</th><th>Cap</th><th>Expires</th><th>Status</th></tr></thead><tbody>${waiverRows}</tbody></table>`
          : `<p class="muted">You haven't pre-approved anything yet. Protected moves always wait for your okay.</p>`
      }
    </section>
    <section>
      <h2>Money</h2>
      ${
        opts.balanceRows.length > 0
          ? `<table><thead><tr><th>Area</th><th>Period</th><th>Spent</th><th>Remaining</th></tr></thead><tbody>${balanceRows}</tbody></table>`
          : `<p class="muted">No budget has been set aside yet.</p>`
      }
    </section>
  </main>
</body>
</html>
`;
}

// --- CLI entry -------------------------------------------------------------------------------------

interface Args {
  workspace: string;
  outputPath: string;
  check: boolean;
  now: string;
}

function parseArgs(argv: string[]): Args {
  const args: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token?.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        index += 1;
      } else {
        args[key] = "true";
      }
    }
  }
  if (!args.workspace) {
    console.error("console.missing_argument: --workspace is required");
    process.exit(1);
  }
  const workspace = path.resolve(args.workspace);
  return {
    workspace,
    outputPath: args.out ? path.resolve(args.out) : path.join(workspace, "state", "autonomy-console.html"),
    check: args.check === "true",
    now: args.now ?? new Date().toISOString(),
  };
}

export function renderAutonomyConsole(workspace: string, now: string): string {
  const paths = resolveWorkspacePaths(workspace);
  const control = loadControl(paths.control);
  const ledger = loadLedger(paths.ledger);
  const businessState = loadBusinessState(paths.state);
  const run = loadRun(paths.runState);
  const plan = loadPlan(paths.catalog);
  const digest = loadLatestDigest(path.join(workspace, "digests"));

  const businessSlug = control?.businessSlug ?? businessState?.project.slug ?? path.basename(workspace);
  const unitSummaries = buildUnitGrantSummaries(control);
  const waiverRows = buildWaiverRows(control);
  const balanceRows = buildBalanceRows(ledger);
  const parkedItems = buildParkedItems(plan, run, businessState, now);

  return renderHtml({
    businessSlug,
    killSwitchEngaged: control?.killSwitch.engaged ?? false,
    killSwitchReason: control?.killSwitch.reason ?? "",
    unitSummaries,
    waiverRows,
    balanceRows,
    parkedItems,
    latestDigest: digest,
  });
}

function isMainModule(): boolean {
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return invoked === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const args = parseArgs(process.argv.slice(2));
  const rendered = renderAutonomyConsole(args.workspace, args.now);

  if (args.check) {
    if (!existsSync(args.outputPath)) {
      console.error(`ERROR autonomy_console.generated_missing: ${args.outputPath}`);
      process.exitCode = 1;
    } else if (readFileSync(args.outputPath, "utf8") !== rendered) {
      console.error(`ERROR autonomy_console.generated_drift: ${args.outputPath}`);
      process.exitCode = 1;
    } else {
      console.log(`autonomy console current: ${args.outputPath}`);
    }
  } else {
    mkdirSync(path.dirname(args.outputPath), { recursive: true });
    writeFileSync(args.outputPath, rendered, "utf8");
    console.log(`Autonomy console written to ${args.outputPath}`);
  }
}
