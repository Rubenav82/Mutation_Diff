import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThresholdHelpPanel } from './ThresholdHelpPanel';

const panel = () => screen.getByRole('region', { name: /ayuda de umbrales/i });

describe('ThresholdHelpPanel', () => {
  it('renders as a region with its own accessible name and id', () => {
    render(<ThresholdHelpPanel id="threshold-help" />);

    expect(panel()).toHaveAttribute('id', 'threshold-help');
  });

  it('explains the regression rule, its default and that it counts score points', () => {
    render(<ThresholdHelpPanel id="threshold-help" />);

    expect(panel()).toHaveTextContent('Δ = score nuevo − score base');
    expect(panel()).toHaveTextContent(/puntos de score, no un porcentaje relativo/i);
    // La frontera inclusiva es justo lo que sorprende: una caída igual al umbral
    // se tolera.
    expect(panel()).toHaveTextContent(/de 80 a 75/i);
    expect(panel()).toHaveTextContent(/por defecto 0/i);
  });

  it('explains the uncovered rule, its default and the trap of setting it to 0', () => {
    render(<ThresholdHelpPanel id="threshold-help" />);

    expect(panel()).toHaveTextContent('NO_COVERAGE / total × 100 ≥ umbral');
    expect(panel()).toHaveTextContent(/solo la ejecución nueva/i);
    expect(panel()).toHaveTextContent(/por defecto 100/i);
    expect(panel()).toHaveTextContent(/con 0 se marcan todas/i);
  });

  it('warns that a small class moves many points per mutant', () => {
    render(<ThresholdHelpPanel id="threshold-help" />);

    expect(panel()).toHaveTextContent(/12,5 puntos/);
  });

  it('says the two thresholds are independent of each other', () => {
    render(<ThresholdHelpPanel id="threshold-help" />);

    expect(panel()).toHaveTextContent(/mejora.+sin cobertura/i);
  });
});
