import type { Readiness } from "../types";
import { formatCount } from "./Primitives";

/**
 * The readiness score as arithmetic rather than assertion.
 *
 * The score is the most consequential number in the product, and a founder is entitled to see
 * where it went: the weighted progress the company actually earned, each deduction taken off
 * it, and the number that survives. The counts shown here used to sit in a separate fact table
 * that never connected them to the score — this replaces that table, so the same figures now
 * explain themselves instead of appearing twice.
 *
 * Every figure comes from the domain's own penalty calculation; nothing is re-derived here.
 * When the deduction is capped or the score floors at zero the line items no longer sum to the
 * result, so an explicit applied-total row appears and the shortfall is said out loud.
 */
export function ReadinessLedger({ readiness }: { readiness: Readiness }) {
  const { penalty } = readiness;
  const deductions = penalty.deductions.filter((entry) => entry.count > 0);
  const shownTotal = deductions.reduce((sum, entry) => sum + entry.points, 0);
  const reconciles = shownTotal === penalty.applied;

  return (
    <div className="readiness-ledger">
      <div className="readiness-ledger__row">
        <span>Progress earned</span>
        <strong>{readiness.baseScore}</strong>
      </div>

      {deductions.length ? (
        deductions.map((entry) => (
          <div key={entry.id} className="readiness-ledger__row readiness-ledger__row--deduction">
            <span>
              {entry.label} <em>{formatCount(entry.count)}</em>
            </span>
            <strong>&minus;{entry.points}</strong>
          </div>
        ))
      ) : (
        <div className="readiness-ledger__row readiness-ledger__row--deduction">
          <span>Nothing deducted</span>
          <strong>&minus;0</strong>
        </div>
      )}

      {reconciles ? null : (
        <div className="readiness-ledger__row readiness-ledger__row--deduction">
          <span>Deduction applied</span>
          <strong>&minus;{penalty.applied}</strong>
        </div>
      )}

      <div className="readiness-ledger__row readiness-ledger__row--total">
        <span>Launch readiness</span>
        <strong>{readiness.score}</strong>
      </div>

      {penalty.capped ? (
        <p className="readiness-ledger__note">
          The deduction stops at {penalty.cap} points, so the score cannot fall further. Read the blockers rather than
          the number.
        </p>
      ) : null}
    </div>
  );
}
