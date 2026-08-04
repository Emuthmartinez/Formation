# Business Control Plane Requirements

Created: 2026-05-31
Status: exploratory
Workflow: Compound Engineering brainstorm

## Product Frame

Build a local-first business control plane that gives a founder the Claude Design dashboard feeling, but for businesses instead of design files. The first screen is a portfolio launcher. From there, the user can create a business from a template, open an existing business, and drill into its state, artifacts, blockers, proof, agents, and rendered views.

The initial user is a founder/operator with multiple local business folders, app repos, launch docs, and agent handoff files. The product earns its place if it makes the next action obvious and prevents continuity drift between sessions.

## Core Thesis

Yes, this becomes much easier if the state is already JSON or YAML. The key is to avoid rendering raw files directly. The app should validate raw state, adapt it into a stable read model, and render the UI from that read model.

Markdown should remain useful as artifact content, but not as the primary state source for dashboard logic. The dashboard needs typed fields, stable ids, status enums, timestamps, artifact references, proof gates, and agent lanes.

## Existing Repo Anchors

- `skill/b2c-mobile-business-launch/business/state/PROJECT_STATE.yaml` already models launch state, continuity, orchestration, lanes, tools, and founder-only gates.
- `skill/b2c-mobile-business-launch/state/business.json` already models business identity, design state, surfaces, App Store state, and control-plane panels.
- `skill/b2c-mobile-business-launch/state/schema/business.schema.json` already validates Design Room state with JSON Schema and AJV.
- `skill/b2c-mobile-business-launch/playbook/process/control-plane.md` already says Design Room is the first panel in a larger Business Control Plane.
- `skill/b2c-mobile-business-launch/gates/operations/check-control-plane-contract.ts` already enforces first-class control-plane panels, state refs, rendered artifacts, and kebab-case ids.

## Product Requirements

- The app must show a top-level portfolio view of businesses, not just one current project.
- The app must support templates for new business workspaces.
- Each business must open into a drill-down control plane with panels for Overview, Design Room, Launch, Store Ops, Revenue, Analytics/Growth, and Agents.
- Each panel must show the state files and rendered artifacts it depends on.
- The UI must make continuity drift visible before work begins.
- The UI must show which agent lanes are required, what they own, and what they are not allowed to do.
- The product must work locally without requiring cloud accounts, credentials, or hosted storage.
- The product must allow adapters for different repo structures rather than assuming this exact skill repo.

## Recommended Data Layers

1. **Workspace index**: A portfolio file that lists local businesses, templates, paths, tags, and current status. This is the home-screen source.
2. **Business state**: A normalized per-business model for identity, stage, positioning, surfaces, panels, artifacts, proof, and agent lanes.
3. **Launch state adapter**: A parser that imports `state/PROJECT_STATE.yaml` or another launch-state file into the normalized business model.
4. **Artifact registry**: A typed list of docs, HTML renders, screenshots, evals, validators, app builds, deploys, and provider proof.
5. **Template registry**: A list of scaffoldable business templates, their included files, required state, and optional adapters.

## Schema Strategy

Start with JSON Schema 2020-12 because the existing skill already uses it. YAML can be parsed into JSON and validated against the same schemas.

Recommended schemas:

- `workspace.schema.json`: portfolio-level businesses, templates, repo roots, and state file references.
- `business.schema.json`: the normalized control-plane read model.
- `artifact.schema.json`: artifact ids, paths, type, proof status, and owner panel.
- `agent-lane.schema.json`: subagent lanes, preflight checks, forbidden actions, integration owner, and validators.
- `template.schema.json`: business template metadata, scaffolded files, starter panels, and post-create checks.

## State Shape Principles

- Use stable ids everywhere: business ids, panel ids, artifact ids, agent lane ids, and template ids.
- Keep human-editable state small; derive bulky dashboard projections at runtime.
- Treat evidence as first-class state: if the UI claims a build, deploy, provider setup, or store step is ready, it should point to proof.
- Separate status from narrative. Status drives the UI; narrative explains it.
- Keep generated state reproducible so git diffs remain useful.
- Prefer additive schema evolution with `schemaVersion` and migrations.

## MVP Experiment

The smallest useful experiment is a static local UI backed by a JSON fixture:

- `docs/prototypes/business-control-plane-prototype.html` renders the portfolio and drill-down UI.
- `docs/prototypes/fixtures/business-control-plane-workspace.json` provides the workspace state.
- `skill/b2c-mobile-business-launch/state/schema/workspace.schema.json` documents the first portable read-model schema.

After that, the next experiment should replace the fixture with an adapter that reads:

- `skill/b2c-mobile-business-launch/state/business.json`
- `skill/b2c-mobile-business-launch/state/theme.tokens.json`
- `skill/b2c-mobile-business-launch/business/state/PROJECT_STATE.yaml`

That adapter now exists as `skill/b2c-mobile-business-launch/scripts/render-business-control-plane-workspace.ts`; `check:business-control-plane-workspace` keeps the generated workspace read model fresh.

The prototype can load any workspace read model with `?workspace=...`, so the hand-authored portfolio fixture and the generated source-backed fixture can be compared without changing UI code.

## Open-Source Positioning

The open-source product should not be "a dashboard for this skill." It should be "a local business operating system for founders who run companies out of repos and files." This repo can provide the first adapter, templates, and proof that the model works.

The defensible wedge is continuity: most local AI/operator tools can generate docs, but few make state, proof, blockers, and agent routing legible across sessions.

## Non-Goals

- Do not require a hosted database for the first version.
- Do not require users to adopt this skill's exact directory layout.
- Do not turn every Markdown doc into structured state on day one.
- Do not let generated dashboard HTML become the source of truth.
- Do not expose secrets or provider credentials in the control plane.

## Success Criteria

- A new user can point the app at a folder and see a coherent business card within minutes.
- A returning user can see the current state, blockers, and next action without reading every doc.
- An agent can use the same state to choose the right skill/subagent path.
- Validators catch missing panels, stale refs, missing proof, and continuity preflight gaps before the UI presents false confidence.
- The model can represent both this launch skill and at least one non-mobile-app business.

## Recommended Next Step

Convert the prototype from hardcoded JavaScript state to a JSON-backed fixture, then add a small schema around that fixture. This proves the state-backed direction without prematurely choosing the full app framework or storage layer.
