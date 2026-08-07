import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applyImportPlan, buildImportPlan, toFounderPlan } from "../domain/imports.mjs";
import { EngineBridge } from "../execution.mjs";
import { ImportService } from "../imports.mjs";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";
import { login, request, startTestServer } from "./_engine.mjs";

/**
 * The existing-launch-repository importer, platform half.
 *
 * These suites run against the real engine adapter — a real launch repository is written to disk
 * and read by the real `core/adapters/platform-import.ts` through the real `EngineBridge`. A fake
 * report would let the two halves drift apart in exactly the way the boundary exists to prevent.
 */

const NOW = "2026-08-07T00:00:00.000Z";

const LAUNCH_STATE = `schema_version: "1"
updated_at: "2026-07-30"
project:
  name: "Ocho"
  slug: "ocho"
  owner: "Eduardo"
  phase: "phase_6_launch"
  platforms:
    - ios
business_operator:
  next_founder_action: "Approve the store submission so the release can go out."
continuity:
  last_state_review: "2026-07-30"
orchestration:
  state_reconciled: true
lanes:
  research:
    status: "done"
    evidence:
      - "strategy/RESEARCH.md"
    blockers: []
    go_pivot_kill_decision: "go"
    go_pivot_kill_decided_at: "2026-05-01"
  product:
    status: "partial"
    evidence:
      - "product/SPEC.md"
    blockers: []
  engineering:
    status: "blocked"
    evidence: []
    blockers:
      - "The signing certificate expired and needs renewal."
`;

const LAUNCH_BUSINESS = `{
  "schemaVersion": "1.0.0",
  "business": {
    "name": "Ocho",
    "slug": "ocho",
    "stage": "live",
    "positioning": "A domino game you can actually play with your family.",
    "targetAudience": "Families who already play dominoes together."
  }
}
`;

function write(root, relativePath, contents) {
  const absolute = path.join(root, relativePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents, "utf8");
}

/** A launch repository on disk, under a root the import service will be pointed at. */
async function makeImportRoot(sourceId = "ocho", { state = LAUNCH_STATE } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "formation-import-root-"));
  const workspace = path.join(root, sourceId);
  write(workspace, "state/PROJECT_STATE.yaml", state);
  write(workspace, "state/business.json", LAUNCH_BUSINESS);
  write(workspace, "strategy/RESEARCH.md", "# Market research\n\n## What we learned\n\nFamilies play weekly.\n");
  write(workspace, "product/SPEC.md", "# Product spec\n\nThe app is a domino game.\n");
  return { root, workspace };
}

async function makeStore() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-import-store-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();
  return store;
}

/** The typed report, produced by the real engine adapter rather than hand-written here. */
async function readReport(root, sourceId = "ocho") {
  const view = await new EngineBridge().describeLaunchRepository(path.join(root, sourceId));
  assert.ok(view.reachable, `the engine could not read the fixture launch workspace: ${view.reason}`);
  assert.equal(view.report.workspaceReady, true, `the engine reported the fixture as not ready: ${view.report.reason}`);
  return view.report;
}

// ---------------------------------------------------------------------------
// Planning and applying.
// ---------------------------------------------------------------------------

test("an import brings work across as drafts, never as facts", async () => {
  const { root } = await makeImportRoot();
  const report = await readReport(root);
  const database = createSeedDatabase();
  const workspace = database.workspaces[0];

  const plan = buildImportPlan(database, workspace, report, "ocho", NOW);
  const changes = applyImportPlan(database, workspace, plan, NOW);

  assert.ok(changes.claimsCreated.length > 0, "expected recorded launch work to arrive as claims");
  assert.ok(
    changes.claimsCreated.every((claim) => claim.kind !== "fact"),
    "nothing read out of a launch workspace may arrive as a fact",
  );
  assert.ok(
    changes.deliverablesCreated.every((artifact) => artifact.status === "draft"),
    "an imported document must arrive as a draft",
  );
  assert.equal(changes.deliverablesCreated.length, database.artifactVersions.filter((entry) => entry.createdBy === "Existing launch work").length);
  assert.ok(
    changes.decisionsCreated.some((decision) => decision.status === "decided" && decision.decidedAt === "2026-05-01"),
    "a recorded founder verdict must arrive with the date it was made",
  );
  assert.ok(
    changes.tasksCreated.some((task) => task.priority === "critical" && task.title.includes("store submission")),
    "the launch workspace's next founder action must arrive as the most urgent task",
  );
});

