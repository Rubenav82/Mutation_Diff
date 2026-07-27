import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ComparisonResult, UnitMetrics } from 'core';
import { GlobalSummaryCards } from './GlobalSummaryCards';

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

describe('GlobalSummaryCards', () => {
  // Score y cobertura encabezan la comparación desde SummaryBand (T-047); repetirlos
  // aquí daría a la misma cifra dos pesos visuales distintos.
  it('leaves score and coverage to the summary band', () => {
    render(
      <GlobalSummaryCards
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
    render(
      <GlobalSummaryCards global={makeGlobal(metrics({ killed: 8 }), metrics({ killed: 9 }))} />,
    );

    const killed = cardByLabel('Killed');
    expect(within(killed).getByText('8')).toBeInTheDocument();
    expect(within(killed).getByText('9')).toBeInTheDocument();
    expect(within(killed).getByText('+1')).toBeInTheDocument();
  });

  it('treats more survivors as a negative trend (higher is worse)', () => {
    render(
      <GlobalSummaryCards
        global={makeGlobal(metrics({ survived: 1 }), metrics({ survived: 4 }))}
      />,
    );

    const survivors = cardByLabel('Survivors');
    expect(within(survivors).getByText('+3')).toBeInTheDocument();
    expect(survivors).toHaveAttribute('data-variant', 'negative');
  });

  it('renders killed, survivors, no-coverage and timeout count cards', () => {
    render(
      <GlobalSummaryCards
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

  it('marks a zero delta as a neutral trend', () => {
    render(
      <GlobalSummaryCards global={makeGlobal(metrics({ killed: 8 }), metrics({ killed: 8 }))} />,
    );

    expect(cardByLabel('Killed')).toHaveAttribute('data-variant', 'neutral');
  });

  // Sin polaridad buena/mala clara: subir o bajar no dice por sí solo si va mejor.
  it('never colors the timeout trend', () => {
    render(
      <GlobalSummaryCards global={makeGlobal(metrics({ timeout: 0 }), metrics({ timeout: 3 }))} />,
    );

    expect(cardByLabel('Timeouts')).toHaveAttribute('data-variant', 'neutral');
  });
});
