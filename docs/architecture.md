# Repository architecture

This repository now contains two explicit systems:

1. **Formation**, the founder-facing B2B platform in `platform/`.
2. **The launch engine**, the graph-native automation and verification system in `skill/b2c-mobile-business-launch/`.

The platform is the product. The engine is a differentiated internal capability.

## Architectural principles

1. **Founder state and engine state are different bounded contexts.** The platform owns editable company context, membership, claims, decisions, tasks, deliverables, and product navigation. The engine owns executable graph state, attempts, evidence, verification, and autonomy controls.
2. **Founders never navigate the filesystem.** Repository paths and generated files are implementation details or exports.
3. **One durable company context.** Product generation and recommendations use accumulated workspace state rather than repeatedly asking for the same information.
4. **Claims remain typed.** Facts, assumptions, recommendations, and questions cannot silently collapse into generic prose.
5. **Decisions are first-class.** Important choices retain rationale, ownership, status, and review date.
6. **Generated work is a draft.** Model output becomes an editable artifact and never self-promotes to accepted truth.
7. **Execution remains graph-native.** Automated launch work compiles into a durable run and is independently verified.
8. **Boundaries fail closed.** Missing membership, malformed data, invalid provider output, stale evidence, or failed verification cannot silently become success.

## System context

```text
Founder and collaborators
  -> Formation web application
  -> Formation API and workspace authorization
  -> platform domain services and persistence
  -> execution adapter
  -> launch engine catalog and durable run
  -> verified evidence and outputs
  -> platform claims, decisions, tasks, and deliverable versions
```

## Formation platform

### Web application

`platform/web/` owns:

- session and active-workspace state
- Today command center
- Business source of truth
- Workstreams
- Decisions
- Deliverables and editing
- Launch readiness
- new-company onboarding
- responsive navigation and design system

It communicates only through the typed JSON API.

### API and domain services

`platform/server/` owns:

- credential registration, sign-in, session cookies, and development-only preview access
- same-origin protection
- workspace membership enforcement
- request validation
- workspace snapshot composition
- contradiction detection
- recommendation ranking
- launch-readiness calculation
- onboarding bundle creation
- artifact editing and versioning
- task, claim, and decision mutations
- generation job lifecycle
- engine execution requests, durable run resumption, and founder-readable run state
- static application serving

### Persistence

The included atomic adapter persists:

- users
- sessions
- memberships
- workspaces
- claims
- decisions
- artifacts
- immutable artifact versions
- tasks
- jobs
- activity

The adapter is replaceable through its read and transaction boundary. Multi-instance deployment requires a transactional database implementation.

### Generation

Generation receives scoped product context and returns a structured artifact schema. The deterministic local generator keeps development and evaluation fully runnable. A configured provider uses the same contract.

## Launch engine

The engine remains under `skill/b2c-mobile-business-launch/`.

### Definition graph

`catalog/` contains stable definitions for business areas, domains, workflows, phases, lanes, artifacts, gates, operators, providers, and presentation groups.

Each knowledge document has one YAML manifest under `catalog/knowledge/`. The manifest owns its stable reference ID. It also owns lifecycle, graph bindings, applicability, sources, review data, and replacements. Catalog composition discovers the manifests. It includes only active packages in runtime routing.

