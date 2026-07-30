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

// Cifras deliberadamente distintas entre sí en cada fila: con valores repetidos,
// una consulta por texto exacto no distinguiría la celda de score de la de
// cubiertos.
const UNITS: UnitComparison[] = [
  unit({
    key: 'com.example.Calculator',
    kind: 'improved',
    base: metrics({ score: 70, coveredPct: 80 }),
    head: metrics({ score: 85, coveredPct: 90 }),
    scoreDelta: 15,
    coverageDelta: 10,
  }),
  unit({
    key: 'com.example.StringUtils',
    kind: 'regressed',
    base: metrics({ score: 90, coveredPct: 100 }),
    head: metrics({ score: 60, coveredPct: 75 }),
    scoreDelta: -30,
    coverageDelta: -25,
  }),
  unit({
    key: 'com.example.NewFeature',
    kind: 'added',
    head: metrics({ score: 50, coveredPct: 55 }),
  }),
  unit({
    key: 'com.example.Legacy',
    kind: 'removed',
    base: metrics({ score: 40, coveredPct: 45 }),
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
    expect(within(row).getByText('Retroceso ▼')).toBeInTheDocument();
  });

  it('shows base, new and delta of covered mutants next to the score', () => {
    render(<UnitsTable units={UNITS} />);

    const row = screen.getByText('com.example.StringUtils').closest('tr') as HTMLElement;
    expect(within(row).getByText('100.0%')).toBeInTheDocument();
    expect(within(row).getByText('75.0%')).toBeInTheDocument();
    expect(within(row).getByText('-25.0%')).toBeInTheDocument();

    // Un caso por sentido: una mejora de cobertura también se pinta.
    const improved = screen.getByText('com.example.Calculator').closest('tr') as HTMLElement;
    expect(within(improved).getByText('80.0%')).toBeInTheDocument();
    expect(within(improved).getByText('90.0%')).toBeInTheDocument();
    expect(within(improved).getByText('+10.0%')).toBeInTheDocument();
  });

  it('groups the score and covered-mutant columns under their own header', () => {
    render(<UnitsTable units={UNITS} />);

    expect(screen.getByRole('columnheader', { name: 'Score' })).toBeInTheDocument();
    // «Mutantes cubiertos», no «Cobertura»: es (válidos − sin cubrir) / válidos,
    // no el Line Coverage de PiTest.
    expect(screen.getByRole('columnheader', { name: 'Mutantes cubiertos' })).toBeInTheDocument();
  });

  it('names each sort button with its full column, not just the group leaf', () => {
    render(<UnitsTable units={UNITS} />);

    // Visualmente el encabezado es «Δ», que fuera del grupo no dice nada: el
    // nombre accesible tiene que llevar la métrica.
    expect(screen.getByRole('button', { name: /ordenar por δ cubiertos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ordenar por δ score/i })).toBeInTheDocument();
  });

  it('shows an em dash for the missing side of added and removed units', () => {
    render(<UnitsTable units={UNITS} />);

    // added: sin base ni deltas → cuatro guiones (score base, Δ score, cubiertos
    // base, Δ cubiertos)
    const added = screen.getByText('com.example.NewFeature').closest('tr') as HTMLElement;
    expect(within(added).getAllByText('—')).toHaveLength(4);
    expect(within(added).getByText('Nueva')).toBeInTheDocument();

    const removed = screen.getByText('com.example.Legacy').closest('tr') as HTMLElement;
    expect(within(removed).getAllByText('—')).toHaveLength(4);
    expect(within(removed).getByText('Eliminada')).toBeInTheDocument();
  });

  it('sorts by coverage delta with the missing sides last', async () => {
    const user = userEvent.setup();
    render(<UnitsTable units={UNITS} />);

    await user.click(screen.getByRole('button', { name: /ordenar por δ cubiertos/i }));

    const keys = bodyRows().map((row) => within(row).getAllByRole('cell')[0]?.textContent);
    expect(keys.slice(0, 2)).toEqual(['com.example.StringUtils', 'com.example.Calculator']);
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
