# Technical architecture

## Overview

Formation is a same-origin React application and Node API layered above the repository's graph-native launch engine.

```text
React application
  -> typed API client
  -> Node HTTP router
  -> authentication and same-origin guard
  -> workspace authorization
  -> domain services
  -> atomic store transaction
  -> durable generation worker
  -> optional external AI provider
```

The platform and engine are separate bounded contexts. The platform owns founder product state. The engine owns durable automated execution.

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

The client never reads repository files or the engine workspace directly.

## API

`server/app.mjs` exposes a small JSON API.

### Public routes

- `GET /api/health`
- `GET /api/config`
- `POST /api/auth/register` when registration is enabled
- `POST /api/auth/login`
- `POST /api/auth/demo` when preview authentication is enabled

### Authenticated routes

- `GET /api/session`
- `POST /api/auth/logout`
- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/workspaces/:workspaceId`
- `PATCH /api/workspaces/:workspaceId`
- `PATCH /api/workspaces/:workspaceId/company`
- `PATCH /api/workspaces/:workspaceId/workstreams/:workstreamId`
- `POST /api/workspaces/:workspaceId/claims`
- `PATCH /api/workspaces/:workspaceId/claims/:claimId`
- `POST /api/workspaces/:workspaceId/decisions`
- `PATCH /api/workspaces/:workspaceId/decisions/:decisionId`
- `POST /api/workspaces/:workspaceId/tasks`
- `PATCH /api/workspaces/:workspaceId/tasks/:taskId`
- `PATCH /api/workspaces/:workspaceId/artifacts/:artifactId`
- `POST /api/workspaces/:workspaceId/generate`
- `GET /api/workspaces/:workspaceId/jobs/:jobId`

Every workspace route verifies the current user has membership in the requested workspace. Workspace IDs supplied by the client never imply access.

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
- sessions expire after seven days and are revoked on logout

The Storywell demo route remains a separate development convenience and must stay disabled in production. Public SaaS deployments still need email verification, recovery, invitations, and optionally OIDC or SAML, but those can replace or extend the isolated authentication boundary without changing product pages.

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

1. The API validates workspace access and creates a queued job.
2. The worker claims one job and marks it processing.
3. It builds scoped context from the company, workstream, claims, decisions, and existing artifacts.
4. It calls the configured provider or deterministic local generator.
5. The response must match an explicit artifact schema.
6. The artifact is persisted as a draft.
7. The artifact is linked to the workstream.
8. A recommendation claim records that the output requires founder review.
9. The job completes with an artifact ID.

Malformed provider output fails the job and cannot corrupt workspace state.

## Artifact versioning

Every generated artifact starts with an immutable version snapshot. A deliverable update:

- sanitizes title, summary, status, and sections
- increments the materialized artifact version
- appends an immutable snapshot with actor, context lineage, sections, confidence, and timestamp
- updates the workspace activity record

The founder can inspect retained snapshots and restore an earlier version. Restoration writes a new draft version rather than deleting or mutating later history. A PostgreSQL implementation should map these records to an append-only `artifact_versions` table and enforce uniqueness on `(artifact_id, version)`.

## Engine integration boundary

The next adapter should translate platform intent into engine work without exposing engine state directly.

```text
platform workstream or task
  -> execution request with workspace ID and scoped context
  -> catalog workflow selection
  -> durable engine run
  -> verified outputs and evidence
  -> platform claims, artifact versions, task updates, and activity
```

The adapter must:

- preserve workspace authorization
- map stable platform IDs to engine run IDs
- keep platform state authoritative for founder-facing content
- accept only verified engine outputs
- translate engine states into founder vocabulary
- avoid direct browser access to engine files

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
- trace IDs propagated into engine runs
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

CI also runs strict TypeScript checking and a production Vite build. The current suite contains 25 deterministic tests.

## Deployment

The production process serves the API and built application from one origin:

```bash
node platform/run.mjs build
NODE_ENV=production ALLOW_DEMO_AUTH=false node platform/run.mjs start
```

Serve the production process over HTTPS. If TLS terminates at a reverse proxy, enable `TRUST_PROXY` only when that proxy overwrites forwarded headers.

For the included store, deploy one application process with a persistent volume and backup the data file. Do not horizontally scale the file adapter. Multi-instance deployment requires the PostgreSQL adapter and a shared job queue.
