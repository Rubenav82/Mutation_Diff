import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorMessage } from './ErrorMessage';

describe('ErrorMessage', () => {
  it('renders the message inside an alert region', () => {
    render(<ErrorMessage message="Comparison not found" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Comparison not found');
  });

  it('renders no retry button when no retry handler is given', () => {
    render(<ErrorMessage message="Comparison not found" />);

    expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();
  });

  it('calls the retry handler when the retry button is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorMessage message="Comparison not found" onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders no help button when no help handler is given', () => {
    render(<ErrorMessage message="Informe no válido" />);

    expect(screen.queryByRole('button', { name: 'Ver instrucciones' })).not.toBeInTheDocument();
  });

  it('calls the help handler from its own button, inside the alert', async () => {
    const user = userEvent.setup();
    const onShowHelp = vi.fn();
    render(<ErrorMessage message="Informe no válido" onShowHelp={onShowHelp} />);

    await user.click(
      within(screen.getByRole('alert')).getByRole('button', { name: 'Ver instrucciones' }),
    );

    expect(onShowHelp).toHaveBeenCalledTimes(1);
  });
});
