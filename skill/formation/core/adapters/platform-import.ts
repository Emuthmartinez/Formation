#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

import { isMainModule, parseArgs } from "../lib/cli.js";
import { lanes as catalogLanes } from "../../catalog/lanes.js";
import { laneDependencies, satisfiedDependencyStatuses, statusValues } from "../../tooling/lib/launch-state.js";

/**
 * The engine half of the existing-launch-repository importer (docs/history/platform-remaining-gaps-2026-08-v0.147.0.md,
 * "Existing launch repository importer"): one read-only CLI the Formation server can spawn to
 * learn, in a typed shape, what business already exists inside a launch workspace — the
 * `state/PROJECT_STATE.yaml` shape the skill has produced since long before Formation existed,
 * with its Markdown artifacts, lane evidence, launch trace, and blockers.
 *
 * It is the same boundary discipline as core/adapters/platform-execution.ts, for the same reason:
 * the platform must never read engine workspace files itself (platform/AGENTS.md). Everything the
 * platform is allowed to know about a legacy workspace is named in this document.
 *
 * **It never writes.** Not to the launch workspace, not anywhere. The gaps document's hardest
 * requirement — "never deletes or rewrites the source repository" — is met by construction here:
 * this file opens no handle for writing, and the platform half has no path back into the
 * workspace. A launch repository can be imported into Formation and still be run by the engine
 * afterwards, unchanged.
 *
 * **Nothing here is a fact.** The report classifies what it finds, but every record it proposes
 * is a candidate: recorded lane completions become recommendations to review, open questions
 * become questions, and Markdown artifacts become draft deliverables. A launch workspace is a
 * working record kept by an agent, not verified truth, and importing it as truth would launder
 * the difference. That judgement belongs to the founder on the other side.
 *
 * **Contradictions are reported, never repaired.** A lane recorded done whose evidence file is
 * missing, a lane finished over an unfinished dependency, a workspace whose own state says it has
 * not been reconciled — each is surfaced with the record it undermines, so the founder decides.
 * Silently dropping such records would hide the very thing an importer is for.
 *
 * Honesty contract, matching platform-execution.ts: exit 0 means "the engine answered", including
 * the answer "there is no business here yet" (`workspaceReady: false` with a reason). A non-zero
 * exit means the engine could not answer at all — the caller must report that as unreachable,
 * never as "nothing to import".
 *
 * CLI: tsx core/adapters/platform-import.ts --workspace <launch-repository-dir> [--now <iso>]
 */

export type ImportClaimKind = "recommendation" | "question" | "assumption";
export type ImportDecisionStatus = "proposed" | "decided" | "superseded";
export type ImportTaskUrgency = "critical" | "high" | "medium";
export type ImportContradictionSeverity = "blocking" | "advisory";

/** Where a proposed record came from inside the launch workspace, for founder-visible provenance. */
export interface ImportOrigin {
  /** Workspace-relative path of the file the record was read from. */
  readonly sourcePath: string;
  /** The engine's own lane key, when the record belongs to a lane. */
  readonly laneKey?: string;
  /** The engine's own label for that lane. Engine vocabulary — the platform presents it. */
  readonly laneLabel?: string;
}

/**
 * One proposed record's stable identity. The platform keys imported records on this, so importing
 * the same workspace twice changes nothing and importing it again after the workspace moved
 * forward updates in place. Derived from what the record *is* (lane key, question text, file path)
 * rather than from list position, because a launch workspace reorders its own lists freely.
 */
export type ImportKey = string;

export interface ImportCompany {
  readonly name: string;
  readonly slug: string;
  /** Formation workspace stage, mapped from the launch phase. */
  readonly stage: string;
  readonly founderName: string;
  readonly oneLiner: string;
  readonly targetCustomer: string;
  /** The engine's own launch phase key, for provenance. */
  readonly enginePhase: string;
  readonly launchScope: string;
  readonly platforms: readonly string[];
  readonly landingUrl?: string;
  /** ISO day the workspace state was last updated by the engine. */
  readonly stateUpdatedAt?: string;
  /** ISO day the app first went live on a store, when the workspace records one. */
  readonly liveSince?: string;
}

