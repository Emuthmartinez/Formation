import type {
  BusinessAreaDefinition,
  ContextPackDefinition,
  DomainDefinition,
  LaneDefinition,
  OperatorDefinition,
  PhaseDefinition,
  WorkflowDefinition,
} from "./types.js";

export function defineAreas<const T extends readonly BusinessAreaDefinition[]>(items: T): T {
  return items;
}

export function defineDomains<const T extends readonly DomainDefinition[]>(items: T): T {
  return items;
}

export function definePhases<const T extends readonly PhaseDefinition[]>(items: T): T {
  return items;
}

export function defineLanes<const T extends readonly LaneDefinition[]>(items: T): T {
  return items;
}

export function defineContextPacks<const T extends readonly ContextPackDefinition[]>(items: T): T {
  return items;
}

export function defineWorkflows<const T extends readonly WorkflowDefinition[]>(items: T): T {
  return items;
}

export function defineOperators<const T extends readonly OperatorDefinition[]>(items: T): T {
  return items;
}
