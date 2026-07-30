import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Harness, skillRoot } from "./_harness.js";

/**
 * Fixtures for check:app-copy — the gate that keeps internal vocabulary and
 * placeholder filler off a user's screen. Each failing path gets a fixture so
 * a regression that makes the gate always-pass is caught by test:validators.
 */

const DECK_HEADER = [
  "# Copy Deck",
  "",
  "Status: authored 2026-07-29",
  "",
  "## Onboarding",
  "",
  "| Key | Screen / moment | Copy (source language) | Voice notes | Locale tier |",
  "| --- | --- | --- | --- | --- |",
];

/** The canonical non-onboarding surfaces, marked not applicable so a fixture can pass the surface-set check with one authored row. */
const NA_SURFACES = [
  "",
  "## Paywall",
  "",
  "Not applicable — this fixture app is free with no purchase surface.",
  "",
  "## Core loop",
  "",
  "Not applicable — single-screen fixture with no core loop yet.",
  "",
  "## Empty states",
  "",
  "Not applicable — the fixture's one screen always has content.",
  "",
  "## Errors",
  "",
  "Not applicable — the fixture performs no fallible operations.",
  "",
  "## Settings and dialogs",
  "",
  "Not applicable — the fixture ships no settings surface.",
];

const AUTHORED_BRIEF = [
  "# Copy Brief",
  "",
  "Status: authored 2026-07-29",
  "",
  "## Value proposition",
  "",
  "One small win a day, traced to the RESEARCH.md review-mining evidence rows.",
  "",
  "## Message hierarchy",
  "",
  "Primary promise: a streak you can watch grow. Benefits: quick check-ins, honest streaks, gentle recovery.",
  "",
  "## Voice and tone",
  "",
  "Second person, plain words, sentence case everywhere except proper nouns.",
  "",
  "## Voice-of-customer phrase bank",
  "",
  "| Their words | Where it came from | Cluster |",
  "| --- | --- | --- |",
  "| I always fall off after a week | review mining | problem |",
  "",
  "## Per-surface copy blocks",
  "",
  "Landing hero: Small wins, every day. Store subtitle: One small check-in a day.",
  "",
  "## Claims ledger",
  "",
  "| Claim | Where it appears | Substantiation |",
  "| --- | --- | --- |",
  "| none shipped | n/a | no quantified claims at launch |",
  "",
].join("\n");

function stateWith(phase: string, lanes: Record<string, string>): string {
  const laneLines = Object.entries(lanes).flatMap(([lane, status]) => [`  ${lane}:`, `    status: "${status}"`, "    evidence:", '      - "COPY_DECK.md"']);
  // project.phase is the canonical path — the same one the gate reads. A fixture
  // inventing its own path would mask a path regression (it did once).
  return ["project:", `  phase: "${phase}"`, "lanes:", ...laneLines, ""].join("\n");
}

