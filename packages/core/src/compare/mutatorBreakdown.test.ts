import { describe, expect, it } from 'vitest';
import { compareMutatorBreakdown, mutatorBreakdown } from './mutatorBreakdown.js';
import { aggregateMetrics, calculateUnitMetrics } from '../domain/metrics.js';
import type { Mutant, MutantStatus, NormalizedRun, UnitResult } from '../domain/types.js';

let nextId = 0;

function mutant(mutator: string, status: MutantStatus): Mutant {
  nextId += 1;
  return { id: String(nextId), mutator, line: 1, status };
}

function unit(key: string, mutants: Mutant[]): UnitResult {
  return { key, displayName: key, mutants, metrics: calculateUnitMetrics(mutants) };
}

function run(units: UnitResult[]): NormalizedRun {
  return {
    tool: 'pitest',
    createdAt: '2026-01-01T00:00:00.000Z',
    units,
    metrics: aggregateMetrics(units),
  };
}

const MATH = 'org.pitest.mutationtest.engine.gregor.mutators.MathMutator';
const RETURN = 'org.pitest.mutationtest.engine.gregor.mutators.ReturnValsMutator';
const NEGATE = 'org.pitest.mutationtest.engine.gregor.mutators.NegateConditionalsMutator';

describe('mutatorBreakdown', () => {
  it('groups the mutants of every unit by mutator and computes unit-style metrics', () => {
    const breakdown = mutatorBreakdown(
      run([
        unit('A', [mutant(MATH, 'killed'), mutant(MATH, 'survived')]),
        unit('B', [mutant(MATH, 'no_coverage'), mutant(RETURN, 'killed')]),
      ]),
    );

    expect(breakdown.map((entry) => entry.mutator)).toEqual([MATH, RETURN]);
    const math = breakdown[0]?.metrics;
    expect(math?.total).toBe(3);
    expect(math?.killed).toBe(1);
    expect(math?.survived).toBe(1);
    expect(math?.noCoverage).toBe(1);
    expect(math?.score).toBeCloseTo(100 / 3);
    expect(breakdown[1]?.metrics.total).toBe(1);
    expect(breakdown[1]?.metrics.score).toBe(100);
  });

  it('sorts mutators by name for a deterministic output', () => {
    const breakdown = mutatorBreakdown(
      run([unit('A', [mutant(RETURN, 'killed'), mutant(MATH, 'killed')])]),
    );
    expect(breakdown.map((entry) => entry.mutator)).toEqual([MATH, RETURN]);
  });

  it('returns an empty list for a run without mutants', () => {
    expect(mutatorBreakdown(run([]))).toEqual([]);
    expect(mutatorBreakdown(run([unit('A', [])]))).toEqual([]);
  });
});

describe('compareMutatorBreakdown', () => {
  it('pairs each mutator across runs with survivor and score deltas', () => {
    const base = run([unit('A', [mutant(MATH, 'killed'), mutant(MATH, 'killed')])]);
    const head = run([unit('A', [mutant(MATH, 'killed'), mutant(MATH, 'survived')])]);

    const [math] = compareMutatorBreakdown(base, head);
    expect(math?.mutator).toBe(MATH);
    expect(math?.base?.survived).toBe(0);
    expect(math?.head?.survived).toBe(1);
    expect(math?.survivedDelta).toBe(1);
    expect(math?.scoreDelta).toBeCloseTo(-50);
  });

  it('computes head minus base, not base minus head', () => {
    const base = run([unit('A', [mutant(MATH, 'survived'), mutant(MATH, 'survived')])]);
    const head = run([unit('A', [mutant(MATH, 'killed'), mutant(MATH, 'survived')])]);

    const [math] = compareMutatorBreakdown(base, head);
    expect(math?.survivedDelta).toBe(-1);
    expect(math?.scoreDelta).toBeCloseTo(50);
  });

  it('gives a mutator missing from head only a base side and null deltas', () => {
    const base = run([unit('A', [mutant(MATH, 'killed')])]);
    const head = run([unit('A', [mutant(RETURN, 'killed')])]);

    const result = compareMutatorBreakdown(base, head);
    const math = result.find((entry) => entry.mutator === MATH);
    expect(math?.base).toBeDefined();
    expect(math).not.toHaveProperty('head');
    expect(math?.survivedDelta).toBeNull();
    expect(math?.scoreDelta).toBeNull();
  });

  it('gives a mutator missing from base only a head side and null deltas', () => {
    const base = run([unit('A', [mutant(MATH, 'killed')])]);
    const head = run([unit('A', [mutant(RETURN, 'survived')])]);

    const result = compareMutatorBreakdown(base, head);
    const ret = result.find((entry) => entry.mutator === RETURN);
    expect(ret).not.toHaveProperty('base');
    expect(ret?.head?.survived).toBe(1);
    expect(ret?.survivedDelta).toBeNull();
    expect(ret?.scoreDelta).toBeNull();
  });

  it('orders by survivors in the new run, most first, then by name, with absent-in-head last', () => {
    const base = run([unit('A', [mutant(MATH, 'killed'), mutant(NEGATE, 'killed')])]);
    const head = run([
      unit('A', [
        mutant(RETURN, 'survived'),
        mutant(RETURN, 'survived'),
        mutant(MATH, 'survived'),
        mutant(NEGATE, 'survived'),
      ]),
    ]);
    const onlyBase = run([unit('A', [mutant('AAA_OnlyInBase', 'survived')])]);

    const merged: NormalizedRun = {
      ...base,
      units: [...base.units, ...onlyBase.units],
      metrics: aggregateMetrics([...base.units, ...onlyBase.units]),
    };
    expect(compareMutatorBreakdown(merged, head).map((entry) => entry.mutator)).toEqual([
      RETURN,
      MATH,
      NEGATE,
      'AAA_OnlyInBase',
    ]);
  });

  it('returns an empty list when neither run has mutants', () => {
    expect(compareMutatorBreakdown(run([]), run([]))).toEqual([]);
  });
});
