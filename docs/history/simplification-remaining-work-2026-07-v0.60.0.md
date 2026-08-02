# Prompt: finish the simplification overhaul

> **Historical record. Written against v0.60.0 on 2026-07-31; the work it asks for is done.**
> Step 8 shipped as #87 (v0.61.0) — the same commit that added this file, so its "OPEN"
> table row was already false when it landed. Do not action anything below. It is kept because the *reasoning*
> is still worth reading: why the two starter stubs must not be generated, why
> declare-and-verify was rejected as self-attestable, and the numbered trap list that
> every later refactor in this repo has kept paying for.
>
> The only item it leaves genuinely open is step 11, the product name, which is a
> founder decision and not an agent task. For current state see
> [`ARCHITECTURE.md`](../../ARCHITECTURE.md); for the maintainer map see
> [`AGENTS.md`](../../AGENTS.md).

Paste into a fresh session in `/Users/eduardomuthmartinez/code/b2c-mobile-business-launch-skill`.

## Where this stands

`main` is at **v0.60.0**. The installed runtime at `~/.codex/skills/b2c-mobile-business-launch`
is synced to v0.60.0 and audits clean (71 ok, 0 failed, 0 skipped).

ARCHITECTURE.md's migration is complete and its follow-on work is mostly done:

| Step | State |
| --- | --- |
| 1–5 directory migration | **done** v0.52.0–v0.56.0 |
| 6 `check:gates-layout` | **done** v0.57.0 |
| 7 arguable-home validators + `skill-version.json` decision | **done** v0.57.0 |
| 9 duplicate clusters + failure-card taxonomy | **done** v0.59.0, v0.60.0 |
| 10 `spine.md` + SKILL.md | **half done** v0.58.0 — see "Do not reopen" |
| **8 generated pages** | **OPEN — this is the work** |
| 11 product name | founder-only, not an agent task |

### Bar for done

```bash
npm run audit:ci          # 71 ok, 0 failed, 1 skipped
npm run test:validators   # 724 passed, 0 failures
npx tsc --noEmit          # clean
npm run lint:format       # clean
```

Adding a gate moves those numbers. That is expected — state the new numbers and why
in the PR body rather than trying to hold the old ones.

### Ship it

Bump the minor version in `skill-version.json` (needs **≥2** concrete release notes),
both `package.json`, both `package-lock.json`. Branch, PR, merge — direct pushes to
`main` are rejected by a ruleset requiring the `audit` check. After merge run
`npm run sync:runtime` in the background (audits first, then rsyncs with `--delete`;
>10 minutes; **do not edit the working tree while it runs** — it reads the tree it is
about to ship), then confirm with `npm run audit` from
`~/.codex/skills/b2c-mobile-business-launch`.

**Merge gotcha:** the ruleset sets `required_review_thread_resolution: true`. The Codex
bot opens threads on every push and `gh pr merge` only says "base branch policy prohibits
the merge" — it never mentions threads. When a merge is refused despite green CI:

```bash
gh api graphql -f query='{repository(owner:"Emuthmartinez",name:"b2c-mobile-business-launch-skill"){pullRequest(number:NN){reviewThreads(first:30){nodes{id isResolved path comments(first:1){nodes{body}}}}}}}'
```

Fix what they raise, then `resolveReviewThread` each. Expect a fresh round per push.
Codex has been right every time this session, including two P1-worthy catches.

---

## Step 8 — generated pages

**This is not a tidiness refactor.** Reading the four hand-authored pages against their
own Markdown sources found real defects in shipped founder artifacts:

- **`security-review.html`** — ~10 of ~15 sections absent (Auth/Authz, Backend/API
  controls, revenue abuse, Accepted Risks). **Its own lede claims to cover them.**
- **`store-console.html`** — missing the actual click-path table, the Apple pre-ASC
  compliance row (PrivacyInfo.xcprivacy, ATT, account deletion), and the entire 7-item
  App Review checklist. That is **Guideline 2.1 rejection-risk content missing from a
  launch artifact.**
- **`onboarding.html`** — Push Permission Prime entirely absent; the Personalization
  step's content is **silently overwritten by Attribution content**.
- **`orchestration.html`** — missing Session Continuity, CE routing, Subagent
  Instructions, Verification, Failure Cards; and contains a **fabricated
  `state-integration` table row** that was never real data.

