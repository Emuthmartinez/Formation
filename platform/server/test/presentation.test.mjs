import assert from "node:assert/strict";
import test from "node:test";
import { presentApprovalAsk, presentMatrixKnowledge, presentMatrixService, presentMatrixTool, presentStep } from "../domain/presentation.mjs";
import { syncEngineApprovals } from "../domain/approvals.mjs";
import { founderRunView } from "../execution.mjs";
import { createSeedDatabase } from "../seed.mjs";

test("a known catalog step is presented in board language with the skill's name preserved", () => {
  const step = presentStep("workflow.store.asc-cli-automation", "ASC CLI automation");
  assert.equal(step.title, "App Store submission automation");
  assert.ok(step.summary && step.summary.length > 0);
  assert.equal(step.technical, "ASC CLI automation");
  // The board layer never leaks tool jargon upward.
  assert.doesNotMatch(step.title, /\bCLI\b|\bASC\b/);
});

test("an unknown step falls back to a conservative jargon scrub and keeps the original", () => {
  const step = presentStep("workflow.future.some-new-lane", "GEO/SEO ops via CLI");
  assert.doesNotMatch(step.title, /\bCLI\b|GEO\/SEO/);
  assert.equal(step.technical, "GEO/SEO ops via CLI");
  // Text that is already founder-plain passes through untouched, with nothing to disclose.
  const plain = presentStep("workflow.future.other", "Interview five families");
  assert.equal(plain.title, "Interview five families");
  assert.equal(plain.technical, null);
});

test("approval asks are restated as the decision the founder is actually making", () => {
  assert.equal(
    presentApprovalAsk("approve exact authenticated actions", "credentials_access"),
    "Approve the specific actions the team may take inside your accounts.",
  );
  // Unknown ask: the protected category still explains what saying yes means.
  assert.equal(presentApprovalAsk("frobnicate the widget", "spend"), "Give your go-ahead on a step that spends money.");
  assert.equal(presentApprovalAsk("frobnicate the widget", undefined), "Give your go-ahead so this step can continue.");
});

test("matrix services and specialist routes keep raw engine copy inside technical detail", () => {
  const service = presentMatrixService(
    { id: "provider.fixture", name: "Fixture API", purpose: "Supports workflow.provider proof", state: "verified", checkedAt: "2026-08-17T00:00:00.000Z" },
    "Customer payments",
  );
  assert.equal(service.access, "Access proven");
  assert.equal(service.purpose, "Helps complete Customer payments.");
  assert.equal(service.technical.id, "provider.fixture");
  assert.equal("id" in service, false);
  assert.equal("state" in service, false);

  const tool = presentMatrixTool({ id: "xcode-device-route", when: "Use for simulator proof." }, "iPhone build verification");
  assert.equal(tool.name, "Device testing support");
  assert.equal(tool.technical.id, "xcode-device-route");
  assert.equal("id" in tool, false);
  assert.equal("when" in tool, false);
});

test("board tables never carry internal vocabulary a founder should not have to parse", () => {
  // check:founder-copy scans the skill's generated business surfaces, not this module — so the
  // board tables get their own scan here. These are the internal words the house style bans from
  // founder-visible text (tooling/lib/founder-copy.ts); titles and summaries must not use them.
  const banned = /\b(proof|proven|gate|lane|workflow|pipeline|CLI|repo|ASO|SEO|UGC|MCP)\b/u;
  for (const id of [
    "workflow.process.provider-proof-verification",
    "workflow.process.launchbench-failure-cards-coverage-audit",
    "workflow.process.change-cascade",
    "workflow.process.launch-trace-and-build-contracts",
    "workflow.process.business-control-plane-extension",
    "workflow.orchestration.session-continuity-resume",
    "workflow.orchestration.orient-scaffold-and-state-cockpit-upkeep",
  ]) {
    const step = presentStep(id, "Engine title");
    assert.doesNotMatch(step.title, banned, `${id} title leaks internal vocabulary`);
    if (step.summary) assert.doesNotMatch(step.summary, banned, `${id} summary leaks internal vocabulary`);
  }
});

