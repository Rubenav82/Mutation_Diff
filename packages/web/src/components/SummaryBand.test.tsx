import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ComparisonResult, UnitMetrics } from 'core';
import { SummaryBand } from './SummaryBand';

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

function makeGlobal(base: UnitMetrics, head: UnitMetrics): ComparisonResult['global'] {
  return {
    base,
    head,
    scoreDelta: head.score - base.score,
    coverageDelta: head.coveredPct - base.coveredPct,
  };
}

function renderBand(over: Partial<Parameters<typeof SummaryBand>[0]> = {}) {
  return render(
    <SummaryBand
      tool="pitest"
      global={makeGlobal(
        metrics({ score: 80, coveredPct: 90 }),
        metrics({ score: 85, coveredPct: 88 }),
      )}
      regressionCount={0}
      reportUrl="/api/comparisons/abc/report"
      {...over}
    />,
  );
}

function figure(label: string): HTMLElement {
  const node = screen.getByText(label).closest('[data-variant]');
  if (!node) throw new Error(`No figure found for label ${label}`);
  return node as HTMLElement;
}

describe('SummaryBand', () => {
  it('names the comparison and the tool it came from', () => {
    renderBand();

    expect(screen.getByRole('heading', { name: 'Comparación · pitest' })).toBeInTheDocument();
  });

  it('leads with the new score and coverage, keeping base → head and the delta', () => {
    renderBand();

    const score = figure('Mutation score');
    expect(within(score).getByText('85.0%')).toBeInTheDocument();
    expect(within(score).getByText('80.0%')).toBeInTheDocument();
    expect(within(score).getByText('+5.0%')).toBeInTheDocument();

    const coverage = figure('Mutantes cubiertos');
    expect(within(coverage).getByText('88.0%')).toBeInTheDocument();
    expect(within(coverage).getByText('-2.0%')).toBeInTheDocument();
  });

  it('colors a rise as positive and a drop as negative', () => {
    renderBand();

    expect(figure('Mutation score')).toHaveAttribute('data-variant', 'positive');
    expect(figure('Mutantes cubiertos')).toHaveAttribute('data-variant', 'negative');
  });

  it('marks an unchanged score as neutral', () => {
    renderBand({ global: makeGlobal(metrics({ score: 80 }), metrics({ score: 80 })) });

    expect(figure('Mutation score')).toHaveAttribute('data-variant', 'neutral');
  });

  it('counts the regressions, in singular and plural', () => {
    renderBand({ regressionCount: 3 });
    expect(screen.getByText('3 regresiones')).toBeInTheDocument();

    renderBand({ regressionCount: 1 });
    expect(screen.getByText('1 regresión')).toBeInTheDocument();
  });

  it('says so plainly when nothing regressed', () => {
    renderBand({ regressionCount: 0 });

    expect(screen.getByText('Sin regresiones')).toBeInTheDocument();
  });

  it('offers the HTML export as a download link', () => {
    renderBand();

    const link = screen.getByRole('link', { name: 'Exportar HTML' });
    expect(link).toHaveAttribute('href', '/api/comparisons/abc/report');
    expect(link).toHaveAttribute('download');
  });
});
