import assert from "node:assert/strict";
import test from "node:test";
import { deriveScenario, emptyScenario, economicsView, sensitivity, updateScenario } from "../domain/economics.mjs";

/**
 * Structured economics.
 *
 * Two properties carry the whole design, and both are easy to lose:
 *
 * 1. **A derived figure is never stored.** Every one is recomputed from the inputs, so a price
 *    change cannot leave a stale margin behind. The suites here never assert a stored derivation —
 *    they change an input and check the output moved.
 * 2. **A missing input produces null and says what is missing, never zero.** A margin of 0% and a
 *    margin of "you have not said what a customer costs you" lead to entirely different
 *    conversations, and the second is far more common in a company still working this out.
 */

const NOW = "2026-08-07T00:00:00.000Z";
const actor = { name: "Maya Chen" };

/** A workspace-shaped holder, since the mutations operate on one. */
function workspaceWith(scenario) {
  return { id: "wrk", economics: { currency: "GBP", scenarios: [scenario] } };
}

/** A complete monthly-subscription scenario: £79/mo, £9 to serve, 4% churn, £120 to acquire. */
function complete() {
  return {
    ...emptyScenario("Monthly", "GBP", NOW),
    price: { amount: 7_900, per: "month" },
    variableCostPerCustomer: 900,
    retention: { monthlyChurn: 4 },
    acquisitionCost: 12_000,
    cash: { onHand: 4_000_000, monthlyBurn: 250_000 },
  };
}

test("a blank scenario derives nothing, and says what each figure is waiting for", () => {
  const derived = deriveScenario(emptyScenario("Blank", "GBP", NOW));
  for (const [name, figure] of Object.entries(derived)) {
    assert.equal(figure.value, null, `${name} must be absent, not zero — zero is an answer and absence is not`);
    assert.ok(figure.missing.length > 0, `${name} must say what it is waiting for`);
    for (const missing of figure.missing) {
      assert.ok(/[a-z]/.test(missing) && missing.length > 5, `${name} names a missing input a founder can act on: got ${JSON.stringify(missing)}`);
    }
  }
});

test("a complete scenario derives the figures a founder actually asks about", () => {
  const derived = deriveScenario(complete());
  assert.equal(derived.grossMargin.value, 88.6, "(7900 - 900) / 7900");
  assert.equal(derived.monthlyContribution.value, 7_000);
  assert.equal(derived.lifetimeMonths.value, 25, "1 / 4%");
  assert.equal(derived.lifetimeValue.value, 175_000, "7000 × 25 months");
  assert.equal(derived.ltvToCac.value, 14.58);
  assert.equal(derived.paybackMonths.value, 1.7, "12000 / 7000");
  assert.equal(derived.runwayMonths.value, 16, "4,000,000 / 250,000");
  assert.equal(derived.customersToBreakEven.value, 36, "250000 / 7000, rounded up — a fractional customer does not pay");
  for (const figure of Object.values(derived)) assert.deepEqual(figure.missing, []);
});

test("a yearly price is compared on the same monthly footing as a monthly one", () => {
  const yearly = { ...complete(), price: { amount: 94_800, per: "year" }, variableCostPerCustomer: 10_800 };
  const monthly = deriveScenario(complete());
  const annual = deriveScenario(yearly);
  assert.equal(annual.monthlyContribution.value, monthly.monthlyContribution.value, "£948/yr and £79/mo are the same monthly contribution");
  assert.equal(annual.grossMargin.value, monthly.grossMargin.value);
});

test("a one-time price has no monthly form, and says so rather than inventing one", () => {
  const oneOff = { ...complete(), price: { amount: 4_900, per: "one-time" } };
  const derived = deriveScenario(oneOff);
  assert.equal(derived.monthlyContribution.value, null);
  assert.ok(derived.monthlyContribution.missing.some((entry) => /recurring price/.test(entry)));
  assert.equal(derived.lifetimeValue.value, null, "a lifetime of a purchase made once is not a lifetime");
});

test("zero churn is unbounded rather than infinite, and is reported as absent", () => {
  const derived = deriveScenario({ ...complete(), retention: { monthlyChurn: 0 } });
  assert.equal(derived.lifetimeMonths.value, null, "a plan built on an unbounded customer life is not a plan");
  assert.notEqual(derived.lifetimeMonths.value, Infinity);
  assert.ok(derived.lifetimeMonths.missing.some((entry) => /above zero/.test(entry)));
  assert.equal(derived.lifetimeValue.value, null);
});

test("a zero denominator anywhere produces absence, never infinity and never a crash", () => {
  const cases = [
    { ...complete(), acquisitionCost: 0 },
    { ...complete(), cash: { onHand: 4_000_000, monthlyBurn: 0 } },
    { ...complete(), price: { amount: 900, per: "month" }, variableCostPerCustomer: 900 },
  ];
  for (const scenario of cases) {
    const derived = deriveScenario(scenario);
    for (const [name, figure] of Object.entries(derived)) {
      assert.ok(figure.value === null || Number.isFinite(figure.value), `${name} produced ${figure.value}`);
    }
  }
});

