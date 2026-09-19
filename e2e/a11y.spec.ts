import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fixture } from './fixtures.js';

/**
 * Accesibilidad automatizada (T-100). Desde T-036 hay roles, live regions y
 * nombres accesibles puestos a mano —y ampliados en T-076/T-077 (modales),
 * T-083 (controles por tabla) y T-088 (tooltips)—, pero nada avisaba si se
 * degradaban: los tests de RTL comprueban el nombre que consultan ellos
 * mismos, no si el árbol de accesibilidad es coherente.
 *
 * axe no sustituye a una revisión manual (detecta en torno a un tercio de los
 * problemas reales), pero sí las regresiones estructurales: un contraste que
 * se rompe al retocar la paleta, un `aria-controls` que apunta a un id que ya
 * no existe, un control que se queda sin nombre.
 */

/** WCAG 2.1 AA, que es lo que declara el proyecto: `best-practice` añade reglas opinables que no son un estándar. */
const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * El logotipo textual de la cabecera, lo único que queda fuera del análisis.
 *
 * WCAG 1.4.3 exime del mínimo de contraste al texto que forma parte de un logo
 * o de un nombre de marca, y axe no puede distinguirlo del texto normal: da
 * `color-contrast` sobre el «Assessment» en acento, que son 3,76:1 **a
 * propósito** (T-045). Se excluye por `data-brand` y no por `.text-accent`
 * porque ese es justo el caso que hay que seguir detectando: la clase de
 * acento sobre un dato real ya fue un error una vez, en `UnitsTable`.
 */
const BRAND_WORDMARK = '[data-brand]';

interface Violation {
  id: string;
  impact: string;
  help: string;
  targets: string[];
}

/**
 * Las violaciones se reducen a lo identificable antes de asertar: el objeto de
 * axe trae el HTML completo de cada nodo y un fallo imprimiría cientos de
 * líneas en las que no se encuentra cuál es la regla que saltó.
 */
async function violationsOf(page: Page): Promise<Violation[]> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_AA)
    .exclude(BRAND_WORDMARK)
    .analyze();
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact ?? 'unknown',
    help: violation.help,
    targets: violation.nodes.map((node) => node.target.join(' ')),
  }));
}

async function openComparison(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Ejecución base').setInputFiles(fixture('pitest', 'base'));
  await page.getByLabel('Ejecución nueva').setInputFiles(fixture('pitest', 'head'));
  await page.getByRole('button', { name: 'Comparar' }).click();
  await expect(page.getByRole('heading', { name: 'Comparación · pitest' })).toBeVisible();
}

test.describe('accesibilidad (axe-core, WCAG 2.1 AA)', () => {
  /**
   * Sin esto el análisis es una carrera contra `.rise`, la aparición escalonada
   * de T-037: anima `opacity` de 0 a 1, y axe mide el contraste sobre el color
   * **ya compuesto**, así que un elemento a medio aparecer se mezcla con el
   * fondo y baja del umbral. Daba violaciones distintas en cada pasada y solo
   * en las máquinas que pierden la carrera: verde en local, rojo en CI.
   *
   * Es el mismo fotograma a medias que ya obligó a `reducedMotion` en las
   * capturas (T-048b). No se pierde cobertura: `prefers-reduced-motion` solo
   * apaga la animación de entrada, y los colores del estado final —que es el
   * que gobierna WCAG 1.4.3— son idénticos.
   *
   * **Tiene que ser esta llamada explícita, no la opción `reducedMotion` de
   * `use`.** Con Playwright 1.62 la opción se resuelve (`test.info().project.use`
   * la muestra) pero no llega a la página: `matchMedia` sigue diciendo `false`
   * y la animación sigue corriendo, tanto puesta en el proyecto como en un
   * `test.use`. Medido, no supuesto.
   */
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('wizard vacío', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /nueva comparación/i })).toBeVisible();

    expect(await violationsOf(page)).toEqual([]);
  });

  test('wizard con un error de validación de fichero', async ({ page }) => {
    await page.goto('/');
    // Un JSON de Stryker en la zona de PiTest: `setInputFiles` no respeta el
    // `accept` del input, así que entra en la validación del componente igual
    // que lo haría un fichero soltado con el ratón (T-031).
    await page.getByLabel('Ejecución base').setInputFiles(fixture('stryker', 'base'));
    await expect(page.getByRole('alert')).toBeVisible();

    expect(await violationsOf(page)).toEqual([]);
  });

  test('wizard con el panel de ayuda abierto', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Ayuda de configuración' }).click();
    await expect(page.getByRole('button', { name: /^Copiar/ })).toBeVisible();

    expect(await violationsOf(page)).toEqual([]);
  });

  test('dashboard con datos', async ({ page }) => {
    await openComparison(page);

    expect(await violationsOf(page)).toEqual([]);
  });
});
