# Remaining gaps ranked by product impact

This list ranks unfinished work by how much it changes founder value, trust, or production viability. It does not rank by implementation convenience.

## P0: Transactional multi-instance persistence and durable queue

### Why it matters

The included atomic JSON adapter is appropriate for local evaluation and a single process with persistent storage. It is not sufficient for a horizontally scaled SaaS product.

Without a transactional shared store and queue, Formation cannot safely support:

- multiple application instances
- concurrent collaborators across instances
- independent generation workers
- database backups and point-in-time recovery
- operational failover
- database-enforced tenant isolation

### Required outcome

Implement PostgreSQL persistence behind the existing store and domain boundaries.

Minimum requirements:

- schema migrations
- users, sessions, workspaces, memberships, claims, decisions, tasks, artifacts, artifact versions, jobs, and activity tables
- foreign keys and tenant-scoped indexes
- unique artifact version constraints
- transactional workspace mutations
- row-level security or equivalent database tenancy enforcement
- durable job claiming with leases and retry policy
- backups and restore rehearsal
- migration from the local schema 2 file format

## P0: Complete identity and collaboration lifecycle

### Why it matters

Credential registration and login are implemented, but a B2B platform cannot rely on an owner-only account lifecycle.

### Required outcome

Add:

- email verification
- password recovery
- workspace invitations
- owner, editor, reviewer, and viewer roles
- invitation expiry and revocation
- session and device management
- membership removal and ownership transfer
- optional OIDC and SAML for larger teams
- audit events for access changes

Every route should enforce role-level permissions in addition to membership.

## P0: Platform-to-engine execution adapter

### Why it matters

The graph-native launch engine is the repository's major differentiator. Formation currently has the product model and structured generation boundary, but it does not yet import independently verified results.

### Required outcome

Implement a typed adapter that:

