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

#### 2.2.1 Dos consumidores de `core` (desde la Fase 4.6)

Esa decisión acabó dando un retorno que no se había previsto: **`core` corre igual en el navegador**, porque no importa nada de `node:` y su única dependencia (`fast-xml-parser`) tampoco. Así que hay dos formas de consumir el mismo dominio, sin duplicar una línea de lógica de comparación:

| Consumidor | Quién lo usa | Estado |
| --- | --- | --- |
| `web` llamando a `core` en el navegador | el despliegue real: `packages/web/dist` servido como ficheros estáticos | **es lo que se publica** |
| `server` exponiendo `core` por HTTP | integraciones desde CI que prefieran `curl` | opcional, se autoaloja |

Motivo del cambio: la aplicación se consume dentro de una empresa por varios equipos y no necesita histórico todavía (eso es la Fase 5). Un servicio Node compartido solo habría aportado coste operativo — el store en memoria obliga a instancia única y pierde los resultados de todos en cada reinicio — mientras que un artefacto estático escala sin operar nada.

Efecto colateral en la privacidad, que refuerza el principio #4 de la constitución: los reportes ya no salen del navegador del desarrollador, ni siquiera hacia el servidor que sirve la aplicación.

Restricciones que impone el despliegue estático, y que hay que respetar al añadir código a `web`:

