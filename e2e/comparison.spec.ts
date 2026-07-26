import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * The e2e suite reuses the very same fixtures the `core` unit tests parse, so a
 * change in the expected classes shows up in both layers at once.
 */
function fixture(tool: 'pitest' | 'stryker', side: 'base' | 'head'): string {
  const extension = tool === 'pitest' ? 'xml' : 'json';
  return fileURLToPath(
    new URL(
      `../packages/core/test/fixtures/${tool}/realistic/${side}.${extension}`,
      import.meta.url,
    ),
  );
}

interface SubmitOptions {
  tool: 'pitest' | 'stryker';
  uncoveredThreshold?: string;
}

async function submitComparison(page: Page, { tool, uncoveredThreshold }: SubmitOptions) {
  await page.goto('/');
  await page.getByRole('radio', { name: tool === 'pitest' ? 'PiTest' : 'Stryker' }).check();
  await page.getByLabel('Ejecución base').setInputFiles(fixture(tool, 'base'));
  await page.getByLabel('Ejecución nueva').setInputFiles(fixture(tool, 'head'));
  if (uncoveredThreshold !== undefined) {
    await page.getByLabel('Umbral sin cobertura (%)').fill(uncoveredThreshold);
  }
  await page.getByRole('button', { name: 'Comparar' }).click();
  await expect(page).toHaveURL(/\/comparisons\/[0-9a-f-]{36}$/);
}

test.describe('flujo completo de comparación', () => {
  test('compara dos reportes de PiTest y clasifica cada clase en su sección', async ({ page }) => {
    await submitComparison(page, { tool: 'pitest' });

    await expect(page.getByRole('heading', { name: 'Comparación' })).toBeVisible();
    await expect(page.getByText('Herramienta: pitest')).toBeVisible();

    // HU-03: métricas globales con su delta.
    const metrics = page.getByRole('region', { name: 'Métricas globales' });
    await expect(metrics.getByText('Mutation score')).toBeVisible();
    await expect(metrics.getByText('Supervivientes')).toBeVisible();

    // HU-05: cada clase de la fixture cae en la sección que le corresponde.
    await expect(
      page.getByRole('region', { name: 'Regresiones' }).getByText('com.acme.billing.TaxCalculator'),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Nuevas' }).getByText('com.acme.billing.RefundService'),
    ).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: 'Eliminadas' })
        .getByText('com.acme.notifications.LegacyNotifier'),
    ).toBeVisible();
    // Umbral por defecto (100%): solo la clase sin ningún mutante cubierto.
    const uncovered = page.getByRole('region', { name: 'Sin cobertura' });
    await expect(uncovered.getByText('com.acme.notifications.EmailSender')).toBeVisible();
    await expect(uncovered.getByText('com.acme.billing.RefundService')).toHaveCount(0);
  });

  test('filtra la tabla completa por clase o paquete', async ({ page }) => {
    await submitComparison(page, { tool: 'pitest' });

    const table = page.getByRole('region', { name: 'Todas las unidades' });
    await expect(table.getByRole('row')).toHaveCount(8); // cabecera + 7 unidades

    await table
      .getByRole('searchbox', { name: 'Filtrar por clase o paquete' })
      .fill('notifications');

    await expect(table.getByRole('row')).toHaveCount(3);
    await expect(table.getByText('com.acme.notifications.EmailSender')).toBeVisible();
    await expect(table.getByText('com.acme.billing.TaxCalculator')).toHaveCount(0);
  });

  test('compara dos reportes de Stryker respetando el umbral sin cobertura', async ({ page }) => {
    // refundService.js está al 75% de NO_COVERAGE: solo entra en la sección
    // bajando el umbral por debajo de su porcentaje (CA-HU-05).
    await submitComparison(page, { tool: 'stryker', uncoveredThreshold: '75' });

    await expect(page.getByText('Herramienta: stryker')).toBeVisible();
    const uncovered = page.getByRole('region', { name: 'Sin cobertura' });
    await expect(uncovered.getByText('src/billing/refundService.js')).toBeVisible();
    await expect(uncovered.getByText('src/notifications/emailSender.js')).toBeVisible();
  });

  test('descarga un informe HTML autocontenido', async ({ page }) => {
    await submitComparison(page, { tool: 'pitest' });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Exportar HTML' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^mutadiff-report-[0-9a-f-]+\.html$/);

    const downloadPath = await download.path();
    const html = await readFile(downloadPath, 'utf-8');
    expect(html).toContain('com.acme.billing.TaxCalculator');
    // Constitución #6: un solo fichero abrible offline, sin dependencias externas.
    expect(html).not.toMatch(/<link\s|<script|src="https?:|href="https?:/i);
  });

  test('muestra un error legible cuando el fichero no es un reporte válido', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Ejecución base').setInputFiles({
      name: 'roto.xml',
      mimeType: 'application/xml',
      buffer: Buffer.from('<mutations><mutation'),
    });
    await page.getByLabel('Ejecución nueva').setInputFiles(fixture('pitest', 'head'));

    await page.getByRole('button', { name: 'Comparar' }).click();

    // Sin stack traces: el usuario ve el mensaje del parser, no un 500 genérico.
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Invalid PiTest report');
    await expect(alert).not.toContainText('node_modules');
    await expect(page).toHaveURL('/');
  });
});