The manifest model uses two established graph principles. Provenance records identify the source, claim scope, review time, and reviewer. Shape validation rejects invalid nodes and edges before graph composition. These principles follow [W3C PROV-O](https://www.w3.org/TR/prov-o/) and [SHACL](https://www.w3.org/TR/shacl/). The implementation uses the existing YAML and TypeScript stack. It does not add RDF infrastructure.

### Business instance graph

The engine resolves the subset applicable to one launch using scope, archetype, accepted decisions, current state, provider availability, and autonomy policy.

### Durable run graph

`core/engine/` compiles executable nodes with dependencies, accepted inputs, outputs, predicates, approvals, resource claims, retries, timeouts, context, and verification policy.

### Reducer and durable truth

`core/reducer/` remains the single writer for engine-owned mutable documents. Attempts, approvals, accepted artifact fingerprints, evidence, grants, waivers, and run state survive individual sessions.

### Autonomy and sessions

`core/autonomy/` and `core/session/` evaluate grants, waivers, budgets, prerequisites, kill switches, scheduled work, founder approvals, and session boundaries.

### Verification

`validation/` and `verification/` provide structural checks, live proof, fixtures, boundary tests, parity, rehearsals, and audit runners. Verified output is required before engine work may update trusted platform context.

## Integration contract

The platform and engine must integrate through a typed service boundary.

### Platform to engine

An execution request contains:

- workspace and user authority
- workstream and requested outcome
- scoped company context
- relevant claims and decisions
- accepted artifact versions
- constraints, budget, and approval policy
- idempotency key

### Engine to platform

A verified result contains:

- execution and attempt IDs
- workflow ID
- status in founder vocabulary
- proposed claims and confidence
- evidence references
- artifact candidate and schema version
- affected tasks or blockers
- staleness implications
- verifier result
- cost and provider metadata where permitted

The read-only execution boundary uses schema `1.1.0`. It also returns a compact launch-matrix projection. The projection contains display metadata for every business workflow. It keeps full node briefs only for ready work. It reports process and orchestration counts separately. It does not include maintenance workflows.

Formation reads the projection through `GET /api/workspaces/:workspaceId/launch-matrix`. The route verifies workspace membership. An older or unavailable engine returns `available: false` with a reason. It does not return an empty matrix.

### Engine to platform, for an existing launch repository

A launch repository predating Formation is read across the same boundary, by a second read-only CLI (`core/adapters/platform-import.ts`). Its report contains:

- company context: name, founder, promise, primary customer, launch phase, platforms, go-live date
- proposed claims, each classified as a recommendation to confirm or an open question
- decisions, including the recorded founder verdicts with the dates they were made
- outstanding work, with whether the workspace records it as stuck
- documents, split on their own headings, with a content fingerprint
- contradictions, each naming the record it undermines
- a stable, content-derived import key per record, so the platform can re-import idempotently

Nothing in that report is a fact. A launch repository is an agent's working record, and it enters the platform as drafts and questions for the founder.

### Authority rules

- the browser cannot read or write engine files
- importing a launch repository never writes to it: the engine's import CLI opens no handle for writing, and the platform has no path back into the workspace
- the engine cannot bypass platform workspace authorization
- engine output enters as proposed or reviewed product state according to policy
- founder decisions remain authoritative for product-facing strategy
- accepted platform context is fingerprinted when sent to an engine run
- changed upstream context can mark downstream deliverables stale
- the launch matrix is a read model and does not store separate graph state
- a conditional workflow requires a durable `required` or `not-needed` verdict
- a changed applicability verdict invalidates prior output proof when the scope changes

## Repository layout

```text
.github/workflows/
  platform-ci.yml               founder platform checks, tests, and build

docs/
  architecture.md               combined architecture
  platform/                     audit, product, technical, migration, design, journey, gaps
  implementation/               engine implementation guidance
  method/                       engine operating methods
  history/                      completed historical proposals and audits

platform/
  web/                          founder application
  server/                       API, auth, domain, persistence, generation
  data/                         ignored local data
  run.mjs                       platform command entrypoint
  README.md                     developer guide
  AGENTS.md                     platform contribution contract

skill/b2c-mobile-business-launch/
  SKILL.md                      internal runtime entrypoint
  core/                         engine, reducer, autonomy, sessions, adapters
  catalog/                      typed definition graph and generated routing
  content/                      engine conversation content
  knowledge/                    domain guidance
  workspace/                    launch artifact and export contracts
  workspace-template/           generated launch repository templates
  starters/                     runnable app archetypes
  studio/                       maintainer Design Room
  validation/                   business and repository validators
  verification/                 engine proof suites
  tooling/                      renderers, probes, migrations, and audit tools
  agents/                       runtime manifests
```

## Source-of-truth ownership

| Concern | Authoritative owner |
| --- | --- |
| user identity and membership | platform |
| company context | platform |
| claim classification and contradiction state | platform |
| founder decision log | platform |
| tasks and product next actions | platform |
| editable deliverables and product versions | platform |
| product navigation and page state | platform |
| workflow definitions | engine catalog |
| executable dependency graph | engine core |
| attempts and checkpoints | engine core |
| autonomy grants and waivers | engine control state |
| verification evidence | engine verification layer |
| static repository artifacts | engine export or compatibility layer |

## Development and verification

Platform:

```bash
node platform/run.mjs check
node platform/run.mjs test
node platform/run.mjs build
```

Engine:

```bash
npm run check:catalog
npm run test:fixtures
npm run test:boundaries
npm run test:parity
npm run audit:ci
```

A change that crosses both systems must run both verification paths.

## Evolution rules

- New founder behavior belongs in `platform/`.
- New execution topology belongs in the engine catalog and core.
- Do not add founder pages for individual engine files.
- Do not let product pages read static seed state in production.
- Do not duplicate company context inside prompts or renderer templates.
- New high-impact recommendations require a rationale and inspectable supporting context.
- New artifact mutations must preserve versioning.
- New workspace routes require membership tests.
- New automation capabilities require an adapter contract and founder-facing failure language.
- Retire old static renderers only after their named engine consumers migrate.
