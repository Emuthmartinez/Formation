# Primary founder journey

> **Direction note (2026-08-19).** This repository is engine-first: `skill/formation/` is the
> typed workflow-graph engine and the center of the repository; the platform described below is
> one consumer of it through the typed adapter boundary. This document's mechanics remain
> accurate for the platform itself; for the system's architecture start at `docs/architecture.md`.

## Journey objective

A founder should be able to move from an initial idea to a coherent, evidence-backed launch plan without learning graph terminology, navigating repository files, or repeatedly restating the company.

The experience is designed around one repeated loop:

```text
understand the current business
  -> identify the most important uncertainty or decision
  -> do the smallest useful work
  -> update the source of truth
  -> create or revise a reusable deliverable
  -> reassess launch readiness
```

## 1. Create an account

The founder creates an account with a name, work email, and password.

Formation:

- creates a credential-backed identity
- stores a salted memory-hard password hash
- starts a secure server-side session
- shows an empty company state rather than an empty analytics dashboard

A development-only Storywell preview is available when demo authentication is enabled.

## 2. Create a company workspace

The founder supplies the minimum context required to create useful work:

- company name
- founder name
- one-line outcome
- primary customer
- customer problem
- proposed solution
- current objective
- optional launch target
- weekly founder capacity
- operating constraints

Formation does not ask for every future business detail. Unknowns remain explicit.

The platform creates:

- a durable company record
- eight connected workstreams
- initial customer and product assumptions
- a proposed strategic decision
- prioritized validation tasks
- a first business-snapshot deliverable
- an initial immutable artifact version
- a workspace activity record

## 3. Open Today

Today is the default command center.

The page answers:

1. What should happen next?
2. Why is that the best use of founder attention now?
3. Which decision or launch blocker will it change?

Recommendations are ranked from actual business state, not generic startup advice.

The priority order is:

1. contradictory active claims
2. unresolved decisions
3. critical unfinished tasks
4. draft deliverables needed by downstream work

The founder can move directly from a recommendation to its workstream, decision, or deliverable.

## 4. Strengthen the company source of truth

The Business page contains the shared context used by every workflow and generated deliverable.

The founder reviews and edits:

- thesis
- primary customer
- problem
- product and offer
- positioning
- differentiation
- business model
- pricing
- north-star metric
- current objective
- constraints

Below the company context, the claim ledger separates:

- facts
- assumptions
- recommendations
- questions

The founder can add a claim, assign it to a workstream, set confidence, and optionally add a comparison key.

When two active claims use the same key and incompatible values, Formation surfaces a contradiction in Today and Business.

## 5. Advance one workstream

The founder opens the workstream most closely connected to the next business decision.

A workstream shows:

- current progress
- decision confidence
- status
- one next useful action
- rationale
- facts
- assumptions
- open questions
- tasks
- deliverables
- claim ledger

The founder may edit the workstream source of truth, complete or reprioritize tasks, reject stale assumptions, or create a deliverable.

The page avoids a generic project-management model. Work exists here only when it changes evidence, a decision, or a blocker.

## 6. Make the call

The founder records an important decision with:

- a clear title
- the actual decision
- rationale
- owning workstream
- owner
- status
- optional review date

A proposed decision can be accepted. A decided item can later be marked for review or superseded.

Formation keeps the old decision visible. Downstream work can link to it instead of copying the reasoning into multiple documents.

A decision marked `revisit` remains unresolved and reduces launch readiness.

## 7. Create a structured deliverable

From a workstream, the founder requests a deliverable and may add direction such as:

> Compare annual and lifetime pricing without assuming subscription is correct.

Formation creates a durable generation job.

The generator receives:

- current company context
- active workstream state
- relevant active claims
- linked decisions
- existing deliverable summaries
- founder direction
- a structured response schema

The founder can leave the page while the job runs. The result becomes an editable draft, not an accepted fact.

## 8. Edit, review, and version the deliverable

The Deliverables page is a document workspace rather than an AI transcript.

The founder can:

- edit the title and summary
- edit each section
- add or remove sections
- mark the document draft, reviewed, approved, or superseded
- export Markdown
- inspect source claims and decisions
- inspect immutable version history
- restore an older snapshot as a new draft version

Every save creates another immutable version with its actor, timestamp, sections, status, confidence, and context lineage.

## 9. Resolve contradictions

When Formation detects conflicting active claims, it does not silently choose one.

The founder opens the relevant workstream or Business claim ledger and can:

- attach new evidence
- lower confidence
- resolve a question
- reject an unsupported claim
- supersede an outdated statement
- record a decision selecting one path

Once incompatible active values no longer coexist, the contradiction disappears and Today is re-ranked.

## 10. Review launch readiness

The Launch page shows:

- weighted readiness score
- target date
- base progress
- blocked areas
- open decisions
- critical tasks
- readiness by business outcome
- critical path
- calls required before launch
- explicit blocker ledger

Formation does not call a launch ready simply because documents are complete. Blocked workstreams, critical tasks, and unresolved decisions lower the score.

The launch definition is intentionally demanding:

> The team can explain the customer, offer, evidence, economics, distribution, risks, and execution plan without contradicting itself.

## 11. Repeat the operating loop

After new research, a founder decision, a product test, or a skill-executed task:

1. update or import the evidence
2. adjust claims and confidence
3. revisit the affected decision
4. update the workstream
5. revise linked deliverables
6. complete or add tasks
7. reassess launch readiness

Formation is useful because the business accumulates context. It does not begin from zero each time the founder returns.

## Collaboration extension

The current implementation establishes the workspace boundary and durable records required for collaboration. The next collaboration journey should add:

- workspace invitations
- editor, reviewer, and viewer roles
- comments on claims and deliverable sections
- review requests
- approval assignments
- mentions and reminders
- optimistic concurrency

Those additions should extend the existing source of truth rather than introduce separate review documents or chat threads as competing state.
