# MutaDiff — Tareas (tasks.md)

> Trabajar SIEMPRE en orden, una tarea por sesión/commit. Marcar la casilla al completar. No avanzar con tests en rojo.

### Fase 0 — Bootstrap
- [x] T-001 Monorepo npm workspaces + TypeScript strict + ESLint + Prettier + Vitest config compartida.
- [x] T-002 CI básico (lint, typecheck, test).

### Fase 1 — Core (TDD puro)
- [x] T-010 Fixtures: 2 pares de reportes PiTest y 2 pares Stryker (mini y realista).
- [x] T-011 `PitestParser` → NormalizedRun (tests primero).
- [x] T-012 `StrykerParser` → NormalizedRun (soportar schemaVersion 1.x y 2.x).
- [x] T-013 Cálculo de `UnitMetrics` y agregado global.
- [x] T-014 `ComparisonEngine`: clasificación improved/regressed/added/removed/unchanged, umbrales configurables, orden de regresiones.
- [x] T-015 Detección `isUncovered` con umbral.
- [x] T-016 Generador de reporte HTML autocontenido (plantilla + inline CSS/JS + datos embebidos).

### Fase 2 — Server
- [x] T-020 Express + multer + validación Zod + límites de tamaño.
- [x] T-021 `POST /api/comparisons` con detección/validación de herramienta.
- [x] T-022 `GET /api/comparisons/:id` (store en memoria con TTL).
- [x] T-023 `GET /api/comparisons/:id/report` (descarga HTML).
- [x] T-024 Manejo de errores homogéneo (middleware, sin stack traces al cliente).

### Fase 3 — Web
- [x] T-030 Scaffolding Vite + React + router + capa API tipada.
- [x] T-031 Pantalla de nueva comparación (wizard, drag&drop, validación de extensión).
- [x] T-031b Panel de ayuda ⓘ con instrucciones de configuración por herramienta (snippets copiables de `outputFormats=XML` y reporter `json`), enlazado también desde los errores de fichero inválido.
- [x] T-032 Dashboard: tarjetas globales con deltas.
- [x] T-033 Tabla de unidades (TanStack Table): filtro, orden, colores por kind.
- [x] T-034 Secciones regresiones / sin cobertura / nuevas.
- [x] T-035 Botón exportar HTML.
- [x] T-036 Estados de carga y error accesibles.
- [x] T-037 Estilado de la aplicación: layout compartido (contenedor, ancho máximo, tipografía base), estilado completo del wizard (radios, zonas de arrastre y sus estados, umbrales, botón, panel ⓘ) y pasada por el dashboard. Detectada al levantar la app después de cerrar la Fase 4: T-031/T-031b construyeron la estructura y el comportamiento del wizard, pero ninguna tarea cubrió nunca el diseño visual, y Preflight de Tailwind resetea además los estilos por defecto del navegador. Sin TDD: las clases no se testean unitariamente (los tests verifican roles y `data-*`, decisión de T-032/T-033); la verificación es visual con capturas de Playwright, más la suite en verde.

### Fase 4 — Calidad
- [x] T-040 Stryker sobre `packages/core`, umbral 70 en CI.
- [x] T-041 e2e Playwright del flujo completo con fixtures.
- [x] T-042 README con quickstart y ejemplos.

### Fase 4.5 — Rediseño visual (sistema Modernist)

> Propuesta de rediseño de la pantalla de comparación recibida como handoff externo. Las decisiones de adaptación (color semántico, tipografía, modo oscuro, alcance del rail) están fijadas en `docs/plan.md` §2.5.1 y prevalecen sobre el handoff donde chocan. T-043/T-044 son requisito de T-046: el rail muestra datos que hoy la API no devuelve.

**Backend — contexto de la comparación**

- [x] T-043 `ComparisonResult` gana `context: { baseLabel?, headLabel?, regressionThreshold, uncoveredThreshold }`, rellenado por `compareRuns` desde `base.label`/`head.label` (campo que ya existe en `NormalizedRun` y hoy nadie usa) y desde las opciones ya recibidas, con los **defaults ya resueltos** — no los opcionales de entrada, para que el rail pueda mostrar el umbral efectivo sin volver a conocer los defaults. Motivo: sin esto, al recargar `/comparisons/:id` o abrir un enlace compartido no hay forma de saber qué ficheros ni qué umbrales produjeron el resultado.
- [x] T-044 `POST /api/comparisons` pasa `label: file.originalname` a ambos parsers. Test con Supertest que verifica que `GET /api/comparisons/:id` devuelve nombres y umbrales **después** de guardarse en el store (es el caso que importa: la recarga, no la respuesta del POST).

**Sistema visual**

