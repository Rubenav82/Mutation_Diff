import { beforeAll, describe, expect, it } from 'vitest';
import { aggregateMetrics, calculateUnitMetrics } from '../domain/metrics.js';
import type { ComparisonResult, MutantStatus, NormalizedRun, UnitResult } from '../domain/types.js';
import { compareRuns } from './comparisonEngine.js';
import { countUnits } from './unitCounts.js';

function unit(key: string, statuses: MutantStatus[]): UnitResult {
  const mutants = statuses.map((status, index) => ({
    id: `${key}-${index}`,
    mutator: 'CONDITIONALS_BOUNDARY',
    line: index + 1,
    status,
  }));
  return { key, displayName: key, mutants, metrics: calculateUnitMetrics(mutants) };
}

function run(units: UnitResult[]): NormalizedRun {
  return {
    tool: 'pitest',
    createdAt: '2026-01-01T00:00:00.000Z',
    units,
    metrics: aggregateMetrics(units),
  };
}

// Un caso por cada forma en la que las dos ejecuciones difieren: E y F solo están
// en la nueva, D solo en la base, y C y F no tienen ni un mutante cubierto. G
// está a medias, para que el umbral tenga algo que decidir.
const BASE = run([
  unit('A', ['killed']),
  unit('B', ['killed']),
  unit('C', ['killed']),
  unit('D', ['killed']),
  unit('G', ['killed', 'no_coverage']),
]);

const HEAD = run([
  unit('A', ['killed']),
  unit('B', ['killed']),
  unit('C', ['no_coverage']),
  unit('E', ['killed']),
  unit('F', ['no_coverage']),
  unit('G', ['killed', 'no_coverage']),
]);

describe('countUnits', () => {
  let result: ComparisonResult;

  beforeAll(() => {
    result = compareRuns(BASE, HEAD);
  });

  it('counts the units each run actually contains', () => {
    // Ni 7 (la unión que recorre `units`) ni el mismo número en ambos lados: la
    // base no vio E ni F, y la nueva no vio D.
    expect(countUnits(result).base.total).toBe(5);
    expect(countUnits(result).head.total).toBe(6);
  });

  it('reports how many units the new run gained or lost', () => {
    expect(countUnits(result).totalDelta).toBe(1);
  });

  // Los dos lados, no solo el nuevo: sin el de la base no hay forma de saber si
  // las que tienen cobertura han subido o bajado, que es la pregunta real.
  it('counts the covered units on each side', () => {
    // Base: 5 menos ninguna sin cubrir del todo. Nueva: 6 menos C y F.
    expect(countUnits(result).base.covered).toBe(5);
    expect(countUnits(result).head.covered).toBe(4);
  });

  it('reports the change in covered units', () => {
    expect(countUnits(result).coveredDelta).toBe(-1);
  });

  it('follows the configured uncovered threshold on both sides', () => {
    // G tiene la mitad de sus mutantes sin cubrir en las dos ejecuciones: entra
    // en ambos lados al bajar el umbral a 50.
    const lenient = countUnits(compareRuns(BASE, HEAD, { uncoveredThreshold: 50 }));

    expect(lenient.base.covered).toBe(4);
    expect(lenient.head.covered).toBe(3);
  });

  // Una unidad eliminada no tiene ejecución nueva que evaluar, y una nueva no tiene
  // base: cada lado cuenta solo las unidades que existen en él.
  it('counts each unit on the side it exists in, and only there', () => {
    const counts = countUnits(result);

    expect(counts.base.total).toBe(result.units.length - result.added.length);
    expect(counts.head.total).toBe(result.units.length - result.removed.length);
  });

  // Una unidad eliminada no se marca nunca como sin cobertura, así que contarla
  // por presencia y no restando `uncovered` de la unión es lo que evita colarla
  // en el lado nuevo como si tuviera cobertura.
  it('keeps removed units out of the new run entirely', () => {
    expect(countUnits(result).head.covered).not.toBe(result.units.length - result.uncovered.length);
  });
});