export interface ImportClaim {
  readonly importKey: ImportKey;
  readonly kind: ImportClaimKind;
  readonly statement: string;
  readonly evidence: readonly string[];
  readonly origin: ImportOrigin;
}

export interface ImportDecision {
  readonly importKey: ImportKey;
  readonly title: string;
  readonly decision: string;
  readonly rationale: string;
  readonly status: ImportDecisionStatus;
  readonly decidedAt?: string;
  readonly origin: ImportOrigin;
}

export interface ImportTask {
  readonly importKey: ImportKey;
  readonly title: string;
  readonly urgency: ImportTaskUrgency;
  /** True when the workspace records this as something actively stopping work, not merely next. */
  readonly blocked: boolean;
  readonly origin: ImportOrigin;
}

/** One section of an imported Markdown artifact, already split on its own headings. */
export interface ImportSection {
  readonly title: string;
  readonly body: string;
}

export interface ImportDeliverable {
  readonly importKey: ImportKey;
  readonly title: string;
  readonly sections: readonly ImportSection[];
  /** Content hash of the source file — the platform's test for "has this changed since last import". */
  readonly fingerprint: string;
  readonly origin: ImportOrigin;
}

export interface ImportContradiction {
  readonly code: string;
  readonly severity: ImportContradictionSeverity;
  /** Plain sentence naming what disagrees with what. Engine vocabulary; the platform presents it. */
  readonly message: string;
  /** The import key of the record this contradiction undermines, when it undermines one. */
  readonly relatesTo?: ImportKey;
  readonly origin: ImportOrigin;
}

export interface ImportBoundaryReport {
  readonly schemaVersion: "1.0.0";
  readonly generatedAt: string;
  readonly workspaceReady: boolean;
  /** Present when workspaceReady is false: why there is nothing here to bring across. */
  readonly reason?: string;
  readonly company?: ImportCompany;
  readonly claims?: readonly ImportClaim[];
  readonly decisions?: readonly ImportDecision[];
  readonly tasks?: readonly ImportTask[];
  readonly deliverables?: readonly ImportDeliverable[];
  readonly contradictions?: readonly ImportContradiction[];
}

const STATE_FILE = path.join("state", "PROJECT_STATE.yaml");
const BUSINESS_FILES = [path.join("studio", "seed", "business.json"), path.join("state", "business.json")] as const;
const TRACE_FILE = path.join("state", "LAUNCH_TRACE.md");

/**
 * The values `workspace-template/` and `workspace/business/` ship with. A workspace still carrying
 * them has been copied but never filled in, and importing it would create a company called "App
 * Name" whose every field is a prompt to the agent that was supposed to answer it.
 */
const TEMPLATE_NAMES = new Set(["app name", "{{app_name}}", "", "untitled"]);
const TEMPLATE_MARKERS = ["com.example.app", "{{product_type}}", "still to be defined", "replace with a"];

/** Formation workspace stages, keyed by the launch phase prefix that implies each one. */
const STAGE_BY_PHASE_PREFIX: ReadonlyArray<readonly [string, string]> = [
  ["phase_0", "discovery"],
  ["phase_1", "validation"],
  ["phase_2", "validation"],
  ["phase_3", "build"],
  ["phase_4", "build"],
  ["phase_5", "beta"],
  ["phase_6", "launch"],
  ["phase_7", "growth"],
];

/** Per-file and per-report ceilings, so one enormous workspace cannot produce an unbounded document. */
const LIMITS = Object.freeze({
  deliverables: 120,
  sectionsPerDeliverable: 24,
  sectionBody: 20_000,
  sourceFileBytes: 512_000,
  claims: 200,
  tasks: 200,
  decisions: 100,
  contradictions: 200,
  evidencePerClaim: 20,
  statement: 500,
});

const laneLabels = new Map(catalogLanes.map((lane) => [lane.key as string, lane.label as string]));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: unknown, key: string): string {
  if (!isRecord(source)) return "";
  const value = source[key];
  return typeof value === "string" ? value.trim() : "";
}

