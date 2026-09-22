import type { ComparisonResult, UnitComparison, UnitMetrics } from 'core';
import { describe, expect, it } from 'vitest';
import {
  COMPARISON_FILE_EXTENSION,
  parseComparisonFile,
  serializeComparison,
} from './comparisonFile';

const metrics: UnitMetrics = {
  total: 4,
  killed: 2,
  survived: 1,
  noCoverage: 1,
  timeout: 0,
  error: 0,
  ignored: 0,
  validTotal: 4,
  score: 50,
  coveredPct: 75,
};

/**
 * Un resultado con todos los campos opcionales presentes en algún sitio y
 * ausentes en otro: la validación tiene que aceptar las dos formas, igual que
 * las produce `compareRuns`.
 */
function result(): ComparisonResult {
  const regressed: UnitComparison = {
    key: 'com.example.TaxCalculator',
    kind: 'regressed',
    base: metrics,
    head: { ...metrics, score: 25 },
    scoreDelta: -25,
    coverageDelta: 0,
    isUncovered: false,
    mutantChanges: [
      {
        line: 12,
        mutator: 'ConditionalsBoundary',
        description: 'changed conditional boundary',
        base: 'killed',
        head: 'survived',
        kind: 'newly-survived',
      },
      { line: 30, mutator: 'MathMutator', head: 'killed', kind: 'added' },
    ],
  };
  const added: UnitComparison = {
    key: 'com.example.RefundService',
    kind: 'added',
    head: metrics,
    scoreDelta: null,
    coverageDelta: null,
    isUncovered: false,
  };
  return {
    tool: 'pitest',
    context: {
      baseLabel: 'base.xml',
      headLabel: 'head.xml',
      regressionThreshold: 0,
      uncoveredThreshold: 100,
    },
    global: { base: metrics, head: metrics, scoreDelta: 0, coverageDelta: 0 },
    units: [added, regressed],
    regressions: [regressed],
    uncovered: [],
    added: [added],
    removed: [],
    mutators: [
      { mutator: 'MathMutator', base: metrics, head: metrics, survivedDelta: 0, scoreDelta: 0 },
      { mutator: 'VoidMethodCall', base: metrics, survivedDelta: null, scoreDelta: null },
    ],
  };
}

/**
 * El error que se lanza. Es un `Error` plano, como el de los parsers de `core`:
 * quien lo envuelve en un `ComparisonError` con su código es `importComparison`.
 */
function failureOf(text: string): Error {
  try {
    parseComparisonFile(text);
  } catch (error) {
    if (error instanceof Error) return error;
    throw error;
  }
  throw new Error('parseComparisonFile did not throw');
}

function withResult(edit: (raw: Record<string, unknown>) => void): string {
  const file = JSON.parse(serializeComparison(result())) as { result: Record<string, unknown> };
  edit(file.result);
  return JSON.stringify(file);
}

