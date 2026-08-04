import type { GraphId, GraphNodeKind } from "./types.js";

export function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unnamed"
  );
}

export function graphId<T extends GraphNodeKind>(kind: T, ...parts: string[]): `${T}.${string}` {
  return `${kind}.${parts.map(slug).join(".")}` as `${T}.${string}`;
}

export function isGraphId(value: string): value is GraphId {
  return /^(area|domain|phase|lane|reference|context|workflow|artifact|gate|operator|provider)\.[a-z0-9][a-z0-9.-]*$/.test(value);
}