test("a cost above the price is a negative margin, which is a real answer and is reported as one", () => {
  const derived = deriveScenario({ ...complete(), variableCostPerCustomer: 9_900 });
  assert.equal(derived.grossMargin.value, -25.3);
  assert.equal(derived.monthlyContribution.value, -2_000);
  assert.equal(derived.paybackMonths.value, null, "money that never comes back has no payback period");
  assert.equal(derived.customersToBreakEven.value, null, "and no number of customers breaks even");
});

test("nothing derived is stored — changing an input moves every figure that depends on it", () => {
  const workspace = workspaceWith(complete());
  const before = economicsView(workspace);
  const scenarioId = workspace.economics.scenarios[0].id;

  updateScenario(workspace, workspace, scenarioId, { price: { amount: 15_800, per: "month" } }, actor, NOW);
  const after = economicsView(workspace);

  assert.notEqual(after.scenarios[0].derived.grossMargin.value, before.scenarios[0].derived.grossMargin.value);
  assert.notEqual(after.scenarios[0].derived.lifetimeValue.value, before.scenarios[0].derived.lifetimeValue.value);
  assert.ok(!("derived" in workspace.economics.scenarios[0]), "a derivation must not be written back onto the record it came from");
});

test("sensitivity ranks by how much each input actually moves the figure, and the ranking responds to the model", () => {
  const report = sensitivity(complete(), "lifetimeValue");
  assert.ok(report.base > 0);
  assert.ok(report.inputs.length >= 3);
  for (let index = 1; index < report.inputs.length; index += 1) {
    assert.ok(report.inputs[index - 1].swingPercent >= report.inputs[index].swingPercent, "the loudest input must come first");
  }

  // At an 89% margin, price leads: a fifth off the price takes a fifth and a bit off the
  // contribution, while a fifth off churn stretches a customer's life by less than that. Price
  // stops leading only when the marginal cost of a customer is close to nothing, which is the
  // case below — the ranking is arithmetic about this company, not a fixed order.
  assert.equal(report.inputs[0].label, "price");

  const almostFree = sensitivity({ ...complete(), variableCostPerCustomer: 50 }, "lifetimeValue");
  assert.equal(almostFree.inputs[0].label, "monthly churn", "with almost no cost to serve, churn is what the plan rests on");

  // Acquisition cost does not enter the lifetime value at all. Listing it at 0% under "what this
  // plan rests on" would say the opposite of what is true.
  assert.ok(!report.inputs.some((entry) => entry.label === "acquisition cost"), "an input the figure does not depend on must not be listed");
  assert.ok(report.inputs.every((entry) => entry.swingPercent > 0));
});

test("sensitivity on a figure that cannot be computed reports nothing rather than guessing", () => {
  const report = sensitivity(emptyScenario("Blank", "GBP", NOW), "lifetimeValue");
  assert.equal(report.base, null);
  assert.deepEqual(report.inputs, []);
});

test("inputs are validated as money in minor units, rates as percentages, hours as hours", () => {
  const workspace = workspaceWith(complete());
  const id = workspace.economics.scenarios[0].id;
  const rejects = [
    [{ price: { amount: 79.5, per: "month" } }, /whole number/],
    [{ price: { amount: -100, per: "month" } }, /negative/],
    [{ price: { amount: 100, per: "fortnight" } }, /monthly, yearly, or once/],
    [{ acquisitionCost: 1.5 }, /whole number/],
    [{ retention: { monthlyChurn: 140 } }, /between 0 and 100/],
    [{ capacity: { weeklyHours: 200 } }, /between 0 and 168/],
    [{ cash: { onHand: -1 } }, /negative/],
  ];
  for (const [patch, expected] of rejects) {
    assert.throws(() => updateScenario(workspace, workspace, id, patch, actor, NOW), expected, `expected ${JSON.stringify(patch)} to be refused`);
  }
  assert.equal(workspace.economics.scenarios[0].price.amount, 7_900, "a refused change must leave the scenario as it was");
});

test("a company keeps exactly one primary scenario, the way it keeps one owner", () => {
  const workspace = workspaceWith(complete());
  workspace.economics.scenarios[0].isPrimary = true;
  const second = emptyScenario("Annual", "GBP", NOW);
  workspace.economics.scenarios.push(second);

  updateScenario(workspace, workspace, second.id, { isPrimary: true }, actor, NOW);
  const primaries = workspace.economics.scenarios.filter((entry) => entry.isPrimary);
  assert.equal(primaries.length, 1);
  assert.equal(primaries[0].id, second.id);
});

test("the view reads the primary scenario for sensitivity, and survives a company with none", () => {
  const workspace = workspaceWith(complete());
  workspace.economics.scenarios[0].isPrimary = true;
  assert.ok(economicsView(workspace).sensitivity.base > 0);

  assert.deepEqual(economicsView({ id: "wrk" }), { currency: "GBP", scenarios: [], sensitivity: null });
});
