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

### Fase 4 — Calidad
- [x] T-040 Stryker sobre `packages/core`, umbral 70 en CI.
- [x] T-041 e2e Playwright del flujo completo con fixtures.
- [x] T-042 README con quickstart y ejemplos.

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
