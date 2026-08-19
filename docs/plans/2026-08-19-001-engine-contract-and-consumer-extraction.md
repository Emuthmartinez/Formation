# Engine contracts and consumer extraction

- Date: 2026-08-19
- Status: in execution (A1 shipping as v0.149.0); founder decisions recorded 2026-08-19
- From: v0.148.0 (PRs #184–#190 merged; the engine bootstraps, runs, verifies, recurs, schedules, and exposes the `formation` CLI and `formation-mcp`)

## North star

Formation is one product: a typed workflow-graph engine that takes a consumer-app business from idea to shipped and into standing autonomous operation. This repository ships the engine and only the engine.

A user with any coding-agent tool installs one artifact and gets three addresses — the skill, the `formation` CLI, the `formation-mcp` server — at one version. They run `formation setup` once, `formation doctor` to verify the ground, `formation new` to give a business a birthplace. Updates are explicit and per-business: a newer engine never silently changes a running operator. The catalog is managed like source, consumed as a compiled artifact, and varied by composition (scope verdicts, profiles, packs) — never by mutation. Every consumer lives in its own repository and binds to published contracts, never to this tree.

The layers:

| Layer | What | Lives |
| --- | --- | --- |
| L0 content | `catalog/` + `knowledge/` | this repo |
| L1 kernel | `core/` — compiler, frontier, reducer, sessions, autonomy, verification | this repo |
| L2 gates | `validation/`, `verification/`, the audit, `check:engine-e2e` | this repo |
| L3 addresses | SKILL.md routing, CLI, MCP, consumer front doors | this repo, same version |
| L4 consumers | platform UI, future UIs, third-party stacks | separate repos, contract-bound |

L0–L2 stay together because five gates already enforce their co-evolution in every commit. L3 stays because addresses share the kernel's owner and trust domain. L4 never lives in this repository.

The four contracts: **A** the adapter (boundary report, execution request, approval sync, import plan — schemas + `contractVersion` + golden-sample gate); **B** the MCP tool surface (+ registry allowlist, founder-authority assertion, read-only mode); **C** the CLI (subcommands, exit codes, digest files — documented); **D** the workspace on-disk layout (the 8 existing state schemas, named as the on-disk API).

## Requirements

Each is testable and lands with its enforcement; the satisfying phase is named.

1. **R1** Contracts versioned and fail-closed: adapters emit `contractVersion` and validate their own output against generated schemas; shape change without a bump fails `check:adapter-contract`. *(A1)*
2. **R2** No consumer reads the tree: projections out, typed requests in; the platform repo's CI replays the same golden samples. *(A1, C)*
3. **R3** One artifact, three addresses: `npm pack` of the skill package works standalone, smoke-tested in `check:package-parity`. *(B)*
4. **R4** Updates explicit and per-business: `formation update` updates the engine; a workspace adopts a catalog only via its entrypoint install; drift is a named error. An e2e case proves a mid-journey re-pin. *(B)*
5. **R5** A fresh business is creatable from any address: `formation new <slug>` scaffolds from `workspace-template/` + an archetype starter. (Today `bootstrap` only migrates an existing workspace — a forwarded-repo user has no birthplace.) *(B)*
6. **R6** The machine knows its businesses: one registry (`~/.formation/workspaces.json`) backs the MCP allowlist, `formation list`, and traversal-impossible path resolution. The registry holds addresses only; business truth stays in reducer-owned documents. *(A2)*
7. **R7** Variance only by composition: scope verdicts (exists), named profiles (generalizing `launch_scope`), additive packs composed at compile time under the same validators. No mutation mechanism. *(E)*
8. **R8** Authoring scaffolded, gates untouched: `catalog add-workflow` generates the seed, manifest binding, fixture stubs, and every registration point (count fixture, validators.md, launchbench registry, port ledger, audit plan). *(E)*
9. **R9** Extraction preserves history and uptime: `git subtree split`; deploy-then-delete for the hosted instance. *(C)*
10. **R10** Docs describe reality at every phase: no unshipped command in README; target state lives only here and in the architecture doc's north-star section, labeled as target. *(D, continuous)*
11. **R11** Founder decisions explicit — the four below; none inferred from silence. *(gating)*
12. **R12** Worker-runtime honesty: the engine orchestrates the user's own agent CLIs — their subscriptions, their spend. `formation doctor` checks; README states it. *(B)*

## Phases

**A1 · v0.149.0 — slug fix + adapter contract.** Fix the open slug divergence (platform `slug()` underscores vs the adapter's hyphen rule; multi-word names break the handoff) while co-located, with regression tests on both sides. Generate `boundary-report`/`execution-request`/`import-plan` JSON Schemas from the TS types with a drift check (the catalog-projection discipline); adapters emit `contractVersion` and validate their own output fail-closed. New gate `check:adapter-contract` with golden samples, watched failing before first green; full registration chain.

**A2 · v0.150.0 — MCP hardening + workspace registry.** `~/.formation/workspaces.json` as the one registry; MCP tools resolve registered ids, never arbitrary paths. `asFounder: true` assertion on `formation_approvals`/`formation_schedule`, honestly documented. `FORMATION_MCP_READONLY=1` exposes only `formation_plan` and a new `formation_status`. Fixture cases: allowlist refusal, missing-assertion refusal, read-only tool list.

**B · v0.151.0 — publishability + consumer front doors.** `npm pack` standalone (files manifest, pack smoke test); npm publish stays founder-gated, git-tag pinning meanwhile. Front doors: `formation setup`, `formation doctor`, `formation new <slug>`, `formation update`, `formation list`. The re-pin e2e case. README then documents the real journey end to end.

**C · Platform extraction (founder decisions 1–2).** C1: new repo via `git subtree split` with `platform/`, its AGENTS.md, and the six platform docs (direction banners removed there); vendored engine pin (`scripts/sync-engine.sh` + `check:engine-version`); CI replays the golden contract samples. C2: repoint and verify the hosted instance (launchd + CF tunnel) before deleting `platform/` here; strip platform sections from root docs; `core/adapters/` stays engine-side, proven by golden samples. The audit has no dependency on `platform/`.

**D · Docs finalization.** README/architecture: L0–L4 and the four contracts canonical; consumers link out. AGENTS/CLAUDE: one product plus external consumers; the standing rule verbatim: *L4 never lives in this repository.* CONTRIBUTING gains contract-version bump rules.

**E · Authoring & variance (parallel to C).** The `catalog add-workflow` scaffolder mirroring `knowledge:add`; named profiles generalizing `launch_scope`, validated by the same gates; packs as a design doc first, implementation when a real second pack exists — the compiler's ambiguous-write and unknown-dependency failures are the composition safety.

## What deliberately does not change

The catalog/knowledge/kernel/gates layout; the skill's install and runtime-sync channel; the audit and its registration chains; the five-file version discipline; stable catalog IDs as identity; no telemetry.

## Founder decisions — RECORDED 2026-08-19

1. **Create Formation-Platform, private** — approved. C1 proceeds when the sequence reaches it.
2. **Cutover ASAP once C1 verifies** — approved; deploy-then-delete ordering protects uptime.
3. **npm publish deferred** — git-tag pinning is the channel; publishing stays a named future item in the north star, revisited when a third-party consumer asks.
4. **Keep private for now** — no forwarding until the license posture is settled at the first external consumer.

## Risks

Hosted downtime → deploy-then-delete, founder-picked window. Schema drift → generated with drift checks, hand-edits fail the audit. Front doors overpromising → each ships with cli-suite fixtures; README documents only shipped commands. Registry as second truth → addresses only. Profiles/packs forking semantics → same validators, additive-only. Slug migration → forward-only, no live underscore slugs exist. Cross-repo contract drift → both sides replay the same golden samples.
