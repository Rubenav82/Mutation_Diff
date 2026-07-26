import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FileDropZone } from './FileDropZone';

function ControlledZone({ acceptedExtension }: { acceptedExtension: string }) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <FileDropZone
      id="testFile"
      label="Zona de prueba"
      acceptedExtension={acceptedExtension}
      file={file}
      onFileSelected={setFile}
      onClear={() => setFile(null)}
    />
  );
}

describe('FileDropZone', () => {
  it('renders the label and an extension hint', () => {
    render(<ControlledZone acceptedExtension=".xml" />);

    expect(screen.getByText('Zona de prueba')).toBeInTheDocument();
    expect(screen.getByText(/\.xml/)).toBeInTheDocument();
  });

  it('accepts a file with the expected extension selected via the file input', async () => {
    const user = userEvent.setup();
    render(<ControlledZone acceptedExtension=".xml" />);

    const file = new File(['<mutations/>'], 'base.xml', { type: 'text/xml' });
    const input = screen.getByLabelText(/zona de prueba/i, { selector: 'input' });
    await user.upload(input, file);

    expect(screen.getByText('base.xml')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rejects a file with the wrong extension and shows an inline error', () => {
    render(<ControlledZone acceptedExtension=".xml" />);

    const file = new File(['{}'], 'base.json', { type: 'application/json' });
    const input = screen.getByLabelText(/zona de prueba/i, { selector: 'input' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByRole('alert')).toHaveTextContent('.xml');
    expect(screen.queryByText('base.json')).not.toBeInTheDocument();
  });

  it('offers a link to the configuration help next to the validation error when onShowHelp is provided', () => {
    const onShowHelp = vi.fn();
    render(
      <FileDropZone
        id="testFile"
        label="Zona de prueba"
        acceptedExtension=".xml"
        file={null}
        onFileSelected={vi.fn()}
        onClear={vi.fn()}
        onShowHelp={onShowHelp}
      />,
    );

    const file = new File(['{}'], 'base.json', { type: 'application/json' });
    const input = screen.getByLabelText(/zona de prueba/i, { selector: 'input' });
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: /instrucciones/i }));

    expect(onShowHelp).toHaveBeenCalledOnce();
  });

  it('does not render a help link when onShowHelp is not provided', () => {
    render(<ControlledZone acceptedExtension=".xml" />);

    const file = new File(['{}'], 'base.json', { type: 'application/json' });
    const input = screen.getByLabelText(/zona de prueba/i, { selector: 'input' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /instrucciones/i })).not.toBeInTheDocument();
  });

  it('accepts a valid file dropped onto the zone', () => {
    const onFileSelected = vi.fn();
    render(
      <FileDropZone
        id="testFile"
        label="Zona de prueba"
        acceptedExtension=".xml"
        file={null}
        onFileSelected={onFileSelected}
        onClear={vi.fn()}
      />,
    );

    const file = new File(['<mutations/>'], 'base.xml', { type: 'text/xml' });
    const dropTarget = screen.getByText(/\.xml/);

    dropTarget.dispatchEvent(
      Object.assign(new Event('drop', { bubbles: true, cancelable: true }), {
        dataTransfer: { files: [file] },
      }),
    );

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it('calls onClear when the remove button is clicked', async () => {
    const user = userEvent.setup();
    render(<ControlledZone acceptedExtension=".xml" />);

    const file = new File(['<mutations/>'], 'base.xml', { type: 'text/xml' });
    const input = screen.getByLabelText(/zona de prueba/i, { selector: 'input' });
    await user.upload(input, file);

    await user.click(screen.getByRole('button', { name: /quitar/i }));

    expect(screen.queryByText('base.xml')).not.toBeInTheDocument();
  });
});
