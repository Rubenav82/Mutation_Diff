/**
 * Plain-language definitions for the eight global KPIs, shared verbatim by the
 * SPA tooltips, the report tooltips and the printable glossary. They live in
 * `core` because `web` may import from here but not the other way around — the
 * same reason the palette had to be duplicated by hand cannot apply to text.
 *
 * The wording is written against the formulas in `metrics.ts` (score counts
 * timeouts as detected, coveredPct measures mutants rather than lines): if a
 * formula changes, the matching definition must change in the same commit.
 */
export interface KpiGlossaryEntry {
  /** The label as shown in the UI and the report. */
  term: string;
  /** One or two plain sentences explaining what the figure measures. */
  definition: string;
}

export const KPI_GLOSSARY = {
  analyzedClasses: {
    term: 'Clases analizadas',
    definition:
      'Clases o ficheros con mutantes en cada ejecución. Una caída respecto a la base suele indicar una ejecución incompleta o un módulo que dejó de analizarse.',
  },
  coveredClasses: {
    term: 'Clases con cobertura',
    definition:
      'Clases analizadas que quedan por debajo del umbral de «sin cobertura». Con el umbral al 100 %, solo se descuentan las clases en las que ningún test ejecuta ningún mutante.',
  },
  score: {
    term: 'Mutation score',
    definition:
      'Porcentaje de mutantes detectados (killed + timeouts) sobre los mutantes válidos (total sin errores ni ignorados). Cuanto más alto, más eficaces son los tests detectando cambios en el código.',
  },
  coveredMutants: {
    term: 'Mutantes cubiertos',
    definition:
      'Porcentaje de mutantes válidos que ejecuta al menos un test. No es la cobertura de líneas del informe de origen: mide mutantes, no líneas.',
  },
  killed: {
    term: 'Killed',
    definition:
      'Mutantes detectados: al menos un test falla al aplicar la mutación. Es el resultado deseado para cada mutante.',
  },
  survivors: {
    term: 'Survivors',
    definition:
      'Mutantes que los tests ejecutan pero no detectan: el código mutado pasa la suite. Señalan tests que ejercitan el código sin verificar su comportamiento.',
  },
  noCoverage: {
    term: 'Sin cubrir',
    definition:
      'Mutantes que ningún test llega a ejecutar. Señalan código sin tests y cuentan como no detectados en el score.',
  },
  timeouts: {
    term: 'Timeouts',
    definition:
      'Mutantes que hacen que los tests superen el tiempo límite (p. ej. un bucle infinito provocado por la mutación). Cuentan como detectados en el score, por eso su delta no se colorea como bueno ni malo.',
  },
} as const satisfies Record<string, KpiGlossaryEntry>;

export type KpiGlossaryKey = keyof typeof KPI_GLOSSARY;
