# Port Ledger — U8 (Catalog And Content Port Triage)

One row per v1 file, an evidence-based disposition, and a one-line reason. This ledger
**records decisions**; it does not move or delete anything — U11 executes what is written
here (KTD11, KTD13). Every path appears exactly once; no row is "TBD"
(`verification/fixtures/catalog.fixtures.ts` asserts both).

## Disposition vocabulary

- **keep** — earns its place close to as-is: ports into `content/<domain>/` (knowledge) or
  continues to be consumed by the new core largely unchanged (structural/live-proof
  validators, schemas, generic tooling). The conservative default when genuinely uncertain
  (reason says so explicitly).
- **port** — earns its place but needs restructuring to fit the v2 architecture: a
  hybrid validator's structural/live-proof kernel survives as a capability-boundary or
  fixture test while its prose-presence half is dropped; a workflow/routing concept moves
  from prose into catalog data.
- **merge** — this file's unique content folds into a named sibling rather than porting
  standalone.
- **drop** — superseded by capability tests (word-pattern validators grading prose form,
  never a verifiable fact), superseded by catalog data (R20's routing-table inversion;
  KTD3/KTD4's autonomy prose), or a dead surface with no v2 consumer (the deleted hook
  mechanism).

## Scope and methodology

**Knowledge tree**: every file under `knowledge/` matching `*.md`, `*.yaml`, `*.yml`
(catalog.ts's own knowledge-extension set), excluding `evals/`/`fixtures/` subdirectories
(none exist under `knowledge/` today, but the exclusion is named for parity with the
discovery logic it mirrors). This picks up `knowledge/process/cascade-edges.yaml`, which a
literal `knowledge/**/*.md` glob would miss — a real structured-data file the runtime
already consumes, not an oversight to leave out.

**Validators**: every `check:*`/`validate:*` npm script — in **both** the skill's own
`package.json` and the **repo-root** `package.json` — whose script path resolves under
`validation/business/` or `validation/repository/`. The repo-root manifest carries one
validator the skill-scoped manifest does not wire up at all:
`validation/repository/check-package-parity.ts` (compares the two package manifests
against `skill-version.json`; it only makes sense invoked from the root, which is exactly
why it has no skill-local script). Excluded from the countable set for the same reason:
`check:business-control-plane-workspace` targets `tooling/render-business-control-plane-workspace.ts`,
not a `validation/` path — it's a renderer, not a validator.

**Three deliberate additions beyond the v1 scope.** `validation/repository/README.md`
is domain.machine's `indexPath` (`catalog/domains.ts`) and plays the identical routing-table
role the 14 dropped `knowledge/<domain>/README.md` files play, but it isn't a `.md` under
`knowledge/` and isn't a validator script — it would fall through both buckets on a literal
reading. `validation/repository/check-catalog.ts` has no v1 precedent at all: it is the wired
entry point this same unit created so the `check:catalog` npm script resolves under
`validation/repository/` (the three-root split `tooling/lib/script-paths.ts` enforces for
LaunchBench coverage), while `catalog/validate.ts` keeps the real logic and its own directly
runnable `tsx catalog/validate.ts` CLI. Neither file is a v1 row being triaged, but both are
now real files the validator-completeness glob will find — thoroughness over literalism means
both get a row rather than silently falling outside the ledger's own completeness invariant.
`validation/business/engineering/check-source-checkpoint.ts` is the third addition. It
requires a recoverable Git checkpoint before broad build work can claim progress.

Research basis: every `knowledge/<domain>/README.md` load-when table was read in full by
the implementing session; every file flagged as an orphan (not in any README table),
near-duplicate, or generic-stub load-when was read in full by a dedicated research pass;
all 67 validators were read (header comment plus body, full read where short) by a second
dedicated research pass, each classified STRUCTURAL / LIVE-PROOF / WORD-PATTERN / HYBRID
before a disposition was assigned. Two validators were personally re-verified by full read
given their consequence: `check-hooks-installed.ts` (confirms total DROP — the hook
mechanism it checks is deleted at cutover) and `check-skill-graph.ts` (confirms PORT as a
rewrite — its checking *pattern* is right, its literal module coupling is not; this same
unit ships that rewrite as `catalog/validate.ts` + `catalog/render-routing.ts`).

## Summary

Verified by parsing this file's own table rows (`node -e` one-liner against the exact
`| path | disposition |` shape the completeness fixture also parses) — the numbers below
are ground truth, not hand arithmetic.

| Bucket | keep | port | merge | drop | total |
|---|---|---|---|---|---|
| Knowledge domain README indexes (14) + top-level `knowledge/README.md` | 0 | 0 | 0 | 15 | 15 |
| Knowledge content files | 105 | 0 | 0 | 1 | 106 |
| Additions beyond v1 scope (3) | 2 | 0 | 1 | 0 | 3 |
| Validators (68) | 31 | 25 | 0 | 15 | 71 |
| **Total** | **142** | **25** | **1** | **31** | **199** |

---

## 1. Knowledge domain README indexes — all DROP

Superseded by `catalog/generated/routing.md` (rendered by `catalog/render-routing.ts` from
the self-registering manifests under `catalog/knowledge/`). R20 names this inversion directly: the
current shape has `runtime/graph/catalog.ts`'s `loadWhenMap()` *scraping* these
hand-authored tables; the v2 shape authors the load-when text as catalog data and
*generates* the table. Once these files' sole job (the routing table plus a short domain
tagline already duplicated by `catalog/domains.ts`'s `routeLabel`/`routeWhen`) is generated
elsewhere, the hand-authored copy is dead weight — this is the direct, load-bearing
implementation of R20, and the most consequential single disposition in this ledger.

