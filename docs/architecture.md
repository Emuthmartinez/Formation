# Repository architecture

This repository now contains two explicit systems:

1. **Formation**, the founder-facing B2B platform in `platform/`.
2. **The launch skill**, the graph-native automation and verification system in `skill/formation/`.

The platform is the product. The skill is a differentiated internal capability.

## Architectural principles

1. **Founder state and skill state are different bounded contexts.** The platform owns editable company context, membership, claims, decisions, tasks, deliverables, and product navigation. The skill owns executable graph state, attempts, evidence, verification, and autonomy controls.
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
  -> launch skill catalog and durable run
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
- Launch readiness, the launch matrix, skill executions, and existing-work import
- People membership, roles, and invitations
- Account password and device sessions
- comment threads and review requests beside records
- the read-only shared deliverable view and the join-by-invitation flow
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
- membership roles, capability enforcement, invitations, and ownership transfer
- comment threads and review requests
- share links and the token-authenticated public read
- unit-economics scenarios computed on read, never stored
- workspace export bundles in Markdown, JSON, and CSV
- generation job lifecycle, provider outcome classification, and trust screening of imported text
- skill execution requests, durable run resumption, and founder-readable run state
- skill approval mirroring into the decision log
- launch-repository import discovery, preview, and apply
- the board-ready presentation boundary for skill- and system-authored text
- the health probe
- static application serving

### Persistence

The included atomic adapter persists:

- users
- sessions
- memberships
- invitations
- workspaces
- claims
- decisions
- artifacts
- immutable artifact versions
- tasks
- jobs
- executions
- shares
- comments
- reviews
- activity

The adapter is replaceable through its read and transaction boundary. Multi-instance deployment requires a transactional database implementation.

### Generation

Generation receives scoped product context and returns a structured artifact schema. The deterministic local generator keeps development and evaluation fully runnable. A configured provider uses the same contract.

## The Formation skill

The skill remains under `skill/formation/`.

### Definition graph

`catalog/` contains stable definitions for business areas, domains, workflows, phases, lanes, artifacts, gates, operators, providers, and presentation groups.

Each knowledge document has one YAML manifest under `catalog/knowledge/`. The manifest owns its stable reference ID. It also owns lifecycle, graph bindings, applicability, sources, review data, and replacements. Catalog composition discovers the manifests. It includes only active packages in runtime routing.

The manifest model uses two established graph principles. Provenance records identify the source, claim scope, review time, and reviewer. Shape validation rejects invalid nodes and edges before graph composition. These principles follow [W3C PROV-O](https://www.w3.org/TR/prov-o/) and [SHACL](https://www.w3.org/TR/shacl/). The implementation uses the existing YAML and TypeScript stack. It does not add RDF infrastructure.

### Business instance graph

The skill resolves the subset applicable to one launch using scope, archetype, accepted decisions, current state, provider availability, and autonomy policy.

### Durable run graph

`core/engine/` compiles executable nodes with dependencies, accepted inputs, outputs, predicates, approvals, resource claims, retries, timeouts, context, and verification policy.

### Reducer and durable truth

`core/reducer/` remains the single writer for skill-owned mutable documents. Attempts, approvals, accepted artifact fingerprints, evidence, grants, waivers, and run state survive individual sessions.

### Autonomy and sessions

`core/autonomy/` and `core/session/` evaluate grants, waivers, budgets, prerequisites, kill switches, scheduled work, founder approvals, and session boundaries.

### Verification

`validation/` and `verification/` provide structural checks, live proof, fixtures, boundary tests, parity, rehearsals, and audit runners. Verified output is required before skill work may update trusted platform context.

## Integration contract

The platform and skill must integrate through a typed service boundary.

### Platform to skill

An execution request contains:

- workspace and user authority
- workstream and requested outcome
- scoped company context
- relevant claims and decisions
- accepted artifact versions
- constraints, budget, and approval policy
- idempotency key

### Skill to platform

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

The read-only execution boundary uses schema `1.1.0`. It also returns a compact launch-matrix projection. The projection contains display metadata for every business workflow. It keeps full node briefs only for ready work. Each workflow carries its bound knowledge (id, title, document path, load condition, freshness, and a read-time review verdict) and the role's conditional context-pack knowledge, deduplicated the same way node briefs split load/route. Process and orchestration workflows cross as named launch-integrity steps with live status and verification state, beside the summary counts. Machine workflows do not cross. On the platform, every knowledge field passes through `presentMatrixKnowledge` in `presentation.mjs` before a founder sees it — the agent-facing load condition survives only as technical detail.

Formation reads the projection through `GET /api/workspaces/:workspaceId/launch-matrix`. The route verifies workspace membership. An older or unavailable skill returns `available: false` with a reason. It does not return an empty matrix.

### Skill to platform, for an existing launch repository

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

- the browser cannot read or write skill files
- importing a launch repository never writes to it: the skill's import CLI opens no handle for writing, and the platform has no path back into the workspace
- the skill cannot bypass platform workspace authorization
- skill output enters as proposed or reviewed product state according to policy
- founder decisions remain authoritative for product-facing strategy
- accepted platform context is fingerprinted when sent to a skill run
- changed upstream context can mark downstream deliverables stale
- the launch matrix is a read model and does not store separate graph state
- a conditional workflow requires a durable `required` or `not-needed` verdict
- a changed applicability verdict invalidates prior output proof when the scope changes

## Repository layout

```text
.github/workflows/
  platform-ci.yml               founder platform checks, tests, and build
  source-freshness.yml          skill source-registry and knowledge freshness audit
  behavioral-evals.yml          manual live LaunchBench behavioral eval run

docs/
  architecture.md               combined architecture
  validators.md                 full validator and gate reference
  platform/                     audit, product, technical, migration, design, journey, gaps
  implementation/               skill implementation guidance
  method/                       skill operating methods
  brainstorms/                  exploratory scope documents
  plans/                        dated implementation plans
  prototypes/                   HTML design and engineering prototypes
  history/                      completed historical proposals and audits

platform/
  web/                          founder application
  server/                       API, auth, domain, persistence, generation
  data/                         ignored local data
  run.mjs                       platform command entrypoint
  README.md                     developer guide
  AGENTS.md                     platform contribution contract

skill/formation/
  SKILL.md                      internal runtime entrypoint
  core/                         execution core, reducer, autonomy, sessions, adapters
  catalog/                      typed definition graph and generated routing
  content/                      skill conversation content
  knowledge/                    domain guidance
  workspace/                    launch artifact and export contracts
  workspace-template/           generated launch repository templates
  starters/                     runnable app archetypes
  studio/                       maintainer Design Room
  validation/                   business and repository validators
  verification/                 skill proof suites
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
| workflow definitions | skill catalog |
| executable dependency graph | skill core |
| attempts and checkpoints | skill core |
| autonomy grants and waivers | skill control state |
| verification evidence | skill verification layer |
| static repository artifacts | skill export or compatibility layer |

## Development and verification

Platform:

```bash
node platform/run.mjs check
node platform/run.mjs test
node platform/run.mjs build
```

Skill:

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
- New execution topology belongs in the skill catalog and core.
- Do not add founder pages for individual skill files.
- Do not let product pages read static seed state in production.
- Do not duplicate company context inside prompts or renderer templates.
- New high-impact recommendations require a rationale and inspectable supporting context.
- New artifact mutations must preserve versioning.
- New workspace routes require membership tests.
- New automation capabilities require an adapter contract and founder-facing failure language.
- Retire old static renderers only after their named skill consumers migrate.