- [x] T-045 Tokens Modernist en `packages/web/src/index.css`: paleta (fondo `#f3f2f2`, tinta `#201e1d`, rampa de neutros y de acento), `--color-gain: #14622f` / `--color-loss: #ae1800`, radio 0, reglas de 2px, escala de espaciados. Retira el bloque `prefers-color-scheme` (sin modo oscuro) y mantiene los stacks de sistema (sin webfont). Incluye la pasada por el wizard, que el handoff no cubría pero que comparte los mismos tokens: cambiarlos sin repasarlo lo dejaría a medio estilar.

**Pantalla de comparación**

- [x] T-046 Layout de dos paneles en `ComparisonDashboardPage`: rail lateral fijo (herramienta, ficheros base/nueva y umbrales aplicados — todo en solo lectura, de `context`) + panel principal. El botón del rail es "Nueva comparación" y navega a `/`, no recalcula (ver `docs/plan.md` §2.5.1). **Sin logotipo en el rail**, a diferencia del handoff: `AppHeader` ya lo pinta en todas las rutas y repetirlo daría dos marcas en la misma vista. "Fijo" se implementó como `sticky` dentro del contenedor de `App`, no anclado al viewport: mantiene el contexto a la vista al recorrer tablas largas sin sacar el dashboard del `max-w-6xl` compartido.
- [x] T-047 Banda de resumen sobre neutro oscuro: kicker "Comparación · {herramienta}", mutation score y cobertura como cifras grandes con su `base → nueva (delta)`, contador de regresiones, y el botón "Exportar HTML" alineado a la derecha. Sustituye la mitad de `GlobalSummaryCards`. Obligó a añadir `--gain-inverse`/`--loss-inverse`: sobre la banda oscura, `--gain`/`--loss` dan 1.89:1 y 1.96:1 (ilegibles), así que el par semántico necesita una versión clara, emparejada entre sí igual que la del tema claro. **La herramienta sale del rail de T-046** y vive solo en el kicker: con ambos visibles a la vez era el mismo dato dos veces.
- [x] T-048 Fila de KPIs secundarios: Killed, Survivors, Sin cubrir y **Timeouts**. Son cuatro, no los tres del handoff: HU-03 pide explícitamente el total de timeout con su delta, y quitarlo incumpliría el criterio de aceptación. Sustituye la otra mitad de `GlobalSummaryCards`, que pasa a llamarse `KpiRow` (ya no es "el resumen global": eso es `SummaryBand`). La cifra destacada pasa a ser el **valor nuevo**, no el delta, para que coincida con el énfasis de la banda — antes la misma pantalla resaltaba dos magnitudes distintas.
- [x] T-048b Informe HTML exportado (`core/report/htmlReportGenerator`) coherente con el sistema Modernist: misma paleta, radio 0, reglas de 2px y monoespaciada para toda medida, y cabecera con los ficheros comparados y los umbrales aplicados (de `context`, T-043) — hoy el informe no dice de qué ejecución salió. **La paleta queda duplicada** entre `packages/web/src/index.css` y el generador: `core` no puede importar de `web` (regla de dependencias) y el informe no puede enlazar una hoja externa (CA-HU-07: fichero único autocontenido). Sigue sin `<script>` (decisión de T-016) y sin banda oscura: es un documento para compartir o imprimir. No estaba en el backlog; se añade tras detectar en T-048 que el export era lo único que quedaba con la paleta anterior.
- [x] T-049 Tablas al estilo Modernist en `UnitsTable` y `UnitSection`: reglas de 2px, pill de contador junto al título, tags de estado, filtro alineado a la derecha del título de "Todas las unidades". **Conserva el orden por columna** de HU-08, que la referencia de diseño no muestra pero es criterio de aceptación (verificado además en vivo: ordenar por Δ Score deja arriba la caída más severa). El pill cambia el nombre accesible de las cabeceras de `Regresiones (1)` a `Regresiones 1`; los tests que lo fijaban se actualizaron primero.

