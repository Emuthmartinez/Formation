import assert from "node:assert/strict";
import test from "node:test";
import { slug } from "../domain/shared.mjs";

/**
 * Adapter contract A, the consumer side.
 *
 * The slug rule is the canonical example of why the contract exists: this file's producer
 * (domain/shared.mjs slug()) and the engine's workspace resolver diverged silently — underscores
 * on one side, a ^[a-z0-9][a-z0-9-]*$ requirement on the other — and every multi-word company
 * became "unreachable" with no hint why (2026-08-19 audit). These tests pin both halves: the
 * platform emits slugs the engine's resolver accepts, and a report without a compatible
 * contractVersion is refused as unreachable rather than interpreted.
 */

// The engine resolver's exact rule (defaultResolveEngineWorkspace in server/execution.mjs).
const ENGINE_WORKSPACE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

test("every slug the platform mints is resolvable by the engine's workspace rule", () => {
  const names = [
    "Sunset Cafe Deluxe",
    "Ocho",
    "My 2nd App",
    "  padded   name  ",
    "Émigré Café", // diacritics collapse to separators, never underscores
    "a",
  ];
  for (const name of names) {
    const minted = slug(name);
    assert.match(minted, ENGINE_WORKSPACE_SLUG, `slug("${name}") = "${minted}" must satisfy the engine's workspace rule`);
    assert.ok(!minted.includes("_"), `slug("${name}") must not contain underscores`);
  }
});

test("a multi-word company name round-trips to a hyphenated slug", () => {
  assert.equal(slug("Sunset Cafe Deluxe"), "sunset-cafe-deluxe");
});
