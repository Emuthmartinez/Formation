import { businessUnitDomains, grantableDomainIds, type BusinessUnit, type GrantableDomainId } from "../core/schema/types.js";

/**
 * Business-unit copy mapping (KTD3). Single source: core/schema/types.ts's
 * businessUnitDomains is the one place this many-to-one grouping is defined — catalog/
 * re-exports it and derives the reverse lookup rather than maintaining a second copy that
 * could silently diverge (see the duplicated-helpers-have-already-diverged lesson).
 */
export { businessUnitDomains };
export type { BusinessUnit };

/** Reverse of businessUnitDomains: every grantable domain maps to exactly one business unit. */
export const domainBusinessUnit: Record<GrantableDomainId, BusinessUnit> = Object.fromEntries(
  Object.entries(businessUnitDomains).flatMap(([unit, domainIds]) => domainIds.map((domainId) => [domainId, unit as BusinessUnit])),
) as Record<GrantableDomainId, BusinessUnit>;

/** Every grantable domain must appear in exactly one business unit — checked by catalog/validate.ts against the live schema export, not re-asserted as a separate literal. */
export function businessUnitCoversAllGrantableDomains(): boolean {
  return grantableDomainIds.every((domainId) => domainId in domainBusinessUnit);
}