| path | disposition | reason |
|---|---|---|
| knowledge/README.md | drop | top-level knowledge-dir blurb; routing role superseded by generated routing.md |
| knowledge/data/README.md | drop | routing table superseded by generated routing.md (R20) |
| knowledge/design/README.md | drop | routing table superseded by generated routing.md (R20) |
| knowledge/engineering/README.md | drop | routing table superseded by generated routing.md (R20) |
| knowledge/experience/README.md | drop | routing table superseded by generated routing.md (R20) |
| knowledge/growth/README.md | drop | routing table superseded by generated routing.md (R20) |
| knowledge/money/README.md | drop | routing table superseded by generated routing.md (R20) |
| knowledge/operations/README.md | drop | routing table superseded by generated routing.md (R20) |
| knowledge/orchestration/README.md | drop | routing table superseded by generated routing.md (R20); also carried the "load these three together" note, now expressible as catalog data if a future need arises |
| knowledge/process/README.md | drop | routing table superseded by generated routing.md (R20) |
| knowledge/product/README.md | drop | routing table superseded by generated routing.md (R20) |
| knowledge/research/README.md | drop | routing table superseded by generated routing.md (R20) |
| knowledge/store/README.md | drop | routing table superseded by generated routing.md (R20) |
| knowledge/trust/README.md | drop | routing table superseded by generated routing.md (R20) |
| knowledge/words/README.md | drop | routing table superseded by generated routing.md (R20) |

---

## 2. Knowledge content files

90 keep, 1 drop (91 total). Every "keep" row ports into `content/<domain>/` at U11 keyed by the
matching knowledge manifest, which carries its authored `loadWhen` text
— the reason column here stays short since the full rationale lives there.

### domain.orchestration — the one content drop

| path | disposition | reason |
|---|---|---|
| knowledge/orchestration/autonomy-modes.md | drop | prose autonomy prescription (6-mode ladder: scout/draft/prepare/apply/mutate/ship, self-declared by the agent) superseded by the autonomy engine's typed, code-evaluated grants (KTD3: 3 levels × 12 domains) and waivers (KTD4); no per-domain granularity, no waiver/budget/kill-switch concept exists in the file. Salvage before delete (U4's concern, not this unit's): the Founder-Only Gates policy list and the Approval Envelope shape (provider/account/scope/expiry/spend-constraint) already look like data, not narrative — mine them into the grant/waiver model rather than re-deriving from scratch. |
| knowledge/orchestration/project-state.md | keep | durable-state operating guidance; complements (not superseded by) core/reducer's enforcement — conservative keep, content updates at port time to point at the reducer CLI instead of prose |
| knowledge/orchestration/parallel-agent-orchestration.md | keep | subagent dispatch/coordination guidance, still real operational content post-reducer |
| knowledge/orchestration/dynamic-workflows.md | keep | substantial, non-stub; ports with its existing freshness caveat (documents a Claude Code preview feature — refresh source basis before trusting a named flag/API) |
| knowledge/orchestration/compound-engineering-routing.md | keep | CE routing guidance, referenced by multiple workflows across domains |

### domain.process (10 files, all keep)

| path | disposition | reason |
|---|---|---|
| knowledge/process/artifact-contracts.md | keep | doc/handoff acceptance-criteria reference, `check:artifact-templates` |
| knowledge/process/cascade-edges.yaml | keep | structured data actively consumed by `check:change-cascade`; twin-format pattern with change-cascade.md by design, not a duplicate — exactly the "edges as data, not state" pattern already shipped elsewhere in this skill |
| knowledge/process/change-cascade.md | keep | human-rendered twin of cascade-edges.yaml; edit together |
| knowledge/process/control-plane.md | keep | Design Room / Business Control Plane extension reference |
| knowledge/process/failure-cards.md | keep | LaunchBench/failure-card authoring reference |
| knowledge/process/flow-traceability.md | keep | phase-boundary and traceability reference |
| knowledge/process/launch-coverage.md | keep | lane-status reconciliation reference |
| knowledge/process/learning-capture.md | keep | post-cutover addition (2026-08-18): the captured-learning contract — capture triggers, the four document sections, grounding rules, refresh verdicts; bound to the two learning maintenance nodes, enforced by `check:learning-grounding` |
| knowledge/process/learnings/audit-runs-from-repo-root.md | keep | post-cutover addition (2026-08-18): first captured learning — the maintainer audit must run from the repo root, repo-only steps drop silently in the skill layout; grounded in audit-plan.ts citations |
| knowledge/process/launch-phases.md | keep | phase-scope decision reference |
| knowledge/process/provider-proof.md | keep | short but complete evidence-rule reference; not a neglected stub |
| knowledge/process/tool-recipes.md | keep | hub file; Recipe Routing table explicitly links all 8 children below (verified: none are unreferenced by the hub) |
| knowledge/process/tool-recipes/device-capture-and-proof.md | keep | substantial, concrete CLI/version-pinned route ladder |
| knowledge/process/tool-recipes/engineering-and-agent-orchestration.md | keep | substantial CE/parallel-agent routing content |
| knowledge/process/tool-recipes/funnel-domain-and-privacy.md | keep | five distinct substantial recipes |
| knowledge/process/tool-recipes/growth-and-store-routing.md | keep | six distinct substantial recipes |
| knowledge/process/tool-recipes/research-intelligence.md | keep | five distinct recipes with concrete tool calls |
| knowledge/process/tool-recipes/revenue-email-analytics.md | keep | substantial, named RevenueCat Economics Pull recipe |
| knowledge/process/tool-recipes/secrets-and-environment.md | keep | intentionally short routing pointer into secrets-management.md, not an abandoned placeholder |
| knowledge/process/tool-recipes/visual-and-motion-production.md | keep | richest file in the lane, 6 named chained production recipes |

### domain.data (1 file, keep)

| path | disposition | reason |
|---|---|---|
| knowledge/data/analytics-attribution.md | keep | event-catalog/attribution reference gating multiple downstream lanes |

### domain.design (11 files, all keep)

