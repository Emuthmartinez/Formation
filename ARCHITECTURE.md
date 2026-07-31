# Architecture — the north star

This is the target shape of the skill. It is not a description of what exists today; it is what every structural change should move toward. When the current layout and this document disagree, this document wins and the layout is what changes.

`AGENTS.md` is the maintainer guide for how to work. This file is what we are working toward.

## The problem this solves

The top level splits by **file kind**, not by meaning:

| Directory | What it actually holds |
| --- | --- |
| `references/` | prose |
| `business/` | founder artifacts, agent bookkeeping, and 161 files of starter app code, at the same level |
| `scripts/` | validators, renderers, and the skill's own upkeep |
| `evals/`, `state/` | machinery, state |

So a question about one subject — "how does this handle pricing?" — requires reading three directories, and nothing in a directory listing says which part of the business a file belongs to. `provider-state-recipes.md` sits between `product-moat.md` and `push-notification-lifecycle.md` because of the alphabet. Three unrelated parts of the business, adjacent by accident.

A 2026-07-30 catalogue of all 447 tracked files measured the consequences:

- **Domains are invisible.** 95 reference files across 2 subfolders; 75 sit flat.
- **Between a fifth and a quarter of the skill is the skill checking itself** — 22.1% of tracked bytes, and 36% of the validators check byte budgets, version discipline, and orchestration wording rather than the business.
- **Founder documents are indistinguishable from agent bookkeeping.** Of 297 files under `business/` and `state/`, about a dozen are things a founder would ever open.

## Three axes, two of them can be folders

1. **Domain** — which part of the business (money, store, design)
2. **Stage** — when in the launch (research → spec → build → submit → operate)
3. **Kind** — knowledge, artifact, gate, state

Today *kind* is the top level, *domain* is nowhere, and *stage* exists only as prose inside `SKILL.md`. The target inverts that: **audience at the top, domain inside, stage as a document.**

## Target layout

```
<skill-root>/
  SKILL.md                 routing only — target ≤ 12KB, not 46KB
  spine.md                 the ordered walk through a launch; stages live here

  playbook/                agent knowledge, grouped by domain
    research/  product/  experience/  design/  words/  engineering/
    store/  money/  growth/  data/  trust/  operations/  process/
      README.md            index: load-when triggers, one row per file
      *.md                 the lane references themselves

  business/                what a launch produces
    docs/                  the documents a founder opens
    pages/                 rendered HTML — generated from state, never hand-authored

  starters/                runnable app scaffolds (not templates, not read as prose)
  gates/                   validators, mirroring playbook domains
  machine/                 the skill's own upkeep: versioning, evals, parity, fixtures
  state/                   the state store and its schemas
```

Two of those domains are easy to confuse and are deliberately separate. **`operations/`** is running the *business* — founder access, secrets, paid-tool routing, agent operations, post-launch rhythm. **`process/`** is running the *launch* — phases, state, coverage, artifact contracts, traceability, orchestration, change cascade. Both are cross-cutting; neither is machinery, because an agent loads them mid-launch and a maintainer rarely opens them.

`machine/` is narrower than "everything self-referential": it is only what the maintainer touches to keep the skill green — versioning, the eval harness, the source registry, parity, fixtures. A file about *how a launch is run* is method and belongs in `playbook/process/`, not here. Mixing the two is what made "the skill talking about itself" measure at 22% when much of that is really the method the skill exists to carry.

Each domain folder carries its own `README.md` index rather than a sibling `<domain>.md`. A folder that explains itself on its front page needs no convention to be learned, and it keeps the domain self-contained when it moves.

## The rules that make it hold

**Stage is a document, not a directory.** Numbered folders would assert a walk-through order that `SKILL.md` explicitly forbids ("load a row's references when its trigger fires — not before"). An agent asks *what do I do next* a handful of times per launch and *how do I do X* hundreds of times, so lookup frequency puts domain in the tree. The sequence lives in `spine.md`, which is the one thing here that genuinely is a sequence.

**One subject, one folder.** Everything about money — the knowledge, the artifact it produces, the gate that proves it — is reachable from one place. Adding a domain is adding a folder; removing one is removing a folder.

**Audience separation is load-bearing.** `business/` is what a founder reads. `playbook/` is what an agent reads. `machine/` is what only the maintainer touches. Mixing them is what made the skill feel large: a founder browsing `business/` sees 291 files when about a dozen concern them.

**`SKILL.md` routes and nothing else.** Every domain gets one row pointing at its index. Detail lives one level down. Measured on the store domain: collapsing nine verbose routing rows into three index-pointing rows freed 2,787 bytes while the folder move cost 120 — the entrypoint's fullness is a symptom of detail living too high, not a budget problem.

**HTML is generated, never authored.** Every page in `business/` renders from `state/`. Hand-authored HTML twins go stale silently with no signal; six such pairs exist today.

**Merge duplicates as you move, in the same commit.** Moving duplicated content into a tidy folder gives the duplication a nicer address. The known clusters: four emotional-design files restating the same citations, twelve near-identical card files, the six HTML/Markdown twins.

## What this deliberately drops

- The `references/` vs `business/` distinction, which means nothing to any of the three audiences
- Starter app code living under `business/` — 161 files that are neither templates nor read as prose
- Hand-authored HTML that duplicates a Markdown source
- Validators that exist to check other validators' wording, where a single gate would do

