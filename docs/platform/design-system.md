# Formation design system

## Design position

Formation should feel like a calm, well-edited operating document that happens to be interactive.

The product is used for consequential thinking: choosing a customer, challenging an assumption, committing to a price, cutting scope, and deciding whether a company is ready to launch. The interface should support judgment rather than perform enthusiasm.

## Principles

### Editorial before dashboard

Use hierarchy, typography, sequence, and whitespace to explain the work. Prefer a decisive row, ledger, or document section over a grid of interchangeable cards.

### One primary job per page

A page should answer one founder question and make the relevant action obvious.

- Today: what matters now?
- Business: what is true or assumed about the company?
- Workstreams: what must advance in this body of work?
- Decisions: what call has been or must be made?
- Deliverables: what reusable work is current and trustworthy?
- Launch: what prevents a responsible launch claim?

### Reveal system detail only when useful

Founder vocabulary stays primary. Engine, provider, and filesystem details belong in technical disclosure, export provenance, or automation configuration.

### Confidence is evidence quality, not visual polish

A beautiful document can still be strategically weak. Confidence indicators must refer to evidence, decision quality, and consistency.

### Calm urgency

Formation should show what matters without turning every unresolved item into an alarm. Reserve warning treatment for actual contradictions, blockers, security concerns, or consequential deadlines.

## Visual language

### Color

The core palette uses warm neutral surfaces and restrained semantic accents.

| Token | Purpose |
| --- | --- |
| `--paper` | application background |
| `--surface` | primary working surface |
| `--surface-strong` | documents, rows, and focused editing |
| `--ink` | primary text |
| `--ink-soft` | body copy |
| `--muted` | metadata and supporting language |
| `--forest-dark` | stable navigation and high-emphasis blocks |
| `--forest` | primary actions and positive progress |
| `--amber` | unresolved or needs-attention states |
| `--rust` | contradictions and consequential cautions |
| `--red` | blocked, failed, or destructive states |
| `--blue` | draft and informational state |

Avoid decorative gradients. Color must communicate state or hierarchy.

### Typography

- Display headings use a restrained serif stack.
- Controls, navigation, metadata, and body copy use a system sans-serif stack.
- Large serif headings establish editorial hierarchy without requiring an external font download.
- Uppercase eyebrow labels are reserved for orientation and small category labels.
- Body text prioritizes readable line length and generous line height.

### Spacing

Spacing should create groups before borders do.

- Use page-level vertical rhythm between major decisions and bodies of work.
- Use thin rules to clarify sequence.
- Avoid wrapping every subsection in a bordered container.
- Keep controls close to the information they mutate.

### Shape

- Most rows and document surfaces are square or gently rounded.
- Rounded pills are not a default component.
- Circular shapes are used sparingly for identity, task completion, or sequence.
- Large radius containers are reserved for high-emphasis next-action or launch-definition blocks.

## Core interaction patterns

### Application shell

The shell provides:

- persistent company switcher
- six stable primary destinations
- current stage and objective
- direct decision action
- founder identity and sign out

Mobile navigation becomes a dismissible drawer with a scrim and visible close action.

### Page header

Every primary page begins with:

- an orientation eyebrow
- a direct founder-facing title
- a one-sentence explanation of the page job
- at most one primary action group

### Recommendation row

A recommendation shows:

- sequence number
- recommendation type
- confidence
- title
- detail
- rationale beginning with “Why now”
- direct action

Recommendations are rows because their order matters.

### Source-of-truth statement

Business context uses a two-column editorial statement:

- definition and guidance on the left
- current durable company statement on the right

Editing happens in place through labelled fields.

### Workstream row

A workstream row includes:

- sequence and title
- concise job statement
- status and progress
- one current next action

It does not include decorative owner avatars, generic metrics, or unrelated activity.

### Decision record

A decision record shows:

- status and workstream
- owner
- title
- actual decision
- rationale
- decision and review dates
- controlled status action

Open or revisit decisions receive a restrained amber edge rather than an oversized warning card.

### Deliverable workspace

The document library uses:

- a compact index on the left or above on smaller screens
- one focused document editor
- document metadata
- structured sections
- context lineage
- immutable version history

The experience should feel suitable for sharing with an advisor or employee.

### Readiness view

Readiness communicates:

- one conservative score
- the target launch definition
- progress by business outcome
- explicit blockers
- critical path
- unresolved calls

Do not add decorative charts unless they improve a specific launch decision.

## Status vocabulary

Founder-facing status language is deliberately small.

### Workstreams

- Not started
- On track
- Needs attention
- Blocked
- Complete

### Decisions

- Open
- Proposed
- Decided
- Revisit
- Superseded

### Deliverables

- Draft
- Reviewed
- Approved
- Superseded

### Tasks

- Backlog
- Next
- In progress
- Blocked
- Done

### Generation

- Queued
- Processing
- Completed
- Failed

Engine status vocabularies must be translated behind an adapter rather than leaked into product controls.

## Content style

### Calls to action

Use concrete actions:

- Record decision
- Add claim
- Create structured draft
- Save new version
- Resolve conflict
- Review launch path

Avoid vague actions such as “Explore,” “Unlock,” “Optimize,” or “Generate magic.”

### Recommendations

A recommendation must state:

- the action
- the business consequence
- why it matters now
- confidence
- the affected workstream or decision

### Empty states

A useful empty state explains:

1. why nothing is present
2. what would make the section useful
3. the next meaningful action, when one exists

### AI language

Do not anthropomorphize the generator or present it as an oracle. Use terms such as:

- structured draft
- recommendation
- proposed claim
- confidence
- founder review
- source context

## Accessibility

The implementation includes:

- semantic headings and landmarks
- visible keyboard focus
- labelled inputs and controls
- native progress elements
- screen-reader labels for icon-only actions
- focus trapping and restoration in dialogs
- Escape-to-close dialogs
- reduced-motion support
- mobile layouts that preserve action order
- state communication through text and shape, not color alone

Future changes should test keyboard-only navigation and screen-reader output for every new primary journey.

## Responsive behavior

### Wide desktop

- persistent navigation
- Today priority list plus readiness rail
- side-by-side work and decision sections
- deliverable index beside the document

### Tablet and narrow desktop

- navigation drawer
- stacked command center
- deliverable index above the document
- reduced multi-column evidence layouts

### Mobile

- single-column page flow
- full-width primary actions
- stacked decision metadata
- simplified workstream rows
- document editing with preserved section order
- no horizontal-scrolling core workflow tables

## Design anti-patterns

Do not introduce:

- gradient-heavy AI styling
- chat as the primary product structure
- a card around every data point
- pill and badge proliferation
- decorative KPI dashboards
- generic “AI assistant” copy
- inconsistent one-off page layouts
- settings-style density for core business work
- animations that delay reading or action
- generated prose without visible structure or editing

## Evolution

The CSS system is intentionally dependency-light. When introducing a formal component library or token build pipeline:

- preserve the current semantic tokens
- migrate components rather than replacing page structure wholesale
- keep the founder vocabulary and page jobs stable
- verify contrast, keyboard behavior, reduced motion, and responsive layouts
- publish shared tokens to engine exports only after ownership remains unambiguous