- receives an authorized Formation execution request — **shipped** (`platform/server/execution.mjs`, `platform/server/routes/executions.mjs`)
- selects or accepts a stable catalog workflow — **shipped** (validated against the live boundary report from `core/adapters/platform-execution.ts`)
- fingerprints scoped company context — **shipped** (`computeContextFingerprint`)
- creates or resumes a durable engine run — **shipped** (the worker invokes `core/session/run.ts`; the engine's plan-matched run state is the durable identity)
- exposes founder-readable run state — **shipped** (API-level; a founder page over these routes is still open)
- is idempotent across retries — **shipped** (one execution record per workspace, workflow, and context fingerprint; retries resume it)
- preserves engine approvals and protected actions — **shipped** (a parked founder gate mirrors into `decisions` with engine provenance; answers travel only through `core/session/approve.ts` via `platform/server/execution.mjs`, owner-role required, and the mirror cannot be edited into "decided". No mode or timeout auto-answers a gate)
- imports only verified results
- maps proposed claims, evidence, tasks, blockers, and artifact candidates into Formation
- marks affected downstream artifacts stale when accepted input context changes
- carries trace and cost metadata without leaking secrets

The unshipped behaviours are the import half of the boundary. Nothing the shipped half does writes engine-owned state: the reducer, the session runner, and the founder-decision CLI remain the engine's only writers, and an unreachable engine is always reported as unreachable, never as an empty plan or "no approvals waiting".

## P1: Existing launch repository importer

### Why it matters

The repository already has businesses represented by `PROJECT_STATE.yaml`, Markdown artifacts, decisions, evidence, and generated pages. Without an importer, the new product starts clean while existing work remains trapped in the old interaction model.

### Required outcome

Build a dry-run-first importer that:

- reads current engine state and artifact manifests
- maps business context to Formation company fields
- classifies claims
- extracts decisions and approvals
- creates tasks from real blockers and next actions
- initializes immutable artifact versions
- preserves engine IDs as provenance metadata
- flags contradictions and ambiguous classification
- can be rerun idempotently
- never deletes or rewrites the source repository

## P1: Production AI evaluation and safety

### Why it matters

The provider contract is structured, but correctness and usefulness must be measured before external release.

### Required outcome

Add:

- provider-specific response schema enforcement
- regression fixtures for each deliverable type
- contradiction and terminology consistency checks
- source-use and citation-quality evaluation
- prompt-injection resistance for imported research and documents
- hallucination measurement
- founder-review thresholds by consequence
- cost, latency, and retry budgets
- redaction policy
- provider outage and fallback behavior
- versioned generation instructions

Important recommendations should expose supporting evidence and uncertainty, not only confidence scores.

## P1: Collaboration and review

### Why it matters

Formation is designed for a founder to share work with a cofounder, advisor, investor, or employee. Current records are shareable in structure but not yet collaborative in interaction.

### Required outcome

Add:

- comments on claims, decisions, and deliverable sections
- mentions
- review requests
- assigned approvers
- change summaries between artifact versions
- optimistic concurrency and conflict resolution
- presence where useful
- decision and review notifications
- resolved-comment history

Comments must not become a second source of truth. Accepted changes should update the underlying record.

## P1: Rich exports and external sharing

### Why it matters

Markdown export is useful for developers, but founders need business-ready outputs.

### Required outcome

Prioritize:

1. PDF with stable pagination and branded cover
2. Google Docs export or synchronization
3. presentation output for advisors and investors
4. spreadsheet-backed financial assumptions
5. read-only secure sharing links
6. export bundles with claims and decision lineage

Exports should preserve artifact version, status, confidence, and date.

## P1: Financial assumptions and model

### Why it matters

Business model and pricing are represented as workstream context, but launch readiness should eventually evaluate economic assumptions more rigorously.

### Required outcome

Add structured records for:

- price and packaging scenarios
- conversion assumptions
- retention or repeat-use assumptions
- variable costs
- gross margin
- acquisition cost
- founder and operating capacity
- cash runway
- scenario sensitivity

Generated financial deliverables should reference structured assumptions rather than copy numbers into prose.

## P2: Research ingestion and evidence library

### Why it matters

Claims support evidence strings, but a mature product needs source objects with provenance.

### Required outcome

Add:

- source records
- interviews and transcripts
- files and web references
- evidence excerpts
- source date and freshness
- source trust classification
- claim-to-source relationships
- duplicate detection
- research synthesis jobs
- consent and retention controls for customer interviews

## P2: Production observability and administration

### Why it matters

Request IDs, durable jobs, activity records, and safe errors are present. Operating a paid service needs deeper visibility.

### Required outcome

Add:

- structured logs with redaction
- route latency and error metrics
- job queue duration and retry metrics
- provider cost and failure metrics
- trace IDs propagated into engine runs
- workspace audit log export
- support impersonation with explicit controls and audit
- feature flags
- health and dependency probes
- retention and deletion operations

## P2: Notifications and operating cadence

### Why it matters

Formation has review dates, launch targets, tasks, and changing readiness, but no reminder system.

### Required outcome

Add:

- daily or weekly founder brief
- review-date reminders
- blocker escalation
- artifact review notifications
- decision-change notifications
- configurable email and in-product preferences
- quiet hours and digest batching

Notifications should point to a decision or action, not merely announce activity.

## P2: Product analytics and outcome calibration

### Why it matters

The readiness model is intentionally opinionated. Its weights and recommendations should be calibrated against real founder outcomes.

### Required outcome

Measure:

- time from workspace creation to first decision
- assumptions resolved per active workspace
- recommendation-to-action conversion
- deliverable review and reuse
- time spent blocked
- launch-readiness movement
- repeated weekly use
- imported engine work accepted or rejected
- launch outcomes and post-launch corrections

Do not optimize for generated documents or raw session count.

## P3: Retire legacy founder renderers

### Why it matters

Legacy cockpit, artifact-page, and control-plane renderers are no longer the product, but they still increase repository surface area and can confuse future contributors.

### Required outcome

For each renderer:

- inventory active engine, test, and migration consumers
- replace founder links with Formation routes
- retain export behavior where needed
- migrate validators and fixtures
- remove competing next-action or status sources
- delete renderer and obsolete documentation only after cutover proof

## P3: Advanced portfolio and advisor workflows

### Why it matters

The domain model supports multiple workspaces, but portfolio views are not part of the core founder journey.

### Required outcome

After the single-company product is proven, consider:

- founder portfolio overview
- advisor review queue
- cross-company templates and benchmarks
- reusable decision patterns
- organization-level identity and billing
- aggregate risk and launch portfolio views

Do not build this before collaboration, persistence, and engine integration are production-ready.

## Suggested delivery sequence

1. PostgreSQL store and durable shared queue
2. identity lifecycle and workspace roles
3. platform-to-engine adapter
4. existing launch importer
5. AI evaluation and safety suite
6. collaboration and review
7. rich export and secure sharing
8. structured financial model
9. research evidence library
10. observability, notifications, and analytics calibration
11. legacy renderer deletion
12. portfolio workflows
