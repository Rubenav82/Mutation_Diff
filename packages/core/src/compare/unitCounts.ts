import { isUncovered } from '../domain/metrics.js';
import type { ComparisonResult } from '../domain/types.js';

/** What one run contributed to the comparison. */
export interface UnitCountSide {
  /** Units the run contained. */
  total: number;
  /** Of those, the ones the comparison's uncovered threshold did not flag. */
  covered: number;
}

/**
 * How many units each run carried, and how many of them are covered.
 *
 * The percentages in `global` say whether a comparison got better; these say over
 * how much. An 86% over twelve classes and over nine hundred are not the same
 * claim, and nothing else in the result states the size.
 */
export interface UnitCounts {
  base: UnitCountSide;
  head: UnitCountSide;
  /** `head.total - base.total`. Neither direction is good or bad on its own. */
  totalDelta: number;
  /** `head.covered - base.covered`. */
  coveredDelta: number;
}

export function countUnits(result: ComparisonResult): UnitCounts {
  const threshold = result.context.uncoveredThreshold;

  // By presence of each side rather than by subtracting `added`/`removed`: a unit
  // is counted where it actually ran.
  let baseTotal = 0;
  let baseUncovered = 0;
  let headTotal = 0;
  for (const unit of result.units) {
    if (unit.base !== undefined) {
      baseTotal++;
      // Recomputed here because `isUncovered` on a `UnitComparison` describes the
      // new run only: the engine has no reason to evaluate the base side, since
      // nothing else in the result reports on it.
      if (isUncovered(unit.base, threshold)) baseUncovered++;
    }
    if (unit.head !== undefined) headTotal++;
  }

  const base = { total: baseTotal, covered: baseTotal - baseUncovered };
  // The new run's uncovered units come from `result.uncovered`, which is what the
  // dashboard's own section renders — recomputing them here would be a second
  // source of truth for a number shown twice on the same screen. Removed units
  // are never in it, so they cannot slip in as covered.
  const head = { total: headTotal, covered: headTotal - result.uncovered.length };

  return {
    base,
    head,
    totalDelta: head.total - base.total,
    coveredDelta: head.covered - base.covered,
  };
}
