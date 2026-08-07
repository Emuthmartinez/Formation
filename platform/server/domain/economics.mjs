import { createId } from "./shared.mjs";

/**
 * The company's money, as structured assumptions rather than numbers written into prose.
 *
 * A founder's economics live in sentences today — "roughly £79 a year, maybe 3% churn" — scattered
 * across a business model field, a pricing field, and whatever a deliverable happened to say when
 * it was drafted. Nothing checks that those numbers agree with each other, and nothing recomputes
 * when one of them moves.
 *
 * Two rules make this different from a spreadsheet pasted into a document:
 *
 * **A derived figure is never stored.** Gross margin, lifetime value, payback, runway, customers to
 * break even — every one is computed from the inputs on read. Storing them means storing a second
 * copy of the truth that drifts the moment somebody edits a price and nobody recomputes, which is
 * precisely the contradiction this product exists to prevent.
 *
 * **A figure with a missing input is null, not zero.** Zero is an answer; absence is not. A margin
 * of "0%" and a margin of "you have not said what a customer costs you" lead to entirely different
 * conversations, and the second is far more common in a company still working this out. Every
 * derivation names which inputs it needs so the surface can say what is missing rather than render
 * a confident nothing.
 *
 * Money is held in **minor units as integers** — pence, cents — never as a decimal. A planning
 * model that accumulates float error is a planning model that eventually disagrees with itself
 * about a number the founder typed in exactly.
 */

export const BILLING_PERIODS = Object.freeze(["month", "year", "one-time"]);
export const ECONOMICS_LIMITS = Object.freeze({
  scenariosPerWorkspace: 12,
  name: 120,
  notes: 4_000,
  /** £10,000,000 in minor units. Above this a founder has mistyped rather than priced. */
  money: 1_000_000_000,
});

const MONTHS_PER_YEAR = 12;

export class EconomicsError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "EconomicsError";
    this.status = status;
  }
}

/** A blank scenario: every field absent, because a company that has not decided has not decided. */
export function emptyScenario(name, currency, now) {
  return {
    id: createId("scn"),
    name,
    currency,
    isPrimary: false,
    price: { amount: null, per: "month" },
    conversion: { visitorToTrial: null, trialToPaid: null },
    retention: { monthlyChurn: null },
    variableCostPerCustomer: null,
    acquisitionCost: null,
    capacity: { weeklyHours: null, monthlyOperatingCost: null },
    cash: { onHand: null, monthlyBurn: null },
    notes: "",
    createdAt: now,
    updatedAt: now,
    lastChangedBy: null,
  };
}

const isMoney = (value) => Number.isInteger(value) && value >= 0 && value <= ECONOMICS_LIMITS.money;
const isPercent = (value) => Number.isFinite(value) && value >= 0 && value <= 100;

/** Price expressed per month, whatever period it is billed on. One-time revenue has no monthly form. */
function monthlyPrice(scenario) {
  const { amount, per } = scenario.price ?? {};
  if (!isMoney(amount)) return null;
  if (per === "month") return amount;
  if (per === "year") return amount / MONTHS_PER_YEAR;
  return null;
}

function monthlyVariableCost(scenario) {
  const cost = scenario.variableCostPerCustomer;
  if (!isMoney(cost)) return null;
  const per = scenario.price?.per;
  if (per === "month") return cost;
  if (per === "year") return cost / MONTHS_PER_YEAR;
  return null;
}

/**
 * One derived figure: its value, the unit it is in, and — when it could not be computed — exactly
 * which inputs are missing. The surface renders the second case as a prompt rather than a blank.
 */
function figure(value, unit, missing = []) {
  return { value: missing.length ? null : value, unit, missing };
}

function missingFrom(checks) {
  return checks.filter(([, present]) => !present).map(([name]) => name);
}

/**
 * Everything that follows from one scenario's inputs. Pure, and recomputed on every read — see the
 * module note on why none of this is stored.
 */
