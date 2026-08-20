# Packs: additive catalog composition

- Date: 2026-08-20
- Status: DESIGN — deliberately unimplemented until a real second pack exists (layering plan R7, phase E)
- Owner: engine

## What a pack is

A pack is an additive set of catalog content — workflows, knowledge references, artifacts, and
their bindings — composed into the base catalog at compile time. "The catalog is managed like
source, consumed as a compiled artifact, varied by composition, never by mutation" (the layering
plan's catalog rule): a pack is the third composition lever, next to scope verdicts (per-workflow
founder answers, shipped) and named profiles (per-business breadth selection, phase E).

The motivating shape: a business archetype that needs workflows the base catalog deliberately
does not carry — a hardware-adjacent app's fulfillment lane, a marketplace's seller-onboarding
lane — without those workflows burdening every other business's plan, and without anyone editing
the base catalog per business.

## Why this is a design and not an implementation

One pack exists today: the base catalog itself. Building the loader, the pack manifest schema,
and the precedence rules against zero real second packs would repeat the mistake this repository
has already paid for twice — capability without a caller (the 2026-08-19 audit's core finding)
and gates that pass vacuously because nothing exercises them. The design is committed now so the
first real pack lands against agreed rules; the implementation waits for that pack.

## The rules (committed now)

1. **Additive only.** A pack may add workflows, references, artifacts, areas. It may never
   remove, replace, or edit base content. There is no override mechanism — a pack that needs the
   base to change submits a change to the base.
2. **Same validators, same gates.** A composed catalog runs the exact `validateCatalog()` the
   base runs — every rule in `catalog/validate.ts`, no pack-specific exemptions. The two rules
   that make composition safe already exist and fail closed:
   - `ambiguous_write` — an output path with two writers fails, so a pack cannot silently
     contend with a base workflow's artifact;
   - `unknown_dependency` / `read_unresolvable` — a pack workflow depending on or reading
     something the composed catalog does not carry fails at compile, not at dispatch.
3. **Declared, pinned, and fingerprinted.** A workspace names its packs in durable state the way
   it pins its catalog today (`.b2c-launch/runtime.json`); a pack change is a re-pin through
   `bootstrap --apply` — explicit and per-business, never ambient. The compiled `catalog.json`
   carries the pack list it was composed from.
4. **Stable IDs are global.** Pack workflow ids share the base namespace
   (`workflow.<domain>.<slug>`), so the duplicate-id refusal in the scaffolder and the catalog
   validators applies across packs. Two packs that collide fail composition by name.
5. **Profiles select; packs supply.** A named profile (phase E's other half) chooses breadth
   within whatever the composed catalog carries. A pack widens what exists to choose from. They
   compose: profile evaluation runs after pack composition, over the full composed node set.

## Acceptance criteria for the implementation (when the second pack arrives)

- A pack is a directory with a manifest (`pack.yaml`: id, title, version, and the content lists)
  loadable by `composeCatalog(skillRoot, packs)` — the one composition point.
- `check:catalog` validates the base, each pack alone (against the base), and the composed
  whole; a failure names the pack.
- `check:engine-e2e` gains a leg: a workspace pinned with the pack compiles, plans, and runs a
  pack workflow through the same session machinery, and a workspace WITHOUT the pack never sees
  its nodes.
- The count fixture pins base-catalog counts; composed counts are asserted relative to the pack
  manifest, never hardcoded.
- `catalog:add-workflow` gains `--pack <id>` and writes into the pack's own directory with the
  same seed shape and the same named-remainder checklist.

## Non-goals

- No pack marketplace, no remote pack fetching, no pack versioning beyond the workspace's
  ordinary pin. A pack ships in this repository (or a fork) and rides the same tag.
- No behavioral flags inside packs. A pack that wants different engine behavior is asking for an
  engine change, not a pack.
