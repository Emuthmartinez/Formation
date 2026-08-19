import { randomUUID } from "node:crypto";

export function createId(prefix) {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

/**
 * The workstream launch-engine records file under: the launch plan when the workspace has one.
 * Shared by the approvals mirror and the results import so both halves of the skill boundary
 * file into the same stream.
 */
export function launchWorkstreamId(workspace) {
  const streams = workspace.workstreams ?? [];
  return streams.find((entry) => entry.id === "launch")?.id ?? streams[0]?.id ?? "launch";
}

export function cleanText(value, fallback, maximumLength = 20_000) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maximumLength) : fallback;
}

export function normalizeDate(value) {
  if (typeof value !== "string" || !isCalendarDate(value)) return null;
  return value;
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function priorityRank(priority) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority] ?? 4;
}

export function stableValue(value) {
  if (typeof value === "string") return value.trim().toLowerCase();
  return JSON.stringify(value);
}

export function humanizeKey(key) {
  const words = key.replaceAll(/[._-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function clampNumber(value, min, max) {
  const numeric = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(numeric) ? numeric : min));
}
