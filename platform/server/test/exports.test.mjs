import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFormationServer } from "../app.mjs";
import { buildWorkspaceSnapshot } from "../domain.mjs";
import { buildExportBundle, csvField, renderEconomicsCsv, renderExportMarkdown } from "../domain/exports.mjs";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";

/**
 * Taking the work out.
 *
 * Two things are worth a suite. **Lineage**, because a deliverable exported without the claims it
 * rests on is a conclusion with its reasoning removed, and that is the difference between an export
 * worth building and copy-and-paste. And **what does not leave** — a bundle is a document about the
 * work, and one that quietly carried a private argument between cofounders into a file the founder
 * mailed to an investor is the same failure as a shared link that did.
 */

const WORKSPACE = "wrk_storywell";
const NOW = "2026-08-07T09:00:00.000Z";

function snapshotOf(database = createSeedDatabase()) {
  return { database, snapshot: buildWorkspaceSnapshot(database, WORKSPACE, database.memberships[0].userId) };
}

async function startServer() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-exports-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();
  const { server } = createFormationServer({ store, allowDemoAuth: true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    store,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function signIn(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "founder@formation.local" }),
  });
  return response.headers.get("set-cookie").split(";")[0];
}

test("a deliverable exports with the claims it rests on, resolved to what they say", () => {
  const { snapshot } = snapshotOf();
  const bundle = buildExportBundle(snapshot, { exportedBy: "Maya Chen", now: NOW });
  const cited = bundle.deliverables.find((entry) => entry.lineage.restsOn.length > 0);
  assert.ok(cited, "the demo company should have at least one deliverable with sources");

  for (const claim of cited.lineage.restsOn) {
    assert.ok(claim.statement.length > 10, "a citation is what the claim says, not its id");
    assert.ok(["fact", "assumption", "recommendation", "question"].includes(claim.kind));
    assert.equal(typeof claim.confidence, "number");
  }
  assert.ok(!JSON.stringify(bundle).includes('"clm_'), "no record id should reach the bundle — an id is not lineage anyone can read");
});

test("a citation that cannot be resolved is counted rather than silently dropped", () => {
  const { database } = snapshotOf();
  const artifact = database.artifacts.find((entry) => entry.workspaceId === WORKSPACE);
  artifact.sourceClaimIds = [...artifact.sourceClaimIds, "clm_deleted_long_ago"];
  const snapshot = buildWorkspaceSnapshot(database, WORKSPACE, database.memberships[0].userId);
  const bundle = buildExportBundle(snapshot, { exportedBy: "Maya Chen", now: NOW });

  const exported = bundle.deliverables.find((entry) => entry.title === artifact.title);
  assert.equal(exported.lineage.unresolved, 1, "a reader must be able to tell 'cites nothing' from 'the citations were dropped on the way out'");
  assert.ok(renderExportMarkdown(bundle).includes("could not be resolved"));
});

test("nothing private leaves in the bundle", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const cookie = await signIn(app.baseUrl);

  const secret = "Privately, I do not trust the cofounder's numbers.";
  await fetch(`${app.baseUrl}/api/workspaces/${WORKSPACE}/comments`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ target: { kind: "workstream", id: "strategy" }, body: secret }),
  });

  const database = await app.store.read();
  const snapshot = buildWorkspaceSnapshot(database, WORKSPACE, database.memberships[0].userId);
  const serialized = JSON.stringify(buildExportBundle(snapshot, { exportedBy: "Maya Chen", now: NOW }));

  assert.ok(!serialized.includes(secret), "a private argument must not leave in a file the founder mails to an investor");
  for (const entry of ["@formation.local", '"sessions"', '"invitations"', '"reviews"', '"comments"', "usr_"]) {
    assert.ok(!serialized.includes(entry), `the bundle carried ${entry}`);
  }
});

test("the manifest says what was deliberately left out", () => {
  const { snapshot } = snapshotOf();
  const bundle = buildExportBundle(snapshot, { exportedBy: "Maya Chen", now: NOW });
  assert.ok(bundle.manifest.deliberatelyExcluded.length >= 3, "a reader who cannot see the omissions cannot tell a complete record from a filtered one");
  assert.ok(renderExportMarkdown(bundle).includes("deliberately leaves out"));
  assert.equal(bundle.manifest.exportedBy, "Maya Chen");
});

test("the markdown reads as a document, with lineage under each deliverable", () => {
  const { snapshot } = snapshotOf();
  const markdown = renderExportMarkdown(buildExportBundle(snapshot, { exportedBy: "Maya Chen", now: NOW }));

  assert.ok(markdown.startsWith("# Storywell"));
  for (const required of ["## The company", "## Decisions", "## Deliverables", "#### What this rests on", "## Claims and evidence", "## Open work"]) {
    assert.ok(markdown.includes(required), `the document is missing ${required}`);
  }
  assert.ok(!/\n{3,}/.test(markdown), "blank runs are collapsed so the document reads cleanly");
  assert.ok(markdown.endsWith("\n"));
});

