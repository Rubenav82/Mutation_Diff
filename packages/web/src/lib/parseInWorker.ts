import type { ParseRequest, ParseResponse } from './reportParser';

/**
 * Parses one report in a worker of its own, so the page keeps responding while
 * it runs (seconds with a large report) and the two sides run at the same time.
 * Vite emits the worker as one more asset with a relative URL, which is what
 * keeps it working under a subpath (`base: './'`).
 */
export function parseInWorker(request: ParseRequest): Promise<ParseResponse> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./parseWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<ParseResponse>) => {
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(`El análisis en segundo plano no pudo arrancar: ${event.message}`));
    };
    worker.postMessage(request);
  });
}
