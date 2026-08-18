# Formation Repository Agent Guide

This repository is Formation, the founder platform. It contains two bounded systems:

1. `platform/`, the Formation founder product. This is the product.
2. `skill/b2c-mobile-business-launch/`, the graph-native launch engine used behind the product and by existing agent workflows. The engine keeps its own name, versioning, and installed-runtime contract.

Do not collapse their state models or expose engine files as founder navigation.

## Read order

1. `README.md` for product scope and setup.
2. `docs/architecture.md` for the platform and engine boundary.
3. `platform/AGENTS.md` for founder-product changes.
4. `skill/b2c-mobile-business-launch/README.md` and `SKILL.md` for engine changes.
5. The owning directory documentation and directly relevant source.

## Source layers

| Layer | Owns | Must not own |
| --- | --- | --- |
| `platform/web/` | Founder navigation, product pages, editing, responsive interaction, and the design system | Direct filesystem access, engine state, provider secrets, or authorization decisions |
| `platform/server/` | Authentication, workspace tenancy, product domain state, persistence, structured generation, and product APIs | Graph execution internals or browser-only presentation state |
| `skill/b2c-mobile-business-launch/core/` | Typed schemas, durable execution, reducer, autonomy, sessions, and runtime adapters | Founder product navigation or platform membership state |
| `skill/b2c-mobile-business-launch/catalog/` | Definition graph, workflows, gates, references, and routing projections | Run state or founder-facing application state |
| `skill/b2c-mobile-business-launch/knowledge/` | Bounded reasoning guidance and source-backed doctrine | Scheduling or mutable business records |
| `skill/b2c-mobile-business-launch/content/` | Engine-rendered conversation content | Platform page structure or generated artifacts |
| `skill/b2c-mobile-business-launch/workspace/` and `workspace-template/` | Engine business artifacts, exports, and app-repository templates | Platform tenancy or execution topology |
| `skill/b2c-mobile-business-launch/validation/` | Business gates, repository checks, fixtures, and LaunchBench | Orchestration policy |
| `skill/b2c-mobile-business-launch/verification/` | Runtime fixtures, capability boundaries, parity, scenarios, and audit proof | Founder product acceptance criteria |
| `skill/b2c-mobile-business-launch/tooling/` | Renderers, probes, migrations, and engine mechanics | Untestable durable policy |
| `skill/b2c-mobile-business-launch/studio/` | Maintainer visual QA, seed state, and generated output | Founder product state or primary navigation |
| `skill/b2c-mobile-business-launch/starters/` | Runnable product-archetype foundations | Alternate orchestration systems |
| `skill/b2c-mobile-business-launch/agents/` | Agent-runtime interface manifests (for example the OpenAI surface descriptor) | Orchestration logic or launch state |

The platform may request engine execution through a typed adapter. It must not read or mutate engine state files directly. The engine may return verified results through that adapter. It must not mutate platform persistence directly.

## Authored and generated boundaries

- Founder product behavior belongs in `platform/`; follow `platform/AGENTS.md`.
- All durable platform mutations use the server store transaction and verify workspace membership.
- Edit catalog definitions, not `catalog/generated/`.
- Edit authored Markdown, JSON, or source components, not generated HTML.
- Every generated engine file needs an owning renderer and freshness check.
- Stable catalog IDs survive path moves. Paths are bindings, not identity.
- Only the engine reducer writes reducer-owned business documents; the engine owns run-state and checkpoint files.
- Never commit founder data, credentials, provider secrets, or local build output.

## Change contract

A platform change must update the product domain, API, page behavior, tests, and current documentation together. An engine change must update definitions, workspace artifacts, validators, fixtures or LaunchBench scenarios, generated projections, version metadata, and current documentation together. Cross-boundary changes require an explicit adapter contract and tests on both sides.

A change that builds or restyles a landing page, funnel, web marketing surface, or founder-facing UI also gets the vibecode audit pass before it is called done: dispatch the `vibecode-auditor` subagent (`.claude/agents/vibecode-auditor.md`), defined by `skill/b2c-mobile-business-launch/knowledge/design/vibecoded-tells.md` §Audit Pass.

## Documentation style

Technical documentation (architecture docs, engineering specs, ADRs, runbooks, API/config references, and the engine's own `knowledge/*.md` files) always uses Simplified Technical English (ASD-STE100) — see `skill/b2c-mobile-business-launch/knowledge/engineering/technical-documentation-ste100.md`, loaded via the engine's catalog reference graph. This file, root `README.md`, and other founder/marketing copy keep following `skill/b2c-mobile-business-launch/knowledge/words/no-slop-writing.md` instead.

## Commands

```bash
npm ci
node platform/run.mjs check
node platform/run.mjs test
node platform/run.mjs build
npm run audit:ci
npm run launchbench
npm run check:catalog
npm run catalog:render-routing -- --check
npm pack --dry-run --json
```

Subagents may mutate bounded, disjoint scopes. The orchestrator owns integration, git, shared state, provider changes, public actions, spend, destructive actions, and releases.

## Maintainer compatibility

Root guidance is for this combined repository. Do not copy it into a launched business or generated app repository. Generated businesses receive their own entrypoints from the engine workspace templates.

## Runtime sync and source freshness

Use runtime sync only on the maintainer machine after repository validation. Verify fast-moving provider sources before changing external commands or guidance.
