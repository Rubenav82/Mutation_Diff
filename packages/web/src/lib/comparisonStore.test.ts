import type { ComparisonResult, Tool, UnitMetrics } from 'core';
import { describe, expect, it, vi } from 'vitest';
import { createComparisonStore } from './comparisonStore';

const metrics: UnitMetrics = {
  total: 1,
  killed: 1,
  survived: 0,
  noCoverage: 0,
  timeout: 0,
  error: 0,
  ignored: 0,
  validTotal: 1,
  score: 100,
  coveredPct: 100,
};

function result(tool: Tool = 'pitest'): ComparisonResult {
  return {
    tool,
    context: { regressionThreshold: 0, uncoveredThreshold: 100 },
    global: { base: metrics, head: metrics, scoreDelta: 0, coverageDelta: 0 },
    units: [],
    regressions: [],
    uncovered: [],
    added: [],
    removed: [],
  };
}

/** Storage en memoria, para no depender del sessionStorage real de jsdom. */
function fakeStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
    removeItem: (key) => void entries.delete(key),
    clear: () => entries.clear(),
    key: (index) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size;
    },
  };
}

describe('createComparisonStore', () => {
  it('returns a saved comparison by id', () => {
    const store = createComparisonStore(fakeStorage());
    store.save('abc', result());

    expect(store.load('abc')).toEqual(result());
  });

  it('returns undefined for an unknown id', () => {
    const store = createComparisonStore(fakeStorage());

    expect(store.load('nope')).toBeUndefined();
  });

  it('rehydrates from storage when the in-memory copy is gone', () => {
    // Es el caso de recargar con F5: la página se reinicia y el Map de módulo
    // nace vacío, pero sessionStorage sobrevive.
    const storage = fakeStorage();
    createComparisonStore(storage).save('abc', result('stryker'));

    const afterReload = createComparisonStore(storage);

    expect(afterReload.load('abc')).toEqual(result('stryker'));
  });

  it('keeps working in memory when storage rejects the write', () => {
    // Un resultado de miles de unidades puede reventar la cuota (~5 MB). Que
    // no se pueda guardar para la recarga no debe romper la sesión en curso.
    const storage = fakeStorage();
    const setItem = vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    const store = createComparisonStore(storage);

    store.save('abc', result());

    expect(setItem).toHaveBeenCalled();
    expect(store.load('abc')).toEqual(result());
  });

  it('keeps working when there is no storage at all', () => {
    const store = createComparisonStore(undefined);
    store.save('abc', result());

    expect(store.load('abc')).toEqual(result());
  });

  it('ignores unreadable storage entries', () => {
    const storage = fakeStorage();
    storage.setItem('mutadiff:comparison:abc', '{ not json');

    expect(createComparisonStore(storage).load('abc')).toBeUndefined();
  });
});
