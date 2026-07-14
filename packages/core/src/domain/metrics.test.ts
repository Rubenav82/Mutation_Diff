import { describe, expect, it } from 'vitest';
import { aggregateMetrics, calculateUnitMetrics } from './metrics.js';
import type { Mutant, UnitResult } from './types.js';

function mutant(status: Mutant['status'], id = '1'): Mutant {
  return { id, mutator: 'SomeMutator', line: 1, status };
}

describe('calculateUnitMetrics', () => {
  it('returns all zeros for an empty mutant list', () => {
    expect(calculateUnitMetrics([])).toEqual({
      total: 0,
      killed: 0,
      survived: 0,
      noCoverage: 0,
      timeout: 0,
      error: 0,
      ignored: 0,
      validTotal: 0,
      score: 0,
      coveredPct: 0,
    });
  });

  it('counts each status and computes score/coveredPct over validTotal', () => {
    const mutants: Mutant[] = [
      mutant('killed', '1'),
      mutant('killed', '2'),
      mutant('survived', '3'),
      mutant('no_coverage', '4'),
      mutant('timeout', '5'),
      mutant('error', '6'),
      mutant('ignored', '7'),
    ];

    const metrics = calculateUnitMetrics(mutants);

    expect(metrics.total).toBe(7);
    expect(metrics.killed).toBe(2);
    expect(metrics.survived).toBe(1);
    expect(metrics.noCoverage).toBe(1);
    expect(metrics.timeout).toBe(1);
    expect(metrics.error).toBe(1);
    expect(metrics.ignored).toBe(1);
    // validTotal excludes ignored and error: 7 - 1 - 1 = 5
    expect(metrics.validTotal).toBe(5);
    // score = (killed + timeout) / validTotal * 100 = (2 + 1) / 5 * 100
    expect(metrics.score).toBeCloseTo(60);
    // coveredPct = (validTotal - noCoverage) / validTotal * 100 = (5 - 1) / 5 * 100
    expect(metrics.coveredPct).toBeCloseTo(80);
  });

  it('does not divide by zero when every mutant is ignored or error', () => {
    const metrics = calculateUnitMetrics([mutant('ignored', '1'), mutant('error', '2')]);

    expect(metrics.validTotal).toBe(0);
    expect(metrics.score).toBe(0);
    expect(metrics.coveredPct).toBe(0);
  });
});

describe('aggregateMetrics', () => {
  it('sums raw counts and recomputes percentages from the totals, not an average of unit percentages', () => {
    const unitA: UnitResult = {
      key: 'A',
      displayName: 'A',
      mutants: [],
      metrics: calculateUnitMetrics([mutant('killed', '1'), mutant('survived', '2')]), // score 50, 2 mutants
    };
    const unitB: UnitResult = {
      key: 'B',
      displayName: 'B',
      mutants: [],
      metrics: calculateUnitMetrics([
        mutant('killed', '3'),
        mutant('killed', '4'),
        mutant('killed', '5'),
        mutant('killed', '6'),
        mutant('killed', '7'),
        mutant('killed', '8'),
        mutant('killed', '9'),
        mutant('killed', '10'),
        mutant('killed', '11'),
        mutant('killed', '12'),
      ]), // score 100, 10 mutants
    };

    const aggregate = aggregateMetrics([unitA, unitB]);

    expect(aggregate.total).toBe(12);
    expect(aggregate.killed).toBe(11);
    expect(aggregate.survived).toBe(1);
    expect(aggregate.validTotal).toBe(12);
    // weighted: 11 killed / 12 valid * 100, NOT (50 + 100) / 2 = 75
    expect(aggregate.score).toBeCloseTo((11 / 12) * 100);
  });

  it('sums timeout, error and ignored counts across units, not just killed/survived', () => {
    const unitA: UnitResult = {
      key: 'A',
      displayName: 'A',
      mutants: [],
      metrics: calculateUnitMetrics([mutant('timeout', '1'), mutant('error', '2')]),
    };
    const unitB: UnitResult = {
      key: 'B',
      displayName: 'B',
      mutants: [],
      metrics: calculateUnitMetrics([mutant('timeout', '3'), mutant('ignored', '4')]),
    };

    const aggregate = aggregateMetrics([unitA, unitB]);

    expect(aggregate.timeout).toBe(2);
    expect(aggregate.error).toBe(1);
    expect(aggregate.ignored).toBe(1);
  });

  it('returns all zeros for an empty unit list', () => {
    expect(aggregateMetrics([])).toEqual({
      total: 0,
      killed: 0,
      survived: 0,
      noCoverage: 0,
      timeout: 0,
      error: 0,
      ignored: 0,
      validTotal: 0,
      score: 0,
      coveredPct: 0,
    });
  });
});