test("matrix knowledge guides never leak agent-routing prose above technical detail", () => {
  const guide = presentMatrixKnowledge(
    {
      id: "reference.experience.experience-cards.streak",
      title: "Streak And Loss Aversion Card",
      path: "knowledge/experience/experience-cards/streak-and-loss-aversion-card.md",
      loadWhen: "HIGH-risk: a streak mechanic is in play — routed from experience-cards.md; see check:emotional-design",
      freshness: "reviewed 2026-05-14",
      reviewStatus: "current",
    },
    "Emotional design of the product",
  );
  // The agent-facing trigger — file routing, check names, risk labels — stays in technical detail.
  assert.equal("loadWhen" in guide, false);
  assert.doesNotMatch(guide.name, /routed from|check:|HIGH-risk/);
  assert.doesNotMatch(guide.purpose, /routed from|check:|HIGH-risk/);
  assert.doesNotMatch(guide.freshness, /routed from|check:|HIGH-risk/);
  assert.equal(guide.purpose, "The playbook the team follows for Emotional design of the product.");
  assert.equal(guide.freshness, "Sources checked 2026-05-14");
  assert.equal(guide.technical.loadWhen.includes("routed from experience-cards.md"), true);
  assert.equal(guide.technical.path, "knowledge/experience/experience-cards/streak-and-loss-aversion-card.md");

  // An overdue source review reads as a verdict, not a date the founder must interpret.
  const overdue = presentMatrixKnowledge(
    { id: "reference.x", title: "ASO store ops", path: "knowledge/store/aso-store-ops.md", loadWhen: "before ASO audits", freshness: "reviewed 2026-01-01", reviewStatus: "review-due" },
    "App store visibility",
  );
  assert.equal(overdue.freshness, "A source check is due");
  assert.equal(overdue.reviewStatus, "review-due");
  assert.doesNotMatch(overdue.name, /\bASO\b/);

  // Internal references say so in plain words.
  const internal = presentMatrixKnowledge(
    { id: "reference.y", title: "Launch phases", path: "knowledge/process/launch-phases.md", loadWhen: "any multi-phase launch", freshness: "internal", reviewStatus: "internal" },
    "Launch planning",
  );
  assert.equal(internal.freshness, "Maintained with the product");
});

test("the founder run view presents steps board-first and carries the technical name alongside", () => {
  const view = founderRunView({
    generatedAt: "2026-08-06T00:00:00.000Z",
    hasDurableRun: true,
    autonomyUnset: false,
    workflows: [
      { workflowId: "workflow.growth.fastlane-growth-ops", title: "Fastlane growth ops", status: "held", founderReason: "This needs your decision before I can continue." },
    ],
  });
  assert.equal(view.steps[0].title, "Social media operations");
  assert.equal(view.steps[0].technical, "Fastlane growth ops");
  assert.ok(view.steps[0].summary.includes("approval"));
});

test("re-syncing an open approval mirror refreshes its presentation without touching the answer path", () => {
  const database = createSeedDatabase();
  const workspace = database.workspaces[0];
  const report = (description) => ({
    workspaceReady: true,
    runId: "run_present_1",
    planId: "plan_present_1",
    approvals: [{
      approvalId: "workflow.money.revenue-monetization.approval.1",
      workflowId: "workflow.money.revenue-monetization",
      workflowTitle: "Revenue monetization",
      description,
      status: "pending",
      protectedCategory: "legal_pricing",
    }],
  });

  const first = syncEngineApprovals(database, workspace, report("approve pricing and product catalog"), "2026-08-06T01:00:00.000Z");
  assert.equal(first.created.length, 1);
  const mirror = first.created[0];
  assert.equal(mirror.title, "Your go-ahead: Pricing and revenue");
  assert.equal(mirror.decision, "Approve the pricing and what is offered for sale.");
  assert.equal(mirror.source.workflowTitle, "Revenue monetization");
  assert.equal(mirror.source.description, "approve pricing and product catalog");

  // Simulate a record created before the board table existed: stale copy refreshes in place,
  // while identity, status, and the answer stay untouched.
  mirror.title = "Launch approval: Revenue monetization";
  mirror.decision = "approve pricing and product catalog";
  const second = syncEngineApprovals(database, workspace, report("approve pricing and product catalog"), "2026-08-06T02:00:00.000Z");
  assert.equal(second.created.length, 0);
  assert.equal(mirror.title, "Your go-ahead: Pricing and revenue");
  assert.equal(mirror.decision, "Approve the pricing and what is offered for sale.");
  assert.equal(mirror.status, "open");
  assert.equal(mirror.answer, null);
});
