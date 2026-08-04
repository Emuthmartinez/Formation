#!/usr/bin/env node
/**
 * check-change-cascade.ts — surface-coverage gate for recorded change cascades.
 *
 * playbook/process/change-cascade.md says a change to a launched app is not done
 * until every impacted surface is "updated or explicitly marked unaffected".
 * That was an honour system: the map lived in a markdown table no validator
 * could read, so a cascade could silently skip a surface and still read as
 * complete.
 *
 * This validator reads the same map as data (playbook/process/cascade-edges.yaml)
 * and grades the `change_cascade` block a launch run records in its own
 * state/PROJECT_STATE.yaml:
 *
 *   change_cascade:
 *     - id: "rename-streaks-to-runs"
 *       type: "lexicon_change"
 *       recorded_at: "2026-07-25"
 *       surfaces:
 *         app_in_app: { status: "updated", evidence: "product/ONBOARDING.md" }
 *         asc_listing: { status: "updated", evidence: "APP_STORE_LISTING.md" }
 *         seo_geo:     { status: "unaffected", reason: "term never appears in target keywords" }
 *
 * Errors when: the change type is unknown, a surface the map says is impacted
 * is missing entirely, an "updated" surface has no evidence, an "unaffected"
 * surface has no reason, or a surface id is not in the inventory.
 *
 * The edge set ships with the skill and is not copied into business repos, so
 * a launch run cannot edit the map that grades it — only record against it.
 *
 * npm script: check:change-cascade
 * Usage: tsx gates/process/check-change-cascade.ts --root /path/to/app [--skill-root .]
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { asString, getPath, isRecord, issue, type Issue, loadProjectState, parseCliArgs, reportAndExit } from "../../scripts/lib/launch-state.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSkillRoot = path.resolve(scriptDir, "../..");

/** Statuses a recorded surface may carry. */
const SURFACE_STATUSES = new Set(["updated", "unaffected", "blocked"]);

interface CascadeMap {
  surfaces: Record<string, { label?: string }>;
  changeTypes: Record<string, { label?: string; cascade_to: string[] }>;
}

function resolveSkillRoot(argv: string[]): string {
  const index = argv.indexOf("--skill-root");
  if (index >= 0 && argv[index + 1]) return path.resolve(argv[index + 1] as string);
  return defaultSkillRoot;
}