export function deriveScenario(scenario) {
  const price = monthlyPrice(scenario);
  const variable = monthlyVariableCost(scenario);
  const churn = scenario.retention?.monthlyChurn;
  const cac = scenario.acquisitionCost;
  const burn = scenario.cash?.monthlyBurn;
  const onHand = scenario.cash?.onHand;
  const oneTime = scenario.price?.per === "one-time";

  const contribution = price !== null && variable !== null ? price - variable : null;

  const grossMargin = figure(
    price !== null && variable !== null && price > 0 ? round((price - variable) / price * 100, 1) : null,
    "percent",
    missingFrom([
      ["a price", price !== null || (oneTime && isMoney(scenario.price?.amount))],
      ["what one customer costs you", isMoney(scenario.variableCostPerCustomer)],
    ]),
  );

  const monthlyContribution = figure(contribution === null ? null : round(contribution, 0), "money", missingFrom([
    ["a recurring price", price !== null],
    ["what one customer costs you", variable !== null],
  ]));

  // A customer's expected life is the reciprocal of the rate at which they leave. At zero churn it
  // is unbounded, which is not a number a plan should be built on, so it is reported as absent.
  const lifetimeMonths = figure(
    isPercent(churn) && churn > 0 ? round(100 / churn, 1) : null,
    "months",
    missingFrom([["a monthly churn rate above zero", isPercent(churn) && churn > 0]]),
  );

  const lifetimeValue = figure(
    contribution !== null && lifetimeMonths.value !== null ? round(contribution * lifetimeMonths.value, 0) : null,
    "money",
    missingFrom([
      ["a recurring price", price !== null],
      ["what one customer costs you", variable !== null],
      ["a monthly churn rate above zero", lifetimeMonths.value !== null],
    ]),
  );

  const ltvToCac = figure(
    lifetimeValue.value !== null && isMoney(cac) && cac > 0 ? round(lifetimeValue.value / cac, 2) : null,
    "ratio",
    missingFrom([
      ["a lifetime value", lifetimeValue.value !== null],
      ["an acquisition cost above zero", isMoney(cac) && cac > 0],
    ]),
  );

  const paybackMonths = figure(
    isMoney(cac) && contribution !== null && contribution > 0 ? round(cac / contribution, 1) : null,
    "months",
    missingFrom([
      ["an acquisition cost", isMoney(cac)],
      ["a monthly contribution above zero", contribution !== null && contribution > 0],
    ]),
  );

  const runwayMonths = figure(
    isMoney(onHand) && isMoney(burn) && burn > 0 ? round(onHand / burn, 1) : null,
    "months",
    missingFrom([
      ["cash on hand", isMoney(onHand)],
      ["a monthly burn above zero", isMoney(burn) && burn > 0],
    ]),
  );

  const customersToBreakEven = figure(
    isMoney(burn) && contribution !== null && contribution > 0 ? Math.ceil(burn / contribution) : null,
    "customers",
    missingFrom([
      ["a monthly burn", isMoney(burn)],
      ["a monthly contribution above zero", contribution !== null && contribution > 0],
    ]),
  );

  return { grossMargin, monthlyContribution, lifetimeMonths, lifetimeValue, ltvToCac, paybackMonths, runwayMonths, customersToBreakEven };
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * How much each derived figure moves when one input is wrong by a fifth in either direction.
 *
 * The point is not the arithmetic — it is that a founder can see which assumption their plan
 * actually rests on. A model where a 20% error in churn halves the lifetime value and a 20% error
 * in price barely moves it is telling you which number to go and check.
 */
export function sensitivity(scenario, figureName = "lifetimeValue") {
  const inputs = [
    { label: "price", apply: (value, factor) => ({ ...value, price: { ...value.price, amount: scale(value.price?.amount, factor) } }) },
    { label: "what a customer costs you", apply: (value, factor) => ({ ...value, variableCostPerCustomer: scale(value.variableCostPerCustomer, factor) }) },
    { label: "monthly churn", apply: (value, factor) => ({ ...value, retention: { ...value.retention, monthlyChurn: scalePercent(value.retention?.monthlyChurn, factor) } }) },
    { label: "acquisition cost", apply: (value, factor) => ({ ...value, acquisitionCost: scale(value.acquisitionCost, factor) }) },
  ];

  const base = deriveScenario(scenario)[figureName]?.value ?? null;
  if (base === null) return { figure: figureName, base: null, inputs: [] };

  return {
    figure: figureName,
    base,
    inputs: inputs
      .map(({ label, apply }) => {
        const lower = deriveScenario(apply(scenario, 0.8))[figureName]?.value ?? null;
        const higher = deriveScenario(apply(scenario, 1.2))[figureName]?.value ?? null;
        if (lower === null || higher === null) return null;
        const swing = Math.abs(higher - lower);
        return { label, lower, higher, swingPercent: base === 0 ? null : round((swing / Math.abs(base)) * 100, 1) };
      })
      .filter(Boolean)
      // An input the figure does not depend on at all — acquisition cost against lifetime value —
      // moves it by nothing, and listing it under "what this plan rests on" says the opposite of
      // what is true. Silence about an irrelevant input is the accurate answer.
      .filter((entry) => (entry.swingPercent ?? 0) > 0)
      // Loudest first: the assumption the plan rests on is the one worth checking today.
      .sort((a, b) => (b.swingPercent ?? 0) - (a.swingPercent ?? 0)),
  };
}

const scale = (value, factor) => (isMoney(value) ? Math.round(value * factor) : value);
const scalePercent = (value, factor) => (isPercent(value) ? Math.min(100, round(value * factor, 2)) : value);

// ---------------------------------------------------------------------------
// Mutations. Every one runs inside a store transaction.
// ---------------------------------------------------------------------------

export function createScenario(database, workspace, { name, currency, actor }, now) {
  const scenarios = workspace.economics?.scenarios ?? [];
  if (scenarios.length >= ECONOMICS_LIMITS.scenariosPerWorkspace) {
    throw new EconomicsError(429, "This company has as many pricing scenarios as Formation will keep. Remove one before adding another.");
  }
  const scenario = emptyScenario(name, currency, now);
  scenario.lastChangedBy = actor.name;
  // The first scenario a company records is the one everything else reads by default.
  scenario.isPrimary = scenarios.length === 0;
  workspace.economics = { currency: workspace.economics?.currency ?? currency, scenarios: [...scenarios, scenario] };
  return scenario;
}

const MONEY_FIELDS = Object.freeze(["variableCostPerCustomer", "acquisitionCost"]);

export function updateScenario(database, workspace, scenarioId, patch, actor, now) {
  const scenario = (workspace.economics?.scenarios ?? []).find((entry) => entry.id === scenarioId);
  if (!scenario) throw new EconomicsError(404, "That scenario is no longer here.");

  if (patch.name !== undefined) scenario.name = patch.name;
  if (patch.notes !== undefined) scenario.notes = patch.notes;

  if (patch.price !== undefined) {
    const amount = patch.price?.amount ?? null;
    const per = patch.price?.per ?? scenario.price.per;
    if (amount !== null && !isMoney(amount)) throw new EconomicsError(400, "A price is a whole number of pence, cents, or equivalent, and not a negative one.");
    if (!BILLING_PERIODS.includes(per)) throw new EconomicsError(400, "A price is charged monthly, yearly, or once.");
    scenario.price = { amount, per };
  }

  for (const field of MONEY_FIELDS) {
    if (patch[field] === undefined) continue;
    const value = patch[field];
    if (value !== null && !isMoney(value)) throw new EconomicsError(400, "That amount is a whole number of pence, cents, or equivalent, and not a negative one.");
    scenario[field] = value;
  }

  for (const [group, fields] of [
    ["conversion", ["visitorToTrial", "trialToPaid"]],
    ["retention", ["monthlyChurn"]],
  ]) {
    if (patch[group] === undefined) continue;
    for (const field of fields) {
      const value = patch[group]?.[field];
      if (value === undefined) continue;
      if (value !== null && !isPercent(value)) throw new EconomicsError(400, "A rate is a percentage between 0 and 100.");
      scenario[group] = { ...scenario[group], [field]: value };
    }
  }

  if (patch.capacity !== undefined) {
    const hours = patch.capacity?.weeklyHours;
    const cost = patch.capacity?.monthlyOperatingCost;
    if (hours !== undefined) {
      if (hours !== null && (!Number.isInteger(hours) || hours < 0 || hours > 168)) throw new EconomicsError(400, "Weekly hours are a whole number between 0 and 168.");
      scenario.capacity = { ...scenario.capacity, weeklyHours: hours };
    }
    if (cost !== undefined) {
      if (cost !== null && !isMoney(cost)) throw new EconomicsError(400, "Operating cost is a whole number of pence, cents, or equivalent.");
      scenario.capacity = { ...scenario.capacity, monthlyOperatingCost: cost };
    }
  }

  if (patch.cash !== undefined) {
    for (const field of ["onHand", "monthlyBurn"]) {
      const value = patch.cash?.[field];
      if (value === undefined) continue;
      if (value !== null && !isMoney(value)) throw new EconomicsError(400, "Cash is a whole number of pence, cents, or equivalent, and not a negative one.");
      scenario.cash = { ...scenario.cash, [field]: value };
    }
  }

  if (patch.isPrimary === true) {
    for (const entry of workspace.economics.scenarios) entry.isPrimary = entry.id === scenarioId;
  }

  scenario.updatedAt = now;
  scenario.lastChangedBy = actor.name;
  return scenario;
}

export function deleteScenario(database, workspace, scenarioId) {
  const scenarios = workspace.economics?.scenarios ?? [];
  const scenario = scenarios.find((entry) => entry.id === scenarioId);
  if (!scenario) throw new EconomicsError(404, "That scenario is no longer here.");
  const remaining = scenarios.filter((entry) => entry.id !== scenarioId);
  // A company keeps a primary scenario as long as it keeps any, the same way it keeps an owner.
  if (scenario.isPrimary && remaining.length) remaining[0].isPrimary = true;
  workspace.economics = { ...workspace.economics, scenarios: remaining };
  return { removed: true };
}

/** The founder-facing view: every scenario with its derivations and, for the primary one, sensitivity. */
export function economicsView(workspace) {
  const scenarios = workspace.economics?.scenarios ?? [];
  const primary = scenarios.find((entry) => entry.isPrimary) ?? scenarios[0] ?? null;
  return {
    currency: workspace.economics?.currency ?? "GBP",
    scenarios: scenarios.map((scenario) => ({ ...scenario, derived: deriveScenario(scenario) })),
    sensitivity: primary ? sensitivity(primary) : null,
  };
}
