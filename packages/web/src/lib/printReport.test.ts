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
function spyOnPrint(): {
  print: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  frame: () => HTMLIFrameElement;
} {
  const print = vi.fn();
  const close = vi.fn();
  let captured: HTMLIFrameElement;
  const append = vi.spyOn(document.body, 'appendChild');
  append.mockImplementation(<T extends Node>(node: T): T => {
    const result = Node.prototype.appendChild.call(document.body, node) as T;
    if (node instanceof HTMLIFrameElement && node.contentWindow) {
      captured = node;
      Object.defineProperty(node.contentWindow, 'print', { value: print, configurable: true });
      // Envuelve el `close` real en vez de sustituirlo: el documento tiene que
      // cerrarse de verdad, solo se quiere saber cuándo.
      const frameDocument = node.contentWindow.document;
      const realClose = frameDocument.close.bind(frameDocument);
      close.mockImplementation(() => realClose());
      Object.defineProperty(frameDocument, 'close', { value: close, configurable: true });
    }
    return result;
  });
  return { print, close, frame: () => captured };
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

  it('has the report inside the iframe at the moment of printing', () => {
    const { print, frame } = spyOnPrint();
    let bodyWhilePrinting: string | undefined;
    print.mockImplementation(() => {
      bodyWhilePrinting = frame().contentDocument?.body.innerHTML;
    });

    printReport(HTML, 'mutadiff-report-abc');

    // Lo que se imprimiría es este cuerpo: si el informe no llegó a escribirse,
    // el PDF sale en blanco sin que nada falle.
    expect(bodyWhilePrinting).toBe('<p>informe</p>');
  });

  it('closes the iframe document before printing', () => {
    const { print, close } = spyOnPrint();

    printReport(HTML, 'mutadiff-report-abc');

    // Sin `close()` el documento no termina de cargar, y el estándar aplaza un
    // `print()` sobre un documento sin cargar hasta su evento `load` («print when
    // loaded»), que ya no llega: el diálogo no se abriría nunca. jsdom no lo
    // puede mostrar —su `document.write` reemplaza el documento entero y deja
    // `readyState` en `complete` con o sin `close()`—, así que lo que se fija es
    // el orden de las llamadas. No se cuentan: jsdom vuelve a llamar a `close`
    // por su cuenta al retirar el iframe (`_detach` → `window.close`), después de
    // imprimir. Lo que importa es que la primera sea anterior a `print()`.
    expect(close).toHaveBeenCalled();
    expect(close.mock.invocationCallOrder[0]).toBeLessThan(print.mock.invocationCallOrder[0]!);
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

  it('keeps the iframe out of view and out of the accessibility tree without hiding it', () => {
    const { frame } = spyOnPrint();

    printReport(HTML, 'mutadiff-report-abc');

    const node = frame();
    expect(node.getAttribute('aria-hidden')).toBe('true');
    expect(node.tabIndex).toBe(-1);
    // Tamaño cero y fuera del flujo, nunca `display:none`: así sigue componiendo
    // layout, que es lo que hace falta para que no se imprima en blanco.
    expect(node.style.position).toBe('fixed');
    expect(node.style.width).toMatch(/^0(px)?$/);
    expect(node.style.height).toMatch(/^0(px)?$/);
    expect(node.style.display).not.toBe('none');
  });

  it('gives up cleanly when the iframe gets no window to print from', () => {
    document.title = 'Mutator Assessment Report';
    // Sin insertarlo en el documento, el iframe no tiene `contentWindow`.
    vi.spyOn(document.body, 'appendChild').mockImplementation(<T extends Node>(node: T): T => node);

    expect(() => printReport(HTML, 'mutadiff-report-abc')).not.toThrow();
    expect(document.title).toBe('Mutator Assessment Report');
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
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