| path | disposition | reason |
|---|---|---|
| knowledge/design/design-room.md | keep | the real hub — STATE→MUTATE→VERSION→RENDER protocol; explicitly cross-refs surfaces-b2c.md |
| knowledge/design/audience-derived-identity.md | keep | post-cutover addition (2026-08-17): audience-facts-to-design-decisions derivation chain and generic-template tells; drives design.md's Audience And Identity section, `check:design-room` |
| knowledge/design/vibecoded-tells.md | keep | post-cutover addition (2026-08-18): the 30-item vibecoded smell list as Tier 1 trust breakers and Tier 2 default tells with earned exceptions; drives the vibecode audit pass and `check:vibecoded-tells` |
| knowledge/design/design-visual-system.md | keep | visual-system/brand reference, `check:token-promotion` |
| knowledge/design/landing-motion-craft.md | keep | landing/funnel motion-craft reference, `check:landing-funnel` |
| knowledge/design/motion-craft-benchmarks.md | keep | unique numeric R1–R10 motion recipes bound to shipped tokens; found nowhere else |
| knowledge/design/premium-mobile-craft.md | keep | ships real SwiftUI/RN/Flutter parity craft component |
| knowledge/design/quality-lens.md | keep | distinct taste-filter content (11-star review questions, anti-generic checks); not redundant with design-room.md or surfaces-b2c.md despite sharing a load-when trigger string — three different altitudes on the same subject, verified by full read |
| knowledge/design/refero-ux-patterns.md | keep | UX pattern research reference, `check:ux-patterns` |
| knowledge/design/remotion-content-assets.md | keep | Remotion content-asset reference, `check:content-assets` |
| knowledge/design/surfaces-b2c.md | keep | unique CPP/PPO/In-App Event schema content with Apple's numeric limits; not redundant — see design-room.md note |

### domain.engineering (6 files, all keep)

| path | disposition | reason |
|---|---|---|
| knowledge/engineering/app-agent-roster.md | keep | AGENTS.md/CLAUDE.md handoff-bundle reference |
| knowledge/engineering/backend-data-contract.md | keep | backend selection/data-model reference, `check:backend-contract` |
| knowledge/engineering/accessibility-readiness.md | keep | common-task accessibility proof and store declaration reconciliation |
| knowledge/engineering/app-quality.md | keep | app vitals, adaptive layout, offline, size, battery, and SDK supply-chain proof |
| knowledge/engineering/engineering-orchestration.md | keep | CE routing / Standalone Engineering Loop reference |
| knowledge/engineering/mobai-toolbelt.md | keep | device automation reference, `check:mobai-proof` |
| knowledge/engineering/technical-documentation-ste100.md | keep | ASD-STE100 technical-documentation standard reference, `reference.engineering.technical-documentation-ste100` |
| knowledge/engineering/xcodebuildmcp-testing.md | keep | Route Ladder proof reference, `check:native-ios` |

### domain.experience (21 files, all keep)

| path | disposition | reason |
|---|---|---|
| knowledge/experience/consumer-product-design-agency.md | keep | research-tier grounding + Experience Card acceptance checklist |
| knowledge/experience/eleven-star-experience.md | keep | 11-star run protocol reference, `check:11-star` |
| knowledge/experience/emotional-design-system.md | keep | methodology hub; deliberately avoids duplicating the card table/ethics contract (verified by full read) — one internal trim opportunity noted below, not a disposition change |
| knowledge/experience/emotional-experience-design.md | keep | deep producer implementation of the 4 required cards; hub-vs-detail with emotional-design-system.md, not a duplicate |
| knowledge/experience/emotional-experience-measurement.md | keep | instrumentation-only content, explicitly disclaims re-arguing psychology — genuinely distinct concern |
| knowledge/experience/ethics-guardrail.md | keep | the only file carrying regulatory/legal substance (FTC/EU DSA/Apple/Google/COPPA); guardrail attestation-block contract feeds `check:emotional-design` |
| knowledge/experience/experience-cards.md | keep | hub file; Card Routing table explicitly links all 12 children below (verified: none are unreferenced by the hub) |
| knowledge/experience/experience-cards/commitment-card.md | keep | one of 12 real card references in the deck, routed from the hub |
| knowledge/experience/experience-cards/endowed-progress-card.md | keep | see commitment-card.md row |
| knowledge/experience/experience-cards/fresh-start-card.md | keep | see commitment-card.md row |
| knowledge/experience/experience-cards/identity-and-self-expression-card.md | keep | see commitment-card.md row |
| knowledge/experience/experience-cards/intent-mirroring-card.md | keep | see commitment-card.md row |
| knowledge/experience/experience-cards/mastery-and-status-card.md | keep | see commitment-card.md row; also pins a canonical `check:motion-contract` spring |
| knowledge/experience/experience-cards/peak-end-card.md | keep | see commitment-card.md row; also pins a canonical `check:motion-contract` spring |
| knowledge/experience/experience-cards/perceived-effort-delay-card.md | keep | see commitment-card.md row |
| knowledge/experience/experience-cards/reciprocity-card.md | keep | see commitment-card.md row |
| knowledge/experience/experience-cards/recovery-and-trust-repair-card.md | keep | see commitment-card.md row |
| knowledge/experience/experience-cards/streak-and-loss-aversion-card.md | keep | see commitment-card.md row; HIGH-risk tier, ethics-guardrail applies |
| knowledge/experience/experience-cards/variable-reward-card.md | keep | see commitment-card.md row; HIGH-risk tier, ethics-guardrail applies; pins a canonical spring |
| knowledge/experience/onboarding-conversion.md | keep | onboarding/activation reference, `check:onboarding` |
| knowledge/experience/push-notification-lifecycle.md | keep | push/lifecycle reference, `check:email`, `check:onboarding` |

### domain.growth (8 files, all keep)

| path | disposition | reason |
|---|---|---|
| knowledge/growth/cro-landing.md | keep | landing/funnel CRO reference, `check:landing-funnel` |
| knowledge/growth/fastlane-growth-ops.md | keep | Fastlane/Blitz operations reference |
| knowledge/growth/geo-seo.md | keep | GEO/SEO public-surface reference, `check:landing-funnel` |
| knowledge/growth/influencer-sponsorship-engine.md | keep | creator/sponsorship reference |
| knowledge/growth/launch-narrative-cadence.md | keep | launch-day/cadence reference, `check:launch-narrative` |
| knowledge/growth/paid-user-acquisition.md | keep | paid UA reference, `check:paid-ua` |
| knowledge/growth/ugc-creator-engine.md | keep | UGC/creator-sourcing reference |
| knowledge/growth/viral-growth-loops.md | keep | referral/loop mechanics reference, `check:viral-growth` |

### domain.money (5 files, keep)

2026-08 graph-consolidation audit split the original single-file monolith into a routing
hub (revenue-monetization.md) plus four spokes, mirroring tool-recipes.md/experience-cards.md's
established hub-and-spoke pattern.