test("re-importing an unchanged launch workspace changes nothing", async () => {
  const { root } = await makeImportRoot();
  const report = await readReport(root);
  const database = createSeedDatabase();
  const workspace = database.workspaces[0];

  applyImportPlan(database, workspace, buildImportPlan(database, workspace, report, "ocho", NOW), NOW);
  const afterFirst = JSON.stringify(database);

  const secondPlan = buildImportPlan(database, workspace, report, "ocho", "2026-09-01T00:00:00.000Z");
  assert.equal(secondPlan.totals.creates, 0, "a second import of the same workspace must create nothing");
  assert.equal(secondPlan.totals.retires, 0, "a second import of the same workspace must retire nothing");
  applyImportPlan(database, workspace, secondPlan, "2026-09-01T00:00:00.000Z");

  const afterSecond = JSON.parse(afterFirst);
  afterSecond.workspaces[0].updatedAt = database.workspaces[0].updatedAt;
  assert.deepEqual(JSON.parse(JSON.stringify(database)), afterSecond, "a no-op import must leave every record untouched");
});

test("a changed source refreshes an untouched draft and never overwrites an edited one", async () => {
  const { root, workspace: launchDir } = await makeImportRoot();
  const database = createSeedDatabase();
  const workspace = database.workspaces[0];

  applyImportPlan(database, workspace, buildImportPlan(database, workspace, await readReport(root), "ocho", NOW), NOW);
  const spec = database.artifacts.find((entry) => entry.source?.importKey === "deliverable:product/SPEC.md");
  const research = database.artifacts.find((entry) => entry.source?.importKey === "deliverable:strategy/RESEARCH.md");
  assert.ok(spec && research, "expected both documents to have been imported");

  // The founder edits one of them; the launch workspace then moves both forward.
  research.sections[0].body = "Families play weekly, and they told us they would pay.";
  write(launchDir, "product/SPEC.md", "# Product spec\n\nThe app is a domino game for four players.\n");
  write(launchDir, "strategy/RESEARCH.md", "# Market research\n\n## What we learned\n\nFamilies play daily.\n");

  const plan = buildImportPlan(database, workspace, await readReport(root), "ocho", "2026-09-01T00:00:00.000Z");
  const changes = applyImportPlan(database, workspace, plan, "2026-09-01T00:00:00.000Z");

  assert.equal(changes.deliverablesUpdated.length, 1, "the untouched draft must be refreshed");
  assert.equal(changes.deliverablesUpdated[0].id, spec.id);
  assert.equal(spec.version, 2, "a refreshed draft must append an immutable version");
  assert.ok(spec.sections.some((section) => section.body.includes("four players")), "the refreshed draft must carry the new text");

  assert.equal(changes.deliverablesDrifted.length, 1, "the edited draft must be flagged, not rewritten");
  assert.equal(changes.deliverablesDrifted[0].id, research.id);
  assert.equal(research.sections[0].body, "Families play weekly, and they told us they would pay.", "a founder's edit must survive an import untouched");
  assert.equal(research.version, 1, "flagging drift is metadata, not a content change, so it must not consume a version");
  assert.equal(research.stale, true);
});

test("work the launch workspace stops reporting is closed, and decisions are never unmade", async () => {
  const { root, workspace: launchDir } = await makeImportRoot();
  const database = createSeedDatabase();
  const workspace = database.workspaces[0];
  applyImportPlan(database, workspace, buildImportPlan(database, workspace, await readReport(root), "ocho", NOW), NOW);

  const blocker = database.tasks.find((task) => task.source?.importKey?.includes("engineering:blocker"));
  const laneClaim = database.claims.find((claim) => claim.source?.importKey === "lane:research:done");
  const verdict = database.decisions.find((decision) => decision.source?.importKey === "decision:go-pivot-kill");
  assert.ok(blocker && laneClaim && verdict, "expected the first import to have created all three");

  // The launch workspace moves on: the blocker is gone, research is no longer recorded finished,
  // and the verdict has been removed from the file entirely.
  write(
    launchDir,
    "state/PROJECT_STATE.yaml",
    LAUNCH_STATE.replace('    go_pivot_kill_decision: "go"\n    go_pivot_kill_decided_at: "2026-05-01"\n', "")
      .replace('  research:\n    status: "done"', '  research:\n    status: "partial"')
      .replace('    blockers:\n      - "The signing certificate expired and needs renewal."\n', "    blockers: []\n"),
  );

  const changes = applyImportPlan(database, workspace, buildImportPlan(database, workspace, await readReport(root), "ocho", "2026-09-01T00:00:00.000Z"), "2026-09-01T00:00:00.000Z");

  assert.ok(changes.tasksClosed.some((task) => task.id === blocker.id), "work the workspace no longer reports must be closed");
  assert.equal(laneClaim.status, "superseded", "a recommendation whose basis is gone must be retired, not deleted");
  assert.equal(verdict.status, "decided", "a decision that was made stays made, whatever the source file says later");
  assert.ok(!changes.claimsRetired.some((claim) => claim.source.importKey.startsWith("contradiction:")), "an import must not retire the questions it raised itself");
});

