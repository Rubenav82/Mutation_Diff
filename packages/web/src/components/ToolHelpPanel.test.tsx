import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ToolHelpPanel } from './ToolHelpPanel';

/**
 * El snippet de PiTest es XML y se muestra indentado, no en una sola línea. Se
 * comprueba contra el `textContent` crudo porque `getByText` y
 * `toHaveTextContent` normalizan los espacios: con ellos, la versión de una sola
 * línea pasaría igual y el formato no quedaría fijado por ningún test.
 */
const PITEST_SNIPPET = '<outputFormats>\n  <param>XML</param>\n</outputFormats>';

describe('ToolHelpPanel', () => {
  it('shows PiTest configuration instructions and the copyable snippet', () => {
    render(<ToolHelpPanel tool="pitest" id="help" />);

    expect(screen.getByText(/target\/pit-reports/)).toBeInTheDocument();
    expect(screen.getByText(/outputFormats/, { selector: 'code' }).textContent).toBe(
      PITEST_SNIPPET,
    );
  });

  it('shows Stryker configuration instructions and the copyable snippet', () => {
    render(<ToolHelpPanel tool="stryker" id="help" />);

    expect(screen.getByText(/reports\/mutation\/mutation\.json/)).toBeInTheDocument();
    expect(
      screen.getByText('"reporters": ["json", ...]', { selector: 'code' }),
    ).toBeInTheDocument();
  });

  it('copies the snippet to the clipboard and confirms it', async () => {
    const user = userEvent.setup();
    render(<ToolHelpPanel tool="pitest" id="help" />);

    await user.click(screen.getByRole('button', { name: /copiar/i }));

    // Con los saltos de línea incluidos: se pega en el POM tal cual.
    expect(await navigator.clipboard.readText()).toBe(PITEST_SNIPPET);
    expect(screen.getByRole('button', { name: /copiado/i })).toBeInTheDocument();
  });

  it('resets the copy confirmation when the tool changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ToolHelpPanel tool="pitest" id="help" />);
    await user.click(screen.getByRole('button', { name: /copiar/i }));
    expect(screen.getByRole('button', { name: /copiado/i })).toBeInTheDocument();

    rerender(<ToolHelpPanel tool="stryker" id="help" />);

    expect(screen.getByRole('button', { name: /^copiar$/i })).toBeInTheDocument();
  });
});
