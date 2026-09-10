import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RELEASE_NOTES } from '../lib/releaseNotes';
import { ReleaseNotesDialog } from './ReleaseNotesDialog';

describe('ReleaseNotesDialog', () => {
  it('renders as a modal dialog named after its own heading', () => {
    render(<ReleaseNotesDialog onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: /notas de versión/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('lists every published version with its date and its changes', () => {
    render(<ReleaseNotesDialog onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: /notas de versión/i });
    for (const note of RELEASE_NOTES) {
      // La cabecera de cada entrada es la versión; la fecha va en su propio
      // nodo al lado, no dentro del heading (nombre accesible limpio).
      expect(within(dialog).getByRole('heading', { name: `v${note.version}` })).toBeInTheDocument();
      expect(dialog).toHaveTextContent(note.date);
      for (const change of note.changes) {
        expect(dialog).toHaveTextContent(change);
      }
    }
  });

  it('closes from the close button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ReleaseNotesDialog onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /cerrar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ReleaseNotesDialog onClose={onClose} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves focus into the dialog on mount', () => {
    render(<ReleaseNotesDialog onClose={vi.fn()} />);

    // Sin esto el foco se queda en el botón que lo abrió, detrás del overlay:
    // Escape y Tab seguirían actuando sobre la página de debajo.
    expect(screen.getByRole('button', { name: /cerrar/i })).toHaveFocus();
  });
});
