# Product architecture

> **Direction note (2026-08-19).** This repository is engine-first: `skill/formation/` is the
> typed workflow-graph engine and the center of the repository; the platform described below is
> one consumer of it through the typed adapter boundary. This document's mechanics remain
> accurate for the platform itself; for the system's architecture start at `docs/architecture.md`.

## Product promise

Formation helps a founder move from an idea to the next defensible business decision, then carries those decisions forward into launch-ready work.

The product is not a report generator. It is the durable operating context for forming a company.

## North-star behavior

A founder returns to Formation because it reliably answers three questions:

1. What is true about the business now?
2. What is the most important unresolved decision?
3. What concrete work should happen next?

The product should optimize for decisions improved and blockers removed, not documents generated or messages sent.

## Domain model

### User

A person with an authenticated identity.

### Workspace

A tenant boundary representing one company. It owns company context, membership, workstreams, claims, decisions, tasks, artifacts, jobs, and activity.

### Membership

A user's role in a workspace: viewer, reviewer, editor, or owner. The roles form a ladder — each role holds every capability of the roles below it. Every server operation checks the caller's role against a named capability (`platform/server/domain/capabilities.mjs`), not bare membership. A company always keeps at least one owner; the last owner must promote a successor before stepping down or leaving.

### Invitation

A pending offer of a role in a workspace, scoped to one email address. It carries a single-use accept token and a 14-day expiry, and only an owner creates or revokes it. A cancelled, expired, spent, or never-existed invitation link returns one indistinguishable answer.

### Founder profile

The founder's name, role, weekly capacity, and automation posture. This context keeps plans realistic and provides ownership defaults.

### Company context

The durable source of truth for:

- one-line description
- business thesis
- primary customer
- problem
- product and offer
- positioning
- differentiation
- business model
- pricing hypothesis
- north-star metric
- current objective
- operating constraints

The company context is reused automatically across the platform.

### Workstream

A connected body of business work with a clear job:

1. Business thesis
2. Customer and problem
3. Market and competition
4. Product and offer
5. Business model and pricing
6. Brand and positioning
7. Go-to-market
8. Launch plan

Each workstream owns:

- summary and rationale
- status
- progress
- decision confidence
- one next action
- facts
- assumptions
- open questions
- tasks
- deliverables

The workstreams are intentionally stable. A founder should learn the system once rather than navigate an endlessly generated taxonomy.

### Claim

One business statement classified as:

- fact
- assumption
- recommendation
- question

Claims can carry a stable comparison key, confidence, evidence, and lifecycle status. Stable keys let Formation surface contradictions such as two active pricing models.

### Decision

A durable business call containing:

- title
- decision statement
- rationale
- status
- workstream
- owner
- date decided
- review date

A decision is a first-class object rather than a paragraph hidden inside a document.

Some decisions are mirrored from the launch skill's own approval requests rather than authored by a founder. These carry the originating workflow, run, and plan, and only an owner may answer them; the answer travels back through the skill's own session runner.

### Comment

Conversation about a record — a claim, decision, deliverable, or workstream. Comments are attributed and threaded, and they are deliberately inert: they never affect readiness, contradictions, generation context, or shared views.

### Review

A targeted ask: will you look at this claim, decision, deliverable, or workstream. Only the named assignee can answer (approved or changes requested), and only the requester can withdraw it. A review is an opinion; acting on it is a separate act by whoever holds the capability to act.

### Share

A revocable, tokenized read-only link into one deliverable, created only by an owner. It is viewable without an account, built by naming the fields that may leave, and excluded from search indexing.

### Task

A concrete next action connected to a workstream, owner, priority, due date, and status. Tasks are intentionally subordinate to workstreams and decisions so the product does not become a generic project manager.

### Artifact

An editable business deliverable containing:

- type
- title
- summary
- structured sections
- status
- version
- confidence
- source claim links
- linked decision IDs

Generated artifacts begin as drafts and are never promoted to accepted facts automatically.

### Economics

Derived unit-economics figures — gross margin, LTV, payback, runway, customers to break even — computed on read from the company's pricing and cost scenarios, never stored. A missing input makes the figure absent and names the input, never zero. Shown on Business and Launch.

### Generation job

A durable request to create a structured artifact from scoped company context. Jobs survive the page that initiated them and expose queued, processing, completed, or failed state.

### Execution

A durable record of asking the launch skill to run one workflow. It carries the scoped context fingerprint, founder-readable skill state (queued, running, completed, failed), and the verified results imported when the run completes. Retrying the same request against the same context resumes the same run.

### Import

A founder-reviewed transfer of an existing launch workspace's recorded work into the company. An owner previews the plan, then applies it; everything enters as drafts and questions, never as facts, and re-importing the same source is idempotent.

### Activity

A plain-language history of important workspace changes.

## Information architecture

| Page | Primary job | What it deliberately avoids |
| --- | --- | --- |
| Today | Rank the next useful moves and explain why they matter now | Decorative analytics and a wall of cards |
| Business | Maintain the coherent company source of truth and inspect claims | Repeating onboarding questions in every workflow |
| Workstreams | Advance one connected area of business formation | Generic department dashboards |
| Decisions | Make calls explicit, reviewable, and durable | Hiding choices inside generated prose |
| Deliverables | Edit, version, review, and export reusable work | Treating AI responses as immutable answers |
| Launch | Show what is ready, blocked, and still undecided; show the skill's launch matrix, run launch workflows, and import existing launch work | A vanity percentage detached from evidence |
| People | See and change who is in the company, and invite someone in | A generic admin panel |
| Account | Manage password and active device sessions | Company-scoped settings bleeding into personal security |
| Shared | Show one deliverable to someone without an account | Any navigation into the rest of the workspace |
| Sign in / Join | Enter the product, or accept an invitation into a company | Marketing content or a second registration path |
| New workspace | Establish the minimum useful company context | A long setup wizard or premature provider configuration |

## Today ranking model

Today prioritizes:

1. contradictions in active business claims
2. open or proposed decisions
3. critical unfinished tasks
4. draft deliverables already referenced by work

Each recommendation includes a rationale and confidence score. The recommendation sends the founder directly to the workstream, decision, or deliverable where action can occur.

## Launch readiness model

Launch readiness is a weighted view across five outcomes:

- business foundation
- product and economics
- brand and positioning
- go-to-market
- launch execution

The base score is derived from workstream progress. Formation then subtracts explicit penalties for:

- blocked workstreams
- critical unfinished tasks
- open or proposed decisions

This prevents a polished but strategically unresolved business from appearing ready.

## Progressive formation

The product follows a progressive source-of-truth model:

```text
founder brief
  -> initial company context and assumptions
  -> evidence and claims
  -> explicit decisions
  -> workstream confidence
  -> structured deliverables
  -> launch readiness
  -> skill-executed work and measured outcomes
```

New information should refine prior work. It should not silently replace the company with a new interpretation.

## Product language

Founder-facing vocabulary:

- company
- workstream
- fact
- assumption
- question
- recommendation
- decision
- deliverable
- task
- blocker
- readiness

Internal-only vocabulary unless configuring automation:

- graph node
- lane
- gate ID
- validator
- agent role
- context pack
- reducer patch
- provider probe
- artifact filesystem path
