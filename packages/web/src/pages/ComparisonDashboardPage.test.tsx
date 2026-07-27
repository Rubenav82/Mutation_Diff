import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComparisonResult, UnitMetrics } from 'core';
import { ApiClientError, getComparison } from '../api/client';
import { ComparisonDashboardPage } from './ComparisonDashboardPage';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return { ...actual, getComparison: vi.fn() };
});

const getComparisonMock = vi.mocked(getComparison);

function metrics(over: Partial<UnitMetrics> = {}): UnitMetrics {
  return {
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
    ...over,
  };
}

function makeResult(): ComparisonResult {
  const base = metrics({ score: 80, coveredPct: 90 });
  const head = metrics({ score: 85, coveredPct: 88 });
  return {
    tool: 'pitest',
    context: {
      baseLabel: 'mutations-enero.xml',
      headLabel: 'mutations-febrero.xml',
      regressionThreshold: 0,
      uncoveredThreshold: 100,
    },
    global: { base, head, scoreDelta: 5, coverageDelta: -2 },
    units: [
      {
        key: 'com.example.Calculator',
        kind: 'improved',
        base: metrics({ score: 80 }),
        head: metrics({ score: 85 }),
        scoreDelta: 5,
        coverageDelta: 0,
        isUncovered: false,
      },
    ],
    regressions: [
      {
        key: 'com.example.TaxCalculator',
        kind: 'regressed',
        base: metrics({ score: 90 }),
        head: metrics({ score: 55 }),
        scoreDelta: -35,
        coverageDelta: -5,
        isUncovered: false,
      },
    ],
    uncovered: [
      {
        key: 'com.example.EmailSender',
        kind: 'unchanged',
        base: metrics({ score: 0, noCoverage: 10 }),
        head: metrics({ score: 0, noCoverage: 10 }),
        scoreDelta: 0,
        coverageDelta: 0,
        isUncovered: true,
      },
    ],
    added: [
      {
        key: 'com.example.RefundService',
        kind: 'added',
        head: metrics({ score: 50 }),
        scoreDelta: null,
        coverageDelta: null,
        isUncovered: false,
      },
    ],
    removed: [],
  };
}

function renderDashboard(id = 'abc-123') {
  return render(
    <MemoryRouter initialEntries={[`/comparisons/${id}`]}>
      <Routes>
        <Route path="/comparisons/:id" element={<ComparisonDashboardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getComparisonMock.mockReset();
});

describe('ComparisonDashboardPage', () => {
  it('fetches the comparison by id and renders the global summary cards', async () => {
    getComparisonMock.mockResolvedValue(makeResult());
    renderDashboard('abc-123');

    const score = (await screen.findByText('Mutation score')).closest('[data-variant]');
    expect(getComparisonMock).toHaveBeenCalledWith('abc-123');
    expect(score).not.toBeNull();
    expect(within(score as HTMLElement).getByText('+5.0%')).toBeInTheDocument();
    // Los conteos secundarios siguen presentes junto a la banda.
    expect(screen.getByText('Survivors')).toBeInTheDocument();
  });

  it('renders the units table with one row per unit', async () => {
    getComparisonMock.mockResolvedValue(makeResult());
    renderDashboard();

    const cell = await screen.findByText('com.example.Calculator');
    const row = cell.closest('tr');
    expect(row).toHaveAttribute('data-kind', 'improved');
    expect(within(row as HTMLElement).getByText('Mejora ▲')).toBeInTheDocument();
  });

  it('renders the regressions, uncovered, added and removed sections', async () => {
    getComparisonMock.mockResolvedValue(makeResult());
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Regresiones (1)' })).toBeInTheDocument();
    expect(screen.getByText('com.example.TaxCalculator')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Sin cobertura (1)' })).toBeInTheDocument();
    expect(screen.getByText('com.example.EmailSender')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Nuevas (1)' })).toBeInTheDocument();
    expect(screen.getByText('com.example.RefundService')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Eliminadas (0)' })).toBeInTheDocument();
    expect(screen.getByText('No hay unidades eliminadas.')).toBeInTheDocument();
  });

  it('offers an HTML export link pointing at the report endpoint', async () => {
    getComparisonMock.mockResolvedValue(makeResult());
    renderDashboard('abc 123');

    const link = await screen.findByRole('link', { name: 'Exportar HTML' });
    // the id is encoded so a key with spaces/slashes still resolves
    expect(link).toHaveAttribute('href', '/api/comparisons/abc%20123/report');
    expect(link).toHaveAttribute('download');
  });

  // El rail de contexto (T-046): al reabrir una comparación por su id, es lo único
  // que dice de dónde salió el resultado — el servidor no guarda los ficheros.
  it('shows the compared file names and the applied thresholds in the context rail', async () => {
    getComparisonMock.mockResolvedValue(makeResult());
    renderDashboard();

    const rail = await screen.findByRole('complementary', { name: 'Contexto de la comparación' });
    expect(within(rail).getByText('mutations-enero.xml')).toBeInTheDocument();
    expect(within(rail).getByText('mutations-febrero.xml')).toBeInTheDocument();
    expect(within(rail).getByText('0%')).toBeInTheDocument();
    expect(within(rail).getByText('100%')).toBeInTheDocument();
    // La herramienta encabeza la comparación en la banda, no se repite aquí.
    expect(within(rail).queryByText('pitest')).not.toBeInTheDocument();
  });

  it('falls back to a placeholder when a run carries no file name', async () => {
    const result = makeResult();
    getComparisonMock.mockResolvedValue({
      ...result,
      context: {
        regressionThreshold: result.context.regressionThreshold,
        uncoveredThreshold: result.context.uncoveredThreshold,
      },
    });
    renderDashboard();

    const rail = await screen.findByRole('complementary', { name: 'Contexto de la comparación' });
    expect(within(rail).getAllByText('Sin nombre')).toHaveLength(2);
  });

  // No recalcula con otros umbrales: el servidor nunca guarda los ficheros subidos
  // (memoryStorage, T-020), así que habría que volver a subirlos.
  it('links back to the wizard instead of offering to recompute', async () => {
    getComparisonMock.mockResolvedValue(makeResult());
    renderDashboard();

    const rail = await screen.findByRole('complementary', { name: 'Contexto de la comparación' });
    expect(within(rail).getByRole('link', { name: 'Nueva comparación' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('shows a loading indicator while the comparison is being fetched', () => {
    getComparisonMock.mockReturnValue(new Promise(() => {}));
    renderDashboard();

    expect(screen.getByRole('status')).toHaveTextContent(/cargando/i);
  });

  it('shows the API error message when the comparison cannot be loaded', async () => {
    getComparisonMock.mockRejectedValue(
      new ApiClientError(404, 'COMPARISON_NOT_FOUND', 'Comparison not found'),
    );
    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent('Comparison not found');
  });

  it('refetches the comparison when the user retries after a failed load', async () => {
    const user = userEvent.setup();
    getComparisonMock.mockRejectedValueOnce(
      new ApiClientError(500, 'INTERNAL_ERROR', 'Unexpected error'),
    );
    getComparisonMock.mockResolvedValueOnce(makeResult());
    renderDashboard('abc-123');
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByText('Mutation score')).toBeInTheDocument();
    expect(getComparisonMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