test("company fields are filled only where Formation is empty, and disagreements become questions", async () => {
  const { root } = await makeImportRoot();
  const report = await readReport(root);

  const empty = createSeedDatabase();
  empty.workspaces[0].company.oneLiner = "";
  empty.workspaces[0].company.targetCustomer = "";
  const filledPlan = buildImportPlan(empty, empty.workspaces[0], report, "ocho", NOW);
  applyImportPlan(empty, empty.workspaces[0], filledPlan, NOW);
  assert.equal(empty.workspaces[0].company.oneLiner, report.company.oneLiner, "an empty field must be filled from the launch workspace");

  const written = createSeedDatabase();
  written.workspaces[0].company.oneLiner = "Something the founder wrote themselves.";
  const plan = buildImportPlan(written, written.workspaces[0], report, "ocho", NOW);
  applyImportPlan(written, written.workspaces[0], plan, NOW);
  assert.equal(written.workspaces[0].company.oneLiner, "Something the founder wrote themselves.", "a founder's own words must never be replaced by an import");
  assert.ok(
    written.claims.some((claim) => claim.source?.importKey === "company-field:oneLiner" && claim.kind === "question"),
    "a disagreement between the two records must arrive as a question the founder answers",
  );
});

test("a blocking contradiction survives the import as an open question", async () => {
  // The research lane names evidence that is not on disk: the engine reports it as blocking.
  const { root } = await makeImportRoot("ocho", {
    state: LAUNCH_STATE.replace("      - \"strategy/RESEARCH.md\"", "      - \"strategy/MISSING.md\""),
  });
  const database = createSeedDatabase();
  const workspace = database.workspaces[0];
  const plan = buildImportPlan(database, workspace, await readReport(root), "ocho", NOW);
  assert.ok(plan.contradictions.some((entry) => entry.severity === "blocking"), "expected the engine to report the missing evidence");

  applyImportPlan(database, workspace, plan, NOW);
  const question = database.claims.find((claim) => claim.source?.importKey?.startsWith("contradiction:lane_evidence_missing"));
  assert.ok(question, "a blocking contradiction must survive the preview screen as a question in the record");
  assert.equal(question.kind, "question");
});

test("the founder-facing plan names the fields that may leave and carries no document bodies", async () => {
  const { root } = await makeImportRoot();
  const database = createSeedDatabase();
  const plan = buildImportPlan(database, database.workspaces[0], await readReport(root), "ocho", NOW);
  const founderPlan = toFounderPlan(plan);
  const serialized = JSON.stringify(founderPlan);

  assert.ok(!serialized.includes("Families play weekly"), "a preview must not ship document bodies to the client");
  assert.ok(!serialized.includes("importKey"), "engine import keys are provenance, not founder-facing data");
  assert.ok(founderPlan.deliverables.every((entry) => typeof entry.sectionCount === "number" || entry.sectionCount === null));
  assert.equal(founderPlan.company.name, "Ocho");
  assert.ok(founderPlan.totals.creates > 0);
});

// ---------------------------------------------------------------------------
// The service and its routes.
// ---------------------------------------------------------------------------

test("with no import root configured, importing says it is switched off rather than empty", async () => {
  const service = new ImportService(await makeStore(), { resolveRoot: () => null });
  assert.deepEqual(service.listSources(), { configured: false, sources: [] });
  await assert.rejects(
    () => service.preview({ workspace: createSeedDatabase().workspaces[0], sourceId: "anything" }),
    /not set up to bring in existing launch work/,
  );
});

test("a source id can only ever name a launch workspace the server actually holds", async () => {
  const { root } = await makeImportRoot();
  const service = new ImportService(await makeStore(), { resolveRoot: () => root });
  assert.deepEqual(
    service.listSources().sources.map((entry) => entry.id),
    ["ocho"],
  );

  const workspace = createSeedDatabase().workspaces[0];
  for (const attempt of ["../../etc", "..", "ocho/../../etc", "/etc", "nope"]) {
    await assert.rejects(
      () => service.preview({ workspace, sourceId: attempt }),
      (error) => error.status === 400 || error.status === 404,
      `a source id of "${attempt}" must not resolve to anything`,
    );
  }
});

