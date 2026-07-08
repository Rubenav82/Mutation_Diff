# MutaDiff — Constitución del proyecto

> Principios innegociables. Toda decisión de código debe respetarlos. Si una tarea entra en conflicto con esta constitución, detente y pregunta.

1. **TDD estricto**: ningún código de producción sin test que falle primero. Cobertura mínima 90% en el core de parsing y comparación.
2. **El propio proyecto se somete a mutation testing** con Stryker (dogfooding). Umbral inicial: score ≥ 70, objetivo 85.
3. **Modelo de dominio único**: PiTest y Stryker se normalizan a un modelo interno común. Ninguna lógica de comparación conoce el formato de origen.
4. **Sin estado obligatorio**: la app funciona subiendo dos ficheros; la persistencia de histórico es opcional (SQLite).
5. **TypeScript en todo el stack** (backend y frontend), ESM, Node ≥ 20.
6. **El reporte HTML exportable es autocontenido**: un solo fichero .html sin dependencias externas, abrible offline.
7. **Los datos nunca salen del servidor del usuario**: no hay llamadas a terceros con el contenido de los reportes.
