import { rmSync, writeFileSync } from "node:fs";
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
  return ["product:", `  phase: "${phase}"`, "lanes:", ...laneLines, ""].join("\n");
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
  runFixture("App copy: deck-local allowlist clears a product-owned word", deckAllowlisted, "check-app-copy.ts", 0);

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
}
