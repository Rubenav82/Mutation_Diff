import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compareRuns } from './comparisonEngine.js';
import { calculateUnitMetrics, aggregateMetrics } from '../domain/metrics.js';
import type { Mutant, MutantStatus, NormalizedRun, Tool, UnitResult } from '../domain/types.js';
import { parsePitestReport } from '../parsers/pitestParser.js';

const fixturesDir = fileURLToPath(new URL('../../test/fixtures/pitest/', import.meta.url));

function readFixture(relativePath: string): string {
  return readFileSync(fixturesDir + relativePath, 'utf-8');
}

function mutant(status: MutantStatus, id: string): Mutant {
  return { id, mutator: 'SomeMutator', line: 1, status };
}

function unitFrom(key: string, statuses: MutantStatus[]): UnitResult {
  const mutants = statuses.map((status, i) => mutant(status, String(i)));
  return { key, displayName: key, mutants, metrics: calculateUnitMetrics(mutants) };
}

function runFrom(
  tool: Tool,
  units: UnitResult[],
  createdAt = '2026-01-01T00:00:00.000Z',
): NormalizedRun {
  return { tool, createdAt, units, metrics: aggregateMetrics(units) };
}

function comparison(result: ReturnType<typeof compareRuns>, key: string) {
  const found = result.units.find((u) => u.key === key);
  if (!found) throw new Error(`comparison not found: ${key}`);
  return found;
}

describe('compareRuns — mini PiTest fixtures', () => {
  const base = parsePitestReport(readFixture('mini/base.xml'), {
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  const head = parsePitestReport(readFixture('mini/head.xml'), {
    createdAt: '2026-01-02T00:00:00.000Z',
  });
  const result = compareRuns(base, head);

  it('classifies each unit by kind', () => {
    expect(comparison(result, 'com.example.Calculator').kind).toBe('improved');
    expect(comparison(result, 'com.example.StringUtils').kind).toBe('regressed');
    expect(comparison(result, 'com.example.MathHelper').kind).toBe('unchanged');
    expect(comparison(result, 'com.example.Legacy').kind).toBe('removed');
    expect(comparison(result, 'com.example.NewFeature').kind).toBe('added');
  });

  it('computes scoreDelta/coverageDelta for matched units, null for added/removed', () => {
    expect(comparison(result, 'com.example.Calculator').scoreDelta).toBeCloseTo(50);
    expect(comparison(result, 'com.example.StringUtils').scoreDelta).toBeCloseTo(-100);
    expect(comparison(result, 'com.example.MathHelper').scoreDelta).toBeCloseTo(0);
    expect(comparison(result, 'com.example.Legacy').scoreDelta).toBeNull();
    expect(comparison(result, 'com.example.Legacy').coverageDelta).toBeNull();
    expect(comparison(result, 'com.example.NewFeature').scoreDelta).toBeNull();
  });

  it('carries base/head metrics only for the sides that exist', () => {
    const removed = comparison(result, 'com.example.Legacy');
    expect(removed.base).toBeDefined();
    expect(removed.head).toBeUndefined();

    const added = comparison(result, 'com.example.NewFeature');
    expect(added.base).toBeUndefined();
    expect(added.head).toBeDefined();
  });

  it('builds the global aggregate deltas from the run-level metrics', () => {
    expect(result.global.base.score).toBeCloseTo(80);
    expect(result.global.head.score).toBeCloseTo(50);
    expect(result.global.scoreDelta).toBeCloseTo(-30);
  });

  it('lists only regressions, sorted by scoreDelta ascending (worst first)', () => {
    expect(result.regressions).toHaveLength(1);
    expect(result.regressions[0]?.key).toBe('com.example.StringUtils');
  });

  it('lists added and removed units', () => {
    expect(result.added.map((u) => u.key)).toEqual(['com.example.NewFeature']);
    expect(result.removed.map((u) => u.key)).toEqual(['com.example.Legacy']);
  });

  it('flags a fully-NO_COVERAGE added unit as uncovered', () => {
    expect(comparison(result, 'com.example.NewFeature').isUncovered).toBe(true);
    expect(result.uncovered.map((u) => u.key)).toContain('com.example.NewFeature');
  });

  it('never flags a removed unit as uncovered', () => {
    expect(comparison(result, 'com.example.Legacy').isUncovered).toBe(false);
  });
});

describe('compareRuns — mismatched tools', () => {
  it('throws a readable error instead of comparing across tools', () => {
    const pitestRun = runFrom('pitest', [unitFrom('A', ['killed'])]);
    const strykerRun = runFrom('stryker', [unitFrom('A', ['killed'])]);
    expect(() => compareRuns(pitestRun, strykerRun)).toThrow(/pitest|stryker|tool/i);
  });
});

describe('compareRuns — regression threshold', () => {
  it('treats a small drop within the threshold as unchanged, not regressed', () => {
    // base: 4 killed / 5 -> score 80; head: 3 killed, 1 survived / 5 -> score 60 (drop of 20)
    const base = runFrom('pitest', [
      unitFrom('A', ['killed', 'killed', 'killed', 'killed', 'survived']),
    ]);
    const head = runFrom('pitest', [
      unitFrom('A', ['killed', 'killed', 'killed', 'survived', 'survived']),
    ]);

    const strict = compareRuns(base, head, { regressionThreshold: 0 });
    expect(comparison(strict, 'A').kind).toBe('regressed');

    const tolerant = compareRuns(base, head, { regressionThreshold: 25 });
    expect(comparison(tolerant, 'A').kind).toBe('unchanged');
  });

  it('still flags a drop that exceeds the configured threshold', () => {
    const base = runFrom('pitest', [unitFrom('A', ['killed', 'killed'])]); // 100
    const head = runFrom('pitest', [unitFrom('A', ['killed', 'survived'])]); // 50, drop 50
    const result = compareRuns(base, head, { regressionThreshold: 25 });
    expect(comparison(result, 'A').kind).toBe('regressed');
  });
});

describe('compareRuns — uncovered threshold', () => {
  function runWithNoCoverageRatio(ratio: number): NormalizedRun {
    const noCoverageCount = Math.round(ratio * 4);
    const statuses: MutantStatus[] = [
      ...Array<MutantStatus>(noCoverageCount).fill('no_coverage'),
      ...Array<MutantStatus>(4 - noCoverageCount).fill('killed'),
    ];
    return runFrom('pitest', [unitFrom('A', statuses)]);
  }

  it('defaults to a 100% NO_COVERAGE threshold', () => {
    const base = runFrom('pitest', [unitFrom('A', ['killed'])]);
    const partiallyCovered = compareRuns(base, runWithNoCoverageRatio(0.75));
    expect(comparison(partiallyCovered, 'A').isUncovered).toBe(false);

    const fullyUncovered = compareRuns(base, runWithNoCoverageRatio(1));
    expect(comparison(fullyUncovered, 'A').isUncovered).toBe(true);
  });

  it('honors a configurable, lower uncoveredThreshold (borderline case)', () => {
    const base = runFrom('pitest', [unitFrom('A', ['killed'])]);
    const head = runWithNoCoverageRatio(0.75);

    expect(comparison(compareRuns(base, head, { uncoveredThreshold: 80 }), 'A').isUncovered).toBe(
      false,
    );
    expect(comparison(compareRuns(base, head, { uncoveredThreshold: 75 }), 'A').isUncovered).toBe(
      true,
    );
  });
});
