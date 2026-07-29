import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

/**
 * `navigator.clipboard` es un accessor heredado del prototipo, así que asignarlo
 * no basta: hay que redefinir la propiedad para poder quitarla.
 */
function withClipboard(clipboard: Clipboard | undefined): void {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard');
  Reflect.deleteProperty(document, 'execCommand');
});

describe('copyText', () => {
  it('uses the async clipboard API when the page is in a secure context', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    withClipboard({ writeText } as unknown as Clipboard);

    await copyText('outputFormats = XML');

    expect(writeText).toHaveBeenCalledWith('outputFormats = XML');
  });

  it('falls back to execCommand when there is no clipboard API', async () => {
    // Servido por HTTP plano no hay contexto seguro y `navigator.clipboard` no
    // existe. Sin este camino, el botón «Copiar» lanzaría un TypeError.
    withClipboard(undefined);
    let selectedText: string | undefined;
    const execCommand = vi.fn(() => {
      selectedText = (document.activeElement as HTMLTextAreaElement | null)?.value;
      return true;
    });
    Object.assign(document, { execCommand });

    await copyText('outputFormats = XML');

    expect(execCommand).toHaveBeenCalledWith('copy');
    // El texto tiene que estar seleccionado *en el momento* de copiar, no antes.
    expect(selectedText).toBe('outputFormats = XML');
  });

  it('leaves no scratch node behind after the fallback', async () => {
    withClipboard(undefined);
    Object.assign(document, { execCommand: vi.fn(() => true) });

    await copyText('outputFormats = XML');

    expect(document.querySelector('textarea')).toBeNull();
  });

  it('removes the scratch node even if copying throws', async () => {
    withClipboard(undefined);
    Object.assign(document, {
      execCommand: vi.fn(() => {
        throw new Error('not supported');
      }),
    });

    await expect(copyText('x')).rejects.toThrow('not supported');
    expect(document.querySelector('textarea')).toBeNull();
  });
});
