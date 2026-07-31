import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UnitComparison, UnitMetrics } from 'core';
import { UnitSection } from './UnitSection';

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

const REGRESSIONS: UnitComparison[] = [
  {
    key: 'com.example.TaxCalculator',
    kind: 'regressed',
    base: metrics({ score: 90 }),
    head: metrics({ score: 55 }),
    scoreDelta: -35,
    coverageDelta: -5,
    isUncovered: false,
  },
  {
    key: 'com.example.StringUtils',
    kind: 'regressed',
    base: metrics({ score: 80 }),
    head: metrics({ score: 70 }),
    scoreDelta: -10,
    coverageDelta: 0,
    isUncovered: false,
  },
];

describe('UnitSection — métrica de la sección', () => {
  const uncovered: UnitComparison[] = [
    {
      key: 'com.example.EmailSender',
      kind: 'regressed',
      base: metrics({ score: 60, coveredPct: 90 }),
      head: metrics({ score: 45, coveredPct: 20 }),
      scoreDelta: -15,
      coverageDelta: -70,
      isUncovered: true,
    },
  ];

  it('shows covered mutants instead of score when asked for', () => {
    render(
      <UnitSection title="Sin cobertura" units={uncovered} emptyMessage="" metric="covered" />,
    );

    const row = screen.getByText('com.example.EmailSender').closest('tr') as HTMLElement;
    expect(within(row).getByText('90.0%')).toBeInTheDocument();
    expect(within(row).getByText('20.0%')).toBeInTheDocument();
    expect(within(row).getByText('-70.0%')).toBeInTheDocument();
    // El score, que en esta sección no es el motivo por el que la unidad está
    // aquí, no se muestra.
    expect(within(row).queryByText('60.0%')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Cubiertos base' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Δ Cubiertos' })).toBeInTheDocument();
  });

  it('keeps score as the default metric', () => {
    render(<UnitSection title="Retrocesos" units={uncovered} emptyMessage="" />);

    const row = screen.getByText('com.example.EmailSender').closest('tr') as HTMLElement;
    expect(within(row).getByText('60.0%')).toBeInTheDocument();
    expect(within(row).getByText('-15.0%')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Score base' })).toBeInTheDocument();
  });
});

describe('UnitSection', () => {
  it('renders the title with the unit count and one row per unit', () => {
    render(
      <UnitSection title="Retrocesos" units={REGRESSIONS} emptyMessage="No hay retrocesos." />,
    );

    expect(screen.getByRole('heading', { name: 'Retrocesos 2' })).toBeInTheDocument();
    const row = screen.getByText('com.example.TaxCalculator').closest('tr') as HTMLElement;
    expect(within(row).getByText('90.0%')).toBeInTheDocument();
    expect(within(row).getByText('55.0%')).toBeInTheDocument();
    expect(within(row).getByText('-35.0%')).toBeInTheDocument();
  });

  it('preserves the order of the units it receives', () => {
    render(
      <UnitSection title="Retrocesos" units={REGRESSIONS} emptyMessage="No hay retrocesos." />,
    );

    const [, body] = screen.getAllByRole('rowgroup');
    const keys = within(body as HTMLElement)
      .getAllByRole('row')
      .map((row) => within(row).getAllByRole('cell')[0]?.textContent);
    expect(keys).toEqual(['com.example.TaxCalculator', 'com.example.StringUtils']);
  });

  it('exposes the unit kind on each row and shows an em dash for missing sides', () => {
    render(
      <UnitSection
        title="Nuevas"
        units={[
          {
            key: 'com.example.NewFeature',
            kind: 'added',
            head: metrics({ score: 50 }),
            scoreDelta: null,
            coverageDelta: null,
            isUncovered: true,
          },
        ]}
        emptyMessage="No hay unidades nuevas."
      />,
    );

    const row = screen.getByText('com.example.NewFeature').closest('tr');
    expect(row).toHaveAttribute('data-kind', 'added');
    // no base score and no delta → two dashes
    expect(within(row as HTMLElement).getAllByText('—')).toHaveLength(2);
  });

  it('shows the empty message and no table when there are no units', () => {
    render(<UnitSection title="Retrocesos" units={[]} emptyMessage="No hay retrocesos." />);

    expect(screen.getByRole('heading', { name: 'Retrocesos 0' })).toBeInTheDocument();
    expect(screen.getByText('No hay retrocesos.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
