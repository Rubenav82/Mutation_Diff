import { readFile } from 'node:fs/promises';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Servidor de ficheros mínimo para `e2e/artifact.spec.ts`: sirve
 * `packages/web/dist` tal cual, **sin reescribir nada a `index.html`** y
 * colgando de un subpath.
 *
 * Las dos cosas son deliberadas y son lo que se está probando. Un `vite
 * preview` haría fallback de historial por defecto (`appType: 'spa'`) y taparía
 * justo el fallo que este test existe para detectar; y el subpath reproduce el
 * despliegue real, donde el artefacto puede colgar de cualquier ruta (T-072).
 * Cuarenta líneas propias evitan además una dependencia nueva para esto.
 */
export const ARTIFACT_PORT = 4180;

/** Con barra final: `index.html` referencia sus assets en relativo (`base: './'`). */
export const ARTIFACT_PATH = '/mutadiff/';

export const ARTIFACT_ORIGIN = `http://localhost:${ARTIFACT_PORT}`;

const ROOT = resolve(fileURLToPath(new URL('../packages/web/dist', import.meta.url)));

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function contentType(file: string): string {
  return CONTENT_TYPES[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream';
}

/** Ruta en disco de lo pedido, o `undefined` si cae fuera de lo que se sirve. */
function filePathFor(url: string): string | undefined {
  const { pathname } = new URL(url, ARTIFACT_ORIGIN);
  if (!pathname.startsWith(ARTIFACT_PATH)) return undefined;

  const relative = decodeURIComponent(pathname.slice(ARTIFACT_PATH.length));
  const target = resolve(
    ROOT,
    relative === '' || relative.endsWith('/') ? `${relative}index.html` : relative,
  );
  // Un `..` en la URL no puede sacar la lectura del directorio publicado.
  return target === ROOT || target.startsWith(ROOT + sep) ? target : undefined;
}

function notFound(response: ServerResponse): void {
  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not found');
}

export function createArtifactServer(): Server {
  return createServer((request, response) => {
    const file = request.url === undefined ? undefined : filePathFor(request.url);
    if (file === undefined) {
      notFound(response);
      return;
    }

    readFile(file).then(
      (body) => {
        // Sin caché: una recarga dentro de un test tiene que ver el `dist` de
        // esta pasada, no el de la anterior.
        response.writeHead(200, { 'Content-Type': contentType(file), 'Cache-Control': 'no-store' });
        response.end(body);
      },
      () => notFound(response),
    );
  });
}
