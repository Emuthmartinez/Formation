# Technical Documentation In Simplified Technical English (ASD-STE100)

Use this before writing or editing `docs/architecture.md`, `docs/validators.md`, this skill's own `README.md` or `SKILL.md`, any `knowledge/*.md` reference file, an engineering spec (`engineering/TECH_SPEC.md`, `engineering/ENGINEERING_PLAN.md`, `engineering/PRODUCTION_READINESS.md`), an ADR, a runbook, or an API/config reference inside this repository. This is the flat, literal register for documentation whose job is to be parsed correctly, not to persuade or entertain.

## 1. Boundary With `no-slop-writing.md` (Read First)

This repo already has one writing-quality standard: [`no-slop-writing.md`](../words/no-slop-writing.md). That file is voice-**preserving** — it cuts AI-slop filler but keeps the brand's or the skill's own character. ASD-STE100 is voice-**flattening** — one meaning per word, active voice, simple tense, short sentences, no idiom, no character. Applying both standards to the same sentence produces contradictory edits.

To avoid that collision, the two files split the repo's documentation by file, not by vague genre:

- `no-slop-writing.md` alone governs the repo's public front door: root `README.md`, `CONTRIBUTING.md`, `.github/SECURITY.md`, `.github/CODE_OF_CONDUCT.md`, root `AGENTS.md`, and root `CLAUDE.md` (its §2 "third surface," enforced by `check:no-slop`). Do not apply ASD-STE100 to these six files.
- This file alone governs the technical documentation named in the trigger line above.
- Founder-facing copy, marketing copy, and brand voice stay with `no-slop-writing.md` and its channel-specific sections — never apply ASD-STE100 there. ASD-STE100 explicitly does not cover text where voice, nuance, or persuasion is the point.

If a document straddles both — a `README.md` with a narrative introduction and a technical API section — apply `no-slop-writing.md` to the narrative part and this file to the technical part, the same split `no-slop-writing.md` §8 uses for legally required text inside persuasive copy.

## 2. Scope

This file governs technical, procedural, and reference documentation authored inside this repository: architecture docs, validator/gate references, this skill's own knowledge base, engineering specs, ADRs, runbooks, and API or config references. It does not extend to documentation this engine generates for a launched business (that business's own `engineering/TECH_SPEC.md`, `AGENTS.md`, and so on) — that is a separate, later decision, not covered here.

## 3. Core Rewrite Rules

Full rule set and worked examples: the `asd-ste100` skill (`~/.claude/skills/asd-ste100/SKILL.md` on a maintainer machine). This table is the condensed version for day-to-day drafting.

| Rule | Do | Don't |
|---|---|---|
| One word, one meaning | Pick one verb for one action and reuse it every time | Rotate synonyms for the same idea ("check" / "verify" / "confirm") |
| Active voice | "The gate blocks the merge." | "The merge is blocked (by the gate)." |
| Simple tenses only | "The validator read the file." | "The validator has read the file." |
| One instruction per sentence | "Open the file. Read line 3." | "Open the file and read line 3, then check if it matches." |
| Sentence length | Keep instructions and procedures at 20 words or fewer | Long compound or subordinate-clause sentences |
| Noun clusters | 3 words or fewer stacked as a noun phrase | 4 or more words stacked ("catalog reference graph node loadWhen trigger text") |
| No ellipsis | Keep the subject, verb, and article explicit | Drop words to save space |
| Lists for sequences | Use a numbered or bulleted list for 3 or more steps | Bury a sequence inside one prose sentence |
| Domain terms | Keep necessary technical nouns, but define an unfamiliar one on first use | Use jargon without ever defining it |

## 4. Self-Check Before Committing

- Does every sentence have one reading, not two?
- Does every verb use active voice and a simple tense?
- Is every instruction sentence 20 words or fewer?
- Would a reader outside this repo's context still parse each sentence correctly on the first read?
- Did the edit keep every fact, condition, and scope qualifier from the original — no silently dropped precision?

If a rewrite would drop required precision (a safety condition, a scope qualifier, a number), keep the longer phrasing and note why, rather than cutting it to hit the word count.

## 5. What This Does Not Govern

- Founder-facing copy, marketing copy, and brand voice — `no-slop-writing.md`.
- The repo's public front door (root `README.md`/`CONTRIBUTING.md`/`.github/SECURITY.md`/`.github/CODE_OF_CONDUCT.md`/`AGENTS.md`/`CLAUDE.md`) — `no-slop-writing.md` §2.
- Code comments — normal engineering documentation standards, per `no-slop-writing.md` §8.
- Legally required text (privacy policy, terms, disclosures) — `privacy-terms.md`.

## 6. Enforcement Status

Reference-only today: every workflow node whose `loadWhen` covers the files in §2 loads this file before drafting. There is no mechanical linter yet — most ASD-STE100 rules (tense, active voice, noun-cluster length) are not reliable regex checks the way `no-slop-rules.ts`'s banned-word list is. A follow-up could extend `check:no-slop`'s existing markdown-parsed rig with a cheap ASD-STE100 subset (sentence-length count, banned present-perfect/passive markers) once this reference has been live long enough to show whether reference-only discovery is sufficient on its own.
