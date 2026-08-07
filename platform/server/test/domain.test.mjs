import assert from "node:assert/strict";
import test from "node:test";
import {
  applyArtifactPatch,
  buildWorkspaceSnapshot,
  calculateReadiness,
  createGeneratedArtifact,
  createWorkspaceFromBrief,
  detectContradictions,
} from "../domain.mjs";
import { createSeedDatabase } from "../seed.mjs";

test("workspace snapshot exposes contradictions, recommendations, and weighted readiness", () => {
  const database = createSeedDatabase();
  const snapshot = buildWorkspaceSnapshot(database, "wrk_storywell", "usr_demo_founder");

  assert.ok(snapshot);
  assert.equal(snapshot.workspace.name, "Storywell");
  assert.equal(snapshot.contradictions.length, 1);
  assert.equal(snapshot.contradictions[0].key, "pricing.model");
  assert.ok(snapshot.readiness.score < snapshot.readiness.baseScore);
  assert.equal(snapshot.recommendations[0].kind, "resolve-contradiction");
});

test("readiness penalizes critical blockers instead of rewarding decorative progress", () => {
  const database = createSeedDatabase();
  const workspace = structuredClone(database.workspaces[0]);
  workspace.workstreams.forEach((stream) => {
    stream.progress = 90;
    stream.status = "on-track";
  });
  const baseline = calculateReadiness(workspace, [], []);
  workspace.workstreams[0].status = "blocked";
  const penalized = calculateReadiness(
    workspace,
    [{ workspaceId: workspace.id, workstreamId: "strategy", priority: "critical", status: "blocked", title: "Resolve proof" }],
    [{ workspaceId: workspace.id, workstreamId: "strategy", status: "open", title: "Choose wedge" }],
  );

  assert.equal(baseline.score, 90);
  assert.ok(penalized.score <= 80);
  assert.ok(penalized.blockers.includes("Resolve proof"));
  assert.equal(penalized.categories.find((category) => category.id === "foundation").status, "blocked");
});

test("readiness reports the deduction that produced the score, line by line", () => {
  const database = createSeedDatabase();
  const workspace = structuredClone(database.workspaces[0]);
  workspace.workstreams.forEach((stream) => {
    stream.progress = 90;
    stream.status = "on-track";
  });
  workspace.workstreams[0].status = "blocked";

  const readiness = calculateReadiness(
    workspace,
    [{ workspaceId: workspace.id, workstreamId: "strategy", priority: "critical", status: "blocked", title: "Resolve proof" }],
    [{ workspaceId: workspace.id, workstreamId: "strategy", status: "open", title: "Choose wedge" }],
  );

  const byId = Object.fromEntries(readiness.penalty.deductions.map((entry) => [entry.id, entry]));
  assert.deepEqual(byId.blocked, { id: "blocked", label: "Blocked workstreams", count: 1, points: 5 });
  assert.deepEqual(byId["critical-tasks"], { id: "critical-tasks", label: "Unfinished critical tasks", count: 1, points: 3 });
  assert.deepEqual(byId["open-decisions"], { id: "open-decisions", label: "Unresolved decisions", count: 1, points: 2 });

  // The founder-visible arithmetic must reconcile: base minus the shown deduction is the score.
  assert.equal(readiness.penalty.uncapped, 10);
  assert.equal(readiness.penalty.total, 10);
  assert.equal(readiness.penalty.capped, false);
  assert.equal(readiness.baseScore - readiness.penalty.applied, readiness.score);
});

test("every blocker keeps a reference to the record that causes it, without changing the string list", () => {
  const database = createSeedDatabase();
  const workspace = structuredClone(database.workspaces[0]);
  workspace.workstreams.forEach((stream) => {
    stream.progress = 90;
    stream.status = "on-track";
  });
  const strategy = workspace.workstreams.find((stream) => stream.id === "strategy");
  strategy.status = "blocked";

  const readiness = calculateReadiness(
    workspace,
    [{ id: "tsk_proof", workspaceId: workspace.id, workstreamId: "strategy", priority: "critical", status: "blocked", title: "Resolve proof" }],
    [{ id: "dec_wedge", workspaceId: workspace.id, workstreamId: "strategy", status: "open", title: "Choose wedge" }],
  );

  // The founder-facing string list is unchanged — prose still reads from it.
  assert.deepEqual(readiness.blockers, [strategy.nextAction, "Resolve proof", "Choose wedge"]);
  assert.deepEqual(readiness.blockerRefs, [
    { id: "strategy", kind: "workstream", label: strategy.nextAction },
    { id: "tsk_proof", kind: "task", label: "Resolve proof" },
    { id: "dec_wedge", kind: "decision", label: "Choose wedge" },
  ]);

  // Categories carry the same pairing, so a launch row can link to the record it names.
  const foundation = readiness.categories.find((category) => category.id === "foundation");
  assert.deepEqual(foundation.blockers, foundation.blockerRefs.map((ref) => ref.label));
  assert.deepEqual(foundation.blockerRefs.map((ref) => ref.kind), ["workstream", "task", "decision"]);
});

test("readiness caps the deduction and says so instead of scoring below the cap", () => {
  const database = createSeedDatabase();
  const workspace = structuredClone(database.workspaces[0]);
  workspace.workstreams.forEach((stream) => {
    stream.progress = 90;
    stream.status = "blocked";
  });

  const readiness = calculateReadiness(workspace, [], []);

  assert.equal(readiness.penalty.uncapped, workspace.workstreams.length * 5);
  assert.equal(readiness.penalty.total, readiness.penalty.cap);
  assert.equal(readiness.penalty.capped, true);
  assert.equal(readiness.score, readiness.baseScore - readiness.penalty.cap);
  assert.equal(readiness.baseScore - readiness.penalty.applied, readiness.score);
});

