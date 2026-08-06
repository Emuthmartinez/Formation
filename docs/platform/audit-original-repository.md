# Original repository audit

Audit baseline: `main` at `feac0c190816f64c27d63a8a614cda4ec2234062`, immediately after the autonomous graph runtime rebuild merged in pull request 114 on August 5, 2026.

## Executive finding

The repository contained an unusually capable launch automation engine, but it did not contain a B2B founder product.

Its strongest work lived below the interface:

- a typed workflow catalog
- a durable compile, frontier, dispatch execution model
- a single-writer reducer
- resumable run state
- autonomy grants, waivers, budgets, and kill switches
- deterministic validators and verification suites
- extensive domain knowledge and launch artifact contracts

The founder experience exposed those systems through generated files, static HTML, command-line onboarding, and one maintainer-oriented Vite view. The product model was therefore the repository and its artifacts, not the founder and their company.

The transformation should preserve the engine and replace the interaction model.

## 1. Current architecture and dependencies

### Repository layers

| Layer | Original responsibility | Assessment |
| --- | --- | --- |
| `skill/b2c-mobile-business-launch/core/` | schemas, runtime engine, reducer, autonomy, sessions, adapters | Strong and worth retaining as an internal execution engine |
| `skill/b2c-mobile-business-launch/catalog/` | typed definition graph, workflows, domains, phases, lanes, gates, references | Strong orchestration source of truth, but not a founder-facing information architecture |
| `skill/b2c-mobile-business-launch/knowledge/` | bounded domain guidance and provider doctrine | Valuable reusable knowledge, currently optimized for agent loading |
| `skill/b2c-mobile-business-launch/workspace/` | generated launch-repository artifact contract | Valuable export and execution contract, weak as an application data model |
| `skill/b2c-mobile-business-launch/validation/` | business and repository validators | Valuable deterministic proof layer, with some legacy prose-pattern checks |
| `skill/b2c-mobile-business-launch/verification/` | core fixtures, boundary tests, parity, rehearsals | Valuable engineering quality layer |
| `skill/b2c-mobile-business-launch/tooling/` | renderers, probes, migrations, audit runners | Useful internal mechanics; several renderers had become accidental founder interfaces |
| `skill/b2c-mobile-business-launch/studio/` | maintainer Design Room and static seed state | Useful for maintainers, not a product shell |
| `skill/b2c-mobile-business-launch/starters/` | runnable mobile-app archetypes | Useful downstream implementation assets |
| root `docs/` | architecture, methods, history, prototypes, plans | Comprehensive but oriented around maintaining and operating a skill |

### Frameworks and runtime

- Node.js 22, TypeScript, and `tsx` power the engine, tools, validators, and tests.
- React 19 and Vite 8 were already dependencies because the maintainer Design Room used them.
- The Design Room was a small Vite application, not the repository's primary product.
- There was no founder application server, API boundary, authentication system, tenancy model, or shared application router.
- Mutable launch state primarily lived in repository files such as `PROJECT_STATE.yaml`, control documents, manifests, generated business artifacts, and seed JSON.

### Original data and state model

The repository had several valid but overlapping concepts of state:

1. **Definition state** in the typed catalog.
2. **Business instance state** in `PROJECT_STATE.yaml` and business workspace files.
3. **Autonomy control state** in grants, waivers, budgets, and control documents.
4. **Run state** in durable engine checkpoints and attempts.
5. **Artifact state** in Markdown, JSON, HTML, and evidence paths.
6. **Studio seed state** in static JSON used to render maintainer views.

These are appropriate engine concerns. They are not a complete SaaS product model because they do not center users, workspace membership, editable business records, comments, document versions, or product navigation.

### Original content-generation flow

The effective founder-facing flow was:

```text
conversation or command-line onboarding
  -> graph node receives scoped references and repository state
  -> agent writes Markdown, JSON, code, evidence, or control patches
  -> validators grade files and claims
  -> renderer turns selected files into static HTML
  -> founder opens a generated page or reads repository artifacts
```

This flow is strong for autonomous repository work. It is weak for repeated founder collaboration because the unit of interaction is an output file rather than a durable business object.

## 2. Founder-facing surfaces and navigation

The audit found six classes of founder-facing surface.

| Surface | Source | Job it attempted | Main problem |
| --- | --- | --- | --- |
| Design Room | `studio/app/src/App.tsx` | Show visual direction, metrics, journeys, decisions, and screens from static seed JSON | A maintainer review surface with no router, persistence, editing, tenancy, or live workflow |
| Launch cockpit | `tooling/render-launch-cockpit.ts` | Summarize progress, blockers, milestones, services, proof, and agent operations | One large generated HTML document containing tables and runtime concepts; no application state or direct actions |
| Autonomy console | `tooling/render-autonomy-console.ts` | Show grants, waivers, budgets, and parked founder approvals | Useful operational control, but not integrated with company strategy or daily founder work |
| Business control plane workspace | `tooling/render-business-control-plane-workspace.ts` | Project business state into a founder-readable workspace | Static projection from JSON rather than an editable source of truth |
| Artifact pages | `tooling/render-artifact-pages.ts` | Convert selected Markdown artifacts into readable HTML | Each artifact became a separate page and navigation path, preserving file boundaries as product boundaries |
| Onboarding session | `core/session/onboard.ts` and `content/onboarding/` | Capture autonomy preferences and initialize controls | Command-line or transcript-driven, focused on agent authority more than forming the business |