function readStringList(source: unknown, key: string): string[] {
  if (!isRecord(source)) return [];
  const value = source[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean);
}

function truncate(text: string, maximum: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > maximum ? `${normalized.slice(0, maximum - 1)}…` : normalized;
}

/** Short, stable hash for keying a record on its own content rather than its list position. */
function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function looksLikeTemplate(text: string): boolean {
  const normalized = text.toLowerCase();
  return TEMPLATE_MARKERS.some((marker) => normalized.includes(marker));
}

function readWorkspaceFile(root: string, relativePath: string): string | undefined {
  const absolute = path.join(root, relativePath);
  if (!existsSync(absolute)) return undefined;
  try {
    if (statSync(absolute).size > LIMITS.sourceFileBytes) {
      // A file past the ceiling still exists — the caller learns that from the lane evidence and
      // the contradiction, rather than from a report that quietly pretends the file is absent.
      return undefined;
    }
    return readFileSync(absolute, "utf8");
  } catch {
    return undefined;
  }
}

function stageForPhase(phase: string): string {
  const normalized = phase.toLowerCase().trim();
  for (const [prefix, stage] of STAGE_BY_PHASE_PREFIX) {
    if (normalized.startsWith(prefix)) return stage;
  }
  return "discovery";
}

function notReady(reason: string, now: string): ImportBoundaryReport {
  return { schemaVersion: "1.0.0", generatedAt: now, workspaceReady: false, reason };
}

function laneOrigin(laneKey: string, sourcePath = STATE_FILE): ImportOrigin {
  const label = laneLabels.get(laneKey);
  return { sourcePath, laneKey, ...(label ? { laneLabel: label } : {}) };
}

/**
 * Splits a Markdown artifact into Formation sections on its own second-level headings. A document
 * with no headings becomes one section rather than none: the founder should still be able to read
 * what the launch workspace wrote, and an artifact that imports as zero sections would be rejected
 * by the platform's own deliverable rules and silently vanish.
 */
export function splitMarkdownSections(markdown: string): { title?: string; sections: ImportSection[] } {
  const lines = markdown.split(/\r?\n/);
  let title: string | undefined;
  const sections: ImportSection[] = [];
  let currentTitle = "";
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join("\n").trim();
    buffer = [];
    if (!currentTitle && !body) return;
    sections.push({ title: currentTitle || "Overview", body: body.slice(0, LIMITS.sectionBody) || "This section was empty in the launch workspace." });
  };

  for (const line of lines) {
    const h1 = /^#\s+(.*)$/.exec(line);
    if (h1 && title === undefined && sections.length === 0 && !currentTitle) {
      title = h1[1]!.trim();
      continue;
    }
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) {
      flush();
      currentTitle = h2[1]!.trim();
      continue;
    }
    buffer.push(line);
  }
  flush();

  if (sections.length === 0) {
    const body = markdown.trim();
    if (body) sections.push({ title: "Document", body: body.slice(0, LIMITS.sectionBody) });
  }
  return { title, sections: sections.slice(0, LIMITS.sectionsPerDeliverable) };
}

/**
 * Reads one Markdown pipe table out of a launch-trace section, keyed by the section's own heading.
 * The trace is a hand-maintained document, so this is deliberately forgiving: a missing section, a
 * header-only table, or a template placeholder row all produce no rows rather than an error.
 */
export function readTraceTable(trace: string, heading: string): Array<Record<string, string>> {
  const pattern = new RegExp(`^##\\s+${heading}\\s*$`, "im");
  const match = pattern.exec(trace);
  if (!match) return [];
  const rest = trace.slice(match.index + match[0].length);
  const end = /^##\s+/m.exec(rest);
  const body = end ? rest.slice(0, end.index) : rest;

  const rows = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));
  if (rows.length < 2) return [];

  const cells = (line: string) =>
    line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
  const headers = cells(rows[0]!);
  const isSeparator = (line: string) => /^\|[\s:|-]+\|$/.test(line);

  const output: Array<Record<string, string>> = [];
  for (const line of rows.slice(1)) {
    if (isSeparator(line)) continue;
    const values = cells(line);
    if (values.every((value) => !value)) continue;
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header.toLowerCase()] = values[index] ?? "";
    });
    output.push(row);
  }
  return output;
}

