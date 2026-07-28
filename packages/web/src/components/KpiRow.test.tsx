import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ComparisonResult, UnitMetrics } from 'core';
import { KpiRow } from './KpiRow';

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

function cardByLabel(label: string): HTMLElement {
  const card = screen.getByText(label).closest('[data-variant]');
  if (!card) throw new Error(`No card found for label ${label}`);
  return card as HTMLElement;
}

describe('KpiRow', () => {
  // Score y cobertura encabezan la comparación desde SummaryBand (T-047); repetirlos
  // aquí daría a la misma cifra dos pesos visuales distintos.
  it('leaves score and coverage to the summary band', () => {
    render(
      <KpiRow
        global={makeGlobal(
          metrics({ score: 80, coveredPct: 90 }),
          metrics({ score: 85, coveredPct: 88 }),
        )}
      />,
    );

    expect(screen.queryByText('Mutation score')).not.toBeInTheDocument();
    expect(screen.queryByText('Mutantes cubiertos')).not.toBeInTheDocument();
  });

  it('renders base → head values and a signed delta on each count', () => {
    render(<KpiRow global={makeGlobal(metrics({ killed: 8 }), metrics({ killed: 9 }))} />);

    const killed = cardByLabel('Killed');
    expect(within(killed).getByText('8')).toBeInTheDocument();
    expect(within(killed).getByText('9')).toBeInTheDocument();
    expect(within(killed).getByText('+1')).toBeInTheDocument();
  });

  // Mismo énfasis que SummaryBand: la cifra destacada es el valor nuevo. Con el
  // delta destacado, la misma pantalla resaltaba dos magnitudes distintas.
  it('leads each KPI with the new value rather than the delta', () => {
    render(<KpiRow global={makeGlobal(metrics({ killed: 8 }), metrics({ killed: 9 }))} />);

    const headline = cardByLabel('Killed').querySelector('[data-kpi="value"]');
    expect(headline).toHaveTextContent('9');
  });

  it('treats more survivors as a negative trend (higher is worse)', () => {
    render(<KpiRow global={makeGlobal(metrics({ survived: 1 }), metrics({ survived: 4 }))} />);

    const survivors = cardByLabel('Survivors');
    expect(within(survivors).getByText('+3')).toBeInTheDocument();
    expect(survivors).toHaveAttribute('data-variant', 'negative');
  });

  it('renders killed, survivors, no-coverage and timeout count cards', () => {
    render(
      <KpiRow
        global={makeGlobal(
          metrics({ killed: 8, survived: 2, noCoverage: 1, timeout: 0 }),
          metrics({ killed: 9, survived: 1, noCoverage: 2, timeout: 1 }),
        )}
      />,
    );

    expect(within(cardByLabel('Killed')).getByText('+1')).toBeInTheDocument();
    expect(within(cardByLabel('Survivors')).getByText('-1')).toBeInTheDocument();
    expect(within(cardByLabel('Sin cubrir')).getByText('+1')).toBeInTheDocument();
    expect(within(cardByLabel('Timeouts')).getByText('+1')).toBeInTheDocument();
  });

  // Dirección y polaridad son ejes independientes: subir es un hecho del dato, que
  // suba sea bueno es una interpretación. Aquí se contradicen, así que la flecha no
  // puede derivarse del variant.
  it('points the arrow up on a rise even when rising is the bad direction', () => {
    render(<KpiRow global={makeGlobal(metrics({ survived: 1 }), metrics({ survived: 4 }))} />);

    const survivors = cardByLabel('Survivors');
    expect(survivors).toHaveAttribute('data-trend', 'up');
    expect(survivors).toHaveAttribute('data-variant', 'negative');
    expect(within(survivors).getByText('▲')).toBeInTheDocument();
  });

  it('points the arrow down on a fall', () => {
    render(<KpiRow global={makeGlobal(metrics({ killed: 9 }), metrics({ killed: 8 }))} />);

    const killed = cardByLabel('Killed');
    expect(killed).toHaveAttribute('data-trend', 'down');
    expect(within(killed).getByText('▼')).toBeInTheDocument();
  });

  it('shows no arrow on a count that did not move', () => {
    render(<KpiRow global={makeGlobal(metrics({ killed: 8 }), metrics({ killed: 8 }))} />);

    const killed = cardByLabel('Killed');
    expect(killed).toHaveAttribute('data-trend', 'flat');
    expect(within(killed).queryByText('▲')).not.toBeInTheDocument();
    expect(within(killed).queryByText('▼')).not.toBeInTheDocument();
  });

  // Timeouts no lleva color por no tener polaridad clara, pero la dirección del
  // cambio sigue siendo un dato objetivo que sí se puede mostrar.
  it('still shows a direction for timeouts, which carry no good/bad color', () => {
    render(<KpiRow global={makeGlobal(metrics({ timeout: 0 }), metrics({ timeout: 3 }))} />);

    const timeouts = cardByLabel('Timeouts');
    expect(timeouts).toHaveAttribute('data-variant', 'neutral');
    expect(timeouts).toHaveAttribute('data-trend', 'up');
  });

  it('marks a zero delta as a neutral trend', () => {
    render(<KpiRow global={makeGlobal(metrics({ killed: 8 }), metrics({ killed: 8 }))} />);

    expect(cardByLabel('Killed')).toHaveAttribute('data-variant', 'neutral');
  });

  // Sin polaridad buena/mala clara: subir o bajar no dice por sí solo si va mejor.
  it('never colors the timeout trend', () => {
    render(<KpiRow global={makeGlobal(metrics({ timeout: 0 }), metrics({ timeout: 3 }))} />);

    expect(cardByLabel('Timeouts')).toHaveAttribute('data-variant', 'neutral');
  });
});