describe('comparison file', () => {
  it('uses a double extension, so it is still recognisable as JSON', () => {
    expect(COMPARISON_FILE_EXTENSION).toBe('.mutadiff.json');
  });

  it('reads back exactly the comparison it wrote', () => {
    expect(parseComparisonFile(serializeComparison(result()))).toEqual(result());
  });

  it('accepts every status and kind the engine can produce', () => {
    // Un valor que falte en el esquema no rompe ningún otro test: solo haría que
    // se rechazara un fichero válido que lo lleve. De ahí que estén todos.
    const statuses = ['killed', 'survived', 'no_coverage', 'timeout', 'error', 'ignored'] as const;
    const changeKinds = [
      'newly-survived',
      'newly-killed',
      'newly-uncovered',
      'changed',
      'added',
      'removed',
    ] as const;
    const unitKinds = ['improved', 'regressed', 'unchanged', 'added', 'removed'] as const;
    const units: UnitComparison[] = unitKinds.map((kind, index) => ({
      key: `Unit${index}`,
      kind,
      base: metrics,
      head: metrics,
      scoreDelta: 0,
      coverageDelta: 0,
      isUncovered: false,
      mutantChanges: changeKinds.map((changeKind, line) => ({
        line,
        mutator: 'Mutator',
        base: statuses[line]!,
        head: statuses[(line + index) % statuses.length]!,
        kind: changeKind,
      })),
    }));
    const everything: ComparisonResult = { ...result(), tool: 'stryker', units };

    expect(parseComparisonFile(serializeComparison(everything))).toEqual(everything);
  });

  it('marks the file with its format and version', () => {
    // Sin marca, cualquier JSON con la forma adecuada se tomaría por una
    // comparación; sin versión, un cambio de formato no se podría detectar.
    expect(JSON.parse(serializeComparison(result()))).toEqual({
      format: 'mutadiff-comparison',
      version: 1,
      result: result(),
    });
  });

  it('rejects text that is not JSON', () => {
    const error = failureOf('{ not json');

    expect(error.message).toBe('El fichero no es un JSON válido.');
  });

  it('rejects a JSON that is not an exported comparison, such as a mutation report', () => {
    // El caso más probable de confusión: el `mutation.json` de Stryker también
    // es JSON y se elige desde el mismo selector de ficheros.
    const error = failureOf(JSON.stringify({ schemaVersion: '2.0', files: {} }));

    expect(error.message).toBe(
      'El fichero no es una comparación exportada por Mutator Assessment Report.',
    );
  });

  it('rejects a JSON value that is not even an object', () => {
    expect(failureOf('null').message).toBe(
      'El fichero no es una comparación exportada por Mutator Assessment Report.',
    );
  });

  it('names the version when the file comes from a format it cannot read', () => {
    const error = failureOf(
      JSON.stringify({ format: 'mutadiff-comparison', version: 2, result: result() }),
    );

    expect(error.message).toBe(
      'La comparación se exportó con un formato (versión 2) que esta versión de la aplicación no sabe leer.',
    );
  });

  it('rejects a damaged comparison and says where', () => {
    const error = failureOf(
      withResult((raw) => {
        (raw.units as Record<string, unknown>[])[1]!.kind = 'worse';
      }),
    );

    expect(error.message).toBe('La comparación exportada está incompleta o dañada (units.1.kind).');
  });

  it('rejects a comparison missing a field the dashboard needs', () => {
    // Un fichero de una versión anterior al desglose por mutador (T-093) no lo
    // lleva, y el dashboard fallaría al pintarlo: mejor decirlo al importar.
    const error = failureOf(withResult((raw) => delete raw.mutators));

    expect(error.message).toBe('La comparación exportada está incompleta o dañada (mutators).');
  });

  it.each([
    [
      'a metric',
      (raw: Record<string, unknown>) =>
        ((raw.global as { head: UnitMetrics }).head.score = Number.NaN),
      'global.head.score',
    ],
    [
      'a threshold',
      (raw: Record<string, unknown>) =>
        ((raw.context as { uncoveredThreshold: unknown }).uncoveredThreshold = '100'),
      'context.uncoveredThreshold',
    ],
    [
      'a mutant change',
      (raw: Record<string, unknown>) =>
        (((raw.regressions as UnitComparison[])[0]!.mutantChanges![0] as { head: string }).head =
          'dead'),
      'regressions.0.mutantChanges.0.head',
    ],
    [
      'a mutator row',
      (raw: Record<string, unknown>) =>
        ((raw.mutators as { survivedDelta: unknown }[])[1]!.survivedDelta = undefined),
      'mutators.1.survivedDelta',
    ],
    ['the tool', (raw: Record<string, unknown>) => (raw.tool = 'infection'), 'tool'],
    [
      'a label',
      (raw: Record<string, unknown>) => ((raw.context as { baseLabel: unknown }).baseLabel = 7),
      'context.baseLabel',
    ],
  ])('validates %s', (_, edit, path) => {
    expect(failureOf(withResult(edit)).message).toBe(
      `La comparación exportada está incompleta o dañada (${path}).`,
    );
  });
});
