import { grantLevelCeilings, grantableDomainIds, systemDomainIds, type ActionClass, type Grant, type GrantableDomainId, type GrantsMap } from "../schema/types.js";

/**
 * Grant-ceiling evaluation (KTD3, R5-R7). Domain IDs and action classes arrive here as plain
 * strings even though CompiledRunNode types them narrower — a corrupt catalog or a hostile
 * input must still fail closed at runtime, not merely at compile time.
 */
export interface GrantCeilingResult {
  readonly ok: boolean;
  readonly grant?: Grant;
  readonly reasonCode: string;
  readonly reason: string;
}

const ACTION_CLASSES: readonly ActionClass[] = ["observe", "draft", "mutate", "publish", "spend", "release", "destructive"];

export function isKnownActionClass(value: string): value is ActionClass {
  return (ACTION_CLASSES as readonly string[]).includes(value);
}

export function isGrantableDomain(value: string): value is GrantableDomainId {
  return (grantableDomainIds as readonly string[]).includes(value);
}

/**
 * KTD4's three "direct" protected categories (spend->spend, release->release,
 * destructive->destructive) are unconditionally protected — there is no unprotected form of a
 * spend, release, or destructive action. Per KTD3's "full (ceiling destructive; protected
 * classes activate only through their waivers)" — the one sentence in the plan that actually
 * describes a protected class becoming reachable — that reachability is scoped to grant level
 * "full". review-first and run-with-guardrails never reach these three classes, waiver or not.
 */
const REQUIRES_FULL_GRANT: ReadonlySet<ActionClass> = new Set(["spend", "release", "destructive"]);

/**
 * grantLevelCeilings (core/schema/types.ts, U1-committed) never lists "spend" or "release" at
 * any level — "full" stops at "destructive". A literal ceiling-membership check would therefore
 * reject every spend/release node at every grant level, making their waiver path (R8, R10) dead
 * code. Read as intentional: these two classes are structurally exempt from ceiling-array
 * membership and are gated entirely by REQUIRES_FULL_GRANT above plus the waiver system
 * (waivers.ts) — never by ceiling-set inclusion. "destructive" is not exempt: it is a literal
 * ceiling member (full only), so it is additionally checked against the ceiling below (which,
 * given REQUIRES_FULL_GRANT already forced level "full", always then passes).
 */
const CEILING_EXEMPT: ReadonlySet<ActionClass> = new Set(["spend", "release"]);

export function evaluateGrantCeiling(grants: GrantsMap, domainId: string, actionClass: string): GrantCeilingResult {
  if (systemDomainIds.includes(domainId)) {
    return { ok: false, reasonCode: "autonomy.system_domain_not_grantable", reason: `Domain "${domainId}" is a system domain (process/orchestration) and is never founder-grantable; failing closed.` };
  }
  if (!isGrantableDomain(domainId)) {
    return { ok: false, reasonCode: "autonomy.unknown_domain", reason: `Domain "${domainId}" is not a recognized grantable domain; failing closed.` };
  }
  if (!isKnownActionClass(actionClass)) {
    return { ok: false, reasonCode: "autonomy.unknown_action_class", reason: `Action class "${actionClass}" is not recognized; failing closed.` };
  }

  const grant = grants[domainId];
  if (!grant) {
    return { ok: false, reasonCode: "autonomy.no_grant", reason: `No autonomy grant exists for domain "${domainId}"; nothing is authorized until the founder grants one.` };
  }

  if (REQUIRES_FULL_GRANT.has(actionClass) && grant.level !== "full") {
    return {
      ok: false,
      grant,
      reasonCode: "autonomy.protected_class_requires_full",
      reason: `Action class "${actionClass}" is a protected/direct category and requires grant level "full" for domain "${domainId}" (found "${grant.level}").`,
    };
  }
  if (CEILING_EXEMPT.has(actionClass)) {
    return { ok: true, grant, reasonCode: "autonomy.grant_sufficient", reason: "" };
  }

  const ceiling = grantLevelCeilings[grant.level];
  if (!ceiling || !ceiling.includes(actionClass)) {
    return {
      ok: false,
      grant,
      reasonCode: "autonomy.above_grant_level",
      reason: `Action class "${actionClass}" exceeds grant level "${grant.level}" for domain "${domainId}" (ceiling: ${(ceiling ?? []).join(", ") || "none"}).`,
    };
  }
  return { ok: true, grant, reasonCode: "autonomy.grant_sufficient", reason: "" };
}
