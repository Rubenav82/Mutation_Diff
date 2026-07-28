# MutaDiff

Compara dos ejecuciones de mutation testing —[PiTest](https://pitest.org/) o [Stryker](https://stryker-mutator.io/)— y te dice qué ha empeorado: retrocesos de score por clase, clases nuevas sin tests y cobertura perdida. Exporta el resultado como un informe HTML autocontenido para adjuntarlo a una PR o archivarlo.

Mirar dos `mutations.xml` en paralelo para averiguar qué clase ha bajado de score es tedioso y se hace mal. Esto lo automatiza.

## Requisitos

- Node.js ≥ 20
- npm ≥ 10 (workspaces)

## Quickstart

```bash
git clone https://github.com/Rubenav82/Mutation_Diff.git
cd Mutation_Diff
npm install
npm run dev
```

Abre <http://localhost:5173>. El backend queda en el 3000 y el dev server de Vite le proxya `/api`.

Si quieres probarlo sin generar tus propios reportes, usa las fixtures del repo:

| Herramienta | Ejecución base                                            | Ejecución nueva                                           |
| ----------- | --------------------------------------------------------- | --------------------------------------------------------- |
| PiTest      | `packages/core/test/fixtures/pitest/realistic/base.xml`    | `packages/core/test/fixtures/pitest/realistic/head.xml`    |
| Stryker     | `packages/core/test/fixtures/stryker/realistic/base.json`  | `packages/core/test/fixtures/stryker/realistic/head.json`  |

Ese par está construido para que salga de todo: una clase que mejora, una que empeora, una nueva, una eliminada y una sin cobertura ninguna.

## Cómo obtener tus reportes

**PiTest** — activa el reporte XML en el plugin (puedes mantener también el HTML):

```xml
<outputFormats>
  <outputFormat>XML</outputFormat>
</outputFormats>
```

El fichero a subir es `target/pit-reports/**/mutations.xml`.

**Stryker** — activa el reporter JSON en `stryker.config.json`:

```json
{
  "reporters": ["json", "html", "clear-text"]
}
```

El fichero a subir es `reports/mutation/mutation.json`.

La misma información está dentro de la app, detrás del icono ⓘ junto al selector de herramienta.

## Uso

1. Elige herramienta (PiTest o Stryker) y arrastra los dos reportes: la ejecución **base** y la **nueva**.
2. Opcionalmente ajusta los umbrales:
   - **Umbral de retroceso (%)**: cuánto puede bajar el score de una clase antes de contarla como retroceso. Por defecto `0` — cualquier bajada cuenta. En la API el campo se sigue llamando `regressionThreshold`.
   - **Umbral sin cobertura (%)**: qué porcentaje de mutantes en `NO_COVERAGE` marca una clase como «sin cobertura». Por defecto `100` — solo las que no tienen ni un mutante cubierto. Bájalo a `75` para incluir también las casi descubiertas.
3. El dashboard muestra las métricas globales con su delta, las secciones de retrocesos / sin cobertura / nuevas / eliminadas, y la tabla completa con filtro y orden por columna.
4. **Exportar HTML** descarga el informe completo como un único fichero, sin CSS ni JS externos: se abre offline y se puede adjuntar donde sea.

## API REST

La SPA no hace nada que no puedas hacer con `curl`. Los tres endpoints:

```bash
# Crear una comparación. Devuelve { comparisonId, result }
curl -s -X POST http://localhost:3000/api/comparisons \
  -F tool=pitest \
  -F baseFile=@packages/core/test/fixtures/pitest/realistic/base.xml \
  -F headFile=@packages/core/test/fixtures/pitest/realistic/head.xml \
  -F uncoveredThreshold=75

# Recuperar un resultado ya calculado
curl -s http://localhost:3000/api/comparisons/<comparisonId>

# Descargar el informe HTML autocontenido
curl -s -OJ http://localhost:3000/api/comparisons/<comparisonId>/report
```

`tool` es un único campo compartido por ambos ficheros: no se pueden mezclar un XML de PiTest y un JSON de Stryker en la misma comparación.

Los errores tienen siempre la misma forma, sin stack traces:

```json
{ "error": { "code": "INVALID_REPORT", "message": "Invalid PiTest report: ..." } }
```

| Código                 | Status | Cuándo                                                |
| ---------------------- | ------ | ----------------------------------------------------- |
| `VALIDATION_ERROR`     | 422    | Falta un campo del formulario o `tool` no es válido    |
| `INVALID_REPORT`       | 422    | El fichero no es un reporte válido de esa herramienta  |
| `COMPARISON_NOT_FOUND` | 404    | El id no existe o su TTL ya expiró                     |
| `FILE_TOO_LARGE`       | 413    | El fichero supera los 50 MB                            |
| `INVALID_UPLOAD`       | 400    | Fichero adjunto bajo un nombre de campo inesperado     |

## Comandos

```bash
npm run dev        # server (3000) + web (5173)
npm test           # suite completa (Vitest)
npm run test:e2e   # e2e con Playwright — requiere `npx playwright install chromium`
npm run typecheck  # tsc --noEmit en todos los workspaces + e2e
npm run lint       # ESLint + Prettier
npm run mutation   # Stryker sobre packages/core
npm run build      # tsc -b
```

## Arquitectura

Monorepo npm workspaces, TypeScript strict, ESM. La regla de dependencias es `web → server → core`:

| Paquete           | Qué hay dentro                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `packages/core`   | Dominio puro, sin I/O. Parsers PiTest/Stryker → modelo normalizado, motor de comparación y generador del informe HTML.   |
| `packages/server` | Express 5: upload con multer, validación con Zod, endpoints REST, errores homogéneos.                                    |
| `packages/web`    | Vite + React 18: wizard, dashboard, tablas con TanStack Table.                                                           |

`core` no importa nada de los otros dos, así que el motor de comparación se puede reutilizar tal cual desde un CLI.

PiTest trabaja por clase y Stryker por fichero; el modelo usa una `key` genérica para ambos.

## Privacidad

Los reportes que subes **no salen de tu servidor**: no hay llamadas a terceros con su contenido. Los ficheros se procesan en memoria y nunca se escriben a disco — solo se guarda en memoria el resultado ya normalizado de la comparación, con un TTL de 1 hora, para poder recargar el dashboard o descargar el informe.

## Estado y limitaciones

Funcional para el flujo completo de comparación puntual (fases 0 a 4). Sabidas y pendientes:

- **Un fichero por lado.** Subir la carpeta `pit-reports` completa o un ZIP y fusionar varios `mutations.xml` (HU-12) todavía no está implementado; hace falta trabajo en `server` y `core`, no solo en la UI.
- **Sin persistencia.** No hay histórico: el store es en memoria con TTL de 1 hora y se pierde al reiniciar. La persistencia SQLite opt-in, la atribución de autor vía `git log` y el modo CLI son la fase 5.

## Calidad

El proyecto se somete a su propio tipo de análisis: mutation testing con Stryker sobre `packages/core`, con el umbral en 70 y el score actual en **99,41 %**. La suite tiene 185 tests unitarios/integración y 5 e2e sobre el flujo real en navegador. CI ejecuta lint, typecheck, tests y e2e en cada PR; Stryker va en un workflow nocturno aparte.

## Documentación

- [`docs/constitution.md`](docs/constitution.md) — principios innegociables.
- [`docs/spec.md`](docs/spec.md) — historias de usuario y criterios de aceptación.
- [`docs/plan.md`](docs/plan.md) — arquitectura, modelo de dominio, API y UI.
- [`docs/tasks.md`](docs/tasks.md) — backlog y estado.

## Licencia

MIT — ver [LICENSE](LICENSE).
