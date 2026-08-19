# Workflow modeling method

How workflow changes are made in this repository. The live inventory is generated from the catalog; edit definitions, never projections.

- source definitions: `skill/formation/catalog/workflows/*.ts` (plus `lanes.ts`, `phases.ts`, `roles.ts`, `gates.ts`)
- generated projections: `skill/formation/catalog/generated/` (`catalog.json`, `routing.md`, `spine.md`, `contracts.md`)
- knowledge bindings: `skill/formation/catalog/knowledge/**/*.yaml`

## The loop

1. Edit the workflow definition (a `workflow({...})` seed: trigger, instructions, reads, role, lanes, phases, dependencies, outputs, gates, recurrence).
2. Bind or update the knowledge manifest that carries the node's guidance.
3. Run `npm run catalog:render-routing` to regenerate every projection.
4. Run `npm run check:catalog` — graph integrity, node contracts, knowledge rules.
5. Run `npm run audit` before any readiness claim; `check:engine-e2e` drives the compiled graph against the reference business on every audit.

Rules that hold across every change: stable catalog IDs are identities and survive path moves; a declared read is a readiness input (the compiler wires it); every output path needs exactly one producing workflow and an owning role whose scope covers it; a node count in prose is a bug — the compiled catalog and its count fixture are the source of truth.