test("a directory that is not a launch workspace is not offered as a source", async () => {
  const { root } = await makeImportRoot();
  mkdirSync(path.join(root, "not-a-launch-workspace"), { recursive: true });
  writeFileSync(path.join(root, "not-a-launch-workspace", "notes.md"), "hello", "utf8");
  const service = new ImportService(await makeStore(), { resolveRoot: () => root });
  assert.deepEqual(
    service.listSources().sources.map((entry) => entry.id),
    ["ocho"],
  );
});

test("preview writes nothing, and apply writes what the preview said it would", async (t) => {
  const { root } = await makeImportRoot();
  const app = await startTestServer(undefined, { storePrefix: "formation-import-api-", imports: { resolveRoot: () => root } });
  t.after(app.close);
  const cookie = await login(app.baseUrl);
  const workspaceId = (await app.store.read()).workspaces[0].id;

  const sources = await request(app.baseUrl, `/api/workspaces/${workspaceId}/import-sources`, { cookie });
  assert.equal(sources.status, 200);
  assert.deepEqual((await sources.json()).sources.map((entry) => entry.id), ["ocho"]);

  const before = JSON.stringify(await app.store.read());
  const previewResponse = await request(app.baseUrl, `/api/workspaces/${workspaceId}/imports/preview`, {
    cookie,
    method: "POST",
    body: { sourceId: "ocho" },
  });
  assert.equal(previewResponse.status, 200);
  const preview = await previewResponse.json();
  assert.ok(preview.totals.creates > 0, "expected the preview to describe work arriving");
  assert.equal(JSON.stringify(await app.store.read()), before, "a preview must not change anything");

  const applyResponse = await request(app.baseUrl, `/api/workspaces/${workspaceId}/imports`, {
    cookie,
    method: "POST",
    body: { sourceId: "ocho" },
  });
  assert.equal(applyResponse.status, 201);
  const applied = await applyResponse.json();
  assert.deepEqual(applied.totals, preview.totals, "what the founder was shown and what happened must be the same plan");

  const database = await app.store.read();
  const imported = (collection) => database[collection].filter((entry) => entry.source?.kind === "legacy-import").length;
  for (const [collection, group] of [
    ["claims", "claims"],
    ["decisions", "decisions"],
    ["tasks", "tasks"],
    ["artifacts", "deliverables"],
  ]) {
    assert.equal(
      imported(collection),
      applied[group].filter((entry) => entry.action === "create").length,
      `the store holds a different number of imported ${collection} than the plan said it would`,
    );
  }
  assert.ok(database.activity.some((entry) => entry.type === "launch-work-imported"), "an import must be recorded in the company's own activity");
});

test("an unknown source id and an unreadable one are answered differently and neither writes", async (t) => {
  const { root } = await makeImportRoot();
  const app = await startTestServer(undefined, { storePrefix: "formation-import-api-", imports: { resolveRoot: () => root } });
  t.after(app.close);
  const cookie = await login(app.baseUrl);
  const workspaceId = (await app.store.read()).workspaces[0].id;
  const before = JSON.stringify(await app.store.read());

  const unknown = await request(app.baseUrl, `/api/workspaces/${workspaceId}/imports`, { cookie, method: "POST", body: { sourceId: "absent" } });
  assert.equal(unknown.status, 404);

  const unnamed = await request(app.baseUrl, `/api/workspaces/${workspaceId}/imports`, { cookie, method: "POST", body: {} });
  assert.equal(unnamed.status, 400);

  const extra = await request(app.baseUrl, `/api/workspaces/${workspaceId}/imports`, { cookie, method: "POST", body: { sourceId: "ocho", workspaceId: "somebody-elses" } });
  assert.equal(extra.status, 400, "an import request must not accept a field the route does not name");

  assert.equal(JSON.stringify(await app.store.read()), before, "no refused import may leave a trace");
});

test("an engine that cannot be reached is reported as unreachable, never as an empty import", async () => {
  const { root } = await makeImportRoot();
  const service = new ImportService(await makeStore(), {
    resolveRoot: () => root,
    engine: { describeLaunchRepository: async () => ({ reachable: false, reason: "The launch engine is not installed on this server." }) },
  });
  await assert.rejects(
    () => service.preview({ workspace: createSeedDatabase().workspaces[0], sourceId: "ocho" }),
    (error) => error.status === 503 && /not installed/.test(error.message),
  );
});

test("a launch workspace with nothing in it is refused with the engine's own reason", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "formation-import-root-"));
  write(path.join(root, "blank"), "state/PROJECT_STATE.yaml", 'project:\n  name: "App Name"\n');
  const service = new ImportService(await makeStore(), { resolveRoot: () => root });
  await assert.rejects(
    () => service.preview({ workspace: createSeedDatabase().workspaces[0], sourceId: "blank" }),
    (error) => error.status === 409 && /untouched template/.test(error.message),
  );
});
