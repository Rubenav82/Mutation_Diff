import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KPI_GLOSSARY } from 'core';
import { KpiTerm } from './KpiTerm';

describe('KpiTerm', () => {
  it('renders the term keyboard-focusable, so the tooltip is reachable without a mouse', () => {
    render(<KpiTerm entry={KPI_GLOSSARY.score} />);

    expect(screen.getByText('Mutation score')).toHaveAttribute('tabindex', '0');
  });

  it('links the term to its definition via aria-describedby', () => {
    render(<KpiTerm entry={KPI_GLOSSARY.score} />);

    const term = screen.getByText('Mutation score');
    const tip = screen.getByRole('tooltip');
    expect(term).toHaveAttribute('aria-describedby', tip.id);
    expect(tip).toHaveTextContent(KPI_GLOSSARY.score.definition);
    expect(term).toHaveAccessibleDescription(KPI_GLOSSARY.score.definition);
  });

  // La burbuja es hermana del término, no hija: anidada, su texto entraría en el
  // nombre accesible del término y un lector lo anunciaría dos veces.
  it('keeps the definition out of the term itself', () => {
    render(<KpiTerm entry={KPI_GLOSSARY.score} />);

    expect(screen.getByText('Mutation score').textContent).toBe('Mutation score');
  });
});
