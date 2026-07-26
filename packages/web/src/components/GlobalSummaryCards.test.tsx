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
  it('renders score and coverage cards with base → head values and signed deltas', () => {
    render(
      <GlobalSummaryCards
        global={makeGlobal(
          metrics({ score: 80, coveredPct: 90 }),
          metrics({ score: 85, coveredPct: 88 }),
        )}
      />,
    );

    const score = cardByLabel('Mutation score');
    expect(within(score).getByText('80.0%')).toBeInTheDocument();
    expect(within(score).getByText('85.0%')).toBeInTheDocument();
    expect(within(score).getByText('+5.0%')).toBeInTheDocument();

    const coverage = cardByLabel('Cobertura');
    expect(within(coverage).getByText('-2.0%')).toBeInTheDocument();
  });

  it('colors a score increase as positive and a coverage decrease as negative', () => {
    render(
      <GlobalSummaryCards
        global={makeGlobal(
          metrics({ score: 80, coveredPct: 90 }),
          metrics({ score: 85, coveredPct: 88 }),
        )}
      />,
    );

    expect(cardByLabel('Mutation score')).toHaveAttribute('data-variant', 'positive');
    expect(cardByLabel('Cobertura')).toHaveAttribute('data-variant', 'negative');
  });

  it('treats more survivors as a negative trend (higher is worse)', () => {
    render(
      <GlobalSummaryCards
        global={makeGlobal(metrics({ survived: 1 }), metrics({ survived: 4 }))}
      />,
    );

    const survivors = cardByLabel('Supervivientes');
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
    expect(within(cardByLabel('Supervivientes')).getByText('-1')).toBeInTheDocument();
    expect(within(cardByLabel('Sin cobertura')).getByText('+1')).toBeInTheDocument();
    expect(within(cardByLabel('Timeouts')).getByText('+1')).toBeInTheDocument();
  });

  it('marks a zero delta as a neutral trend', () => {
    render(
      <GlobalSummaryCards global={makeGlobal(metrics({ score: 80 }), metrics({ score: 80 }))} />,
    );

    expect(cardByLabel('Mutation score')).toHaveAttribute('data-variant', 'neutral');
  });
});