Generating these is a strict upgrade on three of four. Fixing the content bugs is the
point; the dedup is the mechanism.

### The eight pages, classified

| File | Kind | Action |
| --- | --- | --- |
| `design-room.html` | rendered by `scripts/render-design-room.ts` | leave |
| `launch-cockpit.html` | rendered by `scripts/render-launch-cockpit.ts` | leave |
| `design.html` (332 B) | **starter stub** — "Render the canonical Design Room from state before replacing this starter" | declare, do not generate |
| `analytics-plan.html` (387 B) | **starter stub** — "Replace with rendered … once the live services are reporting real data" | declare, do not generate |
| `onboarding.html` | authored ← `business/ONBOARDING.md` | generate |
| `orchestration.html` | authored ← `business/ORCHESTRATION.md` | generate |
| `store-console.html` | authored ← `business/STORE_CONSOLE.md` | generate |
| `security-review.html` | authored ← `business/SECURITY.md` | generate |

The two stubs are **deliberate pre-launch placeholders** whose real content only exists
after a launch produces it. Generating them from a plan document would be wrong. Do not
be talked into "generate all eight" by the filename symmetry.

### Build order — the parser first, alone

`scripts/lib/markdown-lite.ts` is the only genuinely new piece; everything else copies a
proven pattern. Build and prove it **in isolation** before writing the renderer, manifest,
gate or any wiring. Feed it literal excerpts from the four real documents:

- `business/ONBOARDING.md` Screen Sequence table
- `business/ORCHESTRATION.md` fenced code block + Candidate Units table
- `business/STORE_CONSOLE.md` ordered App Review checklist
- `business/SECURITY.md` Data Classification table

Only once it round-trips all four does the rest become mechanical assembly.

**Do not add a markdown npm dependency.** The four sources use a small enumerable subset
— headings to H3, one optional status line, tables, flat lists, one ordered list, bold,
inline code, one fenced block. A ~200-line hand-rolled parser avoids the cross-`package.json`
dependency-parity risk this repo has been bitten by (dependabot splits dep-group PRs by
root and `check:package-parity` makes each half red).

### The rest

1. `scripts/lib/render-artifact-page.ts` — shared page shell + escaping.
2. `scripts/render-artifact-pages.ts` — reads a manifest of `{markdown → html}` pairs,
   renders each. Supports `--check`.
3. The manifest — declares every `business/*.html` as exactly one of
   `rendered-by:<script>` / `starter-stub` / `authored-from:<markdown>`.
4. `gates/process/check-generated-pages.ts` — it grades a business launch's artifacts, so
   `gates/`, and it is cross-cutting, so `process/`.

**Copy the `--check` mechanics verbatim from `scripts/render-business-control-plane-workspace.ts:156-179`.**
It computes the full output in memory, then on `--check` compares byte-for-byte against
disk, emitting `.output.missing` when the file is absent and `.output.drift` when it
differs. That is the only existing check-mode pattern in the repo.

The gate must assert all three, or it can pass vacuously:
- every `business/*.html` appears in the manifest (catches a new page added with no provenance)
- every manifest entry's file exists (catches a deleted page)
- every `authored-from` page byte-matches a fresh render (catches drift)

Output must be **deterministic** — no timestamps, no filesystem-iteration ordering.

### Wiring, all of it or `check:package-parity` fails

npm script `check:generated-pages` in **both** `package.json` files · a step in
`scripts/lib/audit-plan.ts` · an entry in `knownValidators` in
`machine/run-launchbench.ts` · a **failing** fixture per issue code in
`machine/fixtures/repo-gates.fixtures.ts`.

### One accepted downgrade, already decided

`orchestration.html` loses its 3-chip "traffic light" status dashboard. Synthesizing those
labels needs bespoke per-page logic bolted onto a generic renderer, which fights
"simplified". Trade: slightly less glanceable, in exchange for 7 restored sections and the
removal of fabricated content. Say this in the PR body rather than hiding it.

### Do NOT

- Do not build the rejected "declare-and-verify" shape (hash-and-anchor without
  regeneration). It is **self-attestable** — it proves someone touched the file, not that
  the HTML is right — and it would permanently grandfather the four content bugs above
  behind a green gate.
- Do not refactor the three duplicated `escapeHtml` copies
  (`render-launch-cockpit.ts:24`, `render-design-room.ts:266`,
  `lib/founder-gate-presentation.ts:69`) in this PR. Real cleanup, separate review.
