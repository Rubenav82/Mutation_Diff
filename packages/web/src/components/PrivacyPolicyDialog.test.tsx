import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PrivacyPolicyDialog } from './PrivacyPolicyDialog';

describe('PrivacyPolicyDialog', () => {
  it('renders as a modal dialog named after its own heading', () => {
    render(<PrivacyPolicyDialog onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: /política de privacidad/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('states the claims that make the policy true: no backend, local processing, contact', () => {
    render(<PrivacyPolicyDialog onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: /política de privacidad/i });
    expect(dialog).toHaveTextContent(/no existe ningún servidor/i);
    expect(dialog).toHaveTextContent(/nunca salen de él/i);
    expect(dialog).toHaveTextContent(/sessionStorage/);
    expect(screen.getByRole('link', { name: /rubenav82@gmail\.com/i })).toHaveAttribute(
      'href',
      'mailto:rubenav82@gmail.com',
    );
  });

  it('closes from the close button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PrivacyPolicyDialog onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /cerrar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PrivacyPolicyDialog onClose={onClose} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves focus into the dialog on mount', () => {
    render(<PrivacyPolicyDialog onClose={vi.fn()} />);

    // Sin esto el foco se queda en el botón que la abrió, detrás del overlay:
    // Escape y Tab seguirían actuando sobre la página de debajo.
    expect(screen.getByRole('button', { name: /cerrar/i })).toHaveFocus();
  });
});
