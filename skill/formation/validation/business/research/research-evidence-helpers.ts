export type SignalLifecycle = "current" | "dated" | "superseded" | "rejected" | "unverified";

export interface OfferMeasurement {
  readonly exposure: number;
  readonly conversions: number;
}

export interface SignalSupersessionRecord {
  readonly id: string;
  readonly lifecycle: SignalLifecycle;
  /** For a superseded record, this is the newer signal that replaces it. */
  readonly replacementId: string;
}

export interface SignalSupersessionValidation {
  readonly invalidSignalIds: readonly string[];
}

function parseWholeNumberCount(value: string): number | undefined {
  const normalized = value.trim();
  const validDigits = /^\d+$/.test(normalized) || /^\d{1,3}(?:,\d{3})+$/.test(normalized);
  if (!validDigits) return undefined;

  const parsed = Number(normalized.replace(/,/g, ""));
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

/** Parse one measured offer-test result without accepting fractional or impossible counts. */
export function parseOfferMeasurement(exposureValue: string, conversionValue: string): OfferMeasurement | undefined {
  const exposure = parseWholeNumberCount(exposureValue);
  const conversions = parseWholeNumberCount(conversionValue);
  if (exposure === undefined || conversions === undefined || exposure <= 0 || conversions > exposure) return undefined;
  return { exposure, conversions };
}

/**
 * Validate every supersession chain as a graph. A superseded signal must point to a
 * different declared signal, the graph must be acyclic, and the chain must end at a
 * current or dated signal that can still support evidence.
 */
export function validateSignalSupersessionGraph(records: readonly SignalSupersessionRecord[]): SignalSupersessionValidation {
  const recordsById = new Map<string, SignalSupersessionRecord>();
  const invalidSignalIds = new Set<string>();

  for (const record of records) {
    if (recordsById.has(record.id)) invalidSignalIds.add(record.id);
    else recordsById.set(record.id, record);
  }

  for (const origin of records) {
    if (origin.lifecycle !== "superseded") continue;

    const chain: string[] = [];
    const visited = new Set<string>();
    let current: SignalSupersessionRecord | undefined = origin;

    while (current?.lifecycle === "superseded") {
      if (visited.has(current.id)) {
        for (const signalId of chain) invalidSignalIds.add(signalId);
        invalidSignalIds.add(current.id);
        current = undefined;
        break;
      }

      visited.add(current.id);
      chain.push(current.id);
      const replacementId = current.replacementId.trim().toUpperCase();
      if (replacementId.length === 0 || replacementId === current.id || !recordsById.has(replacementId)) {
        for (const signalId of chain) invalidSignalIds.add(signalId);
        current = undefined;
        break;
      }
      current = recordsById.get(replacementId);
    }

    if (current && current.lifecycle !== "current" && current.lifecycle !== "dated") {
      for (const signalId of chain) invalidSignalIds.add(signalId);
    }
  }

  return { invalidSignalIds: [...invalidSignalIds].sort() };
}