interface LaneEntry {
  readonly key: string;
  readonly status: string;
  readonly evidence: readonly string[];
  readonly blockers: readonly string[];
  readonly raw: Record<string, unknown>;
}

function readLanes(state: unknown): LaneEntry[] {
  const lanesValue = isRecord(state) ? state.lanes : undefined;
  if (!isRecord(lanesValue)) return [];
  const entries: LaneEntry[] = [];
  for (const [key, value] of Object.entries(lanesValue)) {
    if (!isRecord(value)) continue;
    entries.push({
      key,
      status: readString(value, "status"),
      evidence: readStringList(value, "evidence"),
      blockers: readStringList(value, "blockers"),
      raw: value,
    });
  }
  return entries;
}

/**
 * The verdicts the launch workspace records as founder calls. Both are real decisions with real
 * dates, and both are the kind of thing a founder should find already recorded in Formation
 * rather than have to remember and re-enter.
 */
const VERDICT_DECISIONS: ReadonlyArray<{
  readonly laneKey: string;
  readonly valueField: string;
  readonly dateField: string;
  readonly importKey: ImportKey;
  readonly title: string;
  readonly rationale: string;
  readonly phrasing: Readonly<Record<string, string>>;
}> = [
  {
    laneKey: "research",
    valueField: "go_pivot_kill_decision",
    dateField: "go_pivot_kill_decided_at",
    importKey: "decision:go-pivot-kill",
    title: "Continue, change direction, or stop",
    rationale: "Recorded at the pre-build checkpoint, after the market and demand research, before design and build effort was spent on the idea.",
    phrasing: {
      go: "Continue with this business as researched.",
      pivot: "Change direction before building further.",
      kill: "Stop work on this business.",
    },
  },
  {
    laneKey: "post_launch_ops",
    valueField: "kill_or_scale_decision",
    dateField: "kill_or_scale_decided_at",
    importKey: "decision:kill-or-scale",
    title: "Scale, hold, fix, or stop the live business",
    rationale: "Recorded at a post-launch review checkpoint, against how the business performed once it was live.",
    phrasing: {
      scale: "Put more into this business.",
      hold: "Hold the business steady without further investment for now.",
      fix: "Fix the identified problems before investing further.",
      kill: "Stop running this business.",
    },
  },
];

export function describeLaunchRepository(root: string, options: { now?: string } = {}): ImportBoundaryReport {
  const now = options.now ?? new Date().toISOString();

  const stateSource = readWorkspaceFile(root, STATE_FILE);
  if (stateSource === undefined) {
    return notReady("This folder is not a launch workspace: it has no state/PROJECT_STATE.yaml to read.", now);
  }

  let state: unknown;
  try {
    state = parseYaml(stateSource);
  } catch (error) {
    return notReady(`This launch workspace's state file could not be read: ${error instanceof Error ? error.message : String(error)}`, now);
  }
  if (!isRecord(state)) {
    return notReady("This launch workspace's state file does not describe a project.", now);
  }

  const project = isRecord(state.project) ? state.project : {};
  const name = readString(project, "name");
  if (TEMPLATE_NAMES.has(name.toLowerCase())) {
    return notReady("This launch workspace is still the untouched template — there is no business in it yet to bring across.", now);
  }

  const businessFile = BUSINESS_FILES.find((candidate) => existsSync(path.join(root, candidate))) ?? BUSINESS_FILES[0];
  const businessSource = readWorkspaceFile(root, businessFile);
  let business: unknown;
  try {
    business = businessSource ? JSON.parse(businessSource) : undefined;
  } catch {
    business = undefined;
  }
  const businessBlock = isRecord(business) && isRecord(business.business) ? business.business : {};

  const traceSource = readWorkspaceFile(root, TRACE_FILE) ?? "";
  const laneEntries = readLanes(state);

  const claims: ImportClaim[] = [];
  const decisions: ImportDecision[] = [];
  const tasks: ImportTask[] = [];
  const deliverables: ImportDeliverable[] = [];
  const contradictions: ImportContradiction[] = [];

  const company = buildCompany(root, state, project, businessBlock, now);
  collectLaneRecords(root, laneEntries, claims, tasks, deliverables, contradictions);
  collectLaneDependencyContradictions(laneEntries, contradictions);
  collectVerdictDecisions(laneEntries, decisions);
  collectTraceRecords(traceSource, decisions, tasks);
  collectOperatingRecords(state, tasks, claims);
  collectPlaceholderContradictions(state, businessBlock, businessFile, contradictions);
  collectReconciliationContradictions(state, laneEntries, contradictions);

  return {
    schemaVersion: "1.0.0",
    generatedAt: now,
    workspaceReady: true,
    company,
    claims: claims.slice(0, LIMITS.claims),
    decisions: decisions.slice(0, LIMITS.decisions),
    tasks: tasks.slice(0, LIMITS.tasks),
    deliverables: deliverables.slice(0, LIMITS.deliverables),
    contradictions: contradictions.slice(0, LIMITS.contradictions),
  };
}

