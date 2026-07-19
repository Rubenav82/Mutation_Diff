import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { UnitComparison, UnitMetrics } from 'core';
import { UnitsTable } from './UnitsTable';

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

function unit(
  over: Partial<UnitComparison> & Pick<UnitComparison, 'key' | 'kind'>,
): UnitComparison {
  return {
    scoreDelta: null,
    coverageDelta: null,
    isUncovered: false,
    ...over,
  };
}

const UNITS: UnitComparison[] = [
  unit({
    key: 'com.example.Calculator',
    kind: 'improved',
    base: metrics({ score: 70 }),
    head: metrics({ score: 85 }),
    scoreDelta: 15,
    coverageDelta: 0,
  }),
  unit({
    key: 'com.example.StringUtils',
    kind: 'regressed',
    base: metrics({ score: 90 }),
    head: metrics({ score: 60 }),
    scoreDelta: -30,
    coverageDelta: -10,
  }),
  unit({
    key: 'com.example.NewFeature',
    kind: 'added',
    head: metrics({ score: 50 }),
  }),
  unit({
    key: 'com.example.Legacy',
    kind: 'removed',
    base: metrics({ score: 40 }),
  }),
];

function bodyRows(): HTMLElement[] {
  const [, body] = screen.getAllByRole('rowgroup');
  return within(body as HTMLElement).getAllByRole('row');
}

describe('UnitsTable', () => {
  it('renders one row per unit with scores, delta and estado label', () => {
    render(<UnitsTable units={UNITS} />);

    expect(bodyRows()).toHaveLength(4);
    const row = screen.getByText('com.example.StringUtils').closest('tr') as HTMLElement;
    expect(within(row).getByText('90.0%')).toBeInTheDocument();
    expect(within(row).getByText('60.0%')).toBeInTheDocument();
    expect(within(row).getByText('-30.0%')).toBeInTheDocument();
    expect(within(row).getByText('Regresión ▼')).toBeInTheDocument();
  });

  it('shows an em dash for the missing side of added and removed units', () => {
    render(<UnitsTable units={UNITS} />);

    const added = screen.getByText('com.example.NewFeature').closest('tr') as HTMLElement;
    // added: no base score and no delta → two dashes
    expect(within(added).getAllByText('—')).toHaveLength(2);
    expect(within(added).getByText('Nueva')).toBeInTheDocument();

    const removed = screen.getByText('com.example.Legacy').closest('tr') as HTMLElement;
    expect(within(removed).getAllByText('—')).toHaveLength(2);
    expect(within(removed).getByText('Eliminada')).toBeInTheDocument();
  });

  it('exposes the unit kind on each row for color semantics', () => {
    render(<UnitsTable units={UNITS} />);

    const regressed = screen.getByText('com.example.StringUtils').closest('tr');
    expect(regressed).toHaveAttribute('data-kind', 'regressed');
    const improved = screen.getByText('com.example.Calculator').closest('tr');
    expect(improved).toHaveAttribute('data-kind', 'improved');
  });

  it('filters rows by class or package name, case-insensitively', async () => {
    const user = userEvent.setup();
    render(<UnitsTable units={UNITS} />);

    await user.type(screen.getByRole('searchbox', { name: /filtrar/i }), 'stringutils');

    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText('com.example.StringUtils')).toBeInTheDocument();
    expect(screen.queryByText('com.example.Calculator')).not.toBeInTheDocument();
  });

  it('shows an empty message when no unit matches the filter', async () => {
    const user = userEvent.setup();
    render(<UnitsTable units={UNITS} />);

    await user.type(screen.getByRole('searchbox', { name: /filtrar/i }), 'nomatch');

    expect(screen.getByText(/ninguna unidad coincide/i)).toBeInTheDocument();
  });

  it('sorts by score delta when its header is clicked, most severe drop first on descending toggle', async () => {
    const user = userEvent.setup();
    render(<UnitsTable units={UNITS} />);

    await user.click(screen.getByRole('button', { name: /δ score/i }));

    // ascending: most negative delta first, null deltas always last
    let keys = bodyRows().map((row) => within(row).getAllByRole('cell')[0]?.textContent);
    expect(keys.slice(0, 2)).toEqual(['com.example.StringUtils', 'com.example.Calculator']);

    await user.click(screen.getByRole('button', { name: /δ score/i }));

    keys = bodyRows().map((row) => within(row).getAllByRole('cell')[0]?.textContent);
    expect(keys.slice(0, 2)).toEqual(['com.example.Calculator', 'com.example.StringUtils']);
  });

  it('sorts by unit key when its header is clicked', async () => {
    const user = userEvent.setup();
    render(<UnitsTable units={UNITS} />);

    await user.click(screen.getByRole('button', { name: /clase \/ fichero/i }));

    const keys = bodyRows().map((row) => within(row).getAllByRole('cell')[0]?.textContent);
    expect(keys).toEqual([
      'com.example.Calculator',
      'com.example.Legacy',
      'com.example.NewFeature',
      'com.example.StringUtils',
    ]);
  });
});
