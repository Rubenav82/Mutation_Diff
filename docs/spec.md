# MutaDiff — Especificación funcional (spec.md)

> El QUÉ del producto: comparador de ejecuciones de mutation testing (PiTest / Stryker). Ver plan.md para el CÓMO y tasks.md para el orden de trabajo.

### 1.1 Problema

Comparar manualmente dos ejecuciones de PiTest o Stryker para detectar clases que han perdido cobertura/robustez, o clases nuevas sin tests, es tedioso y propenso a errores. Se necesita una herramienta que automatice la comparación y produzca conclusiones accionables por clase/fichero y por desarrollador.

### 1.2 Usuarios

- **Tech lead / QA lead**: quiere ver la evolución global y las regresiones para pedir acción a los desarrolladores.
- **Desarrollador**: quiere ver qué clases suyas han empeorado o carecen de tests.

### 1.3 Historias de usuario

- **HU-01**: Como usuario, quiero subir dos reportes de PiTest (`mutations.xml`) — ejecución base y ejecución nueva — y ver la comparación.
- **HU-02**: Como usuario, quiero subir dos reportes de Stryker (`mutation-report.json` conforme al mutation-testing-report-schema) y ver la comparación.
- **HU-03**: Como usuario, quiero ver métricas globales de ambas ejecuciones y su delta: mutation score, % mutantes cubiertos, totales de killed / survived / no-coverage / timeout.
- **HU-04**: Como usuario, quiero una tabla por clase/fichero con: score anterior, score nuevo, delta, y estado (mejora ▲ / regresión ▼ / igual / nueva / eliminada).
- **HU-05**: Como usuario, quiero un listado destacado de **regresiones** (clases cuyo score o cobertura ha bajado) ordenado por magnitud del descenso.
- **HU-06**: Como usuario, quiero un listado de **clases nuevas sin cobertura de tests** (todos o mayoría de mutantes en NO_COVERAGE).
- **HU-07**: Como usuario, quiero exportar toda la comparación como un **reporte HTML autocontenido** para adjuntarlo o archivarlo.
- **HU-08**: Como usuario, quiero filtrar/buscar por nombre de clase o paquete y ordenar por cualquier columna.
- **HU-09** (fase 2): Como usuario, quiero adjuntar opcionalmente la salida de `git shortlog`/`git log` (o apuntar a un repo local) para ver el último autor de cada clase con regresión.
- **HU-10** (fase 2): Como usuario, quiero guardar ejecuciones con etiqueta (rama, fecha, versión) **asociadas a un proyecto** (existente o creado en el momento) y comparar cualquier par del histórico de ese proyecto. Guardar es siempre **opt-in**: una comparación puntual nunca persiste datos.
- **HU-11** (fase 2): Como usuario, quiero ver la evolución del score global de un proyecto en un gráfico temporal si hay histórico.
- **HU-12**: Como usuario de PiTest, quiero poder subir un único `mutations.xml` (caso recomendado, configurando `outputFormats=XML` en el plugin), o alternativamente arrastrar la carpeta `pit-reports` completa o un ZIP, y que la app localice y fusione automáticamente los `mutations.xml`, ignorando HTML, CSS y demás ficheros.

### 1.4 Criterios de aceptación clave (formato Given/When/Then)

- **CA-HU-01**: Dado un `mutations.xml` válido de PiTest, cuando lo subo, el sistema extrae por clase: total de mutantes, KILLED, SURVIVED, NO_COVERAGE, TIMED_OUT, MEMORY_ERROR, RUN_ERROR y calcula score = detectados / total válido.
- **CA-HU-02**: Dado un JSON de Stryker con `schemaVersion` 1.x/2.x, cuando lo subo, extrae por fichero: Killed, Survived, NoCoverage, Timeout, CompileError, RuntimeError, Ignored y calcula el score con la fórmula oficial de Stryker (ignorados fuera del denominador).
- **CA-HU-03**: No se permite comparar un reporte PiTest contra uno Stryker: la UI lo impide y la API devuelve 422 con mensaje claro.
- **CA-HU-05**: Una clase es "regresión" si `scoreNuevo < scoreBase − umbral` (umbral configurable, por defecto 0). Una clase es "sin cobertura" si `NO_COVERAGE / total ≥ 100%` (configurable, p. ej. ≥ 80%).
- **CA-HU-07**: El HTML exportado abre offline, contiene resumen, tabla completa, regresiones y clases sin cobertura, y pesa < 2 MB para proyectos de hasta 5.000 clases.
- **CA-HU-10**: Dado el dashboard de una comparación puntual, cuando pulso «Guardar en histórico», elijo un proyecto (existente o creado en el momento, que fija la herramienta) y marco cuáles de las dos ejecuciones guardar —cada una con su `label` y su `executed_at`—, entonces esas ejecuciones se persisten como runs de ese proyecto. Vienen marcadas ambas si el proyecto todavía no tiene ningún run, y solo la nueva en caso contrario. Mientras no pulse «Guardar en histórico», **ninguna comparación escribe en la base de datos**.
- **CA-HU-10b**: Dado un proyecto con al menos dos runs, cuando selecciono dos del histórico y pulso comparar, entonces obtengo el mismo `ComparisonResult` que si hubiera subido los ficheros originales, sin volver a subir nada. El histórico se lista ordenado por `executed_at` descendente.
- **CA-HU-10c**: Guardar un run cuya herramienta no coincide con la del proyecto devuelve 422; crear un proyecto con un nombre ya existente devuelve 409. Las etiquetas **no** son únicas: dos runs del mismo proyecto pueden compartir `label` (p. ej. dos ejecuciones de `main` en días distintos) y se distinguen por `executed_at`.
- **CA-HU-11**: Dado un proyecto con dos o más runs, cuando abro su histórico, entonces veo un gráfico de líneas con el mutation score global en el eje Y y `executed_at` en el X, un punto por run en orden cronológico ascendente. Con menos de dos runs se muestra un mensaje en lugar del gráfico. El gráfico se pinta desde `global_metrics`, sin deserializar los `NormalizedRun` completos.
- **Errores**: ficheros corruptos, XML/JSON inválido, esquema desconocido o >50 MB devuelven error legible, nunca stack trace.

### 1.5 Fuera de alcance (v1)

Autenticación multiusuario, integración directa con CI (se hace vía API), soporte de otros frameworks de mutación (Mutmut, Infection…), y ejecución de PiTest/Stryker desde la app (solo consume reportes ya generados).
