import { fileURLToPath } from 'node:url';

export type Tool = 'pitest' | 'stryker';

/**
 * Los e2e reutilizan las mismas fixtures que parsean los tests de `core`, así
 * que un cambio en las clases esperadas salta en las dos capas a la vez.
 *
 * Vive aquí y no dentro de un spec porque lo usan los dos: el del servidor de
 * desarrollo y el del artefacto construido.
 */
export function fixture(tool: Tool, side: 'base' | 'head'): string {
  const extension = tool === 'pitest' ? 'xml' : 'json';
  return fileURLToPath(
    new URL(
      `../packages/core/test/fixtures/${tool}/realistic/${side}.${extension}`,
      import.meta.url,
    ),
  );
}