| path | disposition | reason |
|---|---|---|
| knowledge/money/billing-health-and-reactivation.md | keep | purchase-events backend/analytics contract, involuntary-billing-failure recovery, and reactivation/win-back spoke of the revenue-monetization.md hub |
| knowledge/money/paywall-pricing-and-experiments.md | keep | paywall timing/placement/trials/offers, pricing disclosure rules, price-point decision procedure, and paywall experiment cadence spoke of the revenue-monetization.md hub |
| knowledge/money/revenue-monetization.md | keep | monetization decision matrix, founder-only gates, and anti-pattern digest — the routing hub, `check:revenue`, `probe:revenuecat` |
| knowledge/money/revenuecat-and-store-products.md | keep | RevenueCat project/product/entitlement/offering setup and App Store/Play product gates spoke of the revenue-monetization.md hub |
| knowledge/money/stripe-and-web-billing.md | keep | Stripe account/checkout/webhooks/customer-portal and RevenueCat Web Billing spoke of the revenue-monetization.md hub |

### domain.operations (7 files, all keep)

| path | disposition | reason |
|---|---|---|
| knowledge/operations/founder-zero-operator.md | keep | founder-zero bootstrap reference, `check:founder-operator` |
| knowledge/operations/frontier-agent-operations.md | keep | authenticated-action reference, `check:agent-operations`; source of the action-class vocabulary KTD4 extends |
| knowledge/operations/paid-tool-routing.md | keep | paid-tool decision reference, `check:paid-tool-decisions` |
| knowledge/operations/post-launch-operations.md | keep | weekly-ops/kill-or-scale reference, `check:post-launch` |
| knowledge/operations/provider-state-recipes.md | keep | substantial per-provider state checklist (10 providers); distinct from secrets-management.md — Doppler is one entry among ten, not the focus |
| knowledge/operations/resend-email-ops.md | keep | transactional/lifecycle email reference, `check:email` |
| knowledge/operations/secrets-management.md | keep | deep secrets reference (discovery loop, classification, Doppler workflow); the file itself is substantial even though its README load-when line was a weak filename-restating placeholder — fixed in its knowledge manifest, not a reason to drop the file |
| knowledge/operations/doppler-organization.md | keep | portfolio secret-store convention (platform vs per-business projects, configs-not-repos, consumer-side tier composition); written 2026-08-05 from a live multi-business account setup, and carries two constraints found there: cross-project inheritance is a paid feature and a least-privilege read-only subset needs its own project because branch configs inherit their root |

### domain.product (6 files, all keep)

2026-08 graph-consolidation audit's thin-domain rebalancing (PR-4a) added the sixth,
non-archetype file: SKILL.md told agents to improvise core loop and V1 scope for any product
outside the 4 shipped archetypes, so this file generalizes the archetypes' own method instead.

| path | disposition | reason |
|---|---|---|
| knowledge/product/ai-chat-companion.md | keep | AI-chat archetype spec reference |
| knowledge/product/core-loop-and-v1-scope.md | keep | core-loop and V1-vs-later scope method for any product outside the 4 shipped archetypes, generalized from their own shared shape |
| knowledge/product/habit-tracker.md | keep | habit-tracker archetype spec reference |
| knowledge/product/photo-ai-media.md | keep | photo/AI-media archetype spec reference |
| knowledge/product/product-moat.md | keep | 11-star / product-moat reference, `check:11-star` |
| knowledge/product/social-network.md | keep | social-network archetype spec reference |

### domain.research (2 files, all keep)

2026-08 graph-consolidation audit's thin-domain rebalancing (PR-4a) added the second file:
the research-backed-spec workflow's Go/Pivot/Kill verdict had no owned knowledge file, only
~200 lines of post-hoc judgment logic in check-research-evidence.ts's error messages.

| path | disposition | reason |
|---|---|---|
| knowledge/research/go-pivot-or-kill.md | keep | Go/Pivot/Kill pre-build verdict judgment layer for the research-backed-spec workflow, restating check-research-evidence.ts's (check:research) enforced criteria |
| knowledge/research/localization-market-research.md | keep | localization/locale-priority reference, `check:localization-research` |

### domain.store (6 files, all keep)

| path | disposition | reason |
|---|---|---|
| knowledge/store/app-store-connect-cli.md | keep | `asc` CLI automation reference, `check:asc-command-contract` |
| knowledge/store/app-store-listing-prep.md | keep | listing-packet reference |
| knowledge/store/apple-signing-release.md | keep | ASC upload-readiness reference, `check:apple-requirements` |
| knowledge/store/aso-store-ops.md | keep | ASO/store-ops reference, `check:aso-metadata` |
| knowledge/store/google-play-release.md | keep | Play Console reference, `check:google-play` |
| knowledge/store/store-console-workflow.md | keep | console walkthrough reference, `check:store-console` |
| knowledge/store/marketplace-regional-compliance.md | keep | marketplace identity, tax, payout, and regional declaration proof |

### domain.trust (2 files, all keep)

| path | disposition | reason |
|---|---|---|
| knowledge/trust/privacy-terms.md | keep | privacy/terms drafting reference, `check:privacy-terms` |
| knowledge/trust/security-release-hardening.md | keep | one of the denser files reviewed; OWASP-basis hardening reference, `check:security` |
| knowledge/trust/community-safety.md | keep | conditional moderation, reporting, blocking, and age-control proof |
| knowledge/trust/generative-ai-safety.md | keep | conditional generative-AI abuse-control proof |

### domain.words (3 files, all keep)

| path | disposition | reason |
|---|---|---|
| knowledge/words/consumer-copy-benchmarks.md | keep | post-cutover addition (2026-08-17): live-site consumer-copy swipe-file, evidence layer under conversion-copy.md; sources on 90-day cadence |
| knowledge/words/conversion-copy.md | keep | conversion-copy reference, `check:app-copy`, `check:no-slop` |
| knowledge/words/no-slop-writing.md | keep | brand-voice/banned-pattern reference, `check:no-slop` |

---

## 3. Additions beyond literal scope (2)