/** Load and shape-check the shipped edge map. A broken map is a maintainer bug. */
function loadCascadeMap(skillRoot: string, issues: Issue[]): CascadeMap | undefined {
  const mapPath = path.join(skillRoot, "playbook", "process", "cascade-edges.yaml");
  if (!existsSync(mapPath)) {
    issues.push(
      issue(
        "error",
        "change_cascade.map_missing",
        `playbook/process/cascade-edges.yaml is missing at ${mapPath}. It is the data form of the Change Cascade Map.`,
        mapPath,
      ),
    );
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(readFileSync(mapPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push(issue("error", "change_cascade.map_parse_error", `playbook/process/cascade-edges.yaml is invalid YAML: ${message}`, mapPath));
    return undefined;
  }

  const surfacesRaw = getPath(parsed, "surfaces");
  const typesRaw = getPath(parsed, "change_types");
  if (!isRecord(surfacesRaw) || !isRecord(typesRaw)) {
    issues.push(
      issue("error", "change_cascade.map_malformed", "playbook/process/cascade-edges.yaml must define both `surfaces` and `change_types` mappings.", mapPath),
    );
    return undefined;
  }

  const surfaces: CascadeMap["surfaces"] = {};
  for (const [id, value] of Object.entries(surfacesRaw)) {
    surfaces[id] = { label: isRecord(value) ? asString(value.label) : undefined };
  }

  const changeTypes: CascadeMap["changeTypes"] = {};
  for (const [id, value] of Object.entries(typesRaw)) {
    const cascadeTo = isRecord(value) && Array.isArray(value.cascade_to) ? value.cascade_to.filter((entry): entry is string => typeof entry === "string") : [];
    if (cascadeTo.length === 0) {
      issues.push(issue("error", `change_cascade.map.${id}.no_edges`, `cascade-edges.yaml change type "${id}" lists no cascade_to surfaces.`, mapPath));
    }
    for (const surface of cascadeTo) {
      if (!surfaces[surface]) {
        issues.push(
          issue(
            "error",
            `change_cascade.map.${id}.unknown_surface`,
            `cascade-edges.yaml change type "${id}" names surface "${surface}", which is not in the surface inventory.`,
            mapPath,
          ),
        );
      }
    }
    changeTypes[id] = { label: isRecord(value) ? asString(value.label) : undefined, cascade_to: cascadeTo };
  }

  return { surfaces, changeTypes };
}

const argv = process.argv.slice(2);
const args = parseCliArgs(argv);
const skillRoot = resolveSkillRoot(argv);
const issues: Issue[] = [];

const map = loadCascadeMap(skillRoot, issues);
const loaded = loadProjectState(args);
issues.push(...loaded.issues);

if (map && loaded.state) {
  const recorded = getPath(loaded.state, "change_cascade");

  // An absent or empty block is clean: most launches have not shipped a
  // post-launch change yet. This gate gets teeth the moment one is recorded.
  const entries = Array.isArray(recorded) ? recorded : [];
  if (recorded !== undefined && !Array.isArray(recorded)) {
    issues.push(
      issue(
        "error",
        "change_cascade.block_malformed",
        "state/PROJECT_STATE.yaml change_cascade must be a list of recorded changes.",
        "state/PROJECT_STATE.yaml",
      ),
    );
  }

  let graded = 0;

  entries.forEach((entry, index) => {
    if (!isRecord(entry)) {
      issues.push(
        issue(
          "error",
          `change_cascade[${index}].malformed`,
          `change_cascade[${index}] must be a mapping with id, type, and surfaces.`,
          "state/PROJECT_STATE.yaml",
        ),
      );
      return;
    }

    const id = asString(entry.id) ?? `#${index}`;
    const type = asString(entry.type);

    if (!type) {
      issues.push(
        issue(
          "error",
          `change_cascade.${id}.type_missing`,
          `change_cascade entry "${id}" has no type. Classify it against the Change Cascade Map before calling the change done.`,
          "state/PROJECT_STATE.yaml",
        ),
      );
      return;
    }

    const definition = map.changeTypes[type];
    if (!definition) {
      const known = Object.keys(map.changeTypes).join(", ");
      issues.push(
        issue(
          "error",
          `change_cascade.${id}.unknown_type`,
          `change_cascade entry "${id}" has type "${type}", which is not in cascade-edges.yaml. Known types: ${known}.`,
          "state/PROJECT_STATE.yaml",
        ),
      );
      return;
    }

    graded += 1;
    const surfacesRecorded = isRecord(entry.surfaces) ? entry.surfaces : {};

    // Every surface the map says is impacted must be accounted for.
    for (const surface of definition.cascade_to) {
      const record = surfacesRecorded[surface];
      const label = map.surfaces[surface]?.label ?? surface;

      if (!isRecord(record)) {
        issues.push(
          issue(
            "error",
            `change_cascade.${id}.${surface}.unaccounted`,
            `change_cascade entry "${id}" (${definition.label ?? type}) does not account for the ${label} surface. ` +
              `Record it as updated with evidence, unaffected with a reason, or blocked — a surface left out by omission is the change-cascade-incomplete failure card.`,
            "state/PROJECT_STATE.yaml",
          ),
        );
        continue;
      }

      const status = asString(record.status);
      if (!status || !SURFACE_STATUSES.has(status)) {
        issues.push(
          issue(
            "error",
            `change_cascade.${id}.${surface}.status_invalid`,
            `change_cascade entry "${id}" surface ${surface} has status "${status ?? "(missing)"}". Use one of: ${[...SURFACE_STATUSES].join(", ")}.`,
            "state/PROJECT_STATE.yaml",
          ),
        );
        continue;
      }

      if (status === "updated" && !asString(record.evidence)?.trim()) {
        issues.push(
          issue(
            "error",
            `change_cascade.${id}.${surface}.evidence_missing`,
            `change_cascade entry "${id}" marks ${label} updated but records no evidence. Point at the artifact, re-rendered asset, or console change that proves it.`,
            "state/PROJECT_STATE.yaml",
          ),
        );
      }

      if (status === "unaffected" && !asString(record.reason)?.trim()) {
        issues.push(
          issue(
            "error",
            `change_cascade.${id}.${surface}.reason_missing`,
            `change_cascade entry "${id}" marks ${label} unaffected but records no reason. One line of why it is untouched is the difference between a decision and an omission.`,
            "state/PROJECT_STATE.yaml",
          ),
        );
      }

      if (status === "blocked" && !asString(record.blocker)?.trim()) {
        issues.push(
          issue(
            "error",
            `change_cascade.${id}.${surface}.blocker_missing`,
            `change_cascade entry "${id}" marks ${label} blocked but records no blocker.`,
            "state/PROJECT_STATE.yaml",
          ),
        );
      }
    }

    // Surface ids outside the inventory are typos that would otherwise look
    // like diligence — a recorded surface nobody grades.
    for (const surface of Object.keys(surfacesRecorded)) {
      if (!map.surfaces[surface]) {
        issues.push(
          issue(
            "error",
            `change_cascade.${id}.${surface}.unknown_surface`,
            `change_cascade entry "${id}" records surface "${surface}", which is not in the cascade-edges.yaml inventory. Fix the id so it is actually graded.`,
            "state/PROJECT_STATE.yaml",
          ),
        );
      }
    }
  });

  console.log(`Change cascade ledger — ${graded} recorded change(s) graded against ${Object.keys(map.changeTypes).length} change types.`);
}

reportAndExit("Change cascade check", issues);
