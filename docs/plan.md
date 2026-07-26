# MutaDiff — Plan técnico (plan.md)

> El CÓMO: stack, arquitectura, modelo de dominio, API, UI y estrategia de testing. Ver spec.md para requisitos y criterios de aceptación.

### 2.1 Stack

| Capa | Tecnología |
|---|---|
| Backend | Node 20+, Express 5, TypeScript, Zod (validación), fast-xml-parser (PiTest), multer (upload) |
| Frontend | Vite + React 18 + TypeScript, TanStack Table (tablas), Recharts (gráficos), CSS modules o Tailwind |
| Persistencia (fase 2) | SQLite vía better-sqlite3 |
| Tests | Vitest (unit back y front), React Testing Library, Supertest (API), Playwright (e2e, fase 4), Stryker (mutation testing del propio proyecto) |
| Monorepo | npm workspaces: `packages/core`, `packages/server`, `packages/web` |

### 2.2 Arquitectura

```
packages/
  core/        ← dominio puro, sin I/O (lo más testeable y mutable)
    parsers/   PitestParser, StrykerParser → NormalizedRun
    domain/    modelos, cálculo de métricas
    compare/   motor de comparación → ComparisonResult
    report/    generador de HTML autocontenido (plantilla + datos inline)
  server/      ← Express: upload, orquestación, endpoints, (fase 2: SQLite)
  web/         ← React SPA: wizard de subida, dashboard, tablas, export
```

Flujo: `upload ficheros → detectar herramienta → parser → NormalizedRun (x2) → ComparisonEngine → ComparisonResult → UI / HTML export`.

Decisión clave (trade-off): el motor de comparación vive en `core` sin dependencias de Express ni React → se testea de forma aislada, se puede reutilizar como CLI en el futuro, y es el objetivo perfecto para el mutation testing del propio proyecto.

### 2.3 Modelo de dominio normalizado

```ts
type Tool = 'pitest' | 'stryker';

type MutantStatus =
  | 'killed' | 'survived' | 'no_coverage' | 'timeout'
  | 'error'      // RUN_ERROR, MEMORY_ERROR, CompileError, RuntimeError
  | 'ignored';   // Ignored (Stryker); PiTest: no aplica

interface Mutant {
  id: string;
  mutator: string;
  line: number;
  status: MutantStatus;
  description?: string;
}

interface UnitResult {           // clase (PiTest) o fichero (Stryker)
  key: string;                   // FQCN o ruta relativa normalizada
  displayName: string;
  mutants: Mutant[];
  metrics: UnitMetrics;          // derivado
}

interface UnitMetrics {
  total: number; killed: number; survived: number;
  noCoverage: number; timeout: number; error: number; ignored: number;
  validTotal: number;            // total − ignored − error
  score: number;                 // (killed + timeout) / validTotal * 100
  coveredPct: number;            // (validTotal − noCoverage) / validTotal * 100
}

interface NormalizedRun {
  tool: Tool;
  label?: string;
  createdAt: string;
  units: UnitResult[];
  metrics: UnitMetrics;          // agregado global
}

type UnitChangeKind = 'improved' | 'regressed' | 'unchanged' | 'added' | 'removed';

interface UnitComparison {
  key: string;
  kind: UnitChangeKind;
  base?: UnitMetrics;
  head?: UnitMetrics;
  scoreDelta: number | null;
  coverageDelta: number | null;
  isUncovered: boolean;          // según umbral de NO_COVERAGE
}

interface ComparisonResult {
  tool: Tool;
  global: { base: UnitMetrics; head: UnitMetrics; scoreDelta: number; coverageDelta: number };
  units: UnitComparison[];
  regressions: UnitComparison[];     // ordenadas por scoreDelta asc
  uncovered: UnitComparison[];
  added: UnitComparison[];
  removed: UnitComparison[];
}
```

Notas de mapeo:
- **PiTest** (`mutations.xml`): agrupar `<mutation>` por `mutatedClass`; estados KILLED→killed, SURVIVED→survived, NO_COVERAGE→no_coverage, TIMED_OUT→timeout, MEMORY_ERROR/RUN_ERROR/NON_VIABLE→error.
- **Stryker** (JSON del schema oficial): iterar `files{}.mutants[]`; Killed→killed, Survived→survived, NoCoverage→no_coverage, Timeout→timeout, CompileError/RuntimeError→error, Ignored→ignored. Normalizar separadores de ruta.
- El matching entre ejecuciones es por `key`. Documentar limitación: renombrados de clase aparecen como removed + added.

### 2.3.1 Ingesta de ficheros PiTest

Estrategia de subida en cascada: (a) un solo `mutations.xml` (recomendado); (b) un `.zip` que el servidor descomprime y del que extrae todos los `mutations.xml`, fusionando sus mutaciones (útil si hay subcarpetas con timestamp); (c) selección de carpeta desde el navegador (`webkitdirectory`), donde el frontend filtra ya en cliente los ficheros `*.xml` antes de enviarlos, para no subir HTML/CSS innecesarios. La UI mostrará un aviso didáctico: "¿Sabías que con `outputFormats=XML` PiTest genera un único fichero?".