function buildCompany(
  root: string,
  state: Record<string, unknown>,
  project: Record<string, unknown>,
  businessBlock: Record<string, unknown>,
  now: string,
): ImportCompany {
  const name = readString(project, "name");
  const phase = readString(project, "phase") || "phase_0_orient";
  const publicUrls = isRecord(project.public_urls) ? project.public_urls : {};
  const postLaunch = isRecord(state.lanes) && isRecord((state.lanes as Record<string, unknown>).post_launch_ops)
    ? ((state.lanes as Record<string, unknown>).post_launch_ops as Record<string, unknown>)
    : {};

  const positioning = readString(businessBlock, "positioning");
  const audience = readString(businessBlock, "targetAudience");
  const liveSince = readString(postLaunch, "live_since");
  const landing = readString(publicUrls, "landing");
  const stateUpdatedAt = readString(state, "updated_at");
  void root;
  void now;

  return {
    name,
    slug: readString(project, "slug") || slugify(name) || "imported-company",
    stage: readString(businessBlock, "stage") === "live" ? "growth" : stageForPhase(phase),
    founderName: readString(project, "owner") || "Founder",
    oneLiner: positioning && !looksLikeTemplate(positioning) ? truncate(positioning, LIMITS.statement) : `${name} is being brought across from an existing launch workspace.`,
    targetCustomer: audience && !looksLikeTemplate(audience) ? truncate(audience, 4_000) : "The launch workspace has not named a primary customer yet.",
    enginePhase: phase,
    launchScope: readString(project, "launch_scope") || readString(project, "launch_tier") || "essentials",
    platforms: readStringList(project, "platforms"),
    ...(landing ? { landingUrl: landing } : {}),
    ...(stateUpdatedAt ? { stateUpdatedAt } : {}),
    ...(liveSince ? { liveSince } : {}),
  };
}

/**
 * Turns each lane into the records it actually justifies. A lane recorded done is a claim to
 * review, not a fact; a lane recorded blocked or partial is work still to do; every Markdown file
 * a lane cites as evidence is a deliverable the founder should be able to read inside Formation.
 * Evidence a lane cites but that is not on disk is the single most common way a launch workspace
 * lies to itself, so it is reported against the very claim it was supposed to support.
 */
