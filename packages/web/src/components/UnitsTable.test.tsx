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
    render(<UnitsTable units={UNITS} tool="pitest" />);

    expect(bodyRows()).toHaveLength(4);
    const row = screen.getByTitle('com.example.StringUtils').closest('tr') as HTMLElement;
    expect(within(row).getByText('90.0%')).toBeInTheDocument();
    expect(within(row).getByText('60.0%')).toBeInTheDocument();
    expect(within(row).getByText('-30.0%')).toBeInTheDocument();
    expect(within(row).getByText('Retroceso ▼')).toBeInTheDocument();
  });

  it('shows base, new and delta of covered mutants next to the score', () => {
    render(<UnitsTable units={UNITS} tool="pitest" />);

    const row = screen.getByTitle('com.example.StringUtils').closest('tr') as HTMLElement;
    expect(within(row).getByText('100.0%')).toBeInTheDocument();
    expect(within(row).getByText('75.0%')).toBeInTheDocument();
    expect(within(row).getByText('-25.0%')).toBeInTheDocument();

    // Un caso por sentido: una mejora de cobertura también se pinta.
    const improved = screen.getByTitle('com.example.Calculator').closest('tr') as HTMLElement;
    expect(within(improved).getByText('80.0%')).toBeInTheDocument();
    expect(within(improved).getByText('90.0%')).toBeInTheDocument();
    expect(within(improved).getByText('+10.0%')).toBeInTheDocument();
  });

  it('keeps the class name intact and lets only the package prefix be clipped', () => {
    render(<UnitsTable units={UNITS} tool="pitest" />);

    const cell = screen.getByTitle('com.example.StringUtils');
    // El nombre simple nunca se recorta: es lo que distingue una fila de otra.
    // El paquete, que se repite fila tras fila, es lo que cede sitio.
    expect(within(cell).getByText('.StringUtils')).toBeInTheDocument();
    expect(within(cell).getByText('com.example')).toBeInTheDocument();
    expect(cell).toHaveTextContent('com.example.StringUtils');
  });

  it('groups the score and covered-mutant columns under their own header', () => {
    render(<UnitsTable units={UNITS} tool="pitest" />);

    expect(screen.getByRole('columnheader', { name: 'Score' })).toBeInTheDocument();
    // «Mutantes cubiertos», no «Cobertura»: es (válidos − sin cubrir) / válidos,
    // no el Line Coverage de PiTest.
    expect(screen.getByRole('columnheader', { name: 'Mutantes cubiertos' })).toBeInTheDocument();
  });

  it('names each sort button with its full column, not just the group leaf', () => {
    render(<UnitsTable units={UNITS} tool="pitest" />);

    // Visualmente el encabezado es «Δ», que fuera del grupo no dice nada: el
    // nombre accesible tiene que llevar la métrica.
    expect(screen.getByRole('button', { name: /ordenar por δ cubiertos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ordenar por δ score/i })).toBeInTheDocument();
  });

  it('shows an em dash for the missing side of added and removed units', () => {
    render(<UnitsTable units={UNITS} tool="pitest" />);

    // added: sin base ni deltas → cuatro guiones (score base, Δ score, cubiertos
    // base, Δ cubiertos)
    const added = screen.getByTitle('com.example.NewFeature').closest('tr') as HTMLElement;
    expect(within(added).getAllByText('—')).toHaveLength(4);
    expect(within(added).getByText('Nueva')).toBeInTheDocument();

    const removed = screen.getByTitle('com.example.Legacy').closest('tr') as HTMLElement;
    expect(within(removed).getAllByText('—')).toHaveLength(4);
    expect(within(removed).getByText('Eliminada')).toBeInTheDocument();
  });

  it('sorts by coverage delta with the missing sides last', async () => {
    const user = userEvent.setup();
    render(<UnitsTable units={UNITS} tool="pitest" />);

    await user.click(screen.getByRole('button', { name: /ordenar por δ cubiertos/i }));

    const keys = bodyRows().map((row) => within(row).getAllByRole('cell')[0]?.textContent);
    expect(keys.slice(0, 2)).toEqual(['com.example.StringUtils', 'com.example.Calculator']);
  });

  it('exposes the unit kind on each row for color semantics', () => {
    render(<UnitsTable units={UNITS} tool="pitest" />);

    const regressed = screen.getByTitle('com.example.StringUtils').closest('tr');
    expect(regressed).toHaveAttribute('data-kind', 'regressed');
    const improved = screen.getByTitle('com.example.Calculator').closest('tr');
    expect(improved).toHaveAttribute('data-kind', 'improved');
  });

  // Mismo contador que las cuatro secciones, para que la tabla completa no sea
  // la única cabecera sin él.
  it('counts the units next to the title', () => {
    render(<UnitsTable units={UNITS} tool="pitest" />);

    expect(screen.getByRole('heading', { name: 'Todas las unidades 4' })).toBeInTheDocument();
  });

  // Cuenta las filas que hay en la tabla, no las que hubo: con un filtro puesto,
  // el total original sería un número que no cuadra con nada de lo que se ve.
  it('counts what the filter left, not what there was', async () => {
    const user = userEvent.setup();
    render(<UnitsTable units={UNITS} tool="pitest" />);

    await user.type(screen.getByRole('searchbox', { name: /filtrar/i }), 'stringutils');

    expect(screen.getByRole('heading', { name: 'Todas las unidades 1' })).toBeInTheDocument();
  });

  it('filters rows by class or package name, case-insensitively', async () => {
    const user = userEvent.setup();
    render(<UnitsTable units={UNITS} tool="pitest" />);

    await user.type(screen.getByRole('searchbox', { name: /filtrar/i }), 'stringutils');

    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByTitle('com.example.StringUtils')).toBeInTheDocument();
    expect(screen.queryByTitle('com.example.Calculator')).not.toBeInTheDocument();
  });

  it('shows an empty message when no unit matches the filter', async () => {
    const user = userEvent.setup();
    render(<UnitsTable units={UNITS} tool="pitest" />);

    await user.type(screen.getByRole('searchbox', { name: /filtrar/i }), 'nomatch');

    expect(screen.getByText(/ninguna unidad coincide/i)).toBeInTheDocument();
  });

  it('sorts by score delta when its header is clicked, most severe drop first on descending toggle', async () => {
    const user = userEvent.setup();
    render(<UnitsTable units={UNITS} tool="pitest" />);

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
    render(<UnitsTable units={UNITS} tool="pitest" />);

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

describe('UnitsTable — paginación', () => {
  // 60 unidades: más de dos páginas con el tamaño por defecto, así que
  // «siguiente» y «anterior» tienen a dónde ir.
  const MANY: UnitComparison[] = Array.from({ length: 60 }, (_, i) =>
    unit({
      // Índice con relleno para que el orden alfabético coincida con el numérico.
      key: `com.example.Clase${String(i).padStart(2, '0')}`,
      kind: 'unchanged',
      base: metrics(),
      head: metrics(),
      scoreDelta: 0,
      coverageDelta: 0,
    }),
  );

  function pageSizeSelect(): HTMLElement {
    return screen.getByRole('combobox', { name: 'Filas por página · Todas las unidades' });
  }

  function nextPage(): HTMLElement {
    return screen.getByRole('button', { name: 'Página siguiente · Todas las unidades' });
  }

  function previousPage(): HTMLElement {
    return screen.getByRole('button', { name: 'Página anterior · Todas las unidades' });
  }

  // Cinco y no veinticinco: en un proyecto grande, la tabla completa por sí sola
  // llenaba varias pantallas y obligaba a scrollear para llegar a cualquier otra cosa.
  it('shows the first 5 units by default', () => {
    render(<UnitsTable units={MANY} tool="pitest" />);

    expect(bodyRows()).toHaveLength(5);
    expect(screen.getByTitle('com.example.Clase00')).toBeInTheDocument();
    expect(screen.queryByTitle('com.example.Clase05')).not.toBeInTheDocument();
  });

  it('reports which page is on screen and how many there are', () => {
    render(<UnitsTable units={MANY} tool="pitest" />);

    expect(screen.getByText('Página 1 de 12')).toBeInTheDocument();
  });

  it('moves to the next page and back', async () => {
    const user = userEvent.setup();
    render(<UnitsTable units={MANY} tool="pitest" />);

    await user.click(nextPage());

    expect(screen.getByTitle('com.example.Clase05')).toBeInTheDocument();
    expect(screen.queryByTitle('com.example.Clase00')).not.toBeInTheDocument();
    expect(screen.getByText('Página 2 de 12')).toBeInTheDocument();

    await user.click(previousPage());

    expect(screen.getByTitle('com.example.Clase00')).toBeInTheDocument();
  });

  it('has nowhere to go back from the first page, nor forward from the last', async () => {
    const user = userEvent.setup();
    render(<UnitsTable units={MANY} tool="pitest" />);

    expect(previousPage()).toBeDisabled();

    // Con 25 por página el final está a dos clics; el tamaño por defecto exigiría
    // once y no probaría nada distinto.
    await user.selectOptions(pageSizeSelect(), '25');
    await user.click(nextPage());
    await user.click(nextPage());

    expect(nextPage()).toBeDisabled();
    expect(bodyRows()).toHaveLength(10);
  });

  it('lets the user pick how many rows fit on a page', async () => {
    const user = userEvent.setup();
    render(<UnitsTable units={MANY} tool="pitest" />);

    await user.selectOptions(pageSizeSelect(), '50');

    expect(bodyRows()).toHaveLength(50);
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
  });

  // Paginar rompe el Ctrl+F sobre la tabla entera, que es un flujo real: «Todas»
  // lo devuelve a quien lo necesite.
  it('can show every unit at once', async () => {
    const user = userEvent.setup();
    render(<UnitsTable units={MANY} tool="pitest" />);

    await user.selectOptions(pageSizeSelect(), 'all');

    expect(bodyRows()).toHaveLength(60);
    // Una sola página: no hay navegación que ofrecer.
    expect(
      screen.queryByRole('button', { name: 'Página siguiente · Todas las unidades' }),
    ).not.toBeInTheDocument();
  });

  // Sin esto, filtrar desde la página 3 deja la tabla vacía aunque haya
  // coincidencias: siguen estando, pero en una página que ya no existe.
  it('returns to the first page when the filter changes', async () => {
    const user = userEvent.setup();
    render(<UnitsTable units={MANY} tool="pitest" />);

    await user.click(nextPage());
    await user.click(nextPage());
    expect(screen.getByText('Página 3 de 12')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: /filtrar/i }), 'Clase0');

    // Diez coincidencias (Clase00–Clase09) reparte en dos páginas, y la primera es
    // la que se muestra.
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    expect(screen.getByTitle('com.example.Clase00')).toBeInTheDocument();
  });

  // Ordenar reordena el conjunto entero, no solo la página visible.
  it('sorts across every page, not just the visible one', async () => {
    const user = userEvent.setup();
    render(<UnitsTable units={MANY} tool="pitest" />);

    await user.click(screen.getByRole('button', { name: /clase \/ fichero/i }));
    await user.click(screen.getByRole('button', { name: /clase \/ fichero/i }));

    // Descendente: la última unidad del conjunto encabeza la primera página.
    expect(bodyRows()[0]?.textContent).toContain('Clase59');
  });

  // Con cuatro unidades no hay nada que paginar ni motivo para cambiar el tamaño:
  // ya están todas a la vista, así que los controles no aportan nada.
  it('keeps the controls out of the way when everything already fits', () => {
    render(<UnitsTable units={UNITS} tool="pitest" />);

    expect(
      screen.queryByRole('button', { name: 'Página siguiente · Todas las unidades' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