- [x] T-049b Flecha de tendencia (▲/▼) en los deltas de `SummaryBand` y `KpiRow`, y contenido de las tarjetas de KPI centrado. Petición de revisión visual tras cerrar la fase. **La flecha se deriva del signo del delta, no del `variant`**: dirección y polaridad son ejes independientes y en `Survivors`/`Sin cubrir` se contradicen (un `+2` sube y empeora a la vez, así que sale ▲ en rojo). `Timeouts` no lleva color por no tener polaridad clara, pero sí flecha: la dirección es un hecho del dato. Delta `0` no pinta flecha. Va en `aria-hidden` y en su **propio nodo**, no concatenada al delta: el signo `+`/`−` ya dice la dirección a un lector de pantalla, y meterla en el mismo nodo rompería las consultas por la cifra exacta (`getByText('+1')`). Helpers `trendOf`/`TREND_ARROW` en `lib/format.ts`, con los mismos glifos que los tags de `UnitsTable`. **El informe HTML exportado queda fuera por decisión explícita del usuario.** Sin repasar Stryker: el cambio es de `packages/web`, fuera del `mutate` acotado a `packages/core/src`.
- [x] T-049c Wizard centrado (`mx-auto` + `text-center` en `NewComparisonPage`). **Revierte una decisión explícita de T-037/T-045**, que lo alineaba a la izquierda para cuadrarlo con la marca de la cabecera; a pantalla ancha eso dejaba el formulario pegado a un lado con la mitad derecha vacía. El comentario que justificaba lo contrario se actualizó en el mismo cambio. Dos excepciones al centrado heredado, ambas comprobadas con captura: `ToolHelpPanel` fija `text-left` propio (son instrucciones y un snippet de código, ilegibles centrados) y los contenedores flex (control segmentado, fila del submit, `<p>` de error de `FileDropZone`) necesitan `justify-center` explícito, porque `text-center` no alinea cajas flex. El contenido de los inputs de umbral se deja a la izquierda, que es lo convencional al teclear.
- [x] T-049d «Regresión» → «retroceso» en toda la interfaz en español y en el informe exportado. Motivo: en español el término se confunde con las *pruebas de regresión*, que son otra cosa. Se eligió «retroceso» entre las candidatas porque es la única que entra limpia en los cuatro huecos gramaticales (sección `Retrocesos`, contador `Sin retrocesos`/`1 retroceso`/`N retrocesos`, tag `Retroceso ▼` y `Umbral de retroceso (%)`) y hace pareja simétrica con `Mejora ▲`; «empeoramiento» servía como tag pero daba «Umbral de empeoramiento (%)». **Los identificadores siguen en inglés** (`regressed`/`regressions`/`regressionThreshold`): es el término estándar del dominio, no arrastra la ambigüedad y `regressionThreshold` es campo público de la API — renombrarlo sería un cambio de contrato. El README lo dice explícitamente para que nadie busque un campo `retrocesoThreshold`.

**Cierre de fase**: Stryker sobre `core` a **99.44 %** (352 killed, 2 survived). La primera pasada dio 98.59 % con **tres supervivientes nuevos**, todos en código de esta fase y todos por tests débiles reales, no equivalentes: el guard `head.label !== undefined` de `compareRuns` (el test de omisión solo comprobaba `baseLabel`) y los dos `?? 'Sin nombre'` del informe (una única aserción `toContain` que el otro lado ya satisfacía). Corregidos partiendo cada test en uno por lado; `comparisonEngine.ts` y `htmlReportGenerator.ts` quedan al 100 %. Los 2 supervivientes restantes son los equivalentes ya documentados de `pitestParser.ts`.

### Fase 4.6 — Distribución estática (v1 interna)

> La aplicación se va a consumir dentro de una empresa, por muchos equipos, y la Fase 5 queda aplazada a una v2: con comparar y exportar el informe es suficiente. Hoy eso exigiría una máquina con Node que alguien opere, y el store en memoria obliga además a **instancia única** (con réplicas el `GET /:id` cae en la equivocada) y pierde el trabajo de todos en cada reinicio. Moviendo al navegador la lógica que hoy corre en el servidor, el artefacto pasa a ser un `index.html` + `assets/` que encaja en el patrón de despliegue ya probado por el usuario (release con zip del `dist` que una máquina interna sirve como ficheros estáticos). Verificado antes de planificar: `packages/core` no tiene ninguna importación de `node:` en código de producción y bundlea en **71,5 kB (24,4 kB gzip)** sin polyfills. `packages/server` **no se toca**: es lo que necesitará la Fase 5, y el README documenta cómo autoalojarlo para quien quiera la API REST.
>
> Numeración: cada fase ocupa una decena y no queda ninguna libre por debajo de la Fase 5 (T-043/T-044 los gastó la Fase 4.5), de ahí el salto a T-07x pese a ir antes en el orden de ejecución.

