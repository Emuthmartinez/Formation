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

The adapter's cost model is also now load-bearing in a way it was not before. Every request reads and deep-clones the whole file, and every write rewrites it. That was tolerable while every route required a session; the public share route means an unauthenticated caller can ask for that work. It is bounded today by a per-address request budget and by batching view counts, which is defence in depth rather than a fix — a store that reads one row instead of the whole file is the fix.

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
- workspace invitations — **shipped** (`platform/server/domain/members.mjs`: email-bound, single-use, hashed like a session token, and shown to the inviter exactly once)
- owner, editor, reviewer, and viewer roles — **shipped** (`platform/server/domain/capabilities.mjs`: an ordinal ladder with one minimum role per capability, denying by default for any role the ladder does not recognise)
- invitation expiry and revocation — **shipped** (14 days, revocable, and a cancelled, expired, spent, or never-existed link are one indistinguishable answer)
- session and device management — **shipped** (`platform/server/routes/account.mjs`: signing in on one device no longer signs you out of the others, each session is labelled with a coarse device description rather than the raw user-agent, and any device can be signed out from any other)
- membership removal and ownership transfer — **shipped** (a company always keeps at least one owner: the last owner must promote a successor before stepping down or leaving, and anyone may leave on their own)
- optional OIDC and SAML for larger teams
- audit events for access changes — **shipped** (invited, joined, role changed, removed, left — in the company's own activity history rather than a separate log a founder has to know to look for)

Every route should enforce role-level permissions in addition to membership — **shipped**. The capability is a required argument to the membership lookup, so a route that does not name what it is doing cannot resolve a member at all, and `platform/server/test/capabilities.test.mjs` fails on any route in source that is not declared with a capability before calling each declared surface as a member of every role.

Two surfaces that previously trusted their caller now check for themselves: the execution worker's approval sync (a read that mirrors engine state into durable records) and the workspace snapshot builder. The founder-facing half reads the same answer the server enforces with — `snapshot.capabilities` — rather than keeping a second copy of the rules in the web app.

An instance that has closed open registration still admits the people it invited: `POST /api/auth/register` accepts an invitation token, which opens the door for that one email address. Closing `ALLOW_REGISTRATION` is therefore a usable setting rather than one that silently breaks the invite flow.

Changing a password is part of the same surface: the current password is required even from a signed-in session, and every other device is signed out, because the reason to change a password is usually that one of them should not have it.

What remains here needs something Formation does not have: a mail transport. Email verification, password recovery, and SSO all depend on reaching a person outside the product. Until that exists, the honest position is the one the invitation flow already takes — say so, and hand the founder the link rather than pretending to send it. Building a password-reset flow whose email cannot be delivered would be worse than not having one, because it would look like a way back into a locked-out account and would not be.

## P0: Platform-to-engine execution adapter

### Why it matters

The graph-native launch engine is the repository's major differentiator. Formation currently has the product model and structured generation boundary, but it does not yet import independently verified results.

### Required outcome

Implement a typed adapter that:

- receives an authorized Formation execution request — **shipped** (`platform/server/execution.mjs`, `platform/server/routes/executions.mjs`)
- selects or accepts a stable catalog workflow — **shipped** (validated against the live boundary report from `core/adapters/platform-execution.ts`)
- fingerprints scoped company context — **shipped** (`computeContextFingerprint`)
- creates or resumes a durable engine run — **shipped** (the worker invokes `core/session/run.ts`; the engine's plan-matched run state is the durable identity)
- exposes founder-readable run state — **shipped** (API-level, and surfaced on the Launch page: "The launch engine at work" renders each execution's step procession, session state, and imported-result totals, with an explainer flow when no session has run)
- is idempotent across retries — **shipped** (one execution record per workspace, workflow, and context fingerprint; retries resume it)
- preserves engine approvals and protected actions — **shipped** (a parked founder gate mirrors into `decisions` with engine provenance; answers travel only through `core/session/approve.ts` via `platform/server/execution.mjs`, owner-role required, and the mirror cannot be edited into "decided". No mode or timeout auto-answers a gate)
- imports only verified results — **shipped** (the boundary report's `results[]` carries only settled, accepted attempts from the durable run; a node pending verification, a partially-accepted node, or a lane-seeded completion exports nothing, and `platform/server/domain/results.mjs` never reaches past the report into run internals)
- maps proposed claims, evidence, tasks, blockers, and artifact candidates into Formation — **shipped** (each verified result becomes a `recommendation` claim carrying the attempt's evidence — never a fact — plus a `draft` deliverable per artifact candidate with an immutable version; failed steps mirror as founder tasks that close when the engine recovers)
- marks affected downstream artifacts stale when accepted input context changes — **shipped** (`reconcilePatch` now runs the engine's own `invalidateDescendants` whenever a re-produced output replaces an accepted fingerprint, and Formation mirrors those conclusions off the report's per-artifact acceptance state — exactly the engine-identified descendants, cleared again when acceptance returns, never a second graph-walk)
- carries trace and cost metadata without leaking secrets — **shipped** (run, plan, and attempt ids plus declared token budgets and cost estimates, copied field-by-field onto claim provenance and the execution record's rollup; undeclared report fields never reach the store)

This P0 is complete at the API, record, and founder-page level. Nothing the adapter does writes engine-owned state: the reducer, the session runner, and the founder-decision CLI remain the engine's only writers, and an unreachable engine is always reported as unreachable, never as an empty plan, "no approvals waiting", or "nothing to import".

## P1: Existing launch repository importer

### Why it matters

The repository already has businesses represented by `PROJECT_STATE.yaml`, Markdown artifacts, decisions, evidence, and generated pages. Without an importer, the new product starts clean while existing work remains trapped in the old interaction model.

### Required outcome

Build a dry-run-first importer that:

- reads current engine state and artifact manifests — **shipped** (`core/adapters/platform-import.ts`: the launch workspace's `state/PROJECT_STATE.yaml`, `state/business.json`, `state/LAUNCH_TRACE.md`, every lane's evidence list, and the Markdown documents those lists name)
- maps business context to Formation company fields — **shipped** (only where Formation has nothing recorded; see below)
- classifies claims — **shipped** (a lane recorded finished becomes a `recommendation` to confirm, an open question becomes a `question`; nothing becomes a fact)
- extracts decisions and approvals — **shipped** (the go/pivot/kill and kill-or-scale verdicts with the dates they were made, the launch trace's rejected routes as superseded decisions, and its founder-only gates as decided or still proposed)
- creates tasks from real blockers and next actions — **shipped** (lane blockers, part-done and stuck lanes, the trace's blocker table, open failure cards, and the workspace's own `next_founder_action`)
- initializes immutable artifact versions — **shipped** (each document arrives as a `draft` deliverable, split on its own headings, with version 1 attributed to the launch work rather than to a founder)
- preserves engine IDs as provenance metadata — **shipped** (`source.kind: "legacy-import"` carries the import key, source id, workspace-relative path, lane key, and lane title)
- flags contradictions and ambiguous classification — **shipped** (evidence a finished lane names but does not have, a lane finished over an unfinished dependency, a lane status the engine does not define, template example values still in place, and a workspace whose own state says it has not been reconciled)
- can be rerun idempotently — **shipped** (every record keys on a content-derived import key, so a second import of an unchanged workspace creates nothing)
- never deletes or rewrites the source repository — **shipped** (the engine CLI opens no handle for writing, and the platform half has no path back into the workspace at all)

The load-bearing choices:

**Preview and apply are one computation.** `buildImportPlan` decides everything and `applyImportPlan` only executes what the plan said, so a founder is never shown a rehearsal that differs from the performance. The plan is rebuilt inside the write transaction, against the state the write will actually see.

**Founder work is never overwritten.** An empty company field is filled; a field the two records disagree on becomes a question quoting both, and the founder's own words stay. A deliverable the founder has edited is never rewritten by a later import — it is marked as having drifted from its source. An untouched draft is refreshed and appends a version.

**Requests name a source id, never a path.** An import reads files off the server's own disk, so a path in a request body would be an authenticated arbitrary-file-read. The founder chooses from the launch workspaces found under `FORMATION_IMPORT_ROOT` (defaulting to `FORMATION_ENGINE_ROOT`), and an id resolves only by matching one of them — traversal is impossible by construction rather than by pattern-matching for `..`. With no root configured, importing is off and says so.

**Contradictions outlive the preview.** A blocking contradiction becomes an open question in the record, so the doubt ends up in front of the founder rather than in a screen they saw once. The founder surface prints them above what would arrive, not below it.

The capability is `launch-import`, owner-only. The founder surface is "Work you have already done" on the Launch page.

## P1: Production AI evaluation and safety

### Why it matters

The provider contract is structured, but correctness and usefulness must be measured before external release.

### Required outcome

Add:

- provider-specific response schema enforcement
- regression fixtures for each deliverable type — **shipped for the built-in drafts** (`platform/server/test/deliverables.test.mjs`): every type is built from a complete company, from one with every optional field cleared, and from a workstream that has recorded nothing, and each result is held to the same bar — no empty section, no sentence with a hole in it, and nothing Formation would refuse if a founder submitted the same document as an edit. Fixtures for provider-produced drafts still need recorded provider answers to run against.
- contradiction checks — **shipped** (`platform/server/domain/consistency.mjs`): structural self-disagreement, decided by looking at fields rather than at language — an unsupported fact, confidence without evidence, a deliverable on retired evidence, a settled deliverable whose every source is an assumption, a decision reviewed before it was made, work due after the launch it precedes, a launch date that quietly went by. Surfaced on Today, and nothing is repaired.
- terminology consistency checks — **not shipped, deliberately.** Catching a company that says "families" in one document and "households" in another needs a record of the words that company has chosen. Formation has no lexicon, and a keyword matcher without one would flag synonyms as drift and miss the drift that matters. The honest next step is the record, not the matcher.
- source-use and citation-quality evaluation
- prompt-injection resistance for imported research and documents — **shipped** (see below)
- hallucination measurement
- founder-review thresholds by consequence
- cost, latency, and retry budgets — **partly shipped** (`platform/server/provider.mjs`): attempts, per-attempt timeout, and total wall clock are all bounded, and each draft records the attempts and elapsed time that produced it plus whatever usage the provider declared. A spend budget in money still needs a provider that reports one — Formation records declared usage and never invents a cost.
- redaction policy — **partly shipped**: the provider request is built by naming the fields that may leave (`platform/server/domain/prompts.mjs`), so nothing reaches a provider that was not named. Redaction of *values* — a customer's name inside a claim — is still to do.
- provider outage and fallback behavior — **shipped**: four distinguishable outcomes (unreachable, refused, unusable answer, misconfigured), retried only where retrying can help, each with a founder-plain sentence carrying no status code, no URL, and no stack. There is deliberately no fallback: when a drafting service is configured and cannot answer, Formation does not substitute its own built-in deterministic draft.
- versioned generation instructions — **shipped** (`GENERATION_INSTRUCTIONS_VERSION`, recorded on each draft's `generation` block)

Important recommendations should expose supporting evidence and uncertainty, not only confidence scores.

### Provider failure

`platform/server/provider.mjs` owns the call. The rules, and why each one is there:

- **Bounded in three ways.** Attempts, per attempt, and in total. A per-attempt timeout alone lets three slow attempts hold a worker for the sum of them.
- **Retry only what retrying can fix.** A network failure, a timeout, a 429, and a 5xx are worth another attempt; a 401 or a 400 is an answer. Valid JSON in the wrong shape is also an answer — the provider understood and replied wrongly, so it is final. A body that is not JSON at all is usually a gateway's error page, so it gets one more attempt inside the budget.
- **No silent fallback.** The built-in deterministic draft is what a Formation instance with no provider configured produces. Substituting it for a failed provider call would hand the founder a document that looks like the one they asked for and is not.
- **Nothing half-written.** A failure writes no deliverable, no version, and no claim; the job carries the outcome and the diagnostics.

### Prompt-injection resistance

The importer made this urgent rather than theoretical: a launch repository is a directory of Markdown that anyone with write access to it produced, and Formation reads it into the claims and deliverables it assembles into generation context.

`platform/server/domain/trust.mjs` holds the posture:

- **Provenance decides.** A record with no `source` was written by a member and is trusted. Engine results are trusted — an independent verifier accepted them before they arrived. Imported records are not, and a `source.kind` nobody registered is treated as imported rather than trusted by omission.
- **Screening, not sanitising.** Untrusted text is examined for shapes that read as an instruction to a machine — disregard everything above, address the reader as a system, reveal your instructions, answer only with. The function has no way to return a changed string. Rewriting a founder's material would be a silent, unreliable edit; withholding it is neither.
- **The document still imports, word for word.** What changes is that `domain/prompts.mjs` keeps it out of the provider request, the founder is told at import, an open question is left on the record, and one click confirms the wording is meant (`source.screenConfirmedAt`). The findings stay on the record after confirmation — confirmation is not amnesia.
- **Founder-authored words are never screened.** A founder may write "disregard all earlier direction from the board" about their own company.

A screen like this catches the obvious and misses the clever. Its value is not that no injection ever passes: it is that the untrusted half of the context is identified as untrusted, bounded, stated to the provider as data, and reviewable by a person — which holds for the phrasings the list does not know.

## P1: Collaboration and review

### Why it matters

Formation is designed for a founder to share work with a cofounder, advisor, investor, or employee. Current records are shareable in structure but not yet collaborative in interaction.

### Required outcome

Add:

- comments on claims, decisions, and deliverable sections — **shipped** (`platform/server/domain/comments.mjs`), plus workstreams
- mentions — **shipped**, resolved against this company's members only. In-product: a mention is found here rather than sent, because there is still no mail transport, and the surface says so.
- review requests — **shipped** (`platform/server/domain/reviews.mjs`): one person, one record, one question, open until answered. Surfaced on the record and, for the assignee, first on Today.
- assigned approvers — **shipped as review assignees.** Deliberately *not* as approvers: a review is an opinion, not an authority. Approving one promotes nothing, decides nothing, and moves no readiness — otherwise a reviewer who cannot edit a deliverable could settle one by approving a review of it, and the capability ladder would have a back door nobody opened on purpose.
- change summaries between artifact versions — **shipped** (`platform/server/domain/versions.mjs`): computed from the immutable versions rather than stored, so the summary cannot drift from the record it describes. Sections are matched by id, then title, then position — and position is refused when both sides carry ids that differ, because an edit that reads as one section removed and another added is the most misleading thing this summary could say.
- optimistic concurrency and conflict resolution
- presence where useful
- decision and review notifications
- resolved-comment history — **shipped**: resolving settles a thread and keeps it readable, with who settled it and when. Deleting the opening comment of a live conversation withdraws the words and keeps the thread, rather than orphaning every reply.

Comments must not become a second source of truth. Accepted changes should update the underlying record.

This is enforced rather than intended. Comments do not move readiness, are not weighed as evidence, are not sent to a provider, and never reach a shared link — `platform/server/test/comments.test.mjs` asserts the last two directly. Neither surface reads a comment today; the tests exist because both are built by naming fields, and the day somebody adds a convenient spread is the day a private argument between cofounders lands in a model's context or an investor's browser.

Still open here: optimistic concurrency, presence, and notifications. Notifications need the same mail transport the identity lifecycle is waiting on.

## P1: Rich exports and external sharing

### Why it matters

Markdown export is useful for developers, but founders need business-ready outputs.

### Required outcome

Prioritize:

1. PDF with stable pagination and branded cover
2. Google Docs export or synchronization
3. presentation output for advisors and investors
4. spreadsheet-backed financial assumptions
5. read-only secure sharing links — **shipped** (`platform/server/domain/sharing.mjs`)
6. export bundles with claims and decision lineage

Exports should preserve artifact version, status, confidence, and date.

A share link carries one deliverable or the company overview to someone who has no account and needs none. The link is the credential, so it behaves like one: 32 bytes of entropy, hashed at rest, shown to the founder exactly once, expiring after 30 days, revocable, and answered identically whether it was stopped, expired, or never existed. Sharing outside the company is the owner's call; every member can see what has been shared.

The load-bearing part is not the token but `sharedView`, which builds the projection by naming the fields that may leave rather than by taking a record and removing what should not go. A record that grows a field later stays private until somebody names it. `platform/server/test/sharing.test.mjs` plants a private task, decision, and invited address in the workspace and asserts none of them — nor any member, email address, activity entry, engine id, or unattached claim — appears in either projection.

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