### Original navigation paths

There was no product router or shared navigation model. A founder moved through the system by:

- opening generated HTML files directly
- following links embedded in generated pages
- reading the workspace directory tree
- asking an agent to operate a workflow
- running render commands
- approving parked engine work through command-line flows

This created several competing navigation systems:

- business capability folders
- graph phases and lanes
- generated cockpit sections
- artifact manifest links
- studio sections
- agent prompts and commands

None expressed a stable founder mental model.

### Generated artifact inventory

The workspace contract grouped artifacts under strategy, product, design, engineering, analytics, growth, revenue, store, trust, and operations. It included business plans, research, product specifications, design direction, growth plans, revenue assumptions, store packets, trust and security evidence, operational runbooks, provider packets, and generated pages.

The artifact breadth is valuable. The problem was the direct one-to-one mapping from file or validator output to founder page. A founder does not think in terms of which renderer produced `BUSINESS_ACCESS.md`; they think in terms of a decision, risk, plan, or deliverable.

## 3. What remains valuable

### Keep as core product infrastructure

- Catalog IDs and workflow contracts
- Durable graph compilation and readiness semantics
- Single-writer state reduction
- Attempt, evidence, and fingerprint lineage
- Independent verification
- Autonomy control boundaries
- Source registry and provider proof patterns
- Domain knowledge packs
- Business validators that verify structure or live evidence
- Archetype starters
- Existing business artifact templates where their content remains useful

### Keep as internal or export-only surfaces

- Maintainer Design Room
- Launch cockpit HTML
- Autonomy console HTML
- Business control plane projections
- Markdown artifact pages

These remain useful for engine debugging, static exports, migration, and backwards compatibility. They should not define the founder product.

## 4. Remove, consolidate, redesign, or rebuild

| Original concept | Disposition | Replacement |
| --- | --- | --- |
| Founder navigates repository folders | Remove from founder experience | Stable application navigation by founder job |
| One generated file equals one page | Replace | Deliverable library with editable, versioned documents |
| `PROJECT_STATE.yaml` as the only business source of truth | Demote to engine projection | Workspace, company, workstream, claim, decision, task, and artifact records |
| Static cockpit as dashboard | Replace | Today command center with ranked actions and rationale |
| Runtime lane table as progress | Replace | Connected workstreams and outcome-based launch readiness |
| AI prose as final output | Replace | Structured drafts with claims, confidence, sections, and review status |
| Founder repeats context in prompts | Remove | Persistent company context automatically scoped into generation |
| Autonomy onboarding as first experience | Reposition | Business formation onboarding first; automation authority later |
| Scattered status vocabularies | Consolidate | Product-facing status language mapped to engine states behind an adapter |
| File-path links and commands | Remove from core journeys | Direct product actions and API mutations |

## 5. Skill-oriented mental model that remained

The original repository still assumed:

- the user begins by invoking a skill
- the conversation is the application session
- the repository is the database
- a Markdown artifact is the durable product output
- validators are the primary feedback interface
- graph lanes are understandable navigation
- the founder will tolerate command-line approvals and render commands
- output quality can compensate for the absence of an editable product model

Those assumptions are reasonable for an expert agent runtime. They are not reasonable for a B2B platform founders use every week.

## 6. Technical debt and weak abstractions

### Product debt

- no user or workspace tenancy model
- no authentication boundary
- no shared product router
- no canonical editable company record
- no reusable decision entity
- no task model connected to decisions and workstreams
- no artifact version history at the product layer
- no collaboration or review model
- no product-level event or activity model
- no consistent path from recommendation to action

### State debt

- business truth split across YAML, JSON, Markdown, generated HTML, manifests, and conversations
- seed state and launch state could drift
- renderers read filesystem paths directly
- multiple projections duplicated concepts with different labels
- generated outputs could contradict previous outputs without a product-level contradiction check

### Interface debt

- long tables and static documents
- dense system vocabulary
- no persistent application shell
- inconsistent page structure because each renderer owned its own markup and CSS
- decorative status chips and cards without a consistent interaction pattern
- little support for editing, reviewing, or comparing changes

### Architecture debt

- application concerns and engine concerns were not separated because no application existed
- renderers acted as both presentation and domain logic
- founder copy was distributed through renderer helpers and content files
- no API or service layer protected state mutations
- no clear adapter boundary between platform objects and graph execution objects

## 7. Original end-to-end journey and friction

1. The founder invoked the skill or entered onboarding.
2. The system asked questions partly about the business and partly about agent autonomy.
3. The agent created or updated repository files.
4. The founder opened a cockpit or individual artifact page.
5. Progress appeared as lanes, gates, file evidence, and runtime status.
6. A new request often generated another file or replaced prior prose.
7. The founder had to reconcile contradictions, find the right artifact, and infer the next action.
8. Returning later required reopening the correct repository, state file, or generated page.

Major friction:

- high cognitive cost before value
- navigation organized around implementation artifacts
- repeated context gathering
- weak continuity between recommendations
- no direct editing loop
- no stable decision log
- no clear daily starting point
- no collaborative handoff model
- no trustworthy product-level launch view

## Audit conclusion

The repository did not need a cosmetic redesign. It needed a new product layer.

The correct move was to preserve the graph-native engine as a differentiating backend capability and build a founder-centered platform above it with its own domain model, tenancy, persistence, navigation, generation contract, and design system.
