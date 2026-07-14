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

## Mutation testing (Stryker)

- Config en `stryker.config.json` **en la raíz del repo**, no dentro de `packages/core`: el vitest runner de Stryker sandboxea el directorio desde el que se ejecuta, y `packages/core/vitest.config.ts` importa `../../vitest.shared.ts`, fuera de ese sandbox si se corre desde dentro del paquete. `npm run mutation` ejecuta `stryker run` desde la raíz por eso. `mutate` está acotado a `packages/core/src` (único paquete con código por ahora); si se generaliza a más paquetes, ampliar el patrón ahí, no crear un config por paquete.
- Umbrales en `stryker.config.json`: `low: 70` (mínimo de `docs/constitution.md` #2), `high: 85` (objetivo), `break: 70` (falla el comando por debajo de 70).
- `.stryker-tmp/` y `reports/` están en `.gitignore` y excluidos en `eslint.config.js` (son sandbox temporal y reporte HTML generado; sin excluirlos en ESLint, lintear falla sobre código instrumentado del sandbox tras cada ejecución).

**Lección de la primera pasada (score iba de 56% a 99.4% con un solo cambio estructural)**: los tests de `packages/core` computaban sus fixtures con `const base = parseXxx(...)` **a nivel superior de un `describe()`**, no dentro de un `it()` ni de un `beforeAll()`. Si esa llamada lanza (p. ej. por un mutante que rompe el parser), Vitest no registra ningún test como fallido — el fichero entero queda en "0 tests" y Stryker lo interpreta como "el mutante no rompió nada", así que el mutante sobrevive aunque el código esté realmente roto. Regla para todo test nuevo en este proyecto: si el fixture depende de una función que puede lanzar, constrúyelo dentro de un `beforeAll()` (con `let x: T` declarado fuera), nunca en un `const` a nivel de `describe()`. Ya corregido en `pitestParser.test.ts`, `strykerParser.test.ts`, `comparisonEngine.test.ts` y `htmlReportGenerator.test.ts`.

**Otras lecciones de esa misma pasada**:
- Los mensajes de error (`fail('...')` en los parsers) hay que testearlos con el string exacto (`toThrow('mensaje completo')`), no con una regex genérica tipo `/invalid|malformed|pitest/i` — esa regex sigue haciendo match aunque el mutante vacíe el contenido del mensaje, porque el prefijo constante ("Invalid PiTest report: ") ya la satisface.
- Cualquier rama alcanzable solo a través de un valor opcional (`options.label`, un campo ausente en el JSON/XML de entrada) necesita su propio test explícito; si nunca se ejercita, Stryker lo marca `NoCoverage` y cuenta como no cubierto igual que un survived.
- Mutation testing también encontró dos casos de código muerto real (no solo tests débiles), eliminados en vez de "testeados a la fuerza": el guard `!baseUnit && !headUnit` en `comparisonEngine.ts` (inalcanzable — `compareRuns` solo llama `classify` con claves que existen en al menos uno de los dos mapas) y el guard `metrics.total === 0` en `isUncovered` (redundante — `0/0*100 >= threshold` ya es `NaN >= threshold`, siempre `false`). Cuando un mutante sobrevive, comprobar primero si el código es genuinely inalcanzable/redundante antes de forzar un test artificial.
- Un puñado de mutantes en la rama `typeof parsed.mutations === 'string' ? [] : ...` de `pitestParser.ts` son equivalentes de verdad (el `ternary` existe solo para que TypeScript estreche el tipo unión antes de acceder a `.mutation`; en runtime ambas ramas devuelven `[]` para los mismos valores). No merece la pena perseguirlos.

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

## ComparisonEngine (fijado en T-014, incluye T-015)

- `packages/core/src/compare/comparisonEngine.ts`: `compareRuns(base, head, { regressionThreshold?, uncoveredThreshold? })`. Mismo patrón que T-011/T-013: el tipo `UnitComparison` obliga a rellenar `isUncovered` para cada unidad, así que T-015 ("Detección `isUncovered` con umbral") se implementó ya dentro de T-014 en vez de dejarlo pendiente — no hay una segunda pasada que hacer, ambas casillas de `docs/tasks.md` se marcaron juntas.
- Clasificación (CA-HU-05, literal): `scoreDelta = head.score - base.score`; `scoreDelta > 0` → `improved`; `scoreDelta < -regressionThreshold` → `regressed`; en cualquier otro caso (incluye caídas pequeñas dentro del umbral) → `unchanged`. `regressionThreshold` por defecto `0`.
- `isUncovered` (CA-HU-05, segunda cláusula): `(noCoverage / total) * 100 >= uncoveredThreshold` sobre las métricas de **head** (no `validTotal`: la fórmula del spec usa `total`). Umbral por defecto `100`; las unidades `removed` siempre son `isUncovered: false` (no hay `head` que evaluar). `total === 0` también da `false` (evita `NaN`).
- `base`/`head` en `UnitComparison` son `UnitMetrics` opcionales rellenados solo para el lado que exista (unidades `added` no tienen `base`, `removed` no tienen `head`); `scoreDelta`/`coverageDelta` son `null` en ambos casos, no `0` — evita interpretar "sin datos" como "sin cambio".
- `regressions` se ordena por `scoreDelta` ascendente (la caída más severa primero); `units` se ordena por `key` para salida determinista, aunque el modelo no lo exige explícitamente.
- Comparar dos `NormalizedRun` con `tool` distinto (CA-HU-03) lanza error explícito en el propio motor, no solo en la capa HTTP futura (T-021 solo tendrá que mapearlo a 422).

## Generador de reporte HTML (fijado en T-016 — cierra Fase 1)

- `packages/core/src/report/htmlReportGenerator.ts`: `generateHtmlReport(result: ComparisonResult): string`, puro y sin I/O — escribir a disco es responsabilidad de `server`/CLI en fases posteriores.
- CA-HU-07 exige exactamente 4 bloques (resumen, tabla completa, regresiones, sin cobertura); no se añadieron secciones de "nuevas"/"eliminadas" aparte porque el `kind` de cada fila ya lo indica en la tabla completa — evita duplicar contenido no pedido por el criterio de aceptación.
- Sin `<script>`: la interactividad (filtrar/ordenar) es de la SPA (T-033/034), no del export estático; el informe es HTML+CSS inline puro. Si en el futuro se pide interactividad offline en el propio export, añadirla ahí, no reabrir esta decisión sin motivo.
- Seguridad: todo texto proveniente del reporte del usuario (`unit.key`, `tool`) pasa por `escapeHtml()` antes de interpolarse — un `mutatedClass`/ruta de fichero maliciosa (p. ej. `<img src=x onerror=...>`) no puede inyectar HTML/JS en el informe exportado. Cubierto por test dedicado.
- Test de presupuesto de tamaño (CA-HU-07, "< 2 MB para hasta 5.000 clases") implementado literalmente: genera 5000 `UnitComparison` sintéticas y verifica `Buffer.byteLength(html, 'utf-8') < 2 MB`. Si se añade markup por fila en el futuro, este test es la señal de alarma real, no una estimación a ojo.

## `packages/server` (bootstrap fijado en T-020 — arranca Fase 2)

- Mismo patrón de paquete que `core`: nombre sin scope (`server`), `tsconfig.json` extiende `../../tsconfig.base.json`, `vitest.config.ts` importa `sharedTest`, registrado en el `tsconfig.json` raíz.
- `app.ts` exporta `createApp(): Express` — **sin llamar a `.listen()`**; eso es responsabilidad de un `server.ts`/script `dev` que aún no existe (ver nota más abajo). Esto es lo que permite testear con Supertest sin abrir un puerto real.
- `errors.ts` es la pieza central de manejo homogéneo de errores (adelanta gran parte de T-024, no la totalidad — ver nota):
  - `ApiError extends Error` con `status`/`code`/`message` explícitos.
  - `errorHandler` (Express `ErrorRequestHandler`, 4 argumentos): `ApiError` → su propio status/código; `MulterError` con `code === 'LIMIT_FILE_SIZE'` → 413 `FILE_TOO_LARGE`; cualquier otro error → 500 `INTERNAL_ERROR` con mensaje genérico, **nunca** el mensaje ni el stack del error original (constitución: "ninguna respuesta de la API expone stack traces").
  - `createApp()` monta un 404 homogéneo (`ApiError(404, 'NOT_FOUND', ...)`) para rutas no reconocidas, en vez de dejar la página HTML por defecto de Express — no hace falta esperar a tener rutas reales para que `createApp()` sea testeable.
  - **Nota sobre T-024**: el *mecanismo* de errores homogéneos ya está construido y probado aquí (ApiError, errorHandler, sin stack traces). T-024 en `docs/tasks.md` queda pendiente no porque falte código, sino porque no se puede verificar contra los errores reales que introducirán T-021 (herramientas mezcladas, ficheros inválidos), T-022 (id no encontrado) y T-023 hasta que esas rutas existan. Cuando lleguen, deberían limitarse a lanzar `new ApiError(status, code, message)` — si T-024 acaba necesitando algo más que eso, es la señal de que este diseño no fue suficiente.
- `upload.ts`: `createUpload(maxFileSizeBytes)` (fábrica testeable con límites pequeños) + `upload = createUpload(MAX_UPLOAD_SIZE_BYTES)` con `MAX_UPLOAD_SIZE_BYTES = 50 MB` (`docs/plan.md` §2.7). `multer.memoryStorage()` — nunca se escribe el fichero subido a disco, coherente con "los datos del usuario nunca salen del servidor" y con que solo se persiste el `NormalizedRun`, no el fichero original.
- `validation.ts`: `validateBody(schema: ZodType)` — middleware genérico reutilizable para cualquier endpoint futuro, no atado a un schema concreto todavía (el schema del body de `POST /api/comparisons` se define en T-021). En caso de fallo, produce un único `ApiError(422, 'VALIDATION_ERROR', ...)` con los mensajes de Zod concatenados; en éxito, sustituye `req.body` por el valor ya parseado/tipado por Zod.
- **Pendiente, no decidido en T-020**: el script `npm run dev` para levantar el servidor en desarrollo sigue siendo el placeholder de T-001, porque requiere elegir una herramienta para ejecutar TypeScript directamente (`tsx`, `ts-node`, `node --watch` sobre `tsc -b --watch`...) que no está en `docs/plan.md` §2.1 — hay que decidirlo explícitamente (con el usuario) antes de añadirla, no colarla de paso en una tarea que no la pedía.

## `POST /api/comparisons` (fijado en T-021)

- `packages/server/src/routes/comparisons.ts`: `createComparisonsRouter()`, montado en `createApp()` **antes** del 404 catch-all. Middleware chain: `upload.fields([baseFile, headFile])` → `validateBody(comparisonRequestSchema)` → handler.
- `tool` es un único campo compartido por ambos ficheros (así lo define `docs/plan.md` §2.4: `multipart: baseFile, headFile, tool, opciones`), no un campo por fichero. Consecuencia de diseño: `NormalizedRun.tool` de `base`/`head` **siempre** coincide (los parsea el mismo parser), así que el guard `base.tool !== head.tool` de `compareRuns` es inalcanzable desde este endpoint — es una red de seguridad para un futuro consumidor de `core` que no pase por aquí (p. ej. el CLI de T-052), no código muerto que limpiar.
- CA-HU-03 ("herramientas mezcladas → 422") se cumple así: si el contenido de un fichero no encaja con el `tool` declarado (p. ej. subir un JSON de Stryker declarando `tool=pitest`), el parser correspondiente falla al validarlo como XML/JSON de esa herramienta y el error se traduce a `422 INVALID_REPORT` con el mensaje del parser. No hay una comprobación "¿mezclaste herramientas?" aparte — sería redundante dado el diseño de un único campo `tool`.
- `comparisonId` se genera con `crypto.randomUUID()` (Node, sin dependencia nueva) solo para cumplir el shape de respuesta `{ comparisonId, result }` de `docs/plan.md` §2.4. **No se persiste nada todavía** — `GET /api/comparisons/:id` no puede resolver ese id hasta T-022 ("store en memoria con TTL"). Mismo patrón que T-011/T-014: el tipo de la respuesta obliga a generar el id ya, pero el almacenamiento real es de la siguiente tarea.
- `regressionThreshold`/`uncoveredThreshold` son campos de texto opcionales del multipart (`z.coerce.number().optional()`, porque multer entrega todos los campos no-fichero como string) que se reenvían tal cual a `compareRuns` — construidos con el mismo patrón de spread condicional (`...(x !== undefined ? {x} : {})`) que ya usan los parsers de `core`, por `exactOptionalPropertyTypes`.
- **Hallazgo de infraestructura real al conectar `server` con `core`**: `packages/core/dist/` está en `.gitignore` (correcto, es build output), pero nada reconstruía `core` antes de que `server` lo importara — `npm run test -w server` funcionaba solo por accidente (dist ya estaba compilado de una build manual anterior) y **no habría funcionado en un clon nuevo ni en CI**. Además, `vitest run` no hace type-checking real, así que un error de tipos entre paquetes (`exactOptionalPropertyTypes` en las opciones de `compareRuns`) pasaba desapercibido hasta que `tsc -b` lo detectó. Arreglado en la raíz, no con un build manual puntual:
  - `packages/server/tsconfig.json` añade `"references": [{ "path": "../core" }]`.
  - `package.json` raíz añade `"build": "tsc -b"`, `"pretest": "tsc -b"` y `"pretypecheck": "tsc -b"` — npm ejecuta automáticamente los hooks `pre*` antes de `test`/`typecheck`, así que ambos comandos reconstruyen el grafo de dependencias (en orden, gracias a las project references) antes de tipar/ejecutar. CI no necesitó cambios porque ya invoca `npm run typecheck` y `npm test` por separado.
  - Regla para paquetes futuros (`web`): si un paquete importa de otro paquete del monorepo, su `tsconfig.json` **debe** añadir la `reference` correspondiente, o este mismo problema reaparece silenciosamente.

## `GET /api/comparisons/:id` (fijado en T-022)

- `packages/server/src/store.ts`: `createComparisonStore(ttlMs, now = Date.now)` — factoría con reloj inyectable (mismo patrón que `createUpload(maxBytes)` de T-020) para poder testear la expiración por TTL sin esperas reales; `DEFAULT_COMPARISON_TTL_MS = 1 hora`, elegido porque este store es para una sesión corta (subir → ver dashboard → exportar HTML), no histórico — el histórico real es la persistencia SQLite opt-in de Fase 2 (T-050), sin relación con esto.
- El store se crea **dentro** de `createComparisonsRouter()` (una instancia por llamada a `createApp()`), no como singleton de módulo — así cada test con su propio `createApp()` tiene estado aislado, y en producción solo hay una `createApp()` real de todas formas.
- `POST /api/comparisons` ahora guarda el `result` en el store bajo el mismo `comparisonId` que devuelve (antes, en T-021, el id se generaba pero no se guardaba nada — ya lo advertía la nota de T-021).
- `GET /api/comparisons/:id` devuelve el `ComparisonResult` **sin envolver** (`res.json(result)`, no `{ result }`), a diferencia del POST que sí envuelve en `{ comparisonId, result }` — es el shape literal de `docs/plan.md` §2.4, asimetría intencionada del propio spec, no una inconsistencia a corregir. Id desconocido o expirado → `404 COMPARISON_NOT_FOUND` homogéneo.
- Autocorrección durante esta tarea: implementé la ruta GET antes de escribir su test (rompiendo el TDD estricto que exige este proyecto). Al notarlo, revertí temporalmente el handler, confirmé que los tests nuevos fallaban en rojo por la razón correcta, y volví a aplicarlo — para no repetir el fallo, escribir el test *antes* de tocar `router.get(...)`/`router.post(...)`, no solo antes de las funciones auxiliares.

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
