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
    expect(countUnits(result)).toMatchObject({ base: 5, head: 6 });
  });

  it('reports how many units the new run gained or lost', () => {
    expect(countUnits(result).delta).toBe(1);
  });

  it('counts the units of the new run that are not flagged as uncovered', () => {
    // 6 de la nueva menos C y F, sin ni un mutante cubierto.
    expect(countUnits(result).covered).toBe(4);
  });

  it('follows the configured uncovered threshold', () => {
    // G tiene la mitad de sus mutantes sin cubrir: entra al bajar el umbral a 50.
    const lenient = compareRuns(BASE, HEAD, { uncoveredThreshold: 50 });

    expect(countUnits(lenient).covered).toBe(3);
  });

  // Las unidades eliminadas nunca se marcan como sin cobertura (no hay ejecución
  // nueva que evaluar), así que restarlas de la unión las contaría como cubiertas.
  it('leaves removed units out of the covered count', () => {
    expect(countUnits(result).covered).not.toBe(result.units.length - result.uncovered.length);
  });
});
