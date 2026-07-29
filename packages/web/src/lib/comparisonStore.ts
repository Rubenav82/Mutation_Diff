import type { ComparisonResult } from 'core';

export interface ComparisonStore {
  save(id: string, result: ComparisonResult): void;
  load(id: string): ComparisonResult | undefined;
}

const KEY_PREFIX = 'mutadiff:comparison:';

/**
 * Holds the comparisons of the current browser session, replacing the
 * server-side store with a TTL that this app no longer has a server for.
 *
 * Two layers on purpose. The `Map` is the source of truth and always works.
 * `Storage` is a best-effort backup so a reload does not lose the dashboard:
 * a result with thousands of units can blow the ~5 MB quota, and losing the
 * ability to reload is a far smaller problem than failing the comparison.
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
        storage?.setItem(`${KEY_PREFIX}${id}`, JSON.stringify(result));
      } catch {
        // Quota exceeded, or storage blocked by the browser. The session keeps
        // working; only a reload would come up empty.
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

export const comparisonStore = createComparisonStore(
  typeof sessionStorage === 'undefined' ? undefined : sessionStorage,
);