| path | disposition | reason |
|---|---|---|
| validation/repository/README.md | merge | its unique content — the business/repository validator-ownership split rationale and the 7-validator "who grades what" table — folds into a maintainer doc (e.g. this catalog's own header comments / a future docs/architecture.md section) rather than porting standalone; its routing-table portion (launchbench-evals.md / skill-versioning.md / source-freshness-maintenance.md / source-registry.yaml / graph README rows) is superseded by generated routing.md exactly like the 14 knowledge domain READMEs |
| validation/repository/check-catalog.ts | keep | no v1 precedent — new U8 file, not a port; thin wired entry point for the `check:catalog` npm script so it resolves under `validation/repository/` per `tooling/lib/script-paths.ts`'s three-root convention (needed for `check-package-parity.ts`'s LaunchBench-coverage cross-check); the real structural-validation logic lives in `catalog/validate.ts`, which stays directly runnable as `tsx catalog/validate.ts` per this unit's own file list |

---

## 4. Validators (67)

Classification legend used in the reason column: **STRUCTURAL** (file/schema/cross-reference
checks — a verifiable fact), **LIVE-PROOF** (calls a real provider/CLI), **WORD-PATTERN**
(regexes prose content/tone — the FORM of writing, not a verifiable fact), **HYBRID** (both,
split noted).

### validation/business/data/

| path | disposition | reason |
|---|---|---|
| validation/business/data/check-analytics-catalog.ts | keep | STRUCTURAL — cross-references backticked event names against ANALYTICS.md, real ID reconciliation |
| validation/business/data/check-attribution-contract.ts | port | HYBRID, LIVE-PROOF-leaning — PROJECT_STATE fields + PROVIDER_PROOF.md row are structural, captured `posthog-proof.json` anti-gaming is real; duplicates PROVIDER_PROOF.md-row parsing with check-live-provider-proof.ts — consolidate at port time |
| validation/business/process/check-live-provider-proof.ts | port | HYBRID, LIVE-PROOF-leaning — evidence-path-exists-on-disk half is real, keyword-presence half is WORD-PATTERN; port the evidence-exists half as a capability/provider-proof test. Relocated from validation/business/data/ to validation/business/process/ (2026-08 graph-consolidation audit: directory-inferred gate ownership was misattributing it by path). |

### validation/business/design/

| path | disposition | reason |
|---|---|---|
| validation/business/design/check-design-room-contract.ts | keep | STRUCTURAL — real WCAG contrast math + hash-drift check against rendered HTML |
| validation/business/design/check-motion-contract.ts | keep | STRUCTURAL — numeric cross-referencing of duration/spring values across tokens.json/Swift/TS/markdown; strongest structural validator in its batch |
| validation/business/design/check-token-promotion.ts | keep | STRUCTURAL — content-hash drift detection between tokens.json/css/Swift and the seed theme |
| validation/business/design/check-vibecoded-tells.ts | keep | post-cutover addition (2026-08-18): mechanical subset of vibecoded-tells.md over landing/web-surface source — icon-pack imports and missing legal links error, default tells warn |
| validation/business/design/validate-state.ts | keep | thin (15-line) diagnostic wrapper around the design-state loader; trivial to keep as-is |

### validation/business/engineering/

| path | disposition | reason |
|---|---|---|
| validation/business/engineering/check-archetype-starter.ts | keep | STRUCTURAL — starter scaffold file/dep/lockfile/RLS/test integrity checks |
| validation/business/engineering/check-backend-data-contract.ts | port | HYBRID — required-section presence is WORD-PATTERN, done-lane's named-route-exists-on-disk claim is structural |
| validation/business/engineering/check-compound-engineering-routing.ts | port | HYBRID — doc-phrase requirement is WORD-PATTERN, PROJECT_STATE enum/field validation is structural |
| validation/business/engineering/check-mobai-proof.ts | port | HYBRID — readiness-doc field checks are WORD-PATTERN, real `.mob` script static analysis (unbounded repeats, embedded secrets) and evidence-path grounding are real; port the `.mob`-analysis half |
| validation/business/engineering/check-native-ios-proof.ts | port | HYBRID, WORD-PATTERN-heavy — bulk is keyword-presence grading against PRODUCTION_READINESS.md, but the evidence-path-exists-on-disk requirement for test-matrix rows is real; salvage that half |
| validation/business/engineering/check-source-checkpoint.ts | keep | STRUCTURAL — checks repository identity, first-commit existence, and untracked source before build progress claims |
| validation/business/engineering/check-technical-docs-ste100.ts | keep | STRUCTURAL — mechanical two-rule subset (sentence length, present-perfect heuristic) of the ASD-STE100 reference, added 2026-08 alongside knowledge/engineering/technical-documentation-ste100.md; error-tier on the one file this change can currently guarantee compliant, warning-tier across the rest of the governed knowledge/**/*.md surface until each file is individually re-audited and promoted |
| validation/business/engineering/check-template-safety.ts | keep | STRUCTURAL — regex-lints shipped template code for forbidden imports/hardcoded strings, a real static-analysis check on code syntax |

### validation/business/experience/

| path | disposition | reason |
|---|---|---|
| validation/business/experience/check-eleven-star-experience.ts | drop | WORD-PATTERN — pure required-section/star-level phrase presence, no verifiable fact |
| validation/business/experience/check-emotional-design.ts | port | HYBRID — per-card schema-block validation and 3-way cross-doc risk-tier parity are genuinely structural (strongest PORT case in the file); dark-pattern copy scan is WORD-PATTERN |
| validation/business/experience/check-onboarding-conversion.ts | drop | WORD-PATTERN — regex/NLP inference over prose grading whether the doc *reads* compliant, never whether the flow *is* compliant; textbook capability-test replacement |
| validation/business/experience/check-ux-patterns.ts | drop | WORD-PATTERN — required-section and fallback-approval phrase pairing only |

### validation/business/growth/

