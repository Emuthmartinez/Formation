#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { laneKeys, mapV1LaneStatus, type BusinessStateV2, type ControlFile, type Lane, type PendingFounderGate, type ProtectedCategory, type Status, type V1LaneStatus } from "./types.js";

export interface MigrationResult {
  businessState: BusinessStateV2;
  control: ControlFile;
  warnings: string[];
}

const founderOnlyGateCategory: Record<string, ProtectedCategory> = {
  "paid tool signups or spend": "spend",
  "credentials, secrets, and account access": "credentials_access",
  "legal, privacy, or pricing approval": "legal_pricing",
  "destructive or irreversible actions": "destructive",
  "app store or google play submission": "release",
  "public posting or scheduling": "public_actions",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * v2's schema requires a `phase_` prefix; some live v1 states carry free-form phase labels
 * (e.g. a mid-rebuild marker). Prefix rather than reject — the label's meaning is the
 * founder's, and losing it in migration would be silent data loss.
 */
function normalizePhase(value: string): string {
  return value.startsWith("phase_") ? value : `phase_${value}`;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function migrateLaneStatus(value: unknown): Status {
  const v1LaneStatuses: readonly V1LaneStatus[] = ["not_started", "partial", "blocked", "not_needed", "deferred", "done"];
  const candidate = typeof value === "string" ? (value as V1LaneStatus) : "not_started";
  return mapV1LaneStatus(v1LaneStatuses.includes(candidate) ? candidate : "not_started");
}

function migrateLane(source: unknown): Lane {
  const record = isRecord(source) ? source : {};
  const { status: _status, evidence: _evidence, blockers: _blockers, ...rest } = record;
  return {
    status: migrateLaneStatus(record.status),
    evidence: asStringArray(record.evidence),
    blockers: asStringArray(record.blockers),
    ...rest,
  };
}

function migrateLaunchScope(project: Record<string, unknown>): "essentials" | "full" {
  const scope = asString(project.launch_scope);
  if (scope === "essentials" || scope === "full") return scope;
  const legacyTier = asString(project.launch_tier);
  if (legacyTier === "full") return "full";
  return "essentials";
}

function migratePlatforms(project: Record<string, unknown>): Array<"ios" | "android"> {
  const raw = Array.isArray(project.platforms) ? project.platforms : [];
  const filtered = raw.filter((entry): entry is "ios" | "android" => entry === "ios" || entry === "android");
  return filtered.length > 0 ? filtered : ["ios"];
}

function buildFounderOnlyGates(founderOnlyGates: unknown, now: string): PendingFounderGate[] {
  const entries = asStringArray(founderOnlyGates);
  return entries.map((label, index) => {
    const category = founderOnlyGateCategory[label.toLowerCase()] ?? "other";
    return {
      id: `migrated-founder-only-gate-${index + 1}`,
      category,
      reason: `Migrated from v1 autonomy.founder_only_gates: "${label}". Re-present as a specific decision before taking the underlying action; nothing is auto-approved by this migration.`,
      createdAt: now,
    };
  });
}

function buildActiveGateFollowUp(operator: Record<string, unknown>, now: string): PendingFounderGate | undefined {
  const activeGateId = asString(operator.active_gate_id);
  const activeGateStatus = asString(operator.active_gate_status);
  if (!activeGateId || activeGateStatus !== "pending") return undefined;
  const activeGateClass = asString(operator.active_gate_class);
  const category: ProtectedCategory | "other" =
    activeGateClass === "spend"
      ? "spend"
      : activeGateClass === "access"
        ? "credentials_access"
        : activeGateClass === "legal" || activeGateClass === "pricing"
          ? "legal_pricing"
          : activeGateClass === "public_action"
            ? "public_actions"
            : activeGateClass === "release"
              ? "release"
              : activeGateClass === "destructive"
                ? "destructive"
                : "other";
  return {
    id: `migrated-active-gate-${activeGateId}`,
    category,
    reason: `Migrated from v1 business_operator.active_gate_id "${activeGateId}" (class "${activeGateClass || "unknown"}"). Demoted to re-present; no approval carried forward.`,
    sourceLegacyId: activeGateId,
    createdAt: now,
  };
}

export function migrateProjectStateV1(v1State: unknown, now: string = new Date().toISOString()): MigrationResult {
  if (!isRecord(v1State)) throw new Error("v1 PROJECT_STATE did not parse to an object");
  const warnings: string[] = [];

  const narrativeSource = isRecord(v1State.narrative) ? v1State.narrative : {};
  const projectSource = isRecord(v1State.project) ? v1State.project : {};
  const lanesSource = isRecord(v1State.lanes) ? v1State.lanes : {};
  const autonomySource = isRecord(v1State.autonomy) ? v1State.autonomy : {};
  const operatorSource = isRecord(v1State.business_operator) ? v1State.business_operator : {};
  const continuitySource = isRecord(v1State.continuity) ? v1State.continuity : {};
  const bundleIdsSource = isRecord(projectSource.bundle_ids) ? projectSource.bundle_ids : {};
  const publicUrlsSource = isRecord(projectSource.public_urls) ? projectSource.public_urls : {};

  const lanes = {} as BusinessStateV2["lanes"];
  for (const key of laneKeys) {
    if (!(key in lanesSource)) warnings.push(`v1 state is missing lane "${key}"; defaulting to not_started`);
    lanes[key] = migrateLane(lanesSource[key]);
  }

  const pending = buildFounderOnlyGates(autonomySource.founder_only_gates, now);
  const activeGateFollowUp = buildActiveGateFollowUp(operatorSource, now);
  if (activeGateFollowUp) pending.push(activeGateFollowUp);
  if (pending.length === 0) {
    warnings.push("v1 state carried no founder_only_gates and no pending active gate; founderGates.pending is empty");
  }

  const businessState: BusinessStateV2 = {
    schemaVersion: "2.0.0",
    updatedAt: now,
    narrative: {
      sinceLastTime: asString(narrativeSource.since_last_time),
      rightNow: asString(narrativeSource.right_now),
      yourCall: asString(narrativeSource.your_call),
      lastCelebratedPhase: asString(narrativeSource.last_celebrated_phase),
    },
    project: {
      name: asString(projectSource.name, "App Name"),
      slug: asString(projectSource.slug, "app-name"),
      owner: asString(projectSource.owner),
      phase: normalizePhase(asString(projectSource.phase, "phase_0_orient")),
      launchScope: migrateLaunchScope(projectSource),
      kickoffDate: asString(projectSource.kickoff_date),
      platforms: migratePlatforms(projectSource),
      bundleIds: { ios: asString(bundleIdsSource.ios), android: asString(bundleIdsSource.android) },
      publicUrls: { landing: asString(publicUrlsSource.landing), privacy: asString(publicUrlsSource.privacy), terms: asString(publicUrlsSource.terms) },
    },
    lanes,
    founderGates: { pending },
    continuity: {
      lastStateReview: asString(continuitySource.last_state_review, "not_reviewed"),
      sourceFiles: asStringArray(continuitySource.source_files),
      gitStatusReviewed: continuitySource.git_status_reviewed === true,
      nextAction: asString(continuitySource.next_action),
    },
  };

  const control: ControlFile = {
    schemaVersion: "1.0.0",
    updatedAt: now,
    businessSlug: businessState.project.slug,
    stateHash: "",
    killSwitch: { engaged: false, engagedAt: "", engagedBy: "", reason: "" },
    grants: {},
    waivers: [],
  };

  if (warnings.length > 0) {
    for (const warning of warnings) console.warn(`migrate-v1: ${warning}`);
  }

  return { businessState, control, warnings };
}

function isMainModule(): boolean {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
}

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token?.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        index += 1;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
}

if (isMainModule()) {
  const args = parseArgs(process.argv.slice(2));
  const statePath = args.state ?? "workspace/business/state/PROJECT_STATE.yaml";
  const outState = args["out-state"] ?? statePath.replace(/\.ya?ml$/i, ".v2.json");
  const outControl = args["out-control"] ?? path.join(path.dirname(statePath), "control.json");
  if (!existsSync(statePath)) throw new Error(`Missing v1 state file: ${statePath}`);
  const v1State: unknown = parseYaml(readFileSync(statePath, "utf8"));
  const result = migrateProjectStateV1(v1State);
  writeFileSync(outState, `${JSON.stringify(result.businessState, null, 2)}\n`, "utf8");
  writeFileSync(outControl, `${JSON.stringify(result.control, null, 2)}\n`, "utf8");
  console.log(`Migrated ${statePath} -> ${outState} and ${outControl}. ${result.businessState.founderGates.pending.length} founder gate(s) demoted to re-present.`);
}
