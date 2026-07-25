import { appendFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Harness, skillRoot } from "./_harness.js";

/**
 * Archetype fixtures: the runnable starter scaffolds shipped inside the
 * archetype packs (check-archetype-starter) and their routing in
 * check-app-archetype.
 */
export function register(h: Harness): void {
  const { makeEmptyFixture, runScriptArgs } = h;

  // The shipped starters themselves must satisfy the full contract.
  runScriptArgs("archetype starter scaffolds pass", "check-archetype-starter.ts", ["--skill-root", skillRoot], 0);

  // Build a fake skill root carrying only the archetype packs, then break it.
  function makeArchetypeSkillRoot(name: string): string {
    const fakeRoot = makeEmptyFixture(name);
    mkdirSync(path.join(fakeRoot, "templates"), { recursive: true });
    cpSync(path.join(skillRoot, "templates", "app-archetypes"), path.join(fakeRoot, "templates", "app-archetypes"), { recursive: true });
    return fakeRoot;
  }

  const noLockfile = makeArchetypeSkillRoot("archetype-starter-no-lockfile");
  rmSync(path.join(noLockfile, "templates", "app-archetypes", "social-network", "starter", "package-lock.json"));
  runScriptArgs(
    "starter without lockfile fails",
    "check-archetype-starter.ts",
    ["--skill-root", noLockfile],
    1,
    "archetype_starter.social-network.lockfile_missing",
  );

  const envWithValue = makeArchetypeSkillRoot("archetype-starter-env-value");
  appendFileSync(
    path.join(envWithValue, "templates", "app-archetypes", "ai-chat-companion", "starter", ".env.example"),
    "STRIPE_SECRET_KEY=sk_test_fixtureonlyfixtureonly\n",
    "utf8",
  );
  runScriptArgs(
    "starter env.example with a value fails",
    "check-archetype-starter.ts",
    ["--skill-root", envWithValue],
    1,
    "archetype_starter.ai-chat-companion.env_not_names_only",
  );

  // ── Reference context budget ──────────────────────────────────────────────

  runScriptArgs("references within context budget pass", "check-reference-size.ts", ["--skill-root", skillRoot], 0);

  const oversizedRef = makeEmptyFixture("reference-size-over-budget");
  mkdirSync(path.join(oversizedRef, "references"), { recursive: true });
  writeFileSync(path.join(oversizedRef, "references", "huge-lane.md"), `# Huge\n${"x".repeat(70 * 1024)}\n`, "utf8");
  runScriptArgs("oversized reference fails the context budget", "check-reference-size.ts", ["--skill-root", oversizedRef], 1, "reference_size.over_budget");

  const oversizedEntrypoint = makeEmptyFixture("entrypoint-size-over-budget");
  mkdirSync(path.join(oversizedEntrypoint, "references"), { recursive: true });
  writeFileSync(path.join(oversizedEntrypoint, "references", "small.md"), "# Small\nWithin budget.\n", "utf8");
  writeFileSync(path.join(oversizedEntrypoint, "SKILL.md"), `---\nname: fixture\n---\n${"x".repeat(70 * 1024)}\n`, "utf8");
  runScriptArgs(
    "oversized SKILL.md fails the entrypoint budget",
    "check-reference-size.ts",
    ["--skill-root", oversizedEntrypoint],
    1,
    "reference_size.entrypoint_over_budget",
  );

  // A split reference is only useful if its index still routes to every topic
  // file, so each way that contract can rot gets a failing fixture.
  const unindexedSplit = makeEmptyFixture("reference-size-split-without-index");
  mkdirSync(path.join(unindexedSplit, "references", "orphan-lane"), { recursive: true });
  writeFileSync(path.join(unindexedSplit, "SKILL.md"), "---\nname: fixture\n---\nEntrypoint.\n", "utf8");
  writeFileSync(path.join(unindexedSplit, "references", "orphan-lane", "one.md"), "# One\nBody.\n", "utf8");
  runScriptArgs("split reference without an index fails", "check-reference-size.ts", ["--skill-root", unindexedSplit], 1, "reference_size.index_missing");

  const incompleteSplit = makeEmptyFixture("reference-size-index-incomplete");
  mkdirSync(path.join(incompleteSplit, "references", "lane"), { recursive: true });
  writeFileSync(path.join(incompleteSplit, "SKILL.md"), "---\nname: fixture\n---\nEntrypoint.\n", "utf8");
  writeFileSync(path.join(incompleteSplit, "references", "lane.md"), "# Lane\n[one](lane/one.md)\n", "utf8");
  writeFileSync(path.join(incompleteSplit, "references", "lane", "one.md"), "# One\nBody.\n", "utf8");
  writeFileSync(path.join(incompleteSplit, "references", "lane", "two.md"), "# Two\nUnreachable.\n", "utf8");
  runScriptArgs("index that misses a topic file fails", "check-reference-size.ts", ["--skill-root", incompleteSplit], 1, "reference_size.index_incomplete");

  // A bare mention reads as routed to a human but is not followable, so the
  // gate must require a real link rather than a substring hit.
  const mentionOnlySplit = makeEmptyFixture("reference-size-index-mention-only");
  mkdirSync(path.join(mentionOnlySplit, "references", "lane"), { recursive: true });
  writeFileSync(path.join(mentionOnlySplit, "SKILL.md"), "---\nname: fixture\n---\nEntrypoint.\n", "utf8");
  writeFileSync(
    path.join(mentionOnlySplit, "references", "lane.md"),
    "# Lane\n[one](lane/one.md)\nRouting for `lane/two.md` is still to be written.\n",
    "utf8",
  );
  writeFileSync(path.join(mentionOnlySplit, "references", "lane", "one.md"), "# One\nBody.\n", "utf8");
  writeFileSync(path.join(mentionOnlySplit, "references", "lane", "two.md"), "# Two\nMentioned but never linked.\n", "utf8");
  runScriptArgs(
    "topic file mentioned in prose but never linked fails",
    "check-reference-size.ts",
    ["--skill-root", mentionOnlySplit],
    1,
    "reference_size.index_incomplete",
  );

  const danglingSplit = makeEmptyFixture("reference-size-index-dangling");
  mkdirSync(path.join(danglingSplit, "references", "lane"), { recursive: true });
  writeFileSync(path.join(danglingSplit, "SKILL.md"), "---\nname: fixture\n---\nEntrypoint.\n", "utf8");
  writeFileSync(path.join(danglingSplit, "references", "lane.md"), "# Lane\n[one](lane/one.md)\n[gone](lane/gone.md)\n", "utf8");
  writeFileSync(path.join(danglingSplit, "references", "lane", "one.md"), "# One\nBody.\n", "utf8");
  runScriptArgs(
    "index routing to a missing topic file fails",
    "check-reference-size.ts",
    ["--skill-root", danglingSplit],
    1,
    "reference_size.index_dangling_link",
  );

  const untestedRls = makeArchetypeSkillRoot("archetype-starter-untested-rls");
  rmSync(path.join(untestedRls, "templates", "app-archetypes", "social-network", "starter", "supabase", "tests"), { recursive: true });
  runScriptArgs(
    "starter without RLS tests fails",
    "check-archetype-starter.ts",
    ["--skill-root", untestedRls],
    1,
    "archetype_starter.social-network.rls_tests_missing",
  );
}
