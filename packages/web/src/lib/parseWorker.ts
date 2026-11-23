import { parseReportFile, type ParseRequest } from './reportParser';

// Punto de entrada del worker de `parseInWorker`: solo el cableado, la lógica
// está en `parseReportFile`, que se testea fuera de un worker. jsdom no tiene
// workers, así que este fichero lo ejercitan los e2e, no los tests unitarios.
self.onmessage = async (event: MessageEvent<ParseRequest>) => {
  self.postMessage(await parseReportFile(event.data));
};
