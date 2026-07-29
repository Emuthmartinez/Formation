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
      "",
    ].join("\n"),
    "utf8",
  );
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
}
