import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MutatorComparison, UnitMetrics } from 'core';
import { MutatorBreakdown } from './MutatorBreakdown';

function metrics(over: Partial<UnitMetrics> = {}): UnitMetrics {
  return {
    total: 10,
    killed: 8,
    survived: 2,
    noCoverage: 0,
    timeout: 0,
    error: 0,
    ignored: 0,
    validTotal: 10,
    score: 80,
    coveredPct: 100,
    ...over,
  };
}

const MUTATORS: MutatorComparison[] = [
  {
    mutator: 'org.pitest.mutationtest.engine.gregor.mutators.NegateConditionalsMutator',
    base: metrics({ total: 12, survived: 1, score: 91.7 }),
    head: metrics({ total: 14, survived: 3, score: 78.6 }),
    survivedDelta: 2,
    scoreDelta: -13.1,
  },
  {
    mutator: 'org.pitest.mutationtest.engine.gregor.mutators.MathMutator',
    base: metrics({ total: 9, survived: 4, score: 55.6 }),
    head: metrics({ total: 9, survived: 2, score: 77.8 }),
    survivedDelta: -2,
    scoreDelta: 22.2,
  },
  {
    mutator: 'ArithmeticOperator',
    base: metrics({ total: 5, survived: 0, score: 100 }),
    head: metrics({ total: 5, survived: 0, score: 100 }),
    survivedDelta: 0,
    scoreDelta: 0,
  },
  {
    mutator: 'org.pitest.mutationtest.engine.gregor.mutators.VoidMethodCallMutator',
    base: metrics({ total: 3, survived: 1, score: 66.7 }),
    survivedDelta: null,
    scoreDelta: null,
  },
];

function bodyRows(): HTMLElement[] {
  const [, body] = screen.getAllByRole('rowgroup');
  return within(body as HTMLElement).getAllByRole('row');
}

describe('MutatorBreakdown', () => {
  it('renders the title with the mutator count and one row per mutator, in order', () => {
    render(<MutatorBreakdown mutators={MUTATORS} />);

    expect(screen.getByRole('heading', { name: 'Por mutador 4' })).toBeInTheDocument();
    expect(bodyRows().map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      'NegateConditionalsMutator',
      'MathMutator',
      'ArithmeticOperator',
      'VoidMethodCallMutator',
    ]);
  });

  it('keeps the full mutator name as title of the short one', () => {
    render(<MutatorBreakdown mutators={MUTATORS} />);

    expect(screen.getByText('NegateConditionalsMutator')).toHaveAttribute(
      'title',
      'org.pitest.mutationtest.engine.gregor.mutators.NegateConditionalsMutator',
    );
  });

  it('shows mutants in the new run, survivors on both sides with delta, and new score', () => {
    render(<MutatorBreakdown mutators={MUTATORS} />);

    const row = screen.getByText('NegateConditionalsMutator').closest('tr') as HTMLElement;
    const cells = within(row)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(cells).toEqual(['NegateConditionalsMutator', '14', '1', '3', '+2', '78.6%']);
  });

  it('colours the survivor delta with more-is-worse polarity', () => {
    render(<MutatorBreakdown mutators={MUTATORS} />);

    const variantOf = (name: string) => {
      const row = screen.getByText(name).closest('tr') as HTMLElement;
      return within(row).getAllByRole('cell')[4]?.getAttribute('data-variant');
    };
    expect(variantOf('NegateConditionalsMutator')).toBe('negative');
    expect(variantOf('MathMutator')).toBe('positive');
    expect(variantOf('ArithmeticOperator')).toBe('neutral');
  });

  it('signs a zero delta so it is not read as a drop to zero', () => {
    render(<MutatorBreakdown mutators={MUTATORS} />);

    const row = screen.getByText('ArithmeticOperator').closest('tr') as HTMLElement;
    expect(within(row).getAllByRole('cell')[4]?.textContent).toBe('±0');
  });

  it('shows an em dash for the side a mutator is missing from', () => {
    render(<MutatorBreakdown mutators={MUTATORS} />);

    const row = screen.getByText('VoidMethodCallMutator').closest('tr') as HTMLElement;
    const cells = within(row)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(cells).toEqual(['VoidMethodCallMutator', '—', '1', '—', '—', '—']);
    expect(within(row).getAllByRole('cell')[4]?.getAttribute('data-variant')).toBe('neutral');
  });

  it('shows an empty message and no table when there are no mutators', () => {
    render(<MutatorBreakdown mutators={[]} />);

    expect(screen.getByRole('heading', { name: 'Por mutador 0' })).toBeInTheDocument();
    expect(screen.getByText('No hay mutantes.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
