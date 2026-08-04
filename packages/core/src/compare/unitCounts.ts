import type { ComparisonResult } from '../domain/types.js';

/**
 * How many units each run carried, and how many of the new run's are covered.
 *
 * The percentages in `global` say whether a comparison got better; these say over
 * how much. An 86% over twelve classes and over nine hundred are not the same
 * claim, and nothing else in the result states the size.
 */
export interface UnitCounts {
  /** Units present in the base run. */
  base: number;
  /** Units present in the new run. */
  head: number;
  /** `head - base`. Neither direction is good or bad on its own. */
  delta: number;
  /** Units of the new run not flagged by the comparison's uncovered threshold. */
  covered: number;
}

export function countUnits(result: ComparisonResult): UnitCounts {
  // `units` is the union of both runs, so each side is the union minus the units
  // the other one brought on its own.
  const base = result.units.length - result.added.length;
  const head = result.units.length - result.removed.length;
  return {
    base,
    head,
    delta: head - base,
    // Subtracted from `head` and not from the union: a removed unit is never
    // flagged as uncovered (there is no new run to evaluate), so it would slip
    // into the covered count as if it had been measured.
    covered: head - result.uncovered.length,
  };
}