function collectLaneRecords(
  root: string,
  laneEntries: readonly LaneEntry[],
  claims: ImportClaim[],
  tasks: ImportTask[],
  deliverables: ImportDeliverable[],
  contradictions: ImportContradiction[],
): void {
  const seenDeliverables = new Set<string>();

  for (const lane of laneEntries) {
    const origin = laneOrigin(lane.key);
    const label = laneLabels.get(lane.key) ?? lane.key;

    if (lane.status && !statusValues.has(lane.status)) {
      contradictions.push({
        code: "lane_status_unrecognised",
        severity: "advisory",
        message: `The ${label} lane records a status this engine does not define ("${lane.status}"), so what it claims cannot be classified.`,
        origin,
      });
    }

    const present: string[] = [];
    for (const evidencePath of lane.evidence) {
      const absolute = path.join(root, evidencePath);
      if (existsSync(absolute)) {
        present.push(evidencePath);
        if (evidencePath.toLowerCase().endsWith(".md") && !seenDeliverables.has(evidencePath)) {
          seenDeliverables.add(evidencePath);
          const deliverable = readDeliverable(root, evidencePath, lane.key);
          if (deliverable) deliverables.push(deliverable);
        }
        continue;
      }
      if (lane.status === "done") {
        contradictions.push({
          code: "lane_evidence_missing",
          severity: "blocking",
          message: `The ${label} lane is recorded as finished, but the evidence it names (${evidencePath}) is not in the workspace.`,
          relatesTo: `lane:${lane.key}:done`,
          origin: { ...origin, sourcePath: evidencePath },
        });
      }
    }

    if (lane.status === "done") {
      claims.push({
        importKey: `lane:${lane.key}:done`,
        kind: "recommendation",
        statement: truncate(`The launch workspace records ${label} as finished. Confirm it still holds before anything depends on it.`, LIMITS.statement),
        evidence: present.slice(0, LIMITS.evidencePerClaim),
        origin,
      });
    } else if (lane.status === "partial" || lane.status === "blocked") {
      tasks.push({
        importKey: `task:lane:${lane.key}`,
        title: truncate(lane.status === "blocked" ? `${label} is stuck and needs a way forward` : `Finish the ${label} work that was left part-done`, 300),
        urgency: lane.status === "blocked" ? "high" : "medium",
        blocked: lane.status === "blocked",
        origin,
      });
    }

    for (const blocker of lane.blockers) {
      tasks.push({
        importKey: `task:lane:${lane.key}:blocker:${digest(blocker)}`,
        title: truncate(`${label}: ${blocker}`, 300),
        urgency: "high",
        blocked: true,
        origin,
      });
    }
  }
}

function readDeliverable(root: string, relativePath: string, laneKey: string): ImportDeliverable | undefined {
  const source = readWorkspaceFile(root, relativePath);
  if (source === undefined || !source.trim()) return undefined;
  const { title, sections } = splitMarkdownSections(source);
  if (sections.length === 0) return undefined;
  return {
    importKey: `deliverable:${relativePath}`,
    title: truncate(title || path.basename(relativePath, path.extname(relativePath)).replace(/[_-]+/g, " "), 300),
    sections,
    fingerprint: createHash("sha256").update(source).digest("hex"),
    origin: laneOrigin(laneKey, relativePath),
  };
}

/**
 * A lane cannot honestly be finished while the lane it depends on is not. The engine already
 * enforces this during a run; a legacy workspace edited by hand can drift out of it, and the
 * drift is exactly what an importer should hand the founder rather than carry across silently.
 */
function collectLaneDependencyContradictions(laneEntries: readonly LaneEntry[], contradictions: ImportContradiction[]): void {
  const statuses = new Map(laneEntries.map((lane) => [lane.key, lane.status]));
  for (const lane of laneEntries) {
    if (lane.status !== "done") continue;
    // A dated dependency_override is the workspace's own recorded reason for finishing over an
    // open upstream. The engine downgrades it to a warning there; honouring it here keeps the
    // importer from re-raising a question the founder already answered in writing.
    if (readString(lane.raw, "dependency_override")) continue;
    for (const upstream of laneDependencies[lane.key] ?? []) {
      const upstreamStatus = statuses.get(upstream);
      if (upstreamStatus === undefined || satisfiedDependencyStatuses.has(upstreamStatus)) continue;
      contradictions.push({
        code: "lane_dependency_unmet",
        severity: "advisory",
        message: `${laneLabels.get(lane.key) ?? lane.key} is recorded as finished, but ${laneLabels.get(upstream) ?? upstream}, which it builds on, is not (${upstreamStatus || "unrecorded"}).`,
        relatesTo: `lane:${lane.key}:done`,
        origin: laneOrigin(lane.key),
      });
    }
  }
}

