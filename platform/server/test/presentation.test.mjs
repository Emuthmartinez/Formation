import assert from "node:assert/strict";
import test from "node:test";
import { presentApprovalAsk, presentMatrixService, presentMatrixTool, presentStep } from "../domain/presentation.mjs";
import { syncEngineApprovals } from "../domain/approvals.mjs";
import { founderRunView } from "../execution.mjs";
import { createSeedDatabase } from "../seed.mjs";

test("a known catalog step is presented in board language with the engine's name preserved", () => {
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
