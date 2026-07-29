import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
      onExport={() => {}}
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

  // La flecha marca la dirección del cambio y el color si esa dirección es buena o
  // mala: son dos ejes distintos, y en KpiRow llegan a contradecirse (+3 supervivientes
  // sube y empeora a la vez). Aquí coinciden, pero la flecha se deriva del signo.
  it('points the arrow up on a rise and down on a drop', () => {
    renderBand();

    const score = figure('Mutation score');
    expect(score).toHaveAttribute('data-trend', 'up');
    expect(within(score).getByText('▲')).toBeInTheDocument();

    const coverage = figure('Mutantes cubiertos');
    expect(coverage).toHaveAttribute('data-trend', 'down');
    expect(within(coverage).getByText('▼')).toBeInTheDocument();
  });

  it('shows no arrow at all when the figure did not move', () => {
    renderBand({ global: makeGlobal(metrics({ score: 80 }), metrics({ score: 80 })) });

    const score = figure('Mutation score');
    expect(score).toHaveAttribute('data-trend', 'flat');
    expect(within(score).queryByText('▲')).not.toBeInTheDocument();
    expect(within(score).queryByText('▼')).not.toBeInTheDocument();
  });

  // El delta con signo ya dice la dirección; anunciar además "triángulo hacia arriba"
  // solo añade ruido a un lector de pantalla.
  it('hides the arrow from assistive tech', () => {
    renderBand();

    expect(within(figure('Mutation score')).getByText('▲')).toHaveAttribute('aria-hidden', 'true');
  });

  it('counts the regressions, in singular and plural', () => {
    renderBand({ regressionCount: 3 });
    expect(screen.getByText('3 retrocesos')).toBeInTheDocument();

    renderBand({ regressionCount: 1 });
    expect(screen.getByText('1 retroceso')).toBeInTheDocument();
  });

  it('says so plainly when nothing regressed', () => {
    renderBand({ regressionCount: 0 });

    expect(screen.getByText('Sin retrocesos')).toBeInTheDocument();
  });

  // Botón y no enlace: ya no hay ningún recurso al que apuntar. El informe lo
  // genera el navegador en el momento, que es una acción, no una navegación.
  it('asks for the HTML export on demand', async () => {
    const onExport = vi.fn();
    renderBand({ onExport });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Exportar HTML' }));

    expect(onExport).toHaveBeenCalledOnce();
  });
});
