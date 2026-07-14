import type {
  ComparisonResult,
  NormalizedRun,
  UnitChangeKind,
  UnitComparison,
  UnitMetrics,
  UnitResult,
} from '../domain/types.js';

export interface CompareOptions {
  regressionThreshold?: number;
  uncoveredThreshold?: number;
}

const DEFAULT_REGRESSION_THRESHOLD = 0;
const DEFAULT_UNCOVERED_THRESHOLD = 100;

function isUncovered(metrics: UnitMetrics, threshold: number): boolean {
  // 0/0 is NaN, and NaN >= threshold is always false, so a zero-mutant unit
  // is naturally never flagged without needing an explicit total === 0 guard.
  return (metrics.noCoverage / metrics.total) * 100 >= threshold;
}

// `key` is passed in rather than derived from baseUnit/headUnit: the caller (compareRuns)
// always builds it from the union of both runs' unit keys, so at least one of baseUnit/headUnit
// is guaranteed defined here — there is no third "neither" case to guard against.
function classify(
  key: string,
  baseUnit: UnitResult | undefined,
  headUnit: UnitResult | undefined,
  regressionThreshold: number,
  uncoveredThreshold: number,
): UnitComparison {
  if (!baseUnit) {
    const head = headUnit as UnitResult;
    return {
      key,
      kind: 'added',
      head: head.metrics,
      scoreDelta: null,
      coverageDelta: null,
      isUncovered: isUncovered(head.metrics, uncoveredThreshold),
    };
  }

  if (!headUnit) {
    return {
      key,
      kind: 'removed',
      base: baseUnit.metrics,
      scoreDelta: null,
      coverageDelta: null,
      isUncovered: false,
    };
  }

  const scoreDelta = headUnit.metrics.score - baseUnit.metrics.score;
  const coverageDelta = headUnit.metrics.coveredPct - baseUnit.metrics.coveredPct;
  const kind: UnitChangeKind =
    scoreDelta > 0 ? 'improved' : scoreDelta < -regressionThreshold ? 'regressed' : 'unchanged';

  return {
    key,
    kind,
    base: baseUnit.metrics,
    head: headUnit.metrics,
    scoreDelta,
    coverageDelta,
    isUncovered: isUncovered(headUnit.metrics, uncoveredThreshold),
  };
}

export function compareRuns(
  base: NormalizedRun,
  head: NormalizedRun,
  options: CompareOptions = {},
): ComparisonResult {
  if (base.tool !== head.tool) {
    throw new Error(`Cannot compare a "${base.tool}" report against a "${head.tool}" report`);
  }

  const regressionThreshold = options.regressionThreshold ?? DEFAULT_REGRESSION_THRESHOLD;
  const uncoveredThreshold = options.uncoveredThreshold ?? DEFAULT_UNCOVERED_THRESHOLD;

  const baseByKey = new Map(base.units.map((u) => [u.key, u]));
  const headByKey = new Map(head.units.map((u) => [u.key, u]));
  const allKeys = Array.from(new Set([...baseByKey.keys(), ...headByKey.keys()])).sort();

  const units = allKeys.map((key) =>
    classify(key, baseByKey.get(key), headByKey.get(key), regressionThreshold, uncoveredThreshold),
  );

  const regressions = units
    .filter((u) => u.kind === 'regressed')
    .sort((a, b) => (a.scoreDelta ?? 0) - (b.scoreDelta ?? 0));

  return {
    tool: base.tool,
    global: {
      base: base.metrics,
      head: head.metrics,
      scoreDelta: head.metrics.score - base.metrics.score,
      coverageDelta: head.metrics.coveredPct - base.metrics.coveredPct,
    },
    units,
    regressions,
    uncovered: units.filter((u) => u.isUncovered),
    added: units.filter((u) => u.kind === 'added'),
    removed: units.filter((u) => u.kind === 'removed'),
  };
}
