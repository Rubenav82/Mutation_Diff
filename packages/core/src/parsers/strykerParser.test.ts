import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseStrykerReport } from './strykerParser.js';

const fixturesDir = fileURLToPath(new URL('../../test/fixtures/stryker/', import.meta.url));

function readFixture(relativePath: string): string {
  return readFileSync(fixturesDir + relativePath, 'utf-8');
}

function unit(run: ReturnType<typeof parseStrykerReport>, key: string) {
  const found = run.units.find((u) => u.key === key);
  if (!found) throw new Error(`unit not found: ${key}`);
  return found;
}

describe('parseStrykerReport — mini fixtures (schemaVersion 1.6)', () => {
  const base = parseStrykerReport(readFixture('mini/base.json'), {
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  const head = parseStrykerReport(readFixture('mini/head.json'), {
    createdAt: '2026-01-02T00:00:00.000Z',
  });

  it('sets tool and passthrough metadata', () => {
    expect(base.tool).toBe('stryker');
    expect(base.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('groups mutants by file path into one unit per file', () => {
    expect(base.units).toHaveLength(4);
    expect(base.units.map((u) => u.key).sort()).toEqual([
      'src/calculator.js',
      'src/legacy.js',
      'src/mathHelper.js',
      'src/stringUtils.js',
    ]);
  });

  it('maps Stryker statuses to normalized MutantStatus', () => {
    const calculator = unit(base, 'src/calculator.js');
    expect(calculator.mutants).toHaveLength(2);
    expect(calculator.mutants.map((m) => m.status).sort()).toEqual(['killed', 'survived']);

    const newFeature = unit(head, 'src/newFeature.js');
    expect(newFeature.mutants.every((m) => m.status === 'no_coverage')).toBe(true);
  });

  it('preserves mutant line, mutator and id', () => {
    const calculator = unit(base, 'src/calculator.js');
    const first = calculator.mutants.find((m) => m.line === 2);
    expect(first).toBeDefined();
    expect(first?.status).toBe('killed');
    expect(first?.mutator).toBe('ArithmeticOperator');
    expect(first?.id).toBe('1');
  });

  it('computes per-unit metrics from the mapped statuses', () => {
    const calculator = unit(base, 'src/calculator.js'); // 1 killed, 1 survived
    expect(calculator.metrics.score).toBeCloseTo(50);
    expect(calculator.metrics.coveredPct).toBeCloseTo(100);

    const newFeature = unit(head, 'src/newFeature.js'); // 2 no_coverage
    expect(newFeature.metrics.score).toBeCloseTo(0);
    expect(newFeature.metrics.coveredPct).toBeCloseTo(0);
  });

  it('computes the global aggregate across all units', () => {
    expect(base.metrics.total).toBe(5);
    expect(base.metrics.score).toBeCloseTo(80);
    expect(base.metrics.coveredPct).toBeCloseTo(100);

    expect(head.metrics.total).toBe(6);
    expect(head.metrics.score).toBeCloseTo(50);
    expect(head.metrics.coveredPct).toBeCloseTo((4 / 6) * 100);
  });

  it('reflects a file removed in head as absent from head.units', () => {
    expect(head.units.some((u) => u.key === 'src/legacy.js')).toBe(false);
  });

  it('reflects a file added in head as absent from base.units', () => {
    expect(base.units.some((u) => u.key === 'src/newFeature.js')).toBe(false);
  });
});

describe('parseStrykerReport — realistic fixtures (schemaVersion 2.0)', () => {
  const base = parseStrykerReport(readFixture('realistic/base.json'), {
    createdAt: '2026-01-01T00:00:00.000Z',
  });

  it('maps Timeout, RuntimeError and Ignored to timeout/error/ignored', () => {
    const taxCalculator = unit(base, 'src/billing/taxCalculator.js');
    expect(taxCalculator.mutants.some((m) => m.status === 'timeout')).toBe(true);

    const paymentGateway = unit(base, 'src/billing/paymentGateway.js');
    expect(paymentGateway.mutants.some((m) => m.status === 'error')).toBe(true);

    const currencyFormatter = unit(base, 'src/billing/util/currencyFormatter.js');
    expect(currencyFormatter.mutants.some((m) => m.status === 'ignored')).toBe(true);
  });

  it('excludes error and ignored mutants from validTotal when scoring', () => {
    const currencyFormatter = unit(base, 'src/billing/util/currencyFormatter.js');
    const { total, ignored, validTotal } = currencyFormatter.metrics;
    expect(validTotal).toBe(total - ignored);
  });
});

describe('parseStrykerReport — schema version handling', () => {
  function reportWith(schemaVersion: unknown): string {
    return JSON.stringify({
      schemaVersion,
      files: {
        'src/a.js': {
          language: 'javascript',
          mutants: [
            {
              id: '1',
              mutatorName: 'BooleanLiteral',
              replacement: 'false',
              status: 'Killed',
              location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
              coveredBy: [],
              killedBy: [],
            },
          ],
        },
      },
    });
  }

  it('accepts schemaVersion 1.x and 2.x', () => {
    expect(() =>
      parseStrykerReport(reportWith('1.0'), { createdAt: '2026-01-01T00:00:00.000Z' }),
    ).not.toThrow();
    expect(() =>
      parseStrykerReport(reportWith('2.1'), { createdAt: '2026-01-01T00:00:00.000Z' }),
    ).not.toThrow();
  });

  it('rejects an unsupported major schemaVersion', () => {
    expect(() =>
      parseStrykerReport(reportWith('3.0'), { createdAt: '2026-01-01T00:00:00.000Z' }),
    ).toThrow(/schemaVersion|unsupported|stryker/i);
  });

  it('rejects a report with a missing schemaVersion', () => {
    expect(() =>
      parseStrykerReport(JSON.stringify({ files: {} }), { createdAt: '2026-01-01T00:00:00.000Z' }),
    ).toThrow(/schemaVersion|invalid|stryker/i);
  });
});

describe('parseStrykerReport — invalid input', () => {
  it('throws a readable error for malformed JSON, not a raw parser stack trace', () => {
    expect(() =>
      parseStrykerReport('{ not valid json', { createdAt: '2026-01-01T00:00:00.000Z' }),
    ).toThrow(/invalid|malformed|stryker/i);
  });

  it('throws a readable error when the "files" key is missing', () => {
    expect(() =>
      parseStrykerReport(JSON.stringify({ schemaVersion: '2.0' }), {
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow(/invalid|malformed|stryker|files/i);
  });

  it('throws a readable error for an unrecognized mutant status', () => {
    const report = JSON.stringify({
      schemaVersion: '2.0',
      files: {
        'src/a.js': {
          language: 'javascript',
          mutants: [
            {
              id: '1',
              mutatorName: 'BooleanLiteral',
              replacement: 'false',
              status: 'SomeFutureStatus',
              location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
              coveredBy: [],
              killedBy: [],
            },
          ],
        },
      },
    });
    expect(() => parseStrykerReport(report, { createdAt: '2026-01-01T00:00:00.000Z' })).toThrow(
      /status|stryker/i,
    );
  });

  it('normalizes Windows-style backslash path separators in file keys', () => {
    const report = JSON.stringify({
      schemaVersion: '2.0',
      files: {
        'src\\billing\\invoice.js': {
          language: 'javascript',
          mutants: [
            {
              id: '1',
              mutatorName: 'BooleanLiteral',
              replacement: 'false',
              status: 'Killed',
              location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
              coveredBy: [],
              killedBy: [],
            },
          ],
        },
      },
    });
    const run = parseStrykerReport(report, { createdAt: '2026-01-01T00:00:00.000Z' });
    expect(run.units.map((u) => u.key)).toEqual(['src/billing/invoice.js']);
  });
});
