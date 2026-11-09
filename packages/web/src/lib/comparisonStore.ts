import type { ComparisonResult } from 'core';

export interface ComparisonStore {
  /** Returns whether the comparison reached storage, i.e. survives a reload. */
  save(id: string, result: ComparisonResult): boolean;
  load(id: string): ComparisonResult | undefined;
  survivesReload(id: string): boolean;
}

const KEY_PREFIX = 'mutadiff:comparison:';

// Se recogen las claves antes de borrar: `removeItem` desplaza los índices de
// `storage.key`, y borrar mientras se recorre se saltaría entradas.
function freeComparisons(storage: Storage): void {
  Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => key?.startsWith(KEY_PREFIX) === true)
    .forEach((key) => storage.removeItem(key));
}

function persist(storage: Storage | undefined, key: string, value: string): boolean {
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(key, value);
  } catch {
    // F5 solo necesita la última, y las anteriores siguen en el `Map` mientras
    // no se recargue. Si tampoco cabe sola, las anteriores ya no servirían para
    // la recarga de esta pestaña, que es lo único para lo que estaban ahí.
    freeComparisons(storage);
    storage.setItem(key, value);
  }
  return true;
}

/**
 * Holds the comparisons of the current browser session, replacing the
 * server-side store with a TTL that this app no longer has a server for.
 *
 * Two layers on purpose. The `Map` is the source of truth and always works.
 * `Storage` is a best-effort backup so a reload does not lose the dashboard:
 * a result with thousands of units can blow the ~5 MB quota, and losing the
 * ability to reload is a far smaller problem than failing the comparison. When
 * a new comparison does not fit, the earlier ones are freed to make room; the
 * dashboard asks `survivesReload` to warn about the ones left out.
 *
 * Takes its storage as an argument for the same reason `createComparisonStore`
 * in the server took an injectable clock: it makes the failure modes testable.
 */
export function createComparisonStore(storage: Storage | undefined): ComparisonStore {
  const memory = new Map<string, ComparisonResult>();

  return {
    save(id, result) {
      memory.set(id, result);
      try {
        return persist(storage, `${KEY_PREFIX}${id}`, JSON.stringify(result));
      } catch {
        // Quota exceeded, or storage blocked by the browser. The session keeps
        // working; only a reload would come up empty.
        return false;
      }
    },

    survivesReload(id) {
      try {
        return (storage?.getItem(`${KEY_PREFIX}${id}`) ?? null) !== null;
      } catch {
        return false;
      }
    },

    load(id) {
      const cached = memory.get(id);
      if (cached) {
        return cached;
      }

      try {
        const raw = storage?.getItem(`${KEY_PREFIX}${id}`);
        if (raw === null || raw === undefined) {
          return undefined;
        }
        const parsed = JSON.parse(raw) as ComparisonResult;
        memory.set(id, parsed);
        return parsed;
      } catch {
        return undefined;
      }
    },
  };
}

// Sin guard `typeof sessionStorage`: este módulo solo corre en el navegador o
// en jsdom, y en los dos existe. El parámetro sigue siendo inyectable para los
// tests de los modos de fallo.
export const comparisonStore = createComparisonStore(sessionStorage);
