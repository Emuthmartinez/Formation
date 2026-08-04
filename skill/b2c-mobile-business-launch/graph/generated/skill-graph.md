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

| Stable ID | Workflow | Domain | Proof gates |
| --- | --- | --- | --- |
| `workflow.orchestration.session-continuity-resume` | Session continuity / resume | `domain.orchestration` | `check:continuity-contract` |
| `workflow.orchestration.orient-scaffold-and-state-cockpit-upkeep` | Orient, scaffold & state/cockpit upkeep | `domain.orchestration` | `validate:launch-state`, `render:launch-cockpit` |
| `workflow.process.provider-proof-verification` | Provider-proof verification | `domain.process` | `check:provider-proof` |
| `workflow.process.change-cascade` | Change cascade | `domain.process` | `check:change-cascade` |
| `workflow.process.launch-trace-and-build-contracts` | Launch trace & build contracts | `domain.process` | `check:launch-trace` |
| `workflow.process.business-control-plane-extension` | Business Control Plane extension | `domain.process` | `check:control-plane`, `check:business-control-plane-workspace` |
| `workflow.process.launchbench-failure-cards-coverage-audit` | LaunchBench / failure-cards / coverage audit | `domain.process` | `launchbench`, `check:lane-coverage` |
| `workflow.operations.paid-tool-routing-and-fallback` | Paid-tool routing & fallback | `domain.operations` | `check:paid-tool-decisions` |
| `workflow.operations.secrets-baseline-and-routing` | Secrets baseline & routing | `domain.operations` | `check:secrets` |
| `workflow.trust.security-architecture-and-release-gate` | Security architecture & release gate | `domain.trust` | `check:security` |
| `workflow.trust.privacy-and-terms` | Privacy & terms | `domain.trust` | `check:privacy-terms` |
| `workflow.operations.resend-email-ops` | Resend email ops | `domain.operations` | `check:email` |
| `workflow.operations.post-launch-operations` | Post-launch operations | `domain.operations` | `check:post-launch` |
| `workflow.operations.founder-zero-operator-bootstrap` | Founder-zero operator bootstrap | `domain.operations` | `check:founder-operator` |
| `workflow.operations.agent-operations-ledger` | Agent operations ledger | `domain.operations` | `check:agent-operations` |
| `workflow.product.app-archetype-detection-and-starter` | App-archetype detection & starter | `domain.product` | `check:app-archetype`, `check:archetype-starter` |
| `workflow.research.research-backed-spec` | Research-backed spec | `domain.research` | `check:research`, `check:product-spec` |
| `workflow.research.localization-market-research` | Localization market research | `domain.research` | `check:localization-research` |
| `workflow.experience.11-star-experience` | 11-star experience | `domain.experience` | `check:11-star` |
| `workflow.experience.emotional-experience-design-producer` | Emotional experience design (producer) | `domain.experience` | `check:emotional-design` |
| `workflow.experience.emotional-design-audit-auditor` | Emotional design audit (auditor) | `domain.experience` | `check:emotional-design` |
| `workflow.design.design-room-state-mutate-version-render` | Design Room (state→mutate→version→render) | `domain.design` | `validate:design-state`, `check:design-room`, `render:design-room` |
| `workflow.design.token-promotion` | Token promotion | `domain.design` | `check:token-promotion` |
| `workflow.design.ux-patterns-refero` | UX patterns (Refero) | `domain.design` | `check:ux-patterns` |
| `workflow.experience.onboarding-conversion` | Onboarding conversion | `domain.experience` | `check:onboarding` |
| `workflow.design.premium-mobile-craft` | Premium mobile craft | `domain.design` | `check:ux-patterns`, `check:motion-contract` |
| `workflow.design.content-assets-remotion-generated-visuals` | Content assets / Remotion / generated visuals | `domain.design` | `check:content-assets` |
| `workflow.words.writing-quality-no-slop` | Writing quality (no-slop) | `domain.words` | `check:no-slop`, `check:app-copy` |
| `workflow.store.aso-and-store-ops` | ASO & store ops | `domain.store` | `check:aso-metadata` |
| `workflow.store.app-store-listing-prep-packet` | App Store listing prep packet | `domain.store` | `check:store-console` |
| `workflow.store.apple-signing-and-release-readiness` | Apple signing & release readiness | `domain.store` | `check:apple-signing` |
| `workflow.store.apple-app-store-requirements-privacy-manifest` | Apple App Store requirements (privacy manifest) | `domain.store` | `check:apple-requirements` |
| `workflow.store.store-console-workflow` | Store console workflow | `domain.store` | `check:store-console` |
| `workflow.store.asc-cli-automation` | ASC CLI automation | `domain.store` | `check:asc-command-contract` |
| `workflow.store.store-screenshots-production` | Store screenshots production | `domain.store` | `check:store-screenshots` |
| `workflow.store.google-play-release` | Google Play release | `domain.store` | `check:google-play` |
| `workflow.engineering.engineering-orchestration-ce-production-readiness` | Engineering orchestration (CE + production readiness) | `domain.engineering` | `check:compound-engineering`, `check:orchestration` |
| `workflow.engineering.backend-data-contract` | Backend data contract | `domain.engineering` | `check:backend-contract` |
| `workflow.engineering.app-agent-roster-and-repo-entrypoints` | App agent roster & repo entrypoints | `domain.engineering` | `check:agent-entrypoints` |
| `workflow.engineering.mobai-device-automation-and-demo-videos` | MobAI device automation & demo videos | `domain.engineering` | `check:mobai-proof` |
| `workflow.engineering.native-ios-proof-route-ladder` | Native iOS proof (Route Ladder) | `domain.engineering` | `check:native-ios` |
| `workflow.data.analytics-and-attribution-blueprint` | Analytics & attribution blueprint | `domain.data` | `check:analytics-catalog`, `check:attribution` |
| `workflow.growth.paid-user-acquisition-system` | Paid user-acquisition system | `domain.growth` | `check:paid-ua` |
| `workflow.growth.viral-growth-loop` | Viral growth loop | `domain.growth` | `check:viral-growth` |
| `workflow.growth.launch-narrative-and-cadence` | Launch narrative & cadence | `domain.growth` | `check:launch-narrative` |
| `workflow.money.revenue-monetization` | Revenue monetization | `domain.money` | `check:revenue` |
| `workflow.growth.geo-seo-public-visibility` | GEO/SEO public visibility | `domain.growth` | `check:landing-funnel` |
| `workflow.growth.pre-launch-funnel-landing-waitlist` | Pre-launch funnel (landing/waitlist) | `domain.growth` | `check:landing-funnel` |
| `workflow.growth.ugc-creator-engine` | UGC creator engine | `domain.growth` | `check:viral-growth` |
| `workflow.growth.fastlane-growth-ops` | Fastlane growth ops | `domain.growth` | `check:post-launch` |
| `workflow.machine.runtime-freshness-gate-consumer-side` | Runtime freshness gate (consumer side) | `domain.machine` | `check:skill-version` |
| `workflow.machine.source-freshness-maintenance-maintainer` | Source-freshness maintenance (maintainer) | `domain.machine` | `check:source-registry` |
| `workflow.machine.skill-runtime-sync-and-version-discipline-maintainer` | Skill runtime sync & version discipline (maintainer) | `domain.machine` | `check:version-discipline`, `check:skill-version` |
| `workflow.machine.founder-language-translation-maintainer` | Founder-language translation (maintainer) | `domain.machine` | `check:founder-copy` |
| `workflow.machine.skill-triggering-contract-maintainer` | Skill triggering contract (maintainer) | `domain.machine` | `check:autopilot` |
| `workflow.machine.asc-command-contract-maintainer` | ASC command contract (maintainer) | `domain.machine` | `check:asc-command-contract` |
| `workflow.machine.definition-graph-maintenance` | Definition graph maintenance | `domain.machine` | `check:skill-graph`, `render:skill-graph` |