test("a company with nothing recorded still exports a readable document", () => {
  const database = createSeedDatabase();
  const workspace = database.workspaces.find((entry) => entry.id === WORKSPACE);
  database.claims = [];
  database.decisions = [];
  database.artifacts = [];
  database.artifactVersions = [];
  database.tasks = [];
  for (const field of Object.keys(workspace.company)) workspace.company[field] = Array.isArray(workspace.company[field]) ? [] : "";

  const snapshot = buildWorkspaceSnapshot(database, WORKSPACE, database.memberships[0].userId);
  const markdown = renderExportMarkdown(buildExportBundle(snapshot, { exportedBy: "Maya Chen", now: NOW }));
  assert.ok(markdown.includes("_No decisions recorded._"));
  assert.ok(markdown.includes("_No claims recorded._"));
  assert.ok(markdown.includes("_Nothing outstanding._"));
  assert.ok(!markdown.includes("undefined"));
});

test("the economics csv keeps money in minor units and says so in the header", () => {
  const database = createSeedDatabase();
  const workspace = database.workspaces.find((entry) => entry.id === WORKSPACE);
  workspace.economics = {
    currency: "GBP",
    scenarios: [
      {
        id: "scn_1",
        name: "Annual, family",
        isPrimary: true,
        price: { amount: 7_900, per: "year" },
        variableCostPerCustomer: 1_200,
        acquisitionCost: 4_500,
        conversion: { visitorToTrial: null, trialToPaid: null },
        retention: { monthlyChurn: 2.5 },
        capacity: { weeklyHours: null, monthlyOperatingCost: null },
        cash: { onHand: 2_500_000, monthlyBurn: 180_000 },
        notes: "",
        createdAt: NOW,
        updatedAt: NOW,
        lastChangedBy: null,
      },
    ],
  };
  const snapshot = buildWorkspaceSnapshot(database, WORKSPACE, database.memberships[0].userId);
  const csv = renderEconomicsCsv(buildExportBundle(snapshot, { exportedBy: "Maya Chen", now: NOW }));
  const [header, row] = csv.trim().split("\n");

  assert.ok(header.includes("minor units"), "a column silently mixing pounds and pence is how a spreadsheet ends up off by a hundred");
  assert.ok(header.includes("GBP"));
  assert.equal(countFields(header), countFields(row), "every row has as many fields as the header");
  assert.ok(row.startsWith('"Annual, family"'), "a name containing a comma must be quoted, not allowed to become two columns");
  assert.ok(row.includes(",7900,"), "money stays in minor units on the way out");
});

/**
 * Fields in one CSV line, respecting quoting. A naive split on commas counts a quoted name
 * containing a comma as two fields, which is exactly the bug the quoting exists to prevent — so a
 * test that splits naively would report the correct output as broken.
 */
function countFields(line) {
  let fields = 1;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (character === "," && !quoted) {
      fields += 1;
    }
  }
  return fields;
}

test("csv escaping survives the values a founder can actually type", () => {
  assert.equal(csvField("plain"), "plain");
  assert.equal(csvField('say "hello"'), '"say ""hello"""');
  assert.equal(csvField("a, b"), '"a, b"');
  assert.equal(csvField("line\nbreak"), '"line\nbreak"');
  assert.equal(csvField(null), "");
  assert.equal(csvField(0), "0", "zero is a value, not an absence");
});

test("the route answers as a download, in each format, and refuses any other", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const cookie = await signIn(app.baseUrl);

  for (const [format, type, extension] of [
    ["markdown", "text/markdown", "md"],
    ["json", "application/json", "json"],
    ["csv", "text/csv", "csv"],
  ]) {
    const response = await fetch(`${app.baseUrl}/api/workspaces/${WORKSPACE}/export?format=${format}`, { headers: { cookie } });
    assert.equal(response.status, 200, `${format} should export`);
    assert.match(response.headers.get("content-type"), new RegExp(type));
    assert.match(response.headers.get("content-disposition"), new RegExp(`filename="storywell-\\d{4}-\\d{2}-\\d{2}\\.${extension}"`));
    assert.ok((await response.text()).length > 0);
  }

  const refused = await fetch(`${app.baseUrl}/api/workspaces/${WORKSPACE}/export?format=pdf`, { headers: { cookie } });
  assert.equal(refused.status, 400, "an unsupported format is refused rather than silently answered as something else");

  const defaulted = await fetch(`${app.baseUrl}/api/workspaces/${WORKSPACE}/export`, { headers: { cookie } });
  assert.match(defaulted.headers.get("content-type"), /text\/markdown/, "no format asked for means the readable one");
});

test("an export can only contain what the member asking could already read", async (t) => {
  const app = await startServer();
  t.after(app.close);
  const cookie = await signIn(app.baseUrl);

  const snapshot = await (await fetch(`${app.baseUrl}/api/workspaces/${WORKSPACE}`, { headers: { cookie } })).json();
  const exported = await (await fetch(`${app.baseUrl}/api/workspaces/${WORKSPACE}/export?format=json`, { headers: { cookie } })).json();

  assert.equal(exported.deliverables.length, snapshot.artifacts.length);
  assert.equal(exported.claims.length, snapshot.claims.length);
  assert.equal(exported.decisions.length, snapshot.decisions.length);
  assert.equal(exported.readiness.score, snapshot.readiness.score);
});