| path | disposition | reason |
|---|---|---|
| validation/business/design/check-content-assets.ts | port | HYBRID — manifest.json asset-record + existsSync validation is structural (good model for structured-catalog-instead-of-prose); markdown-section presence is WORD-PATTERN. Relocated from validation/business/growth/ to validation/business/design/ (2026-08 graph-consolidation audit). |
| validation/business/operations/check-email.ts | port | HYBRID — proof-file existence, Doppler-routed RESEND_API_KEY, and hard-fail on a leaked key in .env are real; doc-content section checks are WORD-PATTERN. Relocated from validation/business/growth/ to validation/business/operations/ (2026-08 graph-consolidation audit). |
| validation/business/growth/check-landing-funnel.ts | port | HYBRID — robots/llms/sitemap existence, JSON-LD parse, and real source scans for motion/banned-claims are structural; deploy-gate doc-mention claims are unverifiable WORD-PATTERN (could be replaced by a real `git status`/deploy-target probe) |
| validation/business/growth/check-launch-narrative.ts | drop | WORD-PATTERN — required-section presence plus a fenced-block hashtag/emoji/link scan; deterministic but still self-declared prose, no proof of actual posting |
| validation/business/growth/check-paid-user-acquisition.ts | port | HYBRID — numeric-threshold and report-data-row presence add shallow real structure; section/mention checking is WORD-PATTERN; no live RevenueCat/ad-platform call exists to port yet |
| validation/business/growth/check-viral-growth-loop.ts | drop | the k-factor arithmetic check only verifies internal consistency of self-reported, never-confirmed numbers — fabricated inputs pass the same arithmetic; supersede with a live analytics (capability) check rather than porting an arithmetic check on unverified data |

### validation/business/money/

| path | disposition | reason |
|---|---|---|
| validation/business/money/check-paid-tool-decisions.ts | drop | WORD-PATTERN — pure regex over TOOL_DECISIONS.md prose, no live call |
| validation/business/money/check-revenue.ts | port | HYBRID — `revenuecat-proof.json` anti-gaming (fingerprint/byte-floor/freshness) and product-table rows are structural; paywall-model/pricing prose is WORD-PATTERN |

### validation/business/operations/

| path | disposition | reason |
|---|---|---|
| validation/business/operations/check-agent-operations.ts | port | STRUCTURAL Ajv-schema validation of a self-attested ledger with no live cross-check — keep the schema-conformance check (real value: malformed ledgers still fail), but this is the paradigm case the capability-boundary suite should backstop with real rejection evidence |
| validation/business/operations/check-control-plane-contract.ts | keep | STRUCTURAL — self-contained business.json controlPlane.panels shape validator |
| validation/business/operations/check-founder-operator-bootstrap.ts | port | HYBRID — Ajv-schema validation of business-access.json is structural; BUSINESS_ACCESS.md phrase checks are WORD-PATTERN; "Doppler ready" is field-presence only today, never a live `doppler` probe — port toward KTD3's real Doppler prerequisite probe |
| validation/business/operations/check-portfolio-registry.ts | keep | STRUCTURAL — section presence plus an explicit anti-gaming clause rejecting an emptied example row |
| validation/business/operations/check-post-launch-ops.ts | port | HYBRID — runbook date-math (live_since, checkpoint-overdue) is genuinely structural; measured-value cell-shape checks only verify form of self-reported numbers, not truth — same pattern as check-revenue.ts's weaker half |

### validation/business/process/

| path | disposition | reason |
|---|---|---|
| validation/business/process/check-agent-entrypoints.ts | drop | WORD-PATTERN — required-term presence across generated docs; heavily overlaps check-continuity-contract.ts and check-workflow-adherence.ts's term lists |
| validation/business/process/check-artifact-templates.ts | keep | STRUCTURAL — clean cross-reference: every lane's evidence path has a matching starter file on disk |
| validation/business/process/check-change-cascade.ts | keep | STRUCTURAL — validates recorded change_cascade entries against the structured cascade-edges.yaml map; the exact "edges as data" model the catalog itself now follows |
| validation/business/orchestration/check-continuity-contract.ts | port | HYBRID — term-list half duplicates check-agent-entrypoints.ts (WORD-PATTERN); continuity-block shape and source-file-exists half is structural. Relocated from validation/business/process/ to validation/business/orchestration/ (2026-08 graph-consolidation audit). |
| validation/business/process/check-generated-pages.ts | keep | STRUCTURAL — manifest existence plus byte-match drift check against a fresh render of the markdown source |
| validation/business/process/check-hooks-installed.ts | drop | confirmed by full read: every check in this file (234 lines) is specifically about the PostToolUse hook JSON — template well-formedness, installed-vs-shipped signature diffing, jq/SKILL_ROOT warnings. KTD8/R19 delete the Claude-only hook enforcement mechanism entirely at cutover in favor of reducer+validator enforcement that runs identically everywhere; this file's entire subject matter ceases to exist. Nothing to port. |
| validation/business/process/check-lane-coverage.ts | keep | STRUCTURAL — status enums, evidence/blocker rules, dependency-graph validation, staleness dates; near-duplicate of validate-project-state.ts's lane logic (flagged for consolidation at port time, not pre-merged here per the duplicated-helpers lesson — dedupe only after diffing output) |
| validation/business/process/check-launch-trace.ts | drop | WORD-PATTERN — pure required-section/ID/cross-ref phrase presence |
| validation/business/orchestration/check-parallel-orchestration.ts | port | HYBRID — the file-ownership collision algorithm is genuinely structural/algorithmic; ORCHESTRATION.md prose-policy checks only confirm the doc *describes* the policy, not that it was followed (WORD-PATTERN). Relocated from validation/business/process/ to validation/business/orchestration/ (2026-08 graph-consolidation audit). |
| validation/business/process/check-workflow-adherence.ts | drop | WORD-PATTERN — ~200 lines of `.includes()` term lists across knowledge docs/templates/fixtures; overlaps check-agent-entrypoints.ts and check-continuity-contract.ts |
| validation/business/orchestration/validate-project-state.ts | keep | STRUCTURAL — the core PROJECT_STATE.yaml schema validator: fields, date formats, enums, per-lane rules, evidence-path existence; largest structural file in the set. Relocated from validation/business/process/ to validation/business/orchestration/ (2026-08 graph-consolidation audit). |

### validation/business/product/ + validation/business/research/

| path | disposition | reason |
|---|---|---|
| validation/business/product/check-app-archetype.ts | keep | STRUCTURAL — the one validator checking the maintainer skill repo itself (README/prompts/fenced blocks/SKILL.md wiring reachability), not a generated business |
| validation/business/product/check-product-spec.ts | drop | WORD-PATTERN — sophisticated hand-rolled negation/concession detection over prose, but still grades whether an answer *sounds* like it concedes, never a verifiable fact; the clearest "grades form not truth" case in the whole set |
| validation/business/research/check-localization-research.ts | drop | WORD-PATTERN — keyword/phrase presence only; nothing confirms cited research data was actually pulled |
| validation/business/research/check-research-evidence.ts | port | HYBRID — the phase-gated Go/Pivot/Kill verdict trigger from PROJECT_STATE lane state is structural cross-lane logic worth keeping; provenance/section checks are WORD-PATTERN |

