import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { version } from '../../package.json';
import { AboutMenu } from './AboutMenu';

const openPanel = async () => {
  const user = userEvent.setup();
  render(<AboutMenu />);
  await user.click(screen.getByRole('button', { name: /acerca de/i }));
  return user;
};

describe('AboutMenu', () => {
  it('keeps the panel closed until the trigger is pressed', async () => {
    const user = userEvent.setup();
    render(<AboutMenu />);

    const trigger = screen.getByRole('button', { name: /acerca de/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: /acerca de/i })).not.toBeInTheDocument();

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: /acerca de/i })).toBeInTheDocument();
  });

  it('shows the product name, the packaged version and the licence', async () => {
    await openPanel();

    const panel = screen.getByRole('region', { name: /acerca de/i });
    // El mismo nombre que pinta la cabecera, letra por letra: son dos sitios y
    // no pueden divergir.
    expect(panel).toHaveTextContent('Mutator Assessment Report');
    // La versión sale de package.json, no de un literal que se quede atrás.
    expect(panel).toHaveTextContent(`v${version}`);
    expect(panel).toHaveTextContent(/MIT License/);
  });

  it('reports a problem by email to the maintainer', async () => {
    await openPanel();

    const link = screen.getByRole('link', { name: /notificar un problema/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('mailto:rubenav82@gmail.com'));
    expect(link).toHaveAttribute('href', expect.stringContaining('subject='));
  });

  it('opens the privacy policy and closes the panel behind it', async () => {
    const user = await openPanel();

    await user.click(screen.getByRole('button', { name: /política de privacidad/i }));

    expect(screen.getByRole('dialog', { name: /política de privacidad/i })).toBeInTheDocument();
    // El panel se cierra: dejarlo abierto detrás del overlay no aporta nada y
    // devuelve el foco a un sitio tapado al cerrar el diálogo.
    expect(screen.queryByRole('region', { name: /acerca de/i })).not.toBeInTheDocument();
  });

  it('closes the privacy policy again', async () => {
    const user = await openPanel();
    await user.click(screen.getByRole('button', { name: /política de privacidad/i }));

    await user.click(screen.getByRole('button', { name: /cerrar/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the panel on Escape', async () => {
    const user = await openPanel();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('region', { name: /acerca de/i })).not.toBeInTheDocument();
  });

  it('closes the panel when clicking outside it', async () => {
    const user = await openPanel();

    await user.click(document.body);

    expect(screen.queryByRole('region', { name: /acerca de/i })).not.toBeInTheDocument();
  });
});
