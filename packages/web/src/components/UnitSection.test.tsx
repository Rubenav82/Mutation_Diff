import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('UnitSection — paginación', () => {
  // 12 unidades: más de dos páginas con el tamaño por defecto, así que «siguiente»
  // y «anterior» tienen a dónde ir.
  const MANY: UnitComparison[] = Array.from({ length: 12 }, (_, i) => ({
    // Índice con relleno para que el orden alfabético coincida con el numérico.
    key: `com.example.Clase${String(i).padStart(2, '0')}`,
    kind: 'regressed',
    base: metrics({ score: 90 }),
    head: metrics({ score: 70 }),
    scoreDelta: -20,
    coverageDelta: 0,
    isUncovered: false,
  }));

  function renderMany() {
    return render(
      <UnitSection title="Retrocesos" units={MANY} emptyMessage="No hay retrocesos." />,
    );
  }

  function visibleKeys(): (string | undefined)[] {
    const [, body] = screen.getAllByRole('rowgroup');
    return within(body as HTMLElement)
      .getAllByRole('row')
      .map((row) => within(row).getAllByRole('cell')[0]?.textContent);
  }

  it('shows the first five units by default', () => {
    renderMany();

    expect(visibleKeys()).toEqual([
      'com.example.Clase00',
      'com.example.Clase01',
      'com.example.Clase02',
      'com.example.Clase03',
      'com.example.Clase04',
    ]);
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
  });

  it('moves to the next page and back, keeping the order it received', async () => {
    const user = userEvent.setup();
    renderMany();

    await user.click(screen.getByRole('button', { name: 'Página siguiente · Retrocesos' }));

    expect(visibleKeys()[0]).toBe('com.example.Clase05');
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Página anterior · Retrocesos' }));

    expect(visibleKeys()[0]).toBe('com.example.Clase00');
  });

  it('lets the user pick how many rows fit on a page', async () => {
    const user = userEvent.setup();
    renderMany();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filas por página · Retrocesos' }),
      'all',
    );

    expect(visibleKeys()).toHaveLength(12);
    expect(screen.queryByText(/página \d+ de/i)).not.toBeInTheDocument();
  });

  // El contador de la cabecera dice de qué tamaño es la sección, no cuánto cabe en
  // una página: aquí no hay filtro que pueda dejarlo sin cuadrar con nada.
  it('counts every unit in the section, not just the visible page', () => {
    renderMany();

    expect(screen.getByRole('heading', { name: 'Retrocesos 12' })).toBeInTheDocument();
  });

  it('leaves short sections without pagination controls', () => {
    render(
      <UnitSection title="Retrocesos" units={REGRESSIONS} emptyMessage="No hay retrocesos." />,
    );

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /página/i })).not.toBeInTheDocument();
  });

  // Sin el recorte, volver a comparar con menos unidades dejaría la sección en una
  // página que ya no existe: tabla vacía con datos que sí están.
  it('falls back to the last page when the section it shows gets smaller', async () => {
    const user = userEvent.setup();
    const { rerender } = renderMany();

    await user.click(screen.getByRole('button', { name: 'Página siguiente · Retrocesos' }));
    await user.click(screen.getByRole('button', { name: 'Página siguiente · Retrocesos' }));
    expect(screen.getByText('Página 3 de 3')).toBeInTheDocument();

    rerender(
      <UnitSection title="Retrocesos" units={MANY.slice(0, 6)} emptyMessage="No hay retrocesos." />,
    );

    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    expect(visibleKeys()).toEqual(['com.example.Clase05']);
  });
});
