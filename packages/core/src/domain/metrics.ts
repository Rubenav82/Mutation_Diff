import type { Mutant, UnitMetrics, UnitResult } from './types.js';

function computeDerived(
  counts: Omit<UnitMetrics, 'validTotal' | 'score' | 'coveredPct'>,
): UnitMetrics {
  const validTotal = counts.total - counts.ignored - counts.error;
  const score = validTotal > 0 ? ((counts.killed + counts.timeout) / validTotal) * 100 : 0;
  const coveredPct = validTotal > 0 ? ((validTotal - counts.noCoverage) / validTotal) * 100 : 0;
  return { ...counts, validTotal, score, coveredPct };
}

/**
 * Whether a unit counts as having no coverage, per CA-HU-05. Over `total` and not
 * `validTotal`, which is the formula the spec states.
 *
 * Lives here, next to the metrics it reads, because both the comparison engine and
 * the unit counts apply it — the engine to the new run only, the counts to each side.
 */
export function isUncovered(metrics: UnitMetrics, threshold: number): boolean {
  // 0/0 is NaN, and NaN >= threshold is always false, so a zero-mutant unit
  // is naturally never flagged without needing an explicit total === 0 guard.
  return (metrics.noCoverage / metrics.total) * 100 >= threshold;
}

export function calculateUnitMetrics(mutants: Mutant[]): UnitMetrics {
  const counts = {
    total: mutants.length,
    killed: 0,
    survived: 0,
    noCoverage: 0,
    timeout: 0,
    error: 0,
    ignored: 0,
  };

  for (const mutant of mutants) {
    switch (mutant.status) {
      case 'killed':
        counts.killed++;
        break;
      case 'survived':
        counts.survived++;
        break;
      case 'no_coverage':
        counts.noCoverage++;
        break;
      case 'timeout':
        counts.timeout++;
        break;
      case 'error':
        counts.error++;
        break;
      case 'ignored':
        counts.ignored++;
        break;
    }
  }

  return computeDerived(counts);
}

export function aggregateMetrics(units: UnitResult[]): UnitMetrics {
  const counts = {
    total: 0,
    killed: 0,
    survived: 0,
    noCoverage: 0,
    timeout: 0,
    error: 0,
    ignored: 0,
  };

  for (const unit of units) {
    counts.total += unit.metrics.total;
    counts.killed += unit.metrics.killed;
    counts.survived += unit.metrics.survived;
    counts.noCoverage += unit.metrics.noCoverage;
    counts.timeout += unit.metrics.timeout;
    counts.error += unit.metrics.error;
    counts.ignored += unit.metrics.ignored;
  }

  return computeDerived(counts);
}