### validation/business/store/

| path | disposition | reason |
|---|---|---|
| validation/business/store/check-apple-app-store-requirements.ts | port | HYBRID — real PrivacyInfo.xcprivacy plist parsing is structural; ~30-phrase checklist is WORD-PATTERN |
| validation/business/store/check-apple-signing-packet.ts | drop | WORD-PATTERN — ~25-phrase checklist, no file/binary/live verification anywhere |
| validation/business/store/check-asc-command-contract.ts | keep | LIVE-PROOF — spawns the real installed `asc` CLI and diffs live `--version`/`--help` output against the skill's own contract doc |
| validation/business/store/check-aso-metadata.ts | drop | WORD-PATTERN — keyword-evidence mentions and char-count only; screenshot dimension check is by filename not bytes (contrast with check-store-screenshots.ts, which reads real PNG bytes for the same question) |
| validation/business/store/check-google-play-readiness.ts | drop | WORD-PATTERN — pure phrase-presence, no live Play API |
| validation/business/store/check-store-console-packet.ts | port | HYBRID — HTML-artifact existence checks are structural; bulk is large phrase lists (WORD-PATTERN) |
| validation/business/store/check-store-screenshots.ts | keep | STRUCTURAL — reads real PNG IHDR headers off disk, byte-compares grading ledgers against the shipped example to catch copy-paste; strongest structural validator in the whole 67-file set |

### validation/business/trust/

| path | disposition | reason |
|---|---|---|
| validation/business/trust/check-privacy-terms.ts | keep | Reversal of this row's original "drop" (2026-08-19, a ten-risk legal/privacy checklist wired into required auditing). The original reasoning was sound as far as it went — WORD-PATTERN, purely self-attestable, and the drop decision's own §9 explanation ("no mechanism confirms the published policy matches what the checklist graded") is still true and stays true: this gate cannot verify the disclosure is *accurate*, only that it exists. But under the artifact-vs-report test that already reinstated check-no-slop.ts and check-app-copy.ts/check-founder-copy.ts above, that residual gap does not make the check worthless — trust/PRIVACY.md, trust/TERMS.md, and trust/AI_SAFETY.md ARE the shipped legal/trust surface a user or app-store reviewer reads, not a report about some separate offline process, so scanning them for the presence of ten concrete, named disclosure categories (missing privacy policy, no data-collection disclosure, no AI mention, no third-party disclosure, undeleted uploads, a public storage bucket, cancellation harder than signup, no auto-renewal reminder, no self-harm response — knowledge/trust/privacy-terms.md §7) is direct verification of the shipped artifact, exactly like check-security-release.ts's own dozens of required-phrase checks, which this ledger already ports/keeps for the structurally identical reason. The rewritten file explicitly disclaims what it cannot prove ("checks for the presence of each disclosure, not its legal correctness... pair a passing run with the founder/counsel review") rather than posing as compliance sign-off, and per this repo's standing rule that a gate is real only once it has been watched to fail, nine fail-then-catch fixture cases (one clean pass, eight negative controls) in providers-and-secrets.fixtures.ts prove each of the eight enforced risk codes actually fires. |
| validation/business/trust/check-secret-routing.ts | keep | STRUCTURAL (security) — scans committed files for literal secret-value regex, forbidden filenames, unrouted env-vars; real secret material, not tone — the direct precursor to a capability-boundary "secret never lands in a committed file" test |
| validation/business/trust/check-security-release.ts | port | HYBRID — trust/security-review.html existence is a small structural sliver; bulk is dozens of required-phrase checks (WORD-PATTERN) |

### validation/business/words/

| path | disposition | reason |
|---|---|---|
| validation/business/words/check-app-copy.ts | keep | Reversal of this row's original "port" (2026-08-07 council review, resolving the follow-up check-no-slop.ts's row promised). The port plan assumed the word-pattern half grades a self-attested report about some other process — the disease "drop"/"port" dispositions target elsewhere in this ledger. That disease is not present here: COPY_DECK.md cell text and the ONBOARDING.md Copy column ARE the shipped app strings, not a claim about them, so scanning them for banned vocabulary and placeholder shapes is direct verification of the shipped surface — the same artifact-vs-report test that justifies check-no-slop.ts's reinstatement above. The structural half (deck/brief shape, coverage cross-referencing, TECH_SPEC mechanism naming, and the strongest check in the file — a real scan of starter source for hardcoded JSX text bypassing lib/strings.ts) already ships as-is; there was never a kernel left to extract. The word-pattern half (banned-vocabulary and fictional-brand scans) is real and has dozens of passing fail-then-catch fixture cases in copy.fixtures.ts (verified live 2026-08-07: 604/604 passing, including deliberately-bad-input cases) — weaker evidence than the structural checks (a fixed list, not immune to synonyms or a not-yet-added banned term), but that is a scoped list-maintenance concern, not a reason to drop or fork the check. |
| validation/business/words/check-founder-copy.ts | keep | Reversal of this row's original "port" (2026-08-07 council review, resolving the follow-up check-no-slop.ts's row promised), by the same artifact-vs-report test as check-app-copy.ts above: the founder-visible HTML/markdown surfaces this gate scans are literally what a founder reads (rendered, code/style/script stripped), not a report about a separate process, so grading them for banned vocabulary and raw identifiers is direct verification of the shipped surface. The coverage, celebration-beat, and experience-card tier-drift checks were already correctly called "the most structural of the three words/ files" in this ledger's original pass. One real gap surfaced during this review: the general banned-vocabulary rule (rule 3, founder_copy.internal_vocabulary) had zero fixture coverage — only the narrower rule-4b technique-naming special case was tested. Verified live 2026-08-07 (a hand-injected banned term in founder-visible prose correctly failed the gate) and closed with a permanent fixture case in repo-gates.fixtures.ts before finalizing this disposition, per this repo's own standing rule that a gate is real only once it has been watched to fail. |
| validation/business/words/check-no-slop.ts | keep | Reversal of this row's original "drop" (2026-08 graph-consolidation audit, superseding the U11 disposition below). This row's drop reasoning was sound in isolation — WORD-PATTERN, "mechanical patterns only" per its own header — but the U11 plan never applied that reasoning consistently: `check-app-copy.ts` and `check-founder-copy.ts` in this same directory were dispositioned `port` (word-pattern half to be stripped, structural half to survive) and, two months later, remain fully unchanged HYBRID validators still running the exact word-pattern logic the philosophy said to drop. A gate that scans this repo's own front-door docs (README/CONTRIBUTING/SECURITY/CODE_OF_CONDUCT/AGENTS/CLAUDE) for the banned words and slop patterns `knowledge/words/no-slop-writing.md` §2 already promises to enforce there is real, working, tested value (7 fixture cases; a live inject-and-catch verification) that a partially-executed philosophy should not block. The original 2026-07-25 file had already proven this once — it drove a 302-to-140-line README rewrite and added the CODE_OF_CONDUCT.md/SECURITY.md the repo lacked. Follow-up resolved 2026-08-07: `check-app-copy.ts`/`check-founder-copy.ts` were re-councilled and their "port" disposition revised to "keep" (see their rows above) under the same artifact-vs-report test that justifies this row's own reinstatement — the philosophy is now applied consistently across all three words/ siblings |