## Migration order

Safest first; each step keeps `npm run audit:ci` green and lands as its own commit.

1. **`starters/`** — move `business/app-archetypes/`. Largest file-count win, smallest reference surface. **Done, v0.52.0.**
2. **`playbook/`** — regroup `references/` by domain, each with its `README.md`, collapsing `SKILL.md` rows as each domain lands. **Done, v0.53.0.**
3. **`business/`** — rename `templates/` for what it produces. **Done, v0.54.0.** The `docs/` and `pages/` sub-split is still pending.
4. **`gates/` + the validator half of `machine/`** — move all 61 `scripts/check-*.ts` at once, split by what they grade. **Done, v0.55.0.**
5. **`machine/`, the rest** — the eval harness and its 129 eval files, and `scripts/fixtures/`. **Done, v0.56.0.**

**The migration is complete.** Every top-level directory now answers *who reads it* rather than *what kind of file it holds*. `run-audit.ts` stays in `scripts/` deliberately: it is the pipeline orchestrator that runs gates, machine checks and renderers alike, not part of the eval harness. What remains in `scripts/` is coherent — everything executable that is neither a gate nor the eval harness, plus the shared `lib/`.

The last four files whose homes were arguable were placed in v0.57.0 by the same rule: `audit-skill-links.ts` and `refresh-source-freshness.ts` grade the skill, so they are in `machine/`; `validate-project-state.ts` grades a business repo's state and `validate-state.ts` grades its design state, so they are in `gates/process/` and `gates/design/`. `check:gates-layout` now enforces the shape they landed in.

Steps 4 and 5 were originally separate. They were merged for the validators because a blanket move of all 61 to `gates/` would have sent parity and versioning there only for step 5 to move them out again — and this repo pays 8–18 review rounds per PR, so relocating a file twice is the expensive mistake. Step 5 keeps the evals and fixtures.

## What decides `gates/` from `machine/`

**`gates/` grades a business launch. `machine/` grades the skill itself.**

The operative test is the **subject of the assertion, not the root flag the validator takes**. Several gates run against the skill root — which argues `machine/` — while asserting something about the launch. `check:motion-contract` governs the numbers a launched app animates with; `check:asc-command-contract` the commands a submission runs; `check:app-archetype` and `check:archetype-starter` the scaffold a business is built from; `check:artifact-templates` the launch's artifact contract. Their subject is the launch, so they are gates.

`machine/` stays narrow: package parity, skill version, version discipline, source-registry freshness and its refresher, reference byte budgets, the `SKILL.md` autopilot contract, and the link-graph audit. A file about *how a launch is run* is method — its gate belongs in `gates/process/`, not here.

**`skill-version.json` stays at the skill root and does not move into `machine/`.** It is the one file that has to be readable by something that has not loaded the skill yet:

- `SKILL.md` instructs an agent to "compare `skill-version.json` manually if the helper is unavailable" — a fallback that only works at a stable, shallow, known path.
- `check:skill-version` compares the manifest across two installs (`--source` and `--installed`). Burying it one level down makes that comparison depend on the installed copy having the same *internal* layout, which is precisely the drift a version check exists to detect.
- It is a manifest describing the whole package, like `package.json` and `SKILL.md`. A manifest belongs at the root of the thing it describes.

`machine/` holds what a maintainer *runs*; `skill-version.json` is what the outside world *reads*.

`gates/` mirrors the `playbook/` domain names rather than staying flat. The two machine consumers of these paths are indifferent to the choice — the audit runner resolves steps by npm script name, the fixture harness by basename — so the decision rests on the reader who orients before grepping, and 55 files in one directory give that reader nothing. There is **no top-level exception bucket**: every gate nests, and genuinely cross-cutting ones go to `gates/process/`, which this document already describes as the cross-cutting launch-method domain. One placement rule, not two.

Nothing may assume a validator's directory. `scripts/lib/script-paths.ts` indexes `gates/`, `machine/` and `scripts/` and resolves a spawnable script by basename, throwing on an unknown or ambiguous name. It throws rather than falling back because a wrong path exits non-zero and roughly 700 fixtures assert exit 1 — a silent fallback turns the whole suite green while testing nothing.

`playbook/` moved ahead of `business/` deliberately: it is the step that answers the original complaint (domains are invisible in a directory listing), its classification is already decided, and its `SKILL.md` collapse *frees* budget rather than spending it. `business/` needs a judgment call per file about whether a founder reads it, and touches far more hardcoded paths, so it benefits from going second.

## Open decisions

- **The name.** The root directory is named for the product. Renaming costs a one-time sync across `~/.codex`, `~/.claude`, `~/.agents` plus `skill-version.json`, so it is deferred until the name is chosen, not blocked on it.
- **Card and technique naming.** Whether the twelve engagement-technique names get plain-language equivalents or stay internal labels behind one umbrella term a founder sees.

## Naming traps

Domain folder names have to survive `.gitignore`. `playbook/build/` was silently untracked for a whole CI run because the root `.gitignore` carries `build/`, which matches at any depth — the moved files were tracked (`git mv` forces already-tracked files) but the new index was dropped by `git add` without a word. The domain is `engineering/` for that reason. Check any future domain name against `git check-ignore -v` before committing to it; `dist`, `build`, `tmp`, `out`, and `target` are all landmines.