test("contradiction detection ignores resolved claims and groups active values by semantic key", () => {
  const contradictions = detectContradictions([
    { id: "1", key: "pricing.model", value: "annual", status: "active", kind: "assumption", statement: "Annual", workstreamId: "money" },
    { id: "2", key: "pricing.model", value: "lifetime", status: "active", kind: "fact", statement: "Lifetime", workstreamId: "strategy" },
    { id: "3", key: "pricing.model", value: "monthly", status: "resolved", kind: "assumption", statement: "Monthly", workstreamId: "money" },
  ]);

  assert.equal(contradictions.length, 1);
  assert.equal(contradictions[0].severity, "high");
  assert.deepEqual(contradictions[0].claimIds, ["1", "2"]);
});

test("a contradiction keeps each conflicting claim individually attributable", () => {
  const contradictions = detectContradictions([
    { id: "1", key: "pricing.model", value: "annual", status: "active", kind: "assumption", statement: "Annual subscription.", workstreamId: "money" },
    { id: "2", key: "pricing.model", value: "lifetime", status: "active", kind: "fact", statement: "One-time archive.", workstreamId: "strategy" },
  ]);

  // The founder-facing surfaces label each statement by kind; the joined summary stays for compatibility.
  assert.deepEqual(contradictions[0].entries, [
    { claimId: "1", kind: "assumption", workstreamId: "money", statement: "Annual subscription." },
    { claimId: "2", kind: "fact", workstreamId: "strategy", statement: "One-time archive." },
  ]);
  assert.equal(contradictions[0].summary, "Annual subscription. / One-time archive.");
});

test("onboarding creates a durable company model rather than a disconnected report", () => {
  const bundle = createWorkspaceFromBrief({
    userId: "usr_1",
    existingSlugs: ["acme"],
    brief: {
      name: "Acme",
      founderName: "Jordan",
      oneLiner: "Acme helps local shops coordinate same-day delivery.",
      targetCustomer: "Independent shop owners",
      problem: "Delivery coordination is fragmented and unreliable.",
      solution: "A shared dispatch workspace for local merchant networks.",
      currentGoal: "Validate willingness to pay with ten merchants.",
    },
  });

  assert.equal(bundle.workspace.slug, "acme-2");
  assert.equal(bundle.workspace.workstreams.length, 8);
  assert.equal(bundle.artifacts[0].type, "business-snapshot");
  assert.equal(bundle.artifactVersions[0].version, 1);
  assert.equal(bundle.tasks[0].priority, "critical");
  assert.equal(bundle.membership.role, "owner");
});

test("generated artifacts are structured and every edit creates a new version", () => {
  const database = createSeedDatabase();
  const workspace = database.workspaces[0];
  const workstream = workspace.workstreams.find((entry) => entry.id === "business-model");
  const artifact = createGeneratedArtifact({ workspace, workstream, artifactType: "business-model" });
  const edited = applyArtifactPatch(artifact, {
    status: "reviewed",
    sections: [{ id: artifact.sections[0].id, title: "Commercial thesis", body: "Charge for the durable family outcome." }],
  });

  assert.equal(artifact.version, 1);
  assert.equal(edited.version, 2);
  assert.equal(edited.status, "reviewed");
  assert.equal(edited.sections[0].title, "Commercial thesis");
});


test("revisit decisions remain unresolved and reduce readiness", () => {
  const database = createSeedDatabase();
  const workspace = structuredClone(database.workspaces[0]);
  workspace.workstreams.forEach((stream) => {
    stream.progress = 85;
    stream.status = "on-track";
  });
  const readiness = calculateReadiness(workspace, [], [
    { workspaceId: workspace.id, workstreamId: "business-model", status: "revisit", title: "Revisit pricing model" },
  ]);

  assert.equal(readiness.openDecisionCount, 1);
  assert.ok(readiness.score < readiness.baseScore);
  assert.equal(readiness.categories.find((category) => category.id === "offer").status, "blocked");
});

test("deterministic generation stays company-generic and does not create comparison conflicts", () => {
  const bundle = createWorkspaceFromBrief({
    userId: "usr_generic",
    brief: {
      name: "Relay",
      founderName: "Jordan",
      oneLiner: "Relay helps local nonprofits coordinate volunteers.",
      targetCustomer: "Volunteer coordinators at local nonprofits",
      problem: "Scheduling fragments across messages and spreadsheets.",
      solution: "A shared coordination workspace.",
      currentGoal: "Validate weekly use with six organizations.",
      northStarMetric: "A coordinator fills a volunteer shift and repeats the workflow the next week.",
    },
  });
  const gtm = bundle.workspace.workstreams.find((entry) => entry.id === "go-to-market");
  const launch = bundle.workspace.workstreams.find((entry) => entry.id === "launch");
  const gtmArtifact = createGeneratedArtifact({ workspace: bundle.workspace, workstream: gtm, artifactType: "go-to-market-brief" });
  const launchArtifact = createGeneratedArtifact({ workspace: bundle.workspace, workstream: launch, artifactType: "launch-plan" });
  const text = [...gtmArtifact.sections, ...launchArtifact.sections].map((section) => section.body).join(" ");

  assert.doesNotMatch(text, /family|story|recording|app store/i);
  assert.match(text, /volunteer shift/i);
});
