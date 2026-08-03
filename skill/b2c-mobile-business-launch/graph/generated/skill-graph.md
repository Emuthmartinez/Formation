# Typed Skill Graph

Generated from the TypeScript definition graph. Edit graph definitions, not this file.

## Business areas

| ID | Name | Domains |
| --- | --- | --- |
| `area.operating-system` | Operating System | `domain.process`, `domain.orchestration` |
| `area.business-operations-trust` | Business Operations And Trust | `domain.operations`, `domain.trust` |
| `area.product-experience` | Product And Experience | `domain.research`, `domain.product`, `domain.experience`, `domain.design`, `domain.words` |
| `area.build-release` | Build And Release | `domain.engineering`, `domain.store` |
| `area.growth-revenue` | Growth And Revenue | `domain.money`, `domain.growth`, `domain.data` |
| `area.skill-maintenance` | Skill Maintenance | `domain.machine` |

## Workflows

| Legacy | Stable ID | Workflow | Domain | Proof gates |
| --- | --- | --- | --- | --- |
| L02 | `workflow.orchestration.session-continuity-resume` | Session continuity / resume | `domain.orchestration` | `check:continuity-contract` |
| L03 | `workflow.orchestration.orient-scaffold-and-state-cockpit-upkeep` | Orient, scaffold & state/cockpit upkeep | `domain.orchestration` | `validate:launch-state`, `render:launch-cockpit` |
| L07 | `workflow.process.provider-proof-verification` | Provider-proof verification | `domain.process` | `check:provider-proof` |
| L08 | `workflow.process.change-cascade` | Change cascade | `domain.process` | `check:change-cascade` |
| L18 | `workflow.process.launch-trace-and-build-contracts` | Launch trace & build contracts | `domain.process` | `check:launch-trace` |
| L26 | `workflow.process.business-control-plane-extension` | Business Control Plane extension | `domain.process` | `check:control-plane`, `check:business-control-plane-workspace` |
| L49 | `workflow.process.launchbench-failure-cards-coverage-audit` | LaunchBench / failure-cards / coverage audit | `domain.process` | `launchbench`, `check:lane-coverage` |
| L04 | `workflow.operations.paid-tool-routing-and-fallback` | Paid-tool routing & fallback | `domain.operations` | `check:paid-tool-decisions` |
| L05 | `workflow.operations.secrets-baseline-and-routing` | Secrets baseline & routing | `domain.operations` | `check:secrets` |
| L19 | `workflow.trust.security-architecture-and-release-gate` | Security architecture & release gate | `domain.trust` | `check:security` |
| L41 | `workflow.trust.privacy-and-terms` | Privacy & terms | `domain.trust` | `check:privacy-terms` |
| L42 | `workflow.operations.resend-email-ops` | Resend email ops | `domain.operations` | `check:email` |
| L47 | `workflow.operations.post-launch-operations` | Post-launch operations | `domain.operations` | `check:post-launch` |
| L51 | `workflow.operations.founder-zero-operator-bootstrap` | Founder-zero operator bootstrap | `domain.operations` | `check:founder-operator` |
| L52 | `workflow.operations.agent-operations-ledger` | Agent operations ledger | `domain.operations` | `check:agent-operations` |
| L06 | `workflow.product.app-archetype-detection-and-starter` | App-archetype detection & starter | `domain.product` | `check:app-archetype`, `check:archetype-starter` |
| L09 | `workflow.research.research-backed-spec` | Research-backed spec | `domain.research` | `check:research`, `check:product-spec` |
| L10 | `workflow.research.localization-market-research` | Localization market research | `domain.research` | `check:localization-research` |
| L12 | `workflow.experience.11-star-experience` | 11-star experience | `domain.experience` | `check:11-star` |
| L13 | `workflow.experience.emotional-experience-design-producer` | Emotional experience design (producer) | `domain.experience` | `check:emotional-design` |
| L14 | `workflow.experience.emotional-design-audit-auditor` | Emotional design audit (auditor) | `domain.experience` | `check:emotional-design` |
| L20 | `workflow.design.design-room-state-mutate-version-render` | Design Room (state→mutate→version→render) | `domain.design` | `validate:design-state`, `check:design-room`, `render:design-room` |
| L21 | `workflow.design.token-promotion` | Token promotion | `domain.design` | `check:token-promotion` |
| L22 | `workflow.design.ux-patterns-refero` | UX patterns (Refero) | `domain.design` | `check:ux-patterns` |
| L23 | `workflow.experience.onboarding-conversion` | Onboarding conversion | `domain.experience` | `check:onboarding` |
| L24 | `workflow.design.premium-mobile-craft` | Premium mobile craft | `domain.design` | `check:ux-patterns`, `check:motion-contract` |
| L25 | `workflow.design.content-assets-remotion-generated-visuals` | Content assets / Remotion / generated visuals | `domain.design` | `check:content-assets` |
| L53 | `workflow.words.writing-quality-no-slop` | Writing quality (no-slop) | `domain.words` | `check:no-slop`, `check:app-copy` |
| L27 | `workflow.store.aso-and-store-ops` | ASO & store ops | `domain.store` | `check:aso-metadata` |
| L28 | `workflow.store.app-store-listing-prep-packet` | App Store listing prep packet | `domain.store` | `check:store-console` |
| L29 | `workflow.store.apple-signing-and-release-readiness` | Apple signing & release readiness | `domain.store` | `check:apple-signing` |
| L30 | `workflow.store.apple-app-store-requirements-privacy-manifest` | Apple App Store requirements (privacy manifest) | `domain.store` | `check:apple-requirements` |
| L31 | `workflow.store.store-console-workflow` | Store console workflow | `domain.store` | `check:store-console` |
| L32 | `workflow.store.asc-cli-automation` | ASC CLI automation | `domain.store` | `check:asc-command-contract` |
| L33 | `workflow.store.store-screenshots-production` | Store screenshots production | `domain.store` | `check:store-screenshots` |
| L34 | `workflow.store.google-play-release` | Google Play release | `domain.store` | `check:google-play` |
| L35 | `workflow.engineering.engineering-orchestration-ce-production-readiness` | Engineering orchestration (CE + production readiness) | `domain.engineering` | `check:compound-engineering`, `check:orchestration` |
| L36 | `workflow.engineering.backend-data-contract` | Backend data contract | `domain.engineering` | `check:backend-contract` |
| L37 | `workflow.engineering.app-agent-roster-and-repo-entrypoints` | App agent roster & repo entrypoints | `domain.engineering` | `check:agent-entrypoints` |
| L38 | `workflow.engineering.mobai-device-automation-and-demo-videos` | MobAI device automation & demo videos | `domain.engineering` | `check:mobai-proof` |
| L39 | `workflow.engineering.native-ios-proof-route-ladder` | Native iOS proof (Route Ladder) | `domain.engineering` | `check:native-ios` |
| L11 | `workflow.data.analytics-and-attribution-blueprint` | Analytics & attribution blueprint | `domain.data` | `check:analytics-catalog`, `check:attribution` |
| L15 | `workflow.growth.paid-user-acquisition-system` | Paid user-acquisition system | `domain.growth` | `check:paid-ua` |
| L16 | `workflow.growth.viral-growth-loop` | Viral growth loop | `domain.growth` | `check:viral-growth` |
| L17 | `workflow.growth.launch-narrative-and-cadence` | Launch narrative & cadence | `domain.growth` | `check:launch-narrative` |
| L40 | `workflow.money.revenue-monetization` | Revenue monetization | `domain.money` | `check:revenue` |
| L43 | `workflow.growth.geo-seo-public-visibility` | GEO/SEO public visibility | `domain.growth` | `check:landing-funnel` |
| L44 | `workflow.growth.pre-launch-funnel-landing-waitlist` | Pre-launch funnel (landing/waitlist) | `domain.growth` | `check:landing-funnel` |
| L45 | `workflow.growth.ugc-creator-engine` | UGC creator engine | `domain.growth` | `check:viral-growth` |
| L46 | `workflow.growth.fastlane-growth-ops` | Fastlane growth ops | `domain.growth` | `check:post-launch` |
| L01 | `workflow.machine.runtime-freshness-gate-consumer-side` | Runtime freshness gate (consumer side) | `domain.machine` | `check:skill-version` |
| L48 | `workflow.machine.source-freshness-maintenance-maintainer` | Source-freshness maintenance (maintainer) | `domain.machine` | `check:source-registry` |
| L50 | `workflow.machine.skill-runtime-sync-and-version-discipline-maintainer` | Skill runtime sync & version discipline (maintainer) | `domain.machine` | `check:version-discipline`, `check:skill-version` |
| L54 | `workflow.machine.founder-language-translation-maintainer` | Founder-language translation (maintainer) | `domain.machine` | `check:founder-copy` |
| L55 | `workflow.machine.skill-triggering-contract-maintainer` | Skill triggering contract (maintainer) | `domain.machine` | `check:autopilot` |
| L56 | `workflow.machine.asc-command-contract-maintainer` | ASC command contract (maintainer) | `domain.machine` | `check:asc-command-contract` |
| L57 | `workflow.machine.definition-graph-maintenance` | Definition graph maintenance | `domain.machine` | `check:skill-graph`, `render:skill-graph` |
