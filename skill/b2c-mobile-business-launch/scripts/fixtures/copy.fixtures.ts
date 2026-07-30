import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Harness } from "./_harness.js";

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
  "One small win a day, traced to RESEARCH.md.",
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
}
