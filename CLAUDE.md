# CLAUDE.md — MutaDiff

Aplicación web para comparar dos ejecuciones de mutation testing (PiTest o Stryker) y detectar regresiones de score/cobertura y clases sin tests, con reporte HTML exportable.

## Documentación obligatoria

Antes de implementar CUALQUIER tarea, lee en este orden:

1. `docs/constitution.md` — principios innegociables del proyecto.
2. `docs/spec.md` — historias de usuario y criterios de aceptación.
3. `docs/plan.md` — arquitectura, modelo de dominio, API y UI.
4. `docs/tasks.md` — backlog ordenado; es la única fuente de verdad del estado.

Si una petición contradice la especificación, señálalo antes de codificar. Si implementas algo que cambia una decisión de diseño, actualiza el documento afectado en el mismo commit.

## Flujo de trabajo (obligatorio)

- Trabaja **una tarea de `docs/tasks.md` a la vez**, en el orden definido.
- **TDD estricto**: (1) escribe el test y verifica que falla, (2) implementación mínima para pasarlo, (3) refactoriza con tests en verde. Nunca escribas código de producción sin un test rojo previo.
- Al terminar una tarea: ejecuta la suite completa, marca la casilla `[x]` en `docs/tasks.md` y propón un commit con mensaje `feat(T-0XX): descripción` (o `test:`, `chore:` según corresponda). Un commit por tarea.
- No avances a la siguiente tarea con tests en rojo, errores de typecheck o lint.
- No añadas dependencias fuera de las listadas en `docs/plan.md` §2.1 sin justificarlo y preguntarme antes.

## Arquitectura (resumen — detalle en docs/plan.md)

Monorepo npm workspaces, TypeScript strict, ESM, Node ≥ 20:

- `packages/core` — dominio puro, **sin I/O, sin Express, sin React**. Parsers (PiTest XML, Stryker JSON) → `NormalizedRun`, motor de comparación → `ComparisonResult`, generador de reporte HTML autocontenido. Aquí vive casi toda la lógica; máxima cobertura.
- `packages/server` — Express 5: upload (multer), validación (Zod), endpoints REST, manejo de errores homogéneo. Fase 2: SQLite (better-sqlite3).
- `packages/web` — Vite + React 18: wizard de comparación, dashboard, tablas (TanStack Table), export HTML.

Regla de dependencias: `web → server → core`. `core` no importa nada de los otros paquetes.

## Comandos

```bash
npm test                 # toda la suite (Vitest)
npm run test -w core     # tests de un workspace
npm run typecheck        # tsc --noEmit en todos los workspaces
npm run lint             # ESLint + Prettier check
npm run dev              # server + web en modo desarrollo
npm run mutation         # Stryker sobre packages/core (ejecutar antes de cerrar cada fase)
```

(Si algún script aún no existe, créalo en la tarea de bootstrap correspondiente.)

## Estructura del monorepo (fijada en T-001)

- Los paquetes se nombran **sin scope** (`core`, y luego `server`, `web`) para que funcionen los comandos documentados tipo `npm run test -w core`.
- Cada paquete extiende la configuración raíz, no la duplica:
  - `tsconfig.json` → `extends: ../../tsconfig.base.json` con `composite: true`, `rootDir: src`, `outDir: dist`.
  - `vitest.config.ts` → importa `sharedTest` de `../../vitest.shared.js` y solo añade su `name`.
