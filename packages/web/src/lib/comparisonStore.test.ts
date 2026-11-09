import type { ComparisonResult, Tool, UnitMetrics } from 'core';
import { describe, expect, it, vi } from 'vitest';
import { comparisonStore, createComparisonStore } from './comparisonStore';

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
    mutators: [],
  };
}

/** Storage en memoria, para no depender del sessionStorage real de jsdom. */
function fakeStorage(quota = Infinity): Storage {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      const used = [...entries.values()].reduce((total, entry) => total + entry.length, 0);
      if (used + value.length > quota) {
        throw new DOMException('QuotaExceededError');
      }
      entries.set(key, value);
    },
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

  it('keeps a rehydrated comparison in memory, so later loads return the same object', () => {
    // Tras recargar, el primer `load` parsea el JSON de storage. Si no lo guarda
    // en el `Map`, cada `load` siguiente vuelve a parsear —miles de unidades en
    // un proyecto grande— y devuelve un objeto nuevo, distinto por referencia
    // aunque igual en contenido.
    const storage = fakeStorage();
    createComparisonStore(storage).save('abc', result('stryker'));
    const afterReload = createComparisonStore(storage);

    const first = afterReload.load('abc');
    storage.clear();

    // Ya no está en storage: si sigue saliendo, y es el mismo objeto, es que
    // viene del `Map`.
    expect(afterReload.load('abc')).toBe(first);
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

  it('namespaces its keys, so it cannot collide with other entries of the same storage', () => {
    const storage = fakeStorage();
    createComparisonStore(storage).save('abc', result());

    expect(storage.getItem('mutadiff:comparison:abc')).toBe(JSON.stringify(result()));
    expect(storage.length).toBe(1);
  });

  it('ignores unreadable storage entries', () => {
    const storage = fakeStorage();
    storage.setItem('mutadiff:comparison:abc', '{ not json');

    expect(createComparisonStore(storage).load('abc')).toBeUndefined();
  });

  describe('when the new comparison does not fit', () => {
    // La entrada más larga de las dos que usan estos tests.
    const entrySize = JSON.stringify(result('stryker')).length;

    it('frees the earlier comparisons, so the latest one survives a reload', () => {
      // Cabe una sola: F5 solo necesita la última.
      const storage = fakeStorage(entrySize);
      const store = createComparisonStore(storage);
      store.save('old', result('pitest'));

      expect(store.save('new', result('stryker'))).toBe(true);

      const afterReload = createComparisonStore(storage);
      expect(afterReload.load('new')).toEqual(result('stryker'));
      expect(afterReload.load('old')).toBeUndefined();
    });

    it('keeps the freed comparison available within the tab', () => {
      const store = createComparisonStore(fakeStorage(entrySize));
      store.save('old', result('pitest'));

      store.save('new', result('stryker'));

      expect(store.load('old')).toEqual(result('pitest'));
    });

    it('frees every earlier comparison, not just the first one found', () => {
      // El borrado cambia los índices de `storage.key`: recorrerlo mientras se
      // borra se saltaría entradas.
      const storage = fakeStorage();
      const store = createComparisonStore(storage);
      store.save('a', result());
      store.save('b', result());
      store.save('c', result());
      vi.spyOn(storage, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('QuotaExceededError');
      });

      store.save('new', result());

      expect(storage.length).toBe(1);
      expect(storage.getItem('mutadiff:comparison:new')).toBe(JSON.stringify(result()));
    });

    it('leaves the entries of other owners alone', () => {
      const storage = fakeStorage();
      storage.setItem('other', 'keep me');
      const store = createComparisonStore(storage);
      store.save('old', result());
      vi.spyOn(storage, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('QuotaExceededError');
      });

      store.save('new', result());

      expect(storage.getItem('other')).toBe('keep me');
    });

    it('frees nothing while there is room', () => {
      const storage = fakeStorage(entrySize * 2);
      const store = createComparisonStore(storage);
      store.save('old', result());

      expect(store.save('new', result())).toBe(true);

      expect(storage.length).toBe(2);
    });

    it('reports failure when it does not fit even alone, and still works in memory', () => {
      const store = createComparisonStore(fakeStorage(entrySize - 1));

      expect(store.save('big', result('stryker'))).toBe(false);

      expect(store.load('big')).toEqual(result('stryker'));
    });
  });

  it('reports failure when there is no storage at all', () => {
    expect(createComparisonStore(undefined).save('abc', result())).toBe(false);
  });

  describe('survivesReload', () => {
    it('is true for a comparison that reached storage', () => {
      const store = createComparisonStore(fakeStorage());
      store.save('abc', result());

      expect(store.survivesReload('abc')).toBe(true);
    });

    it('is false for a comparison that only lives in memory', () => {
      const store = createComparisonStore(fakeStorage(1));
      store.save('abc', result());

      expect(store.survivesReload('abc')).toBe(false);
    });

    it('is false once a later comparison has freed it', () => {
      const store = createComparisonStore(fakeStorage(JSON.stringify(result()).length));
      store.save('old', result());
      store.save('new', result());

      expect(store.survivesReload('old')).toBe(false);
      expect(store.survivesReload('new')).toBe(true);
    });

    it('is false when there is no storage at all', () => {
      const store = createComparisonStore(undefined);
      store.save('abc', result());

      expect(store.survivesReload('abc')).toBe(false);
    });

    it('is false when storage cannot be read', () => {
      const storage = fakeStorage();
      const store = createComparisonStore(storage);
      store.save('abc', result());
      vi.spyOn(storage, 'getItem').mockImplementation(() => {
        throw new DOMException('SecurityError');
      });

      expect(store.survivesReload('abc')).toBe(false);
    });
  });
});

describe('comparisonStore (module singleton)', () => {
  it('backs the session on sessionStorage, which is what survives a reload', () => {
    comparisonStore.save('singleton', result('stryker'));

    expect(sessionStorage.getItem('mutadiff:comparison:singleton')).toBe(
      JSON.stringify(result('stryker')),
    );
  });
});
