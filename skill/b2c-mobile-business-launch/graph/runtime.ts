import { lanes } from "./lanes.js";
import { phases } from "./phases.js";

export const graphSchemaVersion = "1.0.0" as const;
export const phaseOrder = [...phases].sort((a, b) => a.order - b.order).map((phase) => phase.key);
export const PHASE_ORIENT_LAST_INDEX = Math.max(
  ...phases.filter((phase) => "orientWindow" in phase && phase.orientWindow === true).map((phase) => phase.order),
);
export const requiredLanes = lanes.map((lane) => lane.key);
export const laneDependencies: Record<string, string[]> = Object.fromEntries(
  lanes.map((lane) => [
    lane.key,
    lane.dependencyIds.map((dependencyId) => {
      const dependency = lanes.find((candidate) => candidate.id === dependencyId);
      if (!dependency) throw new Error(`Unknown lane dependency ${dependencyId}`);
      return dependency.key;
    }),
  ]),
);