- Do not add a freshness gate for `launch-cockpit.html` here — it genuinely lacks one, but
  it is not a Markdown-paired page and bolting it on inflates review surface.
- Do not fabricate mockup content (fake mascot art, video embeds) to satisfy
  `onboarding.html`'s `artifact-contracts.md` must-include list. Render an honest
  "not yet designed" placeholder from state instead.
- Do not change any of the eight filenames. Four are evidence paths in
  `business/PROJECT_STATE.yaml` and the set carries **194 references repo-wide**.

---

## Do not reopen

**SKILL.md is done for now.** It is 20,057 B against a
`machine/check-reference-size.ts` `ENTRYPOINT_BUDGET_BYTES` of 20,480 B — **423 bytes of
headroom.** The old 12KB target was retired deliberately: it was written when the file
was 46,975 B, and reaching it would mean halving Lane Routing (already collapsed to 15
index rows at ~246 B each, no slack) or the always-on contracts. The ratchet now makes
the current size a floor rather than a drifting target. Any addition must be paid for by
subtraction in the same commit.

**Start Here items 4–6 are not the next cut.** They look like routing duplicates of the
operations and trust rows. They are not: Lane Routing indexes the *reference*, Start Here
carries the *trigger* ("before any API key, token, OAuth credential, webhook signing
secret, or local `.env`"). Collapsing them lets an agent touch a credential without
loading secrets management.

---

## Traps this repo has produced — do not rediscover them

1. **Tooling globs are the silent killers of any move — check them FIRST.**
   `tsconfig.json` `include` and the prettier `lint:format` **and** `format` globs
   (6 places across both `package.json` + both `tsconfig.json`) enumerate directories by
   name. After the v0.55.0 move they would each have covered **zero** of 61 moved files
   while `audit:ci` still printed *70 ok*.
2. **A regex that stops MATCHING is worse than one that errors.** Never `continue` on a
   failed path parse — that is how a gate becomes a no-op that still exits 0.
3. **The same trap recurs one move later.** `check-package-parity` was fixed twice, one
   release apart, for the same class of bug — the second time at its *file-locate* line
   after the first fix landed inside its loop. After fixing one path assumption in a file,
   grep that file for its others.
4. **A move can silently EXPAND a gate, not just break it.** Moving files into `machine/`
   pulled 129 of them into `check-reference-size`. `NON_KNOWLEDGE_DIRS` is the precedent
   for preserving scope.
5. **When routing content OUT of an entrypoint, the new load trigger must fire for the
   audience the content serves.** v0.58.0 gated the non-Claude-Code protocol behind
   "before proposing or running a workflow" — but Codex cannot run workflows, so the
   trigger never fired for the only runtime it existed for. No gate could catch this;
   Codex did. It is now pinned as `required_terms` in
   `machine/evals/triggering/autopilot-triggering.yaml`.
6. **`required_terms` are matched against raw text and SKILL.md is hard-wrapped** — a term
   spanning a line break fails on reflow alone rather than on meaning.
7. **`path.join(a,"b","c")` is invisible to an `"a/b/c"` search.** Grep the bare segment.
8. **A path rewrite must distinguish a path segment from an identifier.** `"launchbench"`
   in `audit-plan.ts` is an npm *script name*; a blanket `"templates"` → `"business"` once
   renamed a JSON *schema property*.
9. **Anchor content edits on headings, never line numbers.** The first edit shifts every
   subsequent line; a plan expressed as line ranges cuts the wrong content from file two
   onward.
10. **Verify pointer targets against real headings.** Writing "§5 Non-Negotiable
    Prohibitions" when §5 is actually "Guardrail Contract" makes a pointer worse than the
    duplication it replaced.
11. **A fixture asserting only exit 1 passes by crashing.** Assert the issue code.
12. **Prove the gate BITES.** Re-pointing a glob is not evidence. Break something and
    confirm the gate fails, then restore.
13. **Folder names must survive `.gitignore`** — `git check-ignore -v` before committing
    to a name. `dist`, `build`, `tmp`, `out`, `target` are landmines.
14. **Workflow sub-agents observing a mid-refactor tree report confidently wrong things.**
    Establish ground truth with `git status` before trusting a sweep.

---

## First step

Write `scripts/lib/markdown-lite.ts` and prove it against literal excerpts from all four
real documents. Nothing else until it round-trips them.
