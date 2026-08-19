# Technical architecture

> **Direction note (2026-08-19).** This repository is engine-first: `skill/formation/` is the
> typed workflow-graph engine and the center of the repository; the platform described below is
> one consumer of it through the typed adapter boundary. This document's mechanics remain
> accurate for the platform itself; for the system's architecture start at `docs/architecture.md`.

## Overview

Formation is a same-origin React application and Node API layered above the repository's graph-native launch skill.

```text
React application
  -> typed API client
  -> Node HTTP router
  -> authentication and same-origin guard
  -> workspace authorization
  -> domain services
  -> atomic store transaction
  -> durable generation, execution, and import workers
  -> optional external AI provider and the launch skill adapters
```

The platform and skill are separate bounded contexts. The platform owns founder product state. The skill owns durable automated execution.

## Frontend

### Stack

- React 19
- TypeScript with strict and `noUncheckedIndexedAccess`
- Vite 8
- custom route state using the browser History API
- one shared CSS design system with no external font or component dependency

### Composition

- `App.tsx`: session bootstrap, active workspace, route composition, refresh, and notifications
- `Shell.tsx`: product navigation, workspace switcher, responsive application frame
- `api.ts`: typed fetch boundary
- `types.ts`: platform read models
- `context.tsx`: scoped workspace state and mutations
- `pages/`: one module per founder job

The client never reads repository files or the skill workspace directly.

## API

`server/app.mjs` composes the HTTP server and owns the worker lifecycle. `server/api.mjs` dispatches each request to one route module per feature area under `server/routes/`.

### Public routes

- `GET /api/health` — fails only on the store, answers before authentication, and carries no internal detail
- `GET /api/config`
- `POST /api/auth/register` when registration is enabled
- `POST /api/auth/login`
- `POST /api/auth/logout` — a no-op without a session cookie
- `POST /api/auth/demo` when preview authentication is enabled
- `GET /api/shared/:token` — the one token-authenticated read, for a person who holds a share link and has no account; it has its own rate limiter

### Authenticated route modules

Every other route requires a session. `server/api.mjs` wires one module per feature area:

| Module | Surface |
| --- | --- |
| `routes/account.mjs` | password change, device-session listing and revocation |
| `routes/workspaces.mjs` | session read, workspace list/create/read/update, company, workstreams, claims, decisions, tasks, generation jobs |
| `routes/members.mjs` | member roles, removal, ownership transfer, invitations, invitation preview and accept |
| `routes/sharing.mjs` | share-link create, list, and revoke |
| `routes/artifacts.mjs` | deliverable edits, version history, and restore |
| `routes/comments.mjs` | comment threads on claims, decisions, deliverables, and workstreams |
| `routes/reviews.mjs` | review requests, answers, and withdrawal |
| `routes/economics.mjs` | economics scenarios and the primary-scenario choice |
| `routes/exports.mjs` | full-workspace export bundles in Markdown, JSON, and CSV |
| `routes/executions.mjs` | skill execution requests, run state, and the launch matrix |
| `routes/imports.mjs` | launch-repository import sources, preview, and apply |
| `routes/approvals.mjs` | skill approval listing and owner-only answers |
| `routes/evidence.mjs` | evidence reads for verified skill results |

Every workspace route resolves the caller's membership role against a named capability and refuses requests below that capability's minimum role (viewer, reviewer, editor, owner). The ladder lives in `server/domain/capabilities.mjs`, and `server/test/capabilities.test.mjs` fails on any route in source that is not declared with a capability. Workspace IDs supplied by the client never imply access.

## Persistence

`server/store.mjs` implements an atomic JSON adapter with the following properties:

- owner-only file permissions
- schema-version check
- required collection validation
- serialized in-process mutations
- temporary-file write
- file sync before rename
- atomic replacement
- cloned reads to prevent out-of-transaction mutation

It is intentionally dependency-free and supports local evaluation and one-process deployment on persistent storage.

### Production store contract

The store boundary has two operations:

```text
read() -> immutable database snapshot
transaction(mutator) -> serialized durable mutation
```

