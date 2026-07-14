import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePitestReport } from './pitestParser.js';

const fixturesDir = fileURLToPath(new URL('../../test/fixtures/pitest/', import.meta.url));

function readFixture(relativePath: string): string {
  return readFileSync(fixturesDir + relativePath, 'utf-8');
}

function unit(run: ReturnType<typeof parsePitestReport>, key: string) {
  const found = run.units.find((u) => u.key === key);
  if (!found) throw new Error(`unit not found: ${key}`);
  return found;
}

describe('parsePitestReport — mini fixtures', () => {
  const base = parsePitestReport(readFixture('mini/base.xml'), {
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  const head = parsePitestReport(readFixture('mini/head.xml'), {
    createdAt: '2026-01-02T00:00:00.000Z',
  });

  it('sets tool and passthrough metadata', () => {
    expect(base.tool).toBe('pitest');
    expect(base.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('groups mutations by mutatedClass into one unit per class', () => {
    expect(base.units).toHaveLength(4);
    expect(base.units.map((u) => u.key).sort()).toEqual([
      'com.example.Calculator',
      'com.example.Legacy',
      'com.example.MathHelper',
      'com.example.StringUtils',
    ]);
  });

  it('maps PiTest statuses to normalized MutantStatus', () => {
    const calculator = unit(base, 'com.example.Calculator');
    expect(calculator.mutants).toHaveLength(2);
    expect(calculator.mutants.map((m) => m.status).sort()).toEqual(['killed', 'survived']);

    const newFeature = unit(head, 'com.example.NewFeature');
    expect(newFeature.mutants.every((m) => m.status === 'no_coverage')).toBe(true);
  });

  it('preserves mutant line, mutator and id', () => {
    const calculator = unit(base, 'com.example.Calculator');
    const addMutant = calculator.mutants.find((m) => m.line === 10);
    expect(addMutant).toBeDefined();
    expect(addMutant?.status).toBe('killed');
    expect(addMutant?.mutator).toBe('org.pitest.mutationtest.engine.gregor.mutators.MathMutator');
    expect(addMutant?.id).toBeTruthy();
  });

  it('computes per-unit metrics from the mapped statuses', () => {
    const calculator = unit(base, 'com.example.Calculator'); // 1 killed, 1 survived
    expect(calculator.metrics.score).toBeCloseTo(50);
    expect(calculator.metrics.coveredPct).toBeCloseTo(100);

    const stringUtils = unit(base, 'com.example.StringUtils'); // 1 killed
    expect(stringUtils.metrics.score).toBeCloseTo(100);

    const newFeature = unit(head, 'com.example.NewFeature'); // 2 no_coverage
    expect(newFeature.metrics.score).toBeCloseTo(0);
    expect(newFeature.metrics.coveredPct).toBeCloseTo(0);
  });

  it('computes the global aggregate across all units', () => {
    // base: 4 killed, 1 survived, validTotal 5 -> score 80, coveredPct 100
    expect(base.metrics.total).toBe(5);
    expect(base.metrics.score).toBeCloseTo(80);
    expect(base.metrics.coveredPct).toBeCloseTo(100);

    // head: 3 killed, 1 survived, 2 no_coverage, validTotal 6 -> score 50, coveredPct 66.67
    expect(head.metrics.total).toBe(6);
    expect(head.metrics.score).toBeCloseTo(50);
    expect(head.metrics.coveredPct).toBeCloseTo((4 / 6) * 100);
  });

  it('reflects a class removed in head as absent from head.units', () => {
    expect(head.units.some((u) => u.key === 'com.example.Legacy')).toBe(false);
  });

  it('reflects a class added in head as absent from base.units', () => {
    expect(base.units.some((u) => u.key === 'com.example.NewFeature')).toBe(false);
  });
});

describe('parsePitestReport — realistic fixtures', () => {
  const base = parsePitestReport(readFixture('realistic/base.xml'), {
    createdAt: '2026-01-01T00:00:00.000Z',
  });

  it('maps TIMED_OUT and RUN_ERROR to timeout/error', () => {
    const taxCalculator = unit(base, 'com.acme.billing.TaxCalculator');
    expect(taxCalculator.mutants.some((m) => m.status === 'timeout')).toBe(true);

    const paymentGateway = unit(base, 'com.acme.billing.PaymentGateway');
    expect(paymentGateway.mutants.some((m) => m.status === 'error')).toBe(true);
  });

  it('excludes error mutants from validTotal when scoring', () => {
    const paymentGateway = unit(base, 'com.acme.billing.PaymentGateway');
    const { total, error, validTotal } = paymentGateway.metrics;
    expect(validTotal).toBe(total - error);
  });
});

describe('parsePitestReport — invalid input', () => {
  it('throws a readable error for malformed XML, not a raw parser stack trace', () => {
    expect(() =>
      parsePitestReport('<mutations><mutation>', { createdAt: '2026-01-01T00:00:00.000Z' }),
    ).toThrow(/invalid|malformed|pitest/i);
  });

  it('throws a readable error when the root <mutations> element is missing', () => {
    expect(() =>
      parsePitestReport('<?xml version="1.0"?><notMutations></notMutations>', {
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow(/invalid|malformed|pitest/i);
  });
});
