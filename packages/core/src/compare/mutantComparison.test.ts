import { describe, expect, it } from 'vitest';
import { compareMutants } from './mutantComparison.js';
import type { Mutant, MutantStatus } from '../domain/types.js';

let nextId = 0;

function mutant(line: number, mutator: string, status: MutantStatus, description?: string): Mutant {
  nextId += 1;
  return {
    id: String(nextId),
    mutator,
    line,
    status,
    ...(description !== undefined ? { description } : {}),
  };
}

describe('compareMutants — classification of a matched mutant', () => {
  it.each<[MutantStatus, MutantStatus, string]>([
    ['killed', 'survived', 'newly-survived'],
    ['timeout', 'survived', 'newly-survived'],
    ['no_coverage', 'survived', 'newly-survived'],
    ['survived', 'killed', 'newly-killed'],
    ['no_coverage', 'killed', 'newly-killed'],
    ['survived', 'timeout', 'newly-killed'],
    ['killed', 'no_coverage', 'newly-uncovered'],
    ['survived', 'no_coverage', 'newly-uncovered'],
    ['killed', 'timeout', 'changed'],
    ['timeout', 'killed', 'changed'],
    ['survived', 'error', 'changed'],
    ['error', 'killed', 'newly-killed'],
    ['killed', 'ignored', 'changed'],
  ])('%s → %s is %s', (base, head, kind) => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', base)],
      [mutant(10, 'MathMutator', head)],
    );
    expect(result).toEqual([{ line: 10, mutator: 'MathMutator', base, head, kind }]);
  });

  it('omits a mutant whose status did not change', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed')],
      [mutant(10, 'MathMutator', 'killed')],
    );
    expect(result).toEqual([]);
  });

  it('omits an unchanged survivor too, not only unchanged killed mutants', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'survived')],
      [mutant(10, 'MathMutator', 'survived')],
    );
    expect(result).toEqual([]);
  });
});

describe('compareMutants — mutants present on one side only', () => {
  it('reports a mutant missing from head as removed, with only the base status', () => {
    const result = compareMutants([mutant(10, 'MathMutator', 'killed')], []);
    expect(result).toEqual([{ line: 10, mutator: 'MathMutator', base: 'killed', kind: 'removed' }]);
  });

  it('reports a mutant missing from base as added, with only the head status', () => {
    const result = compareMutants([], [mutant(10, 'MathMutator', 'survived')]);
    expect(result).toEqual([{ line: 10, mutator: 'MathMutator', head: 'survived', kind: 'added' }]);
  });

  it('does not match mutants that share the line but not the mutator', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed')],
      [mutant(10, 'ReturnValsMutator', 'killed')],
    );
    expect(result).toEqual([
      { line: 10, mutator: 'MathMutator', base: 'killed', kind: 'removed' },
      { line: 10, mutator: 'ReturnValsMutator', head: 'killed', kind: 'added' },
    ]);
  });

  it('does not match mutants that share the mutator but not the line', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed')],
      [mutant(11, 'MathMutator', 'killed')],
    );
    expect(result).toEqual([
      { line: 10, mutator: 'MathMutator', base: 'killed', kind: 'removed' },
      { line: 11, mutator: 'MathMutator', head: 'killed', kind: 'added' },
    ]);
  });
});

describe('compareMutants — several mutants of the same mutator on the same line', () => {
  it('pairs them by order of appearance', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed'), mutant(10, 'MathMutator', 'killed')],
      [mutant(10, 'MathMutator', 'killed'), mutant(10, 'MathMutator', 'survived')],
    );
    expect(result).toEqual([
      {
        line: 10,
        mutator: 'MathMutator',
        base: 'killed',
        head: 'survived',
        kind: 'newly-survived',
      },
    ]);
  });

  it('reports the surplus on the base side as removed', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed'), mutant(10, 'MathMutator', 'survived')],
      [mutant(10, 'MathMutator', 'killed')],
    );
    expect(result).toEqual([
      { line: 10, mutator: 'MathMutator', base: 'survived', kind: 'removed' },
    ]);
  });

  it('reports the surplus on the head side as added', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed')],
      [mutant(10, 'MathMutator', 'killed'), mutant(10, 'MathMutator', 'survived')],
    );
    expect(result).toEqual([{ line: 10, mutator: 'MathMutator', head: 'survived', kind: 'added' }]);
  });

  it('pairs by order within the group even when the sides interleave other mutants', () => {
    const result = compareMutants(
      [
        mutant(10, 'MathMutator', 'killed'),
        mutant(12, 'ReturnValsMutator', 'killed'),
        mutant(10, 'MathMutator', 'survived'),
      ],
      [
        mutant(12, 'ReturnValsMutator', 'killed'),
        mutant(10, 'MathMutator', 'killed'),
        mutant(10, 'MathMutator', 'killed'),
      ],
    );
    expect(result).toEqual([
      { line: 10, mutator: 'MathMutator', base: 'survived', head: 'killed', kind: 'newly-killed' },
    ]);
  });
});

describe('compareMutants — description', () => {
  it('carries the head description when both sides have one', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed', 'old text')],
      [mutant(10, 'MathMutator', 'survived', 'new text')],
    );
    expect(result[0]?.description).toBe('new text');
  });

  it('falls back to the base description for a removed mutant', () => {
    const result = compareMutants([mutant(10, 'MathMutator', 'killed', 'base text')], []);
    expect(result[0]?.description).toBe('base text');
  });

  it('falls back to the base description when only base has one', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed', 'base text')],
      [mutant(10, 'MathMutator', 'survived')],
    );
    expect(result[0]?.description).toBe('base text');
  });

  it('omits the description key entirely when neither side has one', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed')],
      [mutant(10, 'MathMutator', 'survived')],
    );
    expect(result[0]).not.toHaveProperty('description');
  });
});

describe('compareMutants — ordering', () => {
  it('sorts by line ascending regardless of the order in either run', () => {
    const result = compareMutants(
      [mutant(30, 'MathMutator', 'killed'), mutant(5, 'MathMutator', 'killed')],
      [mutant(30, 'MathMutator', 'survived'), mutant(5, 'MathMutator', 'survived')],
    );
    expect(result.map((m) => m.line)).toEqual([5, 30]);
  });

  it('sorts numerically, not lexicographically (10 after 9)', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed'), mutant(9, 'MathMutator', 'killed')],
      [],
    );
    expect(result.map((m) => m.line)).toEqual([9, 10]);
  });

  it('breaks ties on the same line by mutator name', () => {
    const result = compareMutants(
      [mutant(10, 'ReturnValsMutator', 'killed'), mutant(10, 'MathMutator', 'killed')],
      [],
    );
    expect(result.map((m) => m.mutator)).toEqual(['MathMutator', 'ReturnValsMutator']);
  });

  it('keeps pairing order within the same line and mutator', () => {
    const result = compareMutants(
      [mutant(10, 'MathMutator', 'killed'), mutant(10, 'MathMutator', 'survived')],
      [mutant(10, 'MathMutator', 'survived'), mutant(10, 'MathMutator', 'killed')],
    );
    expect(result.map((m) => m.kind)).toEqual(['newly-survived', 'newly-killed']);
  });
});
