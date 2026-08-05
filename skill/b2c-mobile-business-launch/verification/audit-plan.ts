/**
 * verification/audit-plan.ts — U9's discoverable entry point onto the audit pipeline.
 *
 * Design decision (KTD10 "single-source audit plan + parity enforcement"): this is a THIN
 * RE-EXPORT of tooling/lib/audit-plan.ts, not a second plan definition. The alternative
 * (assembling a parallel "v2 steps" list here and merging it with the legacy plan at
 * verification/run-audit.ts's call site) would create exactly the failure mode this repo's
 * "duplicated helpers have already diverged" lesson warns about: two lists of audit steps that
 * silently drift apart, with validation/repository/check-package-parity.ts only ever checking
 * one of them. check-package-parity.ts imports tooling/lib/audit-plan.ts directly (see its own
 * `import { buildAuditPlan, auditExcludedScripts } from "../../tooling/lib/audit-plan.js"`), so
 * that module must stay the one and only place the pipeline is assembled.
 *
 * U9's own new steps (catalog:render-routing, test:fixtures, test:boundaries, test:parity) are
 * therefore appended directly inside tooling/lib/audit-plan.ts's buildAuditPlan(), alongside the
 * U1-U8 steps — not layered on top from here. This module exists so callers under verification/
 * (verification/run-audit.ts, verification/fixtures/audit.fixtures.ts, and any future U10/U11
 * consumer) can depend on something inside their own tree rather than reaching across into
 * tooling/ directly, while guaranteeing there is exactly one authored plan.
 */
export { buildAuditPlan, auditExcludedScripts, type AuditLayout, type AuditStep } from "../tooling/lib/audit-plan.js";