A PostgreSQL implementation should preserve domain behavior while mapping collections to normalized tables and using a transaction per mutation. Workspace authorization must remain in the service layer and should be reinforced with database row-level policies.

## Authentication and tenancy

Formation includes a self-contained credential path so production mode is usable without enabling the preview account:

- account registration can be enabled or disabled independently of demo access
- passwords are 12 to 128 characters and stored with unique 16-byte salts
- Node's asynchronous scrypt implementation uses `N=2^15`, `r=8`, and `p=3`
- password comparison uses constant-time buffer comparison
- unknown accounts still execute a dummy password derivation and return the same message as a wrong password
- repeated failures are rate limited by client address and normalized email
- successful login rotates to one random 256-bit session token per user
- only a SHA-256 token hash is stored
- user responses never include credential hashes
- cookies are HTTP-only, SameSite=Lax, and secure in production or HTTPS
- sessions expire after seven days of disuse and are revoked on logout
- one account keeps a bounded set of concurrent device sessions; when the bound is reached, the longest-unused session is evicted
- each session carries a coarse device label, never the raw user-agent
- the Account page lists active sessions, and any device can be signed out from any other

### Roles and capabilities

Membership carries one of four roles: viewer, reviewer, editor, or owner. Each server capability names the minimum role that may use it (`server/domain/capabilities.mjs`), and the client gates controls on `snapshot.capabilities` rather than a copy of the rules. A company always keeps at least one owner; the last owner must promote a successor before stepping down.

### Invitations

An owner invites a person by email with a role. The invitation token is single-use, hashed like a session token, shown to the inviter exactly once, and expires after 14 days. A cancelled, expired, spent, or never-existed link returns one indistinguishable answer. Accepting requires a signed-in account (`POST /api/invitations/accept`); access changes are recorded in the company's activity.

The Storywell demo route remains a separate development convenience and must stay disabled in production. Public SaaS deployments still need email verification, password recovery, and optionally OIDC or SAML — all waiting on a mail transport — but those can extend the isolated authentication boundary without changing product pages.

## Same-origin and request security

- non-read requests reject mismatched `Origin` and host
- JSON bodies are capped at 1 MB
- JSON payloads must be objects
- date, status, numeric, and list fields are validated
- user input cannot assign workspace ownership
- static paths are resolved under the build directory
- responses include CSP, `nosniff`, referrer policy, permissions policy, and frame restrictions
- errors return a request ID and avoid stack leakage in production

## Structured generation

Generation is a durable job, not a synchronous chat response.

1. The API validates workspace access, enforces a per-company hourly draft limit, and creates a queued job.
2. The worker claims one job and marks it processing.
3. It builds scoped context from the company, workstream, claims, decisions, and existing artifacts. Only `server/domain/prompts.mjs` builds provider requests, by naming the fields that may leave; records are never serialized wholesale.
4. Text that did not come from a member of the company is screened by `server/domain/trust.mjs`; anything that reads as an instruction is withheld from the request and reported, never edited or dropped from the founder's record.
5. It calls the configured provider through `server/provider.mjs`, which owns the call, its budget, and its retries, and reports four distinguishable failure outcomes instead of papering over them with the deterministic draft.
6. The response must match an explicit artifact schema.
7. The artifact is persisted as a draft.
8. The artifact is linked to the workstream.
9. A recommendation claim records that the output requires founder review.
10. The job completes with an artifact ID.

Malformed provider output fails the job and cannot corrupt workspace state.

## Artifact versioning

Every generated artifact starts with an immutable version snapshot. A deliverable update:

- sanitizes title, summary, status, and sections
- increments the materialized artifact version
- appends an immutable snapshot with actor, context lineage, sections, confidence, and timestamp
- updates the workspace activity record

The founder can inspect retained snapshots and restore an earlier version. Restoration writes a new draft version rather than deleting or mutating later history. A PostgreSQL implementation should map these records to an append-only `artifact_versions` table and enforce uniqueness on `(artifact_id, version)`.

## Skill integration boundary

