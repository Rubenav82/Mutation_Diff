import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingIndicator } from './LoadingIndicator';

describe('LoadingIndicator', () => {
  it('announces the label in a polite status region', () => {
    render(<LoadingIndicator label="Cargando comparación…" />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Cargando comparación…');
  });

  it('hides the spinner from assistive tech so only the label is announced', () => {
    const { container } = render(<LoadingIndicator label="Cargando comparación…" />);

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Cargando comparación…');
  });
});
