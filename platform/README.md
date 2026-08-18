# Formation platform

`platform/` is the founder-facing B2B product. It owns application navigation, workspace tenancy, persistent company context, decisions, tasks, deliverables, launch readiness, and the product-facing generation contract.

## Local development

From the repository root:

```bash
npm ci
node platform/run.mjs dev
```

- web: `http://127.0.0.1:4311`
- API: `http://127.0.0.1:4310`
- local data: `platform/data/formation.json`

Reset the seed workspace with `node platform/run.mjs reset-data`.

## Source map

```text
web/src/App.tsx                  session, workspace, routing, and page composition
web/src/components/             shared product shell and primitives
web/src/styles/                 layered foundation, workspace, document, and responsive CSS
web/src/pages/                  founder journeys by page job
web/src/types.ts                client domain contracts
web/src/api.ts                  typed API boundary
server/index.mjs                process entrypoint wiring the store, seed, and server together
server/app.mjs                  HTTP composition and worker lifecycle (generation, execution, import)
server/api.mjs                  authenticated API boundary and route dispatch
server/routes/                  workspace-authorized route handlers
server/domain/                  readiness, contradictions, onboarding, artifacts, members, capabilities, sharing, comments, reviews, economics, trust, presentation
server/http.mjs                 response security, errors, and static application serving
server/validation.mjs           request schemas and bounded input normalization
server/auth.mjs                 credential authentication, device sessions, cookies, and same-origin protection
server/generation.mjs           durable generation queue and job rate limiting
server/provider.mjs             the external provider call, its budget, retries, and outcome classification
server/execution.mjs            platform half of the engine execution adapter and its durable worker
server/imports.mjs              launch-repository import service (discover, preview, apply)
server/store.mjs                atomic persistence adapter and schema migration
server/seed/                    realistic sample company data
server/test/                    domain, storage, authorization, and API coverage
```

## Invariants

1. A workspace mutation always verifies membership on the server.
2. Facts, assumptions, recommendations, and questions remain distinguishable.
3. Generated work enters as an editable draft, never as accepted truth.
4. Artifact generation and edits append immutable version snapshots; restoration creates another version.
5. Readiness is calculated from business state and penalized by blockers.
6. The platform does not expose graph IDs, agent roles, filesystem paths, or provider commands to founders.
7. The launch engine may execute work for the platform, but it does not own product navigation or product state.

## External generation provider

Set `FORMATION_AI_ENDPOINT` and optionally `FORMATION_AI_API_KEY`. The endpoint receives a JSON body with the full scoped business context and required response schema. A non-conforming response fails the durable job instead of silently writing malformed content.

## Launch engine execution

Set `FORMATION_ENGINE_ROOT` to the directory that holds one engine workspace per company, named by workspace slug. With it set, `POST /api/workspaces/:id/executions` submits an authorized execution request: the adapter validates the requested catalog workflow against the engine's live answer (or selects the first ready one), fingerprints the scoped company context, and a durable worker creates or resumes the engine run through the engine's own session runner. Retrying the same request against the same context resumes the same execution — it never starts a second run. `GET` on the same routes reports founder-readable run state, and an unreachable engine is reported as unreachable, never as "no work ready". Without `FORMATION_ENGINE_ROOT`, execution requests are refused with a clear message; nothing else changes. Secret-shaped environment variables never cross into the engine process, and the platform never reads or writes engine workspace files itself.

## Deployment posture

The server serves the built web application and API from one origin. This keeps cookie, CSRF, and deployment behavior simple. Credential registration and login work without an external service; the Storywell demo login is a separate development-only path. Production must be exposed through HTTPS. Set `TRUST_PROXY=true` only when the immediate proxy is trusted and owns the forwarded headers.

The default store is intentionally dependency-free and atomic. It is appropriate for local evaluation and one server with persistent storage. Do not run multiple writers against the same data file. Before a multi-instance SaaS launch, implement the documented PostgreSQL store contract and add email verification, account recovery, and enterprise identity as required by the deployment.