- El `vitest.config.ts` raíz agrega los paquetes vía `test.projects: ['packages/*']` y centraliza la config de `coverage`.
- Al añadir un paquete nuevo, registra su `reference` en el `tsconfig.json` raíz.
- Toolchain: ESLint 10 (flat config en `eslint.config.js`), Prettier 3 (ignora `docs/`, `*.md` y `.claude/`), TypeScript strict con extras (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Vitest 4.
- `tsconfig.base.json` fija `"types": ["node"]` explícitamente: sin esto, `tsc` no resuelve `node:*` ni `import.meta.url` de forma fiable en los workspaces anidados.
- `.gitattributes` fuerza `eol=lf` en todo el repo: Windows con `core.autocrlf=true` reescribe a CRLF en cada checkout y rompe `prettier --check` en todos los ficheros de texto. Si vuelve a aparecer ese patrón de fallo masivo de lint, revisa esto antes que el contenido de los ficheros.

## Fixtures de `packages/core/test/fixtures/` (fijadas en T-010)

Cada herramienta tiene un par `mini/` (pequeño, verificable a mano) y `realistic/` (varias clases/ficheros, más variedad de estados). Dentro de cada par, `base.*`/`head.*` están diseñados para ejercitar, ya en T-014/T-015, los cinco tipos de `UnitChangeKind` más el umbral de cobertura:

- **unchanged**: `com.example.MathHelper` (PiTest) / `src/mathHelper.js` y `src/billing/util/currencyFormatter.js` (Stryker).
- **improved**: `com.example.Calculator` / `com.acme.billing.InvoiceService` y `PaymentGateway` (PiTest); `src/calculator.js` / `invoiceService.js` y `paymentGateway.js` (Stryker).
- **regressed**: `com.example.StringUtils` / `com.acme.billing.TaxCalculator` (PiTest); `stringUtils.js` / `taxCalculator.js` (Stryker).
- **added**: `com.example.NewFeature` / `com.acme.billing.RefundService` (PiTest); `newFeature.js` / `refundService.js` (Stryker) — `RefundService`/`refundService.js` queda además al 75% de `NO_COVERAGE`, útil como caso límite del umbral configurable de "sin cobertura" (CA-HU-05).
- **removed**: `com.example.Legacy` / `com.acme.notifications.LegacyNotifier` (PiTest); `legacy.js` / `legacyNotifier.js` (Stryker).
- **uncovered ya en base**: `com.acme.notifications.EmailSender` (PiTest) / `emailSender.js` (Stryker), 100% `NO_COVERAGE` en ambas ejecuciones.

Las fixtures Stryker realistas usan `schemaVersion: "2.0"` con bloque `testFiles`; las mini usan `"1.6"` sin él. Los campos que importan al dominio (`status`, `mutatorName`, `location.start.line`) son estables entre 1.x/2.x; si T-012 encuentra diferencias reales de schema no cubiertas aquí, ampliar las fixtures en esa misma tarea en vez de asumir.

## Modelo de dominio y parsers (fijado en T-011)

- `packages/core/src/domain/types.ts` fija los tipos de `docs/plan.md` §2.3 (`Tool`, `Mutant`, `UnitResult`, `UnitMetrics`, `NormalizedRun`); `UnitChangeKind`/`UnitComparison`/`ComparisonResult` se añaden en T-014, no antes.
- `docs/tasks.md` separa T-011/T-012 (parsers) de T-013 ("Cálculo de UnitMetrics y agregado global"), pero `UnitResult.metrics` y `NormalizedRun.metrics` son campos obligatorios del tipo: un parser no puede devolver un `NormalizedRun` válido sin ellos. Decisión: `domain/metrics.ts` (`calculateUnitMetrics`, `aggregateMetrics`) se implementó ya en T-011, con tests propios (casos borde incl. `validTotal = 0`), y la reutilizan tanto `PitestParser` como (en T-012) `StrykerParser`. T-013 no es una reimplementación; es la tarea para ampliar los casos borde de esa lógica si aparecen (p. ej. redondeo, umbrales) según lo que exija T-014/T-015.
- `PitestParser.parsePitestReport(xml, { createdAt, label? })`: `createdAt` es obligatorio y lo aporta la capa I/O (server/CLI) — `core` no llama a `Date.now()`, se mantiene puro y determinista/testeable.
- Validación de XML: `XMLValidator.validate()` de `fast-xml-parser` antes de `parse()` (el parser en sí es permisivo y no lanza con XML mal formado). Estados PiTest no reconocidos (fuera de KILLED/SURVIVED/NO_COVERAGE/TIMED_OUT/RUN_ERROR/MEMORY_ERROR/NON_VIABLE) lanzan error explícito en vez de mapearse por defecto — evita clasificar mal un estado de un futuro schema no soportado.
- `Mutant.id` es un contador secuencial asignado por el parser (PiTest no expone id de mutante); no tiene significado fuera del `NormalizedRun` en el que se generó.
- `StrykerParser.parseStrykerReport(json, { createdAt, label? })` (T-012): mismo contrato que `PitestParser`. Soporte de `schemaVersion` 1.x/2.x implementado como validación de versión mayor (`"1"`/`"2"` antes del primer punto), no como dos rutas de parseo distintas — los campos usados (`status`, `mutatorName`, `location.start.line`, `files{}`) son estables entre subversiones, confirmado al construir las fixtures realistas en `schemaVersion: "2.0"` con bloque `testFiles` (T-010) sin que afecte al parseo. Un `schemaVersion` con major fuera de `{1,2}`, ausente o no-string lanza error explícito.
- Los `key` de Stryker (rutas de fichero) se normalizan con `path.replace(/\\/g, '/')` antes de agruparse, para que un reporte generado en Windows compare igual que uno generado en CI Linux.
- Campos de Stryker no usados por el modelo de dominio (`coveredBy`, `killedBy`, `testFiles`) se ignoran deliberadamente en T-011/T-012; no forman parte de `Mutant`/`UnitResult` en `docs/plan.md` §2.3.
- **T-013** (edge case real encontrado): un `<mutations></mutations>` o `<mutations/>` vacío parsea con `fast-xml-parser` a `{ mutations: '' }` (string vacío), no a un objeto — un check `!parsed.mutations` lo trataba como "root ausente" y lanzaba error, cuando en realidad es un reporte vacío válido (caso borde listado en `docs/plan.md` §2.6). Corregido en `PitestParser` distinguiendo `'mutations' in parsed` (root realmente ausente → error) de `typeof parsed.mutations === 'string'` (root vacío → `units: []`). Stryker no tenía este bug (`files: {}` ya es un objeto válido). Si se toca la lógica de parseo de XML de nuevo, tener presente que fast-xml-parser no siempre devuelve un objeto para elementos vacíos.

## Convenciones

- Nombres de código, tipos y comentarios de API en inglés; documentación de producto (docs/) en español.
- Los tests viven junto al código: `foo.ts` → `foo.test.ts`. Fixtures reales en `packages/core/test/fixtures/` (pitest/ y stryker/).
- Ninguna respuesta de la API expone stack traces; errores con shape `{ error: { code, message } }`.
- Los datos de los reportes del usuario nunca se envían a servicios externos.
- El reporte HTML exportado debe ser un único fichero autocontenido (CSS/JS inline, datos embebidos).

## Definición de hecho (por tarea)

1. Tests nuevos escritos primero y en verde, suite completa en verde.
2. Typecheck y lint sin errores.
3. Criterios de aceptación de la HU asociada cumplidos (docs/spec.md §1.4).
4. Casilla marcada en docs/tasks.md y, si aplica, docs actualizados.
5. Sin `any` sin justificar, sin código muerto, sin console.log de depuración.
