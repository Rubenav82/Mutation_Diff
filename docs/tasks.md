# MutaDiff — Tareas (tasks.md)

> Trabajar SIEMPRE en orden, una tarea por sesión/commit. Marcar la casilla al completar. No avanzar con tests en rojo.

### Fase 0 — Bootstrap
- [x] T-001 Monorepo npm workspaces + TypeScript strict + ESLint + Prettier + Vitest config compartida.
- [x] T-002 CI básico (lint, typecheck, test).

### Fase 1 — Core (TDD puro)
- [ ] T-010 Fixtures: 2 pares de reportes PiTest y 2 pares Stryker (mini y realista).
- [ ] T-011 `PitestParser` → NormalizedRun (tests primero).
- [ ] T-012 `StrykerParser` → NormalizedRun (soportar schemaVersion 1.x y 2.x).
- [ ] T-013 Cálculo de `UnitMetrics` y agregado global.
- [ ] T-014 `ComparisonEngine`: clasificación improved/regressed/added/removed/unchanged, umbrales configurables, orden de regresiones.
- [ ] T-015 Detección `isUncovered` con umbral.
- [ ] T-016 Generador de reporte HTML autocontenido (plantilla + inline CSS/JS + datos embebidos).

### Fase 2 — Server
- [ ] T-020 Express + multer + validación Zod + límites de tamaño.
- [ ] T-021 `POST /api/comparisons` con detección/validación de herramienta.
- [ ] T-022 `GET /api/comparisons/:id` (store en memoria con TTL).
- [ ] T-023 `GET /api/comparisons/:id/report` (descarga HTML).
- [ ] T-024 Manejo de errores homogéneo (middleware, sin stack traces al cliente).

### Fase 3 — Web
- [ ] T-030 Scaffolding Vite + React + router + capa API tipada.
- [ ] T-031 Pantalla de nueva comparación (wizard, drag&drop, validación de extensión).
- [ ] T-031b Panel de ayuda ⓘ con instrucciones de configuración por herramienta (snippets copiables de `outputFormats=XML` y reporter `json`), enlazado también desde los errores de fichero inválido.
- [ ] T-032 Dashboard: tarjetas globales con deltas.
- [ ] T-033 Tabla de unidades (TanStack Table): filtro, orden, colores por kind.
- [ ] T-034 Secciones regresiones / sin cobertura / nuevas.
- [ ] T-035 Botón exportar HTML.
- [ ] T-036 Estados de carga y error accesibles.

### Fase 4 — Calidad
- [ ] T-040 Stryker sobre `packages/core`, umbral 70 en CI.
- [ ] T-041 e2e Playwright del flujo completo con fixtures.
- [ ] T-042 README con quickstart y ejemplos.

### Fase 5 (v2)
- [ ] T-045 Soporte ZIP/carpeta para PiTest: extracción, filtrado y fusión de múltiples `mutations.xml` (server + filtro en cliente con `webkitdirectory`).
- [ ] T-050 Persistencia SQLite: tablas projects/runs, endpoints de proyectos, guardado opt-in desde el dashboard, histórico y gráfico de evolución.
- [ ] T-051 Atribución de autor vía git log.
- [ ] T-052 Modo CLI reutilizando `core` (para integrarlo en pipelines).