function collectVerdictDecisions(laneEntries: readonly LaneEntry[], decisions: ImportDecision[]): void {
  const byKey = new Map(laneEntries.map((lane) => [lane.key, lane]));
  for (const verdict of VERDICT_DECISIONS) {
    const lane = byKey.get(verdict.laneKey);
    if (!lane) continue;
    const value = readString(lane.raw, verdict.valueField).toLowerCase();
    if (!value) continue;
    const phrasing = verdict.phrasing[value];
    if (!phrasing) continue;
    const decidedAt = readString(lane.raw, verdict.dateField);
    decisions.push({
      importKey: verdict.importKey,
      title: verdict.title,
      decision: phrasing,
      rationale: verdict.rationale,
      status: "decided",
      ...(decidedAt ? { decidedAt } : {}),
      origin: laneOrigin(verdict.laneKey),
    });
  }
}

/**
 * The launch trace is where a workspace writes down what it decided *not* to do and what still
 * needs the founder. Both matter more than most of what it records as done: a rejected route
 * carried across stops the same argument being had twice, and a pending founder gate is the
 * clearest possible statement of what Formation should put in front of the founder first.
 */
function collectTraceRecords(trace: string, decisions: ImportDecision[], tasks: ImportTask[]): void {
  if (!trace.trim()) return;

  for (const row of readTraceTable(trace, "Rejected Decisions")) {
    const title = row["rejected decision"] ?? "";
    const why = row["why rejected"] ?? "";
    if (!title || looksLikeTemplate(title)) continue;
    decisions.push({
      importKey: `decision:rejected:${digest(title)}`,
      title: truncate(`Considered and rejected: ${title}`, 300),
      decision: truncate(title, LIMITS.sectionBody),
      rationale: truncate(why || "The launch workspace recorded this as rejected without a reason.", LIMITS.sectionBody),
      status: "superseded",
      origin: { sourcePath: TRACE_FILE },
    });
  }

  for (const row of readTraceTable(trace, "Founder-Only Decisions")) {
    const title = row["decision"] ?? "";
    const status = (row["status"] ?? "").toLowerCase();
    if (!title || looksLikeTemplate(title)) continue;
    const approved = ["approved", "decided", "done", "yes"].includes(status);
    decisions.push({
      importKey: `decision:founder:${digest(title)}`,
      title: truncate(title, 300),
      decision: approved ? truncate(title, LIMITS.sectionBody) : "Not decided yet — the launch workspace was waiting on you.",
      rationale: "Recorded in the launch workspace as a call only the founder can make.",
      status: approved ? "decided" : "proposed",
      origin: { sourcePath: TRACE_FILE },
    });
  }

  for (const row of readTraceTable(trace, "Blockers")) {
    const blocker = row["blocker"] ?? Object.values(row)[0] ?? "";
    if (!blocker || looksLikeTemplate(blocker)) continue;
    tasks.push({
      importKey: `task:trace:blocker:${digest(blocker)}`,
      title: truncate(blocker, 300),
      urgency: "high",
      blocked: true,
      origin: { sourcePath: TRACE_FILE },
    });
  }
}

/**
 * The workspace's own account of what it is waiting on. `next_founder_action` is the single thing
 * the agent believed only the founder could unblock, and an open question with a founder owner is
 * the same statement in a different shape — neither survives a hand-off unless it is carried.
 */