- [x] T-070 Comparación en el navegador: `src/lib/comparisonStore.ts` (`Map` de módulo como fuente primaria + `sessionStorage` best-effort en `try/catch`, para que F5 no pierda el resultado sin morir por cuota con reportes grandes), `src/lib/id.ts` (`crypto.randomUUID` no existe fuera de contexto seguro — fallback a v4 con `getRandomValues`, que sí) y `src/api/client.ts` → `src/lib/comparisons.ts`, que pasa de hablar HTTP a llamar a `core` directamente. `ApiClientError` → `ComparisonError`: un módulo `api/client` que no hace ninguna petición sería un nombre que miente. `createdAt` y `label: file.name` los pone ahora el navegador (los ponía el servidor); errores de parser → `422 INVALID_REPORT`, replicando el mapeo del servidor para que el mensaje visible no cambie. Las fixtures del test se cargan con `?raw` de Vite y no con `node:fs`: bajo jsdom `import.meta.url` llega como URL `/@fs/` y `fileURLToPath` la convierte en una ruta inexistente (`C:\@fs\C:\…`). Verificado en navegador con el backend apagado: **cero peticiones a `/api/`** durante la comparación, y F5 sobre el dashboard lo rehidrata desde `sessionStorage`.
- [ ] T-071 Exportar el informe sin servidor con `generateHtmlReport` + `Blob`. El `<a href download>` pasa a `<button>` y `SummaryBand` cambia `reportUrl` por `onExport`: ya no hay recurso al que enlazar, y generar un fichero es una acción, no una navegación. Generación en el handler, no en un efecto (perezosa y sin ciclo de vida de blob URL en el render). **Revierte la decisión de T-035**: el nombre del fichero deja de tener su fuente de verdad en el `Content-Disposition` del servidor.
- [ ] T-072 Servible desde cualquier ruta: `HashRouter` (el zip es `index.html` + `assets/` pelados y no podemos asumir ninguna regla de reescritura en la máquina interna) y `base: './'` (hoy `index.html` referencia `/src/main.tsx` en absoluto, lo que ata el build a la raíz del dominio). Incluye el fallback de portapapeles de `ToolHelpPanel`: `navigator.clipboard` es *secure-context only*, así que servido por HTTP plano el botón «Copiar» revienta hoy con un `TypeError` — bug latente que este despliegue destaparía, no que introduzca.
- [ ] T-073 `release.yml` disparado por tag: build, zip de `packages/web/dist` y asset en la release, replicando el patrón del otro proyecto del usuario. README con el despliegue interno, la promesa de privacidad reforzada (los reportes ya no salen del navegador) y cómo autoalojar el servidor.

### Fase 5 (v2) — Histórico y persistencia

> T-050 a T-058 son el desglose de lo que antes era una única tarea "Persistencia SQLite". Mismo grano que las fases 2 y 3: un endpoint o una pantalla por tarea, un commit por tarea. Cubren HU-10 y HU-11.

**Backend**

- [ ] T-050 Bootstrap de persistencia: dependencia `better-sqlite3`, módulo `db.ts` que abre el fichero y crea el esquema de `docs/plan.md` §2.3.2 (tablas `projects`/`runs`). Ruta configurable por env, `:memory:` en tests, `PRAGMA foreign_keys = ON` (sin él, el `ON DELETE CASCADE` del esquema no hace nada). Sin endpoints todavía.
- [ ] T-051 Repositorio de proyectos + `POST /api/projects` y `GET /api/projects`. Nombre duplicado → 409 homogéneo (`name` es `UNIQUE` en el esquema).
- [ ] T-052 `POST /api/projects/:id/runs`: guardado **opt-in** de un `NormalizedRun` con `label` y `executed_at`. Un run cuya herramienta no coincide con la del proyecto → 422 (el `tool` se fija a nivel de proyecto).
- [ ] T-053 `GET /api/projects/:id/runs`: histórico ordenado por `executed_at`, devolviendo solo `global_metrics` sin deserializar `normalized_run` (para eso está desnormalizado).
- [ ] T-054 `POST /api/projects/:id/compare`: compara dos runs guardados reutilizando `compareRuns` de `core`; 404 si algún run no existe o no pertenece al proyecto.

**Web**

- [ ] T-055 Guardado opt-in desde el dashboard (CA-HU-10): elegir proyecto existente o crearlo en el momento y marcar cuál de las dos ejecuciones guardar, con `label` y fecha editables. Ambas marcadas por defecto si el proyecto no tiene runs, solo la nueva en caso contrario. Una comparación puntual sigue sin persistir nada si el usuario no lo pide.
- [ ] T-056 Pantalla de histórico: lista de runs guardados de un proyecto, selección del par y lanzar la comparación (HU-10).
- [ ] T-057 Gráfico de evolución del score global con Recharts (HU-11).

**Calidad**

- [ ] T-058 e2e del flujo de histórico: guardar un run → aparece en el listado → comparar un par del histórico.

**Independientes de la persistencia**

- [ ] T-059 Atribución de autor vía git log.
- [ ] T-060 Modo CLI reutilizando `core` (para integrarlo en pipelines).