- **Nada de APIs *secure-context only*** sin fallback: la máquina que sirve el zip puede hablar HTTP plano, y ahí `navigator.clipboard` y `crypto.randomUUID` no existen (ver `lib/clipboard.ts` y `lib/id.ts`).
- **Rutas en el hash y assets relativos** (`base: './'`): un servidor de ficheros no reescribe rutas ni sabe en qué subpath está colgado.
- **El estado vive en la pestaña** (`lib/comparisonStore.ts`): `Map` + `sessionStorage`. No hay nada compartido entre usuarios ni entre pestañas.

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
- **PiTest** (`mutations.xml`): agrupar `<mutation>` por `mutatedClass`; estados KILLED→killed, SURVIVED→survived, NO_COVERAGE→no_coverage, TIMED_OUT→timeout, NON_VIABLE→killed, MEMORY_ERROR/RUN_ERROR→error. NON_VIABLE va a `killed` porque PiTest lo marca `detected="true"` y lo cuenta en el numerador de su propia cobertura de mutación: mapearlo a `error` dejaba el total de matados de MutaDiff por debajo del informe original.
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
GET  /api/comparisons/:id        → ComparisonResult (siempre en memoria, con TTL; ver nota)
GET  /api/comparisons/:id/report → text/html (reporte autocontenido, Content-Disposition: attachment)
POST /api/projects               (fase 2) crear proyecto { name, tool }
GET  /api/projects               (fase 2) listar proyectos
POST /api/projects/:id/runs      (fase 2) guardar run (opt-in, desde una comparación o subida directa)
GET  /api/projects/:id/runs      (fase 2) histórico con global_metrics (para el gráfico)
POST /api/projects/:id/compare   (fase 2) comparar dos runs guardados { baseRunId, headRunId }
```

**Las comparaciones no se persisten nunca**: lo que se guarda en SQLite son los `runs`, y una comparación del histórico se recalcula con `POST /api/projects/:id/compare`. Persistir también el `ComparisonResult` dejaría dos fuentes de verdad para el mismo id y un TTL desincronizado con la BBDD; recalcular es barato (`compareRuns` es una función pura sobre dos `NormalizedRun` ya normalizados).

### 2.5 UI (pantallas)

1. **Nueva comparación**: selector PiTest/Stryker → dos zonas drag&drop (Base / Nueva) → opciones (umbrales) → botón Comparar. Junto al selector, un **icono de información (ⓘ)** con panel contextual según la herramienta elegida:
   - *PiTest*: "Debes activar el reporte XML en el configuration de tu build. Maven/Gradle: `outputFormats = XML` (puedes mantener también HTML). El fichero a subir es `target/pit-reports/**/mutations.xml`." Snippet copiable, con la indentación real del POM:

     ```xml
     <outputFormats>
       <param>XML</param>
     </outputFormats>
     ```

   - *Stryker*: "Debes activar el reporter JSON en `stryker.config.json` (puedes mantener también html). El fichero a subir es `reports/mutation/mutation.json`." Snippet copiable: `"reporters": ["json", ...]`.

   Cada panel incluye el snippet de configuración copiable. Si el usuario sube un fichero con extensión incorrecta para la herramienta elegida, el mensaje de error enlaza a esta misma ayuda.
   Junto a **«Umbrales (opcional)»**, un segundo **ⓘ** con su propio panel explica las dos reglas de CA-HU-05: fórmula, valor por defecto y los casos límite (el umbral de retroceso son puntos de score y no un porcentaje relativo; la frontera es inclusiva, así que una caída igual al umbral se tolera; el umbral sin cobertura a 0 marca todas las clases). Son dos paneles independientes a propósito: responden a dudas de momentos distintos.
2. **Dashboard de resultados**: layout de dos paneles — rail lateral de contexto (herramienta, ficheros comparados, umbrales aplicados, todo en solo lectura) + panel principal con banda de resumen, KPIs, secciones "Regresiones", "Sin cobertura", "Nuevas", "Eliminadas", tabla completa filtrable/ordenable y botón "Exportar HTML". La tabla completa muestra por unidad **score** (base, nueva, Δ) y **mutantes cubiertos** (base, nueva, Δ) en cabeceras agrupadas; cada sección muestra solo la métrica que la motiva (score en «Regresiones», «Nuevas» y «Eliminadas»; mutantes cubiertos en «Sin cobertura»). Nunca se etiqueta «Cobertura»: `coveredPct` son mutantes cubiertos, no el *Line Coverage* de PiTest.
3. **Histórico** (fase 2): lista de runs guardados, selección de par a comparar, gráfico de evolución del score.
4. **Cromo persistente** (presente en todas las pantallas): cabecera con el logotipo de AQA, el nombre del producto y, a la derecha, un **icono `?`** que abre el panel «Acerca de» (nombre, versión, licencia MIT, contacto por `mailto` para notificar un problema y acceso a la **política de privacidad**, en un diálogo modal); y pie de página con la **nota legal del logotipo** (aclara que la marca es una imagen de referencia conceptual del programa de formación interno, sin implicación contractual ni afiliación). La nota vive en el cromo, no en una pantalla, porque matiza el logotipo de la cabecera, que también está siempre visible.

#### 2.5.1 Sistema visual (Modernist, adoptado en T-045)

Rediseño basado en el sistema **Modernist**: flat, arquitectónico, radio de borde 0, reglas de 2px, alineación a la izquierda, densidad tabular. Decisiones tomadas al adaptarlo a este proyecto, que **prevalecen sobre el handoff original** allí donde chocan:

- **El color es del dato, no del cromo** (regla heredada de T-037, innegociable). La banda de resumen va en el neutro más oscuro de la rampa (`#2d2b2b`, blanco encima a 14.07:1), **no** en el acento rojo como proponía el handoff: con la banda en rojo, el rojo de una regresión deja de leerse como alarma unos centímetros más abajo. Los botones primarios siguen la misma regla.
- **Semántica de color**: verde `#14622f` = mejora, rojo `#ae1800` = regresión, neutro = igual, timeouts sin color. Modernist no trae verde; se añade uno profundo y desaturado elegido a **6.67:1** sobre el fondo para emparejar con el rojo a **6.41:1** — si el verde pesara más, una mejora cantaría más que una regresión.
- **El acento rojo vivo (`#ec3013`) no toca ningún dato**: da 3.76:1 sobre el fondo, insuficiente para texto. Queda solo en el anillo de foco y en el logotipo.
- **Sin webfonts**: el handoff carga Archivo desde Google Fonts; se descarta por lo ya fijado en T-037 (la app corre en local, a veces sin salida a internet). Se mantienen los stacks de sistema, con monoespaciada para toda medida. Se pierde el carácter tipográfico exacto de Modernist; se gana que la app nunca dependa de la red.
- **Sin modo oscuro**: el bloque `prefers-color-scheme` de T-037 se retira. Modernist no define rampa oscura y no merece inventarla por ahora.
- **El rail no recalcula**: muestra herramienta, ficheros y umbrales en solo lectura, y su botón lleva al wizard. No puede reejecutar con otros umbrales porque el servidor nunca guarda los ficheros subidos (`memoryStorage`, T-020) — habría que volver a subirlos.

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
