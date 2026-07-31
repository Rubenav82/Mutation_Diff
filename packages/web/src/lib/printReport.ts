/**
 * Imprime el informe exportado para que el navegador lo guarde como PDF.
 *
 * No hay librería de PDF y no debería haberla: el informe HTML ya existe, y
 * dibujarlo otra vez en el DSL de un pdfmake sería una segunda maquetación que
 * mantener sincronizada con `core/report/htmlReportGenerator.ts` — el mismo
 * problema que ya obliga a duplicar la paleta a mano. Rasterizarlo (jsPDF +
 * html2canvas) daría un PDF que no se puede buscar ni seleccionar, que para una
 * tabla de datos es peor que inútil. Imprimiendo, el PDF *es* el informe.
 *
 * Contrapartida asumida: el usuario pasa por el diálogo del navegador y elige
 * «Guardar como PDF»; no es una descarga directa como la del HTML.
 */
export function printReport(html: string, fileName: string): void {
  const frame = document.createElement('iframe');
  // Ni `display:none` ni `visibility:hidden`: un iframe así no compone layout y
  // se imprime en blanco. Se saca de la vista con tamaño cero.
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);

  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow) {
    frame.remove();
    return;
  }

  // `document.write` y no `srcdoc`: deja el documento listo de forma síncrona,
  // sin depender de un evento `load`. Es seguro precisamente aquí porque el
  // informe no tiene ni un recurso externo que esperar (CA-HU-07).
  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  // Chrome propone el título del documento *contenedor* como nombre del PDF, no
  // el del iframe, así que hay que prestárselo mientras dura la impresión.
  const previousTitle = document.title;
  document.title = fileName;
  frameDocument.title = fileName;

  try {
    // Sin `frameWindow.focus()` delante: hace falta en IE y Safari antiguo, que
    // imprimen el documento contenedor en vez del iframe, pero no en nada a lo
    // que esto se despliegue — y jsdom no lo implementa, así que ensucia cada
    // pasada de tests. Si alguna vez sale impresa la página en vez del informe,
    // esa llamada es lo que falta.
    frameWindow.print();
  } finally {
    // `print()` bloquea hasta que se cierra el diálogo, así que al llegar aquí
    // ya no hace falta el iframe.
    document.title = previousTitle;
    frame.remove();
  }
}
