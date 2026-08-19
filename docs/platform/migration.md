# Migration from skill interfaces to Formation

## Goal

Move founder interaction from generated repository files and static HTML into Formation without weakening the graph-native launch skill or breaking existing launches.

The migration is deliberately staged. Formation becomes authoritative for founder-facing company state immediately. Skill files remain authoritative for automated execution until the typed adapter is complete.

## Authority during the transition

| Concern | Authoritative system |
| --- | --- |
| Users, sessions, and workspace membership | Formation |
| Company context and founder profile | Formation |
| Facts, assumptions, recommendations, and questions | Formation |
| Decisions, rationale, and review dates | Formation |
| Founder tasks and product next actions | Formation |
| Editable deliverables and version history | Formation |
| Graph definitions and workflow readiness | Formation skill |
| Attempts, checkpoints, and resource claims | Formation skill |
| Autonomy grants, waivers, budgets, and kill switch | Formation skill |
| Independent verification and execution evidence | Formation skill |
| Static launch-repository artifacts | Skill export and compatibility layer |

Neither side may write directly into the other side's persistence.

## Systems retained

The migration retains the following skill capabilities:

- typed catalog identities and workflow contracts
- durable compilation, frontier calculation, and dispatch
- single-writer reduction
- accepted-input fingerprints and staleness propagation
- autonomy policy and protected founder decisions
- deterministic business validators
- independent verification
- provider probes and source registry
- mobile product starters
- useful artifact templates and export contracts

## Systems replaced for founders

Formation replaces these as primary founder interfaces:

- generated launch cockpit
- generated business control-plane workspace
- generated artifact HTML navigation
- repository-directory navigation
- static seed-state dashboards
- command-line business setup
- repeated prompt-based context collection
- Markdown files as the only editable business record

The old renderers remain internal compatibility and export tools until every named consumer has migrated.

## Migration phases

### Phase 1: Founder product foundation

Implemented in this change:

- authenticated user sessions
- workspace tenancy and server-side authorization
- durable company context
- eight connected founder workstreams
- typed claims and contradiction detection
- explicit decision log
- tasks and priorities
- editable deliverables with immutable versions
- durable structured-generation jobs
- launch-readiness calculation
- realistic sample workspace
- coherent application navigation and design system

### Phase 2: Existing launch importer

Build an importer that reads an existing launch repository and proposes a Formation workspace bundle.

Inputs should include:

- `PROJECT_STATE.yaml`
- business and founder context
- lane status and blockers
- decisions and approvals
- artifact manifest and current artifacts
- accepted evidence references
- active tasks or next actions
- launch target and business stage

The importer must:

1. Preserve stable skill IDs as provenance metadata, not product navigation.
2. Classify imported statements as facts, assumptions, recommendations, or questions.
3. Create explicit decisions instead of copying decision prose into generic notes.
4. Create one current artifact and an initial immutable version for each imported deliverable.
5. Flag conflicting imported values instead of silently choosing one.
6. Produce a dry-run report before writing platform state.
7. Be idempotent for the same source fingerprint.

### Phase 3: Platform-to-skill execution adapter

Add a typed adapter that accepts a Formation execution request and creates or resumes a skill run.

A request includes:

- workspace and requesting-user authority
- requested workstream outcome
- selected catalog workflow or routing intent
- scoped company context
- relevant active claims and decisions
- accepted artifact versions
- constraints and approval posture
- idempotency key

A result includes:

- skill run and attempt identifiers
- founder-readable status
- proposed claim changes
- verified evidence references
- artifact candidate and schema version
- affected blockers and tasks
- staleness implications
- verifier result
- permitted provider and cost metadata

Only verified results may update trusted product records. Unverified output remains an inspectable failed or proposed run.

### Phase 4: Collaboration and approvals

Add:

- invitations
- owner, editor, reviewer, and viewer roles
- inline comments
- review requests
- artifact approval assignments
- decision mentions and reminders
- optimistic concurrency for simultaneous edits

Skill approval interrupts should appear as product decisions or protected actions, while retaining the skill's stronger control state.

### Phase 5: Retire obsolete founder renderers

A renderer may be removed only after:

- every founder navigation link points to Formation
- its skill or migration consumers are enumerated
- equivalent export functionality exists when still required
- validator and fixture references are migrated
- no installed launch workspace depends on its path
- a deletion-based cutover test proves there is no competing founder source of truth

## Data migration strategy

### Stable identifiers

Formation owns platform IDs. Imported skill identifiers are stored as external references.

```text
platform artifact ID        art_...
skill artifact ID           external.engineArtifactId
platform workspace ID       wrk_...
skill business instance     external.engineBusinessId
platform generation job     job_...
skill run                   external.engineRunId
```

This avoids coupling product records to skill path or catalog migrations.

### Artifact history

Imported artifacts begin with an immutable version snapshot. Subsequent skill updates append a candidate version. Founder edits or approvals append product versions. History is never rewritten.

### Claims and evidence

Imported evidence becomes a claim reference only when its provenance is clear. A validator passing does not automatically prove every sentence in a document. Structural proof, live provider proof, founder decisions, and model recommendations remain distinguishable.

### Staleness

The adapter fingerprints the scoped platform context sent to a run. When accepted upstream context changes, linked downstream artifacts can be marked stale and queued for review. Staleness is a product state, not silent regeneration.

## Rollback

Formation and the skill have separate persistence, so rollout can be reversed without corrupting execution state.

- Disabling the platform-to-skill adapter leaves skill runs intact.
- Disabling skill result import leaves Formation records intact.
- Static skill exports remain available during migration.
- Imported product records retain source fingerprints and provenance.
- No migration step deletes the source launch repository.

## Completion criteria

The migration is complete when:

- founders can perform every primary journey without opening repository files
- existing launch repositories can be imported idempotently
- Formation can request, observe, and accept verified skill work
- all company context has one product-level owner
- every generated deliverable is editable and versioned
- protected skill actions appear in founder vocabulary
- obsolete founder renderers are removed or explicitly export-only
- no second navigation or next-action source competes with Formation
