# Formation

Formation is an opinionated founder workspace for turning an idea into a decision-grade, launch-ready business.

It replaces the repository's original founder experience, which exposed an agent skill through generated Markdown and disconnected HTML pages, with one persistent product. Founders now work through a shared company source of truth, connected workstreams, explicit decisions, editable deliverables, prioritized tasks, and launch-readiness gates.

The graph-native launch runtime remains in the repository as an internal automation engine. It is no longer the product interface.

## What the platform does

Formation helps a founder:

- establish a durable company and founder context once
- separate facts, assumptions, recommendations, and unresolved questions
- work through strategy, customer, market, product, business model, brand, go-to-market, and launch as connected workstreams
- detect contradictory business claims before they spread into downstream work
- record decisions with rationale, ownership, and review dates
- generate structured deliverables from accumulated context
- edit, inspect, and restore immutable deliverable versions instead of replacing work with another AI response
- turn analysis into a small, prioritized work queue
- evaluate launch readiness using blockers and decision quality, not decorative metrics

## Run Formation

Requirements:

- Node.js 22 or later
- the repository dependencies installed from the root lockfile

```bash
npm ci
node platform/run.mjs dev
```

Open `http://127.0.0.1:4311`.

The repository includes a realistic Storywell founder workspace and a local preview account. Founders can also create credential-backed accounts and start a fresh company workspace. The API runs on `http://127.0.0.1:4310`; Vite proxies `/api` during development.

Production build:

```bash
node platform/run.mjs build
NODE_ENV=production ALLOW_DEMO_AUTH=false node platform/run.mjs start
```

Production sessions require HTTPS. When TLS terminates at a trusted reverse proxy, set `TRUST_PROXY=true` so Formation can validate forwarded host, protocol, and client-address headers. See [`platform/.env.example`](platform/.env.example) for configuration.

## Primary founder journey

1. **Create a company workspace.** Formation asks for the company, primary customer, problem, proposed solution, current objective, and operating constraints.
2. **Review Today.** The command center ranks the next useful moves and explains why each one matters now.
3. **Strengthen the business source of truth.** The Business view keeps the thesis, customer, offer, positioning, economics, and metric definitions coherent.
4. **Advance a workstream.** Each workstream has evidence, assumptions, open questions, tasks, deliverables, confidence, and one current next action.
5. **Make the call.** Decisions retain their rationale and review date and remain visible to downstream work.
6. **Create and edit deliverables.** Generated drafts are structured, versioned, editable, exportable, and connected to claims and decisions.
7. **Inspect launch readiness.** Formation shows what is ready, what is blocked, and which calls or critical tasks prevent a clean launch claim.

A detailed walkthrough is in [`docs/platform/founder-journey.md`](docs/platform/founder-journey.md).

## Architecture

```text
Founder browser
  -> React 19 + Vite application
  -> same-origin Node HTTP API
  -> workspace authorization and domain services
  -> atomic local persistence adapter
  -> durable generation queue
  -> optional structured AI provider
  -> graph-native launch engine adapter (next integration boundary)
```

The platform is intentionally separated from the historical skill runtime:

```text
platform/                              founder product
  web/                                 application shell and product pages
  server/                              API, auth, persistence, domain logic, generation
  data/                                ignored local state
  run.mjs                              dev, build, start, check, and test entrypoint

skill/b2c-mobile-business-launch/      internal launch automation engine
  core/                                durable execution, reducer, autonomy, sessions
  catalog/                             graph definitions and workflow contracts
  knowledge/                           reusable domain guidance
  workspace/                           engine artifact contracts and export sources
  validation/ + verification/          deterministic engine and business checks
```

The platform domain model is documented in [`docs/platform/product-architecture.md`](docs/platform/product-architecture.md). Technical boundaries are documented in [`docs/platform/technical-architecture.md`](docs/platform/technical-architecture.md).

## Commands

```bash
node platform/run.mjs dev         # API and Vite development servers
node platform/run.mjs check       # server syntax and strict TypeScript checks
node platform/run.mjs test        # domain, persistence, auth, and API tests
node platform/run.mjs build       # production web bundle
node platform/run.mjs start       # serve API and production bundle
node platform/run.mjs reset-data  # restore the realistic seed workspace
```

The platform CI workflow runs strict checks, the 25-test server and domain suite, and a production build on every relevant pull request.

## Generation contract

Without external configuration, Formation uses a deterministic structured generator so the full product can be evaluated locally.

Set `FORMATION_AI_ENDPOINT` to use an external provider. Formation sends:

- company and founder context
- the active workstream
- relevant facts, assumptions, recommendations, and questions
- linked decisions
- existing deliverable summaries
- founder direction
- an explicit structured response schema

The provider must return a title, summary, confidence score, and editable sections. Provider responses do not become accepted facts. They enter the workspace as founder-reviewable drafts.

## Security and tenancy

- credential passwords use salted, memory-hard scrypt hashes and are never returned by the API
- failed sign-ins use generic responses and are rate limited
- successful sign-in rotates to one random session token stored as a SHA-256 hash
- session cookies are HTTP-only and SameSite=Lax
- every workspace read and mutation checks membership server-side
- cross-origin mutations are rejected
- request bodies are bounded
- production responses include a restrictive content security policy and related headers
- data files are created with owner-only permissions
- credential registration can be explicitly disabled when an external identity provider owns provisioning
- demo authentication is disabled in production unless explicitly enabled

The included atomic file adapter supports local development, evaluation, and a single-process deployment with persistent storage. Transactional PostgreSQL persistence, complete account recovery and invitation flows, and the platform-to-engine execution adapter are the highest-impact remaining public-SaaS gaps. They are explicitly ranked in [`docs/platform/remaining-gaps.md`](docs/platform/remaining-gaps.md).

## Documentation

- [Original repository audit](docs/platform/audit-original-repository.md)
- [Product architecture and information architecture](docs/platform/product-architecture.md)
- [Technical architecture](docs/platform/technical-architecture.md)
- [Major decisions and tradeoffs](docs/platform/decisions-and-tradeoffs.md)
- [Migration and retained/replaced systems](docs/platform/migration.md)
- [Founder journey](docs/platform/founder-journey.md)
- [Design system](docs/platform/design-system.md)
- [Remaining gaps by product impact](docs/platform/remaining-gaps.md)
- [Combined repository architecture](docs/architecture.md)

## Working on the launch engine

The engine still has its own contracts, catalog, validators, and release discipline. Start with:

- [`skill/b2c-mobile-business-launch/README.md`](skill/b2c-mobile-business-launch/README.md)
- [`skill/b2c-mobile-business-launch/SKILL.md`](skill/b2c-mobile-business-launch/SKILL.md)
- [`skill/b2c-mobile-business-launch/catalog/generated/routing.md`](skill/b2c-mobile-business-launch/catalog/generated/routing.md)

Founder-facing product behavior belongs in `platform/`. Graph execution, launch automation, and reusable launch doctrine remain in `skill/b2c-mobile-business-launch/`.

The root package manifest remains the engine compatibility and release manifest for this transition. Formation has its own private manifest in `platform/package.json` and uses the root lockfile so both systems remain reproducible without a half-migrated dependency tree.
