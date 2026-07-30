import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';

/**
 * Ejercita el `dist` **construido**, no el servidor de desarrollo, y además por
 * `file://`.
 *
 * Es la única prueba que cubre el plugin `singleFile` de `vite.config.ts`: en
 * desarrollo no se aplica (`apply: 'build'`), así que un fallo suyo dejaría la
 * aplicación en blanco sin que ningún otro test se enterase. Y `file://` es el
 * caso estricto — origen `null`, cualquier fichero cargado aparte se bloquea
 * por CORS — así que si pasa aquí, pasa servido por HTTP desde cualquier ruta.
 */
const ARTIFACT = pathToFileURL(
  resolve(fileURLToPath(new URL('../packages/web/dist/index.html', import.meta.url))),
).href;

function fixture(side: 'base' | 'head'): string {
  return fileURLToPath(
    new URL(`../packages/core/test/fixtures/pitest/realistic/${side}.xml`, import.meta.url),
  );
}

test.describe('artefacto estático', () => {
  test('compara y exporta abierto directamente desde el sistema de ficheros', async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('requestfailed', (request) => failedRequests.push(request.url()));

    await page.goto(ARTIFACT);
    await expect(page.getByRole('heading', { name: /nueva comparación/i })).toBeVisible();

    await page.getByLabel('Ejecución base').setInputFiles(fixture('base'));
    await page.getByLabel('Ejecución nueva').setInputFiles(fixture('head'));
    await page.getByRole('button', { name: 'Comparar' }).click();

    await expect(page.getByRole('heading', { name: 'Comparación · pitest' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Retrocesos' }).getByText('com.acme.billing.TaxCalculator'),
    ).toBeVisible();

    // El resultado vive en sessionStorage, no en un servidor: recargar tiene que
    // devolver la misma comparación en vez de un "no encontrada".
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Comparación · pitest' })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar HTML' }).click();
    const download = await downloadPromise;
    const html = await readFile(await download.path(), 'utf-8');
    expect(html).toContain('com.acme.billing.TaxCalculator');
    expect(html).not.toMatch(/<link\s|<script|src="https?:|href="https?:/i);

    // Lo que de verdad distingue a este test: sin servidor detrás, cualquier
    // petición a un fichero aparte habría fallado en silencio.
    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
});