function collectOperatingRecords(state: Record<string, unknown>, tasks: ImportTask[], claims: ImportClaim[]): void {
  const operator = isRecord(state.business_operator) ? state.business_operator : {};
  const nextFounderAction = readString(operator, "next_founder_action");
  if (nextFounderAction && !looksLikeTemplate(nextFounderAction)) {
    tasks.push({
      importKey: `task:operator:next-founder-action:${digest(nextFounderAction)}`,
      title: truncate(nextFounderAction, 300),
      urgency: "critical",
      blocked: false,
      origin: { sourcePath: STATE_FILE },
    });
  }

  const failureCards = isRecord(state.failure_cards) ? state.failure_cards : {};
  const active = Array.isArray(failureCards.active) ? failureCards.active : [];
  for (const card of active) {
    if (!isRecord(card)) continue;
    const id = readString(card, "id");
    const nextAction = readString(card, "next_action");
    if (!id || readString(card, "status") === "resolved") continue;
    tasks.push({
      importKey: `task:failure-card:${digest(id)}`,
      title: truncate(nextAction || `Resolve the recorded problem "${id}"`, 300),
      urgency: readString(card, "severity") === "high" ? "critical" : "high",
      blocked: true,
      origin: { sourcePath: STATE_FILE },
    });
  }

  const questions = Array.isArray(state.open_questions) ? state.open_questions : [];
  for (const entry of questions) {
    if (!isRecord(entry)) continue;
    const question = readString(entry, "question");
    if (!question || looksLikeTemplate(question)) continue;
    claims.push({
      importKey: `question:${digest(question)}`,
      kind: "question",
      statement: truncate(question, LIMITS.statement),
      evidence: readStringList(entry, "blocks").slice(0, LIMITS.evidencePerClaim),
      origin: { sourcePath: STATE_FILE },
    });
  }
}

/**
 * Values still carrying the template's own examples. These are the ambiguous-classification cases
 * the gaps document asks for: the field exists, so the workspace looks filled in, but what it says
 * is the prompt rather than the answer.
 */
function collectPlaceholderContradictions(
  state: Record<string, unknown>,
  businessBlock: Record<string, unknown>,
  businessFile: string,
  contradictions: ImportContradiction[],
): void {
  const project = isRecord(state.project) ? state.project : {};
  const bundleIds = isRecord(project.bundle_ids) ? project.bundle_ids : {};
  for (const [platform, value] of Object.entries(bundleIds)) {
    if (typeof value !== "string" || !looksLikeTemplate(value)) continue;
    contradictions.push({
      code: "placeholder_value",
      severity: "advisory",
      message: `The ${platform} app identifier is still the template's example value ("${value}"), so nothing that depends on it is real yet.`,
      origin: { sourcePath: STATE_FILE },
    });
  }
  for (const field of ["positioning", "targetAudience"]) {
    const value = readString(businessBlock, field);
    if (!value || !looksLikeTemplate(value)) continue;
    contradictions.push({
      code: "placeholder_value",
      severity: "advisory",
      message: `The business's ${field === "positioning" ? "promise" : "primary customer"} is still the template's placeholder text, so it was never answered.`,
      origin: { sourcePath: businessFile },
    });
  }
}

/**
 * A workspace that says its own state has not been reconciled is telling the importer that what
 * follows may not match reality. Carrying finished lanes across on that basis without saying so
 * would be the importer inheriting a doubt the workspace was honest enough to record.
 */
function collectReconciliationContradictions(
  state: Record<string, unknown>,
  laneEntries: readonly LaneEntry[],
  contradictions: ImportContradiction[],
): void {
  const finished = laneEntries.filter((lane) => lane.status === "done").length;
  if (finished === 0) return;
  const continuity = isRecord(state.continuity) ? state.continuity : {};
  const orchestration = isRecord(state.orchestration) ? state.orchestration : {};
  const reviewed = readString(continuity, "last_state_review");
  if (reviewed && reviewed !== "not_reviewed" && orchestration.state_reconciled !== false) return;
  contradictions.push({
    code: "state_not_reconciled",
    severity: "advisory",
    message: `The launch workspace records ${finished} finished ${finished === 1 ? "area" : "areas"} but also says its own state has not been reconciled against the files, so treat what it claims as unconfirmed.`,
    origin: { sourcePath: STATE_FILE },
  });
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  if (!args.workspace) {
    console.error("platform-import.missing_argument: --workspace is required");
    return 1;
  }
  const report = describeLaunchRepository(path.resolve(args.workspace), { now: args.now });
  console.log(JSON.stringify(report, null, 2));
  return 0;
}

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`platform-import.crashed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    process.exitCode = 1;
  }
}
