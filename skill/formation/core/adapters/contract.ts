/**
 * Adapter contract version (contract A of the layering plan,
 * docs/plans/2026-08-19-001-engine-contract-and-consumer-extraction.md).
 *
 * Consumers bind to this, never to the tree: the boundary report and the import boundary report
 * carry `contractVersion`, each emitter validates its own output against the generated schema
 * before printing (core/schema/{boundary-report,import-boundary-report}.schema.json), and a
 * consumer accepts a report only when the major version matches what it was built against.
 *
 * Bump rules (enforced by check:adapter-contract's golden samples):
 * - additive, optional fields -> minor
 * - anything a consumer could break on (removed/renamed/retyped fields, changed enums,
 *   new REQUIRED fields) -> major
 * The document-internal schemaVersion literals stay what they are; this version is the one
 * consumers compare.
 */
export const ADAPTER_CONTRACT_VERSION = "1.0.0";

/** Major-version compatibility: the one rule a consumer needs. */
export function contractCompatible(emitted: string, builtAgainst: string): boolean {
  const major = (value: string): string | undefined => /^(\d+)\.\d+\.\d+$/.exec(value)?.[1];
  const a = major(emitted);
  const b = major(builtAgainst);
  return Boolean(a && b && a === b);
}
