import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { ARTIFACT_PATH } from './artifactServer.js';
import { fixture } from './fixtures.js';

/**
 * Ejercita el **artefacto construido** (`packages/web/dist`), no el servidor de
 * desarrollo, y servido como lo sirve la máquina interna: ficheros estáticos,
 * **sin regla de reescritura a `index.html`** y colgando de un subpath.
 *
 * Es lo que cierra el hueco de T-073: hasta aquí, ni CI ni la release
 * ejercitaban lo que de verdad se publica. Un `base` mal resuelto, un asset que
 * no entra en el zip o una vuelta a `BrowserRouter` (T-072) dejan la aplicación
 * en blanco sin que ningún otro test se entere, porque el servidor de
 * desarrollo de Vite sirve desde la raíz y reescribe cualquier ruta.
 */
const HOME = ARTIFACT_PATH;

/** Errores de consola que no son del artefacto: el `dist` no declara favicon. */
function isArtifactError(text: string): boolean {
  return !text.includes('favicon');
}

test.describe('artefacto estático', () => {
  test('compara y exporta servido desde un subpath, sin una sola petición fuera', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    const requested: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && isArtifactError(message.text())) {
        consoleErrors.push(message.text());
      }
    });
    page.on('requestfailed', (request) => failedRequests.push(request.url()));
    page.on('request', (request) => requested.push(request.url()));

    await page.goto(HOME);
    await expect(page.getByRole('heading', { name: /nueva comparación/i })).toBeVisible();

    await page.getByLabel('Ejecución base').setInputFiles(fixture('pitest', 'base'));
    await page.getByLabel('Ejecución nueva').setInputFiles(fixture('pitest', 'head'));
    await page.getByRole('button', { name: 'Comparar' }).click();

    await expect(page.getByRole('heading', { name: 'Comparación · pitest' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Retrocesos' }).getByText('com.acme.billing.TaxCalculator'),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar HTML' }).click();
    const download = await downloadPromise;
    const html = await readFile(await download.path(), 'utf-8');
    expect(html).toContain('com.acme.billing.TaxCalculator');
    expect(html).not.toMatch(/<link\s|<script|src="https?:|href="https?:/i);

    // Con `base: './'` un asset mal resuelto se pide fuera del subpath y el
    // servidor responde 404, que no es un `requestfailed`: de ahí que se mire
    // también la consola, donde sí aparece.
    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);

    // Política de privacidad (T-077): comparar no saca ni un byte del navegador.
    // Todo lo pedido sale del propio subpath del artefacto.
    const foreign = requested.filter((url) => !url.includes(HOME));
    expect(foreign).toEqual([]);
  });

  test('recupera la comparación al recargar, sin fallback en el servidor', async ({ page }) => {
    await page.goto(HOME);
    await page.getByLabel('Ejecución base').setInputFiles(fixture('pitest', 'base'));
    await page.getByLabel('Ejecución nueva').setInputFiles(fixture('pitest', 'head'));
    await page.getByRole('button', { name: 'Comparar' }).click();

    // La ruta va en el hash (T-072): el servidor solo ve el subpath.
    await expect(page).toHaveURL(new RegExp(`${HOME}#/comparisons/[0-9a-f-]{36}$`));

    // El resultado vive en `sessionStorage`, no en un servidor: recargar tiene
    // que devolver la misma comparación, no un «no encontrada».
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Comparación · pitest' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Retrocesos' }).getByText('com.acme.billing.TaxCalculator'),
    ).toBeVisible();
  });

  test('una ruta de la aplicación fuera del hash da 404, no index.html', async ({ page }) => {
    // Sin esto, el test de recarga no probaría nada: pasaría igual con un
    // servidor que reescribe cualquier ruta a `index.html`.
    const deepRoute = await page.request.get(
      `${HOME}comparisons/00000000-0000-4000-8000-000000000000`,
    );
    expect(deepRoute.status()).toBe(404);

    const home = await page.request.get(HOME);
    expect(home.status()).toBe(200);
  });
});
