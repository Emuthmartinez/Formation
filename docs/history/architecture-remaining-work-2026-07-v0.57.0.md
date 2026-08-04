# Prompt: finish docs/architecture.md — the work after the directory migration

> **Historical record. Written against v0.57.0 on 2026-07-31.** Steps 6–10 have all
> shipped: v0.57.0 (#83), v0.58.0 (#84), v0.59.0 (#85), v0.60.0 (#86), v0.61.0 (#87).
> Do not action the step list below.
>
> The two decisions it left open are both closed as of v0.62.0, and neither outcome is
> in the step list below. Step 9's second half — whether the twelve engagement-technique
> names get plain-language founder equivalents — was answered *no*, with the reasoning
> and the gate that enforces it recorded under *Settled decisions* in
> [`docs/architecture.md`](../architecture.md); the emotional-design half of step 9 merged
> in v0.59.0. Step 11, the product name, was a founder call: the name stays.
>
> Kept for its reasoning, not its instructions.

Paste this into a fresh session in `/Users/eduardomuthmartinez/code/b2c-mobile-business-launch-skill`.

Steps 1–5 (the directory migration) are **merged**: v0.52.0 → v0.56.0, PRs #78–#82.
Every top-level directory now answers *who reads it*. What follows is everything
docs/architecture.md still describes but the layout does not yet do. Each step is
independently shippable — take them in order, or take one.

---

## Shared context (read once, applies to every step)

Read `docs/architecture.md` first. It is the north star, and where it and the layout
disagree, **the layout is what changes**. Deviating is allowed but must amend
docs/architecture.md in the same PR.

Current shape, measured 2026-07-31 at `efa8532`:

| Directory | Files | Holds |
| --- | --- | --- |
| `knowledge/` | 104 | agent knowledge, 13 domain folders each with `README.md` |
| `business/` | 124 | what a launch produces |
| `starters/` | 161 | runnable app scaffolds |
| `validation/business/` | 55 | proves a **business launch**, mirrors playbook domains |
| `validation/repository/` | 165 | proves the **skill itself** — validators, evals, fixtures, harness |
| `tooling/` | 25 | everything executable that is neither, plus `lib/` |

**The placement rule, already settled and documented:** `validation/business/` grades a business
launch; `validation/repository/` grades the skill itself — judged by the **subject of the
assertion, not the root flag a validator takes**. Cross-cutting launch-method
gates go to `validation/business/process/`. There is no top-level exception bucket.

**Nothing may hardcode a script's directory.** `tooling/lib/script-paths.ts`
resolves a spawnable script by basename across `validation/business/`, `validation/repository/` and
`tooling/`, and **throws** on unknown or ambiguous. Use `resolveScriptPath` when
about to spawn, `findScriptPath` when a miss should become a reported issue.

### Bar for done (every step)

```bash
npm run audit:ci          # 70 ok, 0 failed, 1 skipped
npm run test:validators   # 718 passed, 0 failures
npx tsc --noEmit          # clean
npm run lint:format       # clean
```

If a step **adds a gate**, the audit count moves to 71 and the fixture count
rises. That is expected — state the new numbers and why in the PR body rather
than trying to hold the old ones.

### Ship it (every step)

Bump the minor version in `skill-version.json` (needs **≥2** concrete release
notes), both `package.json`, and both `package-lock.json`. Branch, PR, merge —
direct pushes to `main` are rejected by a ruleset requiring the `audit` check.
After merge, `npm run sync:runtime` (audits first, then rsyncs with `--delete`;
allow >10 minutes, run it in the background, and do not edit the working tree
while it runs — it reads the tree it is about to ship).

**Merge gotcha:** the ruleset sets `required_review_thread_resolution: true`.
The Codex bot opens review threads on every push and `gh pr merge` will only say
"base branch policy prohibits the merge" — it never mentions threads. When a
merge is refused despite green CI, list them:

```bash
gh api graphql -f query='{repository(owner:"Emuthmartinez",name:"b2c-mobile-business-launch-skill"){pullRequest(number:NN){reviewThreads(first:30){nodes{id isResolved path comments(first:1){nodes{body}}}}}}}'
```

Fix what they raise, then resolve each with `resolveReviewThread`. Expect a fresh
round after each push.

### Traps this repo has already produced — do not rediscover them

1. **Tooling globs are the silent killers of any move — check them FIRST.**
   `tsconfig.json` `include` and the prettier `lint:format` **and** `format`
   globs (6 places across both `package.json` + both `tsconfig.json`) enumerate
   directories by name. After the v0.55.0 move they would each have covered
   **zero** of 61 moved files while `audit:ci` still printed *70 ok*.
2. **A regex that stops MATCHING is worse than one that errors.** Never
   `continue` on a failed path parse — that is how a gate becomes a no-op that
   still exits 0.
3. **The same trap recurs one move later.** After fixing one path assumption in
   a file, grep that file for its *other* path assumptions. `check-package-parity`
   was fixed twice, one release apart, for the same class of bug.
4. **A move can silently EXPAND a gate, not just break it.** Moving files into
   `validation/repository/` pulled 129 of them into `check-reference-size`. Preserve current
   scope; expanding a gate as a side effect of a move is not a decision anyone
   made. `NON_KNOWLEDGE_DIRS` in `validation/repository/check-reference-size.ts` is the
   existing precedent.
5. **`path.join(a,"b","c")` is invisible to an `"a/b/c"` search.** Grep the bare
   quoted segment too.
6. **A path rewrite must distinguish a path segment from an identifier.**
   `"launchbench"` in `audit-plan.ts` is an npm *script name*; `"fixtures"` in
   `script-paths.ts` is a `NOT_SPAWNABLE` set member; a blanket `"templates"` →
   `"business"` once renamed a JSON *schema property* and every generated board
   failed validation with an error that read like a renderer bug.
7. **Grepping one idiom finds most, not all.** 17 of 19 script-dir resolutions
   used `path.resolve(scriptDir, "..")`; two inlined `import.meta.url`, one via
   `new URL(...).pathname`. Verify by resolving every candidate against the
   filesystem, not by eye.
8. **Folder names must survive `.gitignore`.** `knowledge/build/` was untracked
   through a whole CI run. Run `git check-ignore -v` on any new directory name;
   `dist`, `build`, `tmp`, `out`, `target` are landmines.
9. **A fixture asserting only exit 1 passes by crashing.** Assert the issue code.
10. **Text matching against markdown must use forward slashes**, not whatever
    `path.join` produced — otherwise green on macOS, broken on Windows.
11. **Prove the gate BITES.** Re-pointing a glob is not evidence. Break an import
    in the new location and confirm `tsc` fails; append an unformatted line and
    confirm prettier flags it.
12. **Workflow sub-agents observing a mid-refactor tree report confidently wrong
    things.** Establish ground truth with `git status` before trusting a sweep.

---

## Step 6 — `check-gates-layout.ts`: make the layout self-defending — **DONE, v0.57.0**

**Why first:** it is small, it is the only step that *prevents* future drift, and
every later step moves files past the rule it enforces.

Nothing currently stops a new `validation/business/check-foo.ts` landing at top level or in the
wrong domain. Worse: a **flat** `validation/business/` made duplicate basenames structurally
impossible (one directory cannot hold two files of the same name); the mirrored
layout does not. `script-paths.ts` throws on ambiguity, but only at spawn time —
a backstop, not a gate.

Add `skill/b2c-mobile-business-launch/validation/repository/check-gates-layout.ts` asserting:

1. Every `validation/business/**/*.ts` sits in a directory whose name is one of the playbook
   domains — **read the domain list from `knowledge/` itself**, never hardcode it,
   so the two trees cannot drift.
2. No `.ts` file sits directly at `validation/business/` top level (the no-exception-bucket rule).
3. No basename appears twice across `validation/business/`, `validation/repository/` and `tooling/`. Reuse
   `indexScripts()` from `tooling/lib/script-paths.ts` — it already detects this
   and throws; the gate should catch and report it as a normal issue.

Wiring (all of it, or `check:package-parity` fails): npm script `check:gates-layout`
in **both** `package.json` files, a step in `tooling/lib/audit-plan.ts`, an entry in
`knownValidators` in `validation/repository/run-launchbench.ts`, and at least one passing and one
**failing** fixture in `validation/repository/fixtures/repo-gates.fixtures.ts` asserting the issue
code.

Expect `audit:ci` → **71 ok**.

---

## Step 7 — the validators with arguable homes — **DONE, v0.57.0**

Left alone during steps 4–5 because none is a `check-*.ts`. Placed in v0.57.0
by the subject-of-the-assertion rule:

| File | Grades | Argues for |
| --- | --- | --- |
| `tooling/audit-skill-links.ts` | the skill's own markdown links + orphans | `validation/repository/` |
| `tooling/refresh-source-freshness.ts` | the source registry | `validation/repository/` |
| `tooling/validate-project-state.ts` | a business repo's PROJECT_STATE | `validation/business/process/` |
| `tooling/validate-state.ts` | a business repo's design state | `validation/business/design/` |

Apply the settled rule (subject of the assertion). Note `validate-project-state.ts`
is in `knownValidators` and is spawned by fixtures **by basename**, so
`script-paths.ts` already handles it — but `check-package-parity`'s
`requiredScriptNames` filters on `validate:` prefixes, so re-read that function
before moving.

Small step. Good warm-up. Do it after step 6 so the new layout gate covers the moves.

---

## Step 8 — HTML is generated, never authored

docs/architecture.md: *"Every page in `business/` renders from `state/`. Hand-authored
HTML twins go stale silently with no signal."*

Eight HTML files sit at `business/` root. **None carries a generated-by marker.**
Four have a Markdown twin:

| HTML | Markdown twin |
| --- | --- |
| `business/design/design-room.html` | `knowledge/design/design-room.md` |
| `business/design/design.html` | `business/design/DESIGN.md` |
| `business/product/onboarding.html` | `business/product/ONBOARDING.md` |
| `business/operations/orchestration.html` | `business/operations/ORCHESTRATION.md` |
| `business/analytics/analytics-plan.html` | none |
| `business/state/launch-cockpit.html` | none (rendered by `render-launch-cockpit.ts`) |
| `business/trust/security-review.html` | none |
| `business/store/store-console.html` | none |

The work: for each, establish whether it is rendered or hand-authored. Where
rendered, add a generated-by header and a gate that fails if it drifts from its
source. Where hand-authored and duplicating a Markdown source, delete it and
render it instead. `render-launch-cockpit.ts` and `render-design-room.ts` are the
existing pattern to follow.

**This step must ship a gate**, or it re-rots. Something like
`check:generated-pages` proving every `business/**/*.html` is reproducible from
`state/` — this repo's model is prove-don't-attest, and a prose rule here is
exactly the "words not work" failure the audit history keeps re-finding.

---

## Step 9 — merge the duplicate clusters

docs/architecture.md: *"Merge duplicates as you move, in the same commit. Moving
duplicated content into a tidy folder gives the duplication a nicer address."*
The move happened; the merge did not. Two clusters remain.

**Emotional design — 138,038 bytes across four files:**

```
knowledge/experience/emotional-design-system.md          42,051 B
knowledge/experience/emotional-experience-measurement.md 37,557 B
knowledge/experience/emotional-experience-design.md      29,617 B
business/product/experience/emotional-design/EMOTIONAL_DESIGN.md           28,813 B
```

docs/architecture.md says these restate the same citations. Read all four before
deciding shape. Note the first three are all in one playbook domain and the
fourth is a founder artifact — that boundary is real and should survive the
merge. `check-reference-size`'s budget is 64KB/file, so a naive concatenation
of the three playbook files would **break the budget** and need an index split.

**Twelve experience cards** in `knowledge/experience/experience-cards/`, indexed by
`experience-cards.md`. docs/architecture.md calls them "twelve near-identical card
files". Determine whether the near-identity is boilerplate worth extracting into
the index, or genuine per-card content. **Do not collapse them blindly** — the
deck was deliberately split out of a ~200KB single file, and `check-reference-size`
enforces that split.

Related open decision, still unresolved in docs/architecture.md: whether the twelve
technique names get plain-language founder equivalents or stay internal labels
behind one umbrella term. Settle it here or explicitly defer it again.

---

## Step 10 — `spine.md` and the `SKILL.md` collapse

docs/architecture.md's target layout names two things that do not exist yet:

```
SKILL.md      routing only — target ≤ 12KB, not 46KB
spine.md      the ordered walk through a launch; stages live here
```

`SKILL.md` is **22,698 bytes** today — already down from 46,975, but still
~10.7KB over target. `spine.md` **does not exist**; the stage sequence is still
prose inside `SKILL.md`.

The two are one job: extracting the ordered walk into `spine.md` is what pays for
the `SKILL.md` reduction. docs/architecture.md's rule is freeze-and-subtract — a new
entrypoint row is paid for by compressing or relocating existing text, never by
raising the ceiling.

Measured precedent from the store domain: collapsing nine verbose routing rows
into three index-pointing rows freed **2,787 bytes** while the folder move cost
120. The entrypoint's fullness is detail living too high, not a budget problem.

`validation/repository/check-reference-size.ts` holds `ENTRYPOINT_BUDGET_BYTES = 45 * 1024`.
**Ratchet it down** as `SKILL.md` shrinks — that is stated policy in the file's
own comment, and leaving it at 45KB after a reduction silently re-opens the
headroom the collapse just bought.

---

## Step 11 — the open decisions

Two remain in docs/architecture.md's "Open decisions". Both need the founder, not an
agent, and neither blocks the steps above.

- **The name.** The root directory is named for the product. Renaming costs a
  one-time sync across `~/.codex/skills/`, `~/.claude/skills/`, `~/.agents/skills/`
  plus `skill-version.json`. Deferred until the name is chosen, not blocked on it.
- **Card and technique naming** — see step 9.

---

## What to do first

Step 6. It is the smallest, it is the only one that prevents drift rather than
creating it, and every later step moves files past the rule it enforces.