The execution adapter is shipped. `server/execution.mjs` implements the platform half: `EngineBridge` talks to the skill's read-only CLI adapters, and `ExecutionWorker` durably creates or resumes skill runs. `routes/executions.mjs` exposes execution requests, run state, and the launch matrix; `server/domain/results.mjs` imports verified results.

```text
platform workstream or task
  -> execution request with workspace ID and scoped context
  -> catalog workflow selection
  -> durable skill run
  -> verified outputs and evidence
  -> platform claims, artifact versions, task updates, and activity
```

The adapter:

- preserves workspace authorization (`requireMembership` with a named capability)
- fingerprints the scoped company context and maps stable platform IDs to skill run IDs; retrying the same request against the same context resumes the same run
- keeps platform state authoritative for founder-facing content
- accepts only verified skill outputs
- translates skill states into founder vocabulary through the presentation boundary
- never gives the browser access to skill files
- reports an unreachable skill as unreachable, never as "no work ready"

Skill founder approvals mirror into the decision log keyed by approval and run (`server/domain/approvals.mjs`); only an owner may answer, and the answer round-trips through the skill's own `core/session/approve.ts`. The engine's per-node executor shipped in v0.142.0 (`core/session/executor.ts` spawns real worker CLIs); what remains engine-side is ranked in `docs/engine-backlog.md`.

## Import boundary

`server/imports.mjs`, `server/domain/imports.mjs`, and `routes/imports.mjs` bring an existing launch repository's recorded work into a company. The service discovers import sources through the skill's read-only import CLI (`core/adapters/platform-import.ts`), previews a founder-readable plan, and applies it idempotently through content-derived import keys. Nothing imported is a fact: records enter as drafts and questions, and imported text passes trust screening before it can reach a provider request. The importer opens no write handle on the launch repository.

## Presentation boundary

`server/domain/presentation.mjs` translates skill- and system-authored text into founder-facing board language before it reaches product pages, preserving the original wording for technical disclosure. Run steps, approval mirrors, blocker tasks, imported deliverables, and activity entries all route through it. Founder-authored words are never rewritten.

## Observability

Current implementation:

- request IDs
- durable job status and error text
- activity records
- process-level console startup details
- deterministic tests for core domain behavior

Production extension:

- structured request logs
- latency and error metrics by route
- job queue duration and provider failure metrics
- audit events for membership and artifact approval
- trace IDs propagated into skill runs
- redaction policy for founder content

## Testing

The platform test suite covers:

- workspace snapshot composition
- contradiction detection
- weighted readiness and penalties
- onboarding bundle creation
- structured artifact generation
- artifact version increments
- concurrent persistence transactions
- immutable reads
- unauthenticated rejection
- credential registration, password hashing, generic failures, session rotation, and throttling
- workspace membership isolation
- company and artifact edits
- contradiction resolution
- durable generation completion, recovery, context filtering, and lineage
- no-op and malformed mutation rejection
- cross-workspace artifact-lineage rejection
- strict calendar dates and bounded integer inputs
- malformed-cookie and cross-site mutation handling
- static application fallback, asset 404 behavior, cache policy, and security headers
- capability enforcement: every route is declared with a capability, then called as a member of every role
- membership, invitation, and ownership-transfer rules
- sharing links, comments, and review requests
- trust screening of imported and non-member text
- provider retry, budget, and outcome classification
- the execution adapter, approval mirroring, result import, and the health probe
- economics derivations and export bundles
- board-presentation translation

CI also runs strict TypeScript checking and a production Vite build. The suite is deterministic; `node platform/run.mjs test` reports the current count (25 files, roughly 250 tests).

## Deployment

The production process serves the API and built application from one origin:

```bash
node platform/run.mjs build
NODE_ENV=production ALLOW_DEMO_AUTH=false node platform/run.mjs start
```

Serve the production process over HTTPS. If TLS terminates at a reverse proxy, enable `TRUST_PROXY` only when that proxy overwrites forwarded headers.

For the included store, deploy one application process with a persistent volume and backup the data file. Do not horizontally scale the file adapter. Multi-instance deployment requires the PostgreSQL adapter and a shared job queue.
