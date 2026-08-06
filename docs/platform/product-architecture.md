# Product architecture

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

A user's role in a workspace. The current implementation supports the owner role and enforces membership on every server operation. Editor, reviewer, and viewer roles can extend the same boundary.

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

### Generation job

A durable request to create a structured artifact from scoped company context. Jobs survive the page that initiated them and expose queued, processing, completed, or failed state.

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
| Launch | Show what is ready, blocked, and still undecided | A vanity percentage detached from evidence |
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
  -> engine-executed work and measured outcomes
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
