import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ToolHelpPanel } from './ToolHelpPanel';

describe('ToolHelpPanel', () => {
  it('shows PiTest configuration instructions and the copyable snippet', () => {
    render(<ToolHelpPanel tool="pitest" id="help" />);

    expect(screen.getByText(/target\/pit-reports/)).toBeInTheDocument();
    expect(screen.getByText('outputFormats = XML', { selector: 'code' })).toBeInTheDocument();
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

    expect(await navigator.clipboard.readText()).toBe('outputFormats = XML');
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