### 2.3.2 Modelo de persistencia (fase 2, opt-in)

SQLite (better-sqlite3), un fichero local. La comparación puntual nunca escribe en BBDD.

```sql
CREATE TABLE projects (
  id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL,
  tool TEXT NOT NULL CHECK (tool IN ('pitest','stryker')),
  created_at TEXT NOT NULL
);
CREATE TABLE runs (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT,                 -- rama, versión, tag…
  executed_at TEXT NOT NULL,  -- fecha de la ejecución (editable por el usuario)
  global_metrics TEXT NOT NULL,   -- JSON UnitMetrics agregado (para el gráfico sin re-parsear)
  normalized_run TEXT NOT NULL,   -- JSON NormalizedRun completo (fuente para comparar)
  created_at TEXT NOT NULL
);
```

Decisiones: el `tool` se fija a nivel de proyecto (evita mezclar PiTest y Stryker en un mismo histórico); se guarda el `NormalizedRun` ya normalizado, no el fichero original (comparaciones futuras instantáneas y BBDD más ligera); `global_metrics` desnormalizado para pintar la evolución sin deserializar runs completos.

### 2.4 API REST

```
POST /api/comparisons            multipart: baseFile, headFile, tool ('pitest'|'stryker'), opciones
  → 200 { comparisonId, result: ComparisonResult }
  → 422 formato inválido / herramientas mezcladas
GET  /api/comparisons/:id        → ComparisonResult (en memoria o SQLite en fase 2)
GET  /api/comparisons/:id/report → text/html (reporte autocontenido, Content-Disposition: attachment)
POST /api/projects               (fase 2) crear proyecto { name, tool }
GET  /api/projects               (fase 2) listar proyectos
POST /api/projects/:id/runs      (fase 2) guardar run (opt-in, desde una comparación o subida directa)
GET  /api/projects/:id/runs      (fase 2) histórico con global_metrics (para el gráfico)
POST /api/projects/:id/compare   (fase 2) comparar dos runs guardados { baseRunId, headRunId }
```

### 2.5 UI (pantallas)

1. **Nueva comparación**: selector PiTest/Stryker → dos zonas drag&drop (Base / Nueva) → opciones (umbrales) → botón Comparar. Junto al selector, un **icono de información (ⓘ)** con panel contextual según la herramienta elegida:
   - *PiTest*: "Debes activar el reporte XML en tu build. Maven/Gradle: `outputFormats = XML` (puedes mantener también HTML). El fichero a subir es `target/pit-reports/**/mutations.xml`."
   - *Stryker*: "Debes activar el reporter JSON en `stryker.config.json`: `\"reporters\": [\"json\", ...]`. El fichero a subir es `reports/mutation/mutation.json`."
   Cada panel incluye el snippet de configuración copiable. Si el usuario sube un fichero con extensión incorrecta para la herramienta elegida, el mensaje de error enlaza a esta misma ayuda.
2. **Dashboard de resultados**: tarjetas de métricas globales con deltas coloreados; secciones "Regresiones", "Sin cobertura", "Nuevas", "Eliminadas"; tabla completa filtrable/ordenable; botón "Exportar HTML".
3. **Histórico** (fase 2): lista de runs guardados, selección de par a comparar, gráfico de evolución del score.

### 2.6 Estrategia de testing

- **core**: unit tests con fixtures reales (XML PiTest y JSON Stryker de ejemplo, casos borde: vacío, una clase, ignored, error, ficheros enormes truncados). Property-based opcional (fast-check) para el motor de comparación (p. ej. comparar un run consigo mismo ⇒ 0 deltas).
- **server**: Supertest para endpoints, incluidos errores 422 y límite de tamaño.
- **web**: RTL para componentes (tabla, tarjetas de delta, wizard) mockeando la API.
- **mutation testing del proyecto**: Stryker sobre `packages/core` en CI; el resultado se puede… comparar con la propia app 🙂
- **e2e**: Playwright (solo Chromium) sobre el flujo real wizard → API → dashboard → export, usando las mismas fixtures que los tests de `core`.
- **CI** (GitHub Actions): lint + typecheck + tests + e2e; stryker en un workflow aparte (job nightly).

### 2.7 Riesgos y decisiones abiertas

- Reportes muy grandes (>20k mutantes): parsear en streaming si hace falta; v1 asume carga en memoria con límite 50 MB.
- PiTest trabaja por clase y Stryker por fichero: el modelo usa `key` genérico y la UI etiqueta la columna según la herramienta.
- Atribución de desarrollador (HU-09): v2, vía fichero `git log --format` subido o ruta a repo local; nunca llamadas a GitHub/GitLab en v1.
