import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { fixture, type Tool } from './fixtures.js';

interface SubmitOptions {
  tool: Tool;
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
  // Rutas en el hash: el artefacto se sirve como ficheros estáticos y un
  // servidor de ficheros no reescribe `/comparisons/<id>` a `index.html`.
  await expect(page).toHaveURL(/#\/comparisons\/[0-9a-f-]{36}$/);
}

test.describe('flujo completo de comparación', () => {
  test('compara dos reportes de PiTest y clasifica cada clase en su sección', async ({ page }) => {
    await submitComparison(page, { tool: 'pitest' });

    // La banda de resumen (T-047) encabeza la comparación y nombra la herramienta.
    await expect(page.getByRole('heading', { name: 'Comparación · pitest' })).toBeVisible();

    // El rail de contexto (T-046) con los datos que el servidor adjunta al
    // resultado (T-043/T-044): ficheros comparados y umbrales aplicados.
    const rail = page.getByRole('complementary', { name: 'Contexto de la comparación' });
    await expect(rail.getByText('base.xml')).toBeVisible();
    await expect(rail.getByText('head.xml')).toBeVisible();
    await expect(rail.getByText('100%')).toBeVisible();

    // HU-03: métricas globales con su delta.
    // Score y cobertura encabezan desde la banda; los conteos van en las tarjetas.
    await expect(page.getByText('Mutation score')).toBeVisible();
    const metrics = page.getByRole('region', { name: 'Métricas globales' });
    await expect(metrics.getByText('Survivors')).toBeVisible();
    await expect(metrics.getByText('Timeouts')).toBeVisible();

    // HU-05: cada clase de la fixture cae en la sección que le corresponde.
    await expect(
      page.getByRole('region', { name: 'Retrocesos' }).getByText('com.acme.billing.TaxCalculator'),
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
    // Dos filas de cabecera: la de los grupos (Score / Mutantes cubiertos) y la
    // de sus columnas. De las 7 unidades de la fixture solo entran 5 en la primera
    // página, que es el tamaño por defecto.
    await expect(table.getByRole('row')).toHaveCount(7);
    await expect(table.getByText('Página 1 de 2')).toBeVisible();

    await table
      .getByRole('searchbox', { name: 'Filtrar por clase o paquete' })
      .fill('notifications');

    // Dos coincidencias: caben en una página y la navegación desaparece.
    await expect(table.getByRole('row')).toHaveCount(4);
    await expect(table.getByText(/Página \d+ de/)).toHaveCount(0);
    await expect(table.getByText('com.acme.notifications.EmailSender')).toBeVisible();
    await expect(table.getByText('com.acme.billing.TaxCalculator')).toHaveCount(0);
  });

  test('compara dos reportes de Stryker respetando el umbral sin cobertura', async ({ page }) => {
    // refundService.js está al 75% de NO_COVERAGE: solo entra en la sección
    // bajando el umbral por debajo de su porcentaje (CA-HU-05).
    await submitComparison(page, { tool: 'stryker', uncoveredThreshold: '75' });

    await expect(page.getByRole('heading', { name: 'Comparación · stryker' })).toBeVisible();
    // El umbral que se aplicó de verdad, no el que quedó en el formulario.
    const rail = page.getByRole('complementary', { name: 'Contexto de la comparación' });
    await expect(rail.getByText('75%')).toBeVisible();

    const uncovered = page.getByRole('region', { name: 'Sin cobertura' });
    await expect(uncovered.getByText('src/billing/refundService.js')).toBeVisible();
    await expect(uncovered.getByText('src/notifications/emailSender.js')).toBeVisible();
  });

  test('descarga un informe HTML autocontenido', async ({ page }) => {
    await submitComparison(page, { tool: 'pitest' });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar HTML' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^mutadiff-report-[0-9a-f-]+\.html$/);

    const downloadPath = await download.path();
    const html = await readFile(downloadPath, 'utf-8');
    expect(html).toContain('com.acme.billing.TaxCalculator');
    // Constitución #6: un solo fichero abrible offline, sin dependencias externas.
    expect(html).not.toMatch(/<link\s|<script|src="https?:|href="https?:/i);
  });

  test('reabre una comparación exportada sin volver a subir los reportes', async ({ page }) => {
    await submitComparison(page, { tool: 'stryker', uncoveredThreshold: '75' });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar JSON' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^mutadiff-comparison-[0-9a-f-]+\.mutadiff\.json$/,
    );

    // Otra pestaña equivale a partir de cero: sin nada en `sessionStorage`, lo
    // único que tiene la comparación es el fichero.
    const fresh = await page.context().newPage();
    await fresh.goto('/');
    // Con el nombre sugerido y no la ruta tal cual: Playwright guarda la descarga
    // con un nombre aleatorio sin extensión, y la zona exige `.mutadiff.json`.
    await fresh.getByLabel('Importar comparación').setInputFiles({
      name: download.suggestedFilename(),
      mimeType: 'application/json',
      buffer: await readFile(await download.path()),
    });
    await expect(fresh.getByRole('alert')).toHaveCount(0);

    await expect(fresh).toHaveURL(/#\/comparisons\/[0-9a-f-]{36}$/);
    await expect(fresh.getByRole('heading', { name: 'Comparación · stryker' })).toBeVisible();
    // Viaja con su contexto: ficheros de origen y el umbral que se aplicó.
    const rail = fresh.getByRole('complementary', { name: 'Contexto de la comparación' });
    await expect(rail.getByText('base.json')).toBeVisible();
    await expect(rail.getByText('75%')).toBeVisible();
    const uncovered = fresh.getByRole('region', { name: 'Sin cobertura' });
    await expect(uncovered.getByText('src/billing/refundService.js')).toBeVisible();
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
    // Se queda en el wizard. Se comprueba por lo que importa —que no navegó a
    // ninguna comparación— y no por la forma exacta de la URL: `HashRouter` no
    // reescribe la entrada inicial, así que `/` sigue sin `#/` hasta navegar.
    await expect(page).not.toHaveURL(/comparisons/);
  });
});
