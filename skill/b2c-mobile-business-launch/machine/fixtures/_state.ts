import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export type MutableRecord = Record<string, unknown>;

export function expectRecord(value: unknown, label: string): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as MutableRecord;
}

export function readState(root: string): MutableRecord {
  return expectRecord(parseYaml(readFileSync(path.join(root, "PROJECT_STATE.yaml"), "utf8")), "PROJECT_STATE.yaml");
}

export function writeState(root: string, state: MutableRecord): void {
  writeFileSync(path.join(root, "PROJECT_STATE.yaml"), stringifyYaml(state), "utf8");
}

export function getLane(state: MutableRecord, name: string): MutableRecord {
  const lanes = expectRecord(state.lanes, "PROJECT_STATE.yaml lanes");
  return expectRecord(lanes[name], `PROJECT_STATE.yaml lanes.${name}`);
}

export function getTools(state: MutableRecord): MutableRecord {
  return expectRecord(state.tools, "PROJECT_STATE.yaml tools");
}
