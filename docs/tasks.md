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
- [ ] T-034 Secciones regresiones / sin cobertura / nuevas.
- [ ] T-035 Botón exportar HTML.
- [ ] T-036 Estados de carga y error accesibles.

### Fase 4 — Calidad
- [ ] T-040 Stryker sobre `packages/core`, umbral 70 en CI.
- [ ] T-041 e2e Playwright del flujo completo con fixtures.
- [ ] T-042 README con quickstart y ejemplos.

### Fase 5 (v2)
- [ ] T-050 Persistencia SQLite: tablas projects/runs, endpoints de proyectos, guardado opt-in desde el dashboard, histórico y gráfico de evolución.
- [ ] T-051 Atribución de autor vía git log.
- [ ] T-052 Modo CLI reutilizando `core` (para integrarlo en pipelines).
