import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { KPI_GLOSSARY } from 'core';
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
      counts={{
        base: { total: 122, covered: 115 },
        head: { total: 125, covered: 118 },
        totalDelta: 3,
        coveredDelta: 3,
      }}
      uncoveredThreshold={100}
      regressionCount={0}
      onExport={() => {}}
      onExportPdf={() => {}}
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

  // Los porcentajes dicen si la cosa ha mejorado; el recuento, sobre cuánto. Un
  // 86 % sobre doce clases y sobre novecientas no son la misma afirmación.
  it('sizes the comparison, with the units of each run and the delta', () => {
    renderBand();

    const units = figure('Clases analizadas');
    expect(within(units).getByText('125')).toBeInTheDocument();
    expect(within(units).getByText('122')).toBeInTheDocument();
    expect(within(units).getByText('+3')).toBeInTheDocument();
  });

  // «122 → 0» se lee como una caída a cero, no como «no ha cambiado»: a diferencia
  // de los porcentajes, un delta de conteo no trae unidad que lo distinga del valor
  // que tiene al lado, así que el cero se firma.
  it('signs a standing-still count instead of showing a bare zero', () => {
    renderBand({
      counts: {
        base: { total: 122, covered: 118 },
        head: { total: 122, covered: 118 },
        totalDelta: 0,
        coveredDelta: 0,
      },
    });

    const units = figure('Clases analizadas');
    expect(within(units).getByText('±0')).toBeInTheDocument();
    expect(within(units).queryByText('0')).not.toBeInTheDocument();
  });

  // Analizar más clases es mejor: significa que la ejecución nueva llega a más
  // sitio. Que baje suele ser la señal de una ejecución incompleta, y ahí el color
  // es justo lo que hace que se vea sin buscarlo.
  it('colors a rise in analysed classes as a gain, arrow included', () => {
    renderBand();

    const units = figure('Clases analizadas');
    expect(units).toHaveAttribute('data-variant', 'positive');
    expect(units).toHaveAttribute('data-trend', 'up');
    expect(within(units).getByText('▲')).toBeInTheDocument();
  });

  it('colors a drop in analysed classes as a loss', () => {
    renderBand({
      counts: {
        base: { total: 125, covered: 118 },
        head: { total: 122, covered: 118 },
        totalDelta: -3,
        coveredDelta: 0,
      },
    });

    const units = figure('Clases analizadas');
    expect(units).toHaveAttribute('data-variant', 'negative');
    expect(within(units).getByText('▼')).toBeInTheDocument();
  });

  it('leaves an unchanged count uncoloured', () => {
    renderBand({
      counts: {
        base: { total: 122, covered: 118 },
        head: { total: 122, covered: 118 },
        totalDelta: 0,
        coveredDelta: 0,
      },
    });

    expect(figure('Clases analizadas')).toHaveAttribute('data-variant', 'neutral');
  });

  // Con base y delta, como las otras tres cifras: solo el lado nuevo no dice si
  // las clases con cobertura han subido o bajado, que es la pregunta.
  it('gives the covered count its own base and delta', () => {
    renderBand();

    const covered = figure('Clases con cobertura');
    expect(within(covered).getByText('118')).toBeInTheDocument();
    expect(within(covered).getByText('115')).toBeInTheDocument();
    expect(within(covered).getByText('+3')).toBeInTheDocument();
  });

  // Aquí el color sí dice algo, a diferencia del recuento total: más clases con
  // cobertura es mejor.
  it('colors a rise in covered classes as a gain', () => {
    renderBand();

    expect(figure('Clases con cobertura')).toHaveAttribute('data-variant', 'positive');
  });

  it('colors a drop in covered classes as a loss', () => {
    renderBand({
      counts: {
        base: { total: 122, covered: 118 },
        head: { total: 125, covered: 115 },
        totalDelta: 3,
        coveredDelta: -3,
      },
    });

    expect(figure('Clases con cobertura')).toHaveAttribute('data-variant', 'negative');
  });

  // El umbral acompaña al número porque lo define: con el 100 por defecto, «sin
  // cobertura» exige que *todos* los mutantes de la clase estén sin cubrir, y el
  // dato se lee de otra manera al bajarlo.
  it('spells out the threshold the covered count answers to', () => {
    renderBand();

    expect(within(figure('Clases con cobertura')).getByText('umbral 100%')).toBeInTheDocument();
  });

  it('reads the threshold from the comparison, not from a default of its own', () => {
    renderBand({ uncoveredThreshold: 75 });

    expect(screen.getByText('umbral 75%')).toBeInTheDocument();
  });

  // Va primero porque dimensiona lo que viene detrás, pero el veredicto sigue
  // siendo el score: por eso su cifra es menor, no igual.
  it('opens with the count and keeps the score as the headline', () => {
    const { container } = renderBand();

    // Por el término y no por `firstElementChild.textContent`: desde T-088 la
    // etiqueta lleva al lado su burbuja de definición, que no es parte del rótulo.
    const labels = Array.from(container.querySelectorAll('[data-variant]')).map(
      (node) => node.querySelector('[data-kpi="term"]')?.textContent,
    );
    expect(labels).toEqual([
      'Clases analizadas',
      'Clases con cobertura',
      'Mutation score',
      'Mutantes cubiertos',
    ]);
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

  // Un tooltip por cifra (T-088): la etiqueta sola ya provocó dos confusiones
  // reales con las métricas homónimas de PiTest (T-032, T-079).
  it('describes each figure with its glossary definition', () => {
    renderBand();

    const entries = [
      KPI_GLOSSARY.analyzedClasses,
      KPI_GLOSSARY.coveredClasses,
      KPI_GLOSSARY.score,
      KPI_GLOSSARY.coveredMutants,
    ];
    for (const entry of entries) {
      expect(screen.getByText(entry.term)).toHaveAccessibleDescription(entry.definition);
    }
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

  // Los dos formatos conviven a propósito: el HTML se explora (buscable, sin
  // cortes de página) y el PDF se adjunta.
  it('offers a PDF export alongside the HTML one', async () => {
    const onExport = vi.fn();
    const onExportPdf = vi.fn();
    renderBand({ onExport, onExportPdf });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Exportar PDF' }));

    expect(onExportPdf).toHaveBeenCalledOnce();
    expect(onExport).not.toHaveBeenCalled();
  });
});