### validation/repository/

| path | disposition | reason |
|---|---|---|
| validation/repository/check-autopilot-contract.ts | port | HYBRID — eval-object shape validation is structural; keyword-grepping SKILL.md description/body prose is WORD-PATTERN |
| validation/repository/check-gates-layout.ts | keep | STRUCTURAL — pure filesystem/shape check: validation/business/ mirrors knowledge/ domains 1:1, no ungrouped gates, no duplicate script basenames |
| validation/repository/check-hub-spoke.ts | keep | STRUCTURAL — no v1 precedent, added with the 2026-08 graph-consolidation audit's money-domain hub-and-spoke split; verifies every knowledge/ spoke's "Part of the [Hub]" backlink is reciprocated by a link back from the hub |
| validation/repository/check-learning-grounding.ts | keep | post-cutover addition (2026-08-18): grounding contract for knowledge/*/learnings/ — required sections, resolvable path:line citations, date order, verdict-lifecycle pairing, 180-day review-overdue warnings |
| validation/repository/check-validator-docs.ts | keep | STRUCTURAL — no v1 precedent, added with the 2026-08-18 knowledge-matrix audit; two-way drift check that every command documented in docs/validators.md exists as an npm script and every check:*/validate:* script has a documented row |
| validation/repository/check-package-parity.ts | keep | STRUCTURAL — compares the two package manifests/lockfiles against skill-version.json; wired only via the repo-root package.json's `check:package-parity` script (absent from the skill-scoped manifest, which is exactly why literal-scope discovery would have missed it) |
| validation/repository/check-reference-size.ts | keep | STRUCTURAL — per-file byte budgets on knowledge/, link-graph regex only extracts targets (doesn't grade content) |
| validation/repository/check-skill-graph.ts | port | confirmed by full read: the checking *pattern* (referential integrity across 11 node categories + generated-projection drift-check) is exactly right and worth preserving, but the file is hardcoded one-to-one against the current `runtime/graph/*.ts` module layout (4 specific relative imports, 2 specific generated-file block markers) that this rebuild is restructuring. This same unit (U8) ships its replacement: `catalog/validate.ts` (referential integrity, cycles, load-when presence) + `catalog/render-routing.ts --check` (drift). |
| validation/repository/check-skill-version.ts | port | HYBRID — JSON/semver comparison is structural; the `--remote-url` branch is a genuine LIVE-PROOF `https.get` call |
| validation/repository/check-source-freshness.ts | keep | STRUCTURAL — despite its name, only ever compares local repo text against source-registry.yaml via `git log`/`diff`; no live fetch, so no live-proof upgrade needed to stay honest about what it does |
| validation/repository/check-version-discipline.ts | keep | STRUCTURAL — skill-version.json field-format checks plus a git-based "manifest bumped alongside changes" rule; distinct concern from check-skill-version.ts |
| validation/repository/run-agent-evals.ts | port | HYBRID — eval YAML shape validation is structural; the `--responses` branch greps static fixture files for phrases despite the name suggesting a live agent call (no live LLM call exists anywhere in the file) — port the shape validation, do not port the illusion of live evaluation |

---

## Eight most consequential drop decisions

(Was ten, then nine. `validation/business/words/check-no-slop.ts`, formerly #7 here, was
reinstated 2026-08-07 — see its row above for why "purest word-pattern validator" was not,
in practice, a consistently-applied reason to drop one validator while leaving its two
siblings' identical logic untouched. `validation/business/trust/check-privacy-terms.ts`,
formerly #9 here, was reinstated 2026-08-19 under the same artifact-vs-report test — see
its row above.)

1. **The 15 knowledge domain README.md index files** (§1) — the direct implementation of
   R20's routing-authority inversion; every one of them is superseded by
   `catalog/generated/routing.md`.
2. **`knowledge/orchestration/autonomy-modes.md`** — the prose autonomy-mode ladder this
   entire plan replaces with code-evaluated grants; the clearest "prose superseded by
   catalog data" case in the whole ledger.
3. **`validation/business/process/check-hooks-installed.ts`** — its entire subject (the
   Claude-only PostToolUse hook mechanism) is deleted at cutover; nothing survives to port.
4. **`validation/business/experience/check-onboarding-conversion.ts`** — regex/NLP inference
   grading whether prose *reads* compliant, never whether the flow *is* compliant; the
   textbook case for what a capability-boundary test replaces.
5. **`validation/business/growth/check-viral-growth-loop.ts`** — its arithmetic-consistency
   check validates self-reported numbers that were never cross-checked against PostHog;
   fabricated inputs pass identically, so the "structural-looking" check carries no real
   evidentiary weight.
6. **`validation/business/product/check-product-spec.ts`** — hand-rolled negation/concession
   detection over prose; sophisticated regex work in service of grading tone, not truth.
7. **`validation/business/process/check-workflow-adherence.ts`** — ~200 lines of duplicated
   `.includes()` term-list scaffolding shared with two sibling validators, none of which
   verify anything beyond a document containing the right words.
8. **`validation/business/store/check-apple-signing-packet.ts`** — a 25-phrase checklist
   with zero file, binary, or live verification anywhere in the file.
