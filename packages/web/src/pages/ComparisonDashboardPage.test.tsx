import { render, screen, within } from '@testing-library/react';
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
    regressions: [],
    uncovered: [],
    added: [],
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
  });

  it('renders the units table with one row per unit', async () => {
    getComparisonMock.mockResolvedValue(makeResult());
    renderDashboard();

    const cell = await screen.findByText('com.example.Calculator');
    const row = cell.closest('tr');
    expect(row).toHaveAttribute('data-kind', 'improved');
    expect(within(row as HTMLElement).getByText('Mejora ▲')).toBeInTheDocument();
  });

  it('shows a loading indicator while the comparison is being fetched', () => {
    getComparisonMock.mockReturnValue(new Promise(() => {}));
    renderDashboard();

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('shows the API error message when the comparison cannot be loaded', async () => {
    getComparisonMock.mockRejectedValue(
      new ApiClientError(404, 'COMPARISON_NOT_FOUND', 'Comparison not found'),
    );
    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent('Comparison not found');
  });
});
