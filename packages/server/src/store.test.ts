import type { ComparisonResult, UnitMetrics } from 'core';
import { describe, expect, it } from 'vitest';
import { createComparisonStore, DEFAULT_COMPARISON_TTL_MS } from './store.js';

function metrics(): UnitMetrics {
  return {
    total: 0,
    killed: 0,
    survived: 0,
    noCoverage: 0,
    timeout: 0,
    error: 0,
    ignored: 0,
    validTotal: 0,
    score: 0,
    coveredPct: 0,
  };
}

function fakeResult(): ComparisonResult {
  return {
    tool: 'pitest',
    global: { base: metrics(), head: metrics(), scoreDelta: 0, coverageDelta: 0 },
    units: [],
    regressions: [],
    uncovered: [],
    added: [],
    removed: [],
  };
}

describe('createComparisonStore', () => {
  it('returns a stored result while still within the TTL', () => {
    let time = 1000;
    const store = createComparisonStore(1000, () => time);
    const result = fakeResult();
    store.set('a', result);

    time += 500; // 500ms elapsed, TTL is 1000ms
    expect(store.get('a')).toBe(result);
  });

  it('returns undefined once the TTL has elapsed', () => {
    let time = 1000;
    const store = createComparisonStore(1000, () => time);
    store.set('a', fakeResult());

    time += 1000; // exactly at expiry
    expect(store.get('a')).toBeUndefined();
  });

  it('returns undefined for an id that was never stored', () => {
    const store = createComparisonStore(1000);
    expect(store.get('missing')).toBeUndefined();
  });

  it('deletes an expired entry so a later set for the same id starts fresh', () => {
    let time = 0;
    const store = createComparisonStore(100, () => time);
    store.set('a', fakeResult());

    time = 200; // expired
    expect(store.get('a')).toBeUndefined();

    const second = fakeResult();
    store.set('a', second);
    expect(store.get('a')).toBe(second);
  });

  it('keeps entries independent by id', () => {
    const store = createComparisonStore(1000);
    const resultA = fakeResult();
    const resultB = fakeResult();
    store.set('a', resultA);
    store.set('b', resultB);

    expect(store.get('a')).toBe(resultA);
    expect(store.get('b')).toBe(resultB);
  });

  it('exposes a sensible default TTL of one hour', () => {
    expect(DEFAULT_COMPARISON_TTL_MS).toBe(60 * 60 * 1000);
  });
});
