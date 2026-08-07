import { useState } from "react";
import { api } from "../api";
import { Button, EmptyState, Field, Section, Select } from "./Primitives";
import { useCan } from "../capabilities";
import { useWorkspace } from "../context";
import type { EconomicsFigure, EconomicsScenario } from "../types";

/**
 * The company's economics, as numbers rather than sentences.
 *
 * Every figure below the inputs is computed on the server from the inputs beside it, and none of
 * it is stored — so a price change cannot leave a stale margin behind. Where an input is missing,
 * the figure says which one rather than rendering a confident zero: "you have not said what a
 * customer costs you" and "your margin is 0%" are entirely different conversations, and in a
 * company still working this out the first is far more common.
 *
 * Amounts are held in minor units. The founder types pounds and the field converts, because
 * a planning model that accumulates float error eventually disagrees with itself about a number
 * they typed in exactly.
 */
export function Economics() {
  const { snapshot, reload, notify } = useWorkspace();
  const can = useCan();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");

  const economics = snapshot.economics ?? { currency: "GBP", scenarios: [], sensitivity: null };
  const scenarios = economics.scenarios ?? [];
  const primary = scenarios.find((entry) => entry.isPrimary) ?? scenarios[0] ?? null;
  const mayEdit = can("company-write");

  const run = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await work();
      await reload();
      notify(success);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await run(() => api.addScenario(snapshot.workspace.id, { name: trimmed, currency: economics.currency }), "Scenario added.");
    setName("");
  };

  return (
    <Section
      title="What the numbers say"
      description="Price, cost, churn, and cash as structured assumptions. Everything below them is worked out from them — nothing here is a number somebody typed twice."
    >
      {scenarios.length ? (
        <>
          <div className="scenario-tabs">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                className={scenario.id === primary?.id ? "scenario-tabs__item scenario-tabs__item--active" : "scenario-tabs__item"}
                disabled={busy || !mayEdit}
                onClick={() => void run(() => api.updateScenario(snapshot.workspace.id, scenario.id, { isPrimary: true }), `Reading ${scenario.name}.`)}
              >
                {scenario.name}
              </button>
            ))}
          </div>

          {primary ? <ScenarioPanel scenario={primary} currency={economics.currency} mayEdit={mayEdit} busy={busy} run={run} /> : null}

          {economics.sensitivity?.inputs?.length ? (
            <div className="sensitivity">
              <p className="eyebrow">What this plan rests on</p>
              <p className="sensitivity__lead">
                If each of these turned out to be wrong by a fifth, this is how far the lifetime value of a customer would move. The one at
                the top is the assumption worth checking first.
              </p>
              <ul>
                {economics.sensitivity.inputs.map((input) => (
                  <li key={input.label}>
                    <span className="sensitivity__label">{input.label}</span>
                    <span className="sensitivity__bar" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, input.swingPercent ?? 0)}%` }} />
                    </span>
                    <span className="sensitivity__swing">{input.swingPercent === null ? "—" : `${input.swingPercent}%`}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="No numbers recorded yet"
          description="A pricing scenario turns the business model out of prose and into figures Formation can check against each other."
        />
      )}

      {mayEdit ? (
        <div className="scenario-add">
          <Field label="Add a scenario" hint="Model more than one and compare them side by side.">
            <input value={name} placeholder="Annual plan" onChange={(event) => setName(event.target.value)} />
          </Field>
          <Button disabled={busy || !name.trim()} onClick={() => void add()}>Add</Button>
        </div>
      ) : null}
    </Section>
  );
}

const PERIODS: Array<{ id: string; label: string }> = [
  { id: "month", label: "a month" },
  { id: "year", label: "a year" },
  { id: "one-time", label: "once" },
];

function ScenarioPanel({
  scenario,
  currency,
  mayEdit,
  busy,
  run,
}: {
  scenario: EconomicsScenario;
  currency: string;
  mayEdit: boolean;
  busy: boolean;
  run: (work: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  const { snapshot } = useWorkspace();
  const save = (patch: Record<string, unknown>) =>
    run(() => api.updateScenario(snapshot.workspace.id, scenario.id, { ...patch, expectedUpdatedAt: scenario.updatedAt }), "Saved.");

  return (
    <div className="scenario">
      <div className="scenario__inputs">
        <MoneyField label="Price" currency={currency} value={scenario.price.amount} disabled={!mayEdit || busy} onSave={(amount) => save({ price: { amount, per: scenario.price.per } })} />
        <Field label="Charged">
          <Select
            value={scenario.price.per}
            disabled={!mayEdit || busy}
            onChange={(event) => void save({ price: { amount: scenario.price.amount, per: event.target.value } })}
          >
            {PERIODS.map((period) => <option key={period.id} value={period.id}>{period.label}</option>)}
          </Select>
        </Field>
        <MoneyField label="What one customer costs you" currency={currency} value={scenario.variableCostPerCustomer} disabled={!mayEdit || busy} onSave={(value) => save({ variableCostPerCustomer: value })} />
        <MoneyField label="What one customer costs to win" currency={currency} value={scenario.acquisitionCost} disabled={!mayEdit || busy} onSave={(value) => save({ acquisitionCost: value })} />
        <PercentField label="Leaving each month" value={scenario.retention.monthlyChurn} disabled={!mayEdit || busy} onSave={(value) => save({ retention: { monthlyChurn: value } })} />
        <MoneyField label="Cash on hand" currency={currency} value={scenario.cash.onHand} disabled={!mayEdit || busy} onSave={(value) => save({ cash: { onHand: value } })} />
        <MoneyField label="Spending each month" currency={currency} value={scenario.cash.monthlyBurn} disabled={!mayEdit || busy} onSave={(value) => save({ cash: { monthlyBurn: value } })} />
      </div>

      <dl className="scenario__derived">
        <Derived label="Gross margin" figure={scenario.derived.grossMargin} currency={currency} />
        <Derived label="Kept from each customer, monthly" figure={scenario.derived.monthlyContribution} currency={currency} />
        <Derived label="How long a customer stays" figure={scenario.derived.lifetimeMonths} currency={currency} />
        <Derived label="Worth of one customer" figure={scenario.derived.lifetimeValue} currency={currency} />
        <Derived label="Worth against cost to win" figure={scenario.derived.ltvToCac} currency={currency} />
        <Derived label="Months to earn back what you spent" figure={scenario.derived.paybackMonths} currency={currency} />
        <Derived label="Months of cash left" figure={scenario.derived.runwayMonths} currency={currency} />
        <Derived label="Customers to cover what you spend" figure={scenario.derived.customersToBreakEven} currency={currency} />
      </dl>
    </div>
  );
}

/** A worked-out figure, or the plain statement of what it is waiting for. */
function Derived({ label, figure, currency }: { label: string; figure: EconomicsFigure; currency: string }) {
  return (
    <div className={figure.value === null ? "derived derived--waiting" : "derived"}>
      <dt>{label}</dt>
      <dd>
        {figure.value === null ? (
          <span className="derived__waiting">Waiting on {figure.missing.join(" and ")}.</span>
        ) : (
          formatFigure(figure, currency)
        )}
      </dd>
    </div>
  );
}

function formatFigure(figure: EconomicsFigure, currency: string) {
  const value = figure.value as number;
  if (figure.unit === "money") return formatMoney(value, currency);
  if (figure.unit === "percent") return `${value}%`;
  if (figure.unit === "months") return `${value} ${value === 1 ? "month" : "months"}`;
  if (figure.unit === "ratio") return `${value}×`;
  return String(value);
}

export function formatMoney(minorUnits: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(minorUnits / 100);
  } catch {
    return `${(minorUnits / 100).toFixed(2)} ${currency}`;
  }
}

/**
 * Money in, minor units out. The founder types what they would say out loud — 79, or 79.50 — and
 * the conversion happens once, here, rather than being trusted to every caller.
 */
function MoneyField({ label, currency, value, disabled, onSave }: { label: string; currency: string; value: number | null; disabled: boolean; onSave: (value: number | null) => void }) {
  const [draft, setDraft] = useState(value === null ? "" : (value / 100).toString());
  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return onSave(null);
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    onSave(Math.round(parsed * 100));
  };
  return (
    <Field label={label} hint={currency}>
      <input inputMode="decimal" value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} onBlur={commit} />
    </Field>
  );
}

function PercentField({ label, value, disabled, onSave }: { label: string; value: number | null; disabled: boolean; onSave: (value: number | null) => void }) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return onSave(null);
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return;
    onSave(parsed);
  };
  return (
    <Field label={label} hint="percent">
      <input inputMode="decimal" value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} onBlur={commit} />
    </Field>
  );
}
