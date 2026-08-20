# Formation Repository Agent Guide

This repository is Formation: a typed workflow-graph engine that takes a consumer mobile-app business from idea to shipped and into ongoing autonomous operation. `skill/formation/` is the product — the catalog, compiler, frontier, reducer, sessions, and agent surfaces (the `formation` CLI bin and the `formation-mcp` server). It also installs as the `formation` agent skill and keeps its own versioning and installed-runtime contract.

Every UI is an external consumer in its own repository, bound by the adapter contract (schema-checked boundary reports with a `contractVersion`; golden samples gated by `check:adapter-contract`). The founder web application lives at [Emuthmartinez/Formation-Platform](https://github.com/Emuthmartinez/Formation-Platform). The standing rule: **L4 never lives in this repository.** Do not expose engine files as consumer navigation.

## Read order

1. `README.md` for what the engine is and how to drive it.
2. `docs/architecture.md` for the execution loop, trust boundary, and the consumer integration contract.
3. `skill/formation/README.md` and `SKILL.md` for engine changes.
4. The owning directory documentation and directly relevant source.

## Source layers

| Layer | Owns | Must not own |
| --- | --- | --- |
| `skill/formation/core/` | Typed schemas, durable execution, reducer, autonomy, sessions, and runtime adapters | Consumer navigation or consumer membership state |
| `skill/formation/catalog/` | Definition graph, workflows, gates, references, and routing projections | Run state or founder-facing application state |
| `skill/formation/knowledge/` | Bounded reasoning guidance and source-backed doctrine | Scheduling or mutable business records |
| `skill/formation/content/` | Skill-rendered conversation content | Platform page structure or generated artifacts |
| `skill/formation/workspace/` and `workspace-template/` | Skill business artifacts, exports, and app-repository templates | Platform tenancy or execution topology |
| `skill/formation/validation/` | Business gates, repository checks, fixtures, and LaunchBench | Orchestration policy |
| `skill/formation/verification/` | Runtime fixtures, capability boundaries, parity, scenarios, and audit proof | Founder product acceptance criteria |
| `skill/formation/tooling/` | Renderers, probes, migrations, and skill mechanics | Untestable durable policy |
| `skill/formation/studio/` | Maintainer visual QA, seed state, and generated output | Founder product state or primary navigation |
| `skill/formation/starters/` | Runnable product-archetype foundations | Alternate orchestration systems |
| `skill/formation/agents/` | Agent-runtime interface manifests (for example the OpenAI surface descriptor) | Orchestration logic or launch state |

A consumer may request skill execution through the typed adapter. It must not read or mutate skill state files directly. The skill may return verified results through that adapter. It must not mutate any consumer's persistence directly.

## Authored and generated boundaries

- Founder product behavior belongs in the consumer repositories, never here.
- Edit catalog definitions, not `catalog/generated/`.
- Edit authored Markdown, JSON, or source components, not generated HTML.
- Every generated skill file needs an owning renderer and freshness check.
- Stable catalog IDs survive path moves. Paths are bindings, not identity.
- Only the skill reducer writes reducer-owned business documents; the skill owns run-state and checkpoint files.
- Never commit founder data, credentials, provider secrets, or local build output.

## Change contract

A skill change must update definitions, workspace artifacts, validators, fixtures or LaunchBench scenarios, generated projections, version metadata, and current documentation together. A change to the adapter boundary bumps `ADAPTER_CONTRACT_VERSION` by its rules, regenerates the golden samples in the same commit, and is replayed by each consumer repository's CI against those goldens.

A change that builds or restyles a landing page, funnel, web marketing surface, or founder-facing UI also gets the vibecode audit pass before it is called done: dispatch the `vibecode-auditor` subagent (`.claude/agents/vibecode-auditor.md`), defined by `skill/formation/knowledge/design/vibecoded-tells.md` §Audit Pass.

A change that touches privacy, terms, subscriptions, storage/backend data handling, or generative-AI behavior also clears the legal/privacy risk checklist before it is called done: `knowledge/trust/privacy-terms.md` §7 names the ten risks (missing privacy policy, no data-collection disclosure, no AI mention, no third-party disclosure, undeleted uploads, a public storage bucket, fake testimonials, cancellation harder than signup, auto-renewal with no reminder, and AI with no self-harm response) and their owning artifacts. `npm run check:privacy` runs in `audit:ci` and enforces the mechanical subset automatically; fake testimonials stay owned by the vibecode audit pass above so they are judged once.

## Documentation style

Technical documentation (architecture docs, engineering specs, ADRs, runbooks, API/config references, and the skill's own `knowledge/*.md` files) always uses Simplified Technical English (ASD-STE100) — see `skill/formation/knowledge/engineering/technical-documentation-ste100.md`, loaded via the skill's catalog reference graph. This file, root `README.md`, and other founder/marketing copy keep following `skill/formation/knowledge/words/no-slop-writing.md` instead.

## Commands

```bash
npm ci
npm run audit:ci
npm run launchbench
npm run check:catalog
npm run catalog:render-routing -- --check
npm pack --dry-run --json
```

Subagents may mutate bounded, disjoint scopes. The orchestrator owns integration, git, shared state, provider changes, public actions, spend, destructive actions, and releases.

## Maintainer compatibility

Root guidance is for this combined repository. Do not copy it into a launched business or generated app repository. Generated businesses receive their own entrypoints from the skill workspace templates.

## Runtime sync and source freshness

Use runtime sync only on the maintainer machine after repository validation. Verify fast-moving provider sources before changing external commands or guidance.
