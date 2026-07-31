import { afterEach, describe, expect, it, vi } from 'vitest';
import { printReport } from './printReport';

const HTML =
  '<!doctype html><html><head><title>original</title></head><body><p>informe</p></body></html>';

/**
 * El iframe lo crea la propia función, así que no hay forma de espiar su
 * `print` de antemano: se intercepta el `appendChild` que lo inserta, que es el
 * primer momento en el que `contentWindow` existe y sigue siendo anterior a la
 * llamada a `print`.
 */
function spyOnPrint(): { print: ReturnType<typeof vi.fn>; frame: () => HTMLIFrameElement } {
  const print = vi.fn();
  let captured: HTMLIFrameElement;
  const append = vi.spyOn(document.body, 'appendChild');
  append.mockImplementation(<T extends Node>(node: T): T => {
    const result = Node.prototype.appendChild.call(document.body, node) as T;
    if (node instanceof HTMLIFrameElement) {
      captured = node;
      Object.defineProperty(node.contentWindow, 'print', { value: print, configurable: true });
    }
    return result;
  });
  return { print, frame: () => captured };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('printReport', () => {
  it('writes the report into an iframe and prints it', () => {
    const { print, frame } = spyOnPrint();

    printReport(HTML, 'mutadiff-report-abc');

    expect(print).toHaveBeenCalledOnce();
    // El contenido tiene que estar dentro en el momento de imprimir, no después.
    expect(print.mock.contexts[0]).toBe(frame().contentWindow);
  });

  it('names the document so the browser suggests it as the PDF file name', () => {
    const { print } = spyOnPrint();
    let titleWhilePrinting = '';
    print.mockImplementation(() => {
      titleWhilePrinting = document.title;
    });

    printReport(HTML, 'mutadiff-report-abc');

    expect(titleWhilePrinting).toBe('mutadiff-report-abc');
  });

  it('restores the original document title once printing is over', () => {
    document.title = 'Mutator Assessment Report';
    spyOnPrint();

    printReport(HTML, 'mutadiff-report-abc');

    expect(document.title).toBe('Mutator Assessment Report');
  });

  it('leaves no iframe behind', () => {
    spyOnPrint();

    printReport(HTML, 'mutadiff-report-abc');

    expect(document.querySelectorAll('iframe')).toHaveLength(0);
  });

  it('cleans up even when printing throws', () => {
    document.title = 'Mutator Assessment Report';
    const { print } = spyOnPrint();
    print.mockImplementation(() => {
      throw new Error('el usuario canceló');
    });

    expect(() => printReport(HTML, 'mutadiff-report-abc')).toThrow('el usuario canceló');
    expect(document.title).toBe('Mutator Assessment Report');
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
  });
});
