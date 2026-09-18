# Mutator Assessment Report

Compara dos ejecuciones de mutation testing —[PiTest](https://pitest.org/) o [Stryker](https://stryker-mutator.io/)— y te dice qué ha empeorado: retrocesos de score (mutantes detectados "Killed") por clase, clases nuevas sin tests, clases eliminadas y cobertura de mutantes perdida. Para cada clase que retrocede, baja hasta el mutante: qué dejó de detectarse, en qué línea y con qué mutador. Y agrupa por mutador para que veas cuáles producen los supervivientes. Exporta el resultado como un informe HTML autocontenido —o como PDF— para adjuntarlo a una PR o archivarlo.

Mirar dos `mutations.xml` en paralelo para averiguar qué clase ha bajado de score es tedioso y se hace mal. Esto lo automatiza.

**Mutator Assessment Report corre entero en el navegador.** No hay backend, ni base de datos, ni nada que instalar para usarlo: se sirve como ficheros estáticos y tus reportes no salen de tu máquina.

## Usarlo

Descarga `mutadiff-latest.zip` de la [última release](https://github.com/Rubenav82/Mutation_Diff/releases/latest), descomprímelo y sirve la carpeta con cualquier servidor de ficheros:

```bash
curl -LO https://github.com/Rubenav82/Mutation_Diff/releases/latest/download/mutadiff-latest.zip
unzip mutadiff-latest.zip -d mutadiff
npx serve mutadiff        # o nginx, IIS, Apache, GitHub Pages, un recurso compartido…
```

Esa URL es **estable**: siempre sirve la última versión publicada, así que un servidor que la descargue periódicamente se mantiene al día sin tocar su configuración.

Si prefieres no repetir esos pasos en cada release, [`compose/`](compose/) trae un stack de Docker Compose que descarga el zip y lo sirve con nginx: `docker compose up -d` y la aplicación queda en `http://localhost:8080`. Actualizar es reiniciar un contenedor. Requiere salida a internet desde la máquina que la sirve.

No necesita configuración: las rutas van en el hash y los assets son relativos, así que funciona igual en la raíz de un dominio (`https://tuservidor/`) que colgando de un subpath (`https://tuservidor/mutadiff/`).

> Tiene que servirse por HTTP, no vale abrir `index.html` con doble clic: los navegadores bloquean los módulos ES sobre `file://`.

Se publica una release por cada cambio que llegue a `master`, etiquetada `vAÑO.MES.DÍA.N` (la `N` es el número de ejecución, para distinguir varias del mismo día). Para volver a una anterior, descarga su zip desde la [lista de releases](https://github.com/Rubenav82/Mutation_Diff/releases) en vez de usar la URL de `latest`.

## Desarrollo

Requiere Node.js ≥ 20 y npm ≥ 10 (workspaces).

```bash
git clone https://github.com/Rubenav82/Mutation_Diff.git
cd Mutation_Diff
npm install
npm run dev -w web
```

Abre <http://localhost:5173>. Para construir el mismo artefacto que publica la release: `npm run build && npm run build -w web` deja el resultado en `packages/web/dist`.

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
  <outputFormat>HTML</outputFormat>
  <outputFormat>XML</outputFormat>
</outputFormats>
```

O inclúyelo como opción en el comando de ejecución `-DoutputFormats=HTML,XML`.

El fichero a subir es `target/pit-reports/**/mutations.xml`.

**Stryker** — activa el reporter JSON en `stryker.config.json`:

```json
{
  "reporters": ["json", "html", "clear-text", "progress"]
}
```

El fichero a subir es `reports/mutation/mutation.json`.

La misma información está dentro de la app, detrás del icono ⓘ junto al selector de herramienta.

## Uso

1. Elige herramienta (PiTest o Stryker) y arrastra los dos reportes: la ejecución **base** y la **nueva**.
2. Opcionalmente ajusta los umbrales:
   - **Umbral de retroceso (%)**: cuánto puede bajar el score "mutators killed" de una clase antes de contarla como retroceso. Por defecto `0` — cualquier bajada cuenta.
   - **Umbral sin cobertura (%)**: qué porcentaje de mutantes en `NO_COVERAGE` marca una clase como «sin cobertura». Por defecto `100` — solo las que no tienen ni un mutante cubierto. Bájalo a `75` para incluir también las casi descubiertas.
   Las dos reglas completas, con fórmula y casos límite, están dentro de la app detrás del icono ⓘ que hay junto a «Umbrales (opcional)».
3. El dashboard muestra las métricas globales con su delta, las secciones de retrocesos / sin cobertura / nuevas / eliminadas, y la tabla completa con filtro y orden por columna. Todas las tablas se paginan de 5 en 5 para que la comparación entera se recorra sin scroll; cada una lleva su propio selector con 25, 50, 100 o «Todas», que es lo que necesitas si quieres buscar con Ctrl+F sobre el conjunto entero. Una tabla con 5 filas o menos no muestra controles: ya está toda a la vista.
4. **Baja al mutante.** Toda fila cuya clase tenga mutantes que cambiaron de estado lleva un botón con el número de cambios; al desplegarla ves cada uno con su línea, mutador, estado antes → ahora y el tipo de cambio (nuevo superviviente, ahora detectado, sin cobertura ahora…). La casilla «Solo nuevos supervivientes» deja a la vista lo accionable: lo que antes se mataba y ahora no.
5. **Por mutador**, al final del dashboard: mutantes, supervivientes en cada ejecución con su delta, sin cubrir y score de cada mutador, ordenados por los que más supervivientes producen. Es lo que hace falta para decidir si un mutador merece tests o si es mejor excluirlo de la configuración (`VoidMethodCallMutator` sobre llamadas de log es el caso típico).
6. **Exportar HTML** descarga el informe completo como un único fichero, sin CSS ni JS externos: se abre offline y se puede adjuntar donde sea. Incluye la tabla por mutador en el resumen y, bajo cada retroceso, sus nuevos supervivientes (hasta diez por clase; si el detalle no cabe en el informe, lo dice en lugar de omitirlo en silencio).
7. **Exportar PDF** abre el diálogo de impresión del navegador con ese mismo informe ya maquetado para papel; elige «Guardar como PDF» y te propondrá el nombre `mutadiff-report-<id>`. Los dos formatos conviven a propósito: el HTML se explora (buscable, sin cortes de página) y el PDF se adjunta a un correo o a una incidencia. Con miles de unidades el PDF sale largo — la tabla completa lo es de por sí.

## API REST (opcional, autoalojada)

**No hace falta para usar la aplicación** y no forma parte del artefacto estático: la web no llama a ningún endpoint. El repo mantiene un servidor Express equivalente por si algún equipo quiere lanzar comparaciones desde su CI. Se levanta aparte, desde el código fuente:

```bash
npm run build && npm run dev -w server   # escucha en el 3000
```

Ojo con dos cosas si lo despliegas: guarda los resultados **en memoria** con un TTL de 1 hora, así que necesita **una sola instancia** (con varias réplicas, un `GET` puede caer en la que no tiene el resultado) y los pierde en cada reinicio.

Los tres endpoints:

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
npm run dev -w web # la aplicación (5173)
npm run dev        # además, el servidor REST opcional (3000)
npm test           # suite completa (Vitest)
npm run test:e2e   # e2e con Playwright — requiere `npx playwright install chromium`
npm run typecheck  # tsc --noEmit en todos los workspaces + e2e
npm run lint       # ESLint + Prettier
npm run mutation   # Stryker sobre packages/core y packages/web/src/lib (~8 min)
npm run build      # tsc -b
```

## Arquitectura

Monorepo npm workspaces, TypeScript strict, ESM:

| Paquete           | Qué hay dentro                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `packages/core`   | Dominio puro, sin I/O. Parsers PiTest/Stryker → modelo normalizado, motor de comparación y generador del informe HTML.   |
| `packages/web`    | Vite + React 18: wizard, dashboard, tablas con TanStack Table. Es lo que se publica.                                     |
| `packages/server` | Express 5 con la API REST opcional. No entra en el artefacto estático.                                                   |

Que `core` sea dominio puro —sin I/O, sin Node— es lo que permite que la misma lógica corra en el navegador, en el servidor opcional y, en su día, en un CLI. Ninguno de los tres duplica una línea de comparación.

PiTest trabaja por clase y Stryker por fichero; el modelo usa una `key` genérica para ambos.

## Privacidad

Los reportes que subes **no salen de tu navegador**. No se envían a ningún servidor, ni siquiera al que sirve la aplicación: los ficheros se leen y se comparan en local, y el resultado se guarda solo en el `sessionStorage` de tu pestaña, que el navegador borra al cerrarla. Puedes comprobarlo tú mismo: abre las herramientas de desarrollo en la pestaña de red y verás que comparar no genera ni una petición.

Importa porque un `mutations.xml` lleva dentro los nombres de clases y las rutas de ficheros de tu código.

## Estado y limitaciones

Funcional para el flujo completo de comparación puntual. Sabidas y pendientes:

- **Un fichero por lado.** Un proyecto Maven multi-módulo genera un `mutations.xml` por módulo; hay que elegir uno o fusionarlos antes de subirlos. No está planificado de momento.
- **Sin histórico.** Una comparación vive en la pestaña que la creó: sobrevive a recargar, pero no a cerrar el navegador, y no se puede compartir por enlace. Para conservar o mandar un resultado, exporta el HTML. La persistencia opt-in, la atribución de autor vía `git log` y el modo CLI para integrarlo en pipelines están pendientes de decisión, no de implementación: cómo se distribuye el CLI y de dónde sale el informe base en CI son las preguntas abiertas.
- **Solo PiTest y Stryker.** El JSON de Stryker es el esquema estándar de mutation-testing-elements, así que los reportes de Stryker.NET y Stryker4s entran igual.
- **Los reportes se procesan en memoria del navegador.** Con ficheros muy grandes (decenas de MB) el consumo lo paga tu pestaña. A cambio, nadie compite por la memoria de un servidor compartido.

## Calidad

El proyecto se somete a su propio tipo de análisis: mutation testing con Stryker sobre `packages/core` y la lógica de `packages/web/src/lib`, con el umbral en 70 y el score actual en **98,58 %** (`core` al 99,70 %; los vivos que quedan son equivalentes documentados). La suite tiene, a día de hoy, 455 tests unitarios/integración y 5 e2e sobre el flujo real en navegador. CI ejecuta lint, typecheck, tests y e2e en cada PR; Stryker va en un workflow aparte, y la release no se publica sin pasar la misma barra. Dependabot abre un PR semanal con las actualizaciones de dependencias agrupadas.

## Documentación

- [`docs/constitution.md`](docs/constitution.md) — principios innegociables.
- [`docs/spec.md`](docs/spec.md) — historias de usuario y criterios de aceptación.
- [`docs/plan.md`](docs/plan.md) — arquitectura, modelo de dominio, API y UI.
- [`docs/tasks.md`](docs/tasks.md) — backlog y estado.

## Licencia

MIT — ver [LICENSE](LICENSE).