export function register(h: Harness): void {
  const { makeFixture, runFixture } = h;

  // Placeholder filler in an authored deck fails: the row exists, the words were never written.
  const deckPlaceholder = makeFixture("app-copy-deck-placeholder");
  writeFileSync(path.join(deckPlaceholder, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(deckPlaceholder, "COPY_DECK.md"),
    [...DECK_HEADER, "| onboarding.promise.headline | Promise | Product-specific value promise | | 1 |", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: placeholder cell in authored deck fails", deckPlaceholder, "check-app-copy.ts", 1, "app_copy.deck_placeholder");

  // Internal vocabulary in a copy cell fails; the deck-local allowlist clears a product-owned word.
  const deckVocabulary = makeFixture("app-copy-deck-vocabulary");
  writeFileSync(path.join(deckVocabulary, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(deckVocabulary, "COPY_DECK.md"),
    [...DECK_HEADER, "| onboarding.promise.headline | Promise | Your spec is ready to review | | 1 |", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: internal vocabulary in deck cell fails", deckVocabulary, "check-app-copy.ts", 1, "app_copy.deck_internal_vocabulary");

  const deckAllowlisted = makeFixture("app-copy-deck-allowlisted");
  writeFileSync(path.join(deckAllowlisted, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(deckAllowlisted, "COPY_DECK.md"),
    [
      "# Copy Deck",
      "",
      "Status: authored 2026-07-29",
      "",
      "## Allowed terms",
      "",
      "- Lane — this rowing app's own word for a training track",
      "",
      "## Onboarding",
      "",
      "| Key | Screen / moment | Copy (source language) | Voice notes | Locale tier |",
      "| --- | --- | --- | --- | --- |",
      "| onboarding.promise.headline | Promise | Pick your lane and row | | 1 |",
      ...NA_SURFACES,
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(path.join(deckAllowlisted, "COPY_BRIEF.md"), AUTHORED_BRIEF, "utf8");
  // The copied template ONBOARDING.md names prefixes this one-row deck cannot
  // cover; the fixture pins the allowlist behavior, so its screen table
  // references only the covered prefix.
  writeFileSync(
    path.join(deckAllowlisted, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy (from `COPY_DECK.md`) | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding.promise.*` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: deck-local allowlist clears a product-owned word", deckAllowlisted, "check-app-copy.ts", 0);

  // A one-row deck wearing authored status fails coverage reconciliation when
  // the screen table names prefixes it never authored.
  const deckIncomplete = makeFixture("app-copy-deck-incomplete");
  writeFileSync(path.join(deckIncomplete, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(deckIncomplete, "COPY_DECK.md"),
    [...DECK_HEADER, "| onboarding.promise.headline | Promise | Small wins, every day | | 1 |", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: authored deck missing referenced surfaces fails coverage", deckIncomplete, "check-app-copy.ts", 1, "app_copy.deck_coverage_missing");

  // Copy-pasted deck keys collide in the string resources.
  const deckDuplicate = makeFixture("app-copy-deck-duplicate-key");
  writeFileSync(path.join(deckDuplicate, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(deckDuplicate, "COPY_DECK.md"),
    [
      ...DECK_HEADER,
      "| onboarding.promise.headline | Promise | Small wins, every day | | 1 |",
      "| onboarding.promise.headline | Promise | A second promise | | 1 |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: duplicate deck key fails", deckDuplicate, "check-app-copy.ts", 1, "app_copy.deck_key_duplicate");

  // An unescaped literal pipe splits the row into six cells; the row is
  // reported as malformed instead of silently escaping validation.
  const deckMalformed = makeFixture("app-copy-deck-malformed-row");
  writeFileSync(path.join(deckMalformed, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(deckMalformed, "COPY_DECK.md"),
    [...DECK_HEADER, "| onboarding.promise.headline | Promise | Small wins | every day | | 1 |", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: malformed deck row is reported, not skipped", deckMalformed, "check-app-copy.ts", 1, "app_copy.deck_row_malformed");

  // Internal vocabulary in the ONBOARDING Copy column fails even without placeholders.
  const onboardingVocabulary = makeFixture("app-copy-onboarding-vocabulary");
  writeFileSync(path.join(onboardingVocabulary, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(onboardingVocabulary, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | Welcome to the launch lane from the spec | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "App copy: internal vocabulary in ONBOARDING Copy column fails",
    onboardingVocabulary,
    "check-app-copy.ts",
    1,
    "app_copy.onboarding_internal_vocabulary",
  );

  // A raw identifier shown to a user fails; an ICU interpolation does not.
  const deckIdentifier = makeFixture("app-copy-deck-identifier");
  writeFileSync(path.join(deckIdentifier, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(deckIdentifier, "COPY_DECK.md"),
    [...DECK_HEADER, "| today.done.headline | After check-in | ONBOARDING_STEP_2 complete, day {count} | | 1 |", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: raw identifier in deck cell fails", deckIdentifier, "check-app-copy.ts", 1, "app_copy.deck_raw_identifier");

  // A done lane with no deck at all fails — the build would improvise labels from the spec.
  const deckMissing = makeFixture("app-copy-deck-missing");
  writeFileSync(path.join(deckMissing, "PROJECT_STATE.yaml"), stateWith("phase_2", { onboarding: "done" }), "utf8");
  rmSync(path.join(deckMissing, "COPY_DECK.md"));
  runFixture("App copy: missing deck with done lane fails", deckMissing, "check-app-copy.ts", 1, "app_copy.deck_missing");

  // A deck still declaring template status while lanes claim done was never authored.
  const deckTemplate = makeFixture("app-copy-deck-still-template");
  writeFileSync(path.join(deckTemplate, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  runFixture("App copy: template-status deck with done lane fails", deckTemplate, "check-app-copy.ts", 1, "app_copy.deck_still_template");

  // Live apps launched before this contract get warnings, not broken builds.
  const liveGrandfather = makeFixture("app-copy-live-grandfather");
  writeFileSync(path.join(liveGrandfather, "PROJECT_STATE.yaml"), stateWith("phase_6b", { design: "done" }), "utf8");
  writeFileSync(
    path.join(liveGrandfather, "COPY_DECK.md"),
    [...DECK_HEADER, "| onboarding.promise.headline | Promise | Product-specific value promise | | 1 |", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: live app downgrades findings to warnings", liveGrandfather, "check-app-copy.ts", 0, "app_copy.deck_placeholder");

  // The ONBOARDING.md Copy column is scanned — the original leak site.
  const onboardingPlaceholder = makeFixture("app-copy-onboarding-placeholder");
  writeFileSync(path.join(onboardingPlaceholder, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(onboardingPlaceholder, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | Product-specific value promise | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: placeholder in ONBOARDING Copy column fails", onboardingPlaceholder, "check-app-copy.ts", 1, "app_copy.onboarding_placeholder");

  // Engineering done without the string-externalization contract fails.
  const externalizationMissing = makeFixture("app-copy-externalization-missing");
  writeFileSync(path.join(externalizationMissing, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "done" }), "utf8");
  writeFileSync(path.join(externalizationMissing, "TECH_SPEC.md"), "# Technical Spec\n\nNo strings section.\n", "utf8");
  runFixture(
    "App copy: engineering done without externalization contract fails",
    externalizationMissing,
    "check-app-copy.ts",
    1,
    "app_copy.externalization_missing",
  );

  // The untouched template option menu ("Record the choice here.") is not a
  // chosen mechanism, even though it names every mechanism.
  const externalizationUnchosen = makeFixture("app-copy-externalization-unchosen");
  writeFileSync(path.join(externalizationUnchosen, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "done" }), "utf8");
  runFixture("App copy: untouched externalization option menu fails", externalizationUnchosen, "check-app-copy.ts", 1, "app_copy.externalization_missing");

  // No TECH_SPEC at all is the same failure as a spec without the contract.
  const externalizationNoSpec = makeFixture("app-copy-externalization-no-spec");
  writeFileSync(path.join(externalizationNoSpec, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "done" }), "utf8");
  rmSync(path.join(externalizationNoSpec, "TECH_SPEC.md"));
  runFixture("App copy: engineering done with no TECH_SPEC at all fails", externalizationNoSpec, "check-app-copy.ts", 1, "app_copy.externalization_missing");

  // A business repo that copied a starter and never ran the copy pass still
  // shows the fictional example brand in user-visible source — the tripwire.
  const brandShipped = makeFixture("app-copy-fictional-brand-shipped");
  writeFileSync(path.join(brandShipped, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  mkdirSync(path.join(brandShipped, "lib"), { recursive: true });
  writeFileSync(
    path.join(brandShipped, "lib", "strings.ts"),
    'export const strings = { landing: { headline: "Fernpath turns one small daily check-in into a streak" } } as const;\n',
    "utf8",
  );
  runFixture("App copy: fictional starter brand in business source fails", brandShipped, "check-app-copy.ts", 1, "app_copy.fictional_brand_shipped");

  // A screen-table row that lost a cell (unescaped pipe, missing column) moves
  // text out of the scanned Copy column — reported, never silently skipped.
  const onboardingMalformedRow = makeFixture("app-copy-onboarding-malformed-row");
  writeFileSync(path.join(onboardingMalformedRow, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(onboardingMalformedRow, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Product-specific value promise | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: malformed ONBOARDING screen row is reported", onboardingMalformedRow, "check-app-copy.ts", 1, "app_copy.onboarding_row_malformed");

  // A mistyped backticked key reference would match nothing in coverage and
  // point builders at a nonexistent key — reported as malformed.
  const onboardingBadRef = makeFixture("app-copy-onboarding-bad-key-ref");
  writeFileSync(path.join(onboardingBadRef, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(onboardingBadRef, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding.Promise.*` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: mistyped deck-key reference is reported", onboardingBadRef, "check-app-copy.ts", 1, "app_copy.onboarding_key_reference_malformed");

  // A single-segment wildcard (`paywall.*`) is a namespace reference — an
  // authored deck with no paywall rows must fail coverage for it.
  const paywallUncovered = makeFixture("app-copy-paywall-wildcard-uncovered");
  writeFileSync(path.join(paywallUncovered, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(paywallUncovered, "COPY_DECK.md"),
    [...DECK_HEADER, "| onboarding.promise.headline | Promise | Small wins, every day | | 1 |", ""].join("\n"),
    "utf8",
  );
  writeFileSync(
    path.join(paywallUncovered, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy (from `COPY_DECK.md`) | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding.promise.*` | visible |",
      "| Paywall | Convert | `paywall.*` | after value |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: uncovered paywall.* wildcard fails coverage", paywallUncovered, "check-app-copy.ts", 1, 'names "paywall" strings');

  // A legitimate key that contains a placeholder-ish namespace stays clean —
  // backticked spans are references, not prose the user reads.
  const placeholderKey = makeFixture("app-copy-placeholder-in-key-name");
  writeFileSync(path.join(placeholderKey, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(placeholderKey, "COPY_DECK.md"),
    [...DECK_HEADER, "| onboarding.email.placeholder | Email field | you@example.com | input hint | 1 |", ""].join("\n"),
    "utf8",
  );
  writeFileSync(
    path.join(placeholderKey, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy (from `COPY_DECK.md`) | State |",
      "| --- | --- | --- | --- |",
      "| Email | Collect email | `onboarding.email.placeholder` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: backticked key containing 'placeholder' stays clean", placeholderKey, "check-app-copy.ts", 0);

  // A deck declaring draft (or nothing) is unfinished by its own account.
  const deckDraft = makeFixture("app-copy-deck-draft-status");
  writeFileSync(path.join(deckDraft, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(deckDraft, "COPY_DECK.md"),
    [
      "# Copy Deck",
      "",
      "Status: draft",
      "",
      "## Onboarding",
      "",
      "| Key | Screen / moment | Copy (source language) | Voice notes | Locale tier |",
      "| --- | --- | --- | --- | --- |",
      "| onboarding.promise.headline | Promise | Small wins, every day | | 1 |",
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    path.join(deckDraft, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding.promise.*` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: draft-status deck with done lane fails", deckDraft, "check-app-copy.ts", 1, "app_copy.deck_status_unauthored");

  // The surface set is the contract: an authored deck that covers the
  // onboarding references but ships no error/empty-state/settings strings
  // fails until each surface has rows or an explicit not-applicable line.
  const deckSurfaceMissing = makeFixture("app-copy-deck-surface-missing");
  writeFileSync(path.join(deckSurfaceMissing, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(deckSurfaceMissing, "COPY_DECK.md"),
    [...DECK_HEADER, "| onboarding.promise.headline | Promise | Small wins, every day | | 1 |", ""].join("\n"),
    "utf8",
  );
  writeFileSync(path.join(deckSurfaceMissing, "COPY_BRIEF.md"), AUTHORED_BRIEF, "utf8");
  writeFileSync(
    path.join(deckSurfaceMissing, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding.promise.*` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: authored deck missing a required surface fails", deckSurfaceMissing, "check-app-copy.ts", 1, "app_copy.deck_surface_missing");

  // A brief left at template status while lanes claim done never got the
  // product's promise/voice authored — the deck has no voice source.
  const briefTemplate = makeFixture("app-copy-brief-still-template");
  writeFileSync(path.join(briefTemplate, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(briefTemplate, "COPY_DECK.md"),
    [...DECK_HEADER, "| onboarding.promise.headline | Promise | Small wins, every day | | 1 |", ...NA_SURFACES, ""].join("\n"),
    "utf8",
  );
  writeFileSync(
    path.join(briefTemplate, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding.promise.*` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: template-status brief with done lane fails", briefTemplate, "check-app-copy.ts", 1, "app_copy.brief_unauthored");

  // Engineering is the lane that types the strings — a done build with no
  // deck bypasses the contract even when design/onboarding were deferred.
  const engineeringNeedsDeck = makeFixture("app-copy-engineering-needs-deck");
  writeFileSync(path.join(engineeringNeedsDeck, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "done" }), "utf8");
  rmSync(path.join(engineeringNeedsDeck, "COPY_DECK.md"));
  runFixture("App copy: engineering done without a deck fails", engineeringNeedsDeck, "check-app-copy.ts", 1, "app_copy.deck_missing");

  // An exact key reference must resolve exactly — the build's localization
  // lookup is exact, so a descendant key is not a substitute.
  const exactKeyMissing = makeFixture("app-copy-exact-key-missing");
  writeFileSync(path.join(exactKeyMissing, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(exactKeyMissing, "COPY_DECK.md"),
    [...DECK_HEADER, "| onboarding.promise.headline.body | Promise | Small wins, every day | | 1 |", ...NA_SURFACES, ""].join("\n"),
    "utf8",
  );
  writeFileSync(path.join(exactKeyMissing, "COPY_BRIEF.md"), AUTHORED_BRIEF, "utf8");
  writeFileSync(
    path.join(exactKeyMissing, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding.promise.headline` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: exact key reference unmet by descendant fails", exactKeyMissing, "check-app-copy.ts", 1, "references the exact key");

  // Escaped pipes render as literal pipes — serialized state in a sentence.
  const deckPipeState = makeFixture("app-copy-deck-pipe-state");
  writeFileSync(path.join(deckPipeState, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(deckPipeState, "COPY_DECK.md"),
    [...DECK_HEADER, "| onboarding.promise.headline | Promise | high \\| founder \\| open | | 1 |", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: pipe-delimited state in a deck cell fails", deckPipeState, "check-app-copy.ts", 1, "app_copy.deck_raw_identifier");

  // "Todoist" must not trip the "todo" placeholder shape: whole-word matching
  // plus the deck allowlist keep real product names clean.
  const todoistClean = makeFixture("app-copy-todoist-not-todo");
  writeFileSync(path.join(todoistClean, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(todoistClean, "COPY_DECK.md"),
    [...DECK_HEADER, "| onboarding.import.body | Import screen | Bring your tasks over from Todoist in one tap. | | 1 |", ""].join("\n"),
    "utf8",
  );
  writeFileSync(
    path.join(todoistClean, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Import | Bring data | `onboarding.import.body` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: product name containing a placeholder token stays clean", todoistClean, "check-app-copy.ts", 0);

  // A placeholder-filled not-applicable reason does not waive a surface.
  const naPlaceholder = makeFixture("app-copy-na-placeholder-reason");
  writeFileSync(path.join(naPlaceholder, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(naPlaceholder, "COPY_DECK.md"),
    [
      ...DECK_HEADER,
      "| onboarding.promise.headline | Promise | Small wins, every day | | 1 |",
      "",
      "## Paywall",
      "",
      "Not applicable — todo todo todo todo",
      ...NA_SURFACES.slice(4),
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(path.join(naPlaceholder, "COPY_BRIEF.md"), AUTHORED_BRIEF, "utf8");
  writeFileSync(
    path.join(naPlaceholder, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding.promise.*` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: placeholder not-applicable reason does not waive a surface", naPlaceholder, "check-app-copy.ts", 1, "app_copy.deck_surface_missing");

  // A done onboarding lane needs the Copy table itself.
  const noCopyTable = makeFixture("app-copy-onboarding-no-copy-table");
  writeFileSync(path.join(noCopyTable, "PROJECT_STATE.yaml"), stateWith("phase_2", { onboarding: "done" }), "utf8");
  writeFileSync(path.join(noCopyTable, "ONBOARDING.md"), "# Onboarding\n\nFirst value then review popup, no table here.\n", "utf8");
  runFixture("App copy: onboarding done without a Copy table fails", noCopyTable, "check-app-copy.ts", 1, "app_copy.onboarding_copy_table_missing");

  // An empty Copy cell is a screen with no words.
  const emptyCopyCell = makeFixture("app-copy-onboarding-empty-cell");
  writeFileSync(path.join(emptyCopyCell, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(emptyCopyCell, "ONBOARDING.md"),
    ["# Onboarding", "", "| Step | Purpose | Copy / question | State |", "| --- | --- | --- | --- |", "| Promise | Show value | | visible |", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: empty ONBOARDING Copy cell fails", emptyCopyCell, "check-app-copy.ts", 1, "app_copy.onboarding_copy_cell_empty");

  // Native Android string resources are an accepted externalization mechanism.
  const androidMechanism = makeFixture("app-copy-android-mechanism");
  writeFileSync(path.join(androidMechanism, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "done" }), "utf8");
  writeFileSync(
    path.join(androidMechanism, "COPY_DECK.md"),
    [...DECK_HEADER, "| onboarding.promise.headline | Promise | Small wins, every day | | 1 |", ...NA_SURFACES, ""].join("\n"),
    "utf8",
  );
  writeFileSync(path.join(androidMechanism, "COPY_BRIEF.md"), AUTHORED_BRIEF, "utf8");
  writeFileSync(
    path.join(androidMechanism, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding.promise.*` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    path.join(androidMechanism, "TECH_SPEC.md"),
    "# Technical Spec\n\n## Strings And Localization Readiness\n\nMechanism: res/values/strings.xml with per-locale values folders.\n",
    "utf8",
  );
  runFixture("App copy: Android strings.xml is an accepted mechanism", androidMechanism, "check-app-copy.ts", 0);

  // A missing state file fails loudly — with no lanes, every requirement
  // would silently resolve to "not required" on a business root.
  const stateMissing = h.makeEmptyFixture("app-copy-state-missing");
  runFixture("App copy: missing PROJECT_STATE.yaml fails loudly", stateMissing, "check-app-copy.ts", 1, "project_state.missing");

  // Full ICU MessageFormat plurals are the localization contract working —
  // the argument name inside must not read as a raw identifier.
  const icuPlural = makeFixture("app-copy-icu-plural-clean");
  writeFileSync(path.join(icuPlural, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(icuPlural, "COPY_DECK.md"),
    [...DECK_HEADER, "| today.done.headline | After check-in | {item_count, plural, one {# walk logged} other {# walks logged}} | | 1 |", ""].join("\n"),
    "utf8",
  );
  writeFileSync(
    path.join(icuPlural, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Done | Celebrate | `today.done.headline` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: ICU plural argument names stay clean", icuPlural, "check-app-copy.ts", 0);

  // A technology mention outside the readiness section is not a decision.
  const mechanismOutOfSection = makeFixture("app-copy-mechanism-out-of-section");
  writeFileSync(path.join(mechanismOutOfSection, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "done" }), "utf8");
  writeFileSync(
    path.join(mechanismOutOfSection, "TECH_SPEC.md"),
    [
      "# Technical Spec",
      "",
      "## Data Contract",
      "",
      "We rejected i18next for the data layer.",
      "",
      "## Strings And Localization Readiness",
      "",
      "Pending.",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: mechanism mention outside its section fails", mechanismOutOfSection, "check-app-copy.ts", 1, "app_copy.externalization_missing");

  // Punctuation-invalid key-like references bypass nothing.
  const badPunctuationRef = makeFixture("app-copy-bad-punctuation-ref");
  writeFileSync(path.join(badPunctuationRef, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(badPunctuationRef, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding/promise.*` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "App copy: punctuation-invalid key reference is reported",
    badPunctuationRef,
    "check-app-copy.ts",
    1,
    "app_copy.onboarding_key_reference_malformed",
  );

  // A reasonless allowlist bullet grants nothing and is reported.
  const allowlistNoReason = makeFixture("app-copy-allowlist-no-reason");
  writeFileSync(path.join(allowlistNoReason, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(allowlistNoReason, "COPY_DECK.md"),
    [
      "# Copy Deck",
      "",
      "Status: authored 2026-07-29",
      "",
      "## Allowed terms",
      "",
      "- lane",
      "",
      "## Onboarding",
      "",
      "| Key | Screen / moment | Copy (source language) | Voice notes | Locale tier |",
      "| --- | --- | --- | --- | --- |",
      "| onboarding.promise.headline | Promise | Pick your lane and row | | 1 |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "App copy: reasonless allowlist bullet is reported and not honored",
    allowlistNoReason,
    "check-app-copy.ts",
    1,
    "app_copy.allowlist_reason_missing",
  );

  // Inline code in a deck cell is text the user reads — a backticked machine
  // value is still the leak.
  const deckInlineCode = makeFixture("app-copy-deck-inline-code-identifier");
  writeFileSync(path.join(deckInlineCode, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(deckInlineCode, "COPY_DECK.md"),
    [...DECK_HEADER, "| settings.mode.body | Settings | Current mode: `founder_approval` | | 1 |", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: backticked identifier in deck cell fails", deckInlineCode, "check-app-copy.ts", 1, "app_copy.deck_raw_identifier");

  // An allowed term that is a substring of placeholder text must not conceal
  // the placeholder — the scrub is whole-word.
  const allowlistSubstring = makeFixture("app-copy-allowlist-substring");
  writeFileSync(path.join(allowlistSubstring, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(allowlistSubstring, "COPY_DECK.md"),
    [
      "# Copy Deck",
      "",
      "Status: authored 2026-07-29",
      "",
      "## Allowed terms",
      "",
      "- run — the product's own word for its core action",
      "",
      "## Onboarding",
      "",
      "| Key | Screen / moment | Copy (source language) | Voice notes | Locale tier |",
      "| --- | --- | --- | --- | --- |",
      "| onboarding.promise.headline | Promise | This runnable starter ships today | | 1 |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: allowed-term substring cannot conceal a placeholder", allowlistSubstring, "check-app-copy.ts", 1, "app_copy.deck_placeholder");

  // Declaring the inflected form ("lanes") clears the banned base ("lane").
  const allowlistInflected = makeFixture("app-copy-allowlist-inflected");
  writeFileSync(path.join(allowlistInflected, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(allowlistInflected, "COPY_DECK.md"),
    [
      "# Copy Deck",
      "",
      "Status: authored 2026-07-29",
      "",
      "## Allowed terms",
      "",
      "- lanes — this racing app's own word for its courses",
      "",
      "## Onboarding",
      "",
      "| Key | Screen / moment | Copy (source language) | Voice notes | Locale tier |",
      "| --- | --- | --- | --- | --- |",
      "| onboarding.promise.headline | Promise | Race your favorite lanes today | | 1 |",
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    path.join(allowlistInflected, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding.promise.*` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: inflected allowlist declaration clears the base term", allowlistInflected, "check-app-copy.ts", 0);

  // Keys need a dotted namespace: an underscore-only token is a flat identifier.
  const deckUnderscoreKey = makeFixture("app-copy-deck-underscore-key");
  writeFileSync(path.join(deckUnderscoreKey, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(deckUnderscoreKey, "COPY_DECK.md"),
    [...DECK_HEADER, "| onboarding_promise_headline | Promise | Small wins, every day | | 1 |", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: underscore-only deck key fails the namespace shape", deckUnderscoreKey, "check-app-copy.ts", 1, "app_copy.deck_key_shape");

  // On a required deck, missing locale tiers block the translation handoff.
  const tierRequired = makeFixture("app-copy-tier-required");
  writeFileSync(path.join(tierRequired, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(tierRequired, "COPY_DECK.md"),
    [...DECK_HEADER, "| onboarding.promise.headline | Promise | Small wins, every day | | |", ...NA_SURFACES, ""].join("\n"),
    "utf8",
  );
  writeFileSync(path.join(tierRequired, "COPY_BRIEF.md"), AUTHORED_BRIEF, "utf8");
  writeFileSync(
    path.join(tierRequired, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding.promise.*` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: missing locale tier on a required deck fails", tierRequired, "check-app-copy.ts", 1, "app_copy.deck_tier_missing");

  // A negative mention inside the readiness section is not a choice.
  const mechanismRejected = makeFixture("app-copy-mechanism-rejected");
  writeFileSync(path.join(mechanismRejected, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "done" }), "utf8");
  writeFileSync(
    path.join(mechanismRejected, "TECH_SPEC.md"),
    ["# Technical Spec", "", "## Strings And Localization Readiness", "", "Mechanism: none — we rejected i18next and will keep strings inline.", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: rejected-mechanism line is not an affirmative choice", mechanismRejected, "check-app-copy.ts", 1, "app_copy.externalization_missing");

  // GFM permits omitting outer pipes — such rows are parsed (and validated),
  // never silently excluded from every scan.
  const deckNoOuterPipes = makeFixture("app-copy-deck-no-outer-pipes");
  writeFileSync(path.join(deckNoOuterPipes, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(deckNoOuterPipes, "COPY_DECK.md"),
    [...DECK_HEADER, "onboarding.promise.headline | Promise | Product-specific value promise | | 1", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: outer-pipe-less deck row is still validated", deckNoOuterPipes, "check-app-copy.ts", 1, "app_copy.deck_placeholder");

  // The deck is required the moment the build starts — engineering "partial"
  // without a deck is the improvisation window, not a free pass.
  const engineeringPartial = makeFixture("app-copy-engineering-partial-needs-deck");
  writeFileSync(path.join(engineeringPartial, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "partial" }), "utf8");
  rmSync(path.join(engineeringPartial, "COPY_DECK.md"));
  runFixture("App copy: engineering partial without a deck fails", engineeringPartial, "check-app-copy.ts", 1, "app_copy.deck_missing");

  // A compliance note after the chosen mechanism is not a negation of it.
  const mechanismComplianceNote = makeFixture("app-copy-mechanism-compliance-note");
  writeFileSync(path.join(mechanismComplianceNote, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "done" }), "utf8");
  writeFileSync(
    path.join(mechanismComplianceNote, "COPY_DECK.md"),
    [...DECK_HEADER, "| onboarding.promise.headline | Promise | Small wins, every day | | 1 |", ...NA_SURFACES, ""].join("\n"),
    "utf8",
  );
  writeFileSync(path.join(mechanismComplianceNote, "COPY_BRIEF.md"), AUTHORED_BRIEF, "utf8");
  writeFileSync(
    path.join(mechanismComplianceNote, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding.promise.*` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    path.join(mechanismComplianceNote, "TECH_SPEC.md"),
    ["# Technical Spec", "", "## Strings And Localization Readiness", "", "Mechanism: i18next with expo-localization — no strings remain inline.", ""].join(
      "\n",
    ),
    "utf8",
  );
  runFixture("App copy: compliance note after a chosen mechanism passes", mechanismComplianceNote, "check-app-copy.ts", 0);

  // A customized plan that drops the deck route reopens the improvisation
  // path — the route is held in the plan itself.
  const planRouteDropped = makeFixture("app-copy-plan-route-dropped");
  writeFileSync(path.join(planRouteDropped, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "partial" }), "utf8");
  writeFileSync(path.join(planRouteDropped, "ENGINEERING_PLAN.md"), "# Engineering Plan\n\nBuild the screens per SPEC.md.\n", "utf8");
  runFixture("App copy: engineering plan without the deck route fails", planRouteDropped, "check-app-copy.ts", 1, "app_copy.plan_deck_route_missing");

  // Conversion lanes require the brief on their own — a done paywall lane
  // without an authored COPY_BRIEF.md shipped conversion copy voice-blind.
  const briefConversionLane = makeFixture("app-copy-brief-conversion-lane");
  writeFileSync(path.join(briefConversionLane, "PROJECT_STATE.yaml"), stateWith("phase_2", { revenue: "done" }), "utf8");
  runFixture("App copy: done conversion lane without authored brief fails", briefConversionLane, "check-app-copy.ts", 1, "app_copy.brief_unauthored");

  // "phase" is in the parsed banned list — the deck rule names it explicitly.
  const deckPhaseWord = makeFixture("app-copy-deck-phase-word");
  writeFileSync(path.join(deckPhaseWord, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(deckPhaseWord, "COPY_DECK.md"),
    [...DECK_HEADER, "| today.progress.body | Today | You're in phase 2 of your plan | | 1 |", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: phase vocabulary in a deck cell fails", deckPhaseWord, "check-app-copy.ts", 1, "app_copy.deck_internal_vocabulary");

  // A flat snake reference in backticks is a mistyped key, not a code word.
  const flatKeyRef = makeFixture("app-copy-flat-key-reference");
  writeFileSync(path.join(flatKeyRef, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(flatKeyRef, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding_promise_headline` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: flat snake key reference is reported", flatKeyRef, "check-app-copy.ts", 1, "app_copy.onboarding_key_reference_malformed");

  // A rejection in the same clause as the mechanism is not a choice.
  const mechanismSuffixNegation = makeFixture("app-copy-mechanism-suffix-negation");
  writeFileSync(path.join(mechanismSuffixNegation, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "done" }), "utf8");
  writeFileSync(
    path.join(mechanismSuffixNegation, "TECH_SPEC.md"),
    ["# Technical Spec", "", "## Strings And Localization Readiness", "", "Mechanism: i18next was rejected; strings remain inline.", ""].join("\n"),
    "utf8",
  );
  runFixture(
    "App copy: rejection in the mechanism clause is not a choice",
    mechanismSuffixNegation,
    "check-app-copy.ts",
    1,
    "app_copy.externalization_missing",
  );

  // A hollow status stub is not a brief.
  const briefHollow = makeFixture("app-copy-brief-hollow");
  writeFileSync(path.join(briefHollow, "PROJECT_STATE.yaml"), stateWith("phase_2", { revenue: "done" }), "utf8");
  writeFileSync(path.join(briefHollow, "COPY_BRIEF.md"), "# Copy Brief\n\nStatus: authored 2026-07-29\n", "utf8");
  runFixture("App copy: hollow authored brief fails", briefHollow, "check-app-copy.ts", 1, "app_copy.brief_hollow");

  // Engineering underway with NO plan at all is the same missing-route failure.
  const planMissing = makeFixture("app-copy-plan-missing");
  writeFileSync(path.join(planMissing, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "partial" }), "utf8");
  rmSync(path.join(planMissing, "ENGINEERING_PLAN.md"));
  runFixture("App copy: engineering underway without any plan fails", planMissing, "check-app-copy.ts", 1, "app_copy.plan_deck_route_missing");

  // A disjunctive or pending mechanism line is not a decision.
  const mechanismUndecided = makeFixture("app-copy-mechanism-undecided");
  writeFileSync(path.join(mechanismUndecided, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "done" }), "utf8");
  writeFileSync(
    path.join(mechanismUndecided, "TECH_SPEC.md"),
    ["# Technical Spec", "", "## Strings And Localization Readiness", "", "Mechanism: i18next or next-intl — decide after the spike.", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: disjunctive pending mechanism is not a choice", mechanismUndecided, "check-app-copy.ts", 1, "app_copy.externalization_missing");

  // Commented-out rows are hidden from the rendered deck and from parsing.
  const deckCommentedRows = makeFixture("app-copy-deck-commented-rows");
  writeFileSync(path.join(deckCommentedRows, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(deckCommentedRows, "COPY_DECK.md"),
    [
      "# Copy Deck",
      "",
      "Status: authored 2026-07-29",
      "",
      "## Onboarding",
      "",
      "<!--",
      "| Key | Screen / moment | Copy (source language) | Voice notes | Locale tier |",
      "| --- | --- | --- | --- | --- |",
      "| onboarding.promise.headline | Promise | Small wins, every day | | 1 |",
      "-->",
      ...NA_SURFACES,
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(path.join(deckCommentedRows, "COPY_BRIEF.md"), AUTHORED_BRIEF, "utf8");
  writeFileSync(
    path.join(deckCommentedRows, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding.promise.*` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: commented-out deck rows do not count as authored", deckCommentedRows, "check-app-copy.ts", 1, "app_copy.deck_surface_missing");

  // "Status: authored" without the date is unfinished paperwork.
  const deckNoDate = makeFixture("app-copy-deck-authored-no-date");
  writeFileSync(path.join(deckNoDate, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(deckNoDate, "COPY_DECK.md"),
    [
      "# Copy Deck",
      "",
      "Status: authored",
      "",
      "## Onboarding",
      "",
      "| Key | Screen / moment | Copy (source language) | Voice notes | Locale tier |",
      "| --- | --- | --- | --- | --- |",
      "| onboarding.promise.headline | Promise | Small wins, every day | | 1 |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: authored status without a date fails", deckNoDate, "check-app-copy.ts", 1, "app_copy.deck_status_unauthored");

  // A whitespace-corrupted key reference is an attempted reference, reported.
  const spacedKeyRef = makeFixture("app-copy-spaced-key-reference");
  writeFileSync(path.join(spacedKeyRef, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(spacedKeyRef, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding.promise .headline` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: whitespace-corrupted key reference is reported", spacedKeyRef, "check-app-copy.ts", 1, "app_copy.onboarding_key_reference_malformed");

  // Changing only the status line of the shipped brief template is boilerplate,
  // not authorship — the replace-this-line instructions survive and fail.
  const briefBoilerplate = makeFixture("app-copy-brief-boilerplate");
  writeFileSync(path.join(briefBoilerplate, "PROJECT_STATE.yaml"), stateWith("phase_2", { revenue: "done" }), "utf8");
  const templateBrief = readFileSync(path.join(briefBoilerplate, "COPY_BRIEF.md"), "utf8");
  writeFileSync(path.join(briefBoilerplate, "COPY_BRIEF.md"), templateBrief.replace(/^Status:.*$/m, "Status: authored 2026-07-29"), "utf8");
  runFixture("App copy: status-only edit of the brief template fails", briefBoilerplate, "check-app-copy.ts", 1, "app_copy.brief_hollow");

  // Commented-out surface exemptions and allowlist bullets grant nothing.
  const deckCommentedExemptions = makeFixture("app-copy-deck-commented-exemptions");
  writeFileSync(path.join(deckCommentedExemptions, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(deckCommentedExemptions, "COPY_DECK.md"),
    [
      "# Copy Deck",
      "",
      "Status: authored 2026-07-29",
      "",
      "## Onboarding",
      "",
      "| Key | Screen / moment | Copy (source language) | Voice notes | Locale tier |",
      "| --- | --- | --- | --- | --- |",
      "| onboarding.promise.headline | Promise | Small wins, every day | | 1 |",
      "",
      "<!--",
      ...NA_SURFACES,
      "-->",
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(path.join(deckCommentedExemptions, "COPY_BRIEF.md"), AUTHORED_BRIEF, "utf8");
  writeFileSync(
    path.join(deckCommentedExemptions, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding.promise.*` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: commented-out surface exemptions grant nothing", deckCommentedExemptions, "check-app-copy.ts", 1, "app_copy.deck_surface_missing");

  // A negated mention of the deck in the plan is not a route.
  const planNegatedRoute = makeFixture("app-copy-plan-negated-route");
  writeFileSync(path.join(planNegatedRoute, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "partial" }), "utf8");
  writeFileSync(path.join(planNegatedRoute, "ENGINEERING_PLAN.md"), "# Engineering Plan\n\nDo not use COPY_DECK.md; hardcode the strings for speed.\n", "utf8");
  runFixture("App copy: negated deck mention in the plan is not a route", planNegatedRoute, "check-app-copy.ts", 1, "app_copy.plan_deck_route_missing");

  // A blocked build already started — its copy obligations remain.
  const engineeringBlocked = makeFixture("app-copy-engineering-blocked");
  writeFileSync(path.join(engineeringBlocked, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "blocked" }), "utf8");
  rmSync(path.join(engineeringBlocked, "COPY_DECK.md"));
  runFixture("App copy: blocked engineering keeps the deck requirement", engineeringBlocked, "check-app-copy.ts", 1, "app_copy.deck_missing");

  // A placeholder-shaped allowlist rationale grants nothing.
  const allowlistPlaceholderReason = makeFixture("app-copy-allowlist-placeholder-reason");
  writeFileSync(path.join(allowlistPlaceholderReason, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(allowlistPlaceholderReason, "COPY_DECK.md"),
    [
      "# Copy Deck",
      "",
      "Status: authored 2026-07-29",
      "",
      "## Allowed terms",
      "",
      "- phase — Product-specific reason goes here later",
      "",
      "## Onboarding",
      "",
      "| Key | Screen / moment | Copy (source language) | Voice notes | Locale tier |",
      "| --- | --- | --- | --- | --- |",
      "| today.progress.body | Today | You're in phase 2 of your plan | | 1 |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture(
    "App copy: placeholder allowlist rationale grants nothing",
    allowlistPlaceholderReason,
    "check-app-copy.ts",
    1,
    "app_copy.deck_internal_vocabulary",
  );

  // expo-localization alone is locale detection, not a string mechanism.
  const mechanismExpoOnly = makeFixture("app-copy-mechanism-expo-only");
  writeFileSync(path.join(mechanismExpoOnly, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "done" }), "utf8");
  writeFileSync(
    path.join(mechanismExpoOnly, "TECH_SPEC.md"),
    ["# Technical Spec", "", "## Strings And Localization Readiness", "", "Mechanism: expo-localization.", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: expo-localization alone is not a string mechanism", mechanismExpoOnly, "check-app-copy.ts", 1, "app_copy.externalization_missing");

  // Commented-out brief sections render nothing and count for nothing.
  const briefCommented = makeFixture("app-copy-brief-commented-sections");
  writeFileSync(path.join(briefCommented, "PROJECT_STATE.yaml"), stateWith("phase_2", { revenue: "done" }), "utf8");
  writeFileSync(
    path.join(briefCommented, "COPY_BRIEF.md"),
    ["# Copy Brief", "", "Status: authored 2026-07-29", "", "<!--", AUTHORED_BRIEF, "-->", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: commented-out brief sections grant nothing", briefCommented, "check-app-copy.ts", 1, "app_copy.brief_hollow");

  // An unterminated comment hides the rendered tail — and the parseable one.
  const deckUnterminatedComment = makeFixture("app-copy-deck-unterminated-comment");
  writeFileSync(path.join(deckUnterminatedComment, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(deckUnterminatedComment, "COPY_DECK.md"),
    [
      "# Copy Deck",
      "",
      "Status: authored 2026-07-29",
      "",
      "<!--",
      "## Onboarding",
      "",
      "| Key | Screen / moment | Copy (source language) | Voice notes | Locale tier |",
      "| --- | --- | --- | --- | --- |",
      "| onboarding.promise.headline | Promise | Small wins, every day | | 1 |",
      ...NA_SURFACES,
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(path.join(deckUnterminatedComment, "COPY_BRIEF.md"), AUTHORED_BRIEF, "utf8");
  writeFileSync(
    path.join(deckUnterminatedComment, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding.promise.*` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: unterminated comment hides the parseable tail too", deckUnterminatedComment, "check-app-copy.ts", 1, "app_copy.deck_surface_missing");

  // The fictional-brand tripwire covers native and Flutter source too.
  const nativeBrand = makeFixture("app-copy-native-brand-shipped");
  writeFileSync(path.join(nativeBrand, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  mkdirSync(path.join(nativeBrand, "src"), { recursive: true });
  writeFileSync(
    path.join(nativeBrand, "src", "HomeView.swift"),
    'import SwiftUI\n\nstruct HomeView: View {\n  var body: some View {\n    Text("Fernpath turns one small daily check-in into a streak")\n  }\n}\n',
    "utf8",
  );
  runFixture("App copy: fictional brand in native source fails", nativeBrand, "check-app-copy.ts", 1, "app_copy.fictional_brand_shipped");

  // ARB alone is a resource format; gen-l10n alone is a generator. The
  // Flutter mechanism is the pair.
  const mechanismArbOnly = makeFixture("app-copy-mechanism-arb-only");
  writeFileSync(path.join(mechanismArbOnly, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "done" }), "utf8");
  writeFileSync(
    path.join(mechanismArbOnly, "TECH_SPEC.md"),
    ["# Technical Spec", "", "## Strings And Localization Readiness", "", "Mechanism: ARB.", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: ARB alone is not the Flutter mechanism", mechanismArbOnly, "check-app-copy.ts", 1, "app_copy.externalization_missing");

  // A status line hidden in a comment declares nothing.
  const deckCommentedStatus = makeFixture("app-copy-deck-commented-status");
  writeFileSync(path.join(deckCommentedStatus, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(deckCommentedStatus, "COPY_DECK.md"),
    [
      "# Copy Deck",
      "",
      "Status: draft",
      "",
      "<!-- Status: authored 2026-07-29 -->",
      "",
      "## Onboarding",
      "",
      "| Key | Screen / moment | Copy (source language) | Voice notes | Locale tier |",
      "| --- | --- | --- | --- | --- |",
      "| onboarding.promise.headline | Promise | Small wins, every day | | 1 |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: commented authored status declares nothing", deckCommentedStatus, "check-app-copy.ts", 1, "app_copy.deck_status_unauthored");

  // "cannot use" is a rejection in the plan and in the mechanism line alike.
  const planCannotUse = makeFixture("app-copy-plan-cannot-use");
  writeFileSync(path.join(planCannotUse, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "partial" }), "utf8");
  writeFileSync(path.join(planCannotUse, "ENGINEERING_PLAN.md"), "# Engineering Plan\n\nWe cannot use COPY_DECK.md for this sprint.\n", "utf8");
  runFixture("App copy: cannot-use plan mention is not a route", planCannotUse, "check-app-copy.ts", 1, "app_copy.plan_deck_route_missing");

  const mechanismCannotUse = makeFixture("app-copy-mechanism-cannot-use");
  writeFileSync(path.join(mechanismCannotUse, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "done" }), "utf8");
  writeFileSync(
    path.join(mechanismCannotUse, "TECH_SPEC.md"),
    ["# Technical Spec", "", "## Strings And Localization Readiness", "", "Mechanism: cannot use i18next.", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: cannot-use mechanism line selects nothing", mechanismCannotUse, "check-app-copy.ts", 1, "app_copy.externalization_missing");

  // Canonical keys that collapse to one dots-to-underscores form collide.
  const deckTransformCollision = makeFixture("app-copy-deck-transform-collision");
  writeFileSync(path.join(deckTransformCollision, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(deckTransformCollision, "COPY_DECK.md"),
    [...DECK_HEADER, "| foo.bar_baz | Screen | First words here | | 1 |", "| foo_bar.baz | Screen | Second words here | | 1 |", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: transform-colliding deck keys fail", deckTransformCollision, "check-app-copy.ts", 1, "app_copy.deck_key_duplicate");

  // A commented plan route renders nothing for builders.
  const planCommentedRoute = makeFixture("app-copy-plan-commented-route");
  writeFileSync(path.join(planCommentedRoute, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "partial" }), "utf8");
  writeFileSync(
    path.join(planCommentedRoute, "ENGINEERING_PLAN.md"),
    "# Engineering Plan\n\n<!-- Builders use COPY_DECK.md -->\n\nBuild the screens.\n",
    "utf8",
  );
  runFixture("App copy: commented plan route is not a route", planCommentedRoute, "check-app-copy.ts", 1, "app_copy.plan_deck_route_missing");

  // A readiness section hidden in a comment certifies nothing.
  const specCommentedSection = makeFixture("app-copy-spec-commented-section");
  writeFileSync(path.join(specCommentedSection, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "done" }), "utf8");
  writeFileSync(
    path.join(specCommentedSection, "TECH_SPEC.md"),
    ["# Technical Spec", "", "<!--", "## Strings And Localization Readiness", "", "Mechanism: i18next with expo-localization.", "-->", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: commented readiness section certifies nothing", specCommentedSection, "check-app-copy.ts", 1, "app_copy.externalization_missing");

  // Native sources under ios/ or an app-named directory are reachable.
  const nativeNestedBrand = makeFixture("app-copy-native-nested-brand");
  writeFileSync(path.join(nativeNestedBrand, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  mkdirSync(path.join(nativeNestedBrand, "ios", "MyApp"), { recursive: true });
  writeFileSync(path.join(nativeNestedBrand, "ios", "MyApp", "HomeView.swift"), 'let title = "Fernpath turns your daily walk into a streak"\n', "utf8");
  runFixture("App copy: fictional brand under ios/ is reachable", nativeNestedBrand, "check-app-copy.ts", 1, "app_copy.fictional_brand_shipped");

  // "don't use i18next" selects the group while rejecting it — the shared
  // negation lexicon covers the forms the old clause regex missed.
  const mechanismDontUse = makeFixture("app-copy-mechanism-dont-use");
  writeFileSync(path.join(mechanismDontUse, "PROJECT_STATE.yaml"), stateWith("phase_2", { engineering: "done" }), "utf8");
  writeFileSync(
    path.join(mechanismDontUse, "TECH_SPEC.md"),
    ["# Technical Spec", "", "## Strings And Localization Readiness", "", "Mechanism: don't use i18next.", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: don't-use mechanism line selects nothing", mechanismDontUse, "check-app-copy.ts", 1, "app_copy.externalization_missing");

  // ---- Self-scan fixtures: a faithful copy of the skill's own templates and
  // reference, run with --skill-root so root === <skill-root>/templates and
  // the self-scan section activates. Each mutation pins a shipped-surface hold.
  const makeSelfScanRoot = (name: string): string => {
    const fakeRoot = h.makeEmptyFixture(name);
    cpSync(path.join(skillRoot, "templates"), path.join(fakeRoot, "templates"), { recursive: true });
    // starters/ is a sibling of templates/ now, so the self-scan root has to
    // mirror the skill's own shape: the prompt-pack checks read from here.
    cpSync(path.join(skillRoot, "starters"), path.join(fakeRoot, "starters"), { recursive: true });
    mkdirSync(path.join(fakeRoot, "playbook", "words"), { recursive: true });
    cpSync(path.join(skillRoot, "playbook", "words", "conversion-copy.md"), path.join(fakeRoot, "playbook", "words", "conversion-copy.md"));
    return fakeRoot;
  };

  // A first fence whose only COPY_DECK.md mention is negated certifies the
  // improvisation path — the fence route must be affirmative.
  const promptNegatedRoute = makeSelfScanRoot("app-copy-prompt-negated-route");
  const negatedPromptPath = path.join(promptNegatedRoute, "starters", "habit-tracker", "prompts", "03-habit-core-loop.md");
  writeFileSync(
    negatedPromptPath,
    readFileSync(negatedPromptPath, "utf8").replace(/```[\s\S]*?```/, ["```", "Do not use COPY_DECK.md; hardcode the strings.", "```"].join("\n")),
    "utf8",
  );
  runFixture(
    "App copy: negated deck route in a runnable fence fails",
    path.join(promptNegatedRoute, "templates"),
    "check-app-copy.ts",
    1,
    "app_copy.prompt_deck_route_missing",
    ["--skill-root", promptNegatedRoute],
  );

  // Hardcoded copy in a template-literal JSX expression ({`Welcome back`})
  // bypasses lib/strings.ts the same way a quoted expression does.
  const starterTemplateLiteral = makeSelfScanRoot("app-copy-starter-template-literal");
  writeFileSync(
    path.join(starterTemplateLiteral, "starters", "habit-tracker", "starter", "components", "fixture-copy.tsx"),
    "export function FixtureCopy() {\n  return <p>{`Welcome back`}</p>;\n}\n",
    "utf8",
  );
  runFixture(
    "App copy: template-literal JSX expression is hardcoded copy",
    path.join(starterTemplateLiteral, "templates"),
    "check-app-copy.ts",
    1,
    "app_copy.starter_hardcoded_text",
    ["--skill-root", starterTemplateLiteral],
  );

  // A range comparison in a starter utility is code, not copy — the JSX text
  // matcher is scoped to JSX files and tag-adjacent text.
  const starterComparison = makeSelfScanRoot("app-copy-starter-comparison-clean");
  writeFileSync(
    path.join(starterComparison, "starters", "habit-tracker", "starter", "lib", "range.ts"),
    "export function within(value: number, lower: number, upper: number): boolean {\n  return value > lower && value < upper;\n}\n",
    "utf8",
  );
  runFixture("App copy: starter range comparison is not JSX text", path.join(starterComparison, "templates"), "check-app-copy.ts", 0, undefined, [
    "--skill-root",
    starterComparison,
  ]);

  // The scoped matcher still catches real JSX text nodes — the narrowing must
  // not un-hold the externalization regression it exists for.
  const starterTextNode = makeSelfScanRoot("app-copy-starter-jsx-text-node");
  writeFileSync(
    path.join(starterTextNode, "starters", "habit-tracker", "starter", "components", "fixture-text.tsx"),
    "export function FixtureText() {\n  return <p>Welcome back friend</p>;\n}\n",
    "utf8",
  );
  runFixture(
    "App copy: JSX text node after a tag is still hardcoded copy",
    path.join(starterTextNode, "templates"),
    "check-app-copy.ts",
    1,
    "app_copy.starter_hardcoded_text",
    ["--skill-root", starterTextNode],
  );

  // A guidance cell naming a localization source file (`strings.dart`) is a
  // file reference, not an exact deck key — coverage must not demand a row.
  const dartFileReference = makeFixture("app-copy-strings-dart-reference");
  writeFileSync(path.join(dartFileReference, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(dartFileReference, "COPY_DECK.md"),
    [...DECK_HEADER, "| onboarding.promise.headline | Promise | Small wins, every day | | 1 |", ""].join("\n"),
    "utf8",
  );
  writeFileSync(
    path.join(dartFileReference, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding.promise.headline` from `strings.dart` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: localization file reference is not a deck key", dartFileReference, "check-app-copy.ts", 0);

  // "Not applicable —" with the rationale on the NEXT line is a reasonless
  // exemption: the documented shape is one line — heading, dash, reason.
  const naNextLine = makeFixture("app-copy-na-reason-next-line");
  writeFileSync(path.join(naNextLine, "PROJECT_STATE.yaml"), stateWith("phase_2", { design: "done" }), "utf8");
  writeFileSync(
    path.join(naNextLine, "COPY_DECK.md"),
    [
      ...DECK_HEADER,
      "| onboarding.promise.headline | Promise | Small wins, every day | | 1 |",
      "",
      "## Paywall",
      "",
      "Not applicable —",
      "The onboarding flow explains the value on its own screens.",
      ...NA_SURFACES.slice(4),
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(path.join(naNextLine, "COPY_BRIEF.md"), AUTHORED_BRIEF, "utf8");
  writeFileSync(
    path.join(naNextLine, "ONBOARDING.md"),
    [
      "# Onboarding",
      "",
      "| Step | Purpose | Copy / question | State |",
      "| --- | --- | --- | --- |",
      "| Promise | Show value | `onboarding.promise.*` | visible |",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: next-line exemption reason does not waive a surface", naNextLine, "check-app-copy.ts", 1, "app_copy.deck_surface_missing");

  // `&nbsp;`/`<br>`/`&#32;` render no words — a markup-only cell is empty.
  const markupEmptyCell = makeFixture("app-copy-deck-markup-empty-cell");
  writeFileSync(path.join(markupEmptyCell, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  writeFileSync(
    path.join(markupEmptyCell, "COPY_DECK.md"),
    [...DECK_HEADER, "| onboarding.promise.headline | Promise | &nbsp;<br>&#32; | | 1 |", ""].join("\n"),
    "utf8",
  );
  runFixture("App copy: markup-only deck cell is an empty cell", markupEmptyCell, "check-app-copy.ts", 1, "app_copy.deck_cell_empty");

  // A test asserting the starter brand is gone mentions the brand by name —
  // that is a check on shipped copy, not shipped copy itself.
  const testLiteralClean = makeFixture("app-copy-test-literal-clean");
  writeFileSync(path.join(testLiteralClean, "PROJECT_STATE.yaml"), stateWith("phase_2", {}), "utf8");
  mkdirSync(path.join(testLiteralClean, "__tests__"), { recursive: true });
  writeFileSync(
    path.join(testLiteralClean, "__tests__", "branding.test.ts"),
    [
      'import { strings } from "../lib/strings";',
      'import { expect, test } from "vitest";',
      "",
      'test("no starter brand ships", () => {',
      '  expect(strings.landing.headline).not.toContain("Fernpath");',
      "});",
      "",
    ].join("\n"),
    "utf8",
  );
  runFixture("App copy: fictional brand in a test file is not shipped copy", testLiteralClean, "check-app-copy.ts", 0);

  // Deleting only the replace-this-line markers keeps the template's
  // instruction paragraphs — that is still boilerplate, not authorship.
  const briefMarkersDeleted = makeFixture("app-copy-brief-markers-deleted");
  writeFileSync(path.join(briefMarkersDeleted, "PROJECT_STATE.yaml"), stateWith("phase_2", { revenue: "done" }), "utf8");
  writeFileSync(
    path.join(briefMarkersDeleted, "COPY_BRIEF.md"),
    readFileSync(path.join(briefMarkersDeleted, "COPY_BRIEF.md"), "utf8")
      .replace(/^Status:.*$/m, "Status: authored 2026-07-30")
      .replace(/^_Replace this line[^\n]*$\n?/gm, ""),
    "utf8",
  );
  runFixture("App copy: marker-only deletion of the brief template fails", briefMarkersDeleted, "check-app-copy.ts", 1, "app_copy.brief_hollow");
}
